# Feature Breakdown

## 1. Spell Catalog

### Capabilities
- List spells with source, level, tags, and prepared status.
- Filter by `name`, `level`, `source`, `tags`.
- Sort by source, level, name, tags, prepared state.

### Implementation
- UI: `ui/index.html`, `ui/app.js`
- API: `GET /api/spells`

## 2. Catalog Editing and CRUD

### Capabilities
- Inline editing of spell fields.
- Toggle prepared status.
- Create new spell entries.
- Delete spell entries.

### Implementation
- API:
  - `POST /api/spells`
  - `PATCH /api/spells/:id`
  - `DELETE /api/spells/:id`
- Adapters:
  - JSON repo: `src/adapters/json-spell-repo.js`
  - Notion repo: `src/adapters/notion-spell-repo.js`

### Notes
- In remote mode, prepared state is character-scoped (stored in `prepared_lists`).
- In local JSON mode without remote persistence, prepared can be written into JSON spell records.

## 3. Pending Plan Queue

### Capabilities
- Queue `add`, `remove`, `replace` changes.
- Validate queued changes against known spell IDs.
- Prevent invalid queue operations in UI (e.g., replacing with already active spell).

### Implementation
- Domain planner: `src/domain/planner.js`
- Prepare page logic: `ui/prepare.js`
- Remote endpoints:
  - `GET /api/characters/:characterId/pending-plan`
  - `PUT /api/characters/:characterId/pending-plan`
  - `POST /api/characters/:characterId/pending-plan/changes`
  - `DELETE /api/characters/:characterId/pending-plan`

## 4. Preview and Diff Visualization

### Capabilities
- Show current active spells.
- Show pending grouped by added/removed/replaced.
- Show preview list and preview diff split into replaced/added/removed.
- Support per-change actions: apply now/remove.

### Implementation
- UI rendering and state transforms in `ui/prepare.js`
- Planner summary from `applyPlan` in `src/domain/planner.js`

## 5. Apply Plan

### Capabilities
- Apply full pending plan to active prepared list.
- Clear pending queue after apply.
- Persist remote snapshot metadata in Postgres mode.

### Implementation
- Endpoint: `POST /api/characters/:characterId/pending-plan/apply`
- Service orchestration: `src/services/pending-plan-service.js`
- Snapshot persistence: `src/adapters/snapshot-repo.js`

## 6. Auth and Session (Remote Mode)

### Capabilities
- Sign up, sign in, logout.
- Session cookies and auth checks.
- Character switching bound to authenticated user ownership.

### Implementation
- Endpoints:
  - `GET /api/auth/me`
  - `POST /api/auth/signup`
  - `POST /api/auth/signin`
  - `POST /api/auth/logout`
  - `GET /api/session`
  - `PUT /api/session`
- Repos: `src/adapters/auth-repo.js`, `src/adapters/character-repo.js`

## 7. Notion Catalog Backend

### Capabilities
- Read/update/create/delete spells in Notion database.
- Schema verification for required/optional properties.
- Soft delete via `Archived` checkbox or Notion archive.
- Periodic cache refresh + manual sync endpoint.

### Implementation
- Adapter: `src/adapters/notion-spell-repo.js`
- Cache service: `src/services/spell-cache-service.js`
- Sync endpoint: `POST /api/spells/sync`

## 8. Static Mode Fallback

### Capabilities
- Serve static bundle from `dist/`.
- Load spells from static JSON when API unavailable.
- Save local patches/pending plans in browser storage.

### Implementation
- Build: `scripts/build-gh-pages.mjs`
- Fallback logic: `ui/app.js`, `ui/prepare.js`

## 9. Standalone Local API

### Capabilities
- Local state API for a single local character.
- Supports plan write, preview, apply, and reset.

### Implementation
- Server: `scripts/serve-spells-api.js`
- State adapter: `src/state/local-state.js`
