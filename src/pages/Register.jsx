import { useState } from 'react';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';

export default function Register({ onAuth, onGoLogin }) {
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
      const res = await fetch('/api/auth/register', {
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
      <div className="flex items-center gap-3 mb-10">
        <Logo size={36} />
        <div className="flex flex-col leading-none">
          <span className="text-th-tx1 font-bold text-xl tracking-tight">ShowBrain</span>
          <span className="text-th-tx4 text-xs">showbrain.co</span>
        </div>
      </div>

      <div className="w-full max-w-xs">
        <h1 className="text-th-tx1 text-xl font-semibold text-center mb-1">Create your account</h1>
        <p className="text-th-tx3 text-sm text-center mb-8">Your workspace is private and separate from everyone else's.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-th-tx3 text-xs font-medium block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="e.g. alex"
              autoFocus
              className="w-full bg-th-surface border border-th-border rounded-xl px-4 py-3 text-th-tx1 text-sm placeholder-th-tx3 focus:outline-none focus:border-th-accent transition-colors"
            />
            <p className="text-th-tx4 text-[11px] mt-1">Letters, numbers, - and _ only</p>
          </div>

          <div>
            <label className="text-th-tx3 text-xs font-medium block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Min 6 characters"
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
            {loading ? <><Loader2 size={14} className="animate-spin" />Creating account…</> : 'Create account'}
          </button>
        </form>

        <p className="text-th-tx4 text-xs text-center mt-5">
          Already have an account?{' '}
          <button onClick={onGoLogin} className="text-th-accent hover:text-th-accentH transition-colors">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
