import { getAdminSettings } from './store.js';

// Returns the API key for `name`, preferring the DB value over the env var.
// DB key format matches the env var name exactly (e.g. "YOUTUBE_API_KEY").
export async function getApiKey(name) {
  try {
    const settings = await getAdminSettings();
    if (settings[name]) return settings[name];
  } catch {}
  return process.env[name] || null;
}
