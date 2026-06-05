/**
 * Instagram Transcript Service
 *
 * Uses yt-dlp to download audio from Instagram Reels,
 * then transcribes using Whisper.
 */

import { transcriptCacheStore, cacheKey } from '../../utils/cache.js';
import { ytdlpWhisperFallback } from './youtubeTranscript.js';
import logger from '../../utils/logger.js';

/**
 * Extracts transcript from an Instagram Reel.
 * Fully automated via yt-dlp + Whisper.
 *
 * @param {string} url - Instagram Reel URL
 * @returns {Promise<{transcript: string, source: 'whisper'}>}
 */
export async function getInstagramTranscript(url) {
  const key = cacheKey(`transcript:${url}`);
  const cached = transcriptCacheStore.get(key);
  if (cached) {
    logger.info(`[Instagram Transcript] Cache hit for: ${url}`);
    return cached;
  }

  logger.info(`[Instagram Transcript] Extracting audio from Instagram Reel: ${url}`);

  try {
    const result = await ytdlpWhisperFallback(url, key, 'instagram');
    logger.info(`[Instagram Transcript] Successfully transcribed Reel (${result.transcript.length} chars)`);
    return result;
  } catch (err) {
    logger.error(`[Instagram Transcript] Failed: ${err.message}`);
    throw new Error(`Instagram transcript extraction failed: ${err.message}`);
  }
}
