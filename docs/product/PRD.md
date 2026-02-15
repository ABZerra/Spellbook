# Product Requirements Document (PRD)

## Product
Spellbook

## Product Summary
Spellbook is a spell preparation planner for long-rest workflows. It provides:
- A spell catalog for browsing, filtering, editing, and prepared-state toggling.
- A preparation planner for queuing `add`, `remove`, and `replace` actions.
- A deterministic preview before apply.
- Multiple runtime modes: local JSON, remote Postgres-backed persistence, Notion-backed spell catalog, and static GitHub Pages fallback.

## Problem
Players need a reliable way to plan and apply prepared spell changes without losing draft work across sessions/devices.

## Goals
- Let users manage spell catalog state with low friction.
- Let users stage prep changes safely before applying.
- Keep plan outcomes deterministic between preview and apply.
- Support both local-only and remote multi-device usage.
- Support shared spell catalog updates through Notion.

## Non-Goals
- Full character-sheet management.
- Rule engine for all game mechanics.
- Enterprise-grade identity and authorization.
- Realtime collaborative editing UI.

## Personas
1. Solo Local Player
- Runs app locally.
- Needs fast filtering and draft planning.
- Accepts local persistence.

2. Multi-Device Player
- Signs in and switches characters.
- Needs persistent prepared state and pending plans across devices.

3. Catalog Maintainer
- Uses Notion as shared spell source.
- Needs sync + manual refresh for updates.

## Key Flows
1. Catalog flow (`/`)
- Load spells via `/api/spells`.
- Filter and sort.
- Edit spell fields inline.
- Create or delete spells.
- Toggle prepared state.

2. Prepare flow (`/prepare`)
- Queue changes via dropdowns.
- See current active list, pending queue, and preview list.
- See preview diff split into replaced/added/removed.
- Apply full plan or apply/remove individual queued change.

3. Remote identity flow
- Sign up/sign in (user ID based).
- Character switching via session endpoint.
- Prepared/pending state scoped by `user + character`.

4. Fallback flow
- If API unavailable, load static `spells.json`.
- Persist draft changes locally in browser storage.

## Current Scope
### In Scope
- UI pages:
  - Catalog: `ui/index.html`
  - Prepare: `ui/prepare.html`
- Planner domain logic in `src/domain/planner.js`
- Main app server in `scripts/serve-app.mjs`
- Optional remote pending-plan persistence and auth
- Optional Notion spell backend and cache refresh
- Standalone local API in `scripts/serve-spells-api.js`

### Out of Scope
- Password-based auth and account recovery
- Remote snapshot/history UI
- Rich role/permission model

## Success Metrics
- Apply success rate (successful plan applies / apply attempts)
- Draft durability rate (write failures that still preserve local draft)
- Conflict recovery rate (409 conflicts resolved by reload/retry)
- Catalog freshness in Notion mode (`syncMeta.stale=false` ratio)

**Assumption:** These metrics are defined as product targets; telemetry collection is not yet implemented.

## Risks
- Mode fragmentation: local, remote, Notion, and static behaviors differ.
- Draft divergence: local patches can diverge from shared source.
- Auth simplicity: user-ID-only auth has limited security guarantees.
- Notion schema coupling: property-type drift breaks operations.
- Concurrency friction: optimistic version conflicts in pending-plan writes.

## Open Questions
- Should remote long-rest snapshots be surfaced in UI?
- Should local drafts support explicit reconcile/merge with remote data?
- Should authentication be upgraded beyond user-id-only?
- Should Notion sync move to event-based refresh?

## Assumptions
- Current priority is workflow reliability over enterprise security features.
- Spellbook is intended for tabletop spell-preparation use cases similar to DnD-style preparation cycles.
