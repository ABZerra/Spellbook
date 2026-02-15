# Acceptance Criteria

## Catalog
1. Loading `/` shows spell table with count + prepared count.
2. Name, level, source, and tags filters update results.
3. Sorting toggles asc/desc for available sort keys.
4. Inline edit saves valid changes and shows status message.
5. Create spell requires `id`, `name`, and non-negative `level`.
6. Delete spell removes item from visible catalog.

## Preparation Planning
1. Loading `/prepare` shows current active, pending, and preview counts.
2. Selecting add/remove/replace queues valid changes immediately.
3. Invalid queue actions are blocked with explanatory error.
4. Preview list always reflects current active + pending queue via planner rules.
5. Clearing pending plan empties queue and updates UI.

## Plan Apply
1. Apply updates active prepared set to preview outcome.
2. Apply clears pending queue on success.
3. In remote mode, apply persists snapshot and updated prepared list.
4. In local/static mode, apply updates local prepared state and clears local pending plan.

## Remote Mode (Postgres)
1. `PERSIST_PENDING_PLAN_REMOTE=true` requires valid `DATABASE_URL`.
2. Unauthenticated remote calls to protected operations return authentication errors.
3. Pending plan updates enforce optimistic version checks and return `409` on conflict.
4. Character switching scopes reads/writes to selected character.

## Notion Backend Mode
1. `SPELLS_BACKEND=notion` requires `NOTION_API_TOKEN` and `NOTION_DATABASE_ID`.
2. Missing/invalid schema types fail startup or operations with clear errors.
3. `POST /api/spells/sync` refreshes cache and updates sync metadata.
4. Soft delete archives entries (checkbox or Notion archived flag).

## Static Mode
1. GitHub Pages build outputs static assets and `spells.json` to `dist/`.
2. App loads catalog from static JSON when API unavailable.
3. Local draft persistence stores edits/pending state in browser `localStorage`.
4. Reset local edits clears local patch overrides.

## Regression Criteria
1. `npm test` passes with no failing suites.
2. Planner validation rejects unknown spell IDs and duplicate change entries.
3. API and UI behavior remain compatible with existing endpoint contracts.
