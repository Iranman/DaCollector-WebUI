# DaCollector WebUI — Codex Agent Specification

## Goal
Rewrite and maintain the DaCollector WebUI so it visually and behaviorally mimics **Shoko-WebUI** as closely as possible while keeping DaCollector branding and DaCollector-specific workflows. The upstream reference is `https://github.com/ShokoAnime/Shoko-WebUI`. Study the design description below carefully — every detail matters. Do not invent new navigation, settings, or workflow patterns when a Shoko-WebUI pattern already applies.

Mimic Shoko-WebUI at the product and UX layer, not by blindly copying anime-specific domain behavior or server-specific internals. DaCollector should reuse Shoko-style layout, dark translucent panels, top navigation, settings organization, setup/login flow, dashboard/card treatment, live status behavior, and API-client architecture where it fits. DaCollector must still call DaCollector Server APIs and keep local media, Plex target, duplicate review, missing/corrupt review, rename/move review, and Relay-aware workflows aligned with this product.

## Product Boundary
DaCollector WebUI is the browser interface for DaCollector Server. It should present setup, folder, provider, Plex target, collection, duplicate, missing/corrupt, and rename/move workflows by calling server APIs.

Do not implement backend behavior in this repo. The WebUI must not scan folders directly, fingerprint files, match providers directly, manipulate local files, download media, stream from websites, or act as the Plex scanner/agent. DaCollector Relay is the planned Plex scanner/agent/adapter, and DaCollector Server remains the source of truth for media identity and state.

---

## Stack (do not change)
- React 18 + TypeScript
- Tailwind CSS v3 (extend theme in `tailwind.config.js`)
- React Router v6
- Vite
- No new npm packages unless absolutely necessary (e.g. `lucide-react` for icons is acceptable)

Note: upstream Shoko-WebUI may move faster than this repo and currently uses a larger React/Vite/Tailwind client stack. Do not upgrade DaCollector-WebUI's framework or package manager only to match upstream unless the task explicitly calls for a stack migration. If a Shoko-WebUI feature depends on Redux Toolkit, React Query, pnpm, or another upstream-only tool, first decide whether the same UX can be implemented within this repo's existing stack.

---

## Shoko Design Reference

### Visual Identity
- **Background**: Full-screen dark image/gradient behind everything. Shoko uses anime character artwork. We use a CSS gradient that evokes this: a very dark navy-to-charcoal gradient (`#0d0d1a` → `#1a1a2e`). Apply it to `body` / the root container. Panels sit on top with semi-transparency.
- **Panel backgrounds**: `rgba(13, 13, 26, 0.85)` or `bg-[#0d0d1a]/85` — dark, slightly transparent so a background image could show through.
- **Accent color**: Bright blue — `#3b82f6` (Tailwind `blue-500`). Used for active nav, primary buttons, enabled toggles.
- **Destructive color**: `#ef4444` (Tailwind `red-500`). Delete and Unlink buttons.
- **Text hierarchy**:
  - Primary: `text-white` / `text-gray-100`
  - Secondary labels: `text-gray-400`
  - Disabled/muted: `text-gray-500`
- **Border**: `border-gray-700/50` for subtle dividers between panels
- **Border radius**: `rounded-none` for panels (Shoko uses sharp corners on the main settings panel), `rounded-md` for buttons and inputs

### Typography
- Sans-serif font, normal weight for labels, `font-medium` or `font-semibold` for headings
- Section titles (e.g. "API Keys", "User Management"): `text-xl font-semibold text-white`
- Section descriptions: `text-sm text-gray-400`
- Setting row labels: `text-sm text-gray-200`

---

## Layout: Top Horizontal Navigation Bar

**Replace the current left sidebar entirely.** Shoko uses a top navbar.

### Navbar structure (full width, fixed at top, `h-14` / 56px):
```
[ Logo icon + "DaCollector" ]   [ Dashboard | Collection | Utilities | Log | Actions ]   [ queue badge | current user | ⚙ | ↪ ]
```

- Background: `bg-[#0d0d1a]/90 backdrop-blur-sm border-b border-gray-700/50`
- **Left**: App logo (a small rounded avatar/icon, 32px, blue background with "D" initial or app icon) + app name text `"DaCollector"` in white, `font-semibold`
- **Center-left nav items**: `Dashboard`, `Collection`, `Utilities`, `Log`, `Actions`
  - Each is a `NavLink`. Active state: no underline, just slightly brighter text (`text-white`) with no background highlight — Shoko uses plain text nav items, active one is just white/brighter.
  - Inactive: `text-gray-400 hover:text-gray-200`
  - Spacing: `gap-6` between items, `text-sm font-medium`
- **Right controls** (flex row, `gap-4`, `items-center`):
  - Notification badge: bell icon + blue badge number derived from real queue/status data; hide the badge when there is no count to show.
  - User avatar: small circle with first letter of the authenticated username + username text from `/api/v3/User/Current`, `text-sm text-gray-300`
  - Settings gear icon: links to `/settings`
  - Logout icon (arrow-right-from-bracket / power icon): calls `clearApiKey()` and navigates to `/login`
  - Discord/GitHub links may be shown only when real project links are available; do not leave placeholder `#` links in the app shell.

### Page body below navbar:
- `pt-14` to account for fixed navbar
- Content fills remaining viewport height
- Background gradient spans full screen behind everything

---

## Settings Page Architecture

This is the most important page to get right. Shoko's Settings is a **floating two-column panel** centered over the background.

### Layout:
```
[ full-screen background ]
  ┌───────────────────────────────────────────────────────┐
  │ Settings                                              │
  │ ┌───────────────┐  ┌──────────────────────────────┐  │
  │ │ Left Nav      │  │ Right Content                │  │
  │ │               │  │                              │  │
  │ │ General       │  │  <section title>             │  │
  │ │ Import        │  │  <section description>       │  │
  │ │ TVDB          │  │                              │  │
  │ │ Metadata Sites│  │  <settings rows>             │  │
  │ │ Collection    │  │                              │  │
  │ │ Integrations  │  │  [Cancel]  [Save]            │  │
  │ │ User Mgmt     │  └──────────────────────────────┘  │
  │ │ API Keys      │                                     │
  │ └───────────────┘                                     │
  └───────────────────────────────────────────────────────┘
```

- The panel pair sits centered on the page, `max-w-5xl`, `mx-auto`, with top margin `mt-8` or `my-8`
- Left nav panel: `w-52 shrink-0`, dark panel background, no border-radius (sharp), border-right `border-gray-700/50`
- Right content panel: `flex-1`, dark panel background, `p-8`
- Left nav items: `text-sm text-gray-400 hover:text-gray-200 cursor-pointer px-6 py-2.5`. Active item: `text-white bg-blue-600/20 border-l-2 border-blue-500`
- Panel container: `flex bg-[#0d0d1a]/90 border border-gray-700/50`

### Settings Sections (left nav items → right content):

#### 1. General
- **Database Settings**:
  - SQLite Path (text input, read-only display)
- **Server Settings**:
  - "Server Name" (text input)
  - "Auto Update" toggle

#### 2. Import
- "Run on Start" toggle
- "Scan Drop Folders on Start" toggle  
- "File Quality Check" toggle
- "Max Auto-Import per Cycle" (number input, e.g. value `0` = unlimited)

#### 3. TVDB
- "Enabled" toggle
- "API Key" (password input)
- "Subscriber PIN" (password input)
- "Cache Expiration Days" (number input, default `7`)
- Note label: TVDB requires an API key before TVDB collection builders can fetch provider data.

#### 4. Metadata Sites
- **TMDB Options**:
  - "Auto Link" toggle (enabled by default)
  - "Auto Link Restricted" toggle (enabled)
  - "Include Restricted in Search" toggle (disabled)
- **TMDB Download Options**:
  - "Download Crew And Cast" toggle
  - "Download Movie Collections" toggle
  - "Download Alternate Ordering" toggle
  - "Download Backdrops" toggle + "Max Backdrops" number input (default `10`)
  - "Download Posters" toggle + "Max Posters" number input (default `10`)
  - "Download Logos" toggle + "Max Logos" number input (default `10`)
  - "Download Episode Thumbnails" toggle + "Max Episode Thumbnails" number input (default `1`)
  - "Download Staff Images" toggle + "Max Staff Images" number input (default `10`)
  - "Download Studio Images" toggle

#### 5. Collection
- **Language Options**: (show spinner/loading indicator while loading — these come from API)
  - "Preferred Series Language" dropdown
  - "Preferred Episode Language" dropdown
- **Relation Options**:
  - "Auto Group Series" toggle
  - "Determine Main Series Using Relation Weighing" toggle
  - "Exclude following relations" — list of checkboxes/toggles:
    - Dissimilar Titles (off), Prequel (off), Sequel (off), OVA (off), Movie (off), Same Setting (on), Alternative Setting (off), Alternative Version (off), Parent Story (off), Side Story (off), Full Story (off), Summary (off), Character (on), Other (on)

#### 6. Integrations
- **Trakt Options**:
  - "Unlink" button (red/destructive, only shown if linked)
  - "Enabled" toggle
  - "Token valid until" — read-only date display
  - "Sync Frequency" dropdown (options: Every 6 Hours, Every 12 Hours, Every 24 Hours, Every 48 Hours)
- **Plex Options**:
  - "Authenticate" button (blue/primary)
  - "Server" dropdown (`--Select Server--`)
- Cancel + Save buttons at bottom

#### 7. User Management
- **Current Users** — list of users (username + edit icon + delete icon)
  - Edit icon: pencil/edit (blue)
  - Delete icon: circle-minus (red)
- **User Options** (shown for selected user):
  - "Pick Avatar" button
  - "Display Name" text input
  - "Administrator" toggle
  - "Trakt User" toggle
  - "Plex Users" — text input (comma-separated Plex usernames)
- **Password**:
  - "Change" button
  - "New Password" password input (hidden unless Change clicked)
  - "Logout all sessions" toggle
- **Tag Restrictions**:
  - "Available Tags" — searchable list of tags from `/api/v3/Tag/AniDB` for restricted tag IDs, with `/api/v3/Tag/User` available for custom tag display.
  - Tags can be added to restricted list

#### 8. API Keys
- **Generate API Key**:
  - Text input: placeholder "Type a name for your new API key"
  - "Generate" button (blue)
- **Issued API Keys** — list of existing keys:
  - Key name (left)
  - "Delete" button (red, right)
- Note: load from `GET /api/v3/Auth/Tokens`, delete with `DELETE /api/v3/Auth/Token/{token}`

#### 9. Web UI
- Theme list/add/update/remove through `/api/v3/WebUI/Theme`.
- WebUI latest-version checks and update/manual-update actions through `/api/v3/WebUI`.
- Do not add an active-theme selector until the server exposes a real active-theme setting.

#### 10. Configuration-backed Sections
- Hashing, Release Info, Relocation, and Database should use `/api/v3/Configuration` metadata and validation.
- Do not implement browser-side hashing, rename/move, backup, or file operations in this repo.

---

## Shared UI Components

Create `src/components/ui/` with these reusable components:

### `Toggle.tsx`
Shoko's toggle is NOT a sliding pill — it's a **circle icon**:
- OFF state: hollow circle outline (`○`), `text-gray-500` / `border-gray-500`
- ON state: circle with checkmark fill (✓ inside circle), `text-blue-500`
- Use SVG or Unicode: off = `◯` (U+25EF), on = use a filled checkmark circle SVG

```tsx
// Props: checked: boolean, onChange: (v: boolean) => void, disabled?: boolean
// Renders as a clickable icon, no label (label goes in the parent row)
```

### `SettingsRow.tsx`
A row with label on the left, control on the right:
```tsx
// Props: label: string, children: ReactNode, description?: string
// Layout: flex justify-between items-center, py-2, border-b border-gray-800/50 (last:border-0)
```

### `SectionHeader.tsx`
```tsx
// Props: title: string, description: string
// Renders section title + description at top of right panel
```

### `Button.tsx`
```tsx
// Props: variant: 'primary' | 'destructive' | 'secondary', size?: 'sm' | 'md'
// primary: bg-blue-600 hover:bg-blue-500 text-white
// destructive: bg-red-600 hover:bg-red-500 text-white
// secondary: bg-transparent border border-gray-600 text-gray-300 hover:border-gray-400
```

### `TextInput.tsx`
```tsx
// Dark themed input: bg-gray-800/60 border border-gray-700 rounded-md text-sm text-gray-100
// focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
// px-3 py-2
```

### `Select.tsx`
Dark dropdown matching input style.

---

## Setup Page (First-Run Wizard)

Match Shoko's first-run experience. Shoko shows a wizard when the server state is `"Waiting"`.

Layout:
- Full screen with dark gradient background (same as rest of app)
- Centered white card (dark panel): `max-w-sm`, `bg-[#0d0d1a]/90 border border-gray-700/50`
- App logo + name at top of card
- "Create your administrator account to get started" subtitle
- Form fields: Username, Password, Confirm Password
- "Create Account" button (primary blue, full width)
- After submit: poll server, show spinner + status message

The existing logic in `Setup.tsx` is correct — only restyle it.

---

## Login Page

Same card layout as Setup. Fields: Username, Password. "Sign In" button. No changes to logic.

---

## Dashboard Page

- Stats in a row of cards (Shoko-style stat cards): Status, Uptime, Collections count
- Card style: `bg-[#0d0d1a]/80 border border-gray-700/50 rounded-md px-5 py-4`
- Collection list below: rows with collection name, sync mode, item count, enabled badge
- Keep existing data-fetching logic unchanged

---

## Collections Page

- Keep existing logic
- Restyle to match Dashboard card style
- Add/Edit collection form should be a modal or side panel

---

## Routing
- `/setup` → Setup (first-run)
- `/login` → Login
- `/dashboard` → Dashboard
- `/collections` → Collections
- `/settings` → Settings (default to first section: General)
- `/settings/:section` → Settings with active section
- `/media` → Library list with Movies, Shows, and Provider Match tabs
- `/media/:kind/:provider/:providerID` → provider-backed movie/show detail
- `/files` → file review
- `/folders` → managed folders
- `/parser` → filename parser
- `/utilities`, `/log`, `/actions` → operations surfaces

---

## API Integration Notes

### Settings API
- `GET /api/v3/Settings` — returns current settings (partial `ServerSettings` object)
- `PATCH /api/v3/Settings` — update settings (send only changed fields)
- Keep `src/api/settings.ts` aligned to fields actually returned by DaCollector Server:
  ```ts
  interface ServerSettings {
    TMDB?: {
      AutoLink?: boolean; AutoLinkRestricted?: boolean; IncludeRestricted?: boolean;
      DownloadCrewAndCast?: boolean; DownloadMovieCollections?: boolean;
      DownloadAlternateOrdering?: boolean; DownloadBackdrops?: boolean; MaxBackdrops?: number;
      DownloadPosters?: boolean; MaxPosters?: number; DownloadLogos?: boolean; MaxLogos?: number;
      DownloadEpisodeThumbnails?: boolean; MaxEpisodeThumbnails?: number;
      DownloadStaffImages?: boolean; MaxStaffImages?: number; DownloadStudioImages?: boolean;
    };
    TVDB?: { Enabled?: boolean; ApiKey?: string; Pin?: string; CacheExpirationDays?: number; };
    Plex?: { Token?: string; };
    Import?: { RunOnStart?: boolean; ScanDropFoldersOnStart?: boolean; MaxAutoScanFiles?: number; };
    Collection?: {
      AutoGroupSeries?: boolean; UseSeriesRelationGrouping?: boolean;
      ExcludeRelationTypes?: string[];
    };
    CollectionManager?: { ScheduledSyncEnabled?: boolean; SyncIntervalMinutes?: number; };
  }
  ```

### User Management API
- `GET /api/v3/User` — list users
- `GET /api/v3/User/Current` — current user profile
- `PUT /api/v3/User/Current` — update current user profile fields
- `POST /api/v3/User/Current/ChangePassword` — change current user password
- `GET /api/v3/User/{id}` — get user
- `PUT /api/v3/User/{id}` — update user
- `DELETE /api/v3/User/{id}` — delete user
- `POST /api/v3/User` — create user
- `POST /api/v3/User/{id}/ChangePassword` — admin password change
- User update bodies may include `Avatar` and `RestrictedTags`; do not invent client-only fields.

### Tag API
- `GET /api/v3/Tag/AniDB` — server tag list used by `RestrictedTags`
- `GET /api/v3/Tag/User` — custom tag list

### WebUI API
- `GET /api/v3/WebUI/Theme` — list themes
- `POST /api/v3/WebUI/Theme/AddFromURL` — add or preview a theme
- `POST /api/v3/WebUI/Theme/{id}/Update` — update a theme from its URL
- `DELETE /api/v3/WebUI/Theme/{id}` — remove a theme
- `GET /api/v3/WebUI/LatestVersion` and `GET /api/v3/WebUI/LatestServerVersion` — version checks
- `POST /api/v3/WebUI/Update` and `POST /api/v3/WebUI/Update/ReportManualUpdate` — update actions

### Configuration API
- `GET /api/v3/Configuration` — list registered server configuration metadata
- `GET /api/v3/Configuration/{id}` — load current configuration JSON
- `POST /api/v3/Configuration/{id}/Validate` — validate current configuration JSON

### Media and Provider APIs
- `GET /api/v3/Media/Movies` and `GET /api/v3/Media/Shows` — provider-filtered media lists.
- `GET /api/v3/Media/Movies/{provider}/{providerID}` and `GET /api/v3/Media/Shows/{provider}/{providerID}` — detail pages.
- `GET /api/v3/Media/Shows/{provider}/{providerID}/Seasons` and `/Episodes` — show detail episode browser.
- `GET /api/v3/Tmdb/{Movie|Show}/{id}/DaCollector/Series` and `/File` — TMDB linked local series/files.
- `GET /api/v3/Tmdb/{Movie|Show}/Online/Search` — TMDB search/cache workflow.
- `POST /api/v3/Tmdb/{Movie|Show}/{id}/Action/Refresh` and `/Action/DownloadImages` — TMDB refresh/image actions.
- `GET /api/v3/Tmdb/Show/{id}/Ordering` and `POST /api/v3/Tmdb/Show/{id}/Ordering/SetPreferred` — preferred ordering.
- `POST /api/v3/Tvdb/{Movie|Show}/{id}/Refresh`, `/Link/{seriesID}`, and `DELETE /Link/{seriesID}` — TVDB refresh/direct series linking.
- `GET /api/v3/ProviderMatch/Candidates`, `POST /api/v3/ProviderMatch/Scan`, `POST /api/v3/ProviderMatch/Series/{seriesID}/Scan`, `POST /api/v3/ProviderMatch/Candidates/{id}/Approve`, and `DELETE /api/v3/ProviderMatch/Candidates/{id}` — ambiguous match review.
- Backend gaps must stay visible instead of being faked: TMDB direct link/unlink is not exposed, TVDB linked-series lookup is not exposed, TVDB search is not exposed, and linked-file lookup is currently TMDB-only.

### File Review and Cleanup APIs
- `GET /api/v3/MediaFileReview/Files/Unmatched`, `/Files/{fileID}`, `/Files/{fileID}/Candidates`, and candidate approve/reject endpoints drive the unmatched review tab.
- `POST /api/v3/MediaFileReview/Files/ScanMatches` is a large batch scan; confirm before running, especially when `includeOnlineSearch=true`.
- `GET /api/v3/Duplicates/Exact/Summary` and `/Exact/CleanupPlan` drive exact duplicate cleanup review.
- `DELETE /api/v3/Duplicates/Exact/Location/{locationID}?confirm=false` must be called before confirmed deletion; never skip the dry-run step.
- `GET /api/v3/ReleaseManagement/DuplicateFiles/Series`, `/Episodes`, `GET /api/v3/ReleaseManagement/MissingEpisodes/Series`, and `/Episodes` are review/informational workflows in WebUI.
- `GET/POST/DELETE /api/v3/IntegrityCheck` plus `/Start` and `/File` drive the integrity tab. Integrity scans are server-side only and should be clearly confirmed before starting or deleting.
- Do not add browser-side filesystem cleanup, acquisition, or download behavior. Missing episode review must stay informational unless the server adds an explicit safe action.

### API Keys
- `GET /api/v3/Auth/Tokens` — list API tokens (returns `Array<{ Name: string; Token: string }>`)
- `POST /api/v3/Auth/Token` — generate new token (body: `{ Name: string }`, returns `{ apikey: string }`)
- `DELETE /api/v3/Auth/Token/{token}` — revoke token

---

## File Structure After Changes

```
src/
  api/
    client.ts          (unchanged)
    auth.ts            (unchanged)
    init.ts            (unchanged)
    collections.ts     (unchanged)
    configuration.ts   (configuration metadata/load/validation)
    duplicates.ts      (exact duplicate summary/cleanup/delete preview)
    integrity.ts       (integrity scans/results)
    media.ts           (media list/detail/seasons/episodes/files)
    providerMatch.ts   (provider candidate scan/approve/reject)
    releaseManagement.ts (duplicate/missing series and episode review)
    settings.ts        (ServerSettings interface)
    tags.ts            (tag lists)
    tmdb.ts            (TMDB search/refresh/images/ordering/local links)
    tvdb.ts            (TVDB refresh/direct link/unlink)
    users.ts           (user CRUD/profile/password)
    tokens.ts          (API key CRUD)
    webui.ts           (theme/update/version APIs)
    plex.ts            (unchanged)
  components/
    Layout.tsx         (REWRITE — top navbar instead of left sidebar)
    ui/
      Toggle.tsx       (NEW)
      Button.tsx       (NEW)
      TextInput.tsx    (NEW)
      Select.tsx       (NEW)
      SettingsRow.tsx  (NEW)
      SectionHeader.tsx (NEW)
  pages/
    Setup.tsx          (restyle only, keep logic)
    Login.tsx          (restyle only, keep logic)
    Dashboard.tsx      (restyle)
    Collections.tsx    (restyle)
    Settings.tsx       (FULL REWRITE — two-column, all sections)
    Media.tsx          (library list + provider-match queue)
    MediaDetail.tsx    (movie/show detail and provider actions)
    FileReview.tsx     (unmatched, duplicate, missing, and integrity review center)
  index.css            (add background gradient to body)
  App.tsx              (settings and media detail routes)
```

---

## Implementation Order

1. `tailwind.config.js` — add custom colors
2. `src/index.css` — add body background gradient
3. `src/components/ui/` — all UI components
4. `src/components/Layout.tsx` — top navbar rewrite
5. `src/api/settings.ts` — expand type
6. `src/api/users.ts` + `src/api/tokens.ts` — new API modules
7. `src/pages/Settings.tsx` — full rewrite
8. `src/pages/Setup.tsx` — restyle
9. `src/pages/Login.tsx` — restyle
10. `src/pages/Dashboard.tsx` — restyle
11. `src/pages/Collections.tsx` — restyle
12. `src/App.tsx` — add `/settings/:section` route

---

## Key Constraints

- **Do not** remove any existing API calls or routing logic
- **Do not** change the `src/api/client.ts` auth mechanism
- **Do not** add a UI framework (no Chakra, MUI, etc.)
- **Do not** change the Vite/TypeScript config
- All components must be TypeScript with proper types (no `any`)
- Tailwind only for styling — no inline `style={}` except for dynamic values that can't be expressed in Tailwind
- The app must still work with the backend returning partial/empty settings (handle undefined gracefully with optional chaining)
