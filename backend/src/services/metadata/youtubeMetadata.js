/**
 * YouTube Metadata Service
 *
 * Extracts video metadata using yt-dlp (no API key required).
 * Extracts: title, uploader, views, likes, comments, duration,
 *           upload date, hashtags, thumbnail URL.
 */

import { spawn } from 'child_process';
import { metadataCacheStore, cacheKey } from '../../utils/cache.js';
import logger from '../../utils/logger.js';

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';

/**
 * Fetches metadata for a YouTube video.
 *
 * @param {string} url
 * @returns {Promise<Object>}
 */
export async function getYouTubeMetadata(url) {
  const key = cacheKey(`metadata:${url}`);
  const cached = metadataCacheStore.get(key);
  if (cached) {
    logger.info(`[YouTube Metadata] Cache hit for: ${url}`);
    return cached;
  }

  logger.info(`[YouTube Metadata] Fetching metadata for: ${url}`);

  const rawInfo = await fetchYtdlpInfo(url);
  const metadata = parseYouTubeInfo(rawInfo, url);

  metadataCacheStore.set(key, metadata);
  logger.info(`[YouTube Metadata] Fetched: "${metadata.title}" by ${metadata.creator}`);
  return metadata;
}

/**
 * Runs yt-dlp --dump-json to get raw video info.
 *
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function fetchYtdlpInfo(url) {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn(YTDLP_PATH, [
      url,
      '--dump-json',
      '--no-playlist',
      '--socket-timeout', '30',
      '--skip-download',
    ]);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
    ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });

    ytdlp.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        reject(new Error(`yt-dlp metadata fetch failed (code ${code}): ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(new Error(`Failed to parse yt-dlp output: ${e.message}`));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}

/**
 * Parses raw yt-dlp info into a structured metadata object.
 *
 * @param {Object} info - Raw yt-dlp JSON
 * @param {string} url
 * @returns {Object}
 */
function parseYouTubeInfo(info, url) {
  const views = info.view_count ?? 0;
  const likes = info.like_count ?? 0;
  const comments = info.comment_count ?? 0;

  const engagementRate =
    views > 0 ? (((likes + comments) / views) * 100).toFixed(4) : '0.0000';

  // Extract hashtags from description and tags
  const hashtags = extractHashtags(info.description || '', info.tags || []);

  return {
    platform: 'youtube',
    url,
    videoId: info.id || 'unknown',
    title: info.title || 'Untitled',
    creator: info.uploader || info.channel || 'Unknown Creator',
    channelUrl: info.uploader_url || info.channel_url || null,
    views: views,
    likes: likes,
    comments: comments,
    duration: info.duration || 0, // seconds
    durationFormatted: formatDuration(info.duration || 0),
    uploadDate: formatDate(info.upload_date),
    hashtags,
    thumbnailUrl: info.thumbnail || null,
    description: (info.description || '').slice(0, 500),
    engagementRate: parseFloat(engagementRate),
    followerCount: 'unavailable', // YouTube doesn't expose subscriber count via yt-dlp
    language: info.language || 'en',
  };
}

function extractHashtags(description, tags) {
  const fromDesc = (description.match(/#[\w]+/g) || []).slice(0, 10);
  const fromTags = (tags || []).slice(0, 10).map((t) => `#${t}`);
  const combined = [...new Set([...fromDesc, ...fromTags])];
  return combined.slice(0, 15);
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  // yt-dlp returns YYYYMMDD
  const s = String(dateStr);
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return dateStr;
}
