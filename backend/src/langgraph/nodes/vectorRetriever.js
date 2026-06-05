/**
 * LangGraph Node 3: Vector Retriever
 *
 * Queries Qdrant for semantically similar transcript chunks.
 * Uses BGE embeddings for the query vector.
 * Top K = 5 by default.
 */

import { generateEmbedding } from '../../services/embeddings/bgeEmbeddings.js';
import { similaritySearch } from '../../services/vector/qdrantService.js';
import logger from '../../utils/logger.js';

/**
 * Retrieves relevant transcript chunks from Qdrant.
 *
 * @param {Object} state - LangGraph state
 * @returns {Object} - Updated state with retrievedChunks
 */
export async function vectorRetrieverNode(state) {
  const { userMessage, queryType } = state;

  // Skip if this is a pure metadata query
  if (queryType === 'metadata_query') {
    logger.info('[VectorRetriever] Skipping — metadata_query only');
    return { ...state, retrievedChunks: [] };
  }

  logger.info(`[VectorRetriever] Searching for: "${userMessage}"`);

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(userMessage);

    // Search Qdrant — no filter, search across both videos
    const chunks = await similaritySearch(queryEmbedding, ['A', 'B']);

    logger.info(`[VectorRetriever] Found ${chunks.length} relevant chunks`);
    return { ...state, retrievedChunks: chunks };
  } catch (err) {
    logger.error('[VectorRetriever] Error:', err.message);
    return { ...state, retrievedChunks: [], vectorSearchError: err.message };
  }
}
