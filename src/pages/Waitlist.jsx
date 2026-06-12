import { useState } from 'react';
import {
  Zap, Brain, BarChart2, PenLine, GitCompare, Inbox,
  Lightbulb, CheckCircle, ArrowRight, Sparkles, Play,
  TrendingUp, Clock, Target, Users,
  Mail, MessageCircle, Repeat2, Share2, AtSign, Send,
} from 'lucide-react';

// ── data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Repeat2,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    title: 'Auto-Repurpose New Episodes',
    desc: 'The moment a new episode drops, ShowBrain transcribes it, extracts the best clips, angles, and quotes, and publishes ready-to-go posts to Twitter, LinkedIn, Instagram, and your email list — automatically.',
    highlight: true,
  },
  {
    icon: Brain,
    color: 'text-th-accent',
    bg: 'bg-th-accent/10 border-th-accent/20',
    title: 'Auto-Transcribe & Analyse',
    desc: 'Drop in your YouTube channel. ShowBrain downloads audio, transcribes every episode, and extracts format, hook type, content type, emotional tone — automatically.',
  },
  {
    icon: BarChart2,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    title: 'Episode Intelligence',
    desc: 'See exactly which formats, hooks, and topics drive the most views. Sort, filter, and surface the patterns hiding in your back catalogue.',
  },
  {
    icon: GitCompare,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Competitor Comparison',
    desc: 'Add any channel and compare average views, engagement, posting cadence, and content patterns side-by-side. Find the gaps your competitors are missing.',
  },
  {
    icon: Lightbulb,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    title: 'AI Episode Ideas',
    desc: 'Get 9 data-backed episode ideas ranked by potential — gaps in your niche, follow-up opportunities, trending angles — drawn from your real performance data.',
  },
  {
    icon: PenLine,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    title: 'Script Writer',
    desc: 'Go from idea to full script in minutes. AI pulls insights from your top-performing episodes to inform the hook, structure, and talking points.',
  },
];

const STEPS = [
  { n: '01', title: 'Add your channel', desc: 'Paste your YouTube URL. ShowBrain fetches your video library and stats instantly — no manual uploads.' },
  { n: '02', title: 'Fetch stats or transcribe', desc: 'Pull view/like/comment data for free, or transcribe your top & bottom performers to unlock deep AI analysis.' },
  { n: '03', title: 'Grow with data', desc: 'Use the Intelligence dashboard, Compare tool, and Script Writer to make every new episode better than the last.' },
];

const PAINS = [
  { icon: Clock, text: 'Hours writing show notes and social posts for every episode' },
  { icon: Target, text: 'No idea which episode formats actually grow your audience' },
  { icon: Users, text: 'Guessing what your competitors are doing right' },
  { icon: TrendingUp, text: 'New episodes get zero traction because repurposing takes too long' },
];

const PLATFORMS = [
  {
    icon: AtSign,
    label: 'Twitter / X',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    content: '"The #1 reason podcasts fail isn\'t content quality — it\'s consistency. Here\'s what the data shows after analysing 200+ episodes 🧵',
    tag: 'Thread hook',
  },
  {
    icon: Send,
    label: 'LinkedIn',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    content: 'We just published episode 47 of the podcast. The stat that surprised us most: solo episodes outperform interviews by 2.3× on our channel. Here\'s why that changed how we plan content...',
    tag: 'Professional post',
  },
  {
    icon: MessageCircle,
    label: 'Instagram',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    content: 'New episode just dropped 🎙️ We break down the exact framework that grew our podcast from 0 to 50k downloads. Link in bio #podcast #contentcreator #growthhacks',
    tag: 'Caption + hashtags',
  },
  {
    icon: Mail,
    label: 'Newsletter',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    content: 'This week we sat down to dig into the real numbers behind podcast growth. The short version: your hook matters more than your guest. Here\'s what the data told us — and how to use it.',
    tag: 'Email blurb',
  },
];

// ── mock UI card ──────────────────────────────────────────────────────────────

function MockCard({ title, value, sub, color = 'text-th-accent' }) {
  return (
    <div className="bg-th-surface/80 border border-th-border rounded-xl p-4">
      <p className="text-th-tx3 text-xs mb-2">{title}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-th-tx4 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function MockRow({ title, views, badge, badgeColor }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-th-border/60 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-th-tx2 text-xs truncate">{title}</p>
      </div>
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badgeColor}`}>{badge}</span>
      <span className="text-th-tx2 text-xs tabular-nums font-medium w-12 text-right">{views}</span>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function Waitlist({ onGoLogin }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-th-bg">
      {/* ── Nav bar ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-th-border/40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-th-accent flex items-center justify-center">
            <Zap size={13} className="text-th-accentFg" />
          </div>
          <span className="text-th-tx1 text-sm font-semibold">ShowBrain</span>
        </div>
        {onGoLogin && (
          <button
            onClick={onGoLogin}
            className="px-4 py-2 rounded-lg border border-th-border text-th-tx2 text-sm font-medium hover:border-th-accent hover:text-th-accent transition-colors"
          >
            Log in
          </button>
        )}
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-th-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-th-accent/10 border border-th-accent/25 text-th-accent text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <Zap size={11} />
            Now in private beta
          </div>

          <h1 className="text-5xl font-bold text-th-tx1 leading-tight tracking-tight mb-6">
            Record once.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-sky-400">
              Publish everywhere.
            </span>
          </h1>

          <p className="text-th-tx2 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            ShowBrain watches your YouTube channel and automatically repurposes every new episode into platform-native content for Twitter, LinkedIn, Instagram, and email — the moment it goes live.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="your@email.com"
                className="flex-1 bg-th-surface border border-th-border rounded-xl px-4 py-3 text-th-tx1 text-sm placeholder-th-tx3 focus:outline-none focus:border-th-accent transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-th-accent hover:bg-th-accentH text-th-accentFg text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? 'Joining…' : <>Join the waitlist <ArrowRight size={14} /></>}
              </button>
            </form>
          ) : (
            <div className="inline-flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 px-6 py-3 rounded-xl text-sm font-medium">
              <CheckCircle size={16} />
              You're on the list — we'll be in touch soon.
            </div>
          )}
          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

          <p className="text-th-tx4 text-xs mt-4">No credit card. No spam. Cancel anytime.</p>
        </div>
      </div>

      {/* ── Auto-Repurpose showcase ── */}
      <div className="max-w-4xl mx-auto px-8 pb-20">
        <div className="text-center mb-10">
          <p className="text-th-tx3 text-sm uppercase tracking-widest font-semibold mb-3">Auto-Repurpose</p>
          <h2 className="text-3xl font-bold text-th-tx1 mb-4">One episode. Four platforms. Zero effort.</h2>
          <p className="text-th-tx2 text-base max-w-xl mx-auto leading-relaxed">
            As soon as a new episode is detected on your channel, ShowBrain transcribes it, finds the strongest hooks and quotes, and generates posts tailored to each platform's style and audience.
          </p>
        </div>

        {/* Flow diagram */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="flex items-center gap-2 bg-th-surface border border-th-border rounded-xl px-4 py-3">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Play size={12} className="text-red-400 fill-red-400" />
            </div>
            <div>
              <p className="text-th-tx1 text-xs font-semibold">New episode live</p>
              <p className="text-th-tx4 text-[10px]">YouTube detects upload</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-th-tx4 shrink-0" />
          <div className="flex items-center gap-2 bg-th-surface border border-th-accent/30 rounded-xl px-4 py-3">
            <div className="w-7 h-7 rounded-lg bg-th-accent/10 border border-th-accent/20 flex items-center justify-center">
              <Brain size={12} className="text-th-accent" />
            </div>
            <div>
              <p className="text-th-tx1 text-xs font-semibold">ShowBrain analyses</p>
              <p className="text-th-tx4 text-[10px]">Transcribes + extracts hooks</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-th-tx4 shrink-0" />
          <div className="flex items-center gap-2 bg-th-surface border border-th-border rounded-xl px-4 py-3">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Share2 size={12} className="text-violet-400" />
            </div>
            <div>
              <p className="text-th-tx1 text-xs font-semibold">Posts published</p>
              <p className="text-th-tx4 text-[10px]">4 platforms, instantly</p>
            </div>
          </div>
        </div>

        {/* Platform posts mock */}
        <div className="grid grid-cols-2 gap-4">
          {PLATFORMS.map(({ icon: Icon, label, color, bg, content, tag }) => (
            <div key={label} className={`bg-th-surface/60 border rounded-xl p-4`} style={{ borderColor: 'var(--th-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${bg}`}>
                    <Icon size={13} className={color} />
                  </div>
                  <span className="text-th-tx2 text-xs font-semibold">{label}</span>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${bg} ${color}`}>{tag}</span>
              </div>
              <p className="text-th-tx3 text-xs leading-relaxed line-clamp-3">{content}</p>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-th-border/60">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-medium">Generated automatically</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mock UI preview ── */}
      <div className="max-w-4xl mx-auto px-8 pb-16">
        <div className="bg-th-surface/60 border border-th-border rounded-2xl p-6 backdrop-blur">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            <span className="text-th-tx4 text-xs ml-3">ShowBrain — Episode Intelligence</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MockCard title="Avg Views" value="42.1k" sub="↑ 18% last 30 days" color="text-th-accent" />
            <MockCard title="Best Format" value="Solo" sub="2.3× engagement rate" color="text-sky-400" />
            <MockCard title="Top Hook" value="Bold Claim" sub="Used in 8 of top 10 eps" color="text-emerald-400" />
          </div>
          <div className="bg-th-bg/60 border border-th-border rounded-xl px-4 py-1">
            <MockRow title="Why I Quit My $300k Job to Build a Podcast" views="128k" badge="Bold Claim" badgeColor="bg-red-500/10 border-red-500/20 text-red-300" />
            <MockRow title="The Podcasting Mistake Nobody Talks About" views="94k" badge="Solo" badgeColor="bg-sky-500/10 border-sky-500/20 text-sky-300" />
            <MockRow title="I Interviewed 50 Podcast Editors — Here's What They Said" views="71k" badge="Interview" badgeColor="bg-th-accent/10 border-th-accent/20 text-th-accent" />
            <MockRow title="Why Your Podcast Isn't Growing (Real Data)" views="63k" badge="Stat" badgeColor="bg-amber-500/10 border-amber-500/20 text-amber-300" />
          </div>
        </div>
      </div>

      {/* ── Pain points ── */}
      <div className="max-w-4xl mx-auto px-8 pb-20">
        <div className="text-center mb-12">
          <p className="text-th-tx3 text-sm uppercase tracking-widest font-semibold mb-3">Sound familiar?</p>
          <h2 className="text-3xl font-bold text-th-tx1">Podcasting is hard work.<br />The data shouldn't be.</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {PAINS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3 bg-th-surface/50 border border-th-border rounded-xl p-4">
              <div className="w-8 h-8 rounded-lg bg-th-raised flex items-center justify-center shrink-0">
                <Icon size={15} className="text-th-tx3" />
              </div>
              <p className="text-th-tx2 text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <div className="max-w-4xl mx-auto px-8 pb-20">
        <div className="text-center mb-12">
          <p className="text-th-tx3 text-sm uppercase tracking-widest font-semibold mb-3">Everything in one place</p>
          <h2 className="text-3xl font-bold text-th-tx1">Your entire podcast workflow,<br />supercharged by AI</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc, highlight }) => (
            <div
              key={title}
              className={`border rounded-xl p-5 transition-colors ${
                highlight
                  ? 'bg-gradient-to-br from-violet-500/10 to-sky-500/5 border-violet-500/30 col-span-2'
                  : 'bg-th-surface/50 border-th-border'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon size={16} className={color} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-th-tx1 text-sm font-semibold">{title}</h3>
                    {highlight && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-th-tx3 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="max-w-4xl mx-auto px-8 pb-20">
        <div className="text-center mb-12">
          <p className="text-th-tx3 text-sm uppercase tracking-widest font-semibold mb-3">How it works</p>
          <h2 className="text-3xl font-bold text-th-tx1">Up and running in minutes</h2>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="relative">
              <div className="text-5xl font-black text-th-raised mb-4 leading-none">{n}</div>
              <h3 className="text-th-tx1 text-sm font-semibold mb-2">{title}</h3>
              <p className="text-th-tx3 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Final CTA ── */}
      <div className="max-w-4xl mx-auto px-8 pb-24">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600/20 to-sky-600/10 border border-th-accent/25 rounded-2xl p-12 text-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-th-accent/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <Sparkles size={28} className="text-th-accent mx-auto mb-5" />
            <h2 className="text-3xl font-bold text-th-tx1 mb-4">Record once. Be everywhere.</h2>
            <p className="text-th-tx2 text-base mb-8 max-w-lg mx-auto leading-relaxed">
              Join podcasters using ShowBrain to grow faster, repurpose automatically, and stop spending hours on content that should take minutes.
            </p>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="your@email.com"
                  className="flex-1 bg-th-surface/80 border border-th-border rounded-xl px-4 py-3 text-th-tx1 text-sm placeholder-th-tx3 focus:outline-none focus:border-th-accent transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-th-accent hover:bg-th-accentH text-th-accentFg text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {loading ? 'Joining…' : <>Get early access <ArrowRight size={14} /></>}
                </button>
              </form>
            ) : (
              <div className="inline-flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 px-6 py-3 rounded-xl text-sm font-medium">
                <CheckCircle size={16} />
                You're on the list — we'll be in touch soon.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-th-border py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-th-accent flex items-center justify-center">
            <Zap size={11} className="text-th-accentFg" />
          </div>
          <span className="text-th-tx1 text-sm font-semibold">ShowBrain</span>
        </div>
        <p className="text-th-tx4 text-xs">Built for podcasters who want to grow with data, not guesswork.</p>
      </div>
    </div>
  );
}
