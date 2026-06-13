import { TrendingUp, Headphones, Share2, Clock, BarChart2, Award } from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, color = 'accent' }) {
  const colors = {
    accent:  'text-th-accent bg-th-accent/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber:   'text-amber-400 bg-amber-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
  };
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={16} className={colors[color].split(' ')[0]} />
      </div>
      <p className="text-th-tx1 text-2xl font-semibold">{value}</p>
      <p className="text-th-tx2 text-sm">{label}</p>
      {sub && <p className="text-th-tx4 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function CompletionBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-th-raised rounded-full overflow-hidden">
        <div
          className="h-full bg-th-accent rounded-full"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs text-th-tx3 w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export default function Performance({ episodes, channels = [] }) {
  const primaryChannel = channels.find(c => c.isPrimary) || channels.find(c => !c.compareOnly) || channels[0];
  const eps = primaryChannel ? episodes.filter(ep => ep.channelId === primaryChannel.id) : episodes;

  if (eps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-th-tx4 text-sm">
        No episodes yet. Add some to see performance data.
      </div>
    );
  }

  const totalListens = eps.reduce((s, ep) => s + (ep.viewCount || 0), 0);
  const totalShares = eps.reduce((s, ep) => s + (ep.likeCount || 0), 0);
  const totalComments = eps.reduce((s, ep) => s + (ep.commentCount || 0), 0);
  const avgDuration = eps.reduce((s, ep) => s + (ep.duration || 0), 0) / eps.length;

  const withViews = eps.filter(ep => ep.viewCount > 0);
  const topByListens = [...withViews].sort((a, b) => b.viewCount - a.viewCount);
  const topByLikes = [...withViews].sort((a, b) => b.likeCount - a.likeCount);

  const topicCounts = {};
  eps.forEach((ep) => {
    ep.topics?.forEach((t) => {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    });
  });
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const sentimentCounts = {};
  eps.forEach((ep) => {
    if (!ep.sentiment) return;
    sentimentCounts[ep.sentiment] = (sentimentCounts[ep.sentiment] || 0) + 1;
  });

  const chartEps = [...eps]
    .filter(ep => ep.viewCount > 0)
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
  const maxViews = Math.max(...chartEps.map(ep => ep.viewCount), 1);

  return (
    <div className="p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-th-tx1 text-2xl font-semibold mb-6">Performance</h1>

        {chartEps.length > 0 && (
          <div className="bg-th-surface border border-th-border rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} className="text-th-accent" />
              <h2 className="text-th-tx1 text-sm font-semibold">Views by Episode</h2>
              <span className="text-th-tx4 text-xs ml-auto">{chartEps.length} episodes</span>
            </div>
            <div className="flex items-end gap-px h-32 overflow-x-auto pb-1">
              {chartEps.map((ep) => {
                const pct = (ep.viewCount / maxViews) * 100;
                return (
                  <div key={ep.id} className="group relative flex-shrink-0 flex flex-col items-center justify-end h-full" style={{ minWidth: Math.max(4, Math.floor(320 / chartEps.length)) + 'px' }}>
                    <div
                      className="w-full bg-th-accent/70 hover:bg-th-accent rounded-sm transition-colors cursor-default"
                      style={{ height: `${pct}%` }}
                    />
                    {/* tooltip */}
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-th-raised border border-th-border rounded-lg px-2.5 py-1.5 text-center whitespace-nowrap shadow-lg">
                        <p className="text-th-tx1 text-xs font-medium">{formatNumber(ep.viewCount)} views</p>
                        <p className="text-th-tx4 text-[10px] max-w-[160px] truncate">{ep.title}</p>
                      </div>
                      <div className="w-1.5 h-1.5 bg-th-raised border-r border-b border-th-border rotate-45 -mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-th-tx4 text-[10px]">Oldest</span>
              <span className="text-th-tx4 text-[10px]">Newest</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Views"    value={formatNumber(totalListens)}  icon={Headphones} color="accent" />
          <StatCard label="Total Likes"    value={formatNumber(totalShares)}   icon={Share2}     color="emerald" />
          <StatCard label="Total Comments" value={formatNumber(totalComments)} icon={TrendingUp} color="amber" />
          <StatCard label="Avg Duration"   value={formatDuration(avgDuration)} icon={Clock}      color="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Headphones size={15} className="text-th-accent" />
              <h2 className="text-th-tx1 text-sm font-semibold">Top by Views</h2>
            </div>
            {topByListens.length === 0
              ? <p className="text-th-tx4 text-xs">Fetch stats to see view counts.</p>
              : <div className="space-y-3">
                  {topByListens.slice(0, 5).map((ep, i) => (
                    <div key={ep.id} className="flex items-center gap-3">
                      <span className="text-xs text-th-tx4 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-th-tx1 text-xs font-medium truncate">{ep.title}</p>
                        <p className="text-th-tx3 text-xs">{formatNumber(ep.viewCount)} views · {formatNumber(ep.likeCount)} likes</p>
                      </div>
                      {i === 0 && <Award size={14} className="text-amber-400 shrink-0" />}
                    </div>
                  ))}
                </div>
            }
          </div>

          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} className="text-emerald-400" />
              <h2 className="text-th-tx1 text-sm font-semibold">Top by Likes</h2>
            </div>
            {topByLikes.length === 0
              ? <p className="text-th-tx4 text-xs">Fetch stats to see like counts.</p>
              : <div className="space-y-3">
                  {topByLikes.slice(0, 5).map((ep, i) => (
                    <div key={ep.id} className="flex items-center gap-3">
                      <span className="text-xs text-th-tx4 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-th-tx1 text-xs font-medium truncate">{ep.title}</p>
                        <p className="text-th-tx3 text-xs">{formatNumber(ep.likeCount)} likes · {formatNumber(ep.commentCount)} comments</p>
                      </div>
                      {i === 0 && <Award size={14} className="text-amber-400 shrink-0" />}
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <h2 className="text-th-tx1 text-sm font-semibold mb-4">Topic Frequency</h2>
            {topTopics.length === 0
              ? <p className="text-th-tx4 text-xs">Analyse episodes on the Intelligence page to see topics.</p>
              : <div className="flex flex-wrap gap-2">
                  {topTopics.map(([topic, count]) => (
                    <span
                      key={topic}
                      className="text-xs text-th-accent bg-th-accent/10 border border-th-accent/20 px-2.5 py-1 rounded-full"
                      style={{ opacity: 0.5 + (count / topTopics[0][1]) * 0.5 }}
                    >
                      {topic} <span className="opacity-60">×{count}</span>
                    </span>
                  ))}
                </div>
            }
          </div>

          <div className="bg-th-surface border border-th-border rounded-xl p-5">
            <h2 className="text-th-tx1 text-sm font-semibold mb-4">Sentiment Breakdown</h2>
            {Object.keys(sentimentCounts).length === 0
              ? <p className="text-th-tx4 text-xs">Analyse episodes on the Intelligence page to see sentiment.</p>
              : <div className="space-y-2">
                  {Object.entries(sentimentCounts).map(([sentiment, count]) => (
                    <div key={sentiment} className="flex items-center gap-3">
                      <span className="text-xs text-th-tx2 w-16 capitalize">{sentiment}</span>
                      <div className="flex-1 h-1.5 bg-th-raised rounded-full overflow-hidden">
                        <div className="h-full bg-th-accent rounded-full" style={{ width: `${(count / eps.length) * 100}%` }} />
                      </div>
                      <span className="text-xs text-th-tx3 w-4 text-right">{count}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
