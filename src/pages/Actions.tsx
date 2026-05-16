import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Play, ShieldAlert, ShieldCheck } from 'lucide-react';
import { actionsApi } from '../api/actions';
import { ApiError } from '../api/client';
import { usersApi, User } from '../api/users';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { useToast } from '../components/ui/ToastProvider';

interface ActionDef {
  id: string;
  label: string;
  description: string;
  fn: () => Promise<void>;
  scope?: 'user' | 'admin';
  destructive?: boolean;
  confirmation?: string;
}

interface ActionGroup {
  title: string;
  scope: 'user' | 'admin';
  actions: ActionDef[];
}

const ACTION_GROUPS: ActionGroup[] = [
  {
    title: 'Library Import',
    scope: 'user',
    actions: [
      {
        id: 'run-import',
        label: 'Run Import',
        description: 'Scan managed folders, hash new files, update provider links, and fill missing images.',
        fn: actionsApi.runImport,
      },
      {
        id: 'import-new-files',
        label: 'Import New Files Only',
        description: 'Scan managed folders for new files without rescanning existing library entries.',
        fn: actionsApi.importNewFiles,
      },
      {
        id: 'remove-missing-files',
        label: 'Remove Missing Files',
        description: 'Remove database entries for files that are no longer available on disk.',
        fn: () => actionsApi.removeMissingFiles(true),
        destructive: true,
        confirmation: 'Remove database entries for missing files? This only affects records for files the server cannot access.',
      },
    ],
  },
  {
    title: 'Images and Metadata',
    scope: 'user',
    actions: [
      {
        id: 'update-all-images',
        label: 'Update All Images',
        description: 'Fetch missing images for locally known media.',
        fn: actionsApi.updateAllImages,
      },
      {
        id: 'validate-all-images',
        label: 'Validate All Images',
        description: 'Check existing images for corruption and queue replacement for invalid images.',
        fn: actionsApi.validateAllImages,
      },
      {
        id: 'search-tmdb',
        label: 'Search for TMDB Matches',
        description: 'Auto-match unlinked local movies and TV shows to TMDB metadata.',
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
        description: 'Fetch missing cast and crew records referenced by local metadata.',
        fn: actionsApi.downloadMissingTmdbPeople,
      },
    ],
  },
  {
    title: 'External State Sync',
    scope: 'user',
    actions: [
      {
        id: 'send-watch-states-trakt',
        label: 'Send Watch States to Trakt',
        description: 'Send local watch state to Trakt when the server has a linked Trakt account.',
        fn: actionsApi.sendWatchStatesToTrakt,
      },
      {
        id: 'get-watch-states-trakt',
        label: 'Get Watch States from Trakt',
        description: 'Import remote Trakt watch state into the local collection state.',
        fn: actionsApi.getWatchStatesFromTrakt,
      },
    ],
  },
  {
    title: 'Admin Maintenance',
    scope: 'admin',
    actions: [
      {
        id: 'update-media-info',
        label: 'Update All Media Info',
        description: 'Re-scan codecs, resolution, audio, and duration for every known local file.',
        fn: actionsApi.updateAllMediaInfo,
        scope: 'admin',
      },
      {
        id: 'update-series-stats',
        label: 'Update Series Stats',
        description: 'Recalculate series statistics and group filters.',
        fn: actionsApi.updateSeriesStats,
        scope: 'admin',
      },
      {
        id: 'rename-all-groups',
        label: 'Rename All Groups',
        description: 'Rename groups without custom names using the current language preference.',
        fn: actionsApi.renameAllGroups,
        scope: 'admin',
      },
      {
        id: 'recreate-all-groups',
        label: 'Recreate All Groups',
        description: 'Delete and regenerate all groups. Custom group names can be removed.',
        fn: actionsApi.recreateAllGroups,
        scope: 'admin',
        destructive: true,
        confirmation: 'Recreate all groups? This deletes and regenerates groups and can remove custom group names.',
      },
      {
        id: 'plex-sync-all',
        label: 'Sync Plex Watch States',
        description: 'Queue Plex watched-state sync jobs for users with Plex tokens configured.',
        fn: actionsApi.plexSyncAll,
        scope: 'admin',
      },
    ],
  },
  {
    title: 'Admin Purge Actions',
    scope: 'admin',
    actions: [
      {
        id: 'purge-unused-tmdb-movies',
        label: 'Purge Unused TMDB Movies',
        description: 'Remove TMDB movie records that are not linked to local media.',
        fn: actionsApi.purgeAllUnusedTmdbMovies,
        scope: 'admin',
        destructive: true,
        confirmation: 'Purge unused TMDB movie records? Local media files are not deleted.',
      },
      {
        id: 'purge-tmdb-movie-collections',
        label: 'Purge TMDB Movie Collections',
        description: 'Remove cached TMDB movie collection data.',
        fn: actionsApi.purgeAllTmdbMovieCollections,
        scope: 'admin',
        destructive: true,
        confirmation: 'Purge all TMDB movie collection records?',
      },
      {
        id: 'purge-unused-tmdb-images',
        label: 'Purge Unused TMDB Images',
        description: 'Remove TMDB images not linked to any local metadata records.',
        fn: actionsApi.purgeAllUnusedTmdbImages,
        scope: 'admin',
        destructive: true,
        confirmation: 'Purge unused TMDB images?',
      },
      {
        id: 'purge-unused-tmdb-shows',
        label: 'Purge Unused TMDB Shows',
        description: 'Remove TMDB show records that are not linked to local media.',
        fn: actionsApi.purgeAllUnusedTmdbShows,
        scope: 'admin',
        destructive: true,
        confirmation: 'Purge unused TMDB show records? Local media files are not deleted.',
      },
      {
        id: 'purge-tmdb-orderings',
        label: 'Purge TMDB Show Alternate Orderings',
        description: 'Remove cached alternate ordering data for TMDB shows.',
        fn: actionsApi.purgeAllTmdbShowAlternateOrderings,
        scope: 'admin',
        destructive: true,
        confirmation: 'Purge all TMDB show alternate ordering records?',
      },
      {
        id: 'purge-tmdb-links',
        label: 'Purge TMDB Links',
        description: 'Remove all local TMDB links and reset auto-linking state.',
        fn: () => actionsApi.purgeAllTmdbLinks(true, true, true),
        scope: 'admin',
        destructive: true,
        confirmation: 'Remove all TMDB movie and show links and reset auto-linking state?',
      },
      {
        id: 'purge-used-releases',
        label: 'Purge Used Releases',
        description: 'Clear selected release associations from known videos.',
        fn: () => actionsApi.purgeAllUsedReleases(true),
        scope: 'admin',
        destructive: true,
        confirmation: 'Purge used release associations from known videos?',
      },
      {
        id: 'purge-unused-releases',
        label: 'Purge Unused Releases',
        description: 'Remove release records not linked to any known videos.',
        fn: () => actionsApi.purgeAllUnusedReleases(true),
        scope: 'admin',
        destructive: true,
        confirmation: 'Purge unused release records?',
      },
    ],
  },
];

export default function Actions() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { notify } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    let stopped = false;
    usersApi.current()
      .then(user => { if (!stopped) setCurrentUser(user); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) navigate('/login');
      });
    return () => { stopped = true; };
  }, [navigate]);

  async function run(action: ActionDef) {
    if (action.scope === 'admin' && currentUser?.IsAdmin === false) {
      setResults(result => ({ ...result, [action.id]: 'error' }));
      setErrorMessages(result => ({ ...result, [action.id]: 'Admin permission required.' }));
      return;
    }
    if (action.confirmation) {
      const confirmed = await confirm({
        confirmLabel: action.destructive ? 'Run Action' : 'Continue',
        message: action.confirmation,
        title: action.destructive ? 'Confirm Admin Action' : 'Confirm Action',
        tone: action.destructive ? 'danger' : 'default',
      });
      if (!confirmed) return;
    }

    setRunning(result => ({ ...result, [action.id]: true }));
    setResults(result => {
      const next = { ...result };
      delete next[action.id];
      return next;
    });
    setErrorMessages(result => {
      const next = { ...result };
      delete next[action.id];
      return next;
    });
    try {
      await action.fn();
      setResults(result => ({ ...result, [action.id]: 'ok' }));
      notify({ message: `${action.label} was queued.`, tone: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setResults(result => ({ ...result, [action.id]: 'error' }));
      const message = err instanceof Error ? err.message : 'Action failed.';
      setErrorMessages(result => ({ ...result, [action.id]: message }));
      notify({ message, title: action.label, tone: 'error' });
    } finally {
      setRunning(result => ({ ...result, [action.id]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Actions</h1>
          <p className="mt-1 text-sm text-gray-500">Queue server maintenance jobs against files already managed by DaCollector.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-gray-700/50 bg-gray-900/40 px-3 py-2 text-xs text-gray-400">
          {currentUser?.IsAdmin ? <ShieldCheck size={14} className="text-emerald-400" /> : <ShieldAlert size={14} className="text-yellow-400" />}
          {currentUser?.IsAdmin ? 'Admin session' : 'User session'}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {ACTION_GROUPS.map(group => (
          <ActionGroupPanel
            key={group.title}
            group={group}
            isAdmin={Boolean(currentUser?.IsAdmin)}
            running={running}
            results={results}
            errorMessages={errorMessages}
            onRun={run}
          />
        ))}
      </div>
    </div>
  );
}

function ActionGroupPanel({
  group,
  isAdmin,
  running,
  results,
  errorMessages,
  onRun,
}: {
  group: ActionGroup;
  isAdmin: boolean;
  running: Record<string, boolean>;
  results: Record<string, 'ok' | 'error'>;
  errorMessages: Record<string, string>;
  onRun: (action: ActionDef) => void;
}) {
  const adminGroup = group.scope === 'admin';
  return (
    <section className={`rounded-md border bg-gray-900/40 ${adminGroup ? 'border-yellow-700/50' : 'border-gray-700/50'}`}>
      <div className="flex flex-col gap-2 border-b border-gray-700/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {adminGroup ? <ShieldAlert size={15} className="text-yellow-400" /> : <Play size={15} className="text-gray-400" />}
          <h2 className="text-sm font-semibold text-gray-200">{group.title}</h2>
        </div>
        {adminGroup && (
          <span className="text-xs text-yellow-400">Admin only</span>
        )}
      </div>
      <ul className="divide-y divide-gray-800/70">
        {group.actions.map(action => {
          const disabled = running[action.id] || (action.scope === 'admin' && !isAdmin);
          return (
            <li key={action.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-gray-100">{action.label}</p>
                  {action.scope === 'admin' && <span className="rounded bg-yellow-900/40 px-2 py-0.5 text-[11px] text-yellow-300">Admin</span>}
                  {action.destructive && <AlertTriangle size={13} className="text-red-400" />}
                </div>
                <p className="mt-1 text-sm text-gray-500">{action.description}</p>
                {results[action.id] === 'error' && (
                  <p className="mt-2 text-xs text-red-400">{errorMessages[action.id]}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {results[action.id] === 'ok' && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 size={13} />
                    Queued
                  </span>
                )}
                <button
                  disabled={disabled}
                  onClick={() => onRun(action)}
                  className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    action.destructive
                      ? 'border-red-500/70 bg-red-600 text-white hover:bg-red-500'
                      : action.scope === 'admin'
                        ? 'border-yellow-600/70 bg-yellow-900/50 text-yellow-100 hover:border-yellow-500'
                        : 'border-shoko-accent/80 bg-shoko-accent text-black hover:bg-shoko-accent/85'
                  }`}
                >
                  {running[action.id] ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                  ) : (
                    <Play size={13} />
                  )}
                  Run
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
