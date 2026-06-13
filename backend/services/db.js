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
      subscriber_count  BIGINT DEFAULT 0,
      total_view_count  BIGINT DEFAULT 0,
      video_count       INT DEFAULT 0,
      description       TEXT,
      channel_created_at TIMESTAMPTZ,
      compare_only      BOOLEAN DEFAULT FALSE,
      is_primary        BOOLEAN DEFAULT FALSE,
      added_at          TIMESTAMPTZ,
      last_synced_at    TIMESTAMPTZ,
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
      stats_only        BOOLEAN DEFAULT FALSE,
      transcript_status TEXT DEFAULT 'ok',
      synced_at         TIMESTAMPTZ,
      PRIMARY KEY (id, user_id)
    );

    ALTER TABLE episodes ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT 'ok';
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS total_view_count BIGINT DEFAULT 0;
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_created_at TIMESTAMPTZ;
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS compare_only BOOLEAN DEFAULT FALSE;

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

    CREATE TABLE IF NOT EXISTS ideas (
      user_id     TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      ideas       JSONB NOT NULL DEFAULT '[]',
      generated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id          TEXT NOT NULL,
      user_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      brief       TEXT,
      data_brief  JSONB,
      script      JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, user_id)
    );

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

    CREATE TABLE IF NOT EXISTS page_views (
      id          TEXT PRIMARY KEY,
      user_id     TEXT REFERENCES members(id) ON DELETE SET NULL,
      username    TEXT,
      path        TEXT NOT NULL,
      method      TEXT NOT NULL DEFAULT 'GET',
      ip          TEXT,
      user_agent  TEXT,
      referrer    TEXT,
      viewed_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS page_views_viewed_at ON page_views (viewed_at DESC);
    CREATE INDEX IF NOT EXISTS page_views_user_id   ON page_views (user_id);

    CREATE TABLE IF NOT EXISTS support_tickets (
      id          TEXT PRIMARY KEY,
      user_id     TEXT REFERENCES members(id) ON DELETE SET NULL,
      username    TEXT NOT NULL,
      subject     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id          TEXT PRIMARY KEY,
      ticket_id   TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender      TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'user',
      body        TEXT NOT NULL,
      sent_at     TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS support_messages_ticket ON support_messages (ticket_id, sent_at);
  `);
  console.log('[db] Schema ready');
}
