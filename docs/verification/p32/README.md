# P32 Route Fallback and Error Boundary Verification

## Scope

P32 adds route-level resilience for the React WebUI:

- global render error boundary around the routed app surface
- route-key reset after navigation
- authenticated unsupported-route page for unknown routes
- existing setup/login redirects preserved for unauthenticated and first-run states

## Build

`npm run build` passed on 2026-05-15 with only the existing warnings:

- Vite CJS Node API deprecation
- PostCSS module-type warning
- SignalR Rollup pure-annotation warnings
- chunk-size warning

## Route Smoke

Temporary Vite smoke ran on `http://127.0.0.1:5180`.

| Route | Status |
| --- | --- |
| `/webui/not-a-real-route-p32` | 200 |
| `/webui/dashboard` | 200 |
| `/webui/login` | 200 |

## Browser Evidence

Headless Chrome loaded `/webui/not-a-real-route-p32` with a local test API key so the authenticated wildcard route rendered inside the app shell.

Screenshots:

- `unsupported-route-desktop.png`
- `unsupported-route-mobile.png`

The unsupported-route page displayed the requested path and provided a Dashboard recovery action on both desktop and mobile.
