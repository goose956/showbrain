import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fetch YouTube's auto-generated captions via the timedtext endpoint (no auth needed)
export async function fetchCaptions(videoId) {
  // YouTube exposes captions via the timedtext API — works for auto-generated captions
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const pageRes = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
  });

  if (!pageRes.ok) throw new Error(`Failed to fetch YouTube page: ${pageRes.status}`);

  const html = await pageRes.text();

  // Extract caption track list from the page's ytInitialPlayerResponse
  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) throw new Error('No caption tracks found for this video');

  let tracks;
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    throw new Error('Failed to parse caption track list');
  }

  // Prefer English auto-generated, then any English, then first available
  const track =
    tracks.find(t => t.languageCode === 'en' && t.kind === 'asr') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks[0];

  if (!track?.baseUrl) throw new Error('No usable caption track found');

  const captionRes = await fetch(track.baseUrl + '&fmt=json3');
  if (!captionRes.ok) throw new Error(`Failed to fetch captions: ${captionRes.status}`);

  const data = await captionRes.json();
  const events = data?.events || [];

  // Concatenate all caption segments into raw text
  const raw = events
    .flatMap(e => e.segs || [])
    .map(s => s.utf8 || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) throw new Error('Caption data was empty');
  return raw;
}

// Use Claude to clean up raw caption text into proper prose
export async function cleanupCaptions(rawText, title) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are cleaning up auto-generated YouTube captions for a podcast/video titled: "${title}"

The raw captions below have no punctuation, broken line breaks, and filler words. Rewrite them as clean, readable prose:
- Add proper punctuation and capitalisation
- Merge sentence fragments
- Remove filler words (um, uh, you know, like) and false starts
- Keep all the content and meaning — do not summarise or omit anything
- Output only the cleaned transcript, no commentary

Raw captions:
${rawText}`,
      },
    ],
  });

  const cleaned = response.content?.[0]?.text?.trim();
  if (!cleaned) throw new Error('Claude returned no cleaned transcript');
  return cleaned;
}
