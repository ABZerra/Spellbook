# Product Requirements Document (PRD)

## Product
Spellbook

## Product Summary
Spellbook is a spell-preparation workflow app for long-rest planning. The currently implemented product is:
- A React frontend (`/`, `/prepare`, `/catalog`, `/characters`).
- An integrated Node API (`/api/*`) for spells, auth/session, and pending-plan operations.
- A deterministic planner domain used for diffing and apply behavior.
- Optional remote persistence (Postgres) and optional Notion catalog backend.
- Static fallback behavior for read/draft continuity when API access is unavailable.

## Problem
Players need to stage and validate prepared-spell changes before committing them, while preserving drafts across interruptions and supporting optional multi-device continuity.

## Jobs To Be Done (JTBD)

### Primary JTBD
When I am preparing for a long rest, I want to compare my current prepared spells against a planned next loadout and apply changes safely, so I can avoid mistakes and keep my setup consistent.

### Supporting JTBDs
1. When I manage my spell catalog, I want filtering, sorting, and editing tools, so I can quickly maintain an accurate spell list.
2. When I switch devices or characters (in remote mode), I want my prepared/pending state scoped correctly, so I can continue without data leakage.
3. When the API is unavailable (static/fallback scenario), I want local draft persistence, so my work is not blocked.
4. When using Notion as source-of-truth, I want sync and schema validation, so catalog operations stay reliable.

## Implemented Feature Set (Realistic Current State)
1. Catalog management (`/catalog`)
- Load spells from `/api/spells`.
- Filter by name, level, source, tags.
- Sort by name, level, source, tags, prepared.
- Create, edit, delete spells.
- Toggle prepared state.

2. Preparation workflow (`/` and `/prepare`)
- Build next-slot draft list.
- View current list, next list, and computed diff.
- Apply one change or full plan.
- Discard pending changes.

3. Remote mode (optional)
- User-ID signup/signin/logout.
- Character-scoped session switching.
- Pending-plan optimistic version control and conflict responses.

4. Notion backend mode (optional)
- Notion-backed catalog CRUD with schema checks.
- Periodic cache + manual sync endpoint.

5. Static fallback mode
- Frontend falls back to static `spells.json` reads.
- Local browser draft persistence for edits and pending plan state.

## Requirements Currently Fulfilled

### Functional Requirements (Implemented)
- `FR-1` Catalog retrieval and filtering is available via `GET /api/spells`.
- `FR-2` Catalog CRUD is available via `POST/PATCH/DELETE /api/spells*`.
- `FR-3` Prepared status updates are supported through spell update flows.
- `FR-4` Plan computation is deterministic via planner domain logic used by prepare UI + API services.
- `FR-5` Pending-plan CRUD is available via `/api/characters/:characterId/pending-plan*`.
- `FR-6` Full apply and single-change apply are supported via `/apply` and `/apply-one` endpoints.
- `FR-7` Remote auth/session operations are available via `/api/auth/*` and `/api/session`.
- `FR-8` Character ownership/scoping is enforced in remote operations.
- `FR-9` Notion mode validates required schema compatibility before operation.
- `FR-10` Static fallback supports local draft continuity when API writes fail/unavailable.

### Non-Functional Requirements (Implemented)
- `NFR-1` Pending-plan remote writes enforce optimistic version conflict detection (`409` behavior).
- `NFR-2` Health/status endpoint is available at `GET /api/health`.
- `NFR-3` Test gates are present for domain/adapters/services/frontend and currently pass in repo workflow.
- `NFR-4` Docs and runtime now align to active architecture (React frontend + integrated API).

## In Scope
- React app in `frontend/src`.
- Integrated app server in `scripts/serve-app.mjs`.
- Domain planner logic in `src/domain/planner.js`.
- Optional remote pending-plan persistence and auth.
- Optional Notion spell backend and cache refresh.
- Static fallback using built assets and `spells.json`.

## Out of Scope
- Password-based auth and account recovery.
- Full character-sheet management UX (current `/characters` page is limited placeholder content).
- Remote snapshot/history browsing UI.
- Role/permission management beyond current ownership checks.
- Legacy standalone local-state API runtime.

## Success Criteria (Current Product Baseline)
- Users can complete catalog CRUD and prepare/apply workflow without endpoint mismatches.
- Plan outcomes remain deterministic between preview/diff and apply.
- Remote mode prevents blind overwrites using version checks.
- Static fallback preserves local progress when remote API access is unavailable.
