import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initApi } from './api/init';
import { getApiKey } from './api/client';
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

type AppState = 'loading' | 'setup' | 'login' | 'ready';

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

  if (appState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <BrowserRouter basename="/webui">
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />
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
          <Route path="log" element={<Log />} />
          <Route path="actions" element={<Actions />} />
          <Route path="plugins" element={<Plugins />} />
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
    </BrowserRouter>
  );
}
