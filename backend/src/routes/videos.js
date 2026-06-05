/**
 * Video Routes
 * POST /api/videos/analyze
 */

import express from 'express';
import { analyzeVideos } from '../controllers/videoController.js';

const router = express.Router();

/**
 * @route   POST /api/videos/analyze
 * @desc    Analyze YouTube and Instagram videos
 * @access  Public
 */
router.post('/analyze', analyzeVideos);

export default router;
