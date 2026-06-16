import { useClipStore } from '../../stores'
import type { JobStatus } from '../../types'
import { Loader2, CheckCircle2 } from 'lucide-react'

const STAGES: { key: JobStatus; label: string; emoji: string }[] = [
  { key: 'downloading', label: 'Downloading video', emoji: '⬇️' },
  { key: 'analyzing', label: 'AI scene analysis', emoji: '🧠' },
  { key: 'selecting_music', label: 'Selecting music', emoji: '🎵' },
  { key: 'generating', label: 'Generating clips', emoji: '✂️' },
  { key: 'finalizing', label: 'Finalizing export', emoji: '🎬' },
  { key: 'complete', label: 'Complete!', emoji: '✅' },
]

function getStageIndex(stage: JobStatus | null): number {
  if (!stage) return -1
  return STAGES.findIndex(s => s.key === stage)
}

export function ProcessingPanel() {
  const { processingStage, progress, statusMessage } = useClipStore()
  const currentIndex = getStageIndex(processingStage)

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Generating your clip</h3>
          <p className="text-xs text-slate-400 mt-0.5">{statusMessage || 'Processing...'}</p>
        </div>
        <div className="ml-auto text-2xl font-black text-violet-400 tabular-nums">
          {progress}%
        </div>
      </div>

      {/* Master progress bar */}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage steps */}
      <div className="space-y-3">
        {STAGES.map((stage, index) => {
          const isDone = index < currentIndex
          const isActive = index === currentIndex
          const isPending = index > currentIndex

          return (
            <div key={stage.key} className={`flex items-center gap-3 transition-all duration-300 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
              {/* Icon */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                isDone ? 'bg-emerald-500/20' :
                isActive ? 'bg-violet-500/30' :
                'bg-white/5'
              }`}>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isActive ? (
                  <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                ) : (
                  <span>{stage.emoji}</span>
                )}
              </div>

              {/* Label */}
              <span className={`text-sm ${
                isDone ? 'text-emerald-400' :
                isActive ? 'text-white font-medium' :
                'text-slate-500'
              }`}>
                {stage.label}
              </span>

              {/* Active indicator */}
              {isActive && (
                <span className="ml-auto text-xs text-violet-400 animate-pulse">In progress</span>
              )}
              {isDone && (
                <span className="ml-auto text-xs text-emerald-500">Done</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-600 mt-6 text-center">
        Processing usually takes 1–3 minutes depending on video length.
      </p>
    </div>
  )
}
