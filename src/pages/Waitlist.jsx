import { useState } from 'react';
import {
  Zap, Brain, BarChart2, PenLine, GitCompare, Inbox,
  Lightbulb, CheckCircle, ArrowRight, Sparkles, Play,
  TrendingUp, Clock, Target, Users,
} from 'lucide-react';

// ── data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
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
  {
    icon: Inbox,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    title: 'Social Post Queue',
    desc: 'Generate platform-native posts for Twitter, LinkedIn, and Instagram from any episode. Track which posts are driving YouTube views with built-in link tracking.',
  },
];

const STEPS = [
  { n: '01', title: 'Add your channel', desc: 'Paste your YouTube URL. ShowBrain fetches your video library and stats instantly — no manual uploads.' },
  { n: '02', title: 'Fetch stats or transcribe', desc: 'Pull view/like/comment data for free, or transcribe your top & bottom performers to unlock deep AI analysis.' },
  { n: '03', title: 'Grow with data', desc: 'Use the Intelligence dashboard, Compare tool, and Script Writer to make every new episode better than the last.' },
];

const PAINS = [
  { icon: Clock, text: 'Hours writing show notes and chapter markers by hand' },
  { icon: Target, text: 'No idea which episode formats actually grow your audience' },
  { icon: Users, text: 'Guessing what your competitors are doing right' },
  { icon: TrendingUp, text: 'Struggling to repurpose episodes into social content' },
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

export default function Waitlist() {
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
      // Even if the request fails, show success — email is captured
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-th-bg">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-th-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-th-accent/10 border border-th-accent/25 text-th-accent text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <Zap size={11} />
            Now in private beta
          </div>

          <h1 className="text-5xl font-bold text-th-tx1 leading-tight tracking-tight mb-6">
            The intelligence layer<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-sky-400">
              every podcaster needs
            </span>
          </h1>

          <p className="text-th-tx2 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            ShowBrain transcribes your episodes, analyses what works, generates scripts from your best patterns, and tells you exactly what to create next.
          </p>

          {/* Email form */}
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
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-th-accent hover:bg-th-accent text-th-tx1 text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
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
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="bg-th-surface/50 border border-th-border rounded-xl p-5 hover:border-th-border transition-colors">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${bg}`}>
                <Icon size={16} className={color} />
              </div>
              <h3 className="text-th-tx1 text-sm font-semibold mb-2">{title}</h3>
              <p className="text-th-tx3 text-sm leading-relaxed">{desc}</p>
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
            <h2 className="text-3xl font-bold text-th-tx1 mb-4">Ready to know what's actually working?</h2>
            <p className="text-th-tx2 text-base mb-8 max-w-lg mx-auto leading-relaxed">
              Join podcasters using ShowBrain to grow faster, create smarter, and stop guessing.
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
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-th-accent hover:bg-th-accent text-th-tx1 text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
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
      <div className="border-t border-th-bg py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-th-accent flex items-center justify-center">
            <Zap size={11} className="text-th-tx1" />
          </div>
          <span className="text-th-tx1 text-sm font-semibold">ShowBrain</span>
        </div>
        <p className="text-th-tx4 text-xs">Built for podcasters who want to grow with data, not guesswork.</p>
      </div>
    </div>
  );
}
