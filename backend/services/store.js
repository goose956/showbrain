import { query } from './db.js';

// ── mappers ───────────────────────────────────────────────────────────────────

function rowToChannel(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    thumbnail: r.thumbnail,
    subscriberCount: Number(r.subscriber_count) || 0,
    videoCount: Number(r.video_count) || 0,
    description: r.description || null,
    isPrimary: r.is_primary || false,
    addedAt: r.added_at,
    lastSyncedAt: r.last_synced_at,
  };
}

function rowToEpisode(r) {
  if (!r) return null;
  return {
    id: r.id,
    channelId: r.channel_id,
    channelName: r.channel_name,
    videoId: r.video_id,
    title: r.title,
    show: r.show,
    publishedAt: r.published_at ? r.published_at.toISOString().split('T')[0] : null,
    duration: r.duration || 0,
    youtubeUrl: r.youtube_url,
    thumbnail: r.thumbnail,
    transcript: r.transcript,
    summary: r.summary,
    topics: r.topics || [],
    sentiment: r.sentiment,
    dimensions: r.dimensions || null,
    viewCount: r.view_count || 0,
    likeCount: r.like_count || 0,
    commentCount: r.comment_count || 0,
    statsOnly: r.stats_only || false,
    transcriptStatus: r.transcript_status || 'ok',
    syncedAt: r.synced_at,
  };
}

function rowToMember(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    role: r.role,
    createdAt: r.created_at,
  };
}

// ── channels ──────────────────────────────────────────────────────────────────

export async function getChannels(userId) {
  const { rows } = await query(
    'SELECT * FROM channels WHERE user_id = $1 ORDER BY added_at ASC',
    [userId]
  );
  return rows.map(rowToChannel);
}

export async function getChannel(userId, channelId) {
  const { rows } = await query(
    'SELECT * FROM channels WHERE user_id = $1 AND id = $2',
    [userId, channelId]
  );
  return rowToChannel(rows[0]) || null;
}

export async function upsertChannel(userId, channel) {
  await query(`
    INSERT INTO channels (id, user_id, name, thumbnail, subscriber_count, video_count, description, is_primary, added_at, last_synced_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id, user_id) DO UPDATE SET
      name             = EXCLUDED.name,
      thumbnail        = EXCLUDED.thumbnail,
      subscriber_count = EXCLUDED.subscriber_count,
      video_count      = EXCLUDED.video_count,
      description      = EXCLUDED.description,
      is_primary       = EXCLUDED.is_primary,
      added_at         = EXCLUDED.added_at,
      last_synced_at   = EXCLUDED.last_synced_at
  `, [
    channel.id, userId,
    channel.name || null,
    channel.thumbnail || null,
    channel.subscriberCount || 0,
    channel.videoCount || 0,
    channel.description || null,
    channel.isPrimary || false,
    channel.addedAt || new Date().toISOString(),
    channel.lastSyncedAt || null,
  ]);
  return channel;
}

export async function deleteChannel(userId, channelId) {
  await query('DELETE FROM episodes WHERE user_id = $1 AND channel_id = $2', [userId, channelId]);
  await query('DELETE FROM channels WHERE user_id = $1 AND id = $2', [userId, channelId]);
}

// ── episodes ──────────────────────────────────────────────────────────────────

export async function getEpisodes(userId, channelId = null) {
  if (channelId) {
    const { rows } = await query(
      'SELECT * FROM episodes WHERE user_id = $1 AND channel_id = $2 ORDER BY published_at DESC NULLS LAST',
      [userId, channelId]
    );
    return rows.map(rowToEpisode);
  }
  const { rows } = await query(
    'SELECT * FROM episodes WHERE user_id = $1 ORDER BY published_at DESC NULLS LAST',
    [userId]
  );
  return rows.map(rowToEpisode);
}

export async function upsertEpisode(userId, episode) {
  await query(`
    INSERT INTO episodes (
      id, user_id, channel_id, channel_name, video_id, title, show,
      published_at, duration, youtube_url, thumbnail,
      transcript, summary, topics, sentiment, dimensions,
      view_count, like_count, comment_count, stats_only, transcript_status, synced_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    ON CONFLICT (id, user_id) DO UPDATE SET
      channel_id        = EXCLUDED.channel_id,
      channel_name      = EXCLUDED.channel_name,
      title             = EXCLUDED.title,
      show              = EXCLUDED.show,
      published_at      = COALESCE(EXCLUDED.published_at, episodes.published_at),
      duration          = COALESCE(NULLIF(EXCLUDED.duration, 0), episodes.duration),
      youtube_url       = COALESCE(EXCLUDED.youtube_url, episodes.youtube_url),
      thumbnail         = COALESCE(EXCLUDED.thumbnail, episodes.thumbnail),
      transcript        = COALESCE(EXCLUDED.transcript, episodes.transcript),
      summary           = COALESCE(EXCLUDED.summary, episodes.summary),
      topics            = CASE WHEN jsonb_array_length(EXCLUDED.topics) > 0 THEN EXCLUDED.topics ELSE episodes.topics END,
      sentiment         = COALESCE(EXCLUDED.sentiment, episodes.sentiment),
      dimensions        = COALESCE(EXCLUDED.dimensions, episodes.dimensions),
      view_count        = COALESCE(NULLIF(EXCLUDED.view_count, 0), episodes.view_count),
      like_count        = COALESCE(NULLIF(EXCLUDED.like_count, 0), episodes.like_count),
      comment_count     = COALESCE(NULLIF(EXCLUDED.comment_count, 0), episodes.comment_count),
      stats_only        = EXCLUDED.stats_only,
      transcript_status = EXCLUDED.transcript_status,
      synced_at         = COALESCE(EXCLUDED.synced_at, episodes.synced_at)
  `, [
    episode.id, userId,
    episode.channelId || null,
    episode.channelName || null,
    episode.videoId || null,
    episode.title || null,
    episode.show || null,
    episode.publishedAt || null,
    episode.duration || 0,
    episode.youtubeUrl || null,
    episode.thumbnail || null,
    episode.transcript || null,
    episode.summary || null,
    JSON.stringify(episode.topics || []),
    episode.sentiment || null,
    episode.dimensions ? JSON.stringify(episode.dimensions) : null,
    episode.viewCount || 0,
    episode.likeCount || 0,
    episode.commentCount || 0,
    episode.statsOnly || false,
    episode.transcriptStatus || 'ok',
    episode.syncedAt || null,
  ]);
  return episode;
}

export async function getEpisodeByVideoId(userId, videoId, channelId = null) {
  if (channelId) {
    const { rows } = await query(
      'SELECT * FROM episodes WHERE user_id = $1 AND video_id = $2 AND channel_id = $3 LIMIT 1',
      [userId, videoId, channelId]
    );
    return rowToEpisode(rows[0]) || null;
  }
  const { rows } = await query(
    'SELECT * FROM episodes WHERE user_id = $1 AND video_id = $2 LIMIT 1',
    [userId, videoId]
  );
  return rowToEpisode(rows[0]) || null;
}

// ── clicks ────────────────────────────────────────────────────────────────────

export async function getClicks(userId) {
  const { rows } = await query(
    'SELECT * FROM clicks WHERE user_id = $1 ORDER BY clicked_at DESC',
    [userId]
  );
  return rows.map(r => ({
    id: r.id,
    postId: r.post_id,
    platform: r.platform,
    episodeId: r.episode_id,
    episodeTitle: r.episode_title,
    youtubeUrl: r.youtube_url,
    ref: r.ref,
    clickedAt: r.clicked_at,
  }));
}

export async function logClick(userId, { postId, platform, episodeId, episodeTitle, youtubeUrl, ref }) {
  const id = `click-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await query(
    'INSERT INTO clicks (id, user_id, post_id, platform, episode_id, episode_title, youtube_url, ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, userId, postId, platform, episodeId, episodeTitle, youtubeUrl, ref || null]
  );
}

// ── members ───────────────────────────────────────────────────────────────────

export async function getMembers() {
  const { rows } = await query('SELECT * FROM members ORDER BY created_at ASC', []);
  return rows.map(rowToMember);
}

export async function getMemberById(id) {
  const { rows } = await query('SELECT * FROM members WHERE id = $1', [id]);
  return rowToMember(rows[0]) || null;
}

export async function getMemberByUsername(username) {
  const { rows } = await query(
    'SELECT * FROM members WHERE lower(username) = lower($1)',
    [username]
  );
  return rowToMember(rows[0]) || null;
}

export async function createMember({ id, username, passwordHash, role = 'member' }) {
  await query(
    'INSERT INTO members (id, username, password_hash, role) VALUES ($1,$2,$3,$4)',
    [id, username, passwordHash, role]
  );
}

export async function deleteMember(id) {
  await query('DELETE FROM members WHERE id = $1', [id]);
}

// ── user settings ─────────────────────────────────────────────────────────────

export async function getUserSettings(userId) {
  const { rows } = await query('SELECT settings FROM user_settings WHERE user_id = $1', [userId]);
  return rows[0]?.settings || {};
}

export async function setUserSettings(userId, settings) {
  await query(`
    INSERT INTO user_settings (user_id, settings) VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET settings = $2
  `, [userId, JSON.stringify(settings)]);
}

// ── posts ─────────────────────────────────────────────────────────────────────

export async function getPosts(userId) {
  const { rows } = await query(
    'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(r => ({
    id: r.id,
    episodeId: r.episode_id,
    episodeTitle: r.episode_title,
    platform: r.platform,
    content: r.content,
    status: r.status,
    autoGenerated: r.auto_generated,
    createdAt: r.created_at,
  }));
}

export async function savePost(userId, post) {
  await query(`
    INSERT INTO posts (id, user_id, episode_id, episode_title, platform, content, status, auto_generated)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (id, user_id) DO UPDATE SET
      content  = EXCLUDED.content,
      status   = EXCLUDED.status
  `, [
    post.id, userId,
    post.episodeId || null,
    post.episodeTitle || null,
    post.platform,
    post.content,
    post.status || 'draft',
    post.autoGenerated || false,
  ]);
}

export async function updatePostStatus(userId, postId, status) {
  await query(
    'UPDATE posts SET status = $1 WHERE id = $2 AND user_id = $3',
    [status, postId, userId]
  );
}

export async function deletePost(userId, postId) {
  await query('DELETE FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);
}

// ── ideas ─────────────────────────────────────────────────────────────────────

export async function getIdeas(userId) {
  const { rows } = await query('SELECT * FROM ideas WHERE user_id = $1', [userId]);
  return rows[0] ? { ideas: rows[0].ideas, generatedAt: rows[0].generated_at } : null;
}

export async function saveIdeas(userId, ideas) {
  await query(
    `INSERT INTO ideas (user_id, ideas, generated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET ideas = EXCLUDED.ideas, generated_at = NOW()`,
    [userId, JSON.stringify(ideas)]
  );
}

export async function deleteIdeas(userId) {
  await query('DELETE FROM ideas WHERE user_id = $1', [userId]);
}

// ── scripts ───────────────────────────────────────────────────────────────────

export async function getScripts(userId) {
  const { rows } = await query(
    'SELECT * FROM scripts WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(r => ({
    id: r.id,
    brief: r.brief,
    dataBrief: r.data_brief,
    script: r.script,
    createdAt: r.created_at,
  }));
}

export async function saveScript(userId, { id, brief, dataBrief, script }) {
  await query(
    `INSERT INTO scripts (id, user_id, brief, data_brief, script, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id, user_id) DO UPDATE SET
       brief = EXCLUDED.brief,
       data_brief = EXCLUDED.data_brief,
       script = EXCLUDED.script`,
    [id, userId, brief, JSON.stringify(dataBrief), JSON.stringify(script)]
  );
}

export async function deleteScript(userId, scriptId) {
  await query('DELETE FROM scripts WHERE id = $1 AND user_id = $2', [scriptId, userId]);
}

// ── waitlist ──────────────────────────────────────────────────────────────────

export async function addWaitlistEmail(email) {
  await query(
    'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
    [email]
  );
  const { rows } = await query('SELECT COUNT(*) AS count FROM waitlist', []);
  return parseInt(rows[0].count, 10);
}
