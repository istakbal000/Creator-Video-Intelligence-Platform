/**
 * Whisper Transcription Service
 *
 * Transcribes audio files using the local Whisper model via subprocess.
 * Requires: pip install openai-whisper
 * Requires: ffmpeg installed and in PATH
 */

import fs from 'fs';
import path from 'path';
import { spawnWithTimeout } from '../../utils/validators.js';
import logger from '../../utils/logger.js';

const WHISPER_MODEL   = process.env.WHISPER_MODEL || 'base';
const TEMP_DIR        = process.env.TEMP_DIR || './tmp';
const WHISPER_TIMEOUT = 120_000; // 120 s wall-clock limit

/**
 * Transcribes an audio file using Whisper CLI.
 *
 * @param {string} audioFilePath - Absolute path to the audio file
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeWithWhisper(audioFilePath) {
  logger.info(`[Whisper] Transcribing: ${audioFilePath} with model: ${WHISPER_MODEL}`);

  // Ensure temp output directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const outputDir = path.dirname(audioFilePath);

  const args = [
    audioFilePath,
    '--model', WHISPER_MODEL,
    '--output_format', 'txt',
    '--output_dir', outputDir,
    '--fp16', 'False', // Disable FP16 for CPU-only systems
    '--language', 'en',
  ];

  const { promise } = spawnWithTimeout('whisper', args, WHISPER_TIMEOUT);

  let result;
  try {
    result = await promise;
  } catch (err) {
    // Covers both timeout and spawn failures
    if (err.message.includes('timed out')) {
      throw new Error(`Whisper transcription timed out after ${WHISPER_TIMEOUT / 1000}s`);
    }
    throw new Error(
      `Whisper is not installed or not in PATH. Install with: pip install openai-whisper. ` +
      `Original error: ${err.message}`
    );
  }

  const { code, stderr } = result;

  if (code !== 0) {
    logger.error(`[Whisper] Process exited with code ${code}: ${stderr}`);
    throw new Error(`Whisper transcription failed (exit ${code}): ${stderr.slice(0, 400)}`);
  }

  // Whisper outputs <filename>.txt in the same directory
  const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
  const txtPath  = path.join(outputDir, `${baseName}.txt`);

  if (!fs.existsSync(txtPath)) {
    throw new Error(`Whisper output file not found: ${txtPath}`);
  }

  const transcript = fs.readFileSync(txtPath, 'utf-8').trim();
  logger.info(`[Whisper] Transcription complete. Length: ${transcript.length} chars`);

  // Cleanup transcript file
  try {
    fs.unlinkSync(txtPath);
  } catch (e) {
    logger.warn(`[Whisper] Could not delete temp file: ${txtPath}`);
  }

  return transcript;
}
