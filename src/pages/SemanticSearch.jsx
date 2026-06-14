import { useMemo, useState } from 'react';
import { Search, Loader2, Tag, Sparkles, Clock, ExternalLink, Play } from 'lucide-react';
import { semanticSearch } from '../lib/claude';

// Pull example queries from the user's own topics, fall back to generic ones
function buildExamples(episodes) {
  const topicMap = {};
  episodes.forEach(ep => ep.topics?.forEach(t => { topicMap[t] = (topicMap[t] || 0) + 1; }));
  const topTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  if (topTopics.length >= 3) return topTopics;
  // Generic fallbacks that work for any podcast
  return [
    'most controversial episode',
    'advice for beginners',
    'guest shares personal story',
    'common mistakes to avoid',
    'actionable tips and frameworks',
  ];
}

export default function SemanticSearch({ episodes }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const exampleQueries = useMemo(() => buildExamples(episodes), [episodes]);

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

  const hasTranscripts = episodes.some(e => e.transcript || e.summary);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-th-tx1 text-2xl font-semibold mb-1">Search</h1>
        <p className="text-th-tx3 text-sm">Ask anything — AI finds the most relevant episodes.</p>
      </div>

      {!hasTranscripts && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 dark:bg-amber-500/10 dark:border-amber-500/20">
          <span className="text-amber-600 text-lg leading-none shrink-0">⚠</span>
          <div>
            <p className="text-amber-800 text-sm font-medium mb-0.5 dark:text-amber-300">No transcripts yet</p>
            <p className="text-amber-700 text-xs leading-relaxed dark:text-amber-300/70">
              Search works by reading your episode transcripts and summaries. Head to the <strong>Channel</strong> page and run a sync to transcribe your episodes first.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-tx3" />
          <input
            type="text"
            placeholder="What do you want to find?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-th-surface border border-th-border rounded-lg pl-10 pr-4 py-3 text-th-tx1 text-sm placeholder-th-tx3 focus:outline-none focus:border-th-accent"
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          className="px-5 py-3 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-sm transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Search
        </button>
      </div>

      {!results && !loading && (
        <div className="mb-8">
          <p className="text-xs text-th-tx4 mb-3">Try asking about:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="text-xs text-th-tx2 bg-th-surface border border-th-border hover:border-th-accent/40 hover:text-th-tx1 px-3 py-1.5 rounded-full transition-colors"
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
          <Loader2 size={28} className="text-th-accent animate-spin mx-auto mb-3" />
          <p className="text-th-tx3 text-sm">Searching episodes and finding exact moments…</p>
        </div>
      )}

      {results !== null && !loading && (
        <div>
          <p className="text-xs text-th-tx3 mb-4">
            {results.length === 0 ? 'No relevant episodes found.' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
          </p>
          <div className="space-y-4">
            {results.map(({ episode, relevance, passage, timestampSecs }, i) => {
              const timestampUrl = episode.youtubeUrl && timestampSecs != null
                ? `${episode.youtubeUrl}&t=${timestampSecs}`
                : episode.youtubeUrl;
              const timestampLabel = timestampSecs != null
                ? `${Math.floor(timestampSecs / 60)}:${String(timestampSecs % 60).padStart(2, '0')}`
                : null;

              return (
                <div key={episode.id} className="bg-th-surface border border-th-border rounded-xl p-5 hover:border-th-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-th-accent shrink-0 mt-1">#{i + 1}</span>
                    <div className="flex-1 min-w-0">

                      {/* Episode header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-xs text-th-tx3 mb-0.5">{episode.show} · {episode.publishedAt}</p>
                          <h3 className="text-th-tx1 font-medium text-sm">{episode.title}</h3>
                        </div>
                        {episode.youtubeUrl && (
                          <a
                            href={timestampUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium transition-colors"
                          >
                            <Play size={10} className="fill-red-400" />
                            {timestampLabel ? `Watch at ${timestampLabel}` : 'Watch'}
                            <ExternalLink size={9} />
                          </a>
                        )}
                      </div>

                      {/* Why it matched */}
                      <div className="flex items-start gap-2 mb-3">
                        <Sparkles size={12} className="text-th-accent shrink-0 mt-0.5" />
                        <p className="text-th-accent text-xs leading-relaxed opacity-90">{relevance}</p>
                      </div>

                      {/* Specific passage from transcript */}
                      {passage && (
                        <div className="bg-th-raised border-l-2 border-th-accent/50 rounded-r-lg px-3 py-2 mb-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            {timestampLabel && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-th-accent bg-th-accent/10 px-1.5 py-0.5 rounded">
                                <Clock size={8} />{timestampLabel}
                              </span>
                            )}
                            <span className="text-[10px] text-th-tx4">from transcript</span>
                          </div>
                          <p className="text-th-tx2 text-xs leading-relaxed italic">"{passage}"</p>
                        </div>
                      )}

                      {/* Summary + topics */}
                      {episode.summary && (
                        <p className="text-th-tx3 text-xs leading-relaxed mb-3 line-clamp-2">{episode.summary}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {episode.topics?.slice(0, 4).map((t) => (
                          <span key={t} className="text-[11px] text-th-tx3 bg-th-raised px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Tag size={9} />{t}
                          </span>
                        ))}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
