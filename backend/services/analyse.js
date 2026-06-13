import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from './keys.js';

async function getClient() {
  return new Anthropic({ apiKey: await getApiKey('ANTHROPIC_API_KEY') });
}

function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in Claude response');
  return JSON.parse(match[0]);
}

export async function analyseEpisode(transcript, title) {
  const client = await getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyse this podcast episode transcript and return structured data.

Title: "${title}"
Transcript (excerpt): ${transcript.substring(0, 3000)}

Return JSON only:
{
  "summary": "2-sentence TL;DR",
  "topics": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "sentiment": "positive|negative|neutral|mixed|critical"
}`,
    }],
  });
  return parseJson(response.content[0].text);
}

export async function analyseDimensions(transcript, title) {
  const client = await getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Classify this podcast episode across these dimensions.

Title: "${title}"
Opening: ${transcript.substring(0, 800)}

Return JSON only:
{
  "format": "solo|interview|co-hosted|panel|narrative|qa",
  "hookType": "bold-claim|personal-story|controversial-question|surprising-statistic|cold-open|direct-challenge",
  "contentType": "tactical|opinion|case-study|personal-story|trend-analysis|industry-news|myth-busting",
  "emotionalTone": "energetic|reflective|confrontational|vulnerable|educational",
  "guestType": "new-guest|return-guest|solo|co-host",
  "topicCluster": "short 2-3 word cluster label",
  "titleStructure": "question|statement|listicle|how-to",
  "titleLengthOk": true
}`,
    }],
  });
  return parseJson(response.content[0].text);
}

// Batch title analysis — cheap Haiku call, no transcript needed
export async function analyseTitlesBatch(videos) {
  const list = videos.map((v, i) => `${i}: ${v.title}`).join('\n');
  const client = await getClient();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Classify each video title across these dimensions. Return a JSON array with one object per title, in the same order.

Titles:
${list}

Return JSON array only:
[
  {
    "hookType": "bold-claim|personal-story|controversial-question|surprising-statistic|cold-open|direct-challenge",
    "contentType": "tactical|opinion|case-study|personal-story|trend-analysis|industry-news|myth-busting",
    "topicCluster": "2-3 word cluster"
  }
]`,
    }],
  });
  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response');
  return JSON.parse(match[0]);
}

export async function generatePosts(episode, platforms) {
  const platformInstructions = {
    twitter: 'Twitter/X: max 280 chars, punchy, 1-2 hashtags',
    linkedin: 'LinkedIn: professional, 3-4 sentences, 2-3 hashtags',
    instagram: 'Instagram: casual, engaging, 5-8 hashtags, CTA',
    newsletter: 'Email newsletter: 3-4 sentences, conversational, listen CTA',
  };

  const instructions = platforms.map(p => platformInstructions[p]).filter(Boolean).join('\n');

  const client = await getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Generate social posts for this podcast episode.

${instructions}

Episode: "${episode.title}"
Summary: ${episode.summary}
Topics: ${episode.topics?.join(', ')}

Return JSON with only the requested platform keys:
{ "twitter": "...", "linkedin": "...", "instagram": "...", "newsletter": "..." }`,
    }],
  });
  return parseJson(response.content[0].text);
}
