/**
 * YouTube Transcript Service
 *
 * Primary:  yt-dlp subtitle extraction (--write-auto-subs / --write-subs)
 *           Handles watch URLs, youtu.be links, and YouTube Shorts uniformly.
 * Fallback: yt-dlp audio download → Whisper transcription
 *
 * The legacy `youtube-transcript` npm package was removed because:
 *  - It does not normalise Shorts URLs
 *  - It breaks silently for most videos since YouTube changed their inner API
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { transcribeWithWhisper } from './whisper.js';
import { transcriptCacheStore, cacheKey } from '../../utils/cache.js';
import { normalizeYouTubeUrl, spawnWithTimeout } from '../../utils/validators.js';
import logger from '../../utils/logger.js';

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const TEMP_DIR   = process.env.TEMP_DIR   || './tmp';

/** Timeout constants (ms) */
const SUBTITLE_TIMEOUT_MS = 90_000;  // 90 s for subtitle download
const AUDIO_TIMEOUT_MS    = 90_000;  // 90 s for audio download

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts the full transcript for a YouTube video.
 *
 * Strategy:
 *  1. Normalise URL (Shorts → watch)
 *  2. Try yt-dlp subtitle extraction (fast, no re-encode)
 *  3. Fall back to yt-dlp audio download + Whisper
 *
 * @param {string} url - Any valid YouTube URL
 * @returns {Promise<{transcript: string, source: 'subtitles'|'whisper'}>}
 */
export async function getYouTubeTranscript(url) {
  // Always normalise first — Shorts URLs break subtitle extraction
  const canonicalUrl = normalizeYouTubeUrl(url);

  const key    = cacheKey(`transcript:${canonicalUrl}`);
  const cached = transcriptCacheStore.get(key);
  if (cached) {
    logger.info(`[YouTube Transcript] Cache hit for: ${canonicalUrl}`);
    return cached;
  }

  // --- Primary: yt-dlp subtitle extraction ---
  try {
    logger.info(`[YouTube Transcript] Attempting yt-dlp subtitles for: ${canonicalUrl}`);
    const subtitleText = await fetchSubtitlesViaYtdlp(canonicalUrl);

    if (subtitleText && subtitleText.length > 50) {
      const result = { transcript: subtitleText, source: 'subtitles' };
      transcriptCacheStore.set(key, result);
      logger.info(`[YouTube Transcript] Got subtitles (${subtitleText.length} chars)`);
      return result;
    }

    logger.warn('[YouTube Transcript] Subtitles empty or too short — falling back to Whisper');
  } catch (err) {
    logger.warn(`[YouTube Transcript] Subtitle extraction failed, trying Whisper: ${err.message}`);
  }

  // --- Fallback: yt-dlp audio + Whisper ---
  return await ytdlpWhisperFallback(canonicalUrl, key, 'youtube');
}

// ---------------------------------------------------------------------------
// Subtitle extraction via yt-dlp
// ---------------------------------------------------------------------------

/**
 * Downloads auto-generated or manual subtitles using yt-dlp and
 * parses the resulting VTT file into plain text.
 *
 * @param {string} url - Canonical YouTube watch URL
 * @returns {Promise<string>} - Plain-text transcript
 */
async function fetchSubtitlesViaYtdlp(url) {
  ensureTempDir();

  const timestamp      = Date.now();
  const outputTemplate = path.join(TEMP_DIR, `subs_${timestamp}.%(ext)s`);
  // yt-dlp writes subtitles as: <output>.<lang>.<ext>
  // With our template it becomes: subs_<ts>.en.vtt  (or similar)
  const outputBase     = path.join(TEMP_DIR, `subs_${timestamp}`);

  const args = [
    url,
    '--write-auto-subs',   // download auto-generated captions …
    '--write-subs',        // … and manual subs (whichever is available)
    '--sub-lang', 'en',
    '--sub-format', 'vtt',
    '--skip-download',     // no video/audio file needed
    '--no-playlist',
    '--socket-timeout', '30',
    '--retries', '3',
    '--fragment-retries', '3',
    '--output', outputTemplate,
    '--quiet',
    '--extractor-args', 'youtube:player_client=ios,web_creator',
  ];

  const { promise } = spawnWithTimeout(YTDLP_PATH, args, SUBTITLE_TIMEOUT_MS);
  const { code, stderr } = await promise;

  if (code !== 0) {
    throw new Error(`yt-dlp subtitle fetch failed (code ${code}): ${stderr.slice(0, 300)}`);
  }

  // Find the generated VTT file (name may vary slightly)
  const vttPath = findVttFile(outputBase);
  if (!vttPath) {
    throw new Error('No VTT subtitle file produced by yt-dlp');
  }

  const raw  = fs.readFileSync(vttPath, 'utf-8');
  const text = parseVtt(raw);

  // Cleanup
  cleanupFile(vttPath);

  return text;
}

/**
 * Looks for a .vtt file whose name starts with `basePath`.
 * yt-dlp appends the language code, e.g. `subs_1234567890.en.vtt`.
 *
 * @param {string} basePath - e.g. /tmp/subs_1234567890
 * @returns {string|null}
 */
function findVttFile(basePath) {
  const dir      = path.dirname(basePath);
  const prefix   = path.basename(basePath);

  try {
    const entries = fs.readdirSync(dir);
    const match   = entries.find(
      (f) => f.startsWith(prefix) && f.endsWith('.vtt')
    );
    return match ? path.join(dir, match) : null;
  } catch {
    return null;
  }
}

/**
 * Parses a WebVTT subtitle file into plain text.
 * Strips cue timings, positioning tags, and HTML-like markup.
 *
 * @param {string} vttContent
 * @returns {string}
 */
function parseVtt(vttContent) {
  const lines = vttContent.split('\n');
  const textLines = [];
  const seenLines = new Set(); // deduplicate consecutive identical lines

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header, NOTE blocks, and blank lines
    if (!trimmed || trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE')) continue;

    // Skip cue timing lines (contain '-->') and cue identifiers (pure numbers)
    if (trimmed.includes('-->') || /^\d+$/.test(trimmed)) continue;

    // Strip VTT inline tags: <c>, <00:00:00.000>, <b>, etc.
    const cleaned = trimmed
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (cleaned && !seenLines.has(cleaned)) {
      seenLines.add(cleaned);
      textLines.push(cleaned);
    }
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// yt-dlp + Whisper fallback
// ---------------------------------------------------------------------------

/**
 * Downloads audio using yt-dlp and transcribes with Whisper.
 * Used as fallback when subtitles are unavailable.
 *
 * @param {string} url
 * @param {string} cacheKeyValue
 * @param {string} platform
 * @returns {Promise<{transcript: string, source: 'whisper'}>}
 */
export async function ytdlpWhisperFallback(url, cacheKeyValue, platform) {
  ensureTempDir();

  const timestamp        = Date.now();
  const outputTemplate   = path.join(TEMP_DIR, `audio_${timestamp}.%(ext)s`);
  const expectedAudioPath = path.join(TEMP_DIR, `audio_${timestamp}.mp3`);

  logger.info(`[yt-dlp] Downloading audio for ${platform}: ${url}`);

  const args = [
    url,
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--output', outputTemplate,
    '--no-playlist',
    '--socket-timeout', '30',
    '--retries', '3',
    '--fragment-retries', '3',
    '--extractor-args', 'youtube:player_client=ios,web_creator;instagram:api=api',
  ];

  const { promise } = spawnWithTimeout(YTDLP_PATH, args, AUDIO_TIMEOUT_MS);
  const { code, stderr } = await promise;

  if (code !== 0) {
    throw new Error(`yt-dlp audio download failed (code ${code}): ${stderr.slice(0, 400)}`);
  }

  // Whisper transcription
  const transcript = await transcribeWithWhisper(expectedAudioPath);

  // Cleanup audio file
  cleanupFile(expectedAudioPath);

  const result = { transcript, source: 'whisper' };
  if (cacheKeyValue) transcriptCacheStore.set(cacheKeyValue, result);
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    logger.warn(`[YouTube Transcript] Could not delete temp file: ${filePath}`);
  }
}
