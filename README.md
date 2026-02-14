# Spellbook

Spellbook is a web-app project for planning and managing prepared spells between long rests.

## Current setup

This repository currently provides:

- Product docs (`docs/`)
- A domain core for spell planning (`src/domain/`)
- Automated tests (`tests/`)

The domain core is intentionally framework-agnostic so we can plug it into a future API/UI stack.

## Quick start

```bash
npm test
```

## Next implementation milestones

1. Build an HTTP API around the domain service.
2. Add persistence (characters, plans, snapshots).
3. Build the web UI for current list, planned list, and diff preview.
