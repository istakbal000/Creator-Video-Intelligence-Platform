/**
 * URL and request validators for the Creator Intelligence Platform.
 * Uses express-validator under the hood for route-level validation,
 * and exports pure validation helpers for service-layer use.
 */

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
 * @param {string} url
 * @returns {string|null}
 */
export function extractYouTubeId(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1).split('/')[0];
    }
    return (
      urlObj.searchParams.get('v') ||
      urlObj.pathname.split('/').pop() ||
      null
    );
  } catch {
    return null;
  }
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
