# P36 ReleaseInfoController Status Verification

Date: 2026-05-15

## Scope

P36 surfaces the existing read-only release metadata provider status in Settings > Release Info:

- typed release info API client in `src/api/releaseInfo.ts`
- read-only release provider status panel in `src/pages/Settings.tsx`
- service mode, provider count, enabled provider count, configured provider count, and per-provider rows
- existing release/parser configuration metadata remains visible below the provider panel

Release provider mutation, release preview, file release save/delete, stored release browsing, direct file operations, and browser-side release lookup remain out of scope for this slice.

## Build

`npm run build` passed with only the existing warnings:

- Vite CJS Node API deprecation
- PostCSS module-type warning
- SignalR Rollup pure-annotation warnings
- chunk-size warning

`git diff --check -- src\api\releaseInfo.ts src\pages\Settings.tsx CLAUDE_TASKS.md` passed with only CRLF conversion notices for existing Windows line-ending behavior.

## Container Setup

Validation used `ghcr.io/iranman/dacollector:latest` with the freshly built local `dist` mounted as `/app/webui` in a temporary container:

- Container: `dacollector-p36`
- URL: `http://127.0.0.1:38116/webui`
- WebUI mount: local `dist` to `/app/webui:ro`

The smoke container completed first-run setup and reached `Started`.

## Route Smoke

All checked container-served routes returned HTTP 200:

| Route | Status |
| --- | --- |
| `/webui/settings/release-info` | 200 |
| `/webui/settings/general` | 200 |
| `/webui/version.json` | 200 |

## API Smoke

All checked authenticated endpoints returned HTTP 200:

| Endpoint | Status |
| --- | --- |
| `/api/v3/ReleaseInfo/Summary` | 200 |
| `/api/v3/ReleaseInfo/Provider` | 200 |
| `/api/v3/Configuration?query=release` | 200 |

## Browser Evidence

Chrome loaded `/webui/settings/release-info` through the server-served WebUI and confirmed these rendered labels:

- `Release Info`
- `Release metadata providers`
- `Release Providers`
- `Server Configuration`

Screenshots:

- `settings-release-info-desktop.png`
- `settings-release-info-mobile.png`
