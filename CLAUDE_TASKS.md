# DaCollector WebUI Claude Task List

Context:
- Repo: `F:\Collection manager\DaCollector-WebUI`
- Scope source of truth: `AGENTS.md`
- Goal: rewrite and maintain the React WebUI so it visually and behaviorally mimics Shoko-WebUI (`https://github.com/ShokoAnime/Shoko-WebUI`) as closely as possible while keeping DaCollector branding and existing behavior.
- Stack must stay React 18 + TypeScript + Tailwind CSS v3 + React Router v6 + Vite.
- Do not add a UI framework or migrate the Vite/TypeScript stack. Vite build metadata generation is intentionally handled by P28.
- Do not change `src/api/client.ts` auth behavior.
- No backend/API changes in this repo. If a backend gap blocks a UI feature, record it as a backend follow-up instead of faking production behavior.
- Product boundary: WebUI is only the browser interface for DaCollector Server. Do not add direct filesystem scanning, media fingerprinting, provider matching, local file rename/move execution, downloads, streaming, or Plex scanner/agent logic here.
- DaCollector Relay is the planned Plex scanner/agent/adapter. WebUI may configure or monitor Relay through server APIs later, but Relay behavior belongs outside this repo.
- Mimic Shoko-WebUI at the UX/product layer: top navigation, dark translucent panels, settings organization, setup/login flow, dashboard/card treatment, responsive behavior, and live status/API-client patterns. Do not blindly copy Shoko anime-specific domain behavior, server-specific internals, or upstream-only dependencies into DaCollector.

Status as of 2026-05-14:
- P0-P28 are implemented and verified in the React WebUI.
- The black/gold brand direction is now canonical. The app uses `public/dacollector-logo.png` through `src/components/BrandMark.tsx`; do not restore the old `"D"` icon or Shoko's blue accent unless the user explicitly asks.
- P21-P28 below are complete; use `docs/shoko-parity-audit-2026-05-14.md` as the current Shoko-WebUI parity baseline.
- `/settings` now redirects to `/settings/general`, while `/settings/:section` still drives the active settings section.
- Collections now use the real `/api/v3/ManagedCollection` backend contract and include add, edit, preview, sync dry-run, and delete controls.
- `npm run build` passes.
- Latest branding build passed on 2026-05-14 after adding the black/gold logo and favicon.
- Vite route smoke passed for `/setup`, `/login`, `/dashboard`, `/collections`, `/settings`, `/settings/general`, `/settings/api-keys`, and `/settings/user-management`.
- Playwright/Chrome screenshot review passed for desktop protected pages and mobile dashboard/settings/collections layouts.
- Mobile Settings was adjusted to collapse the two-column settings panel into a stacked layout.
- Provider scope is TMDB and TVDB only; do not add or restore legacy anime-only provider WebUI/settings/actions.
- Provider cleanup is complete in this repo: Settings, Actions, User Management, and agent docs now expose only TMDB and TVDB.

Reference material:
- Upstream Shoko-WebUI repo: `https://github.com/ShokoAnime/Shoko-WebUI`
- Current parity audit: `docs/shoko-parity-audit-2026-05-14.md`
- User screenshots: `f:/pictures/Screenshots/Screenshot 2026-05-07 144122.png` through `Screenshot 2026-05-07 144354.png`
- Shoko docs reference: `https://docs.shokoanime.com/getting-started/running-shoko-server`
- Current implemented routes:
  - `/setup`, `/login`
  - `/dashboard`, `/collections`, `/settings`, `/settings/:section`
  - `/media`, `/media/:kind/:provider/:providerID`, `/files`, `/folders`, `/parser`, `/utilities`, `/log`, `/actions`
- Current API client modules:
  - `actions`, `auth`, `client`, `collections`, `configuration`, `dacollectorStatus`, `duplicates`, `fileReview`, `init`, `integrity`, `logging`, `managedFolders`, `media`, `parser`, `plex`, `plexTarget`, `providerMatch`, `queue`, `releaseManagement`, `settings`, `tags`, `tmdb`, `tokens`, `tvdb`, `users`, `webui`

---

## P0 — Preserve Scope and Baseline — DONE

Tasks:
- Read `AGENTS.md` before coding.
- Inventory existing page logic and API calls:
  - `src/App.tsx`
  - `src/components/Layout.tsx`
  - `src/pages/Setup.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/pages/Collections.tsx`
  - `src/pages/Settings.tsx`
  - `src/api/*.ts`
- Keep existing routes:
  - `/setup`
  - `/login`
  - `/dashboard`
  - `/collections`
  - `/settings`
- Add `/settings/:section` without breaking `/settings`.

Acceptance criteria:
- No existing API call is removed.
- The app still builds before visual work starts, or any baseline build failure is documented.

---

## P1 — Shoko Theme Foundation — DONE

Files:
- `tailwind.config.js`
- `src/index.css`
- optional `src/components/ui/*`

Tasks:
- Add Shoko-like palette in Tailwind:
  - near-black background gradient with subtle gold light
  - near-black translucent panel `bg-shoko-panel/85`
  - metallic gold accent; existing `blue-*` utility names may render gold through `tailwind.config.js`
  - destructive red `#ef4444`
  - subtle borders `border-gray-700/50`
- Apply full-screen dark gradient to body/root.
- Add reusable UI components exactly scoped by `AGENTS.md`:
  - `Toggle.tsx`
  - `Button.tsx`
  - `TextInput.tsx`
  - `Select.tsx`
  - `SettingsRow.tsx`
  - `SectionHeader.tsx`
- Use Tailwind classes, not inline styles, except for unavoidable dynamic values.
- Toggle must be Shoko-style circle icon, not a sliding pill.

Acceptance criteria:
- Shared components are typed with no `any`.
- Components render safely with disabled/empty values.
- `npm run build` succeeds.

---

## P2 — Rewrite Layout to Shoko Top Navbar — DONE

Files:
- `src/components/Layout.tsx`
- `src/App.tsx` only if route wiring is required

Tasks:
- Run `npm install lucide-react` for icons (Bell, Settings, LogOut, Github from lucide-react; Discord has no lucide icon — render a plain `DC` text badge or a simple SVG placeholder).
- Remove the left sidebar.
- Add fixed top navbar, `h-14`, full width:
  - left: DaCollector logo/avatar and app name
  - center-left nav: Dashboard, Collection, Utilities, Log, Actions
  - right: real queue badge, current user avatar/name, settings gear (Settings icon), logout (LogOut icon), and no placeholder social links
- Use `NavLink` active styling exactly as specified:
  - active `text-white`
  - inactive `text-gray-400 hover:text-gray-200`
  - no active background pill
- Keep logout behavior via `clearApiKey()`.
- Page body uses `pt-14` and keeps background visible behind content.

Acceptance criteria:
- The left sidebar is gone.
- Dashboard/Collection/Settings navigation still works.
- Layout resembles Shoko screenshots at desktop width.

---

## P3 — Restyle Setup and Login First — DONE

Files:
- `src/pages/Setup.tsx`
- `src/pages/Login.tsx`

Tasks:
- Keep current setup/login logic.
- Match Shoko first-run style:
  - full-screen dark gradient
  - centered dark translucent card
  - DaCollector logo/name at top
  - username/password fields
  - primary gold full-width action button
  - spinner/status text while submitting or polling
- Setup copy should say "Create your administrator account to get started."

Acceptance criteria:
- First-run state still routes to `/setup`.
- Existing login flow still routes to dashboard after success.
- No provider/Plex wizard is added in this phase; `AGENTS.md` only asks to restyle existing setup logic.

---

## P4 — Rewrite Settings Page — DONE

Files:
- `src/pages/Settings.tsx`
- `src/api/settings.ts`
- `src/api/users.ts` new
- `src/api/tokens.ts` new
- shared UI components from P1
- `src/App.tsx` for `/settings/:section`

Implementation sub-order within P4:
1. `src/api/tokens.ts` — API key CRUD
2. `src/api/users.ts` — user CRUD
3. `src/api/settings.ts` — expand `ServerSettings` type
4. `Settings.tsx` shell — two-column panel + left nav routing (no section content yet, just stubs)
5. General section
6. TVDB section
7. Metadata Sites section
8. Collection section
9. Integrations section
10. User Management section
11. API Keys section

For the default section: `/settings` should redirect to `/settings/general` using `<Navigate>`. The `:section` URL param drives which left nav item is active and which right panel renders.

Tasks:
- Implement Shoko-style centered two-column settings panel:
  - outer `max-w-5xl mx-auto mt-8`
  - `flex bg-[#0d0d1a]/90 border border-gray-700/50`
  - left nav `w-52 shrink-0`
  - right content `flex-1 p-8`
- Sections:
  - General
  - Import
  - TVDB
  - Metadata Sites
  - Collection
  - Integrations
  - User Management
  - API Keys
- Expand `ServerSettings` in `src/api/settings.ts` per `AGENTS.md`.
- Add `src/api/users.ts` for user CRUD.
- Add `src/api/tokens.ts` for API key CRUD.
- Handle missing/partial settings with optional chaining and defaults.
- Do not fake successful saves. If an endpoint fails or is missing, show a clear inline error.

Acceptance criteria:
- `/settings` redirects to `/settings/general` via `<Navigate>`.
- `/settings/:section` activates the requested section (unknown sections fall back to general).
- Save/cancel buttons are consistently placed at the bottom right where relevant.
- API Keys can render empty/loading/error states.
- User Management can render empty/loading/error states.
- `npm run build` succeeds.

---

## P5 — Dashboard Restyle — DONE

Files:
- `src/pages/Dashboard.tsx`

Tasks:
- Keep existing data-fetching logic.
- Restyle into Shoko-like dashboard cards:
  - Status
  - Uptime
  - Collections count
  - collection list below
- Use panel style `bg-[#0d0d1a]/80 border border-gray-700/50 rounded-md px-5 py-4`.
- Do not hardcode fake production collection stats.
- Use explicit empty states when data is unavailable.

Acceptance criteria:
- Dashboard looks consistent with the Shoko dark card style.
- Dashboard works with empty backend responses.

---

## P6 — Collections Restyle — DONE

Files:
- `src/pages/Collections.tsx`

Tasks:
- Keep existing collection logic.
- Restyle list, forms, buttons, and empty states to match Dashboard/settings theme.
- Add/edit collection form should become a modal or side panel only if it can be done without changing existing data behavior.

Acceptance criteria:
- Existing collection create/edit/preview behavior is preserved.
- Page shares the same top navbar and dark card style.

Completion notes:
- The initial React Collections page only exposed list, refresh, sync, and delete; add/edit/preview were present in the legacy static server UI, not the React page.
- React Collections now calls `/api/v3/ManagedCollection`, matching the server controller.
- Added Shoko-style add/edit modal, saved/unsaved preview support, sync dry-run, and delete.

---

## P7 — Build, Browser Review, and Handoff — DONE

Tasks:
- Run:
  ```bash
  npm run build
  ```
- Start dev server if useful:
  ```bash
  npm run dev -- --host 127.0.0.1
  ```
- Browser-check:
  - `/setup`
  - `/login`
  - `/dashboard`
  - `/collections`
  - `/settings`
  - `/settings/api-keys`
  - `/settings/user-management`
Acceptance criteria:
- `npm run build` succeeds with zero TypeScript errors.
- Visual design is recognizably Shoko-like while branded as DaCollector.
- Any backend endpoint that is missing or returns unexpected shape must be listed as a follow-up note at the bottom of this file — do not fake or stub the data silently.

Verification notes:
- `npm run build` passed on 2026-05-08.
- Vite route smoke passed on 2026-05-08 for the required routes plus `/settings/general`.
- Playwright/Chrome screenshot review completed on 2026-05-08.
- Protected-page screenshots used local storage key `dacollector_apikey=visual-review-token` so the app rendered dashboard, collections, and settings views without a live backend.
- Screenshots were written under the Windows temp directory:
  - `dacollector-webui-auth-screens-20260508-123622`
  - `dacollector-webui-fixed-screens-20260508-124251`
  - `dacollector-webui-final-screens-20260508-124545`

Backend/API notes:
- No missing backend endpoint was found for Collections after switching from `/api/v3/Collection` to `/api/v3/ManagedCollection`.
- Vite-only screenshots show `404 Not Found` on data-backed pages when no backend is running; this is expected for dev-only visual review.

---

## P8 — Surface Server MVP Endpoints in WebUI — DONE

Status: implemented 2026-05-11, `npm run build` passes (0 TypeScript errors).

### New API clients
- `src/api/parser.ts` — `parserApi.parseFilename(path)`
- `src/api/fileReview.ts` — full file review + candidate approve/reject API
- `src/api/media.ts` — `mediaApi.getMovies`, `mediaApi.getShows` with provider/search/page

### New pages
- `src/pages/Parser.tsx` (`/parser`) — text input → parse → shows Kind badge, all parsed fields, warnings
- `src/pages/Media.tsx` (`/media`) — Movies/Shows tabs, provider filter (TMDB/TVDB/All), search, pagination
- `src/pages/FileReview.tsx` (`/files`) — unmatched file list, expand-to-view parsed info + candidates, per-file Ignore/Scan actions, candidate Approve/Reject with confidence bar

### Nav changes (`src/components/Layout.tsx`)
Added to nav: Library (`/media`), Files (`/files`), Parser (`/parser`)

### Route changes (`src/App.tsx`)
Added routes: `media`, `files`, `parser`

---

## P9 — Baseline Gap Audit and Approved Roadmap — DONE

Approval:
- User approved this roadmap after the 2026-05-14 WebUI gap review.

Current WebUI route inventory:
- Public/setup routes: `/setup`, `/login`
- Protected app routes: `/dashboard`, `/collections`, `/settings`, `/settings/:section`, `/media`, `/files`, `/folders`, `/parser`, `/utilities`, `/log`, `/actions`

Current WebUI API client inventory:
- `src/api/actions.ts`
- `src/api/auth.ts`
- `src/api/client.ts`
- `src/api/configuration.ts`
- `src/api/collections.ts`
- `src/api/dacollectorStatus.ts`
- `src/api/fileReview.ts`
- `src/api/init.ts`
- `src/api/logging.ts`
- `src/api/managedFolders.ts`
- `src/api/media.ts`
- `src/api/parser.ts`
- `src/api/plex.ts`
- `src/api/plexTarget.ts`
- `src/api/queue.ts`
- `src/api/settings.ts`
- `src/api/tags.ts`
- `src/api/tokens.ts`
- `src/api/users.ts`
- `src/api/webui.ts`

Server v3 controllers not yet meaningfully surfaced in the React WebUI:
- `AVDumpController`
- `CollectionBuilderController`
- `DatabaseController`
- `DebugController`
- `EpisodeController`
- `FileController`
- `FilterController`
- `FolderController`
- `GroupController`
- `HashingController`
- `ImageController`
- `MediaCatalogController`
- `MetadataController`
- `PlaylistController`
- `PluginController`
- `PluginPackageController`
- `ReleaseInfoController`
- `ReleaseManagementMultipleReleasesController`
- `RelocationController`
- `ReverseTreeController`
- `SeriesController`
- `TreeController`

Practical gaps:
- App shell static user/notification affordances and placeholder social links were identified here and closed in P10.
- Dashboard readiness/status gaps were closed in P11.
- Settings avatar/tag restrictions, WebUI theme/update controls, and configuration-backed hashing/release/relocation/database visibility were closed in P12.
- Media library detail views and provider workflows were closed in P13/P14.
- Remaining provider backend gaps: direct TMDB link/unlink endpoints are not exposed; TVDB direct link/unlink requires a manually entered MediaSeries ID because no TVDB linked-series lookup exists; linked-file lookup is exposed for TMDB items only.
- File review center expansion was closed in P15. Relocation/rename/move review remains for P16.
- Collections work, but rule creation is still too raw compared with a guided Shoko-style builder.
- Plex target setup is present in Settings, but safe sync, preview, Plex library validation, and Plex duplicate review need real pages.
- Operations pages are functional but basic; queue/log/actions need better detail, filtering, confirmations, and admin-only handling.
- Plugin/package APIs are not surfaced yet; WebUI update/theme APIs were surfaced in P12.
- Stack alignment remains a later explicit decision; do not migrate to React Query, pnpm, React 19, Tailwind 4, or Redux until the workflow gaps are intentionally prioritized.

Verification:
- `npm run build` passed on 2026-05-14 with the existing Vite/module-type warnings only.
- P10 can start from this baseline.

## P10 — App Shell Polish and Responsive Navigation — DONE

Goal:
- Bring the application shell closer to Shoko-WebUI quality while keeping DaCollector navigation usable as the route count grows.

Tasks:
- Add responsive mobile navigation for all current protected routes.
- Replace static `Default` user/avatar with `/api/v3/User/Current`.
- Replace static notification `0` with real queue/status-derived data, or remove the badge until a real notification source exists.
- Replace placeholder Discord/GitHub `#` links with real links or remove them.
- Group crowded DaCollector-only routes into Shoko-like top-level sections without hiding critical workflows.
- Preserve existing auth/logout behavior through `src/api/client.ts`.

Acceptance criteria:
- Desktop navigation remains Shoko-like and uncluttered.
- Mobile navigation can reach every protected route.
- User display is real data when authenticated.
- No placeholder links remain.
- `npm run build` passes.

Completion notes (2026-05-14):
- `src/components/Layout.tsx` now groups Library, Collections, Folders, Files, and Parser under a desktop `Collection` menu.
- Mobile navigation now exposes every protected route through a hamburger menu.
- User display now loads `/api/v3/User/Current` via `usersApi.current()`.
- Queue badge now uses `/api/v3/Queue` plus the existing aggregate SignalR queue feed; the badge is hidden when the count is zero.
- Placeholder Discord/GitHub links were removed from the app shell.
- `src/api/users.ts` now includes `current()`.
- `AGENTS.md` was updated so future shell work keeps real user/queue data and does not reintroduce placeholder social links.
- Verification: `npm run build` passed with the existing Vite/module-type warnings only.
- Dev server started at `http://127.0.0.1:5173/webui/` and returned HTTP `200`.

## P11 — Status Dashboard Completion — DONE

Goal:
- Make Dashboard the first-install and runtime health surface.

Tasks:
- Add DaCollector readiness cards from `/api/v3/DaCollectorStatus`.
- Show provider readiness, capability flags, Plex target status, server version, WebUI version, and queue state.
- Add actionable warnings for missing managed folders, missing provider keys, missing Plex config, failed Plex connectivity, and failed internet connectivity if the server exposes it.
- Keep collection stats and queue widgets.
- Avoid hardcoded fake health values.

Acceptance criteria:
- Dashboard exposes server readiness without needing Settings or logs first.
- Each warning points to the relevant page or setting.
- Empty/partial backend responses render cleanly.
- `npm run build` passes.

Completion notes (2026-05-14):
- Added `src/api/dacollectorStatus.ts` for:
  - `GET /api/v3/DaCollectorStatus`
  - `GET /api/v3/DaCollectorStatus/Providers`
  - `GET /api/v3/DaCollectorStatus/Capabilities`
  - `GET /api/v3/DaCollectorStatus/Plex`
- Expanded `src/api/init.ts` with the full component version response shape so Dashboard can show Server and WebUI versions.
- Reworked `src/pages/Dashboard.tsx` to show:
  - Server state, uptime, managed folder count, series count, file count.
  - Readiness warnings linked to Setup, Folders, Settings, or Logs as appropriate.
  - Queue live status.
  - Plex target readiness.
  - Provider readiness.
  - Collection manager sync/config status.
  - Collection health and watch progress.
  - Server capability checklist.
- Verified `GET /api/v3/DaCollectorStatus` against local Docker on `http://127.0.0.1:38111` using the temporary local admin token; response matched the new client shape.
- Verification: `npm run build` passed with the existing Vite/module-type warnings only.

## P12 — Settings Completion — DONE

Goal:
- Finish the Shoko-style settings experience for DaCollector-specific server configuration.

Tasks:
- Complete User Management:
  - Current-user profile view.
  - Avatar display/edit if supported by the API.
  - Tag restriction UI using server tag/filter endpoints.
  - Password/session behavior aligned with server user APIs.
- Add WebUI settings:
  - Theme list/apply/remove where `WebUIController` supports it.
  - WebUI update/install/status actions only if appropriate for DaCollector deployment mode.
- Add configuration-backed sections for:
  - Hashing.
  - Release info.
  - Relocation/rename rules.
  - Database/backup visibility.
  - Server configuration validation through `ConfigurationController` where useful.
- Ensure every setting maps to a real server field or records a backend follow-up.

Acceptance criteria:
- Settings remains a Shoko-like two-column panel on desktop and stacked layout on mobile.
- Unsupported fields show clear errors or are omitted.
- No fake saves.
- `npm run build` passes.

Completion notes (2026-05-14):
- Added API clients for:
  - `GET/POST/DELETE /api/v3/WebUI/Theme...` and WebUI version/update actions in `src/api/webui.ts`.
  - `GET /api/v3/Tag/AniDB` and `GET /api/v3/Tag/User` in `src/api/tags.ts`.
  - `GET /api/v3/Configuration`, configuration load, schema, and validation in `src/api/configuration.ts`.
- Expanded `src/api/users.ts` with current-user update/password APIs plus `Avatar` and `RestrictedTags`.
- Expanded `src/api/settings.ts` with the server `CollectionManager` settings shape used by Dashboard and Settings.
- Added Settings sections for:
  - Profile: current-user avatar upload/removal, display name, Plex usernames, and password/API-key revocation behavior.
  - Web UI: theme list/add/update/remove, latest WebUI/server version checks, WebUI update, and manual-update report actions.
  - Hashing, Release Info, Relocation, and Database: configuration-backed cards with restart/env metadata and `ConfigurationController` validation.
- Completed User Management avatar editing and restricted-tag assignment through real server endpoints.
- Backend follow-up: active theme selection/apply is omitted because `WebUIController` exposes theme install/update/remove/CSS, but no dedicated active-theme field.
- Verification: `npm run build` passed with the existing Vite/module-type and SignalR Rollup annotation warnings only.

## P13 — Library Detail Views — DONE

Goal:
- Turn `/media` from list-only into a useful library browser.

Tasks:
- Add movie detail route.
- Add show detail route.
- Show overview, images, provider IDs, external IDs, genres, runtime/status, files, file locations, and update timestamps.
- Add seasons/episodes for shows where server APIs support them.
- Add refresh/link actions only after provider workflow clients exist.
- Keep TMDB/TVDB provider scope unless the server deliberately adds another provider.

Acceptance criteria:
- Users can inspect a movie/show without leaving the WebUI.
- Detail pages degrade cleanly when images or provider fields are missing.
- `npm run build` passes.

Completion notes (2026-05-14):
- Added `/media/:kind/:provider/:providerID` routes with `src/pages/MediaDetail.tsx`.
- Expanded `src/api/media.ts` with movie/show detail, show seasons, show episodes, and generic file DTO support.
- Detail pages show overview, poster/backdrop when usable, provider IDs, external IDs, genres, runtime/status, seasons/episodes, linked DaCollector series, TMDB linked files, file locations, and update timestamps.
- TVDB detail pages degrade cleanly where the server does not expose linked-series or linked-file lookup.
- Verification: `npm run build` passed with the existing Vite/module-type and SignalR Rollup annotation warnings only.
- Live route smoke passed for `http://127.0.0.1:5173/webui/media/movies/tmdb/1` and `http://127.0.0.1:5173/webui/media/shows/tmdb/1`.

## P14 — Provider Match Workflows — DONE

Goal:
- Give TMDB/TVDB linking and refresh workflows first-class UI coverage.

Tasks:
- Add API clients for `TmdbController`, `TvdbController`, and `ProviderMatchController`.
- Add provider search UI from media/detail pages.
- Add link/unlink controls for movies and shows.
- Add refresh controls for linked TMDB/TVDB items.
- Add preferred ordering controls where supported.
- Add image download/refresh controls where supported.
- Add match review UI for ambiguous provider candidates.

Acceptance criteria:
- Provider decisions are made through server APIs, not in the browser.
- Every link/unlink/refresh action has visible result/error state.
- `npm run build` passes.

Completion notes (2026-05-14):
- Added API clients for:
  - `src/api/tmdb.ts`: TMDB online movie/show search, linked DaCollector series/files, refresh, image download, and show preferred ordering.
  - `src/api/tvdb.ts`: TVDB refresh plus direct show/movie link and unlink by MediaSeries ID.
  - `src/api/providerMatch.ts`: pending candidates, per-series candidates, scan, approve, and reject.
- Added a `Matches` tab to `/media` for pending TMDB/TVDB provider-match review, including scan-all-unmatched, approve, and reject.
- Added provider actions on media detail pages:
  - TMDB refresh, image download, online search/cache, preferred show ordering, linked-series candidate scan/approve/reject.
  - TVDB refresh and direct link/unlink by manually entered MediaSeries ID.
- Backend follow-ups:
  - TMDB direct link/unlink is not exposed by `TmdbController`; the UI uses `ProviderMatchController` instead of inventing browser-side matching.
  - TVDB has direct link/unlink endpoints but no linked-series lookup endpoint, so the WebUI cannot auto-populate current TVDB links.
  - TVDB online search is not exposed; the UI does not fake TVDB search.
  - Generic linked-file lookup for provider detail pages is currently TMDB-only through `TmdbController`.
- Verification: `npm run build` passed with the existing Vite/module-type and SignalR Rollup annotation warnings only.
- Live read-only API smoke against `http://127.0.0.1:38111` passed for `/api/v3/Media/Movies?provider=all&pageSize=1`, `/api/v3/Media/Shows?provider=all&pageSize=1`, and `/api/v3/ProviderMatch/Candidates`; the local test server currently returned zero movies, zero shows, and zero pending matches.

## P15 — File Review Center Expansion — DONE

Goal:
- Expand `/files` into the central review hub for local media cleanup.

Tasks:
- Keep unmatched file review as the first tab.
- Add duplicate review using duplicate/release-management duplicate APIs.
- Add missing review using missing/release-management APIs.
- Add corrupt/integrity review using `IntegrityCheckController`.
- Add batch actions with clear confirmation for destructive or large operations.
- Add filters for ignored/manual match/provider/status.

Acceptance criteria:
- Review tabs are easy to scan and Shoko-like.
- Destructive actions require explicit confirmation.
- Missing backend support is recorded as a backend follow-up.
- `npm run build` passes.

Completion notes (2026-05-14):
- Added API clients for:
  - `src/api/duplicates.ts`: exact duplicate summary, cleanup plans, dry-run delete preview, and confirmed duplicate location delete.
  - `src/api/releaseManagement.ts`: duplicate-file series/episodes and missing-episode series/episodes.
  - `src/api/integrity.ts`: integrity scan list, file results, create/start, and delete.
- Reworked `/files` into a four-tab review center:
  - Unmatched: preserved parser review, ignore/unignore, refresh parse, scan, approve/reject, and clear manual match.
  - Duplicates: exact duplicate cleanup plans plus release-management duplicate series/episode summaries.
  - Missing: missing series and missing episode review with collecting/finished filters.
  - Integrity: managed-folder scan creation/start, scan list, scan deletion, and result filtering for errors/OK/waiting/statuses.
- Added filters for unmatched status, candidate provider, ignored files, duplicate availability, duplicate preferred path, missing collecting-only, missing finished-series-only, and integrity file status.
- Destructive/large actions now require confirmation:
  - Unmatched batch scan warns before running, especially when online provider lookup is enabled.
  - Exact duplicate delete first calls the server dry-run endpoint, then confirms before `confirm=true`.
  - Integrity scan creation/start and scan deletion both confirm first.
- Backend follow-ups:
  - Duplicate episode/file rows are review-only; there is no React-side batch file removal for release-management duplicates yet beyond exact duplicate location cleanup.
  - Missing episode review is informational; no acquisition/download workflow is added or implied.
  - Integrity scan creation requires managed folders to exist and remains server-side only.
- Verification: `npm run build` passed with the existing Vite/module-type and SignalR Rollup annotation warnings only.

## P16 — Rename, Move, and Relocation Review — DONE

Goal:
- Surface DaCollector's rename/move review workflows without letting the browser manipulate files directly.

Tasks:
- Add API clients for `RelocationController` and related release/file endpoints.
- Add preview screens showing source path, proposed destination, conflicts, and warnings.
- Add apply flows only after preview.
- Add clear success/error summaries.
- Keep all filesystem operations server-side.

Acceptance criteria:
- No local filesystem access is added to the WebUI.
- Apply actions require preview and explicit confirmation.
- `npm run build` passes.

Completion notes (2026-05-14):
- Added `src/api/relocation.ts` for relocation summary, pipes, preview, and apply calls.
- Added a Relocation tab to `/files` backed by `Media/Files` and `RelocationController`.
- Added file search/page selection, default or stored pipe selection, move/rename/delete-empty-folder options, preview results, and apply results.
- Apply stays disabled until preview results exist and requires explicit confirmation before calling the server-side relocate endpoint.
- No browser-side filesystem access was added; source paths and proposed destinations are displayed from server API data only.
- Backend follow-ups:
  - Relocation preview/apply currently reports server-returned errors and no-change outcomes; there is no dedicated conflict DTO beyond `ErrorMessage`.
  - The local smoke server had no media files, so preview/apply was not exercised against real file IDs.
- Verification: `npm run build` passed with the existing Vite/module-type and SignalR Rollup annotation warnings only.
- Live read-only API smoke against `http://127.0.0.1:38111` passed for `/api/v3/Relocation/Summary`, `/api/v3/Relocation/Pipe`, and `/api/v3/Media/Files?page=1&pageSize=1&includeReview=true&includeAbsolutePaths=false`; the local test server returned one relocation provider, one pipe, and zero media files.

## P17 — Collections and Plex Workflow Completion — DONE

Goal:
- Make collection management and Plex target operations feel like a complete Shoko-style workflow.

Tasks:
- Replace raw collection rule editing with a guided builder driven by available collection builders.
- Add builder-specific fields, validation, and readable rule summaries.
- Add preview diff and warnings before sync.
- Add dry-run and apply sync states.
- Add Plex library validation against configured section key.
- Add Plex-safe sync and review pages once Plex is reachable through server APIs.

Acceptance criteria:
- Users can create a collection without hand-writing raw options.
- Sync preview is understandable before apply.
- Plex actions never imply media download or streaming.
- `npm run build` passes.

Completion notes (2026-05-14):
- Added `CollectionBuilderController` client coverage through `collectionBuilderApi` and typed collection sync/Plex diff results in `src/api/collections.ts`.
- Replaced raw collection-rule JSON editing with a guided builder modal driven by available collection builders.
- Added builder-specific fields for provider IDs, media kind, limits, paging, language/region, and TMDB discover filters.
- Added collection rule validation and readable rule summaries on collection rows and inside the editor.
- Added Plex readiness validation on the Collections page using `DaCollectorStatus/Plex`, including configured section-key visibility and warnings.
- Reworked sync actions into explicit Preview, Dry Run, and Apply states; Apply is disabled until a dry run exists for the selected collection and the Plex target is ready.
- Added sync result review showing target, effective mode, matched/missing items, add/remove diff, warnings, and Plex diff counts when available.
- Backend follow-ups:
  - The server exposes collection builder descriptors but not per-builder option schemas, so the WebUI maps known builder keys to supported fields.
  - The local smoke server had no configured Plex token/section key and no saved collections, so apply was not exercised.
- Verification: `npm run build` passed with the existing Vite/module-type and SignalR Rollup annotation warnings only.
- Live read-only API smoke against `http://127.0.0.1:38111` passed for `/api/v3/CollectionBuilder`, `/api/v3/ManagedCollection`, and `/api/v3/DaCollectorStatus/Plex`; the local server returned 15 builders, zero collections, and Plex warnings for missing token/section key.

## P18 — Operations and Admin Depth — DONE

Goal:
- Bring queue, logs, actions, plugins, and update controls up to production-admin usefulness.

Tasks:
- Improve queue page with filters, job details, queued/running/blocked sections, and supported retry/cancel controls.
- Improve log page with saved filters, copy details, exception expansion, and better mobile layout.
- Expand actions page to include safe admin actions that exist in `ActionController`.
- Add plugin/package pages if `PluginController` and `PluginPackageController` are intended for DaCollector.
- Add WebUI update/theme pages only where they make sense for Docker/bundled deployment.

Acceptance criteria:
- Admin-only actions are visibly separated from normal user actions.
- Dangerous actions are confirmed.
- Unsupported deployment-mode actions are hidden or clearly explained.
- `npm run build` passes.

Implementation notes:
- Expanded queue operations in `Utilities` with live status, type/search filters, running/waiting/blocked sections, selected job details, and confirmed global pause/resume/clear controls. Per-job retry/cancel is clearly explained as unsupported because `QueueController` does not expose those endpoints.
- Expanded `Log` with log file selection, server-side REST filters, saved filter presets, copyable details, exception expansion, downloads, archived-file delete with confirmation, and a mobile card layout.
- Expanded `Actions` with normal user actions separated from admin maintenance and admin purge actions. Admin actions are labeled/disabled for non-admin sessions and destructive jobs require confirmation.
- Added plugin/package administration via `PluginController` and `PluginPackageController`, including plugin enable/disable/uninstall, package search/install, repository sync, and scheduled update checks.
- WebUI update/theme controls were already surfaced in P12 under Settings; P18 keeps them there because they are deployment-specific and already explain the exposed server behavior.
- Verification: `npm run build` passed with the existing Vite/module-type, SignalR Rollup annotation, and chunk-size warnings only. `git diff --check` passed with CRLF warnings only.

## P19 — Stack Alignment Decision — DONE

Goal:
- Decide whether adopting more of Shoko-WebUI's current frontend stack is worth the cost.

Tasks:
- Evaluate React Query first for server-state caching and refetch handling.
- Evaluate pnpm only if package-manager consistency with upstream becomes valuable.
- Evaluate React 19/Tailwind 4/Vite upgrade as a separate migration.
- Evaluate Redux only if global UI/session state becomes complex enough to justify it.
- Write an explicit migration plan before any stack change.

Acceptance criteria:
- No stack migration happens as incidental feature work.
- Any proposed migration has risk, benefit, file impact, and rollback notes.

Decision:
- Do not migrate the stack as part of this roadmap. Keep DaCollector-WebUI on React 18, TypeScript, Tailwind CSS v3, React Router v6, Vite, and npm for now.
- Upstream check on 2026-05-14: `https://raw.githubusercontent.com/ShokoAnime/Shoko-WebUI/master/package.json` shows Shoko-WebUI on a larger Node >=22 stack with React 19, React Router 7, TanStack React Query, Redux Toolkit/react-redux, Tailwind CSS 4, Vite 8, TypeScript 5.9, pnpm scripts, Monaco, Sentry, virtualized UI helpers, and broader lint/format tooling.
- DaCollector-WebUI is still small enough that the current explicit `useEffect` + API module pattern remains understandable. The higher-value next stack candidate is React Query, but only after server-state duplication/refetch behavior becomes a maintenance problem.

Migration plan before any future stack change:
- React Query candidate:
  - Benefit: central server-state cache, request dedupe, predictable refetch/retry behavior, and cleaner loading/error handling on route transitions.
  - Risk: broad page churn, query key discipline, harder optimistic updates if introduced too early, and another required mental model.
  - File impact: `package.json`, lockfile, `src/main.tsx` or `src/App.tsx` query client provider, API call sites in route pages, and tests/smoke coverage for affected pages.
  - Rollback: revert provider/dependency/lockfile changes and restore direct API calls page by page.
- pnpm candidate:
  - Benefit: closer upstream script style and deterministic workspace-friendly dependency installs if this grows into a multi-package frontend workspace.
  - Risk: developer/tooling friction, CI workflow changes, lockfile replacement, and no immediate runtime benefit.
  - File impact: package manager lockfile, `.github/workflows/ci.yml`, README/agent setup notes, and local install commands.
  - Rollback: restore npm lockfile and npm workflow commands.
- React 19/Tailwind 4/Vite major upgrade:
  - Benefit: closer upstream, newer compiler/build path, and access to newer React/Tailwind ecosystem behavior.
  - Risk: high blast radius across routing, CSS, build config, generated bundles, and Docker/server packaging assumptions.
  - File impact: `package.json`, lockfile, `vite.config.ts`, Tailwind/PostCSS config, global CSS, route/component code, CI, and release packaging.
  - Rollback: revert the migration commit and preserve the pre-upgrade lockfile.
- Redux candidate:
  - Benefit: centralized global UI/session state if cross-route state becomes complex.
  - Risk: boilerplate and indirection without enough shared state to justify it.
  - File impact: store setup, provider wiring, slice files, and pages currently owning local state.
  - Rollback: remove provider/store/slices and return state to route-local hooks.

## P20 — Verification and Handoff Standard — DONE

Goal:
- Keep future WebUI slices verifiable and Docker-embeddable.

Tasks:
- Run `npm run build`.
- Smoke test every public/protected route.
- Capture desktop and mobile screenshots for changed surfaces.
- Verify embedded WebUI through the server at `/webui` after Docker/server packaging changes.
- Update this task file with exact pass/fail evidence after each slice.

Acceptance criteria:
- Every completed roadmap item has build evidence.
- Browser/screenshot evidence exists for visual changes.
- Docker/server packaging impact is verified when relevant.

Implementation notes:
- Established the standard in this task file: each completed slice should record build, route/API smoke, screenshot evidence for visual changes, and Docker/server `/webui` verification when packaging or embedded deployment changes.
- P19/P20 did not change Docker/server packaging, so embedded Docker verification is not applicable for this slice.

Verification evidence:
- `npm run build` passed on 2026-05-14 with the existing Vite CJS API deprecation, package module-type, SignalR Rollup annotation, and chunk-size warnings only.
- Route smoke against the dev server at `http://127.0.0.1:5173` passed with HTTP 200 for `/webui/setup`, `/webui/login`, `/webui/dashboard`, `/webui/collections`, `/webui/settings/general`, `/webui/media`, `/webui/media/movies/tmdb/1`, `/webui/files`, `/webui/folders`, `/webui/parser`, `/webui/utilities`, `/webui/log`, `/webui/actions`, and `/webui/plugins`.
- Screenshot evidence captured with Edge headless for changed P18 admin surfaces:
  - `docs/verification/p20/utilities-desktop.png`
  - `docs/verification/p20/utilities-mobile.png`
  - `docs/verification/p20/log-desktop.png`
  - `docs/verification/p20/log-mobile.png`
  - `docs/verification/p20/actions-desktop.png`
  - `docs/verification/p20/actions-mobile.png`
  - `docs/verification/p20/plugins-desktop.png`
  - `docs/verification/p20/plugins-mobile.png`
- The temporary same-origin screenshot auth helper was removed after capture and is not part of the finished worktree.

## P21 — Brand and Parity Audit Alignment — DONE

Goal:
- Lock the black/gold brand direction into repo guidance and refresh the Shoko-WebUI parity baseline.

Tasks:
- Keep `public/dacollector-logo.png` and `src/components/BrandMark.tsx` as the canonical app mark.
- Keep the black/gold Tailwind palette override; do not revert to Shoko blue.
- Record the current Shoko-WebUI parity audit in `docs/shoko-parity-audit-2026-05-14.md`.
- Capture fresh desktop and mobile screenshot evidence for the black/gold baseline.
- Update this task file with exact build/screenshot evidence.

Acceptance criteria:
- Agent docs no longer instruct future work to restore the old `D` icon or blue accent.
- `npm run build` passes after any implementation changes.
- Screenshot evidence exists for `/login`, `/dashboard`, `/settings/general`, `/media`, `/files`, and `/plugins`.

Implementation notes:
- Added `docs/shoko-parity-audit-2026-05-14.md` covering the current Shoko comparison, P0-P20 confirmation, and P21-P28 gap plan.
- Updated `AGENTS.md` and this task file to make the black/gold palette and `public/dacollector-logo.png` canonical.

Verification evidence:
- Chrome headless screenshots captured in `docs/verification/p21/`: `login-desktop.png`, `dashboard-desktop.png`, `settings-desktop.png`, `files-desktop.png`, `plugins-desktop.png`, `dashboard-mobile.png`, and `settings-mobile.png`.

## P22 — Shell Status and Global Feedback Parity — DONE

Goal:
- Bring DaCollector's app shell closer to Shoko's top navigation status depth without importing Shoko's stack.

Tasks:
- Add shell-level indicators for server/WebUI update availability, network/readiness problems, and Plex/provider warnings where existing server APIs expose them.
- Add reusable toast/notice and confirmation dialog components so destructive actions stop relying on `window.confirm`.
- Keep all shell indicators backed by real server APIs.
- Do not add placeholder external links.

Acceptance criteria:
- Queue, user, update/readiness, settings, and logout affordances are visible without visiting Dashboard first.
- Destructive or large actions use the shared confirmation component.
- Success/error feedback uses the shared toast/notice component.
- `npm run build` passes.

Implementation notes:
- Added `AppProviders`, `ToastProvider`, and `ConfirmProvider`.
- Added shell readiness/update badges backed by `useLiveState`.
- Replaced browser confirm calls for destructive workflows in Actions, Collections, FileReview, Log, Plugins, and Utilities with the shared confirmation dialog.
- Added shared toast feedback for queued jobs, collection apply, file-review actions, log actions, plugin actions, and settings saves.

## P23 — Dashboard Panel Parity — DONE

Goal:
- Move Dashboard closer to Shoko's configurable panel experience while staying on the current dependency stack.

Tasks:
- Add panel visibility controls for existing Dashboard cards.
- Persist panel visibility/order through a real server-backed setting if available; otherwise store only per-browser UI preferences with clear scope.
- Add reset-to-default behavior.
- Defer drag/resize until a dependency or stack migration is explicitly approved.

Acceptance criteria:
- Users can hide/show Dashboard panels and reset the layout.
- Dashboard remains useful with empty/partial backend data.
- No new dashboard dependency is added without explicit approval.
- `npm run build` passes.

Implementation notes:
- Dashboard now has a `Panels` control for visibility/order, reset-to-default behavior, and per-browser persistence through `localStorage` key `dacollector_dashboard_panels`.
- No dashboard grid/drag dependency was added.

## P24 — Settings Draft and Unsaved-Change Parity — DONE

Goal:
- Normalize Settings toward Shoko's central draft, dirty-state, Cancel/Save, and leave-warning model.

Tasks:
- Audit each settings section for independent save state versus shared draft state.
- Introduce a consistent dirty-state and Cancel/Save pattern for server settings where the backend supports patching.
- Add leave-warning feedback for unsaved settings changes.
- Keep special action pages such as API Keys, User Management, WebUI theme/update, and configuration validation outside the core settings Save/Cancel flow when appropriate.

Acceptance criteria:
- Core settings changes are not saved accidentally and can be canceled.
- Unsaved changes are visible before navigating away.
- Unsupported fields are omitted or clearly explained.
- `npm run build` passes.

Implementation notes:
- Settings now tracks `originalSettings` versus draft settings, disables Save/Cancel unless dirty, warns on browser unload, and confirms section navigation when unsaved core settings would be discarded.
- Special sections such as API Keys, User Management, Web UI updates/themes, and configuration summaries stay outside the shared core Save/Cancel flow.

## P25 — Utility Route Information Architecture Parity — DONE

Goal:
- Align DaCollector's utility workflows with Shoko's nested utility routing while preserving existing URLs.

Tasks:
- Add Shoko-like nested aliases under `/utilities/...` for file review, relocation/renamer, parser/file search, folders, duplicates, missing, and integrity views where practical.
- Keep existing `/files`, `/folders`, `/parser`, and `/utilities` routes working as redirects or aliases.
- Update desktop and mobile navigation so related utility workflows are discoverable from the Utilities menu.

Acceptance criteria:
- Old links keep working.
- New nested routes group related workflows in a Shoko-like way.
- Mobile navigation can reach every utility workflow.
- `npm run build` passes.

Implementation notes:
- Added Shoko-like aliases under `/utilities/...` for unmatched files, ignored files, duplicates, missing, integrity, renamer, parser/file search, and folders.
- Kept existing `/files`, `/folders`, `/parser`, and `/utilities` routes working.
- Updated desktop and mobile utility navigation to expose the grouped workflows.

## P26 — First-Run Wizard Parity — DONE

Goal:
- Expand first-run setup only where DaCollector Server exposes real setup/readiness APIs.

Tasks:
- Split setup into API-backed steps for local admin account, provider readiness, managed folders, Plex target readiness, and optional initial scan/data collection if supported.
- Do not fake provider, folder, Plex, scan, or data-collection success.
- Keep the wizard skippable only where server state can safely handle missing configuration.

Acceptance criteria:
- First-run guides a new install through real DaCollector prerequisites.
- Missing backend support is recorded as a backend follow-up.
- Existing account creation and login behavior remain intact.
- `npm run build` passes.

Implementation notes:
- Setup now shows a real stepper for admin account, server start, and readiness review while keeping actual account creation/startup API behavior intact.
- Provider, folder, Plex, scan, and data-collection readiness remains Dashboard/server-backed after authentication because this repo does not own unauthenticated setup APIs for those actions.

## P27 — Central Live State Parity — DONE

Goal:
- Reduce duplicated queue/status polling and SignalR setup without adopting Redux or React Query yet.

Tasks:
- Add lightweight app-level hooks/providers for queue, readiness, current user, and version state where duplication exists.
- Reuse the existing `src/api/client.ts` auth behavior.
- Avoid introducing Redux/React Query unless P19 is reopened and explicitly approved.

Acceptance criteria:
- Queue/current-user/status state is not independently reimplemented page by page.
- Route transitions preserve live state cleanly.
- Auth failures still route to login through existing behavior.
- `npm run build` passes.

Implementation notes:
- Added `LiveStateProvider` in `src/lib/liveState.tsx` for current user, queue status/SignalR updates, init status/version, DaCollector readiness, and server/WebUI update checks.
- Layout and Dashboard now consume the shared live state instead of independently reimplementing shell-level current user, status, readiness, and queue polling.

## P28 — WebUI Build Metadata Parity — DONE

Goal:
- Decide whether DaCollector-WebUI should generate Shoko-style `public/version.json` during build for embedded server compatibility.

Tasks:
- Compare current server expectations for bundled WebUI version metadata with Shoko's generated `version.json` pattern.
- If needed, generate package version, git hash, minimum server version, and debug flag during Vite build.
- Keep generated files out of source control unless the server packaging contract requires checked-in output.

Acceptance criteria:
- Embedded `/webui` deployment has clear version metadata behavior.
- No local dev `1-local` style version string can break server startup parsing.
- `npm run build` passes.

Implementation notes:
- Vite now writes `public/version.json` during config/build with sanitized semver package/minimum server versions, git short hash, and debug flag.
- `public/version.json` is ignored so generated local metadata is not checked in.
- Version sanitization strips pre-release/local suffixes and falls back to `0.0.0`, matching the server-side need to avoid `1-local` startup parsing failures.

Verification evidence for P21-P28:
- `npm run build` passed on 2026-05-14 with only existing Vite CJS, PostCSS module-type, SignalR Rollup annotation, and chunk-size warnings.
- Route smoke against `http://127.0.0.1:5173` returned HTTP 200 for `/webui/setup`, `/webui/login`, `/webui/dashboard`, `/webui/collections`, `/webui/settings/general`, `/webui/media`, `/webui/files`, `/webui/files?tab=duplicates`, `/webui/utilities`, `/webui/utilities/unrecognized/files`, `/webui/utilities/release-management/missing`, `/webui/utilities/integrity`, `/webui/utilities/renamer`, `/webui/log`, `/webui/actions`, `/webui/plugins`, and `/webui/version.json`.
- Screenshot evidence is in `docs/verification/p21/`.
- `rg -n "window\.confirm" src` returns no code hits.
- The temporary same-origin screenshot auth helper was removed after capture and is not part of the finished worktree.

## P29 — Server-Compatible WebUI Metadata — DONE

Goal:
- Make the WebUI build metadata independently useful for bundled Server deployment and update comparison.

Tasks:
- Keep `public/version.json` generated at build time and out of source control.
- Emit the richer server-compatible fields the Server already understands: package version, minimum server version, release tag, full git SHA, release date, channel, and debug flag.
- Allow CI/Docker callers to override metadata with environment variables while preserving local defaults.

Acceptance criteria:
- `npm run build` passes.
- Generated `public/version.json` uses a full WebUI commit SHA, ISO-like date, `Stable`/`Debug` channel, and sanitized semver values.
- The browser-only WebUI repo does not take over Docker packaging; Server remains responsible for embedding the WebUI into the container image.

Implementation notes:
- `vite.config.ts` now writes `tag`, full `git`, `date`, `channel`, and `debug` fields in addition to `package` and `minimumServerVersion`.
- Metadata overrides are supported through `DACOLLECTOR_WEBUI_GIT`, `DACOLLECTOR_WEBUI_DATE`, `DACOLLECTOR_WEBUI_TAG`, `DACOLLECTOR_WEBUI_CHANNEL`, and `DACOLLECTOR_MIN_SERVER_VERSION`.

## P30 — WebUI Diagnostics Metadata Surface — DONE

Goal:
- Make the generated WebUI build metadata visible from the browser so Docker/bundled builds can be verified without shell access.

Tasks:
- Read the static `/webui/version.json` generated by the WebUI build.
- Show current server-reported Server/WebUI versions next to the bundled client metadata.
- Keep the surface read-only and inside existing WebUI settings; do not add backend packaging behavior to this repo.

Acceptance criteria:
- Settings > Web UI includes a compact diagnostics section for installed Server/WebUI versions and bundled client metadata.
- Diagnostics include package version, minimum server version, channel, commit, and build date where available.
- `npm run build` passes.

Implementation notes:
- Added `webuiApi.buildMetadata()` to fetch `/webui/version.json` with `cache: no-store`.
- Settings > Web UI now loads `initApi.getVersion()` and static metadata with the existing version check flow and renders read-only diagnostics blocks.

## P31 — Container-Served WebUI Validation and Diagnostics Polish — DONE

Goal:
- Validate the React WebUI through the published Docker/Server `/webui` deployment path and make WebUI diagnostics clear enough to confirm install/update state from the browser.

Tasks:
- Run the container-served WebUI from `http://127.0.0.1:38111/webui`, not only Vite.
- Smoke the key bundled routes:
  - `/webui/setup`
  - `/webui/login`
  - `/webui/dashboard`
  - `/webui/settings/web-ui`
  - `/webui/files`
  - `/webui/utilities`
- Capture desktop and mobile screenshot evidence under `docs/verification/p31/`.
- Polish Settings > Web UI diagnostics so it clearly distinguishes:
  - installed WebUI
  - bundled WebUI
  - latest WebUI/server metadata
  - bundle/install mismatch state
  - update state
- Keep diagnostics read-only and browser-only. Do not move Docker packaging or install decisions into this repo.

Acceptance criteria:
- `npm run build` passes.
- The bundled `/webui/version.json` path is loaded using the Vite base URL so it works from `/webui`.
- Settings > Web UI keeps rendering local bundled/install metadata even if remote latest-version checks fail.
- Container-served route smoke passes for the key routes above.
- Desktop and mobile screenshot evidence is recorded in `docs/verification/p31/`.

Implementation notes:
- `webuiApi.buildMetadata()` now resolves `version.json` from `import.meta.env.BASE_URL` instead of hardcoding `/webui`.
- Settings > Web UI version loading now uses partial-result handling so installed/bundled diagnostics still render if the latest WebUI or latest Server check fails.
- Diagnostics now include bundle/install match state, update state, current install metadata, bundled WebUI metadata, and latest-release metadata.

Verification evidence:
- `npm run build` passed on 2026-05-15 with only the existing Vite/PostCSS/SignalR/chunk-size warnings.
- Temporary container-served validation passed at `http://127.0.0.1:38112/webui` using `ghcr.io/iranman/dacollector:latest` with local `dist` mounted as `/app/webui`.
- Route smoke returned HTTP 200 for `/webui/setup`, `/webui/login`, `/webui/dashboard`, `/webui/settings/web-ui`, `/webui/files`, `/webui/utilities`, and `/webui/version.json`.
- Screenshot evidence is in `docs/verification/p31/`.

## P32 — Route Fallback and Error Boundary Parity — DONE

Goal:
- Add Shoko-style route resilience without importing Sentry or changing the current React/Vite stack.

Tasks:
- Add a global render error boundary around the routed WebUI surface.
- Reset the error boundary when the user navigates to a different route.
- Add a branded unsupported-route page for authenticated unknown routes instead of silently redirecting ready users to Dashboard.
- Keep setup/login redirects intact for unauthenticated or first-run sessions.

Acceptance criteria:
- Render failures show a branded fallback with reload, Dashboard, and copy-diagnostics actions.
- Unknown authenticated routes show an unsupported-route page inside the main app shell.
- No backend behavior, filesystem access, package-manager change, Sentry dependency, Redux, or React Query is introduced.
- `npm run build` passes.

Implementation notes:
- Added `src/components/AppErrorBoundary.tsx` with route-key reset behavior and copyable diagnostic details.
- Added `src/pages/Unsupported.tsx` for unknown authenticated routes.
- Moved the route tree into an `AppRoutes` helper so it can read the current location and reset the boundary on navigation.

Verification evidence:
- `npm run build` passed on 2026-05-15 with only the existing Vite/PostCSS/SignalR/chunk-size warnings.
- `git diff --check` passed for `src/components/AppErrorBoundary.tsx`, `src/pages/Unsupported.tsx`, `src/App.tsx`, and this task file with only existing CRLF conversion notices.
- Temporary Vite route smoke at `http://127.0.0.1:5180` returned HTTP 200 for `/webui/not-a-real-route-p32`, `/webui/dashboard`, and `/webui/login`.
- Headless Chrome rendered the authenticated unsupported-route page and captured desktop/mobile screenshots in `docs/verification/p32/`.

## P33 — DashboardController Coverage Pass — DONE

Goal:
- Use more of the existing `DashboardController` read-only API surface so the main Dashboard is not limited to `/Dashboard/Stats`.

Audit findings:
- Server exposes `/api/v3/Dashboard/Stats`, `/SeriesSummary`, `/TopTags`, `/RecentlyAddedEpisodes`, `/RecentlyAddedSeries`, `/ContinueWatchingEpisodes`, `/NextUpEpisodes`, `/AniDBCalendar`, and `/CalendarEpisodes`.
- React WebUI only used `/Dashboard/Stats` before this slice.
- Calendar endpoints are intentionally left out of this slice because they need a dedicated date-range UI and explicit missing/restricted filters.

Tasks:
- Add a typed `src/api/dashboard.ts` client for read-only DashboardController endpoints.
- Add dashboard panels for recent local activity, watch-state summaries, collection composition, and top tags.
- Preserve existing dashboard panel preference migration so users with saved panel order automatically receive new panels.
- Keep panels informational only; do not add playback, downloads, filesystem access, or backend behavior.

Acceptance criteria:
- `npm run build` passes.
- Existing dashboard panels still render and remain configurable.
- New panels degrade to empty/error states when optional DashboardController calls fail.
- Screenshot evidence is recorded for desktop and mobile Dashboard.

Verification evidence:
- `npm run build` passed on 2026-05-15 with only the existing Vite/PostCSS/SignalR/chunk-size warnings.
- `git diff --check` passed for `src/api/dashboard.ts`, `src/pages/Dashboard.tsx`, and this task file with only CRLF conversion notices.
- Temporary container `dacollector-p33` served the freshly built local `dist` from `/app/webui` on `http://127.0.0.1:38113/webui`.
- Container route smoke returned HTTP 200 for `/webui/dashboard`, `/webui/settings/general`, `/webui/files`, and `/webui/version.json`.
- Authenticated DashboardController smoke returned HTTP 200 for `/Stats`, `/SeriesSummary`, `/TopTags`, `/RecentlyAddedEpisodes`, `/RecentlyAddedSeries`, `/ContinueWatchingEpisodes`, and `/NextUpEpisodes`.
- Headless Chrome rendered the new dashboard panels and captured desktop/mobile screenshots in `docs/verification/p33/`.

## P34 — HashingController Status Coverage — DONE

Goal:
- Surface the existing read-only `HashingController` status endpoints in the React WebUI without moving hashing behavior into the browser.

Audit findings:
- Server exposes `/api/v3/Hashing/Summary`, `/Hashing/Provider`, and `/Hashing/Provider/{providerID}` as read-only endpoints.
- Server also exposes admin write endpoints for hashing settings and provider enablement, but those are intentionally out of scope for this slice.
- Before this slice, WebUI had a generic Settings > Hashing configuration metadata view, but no live hashing service summary/provider status.

Tasks:
- Add a typed `src/api/hashing.ts` client for read-only hashing summary and provider endpoints.
- Add a Utilities hashing status panel that shows parallel mode, provider count, enabled/available hash types, and provider health.
- Keep hashing actions server-owned; do not add browser-side hashing, provider mutations, or file operations.

Acceptance criteria:
- `npm run build` passes.
- Utilities still loads queue status and controls as before.
- Hashing status degrades to a panel-local error state if the hashing endpoints fail.
- Container route/API smoke confirms `/webui/utilities`, `/api/v3/Hashing/Summary`, and `/api/v3/Hashing/Provider`.

Verification evidence:
- `npm run build` passed on 2026-05-15 with only the existing Vite/PostCSS/SignalR/chunk-size warnings.
- `git diff --check` passed for `src/api/hashing.ts`, `src/pages/Utilities.tsx`, and this task file with only CRLF conversion notices.
- Temporary container `dacollector-p34` served the freshly built local `dist` from `/app/webui` on `http://127.0.0.1:38114/webui`.
- Container route smoke returned HTTP 200 for `/webui/utilities`, `/webui/dashboard`, and `/webui/version.json`.
- Authenticated smoke returned HTTP 200 for `/api/v3/Hashing/Summary`, `/api/v3/Hashing/Provider`, and `/api/v3/Queue`.
- Headless Chrome rendered the new Utilities hashing panel and captured desktop/mobile screenshots in `docs/verification/p34/`.

## P35 — Database Backup Visibility — DONE

Goal:
- Surface the existing read-only database backup list in Settings > Database without adding browser-side backup, restore, delete, or filesystem behavior.

Audit findings:
- Server exposes `GET /api/v3/Database/Backups` for admin users and returns backup filename, size, and creation timestamp.
- Server also exposes backup create, queue, and delete endpoints, but those mutation paths are intentionally out of scope for this slice.
- Before this slice, Settings > Database only showed generic configuration metadata through `ConfigurationController`.

Tasks:
- Add a typed `src/api/database.ts` client for `GET /api/v3/Database/Backups`.
- Add a read-only backup files panel to Settings > Database.
- Preserve existing configuration metadata and validation cards in Settings > Database.
- Show a clear panel-local message when the current user is not authorized to view backup files.

Acceptance criteria:
- `npm run build` passes.
- `/settings/database` still renders the existing configuration metadata.
- Database backups are displayed with filename, size, and creation time when the admin endpoint succeeds.
- Container route/API smoke confirms `/webui/settings/database` and `/api/v3/Database/Backups`.

Verification evidence:
- `npm run build` passed on 2026-05-15 with only the existing Vite/PostCSS/SignalR/chunk-size warnings.
- `git diff --check` passed for `src/api/database.ts`, `src/pages/Settings.tsx`, and this task file with only CRLF conversion notices.
- Temporary container `dacollector-p35` served the freshly built local `dist` from `/app/webui` on `http://127.0.0.1:38115/webui`.
- Container route smoke returned HTTP 200 for `/webui/settings/database`, `/webui/settings/general`, and `/webui/version.json`.
- Authenticated smoke returned HTTP 200 for `/api/v3/Database/Backups` and `/api/v3/Configuration?query=database`.
- Headless Chrome rendered the Settings > Database backup panel and captured desktop/mobile screenshots in `docs/verification/p35/`.

## P36 — ReleaseInfoController Status Coverage — DONE

Goal:
- Surface the existing read-only release metadata provider status in Settings > Release Info without moving release lookup, preview, provider mutation, or file release behavior into the browser.

Audit findings:
- Server exposes `GET /api/v3/ReleaseInfo/Summary` and `GET /api/v3/ReleaseInfo/Provider` for release metadata service/provider status.
- Server also exposes release provider settings, provider updates, release preview, file release save/delete, and stored release list endpoints; mutation and file-scoped release workflows are intentionally out of scope for this slice.
- Before this slice, Settings > Release Info only showed generic configuration metadata through `ConfigurationController`.

Tasks:
- Add a typed `src/api/releaseInfo.ts` client for the read-only summary and provider endpoints.
- Add a read-only release provider panel to Settings > Release Info.
- Preserve existing release/parser configuration metadata and validation cards in Settings > Release Info.
- Show a clear panel-local message if release provider status cannot be loaded.

Acceptance criteria:
- `npm run build` passes.
- `/settings/release-info` still renders the existing configuration metadata.
- Release providers are displayed with name, plugin, version, enabled state, priority, and configuration status when the endpoints succeed.
- Container route/API smoke confirms `/webui/settings/release-info`, `/api/v3/ReleaseInfo/Summary`, and `/api/v3/ReleaseInfo/Provider`.

Verification evidence:
- `npm run build` passed on 2026-05-15 with only the existing Vite/PostCSS/SignalR/chunk-size warnings.
- `git diff --check` passed for `src/api/releaseInfo.ts`, `src/pages/Settings.tsx`, and this task file with only CRLF conversion notices.
- Temporary container `dacollector-p36` served the freshly built local `dist` from `/app/webui` on `http://127.0.0.1:38116/webui`.
- Container route smoke returned HTTP 200 for `/webui/settings/release-info`, `/webui/settings/general`, and `/webui/version.json`.
- Authenticated smoke returned HTTP 200 for `/api/v3/ReleaseInfo/Summary`, `/api/v3/ReleaseInfo/Provider`, and `/api/v3/Configuration?query=release`.
- Chrome rendered the Settings > Release Info provider panel and captured desktop/mobile screenshots in `docs/verification/p36/`.

## P37 — Setup Reset and Import Folder Entry Points — DONE

Goal:
- Surface existing server-owned setup reset and managed-folder creation entry points from Settings without adding browser-side filesystem access or scan behavior.

Audit findings:
- Server exposes `POST /api/v3/Init/ResetSetup` for admins to set first-run setup mode and request a server restart.
- Server exposes `GET /api/v3/ManagedFolder` and `POST /api/v3/ManagedFolder`; create validates that the path exists on the server and rejects invalid/nested paths.
- Settings > Import already had import behavior settings, but did not expose the configured import folder list or a direct path-entry add flow.

Tasks:
- Add `initApi.resetSetup()` for the existing reset endpoint.
- Add a Settings > General restore setup wizard button guarded by the shared confirmation dialog.
- Add a Settings > Import managed-folder quick-add panel that lists current folders and posts new folder paths to the server API.
- Keep filesystem validation and scanning server-owned; do not browse, scan, hash, or access local files from the browser.

Acceptance criteria:
- `npm run build` passes.
- Settings > General renders the restore setup action without triggering it during smoke validation.
- Settings > Import renders current managed folders and can submit an existing server path through `POST /api/v3/ManagedFolder`.
- Container route/API smoke confirms `/webui/settings/general`, `/webui/settings/import`, `/api/v3/ManagedFolder`, and server-side managed-folder creation.

Verification evidence:
- `npm run build` passed on 2026-05-15 with only the existing Vite/PostCSS/SignalR/chunk-size warnings after fixing the import-folder name fallback expression.
- `git diff --check` passed for `src/api/init.ts`, `src/pages/Settings.tsx`, and this task file with only CRLF conversion notices.
- Temporary container `dacollector-p37` served the freshly built local `dist` from `/app/webui` on `http://127.0.0.1:38117/webui`.
- Container route smoke returned HTTP 200 for `/webui/settings/general`, `/webui/settings/import`, and `/webui/version.json`.
- Authenticated smoke returned HTTP 200 for `/api/v3/ManagedFolder`, `/api/v3/Init/Status`, and `POST /api/v3/ManagedFolder` using an existing server path created in the temporary container.
- `POST /api/v3/Init/ResetSetup` was not invoked during smoke validation because it intentionally requests a server restart into setup mode.
- Chrome rendered the Settings > General setup reset action and Settings > Import folder quick-add panel, then captured desktop/mobile screenshots in `docs/verification/p37/`.

## Claude Coordination Notes

Next implementation order:
1. Pick P38 from remaining unsurfaced API/routes.

Important:
- Do not start by changing backend code.
- Do not port the old static HTML from `DaCollector.Server/webui`; this repo is the React WebUI.
- Do not add provider/Plex setup wizard steps outside P26 or another explicitly approved setup-wizard slice.
- If a route or endpoint in `AGENTS.md` is wrong, verify against the running backend or existing API modules and add a blocker note before changing behavior.
- Upstream Shoko-WebUI currently uses a larger stack than this repo. Keep DaCollector-WebUI on its declared React 18 + TypeScript + Tailwind v3 + React Router v6 + Vite stack unless the user explicitly asks for a stack migration.
