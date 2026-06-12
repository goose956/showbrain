import { useState } from 'react';
import { Zap, User, ArrowRight, Loader2 } from 'lucide-react';

export default function UserPicker({ users, onSelect }) {
  const [loading, setLoading] = useState(null);

  const handlePick = async (id) => {
    setLoading(id);
    // Small delay for feel
    await new Promise(r => setTimeout(r, 300));
    onSelect(id);
  };

  return (
    <div className="min-h-screen bg-th-bg flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-xl bg-th-accent flex items-center justify-center">
          <Zap size={16} className="text-th-tx1" />
        </div>
        <span className="text-th-tx1 font-semibold text-xl tracking-tight">ShowBrain</span>
      </div>

      <div className="w-full max-w-xs">
        <h1 className="text-th-tx1 text-xl font-semibold text-center mb-1">Who are you?</h1>
        <p className="text-th-tx3 text-sm text-center mb-8">Your data is kept separate from everyone else's.</p>

        <div className="space-y-2">
          {users.map((id) => (
            <button
              key={id}
              onClick={() => handlePick(id)}
              disabled={!!loading}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-th-surface border border-th-border hover:border-violet-500/50 hover:bg-th-accent/5 text-left transition-colors group disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-full bg-th-raised border border-th-border flex items-center justify-center shrink-0">
                {loading === id
                  ? <Loader2 size={14} className="text-th-accent animate-spin" />
                  : <User size={14} className="text-th-tx3 group-hover:text-th-accent transition-colors" />}
              </div>
              <span className="text-th-tx1 text-sm font-medium flex-1">{id}</span>
              <ArrowRight size={14} className="text-th-tx4 group-hover:text-th-accent transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
