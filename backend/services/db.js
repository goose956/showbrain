import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id           TEXT PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'member',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      email      TEXT PRIMARY KEY,
      joined_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS channels (
      id               TEXT NOT NULL,
      user_id          TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      name             TEXT,
      thumbnail        TEXT,
      subscriber_count BIGINT DEFAULT 0,
      video_count      INT DEFAULT 0,
      description      TEXT,
      is_primary       BOOLEAN DEFAULT FALSE,
      added_at         TIMESTAMPTZ,
      last_synced_at   TIMESTAMPTZ,
      PRIMARY KEY (id, user_id)
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id            TEXT NOT NULL,
      user_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      channel_id    TEXT,
      channel_name  TEXT,
      video_id      TEXT,
      title         TEXT,
      show          TEXT,
      published_at  DATE,
      duration      INT DEFAULT 0,
      youtube_url   TEXT,
      thumbnail     TEXT,
      transcript    TEXT,
      summary       TEXT,
      topics        JSONB DEFAULT '[]',
      sentiment     TEXT,
      dimensions    JSONB,
      view_count    INT DEFAULT 0,
      like_count    INT DEFAULT 0,
      comment_count INT DEFAULT 0,
      stats_only    BOOLEAN DEFAULT FALSE,
      synced_at     TIMESTAMPTZ,
      PRIMARY KEY (id, user_id)
    );

    CREATE INDEX IF NOT EXISTS episodes_user_channel ON episodes (user_id, channel_id);
    CREATE INDEX IF NOT EXISTS episodes_video_id     ON episodes (user_id, video_id);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id    TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      settings   JSONB NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS posts (
      id           TEXT NOT NULL,
      user_id      TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      episode_id   TEXT,
      episode_title TEXT,
      platform     TEXT NOT NULL,
      content      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      auto_generated BOOLEAN DEFAULT FALSE,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, user_id)
    );

    CREATE INDEX IF NOT EXISTS posts_user_episode ON posts (user_id, episode_id);

    CREATE TABLE IF NOT EXISTS clicks (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      post_id       TEXT,
      platform      TEXT,
      episode_id    TEXT,
      episode_title TEXT,
      youtube_url   TEXT,
      ref           TEXT,
      clicked_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[db] Schema ready');
}
