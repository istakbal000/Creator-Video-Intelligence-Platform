/**
 * URL and request validators for the Creator Intelligence Platform.
 * Uses express-validator under the hood for route-level validation,
 * and exports pure validation helpers for service-layer use.
 */

import { spawn } from 'child_process';

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
  /^https?:\/\/youtu\.be\/[\w-]{11}/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]{11}/,
];

const INSTAGRAM_PATTERNS = [
  /^https?:\/\/(www\.)?instagram\.com\/reel\/[\w-]+/,
  /^https?:\/\/(www\.)?instagram\.com\/p\/[\w-]+/,
  /^https?:\/\/(www\.)?instagram\.com\/tv\/[\w-]+/,
];

/**
 * Returns true if the URL is a valid YouTube URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return YOUTUBE_PATTERNS.some((pattern) => pattern.test(url.trim()));
}

/**
 * Returns true if the URL is a valid Instagram Reel URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidInstagramUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return INSTAGRAM_PATTERNS.some((pattern) => pattern.test(url.trim()));
}

/**
 * Extracts the YouTube video ID from a URL.
 * Handles watch, youtu.be, and Shorts URLs.
 * @param {string} url
 * @returns {string|null}
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url.trim());

    // youtu.be short links
    if (urlObj.hostname === 'youtu.be') {
      const id = urlObj.pathname.slice(1).split('/')[0].split('?')[0];
      return id && id.length === 11 ? id : null;
    }

    // youtube.com/shorts/<id>
    const shortsMatch = urlObj.pathname.match(/^\/shorts\/([\w-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // youtube.com/watch?v=<id>
    const v = urlObj.searchParams.get('v');
    if (v && v.length === 11) return v;

    return null;
  } catch {
    return null;
  }
}

/**
 * Normalizes any YouTube URL (watch, youtu.be, Shorts) to the canonical
 * https://www.youtube.com/watch?v=<id> form.
 * Returns the original URL unchanged if the ID cannot be extracted.
 *
 * @param {string} url
 * @returns {string}
 */
export function normalizeYouTubeUrl(url) {
  const id = extractYouTubeId(url);
  if (!id) return url;
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Extracts the Instagram shortcode from a URL.
 * @param {string} url
 * @returns {string|null}
 */
export function extractInstagramShortcode(url) {
  try {
    const match = url.match(/\/(reel|p|tv)\/([\w-]+)/);
    return match ? match[2] : null;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a URL by trimming whitespace.
 * @param {string} url
 * @returns {string}
 */
export function sanitizeUrl(url) {
  return (url || '').trim();
}

/**
 * Spawns a child process and rejects with a timeout error if it does not
 * complete within `timeoutMs` milliseconds. On timeout the child is sent
 * SIGKILL before the promise rejects.
 *
 * @param {string} cmd      - Executable to run (e.g. 'yt-dlp', 'whisper')
 * @param {string[]} args   - CLI arguments
 * @param {number} timeoutMs - Wall-clock timeout in milliseconds
 * @returns {{ process: ChildProcess, promise: Promise<{ stdout: string, stderr: string }> }}
 */
export function spawnWithTimeout(cmd, args, timeoutMs) {
  let child;
  const promise = new Promise((resolve, reject) => {
    child = spawn(cmd, args);

    let stdout = '';
    let stderr = '';

    if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
      reject(new Error(`Process '${cmd}' timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn '${cmd}': ${err.message}`));
    });
  });

  return { process: child, promise };
}
