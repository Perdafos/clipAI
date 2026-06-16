# 📡 API_CONTRACTS.md — Frontend ↔ Backend API Contracts

> **AI Agents:** Any change to this file must be reflected in BOTH frontend types (`types/index.ts`) AND backend routes.

---

## TypeScript Types (Shared)

```typescript
// types/index.ts — THE SINGLE SOURCE OF TRUTH FOR ALL TYPES

// ─── Platform ───────────────────────────────────────────────────
export type Platform = 'youtube' | 'tiktok' | 'instagram'

// ─── Video ──────────────────────────────────────────────────────
export interface VideoMetadata {
  id: string
  title: string
  description: string
  duration: number        // seconds
  thumbnail: string       // URL
  platform: Platform
  uploader: string
  viewCount?: number
  likeCount?: number
  uploadDate?: string
}

export interface VideoJob {
  jobId: string
  url: string
  platform: Platform
  metadata: VideoMetadata
  status: JobStatus
  createdAt: string
  completedAt?: string
  resultUrl?: string
}

export type JobStatus = 
  | 'queued'
  | 'downloading'
  | 'analyzing'
  | 'selecting_music'
  | 'generating'
  | 'finalizing'
  | 'complete'
  | 'error'

// ─── Scenes ─────────────────────────────────────────────────────
export interface Scene {
  id: string
  start: number           // seconds
  end: number             // seconds
  score: number           // 0-1 engagement score
  type: 'highlight' | 'transition' | 'skip'
  reason: string
  mood: string
}

export interface ClipConfig {
  targetDuration: 30 | 60 | 90  // seconds
  selectedScenes?: string[]       // scene IDs, if manually selected
  quality: 'low' | 'medium' | 'high'
  format: 'mp4' | 'webm'
  addCaptions: boolean
}

// ─── Music ──────────────────────────────────────────────────────
export interface MusicTrack {
  id: string
  title: string
  artist: string
  duration: number
  genre: string[]
  mood: string[]
  bpm: number
  previewUrl: string
  license: 'royalty-free'
}

export interface MusicSelection {
  mode: 'ai' | 'manual' | 'upload'
  track?: MusicTrack
  uploadedFileId?: string
  volume: number          // 0-1
  fadeIn: number          // seconds
  fadeOut: number         // seconds
}

// ─── WebSocket ──────────────────────────────────────────────────
export interface WSProgressMessage {
  type: 'progress' | 'complete' | 'error' | 'status'
  jobId: string
  timestamp: number
  payload: {
    stage: JobStatus
    percent: number
    message: string
    data?: unknown
  }
}

export interface WSCompleteData {
  downloadUrl: string
  duration: number
  qualityScore: number
  fileSize: number        // bytes
  thumbnail: string
}

export interface WSErrorData {
  code: string
  message: string
  retryable: boolean
}

// ─── API Responses ──────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  requestId: string
}
```

---

## Endpoint Contracts

### POST `/api/video/analyze`
Fetch video metadata without downloading.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "description": "...",
    "duration": 213,
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "platform": "youtube",
    "uploader": "Rick Astley"
  },
  "error": null,
  "requestId": "req_abc123"
}
```

**Response 400 (Invalid URL):**
```json
{
  "success": false,
  "data": null,
  "error": "URL is not a supported platform (YouTube, TikTok, Instagram)",
  "requestId": "req_abc123"
}
```

**Response 422 (Video too long):**
```json
{
  "success": false,
  "data": null,
  "error": "Video duration (612s) exceeds maximum allowed (600s)",
  "requestId": "req_abc123"
}
```

---

### POST `/api/video/process`
Start full clip generation job.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "clipConfig": {
    "targetDuration": 60,
    "quality": "high",
    "format": "mp4",
    "addCaptions": false
  },
  "musicSelection": {
    "mode": "ai",
    "volume": 0.7,
    "fadeIn": 1.0,
    "fadeOut": 2.0
  }
}
```

**Response 202 (Accepted):**
```json
{
  "success": true,
  "data": {
    "jobId": "job_xyz789",
    "wsUrl": "ws://localhost:3001/ws/job_xyz789",
    "estimatedTime": 120
  },
  "error": null,
  "requestId": "req_def456"
}
```

---

### GET `/api/music/library`
Get paginated music library.

**Query Params:**
- `genre` (optional): filter by genre
- `mood` (optional): filter by mood  
- `page` (default: 1)
- `limit` (default: 20)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "id": "track_001",
        "title": "Neon Pulse",
        "artist": "ClipAI Music",
        "duration": 180,
        "genre": ["electronic", "edm"],
        "mood": ["energetic", "upbeat"],
        "bpm": 128,
        "previewUrl": "https://cdn.clipai.app/music/preview/track_001.mp3",
        "license": "royalty-free"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 20
  },
  "error": null,
  "requestId": "req_ghi789"
}
```

---

### POST `/api/music/recommend`
Get AI music recommendation for video mood.

**Request:**
```json
{
  "videoMood": "energetic",
  "videoGenre": "sports",
  "targetDuration": 60,
  "platform": "instagram"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "recommendedTrack": { /* MusicTrack object */ },
    "confidence": 0.87,
    "reason": "High BPM electronic track matches energetic sports content",
    "alternatives": [ /* Array of MusicTrack */ ]
  },
  "error": null,
  "requestId": "req_jkl012"
}
```

---

### POST `/api/music/upload`
Upload custom audio file.

**Request:** `multipart/form-data`
- `file`: audio file (mp3/wav/aac, max 50MB)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "uploadedFileId": "upload_mno345",
    "duration": 195,
    "filename": "my_track.mp3"
  },
  "error": null,
  "requestId": "req_mno345"
}
```

---

### GET `/api/export/:jobId`
Get final export download URL.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://api.clipai.app/downloads/job_xyz789/final_output.mp4",
    "expiresAt": "2024-12-01T15:30:00Z",
    "fileSize": 24600000,
    "duration": 61,
    "qualityScore": 0.89
  },
  "error": null,
  "requestId": "req_pqr678"
}
```

---

### WebSocket `/ws/:jobId`
Real-time progress updates.

**Server → Client Messages:**
```json
// Progress update
{
  "type": "progress",
  "jobId": "job_xyz789",
  "timestamp": 1701435600000,
  "payload": {
    "stage": "downloading",
    "percent": 35,
    "message": "Downloading video... 35%"
  }
}

// Stage change
{
  "type": "status",
  "jobId": "job_xyz789",
  "timestamp": 1701435610000,
  "payload": {
    "stage": "analyzing",
    "percent": 40,
    "message": "AI is analyzing video scenes..."
  }
}

// Completion
{
  "type": "complete",
  "jobId": "job_xyz789",
  "timestamp": 1701435720000,
  "payload": {
    "stage": "complete",
    "percent": 100,
    "message": "Your clip is ready!",
    "data": {
      "downloadUrl": "/downloads/job_xyz789/final_output.mp4",
      "duration": 61,
      "qualityScore": 0.89,
      "fileSize": 24600000,
      "thumbnail": "/thumbnails/job_xyz789.jpg"
    }
  }
}

// Error
{
  "type": "error",
  "jobId": "job_xyz789",
  "timestamp": 1701435650000,
  "payload": {
    "stage": "error",
    "percent": 0,
    "message": "Failed to download video",
    "data": {
      "code": "DOWNLOAD_FAILED",
      "message": "Video is private or region-locked",
      "retryable": false
    }
  }
}
```

---

## URL Validation Regex

```typescript
// validators.ts — use these EXACT patterns
export const URL_PATTERNS = {
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/,
  tiktok: /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/,
}

export function detectPlatform(url: string): Platform | null {
  if (URL_PATTERNS.youtube.test(url)) return 'youtube'
  if (URL_PATTERNS.tiktok.test(url)) return 'tiktok'
  if (URL_PATTERNS.instagram.test(url)) return 'instagram'
  return null
}
```
