# User Stories

## Catalog Stories
1. As a player, I want to filter spells by name/level/source/tags so I can quickly find relevant options.
2. As a player, I want to sort spells by different keys so I can inspect my list from different perspectives.
3. As a player, I want to edit spell metadata inline so I can keep the catalog accurate.
4. As a player, I want to create and delete custom spells so my catalog matches my table rules.

## Preparation Stories
5. As a player, I want to queue add/remove/replace changes so I can plan before committing.
6. As a player, I want a preview list and diff so I can confirm outcomes before apply.
7. As a player, I want to apply one pending change immediately so I can partially commit my queue.
8. As a player, I want to apply the full plan in one action at long rest.

## Identity and Multi-Device Stories
9. As a returning player, I want to sign in and recover my prepared state on another device.
10. As a player with multiple characters, I want to switch character context without data leakage.
11. As a player, I want plan conflict handling so concurrent edits do not silently overwrite each other.

## Catalog Source Stories
12. As a maintainer, I want to use Notion as the shared spell source of truth.
13. As a maintainer, I want manual sync refresh so I can pull latest Notion updates on demand.

## Resilience Stories
14. As a static-hosted user, I want local draft fallback when API writes are unavailable.
15. As a user, I want pending draft persistence in browser storage when remote mode is disabled.

## Maintainer Stories
16. As a maintainer, I want CSV import tooling to regenerate spell JSON.
17. As a maintainer, I want a simple command to run UI+API locally.
18. As a maintainer, I want automated tests for planner and adapters to prevent regressions.
