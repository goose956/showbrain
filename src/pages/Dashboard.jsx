import { useState, useMemo } from 'react';
import { Loader2, Sparkles, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import EpisodeCard from '../components/EpisodeCard';
import { generateShowNotes, generateChapterMarkers } from '../lib/claude';

const PAGE_SIZE = 10;

export default function Dashboard({ episodes }) {
  const [selected, setSelected] = useState(null);
  const [showNotes, setShowNotes] = useState('');
  const [chapters, setChapters] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(episodes.length / PAGE_SIZE));
  const pageEpisodes = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return episodes.slice(start, start + PAGE_SIZE);
  }, [episodes, page]);

  const handleSelect = (ep) => {
    setSelected(ep);
    setShowNotes('');
    setChapters([]);
    setExpanded(null);
  };

  const handleGenerateNotes = async () => {
    if (!selected) return;
    setLoadingNotes(true);
    try {
      const notes = await generateShowNotes(selected);
      setShowNotes(notes);
      setExpanded('notes');
    } catch (e) {
      alert(e.message);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleGenerateChapters = async () => {
    if (!selected) return;
    setLoadingChapters(true);
    try {
      const ch = await generateChapterMarkers(selected.transcript, selected.duration);
      setChapters(ch);
      setExpanded('chapters');
    } catch (e) {
      alert(e.message);
    } finally {
      setLoadingChapters(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Episode list */}
      <div className="w-96 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">
            Episodes
            <span className="text-zinc-600 font-normal ml-1.5">({episodes.length})</span>
          </h2>
          {totalPages > 1 && (
            <span className="text-zinc-600 text-xs">Page {page} of {totalPages}</span>
          )}
        </div>

        {/* 2-column grid */}
        <div className="flex-1 overflow-hidden px-3 pb-2">
          {episodes.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-8">No episodes yet.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {pageEpisodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => handleSelect(ep)}
                className={`cursor-pointer rounded-xl border p-3 flex flex-col justify-between aspect-[5/3] transition-colors ${
                  selected?.id === ep.id
                    ? 'border-violet-500/60 bg-violet-500/5'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                }`}
              >
                <p className="text-white text-xs font-medium leading-snug line-clamp-3 flex-1">{ep.title}</p>
                <p className="text-zinc-600 text-[11px] mt-2 shrink-0">{ep.publishedAt}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="shrink-0 border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-violet-600 text-white'
                      : 'text-zinc-600 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Episode detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            Select an episode to view details
          </div>
        ) : (
          <div className="max-w-2xl">
            <p className="text-xs text-zinc-500 mb-1">{selected.show} · {selected.publishedAt}</p>
            <h1 className="text-white text-xl font-semibold mb-3">{selected.title}</h1>

            <div className="flex flex-wrap gap-2 mb-5">
              {selected.topics?.map((t) => (
                <span key={t} className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full">{t}</span>
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
              <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Summary</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{selected.summary}</p>
            </div>

            {/* AI Actions */}
            <div className="flex gap-3 mb-5">
              <button
                onClick={handleGenerateNotes}
                disabled={loadingNotes}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm transition-colors disabled:opacity-60"
              >
                {loadingNotes ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-violet-400" />}
                Generate Show Notes
              </button>
              <button
                onClick={handleGenerateChapters}
                disabled={loadingChapters}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm transition-colors disabled:opacity-60"
              >
                {loadingChapters ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-violet-400" />}
                Chapter Markers
              </button>
            </div>

            {/* Show notes */}
            {showNotes && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === 'notes' ? null : 'notes')}
                  className="w-full flex items-center justify-between p-4 text-white text-sm font-medium hover:bg-zinc-800/50 transition-colors"
                >
                  Show Notes
                  {expanded === 'notes' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expanded === 'notes' && (
                  <div className="px-4 pb-4 border-t border-zinc-800">
                    <pre className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans mt-3">{showNotes}</pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(showNotes)}
                      className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Chapters */}
            {chapters.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-4 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === 'chapters' ? null : 'chapters')}
                  className="w-full flex items-center justify-between p-4 text-white text-sm font-medium hover:bg-zinc-800/50 transition-colors"
                >
                  Chapter Markers
                  {expanded === 'chapters' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expanded === 'chapters' && (
                  <div className="px-4 pb-4 border-t border-zinc-800 mt-0 space-y-2 pt-3">
                    {chapters.map((ch, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-violet-400 font-mono text-xs w-12 shrink-0">{ch.time}</span>
                        <span className="text-zinc-300 text-sm">{ch.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transcript */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === 'transcript' ? null : 'transcript')}
                className="w-full flex items-center justify-between p-4 text-white text-sm font-medium hover:bg-zinc-800/50 transition-colors"
              >
                Transcript
                {expanded === 'transcript' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expanded === 'transcript' && (
                <div className="px-4 pb-4 border-t border-zinc-800">
                  <p className="text-zinc-400 text-sm leading-relaxed mt-3 whitespace-pre-wrap">{selected.transcript}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
