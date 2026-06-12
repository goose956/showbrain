import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Overview from './pages/Overview';
import Dashboard from './pages/Dashboard';
import SemanticSearch from './pages/SemanticSearch';
import Performance from './pages/Performance';
import Intelligence from './pages/Intelligence';
import Channel from './pages/Channel';
import PostQueue from './pages/PostQueue';
import Publish from './pages/Publish';
import ScriptWriter from './pages/ScriptWriter';
import Ideas from './pages/Ideas';
import Compare from './pages/Compare';
import Analytics from './pages/Analytics';
import Waitlist from './pages/Waitlist';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import { getStoredUser, storeAuth, clearAuth, verifyStoredToken, apiFetch } from './lib/api';

const EMPTY_SYNC = {
  running: false, channelId: null, channelName: null,
  progress: 0, total: 0, processed: 0,
  currentBatch: 0, totalBatches: 0,
  currentVideo: null, errors: [], lastSyncedAt: null,
};

export default function App() {
  const [page, setPage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [scriptBrief, setScriptBrief] = useState(null);
  const [episodeIdeas, setEpisodeIdeas] = useState(null);
  const [authScreen, setAuthScreen] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Global sync state (persists across page changes) ─────────────────────
  const [syncStatus, setSyncStatus] = useState(EMPTY_SYNC);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const startPolling = useCallback((onDone) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch('/api/sync/status');
        const status = await res.json();
        setSyncStatus(status);
        if (!status.running) {
          stopPolling();
          onDone?.();
        }
      } catch {}
    }, 2000);
  }, [stopPolling]);

  // Resume polling on mount if a sync was already running (e.g. page refresh)
  useEffect(() => {
    apiFetch('/api/sync/status').then(r => r.json()).then(status => {
      if (status.running) {
        setSyncStatus(status);
        startPolling();
      }
    }).catch(() => {});
  }, []);

  // On mount: verify token, then load data — return the chain so .finally waits for data too
  useEffect(() => {
    verifyStoredToken()
      .then(user => {
        if (user) {
          setCurrentUser({ username: user.username, isAdmin: user.isAdmin });
          return Promise.all([apiFetch('/api/episodes'), apiFetch('/api/channels')])
            .then(([epRes, chRes]) => Promise.all([epRes.json(), chRes.json()]))
            .then(([eps, chs]) => {
              setEpisodes(eps);
              setChannels(chs.map(ch => ({
                ...ch,
                transcribedCount: eps.filter(e => e.channelId === ch.id && e.transcript).length,
              })));
            });
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // Global navigate event (from anywhere in the app)
  useEffect(() => {
    const handler = (e) => setPage(e.detail);
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, []);

  useEffect(() => () => stopPolling(), []);

  const handleAuth = (data) => {
    storeAuth(data);
    setCurrentUser({ username: data.username, isAdmin: data.isAdmin });
    setPage('channel');
  };

  const handleLogout = () => {
    clearAuth();
    stopPolling();
    setCurrentUser(null);
    setEpisodes([]);
    setSyncStatus(EMPTY_SYNC);
    setPage('channel');
    setAuthScreen('login');
  };

  const handleWriteScript = (idea) => {
    setScriptBrief(`${idea.title}\n\n${idea.brief}`);
    setPage('scriptwriter');
  };

  const handlePageChange = (newPage) => {
    if (newPage !== 'scriptwriter') setScriptBrief(null);
    setPage(newPage);
    setSidebarOpen(false);
  };

  // Called by Channel page when a sync starts
  const handleSyncStart = useCallback((channelId) => {
    setSyncStatus(s => ({ ...s, running: true, channelId, progress: 0, processed: 0 }));
    startPolling(() => {
      // When sync finishes, reload episodes + channels
      Promise.all([apiFetch('/api/episodes'), apiFetch('/api/channels')])
        .then(([epRes, chRes]) => Promise.all([epRes.json(), chRes.json()]))
        .then(([eps, chs]) => {
          setEpisodes(eps);
          setChannels(chs.map(ch => ({
            ...ch,
            transcribedCount: eps.filter(e => e.channelId === ch.id && e.transcript).length,
          })));
        }).catch(() => {});
    });
  }, [startPolling]);

  // ── loading ───────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-th-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-th-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── auth screens ──────────────────────────────────────────────────────────

  if (!currentUser) {
    if (authScreen === 'login') {
      return <Login onAuth={handleAuth} onGoBack={() => setAuthScreen('home')} />;
    }
    if (authScreen === 'register') {
      return <Register onAuth={handleAuth} onGoLogin={() => setAuthScreen('login')} />;
    }
    // Default: show the public landing page with a login button
    return <Waitlist onGoLogin={() => setAuthScreen('login')} />;
  }

  // ── app ───────────────────────────────────────────────────────────────────

  const renderPage = () => {
    switch (page) {
      case 'overview':     return <Overview episodes={episodes} channels={channels} onNavigate={handlePageChange} />;
      case 'channel':      return <Channel onEpisodesLoaded={setEpisodes} onChannelsLoaded={setChannels} syncStatus={syncStatus} onSyncStart={handleSyncStart} />;
      case 'dashboard':    return <Dashboard episodes={episodes} />;
      case 'search':       return <SemanticSearch episodes={episodes} />;
      case 'performance':  return <Performance episodes={episodes} />;
      case 'intelligence': return <Intelligence episodes={episodes} onEpisodesUpdate={setEpisodes} />;
      case 'compare':      return <Compare episodes={episodes} onChannelsLoaded={() => {
        apiFetch('/api/channels').then(r => r.json()).then(chs =>
          setChannels(chs.map(ch => ({ ...ch, transcribedCount: episodes.filter(e => e.channelId === ch.id && e.transcript).length })))
        ).catch(() => {});
      }} />;
      case 'ideas':        return <Ideas episodes={episodes} onWriteScript={handleWriteScript} ideas={episodeIdeas} onIdeasUpdate={setEpisodeIdeas} />;
      case 'scriptwriter': return <ScriptWriter key={scriptBrief} episodes={episodes} initialBrief={scriptBrief} />;
      case 'queue':        return <PostQueue episodes={episodes} />;
      case 'settings':     return <Settings />;
      case 'analytics':    return <Analytics />;
      case 'waitlist':     return <Waitlist />;
      case 'publish':      return <Publish episodes={episodes} />;
      case 'admin':        return <Admin currentUser={currentUser.username} onNavigate={handlePageChange} />;
      default:             return <Dashboard episodes={episodes} />;
    }
  };

  return (
    <div className="flex h-screen bg-th-bg overflow-hidden">
      <Sidebar
        active={page}
        onChange={handlePageChange}
        isAdmin={currentUser.isAdmin}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          currentUser={currentUser.username}
          isAdmin={currentUser.isAdmin}
          onLogout={handleLogout}
          onNavigate={handlePageChange}
          syncStatus={syncStatus}
          activePage={page}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 min-h-0 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
