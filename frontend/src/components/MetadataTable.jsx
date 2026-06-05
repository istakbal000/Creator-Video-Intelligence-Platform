/**
 * MetadataTable Component
 * Side-by-side comparison table for both videos.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function formatNumber(num) {
  if (!num && num !== 0) return 'N/A';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function WinnerBadge({ winner }) {
  if (!winner) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold"
      style={{
        background: winner === 'A'
          ? 'rgba(59,84,251,0.2)'
          : 'rgba(225,48,108,0.2)',
        color: winner === 'A' ? '#93adff' : '#f9a8d4',
        border: `1px solid ${winner === 'A' ? 'rgba(59,84,251,0.3)' : 'rgba(225,48,108,0.3)'}`,
      }}
    >
      {winner}
    </span>
  );
}

function CompareCell({ valueA, valueB, format = 'number', higherIsBetter = true }) {
  const a = parseFloat(valueA) || 0;
  const b = parseFloat(valueB) || 0;

  let winner = null;
  if (a !== b) {
    winner = higherIsBetter ? (a > b ? 'A' : 'B') : (a < b ? 'A' : 'B');
  }

  const colorA = winner === 'A' ? 'text-emerald-400' : winner === 'B' ? 'text-slate-400' : 'text-slate-300';
  const colorB = winner === 'B' ? 'text-emerald-400' : winner === 'A' ? 'text-slate-400' : 'text-slate-300';

  const display = format === 'number' ? formatNumber : (v) => String(v);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className={`text-center font-semibold ${colorA}`}>
        {display(valueA)}
        {winner === 'A' && <TrendingUp className="w-3 h-3 inline ml-1 text-emerald-400" />}
      </div>
      <div className={`text-center font-semibold ${colorB}`}>
        {display(valueB)}
        {winner === 'B' && <TrendingUp className="w-3 h-3 inline ml-1 text-emerald-400" />}
      </div>
    </div>
  );
}

export default function MetadataTable({ videoA, videoB }) {
  if (!videoA && !videoB) return null;

  const rows = [
    {
      label: 'Platform',
      a: videoA?.platform?.toUpperCase() || 'N/A',
      b: videoB?.platform?.toUpperCase() || 'N/A',
      format: 'text',
      higherIsBetter: null,
    },
    {
      label: 'Creator',
      a: videoA?.creator || 'N/A',
      b: videoB?.creator || 'N/A',
      format: 'text',
      higherIsBetter: null,
    },
    {
      label: 'Views',
      a: videoA?.views ?? 0,
      b: videoB?.views ?? 0,
      format: 'number',
      higherIsBetter: true,
    },
    {
      label: 'Likes',
      a: videoA?.likes ?? 0,
      b: videoB?.likes ?? 0,
      format: 'number',
      higherIsBetter: true,
    },
    {
      label: 'Comments',
      a: videoA?.comments ?? 0,
      b: videoB?.comments ?? 0,
      format: 'number',
      higherIsBetter: true,
    },
    {
      label: 'Engagement Rate',
      a: videoA?.engagementRate != null ? `${parseFloat(videoA.engagementRate).toFixed(2)}%` : 'N/A',
      b: videoB?.engagementRate != null ? `${parseFloat(videoB.engagementRate).toFixed(2)}%` : 'N/A',
      format: 'percent',
      higherIsBetter: true,
    },
    {
      label: 'Duration',
      a: videoA?.durationFormatted || 'N/A',
      b: videoB?.durationFormatted || 'N/A',
      format: 'text',
      higherIsBetter: null,
    },
    {
      label: 'Upload Date',
      a: videoA?.uploadDate || 'N/A',
      b: videoB?.uploadDate || 'N/A',
      format: 'text',
      higherIsBetter: null,
    },
    {
      label: 'Transcript Chunks',
      a: videoA?.chunkCount ?? 'N/A',
      b: videoB?.chunkCount ?? 'N/A',
      format: 'number',
      higherIsBetter: true,
    },
  ];

  return (
    <div className="glass-card overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <h2 className="section-title">
          <span className="text-lg">📊</span>
          Metadata Comparison
        </h2>
        <p className="text-slate-500 text-sm mt-1">Side-by-side performance comparison</p>
      </div>

      {/* Column Headers */}
      <div className="px-6 py-3 grid grid-cols-[1fr_1fr_1fr] gap-4 bg-white/[0.02] border-b border-white/[0.06]">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Metric</div>
        <div className="text-center">
          <span className="text-xs font-bold px-2 py-1 rounded"
            style={{ background: 'rgba(59,84,251,0.2)', color: '#93adff' }}>
            VIDEO A (YouTube)
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs font-bold px-2 py-1 rounded"
            style={{ background: 'rgba(225,48,108,0.2)', color: '#f9a8d4' }}>
            VIDEO B (Instagram)
          </span>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.04]">
        {rows.map((row, i) => {
          const aVal = parseFloat(row.a) || 0;
          const bVal = parseFloat(row.b) || 0;

          let winner = null;
          if (row.higherIsBetter !== null && row.format !== 'text') {
            if (aVal !== bVal) {
              winner = row.higherIsBetter ? (aVal > bVal ? 'A' : 'B') : (aVal < bVal ? 'A' : 'B');
            }
          } else if (row.format === 'percent') {
            const pA = parseFloat(String(row.a).replace('%', '')) || 0;
            const pB = parseFloat(String(row.b).replace('%', '')) || 0;
            if (pA !== pB) winner = pA > pB ? 'A' : 'B';
          }

          return (
            <div
              key={row.label}
              className={`px-6 py-3.5 grid grid-cols-[1fr_1fr_1fr] gap-4 items-center transition-colors hover:bg-white/[0.02] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
            >
              <div className="text-sm text-slate-400 font-medium">{row.label}</div>

              {/* Video A */}
              <div className={`text-center text-sm font-semibold ${
                winner === 'A' ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {String(row.a)}
                {winner === 'A' && (
                  <TrendingUp className="w-3.5 h-3.5 inline ml-1.5 text-emerald-400" />
                )}
              </div>

              {/* Video B */}
              <div className={`text-center text-sm font-semibold ${
                winner === 'B' ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {String(row.b)}
                {winner === 'B' && (
                  <TrendingUp className="w-3.5 h-3.5 inline ml-1.5 text-emerald-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Engagement Rate Summary */}
      {videoA?.engagementRate != null && videoB?.engagementRate != null && (
        <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Engagement Rate Formula
            </span>
            <span className="text-xs font-mono text-slate-400">
              (Likes + Comments) / Views × 100
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
