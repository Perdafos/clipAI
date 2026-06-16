import { Download, Share2, Star, Clock, FileVideo, Sparkles } from 'lucide-react'
import type { WSCompleteData } from '../../types'
import { formatDuration, formatFileSize } from '../../types'

interface ExportPanelProps {
  resultData: WSCompleteData
}

export function ExportPanel({ resultData }: ExportPanelProps) {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = `${apiBase}${resultData.downloadUrl}`
    const ext = resultData.downloadUrl.endsWith('.mp4') ? '.mp4' : '.mp4'
    a.download = `${resultData.videoTitle || 'clip'}${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const qualityPct = Math.round(resultData.qualityScore * 100)

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Your clip is ready! 🎬</h3>
          <p className="text-xs text-slate-400 mt-0.5">AI-generated highlight clip</p>
        </div>
        {/* Quality Score */}
        <div className="ml-auto text-right">
          <div className="flex items-center gap-1 justify-end">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-sm font-bold text-amber-400">{qualityPct}%</span>
          </div>
          <span className="text-xs text-slate-500">Quality score</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { icon: Clock, label: 'Duration', value: formatDuration(resultData.duration) },
          { icon: FileVideo, label: 'File size', value: formatFileSize(resultData.fileSize) },
          { icon: Star, label: 'AI score', value: `${qualityPct}/100` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-3 rounded-xl bg-white/5 text-center">
            <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25"
        >
          <Download className="w-4 h-4" />
          Download MP4
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(import.meta.env.VITE_API_BASE_URL + resultData.downloadUrl)}
          className="flex items-center gap-2 px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-white text-sm font-medium transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      <p className="text-xs text-slate-600 text-center mt-4">
        Download link expires in 1 hour. Save your clip now.
      </p>
    </div>
  )
}
