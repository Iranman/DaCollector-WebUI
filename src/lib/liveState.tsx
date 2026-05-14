import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, getApiKey } from '../api/client';
import {
  DaCollectorStatus,
  dacollectorStatusApi,
} from '../api/dacollectorStatus';
import { ComponentVersionSet, ServerStatus, initApi } from '../api/init';
import { QueueStatus, queueApi } from '../api/queue';
import { User, usersApi } from '../api/users';
import { webuiApi } from '../api/webui';
import { buildConnection } from './signalr';

interface UpdateState {
  checking: boolean;
  serverAvailable: boolean;
  webuiAvailable: boolean;
  error?: string;
}

interface LiveState {
  status: ServerStatus | null;
  versions: ComponentVersionSet | null;
  readiness: DaCollectorStatus | null;
  currentUser: User | null;
  queue: QueueStatus | null;
  queueConnection: 'connecting' | 'live' | 'offline';
  updateState: UpdateState;
  readinessWarnings: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const defaultUpdateState: UpdateState = {
  checking: false,
  serverAvailable: false,
  webuiAvailable: false,
};

const LiveStateContext = createContext<LiveState | null>(null);

export function LiveStateProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [versions, setVersions] = useState<ComponentVersionSet | null>(null);
  const [readiness, setReadiness] = useState<DaCollectorStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [queueConnection, setQueueConnection] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [updateState, setUpdateState] = useState<UpdateState>(defaultUpdateState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !getApiKey()) return;
    setLoading(true);
    setError(null);

    try {
      const [statusResult, versionResult, userResult, queueResult, readinessResult] = await Promise.allSettled([
        initApi.getStatus(),
        initApi.getVersion(),
        usersApi.current(),
        queueApi.get(),
        dacollectorStatusApi.get(),
      ]);

      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
      if (versionResult.status === 'fulfilled') setVersions(versionResult.value);
      if (userResult.status === 'fulfilled') setCurrentUser(userResult.value);
      if (queueResult.status === 'fulfilled') setQueue(queueResult.value);
      if (readinessResult.status === 'fulfilled') setReadiness(readinessResult.value);

      const firstRejected = [statusResult, versionResult, userResult, queueResult, readinessResult]
        .find(result => result.status === 'rejected');
      if (firstRejected?.status === 'rejected') {
        const reason = firstRejected.reason;
        if (!(reason instanceof ApiError && reason.status === 401)) {
          setError(reason instanceof Error ? reason.message : 'Failed to load live status.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setVersions(null);
      setReadiness(null);
      setCurrentUser(null);
      setQueue(null);
      setQueueConnection('offline');
      setUpdateState(defaultUpdateState);
      return;
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(interval);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !getApiKey()) return undefined;

    let stopped = false;
    setQueueConnection('connecting');
    const conn = buildConnection('/signalr/aggregate');

    function applyQueue(state: QueueStatus) {
      if (!stopped) setQueue(state);
    }

    conn.on('queue:connected', applyQueue);
    conn.on('queue:state.changed', applyQueue);
    conn.onreconnected(() => {
      if (!stopped) {
        setQueueConnection('live');
        conn.invoke('feed.join_single', 'queue').catch(() => undefined);
      }
    });
    conn.onclose(() => {
      if (!stopped) setQueueConnection('offline');
    });
    conn.start()
      .then(() => {
        if (stopped) return undefined;
        setQueueConnection('live');
        return conn.invoke('feed.join_single', 'queue');
      })
      .catch(() => {
        if (!stopped) setQueueConnection('offline');
      });

    return () => {
      stopped = true;
      conn.stop();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !versions) return;

    let stopped = false;
    setUpdateState(current => ({ ...current, checking: true, error: undefined }));

    Promise.allSettled([
      webuiApi.latestServerVersion('Auto', false),
      webuiApi.latestVersion('Auto', false, false),
    ]).then(([serverResult, webuiResult]) => {
      if (stopped) return;
      const serverAvailable = serverResult.status === 'fulfilled'
        && isNewerVersion(serverResult.value.Version, versions.Server.Version);
      const webuiAvailable = webuiResult.status === 'fulfilled'
        && isNewerVersion(webuiResult.value.Version, versions.WebUI?.Version);
      const failed = [serverResult, webuiResult].find(result => result.status === 'rejected');
      setUpdateState({
        checking: false,
        error: failed?.status === 'rejected' && failed.reason instanceof Error ? failed.reason.message : undefined,
        serverAvailable,
        webuiAvailable,
      });
    });

    return () => { stopped = true; };
  }, [enabled, versions]);

  const readinessWarnings = useMemo(() => collectReadinessWarnings(status, readiness), [readiness, status]);

  const value = useMemo<LiveState>(() => ({
    currentUser,
    error,
    loading,
    queue,
    queueConnection,
    readiness,
    readinessWarnings,
    refresh,
    status,
    updateState,
    versions,
  }), [currentUser, error, loading, queue, queueConnection, readiness, readinessWarnings, refresh, status, updateState, versions]);

  return (
    <LiveStateContext.Provider value={value}>
      {children}
    </LiveStateContext.Provider>
  );
}

export function useLiveState() {
  const context = useContext(LiveStateContext);
  if (!context) {
    throw new Error('useLiveState must be used inside LiveStateProvider.');
  }
  return context;
}

function collectReadinessWarnings(status: ServerStatus | null, readiness: DaCollectorStatus | null) {
  const warnings: string[] = [];

  if (status?.State === 'Waiting') warnings.push('First-run setup is waiting.');
  if (status?.State === 'Failed') warnings.push(status.StartupMessage ?? 'Server startup failed.');

  readiness?.Providers.forEach(provider => {
    provider.Warnings.forEach(warning => warnings.push(`${provider.Name}: ${warning}`));
  });
  readiness?.PlexTarget.Warnings.forEach(warning => warnings.push(`Plex: ${warning}`));

  return warnings;
}

function isNewerVersion(candidate?: string, current?: string) {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) return false;
  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] > currentParts[index]) return true;
    if (candidateParts[index] < currentParts[index]) return false;
  }
  return false;
}

function parseVersion(value?: string) {
  if (!value) return null;
  const core = value.split('-')[0];
  const parts = core.split('.').map(part => Number(part));
  if (parts.length < 2 || parts.some(part => Number.isNaN(part))) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
