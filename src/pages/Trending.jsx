import { useState, useEffect, useCallback } from 'react';
import {
  Zap, RefreshCw, Loader2, Plus, X, ExternalLink, PenLine,
  Rss, PlayCircle, Users, AlertCircle, Clock, TrendingUp, Settings,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

function timeAgo(hoursAgo) {
  if (!hoursAgo && hoursAgo !== 0) return '';
  if (hoursAgo < 1) return 'just now';
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  return `${Math.floor(hoursAgo / 24)}d ago`;
}

function fmtViews(n) {
  if (!n) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function velLabel(v) {
  if (!v) return null;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k/hr`;
  return `${v}/hr`;
}

// ── Config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ config, onSave, onClose }) {
  const [keywords, setKeywords] = useState(config.keywords || []);
  const [feeds, setFeeds]       = useState(config.feeds || []);
  const [kwInput, setKwInput]   = useState('');
  const [feedUrl, setFeedUrl]   = useState('');
  const [feedLabel, setFeedLabel] = useState('');
  const [saving, setSaving]     = useState(false);

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw]);
    setKwInput('');
  };

  const addFeed = () => {
    const url = feedUrl.trim();
    if (!url) return;
    setFeeds(prev => [...prev, { url, label: feedLabel.trim() || url }]);
    setFeedUrl('');
    setFeedLabel('');
  };

  const save = async () => {
    setSaving(true);
    await onSave({ keywords, feeds });
    setSaving(false);
    onClose();
  };

  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-th-tx1 text-sm font-semibold flex items-center gap-2"><Settings size={14} /> Configure your niche</h3>
        <button onClick={onClose} className="text-th-tx4 hover:text-th-tx1 transition-colors"><X size={14} /></button>
      </div>

      {/* Keywords */}
      <div className="mb-4">
        <label className="text-th-tx3 text-xs font-medium block mb-2">Niche keywords — used to search YouTube for trending videos</label>
        <div className="flex gap-2 mb-2">
          <input
            value={kwInput}
            onChange={e => setKwInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="e.g. AI agents, Claude AI, LLM tools"
            className="flex-1 bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
          />
          <button onClick={addKeyword} className="px-3 py-2 rounded-lg bg-th-accent hover:bg-th-accentH text-th-accentFg text-xs transition-colors">
            <Plus size={12} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {keywords.map(kw => (
            <span key={kw} className="flex items-center gap-1 text-xs bg-th-raised border border-th-border text-th-tx2 px-2.5 py-1 rounded-full">
              {kw}
              <button onClick={() => setKeywords(k => k.filter(x => x !== kw))} className="text-th-tx4 hover:text-red-400 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* RSS Feeds */}
      <div className="mb-4">
        <label className="text-th-tx3 text-xs font-medium block mb-2">RSS feeds — industry news sources for your niche</label>
        <div className="flex gap-2 mb-2">
          <input
            value={feedLabel}
            onChange={e => setFeedLabel(e.target.value)}
            placeholder="Label (e.g. OpenAI Blog)"
            className="w-36 bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
          />
          <input
            value={feedUrl}
            onChange={e => setFeedUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addFeed()}
            placeholder="https://openai.com/blog/rss.xml"
            className="flex-1 bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
          />
          <button onClick={addFeed} className="px-3 py-2 rounded-lg bg-th-accent hover:bg-th-accentH text-th-accentFg text-xs transition-colors">
            <Plus size={12} />
          </button>
        </div>
        <div className="space-y-1">
          {feeds.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-th-raised border border-th-border rounded-lg px-3 py-1.5">
              <Rss size={10} className="text-orange-400 shrink-0" />
              <span className="text-th-tx2 font-medium shrink-0">{f.label}</span>
              <span className="text-th-tx4 truncate flex-1">{f.url}</span>
              <button onClick={() => setFeeds(prev => prev.filter((_, j) => j !== i))} className="text-th-tx4 hover:text-red-400 transition-colors shrink-0">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-xs transition-colors">
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          Save & refresh
        </button>
      </div>
    </div>
  );
}

// ── Video card ────────────────────────────────────────────────────────────────

function VideoCard({ video, onMakeVideo, source }) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden hover:border-th-accent/30 transition-colors flex flex-col">
      {video.thumbnail && (
        <div className="relative">
          <img src={video.thumbnail} alt="" className="w-full aspect-video object-cover" />
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-medium bg-black/70 text-white px-2 py-0.5 rounded-full">{source}</span>
          </div>
          {video.hoursAgo !== undefined && (
            <div className="absolute top-2 right-2">
              <span className="text-[10px] font-medium bg-black/70 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <Clock size={8} />{timeAgo(video.hoursAgo)}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-th-tx1 text-xs font-medium leading-snug line-clamp-2 mb-2">{video.title}</p>
        <div className="flex items-center gap-2 text-th-tx4 text-[11px] mb-3">
          <span className="truncate">{video.channelName}</span>
          {video.viewCount > 0 && (
            <>
              <span>·</span>
              <span className="tabular-nums shrink-0">{fmtViews(video.viewCount)} views</span>
            </>
          )}
          {video.velocity > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-400 shrink-0 tabular-nums">
              <TrendingUp size={9} />{velLabel(video.velocity)}
            </span>
          )}
        </div>
        <div className="flex gap-2 mt-auto">
          <button
            onClick={() => onMakeVideo(video.title)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-th-accent/10 hover:bg-th-accent/20 border border-th-accent/20 hover:border-th-accent/40 text-th-accent text-[11px] font-medium transition-colors"
          >
            <PenLine size={10} /> Make this video
          </button>
          <a href={video.youtubeUrl} target="_blank" rel="noreferrer"
            className="p-1.5 rounded-lg border border-th-border text-th-tx4 hover:text-th-tx1 hover:border-th-border/80 transition-colors">
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── RSS item ──────────────────────────────────────────────────────────────────

function RssCard({ item, onMakeVideo }) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4 hover:border-th-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] text-th-tx4">
          <Rss size={9} className="text-orange-400 shrink-0" />
          <span>{item.source}</span>
          {item.pubDate && (
            <><span>·</span><span>{new Date(item.pubDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></>
          )}
        </div>
        <a href={item.link} target="_blank" rel="noreferrer" className="text-th-tx4 hover:text-th-tx1 shrink-0 transition-colors">
          <ExternalLink size={11} />
        </a>
      </div>
      <p className="text-th-tx1 text-xs font-medium leading-snug mb-1.5">{item.title}</p>
      {item.description && (
        <p className="text-th-tx3 text-[11px] leading-relaxed line-clamp-2 mb-3">{item.description}</p>
      )}
      <button
        onClick={() => onMakeVideo(item.title)}
        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-th-accent/10 hover:bg-th-accent/20 border border-th-accent/20 hover:border-th-accent/40 text-th-accent text-[11px] font-medium transition-colors"
      >
        <PenLine size={10} /> Make this video
      </button>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, iconClass, title, count, empty }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className={iconClass} />
      <h2 className="text-th-tx1 text-sm font-semibold">{title}</h2>
      {count > 0 && <span className="text-th-tx4 text-xs">{count}</span>}
      {empty && <span className="text-th-tx4 text-xs">{empty}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Trending({ channels = [], onWriteScript }) {
  const [data, setData]           = useState(null);
  const [config, setConfig]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError]         = useState('');

  const compareChannels = channels.filter(c => c.compareOnly);

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/api/trending/config');
      const cfg = await res.json();
      setConfig(cfg);
      return cfg;
    } catch { return { keywords: [], feeds: [] }; }
  }, []);

  const fetchFeed = useCallback(async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/trending${refresh ? '?refresh=1' : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      setFetchedAt(json.fetchedAt);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig().then(cfg => {
      if (cfg.keywords?.length || cfg.feeds?.length || compareChannels.length) {
        fetchFeed();
      } else {
        setShowConfig(true);
      }
    });
  }, []);

  const handleSaveConfig = async (newConfig) => {
    await apiFetch('/api/trending/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    setConfig(newConfig);
    await fetchFeed(true);
  };

  const handleMakeVideo = (title) => {
    onWriteScript?.({ title, brief: `Cover this trending topic: ${title}` });
  };

  const hasContent = data && (
    data.competitorVideos?.length || data.rssItems?.length || data.youtubeVideos?.length
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-th-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg flex items-center gap-2">
              <Zap size={17} className="text-yellow-400" />
              Trending
            </h1>
            <p className="text-th-tx3 text-xs mt-0.5">
              What's blowing up in your niche right now — competitor moves, industry news, and fast-rising videos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {fetchedAt && !loading && (
              <span className="text-th-tx4 text-[11px]">
                Updated {new Date(fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => setShowConfig(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
                showConfig ? 'border-th-accent/50 bg-th-accent/10 text-th-accent' : 'border-th-border text-th-tx3 hover:text-th-tx1'
              }`}
            >
              <Settings size={12} /> Configure
            </button>
            <button
              onClick={() => fetchFeed(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-xs transition-colors"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {showConfig && config && (
          <ConfigPanel config={config} onSave={handleSaveConfig} onClose={() => setShowConfig(false)} />
        )}

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
          </div>
        )}

        {/* Per-section errors from the backend (e.g. YouTube quota exceeded) */}
        {data?.errors?.length > 0 && (
          <div className="mb-5 space-y-2">
            {data.errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />{e}
              </div>
            ))}
          </div>
        )}

        {loading && !data && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 size={24} className="text-th-accent animate-spin" />
            <p className="text-th-tx3 text-sm">Scanning your niche…</p>
          </div>
        )}

        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Zap size={32} className="text-th-raised mb-3" />
            <p className="text-th-tx3 text-sm mb-1">Nothing loaded yet</p>
            <p className="text-th-tx4 text-xs max-w-xs">Configure your niche keywords and RSS feeds, then hit Refresh to see what's trending.</p>
          </div>
        )}

        {hasContent && (
          <div className="space-y-8">
            {/* Competitor activity */}
            {(data.competitorVideos?.length > 0 || compareChannels.length > 0) && (
              <div>
                <SectionHeader
                  icon={Users} iconClass="text-cyan-400"
                  title="Competitor activity"
                  count={data.competitorVideos?.length}
                  empty={data.competitorVideos?.length === 0 ? '— no new videos in the last 14 days' : null}
                />
                {data.competitorVideos?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.competitorVideos.map(v => (
                      <VideoCard key={v.videoId} video={v} source={v.channelName} onMakeVideo={handleMakeVideo} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* YouTube trending */}
            {data.youtubeVideos?.length > 0 && (
              <div>
                <SectionHeader icon={PlayCircle} iconClass="text-red-400" title="Trending in your niche" count={data.youtubeVideos.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {data.youtubeVideos.map(v => (
                    <VideoCard key={v.videoId} video={v} source="YouTube" onMakeVideo={handleMakeVideo} />
                  ))}
                </div>
              </div>
            )}

            {/* RSS news */}
            {data.rssItems?.length > 0 && (
              <div>
                <SectionHeader icon={Rss} iconClass="text-orange-400" title="Industry news" count={data.rssItems.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.rssItems.map((item, i) => (
                    <RssCard key={i} item={item} onMakeVideo={handleMakeVideo} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
