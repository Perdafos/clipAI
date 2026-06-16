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
    <div className="apple-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-[#0071E3] animate-spin" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1D1D1F]">Generating your clip</h3>
          <p className="text-xs text-[#6E6E73] mt-0.5">{statusMessage || 'Processing...'}</p>
        </div>
        <div className="ml-auto text-2xl font-black text-[#0071E3] tabular-nums">
          {progress}%
        </div>
      </div>

      <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-[#0071E3] to-[#5856D6] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-3">
        {STAGES.map((stage, index) => {
          const isDone = index < currentIndex
          const isActive = index === currentIndex
          const isPending = index > currentIndex

          return (
            <div key={stage.key} className={`flex items-center gap-3 transition-all duration-300 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                isDone ? 'bg-[#34C759]/15' :
                isActive ? 'bg-[#0071E3]/15' :
                'bg-[#F5F5F7]'
              }`}>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
                ) : isActive ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#0071E3] animate-spin" />
                ) : (
                  <span className="text-[#86868B]">{stage.emoji}</span>
                )}
              </div>
              <span className={`text-sm ${
                isDone ? 'text-[#34C759] font-medium' :
                isActive ? 'text-[#1D1D1F] font-medium' :
                'text-[#86868B]'
              }`}>
                {stage.label}
              </span>
              {isActive && (
                <span className="ml-auto text-xs text-[#0071E3] font-medium">In progress</span>
              )}
              {isDone && (
                <span className="ml-auto text-xs text-[#34C759] font-medium">Done</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-[#86868B] mt-6 text-center">
        Processing usually takes 1–3 minutes depending on video length.
      </p>
    </div>
  )
}
