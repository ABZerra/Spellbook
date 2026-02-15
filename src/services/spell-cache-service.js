import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  return dir;
}

export function createSpellCacheService({
  repo,
  refreshIntervalMs = 30_000,
  cachePath = null,
  logger = console,
}) {
  if (!repo || typeof repo.listSpells !== 'function') {
    throw new Error('Spell cache service requires a repo with listSpells().');
  }

  let spells = [];
  let updatedAt = null;
  let stale = true;
  let lastError = null;
  let timer = null;

  function syncMeta() {
    return {
      source: repo.kind === 'notion' ? 'notion-cache' : 'json',
      cacheUpdatedAt: updatedAt,
      stale,
      lastError: lastError ? String(lastError.message || lastError) : null,
    };
  }

  function persistSnapshot() {
    if (!cachePath) return;

    const payload = {
      updatedAt,
      spells,
    };

    const targetDir = ensureDirForFile(cachePath);
    if (!existsSync(targetDir)) return;

    const tmpPath = `${cachePath}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    renameSync(tmpPath, cachePath);
  }

  function loadSnapshot() {
    if (!cachePath || !existsSync(cachePath)) return;

    try {
      const parsed = JSON.parse(readFileSync(cachePath, 'utf8'));
      if (!Array.isArray(parsed?.spells)) return;
      spells = parsed.spells;
      updatedAt = parsed.updatedAt || null;
      stale = true;
    } catch (error) {
      logger.warn?.('Unable to load spell cache snapshot:', error.message || error);
    }
  }

  async function refreshNow() {
    try {
      const fresh = await repo.listSpells();
      spells = Array.isArray(fresh) ? fresh : [];
      updatedAt = new Date().toISOString();
      stale = false;
      lastError = null;
      persistSnapshot();
    } catch (error) {
      stale = true;
      lastError = error;
      if (!updatedAt) {
        throw error;
      }
      logger.warn?.('Spell cache refresh failed; serving stale cache:', error.message || error);
    }

    return {
      spells: clone(spells),
      syncMeta: syncMeta(),
    };
  }

  return {
    async start() {
      loadSnapshot();
      await refreshNow();
      if (refreshIntervalMs > 0) {
        timer = setInterval(() => {
          refreshNow().catch((error) => {
            logger.warn?.('Periodic spell refresh failed:', error.message || error);
          });
        }, refreshIntervalMs);
      }
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    async refreshNow() {
      return refreshNow();
    },
    getSnapshot() {
      return {
        spells: clone(spells),
        syncMeta: syncMeta(),
      };
    },
  };
}
