import Anthropic from '@anthropic-ai/sdk';

const getClient = () => {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
};

export async function generateEpisodeSummary(transcript) {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a podcast intelligence assistant. Given the following episode transcript, produce:
1. A concise 2-sentence summary (the "TL;DR")
2. 5 key topic tags
3. Sentiment: positive | negative | neutral | mixed | critical

Respond in JSON format:
{
  "summary": "...",
  "topics": ["...", "...", "...", "...", "..."],
  "sentiment": "..."
}

Transcript:
${transcript}`,
      },
    ],
  });

  const text = response.content[0].text;
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json);
}

export async function semanticSearch(query, episodes) {
  const client = getClient();
  const episodeList = episodes
    .map((ep) => `[${ep.id}] "${ep.title}" — ${ep.summary}\nTopics: ${ep.topics.join(', ')}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a podcast search engine. Given the following podcast episodes and a user query, return the most relevant episodes ranked by relevance. For each result, explain in one sentence why it matches the query.

Episodes:
${episodeList}

Query: "${query}"

Respond in JSON:
{
  "results": [
    { "id": "ep-xxx", "relevance": "why this matches" },
    ...
  ]
}

Return up to 5 results. If nothing is relevant, return an empty results array.`,
      },
    ],
  });

  const text = response.content[0].text;
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  const { results } = JSON.parse(json);

  return results.map((r) => ({
    episode: episodes.find((ep) => ep.id === r.id),
    relevance: r.relevance,
  })).filter((r) => r.episode);
}

export async function generateShowNotes(episode) {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Generate professional podcast show notes for the following episode. Include:
- A compelling opening paragraph
- 3-5 key takeaways as bullet points
- A closing sentence inviting engagement

Episode title: ${episode.title}
Show: ${episode.show}
Summary: ${episode.summary}
Topics: ${episode.topics.join(', ')}
Transcript excerpt: ${episode.transcript.substring(0, 1500)}...

Write in an engaging, professional tone suitable for a podcast website.`,
      },
    ],
  });

  return response.content[0].text;
}

export async function generateSocialPosts(episode, platforms) {
  const client = getClient();
  const platformInstructions = {
    twitter: 'Twitter/X: max 280 chars, punchy, 1-2 hashtags',
    linkedin: 'LinkedIn: professional, 3-4 sentences, add value, 2-3 hashtags',
    instagram: 'Instagram: casual, engaging, 5-8 hashtags, include a CTA',
    newsletter: 'Email newsletter blurb: 3-4 sentences, conversational, clear CTA to listen',
  };

  const selectedInstructions = platforms
    .map((p) => platformInstructions[p])
    .filter(Boolean)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Generate social media posts for this podcast episode for the following platforms:

${selectedInstructions}

Episode: "${episode.title}"
Summary: ${episode.summary}
Key topics: ${episode.topics.join(', ')}

Respond in JSON:
{
  "twitter": "...",
  "linkedin": "...",
  "instagram": "...",
  "newsletter": "..."
}

Only include keys for platforms that were requested.`,
      },
    ],
  });

  const text = response.content[0].text;
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json);
}

export async function generateChapterMarkers(transcript, duration) {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Given this podcast transcript (total duration: ${Math.floor(duration / 60)} minutes), generate chapter markers. Identify natural topic transitions and assign approximate timestamps.

Transcript:
${transcript.substring(0, 3000)}

Respond in JSON:
{
  "chapters": [
    { "time": "00:00", "title": "..." },
    ...
  ]
}

Generate 4-8 chapters.`,
      },
    ],
  });

  const text = response.content[0].text;
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json).chapters;
}

// ── Script Writer ─────────────────────────────────────────────────────────────

export async function generateCrossChannelInsights(channelStats) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `You are a YouTube content strategist. Analyse this cross-channel performance data and produce actionable insights for someone entering or competing in this niche.

Channel data:
${JSON.stringify(channelStats, null, 2)}

Return JSON only, no markdown fences:
{
  "nichePatterns": [
    {
      "title": "Pattern that holds across all or most channels",
      "detail": "Specific finding with data — which channels, which metrics",
      "strength": "strong|moderate"
    }
  ],
  "topChannelEdge": {
    "channelName": "name of the top performer by avg views",
    "whatSetsItApart": "2-3 specific things this channel does differently"
  },
  "gaps": [
    {
      "gap": "Something no channel in this set is doing well",
      "opportunity": "How a new channel could exploit this"
    }
  ],
  "newChannelPlaybook": [
    "Specific action 1 — e.g. use bold-claim hooks, they dominate this niche",
    "Specific action 2",
    "Specific action 3",
    "Specific action 4",
    "Specific action 5"
  ]
}

nichePatterns: 3-5 patterns. gaps: 2-3 gaps. newChannelPlaybook: exactly 5 actions, each referencing real numbers from the data.`,
    }],
  });

  const text = response.content.find(b => b.type === 'text')?.text || '';
  const json = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json);
}

export async function generateEpisodeIdeas(episodes) {
  const client = getClient();

  const episodeSummaries = episodes.slice(0, 40).map(ep => ({
    id: ep.id,
    title: ep.title,
    publishedAt: ep.publishedAt,
    format: ep.dimensions?.format,
    hookType: ep.dimensions?.hookType,
    contentType: ep.dimensions?.contentType,
    topicCluster: ep.dimensions?.topicCluster,
    emotionalTone: ep.dimensions?.emotionalTone,
    viewCount: ep.viewCount || 0,
    likeCount: ep.likeCount || 0,
    commentCount: ep.commentCount || 0,
    summary: ep.summary,
    topics: ep.topics,
  }));

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `You are a content strategist for a YouTube creator. Analyse their episode history and generate 9 high-potential future episode ideas.

Episode history:
${JSON.stringify(episodeSummaries, null, 2)}

For each idea consider:
- Which topic clusters drive the most views on this channel
- What angles on successful topics have NOT been covered yet (gaps)
- Episodes that could become follow-ups or series continuations
- Topics that performed well but haven't been revisited recently
- Adjacent topics the audience would likely enjoy based on patterns

Return JSON only, no markdown fences:
{
  "ideas": [
    {
      "title": "Punchy episode title",
      "brief": "2-3 sentence description of what the episode covers — written as a brief for a script writer",
      "why": "Specific data-backed reason this would perform well — reference actual view counts or patterns from their history",
      "type": "gap|follow-up|series|trending|revisit",
      "recommendedFormat": "solo|interview|co-hosted|panel|narrative|qa",
      "recommendedHookType": "bold-claim|personal-story|controversial-question|surprising-statistic|cold-open|direct-challenge",
      "topicCluster": "2-3 word topic label",
      "relatedEpisodeTitles": ["title of related past episode if any"],
      "estimatedPotential": "high|medium"
    }
  ]
}

Return exactly 9 ideas. Mix of types. Order by estimated potential descending.`,
    }],
  });

  const text = response.content.find(b => b.type === 'text')?.text || '';
  const json = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json).ideas;
}

export async function analyseEpisodeDataForScript(brief, episodes) {
  const client = getClient();

  const episodeSummaries = episodes.slice(0, 30).map(ep => ({
    id: ep.id,
    title: ep.title,
    format: ep.dimensions?.format,
    hookType: ep.dimensions?.hookType,
    contentType: ep.dimensions?.contentType,
    emotionalTone: ep.dimensions?.emotionalTone,
    topicCluster: ep.dimensions?.topicCluster,
    viewCount: ep.viewCount || 0,
    likeCount: ep.likeCount || 0,
    commentCount: ep.commentCount || 0,
    publishedAt: ep.publishedAt,
    summary: ep.summary,
  }));

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `You are a podcast strategy advisor. A creator wants to record an episode about: "${brief}"

Here is their past episode performance data:
${JSON.stringify(episodeSummaries, null, 2)}

Analyse the data and return a strategic data brief. Base all recommendations on actual patterns in the data — reference specific view counts and episode titles.

Return JSON only, no markdown fences:
{
  "recommendedFormat": "solo|interview|co-hosted|panel|narrative|qa",
  "recommendedLength": "e.g. 35-42 mins",
  "recommendedHookType": "bold-claim|personal-story|controversial-question|surprising-statistic|cold-open|direct-challenge",
  "hookReason": "specific reason with data — e.g. your 3 highest performing episodes all opened with a personal story",
  "formatReason": "specific reason with data and view counts",
  "callbackSuggestion": "suggest a specific past episode moment to reference, or null",
  "guestRecommendation": false,
  "guestReason": "why solo or guest based on data",
  "topicHistory": [
    {
      "episodeId": "ep id",
      "title": "episode title",
      "viewCount": 0,
      "relevantMoment": "one sentence describing the most relevant angle from this episode"
    }
  ]
}

topicHistory: include up to 3 past episodes most relevant to the brief topic. If none are relevant return empty array.`,
    }],
  });

  const text = response.content.find(b => b.type === 'text')?.text || '';
  const json = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json);
}

export async function generateEpisodeScript(brief, dataBrief, relatedEpisodes) {
  const client = getClient();

  const transcriptContext = relatedEpisodes
    .filter(ep => ep.transcript)
    .slice(0, 3)
    .map(ep => `=== ${ep.title} ===\n${ep.transcript.substring(0, 2000)}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8096,
    thinking: { type: 'adaptive' },
    messages: [{
      role: 'user',
      content: `You are a podcast script writer. Write a full episode script for a creator based on their brief and past performance data.

Episode brief: "${brief}"

Strategic data brief:
${JSON.stringify(dataBrief, null, 2)}

Past episode transcripts (learn the host's voice, vocabulary, and style from these):
${transcriptContext || 'No past transcripts available — write in a confident, conversational podcast style.'}

Write a complete episode script that:
- Opens with a ${dataBrief.recommendedHookType} hook
- Matches the host's voice and speaking style from past transcripts
- Targets ${dataBrief.recommendedLength} runtime
- Uses ${dataBrief.recommendedFormat} format
- ${dataBrief.callbackSuggestion ? `Includes a callback: ${dataBrief.callbackSuggestion}` : 'Includes natural callbacks to build depth'}

Return JSON only, no markdown fences:
{
  "title": "Suggested episode title",
  "altTitles": ["variant 1", "variant 2", "variant 3"],
  "estimatedLength": "e.g. 41 mins",
  "sections": [
    {
      "type": "hook",
      "label": "Opening Hook",
      "timestamp": "0:00",
      "content": "Full written script for this section — several paragraphs of actual spoken word content",
      "note": "explain the strategic choice made here"
    }
  ]
}

Section types to include (in order): hook, intro, chapter (2-4 chapters), callback (if relevant), close.
Each section content should be substantial — full spoken paragraphs the host can read directly.`,
    }],
  });

  const text = response.content.find(b => b.type === 'text')?.text || '';
  const json = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json);
}

export async function regenerateScriptSection(section, brief, dataBrief, hostVoiceSample) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Rewrite this single podcast script section. Keep the same strategic intent but vary the approach.

Episode brief: "${brief}"
Section type: ${section.type}
Section label: ${section.label}
Current content: ${section.content}

Host voice sample (match this style):
${hostVoiceSample ? hostVoiceSample.substring(0, 800) : 'Write in a confident, conversational podcast style.'}

Data brief context:
- Hook type: ${dataBrief.recommendedHookType}
- Format: ${dataBrief.recommendedFormat}

Return JSON only, no markdown fences:
{
  "content": "full rewritten section content",
  "note": "what changed and why"
}`,
    }],
  });

  const text = response.content[0].text;
  const json = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json);
}

export async function generateChannelInsights(episodes) {
  const client = getClient();

  // Build aggregated performance data per dimension value
  const dims = ['format', 'hookType', 'contentType', 'emotionalTone', 'topicCluster'];
  const metrics = ['viewCount', 'likeCount', 'commentCount'];

  const agg = {};
  for (const dim of dims) {
    agg[dim] = {};
    for (const ep of episodes) {
      const val = ep.dimensions?.[dim];
      if (!val) continue;
      if (!agg[dim][val]) agg[dim][val] = { views: [], likes: [], comments: [], count: 0 };
      agg[dim][val].views.push(ep.viewCount || 0);
      agg[dim][val].likes.push(ep.likeCount || 0);
      agg[dim][val].comments.push(ep.commentCount || 0);
      agg[dim][val].count++;
    }
  }

  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // Flatten into readable summary
  const summary = {};
  for (const dim of dims) {
    summary[dim] = Object.entries(agg[dim]).map(([val, d]) => ({
      value: val,
      count: d.count,
      avgViews: avg(d.views),
      avgLikes: avg(d.likes),
      avgComments: avg(d.comments),
    })).sort((a, b) => b.avgViews - a.avgViews);
  }

  const episodeSummary = episodes.slice(0, 20).map(ep => ({
    title: ep.title,
    views: ep.viewCount || 0,
    likes: ep.likeCount || 0,
    comments: ep.commentCount || 0,
    format: ep.dimensions?.format,
    hookType: ep.dimensions?.hookType,
    contentType: ep.dimensions?.contentType,
    emotionalTone: ep.dimensions?.emotionalTone,
    topicCluster: ep.dimensions?.topicCluster,
  }));

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: `You are a YouTube channel strategy advisor. Analyse this channel's episode performance data and give specific, actionable tactical recommendations the creator should act on.

Performance by dimension:
${JSON.stringify(summary, null, 2)}

Recent episodes (title + metrics):
${JSON.stringify(episodeSummary, null, 2)}

Total episodes analysed: ${episodes.length}

Return 5 tactical insights as JSON. Each insight must:
- Reference specific numbers from the data (e.g. "3.2x more views", "averaging 45k vs 12k")
- Give a clear action the creator should take
- Explain the "why" in one sentence

{
  "insights": [
    {
      "title": "Short punchy title (5-7 words)",
      "finding": "What the data shows — with specific numbers",
      "action": "Exactly what to do next",
      "impact": "high | medium | low"
    }
  ]
}`,
      },
    ],
  });

  const text = response.content.find(b => b.type === 'text')?.text;
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json).insights;
}

export async function analyzeEpisodeDimensions(episode) {
  const client = getClient();
  const openingMinutes = episode.transcript.substring(0, 800);

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyse this podcast episode and classify it across these dimensions. Use only the allowed values listed.

Episode title: "${episode.title}"
Opening (first ~2 mins): ${openingMinutes}
Full transcript excerpt: ${episode.transcript.substring(0, 2000)}

Classify:

format — one of: solo, interview, co-hosted, panel, narrative, qa

hookType — read the opening carefully, one of:
  bold-claim, personal-story, controversial-question, surprising-statistic, cold-open, direct-challenge

contentType — one of:
  tactical, opinion, case-study, personal-story, trend-analysis, industry-news, myth-busting

emotionalTone — one of:
  energetic, reflective, confrontational, vulnerable, educational

guestType — one of:
  new-guest, return-guest, solo, co-host

topicCluster — a short 2-3 word label grouping the episode's core subject (e.g. "AI & Design", "Founder Mindset", "Remote Work")

titleStructure — one of: question, statement, listicle, how-to

titleLengthOk — true if the title is under 60 characters, false if over

Respond in JSON only:
{
  "format": "...",
  "hookType": "...",
  "contentType": "...",
  "emotionalTone": "...",
  "guestType": "...",
  "topicCluster": "...",
  "titleStructure": "...",
  "titleLengthOk": true
}`,
      },
    ],
  });

  const text = response.content[0].text;
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return JSON.parse(json);
}
