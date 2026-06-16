import { Settings2, Captions, Smartphone, Square, Tv } from 'lucide-react'
import { useClipStore } from '../../stores'

const DURATIONS = [
  { value: 30, label: '30s', desc: 'Quick, punchy' },
  { value: 60, label: '1 min', desc: 'Balanced' },
  { value: 90, label: '90s', desc: 'Full story' },
] as const

const QUALITIES = [
  { value: 'low', label: '720p', desc: 'Fast export' },
  { value: 'medium', label: '1080p', desc: 'Balanced' },
  { value: 'high', label: '4K', desc: 'Best quality' },
] as const

const ASPECT_RATIOS = [
  { value: '9:16', label: '9:16 Vertical', desc: 'TikTok, Reels, Shorts', icon: Smartphone },
  { value: '1:1', label: '1:1 Square', desc: 'Instagram Feed', icon: Square },
  { value: '16:9', label: '16:9 Landscape', desc: 'YouTube, standard', icon: Tv },
] as const

export function ClipConfigPanel() {
  const { config, setConfig } = useClipStore()

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="w-4 h-4 text-violet-400" />
        <h2 className="font-semibold text-sm">Clip Settings</h2>
      </div>

      {/* Duration */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-2 block">Target Duration</label>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setConfig({ targetDuration: value })}
              className={`p-3 rounded-xl border text-left transition-all ${
                config.targetDuration === value
                  ? 'border-violet-500/60 bg-violet-500/15 text-white'
                  : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/15'
              }`}
            >
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs opacity-60 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-2 block">Aspect Ratio</label>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map(({ value, label, desc, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setConfig({ aspectRatio: value })}
              className={`p-3 rounded-xl border text-left transition-all ${
                config.aspectRatio === value
                  ? 'border-violet-500/60 bg-violet-500/15 text-white'
                  : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/15'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <Icon className={`w-3.5 h-3.5 ${config.aspectRatio === value ? 'text-violet-400' : 'text-slate-500'}`} />
                <span>{label}</span>
              </div>
              <div className="text-[10px] opacity-60 mt-1 leading-tight">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-2 block">Output Quality</label>
        <div className="grid grid-cols-3 gap-2">
          {QUALITIES.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setConfig({ quality: value })}
              className={`p-3 rounded-xl border text-left transition-all ${
                config.quality === value
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-white'
                  : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/15'
              }`}
            >
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs opacity-60 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Captions */}
      <button
        onClick={() => setConfig({ addCaptions: !config.addCaptions })}
        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
          config.addCaptions
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-white/8 bg-white/3'
        }`}
      >
        <div className="flex items-center gap-2 text-sm">
          <Captions className={`w-4 h-4 ${config.addCaptions ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span className={config.addCaptions ? 'text-white' : 'text-slate-400'}>
            Auto-generate captions
          </span>
        </div>
        <div className={`w-9 h-5 rounded-full transition-all flex items-center ${
          config.addCaptions ? 'bg-emerald-500 justify-end' : 'bg-white/10 justify-start'
        } px-0.5`}>
          <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
        </div>
      </button>
    </div>
  )
}
