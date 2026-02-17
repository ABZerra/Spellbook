# Spellbook

Spellbook is a React + Node.js app for managing spell catalogs and planning prepared spells between long rests.

## Active Runtime (Supported)

- Frontend: `frontend/` (React + Vite)
- Backend/API: `scripts/serve-app.mjs`
- Core logic: `src/domain/`, `src/services/`, `src/adapters/`

Legacy runtime code (`ui/`, standalone local-state API) is no longer part of active repo paths.

## Quick Start

Install root dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
npm install --prefix frontend
```

Run API server:

```bash
npm run dev:api
```

Run frontend dev server:

```bash
npm run dev:frontend
```

Open:

- Frontend: `http://localhost:5173`
- API (health): `http://localhost:3000/api/health`

## Routes

React routes:

- `/`
- `/prepare`
- `/catalog`
- `/characters`

## API Surface (`/api/*`)

- `GET /api/health`
- `GET /api/config`
- `GET /api/auth/me`
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/logout`
- `GET /api/session`
- `PUT /api/session`
- `GET /api/spells`
- `POST /api/spells`
- `PATCH /api/spells/:id`
- `DELETE /api/spells/:id`
- `POST /api/spells/sync`
- `GET /api/characters/:characterId/pending-plan`
- `PUT /api/characters/:characterId/pending-plan`
- `DELETE /api/characters/:characterId/pending-plan`
- `POST /api/characters/:characterId/pending-plan/changes`
- `POST /api/characters/:characterId/pending-plan/apply`
- `POST /api/characters/:characterId/pending-plan/apply-one`

## Build and Deploy

Build frontend only:

```bash
npm run build:frontend
```

Build GitHub Pages bundle:

```bash
npm run build:pages
```

`build:pages` produces `dist/` from `frontend/dist` and includes `spells.json` for static fallback mode.

Render build/start:

- Build: `npm ci && npm run build:render`
- Start: `npm start`
- Health check: `/api/health`

## Runtime Modes

### Local JSON catalog mode (default)

- Uses `data/spells.json`.
- Supports local draft fallback in browser storage when API writes are unavailable.

### Remote pending-plan mode (Postgres)

Set:

- `PERSIST_PENDING_PLAN_REMOTE=true`
- `DATABASE_URL=postgres://...`

Optional:

- `DEFAULT_CHARACTER_ID`
- `DEFAULT_CHARACTER_NAME`
- `AUTH_SESSION_TTL_SECONDS`

### Notion spell backend mode

Set:

- `SPELLS_BACKEND=notion`
- `NOTION_API_TOKEN=secret_...`
- `NOTION_DATABASE_ID=...`

Optional:

- `SPELLS_SYNC_INTERVAL_SECONDS=30`
- `SPELLS_CACHE_PATH=data/spells-cache.json`

## Data Workflow

Rebuild spell JSON from CSV:

```bash
node scripts/import-spells-csv.js Spells.csv data/spells.json
```

## Tests

Root tests:

```bash
npm test
```

Frontend tests:

```bash
npm test --prefix frontend
```
