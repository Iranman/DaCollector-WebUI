# P37 Setup Reset and Import Folder Entry Points Verification

Date: 2026-05-15

## Scope

P37 surfaces existing server-owned setup and managed-folder entry points in Settings:

- `initApi.resetSetup()` for `POST /api/v3/Init/ResetSetup`
- Settings > General restore setup wizard action guarded by the shared confirmation dialog
- Settings > Import folder list and quick-add form backed by `GET/POST /api/v3/ManagedFolder`

The WebUI does not browse local paths, scan files, hash files, validate filesystem access itself, or trigger setup reset during smoke validation. Path existence and managed-folder creation remain server-owned.

## Build

`npm run build` passed with only the existing warnings:

- Vite CJS Node API deprecation
- PostCSS module-type warning
- SignalR Rollup pure-annotation warnings
- chunk-size warning

`git diff --check -- src\api\init.ts src\pages\Settings.tsx CLAUDE_TASKS.md` passed with only CRLF conversion notices for existing Windows line-ending behavior.

## Container Setup

Validation used `ghcr.io/iranman/dacollector:latest` with the freshly built local `dist` mounted as `/app/webui` in a temporary container:

- Container: `dacollector-p37`
- URL: `http://127.0.0.1:38117/webui`
- WebUI mount: local `dist` to `/app/webui:ro`

The smoke container completed first-run setup and reached `Started`.

## Route Smoke

All checked container-served routes returned HTTP 200:

| Route | Status |
| --- | --- |
| `/webui/settings/general` | 200 |
| `/webui/settings/import` | 200 |
| `/webui/version.json` | 200 |

## API Smoke

All checked authenticated endpoints returned HTTP 200:

| Endpoint | Status |
| --- | --- |
| `/api/v3/ManagedFolder` | 200 |
| `/api/v3/Init/Status` | 200 |
| `POST /api/v3/ManagedFolder` with `/tmp/dacollector-p37-import` | 200 |
| `/api/v3/ManagedFolder` after create | 200 |

`POST /api/v3/Init/ResetSetup` was not invoked because it intentionally requests a server restart into setup mode.

## Browser Evidence

Chrome loaded Settings through the server-served WebUI and confirmed these rendered labels:

- Settings > General: `Restore Setup Wizard`, `Database Type`
- Settings > Import: `Import Folders`, `P37 Import`

Screenshots:

- `settings-general-desktop.png`
- `settings-general-mobile.png`
- `settings-import-desktop.png`
- `settings-import-mobile.png`
