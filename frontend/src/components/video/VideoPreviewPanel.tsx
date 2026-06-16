import { Clock, Eye, ThumbsUp, User } from 'lucide-react'
import type { VideoMetadata } from '../../types'
import { formatDuration } from '../../types'

interface VideoPreviewPanelProps {
  metadata: VideoMetadata
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'bg-[#FF0000]/10 text-[#FF0000]',
  tiktok: 'bg-black/5 text-[#1D1D1F]',
  instagram: 'bg-[#E4405F]/10 text-[#E4405F]',
}

function formatCount(n?: number): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function VideoPreviewPanel({ metadata }: VideoPreviewPanelProps) {
  return (
    <div className="apple-card overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[#F5F5F7]">
        {metadata.thumbnail ? (
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#86868B]">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-[#1D1D1F] text-xs font-mono font-medium shadow-sm">
          {formatDuration(metadata.duration)}
        </div>
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-lg text-xs font-medium capitalize shadow-sm ${PLATFORM_COLORS[metadata.platform]}`}>
          {metadata.platform}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-3 text-[#1D1D1F]">{metadata.title}</h3>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#86868B]">
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
          <p className="mt-3 text-xs text-[#86868B] line-clamp-2 leading-relaxed">
            {metadata.description}
          </p>
        )}
      </div>
    </div>
  )
}
