# Spellbook Sync Extension

This MV3 extension syncs Spellbook changes to D&D Beyond.
It supports two payload modes:

- `version: 2` ops payload (preferred): per-list surgical operations (`replace`, `prepare`, `unprepare`)
- `version: 1` legacy payload: full prepared-spell list diff

The extension listens for Spellbook page payload messages and only enables sync on supported D&D Beyond character URLs.

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `/Users/zerra/Documents/Spellbook/extension`.

## Workflow

1. Open Spellbook and adjust your **next draft list** on the Prepare page.
2. Open a D&D Beyond character page.
3. Click the extension icon.
4. Click **Sync Now**.

## Supported D&D Beyond URLs

- `https://www.dndbeyond.com/characters/<id>`
- `https://www.dndbeyond.com/profile/<user>/characters/<id>`
- Optional `/edit`, query, and hash are accepted.

All other D&D Beyond pages are rejected by the popup/background gate.

## Message Contracts

- Incoming page payload: `SPELLBOOK_SYNC_PAYLOAD_SET`
- Storage key: `spellbook.syncPayload.v1`
- Ack to page: `SPELLBOOK_SYNC_PAYLOAD_ACK`
- Popup/background/content orchestration:
  - `POPUP_INIT`
  - `SYNC_REQUEST`
  - `PREVIEW_REQUEST`
  - `SYNC_EXECUTE`
  - `PREVIEW_EXECUTE`
  - `SYNC_PROGRESS`
  - `SYNC_RESULT`

### Payload Version 2 (ops mode)

```ts
type SpellOp =
  | { type: 'replace'; list: string; remove: string; add: string }
  | { type: 'prepare'; list: string; spell: string }
  | { type: 'unprepare'; list: string; spell: string };
```

Ops mode executes list-by-list:

1. Expand list section (`CLERIC`, `DRUID`, etc.)
2. Enforce rules filter state in that section:
   - `Core Rules`: OFF
   - `2014 Core Rules`: ON
   - `2014 Expanded Rules`: ON
3. Execute that list’s operations only (no cross-list fallback)

If Spellbook cannot resolve an operation list unambiguously, it may publish a partial payload with `unresolved` entries. The popup reports skipped items in preview and sync results.

### Payload Version 1 (legacy mode)

Legacy mode computes prepare/unprepare diff from `preparedSpells[]` and executes the existing full-list sync behavior.

## Manual QA Checklist

- Valid D&D Beyond character page with ops payload: sync succeeds.
- Mixed list payload executes in list groups without cross-list lookups.
- Rule toggles per list are enforced to `Core OFF / 2014 Core ON / 2014 Expanded ON`.
- Missing remove spell in replace records not-found and skips add.
- Missing add spell records failed/not-found for that operation.
- Filter enforcement failure aborts only that list section and reports failure.
- Legacy payload still syncs as fallback when no ops payload exists.
