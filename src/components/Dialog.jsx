import { useEffect } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';

// ── Confirm modal ─────────────────────────────────────────────────────────────

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-th-surface border border-th-border rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${danger ? 'bg-red-500/15' : 'bg-th-accent/15'}`}>
            {danger ? <Trash2 size={15} className="text-red-400" /> : <AlertCircle size={15} className="text-th-accent" />}
          </div>
          <div>
            <p className="text-th-tx1 text-sm font-semibold">{title}</p>
            {message && <p className="text-th-tx3 text-xs mt-1 leading-relaxed">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-th-tx2 hover:text-th-tx1 hover:bg-th-raised border border-th-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-th-accent hover:bg-th-accentH text-th-accentFg'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Error toast ───────────────────────────────────────────────────────────────

export function ErrorToast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-start gap-3 bg-th-surface border border-red-500/30 rounded-xl p-4 shadow-xl max-w-sm">
      <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
      <p className="text-th-tx2 text-sm leading-relaxed flex-1">{message}</p>
      <button onClick={onClose} className="text-th-tx4 hover:text-th-tx1 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
