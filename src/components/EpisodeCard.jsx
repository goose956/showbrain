import { Clock, Headphones, Share2, Tag, CaptionsOff } from 'lucide-react';

const sentimentColors = {
  positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  negative: 'bg-red-500/10 text-red-400 border-red-500/20',
  neutral: 'bg-th-raised text-th-tx3 border-th-border',
  mixed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  critical: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function formatNumber(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export default function EpisodeCard({ episode, onClick }) {
  return (
    <div
      onClick={() => onClick?.(episode)}
      className="bg-th-surface border border-th-border rounded-xl p-5 hover:border-th-accent/30 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-th-tx3 mb-1">{episode.show}</p>
          <h3 className="text-th-tx1 font-medium text-sm leading-snug group-hover:text-th-accent transition-colors">
            {episode.title}
          </h3>
        </div>
        {episode.transcriptStatus === 'no_captions' ? (
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
            <CaptionsOff size={10} />
            No captions
          </span>
        ) : (
          <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${sentimentColors[episode.sentiment] || sentimentColors.neutral}`}>
            {episode.sentiment}
          </span>
        )}
      </div>

      <p className="text-th-tx2 text-xs leading-relaxed mb-4 line-clamp-2">
        {episode.summary}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {episode.topics.slice(0, 3).map((topic) => (
          <span key={topic} className="text-[11px] text-th-tx3 bg-th-raised px-2 py-0.5 rounded-full flex items-center gap-1">
            <Tag size={9} />
            {topic}
          </span>
        ))}
        {episode.topics.length > 3 && (
          <span className="text-[11px] text-th-tx4 px-2 py-0.5">+{episode.topics.length - 3}</span>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-th-tx3 border-t border-th-border pt-3">
        <span className="flex items-center gap-1.5"><Clock size={11} />{formatDuration(episode.duration)}</span>
        <span className="flex items-center gap-1.5"><Headphones size={11} />{formatNumber(episode.listens)}</span>
        <span className="flex items-center gap-1.5"><Share2 size={11} />{episode.shareCount}</span>
        <span className="ml-auto">{new Date(episode.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
    </div>
  );
}
