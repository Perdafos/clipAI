import { Download, Share2, Star, Clock, FileVideo, Sparkles, Loader2 } from 'lucide-react'
import type { WSCompleteData } from '../../types'
import { formatDuration, formatFileSize } from '../../types'
import { useState, useRef } from 'react'

interface ExportPanelProps {
  resultData: WSCompleteData
}

export function ExportPanel({ resultData }: ExportPanelProps) {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadedSize, setDownloadedSize] = useState('')
  const startTimeRef = useRef(0)

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    setDownloadProgress(0)
    startTimeRef.current = Date.now()
    try {
      const resp = await fetch(`${apiBase}${resultData.downloadUrl}`)
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
          const pct = Math.round((received / total) * 100)
          setDownloadProgress(pct)
          setDownloadedSize(formatFileSize(received))
        } else {
          setDownloadedSize(formatFileSize(received))
        }
      }

      const blob = new Blob(chunks as BlobPart[])
      setDownloadProgress(100)
      await new Promise(r => setTimeout(r, 300)) // brief "100%" show
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = resultData.downloadUrl.endsWith('.mp4') ? '.mp4' : '.mp4'
      a.download = `${resultData.videoTitle || 'clip'}${ext}`
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

  const qualityPct = Math.round(resultData.qualityScore * 100)

  return (
    <div className="apple-card p-6 border-[#34C759]/20">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#34C759]" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1D1D1F]">Your clip is ready! 🎬</h3>
          <p className="text-xs text-[#6E6E73] mt-0.5">AI-generated highlight clip</p>
        </div>
        <div className="ml-auto text-right">
          <div className="flex items-center gap-1 justify-end">
            <Star className="w-3.5 h-3.5 text-[#FF9500] fill-[#FF9500]" />
            <span className="text-sm font-bold text-[#FF9500]">{qualityPct}%</span>
          </div>
          <span className="text-xs text-[#86868B]">Quality score</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        {[
          { icon: Clock, label: 'Duration', value: formatDuration(resultData.duration) },
          { icon: FileVideo, label: 'File size', value: formatFileSize(resultData.fileSize) },
          { icon: Star, label: 'AI score', value: `${qualityPct}/100` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-2 sm:p-3 rounded-xl bg-[#F5F5F7] text-center">
            <Icon className="w-4 h-4 text-[#86868B] mx-auto mb-1" />
            <div className="text-sm font-semibold text-[#1D1D1F]">{value}</div>
            <div className="text-xs text-[#86868B]">{label}</div>
          </div>
        ))}
      </div>

      {isDownloading && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[#6E6E73] mb-1.5">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Downloading{downloadProgress > 0 ? ` ${downloadProgress}%` : '...'}
            </span>
            <span>{downloadedSize} / {formatFileSize(resultData.fileSize)}</span>
          </div>
          <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#34C759] to-[#30D158] rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#34C759] hover:bg-[#30D158] active:bg-[#28A745] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-sm"
        >
          {isDownloading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Downloading {downloadProgress}%</>
          ) : (
            <><Download className="w-4 h-4" /> Download MP4</>
          )}
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(import.meta.env.VITE_API_BASE_URL + resultData.downloadUrl)}
          className="flex items-center gap-2 px-4 py-3.5 rounded-xl border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      <p className="text-xs text-[#86868B] text-center mt-4">
        Download link expires in 1 hour. Save your clip now.
      </p>
    </div>
  )
}
