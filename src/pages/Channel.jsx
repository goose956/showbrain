import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { ConfirmDialog } from '../components/Dialog';
import {
  TvMinimalPlay, RefreshCw, Loader2, CheckCircle, AlertCircle,
  Trash2, Radio, ChevronDown, CheckSquare, Square, Play, Plus, X,
  BarChart2, Sparkles, Eye, EyeOff, Star,
} from 'lucide-react';

// ── Sync progress ─────────────────────────────────────────────────────────────

function SyncProgress({ status }) {
  const { running, channelName, progress, total, processed, currentBatch, totalBatches, currentVideo, errors, lastSyncedAt } = status;
  if (!running && !lastSyncedAt && total === 0) return null;

  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {running
            ? <Loader2 size={13} className="text-th-accent animate-spin" />
            : <CheckCircle size={13} className="text-emerald-400" />}
          <span className="text-th-tx1 text-xs font-medium">
            {running ? `Syncing ${channelName || ''}…` : 'Sync complete'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-th-tx3 tabular-nums">
          {totalBatches > 1 && running && <span>Batch {currentBatch}/{totalBatches}</span>}
          <span>{processed}/{total} videos</span>
        </div>
      </div>

      <div className="h-1.5 bg-th-raised rounded-full overflow-hidden mb-2">
        <div className="h-full bg-th-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {currentVideo && running && (
        <p className="text-th-tx3 text-xs truncate mb-1">Processing: {currentVideo}</p>
      )}

      {errors.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {errors.map((e, i) => (
            <p key={i} className="text-red-400 text-[11px] truncate">✕ {e.title}: {e.error}</p>
          ))}
        </div>
      )}

      {!running && lastSyncedAt && (
        <p className="text-th-tx4 text-[11px] mt-1">
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
      const res = await apiFetch(url);
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
      const res = await apiFetch(`/api/channels/${channel.id}/videos?loadAll=true`);
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

  const selectAll = async () => {
    // If we haven't loaded the full list yet, fetch it all first then select
    if (videos.length < totalCount) {
      setLoadingAll(true);
      try {
        const res = await apiFetch(`/api/channels/${channel.id}/videos?loadAll=true`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setVideos(data.videos);
        setNextPageToken(null);
        setTotalCount(data.total);
        setSelected(new Set(data.videos.map(v => v.videoId)));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingAll(false);
      }
    } else {
      setSelected(new Set(videos.map(v => v.videoId)));
    }
  };

  const selectNone = () => setSelected(new Set());
  const selectUntranscribed = () => setSelected(new Set(videos.filter(v => !v.transcribed).map(v => v.videoId)));

  if (loading) return (
    <div className="flex items-center gap-2 justify-center py-8 text-th-tx3 text-sm">
      <Loader2 size={14} className="animate-spin" /> Loading videos…
    </div>
  );

  return (
    <div>
      {/* Picker toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <span className="text-th-tx3 text-xs mr-2">{videos.length} of {totalCount?.toLocaleString()}</span>
          {[
            { label: 'All', action: selectAll },
            { label: 'None', action: selectNone },
            { label: 'Untranscribed', action: selectUntranscribed },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} disabled={loadingAll}
              className="flex items-center gap-1 text-xs text-th-tx3 hover:text-th-tx1 px-2 py-1 rounded hover:bg-th-raised transition-colors disabled:opacity-40">
              {label === 'All' && loadingAll ? <><Loader2 size={10} className="animate-spin" />Loading…</> : label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
            className="bg-th-raised border border-th-border rounded-lg text-xs text-th-tx1 px-2 py-1.5 focus:outline-none">
            {[1, 3, 5, 10, 20].map(n => <option key={n} value={n}>{n} at a time</option>)}
          </select>
          <button onClick={() => onSyncStart({ videoIds: [...selected], batchSize })}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-xs font-medium transition-colors">
            <Play size={11} />
            Sync {selected.size > 0 ? `${selected.size} videos` : 'selected'}
            {selected.size > 3 && (
              <span className="opacity-75 font-normal">
                (~{selected.size * 3 >= 60
                  ? `${Math.floor(selected.size * 3 / 60)}h`
                  : `${selected.size * 3}m`})
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Large-batch warning + time estimate */}
      {selected.size > 10 && (
        <div className="mb-3 flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>
            <strong>{selected.size} videos selected</strong> — expect roughly{' '}
            <strong>{Math.round(selected.size * 3)} – {Math.round(selected.size * 5)} minutes</strong> to fully transcribe and analyse.
            The job runs in the background; you can close this panel and check progress on the channel card.
            {videos.length < totalCount && (
              <> <span className="text-amber-300">Only {videos.length} of {totalCount} videos are loaded — use "Load all" above to select from the full catalogue.</span></>
            )}
          </span>
        </div>
      )}

      {/* Partial load notice */}
      {selected.size <= 10 && videos.length < totalCount && (
        <div className="mb-3 flex items-start gap-2 text-th-tx4 text-xs bg-th-raised border border-th-border rounded-lg p-2.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          Showing {videos.length} of {totalCount} videos. Use "Load all" to select from the full catalogue.
        </div>
      )}

      {/* Video list */}
      <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
        {videos.map(video => {
          const isSel = selected.has(video.videoId);
          return (
            <div key={video.videoId} onClick={() => toggle(video.videoId)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-th-border last:border-b-0 transition-colors ${isSel ? 'bg-th-accent/10' : 'hover:bg-th-raised/50'}`}>
              <div className="shrink-0">
                {isSel ? <CheckSquare size={14} className="text-th-accent" /> : <Square size={14} className="text-th-tx4" />}
              </div>
              {video.thumbnail && <img src={video.thumbnail} alt="" className="w-14 h-9 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-th-tx1 text-xs leading-snug truncate">{video.title}</p>
                <p className="text-th-tx4 text-[11px] mt-0.5">
                  {new Date(video.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="shrink-0">
                {video.transcribed
                  ? <span className="flex items-center gap-1 text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle size={9} />Done</span>
                  : <span className="text-th-tx4 text-[11px] bg-th-raised px-2 py-0.5 rounded-full">Pending</span>}
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
              className="flex items-center gap-1.5 text-xs text-th-tx2 hover:text-th-tx1 border border-th-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40">
              {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
              Load more
            </button>
          )}
          {totalCount > 50 && (
            <button onClick={loadAll} disabled={loadingAll}
              className="text-xs text-th-tx3 hover:text-th-tx2 transition-colors disabled:opacity-40">
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

function ChannelCard({ channel, syncStatus, onSync, onFetchStats, onRemove, onSetPrimary }) {
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
      const res = await apiFetch(`/api/channels/${channel.id}/top-bottom?n=${n}`);
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
    <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {channel.thumbnail && (
          <img src={channel.thumbnail} alt="" className="w-12 h-12 rounded-full shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-th-tx1 text-sm font-semibold truncate">{channel.name}</h3>
            {channel.isPrimary && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <Star size={8} className="fill-amber-400" /> Primary
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-th-tx3 text-xs">{channel.videoCount?.toLocaleString() || '?'} videos</span>
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
            <p className="text-th-tx4 text-[11px] mt-1">
              Last synced {new Date(channel.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onSetPrimary(channel.id, !channel.isPrimary)}
            title={channel.isPrimary ? 'Remove primary' : 'Set as primary channel'}
            className={`p-1.5 rounded-lg border transition-colors ${
              channel.isPrimary
                ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                : 'border-th-border text-th-tx4 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5'
            }`}
          >
            <Star size={12} className={channel.isPrimary ? 'fill-amber-400' : ''} />
          </button>
          <button onClick={() => onRemove(channel.id)}
            className="p-1.5 rounded-lg border border-th-border hover:border-red-500/40 text-th-tx4 hover:text-red-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      {!isThisChannelSyncing && (
        <div className="border-t border-th-border px-4 py-3 flex flex-wrap gap-2">
          {/* 1. Fetch stats */}
          <button
            onClick={handleFetchStats}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-th-border hover:border-sky-500/50 text-th-tx2 hover:text-sky-300 hover:bg-sky-500/5 text-xs transition-colors"
          >
            <BarChart2 size={11} /> Fetch Stats
          </button>

          {/* 2. Top & Bottom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleLoadTopBottom(topBottomN)}
              disabled={topBottomLoading || statsCount === 0}
              title={statsCount === 0 ? 'Fetch stats first' : ''}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-th-border hover:border-th-accent/50 text-th-tx2 hover:text-th-accent hover:bg-th-accent/5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {topBottomLoading
                ? <Loader2 size={11} className="animate-spin" />
                : <Sparkles size={11} />}
              Top &amp; Bottom
            </button>
            <select
              value={topBottomN}
              onChange={e => setTopBottomN(Number(e.target.value))}
              className="bg-th-raised border border-th-border rounded-lg text-xs text-th-tx2 px-2 py-1.5 focus:outline-none"
            >
              {[3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* 3. Pick videos (manual) */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-th-border hover:border-th-border text-th-tx2 hover:text-th-tx1 text-xs transition-colors ml-auto"
          >
            <RefreshCw size={11} /> Pick videos
          </button>
        </div>
      )}

      {/* Syncing state */}
      {isThisChannelSyncing && (
        <div className="border-t border-th-border px-4 py-3 flex items-center gap-2">
          <Loader2 size={12} className="text-th-accent animate-spin" />
          <span className="text-th-tx2 text-xs">{syncStatus.currentVideo || 'Working…'}</span>
          {syncStatus.total > 0 && (
            <span className="text-th-tx4 text-xs ml-auto tabular-nums">
              {syncStatus.processed}/{syncStatus.total}
            </span>
          )}
        </div>
      )}

      {/* Top & Bottom preview */}
      {topBottomPreview && !isThisChannelSyncing && (
        <div className="border-t border-th-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-th-tx1 text-xs font-semibold">
              {topBottomPreview.all?.length} videos selected for transcription
            </p>
            <button onClick={() => setTopBottomPreview(null)} className="text-th-tx4 hover:text-th-tx1">
              <X size={13} />
            </button>
          </div>

          {topBottomPreview.total === 0 ? (
            <p className="text-th-tx3 text-xs">No unanalysed videos with stats found. Fetch stats first.</p>
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
                        <p className="text-th-tx2 text-[11px] truncate leading-snug">{v.title}</p>
                        <p className="text-emerald-400 text-[10px] tabular-nums mt-0.5">{fmt(v.viewCount)} views</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bottom */}
                <div>
                  <p className="text-[11px] font-semibold text-th-tx3 mb-1.5 flex items-center gap-1">
                    <EyeOff size={10} /> Bottom {topBottomN} by views
                  </p>
                  <div className="space-y-1">
                    {topBottomPreview.bottom.map(v => (
                      <div key={v.videoId} className="bg-th-raised/60 border border-th-border/60 rounded-lg px-2.5 py-1.5">
                        <p className="text-th-tx2 text-[11px] truncate leading-snug">{v.title}</p>
                        <p className="text-th-tx4 text-[10px] tabular-nums mt-0.5">{fmt(v.viewCount)} views</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleTranscribeTopBottom}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-th-accent hover:bg-th-accentH text-th-accentFg text-xs font-medium transition-colors"
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
        <div className="border-t border-th-border p-4">
          <VideoPicker channel={channel} onSyncStart={handleSyncStart} onClose={() => setExpanded(false)} />
        </div>
      )}

      {/* Full progress bar when syncing */}
      {isThisChannelSyncing && syncStatus.total > 0 && (
        <div className="px-4 pb-4">
          <div className="h-1 bg-th-raised rounded-full overflow-hidden">
            <div className="h-full bg-th-accent rounded-full transition-all duration-500" style={{ width: `${syncStatus.progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Channel({ onEpisodesLoaded, onChannelsLoaded, syncStatus, onSyncStart }) {
  const [channels, setChannels] = useState([]);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);

  useEffect(() => { loadChannels(); }, []);

  // Reload channel list when a sync that was started here finishes
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !syncStatus?.running) loadChannels();
    prevRunning.current = syncStatus?.running ?? false;
  }, [syncStatus?.running]);

  async function loadChannels() {
    try {
      const [chRes, epRes] = await Promise.all([
        apiFetch('/api/channels'),
        apiFetch('/api/episodes'),
      ]);
      const chs = await chRes.json();
      const eps = await epRes.json();
      const enriched = chs.map(ch => ({
        ...ch,
        transcribedCount: eps.filter(e => e.channelId === ch.id && e.transcript).length,
      }));
      setChannels(enriched);
      onEpisodesLoaded?.(eps);
      onChannelsLoaded?.(enriched);
    } catch {}
  }

  const handleAdd = async () => {
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
      setShowAddForm(false);
      setChannels(prev => [...prev, { ...data.channel, episodeCount: 0 }]);

      // Reload episodes after background populate finishes (poll twice)
      const reloadEpisodes = async () => {
        try {
          const epRes = await apiFetch('/api/episodes');
          const eps = await epRes.json();
          onEpisodesLoaded?.(eps);
        } catch {}
      };
      setTimeout(reloadEpisodes, 8000);
      setTimeout(reloadEpisodes, 20000);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async (channelId, { videoIds, batchSize }) => {
    setError('');
    try {
      const res = await apiFetch(`/api/channels/${channelId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds, batchSize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSyncStart?.(channelId);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFetchStats = async (channelId) => {
    setError('');
    try {
      const res = await apiFetch(`/api/channels/${channelId}/fetch-stats`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSyncStart?.(channelId);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSetPrimary = async (channelId, isPrimary) => {
    try {
      const res = await apiFetch(`/api/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Reflect: unset all others if setting primary, update the target
      setChannels(prev => prev.map(ch => ({
        ...ch,
        isPrimary: ch.id === channelId ? isPrimary : (isPrimary ? false : ch.isPrimary),
      })));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemove = (channelId) => {
    const ch = channels.find(c => c.id === channelId);
    setConfirmRemove({ channelId, name: ch?.name || 'this channel' });
  };

  const doRemove = async () => {
    const { channelId } = confirmRemove;
    setConfirmRemove(null);
    await apiFetch(`/api/channels/${channelId}`, { method: 'DELETE' });
    setChannels(prev => prev.filter(c => c.id !== channelId));
    const epRes = await apiFetch('/api/episodes');
    onEpisodesLoaded?.(await epRes.json());
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {confirmRemove && (
        <ConfirmDialog
          title={`Remove ${confirmRemove.name}?`}
          message="All episodes and generated content for this channel will be permanently deleted."
          confirmLabel="Remove channel"
          danger
          onConfirm={doRemove}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <TvMinimalPlay size={17} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg">Channels</h1>
            <p className="text-th-tx3 text-xs">Add YouTube channels to track, transcribe, and compare.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-th-accent hover:bg-th-accentH text-th-accentFg text-sm transition-colors"
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : 'Add Channel'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-5">
          <label className="text-xs text-th-tx3 font-medium mb-2 block">Channel URL or @handle</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://youtube.com/@lexfridman"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-th-raised border border-th-border rounded-lg px-3 py-2.5 text-th-tx1 text-sm placeholder-th-tx3 focus:outline-none focus:border-th-accent"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !url.trim()}
              className="px-4 py-2.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-sm transition-colors flex items-center gap-2"
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
          <TvMinimalPlay size={32} className="text-th-raised mb-3" />
          <p className="text-th-tx3 text-sm mb-1">No channels added yet</p>
          <p className="text-th-tx4 text-xs">Add your own channel, or add competitors to compare.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...channels].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)).map(channel => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              syncStatus={syncStatus}
              onSync={handleSync}
              onFetchStats={handleFetchStats}
              onRemove={handleRemove}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      )}

      {/* Auto-sync note */}
      {channels.length > 0 && (
        <div className="mt-6 bg-th-surface/50 border border-th-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Radio size={12} className="text-th-accent" />
            <span className="text-th-tx1 text-xs font-medium">Auto-sync</span>
          </div>
          <p className="text-th-tx3 text-xs leading-relaxed">
            All channels are checked for new videos every 6 hours. Use "Pick videos" to manually choose what to transcribe and analyse.
          </p>
        </div>
      )}
    </div>
  );
}
