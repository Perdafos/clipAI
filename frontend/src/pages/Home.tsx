import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors, Sparkles, Music, Download, Zap, ChevronRight, Youtube, Instagram } from 'lucide-react'
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
    <div className="min-h-screen bg-[#0F0F1A] text-white overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-cyan-500/8 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">ClipAI</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span>Powered by 9router AI</span>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 pb-32 text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          <span>8 AI Models · Auto Clip · Smart Music</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-6">
          Paste a link.
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Get a viral clip.
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mb-12 leading-relaxed">
          Drop any YouTube, TikTok, or Instagram video. Our AI analyzes every scene,
          selects the best moments, adds the perfect music, and exports a ready-to-share clip.
        </p>

        {/* URL Input */}
        <div className="w-full max-w-2xl">
          <div className={`flex gap-2 p-2 rounded-2xl border transition-all duration-200 ${
            error
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-white/10 bg-white/5 focus-within:border-violet-500/50 focus-within:bg-violet-500/5'
          }`}>
            <input
              type="url"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube, TikTok, or Instagram URL..."
              className="flex-1 bg-transparent text-white placeholder:text-slate-500 px-4 py-3 outline-none text-base"
              autoFocus
            />
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold rounded-xl transition-all duration-200 text-sm whitespace-nowrap shadow-lg shadow-violet-500/25"
            >
              Generate Clip
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-400 text-left pl-2">{error}</p>}

          {/* Platform chips */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {[
              { icon: Youtube, label: 'YouTube', color: 'text-red-400' },
              { icon: () => <span className="text-base">TT</span>, label: 'TikTok', color: 'text-slate-300' },
              { icon: Instagram, label: 'Instagram', color: 'text-pink-400' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className={`flex items-center gap-1.5 text-xs ${color} opacity-60`}>
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20 w-full max-w-3xl">
          {[
            {
              icon: Sparkles,
              title: 'AI Scene Detection',
              desc: 'Identifies the most engaging moments using 8 specialized AI models',
              color: 'from-violet-500/20 to-violet-500/5',
              iconColor: 'text-violet-400',
            },
            {
              icon: Music,
              title: 'Smart Music Match',
              desc: 'AI picks music that perfectly matches your video mood and energy',
              color: 'from-cyan-500/20 to-cyan-500/5',
              iconColor: 'text-cyan-400',
            },
            {
              icon: Download,
              title: 'Instant Export',
              desc: 'Download your clip in HD MP4, ready for any social platform',
              color: 'from-emerald-500/20 to-emerald-500/5',
              iconColor: 'text-emerald-400',
            },
          ].map(({ icon: Icon, title, desc, color, iconColor }) => (
            <div key={title} className={`p-5 rounded-2xl bg-gradient-to-b ${color} border border-white/5 text-left`}>
              <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center mb-3 ${iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white mb-1 text-sm">{title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-6 text-xs text-slate-600">
        © 2026 Perdafos. All rights reserved.
      </footer>
    </div>
  )
}
