import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { fetchVideoMetadata, hasYtdlp, createJobDir, downloadVideo, extractAudio } from '../services/videoService'
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
    if (!hasYtdlp) {
      return c.json({
        success: false, data: null,
        error: 'Server is not configured for video processing. yt-dlp is missing. Contact admin.',
        requestId
      }, 500)
    }

    const body = await c.req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return c.json({ success: false, data: null, error: 'URL is required', requestId }, 400)
    }

    const platform = detectPlatform(url.trim())
    if (!platform) {
      return c.json({
        success: false, data: null,
        error: 'URL not supported. Use YouTube, TikTok, or Instagram.',
        requestId
      }, 400)
    }

    const metadata = await fetchVideoMetadata(url.trim())

    const MAX_DURATION = parseInt(process.env.MAX_VIDEO_DURATION || '7200')
    if (metadata.duration > MAX_DURATION) {
      return c.json({
        success: false, data: null,
        error: `Video too long (${Math.floor(metadata.duration / 60)}min). Max ${Math.floor(MAX_DURATION / 60)}min.`,
        requestId
      }, 422)
    }

    // Store metadata temporarily — process endpoint will fetch it by URL hash
    const urlHash = simpleHash(url.trim())
    jobStore.set(`meta_${urlHash}`, { metadata, platform, url: url.trim() })
    setTimeout(() => jobStore.delete(`meta_${urlHash}`), 5 * 60 * 1000)

    return c.json({ success: true, data: metadata, error: null, requestId })

  } catch (err: unknown) {
    const error = err as Error
    console.error(`[Video Analyze Error] ${error.message}`)
    return c.json({
      success: false, data: null,
      error: error.message || 'Failed to analyze video',
      requestId
    }, 500)
  }
})

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h).toString(36)
}

// POST /api/video/process - Start full processing job
router.post('/process', async (c) => {
  const requestId = uuidv4()

  try {
    const body = await c.req.json()
    const { url, clipConfig, musicSelection, clipPrompt } = body

    if (!url) {
      return c.json({ success: false, data: null, error: 'URL is required', requestId }, 400)
    }

    if (!hasYtdlp) {
      return c.json({
        success: false, data: null,
        error: 'Server cannot process videos — yt-dlp not installed.',
        requestId
      }, 500)
    }

    const jobId = uuidv4()
    const wsPort = process.env.PORT || '3001'
    const wsUrl = `ws://localhost:${wsPort}/ws/${jobId}`

    // Retrieve metadata stored from analyze step
    const urlHash = simpleHash(url.trim())
    const metaData = jobStore.get(`meta_${urlHash}`) as { metadata: unknown; platform: string; url: string } | undefined
    const metadata = metaData?.metadata || null
    // Clean up cached metadata
    jobStore.delete(`meta_${urlHash}`)

    jobStore.set(jobId, {
      status: 'queued',
      url,
      clipConfig,
      musicSelection,
      clipPrompt,
      metadata, // pass stored metadata so processJob can use it
      createdAt: new Date().toISOString(),
    })

    // Start processing in background
    processJob(jobId, url, clipConfig, musicSelection, clipPrompt).catch(err => {
      console.error(`Job ${jobId} failed:`, err.message)
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
