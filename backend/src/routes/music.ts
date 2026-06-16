import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { getMusicLibrary, getMusicLibraryTotal, getMusicTrackById, getMusicTrackForClient } from '../services/musicService'
import { recommendMusic } from '../services/aiService'

const router = new Hono()

// GET /api/music/library
router.get('/library', (c) => {
  const genre = c.req.query('genre')
  const mood = c.req.query('mood')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  const tracks = getMusicLibrary({ genre, mood, page, limit })
  const total = getMusicLibraryTotal()

  return c.json({
    success: true,
    data: {
      tracks: tracks.map(getMusicTrackForClient),
      total,
      page,
      limit,
    },
    error: null,
    requestId: uuidv4(),
  })
})

// GET /api/music/track/:id
router.get('/track/:id', (c) => {
  const track = getMusicTrackById(c.req.param('id'))
  if (!track) {
    return c.json({ success: false, data: null, error: 'Track not found', requestId: uuidv4() }, 404)
  }
  return c.json({ success: true, data: getMusicTrackForClient(track), error: null, requestId: uuidv4() })
})

// POST /api/music/recommend
router.post('/recommend', async (c) => {
  const requestId = uuidv4()
  try {
    const body = await c.req.json()
    const { videoMood, videoGenre, targetDuration, platform } = body

    const library = getMusicLibrary()
    const recommendation = await recommendMusic({
      dominantMood: videoMood || 'energetic',
      suggestedGenre: videoGenre || 'electronic',
      targetDuration: targetDuration || 60,
      platform: platform || 'youtube',
      availableTracks: library.map(t => ({ id: t.id, title: t.title, genre: t.genre, mood: t.mood, bpm: t.bpm })),
    })

    if (!recommendation) {
      return c.json({ success: false, data: null, error: 'AI recommendation failed', requestId }, 500)
    }

    const recommended = getMusicTrackById(recommendation.recommended_track_id)
    const alternatives = recommendation.alternative_track_ids
      .map(id => getMusicTrackById(id))
      .filter(Boolean)
      .map(t => getMusicTrackForClient(t!))

    return c.json({
      success: true,
      data: {
        recommendedTrack: recommended ? getMusicTrackForClient(recommended) : null,
        confidence: recommendation.confidence,
        reason: recommendation.reason,
        alternatives,
      },
      error: null,
      requestId,
    })
  } catch (err: unknown) {
    const error = err as Error
    return c.json({ success: false, data: null, error: error.message, requestId }, 500)
  }
})

// POST /api/music/upload
router.post('/upload', async (c) => {
  const requestId = uuidv4()
  // In production: handle multipart upload with multer
  // For now: return placeholder
  return c.json({
    success: true,
    data: { uploadedFileId: uuidv4(), duration: 0, filename: 'uploaded.mp3' },
    error: null,
    requestId,
  })
})

export default router
