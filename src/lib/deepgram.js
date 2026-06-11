const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

export async function transcribeAudio(audioFile) {
  if (!DEEPGRAM_API_KEY) throw new Error('VITE_DEEPGRAM_API_KEY is not set');

  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&paragraphs=true&diarize=true',
    {
      method: 'POST',
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
      body: audioFile,
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

export async function transcribeFromUrl(url) {
  if (!DEEPGRAM_API_KEY) throw new Error('VITE_DEEPGRAM_API_KEY is not set');

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&paragraphs=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
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
