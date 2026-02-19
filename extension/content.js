const SYNC_PAYLOAD_STORAGE_KEY = 'spellbook.syncPayload.v1';
const INCOMING_PAYLOAD_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_SET';
const OUTGOING_PAYLOAD_ACK_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_ACK';
const MAX_ACTIONS = 200;
const MAX_LOOKUP_RETRIES = 3;
const MAX_DEBUG_LOG_ENTRIES = 2000;
const IS_TOP_WINDOW = window === window.top;

let operationInFlight = false;
let bridgeInjected = false;
let activeDebugRun = null;

function describeElementForLog(node) {
  if (!(node instanceof Element)) return String(node);
  const tag = node.tagName.toLowerCase();
  const text = String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const className = String(node.className || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const id = String(node.id || '').trim();
  return `<${tag}${id ? `#${id}` : ''}${className ? `.${className.replace(/\s+/g, '.')}` : ''}${text ? ` "${text}"` : ''}>`;
}

function safeSerializeForLog(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);

  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (_key, rawValue) => {
      if (rawValue instanceof Element) {
        return describeElementForLog(rawValue);
      }
      if (typeof rawValue === 'object' && rawValue !== null) {
        if (seen.has(rawValue)) return '[circular]';
        seen.add(rawValue);
      }
      return rawValue;
    });
  } catch {
    return String(value);
  }
}

function startDebugRun(mode, payload) {
  activeDebugRun = {
    startedAt: Date.now(),
    lines: [],
  };
  debugLog(`sync start (${mode})`, {
    version: payload?.version,
    operations: Array.isArray(payload?.operations) ? payload.operations.length : undefined,
    preparedSpells: Array.isArray(payload?.preparedSpells) ? payload.preparedSpells.length : undefined,
    unresolved: Array.isArray(payload?.unresolved) ? payload.unresolved.length : undefined,
  });
}

function debugLog(message, detail) {
  if (!activeDebugRun) return;
  const elapsed = Date.now() - activeDebugRun.startedAt;
  const detailText = safeSerializeForLog(detail);
  const line = detailText
    ? `[+${elapsed}ms] ${message} | ${detailText}`
    : `[+${elapsed}ms] ${message}`;

  activeDebugRun.lines.push(line);
  if (activeDebugRun.lines.length > MAX_DEBUG_LOG_ENTRIES) {
    activeDebugRun.lines.shift();
  }

  if (detail === undefined) {
    console.log('[Spellbook Sync]', line);
  } else {
    console.log('[Spellbook Sync]', line, detail);
  }
}

function getDebugLogSnapshot() {
  if (!activeDebugRun) return [];
  return [...activeDebugRun.lines];
}

function clearDebugRun() {
  activeDebugRun = null;
}

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

function normalizeListName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const ALLOWED_UNRESOLVED_CODES = new Set([
  'AMBIGUOUS_LIST',
  'MISSING_SPELL',
  'MISSING_NAME',
  'LIST_MISMATCH',
]);

function normalizeUnresolvedEntries(values) {
  if (!Array.isArray(values)) return [];
  return values.reduce((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const code = String(entry.code || '').trim().toUpperCase();
    const detail = String(entry.detail || '').trim();
    const changeIndex = Number(entry.changeIndex);
    if (!ALLOWED_UNRESOLVED_CODES.has(code)) return acc;
    if (!detail) return acc;
    if (!Number.isInteger(changeIndex) || changeIndex < 0) return acc;
    acc.push({ code, detail, changeIndex });
    return acc;
  }, []);
}

function normalizeOperations(values) {
  if (!Array.isArray(values)) {
    throw new Error('operations must be an array.');
  }

  const operations = [];
  for (let index = 0; index < values.length; index += 1) {
    const operation = values[index];
    if (!operation || typeof operation !== 'object') {
      throw new Error(`operations[${index}] must be an object.`);
    }

    const type = String(operation.type || '').trim().toLowerCase();
    if (!['replace', 'prepare', 'unprepare'].includes(type)) {
      throw new Error(`operations[${index}].type must be replace, prepare, or unprepare.`);
    }

    const list = normalizeListName(operation.list);
    if (!list) {
      throw new Error(`operations[${index}].list is required.`);
    }

    if (type === 'replace') {
      const remove = String(operation.remove || '').trim();
      const add = String(operation.add || '').trim();
      if (!remove || !add) {
        throw new Error(`operations[${index}] replace requires remove and add names.`);
      }
      operations.push({ type, list, remove, add });
      continue;
    }

    const spell = String(operation.spell || '').trim();
    if (!spell) {
      throw new Error(`operations[${index}] ${type} requires spell name.`);
    }
    operations.push({ type, list, spell });
  }

  return operations;
}

function validatePayload(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Payload must be an object.' };
  }

  if (input.source !== 'spellbook') {
    return { ok: false, error: 'Payload source must be spellbook.' };
  }

  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { ok: false, error: 'timestamp must be a positive number.' };
  }

  const basePayload = {
    timestamp,
    source: 'spellbook',
  };

  if (input.characterId !== undefined && input.characterId !== null) {
    basePayload.characterId = String(input.characterId);
  }

  if (input.version === 1) {
    if (!Array.isArray(input.preparedSpells)) {
      return { ok: false, error: 'preparedSpells must be an array.' };
    }

    const payload = {
      ...basePayload,
      version: 1,
      preparedSpells: normalizePreparedSpells(input.preparedSpells),
    };
    return { ok: true, payload };
  }

  if (input.version === 2) {
    try {
      const payload = {
        ...basePayload,
        version: 2,
        operations: normalizeOperations(input.operations),
        unresolved: normalizeUnresolvedEntries(input.unresolved),
      };
      return { ok: true, payload };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid operations payload.' };
    }
  }

  return { ok: false, error: 'Payload version must be 1 or 2.' };
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
  if (!globalThis.chrome?.storage?.local) {
    throw new Error('chrome.storage.local unavailable (reload the tab to refresh extension context).');
  }
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

  // Heuristic fallback for layouts without tab-filter-all anchors.
  const regions = Array.from(document.querySelectorAll('aside, section, div'));
  let bestRegion = null;
  let bestScore = -1;
  for (const region of regions) {
    if (!(region instanceof HTMLElement)) continue;
    const text = getNormalizedText(region);
    if (!text.includes('known spells')) continue;

    let score = 0;
    if (text.includes('prepared spells')) score += 2;
    if (text.includes('filter by source category')) score += 3;
    score += Math.min(countSpellActionButtons(region), 8);

    if (score > bestScore) {
      bestScore = score;
      bestRegion = region;
    }
  }
  if (bestRegion) return bestRegion;

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
  if (clickable instanceof HTMLElement) return clickable;

  const isHeadingLike = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const classText = String(element.className || '').toLowerCase();
    const text = getNormalizedText(element);
    if (classText.includes('ddbc-collapsible__heading')) return true;
    if (!classText.includes('heading')) return false;
    if (text.includes('known spells')) return true;
    if (text.includes('prepared spells')) return true;
    if (text.includes('filter by source category')) return true;
    if (text.includes('filter by spell level')) return true;
    return false;
  };

  if (isHeadingLike(node)) return node;
  if (isHeadingLike(node.parentElement)) return node.parentElement;
  return null;
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
  debugLog('click element', {
    label: progressLabel,
    target: describeElementForLog(element),
    emitProgress,
  });
  element.scrollIntoView({ block: 'center' });
  element.click();
  if (emitProgress) {
    await chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      progress: { label: progressLabel },
    });
  }
  await wait(randomDelay(100, 250));
  debugLog('click element complete', {
    label: progressLabel,
  });
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

async function runLegacyPreview(payload) {
  const startedAt = Date.now();
  const { toAdd, toRemove } = await buildPlan(payload, { emitProgress: false, require2014: false });
  return {
    mode: 'legacy',
    toAdd: toAdd.map((item) => item.canonicalName),
    toRemove: toRemove.map((item) => item.canonicalName),
    actionCount: toAdd.length + toRemove.length,
    alreadyCorrect: toAdd.length === 0 && toRemove.length === 0,
    durationMs: Date.now() - startedAt,
  };
}

async function runLegacySync(payload) {
  const startedAt = Date.now();
  const { toAdd, toRemove, currentPrepared } = await buildPlan(payload, { emitProgress: true, require2014: true });
  const actionCount = toAdd.length + toRemove.length;
  if (actionCount > MAX_ACTIONS) {
    throw new Error(`Sync aborted: required ${actionCount} actions, max is ${MAX_ACTIONS}.`);
  }

  const result = {
    mode: 'legacy',
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

function summarizeOpsPreview(payload) {
  const perListMap = new Map();
  const totals = {
    replace: 0,
    prepare: 0,
    unprepare: 0,
    operations: payload.operations.length,
  };

  for (const operation of payload.operations) {
    const list = normalizeListName(operation.list);
    if (!perListMap.has(list)) {
      perListMap.set(list, {
        list,
        replace: 0,
        prepare: 0,
        unprepare: 0,
        total: 0,
      });
    }

    const bucket = perListMap.get(list);
    if (operation.type === 'replace') {
      bucket.replace += 1;
      totals.replace += 1;
    }
    if (operation.type === 'prepare') {
      bucket.prepare += 1;
      totals.prepare += 1;
    }
    if (operation.type === 'unprepare') {
      bucket.unprepare += 1;
      totals.unprepare += 1;
    }
    bucket.total += 1;
  }

  const skippedFromPayload = Array.isArray(payload.unresolved) ? payload.unresolved : [];

  return {
    mode: 'ops',
    perList: [...perListMap.values()],
    totals,
    actionCount: payload.operations.length,
    listCount: perListMap.size,
    skippedFromPayload,
    skippedCount: skippedFromPayload.length,
    alreadyCorrect: payload.operations.length === 0,
    durationMs: 0,
  };
}

async function runOpsPreview(payload) {
  const startedAt = Date.now();
  const preview = summarizeOpsPreview(payload);
  preview.durationMs = Date.now() - startedAt;
  return preview;
}

async function prepareUiForManageSpells({ emitProgress = true } = {}) {
  debugLog('prepare ui for manage spells start', { emitProgress });
  const spellsTab = await withRetries(
    () => document.querySelector('button[data-testid="SPELLS"], button#SPELLS'),
    'Spells tab',
  );
  debugLog('spells tab located', { target: describeElementForLog(spellsTab) });
  await clickElement(spellsTab, 'Opened Spells tab', emitProgress);
  await expandCollapsedSpellSections(emitProgress);

  const manageSpellsButton = await withRetries(() => queryByText('Manage Spells'), 'Manage Spells button');
  debugLog('manage spells button located', { target: describeElementForLog(manageSpellsButton) });
  await clickElement(manageSpellsButton, 'Opened Manage Spells', emitProgress);
  debugLog('prepare ui for manage spells complete');
}

function collectKnownSpellsSectionDescriptors() {
  const root = getManageSpellsRoot();
  const primaryCandidates = Array.from(
    root.querySelectorAll('button, [role="button"], div.ddbc-collapsible__heading'),
  ).filter((node) => {
    const text = getNormalizedText(node);
    return /^known spells(\b|$)/.test(text);
  });

  const interactiveCandidates = Array.from(
    root.querySelectorAll('[aria-expanded], [aria-controls], div.ddbc-collapsible__heading'),
  ).filter((node) => {
    const text = getNormalizedText(node);
    if (!/^known spells(\b|$)/.test(text)) return false;
    return text.length <= 120;
  });

  const candidates = [...primaryCandidates, ...interactiveCandidates];

  const descriptors = [];
  const seenClickables = new Set();
  for (const candidate of candidates) {
    const clickable = (() => {
      if (candidate instanceof HTMLElement) {
        const selfInteractive =
          candidate.matches('button, [role="button"]') ||
          candidate.hasAttribute('aria-expanded') ||
          candidate.hasAttribute('aria-controls');
        if (selfInteractive) return candidate;
      }
      return (
        asClickableElement(candidate) ||
        asClickableElement(candidate.parentElement) ||
        null
      );
    })();
    if (!(clickable instanceof HTMLElement)) continue;
    if (seenClickables.has(clickable)) continue;
    seenClickables.add(clickable);

    const containerWrapper = (() => {
      const directCollapsible =
        clickable.closest('div.ddbc-collapsible') ||
        candidate.closest?.('div.ddbc-collapsible');
      if (directCollapsible instanceof Element) return directCollapsible;

      const sectionLike =
        clickable.closest('section, article, li') ||
        candidate.closest?.('section, article, li');
      if (sectionLike instanceof Element) return sectionLike;

      const fallbackParent = clickable.parentElement || candidate.parentElement || root;
      return fallbackParent instanceof Element ? fallbackParent : root;
    })();

    const ariaControls = clickable.getAttribute('aria-controls') || candidate.getAttribute?.('aria-controls') || '';
    let region = ariaControls ? document.getElementById(ariaControls) : null;
    if (!region && ariaControls && containerWrapper instanceof Element) {
      if (globalThis.CSS?.escape) {
        region = containerWrapper.querySelector(`#${CSS.escape(ariaControls)}`);
      } else {
        region = containerWrapper.querySelector(`[id="${ariaControls.replace(/"/g, '\\"')}"]`);
      }
    }
    if (!region && containerWrapper instanceof Element) {
      region = containerWrapper.querySelector('div.ddbc-collapsible__content, [role="region"], [aria-live], [data-testid*="known-spells"]');
    }
    if (!region && clickable.classList.contains('ddbc-collapsible__heading')) {
      const sibling = clickable.nextElementSibling;
      if (sibling instanceof Element) {
        region = sibling;
      }
    }
    if (!region) {
      const heading = clickable.querySelector?.('div.ddbc-collapsible__heading');
      if (heading instanceof Element && heading.nextElementSibling instanceof Element) {
        region = heading.nextElementSibling;
      }
    }
    const container =
      region ||
      containerWrapper ||
      root;

    const rawLabel = getTextContent(candidate) || getTextContent(clickable) || 'Known Spells';
    const label = (rawLabel || 'Known Spells').replace(/\s+/g, ' ').trim();

    descriptors.push({
      label,
      clickable,
      container,
      scope: region || container || root,
    });
  }

  descriptors.sort((a, b) => {
    const aExpanded = a.clickable.getAttribute('aria-expanded') === 'true' ? 0 : 1;
    const bExpanded = b.clickable.getAttribute('aria-expanded') === 'true' ? 0 : 1;
    return aExpanded - bExpanded;
  });

  return descriptors;
}

function describeKnownSpellsSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return 'none';
  return sections
    .map((section, index) => `${index + 1}:${section.label}`)
    .join(' | ');
}

function hasSourceCategoryFilterVisible(scope) {
  if (!(scope instanceof Element)) return false;
  const text = getNormalizedText(scope);
  if (!text.includes('filter by source category')) return false;
  return Boolean(
    findRuleToggleControl(scope, '2014 Core Rules') ||
      findRuleToggleControl(scope, '2014 Expanded Rules'),
  );
}

function isKnownSpellsSectionExpanded(descriptor) {
  const ariaExpanded = descriptor.clickable.getAttribute('aria-expanded');
  if (ariaExpanded === 'true') return true;
  if (ariaExpanded === 'false') return false;

  const collapsibleRoot = descriptor.clickable.closest('div.ddbc-collapsible');
  const collapsibleContent = collapsibleRoot?.querySelector('div.ddbc-collapsible__content');
  if (collapsibleContent instanceof HTMLElement) {
    const style = window.getComputedStyle(collapsibleContent);
    if (collapsibleContent.getAttribute('aria-hidden') === 'true') return false;
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    if (collapsibleContent.className?.includes?.('collapsed')) return false;
  }

  const classText = String(descriptor.container?.className || '');
  if (classText.includes('collapsed')) return false;

  const scope = (collapsibleContent instanceof Element && collapsibleContent) || descriptor.scope || descriptor.container || getManageSpellsRoot();
  if (hasSourceCategoryFilterVisible(scope)) return true;

  const spellSearchInput = scope.querySelector('input[placeholder*="spell name" i], input[aria-label*="spell name" i]');
  if (spellSearchInput instanceof HTMLElement && isVisible(spellSearchInput)) return true;

  const scopeText = getNormalizedText(scope);
  if (scopeText.includes('filter by spell level') || scopeText.includes('filter by source category')) {
    return true;
  }

  const visibleActions = Array.from(scope.querySelectorAll('span.ct-button__content')).some((node) => {
    const text = getNormalizedText(node);
    if (text !== 'prepare' && text !== 'unprepare') return false;
    return isVisible(node.closest('button') || node);
  });
  if (visibleActions) return true;

  return false;
}

async function ensureSourceCategoryFilterExpanded(scope, listLabel) {
  if (!(scope instanceof Element)) {
    debugLog('source category expand skipped: invalid scope', { listLabel });
    return;
  }
  if (hasSourceCategoryFilterVisible(scope)) {
    debugLog('source category already visible', { listLabel });
    return;
  }

  const filterControl = findControlByExactTextInScope(scope, 'Filter By Source Category');
  if (!(filterControl instanceof HTMLElement)) {
    debugLog('source category control not found', { listLabel });
    return;
  }

  const ariaExpanded = filterControl.getAttribute('aria-expanded');
  debugLog('source category control found', {
    listLabel,
    ariaExpanded: ariaExpanded ?? null,
    control: describeElementForLog(filterControl),
  });
  if (ariaExpanded !== 'true' && !hasSourceCategoryFilterVisible(scope)) {
    filterControl.scrollIntoView({ block: 'center' });
    filterControl.click();
    await wait(180);
    debugLog('source category control clicked', { listLabel });
  }

  if (!hasSourceCategoryFilterVisible(scope)) {
    const headingFallback = filterControl.closest('div.ddbc-collapsible')?.querySelector('div.ddbc-collapsible__heading');
    if (headingFallback instanceof HTMLElement && headingFallback !== filterControl && isVisible(headingFallback)) {
      headingFallback.scrollIntoView({ block: 'center' });
      headingFallback.click();
      await wait(180);
      debugLog('source category heading fallback clicked', {
        listLabel,
        heading: describeElementForLog(headingFallback),
      });
    }
  }

  if (!hasSourceCategoryFilterVisible(scope)) {
    debugLog('source category still hidden after expand attempt', { listLabel });
    await chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      progress: {
        label: `${listLabel}: Source Category filter still hidden after expand attempt`,
      },
    });
    return;
  }

  debugLog('source category visible after expand attempt', { listLabel });
}

async function ensureKnownSpellsSectionExpanded(descriptor) {
  debugLog('ensure known spells expanded start', {
    label: descriptor?.label,
    clickable: describeElementForLog(descriptor?.clickable),
    scope: describeElementForLog(descriptor?.scope),
  });
  let interacted = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const expanded = isKnownSpellsSectionExpanded(descriptor);
    debugLog('known spells expansion attempt', {
      label: descriptor?.label,
      attempt,
      expandedBeforeClick: expanded,
      ariaExpanded: descriptor?.clickable?.getAttribute('aria-expanded') ?? null,
    });
    if (!expanded || isCollapsedControl(descriptor.clickable)) {
      descriptor.clickable.scrollIntoView({ block: 'center' });
      descriptor.clickable.click();
      await wait(220);
      interacted = true;
      debugLog('known spells header clicked', {
        label: descriptor?.label,
        attempt,
      });
    }

    await ensureSourceCategoryFilterExpanded(descriptor.scope, descriptor.label);
    if (isKnownSpellsSectionExpanded(descriptor)) {
      debugLog('known spells expansion success', {
        label: descriptor?.label,
        attempt,
      });
      return true;
    }

    // Some DDB controls do not expose stable aria-expanded state.
    // If the section now shows spell action rows, treat it as expanded.
    const scope = descriptor.scope || descriptor.container || getManageSpellsRoot();
    const hasActionRows = scope instanceof Element
      ? Array.from(scope.querySelectorAll('span.ct-button__content')).some((node) => {
          const text = getNormalizedText(node);
          return text === 'prepare' || text === 'unprepare';
        })
      : false;
    if (hasActionRows) {
      debugLog('known spells treated as expanded (action rows detected)', {
        label: descriptor?.label,
        attempt,
      });
      return true;
    }
  }

  const fallbackState = isKnownSpellsSectionExpanded(descriptor);
  debugLog('known spells expansion fallback result', {
    label: descriptor?.label,
    interacted,
    result: fallbackState,
  });
  return fallbackState;
}

async function preconfigureKnownSpellsFilters(sections) {
  debugLog('preconfigure known spells filters start', { sectionCount: sections.length });
  const configured = [];
  const failed = [];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const label = `Known Spells ${index + 1}`;
    try {
      debugLog('preconfigure section start', { label, sectionLabel: section.label });
      const expanded = await ensureKnownSpellsSectionExpanded(section);
      if (!expanded) {
        throw new Error(`Could not expand Known Spells section: ${section.label}`);
      }
      await ensureSourceCategoryFilterExpanded(section.scope, label);
      await ensureToggleState(section.scope, label, '2014 Core Rules', true, true);
      await ensureToggleState(section.scope, label, '2014 Expanded Rules', true, true);
      configured.push(label);
      debugLog('preconfigure section success', { label });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error || 'Unknown error.');
      failed.push(`${label}: ${reason}`);
      debugLog('preconfigure section failed', { label, reason });
    }
  }

  debugLog('preconfigure known spells filters complete', {
    configuredCount: configured.length,
    failedCount: failed.length,
  });
  return { configured, failed };
}

function findControlByExactTextInScope(root, label) {
  if (!(root instanceof Element)) return null;
  const target = String(label || '').trim().toLowerCase();
  if (!target) return null;

  const controls = Array.from(
    root.querySelectorAll('button, [role="button"], [role="option"], [role="menuitem"], [role="menuitemradio"], label, span, div, li'),
  );

  const getVisibleClickable = (node) => {
    const candidates = [
      asClickableElement(node),
      asClickableElement(node.parentElement),
      asClickableElement(node.closest('div.ddbc-collapsible, section, article, li')),
    ];
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue;
      if (!isVisible(candidate) && !isVisible(node instanceof HTMLElement ? node : candidate)) continue;
      return candidate;
    }
    return null;
  };

  for (const node of controls) {
    if (getNormalizedText(node) !== target) continue;
    const clickable = getVisibleClickable(node);
    if (clickable) return clickable;
  }

  for (const node of controls) {
    if (!getNormalizedText(node).includes(target)) continue;
    const clickable = getVisibleClickable(node);
    if (clickable) return clickable;
  }

  return null;
}

function getControlSearchText(node) {
  const text = getNormalizedText(node);
  const title = String(node.getAttribute?.('title') || '').toLowerCase();
  const ariaLabel = String(node.getAttribute?.('aria-label') || '').toLowerCase();
  const testId = String(node.getAttribute?.('data-testid') || '').toLowerCase();
  return `${text} ${title} ${ariaLabel} ${testId}`.trim();
}

function matchesRuleToggleLabel(searchText, label) {
  const normalizedLabel = String(label || '').trim().toLowerCase();
  const value = String(searchText || '').trim().toLowerCase();
  if (!normalizedLabel || !value) return false;

  if (normalizedLabel === 'core rules') {
    return (
      value.includes('core rules') &&
      !value.includes('2014 core rules') &&
      !value.includes('2014 expanded rules') &&
      !value.includes('2024 core rules') &&
      !value.includes('expanded')
    );
  }

  if (normalizedLabel === '2014 core rules') {
    return value.includes('2014 core rules');
  }

  if (normalizedLabel === '2014 expanded rules') {
    return value.includes('2014 expanded rules');
  }

  return value.includes(normalizedLabel);
}

function findRuleToggleControl(sectionRoot, label) {
  const roots = [
    sectionRoot instanceof Element ? sectionRoot : null,
    sectionRoot instanceof Element ? null : getManageSpellsRoot(),
  ].filter((root, index, all) => root && all.indexOf(root) === index);

  for (const root of roots) {
    const controls = Array.from(root.querySelectorAll('button, [role="button"], [role="option"], label, span, div, li'));
    for (const node of controls) {
      if (!matchesRuleToggleLabel(getControlSearchText(node), label)) continue;
      const clickable =
        asClickableElement(node) ||
        asClickableElement(node.parentElement) ||
        asClickableElement(node.closest('div.ddbc-collapsible, section, article, li'));
      if (!(clickable instanceof HTMLElement)) continue;
      if (!isVisible(clickable) && !(node instanceof HTMLElement && isVisible(node))) continue;
      return clickable;
    }
  }

  return null;
}

async function revealRuleFilterControls(sectionRoot, list, emitProgress) {
  if (emitProgress) {
    await chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      progress: {
        label: `${list}: locating Source Category filters`,
      },
    });
  }
  await ensureSourceCategoryFilterExpanded(sectionRoot, list);
}

function getToggleState(control) {
  const fragments = [];
  const collectClass = (node) => {
    if (!node || !(node instanceof Element)) return;
    if (typeof node.className === 'string' && node.className) {
      fragments.push(node.className);
    }
  };

  collectClass(control);
  collectClass(control.firstElementChild);
  collectClass(control.parentElement);

  const solidNode = control.querySelector('[class*="styles_solid"]');
  const outlineNode = control.querySelector('[class*="styles_outline"]');
  collectClass(solidNode);
  collectClass(outlineNode);

  const classText = fragments.join(' ');
  const hasSolid = classText.includes('styles_solid');
  const hasOutline = classText.includes('styles_outline');

  if (hasSolid && !hasOutline) return true;
  if (hasOutline && !hasSolid) return false;
  if (hasSolid) return true;
  if (hasOutline) return false;
  return null;
}

async function ensureToggleState(sectionRoot, list, label, desiredState, emitProgress) {
  for (let attempt = 1; attempt <= MAX_LOOKUP_RETRIES + 1; attempt += 1) {
    debugLog('toggle enforcement attempt', {
      list,
      label,
      desiredState,
      attempt,
    });
    await ensureSourceCategoryFilterExpanded(sectionRoot, list);
    const control = findRuleToggleControl(sectionRoot, label);
    if (!(control instanceof HTMLElement)) {
      debugLog('toggle control missing', { list, label, attempt });
      if (attempt < MAX_LOOKUP_RETRIES + 1) {
        await revealRuleFilterControls(sectionRoot, list, emitProgress);
        continue;
      }
      throw new Error(`${label} toggle not found in ${list} section.`);
    }

    const state = getToggleState(control);
    debugLog('toggle state detected', {
      list,
      label,
      attempt,
      state,
      desiredState,
      control: describeElementForLog(control),
    });
    if (state === desiredState) {
      debugLog('toggle already in desired state', { list, label, desiredState, attempt });
      return;
    }
    if (state === null) {
      throw new Error(`Unable to detect ${label} state in ${list} section.`);
    }

    control.scrollIntoView({ block: 'center' });
    control.click();
    await wait(180);
    debugLog('toggle clicked', { list, label, desiredState, attempt });

    if (emitProgress) {
      await chrome.runtime.sendMessage({
        type: 'SYNC_PROGRESS',
        progress: {
          label: `${list}: set ${label} ${desiredState ? 'ON' : 'OFF'}`,
        },
      });
    }
  }

  debugLog('toggle enforcement failed after retries', { list, label, desiredState });
  throw new Error(`Failed to enforce ${label} in ${list} section.`);
}

async function enforceRulesForListSection(sectionRoot, list, emitProgress) {
  await ensureToggleState(sectionRoot, list, '2014 Core Rules', true, emitProgress);
  await ensureToggleState(sectionRoot, list, '2014 Expanded Rules', true, emitProgress);
}

function findSpellRowInSection(sectionRoot, spellName) {
  const target = normalizeSpellName(spellName);
  if (!target) return null;

  const matchScore = (candidateName) => {
    const normalized = normalizeSpellName(candidateName);
    if (!normalized) return 0;
    if (normalized === target) return 4;
    if (normalized.startsWith(`${target} `)) return 3;
    if (normalized.includes(` ${target} `)) return 2;
    if (target.startsWith(`${normalized} `)) return 1;
    return 0;
  };

  const seenRows = new Set();
  const rowMatches = [];
  const actionButtons = Array.from(sectionRoot.querySelectorAll('button'));
  for (const button of actionButtons) {
    const actionText = getNormalizedText(button);
    if (!actionText.includes('prepare') && !actionText.includes('unprepare')) continue;

    const row = findRowContainerFromButton(button);
    if (!(row instanceof Element)) continue;
    if (!sectionRoot.contains(row)) continue;
    if (seenRows.has(row)) continue;
    seenRows.add(row);

    const rowSpellName = findSpellNameInContainer(row);
    const score = matchScore(rowSpellName);
    if (score <= 0) continue;
    rowMatches.push({ row, score });
  }

  rowMatches.sort((a, b) => {
    const visibilityDelta = Number(isVisible(b.row)) - Number(isVisible(a.row));
    if (visibilityDelta !== 0) return visibilityDelta;
    return b.score - a.score;
  });

  if (rowMatches.length > 0) {
    return rowMatches[0].row;
  }

  const seen = new Set();
  const candidates = [];
  const nodes = Array.from(sectionRoot.querySelectorAll('span, a, h3, h4, strong, div, p, li'));
  for (const node of nodes) {
    const text = getTextContent(node);
    if (!text) continue;
    if (matchScore(text) <= 0) continue;

    const row = findRowContainerFromSpellNode(node);
    if (!(row instanceof Element)) continue;
    if (!sectionRoot.contains(row)) continue;
    if (seen.has(row)) continue;
    seen.add(row);
    candidates.push(row);
  }

  if (!candidates.length) return null;
  const visible = candidates.find((row) => isVisible(row));
  return visible || candidates[0];
}

function findActionButtonInRowByText(row, text) {
  const target = String(text || '').trim().toLowerCase();
  if (!target || !(row instanceof Element)) return null;

  const spans = Array.from(row.querySelectorAll('span.ct-button__content'));
  for (const span of spans) {
    if (getNormalizedText(span) !== target) continue;
    const button = span.closest('button');
    if (button instanceof HTMLButtonElement) return button;
  }

  const buttons = Array.from(row.querySelectorAll('button'));
  for (const button of buttons) {
    if (!getNormalizedText(button).includes(target)) continue;
    return button;
  }

  return null;
}

function setInputValue(input, value) {
  const next = String(value ?? '');
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  const setter = descriptor && typeof descriptor.set === 'function' ? descriptor.set : null;
  if (setter) {
    setter.call(input, next);
  } else {
    input.value = next;
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findSpellSearchInput(sectionRoot) {
  if (!(sectionRoot instanceof Element)) return null;
  const inputs = Array.from(
    sectionRoot.querySelectorAll(
      'input[placeholder*="spell name" i], input[aria-label*="spell name" i], input[type="search"]',
    ),
  );
  for (const input of inputs) {
    if (!(input instanceof HTMLInputElement)) continue;
    if (!isVisible(input)) continue;
    return input;
  }
  return null;
}

async function applySpellNameFilter(sectionRoot, list, spellName) {
  const input = findSpellSearchInput(sectionRoot);
  if (!(input instanceof HTMLInputElement)) {
    debugLog('spell search input not found in scope', {
      list,
      spellName,
      scope: describeElementForLog(sectionRoot),
    });
    return false;
  }

  const previous = String(input.value || '');
  const next = String(spellName || '');
  if (previous === next) {
    debugLog('spell search input already set', { list, spellName: next });
    return true;
  }

  input.scrollIntoView({ block: 'center' });
  input.focus();
  setInputValue(input, next);
  await wait(220);
  debugLog('spell search input set', {
    list,
    previous,
    next,
  });
  return true;
}

function sampleSpellRowsInScope(sectionRoot, limit = 10) {
  if (!(sectionRoot instanceof Element)) return [];
  const rows = new Set();
  const buttons = Array.from(sectionRoot.querySelectorAll('button'));
  for (const button of buttons) {
    const actionText = getNormalizedText(button);
    if (!actionText.includes('prepare') && !actionText.includes('unprepare')) continue;
    const row = findRowContainerFromButton(button);
    if (!(row instanceof Element)) continue;
    rows.add(row);
    if (rows.size >= limit) break;
  }

  const samples = [];
  for (const row of rows) {
    const name = findSpellNameInContainer(row);
    if (!name) continue;
    samples.push(name);
  }
  return samples;
}

async function clickSpellActionInSection(sectionRoot, list, spellName, actionText) {
  debugLog('spell action lookup start', {
    list,
    actionText,
    spellName,
  });

  await applySpellNameFilter(sectionRoot, list, spellName);

  let row = findSpellRowInSection(sectionRoot, spellName);
  if (!(row instanceof Element)) {
    debugLog('spell row not found in section scope, trying global root', {
      list,
      actionText,
      spellName,
    });
    const globalRoot = getManageSpellsRoot();
    await applySpellNameFilter(globalRoot, list, spellName);
    if (globalRoot !== sectionRoot) {
      row = findSpellRowInSection(globalRoot, spellName);
    }
  }
  if (!(row instanceof Element)) {
    debugLog('spell action lookup failed: row not found', {
      list,
      actionText,
      spellName,
      scopeSampleRows: sampleSpellRowsInScope(sectionRoot),
    });
    return { ok: false, notFound: spellName };
  }

  const button = findActionButtonInRowByText(row, actionText);
  if (!(button instanceof HTMLElement)) {
    debugLog('spell action lookup failed: button not found', {
      list,
      actionText,
      spellName,
      row: describeElementForLog(row),
    });
    return { ok: false, notFound: spellName };
  }

  debugLog('spell action click', {
    list,
    actionText,
    spellName,
    button: describeElementForLog(button),
  });
  button.scrollIntoView({ block: 'center' });
  button.click();
  await wait(randomDelay(100, 240));

  await chrome.runtime.sendMessage({
    type: 'SYNC_PROGRESS',
    progress: {
      label: `${list}: ${actionText} ${spellName}`,
    },
  });

  debugLog('spell action complete', {
    list,
    actionText,
    spellName,
  });
  return { ok: true };
}

function createOpsListResult(list) {
  return {
    list,
    replaced: 0,
    prepared: 0,
    unprepared: 0,
    failed: 0,
    notFound: [],
    aborted: false,
    error: null,
  };
}

function getOrCreateOpsListResult(result, list) {
  let bucket = result.perList.find((entry) => entry.list === list);
  if (bucket) return bucket;
  bucket = createOpsListResult(list);
  result.perList.push(bucket);
  return bucket;
}

async function executeOpsOperationAcrossKnownSections(operation, sections, listLabel) {
  debugLog('operation execution start', {
    list: listLabel,
    type: operation.type,
    remove: operation.type === 'replace' ? operation.remove : undefined,
    add: operation.type === 'replace' ? operation.add : undefined,
    spell: operation.type !== 'replace' ? operation.spell : undefined,
    sectionCount: sections.length,
  });
  const sectionErrors = [];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    try {
      debugLog('operation section attempt', {
        list: listLabel,
        type: operation.type,
        sectionIndex: index,
        sectionLabel: section.label,
      });
      const expanded = await ensureKnownSpellsSectionExpanded(section);
      if (!expanded) {
        debugLog('known spells section expansion returned false', {
          list: listLabel,
          sectionIndex: index,
          sectionLabel: section.label,
        });
        sectionErrors.push(`Could not expand Known Spells section: ${section.label}`);
        await chrome.runtime.sendMessage({
          type: 'SYNC_PROGRESS',
          progress: {
            label: `Known Spells best-effort mode in section: ${section.label}`,
          },
        });
        continue;
      }
      // Filters are preconfigured in a dedicated pass, so per-op attempts are best effort.
      try {
        await ensureSourceCategoryFilterExpanded(section.scope, section.label);
      } catch {
        // Continue to spell action attempt.
        debugLog('source category expand threw; continuing', {
          list: listLabel,
          sectionIndex: index,
          sectionLabel: section.label,
        });
      }

      if (operation.type === 'replace') {
        const removeStep = await clickSpellActionInSection(section.scope, listLabel, operation.remove, 'Unprepare');
        if (!removeStep.ok) {
          debugLog('replace remove step not found in section', {
            list: listLabel,
            sectionIndex: index,
            sectionLabel: section.label,
            remove: operation.remove,
          });
          continue;
        }

        const addStep = await clickSpellActionInSection(section.scope, listLabel, operation.add, 'Prepare');
        if (!addStep.ok) {
          debugLog('replace add step failed after successful remove', {
            list: listLabel,
            sectionIndex: index,
            sectionLabel: section.label,
            add: operation.add,
          });
          return { ok: false, type: 'replace', notFound: operation.add };
        }

        debugLog('replace operation succeeded in section', {
          list: listLabel,
          sectionIndex: index,
          sectionLabel: section.label,
          remove: operation.remove,
          add: operation.add,
        });
        return { ok: true, type: 'replace' };
      }

      if (operation.type === 'prepare') {
        const step = await clickSpellActionInSection(section.scope, listLabel, operation.spell, 'Prepare');
        if (!step.ok) {
          debugLog('prepare step not found in section', {
            list: listLabel,
            sectionIndex: index,
            sectionLabel: section.label,
            spell: operation.spell,
          });
          continue;
        }
        debugLog('prepare operation succeeded in section', {
          list: listLabel,
          sectionIndex: index,
          sectionLabel: section.label,
          spell: operation.spell,
        });
        return { ok: true, type: 'prepare' };
      }

      const step = await clickSpellActionInSection(section.scope, listLabel, operation.spell, 'Unprepare');
      if (!step.ok) {
        debugLog('unprepare step not found in section', {
          list: listLabel,
          sectionIndex: index,
          sectionLabel: section.label,
          spell: operation.spell,
        });
        continue;
      }
      debugLog('unprepare operation succeeded in section', {
        list: listLabel,
        sectionIndex: index,
        sectionLabel: section.label,
        spell: operation.spell,
      });
      return { ok: true, type: 'unprepare' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error || 'Unknown section error.');
      sectionErrors.push(reason);
      debugLog('operation section threw error', {
        list: listLabel,
        sectionIndex: index,
        sectionLabel: section.label,
        error: reason,
      });
    }
  }

  // Fallback pass: try global scope if section-level runs fail.
  try {
    const globalRoot = getManageSpellsRoot();
    debugLog('operation global fallback start', {
      list: listLabel,
      type: operation.type,
      errors: sectionErrors,
    });

    if (operation.type === 'replace') {
      const removeStep = await clickSpellActionInSection(globalRoot, listLabel, operation.remove, 'Unprepare');
      if (!removeStep.ok) {
        debugLog('global fallback failed at replace remove step', {
          list: listLabel,
          remove: operation.remove,
        });
        return {
          ok: false,
          type: 'replace',
          notFound: operation.remove,
          error: sectionErrors.length
            ? `All Known Spells sections failed for operation. ${[...new Set(sectionErrors)].join(' | ')}`
            : null,
        };
      }

      const addStep = await clickSpellActionInSection(globalRoot, listLabel, operation.add, 'Prepare');
      if (!addStep.ok) {
        debugLog('global fallback failed at replace add step', {
          list: listLabel,
          add: operation.add,
        });
        return { ok: false, type: 'replace', notFound: operation.add };
      }
      debugLog('global fallback replace succeeded', {
        list: listLabel,
        remove: operation.remove,
        add: operation.add,
      });
      return { ok: true, type: 'replace' };
    }

    if (operation.type === 'prepare') {
      const step = await clickSpellActionInSection(globalRoot, listLabel, operation.spell, 'Prepare');
      if (!step.ok) {
        debugLog('global fallback prepare failed', {
          list: listLabel,
          spell: operation.spell,
        });
        return {
          ok: false,
          type: 'prepare',
          notFound: operation.spell,
          error: sectionErrors.length
            ? `All Known Spells sections failed for operation. ${[...new Set(sectionErrors)].join(' | ')}`
            : null,
        };
      }
      debugLog('global fallback prepare succeeded', {
        list: listLabel,
        spell: operation.spell,
      });
      return { ok: true, type: 'prepare' };
    }

    const step = await clickSpellActionInSection(globalRoot, listLabel, operation.spell, 'Unprepare');
    if (!step.ok) {
      debugLog('global fallback unprepare failed', {
        list: listLabel,
        spell: operation.spell,
      });
      return {
        ok: false,
        type: 'unprepare',
        notFound: operation.spell,
        error: sectionErrors.length
          ? `All Known Spells sections failed for operation. ${[...new Set(sectionErrors)].join(' | ')}`
          : null,
      };
    }
    debugLog('global fallback unprepare succeeded', {
      list: listLabel,
      spell: operation.spell,
    });
    return { ok: true, type: 'unprepare' };
  } catch (globalError) {
    if (globalError) {
      const reason = globalError instanceof Error ? globalError.message : String(globalError || 'Unknown global error.');
      sectionErrors.push(reason);
      debugLog('operation global fallback threw', {
        list: listLabel,
        error: reason,
      });
    }
  }

  if (sectionErrors.length > 0) {
    const uniqueErrors = [...new Set(sectionErrors)];
    debugLog('operation failed after all sections', {
      list: listLabel,
      type: operation.type,
      errors: uniqueErrors,
    });
    return {
      ok: false,
      type: operation.type,
      error: `All Known Spells sections failed for operation. ${uniqueErrors.join(' | ')}`,
      notFound: operation.type === 'replace' ? operation.remove : operation.spell,
    };
  }

  debugLog('operation failed: not found without explicit section errors', {
    list: listLabel,
    type: operation.type,
  });
  return {
    ok: false,
    type: operation.type,
    notFound: operation.type === 'replace' ? operation.remove : operation.spell,
  };
}

async function runOpsSync(payload) {
  const startedAt = Date.now();
  debugLog('runOpsSync start', {
    operations: payload.operations.length,
    skippedFromPayload: Array.isArray(payload.unresolved) ? payload.unresolved.length : 0,
  });
  if (payload.operations.length > MAX_ACTIONS) {
    debugLog('runOpsSync aborted: MAX_ACTIONS exceeded', {
      operations: payload.operations.length,
      max: MAX_ACTIONS,
    });
    throw new Error(`Sync aborted: required ${payload.operations.length} actions, max is ${MAX_ACTIONS}.`);
  }

  await prepareUiForManageSpells({ emitProgress: true });

  const knownSections = collectKnownSpellsSectionDescriptors();
  debugLog('known spells sections discovered', {
    count: knownSections.length,
    labels: knownSections.map((section) => section.label),
    scopes: knownSections.map((section) => ({
      label: section.label,
      clickable: describeElementForLog(section.clickable),
      scope: describeElementForLog(section.scope),
      hasFilterBySourceCategoryText: Boolean(section.scope && getNormalizedText(section.scope).includes('filter by source category')),
      hasSpellNameInput: Boolean(
        section.scope instanceof Element &&
          section.scope.querySelector('input[placeholder*="spell name" i], input[aria-label*="spell name" i]'),
      ),
    })),
  });
  if (!knownSections.length) {
    throw new Error('No Known Spells dropdowns were found in Manage Spells sidebar.');
  }

  const result = {
    mode: 'ops',
    perList: [],
    totals: {
      replaced: 0,
      prepared: 0,
      unprepared: 0,
      failed: 0,
      notFound: 0,
      operations: payload.operations.length,
    },
    skippedFromPayload: Array.isArray(payload.unresolved) ? payload.unresolved : [],
    skippedCount: Array.isArray(payload.unresolved) ? payload.unresolved.length : 0,
    alreadyCorrect: payload.operations.length === 0,
    durationMs: 0,
  };

  await chrome.runtime.sendMessage({
    type: 'SYNC_PROGRESS',
    progress: {
      label: `Found ${knownSections.length} Known Spells dropdown(s): ${describeKnownSpellsSections(knownSections)}`,
    },
  });

  const preconfigured = await preconfigureKnownSpellsFilters(knownSections);
  debugLog('known spells filters preconfigured', {
    configured: preconfigured.configured,
    failed: preconfigured.failed,
  });
  await chrome.runtime.sendMessage({
    type: 'SYNC_PROGRESS',
    progress: {
      label: preconfigured.failed.length
        ? `Known Spells filter setup: ${preconfigured.configured.length} configured, ${preconfigured.failed.length} failed`
        : `Known Spells filter setup complete: ${preconfigured.configured.length} configured`,
    },
  });

  for (const operation of payload.operations) {
    const list = normalizeListName(operation.list || 'UNKNOWN');
    const listResult = getOrCreateOpsListResult(result, list);
    debugLog('operation start', {
      list,
      type: operation.type,
      remove: operation.type === 'replace' ? operation.remove : undefined,
      add: operation.type === 'replace' ? operation.add : undefined,
      spell: operation.type !== 'replace' ? operation.spell : undefined,
    });

    const execution = await executeOpsOperationAcrossKnownSections(operation, knownSections, list);
    if (execution.ok) {
      if (execution.type === 'replace') {
        listResult.replaced += 1;
        result.totals.replaced += 1;
      } else if (execution.type === 'prepare') {
        listResult.prepared += 1;
        result.totals.prepared += 1;
      } else {
        listResult.unprepared += 1;
        result.totals.unprepared += 1;
      }
      debugLog('operation success', {
        list,
        type: execution.type,
      });
      continue;
    }

    listResult.failed += 1;
    result.totals.failed += 1;
    debugLog('operation failed', {
      list,
      type: execution.type,
      notFound: execution.notFound,
      error: execution.error,
    });

    if (execution.notFound) {
      listResult.notFound.push(execution.notFound);
      result.totals.notFound += 1;
    }

    if (execution.error) {
      listResult.aborted = true;
      listResult.error = execution.error;
    }
  }

  result.durationMs = Date.now() - startedAt;
  debugLog('runOpsSync complete', {
    durationMs: result.durationMs,
    totals: result.totals,
  });
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
    .catch((error) => {
      const detail = error instanceof Error ? error.message : String(error || 'Unknown error.');
      sendPageAck(false, `Failed to persist payload in extension storage. ${detail}`);
    });
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

  const isSyncExecute = message.type === 'SYNC_EXECUTE';
  if (isSyncExecute) {
    startDebugRun(validation.payload.version === 2 ? 'ops' : 'legacy', validation.payload);
  }

  operationInFlight = true;
  const operation = message.type === 'PREVIEW_EXECUTE'
    ? validation.payload.version === 2
      ? runOpsPreview(validation.payload)
      : runLegacyPreview(validation.payload)
    : validation.payload.version === 2
      ? runOpsSync(validation.payload)
      : runLegacySync(validation.payload);

  void operation
    .then((result) => {
      if (message.type === 'PREVIEW_EXECUTE') {
        sendResponse({ ok: true, preview: result });
      } else {
        if (result && typeof result === 'object') {
          result.debugLog = getDebugLogSnapshot();
        }
        void chrome.runtime.sendMessage({ type: 'SYNC_RESULT', result }).catch(() => {
          // Popup may be closed.
        });
        sendResponse({ ok: true, result });
      }
    })
    .catch((error) => {
      const detail = error instanceof Error ? error.message : message.type === 'PREVIEW_EXECUTE' ? 'Preview failed.' : 'Sync failed.';
      if (isSyncExecute) {
        debugLog('sync execution failed', { error: detail });
      }
      sendResponse({
        ok: false,
        error: detail,
        debugLog: isSyncExecute ? getDebugLogSnapshot() : undefined,
      });
    })
    .finally(() => {
      if (isSyncExecute) {
        clearDebugRun();
      }
      operationInFlight = false;
    });

  return true;
});

if (IS_TOP_WINDOW) {
  injectPageBridge();
}
