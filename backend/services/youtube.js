const API_KEY = process.env.YOUTUBE_API_KEY;
const BASE = 'https://www.googleapis.com/youtube/v3';

// Resolve a channel URL/handle/@handle/ID to a channelId
export async function resolveChannelId(input) {
  if (/^UC[\w-]{22}$/.test(input)) return input;

  const channelMatch = input.match(/channel\/(UC[\w-]{22})/);
  if (channelMatch) return channelMatch[1];

  const handleMatch = input.match(/@([\w.-]+)/);
  const handle = handleMatch ? handleMatch[1] : input.replace(/^@/, '');

  const res = await fetch(
    `${BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${API_KEY}`
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
    `${BASE}/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`
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
  };
}

async function getUploadsPlaylistId(channelId) {
  const res = await fetch(
    `${BASE}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
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
    key: API_KEY,
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

// Get video durations + public stats for a list of video IDs
export async function getVideoDurations(videoIds) {
  if (!videoIds.length) return {};
  const results = {};

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const res = await fetch(
      `${BASE}/videos?part=contentDetails,statistics&id=${chunk.join(',')}&key=${API_KEY}`
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
