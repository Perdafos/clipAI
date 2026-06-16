import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Scissors, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import type { EditedClip } from '../../types'
import { formatDuration } from '../../types'

interface TimelineEditorProps {
  clips: EditedClip[]
  currentTime: number
  duration: number
  selectedClipId: string | null
  onSeek: (time: number) => void
  onSplit: (time: number) => void
  onTrim: (id: string, start: number, end: number) => void
  onDelete: (id: string) => void
  onSelectClip: (id: string | null) => void
}

const CLIP_COLORS: Record<string, string> = {
  dunk: '#f43f5e',
  ankle_breaker: '#f97316',
  block: '#8b5cf6',
  steal: '#06b6d4',
  three_pointer: '#10b981',
  highlight: '#6366f1',
  other: '#64748b',
}

const PIXELS_PER_SECOND_BASE = 40
const TRACK_HEIGHT = 52
const RULER_HEIGHT = 28
const AUDIO_TRACK_HEIGHT = 36

// Deterministic "waveform" from clip id — never changes per clip
function buildWaveform(clipId: string, count: number): number[] {
  let hash = 0
  for (let i = 0; i < clipId.length; i++) hash = ((hash << 5) - hash) + clipId.charCodeAt(i) | 0
  const h = Math.abs(hash)
  return Array.from({ length: count }, (_, i) => 4 + ((h * (i + 1) * 1103515245 + 12345) % 28))
}

export function TimelineEditor({
  clips,
  currentTime,
  duration,
  selectedClipId,
  onSeek,
  onSplit,
  onTrim,
  onDelete,
  onSelectClip,
}: TimelineEditorProps) {
  const [zoom, setZoom] = useState(1)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [trimEdge, setTrimEdge] = useState<{ id: string; edge: 'start' | 'end' } | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)

  const pxPerSec = PIXELS_PER_SECOND_BASE * zoom
  const totalWidth = duration * pxPerSec

  // Memoize sorted clips — avoid 3 separate .sort() per render
  const sortedClips = useMemo(
    () => [...clips].sort((a, b) => a.start - b.start),
    [clips]
  )
  const maxTrimmed = useMemo(
    () => sortedClips.reduce((s, c) => s + (c.end - c.start), 0),
    [sortedClips]
  )

  // Pre-compute deterministic waveform for each clip
  const waveformMap = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const clip of sortedClips) {
      const w = Math.max(6, (clip.end - clip.start) * pxPerSec)
      map.set(clip.id, buildWaveform(clip.id, Math.min(Math.floor(w / 4), 80)))
    }
    return map
  }, [sortedClips, pxPerSec])

  // Playhead position
  const playheadLeft = currentTime * pxPerSec

  // Ruler marks — show every second at zoom ≥1, every 2s at zoom 0.5, every 5s at zoom 0.25
  const rulerInterval = zoom >= 1 ? 1 : zoom >= 0.5 ? 2 : 5

  const rulerMarks = useMemo(() => {
    const marks: number[] = []
    for (let t = 0; t <= duration; t += rulerInterval) {
      marks.push(t)
    }
    return marks
  }, [duration, rulerInterval])

  // ─── Playhead drag ───────────────────────────────────────────
  const timeFromMouse = useCallback(
    (clientX: number) => {
      if (!timelineRef.current) return 0
      const rect = timelineRef.current.getBoundingClientRect()
      const x = clientX - rect.left + (timelineRef.current.scrollLeft || 0)
      return Math.max(0, Math.min(duration, x / pxPerSec))
    },
    [duration, pxPerSec]
  )

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (trimEdge) return
      if (isDraggingPlayhead) return
      const target = e.target as HTMLElement
      if (target.closest('[data-trim-handle]')) return
      if (target.closest('[data-clip-block]')) return
      onSeek(timeFromMouse(e.clientX))
    },
    [onSeek, timeFromMouse, isDraggingPlayhead, trimEdge]
  )

  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      setIsDraggingPlayhead(true)
    },
    []
  )

  useEffect(() => {
    if (!isDraggingPlayhead) return

    const onMove = (e: MouseEvent) => {
      const t = timeFromMouse(e.clientX)
      onSeek(t)
    }
    const onUp = () => setIsDraggingPlayhead(false)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [isDraggingPlayhead, timeFromMouse, onSeek])

  // ─── Trim handle drag ────────────────────────────────────────
  const handleTrimMouseDown = useCallback(
    (e: React.MouseEvent, clipId: string, edge: 'start' | 'end') => {
      e.stopPropagation()
      e.preventDefault()
      setTrimEdge({ id: clipId, edge })
    },
    []
  )

  useEffect(() => {
    if (!trimEdge) return

    const clip = clips.find(c => c.id === trimEdge.id)
    if (!clip) { setTrimEdge(null); return }

    const onMove = (e: MouseEvent) => {
      const t = timeFromMouse(e.clientX)
      const minDur = 0.5

      if (trimEdge.edge === 'start') {
        const newStart = Math.max(0, Math.min(t, clip.end - minDur))
        onTrim(clip.id, newStart, clip.end)
      } else {
        const newEnd = Math.min(duration, Math.max(t, clip.start + minDur))
        onTrim(clip.id, clip.start, newEnd)
      }
    }

    const onUp = () => setTrimEdge(null)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [trimEdge, clips, timeFromMouse, onTrim, duration])

  // ─── Clip click ──────────────────────────────────────────────
  const handleClipClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      onSelectClip(id)
    },
    [onSelectClip]
  )

  // Refs for stable callbacks
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime
  const selectedClipIdRef = useRef(selectedClipId)
  selectedClipIdRef.current = selectedClipId

  // ─── Split at playhead ───────────────────────────────────────
  const handleSplit = useCallback(() => {
    onSplit(currentTimeRef.current)
  }, [onSplit])

  // ─── Delete selected ─────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (selectedClipIdRef.current) onDelete(selectedClipIdRef.current)
  }, [onDelete])

  // ─── Split button enabled state — memoized ──────────────────
  const canSplit = useMemo(
    () => clips.some(c => c.start < currentTime && c.end > currentTime),
    [clips, currentTime]
  )

  // ─── Delete hover style ──────────────────────────────────────
  const [hoveredClip, setHoveredClip] = useState<string | null>(null)

  return (
    <div className="rounded-2xl border border-white/8 bg-[#13131f] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/6 bg-[#0f0f1a]">
        <button
          onClick={handleSplit}
          disabled={!canSplit}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Split at playhead"
        >
          <Scissors className="w-3.5 h-3.5" />
          Split
        </button>
        <button
          onClick={handleDelete}
          disabled={!selectedClipId}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Delete selected clip"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-600 tabular-nums w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats */}
        <div className="ml-3 pl-3 border-l border-white/6 text-[10px] text-slate-600 tabular-nums">
          {clips.length} clip{clips.length > 1 ? 's' : ''} · {formatDuration(maxTrimmed)}
        </div>
      </div>

      {/* Scrollable timeline area */}
      <div
        ref={timelineRef}
        className="overflow-x-auto overflow-y-hidden custom-scroll relative"
        style={{ maxHeight: RULER_HEIGHT + TRACK_HEIGHT + AUDIO_TRACK_HEIGHT + 4, minHeight: RULER_HEIGHT + TRACK_HEIGHT + AUDIO_TRACK_HEIGHT + 4 }}
      >
        <div className="relative" style={{ width: Math.max(totalWidth, 800), minHeight: '100%' }}>
          {/* ── Ruler ─────────────────────────────────────────────── */}
          <div
            className="relative border-b border-white/6 bg-[#0d0d1a]"
            style={{ height: RULER_HEIGHT }}
          >
            {rulerMarks.map((t) => {
              const left = t * pxPerSec
              const isMajor = t % (rulerInterval * 5) === 0
              return (
                <div
                  key={t}
                  className="absolute top-0"
                  style={{ left: `${left}px` }}
                >
                  <div
                    className={`absolute -bottom-px left-0 ${isMajor ? 'h-2 w-px bg-white/20' : 'h-1 w-px bg-white/10'}`}
                  />
                  {isMajor && (
                    <span className="absolute left-1 top-0.5 text-[9px] text-slate-500 font-mono whitespace-nowrap">
                      {formatDuration(t)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Video Track ──────────────────────────────────────── */}
          <div
            className="relative border-b border-white/6 bg-[#111122]"
            style={{ height: TRACK_HEIGHT }}
            onClick={handleTimelineClick}
          >
            {/* Track label */}
            <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 bg-[#0f0f1a]/80">
              <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Video</span>
            </div>

            {/* Background seconds grid */}
            {rulerMarks.map((t) => (
              <div
                key={`grid-${t}`}
                className="absolute top-0 bottom-0 w-px bg-white/[0.02]"
                style={{ left: `${t * pxPerSec}px` }}
              />
            ))}

            {/* Clips */}
            {sortedClips.map((clip) => {
                const color = CLIP_COLORS[clip.type] || CLIP_COLORS.highlight
                const left = clip.start * pxPerSec
                const width = Math.max(6, (clip.end - clip.start) * pxPerSec)
                const isSelected = selectedClipId === clip.id
                const isHovered = hoveredClip === clip.id
                const minWidthForText = width > 30

                return (
                  <div
                    key={clip.id}
                    data-clip-block
                    className={`absolute top-1 bottom-1 rounded-md transition-shadow flex items-center cursor-pointer overflow-hidden ${
                      isSelected ? 'ring-2 ring-white/60 z-10' : isHovered ? 'ring-1 ring-white/20 z-10' : 'z-0'
                    }`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      background: `${color}33`,
                      borderLeft: `3px solid ${color}`,
                    }}
                    onClick={(e) => handleClipClick(e, clip.id)}
                    onMouseEnter={() => setHoveredClip(clip.id)}
                    onMouseLeave={() => setHoveredClip(null)}
                  >
                    {minWidthForText && (
                      <span className="text-[9px] text-white/80 font-medium truncate px-1.5 leading-tight">
                        {clip.title || clip.type}
                      </span>
                    )}

                    {/* Trim handle start */}
                    <div
                      data-trim-handle="start"
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors"
                      onMouseDown={(e) => handleTrimMouseDown(e, clip.id, 'start')}
                    />
                    {/* Trim handle end */}
                    <div
                      data-trim-handle="end"
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors"
                      onMouseDown={(e) => handleTrimMouseDown(e, clip.id, 'end')}
                    />
                  </div>
                )
              })}

            {/* Cut point markers */}
            {sortedClips.reduce<number[]>((acc, c, idx) => {
                if (idx > 0) acc.push(c.start)
                return acc
              }, [])
              .map((t, i) => (
                <div
                  key={`cut-${i}`}
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-20 pointer-events-none"
                  style={{ left: `${t * pxPerSec}px` }}
                />
              ))}
          </div>

          {/* ── Audio Track ──────────────────────────────────────── */}
          <div
            className="relative border-b border-white/4 bg-[#0d0d1a]"
            style={{ height: AUDIO_TRACK_HEIGHT }}
            onClick={handleTimelineClick}
          >
            {/* Track label */}
            <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 bg-[#0f0f1a]/80">
              <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Audio</span>
            </div>

            {/* Placeholder waveform */}
            {sortedClips.map((clip) => {
                const left = clip.start * pxPerSec
                const width = Math.max(6, (clip.end - clip.start) * pxPerSec)
                const isMuted = selectedClipId === clip.id
                const waveformBars = waveformMap.get(clip.id) || []
                return (
                  <div
                    key={`audio-${clip.id}`}
                    className="absolute top-1 bottom-1 rounded-sm flex items-center overflow-hidden"
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      background: `${CLIP_COLORS[clip.type] || '#6366f1'}15`,
                    }}
                  >
                    {/* Simulated waveform bars — deterministic from clip id */}
                    {waveformBars.map((h, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 rounded-full"
                        style={{
                          width: 2,
                          height: `${h}px`,
                          background: `${CLIP_COLORS[clip.type] || '#6366f1'}55`,
                          marginRight: 2,
                        }}
                      />
                    ))}
                    {isMuted && (
                      <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                        <span className="text-[8px] text-red-400 font-bold">MUTED</span>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          {/* ── Playhead (overlay on last row) ────────────────────── */}
          <div
            ref={playheadRef}
            className="absolute top-0 bottom-0 w-px z-30 pointer-events-none"
            style={{ left: `${playheadLeft}px` }}
          >
            {/* Diamond handle */}
            <div
              className="absolute -top-0.5 -left-1.5 w-3 h-3 bg-violet-500 rotate-45 shadow-[0_0_6px_#8b5cf6] pointer-events-auto cursor-grab active:cursor-grabbing z-10"
              onMouseDown={handlePlayheadMouseDown}
            />
            {/* Line */}
            <div className="absolute top-2 bottom-0 left-0 w-0.5 bg-violet-500 shadow-[0_0_6px_#8b5cf6]" />
          </div>

          {/* Empty state */}
          {clips.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">
              No clips on timeline
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
