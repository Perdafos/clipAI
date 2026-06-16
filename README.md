# 🎬 ClipAI — AI-Powered Video Clip Generator

> **For AI Agents:** This README is your single source of truth. Read it fully before making any changes. Never deviate from the architecture defined here without updating this document first.

---

## 📌 Project Overview

**ClipAI** adalah aplikasi web yang memungkinkan user untuk:
1. Memasukkan link YouTube / TikTok / Instagram
2. AI menganalisis video dan membuat highlight clip otomatis
3. User bisa memilih atau membiarkan AI memilihkan lagu untuk clip
4. Download hasil clip video

**Stack:**
- **Frontend:** React + TypeScript + Vite
- **Backend:** Hono Framework (Node.js)
- **Styling:** TailwindCSS + shadcn/ui + Lucide Icons
- **AI Provider:** 9router API (`https://api.9router.com/v1`)
- **Video Processing:** yt-dlp + FFmpeg (backend)

---

## 🗺️ Directory Structure

```
clipai/
├── README.md                    ← YOU ARE HERE (read first, always)
├── AI_WORKFLOW.md               ← Step-by-step AI development workflow
├── ARCHITECTURE.md              ← System architecture & data flow
├── API_CONTRACTS.md             ← All API contracts (frontend ↔ backend)
│
├── frontend/                    ← React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              ← shadcn/ui components (DO NOT MODIFY)
│   │   │   ├── layout/          ← AppShell, Header, Sidebar
│   │   │   ├── video/           ← VideoInput, VideoPreview, ClipTimeline
│   │   │   ├── music/           ← MusicSelector, MusicPlayer, AIPickButton
│   │   │   ├── processing/      ← ProcessingQueue, ProgressBar, StatusCard
│   │   │   └── export/          ← ExportPanel, DownloadButton
│   │   ├── hooks/
│   │   │   ├── useVideoProcess.ts
│   │   │   ├── useMusicSelect.ts
│   │   │   ├── useClipGenerate.ts
│   │   │   └── useWebSocket.ts
│   │   ├── stores/
│   │   │   ├── videoStore.ts    ← Zustand: video state
│   │   │   ├── clipStore.ts     ← Zustand: clip segments state
│   │   │   └── musicStore.ts    ← Zustand: music selection state
│   │   ├── lib/
│   │   │   ├── api.ts           ← Axios API client
│   │   │   ├── utils.ts         ← Shared utilities
│   │   │   └── validators.ts    ← URL validation (YT/TikTok/IG)
│   │   ├── types/
│   │   │   └── index.ts         ← All TypeScript types/interfaces
│   │   └── pages/
│   │       ├── Home.tsx
│   │       ├── Studio.tsx       ← Main editing studio
│   │       └── History.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     ← Hono Framework
│   ├── src/
│   │   ├── index.ts             ← Hono app entry point
│   │   ├── routes/
│   │   │   ├── video.ts         ← POST /api/video/analyze
│   │   │   ├── clip.ts          ← POST /api/clip/generate
│   │   │   ├── music.ts         ← GET/POST /api/music/*
│   │   │   ├── export.ts        ← POST /api/export
│   │   │   └── ws.ts            ← WebSocket /ws/progress
│   │   ├── services/
│   │   │   ├── aiService.ts     ← 9router AI integration
│   │   │   ├── videoService.ts  ← yt-dlp download & FFmpeg process
│   │   │   ├── clipService.ts   ← Clip generation logic
│   │   │   └── musicService.ts  ← Music library & AI selection
│   │   ├── middleware/
│   │   │   ├── cors.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── validation.ts
│   │   └── utils/
│   │       ├── ffmpeg.ts        ← FFmpeg wrapper
│   │       └── ytdlp.ts         ← yt-dlp wrapper
│   └── package.json
│
└── docker-compose.yml           ← Local dev environment
```

---

## 🤖 AI Models (9router)

| Model ID | Use Case | Priority |
|----------|----------|----------|
| `big-pickle` | Video scene analysis, complex reasoning | Primary |
| `deepseek-v4-flash-free` | Fast metadata extraction | Secondary |
| `mimo-v2.5-free` | Music-video mood matching | Music AI |
| `qwen3.6-plus-free` | Clip timestamp generation | Clip AI |
| `minimax-m3-free` | Caption & subtitle generation | Caption |
| `nemotron-3-ultra-free` | Quality scoring of clips | QA |
| `north-mini-code-free` | FFmpeg command generation | Code Gen |
| `mimo-auto` | Auto-select best model per task | Fallback |

**API Base URL:** `https://api.9router.com/v1`  
**API Key:** `sk-3db4b611cc2dd3e3-5mdz5k-bc03f41f`  
**⚠️ NEVER hardcode API key in frontend. Backend only.**

---

## 🎯 Core User Journey

```
[User] → Paste URL → [Backend: Download Video] → [AI: Analyze Scenes]
     → [User: Choose/AI-pick Music] → [AI: Generate Clip Timestamps]
     → [Backend: FFmpeg Merge] → [User: Preview & Download]
```

---

## ✅ Feature Checklist

### Phase 1 — Foundation
- [ ] Project scaffolding (frontend + backend)
- [ ] URL validation (YouTube/TikTok/Instagram)
- [ ] Backend: yt-dlp video download
- [ ] Backend: 9router AI service wrapper
- [ ] WebSocket progress updates

### Phase 2 — AI Processing
- [ ] AI video scene analysis (`big-pickle`)
- [ ] AI clip timestamp generation (`qwen3.6-plus-free`)
- [ ] AI quality scoring (`nemotron-3-ultra-free`)
- [ ] FFmpeg clip generation (`north-mini-code-free` for commands)

### Phase 3 — Music
- [ ] Music library (royalty-free tracks)
- [ ] Manual music upload
- [ ] AI music recommendation (`mimo-v2.5-free`)
- [ ] Audio mixing with clip

### Phase 4 — Polish
- [ ] History page
- [ ] Export options (quality, format)
- [ ] Mobile responsive
- [ ] Error handling & retry logic

---

## 🚨 Rules for AI Agents

1. **Read this README first** before any file modification
2. **Check API_CONTRACTS.md** before changing any API endpoint
3. **Never modify** `src/components/ui/` (shadcn auto-generated)
4. **Always update types** in `types/index.ts` when adding new data shapes
5. **Backend API key** must NEVER appear in frontend code
6. **WebSocket** must be used for all long-running operations (>3 seconds)
7. **Error boundaries** must wrap all async components
8. **All AI calls** go through `services/aiService.ts` — no direct fetch to 9router from routes
9. **FFmpeg operations** are async and must report progress via WebSocket
10. **Test locally** with `docker-compose up` before marking task complete
