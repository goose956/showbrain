import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TMP_DIR = join(tmpdir(), 'showbrain-audio');

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// Resolve yt-dlp binary — handles Nix store paths on Railway
function resolveYtDlp() {
  // Log environment to help diagnose path issues
  try {
    const path = execSync('echo $PATH', { encoding: 'utf8' }).trim();
    console.log('[ytdlp] PATH:', path);
  } catch {}
  try {
    const found = execSync('find /nix -name "yt-dlp" -type f 2>/dev/null | head -5', { encoding: 'utf8' }).trim();
    console.log('[ytdlp] find /nix result:', found || '(none)');
  } catch {}
  try {
    const found = execSync('which yt-dlp 2>/dev/null || true', { encoding: 'utf8' }).trim();
    console.log('[ytdlp] which result:', found || '(not on PATH)');
  } catch {}

  const candidates = [
    'yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    '/root/.local/bin/yt-dlp',
    '/home/user/.local/bin/yt-dlp',
    '/root/.nix-profile/bin/yt-dlp',
    '/nix/var/nix/profiles/default/bin/yt-dlp',
    '/nix/var/nix/profiles/system/sw/bin/yt-dlp',
  ];
  for (const bin of candidates) {
    try {
      execSync(`${bin} --version`, { stdio: 'ignore' });
      console.log('[ytdlp] resolved:', bin);
      return { cmd: bin, args: [] };
    } catch {}
  }
  // Last resort: python module
  try {
    execSync('python3 -m yt_dlp --version', { stdio: 'ignore' });
    console.log('[ytdlp] resolved: python3 -m yt_dlp');
    return { cmd: 'python3', args: ['-m', 'yt_dlp'] };
  } catch {}
  throw new Error('yt-dlp not found — checked PATH, Nix profile, and python3 -m yt_dlp');
}

let _ytdlp = null;
function getYtDlp() {
  if (!_ytdlp) _ytdlp = resolveYtDlp();
  return _ytdlp;
}

export function downloadAudio(youtubeUrl, videoId) {
  return new Promise((resolve, reject) => {
    const outputPath = join(TMP_DIR, `${videoId}.%(ext)s`);

    // If already downloaded, skip
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

// Clean up a downloaded audio file
export function cleanupAudio(filePath) {
  try {
    if (existsSync(filePath)) {
      import('fs').then(({ unlinkSync }) => unlinkSync(filePath));
    }
  } catch {}
}
