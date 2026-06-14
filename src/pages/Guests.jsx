import { useState, useEffect } from 'react';
import {
  Users, Plus, X, Loader2, Sparkles, ChevronRight, Trash2,
  AlertCircle, ExternalLink, Mail, FileText, HelpCircle, CheckCircle,
  ArrowRight, Copy, Check,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

const STATUSES = [
  { id: 'research',  label: 'Research',  color: 'bg-violet-500', light: 'bg-violet-500/10 border-violet-500/25 text-violet-300' },
  { id: 'outreach',  label: 'Outreach',  color: 'bg-amber-500',  light: 'bg-amber-500/10 border-amber-500/25 text-amber-300' },
  { id: 'confirmed', label: 'Confirmed', color: 'bg-emerald-500',light: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' },
  { id: 'done',      label: 'Done',      color: 'bg-th-raised',  light: 'bg-th-raised border-th-border text-th-tx3' },
];

function statusMeta(id) {
  return STATUSES.find(s => s.id === id) || STATUSES[0];
}

// ── Add guest form ─────────────────────────────────────────────────────────────

function AddGuestForm({ onAdded, onCancel }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim() || null, email: email.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onAdded(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-th-surface border border-th-border rounded-xl p-4 space-y-3">
      <p className="text-th-tx1 text-sm font-medium">Add guest</p>
      <div>
        <label className="text-th-tx3 text-[11px] font-medium block mb-1">Name *</label>
        <input
          value={name} onChange={e => setName(e.target.value)} autoFocus
          placeholder="e.g. Tim Ferriss"
          className="w-full bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
        />
      </div>
      <div>
        <label className="text-th-tx3 text-[11px] font-medium block mb-1">Website / LinkedIn</label>
        <input
          value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
        />
      </div>
      <div>
        <label className="text-th-tx3 text-[11px] font-medium block mb-1">Email (optional)</label>
        <input
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="guest@example.com"
          className="w-full bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
        />
      </div>
      {error && <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit" disabled={loading || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-xs font-medium transition-colors"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          {loading ? 'Adding…' : 'Add guest'}
        </button>
        <button type="button" onClick={onCancel} className="text-th-tx4 hover:text-th-tx2 text-xs transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ── Guest card ─────────────────────────────────────────────────────────────────

function GuestCard({ guest, active, onClick, onDelete }) {
  const st = statusMeta(guest.status);
  return (
    <div className={`rounded-xl border transition-all ${active ? 'border-th-accent bg-th-accent/5' : 'border-th-border bg-th-surface hover:border-th-border/60 hover:bg-th-raised/30'}`}>
      <button onClick={onClick} className="w-full text-left p-3.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-th-tx1 text-xs font-semibold leading-snug">{guest.name}</p>
        <ChevronRight size={12} className="text-th-tx4 shrink-0 mt-0.5" />
      </div>
      {guest.bio && (
        <p className="text-th-tx4 text-[11px] leading-relaxed line-clamp-2 mb-2">{guest.bio}</p>
      )}
      {guest.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {guest.topics.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[10px] bg-th-raised border border-th-border text-th-tx3 px-1.5 py-0.5 rounded-full">{t}</span>
          ))}
          {guest.topics.length > 3 && (
            <span className="text-[10px] text-th-tx4">+{guest.topics.length - 3}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${st.light}`}>{st.label}</span>
        {guest.questions?.length > 0 && (
          <span className="text-[10px] text-th-tx4">{guest.questions.length} questions</span>
        )}
        {guest.outreach && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Mail size={9} /> draft ready</span>
        )}
      </div>
      </button>
      <div className="flex justify-end px-3 pb-2">
        <button
          onClick={e => { e.stopPropagation(); if (confirm(`Delete ${guest.name}?`)) onDelete(guest.id); }}
          className="flex items-center gap-1 text-[11px] text-th-tx4 hover:text-red-400 transition-colors"
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handle} className={`flex items-center gap-1 text-[11px] transition-colors ${copied ? 'text-emerald-400' : 'text-th-tx4 hover:text-th-tx2'} ${className}`}>
      {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
    </button>
  );
}

// ── Guest detail panel ─────────────────────────────────────────────────────────

function GuestPanel({ guest, channels, episodes, onUpdate, onDelete, onClose }) {
  const [tab, setTab] = useState('research');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [editNotes, setEditNotes] = useState(guest.notes || '');
  const [editEmail, setEditEmail] = useState(guest.email || '');
  const [savingMeta, setSavingMeta] = useState(false);

  // Keep local state in sync when guest prop changes
  useEffect(() => {
    setEditNotes(guest.notes || '');
    setEditEmail(guest.email || '');
    setError('');
  }, [guest.id]);

  const primary = channels?.find(c => c.isPrimary) || channels?.find(c => !c.compareOnly) || channels?.[0];
  const showName = primary?.name || '';
  const showTopics = [...new Set(episodes?.flatMap(e => e.topics || []))].slice(0, 10);

  const aiCall = async (endpoint, extra = {}) => {
    setLoading(endpoint); setError('');
    try {
      const res = await apiFetch(`/api/guests/${guest.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showName, showTopics, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onUpdate(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(''); }
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      const res = await apiFetch(`/api/guests/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...guest, notes: editNotes, email: editEmail }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onUpdate(await res.json());
    } catch (e) { setError(e.message); }
    finally { setSavingMeta(false); }
  };

  const setStatus = async (status) => {
    try {
      const res = await apiFetch(`/api/guests/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...guest, status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onUpdate(await res.json());
    } catch (e) { setError(e.message); }
  };

  const st = statusMeta(guest.status);

  const mailtoLink = guest.email && guest.outreach
    ? `mailto:${guest.email}?subject=${encodeURIComponent(`Podcast invitation — ${showName || 'our show'}`)}&body=${encodeURIComponent(guest.outreach)}`
    : null;

  return (
    <div className="flex flex-col h-full border-l border-th-border bg-th-surface">

      {/* Header */}
      <div className="px-5 py-4 border-b border-th-border shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-th-tx1 font-semibold text-base leading-tight">{guest.name}</h2>
            {guest.url && (
              <a href={guest.url} target="_blank" rel="noreferrer" className="text-th-accent text-xs flex items-center gap-1 mt-0.5 hover:underline">
                <ExternalLink size={10} /> {guest.url.replace(/^https?:\/\//, '').slice(0, 40)}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { if (confirm(`Delete ${guest.name}?`)) onDelete(guest.id); }}
              className="p-1.5 text-th-tx4 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} className="p-1.5 text-th-tx4 hover:text-th-tx1 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Status selector */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                guest.status === s.id ? s.light : 'border-th-border text-th-tx4 hover:text-th-tx2'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step indicator */}
      <div className="px-5 py-2.5 border-b border-th-border bg-th-raised/30 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px]">
          {[
            { step: 1, label: 'Research', done: !!guest.bio },
            { step: 2, label: 'Questions', done: guest.questions?.length > 0 },
            { step: 3, label: 'Outreach', done: !!guest.outreach },
          ].map(({ step, label, done }, i, arr) => (
            <span key={step} className="flex items-center gap-1.5">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-th-raised border border-th-border text-th-tx4'}`}>
                {done ? '✓' : step}
              </span>
              <span className={done ? 'text-th-tx2' : 'text-th-tx4'}>{label}</span>
              {i < arr.length - 1 && <span className="text-th-tx4 mx-0.5">→</span>}
            </span>
          ))}
          {!guest.bio && (
            <span className="ml-2 text-amber-400 text-[10px]">← Start here</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-th-border shrink-0">
        {[
          { id: 'research',  label: 'Research',  icon: HelpCircle },
          { id: 'questions', label: 'Questions',  icon: FileText },
          { id: 'outreach',  label: 'Outreach',  icon: Mail },
          { id: 'notes',     label: 'Notes',     icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setError(''); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-th-accent text-th-accent'
                : 'border-transparent text-th-tx3 hover:text-th-tx1'
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs">{error}</p>
          </div>
        )}

        {/* ── Research tab ── */}
        {tab === 'research' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-th-tx3 text-xs">Bio and topic angles for the show.</p>
              <button
                onClick={() => aiCall('research')}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-xs font-medium transition-colors shrink-0"
              >
                {loading === 'research' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {guest.bio ? 'Re-research' : 'Research guest'}
              </button>
            </div>

            {!guest.bio && !loading && (
              <div className="text-center py-10 text-th-tx4 text-xs">
                {guest.url
                  ? 'Click "Research guest" — AI will pull their bio and suggest topic angles from their website.'
                  : 'Add a website URL to the guest, then click "Research guest".'}
              </div>
            )}

            {loading === 'research' && (
              <div className="flex items-center gap-2 text-th-tx4 text-xs py-4">
                <Loader2 size={13} className="animate-spin text-th-accent" />
                Fetching page and researching…
              </div>
            )}

            {guest.bio && (
              <div className="bg-th-raised border border-th-border rounded-xl p-4">
                <p className="text-th-tx3 text-[10px] font-medium uppercase tracking-wider mb-2">Bio</p>
                <p className="text-th-tx2 text-xs leading-relaxed">{guest.bio}</p>
              </div>
            )}

            {guest.topics?.length > 0 && (
              <div>
                <p className="text-th-tx3 text-[10px] font-medium uppercase tracking-wider mb-2">Topic angles</p>
                <div className="space-y-1.5">
                  {guest.topics.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 bg-th-raised border border-th-border rounded-lg px-3 py-2">
                      <span className="w-4 h-4 rounded-full bg-th-accent/20 text-th-accent text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-th-tx2 text-xs">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="text-th-tx3 text-[10px] font-medium uppercase tracking-wider block mb-1.5">Email</label>
              <div className="flex gap-2">
                <input
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="flex-1 bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
                />
                <button
                  onClick={saveMeta}
                  disabled={savingMeta}
                  className="px-3 py-1.5 rounded-lg bg-th-raised border border-th-border text-th-tx2 hover:text-th-tx1 text-xs transition-colors disabled:opacity-40"
                >
                  {savingMeta ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Questions tab ── */}
        {tab === 'questions' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-th-tx3 text-xs">Tailored interview questions based on their background.</p>
              <button
                onClick={() => aiCall('questions')}
                disabled={!!loading || !guest.bio}
                title={!guest.bio ? 'Research the guest first' : ''}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-xs font-medium transition-colors shrink-0"
              >
                {loading === 'questions' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {guest.questions?.length ? 'Regenerate' : 'Generate questions'}
              </button>
            </div>

            {!guest.bio && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                Research the guest first so the AI can tailor questions to their background.
              </div>
            )}

            {loading === 'questions' && (
              <div className="flex items-center gap-2 text-th-tx4 text-xs py-4">
                <Loader2 size={13} className="animate-spin text-th-accent" />
                Generating questions…
              </div>
            )}

            {!guest.questions?.length && !loading && guest.bio && (
              <div className="text-center py-10 text-th-tx4 text-xs">
                Click "Generate questions" to get 10 tailored interview questions.
              </div>
            )}

            {guest.questions?.length > 0 && (
              <div className="space-y-2">
                {guest.questions.map((q, i) => (
                  <div key={i} className="bg-th-raised border border-th-border rounded-xl p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-th-accent/20 text-th-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <div className="min-w-0">
                        {q.category && (
                          <p className="text-th-tx4 text-[10px] font-medium uppercase tracking-wider mb-0.5">{q.category}</p>
                        )}
                        <p className="text-th-tx2 text-xs leading-relaxed">{q.question || q}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <CopyButton
                  text={guest.questions.map((q, i) => `${i + 1}. ${q.question || q}`).join('\n')}
                  className="mt-2"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Outreach tab ── */}
        {tab === 'outreach' && (
          <div className="space-y-5">
            {!guest.bio && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>Complete the <button onClick={() => setTab('research')} className="underline hover:text-amber-200">Research tab</button> first — the AI needs their bio to write a personalised email.</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-th-tx3 text-xs">AI-drafted outreach email ready to send.</p>
              <button
                onClick={() => aiCall('outreach')}
                disabled={!!loading || !guest.bio}
                title={!guest.bio ? 'Research the guest first' : ''}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-xs font-medium transition-colors shrink-0"
              >
                {loading === 'outreach' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {guest.outreach ? 'Redraft' : 'Draft email'}
              </button>
            </div>

            {loading === 'outreach' && (
              <div className="flex items-center gap-2 text-th-tx4 text-xs py-4">
                <Loader2 size={13} className="animate-spin text-th-accent" />
                Drafting outreach email…
              </div>
            )}

            {!guest.outreach && !loading && guest.bio && (
              <div className="text-center py-10 text-th-tx4 text-xs">
                Click "Draft email" to generate a personalised outreach message.
              </div>
            )}

            {guest.outreach && (
              <div className="space-y-3">
                <div className="bg-th-raised border border-th-border rounded-xl p-4">
                  <p className="text-th-tx2 text-xs leading-relaxed whitespace-pre-wrap">{guest.outreach}</p>
                </div>
                <div className="flex items-center gap-3">
                  <CopyButton text={guest.outreach} />
                  {mailtoLink && (
                    <a
                      href={mailtoLink}
                      className="flex items-center gap-1.5 text-[11px] text-th-accent hover:text-th-accentH transition-colors"
                    >
                      <Mail size={11} /> Open in email client
                    </a>
                  )}
                  {!guest.email && (
                    <p className="text-th-tx4 text-[11px]">Add email in Research tab to open in email client</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Notes tab ── */}
        {tab === 'notes' && (
          <div className="space-y-3">
            <p className="text-th-tx3 text-xs">Private notes for this guest.</p>
            <textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="Add any context, links, conversation history…"
              rows={10}
              className="w-full bg-th-raised border border-th-border rounded-xl px-4 py-3 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent resize-none"
            />
            <button
              onClick={saveMeta}
              disabled={savingMeta}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-xs font-medium transition-colors"
            >
              {savingMeta ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
              Save notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Guests({ channels, episodes }) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    apiFetch('/api/guests').then(r => r.json()).then(setGuests).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeGuest = guests.find(g => g.id === activeId) || null;

  const handleAdded = (g) => {
    setGuests(prev => [g, ...prev]);
    setActiveId(g.id);
    setShowAdd(false);
  };

  const handleUpdate = (g) => {
    setGuests(prev => prev.map(x => x.id === g.id ? g : x));
  };

  const handleDelete = async (id) => {
    await apiFetch(`/api/guests/${id}`, { method: 'DELETE' });
    setGuests(prev => prev.filter(g => g.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const filtered = filter === 'all' ? guests : guests.filter(g => g.status === filter);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel — list ── */}
      <div className={`flex flex-col shrink-0 border-r border-th-border ${activeGuest ? 'w-72' : 'flex-1'}`}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-th-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-th-accent" />
              <h1 className="text-th-tx1 font-semibold text-base">Guests</h1>
              {guests.length > 0 && (
                <span className="text-xs text-th-tx4 bg-th-raised border border-th-border px-2 py-0.5 rounded-full">{guests.length}</span>
              )}
            </div>
            <button
              onClick={() => { setShowAdd(v => !v); setActiveId(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-accent hover:bg-th-accentH text-th-accentFg text-xs font-medium transition-colors"
            >
              <Plus size={12} /> Add guest
            </button>
          </div>

          {/* Status filter */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${filter === 'all' ? 'border-th-accent text-th-accent bg-th-accent/10' : 'border-th-border text-th-tx4 hover:text-th-tx2'}`}
            >
              All
            </button>
            {STATUSES.map(s => {
              const count = guests.filter(g => g.status === s.id).length;
              if (!count) return null;
              return (
                <button
                  key={s.id}
                  onClick={() => setFilter(s.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${filter === s.id ? s.light : 'border-th-border text-th-tx4 hover:text-th-tx2'}`}
                >
                  {s.label} {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {showAdd && (
            <AddGuestForm onAdded={handleAdded} onCancel={() => setShowAdd(false)} />
          )}

          {loading && (
            <div className="flex items-center justify-center py-12 text-th-tx4 text-xs gap-2">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          )}

          {!loading && !showAdd && guests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Users size={32} className="text-th-raised mb-3" />
              <p className="text-th-tx2 text-sm font-medium mb-1">No guests yet</p>
              <p className="text-th-tx4 text-xs max-w-xs leading-relaxed">
                Add a potential guest and the AI will research their background, generate interview questions, and draft an outreach email.
              </p>
            </div>
          )}

          {filtered.map(g => (
            <GuestCard
              key={g.id}
              guest={g}
              active={g.id === activeId}
              onClick={() => { setActiveId(g.id); setShowAdd(false); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel — guest detail ── */}
      {activeGuest && (
        <div className="flex-1 min-w-0 overflow-hidden">
          <GuestPanel
            guest={activeGuest}
            channels={channels}
            episodes={episodes}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onClose={() => setActiveId(null)}
          />
        </div>
      )}

      {/* Empty right state when no guest selected */}
      {!activeGuest && guests.length > 0 && !showAdd && (
        <div className="flex-1 flex items-center justify-center text-th-tx4 text-xs gap-2">
          <ArrowRight size={13} /> Select a guest to view details
        </div>
      )}
    </div>
  );
}
