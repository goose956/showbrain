import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = join(__dirname, '..', 'data');

mkdirSync(DATA_ROOT, { recursive: true });

// ── per-user helpers ──────────────────────────────────────────────────────────

function userDir(userId) {
  const dir = join(DATA_ROOT, userId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function read(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function write(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function paths(userId) {
  const dir = userDir(userId);
  return {
    channels:  join(dir, 'channels.json'),
    episodes:  join(dir, 'episodes.json'),
    clicks:    join(dir, 'clicks.json'),
  };
}

// ── channels ──────────────────────────────────────────────────────────────────

export function getChannels(userId) {
  return read(paths(userId).channels, []);
}

export function getChannel(userId, channelId) {
  return getChannels(userId).find(c => c.id === channelId) || null;
}

export function upsertChannel(userId, channel) {
  const channels = getChannels(userId);
  const idx = channels.findIndex(c => c.id === channel.id);
  if (idx >= 0) channels[idx] = { ...channels[idx], ...channel };
  else channels.push(channel);
  write(paths(userId).channels, channels);
  return channel;
}

export function deleteChannel(userId, channelId) {
  write(paths(userId).channels, getChannels(userId).filter(c => c.id !== channelId));
  write(paths(userId).episodes, getEpisodes(userId).filter(e => e.channelId !== channelId));
}

// ── episodes ──────────────────────────────────────────────────────────────────

export function getEpisodes(userId, channelId = null) {
  const all = read(paths(userId).episodes, []);
  return channelId ? all.filter(e => e.channelId === channelId) : all;
}

export function upsertEpisode(userId, episode) {
  const all = read(paths(userId).episodes, []);
  const idx = all.findIndex(e => e.id === episode.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...episode };
  else all.unshift(episode);
  write(paths(userId).episodes, all);
  return episode;
}

export function getEpisodeByVideoId(userId, videoId, channelId = null) {
  const all = read(paths(userId).episodes, []);
  return all.find(e => e.videoId === videoId && (!channelId || e.channelId === channelId)) || null;
}

// ── clicks ────────────────────────────────────────────────────────────────────

export function getClicks(userId) {
  return read(paths(userId).clicks, []);
}

export function logClick(userId, { postId, platform, episodeId, episodeTitle, youtubeUrl, ref }) {
  const clicks = read(paths(userId).clicks, []);
  clicks.push({
    id: `click-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    postId, platform, episodeId, episodeTitle, youtubeUrl,
    ref: ref || null,
    clickedAt: new Date().toISOString(),
  });
  write(paths(userId).clicks, clicks);
}

// ── members (global registry) ────────────────────────────────────────────────

const MEMBERS_FILE = join(DATA_ROOT, 'members.json');

export function getMembers() {
  return read(MEMBERS_FILE, []);
}

export function getMemberById(id) {
  return getMembers().find(m => m.id === id) || null;
}

export function getMemberByUsername(username) {
  return getMembers().find(m => m.username.toLowerCase() === username.toLowerCase()) || null;
}

export function createMember({ id, username, passwordHash, role = 'member' }) {
  const members = getMembers();
  members.push({ id, username, passwordHash, role, createdAt: new Date().toISOString() });
  write(MEMBERS_FILE, members);
}

export function deleteMember(id) {
  write(MEMBERS_FILE, getMembers().filter(m => m.id !== id));
}

// ── waitlist (global, not per-user) ──────────────────────────────────────────

const WAITLIST_FILE = join(DATA_ROOT, 'waitlist.json');

export function addWaitlistEmail(email) {
  const list = read(WAITLIST_FILE, []);
  if (list.find(e => e.email === email)) return list.length;
  list.push({ email, joinedAt: new Date().toISOString() });
  write(WAITLIST_FILE, list);
  return list.length;
}
