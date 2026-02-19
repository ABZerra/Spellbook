(() => {
  if (window.__SPELLBOOK_SYNC_BRIDGE__) return;

  window.__SPELLBOOK_SYNC_BRIDGE__ = {
    version: 1,
    readyAt: Date.now(),
  };
})();
