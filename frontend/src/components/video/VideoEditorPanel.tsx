import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, Download, Share2, Star, Clock, FileVideo, SkipBack, SkipForward } from 'lucide-react'
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
  dunk: '#f43f5e',
  ankle_breaker: '#f97316',
  block: '#8b5cf6',
  steal: '#06b6d4',
  three_pointer: '#10b981',
  highlight: '#6366f1',
  other: '#64748b',
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
  // Generate mock segments from duration
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

  // Selective store subscriptions — avoid full-store destructure re-renders
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

  // Init timeline on mount
  useEffect(() => {
    const clips = buildEditedClips(resultData, videoDuration)
    if (useClipStore.getState().timelineClips.length === 0) {
      initTimeline(clips)
    }
  }, [resultData, videoDuration, initTimeline])

  // Video event listeners
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

  // Keep ref in sync for stable keyboard handler
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

  // Stable skip — reads ref instead of closure currentTime
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

  const handleDownload = async () => {
    try {
      const resp = await fetch(videoUrl)
      if (!resp.ok) throw new Error('Download failed')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = resultData.downloadUrl.endsWith('.mp4') ? '.mp4' : '.mp4'
      a.download = `${resultData.videoTitle || 'clipai-highlight'}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  // Check if any clip spans the current playhead position (memoized)
  const clipAtPlayhead = useMemo(
    () => timelineClips.some(c => c.start < currentTime && c.end > currentTime),
    [timelineClips, currentTime]
  )

  // Keyboard shortcuts — stable effect, reads refs
  const keyboardHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  keyboardHandlerRef.current = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    switch (e.key) {
      case ' ':
        e.preventDefault(); togglePlay(); break
      case 'ArrowLeft':
        e.preventDefault(); skip(-5); break
      case 'ArrowRight':
        e.preventDefault(); skip(5); break
      case 's': case 'S':
        e.preventDefault(); splitClip(currentTimeRef.current); break
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
  }, []) // stable — intentionally empty, reads refs

  const progress = currentTime > 0 ? (currentTime / duration) * 100 : 0
  const qualityPct = Math.round(resultData.qualityScore * 100)
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* ── AI Overview ──────────────────────────────────────── */}
      {resultData.overview && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-xs text-slate-300 leading-relaxed">{resultData.overview}</p>
        </div>
      )}

      {/* ── Video Player ──────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-white/8 bg-black relative group">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video object-contain bg-black"
          onClick={togglePlay}
          preload="metadata"
          style={{ cursor: 'pointer' }}
        />

        {/* Overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

        {/* Play overlay */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-all hover:scale-105">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </div>
          </button>
        )}

        {/* Quality badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-400 text-xs font-bold pointer-events-none">
          <Star className="w-3 h-3 fill-amber-400" />
          {qualityPct}%
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Timeline seek bar */}
          <DraggableTimeline
            duration={duration}
            segments={timelineClips}
            onSeek={seekTo}
            progress={progress}
          />

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            {/* Skip -10 */}
            <button onClick={() => skip(-10)} className="text-white/60 hover:text-white transition-colors p-1" title="-10s">
              <SkipBack className="w-4 h-4" />
            </button>
            {/* Skip -5 */}
            <button onClick={() => skip(-5)} className="text-white/60 hover:text-white transition-colors p-1 text-[10px] font-bold" title="-5s">
              -5
            </button>

            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all mx-1">
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white fill-white ml-0.5" />}
            </button>

            {/* Skip +5 */}
            <button onClick={() => skip(5)} className="text-white/60 hover:text-white transition-colors p-1 text-[10px] font-bold" title="+5s">
              +5
            </button>
            {/* Skip +10 */}
            <button onClick={() => skip(10)} className="text-white/60 hover:text-white transition-colors p-1" title="+10s">
              <SkipForward className="w-4 h-4" />
            </button>

            <span className="text-[11px] text-white/70 tabular-nums ml-2 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Clip-at-playhead indicator */}
            {clipAtPlayhead && (
              <div className="ml-2 px-1.5 py-0.5 rounded bg-violet-500/30 text-[9px] text-violet-300 font-medium">
                Snip
              </div>
            )}

            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors p-1">
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={isMuted ? 0 : volume}
                  onChange={e => changeVolume(Number(e.target.value))}
                  className="w-14 accent-violet-500 h-1"
                />
              </div>
              <button
                onClick={() => videoRef.current?.requestFullscreen()}
                className="text-white/60 hover:text-white transition-colors p-1"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Clock, label: 'Duration', value: formatDuration(resultData.duration) },
          { icon: FileVideo, label: 'File Size', value: formatFileSize(resultData.fileSize) },
          { icon: Star, label: 'AI Score', value: `${qualityPct}/100` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-3 rounded-xl bg-white/4 border border-white/6 text-center">
            <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Keyboard Hints ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 text-[10px] text-slate-600">
        <span><kbd className="px-1 py-0.5 rounded bg-white/6 font-mono">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1 py-0.5 rounded bg-white/6 font-mono">←</kbd><kbd className="px-1 py-0.5 rounded bg-white/6 font-mono">→</kbd> Skip 5s</span>
        <span><kbd className="px-1 py-0.5 rounded bg-white/6 font-mono">S</kbd> Split</span>
        <span><kbd className="px-1 py-0.5 rounded bg-white/6 font-mono">Del</kbd> Delete clip</span>
        <span><kbd className="px-1 py-0.5 rounded bg-white/6 font-mono">^Z</kbd> Undo</span>
      </div>

      {/* ── Edit Toolbar ────────────────────────────────────────── */}
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

      {/* ── Timeline Editor ──────────────────────────────────────── */}
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

      {/* ── Actions ────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]"
        >
          <Download className="w-4 h-4" />
          Download Clip
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(window.location.origin + resultData.downloadUrl)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 text-white text-sm font-medium transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  )
}

// ─── Draggable timeline sub-component (used in player overlay) ──
function DraggableTimeline({
  duration,
  segments,
  onSeek,
  progress,
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

    const onMove = (e: MouseEvent) => {
      onSeek(getTimeFromClientX(e.clientX))
    }
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
      className="relative h-[5px] bg-white/15 rounded-full cursor-pointer mb-[6px] hover:h-[7px] transition-all group"
      onMouseDown={handleMouseDown}
    >
      {/* Segment markers */}
      {segments.map(seg => (
        <div
          key={seg.id}
          className="absolute top-0 h-full opacity-50 rounded-sm"
          style={{
            left: `${(seg.start / duration) * 100}%`,
            width: `${((seg.end - seg.start) / duration) * 100}%`,
            background: CLIP_TYPE_COLORS[seg.type] || '#6366f1',
          }}
        />
      ))}
      {/* Progress fill */}
      <div
        className="absolute left-0 top-0 h-full bg-violet-500 rounded-full transition-all duration-75"
        style={{ width: `${progress}%` }}
      />
      {/* Playhead dot */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg transition-transform ${isDragging ? 'scale-125' : ''}`}
        style={{ left: `calc(${progress}% - 5px)` }}
      />
    </div>
  )
}
