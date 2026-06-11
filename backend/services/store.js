import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

mkdirSync(DATA_DIR, { recursive: true });

const CHANNELS_FILE = join(DATA_DIR, 'channels.json');
const EPISODES_FILE = join(DATA_DIR, 'episodes.json');
const CLICKS_FILE   = join(DATA_DIR, 'clicks.json');

function read(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function write(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── channels (array) ──────────────────────────────────────────────────────────

export function getChannels() {
  return read(CHANNELS_FILE, []);
}

export function getChannel(channelId) {
  return getChannels().find(c => c.id === channelId) || null;
}

export function upsertChannel(channel) {
  const channels = getChannels();
  const idx = channels.findIndex(c => c.id === channel.id);
  if (idx >= 0) {
    channels[idx] = { ...channels[idx], ...channel };
  } else {
    channels.push(channel);
  }
  write(CHANNELS_FILE, channels);
  return channel;
}

export function deleteChannel(channelId) {
  const channels = getChannels().filter(c => c.id !== channelId);
  write(CHANNELS_FILE, channels);
  // Also remove all episodes for this channel
  const episodes = getEpisodes().filter(e => e.channelId !== channelId);
  write(EPISODES_FILE, episodes);
}

// ── episodes (flat array, each has channelId) ─────────────────────────────────

export function getEpisodes(channelId = null) {
  const all = read(EPISODES_FILE, []);
  return channelId ? all.filter(e => e.channelId === channelId) : all;
}

export function saveEpisodes(episodes) {
  write(EPISODES_FILE, episodes);
}

export function upsertEpisode(episode) {
  const all = read(EPISODES_FILE, []);
  const idx = all.findIndex(e => e.id === episode.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...episode };
  } else {
    all.unshift(episode);
  }
  write(EPISODES_FILE, all);
  return episode;
}

export function getEpisodeByVideoId(videoId, channelId = null) {
  const all = read(EPISODES_FILE, []);
  return all.find(e => e.videoId === videoId && (!channelId || e.channelId === channelId)) || null;
}

// ── clicks (flat array) ───────────────────────────────────────────────────────

export function getClicks() {
  return read(CLICKS_FILE, []);
}

export function logClick({ postId, platform, episodeId, episodeTitle, youtubeUrl, ref }) {
  const clicks = read(CLICKS_FILE, []);
  clicks.push({
    id: `click-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    postId,
    platform,
    episodeId,
    episodeTitle,
    youtubeUrl,
    ref: ref || null,
    clickedAt: new Date().toISOString(),
  });
  write(CLICKS_FILE, clicks);
}
