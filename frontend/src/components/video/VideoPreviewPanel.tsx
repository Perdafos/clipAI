import { Clock, Eye, ThumbsUp, User } from 'lucide-react'
import type { VideoMetadata } from '../../types'
import { formatDuration } from '../../types'

interface VideoPreviewPanelProps {
  metadata: VideoMetadata
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'bg-red-500/20 text-red-300 border-red-500/20',
  tiktok: 'bg-slate-500/20 text-slate-300 border-slate-500/20',
  instagram: 'bg-pink-500/20 text-pink-300 border-pink-500/20',
}

function formatCount(n?: number): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function VideoPreviewPanel({ metadata }: VideoPreviewPanelProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[#1A1A2E]">
        {metadata.thumbnail ? (
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        {/* Duration badge */}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/80 text-white text-xs font-mono font-medium">
          {formatDuration(metadata.duration)}
        </div>
        {/* Platform badge */}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-lg border text-xs font-medium capitalize ${PLATFORM_COLORS[metadata.platform]}`}>
          {metadata.platform}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-3">{metadata.title}</h3>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {metadata.uploader}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(metadata.duration)}
          </span>
          {metadata.viewCount && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatCount(metadata.viewCount)}
            </span>
          )}
          {metadata.likeCount && (
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {formatCount(metadata.likeCount)}
            </span>
          )}
        </div>

        {metadata.description && (
          <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {metadata.description}
          </p>
        )}
      </div>
    </div>
  )
}
