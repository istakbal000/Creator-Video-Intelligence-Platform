/**
 * YouTube Transcript Service
 *
 * Primary: youtube-transcript package (fast, no API key needed)
 * Fallback: yt-dlp + Whisper for videos without captions
 */

import { YoutubeTranscript } from 'youtube-transcript';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { transcribeWithWhisper } from './whisper.js';
import { transcriptCacheStore, cacheKey } from '../../utils/cache.js';
import logger from '../../utils/logger.js';

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const TEMP_DIR = process.env.TEMP_DIR || './tmp';

/**
 * Extracts the full transcript for a YouTube video.
 * Tries youtube-transcript first, falls back to yt-dlp + Whisper.
 *
 * @param {string} url - YouTube video URL
 * @returns {Promise<{transcript: string, source: 'captions'|'whisper'}>}
 */
export async function getYouTubeTranscript(url) {
  const key = cacheKey(`transcript:${url}`);
  const cached = transcriptCacheStore.get(key);
  if (cached) {
    logger.info(`[YouTube Transcript] Cache hit for: ${url}`);
    return cached;
  }

  // Primary: youtube-transcript
  try {
    logger.info(`[YouTube Transcript] Attempting captions for: ${url}`);
    const segments = await YoutubeTranscript.fetchTranscript(url);

    if (segments && segments.length > 0) {
      const transcript = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
      const result = { transcript, source: 'captions' };
      transcriptCacheStore.set(key, result);
      logger.info(`[YouTube Transcript] Got captions (${transcript.length} chars)`);
      return result;
    }
  } catch (err) {
    logger.warn(`[YouTube Transcript] Captions unavailable, falling back to Whisper: ${err.message}`);
  }

  // Fallback: yt-dlp + Whisper
  return await ytdlpWhisperFallback(url, key, 'youtube');
}

/**
 * Downloads audio using yt-dlp and transcribes with Whisper.
 *
 * @param {string} url
 * @param {string} cacheKeyValue
 * @param {string} platform
 * @returns {Promise<{transcript: string, source: 'whisper'}>}
 */
export async function ytdlpWhisperFallback(url, cacheKeyValue, platform) {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const outputTemplate = path.join(TEMP_DIR, `audio_${timestamp}.%(ext)s`);
  const expectedAudioPath = path.join(TEMP_DIR, `audio_${timestamp}.mp3`);

  logger.info(`[yt-dlp] Downloading audio for ${platform}: ${url}`);

  await new Promise((resolve, reject) => {
    const ytdlp = spawn(YTDLP_PATH, [
      url,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', outputTemplate,
      '--no-playlist',
      '--socket-timeout', '30',
    ]);

    let stderr = '';
    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed (code ${code}): ${stderr}`));
      } else {
        resolve();
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}. Install from: https://github.com/yt-dlp/yt-dlp`));
    });
  });

  // Whisper transcription
  const transcript = await transcribeWithWhisper(expectedAudioPath);

  // Cleanup audio file
  try {
    if (fs.existsSync(expectedAudioPath)) fs.unlinkSync(expectedAudioPath);
  } catch (e) {
    logger.warn(`[yt-dlp] Could not delete temp audio: ${expectedAudioPath}`);
  }

  const result = { transcript, source: 'whisper' };
  if (cacheKeyValue) transcriptCacheStore.set(cacheKeyValue, result);
  return result;
}
