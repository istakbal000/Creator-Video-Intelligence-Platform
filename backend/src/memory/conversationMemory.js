/**
 * Conversation Memory for LangGraph
 *
 * Maintains conversation history as part of LangGraph state.
 * Memory is session-based and stored in-memory.
 * For production: replace with Redis-backed storage.
 */

import logger from '../utils/logger.js';

// In-memory session store: sessionId → message history
const sessions = new Map();

/**
 * Gets or creates a conversation session.
 *
 * @param {string} sessionId
 * @returns {{ messages: Array, videoContext: Object|null }}
 */
export function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      videoContext: null,
      createdAt: Date.now(),
    });
  }
  return sessions.get(sessionId);
}

/**
 * Appends a message to the session history.
 *
 * @param {string} sessionId
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
export function addMessage(sessionId, role, content) {
  const session = getSession(sessionId);
  session.messages.push({
    role,
    content,
    timestamp: Date.now(),
  });

  // Keep last 20 messages to avoid context overflow
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }

  logger.debug(`[Memory] Session ${sessionId}: ${session.messages.length} messages`);
}

/**
 * Sets the video context for a session (metadata for both videos).
 *
 * @param {string} sessionId
 * @param {Object} videoContext - { videoA: metadata, videoB: metadata }
 */
export function setVideoContext(sessionId, videoContext) {
  const session = getSession(sessionId);
  session.videoContext = videoContext;
}

/**
 * Gets the video context for a session.
 *
 * @param {string} sessionId
 * @returns {Object|null}
 */
export function getVideoContext(sessionId) {
  const session = getSession(sessionId);
  return session.videoContext;
}

/**
 * Returns message history formatted for Gemini/LangChain.
 *
 * @param {string} sessionId
 * @returns {Array<{role: string, content: string}>}
 */
export function getMessageHistory(sessionId) {
  return getSession(sessionId).messages;
}

/**
 * Clears a session's conversation history.
 *
 * @param {string} sessionId
 */
export function clearSession(sessionId) {
  sessions.delete(sessionId);
  logger.info(`[Memory] Cleared session: ${sessionId}`);
}

/**
 * Returns all sessions (for monitoring).
 */
export function getSessionStats() {
  return {
    totalSessions: sessions.size,
    sessions: Array.from(sessions.entries()).map(([id, s]) => ({
      id,
      messageCount: s.messages.length,
      hasVideoContext: !!s.videoContext,
      createdAt: s.createdAt,
    })),
  };
}
