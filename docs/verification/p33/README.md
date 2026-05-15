# P33 DashboardController Coverage Verification

Date: 2026-05-15

## Scope

P33 expands the main Dashboard to use more of the existing read-only `DashboardController` API surface:

- typed dashboard API client in `src/api/dashboard.ts`
- recent series and episode activity panels
- continue-watching and next-up panels
- collection composition and top-tags panels
- saved dashboard panel preference migration for the new panels

Calendar endpoints remain out of scope for this slice because they need dedicated date-range, missing, and restricted-filter controls.

## Build

`npm run build` passed with only the existing warnings:

- Vite CJS Node API deprecation
- PostCSS module-type warning
- SignalR Rollup pure-annotation warnings
- chunk-size warning

`git diff --check -- src\api\dashboard.ts src\pages\Dashboard.tsx CLAUDE_TASKS.md` passed with only CRLF conversion notices for existing Windows line-ending behavior.

## Container Setup

Validation used `ghcr.io/iranman/dacollector:latest` with the freshly built local `dist` mounted as `/app/webui` in a temporary container:

- Container: `dacollector-p33`
- URL: `http://127.0.0.1:38113/webui`
- WebUI mount: local `dist` to `/app/webui:ro`

The smoke container completed first-run setup and reached `Started`.

## Route Smoke

All checked container-served routes returned HTTP 200:

| Route | Status |
| --- | --- |
| `/webui/dashboard` | 200 |
| `/webui/settings/general` | 200 |
| `/webui/files` | 200 |
| `/webui/version.json` | 200 |

## DashboardController API Smoke

All checked authenticated DashboardController endpoints returned HTTP 200:

| Endpoint | Status |
| --- | --- |
| `/api/v3/Dashboard/Stats` | 200 |
| `/api/v3/Dashboard/SeriesSummary` | 200 |
| `/api/v3/Dashboard/TopTags?pageSize=5` | 200 |
| `/api/v3/Dashboard/RecentlyAddedEpisodes?pageSize=3` | 200 |
| `/api/v3/Dashboard/RecentlyAddedSeries?pageSize=3` | 200 |
| `/api/v3/Dashboard/ContinueWatchingEpisodes?pageSize=3` | 200 |
| `/api/v3/Dashboard/NextUpEpisodes?pageSize=3` | 200 |

## Browser Evidence

Headless Chrome loaded `/webui/dashboard` through the server-served WebUI and confirmed these rendered panel labels:

- `Recently Added Series`
- `Continue Watching`
- `Collection Composition`
- `Top Tags`

Screenshots:

- `dashboard-desktop.png`
- `dashboard-mobile.png`
