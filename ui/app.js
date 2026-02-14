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
};

let allSpells = [];

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

function buildLevelOptions(spells) {
  const levels = [...new Set(spells.map((spell) => spell.level))].sort((a, b) => a - b);
  for (const level of levels) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = level === 0 ? 'Cantrip (0)' : `Level ${level}`;
    elements.levelFilter.append(option);
  }
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
    .map((spell) => {
      const sources = (spell.source || []).join(', ');
      const tags = (spell.tags || []).join(', ') || '—';
      const preparedLabel = spell.prepared
        ? '<span class="pill prepared">Prepared</span>'
        : '<span class="pill">Not Prepared</span>';

      return `
        <tr>
          <td>${escapeHtml(spell.name)}</td>
          <td>${spell.level}</td>
          <td>${preparedLabel}</td>
          <td>${escapeHtml(sources)}</td>
          <td>${escapeHtml(tags)}</td>
        </tr>
      `;
    })
    .join('');

  elements.tableBody.innerHTML = rows;
}

function runFilters() {
  const filters = getFilters();
  const filtered = allSpells.filter((spell) => matchesFilters(spell, filters));
  renderSpells(filtered);
  setStatus(`Showing ${filtered.length} of ${allSpells.length} spells.`);
}

function resetFilters() {
  elements.nameFilter.value = '';
  elements.levelFilter.value = '';
  elements.sourceFilter.value = '';
  elements.tagsFilter.value = '';
  runFilters();
}

async function loadSpells() {
  try {
    setStatus('Loading spells...');
    const response = await fetch('/api/spells');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    allSpells = payload.spells || [];
    buildLevelOptions(allSpells);
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

elements.clearFilters.addEventListener('click', resetFilters);
loadSpells();
