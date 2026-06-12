import { useState } from 'react';
import {
  Search, BarChart2, Lightbulb,
  Inbox, Plug, PenLine, FlaskConical,
  GitCompare, LineChart, ChevronDown, Zap, X,
  Gauge, TvMinimalPlay, LayoutDashboard,
} from 'lucide-react';

const TOP_NAV = [
  { id: 'overview',  label: 'Dashboard', icon: Gauge,           iconBg: 'bg-rose-500' },
  { id: 'channel',   label: 'Channel',   icon: TvMinimalPlay,   iconBg: 'bg-blue-500' },
  { id: 'dashboard', label: 'Library',   icon: LayoutDashboard, iconBg: 'bg-indigo-500' },
];

const nav = [
  {
    section: 'Analyse',
    color: 'from-violet-500/20 to-emerald-500/10',
    borderColor: 'border-violet-500/20',
    items: [
      { id: 'search',       label: 'Search',       icon: Search,     iconBg: 'bg-violet-500',  iconColor: 'text-white' },
      { id: 'performance',  label: 'Performance',  icon: BarChart2,  iconBg: 'bg-emerald-500', iconColor: 'text-white' },
      { id: 'intelligence', label: 'Intelligence', icon: Lightbulb,  iconBg: 'bg-amber-500',   iconColor: 'text-white' },
      { id: 'compare',      label: 'Compare',      icon: GitCompare, iconBg: 'bg-cyan-500',    iconColor: 'text-white' },
    ],
  },
  {
    section: 'Create',
    color: 'from-pink-500/20 to-orange-500/10',
    borderColor: 'border-pink-500/20',
    items: [
      { id: 'ideas',        label: 'Ideas',   icon: FlaskConical, iconBg: 'bg-pink-500',   iconColor: 'text-white' },
      { id: 'scriptwriter', label: 'Scripts', icon: PenLine,      iconBg: 'bg-orange-500', iconColor: 'text-white' },
    ],
  },
  {
    section: 'Publish',
    color: 'from-purple-500/20 to-teal-500/10',
    borderColor: 'border-purple-500/20',
    items: [
      { id: 'queue',     label: 'Post Queue',  icon: Inbox,     iconBg: 'bg-purple-500', iconColor: 'text-white' },
      { id: 'analytics', label: 'Analytics',   icon: LineChart, iconBg: 'bg-sky-500',    iconColor: 'text-white' },
      { id: 'publish',   label: 'Connections', icon: Plug,      iconBg: 'bg-teal-500',   iconColor: 'text-white' },
    ],
  },
];

function SidebarContent({ active, onChange, onClose }) {
  const initialOpen = () => {
    const s = {};
    nav.forEach(({ section }) => { s[section] = true; });
    return s;
  };

  const [open, setOpen] = useState(initialOpen);
  const toggle = (section) => setOpen(o => ({ ...o, [section]: !o[section] }));

  const handleClick = (id, section) => {
    if (section) setOpen(o => ({ ...o, [section]: true }));
    onChange(id);
    onClose?.();
  };

  return (
    <div className="w-52 h-full bg-th-sidebar border-r border-th-sborder flex flex-col">

      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="px-4 h-16 flex items-center justify-between border-b border-th-sborder shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-th-accent to-th-accentH flex items-center justify-center shadow-lg shrink-0">
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-th-tx1 font-bold text-sm tracking-tight">ShowBrain</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-th-tx4 hover:text-th-tx1 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Top nav (mobile only) ─────────────────────────────────── */}
      <div className="md:hidden px-2 pt-3 space-y-0.5">
        {TOP_NAV.map(({ id, label, icon: Icon, iconBg }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => handleClick(id)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs transition-all group ${
                isActive ? 'bg-white/10 text-th-tx1' : 'text-th-tx3 hover:text-th-tx1 hover:bg-white/5'
              }`}
            >
              <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${iconBg} ${isActive ? 'opacity-100' : 'opacity-55 group-hover:opacity-85'}`}>
                <Icon size={11} className="text-white" />
              </span>
              <span className="truncate">{label}</span>
              {isActive && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${iconBg} shrink-0`} />}
            </button>
          );
        })}
        <div className="border-t border-th-sborder mt-2 mb-1" />
      </div>

      {/* ── Nav sections ─────────────────────────────────────────── */}
      <nav className="flex-1 px-2 pt-3 space-y-1.5 overflow-y-auto pb-3">
        {nav.map(({ section, color, borderColor, items }) => {
          const isOpen = !!open[section];
          const hasActive = items.some(i => i.id === active);

          return (
            <div key={section} className={`rounded-xl border ${borderColor} bg-gradient-to-b ${color} overflow-hidden`}>
              <button
                onClick={() => toggle(section)}
                className="w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/5"
              >
                <span className={`text-[11px] font-semibold uppercase tracking-widest ${hasActive ? 'text-th-tx1' : 'text-th-tx3'}`}>
                  {section}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-th-tx4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                />
              </button>

              {isOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {items.map(({ id, label, icon: Icon, iconBg, iconColor }) => {
                    const isActive = active === id;
                    return (
                      <button
                        key={id}
                        onClick={() => handleClick(id, section)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-all group ${
                          isActive
                            ? 'bg-white/10 text-th-tx1 shadow-sm'
                            : 'text-th-tx3 hover:text-th-tx1 hover:bg-white/5'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                          isActive ? `${iconBg} shadow-sm` : `${iconBg} opacity-55 group-hover:opacity-85`
                        }`}>
                          <Icon size={11} className={iconColor} />
                        </span>
                        <span className="truncate">{label}</span>
                        {isActive && (
                          <span className={`ml-auto w-1.5 h-1.5 rounded-full ${iconBg} shrink-0`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export default function Sidebar({ active, onChange, isAdmin, isOpen, onClose }) {
  return (
    <>
      {/* Desktop — always visible */}
      <aside className="hidden md:flex h-screen shrink-0">
        <SidebarContent active={active} onChange={onChange} />
      </aside>

      {/* Mobile — drawer overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="relative z-10 h-full overflow-y-auto">
            <SidebarContent active={active} onChange={onChange} onClose={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
