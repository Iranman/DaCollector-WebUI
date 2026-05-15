# P31 Container-Served WebUI Validation

Date: 2026-05-15

## Build

`npm run build` passed with the existing Vite CJS, PostCSS module-type, SignalR Rollup annotation, and chunk-size warnings.

## Container Setup

Validation used `ghcr.io/iranman/dacollector:latest` with the freshly built local `dist` mounted as `/app/webui` in a temporary container:

- Container: `dacollector-p31`
- URL: `http://127.0.0.1:38112/webui`
- Image digest: `ghcr.io/iranman/dacollector@sha256:1eb3de57dd111cb857806fb84dce71d241418632120c2d1f88cb8e14e2c78c45`
- Image created: `2026-05-15T03:43:19.671017323Z`

The smoke container completed first-run setup and reached `Started`.

## Route Smoke

All required container-served routes returned HTTP 200:

| Route | Status |
| --- | --- |
| `/webui/setup` | 200 |
| `/webui/login` | 200 |
| `/webui/dashboard` | 200 |
| `/webui/settings/web-ui` | 200 |
| `/webui/files` | 200 |
| `/webui/utilities` | 200 |
| `/webui/version.json` | 200 |

## Metadata

Both `/app/webui/version.json` and the installed `/home/dacollector/.dacollector/DaCollector/webui/version.json` reported:

- package: `1.0.0`
- minimumServerVersion: `1.0.0`
- tag: `v1.0.0`
- git: `93d3f0a995996a19b9ba1b2dde30a9a02ff76a48`
- channel: `Stable`

## Screenshots

- `desktop-dashboard.png`
- `desktop-settings-web-ui.png`
- `mobile-settings-web-ui.png`

## Notes

Settings > Web UI diagnostics now show bundle/install match state, update state, current install metadata, bundled WebUI metadata, and latest-release metadata. The diagnostics continue rendering local installed/bundled metadata when a remote latest-version check fails.
