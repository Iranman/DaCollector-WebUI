import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { setApiKey } from '../api/client';
import BrandMark from '../components/BrandMark';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await authApi.login({ user: username, pass: password, device: 'WebUI' });
      setApiKey(resp.apikey);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-gray-100">
      <div className="app-surface w-full max-w-sm rounded-md p-8">
        <div className="mb-8 text-center">
          <BrandMark className="mx-auto h-14 w-14" />
          <h1 className="mt-4 text-2xl font-semibold text-white">DaCollector</h1>
          <p className="mt-2 text-sm text-gray-400">Sign in to your account.</p>
        </div>
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
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
