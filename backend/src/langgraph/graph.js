import { StateGraph, END } from '@langchain/langgraph';
import { queryClassifierNode } from './nodes/queryClassifier.js';
import { metadataRetrieverNode } from './nodes/metadataRetriever.js';
import { vectorRetrieverNode } from './nodes/vectorRetriever.js';
import { contextFusionNode } from './nodes/contextFusion.js';
import { geminiGeneratorNode } from './nodes/geminiGenerator.js';
import { citationFormatterNode } from './nodes/citationFormatter.js';
import { streamingNode } from './nodes/streamingNode.js';
import logger from '../utils/logger.js';

/**
 * Routing function: determines which retrieval nodes to run
 * based on the classified query type.
 *
 * @param {Object} state
 * @returns {string[]} - Next node names
 */
function routeAfterClassification(state) {
  const { queryType } = state;
  logger.info(`[Graph] Routing for query type: ${queryType}`);

  switch (queryType) {
    case 'metadata_query':
      return ['metadata_retriever'];
    case 'transcript_query':
      return ['vector_retriever'];
    case 'hybrid_query':
    default:
      return ['metadata_retriever', 'vector_retriever'];
  }
}

/**
 * Builds and compiles the LangGraph workflow.
 * @returns {CompiledGraph}
 */
export function buildAgentGraph() {
  const graph = new StateGraph({
    channels: {
      // Input
      userMessage: { value: (x, y) => y ?? x, default: () => '' },
      sessionId: { value: (x, y) => y ?? x, default: () => 'default' },
      videoContext: { value: (x, y) => y ?? x, default: () => null },
      conversationHistory: { value: (x, y) => y ?? x, default: () => [] },
      onToken: { value: (x, y) => y ?? x, default: () => null },
      socket: { value: (x, y) => y ?? x, default: () => null },

      // Classification
      queryType: { value: (x, y) => y ?? x, default: () => 'hybrid_query' },

      // Retrieval
      metadataContext: { value: (x, y) => y ?? x, default: () => null },
      retrievedChunks: { value: (x, y) => y ?? x, default: () => [] },

      // Fusion
      fusedContext: { value: (x, y) => y ?? x, default: () => '' },
      sourceCitations: { value: (x, y) => y ?? x, default: () => [] },

      // Generation
      generatedResponse: { value: (x, y) => y ?? x, default: () => '' },

      // Output
      finalResponse: { value: (x, y) => y ?? x, default: () => '' },
      formattedCitations: { value: (x, y) => y ?? x, default: () => [] },
      streamComplete: { value: (x, y) => y ?? x, default: () => false },

      // Error tracking
      vectorSearchError: { value: (x, y) => y ?? x, default: () => null },
      generationError: { value: (x, y) => y ?? x, default: () => null },
    },
  });

  // Add nodes
  graph.addNode('query_classifier', queryClassifierNode);
  graph.addNode('metadata_retriever', metadataRetrieverNode);
  graph.addNode('vector_retriever', vectorRetrieverNode);
  graph.addNode('context_fusion', contextFusionNode);
  graph.addNode('gemini_generator', geminiGeneratorNode);
  graph.addNode('citation_formatter', citationFormatterNode);
  graph.addNode('streaming_node', streamingNode);

  // Entry point
  graph.setEntryPoint('query_classifier');

  // Conditional routing after classification
  graph.addConditionalEdges('query_classifier', routeAfterClassification, {
    metadata_retriever: 'metadata_retriever',
    vector_retriever: 'vector_retriever',
  });

  // Both retrieval nodes converge at context_fusion
  graph.addEdge('metadata_retriever', 'context_fusion');
  graph.addEdge('vector_retriever', 'context_fusion');

  // Linear pipeline after fusion
  graph.addEdge('context_fusion', 'gemini_generator');
  graph.addEdge('gemini_generator', 'citation_formatter');
  graph.addEdge('citation_formatter', 'streaming_node');
  graph.addEdge('streaming_node', END);

  return graph.compile();
}

/**
 * Runs the Agentic Hybrid RAG workflow.
 *
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {string} params.sessionId
 * @param {Object} params.videoContext
 * @param {Array} params.conversationHistory
 * @param {Function} params.onToken - Streaming callback
 * @param {Object} params.socket - Socket.IO socket
 * @returns {Promise<Object>} - Final graph state
 */
export async function runAgentGraph(params) {
  const graph = buildAgentGraph();

  const initialState = {
    userMessage: params.userMessage,
    sessionId: params.sessionId,
    videoContext: params.videoContext,
    conversationHistory: params.conversationHistory || [],
    onToken: params.onToken || null,
    socket: params.socket || null,
  };

  logger.info(`[AgentGraph] Running for session ${params.sessionId}: "${params.userMessage}"`);

  try {
    const result = await graph.invoke(initialState);
    logger.info('[AgentGraph] Workflow completed successfully');
    return result;
  } catch (err) {
    logger.error('[AgentGraph] Workflow error:', err);
    throw err;
  }
}
