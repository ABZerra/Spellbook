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

Pages:
- `http://localhost:3000/` (spell catalog/editor)
- `http://localhost:3000/prepare` (pending spell preparation planner)

The UI serves a local API under:

- `GET /api/health`
- `GET /api/config`
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

### Remote Pending Plan Mode (cross-device drafts)

Set `PERSIST_PENDING_PLAN_REMOTE=true` to store `/prepare` draft plans in Postgres per user+character.

Required env vars:

- `PERSIST_PENDING_PLAN_REMOTE=true`
- `DATABASE_URL=postgres://...`

Optional env vars:

- `DEFAULT_USER_ID=demo-user`
- `DEFAULT_CHARACTER_ID=default-character`
- `DEFAULT_CHARACTER_NAME=Default Character`

When enabled, `/prepare` auto-saves each queued change to:

- `GET /api/characters/:characterId/pending-plan`
- `PUT /api/characters/:characterId/pending-plan`
- `POST /api/characters/:characterId/pending-plan/changes`
- `DELETE /api/characters/:characterId/pending-plan`
- `POST /api/characters/:characterId/pending-plan/apply`

Schema bootstrap SQL is available at `db/pending-plan-schema.sql` and is auto-applied at server startup in remote mode.

### Account Sessions (user + character scoped state)

The app now supports lightweight account sessions from the UI on both `/` and `/prepare`:

- `User ID` and `Character ID` can be switched with `Switch Session`.
- Session values are stored in cookies (`spellbook_user_id`, `spellbook_character_id`).
- In remote mode, prepared spell state is scoped by `user + character` and is available across devices when signing in with the same IDs.
- Local browser fallback drafts remain device-local, but are now also scoped per `user + character` so different users do not overwrite each other on a shared machine.

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
