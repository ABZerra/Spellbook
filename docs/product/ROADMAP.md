# Roadmap

## Current (Implemented)
- End-to-end catalog and preparation workflows.
- Local and remote persistence modes.
- Notion-backed catalog mode with cache refresh.
- Static deployment with local draft fallback.

## Near Term
1. Product telemetry
- Add event instrumentation for apply, conflict, fallback, and sync health.

2. UX hardening
- Improve mode/state visibility in UI (remote vs local vs static).
- Standardize error messages and recovery actions.

3. History visibility
- Add UI for long-rest snapshot history persisted in remote mode.

## Mid Term
1. Sync and reconciliation
- Add explicit reconciliation flow for local drafts against refreshed shared data.
- Improve concurrent editing experience beyond simple conflict reload.

2. Identity and security
- Introduce stronger auth model (beyond user-id-only sign-in).
- Add account/session management UX.

## Longer Term
1. Operational maturity
- Add production deployment profile guidance beyond local/static modes.
- Add observability conventions (logs, alerts, SLOs).

2. Extensibility
- Expand domain capabilities while preserving domain/adapter separation.

## Assumptions
- Reliability and clarity improvements are prioritized over major feature expansion.
