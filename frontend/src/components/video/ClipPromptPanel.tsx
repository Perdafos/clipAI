import { useState, useRef } from 'react'
import { Sparkles, ClipboardPaste, X, Lightbulb, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface ClipPromptPanelProps {
  onPromptChange: (text: string) => void
  prompt: string
}

const EXAMPLES = [
  {
    label: 'NBA Highlights',
    text: `Serangkaian Tantangan (0:50 - 12:23): Kedua tim bersaing dalam empat tantangan basket.
Main Game (12:23 - 35:41): Pertandingan utama berlangsung sengit.
Momen Penting (14:05 - 14:18): Dunk spektakuler dari pemain no.23.
Ankle Breaker (22:10 - 22:24): Crossover yang membuat defender terjatuh.
Penutup (35:41 - 38:00): Highlight dan reaksi pemain.`,
  },
  {
    label: 'YouTube Chapters',
    text: `Intro (0:00 - 1:30)
Challenge Part 1 (1:30 - 8:45)
Epic Moment (8:45 - 9:10)
Final Game (9:10 - 20:00)
Outro (20:00 - 22:30)`,
  },
  {
    label: 'Manual Timestamps',
    text: `Cut from 0:30 to 1:15 - Opening hook
Cut from 3:20 to 4:05 - Key demonstration  
Cut from 8:50 to 9:30 - Best moment
Cut from 15:00 to 16:20 - Climax`,
  },
]

export function ClipPromptPanel({ onPromptChange, prompt }: ClipPromptPanelProps) {
  const [showExamples, setShowExamples] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      onPromptChange(text)
      textareaRef.current?.focus()
    } catch {
      textareaRef.current?.focus()
    }
  }

  const handleExample = (text: string) => {
    onPromptChange(text)
    setShowExamples(false)
  }

  // Count detected timestamps from the text
  const timestampCount = (prompt.match(/\d+:\d{2}/g) || []).length / 2

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div>
          <h2 className="font-semibold text-sm text-white">Prompt Pemotongan</h2>
          <p className="text-xs text-slate-500">Tempel ringkasan video, AI akan memotong sesuai timestamp</p>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={`Tempel ringkasan dari Gemini/YouTube di sini...\n\nContoh:\nSerangkaian Tantangan (0:50 - 12:23): Kedua tim bersaing...\nMomen Penting (14:05 - 14:18): Dunk spektakuler...\nAkhir Pertandingan (35:41 - 38:00): Highlight pemain...`}
          className="w-full h-44 bg-[#0d0d1a] border border-white/8 rounded-xl px-4 py-3.5 text-sm text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 leading-relaxed transition-all font-mono"
          spellCheck={false}
        />

        {/* Clear button */}
        {prompt && (
          <button
            onClick={() => onPromptChange('')}
            className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-white/10 text-slate-600 hover:text-white transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3">
        {/* Paste button */}
        <button
          onClick={handlePaste}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-white/3 hover:bg-white/8 text-slate-400 hover:text-white text-xs font-medium transition-all"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste
        </button>

        {/* Examples dropdown */}
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-white/3 hover:bg-white/8 text-slate-400 hover:text-white text-xs font-medium transition-all"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Contoh
          {showExamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Detected timestamps indicator */}
        {timestampCount > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Clock className="w-3 h-3" />
            {Math.floor(timestampCount)} timestamp terdeteksi
          </div>
        )}

        {!prompt && (
          <p className="ml-auto text-xs text-slate-600">atau biarkan kosong untuk mode AI otomatis</p>
        )}
      </div>

      {/* Examples dropdown */}
      {showExamples && (
        <div className="rounded-xl border border-white/8 bg-[#0d0d1a] divide-y divide-white/5 overflow-hidden">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleExample(ex.text)}
              className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors group"
            >
              <div className="text-xs font-semibold text-violet-400 mb-1 group-hover:text-violet-300">
                {ex.label}
              </div>
              <pre className="text-xs text-slate-600 group-hover:text-slate-500 leading-relaxed whitespace-pre-wrap line-clamp-2">
                {ex.text.split('\n').slice(0, 2).join('\n')}...
              </pre>
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
        <Lightbulb className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="text-blue-400 font-medium">Tips:</span> Buka YouTube → klik ✨ Gemini → "Ringkas video" → salin hasil ringkasannya dan tempel di sini. AI akan otomatis membaca menit-menitnya.
        </p>
      </div>
    </div>
  )
}
