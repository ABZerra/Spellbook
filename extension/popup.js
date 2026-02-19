const syncButton = document.getElementById('sync-now');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const countEl = document.getElementById('count');
const timestampEl = document.getElementById('timestamp');
const tabStateEl = document.getElementById('tab-state');
const changesStatusEl = document.getElementById('changes-status');
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

function renderPreview(preview) {
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

async function loadPreview() {
  changesStatusEl.textContent = 'Loading planned changes...';
  setListItems(toAddListEl, [], 'Loading...');
  setListItems(toRemoveListEl, [], 'Loading...');

  const response = await chrome.runtime.sendMessage({ type: 'PREVIEW_REQUEST' });
  if (!response || !response.ok) {
    changesStatusEl.textContent = response?.error || 'Unable to calculate planned changes.';
    setListItems(toAddListEl, [], 'Unavailable');
    setListItems(toRemoveListEl, [], 'Unavailable');
    return false;
  }

  renderPreview(response.preview);
  return true;
}

function summarizeResult(result) {
  const lines = [];
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
  return lines.join('\n');
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

  countEl.textContent = payload ? String(payload.preparedSpells.length) : '0';
  timestampEl.textContent = payload ? formatTimestamp(payload.timestamp) : '-';
  tabStateEl.textContent = tab.ddbCharacterPage ? 'D&D Beyond character page' : 'Not a character page';

  if (!tab.ddbCharacterPage) {
    statusEl.textContent = 'Open a D&D Beyond character page to sync.';
    syncButton.disabled = true;
    changesStatusEl.textContent = 'Open a D&D Beyond character page to preview changes.';
    setListItems(toAddListEl, [], 'Unavailable');
    setListItems(toRemoveListEl, [], 'Unavailable');
  } else if (!payload) {
    statusEl.textContent = response.payloadError || 'No payload cached yet. Sync will try local Spellbook API.';
    syncButton.disabled = false;
    await loadPreview();
  } else {
    statusEl.textContent = response.hydrated
      ? 'Ready to sync (payload loaded from local Spellbook API).'
      : 'Ready to sync from Spellbook payload.';
    syncButton.disabled = false;
    await loadPreview();
  }

}

syncButton.addEventListener('click', async () => {
  syncButton.disabled = true;
  setResult('Running sync...');

  const response = await chrome.runtime.sendMessage({ type: 'SYNC_REQUEST' });

  if (!response || !response.ok) {
    setResult(`Sync failed: ${response?.error || 'Unknown error.'}`);
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
