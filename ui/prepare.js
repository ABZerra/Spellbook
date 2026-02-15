import { applyPlan, validatePlan } from './domain/planner.js';

const PENDING_PLAN_KEY_PREFIX = 'spellbook.pendingPlan.v1';
const LOCAL_PREPARED_KEY_PREFIX = 'spellbook.localPrepared.v1';
const STATIC_SPELLS_PATH = 'spells.json';
let defaultCharacterId = 'default-character';

const elements = {
  currentCountValue: document.getElementById('currentCountValue'),
  pendingCountValue: document.getElementById('pendingCountValue'),
  previewCountValue: document.getElementById('previewCountValue'),
  addSpellSelect: document.getElementById('addSpellSelect'),
  removeSpellSelect: document.getElementById('removeSpellSelect'),
  replaceFromSelect: document.getElementById('replaceFromSelect'),
  replaceToSelect: document.getElementById('replaceToSelect'),
  addSpellButton: document.getElementById('addSpellButton'),
  removeSpellButton: document.getElementById('removeSpellButton'),
  replaceSpellButton: document.getElementById('replaceSpellButton'),
  currentActiveList: document.getElementById('currentActiveList'),
  pendingAddedList: document.getElementById('pendingAddedList'),
  pendingRemovedList: document.getElementById('pendingRemovedList'),
  pendingReplacedList: document.getElementById('pendingReplacedList'),
  previewList: document.getElementById('previewList'),
  previewAddedList: document.getElementById('previewAddedList'),
  previewRemovedList: document.getElementById('previewRemovedList'),
  previewReplacedList: document.getElementById('previewReplacedList'),
  applyPlanButton: document.getElementById('applyPlanButton'),
  clearPendingButton: document.getElementById('clearPendingButton'),
  prepareStatusMessage: document.getElementById('prepareStatusMessage'),
  currentSortSelect: document.getElementById('currentSortSelect'),
  previewSortSelect: document.getElementById('previewSortSelect'),
  spellSidebar: document.getElementById('spellSidebar'),
  spellSidebarBackdrop: document.getElementById('spellSidebarBackdrop'),
  closeSpellSidebarButton: document.getElementById('closeSpellSidebarButton'),
  spellDetailName: document.getElementById('spellDetailName'),
  spellDetailLevel: document.getElementById('spellDetailLevel'),
  spellDetailSource: document.getElementById('spellDetailSource'),
  spellDetailTags: document.getElementById('spellDetailTags'),
  spellDetailDuration: document.getElementById('spellDetailDuration'),
  spellDetailComponents: document.getElementById('spellDetailComponents'),
  spellDetailSpellList: document.getElementById('spellDetailSpellList'),
  spellDetailSchool: document.getElementById('spellDetailSchool'),
  spellDetailRange: document.getElementById('spellDetailRange'),
  spellDetailCastingTime: document.getElementById('spellDetailCastingTime'),
  spellDetailSave: document.getElementById('spellDetailSave'),
  spellDetailDamage: document.getElementById('spellDetailDamage'),
  spellDetailPrepared: document.getElementById('spellDetailPrepared'),
  spellDetailDescription: document.getElementById('spellDetailDescription'),
  spellDetailNotes: document.getElementById('spellDetailNotes'),
  spellDetailPreparation: document.getElementById('spellDetailPreparation'),
  spellDetailCombos: document.getElementById('spellDetailCombos'),
  spellDetailItems: document.getElementById('spellDetailItems'),
  catalogNavLink: document.getElementById('catalogNavLink'),
  characterIdInput: document.getElementById('characterIdInput'),
  switchCharacterButton: document.getElementById('switchCharacterButton'),
  accountSessionSummary: document.getElementById('accountSessionSummary'),
};

let spells = [];
let pendingChanges = [];
let isApplying = false;
let activeSpellSidebarId = null;

let remotePendingPlanEnabled = false;
let pendingPlanVersion = 1;
let currentCharacterId = 'default-character';
let authenticated = false;
let currentUserId = null;
let currentDisplayName = null;
let remoteActivePreparedSet = new Set();
let localActivePreparedSet = new Set();
let staticDataMode = false;

function normalizeIdentity(value, fallback) {
  const next = String(value || '').trim();
  if (!next) return fallback;
  return /^[A-Za-z0-9_.-]{2,64}$/.test(next) ? next : fallback;
}

function getPendingPlanStorageKey() {
  const userKey = currentUserId || 'anonymous';
  return `${PENDING_PLAN_KEY_PREFIX}.${userKey}.${currentCharacterId}`;
}

function getLocalPreparedStorageKey() {
  const userKey = currentUserId || 'anonymous';
  return `${LOCAL_PREPARED_KEY_PREFIX}.${userKey}.${currentCharacterId}`;
}

function withCharacterApiPath(pathname) {
  const url = new URL(pathname, window.location.origin);
  if (currentCharacterId) {
    url.searchParams.set('characterId', currentCharacterId);
  }
  return `${url.pathname}${url.search}`;
}

function updateCatalogLink() {
  if (!elements.catalogNavLink) return;
  elements.catalogNavLink.href = `./index.html?characterId=${encodeURIComponent(currentCharacterId)}`;
}

function updateSessionSummary() {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setStatus(message, isError = false) {
  elements.prepareStatusMessage.textContent = message;
  elements.prepareStatusMessage.classList.toggle('error', isError);
}

function spellDisplay(spell) {
  if (!spell) return 'Unknown spell';
  return `${spell.name} (Lvl ${spell.level})`;
}

function sourceDisplay(spell) {
  return Array.isArray(spell?.source) && spell.source.length > 0 ? spell.source.join(', ') : 'Unknown source';
}

function findSpellById(spellId) {
  return spells.find((spell) => spell.id === spellId) || null;
}

function getKnownSpellIds() {
  return new Set(spells.map((spell) => spell.id));
}

function applyRemotePreparedState() {
  if (!remotePendingPlanEnabled) return;

  for (const spell of spells) {
    spell.prepared = remoteActivePreparedSet.has(spell.id);
  }
}

function applyLocalPreparedState() {
  if (remotePendingPlanEnabled) return;

  localActivePreparedSet = loadLocalPreparedSpellIds(spells.filter((spell) => spell.prepared).map((spell) => spell.id));
  for (const spell of spells) {
    spell.prepared = localActivePreparedSet.has(spell.id);
  }
}

function getActiveSpellIds() {
  if (remotePendingPlanEnabled) {
    return [...remoteActivePreparedSet];
  }

  return [...localActivePreparedSet];
}

function sanitizePendingChange(change) {
  if (!change || typeof change !== 'object' || Array.isArray(change)) return null;
  if (!['add', 'remove', 'replace'].includes(change.type)) return null;
  if (typeof change.spellId !== 'string' || !change.spellId) return null;

  if (change.type === 'replace') {
    if (typeof change.replacementSpellId !== 'string' || !change.replacementSpellId) return null;
    return {
      type: 'replace',
      spellId: change.spellId,
      replacementSpellId: change.replacementSpellId,
    };
  }

  return {
    type: change.type,
    spellId: change.spellId,
  };
}

function parsePendingPlanChanges(rawChanges) {
  if (!Array.isArray(rawChanges)) return [];
  return rawChanges.map(sanitizePendingChange).filter(Boolean);
}

function loadPendingPlanFallback() {
  try {
    const raw = localStorage.getItem(getPendingPlanStorageKey());
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return parsePendingPlanChanges(parsed);
  } catch {
    return [];
  }
}

function savePendingPlanFallback() {
  try {
    localStorage.setItem(getPendingPlanStorageKey(), JSON.stringify(pendingChanges));
  } catch {
    // Ignore storage issues.
  }
}

function clearPendingPlanFallback() {
  try {
    localStorage.removeItem(getPendingPlanStorageKey());
  } catch {
    // Ignore storage issues.
  }
}

function loadLocalPreparedSpellIds(defaultSpellIds) {
  try {
    const raw = localStorage.getItem(getLocalPreparedStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((spellId) => typeof spellId === 'string' && spellId));
      }
    }
  } catch {
    // Ignore parse/storage errors and fall back to defaults.
  }

  const seeded = new Set(defaultSpellIds.filter((spellId) => typeof spellId === 'string' && spellId));
  try {
    localStorage.setItem(getLocalPreparedStorageKey(), JSON.stringify([...seeded]));
  } catch {
    // Ignore storage errors.
  }
  return seeded;
}

function saveLocalPreparedSpellIds() {
  try {
    localStorage.setItem(getLocalPreparedStorageKey(), JSON.stringify([...localActivePreparedSet]));
  } catch {
    // Ignore storage errors.
  }
}

function getPlanState(changes = pendingChanges) {
  const knownSpellIds = getKnownSpellIds();
  validatePlan(changes, knownSpellIds);

  const activeSpellIds = getActiveSpellIds();
  const preview = applyPlan(activeSpellIds, changes);

  return {
    knownSpellIds,
    activeSpellIds,
    preview,
    computedPreparedSet: new Set(preview.nextPreparedSpellIds),
  };
}

function setSelectOptions(select, spellOptions, placeholder) {
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (const spell of spellOptions) {
    options.push(`<option value="${escapeHtml(spell.id)}">${escapeHtml(spellDisplay(spell))}</option>`);
  }
  select.innerHTML = options.join('');
}

function getSortSelectForListElement(element) {
  if (element === elements.currentActiveList) return elements.currentSortSelect;
  if (element === elements.previewList) return elements.previewSortSelect;
  return null;
}

function sortSpellIds(spellIds, sortBy = 'name') {
  const sortKey = sortBy === 'level' || sortBy === 'source' ? sortBy : 'name';
  return [...spellIds].sort((leftId, rightId) => {
    const leftSpell = findSpellById(leftId);
    const rightSpell = findSpellById(rightId);
    if (!leftSpell || !rightSpell) return leftId.localeCompare(rightId);

    if (sortKey === 'level' && leftSpell.level !== rightSpell.level) {
      return leftSpell.level - rightSpell.level;
    }

    if (sortKey === 'source') {
      const sourceCompare = sourceDisplay(leftSpell).localeCompare(sourceDisplay(rightSpell));
      if (sourceCompare !== 0) return sourceCompare;
    }

    return leftSpell.name.localeCompare(rightSpell.name);
  });
}

function spellListItemMarkup(spellId) {
  const spell = findSpellById(spellId);
  if (!spell) return `<li>${escapeHtml(spellId)}</li>`;

  return `<li>
    <button type="button" class="spell-item-button" data-spell-id="${escapeHtml(spell.id)}">
      <span>${escapeHtml(spellDisplay(spell))}</span>
      <span class="muted">${escapeHtml(sourceDisplay(spell))}</span>
    </button>
  </li>`;
}

function renderSimpleList(element, spellIds, emptyText) {
  if (spellIds.length === 0) {
    element.innerHTML = `<li class="empty">${escapeHtml(emptyText)}</li>`;
    return;
  }

  const selectedSort = getSortSelectForListElement(element)?.value || 'name';
  const sorted = sortSpellIds(spellIds, selectedSort);

  element.innerHTML = sorted.map((spellId) => spellListItemMarkup(spellId)).join('');
}

function renderPendingTypeList(element, type) {
  const entries = pendingChanges
    .map((change, index) => ({ change, index }))
    .filter((entry) => entry.change.type === type);

  if (entries.length === 0) {
    element.innerHTML = '<li class="empty">No queued changes.</li>';
    return;
  }

  element.innerHTML = entries
    .map(({ change, index }) => {
      if (type === 'replace') {
        const sourceSpell = findSpellById(change.spellId);
        const targetSpell = findSpellById(change.replacementSpellId);
        return `<li>
          <span>
            <button type="button" class="link-button spell-link" data-spell-id="${escapeHtml(change.spellId)}">${escapeHtml(spellDisplay(sourceSpell))}</button>
            <span aria-hidden="true">-></span>
            <button type="button" class="link-button spell-link" data-spell-id="${escapeHtml(change.replacementSpellId)}">${escapeHtml(spellDisplay(targetSpell))}</button>
          </span>
          <button type="button" class="link-button" data-action="remove-pending" data-index="${index}">Remove</button>
        </li>`;
      }

      const spell = findSpellById(change.spellId);
      return `<li>
        <button type="button" class="link-button spell-link" data-spell-id="${escapeHtml(change.spellId)}">${escapeHtml(spellDisplay(spell))}</button>
        <button type="button" class="link-button" data-action="remove-pending" data-index="${index}">Remove</button>
      </li>`;
    })
    .join('');
}

function setDetailText(element, value, fallback) {
  const hasValue = value !== null && value !== undefined && String(value) !== '';
  element.textContent = hasValue ? String(value) : fallback;
}

function openSpellSidebar(spellId) {
  const spell = findSpellById(spellId);
  if (!spell) return;

  activeSpellSidebarId = spell.id;
  setDetailText(elements.spellDetailName, spell.name, 'Unknown spell');
  setDetailText(elements.spellDetailLevel, spell.level, '-');
  setDetailText(elements.spellDetailSource, sourceDisplay(spell), '-');
  setDetailText(elements.spellDetailTags, Array.isArray(spell.tags) && spell.tags.length > 0 ? spell.tags.join(', ') : '', 'None');
  setDetailText(elements.spellDetailDuration, spell.duration, 'None');
  setDetailText(elements.spellDetailComponents, spell.components ?? spell.component, 'None');
  setDetailText(
    elements.spellDetailSpellList,
    Array.isArray(spell.spellList) && spell.spellList.length > 0 ? spell.spellList.join(', ') : '',
    'None',
  );
  setDetailText(elements.spellDetailSchool, spell.school, 'None');
  setDetailText(elements.spellDetailRange, spell.range, 'None');
  setDetailText(elements.spellDetailCastingTime, spell.castingTime, 'None');
  setDetailText(elements.spellDetailSave, spell.save, 'None');
  setDetailText(elements.spellDetailDamage, spell.damage, 'None');
  setDetailText(elements.spellDetailPrepared, spell.prepared ? 'Yes' : 'No', 'No');
  setDetailText(elements.spellDetailDescription, spell.description, 'No description.');
  setDetailText(elements.spellDetailNotes, spell.notes, 'No notes.');
  setDetailText(elements.spellDetailPreparation, spell.preparation, 'No preparation details.');
  setDetailText(elements.spellDetailCombos, spell.combos, 'No combo details.');
  setDetailText(elements.spellDetailItems, spell.items, 'No item notes.');

  elements.spellSidebar.setAttribute('aria-hidden', 'false');
  elements.spellSidebar.classList.add('open');
  elements.spellSidebarBackdrop.hidden = false;
}

function closeSpellSidebar() {
  activeSpellSidebarId = null;
  elements.spellSidebar.setAttribute('aria-hidden', 'true');
  elements.spellSidebar.classList.remove('open');
  elements.spellSidebarBackdrop.hidden = true;
}

function render() {
  let planState;

  try {
    planState = getPlanState();
  } catch (error) {
    setStatus(`Plan validation error: ${error.message}`, true);
    return;
  }

  const currentSet = new Set(planState.activeSpellIds);
  const computedSet = planState.computedPreparedSet;

  const sortedSpells = [...spells].sort((a, b) => a.name.localeCompare(b.name));
  const addOptions = sortedSpells.filter((spell) => !computedSet.has(spell.id));
  const removeOptions = sortedSpells.filter((spell) => computedSet.has(spell.id));

  setSelectOptions(elements.addSpellSelect, addOptions, addOptions.length ? 'Choose spell to add' : 'No available spells');
  setSelectOptions(
    elements.removeSpellSelect,
    removeOptions,
    removeOptions.length ? 'Choose spell to remove' : 'No removable spells',
  );
  setSelectOptions(
    elements.replaceFromSelect,
    removeOptions,
    removeOptions.length ? 'Choose current spell' : 'No replaceable spells',
  );
  setSelectOptions(
    elements.replaceToSelect,
    addOptions,
    addOptions.length ? 'Choose replacement spell' : 'No replacement options',
  );

  renderSimpleList(elements.currentActiveList, [...currentSet], 'No prepared spells.');
  renderPendingTypeList(elements.pendingAddedList, 'add');
  renderPendingTypeList(elements.pendingRemovedList, 'remove');
  renderPendingTypeList(elements.pendingReplacedList, 'replace');

  renderSimpleList(elements.previewList, planState.preview.nextPreparedSpellIds, 'No prepared spells in preview.');
  renderSimpleList(elements.previewAddedList, planState.preview.summary.added, 'No added spells.');
  renderSimpleList(elements.previewRemovedList, planState.preview.summary.removed, 'No removed spells.');

  const previewReplaced = planState.preview.summary.replaced;
  if (previewReplaced.length === 0) {
    elements.previewReplacedList.innerHTML = '<li class="empty">No replaced spells.</li>';
  } else {
    elements.previewReplacedList.innerHTML = previewReplaced
      .map((entry) => {
        const fromSpell = findSpellById(entry.from);
        const toSpell = findSpellById(entry.to);
        return `<li>
          <button type="button" class="link-button spell-link" data-spell-id="${escapeHtml(entry.from)}">${escapeHtml(spellDisplay(fromSpell))}</button>
          <span aria-hidden="true">-></span>
          <button type="button" class="link-button spell-link" data-spell-id="${escapeHtml(entry.to)}">${escapeHtml(spellDisplay(toSpell))}</button>
        </li>`;
      })
      .join('');
  }

  elements.currentCountValue.textContent = String(currentSet.size);
  elements.pendingCountValue.textContent = String(pendingChanges.length);
  elements.previewCountValue.textContent = String(planState.preview.nextPreparedSpellIds.length);

  elements.applyPlanButton.disabled = isApplying;

  if (activeSpellSidebarId && !findSpellById(activeSpellSidebarId)) {
    closeSpellSidebar();
  } else if (activeSpellSidebarId) {
    openSpellSidebar(activeSpellSidebarId);
  }
}

function updateStateFromRemotePayload(payload) {
  const plan = payload?.plan || {};

  pendingPlanVersion = Number.isInteger(plan.version) ? plan.version : 1;
  pendingChanges = parsePendingPlanChanges(plan.changes);

  const activeSpellIds = Array.isArray(payload?.activeSpellIds) ? payload.activeSpellIds : [];
  remoteActivePreparedSet = new Set(activeSpellIds.filter((spellId) => typeof spellId === 'string' && spellId));

  applyRemotePreparedState();
  savePendingPlanFallback();
}

async function fetchConfig() {
  try {
    const response = await fetch('api/config');
    if (!response.ok) return;

    const payload = await response.json();
    remotePendingPlanEnabled = Boolean(payload.remotePendingPlanEnabled);
    defaultCharacterId = normalizeIdentity(payload.defaultCharacterId, defaultCharacterId);
    authenticated = Boolean(payload.authenticated);
    currentUserId = payload.userId ? normalizeIdentity(payload.userId, null) : null;
    currentDisplayName = payload.displayName ? String(payload.displayName) : null;

    const fromQuery = new URLSearchParams(window.location.search).get('characterId');
    const configCharacter = normalizeIdentity(payload.characterId || payload.defaultCharacterId, currentCharacterId);
    currentCharacterId = normalizeIdentity(fromQuery, configCharacter);

    elements.characterIdInput.value = currentCharacterId;
    updateSessionSummary();
    updateCatalogLink();
  } catch {
    // Keep defaults.
  }
}

async function switchCharacter() {
  if (!remotePendingPlanEnabled) {
    currentCharacterId = normalizeIdentity(elements.characterIdInput.value, currentCharacterId);
    updateCatalogLink();
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('characterId', currentCharacterId);
    window.history.replaceState({}, '', nextUrl);
    await loadSpells();
    return;
  }

  if (!authenticated) {
    throw new Error('Sign in first.');
  }

  const characterId = normalizeIdentity(elements.characterIdInput.value, '');
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
  elements.characterIdInput.value = currentCharacterId;
  updateSessionSummary();
  updateCatalogLink();

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('characterId', currentCharacterId);
  window.history.replaceState({}, '', nextUrl);

  pendingChanges = [];
  pendingPlanVersion = 1;
  remoteActivePreparedSet = new Set();
  await loadSpells();
  setStatus(`Switched character to ${currentCharacterId}.`);
}

async function loadRemotePendingPlan() {
  const response = await fetch(`api/characters/${encodeURIComponent(currentCharacterId)}/pending-plan`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  updateStateFromRemotePayload(payload);
}

async function syncRemotePendingPlan(nextChanges, successMessage) {
  const expectedVersion = pendingPlanVersion;

  pendingChanges = nextChanges;
  savePendingPlanFallback();
  render();

  const response = await fetch(`api/characters/${encodeURIComponent(currentCharacterId)}/pending-plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: expectedVersion, changes: nextChanges }),
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 409) {
    await loadRemotePendingPlan();
    render();
    setStatus('Pending plan changed in another session. Reloaded latest draft.', true);
    return;
  }

  if (!response.ok) {
    setStatus(`Unable to sync draft: ${payload.error || `HTTP ${response.status}`}. Changes kept locally.`, true);
    return;
  }

  updateStateFromRemotePayload(payload);
  render();
  setStatus(successMessage);
}

async function persistPendingChanges(nextChanges, successMessage) {
  if (!remotePendingPlanEnabled) {
    pendingChanges = nextChanges;
    savePendingPlanFallback();
    render();
    setStatus(successMessage);
    return;
  }

  try {
    await syncRemotePendingPlan(nextChanges, successMessage);
  } catch (error) {
    setStatus(`Unable to sync draft: ${error.message}. Changes kept locally.`, true);
  }
}

function queueChange(change) {
  let planState;
  try {
    planState = getPlanState();
  } catch (error) {
    setStatus(`Plan validation error: ${error.message}`, true);
    return;
  }

  const computedSet = planState.computedPreparedSet;

  if (change.type === 'add' && computedSet.has(change.spellId)) {
    setStatus('Cannot add a spell that is already active in the preview.', true);
    return;
  }

  if (change.type === 'remove' && !computedSet.has(change.spellId)) {
    setStatus('Cannot remove a spell that is not active in the preview.', true);
    return;
  }

  if (change.type === 'replace') {
    if (!computedSet.has(change.spellId)) {
      setStatus('Replacement source must be active in the preview.', true);
      return;
    }
    if (computedSet.has(change.replacementSpellId)) {
      setStatus('Replacement target must not already be active in the preview.', true);
      return;
    }
    if (change.spellId === change.replacementSpellId) {
      setStatus('Replacement source and target must be different spells.', true);
      return;
    }
  }

  const nextPending = [...pendingChanges, change];

  try {
    validatePlan(nextPending, planState.knownSpellIds);
  } catch (error) {
    setStatus(`Unable to queue change: ${error.message}`, true);
    return;
  }

  void persistPendingChanges(nextPending, 'Pending plan updated.');
}

async function applyPendingPlan() {
  if (isApplying) return;

  let planState;
  try {
    planState = getPlanState();
  } catch (error) {
    setStatus(`Cannot apply plan: ${error.message}`, true);
    return;
  }

  isApplying = true;
  elements.applyPlanButton.disabled = true;

  try {
    if (remotePendingPlanEnabled) {
      const response = await fetch(`api/characters/${encodeURIComponent(currentCharacterId)}/pending-plan/apply`, {
        method: 'POST',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      updateStateFromRemotePayload(payload);
      render();
      setStatus('Plan applied successfully. Pending queue cleared.');
      return;
    }

    const nextSet = new Set(planState.preview.nextPreparedSpellIds);
    localActivePreparedSet = nextSet;
    saveLocalPreparedSpellIds();
    for (const spell of spells) {
      spell.prepared = localActivePreparedSet.has(spell.id);
    }
    pendingChanges = [];
    clearPendingPlanFallback();
    render();
    setStatus(staticDataMode ? 'Plan applied locally in static mode.' : 'Plan applied locally. Pending queue cleared.');
  } catch (error) {
    setStatus(`Unable to apply plan: ${error.message}`, true);
  } finally {
    isApplying = false;
    elements.applyPlanButton.disabled = false;
    render();
  }
}

async function loadSpells() {
  setStatus('Loading spells...');

  try {
    let loadedFromStaticFile = false;
    let loadedSpells = [];

    try {
      const response = await fetch(withCharacterApiPath('api/spells'));
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      loadedSpells = Array.isArray(payload.spells) ? payload.spells : [];
    } catch {
      const staticResponse = await fetch(STATIC_SPELLS_PATH);
      if (!staticResponse.ok) {
        const payload = await staticResponse.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${staticResponse.status}`);
      }

      const payload = await staticResponse.json();
      loadedSpells = Array.isArray(payload.spells) ? payload.spells : [];
      loadedFromStaticFile = true;
    }

    staticDataMode = loadedFromStaticFile;
    spells = loadedSpells;

    if (remotePendingPlanEnabled) {
      await loadRemotePendingPlan();
    } else {
      pendingChanges = loadPendingPlanFallback();
    }

    applyRemotePreparedState();
    applyLocalPreparedState();

    try {
      validatePlan(pendingChanges, getKnownSpellIds());
    } catch {
      pendingChanges = [];
      clearPendingPlanFallback();
      setStatus('Pending plan reset because some spell IDs no longer exist.', true);
    }

    render();
    if (!elements.prepareStatusMessage.classList.contains('error')) {
      const mode = remotePendingPlanEnabled
        ? `Remote draft (${currentUserId || 'anonymous'}/${currentCharacterId})`
        : staticDataMode
          ? 'Static local draft'
          : 'Local draft';
      setStatus(`Loaded ${spells.length} spells. ${mode}.`);
    }
  } catch (error) {
    if (remotePendingPlanEnabled && !authenticated) {
      spells = [];
      pendingChanges = [];
      remoteActivePreparedSet = new Set();
      render();
      setStatus('Sign in to load and sync prepared spells.', true);
      return;
    }

    if (remotePendingPlanEnabled) {
      pendingChanges = loadPendingPlanFallback();
      render();
      setStatus(`Unable to load remote draft: ${error.message}. Loaded local fallback only.`, true);
      return;
    }

    setStatus(`Unable to load spells: ${error.message}`, true);
  }
}

elements.addSpellButton.addEventListener('click', () => {
  const spellId = elements.addSpellSelect.value;
  if (!spellId) {
    setStatus('Choose a spell to add.', true);
    return;
  }

  queueChange({ type: 'add', spellId });
});

elements.removeSpellButton.addEventListener('click', () => {
  const spellId = elements.removeSpellSelect.value;
  if (!spellId) {
    setStatus('Choose a spell to remove.', true);
    return;
  }

  queueChange({ type: 'remove', spellId });
});

elements.replaceSpellButton.addEventListener('click', () => {
  const spellId = elements.replaceFromSelect.value;
  const replacementSpellId = elements.replaceToSelect.value;

  if (!spellId || !replacementSpellId) {
    setStatus('Choose both source and replacement spells.', true);
    return;
  }

  queueChange({ type: 'replace', spellId, replacementSpellId });
});

elements.currentSortSelect.addEventListener('change', () => {
  render();
});

elements.previewSortSelect.addEventListener('change', () => {
  render();
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const spellTarget = target.closest('[data-spell-id]');
  if (spellTarget instanceof HTMLElement) {
    const spellId = spellTarget.dataset.spellId;
    if (spellId) {
      openSpellSidebar(spellId);
      return;
    }
  }

  if (target.dataset.action !== 'remove-pending') return;

  const index = Number.parseInt(String(target.dataset.index || ''), 10);
  if (!Number.isInteger(index) || index < 0 || index >= pendingChanges.length) return;

  const nextPending = pendingChanges.filter((_, entryIndex) => entryIndex !== index);
  void persistPendingChanges(nextPending, 'Queued change removed.');
});

elements.closeSpellSidebarButton.addEventListener('click', () => {
  closeSpellSidebar();
});

elements.spellSidebarBackdrop.addEventListener('click', () => {
  closeSpellSidebar();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.spellSidebar.classList.contains('open')) {
    closeSpellSidebar();
  }
});

elements.clearPendingButton.addEventListener('click', () => {
  if (remotePendingPlanEnabled) {
    const expectedVersion = pendingPlanVersion;
    pendingChanges = [];
    render();

    void fetch(`api/characters/${encodeURIComponent(currentCharacterId)}/pending-plan`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: expectedVersion }),
    })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(async ({ response, payload }) => {
        if (response.status === 409) {
          await loadRemotePendingPlan();
          render();
          setStatus('Pending plan changed in another session. Reloaded latest draft.', true);
          return;
        }

        if (!response.ok) {
          setStatus(`Unable to clear remote draft: ${payload.error || `HTTP ${response.status}`}.`, true);
          return;
        }

        updateStateFromRemotePayload(payload);
        render();
        setStatus('Pending plan cleared.');
      })
      .catch((error) => {
        setStatus(`Unable to clear remote draft: ${error.message}.`, true);
      });

    return;
  }

  pendingChanges = [];
  clearPendingPlanFallback();
  render();
  setStatus('Pending plan cleared.');
});

elements.applyPlanButton.addEventListener('click', () => {
  void applyPendingPlan();
});

elements.switchCharacterButton.addEventListener('click', () => {
  void switchCharacter().catch((error) => setStatus(`Unable to switch character: ${error.message}`, true));
});

await fetchConfig();
void loadSpells();
