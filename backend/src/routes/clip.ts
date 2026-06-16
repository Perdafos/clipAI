import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { jobStore } from './ws'
import fs from 'fs'

const clipRouter = new Hono()
const exportRouter = new Hono()

// POST /api/clip/generate - Manual clip generation (without full pipeline)
clipRouter.post('/generate', async (c) => {
  const requestId = uuidv4()
  try {
    const body = await c.req.json()
    const { jobId, timestamps } = body

    if (!jobId || !timestamps) {
      return c.json({ success: false, data: null, error: 'jobId and timestamps required', requestId }, 400)
    }

    return c.json({
      success: true,
      data: { jobId, status: 'processing', message: 'Clip generation started' },
      error: null,
      requestId,
    }, 202)
  } catch (err: unknown) {
    const error = err as Error
    return c.json({ success: false, data: null, error: error.message, requestId }, 500)
  }
})

// GET /api/export/:jobId
exportRouter.get('/:jobId', (c) => {
  const requestId = uuidv4()
  const { jobId } = c.req.param()
  const job = jobStore.get(jobId)

  if (!job) {
    return c.json({ success: false, data: null, error: 'Job not found', requestId }, 404)
  }

  if (job.status !== 'complete') {
    return c.json({ success: false, data: null, error: `Job not complete. Current status: ${job.status}`, requestId }, 400)
  }

  const outputPath = `./uploads/${jobId}/final_output.mp4`
  if (!fs.existsSync(outputPath)) {
    return c.json({ success: false, data: null, error: 'Output file not found', requestId }, 404)
  }

  const stat = fs.statSync(outputPath)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  return c.json({
    success: true,
    data: {
      downloadUrl: `/downloads/${jobId}/final_output.mp4`,
      expiresAt,
      fileSize: stat.size,
      duration: (job.resultData as { duration?: number })?.duration || 0,
      qualityScore: (job.resultData as { qualityScore?: number })?.qualityScore || 0,
    },
    error: null,
    requestId,
  })
})

// DELETE /api/job/:jobId - Manual cleanup (files + store)
exportRouter.delete('/job/:jobId', (c) => {
  const { jobId } = c.req.param()
  const jobDir = `./uploads/${jobId}`
  if (fs.existsSync(jobDir)) {
    fs.rmSync(jobDir, { recursive: true, force: true })
  }
  jobStore.delete(jobId)
  return c.json({ success: true, data: { deleted: true }, error: null, requestId: uuidv4() })
})

export { clipRouter as default }
export { exportRouter }
