import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Scissors, CheckCircle2 } from 'lucide-react'
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
  const videoStore = useVideoStore()
  const clipStore = useClipStore()
  const musicStore = useMusicStore()
  const [isStarting, setIsStarting] = useState(false)
  const [clipPrompt, setClipPrompt] = useState('')

  // Connect WebSocket once we have a jobId
  useWebSocket(videoStore.jobId)

  // Auto-analyze URL if coming from home page
  useEffect(() => {
    if (videoStore.url && videoStore.analyzeStatus === 'idle') {
      handleAnalyze(videoStore.url)
    }
  }, [])

  const handleAnalyze = async (url: string) => {
    const platform = detectPlatform(url)
    if (!platform) return

    videoStore.setUrl(url)
    videoStore.setPlatform(platform)
    videoStore.setAnalyzeStatus('loading')
    clipStore.resetProcessing()

    try {
      const metadata = await analyzeVideoUrl(url)
      videoStore.setMetadata(metadata)
      videoStore.setAnalyzeStatus('success')
    } catch (err: unknown) {
      videoStore.setAnalyzeStatus('error', (err as Error).message)
    }
  }

  const handleStartProcessing = async () => {
    if (!videoStore.url || !videoStore.metadata) return
    setIsStarting(true)

    try {
      const { jobId, wsUrl } = await startVideoProcess(
        videoStore.url,
        clipStore.config,
        musicStore.getMusicSelection(),
        clipPrompt.trim() || undefined
      )
      videoStore.setJob(jobId, wsUrl)
    } catch (err: unknown) {
      clipStore.setError((err as Error).message)
    } finally {
      setIsStarting(false)
    }
  }

  const isProcessing = videoStore.jobId !== null && clipStore.processingStage !== 'complete' && clipStore.processingStage !== 'error'
  const isComplete = clipStore.processingStage === 'complete' && clipStore.resultData !== null

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[300px] bg-violet-600/8 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0F0F1A]/80 backdrop-blur-md sticky top-0">
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
        <div className="text-xs text-slate-500">
          {isProcessing && <span className="text-violet-400 animate-pulse">● Processing...</span>}
          {isComplete && <span className="text-emerald-400">● Clip Ready</span>}
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

        {/* ── COMPLETE: Video Editor Layout ───────────────────── */}
        {isComplete && clipStore.resultData && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main editor — takes 2/3 width */}
            <div className="xl:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Clip Ready! 🎬</h2>
                  <p className="text-xs text-slate-500">Preview, trim, and download your AI highlight</p>
                </div>
                <button
                  onClick={() => { clipStore.resetProcessing(); videoStore.setJob('', '') }}
                  className="ml-auto flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                >
                  <Scissors className="w-3 h-3" />
                  New clip
                </button>
              </div>
              <VideoEditorPanel
                resultData={clipStore.resultData}
                videoTitle={videoStore.metadata?.title}
                videoDuration={clipStore.resultData.duration}
              />
            </div>

            {/* Right sidebar — video info */}
            <div className="space-y-4">
              {videoStore.metadata && (
                <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Original Video</h3>
                  <VideoPreviewPanel metadata={videoStore.metadata} />
                </div>
              )}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Create Another</h3>
                <URLInputPanel
                  initialUrl=""
                  onAnalyze={(url) => { clipStore.resetProcessing(); videoStore.setJob('', ''); handleAnalyze(url) }}
                  isLoading={videoStore.analyzeStatus === 'loading'}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── PROCESSING ───────────────────────────────────────── */}
        {isProcessing && (
          <div className="mb-8">
            <ProcessingPanel />
          </div>
        )}

        {/* Main Studio Layout */}
        {!isProcessing && !isComplete && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column: URL + Video Preview */}
            <div className="lg:col-span-3 space-y-6">
              <URLInputPanel
                initialUrl={videoStore.url}
                onAnalyze={handleAnalyze}
                isLoading={videoStore.analyzeStatus === 'loading'}
                apiError={videoStore.analyzeError || undefined}
              />

              {videoStore.metadata && (
                <VideoPreviewPanel metadata={videoStore.metadata} />
              )}

              {videoStore.metadata && (
                <ClipConfigPanel />
              )}

              {videoStore.metadata && (
                <ClipPromptPanel
                  prompt={clipPrompt}
                  onPromptChange={setClipPrompt}
                />
              )}
            </div>

            {/* Right Column: Music */}
            <div className="lg:col-span-2">
              {videoStore.metadata ? (
                <MusicPanel
                  videoMetadata={videoStore.metadata}
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
        )}

        {/* Error State */}
        {clipStore.processingStage === 'error' && clipStore.processingError && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
            <p className="font-medium text-sm">Processing failed</p>
            <p className="text-xs mt-1 text-red-400">{clipStore.processingError}</p>
            <button
              onClick={() => { clipStore.resetProcessing(); videoStore.setJob('', '') }}
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
