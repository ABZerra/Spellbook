# Roadmap

## Current State (Implemented)
- Catalog + prepare workflows across local, remote, and static modes.
- JSON and Notion spell backends.
- Remote auth/session and character-scoped persistence.
- Long-rest apply with remote snapshot persistence.

## Phase 1: Product Hardening
- Add instrumentation for key success metrics (apply rate, conflict rate, fallback rate).
- Improve error messaging consistency across modes.
- Add richer loading and stale-cache indicators in UI.

## Phase 2: Collaboration and History
- Add UI for viewing long-rest snapshot history.
- Add explicit merge/reconcile flow for local drafts vs remote changes.
- Add change attribution (who/when) in shared modes.

## Phase 3: Security and Identity
- Upgrade authentication beyond user-id-only sign-in.
- Add account recovery/session management UX.
- Add stronger cookie/session hardening settings and auditing.

## Phase 4: Operational Maturity
- Add deployment profiles for managed hosting (beyond local + GitHub Pages).
- Add structured logs and health/alerting hooks.
- Add migration and backup guidance for Postgres + Notion-backed operations.

## Assumptions
- Near-term roadmap prioritizes reliability and collaboration UX over feature breadth.
- No mobile-native client is planned in the immediate phases.
