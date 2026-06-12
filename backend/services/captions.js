import { YoutubeTranscript } from 'youtube-transcript';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function fetchCaptions(videoId) {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });

  if (!segments?.length) throw new Error('No transcript segments returned');

  const raw = segments
    .map(s => s.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) throw new Error('Transcript was empty');
  return raw;
}

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
