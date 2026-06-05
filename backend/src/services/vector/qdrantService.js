/**
 * Qdrant Vector Database Service
 *
 * Manages the Qdrant collection for video transcript chunks.
 * Collection name: video_transcripts
 *
 * Each point stores:
 *   - vector: BGE embedding (768-dim)
 *   - payload: { chunkId, videoId, platform, videoUrl, content, chunkIndex }
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { EMBEDDING_DIMENSION } from '../embeddings/bgeEmbeddings.js';
import logger from '../../utils/logger.js';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'video_transcripts';
const TOP_K = parseInt(process.env.VECTOR_TOP_K || '5', 10);

let client = null;

/**
 * Returns the singleton Qdrant client.
 */
function getClient() {
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      ...(process.env.QDRANT_API_KEY && { apiKey: process.env.QDRANT_API_KEY }),
    });
  }
  return client;
}

/**
 * Ensures the video_transcripts collection exists.
 * Creates it if not present.
 */
export async function ensureCollection() {
  const qdrant = getClient();
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: EMBEDDING_DIMENSION,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });
      logger.info(`[Qdrant] Created collection: ${COLLECTION_NAME}`);
    } else {
      logger.info(`[Qdrant] Collection already exists: ${COLLECTION_NAME}`);
    }
  } catch (error) {
    logger.error('[Qdrant] Error ensuring collection:', error);
    throw error;
  }
}

/**
 * Upserts transcript chunks into Qdrant.
 *
 * @param {Array<{chunkId: string, content: string, embedding: number[], videoId: string, platform: string, videoUrl: string, chunkIndex: number}>} chunks
 */
export async function upsertChunks(chunks) {
  const qdrant = getClient();

  const points = chunks.map((chunk) => ({
    id: generatePointId(chunk.chunkId),
    vector: chunk.embedding,
    payload: {
      chunkId: chunk.chunkId,
      videoId: chunk.videoId,
      platform: chunk.platform,
      videoUrl: chunk.videoUrl,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points,
  });

  logger.info(`[Qdrant] Upserted ${points.length} chunks.`);
}

/**
 * Performs similarity search against Qdrant.
 *
 * @param {number[]} queryEmbedding - Query vector
 * @param {string[]} [videoIds] - Filter to specific video IDs (e.g., ['A', 'B'])
 * @returns {Promise<Array>}
 */
export async function similaritySearch(queryEmbedding, videoIds = null) {
  const qdrant = getClient();

  const filter = videoIds
    ? {
        must: [
          {
            key: 'videoId',
            match: { any: videoIds },
          },
        ],
      }
    : undefined;

  const results = await qdrant.search(COLLECTION_NAME, {
    vector: queryEmbedding,
    limit: TOP_K,
    filter,
    with_payload: true,
  });

  return results.map((r) => ({
    score: r.score,
    chunkId: r.payload.chunkId,
    videoId: r.payload.videoId,
    platform: r.payload.platform,
    content: r.payload.content,
    chunkIndex: r.payload.chunkIndex,
  }));
}

/**
 * Deletes all chunks for a specific video (for re-indexing).
 *
 * @param {string} videoId
 */
export async function deleteVideoChunks(videoId) {
  const qdrant = getClient();
  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [{ key: 'videoId', match: { value: videoId } }],
    },
  });
  logger.info(`[Qdrant] Deleted chunks for video ${videoId}`);
}

/**
 * Checks if a videoId already has chunks in Qdrant (dedup check).
 *
 * @param {string} videoId
 * @returns {Promise<boolean>}
 */
export async function videoAlreadyIndexed(videoId) {
  const qdrant = getClient();
  const result = await qdrant.count(COLLECTION_NAME, {
    filter: {
      must: [{ key: 'videoId', match: { value: videoId } }],
    },
    exact: true,
  });
  return result.count > 0;
}

/**
 * Deterministically converts a chunk ID string to a Qdrant-compatible UUID integer.
 * Qdrant points need a numeric or UUID id.
 *
 * @param {string} chunkId
 * @returns {number}
 */
function generatePointId(chunkId) {
  // Simple hash to positive integer
  let hash = 0;
  for (let i = 0; i < chunkId.length; i++) {
    const char = chunkId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
