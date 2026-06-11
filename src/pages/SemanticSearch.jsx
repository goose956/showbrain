import { useState } from 'react';
import { Search, Loader2, Tag, Sparkles } from 'lucide-react';
import { semanticSearch } from '../lib/claude';

const exampleQueries = [
  'AI replacing creative jobs',
  'remote work productivity research',
  'venture capital problems for founders',
  'habits and deep focus',
  'building in public strategy',
];

export default function SemanticSearch({ episodes }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (q = query) => {
    if (!q.trim() || loading) return;
    setError('');
    setLoading(true);
    setResults(null);
    try {
      const found = await semanticSearch(q, episodes);
      setResults(found);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-semibold mb-1">Semantic Search</h1>
        <p className="text-zinc-500 text-sm">Ask anything — Claude finds the most relevant episodes.</p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="What do you want to find?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500"
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          className="px-5 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Search
        </button>
      </div>

      {/* Example queries */}
      {!results && !loading && (
        <div className="mb-8">
          <p className="text-xs text-zinc-600 mb-3">Try asking about:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-white px-3 py-1.5 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <Loader2 size={28} className="text-violet-400 animate-spin mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Claude is searching your episodes…</p>
        </div>
      )}

      {results !== null && !loading && (
        <div>
          <p className="text-xs text-zinc-500 mb-4">
            {results.length === 0 ? 'No relevant episodes found for this query.' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
          </p>
          <div className="space-y-4">
            {results.map(({ episode, relevance }, i) => (
              <div key={episode.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-violet-400 shrink-0 mt-1">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-500 mb-0.5">{episode.show}</p>
                    <h3 className="text-white font-medium text-sm mb-2">{episode.title}</h3>
                    <div className="flex items-start gap-2 mb-3">
                      <Sparkles size={12} className="text-violet-400 shrink-0 mt-0.5" />
                      <p className="text-violet-300 text-xs leading-relaxed">{relevance}</p>
                    </div>
                    <p className="text-zinc-400 text-xs leading-relaxed mb-3 line-clamp-2">{episode.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {episode.topics.slice(0, 4).map((t) => (
                        <span key={t} className="text-[11px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag size={9} />{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
