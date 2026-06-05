/**
 * Chat Routes
 * POST /api/chat
 * GET  /api/history
 */

import express from 'express';
import { handleChat, getHistory } from '../controllers/chatController.js';

const router = express.Router();

/**
 * @route   POST /api/chat
 * @desc    Send a chat message (non-streaming REST fallback)
 * @access  Public
 */
router.post('/', handleChat);

/**
 * @route   GET /api/history
 * @desc    Get conversation history for a session
 * @access  Public
 */
router.get('/history', getHistory);

export default router;
