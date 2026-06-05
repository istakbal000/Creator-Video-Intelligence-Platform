/**
 * MessageBubble Component
 * Renders a single chat message with markdown and citations.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, AlertTriangle, Zap } from 'lucide-react';
import SourceCitation from './SourceCitation.jsx';

const QUERY_TYPE_CONFIG = {
  metadata_query: { label: 'Metadata', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  transcript_query: { label: 'Transcript', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  hybrid_query: { label: 'Hybrid RAG', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
};

function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const qtConfig = QUERY_TYPE_CONFIG[message.queryType];

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-slide-in-left" style={{ animationDirection: 'reverse' }}>
        <div className="max-w-[75%]">
          <div
            className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white leading-relaxed"
            style={{ background: 'linear-gradient(135deg, #3b54fb 0%, #8b5cf6 100%)' }}
          >
            {message.content}
          </div>
          <p className="text-right text-xs text-slate-600 mt-1">
            {formatTime(message.timestamp)}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
          style={{ background: 'linear-gradient(135deg, #3b54fb, #8b5cf6)' }}>
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in-up">
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${isError ? 'bg-red-500/20' : ''}`}
        style={!isError ? { background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' } : {}}
      >
        {isError ? (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Query type badge */}
        {qtConfig && (
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium mb-2 ${qtConfig.bg} ${qtConfig.color}`}>
            <Zap className="w-2.5 h-2.5" />
            {qtConfig.label}
          </div>
        )}

        {/* Message body */}
        <div
          className={`rounded-2xl rounded-tl-sm px-4 py-3 ${
            isError
              ? 'bg-red-500/10 border border-red-500/20'
              : 'glass-card'
          }`}
        >
          {isStreaming ? (
            <div className="text-sm text-slate-300 leading-relaxed">
              <span>{message.content}</span>
              <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />
            </div>
          ) : (
            <div className={`text-sm leading-relaxed ${isError ? 'text-red-400' : ''}`}>
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Citations */}
          {!isStreaming && message.citations && message.citations.length > 0 && (
            <SourceCitation citations={message.citations} />
          )}
        </div>

        <p className="text-xs text-slate-600 mt-1 ml-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
