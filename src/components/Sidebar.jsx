import { useState } from 'react';
import {
  LayoutDashboard, Search, BarChart2, Zap, Lightbulb,
  Inbox, TvMinimalPlay, Plug, PenLine, FlaskConical,
  GitCompare, LineChart, ChevronRight,
} from 'lucide-react';

const nav = [
  {
    section: 'Library',
    items: [
      { id: 'channel',   label: 'Channel',   icon: TvMinimalPlay },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Analyse',
    items: [
      { id: 'search',       label: 'Semantic Search', icon: Search },
      { id: 'performance',  label: 'Performance',     icon: BarChart2 },
      { id: 'intelligence', label: 'Intelligence',    icon: Lightbulb },
      { id: 'compare',      label: 'Compare',         icon: GitCompare },
    ],
  },
  {
    section: 'Create',
    items: [
      { id: 'ideas',        label: 'Episode Ideas', icon: FlaskConical },
      { id: 'scriptwriter', label: 'Script Writer', icon: PenLine },
    ],
  },
  {
    section: 'Publish',
    items: [
      { id: 'queue',     label: 'Post Queue',  icon: Inbox },
      { id: 'analytics', label: 'Analytics',   icon: LineChart },
      { id: 'publish',   label: 'Connections', icon: Plug },
    ],
  },
];

export default function Sidebar({ active, onChange }) {
  // All sections open by default; if active item is inside, keep it open
  const initialOpen = () => {
    const s = {};
    nav.forEach(({ section, items }) => {
      s[section] = items.some(i => i.id === active);
    });
    // Open at least the first section if nothing active
    if (!Object.values(s).some(Boolean)) s[nav[0].section] = true;
    return s;
  };

  const [open, setOpen] = useState(initialOpen);

  const toggle = (section) => setOpen(o => ({ ...o, [section]: !o[section] }));

  const handleClick = (id, section) => {
    // Ensure the section stays open when an item inside is selected
    setOpen(o => ({ ...o, [section]: true }));
    onChange(id);
  };

  return (
    <aside className="w-48 min-h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col pt-4 pb-4 shrink-0">
      {/* Logo */}
      <div className="px-4 mb-5 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center shrink-0">
          <Zap size={13} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">ShowBrain</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ section, items }) => {
          const isOpen = !!open[section];
          const hasActive = items.some(i => i.id === active);

          return (
            <div key={section}>
              {/* Section header */}
              <button
                onClick={() => toggle(section)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-widest transition-colors select-none ${
                  hasActive ? 'text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {section}
                <ChevronRight
                  size={11}
                  className={`transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Items */}
              {isOpen && (
                <div className="ml-2 border-l border-zinc-800 pl-2 mb-1 space-y-0.5">
                  {items.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => handleClick(id, section)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                        active === id
                          ? 'bg-violet-600 text-white'
                          : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <Icon size={13} className="shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
