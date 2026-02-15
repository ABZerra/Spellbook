# Configuration

## Core Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` (app), `8787` (standalone API) | HTTP port |
| `SPELLS_DB` | No | `data/spells.json` | JSON spell DB path |
| `SPELLBOOK_STATE` | No (standalone API) | `data/local-state.json` | Local state path for standalone API |

## Spell Backend Selection

| Variable | Required | Default | Description |
|---|---|---|---|
| `SPELLS_BACKEND` | No | `json` | `json` or `notion` |
| `NOTION_API_TOKEN` | Yes when `SPELLS_BACKEND=notion` | - | Notion API token |
| `NOTION_DATABASE_ID` | Yes when `SPELLS_BACKEND=notion` | - | Notion database ID |
| `SPELLS_SYNC_INTERVAL_SECONDS` | No | `30` | Periodic cache refresh interval |
| `SPELLS_CACHE_PATH` | No | `data/spells-cache.json` | Persisted cache snapshot path |

## Remote Persistence and Auth

| Variable | Required | Default | Description |
|---|---|---|---|
| `PERSIST_PENDING_PLAN_REMOTE` | No | `false` | Enables Postgres-backed pending plans/auth |
| `DATABASE_URL` | Yes when remote mode enabled | - | Postgres connection string |
| `DEFAULT_CHARACTER_ID` | No | `default-character` | Default character id |
| `DEFAULT_CHARACTER_NAME` | No | `Default Character` | Name for auto-created character |
| `AUTH_SESSION_TTL_SECONDS` | No | `2592000` | Session TTL in seconds |

## Notion Property Requirements

Required properties in target Notion database:
- `Spell ID` (`rich_text` or `title`)
- `Name` (`title` or `rich_text`)
- `Level` (`number`)
- `Source` (`multi_select`, `select`, or `rich_text`)
- `Tags` (`multi_select`, `select`, or `rich_text`)
- `Archived` (`checkbox`) optional but recommended

Optional rich spell metadata properties are supported (description, duration, components, spell list, school, range, casting time, save, damage, notes, preparation, combos, items).
