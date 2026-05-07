# DaCollector WebUI Claude Task List

Context:
- Repo: `F:\Collection manager\DaCollector-WebUI`
- Scope source of truth: `AGENTS.md`
- Goal: rewrite the React WebUI to visually match Shoko Server's Web UI as closely as possible while keeping DaCollector branding and existing behavior.
- Stack must stay React 18 + TypeScript + Tailwind CSS v3 + React Router v6 + Vite.
- Do not add a UI framework or change Vite/TypeScript config.
- Do not change `src/api/client.ts` auth behavior.
- No backend/API changes in this repo. If a backend gap blocks a UI feature, record it as a backend follow-up instead of faking production behavior.

Reference material:
- User screenshots: `f:/pictures/Screenshots/Screenshot 2026-05-07 144122.png` through `Screenshot 2026-05-07 144354.png`
- Shoko docs reference: `https://docs.shokoanime.com/getting-started/running-shoko-server`
- Current pages:
  - `src/components/Layout.tsx` currently uses a left sidebar and must be rewritten to Shoko's top navbar.
  - `src/pages/Setup.tsx` and `src/pages/Login.tsx` already contain the right flow logic; restyle only.
  - `src/pages/Settings.tsx` exists but must be rewritten into the Shoko two-column settings panel.
  - `src/pages/Dashboard.tsx` and `src/pages/Collections.tsx` keep existing data logic and get restyled.

---

## P0 — Preserve Scope and Baseline

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

## P1 — Shoko Theme Foundation

Files:
- `tailwind.config.js`
- `src/index.css`
- optional `src/components/ui/*`

Tasks:
- Add Shoko-like palette in Tailwind:
  - background gradient `#0d0d1a` to `#1a1a2e`
  - panel `rgba(13, 13, 26, 0.85)`
  - accent blue `#3b82f6`
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

## P2 — Rewrite Layout to Shoko Top Navbar

Files:
- `src/components/Layout.tsx`
- `src/App.tsx` only if route wiring is required

Tasks:
- Run `npm install lucide-react` for icons (Bell, Settings, LogOut, Github from lucide-react; Discord has no lucide icon — render a plain `DC` text badge or a simple SVG placeholder).
- Remove the left sidebar.
- Add fixed top navbar, `h-14`, full width:
  - left: DaCollector logo/avatar and app name
  - center-left nav: Dashboard, Collection, Utilities, Log, Actions
  - right: notification count (Bell icon + badge), user avatar/name, settings gear (Settings icon), logout (LogOut icon), Discord placeholder, GitHub placeholder (Github icon)
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

## P3 — Restyle Setup and Login First

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
  - primary blue full-width action button
  - spinner/status text while submitting or polling
- Setup copy should say "Create your administrator account to get started."

Acceptance criteria:
- First-run state still routes to `/setup`.
- Existing login flow still routes to dashboard after success.
- No provider/Plex wizard is added in this phase; `AGENTS.md` only asks to restyle existing setup logic.

---

## P4 — Rewrite Settings Page

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
6. AniDB section
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
  - AniDB
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

## P5 — Dashboard Restyle

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

## P6 — Collections Restyle

Files:
- `src/pages/Collections.tsx`

Tasks:
- Keep existing collection logic.
- Restyle list, forms, buttons, and empty states to match Dashboard/settings theme.
- Add/edit collection form should become a modal or side panel only if it can be done without changing existing data behavior.

Acceptance criteria:
- Existing collection create/edit/preview behavior is preserved.
- Page shares the same top navbar and dark card style.

---

## P7 — Build, Browser Review, and Handoff

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

---

## Claude Coordination Notes

Implementation order:
1. P1 theme foundation and shared components.
2. P2 top navbar layout.
3. P3 setup/login restyle.
4. P4 settings rewrite.
5. P5 dashboard restyle.
6. P6 collections restyle.
7. P7 verification/screenshots.

Important:
- Do not start by changing backend code.
- Do not port the old static HTML from `DaCollector.Server/webui`; this repo is the React WebUI.
- Do not add provider/Plex setup wizard steps unless the user explicitly expands the scope beyond `AGENTS.md`.
- If a route or endpoint in `AGENTS.md` is wrong, verify against the running backend or existing API modules and add a blocker note before changing behavior.
