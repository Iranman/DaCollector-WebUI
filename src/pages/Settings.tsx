import { useEffect, useState } from 'react';
import { settingsApi, ServerSettings } from '../api/settings';
import { ApiError } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ServerSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsApi.get()
      .then(s => { setSettings(s); setLoading(false); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/setup');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load settings.');
          setLoading(false);
        }
      });
  }, [navigate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await settingsApi.update(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function set(path: string[], value: string) {
    setSettings(prev => {
      const next = structuredClone(prev) as Record<string, unknown>;
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]] as Record<string, unknown>;
      }
      cur[path[path.length - 1]] = value;
      return next as ServerSettings;
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Settings</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 text-green-300 text-sm">
          Settings saved.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="AniDB">
          <Field
            label="Username"
            value={settings.AniDB?.Username ?? ''}
            onChange={v => set(['AniDB', 'Username'], v)}
          />
          <Field
            label="Password"
            type="password"
            value={settings.AniDB?.Password ?? ''}
            onChange={v => set(['AniDB', 'Password'], v)}
          />
        </Section>

        <Section title="TMDB">
          <Field
            label="API Key"
            value={settings.TMDB?.ApiKey ?? ''}
            onChange={v => set(['TMDB', 'ApiKey'], v)}
          />
        </Section>

        <Section title="Plex">
          <Field
            label="Token"
            value={settings.Plex?.Token ?? ''}
            onChange={v => set(['Plex', 'Token'], v)}
          />
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
