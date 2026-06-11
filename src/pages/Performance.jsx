import { TrendingUp, Headphones, Share2, Clock, BarChart2, Award } from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, color = 'violet' }) {
  const colors = {
    violet: 'text-violet-400 bg-violet-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={16} className={colors[color].split(' ')[0]} />
      </div>
      <p className="text-white text-2xl font-semibold">{value}</p>
      <p className="text-zinc-400 text-sm">{label}</p>
      {sub && <p className="text-zinc-600 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function CompletionBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-500 rounded-full"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500 w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

function formatNumber(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export default function Performance({ episodes }) {
  if (episodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        No episodes yet. Add some to see performance data.
      </div>
    );
  }

  const totalListens = episodes.reduce((s, ep) => s + ep.listens, 0);
  const totalShares = episodes.reduce((s, ep) => s + ep.shareCount, 0);
  const avgCompletion = episodes.reduce((s, ep) => s + ep.completionRate, 0) / episodes.length;
  const avgDuration = episodes.reduce((s, ep) => s + ep.duration, 0) / episodes.length;

  const topByListens = [...episodes].sort((a, b) => b.listens - a.listens);
  const topByShares = [...episodes].sort((a, b) => b.shareCount - a.shareCount);
  const topByCompletion = [...episodes].sort((a, b) => b.completionRate - a.completionRate);

  // Topic frequency
  const topicCounts = {};
  episodes.forEach((ep) => {
    ep.topics?.forEach((t) => {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    });
  });
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Sentiment breakdown
  const sentimentCounts = {};
  episodes.forEach((ep) => {
    sentimentCounts[ep.sentiment] = (sentimentCounts[ep.sentiment] || 0) + 1;
  });

  return (
    <div className="p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-white text-2xl font-semibold mb-6">Performance</h1>

        {/* Overview stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Listens" value={formatNumber(totalListens)} icon={Headphones} color="violet" />
          <StatCard label="Total Shares" value={formatNumber(totalShares)} icon={Share2} color="emerald" />
          <StatCard label="Avg Completion" value={`${Math.round(avgCompletion * 100)}%`} icon={TrendingUp} color="amber" />
          <StatCard label="Avg Duration" value={formatDuration(avgDuration)} icon={Clock} color="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top by listens */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Headphones size={15} className="text-violet-400" />
              <h2 className="text-white text-sm font-semibold">Top by Listens</h2>
            </div>
            <div className="space-y-3">
              {topByListens.slice(0, 4).map((ep, i) => (
                <div key={ep.id} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{ep.title}</p>
                    <p className="text-zinc-500 text-xs">{formatNumber(ep.listens)} listens</p>
                  </div>
                  {i === 0 && <Award size={14} className="text-amber-400 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Completion rates */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} className="text-emerald-400" />
              <h2 className="text-white text-sm font-semibold">Completion Rates</h2>
            </div>
            <div className="space-y-3">
              {topByCompletion.map((ep) => (
                <div key={ep.id}>
                  <p className="text-xs text-zinc-400 truncate mb-1">{ep.title}</p>
                  <CompletionBar value={ep.completionRate} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Topic frequency */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white text-sm font-semibold mb-4">Topic Frequency</h2>
            <div className="flex flex-wrap gap-2">
              {topTopics.map(([topic, count]) => (
                <span
                  key={topic}
                  className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full"
                  style={{ opacity: 0.5 + (count / topTopics[0][1]) * 0.5 }}
                >
                  {topic} <span className="text-violet-400/60">×{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Sentiment breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white text-sm font-semibold mb-4">Sentiment Breakdown</h2>
            <div className="space-y-2">
              {Object.entries(sentimentCounts).map(([sentiment, count]) => (
                <div key={sentiment} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-16 capitalize">{sentiment}</span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${(count / episodes.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-4 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
