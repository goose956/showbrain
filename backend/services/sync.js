import { getChannelVideosPage, getVideoDurations } from './youtube.js';
import { downloadAudio, cleanupAudio } from './ytdlp.js';
import { transcribeFile } from './transcribe.js';
import { analyseEpisode, analyseDimensions } from './analyse.js';
import { getChannel, upsertChannel, upsertEpisode, getEpisodeByVideoId } from './store.js';

// Sync state — one active sync at a time
export const syncState = {
  running: false,
  channelId: null,
  channelName: null,
  currentVideo: null,
  progress: 0,
  total: 0,
  processed: 0,
  currentBatch: 0,
  totalBatches: 0,
  errors: [],
  lastSyncedAt: null,
};

async function processVideo(video, channelId, channelName) {
  console.log(`[sync] Processing: ${video.title}`);
  syncState.currentVideo = video.title;

  const existing = getEpisodeByVideoId(video.videoId, channelId);
  if (existing?.transcript && existing?.summary) {
    console.log(`[sync] Skipping (already done): ${video.title}`);
    syncState.processed++;
    syncState.progress = Math.round((syncState.processed / syncState.total) * 100);
    return existing;
  }

  let audioPath = null;
  try {
    console.log(`[sync]   Downloading audio…`);
    audioPath = await downloadAudio(video.youtubeUrl, video.videoId);

    console.log(`[sync]   Transcribing…`);
    const transcript = await transcribeFile(audioPath);

    console.log(`[sync]   Analysing…`);
    const [analysis, dimensions] = await Promise.all([
      analyseEpisode(transcript, video.title),
      analyseDimensions(transcript, video.title),
    ]);

    const episode = {
      id: `yt-${video.videoId}`,
      videoId: video.videoId,
      channelId,
      channelName,
      title: video.title,
      show: channelName,
      publishedAt: video.publishedAt?.split('T')[0],
      duration: video.duration || 0,
      youtubeUrl: video.youtubeUrl,
      thumbnail: video.thumbnail,
      transcript,
      summary: analysis.summary,
      topics: analysis.topics,
      sentiment: analysis.sentiment,
      dimensions,
      viewCount: video.viewCount || 0,
      likeCount: video.likeCount || 0,
      commentCount: video.commentCount || 0,
      syncedAt: new Date().toISOString(),
    };

    upsertEpisode(episode);
    syncState.processed++;
    syncState.progress = Math.round((syncState.processed / syncState.total) * 100);
    return episode;
  } finally {
    if (audioPath) cleanupAudio(audioPath);
  }
}

export async function syncChannel({ channelId, videoIds, maxVideos = 20, batchSize = 5, batchDelay = 3000 } = {}) {
  if (syncState.running) throw new Error('Sync already in progress');

  const channel = getChannel(channelId);
  if (!channel?.id) throw new Error('Channel not found');

  syncState.running = true;
  syncState.channelId = channelId;
  syncState.channelName = channel.name;
  syncState.errors = [];
  syncState.processed = 0;
  syncState.progress = 0;
  syncState.currentBatch = 0;
  syncState.totalBatches = 0;

  try {
    let videos;

    if (videoIds?.length > 0) {
      console.log(`[sync] Processing ${videoIds.length} selected videos for ${channel.name}…`);
      const { videos: allVideos } = await getChannelVideosPage(channelId, { pageSize: 50 });
      videos = allVideos.filter(v => videoIds.includes(v.videoId));
    } else {
      console.log(`[sync] Fetching latest ${maxVideos} videos for ${channel.name}…`);
      const { videos: fetched } = await getChannelVideosPage(channelId, { pageSize: Math.min(maxVideos, 50) });
      videos = fetched.slice(0, maxVideos);
    }

    // Enrich with stats
    const ids = videos.map(v => v.videoId);
    const stats = await getVideoDurations(ids);
    videos.forEach(v => {
      const s = stats[v.videoId] || {};
      v.duration = s.duration || 0;
      v.viewCount = s.viewCount || 0;
      v.likeCount = s.likeCount || 0;
      v.commentCount = s.commentCount || 0;
    });

    syncState.total = videos.length;
    syncState.totalBatches = Math.ceil(videos.length / batchSize);
    console.log(`[sync] ${videos.length} videos in ${syncState.totalBatches} batches`);

    for (let b = 0; b < syncState.totalBatches; b++) {
      syncState.currentBatch = b + 1;
      const batch = videos.slice(b * batchSize, (b + 1) * batchSize);

      for (const video of batch) {
        try {
          await processVideo(video, channelId, channel.name);
        } catch (err) {
          console.error(`[sync] Error on "${video.title}":`, err.message);
          syncState.errors.push({ videoId: video.videoId, title: video.title, error: err.message });
          syncState.processed++;
          syncState.progress = Math.round((syncState.processed / syncState.total) * 100);
        }
      }

      if (b < syncState.totalBatches - 1) {
        await new Promise(r => setTimeout(r, batchDelay));
      }
    }

    const lastSyncedAt = new Date().toISOString();
    upsertChannel({ ...channel, lastSyncedAt });
    syncState.lastSyncedAt = lastSyncedAt;

    console.log(`[sync] Done. ${syncState.processed} processed, ${syncState.errors.length} errors.`);
  } finally {
    syncState.running = false;
    syncState.currentVideo = null;
    syncState.progress = 100;
  }
}
