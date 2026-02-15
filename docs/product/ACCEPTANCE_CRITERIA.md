# Acceptance Criteria

## Catalog
1. Opening `/` loads spell rows with counts and status messaging.
2. Filters (name, level, source, tags) correctly reduce displayed rows.
3. Sort controls correctly toggle order for supported keys.
4. Inline edits validate required fields and persist on save.
5. Creating a spell requires non-empty `id`, `name`, and non-negative `level`.
6. Deleting a spell removes it from subsequent list responses.

## Prepare Workflow
1. Opening `/prepare` loads current active list, pending list, and preview list.
2. Selecting add/remove/replace options queues changes immediately.
3. Invalid queue actions are blocked with an error message.
4. Preview list and preview diff are derived from planner output.
5. Removing a pending change updates all derived lists/counters.
6. Applying a single queued change updates prepared state and queue.

## Plan Apply
1. Applying full pending plan updates active prepared set to expected preview result.
2. Applying full pending plan clears pending queue.
3. In remote mode, apply writes snapshot + prepared list + cleared pending plan.
4. In local/static mode, apply updates local prepared storage and clears local pending storage.

## Remote Mode
1. `PERSIST_PENDING_PLAN_REMOTE=true` requires `DATABASE_URL`.
2. Protected remote operations require authenticated session.
3. Pending-plan `PUT` enforces optimistic version checks and returns `409` on mismatch.
4. Character switch endpoint updates scoped read/write context.

## Notion Mode
1. `SPELLS_BACKEND=notion` requires `NOTION_API_TOKEN` and `NOTION_DATABASE_ID`.
2. Notion schema verification fails fast when required property types are incompatible.
3. Manual sync endpoint refreshes snapshot metadata.
4. Soft delete archives records in Notion semantics.

## Static Mode
1. `npm run build:pages` produces `dist/` with UI, planner JS, and `spells.json`.
2. If `/api/spells` is unavailable, UI loads static `spells.json`.
3. Draft edits/pending plans persist in browser storage.
4. Reset local edits removes local patch overrides.

## Regression Gate
1. `npm test` passes.
2. Planner rejects unknown spell IDs and duplicate changes.
3. Public route contracts used by UI remain unchanged unless docs are updated accordingly.
