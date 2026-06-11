import { useState, useEffect } from 'react';
import { MessageSquare, Briefcase, Camera, Mail, CheckCircle, AlertCircle, Loader2, ExternalLink, Plug } from 'lucide-react';
import { getConnectedAccounts } from '../lib/zernio';

const PLATFORM_META = {
  twitter:   { label: 'Twitter / X', icon: MessageSquare, color: 'sky' },
  linkedin:  { label: 'LinkedIn',    icon: Briefcase,     color: 'blue' },
  instagram: { label: 'Instagram',   icon: Camera,        color: 'pink' },
  newsletter:{ label: 'Newsletter',  icon: Mail,          color: 'amber' },
};

const COLOR_MAP = {
  sky:   { card: 'border-sky-500/20 bg-sky-500/5',   icon: 'text-sky-400',   badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  blue:  { card: 'border-blue-500/20 bg-blue-500/5', icon: 'text-blue-400',  badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  pink:  { card: 'border-pink-500/20 bg-pink-500/5', icon: 'text-pink-400',  badge: 'bg-pink-500/10 text-pink-300 border-pink-500/20' },
  amber: { card: 'border-amber-500/20 bg-amber-500/5',icon: 'text-amber-400',badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
};

export default function Connections() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getConnectedAccounts();
      setAccounts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const apiKey = import.meta.env.VITE_ZERNIO_API_KEY;

  // Group accounts by platform
  const byPlatform = {};
  for (const acc of accounts) {
    if (!byPlatform[acc.platform]) byPlatform[acc.platform] = [];
    byPlatform[acc.platform].push(acc);
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Plug size={18} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-white font-semibold text-lg">Connections</h1>
          <p className="text-zinc-500 text-xs">Social accounts connected via Zernio — used when publishing from Post Queue.</p>
        </div>
      </div>

      {/* No API key */}
      {!apiKey && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
          <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-sm font-medium">Zernio API key not set</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Add <code className="bg-amber-500/10 px-1 rounded">VITE_ZERNIO_API_KEY</code> to your <code className="bg-amber-500/10 px-1 rounded">.env</code> file to connect accounts.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading accounts…
        </div>
      )}

      {/* Connected accounts */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {Object.entries(PLATFORM_META).map(([id, { label, icon: Icon, color }]) => {
              const c = COLOR_MAP[color];
              const connected = byPlatform[id] || [];
              return (
                <div key={id} className={`rounded-xl border p-4 ${connected.length ? c.card : 'border-zinc-800 bg-zinc-900/50'}`}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <Icon size={16} className={connected.length ? c.icon : 'text-zinc-600'} />
                    <span className={`text-sm font-medium ${connected.length ? 'text-white' : 'text-zinc-500'}`}>{label}</span>
                    {connected.length > 0 && (
                      <span className={`ml-auto flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${c.badge}`}>
                        <CheckCircle size={10} />
                        Connected
                      </span>
                    )}
                  </div>

                  {connected.length > 0 ? (
                    <div className="space-y-1.5">
                      {connected.map((acc) => (
                        <div key={acc._id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-zinc-400 text-xs truncate">{acc.name || acc.username || acc._id}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-600 text-xs">No account connected</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary + refresh */}
          <div className="flex items-center justify-between py-3 border-t border-zinc-800">
            <p className="text-zinc-500 text-xs">
              {accounts.length === 0
                ? 'No accounts connected yet.'
                : `${accounts.length} account${accounts.length !== 1 ? 's' : ''} connected across ${Object.keys(byPlatform).length} platform${Object.keys(byPlatform).length !== 1 ? 's' : ''}.`}
            </p>
            <button
              onClick={load}
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Link to Zernio */}
          <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium mb-1">Manage in Zernio</p>
              <p className="text-zinc-500 text-xs leading-relaxed">Connect, disconnect, or add new social accounts in your Zernio dashboard. Changes appear here after a refresh.</p>
            </div>
            <a
              href="https://zernio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white text-xs transition-colors"
            >
              <ExternalLink size={12} />
              Open Zernio
            </a>
          </div>
        </>
      )}
    </div>
  );
}
