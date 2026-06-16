// ─── Platform ────────────────────────────────────────────────────
export type Platform = 'youtube' | 'tiktok' | 'instagram'

// ─── Video ───────────────────────────────────────────────────────
export interface VideoMetadata {
  id: string
  title: string
  description: string
  duration: number
  thumbnail: string
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

// ─── Scenes ──────────────────────────────────────────────────────
export type ClipType = 'dunk' | 'ankle_breaker' | 'block' | 'steal' | 'three_pointer' | 'highlight' | 'other'

export interface Scene {
  id: string
  start: number
  end: number
  score: number
  type: 'highlight' | 'transition' | 'skip'
  clip_type?: ClipType
  reason: string
  mood: string
}

export interface ClipConfig {
  targetDuration: 30 | 60 | 90
  quality: 'low' | 'medium' | 'high'
  format: 'mp4' | 'webm'
  addCaptions: boolean
  aspectRatio: '9:16' | '1:1' | '16:9'
}

// ─── Music ───────────────────────────────────────────────────────
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
  volume: number
  fadeIn: number
  fadeOut: number
}

// ─── WebSocket ───────────────────────────────────────────────────
export interface WSProgressMessage {
  type: 'progress' | 'complete' | 'error' | 'status'
  jobId: string
  timestamp: number
  payload: {
    stage: JobStatus | 'error'
    percent: number
    message: string
    data?: WSCompleteData | WSErrorData
  }
}

export interface WSCompleteData {
  downloadUrl: string
  videoTitle?: string
  duration: number
  qualityScore: number
  fileSize: number
  thumbnail: string
  overview?: string
  clips?: Array<{
    start: number
    end: number
    clip_type?: string
    reason?: string
    score?: number
    title?: string
  }>
}

export interface WSErrorData {
  code: string
  message: string
  retryable: boolean
}

// ─── API ─────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  requestId: string
}

export interface ProcessJobResponse {
  jobId: string
  wsUrl: string
  estimatedTime: number
}

export interface MusicLibraryResponse {
  tracks: MusicTrack[]
  total: number
  page: number
  limit: number
}

export interface MusicRecommendResponse {
  recommendedTrack: MusicTrack | null
  confidence: number
  reason: string
  alternatives: MusicTrack[]
}

// ─── Timeline Editor ────────────────────────────────────────────
export interface EditedClip {
  id: string
  start: number
  end: number
  title: string
  type: ClipType
  score: number
}

export interface TimelineState {
  clips: EditedClip[]
  selectedClipId: string | null
  cutPoints: number[]
}

// ─── URL Validation ──────────────────────────────────────────────
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

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
