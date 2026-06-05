/**
 * SourceCitation Component
 * Renders citation badges with video reference details.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

export default function SourceCitation({ citations }) {
  const [expanded, setExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span className="font-medium">{citations.length} source{citations.length > 1 ? 's' : ''} cited</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-1.5 animate-fade-in-up">
          {citations.map((c, i) => (
            <div
              key={i}
              className="citation-badge group relative"
              title={c.preview}
            >
              <span className="font-bold">[{c.videoId}</span>
              <span className="text-slate-500 mx-0.5">|</span>
              <span>Chunk {c.chunkIndex ?? c.chunkId}]</span>
              {c.score && (
                <span className="ml-1 text-slate-500">
                  {(c.score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
