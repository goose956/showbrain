import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TMP_DIR = join(tmpdir(), 'showbrain-audio');

// Ensure temp dir exists
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// Download audio from a YouTube URL, return path to the audio file
export function downloadAudio(youtubeUrl, videoId) {
  return new Promise((resolve, reject) => {
    const outputPath = join(TMP_DIR, `${videoId}.%(ext)s`);
    const finalPath = join(TMP_DIR, `${videoId}.m4a`);

    // If already downloaded, skip
    if (existsSync(finalPath)) {
      return resolve(finalPath);
    }

    const args = [
      youtubeUrl,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--output', outputPath,
      '--no-playlist',
      '--quiet',
      '--no-warnings',
    ];

    const proc = spawn('yt-dlp', args);
    let stderr = '';

    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp failed (${code}): ${stderr}`));
      }

      // Find the actual output file (extension may vary)
      const exts = ['m4a', 'webm', 'mp4', 'opus', 'ogg'];
      for (const ext of exts) {
        const p = join(TMP_DIR, `${videoId}.${ext}`);
        if (existsSync(p)) return resolve(p);
      }

      reject(new Error(`yt-dlp finished but output file not found. stderr: ${stderr}`));
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}. Is yt-dlp installed?`));
    });
  });
}

// Clean up a downloaded audio file
export function cleanupAudio(filePath) {
  try {
    if (existsSync(filePath)) {
      import('fs').then(({ unlinkSync }) => unlinkSync(filePath));
    }
  } catch {}
}
