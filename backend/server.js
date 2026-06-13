import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

import { initSchema } from './services/db.js';
import { resolveChannelId, getChannelInfo, getChannelVideosPage, getAllChannelVideos, getVideoDurations } from './services/youtube.js';
import { analyseTitlesBatch } from './services/analyse.js';
import { syncChannel, getSyncState, processVideo, analyseTopVideos, getTopAnalysisState } from './services/sync.js';
import { getChannels, getChannel, upsertChannel, deleteChannel, getEpisodes, getEpisodeByVideoId, getClicks, logClick, addWaitlistEmail, upsertEpisode, getMembers, getMemberById, getMemberByUsername, createMember, deleteMember, getUserSettings, setUserSettings, getPosts, savePost, updatePostStatus, deletePost, getIdeas, saveIdeas, deleteIdeas, getScripts, saveScript, deleteScript, logPageView, logApiError } from './services/store.js';
import { generatePosts } from './services/analyse.js';
import { hashPassword, verifyPassword, createToken, verifyToken } from './services/auth.js';
import aiRoutes from './routes/ai.js';
import trendingRoutes from './routes/trending.js';
import { adminRouter, supportRouter } from './routes/adminExtra.js';

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

// Track every authenticated API request
app.use('/api', (req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  logPageView({
    id: randomUUID(),
    userId: req.userId,
    username: req.username,
    path: req.path,
    method: req.method,
    ip,
    userAgent: req.headers['user-agent'] || '',
    referrer: req.headers['referer'] || '',
  }).catch(() => {});

  // Log errors after response
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logApiError({
        id: randomUUID(),
        userId: req.userId,
        username: req.username,
        path: req.path,
        method: req.method,
        status: res.statusCode,
        errorMsg: res.locals.errorMsg || null,
        ip,
      }).catch(() => {});
    }
  });

  next();
});

app.use('/api/ai', aiRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/admin', (req, res, next) => req.isAdmin ? next() : res.status(403).json({ error: 'Admin only' }), adminRouter);
app.use('/api/support', supportRouter);

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

// Shared: fetch all video stats + title analysis for a channel, store as episodes
// compareOnly controls the flag on the channel + transcriptStatus on episodes
async function populateChannelVideos(userId, channelId, channelName, compareOnly) {
  try {
    const videos = await getAllChannelVideos(channelId);
    const statsMap = await getVideoDurations(videos.map(v => v.videoId));
    let titleDimensions = [];
    try { titleDimensions = await analyseTitlesBatch(videos); } catch {}

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const stats = statsMap[v.videoId] || {};
      const dims = titleDimensions[i] || null;
      await upsertEpisode(userId, {
        id: `yt-${v.videoId}`,
        channelId,
        channelName,
        videoId: v.videoId,
        title: v.title,
        show: channelName,
        publishedAt: v.publishedAt ? v.publishedAt.split('T')[0] : null,
        youtubeUrl: v.youtubeUrl,
        thumbnail: v.thumbnail,
        duration: stats.duration || null,
        viewCount: stats.viewCount || 0,
        likeCount: stats.likeCount || 0,
        commentCount: stats.commentCount || 0,
        transcript: null,
        transcriptStatus: compareOnly ? 'compare_only' : 'pending',
        dimensions: dims ? { hookType: dims.hookType, contentType: dims.contentType, topicCluster: dims.topicCluster } : null,
      });
    }
    console.log(`[populate:${channelId}] ${videos.length} videos stored`);
  } catch (err) {
    console.error(`[populate:${channelId}] Failed:`, err.message);
  }
}

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

    // Background: populate all videos with stats + title analysis immediately
    populateChannelVideos(req.userId, channelId, info.name, false);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Compare-only import — fetches all video stats + title analysis, no transcription
app.post('/api/channels/compare-import', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const channelId = await resolveChannelId(url);
    if (await getChannel(req.userId, channelId)) return res.status(409).json({ error: 'Channel already added' });

    const info = await getChannelInfo(channelId);
    const channel = {
      ...info,
      compareOnly: true,
      addedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };
    await upsertChannel(req.userId, channel);

    // Populate all videos synchronously (user waits during compare import)
    await populateChannelVideos(req.userId, channelId, info.name, true);

    res.json({ channel });

    // Fire-and-forget: fetch transcripts + full analysis for top 5 videos
    analyseTopVideos(req.userId, channelId, 5).catch(err =>
      console.error(`[top-analysis:${channelId}] Background task failed:`, err.message)
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Top-video analysis status for a channel
app.get('/api/channels/:id/top-status', requireAuth, async (req, res) => {
  const state = getTopAnalysisState(req.userId, req.params.id);
  if (!state) return res.json({ running: false, analysed: 0, total: 0, done: true });
  res.json({
    running: state.running,
    analysed: state.analysed,
    total: state.total,
    done: !state.running,
    errors: state.errors.length,
  });
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

// Transcribe a single episode directly (no need to re-fetch full channel video list)
app.post('/api/episodes/:id/transcribe', async (req, res) => {
  const state = getSyncState(req.userId);
  if (state.running) return res.status(409).json({ error: 'Sync already in progress' });
  try {
    const episodes = await getEpisodes(req.userId);
    const ep = episodes.find(e => e.id === req.params.id);
    if (!ep) return res.status(404).json({ error: 'Episode not found' });
    const channel = await getChannel(req.userId, ep.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    res.json({ ok: true });

    // Build a minimal video object from the stored episode data
    const video = {
      videoId: ep.videoId,
      title: ep.title,
      publishedAt: ep.publishedAt,
      youtubeUrl: ep.youtubeUrl,
      thumbnail: ep.thumbnail,
      duration: ep.duration,
      viewCount: ep.viewCount,
      likeCount: ep.likeCount,
      commentCount: ep.commentCount,
    };

    Object.assign(state, {
      running: true, userId: req.userId, channelId: channel.id, channelName: channel.name,
      errors: [], processed: 0, progress: 0, total: 1, currentBatch: 1, totalBatches: 1,
      currentVideo: ep.title,
    });

    (async () => {
      try {
        await processVideo(req.userId, video, channel.id, channel.name);
        state.processed = 1;
        state.progress = 100;
      } catch (err) {
        console.error('[transcribe-single]', err.message);
        state.errors.push({ videoId: ep.videoId, title: ep.title, error: err.message });
      } finally {
        state.running = false;
        state.currentVideo = null;
        state.lastSyncedAt = new Date().toISOString();
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// ── user settings ─────────────────────────────────────────────────────────────

app.get('/api/settings', async (req, res) => {
  try { res.json(await getUserSettings(req.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings', async (req, res) => {
  try {
    const current = await getUserSettings(req.userId);
    const updated = { ...current, ...req.body };
    await setUserSettings(req.userId, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── posts ─────────────────────────────────────────────────────────────────────

app.get('/api/posts', async (req, res) => {
  try { res.json(await getPosts(req.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/posts', async (req, res) => {
  try {
    const post = req.body;
    if (!post?.id || !post?.platform || !post?.content) return res.status(400).json({ error: 'id, platform, content required' });
    await savePost(req.userId, post);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/posts/:id/status', async (req, res) => {
  try {
    await updatePostStatus(req.userId, req.params.id, req.body.status);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    await deletePost(req.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ideas ─────────────────────────────────────────────────────────────────────

app.get('/api/ideas', async (req, res) => {
  try {
    const result = await getIdeas(req.userId);
    res.json(result || { ideas: null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ideas', async (req, res) => {
  const { ideas } = req.body;
  if (!ideas) return res.status(400).json({ error: 'ideas required' });
  try {
    await saveIdeas(req.userId, ideas);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ideas', async (req, res) => {
  try {
    await deleteIdeas(req.userId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── scripts ───────────────────────────────────────────────────────────────────

app.get('/api/scripts', async (req, res) => {
  try {
    res.json(await getScripts(req.userId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/scripts', async (req, res) => {
  const { id, brief, dataBrief, script } = req.body;
  if (!id || !script) return res.status(400).json({ error: 'id and script required' });
  try {
    await saveScript(req.userId, { id, brief, dataBrief, script });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/scripts/:id', async (req, res) => {
  try {
    await deleteScript(req.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

async function bootstrapAdmin() {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return;
  const existing = await getMemberByUsername(username);
  if (existing) return;
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await createMember({ id, username, passwordHash, role: 'admin' });
  console.log(`[startup] Admin account created: ${username}`);
}

initSchema()
  .then(bootstrapAdmin)
  .then(() => app.listen(PORT, () => console.log(`ShowBrain backend on http://localhost:${PORT}`)))
  .catch(err => { console.error('[startup] DB init failed:', err.message, err.code, 'DATABASE_URL set:', !!process.env.DATABASE_URL); process.exit(1); });
