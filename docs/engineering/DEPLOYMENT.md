# Deployment

## Mode 1: Integrated Node Runtime

Command:

```bash
npm start
```

Supports:
- Full `/api/*` surface
- Optional remote Postgres mode
- Optional Notion catalog mode
- Serving `frontend/dist` when present

## Mode 2: Static GitHub Pages

Build:

```bash
npm run build:pages
```

Build output (`dist/`):
- Frontend assets from `frontend/dist`
- `domain/planner.js`
- `spells.json`
- `.nojekyll`
- `404.html` (copied from `index.html`)

Supports:
- Static spell browsing and prepare workflow
- Local draft fallback in browser storage

Does not support:
- Remote auth/session
- Remote pending-plan endpoints
- Server-side sync operations

## Render Deployment

Use repository `render.yaml` defaults:
- Build command: `npm ci && npm run build:render`
- Start command: `npm start`
- Health check path: `/api/health`

## Operational Notes

- In remote mode, schema initialization runs at startup (`ensureSchema`).
- In Notion mode, periodic cache refresh runs in-process.
- Manual sync endpoint (`POST /api/spells/sync`) triggers immediate refresh.
