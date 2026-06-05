/**
 * Whisper Transcription Service
 *
 * Transcribes audio files using the local Whisper model via subprocess.
 * Requires: pip install openai-whisper
 * Requires: ffmpeg installed and in PATH
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger.js';

const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';
const TEMP_DIR = process.env.TEMP_DIR || './tmp';

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

  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(audioFilePath);

    // whisper <file> --model base --output_format txt --output_dir <dir>
    const whisperProcess = spawn('whisper', [
      audioFilePath,
      '--model', WHISPER_MODEL,
      '--output_format', 'txt',
      '--output_dir', outputDir,
      '--fp16', 'False', // Disable FP16 for CPU-only systems
      '--language', 'en',
    ]);

    let stderr = '';

    whisperProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      logger.debug(`[Whisper stderr] ${data.toString().trim()}`);
    });

    whisperProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[Whisper] Process exited with code ${code}: ${stderr}`);
        reject(new Error(`Whisper transcription failed: ${stderr}`));
        return;
      }

      // Whisper outputs <filename>.txt in the same directory
      const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
      const txtPath = path.join(outputDir, `${baseName}.txt`);

      if (!fs.existsSync(txtPath)) {
        reject(new Error(`Whisper output file not found: ${txtPath}`));
        return;
      }

      const transcript = fs.readFileSync(txtPath, 'utf-8').trim();
      logger.info(`[Whisper] Transcription complete. Length: ${transcript.length} chars`);

      // Cleanup transcript file
      try {
        fs.unlinkSync(txtPath);
      } catch (e) {
        logger.warn(`[Whisper] Could not delete temp file: ${txtPath}`);
      }

      resolve(transcript);
    });

    whisperProcess.on('error', (err) => {
      logger.error('[Whisper] Failed to start process:', err);
      reject(
        new Error(
          'Whisper is not installed or not in PATH. Install with: pip install openai-whisper'
        )
      );
    });
  });
}
