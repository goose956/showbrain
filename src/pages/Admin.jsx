import { useState, useEffect } from 'react';
import { Trash2, Shield, User, RefreshCw, AlertCircle, ChevronLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Admin({ currentUser, onNavigate }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/members');
      if (!res.ok) throw new Error('Failed to load members');
      setMembers(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (member) => {
    if (confirmDelete?.id !== member.id) {
      setConfirmDelete(member);
      return;
    }
    setDeleting(member.id);
    setConfirmDelete(null);
    try {
      const res = await apiFetch(`/api/admin/members/${member.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => onNavigate('dashboard')} className="text-th-tx4 hover:text-th-tx2 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-th-accent" />
          <h1 className="text-th-tx1 text-lg font-semibold">Admin Panel</h1>
        </div>
        <button onClick={load} className="ml-auto text-th-tx4 hover:text-th-tx2 transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-xs mb-4">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-th-surface border border-th-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-th-border flex items-center justify-between">
          <span className="text-th-tx2 text-xs font-medium">Members</span>
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
                  {member.role === 'admin'
                    ? <Shield size={14} className="text-th-accent" />
                    : <User size={14} className="text-th-tx3" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-th-tx1 text-sm font-medium">{member.username}</span>
                    {member.username === currentUser && (
                      <span className="text-[10px] bg-th-raised text-th-tx3 px-1.5 py-0.5 rounded-full">you</span>
                    )}
                    {member.role === 'admin' && (
                      <span className="text-[10px] bg-th-accent/10 text-th-accent px-1.5 py-0.5 rounded-full">admin</span>
                    )}
                  </div>
                  <div className="text-th-tx4 text-xs">Joined {formatDate(member.createdAt)}</div>
                </div>

                {member.username !== currentUser && (
                  confirmDelete?.id === member.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-th-tx3 text-xs">Sure?</span>
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={!!deleting}
                        className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2 py-1 rounded-lg bg-th-raised text-th-tx2 hover:bg-th-border transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(member)}
                      disabled={!!deleting}
                      className="p-1.5 rounded-lg text-th-tx4 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      title="Delete member"
                    >
                      <Trash2 size={14} />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-th-tx4 text-xs mt-4 text-center">
        Deleting a member removes their account but not their data on disk.
      </p>
    </div>
  );
}
