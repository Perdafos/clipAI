import { useState, useEffect } from 'react'
import { Music, Sparkles, Upload, List, Play, Check, Volume2, Loader2, Zap } from 'lucide-react'
import { useMusicStore } from '../../stores'
import { fetchMusicLibrary, getAIMusicRecommendation, uploadMusicFile } from '../../lib/api'
import type { MusicTrack, VideoMetadata } from '../../types'
import { formatDuration } from '../../types'

interface MusicPanelProps {
  videoMetadata: VideoMetadata
  onStartProcessing: () => void
  isStarting: boolean
}

type MusicMode = 'ai' | 'manual' | 'upload'

const MODE_TABS: { key: MusicMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'ai', label: 'AI Pick', icon: Sparkles },
  { key: 'manual', label: 'Library', icon: List },
  { key: 'upload', label: 'Upload', icon: Upload },
]

export function MusicPanel({ videoMetadata, onStartProcessing, isStarting }: MusicPanelProps) {
  const musicStore = useMusicStore()
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  useEffect(() => {
    if (musicStore.mode === 'manual') loadLibrary()
    if (musicStore.mode === 'ai' && !musicStore.aiRecommendation) requestAIRecommendation()
  }, [musicStore.mode])

  const loadLibrary = async () => {
    setLoadingLibrary(true)
    try {
      const data = await fetchMusicLibrary({ limit: 20 })
      setTracks(data.tracks)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const requestAIRecommendation = async () => {
    musicStore.setLoadingRecommendation(true)
    musicStore.setRecommendError(null)
    try {
      const result = await getAIMusicRecommendation({
        videoMood: 'energetic',
        videoGenre: videoMetadata.platform,
        targetDuration: 60,
        platform: videoMetadata.platform,
      })
      if (result.recommendedTrack) {
        musicStore.setAIRecommendation(result.recommendedTrack, result.confidence, result.reason, result.alternatives)
      }
    } catch (err: unknown) {
      musicStore.setRecommendError((err as Error).message)
    } finally {
      musicStore.setLoadingRecommendation(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await uploadMusicFile(file)
      musicStore.setUploadedFile(result.uploadedFileId, result.filename)
    } catch { /* error handled silently */ }
  }

  return (
    <div className="apple-card p-5 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Music className="w-4 h-4 text-[#5856D6]" />
        <h2 className="font-semibold text-sm text-[#1D1D1F]">Background Music</h2>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#F5F5F7] border border-black/[0.04]">
        {MODE_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => musicStore.setMode(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              musicStore.mode === key
                ? 'bg-white text-[#1D1D1F] shadow-sm'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* AI Mode */}
      {musicStore.mode === 'ai' && (
        <div className="flex-1">
          {musicStore.isLoadingRecommendation && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-[#6E6E73]">
              <Loader2 className="w-6 h-6 animate-spin text-[#5856D6]" />
              <p className="text-sm">AI is selecting the perfect track...</p>
            </div>
          )}
          {!musicStore.isLoadingRecommendation && musicStore.aiRecommendation && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[#5856D6]" />
                <span className="text-xs text-[#5856D6] font-medium">AI Recommendation</span>
                <span className="ml-auto text-xs text-[#86868B]">
                  {Math.round(musicStore.aiConfidence * 100)}% match
                </span>
              </div>
              <TrackCard track={musicStore.aiRecommendation} isSelected />
              <p className="text-xs text-[#6E6E73] mt-2 leading-relaxed">{musicStore.aiReason}</p>

              {musicStore.aiAlternatives.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-[#86868B] mb-2">Alternatives:</p>
                  <div className="space-y-1.5">
                    {musicStore.aiAlternatives.slice(0, 2).map(track => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        isSelected={musicStore.selectedTrack?.id === track.id}
                        onSelect={() => musicStore.setSelectedTrack(track)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={requestAIRecommendation}
                className="mt-3 text-xs text-[#0071E3] hover:text-[#0077ED] transition-colors flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                Re-generate recommendation
              </button>
            </div>
          )}
          {!musicStore.isLoadingRecommendation && musicStore.recommendError && (
            <div className="text-xs text-[#FF3B30] p-3 rounded-lg bg-[#FF3B30]/5 border border-[#FF3B30]/20">
              {musicStore.recommendError}
              <button onClick={requestAIRecommendation} className="block mt-2 underline font-medium">
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Library */}
      {musicStore.mode === 'manual' && (
        <div className="flex-1">
          {loadingLibrary ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#86868B]" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 custom-scroll">
              {tracks.map(track => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isSelected={musicStore.selectedTrack?.id === track.id}
                  onSelect={() => musicStore.setSelectedTrack(track)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload */}
      {musicStore.mode === 'upload' && (
        <div className="flex-1">
          <label className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3]/40 cursor-pointer transition-all group bg-[#F5F5F7]/50">
            <Upload className="w-8 h-8 text-[#86868B] group-hover:text-[#0071E3] transition-colors mb-3" />
            <span className="text-sm text-[#6E6E73] group-hover:text-[#1D1D1F] transition-colors">
              {musicStore.uploadedFilename || 'Click to upload audio'}
            </span>
            <span className="text-xs text-[#86868B] mt-1">MP3, WAV, AAC — max 50MB</span>
            <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
          </label>
          {musicStore.uploadedFilename && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[#34C759]">
              <Check className="w-3.5 h-3.5" />
              {musicStore.uploadedFilename} uploaded
            </div>
          )}
        </div>
      )}

      {/* Volume */}
      {musicStore.mode !== 'upload' && (
        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-[#86868B] flex-shrink-0" />
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={musicStore.volume}
            onChange={(e) => musicStore.setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-[#0071E3]"
          />
          <span className="text-xs text-[#86868B] w-8 text-right">
            {Math.round(musicStore.volume * 100)}%
          </span>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onStartProcessing}
        disabled={isStarting}
        className="w-full py-3.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0068D1] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {isStarting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Generate AI Clip
          </>
        )}
      </button>
    </div>
  )
}

function TrackCard({
  track, isSelected, onSelect
}: {
  track: MusicTrack
  isSelected?: boolean
  onSelect?: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        isSelected
          ? 'border-[#5856D6]/40 bg-[#5856D6]/5'
          : onSelect
            ? 'border-[#D2D2D7] bg-white hover:border-[#86868B] cursor-pointer'
            : 'border-[#D2D2D7] bg-white'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isSelected ? 'bg-[#5856D6]/20' : 'bg-[#F5F5F7]'
      }`}>
        {isSelected ? (
          <Check className="w-4 h-4 text-[#5856D6]" />
        ) : (
          <Play className="w-4 h-4 text-[#86868B]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[#1D1D1F] truncate">{track.title}</div>
        <div className="text-xs text-[#86868B] mt-0.5">{track.genre.slice(0, 2).join(' · ')} · {track.bpm} BPM</div>
      </div>
      <div className="text-xs text-[#86868B] flex-shrink-0">{formatDuration(track.duration)}</div>
    </div>
  )
}
