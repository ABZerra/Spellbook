const activeSpellsEl = document.querySelector('#activeSpells');
const changesEl = document.querySelector('#changes');
const nextSpellsEl = document.querySelector('#nextSpells');
const summaryEl = document.querySelector('#summary');
const statusEl = document.querySelector('#status');

const changeTypeEl = document.querySelector('#changeType');
const spellIdEl = document.querySelector('#spellId');
const replacementGroupEl = document.querySelector('#replacementGroup');
const replacementSpellIdEl = document.querySelector('#replacementSpellId');
const changeFormEl = document.querySelector('#changeForm');
const previewBtnEl = document.querySelector('#previewBtn');

/** @type {{ id: string, name: string }[]} */
let spells = [];
/** @type {string[]} */
let activeSpellIds = [];
/** @type {{ type: 'add'|'remove'|'replace', spellId: string, replacementSpellId?: string }[]} */
let changes = [];

function spellName(id) {
  return spells.find((spell) => spell.id === id)?.name ?? id;
}

function renderSpellSelect() {
  const options = spells
    .map((spell) => `<option value="${spell.id}">${spell.name}</option>`)
    .join('');
  spellIdEl.innerHTML = options;
  replacementSpellIdEl.innerHTML = options;
}

function renderActive() {
  activeSpellsEl.innerHTML = activeSpellIds.map((id) => `<li>${spellName(id)}</li>`).join('');
}

function renderChanges() {
  if (changes.length === 0) {
    changesEl.innerHTML = '<li>No planned changes.</li>';
    return;
  }

  changesEl.innerHTML = changes
    .map((change, index) => {
      if (change.type === 'replace') {
        return `<li>#${index + 1} Replace <strong>${spellName(change.spellId)}</strong> with <strong>${spellName(change.replacementSpellId)}</strong></li>`;
      }
      return `<li>#${index + 1} ${change.type} <strong>${spellName(change.spellId)}</strong></li>`;
    })
    .join('');
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

changeTypeEl.addEventListener('change', () => {
  replacementGroupEl.classList.toggle('hidden', changeTypeEl.value !== 'replace');
});

changeFormEl.addEventListener('submit', (event) => {
  event.preventDefault();

  const type = changeTypeEl.value;
  const spellId = spellIdEl.value;

  const change = { type, spellId };
  if (type === 'replace') {
    change.replacementSpellId = replacementSpellIdEl.value;
  }

  changes.push(change);
  renderChanges();
  setStatus('Change queued. Click preview to validate and simulate.');
});

previewBtnEl.addEventListener('click', async () => {
  setStatus('Building preview...');

  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSpellIds, changes }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to preview plan');
    }

    nextSpellsEl.innerHTML = data.nextPreparedSpellIds.map((id) => `<li>${spellName(id)}</li>`).join('');
    summaryEl.textContent = JSON.stringify(data.summary, null, 2);
    setStatus('Preview ready.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

async function bootstrap() {
  setStatus('Loading spellbook...');

  const response = await fetch('/api/bootstrap');
  const data = await response.json();

  spells = data.spells;
  activeSpellIds = data.activeSpellIds;

  renderSpellSelect();
  renderActive();
  renderChanges();
  setStatus('Ready to plan.');
}

bootstrap().catch((error) => {
  setStatus(error.message, true);
});
