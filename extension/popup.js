const syncButton = document.getElementById('sync-now');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const countEl = document.getElementById('count');
const timestampEl = document.getElementById('timestamp');
const tabStateEl = document.getElementById('tab-state');
const changesStatusEl = document.getElementById('changes-status');

const opsGroupEl = document.getElementById('ops-group');
const opsSummaryListEl = document.getElementById('ops-summary-list');
const unresolvedGroupEl = document.getElementById('unresolved-group');
const unresolvedListEl = document.getElementById('unresolved-list');

const legacyGroupsEl = document.getElementById('legacy-groups');
const toAddListEl = document.getElementById('to-add-list');
const toRemoveListEl = document.getElementById('to-remove-list');

function formatTimestamp(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Date(value).toLocaleString();
}

function setResult(message) {
  resultEl.textContent = message || '';
}

function setListItems(listEl, items, emptyLabel) {
  listEl.textContent = '';
  if (!items.length) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = emptyLabel;
    listEl.appendChild(emptyItem);
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  }
}

function showOpsPreview() {
  opsGroupEl.classList.remove('hidden');
  unresolvedGroupEl.classList.remove('hidden');
  legacyGroupsEl.classList.add('hidden');
}

function showLegacyPreview() {
  opsGroupEl.classList.add('hidden');
  unresolvedGroupEl.classList.add('hidden');
  legacyGroupsEl.classList.remove('hidden');
}

function renderLegacyPreview(preview) {
  showLegacyPreview();

  const toAdd = Array.isArray(preview?.toAdd) ? preview.toAdd : [];
  const toRemove = Array.isArray(preview?.toRemove) ? preview.toRemove : [];

  setListItems(toAddListEl, toAdd, 'No spells to prepare');
  setListItems(toRemoveListEl, toRemove, 'No spells to unprepare');

  if (!toAdd.length && !toRemove.length) {
    changesStatusEl.textContent = 'No changes needed. Already matching target list.';
    return;
  }

  changesStatusEl.textContent = `Will apply ${toAdd.length + toRemove.length} change(s).`;
}

function renderOpsPreview(preview) {
  showOpsPreview();

  const perList = Array.isArray(preview?.perList) ? preview.perList : [];
  const skipped = Array.isArray(preview?.skippedFromPayload) ? preview.skippedFromPayload : [];

  const summaryItems = perList.map((entry) => {
    const list = String(entry?.list || 'UNKNOWN').toUpperCase();
    const replace = Number(entry?.replace || 0);
    const prepare = Number(entry?.prepare || 0);
    const unprepare = Number(entry?.unprepare || 0);
    return `${list}: replace ${replace}, prepare ${prepare}, unprepare ${unprepare}`;
  });

  const skippedItems = skipped.map((entry) => {
    const code = String(entry?.code || 'UNKNOWN');
    const index = Number(entry?.changeIndex);
    const detail = String(entry?.detail || 'No detail available.');
    return `${code} @${Number.isFinite(index) ? index : '?'}: ${detail}`;
  });

  setListItems(opsSummaryListEl, summaryItems, 'No list operations in payload');
  setListItems(unresolvedListEl, skippedItems, 'No skipped operations');

  const actionCount = Number(preview?.actionCount || 0);
  const listCount = Number(preview?.listCount || perList.length || 0);
  const skippedCount = Number(preview?.skippedCount || skipped.length || 0);

  if (actionCount === 0 && skippedCount === 0) {
    changesStatusEl.textContent = 'No operations pending.';
    return;
  }

  changesStatusEl.textContent = `Will apply ${actionCount} operation(s) across ${listCount} list(s). Skipped: ${skippedCount}.`;
}

function renderPreview(preview) {
  if (preview?.mode === 'ops') {
    renderOpsPreview(preview);
    return;
  }

  renderLegacyPreview(preview);
}

async function loadPreview() {
  changesStatusEl.textContent = 'Loading planned changes...';
  setListItems(opsSummaryListEl, [], 'Loading...');
  setListItems(unresolvedListEl, [], 'Loading...');
  setListItems(toAddListEl, [], 'Loading...');
  setListItems(toRemoveListEl, [], 'Loading...');

  const response = await chrome.runtime.sendMessage({ type: 'PREVIEW_REQUEST' });
  if (!response || !response.ok) {
    changesStatusEl.textContent = response?.error || 'Unable to calculate planned changes.';
    setListItems(opsSummaryListEl, [], 'Unavailable');
    setListItems(unresolvedListEl, [], 'Unavailable');
    setListItems(toAddListEl, [], 'Unavailable');
    setListItems(toRemoveListEl, [], 'Unavailable');
    return false;
  }

  renderPreview(response.preview);
  return true;
}

function summarizeLegacyResult(result) {
  const lines = [];
  lines.push('Mode: legacy');
  lines.push(`Added: ${result.added.length}`);
  lines.push(`Removed: ${result.removed.length}`);
  lines.push(`Not found: ${result.notFound.length}`);
  if (result.notFound.length) {
    lines.push(`Missing: ${result.notFound.join(', ')}`);
  }
  if (result.alreadyCorrect) {
    lines.push('Already matching target list.');
  }
  lines.push(`Duration: ${result.durationMs}ms`);
  appendDebugLog(lines, result?.debugLog);
  return lines.join('\n');
}

function summarizeOpsResult(result) {
  const lines = [];
  lines.push('Mode: ops');

  const perList = Array.isArray(result?.perList) ? result.perList : [];
  if (!perList.length) {
    lines.push('No list operations were executed.');
  }

  for (const entry of perList) {
    const list = String(entry?.list || 'UNKNOWN').toUpperCase();
    const replaced = Number(entry?.replaced || 0);
    const failed = Number(entry?.failed || 0);
    lines.push(`${list}: replaced ${replaced}, failed ${failed}`);
    if (entry?.aborted && entry?.error) {
      lines.push(`${list} aborted: ${entry.error}`);
    }
  }

  const skippedCount = Number(result?.skippedCount || 0);
  lines.push(`Skipped from payload: ${skippedCount}`);

  const totals = result?.totals || {};
  if (totals.operations !== undefined) {
    lines.push(`Operations processed: ${Number(totals.operations || 0)}`);
  }

  lines.push(`Duration: ${Number(result?.durationMs || 0)}ms`);
  appendDebugLog(lines, result?.debugLog);
  return lines.join('\n');
}

function summarizeResult(result) {
  if (result?.mode === 'ops') {
    return summarizeOpsResult(result);
  }

  return summarizeLegacyResult(result);
}

function appendDebugLog(lines, debugLog) {
  if (!Array.isArray(debugLog) || !debugLog.length) return;
  lines.push('');
  lines.push('Debug log:');
  for (const entry of debugLog) {
    lines.push(String(entry));
  }
}

function summarizeFailure(response) {
  const lines = [`Sync failed: ${response?.error || 'Unknown error.'}`];
  appendDebugLog(lines, response?.debugLog);
  return lines.join('\n');
}

function getPayloadCount(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (payload.version === 2 && Array.isArray(payload.operations)) {
    return payload.operations.length;
  }
  if (payload.version === 1 && Array.isArray(payload.preparedSpells)) {
    return payload.preparedSpells.length;
  }
  return 0;
}

async function initializePopup() {
  const response = await chrome.runtime.sendMessage({ type: 'POPUP_INIT' });
  if (!response || !response.ok) {
    statusEl.textContent = response?.error || 'Failed to load popup state.';
    syncButton.disabled = true;
    return;
  }

  const tab = response.tab;
  const payload = response.payload;

  countEl.textContent = String(getPayloadCount(payload));
  timestampEl.textContent = payload ? formatTimestamp(payload.timestamp) : '-';
  tabStateEl.textContent = tab.ddbCharacterPage ? 'D&D Beyond character page' : 'Not a character page';

  if (!tab.ddbCharacterPage) {
    statusEl.textContent = 'Open a D&D Beyond character page to sync.';
    syncButton.disabled = true;
    changesStatusEl.textContent = 'Open a D&D Beyond character page to preview changes.';
    setListItems(opsSummaryListEl, [], 'Unavailable');
    setListItems(unresolvedListEl, [], 'Unavailable');
    setListItems(toAddListEl, [], 'Unavailable');
    setListItems(toRemoveListEl, [], 'Unavailable');
  } else if (!payload) {
    statusEl.textContent = response.payloadError || 'No payload cached yet. Sync will try local Spellbook API.';
    syncButton.disabled = false;
    await loadPreview();
  } else {
    const modeLabel = payload.version === 2 ? 'operations payload' : 'legacy payload';
    statusEl.textContent = response.hydrated
      ? `Ready to sync (${modeLabel} hydrated from local Spellbook API).`
      : `Ready to sync (${modeLabel} from Spellbook).`;
    syncButton.disabled = false;
    await loadPreview();
  }
}

syncButton.addEventListener('click', async () => {
  syncButton.disabled = true;
  setResult('Running sync...');

  const response = await chrome.runtime.sendMessage({ type: 'SYNC_REQUEST' });

  if (!response || !response.ok) {
    setResult(summarizeFailure(response));
    syncButton.disabled = false;
    return;
  }

  setResult(summarizeResult(response.result));
  await loadPreview();
  syncButton.disabled = false;
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'SYNC_PROGRESS' && message.progress?.label) {
    setResult(`Running sync...\n${message.progress.label}`);
  }
});

void initializePopup();
