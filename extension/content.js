const SYNC_PAYLOAD_STORAGE_KEY = 'spellbook.syncPayload.v1';
const INCOMING_PAYLOAD_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_SET';
const OUTGOING_PAYLOAD_ACK_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_ACK';
const MAX_ACTIONS = 200;
const MAX_LOOKUP_RETRIES = 3;
const IS_TOP_WINDOW = window === window.top;

let operationInFlight = false;
let bridgeInjected = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function normalizeSpellName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePreparedSpells(values) {
  const unique = new Set();
  const normalized = [];
  for (const value of values) {
    const name = String(value || '').trim();
    if (!name) continue;
    const key = normalizeSpellName(name);
    if (!key || unique.has(key)) continue;
    unique.add(key);
    normalized.push(name);
  }
  return normalized;
}

function validatePayload(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Payload must be an object.' };
  }

  if (input.version !== 1) {
    return { ok: false, error: 'Payload version must be 1.' };
  }

  if (input.source !== 'spellbook') {
    return { ok: false, error: 'Payload source must be spellbook.' };
  }

  if (!Array.isArray(input.preparedSpells)) {
    return { ok: false, error: 'preparedSpells must be an array.' };
  }

  const preparedSpells = normalizePreparedSpells(input.preparedSpells);
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { ok: false, error: 'timestamp must be a positive number.' };
  }

  const payload = {
    version: 1,
    preparedSpells,
    timestamp,
    source: 'spellbook',
  };

  if (input.characterId !== undefined && input.characterId !== null) {
    payload.characterId = String(input.characterId);
  }

  return { ok: true, payload };
}

function sendPageAck(ok, error) {
  window.postMessage(
    {
      type: OUTGOING_PAYLOAD_ACK_TYPE,
      ok,
      error: error || undefined,
      timestamp: Date.now(),
    },
    window.location.origin,
  );
}

function injectPageBridge() {
  if (bridgeInjected) return;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('page-bridge.js');
  script.dataset.spellbookBridge = 'true';
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
  bridgeInjected = true;
}

async function storePayload(payload) {
  await chrome.storage.local.set({ [SYNC_PAYLOAD_STORAGE_KEY]: payload });
}

function getTextContent(node) {
  return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function getNormalizedText(node) {
  return getTextContent(node).toLowerCase();
}

function countSpellActionButtons(root) {
  if (!(root instanceof Element)) return 0;
  return Array.from(root.querySelectorAll('button')).filter((button) => {
    const text = getNormalizedText(button);
    return text.includes('prepare') || text.includes('unprepare');
  }).length;
}

function getManageSpellsRoot() {
  const allFilter = document.querySelector('button[data-testid="tab-filter-all"]');
  if (allFilter instanceof HTMLElement) {
    let node = allFilter.parentElement;
    let best = null;
    while (node && node !== document.body) {
      const actionCount = countSpellActionButtons(node);
      if (actionCount > 0) {
        best = node;
      }
      if (actionCount >= 8) {
        return node;
      }
      node = node.parentElement;
    }
    if (best) return best;
    return document.body;
  }

  const manageSpellsNode = Array.from(document.querySelectorAll('button, span, h2, h3')).find((node) =>
    getNormalizedText(node).includes('manage spells'),
  );
  if (manageSpellsNode instanceof HTMLElement) {
    let node = manageSpellsNode.parentElement;
    let best = null;
    while (node && node !== document.body) {
      const actionCount = countSpellActionButtons(node);
      if (actionCount > 0) {
        best = node;
      }
      if (actionCount >= 8) {
        return node;
      }
      node = node.parentElement;
    }
    if (best) return best;
  }

  return document.body;
}

function is2014CoreRulesVisible() {
  const root = getManageSpellsRoot();
  if (getNormalizedText(root).includes('2014 core rules')) return true;
  return Array.from(document.querySelectorAll('button, [role="button"], [role="option"], label, span')).some((node) =>
    getNormalizedText(node).includes('2014 core rules'),
  );
}

function findGlobal2014CoreRulesControl() {
  const controls = Array.from(document.querySelectorAll('button, [role="button"], [role="option"], label, span, div, li'));
  for (const node of controls) {
    const text = getNormalizedText(node);
    if (!text) continue;
    if (
      text === '2014 core rules' ||
      text.includes('2014 core rules') ||
      (text.includes('2014') && text.includes('core rules'))
    ) {
      const clickable = asClickableElement(node);
      if (clickable) return clickable;
    }
  }
  return null;
}

function findButtonByExactText(text, root = document) {
  const target = String(text || '').trim().toLowerCase();
  if (!target) return null;
  const buttons = Array.from(root.querySelectorAll('button'));
  for (const button of buttons) {
    if (getNormalizedText(button) === target) {
      return button;
    }
  }
  return null;
}

function findGlobalControlByKeyword(keyword) {
  const needle = String(keyword || '').toLowerCase().trim();
  if (!needle) return null;
  const controls = Array.from(document.querySelectorAll('button, [role="button"], [role="option"], label, span, div, li'));
  for (const node of controls) {
    const text = getNormalizedText(node);
    const title = String(node.getAttribute?.('title') || '').toLowerCase();
    const ariaLabel = String(node.getAttribute?.('aria-label') || '').toLowerCase();
    const testId = String(node.getAttribute?.('data-testid') || '').toLowerCase();
    const combined = `${text} ${title} ${ariaLabel} ${testId}`;
    if (!combined.includes(needle)) continue;
    const clickable = asClickableElement(node);
    if (clickable) return clickable;
  }
  return null;
}

function findAllGlobalControlsByKeyword(keyword) {
  const needle = String(keyword || '').toLowerCase().trim();
  if (!needle) return [];

  const controls = Array.from(document.querySelectorAll('button, [role="button"], [role="option"], label, span, div, li'));
  const results = [];
  const seen = new Set();

  for (const node of controls) {
    const text = getNormalizedText(node);
    const title = String(node.getAttribute?.('title') || '').toLowerCase();
    const ariaLabel = String(node.getAttribute?.('aria-label') || '').toLowerCase();
    const testId = String(node.getAttribute?.('data-testid') || '').toLowerCase();
    const combined = `${text} ${title} ${ariaLabel} ${testId}`;
    if (!combined.includes(needle)) continue;

    const clickable =
      asClickableElement(node) ||
      asClickableElement(node.parentElement) ||
      asClickableElement(node.closest('li, div, section, article'));
    if (!(clickable instanceof HTMLElement)) continue;

    const key = `${clickable.tagName}:${clickable.className}:${clickable.getAttribute('aria-label') || ''}:${getNormalizedText(clickable)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(clickable);
  }

  return results;
}

async function openControlsByKeyword(keyword, progressLabel, emitProgress) {
  const controls = findAllGlobalControlsByKeyword(keyword);
  let opened = 0;

  for (const control of controls) {
    control.scrollIntoView({ block: 'center' });
    control.click();
    opened += 1;
    await wait(180);

    if (getNormalizedText(control).includes('game rules') || getNormalizedText(control).includes('sourcebooks')) {
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await wait(120);
    }
  }

  if (emitProgress) {
    await chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      progress: {
        label: opened
          ? `${progressLabel} (${opened})`
          : `${progressLabel} (none found)`,
      },
    });
  }
}

function collectRuleDiagnostics() {
  const controls = Array.from(document.querySelectorAll('button, [role="button"], [role="option"], label, span'));
  const interesting = controls
    .map((node) => {
      const text = getNormalizedText(node);
      const title = String(node.getAttribute?.('title') || '').toLowerCase();
      const ariaLabel = String(node.getAttribute?.('aria-label') || '').toLowerCase();
      const testId = String(node.getAttribute?.('data-testid') || '').toLowerCase();
      return { text, title, ariaLabel, testId };
    })
    .filter((entry) =>
      entry.text.includes('rule') ||
      entry.text.includes('source') ||
      entry.text.includes('filter') ||
      entry.text.includes('2014') ||
      entry.text.includes('2024') ||
      entry.title.includes('rule') ||
      entry.ariaLabel.includes('rule') ||
      entry.testId.includes('rule'),
    )
    .slice(0, 12)
    .map((entry) => entry.text || entry.title || entry.ariaLabel || entry.testId);

  return interesting;
}

function parseActionFromLabel(label) {
  if (/\bunprepare\b/i.test(label)) return 'unprepare';
  if (/\bprepare\b/i.test(label)) return 'prepare';
  return null;
}

function findSpellNameInContainer(container) {
  const selectorCandidates = [
    '[data-testid*="spell-name"]',
    'span[class*="spellName"]',
    'a[href*="/spells/"]',
    'h3',
    'h4',
    'strong',
  ];

  for (const selector of selectorCandidates) {
    const elements = Array.from(container.querySelectorAll(selector));
    for (const element of elements) {
      const text = getTextContent(element);
      if (!text) continue;
      if (/^(prepare|unprepare|prepared)$/i.test(text)) continue;
      return text;
    }
  }

  const lines = String(container.innerText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^(prepare|unprepare|prepared|manage spells|all)$/i.test(line)) continue;
    if (/^\d+(st|nd|rd|th)$/i.test(line)) continue;
    if (line.length < 2) continue;
    return line;
  }

  return null;
}

function findRowContainerFromButton(button) {
  let node = button;
  for (let i = 0; i < 10; i += 1) {
    if (!node || !(node instanceof Element)) break;
    const maybeName = findSpellNameInContainer(node);
    if (maybeName) return node;
    node = node.parentElement;
  }
  return button.parentElement || button;
}

function findRowContainerFromSpellNode(node) {
  let current = node;
  for (let i = 0; i < 10; i += 1) {
    if (!current || !(current instanceof Element)) break;
    const actionButtons = Array.from(current.querySelectorAll('button')).filter((button) => {
      const text = getNormalizedText(button);
      return text.includes('prepare') || text.includes('unprepare');
    });
    if (actionButtons.length > 0) {
      return current;
    }
    current = current.parentElement;
  }
  return node.parentElement || node;
}

function findActionButtonInRow(row, desiredPrepared) {
  if (!(row instanceof Element)) return null;
  const buttons = Array.from(row.querySelectorAll('button'));
  if (!buttons.length) return null;

  const unprepareButton = buttons.find((button) => getNormalizedText(button).includes('unprepare')) || null;
  const prepareButton = buttons.find((button) => getNormalizedText(button).includes('prepare')) || null;

  if (desiredPrepared === true) return unprepareButton;
  if (desiredPrepared === false) return prepareButton;
  return unprepareButton || prepareButton;
}

function isVisible(node) {
  if (!(node instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findEntryBySpellNameKey(key, desiredPrepared) {
  const roots = [getManageSpellsRoot(), document.body];
  const seenRows = new Set();
  const candidates = [];

  for (const root of roots) {
    const nodes = Array.from(root.querySelectorAll('span, a, h3, h4, strong, div'));
    for (const node of nodes) {
      const text = getTextContent(node);
      if (!text) continue;
      if (normalizeSpellName(text) !== key) continue;

      const row = findRowContainerFromSpellNode(node);
      if (!(row instanceof Element)) continue;
      if (seenRows.has(row)) continue;
      seenRows.add(row);

      const button = findActionButtonInRow(row, desiredPrepared);
      if (!button) continue;

      candidates.push({
        key,
        name: text,
        row,
        button,
        prepared: getNormalizedText(button).includes('unprepare'),
      });
    }
  }

  if (!candidates.length) return null;

  const visible = candidates.filter((entry) => isVisible(entry.button) || isVisible(entry.row));
  const pool = visible.length ? visible : candidates;
  const legacy = pool.filter((entry) => isLegacyEntry(entry));
  return (legacy[0] || pool[0]) ?? null;
}

function buildSpellActionIndex() {
  const root = getManageSpellsRoot();
  const map = new Map();
  const buttons = Array.from(root.querySelectorAll('button'));

  for (const button of buttons) {
    const label = getTextContent(button);
    const action = parseActionFromLabel(label);
    if (!action) continue;

    const row = findRowContainerFromButton(button);
    const spellName = findSpellNameInContainer(row);
    if (!spellName) continue;

    const key = normalizeSpellName(spellName);
    if (!key) continue;

    const entry = {
      key,
      name: spellName,
      button,
      row,
      prepared: action === 'unprepare',
    };

    const bucket = map.get(key) || [];
    bucket.push(entry);
    map.set(key, bucket);
  }

  return map;
}

function isLegacyEntry(entry) {
  const rowText = getTextContent(entry?.row);
  return /\blegacy\b/i.test(rowText);
}

function selectPreferredEntry(entries, desiredPrepared) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  const byPrepared = typeof desiredPrepared === 'boolean'
    ? entries.filter((entry) => Boolean(entry.prepared) === desiredPrepared)
    : entries;

  const pool = byPrepared.length ? byPrepared : entries;
  const legacyMatches = pool.filter((entry) => isLegacyEntry(entry));
  if (legacyMatches.length > 0) {
    return legacyMatches[0];
  }
  return pool[0];
}

async function withRetries(factory, label, retries = MAX_LOOKUP_RETRIES) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const value = await factory(attempt);
      if (value) return value;
      lastError = new Error(`${label} not found`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      await wait(150 * attempt);
    }
  }

  throw lastError || new Error(`${label} failed`);
}

function asClickableElement(node) {
  if (!node || !(node instanceof Element)) return null;
  const clickable = node.closest('button, [role="button"], [role="option"], [role="menuitemradio"], [role="menuitem"]');
  return clickable instanceof HTMLElement ? clickable : node instanceof HTMLElement ? node : null;
}

function findControlByText(textMatcher) {
  const controls = Array.from(
    getManageSpellsRoot().querySelectorAll(
      'button, [role="button"], [role="option"], [role="menuitemradio"], [role="menuitem"], label, span',
    ),
  );
  for (const control of controls) {
    const text = getNormalizedText(control);
    if (!text) continue;
    if (!textMatcher(text)) continue;
    const clickable = asClickableElement(control);
    if (clickable) return clickable;
  }
  return null;
}

function queryByText(text) {
  const target = text.trim().toLowerCase();
  const nodes = Array.from(document.querySelectorAll('button, span'));
  for (const node of nodes) {
    const value = getTextContent(node).toLowerCase();
    if (value !== target) continue;
    if (node instanceof HTMLButtonElement) return node;
    const parentButton = node.closest('button');
    if (parentButton) return parentButton;
  }
  return null;
}

async function clickElement(element, progressLabel, emitProgress = true) {
  if (!element) throw new Error(`Missing element for ${progressLabel}`);
  element.scrollIntoView({ block: 'center' });
  element.click();
  if (emitProgress) {
    await chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      progress: { label: progressLabel },
    });
  }
  await wait(randomDelay(100, 250));
}

async function ensure2014CoreRulesFilter({ emitProgress = true, required = true } = {}) {
  const root = getManageSpellsRoot();
  const click2014 = async () => {
    const button =
      findButtonByExactText('2014 Core Rules', root) ||
      findButtonByExactText('2014 Core Rules', document);
    if (!button) return false;
    await clickElement(button, 'Applied 2014 Core Rules filter', emitProgress);
    return true;
  };

  if (await click2014()) {
    return true;
  }

  const knownToggles = Array.from(root.querySelectorAll('button, [role="button"]')).filter((node) =>
    getNormalizedText(node).startsWith('known spells'),
  );
  for (const toggle of knownToggles) {
    if (!(toggle instanceof HTMLElement)) continue;
    if (!isCollapsedControl(toggle)) continue;
    toggle.scrollIntoView({ block: 'center' });
    toggle.click();
    await wait(180);
  }

  if (await click2014()) {
    return true;
  }

  // final pass after hydration/animation
  await wait(240);
  if (await click2014()) {
    return true;
  }

  if (required) {
    const debugItems = collectRuleDiagnostics();
    const debugText = debugItems.length ? ` Visible rule-like controls: ${debugItems.join(' | ')}` : '';
    throw new Error(`2014 Core Rules filter not found.${debugText}`);
  }
  return false;
}

function isSpellSectionHeader(control) {
  const label = getTextContent(control).toLowerCase();
  return label.startsWith('known spells') || label.startsWith('prepared spells') || label.startsWith('spell slots');
}

function isCollapsedControl(control) {
  const ariaExpanded = control.getAttribute('aria-expanded');
  if (ariaExpanded === 'false') return true;
  if (ariaExpanded === 'true') return false;

  const regionId = control.getAttribute('aria-controls');
  if (regionId) {
    const region = document.getElementById(regionId);
    if (region?.getAttribute('aria-hidden') === 'true') return true;
  }

  return false;
}

async function expandCollapsedSpellSections(emitProgress = true) {
  const controls = Array.from(document.querySelectorAll('button, [role="button"]'));
  const candidates = controls.filter((control) => {
    if (!(control instanceof HTMLElement)) return false;
    if (!isSpellSectionHeader(control)) return false;
    return isCollapsedControl(control);
  });

  for (const control of candidates) {
    if (!(control instanceof HTMLElement)) continue;
    control.scrollIntoView({ block: 'center' });
    control.click();
    await wait(randomDelay(80, 140));
  }

  if (emitProgress) {
    await chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      progress: {
        label: candidates.length
          ? `Expanded ${candidates.length} spell section(s).`
          : 'Spell sections already expanded or not detected.',
      },
    });
  }
}

async function prepareUiForSync({ emitProgress = true, require2014 = true } = {}) {
  const spellsTab = await withRetries(
    () => document.querySelector('button[data-testid="SPELLS"], button#SPELLS'),
    'Spells tab',
  );
  await clickElement(spellsTab, 'Opened Spells tab', emitProgress);
  await expandCollapsedSpellSections(emitProgress);

  const manageSpellsButton = await withRetries(() => queryByText('Manage Spells'), 'Manage Spells button');
  await clickElement(manageSpellsButton, 'Opened Manage Spells', emitProgress);

  // Sidebar must expose ruleset controls under Known Spells before selecting 2014 rules.
  const knownToggles = Array.from(getManageSpellsRoot().querySelectorAll('button, [role="button"]')).filter((node) =>
    getNormalizedText(node).startsWith('known spells'),
  );
  for (const toggle of knownToggles) {
    if (!(toggle instanceof HTMLElement)) continue;
    if (!isCollapsedControl(toggle)) continue;
    toggle.scrollIntoView({ block: 'center' });
    toggle.click();
    await wait(160);
  }

  await withRetries(
    async () => {
      const ok = await ensure2014CoreRulesFilter({ emitProgress, required: require2014 });
      return ok ? true : require2014 ? null : true;
    },
    '2014 Core Rules filter',
  );

  const allFilterButton = await withRetries(
    () => document.querySelector('button[data-testid="tab-filter-all"]'),
    'All filter button',
  );
  await clickElement(allFilterButton, 'Selected All filter', emitProgress);
}

function computeDiff(targetNames, currentPreparedKeys, currentNameByKey) {
  const targetByKey = new Map(targetNames.map((name) => [normalizeSpellName(name), name]));
  const targetKeys = new Set(targetByKey.keys());

  const toAdd = [];
  for (const key of targetKeys) {
    if (!currentPreparedKeys.has(key)) {
      toAdd.push({ key, canonicalName: targetByKey.get(key) || key });
    }
  }

  const toRemove = [];
  for (const key of currentPreparedKeys) {
    if (!targetKeys.has(key)) {
      toRemove.push({ key, canonicalName: currentNameByKey.get(key) || key });
    }
  }

  return { toAdd, toRemove };
}

async function findEntryByKeyForAction(key, desiredPrepared) {
  return withRetries(async () => {
    const entry = findEntryBySpellNameKey(key, desiredPrepared);
    if (entry) return entry;

    const index = buildSpellActionIndex();
    const entries = index.get(key);
    const fallbackEntry = selectPreferredEntry(entries, desiredPrepared);
    if (fallbackEntry) return fallbackEntry;

    // last-chance relaxed match if unicode/punctuation variants changed.
    for (const [entryKey, entryValues] of index.entries()) {
      if (!entryKey.includes(key) && !key.includes(entryKey)) continue;
      const fuzzy = selectPreferredEntry(entryValues, desiredPrepared);
      if (fuzzy) return fuzzy;
    }
    return null;
  }, `Spell row for ${key}`);
}

async function clickActionForSpell(entry, actionLabel) {
  if (!entry?.button) throw new Error(`Missing button for ${entry?.name || 'spell'}`);
  entry.row.scrollIntoView({ block: 'center' });
  const targetButton = entry.button.closest('button') || entry.button;
  targetButton.click();
  await wait(randomDelay(100, 250));

  await chrome.runtime.sendMessage({
    type: 'SYNC_PROGRESS',
    progress: { label: `${actionLabel}: ${entry.name}` },
  });
}

function getCurrentPreparedFromIndex() {
  const initialIndex = buildSpellActionIndex();
  const currentPrepared = new Set();
  const currentNameByKey = new Map();
  for (const [key, entries] of initialIndex.entries()) {
    const preferred = selectPreferredEntry(entries);
    if (!preferred) continue;
    currentNameByKey.set(key, preferred.name);
    if (entries.some((entry) => entry.prepared)) {
      currentPrepared.add(key);
    }
  }
  return { currentPrepared, currentNameByKey };
}

async function buildPlan(payload, options = {}) {
  const { emitProgress = true, require2014 = true } = options;
  await prepareUiForSync({ emitProgress, require2014 });
  const { currentPrepared, currentNameByKey } = getCurrentPreparedFromIndex();
  const { toAdd, toRemove } = computeDiff(payload.preparedSpells, currentPrepared, currentNameByKey);
  return { toAdd, toRemove, currentPrepared };
}

async function runPreview(payload) {
  const startedAt = Date.now();
  const { toAdd, toRemove } = await buildPlan(payload, { emitProgress: false, require2014: false });
  return {
    toAdd: toAdd.map((item) => item.canonicalName),
    toRemove: toRemove.map((item) => item.canonicalName),
    actionCount: toAdd.length + toRemove.length,
    alreadyCorrect: toAdd.length === 0 && toRemove.length === 0,
    durationMs: Date.now() - startedAt,
  };
}

async function runSync(payload, context) {
  const startedAt = Date.now();
  const { toAdd, toRemove, currentPrepared } = await buildPlan(payload, { emitProgress: true, require2014: true });
  const actionCount = toAdd.length + toRemove.length;
  if (actionCount > MAX_ACTIONS) {
    throw new Error(`Sync aborted: required ${actionCount} actions, max is ${MAX_ACTIONS}.`);
  }

  const result = {
    added: [],
    removed: [],
    notFound: [],
    alreadyCorrect: toAdd.length === 0 && toRemove.length === 0,
    durationMs: 0,
  };

  for (const item of toAdd) {
    try {
      const entry = await findEntryByKeyForAction(item.key, false);
      if (entry.prepared) continue;
      await clickActionForSpell(entry, 'Prepared');
      result.added.push(entry.name);
      currentPrepared.add(item.key);
    } catch {
      result.notFound.push(item.canonicalName);
    }
  }

  for (const item of toRemove) {
    try {
      const entry = await findEntryByKeyForAction(item.key, true);
      if (!entry.prepared) continue;
      await clickActionForSpell(entry, 'Unprepared');
      result.removed.push(entry.name);
      currentPrepared.delete(item.key);
    } catch {
      result.notFound.push(item.canonicalName);
    }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}

window.addEventListener('message', (event) => {
  if (!IS_TOP_WINDOW) return;
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type !== INCOMING_PAYLOAD_TYPE) return;

  const validation = validatePayload(message.payload);
  if (!validation.ok) {
    sendPageAck(false, validation.error);
    return;
  }

  void storePayload(validation.payload)
    .then(() => sendPageAck(true))
    .catch(() => sendPageAck(false, 'Failed to persist payload in extension storage.'));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    sendResponse({ ok: false, error: 'Invalid message.' });
    return;
  }

  const acceptedMessageTypes = new Set(['SYNC_EXECUTE', 'PREVIEW_EXECUTE']);
  if (!acceptedMessageTypes.has(String(message.type))) {
    sendResponse({ ok: false, error: `Unsupported message type: ${String(message.type)}` });
    return;
  }

  if (operationInFlight) {
    sendResponse({ ok: false, error: 'Another operation is already in progress.' });
    return;
  }

  const validation = validatePayload(message.payload);
  if (!validation.ok) {
    sendResponse({ ok: false, error: validation.error });
    return;
  }

  operationInFlight = true;
  const operation = message.type === 'PREVIEW_EXECUTE'
    ? runPreview(validation.payload)
    : runSync(validation.payload, message.context);

  void operation
    .then((result) => {
      if (message.type === 'PREVIEW_EXECUTE') {
        sendResponse({ ok: true, preview: result });
      } else {
        void chrome.runtime.sendMessage({ type: 'SYNC_RESULT', result }).catch(() => {
          // Popup may be closed.
        });
        sendResponse({ ok: true, result });
      }
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : message.type === 'PREVIEW_EXECUTE' ? 'Preview failed.' : 'Sync failed.',
      });
    })
    .finally(() => {
      operationInFlight = false;
    });

  return true;
});

if (IS_TOP_WINDOW) {
  injectPageBridge();
}
