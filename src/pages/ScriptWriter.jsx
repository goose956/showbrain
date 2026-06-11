import { useState, useEffect } from 'react';
import {
  Sparkles, Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  PenLine, Check, X, RotateCcw, Clock, Mic, BookOpen,
} from 'lucide-react';
import {
  analyseEpisodeDataForScript,
  generateEpisodeScript,
  regenerateScriptSection,
} from '../lib/claude';

// ── constants ─────────────────────────────────────────────────────────────────

const SECTION_COLORS = {
  hook:     { bg: 'bg-violet-500/10', border: 'border-violet-500/25', tag: 'bg-violet-500/20 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
  intro:    { bg: 'bg-sky-500/10',    border: 'border-sky-500/25',    tag: 'bg-sky-500/20 text-sky-300 border-sky-500/30',         dot: 'bg-sky-400' },
  chapter:  { bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   tag: 'bg-blue-500/20 text-blue-300 border-blue-500/30',      dot: 'bg-blue-400' },
  callback: { bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  tag: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   dot: 'bg-amber-400' },
  close:    { bg: 'bg-emerald-500/10',border: 'border-emerald-500/25',tag: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
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

const FORMAT_OPTIONS = Object.entries(FORMAT_LABELS).map(([id, label]) => ({ id, label }));
const HOOK_OPTIONS = Object.entries(HOOK_LABELS).map(([id, label]) => ({ id, label }));
const LENGTH_OPTIONS = ['15-20 mins', '20-30 mins', '30-40 mins', '40-50 mins', '50-60 mins', '60+ mins'];

// ── small helpers ─────────────────────────────────────────────────────────────

function Chip({ children, color = 'zinc' }) {
  const colors = {
    violet: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
    sky:    'bg-sky-500/15 text-sky-300 border-sky-500/25',
    amber:  'bg-amber-500/15 text-amber-300 border-amber-500/25',
    emerald:'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    zinc:   'bg-zinc-800 text-zinc-400 border-zinc-700',
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${colors[color] || colors.zinc}`}>
      {children}
    </span>
  );
}

function InlineError({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
      <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-red-300 text-sm">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
            <RefreshCw size={11} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stage 1 — Brief ───────────────────────────────────────────────────────────

function BriefInput({ onSubmit }) {
  const [brief, setBrief] = useState('');
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <PenLine size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">Script Writer</h1>
            <p className="text-zinc-500 text-xs">AI writes your next episode using patterns from your best-performing content.</p>
          </div>
        </div>

        <label className="text-xs text-zinc-500 font-medium mb-2 block">What's your next episode about?</label>
        <textarea
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder="e.g. avoiding burnout as a solo founder"
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500 transition-colors"
        />
        <button
          onClick={() => brief.trim() && onSubmit(brief.trim())}
          disabled={!brief.trim()}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          <Sparkles size={15} />
          Analyse My Data
        </button>
      </div>
    </div>
  );
}

// ── Stage 2 — Data Brief ──────────────────────────────────────────────────────

function DataBriefPanel({ brief, dataBrief, onProceed, onBack }) {
  const [format, setFormat] = useState(dataBrief.recommendedFormat);
  const [hookType, setHookType] = useState(dataBrief.recommendedHookType);
  const [length, setLength] = useState(dataBrief.recommendedLength);
  const [showAdjust, setShowAdjust] = useState(false);

  const overrides = { ...dataBrief, recommendedFormat: format, recommendedHookType: hookType, recommendedLength: length };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <button onClick={onBack} className="text-zinc-600 hover:text-zinc-400 text-xs mb-6 transition-colors">← Back</button>

      <h2 className="text-white font-semibold text-base mb-1">Data Brief</h2>
      <p className="text-zinc-500 text-xs mb-6">Based on your episode history for: <span className="text-zinc-300">"{brief}"</span></p>

      {/* Main recommendations */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-[11px] mb-2">Recommended Format</p>
          <Chip color="violet">{FORMAT_LABELS[format] || format}</Chip>
          <p className="text-zinc-500 text-[11px] mt-2 leading-relaxed">{dataBrief.formatReason}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-[11px] mb-2">Target Length</p>
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-sky-400" />
            <span className="text-white text-sm font-medium">{length}</span>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-[11px] mb-2">Recommended Hook</p>
          <Chip color="amber">{HOOK_LABELS[hookType] || hookType}</Chip>
          <p className="text-zinc-500 text-[11px] mt-2 leading-relaxed">{dataBrief.hookReason}</p>
        </div>
      </div>

      {/* Guest recommendation */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Mic size={13} className={dataBrief.guestRecommendation ? 'text-violet-400' : 'text-zinc-500'} />
          <span className="text-white text-xs font-medium">
            {dataBrief.guestRecommendation ? 'Guest recommended' : 'Solo recommended'}
          </span>
        </div>
        <p className="text-zinc-500 text-xs">{dataBrief.guestReason}</p>
      </div>

      {/* Callback suggestion */}
      {dataBrief.callbackSuggestion && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-4">
          <p className="text-violet-300 text-xs font-medium mb-1">Callback Suggestion</p>
          <p className="text-violet-200/80 text-sm leading-relaxed">{dataBrief.callbackSuggestion}</p>
        </div>
      )}

      {/* Past topic episodes */}
      {dataBrief.topicHistory?.length > 0 && (
        <div className="mb-5">
          <p className="text-zinc-500 text-xs font-medium mb-2">Related Past Episodes</p>
          <div className="space-y-2">
            {dataBrief.topicHistory.map((ep, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-start gap-3">
                <BookOpen size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-zinc-300 text-xs font-medium truncate">{ep.title}</p>
                  <p className="text-zinc-600 text-[11px] mt-0.5">{ep.relevantMoment}</p>
                  {ep.viewCount > 0 && (
                    <p className="text-zinc-700 text-[11px] mt-0.5">{ep.viewCount.toLocaleString()} views</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adjust settings */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden mb-5">
        <button
          onClick={() => setShowAdjust(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Adjust settings
          {showAdjust ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showAdjust && (
          <div className="px-4 pb-4 border-t border-zinc-800 space-y-4">
            <div className="mt-4">
              <label className="text-[11px] text-zinc-500 font-medium mb-2 block">Format override</label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setFormat(id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${format === id ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 font-medium mb-2 block">Hook type override</label>
              <div className="flex flex-wrap gap-2">
                {HOOK_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setHookType(id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${hookType === id ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 font-medium mb-2 block">Length override</label>
              <div className="flex flex-wrap gap-2">
                {LENGTH_OPTIONS.map(l => (
                  <button
                    key={l}
                    onClick={() => setLength(l)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${length === l ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onProceed(overrides)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
      >
        <PenLine size={15} />
        Write Script With These Settings
      </button>
    </div>
  );
}

// ── Stage 4 — Script section card ─────────────────────────────────────────────

function SectionCard({ section, brief, dataBrief, hostVoiceSample, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');
  const c = SECTION_COLORS[section.type] || SECTION_COLORS.chapter;

  const saveEdit = () => {
    onUpdate({ ...section, content: draft });
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(section.content);
    setEditing(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError('');
    try {
      const result = await regenerateScriptSection(section, brief, dataBrief, hostVoiceSample);
      onUpdate({ ...section, content: result.content, note: result.note });
    } catch (e) {
      setRegenError(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className="text-white text-sm font-medium">{section.label}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${c.tag}`}>
            {section.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-600 text-xs tabular-nums">{section.timestamp}</span>
          {!editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded-lg transition-colors"
              >
                <PenLine size={10} /> Edit
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
              >
                {regenerating ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                {regenerating ? 'Rewriting…' : 'Regenerate'}
              </button>
            </>
          )}
          {editing && (
            <>
              <button onClick={saveEdit} className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors">
                <Check size={10} /> Save
              </button>
              <button onClick={cancelEdit} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-lg transition-colors">
                <X size={10} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={10}
          className="w-full bg-zinc-900/80 border border-zinc-700 rounded-lg p-4 text-zinc-200 text-sm leading-relaxed resize-none focus:outline-none focus:border-violet-500 transition-colors"
        />
      ) : (
        <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{section.content}</div>
      )}

      {/* Note */}
      {section.note && !editing && (
        <p className="text-zinc-600 text-xs italic mt-4 pt-3 border-t border-white/5">{section.note}</p>
      )}

      {regenError && (
        <div className="mt-3">
          <InlineError message={regenError} onRetry={handleRegenerate} />
        </div>
      )}
    </div>
  );
}

// ── Stage 3/4 — Script display ────────────────────────────────────────────────

function ScriptDisplay({ script, brief, dataBrief, hostVoiceSample, onUpdate, onBack }) {
  const [title, setTitle] = useState(script.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(script.title);
  const [sections, setSections] = useState(script.sections);

  const updateSection = (idx, updated) => {
    const next = [...sections];
    next[idx] = updated;
    setSections(next);
    onUpdate({ ...script, sections: next });
  };

  const saveTitle = () => {
    setTitle(titleDraft);
    setEditingTitle(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <button onClick={onBack} className="text-zinc-600 hover:text-zinc-400 text-xs mb-6 transition-colors">← Back to data brief</button>

      {/* Title block */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-base font-semibold focus:outline-none focus:border-violet-500"
              onKeyDown={e => e.key === 'Enter' && saveTitle()}
            />
          ) : (
            <h2 className="text-white text-base font-semibold flex-1">{title}</h2>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {editingTitle ? (
              <>
                <button onClick={saveTitle} className="text-emerald-400 hover:text-emerald-300 p-1 transition-colors"><Check size={14} /></button>
                <button onClick={() => setEditingTitle(false)} className="text-zinc-500 hover:text-white p-1 transition-colors"><X size={14} /></button>
              </>
            ) : (
              <button onClick={() => { setTitleDraft(title); setEditingTitle(true); }} className="text-zinc-600 hover:text-zinc-400 p-1 transition-colors"><PenLine size={13} /></button>
            )}
          </div>
        </div>

        {/* Alt titles */}
        {script.altTitles?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {script.altTitles.map((t, i) => (
              <button
                key={i}
                onClick={() => { setTitle(t); setTitleDraft(t); }}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded-lg transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-zinc-500" />
            <span className="text-zinc-500 text-xs">{script.estimatedLength}</span>
          </div>
          <Chip color="violet">{FORMAT_LABELS[dataBrief.recommendedFormat] || dataBrief.recommendedFormat}</Chip>
          <Chip color="amber">{HOOK_LABELS[dataBrief.recommendedHookType] || dataBrief.recommendedHookType}</Chip>
        </div>
      </div>

      {/* Generate all assets button */}
      <div className="mb-6 group relative">
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-800 text-zinc-600 text-sm cursor-not-allowed bg-zinc-900/50"
        >
          <Sparkles size={14} />
          Generate All Assets — Show Notes, Social Posts & Newsletter →
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Generates show notes, chapters, social posts, email newsletter and YouTube description from this script
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-5">
        {sections.map((section, i) => (
          <SectionCard
            key={i}
            section={section}
            brief={brief}
            dataBrief={dataBrief}
            hostVoiceSample={hostVoiceSample}
            onUpdate={(updated) => updateSection(i, updated)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ScriptWriter({ episodes, initialBrief = null }) {
  const [stage, setStage] = useState('brief'); // brief | analysing | data-brief | writing | script
  const [brief, setBrief] = useState('');
  const [dataBrief, setDataBrief] = useState(null);
  const [script, setScript] = useState(null);
  const [error, setError] = useState('');

  // Auto-submit if launched from Ideas page
  useEffect(() => {
    if (initialBrief) {
      handleBriefSubmit(initialBrief);
    }
  }, []);

  // Related episodes for voice context (from topic history)
  const relatedEpisodes = dataBrief?.topicHistory
    ? dataBrief.topicHistory
        .map(h => episodes.find(ep => ep.id === h.episodeId || ep.title === h.title))
        .filter(Boolean)
    : [];

  const hostVoiceSample = episodes
    .filter(ep => ep.transcript)
    .slice(0, 2)
    .map(ep => ep.transcript.substring(0, 600))
    .join('\n\n');

  const handleBriefSubmit = async (text) => {
    setBrief(text);
    setError('');
    setStage('analysing');
    try {
      const result = await analyseEpisodeDataForScript(text, episodes);
      setDataBrief(result);
      setStage('data-brief');
    } catch (e) {
      setError(e.message);
      setStage('brief');
    }
  };

  const handleProceed = async (approvedBrief) => {
    setDataBrief(approvedBrief);
    setError('');
    setStage('writing');
    try {
      const result = await generateEpisodeScript(brief, approvedBrief, relatedEpisodes);
      setScript(result);
      setStage('script');
    } catch (e) {
      setError(e.message);
      setStage('data-brief');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-zinc-950">
      {/* Loading overlays */}
      {stage === 'analysing' && (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 size={28} className="text-violet-400 animate-spin" />
          <div className="text-center">
            <p className="text-white text-sm font-medium">Analysing your episode history…</p>
            <p className="text-zinc-500 text-xs mt-1">Finding patterns in your best-performing content</p>
          </div>
        </div>
      )}

      {stage === 'writing' && (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 size={28} className="text-violet-400 animate-spin" />
          <div className="text-center">
            <p className="text-white text-sm font-medium">Writing your script…</p>
            <p className="text-zinc-500 text-xs mt-1">Claude is learning your voice from past episodes</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && stage === 'brief' && (
        <div className="max-w-xl mx-auto pt-8 px-4 w-full">
          <InlineError message={error} />
        </div>
      )}

      {/* Stages */}
      {stage === 'brief' && (
        <BriefInput onSubmit={handleBriefSubmit} />
      )}

      {stage === 'data-brief' && dataBrief && (
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="max-w-2xl mx-auto pt-6 px-4">
              <InlineError message={error} />
            </div>
          )}
          <DataBriefPanel
            brief={brief}
            dataBrief={dataBrief}
            onProceed={handleProceed}
            onBack={() => setStage('brief')}
          />
        </div>
      )}

      {stage === 'script' && script && (
        <div className="flex-1 overflow-auto">
          <ScriptDisplay
            script={script}
            brief={brief}
            dataBrief={dataBrief}
            hostVoiceSample={hostVoiceSample}
            onUpdate={setScript}
            onBack={() => setStage('data-brief')}
          />
        </div>
      )}
    </div>
  );
}
