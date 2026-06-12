import { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, Settings, Moon, Sun, SunMoon, Loader2, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const THEME_ICONS = { dark: Moon, light: Sun, midnight: SunMoon };

function SyncPill({ syncStatus, onNavigate }) {
  const { running, channelName, processed, total, progress, errors } = syncStatus;
  if (!running && !syncStatus.lastSyncedAt) return null;

  // Estimate: ~3 min per remaining video
  const remaining = total - processed;
  const estMins = Math.round(remaining * 3);
  const estText = estMins >= 60
    ? `~${Math.floor(estMins / 60)}h ${estMins % 60}m left`
    : estMins > 0 ? `~${estMins}m left` : 'finishing…';

  if (!running) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 text-xs">
        <CheckCircle size={11} />
        <span>Sync complete — {total} videos</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onNavigate('channel')}
      className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-th-accent/25 bg-th-accent/10 hover:bg-th-accent/15 transition-colors group"
      title="Click to view channel"
    >
      <Loader2 size={11} className="text-th-accent animate-spin shrink-0" />
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-th-accent text-xs font-medium truncate max-w-32">
            {channelName || 'Syncing…'}
          </span>
          <span className="text-th-tx4 text-[10px] tabular-nums">{processed}/{total}</span>
          <span className="text-th-tx4 text-[10px]">{estText}</span>
        </div>
        {/* Mini progress bar */}
        <div className="w-32 h-0.5 bg-th-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-th-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </button>
  );
}

export default function Topbar({ currentUser, isAdmin, onLogout, onNavigate, syncStatus }) {
  const { theme, setTheme, themes } = useTheme();
  const [userOpen, setUserOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setUserOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-11 shrink-0 border-b border-th-border bg-th-surface flex items-center px-4 gap-3">

      {/* ── Theme switcher ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-th-raised border border-th-border rounded-lg p-0.5">
        {themes.map(t => {
          const Icon = THEME_ICONS[t.id] || Moon;
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.label}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                active ? 'bg-th-surface text-th-tx1 shadow-sm' : 'text-th-tx4 hover:text-th-tx2'
              }`}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Sync status (global, persists across pages) ────────────── */}
      {syncStatus && <SyncPill syncStatus={syncStatus} onNavigate={onNavigate} />}

      {/* ── Spacer ─────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Settings ───────────────────────────────────────────────── */}
      <button
        onClick={() => onNavigate('settings')}
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-th-raised border border-transparent hover:border-th-border text-th-tx3 hover:text-th-tx1 text-xs font-medium transition-colors"
      >
        <Settings size={13} />
        Settings
      </button>

      {/* ── User dropdown ──────────────────────────────────────────── */}
      <div className="relative" ref={dropRef}>
        <button
          onClick={() => setUserOpen(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            userOpen
              ? 'bg-th-raised border-th-border text-th-tx1'
              : 'border-transparent hover:bg-th-raised hover:border-th-border text-th-tx2 hover:text-th-tx1'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-th-accent/20 flex items-center justify-center shrink-0">
            <User size={10} className="text-th-accent" />
          </div>
          <span className="hidden sm:inline max-w-24 truncate">{currentUser}</span>
          {isAdmin && (
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-th-accent/15 text-th-accent font-semibold">
              Admin
            </span>
          )}
          <ChevronDown size={11} className={`text-th-tx4 transition-transform ${userOpen ? 'rotate-180' : ''}`} />
        </button>

        {userOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-th-surface border border-th-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
            <div className="px-3 py-2 border-b border-th-border mb-1">
              <p className="text-th-tx1 text-xs font-medium truncate">{currentUser}</p>
              {isAdmin && <p className="text-th-accent text-[10px] mt-0.5">Administrator</p>}
            </div>
            {isAdmin && (
              <button
                onClick={() => { onNavigate('admin'); setUserOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-th-tx2 hover:text-th-tx1 hover:bg-th-raised transition-colors flex items-center gap-2"
              >
                <div className="w-4 h-4 rounded bg-rose-500/20 flex items-center justify-center">
                  <User size={9} className="text-rose-400" />
                </div>
                Admin panel
              </button>
            )}
            <button
              onClick={() => { onLogout(); setUserOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-th-tx2 hover:text-rose-400 hover:bg-rose-500/5 transition-colors flex items-center gap-2"
            >
              <div className="w-4 h-4 rounded bg-th-raised flex items-center justify-center">
                <LogOut size={9} className="text-th-tx3" />
              </div>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
