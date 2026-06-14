import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getGuests, upsertGuest, deleteGuest } from '../services/store.js';
import { getApiKey } from '../services/keys.js';

const router = Router();

async function getClient() {
  return new Anthropic({ apiKey: await getApiKey('ANTHROPIC_API_KEY') });
}

function parseJson(text) {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON found in response');
  return JSON.parse(match[0]);
}

// Fetch a URL and return stripped text (server-side, avoids CORS)
async function fetchPageText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Failed to fetch URL: ${r.status}`);
  const html = await r.text();
  // Strip tags, collapse whitespace, cap at 8000 chars
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
}

// GET /api/guests
router.get('/', async (req, res) => {
  try {
    res.json(await getGuests(req.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/guests  — create
router.post('/', async (req, res) => {
  const { name, url, email } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const guest = await upsertGuest({ userId: req.userId, name: name.trim(), url, email });
    res.json(guest);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/guests/:id  — update fields
router.put('/:id', async (req, res) => {
  try {
    const existing = (await getGuests(req.userId)).find(g => g.id === req.params.id);
    if (!existing) return res.status(404).json({ error: 'Guest not found' });
    const guest = await upsertGuest({ ...existing, ...req.body, id: req.params.id, userId: req.userId });
    res.json(guest);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/guests/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteGuest(req.userId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/guests/:id/research  — AI bio + topics from name/URL
router.post('/:id/research', async (req, res) => {
  try {
    const guests = await getGuests(req.userId);
    const guest = guests.find(g => g.id === req.params.id);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });

    const { showName, showTopics } = req.body;

    let urlContext = '';
    if (guest.url) {
      try { urlContext = await fetchPageText(guest.url); } catch {}
    }

    const prompt = `You are researching a potential podcast guest.

Guest name: ${guest.name}
${guest.url ? `Their URL: ${guest.url}` : ''}
${urlContext ? `Page content (extracted):\n${urlContext}` : ''}
${showName ? `The podcast is called: ${showName}` : ''}
${showTopics?.length ? `The show typically covers: ${showTopics.join(', ')}` : ''}

Extract a professional bio and suggest 5 topic areas this guest could speak to that would resonate with this show's audience.

Return JSON only:
{
  "bio": "2-3 sentence professional bio",
  "topics": ["topic 1", "topic 2", "topic 3", "topic 4", "topic 5"]
}`;

    const client = await getClient();
    const result = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const { bio, topics } = parseJson(result.content[0].text);
    const updated = await upsertGuest({ ...guest, id: guest.id, userId: req.userId, bio, topics });
    res.json(updated);
  } catch (e) {
    console.error('[guests/research]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/guests/:id/questions  — AI generate interview questions
router.post('/:id/questions', async (req, res) => {
  try {
    const guests = await getGuests(req.userId);
    const guest = guests.find(g => g.id === req.params.id);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });

    const { showName, showTopics, showStyle } = req.body;

    const prompt = `You are preparing interview questions for a podcast guest.

Guest: ${guest.name}
Bio: ${guest.bio || 'Not available'}
Topics they can speak to: ${(guest.topics || []).join(', ') || 'Not specified'}
${showName ? `Podcast: ${showName}` : ''}
${showTopics?.length ? `Show typically covers: ${showTopics.join(', ')}` : ''}
${showStyle ? `Show style/tone: ${showStyle}` : ''}

Generate 10 interview questions. Mix of:
- Opener (background/origin story)
- Depth questions (their expertise)
- Opinion/contrarian angles
- Practical takeaways for the audience
- Strong closer

Return JSON only:
{
  "questions": [
    { "category": "Opener", "question": "..." },
    { "category": "Depth", "question": "..." }
  ]
}`;

    const client = await getClient();
    const result = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const { questions } = parseJson(result.content[0].text);
    const updated = await upsertGuest({ ...guest, id: guest.id, userId: req.userId, questions });
    res.json(updated);
  } catch (e) {
    console.error('[guests/questions]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/guests/:id/outreach  — AI draft outreach email
router.post('/:id/outreach', async (req, res) => {
  try {
    const guests = await getGuests(req.userId);
    const guest = guests.find(g => g.id === req.params.id);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });

    const { showName, hostName, showDescription, audienceSize } = req.body;

    const prompt = `Draft a short, warm outreach email inviting this person to appear on a podcast.

Guest: ${guest.name}
Guest bio: ${guest.bio || 'Not available'}
Topics they can cover: ${(guest.topics || []).join(', ') || 'Not specified'}
${showName ? `Podcast name: ${showName}` : ''}
${hostName ? `Host name: ${hostName}` : ''}
${showDescription ? `Show description: ${showDescription}` : ''}
${audienceSize ? `Audience size: ${audienceSize}` : ''}

Guidelines:
- Keep it under 150 words
- Lead with a genuine compliment specific to them
- One sentence on the show and why they'd be a great fit
- Clear ask — a 30-min call or direct recording invite
- No fluff, no corporate language
- Warm and direct tone

Return the email as plain text only (no JSON, no subject line needed — just the body).`;

    const client = await getClient();
    const result = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const outreach = result.content[0].text.trim();
    const updated = await upsertGuest({ ...guest, id: guest.id, userId: req.userId, outreach, status: guest.status === 'research' ? 'outreach' : guest.status });
    res.json(updated);
  } catch (e) {
    console.error('[guests/outreach]', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
