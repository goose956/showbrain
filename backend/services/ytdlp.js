import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TMP_DIR = join(tmpdir(), 'showbrain-audio');
const COOKIES_FILE = join(TMP_DIR, 'yt-cookies.txt');

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// Write cookies from env var once on startup
if (process.env.YOUTUBE_COOKIES && !existsSync(COOKIES_FILE)) {
  writeFileSync(COOKIES_FILE, process.env.YOUTUBE_COOKIES, 'utf8');
  console.log('[ytdlp] Cookies file written from YOUTUBE_COOKIES env var');
}

function resolveYtDlp() {
  const candidates = [
    'yt-dlp',
    '/root/.nix-profile/bin/yt-dlp',
    '/nix/var/nix/profiles/default/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
  ];
  for (const bin of candidates) {
    try {
      execSync(`${bin} --version`, { stdio: 'ignore' });
      console.log('[ytdlp] resolved:', bin);
      return { cmd: bin, args: [] };
    } catch {}
  }
  try {
    execSync('python3 -m yt_dlp --version', { stdio: 'ignore' });
    return { cmd: 'python3', args: ['-m', 'yt_dlp'] };
  } catch {}
  throw new Error('yt-dlp not found');
}

let _ytdlp = null;
function getYtDlp() {
  if (!_ytdlp) _ytdlp = resolveYtDlp();
  return _ytdlp;
}

export function getAudioUrl(youtubeUrl) {
  return new Promise((resolve, reject) => {
    let ytdlp;
    try { ytdlp = getYtDlp(); } catch (e) { return reject(e); }

    const args = [
      ...ytdlp.args,
      youtubeUrl,
      '--get-url',
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist',
      '--no-warnings',
    ];

    if (existsSync(COOKIES_FILE)) args.push('--cookies', COOKIES_FILE);

    const proc = spawn(ytdlp.cmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`yt-dlp --get-url failed (${code}): ${stderr}`));
      const url = stdout.trim().split('\n')[0];
      if (!url) return reject(new Error('yt-dlp --get-url returned no URL'));
      resolve(url);
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp (${ytdlp.cmd}): ${err.message}`));
    });
  });
}

export function downloadAudio(youtubeUrl, videoId) {
  return new Promise((resolve, reject) => {
    const outputPath = join(TMP_DIR, `${videoId}.%(ext)s`);
    const exts = ['m4a', 'webm', 'mp4', 'opus', 'ogg'];

    for (const ext of exts) {
      const p = join(TMP_DIR, `${videoId}.${ext}`);
      if (existsSync(p)) return resolve(p);
    }

    let ytdlp;
    try { ytdlp = getYtDlp(); } catch (e) { return reject(e); }

    const args = [
      ...ytdlp.args,
      youtubeUrl,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--output', outputPath,
      '--no-playlist',
      '--quiet',
      '--no-warnings',
    ];

    // Use cookies if available
    if (existsSync(COOKIES_FILE)) {
      args.push('--cookies', COOKIES_FILE);
    }

    const proc = spawn(ytdlp.cmd, args);
    let stderr = '';

    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`yt-dlp failed (${code}): ${stderr}`));
      for (const ext of exts) {
        const p = join(TMP_DIR, `${videoId}.${ext}`);
        if (existsSync(p)) return resolve(p);
      }
      reject(new Error(`yt-dlp finished but output file not found. stderr: ${stderr}`));
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp (${ytdlp.cmd}): ${err.message}`));
    });
  });
}

export function cleanupAudio(filePath) {
  try {
    if (existsSync(filePath)) {
      import('fs').then(({ unlinkSync }) => unlinkSync(filePath));
    }
  } catch {}
}
