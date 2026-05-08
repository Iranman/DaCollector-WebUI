import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, AlertTriangle } from 'lucide-react';
import { actionsApi } from '../api/actions';
import { ApiError } from '../api/client';

interface ActionDef {
  id: string;
  label: string;
  description: string;
  fn: () => Promise<void>;
  destructive?: boolean;
}

const ACTION_GROUPS: { title: string; actions: ActionDef[] }[] = [
  {
    title: 'Import',
    actions: [
      {
        id: 'run-import',
        label: 'Run Import',
        description: 'Scan managed folders, hash new files, update community site links, and download missing images.',
        fn: actionsApi.runImport,
      },
      {
        id: 'import-new-files',
        label: 'Import New Files Only',
        description: 'Scan managed folders for new files only, without rescanning existing ones.',
        fn: actionsApi.importNewFiles,
      },
      {
        id: 'remove-missing-files',
        label: 'Remove Missing Files',
        description: 'Remove database entries for files that no longer exist on disk.',
        fn: () => actionsApi.removeMissingFiles(true),
        destructive: true,
      },
    ],
  },
  {
    title: 'Images',
    actions: [
      {
        id: 'update-all-images',
        label: 'Update All Images',
        description: 'Download any missing images for series, episodes, and movies.',
        fn: actionsApi.updateAllImages,
      },
      {
        id: 'validate-all-images',
        label: 'Validate All Images',
        description: 'Check existing images for corruption and re-download any that are invalid.',
        fn: actionsApi.validateAllImages,
      },
    ],
  },
  {
    title: 'TMDB',
    actions: [
      {
        id: 'search-tmdb',
        label: 'Search for TMDB Matches',
        description: 'Auto-match unlinked movies and TV shows to TMDB metadata.',
        fn: actionsApi.searchForTmdbMatches,
      },
      {
        id: 'update-tmdb-shows',
        label: 'Update All TMDB Shows',
        description: 'Refresh all TMDB show metadata in the local database.',
        fn: actionsApi.updateAllTmdbShows,
      },
      {
        id: 'update-tmdb-movies',
        label: 'Update All TMDB Movies',
        description: 'Refresh all TMDB movie metadata in the local database.',
        fn: actionsApi.updateAllTmdbMovies,
      },
      {
        id: 'download-tmdb-people',
        label: 'Download Missing TMDB People',
        description: 'Fetch any missing cast and crew data from TMDB.',
        fn: actionsApi.downloadMissingTmdbPeople,
      },
    ],
  },
  {
    title: 'Database',
    actions: [
      {
        id: 'update-media-info',
        label: 'Update All Media Info',
        description: 'Re-scan media info (codecs, resolution, audio) for all files.',
        fn: actionsApi.updateAllMediaInfo,
        destructive: true,
      },
      {
        id: 'update-series-stats',
        label: 'Update Series Stats',
        description: 'Recalculate all series statistics and group filters.',
        fn: actionsApi.updateSeriesStats,
        destructive: true,
      },
      {
        id: 'recreate-all-groups',
        label: 'Recreate All Groups',
        description: 'Delete and regenerate all series groups. This will remove any custom group names.',
        fn: actionsApi.recreateAllGroups,
        destructive: true,
      },
    ],
  },
];

export default function Actions() {
  const navigate = useNavigate();
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  async function run(action: ActionDef) {
    setRunning(r => ({ ...r, [action.id]: true }));
    setResults(r => { const n = { ...r }; delete n[action.id]; return n; });
    setErrorMessages(r => { const n = { ...r }; delete n[action.id]; return n; });
    try {
      await action.fn();
      setResults(r => ({ ...r, [action.id]: 'ok' }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setResults(r => ({ ...r, [action.id]: 'error' }));
      setErrorMessages(r => ({ ...r, [action.id]: err instanceof Error ? err.message : 'Action failed.' }));
    } finally {
      setRunning(r => ({ ...r, [action.id]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold text-white">Actions</h1>

      {ACTION_GROUPS.map(group => (
        <div key={group.title} className="app-card rounded-md">
          <div className="border-b border-gray-700/50 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-200">{group.title}</h2>
          </div>
          <ul className="divide-y divide-gray-800/50">
            {group.actions.map(action => (
              <li key={action.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-100">{action.label}</p>
                    {action.destructive && (
                      <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                  {results[action.id] === 'error' && (
                    <p className="text-xs text-red-400 mt-1">{errorMessages[action.id]}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {results[action.id] === 'ok' && (
                    <span className="text-xs text-green-400">Queued</span>
                  )}
                  <button
                    disabled={running[action.id]}
                    onClick={() => run(action)}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                      action.destructive
                        ? 'bg-red-700/60 hover:bg-red-600/80 text-red-100'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {running[action.id] ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    ) : (
                      <Play size={11} />
                    )}
                    Run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
