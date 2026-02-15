# Configuration

## Core

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `3000` (main app) / `8787` (standalone API) | HTTP port |
| `SPELLS_DB` | No | `data/spells.json` | JSON spell DB path |
| `SPELLBOOK_STATE` | No (standalone API) | `data/local-state.json` | Local state file path |

## Spell Backend Selection

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SPELLS_BACKEND` | No | `json` | `json` or `notion` backend |
| `NOTION_API_TOKEN` | Yes when Notion backend | - | Notion auth token |
| `NOTION_DATABASE_ID` | Yes when Notion backend | - | Notion database ID |
| `SPELLS_SYNC_INTERVAL_SECONDS` | No | `30` | Periodic sync interval |
| `SPELLS_CACHE_PATH` | No | `data/spells-cache.json` | Cache snapshot file |

## Remote Persistence and Auth

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PERSIST_PENDING_PLAN_REMOTE` | No | `false` | Enables Postgres-backed remote state |
| `DATABASE_URL` | Yes when remote mode enabled | - | Postgres connection string |
| `DEFAULT_CHARACTER_ID` | No | `default-character` | Default character ID |
| `DEFAULT_CHARACTER_NAME` | No | `Default Character` | Default character name |
| `AUTH_SESSION_TTL_SECONDS` | No | `2592000` | Session TTL |

## Notion Schema Expectations

Required properties:
- `Spell ID` (`rich_text` or `title`)
- `Name` (`title` or `rich_text`)
- `Level` (`number`)
- `Source` (`multi_select`, `select`, or `rich_text`)
- `Tags` (`multi_select`, `select`, or `rich_text`)

Optional but recommended:
- `Archived` (`checkbox`) for soft delete behavior.
