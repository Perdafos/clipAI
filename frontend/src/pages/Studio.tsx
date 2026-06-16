import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
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

  // Selective subscriptions
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
    <div className="min-h-screen bg-white text-[#1D1D1F] antialiased">
      {/* Header */}
      <header className="apple-blur sticky top-0 z-20 border-b border-black/[0.06]">
        <div className="flex items-center justify-between px-6 h-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-[#86868B] hover:text-[#1D1D1F] transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="w-px h-4 bg-black/[0.08]" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0071E3] to-[#5856D6] flex items-center justify-center shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>
                </svg>
              </div>
              <span className="font-semibold text-sm">Studio</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#86868B]">
            {isProcessing && <span className="text-[#0071E3] font-medium">● Processing...</span>}
            {isComplete && <span className="text-[#34C759] font-medium">● Clip Ready</span>}
          </div>
        </div>
      </header>

      <div className="relative h-[calc(100vh-48px)] flex flex-col">
        {/* ── COMPLETE: Editor Layout ──────────────────────────────── */}
        {isComplete && resultData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left: Preview */}
              <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#1D1D1F]">Clip Ready</h2>
                      <p className="text-xs text-[#86868B]">Preview and edit your highlight</p>
                    </div>
                    <button
                      onClick={() => { resetProcessing(); setJob('', '') }}
                      className="ml-auto flex items-center gap-1.5 text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors px-3 py-1.5 rounded-lg hover:bg-black/[0.04]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>
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
              {/* Right: Properties */}
              <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-black/[0.06] bg-[#FAFAFA] overflow-y-auto p-4 space-y-4">
                <div className="apple-card p-4">
                  <h3 className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-3">Properties</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6E6E73]">Duration</span>
                      <span className="text-[#1D1D1F] font-mono tabular-nums font-medium">
                        {Math.floor(resultData.duration / 60)}:{(resultData.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6E6E73]">Quality Score</span>
                      <span className="text-[#FF9500] font-semibold">{Math.round(resultData.qualityScore * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6E6E73]">File Size</span>
                      <span className="text-[#1D1D1F] font-mono tabular-nums">
                        {resultData.fileSize < 1024 * 1024
                          ? `${(resultData.fileSize / 1024).toFixed(1)} KB`
                          : `${(resultData.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                    </div>
                  </div>
                </div>
                <ClipConfigPanel />
                {metadata && (
                  <div className="apple-card p-4">
                    <h3 className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-3">Original Video</h3>
                    <div className="space-y-2 text-xs text-[#6E6E73]">
                      <p className="line-clamp-1 text-[#1D1D1F] font-medium">{metadata.title}</p>
                      <p className="text-[#86868B]">{metadata.uploader}</p>
                      <p>{Math.floor(metadata.duration / 60)}:{(metadata.duration % 60).toString().padStart(2, '0')} min</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PROCESSING ────────────────────────────────────────── */}
        {isProcessing && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
              <ProcessingPanel />
            </div>
          </div>
        )}

        {/* ── Main Studio (pre-processing) ──────────────────────── */}
        {!isProcessing && !isComplete && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left: URL + Preview + Config */}
              <div className="lg:col-span-3 space-y-6">
                <URLInputPanel
                  initialUrl={url}
                  onAnalyze={handleAnalyze}
                  isLoading={analyzeStatus === 'loading'}
                  apiError={analyzeError || undefined}
                />
                {metadata && <VideoPreviewPanel metadata={metadata} />}
                {metadata && <ClipConfigPanel />}
                {metadata && (
                  <ClipPromptPanel
                    prompt={clipPrompt}
                    onPromptChange={setClipPrompt}
                  />
                )}
              </div>
              {/* Right: Music */}
              <div className="lg:col-span-2">
                {metadata ? (
                  <MusicPanel
                    videoMetadata={metadata}
                    onStartProcessing={handleStartProcessing}
                    isStarting={isStarting}
                  />
                ) : (
                  <div className="apple-card p-8 text-center text-[#86868B]">
                    <p className="text-sm">Paste a video URL to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {processingStage === 'error' && processingError && (
          <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-[#FF3B30]/5 border border-[#FF3B30]/15 text-[#FF3B30] max-w-lg mx-auto">
            <p className="font-medium text-sm">Processing failed</p>
            <p className="text-xs mt-1 text-[#FF3B30]/70">{processingError}</p>
            <button
              onClick={() => { resetProcessing(); setJob('', '') }}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 transition-colors font-medium"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
