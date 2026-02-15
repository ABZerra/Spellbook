# Initial Architecture Setup

## Layers

1. **Domain core (`src/domain`)**
   - Pure business rules for planning and applying long-rest spell changes.
2. **Adapters (implemented for MVP)**
   - Local HTTP API (`scripts/serve-spells-api.js`)
   - Local storage adapter (`src/state/local-state.js`) backed by `data/local-state.json`

## Domain entities (MVP)

- `CharacterState` (single local character)
- `PreparedList` (active)
- `PendingPlan`
- `PlannedChange`
- `LongRestSnapshot`
- `AppState`

## Current implemented capabilities

- Build a preview from active list + plan.
- Validate duplicate changes and missing spell IDs.
- Apply plan to produce next active list and long-rest change summary.
- Persist local state for one character on one device.
- Expose local API endpoints for state, plan update, preview, apply, and reset.

## Why start here

Keeping planning rules framework-agnostic allows rapid iteration while preserving a simple local adapter layer.
