/**
 * Chat Controller
 *
 * Handles chat messages and orchestrates the LangGraph workflow.
 * Supports both Socket.IO streaming and REST fallback.
 */

import { runAgentGraph } from '../langgraph/graph.js';
import {
  getVideoContext,
  getMessageHistory,
  addMessage,
} from '../memory/conversationMemory.js';
import logger from '../utils/logger.js';

/**
 * POST /api/chat
 *
 * REST endpoint for chat (non-streaming).
 * For streaming, use Socket.IO events.
 */
export async function handleChat(req, res) {
  const { message, sessionId = 'default' } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  logger.info(`[ChatController] REST chat for session ${sessionId}: "${message}"`);

  try {
    const videoContext = getVideoContext(sessionId);
    const conversationHistory = getMessageHistory(sessionId);

    // Add user message to memory
    addMessage(sessionId, 'user', message);

    const result = await runAgentGraph({
      userMessage: message.trim(),
      sessionId,
      videoContext,
      conversationHistory,
      onToken: null, // No streaming for REST
      socket: null,
    });

    // Save assistant response to memory
    addMessage(sessionId, 'assistant', result.finalResponse);

    return res.json({
      success: true,
      response: result.finalResponse,
      citations: result.formattedCitations || [],
      queryType: result.queryType,
      sessionId,
    });
  } catch (err) {
    logger.error('[ChatController] Error:', err);
    return res.status(500).json({
      error: 'Chat failed',
      message: err.message,
    });
  }
}

/**
 * GET /api/history
 *
 * Returns conversation history for a session.
 */
export async function getHistory(req, res) {
  const sessionId = req.query.sessionId || 'default';
  const history = getMessageHistory(sessionId);
  return res.json({ sessionId, history, messageCount: history.length });
}

/**
 * Socket.IO streaming chat handler.
 * Called from the Socket.IO setup in server.js.
 *
 * @param {Object} socket - Socket.IO socket
 * @param {Object} data - { message, sessionId }
 */
export async function handleSocketChat(socket, data) {
  const { message, sessionId = 'default' } = data;

  if (!message || typeof message !== 'string' || !message.trim()) {
    socket.emit('error', { message: 'Message is required' });
    return;
  }

  logger.info(`[ChatController] Socket chat for session ${sessionId}: "${message}"`);

  try {
    const videoContext = getVideoContext(sessionId);
    const conversationHistory = getMessageHistory(sessionId);

    // Add user message to memory
    addMessage(sessionId, 'user', message);

    // Emit typing indicator
    socket.emit('stream_start', { sessionId, queryType: 'classifying...' });

    // Streaming callback — emits each token as it arrives
    const onToken = (token) => {
      socket.emit('stream_token', { token, sessionId });
    };

    const result = await runAgentGraph({
      userMessage: message.trim(),
      sessionId,
      videoContext,
      conversationHistory,
      onToken,
      socket,
    });

    // Save assistant response to memory
    addMessage(sessionId, 'assistant', result.finalResponse);

    logger.info(`[ChatController] Stream completed for session ${sessionId}`);
  } catch (err) {
    logger.error('[ChatController] Socket error:', err);
    socket.emit('stream_error', {
      message: 'An error occurred while processing your request.',
      detail: err.message,
    });
  }
}
