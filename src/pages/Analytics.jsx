import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { LineChart, RefreshCw, ExternalLink, MessageSquare, Briefcase, Camera, Mail, TrendingUp, MousePointerClick, Link2, AlertCircle } from 'lucide-react';

// ── constants ─────────────────────────────────────────────────────────────────

const PLATFORM_META = {
  twitter:     { label: 'Twitter / X', icon: MessageSquare, color: 'bg-sky-500',    text: 'text-sky-300',    badge: 'bg-sky-500/10 border-sky-500/20 text-sky-300' },
  linkedin:    { label: 'LinkedIn',    icon: Briefcase,     color: 'bg-blue-500',   text: 'text-blue-300',   badge: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
  instagram:   { label: 'Instagram',   icon: Camera,        color: 'bg-pink-500',   text: 'text-pink-300',   badge: 'bg-pink-500/10 border-pink-500/20 text-pink-300' },
  newsletter:  { label: 'Newsletter',  icon: Mail,          color: 'bg-amber-500',  text: 'text-amber-300',  badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
};

const RANGE_OPTIONS = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'all', label: 'All time' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function daysBefore(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function filterByRange(clicks, range) {
  if (range === 'all') return clicks;
  const n = parseInt(range);
  const cutoff = daysBefore(n);
  return clicks.filter(c => new Date(c.clickedAt) >= cutoff);
}

// Group clicks by day (YYYY-MM-DD) returning array [{date, count}] sorted ascending
function groupByDay(clicks) {
  const counts = {};
  for (const c of clicks) {
    const d = c.clickedAt?.slice(0, 10);
    if (d) counts[d] = (counts[d] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
}

// Fill gaps in date series
function fillDates(series, range) {
  if (!series.length) return [];
  const days = range === 'all' ? null : parseInt(range);
  const start = days ? daysBefore(days) : new Date(series[0].date);
  const end = new Date();
  const result = [];
  const byDate = Object.fromEntries(series.map(s => [s.date, s.count]));
  const d = new Date(start);
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: byDate[key] || 0 });
    d.setDate(d.getDate() + 1);
  }
  return result;
}

// ── mini sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#8b5cf6', height = 40 }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 200;
  const h = height;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - (d.count / max) * h * 0.85;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

// ── bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ data, colorClass }) {
  if (!data.length) return <p className="text-th-tx4 text-xs py-4">No data</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-th-tx3 text-xs w-28 truncate shrink-0">{label}</span>
          <div className="flex-1 h-1.5 bg-th-raised rounded-full overflow-hidden">
            <div
              className={`h-full ${colorClass} rounded-full transition-all`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="text-th-tx2 text-xs tabular-nums w-6 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── platform breakdown ────────────────────────────────────────────────────────

function PlatformBreakdown({ clicks }) {
  const counts = {};
  for (const c of clicks) {
    const p = c.platform || 'unknown';
    counts[p] = (counts[p] || 0) + 1;
  }
  const total = clicks.length || 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!sorted.length) return <p className="text-th-tx4 text-xs py-8 text-center">No click data yet</p>;

  return (
    <div className="space-y-3">
      {sorted.map(([platform, count]) => {
        const meta = PLATFORM_META[platform] || { label: platform, color: 'bg-th-tx3', badge: 'bg-th-raised border-th-border text-th-tx2' };
        const Icon = meta.icon;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={platform}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {Icon && <Icon size={13} className={meta.text || 'text-th-tx2'} />}
                <span className="text-th-tx2 text-xs font-medium">{meta.label || platform}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-th-tx3 text-xs tabular-nums">{pct}%</span>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.badge}`}>
                  {count} click{count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-th-raised rounded-full overflow-hidden">
              <div className={`h-full ${meta.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── top posts ─────────────────────────────────────────────────────────────────

function TopPosts({ clicks }) {
  const counts = {};
  const meta = {};
  for (const c of clicks) {
    if (!c.postId) continue;
    counts[c.postId] = (counts[c.postId] || 0) + 1;
    if (!meta[c.postId]) meta[c.postId] = { episodeTitle: c.episodeTitle, platform: c.platform, youtubeUrl: c.youtubeUrl };
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!sorted.length) return <p className="text-th-tx4 text-xs py-8 text-center">No click data yet</p>;

  return (
    <div className="divide-y divide-th-border/60">
      {sorted.map(([postId, count], i) => {
        const m = meta[postId] || {};
        const pm = PLATFORM_META[m.platform] || {};
        const Icon = pm.icon;
        return (
          <div key={postId} className="flex items-center gap-3 py-3 px-1">
            <span className="text-th-tx4 text-xs tabular-nums w-5 text-right shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-th-tx2 text-xs truncate">{m.episodeTitle || postId}</p>
              {m.platform && (
                <div className="flex items-center gap-1 mt-0.5">
                  {Icon && <Icon size={10} className={pm.text || 'text-th-tx3'} />}
                  <span className="text-th-tx4 text-[11px]">{pm.label || m.platform}</span>
                </div>
              )}
            </div>
            {m.youtubeUrl && (
              <a href={m.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-th-tx4 hover:text-th-tx2 shrink-0">
                <ExternalLink size={12} />
              </a>
            )}
            <span className="text-th-tx2 text-xs tabular-nums font-medium shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── top episodes ──────────────────────────────────────────────────────────────

function TopEpisodes({ clicks }) {
  const counts = {};
  const urls = {};
  for (const c of clicks) {
    if (!c.episodeTitle) continue;
    counts[c.episodeTitle] = (counts[c.episodeTitle] || 0) + 1;
    if (c.youtubeUrl) urls[c.episodeTitle] = c.youtubeUrl;
  }
  const data = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  return <BarChart data={data} colorClass="bg-th-accent" />;
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [clicks, setClicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');

  const fetchClicks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/clicks');
      if (!res.ok) throw new Error(await res.text());
      setClicks(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClicks(); }, []);

  const filtered = useMemo(() => filterByRange(clicks, range), [clicks, range]);
  const dailySeries = useMemo(() => fillDates(groupByDay(filtered), range), [filtered, range]);

  const totalClicks = filtered.length;
  const uniquePosts = new Set(filtered.map(c => c.postId)).size;
  const topPlatform = (() => {
    const counts = {};
    for (const c of filtered) { const p = c.platform || 'unknown'; counts[p] = (counts[p] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  })();

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="border-b border-th-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg flex items-center gap-2">
              <LineChart size={17} className="text-th-accent" />
              Analytics
            </h1>
            <p className="text-th-tx3 text-xs mt-0.5">Track which platforms are driving YouTube views</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="flex gap-1 bg-th-surface border border-th-border rounded-lg p-1">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setRange(opt.id)}
                  className={`px-3 py-1 rounded-md text-xs transition-colors ${range === opt.id ? 'bg-th-border text-th-tx1' : 'text-th-tx3 hover:text-th-tx2'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchClicks}
              disabled={loading}
              className="p-2 rounded-lg border border-th-border text-th-tx3 hover:text-th-tx1 hover:border-th-border transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MousePointerClick size={14} className="text-th-accent" />
              <p className="text-th-tx3 text-xs font-medium">Total Clicks</p>
            </div>
            <p className="text-th-tx1 text-2xl font-bold tabular-nums">{totalClicks}</p>
            <p className="text-th-tx4 text-xs mt-1">tracked link clicks</p>
          </div>
          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={14} className="text-sky-400" />
              <p className="text-th-tx3 text-xs font-medium">Posts Tracked</p>
            </div>
            <p className="text-th-tx1 text-2xl font-bold tabular-nums">{uniquePosts}</p>
            <p className="text-th-tx4 text-xs mt-1">posts with tracking links</p>
          </div>
          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-emerald-400" />
              <p className="text-th-tx3 text-xs font-medium">Top Platform</p>
            </div>
            {topPlatform ? (
              <>
                <p className="text-th-tx1 text-2xl font-bold capitalize">{PLATFORM_META[topPlatform]?.label || topPlatform}</p>
                <p className="text-th-tx4 text-xs mt-1">most clicks in period</p>
              </>
            ) : (
              <p className="text-th-tx4 text-sm">No data yet</p>
            )}
          </div>
        </div>

        {/* Clicks over time */}
        <div className="bg-th-surface border border-th-border rounded-xl p-5">
          <p className="text-th-tx1 text-sm font-semibold mb-4">Clicks over time</p>
          {dailySeries.length > 1 ? (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 min-w-[500px] h-28">
                {dailySeries.map(({ date, count }) => {
                  const max = Math.max(...dailySeries.map(d => d.count), 1);
                  const h = max > 0 ? (count / max) * 100 : 0;
                  const isToday = date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1 group" title={`${date}: ${count} click${count !== 1 ? 's' : ''}`}>
                      <div className="w-full rounded-t relative" style={{ height: '100px' }}>
                        <div
                          className={`absolute bottom-0 w-full rounded-t transition-all ${isToday ? 'bg-th-accent' : 'bg-th-accent/40 group-hover:bg-th-accent/60'}`}
                          style={{ height: `${Math.max(h, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-th-tx4 min-w-[500px]">
                <span>{dailySeries[0]?.date}</span>
                <span>{dailySeries[dailySeries.length - 1]?.date}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-th-tx4">
              <MousePointerClick size={28} className="mb-3 opacity-30" />
              <p className="text-sm">No click data in this period</p>
              <p className="text-xs mt-1 text-th-tx4">Generate a tracking link in Post Queue and share it to start tracking</p>
            </div>
          )}
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <p className="text-th-tx1 text-sm font-semibold mb-4">Platform breakdown</p>
            <PlatformBreakdown clicks={filtered} />
          </div>
          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <p className="text-th-tx1 text-sm font-semibold mb-4">Top posts by clicks</p>
            <TopPosts clicks={filtered} />
          </div>
        </div>

        <div className="bg-th-surface border border-th-border rounded-xl p-5">
          <p className="text-th-tx1 text-sm font-semibold mb-4">Top episodes by social traffic</p>
          <TopEpisodes clicks={filtered} />
        </div>

        {/* How it works */}
        {totalClicks === 0 && !loading && (
          <div className="bg-th-surface border border-th-border rounded-xl p-6">
            <p className="text-th-tx1 text-sm font-semibold mb-3 flex items-center gap-2">
              <Link2 size={14} className="text-th-accent" /> How tracking links work
            </p>
            <ol className="space-y-2.5 text-th-tx2 text-sm">
              <li className="flex gap-3"><span className="text-th-accent font-semibold shrink-0">1.</span>Go to Post Queue and open any post that has a YouTube episode linked.</li>
              <li className="flex gap-3"><span className="text-th-accent font-semibold shrink-0">2.</span>Click <strong className="text-th-tx2">Track link</strong> — this generates a short redirect URL through ShowBrain.</li>
              <li className="flex gap-3"><span className="text-th-accent font-semibold shrink-0">3.</span>Click <strong className="text-th-tx2">Copy tracked</strong> and paste that URL into your tweet, LinkedIn post, or newsletter instead of the raw YouTube link.</li>
              <li className="flex gap-3"><span className="text-th-accent font-semibold shrink-0">4.</span>Every time someone clicks it, ShowBrain logs the click and redirects them to YouTube. You see which platform is driving views here.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
