import { useState } from 'react';
import { Loader2, Sparkles, ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle, CheckCircle2, XCircle, TrendingUp, Zap } from 'lucide-react';
import { analyzeEpisodeDimensions, generateChannelInsights, fetchSavedInsights, persistInsights } from '../lib/claude';

// ─── label maps ────────────────────────────────────────────────────────────────

const LABELS = {
  format: { solo: 'Solo', interview: 'Interview', 'co-hosted': 'Co-hosted', panel: 'Panel', narrative: 'Narrative', qa: 'Q&A' },
  hookType: { 'bold-claim': 'Bold Claim', 'personal-story': 'Personal Story', 'controversial-question': 'Controversial Q', 'surprising-statistic': 'Surprising Stat', 'cold-open': 'Cold Open', 'direct-challenge': 'Direct Challenge' },
  contentType: { tactical: 'Tactical', opinion: 'Opinion', 'case-study': 'Case Study', 'personal-story': 'Personal Story', 'trend-analysis': 'Trend Analysis', 'industry-news': 'Industry News', 'myth-busting': 'Myth Busting' },
  emotionalTone: { energetic: 'Energetic', reflective: 'Reflective', confrontational: 'Confrontational', vulnerable: 'Vulnerable', educational: 'Educational' },
  guestType: { 'new-guest': 'New Guest', 'return-guest': 'Return Guest', solo: 'Solo', 'co-host': 'Co-host' },
};

const DIM_COLORS = {
  // formats
  solo: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  interview: 'bg-th-accent/10 text-th-accent border-th-accent/20',
  'co-hosted': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  panel: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  narrative: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  qa: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  // hooks
  'bold-claim': 'bg-red-500/10 text-red-300 border-red-500/20',
  'personal-story': 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  'controversial-question': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'surprising-statistic': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'cold-open': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  'direct-challenge': 'bg-red-500/10 text-red-300 border-red-500/20',
  // tones
  energetic: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  reflective: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  confrontational: 'bg-red-500/10 text-red-300 border-red-500/20',
  vulnerable: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  educational: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const chip = (val) => {
  const color = DIM_COLORS[val] || 'bg-th-border/40 text-th-tx2 border-th-border/30';
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {val}
    </span>
  );
};

// ─── helpers ───────────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function formatNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
}

// Given a dimension key, group episodes and return sorted performance rows
function buildInsight(episodes, dimKey, metric) {
  const groups = {};
  for (const ep of episodes) {
    const val = ep.dimensions?.[dimKey];
    if (!val) continue;
    if (!groups[val]) groups[val] = [];
    groups[val].push(metric === 'completionRate' ? ep.completionRate : ep[metric]);
  }
  const rows = Object.entries(groups).map(([val, vals]) => ({ val, avg: avg(vals), count: vals.length }));
  rows.sort((a, b) => b.avg - a.avg);
  const max = rows[0]?.avg || 1;
  return { rows, max };
}

// ─── sub-components ────────────────────────────────────────────────────────────

function InsightChart({ title, dimKey, episodes, metric, formatValue }) {
  const { rows, max } = buildInsight(episodes, dimKey, metric);
  if (!rows.length) return null;
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-5">
      <p className="text-th-tx1 text-sm font-semibold mb-4">{title}</p>
      <div className="space-y-3">
        {rows.map(({ val, avg: a, count }) => (
          <div key={val}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {chip(val)}
                <span className="text-th-tx3 text-[11px]">×{count}</span>
              </div>
              <span className="text-th-tx1 text-xs font-medium">{formatValue(a)}</span>
            </div>
            <div className="h-1.5 bg-th-raised rounded-full overflow-hidden">
              <div
                className="h-full bg-th-accent rounded-full transition-all"
                style={{ width: `${(a / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (col !== sortCol) return <ChevronsUpDown size={12} className="text-th-tx4" />;
  return sortDir === 'asc' ? <ChevronUp size={12} className="text-th-accent" /> : <ChevronDown size={12} className="text-th-accent" />;
}

// ─── main ──────────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'title', label: 'Episode', sortable: true },
  { key: 'format', label: 'Format', sortable: true, dim: true },
  { key: 'hookType', label: 'Hook', sortable: true, dim: true },
  { key: 'contentType', label: 'Content', sortable: true, dim: true },
  { key: 'emotionalTone', label: 'Tone', sortable: true, dim: true },
  { key: 'topicCluster', label: 'Cluster', sortable: true, dim: true },
  { key: 'viewCount', label: 'Views', sortable: true },
  { key: 'likeCount', label: 'Likes', sortable: true },
  { key: 'commentCount', label: 'Comments', sortable: true },
  { key: 'titleLengthOk', label: 'Title ≤60', sortable: false },
  { key: '_actions', label: '', sortable: false },
];

const FILTER_DIMS = ['format', 'hookType', 'contentType', 'emotionalTone'];

const PAGE_SIZE = 20;

export default function Intelligence({ episodes, onEpisodesUpdate }) {
  const [sortCol, setSortCol] = useState('viewCount');
  const [sortDir, setSortDir] = useState('desc');
  const [filters, setFilters] = useState({});
  const [analysing, setAnalysing] = useState({});
  const [metric, setMetric] = useState('viewCount');
  const [insights, setInsights] = useState(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedChannel, setSelectedChannel] = useState('all');

  useEffect(() => {
    fetchSavedInsights('channelInsights').then(saved => { if (saved) setInsights(saved); }).catch(() => {});
  }, []);

  // Derive unique channels from episodes
  const channels = Array.from(
    new Map(episodes.map(e => [e.channelId, { id: e.channelId, name: e.channelName || e.channelId }])).values()
  );

  // Channel-filtered episodes (everything else is derived from this)
  const channelEpisodes = selectedChannel === 'all'
    ? episodes
    : episodes.filter(e => e.channelId === selectedChannel);

  const handleChannelChange = (id) => {
    setSelectedChannel(id);
    setPage(1);
    setFilters({});
    setInsights(null);
  };

  const handleGenerateInsights = async () => {
    setGeneratingInsights(true);
    setInsights(null);
    try {
      const result = await generateChannelInsights(episodesWithDims);
      setInsights(result);
      persistInsights('channelInsights', result).catch(() => {});
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const handleSort = (col) => {
    setPage(1);
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const toggleFilter = (dim, val) => {
    setPage(1);
    setFilters((prev) => {
      const current = prev[dim] || [];
      const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
      return { ...prev, [dim]: next };
    });
  };

  const clearFilters = () => { setFilters({}); setPage(1); };

  const handleAnalyse = async (ep) => {
    setAnalysing((a) => ({ ...a, [ep.id]: true }));
    try {
      const dims = await analyzeEpisodeDimensions(ep);
      const updated = episodes.map((e) => e.id === ep.id ? { ...e, dimensions: dims } : e);
      onEpisodesUpdate(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setAnalysing((a) => ({ ...a, [ep.id]: false }));
    }
  };

  // filter
  let visible = channelEpisodes.filter((ep) => {
    for (const [dim, vals] of Object.entries(filters)) {
      if (!vals.length) continue;
      const epVal = ep.dimensions?.[dim];
      if (!vals.includes(epVal)) return false;
    }
    return true;
  });

  // sort
  visible = [...visible].sort((a, b) => {
    let aVal, bVal;
    if (COLUMNS.find((c) => c.key === sortCol)?.dim) {
      aVal = a.dimensions?.[sortCol] || '';
      bVal = b.dimensions?.[sortCol] || '';
    } else {
      aVal = a[sortCol] ?? '';
      bVal = b[sortCol] ?? '';
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // unique values for filter dropdowns
  const filterOptions = {};
  FILTER_DIMS.forEach((dim) => {
    const vals = [...new Set(channelEpisodes.map((ep) => ep.dimensions?.[dim]).filter(Boolean))];
    filterOptions[dim] = vals;
  });

  const hasFilters = Object.values(filters).some((v) => v.length > 0);
  const episodesWithDims = channelEpisodes.filter((ep) => ep.dimensions);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-th-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg">Episode Intelligence</h1>
            <p className="text-th-tx3 text-xs mt-0.5">
              Claude extracts every dimension from transcript — no manual tagging.
              {episodesWithDims.length < channelEpisodes.length && (
                <span className="text-amber-400 ml-2">{channelEpisodes.length - episodesWithDims.length} not yet analysed.</span>
              )}
            </p>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-th-tx3 hover:text-th-tx1 transition-colors">
              Clear filters
            </button>
          )}
        </div>

        {/* Channel selector */}
        {channels.length > 1 && (
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            <button
              onClick={() => handleChannelChange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selectedChannel === 'all'
                  ? 'bg-th-border text-th-tx1 border-th-border'
                  : 'text-th-tx3 border-th-border hover:text-th-tx1 hover:border-th-border'
              }`}
            >
              All channels
              <span className="ml-1.5 text-th-tx3 font-normal">{episodes.length}</span>
            </button>
            {channels.map(ch => {
              const count = episodes.filter(e => e.channelId === ch.id).length;
              const isActive = selectedChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleChannelChange(ch.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isActive
                      ? 'bg-th-accent text-th-tx1 border-violet-500'
                      : 'text-th-tx3 border-th-border hover:text-th-tx1 hover:border-th-border'
                  }`}
                >
                  {ch.name}
                  <span className={`ml-1.5 font-normal ${isActive ? 'text-th-accent' : 'text-th-tx4'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}


        {/* Filter row */}
        <div className="flex flex-wrap gap-2 mt-3">
          {FILTER_DIMS.map((dim) => (
            <div key={dim} className="flex items-center gap-1.5 flex-wrap">
              {filterOptions[dim].map((val) => {
                const active = (filters[dim] || []).includes(val);
                return (
                  <button
                    key={val}
                    onClick={() => toggleFilter(dim, val)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                      active
                        ? (DIM_COLORS[val] || 'bg-th-accent/20 text-th-accent border-violet-500/40') + ' opacity-100'
                        : 'bg-th-surface text-th-tx3 border-th-border hover:text-th-tx2 hover:border-th-border'
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
              {filterOptions[dim].length > 0 && <span className="text-th-tx4 text-xs">·</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Episode matrix table */}
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-th-bg z-10">
            <tr className="border-b border-th-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`text-left px-4 py-3 text-xs font-medium text-th-tx3 whitespace-nowrap select-none ${
                    col.sortable ? 'cursor-pointer hover:text-th-tx2' : ''
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center text-th-tx4 text-sm py-16">
                  No episodes match the current filters.
                </td>
              </tr>
            )}
            {pageSlice.map((ep) => {
              const d = ep.dimensions;
              const isAnalysing = analysing[ep.id];
              return (
                <tr key={ep.id} className="border-b border-th-border/60 hover:bg-th-surface/40 transition-colors">
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="text-th-tx1 text-xs font-medium truncate">{ep.title}</p>
                    <p className="text-th-tx4 text-[11px]">{ep.publishedAt}</p>
                  </td>
                  <td className="px-4 py-3">{d ? chip(d.format) : <span className="text-th-tx4 text-xs">—</span>}</td>
                  <td className="px-4 py-3">{d ? chip(d.hookType) : <span className="text-th-tx4 text-xs">—</span>}</td>
                  <td className="px-4 py-3">{d ? chip(d.contentType) : <span className="text-th-tx4 text-xs">—</span>}</td>
                  <td className="px-4 py-3">{d ? chip(d.emotionalTone) : <span className="text-th-tx4 text-xs">—</span>}</td>
                  <td className="px-4 py-3">
                    {d ? (
                      <span className="text-th-tx2 text-xs bg-th-raised px-2 py-0.5 rounded-full border border-th-border">{d.topicCluster}</span>
                    ) : <span className="text-th-tx4 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ep.viewCount ? formatNum(ep.viewCount) : <span className="text-th-tx4">—</span>}</td>
                  <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ep.likeCount ? formatNum(ep.likeCount) : <span className="text-th-tx4">—</span>}</td>
                  <td className="px-4 py-3 text-th-tx2 text-xs tabular-nums">{ep.commentCount ? formatNum(ep.commentCount) : <span className="text-th-tx4">—</span>}</td>
                  <td className="px-4 py-3">
                    {d ? (
                      d.titleLengthOk
                        ? <CheckCircle2 size={14} className="text-emerald-400" />
                        : <XCircle size={14} className="text-red-400" />
                    ) : <span className="text-th-tx4 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!d && ep.transcriptStatus === 'no_captions' && (
                      <span className="text-[11px] text-th-tx4">No captions</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-th-border bg-th-bg">
            <p className="text-th-tx4 text-xs tabular-nums">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, visible.length)} of {visible.length} episodes
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="px-2 py-1 rounded text-xs text-th-tx3 hover:text-th-tx1 hover:bg-th-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >«</button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-2 py-1 rounded text-xs text-th-tx3 hover:text-th-tx1 hover:bg-th-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >‹</button>

              {/* Page number pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .reduce((acc, n, idx, arr) => {
                  if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-th-tx4 text-xs">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-7 h-7 rounded text-xs transition-colors ${
                        safePage === n
                          ? 'bg-th-accent text-th-tx1'
                          : 'text-th-tx3 hover:text-th-tx1 hover:bg-th-raised'
                      }`}
                    >{n}</button>
                  )
                )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-2 py-1 rounded text-xs text-th-tx3 hover:text-th-tx1 hover:bg-th-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >›</button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="px-2 py-1 rounded text-xs text-th-tx3 hover:text-th-tx1 hover:bg-th-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >»</button>
            </div>
          </div>
        )}

        {/* What works for your show */}
        {episodesWithDims.length >= 2 && (
          <div className="px-6 py-8 border-t border-th-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-th-tx1 font-semibold text-base">What works for your show</h2>
                <p className="text-th-tx3 text-xs mt-0.5">Based on your {episodesWithDims.length} analysed episodes — not industry averages.</p>
              </div>
              <div className="flex gap-1 bg-th-surface border border-th-border rounded-lg p-1">
                {[['viewCount', 'Views'], ['likeCount', 'Likes'], ['commentCount', 'Comments']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMetric(key)}
                    className={`text-xs px-3 py-1.5 rounded-md transition-colors ${metric === key ? 'bg-th-border text-th-tx1' : 'text-th-tx3 hover:text-th-tx2'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Format', dimKey: 'format' },
                { title: 'Hook Type', dimKey: 'hookType' },
                { title: 'Content Type', dimKey: 'contentType' },
                { title: 'Emotional Tone', dimKey: 'emotionalTone' },
                { title: 'Topic Cluster', dimKey: 'topicCluster' },
                { title: 'Guest Type', dimKey: 'guestType' },
              ].map(({ title, dimKey }) => (
                <InsightChart
                  key={dimKey}
                  title={title}
                  dimKey={dimKey}
                  episodes={episodesWithDims}
                  metric={metric}
                  formatValue={(v) => formatNum(v)}
                />
              ))}
            </div>
          </div>
        )}

        {episodesWithDims.length < 2 && episodesWithDims.length > 0 && (
          <div className="px-6 py-8 border-t border-th-border">
            <div className="flex items-start gap-3 text-th-tx3 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              Analyse at least 2 episodes to unlock the "What works for your show" insights.
            </div>
          </div>
        )}

        {/* AI Tactical Insights */}
        {episodesWithDims.length >= 3 && (
          <div className="px-6 py-8 border-t border-th-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-th-tx1 font-semibold text-base flex items-center gap-2">
                  <TrendingUp size={16} className="text-th-accent" />
                  Tactical Recommendations
                </h2>
                <p className="text-th-tx3 text-xs mt-0.5">
                  Claude analyses your patterns and tells you exactly what to do next.
                </p>
              </div>
              <button
                onClick={handleGenerateInsights}
                disabled={generatingInsights}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accent disabled:opacity-50 disabled:cursor-not-allowed text-th-tx1 text-sm transition-colors"
              >
                {generatingInsights
                  ? <><Loader2 size={14} className="animate-spin" />Analysing…</>
                  : <><Sparkles size={14} />Generate Insights</>}
              </button>
            </div>

            {insights && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, i) => (
                  <div key={i} className="bg-th-surface border border-th-border rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-th-tx1 text-sm font-semibold leading-snug">{insight.title}</h3>
                      <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        insight.impact === 'high'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : insight.impact === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-th-border/40 text-th-tx2 border-th-border/30'
                      }`}>
                        {insight.impact} impact
                      </span>
                    </div>
                    <p className="text-th-tx2 text-xs leading-relaxed mb-3">{insight.finding}</p>
                    <div className="flex items-start gap-2 bg-th-accent/10 border border-th-accent/20 rounded-lg p-3">
                      <Zap size={12} className="text-th-accent shrink-0 mt-0.5" />
                      <p className="text-th-accent text-xs leading-relaxed">{insight.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!insights && !generatingInsights && (
              <div className="bg-th-surface/50 border border-th-border rounded-xl p-6 text-center">
                <Sparkles size={20} className="text-th-tx4 mx-auto mb-2" />
                <p className="text-th-tx3 text-sm">Click Generate Insights to get Claude's tactical recommendations based on your {episodesWithDims.length} analysed episodes.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
