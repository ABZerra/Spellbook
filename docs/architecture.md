# Initial Architecture Setup

## Layers

1. **Domain core (`src/domain`)**
   - Pure business rules for planning and applying long-rest spell changes.
2. **Adapters (future)**
   - API layer (REST/tRPC/GraphQL)
   - Storage layer (SQL/NoSQL)
   - UI state layer (React)

## Domain entities (MVP)

- `Character`
- `PreparedList` (active)
- `PendingPlan`
- `PlannedChange`
- `LongRestSession`
- `PreparedListSnapshot`

## Current implemented capabilities

- Build a preview from active list + plan.
- Validate duplicate changes and missing spell IDs.
- Apply plan to produce next active list and long-rest change summary.

## Why start here

Keeping this logic framework-agnostic allows rapid iteration on rules while API/UI are still evolving.
