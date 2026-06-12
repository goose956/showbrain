import { useState, useEffect } from 'react';
import {
  MessageSquare, Briefcase, Camera, Mail, Inbox,
  Sparkles, Loader2, Send, Plus,
  FileEdit, Clock, CheckCircle, X, AlertCircle, WifiOff, Link, Copy, Check,
} from 'lucide-react';
import { generateSocialPosts } from '../lib/claude';
import { apiFetch } from '../lib/api';
import { publishPost, getConnectedAccounts } from '../lib/zernio';

// ── constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'twitter', label: 'Twitter / X', icon: MessageSquare, limit: 280, color: 'sky' },
  { id: 'linkedin', label: 'LinkedIn', icon: Briefcase, limit: 3000, color: 'blue' },
  { id: 'instagram', label: 'Instagram', icon: Camera, limit: 2200, color: 'pink' },
  { id: 'newsletter', label: 'Newsletter', icon: Mail, limit: null, color: 'amber' },
];

const STATUSES = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft', icon: FileEdit, color: 'text-th-tx2 bg-th-raised border-th-border' },
  { id: 'queued', label: 'Queued', icon: Clock, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'published', label: 'Published', icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
];

const platformMeta = (id) => PLATFORMS.find((p) => p.id === id);
const statusMeta = (id) => STATUSES.find((s) => s.id === id);

const PLATFORM_HINTS = {
  twitter: 'Max 280 characters. Punchy opener, 1–2 hashtags. Threads welcome.',
  linkedin: 'Professional tone. 3–5 short paragraphs. End with a question or CTA. 3–5 hashtags.',
  instagram: 'Conversational and visual. Use line breaks. 5–10 hashtags. CTA to link in bio.',
  newsletter: 'Conversational, like writing to a friend. 3–4 sentences. Clear listen CTA.',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = statusMeta(status);
  if (!meta || meta.id === 'all') return null;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

function PlatformIcon({ platform, size = 13 }) {
  const meta = platformMeta(platform);
  const Icon = meta?.icon;
  if (!Icon) return null;
  const colorMap = { sky: 'text-sky-400', blue: 'text-blue-400', pink: 'text-pink-400', amber: 'text-amber-400' };
  return <Icon size={size} className={colorMap[meta.color] || 'text-th-tx2'} />;
}

function charCount(platform, content) {
  const meta = platformMeta(platform);
  if (!meta?.limit) return null;
  return { count: content.length, limit: meta.limit, over: content.length > meta.limit };
}

// ── generate modal ────────────────────────────────────────────────────────────

function GenerateModal({ episodes, onGenerated, onClose }) {
  const [episodeId, setEpisodeId] = useState('');
  const [platforms, setPlatforms] = useState(['twitter', 'linkedin']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id) =>
    setPlatforms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleGenerate = async () => {
    const ep = episodes.find((e) => e.id === episodeId);
    if (!ep || !platforms.length) return;
    setLoading(true);
    setError('');
    try {
      const generated = await generateSocialPosts(ep, platforms);
      const newPosts = platforms
        .filter((pl) => generated[pl])
        .map((pl) => ({
          id: `post-${Date.now()}-${pl}`,
          episodeId: ep.id,
          episodeTitle: ep.title,
          episodeUrl: ep.youtubeUrl || null,
          platform: pl,
          content: generated[pl],
          status: 'draft',
          createdAt: new Date().toISOString().split('T')[0],
          scheduledFor: null,
        }));
      onGenerated(newPosts);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-th-surface border border-th-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-th-tx1 font-semibold">Generate posts with AI</h2>
          <button onClick={onClose} className="text-th-tx3 hover:text-th-tx1 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-th-tx3 font-medium mb-1.5 block">Episode</label>
            <select
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              className="w-full bg-th-raised border border-th-border rounded-lg px-3 py-2.5 text-th-tx1 text-sm focus:outline-none focus:border-th-accent"
            >
              <option value="">Select an episode…</option>
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>{ep.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-th-tx3 font-medium mb-1.5 block">Platforms</label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.filter((p) => p.id !== 'all').map(({ id, label, icon: Icon, color }) => {
                const active = platforms.includes(id);
                const colorMap = { sky: 'border-sky-500/50 bg-sky-500/10 text-sky-300', blue: 'border-blue-500/50 bg-blue-500/10 text-blue-300', pink: 'border-pink-500/50 bg-pink-500/10 text-pink-300', amber: 'border-amber-500/50 bg-amber-500/10 text-amber-300' };
                return (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${active ? (colorMap[color] || 'border-th-accent/50 bg-th-accent/10 text-th-tx1') : 'border-th-border text-th-tx3 hover:text-th-tx1 hover:border-th-accent/30'}`}
                  >
                    {Icon && <Icon size={13} />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!episodeId || !platforms.length || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-sm transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Generating…' : `Generate ${platforms.length} post${platforms.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── editor panel ──────────────────────────────────────────────────────────────

async function generateTrackingLink(post) {
  const params = new URLSearchParams({
    platform: post.platform || '',
    episodeId: post.episodeId || '',
    episodeTitle: post.episodeTitle || '',
    url: encodeURIComponent(post.episodeUrl || ''),
  });
  const res = await apiFetch(`/api/tracking-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId: post.id, platform: post.platform, episodeId: post.episodeId, episodeTitle: post.episodeTitle, youtubeUrl: post.episodeUrl }),
  });
  const data = await res.json();
  // Embed metadata as query string so the redirect endpoint can log it without a DB lookup
  return `${data.trackingUrl}?${params.toString()}`;
}

function Editor({ post, accounts, onUpdate, onClose }) {
  const [content, setContent] = useState(post.content);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [trackingLink, setTrackingLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const cc = charCount(post.platform, content);
  const isDirty = content !== post.content;

  const save = (updates = {}) => onUpdate({ ...post, content, ...updates });

  const promote = async () => {
    if (post.status === 'draft') {
      save({ status: 'queued' });
      return;
    }
    if (post.status === 'queued') {
      // Actually publish via Zernio
      setPublishing(true);
      setPublishError('');
      try {
        const account = accounts.find((a) => a.platform === post.platform);
        await publishPost({
          platform: post.platform,
          content,
          accountId: account?._id,
        });
        save({ status: 'published' });
      } catch (e) {
        setPublishError(e.message);
      } finally {
        setPublishing(false);
      }
    }
  };

  const demote = () => {
    setPublishError('');
    if (post.status === 'queued') save({ status: 'draft' });
    else if (post.status === 'published') save({ status: 'queued' });
  };

  const promoteLabel = post.status === 'draft' ? 'Move to Queue' : post.status === 'queued' ? 'Publish Now' : null;
  const demoteLabel = post.status === 'queued' ? 'Back to Draft' : post.status === 'published' ? 'Back to Queue' : null;

  const hint = PLATFORM_HINTS[post.platform];
  const accountConnected = accounts.find((a) => a.platform === post.platform);
  const noAccountWarning = post.status === 'queued' && !accountConnected && accounts.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-th-border shrink-0">
        <div className="flex items-center gap-2.5">
          <PlatformIcon platform={post.platform} size={15} />
          <span className="text-th-tx1 text-sm font-medium">
            {post.platform === 'twitter' ? 'Twitter / X' : post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
          </span>
          <StatusBadge status={post.status} />
        </div>
        <button onClick={onClose} className="text-th-tx4 hover:text-th-tx1 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Episode source */}
      <div className="px-5 py-3 border-b border-th-border shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-th-tx4 text-[11px]">From episode</p>
            <p className="text-th-tx2 text-xs truncate">{post.episodeTitle}</p>
          </div>
          {post.episodeUrl && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setContent((c) => c.trimEnd() + '\n\n' + post.episodeUrl)}
                title="Insert raw video link"
                className="flex items-center gap-1.5 text-[11px] text-th-tx3 hover:text-th-accent bg-th-raised hover:bg-th-accent/10 border border-th-border hover:border-th-accent/30 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Link size={11} />
                Insert link
              </button>
              {trackingLink ? (
                <button
                  onClick={() => { navigator.clipboard.writeText(trackingLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="flex items-center gap-1.5 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 px-2.5 py-1.5 rounded-lg transition-colors"
                  title="Copy tracking link"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy tracked'}
                </button>
              ) : (
                <button
                  onClick={async () => { setTrackingLoading(true); try { const l = await generateTrackingLink(post); setTrackingLink(l); } catch {} finally { setTrackingLoading(false); } }}
                  disabled={trackingLoading}
                  className="flex items-center gap-1.5 text-[11px] text-th-tx3 hover:text-emerald-300 bg-th-raised hover:bg-emerald-500/10 border border-th-border hover:border-emerald-500/30 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  title="Generate tracking link"
                >
                  {trackingLoading ? <Loader2 size={10} className="animate-spin" /> : <Link size={11} />}
                  Track link
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Textarea */}
      <div className="flex-1 flex flex-col px-5 py-4 min-h-0">
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setPublishError(''); }}
          className="flex-1 w-full bg-th-raised/50 border border-th-border rounded-xl p-4 text-th-tx1 text-sm leading-relaxed resize-none focus:outline-none focus:border-th-accent transition-colors"
          placeholder="Post copy…"
        />

        {cc && (
          <div className={`flex justify-end mt-2 text-xs tabular-nums ${cc.over ? 'text-red-400' : 'text-th-tx4'}`}>
            {cc.count} / {cc.limit}
          </div>
        )}

        {hint && (
          <p className="text-th-tx4 text-xs mt-3 leading-relaxed border-t border-th-border pt-3">{hint}</p>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-th-border space-y-2 shrink-0">
        {noAccountWarning && (
          <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
            <WifiOff size={12} className="shrink-0 mt-0.5" />
            No {post.platform} account connected in Zernio. Connect one in your Zernio dashboard first.
          </div>
        )}
        {publishError && (
          <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            {publishError}
          </div>
        )}
        {isDirty && (
          <button
            onClick={() => save()}
            className="w-full py-2 rounded-lg bg-th-raised hover:bg-th-border border border-th-border text-th-tx1 text-sm transition-colors"
          >
            Save changes
          </button>
        )}
        <div className="flex gap-2">
          {demoteLabel && (
            <button
              onClick={demote}
              className="flex-1 py-2 rounded-lg border border-th-border text-th-tx2 hover:text-th-tx1 hover:border-th-border text-sm transition-colors"
            >
              {demoteLabel}
            </button>
          )}
          {promoteLabel && (
            <button
              onClick={promote}
              disabled={publishing}
              className={`flex-1 py-2 rounded-lg text-th-tx1 text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                post.status === 'queued' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-th-accent hover:bg-th-accentH'
              }`}
            >
              {publishing ? <Loader2 size={13} className="animate-spin" /> : post.status === 'queued' ? <Send size={13} /> : <Clock size={13} />}
              {publishing ? 'Publishing…' : promoteLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function PostQueue({ posts, onPostsUpdate, episodes }) {
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [accounts, setAccounts] = useState([]);

  // Load connected Zernio accounts once on mount
  useEffect(() => {
    getConnectedAccounts().then(setAccounts).catch(() => {});
  }, []);

  const handleUpdate = (updated) =>
    onPostsUpdate(posts.map((p) => (p.id === updated.id ? updated : p)));

  const handleDelete = (id) => {
    onPostsUpdate(posts.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleGenerated = (newPosts) => {
    onPostsUpdate([...posts, ...newPosts]);
    setShowGenerate(false);
    if (newPosts.length > 0) setSelectedId(newPosts[0].id);
  };

  // filter
  const filtered = posts.filter((p) => {
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const selected = posts.find((p) => p.id === selectedId) || null;

  // status counts
  const counts = {};
  STATUSES.slice(1).forEach(({ id }) => {
    counts[id] = posts.filter((p) => p.status === id).length;
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col w-80 shrink-0 border-r border-th-border overflow-hidden">
        {/* Top bar */}
        <div className="px-4 pt-4 pb-3 border-b border-th-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-th-tx1 font-semibold text-sm">Post Queue</h1>
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-1.5 text-xs text-th-accent hover:text-th-tx1 bg-th-accent/10 hover:bg-th-accent/20 border border-th-accent/30 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} />
              Generate
            </button>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1">
            {STATUSES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                  statusFilter === id ? 'bg-th-border text-th-tx1' : 'text-th-tx3 hover:text-th-tx1'
                }`}
              >
                {label}
                {id !== 'all' && counts[id] > 0 && (
                  <span className="ml-1 text-th-tx3">{counts[id]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Platform filter */}
        <div className="flex gap-1 px-3 py-2 border-b border-th-border overflow-x-auto shrink-0">
          {PLATFORMS.map(({ id, label, icon: Icon, color }) => {
            const active = platformFilter === id;
            const colorMap = { sky: 'text-sky-400', blue: 'text-blue-400', pink: 'text-pink-400', amber: 'text-amber-400' };
            return (
              <button
                key={id}
                onClick={() => setPlatformFilter(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors shrink-0 ${
                  active ? 'bg-th-border text-th-tx1' : 'text-th-tx3 hover:text-th-tx1'
                }`}
              >
                {Icon && <Icon size={11} className={active ? 'text-current' : colorMap[color]} />}
                {id === 'all' ? 'All' : id === 'twitter' ? 'X' : id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Post list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-th-tx4 text-xs text-center px-6">
              <Inbox size={22} className="mb-2 opacity-40" />
              No posts match the current filters.
            </div>
          )}
          {filtered.map((post) => {
            const isSelected = selectedId === post.id;
            return (
              <button
                key={post.id}
                onClick={() => setSelectedId(isSelected ? null : post.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-th-border/60 transition-colors ${
                  isSelected ? 'bg-th-accent/10 border-l-2 border-l-th-accent' : 'hover:bg-th-surface/60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <PlatformIcon platform={post.platform} size={12} />
                  <span className="text-th-tx3 text-[11px] capitalize">
                    {post.platform === 'twitter' ? 'Twitter / X' : post.platform}
                  </span>
                  <div className="ml-auto">
                    <StatusBadge status={post.status} />
                  </div>
                </div>
                <p className="text-th-tx1 text-xs leading-relaxed line-clamp-2 mb-1.5">
                  {post.content}
                </p>
                <p className="text-th-tx4 text-[11px] truncate">{post.episodeTitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel — editor */}
      <div className="flex-1 overflow-hidden bg-th-bg">
        {selected ? (
          <Editor
            key={selected.id}
            post={selected}
            accounts={accounts}
            onUpdate={handleUpdate}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileEdit size={32} className="text-th-raised mb-3" />
            <p className="text-th-tx4 text-sm mb-1">Select a post to edit</p>
            <p className="text-th-tx4 text-xs">or generate new posts from an episode</p>
            <button
              onClick={() => setShowGenerate(true)}
              className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent/10 hover:bg-th-accent/20 border border-th-accent/30 text-th-accent hover:text-th-tx1 text-sm transition-colors"
            >
              <Sparkles size={14} />
              Generate posts
            </button>
          </div>
        )}
      </div>

      {showGenerate && (
        <GenerateModal
          episodes={episodes}
          onGenerated={handleGenerated}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </div>
  );
}
