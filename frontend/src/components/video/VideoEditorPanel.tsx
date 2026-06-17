import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, Share2, Star, Clock, FileVideo, SkipBack, SkipForward, Loader2 } from 'lucide-react'
import type { WSCompleteData, EditedClip } from '../../types'
import { formatDuration, formatFileSize } from '../../types'
import { useClipStore } from '../../stores'
import { TimelineEditor } from './TimelineEditor'
import { EditToolbar } from './EditToolbar'

interface VideoEditorPanelProps {
  resultData: WSCompleteData
  videoTitle?: string
  videoDuration?: number
}

const CLIP_TYPE_COLORS: Record<string, string> = {
  dunk: '#FF3B30',
  ankle_breaker: '#FF9500',
  block: '#5856D6',
  steal: '#007AFF',
  three_pointer: '#34C759',
  highlight: '#0071E3',
  other: '#86868B',
}

const CLIP_TYPE_LABELS: Record<string, string> = {
  dunk: 'Dunk',
  ankle_breaker: 'Ankle Breaker',
  block: 'Block',
  steal: 'Steal',
  three_pointer: '3-Pointer',
  highlight: 'Highlight',
  other: 'Clip',
}

function buildEditedClips(resultData: WSCompleteData, videoDuration: number): EditedClip[] {
  if (resultData.clips && resultData.clips.length > 0) {
    return resultData.clips.map((c, i) => ({
      id: `seg-${i}`,
      start: c.start,
      end: c.end,
      title: c.title || CLIP_TYPE_LABELS[c.clip_type || 'highlight'] || `Clip ${i + 1}`,
      type: (c.clip_type as EditedClip['type']) || 'highlight',
      score: c.score || 0.85,
    }))
  }
  const types: EditedClip['type'][] = ['dunk', 'ankle_breaker', 'three_pointer', 'block', 'steal', 'highlight']
  const numSegs = Math.min(5, Math.max(2, Math.floor(videoDuration / 15)))
  const segs: EditedClip[] = []
  const segDur = videoDuration / numSegs
  for (let i = 0; i < numSegs; i++) {
    const start = Math.floor(segDur * i)
    const end = Math.floor(segDur * (i + 1))
    segs.push({
      id: `seg-${i}`,
      start,
      end,
      title: `Clip ${i + 1}`,
      type: types[i % types.length],
      score: 0.7 + Math.random() * 0.3,
    })
  }
  return segs
}

export function VideoEditorPanel({ resultData, videoDuration = 60 }: VideoEditorPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const currentTimeRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(videoDuration)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [isVideoLoading, setIsVideoLoading] = useState(true)

  const timelineClips = useClipStore(s => s.timelineClips)
  const selectedClipId = useClipStore(s => s.selectedClipId)
  const historyIndex = useClipStore(s => s.historyIndex)
  const history = useClipStore(s => s.history)
  const initTimeline = useClipStore(s => s.initTimeline)
  const selectClip = useClipStore(s => s.selectClip)
  const splitClip = useClipStore(s => s.splitClip)
  const deleteClip = useClipStore(s => s.deleteClip)
  const trimClip = useClipStore(s => s.trimClip)
  const undo = useClipStore(s => s.undo)
  const redo = useClipStore(s => s.redo)

  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  const videoUrl = apiBase ? `${apiBase}${resultData.downloadUrl}` : resultData.downloadUrl

  useEffect(() => {
    const clips = buildEditedClips(resultData, videoDuration)
    if (useClipStore.getState().timelineClips.length === 0) {
      initTimeline(clips)
    }
  }, [resultData, videoDuration, initTimeline])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTimeUpdate = () => { v.currentTime && setCurrentTime(v.currentTime) }
    const onDurationChange = () => setDuration(v.duration || videoDuration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('durationchange', onDurationChange)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('durationchange', onDurationChange)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
    }
  }, [videoDuration])

  currentTimeRef.current = currentTime
  const selectedClipIdRef = useRef(selectedClipId)
  selectedClipIdRef.current = selectedClipId

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }, [])

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(time, duration))
  }, [duration])

  const skip = useCallback((sec: number) => {
    seekTo(currentTimeRef.current + sec)
  }, [seekTo])

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(!isMuted)
  }

  const changeVolume = (val: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = val
    setVolume(val)
  }

  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    setDownloadProgress(0)
    try {
      const resp = await fetch(videoUrl)
      if (!resp.ok) throw new Error('Download failed')
      const contentLength = resp.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      const reader = resp.body!.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (total) {
          setDownloadProgress(Math.round((received / total) * 100))
        }
      }

      const blob = new Blob(chunks as BlobPart[])
      setDownloadProgress(100)
      await new Promise(r => setTimeout(r, 300))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resultData.videoTitle || 'clipai-highlight'}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setTimeout(() => { setIsDownloading(false); setDownloadProgress(0) }, 500)
    }
  }

  const clipAtPlayhead = useMemo(
    () => timelineClips.some(c => c.start < currentTime && c.end > currentTime),
    [timelineClips, currentTime]
  )

  const keyboardHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  keyboardHandlerRef.current = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    switch (e.key) {
      case ' ': e.preventDefault(); togglePlay(); break
      case 'ArrowLeft': e.preventDefault(); skip(-5); break
      case 'ArrowRight': e.preventDefault(); skip(5); break
      case 's': case 'S': e.preventDefault(); splitClip(currentTimeRef.current); break
      case 'Delete': case 'Backspace':
        if (selectedClipIdRef.current) { e.preventDefault(); deleteClip(selectedClipIdRef.current) }
        break
      case 'z': case 'Z':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
        break
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyboardHandlerRef.current?.(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const progress = currentTime > 0 ? (currentTime / duration) * 100 : 0
  const qualityPct = Math.round(resultData.qualityScore * 100)
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {resultData.overview && (
        <div className="rounded-xl bg-[#0071E3]/5 border border-[#0071E3]/10 p-4">
          <p className="text-xs text-[#6E6E73] leading-relaxed">{resultData.overview}</p>
        </div>
      )}

      {/* Video Player */}
      <div className="rounded-2xl overflow-hidden border border-black/[0.06] bg-[#F5F5F7] relative group">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video object-contain bg-black"
          onClick={togglePlay}
          preload="auto"
          style={{ cursor: 'pointer' }}
          onLoadStart={() => setIsVideoLoading(true)}
          onWaiting={() => setIsVideoLoading(true)}
          onCanPlay={() => setIsVideoLoading(false)}
          onPlaying={() => setIsVideoLoading(false)}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

        {isVideoLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
            <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
            <div className="text-white/70 text-xs font-medium">Loading video...</div>
            <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white/30 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
        {!isPlaying && !isVideoLoading && (
          <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-all hover:scale-105">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </div>
          </button>
        )}

        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 text-[#FF9500] text-xs font-bold pointer-events-none shadow-sm">
          <Star className="w-3 h-3 fill-[#FF9500]" />
          {qualityPct}%
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DraggableTimeline
            duration={duration}
            segments={timelineClips}
            onSeek={seekTo}
            progress={progress}
          />
          <div className="flex items-center gap-1.5">
            <button onClick={() => skip(-10)} className="text-white/60 hover:text-white transition-colors p-1" title="-10s">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={() => skip(-5)} className="text-white/60 hover:text-white transition-colors p-1 text-[10px] font-bold" title="-5s">-5</button>
            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all mx-1">
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white fill-white ml-0.5" />}
            </button>
            <button onClick={() => skip(5)} className="text-white/60 hover:text-white transition-colors p-1 text-[10px] font-bold" title="+5s">+5</button>
            <button onClick={() => skip(10)} className="text-white/60 hover:text-white transition-colors p-1" title="+10s">
              <SkipForward className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-white/70 tabular-nums ml-2 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {clipAtPlayhead && (
              <div className="ml-2 px-1.5 py-0.5 rounded bg-[#0071E3]/40 text-[9px] text-blue-200 font-medium">Snip</div>
            )}
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors p-1">
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <input type="range" min={0} max={1} step={0.1} value={isMuted ? 0 : volume} onChange={e => changeVolume(Number(e.target.value))} className="w-14 accent-[#0071E3] h-1" />
              </div>
              <button onClick={() => videoRef.current?.requestFullscreen()} className="text-white/60 hover:text-white transition-colors p-1">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Clock, label: 'Duration', value: formatDuration(resultData.duration) },
          { icon: FileVideo, label: 'File Size', value: formatFileSize(resultData.fileSize) },
          { icon: Star, label: 'AI Score', value: `${qualityPct}/100` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-2 sm:p-3 rounded-xl bg-[#F5F5F7] border border-black/[0.04] text-center">
            <Icon className="w-4 h-4 text-[#86868B] mx-auto mb-1" />
            <div className="text-sm font-semibold text-[#1D1D1F]">{value}</div>
            <div className="text-xs text-[#86868B]">{label}</div>
          </div>
        ))}
      </div>

      {/* Keyboard hints */}
      <div className="flex flex-wrap gap-1 sm:gap-2 text-[10px] text-[#86868B]">
        <span><kbd className="px-1 py-0.5 rounded bg-[#F5F5F7] font-mono border border-black/[0.06]">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[#F5F5F7] font-mono border border-black/[0.06]">←</kbd><kbd className="px-1 py-0.5 rounded bg-[#F5F5F7] font-mono border border-black/[0.06]">→</kbd> Skip 5s</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[#F5F5F7] font-mono border border-black/[0.06]">S</kbd> Split</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[#F5F5F7] font-mono border border-black/[0.06]">Del</kbd> Delete clip</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[#F5F5F7] font-mono border border-black/[0.06]">^Z</kbd> Undo</span>
      </div>

      <EditToolbar
        currentTime={currentTime}
        onSplit={() => splitClip(currentTime)}
        onDelete={() => selectedClipId && deleteClip(selectedClipId)}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        zoom={zoom}
        onZoomChange={setZoom}
        hasClipAtPlayhead={clipAtPlayhead}
        hasSelectedClip={!!selectedClipId}
      />

      <TimelineEditor
        clips={timelineClips}
        currentTime={currentTime}
        duration={duration}
        selectedClipId={selectedClipId}
        onSeek={seekTo}
        onSplit={splitClip}
        onTrim={trimClip}
        onDelete={deleteClip}
        onSelectClip={selectClip}
      />

      {isDownloading && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-[#6E6E73] mb-1.5">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Downloading{downloadProgress > 0 ? ` ${downloadProgress}%` : '...'}
            </span>
            <span>{downloadProgress}%</span>
          </div>
          <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0071E3] to-[#5856D6] rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#0071E3] to-[#5856D6] hover:from-[#0077ED] hover:to-[#5E5CDE] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-sm"
        >
          {isDownloading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Downloading {downloadProgress}%</>
          ) : (
            <><Download className="w-4 h-4" /> Download Clip</>
          )}
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(window.location.origin + resultData.downloadUrl)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-xl border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  )
}

function DraggableTimeline({
  duration, segments, onSeek, progress,
}: {
  duration: number
  segments: EditedClip[]
  onSeek: (t: number) => void
  progress: number
}) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const getTimeFromClientX = useCallback((clientX: number) => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(duration, ratio * duration))
  }, [duration])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    onSeek(getTimeFromClientX(e.clientX))
  }, [onSeek, getTimeFromClientX])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => onSeek(getTimeFromClientX(e.clientX))
    const onUp = () => setIsDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, onSeek, getTimeFromClientX])

  return (
    <div
      ref={timelineRef}
      className="relative h-[5px] bg-white/20 rounded-full cursor-pointer mb-[6px] hover:h-[7px] transition-all group"
      onMouseDown={handleMouseDown}
    >
      {segments.map(seg => (
        <div
          key={seg.id}
          className="absolute top-0 h-full opacity-50 rounded-sm"
          style={{
            left: `${(seg.start / duration) * 100}%`,
            width: `${((seg.end - seg.start) / duration) * 100}%`,
            background: CLIP_TYPE_COLORS[seg.type] || '#0071E3',
          }}
        />
      ))}
      <div
        className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-75"
        style={{ width: `${progress}%` }}
      />
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg transition-transform ${isDragging ? 'scale-125' : ''}`}
        style={{ left: `calc(${progress}% - 5px)` }}
      />
    </div>
  )
}
