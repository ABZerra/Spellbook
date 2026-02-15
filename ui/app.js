const LOCAL_PATCH_KEY_PREFIX = 'spellbook.localPatches.v1';
const STATIC_SPELLS_PATH = 'spells.json';
let defaultCharacterId = 'default-character';

const elements = {
  nameFilter: document.getElementById('nameFilter'),
  levelFilter: document.getElementById('levelFilter'),
  sourceFilter: document.getElementById('sourceFilter'),
  tagsFilter: document.getElementById('tagsFilter'),
  clearFilters: document.getElementById('clearFilters'),
  statusMessage: document.getElementById('statusMessage'),
  tableBody: document.getElementById('spellTableBody'),
  countValue: document.getElementById('countValue'),
  preparedValue: document.getElementById('preparedValue'),
  nameSuggestions: document.getElementById('nameSuggestions'),
  sourceSuggestions: document.getElementById('sourceSuggestions'),
  tagSuggestions: document.getElementById('tagSuggestions'),
  sortButtons: Array.from(document.querySelectorAll('.sort-button')),
  saveModeBadge: document.getElementById('saveModeBadge'),
  resetLocalEdits: document.getElementById('resetLocalEdits'),
  refreshNowButton: document.getElementById('refreshNowButton'),
  createSpellIdInput: document.getElementById('createSpellIdInput'),
  createSpellNameInput: document.getElementById('createSpellNameInput'),
  createSpellLevelInput: document.getElementById('createSpellLevelInput'),
  createSpellSourceInput: document.getElementById('createSpellSourceInput'),
  createSpellTagsInput: document.getElementById('createSpellTagsInput'),
  createSpellPreparedInput: document.getElementById('createSpellPreparedInput'),
  createSpellButton: document.getElementById('createSpellButton'),
  signupUserIdInput: document.getElementById('signupUserIdInput'),
  signupDisplayNameInput: document.getElementById('signupDisplayNameInput'),
  signupButton: document.getElementById('signupButton'),
  signinUserIdInput: document.getElementById('signinUserIdInput'),
  signinButton: document.getElementById('signinButton'),
  logoutButton: document.getElementById('logoutButton'),
  characterIdInput: document.getElementById('characterIdInput'),
  switchCharacterButton: document.getElementById('switchCharacterButton'),
  accountSessionSummary: document.getElementById('accountSessionSummary'),
  prepareNavLink: document.getElementById('prepareNavLink'),
};

let baseSpells = [];
let localPatches = {};
let editingSpellId = null;
let isSaving = false;
let sortState = { key: 'name', direction: 'asc' };
let saveMode = 'remote';
let authenticated = false;
let currentUserId = null;
let currentDisplayName = null;
let currentCharacterId = 'default-character';
let remotePendingPlanEnabled = false;
let allowLocalDraftEdits = true;
let spellsBackend = 'json';

function normalizeIdentity(value, fallback) {
  const next = String(value || '').trim();
  if (!next) return fallback;
  return /^[A-Za-z0-9_.-]{2,64}$/.test(next) ? next : fallback;
}

function getLocalPatchKey() {
  const userKey = currentUserId || 'anonymous';
  return `${LOCAL_PATCH_KEY_PREFIX}.${userKey}.${currentCharacterId}`;
}

function updateSessionSummary() {
  if (!elements.accountSessionSummary) return;
  if (elements.switchCharacterButton) {
    elements.switchCharacterButton.disabled = remotePendingPlanEnabled && !authenticated;
  }

  if (!remotePendingPlanEnabled) {
    elements.accountSessionSummary.textContent = `Local mode (no remote auth). Character: ${currentCharacterId}`;
    return;
  }

  if (!authenticated || !currentUserId) {
    elements.accountSessionSummary.textContent = 'Not signed in.';
    return;
  }

  const identity = currentDisplayName && currentDisplayName !== currentUserId
    ? `${currentDisplayName} (${currentUserId})`
    : currentUserId;

  elements.accountSessionSummary.textContent = `Signed in as ${identity}. Character: ${currentCharacterId}`;
}

function updatePrepareLink() {
  if (!elements.prepareNavLink) return;
  elements.prepareNavLink.href = `./prepare.html?characterId=${encodeURIComponent(currentCharacterId)}`;
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle('error', isError);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function setDatalistOptions(element, values) {
  element.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
}

function setLevelOptions(spells) {
  const selected = elements.levelFilter.value;
  elements.levelFilter.innerHTML = '<option value="">All levels</option>';

  const levels = [...new Set(spells.map((spell) => spell.level).filter(Number.isFinite))].sort((a, b) => a - b);
  for (const level of levels) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = level === 0 ? 'Cantrip (0)' : `Level ${level}`;
    elements.levelFilter.append(option);
  }

  if ([...elements.levelFilter.options].some((option) => option.value === selected)) {
    elements.levelFilter.value = selected;
  }
}

function buildAutocompleteOptions(spells) {
  const names = [...new Set(spells.map((spell) => spell.name).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const sources = [...new Set(spells.flatMap((spell) => spell.source || []).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const tags = [...new Set(spells.flatMap((spell) => spell.tags || []).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

  setDatalistOptions(elements.nameSuggestions, names);
  setDatalistOptions(elements.sourceSuggestions, sources);
  setDatalistOptions(elements.tagSuggestions, tags);
}

function sanitizeSpellPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const patch = {};

  if (hasOwn(input, 'name')) {
    const name = String(input.name || '').trim();
    if (!name) return null;
    patch.name = name;
  }

  if (hasOwn(input, 'level')) {
    const level = Number.parseInt(String(input.level), 10);
    if (!Number.isFinite(level) || level < 0) return null;
    patch.level = level;
  }

  if (hasOwn(input, 'source')) {
    const source = Array.isArray(input.source) ? input.source : parseCsvList(input.source);
    patch.source = source.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (hasOwn(input, 'tags')) {
    const tags = Array.isArray(input.tags) ? input.tags : parseCsvList(input.tags);
    patch.tags = tags.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (hasOwn(input, 'prepared')) {
    patch.prepared = Boolean(input.prepared);
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}

function mergePatch(previousPatch, nextPatch) {
  return {
    ...(previousPatch || {}),
    ...nextPatch,
  };
}

function applyPatchToSpell(spell, patch) {
  if (!patch) return spell;

  const sanitized = sanitizeSpellPatch(patch);
  if (!sanitized) return spell;

  return {
    ...spell,
    ...sanitized,
  };
}

function loadLocalPatches() {
  try {
    const raw = localStorage.getItem(getLocalPatchKey());
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const patches = {};
    for (const [spellId, patch] of Object.entries(parsed)) {
      const sanitized = sanitizeSpellPatch(patch);
      if (!sanitized) continue;

      patches[spellId] = {
        ...sanitized,
        updatedAt: String(patch?.updatedAt || ''),
      };
    }

    return patches;
  } catch {
    return {};
  }
}

function saveLocalPatches() {
  try {
    localStorage.setItem(getLocalPatchKey(), JSON.stringify(localPatches));
  } catch {
    // Ignore quota/storage access errors; app still functions in memory for this session.
  }
}

function clearLocalPatches() {
  localPatches = {};
  try {
    localStorage.removeItem(getLocalPatchKey());
  } catch {
    // Ignore local storage access errors.
  }
}

async function fetchConfig() {
  try {
    const response = await fetch('api/config');
    if (!response.ok) return;

    const payload = await response.json();
    remotePendingPlanEnabled = Boolean(payload.remotePendingPlanEnabled);
    allowLocalDraftEdits = payload.allowLocalDraftEdits !== false;
    spellsBackend = String(payload.spellsBackend || spellsBackend);
    defaultCharacterId = normalizeIdentity(payload.defaultCharacterId, defaultCharacterId);
    authenticated = Boolean(payload.authenticated);
    currentUserId = payload.userId ? normalizeIdentity(payload.userId, null) : null;
    currentDisplayName = payload.displayName ? String(payload.displayName) : null;

    const fromQuery = new URLSearchParams(window.location.search).get('characterId');
    const configCharacter = normalizeIdentity(payload.characterId || payload.defaultCharacterId, currentCharacterId);
    currentCharacterId = normalizeIdentity(fromQuery, configCharacter);

    if (elements.characterIdInput) elements.characterIdInput.value = currentCharacterId;
    updateSessionSummary();
    updatePrepareLink();
  } catch {
    // Keep defaults.
  }
}

async function switchCharacter() {
  if (!remotePendingPlanEnabled) {
    currentCharacterId = normalizeIdentity(elements.characterIdInput?.value, currentCharacterId);
    updateSessionSummary();
    updatePrepareLink();
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('characterId', currentCharacterId);
    window.history.replaceState({}, '', nextUrl);
    await loadSpells();
    return;
  }

  if (!authenticated) {
    throw new Error('Sign in first.');
  }

  const characterId = normalizeIdentity(elements.characterIdInput?.value, '');
  if (!characterId) throw new Error('Character ID is required.');

  const response = await fetch('api/session', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  currentCharacterId = normalizeIdentity(payload.characterId, currentCharacterId);
  if (elements.characterIdInput) elements.characterIdInput.value = currentCharacterId;
  updateSessionSummary();
  updatePrepareLink();
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('characterId', currentCharacterId);
  window.history.replaceState({}, '', nextUrl);
  await loadSpells();
  setStatus(`Switched character to ${currentCharacterId}.`);
}

function hasLocalPatches() {
  return Object.keys(localPatches).length > 0;
}

function getEffectiveSpells() {
  return baseSpells.map((spell) => applyPatchToSpell(spell, localPatches[spell.id]));
}

function refreshDerivedOptions() {
  const spells = getEffectiveSpells();
  setLevelOptions(spells);
  buildAutocompleteOptions(spells);
}

function updateDraftUi() {
  if (!elements.saveModeBadge || !elements.resetLocalEdits) return;

  const isLocalDraft = saveMode === 'local-draft';
  if (spellsBackend === 'notion' && !isLocalDraft) {
    elements.saveModeBadge.textContent = 'Notion';
  } else {
    elements.saveModeBadge.textContent = isLocalDraft ? 'Local draft' : 'Remote';
  }
  elements.saveModeBadge.classList.toggle('local', isLocalDraft);
  elements.saveModeBadge.classList.toggle('remote', !isLocalDraft);
  elements.resetLocalEdits.hidden = !allowLocalDraftEdits || !hasLocalPatches();
}

function getFilters() {
  return {
    name: elements.nameFilter.value.trim().toLowerCase(),
    level: elements.levelFilter.value,
    source: elements.sourceFilter.value.trim().toLowerCase(),
    tags: elements.tagsFilter.value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  };
}

function matchesFilters(spell, filters) {
  if (filters.name && !spell.name.toLowerCase().includes(filters.name)) return false;
  if (filters.level !== '' && spell.level !== Number(filters.level)) return false;

  if (filters.source) {
    const spellSources = (spell.source || []).map((item) => String(item).toLowerCase());
    if (!spellSources.some((source) => source.includes(filters.source))) return false;
  }

  if (filters.tags.length > 0) {
    const spellTags = (spell.tags || []).map((item) => String(item).toLowerCase());
    if (!filters.tags.every((tag) => spellTags.includes(tag))) return false;
  }

  return true;
}

function getSortValue(spell, key) {
  if (key === 'source') return (spell.source || []).join(', ').toLowerCase();
  if (key === 'tags') return (spell.tags || []).join(', ').toLowerCase();
  if (key === 'prepared') return spell.prepared ? 1 : 0;
  if (key === 'level') return Number(spell.level || 0);
  return String(spell.name || '').toLowerCase();
}

function sortSpells(spells) {
  const sorted = [...spells].sort((a, b) => {
    const left = getSortValue(a, sortState.key);
    const right = getSortValue(b, sortState.key);

    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
  });

  if (sortState.direction === 'desc') sorted.reverse();
  return sorted;
}

function updateSortButtons() {
  for (const button of elements.sortButtons) {
    const isActive = button.dataset.sort === sortState.key;
    button.classList.toggle('active', isActive);
    button.dataset.direction = isActive ? sortState.direction : '';
  }
}

function renderTags(tags) {
  if (!tags || tags.length === 0) return '<span class="muted">—</span>';
  return tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join(' ');
}

function renderSource(source) {
  if (!source || source.length === 0) return '<span class="muted">—</span>';
  return source.map((entry) => `<span class="tag-pill source">${escapeHtml(entry)}</span>`).join(' ');
}

function renderPreparedStatus(spell) {
  if (isSaving) {
    return spell.prepared
      ? '<span class="pill prepared">Prepared</span>'
      : '<span class="pill">Not Prepared</span>';
  }

  return `
    <button type="button" class="pill-toggle ${spell.prepared ? 'prepared' : ''}" data-action="toggle-prepared" data-id="${escapeHtml(spell.id)}">
      ${spell.prepared ? 'Prepared' : 'Not Prepared'}
    </button>
  `;
}

function renderReadOnlyRow(spell) {
  return `
    <tr data-spell-id="${escapeHtml(spell.id)}">
      <td>${renderSource(spell.source)}</td>
      <td>${Number.isFinite(spell.level) ? spell.level : '—'}</td>
      <td>
        <div class="editable-cell">
          <span>${escapeHtml(spell.name)}</span>
          <div class="row-actions">
            <button type="button" class="link-button" data-action="edit" data-id="${escapeHtml(spell.id)}">Edit</button>
            <button type="button" class="link-button danger" data-action="delete" data-id="${escapeHtml(spell.id)}">Delete</button>
          </div>
        </div>
      </td>
      <td>${renderTags(spell.tags)}</td>
      <td>${renderPreparedStatus(spell)}</td>
    </tr>
  `;
}

function renderEditingRow(spell) {
  return `
    <tr data-spell-id="${escapeHtml(spell.id)}" class="editing-row">
      <td>
        <input class="edit-input" data-edit-field="source" list="sourceSuggestions" value="${escapeHtml((spell.source || []).join(', '))}" />
      </td>
      <td>
        <input class="edit-input small" data-edit-field="level" type="number" min="0" step="1" value="${escapeHtml(spell.level)}" />
      </td>
      <td>
        <div class="edit-stack">
          <input class="edit-input" data-edit-field="name" list="nameSuggestions" value="${escapeHtml(spell.name)}" />
          <div class="row-actions">
            <button type="button" class="link-button save" data-action="save" data-id="${escapeHtml(spell.id)}">Save</button>
            <button type="button" class="link-button" data-action="cancel" data-id="${escapeHtml(spell.id)}">Cancel</button>
          </div>
        </div>
      </td>
      <td>
        <input class="edit-input" data-edit-field="tags" list="tagSuggestions" value="${escapeHtml((spell.tags || []).join(', '))}" />
      </td>
      <td>
        <select class="edit-input" data-edit-field="prepared" aria-label="Prepared status">
          <option value="false" ${spell.prepared ? '' : 'selected'}>Not Prepared</option>
          <option value="true" ${spell.prepared ? 'selected' : ''}>Prepared</option>
        </select>
      </td>
    </tr>
  `;
}

function renderSpells(spells) {
  const preparedCount = spells.filter((spell) => spell.prepared).length;
  elements.countValue.textContent = String(spells.length);
  elements.preparedValue.textContent = String(preparedCount);

  if (spells.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="5">No spells match the current filters.</td>
      </tr>
    `;
    return;
  }

  const rows = spells
    .map((spell) => (spell.id === editingSpellId ? renderEditingRow(spell) : renderReadOnlyRow(spell)))
    .join('');

  elements.tableBody.innerHTML = rows;
}

function runFilters(options = {}) {
  const { announce = true } = options;
  const spells = getEffectiveSpells();
  const filters = getFilters();
  const filtered = spells.filter((spell) => matchesFilters(spell, filters));
  const sorted = sortSpells(filtered);

  renderSpells(sorted);
  updateSortButtons();
  updateDraftUi();

  if (announce) {
    setStatus(`Showing ${sorted.length} of ${spells.length} spells.`);
  }
}

function resetFilters() {
  elements.nameFilter.value = '';
  elements.levelFilter.value = '';
  elements.sourceFilter.value = '';
  elements.tagsFilter.value = '';
  runFilters();
}

function setBaseSpell(updatedSpell) {
  baseSpells = baseSpells.map((spell) => (spell.id === updatedSpell.id ? updatedSpell : spell));
}

function addBaseSpell(spell) {
  baseSpells = [...baseSpells, spell];
}

function removeBaseSpell(spellId) {
  baseSpells = baseSpells.filter((spell) => spell.id !== spellId);
}

async function patchSpell(spellId, patch) {
  let response;

  try {
    response = await fetch(`api/spells/${encodeURIComponent(spellId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch (error) {
    const wrapped = new Error(error.message || 'Network error while saving.');
    wrapped.fallbackToLocal = allowLocalDraftEdits;
    throw wrapped;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || `HTTP ${response.status}`;
    const wrapped = new Error(message);
    wrapped.fallbackToLocal = allowLocalDraftEdits
      && (response.status === 404 || response.status === 405 || response.status === 501);
    throw wrapped;
  }

  return payload.spell;
}

async function createSpell(patch) {
  const response = await fetch('api/spells', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload.spell;
}

async function deleteSpell(spellId) {
  const response = await fetch(`api/spells/${encodeURIComponent(spellId)}`, {
    method: 'DELETE',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
}

async function refreshSpellsNow() {
  const response = await fetch('api/spells/sync', {
    method: 'POST',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
}

function getEditingPatch(spellId) {
  const rows = Array.from(elements.tableBody.querySelectorAll('tr[data-spell-id]'));
  const row = rows.find((entry) => entry.getAttribute('data-spell-id') === spellId);
  if (!row) throw new Error('Edited row is missing.');

  const nameInput = row.querySelector('[data-edit-field="name"]');
  const levelInput = row.querySelector('[data-edit-field="level"]');
  const sourceInput = row.querySelector('[data-edit-field="source"]');
  const tagsInput = row.querySelector('[data-edit-field="tags"]');
  const preparedInput = row.querySelector('[data-edit-field="prepared"]');

  const name = String(nameInput?.value || '').trim();
  if (!name) throw new Error('Name is required.');

  const level = Number.parseInt(String(levelInput?.value || ''), 10);
  if (!Number.isFinite(level) || level < 0) throw new Error('Level must be a non-negative integer.');

  return {
    name,
    level,
    source: parseCsvList(sourceInput?.value),
    tags: parseCsvList(tagsInput?.value),
    prepared: String(preparedInput?.value) === 'true',
  };
}

function savePatchLocally(spellId, patch) {
  const sanitized = sanitizeSpellPatch(patch);
  if (!sanitized) throw new Error('Invalid patch payload.');

  localPatches[spellId] = {
    ...mergePatch(localPatches[spellId], sanitized),
    updatedAt: new Date().toISOString(),
  };
  saveLocalPatches();
}

async function saveRow(spellId) {
  if (isSaving) return;
  isSaving = true;

  try {
    const patch = getEditingPatch(spellId);
    try {
      const updatedSpell = await patchSpell(spellId, patch);
      setBaseSpell(updatedSpell);
      delete localPatches[spellId];
      saveLocalPatches();
      saveMode = 'remote';
      setStatus(`Saved changes for ${updatedSpell.name}.`);
    } catch (error) {
      if (!error.fallbackToLocal) throw error;

      savePatchLocally(spellId, patch);
      saveMode = 'local-draft';
      setStatus('Saved locally (draft mode).');
    }

    editingSpellId = null;
    refreshDerivedOptions();
    runFilters({ announce: false });
  } catch (error) {
    if (!allowLocalDraftEdits) {
      setStatus(`Notion sync failed, no write applied: ${error.message}`, true);
    } else {
      setStatus(`Unable to save spell: ${error.message}`, true);
    }
  } finally {
    isSaving = false;
  }
}

async function togglePrepared(spellId) {
  if (isSaving) return;
  const spell = getEffectiveSpells().find((entry) => entry.id === spellId);
  if (!spell) return;

  const patch = { prepared: !spell.prepared };
  isSaving = true;

  try {
    try {
      const updatedSpell = await patchSpell(spellId, patch);
      setBaseSpell(updatedSpell);
      delete localPatches[spellId];
      saveLocalPatches();
      saveMode = 'remote';
      setStatus(`${updatedSpell.name} is now ${updatedSpell.prepared ? 'Prepared' : 'Not Prepared'}.`);
    } catch (error) {
      if (!error.fallbackToLocal) throw error;

      savePatchLocally(spellId, patch);
      saveMode = 'local-draft';
      setStatus('Saved locally (draft mode).');
    }

    refreshDerivedOptions();
    runFilters({ announce: false });
  } catch (error) {
    if (!allowLocalDraftEdits) {
      setStatus(`Notion sync failed, no write applied: ${error.message}`, true);
    } else {
      setStatus(`Unable to update prepared status: ${error.message}`, true);
    }
  } finally {
    isSaving = false;
  }
}

async function handleCreateSpell() {
  if (isSaving) return;
  isSaving = true;
  try {
    const id = String(elements.createSpellIdInput?.value || '').trim();
    const name = String(elements.createSpellNameInput?.value || '').trim();
    const level = Number.parseInt(String(elements.createSpellLevelInput?.value || ''), 10);
    if (!id) throw new Error('Spell ID is required.');
    if (!name) throw new Error('Spell name is required.');
    if (!Number.isFinite(level) || level < 0) throw new Error('Level must be a non-negative integer.');

    const payload = {
      id,
      name,
      level,
      source: parseCsvList(elements.createSpellSourceInput?.value),
      tags: parseCsvList(elements.createSpellTagsInput?.value),
      prepared: Boolean(elements.createSpellPreparedInput?.checked),
    };

    const created = await createSpell(payload);
    addBaseSpell(created);
    refreshDerivedOptions();
    runFilters({ announce: false });
    if (elements.createSpellIdInput) elements.createSpellIdInput.value = '';
    if (elements.createSpellNameInput) elements.createSpellNameInput.value = '';
    if (elements.createSpellLevelInput) elements.createSpellLevelInput.value = '0';
    if (elements.createSpellSourceInput) elements.createSpellSourceInput.value = '';
    if (elements.createSpellTagsInput) elements.createSpellTagsInput.value = '';
    if (elements.createSpellPreparedInput) elements.createSpellPreparedInput.checked = false;
    saveMode = 'remote';
    setStatus(`Created spell ${created.name}.`);
  } catch (error) {
    setStatus(`Unable to create spell: ${error.message}`, true);
  } finally {
    isSaving = false;
  }
}

async function handleDeleteSpell(spellId) {
  if (isSaving) return;
  isSaving = true;
  try {
    await deleteSpell(spellId);
    removeBaseSpell(spellId);
    delete localPatches[spellId];
    saveLocalPatches();
    editingSpellId = null;
    refreshDerivedOptions();
    runFilters({ announce: false });
    setStatus(`Deleted spell ${spellId}.`);
  } catch (error) {
    setStatus(`Unable to delete spell: ${error.message}`, true);
  } finally {
    isSaving = false;
  }
}

function resetLocalEdits() {
  if (!allowLocalDraftEdits) return;
  clearLocalPatches();
  saveMode = 'remote';
  editingSpellId = null;
  refreshDerivedOptions();
  runFilters({ announce: false });
  setStatus('Local edits cleared.');
}

async function loadSpells() {
  try {
    setStatus('Loading spells...');
    let loadedFromStaticFile = false;
    let loadedSpells = [];

    try {
      const response = await fetch('api/spells');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      loadedSpells = payload.spells || [];
    } catch {
      const staticResponse = await fetch(STATIC_SPELLS_PATH);
      if (!staticResponse.ok) {
        const payload = await staticResponse.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${staticResponse.status}`);
      }

      const payload = await staticResponse.json();
      loadedSpells = payload.spells || [];
      loadedFromStaticFile = true;
    }

    baseSpells = loadedSpells;
    localPatches = allowLocalDraftEdits ? loadLocalPatches() : {};
    if (loadedFromStaticFile && allowLocalDraftEdits) saveMode = 'local-draft';
    if (!allowLocalDraftEdits) saveMode = 'remote';

    refreshDerivedOptions();
    updateDraftUi();
    runFilters();
    if (loadedFromStaticFile) {
      setStatus(`Loaded ${baseSpells.length} spells in static mode.`);
    }
  } catch (error) {
    elements.tableBody.innerHTML = '';
    if (remotePendingPlanEnabled && !authenticated) {
      setStatus('Sign in to load remote spell state.', true);
    } else {
      setStatus(`Unable to load spells: ${error.message}`, true);
    }
    updateDraftUi();
  }
}

for (const control of [
  elements.nameFilter,
  elements.levelFilter,
  elements.sourceFilter,
  elements.tagsFilter,
]) {
  control.addEventListener('input', runFilters);
  control.addEventListener('change', runFilters);
}

for (const button of elements.sortButtons) {
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
    if (!key) return;

    if (sortState.key === key) {
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = { key, direction: 'asc' };
    }

    runFilters();
  });
}

elements.tableBody.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const spellId = target.dataset.id;
  if (!action || !spellId) return;

  if (action === 'edit') {
    editingSpellId = spellId;
    runFilters({ announce: false });
    return;
  }

  if (action === 'cancel') {
    editingSpellId = null;
    setStatus('Edit canceled.');
    runFilters({ announce: false });
    return;
  }

  if (action === 'save') {
    void saveRow(spellId);
    return;
  }

  if (action === 'delete') {
    void handleDeleteSpell(spellId);
    return;
  }

  if (action === 'toggle-prepared') {
    void togglePrepared(spellId);
  }
});

elements.tableBody.addEventListener('keydown', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const row = target.closest('tr[data-spell-id]');
  const spellId = row?.getAttribute('data-spell-id');
  if (!spellId) return;

  if (event.key === 'Enter' && editingSpellId === spellId) {
    event.preventDefault();
    void saveRow(spellId);
  }

  if (event.key === 'Escape' && editingSpellId === spellId) {
    event.preventDefault();
    editingSpellId = null;
    runFilters({ announce: false });
  }
});

elements.clearFilters.addEventListener('click', resetFilters);
if (elements.resetLocalEdits) {
  elements.resetLocalEdits.addEventListener('click', resetLocalEdits);
}
if (elements.switchCharacterButton) {
  elements.switchCharacterButton.addEventListener('click', () => {
    void switchCharacter().catch((error) => setStatus(`Unable to switch character: ${error.message}`, true));
  });
}
if (elements.createSpellButton) {
  elements.createSpellButton.addEventListener('click', () => {
    void handleCreateSpell();
  });
}
if (elements.refreshNowButton) {
  elements.refreshNowButton.addEventListener('click', () => {
    void refreshSpellsNow()
      .then(() => loadSpells())
      .then(() => setStatus('Refreshed spells from sync source.'))
      .catch((error) => setStatus(`Unable to refresh spells: ${error.message}`, true));
  });
}

updateDraftUi();
await fetchConfig();
loadSpells();
