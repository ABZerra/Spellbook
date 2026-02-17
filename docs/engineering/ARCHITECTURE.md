# Architecture

## Overview

Spellbook runs as a React frontend with a Node.js integrated API server.

Primary runtime:
- Frontend app (`frontend/src`)
- HTTP server (`scripts/serve-app.mjs`)
- Domain planner (`src/domain/planner.js`)
- Services (`src/services/`)
- Adapters (`src/adapters/`)

## Layers

1. UI/Transport Layer
- React routes and components in `frontend/src/app`
- HTTP API + static asset serving in `scripts/serve-app.mjs`

2. Domain Layer
- `applyPlan`
- `validatePlan`

3. Service Layer
- Pending-plan orchestration
- Spell cache lifecycle

4. Adapter Layer
- JSON spell repository
- Notion spell repository
- Postgres repositories for auth, characters, prepared lists, pending plans, snapshots

## Data Stores

- JSON files:
  - `data/spells.json`
  - optional `data/spells-cache.json` (Notion mode)
- Postgres (optional remote mode)
- Notion database (optional catalog backend)
- Browser `localStorage` (draft fallback)

## Runtime Modes

1. Local JSON mode (default)
- Catalog source is `data/spells.json`.

2. Remote pending-plan mode
- Enabled via `PERSIST_PENDING_PLAN_REMOTE=true`.
- Uses Postgres schema and auth/session flow.

3. Notion catalog mode
- Enabled via `SPELLS_BACKEND=notion`.
- Uses Notion as shared spell catalog source.

4. Static pages mode
- Built artifacts in `dist/` from `frontend/dist`.
- Uses `spells.json` static fallback when API is unavailable.

## Notes

Legacy static UI and standalone local-state API are no longer active architecture components.
