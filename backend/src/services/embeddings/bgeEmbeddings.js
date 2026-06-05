/**
 * BGE Embeddings Service
 *
 * Generates embeddings locally using BAAI/bge-base-en-v1.5 via @xenova/transformers.
 * No external API calls. Embeddings are cached per chunk content hash.
 *
 * The model is downloaded and cached automatically on first use (~430 MB).
 */

import { pipeline, env } from '@xenova/transformers';
import crypto from 'crypto';
import { embeddingCacheStore, cacheKey } from '../../utils/cache.js';
import logger from '../../utils/logger.js';

// Use local model cache to avoid repeated downloads
env.cacheDir = './.model-cache';
env.allowRemoteModels = true;

const MODEL_NAME = 'Xenova/bge-base-en-v1.5';

let embedder = null;

/**
 * Lazily loads the BGE embedding pipeline.
 * @returns {Promise<Function>}
 */
async function getEmbedder() {
  if (!embedder) {
    logger.info('[BGE] Loading BAAI/bge-base-en-v1.5 embedding model...');
    embedder = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // Use quantized model for faster inference
    });
    logger.info('[BGE] Embedding model loaded successfully.');
  }
  return embedder;
}

/**
 * Generates a normalized embedding vector for a single text string.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  const key = cacheKey(`emb:${crypto.createHash('md5').update(text).digest('hex')}`);
  const cached = embeddingCacheStore.get(key);
  if (cached) return cached;

  const pipe = await getEmbedder();

  // BGE models benefit from the instruction prefix for retrieval tasks
  const inputText = `Represent this sentence: ${text}`;
  const output = await pipe(inputText, { pooling: 'mean', normalize: true });

  // Convert to plain JS array
  const embedding = Array.from(output.data);

  embeddingCacheStore.set(key, embedding);
  return embedding;
}

/**
 * Generates embeddings for a batch of text strings.
 * Processes in batches to avoid memory pressure.
 *
 * @param {string[]} texts
 * @param {number} batchSize
 * @returns {Promise<number[][]>}
 */
export async function generateEmbeddingsBatch(texts, batchSize = 16) {
  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    logger.info(`[BGE] Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

    const embeddings = await Promise.all(batch.map((text) => generateEmbedding(text)));
    results.push(...embeddings);
  }

  return results;
}

/**
 * Returns the embedding dimension for bge-base-en-v1.5.
 * Used for Qdrant collection creation.
 */
export const EMBEDDING_DIMENSION = 768;
