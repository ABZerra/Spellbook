# Spellbook

Spellbook is a web-app project for planning and managing prepared spells between long rests.

## Current setup

This repository currently provides:

- Product docs (`docs/`)
- A domain core for spell planning (`src/domain/`)
- Automated tests (`tests/`)
- Spell import tooling and a local JSON-backed query API

The domain core is intentionally framework-agnostic so we can plug it into a future API/UI stack.

## Quick start

```bash
npm test
```

## Run basic UI

```bash
npm run dev
```

Then open `http://localhost:3000`.

The UI serves a local API under:

- `GET /api/health`
- `GET /api/spells`

`/api/spells` supports the same query params as the standalone API:
- `name`
- `level`
- `source`
- `tags`
- `prepared`

### Local Draft Mode (static preview safe)

The UI now supports local draft persistence for edits when API writes are unavailable (for example, static hosting like GitHub Pages).

- Reads still come from `GET /api/spells` when available.
- If `PATCH /api/spells/:id` fails due missing endpoint/network, edits are saved to browser `localStorage`.
- Local drafts are per-browser/per-device and are not shared.
- The table shows a mode badge (`Remote` or `Local draft`) and provides a `Reset local edits` action.

## Spell data workflow

### Rebuild database from CSV

```bash
node scripts/import-spells-csv.js Spells.csv data/spells.json
```

### Start API server

```bash
node scripts/serve-spells-api.js
```

Defaults:
- `PORT=8787`
- `SPELLS_DB=data/spells.json`

### Endpoints

- `GET /health`
- `GET /spells`

`/spells` query params:
- `name` (substring, case-insensitive)
- `level` (number)
- `source` (comma-separated list; matches any)
- `tags` (comma-separated list; must include all)
- `prepared` (`true` or `false`)

Example:

```bash
curl "http://localhost:8787/spells?level=1&source=Druid&tags=Concentration"
```

## Next implementation milestones

1. Build an HTTP API around the domain service.
2. Add persistence (characters, plans, snapshots).
3. Build the web UI for current list, planned list, and diff preview.
