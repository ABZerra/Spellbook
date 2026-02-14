import { applyPlan, validatePlan } from '/domain/planner.js';

const PENDING_PLAN_KEY = 'spellbook.pendingPlan.v1';

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
};

let spells = [];
let pendingChanges = [];
let isApplying = false;

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

function findSpellById(spellId) {
  return spells.find((spell) => spell.id === spellId) || null;
}

function getKnownSpellIds() {
  return new Set(spells.map((spell) => spell.id));
}

function getActiveSpellIds() {
  return spells.filter((spell) => spell.prepared).map((spell) => spell.id);
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

function loadPendingPlan() {
  try {
    const raw = localStorage.getItem(PENDING_PLAN_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(sanitizePendingChange).filter(Boolean);
  } catch {
    return [];
  }
}

function savePendingPlan() {
  try {
    localStorage.setItem(PENDING_PLAN_KEY, JSON.stringify(pendingChanges));
  } catch {
    // Ignore storage issues; session state still works.
  }
}

function clearPendingPlan() {
  pendingChanges = [];
  try {
    localStorage.removeItem(PENDING_PLAN_KEY);
  } catch {
    // Ignore storage issues.
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

function renderSimpleList(element, spellIds, emptyText) {
  if (spellIds.length === 0) {
    element.innerHTML = `<li class="empty">${escapeHtml(emptyText)}</li>`;
    return;
  }

  const sorted = [...spellIds].sort((a, b) => {
    const left = findSpellById(a)?.name || a;
    const right = findSpellById(b)?.name || b;
    return left.localeCompare(right);
  });

  element.innerHTML = sorted
    .map((spellId) => `<li>${escapeHtml(spellDisplay(findSpellById(spellId)))}</li>`)
    .join('');
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
        return `<li>
          <span>${escapeHtml(spellDisplay(findSpellById(change.spellId)))} -> ${escapeHtml(spellDisplay(findSpellById(change.replacementSpellId)))}</span>
          <button type="button" class="link-button" data-action="remove-pending" data-index="${index}">Remove</button>
        </li>`;
      }

      return `<li>
        <span>${escapeHtml(spellDisplay(findSpellById(change.spellId)))}</span>
        <button type="button" class="link-button" data-action="remove-pending" data-index="${index}">Remove</button>
      </li>`;
    })
    .join('');
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
      .map(
        (entry) =>
          `<li>${escapeHtml(spellDisplay(findSpellById(entry.from)))} -> ${escapeHtml(spellDisplay(findSpellById(entry.to)))}</li>`,
      )
      .join('');
  }

  elements.currentCountValue.textContent = String(currentSet.size);
  elements.pendingCountValue.textContent = String(pendingChanges.length);
  elements.previewCountValue.textContent = String(planState.preview.nextPreparedSpellIds.length);

  elements.applyPlanButton.disabled = isApplying;
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

  pendingChanges = nextPending;
  savePendingPlan();
  render();
  setStatus('Pending plan updated.');
}

async function patchPrepared(spellId, prepared) {
  const response = await fetch(`/api/spells/${encodeURIComponent(spellId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prepared }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
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

  const currentSet = new Set(planState.activeSpellIds);
  const nextSet = new Set(planState.preview.nextPreparedSpellIds);

  const toPrepare = [...nextSet].filter((spellId) => !currentSet.has(spellId));
  const toUnprepare = [...currentSet].filter((spellId) => !nextSet.has(spellId));

  const patches = [
    ...toPrepare.map((spellId) => ({ spellId, prepared: true })),
    ...toUnprepare.map((spellId) => ({ spellId, prepared: false })),
  ];

  isApplying = true;
  elements.applyPlanButton.disabled = true;

  try {
    const failedSpellIds = [];

    for (const patch of patches) {
      try {
        await patchPrepared(patch.spellId, patch.prepared);
      } catch {
        failedSpellIds.push(patch.spellId);
      }
    }

    if (failedSpellIds.length > 0) {
      setStatus(`Apply failed for ${failedSpellIds.length} spell(s): ${failedSpellIds.join(', ')}`, true);
      return;
    }

    clearPendingPlan();
    await loadSpells();
    setStatus('Plan applied successfully. Pending queue cleared.');
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
    const response = await fetch('/api/spells');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    spells = Array.isArray(payload.spells) ? payload.spells : [];

    try {
      validatePlan(pendingChanges, getKnownSpellIds());
    } catch {
      clearPendingPlan();
      setStatus('Pending plan reset because some spell IDs no longer exist.', true);
    }

    render();
  } catch (error) {
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

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.action !== 'remove-pending') return;

  const index = Number.parseInt(String(target.dataset.index || ''), 10);
  if (!Number.isInteger(index) || index < 0 || index >= pendingChanges.length) return;

  pendingChanges = pendingChanges.filter((_, entryIndex) => entryIndex !== index);
  savePendingPlan();
  render();
  setStatus('Queued change removed.');
});

elements.clearPendingButton.addEventListener('click', () => {
  clearPendingPlan();
  render();
  setStatus('Pending plan cleared.');
});

elements.applyPlanButton.addEventListener('click', () => {
  void applyPendingPlan();
});

pendingChanges = loadPendingPlan();
void loadSpells();
