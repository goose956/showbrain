import { getApiKey } from './keys.js';
const BASE = 'https://www.googleapis.com/youtube/v3';
const ytKey = () => getApiKey('YOUTUBE_API_KEY');

// Resolve a channel URL/handle/@handle/ID to a channelId
export async function resolveChannelId(input) {
  if (/^UC[\w-]{22}$/.test(input)) return input;

  const channelMatch = input.match(/channel\/(UC[\w-]{22})/);
  if (channelMatch) return channelMatch[1];

  const handleMatch = input.match(/@([\w.-]+)/);
  const handle = handleMatch ? handleMatch[1] : input.replace(/^@/, '');

  const res = await fetch(
    `${BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${await ytKey()}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
  const id = data.items?.[0]?.id;
  if (!id) throw new Error(`Channel not found for: ${input}`);
  return id;
}

// Fetch channel metadata
export async function getChannelInfo(channelId) {
  const res = await fetch(
    `${BASE}/channels?part=snippet,statistics&id=${channelId}&key=${await ytKey()}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
  const ch = data.items?.[0];
  if (!ch) throw new Error('Channel not found');
  return {
    id: ch.id,
    name: ch.snippet.title,
    description: ch.snippet.description,
    thumbnail: ch.snippet.thumbnails?.medium?.url,
    videoCount: parseInt(ch.statistics.videoCount || 0),
    subscriberCount: parseInt(ch.statistics.subscriberCount || 0),
    totalViewCount: parseInt(ch.statistics.viewCount || 0),
    channelCreatedAt: ch.snippet.publishedAt || null,
  };
}

async function getUploadsPlaylistId(channelId) {
  const res = await fetch(
    `${BASE}/channels?part=contentDetails&id=${channelId}&key=${await ytKey()}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
}

// Fetch one page of videos — returns { videos, nextPageToken }
export async function getChannelVideosPage(channelId, { pageToken = null, pageSize = 50 } = {}) {
  const playlistId = await getUploadsPlaylistId(channelId);
  if (!playlistId) throw new Error('Could not find uploads playlist');

  const params = new URLSearchParams({
    part: 'snippet',
    playlistId,
    maxResults: Math.min(pageSize, 50),
    key: await ytKey(),
    ...(pageToken ? { pageToken } : {}),
  });

  const res = await fetch(`${BASE}/playlistItems?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(`YouTube API: ${data.error.message}`);

  const videos = (data.items || [])
    .filter(item => item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video')
    .map(item => {
      const s = item.snippet;
      return {
        videoId: s.resourceId.videoId,
        title: s.title,
        description: s.description?.substring(0, 200),
        publishedAt: s.publishedAt,
        thumbnail: s.thumbnails?.medium?.url || s.thumbnails?.default?.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${s.resourceId.videoId}`,
      };
    });

  return { videos, nextPageToken: data.nextPageToken || null, totalResults: data.pageInfo?.totalResults || 0 };
}

// Fetch ALL videos across all pages (for large channels)
export async function getAllChannelVideos(channelId, { onProgress } = {}) {
  const allVideos = [];
  let pageToken = null;
  let page = 0;

  do {
    const { videos, nextPageToken, totalResults } = await getChannelVideosPage(channelId, { pageToken });
    allVideos.push(...videos);
    pageToken = nextPageToken;
    page++;
    onProgress?.({ loaded: allVideos.length, total: totalResults, page });
    // Small delay between pages to be polite to the API
    if (nextPageToken) await new Promise(r => setTimeout(r, 200));
  } while (pageToken);

  return allVideos;
}

// Legacy — used by old sync path
export async function getChannelVideos(channelId, { maxResults = 50 } = {}) {
  const { videos } = await getChannelVideosPage(channelId, { pageSize: Math.min(maxResults, 50) });
  return videos.slice(0, maxResults);
}

// Fetch recent videos with stats for a channel (for compare-only channels)
export async function getRecentVideosWithStats(channelId, limit = 50) {
  const { videos } = await getChannelVideosPage(channelId, { pageSize: Math.min(limit, 50) });
  if (!videos.length) return [];
  const statsMap = await getVideoDurations(videos.map(v => v.videoId));
  return videos.map(v => ({
    videoId: v.videoId,
    title: v.title,
    publishedAt: v.publishedAt,
    youtubeUrl: v.youtubeUrl,
    thumbnail: v.thumbnail,
    viewCount: statsMap[v.videoId]?.viewCount || 0,
    likeCount: statsMap[v.videoId]?.likeCount || 0,
    commentCount: statsMap[v.videoId]?.commentCount || 0,
    duration: statsMap[v.videoId]?.duration || 0,
  }));
}

// Get video durations + public stats for a list of video IDs
export async function getVideoDurations(videoIds) {
  if (!videoIds.length) return {};
  const results = {};

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const res = await fetch(
      `${BASE}/videos?part=contentDetails,statistics&id=${chunk.join(',')}&key=${await ytKey()}`
    );
    const data = await res.json();
    for (const item of data.items || []) {
      const d = item.contentDetails.duration;
      const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const h = parseInt(match?.[1] || 0);
      const m = parseInt(match?.[2] || 0);
      const s = parseInt(match?.[3] || 0);
      results[item.id] = {
        duration: h * 3600 + m * 60 + s,
        viewCount: parseInt(item.statistics?.viewCount || 0),
        likeCount: parseInt(item.statistics?.likeCount || 0),
        commentCount: parseInt(item.statistics?.commentCount || 0),
      };
    }
  }
  return results;
}

// Search for recent videos by keyword, sorted by view count
export async function searchRecentVideos(query, { maxResults = 15, days = 7 } = {}) {
  const publishedAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${BASE}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=viewCount&publishedAfter=${encodeURIComponent(publishedAfter)}&maxResults=${maxResults}&key=${await ytKey()}`
  );
  const data = await res.json();
  if (data.error) throw new Error(`YouTube search: ${data.error.message}`);
  const items = data.items || [];
  if (!items.length) return [];
  const videoIds = items.map(i => i.id.videoId);
  const stats = await getVideoDurations(videoIds);
  return items.map(item => {
    const vid = item.id.videoId;
    const s = stats[vid] || {};
    const publishedAt = item.snippet.publishedAt;
    const hoursAgo = (Date.now() - new Date(publishedAt)) / (1000 * 60 * 60);
    return {
      videoId: vid,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      publishedAt,
      hoursAgo: Math.round(hoursAgo),
      thumbnail: item.snippet.thumbnails?.medium?.url,
      youtubeUrl: `https://youtube.com/watch?v=${vid}`,
      viewCount: s.viewCount || 0,
      likeCount: s.likeCount || 0,
      commentCount: s.commentCount || 0,
      velocity: s.viewCount ? Math.round(s.viewCount / Math.max(1, hoursAgo)) : 0,
    };
  }).sort((a, b) => b.viewCount - a.viewCount);
}
