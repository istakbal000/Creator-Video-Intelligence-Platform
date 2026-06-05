/**
 * LangGraph Node 1: Query Classifier
 *
 * Uses Gemini to classify the user query into one of three types:
 *   - metadata_query: Questions about stats, metrics, creator info
 *   - transcript_query: Questions about video content, hooks, storytelling
 *   - hybrid_query: Questions requiring both metadata and transcript context
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import logger from '../../utils/logger.js';

const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
  maxOutputTokens: 50,
});

const CLASSIFICATION_PROMPT = `You are a query classifier for a video analysis system.
Classify the user query into EXACTLY ONE of these three categories:

1. metadata_query — Questions about: view count, likes, comments, engagement rate, creator name, platform, upload date, duration, hashtags, follower count, performance metrics
2. transcript_query — Questions about: video content, hooks, storytelling, scripts, specific moments, what was said, tone, messaging, CTAs, first seconds
3. hybrid_query — Questions requiring both metrics AND content analysis: performance explanations, why one outperformed another, overall comparison, what to improve

Respond with ONLY the category name. No explanation.

Examples:
Q: "What is Video A's engagement rate?" → metadata_query
Q: "Compare the hooks in the first five seconds" → transcript_query
Q: "Why did Video A outperform Video B?" → hybrid_query
Q: "What hashtags were used?" → metadata_query
Q: "What CTA did the creator use?" → transcript_query
Q: "Which video has better content strategy?" → hybrid_query

User Query: {query}

Classification:`;

/**
 * Classifies the user query.
 *
 * @param {Object} state - LangGraph state
 * @returns {Object} - Updated state with queryType
 */
export async function queryClassifierNode(state) {
  const { userMessage, conversationHistory } = state;

  logger.info(`[QueryClassifier] Classifying: "${userMessage}"`);

  try {
    // Include last 2 messages for context-aware classification
    const recentContext = conversationHistory.slice(-2)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const contextualQuery = recentContext
      ? `Previous context:\n${recentContext}\n\nCurrent query: ${userMessage}`
      : userMessage;

    const prompt = CLASSIFICATION_PROMPT.replace('{query}', contextualQuery);
    const response = await llm.invoke(prompt);
    const raw = response.content.toString().trim().toLowerCase();

    let queryType = 'hybrid_query'; // Default to hybrid for best coverage
    if (raw.includes('metadata_query')) queryType = 'metadata_query';
    else if (raw.includes('transcript_query')) queryType = 'transcript_query';
    else if (raw.includes('hybrid_query')) queryType = 'hybrid_query';

    logger.info(`[QueryClassifier] Result: ${queryType}`);
    return { ...state, queryType };
  } catch (err) {
    logger.error('[QueryClassifier] Error:', err.message);
    // Default to hybrid on error to maximize context
    return { ...state, queryType: 'hybrid_query' };
  }
}
