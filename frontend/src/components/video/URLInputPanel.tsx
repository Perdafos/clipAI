import { useState, useEffect } from 'react'
import { Link, Search, Youtube, Instagram } from 'lucide-react'
import { detectPlatform } from '../../types'

interface URLInputPanelProps {
  initialUrl?: string
  onAnalyze: (url: string) => void
  isLoading: boolean
  apiError?: string
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  youtube: <Youtube className="w-4 h-4 text-[#FF0000]" />,
  tiktok: <span className="text-xs font-bold text-[#1D1D1F]">TT</span>,
  instagram: <Instagram className="w-4 h-4 text-[#E4405F]" />,
}

export function URLInputPanel({ initialUrl = '', onAnalyze, isLoading, apiError }: URLInputPanelProps) {
  const [url, setUrl] = useState(initialUrl)
  const [platform, setPlatform] = useState<string | null>(null)
  const [localError, setLocalError] = useState('')

  const error = localError || apiError

  useEffect(() => {
    if (url) {
      const p = detectPlatform(url.trim())
      setPlatform(p)
    } else {
      setPlatform(null)
    }
  }, [url])

  const handleAnalyze = () => {
    if (!url.trim()) { setLocalError('Please enter a URL'); return }
    if (!platform) { setLocalError('Only YouTube, TikTok, and Instagram are supported'); return }
    setLocalError('')
    onAnalyze(url.trim())
  }

  return (
    <div className="apple-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Link className="w-4 h-4 text-[#0071E3]" />
        <h2 className="font-semibold text-sm text-[#1D1D1F]">Video URL</h2>
      </div>

      <div className={`flex gap-2 p-1.5 rounded-xl border transition-all bg-white ${
        error ? 'border-[#FF3B30]/50' : 'border-[#D2D2D7] focus-within:border-[#0071E3] focus-within:shadow-[0_0_0_3px_rgba(0,113,227,0.12)]'
      }`}>
        <div className="flex items-center pl-2">
          {platform ? PLATFORM_ICONS[platform] : <Search className="w-4 h-4 text-[#86868B]" />}
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setLocalError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder="Paste YouTube, TikTok, or Instagram URL..."
          className="flex-1 bg-transparent text-[#1D1D1F] placeholder:text-[#86868B] py-2 px-1 outline-none text-sm"
        />
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0068D1] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors whitespace-nowrap"
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Fetching...
            </span>
          ) : 'Analyze'}
        </button>
      </div>

      {error && <p className="text-xs text-[#FF3B30] mt-2 pl-1">{error}</p>}

      {platform && !error && (
        <p className="text-xs text-[#34C759] mt-2 pl-1">
          ✓ {platform.charAt(0).toUpperCase() + platform.slice(1)} URL detected
        </p>
      )}
    </div>
  )
}
