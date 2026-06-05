import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Send, Wifi, WifiOff, Trash2, Lightbulb, MessageSquare,
  Zap, RotateCcw
} from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';

const SUGGESTED_QUESTIONS = [
  'Why did Video A outperform Video B?',
  'Compare the hooks in the first 5 seconds of each video',
  'What is the engagement rate difference between the two videos?',
  'Which video has a better content strategy?',
  'What hashtags are most effective?',
  'Summarize the key differences in transcript content',
];

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in-up">
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}>
        <Zap className="w-4 h-4 text-white" />
      </div>
      <div className="glass-card rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5 h-5">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages,
  isStreaming,
  isConnected,
  streamingText,
  error,
  onSendMessage,
  onClearMessages,
  hasVideos,
}) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault();
      const text = inputValue.trim();
      if (!text || isStreaming || !isConnected) return;
      setInputValue('');
      setShowSuggestions(false);
      onSendMessage(text);
    },
    [inputValue, isStreaming, isConnected, onSendMessage]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (question) => {
    if (isStreaming || !isConnected) return;
    setInputValue('');
    setShowSuggestions(false);
    onSendMessage(question);
  };

  const isEmpty = messages.length === 0 && !streamingText;

  return (
    <div className="glass-card flex flex-col overflow-hidden" style={{ height: '680px' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b54fb, #8b5cf6)' }}>
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">AI Video Analyst</h2>
            <p className="text-xs text-slate-500">Powered by Gemini 2.5 Flash + LangGraph</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isConnected ? 'Connected' : 'Offline'}</span>
          </div>

          {/* Clear button */}
          {messages.length > 0 && (
            <button
              onClick={onClearMessages}
              className="btn-ghost p-2 rounded-lg"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-glow-pulse"
                style={{ background: 'linear-gradient(135deg, rgba(59,84,251,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(96,128,255,0.2)' }}>
                <Zap className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Agentic Hybrid RAG</h3>
              <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                {hasVideos
                  ? 'Ask anything about both videos. The AI will intelligently retrieve metadata, transcript chunks, or both.'
                  : 'Analyze your videos first to unlock the full AI chat experience.'}
              </p>
            </div>

            {/* Suggested questions */}
            {hasVideos && showSuggestions && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                    Suggested Questions
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(q)}
                      disabled={!isConnected}
                      className="text-left px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:text-white transition-all duration-200 border border-white/[0.06] hover:border-blue-500/30 hover:bg-blue-500/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={false}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingText && (
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingText,
              timestamp: new Date().toISOString(),
            }}
            isStreaming={true}
          />
        )}

        {/* Typing indicator (before first token) */}
        {isStreaming && !streamingText && <TypingIndicator />}

        {/* Error alert */}
        {error && !isStreaming && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in-up">
            <span className="text-red-400 text-lg">⚠</span>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="px-5 py-4 border-t border-white/[0.06]">
        {!hasVideos && (
          <div className="mb-3 flex items-center gap-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
            <span>⚡</span>
            <span>Analyze videos above to enable AI chat</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3">
          <textarea
            ref={inputRef}
            id="chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !isConnected
                ? 'Connecting to server...'
                : !hasVideos
                ? 'Analyze videos first...'
                : 'Ask about transcripts, engagement, comparisons...'
            }
            disabled={!isConnected || !hasVideos || isStreaming}
            rows={2}
            className="input-field resize-none flex-1 text-sm"
            style={{ minHeight: '52px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            id="chat-send-btn"
            disabled={!isConnected || !hasVideos || isStreaming}
            className="btn-primary px-4 flex-shrink-0 flex items-center justify-center self-end h-[52px]"
          >
            {isStreaming ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        <p className="text-xs text-slate-600 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
