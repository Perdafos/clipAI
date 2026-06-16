# 🏛️ ARCHITECTURE.md — System Architecture & Data Flow

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/TS)                       │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  URL     │   │   Music      │   │   Processing           │  │
│  │  Input   │   │   Selector   │   │   Dashboard            │  │
│  └────┬─────┘   └──────┬───────┘   └───────────┬────────────┘  │
│       │                │                        │               │
│       └────────────────┼────────────────────────┘               │
│                        │  Zustand Store                         │
│                        ↓                                        │
│              ┌─────────────────┐                                │
│              │   API Client    │◄──── WebSocket (progress)      │
│              └────────┬────────┘                                │
└───────────────────────┼─────────────────────────────────────────┘
                        │ HTTP / WS
┌───────────────────────┼─────────────────────────────────────────┐
│                   BACKEND (Hono)                                 │
│              ┌────────┴────────┐                                │
│              │   Route Layer   │                                │
│              └────────┬────────┘                                │
│         ┌─────────────┼──────────────┐                         │
│         ↓             ↓              ↓                          │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────┐                │
│  │  Video      │ │  Clip    │ │    Music     │                 │
│  │  Service    │ │  Service │ │    Service   │                 │
│  └──────┬──────┘ └────┬─────┘ └──────┬───────┘                │
│         │             │              │                          │
│         ↓             ↓              ↓                          │
│  ┌─────────────────────────────────────────┐                   │
│  │           AI Service (9router)           │                   │
│  │  big-pickle | deepseek | qwen | mimo... │                   │
│  └─────────────────────┬───────────────────┘                   │
│                         │                                        │
│  ┌──────────────────────┴──────────────────┐                   │
│  │      Processing Layer                    │                   │
│  │   yt-dlp ──► FFmpeg ──► Output Files    │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                  │
│  📁 File Storage: /uploads/{jobId}/                             │
│     ├── original.mp4        (downloaded video)                  │
│     ├── audio.wav           (extracted audio for analysis)      │
│     ├── clip_{n}.mp4        (individual clips)                  │
│     ├── music.mp3           (selected music track)              │
│     └── final_output.mp4    (merged result)                     │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ↓
          ┌─────────────────────────┐
          │     9router AI API      │
          │  api.9router.com/v1     │
          └─────────────────────────┘
```

---

## Processing Pipeline (Detailed)

```
User Input (URL)
      │
      ▼
┌─────────────────────────────────────────────────────┐
│ STEP 1: URL Validation                               │
│ • Regex match: YouTube | TikTok | Instagram          │
│ • Extract platform + video ID                        │
│ • Return: { platform, videoId, isValid }             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ STEP 2: Metadata Fetch (yt-dlp --dump-json)          │
│ • Title, duration, thumbnail, description            │
│ • No video download at this stage                    │
│ • Return metadata to frontend immediately            │
│ • WS Event: { stage: 'metadata', percent: 10 }      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼ (User clicks "Generate Clip")
┌─────────────────────────────────────────────────────┐
│ STEP 3: Music Selection (parallel with download)     │
│ IF ai_mode:                                          │
│   • AI (mimo-v2.5-free) analyzes video mood          │
│   • Returns recommended track from music library     │
│ IF manual:                                           │
│   • User browsed & selected track                    │
│ IF upload:                                           │
│   • User uploaded their own audio file               │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ STEP 4: Video Download (yt-dlp)                      │
│ • Stream download with progress                      │
│ • Save to /uploads/{jobId}/original.mp4              │
│ • Extract audio.wav for analysis                     │
│ • WS Events: { stage: 'downloading', percent: 0-40 }│
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ STEP 5: AI Scene Analysis (big-pickle)               │
│ • Input: metadata + transcript (if available)        │
│ • Output: scene list with engagement scores          │
│ • Fallback: deepseek-v4-flash-free if rate limited  │
│ • WS Events: { stage: 'analyzing', percent: 40-60 } │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ STEP 6: Timestamp Generation (qwen3.6-plus-free)     │
│ • Input: scene analysis results                      │
│ • Output: precise FFmpeg timestamps                  │
│ • Target duration: 30s / 60s / 90s (user selected)  │
│ • WS Events: { stage: 'generating', percent: 60-75 }│
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ STEP 7: FFmpeg Processing                            │
│ • Generate command via north-mini-code-free          │
│ • Validate command (security check)                  │
│ • Execute: cut clips + merge + add music             │
│ • Apply: fade in/out, normalize audio                │
│ • Output: /uploads/{jobId}/final_output.mp4          │
│ • WS Events: { stage: 'finalizing', percent: 75-95 }│
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│ STEP 8: Quality Check (nemotron-3-ultra-free)        │
│ • Score the output clip                              │
│ • If score < 0.6: retry with different timestamps    │
│ • If score >= 0.6: finalize                          │
│ • WS Event: { stage: 'complete', percent: 100,       │
│              data: { downloadUrl, score, duration }} │
└─────────────────────────────────────────────────────┘
```

---

## API Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/video/analyze` | Fetch video metadata from URL |
| POST | `/api/video/process` | Start full processing job |
| GET | `/api/video/status/:jobId` | Poll job status (fallback) |
| GET | `/api/music/library` | Get music library list |
| POST | `/api/music/recommend` | AI music recommendation |
| POST | `/api/music/upload` | Upload custom audio |
| POST | `/api/clip/generate` | Generate clip from timestamps |
| GET | `/api/export/:jobId` | Get download URL |
| DELETE | `/api/job/:jobId` | Cleanup job files |
| WS | `/ws/:jobId` | Real-time progress updates |

---

## Security Considerations

1. **Input Validation:** All URLs validated with strict regex before processing
2. **Command Injection:** FFmpeg commands AI-generated + sanitized before exec
3. **File Path:** All file operations confined to `/uploads/{jobId}/`
4. **Rate Limiting:** 5 concurrent jobs per IP, 20 jobs/hour per IP
5. **File Cleanup:** Temp files deleted after 1 hour
6. **API Key:** Only in backend .env, never in responses or logs
7. **CORS:** Only allow configured frontend origin
8. **File Size:** Max 500MB download, max 10min video duration

---

## Music Library Structure

```typescript
interface MusicTrack {
  id: string
  title: string
  artist: string
  duration: number        // seconds
  genre: string[]         // ['electronic', 'upbeat']
  mood: string[]          // ['energetic', 'happy', 'calm']
  bpm: number
  filePath: string        // server-side path
  previewUrl: string      // 30s preview CDN URL
  license: 'royalty-free' // always royalty-free
}
```

Pre-loaded music library: 50 royalty-free tracks across genres:
- Electronic / EDM (10 tracks)
- Hip-hop / Trap (10 tracks)
- Cinematic / Epic (10 tracks)
- Acoustic / Chill (10 tracks)
- Pop / Upbeat (10 tracks)
