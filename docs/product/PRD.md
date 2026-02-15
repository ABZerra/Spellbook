# Product Requirements Document (PRD)

## Product Name
Spellbook

## Product Summary
Spellbook is a local-first spell preparation planner for tabletop RPG players. It helps users browse a spell catalog, manage prepared state, queue long-rest changes (add/remove/replace), preview outcomes, and apply plan changes.

The product runs in multiple modes:
- Local JSON mode (default)
- Remote collaborative mode with auth + Postgres persistence
- Notion-backed shared spell catalog mode
- Static GitHub Pages mode with local browser drafts

## Problem Statement
Players and game sessions need a low-friction way to:
- Track prepared spells
- Plan changes before a long rest
- Apply changes safely and predictably
- Keep draft work when offline or when APIs are unavailable

Without this tooling, prepared state and draft plans are tracked manually and are easy to lose or misapply.

## Goals
- Provide a fast spell catalog UI for filtering, sorting, and lightweight editing.
- Provide a preparation workflow that separates draft planning from apply.
- Preserve deterministic plan behavior between preview and apply.
- Support local-only use and remote multi-device use with the same UI.
- Support a shared spell source (Notion) for cross-user catalog updates.

## Non-Goals
- Character sheets or full campaign management.
- Rule enforcement beyond spell preparation transitions.
- OAuth/social login or password-based auth.
- Multi-tenant org administration.

## Personas
1. Solo Player (Local)
- Uses a single device.
- Wants quick filtering and a reliable prep queue.
- Accepts local browser/file persistence.

2. Returning Player (Remote)
- Uses multiple devices.
- Wants sign-in and character-scoped prepared/draft state.
- Needs safe conflict handling for concurrent draft changes.

3. Table Organizer / DM Ops
- Maintains a shared spell catalog in Notion.
- Wants changes reflected in the app with periodic sync and manual refresh.

## Key User Flows
1. Browse and filter catalog
- Open `/`.
- Filter by name, level, source, tags.
- Toggle prepared state or edit core fields.

2. Queue prep changes
- Open `/prepare`.
- Queue add/remove/replace from dropdowns.
- Inspect current, pending, preview, and diff panels.

3. Apply long-rest plan
- Click `Apply Plan`.
- Preview result becomes active prepared state.
- Pending queue clears.
- In remote mode, snapshot is persisted in Postgres.

4. Remote identity and character switching
- Sign up / sign in using `userId`.
- Switch character using `characterId`.
- Prepared list + pending plan scope updates to `user + character`.

5. Static fallback flow
- If API unavailable (e.g., GitHub Pages), load `spells.json`.
- Save edits and pending plans to browser `localStorage`.

## Scope (Current, Code-Backed)
### In Scope
- Two UI pages:
  - Catalog (`/` -> `ui/index.html`)
  - Prepare (`/prepare` -> `ui/prepare.html`)
- Spell CRUD against `/api/spells` when writable backend is available
- Plan queue and apply semantics via shared planner domain
- Local draft fallback for catalog edits and pending plans
- Optional remote mode with:
  - Auth sessions via cookies
  - Character ownership + scoped state
  - Postgres-backed prepared lists and pending plans
- Optional Notion spell repository with sync cache service

### Out of Scope (Current)
- Passwords and account recovery
- RBAC/permissions beyond character ownership checks
- Historical timeline UI for remote snapshots
- Realtime collaboration UI (polling/cache only)

## Success Metrics
### Product Metrics
- Plan completion rate: `% of sessions where queued plan is applied`.
- Draft resilience rate: `% of failed writes that successfully fall back to local draft`.
- Error-free apply rate: `% of apply operations without validation/runtime errors`.

### Technical Proxy Metrics
- `GET /api/health` availability
- Spell sync freshness (`syncMeta.cacheUpdatedAt`, `syncMeta.stale`)
- Pending plan conflict rate (`409` version conflict responses)

**Assumption:** Metrics collection is not yet instrumented in code; these are recommended KPIs for future telemetry.

## Risks
- Mode complexity risk: behavior differs across local, remote, and static modes.
- Data divergence risk: local draft patches can drift from remote source-of-truth.
- Auth simplicity risk: user-id-only auth is low friction but weak security.
- Notion schema drift risk: backend fails if required property types change.
- Conflict UX risk: concurrent remote edits can cause frequent version conflicts.

## Open Questions
- Should local draft patches be mergeable into remote after reconnect?
- Should remote long-rest snapshots be exposed in UI?
- Should auth move from user-id-only to email/OAuth/passwordless link?
- Should prepared-state writes be batched for lower API roundtrips?
- Should Notion sync support webhook-triggered refresh instead of interval polling?

## Assumptions
- Spellbook targets DnD-style spell preparation workflows.
- Default user journey is browser-first, not API-first.
- GitHub Pages deployment is read-only for shared data by design.
