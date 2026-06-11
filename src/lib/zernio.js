const BASE_URL = 'https://zernio.com/api/v1';

const headers = () => ({
  Authorization: `Bearer ${import.meta.env.VITE_ZERNIO_API_KEY}`,
  'Content-Type': 'application/json',
});

// Fetch all connected accounts — used to resolve accountId per platform
export async function getConnectedAccounts() {
  const apiKey = import.meta.env.VITE_ZERNIO_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(`${BASE_URL}/accounts`, { headers: headers() });
  if (!response.ok) return [];

  const data = await response.json();
  // Returns array of { _id, platform, ... }
  return Array.isArray(data) ? data : (data.accounts || []);
}

// Publish a post immediately to a single platform
// Requires a connected accountId for that platform
export async function publishPost({ platform, content, accountId, episodeUrl }) {
  const apiKey = import.meta.env.VITE_ZERNIO_API_KEY;
  if (!apiKey) throw new Error('VITE_ZERNIO_API_KEY is not set');
  if (!accountId) throw new Error(`No connected account found for ${platform}. Connect your accounts in the Zernio dashboard first.`);

  const body = {
    content,
    publishNow: true,
    platforms: [{ platform, accountId }],
  };

  // Append episode URL to content if provided (platform-dependent formatting)
  if (episodeUrl) {
    body.content = `${content}\n\n${episodeUrl}`;
  }

  const response = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Zernio error: ${err}`);
  }

  return response.json();
}

// Schedule a post for a future time
export async function schedulePost({ platform, content, accountId, scheduledFor, timezone = 'UTC' }) {
  const apiKey = import.meta.env.VITE_ZERNIO_API_KEY;
  if (!apiKey) throw new Error('VITE_ZERNIO_API_KEY is not set');
  if (!accountId) throw new Error(`No connected account found for ${platform}.`);

  const response = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      content,
      scheduledFor,
      timezone,
      platforms: [{ platform, accountId }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Zernio error: ${err}`);
  }

  return response.json();
}

export const SUPPORTED_PLATFORMS = [
  { id: 'twitter', label: 'Twitter / X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'newsletter', label: 'Newsletter' },
];
