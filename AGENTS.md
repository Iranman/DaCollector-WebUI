# DaCollector WebUI — Codex Agent Specification

## Goal
Rewrite the DaCollector WebUI to visually match **Shoko Server's web interface** as closely as possible. Study the design description below carefully — every detail matters. Do not invent new patterns; replicate Shoko's patterns exactly.

---

## Stack (do not change)
- React 18 + TypeScript
- Tailwind CSS v3 (extend theme in `tailwind.config.js`)
- React Router v6
- Vite
- No new npm packages unless absolutely necessary (e.g. `lucide-react` for icons is acceptable)

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
[ Logo icon + "DaCollector" ]   [ Dashboard | Collection | Utilities | Log | Actions ]   [ 🔔 0 | 👤 Default | ⚙ | ↪ ]
```

- Background: `bg-[#0d0d1a]/90 backdrop-blur-sm border-b border-gray-700/50`
- **Left**: App logo (a small rounded avatar/icon, 32px, blue background with "D" initial or app icon) + app name text `"DaCollector"` in white, `font-semibold`
- **Center-left nav items**: `Dashboard`, `Collection`, `Utilities`, `Log`, `Actions`
  - Each is a `NavLink`. Active state: no underline, just slightly brighter text (`text-white`) with no background highlight — Shoko uses plain text nav items, active one is just white/brighter.
  - Inactive: `text-gray-400 hover:text-gray-200`
  - Spacing: `gap-6` between items, `text-sm font-medium`
- **Right controls** (flex row, `gap-4`, `items-center`):
  - Notification badge: bell icon + blue badge number (`0`), `text-sm`
  - User avatar: small circle with first letter of username + username text (e.g. "D  Default"), `text-sm text-gray-300`
  - Settings gear icon: links to `/settings`
  - Logout icon (arrow-right-from-bracket / power icon): calls `clearApiKey()` and navigates to `/login`
  - Discord icon (links to Discord — just a placeholder `#`) and GitHub icon (placeholder `#`) — small icon buttons, `text-gray-400 hover:text-gray-200`

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
  - "Available Tags" — searchable list of tags (from API `/api/v3/Filter/Tag/User` or similar)
  - Tags can be added to restricted list

#### 8. API Keys
- **Generate API Key**:
  - Text input: placeholder "Type a name for your new API key"
  - "Generate" button (blue)
- **Issued API Keys** — list of existing keys:
  - Key name (left)
  - "Delete" button (red, right)
- Note: load from `GET /api/v3/Auth/Tokens`, delete with `DELETE /api/v3/Auth/Token/{token}`

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

## Routing (no changes)
- `/setup` → Setup (first-run)
- `/login` → Login
- `/dashboard` → Dashboard
- `/collections` → Collections
- `/settings` → Settings (default to first section: General)
- `/settings/:section` → Settings with active section

---

## API Integration Notes

### Settings API
- `GET /api/v3/Settings` — returns current settings (partial `ServerSettings` object)
- `PATCH /api/v3/Settings` — update settings (send only changed fields)
- The existing `src/api/settings.ts` type `ServerSettings` needs to be **expanded** to cover all the new settings fields:
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
  }
  ```

### User Management API
- `GET /api/v3/User` — list users
- `GET /api/v3/User/{id}` — get user
- `PUT /api/v3/User/{id}` — update user
- `DELETE /api/v3/User/{id}` — delete user
- `POST /api/v3/User` — create user

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
    settings.ts        (expand ServerSettings interface)
    users.ts           (NEW — user CRUD)
    tokens.ts          (NEW — API key CRUD)
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
  index.css            (add background gradient to body)
  App.tsx              (minor: add /settings/:section route)
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
