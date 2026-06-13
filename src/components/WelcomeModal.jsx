import { TvMinimalPlay, GitCompare, X, ArrowRight } from 'lucide-react';
import Logo from './Logo';

export default function WelcomeModal({ username, onClose, onNavigate }) {
  const handleNavigate = (page) => {
    onClose();
    onNavigate(page);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-th-surface border border-th-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-th-border">
          <div className="flex items-center gap-3 mb-4">
            <Logo size={32} />
            <div>
              <p className="text-th-tx4 text-xs">Welcome to</p>
              <p className="text-th-tx1 font-bold text-lg leading-none tracking-tight">ShowBrain</p>
            </div>
          </div>
          <h2 className="text-th-tx1 text-xl font-semibold">
            Hey {username}, let's get you set up 👋
          </h2>
          <p className="text-th-tx3 text-sm mt-1">
            Two quick steps unlock almost everything in the app.
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4">

          <button
            onClick={() => handleNavigate('channel')}
            className="w-full flex items-start gap-4 p-4 rounded-xl border border-th-border hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
              <TvMinimalPlay size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Step 1</span>
              </div>
              <p className="text-th-tx1 text-sm font-semibold mt-0.5">Add your main channel</p>
              <p className="text-th-tx3 text-xs mt-0.5 leading-relaxed">
                Paste your YouTube URL. ShowBrain will sync your episodes, transcribe them, and start analysing — unlocking Search, Intelligence, Performance, Ideas, and Scripts.
              </p>
            </div>
            <ArrowRight size={14} className="text-th-tx4 group-hover:text-blue-400 shrink-0 mt-1 transition-colors" />
          </button>

          <button
            onClick={() => handleNavigate('channel')}
            className="w-full flex items-start gap-4 p-4 rounded-xl border border-th-border hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center shrink-0">
              <GitCompare size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Step 2</span>
              </div>
              <p className="text-th-tx1 text-sm font-semibold mt-0.5">Add competitor channels</p>
              <p className="text-th-tx3 text-xs mt-0.5 leading-relaxed">
                Add channels in your niche as compare-only. No transcription — just stats. Unlocks the Compare tab so you can benchmark against the competition and spot gaps.
              </p>
            </div>
            <ArrowRight size={14} className="text-th-tx4 group-hover:text-cyan-400 shrink-0 mt-1 transition-colors" />
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <p className="text-th-tx4 text-xs">You can always add channels later from the Channel page.</p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-th-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get started
          </button>
        </div>

        {/* Dismiss X */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-th-tx4 hover:text-th-tx1 hover:bg-th-raised transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
