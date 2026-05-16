import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { initApi } from '../api/init';
import { authApi } from '../api/auth';
import { setApiKey, getApiKey } from '../api/client';
import BrandMark from '../components/BrandMark';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';

type Step = 'credentials' | 'waiting';

export default function Setup({ onAuthenticated }: { onAuthenticated: () => void }) {
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
      let status;
      try {
        status = await initApi.getStatus();
      } catch {
        return; // server still booting, try again next tick
      }

      setStatusMsg(status.StartupMessage ?? `State: ${status.State}`);

      if (status.State === 'Started') {
        clearInterval(pollRef.current!);
        try {
          const resp = await authApi.login({ user: username, pass: password, device: 'WebUI' });
          setApiKey(resp.apikey);
          // flushSync commits the state update synchronously so the route guard
          // reflects appState='ready' before navigate() fires, preventing the
          // '/' route from bouncing us back to /setup.
          flushSync(() => onAuthenticated());
          navigate('/dashboard');
        } catch (loginErr) {
          setError(loginErr instanceof Error ? loginErr.message : 'Login failed after setup — try logging in manually.');
          setStep('credentials');
          setSubmitting(false);
        }
      } else if (status.State === 'Failed') {
        clearInterval(pollRef.current!);
        setError(`Server failed to start: ${status.StartupMessage ?? 'Unknown error'}`);
        setStep('credentials');
        setSubmitting(false);
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
      <div className="flex min-h-screen items-center justify-center px-6 text-gray-100">
        <div className="app-surface w-full max-w-lg rounded-md p-8 text-center">
          <BrandHeader subtitle="Starting DaCollector" />
          <SetupProgress current="startup" />
          <div className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-4 border-shoko-accent border-t-transparent" />
          <p className="mt-5 text-sm text-gray-300">{statusMsg}</p>
          <p className="mt-2 text-xs text-gray-500">
            Provider, managed-folder, Plex, and data-collection readiness continue on the Dashboard after authentication.
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-gray-100">
      <div className="app-surface w-full max-w-lg rounded-md p-8">
        <BrandHeader subtitle="Create your administrator account to get started." />
        <SetupProgress current="account" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <TextInput
              type="text"
              required
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <TextInput
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
            <TextInput
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? 'Setting up…' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SetupProgress({ current }: { current: 'account' | 'startup' }) {
  const steps = [
    { key: 'account', label: 'Admin account' },
    { key: 'startup', label: 'Start server' },
    { key: 'readiness', label: 'Readiness review' },
  ];

  return (
    <div className="mb-8 grid gap-2 text-left sm:grid-cols-3">
      {steps.map((item, index) => {
        const active = item.key === current;
        const done = current === 'startup' && index === 0;
        return (
          <div
            key={item.key}
            className={`rounded-md border px-3 py-2 text-xs ${
              active
                ? 'border-shoko-accent/70 bg-shoko-accent/15 text-white'
                : done
                  ? 'border-emerald-500/50 bg-emerald-600/10 text-emerald-300'
                  : 'border-gray-800 bg-black/20 text-gray-500'
            }`}
          >
            <div className="font-semibold">{item.label}</div>
            <div className="mt-0.5">{done ? 'Complete' : active ? 'Current' : 'Next'}</div>
          </div>
        );
      })}
    </div>
  );
}

function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-8 text-center">
      <BrandMark className="mx-auto h-14 w-14" />
      <h1 className="mt-4 text-2xl font-semibold text-white">DaCollector</h1>
      <p className="mt-2 text-sm leading-6 text-gray-400">{subtitle}</p>
    </div>
  );
}
