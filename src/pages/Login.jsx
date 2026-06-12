import { useState } from 'react';
import { Zap, Loader2, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function Login({ onAuth, onGoBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAuth(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-th-bg flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-xl bg-th-accent flex items-center justify-center">
          <Zap size={16} className="text-th-accentFg" />
        </div>
        <span className="text-th-tx1 font-semibold text-xl tracking-tight">ShowBrain</span>
      </div>

      <div className="w-full max-w-xs">
        <h1 className="text-th-tx1 text-xl font-semibold text-center mb-1">Welcome back</h1>
        <p className="text-th-tx3 text-sm text-center mb-8">Sign in to your workspace.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-th-tx3 text-xs font-medium block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="Your username"
              autoFocus
              className="w-full bg-th-surface border border-th-border rounded-xl px-4 py-3 text-th-tx1 text-sm placeholder-th-tx3 focus:outline-none focus:border-th-accent transition-colors"
            />
          </div>

          <div>
            <label className="text-th-tx3 text-xs font-medium block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Your password"
                className="w-full bg-th-surface border border-th-border rounded-xl px-4 py-3 pr-10 text-th-tx1 text-sm placeholder-th-tx3 focus:outline-none focus:border-th-accent transition-colors"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-th-tx4 hover:text-th-tx2">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-xs">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-sm font-semibold transition-colors"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" />Signing in…</> : 'Sign in'}
          </button>
        </form>

        {onGoBack && (
          <button onClick={onGoBack} className="flex items-center gap-1.5 text-th-tx4 text-xs hover:text-th-tx2 transition-colors mx-auto mt-5">
            <ArrowLeft size={12} /> Back
          </button>
        )}
      </div>
    </div>
  );
}
