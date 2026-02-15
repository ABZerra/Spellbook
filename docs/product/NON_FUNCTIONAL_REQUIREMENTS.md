# Non-Functional Requirements

## Performance
- Catalog filtering and sorting should remain responsive for current spell dataset sizes.
- Prepare page queue/preview recalculation should complete quickly per interaction.
- Notion sync refresh should not block normal read access when stale cache is available.

**Assumption:** Current in-memory operations are sufficient for expected dataset size.

## Reliability
- Invalid planned changes must be rejected by validation.
- Apply logic must be deterministic and consistent with preview output.
- Remote pending-plan writes must use version checking to prevent blind overwrites.

## Data Integrity
- Remote prepared spell IDs must be constrained to known spell IDs.
- Character ownership must be enforced on remote reads/writes.
- Local state and cache file writes should use atomic temp-file replacement patterns.

## Availability and Resilience
- Health endpoint should expose service and sync health metadata.
- In Notion mode, stale cache should continue serving if refresh fails after initial success.
- In static/unavailable API scenarios, browser local draft behavior should preserve edits and pending plans.

## Security
- Session token cookie should be HTTP-only.
- Sessions should expire based on TTL and be purged server-side.
- Auth flow currently has no password/MFA.

**Assumption:** Current auth model is acceptable for MVP/trusted usage, not for high-security production.

## Maintainability
- Domain planning logic should remain adapter-agnostic.
- Storage/integration concerns should remain in adapters/services.
- Mode-specific behavior should be feature-flagged via environment variables.

## Testability
- Automated tests should continue covering planner validation/apply, spell cache behavior, Notion mapping, local state, and API flows.
