# User Stories

## Core Stories

1. As a player, I want to filter spells by name/level/source/tags so I can quickly find relevant spells.

2. As a player, I want to mark spells prepared/not prepared so my active list matches my intended loadout.

3. As a player, I want to queue multiple prep changes before committing so I can plan safely.

4. As a player, I want to see a preview of the resulting prepared list so I can verify outcomes before applying.

5. As a player, I want to replace one spell with another in one action so long-rest changes are fast.

6. As a player, I want to clear queued changes so I can restart planning without side effects.

## Multi-Device and Team Stories

7. As a returning user, I want to sign in and access my character state from another device.

8. As a user with multiple characters, I want to switch character context and keep each character's prepared state isolated.

9. As a group organizer, I want spell data sourced from Notion so catalog updates are shared.

## Resilience Stories

10. As a user on static hosting, I want the app to stay usable without write APIs by saving drafts locally.

11. As a user, I want conflicts handled when another session updated my pending plan so I do not overwrite newer data accidentally.

## Admin/Operator Stories

12. As a maintainer, I want to import spells from CSV so I can regenerate the JSON catalog.

13. As a maintainer, I want a local dev command that serves UI + API together so testing flows is simple.

14. As a maintainer, I want a static build pipeline for GitHub Pages so read-only distribution is easy.

## Story Status (Current)

- Implemented in code: 1-14
- Partial:
  - Story 9 is implemented with strict Notion schema expectations.
- Missing UI surface:
  - No explicit history browser for long-rest snapshots in remote mode.
