import { useState, useMemo, useEffect } from 'react';
import {
  GitCompare, Sparkles, Loader2, AlertCircle, ChevronUp, ChevronDown,
  ChevronsUpDown, TrendingUp, Zap, Target, Plus, X, Trophy, Users,
  BarChart2, ArrowUpRight, BookOpen,
} from 'lucide-react';
import { generateOutlierAnalysis, fetchSavedInsights, persistInsights } from '../lib/claude';
import { apiFetch } from '../lib/api';

// ── constants ─────────────────────────────────────────────────────────────────

const CHANNEL_PALETTE = [
  { bar: 'bg-th-accent',    text: 'text-th-accent',    light: 'bg-th-accent/10 border-th-accent/25 text-th-accent' },
  { bar: 'bg-sky-500',      text: 'text-sky-300',      light: 'bg-sky-500/15 border-sky-500/25 text-sky-300' },
  { bar: 'bg-emerald-500',  text: 'text-emerald-300',  light: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300' },
  { bar: 'bg-amber-500',    text: 'text-amber-300',    light: 'bg-amber-500/15 border-amber-500/25 text-amber-300' },
  { bar: 'bg-pink-500',     text: 'text-pink-300',     light: 'bg-pink-500/15 border-pink-500/25 text-pink-300' },
];

const DIM_COLORS = {
  solo: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  interview: 'bg-th-accent/10 text-th-accent border-th-accent/20',
  'co-hosted': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'bold-claim': 'bg-red-500/10 text-red-300 border-red-500/20',
  'personal-story': 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  'controversial-question': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'surprising-statistic': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'cold-open': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  tactical: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  opinion: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  energetic: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  educational: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const DIM_LABELS = {
  format:        { solo: 'Solo', interview: 'Interview', 'co-hosted': 'Co-hosted', panel: 'Panel', narrative: 'Narrative', qa: 'Q&A' },
  hookType:      { 'bold-claim': 'Bold Claim', 'personal-story': 'Personal Story', 'controversial-question': 'Controversial Q', 'surprising-statistic': 'Stat', 'cold-open': 'Cold Open', 'direct-challenge': 'Direct Challenge' },
  contentType:   { tactical: 'Tactical', opinion: 'Opinion', 'case-study': 'Case Study', 'personal-story': 'Story', 'trend-analysis': 'Trend', 'industry-news': 'Industry', 'myth-busting': 'Myth Bust' },
  emotionalTone: { energetic: 'Energetic', reflective: 'Reflective', confrontational: 'Confrontational', vulnerable: 'Vulnerable', educational: 'Educational' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
}

function channelAge(createdAt) {
  if (!createdAt) return '—';
  const years = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return `${Math.round(years * 12)}mo`;
  return `${years.toFixed(1)}yr`;
}

function pct(n) {
  if (!n && n !== 0) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function topValue(episodes, dimKey) {
  const counts = {};
  for (const ep of episodes) {
    const v = ep.dimensions?.[dimKey];
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function postsPerMonth(videoCount, channelCreatedAt) {
  if (!videoCount || !channelCreatedAt) return null;
  const months = (Date.now() - new Date(channelCreatedAt)) / (1000 * 60 * 60 * 24 * 30.4);
  if (months < 1) return null;
  return parseFloat((videoCount / months).toFixed(1));
}

function buildChannelStats(episodes, channels = []) {
  const byChannel = {};
  for (const ep of episodes) {
    if (!ep.channelId) continue;
    if (!byChannel[ep.channelId]) byChannel[ep.channelId] = { name: ep.channelName || ep.channelId, episodes: [] };
    byChannel[ep.channelId].episodes.push(ep);
  }

  return Object.entries(byChannel).map(([channelId, { name, episodes: eps }], idx) => {
    const meta = channels.find(c => c.id === channelId) || {};
    const isPrimary = meta.isPrimary || false;
    const withViews = eps.filter(e => e.viewCount > 0);
    const avgViews = avg(withViews.map(e => e.viewCount));
    const avgLikes = avg(withViews.map(e => e.likeCount || 0));
    const avgComments = avg(withViews.map(e => e.commentCount || 0));
    const engagementRate = avgViews > 0 ? (avgLikes + avgComments) / avgViews : 0;

    const sorted = [...eps].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const recent = sorted.slice(0, 10).filter(e => e.viewCount > 0);
    const older = sorted.slice(10, 20).filter(e => e.viewCount > 0);
    const recentAvg = recent.length ? avg(recent.map(e => e.viewCount)) : null;
    const olderAvg = older.length ? avg(older.map(e => e.viewCount)) : null;
    const growthPct = recentAvg && olderAvg ? ((recentAvg - olderAvg) / olderAvg) * 100 : null;

    const subs = meta.subscriberCount || 0;
    const viewsPerSub = subs > 0 ? avgViews / subs : null;

    return {
      channelId, name, isPrimary,
      paletteIdx: idx % CHANNEL_PALETTE.length,
      episodeCount: meta.videoCount || eps.length,
      syncedCount: eps.length,
      analysedCount: eps.filter(e => e.dimensions).length,
      subscriberCount: subs,
      totalViewCount: meta.totalViewCount || 0,
      channelCreatedAt: meta.channelCreatedAt || null,
      avgViews, avgLikes, avgComments, engagementRate,
      viewsPerSub, growthPct, recentAvg,
      ppm: postsPerMonth(meta.videoCount, meta.channelCreatedAt),
      topFormat: topValue(eps, 'format'),
      topHook: topValue(eps, 'hookType'),
      topContent: topValue(eps, 'contentType'),
      topTone: topValue(eps, 'emotionalTone'),
      episodes: eps,
    };
  });
}

// ── highlight cards ───────────────────────────────────────────────────────────

function HighlightCard({ icon: Icon, iconColor, label, channelName, channelPalette, isPrimary, value, subvalue, tip }) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={14} className="text-white" />
        </div>
        <span className="text-th-tx3 text-xs font-medium">{label}</span>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${channelPalette.bar}`} />
          <span className="text-th-tx1 text-sm font-semibold truncate">{channelName}</span>
          {isPrimary && (
            <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full shrink-0">You</span>
          )}
        </div>
        <p className={`text-base font-bold tabular-nums ${channelPalette.text}`}>{value}</p>
        {subvalue && <p className="text-th-tx4 text-[11px] mt-0.5">{subvalue}</p>}
      </div>
      {tip && <p className="text-th-tx3 text-[11px] leading-relaxed border-t border-th-border pt-2">{tip}</p>}
    </div>
  );
}

function buildHighlights(channelStats) {
  const withSubs = channelStats.filter(c => c.subscriberCount > 0);
  const withGrowth = channelStats.filter(c => c.growthPct !== null);
  const withVps = channelStats.filter(c => c.viewsPerSub !== null);

  const topViews   = [...channelStats].sort((a, b) => b.avgViews - a.avgViews)[0];
  const topGrowth  = withGrowth.length ? [...withGrowth].sort((a, b) => b.growthPct - a.growthPct)[0] : null;
  const topVps     = withVps.length ? [...withVps].sort((a, b) => b.viewsPerSub - a.viewsPerSub)[0] : null;
  const topEngage  = [...channelStats].sort((a, b) => b.engagementRate - a.engagementRate)[0];
  const topPpm     = channelStats.filter(c => c.ppm).sort((a, b) => b.ppm - a.ppm)[0];

  // Overperformer: highest viewsPerSub among channels with <median subs
  const medianSubs = withSubs.length
    ? [...withSubs].sort((a, b) => a.subscriberCount - b.subscriberCount)[Math.floor(withSubs.length / 2)]?.subscriberCount
    : null;
  const smallChannels = medianSubs ? withVps.filter(c => c.subscriberCount < medianSubs) : [];
  const overperformer = smallChannels.length > 1 ? [...smallChannels].sort((a, b) => b.viewsPerSub - a.viewsPerSub)[0] : null;

  return { topViews, topGrowth, topVps, topEngage, topPpm, overperformer };
}

// ── sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sortCol, dir }) {
  if (col !== sortCol) return <ChevronsUpDown size={11} className="text-th-tx4" />;
  return dir === 'asc' ? <ChevronUp size={11} className="text-th-accent" /> : <ChevronDown size={11} className="text-th-accent" />;
}

// ── Outlier insights panel ────────────────────────────────────────────────────

function OutlierPanel({ insights }) {
  return (
    <div className="space-y-6">

      {insights.outlierPatterns?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-th-accent" /> Why the top videos outperformed
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.outlierPatterns.map((p, i) => (
              <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${p.strength === 'strong' ? 'bg-th-accent/10 text-th-accent border-th-accent/25' : 'bg-th-raised text-th-tx2 border-th-border'}`}>
                    {p.strength}
                  </span>
                  <p className="text-th-tx1 text-xs font-medium">{p.pattern}</p>
                </div>
                <p className="text-th-tx2 text-xs leading-relaxed mb-2">{p.finding}</p>
                {p.examples?.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {p.examples.map((ex, j) => (
                      <span key={j} className="text-th-tx4 text-[11px] italic">"{ex}"</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.hookAnalysis && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <h3 className="text-amber-300 text-sm font-semibold mb-1 flex items-center gap-2">
            <Zap size={13} /> Dominant hook: {insights.hookAnalysis.dominantHook}
          </h3>
          <p className="text-amber-200/80 text-sm leading-relaxed mb-2">{insights.hookAnalysis.whyItWorks}</p>
          {insights.hookAnalysis.bestExample && (
            <p className="text-amber-300/60 text-xs italic">Best example: "{insights.hookAnalysis.bestExample}"</p>
          )}
        </div>
      )}

      {insights.topicClusters?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart2 size={14} className="text-sky-400" /> Topics that punch above average
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.topicClusters.map((t, i) => (
              <div key={i} className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4">
                <p className="text-sky-300 text-xs font-semibold mb-1">{t.topic}</p>
                <p className="text-sky-200/70 text-xs mb-2">{t.performance}</p>
                <p className="text-th-tx4 text-[11px]">{t.channels?.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.titlePatterns?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <Target size={14} className="text-pink-400" /> Title formulas that work
          </h3>
          <div className="bg-th-surface border border-th-border rounded-xl divide-y divide-th-border">
            {insights.titlePatterns.map((t, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="w-5 h-5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-th-tx2 text-sm leading-relaxed font-mono text-xs">{t}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.steal?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <BookOpen size={14} className="text-emerald-400" /> What to steal
          </h3>
          <div className="bg-th-surface border border-th-border rounded-xl divide-y divide-th-border">
            {insights.steal.map((action, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-th-tx2 text-sm leading-relaxed">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── add channel form ──────────────────────────────────────────────────────────

function AddChannelForm({ onAdded, onCancel }) {
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError('');
    setAdding(true);
    try {
      const res = await apiFetch('/api/channels/compare-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUrl('');
      onAdded(data.channel);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <form onSubmit={handleAdd} className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={url}
        onChange={e => { setUrl(e.target.value); setError(''); }}
        placeholder="YouTube channel URL or @handle"
        autoFocus
        className="bg-th-raised border border-th-border rounded-lg px-3 py-1.5 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent transition-colors w-72"
      />
      <button
        type="submit"
        disabled={adding || !url.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-xs font-medium transition-colors"
      >
        {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
        {adding ? 'Importing…' : 'Add'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-th-tx4 hover:text-th-tx2 transition-colors">
          <X size={14} />
        </button>
      )}
      {adding && (
        <span className="text-th-tx4 text-xs">Fetching all videos + analysing titles…</span>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}

// ── growth score ranking ──────────────────────────────────────────────────────

const SCORE_FACTORS = [
  { key: 'momentum',    label: 'Momentum',    weight: 0.40, color: '#34d399' },
  { key: 'avgViews',    label: 'Avg Views',   weight: 0.35, color: '#38bdf8' },
  { key: 'engagement',  label: 'Engagement',  weight: 0.15, color: '#f472b6' },
  { key: 'consistency', label: 'Consistency', weight: 0.10, color: '#fbbf24' },
];

function buildGrowthScores(channelStats) {
  const raw = channelStats.map(ch => ({
    channelId: ch.channelId,
    momentum:    ch.growthPct !== null ? Math.max(0, ch.growthPct + 100) : null,
    avgViews:    ch.avgViews || null,
    engagement:  ch.engagementRate || null,
    consistency: ch.ppm || null,
  }));

  // Ratio normalise: score = value / max across channels × 100
  // This means the best channel scores 100 on a factor, others score proportionally
  // (avoids the min-max problem where the loser always gets 0)
  const maxByFactor = {};
  for (const { key } of SCORE_FACTORS) {
    const vals = raw.map(r => r[key]).filter(v => v !== null && isFinite(v) && v > 0);
    maxByFactor[key] = vals.length ? Math.max(...vals) : null;
  }

  return channelStats.map((ch, i) => {
    const r = raw[i];
    const breakdown = {};
    let totalScore = 0;
    let totalWeight = 0;

    for (const { key, weight } of SCORE_FACTORS) {
      const v = r[key];
      const maxV = maxByFactor[key];
      const hasData = v !== null && isFinite(v) && maxV !== null;
      const norm = hasData ? Math.min(v / maxV, 1) : null;
      breakdown[key] = norm !== null ? Math.round(norm * 100) : null;
      if (norm !== null) {
        totalScore += norm * weight;
        totalWeight += weight;
      }
    }

    const score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
    return { ...ch, score, breakdown };
  }).sort((a, b) => b.score - a.score);
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function GrowthScorePanel({ channelStats }) {
  if (channelStats.length < 2) return null;
  const scored = buildGrowthScores(channelStats);
  const topScore = scored[0].score || 1;

  return (
    <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
      {scored.map((ch, rank) => {
        const pal = CHANNEL_PALETTE[ch.paletteIdx];
        const barW = (ch.score / 100) * 100;
        const isFirst = rank === 0;

        return (
          <div
            key={ch.channelId}
            className={`px-5 py-4 ${rank < scored.length - 1 ? 'border-b border-th-border/60' : ''} ${isFirst ? 'bg-th-raised/40' : ''}`}
          >
            {/* Row: rank + name + score */}
            <div className="flex items-center gap-3 mb-3">
              {/* Rank */}
              <div className="w-8 shrink-0 text-center">
                {rank < 3
                  ? <span className="text-base leading-none">{RANK_MEDALS[rank]}</span>
                  : <span className="text-th-tx4 text-sm font-bold">#{rank + 1}</span>
                }
              </div>

              {/* Name */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${pal.bar}`} />
                <span className="text-th-tx1 text-sm font-medium truncate">{ch.name}</span>
                {ch.isPrimary && (
                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full shrink-0">You</span>
                )}
                {ch.episodeCount < 20 && (
                  <span className="text-[10px] font-medium bg-orange-500/15 text-orange-300 border border-orange-500/25 px-1.5 py-0.5 rounded-full shrink-0" title="Fewer than 20 videos — score may not be reliable">
                    ⚠ Low data
                  </span>
                )}
              </div>

              {/* Score */}
              <div className="shrink-0 text-right">
                <span className={`text-2xl font-bold tabular-nums ${isFirst ? pal.text : 'text-th-tx1'}`}>{ch.score}</span>
                <span className="text-th-tx4 text-xs ml-0.5">/100</span>
              </div>
            </div>

            {/* Main score bar */}
            <div className="ml-11 mb-3">
              <div className="h-2 bg-th-raised rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pal.bar}`}
                  style={{ width: `${barW}%` }}
                />
              </div>
            </div>

            {/* Factor breakdown */}
            <div className="ml-11 grid grid-cols-4 gap-2">
              {SCORE_FACTORS.map(f => (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-th-tx4 text-[10px]">{f.label}</span>
                    <span className="text-th-tx3 text-[10px] tabular-nums">{ch.breakdown[f.key]}</span>
                  </div>
                  <div className="h-1 bg-th-raised rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${ch.breakdown[f.key]}%`, backgroundColor: f.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="px-5 py-3 border-t border-th-border/60 bg-th-raised/20">
        <p className="text-th-tx4 text-[11px]">
          Score weights: Momentum 40% · Views/Sub 30% · Engagement 20% · Posting Consistency 10%. All channels scored relative to each other.
        </p>
      </div>
    </div>
  );
}

// ── table ─────────────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { key: 'name',            label: 'Channel',     sortable: true },
  { key: 'subscriberCount', label: 'Subscribers', sortable: true },
  { key: 'channelCreatedAt',label: 'Age',         sortable: true },
  { key: 'episodeCount',    label: 'Episodes',    sortable: true },
  { key: 'ppm',             label: 'Posts/Mo',    sortable: true },
  { key: 'avgViews',        label: 'Avg Views',   sortable: true },
  { key: 'viewsPerSub',     label: 'Views/Sub',   sortable: true },
  { key: 'engagementRate',  label: 'Engagement',  sortable: true },
  { key: 'topFormat',       label: 'Top Format',  sortable: false },
  { key: 'topHook',         label: 'Top Hook',    sortable: false },
];

// ── main ──────────────────────────────────────────────────────────────────────

export default function Compare({ episodes, channels = [], onChannelsLoaded }) {
  const [sortCol, setSortCol] = useState('avgViews');
  const [sortDir, setSortDir] = useState('desc');
  const [insights, setInsights] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [progress, setProgress] = useState(null); // { done, total, message }
  const [streamText, setStreamText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  // Map of channelId → { running, analysed, total }
  const [topAnalysis, setTopAnalysis] = useState({});

  useEffect(() => {
    fetchSavedInsights('compareInsights').then(saved => { if (saved) setInsights(saved); }).catch(() => {});
  }, []);

  // Poll top-analysis status for any compare_only channels that are running
  useEffect(() => {
    const compareChannels = channels.filter(c => c.compareOnly);
    if (!compareChannels.length) return;

    let active = true;
    const poll = async () => {
      for (const ch of compareChannels) {
        try {
          const res = await apiFetch(`/api/channels/${ch.id}/top-status`);
          const data = await res.json();
          setTopAnalysis(prev => {
            const wasRunning = prev[ch.id]?.running;
            if (wasRunning && !data.running) onChannelsLoaded?.();
            return { ...prev, [ch.id]: data };
          });
        } catch {}
      }
      if (active) setTimeout(poll, 8000);
    };
    poll();
    return () => { active = false; };
  }, [channels]);

  const channelStats = useMemo(() => buildChannelStats(episodes, channels), [episodes, channels]);
  const highlights = useMemo(() => buildHighlights(channelStats), [channelStats]);

  const handleChannelAdded = (channel) => {
    setShowAddForm(false);
    // Mark this channel as pending analysis immediately for instant UI feedback
    if (channel?.id) {
      setTopAnalysis(prev => ({ ...prev, [channel.id]: { running: true, analysed: 0, total: 5 } }));
    }
    onChannelsLoaded?.();
  };

  const sorted = useMemo(() => {
    return [...channelStats].sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [channelStats, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setInsightError('');
    setProgress(null);
    setStreamText('');
    setInsights(null);
    try {
      const result = await generateOutlierAnalysis((event) => {
        if (event.type === 'start') {
          setProgress({ done: 0, total: event.total, message: `Starting — ${event.needsTranscript} videos need transcription across ${event.channels} channels` });
        } else if (event.type === 'progress') {
          setProgress(p => ({ ...p, done: event.done, total: event.total, message: event.message }));
        } else if (event.type === 'analysing') {
          setProgress(p => ({ ...p, message: event.message, analysing: true }));
        } else if (event.type === 'token') {
          setStreamText(t => t + event.text);
        }
      });
      setInsights(result);
      setStreamText('');
      persistInsights('compareInsights', result).catch(() => {});
    } catch (e) {
      setInsightError(e.message);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  const totalChannels = channelStats.length;
  const totalEpisodes = channelStats.reduce((s, c) => s + c.episodeCount, 0);
  const analysedEpisodes = channelStats.reduce((s, c) => s + c.analysedCount, 0);

  if (totalChannels < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <GitCompare size={36} className="text-th-raised mb-4" />
        <p className="text-th-tx2 text-sm font-medium mb-2">Add at least 2 channels to compare</p>
        <p className="text-th-tx4 text-xs max-w-xs leading-relaxed mb-6">
          Add your channel plus competitors or channels in your niche to learn what's working.
        </p>
        {showAddForm ? (
          <AddChannelForm onAdded={handleChannelAdded} onCancel={() => setShowAddForm(false)} />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accentH text-th-accentFg text-sm font-medium transition-colors"
          >
            <Plus size={14} /> Add channel
          </button>
        )}
      </div>
    );
  }

  const { topViews, topGrowth, topVps, topEngage, overperformer } = highlights;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="border-b border-th-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg flex items-center gap-2">
              <GitCompare size={17} className="text-th-accent" />
              Niche Research
            </h1>
            <p className="text-th-tx3 text-xs mt-0.5">
              {totalChannels} channels · {totalEpisodes} episodes · {analysedEpisodes} analysed
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-sm transition-colors"
          >
            {generating
              ? <><Loader2 size={14} className="animate-spin" />Transcribing &amp; analysing…</>
              : <><Sparkles size={14} />{insights ? 'Re-analyse outliers' : 'Analyse top videos'}</>}
          </button>
        </div>

        {/* Channel legend + add */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {channelStats.map(ch => {
            const pal = CHANNEL_PALETTE[ch.paletteIdx];
            const tas = topAnalysis[ch.channelId];
            const analysing = tas?.running;
            return (
              <span key={ch.channelId} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${pal.light}`}>
                <span className={`w-2 h-2 rounded-full ${pal.bar}`} />
                {ch.name}
                {ch.isPrimary && (
                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full">You</span>
                )}
                {analysing && (
                  <span className="flex items-center gap-1 text-[10px] text-th-tx4">
                    <Loader2 size={9} className="animate-spin" />
                    {tas.analysed}/{tas.total} analysed
                  </span>
                )}
              </span>
            );
          })}
          {showAddForm ? (
            <AddChannelForm onAdded={handleChannelAdded} onCancel={() => setShowAddForm(false)} />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-dashed border-th-border text-th-tx4 hover:text-th-tx2 hover:border-th-border transition-colors"
            >
              <Plus size={10} /> Add channel
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">

        {/* ── Highlight cards ── */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-th-tx3 text-xs font-medium uppercase tracking-wider mb-3">Leaders in this niche</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {topViews && (
              <HighlightCard
                icon={Trophy} iconColor="bg-amber-500"
                label="Most views per episode"
                channelName={topViews.name}
                channelPalette={CHANNEL_PALETTE[topViews.paletteIdx]}
                isPrimary={topViews.isPrimary}
                value={fmt(topViews.avgViews)}
                subvalue={`${fmt(topViews.subscriberCount)} subscribers`}
                tip={topViews.topHook ? `Top hook: ${DIM_LABELS.hookType[topViews.topHook] || topViews.topHook}` : null}
              />
            )}
            {topGrowth && (
              <HighlightCard
                icon={ArrowUpRight} iconColor="bg-emerald-500"
                label="Fastest growing right now"
                channelName={topGrowth.name}
                channelPalette={CHANNEL_PALETTE[topGrowth.paletteIdx]}
                isPrimary={topGrowth.isPrimary}
                value={`${topGrowth.growthPct >= 0 ? '+' : ''}${topGrowth.growthPct.toFixed(0)}%`}
                subvalue="recent 10 vs previous 10 episodes"
                tip={topGrowth.topFormat ? `Format: ${DIM_LABELS.format[topGrowth.topFormat] || topGrowth.topFormat}` : null}
              />
            )}
            {topVps && (
              <HighlightCard
                icon={Users} iconColor="bg-sky-500"
                label="Best views per subscriber"
                channelName={topVps.name}
                channelPalette={CHANNEL_PALETTE[topVps.paletteIdx]}
                isPrimary={topVps.isPrimary}
                value={`${topVps.viewsPerSub.toFixed(2)}x`}
                subvalue="views per subscriber per episode"
                tip="High ratio = content resonates beyond their existing audience"
              />
            )}
            {overperformer ? (
              <HighlightCard
                icon={Zap} iconColor="bg-pink-500"
                label="Small channel, big results"
                channelName={overperformer.name}
                channelPalette={CHANNEL_PALETTE[overperformer.paletteIdx]}
                isPrimary={overperformer.isPrimary}
                value={`${overperformer.viewsPerSub.toFixed(2)}x`}
                subvalue={`only ${fmt(overperformer.subscriberCount)} subscribers`}
                tip="Study this channel — their content formula works without a big audience"
              />
            ) : topEngage && (
              <HighlightCard
                icon={BarChart2} iconColor="bg-purple-500"
                label="Most engaging audience"
                channelName={topEngage.name}
                channelPalette={CHANNEL_PALETTE[topEngage.paletteIdx]}
                isPrimary={topEngage.isPrimary}
                value={pct(topEngage.engagementRate)}
                subvalue="likes + comments / views"
                tip={topEngage.topContent ? `Content type: ${DIM_LABELS.contentType[topEngage.topContent] || topEngage.topContent}` : null}
              />
            )}
          </div>
        </div>

        {/* ── Growth score ranking ── */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-th-tx3 text-xs font-medium uppercase tracking-wider mb-3">Growth score ranking</p>
          <GrowthScorePanel channelStats={channelStats} />
        </div>

        {/* ── Stats table ── */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-th-tx3 text-xs font-medium uppercase tracking-wider mb-3">All channels</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead className="sticky top-0 bg-th-bg z-10">
              <tr className="border-b border-th-border">
                {TABLE_COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`text-left px-4 py-3 text-xs font-medium text-th-tx3 whitespace-nowrap select-none ${col.sortable ? 'cursor-pointer hover:text-th-tx2' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && <SortIcon col={col.key} sortCol={sortCol} dir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(ch => {
                const pal = CHANNEL_PALETTE[ch.paletteIdx];
                return (
                  <tr key={ch.channelId} className="border-b border-th-border/60 hover:bg-th-surface/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${pal.bar}`} />
                        <span className="text-th-tx1 text-xs font-medium truncate max-w-[140px]">{ch.name}</span>
                        {ch.isPrimary && (
                          <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full shrink-0">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{fmt(ch.subscriberCount)}</td>
                    <td className="px-4 py-3 text-th-tx3 text-xs">{channelAge(ch.channelCreatedAt)}</td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ch.episodeCount}</td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ch.ppm || '—'}</td>
                    <td className={`px-4 py-3 text-xs tabular-nums font-medium ${pal.text}`}>{fmt(ch.avgViews)}</td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ch.viewsPerSub ? ch.viewsPerSub.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{pct(ch.engagementRate)}</td>
                    <td className="px-4 py-3">
                      {ch.topFormat ? (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${DIM_COLORS[ch.topFormat] || 'bg-th-raised text-th-tx2 border-th-border'}`}>
                          {DIM_LABELS.format[ch.topFormat] || ch.topFormat}
                        </span>
                      ) : <span className="text-th-tx4 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {ch.topHook ? (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${DIM_COLORS[ch.topHook] || 'bg-th-raised text-th-tx2 border-th-border'}`}>
                          {DIM_LABELS.hookType[ch.topHook] || ch.topHook}
                        </span>
                      ) : <span className="text-th-tx4 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── AI analysis ── */}
        {insightError && (
          <div className="px-6 py-6">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{insightError}</p>
            </div>
          </div>
        )}

        {/* Progress bar while generating */}
        {generating && progress && (
          <div className="px-6 py-6 border-t border-th-border">
            <div className="bg-th-surface border border-th-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-th-tx1 text-sm font-medium flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-th-accent" />
                  {progress.analysing ? 'Analysing…' : 'Preparing transcripts…'}
                </span>
                {!progress.analysing && (
                  <span className="text-th-tx3 text-xs tabular-nums">{progress.done}/{progress.total}</span>
                )}
              </div>
              {!progress.analysing && (
                <div className="h-1.5 bg-th-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-th-accent rounded-full transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
              )}
              <p className="text-th-tx4 text-xs truncate">{progress.message}</p>
              {streamText && (
                <div className="mt-2 pt-3 border-t border-th-border">
                  <p className="text-th-tx4 text-[11px] mb-1 uppercase tracking-wider">Analysis incoming…</p>
                  <p className="text-th-tx3 text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-32 overflow-hidden">{streamText.slice(-400)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {insights && (
          <div className="px-6 pb-10 border-t border-th-border pt-8">
            <h2 className="text-th-tx1 font-semibold text-base mb-1">Why the outliers won</h2>
            <p className="text-th-tx3 text-xs mb-6">
              Based on the top 5 videos per channel — transcribed and analysed for patterns in hooks, titles, topics, and format.
            </p>
            <OutlierPanel insights={insights} />
          </div>
        )}
      </div>
    </div>
  );
}
