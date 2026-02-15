# Architecture

## High-Level Overview
Spellbook is a Node.js app with:
- Browser UI (`ui/`)
- HTTP app server (`scripts/serve-app.mjs`)
- Pure planning domain (`src/domain/planner.js`)
- Adapter layer for persistence and integrations (`src/adapters/`, `src/services/`)

A separate standalone API (`scripts/serve-spells-api.js`) exists for local file-based state workflows.

## Runtime Components
- UI pages:
  - Catalog: `ui/index.html` + `ui/app.js`
  - Prepare: `ui/prepare.html` + `ui/prepare.js`
- Main server:
  - Serves static UI files
  - Exposes `/api/*` for config, auth, spells, session, and pending plans
- Spell repositories:
  - JSON file repo
  - Notion database repo
- Cache service:
  - In-memory spell snapshot
  - Optional persisted cache file for Notion mode
- Optional Postgres-backed remote state:
  - users, sessions, characters, prepared lists, pending plans, snapshots

## Layering
- Domain layer:
  - `applyPlan`, `validatePlan` (framework/storage agnostic)
- Service layer:
  - Pending plan workflows orchestrating repos
  - Spell cache sync lifecycle
- Adapter layer:
  - JSON/Notion spell storage
  - Postgres repos for auth, characters, plans, prepared lists, snapshots
- Transport/UI layer:
  - HTTP routes + browser rendering and interactions

## Modes
1. Local JSON mode (default)
- Shared spell data from `data/spells.json`
- No remote auth requirement
- Browser local fallback drafts available

2. Remote persistence mode
- Enabled by `PERSIST_PENDING_PLAN_REMOTE=true`
- Requires Postgres and authentication for protected operations
- Prepared and pending state scoped by user + character

3. Notion catalog mode
- Enabled by `SPELLS_BACKEND=notion`
- Spell catalog backed by Notion with periodic cache refresh

4. Static GitHub Pages mode
- Built assets in `dist/`
- Read-only shared data from static `spells.json`
- Browser local draft behavior for writes
