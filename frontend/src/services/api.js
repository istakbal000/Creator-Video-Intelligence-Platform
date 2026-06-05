import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min — video analysis can take time
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

/**
 * Analyze YouTube and Instagram videos.
 *
 * @param {string} youtubeUrl
 * @param {string} instagramUrl
 * @param {string} sessionId
 * @returns {Promise<{videoA: Object, videoB: Object, sessionId: string}>}
 */
export async function analyzeVideos(youtubeUrl, instagramUrl, sessionId) {
  return api.post('/videos/analyze', { youtubeUrl, instagramUrl, sessionId });
}

/**
 * Send a chat message (REST, non-streaming).
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {Promise<{response: string, citations: Array, queryType: string}>}
 */
export async function sendChatMessage(message, sessionId) {
  return api.post('/chat', { message, sessionId });
}

/**
 * Fetch conversation history.
 *
 * @param {string} sessionId
 * @returns {Promise<{history: Array, messageCount: number}>}
 */
export async function getHistory(sessionId) {
  return api.get(`/chat/history?sessionId=${sessionId}`);
}

/**
 * Health check.
 */
export async function checkHealth() {
  return api.get('/health');
}

export default api;
