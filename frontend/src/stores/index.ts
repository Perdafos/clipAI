import { create } from 'zustand'
import type { VideoMetadata, Platform, ClipConfig, MusicSelection, MusicTrack, JobStatus, WSCompleteData } from '../types'

// ─── Video Store ──────────────────────────────────────────────────
interface VideoState {
  url: string
  platform: Platform | null
  metadata: VideoMetadata | null
  analyzeStatus: 'idle' | 'loading' | 'success' | 'error'
  analyzeError: string | null
  jobId: string | null
  wsUrl: string | null

  setUrl: (url: string) => void
  setPlatform: (platform: Platform | null) => void
  setMetadata: (metadata: VideoMetadata | null) => void
  setAnalyzeStatus: (status: VideoState['analyzeStatus'], error?: string) => void
  setJob: (jobId: string, wsUrl: string) => void
  reset: () => void
}

export const useVideoStore = create<VideoState>((set) => ({
  url: '',
  platform: null,
  metadata: null,
  analyzeStatus: 'idle',
  analyzeError: null,
  jobId: null,
  wsUrl: null,

  setUrl: (url) => set({ url }),
  setPlatform: (platform) => set({ platform }),
  setMetadata: (metadata) => set({ metadata }),
  setAnalyzeStatus: (analyzeStatus, error) => set({ analyzeStatus, analyzeError: error || null }),
  setJob: (jobId, wsUrl) => set({ jobId, wsUrl }),
  reset: () => set({ url: '', platform: null, metadata: null, analyzeStatus: 'idle', analyzeError: null, jobId: null, wsUrl: null }),
}))

// ─── Clip Store ───────────────────────────────────────────────────
interface ClipState {
  config: ClipConfig
  processingStage: JobStatus | null
  progress: number
  statusMessage: string
  resultData: WSCompleteData | null
  processingError: string | null

  setConfig: (config: Partial<ClipConfig>) => void
  setProgress: (stage: JobStatus, percent: number, message: string) => void
  setResult: (data: WSCompleteData) => void
  setError: (error: string) => void
  resetProcessing: () => void
}

export const useClipStore = create<ClipState>((set) => ({
  config: {
    targetDuration: 60,
    quality: 'high',
    format: 'mp4',
    addCaptions: false,
    aspectRatio: '9:16',
  },
  processingStage: null,
  progress: 0,
  statusMessage: '',
  resultData: null,
  processingError: null,

  setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
  setProgress: (processingStage, progress, statusMessage) => set({ processingStage, progress, statusMessage }),
  setResult: (resultData) => set({ resultData, processingStage: 'complete', progress: 100 }),
  setError: (processingError) => set({ processingError, processingStage: 'error' }),
  resetProcessing: () => set({ processingStage: null, progress: 0, statusMessage: '', resultData: null, processingError: null }),
}))

// ─── Music Store ──────────────────────────────────────────────────
interface MusicState {
  mode: 'ai' | 'manual' | 'upload'
  selectedTrack: MusicTrack | null
  aiRecommendation: MusicTrack | null
  aiConfidence: number
  aiReason: string
  aiAlternatives: MusicTrack[]
  uploadedFileId: string | null
  uploadedFilename: string | null
  volume: number
  fadeIn: number
  fadeOut: number
  isLoadingRecommendation: boolean
  recommendError: string | null

  setMode: (mode: MusicState['mode']) => void
  setSelectedTrack: (track: MusicTrack | null) => void
  setAIRecommendation: (track: MusicTrack, confidence: number, reason: string, alternatives: MusicTrack[]) => void
  setUploadedFile: (id: string, filename: string) => void
  setVolume: (v: number) => void
  setFadeIn: (v: number) => void
  setFadeOut: (v: number) => void
  setLoadingRecommendation: (v: boolean) => void
  setRecommendError: (e: string | null) => void
  getMusicSelection: () => MusicSelection
}

export const useMusicStore = create<MusicState>((set, get) => ({
  mode: 'ai',
  selectedTrack: null,
  aiRecommendation: null,
  aiConfidence: 0,
  aiReason: '',
  aiAlternatives: [],
  uploadedFileId: null,
  uploadedFilename: null,
  volume: 0.7,
  fadeIn: 1.0,
  fadeOut: 2.0,
  isLoadingRecommendation: false,
  recommendError: null,

  setMode: (mode) => set({ mode }),
  setSelectedTrack: (track) => set({ selectedTrack: track }),
  setAIRecommendation: (track, confidence, reason, alternatives) =>
    set({ aiRecommendation: track, aiConfidence: confidence, aiReason: reason, aiAlternatives: alternatives, selectedTrack: track }),
  setUploadedFile: (id, filename) => set({ uploadedFileId: id, uploadedFilename: filename }),
  setVolume: (volume) => set({ volume }),
  setFadeIn: (fadeIn) => set({ fadeIn }),
  setFadeOut: (fadeOut) => set({ fadeOut }),
  setLoadingRecommendation: (v) => set({ isLoadingRecommendation: v }),
  setRecommendError: (e) => set({ recommendError: e }),

  getMusicSelection: (): MusicSelection => {
    const s = get()
    return {
      mode: s.mode,
      track: s.selectedTrack || undefined,
      uploadedFileId: s.uploadedFileId || undefined,
      volume: s.volume,
      fadeIn: s.fadeIn,
      fadeOut: s.fadeOut,
    }
  },
}))
