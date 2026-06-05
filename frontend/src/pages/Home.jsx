import React, { useState, useCallback, useId } from 'react';
import {
  Youtube, Instagram, Zap, Brain, GitBranch, Search,
  ChevronRight, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import VideoCard from '../components/VideoCard.jsx';
import MetadataTable from '../components/MetadataTable.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import { analyzeVideos } from '../services/api.js';
import { useChat } from '../hooks/useChat.js';

const SESSION_ID = `session_${Date.now()}`;

// Feature badges for the hero section
const FEATURES = [
  { icon: Brain, label: 'Agentic Hybrid RAG', color: 'text-blue-400' },
  { icon: GitBranch, label: 'LangGraph Workflow', color: 'text-purple-400' },
  { icon: Search, label: 'Qdrant Vector Search', color: 'text-cyan-400' },
  { icon: Zap, label: 'Gemini 2.5 Flash', color: 'text-amber-400' },
];

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [videoA, setVideoA] = useState(null);
  const [videoB, setVideoB] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [analyzeSuccess, setAnalyzeSuccess] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');

  const {
    messages,
    isStreaming,
    isConnected,
    streamingText,
    error: chatError,
    sendMessage,
    setVideoContext,
    clearMessages,
  } = useChat(SESSION_ID);

  /**
   * Handles video analysis form submission.
   */
  const handleAnalyze = useCallback(async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || !instagramUrl.trim()) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeSuccess(false);
    setVideoA(null);
    setVideoB(null);

    try {
      setAnalysisProgress('Fetching metadata & transcripts...');

      const data = await analyzeVideos(
        youtubeUrl.trim(),
        instagramUrl.trim(),
        SESSION_ID
      );

      setVideoA(data.videoA);
      setVideoB(data.videoB);
      setAnalyzeSuccess(true);
      setAnalysisProgress('');

      // Push video context to chat system
      setVideoContext(data.videoA, data.videoB);

    } catch (err) {
      setAnalyzeError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [youtubeUrl, instagramUrl, setVideoContext]);

  const hasVideos = !!(videoA || videoB);

  return (
    <div className="min-h-screen">
      {/* ── Hero Header ─────────────────────────────────────── */}
      <header className="relative border-b border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #3b54fb, transparent)' }} />
          <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b54fb, #8b5cf6)' }}>
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold gradient-text tracking-tight">
                Creator Video Intelligence Platform
              </h1>
              <p className="text-slate-500 text-sm">
                Agentic Hybrid RAG • LangGraph • Gemini 2.5 Flash • Qdrant
              </p>
            </div>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            {FEATURES.map(({ icon: Icon, label, color }) => (
              <div key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── URL Input Section ────────────────────────────── */}
        <section>
          <div className="glass-card p-6">
            <h2 className="section-title mb-5">
              <span>🎯</span>
              Analyze Videos
            </h2>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* YouTube URL */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
                    <Youtube className="w-4 h-4 text-red-500" />
                    YouTube Video URL
                    <span className="badge badge-youtube text-xs ml-1">Video A</span>
                  </label>
                  <input
                    id="youtube-url-input"
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="input-field"
                    required
                    disabled={isAnalyzing}
                  />
                </div>

                {/* Instagram URL */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
                    <Instagram className="w-4 h-4 text-pink-400" />
                    Instagram Reel URL
                    <span className="badge badge-instagram text-xs ml-1">Video B</span>
                  </label>
                  <input
                    id="instagram-url-input"
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/reel/..."
                    className="input-field"
                    required
                    disabled={isAnalyzing}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-4">
                <button
                  id="analyze-btn"
                  type="submit"
                  disabled={isAnalyzing}
                  className="btn-primary flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Analyze & Compare
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Progress text */}
                {isAnalyzing && analysisProgress && (
                  <p className="text-sm text-slate-500 animate-pulse">{analysisProgress}</p>
                )}

                {/* Success indicator */}
                {analyzeSuccess && !isAnalyzing && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm animate-fade-in-up">
                    <CheckCircle2 className="w-4 h-4" />
                    Analysis complete
                  </div>
                )}
              </div>

              {/* Error */}
              {analyzeError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in-up">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{analyzeError}</p>
                </div>
              )}

              {/* Info notice */}
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>
                  Analysis extracts transcripts (via captions or Whisper), fetches metadata, generates BGE embeddings,
                  and indexes chunks in Qdrant. This may take 1–5 minutes for new videos.
                </span>
              </div>
            </form>
          </div>
        </section>

        {/* ── Video Cards ──────────────────────────────────── */}
        <section>
          <h2 className="section-title mb-4">
            <span>🎬</span>
            Video Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <VideoCard video={videoA} label="A" loading={isAnalyzing && !videoA} />
            <VideoCard video={videoB} label="B" loading={isAnalyzing && !videoB} />
          </div>
        </section>

        {/* ── Metadata Table ───────────────────────────────── */}
        {hasVideos && (
          <section>
            <MetadataTable videoA={videoA} videoB={videoB} />
          </section>
        )}

        {/* ── Chat Panel ───────────────────────────────────── */}
        <section>
          <h2 className="section-title mb-4">
            <span>💬</span>
            AI Video Analyst
          </h2>
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            isConnected={isConnected}
            streamingText={streamingText}
            error={chatError}
            onSendMessage={sendMessage}
            onClearMessages={clearMessages}
            hasVideos={hasVideos}
          />
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-8 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-600 text-sm">
            Creator Video Intelligence Platform •{' '}
            <span className="gradient-text font-medium">
              Agentic Hybrid RAG
            </span>{' '}
            • Powered by LangGraph + Gemini 2.5 Flash + BGE + Qdrant
          </p>
        </div>
      </footer>
    </div>
  );
}
