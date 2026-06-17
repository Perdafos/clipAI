import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import videoRoutes from './routes/video'
import clipRoutes from './routes/clip'
import musicRoutes from './routes/music'
import exportRoutes from './routes/export'
import { wsHandler } from './routes/ws'
import fs from 'fs'

// Ensure required directories exist
const dirs = ['./uploads', './public/music']
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

// Cleanup stale job dirs on startup (keep sample_template.mp4)
console.log('[ClipAI] Cleaning stale uploads from previous sessions...')
let cleanedCount = 0
if (fs.existsSync('./uploads')) {
  const entries = fs.readdirSync('./uploads', { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const jobDir = path.join('./uploads', entry.name)
      fs.rmSync(jobDir, { recursive: true, force: true })
      cleanedCount++
    }
  }
}
if (cleanedCount > 0) {
  console.log(`[ClipAI] Cleaned ${cleanedCount} stale job upload(s)`)
}

const app = new Hono()

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim())

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return allowedOrigins[0]  // server-to-server requests
    if (allowedOrigins.includes(origin)) return origin
    return allowedOrigins[0]
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Routes
app.route('/api/video', videoRoutes)
app.route('/api/clip', clipRoutes)
app.route('/api/music', musicRoutes)
app.route('/api/export', exportRoutes)

// Health check
app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.0.0'
}))

// Static files (downloads) — stream instead of readFileSync
app.get('/downloads/:jobId/:filename', async (c) => {
  const { jobId, filename } = c.req.param()
  const filePath = `./uploads/${jobId}/${filename}`
  if (!fs.existsSync(filePath)) {
    return c.json({ error: 'File not found' }, 404)
  }
  const stat = fs.statSync(filePath)
  const fileStream = fs.createReadStream(filePath)

  // Check for Range header (seek support for video players)
  const range = c.req.header('range')
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
    const stream = fs.createReadStream(filePath, { start, end })
    return new Response(stream as any, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  return new Response(fileStream as any, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

const PORT = parseInt(process.env.PORT || '3001')

// Start server with Hono node-server adapter to correctly handle requests & bodies
const server = serve({
  fetch: app.fetch,
  port: PORT,
}, () => {
  console.log(`🚀 ClipAI Backend running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server on ws://localhost:${PORT}/ws`)
})

// WebSocket Server
const wss = new WebSocketServer({ noServer: true })
wss.on('connection', wsHandler)

// Handle upgrade manually to support dynamic /ws/:jobId path
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : ''
  if (pathname.startsWith('/ws/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  } else {
    socket.destroy()
  }
})
