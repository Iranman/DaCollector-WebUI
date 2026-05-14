import childProcess from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
  await writeVersionFile(mode !== 'production');

  return {
    plugins: [react()],
    base: '/webui/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': 'http://localhost:38111',
      },
    },
  };
});

async function writeVersionFile(debug: boolean) {
  const pkg = JSON.parse(await readFile('./package.json', 'utf8')) as { version?: string };
  const packageVersion = sanitizeVersion(pkg.version ?? '0.0.0');
  const minimumServerVersion = sanitizeVersion(process.env.DACOLLECTOR_MIN_SERVER_VERSION ?? '1.0.0');
  const gitHash = readMetadataValue('DACOLLECTOR_WEBUI_GIT', () => readGitValue('rev-parse HEAD'));
  const date = readMetadataValue('DACOLLECTOR_WEBUI_DATE', () => readGitValue('show -s --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd HEAD'));
  const tag = readMetadataValue('DACOLLECTOR_WEBUI_TAG', () => `v${packageVersion}`);
  const channel = readMetadataValue('DACOLLECTOR_WEBUI_CHANNEL', () => debug ? 'Debug' : 'Stable');

  await writeFile('./public/version.json', JSON.stringify({
    package: packageVersion,
    minimumServerVersion,
    tag,
    git: gitHash,
    date,
    channel,
    debug,
  }, null, '  '), 'utf8');
}

function readMetadataValue(envName: string, fallback: () => string) {
  const value = process.env[envName]?.trim();
  return value || fallback();
}

function readGitValue(args: string) {
  try {
    return childProcess.execSync(`git ${args}`).toString().trim();
  } catch {
    return 'unknown';
  }
}

function sanitizeVersion(value: string) {
  const core = value.split('-')[0];
  return /^\d+(\.\d+){1,3}$/.test(core) ? core : '0.0.0';
}
