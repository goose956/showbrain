import OpenAI from 'openai';

const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function fetchCaptions(videoId) {
  if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY is not set');

  const res = await fetch(
    `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=en`,
    { headers: { 'x-api-key': SUPADATA_API_KEY } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supadata error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const segments = data?.content;
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
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
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

  const cleaned = response.choices?.[0]?.message?.content?.trim();
  if (!cleaned) throw new Error('OpenAI returned no cleaned transcript');
  return cleaned;
}
