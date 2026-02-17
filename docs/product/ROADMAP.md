# Roadmap

## Current (Implemented)
- End-to-end catalog and preparation workflows.
- Local JSON + static fallback behavior.
- Optional remote persistence mode.
- Optional Notion-backed catalog mode.

## Near Term
1. Product telemetry
- Add instrumentation for apply, conflict, fallback, and sync health.

2. UX hardening
- Improve mode/state visibility in UI.
- Standardize error messaging and recovery actions.

3. History visibility
- Add UI for long-rest snapshots persisted in remote mode.

## Mid Term
1. Sync and reconciliation
- Add explicit reconciliation flow for local drafts against refreshed shared data.
- Improve concurrent editing beyond simple conflict reload.

2. Identity and security
- Upgrade auth model beyond user-id-only flow.
- Add account/session management UX.

## Longer Term
1. Operational maturity
- Add broader production deployment guidance.
- Define observability conventions.

2. Extensibility
- Expand domain capabilities while preserving layer boundaries.
