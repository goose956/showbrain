import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
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

export default function App() {
  const [page, setPage] = useState('channel');
  const [episodes, setEpisodes] = useState([]);
  const [posts, setPosts] = useState([]);
  const [scriptBrief, setScriptBrief] = useState(null); // passed from Ideas → ScriptWriter

  useEffect(() => {
    const handler = (e) => setPage(e.detail);
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, []);

  const handleWriteScript = (idea) => {
    // Build a rich brief from the idea card
    setScriptBrief(`${idea.title}\n\n${idea.brief}`);
    setPage('scriptwriter');
  };

  const handlePageChange = (newPage) => {
    // Clear brief when navigating away from script writer manually
    if (newPage !== 'scriptwriter') setScriptBrief(null);
    setPage(newPage);
  };

  const renderPage = () => {
    switch (page) {
      case 'channel':      return <Channel onEpisodesLoaded={setEpisodes} />;
      case 'dashboard':    return <Dashboard episodes={episodes} />;
      case 'search':       return <SemanticSearch episodes={episodes} />;
      case 'performance':  return <Performance episodes={episodes} />;
      case 'intelligence': return <Intelligence episodes={episodes} onEpisodesUpdate={setEpisodes} />;
      case 'compare':      return <Compare episodes={episodes} />;
      case 'ideas':        return <Ideas episodes={episodes} onWriteScript={handleWriteScript} />;
      case 'scriptwriter': return <ScriptWriter key={scriptBrief} episodes={episodes} initialBrief={scriptBrief} />;
      case 'queue':        return <PostQueue posts={posts} onPostsUpdate={setPosts} episodes={episodes} />;
      case 'analytics':    return <Analytics />;
      case 'publish':      return <Publish episodes={episodes} />;
      default:             return <Dashboard episodes={episodes} />;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar active={page} onChange={handlePageChange} />
      <main className="flex-1 overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}
