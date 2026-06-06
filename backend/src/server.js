import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import videoRoutes from './routes/videos.js';
import chatRoutes from './routes/chat.js';
import { handleSocketChat } from './controllers/chatController.js';
import { setVideoContext } from './memory/conversationMemory.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs and tmp directories exist
const logsDir = path.join(__dirname, '../logs');
const tmpDir = process.env.TEMP_DIR || path.join(__dirname, '../tmp');
[logsDir, tmpDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Express app
const app = express();
const httpServer = createServer(app);

// Build the explicit origin allowlist from env vars (e.g. FRONTEND_URL).
// Note: localhost is NOT handled here — it is permitted via regex in corsOriginHandler below.
const getAllowedOrigins = () => {
  const origins = [
    // Hardcoded fallback to unblock the known Render deployment
    'https://creator-video-intelligence-platform-1.onrender.com'
  ];
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
  }
  return origins;
};

const corsOriginHandler = (origin, callback) => {
  const allowedOrigins = getAllowedOrigins();
  // Allow requests with no origin (e.g. curl, Postman, same-origin)
  if (!origin) return callback(null, true);
  // Allow any localhost port (local dev)
  if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
  // Allow any explicitly configured origin (e.g. the deployed frontend URL)
  if (allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error(`CORS: origin '${origin}' not allowed`));
};

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow dev tools
  })
);

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// API Routes
app.use('/api/videos', videoRoutes);
app.use('/api/chat', chatRoutes);
app.get('/api/history', (req, res) => res.redirect('/api/chat/history?' + new URLSearchParams(req.query)));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Creator Video Intelligence Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  logger.info(`[Socket.IO] Client connected: ${socket.id}`);

  /**
   * chat — User sends a message to the AI
   */
  socket.on('chat', async (data) => {
    logger.info(`[Socket.IO] Chat from ${socket.id}:`, data?.message?.slice(0, 80));
    await handleSocketChat(socket, data);
  });

  /**
   * set_video_context — Client pushes video context after analysis
   */
  socket.on('set_video_context', ({ sessionId, videoA, videoB }) => {
    setVideoContext(sessionId, { videoA, videoB });
    logger.info(`[Socket.IO] Video context set for session: ${sessionId}`);
    socket.emit('context_ready', { sessionId });
  });

  socket.on('disconnect', (reason) => {
    logger.info(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });

  socket.on('error', (err) => {
    logger.error(`[Socket.IO] Error on ${socket.id}:`, err);
  });
});

// Start Server
const PORT = parseInt(process.env.PORT || '5000', 10);

httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, io };
