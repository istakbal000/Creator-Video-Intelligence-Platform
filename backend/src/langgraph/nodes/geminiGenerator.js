/**
 * LangGraph Node 5: Gemini Generator
 *
 * Generates a grounded response using Gemini 2.5 Flash.
 * Uses only retrieved context — never hallucinates.
 * Supports streaming via callbacks.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import logger from '../../utils/logger.js';

const SYSTEM_PROMPT = `You are an expert video content analyst and social media strategist.
You help content creators understand the performance and content quality of their videos.

CRITICAL RULES:
1. Only use information from the provided context below. Never hallucinate data.
2. If data is not in the context, say "This information is not available in the provided data."
3. Be specific and reference actual numbers/quotes from the context.
4. For comparisons, be balanced and objective.
5. Provide actionable insights when possible.
6. Format your response clearly using markdown.

You are analyzing two videos:
- Video A: YouTube video
- Video B: Instagram Reel

Always refer to them as "Video A" and "Video B" unless you know their titles.`;

/**
 * Generates a response using Gemini 2.5 Flash.
 * For streaming, pass an onToken callback in state.
 *
 * @param {Object} state - LangGraph state
 * @returns {Object} - Updated state with generatedResponse
 */
export async function geminiGeneratorNode(state) {
  const {
    userMessage,
    fusedContext,
    conversationHistory,
    onToken,
    queryType,
  } = state;

  logger.info('[GeminiGenerator] Generating response...');

  // Build the prompt with full context
  const contextBlock = fusedContext
    ? `\n\n=== RETRIEVED CONTEXT ===\n${fusedContext}\n=== END CONTEXT ===`
    : '\n\n[No context available — answer based on your general knowledge only, and note that no video data was retrieved]';

  // Build conversation history for multi-turn memory
  const historyMessages = (conversationHistory || []).slice(-6).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    content: m.content,
  }));

  const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.3,
    maxOutputTokens: 2048,
    streaming: !!onToken,
  });

  // Compose messages
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + contextBlock },
    ...historyMessages,
    { role: 'user', content: userMessage },
  ];

  try {
    let generatedResponse = '';

    if (onToken) {
      // Streaming mode
      const stream = await llm.stream(messages);
      for await (const chunk of stream) {
        const token = chunk.content?.toString() || '';
        if (token) {
          generatedResponse += token;
          onToken(token);
        }
      }
    } else {
      // Non-streaming mode
      const response = await llm.invoke(messages);
      generatedResponse = response.content.toString();
    }

    logger.info(`[GeminiGenerator] Response generated (${generatedResponse.length} chars)`);
    return { ...state, generatedResponse };
  } catch (err) {
    logger.error('[GeminiGenerator] Error:', err.message);
    const errorResponse =
      'I encountered an error generating a response. Please check your GOOGLE_API_KEY and try again.';
    if (onToken) onToken(errorResponse);
    return { ...state, generatedResponse: errorResponse, generationError: err.message };
  }
}
