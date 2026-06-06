/**
 * Instagram Transcript Service
 *
 * Attempts to download audio from an Instagram Reel via yt-dlp and
 * transcribe it with Whisper.
 *
 * Instagram has restricted unauthenticated access since late 2023.
 * On any server environment (Render, Railway, etc.) yt-dlp will receive
 * HTTP 401/403 or "Login required". Instead of crashing the pipeline we
 * catch these errors and return a graceful "unavailable" result so the
 * rest of the analysis (metadata, YouTube transcript) still completes.
 */

import { transcriptCacheStore, cacheKey } from '../../utils/cache.js';
import { ytdlpWhisperFallback } from './youtubeTranscript.js';
import logger from '../../utils/logger.js';

/** Keywords in yt-dlp stderr that indicate an auth block (not a transient error). */
const AUTH_ERROR_PATTERNS = [
  /login required/i,
  /not logged in/i,
  /HTTP Error 401/i,
  /HTTP Error 403/i,
  /please log in/i,
  /requires authentication/i,
  /rate-limit/i,
  /too many requests/i,
];

/**
 * Returns true if the error message matches a known Instagram auth-block pattern.
 * @param {string} message
 * @returns {boolean}
 */
function isAuthError(message) {
  return AUTH_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * Extracts transcript from an Instagram Reel.
 *
 * On auth / rate-limit errors returns:
 *   { transcript: '', source: 'unavailable', transcriptAvailable: false }
 *
 * @param {string} url - Instagram Reel URL
 * @returns {Promise<{transcript: string, source: string, transcriptAvailable: boolean}>}
 */
export async function getInstagramTranscript(url) {
  const key    = cacheKey(`transcript:${url}`);
  const cached = transcriptCacheStore.get(key);
  if (cached) {
    logger.info(`[Instagram Transcript] Cache hit for: ${url}`);
    return cached;
  }

  logger.info(`[Instagram Transcript] Attempting audio extraction for: ${url}`);

  try {
    const result = await ytdlpWhisperFallback(url, key, 'instagram');
    logger.info(`[Instagram Transcript] Successfully transcribed Reel (${result.transcript.length} chars)`);
    return { ...result, transcriptAvailable: true };
  } catch (err) {
    const message = err.message || '';

    if (isAuthError(message)) {
      // Auth-blocked — common on server environments without Instagram cookies.
      // Do NOT throw; return a graceful fallback so the pipeline continues.
      logger.warn(
        `[Instagram Transcript] Auth/rate-limit block detected — marking transcript unavailable. ` +
        `Details: ${message.slice(0, 200)}`
      );

      const fallback = {
        transcript: '',
        source: 'unavailable',
        transcriptAvailable: false,
        authBlocked: true,
      };
      // Cache the fallback briefly (5 min) to avoid hammering Instagram
      transcriptCacheStore.set(key, fallback, 300);
      return fallback;
    }

    // Unexpected error — still don't crash the pipeline; log and return unavailable
    logger.error(`[Instagram Transcript] Unexpected failure: ${message}`);
    return {
      transcript: '',
      source: 'unavailable',
      transcriptAvailable: false,
      authBlocked: false,
      error: message,
    };
  }
}
