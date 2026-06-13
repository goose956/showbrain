import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronLeft, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { apiFetch } from '../lib/api';

function timeAgo(iso) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const STATUS_COLOR = {
  open:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  pending: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  closed:  'text-th-tx4 bg-th-raised border-th-border',
};

export default function SupportButton({ currentUser }) {
  const [open, setOpen]           = useState(false);
  const [view, setView]           = useState('list'); // list | new | thread
  const [tickets, setTickets]     = useState([]);
  const [activeTicket, setActive] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState('');
  const [subject, setSubject]     = useState('');
  const [message, setMessage]     = useState('');
  const [reply, setReply]         = useState('');
  const bottomRef = useRef(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/support');
      setTickets(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const loadThread = async (id) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/support/${id}`);
      setActive(await res.json());
      setView('thread');
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) loadTickets(); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeTicket]);

  const submitNew = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true); setError('');
    try {
      const res = await apiFetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubject(''); setMessage('');
      await loadTickets();
      await loadThread(data.id);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setError('');
    try {
      const res = await apiFetch(`/api/support/${activeTicket.id}/reply`, {
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

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open ? 'bg-th-surface border-2 border-th-accent text-th-accent' : 'bg-th-accent hover:bg-th-accentH text-th-accentFg'
        }`}
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-22 right-6 z-50 w-80 max-h-[540px] bg-th-surface border border-th-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-th-border shrink-0">
            {view !== 'list' && (
              <button onClick={() => { setView('list'); setActive(null); setError(''); }} className="text-th-tx4 hover:text-th-tx1 transition-colors mr-1">
                <ChevronLeft size={15} />
              </button>
            )}
            <MessageCircle size={14} className="text-th-accent" />
            <span className="text-th-tx1 text-sm font-semibold flex-1">
              {view === 'list' ? 'Support' : view === 'new' ? 'New ticket' : activeTicket?.subject || 'Thread'}
            </span>
            {view === 'list' && (
              <button onClick={() => { setView('new'); setError(''); }} className="text-xs text-th-accent hover:text-th-accentH font-medium transition-colors">
                + New
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* List view */}
            {view === 'list' && (
              <div className="p-3 space-y-2">
                {loading && <div className="text-center py-6 text-th-tx4 text-xs">Loading…</div>}
                {!loading && tickets.length === 0 && (
                  <div className="text-center py-8">
                    <MessageCircle size={24} className="text-th-raised mx-auto mb-2" />
                    <p className="text-th-tx3 text-xs">No tickets yet</p>
                    <p className="text-th-tx4 text-[11px] mt-1">Hit "+ New" to get help from our team.</p>
                  </div>
                )}
                {tickets.map(t => (
                  <button
                    key={t.id}
                    onClick={() => loadThread(t.id)}
                    className="w-full text-left bg-th-raised/50 hover:bg-th-raised border border-th-border rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-th-tx1 text-xs font-medium leading-snug line-clamp-1 flex-1">{t.subject}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[t.status]}`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-th-tx4">
                      <Clock size={9} />
                      <span>{timeAgo(t.updated_at)}</span>
                      <span>· {t.message_count} msg{t.message_count !== '1' ? 's' : ''}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* New ticket view */}
            {view === 'new' && (
              <form onSubmit={submitNew} className="p-4 space-y-3">
                <div>
                  <label className="text-th-tx3 text-[11px] font-medium block mb-1">Subject</label>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="What do you need help with?"
                    className="w-full bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
                  />
                </div>
                <div>
                  <label className="text-th-tx3 text-[11px] font-medium block mb-1">Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail…"
                    rows={5}
                    className="w-full bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent resize-none"
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-[11px] flex items-center gap-1"><AlertCircle size={11} />{error}</p>
                )}
                <button
                  type="submit"
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg text-xs font-semibold transition-colors"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Send ticket
                </button>
              </form>
            )}

            {/* Thread view */}
            {view === 'thread' && activeTicket && (
              <div className="p-3 space-y-2">
                {loading && <div className="text-center py-4 text-th-tx4 text-xs">Loading…</div>}
                {activeTicket.messages?.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-0.5 ${msg.sender_role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.sender_role === 'admin'
                        ? 'bg-th-accent/10 border border-th-accent/20 text-th-tx1'
                        : 'bg-th-raised border border-th-border text-th-tx1'
                    }`}>
                      {msg.sender_role === 'admin' && (
                        <p className="text-th-accent text-[10px] font-semibold mb-1">ShowBrain Support</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                    </div>
                    <span className="text-[10px] text-th-tx4 px-1">{timeAgo(msg.sent_at)}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Reply bar */}
          {view === 'thread' && activeTicket?.status !== 'closed' && (
            <form onSubmit={submitReply} className="border-t border-th-border p-3 flex gap-2 shrink-0">
              <input
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Reply…"
                className="flex-1 bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-xs placeholder-th-tx4 focus:outline-none focus:border-th-accent"
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="p-2 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 text-th-accentFg transition-colors"
              >
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </form>
          )}
          {view === 'thread' && activeTicket?.status === 'closed' && (
            <div className="border-t border-th-border px-4 py-3 flex items-center gap-2 text-th-tx4 text-[11px] shrink-0">
              <CheckCircle size={11} className="text-emerald-400" /> This ticket is closed
            </div>
          )}
        </div>
      )}
    </>
  );
}
