import { useState, useMemo, useEffect, useRef } from 'react';
import { Loader2, Sparkles, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, Users, Eye, TrendingUp, BarChart2, Clock, Mic } from 'lucide-react';
import { generateShowNotes, generateChapterMarkers } from '../lib/claude';
import { apiFetch } from '../lib/api';
import { ErrorToast } from '../components/Dialog';

const PAGE_SIZE = 10;

function fmt(n) {
  if (!n) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toString();
}

function channelAge(createdAt) {
  if (!createdAt) return '—';
  const ms = Date.now() - new Date(createdAt);
  const years = ms / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return `${Math.round(years * 12)} months`;
  return `${years.toFixed(1)} years`;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={accent ? 'text-th-accent' : 'text-th-tx4'} />
        <span className="text-th-tx3 text-xs font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${accent ? 'text-th-accent' : 'text-th-tx1'}`}>{value}</p>
      {sub && <p className="text-th-tx4 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard({ episodes, channels = [], syncStatus, onSyncStart, onEpisodesUpdate }) {
  const [selected, setSelected] = useState(null);
  const [transcribing, setTranscribing] = useState(null); // videoId being transcribed
  const [showNotes, setShowNotes] = useState('');
  const [chapters, setChapters] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [page, setPage] = useState(1);

  // Primary channel only
  const primaryChannel = channels.find(c => c.isPrimary) || channels[0] || null;
  const primaryEpisodes = useMemo(() =>
    primaryChannel
      ? episodes.filter(e => e.channelId === primaryChannel.id)
      : episodes,
    [episodes, primaryChannel]
  );

  // Stats derived from primary channel episodes
  const stats = useMemo(() => {
    const withViews = primaryEpisodes.filter(e => e.viewCount > 0);
    const avgViews = avg(withViews.map(e => e.viewCount));
    const avgLikes = avg(withViews.map(e => e.likeCount || 0));
    const avgComments = avg(withViews.map(e => e.commentCount || 0));
    const engagementRate = avgViews > 0 ? (avgLikes + avgComments) / avgViews : 0;

    const sorted = [...primaryEpisodes].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const recent10 = sorted.slice(0, 10).filter(e => e.viewCount > 0);
    const prev10 = sorted.slice(10, 20).filter(e => e.viewCount > 0);
    const recentAvg = recent10.length ? avg(recent10.map(e => e.viewCount)) : null;
    const prevAvg = prev10.length ? avg(prev10.map(e => e.viewCount)) : null;
    const momentum = recentAvg && prevAvg ? ((recentAvg - prevAvg) / prevAvg) * 100 : null;

    const topEpisode = withViews.sort((a, b) => b.viewCount - a.viewCount)[0] || null;

    const startDate = primaryChannel?.channelCreatedAt
      ? new Date(primaryChannel.channelCreatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      : null;

    return { avgViews, engagementRate, momentum, topEpisode, startDate };
  }, [primaryEpisodes, primaryChannel]);

  const totalPages = Math.max(1, Math.ceil(primaryEpisodes.length / PAGE_SIZE));
  const pageEpisodes = useMemo(() => {
    const sorted = [...primaryEpisodes].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [primaryEpisodes, page]);

  const handleSelect = (ep) => {
    setSelected(ep);
    setShowNotes('');
    setChapters([]);
    setExpanded(null);
  };

  const handleGenerateNotes = async () => {
    if (!selected) return;
    setLoadingNotes(true);
    try {
      const notes = await generateShowNotes(selected);
      setShowNotes(notes);
      setExpanded('notes');
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleGenerateChapters = async () => {
    if (!selected) return;
    setLoadingChapters(true);
    try {
      const ch = await generateChapterMarkers(selected.transcript, selected.duration);
      setChapters(ch);
      setExpanded('chapters');
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingChapters(false);
    }
  };

  const handleTranscribe = async (ep, e) => {
    e.stopPropagation();
    if (!primaryChannel || transcribing) return;
    setTranscribing(ep.videoId);
    try {
      const res = await apiFetch(`/api/channels/${primaryChannel.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: [ep.videoId], batchSize: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSyncStart?.(primaryChannel.id);
    } catch (err) {
      setErrorMsg(err.message);
      setTranscribing(null);
    }
  };

  // Clear transcribing spinner and reload episodes when sync finishes
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !syncStatus?.running && transcribing) {
      setTranscribing(null);
      apiFetch('/api/episodes').then(r => r.json()).then(eps => onEpisodesUpdate?.(eps)).catch(() => {});
    }
    prevRunning.current = syncStatus?.running ?? false;
  }, [syncStatus?.running]);

  if (!primaryChannel) {
    return (
      <div className="flex items-center justify-center h-full text-th-tx4 text-sm">
        No channel added yet. Add a channel to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {errorMsg && <ErrorToast message={errorMsg} onClose={() => setErrorMsg('')} />}

      {/* ── Channel header ── */}
      <div className="border-b border-th-border px-6 py-5 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          {primaryChannel.thumbnail && (
            <img src={primaryChannel.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover border border-th-border" />
          )}
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg leading-tight">{primaryChannel.name}</h1>
            {stats.startDate && (
              <p className="text-th-tx4 text-xs">Started {stats.startDate} · {channelAge(primaryChannel.channelCreatedAt)} old</p>
            )}
          </div>
          <a
            href={`https://youtube.com/channel/${primaryChannel.id}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-th-tx4 hover:text-red-400 transition-colors"
          >
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Subscribers" value={fmt(primaryChannel.subscriberCount)} />
          <StatCard icon={Eye} label="Total views" value={fmt(primaryChannel.totalViewCount)} />
          <StatCard icon={BarChart2} label="Total videos" value={fmt(primaryChannel.videoCount)} sub={`${primaryEpisodes.length} synced`} />
          <StatCard icon={TrendingUp} label="Avg views" value={fmt(stats.avgViews)} accent />
          <StatCard
            icon={TrendingUp}
            label="Momentum"
            value={stats.momentum !== null ? `${stats.momentum >= 0 ? '+' : ''}${stats.momentum.toFixed(0)}%` : '—'}
            sub="recent 10 vs prev 10"
            accent={stats.momentum > 0}
          />
          <StatCard
            icon={BarChart2}
            label="Engagement"
            value={stats.engagementRate > 0 ? `${(stats.engagementRate * 100).toFixed(1)}%` : '—'}
            sub="likes + comments / views"
          />
        </div>

        {/* Top episode callout */}
        {stats.topEpisode && (
          <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <span className="text-amber-300 text-[10px] font-semibold uppercase tracking-wider shrink-0">Top video</span>
            <span className="text-th-tx2 text-xs truncate">{stats.topEpisode.title}</span>
            <span className="text-amber-300 text-xs tabular-nums shrink-0 ml-auto">{fmt(stats.topEpisode.viewCount)} views</span>
          </div>
        )}
      </div>

      {/* ── Episodes + detail ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Episode list */}
        <div className="w-80 border-r border-th-border flex flex-col shrink-0">
          <div className="px-4 pt-3 pb-2 shrink-0 flex items-center justify-between">
            <h2 className="text-th-tx1 font-medium text-sm">
              Episodes
              <span className="text-th-tx4 font-normal ml-1.5">({primaryEpisodes.length})</span>
            </h2>
            {totalPages > 1 && (
              <span className="text-th-tx4 text-xs">{page}/{totalPages}</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5">
            {pageEpisodes.length === 0 && (
              <p className="text-th-tx4 text-sm text-center py-8">No episodes synced yet.</p>
            )}
            {pageEpisodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => handleSelect(ep)}
                className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                  selected?.id === ep.id
                    ? 'border-th-accent/60 bg-th-accent/5'
                    : 'border-th-border bg-th-surface hover:border-th-border/80'
                }`}
              >
                <p className="text-th-tx1 text-xs font-medium leading-snug line-clamp-2 mb-1.5">{ep.title}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-th-tx4 text-[11px] shrink-0">{ep.publishedAt}</span>
                  <div className="flex items-center gap-2">
                    {ep.viewCount > 0 && (
                      <span className="text-th-tx3 text-[11px] tabular-nums">{fmt(ep.viewCount)} views</span>
                    )}
                    {ep.transcript
                      ? <span className="flex items-center gap-0.5 text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">✓ Done</span>
                      : transcribing === ep.videoId
                        ? <span className="flex items-center gap-0.5 text-th-accent text-[10px] bg-th-accent/10 px-1.5 py-0.5 rounded-full shrink-0"><Loader2 size={8} className="animate-spin" /> Syncing…</span>
                        : <button
                            onClick={(e) => handleTranscribe(ep, e)}
                            disabled={!!transcribing}
                            className="flex items-center gap-0.5 text-[10px] text-th-tx3 hover:text-th-accent bg-th-raised hover:bg-th-accent/10 border border-th-border hover:border-th-accent/30 px-1.5 py-0.5 rounded-full shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Mic size={8} /> Transcribe
                          </button>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="shrink-0 border-t border-th-border px-4 py-3 flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-th-border text-th-tx3 hover:text-th-tx1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={13} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-6 h-6 rounded text-xs font-medium transition-colors ${p === page ? 'bg-th-accent text-th-accentFg' : 'text-th-tx4 hover:text-th-tx1 hover:bg-th-raised'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-th-border text-th-tx3 hover:text-th-tx1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Episode detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-th-tx4 text-sm">
              Select an episode to view details
            </div>
          ) : (
            <div className="max-w-2xl">
              <p className="text-xs text-th-tx3 mb-1">{selected.publishedAt}</p>
              <h1 className="text-th-tx1 text-xl font-semibold mb-2">{selected.title}</h1>

              {/* Episode stats */}
              {selected.viewCount > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  <span className="text-xs text-th-tx3 flex items-center gap-1"><Eye size={11} /> {fmt(selected.viewCount)} views</span>
                  {selected.likeCount > 0 && <span className="text-xs text-th-tx3">{fmt(selected.likeCount)} likes</span>}
                  {selected.commentCount > 0 && <span className="text-xs text-th-tx3">{fmt(selected.commentCount)} comments</span>}
                  {selected.duration > 0 && <span className="text-xs text-th-tx3 flex items-center gap-1"><Clock size={11} /> {Math.floor(selected.duration / 60)}m</span>}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-5">
                {selected.topics?.map((t) => (
                  <span key={t} className="text-xs text-th-accent bg-th-accent/10 border border-th-accent/20 px-2.5 py-0.5 rounded-full">{t}</span>
                ))}
              </div>

              {selected.summary && (
                <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-5">
                  <p className="text-xs text-th-tx3 mb-2 font-medium uppercase tracking-wider">Summary</p>
                  <p className="text-th-tx2 text-sm leading-relaxed">{selected.summary}</p>
                </div>
              )}

              <div className="flex gap-3 mb-5 flex-wrap">
                <button onClick={handleGenerateNotes} disabled={loadingNotes || !selected.transcript}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-raised hover:bg-th-border border border-th-border text-th-tx1 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {loadingNotes ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-th-accent" />}
                  Show Notes
                </button>
                <button onClick={handleGenerateChapters} disabled={loadingChapters || !selected.transcript}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-raised hover:bg-th-border border border-th-border text-th-tx1 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {loadingChapters ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-th-accent" />}
                  Chapter Markers
                </button>
              </div>

              {showNotes && (
                <div className="bg-th-surface border border-th-border rounded-xl mb-4 overflow-hidden">
                  <button onClick={() => setExpanded(expanded === 'notes' ? null : 'notes')}
                    className="w-full flex items-center justify-between p-4 text-th-tx1 text-sm font-medium hover:bg-th-raised/50 transition-colors">
                    Show Notes
                    {expanded === 'notes' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expanded === 'notes' && (
                    <div className="px-4 pb-4 border-t border-th-border">
                      <pre className="text-th-tx2 text-sm leading-relaxed whitespace-pre-wrap font-sans mt-3">{showNotes}</pre>
                      <button onClick={() => navigator.clipboard.writeText(showNotes)}
                        className="mt-3 text-xs text-th-tx3 hover:text-th-tx2 transition-colors">Copy to clipboard</button>
                    </div>
                  )}
                </div>
              )}

              {chapters.length > 0 && (
                <div className="bg-th-surface border border-th-border rounded-xl mb-4 overflow-hidden">
                  <button onClick={() => setExpanded(expanded === 'chapters' ? null : 'chapters')}
                    className="w-full flex items-center justify-between p-4 text-th-tx1 text-sm font-medium hover:bg-th-raised/50 transition-colors">
                    Chapter Markers
                    {expanded === 'chapters' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expanded === 'chapters' && (
                    <div className="px-4 pb-4 border-t border-th-border mt-0 space-y-2 pt-3">
                      {chapters.map((ch, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-th-accent font-mono text-xs w-12 shrink-0">{ch.time}</span>
                          <span className="text-th-tx2 text-sm">{ch.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(expanded === 'transcript' ? null : 'transcript')}
                  className="w-full flex items-center justify-between p-4 text-th-tx1 text-sm font-medium hover:bg-th-raised/50 transition-colors">
                  Transcript
                  {expanded === 'transcript' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expanded === 'transcript' && (
                  <div className="px-4 pb-4 border-t border-th-border">
                    {selected.transcript
                      ? <p className="text-th-tx2 text-sm leading-relaxed mt-3 whitespace-pre-wrap">{selected.transcript}</p>
                      : <p className="text-th-tx4 text-sm mt-3">No transcript available for this episode.</p>
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
