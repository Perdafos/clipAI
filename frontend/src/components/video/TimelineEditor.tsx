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
  dunk: '#FF3B30',
  ankle_breaker: '#FF9500',
  block: '#5856D6',
  steal: '#007AFF',
  three_pointer: '#34C759',
  highlight: '#0071E3',
  other: '#86868B',
}

const PIXELS_PER_SECOND_BASE = 40
const TRACK_HEIGHT = 52
const RULER_HEIGHT = 28
const AUDIO_TRACK_HEIGHT = 36

function buildWaveform(clipId: string, count: number): number[] {
  let hash = 0
  for (let i = 0; i < clipId.length; i++) hash = ((hash << 5) - hash) + clipId.charCodeAt(i) | 0
  const h = Math.abs(hash)
  return Array.from({ length: count }, (_, i) => 4 + ((h * (i + 1) * 1103515245 + 12345) % 28))
}

export function TimelineEditor({
  clips, currentTime, duration, selectedClipId, onSeek, onSplit, onTrim, onDelete, onSelectClip,
}: TimelineEditorProps) {
  const [zoom, setZoom] = useState(1)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [trimEdge, setTrimEdge] = useState<{ id: string; edge: 'start' | 'end' } | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)

  const pxPerSec = PIXELS_PER_SECOND_BASE * zoom
  const totalWidth = duration * pxPerSec

  const sortedClips = useMemo(() => [...clips].sort((a, b) => a.start - b.start), [clips])
  const maxTrimmed = useMemo(() => sortedClips.reduce((s, c) => s + (c.end - c.start), 0), [sortedClips])

  const waveformMap = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const clip of sortedClips) {
      const w = Math.max(6, (clip.end - clip.start) * pxPerSec)
      map.set(clip.id, buildWaveform(clip.id, Math.min(Math.floor(w / 4), 80)))
    }
    return map
  }, [sortedClips, pxPerSec])

  const playheadLeft = currentTime * pxPerSec
  const rulerInterval = zoom >= 1 ? 1 : zoom >= 0.5 ? 2 : 5

  const rulerMarks = useMemo(() => {
    const marks: number[] = []
    for (let t = 0; t <= duration; t += rulerInterval) marks.push(t)
    return marks
  }, [duration, rulerInterval])

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
      if (trimEdge || isDraggingPlayhead) return
      const target = e.target as HTMLElement
      if (target.closest('[data-trim-handle]') || target.closest('[data-clip-block]')) return
      onSeek(timeFromMouse(e.clientX))
    },
    [onSeek, timeFromMouse, isDraggingPlayhead, trimEdge]
  )

  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    setIsDraggingPlayhead(true)
  }, [])

  useEffect(() => {
    if (!isDraggingPlayhead) return
    const onMove = (e: MouseEvent) => onSeek(timeFromMouse(e.clientX))
    const onUp = () => setIsDraggingPlayhead(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [isDraggingPlayhead, timeFromMouse, onSeek])

  const handleTrimMouseDown = useCallback((e: React.MouseEvent, clipId: string, edge: 'start' | 'end') => {
    e.stopPropagation(); e.preventDefault()
    setTrimEdge({ id: clipId, edge })
  }, [])

  useEffect(() => {
    if (!trimEdge) return
    const clip = clips.find(c => c.id === trimEdge.id)
    if (!clip) { setTrimEdge(null); return }
    const onMove = (e: MouseEvent) => {
      const t = timeFromMouse(e.clientX)
      if (trimEdge.edge === 'start') {
        onTrim(clip.id, Math.max(0, Math.min(t, clip.end - 0.5)), clip.end)
      } else {
        onTrim(clip.id, clip.start, Math.min(duration, Math.max(t, clip.start + 0.5)))
      }
    }
    const onUp = () => setTrimEdge(null)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [trimEdge, clips, timeFromMouse, onTrim, duration])

  const handleClipClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation(); onSelectClip(id)
  }, [onSelectClip])

  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime
  const selectedClipIdRef = useRef(selectedClipId)
  selectedClipIdRef.current = selectedClipId

  const handleSplit = useCallback(() => onSplit(currentTimeRef.current), [onSplit])
  const handleDelete = useCallback(() => { if (selectedClipIdRef.current) onDelete(selectedClipIdRef.current) }, [onDelete])
  const canSplit = useMemo(() => clips.some(c => c.start < currentTime && c.end > currentTime), [clips, currentTime])
  const [hoveredClip, setHoveredClip] = useState<string | null>(null)

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-black/[0.04] bg-[#FAFAFA]">
        <button
          onClick={handleSplit}
          disabled={!canSplit}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Scissors className="w-3.5 h-3.5" /> Split
        </button>
        <button
          onClick={handleDelete}
          disabled={!selectedClipId}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6E6E73] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.06] transition-all">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-[#86868B] tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1.5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.06] transition-all">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="ml-3 pl-3 border-l border-black/[0.06] text-[10px] text-[#86868B] tabular-nums">
          {clips.length} clip{clips.length > 1 ? 's' : ''} · {formatDuration(maxTrimmed)}
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="overflow-x-auto overflow-y-hidden custom-scroll relative"
        style={{ maxHeight: RULER_HEIGHT + TRACK_HEIGHT + AUDIO_TRACK_HEIGHT + 4, minHeight: RULER_HEIGHT + TRACK_HEIGHT + AUDIO_TRACK_HEIGHT + 4 }}
      >
        <div className="relative" style={{ width: Math.max(totalWidth, 800), minHeight: '100%' }}>
          {/* Ruler */}
          <div className="relative border-b border-black/[0.04] bg-[#F5F5F7]" style={{ height: RULER_HEIGHT }}>
            {rulerMarks.map((t) => {
              const left = t * pxPerSec
              const isMajor = t % (rulerInterval * 5) === 0
              return (
                <div key={t} className="absolute top-0" style={{ left: `${left}px` }}>
                  <div className={`absolute -bottom-px left-0 ${isMajor ? 'h-2 w-px bg-black/20' : 'h-1 w-px bg-black/10'}`} />
                  {isMajor && (
                    <span className="absolute left-1 top-0.5 text-[9px] text-[#86868B] font-mono whitespace-nowrap">
                      {formatDuration(t)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Video Track */}
          <div className="relative border-b border-black/[0.04] bg-[#FAFAFA]" style={{ height: TRACK_HEIGHT }} onClick={handleTimelineClick}>
            <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 bg-white/80">
              <span className="text-[9px] text-[#86868B] font-semibold uppercase tracking-wider">Video</span>
            </div>
            {rulerMarks.map((t) => (
              <div key={`grid-${t}`} className="absolute top-0 bottom-0 w-px bg-black/[0.02]" style={{ left: `${t * pxPerSec}px` }} />
            ))}
            {sortedClips.map((clip) => {
              const color = CLIP_COLORS[clip.type] || CLIP_COLORS.highlight
              const left = clip.start * pxPerSec
              const width = Math.max(6, (clip.end - clip.start) * pxPerSec)
              const isSelected = selectedClipId === clip.id
              const isHovered = hoveredClip === clip.id
              const minWidthForText = width > 30
              return (
                <div
                  key={clip.id} data-clip-block
                  className={`absolute top-1 bottom-1 rounded-md transition-shadow flex items-center cursor-pointer overflow-hidden ${
                    isSelected ? 'ring-2 ring-[#0071E3] z-10' : isHovered ? 'ring-1 ring-black/20 z-10' : 'z-0'
                  }`}
                  style={{ left: `${left}px`, width: `${width}px`, background: `${color}20`, borderLeft: `3px solid ${color}` }}
                  onClick={(e) => handleClipClick(e, clip.id)}
                  onMouseEnter={() => setHoveredClip(clip.id)}
                  onMouseLeave={() => setHoveredClip(null)}
                >
                  {minWidthForText && <span className="text-[9px] text-[#1D1D1F]/80 font-medium truncate px-1.5 leading-tight">{clip.title || clip.type}</span>}
                  <div data-trim-handle="start" className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 transition-colors" onMouseDown={(e) => handleTrimMouseDown(e, clip.id, 'start')} />
                  <div data-trim-handle="end" className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 transition-colors" onMouseDown={(e) => handleTrimMouseDown(e, clip.id, 'end')} />
                </div>
              )
            })}
            {sortedClips.reduce<number[]>((acc, c, idx) => { if (idx > 0) acc.push(c.start); return acc }, []).map((t, i) => (
              <div key={`cut-${i}`} className="absolute top-0 bottom-0 w-0.5 bg-black/30 z-20 pointer-events-none" style={{ left: `${t * pxPerSec}px` }} />
            ))}
          </div>

          {/* Audio Track */}
          <div className="relative border-b border-black/[0.04] bg-[#F5F5F7]" style={{ height: AUDIO_TRACK_HEIGHT }} onClick={handleTimelineClick}>
            <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 bg-[#F5F5F7]/80">
              <span className="text-[9px] text-[#86868B] font-semibold uppercase tracking-wider">Audio</span>
            </div>
            {sortedClips.map((clip) => {
              const left = clip.start * pxPerSec
              const width = Math.max(6, (clip.end - clip.start) * pxPerSec)
              const isMuted = selectedClipId === clip.id
              const waveformBars = waveformMap.get(clip.id) || []
              return (
                <div key={`audio-${clip.id}`} className="absolute top-1 bottom-1 rounded-sm flex items-center overflow-hidden"
                  style={{ left: `${left}px`, width: `${width}px`, background: `${CLIP_COLORS[clip.type] || '#0071E3'}10` }}>
                  {waveformBars.map((h, i) => (
                    <div key={i} className="flex-shrink-0 rounded-full"
                      style={{ width: 2, height: `${h}px`, background: `${CLIP_COLORS[clip.type] || '#0071E3'}40`, marginRight: 2 }} />
                  ))}
                  {isMuted && (
                    <div className="absolute inset-0 bg-[#FF3B30]/10 flex items-center justify-center">
                      <span className="text-[8px] text-[#FF3B30] font-bold">MUTED</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Playhead */}
          <div ref={playheadRef} className="absolute top-0 bottom-0 w-px z-30 pointer-events-none" style={{ left: `${playheadLeft}px` }}>
            <div className="absolute -top-0.5 -left-1.5 w-3 h-3 bg-[#0071E3] rotate-45 shadow-[0_0_6px_rgba(0,113,227,0.5)] pointer-events-auto cursor-grab active:cursor-grabbing z-10" onMouseDown={handlePlayheadMouseDown} />
            <div className="absolute top-2 bottom-0 left-0 w-0.5 bg-[#0071E3] shadow-[0_0_6px_rgba(0,113,227,0.5)]" />
          </div>

          {clips.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[#86868B]">No clips on timeline</div>
          )}
        </div>
      </div>
    </div>
  )
}
