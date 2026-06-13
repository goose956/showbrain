import { useState, useEffect } from 'react';
import {
  Trash2, Shield, User, RefreshCw, AlertCircle, ChevronLeft,
  BarChart2, MessageCircle, Users, Activity, Globe,
  Clock, CheckCircle, Loader2, Send, ChevronDown, ChevronRight,
  TrendingUp, Eye, Smartphone, Key, Eye as EyeIcon, EyeOff, Save,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n) return '0';
  return Number(n).toLocaleString();
}

function timeAgo(iso) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ icon: Icon, iconClass, label, value, sub }) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={iconClass} />
        <span className="text-th-tx3 text-xs">{label}</span>
      </div>
      <p className="text-th-tx1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-th-tx4 text-xs mt-1">{sub}</p>}
    </div>
  );
}

const STATUS_COLOR = {
  open:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  pending: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  closed:  'text-th-tx4 bg-th-raised border-th-border',
};

// ── Members tab ───────────────────────────────────────────────────────────────

function MembersTab({ currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/admin/members');
      if (!res.ok) throw new Error('Failed to load members');
      setMembers(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (member) => {
    if (confirmDelete?.id !== member.id) { setConfirmDelete(member); return; }
    setDeleting(member.id); setConfirmDelete(null);
    try {
      const res = await apiFetch(`/api/admin/members/${member.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-th-tx1 text-sm font-semibold">Members</h2>
        <button onClick={load} className="text-th-tx4 hover:text-th-tx2 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-xs mb-4">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
        </div>
      )}

      <div className="bg-th-surface border border-th-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-th-border flex items-center justify-between">
          <span className="text-th-tx2 text-xs font-medium">All members</span>
          <span className="text-th-tx4 text-xs">{members.length} total</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-th-tx4 text-sm">Loading…</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-th-tx4 text-sm">No members yet.</div>
        ) : (
          <div className="divide-y divide-th-border">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-th-raised flex items-center justify-center shrink-0">
                  {member.role === 'admin' ? <Shield size={14} className="text-th-accent" /> : <User size={14} className="text-th-tx3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-th-tx1 text-sm font-medium">{member.username}</span>
                    {member.username === currentUser && <span className="text-[10px] bg-th-raised text-th-tx3 px-1.5 py-0.5 rounded-full">you</span>}
                    {member.role === 'admin' && <span className="text-[10px] bg-th-accent/10 text-th-accent px-1.5 py-0.5 rounded-full">admin</span>}
                  </div>
                  <div className="text-th-tx4 text-xs">Joined {formatDate(member.createdAt)}</div>
                </div>
                {member.username !== currentUser && (
                  confirmDelete?.id === member.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-th-tx3 text-xs">Sure?</span>
                      <button onClick={() => handleDelete(member)} disabled={!!deleting} className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40">Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1 rounded-lg bg-th-raised text-th-tx2 hover:bg-th-border transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => handleDelete(member)} disabled={!!deleting} className="p-1.5 rounded-lg text-th-tx4 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                      <Trash2 size={14} />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRecent, setShowRecent] = useState(false);
  const [showErrors, setShowErrors] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      setData(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-48 text-th-tx4 text-sm"><Loader2 size={18} className="animate-spin" /></div>;
  if (error) return <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-xs"><AlertCircle size={13} />{error}</div>;
  if (!data) return null;

  const { stats, recent, memberCount, errors = [] } = data;
  const s = stats.summary;

  // Build last-30-day sparkline data
  const dailyMap = {};
  stats.daily.forEach(r => { dailyMap[r.day.slice(0, 10)] = parseInt(r.views); });
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return dailyMap[d.toISOString().slice(0, 10)] || 0;
  });
  const max30 = Math.max(...days30, 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-th-tx1 text-sm font-semibold">Visitor Analytics</h2>
        <button onClick={load} className="text-th-tx4 hover:text-th-tx2 transition-colors"><RefreshCw size={14} /></button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Activity}   iconClass="text-th-accent"   label="Total API calls"  value={fmt(s.total)}       sub="all time" />
        <StatCard icon={Users}      iconClass="text-cyan-400"    label="Unique users"      value={fmt(s.unique_users)} sub="all time" />
        <StatCard icon={TrendingUp} iconClass="text-emerald-400" label="Last 24 hours"     value={fmt(s.last_24h)}    />
        <StatCard icon={Eye}        iconClass="text-violet-400"  label="Last 7 days"       value={fmt(s.last_7d)}     />
      </div>

      {/* 30-day bar chart */}
      <div className="bg-th-surface border border-th-border rounded-xl p-4">
        <p className="text-th-tx2 text-xs font-medium mb-4">API calls — last 30 days</p>
        <div className="flex items-end gap-0.5 h-20">
          {days30.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              <div
                className="w-full bg-th-accent/40 hover:bg-th-accent/70 rounded-sm transition-colors"
                style={{ height: `${Math.max(2, (v / max30) * 100)}%` }}
              />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-th-tx1 bg-th-surface border border-th-border rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {v}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-th-tx4">
          <span>30d ago</span><span>Today</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top endpoints */}
        <div className="bg-th-surface border border-th-border rounded-xl p-4">
          <p className="text-th-tx2 text-xs font-medium mb-3 flex items-center gap-1.5"><Globe size={12} className="text-sky-400" /> Top endpoints (30d)</p>
          <div className="space-y-1.5">
            {stats.topPaths.slice(0, 10).map(p => (
              <div key={p.path} className="flex items-center gap-2">
                <span className="text-th-tx3 text-[11px] font-mono truncate flex-1">{p.path}</span>
                <span className="text-th-tx1 text-[11px] tabular-nums font-medium shrink-0">{fmt(p.count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top users */}
        <div className="bg-th-surface border border-th-border rounded-xl p-4">
          <p className="text-th-tx2 text-xs font-medium mb-3 flex items-center gap-1.5"><Users size={12} className="text-violet-400" /> Most active users (30d)</p>
          <div className="space-y-1.5">
            {stats.topUsers.slice(0, 10).map(u => (
              <div key={u.username} className="flex items-center gap-2">
                <span className="text-th-tx3 text-[11px] truncate flex-1">{u.username}</span>
                <span className="text-th-tx4 text-[11px] tabular-nums">{fmt(u.views)} calls</span>
                <span className="text-th-tx4 text-[10px] shrink-0">{timeAgo(u.last_seen)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API Errors */}
      <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowErrors(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-th-tx2 text-xs font-medium hover:bg-th-raised transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-red-400" />
            API errors
            {errors.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-medium">{errors.length}</span>
            )}
          </span>
          {showErrors ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {showErrors && (
          errors.length === 0
            ? <p className="px-4 py-3 text-th-tx4 text-xs">No errors recorded yet.</p>
            : <div className="divide-y divide-th-border max-h-72 overflow-y-auto">
                {errors.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2">
                    <span className={`text-[10px] font-mono font-bold w-8 shrink-0 ${e.status >= 500 ? 'text-red-400' : 'text-amber-400'}`}>
                      {e.status}
                    </span>
                    <span className={`text-[10px] font-mono font-bold w-10 shrink-0 ${e.method === 'GET' ? 'text-emerald-400' : e.method === 'POST' ? 'text-sky-400' : 'text-amber-400'}`}>
                      {e.method}
                    </span>
                    <span className="text-th-tx3 text-[11px] font-mono truncate flex-1">{e.path}</span>
                    {e.error_msg && <span className="text-red-400 text-[10px] truncate max-w-[160px] shrink-0">{e.error_msg}</span>}
                    <span className="text-th-tx4 text-[11px] shrink-0">{e.username || 'anon'}</span>
                    <span className="text-th-tx4 text-[10px] shrink-0">{timeAgo(e.occurred_at)}</span>
                  </div>
                ))}
              </div>
        )}
      </div>

      {/* Recent activity log */}
      <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRecent(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-th-tx2 text-xs font-medium hover:bg-th-raised transition-colors"
        >
          <span className="flex items-center gap-1.5"><Clock size={12} className="text-amber-400" /> Recent activity (last 200)</span>
          {showRecent ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {showRecent && (
          <div className="divide-y divide-th-border max-h-72 overflow-y-auto">
            {recent.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2">
                <span className={`text-[10px] font-mono font-bold w-12 shrink-0 ${r.method === 'GET' ? 'text-emerald-400' : r.method === 'POST' ? 'text-sky-400' : 'text-amber-400'}`}>
                  {r.method}
                </span>
                <span className="text-th-tx3 text-[11px] font-mono truncate flex-1">{r.path}</span>
                <span className="text-th-tx4 text-[11px] shrink-0">{r.username || 'anon'}</span>
                <span className="text-th-tx4 text-[10px] shrink-0">{timeAgo(r.viewed_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Support tab ───────────────────────────────────────────────────────────────

function SupportTab({ currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/tickets${filter !== 'all' ? `?status=${filter}` : ''}`);
      setTickets(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const loadThread = async (id) => {
    try {
      const res = await apiFetch(`/api/admin/tickets/${id}`);
      setActive(await res.json());
    } catch { /* silent */ }
  };

  useEffect(() => { loadTickets(); }, [filter]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setError('');
    try {
      const res = await apiFetch(`/api/admin/tickets/${activeTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setReply('');
      await loadThread(activeTicket.id);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  const handleStatus = async (status) => {
    try {
      await apiFetch(`/api/admin/tickets/${activeTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setActive(prev => ({ ...prev, status }));
      await loadTickets();
    } catch { /* silent */ }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 h-[560px]">
      {/* Ticket list */}
      <div className="sm:col-span-2 flex flex-col bg-th-surface border border-th-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 p-2 border-b border-th-border shrink-0">
          {['open', 'pending', 'closed', 'all'].map(s => (
            <button
              key={s}
              onClick={() => { setFilter(s); setActive(null); }}
              className={`flex-1 text-[11px] font-medium py-1 rounded-lg transition-colors capitalize ${
                filter === s ? 'bg-th-accent/15 text-th-accent' : 'text-th-tx3 hover:text-th-tx1'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-th-border">
          {loading && <div className="text-center py-6 text-th-tx4 text-xs">Loading…</div>}
          {!loading && tickets.length === 0 && (
            <div className="text-center py-8 text-th-tx4 text-xs">No {filter !== 'all' ? filter : ''} tickets</div>
          )}
          {tickets.map(t => (
            <button
              key={t.id}
              onClick={() => loadThread(t.id)}
              className={`w-full text-left p-3 transition-colors hover:bg-th-raised ${activeTicket?.id === t.id ? 'bg-th-raised' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[t.status]}`}>{t.status}</span>
                <span className="text-th-tx4 text-[10px] ml-auto">{timeAgo(t.updated_at)}</span>
              </div>
              <p className="text-th-tx1 text-xs font-medium leading-snug line-clamp-1">{t.subject}</p>
              <p className="text-th-tx4 text-[11px] mt-0.5">{t.username} · {t.message_count} msg{t.message_count !== '1' ? 's' : ''}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="sm:col-span-3 flex flex-col bg-th-surface border border-th-border rounded-xl overflow-hidden">
        {!activeTicket ? (
          <div className="flex-1 flex items-center justify-center text-th-tx4 text-sm">Select a ticket</div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b border-th-border shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-th-tx1 text-sm font-semibold leading-snug">{activeTicket.subject}</p>
                  <p className="text-th-tx4 text-[11px] mt-0.5">From: {activeTicket.username} · {formatDate(activeTicket.created_at)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeTicket.status !== 'pending' && (
                    <button onClick={() => handleStatus('pending')} className="text-[11px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                      Pending
                    </button>
                  )}
                  {activeTicket.status !== 'closed' && (
                    <button onClick={() => handleStatus('closed')} className="text-[11px] px-2 py-1 rounded-lg bg-th-raised text-th-tx3 border border-th-border hover:text-th-tx1 transition-colors">
                      Close
                    </button>
                  )}
                  {activeTicket.status === 'closed' && (
                    <button onClick={() => handleStatus('open')} className="text-[11px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeTicket.messages?.map(msg => (
                <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.sender_role === 'admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.sender_role === 'admin'
                      ? 'bg-th-accent/10 border border-th-accent/20 text-th-tx1'
                      : 'bg-th-raised border border-th-border text-th-tx1'
                  }`}>
                    <p className={`text-[10px] font-semibold mb-1 ${msg.sender_role === 'admin' ? 'text-th-accent' : 'text-th-tx3'}`}>
                      {msg.sender_role === 'admin' ? 'You (admin)' : msg.sender}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-th-tx4 px-1">{timeAgo(msg.sent_at)}</span>
                </div>
              ))}
            </div>

            {/* Reply */}
            {activeTicket.status !== 'closed' ? (
              <form onSubmit={handleReply} className="border-t border-th-border p-3 flex gap-2 shrink-0">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(e); }}
                  placeholder="Type your reply… (⌘Enter to send)"
                  rows={2}
                  className="flex-1 bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent resize-none"
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="p-2.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg transition-colors self-end"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>
            ) : (
              <div className="border-t border-th-border px-4 py-3 flex items-center gap-2 text-th-tx4 text-xs shrink-0">
                <CheckCircle size={12} className="text-emerald-400" /> Ticket closed
              </div>
            )}
            {error && <p className="text-red-400 text-[11px] px-4 pb-2 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────

// ── API Keys tab ──────────────────────────────────────────────────────────────

const KEY_LABELS = {
  ANTHROPIC_API_KEY:  'Anthropic (Claude)',
  YOUTUBE_API_KEY:    'YouTube Data API',
  DEEPGRAM_API_KEY:   'Deepgram',
  OPENAI_API_KEY:     'OpenAI',
  SUPADATA_API_KEY:   'Supadata',
};

function ApiKeysTab() {
  const [keys, setKeys] = useState([]);
  const [edits, setEdits] = useState({});
  const [show, setShow] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/api/admin/api-keys').then(r => r.json()).then(data => {
      setKeys(data);
      setEdits(Object.fromEntries(data.map(k => [k.name, ''])));
    }).catch(e => setError(e.message));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = Object.fromEntries(
        Object.entries(edits).filter(([, v]) => v !== '')
      );
      await apiFetch('/api/admin/api-keys', { method: 'PUT', body: JSON.stringify(updates), headers: { 'Content-Type': 'application/json' } });
      // Reload to show updated masked values
      const data = await apiFetch('/api/admin/api-keys').then(r => r.json());
      setKeys(data);
      setEdits(Object.fromEntries(data.map(k => [k.name, ''])));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sourceBadge = (source) => {
    if (source === 'db')    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">DB override</span>;
    if (source === 'env')   return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">env var</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">not set</span>;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <div className="bg-th-raised border border-th-border rounded-xl p-4 space-y-1">
        <p className="text-th-tx3 text-xs mb-4">
          Keys saved here override environment variables. Leave a field blank to keep the current value. Set to empty to clear a DB override and fall back to the env var.
        </p>
        {keys.map(k => (
          <div key={k.name} className="py-3 border-b border-th-border last:border-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-th-tx1 text-sm font-medium">{KEY_LABELS[k.name] || k.name}</span>
                {sourceBadge(k.source)}
              </div>
              <span className="text-th-tx4 text-xs font-mono">{k.name}</span>
            </div>
            {k.hasValue && (
              <div className="flex items-center gap-2 mb-1.5 px-3 py-1.5 bg-th-bg border border-th-border rounded-lg">
                <span className="flex-1 text-sm font-mono text-th-tx2 tracking-wider">
                  {show[k.name] ? k.masked : '••••••••••••••••'}
                </span>
                <button
                  onClick={() => setShow(prev => ({ ...prev, [k.name]: !prev[k.name] }))}
                  className="text-th-tx4 hover:text-th-tx2 shrink-0"
                >
                  {show[k.name] ? <EyeOff size={13} /> : <EyeIcon size={13} />}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={k.hasValue ? 'Paste new key to replace…' : 'Not set — paste key here'}
                  value={edits[k.name] || ''}
                  onChange={e => setEdits(prev => ({ ...prev, [k.name]: e.target.value }))}
                  className="w-full bg-th-surface border border-th-border rounded-lg px-3 py-2 text-sm text-th-tx1 placeholder-th-tx4 focus:outline-none focus:ring-1 focus:ring-th-accent font-mono"
                />
              </div>
              {edits[k.name] && (
                <button
                  onClick={() => setEdits(prev => ({ ...prev, [k.name]: '' }))}
                  className="text-th-tx4 hover:text-th-tx2 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || Object.values(edits).every(v => v === '')}
          className="flex items-center gap-2 px-4 py-2 bg-th-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save keys
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-green-400 text-sm">
            <CheckCircle size={13} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'support',   label: 'Support',   icon: MessageCircle },
  { id: 'members',   label: 'Members',   icon: Users },
  { id: 'apikeys',   label: 'API Keys',  icon: Key },
];

export default function Admin({ currentUser, onNavigate }) {
  const [tab, setTab] = useState('analytics');

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => onNavigate('overview')} className="text-th-tx4 hover:text-th-tx2 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-th-accent" />
          <h1 className="text-th-tx1 text-lg font-semibold">Admin Panel</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-th-raised border border-th-border rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === id ? 'bg-th-surface text-th-tx1 shadow-sm' : 'text-th-tx3 hover:text-th-tx1'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'support'   && <SupportTab currentUser={currentUser} />}
      {tab === 'members'   && <MembersTab currentUser={currentUser} />}
      {tab === 'apikeys'   && <ApiKeysTab />}
    </div>
  );
}
