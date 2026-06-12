import { createReadStream } from 'fs';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DG_PARAMS = 'model=nova-3&smart_format=true&punctuate=true&paragraphs=true&diarize=true';

export async function transcribeUrl(audioUrl) {
  if (!DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY is not set');

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${DG_PARAMS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Deepgram error: ${err}`);
  }

  const data = await response.json();
  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  if (!transcript) throw new Error('No transcript returned from Deepgram');
  return transcript;
}

export async function transcribeFile(filePath) {
  if (!DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY is not set');

  const stream = createReadStream(filePath);
  const ext = filePath.split('.').pop();
  const mimeTypes = {
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    webm: 'audio/webm',
    opus: 'audio/ogg',
    ogg: 'audio/ogg',
    mp3: 'audio/mpeg',
  };
  const contentType = mimeTypes[ext] || 'audio/mp4';

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${DG_PARAMS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': contentType,
      },
      body: stream,
      duplex: 'half',
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Deepgram error: ${err}`);
  }

  const data = await response.json();
  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  if (!transcript) throw new Error('No transcript returned from Deepgram');
  return transcript;
}
