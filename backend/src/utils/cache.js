/**
 * In-memory cache with TTL support.
 * Used for transcript caching and embedding caching to avoid
 * re-processing the same video URL.
 *
 * Keys:
 *   transcript:<url>   → { transcript, chunks }
 *   metadata:<url>     → { ...videoMetadata }
 *   embeddings:<url>   → { embeddings: [...] }
 */

import NodeCache from 'node-cache';
import logger from './logger.js';

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '86400', 10);

const transcriptCache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 600 });
const metadataCache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 600 });
const embeddingCache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 600 });

/**
 * Generic get/set helper bound to a specific cache store.
 */
function makeCache(store, name) {
  return {
    get(key) {
      const value = store.get(key);
      if (value !== undefined) {
        logger.debug(`[Cache HIT] ${name}:${key}`);
      }
      return value ?? null;
    },
    set(key, value) {
      store.set(key, value);
      logger.debug(`[Cache SET] ${name}:${key}`);
    },
    has(key) {
      return store.has(key);
    },
    del(key) {
      store.del(key);
    },
    flush() {
      store.flushAll();
    },
    stats() {
      return store.getStats();
    },
  };
}

export const transcriptCacheStore = makeCache(transcriptCache, 'transcript');
export const metadataCacheStore = makeCache(metadataCache, 'metadata');
export const embeddingCacheStore = makeCache(embeddingCache, 'embedding');

/**
 * Compute a normalized cache key from a URL.
 * Strips trailing slashes and lowercases.
 */
export function cacheKey(url) {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}
