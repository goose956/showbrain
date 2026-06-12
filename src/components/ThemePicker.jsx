import { useTheme } from '../contexts/ThemeContext';

const RINGS = {
  dark:     'ring-violet-500',
  light:    'ring-orange-400',
  midnight: 'ring-cyan-400',
};

export default function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="px-2 pb-2 shrink-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-th-tx4 px-1 mb-1.5">Theme</p>
      <div className="flex items-center gap-1.5">
        {themes.map(t => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            title={t.label}
            className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-all ${
              theme === t.id
                ? 'border-th-accent bg-th-accent/10 text-th-accent'
                : 'border-th-border text-th-tx4 hover:border-th-tx3 hover:text-th-tx2 bg-th-raised'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full border-2 shrink-0 ${theme === t.id ? `ring-2 ring-offset-1 ring-offset-th-sidebar ${RINGS[t.id]}` : 'border-th-border'}`}
              style={{ backgroundColor: t.swatch }}
            />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
