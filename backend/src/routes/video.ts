import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { fetchVideoMetadata, createJobDir, downloadVideo, extractAudio } from '../services/videoService'
import { analyzeVideoScenes, generateClipTimestamps, scoreClipQuality } from '../services/aiService'
import { processJob, jobStore } from './ws'

const router = new Hono()

const URL_PATTERNS = {
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/,
  tiktok: /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/,
}

function detectPlatform(url: string) {
  if (URL_PATTERNS.youtube.test(url)) return 'youtube'
  if (URL_PATTERNS.tiktok.test(url)) return 'tiktok'
  if (URL_PATTERNS.instagram.test(url)) return 'instagram'
  return null
}

// POST /api/video/analyze - Fetch metadata only
router.post('/analyze', async (c) => {
  const requestId = uuidv4()

  try {
    const body = await c.req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return c.json({ success: false, data: null, error: 'URL is required', requestId }, 400)
    }

    const platform = detectPlatform(url.trim())
    if (!platform) {
      return c.json({
        success: false, data: null,
        error: 'URL is not supported. Please use YouTube, TikTok, or Instagram URLs.',
        requestId
      }, 400)
    }

    const metadata = await fetchVideoMetadata(url.trim())

    const MAX_DURATION = parseInt(process.env.MAX_VIDEO_DURATION || '600')
    if (metadata.duration > MAX_DURATION) {
      return c.json({
        success: false, data: null,
        error: `Video duration (${metadata.duration}s) exceeds maximum allowed (${MAX_DURATION}s). Please use a shorter video.`,
        requestId
      }, 422)
    }

    return c.json({ success: true, data: metadata, error: null, requestId })

  } catch (err: unknown) {
    const error = err as Error
    console.error('Video analyze error:', error.message)
    return c.json({
      success: false, data: null,
      error: 'Failed to fetch video information. The video may be private or unavailable.',
      requestId
    }, 500)
  }
})

// POST /api/video/process - Start full processing job
router.post('/process', async (c) => {
  const requestId = uuidv4()

  try {
    const body = await c.req.json()
    const { url, clipConfig, musicSelection, clipPrompt } = body

    if (!url) {
      return c.json({ success: false, data: null, error: 'URL is required', requestId }, 400)
    }

    const jobId = uuidv4()
    const wsPort = process.env.PORT || '3001'
    const wsUrl = `ws://localhost:${wsPort}/ws/${jobId}`

    // Store initial job state
    jobStore.set(jobId, {
      status: 'queued',
      url,
      clipConfig,
      musicSelection,
      clipPrompt,
      createdAt: new Date().toISOString(),
    })

    // Start processing in background (don't await)
    processJob(jobId, url, clipConfig, musicSelection, clipPrompt).catch(err => {
      console.error(`Job ${jobId} failed:`, err)
    })

    return c.json({
      success: true,
      data: { jobId, wsUrl, estimatedTime: 120 },
      error: null,
      requestId
    }, 202)

  } catch (err: unknown) {
    const error = err as Error
    return c.json({ success: false, data: null, error: error.message, requestId }, 500)
  }
})

// GET /api/video/status/:jobId - Fallback polling
router.get('/status/:jobId', async (c) => {
  const { jobId } = c.req.param()
  const job = jobStore.get(jobId)

  if (!job) {
    return c.json({ success: false, data: null, error: 'Job not found', requestId: uuidv4() }, 404)
  }

  return c.json({ success: true, data: job, error: null, requestId: uuidv4() })
})

export default router
