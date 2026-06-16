# 🔄 AI_WORKFLOW.md — Development Workflow for AI Agents

> **This document defines the exact order of operations.** AI agents must follow this workflow sequentially. Do not skip steps or reorder them.

---

## 🏗️ PHASE 1: Project Setup

### Step 1.1 — Backend Scaffolding
```bash
cd backend
npm init -y
npm install hono @hono/node-server
npm install ws axios dotenv
npm install -D typescript @types/node @types/ws tsx nodemon
```

**Create `backend/src/index.ts`:**
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import videoRoutes from './routes/video'
import clipRoutes from './routes/clip'
import musicRoutes from './routes/music'
import exportRoutes from './routes/export'

const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5173' }))

app.route('/api/video', videoRoutes)
app.route('/api/clip', clipRoutes)
app.route('/api/music', musicRoutes)
app.route('/api/export', exportRoutes)

app.get('/health', (c) => c.json({ status: 'ok' }))

serve({ fetch: app.fetch, port: 3001 })
console.log('Backend running on http://localhost:3001')
```

### Step 1.2 — Frontend Scaffolding
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install axios zustand react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init
npx shadcn@latest add button card input progress badge select toast
```

### Step 1.3 — Environment Files
```bash
# backend/.env
PORT=3001
NINEROUTER_API_KEY=sk-3db4b611cc2dd3e3-5mdz5k-bc03f41f
NINEROUTER_BASE_URL=https://api.9router.com/v1
UPLOAD_DIR=./uploads
TEMP_DIR=./temp
MAX_VIDEO_DURATION=600  # 10 minutes max

# frontend/.env
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## 🧠 PHASE 2: AI Service Layer

### Step 2.1 — Build AI Service (`backend/src/services/aiService.ts`)

This is the **most critical file**. All 9router API calls go here.

```typescript
// Pattern for every AI call:
interface AIServiceCall {
  model: NineRouterModel
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}

// Response always validated before returning
interface AIServiceResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  model: string
  tokensUsed: number
}
```

**Model Selection Logic:**
```typescript
// Use this decision tree for model selection:
function selectModel(task: AITask): NineRouterModel {
  switch(task) {
    case 'scene_analysis':     return 'big-pickle'
    case 'clip_timestamps':    return 'qwen3.6-plus-free'
    case 'music_recommend':    return 'mimo-v2.5-free'
    case 'quality_score':      return 'nemotron-3-ultra-free'
    case 'ffmpeg_command':     return 'north-mini-code-free'
    case 'caption_gen':        return 'minimax-m3-free'
    case 'fast_extract':       return 'deepseek-v4-flash-free'
    default:                   return 'mimo-auto'
  }
}
```

### Step 2.2 — Video Analysis Prompt Template

```typescript
// Use this exact prompt structure for scene analysis:
const SCENE_ANALYSIS_PROMPT = `
You are a professional video editor AI. Analyze the provided video metadata and transcript.

Video Info:
- Title: {title}
- Duration: {duration} seconds
- Platform: {platform}

Your task: Identify the most engaging moments for a highlight clip.

Return ONLY valid JSON:
{
  "scenes": [
    {
      "start": 0,          // seconds
      "end": 30,           // seconds  
      "score": 0.95,       // engagement score 0-1
      "type": "highlight", // "highlight" | "transition" | "skip"
      "reason": "Peak action moment with high audio energy",
      "mood": "energetic"  // for music matching
    }
  ],
  "recommended_duration": 60,
  "dominant_mood": "energetic",
  "suggested_music_genre": "electronic"
}
`;
```

### Step 2.3 — Music Selection Prompt

```typescript
const MUSIC_SELECTION_PROMPT = `
You are a music supervisor for video content. 

Video mood profile:
- Dominant mood: {dominant_mood}
- Video genre: {video_genre}
- Target duration: {duration} seconds
- Platform target: {platform}

Available music tracks: {tracks_json}

Select the best matching track. Return ONLY valid JSON:
{
  "selected_track_id": "track_123",
  "confidence": 0.87,
  "reason": "Electronic BPM matches video pace",
  "alternative_track_id": "track_456",
  "sync_points": [
    { "video_time": 0, "music_time": 12, "type": "start" },
    { "video_time": 60, "music_time": 72, "type": "end" }
  ]
}
`;
```

---

## 🎬 PHASE 3: Video Processing Pipeline

### Step 3.1 — Video Download Flow

```
POST /api/video/analyze
  ↓
1. Validate URL (regex: YouTube/TikTok/Instagram)
2. Extract video ID
3. yt-dlp: get metadata only (no download yet)
4. Return metadata to frontend
5. Frontend shows preview info
6. User clicks "Process" → triggers full download
```

### Step 3.2 — yt-dlp Commands

```typescript
// Metadata only (fast, no download)
const getMetadata = (url: string) => 
  `yt-dlp --dump-json --no-download "${url}"`

// Download with best quality cap
const downloadVideo = (url: string, outputPath: string) =>
  `yt-dlp -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" ` +
  `--merge-output-format mp4 -o "${outputPath}" "${url}"`

// Download audio only (for analysis)
const downloadAudio = (url: string, outputPath: string) =>
  `yt-dlp -f bestaudio --extract-audio --audio-format wav -o "${outputPath}" "${url}"`
```

### Step 3.3 — FFmpeg Clip Generation

```typescript
// AI generates this command via north-mini-code-free model
// Always validate the command before executing!

const FFMPEG_PROMPT = `
Generate an FFmpeg command to:
- Extract clip from {input_file} 
- Start: {start_time}s, End: {end_time}s
- Add audio track: {music_file}
- Fade in: 0.5s, Fade out: 0.5s
- Output: {output_file}
- Format: MP4 H.264

Return ONLY the ffmpeg command, nothing else.
`;

// Safety: validate AI-generated command before exec
function validateFFmpegCommand(cmd: string): boolean {
  const forbidden = ['rm ', 'sudo', '>', '|', ';', '&&']
  return !forbidden.some(f => cmd.includes(f))
}
```

---

## 📡 PHASE 4: Real-time Progress (WebSocket)

### Step 4.1 — WebSocket Message Protocol

```typescript
// All WebSocket messages follow this schema:
interface WSMessage {
  type: 'progress' | 'complete' | 'error' | 'status'
  jobId: string
  timestamp: number
  payload: {
    stage: ProcessingStage
    percent: number        // 0-100
    message: string
    data?: unknown         // stage-specific data
  }
}

type ProcessingStage = 
  | 'downloading'      // yt-dlp downloading
  | 'analyzing'        // AI scene analysis
  | 'selecting_music'  // AI or user music
  | 'generating'       // FFmpeg clip creation
  | 'finalizing'       // Merging & encoding
  | 'complete'         // Done, send download URL
  | 'error'            // Something went wrong
```

### Step 4.2 — Frontend WebSocket Hook

```typescript
// hooks/useWebSocket.ts
// Connect on component mount
// Auto-reconnect with exponential backoff (max 5 retries)
// Parse messages and update Zustand store
// Cleanup on unmount
```

---

## 🎨 PHASE 5: UI Implementation

### Step 5.1 — Page Structure

```
/ (Home)
├── HeroSection        — URL input, platform logos
├── FeaturesSection    — 3 AI model highlights  
└── RecentClips        — User's recent clips (if logged in)

/studio (Main App)
├── Header             — Logo, model selector, history link
├── URLInputPanel      — URL paste, validate, fetch metadata
├── VideoPreviewPanel  — Thumbnail, title, duration
├── MusicPanel         — AI pick / manual select / upload
├── ProcessingPanel    — Progress stages with WebSocket
└── ExportPanel        — Preview, quality, download

/history
└── ClipGrid           — Past clips with thumbnails
```

### Step 5.2 — Component Rules

```typescript
// Every component MUST:
// 1. Have TypeScript props interface
// 2. Handle loading state
// 3. Handle error state  
// 4. Be mobile responsive (Tailwind responsive prefixes)

// Example structure:
interface ComponentProps {
  // ... props
}

export function Component({ ...props }: ComponentProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} />
  
  return (
    // ... JSX
  )
}
```

### Step 5.3 — Design System Tokens

```css
/* These are the ONLY colors used in the app */
:root {
  --brand-primary: #7C3AED;    /* Violet 600 */
  --brand-accent: #06B6D4;     /* Cyan 500 */
  --brand-dark: #0F0F1A;       /* Near black */
  --brand-surface: #1A1A2E;    /* Dark surface */
  --brand-border: #2D2D44;     /* Subtle border */
  --brand-text: #E2E8F0;       /* Light text */
  --brand-muted: #94A3B8;      /* Muted text */
  --brand-success: #10B981;    /* Emerald */
  --brand-warning: #F59E0B;    /* Amber */
  --brand-error: #EF4444;      /* Red */
}
```

---

## 🔁 PHASE 6: State Management

### Step 6.1 — Zustand Stores

```typescript
// stores/videoStore.ts
interface VideoStore {
  url: string
  platform: 'youtube' | 'tiktok' | 'instagram' | null
  metadata: VideoMetadata | null
  downloadStatus: 'idle' | 'pending' | 'downloading' | 'ready' | 'error'
  jobId: string | null
  
  // Actions
  setUrl: (url: string) => void
  startProcessing: () => Promise<void>
  reset: () => void
}

// stores/clipStore.ts
interface ClipStore {
  scenes: Scene[]
  selectedScenes: string[]     // scene IDs
  clipTimestamps: Timestamp[]
  processingStage: ProcessingStage
  progress: number             // 0-100
  resultUrl: string | null
  
  // Actions
  setScenes: (scenes: Scene[]) => void
  toggleScene: (id: string) => void
  setProgress: (stage: ProcessingStage, percent: number) => void
}

// stores/musicStore.ts
interface MusicStore {
  mode: 'ai' | 'manual' | 'upload'
  selectedTrack: MusicTrack | null
  aiRecommendation: MusicTrack | null
  uploadedFile: File | null
  
  // Actions
  setMode: (mode: MusicStore['mode']) => void
  selectTrack: (track: MusicTrack) => void
  requestAIPick: () => Promise<void>
}
```

---

## 📋 PHASE 7: Error Handling

### Step 7.1 — Error Categories

```typescript
type AppError = 
  | { code: 'INVALID_URL'; message: string }
  | { code: 'VIDEO_TOO_LONG'; maxDuration: number }
  | { code: 'DOWNLOAD_FAILED'; reason: string }
  | { code: 'AI_ERROR'; model: string; reason: string }
  | { code: 'FFMPEG_ERROR'; command: string; reason: string }
  | { code: 'NETWORK_ERROR'; endpoint: string }
  | { code: 'RATE_LIMITED'; retryAfter: number }
```

### Step 7.2 — Retry Strategy

```typescript
// All AI calls should retry with fallback models:
async function callWithFallback(task: AITask, prompt: string) {
  const models = getModelFallbackChain(task)
  
  for (const model of models) {
    try {
      return await callAI(model, prompt)
    } catch (err) {
      if (isRateLimitError(err)) continue
      throw err  // Don't retry non-rate-limit errors
    }
  }
  throw new Error('All models failed')
}

// Fallback chains:
const FALLBACK_CHAINS = {
  scene_analysis: ['big-pickle', 'deepseek-v4-flash-free', 'mimo-auto'],
  clip_timestamps: ['qwen3.6-plus-free', 'deepseek-v4-flash-free', 'mimo-auto'],
  music_recommend: ['mimo-v2.5-free', 'mimo-auto'],
}
```

---

## 🧪 PHASE 8: Testing Checklist

Before marking any phase complete, verify:

- [ ] URL validation works for all 3 platforms
- [ ] Backend returns correct HTTP status codes
- [ ] WebSocket connection establishes and sends progress
- [ ] AI returns valid JSON (not markdown-wrapped JSON)
- [ ] FFmpeg commands are sanitized before execution
- [ ] Music is correctly synced to clip duration
- [ ] Download link works and file is valid MP4
- [ ] Error states show user-friendly messages
- [ ] Mobile view is usable (test at 375px width)
- [ ] No API key visible in frontend bundle (`npm run build && grep -r "sk-" dist/`)

---

## 🚀 Deployment Checklist

- [ ] Set production environment variables
- [ ] Enable HTTPS (backend must have SSL for WebSocket WSS)
- [ ] Set CORS to production frontend domain only
- [ ] Add rate limiting (max 5 concurrent jobs per IP)
- [ ] Set up cleanup cron (delete temp files >1 hour old)
- [ ] Add request logging
- [ ] Monitor 9router API quota usage
