import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw, PenLine, TrendingUp, ArrowRight, Lightbulb } from 'lucide-react';
import { generateEpisodeIdeas } from '../lib/claude';

// ── constants ─────────────────────────────────────────────────────────────────

const TYPE_META = {
  gap:       { label: 'Gap',        color: 'bg-violet-500/15 text-violet-300 border-violet-500/25' },
  'follow-up':{ label: 'Follow-up', color: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
  series:    { label: 'Series',     color: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  trending:  { label: 'Trending',   color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  revisit:   { label: 'Revisit',    color: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
};

const FORMAT_LABELS = {
  solo: 'Solo', interview: 'Interview', 'co-hosted': 'Co-hosted',
  panel: 'Panel', narrative: 'Narrative', qa: 'Q&A',
};

const HOOK_LABELS = {
  'bold-claim': 'Bold Claim', 'personal-story': 'Personal Story',
  'controversial-question': 'Controversial Q', 'surprising-statistic': 'Surprising Stat',
  'cold-open': 'Cold Open', 'direct-challenge': 'Direct Challenge',
};

// ── idea card ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, onWriteScript }) {
  const typeMeta = TYPE_META[idea.type] || TYPE_META.gap;
  const isHigh = idea.estimatedPotential === 'high';

  return (
    <div className={`bg-zinc-900 border rounded-xl p-5 flex flex-col gap-4 transition-colors hover:border-zinc-700 ${
      isHigh ? 'border-zinc-700' : 'border-zinc-800'
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${typeMeta.color}`}>
              {typeMeta.label}
            </span>
            {isHigh && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                <TrendingUp size={9} />
                High potential
              </span>
            )}
            <span className="text-[11px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
              {idea.topicCluster}
            </span>
          </div>
          <h3 className="text-white text-sm font-semibold leading-snug">{idea.title}</h3>
        </div>
      </div>

      {/* Brief */}
      <p className="text-zinc-400 text-xs leading-relaxed">{idea.brief}</p>

      {/* Why it would perform */}
      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3">
        <p className="text-zinc-500 text-[11px] font-medium mb-1">Why it should perform</p>
        <p className="text-zinc-300 text-xs leading-relaxed">{idea.why}</p>
      </div>

      {/* Format + hook */}
      <div className="flex items-center gap-2 flex-wrap">
        {idea.recommendedFormat && (
          <span className="text-[11px] text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
            {FORMAT_LABELS[idea.recommendedFormat] || idea.recommendedFormat}
          </span>
        )}
        {idea.recommendedHookType && (
          <span className="text-[11px] text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
            {HOOK_LABELS[idea.recommendedHookType] || idea.recommendedHookType} hook
          </span>
        )}
      </div>

      {/* Related episodes */}
      {idea.relatedEpisodeTitles?.length > 0 && (
        <div>
          <p className="text-zinc-600 text-[11px] font-medium mb-1.5">Related episodes</p>
          <div className="space-y-1">
            {idea.relatedEpisodeTitles.map((t, i) => (
              <p key={i} className="text-zinc-600 text-[11px] truncate">· {t}</p>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onWriteScript(idea)}
        className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 hover:border-violet-500/50 text-violet-300 hover:text-white text-xs font-medium transition-colors"
      >
        <PenLine size={12} />
        Write Script
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Ideas({ episodes, onWriteScript }) {
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasEnoughData = episodes.filter(ep => ep.dimensions).length >= 3;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await generateEpisodeIdeas(episodes);
      setIdeas(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const high = ideas?.filter(i => i.estimatedPotential === 'high') || [];
  const medium = ideas?.filter(i => i.estimatedPotential !== 'high') || [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg flex items-center gap-2">
              <Lightbulb size={17} className="text-amber-400" />
              Episode Ideas
            </h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              Claude analyses your channel patterns and suggests what to make next — and why it'll perform.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !hasEnoughData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm transition-colors"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" />Generating…</>
              : <><Sparkles size={14} />{ideas ? 'Regenerate' : 'Generate Ideas'}</>}
          </button>
        </div>

        {!hasEnoughData && (
          <div className="mt-3 flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            Analyse at least 3 episodes on the Intelligence page first — Claude needs dimension data to make good recommendations.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm">{error}</p>
              <button onClick={handleGenerate} className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!ideas && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Lightbulb size={32} className="text-zinc-800 mb-3" />
            <p className="text-zinc-500 text-sm mb-1">No ideas generated yet</p>
            <p className="text-zinc-700 text-xs max-w-xs">
              Hit Generate Ideas and Claude will analyse your channel's performance patterns to suggest your next 9 episodes.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 size={24} className="text-violet-400 animate-spin" />
            <div className="text-center">
              <p className="text-white text-sm font-medium">Analysing your channel…</p>
              <p className="text-zinc-500 text-xs mt-1">Finding gaps, follow-ups, and high-potential topics</p>
            </div>
          </div>
        )}

        {/* Ideas grid */}
        {ideas && !loading && (
          <div className="space-y-8">
            {high.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <h2 className="text-white text-sm font-semibold">High Potential</h2>
                  <span className="text-zinc-600 text-xs">{high.length} ideas</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {high.map((idea, i) => (
                    <IdeaCard key={i} idea={idea} onWriteScript={onWriteScript} />
                  ))}
                </div>
              </div>
            )}

            {medium.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-white text-sm font-semibold">More Ideas</h2>
                  <span className="text-zinc-600 text-xs">{medium.length} ideas</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {medium.map((idea, i) => (
                    <IdeaCard key={i} idea={idea} onWriteScript={onWriteScript} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
