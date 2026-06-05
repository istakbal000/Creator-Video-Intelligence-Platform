/**
 * LangGraph Node 6: Citation Formatter
 *
 * Formats citations from retrieved chunks and appends
 * them to the generated response in a structured format.
 */

import logger from '../../utils/logger.js';

/**
 * Formats and appends citations to the generated response.
 *
 * @param {Object} state - LangGraph state
 * @returns {Object} - Updated state with finalResponse and formattedCitations
 */
export async function citationFormatterNode(state) {
  const { generatedResponse, sourceCitations, queryType } = state;

  logger.info(`[CitationFormatter] Formatting ${sourceCitations?.length ?? 0} citations`);

  if (!sourceCitations || sourceCitations.length === 0) {
    return {
      ...state,
      finalResponse: generatedResponse,
      formattedCitations: [],
    };
  }

  // Build citation section
  const citationLines = sourceCitations.map((c) => {
    const videoLabel = c.videoId === 'A' ? 'Video A' : 'Video B';
    return `[${c.videoId} | Chunk ${c.chunkIndex}] — ${videoLabel} (relevance: ${(c.score * 100).toFixed(1)}%)`;
  });

  const citationBlock = `\n\n---\n**Sources:**\n${citationLines.join('\n')}`;

  const finalResponse = generatedResponse + citationBlock;

  const formattedCitations = sourceCitations.map((c) => ({
    label: `${c.videoId} | Chunk ${c.chunkIndex}`,
    videoId: c.videoId,
    chunkId: c.chunkId,
    score: c.score,
    preview: c.preview,
  }));

  logger.info('[CitationFormatter] Citations formatted');
  return { ...state, finalResponse, formattedCitations };
}
