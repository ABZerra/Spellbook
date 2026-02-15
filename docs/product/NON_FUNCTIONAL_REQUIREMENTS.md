# Non-Functional Requirements

## Performance
- Catalog filtering and sorting should feel immediate for the current spell set size.
- Spell sync refresh should not block UI responsiveness.
- Prepare page recalculations should complete on each queue change without noticeable lag.

**Assumption:** Current dataset is small enough for in-memory filtering/sorting in browser and server.

## Reliability
- Pending plan validation must reject invalid/unknown spell changes.
- Apply behavior must be deterministic: same active list + same change list => same result.
- In remote mode, pending plan writes must use version checks to avoid silent overwrite.

## Data Integrity
- Character-scoped remote state separation (`userId + characterId`) must be enforced.
- Prepared spell IDs saved remotely must be constrained to known spell IDs.
- Local JSON persistence writes should be atomic (temp file rename pattern).

## Availability
- `GET /api/health` should report service and sync status.
- If backend writes fail in static/unavailable modes, app should degrade to local draft behavior where enabled.

## Security and Privacy
- Session token cookie should be HTTP-only and scoped to app path.
- Session expiration should be enforced server-side.
- No password or MFA in current implementation.

**Assumption:** Security model is acceptable for MVP/trusted environment, not hardened for public internet threat models.

## Maintainability
- Domain planner logic should remain framework-agnostic and test-covered.
- Adapters (JSON/Notion/Postgres) should stay isolated from domain rules.
- Environment variables should gate optional modes cleanly.

## Testability
- Automated tests should continue covering:
  - Planner logic
  - Spell cache behavior
  - Notion adapter mapping
  - API behavior and state persistence

## Portability
- App should run on Node.js 20+.
- Static bundle should run on GitHub Pages without server-side runtime.
