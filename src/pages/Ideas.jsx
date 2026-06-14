import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw, PenLine, TrendingUp, ArrowRight, Lightbulb, Trash2, Users } from 'lucide-react';
import { generateEpisodeIdeas, fetchSavedIdeas, persistIdeas, clearIdeas } from '../lib/claude';

const TYPE_META = {
  gap:        { label: 'Gap',        color: 'bg-th-accent/10 text-th-accent border-th-accent/20' },
  'follow-up':{ label: 'Follow-up',  color: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
  series:     { label: 'Series',     color: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  trending:   { label: 'Trending',   color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  revisit:    { label: 'Revisit',    color: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
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

function IdeaCard({ idea, onWriteScript }) {
  const typeMeta = TYPE_META[idea.type] || TYPE_META.gap;
  const isHigh = idea.estimatedPotential === 'high';

  return (
    <div className={`bg-th-surface border rounded-xl p-5 flex flex-col gap-4 transition-colors hover:border-th-accent/30 ${
      isHigh ? 'border-th-accent/20' : 'border-th-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${typeMeta.color}`}>
              {typeMeta.label}
            </span>
            {isHigh && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <TrendingUp size={9} />
                High potential
              </span>
            )}
            <span className="text-[11px] text-th-tx3 bg-th-raised px-2 py-0.5 rounded-full border border-th-border">
              {idea.topicCluster}
            </span>
          </div>
          <h3 className="text-th-tx1 text-sm font-semibold leading-snug">{idea.title}</h3>
        </div>
      </div>

      <p className="text-th-tx2 text-xs leading-relaxed">{idea.brief}</p>

      <div className="bg-th-raised border border-th-border rounded-lg p-3">
        <p className="text-th-tx3 text-[11px] font-medium mb-1">Why it should perform</p>
        <p className="text-th-tx1 text-xs leading-relaxed">{idea.why}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {idea.recommendedFormat && (
          <span className="text-[11px] text-th-tx3 bg-th-raised px-2.5 py-1 rounded-lg border border-th-border">
            {FORMAT_LABELS[idea.recommendedFormat] || idea.recommendedFormat}
          </span>
        )}
        {idea.recommendedHookType && (
          <span className="text-[11px] text-th-tx3 bg-th-raised px-2.5 py-1 rounded-lg border border-th-border">
            {HOOK_LABELS[idea.recommendedHookType] || idea.recommendedHookType} hook
          </span>
        )}
      </div>

      {idea.relatedEpisodeTitles?.length > 0 && (
        <div>
          <p className="text-th-tx4 text-[11px] font-medium mb-1.5">Related episodes</p>
          <div className="space-y-1">
            {idea.relatedEpisodeTitles.map((t, i) => (
              <p key={i} className="text-th-tx4 text-[11px] truncate">· {t}</p>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onWriteScript(idea)}
        className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg bg-th-accent/10 hover:bg-th-accent/20 border border-th-accent/20 hover:border-th-accent/40 text-th-accent text-xs font-medium transition-colors"
      >
        <PenLine size={12} />
        Write Script
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

export default function Ideas({ episodes, channels = [], onWriteScript }) {
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [useCompetitors, setUseCompetitors] = useState(true);

  const primaryChannel = channels.find(c => c.isPrimary) || channels.find(c => !c.compareOnly);
  const compareChannels = channels.filter(c => c.compareOnly);
  const compareEpisodes = episodes.filter(e => compareChannels.some(c => c.id === e.channelId));
  const hasCompetitorData = compareEpisodes.filter(e => e.dimensions || e.viewCount > 0).length >= 5;

  const hasEnoughData = episodes
    .filter(e => primaryChannel ? e.channelId === primaryChannel.id : true)
    .filter(ep => ep.dimensions).length >= 3;

  useEffect(() => {
    fetchSavedIdeas()
      .then(saved => { if (saved) setIdeas(saved); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const myEpisodes = primaryChannel
        ? episodes.filter(e => e.channelId === primaryChannel.id)
        : episodes.filter(e => !compareChannels.some(c => c.id === e.channelId));
      const competitorData = useCompetitors && hasCompetitorData
        ? compareChannels.map(ch => ({
            name: ch.name,
            subscriberCount: ch.subscriberCount,
            topVideos: compareEpisodes
              .filter(e => e.channelId === ch.id && e.viewCount > 0)
              .sort((a, b) => b.viewCount - a.viewCount)
              .slice(0, 10)
              .map(e => ({
                title: e.title,
                viewCount: e.viewCount,
                topicCluster: e.dimensions?.topicCluster,
                hookType: e.dimensions?.hookType,
                contentType: e.dimensions?.contentType,
              })),
          })).filter(ch => ch.topVideos.length > 0)
        : null;
      const result = await generateEpisodeIdeas(myEpisodes, competitorData);
      setIdeas(result);
      await persistIdeas(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearIdeas();
      setIdeas(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const high = ideas?.filter(i => i.estimatedPotential === 'high') || [];
  const medium = ideas?.filter(i => i.estimatedPotential !== 'high') || [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b border-th-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg flex items-center gap-2">
              <Lightbulb size={17} className="text-amber-400" />
              Episode Ideas
            </h1>
            <p className="text-th-tx3 text-xs mt-0.5">
              AI analyses your channel patterns and suggests what to make next — and why it'll perform.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {compareChannels.length > 0 && (
              <button
                onClick={() => setUseCompetitors(v => !v)}
                title={hasCompetitorData ? 'Include competitor insights in idea generation' : 'Add competitor channels in the Compare tab first'}
                disabled={!hasCompetitorData}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  useCompetitors
                    ? 'border-th-accent/50 bg-th-accent/10 text-th-accent'
                    : 'border-th-border text-th-tx3 hover:text-th-tx1 hover:border-th-border/80'
                }`}
              >
                <Users size={13} />
                Competitor insights
                <span className={`w-7 h-4 rounded-full flex items-center transition-colors ${useCompetitors ? 'bg-th-accent' : 'bg-th-raised border border-th-border'}`}>
                  <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${useCompetitors ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </span>
              </button>
            )}
            {ideas && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-th-border text-th-tx4 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors"
              >
                <Trash2 size={13} />
                Clear
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading || !hasEnoughData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-sm transition-colors"
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" />Generating…</>
                : <><Sparkles size={14} />{ideas ? 'Regenerate' : 'Generate Ideas'}</>}
            </button>
          </div>
        </div>

        {!hasEnoughData && (
          <div className="mt-3 flex items-start gap-2 text-xs bg-amber-50 border border-amber-300 rounded-lg p-3 dark:bg-amber-500/10 dark:border-amber-500/20">
            <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-800 dark:text-amber-400">Analyse at least 3 episodes on the Intelligence page first — the AI needs dimension data to make good recommendations.</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={handleGenerate} className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          </div>
        )}

        {!ideas && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Lightbulb size={32} className="text-th-raised mb-3" />
            <p className="text-th-tx3 text-sm mb-1">No ideas generated yet</p>
            <p className="text-th-tx4 text-xs max-w-xs">
              Hit Generate Ideas and the AI will analyse your channel's performance patterns to suggest your next 9 episodes.
            </p>
          </div>
        )}

        {loading && !ideas && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 size={24} className="text-th-accent animate-spin" />
            <div className="text-center">
              <p className="text-th-tx1 text-sm font-medium">Analysing your channel…</p>
              <p className="text-th-tx3 text-xs mt-1">Finding gaps, follow-ups, and high-potential topics</p>
            </div>
          </div>
        )}

        {ideas && !loading && (
          <div className="space-y-8">
            {high.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <h2 className="text-th-tx1 text-sm font-semibold">High Potential</h2>
                  <span className="text-th-tx4 text-xs">{high.length} ideas</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {high.map((idea, i) => <IdeaCard key={i} idea={idea} onWriteScript={onWriteScript} />)}
                </div>
              </div>
            )}
            {medium.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-th-tx1 text-sm font-semibold">More Ideas</h2>
                  <span className="text-th-tx4 text-xs">{medium.length} ideas</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {medium.map((idea, i) => <IdeaCard key={i} idea={idea} onWriteScript={onWriteScript} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
