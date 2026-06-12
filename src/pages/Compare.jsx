import { useState, useMemo, useEffect } from 'react';
import {
  GitCompare, Sparkles, Loader2, AlertCircle, ChevronUp, ChevronDown,
  ChevronsUpDown, TrendingUp, Zap, Target, Plus, X, Trophy, Users,
  BarChart2, ArrowUpRight, BookOpen,
} from 'lucide-react';
import { generateCrossChannelInsights, fetchSavedInsights, persistInsights } from '../lib/claude';
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

// ── AI insights display ───────────────────────────────────────────────────────

function InsightsPanel({ insights }) {
  return (
    <div className="space-y-6">
      {insights.nichePatterns?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-th-accent" /> What's working in this niche
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.nichePatterns.map((p, i) => (
              <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${p.strength === 'strong' ? 'bg-th-accent/10 text-th-accent border-th-accent/25' : 'bg-th-raised text-th-tx2 border-th-border'}`}>
                    {p.strength}
                  </span>
                  <p className="text-th-tx1 text-xs font-medium">{p.title}</p>
                </div>
                <p className="text-th-tx2 text-xs leading-relaxed">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.topChannelEdge && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <h3 className="text-amber-300 text-sm font-semibold mb-2 flex items-center gap-2">
            <Zap size={13} /> Why {insights.topChannelEdge.channelName} is winning
          </h3>
          <p className="text-amber-200/80 text-sm leading-relaxed">{insights.topChannelEdge.whatSetsItApart}</p>
        </div>
      )}

      {insights.gaps?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <Target size={14} className="text-emerald-400" /> Gaps nobody is owning
          </h3>
          <div className="space-y-3">
            {insights.gaps.map((g, i) => (
              <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-emerald-300 text-xs font-medium mb-1">{g.gap}</p>
                <p className="text-emerald-200/70 text-xs leading-relaxed">{g.opportunity}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.newChannelPlaybook?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <BookOpen size={14} className="text-th-accent" /> What to steal for your channel
          </h3>
          <div className="bg-th-surface border border-th-border rounded-xl divide-y divide-th-border">
            {insights.newChannelPlaybook.map((action, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="w-5 h-5 rounded-full bg-th-accent/20 border border-violet-500/30 text-th-accent text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
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

// ── per-channel growth chart ──────────────────────────────────────────────────

const CHART_COLORS = ['#8b5cf6', '#38bdf8', '#34d399', '#fbbf24', '#f472b6'];

function ChannelGrowthChart({ ch }) {
  const W = 320, H = 120, PAD = { top: 8, right: 12, bottom: 28, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const color = CHART_COLORS[ch.paletteIdx] || CHART_COLORS[0];

  const launchMs = ch.channelCreatedAt ? new Date(ch.channelCreatedAt).getTime() : null;

  const pts = [...ch.episodes]
    .filter(e => e.publishedAt && e.viewCount > 0)
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

  if (pts.length < 3) return (
    <div className="flex items-center justify-center h-20 text-th-tx4 text-xs">Not enough data</div>
  );

  // Rolling 5-ep average, X = months since channel launch (or since first video)
  const firstMs = launchMs || new Date(pts[0].publishedAt).getTime();
  const smoothed = pts.map((p, i) => {
    const win = pts.slice(Math.max(0, i - 2), i + 3);
    const avgV = win.reduce((s, w) => s + w.viewCount, 0) / win.length;
    const monthsSinceLaunch = (new Date(p.publishedAt).getTime() - firstMs) / (1000 * 60 * 60 * 24 * 30.4);
    return { months: Math.max(0, monthsSinceLaunch), views: avgV };
  });

  const maxMonths = smoothed[smoothed.length - 1].months || 1;
  const maxViews = Math.max(...smoothed.map(p => p.views));

  const x = (m) => (m / maxMonths) * innerW;
  const y = (v) => innerH - (v / maxViews) * innerH;

  function fmtV(n) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return Math.round(n);
  }

  const yTicks = [0, 0.5, 1].map(t => ({ v: maxViews * t, y: innerH - t * innerH }));
  const xTicks = [0, 0.5, 1].map(t => ({ m: maxMonths * t, x: (maxMonths * t / maxMonths) * innerW }));

  const d = smoothed.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.months).toFixed(1)},${y(p.views).toFixed(1)}`).join(' ');

  // Area fill path
  const area = `${d} L${x(smoothed[smoothed.length - 1].months).toFixed(1)},${innerH} L${x(0)},${innerH} Z`;

  const gradId = `grad-${ch.channelId.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={0} y1={t.y} x2={innerW} y2={t.y} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
            <text x={-6} y={t.y + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.35}>{fmtV(t.v)}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={innerH + 16} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.35}>
            {Math.round(t.m)}mo
          </text>
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function GrowthChartGrid({ channelStats }) {
  const eligible = channelStats.filter(ch =>
    ch.episodes.filter(e => e.viewCount > 0 && e.publishedAt).length >= 3
  );
  if (!eligible.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {eligible.map(ch => {
        const pal = CHANNEL_PALETTE[ch.paletteIdx];
        const growthLabel = ch.growthPct !== null
          ? `${ch.growthPct >= 0 ? '+' : ''}${ch.growthPct.toFixed(0)}% momentum`
          : null;
        return (
          <div key={ch.channelId} className="bg-th-surface border border-th-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${pal.bar}`} />
                <span className="text-th-tx1 text-xs font-medium truncate">{ch.name}</span>
                {ch.isPrimary && (
                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full shrink-0">You</span>
                )}
              </div>
              {growthLabel && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ch.growthPct >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                  {growthLabel}
                </span>
              )}
            </div>
            <ChannelGrowthChart ch={ch} />
            <p className="text-th-tx4 text-[10px] mt-1">Months since launch · rolling avg views</p>
          </div>
        );
      })}
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
    try {
      const payload = channelStats.map(ch => ({
        name: ch.name,
        subscriberCount: ch.subscriberCount,
        channelAgeYears: ch.channelCreatedAt
          ? parseFloat(((Date.now() - new Date(ch.channelCreatedAt)) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1))
          : null,
        episodeCount: ch.episodeCount,
        analysedCount: ch.analysedCount,
        avgViews: Math.round(ch.avgViews),
        viewsPerSubscriber: ch.viewsPerSub ? parseFloat(ch.viewsPerSub.toFixed(3)) : null,
        growthPct: ch.growthPct ? parseFloat(ch.growthPct.toFixed(1)) : null,
        engagementRate: parseFloat((ch.engagementRate * 100).toFixed(2)),
        postsPerMonth: ch.ppm,
        topFormat: ch.topFormat,
        topHook: ch.topHook,
        topContent: ch.topContent,
        topTone: ch.topTone,
        topEpisodes: [...ch.episodes]
          .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
          .slice(0, 3)
          .map(e => ({ title: e.title, views: e.viewCount, hookType: e.dimensions?.hookType, format: e.dimensions?.format })),
      }));
      const result = await generateCrossChannelInsights(payload);
      setInsights(result);
      persistInsights('compareInsights', result).catch(() => {});
    } catch (e) {
      setInsightError(e.message);
    } finally {
      setGenerating(false);
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
            disabled={generating || analysedEpisodes < 3}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-sm transition-colors"
          >
            {generating
              ? <><Loader2 size={14} className="animate-spin" />Analysing…</>
              : <><Sparkles size={14} />{insights ? 'Regenerate' : 'What can I steal?'}</>}
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

        {/* ── Growth charts ── */}
        {channelStats.some(ch => ch.episodes.filter(e => e.viewCount > 0 && e.publishedAt).length >= 3) && (
          <div className="px-6 pt-6 pb-2">
            <p className="text-th-tx3 text-xs font-medium uppercase tracking-wider mb-3">Growth trajectory</p>
            <GrowthChartGrid channelStats={channelStats} />
          </div>
        )}

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

        {insights && (
          <div className="px-6 pb-10 border-t border-th-border pt-8">
            <h2 className="text-th-tx1 font-semibold text-base mb-1">What to steal from this niche</h2>
            <p className="text-th-tx3 text-xs mb-6">AI analysis of patterns, gaps, and actionable lessons based on {analysedEpisodes} analysed episodes.</p>
            <InsightsPanel insights={insights} />
          </div>
        )}

        {analysedEpisodes < 3 && (
          <div className="px-6 py-8 border-t border-th-border">
            <div className="flex items-start gap-3 text-th-tx3 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-500" />
              Analyse at least 3 episodes across your channels on the Intelligence tab to unlock AI niche analysis.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
