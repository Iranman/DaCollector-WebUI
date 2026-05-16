import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { parserApi, ParsedFilenameResult } from '../api/parser';
import { ApiError } from '../api/client';

export default function Parser() {
  const navigate = useNavigate();
  const [path, setPath] = useState('');
  const [result, setResult] = useState<ParsedFilenameResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await parserApi.parseFilename(path.trim());
      setResult(r);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate('/login');
      else setError(err instanceof Error ? err.message : 'Parse failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold text-white">Filename Parser</h1>

      <form onSubmit={handleParse} className="app-card rounded-md p-5 space-y-4">
        <p className="text-sm text-gray-400">
          Enter a movie or TV episode filename or full path to see how DaCollector parses it.
        </p>
        <div className="flex gap-3">
          <input
            className="flex-1 rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 app-focus outline-none"
            placeholder="/media/Movies/Inception (2010) [1080p].mkv"
            value={path}
            onChange={e => setPath(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !path.trim()}
            className="flex items-center gap-2 rounded-md bg-shoko-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-shoko-accent/85 disabled:opacity-50"
          >
            <ScanLine size={14} />
            {loading ? 'Parsing…' : 'Parse'}
          </button>
        </div>
      </form>

      {error && (
        <div className="app-card rounded-md border-red-700/50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {result && (
        <div className="app-card rounded-md divide-y divide-gray-800/50">
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-200">Result</h2>
            <KindBadge kind={result.Kind} />
          </div>

          <Row label="File" value={result.FileName} />
          {result.Title && <Row label="Title" value={result.Title} />}
          {result.ShowTitle && <Row label="Show" value={result.ShowTitle} />}
          {result.Year != null && <Row label="Year" value={String(result.Year)} />}
          {result.SeasonNumber != null && <Row label="Season" value={String(result.SeasonNumber)} />}
          {result.EpisodeNumbers.length > 0 && (
            <Row label="Episode(s)" value={result.EpisodeNumbers.join(', ')} />
          )}
          {result.AirDate && <Row label="Air Date" value={result.AirDate} />}
          {result.Quality && <Row label="Quality" value={result.Quality} />}
          {result.Source && <Row label="Source" value={result.Source} />}
          {result.Edition && <Row label="Edition" value={result.Edition} />}
          {result.VideoCodec && <Row label="Video" value={result.VideoCodec} />}
          {(result.AudioCodec || result.AudioChannels) && (
            <Row
              label="Audio"
              value={[result.AudioCodec, result.AudioChannels].filter(Boolean).join(' ')}
            />
          )}
          {result.HdrFormats.length > 0 && (
            <Row label="HDR" value={result.HdrFormats.join(', ')} />
          )}
          {result.ExternalIds.length > 0 && (
            <Row
              label="Provider IDs"
              value={result.ExternalIds.map(id => `${id.Source}:${id.Id}`).join(', ')}
            />
          )}

          {result.Warnings.length > 0 && (
            <div className="px-5 py-3 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Warnings</p>
              {result.Warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-400">{w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: ParsedFilenameResult['Kind'] }) {
  const cls =
    kind === 'Movie'
      ? 'bg-shoko-accent/15 text-shoko-accent'
      : kind === 'TvEpisode' || kind === 'MultiEpisodeTvFile'
      ? 'bg-purple-600/20 text-purple-400'
      : 'bg-gray-700/50 text-gray-400';
  const label = kind === 'MultiEpisodeTvFile' ? 'Multi-Episode' : kind;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 px-5 py-2.5">
      <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-sm text-gray-100 break-all">{value}</span>
    </div>
  );
}
