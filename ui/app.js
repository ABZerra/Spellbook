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
};

let allSpells = [];
let editingSpellId = null;
let isSaving = false;
let sortState = { key: 'name', direction: 'asc' };

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

function buildLevelOptions(spells) {
  const levels = [...new Set(spells.map((spell) => spell.level))].sort((a, b) => a - b);
  for (const level of levels) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = level === 0 ? 'Cantrip (0)' : `Level ${level}`;
    elements.levelFilter.append(option);
  }
}

function setDatalistOptions(element, values) {
  element.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
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
          <button type="button" class="link-button" data-action="edit" data-id="${escapeHtml(spell.id)}">Edit</button>
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

function runFilters() {
  const filters = getFilters();
  const filtered = allSpells.filter((spell) => matchesFilters(spell, filters));
  const sorted = sortSpells(filtered);
  renderSpells(sorted);
  updateSortButtons();
  setStatus(`Showing ${sorted.length} of ${allSpells.length} spells.`);
}

function resetFilters() {
  elements.nameFilter.value = '';
  elements.levelFilter.value = '';
  elements.sourceFilter.value = '';
  elements.tagsFilter.value = '';
  runFilters();
}

function setSpellInMemory(updatedSpell) {
  allSpells = allSpells.map((spell) => (spell.id === updatedSpell.id ? updatedSpell : spell));
}

async function patchSpell(spellId, patch) {
  const response = await fetch(`/api/spells/${encodeURIComponent(spellId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 405) {
      throw new Error('Save endpoint is unavailable (405). Restart the local server and retry.');
    }
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload.spell;
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

async function saveRow(spellId) {
  if (isSaving) return;
  isSaving = true;

  try {
    const patch = getEditingPatch(spellId);
    const updatedSpell = await patchSpell(spellId, patch);
    setSpellInMemory(updatedSpell);
    buildAutocompleteOptions(allSpells);
    editingSpellId = null;
    setStatus(`Saved changes for ${updatedSpell.name}.`);
    runFilters();
  } catch (error) {
    setStatus(`Unable to save spell: ${error.message}`, true);
  } finally {
    isSaving = false;
  }
}

async function togglePrepared(spellId) {
  if (isSaving) return;
  const spell = allSpells.find((entry) => entry.id === spellId);
  if (!spell) return;

  isSaving = true;
  try {
    const updatedSpell = await patchSpell(spellId, { prepared: !spell.prepared });
    setSpellInMemory(updatedSpell);
    setStatus(`${updatedSpell.name} is now ${updatedSpell.prepared ? 'Prepared' : 'Not Prepared'}.`);
    runFilters();
  } catch (error) {
    setStatus(`Unable to update prepared status: ${error.message}`, true);
  } finally {
    isSaving = false;
  }
}

async function loadSpells() {
  try {
    setStatus('Loading spells...');
    const response = await fetch('/api/spells');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    allSpells = payload.spells || [];
    buildLevelOptions(allSpells);
    buildAutocompleteOptions(allSpells);
    runFilters();
  } catch (error) {
    setStatus(`Unable to load spells: ${error.message}`, true);
    elements.tableBody.innerHTML = '';
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
    runFilters();
    return;
  }

  if (action === 'cancel') {
    editingSpellId = null;
    setStatus('Edit canceled.');
    runFilters();
    return;
  }

  if (action === 'save') {
    void saveRow(spellId);
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
    runFilters();
  }
});

elements.clearFilters.addEventListener('click', resetFilters);
loadSpells();
