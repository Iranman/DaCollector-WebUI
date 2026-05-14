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
  const gitHash = readGitHash();

  await writeFile('./public/version.json', JSON.stringify({
    git: gitHash,
    package: packageVersion,
    minimumServerVersion,
    debug,
  }, null, '  '), 'utf8');
}

function readGitHash() {
  try {
    return childProcess.execSync('git log --pretty=format:%h -n 1').toString().trim();
  } catch {
    return 'unknown';
  }
}

function sanitizeVersion(value: string) {
  const core = value.split('-')[0];
  return /^\d+(\.\d+){1,3}$/.test(core) ? core : '0.0.0';
}
