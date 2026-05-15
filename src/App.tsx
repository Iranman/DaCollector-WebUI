import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { initApi } from './api/init';
import { getApiKey } from './api/client';
import AppProviders from './components/AppProviders';
import AppErrorBoundary from './components/AppErrorBoundary';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Collections from './pages/Collections';
import Settings from './pages/Settings';
import Utilities from './pages/Utilities';
import Log from './pages/Log';
import Actions from './pages/Actions';
import Plugins from './pages/Plugins';
import Media from './pages/Media';
import MediaDetail from './pages/MediaDetail';
import FileReview from './pages/FileReview';
import ManagedFolders from './pages/ManagedFolders';
import Parser from './pages/Parser';
import Unsupported from './pages/Unsupported';

type AppState = 'loading' | 'setup' | 'login' | 'ready';

interface AppRoutesProps {
  appState: AppState;
  onAuthenticated: () => void;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => {
    initApi.getStatus().then(status => {
      if (status.State === 'Waiting') {
        setAppState('setup');
      } else if (getApiKey()) {
        setAppState('ready');
      } else {
        setAppState('login');
      }
    }).catch(() => {
      setAppState(getApiKey() ? 'ready' : 'login');
    });
  }, []);

  function handleAuthenticated() {
    setAppState('ready');
  }

  if (appState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <AppProviders liveStateEnabled={appState === 'ready'}>
      <BrowserRouter basename="/webui">
        <AppRoutes appState={appState} onAuthenticated={handleAuthenticated} />
      </BrowserRouter>
    </AppProviders>
  );
}

function AppRoutes({ appState, onAuthenticated }: AppRoutesProps) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;

  return (
    <AppErrorBoundary resetKey={routeKey}>
      <Routes>
        <Route path="/setup" element={<Setup onAuthenticated={onAuthenticated} />} />
        <Route path="/login" element={<Login onAuthenticated={onAuthenticated} />} />
        <Route
          path="/"
          element={
            appState === 'setup' ? <Navigate to="/setup" replace /> :
            appState === 'login' ? <Navigate to="/login" replace /> :
            <Layout />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="collections" element={<Collections />} />
          <Route path="settings" element={<Navigate to="/settings/general" replace />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="media" element={<Media />} />
          <Route path="media/:kind/:provider/:providerID" element={<MediaDetail />} />
          <Route path="files" element={<FileReview />} />
          <Route path="folders" element={<ManagedFolders />} />
          <Route path="parser" element={<Parser />} />
          <Route path="utilities" element={<Utilities />} />
          <Route path="utilities/unrecognized" element={<Navigate to="/utilities/unrecognized/files" replace />} />
          <Route path="utilities/unrecognized/files" element={<Navigate to="/files?tab=unmatched" replace />} />
          <Route path="utilities/unrecognized/ignored-files" element={<Navigate to="/files?tab=unmatched&ignored=true" replace />} />
          <Route path="utilities/release-management" element={<Navigate to="/files?tab=duplicates" replace />} />
          <Route path="utilities/release-management/duplicates" element={<Navigate to="/files?tab=duplicates" replace />} />
          <Route path="utilities/release-management/missing" element={<Navigate to="/files?tab=missing" replace />} />
          <Route path="utilities/integrity" element={<Navigate to="/files?tab=integrity" replace />} />
          <Route path="utilities/renamer" element={<Navigate to="/files?tab=relocation" replace />} />
          <Route path="utilities/file-search" element={<Navigate to="/parser" replace />} />
          <Route path="utilities/parser" element={<Navigate to="/parser" replace />} />
          <Route path="utilities/folders" element={<Navigate to="/folders" replace />} />
          <Route path="log" element={<Log />} />
          <Route path="actions" element={<Actions />} />
          <Route path="plugins" element={<Plugins />} />
          <Route path="*" element={<Unsupported />} />
        </Route>
        <Route
          path="*"
          element={
            <Navigate
              to={appState === 'setup' ? '/setup' : appState === 'login' ? '/login' : '/dashboard'}
              replace
            />
          }
        />
      </Routes>
    </AppErrorBoundary>
  );
}
