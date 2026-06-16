import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward, Download, Share2, Star, Clock, FileVideo, Scissors, ChevronRight, Zap } from 'lucide-react'
import type { WSCompleteData } from '../../types'
import { formatDuration, formatFileSize } from '../../types'

interface ClipSegment {
  id: string
  start: number
  end: number
  label: string
  title: string
  type: 'dunk' | 'ankle_breaker' | 'block' | 'steal' | 'three_pointer' | 'highlight' | 'other'
  score: number
  reason?: string
}

interface VideoEditorPanelProps {
  resultData: WSCompleteData
  videoTitle?: string
  videoDuration?: number
}

const CLIP_TYPE_COLORS: Record<ClipSegment['type'], string> = {
  dunk: '#f43f5e',
  ankle_breaker: '#f97316',
  block: '#8b5cf6',
  steal: '#06b6d4',
  three_pointer: '#10b981',
  highlight: '#6366f1',
  other: '#64748b',
}

const CLIP_TYPE_LABELS: Record<ClipSegment['type'], string> = {
  dunk: '🏀 Dunk',
  ankle_breaker: '⚡ Ankle Breaker',
  block: '🛡️ Block',
  steal: '✂️ Steal',
  three_pointer: '🎯 3-Pointer',
  highlight: '⭐ Highlight',
  other: '📹 Clip',
}

// Generate mock segments from resultData
function generateSegments(duration: number): ClipSegment[] {
  const types: ClipSegment['type'][] = ['dunk', 'ankle_breaker', 'three_pointer', 'block', 'steal', 'highlight']
  const numSegs = Math.min(5, Math.max(2, Math.floor(duration / 15)))
  const segments: ClipSegment[] = []
  const segDur = duration / numSegs

  for (let i = 0; i < numSegs; i++) {
    const start = Math.floor(segDur * i)
    const end = Math.floor(segDur * (i + 1))
    segments.push({
      id: `seg-${i}`,
      start,
      end,
      label: `Clip ${i + 1}`,
      title: `Clip ${i + 1}`,
      type: types[i % types.length],
      score: 0.7 + Math.random() * 0.3,
    })
  }
  return segments
}

// Build segments from real clip data or generate from duration
function buildSegments(resultData: VideoEditorPanelProps['resultData'], videoDuration: number): ClipSegment[] {
  if (resultData.clips && resultData.clips.length > 0) {
    return resultData.clips.map((c, i) => ({
      id: `seg-${i}`,
      start: c.start,
      end: c.end,
      label: `Clip ${i + 1}`,
      title: c.title || CLIP_TYPE_LABELS[(c.clip_type as ClipSegment['type']) || 'highlight'] || `Clip ${i + 1}`,
      type: (c.clip_type as ClipSegment['type']) || 'highlight',
      score: c.score || 0.85,
      reason: c.reason,
    }))
  }
  return generateSegments(resultData.duration || videoDuration)
}

export function VideoEditorPanel({ resultData, videoDuration = 60 }: VideoEditorPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(videoDuration)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [activeSegment, setActiveSegment] = useState<string | null>(null)
  const [segments] = useState<ClipSegment[]>(() => buildSegments(resultData, videoDuration))
  const [selectedSegment, setSelectedSegment] = useState<ClipSegment | null>(null)

  const videoUrl = `http://localhost:3001${resultData.downloadUrl}`

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime)
      // Find active segment
      const active = segments.find(s => v.currentTime >= s.start && v.currentTime < s.end)
      setActiveSegment(active?.id || null)
    }
    const onDurationChange = () => setDuration(v.duration || videoDuration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)
    const onLoaded = () => { /* video loaded */ }
    const onError = () => { console.error('Video failed to load') }

    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('durationchange', onDurationChange)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)
    v.addEventListener('loadeddata', onLoaded)
    v.addEventListener('error', onError)

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('durationchange', onDurationChange)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('loadeddata', onLoaded)
      v.removeEventListener('error', onError)
    }
  }, [segments, videoDuration])

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

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seekTo(ratio * duration)
  }, [duration, seekTo])

  const jumpToSegment = useCallback((seg: ClipSegment) => {
    seekTo(seg.start)
    setSelectedSegment(seg)
    videoRef.current?.play()
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

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = 'clipai-highlight.mp4'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const qualityPct = Math.round(resultData.qualityScore * 100)
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">

      {/* ── AI Overview Summary ───────────────────────────────── */}
      {resultData.overview && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-300 mb-1">✨ AI Video Summary</p>
              <p className="text-xs text-slate-300 leading-relaxed">{resultData.overview}</p>
            </div>
          </div>
        </div>
      )}
      {/* ── Video Player ─────────────────────────────────────────── */}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

        {/* Play button overlay */}
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

        {/* Active segment badge */}
        {activeSegment && (
          <div className="absolute top-4 left-4 pointer-events-none">
            {(() => {
              const seg = segments.find(s => s.id === activeSegment)
              if (!seg) return null
              const color = CLIP_TYPE_COLORS[seg.type]
              return (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white animate-pulse"
                  style={{ background: `${color}cc`, border: `1px solid ${color}` }}
                >
                  <Zap className="w-3 h-3" />
                  {CLIP_TYPE_LABELS[seg.type]}
                </div>
              )
            })()}
          </div>
        )}

        {/* Quality badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-400 text-xs font-bold pointer-events-none">
          <Star className="w-3 h-3 fill-amber-400" />
          {qualityPct}%
        </div>

        {/* Bottom controls bar */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Timeline */}
          <div
            ref={timelineRef}
            className="relative h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 hover:h-2.5 transition-all"
            onClick={handleTimelineClick}
          >
            {/* Segment markers */}
            {segments.map(seg => (
              <div
                key={seg.id}
                className="absolute top-0 h-full opacity-60 rounded-sm"
                style={{
                  left: `${(seg.start / duration) * 100}%`,
                  width: `${((seg.end - seg.start) / duration) * 100}%`,
                  background: CLIP_TYPE_COLORS[seg.type],
                }}
              />
            ))}
            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
            {/* Progress fill */}
            <div
              className="absolute left-0 top-0 h-full bg-violet-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3">
            <button onClick={() => seekTo(currentTime - 10)} className="text-white/70 hover:text-white transition-colors">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all">
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white fill-white ml-0.5" />}
            </button>
            <button onClick={() => seekTo(currentTime + 10)} className="text-white/70 hover:text-white transition-colors">
              <SkipForward className="w-4 h-4" />
            </button>

            <span className="text-xs text-white/70 tabular-nums ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="ml-auto flex items-center gap-3">
              {/* Volume */}
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={isMuted ? 0 : volume}
                  onChange={e => changeVolume(Number(e.target.value))}
                  className="w-16 accent-violet-500"
                />
              </div>
              <button
                onClick={() => videoRef.current?.requestFullscreen()}
                className="text-white/70 hover:text-white transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────── */}
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

      {/* ── Timeline Editor ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-[#13131f] p-4">
        <div className="flex items-center gap-2 mb-4">
          <Scissors className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Clip Timeline</h3>
          <span className="ml-auto text-xs text-slate-500">{segments.length} segments · {formatTime(duration)} total</span>
        </div>

        {/* Timeline ruler */}
        <div className="relative mb-3">
          <div className="flex justify-between text-xs text-slate-600 mb-1 px-0.5">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>{formatTime((duration / 6) * i)}</span>
            ))}
          </div>
          {/* Track */}
          <div
            className="relative h-12 bg-white/4 rounded-xl overflow-hidden cursor-pointer border border-white/6"
            onClick={handleTimelineClick}
          >
            {/* Segments */}
            {segments.map(seg => (
              <button
                key={seg.id}
                onClick={(e) => { e.stopPropagation(); jumpToSegment(seg) }}
                className={`absolute top-1 bottom-1 rounded-lg transition-all hover:opacity-100 hover:scale-y-105 flex items-center justify-center overflow-hidden ${selectedSegment?.id === seg.id ? 'ring-2 ring-white/50' : 'opacity-80'}`}
                style={{
                  left: `${(seg.start / duration) * 100}%`,
                  width: `${Math.max(2, ((seg.end - seg.start) / duration) * 100)}%`,
                  background: `${CLIP_TYPE_COLORS[seg.type]}44`,
                  borderLeft: `2px solid ${CLIP_TYPE_COLORS[seg.type]}`,
                }}
              >
                <span className="text-xs font-bold text-white truncate px-1" style={{ fontSize: '9px' }}>
                  {CLIP_TYPE_LABELS[seg.type]}
                </span>
              </button>
            ))}
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-violet-400 shadow-[0_0_6px_#8b5cf6]"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {/* Segment List */}
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
        {segments.map((seg) => {
            const color = CLIP_TYPE_COLORS[seg.type]
            const isActive = activeSegment === seg.id
            const isSelected = selectedSegment?.id === seg.id
            return (
              <button
                key={seg.id}
                onClick={() => jumpToSegment(seg)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${isActive ? 'bg-white/10 ring-1 ring-violet-500/50' : isSelected ? 'bg-white/6' : 'hover:bg-white/4'}`}
              >
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                  <span className="text-sm">{CLIP_TYPE_LABELS[seg.type].split(' ')[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white truncate">{seg.title || CLIP_TYPE_LABELS[seg.type]}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: `${color}22`, color }}>
                      {CLIP_TYPE_LABELS[seg.type]}
                    </span>
                    {isActive && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-300 font-medium flex-shrink-0">Playing</span>
                    )}
                  </div>
                  {seg.reason && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{seg.reason}</div>
                  )}
                  <div className="text-xs text-slate-600 tabular-nums mt-0.5">
                    {formatTime(seg.start)} → {formatTime(seg.end)} · {formatTime(seg.end - seg.start)}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${color}22`, color }}
                  >
                    {Math.round(seg.score * 100)}%
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/6">
          {(Object.entries(CLIP_TYPE_LABELS) as [ClipSegment['type'], string][])
            .filter(([type]) => segments.some(s => s.type === type))
            .map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: CLIP_TYPE_COLORS[type] }} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────── */}
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
