/**
 * Claude AI helpers — all calls go through the backend.
 * No Anthropic API key is needed in the browser.
 */
import { apiFetch, getStoredToken } from './api';

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

// ── Outlier Analysis (SSE) ────────────────────────────────────────────────────
// onEvent({ type, ...}) called for each SSE event including 'token' chunks
// Returns the final parsed result object when complete
export async function generateOutlierAnalysis(onEvent) {
  const token = getStoredToken();
  const base = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
  const res = await fetch(`${base}/api/ai/outlier-analysis/stream`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Stream request failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === 'result') return event.data;
      if (event.type === 'error') throw new Error(event.message);
      onEvent?.(event);
    }
  }
  throw new Error('Stream ended without result');
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

// ── Persisted Insights (stored in user settings) ─────────────────────────────
export async function fetchSavedInsights(key) {
  const res = await apiFetch('/api/settings');
  if (!res.ok) return null;
  const data = await res.json();
  return data[key] || null;
}

export async function persistInsights(key, insights) {
  const res = await apiFetch('/api/settings');
  const current = res.ok ? await res.json() : {};
  await apiFetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...current, [key]: insights }),
  });
}

// ── Persisted Ideas ───────────────────────────────────────────────────────────
export async function fetchSavedIdeas() {
  const res = await apiFetch('/api/ideas');
  if (!res.ok) return null;
  const data = await res.json();
  return data.ideas || null;
}

export async function persistIdeas(ideas) {
  await post('/api/ideas', { ideas });
}

export async function clearIdeas() {
  const res = await apiFetch('/api/ideas', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear ideas');
}

// ── Persisted Scripts ─────────────────────────────────────────────────────────
export async function fetchSavedScripts() {
  const res = await apiFetch('/api/scripts');
  if (!res.ok) return [];
  return res.json();
}

export async function persistScript(id, brief, dataBrief, script) {
  await post('/api/scripts', { id, brief, dataBrief, script });
}

export async function removeScript(id) {
  const res = await apiFetch(`/api/scripts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete script');
}
