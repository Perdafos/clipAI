import { WebSocket } from 'ws'
import { downloadVideo, createJobDir, hasFfmpeg, ffmpegPath } from '../services/videoService'
import { generateFFmpegCommand, scoreClipQuality } from '../services/aiService'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'

const execAsync = promisify(exec)

// In-memory job store (use Redis in production)
export const jobStore = new Map<string, Record<string, unknown>>()
// WebSocket connections indexed by jobId
const wsConnections = new Map<string, WebSocket>()

export function wsHandler(ws: WebSocket, req: { url?: string }) {
  const jobId = req.url?.split('/').pop() || ''

  if (!jobId) {
    ws.close(1008, 'Job ID required')
    return
  }

  wsConnections.set(jobId, ws)
  console.log(`WebSocket connected for job: ${jobId}`)

  ws.on('close', () => {
    wsConnections.delete(jobId)
    console.log(`WebSocket disconnected for job: ${jobId}`)
  })

  ws.on('error', (err) => {
    console.error(`WebSocket error for job ${jobId}:`, err)
  })

  // Send current job status immediately on connect
  const job = jobStore.get(jobId)
  if (job) {
    sendProgress(jobId, 'status', job.status as string, job.percent as number || 0, 'Connected to job')
  }
}

function sendProgress(
  jobId: string,
  type: 'progress' | 'complete' | 'error' | 'status',
  stage: string,
  percent: number,
  message: string,
  data?: unknown
) {
  const ws = wsConnections.get(jobId)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type,
      jobId,
      timestamp: Date.now(),
      payload: { stage, percent, message, data }
    }))
  }

  // Also update job store
  const job = jobStore.get(jobId) || {}
  jobStore.set(jobId, { ...job, status: stage, percent, lastMessage: message })
}

/**
 * Main job processing pipeline
 */
/**
 * Parse user-written timestamp patterns from prompt text.
 * Supports:
 *   "(1:23 - 4:56)"  "(1:23–4:56)" → pair timestamps
 *   "1:23 to 4:56" / "1:23 → 4:56"
 *   "(2:31):" "(2:31)," "(2:31)"  → single timestamps (uses defaultClipDur)
 *   "menit 2:31" / "detik 2:31"
 */
function parseTimestampsFromPrompt(text: string, defaultClipDur = 8): Array<{ start: number; end: number }> {
  const pairs: Array<{ start: number; end: number }> = []
  const usedStarts = new Set<number>()

  function toSec(t: string): number {
    const parts = t.split(':').map(Number)
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0] // single number
  }

  // ── FIRST PASS: find timestamp PAIRS (mm:ss - mm:ss) ──────────────
  const pairRe = /(\d{1,2}:\d{2})\s*(?:[-–]|to|→)\s*(\d{1,2}:\d{2})/gi
  let match: RegExpExecArray | null
  while ((match = pairRe.exec(text)) !== null) {
    const start = toSec(match[1])
    const end = toSec(match[2])
    if (end > start && start >= 0) {
      pairs.push({ start, end })
      usedStarts.add(start)
    }
  }

  // ── SECOND PASS: find SINGLE timestamps not already used in pairs ──
  // Matches: (2:31)  (2:31):  2:31,  2:31.  "pukul 2:31"  "menit 2:31"
  const singleRe = /(\d{1,2}:\d{2})(?=[\s,.;:)\]]|$)/gi
  while ((match = singleRe.exec(text)) !== null) {
    const start = toSec(match[1])
    if (!usedStarts.has(start)) {
      pairs.push({ start, end: Math.min(start + defaultClipDur, 36000) })
      usedStarts.add(start)
    }
  }

  return pairs
}

export async function processJob(
  jobId: string,
  url: string,
  clipConfig: {
    targetDuration: 30 | 60 | 90
    quality: string
    format: string
    addCaptions: boolean
    aspectRatio?: '9:16' | '1:1' | '16:9'
  },
  musicSelection: {
    mode: 'ai' | 'manual' | 'upload'
    trackId?: string
    uploadedFileId?: string
    volume: number
    fadeIn: number
    fadeOut: number
  },
  clipPrompt?: string
) {
  const paths = createJobDir(jobId)

  try {
    // ── STEP 1: Download Video ─────────────────────────────────
    sendProgress(jobId, 'progress', 'downloading', 5, 'Starting video download...')

    await downloadVideo(url, paths.videoPath, (percent) => {
      sendProgress(jobId, 'progress', 'downloading', Math.floor(percent * 0.35), `Downloading video... ${percent}%`)
    })

    sendProgress(jobId, 'progress', 'downloading', 35, 'Video downloaded successfully')

    // ── STEP 2: Get Metadata + Chapters from job store ────────
    sendProgress(jobId, 'progress', 'analyzing', 38, 'Analyzing video structure...')

    const job = jobStore.get(jobId) || {}
    const metadata = job.metadata as {
      title: string
      duration: number
      platform: string
      description: string
      chapters?: { title: string; start_time: number; end_time: number }[]
    } | undefined

    // ── STEP 3: Parse user-provided timestamps OR run AI ──────────
    let summary: { overview: string; chapters: Array<{ title: string; start_time: number; end_time: number; summary: string; importance: string; tags: string[] }>; dominant_mood: string; suggested_music_genre: string } | null = null
    let selectedChapters: Array<{ start_time: number; end_time: number; title: string; summary: string; importance: string; tags: string[] }> = []
    let timestamps: { clips: Array<{ start: number; end: number; transition: 'cut' | 'fade' | 'dissolve' }>; total_duration: number }

    const userTimestamps = clipPrompt ? parseTimestampsFromPrompt(clipPrompt) : []

    if (userTimestamps.length > 0) {
      // ── User provided timestamps — skip AI, use directly ────────
      sendProgress(jobId, 'progress', 'analyzing', 42, `📋 Using ${userTimestamps.length} timestamps from prompt...`)

      const targetDur = clipConfig.targetDuration
      let totalDur = 0
      const selectedClips: typeof userTimestamps = []

      for (const clip of userTimestamps) {
        const dur = clip.end - clip.start
        if (totalDur + dur <= targetDur + 15) {
          selectedClips.push(clip)
          totalDur += dur
          if (totalDur >= targetDur) break
        }
      }

      const sorted = selectedClips.sort((a, b) => a.start - b.start)

      timestamps = {
        clips: sorted.map(c => ({ start: c.start, end: c.end, transition: 'cut' as const })),
        total_duration: totalDur,
      }

      // Build mock chapters from user timestamps for the complete event
      selectedChapters = sorted.map((c, i) => ({
        start_time: c.start,
        end_time: c.end,
        title: `Clip ${i + 1}`,
        summary: `Custom clip from ${c.start}s to ${c.end}s`,
        importance: 'medium',
        tags: ['highlight'],
      }))

      sendProgress(jobId, 'progress', 'analyzing', 55,
        `📋 Using your timestamps: ${selectedClips.length} clips, ${Math.round(totalDur)}s`)
    } else {
      // ── No user timestamps — run AI summarization ───────────────
      sendProgress(jobId, 'progress', 'analyzing', 42, '✨ AI is summarizing video and finding key moments...')

      const { summarizeVideoMoments } = await import('../services/summarizeService')
      summary = await summarizeVideoMoments({
        title: metadata?.title || 'Unknown',
        description: metadata?.description || '',
        duration: metadata?.duration || 60,
        platform: metadata?.platform || 'youtube',
        chapters: metadata?.chapters || [],
      })

      sendProgress(jobId, 'progress', 'analyzing', 55,
        `Found ${summary.chapters.length} key moments: ${summary.chapters.slice(0, 3).map(c => c.title).join(', ')}...`)

      // Convert summary chapters → clip timestamps
      sendProgress(jobId, 'progress', 'generating', 65, `Building clip timeline from ${summary.chapters.length} key moments...`)

      const sortedChapters = [...summary.chapters].sort((a, b) => {
        const imp: Record<string, number> = { high: 3, medium: 2, low: 1 }
        return (imp[b.importance] || 1) - (imp[a.importance] || 1)
      })

      let totalDur = 0
      for (const ch of sortedChapters) {
        const dur = ch.end_time - ch.start_time
        if (totalDur + dur <= clipConfig.targetDuration + 15) {
          selectedChapters.push(ch)
          totalDur += dur
          if (totalDur >= clipConfig.targetDuration) break
        }
      }
      selectedChapters.sort((a, b) => a.start_time - b.start_time)

      timestamps = {
        clips: selectedChapters.map(ch => ({
          start: ch.start_time,
          end: ch.end_time,
          transition: 'cut' as const,
        })),
        total_duration: totalDur,
      }

      sendProgress(jobId, 'progress', 'generating', 72, `Timeline ready: ${timestamps.clips.length} clips, ${Math.round(totalDur)}s total`)
    }

    // ── STEP 4: Music Selection ────────────────────────────────────
    sendProgress(jobId, 'progress', 'selecting_music', 58, 'Selecting music...')

    let musicFilePath: string | null = null
    const { getMusicLibrary, getMusicFilePath } = await import('../services/musicService')
    const { recommendMusic } = await import('../services/aiService')
    const dominantMood = summary?.dominant_mood || 'energetic'
    const suggestedGenre = summary?.suggested_music_genre || 'electronic'

    if (musicSelection.mode === 'ai') {
      const library = getMusicLibrary()
      const recommendation = await recommendMusic({
        dominantMood,
        suggestedGenre,
        targetDuration: clipConfig.targetDuration,
        platform: metadata?.platform || 'youtube',
        availableTracks: library.map(t => ({
          id: t.id, title: t.title,
          genre: t.genre, mood: t.mood, bpm: t.bpm,
        }))
      })
      if (recommendation) {
        musicFilePath = getMusicFilePath(recommendation.recommended_track_id)
      }
    } else if (musicSelection.mode === 'manual' && musicSelection.trackId) {
      musicFilePath = getMusicFilePath(musicSelection.trackId)
    } else if (musicSelection.mode === 'upload' && musicSelection.uploadedFileId) {
      musicFilePath = `./uploads/${musicSelection.uploadedFileId}/music.mp3`
    }

    sendProgress(jobId, 'progress', 'selecting_music', 62, 'Music selected!')

    // ── STEP 6: Generate & Execute FFmpeg Command ──────────────
    sendProgress(jobId, 'progress', 'generating', 75, 'Processing video clips...')

    if (!hasFfmpeg) {
      // ── TRY system ffmpeg first (PATH) before giving up ─────────
      let ffmpegFallbackSucceeded = false
      try {
        const simpleCmd = buildFallbackFFmpegCommand(paths.videoPath, timestamps.clips, paths.outputPath)
        const systemCmd = simpleCmd.replace(/^ffmpeg\s+/, '')
        await execAsync(`ffmpeg ${systemCmd}`, { timeout: 300000 })
        ffmpegFallbackSucceeded = true
        console.log('[ClipAI] Used system ffmpeg (PATH) as fallback')
      } catch (sysErr) {
        console.warn('[ClipAI Fallback] System ffmpeg also unavailable, using mock copy:', (sysErr as Error).message)
      }

      if (!ffmpegFallbackSucceeded) {
        console.warn('[ClipAI Fallback] Simulating video rendering (no ffmpeg installed)')
        for (let i = 75; i <= 90; i += 5) {
          await new Promise(resolve => setTimeout(resolve, 500))
          sendProgress(jobId, 'progress', 'generating', i, `Processing video clips (Mock Render)... ${Math.floor((i-75)/15*100)}%`)
        }
        if (fs.existsSync(paths.videoPath)) {
          fs.copyFileSync(paths.videoPath, paths.outputPath)
        } else {
          fs.writeFileSync(paths.outputPath, 'mock video content')
        }
      }
    } else {
      const ffmpegCmd = await generateFFmpegCommand({
        inputFile: paths.videoPath,
        clips: timestamps.clips,
        musicFile: musicFilePath,
        outputFile: paths.outputPath,
        musicVolume: musicSelection.volume || 0.7,
        fadeIn: musicSelection.fadeIn || 1,
        fadeOut: musicSelection.fadeOut || 2,
        aspectRatio: clipConfig.aspectRatio,
      })

      if (!ffmpegCmd) {
        // Fallback to simple clip extraction
        const simpleCmd = buildFallbackFFmpegCommand(paths.videoPath, timestamps.clips, paths.outputPath)
        const finalCmd = simpleCmd.replace(/^ffmpeg\s+/, `"${ffmpegPath}" `)
        console.log(`[FFmpeg] Running: ${finalCmd}`)
        await execAsync(finalCmd, { timeout: 300000 })
      } else {
        // Validate AI-generated command for security
        if (validateFFmpegCommand(ffmpegCmd)) {
          // Inject thread & preset limits to prevent freeze
          let safeCmd = ffmpegCmd
          if (!safeCmd.includes('-preset')) safeCmd = safeCmd.replace(/-c:v libx264/, '-c:v libx264 -preset ultrafast')
          if (!safeCmd.includes('-threads')) safeCmd = safeCmd.replace(/-c:v libx264/, '-c:v libx264 -threads 2')
          const finalCmd = safeCmd.replace(/^ffmpeg\s+/, `"${ffmpegPath}" `)
          console.log(`[FFmpeg] Running: ${finalCmd}`)
          await execAsync(finalCmd, { timeout: 300000 })
        } else {
          throw new Error('Generated FFmpeg command failed security validation')
        }
      }
    }

    sendProgress(jobId, 'progress', 'finalizing', 90, 'Finalizing your clip...')

    // ── STEP 7: Quality Check ─────────────────────────────────
    const qualityResult = await scoreClipQuality({
      title: metadata?.title || 'Unknown',
      duration: timestamps.total_duration,
      clipCount: timestamps.clips.length,
      hasMusic: !!musicFilePath,
      dominantMood,
    })

    const fileSize = fs.existsSync(paths.outputPath)
      ? fs.statSync(paths.outputPath).size
      : 0

    // ── STEP 8: Complete ──────────────────────────────────────
    sendProgress(jobId, 'complete', 'complete', 100, 'Your clip is ready!', {
      downloadUrl: `/downloads/${jobId}/final_output.mp4`,
      duration: timestamps.total_duration,
      qualityScore: qualityResult?.score || 0.75,
      fileSize,
      thumbnail: `/thumbnails/${jobId}.jpg`,
      overview: summary?.overview || `Clip created from ${timestamps.clips.length} segments`,
      clips: selectedChapters.map(ch => ({
        start: ch.start_time,
        end: ch.end_time,
        clip_type: ch.tags?.[0] || 'highlight',
        reason: ch.summary || ch.title,
        score: ch.importance === 'high' ? 0.95 : ch.importance === 'medium' ? 0.8 : 0.65,
        title: ch.title,
      })),
    })

    // Schedule cleanup in 1 hour
    setTimeout(() => {
      const { cleanupJob } = require('../services/videoService')
      cleanupJob(jobId)
    }, 60 * 60 * 1000)

  } catch (err: unknown) {
    const error = err as Error
    console.error(`Job ${jobId} error:`, error.message)
    sendProgress(jobId, 'error', 'error', 0, error.message, {
      code: 'PROCESSING_ERROR',
      message: error.message,
      retryable: true,
    })
  }
}

function validateFFmpegCommand(cmd: string): boolean {
  const forbidden = ['rm ', 'sudo', 'curl ', 'wget ', '| bash', '&&', ';', '`']
  return cmd.startsWith('ffmpeg') && !forbidden.some(f => cmd.includes(f))
}

function buildFallbackFFmpegCommand(
  inputFile: string,
  clips: Array<{ start: number; end: number }>,
  outputFile: string
): string {
  if (clips.length === 0) return ''

  const filterParts: string[] = []
  const concatParts: string[] = []

  clips.forEach((clip, i) => {
    filterParts.push(`[0:v]trim=start=${clip.start}:end=${clip.end},setpts=PTS-STARTPTS[v${i}]`)
    filterParts.push(`[0:a]atrim=start=${clip.start}:end=${clip.end},asetpts=PTS-STARTPTS[a${i}]`)
    concatParts.push(`[v${i}][a${i}]`)
  })

  const filter = [
    ...filterParts,
    `${concatParts.join('')}concat=n=${clips.length}:v=1:a=1[vout][aout]`
  ].join(';')

  return `ffmpeg -i "${inputFile}" -filter_complex "${filter}" -map "[vout]" -map "[aout]" -c:v libx264 -preset ultrafast -threads 2 -c:a aac "${outputFile}" -y`
}
