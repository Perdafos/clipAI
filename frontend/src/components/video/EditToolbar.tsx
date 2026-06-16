import { Scissors, Trash2, Undo2, Redo2, ZoomIn, ZoomOut } from 'lucide-react'

interface EditToolbarProps {
  currentTime: number
  onSplit: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  zoom: number
  onZoomChange: (z: number) => void
  hasClipAtPlayhead: boolean
  hasSelectedClip: boolean
}

export function EditToolbar({
  onSplit,
  onDelete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  hasClipAtPlayhead,
  hasSelectedClip,
}: EditToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#0d0d1a] border border-white/6">
      {/* Split */}
      <button
        onClick={onSplit}
        disabled={!hasClipAtPlayhead}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-violet-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Split clip at playhead (S)"
      >
        <Scissors className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Split</span>
      </button>

      <div className="w-px h-5 bg-white/6" />

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={!hasSelectedClip}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Delete selected clip (Del)"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Delete</span>
      </button>

      <div className="w-px h-5 bg-white/6" />

      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-slate-600 tabular-nums w-8 text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(Math.min(4, zoom + 0.25))}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
