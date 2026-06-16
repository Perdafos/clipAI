import { create } from 'zustand'
import type { VideoMetadata, Platform, ClipConfig, MusicSelection, MusicTrack, JobStatus, WSCompleteData, EditedClip, ClipType } from '../types'

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

  // Timeline editor
  timelineClips: EditedClip[]
  selectedClipId: string | null
  cutPoints: number[]
  history: EditedClip[][]
  historyIndex: number

  setConfig: (config: Partial<ClipConfig>) => void
  setProgress: (stage: JobStatus, percent: number, message: string) => void
  setResult: (data: WSCompleteData) => void
  setError: (error: string) => void
  resetProcessing: () => void

  // Timeline actions
  initTimeline: (clips: EditedClip[]) => void
  selectClip: (id: string | null) => void
  splitClip: (time: number) => void
  deleteClip: (id: string) => void
  trimClip: (id: string, start: number, end: number) => void
  moveClip: (id: string, newStart: number) => void
  undo: () => void
  redo: () => void
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

  timelineClips: [],
  selectedClipId: null,
  cutPoints: [],
  history: [],
  historyIndex: -1,

  setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
  setProgress: (processingStage, progress, statusMessage) => set({ processingStage, progress, statusMessage }),
  setResult: (resultData) => set({ resultData, processingStage: 'complete', progress: 100 }),
  setError: (processingError) => set({ processingError, processingStage: 'error' }),
  resetProcessing: () => set({ processingStage: null, progress: 0, statusMessage: '', resultData: null, processingError: null }),

  // Timeline
  initTimeline: (clips) => set({ timelineClips: clips, selectedClipId: null, cutPoints: [], history: [clips], historyIndex: 0 }),

  selectClip: (id) => set({ selectedClipId: id }),

  splitClip: (time) => set((s) => {
    const target = s.timelineClips.find(c => c.start < time && c.end > time)
    if (!target) return s
    const newId = `${target.id}-split-${Date.now()}`
    const a: EditedClip = { ...target, end: time }
    const b: EditedClip = { ...target, id: newId, start: time }
    const sorted = [...s.timelineClips].sort((a, b) => a.start - b.start)
    const idx = sorted.findIndex(c => c.id === target.id)
    sorted.splice(idx, 1, a, b)
    const newHistory = s.history.slice(0, s.historyIndex + 1)
    newHistory.push(sorted)
    return { timelineClips: sorted, cutPoints: [...s.cutPoints, time], history: newHistory, historyIndex: s.historyIndex + 1, selectedClipId: null }
  }),

  deleteClip: (id) => set((s) => {
    const filtered = s.timelineClips.filter(c => c.id !== id)
    const newHistory = s.history.slice(0, s.historyIndex + 1)
    newHistory.push(filtered)
    return { timelineClips: filtered, selectedClipId: null, history: newHistory, historyIndex: s.historyIndex + 1 }
  }),

  trimClip: (id, start, end) => set((s) => {
    const updated = s.timelineClips.map(c => c.id === id ? { ...c, start, end } : c)
    const newHistory = s.history.slice(0, s.historyIndex + 1)
    newHistory.push(updated)
    return { timelineClips: updated, history: newHistory, historyIndex: s.historyIndex + 1 }
  }),

  moveClip: (id, newStart) => set((s) => {
    const clip = s.timelineClips.find(c => c.id === id)
    if (!clip) return s
    const dur = clip.end - clip.start
    const updated = s.timelineClips.map(c => c.id === id ? { ...c, start: newStart, end: newStart + dur } : c)
    const newHistory = s.history.slice(0, s.historyIndex + 1)
    newHistory.push(updated)
    return { timelineClips: updated, history: newHistory, historyIndex: s.historyIndex + 1 }
  }),

  undo: () => set((s) => {
    if (s.historyIndex <= 0) return s
    const newIdx = s.historyIndex - 1
    return { timelineClips: s.history[newIdx], historyIndex: newIdx }
  }),

  redo: () => set((s) => {
    if (s.historyIndex >= s.history.length - 1) return s
    const newIdx = s.historyIndex + 1
    return { timelineClips: s.history[newIdx], historyIndex: newIdx }
  }),
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
