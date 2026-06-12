/**
 * Claude AI helpers — all calls go through the backend.
 * No Anthropic API key is needed in the browser.
 */
import { apiFetch } from './api';

async function post(path, body) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ── Episode analysis (already on backend via sync pipeline) ──────────────────
// These are called directly by the backend sync service — no frontend wrapper needed.
// Keeping stub exports so any legacy import doesn't break.
export async function generateEpisodeSummary() {
  throw new Error('generateEpisodeSummary runs on the backend during sync.');
}

export async function analyzeEpisodeDimensions() {
  throw new Error('analyzeEpisodeDimensions runs on the backend during sync.');
}

// ── Semantic Search ───────────────────────────────────────────────────────────
export async function semanticSearch(query, episodes) {
  return post('/api/ai/search', { query, episodes });
}

// ── Show Notes ────────────────────────────────────────────────────────────────
export async function generateShowNotes(episode) {
  const { text } = await post('/api/ai/show-notes', { episode });
  return text;
}

// ── Social Posts (already on backend) ────────────────────────────────────────
export async function generateSocialPosts(episode, platforms) {
  return post(`/api/episodes/${episode.id}/posts`, { platforms });
}

// ── Chapter Markers ───────────────────────────────────────────────────────────
export async function generateChapterMarkers(transcript, duration) {
  const { chapters } = await post('/api/ai/chapters', { transcript, duration });
  return chapters;
}

// ── Cross-Channel Insights ────────────────────────────────────────────────────
export async function generateCrossChannelInsights(channelStats) {
  return post('/api/ai/cross-channel-insights', { channelStats });
}

// ── Episode Ideas ─────────────────────────────────────────────────────────────
export async function generateEpisodeIdeas(episodes) {
  const { ideas } = await post('/api/ai/episode-ideas', { episodes });
  return ideas;
}

// ── Script Prep ───────────────────────────────────────────────────────────────
export async function analyseEpisodeDataForScript(brief, episodes) {
  return post('/api/ai/script-prep', { brief, episodes });
}

// ── Generate Script ───────────────────────────────────────────────────────────
export async function generateEpisodeScript(brief, dataBrief, relatedEpisodes) {
  return post('/api/ai/script', { brief, dataBrief, relatedEpisodes });
}

// ── Regenerate Script Section ─────────────────────────────────────────────────
export async function regenerateScriptSection(section, brief, dataBrief, hostVoiceSample) {
  return post('/api/ai/script/section', { section, brief, dataBrief, hostVoiceSample });
}

// ── Channel Insights ──────────────────────────────────────────────────────────
export async function generateChannelInsights(episodes) {
  const { insights } = await post('/api/ai/channel-insights', { episodes });
  return insights;
}
