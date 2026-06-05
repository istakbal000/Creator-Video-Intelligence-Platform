import logger from '../../utils/logger.js';

/**
 * Fuses metadata and transcript contexts.
 *
 * @param {Object} state - LangGraph state
 * @returns {Object} - Updated state with fusedContext and sourceCitations
 */
export async function contextFusionNode(state) {
  const { metadataContext, retrievedChunks, queryType } = state;

  logger.info('[ContextFusion] Fusing context...');

  const sections = [];
  const citations = [];

  // Metadata section
  if (metadataContext) {
    sections.push(`=== VIDEO METADATA ===\n${metadataContext}`);
  }

  // Transcript chunks section
  if (retrievedChunks && retrievedChunks.length > 0) {
    const chunkTexts = retrievedChunks.map((chunk, i) => {
      const label = chunk.videoId === 'A' ? 'Video A' : 'Video B';
      const citation = `[${chunk.videoId} | Chunk ${chunk.chunkIndex}]`;
      citations.push({
        label: citation,
        videoId: chunk.videoId,
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        preview: chunk.content.slice(0, 100) + '...',
      });
      return `${citation} (${label}, similarity: ${chunk.score.toFixed(3)}):\n"${chunk.content}"`;
    });

    sections.push(`=== TRANSCRIPT EXCERPTS ===\n${chunkTexts.join('\n\n')}`);
  }

  const fusedContext = sections.join('\n\n');

  if (!fusedContext.trim()) {
    logger.warn('[ContextFusion] No context available — proceeding with minimal context');
  } else {
    logger.info(`[ContextFusion] Fused ${sections.length} context sections, ${citations.length} citations`);
  }

  return { ...state, fusedContext, sourceCitations: citations };
}
