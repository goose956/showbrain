import { Router } from 'express';
import Parser from 'rss-parser';
import { getChannels } from '../services/store.js';
import { getRecentVideosWithStats, searchRecentVideos } from '../services/youtube.js';
import { getUserSettings, setUserSettings } from '../services/store.js';

const router = Router();
const rssParser = new Parser({ timeout: 8000 });

// Per-user result cache: { data, fetchedAt }
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── Config (keywords + RSS feeds) ────────────────────────────────────────────

router.get('/config', async (req, res) => {
  try {
    const settings = await getUserSettings(req.userId);
    res.json({
      keywords: settings.trendingKeywords || [],
      feeds: settings.trendingFeeds || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', async (req, res) => {
  try {
    const { keywords, feeds } = req.body;
    const current = await getUserSettings(req.userId);
    await setUserSettings(req.userId, {
      ...current,
      trendingKeywords: keywords ?? current.trendingKeywords ?? [],
      trendingFeeds: feeds ?? current.trendingFeeds ?? [],
    });
    // Invalidate cache so next fetch uses new config
    cache.delete(req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Main feed ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { refresh } = req.query;
  const cached = cache.get(req.userId);
  if (!refresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json({ ...cached.data, cached: true, fetchedAt: cached.fetchedAt });
  }

  try {
    const settings = await getUserSettings(req.userId);
    const keywords = settings.trendingKeywords || [];
    const feeds = settings.trendingFeeds || [];
    const channels = await getChannels(req.userId);
    const compareChannels = channels.filter(c => c.compareOnly);

    const [competitorVideos, rssItems, youtubeResults] = await Promise.allSettled([
      // Phase 1: recent videos from competitor channels (last 14 days)
      fetchCompetitorVideos(compareChannels),
      // Phase 2a: RSS feeds
      fetchRssFeeds(feeds),
      // Phase 2b: YouTube keyword search
      fetchYouTubeKeywords(keywords),
    ]);

    const data = {
      competitorVideos: competitorVideos.status === 'fulfilled' ? competitorVideos.value : [],
      rssItems:         rssItems.status === 'fulfilled' ? rssItems.value : [],
      youtubeVideos:    youtubeResults.status === 'fulfilled' ? youtubeResults.value : [],
      errors: [
        competitorVideos.status === 'rejected' ? `Competitor videos: ${competitorVideos.reason?.message}` : null,
        rssItems.status === 'rejected' ? `RSS: ${rssItems.reason?.message}` : null,
        youtubeResults.status === 'rejected' ? `YouTube search: ${youtubeResults.reason?.message}` : null,
      ].filter(Boolean),
    };

    cache.set(req.userId, { data, fetchedAt: Date.now() });
    res.json({ ...data, cached: false, fetchedAt: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchCompetitorVideos(channels) {
  if (!channels.length) return [];
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const results = await Promise.allSettled(
    channels.map(ch => getRecentVideosWithStats(ch.id, 20))
  );
  return results
    .flatMap((r, i) => r.status === 'fulfilled'
      ? r.value
          .filter(v => v.publishedAt && new Date(v.publishedAt) > cutoff)
          .map(v => ({
            ...v,
            channelName: channels[i].name,
            channelId: channels[i].id,
            hoursAgo: Math.round((Date.now() - new Date(v.publishedAt)) / (1000 * 60 * 60)),
            velocity: v.viewCount
              ? Math.round(v.viewCount / Math.max(1, (Date.now() - new Date(v.publishedAt)) / (1000 * 60 * 60)))
              : 0,
          }))
      : []
    )
    .sort((a, b) => b.velocity - a.velocity);
}

async function fetchRssFeeds(feeds) {
  if (!feeds.length) return [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const results = await Promise.allSettled(
    feeds.map(async feed => {
      const parsed = await rssParser.parseURL(feed.url);
      return parsed.items.slice(0, 15).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.isoDate || item.pubDate,
        description: (item.contentSnippet || item.summary || '').slice(0, 200),
        source: feed.label || parsed.title || feed.url,
      })).filter(item => !item.pubDate || new Date(item.pubDate) > cutoff);
    })
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
}

async function fetchYouTubeKeywords(keywords) {
  if (!keywords.length) return [];
  const results = await Promise.allSettled(
    keywords.map(kw => searchRecentVideos(kw, { maxResults: 8, days: 7 }))
  );
  const seen = new Set();
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(v => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    })
    .sort((a, b) => b.viewCount - a.viewCount);
}

export default router;
