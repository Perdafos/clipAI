import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Scissors, CheckCircle2, Clock } from 'lucide-react'
import { useVideoStore, useClipStore, useMusicStore } from '../stores'
import { analyzeVideoUrl, startVideoProcess } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { URLInputPanel } from '../components/video/URLInputPanel'
import { VideoPreviewPanel } from '../components/video/VideoPreviewPanel'
import { MusicPanel } from '../components/music/MusicPanel'
import { ClipConfigPanel } from '../components/video/ClipConfigPanel'
import { ClipPromptPanel } from '../components/video/ClipPromptPanel'
import { ProcessingPanel } from '../components/processing/ProcessingPanel'
import { VideoEditorPanel } from '../components/video/VideoEditorPanel'
import { detectPlatform } from '../types'

export function Studio() {
  const navigate = useNavigate()

  // Selective subscriptions — avoid full-store destructure
  const url = useVideoStore(s => s.url)
  const analyzeStatus = useVideoStore(s => s.analyzeStatus)
  const analyzeError = useVideoStore(s => s.analyzeError)
  const metadata = useVideoStore(s => s.metadata)
  const jobId = useVideoStore(s => s.jobId)
  const processingStage = useClipStore(s => s.processingStage)
  const processingError = useClipStore(s => s.processingError)
  const resultData = useClipStore(s => s.resultData)
  const setUrl = useVideoStore(s => s.setUrl)
  const setPlatform = useVideoStore(s => s.setPlatform)
  const setAnalyzeStatus = useVideoStore(s => s.setAnalyzeStatus)
  const setMetadata = useVideoStore(s => s.setMetadata)
  const setJob = useVideoStore(s => s.setJob)
  const resetProcessing = useClipStore(s => s.resetProcessing)
  const setError = useClipStore(s => s.setError)

  const [isStarting, setIsStarting] = useState(false)
  const [clipPrompt, setClipPrompt] = useState('')

  // Connect WebSocket once we have a jobId
  useWebSocket(jobId)

  // Auto-analyze URL if coming from home page
  useEffect(() => {
    if (url && analyzeStatus === 'idle') {
      handleAnalyze(url)
    }
  }, [])

  const handleAnalyze = async (url: string) => {
    const platform = detectPlatform(url)
    if (!platform) return

    setUrl(url)
    setPlatform(platform)
    setAnalyzeStatus('loading')
    resetProcessing()

    try {
      const m = await analyzeVideoUrl(url)
      setMetadata(m)
      setAnalyzeStatus('success')
    } catch (err: unknown) {
      setAnalyzeStatus('error', (err as Error).message)
    }
  }

  const handleStartProcessing = async () => {
    if (!url || !metadata) return
    setIsStarting(true)

    try {
      const { jobId: jid, wsUrl: wsu } = await startVideoProcess(
        url,
        useClipStore.getState().config,
        useMusicStore.getState().getMusicSelection(),
        clipPrompt.trim() || undefined
      )
      setJob(jid, wsu)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setIsStarting(false)
    }
  }

  const isProcessing = jobId !== null && processingStage !== 'complete' && processingStage !== 'error'
  const isComplete = processingStage === 'complete' && resultData !== null

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[300px] bg-violet-600/8 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0F0F1A]/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Scissors className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm">ClipAI Studio</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {isProcessing && <span className="text-violet-400 animate-pulse">● Processing...</span>}
          {isComplete && <span className="text-emerald-400">● Clip Ready</span>}
        </div>
      </header>

      <div className="relative z-10 h-[calc(100vh-49px)] flex flex-col">
        {/* ── COMPLETE: CapCut Editor Layout ─────────────────────── */}
        {isComplete && resultData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Main content: preview left + properties right */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left: Video Preview */}
                  <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
                    <div className="max-w-4xl mx-auto">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white">Clip Ready</h2>
                          <p className="text-xs text-slate-500">Preview and edit your highlight</p>
                        </div>
                        <button
                          onClick={() => { resetProcessing(); setJob('', '') }}
                          className="ml-auto flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                        >
                          <Scissors className="w-3 h-3" />
                          New clip
                        </button>
                      </div>
                      <VideoEditorPanel
                        resultData={resultData}
                        videoTitle={metadata?.title}
                        videoDuration={resultData.duration}
                      />
                    </div>
                  </div>

                  {/* Right: Properties Panel */}
                  <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-white/6 bg-[#0d0d1a]/80 overflow-y-auto p-4 space-y-4">
                    {/* Duration & quality stats in properties */}
                    <div className="rounded-xl border border-white/6 bg-white/3 p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Properties</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Duration</span>
                          <span className="text-white font-mono tabular-nums">
                            {Math.floor(resultData.duration / 60)}:{(resultData.duration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Quality Score</span>
                          <span className="text-amber-400 font-semibold">{Math.round(resultData.qualityScore * 100)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">File Size</span>
                          <span className="text-white font-mono tabular-nums">
                            {resultData.fileSize < 1024 * 1024
                              ? `${(resultData.fileSize / 1024).toFixed(1)} KB`
                              : `${(resultData.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Clip Settings */}
                    <ClipConfigPanel />

                    {/* Original Video Info */}
                    {metadata && (
                      <div className="rounded-xl border border-white/6 bg-white/3 p-4">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Original Video</h3>
                        <div className="space-y-2 text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {Math.floor(metadata.duration / 60)}:{(metadata.duration % 60).toString().padStart(2, '0')} min
                          </div>
                          <p className="line-clamp-1">{metadata.title}</p>
                          <p className="line-clamp-1 text-slate-500">{metadata.uploader}</p>
                        </div>
                      </div>
                    )}
                  </div>
            </div>
          </div>
        )}

        {/* ── PROCESSING ───────────────────────────────────────── */}
        {isProcessing && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
              <ProcessingPanel />
            </div>
          </div>
        )}

        {/* Main Studio Layout (pre-processing) */}
        {!isProcessing && !isComplete && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left Column: URL + Preview + Config */}
              <div className="lg:col-span-3 space-y-6">
                <URLInputPanel
                  initialUrl={url}
                  onAnalyze={handleAnalyze}
                  isLoading={analyzeStatus === 'loading'}
                  apiError={analyzeError || undefined}
                />

                {metadata && (
                  <VideoPreviewPanel metadata={metadata} />
                )}

                {metadata && (
                  <ClipConfigPanel />
                )}

                {metadata && (
                  <ClipPromptPanel
                    prompt={clipPrompt}
                    onPromptChange={setClipPrompt}
                  />
                )}
              </div>

              {/* Right Column: Music */}
              <div className="lg:col-span-2">
                {metadata ? (
                  <MusicPanel
                    videoMetadata={metadata}
                    onStartProcessing={handleStartProcessing}
                    isStarting={isStarting}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/2 p-8 text-center text-slate-500">
                    <p className="text-sm">Paste a video URL to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {processingStage === 'error' && processingError && (
          <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 max-w-lg mx-auto">
            <p className="font-medium text-sm">Processing failed</p>
            <p className="text-xs mt-1 text-red-400">{processingError}</p>
            <button
              onClick={() => { resetProcessing(); setJob('', '') }}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
