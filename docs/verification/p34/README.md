# P34 HashingController Status Verification

Date: 2026-05-15

## Scope

P34 surfaces the existing read-only `HashingController` status endpoints in the Utilities page:

- typed hashing API client in `src/api/hashing.ts`
- Utilities hashing status panel
- summary metrics for parallel mode, provider count, enabled hash types, and available hash types
- provider list with plugin/version, enabled count, description, and enabled hash chips

Hashing settings and provider mutations remain out of scope. The WebUI does not hash files or change hash provider settings in this slice.

## Build

`npm run build` passed with only the existing warnings:

- Vite CJS Node API deprecation
- PostCSS module-type warning
- SignalR Rollup pure-annotation warnings
- chunk-size warning

`git diff --check -- src\api\hashing.ts src\pages\Utilities.tsx CLAUDE_TASKS.md` passed with only CRLF conversion notices for existing Windows line-ending behavior.

## Container Setup

Validation used `ghcr.io/iranman/dacollector:latest` with the freshly built local `dist` mounted as `/app/webui` in a temporary container:

- Container: `dacollector-p34`
- URL: `http://127.0.0.1:38114/webui`
- WebUI mount: local `dist` to `/app/webui:ro`

The smoke container completed first-run setup and reached `Started`.

## Route Smoke

All checked container-served routes returned HTTP 200:

| Route | Status |
| --- | --- |
| `/webui/utilities` | 200 |
| `/webui/dashboard` | 200 |
| `/webui/version.json` | 200 |

## API Smoke

All checked authenticated endpoints returned HTTP 200:

| Endpoint | Status |
| --- | --- |
| `/api/v3/Hashing/Summary` | 200 |
| `/api/v3/Hashing/Provider` | 200 |
| `/api/v3/Queue` | 200 |

## Browser Evidence

Headless Chrome loaded `/webui/utilities` through the server-served WebUI and confirmed these rendered labels:

- `Utilities`
- `Admin Queue Controls`
- `Hashing Status`
- `ENABLED HASHES`

Screenshots:

- `utilities-desktop.png`
- `utilities-mobile.png`
