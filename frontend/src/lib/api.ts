import axios from 'axios'
import type {
  ApiResponse, VideoMetadata, ProcessJobResponse,
  MusicLibraryResponse, MusicRecommendResponse, ClipConfig, MusicSelection
} from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.error || err.message || 'Network error'
    return Promise.reject(new Error(message))
  }
)

// ─── Video API ───────────────────────────────────────────────────
export async function analyzeVideoUrl(url: string): Promise<VideoMetadata> {
  const { data } = await api.post<ApiResponse<VideoMetadata>>('/api/video/analyze', { url })
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to analyze video')
  return data.data
}

export async function startVideoProcess(
  url: string,
  clipConfig: ClipConfig,
  musicSelection: MusicSelection,
  clipPrompt?: string
): Promise<ProcessJobResponse> {
  const { data } = await api.post<ApiResponse<ProcessJobResponse>>('/api/video/process', {
    url, clipConfig, musicSelection, clipPrompt
  })
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to start processing')
  return data.data
}

// ─── Music API ───────────────────────────────────────────────────
export async function fetchMusicLibrary(filters?: {
  genre?: string; mood?: string; page?: number; limit?: number
}): Promise<MusicLibraryResponse> {
  const params = new URLSearchParams()
  if (filters?.genre) params.set('genre', filters.genre)
  if (filters?.mood) params.set('mood', filters.mood)
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.limit) params.set('limit', String(filters.limit))

  const { data } = await api.get<ApiResponse<MusicLibraryResponse>>(
    `/api/music/library?${params.toString()}`
  )
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to fetch music')
  return data.data
}

export async function getAIMusicRecommendation(params: {
  videoMood: string; videoGenre: string; targetDuration: number; platform: string
}): Promise<MusicRecommendResponse> {
  const { data } = await api.post<ApiResponse<MusicRecommendResponse>>('/api/music/recommend', params)
  if (!data.success || !data.data) throw new Error(data.error || 'Failed to get AI recommendation')
  return data.data
}

export async function uploadMusicFile(file: File): Promise<{ uploadedFileId: string; duration: number; filename: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<ApiResponse<{ uploadedFileId: string; duration: number; filename: string }>>(
    '/api/music/upload', formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  if (!data.success || !data.data) throw new Error(data.error || 'Upload failed')
  return data.data
}

export default api
