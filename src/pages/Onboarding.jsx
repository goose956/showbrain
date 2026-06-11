import { useState } from 'react';
import { Upload, Rss, Link, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { transcribeAudio, transcribeFromUrl } from '../lib/deepgram';
import { generateEpisodeSummary } from '../lib/claude';
import { mockEpisodes } from '../data/mockEpisodes';

export default function Onboarding({ onEpisodeAdded }) {
  const [mode, setMode] = useState('upload');
  const [rssUrl, setRssUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const reset = () => {
    setStatus(null);
    setError('');
    setResult(null);
    setFile(null);
    setRssUrl('');
    setAudioUrl('');
  };

  const handleFileUpload = async () => {
    if (!file) return;
    setError('');
    setStatus('transcribing');
    try {
      const transcript = await transcribeAudio(file);
      setStatus('analysing');
      const analysis = await generateEpisodeSummary(transcript);
      const ep = {
        id: `ep-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        show: 'My Podcast',
        publishedAt: new Date().toISOString().split('T')[0],
        duration: 3600,
        transcript,
        ...analysis,
        listens: 0,
        completionRate: 0,
        shareCount: 0,
      };
      setResult(ep);
      setStatus('done');
      onEpisodeAdded?.(ep);
    } catch (e) {
      setError(e.message);
      setStatus(null);
    }
  };

  const handleAudioUrl = async () => {
    if (!audioUrl) return;
    setError('');
    setStatus('transcribing');
    try {
      const transcript = await transcribeFromUrl(audioUrl);
      setStatus('analysing');
      const analysis = await generateEpisodeSummary(transcript);
      const ep = {
        id: `ep-${Date.now()}`,
        title: 'Episode from URL',
        show: 'My Podcast',
        publishedAt: new Date().toISOString().split('T')[0],
        duration: 3600,
        transcript,
        ...analysis,
        listens: 0,
        completionRate: 0,
        shareCount: 0,
      };
      setResult(ep);
      setStatus('done');
      onEpisodeAdded?.(ep);
    } catch (e) {
      setError(e.message);
      setStatus(null);
    }
  };

  const loadDemo = () => {
    const ep = mockEpisodes[Math.floor(Math.random() * mockEpisodes.length)];
    setResult(ep);
    setStatus('done');
    onEpisodeAdded?.(ep);
  };

  if (status === 'transcribing' || status === 'analysing') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 text-center">
        <Loader2 size={36} className="text-violet-400 animate-spin mb-4" />
        <h2 className="text-white text-lg font-medium mb-2">
          {status === 'transcribing' ? 'Transcribing audio…' : 'Analysing with Claude…'}
        </h2>
        <p className="text-zinc-500 text-sm max-w-xs">
          {status === 'transcribing'
            ? 'Deepgram is converting your audio to text. This may take a moment.'
            : 'Claude is extracting topics, sentiment, and generating your summary.'}
        </p>
      </div>
    );
  }

  if (status === 'done' && result) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle size={24} className="text-emerald-400" />
          <h2 className="text-white text-xl font-semibold">Episode processed</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <h3 className="text-white font-medium mb-1">{result.title}</h3>
          <p className="text-zinc-400 text-sm mb-3">{result.summary}</p>
          <div className="flex flex-wrap gap-2">
            {result.topics?.map((t) => (
              <span key={t} className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm transition-colors">
            Add another
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }))} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors">
            View dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-white text-2xl font-semibold mb-1">Add an episode</h1>
      <p className="text-zinc-500 text-sm mb-8">Upload audio, paste a URL, or import from RSS.</p>

      {/* Mode selector */}
      <div className="flex gap-2 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
        {[
          { id: 'upload', label: 'Upload', icon: Upload },
          { id: 'url', label: 'Audio URL', icon: Link },
          { id: 'rss', label: 'RSS Feed', icon: Rss },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-colors ${
              mode === id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {mode === 'upload' && (
        <div>
          <label
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors mb-4 ${
              file ? 'border-violet-500/60 bg-violet-500/5' : 'border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <Upload size={28} className={file ? 'text-violet-400' : 'text-zinc-600'} />
            <p className="text-sm mt-3 mb-1 text-zinc-300">{file ? file.name : 'Drop audio file or click to browse'}</p>
            <p className="text-xs text-zinc-600">MP3, MP4, WAV, M4A supported</p>
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </label>
          <button
            onClick={handleFileUpload}
            disabled={!file}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm transition-colors"
          >
            Transcribe &amp; Analyse
          </button>
        </div>
      )}

      {mode === 'url' && (
        <div>
          <input
            type="url"
            placeholder="https://example.com/episode.mp3"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 mb-4"
          />
          <button
            onClick={handleAudioUrl}
            disabled={!audioUrl}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm transition-colors"
          >
            Transcribe &amp; Analyse
          </button>
        </div>
      )}

      {mode === 'rss' && (
        <div>
          <input
            type="url"
            placeholder="https://feeds.simplecast.com/your-show"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 mb-4"
          />
          <p className="text-xs text-zinc-600 mb-4">RSS import will fetch and process your latest episodes automatically.</p>
          <button
            disabled
            className="w-full py-2.5 rounded-lg bg-zinc-800 text-zinc-500 cursor-not-allowed text-sm"
          >
            RSS Import (coming soon)
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
        <div className="relative flex justify-center"><span className="bg-zinc-950 px-3 text-xs text-zinc-600">or</span></div>
      </div>

      <button
        onClick={loadDemo}
        className="w-full py-2.5 rounded-lg border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-white text-sm transition-colors"
      >
        Load demo episode (no API key needed)
      </button>
    </div>
  );
}
