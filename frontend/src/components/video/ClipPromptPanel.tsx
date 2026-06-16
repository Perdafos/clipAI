import { useState, useRef } from 'react'
import { Sparkles, ClipboardPaste, X, Lightbulb, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface ClipPromptPanelProps {
  onPromptChange: (text: string) => void
  prompt: string
}

const EXAMPLES = [
  {
    label: 'NBA Highlights',
    text: `Serangkaian Tantangan (0:50 - 12:23): Kedua tim bersaing dalam empat tantangan basket.\nMain Game (12:23 - 35:41): Pertandingan utama berlangsung sengit.\nMomen Penting (14:05 - 14:18): Dunk spektakuler dari pemain no.23.\nAnkle Breaker (22:10 - 22:24): Crossover yang membuat defender terjatuh.\nPenutup (35:41 - 38:00): Highlight dan reaksi pemain.`,
  },
  {
    label: 'YouTube Chapters',
    text: `Intro (0:00 - 1:30)\nChallenge Part 1 (1:30 - 8:45)\nEpic Moment (8:45 - 9:10)\nFinal Game (9:10 - 20:00)\nOutro (20:00 - 22:30)`,
  },
  {
    label: 'Manual Timestamps',
    text: `Cut from 0:30 to 1:15 - Opening hook\nCut from 3:20 to 4:05 - Key demonstration\nCut from 8:50 to 9:30 - Best moment\nCut from 15:00 to 16:20 - Climax`,
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

  const timestampCount = (prompt.match(/\d+:\d{2}/g) || []).length / 2

  return (
    <div className="apple-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#0071E3]/10 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
        </div>
        <div>
          <h2 className="font-semibold text-sm text-[#1D1D1F]">Prompt Pemotongan</h2>
          <p className="text-xs text-[#6E6E73]">Tempel ringkasan video, AI akan memotong sesuai timestamp</p>
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={`Tempel ringkasan dari Gemini/YouTube di sini...\n\nContoh:\nSerangkaian Tantangan (0:50 - 12:23): Kedua tim bersaing...\nMomen Penting (14:05 - 14:18): Dunk spektakuler...\nAkhir Pertandingan (35:41 - 38:00): Highlight pemain...`}
          className="w-full h-44 bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-4 py-3.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] resize-none focus:outline-none focus:border-[#0071E3] focus:shadow-[0_0_0_3px_rgba(0,113,227,0.12)] leading-relaxed transition-all font-mono"
          spellCheck={false}
        />
        {prompt && (
          <button
            onClick={() => onPromptChange('')}
            className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handlePaste}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] text-xs font-medium transition-all"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste
        </button>
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] text-xs font-medium transition-all"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Contoh
          {showExamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {timestampCount > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] text-xs font-medium">
            <Clock className="w-3 h-3" />
            {Math.floor(timestampCount)} timestamp terdeteksi
          </div>
        )}
        {!prompt && (
          <p className="ml-auto text-xs text-[#86868B]">atau biarkan kosong untuk mode AI otomatis</p>
        )}
      </div>

      {showExamples && (
        <div className="rounded-xl border border-[#D2D2D7] bg-white divide-y divide-black/[0.04] overflow-hidden">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleExample(ex.text)}
              className="w-full text-left px-4 py-3 hover:bg-[#F5F5F7] transition-colors group"
            >
              <div className="text-xs font-semibold text-[#0071E3] mb-1 group-hover:text-[#0077ED]">
                {ex.label}
              </div>
              <pre className="text-xs text-[#86868B] group-hover:text-[#6E6E73] leading-relaxed whitespace-pre-wrap line-clamp-2">
                {ex.text.split('\n').slice(0, 2).join('\n')}...
              </pre>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#0071E3]/5 border border-[#0071E3]/10">
        <Lightbulb className="w-3.5 h-3.5 text-[#0071E3] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#6E6E73] leading-relaxed">
          <span className="text-[#0071E3] font-medium">Tips:</span> Buka YouTube → klik ✨ Gemini → "Ringkas video" → salin hasil ringkasannya dan tempel di sini. AI akan otomatis membaca menit-menitnya.
        </p>
      </div>
    </div>
  )
}
