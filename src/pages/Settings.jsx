import { useState, useEffect } from 'react';
import { Zap, Loader2, CheckCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? 'bg-th-accent' : 'bg-th-border'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => setSettings({}));
  }, []);

  const update = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={18} className="animate-spin text-th-tx4" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-th-tx1 font-semibold text-lg">Settings</h1>
          <p className="text-th-tx3 text-xs mt-0.5">Configure how ShowBrain works for you.</p>
        </div>
        {saving && <Loader2 size={14} className="animate-spin text-th-tx4" />}
        {saved && !saving && (
          <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <CheckCircle size={13} /> Saved
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Auto-repurpose */}
        <div className="bg-th-surface border border-th-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-th-accent" />
                <p className="text-th-tx1 text-sm font-medium">Auto-repurpose new episodes</p>
              </div>
              <p className="text-th-tx3 text-xs leading-relaxed">
                When a new episode is detected during sync, ShowBrain automatically generates
                Twitter, LinkedIn, Instagram, and newsletter drafts and adds them to your Post Queue
                for review.
              </p>
            </div>
            <Toggle
              enabled={!!settings.autoRepurpose}
              onChange={(val) => update('autoRepurpose', val)}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
