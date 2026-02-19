const SYNC_PAYLOAD_STORAGE_KEY = 'spellbook.syncPayload.v1';
const DDB_CHARACTER_URL_REGEX = /^https:\/\/www\.dndbeyond\.com\/(?:[^/?#]+\/)*characters\/(\d+)(?:\/edit)?(?:[/?#]|$)/i;
const SPELLBOOK_API_BASES = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function extractCharacterIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(DDB_CHARACTER_URL_REGEX);
  return match ? match[1] : null;
}

function isDndBeyondCharacterUrl(url) {
  return Boolean(extractCharacterIdFromUrl(url));
}

function isValidPayload(payload) {
  return Boolean(
    payload &&
      payload.version === 1 &&
      payload.source === 'spellbook' &&
      typeof payload.timestamp === 'number' &&
      Array.isArray(payload.preparedSpells),
  );
}

async function getPayload() {
  const stored = await chrome.storage.local.get(SYNC_PAYLOAD_STORAGE_KEY);
  return stored[SYNC_PAYLOAD_STORAGE_KEY] || null;
}

function dedupeSpellNames(spellNames) {
  const seen = new Set();
  const output = [];
  for (const name of spellNames) {
    const raw = String(name || '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(raw);
  }
  return output;
}

async function fetchJsonFromSpellbook(pathname) {
  let lastError = null;
  for (const baseUrl of SPELLBOOK_API_BASES) {
    try {
      const response = await fetch(`${baseUrl}${pathname}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${pathname} at ${baseUrl}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Unable to fetch ${pathname} from local Spellbook API.`);
}

async function hydratePayloadFromSpellbookApi() {
  const [config, spellsPayload] = await Promise.all([
    fetchJsonFromSpellbook('/api/config'),
    fetchJsonFromSpellbook('/api/spells'),
  ]);

  const spells = Array.isArray(spellsPayload?.spells) ? spellsPayload.spells : [];
  const preparedSpells = dedupeSpellNames(
    spells.filter((spell) => Boolean(spell?.prepared)).map((spell) => spell?.name),
  );

  const payload = {
    version: 1,
    preparedSpells,
    timestamp: Date.now(),
    source: 'spellbook',
  };

  if (config?.characterId) {
    payload.characterId = String(config.characterId);
  }

  await chrome.storage.local.set({ [SYNC_PAYLOAD_STORAGE_KEY]: payload });
  return payload;
}

async function getPayloadWithFallback() {
  const storedPayload = await getPayload();
  if (isValidPayload(storedPayload)) {
    return { payload: storedPayload, hydrated: false, payloadError: null };
  }

  try {
    const hydratedPayload = await hydratePayloadFromSpellbookApi();
    if (isValidPayload(hydratedPayload)) {
      return { payload: hydratedPayload, hydrated: true, payloadError: null };
    }
    return { payload: null, hydrated: false, payloadError: 'Hydrated Spellbook payload is invalid.' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error.';
    return {
      payload: null,
      hydrated: false,
      payloadError: `No Spellbook payload available yet. Local API fallback failed: ${detail}`,
    };
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function buildPopupStatus() {
  const tab = await getActiveTab();
  const payloadState = await getPayloadWithFallback();
  const payload = payloadState.payload;
  const tabUrl = tab?.url || '';
  const tabCharacterId = extractCharacterIdFromUrl(tabUrl);
  const ddbCharacterPage = isDndBeyondCharacterUrl(tabUrl);

  return {
    ok: true,
    tab: {
      id: tab?.id ?? null,
      url: tabUrl || null,
      ddbCharacterPage,
      characterId: tabCharacterId,
    },
    payload: isValidPayload(payload)
      ? {
          preparedSpells: payload.preparedSpells,
          timestamp: payload.timestamp,
          characterId: payload?.characterId ? String(payload.characterId) : null,
          source: payload.source,
          version: payload.version,
        }
      : null,
    payloadError: payloadState.payloadError,
    hydrated: payloadState.hydrated,
  };
}

async function handleSyncRequest() {
  const tab = await getActiveTab();
  if (!tab || typeof tab.id !== 'number') {
    return { ok: false, error: 'No active tab found.' };
  }

  const url = tab.url || '';
  const tabCharacterId = extractCharacterIdFromUrl(url);
  if (!tabCharacterId) {
    return {
      ok: false,
      error: 'Active tab is not a D&D Beyond character page.',
      tabUrl: url || null,
    };
  }

  const payloadState = await getPayloadWithFallback();
  const payload = payloadState.payload;
  if (!payload) {
    return { ok: false, error: payloadState.payloadError || 'No Spellbook payload found.' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'SYNC_EXECUTE',
      payload,
      context: {
        tabUrl: url,
        tabCharacterId,
      },
    });

    if (!response || !response.ok) {
      return {
        ok: false,
        error: response?.error || 'Sync did not return a successful result.',
      };
    }

    return {
      ok: true,
      result: response.result,
    };
  } catch {
    return {
      ok: false,
      error: 'Unable to reach content script. Refresh the D&D Beyond tab and try again.',
    };
  }
}

async function handlePreviewRequest() {
  const tab = await getActiveTab();
  if (!tab || typeof tab.id !== 'number') {
    return { ok: false, error: 'No active tab found.' };
  }

  const url = tab.url || '';
  const tabCharacterId = extractCharacterIdFromUrl(url);
  if (!tabCharacterId) {
    return {
      ok: false,
      error: 'Active tab is not a D&D Beyond character page.',
      tabUrl: url || null,
    };
  }

  const payloadState = await getPayloadWithFallback();
  const payload = payloadState.payload;
  if (!payload) {
    return { ok: false, error: payloadState.payloadError || 'No Spellbook payload found.' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'PREVIEW_EXECUTE',
      payload,
      context: {
        tabUrl: url,
        tabCharacterId,
      },
    });

    if (!response || !response.ok) {
      return {
        ok: false,
        error: response?.error || 'Preview did not return a successful result.',
      };
    }

    return {
      ok: true,
      preview: response.preview,
    };
  } catch {
    return {
      ok: false,
      error: 'Unable to reach content script. Refresh the D&D Beyond tab and try again.',
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    sendResponse({ ok: false, error: 'Invalid message.' });
    return;
  }

  if (message.type === 'POPUP_INIT') {
    void buildPopupStatus().then(sendResponse);
    return true;
  }

  if (message.type === 'SYNC_REQUEST') {
    void handleSyncRequest().then(sendResponse);
    return true;
  }

  if (message.type === 'PREVIEW_REQUEST') {
    void handlePreviewRequest().then(sendResponse);
    return true;
  }

  if (message.type === 'SYNC_PROGRESS' || message.type === 'SYNC_RESULT') {
    if (sender?.tab?.id) {
      chrome.runtime.sendMessage(message).catch(() => {
        // Popup may be closed.
      });
    }
    sendResponse({ ok: true });
    return;
  }

  sendResponse({ ok: false, error: `Unknown message type: ${String(message.type)}` });
});
