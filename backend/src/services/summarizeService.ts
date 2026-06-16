import axios from 'axios'
import { execSync } from 'child_process'
import { ffmpegPath } from './videoService'

const NINEROUTER_BASE_URL = process.env.NINEROUTER_BASE_URL || 'https://api.9router.com/v1'
const NINEROUTER_API_KEY = process.env.NINEROUTER_API_KEY

/**
 * One chapter / key moment extracted from the video
 */
export interface VideoChapter {
  title: string
  start_time: number  // in seconds
  end_time: number    // in seconds
  summary: string     // 1–2 sentence description
  importance: 'high' | 'medium' | 'low'
  tags: string[]      // e.g. ['dunk', 'highlight', 'montage']
}

export interface VideoSummaryResult {
  overview: string                // 2–3 sentence overview of the whole video
  chapters: VideoChapter[]        // key moments with precise timestamps
  total_clips_duration: number    // seconds of selected content
  suggested_music_genre: string
  dominant_mood: string
}

// ─── Helper: call AI ──────────────────────────────────────────────

async function callAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const models = [
    'big-pickle',
    'deepseek-v4-flash-free',
    'mimo-auto',
  ]

  for (const model of models) {
    try {
      const res = await axios.post(
        `${NINEROUTER_BASE_URL}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${NINEROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      )
      const content = res.data.choices?.[0]?.message?.content || ''
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
      return cleaned
    } catch {
      continue
    }
  }
  return null
}

// ─── Extract transcript / chapters from yt-dlp metadata ──────────

export function extractChaptersFromRaw(raw: any): { title: string; start_time: number; end_time: number }[] {
  // yt-dlp returns chapters array when available
  if (raw.chapters && Array.isArray(raw.chapters) && raw.chapters.length > 0) {
    return raw.chapters.map((ch: any, i: number) => ({
      title: ch.title || `Chapter ${i + 1}`,
      start_time: Math.round(ch.start_time || 0),
      end_time: Math.round(ch.end_time || ch.start_time + 30),
    }))
  }
  return []
}

// ─── Main: Summarize video into key moments with timestamps ──────

export async function summarizeVideoMoments(params: {
  title: string
  description: string
  duration: number
  platform: string
  chapters?: { title: string; start_time: number; end_time: number }[]
  subtitleText?: string
}): Promise<VideoSummaryResult> {

  const { title, description, duration, platform, chapters = [], subtitleText } = params

  // Build context for AI
  const chaptersText = chapters.length > 0
    ? `\n\nVIDEO CHAPTERS (from YouTube):\n${chapters.map(c =>
        `  [${formatSec(c.start_time)} - ${formatSec(c.end_time)}] ${c.title}`
      ).join('\n')}`
    : ''

  const subtitleContext = subtitleText
    ? `\n\nTRANSCRIPT EXCERPT (first 2000 chars):\n${subtitleText.slice(0, 2000)}`
    : ''

  const systemPrompt = `You are an expert video editor and content analyst. Your task is to analyze a video and identify its KEY MOMENTS — the most important, exciting, or interesting parts — with precise timestamps. Think like YouTube's "Key Moments" feature or Gemini's video summarization. Respond with valid JSON only.`

  const userPrompt = `Analyze this video and extract its key moments with precise timestamps for clipping:

Title: "${title}"
Platform: ${platform}
Duration: ${duration} seconds (${formatSec(duration)})
Description: ${description?.slice(0, 800) || 'N/A'}
${chaptersText}
${subtitleContext}

Your job: identify the MOST IMPORTANT/EXCITING moments in this video (like a highlight reel or montage editor would).

For NBA/sports: look for dunks, ankle breakers, blocks, highlights, clutch moments
For vlogs/tutorials: look for key demonstrations, reveals, punchlines, climax moments  
For any video: identify the parts people would want to share or re-watch

Return JSON with this EXACT structure:
{
  "overview": "2-3 sentence summary of the entire video",
  "chapters": [
    {
      "title": "Epic Dunk Sequence",
      "start_time": 45,
      "end_time": 58,
      "summary": "Player executes a spectacular reverse dunk over two defenders",
      "importance": "high",
      "tags": ["dunk", "highlight"]
    },
    {
      "title": "Ankle Breaker Crossover",
      "start_time": 122,
      "end_time": 134,
      "summary": "Crossover leaves defender on the floor",
      "importance": "high",
      "tags": ["ankle_breaker", "highlight"]
    }
  ],
  "total_clips_duration": 60,
  "suggested_music_genre": "hiphop",
  "dominant_mood": "energetic"
}

RULES:
- Extract 5-12 key moments
- Each moment should be 5-30 seconds long
- Spread moments across the ENTIRE video duration (not just beginning)
- total_clips_duration = sum of all selected (end_time - start_time)
- Importance: "high" = must include, "medium" = good to include, "low" = optional
- start_time and end_time must be in SECONDS (integers)
- All timestamps must be within 0 to ${duration} seconds`

  const result = await callAI(systemPrompt, userPrompt)

  if (result) {
    try {
      const parsed = JSON.parse(result) as VideoSummaryResult
      // Validate structure
      if (parsed.chapters && Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
        // Clamp timestamps
        parsed.chapters = parsed.chapters.map(ch => ({
          ...ch,
          start_time: Math.max(0, Math.min(ch.start_time, duration - 1)),
          end_time: Math.max(ch.start_time + 3, Math.min(ch.end_time, duration)),
        }))
        return parsed
      }
    } catch {
      // fall through to fallback
    }
  }

  // ── Smart fallback: distribute moments across video ────────────
  console.warn('[ClipAI] AI summarization failed, using smart fallback')
  return generateSmartFallback(title, duration, chapters)
}

// ─── Smart fallback when AI is unavailable ────────────────────────

function generateSmartFallback(
  title: string,
  duration: number,
  chapters: { title: string; start_time: number; end_time: number }[]
): VideoSummaryResult {
  const titleLower = title.toLowerCase()
  const isNBA = ['nba', 'basketball', 'dunk', 'highlights', 'knicks', 'lakers', 'celtics', 'warriors'].some(kw => titleLower.includes(kw))

  // If yt-dlp provided chapters, use them directly!
  if (chapters.length >= 3) {
    return {
      overview: `Key moments from: ${title}`,
      chapters: chapters.slice(0, 10).map((ch, i) => {
        const types = isNBA
          ? ['dunk', 'ankle_breaker', 'three_pointer', 'block', 'steal', 'highlight']
          : ['highlight', 'moment', 'scene']
        return {
          title: ch.title,
          start_time: ch.start_time,
          end_time: Math.min(ch.end_time, ch.start_time + 20), // cap at 20s per clip
          summary: ch.title,
          importance: i < 3 ? 'high' as const : 'medium' as const,
          tags: [types[i % types.length]],
        }
      }),
      total_clips_duration: 60,
      suggested_music_genre: isNBA ? 'hiphop' : 'electronic',
      dominant_mood: 'energetic',
    }
  }

  // Pure fallback: distribute N clips across video
  const nbaTypes = ['dunk', 'ankle_breaker', 'three_pointer', 'block', 'steal', 'highlight']
  const numClips = Math.min(8, Math.max(4, Math.floor(duration / 25)))
  const chaptersList: VideoChapter[] = []

  for (let i = 0; i < numClips; i++) {
    const segStart = Math.floor((duration / numClips) * i + 3)
    const segEnd = Math.min(segStart + 8 + Math.floor(Math.random() * 8), duration)
    const tag = isNBA ? nbaTypes[i % nbaTypes.length] : 'highlight'
    chaptersList.push({
      title: isNBA
        ? `${tag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} at ${formatSec(segStart)}`
        : `Highlight at ${formatSec(segStart)}`,
      start_time: segStart,
      end_time: segEnd,
      summary: `Key moment at ${formatSec(segStart)}`,
      importance: i < 3 ? 'high' : 'medium',
      tags: [tag],
    })
  }

  return {
    overview: `Highlight compilation from: ${title}`,
    chapters: chaptersList,
    total_clips_duration: chaptersList.reduce((sum, c) => sum + (c.end_time - c.start_time), 0),
    suggested_music_genre: isNBA ? 'hiphop' : 'electronic',
    dominant_mood: 'energetic',
  }
}

// ─── Utility ──────────────────────────────────────────────────────

function formatSec(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
