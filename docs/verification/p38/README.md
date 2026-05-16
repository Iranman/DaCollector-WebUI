# P38 Dashboard Simplification Verification

Date: 2026-05-15

Scope:
- Reworked the default Dashboard toward the Shoko server dashboard reference.
- Default visible panels are Queue/Unrecognized Files and Recently Imported.
- Advanced panels remain available through Dashboard Settings.

Verification:
- `npm run build`
- `git diff --check -- src\pages\Dashboard.tsx CLAUDE_TASKS.md`
- Browser screenshot smoke against the rebuilt `dist` bundle through a local static/API proxy:
  - `dashboard-shoko-default-desktop.png`
  - `dashboard-shoko-default-mobile.png`
  - `dashboard-legacy-migrated-desktop.png`
  - `dashboard-panels-modal.png`

Notes:
- The screenshot container used an empty test data volume, so Recently Imported and Unrecognized Files render their empty states.
- The screenshot proxy served local rebuilt WebUI assets and forwarded API requests to the P38 Docker test container on `127.0.0.1:38118`.
