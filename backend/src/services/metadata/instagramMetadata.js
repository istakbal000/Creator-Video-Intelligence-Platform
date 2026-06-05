/**
 * Instagram Metadata Service
 *
 * Extracts Instagram Reel metadata using yt-dlp.
 * Note: Instagram aggressively limits API access.
 * We extract what's available without authentication.
 */

import { spawn } from 'child_process';
import { metadataCacheStore, cacheKey } from '../../utils/cache.js';
import logger from '../../utils/logger.js';

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';

/**
 * Fetches metadata for an Instagram Reel.
 *
 * @param {string} url
 * @returns {Promise<Object>}
 */
export async function getInstagramMetadata(url) {
  const key = cacheKey(`metadata:${url}`);
  const cached = metadataCacheStore.get(key);
  if (cached) {
    logger.info(`[Instagram Metadata] Cache hit for: ${url}`);
    return cached;
  }

  logger.info(`[Instagram Metadata] Fetching metadata for: ${url}`);

  const rawInfo = await fetchYtdlpInfo(url);
  const metadata = parseInstagramInfo(rawInfo, url);

  metadataCacheStore.set(key, metadata);
  logger.info(`[Instagram Metadata] Fetched: "${metadata.title}" by ${metadata.creator}`);
  return metadata;
}

async function fetchYtdlpInfo(url) {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn(YTDLP_PATH, [
      url,
      '--dump-json',
      '--no-playlist',
      '--socket-timeout', '30',
      '--skip-download',
      // Use cookies if available for better metadata access
      // '--cookies-from-browser', 'chrome', // uncomment if authenticated
    ]);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
    ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });

    ytdlp.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        reject(new Error(`yt-dlp Instagram fetch failed (code ${code}): ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(new Error(`Failed to parse yt-dlp Instagram output: ${e.message}`));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}

function parseInstagramInfo(info, url) {
  const views = info.view_count ?? info.play_count ?? 0;
  const likes = info.like_count ?? 0;
  const comments = info.comment_count ?? 0;

  const engagementRate =
    views > 0 ? (((likes + comments) / views) * 100).toFixed(4) : '0.0000';

  const hashtags = extractHashtags(info.description || info.title || '');

  return {
    platform: 'instagram',
    url,
    videoId: info.id || extractShortcode(url),
    title: info.title || info.description?.slice(0, 100) || 'Instagram Reel',
    creator: info.uploader || info.channel || info.creator || 'Unknown Creator',
    channelUrl: info.uploader_url || null,
    views,
    likes,
    comments,
    duration: info.duration || 0,
    durationFormatted: formatDuration(info.duration || 0),
    uploadDate: info.timestamp
      ? new Date(info.timestamp * 1000).toISOString().split('T')[0]
      : formatDate(info.upload_date),
    hashtags,
    thumbnailUrl: info.thumbnail || null,
    description: (info.description || '').slice(0, 500),
    engagementRate: parseFloat(engagementRate),
    followerCount: 'unavailable', // Not available without authenticated API access
    language: info.language || 'unknown',
  };
}

function extractHashtags(text) {
  return (text.match(/#[\w]+/g) || []).slice(0, 15);
}

function extractShortcode(url) {
  const match = url.match(/\/(reel|p|tv)\/([\w-]+)/);
  return match ? match[2] : 'unknown';
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const s = String(dateStr);
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return dateStr;
}
