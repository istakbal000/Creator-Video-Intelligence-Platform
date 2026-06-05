/**
 * LangGraph Node 2: Metadata Retriever
 *
 * Retrieves structured metadata for both videos from the
 * in-memory video context (set during analysis).
 */

import logger from '../../utils/logger.js';

/**
 * Retrieves metadata context for both videos.
 *
 * @param {Object} state - LangGraph state
 * @returns {Object} - Updated state with metadataContext
 */
export async function metadataRetrieverNode(state) {
  const { videoContext, queryType } = state;

  // Skip if this is a pure transcript query
  if (queryType === 'transcript_query') {
    logger.info('[MetadataRetriever] Skipping — transcript_query only');
    return { ...state, metadataContext: null };
  }

  logger.info('[MetadataRetriever] Retrieving metadata context');

  if (!videoContext || (!videoContext.videoA && !videoContext.videoB)) {
    logger.warn('[MetadataRetriever] No video context available');
    return { ...state, metadataContext: null };
  }

  const { videoA, videoB } = videoContext;

  const formatVideo = (video, label) => {
    if (!video) return `Video ${label}: No data available`;
    return `
Video ${label} (${video.platform?.toUpperCase()}):
  Title: ${video.title}
  Creator: ${video.creator}
  Views: ${video.views?.toLocaleString() ?? 'N/A'}
  Likes: ${video.likes?.toLocaleString() ?? 'N/A'}
  Comments: ${video.comments?.toLocaleString() ?? 'N/A'}
  Duration: ${video.durationFormatted ?? 'N/A'}
  Upload Date: ${video.uploadDate ?? 'N/A'}
  Engagement Rate: ${video.engagementRate ?? 'N/A'}%
  Hashtags: ${(video.hashtags || []).join(', ') || 'None'}
  Follower Count: ${video.followerCount ?? 'unavailable'}
    `.trim();
  };

  const metadataContext = [
    formatVideo(videoA, 'A'),
    formatVideo(videoB, 'B'),
  ].join('\n\n');

  logger.info('[MetadataRetriever] Metadata context prepared');
  return { ...state, metadataContext };
}
