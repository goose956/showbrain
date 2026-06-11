import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

import { resolveChannelId, getChannelInfo, getChannelVideosPage, getAllChannelVideos } from './services/youtube.js';
import { syncChannel, syncState } from './services/sync.js';
import { getChannels, getChannel, upsertChannel, deleteChannel, getEpisodes, getEpisodeByVideoId, getClicks, logClick } from './services/store.js';
import { generatePosts } from './services/analyse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── channels ──────────────────────────────────────────────────────────────────

// GET /api/channels — list all channels with episode counts
app.get('/api/channels', (req, res) => {
  const channels = getChannels();
  const allEpisodes = getEpisodes();
  const withCounts = channels.map(ch => ({
    ...ch,
    episodeCount: allEpisodes.filter(e => e.channelId === ch.id).length,
  }));
  res.json(withCounts);
});

// POST /api/channels — add a new channel
app.post('/api/channels', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const channelId = await resolveChannelId(url);

    // Don't add duplicates
    if (getChannel(channelId)) {
      return res.status(409).json({ error: 'Channel already added' });
    }

    const info = await getChannelInfo(channelId);
    const channel = { ...info, addedAt: new Date().toISOString(), lastSyncedAt: null };
    upsertChannel(channel);
    res.json({ channel });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/channels/:id — remove channel + its episodes
app.delete('/api/channels/:id', (req, res) => {
  deleteChannel(req.params.id);
  res.json({ ok: true });
});

// ── video picker ──────────────────────────────────────────────────────────────

// GET /api/channels/:id/videos — fetch video metadata for picker
app.get('/api/channels/:id/videos', async (req, res) => {
  const channel = getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  try {
    const { pageToken, loadAll } = req.query;

    if (loadAll === 'true') {
      const videos = await getAllChannelVideos(channel.id);
      const withStatus = videos.map(v => ({
        ...v,
        transcribed: !!(getEpisodeByVideoId(v.videoId, channel.id)?.transcript),
      }));
      res.json({ videos: withStatus, nextPageToken: null, total: withStatus.length });
    } else {
      const { videos, nextPageToken, totalResults } = await getChannelVideosPage(
        channel.id,
        { pageToken: pageToken || null }
      );
      const withStatus = videos.map(v => ({
        ...v,
        transcribed: !!(getEpisodeByVideoId(v.videoId, channel.id)?.transcript),
      }));
      res.json({ videos: withStatus, nextPageToken, total: totalResults });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── sync ──────────────────────────────────────────────────────────────────────

// GET /api/sync/status
app.get('/api/sync/status', (req, res) => {
  res.json(syncState);
});

// POST /api/channels/:id/fetch-stats — pull metadata + stats for all videos, no transcription
app.post('/api/channels/:id/fetch-stats', async (req, res) => {
  const channel = getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  res.json({ ok: true, message: 'Fetching stats…' });

  // Run async — client polls /api/sync/status
  (async () => {
    try {
      syncState.running = true;
      syncState.channelId = channel.id;
      syncState.channelName = channel.name;
      syncState.errors = [];
      syncState.processed = 0;
      syncState.progress = 0;
      syncState.currentVideo = 'Fetching video list…';

      const { getAllChannelVideos, getVideoDurations } = await import('./services/youtube.js');
      const { upsertEpisode, upsertChannel } = await import('./services/store.js');

      const videos = await getAllChannelVideos(channel.id);
      syncState.total = videos.length;
      syncState.currentVideo = `Fetching stats for ${videos.length} videos…`;

      // Batch stat lookups (50 per request — YouTube API limit)
      const BATCH = 50;
      for (let i = 0; i < videos.length; i += BATCH) {
        const batch = videos.slice(i, i + BATCH);
        const ids = batch.map(v => v.videoId);
        const stats = await getVideoDurations(ids);
        for (const v of batch) {
          const s = stats[v.videoId] || {};
          upsertEpisode({
            id: `yt-${v.videoId}`,
            videoId: v.videoId,
            channelId: channel.id,
            channelName: channel.name,
            title: v.title,
            show: channel.name,
            publishedAt: v.publishedAt?.split('T')[0],
            duration: s.duration || 0,
            youtubeUrl: v.youtubeUrl,
            thumbnail: v.thumbnail,
            viewCount: s.viewCount || 0,
            likeCount: s.likeCount || 0,
            commentCount: s.commentCount || 0,
            statsOnly: true,
          });
          syncState.processed++;
          syncState.progress = Math.round((syncState.processed / syncState.total) * 100);
        }
      }

      const lastSyncedAt = new Date().toISOString();
      upsertChannel({ ...channel, lastSyncedAt });
      syncState.lastSyncedAt = lastSyncedAt;
      console.log(`[fetch-stats] Done: ${syncState.processed} videos for ${channel.name}`);
    } catch (err) {
      console.error('[fetch-stats] Error:', err.message);
      syncState.errors.push({ error: err.message });
    } finally {
      syncState.running = false;
      syncState.currentVideo = null;
      syncState.progress = 100;
    }
  })();
});

// GET /api/channels/:id/top-bottom?n=5 — return top N + bottom N videoIds by viewCount
app.get('/api/channels/:id/top-bottom', (req, res) => {
  const channel = getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const n = Math.max(1, Math.min(20, parseInt(req.query.n) || 5));
  const episodes = getEpisodes(req.params.id)
    .filter(e => e.viewCount > 0 && !e.transcript); // only unanalysed, stats-known

  if (episodes.length === 0) return res.json({ top: [], bottom: [], total: 0 });

  const sorted = [...episodes].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const top    = sorted.slice(0, n).map(e => ({ videoId: e.videoId, title: e.title, viewCount: e.viewCount }));
  const bottom = sorted.slice(-n).map(e => ({ videoId: e.videoId, title: e.title, viewCount: e.viewCount }));

  // Deduplicate in case the channel has fewer than 2n videos
  const seen = new Set();
  const deduped = [...top, ...bottom].filter(v => { if (seen.has(v.videoId)) return false; seen.add(v.videoId); return true; });

  res.json({ top, bottom, all: deduped, total: episodes.length });
});

// POST /api/channels/:id/sync — trigger sync for a specific channel
app.post('/api/channels/:id/sync', async (req, res) => {
  if (syncState.running) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }
  const channel = getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const { videoIds, batchSize = 5, maxVideos = 50 } = req.body || {};
  res.json({ ok: true, message: 'Sync started' });

  syncChannel({ channelId: channel.id, videoIds, batchSize, maxVideos }).catch(err =>
    console.error('[server] Sync error:', err.message)
  );
});

// ── episodes ──────────────────────────────────────────────────────────────────

// GET /api/episodes — all episodes across all channels
app.get('/api/episodes', (req, res) => {
  res.json(getEpisodes());
});

// GET /api/channels/:id/episodes — episodes for one channel
app.get('/api/channels/:id/episodes', (req, res) => {
  res.json(getEpisodes(req.params.id));
});

// POST /api/episodes/:id/posts — generate social posts
app.post('/api/episodes/:id/posts', async (req, res) => {
  const episodes = getEpisodes();
  const ep = episodes.find(e => e.id === req.params.id);
  if (!ep) return res.status(404).json({ error: 'Episode not found' });

  const platforms = req.body?.platforms || ['twitter', 'linkedin'];
  try {
    const posts = await generatePosts(ep, platforms);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── tracking links ────────────────────────────────────────────────────────────

// POST /api/tracking-links — register a post for tracking, get back a tracking URL
app.post('/api/tracking-links', (req, res) => {
  const { postId, platform, episodeId, episodeTitle, youtubeUrl } = req.body;
  if (!postId || !youtubeUrl) return res.status(400).json({ error: 'postId and youtubeUrl are required' });
  const trackingUrl = `${req.protocol}://${req.get('host')}/r/${postId}`;
  res.json({ trackingUrl });
});

// GET /r/:postId — redirect + log click
app.get('/r/:postId', (req, res) => {
  const { postId } = req.params;
  const ref = req.query.ref || req.get('referer') || null;

  // Find any episode that matches by scanning clicks registry or just log it
  // The click payload was registered when the tracking link was created
  // We need to look up post metadata — stored in a simple in-memory register per process
  // For persistence, we embed metadata in the URL as query params that the frontend adds
  const { platform, episodeId, episodeTitle, url } = req.query;

  if (!url) {
    return res.status(404).send('Tracking link missing destination. Re-generate the link from Post Queue.');
  }

  logClick({ postId, platform, episodeId, episodeTitle, youtubeUrl: url, ref });

  res.redirect(302, decodeURIComponent(url));
});

// GET /api/clicks — all click events
app.get('/api/clicks', (req, res) => {
  res.json(getClicks());
});

// ── serve frontend in production ──────────────────────────────────────────────

const distPath = join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

// ── scheduled sync — every 6 hours ───────────────────────────────────────────

cron.schedule('0 */6 * * *', () => {
  const channels = getChannels();
  if (!channels.length) return;
  console.log(`[cron] Running scheduled sync for ${channels.length} channel(s)…`);
  // Sync channels sequentially
  channels.reduce((chain, ch) =>
    chain.then(() =>
      syncChannel({ channelId: ch.id, maxVideos: 10, batchSize: 5 })
        .catch(err => console.error(`[cron] Sync error for ${ch.name}:`, err.message))
    ),
    Promise.resolve()
  );
});

app.listen(PORT, () => {
  console.log(`ShowBrain backend running on http://localhost:${PORT}`);
});
