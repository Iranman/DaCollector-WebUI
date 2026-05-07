import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initApi } from '../api/init';
import { authApi } from '../api/auth';
import { setApiKey, getApiKey } from '../api/client';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';

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
      <div className="flex min-h-screen items-center justify-center px-6 text-gray-100">
        <div className="app-surface w-full max-w-sm rounded-md p-8 text-center">
          <BrandHeader subtitle="Starting DaCollector" />
          <div className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-5 text-sm text-gray-300">{statusMsg}</p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-gray-100">
      <div className="app-surface w-full max-w-sm rounded-md p-8">
        <BrandHeader subtitle="Create your administrator account to get started." />
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

function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-500 text-lg font-semibold text-[#0d0d1a]">D</div>
      <h1 className="mt-4 text-2xl font-semibold text-white">DaCollector</h1>
      <p className="mt-2 text-sm leading-6 text-gray-400">{subtitle}</p>
    </div>
  );
}
