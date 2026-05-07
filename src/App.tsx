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
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
          <Route path="settings" element={<Settings />} />
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
