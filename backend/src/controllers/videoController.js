import { getYouTubeMetadata } from '../services/metadata/youtubeMetadata.js';
import { getInstagramMetadata } from '../services/metadata/instagramMetadata.js';
import { getYouTubeTranscript } from '../services/transcript/youtubeTranscript.js';
import { getInstagramTranscript } from '../services/transcript/instagramTranscript.js';
import { chunkTranscript } from '../services/chunking/chunkStrategy.js';
import { generateEmbeddingsBatch } from '../services/embeddings/bgeEmbeddings.js';
import {
  ensureCollection,
  upsertChunks,
  videoAlreadyIndexed,
  deleteVideoChunks,
} from '../services/vector/qdrantService.js';
import { setVideoContext } from '../memory/conversationMemory.js';
import { isValidYouTubeUrl, isValidInstagramUrl, normalizeYouTubeUrl } from '../utils/validators.js';
import logger from '../utils/logger.js';

/** Maximum wall-clock time for the full analysis pipeline (3 minutes) */
const PIPELINE_TIMEOUT_MS = 180_000;

/**
 * POST /api/videos/analyze
 *
 * Accepts YouTube + Instagram URLs and runs the full analysis pipeline.
 * Returns metadata for both videos and indexing status.
 */
export async function analyzeVideos(req, res) {
  const { youtubeUrl: rawYoutubeUrl, instagramUrl, sessionId = 'default' } = req.body;

  // Validate inputs
  const validationErrors = [];
  if (!rawYoutubeUrl || !isValidYouTubeUrl(rawYoutubeUrl)) {
    validationErrors.push('Invalid or missing YouTube URL');
  }
  if (!instagramUrl || !isValidInstagramUrl(instagramUrl)) {
    validationErrors.push('Invalid or missing Instagram URL');
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: validationErrors });
  }

  // Normalise Shorts / youtu.be → canonical watch URL
  const youtubeUrl = normalizeYouTubeUrl(rawYoutubeUrl);
  if (youtubeUrl !== rawYoutubeUrl) {
    logger.info(`[VideoController] Normalised YouTube URL: ${rawYoutubeUrl} → ${youtubeUrl}`);
  }

  logger.info(`[VideoController] Analyzing: YT=${youtubeUrl}, IG=${instagramUrl}`);

  // Wrap the pipeline in a hard timeout so the HTTP response is always sent
  const pipelineTimeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Analysis pipeline timed out after ${PIPELINE_TIMEOUT_MS / 1000}s`)),
      PIPELINE_TIMEOUT_MS
    )
  );

  try {
    const result = await Promise.race([runPipeline(youtubeUrl, instagramUrl, sessionId), pipelineTimeout]);
    return res.json(result);
  } catch (err) {
    logger.error('[VideoController] Analysis failed:', err);
    return res.status(500).json({
      error: 'Video analysis failed',
      message: err.message,
    });
  }
}

/**
 * Core pipeline — separated so it can be raced against a timeout promise.
 */
async function runPipeline(youtubeUrl, instagramUrl, sessionId) {
  // Step 1: Ensure Qdrant collection exists
  await ensureCollection();

  // Step 2: Fetch metadata in parallel
  logger.info('[VideoController] Fetching metadata...');
  const [metadataA, metadataB] = await Promise.allSettled([
    getYouTubeMetadata(youtubeUrl),
    getInstagramMetadata(instagramUrl),
  ]);

  const videoA = metadataA.status === 'fulfilled'
    ? metadataA.value
    : createFallbackMetadata('youtube', youtubeUrl, metadataA.reason?.message);

  const videoB = metadataB.status === 'fulfilled'
    ? metadataB.value
    : createFallbackMetadata('instagram', instagramUrl, metadataB.reason?.message);

  // Step 3: Fetch transcripts in parallel
  logger.info('[VideoController] Fetching transcripts...');
  const [transcriptA, transcriptB] = await Promise.allSettled([
    getYouTubeTranscript(youtubeUrl),
    getInstagramTranscript(instagramUrl),
  ]);

  // Step 4: Index transcripts in Qdrant
  const indexResults = await Promise.allSettled([
    indexTranscript(transcriptA, videoA, 'A'),
    indexTranscript(transcriptB, videoB, 'B'),
  ]);

  videoA.transcriptAvailable = transcriptA.status === 'fulfilled' && transcriptA.value?.transcriptAvailable !== false;
  videoA.transcriptSource    = transcriptA.status === 'fulfilled' ? transcriptA.value.source : null;
  videoA.transcriptError     = transcriptA.status === 'rejected'  ? transcriptA.reason?.message : null;
  videoA.chunkCount          = indexResults[0].status === 'fulfilled' ? indexResults[0].value : 0;

  videoB.transcriptAvailable = transcriptB.status === 'fulfilled' && transcriptB.value?.transcriptAvailable !== false;
  videoB.transcriptSource    = transcriptB.status === 'fulfilled' ? transcriptB.value.source : null;
  videoB.transcriptError     = transcriptB.status === 'rejected'  ? transcriptB.reason?.message
                               : (transcriptB.value?.authBlocked ? 'Instagram auth-blocked (Login required on server)' : null);
  videoB.chunkCount          = indexResults[1].status === 'fulfilled' ? indexResults[1].value : 0;

  // Step 5: Store context in session memory
  setVideoContext(sessionId, { videoA, videoB });

  logger.info(`[VideoController] Analysis complete. A: ${videoA.title}, B: ${videoB.title}`);

  return {
    success: true,
    sessionId,
    videoA,
    videoB,
    indexed: {
      videoA: videoA.chunkCount > 0,
      videoB: videoB.chunkCount > 0,
    },
  };
}

/**
 * Chunks, embeds, and upserts a transcript into Qdrant.
 *
 * @param {PromiseSettledResult} transcriptResult
 * @param {Object} metadata
 * @param {string} videoId - 'A' or 'B'
 * @returns {Promise<number>} - Number of chunks indexed
 */
async function indexTranscript(transcriptResult, metadata, videoId) {
  if (transcriptResult.status === 'rejected') {
    logger.warn(`[VideoController] Transcript unavailable for Video ${videoId}: ${transcriptResult.reason?.message}`);
    return 0;
  }

  const { transcript } = transcriptResult.value;
  if (!transcript || transcript.trim().length === 0) {
    logger.warn(`[VideoController] Empty transcript for Video ${videoId}`);
    return 0;
  }

  // Check for duplicates — skip re-indexing if already done
  const alreadyIndexed = await videoAlreadyIndexed(videoId);
  if (alreadyIndexed) {
    logger.info(`[VideoController] Video ${videoId} already indexed — deleting and re-indexing`);
    await deleteVideoChunks(videoId);
  }

  // Chunk transcript
  const chunks = chunkTranscript(transcript, {
    videoId,
    platform: metadata.platform,
    videoUrl: metadata.url,
  });

  if (chunks.length === 0) {
    logger.warn(`[VideoController] No chunks generated for Video ${videoId}`);
    return 0;
  }

  // Generate embeddings in batch
  const texts = chunks.map((c) => c.content);
  const embeddings = await generateEmbeddingsBatch(texts);

  // Attach embeddings to chunks
  const chunksWithEmbeddings = chunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }));

  // Upsert to Qdrant
  await upsertChunks(chunksWithEmbeddings);
  logger.info(`[VideoController] Indexed ${chunks.length} chunks for Video ${videoId}`);

  return chunks.length;
}

/**
 * Creates a fallback metadata object when extraction fails.
 *
 * @param {string} platform
 * @param {string} url
 * @param {string} errorMessage
 * @returns {Object}
 */
function createFallbackMetadata(platform, url, errorMessage) {
  return {
    platform,
    url,
    title: 'Metadata unavailable',
    creator: 'Unknown',
    views: 0,
    likes: 0,
    comments: 0,
    duration: 0,
    durationFormatted: 'N/A',
    uploadDate: 'Unknown',
    hashtags: [],
    thumbnailUrl: null,
    engagementRate: 0,
    followerCount: 'unavailable',
    error: errorMessage,
  };
}
