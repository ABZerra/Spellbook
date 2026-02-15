# Architecture

## Overview
Spellbook is a browser + Node.js application with a shared domain planner and pluggable persistence adapters.

Primary runtime:
- Browser UI (`ui/`)
- HTTP server (`scripts/serve-app.mjs`)
- Domain planner (`src/domain/planner.js`)
- Adapter/services layer (`src/adapters/`, `src/services/`)

Secondary runtime:
- Standalone local file-state API (`scripts/serve-spells-api.js`)

## Layers
1. Transport/UI Layer
- Static page serving and `/api/*` routes
- Browser interactions and state rendering

2. Domain Layer
- `applyPlan`
- `validatePlan`

3. Service Layer
- Pending plan orchestration
- Spell cache lifecycle

4. Adapter Layer
- JSON spell repository
- Notion spell repository
- Postgres repositories for auth, characters, prepared lists, pending plans, snapshots

## Data Stores
- JSON files:
  - `data/spells.json`
  - `data/local-state.json` (standalone API)
  - optional `data/spells-cache.json` (Notion mode cache)
- Postgres (optional remote mode)
- Notion database (optional catalog backend)
- Browser `localStorage` (draft fallback)

## Runtime Modes
1. Local JSON mode
- Default backend uses local JSON spell file.
- No remote auth required.

2. Remote persistence mode
- Enabled via `PERSIST_PENDING_PLAN_REMOTE=true`.
- Uses Postgres schema and auth/session flow.

3. Notion catalog mode
- Enabled via `SPELLS_BACKEND=notion`.
- Uses Notion as shared spell catalog source.

4. Static pages mode
- Built artifacts in `dist/`.
- Read-only shared data with local draft fallback.
