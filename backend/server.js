import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

import { initSchema } from './services/db.js';
import { resolveChannelId, getChannelInfo, getChannelVideosPage, getAllChannelVideos, getVideoDurations } from './services/youtube.js';
import { syncChannel, getSyncState } from './services/sync.js';
import { getChannels, getChannel, upsertChannel, deleteChannel, getEpisodes, getEpisodeByVideoId, getClicks, logClick, addWaitlistEmail, upsertEpisode, getMembers, getMemberById, getMemberByUsername, createMember, deleteMember } from './services/store.js';
import { generatePosts } from './services/analyse.js';
import { hashPassword, verifyPassword, createToken, verifyToken } from './services/auth.js';
import aiRoutes from './routes/ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

const ADMIN_USER = (process.env.ADMIN_USER || 'owner').toLowerCase();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  req.userId   = payload.id;
  req.username = payload.username;
  req.isAdmin  = payload.username.toLowerCase() === ADMIN_USER;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ── auth routes (public) ──────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (username.trim().length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!clean) return res.status(400).json({ error: 'Username can only contain letters, numbers, - and _' });

  try {
    if (await getMemberByUsername(clean)) return res.status(409).json({ error: 'Username already taken' });

    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const members = await getMembers();
    const isFirst = members.length === 0;
    await createMember({ id, username: clean, passwordHash, role: isFirst ? 'admin' : 'member' });

    const token = createToken({ id, username: clean, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    console.log(`[auth] Registered: ${clean}${isFirst ? ' (admin)' : ''}`);
    res.json({ token, username: clean, isAdmin: clean === ADMIN_USER || isFirst });
  } catch (err) {
    console.error('[auth/register]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const member = await getMemberByUsername(username.trim().toLowerCase());
    if (!member) return res.status(401).json({ error: 'Invalid username or password' });

    const ok = await verifyPassword(password, member.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

    const token = createToken({ id: member.id, username: member.username, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    console.log(`[auth] Login: ${member.username}`);
    res.json({ token, username: member.username, isAdmin: member.username === ADMIN_USER });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const member = await getMemberById(req.userId);
    if (!member) return res.status(401).json({ error: 'User not found' });
    res.json({ id: req.userId, username: req.username, isAdmin: req.isAdmin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── admin routes ──────────────────────────────────────────────────────────────

app.get('/api/admin/members', requireAdmin, async (req, res) => {
  try {
    const members = (await getMembers()).map(({ passwordHash: _, ...m }) => m);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/members/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.userId) return res.status(400).json({ error: "You can't delete yourself" });
  try {
    await deleteMember(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── all routes below require auth ─────────────────────────────────────────────

app.use('/api', requireAuth);
app.use('/api/ai', aiRoutes);

// ── channels ──────────────────────────────────────────────────────────────────

app.get('/api/channels', async (req, res) => {
  try {
    const [channels, allEpisodes] = await Promise.all([
      getChannels(req.userId),
      getEpisodes(req.userId),
    ]);
    res.json(channels.map(ch => ({
      ...ch,
      episodeCount: allEpisodes.filter(e => e.channelId === ch.id).length,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/channels', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const channelId = await resolveChannelId(url);
    if (await getChannel(req.userId, channelId)) return res.status(409).json({ error: 'Channel already added' });
    const info = await getChannelInfo(channelId);
    const channel = { ...info, addedAt: new Date().toISOString(), lastSyncedAt: null };
    await upsertChannel(req.userId, channel);
    res.json({ channel });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/channels/:id', async (req, res) => {
  try {
    await deleteChannel(req.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/channels/:id', async (req, res) => {
  try {
    const channel = await getChannel(req.userId, req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (req.body.isPrimary === true) {
      const all = await getChannels(req.userId);
      await Promise.all(
        all.filter(ch => ch.id !== req.params.id && ch.isPrimary)
           .map(ch => upsertChannel(req.userId, { ...ch, isPrimary: false }))
      );
    }
    const updated = { ...channel, ...req.body };
    await upsertChannel(req.userId, updated);
    res.json({ channel: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── video picker ──────────────────────────────────────────────────────────────

app.get('/api/channels/:id/videos', async (req, res) => {
  try {
    const channel = await getChannel(req.userId, req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const { pageToken, loadAll } = req.query;
    if (loadAll === 'true') {
      const videos = await getAllChannelVideos(channel.id);
      const tagged = await Promise.all(videos.map(async v => ({
        ...v,
        transcribed: !!(await getEpisodeByVideoId(req.userId, v.videoId, channel.id))?.transcript,
      })));
      res.json({ videos: tagged, nextPageToken: null, total: videos.length });
    } else {
      const { videos, nextPageToken, totalResults } = await getChannelVideosPage(channel.id, { pageToken: pageToken || null });
      const tagged = await Promise.all(videos.map(async v => ({
        ...v,
        transcribed: !!(await getEpisodeByVideoId(req.userId, v.videoId, channel.id))?.transcript,
      })));
      res.json({ videos: tagged, nextPageToken, total: totalResults });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── sync ──────────────────────────────────────────────────────────────────────

app.get('/api/sync/status', (req, res) => res.json(getSyncState(req.userId)));

app.post('/api/channels/:id/fetch-stats', async (req, res) => {
  try {
    const channel = await getChannel(req.userId, req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json({ ok: true });
    const userId = req.userId;
    ;(async () => {
      const state = getSyncState(userId);
      try {
        Object.assign(state, { running: true, userId, channelId: channel.id, channelName: channel.name, errors: [], processed: 0, progress: 0, currentVideo: 'Fetching video list…' });
        const videos = await getAllChannelVideos(channel.id);
        state.total = videos.length;
        const BATCH = 50;
        for (let i = 0; i < videos.length; i += BATCH) {
          const batch = videos.slice(i, i + BATCH);
          const stats = await getVideoDurations(batch.map(v => v.videoId));
          for (const v of batch) {
            const s = stats[v.videoId] || {};
            await upsertEpisode(userId, {
              id: `yt-${v.videoId}`, videoId: v.videoId, channelId: channel.id,
              channelName: channel.name, title: v.title, show: channel.name,
              publishedAt: v.publishedAt?.split('T')[0], duration: s.duration || 0,
              youtubeUrl: v.youtubeUrl, thumbnail: v.thumbnail,
              viewCount: s.viewCount || 0, likeCount: s.likeCount || 0,
              commentCount: s.commentCount || 0, statsOnly: true,
            });
            state.processed++;
            state.progress = Math.round((state.processed / state.total) * 100);
          }
        }
        await upsertChannel(userId, { ...channel, lastSyncedAt: new Date().toISOString() });
      } catch (err) {
        state.errors.push({ error: err.message });
      } finally {
        Object.assign(state, { running: false, currentVideo: null, progress: 100 });
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/channels/:id/top-bottom', async (req, res) => {
  try {
    const channel = await getChannel(req.userId, req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const n = Math.max(1, Math.min(20, parseInt(req.query.n) || 5));
    const episodes = (await getEpisodes(req.userId, req.params.id)).filter(e => e.viewCount > 0 && !e.transcript);
    if (!episodes.length) return res.json({ top: [], bottom: [], all: [], total: 0 });
    const sorted = [...episodes].sort((a, b) => b.viewCount - a.viewCount);
    const top = sorted.slice(0, n).map(e => ({ videoId: e.videoId, title: e.title, viewCount: e.viewCount }));
    const bottom = sorted.slice(-n).map(e => ({ videoId: e.videoId, title: e.title, viewCount: e.viewCount }));
    const seen = new Set();
    const all = [...top, ...bottom].filter(v => { if (seen.has(v.videoId)) return false; seen.add(v.videoId); return true; });
    res.json({ top, bottom, all, total: episodes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/channels/:id/sync', async (req, res) => {
  if (getSyncState(req.userId).running) return res.status(409).json({ error: 'Sync already in progress' });
  try {
    const channel = await getChannel(req.userId, req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const { videoIds, batchSize = 5, maxVideos = 50 } = req.body || {};
    res.json({ ok: true });
    syncChannel({ userId: req.userId, channelId: channel.id, videoIds, batchSize, maxVideos })
      .catch(err => console.error('[sync]', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── episodes ──────────────────────────────────────────────────────────────────

app.get('/api/episodes', async (req, res) => {
  try { res.json(await getEpisodes(req.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/channels/:id/episodes', async (req, res) => {
  try { res.json(await getEpisodes(req.userId, req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/episodes/:id/posts', async (req, res) => {
  try {
    const episodes = await getEpisodes(req.userId);
    const ep = episodes.find(e => e.id === req.params.id);
    if (!ep) return res.status(404).json({ error: 'Episode not found' });
    res.json(await generatePosts(ep, req.body?.platforms || ['twitter', 'linkedin']));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── clicks / tracking ─────────────────────────────────────────────────────────

app.post('/api/tracking-links', (req, res) => {
  const { postId, youtubeUrl } = req.body;
  if (!postId || !youtubeUrl) return res.status(400).json({ error: 'postId and youtubeUrl required' });
  res.json({ trackingUrl: `${req.protocol}://${req.get('host')}/r/${req.userId}/${postId}` });
});

app.get('/r/:userId/:postId', async (req, res) => {
  const { userId, postId } = req.params;
  const { platform, episodeId, episodeTitle, url } = req.query;
  if (!url) return res.status(404).send('Missing destination URL.');
  await logClick(userId, { postId, platform, episodeId, episodeTitle, youtubeUrl: url, ref: req.get('referer') || null })
    .catch(() => {});
  res.redirect(302, decodeURIComponent(url));
});

app.get('/api/clicks', async (req, res) => {
  try { res.json(await getClicks(req.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── waitlist (public) ─────────────────────────────────────────────────────────

app.post('/api/waitlist', async (req, res) => {
  const { email } = req.body;
  if (!email?.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  try {
    const total = await addWaitlistEmail(email);
    console.log(`[waitlist] ${email} — total: ${total}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── serve frontend ────────────────────────────────────────────────────────────

const distPath = join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

// ── cron ──────────────────────────────────────────────────────────────────────

cron.schedule('0 */6 * * *', async () => {
  try {
    const members = await getMembers();
    for (const member of members) {
      const channels = await getChannels(member.id);
      for (const ch of channels) {
        try {
          await syncChannel({ userId: member.id, channelId: ch.id, maxVideos: 10, batchSize: 5 });
        } catch (err) {
          console.error(`[cron] ${member.username}/${ch.name}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[cron]', err.message);
  }
});

// ── start ─────────────────────────────────────────────────────────────────────

initSchema()
  .then(() => app.listen(PORT, () => console.log(`ShowBrain backend on http://localhost:${PORT}`)))
  .catch(err => { console.error('[startup] DB init failed:', err.message); process.exit(1); });
