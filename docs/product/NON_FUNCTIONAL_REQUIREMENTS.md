# Non-Functional Requirements

## Performance
- Catalog filtering and sorting should remain responsive for current dataset sizes.
- Prepare queue/diff recalculation should complete quickly per interaction.
- Notion sync refresh should not block read access when stale cache exists.

## Reliability
- Invalid planned changes must be rejected by validation.
- Apply logic must be deterministic and consistent with preview/diff output.
- Remote pending-plan writes must use version checks to prevent blind overwrites.

## Data Integrity
- Remote prepared spell IDs must be constrained to known spell IDs.
- Character ownership must be enforced on remote reads/writes.
- JSON/cache file writes should use atomic temp-file replacement patterns.

## Availability and Resilience
- Health endpoint exposes service and sync metadata.
- In Notion mode, stale cache can continue serving if refresh fails after initial success.
- In static/unavailable API scenarios, local draft behavior preserves edits and pending plans.

## Security
- Session token cookie should be HTTP-only.
- Sessions expire by TTL and are purged server-side.
- Auth flow is user-id-based and not suitable for high-security production requirements.

## Maintainability
- Domain planning logic remains adapter-agnostic.
- Storage/integration concerns remain in adapters/services.
- Mode-specific behavior remains controlled by environment flags.

## Testability
- Automated tests cover planner/domain logic, adapters/services, and integrated API server behavior.
