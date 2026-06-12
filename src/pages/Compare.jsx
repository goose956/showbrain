import { useState, useMemo, useEffect } from 'react';
import {
  GitCompare, Sparkles, Loader2, AlertCircle, ChevronUp, ChevronDown,
  ChevronsUpDown, TrendingUp, Zap, Target, Plus, X,
} from 'lucide-react';
import { generateCrossChannelInsights, fetchSavedInsights, persistInsights } from '../lib/claude';
import { apiFetch } from '../lib/api';

// ── constants ─────────────────────────────────────────────────────────────────

const DIM_COLORS = {
  solo: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  interview: 'bg-th-accent/10 text-th-accent border-th-accent/20',
  'co-hosted': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'bold-claim': 'bg-red-500/10 text-red-300 border-red-500/20',
  'personal-story': 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  'controversial-question': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'surprising-statistic': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'cold-open': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  'direct-challenge': 'bg-red-500/10 text-red-300 border-red-500/20',
  tactical: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  opinion: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  energetic: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  educational: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const CHANNEL_PALETTE = [
  { bar: 'bg-th-accent', text: 'text-th-accent', light: 'bg-th-accent/10 border-th-accent/25 text-th-accent' },
  { bar: 'bg-sky-500',    text: 'text-sky-300',    light: 'bg-sky-500/15 border-sky-500/25 text-sky-300' },
  { bar: 'bg-emerald-500',text: 'text-emerald-300',light: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300' },
  { bar: 'bg-amber-500',  text: 'text-amber-300',  light: 'bg-amber-500/15 border-amber-500/25 text-amber-300' },
  { bar: 'bg-pink-500',   text: 'text-pink-300',   light: 'bg-pink-500/15 border-pink-500/25 text-pink-300' },
];

const DIM_LABELS = {
  format:       { solo: 'Solo', interview: 'Interview', 'co-hosted': 'Co-hosted', panel: 'Panel', narrative: 'Narrative', qa: 'Q&A' },
  hookType:     { 'bold-claim': 'Bold Claim', 'personal-story': 'Personal Story', 'controversial-question': 'Controversial Q', 'surprising-statistic': 'Stat', 'cold-open': 'Cold Open', 'direct-challenge': 'Direct Challenge' },
  contentType:  { tactical: 'Tactical', opinion: 'Opinion', 'case-study': 'Case Study', 'personal-story': 'Story', 'trend-analysis': 'Trend', 'industry-news': 'Industry', 'myth-busting': 'Myth Bust' },
  emotionalTone:{ energetic: 'Energetic', reflective: 'Reflective', confrontational: 'Confrontational', vulnerable: 'Vulnerable', educational: 'Educational' },
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

function viewsPerSub(totalViewCount, subscriberCount) {
  if (!subscriberCount || !totalViewCount) return '—';
  return (totalViewCount / subscriberCount).toFixed(1);
}

function pct(n) {
  if (!n) return '—';
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

function postsPerMonth(episodes) {
  if (episodes.length < 2) return null;
  const dates = episodes.map(e => new Date(e.publishedAt)).filter(d => !isNaN(d)).sort((a, b) => a - b);
  if (dates.length < 2) return null;
  const months = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 30.4);
  if (months < 0.5) return null;
  return (episodes.length / months).toFixed(1);
}

// Build per-channel stats for the table + Claude
function buildChannelStats(episodes, channels = []) {
  const byChannel = {};
  for (const ep of episodes) {
    if (!ep.channelId) continue;
    if (!byChannel[ep.channelId]) byChannel[ep.channelId] = { name: ep.channelName || ep.channelId, episodes: [] };
    byChannel[ep.channelId].episodes.push(ep);
  }

  return Object.entries(byChannel).map(([channelId, { name, episodes: eps }], idx) => {
    const meta = channels.find(c => c.id === channelId) || {};
    const withViews = eps.filter(e => e.viewCount > 0);
    const avgViews = avg(withViews.map(e => e.viewCount));
    const avgLikes = avg(withViews.map(e => e.likeCount || 0));
    const avgComments = avg(withViews.map(e => e.commentCount || 0));
    const engagementRate = avgViews > 0 ? (avgLikes + avgComments) / avgViews : 0;

    // Growth: compare avg views of most recent 10 vs previous 10
    const sorted = [...eps].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const recent = sorted.slice(0, 10).filter(e => e.viewCount > 0);
    const older = sorted.slice(10, 20).filter(e => e.viewCount > 0);
    const recentAvg = recent.length ? avg(recent.map(e => e.viewCount)) : null;
    const olderAvg = older.length ? avg(older.map(e => e.viewCount)) : null;
    const growthPct = recentAvg && olderAvg ? ((recentAvg - olderAvg) / olderAvg) * 100 : null;

    return {
      channelId,
      name,
      paletteIdx: idx % CHANNEL_PALETTE.length,
      episodeCount: eps.length,
      analysedCount: eps.filter(e => e.dimensions).length,
      subscriberCount: meta.subscriberCount || 0,
      totalViewCount: meta.totalViewCount || 0,
      channelCreatedAt: meta.channelCreatedAt || null,
      avgViews,
      avgLikes,
      avgComments,
      engagementRate,
      viewsPerSub: meta.subscriberCount > 0 ? avgViews / meta.subscriberCount : null,
      growthPct,
      recentAvg,
      ppm: postsPerMonth(eps),
      topFormat: topValue(eps, 'format'),
      topHook: topValue(eps, 'hookType'),
      topContent: topValue(eps, 'contentType'),
      topTone: topValue(eps, 'emotionalTone'),
      episodes: eps,
    };
  });
}

// ── sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sortCol, dir }) {
  if (col !== sortCol) return <ChevronsUpDown size={11} className="text-th-tx4" />;
  return dir === 'asc' ? <ChevronUp size={11} className="text-th-accent" /> : <ChevronDown size={11} className="text-th-accent" />;
}

// ── dimension comparison chart ────────────────────────────────────────────────

function DimCompare({ title, dimKey, channelStats }) {
  // Collect all values across all channels
  const allValues = [...new Set(
    channelStats.flatMap(ch => ch.episodes.map(e => e.dimensions?.[dimKey]).filter(Boolean))
  )];
  if (!allValues.length) return null;

  // For each value, avg views per channel
  const rows = allValues.map(val => {
    const perChannel = channelStats.map(ch => {
      const eps = ch.episodes.filter(e => e.dimensions?.[dimKey] === val && e.viewCount > 0);
      return { channelId: ch.channelId, name: ch.name, paletteIdx: ch.paletteIdx, avgViews: avg(eps.map(e => e.viewCount)), count: eps.length };
    }).filter(c => c.count > 0);
    const maxViews = Math.max(...perChannel.map(c => c.avgViews), 1);
    return { val, perChannel, maxViews };
  }).sort((a, b) => Math.max(...b.perChannel.map(c => c.avgViews)) - Math.max(...a.perChannel.map(c => c.avgViews)));

  const label = (v) => DIM_LABELS[dimKey]?.[v] || v;
  const chipColor = DIM_COLORS[rows[0]?.val] || 'bg-th-raised text-th-tx2 border-th-border';

  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-5">
      <p className="text-th-tx1 text-sm font-semibold mb-4">{title}</p>
      <div className="space-y-4">
        {rows.slice(0, 6).map(({ val, perChannel, maxViews }) => (
          <div key={val}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${DIM_COLORS[val] || 'bg-th-raised text-th-tx2 border-th-border'}`}>
                {label(val)}
              </span>
            </div>
            <div className="space-y-1">
              {perChannel.map(ch => {
                const pal = CHANNEL_PALETTE[ch.paletteIdx];
                const w = maxViews > 0 ? (ch.avgViews / maxViews) * 100 : 0;
                return (
                  <div key={ch.channelId} className="flex items-center gap-2">
                    <span className="text-th-tx4 text-[11px] w-24 truncate shrink-0">{ch.name}</span>
                    <div className="flex-1 h-1.5 bg-th-raised rounded-full overflow-hidden">
                      <div className={`h-full ${pal.bar} rounded-full transition-all`} style={{ width: `${w}%` }} />
                    </div>
                    <span className={`text-[11px] tabular-nums w-10 text-right ${pal.text}`}>{fmt(ch.avgViews)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI insights display ───────────────────────────────────────────────────────

function InsightsPanel({ insights }) {
  return (
    <div className="space-y-6">
      {/* Niche patterns */}
      <div>
        <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-th-accent" /> Niche Patterns
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.nichePatterns?.map((p, i) => (
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

      {/* Top channel edge */}
      {insights.topChannelEdge && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <h3 className="text-amber-300 text-sm font-semibold mb-2 flex items-center gap-2">
            <Zap size={13} /> What sets {insights.topChannelEdge.channelName} apart
          </h3>
          <p className="text-amber-200/80 text-sm leading-relaxed">{insights.topChannelEdge.whatSetsItApart}</p>
        </div>
      )}

      {/* Gaps */}
      {insights.gaps?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <Target size={14} className="text-emerald-400" /> Gaps & Opportunities
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

      {/* New channel playbook */}
      {insights.newChannelPlaybook?.length > 0 && (
        <div>
          <h3 className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-th-accent" /> New Channel Playbook
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
      const res = await apiFetch('/api/channels', {
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
    <form onSubmit={handleAdd} className="flex items-center gap-2">
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
        {adding ? 'Adding…' : 'Add'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-th-tx4 hover:text-th-tx2 transition-colors">
          <X size={14} />
        </button>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { key: 'name',            label: 'Channel',      sortable: true },
  { key: 'subscriberCount', label: 'Subscribers',  sortable: true },
  { key: 'channelCreatedAt',label: 'Age',          sortable: true },
  { key: 'episodeCount',    label: 'Episodes',     sortable: true },
  { key: 'avgViews',        label: 'Avg Views',    sortable: true },
  { key: 'viewsPerSub',     label: 'Views/Sub',    sortable: true },
  { key: 'growthPct',       label: 'Trend',        sortable: true },
  { key: 'engagementRate',  label: 'Engagement',   sortable: true },
  { key: 'ppm',             label: 'Posts/Mo',     sortable: true },
  { key: 'topFormat',       label: 'Top Format',   sortable: false },
  { key: 'topHook',         label: 'Top Hook',     sortable: false },
  { key: 'topContent',      label: 'Top Content',  sortable: false },
];

export default function Compare({ episodes, channels = [], onChannelsLoaded }) {
  const [sortCol, setSortCol] = useState('avgViews');
  const [sortDir, setSortDir] = useState('desc');
  const [insights, setInsights] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchSavedInsights('compareInsights').then(saved => { if (saved) setInsights(saved); }).catch(() => {});
  }, []);

  const channelStats = useMemo(() => buildChannelStats(episodes, channels), [episodes, channels]);

  const handleChannelAdded = (channel) => {
    setShowAddForm(false);
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
      // Build lightweight stats payload for Claude
      const payload = channelStats.map(ch => ({
        name: ch.name,
        episodeCount: ch.episodeCount,
        analysedCount: ch.analysedCount,
        avgViews: Math.round(ch.avgViews),
        avgLikes: Math.round(ch.avgLikes),
        avgComments: Math.round(ch.avgComments),
        engagementRate: parseFloat((ch.engagementRate * 100).toFixed(2)),
        postsPerMonth: ch.ppm,
        topFormat: ch.topFormat,
        topHook: ch.topHook,
        topContent: ch.topContent,
        topTone: ch.topTone,
        // Top 3 episodes by views
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
          Add your channel plus competitors or channels in your niche.
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

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="border-b border-th-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg flex items-center gap-2">
              <GitCompare size={17} className="text-th-accent" />
              Channel Comparison
            </h1>
            <p className="text-th-tx3 text-xs mt-0.5">
              {totalChannels} channels · {totalEpisodes} episodes · {analysedEpisodes} analysed
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || analysedEpisodes < 3}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accent disabled:opacity-40 disabled:cursor-not-allowed text-th-tx1 text-sm transition-colors"
          >
            {generating
              ? <><Loader2 size={14} className="animate-spin" />Analysing…</>
              : <><Sparkles size={14} />{insights ? 'Regenerate' : 'AI Analysis'}</>}
          </button>
        </div>

        {/* Channel legend + add */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {channelStats.map(ch => {
            const pal = CHANNEL_PALETTE[ch.paletteIdx];
            return (
              <span key={ch.channelId} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${pal.light}`}>
                <span className={`w-2 h-2 rounded-full ${pal.bar}`} />
                {ch.name}
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
        {/* Metrics table */}
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
              {sorted.map((ch, rowIdx) => {
                const pal = CHANNEL_PALETTE[ch.paletteIdx];
                const isTop = rowIdx === 0 && sortCol === 'avgViews';
                return (
                  <tr key={ch.channelId} className={`border-b border-th-border/60 transition-colors ${isTop ? 'bg-th-accent/5' : 'hover:bg-th-surface/40'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${pal.bar}`} />
                        <span className="text-th-tx1 text-xs font-medium truncate max-w-[160px]">{ch.name}</span>
                        {isTop && <span className="text-[10px] text-th-accent bg-th-accent/10 border border-th-accent/20 px-1.5 py-0.5 rounded-full">Top</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{fmt(ch.subscriberCount)}</td>
                    <td className="px-4 py-3 text-th-tx3 text-xs">{channelAge(ch.channelCreatedAt)}</td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ch.episodeCount}</td>
                    <td className={`px-4 py-3 text-xs tabular-nums font-medium ${pal.text}`}>{fmt(ch.avgViews)}</td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ch.viewsPerSub ? ch.viewsPerSub.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {ch.growthPct !== null ? (
                        <span className={ch.growthPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {ch.growthPct >= 0 ? '+' : ''}{ch.growthPct.toFixed(0)}%
                        </span>
                      ) : <span className="text-th-tx4">—</span>}
                    </td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{pct(ch.engagementRate)}</td>
                    <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ch.ppm || '—'}</td>
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
                    <td className="px-4 py-3">
                      {ch.topContent ? (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${DIM_COLORS[ch.topContent] || 'bg-th-raised text-th-tx2 border-th-border'}`}>
                          {DIM_LABELS.contentType[ch.topContent] || ch.topContent}
                        </span>
                      ) : <span className="text-th-tx4 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dimension comparison charts */}
        {analysedEpisodes >= 2 && (
          <div className="px-6 py-8 border-t border-th-border">
            <h2 className="text-th-tx1 font-semibold text-base mb-1">Performance by Dimension</h2>
            <p className="text-th-tx3 text-xs mb-6">Average views for each dimension value, broken down by channel.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DimCompare title="Format" dimKey="format" channelStats={channelStats} />
              <DimCompare title="Hook Type" dimKey="hookType" channelStats={channelStats} />
              <DimCompare title="Content Type" dimKey="contentType" channelStats={channelStats} />
              <DimCompare title="Emotional Tone" dimKey="emotionalTone" channelStats={channelStats} />
            </div>
          </div>
        )}

        {/* AI analysis */}
        {insightError && (
          <div className="px-6 pb-6">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{insightError}</p>
            </div>
          </div>
        )}

        {insights && (
          <div className="px-6 pb-10 border-t border-th-border pt-8">
            <h2 className="text-th-tx1 font-semibold text-base mb-1">AI Cross-Channel Analysis</h2>
            <p className="text-th-tx3 text-xs mb-6">Patterns, gaps, and a playbook for entering or winning in this niche.</p>
            <InsightsPanel insights={insights} />
          </div>
        )}

        {analysedEpisodes < 3 && (
          <div className="px-6 py-8 border-t border-th-border">
            <div className="flex items-start gap-3 text-th-tx3 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-500" />
              Analyse at least 3 episodes across your channels (on the Intelligence page) to unlock the AI cross-channel analysis.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
