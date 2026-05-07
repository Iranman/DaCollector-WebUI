import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initApi } from '../api/init';
import { authApi } from '../api/auth';
import { setApiKey, getApiKey } from '../api/client';

type Step = 'credentials' | 'waiting';

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Starting up…');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await initApi.setDefaultUser({ Username: username, Password: password });
      await initApi.completeSetup();
      setStep('waiting');
      pollForReady();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed.');
      setSubmitting(false);
    }
  }

  function pollForReady() {
    pollRef.current = setInterval(async () => {
      try {
        const status = await initApi.getStatus();
        setStatusMsg(status.StartupMessage ?? `State: ${status.State}`);
        if (status.State === 'Started') {
          clearInterval(pollRef.current!);
          const resp = await authApi.login({ user: username, pass: password, device: 'WebUI' });
          setApiKey(resp.apikey);
          navigate('/dashboard');
        } else if (status.State === 'Failed') {
          clearInterval(pollRef.current!);
          setError(`Server failed to start: ${status.StartupMessage ?? 'Unknown error'}`);
          setStep('credentials');
        }
      } catch {
        // server may be restarting — keep polling
      }
    }, 1500);
  }

  useEffect(() => {
    if (getApiKey()) {
      navigate('/dashboard');
      return;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [navigate]);

  if (step === 'waiting') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-100">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-300">{statusMsg}</p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-100">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-indigo-400">DaCollector</h1>
          <p className="mt-1 text-sm text-gray-400">Create your admin account to get started.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Setting up…' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
