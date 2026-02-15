# Feature Breakdown

## 1. Spell Catalog

### What it does
- Lists spells with source, level, name, tags, prepared status.
- Supports filters (name, level, source, tags).
- Supports sorting by source, level, name, tags, prepared.

### Backing implementation
- UI: `ui/index.html`, `ui/app.js`
- API read: `GET /api/spells`
- Static fallback: `dist/spells.json` / `ui/spells.json` style payload

### Value
- Fast discovery and review of currently available spells.

## 2. Spell Editing and CRUD

### What it does
- Edit fields inline.
- Toggle prepared state.
- Create new spells.
- Soft-delete spells.

### Backing implementation
- API:
  - `POST /api/spells`
  - `PATCH /api/spells/:id`
  - `DELETE /api/spells/:id`
- Repo adapters:
  - JSON repo (`src/adapters/json-spell-repo.js`)
  - Notion repo (`src/adapters/notion-spell-repo.js`)

### Notes
- In JSON local mode, prepared can be persisted in spell records.
- In remote mode, prepared state is character-scoped and stored in `prepared_lists`.

## 3. Pending Plan Queue

### What it does
- Queue `add`, `remove`, `replace` changes before apply.
- Validate changes against known spell IDs.
- Preview final prepared set and diff summary.

### Backing implementation
- Domain: `src/domain/planner.js`
- Prepare UI: `ui/prepare.js`
- Remote API routes:
  - `GET /api/characters/:characterId/pending-plan`
  - `PUT /api/characters/:characterId/pending-plan`
  - `POST /api/characters/:characterId/pending-plan/changes`
  - `DELETE /api/characters/:characterId/pending-plan`

## 4. Plan Apply (Long Rest)

### What it does
- Applies queued pending plan to active prepared state.
- Clears pending plan after successful apply.

### Backing implementation
- Remote apply endpoint:
  - `POST /api/characters/:characterId/pending-plan/apply`
- Service: `src/services/pending-plan-service.js`
- Snapshot persistence: `src/adapters/snapshot-repo.js`

### Local behavior
- In local/static modes, apply updates browser-local prepared state and clears local pending queue.

## 5. Auth and Session (Remote Mode)

### What it does
- Sign up, sign in, sign out.
- Persist session token cookie.
- Switch character context.

### Backing implementation
- Endpoints:
  - `GET /api/auth/me`
  - `POST /api/auth/signup`
  - `POST /api/auth/signin`
  - `POST /api/auth/logout`
  - `GET /api/session`
  - `PUT /api/session`
- Data: `users`, `auth_sessions`, `characters`

### Security note
- Auth is identity-based (`userId`) without password.
- **Assumption:** Intended for trusted/small-group environments in current stage.

## 6. Notion-Backed Spell Source

### What it does
- Uses Notion database as catalog source-of-truth.
- Periodically refreshes local cache.
- Supports manual sync trigger.

### Backing implementation
- Adapter: `src/adapters/notion-spell-repo.js`
- Cache service: `src/services/spell-cache-service.js`
- Sync trigger endpoint: `POST /api/spells/sync`

## 7. Static Deployment Fallback

### What it does
- Serves static app and spell JSON on GitHub Pages.
- Falls back to local browser draft storage when write APIs unavailable.

### Backing implementation
- Build script: `scripts/build-gh-pages.mjs`
- Static bundle output: `dist/`

## 8. Standalone Spells API (Legacy/Utility)

### What it does
- Offers local file-based state API separate from UI server.
- Supports plan/preview/apply/reset for one local character.

### Backing implementation
- Script: `scripts/serve-spells-api.js`
- State file: `data/local-state.json`

### Endpoints
- `GET /health`
- `GET /spells`
- `GET /state`
- `PUT /plan`
- `POST /plan/preview`
- `POST /long-rest/apply`
- `POST /state/reset`
