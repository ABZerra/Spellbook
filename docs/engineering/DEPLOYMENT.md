# Deployment

## Deployment Modes

## 1. Local/Server Runtime Mode
Use `npm run dev` to run the integrated UI + API server.

Capabilities:
- Full API surface
- Optional Notion catalog backend
- Optional Postgres remote persistence and auth

## 2. Static GitHub Pages Mode
Build with:
```bash
npm run build:pages
```

Build behavior (`scripts/build-gh-pages.mjs`):
- Copies `ui/` to `dist/`
- Copies `src/domain/planner.js` to `dist/domain/planner.js`
- Copies `data/spells.json` to `dist/spells.json`
- Writes `dist/.nojekyll`

Capabilities/limits in static mode:
- Reads spell catalog from static `spells.json`
- API writes and auth/session endpoints are unavailable
- UI falls back to browser local draft storage for edits/plans

## 3. Standalone Spells API Mode
Run:
```bash
node scripts/serve-spells-api.js
```

This is a local file-state API for a single local character and is separate from the integrated app server.

## Operational Notes
- Remote mode schema (`users`, `characters`, `prepared_lists`, `pending_plans`, `long_rest_snapshots`, `auth_sessions`) is auto-created at startup when enabled.
- Notion mode should persist cache to disk to allow stale-read fallback when Notion is temporarily unavailable.
- For production hosting beyond GitHub Pages, deploy the Node app server with env vars configured per selected mode.

## Assumptions
- CI/CD for non-GitHub-Pages server deployment is not defined in this repository.
- Current GitHub workflow targets static site publishing only.
