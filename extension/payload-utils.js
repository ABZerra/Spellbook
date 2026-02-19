const ALLOWED_UNRESOLVED_CODES = new Set([
  'AMBIGUOUS_LIST',
  'MISSING_SPELL',
  'MISSING_NAME',
  'LIST_MISMATCH',
]);

function asString(value) {
  return String(value ?? '').trim();
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpellNameForKey(name) {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '');
}

function normalizePreparedSpells(values) {
  const seen = new Set();
  const preparedSpells = [];

  for (const value of values) {
    const name = normalizeWhitespace(value);
    if (!name) continue;
    const key = normalizeSpellNameForKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    preparedSpells.push(name);
  }

  return preparedSpells;
}

function normalizeListName(list) {
  return normalizeWhitespace(list).toUpperCase();
}

function normalizeUnresolvedEntry(entry, index) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`unresolved[${index}] must be an object.`);
  }

  const code = asString(entry.code).toUpperCase();
  if (!ALLOWED_UNRESOLVED_CODES.has(code)) {
    throw new Error(`unresolved[${index}].code is invalid.`);
  }

  const detail = normalizeWhitespace(entry.detail);
  if (!detail) {
    throw new Error(`unresolved[${index}].detail is required.`);
  }

  const changeIndex = Number(entry.changeIndex);
  if (!Number.isInteger(changeIndex) || changeIndex < 0) {
    throw new Error(`unresolved[${index}].changeIndex must be a non-negative integer.`);
  }

  return { code, detail, changeIndex };
}

function normalizeSpellOp(op, index) {
  if (!op || typeof op !== 'object') {
    throw new Error(`operations[${index}] must be an object.`);
  }

  const type = asString(op.type).toLowerCase();
  if (!['replace', 'prepare', 'unprepare'].includes(type)) {
    throw new Error(`operations[${index}].type must be replace, prepare, or unprepare.`);
  }

  const list = normalizeListName(op.list);
  if (!list) {
    throw new Error(`operations[${index}].list is required.`);
  }

  if (type === 'replace') {
    const remove = normalizeWhitespace(op.remove);
    const add = normalizeWhitespace(op.add);
    if (!remove) {
      throw new Error(`operations[${index}].remove is required for replace.`);
    }
    if (!add) {
      throw new Error(`operations[${index}].add is required for replace.`);
    }
    return { type, list, remove, add };
  }

  const spell = normalizeWhitespace(op.spell);
  if (!spell) {
    throw new Error(`operations[${index}].spell is required for ${type}.`);
  }

  return { type, list, spell };
}

function parseV1Payload(input, base) {
  if (!Array.isArray(input.preparedSpells)) {
    throw new Error('preparedSpells must be an array.');
  }

  return {
    ...base,
    version: 1,
    preparedSpells: normalizePreparedSpells(input.preparedSpells),
  };
}

function parseV2Payload(input, base) {
  if (!Array.isArray(input.operations)) {
    throw new Error('operations must be an array.');
  }

  const operations = input.operations.map((op, index) => normalizeSpellOp(op, index));

  let unresolved = [];
  if (input.unresolved !== undefined) {
    if (!Array.isArray(input.unresolved)) {
      throw new Error('unresolved must be an array when provided.');
    }
    unresolved = input.unresolved.map((entry, index) => normalizeUnresolvedEntry(entry, index));
  }

  return {
    ...base,
    version: 2,
    operations,
    unresolved,
  };
}

export function parseSyncPayload(input) {
  try {
    if (!input || typeof input !== 'object') {
      throw new Error('Payload must be an object.');
    }

    if (input.source !== 'spellbook') {
      throw new Error('Payload source must be spellbook.');
    }

    const timestamp = Number(input.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      throw new Error('timestamp must be a positive number.');
    }

    const base = {
      source: 'spellbook',
      timestamp,
    };

    if (input.characterId !== undefined && input.characterId !== null) {
      base.characterId = String(input.characterId);
    }

    const version = Number(input.version);
    if (version === 1) {
      return { ok: true, payload: parseV1Payload(input, base) };
    }

    if (version === 2) {
      return { ok: true, payload: parseV2Payload(input, base) };
    }

    throw new Error('Payload version must be 1 or 2.');
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid payload.',
    };
  }
}

export function summarizeOpsPreview(payloadV2) {
  if (!payloadV2 || payloadV2.version !== 2 || !Array.isArray(payloadV2.operations)) {
    throw new Error('summarizeOpsPreview requires a version 2 payload.');
  }

  const perListMap = new Map();
  const totals = {
    replace: 0,
    prepare: 0,
    unprepare: 0,
    operations: payloadV2.operations.length,
  };

  for (const operation of payloadV2.operations) {
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

  const skippedFromPayload = Array.isArray(payloadV2.unresolved) ? payloadV2.unresolved : [];

  return {
    mode: 'ops',
    perList: [...perListMap.values()],
    totals,
    actionCount: totals.operations,
    listCount: perListMap.size,
    skippedFromPayload,
    skippedCount: skippedFromPayload.length,
    alreadyCorrect: totals.operations === 0,
    durationMs: 0,
  };
}

export function extractDndBeyondCharacterId(urlValue) {
  if (!urlValue) return null;

  let parsedUrl;
  try {
    parsedUrl = new URL(urlValue);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'https:') return null;
  if (parsedUrl.hostname.toLowerCase() !== 'www.dndbeyond.com') return null;

  const parts = parsedUrl.pathname.split('/').filter(Boolean);

  if (parts[0] === 'characters') {
    const id = parts[1] || '';
    if (!/^\d+$/.test(id)) return null;
    if (parts.length === 2) return id;
    if (parts.length === 3 && parts[2] === 'edit') return id;
    return null;
  }

  if (parts[0] === 'profile') {
    const user = parts[1] || '';
    const marker = parts[2] || '';
    const id = parts[3] || '';
    if (!user || marker !== 'characters' || !/^\d+$/.test(id)) return null;
    if (parts.length === 4) return id;
    if (parts.length === 5 && parts[4] === 'edit') return id;
    return null;
  }

  return null;
}

export function isDndBeyondCharacterUrl(urlValue) {
  return Boolean(extractDndBeyondCharacterId(urlValue));
}
