import {
  Gauge, TvMinimalPlay, LayoutDashboard, Search, BarChart2, Lightbulb,
  GitCompare, FlaskConical, PenLine, TrendingUp, Inbox, LineChart, Plug,
  ChevronDown, ChevronRight, HelpCircle,
} from 'lucide-react';
import { useState } from 'react';

const SECTIONS = [
  {
    title: 'Core',
    color: 'from-rose-500/10 to-blue-500/5',
    border: 'border-rose-500/20',
    items: [
      {
        id: 'overview',
        label: 'Dashboard',
        icon: Gauge,
        iconBg: 'bg-rose-500',
        description: 'Your at-a-glance summary for the primary channel.',
        bullets: [
          'Total episodes, views, likes, and comments — primary channel only',
          'Average video duration across your catalogue',
          'Channel info including subscriber count and date established',
          'Refresh button to pull in the latest stats without a full sync',
          'Auto-refreshes on login if your data is more than 24 hours old',
        ],
      },
      {
        id: 'channel',
        label: 'Channel',
        icon: TvMinimalPlay,
        iconBg: 'bg-blue-500',
        description: 'Manage your connected YouTube channels and run syncs.',
        bullets: [
          'Add your primary channel by URL, handle, or channel ID',
          'Add comparison channels to benchmark against (compare-only mode)',
          'Run a full sync to import all videos, transcribe audio, and analyse content',
          'Choose batch size and max videos per sync run to control speed vs. cost',
          'View sync progress live — estimated time remaining updates as videos are processed',
          'Remove channels you no longer need',
        ],
      },
      {
        id: 'dashboard',
        label: 'Library',
        icon: LayoutDashboard,
        iconBg: 'bg-indigo-500',
        description: 'Browse and manage every episode across all your channels.',
        bullets: [
          'View all episodes with thumbnails, publish date, views, and duration',
          'Filter by channel or search by title',
          'See transcription and analysis status at a glance',
          'Trigger individual transcription or re-analysis on any episode',
          'Click through to the full episode detail',
        ],
      },
    ],
  },
  {
    title: 'Analyse',
    color: 'from-violet-500/10 to-emerald-500/5',
    border: 'border-violet-500/20',
    items: [
      {
        id: 'search',
        label: 'Search',
        icon: Search,
        iconBg: 'bg-violet-500',
        description: 'Ask questions across your entire episode catalogue using AI.',
        bullets: [
          'Natural language search — ask anything about your content',
          'Claude reads summaries and topics from all analysed episodes',
          'Returns ranked results with relevant quotes and context',
          'Great for finding "did I cover X?", "which episodes mention Y?" and similar queries',
          'Works best after episodes have been transcribed and analysed',
        ],
      },
      {
        id: 'performance',
        label: 'Performance',
        icon: BarChart2,
        iconBg: 'bg-emerald-500',
        description: 'View stats and trends for your primary channel.',
        bullets: [
          'Total views, likes, comments, and average video duration',
          'Bar chart showing views per episode in chronological order',
          'Cumulative views area chart — see total views building over time',
          'Top 5 episodes by views and by likes',
          'Topic frequency — most common topics across analysed episodes',
          'Sentiment breakdown — only episodes that have been analysed',
          'Refresh stats button to pull fresh view counts from YouTube without a full sync',
        ],
      },
      {
        id: 'intelligence',
        label: 'Intelligence',
        icon: Lightbulb,
        iconBg: 'bg-amber-500',
        description: 'Deep AI analysis of individual episodes — dimensions, hooks, sentiment and more.',
        bullets: [
          'Select any analysed episode to see its full intelligence breakdown',
          'Dimensions — Claude extracts every content angle from the transcript automatically',
          'Hook type, sentiment, key topics, and a full summary',
          'Defaults to your primary channel automatically',
          'Episodes without transcripts show a prompt to transcribe first',
        ],
      },
      {
        id: 'compare',
        label: 'Compare',
        icon: GitCompare,
        iconBg: 'bg-cyan-500',
        description: 'Benchmark your channel against competitors.',
        bullets: [
          'Add any YouTube channel as a compare-only channel from the Channel page',
          'Side-by-side stats — subscriber count, total views, video count',
          'View their top-performing videos by view count',
          'Spot gaps and opportunities in your own content strategy',
          'Compare-only channels are synced for stats but not transcribed',
        ],
      },
    ],
  },
  {
    title: 'Create',
    color: 'from-pink-500/10 to-orange-500/5',
    border: 'border-pink-500/20',
    items: [
      {
        id: 'ideas',
        label: 'Ideas',
        icon: FlaskConical,
        iconBg: 'bg-pink-500',
        description: 'AI-generated episode ideas based on your existing content and gaps.',
        bullets: [
          'Claude analyses your back catalogue and suggests new episode angles',
          'Ideas are scored and explained — why this topic, why now',
          'Click any idea to send it straight to the Script Writer',
          'Regenerate at any time to get a fresh set of ideas',
          'Works best after a good number of episodes have been analysed',
        ],
      },
      {
        id: 'scriptwriter',
        label: 'Scripts',
        icon: PenLine,
        iconBg: 'bg-orange-500',
        description: 'AI script writing assistant for your next episode.',
        bullets: [
          'Start from scratch with a brief or send an idea directly from the Ideas page',
          'Claude drafts a full episode structure — intro, segments, outro',
          'Streams the script in real time so you can read as it writes',
          'Edit the brief and regenerate sections as needed',
          'Scripts are saved and accessible from this page',
        ],
      },
    ],
  },
  {
    title: 'Discover',
    color: 'from-yellow-500/10 to-orange-500/5',
    border: 'border-yellow-500/20',
    items: [
      {
        id: 'trending',
        label: 'Trending',
        icon: TrendingUp,
        iconBg: 'bg-yellow-500',
        description: 'Spot trending topics in your niche before they peak.',
        bullets: [
          'Track competitor channels — see their latest uploads and view velocity',
          'Keyword search — find recent high-performing videos for any topic',
          'RSS feeds — follow blogs, newsletters, or YouTube channels for early signals',
          'Watch any YouTube video in an in-page player without leaving the app',
          'Keywords that spike in views within 7 days surface as trending alerts',
          'YouTube Search API quota is 100 units per keyword search — use wisely',
        ],
      },
    ],
  },
  {
    title: 'Publish',
    color: 'from-purple-500/10 to-sky-500/5',
    border: 'border-purple-500/20',
    items: [
      {
        id: 'queue',
        label: 'Post Queue',
        icon: Inbox,
        iconBg: 'bg-purple-500',
        description: 'Manage AI-generated social posts for your episodes.',
        bullets: [
          'Auto-generated posts for Twitter/X, LinkedIn, and other platforms',
          'Edit any post before publishing',
          'Queue posts as draft, schedule, or publish directly',
          'View all posts grouped by episode',
        ],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: LineChart,
        iconBg: 'bg-sky-500',
        description: 'Track how your shared posts are performing.',
        bullets: [
          'Click tracking on posts you share via the app',
          'See which episodes drive the most traffic',
          'Platform breakdown — which channels convert best',
        ],
      },
      {
        id: 'publish',
        label: 'Connections',
        icon: Plug,
        iconBg: 'bg-teal-500',
        description: 'Connect external platforms for publishing.',
        bullets: [
          'Link your social accounts and publishing destinations',
          'Required before posts can be sent directly from the Post Queue',
        ],
      },
    ],
  },
];

function Item({ item }) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  return (
    <div className="border border-th-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-th-raised transition-colors text-left"
      >
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.iconBg}`}>
          <Icon size={14} className="text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-th-tx1 text-sm font-medium">{item.label}</p>
          <p className="text-th-tx3 text-xs truncate">{item.description}</p>
        </div>
        {open ? <ChevronDown size={14} className="text-th-tx4 shrink-0" /> : <ChevronRight size={14} className="text-th-tx4 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-th-border bg-th-raised/40">
          <ul className="space-y-1.5 mt-2">
            {item.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-th-tx2 text-xs">
                <span className="w-1 h-1 rounded-full bg-th-accent mt-1.5 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Help() {
  return (
    <div className="p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle size={22} className="text-th-accent" />
          <h1 className="text-th-tx1 text-2xl font-semibold">Help</h1>
        </div>
        <p className="text-th-tx3 text-sm mb-8">
          A breakdown of every section in ShowBrain — what it does and how to use it.
        </p>

        <div className="space-y-8">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <div className={`inline-flex items-center px-2.5 py-1 rounded-lg bg-gradient-to-r ${section.color} border ${section.border} mb-3`}>
                <span className="text-th-tx2 text-xs font-semibold tracking-wide uppercase">{section.title}</span>
              </div>
              <div className="space-y-2">
                {section.items.map(item => (
                  <Item key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-4 rounded-xl bg-th-raised border border-th-border">
          <p className="text-th-tx3 text-xs">
            <span className="text-th-tx1 font-medium">Getting started tip:</span> Add your channel → run a sync → then head to Intelligence to start analysing episodes. Once a few are analysed, Ideas and Search become much more powerful.
          </p>
        </div>
      </div>
    </div>
  );
}
