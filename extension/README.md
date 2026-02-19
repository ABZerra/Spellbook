# Spellbook Sync Extension (MVP)

This extension syncs D&D Beyond prepared spells from Spellbook's prepared draft payload.
It listens for Spellbook payload messages on page tabs and executes sync only on D&D Beyond.

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

## Message Contracts

- Incoming page payload: `SPELLBOOK_SYNC_PAYLOAD_SET`
- Storage key: `spellbook.syncPayload.v1`
- Ack to page: `SPELLBOOK_SYNC_PAYLOAD_ACK`
- Popup/background/content orchestration:
  - `POPUP_INIT`
  - `SYNC_REQUEST`
  - `SYNC_EXECUTE`
  - `SYNC_PROGRESS`
  - `SYNC_RESULT`

## Manual QA Checklist

- Valid D&D Beyond character page with payload present: sync succeeds.
- No payload in extension storage: popup shows actionable message.
- Character mismatch: warning is visible, sync still runs.
- Already-correct state: no action click loop, `alreadyCorrect=true` result.
- Missing selectors or changed page structure: sync fails with actionable error.
