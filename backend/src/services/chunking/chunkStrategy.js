/**
 * Chunking Strategy — 600-token chunks with 100-token overlap.
 *
 * Uses js-tiktoken (cl100k_base encoding) to count tokens accurately.
 * Each chunk is tagged with its metadata for vector storage.
 */

import { getEncoding } from 'js-tiktoken';
import logger from '../../utils/logger.js';

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '600', 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '100', 10);

// Lazily initialize encoder to avoid startup cost
let encoder = null;

function getEncoder() {
  if (!encoder) {
    encoder = getEncoding('cl100k_base');
  }
  return encoder;
}

/**
 * Splits text into token-aware chunks with overlap.
 *
 * @param {string} text - Full transcript text
 * @param {Object} meta - Metadata to attach to each chunk
 * @param {string} meta.videoId - 'A' or 'B'
 * @param {string} meta.platform - 'youtube' | 'instagram'
 * @param {string} meta.videoUrl - Original URL
 * @returns {Array<{chunkId: string, content: string, tokenCount: number, videoId: string, platform: string, videoUrl: string}>}
 */
export function chunkTranscript(text, meta) {
  const enc = getEncoder();
  const tokens = enc.encode(text);
  const totalTokens = tokens.length;

  logger.info(`[Chunker] Total tokens: ${totalTokens} for video ${meta.videoId}`);

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < totalTokens) {
    const end = Math.min(start + CHUNK_SIZE, totalTokens);
    const chunkTokens = tokens.slice(start, end);

    // Decode tokens back to text
    const chunkText = new TextDecoder().decode(enc.decode(chunkTokens));

    chunks.push({
      chunkId: `${meta.videoId}-${chunkIndex}`,
      content: chunkText.trim(),
      tokenCount: chunkTokens.length,
      videoId: meta.videoId,
      platform: meta.platform,
      videoUrl: meta.videoUrl,
      chunkIndex,
    });

    chunkIndex++;

    // Advance with overlap — go back CHUNK_OVERLAP tokens
    start = end - CHUNK_OVERLAP;

    // Avoid infinite loop if overlap >= chunk size
    if (end === totalTokens) break;
  }

  logger.info(`[Chunker] Created ${chunks.length} chunks for video ${meta.videoId}`);
  return chunks;
}

/**
 * Returns the token count for a given string.
 * @param {string} text
 * @returns {number}
 */
export function countTokens(text) {
  const enc = getEncoder();
  return enc.encode(text).length;
}
