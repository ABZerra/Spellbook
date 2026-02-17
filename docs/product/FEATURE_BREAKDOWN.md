# Feature Breakdown

## 1. Spell Catalog

### Capabilities
- List spells with source, level, tags, and prepared status.
- Filter by `name`, `level`, `source`, `tags`.
- Sort by source, level, name, tags, prepared state.

### Implementation
- UI: `frontend/src/app/pages/CatalogPage.tsx`
- API: `GET /api/spells`

## 2. Catalog Editing and CRUD

### Capabilities
- Edit spell fields.
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

## 3. Pending Plan Queue

### Capabilities
- Queue `add`, `remove`, `replace` changes.
- Validate queued changes against known spell IDs.
- Apply/clear queued changes.

### Implementation
- Domain planner: `src/domain/planner.js`
- Prepare page logic: `frontend/src/app/pages/PreparePage.tsx`
- Remote endpoints:
  - `GET /api/characters/:characterId/pending-plan`
  - `PUT /api/characters/:characterId/pending-plan`
  - `POST /api/characters/:characterId/pending-plan/changes`
  - `DELETE /api/characters/:characterId/pending-plan`

## 4. Preview and Diff Visualization

### Capabilities
- Show current active list.
- Show queued changes and computed diff.
- Support per-change apply/undo in UI.

### Implementation
- UI rendering/state: `frontend/src/app/pages/PreparePage.tsx`
- Planner logic: `src/domain/planner.js`

## 5. Apply Plan

### Capabilities
- Apply full pending plan to active prepared list.
- Clear pending queue after apply.
- Persist snapshot metadata in remote mode.

### Implementation
- Endpoint: `POST /api/characters/:characterId/pending-plan/apply`
- Service orchestration: `src/services/pending-plan-service.js`
- Snapshot persistence: `src/adapters/snapshot-repo.js`

## 6. Auth and Session (Remote Mode)

### Capabilities
- Sign up, sign in, logout.
- Session cookies and auth checks.
- Character switching bound to user ownership.

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

## 8. Static Fallback

### Capabilities
- Static bundle can read from `spells.json` when API unavailable.
- Draft edits/pending plan data persist in browser storage.

### Implementation
- Build: `scripts/build-gh-pages.mjs`
- Frontend fallback: `frontend/src/app/context/AppContext.tsx`
