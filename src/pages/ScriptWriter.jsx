import { useState, useEffect } from 'react';
import {
  Sparkles, Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  PenLine, Check, X, RotateCcw, Clock, Mic, BookOpen, Trash2, FileText, Plus,
} from 'lucide-react';
import {
  analyseEpisodeDataForScript,
  generateEpisodeScript,
  regenerateScriptSection,
  fetchSavedScripts,
  persistScript,
  removeScript,
} from '../lib/claude';

const SECTION_COLORS = {
  hook:     { bg: 'bg-th-accent/10',     border: 'border-th-accent/25',     tag: 'bg-th-accent/20 text-th-accent border-th-accent/30',         dot: 'bg-th-accent' },
  intro:    { bg: 'bg-sky-500/10',       border: 'border-sky-500/25',       tag: 'bg-sky-500/20 text-sky-300 border-sky-500/30',               dot: 'bg-sky-400' },
  chapter:  { bg: 'bg-blue-500/10',      border: 'border-blue-500/25',      tag: 'bg-blue-500/20 text-blue-300 border-blue-500/30',            dot: 'bg-blue-400' },
  callback: { bg: 'bg-amber-500/10',     border: 'border-amber-500/25',     tag: 'bg-amber-500/20 text-amber-300 border-amber-500/30',         dot: 'bg-amber-400' },
  close:    { bg: 'bg-emerald-500/10',   border: 'border-emerald-500/25',   tag: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',   dot: 'bg-emerald-400' },
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

function Chip({ children, color = 'default' }) {
  const colors = {
    accent:  'bg-th-accent/15 text-th-accent border-th-accent/25',
    sky:     'bg-sky-500/15 text-sky-300 border-sky-500/25',
    amber:   'bg-amber-500/15 text-amber-300 border-amber-500/25',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    default: 'bg-th-raised text-th-tx3 border-th-border',
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${colors[color] || colors.default}`}>
      {children}
    </span>
  );
}

function InlineError({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
      <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-red-400 text-sm">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
            <RefreshCw size={11} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

function SavedScriptsList({ scripts, onLoad, onDelete }) {
  if (!scripts.length) return null;
  return (
    <div className="mb-8">
      <h2 className="text-th-tx1 text-sm font-semibold mb-3">Saved Scripts</h2>
      <div className="space-y-2">
        {scripts.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-3 bg-th-surface border border-th-border rounded-xl px-4 py-3 hover:border-th-accent/30 transition-colors">
            <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => onLoad(s)}>
              <FileText size={14} className="text-th-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-th-tx1 text-sm font-medium truncate">{s.script?.title || s.brief}</p>
                <p className="text-th-tx4 text-xs mt-0.5">{new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
            <button
              onClick={() => onDelete(s.id)}
              className="shrink-0 p-1.5 text-th-tx4 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefInput({ onSubmit, scripts, onLoad, onDelete }) {
  const [brief, setBrief] = useState('');
  return (
    <div className="flex flex-col h-full overflow-auto px-4 py-8">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-th-accent/10 border border-th-accent/20 flex items-center justify-center">
            <PenLine size={18} className="text-th-accent" />
          </div>
          <div>
            <h1 className="text-th-tx1 font-semibold text-lg">Script Writer</h1>
            <p className="text-th-tx3 text-xs">AI writes your next episode using patterns from your best-performing content.</p>
          </div>
        </div>

        <SavedScriptsList scripts={scripts} onLoad={onLoad} onDelete={onDelete} />

        <label className="text-xs text-th-tx3 font-medium mb-2 block">What's your next episode about?</label>
        <textarea
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder="e.g. avoiding burnout as a solo founder"
          rows={3}
          className="w-full bg-th-surface border border-th-border rounded-xl px-4 py-3 text-th-tx1 text-sm placeholder-th-tx3 resize-none focus:outline-none focus:border-th-accent transition-colors"
        />
        <button
          onClick={() => brief.trim() && onSubmit(brief.trim())}
          disabled={!brief.trim()}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-th-accent hover:bg-th-accentH disabled:opacity-40 disabled:cursor-not-allowed text-th-accentFg text-sm font-medium transition-colors"
        >
          <Sparkles size={15} />
          Analyse My Data
        </button>
      </div>
    </div>
  );
}

function DataBriefPanel({ brief, dataBrief, onProceed, onBack }) {
  const [format, setFormat] = useState(dataBrief.recommendedFormat);
  const [hookType, setHookType] = useState(dataBrief.recommendedHookType);
  const [length, setLength] = useState(dataBrief.recommendedLength);
  const [showAdjust, setShowAdjust] = useState(false);

  const overrides = { ...dataBrief, recommendedFormat: format, recommendedHookType: hookType, recommendedLength: length };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <button onClick={onBack} className="text-th-tx4 hover:text-th-tx2 text-xs mb-6 transition-colors">← Back</button>

      <h2 className="text-th-tx1 font-semibold text-base mb-1">Data Brief</h2>
      <p className="text-th-tx3 text-xs mb-6">Based on your episode history for: <span className="text-th-tx2">"{brief}"</span></p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-th-surface border border-th-border rounded-xl p-4">
          <p className="text-th-tx3 text-[11px] mb-2">Recommended Format</p>
          <Chip color="accent">{FORMAT_LABELS[format] || format}</Chip>
          <p className="text-th-tx3 text-[11px] mt-2 leading-relaxed">{dataBrief.formatReason}</p>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-4">
          <p className="text-th-tx3 text-[11px] mb-2">Target Length</p>
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-sky-400" />
            <span className="text-th-tx1 text-sm font-medium">{length}</span>
          </div>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-4">
          <p className="text-th-tx3 text-[11px] mb-2">Recommended Hook</p>
          <Chip color="amber">{HOOK_LABELS[hookType] || hookType}</Chip>
          <p className="text-th-tx3 text-[11px] mt-2 leading-relaxed">{dataBrief.hookReason}</p>
        </div>
      </div>

      <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Mic size={13} className={dataBrief.guestRecommendation ? 'text-th-accent' : 'text-th-tx3'} />
          <span className="text-th-tx1 text-xs font-medium">
            {dataBrief.guestRecommendation ? 'Guest recommended' : 'Solo recommended'}
          </span>
        </div>
        <p className="text-th-tx3 text-xs">{dataBrief.guestReason}</p>
      </div>

      {dataBrief.callbackSuggestion && (
        <div className="bg-th-accent/10 border border-th-accent/20 rounded-xl p-4 mb-4">
          <p className="text-th-accent text-xs font-medium mb-1">Callback Suggestion</p>
          <p className="text-th-tx1 text-sm leading-relaxed opacity-80">{dataBrief.callbackSuggestion}</p>
        </div>
      )}

      {dataBrief.topicHistory?.length > 0 && (
        <div className="mb-5">
          <p className="text-th-tx3 text-xs font-medium mb-2">Related Past Episodes</p>
          <div className="space-y-2">
            {dataBrief.topicHistory.map((ep, i) => (
              <div key={i} className="bg-th-surface border border-th-border rounded-xl p-3 flex items-start gap-3">
                <BookOpen size={13} className="text-th-tx3 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-th-tx2 text-xs font-medium truncate">{ep.title}</p>
                  <p className="text-th-tx4 text-[11px] mt-0.5">{ep.relevantMoment}</p>
                  {ep.viewCount > 0 && (
                    <p className="text-th-tx4 text-[11px] mt-0.5">{ep.viewCount.toLocaleString()} views</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-th-border rounded-xl overflow-hidden mb-5">
        <button
          onClick={() => setShowAdjust(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-th-tx3 hover:text-th-tx1 transition-colors"
        >
          Adjust settings
          {showAdjust ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showAdjust && (
          <div className="px-4 pb-4 border-t border-th-border space-y-4">
            <div className="mt-4">
              <label className="text-[11px] text-th-tx3 font-medium mb-2 block">Format override</label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map(({ id, label }) => (
                  <button key={id} onClick={() => setFormat(id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${format === id ? 'bg-th-accent/20 text-th-accent border-th-accent/40' : 'bg-th-raised text-th-tx3 border-th-border hover:text-th-tx1'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-th-tx3 font-medium mb-2 block">Hook type override</label>
              <div className="flex flex-wrap gap-2">
                {HOOK_OPTIONS.map(({ id, label }) => (
                  <button key={id} onClick={() => setHookType(id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${hookType === id ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-th-raised text-th-tx3 border-th-border hover:text-th-tx1'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-th-tx3 font-medium mb-2 block">Length override</label>
              <div className="flex flex-wrap gap-2">
                {LENGTH_OPTIONS.map(l => (
                  <button key={l} onClick={() => setLength(l)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${length === l ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-th-raised text-th-tx3 border-th-border hover:text-th-tx1'}`}>
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
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-th-accent hover:bg-th-accentH text-th-accentFg text-sm font-medium transition-colors"
      >
        <PenLine size={15} />
        Write Script With These Settings
      </button>
    </div>
  );
}

function SectionCard({ section, brief, dataBrief, hostVoiceSample, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');
  const c = SECTION_COLORS[section.type] || SECTION_COLORS.chapter;

  const saveEdit = () => { onUpdate({ ...section, content: draft }); setEditing(false); };
  const cancelEdit = () => { setDraft(section.content); setEditing(false); };

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className="text-th-tx1 text-sm font-medium">{section.label}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${c.tag}`}>
            {section.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-th-tx4 text-xs tabular-nums">{section.timestamp}</span>
          {!editing && (
            <>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-[11px] text-th-tx3 hover:text-th-tx1 bg-th-raised hover:bg-th-border border border-th-border px-2.5 py-1 rounded-lg transition-colors">
                <PenLine size={10} /> Edit
              </button>
              <button onClick={handleRegenerate} disabled={regenerating}
                className="flex items-center gap-1 text-[11px] text-th-tx3 hover:text-th-tx1 bg-th-raised hover:bg-th-border border border-th-border px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
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
              <button onClick={cancelEdit} className="flex items-center gap-1 text-[11px] text-th-tx3 hover:text-th-tx1 bg-th-raised border border-th-border px-2.5 py-1 rounded-lg transition-colors">
                <X size={10} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={10}
          className="w-full bg-th-surface border border-th-border rounded-lg p-4 text-th-tx1 text-sm leading-relaxed resize-none focus:outline-none focus:border-th-accent transition-colors"
        />
      ) : (
        <div className="text-th-tx2 text-sm leading-relaxed whitespace-pre-wrap">{section.content}</div>
      )}

      {section.note && !editing && (
        <p className="text-th-tx4 text-xs italic mt-4 pt-3 border-t border-th-border/50">{section.note}</p>
      )}

      {regenError && <div className="mt-3"><InlineError message={regenError} onRetry={handleRegenerate} /></div>}
    </div>
  );
}

function ScriptDisplay({ script, brief, dataBrief, hostVoiceSample, onUpdate, onBack, onDelete, scriptId }) {
  const [title, setTitle] = useState(script.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(script.title);
  const [sections, setSections] = useState(script.sections);

  const updateSection = (idx, updated) => {
    const next = [...sections]; next[idx] = updated; setSections(next);
    const updatedScript = { ...script, sections: next };
    onUpdate(updatedScript);
    persistScript(scriptId, brief, dataBrief, updatedScript).catch(() => {});
  };

  const saveTitle = () => {
    setTitle(titleDraft);
    setEditingTitle(false);
    const updatedScript = { ...script, title: titleDraft };
    onUpdate(updatedScript);
    persistScript(scriptId, brief, dataBrief, updatedScript).catch(() => {});
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-th-tx4 hover:text-th-tx2 text-xs transition-colors">← Back to data brief</button>
        <button
          onClick={() => onDelete(scriptId)}
          className="flex items-center gap-1.5 text-xs text-th-tx4 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} /> Delete script
        </button>
      </div>

      <div className="bg-th-surface border border-th-border rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          {editingTitle ? (
            <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
              className="flex-1 bg-th-raised border border-th-border rounded-lg px-3 py-2 text-th-tx1 text-base font-semibold focus:outline-none focus:border-th-accent"
              onKeyDown={e => e.key === 'Enter' && saveTitle()} />
          ) : (
            <h2 className="text-th-tx1 text-base font-semibold flex-1">{title}</h2>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {editingTitle ? (
              <>
                <button onClick={saveTitle} className="text-emerald-400 hover:text-emerald-300 p-1 transition-colors"><Check size={14} /></button>
                <button onClick={() => setEditingTitle(false)} className="text-th-tx3 hover:text-th-tx1 p-1 transition-colors"><X size={14} /></button>
              </>
            ) : (
              <button onClick={() => { setTitleDraft(title); setEditingTitle(true); }} className="text-th-tx4 hover:text-th-tx2 p-1 transition-colors"><PenLine size={13} /></button>
            )}
          </div>
        </div>

        {script.altTitles?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {script.altTitles.map((t, i) => (
              <button key={i} onClick={() => { setTitle(t); setTitleDraft(t); }}
                className="text-[11px] text-th-tx3 hover:text-th-tx1 bg-th-raised hover:bg-th-border border border-th-border px-2.5 py-1 rounded-lg transition-colors">
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-th-tx3" />
            <span className="text-th-tx3 text-xs">{script.estimatedLength}</span>
          </div>
          <Chip color="accent">{FORMAT_LABELS[dataBrief.recommendedFormat] || dataBrief.recommendedFormat}</Chip>
          <Chip color="amber">{HOOK_LABELS[dataBrief.recommendedHookType] || dataBrief.recommendedHookType}</Chip>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map((section, i) => (
          <SectionCard key={i} section={section} brief={brief} dataBrief={dataBrief} hostVoiceSample={hostVoiceSample} onUpdate={(u) => updateSection(i, u)} />
        ))}
      </div>
    </div>
  );
}

export default function ScriptWriter({ episodes, initialBrief = null }) {
  const [stage, setStage] = useState('list');
  const [brief, setBrief] = useState('');
  const [dataBrief, setDataBrief] = useState(null);
  const [script, setScript] = useState(null);
  const [scriptId, setScriptId] = useState(null);
  const [error, setError] = useState('');
  const [savedScripts, setSavedScripts] = useState([]);

  useEffect(() => {
    fetchSavedScripts().then(setSavedScripts).catch(() => {});
    if (initialBrief) handleBriefSubmit(initialBrief);
  }, []);

  const relatedEpisodes = dataBrief?.topicHistory
    ? dataBrief.topicHistory.map(h => episodes.find(ep => ep.id === h.episodeId || ep.title === h.title)).filter(Boolean)
    : [];

  const hostVoiceSample = episodes.filter(ep => ep.transcript).slice(0, 2).map(ep => ep.transcript.substring(0, 600)).join('\n\n');

  const handleBriefSubmit = async (text) => {
    setBrief(text); setError(''); setStage('analysing');
    try {
      const result = await analyseEpisodeDataForScript(text, episodes);
      setDataBrief(result); setStage('data-brief');
    } catch (e) { setError(e.message); setStage('list'); }
  };

  const handleProceed = async (approvedBrief) => {
    setDataBrief(approvedBrief); setError(''); setStage('writing');
    try {
      const result = await generateEpisodeScript(brief, approvedBrief, relatedEpisodes);
      const id = crypto.randomUUID();
      setScript(result);
      setScriptId(id);
      setStage('script');
      await persistScript(id, brief, approvedBrief, result);
      setSavedScripts(prev => [{ id, brief, dataBrief: approvedBrief, script: result, createdAt: new Date().toISOString() }, ...prev]);
    } catch (e) { setError(e.message); setStage('data-brief'); }
  };

  const handleLoadScript = (saved) => {
    setBrief(saved.brief);
    setDataBrief(saved.dataBrief);
    setScript(saved.script);
    setScriptId(saved.id);
    setStage('script');
  };

  const handleDeleteScript = async (id) => {
    await removeScript(id).catch(() => {});
    setSavedScripts(prev => prev.filter(s => s.id !== id));
    if (scriptId === id) setStage('list');
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-th-bg">
      {(stage === 'analysing' || stage === 'writing') && (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 size={28} className="text-th-accent animate-spin" />
          <div className="text-center">
            <p className="text-th-tx1 text-sm font-medium">
              {stage === 'analysing' ? 'Analysing your episode history…' : 'Writing your script…'}
            </p>
            <p className="text-th-tx3 text-xs mt-1">
              {stage === 'analysing' ? 'Finding patterns in your best-performing content' : 'AI is learning your voice from past episodes'}
            </p>
          </div>
        </div>
      )}

      {error && stage === 'list' && (
        <div className="max-w-xl mx-auto pt-8 px-4 w-full"><InlineError message={error} /></div>
      )}

      {stage === 'list' && (
        <BriefInput
          onSubmit={handleBriefSubmit}
          scripts={savedScripts}
          onLoad={handleLoadScript}
          onDelete={handleDeleteScript}
        />
      )}

      {stage === 'data-brief' && dataBrief && (
        <div className="flex-1 overflow-auto">
          {error && <div className="max-w-2xl mx-auto pt-6 px-4"><InlineError message={error} /></div>}
          <DataBriefPanel brief={brief} dataBrief={dataBrief} onProceed={handleProceed} onBack={() => setStage('list')} />
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
            onDelete={handleDeleteScript}
            scriptId={scriptId}
          />
        </div>
      )}
    </div>
  );
}
