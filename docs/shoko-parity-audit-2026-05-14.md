# Shoko-WebUI Parity Audit - 2026-05-14

## Scope

Audit DaCollector-WebUI against the current `ShokoAnime/Shoko-WebUI` `master` branch, with the existing DaCollector constraints:

- Keep DaCollector-WebUI on React 18, React Router v6, Tailwind CSS v3, Vite, and npm unless a stack migration is explicitly approved.
- Keep DaCollector-specific behavior server-backed. Do not add browser-side scanning, file moves, provider matching, downloads, streaming, or Plex scanner behavior.
- Keep the black/gold brand direction and `public/dacollector-logo.png`; do not restore Shoko's blue accent or the old `D` icon.

## Upstream Shoko Reference

Sources checked during this audit:

- `https://github.com/ShokoAnime/Shoko-WebUI/blob/master/package.json`
- `https://github.com/ShokoAnime/Shoko-WebUI/blob/master/src/core/router/index.tsx`
- `https://github.com/ShokoAnime/Shoko-WebUI/blob/master/src/components/Layout/TopNav.tsx`
- `https://github.com/ShokoAnime/Shoko-WebUI/blob/master/src/pages/dashboard/DashboardPage.tsx`
- `https://github.com/ShokoAnime/Shoko-WebUI/blob/master/src/pages/settings/SettingsPage.tsx`
- `https://github.com/ShokoAnime/Shoko-WebUI/blob/master/src/pages/main/MainPage.tsx`
- `https://github.com/ShokoAnime/Shoko-WebUI/blob/master/vite.config.mjs`

Observed upstream patterns:

- App shell is routed through `/webui`, with protected pages under a main layout and explicit login/first-run/unsupported routes.
- The main app wraps router state with Redux Toolkit, React Query, SignalR middleware, hotkeys, Sentry error boundaries, global toasts, and global tooltips.
- Top navigation is a two-level header: logo/user/queue/settings/logout on the top row, product navigation and status/update/offline affordances on the second row.
- Dashboard is a configurable responsive grid of panels with edit/save/reset layout behavior.
- Settings is a centralized draft editing surface with unsaved-change detection, global Save/Cancel, and special pages for API keys/user management/hashing-release.
- Utilities are nested routes under `/utilities`, including unrecognized files, release management, series without files, file search, and renamer.
- Vite generates `public/version.json` from package/git/minimum server version during build.

## Current DaCollector State

Already in good parity shape:

- `/webui` base path is configured.
- Setup, login, dashboard, collection/media, settings, files, folders, parser, utilities, log, actions, and plugins are wired.
- Top navigation exists and no longer has the old left sidebar.
- Current user and queue count are backed by real APIs/SignalR.
- Settings is split into Shoko-like sections and includes WebUI, configuration-backed, user, token, provider, Plex, and admin surfaces.
- File review, relocation, collection builder, Plex sync preview, admin actions, logs, queue, and plugins have first-class pages.
- Black/gold brand and uploaded logo are now the canonical visual direction.

## P21-P28 Closure Status

The gaps below were identified during the audit and implemented in the P21-P28 slice on 2026-05-14. Verification evidence is recorded in `CLAUDE_TASKS.md` and `docs/verification/p21/`.

## Closed Parity Gaps

1. App shell status depth:
   DaCollector has user/queue/settings/logout, but not Shoko's shell-level update/offline/readiness affordances or modal pattern. Dashboard and settings already contain much of the data, but it is not surfaced in the top shell.

2. Global feedback system:
   Pages use local notices and `window.confirm`. Shoko uses a global toast and dialog pattern. This affects consistency for destructive actions, long-running jobs, copy feedback, and save states.

3. Dashboard configurability:
   DaCollector has useful cards, but not Shoko's configurable panel visibility/layout model. A full drag/resizable grid would require new dependencies; a conservative first step is saved panel visibility and ordering using existing stack.

4. Settings draft behavior:
   DaCollector settings sections work, but parity is weaker where each section owns local save state. Shoko has central draft state, unsaved-change detection, Cancel/Save behavior, and leave warnings.

5. Utility route information architecture:
   DaCollector exposes related workflows through `/files`, `/folders`, `/parser`, and `/utilities`. Shoko groups these as nested utilities. DaCollector should add Shoko-like aliases and navigation grouping while preserving existing routes.

6. First-run wizard completeness:
   DaCollector setup is still mostly single-screen account creation. Shoko has a multi-step first-run flow. DaCollector should only add steps that map to real APIs: local account, provider readiness, managed folders, Plex target readiness, and initial scan/data collection.

7. Central live/server state:
   Queue SignalR and API polling are duplicated across pages. Shoko centralizes live state through middleware and React Query. DaCollector can improve this without a stack migration by adding a small app-level status provider and shared hooks.

8. Version/build metadata:
   Shoko writes `public/version.json` at build time with package, git hash, minimum server version, and debug flag. DaCollector currently relies on package/static client code and should decide whether generated WebUI build metadata is needed for embedded server compatibility.

9. Visual verification gap:
   Existing screenshots cover P20 surfaces, but the black/gold branding and logo swap need fresh desktop/mobile screenshot evidence before the visual baseline is considered current.

## Completed Backlog

P21 - Brand and audit alignment - completed:
Update guidance to black/gold, record this audit, and capture current screenshots.

P22 - Shell status and global feedback - completed:
Add shell-level update/offline/readiness indicators where server APIs exist, plus reusable toast/dialog components.

P23 - Dashboard panel parity - completed:
Add configurable panel visibility/order using the existing stack; defer drag/resize until a dependency decision is approved.

P24 - Settings draft parity - completed:
Normalize settings sections toward draft, dirty-state, Cancel/Save, and leave-warning behavior.

P25 - Utility route parity - completed:
Add nested `/utilities/...` routes and navigation aliases for file review, relocation, parser, folders, and release/duplicate/missing views while preserving existing links.

P26 - First-run wizard parity - completed:
Expand setup into an API-backed multi-step wizard only for real server-supported steps.

P27 - Central live state - completed:
Reduce duplicate polling/SignalR logic with app-level hooks/providers while staying off Redux/React Query for now.

P28 - Build metadata parity - completed:
Evaluate generated `public/version.json` for WebUI package/git/minimum server version alignment, especially for embedded `/webui` server packaging.
