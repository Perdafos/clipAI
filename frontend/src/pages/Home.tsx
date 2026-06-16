import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Music, Download, Youtube, Instagram } from 'lucide-react'
import { detectPlatform } from '../types'
import { useVideoStore } from '../stores'

export function Home() {
  const navigate = useNavigate()
  const { setUrl, setPlatform } = useVideoStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed) { setError('Please paste a video URL'); return }
    const platform = detectPlatform(trimmed)
    if (!platform) { setError('Please use a YouTube, TikTok, or Instagram URL'); return }
    setUrl(trimmed)
    setPlatform(platform)
    navigate('/studio')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F]">
      {/* Header */}
      <header className="apple-blur sticky top-0 z-20 border-b border-black/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0071E3] to-[#5856D6] flex items-center justify-center shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">ClipAI</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6E6E73]">
            <Sparkles className="w-3 h-3 text-[#0071E3]" />
            <span>AI-powered</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="px-6 pt-20 pb-32 text-center max-w-2xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F5F7] text-[#6E6E73] text-xs font-medium mb-8 border border-black/[0.04]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
          8 AI Models · Smart Music
        </div>

        {/* Headline */}
        <h1 className="text-[40px] sm:text-[56px] font-bold tracking-tight leading-[1.05] mb-5 text-[#1D1D1F]">
          Paste a link.
          <br />
          <span className="bg-gradient-to-r from-[#0071E3] to-[#5856D6] bg-clip-text text-transparent">
            Get a viral clip.
          </span>
        </h1>

        <p className="text-lg text-[#6E6E73] max-w-md mx-auto mb-10 leading-relaxed font-normal">
          Drop any YouTube, TikTok, or Instagram video. AI analyzes every scene, selects the best moments, adds music, and exports a ready-to-share clip.
        </p>

        {/* URL Input */}
        <div className="w-full max-w-xl mx-auto">
          <div className={`flex gap-2 p-1.5 rounded-2xl border transition-all duration-200 bg-white ${
            error
              ? 'border-[#FF3B30]/50 shadow-sm shadow-[#FF3B30]/5'
              : 'border-[#D2D2D7] shadow-sm hover:shadow-md focus-within:border-[#0071E3] focus-within:shadow-[0_0_0_3px_rgba(0,113,227,0.12)]'
          }`}>
            <input
              type="url"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube, TikTok, or Instagram URL..."
              className="flex-1 bg-transparent text-[#1D1D1F] placeholder:text-[#86868B] px-4 py-3.5 outline-none text-base"
              autoFocus
            />
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0068D1] text-white font-medium rounded-xl transition-all text-sm whitespace-nowrap shadow-sm"
            >
              Generate Clip
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-[#FF3B30] text-left pl-2">{error}</p>}

          {/* Platform chips */}
          <div className="flex items-center justify-center gap-4 mt-4">
            {[
              { icon: Youtube, label: 'YouTube', color: 'text-[#FF0000]' },
              { icon: () => <span className="text-xs font-bold">TT</span>, label: 'TikTok', color: 'text-[#1D1D1F]' },
              { icon: Instagram, label: 'Instagram', color: 'text-[#E4405F]' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className={`flex items-center gap-1 text-xs ${color} opacity-50`}>
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-20 w-full max-w-2xl mx-auto">
          {[
            {
              icon: Sparkles,
              title: 'AI Scene Detection',
              desc: 'Identifies engaging moments using 8 specialized models',
              color: 'from-blue-50 to-blue-50/30',
              iconBg: 'bg-[#0071E3]',
              iconColor: 'text-white',
            },
            {
              icon: Music,
              title: 'Smart Music Match',
              desc: 'AI picks music that matches your video mood and energy',
              color: 'from-indigo-50 to-indigo-50/30',
              iconBg: 'bg-[#5856D6]',
              iconColor: 'text-white',
            },
            {
              icon: Download,
              title: 'Instant Export',
              desc: 'Download your clip in HD, ready for any social platform',
              color: 'from-emerald-50 to-emerald-50/30',
              iconBg: 'bg-[#34C759]',
              iconColor: 'text-white',
            },
          ].map(({ icon: Icon, title, desc, color, iconBg, iconColor }) => (
            <div key={title} className={`p-5 rounded-2xl bg-gradient-to-b ${color} border border-black/[0.04] text-left`}>
              <div className={`w-9 h-9 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center mb-3 shadow-sm`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#1D1D1F] mb-1 text-sm">{title}</h3>
              <p className="text-xs text-[#6E6E73] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pb-8 text-xs text-[#86868B] border-t border-black/[0.06] pt-6">
        © 2026 Perdafos. All rights reserved.
      </footer>
    </div>
  )
}
