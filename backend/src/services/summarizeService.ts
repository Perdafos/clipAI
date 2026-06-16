import axios from 'axios'

const NINEROUTER_BASE_URL = process.env.NINEROUTER_BASE_URL || 'https://api.9router.com/v1'
const NINEROUTER_API_KEY = process.env.NINEROUTER_API_KEY

export interface VideoChapter {
  title: string
  start_time: number
  end_time: number
  summary: string
  importance: 'high' | 'medium' | 'low'
  tags: string[]
}

export interface VideoSummaryResult {
  overview: string
  chapters: VideoChapter[]
  total_clips_duration: number
  suggested_music_genre: string
  dominant_mood: string
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!NINEROUTER_API_KEY) {
    throw new Error('9router API key not configured (NINEROUTER_API_KEY)')
  }

  const models = ['big-pickle', 'deepseek-v4-flash-free', 'mimo-auto']
  let lastError = ''

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
      const content = res.data.choices?.[0]?.message?.content
      if (!content) { lastError = `${model}: empty response`; continue }
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
      return cleaned
    } catch (err: unknown) {
      const e = err as { response?: { status: number }, message: string, code?: string }
      if (e.code === 'ECONNABORTED') { lastError = `${model} timed out`; continue }
      if (e.response?.status === 429) { lastError = `${model} rate limited`; continue }
      if (e.response?.status === 401 || e.response?.status === 403) {
        throw new Error('9router API authentication failed')
      }
      lastError = `${model}: ${e.message?.slice(0, 200)}`
      continue
    }
  }

  throw new Error(`AI summarization unavailable. ${lastError}`)
}

export async function summarizeVideoMoments(params: {
  title: string
  description: string
  duration: number
  platform: string
  chapters?: { title: string; start_time: number; end_time: number }[]
  subtitleText?: string
}): Promise<VideoSummaryResult> {
  const { title, description, duration, platform, chapters = [], subtitleText } = params

  const chaptersText = chapters.length > 0
    ? `\n\nVIDEO CHAPTERS (from YouTube):\n${chapters.map(c =>
        `  [${formatSec(c.start_time)} - ${formatSec(c.end_time)}] ${c.title}`
      ).join('\n')}`
    : ''

  const subtitleContext = subtitleText
    ? `\n\nTRANSCRIPT EXCERPT (first 2000 chars):\n${subtitleText.slice(0, 2000)}`
    : ''

  const systemPrompt = `You are an expert video editor and content analyst. Analyze a video and identify its KEY MOMENTS with precise timestamps. Respond with valid JSON only.`

  const userPrompt = `Analyze this video and extract its key moments with precise timestamps for clipping:

Title: "${title}"
Platform: ${platform}
Duration: ${duration} seconds (${formatSec(duration)})
Description: ${description?.slice(0, 800) || 'N/A'}
${chaptersText}
${subtitleContext}

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
    }
  ],
  "total_clips_duration": 60,
  "suggested_music_genre": "hiphop",
  "dominant_mood": "energetic"
}

RULES:
- Extract 5-12 key moments
- Each moment 5-30 seconds
- Spread moments across entire video
- total_clips_duration = sum of all (end_time - start_time)
- Importance: "high"/"medium"/"low"
- All timestamps in SECONDS, within 0 to ${duration}`

  const result = await callAI(systemPrompt, userPrompt)
  const parsed = JSON.parse(result) as VideoSummaryResult

  if (!parsed.chapters || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
    throw new Error('AI returned no valid chapters')
  }

  parsed.chapters = parsed.chapters.map(ch => ({
    ...ch,
    start_time: Math.max(0, Math.min(ch.start_time, duration - 1)),
    end_time: Math.max(ch.start_time + 3, Math.min(ch.end_time, duration)),
  }))

  return parsed
}

function formatSec(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
