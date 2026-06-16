# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
cd frontend && npm run dev      # Vite dev server (port 5173)
cd backend && npm run dev        # Hono backend (port 3001, nodemon + tsx)
cd frontend && npm run build     # tsc + vite build
cd frontend && npm run preview   # preview production build
cd backend && npm run build      # tsc compile
cd backend && npm run start      # run compiled dist/index.js

# Docker
docker-compose up                # full stack
```

## Architecture

**ClipAI** — web app that turns YouTube/TikTok/Instagram links into AI-powered highlight clips.

```
Frontend (React 18 + Vite + Tailwind)
  ├── pages/     Home.tsx, Studio.tsx
  ├── components/video/  URLInputPanel, VideoPreviewPanel, ClipConfigPanel, ClipPromptPanel, VideoEditorPanel, TimelineEditor, EditToolbar
  ├── components/music/  MusicPanel (AI pick / manual library / upload)
  ├── components/processing/ ProcessingPanel (stage progress + WS)
  ├── components/export/ ExportPanel
  ├── stores/    Zustand: videoStore, clipStore, musicStore
  ├── hooks/     useWebSocket (auto-reconnect, exponential backoff)
  ├── lib/       api.ts (axios client — /api/video/*, /api/music/*)
  └── types/     index.ts (all TS types, URL validation regex, format utils)

Backend (Hono + Node.js)
  ├── src/index.ts           entry — Hono app, CORS, WS upgrade
  ├── routes/                video.ts, clip.ts, music.ts, export.ts, ws.ts
  ├── services/              aiService.ts (9router API), videoService.ts (yt-dlp), musicService.ts, summarizeService.ts
  └── types/                 ffprobe-static.d.ts

Processing pipeline:
  URL → validate → yt-dlp metadata → yt-dlp download → AI scene analysis (big-pickle)
  → AI timestamps (qwen3.6-plus-free) → FFmpeg clip generation → music merge
  → quality score (nemotron-3-ultra-free) → WS progress stream → download
```

## Design System

Current dark theme (per AI_WORKFLOW.md tokens). All CSS variables in `index.css`. Tailwind config with custom `brand-*` colors. Components use inline hex/opacity values directly rather than CSS vars. Lucide icons throughout. shadcn/ui Radix primitives in package.json but no actual shadcn components used yet.

## Key Rules

- **All AI calls** go through `services/aiService.ts` — no direct 9router fetch from routes
- **API key** (`sk-3db4b611...`) in backend only, never in frontend
- **WebSocket** for all operations >3s (`/ws/:jobId`)
- **FFmpeg commands** AI-generated via `north-mini-code-free` model + sanitized before exec
- **State** via Zustand stores, not React context
- **Components** must handle loading + error states, be mobile responsive
- **No modification** to `src/components/ui/` (shadcn auto-generated — but dir doesn't exist yet)
- **Types** in `types/index.ts` — single source of truth, shared across frontend

## AI Models (9router)

| Model | Use |
|-------|-----|
| `big-pickle` | Scene analysis (primary) |
| `deepseek-v4-flash-free` | Fast metadata, fallback |
| `mimo-v2.5-free` | Music-video mood matching |
| `qwen3.6-plus-free` | Clip timestamp generation |
| `minimax-m3-free` | Caption/subtitle |
| `nemotron-3-ultra-free` | Quality scoring |
| `north-mini-code-free` | FFmpeg command gen |

Fallback chain: primary → `deepseek-v4-flash-free` → `mimo-auto`

## URL Patterns

YouTube: `/^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/`
TikTok: `/^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/`
Instagram: `/^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/`

## File Storage

`/uploads/{jobId}/` — original.mp4, audio.wav, clip_{n}.mp4, music.mp3, final_output.mp4. Temp files cleaned on server start.
