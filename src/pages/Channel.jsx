import { useState, useEffect, useRef } from 'react';
import {
  TvMinimalPlay, RefreshCw, Loader2, CheckCircle, AlertCircle,
  Trash2, Radio, ChevronDown, CheckSquare, Square, Play, Plus, X,
  BarChart2, Sparkles, Eye, EyeOff,
} from 'lucide-react';

// ── Sync progress ─────────────────────────────────────────────────────────────

function SyncProgress({ status }) {
  const { running, channelName, progress, total, processed, currentBatch, totalBatches, currentVideo, errors, lastSyncedAt } = status;
  if (!running && !lastSyncedAt && total === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {running
            ? <Loader2 size={13} className="text-violet-400 animate-spin" />
            : <CheckCircle size={13} className="text-emerald-400" />}
          <span className="text-white text-xs font-medium">
            {running ? `Syncing ${channelName || ''}…` : 'Sync complete'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 tabular-nums">
          {totalBatches > 1 && running && <span>Batch {currentBatch}/{totalBatches}</span>}
          <span>{processed}/{total} videos</span>
        </div>
      </div>

      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {currentVideo && running && (
        <p className="text-zinc-500 text-xs truncate mb-1">Processing: {currentVideo}</p>
      )}

      {errors.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {errors.map((e, i) => (
            <p key={i} className="text-red-400 text-[11px] truncate">✕ {e.title}: {e.error}</p>
          ))}
        </div>
      )}

      {!running && lastSyncedAt && (
        <p className="text-zinc-600 text-[11px] mt-1">
          Last synced {new Date(lastSyncedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ── Video picker ──────────────────────────────────────────────────────────────

function VideoPicker({ channel, onSyncStart, onClose }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [batchSize, setBatchSize] = useState(5);
  const [error, setError] = useState('');

  useEffect(() => { loadPage(); }, []);

  async function loadPage(pageToken = null) {
    try {
      const url = pageToken
        ? `/api/channels/${channel.id}/videos?pageToken=${encodeURIComponent(pageToken)}`
        : `/api/channels/${channel.id}/videos`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVideos(v => pageToken ? [...v, ...data.videos] : data.videos);
      setNextPageToken(data.nextPageToken);
      setTotalCount(data.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function loadAll() {
    setLoadingAll(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/videos?loadAll=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVideos(data.videos);
      setNextPageToken(null);
      setTotalCount(data.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingAll(false);
    }
  }

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(videos.map(v => v.videoId)));
  const selectNone = () => setSelected(new Set());
  const selectUntranscribed = () => setSelected(new Set(videos.filter(v => !v.transcribed).map(v => v.videoId)));

  if (loading) return (
    <div className="flex items-center gap-2 justify-center py-8 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> Loading videos…
    </div>
  );

  return (
    <div>
      {/* Picker toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500 text-xs mr-2">{videos.length} of {totalCount?.toLocaleString()}</span>
          {['All', 'None', 'Untranscribed'].map(label => (
            <button key={label} onClick={label === 'All' ? selectAll : label === 'None' ? selectNone : selectUntranscribed}
              className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors">{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white px-2 py-1.5 focus:outline-none">
            {[1, 3, 5, 10].map(n => <option key={n} value={n}>{n} at a time</option>)}
          </select>
          <button onClick={() => onSyncStart({ videoIds: [...selected], batchSize })}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors">
            <Play size={11} /> Sync selected ({selected.size})
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Video list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
        {videos.map(video => {
          const isSel = selected.has(video.videoId);
          return (
            <div key={video.videoId} onClick={() => toggle(video.videoId)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-zinc-800 last:border-b-0 transition-colors ${isSel ? 'bg-violet-500/10' : 'hover:bg-zinc-800/50'}`}>
              <div className="shrink-0">
                {isSel ? <CheckSquare size={14} className="text-violet-400" /> : <Square size={14} className="text-zinc-600" />}
              </div>
              {video.thumbnail && <img src={video.thumbnail} alt="" className="w-14 h-9 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs leading-snug truncate">{video.title}</p>
                <p className="text-zinc-600 text-[11px] mt-0.5">
                  {new Date(video.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="shrink-0">
                {video.transcribed
                  ? <span className="flex items-center gap-1 text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle size={9} />Done</span>
                  : <span className="text-zinc-600 text-[11px] bg-zinc-800 px-2 py-0.5 rounded-full">Pending</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {(nextPageToken || videos.length < totalCount) && (
        <div className="mt-3 flex items-center gap-3">
          {nextPageToken && (
            <button onClick={() => { setLoadingMore(true); loadPage(nextPageToken); }} disabled={loadingMore}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40">
              {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
              Load more
            </button>
          )}
          {totalCount > 50 && (
            <button onClick={loadAll} disabled={loadingAll}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40">
              {loadingAll ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
              {loadingAll ? 'Loading…' : `Load all ${totalCount?.toLocaleString()} videos`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Channel card ──────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function ChannelCard({ channel, syncStatus, onSync, onFetchStats, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [topBottomLoading, setTopBottomLoading] = useState(false);
  const [topBottomPreview, setTopBottomPreview] = useState(null); // { top, bottom, all }
  const [topBottomN, setTopBottomN] = useState(5);
  const isThisChannelSyncing = syncStatus.running && syncStatus.channelId === channel.id;
  const isFetchingStats = isThisChannelSyncing && syncStatus.currentVideo?.includes('Fetching');

  const handleSyncStart = ({ videoIds, batchSize }) => {
    setExpanded(false);
    onSync(channel.id, { videoIds, batchSize });
  };

  const handleFetchStats = () => {
    setTopBottomPreview(null);
    onFetchStats(channel.id);
  };

  const handleLoadTopBottom = async (n) => {
    setTopBottomLoading(true);
    setTopBottomPreview(null);
    try {
      const res = await fetch(`/api/channels/${channel.id}/top-bottom?n=${n}`);
      const data = await res.json();
      setTopBottomPreview(data);
    } catch {}
    finally { setTopBottomLoading(false); }
  };

  const handleTranscribeTopBottom = () => {
    if (!topBottomPreview?.all?.length) return;
    const videoIds = topBottomPreview.all.map(v => v.videoId);
    setTopBottomPreview(null);
    onSync(channel.id, { videoIds, batchSize: 3 });
  };

  // Counts: how many episodes have stats vs transcripts
  const statsCount = channel.episodeCount || 0;
  const transcribedCount = channel.transcribedCount || 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {channel.thumbnail && (
          <img src={channel.thumbnail} alt="" className="w-12 h-12 rounded-full shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-semibold truncate">{channel.name}</h3>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-zinc-500 text-xs">{channel.videoCount?.toLocaleString() || '?'} videos</span>
            {statsCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                <BarChart2 size={9} /> {statsCount} with stats
              </span>
            )}
            {transcribedCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle size={9} /> {transcribedCount} analysed
              </span>
            )}
          </div>
          {channel.lastSyncedAt && (
            <p className="text-zinc-600 text-[11px] mt-1">
              Last synced {new Date(channel.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={() => onRemove(channel.id)}
          className="p-1.5 rounded-lg border border-zinc-800 hover:border-red-500/40 text-zinc-600 hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Action buttons */}
      {!isThisChannelSyncing && (
        <div className="border-t border-zinc-800 px-4 py-3 flex flex-wrap gap-2">
          {/* 1. Fetch stats */}
          <button
            onClick={handleFetchStats}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-sky-500/50 text-zinc-400 hover:text-sky-300 hover:bg-sky-500/5 text-xs transition-colors"
          >
            <BarChart2 size={11} /> Fetch Stats
          </button>

          {/* 2. Top & Bottom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleLoadTopBottom(topBottomN)}
              disabled={topBottomLoading || statsCount === 0}
              title={statsCount === 0 ? 'Fetch stats first' : ''}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-violet-500/50 text-zinc-400 hover:text-violet-300 hover:bg-violet-500/5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {topBottomLoading
                ? <Loader2 size={11} className="animate-spin" />
                : <Sparkles size={11} />}
              Top &amp; Bottom
            </button>
            <select
              value={topBottomN}
              onChange={e => setTopBottomN(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 px-2 py-1.5 focus:outline-none"
            >
              {[3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* 3. Pick videos (manual) */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white text-xs transition-colors ml-auto"
          >
            <RefreshCw size={11} /> Pick videos
          </button>
        </div>
      )}

      {/* Syncing state */}
      {isThisChannelSyncing && (
        <div className="border-t border-zinc-800 px-4 py-3 flex items-center gap-2">
          <Loader2 size={12} className="text-violet-400 animate-spin" />
          <span className="text-zinc-400 text-xs">{syncStatus.currentVideo || 'Working…'}</span>
          {syncStatus.total > 0 && (
            <span className="text-zinc-600 text-xs ml-auto tabular-nums">
              {syncStatus.processed}/{syncStatus.total}
            </span>
          )}
        </div>
      )}

      {/* Top & Bottom preview */}
      {topBottomPreview && !isThisChannelSyncing && (
        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white text-xs font-semibold">
              {topBottomPreview.all?.length} videos selected for transcription
            </p>
            <button onClick={() => setTopBottomPreview(null)} className="text-zinc-600 hover:text-white">
              <X size={13} />
            </button>
          </div>

          {topBottomPreview.total === 0 ? (
            <p className="text-zinc-500 text-xs">No unanalysed videos with stats found. Fetch stats first.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Top */}
                <div>
                  <p className="text-[11px] font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
                    <Eye size={10} /> Top {topBottomN} by views
                  </p>
                  <div className="space-y-1">
                    {topBottomPreview.top.map(v => (
                      <div key={v.videoId} className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-2.5 py-1.5">
                        <p className="text-zinc-300 text-[11px] truncate leading-snug">{v.title}</p>
                        <p className="text-emerald-400 text-[10px] tabular-nums mt-0.5">{fmt(v.viewCount)} views</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bottom */}
                <div>
                  <p className="text-[11px] font-semibold text-zinc-500 mb-1.5 flex items-center gap-1">
                    <EyeOff size={10} /> Bottom {topBottomN} by views
                  </p>
                  <div className="space-y-1">
                    {topBottomPreview.bottom.map(v => (
                      <div key={v.videoId} className="bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-2.5 py-1.5">
                        <p className="text-zinc-400 text-[11px] truncate leading-snug">{v.title}</p>
                        <p className="text-zinc-600 text-[10px] tabular-nums mt-0.5">{fmt(v.viewCount)} views</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleTranscribeTopBottom}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
              >
                <Sparkles size={12} />
                Transcribe &amp; Analyse these {topBottomPreview.all?.length} videos
              </button>
            </>
          )}
        </div>
      )}

      {/* Video picker (expandable) */}
      {expanded && !isThisChannelSyncing && (
        <div className="border-t border-zinc-800 p-4">
          <VideoPicker channel={channel} onSyncStart={handleSyncStart} onClose={() => setExpanded(false)} />
        </div>
      )}

      {/* Full progress bar when syncing */}
      {isThisChannelSyncing && syncStatus.total > 0 && (
        <div className="px-4 pb-4">
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${syncStatus.progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Channel({ onEpisodesLoaded }) {
  const [channels, setChannels] = useState([]);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState({
    running: false, channelId: null, channelName: null,
    progress: 0, total: 0, processed: 0,
    currentBatch: 0, totalBatches: 0,
    currentVideo: null, errors: [], lastSyncedAt: null,
  });
  const pollRef = useRef(null);

  // Load channels + episodes on mount
  useEffect(() => {
    loadChannels();
  }, []);

  async function loadChannels() {
    try {
      const [chRes, epRes] = await Promise.all([
        fetch('/api/channels'),
        fetch('/api/episodes'),
      ]);
      const channels = await chRes.json();
      const episodes = await epRes.json();

      // Enrich channel cards with transcribed counts
      const enriched = channels.map(ch => ({
        ...ch,
        transcribedCount: episodes.filter(e => e.channelId === ch.id && e.transcript).length,
      }));
      setChannels(enriched);
      onEpisodesLoaded?.(episodes);
    } catch {}
  }

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/sync/status');
        const status = await res.json();
        setSyncStatus(status);
        if (!status.running) {
          stopPolling();
          loadChannels();
        }
      } catch {}
    }, 2000);
  };

  const stopPolling = () => {
    clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => () => stopPolling(), []);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setError('');
    setAdding(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUrl('');
      setShowAddForm(false);
      setChannels(prev => [...prev, { ...data.channel, episodeCount: 0 }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async (channelId, { videoIds, batchSize }) => {
    setError('');
    try {
      const res = await fetch(`/api/channels/${channelId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds, batchSize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncStatus(s => ({ ...s, running: true, channelId, progress: 0, processed: 0 }));
      startPolling();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFetchStats = async (channelId) => {
    setError('');
    try {
      const res = await fetch(`/api/channels/${channelId}/fetch-stats`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncStatus(s => ({ ...s, running: true, channelId, progress: 0, processed: 0, currentVideo: 'Fetching video list…' }));
      startPolling();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemove = async (channelId) => {
    if (!confirm('Remove this channel? Its episodes will also be deleted.')) return;
    await fetch(`/api/channels/${channelId}`, { method: 'DELETE' });
    setChannels(prev => prev.filter(c => c.id !== channelId));
    // Reload episodes
    const epRes = await fetch('/api/episodes');
    onEpisodesLoaded?.(await epRes.json());
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <TvMinimalPlay size={17} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">Channels</h1>
            <p className="text-zinc-500 text-xs">Add YouTube channels to track, transcribe, and compare.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors"
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : 'Add Channel'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
          <label className="text-xs text-zinc-500 font-medium mb-2 block">Channel URL or @handle</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://youtube.com/@lexfridman"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !url.trim()}
              className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm transition-colors flex items-center gap-2"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add
            </button>
          </div>
          {error && (
            <div className="mt-2 flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
      )}

      {/* Channel list */}
      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TvMinimalPlay size={32} className="text-zinc-800 mb-3" />
          <p className="text-zinc-500 text-sm mb-1">No channels added yet</p>
          <p className="text-zinc-700 text-xs">Add your own channel, or add competitors to compare.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map(channel => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              syncStatus={syncStatus}
              onSync={handleSync}
              onFetchStats={handleFetchStats}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Auto-sync note */}
      {channels.length > 0 && (
        <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Radio size={12} className="text-violet-400" />
            <span className="text-white text-xs font-medium">Auto-sync</span>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">
            All channels are checked for new videos every 6 hours. Use "Pick videos" to manually choose what to transcribe and analyse.
          </p>
        </div>
      )}
    </div>
  );
}
