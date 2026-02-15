# Deployment

## Mode 1: Node Runtime (Integrated App)
Run the app server with appropriate env vars.

Command:
```bash
npm run dev
```

Supports:
- Full `/api/*` surface
- Optional remote Postgres mode
- Optional Notion catalog mode

## Mode 2: Static GitHub Pages
Build:
```bash
npm run build:pages
```

Build output (`dist/`):
- UI assets from `ui/`
- `domain/planner.js`
- `spells.json`
- `.nojekyll`

Supports:
- Static spell browsing and prepare workflow
- Local draft fallback in browser storage

Does not support:
- Remote auth/session
- Remote pending-plan endpoints
- Server-side sync operations

## Mode 3: Standalone Spells API
Command:
```bash
node scripts/serve-spells-api.js
```

This mode is separate from the integrated app server and uses local file persistence for one local character state.

## Operational Notes
- In remote mode, schema initialization runs at server startup (`ensureSchema`).
- In Notion mode, periodic cache refresh continues in-process.
- Manual sync endpoint (`POST /api/spells/sync`) can force refresh.

## Assumptions
- Repository CI/CD currently focuses on static GitHub Pages publish workflow.
- Additional production deployment topology (container/orchestrator/reverse proxy) is left to operator choice.
