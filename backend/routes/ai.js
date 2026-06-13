import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getEpisodes, getChannels, upsertEpisode } from '../services/store.js';
import { fetchCaptions, cleanupCaptions } from '../services/captions.js';
import { analyseDimensions, analyseEpisode } from '../services/analyse.js';
import { getApiKey } from '../services/keys.js';

const router = Router();
async function getClient() {
  return new Anthropic({ apiKey: await getApiKey('ANTHROPIC_API_KEY') });
}

function parseJson(text) {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  return JSON.parse(match[0]);
}

// ── Semantic Search ───────────────────────────────────────────────────────────
// POST /api/ai/search
// body: { query, episodes }
router.post('/search', async (req, res) => {
  const { query, episodes } = req.body;
  if (!query || !episodes) return res.status(400).json({ error: 'query and episodes required' });

  try {
    const analysed = episodes.filter(ep => ep.summary);
    const unanalysed = episodes.filter(ep => !ep.summary && ep.transcript);

    const episodeList = [
      ...analysed.map(ep => `[${ep.id}] "${ep.title}" — ${ep.summary || ''}\nTopics: ${(ep.topics || []).join(', ')}`),
      ...unanalysed.map(ep => `[${ep.id}] "${ep.title}" (transcript available, no summary yet)`),
    ].join('\n\n');

    if (!episodeList.trim()) return res.json([]);

    const matchRes = await (await getClient()).messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a podcast search engine. Find the most relevant episodes for the query below.

Episodes:
${episodeList}

Query: "${query}"

Return JSON only:
{
  "results": [
    { "id": "ep-xxx", "relevance": "one sentence why it matches" }
  ]
}

Up to 5 results, ranked by relevance. Empty array if nothing matches.`,
      }],
    });

    const { results: matchedIds } = parseJson(matchRes.content[0].text);
    if (!matchedIds?.length) return res.json([]);

    // Pass 2: find specific passage + timestamp per episode
    const enriched = await Promise.all(
      matchedIds.map(async ({ id, relevance }) => {
        const episode = episodes.find(ep => ep.id === id);
        if (!episode) return null;
        if (!episode.transcript) return { episode, relevance, passage: null, timestampSecs: null };

        try {
          const excerptRes = await (await getClient()).messages.create({
            model: 'claude-opus-4-8',
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: `Find the single most relevant passage in this transcript for the query: "${query}"

Transcript:
${episode.transcript}

Return JSON only:
{
  "passage": "exact short quote from the transcript (max 2 sentences)",
  "position": 0.0
}

"position" is a decimal 0.0–1.0 indicating where in the transcript this passage appears (0 = start, 1 = end). Be accurate.`,
            }],
          });

          const { passage, position } = parseJson(excerptRes.content[0].text);
          const timestampSecs = episode.duration ? Math.round(position * episode.duration) : null;
          return { episode, relevance, passage, timestampSecs };
        } catch {
          return { episode, relevance, passage: null, timestampSecs: null };
        }
      })
    );

    res.json(enriched.filter(Boolean));
  } catch (err) {
    console.error('[ai/search]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Show Notes ────────────────────────────────────────────────────────────────
// POST /api/ai/show-notes
// body: { episode }
router.post('/show-notes', async (req, res) => {
  const { episode } = req.body;
  if (!episode) return res.status(400).json({ error: 'episode required' });

  try {
    const response = await (await getClient()).messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{
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
      }],
    });
    res.json({ text: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chapter Markers ───────────────────────────────────────────────────────────
// POST /api/ai/chapters
// body: { transcript, duration }
router.post('/chapters', async (req, res) => {
  const { transcript, duration } = req.body;
  if (!transcript) return res.status(400).json({ error: 'transcript required' });

  try {
    const response = await (await getClient()).messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Given this podcast transcript (total duration: ${Math.floor((duration || 0) / 60)} minutes), generate chapter markers. Identify natural topic transitions and assign approximate timestamps.

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
      }],
    });
    const { chapters } = parseJson(response.content[0].text);
    res.json({ chapters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Cross-Channel Insights ────────────────────────────────────────────────────
// POST /api/ai/cross-channel-insights
// body: { channelStats }
router.post('/cross-channel-insights', async (req, res) => {
  const { channelStats } = req.body;
  if (!channelStats) return res.status(400).json({ error: 'channelStats required' });

  try {
    const response = await (await getClient()).messages.create({
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
    res.json(parseJson(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Episode Ideas ─────────────────────────────────────────────────────────────
// POST /api/ai/episode-ideas
// body: { episodes }
router.post('/episode-ideas', async (req, res) => {
  const { episodes, competitorData } = req.body;
  if (!episodes) return res.status(400).json({ error: 'episodes required' });

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

  const competitorSection = competitorData?.length > 0 ? `

## Competitor channel data
The creator has also provided top-performing videos from competitor channels in their niche. Use this to:
- Identify topics that perform well in the niche but the creator hasn't covered
- Spot title/hook patterns that drive high views for competitors
- Find angles the creator could do better or differently
- Avoid suggesting topics where competitors already dominate unless there's a clear differentiation angle

${competitorData.map(ch => `### ${ch.name} (${ch.subscriberCount?.toLocaleString() || '?'} subscribers)
Top videos:
${ch.topVideos.map(v => `- "${v.title}" — ${v.viewCount?.toLocaleString()} views | topic: ${v.topicCluster || '?'} | hook: ${v.hookType || '?'}`).join('\n')}`).join('\n\n')}` : '';

  try {
    const response = await (await getClient()).messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      messages: [{
        role: 'user',
        content: `You are a content strategist for a YouTube creator. Analyse their episode history${competitorData?.length ? ' and competitor data' : ''} and generate 9 high-potential future episode ideas.

## Creator's episode history
${JSON.stringify(episodeSummaries, null, 2)}
${competitorSection}

For each idea consider:
- Which topic clusters drive the most views on this channel
- What angles on successful topics have NOT been covered yet (gaps)
- Episodes that could become follow-ups or series continuations
- Topics that performed well but haven't been revisited recently
- Adjacent topics the audience would likely enjoy based on patterns${competitorData?.length ? '\n- Topics or formats proven to work for competitors that this creator could own with their unique angle' : ''}

Return JSON only, no markdown fences:
{
  "ideas": [
    {
      "title": "Punchy episode title",
      "brief": "2-3 sentence description of what the episode covers — written as a brief for a script writer",
      "why": "Specific data-backed reason this would perform well — reference actual view counts or patterns from their history${competitorData?.length ? ', or competitor data if relevant' : ''}",
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
    const { ideas } = parseJson(text);
    res.json({ ideas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Script Prep (data brief) ──────────────────────────────────────────────────
// POST /api/ai/script-prep
// body: { brief, episodes }
router.post('/script-prep', async (req, res) => {
  const { brief, episodes } = req.body;
  if (!brief || !episodes) return res.status(400).json({ error: 'brief and episodes required' });

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

  try {
    const response = await (await getClient()).messages.create({
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
  "hookReason": "specific reason with data",
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
    res.json(parseJson(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generate Script ───────────────────────────────────────────────────────────
// POST /api/ai/script
// body: { brief, dataBrief, relatedEpisodes }
router.post('/script', async (req, res) => {
  const { brief, dataBrief, relatedEpisodes } = req.body;
  if (!brief || !dataBrief) return res.status(400).json({ error: 'brief and dataBrief required' });

  const transcriptContext = (relatedEpisodes || [])
    .filter(ep => ep.transcript)
    .slice(0, 3)
    .map(ep => `=== ${ep.title} ===\n${ep.transcript.substring(0, 2000)}`)
    .join('\n\n');

  try {
    const response = await (await getClient()).messages.create({
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
    res.json(parseJson(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Regenerate Script Section ─────────────────────────────────────────────────
// POST /api/ai/script/section
// body: { section, brief, dataBrief, hostVoiceSample }
router.post('/script/section', async (req, res) => {
  const { section, brief, dataBrief, hostVoiceSample } = req.body;
  if (!section || !brief || !dataBrief) return res.status(400).json({ error: 'section, brief and dataBrief required' });

  try {
    const response = await (await getClient()).messages.create({
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
    res.json(parseJson(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Channel Insights ──────────────────────────────────────────────────────────
// POST /api/ai/channel-insights
// body: { episodes }
router.post('/channel-insights', async (req, res) => {
  const { episodes } = req.body;
  if (!episodes) return res.status(400).json({ error: 'episodes required' });

  const dims = ['format', 'hookType', 'contentType', 'emotionalTone', 'topicCluster'];
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
  const summary = {};
  for (const dim of dims) {
    summary[dim] = Object.entries(agg[dim]).map(([val, d]) => ({
      value: val, count: d.count,
      avgViews: avg(d.views), avgLikes: avg(d.likes), avgComments: avg(d.comments),
    })).sort((a, b) => b.avgViews - a.avgViews);
  }

  const episodeSummary = episodes.slice(0, 20).map(ep => ({
    title: ep.title, views: ep.viewCount || 0, likes: ep.likeCount || 0,
    comments: ep.commentCount || 0, format: ep.dimensions?.format,
    hookType: ep.dimensions?.hookType, contentType: ep.dimensions?.contentType,
    emotionalTone: ep.dimensions?.emotionalTone, topicCluster: ep.dimensions?.topicCluster,
  }));

  try {
    const response = await (await getClient()).messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      messages: [{
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
      }],
    });
    const text = response.content.find(b => b.type === 'text')?.text;
    const { insights } = parseJson(text);
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Outlier Analysis (SSE streaming) ─────────────────────────────────────────
// GET /api/ai/outlier-analysis/stream
// Streams progress as it transcribes top 5 videos per channel, then returns
// the final Claude analysis as a `result` event.
router.get('/outlier-analysis/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const userId = req.userId;
  try {
    const [channels, allEpisodes] = await Promise.all([
      getChannels(userId),
      getEpisodes(userId),
    ]);

    // Count total videos needing transcription for progress tracking
    const workItems = channels.flatMap(ch => {
      const eps = allEpisodes.filter(e => e.channelId === ch.id);
      return [...eps]
        .filter(e => e.viewCount > 0)
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 5)
        .map(ep => ({ ch, ep, eps }));
    });

    const needsTranscript = workItems.filter(w => !w.ep.transcript).length;
    const total = workItems.length;
    let done = 0;

    send({ type: 'start', total, needsTranscript, channels: channels.length });

    // Process all channels in parallel, videos within each channel in parallel
    const channelData = await Promise.all(channels.map(async (ch) => {
      const eps = allEpisodes.filter(e => e.channelId === ch.id);
      const top5 = [...eps]
        .filter(e => e.viewCount > 0)
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 5);

      const avgViews = eps.filter(e => e.viewCount > 0)
        .reduce((s, e) => s + e.viewCount, 0) / (eps.filter(e => e.viewCount > 0).length || 1);

      const enriched = await Promise.all(top5.map(async (ep) => {
        let transcript = ep.transcript;
        let dimensions = ep.dimensions;
        let summary = ep.summary;

        if (!transcript) {
          send({ type: 'progress', message: `Fetching transcript: "${ep.title.substring(0, 50)}…"`, done, total });
          try {
            const raw = await fetchCaptions(ep.videoId);
            transcript = await cleanupCaptions(raw, ep.title);
            const [analysis, dims] = await Promise.all([
              analyseEpisode(transcript, ep.title),
              analyseDimensions(transcript, ep.title),
            ]);
            summary = analysis.summary;
            dimensions = { ...ep.dimensions, ...dims };
            await upsertEpisode(userId, {
              ...ep, transcript, summary,
              topics: analysis.topics,
              sentiment: analysis.sentiment,
              dimensions,
              transcriptStatus: 'ok',
              syncedAt: new Date().toISOString(),
            });
          } catch {
            send({ type: 'progress', message: `No captions for "${ep.title.substring(0, 40)}…" — using title only`, done, total });
          }
        }

        done++;
        send({ type: 'progress', message: `Done: "${ep.title.substring(0, 50)}…"`, done, total });

        const multiplier = avgViews > 0 ? ep.viewCount / avgViews : null;
        return {
          title: ep.title,
          viewCount: ep.viewCount,
          multiplier: multiplier ? parseFloat(multiplier.toFixed(1)) : null,
          format: dimensions?.format,
          hookType: dimensions?.hookType,
          contentType: dimensions?.contentType,
          emotionalTone: dimensions?.emotionalTone,
          topicCluster: dimensions?.topicCluster,
          titleStructure: dimensions?.titleStructure,
          summary: summary || null,
          openingLines: transcript ? transcript.substring(0, 400) : null,
        };
      }));

      return {
        channelName: ch.name,
        subscriberCount: ch.subscriberCount,
        avgViews: Math.round(avgViews),
        totalVideos: eps.length,
        topVideos: enriched,
      };
    }));

    // Compute hard stats to feed into Claude
    const allTopVideos = channelData.flatMap(ch => ch.topVideos);
    const totalVids = allTopVideos.length;

    function dist(arr, key) {
      const counts = {};
      for (const v of arr) { const k = v[key]; if (k) counts[k] = (counts[k] || 0) + 1; }
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count, pct: Math.round((count / totalVids) * 100) }));
    }

    const withMultiplier = allTopVideos.filter(v => v.multiplier !== null);
    const avgMultiplier = withMultiplier.length
      ? parseFloat((withMultiplier.reduce((s, v) => s + v.multiplier, 0) / withMultiplier.length).toFixed(1))
      : null;

    const aggregated = {
      totalTopVideos: totalVids,
      avgViewMultiplier: avgMultiplier,
      hookTypes: dist(allTopVideos, 'hookType'),
      formats: dist(allTopVideos, 'format'),
      contentTypes: dist(allTopVideos, 'contentType'),
      emotionalTones: dist(allTopVideos, 'emotionalTone'),
      topicClusters: dist(allTopVideos, 'topicCluster').slice(0, 8),
    };

    send({ type: 'analysing', message: 'Transcription complete — running AI analysis…' });

    // Stream Claude response token-by-token through SSE
    let fullText = '';
    const stream = await (await getClient()).messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 5000,
      thinking: { type: 'adaptive' },
      messages: [{
        role: 'user',
        content: `You are a YouTube content strategist. Analyse the top 5 performing videos for each channel. Structure your analysis in three parts: per-channel breakdown, cross-channel patterns, then overall take.

AGGREGATED STATS across all top videos:
${JSON.stringify(aggregated, null, 2)}

PER-CHANNEL DATA (viewMultiplier = how many times their channel average this video got):
${JSON.stringify(channelData, null, 2)}

Return JSON only, no markdown:
{
  "channels": [
    {
      "channelName": "exact channel name",
      "avgViews": 12345,
      "topVideos": [
        {
          "title": "exact video title",
          "multiplier": 3.2,
          "whyItWorked": "One sentence — specific reason based on hook, topic, format, or opening"
        }
      ],
      "channelPattern": "1-2 sentences on what this channel's top videos have in common — be specific"
    }
  ],
  "crossChannelPatterns": [
    {
      "pattern": "Short name",
      "finding": "Specific finding with channel names and numbers — e.g. '4 of 5 channels saw their highest-multiplier video use a bold-claim hook'",
      "strength": "strong|moderate"
    }
  ],
  "overallTake": {
    "headline": "One punchy sentence summarising what wins across this niche",
    "dataPoints": [
      "X% of top videos used [hook] hooks",
      "Top videos averaged Xx the channel average",
      "Another hard stat from the aggregated data"
    ],
    "conclusion": "2-3 sentences — what should someone take from this when planning their next video?",
    "steal": [
      "Specific actionable thing to copy",
      "Specific thing 2",
      "Specific thing 3"
    ]
  }
}`,
      }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        fullText += event.delta.text;
        send({ type: 'token', text: event.delta.text });
      }
    }

    send({ type: 'result', data: parseJson(fullText) });
  } catch (err) {
    console.error('[outlier-analysis/stream]', err.message);
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

export default router;
