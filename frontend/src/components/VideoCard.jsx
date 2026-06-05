import React, { useState } from 'react';
import {
  Eye, ThumbsUp, MessageCircle, Clock, Calendar,
  User, Hash, TrendingUp, Play, AlertCircle, ExternalLink
} from 'lucide-react';

const PLATFORM_CONFIG = {
  youtube: {
    label: 'YouTube',
    color: 'badge-youtube',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-red-500">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    color: 'badge-instagram',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-pink-400">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
};

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function VideoCardSkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="shimmer rounded-xl h-48 mb-4" />
      <div className="shimmer h-5 rounded mb-2 w-3/4" />
      <div className="shimmer h-4 rounded mb-4 w-1/2" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function VideoCard({ video, label, loading }) {
  const [imgError, setImgError] = useState(false);

  if (loading) return <VideoCardSkeleton />;

  if (!video) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center gap-3 min-h-64">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
          <Play className="w-7 h-7 text-slate-500" />
        </div>
        <p className="text-slate-500 text-sm">
          Enter a {label === 'A' ? 'YouTube' : 'Instagram'} URL to analyze
        </p>
      </div>
    );
  }

  const platform = PLATFORM_CONFIG[video.platform] || PLATFORM_CONFIG.youtube;
  const PlatformIcon = platform.icon;

  const engRate = parseFloat(video.engagementRate ?? 0);
  const engColor =
    engRate >= 5 ? 'text-emerald-400' : engRate >= 2 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="glass-card overflow-hidden animate-fade-in-up group">
      {/* ── Label Badge ── */}
      <div className="relative">
        <div className="absolute top-3 left-3 z-10">
          <div className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider"
            style={{
              background: label === 'A'
                ? 'linear-gradient(135deg, rgba(59,84,251,0.8), rgba(139,92,246,0.8))'
                : 'linear-gradient(135deg, rgba(225,48,108,0.8), rgba(244,114,182,0.8))',
            }}>
            VIDEO {label}
          </div>
        </div>
        <div className="absolute top-3 right-3 z-10">
          <div className={`badge ${platform.color} flex items-center gap-1.5`}>
            <PlatformIcon />
            <span>{platform.label}</span>
          </div>
        </div>

        {/* Thumbnail */}
        {video.thumbnailUrl && !imgError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-44 object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-44 flex items-center justify-center"
            style={{
              background: label === 'A'
                ? 'linear-gradient(135deg, #1a1f4e, #2d1b69)'
                : 'linear-gradient(135deg, #4a0e2e, #2d0e4a)',
            }}
          >
            <Play className="w-12 h-12 text-white/20" />
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="p-5">
        {/* Title */}
        <h3 className="font-bold text-white text-base leading-snug mb-1 line-clamp-2">
          {video.title || 'Untitled'}
        </h3>

        {/* Creator */}
        <div className="flex items-center gap-1.5 mb-4">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 text-sm truncate">{video.creator || 'Unknown'}</span>
          {video.channelUrl && (
            <a href={video.channelUrl} target="_blank" rel="noopener noreferrer"
              className="text-slate-600 hover:text-blue-400 transition-colors">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span className="stat-label">Views</span>
            </div>
            <div className="stat-value text-base">{formatNumber(video.views)}</div>
          </div>

          <div className="bg-white/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="stat-label">Likes</span>
            </div>
            <div className="stat-value text-base">{formatNumber(video.likes)}</div>
          </div>

          <div className="bg-white/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
              <span className="stat-label">Comments</span>
            </div>
            <div className="stat-value text-base">{formatNumber(video.comments)}</div>
          </div>

          <div className="bg-white/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className={`w-3.5 h-3.5 ${engColor}`} />
              <span className="stat-label">Engagement</span>
            </div>
            <div className={`stat-value text-base ${engColor}`}>
              {engRate.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* ── Meta Info ── */}
        <div className="space-y-1.5 mb-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Duration</span>
            </div>
            <span className="text-slate-300 font-mono">{video.durationFormatted || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>Published</span>
            </div>
            <span className="text-slate-300">{video.uploadDate || 'Unknown'}</span>
          </div>
          {video.transcriptAvailable !== undefined && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Play className="w-3.5 h-3.5" />
                <span>Transcript</span>
              </div>
              <span className={`font-medium ${video.transcriptAvailable ? 'text-emerald-400' : 'text-red-400'}`}>
                {video.transcriptAvailable
                  ? `✓ ${video.chunkCount} chunks (${video.transcriptSource})`
                  : '✗ Unavailable'}
              </span>
            </div>
          )}
        </div>

        {/* ── Hashtags ── */}
        {video.hashtags && video.hashtags.length > 0 && (
          <div className="border-t border-white/[0.06] pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Hashtags</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {video.hashtags.slice(0, 8).map((tag, i) => (
                <span key={i} className="badge text-xs">
                  {tag}
                </span>
              ))}
              {video.hashtags.length > 8 && (
                <span className="badge text-xs text-slate-500">
                  +{video.hashtags.length - 8}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Error Notice ── */}
        {video.error && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{video.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
