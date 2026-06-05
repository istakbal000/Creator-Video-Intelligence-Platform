/**
 * LangGraph Node 7: Streaming Node
 *
 * Emits the final response via Socket.IO.
 * Token-by-token streaming is handled in geminiGenerator.
 * This node finalizes the stream and emits completion events.
 */

import logger from '../../utils/logger.js';

/**
 * Finalizes streaming and emits the complete response.
 *
 * @param {Object} state - LangGraph state
 * @returns {Object} - Final state
 */
export async function streamingNode(state) {
  const {
    socket,
    sessionId,
    finalResponse,
    formattedCitations,
    queryType,
  } = state;

  logger.info('[StreamingNode] Finalizing stream...');

  if (socket) {
    // Emit stream end signal with metadata
    socket.emit('stream_end', {
      sessionId,
      citations: formattedCitations || [],
      queryType,
      timestamp: Date.now(),
    });
    logger.info('[StreamingNode] Emitted stream_end to client');
  }

  return { ...state, streamComplete: true };
}
