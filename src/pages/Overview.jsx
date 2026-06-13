import { useMemo } from 'react';
import {
  TvMinimalPlay, FileText, Sparkles, Eye, ThumbsUp, MessageSquare,
  Star, TrendingUp, Tag, Mic, Gauge, ArrowRight, Clock,
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.round(seconds / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

const SENTIMENT_META = {
  positive:  { label: 'Positive',  color: 'bg-emerald-500', text: 'text-emerald-400' },
  negative:  { label: 'Negative',  color: 'bg-red-500',     text: 'text-red-400' },
  neutral:   { label: 'Neutral',   color: 'bg-th-tx4',      text: 'text-th-tx3' },
  mixed:     { label: 'Mixed',     color: 'bg-amber-500',   text: 'text-amber-400' },
  critical:  { label: 'Critical',  color: 'bg-orange-500',  text: 'text-orange-400' },
};

const FORMAT_LABELS = {
  solo: 'Solo', interview: 'Interview', 'co-hosted': 'Co-hosted',
  panel: 'Panel', narrative: 'Narrative', qa: 'Q&A',
};

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, label, value, sub }) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-th-tx3 text-xs mb-0.5">{label}</p>
        <p className="text-th-tx1 text-xl font-bold tabular-nums leading-none">{value}</p>
        {sub && <p className="text-th-tx4 text-[11px] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-3">
      <h2 className="text-th-tx1 text-sm font-semibold">{title}</h2>
      {sub && <p className="text-th-tx3 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, colorClass }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex-1 h-1.5 bg-th-raised rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function Overview({ episodes, channels, onNavigate }) {
  const stats = useMemo(() => {
    // Primary channel only — exclude compare-only channels
    const primary = channels.find(c => c.isPrimary) || channels.find(c => !c.compareOnly) || channels[0] || null;
    const primaryEps = primary ? episodes.filter(e => e.channelId === primary.id) : episodes;

    const withStats  = primaryEps.filter(e => e.viewCount > 0);
    const analysed   = primaryEps.filter(e => e.summary);
    const totalViews = withStats.reduce((s, e) => s + (e.viewCount || 0), 0);
    const totalLikes = withStats.reduce((s, e) => s + (e.likeCount || 0), 0);
    const totalComments = withStats.reduce((s, e) => s + (e.commentCount || 0), 0);
    const avgViews   = withStats.length ? Math.round(totalViews / withStats.length) : 0;
    const avgDuration = withStats.length
      ? Math.round(withStats.reduce((s, e) => s + (e.duration || 0), 0) / withStats.length)
      : 0;

    // Sentiment breakdown
    const sentimentMap = {};
    analysed.forEach(e => {
      if (e.sentiment) sentimentMap[e.sentiment] = (sentimentMap[e.sentiment] || 0) + 1;
    });

    // Topics
    const topicMap = {};
    analysed.forEach(e => {
      e.topics?.forEach(t => { topicMap[t] = (topicMap[t] || 0) + 1; });
    });
    const topTopics = Object.entries(topicMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    // Format breakdown (from dimensions)
    const formatMap = {};
    analysed.forEach(e => {
      const f = e.dimensions?.format;
      if (f) formatMap[f] = (formatMap[f] || 0) + 1;
    });

    // Top episodes by views
    const topEpisodes = [...withStats]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5);

    // Recent (last analysed)
    const recentAnalysed = [...analysed]
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 5);

    return {
      withStats, analysed, totalViews, totalLikes, totalComments,
      avgViews, avgDuration, sentimentMap, topTopics,
      formatMap, topEpisodes, recentAnalysed, primary,
    };
  }, [episodes, channels]);

  const hasData = episodes.length > 0;
  const hasAnalysis = stats.analysed.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <Gauge size={24} className="text-rose-400" />
        </div>
        <div>
          <h2 className="text-th-tx1 font-semibold text-lg mb-1">No data yet</h2>
          <p className="text-th-tx3 text-sm max-w-xs">
            Add a channel and fetch stats or transcribe episodes — your dashboard will fill up automatically.
          </p>
        </div>
        <button
          onClick={() => onNavigate('channel')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accentH text-th-accentFg text-sm transition-colors"
        >
          <TvMinimalPlay size={14} />
          Add a channel
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">

        {/* ── Top stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={TvMinimalPlay} iconBg="bg-blue-500"
            label="Channel" value={stats.primary?.name || '—'}
            sub={stats.primary ? `${stats.withStats.length.toLocaleString()} episodes tracked` : 'No channel set'}
          />
          <StatCard
            icon={FileText} iconBg="bg-indigo-500"
            label="Episodes tracked" value={stats.withStats.length.toLocaleString()}
            sub={`of ${stats.withStats.length.toLocaleString()} imported`}
          />
          <StatCard
            icon={Sparkles} iconBg="bg-violet-500"
            label="Analysed" value={stats.analysed.length.toLocaleString()}
            sub={stats.analysed.length ? `${Math.round(stats.analysed.length / Math.max(stats.withStats.length, 1) * 100)}% of library` : 'None yet'}
          />
          <StatCard
            icon={Eye} iconBg="bg-emerald-500"
            label="Total views" value={fmt(stats.totalViews)}
            sub={stats.avgViews ? `Avg ${fmt(stats.avgViews)} per episode` : 'Fetch stats to see'}
          />
        </div>

        {/* ── Engagement row ─────────────────────────────────────── */}
        {stats.totalLikes > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={ThumbsUp}      iconBg="bg-sky-500"    label="Total likes"    value={fmt(stats.totalLikes)} />
            <StatCard icon={MessageSquare} iconBg="bg-teal-500"   label="Total comments" value={fmt(stats.totalComments)} />
            <StatCard icon={Clock}         iconBg="bg-amber-500"  label="Avg duration"   value={fmtDuration(stats.avgDuration)} />
          </div>
        )}

        {/* ── Primary channel spotlight ──────────────────────────── */}
        {stats.primary && (
          <div>
            <SectionHeader title="Primary Channel" sub="Your main data source" />
            <div className="bg-th-surface border border-amber-500/20 rounded-xl p-4 flex items-center gap-4">
              {stats.primary.thumbnail && (
                <img src={stats.primary.thumbnail} alt="" className="w-12 h-12 rounded-full shrink-0 ring-2 ring-amber-500/30" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-th-tx1 font-semibold text-sm truncate">{stats.primary.name}</p>
                  <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    <Star size={8} className="fill-amber-400" /> Primary
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-th-tx3">
                  <span>{(stats.primary.videoCount || 0).toLocaleString()} videos on YouTube</span>
                  <span>{(stats.primary.episodeCount || 0).toLocaleString()} with stats</span>
                  <span>{(stats.primary.transcribedCount || 0).toLocaleString()} analysed</span>
                  {stats.primary.lastSyncedAt && (
                    <span>Last synced {new Date(stats.primary.lastSyncedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onNavigate('channel')}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-th-border hover:border-th-accent/40 text-th-tx3 hover:text-th-accent text-xs transition-colors"
              >
                Manage <ArrowRight size={11} />
              </button>
            </div>
          </div>
        )}

        {/* ── Sentiment + Format ─────────────────────────────────── */}
        {hasAnalysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Sentiment */}
            <div>
              <SectionHeader
                title="Content Sentiment"
                sub={`Across ${stats.analysed.length} analysed episodes`}
              />
              <div className="bg-th-surface border border-th-border rounded-xl p-4 space-y-2.5">
                {Object.entries(stats.sentimentMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => {
                    const meta = SENTIMENT_META[key] || SENTIMENT_META.neutral;
                    const max = Math.max(...Object.values(stats.sentimentMap));
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        <span className={`text-xs font-medium w-16 shrink-0 ${meta.text}`}>{meta.label}</span>
                        <MiniBar value={count} max={max} colorClass={meta.color} />
                        <span className="text-th-tx3 text-xs tabular-nums w-8 text-right shrink-0">{count}</span>
                      </div>
                    );
                  })}
                {Object.keys(stats.sentimentMap).length === 0 && (
                  <p className="text-th-tx4 text-xs">Analyse episodes to see sentiment.</p>
                )}
              </div>
            </div>

            {/* Format */}
            <div>
              <SectionHeader
                title="Episode Formats"
                sub="How your content breaks down"
              />
              <div className="bg-th-surface border border-th-border rounded-xl p-4 space-y-2.5">
                {Object.entries(stats.formatMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => {
                    const max = Math.max(...Object.values(stats.formatMap));
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        <span className="text-xs text-th-tx2 w-20 shrink-0">{FORMAT_LABELS[key] || key}</span>
                        <MiniBar value={count} max={max} colorClass="bg-th-accent" />
                        <span className="text-th-tx3 text-xs tabular-nums w-8 text-right shrink-0">{count}</span>
                      </div>
                    );
                  })}
                {Object.keys(stats.formatMap).length === 0 && (
                  <p className="text-th-tx4 text-xs">Run Intelligence analysis to see formats.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Top topics ─────────────────────────────────────────── */}
        {stats.topTopics.length > 0 && (
          <div>
            <SectionHeader title="Top Topics" sub="Most recurring themes across analysed episodes" />
            <div className="flex flex-wrap gap-2">
              {stats.topTopics.map(([topic, count], i) => {
                const maxCount = stats.topTopics[0][1];
                const opacity = 0.4 + (count / maxCount) * 0.6;
                return (
                  <span
                    key={topic}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-th-accent/20 bg-th-accent/5 text-th-accent text-xs"
                    style={{ opacity }}
                  >
                    <Tag size={9} />
                    {topic}
                    <span className="text-th-tx4 text-[10px] tabular-nums">{count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Top performers ─────────────────────────────────────── */}
        {stats.topEpisodes.length > 0 && (
          <div>
            <SectionHeader title="Top Performers" sub="Highest view count across all channels" />
            <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
              {stats.topEpisodes.map((ep, i) => (
                <div key={ep.id} className={`flex items-center gap-3 px-4 py-3 ${i < stats.topEpisodes.length - 1 ? 'border-b border-th-border' : ''}`}>
                  <span className="text-th-tx4 text-xs font-mono w-4 shrink-0">#{i + 1}</span>
                  {ep.thumbnail && (
                    <img src={ep.thumbnail} alt="" className="w-10 h-7 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-th-tx1 text-xs font-medium truncate">{ep.title}</p>
                    <p className="text-th-tx4 text-[11px] mt-0.5">{ep.show} · {ep.publishedAt}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-th-tx3 tabular-nums shrink-0">
                    <span className="flex items-center gap-1"><Eye size={10} />{fmt(ep.viewCount)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp size={10} />{fmt(ep.likeCount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent activity ────────────────────────────────────── */}
        {stats.recentAnalysed.length > 0 && (
          <div>
            <SectionHeader title="Recently Analysed" sub="Latest episodes with full AI analysis" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.recentAnalysed.map(ep => {
                const sColor = SENTIMENT_META[ep.sentiment]?.text || 'text-th-tx3';
                return (
                  <div key={ep.id} className="bg-th-surface border border-th-border rounded-xl p-3 hover:border-th-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-th-tx1 text-xs font-medium leading-snug line-clamp-2">{ep.title}</p>
                      {ep.sentiment && (
                        <span className={`shrink-0 text-[10px] font-medium ${sColor}`}>
                          {SENTIMENT_META[ep.sentiment]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-th-tx3 text-[11px] leading-relaxed line-clamp-2">{ep.summary}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ep.topics?.slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] text-th-tx4 bg-th-raised px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty analysis prompt ──────────────────────────────── */}
        {!hasAnalysis && (
          <div className="bg-th-surface border border-th-border rounded-xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-th-tx1 text-sm font-medium mb-1">Unlock deeper insights</p>
              <p className="text-th-tx3 text-xs leading-relaxed mb-3">
                You have episodes with stats. Head to Intelligence to run AI analysis — sentiment, topics, format and engagement patterns will all appear here.
              </p>
              <button
                onClick={() => onNavigate('intelligence')}
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Go to Intelligence <ArrowRight size={11} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
