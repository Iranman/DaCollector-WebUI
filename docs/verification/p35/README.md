# P35 Database Backup Visibility Verification

Date: 2026-05-15

## Scope

P35 surfaces the existing read-only database backup list in Settings > Database:

- typed database API client in `src/api/database.ts`
- read-only backup files panel in `src/pages/Settings.tsx`
- backup count, total size, latest timestamp, and per-file rows
- existing generic database configuration metadata remains visible below the backup panel

Backup create, queue, delete, restore, and direct filesystem behavior remain out of scope for this slice.

## Build

`npm run build` passed with only the existing warnings:

- Vite CJS Node API deprecation
- PostCSS module-type warning
- SignalR Rollup pure-annotation warnings
- chunk-size warning

`git diff --check -- src\api\database.ts src\pages\Settings.tsx CLAUDE_TASKS.md` passed with only CRLF conversion notices for existing Windows line-ending behavior.

## Container Setup

Validation used `ghcr.io/iranman/dacollector:latest` with the freshly built local `dist` mounted as `/app/webui` in a temporary container:

- Container: `dacollector-p35`
- URL: `http://127.0.0.1:38115/webui`
- WebUI mount: local `dist` to `/app/webui:ro`

The smoke container completed first-run setup and reached `Started`.

## Route Smoke

All checked container-served routes returned HTTP 200:

| Route | Status |
| --- | --- |
| `/webui/settings/database` | 200 |
| `/webui/settings/general` | 200 |
| `/webui/version.json` | 200 |

## API Smoke

All checked authenticated endpoints returned HTTP 200:

| Endpoint | Status |
| --- | --- |
| `/api/v3/Database/Backups` | 200 |
| `/api/v3/Configuration?query=database` | 200 |

## Browser Evidence

Headless Chrome loaded `/webui/settings/database` through the server-served WebUI and confirmed these rendered labels:

- `Database`
- `Backup Files`
- `Database backups`
- `Server Configuration`

Screenshots:

- `settings-database-desktop.png`
- `settings-database-mobile.png`
