# Spellbook

Spellbook is a web-app project for planning and managing prepared spells between long rests.

## Current setup

This repository currently provides:

- Product docs (`docs/`)
- A domain core for spell planning (`src/domain/`)
- An interactive web app (`public/` + `src/server.js`)
- Automated tests (`tests/`)

## Quick start

```bash
npm test
npm start
```

Then open `http://localhost:4173`.

## Next implementation milestones

1. Add persistence (characters, plans, snapshots).
2. Build API endpoints for character CRUD and history.
3. Expand UI with reusable groups and per-character views.
