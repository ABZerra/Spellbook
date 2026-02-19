import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyPendingChangesToNextList,
  applySingleDiff,
  buildSlotsFromCurrent,
  computeDiffFromLists,
  diffToPendingChanges,
  generateActionId,
  rebaseDraftFromCurrentPrepared,
} from '../domain/planner';
import {
  mapApiPendingToUiPending,
  mapApiSpellToUiSpell,
  mapUiPendingToApiPending,
} from '../mappers/spellMappers';
import {
  applyPatchToSpell,
  clearLocalPending,
  clearLocalPatches,
  getLocalPatches,
  getLocalPendingDraft,
  getLocalPending,
  getLocalPrepared,
  setLocalPendingDraft,
  setLocalPending,
  setLocalPatches,
  setLocalPrepared,
} from '../services/localFallbackService';
import {
  appendPendingChange,
  applyOnePendingChange,
  applyPendingPlan,
  clearPendingPlan,
  getPendingPlan,
  setPendingPlan,
} from '../services/pendingPlanService';
import { signIn, signOut, signUp, switchCharacter } from '../services/sessionService';
import { createSpell as createSpellRequest, deleteSpell as deleteSpellRequest, listSpells, syncSpells, updateSpell as updateSpellRequest } from '../services/spellService';
import type { SpellSyncPayload } from '../services/extensionSyncService';
import { buildSpellSyncPayload, publishSpellSyncPayload } from '../services/extensionSyncService';
import type { ConfigResponse } from '../types/api';
import type { ApiPendingChange } from '../types/api';
import type { ApiSpell, AppMode, CharacterSummary, DiffItem, SlotDraft, UiPendingAction, UiSpell, UiSpellDraft } from '../types/spell';

interface AppContextType {
  loading: boolean;
  error: string | null;
  spells: UiSpell[];
  mode: AppMode;
  currentCharacter: CharacterSummary | null;
  characters: CharacterSummary[];
  userId: string | null;
  displayName: string | null;
  authenticated: boolean;
  saveMode: 'remote' | 'local';
  currentList: string[];
  nextList: SlotDraft[];
  diff: DiffItem[];
  draftSaveStatus: 'idle' | 'saved' | 'error';
  draftSaveTick: number;

  setCharacterId: (characterId: string) => Promise<void>;
  refreshNow: () => Promise<void>;
  resetLocalDrafts: () => void;

  signUp: (userId: string, displayName?: string) => Promise<void>;
  signIn: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;

  createSpell: (draft: UiSpellDraft) => Promise<void>;
  updateSpell: (spellId: string, draft: UiSpellDraft) => Promise<void>;
  deleteSpell: (spellId: string) => Promise<void>;
  togglePrepared: (spellId: string) => Promise<void>;

  queuePendingAction: (action: Omit<UiPendingAction, 'id'>) => Promise<void>;
  removePendingAction: (actionId: string) => Promise<void>;
  clearPendingActions: () => Promise<void>;
  applyPendingActions: () => Promise<void>;
  setNextSlot: (index: number, spellId: string | null, note?: string) => Promise<void>;
  setSlotNote: (index: number, note: string) => Promise<void>;
  applyOne: (diffItem: DiffItem) => Promise<void>;
  applyAll: () => Promise<SpellSyncPayload>;
}

const AppContext = createContext<AppContextType | null>(null);

const CHARACTER_KEY = 'spellbook.currentCharacter.v1';

function normalizeCharacterId(value: string | null | undefined, fallback: string): string {
  const next = String(value || '').trim();
  if (!next) return fallback;
  if (!/^[A-Za-z0-9_.-]{2,64}$/.test(next)) return fallback;
  return next;
}

function parseListInput(input: string): string[] {
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeNote(note?: string): string | undefined {
  const normalized = String(note ?? '').trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 500);
}

function pendingChangesToDiff(changes: ApiPendingChange[]): DiffItem[] {
  const diff: DiffItem[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];
    const note = normalizeNote(change.note);

    if (change.type === 'replace') {
      if (!change.spellId || !change.replacementSpellId) continue;
      diff.push({
        action: 'replace',
        index,
        fromSpellId: change.spellId,
        toSpellId: change.replacementSpellId,
        note,
      });
      continue;
    }

    if (change.type === 'add') {
      if (!change.spellId) continue;
      diff.push({
        action: 'add',
        index,
        toSpellId: change.spellId,
        note,
      });
      continue;
    }

    if (!change.spellId) continue;
    diff.push({
      action: 'remove',
      index,
      fromSpellId: change.spellId,
      note,
    });
  }

  return diff;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>({
    remotePendingPlanEnabled: false,
    spellsBackend: 'json',
    allowLocalDraftEdits: true,
    staticDataMode: false,
  });
  const [saveMode, setSaveMode] = useState<'remote' | 'local'>('remote');
  const [defaultCharacterId, setDefaultCharacterId] = useState('default-character');
  const [characterId, setCharacterIdState] = useState('default-character');
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const [apiSpells, setApiSpells] = useState<ApiSpell[]>([]);
  const [preparedSpellIds, setPreparedSpellIds] = useState<string[]>([]);
  const [pendingActions, setPendingActions] = useState<UiPendingAction[]>([]);
  const [pendingVersion, setPendingVersion] = useState(1);
  const [nextList, setNextList] = useState<SlotDraft[]>([]);
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [draftSaveTick, setDraftSaveTick] = useState(0);

  const loadConfig = useCallback(async (): Promise<ConfigResponse> => {
    let payload: ConfigResponse;
    try {
      const response = await fetch('/api/config', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to load configuration.');
      }
      payload = (await response.json()) as ConfigResponse;
    } catch {
      const fallbackCharacterId = normalizeCharacterId(
        localStorage.getItem(CHARACTER_KEY),
        defaultCharacterId,
      );
      payload = {
        remotePendingPlanEnabled: false,
        defaultCharacterId,
        characterId: fallbackCharacterId,
        authenticated: false,
        userId: null,
        displayName: null,
        spellsBackend: 'json',
        allowLocalDraftEdits: true,
      };
    }
    setMode({
      remotePendingPlanEnabled: Boolean(payload.remotePendingPlanEnabled),
      spellsBackend: String(payload.spellsBackend || 'json'),
      allowLocalDraftEdits: Boolean(payload.allowLocalDraftEdits),
      staticDataMode: false,
    });
    setDefaultCharacterId(payload.defaultCharacterId || 'default-character');
    setCharacterIdState(normalizeCharacterId(payload.characterId, payload.defaultCharacterId || 'default-character'));
    setAuthenticated(Boolean(payload.authenticated));
    setUserId(payload.userId || null);
    setDisplayName(payload.displayName || null);
    return payload;
  }, []);

  const loadSpells = useCallback(async (nextCharacterId: string, nextUserId: string | null, nextMode: AppMode) => {
    try {
      const payload = await listSpells();
      let spells = payload.spells;

      if (!nextMode.remotePendingPlanEnabled) {
        const patches = getLocalPatches(nextUserId, nextCharacterId);
        spells = spells.map((spell) => applyPatchToSpell(spell, patches[spell.id]));

        const defaultPreparedIds = spells.filter((spell) => spell.prepared).map((spell) => spell.id);
        const localPrepared = getLocalPrepared(nextUserId, nextCharacterId, defaultPreparedIds);
        spells = spells.map((spell) => ({ ...spell, prepared: localPrepared.has(spell.id) }));
      }

      setApiSpells(spells);
      setMode((current) => ({ ...current, staticDataMode: false }));
      setSaveMode('remote');
      return spells;
    } catch {
      // Fall through to static fallback.
    }

    const staticResponse = await fetch(`${import.meta.env.BASE_URL}spells.json`, { cache: 'no-store' });
    if (!staticResponse.ok) {
      throw new Error('Unable to load spells from API or static fallback.');
    }

    const staticPayload = await staticResponse.json();
    const baseSpells: ApiSpell[] = Array.isArray(staticPayload?.spells) ? staticPayload.spells : [];
    const patches = getLocalPatches(nextUserId, nextCharacterId);
    const patchedSpells = baseSpells.map((spell) => applyPatchToSpell(spell, patches[spell.id]));
    const defaults = patchedSpells.filter((spell) => spell.prepared).map((spell) => spell.id);
    const localPrepared = getLocalPrepared(nextUserId, nextCharacterId, defaults);

    const spells = patchedSpells.map((spell) => ({ ...spell, prepared: localPrepared.has(spell.id) }));
    setApiSpells(spells);
    setMode((current) => ({ ...current, staticDataMode: true }));
    setSaveMode('local');
    return spells;
  }, []);

  const loadPendingActions = useCallback(
    async (
      nextCharacterId: string,
      nextUserId: string | null,
      remoteEnabled: boolean,
      isAuthenticated: boolean,
      currentPreparedIds: string[],
    ) => {
      if (remoteEnabled && isAuthenticated) {
        const payload = await getPendingPlan(nextCharacterId);
        const uiPending = mapApiPendingToUiPending(payload.plan.changes);
        setPendingActions(uiPending);
        setPendingVersion(payload.plan.version);
        setPreparedSpellIds(payload.activeSpellIds);
        setNextList(applyPendingChangesToNextList(payload.activeSpellIds, payload.plan.changes));
        return;
      }

      const draftPayload = getLocalPendingDraft(nextUserId, nextCharacterId);
      if (draftPayload) {
        setPreparedSpellIds(currentPreparedIds);
        setNextList(draftPayload.nextList);
        const draftDiff = computeDiffFromLists(buildSlotsFromCurrent(currentPreparedIds), draftPayload.nextList);
        setPendingActions(mapApiPendingToUiPending(diffToPendingChanges(draftDiff)));
        setPendingVersion(1);
        return;
      }

      const localChanges = getLocalPending(nextUserId, nextCharacterId);
      setPreparedSpellIds(currentPreparedIds);
      const migratedNext = applyPendingChangesToNextList(currentPreparedIds, localChanges);
      setLocalPendingDraft(nextUserId, nextCharacterId, migratedNext);
      setPendingActions(mapApiPendingToUiPending(localChanges));
      setPendingVersion(1);
      setNextList(migratedNext);
    },
    [],
  );

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const config = await loadConfig();
      const localCharacterId = normalizeCharacterId(localStorage.getItem(CHARACTER_KEY), config.defaultCharacterId || 'default-character');
      const activeCharacterId = config.remotePendingPlanEnabled
        ? normalizeCharacterId(config.characterId, config.defaultCharacterId || 'default-character')
        : localCharacterId;

      setCharacterIdState(activeCharacterId);
      if (!config.remotePendingPlanEnabled) {
        localStorage.setItem(CHARACTER_KEY, activeCharacterId);
      }

      const nextMode: AppMode = {
        remotePendingPlanEnabled: Boolean(config.remotePendingPlanEnabled),
        spellsBackend: String(config.spellsBackend || 'json'),
        allowLocalDraftEdits: Boolean(config.allowLocalDraftEdits),
        staticDataMode: false,
      };

      const loadedSpells = await loadSpells(activeCharacterId, config.userId, nextMode);
      const currentPreparedIds = loadedSpells.filter((spell) => spell.prepared).map((spell) => spell.id);
      await loadPendingActions(
        activeCharacterId,
        config.userId,
        nextMode.remotePendingPlanEnabled,
        Boolean(config.authenticated),
        currentPreparedIds,
      );
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Failed to initialize app.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [loadConfig, loadPendingActions, loadSpells, mode.remotePendingPlanEnabled]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const spells = useMemo(() => apiSpells.map(mapApiSpellToUiSpell), [apiSpells]);

  const currentList = useMemo(() => preparedSpellIds, [preparedSpellIds]);
  const diff = useMemo(
    () => computeDiffFromLists(buildSlotsFromCurrent(currentList), nextList),
    [currentList, nextList],
  );

  const currentCharacter: CharacterSummary | null = useMemo(
    () => ({
      id: characterId,
      name: characterId,
      preparedSpellIds,
      pendingActions,
      nextList,
    }),
    [characterId, nextList, pendingActions, preparedSpellIds],
  );

  const setCharacterId = useCallback(
    async (nextCharacterIdRaw: string) => {
      const nextCharacterId = normalizeCharacterId(nextCharacterIdRaw, defaultCharacterId);
      if (mode.remotePendingPlanEnabled) {
        if (!authenticated) {
          throw new Error('Sign in is required before switching characters in remote mode.');
        }
        await switchCharacter(nextCharacterId);
      } else {
        localStorage.setItem(CHARACTER_KEY, nextCharacterId);
      }

      setCharacterIdState(nextCharacterId);
      const loadedSpells = await loadSpells(nextCharacterId, userId, mode);
      const currentPreparedIds = loadedSpells.filter((spell) => spell.prepared).map((spell) => spell.id);
      await loadPendingActions(nextCharacterId, userId, mode.remotePendingPlanEnabled, authenticated, currentPreparedIds);
    },
    [authenticated, defaultCharacterId, loadPendingActions, loadSpells, mode, userId],
  );

  const refreshNow = useCallback(async () => {
    try {
      await syncSpells();
    } catch {
      // Manual sync is best effort; fallback is plain reload.
    }

    const loadedSpells = await loadSpells(characterId, userId, mode);
    const currentPreparedIds = loadedSpells.filter((spell) => spell.prepared).map((spell) => spell.id);
    await loadPendingActions(characterId, userId, mode.remotePendingPlanEnabled, authenticated, currentPreparedIds);
  }, [authenticated, characterId, loadPendingActions, loadSpells, mode, userId]);

  const resetLocalDrafts = useCallback(() => {
    clearLocalPatches(userId, characterId);
    if (!mode.remotePendingPlanEnabled) {
      setSaveMode('remote');
    }
  }, [characterId, mode.remotePendingPlanEnabled, userId]);

  const updateLocalFallbackPatch = useCallback(
    (spellId: string, patch: Partial<ApiSpell>) => {
      const patches = getLocalPatches(userId, characterId);
      const merged = { ...(patches[spellId] || {}), ...patch };
      patches[spellId] = merged;
      setLocalPatches(userId, characterId, patches);
      setApiSpells((current) =>
        current.map((spell) => (spell.id === spellId ? applyPatchToSpell(spell, patch) : spell)),
      );
      setSaveMode('local');
    },
    [characterId, userId],
  );

  const createSpell = useCallback(
    async (draft: UiSpellDraft) => {
      if (!draft.id || !draft.name) {
        throw new Error('Spell ID and name are required.');
      }
      if (typeof draft.level !== 'number') {
        throw new Error('Level is required.');
      }

      const response = await createSpellRequest(draft);
      setApiSpells((current) => [...current, response.spell]);
    },
    [],
  );

  const updateSpell = useCallback(
    async (spellId: string, draft: UiSpellDraft) => {
      const payload = draft;
      try {
        const response = await updateSpellRequest(spellId, payload);
        setApiSpells((current) => current.map((spell) => (spell.id === spellId ? response.spell : spell)));
      } catch (nextError) {
        if (!mode.allowLocalDraftEdits) {
          throw nextError;
        }

        updateLocalFallbackPatch(spellId, payload);
      }
    },
    [mode.allowLocalDraftEdits, updateLocalFallbackPatch],
  );

  const deleteSpell = useCallback(async (spellId: string) => {
    await deleteSpellRequest(spellId);
    setApiSpells((current) => current.filter((spell) => spell.id !== spellId));
  }, []);

  const togglePrepared = useCallback(
    async (spellId: string) => {
      const spell = apiSpells.find((entry) => entry.id === spellId);
      if (!spell) return;

      const nextPrepared = !Boolean(spell.prepared);
      const syncLocalDraftAfterPreparedToggle = (nextPreparedIds: string[]) => {
        if (mode.remotePendingPlanEnabled) return;
        const { nextList: nextDraft } = rebaseDraftFromCurrentPrepared(nextPreparedIds);
        clearLocalPending(userId, characterId);
        setLocalPendingDraft(userId, characterId, nextDraft);
        setPendingActions([]);
        setPendingVersion(1);
        setNextList(nextDraft);
        setDraftSaveStatus('idle');
        setDraftSaveTick(0);
      };

      try {
        const response = await updateSpellRequest(spellId, { prepared: nextPrepared });
        setApiSpells((current) => current.map((entry) => (entry.id === spellId ? response.spell : entry)));
        const nextPreparedIds = nextPrepared
          ? preparedSpellIds.includes(spellId)
            ? preparedSpellIds
            : [...preparedSpellIds, spellId]
          : preparedSpellIds.filter((id) => id !== spellId);
        setPreparedSpellIds(nextPreparedIds);
        syncLocalDraftAfterPreparedToggle(nextPreparedIds);
      } catch (nextError) {
        if (!mode.allowLocalDraftEdits) {
          throw nextError;
        }

        const defaultPreparedIds = apiSpells.filter((entry) => entry.prepared).map((entry) => entry.id);
        const localPrepared = getLocalPrepared(userId, characterId, defaultPreparedIds);
        if (nextPrepared) {
          localPrepared.add(spellId);
        } else {
          localPrepared.delete(spellId);
        }

        setLocalPrepared(userId, characterId, localPrepared);
        updateLocalFallbackPatch(spellId, { prepared: nextPrepared });
        const nextPreparedIds = [...localPrepared];
        setPreparedSpellIds(nextPreparedIds);
        syncLocalDraftAfterPreparedToggle(nextPreparedIds);
      }
    },
    [
      apiSpells,
      characterId,
      mode.allowLocalDraftEdits,
      mode.remotePendingPlanEnabled,
      preparedSpellIds,
      updateLocalFallbackPatch,
      userId,
    ],
  );

  const persistLocalDraft = useCallback(
    (draftSlots: SlotDraft[], changes: ApiPendingChange[]) => {
      setLocalPendingDraft(userId, characterId, draftSlots);
      setLocalPending(userId, characterId, changes);
      setPendingActions(mapApiPendingToUiPending(changes));
      setPendingVersion(1);
      setSaveMode('local');
      setDraftSaveStatus('saved');
      setDraftSaveTick((tick) => tick + 1);
    },
    [characterId, userId],
  );

  const persistDraft = useCallback(
    async (draftSlots: SlotDraft[]) => {
      setNextList(draftSlots);

      const draftDiff = computeDiffFromLists(buildSlotsFromCurrent(preparedSpellIds), draftSlots);
      const nextChanges = diffToPendingChanges(draftDiff);
      setPendingActions(mapApiPendingToUiPending(nextChanges));
      setDraftSaveStatus('idle');

      if (mode.remotePendingPlanEnabled && authenticated) {
        try {
          const payload = await setPendingPlan(characterId, pendingVersion, nextChanges);
          setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
          setPendingVersion(payload.plan.version);
          setNextList(applyPendingChangesToNextList(preparedSpellIds, payload.plan.changes));
          setDraftSaveStatus('saved');
          setDraftSaveTick((tick) => tick + 1);
          return;
        } catch (nextError) {
          setDraftSaveStatus('error');
          throw nextError;
        }
      }

      persistLocalDraft(draftSlots, nextChanges);
    },
    [
      authenticated,
      characterId,
      mode.remotePendingPlanEnabled,
      pendingVersion,
      persistLocalDraft,
      preparedSpellIds,
    ],
  );

  const setNextSlot = useCallback(
    async (index: number, spellId: string | null, note?: string) => {
      const nextDraft = nextList.map((slot) => ({ ...slot }));
      while (nextDraft.length <= index) nextDraft.push({ spellId: null });
      nextDraft[index] = {
        spellId,
        note: normalizeNote(note),
      };
      await persistDraft(nextDraft);
    },
    [nextList, persistDraft],
  );

  const setSlotNote = useCallback(
    async (index: number, note: string) => {
      const nextDraft = nextList.map((slot) => ({ ...slot }));
      while (nextDraft.length <= index) nextDraft.push({ spellId: null });
      nextDraft[index] = {
        ...nextDraft[index],
        note: normalizeNote(note),
      };
      await persistDraft(nextDraft);
    },
    [nextList, persistDraft],
  );

  const applyOne = useCallback(
    async (diffItem: DiffItem) => {
      const change = diffToPendingChanges([diffItem])[0];
      if (!change) {
        return;
      }

      const nextCurrentSlots = applySingleDiff(buildSlotsFromCurrent(preparedSpellIds), diffItem);
      const remainingDraft = nextList.map((slot) => ({ ...slot }));
      while (remainingDraft.length <= diffItem.index) {
        remainingDraft.push({ spellId: null });
      }
      remainingDraft[diffItem.index] = {
        spellId: nextCurrentSlots[diffItem.index]?.spellId ?? null,
      };

      if (mode.remotePendingPlanEnabled && authenticated) {
        const payload = await applyOnePendingChange(characterId, pendingVersion, change);
        setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
        setPendingVersion(payload.plan.version);
        setApiSpells((current) =>
          current.map((spell) => ({
            ...spell,
            prepared: payload.activeSpellIds.includes(spell.id),
          })),
        );
        setPreparedSpellIds(payload.activeSpellIds);
        setNextList(remainingDraft);
        return;
      }

      const nextCurrentPrepared = nextCurrentSlots
        .map((slot) => slot.spellId)
        .filter((spellId): spellId is string => Boolean(spellId));
      const nextCurrentSet = new Set(nextCurrentPrepared);
      setApiSpells((current) => current.map((spell) => ({ ...spell, prepared: nextCurrentSet.has(spell.id) })));
      setLocalPrepared(userId, characterId, nextCurrentSet);
      setPreparedSpellIds(nextCurrentPrepared);
      const nextDiff = computeDiffFromLists(buildSlotsFromCurrent(nextCurrentPrepared), remainingDraft);
      const nextChanges = diffToPendingChanges(nextDiff);
      persistLocalDraft(remainingDraft, nextChanges);
      setNextList(remainingDraft);
    },
    [
      authenticated,
      characterId,
      mode.remotePendingPlanEnabled,
      nextList,
      pendingVersion,
      persistLocalDraft,
      preparedSpellIds,
      userId,
    ],
  );

  const applyAll = useCallback(async () => {
    let syncDiff = diff;

    if (mode.remotePendingPlanEnabled && authenticated) {
      try {
        const pendingPlan = await getPendingPlan(characterId);
        syncDiff = pendingChangesToDiff(pendingPlan.plan.changes);
      } catch {
        // Fallback to in-memory diff if pending plan lookup fails.
      }
    } else {
      const localPending = getLocalPending(userId, characterId);
      if (localPending.length > 0) {
        syncDiff = pendingChangesToDiff(localPending);
      }
    }

    const syncPayload = buildSpellSyncPayload(syncDiff, apiSpells, characterId);

    if (mode.remotePendingPlanEnabled && authenticated) {
      const payload = await applyPendingPlan(characterId);
      setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
      setPendingVersion(payload.plan.version);
      setApiSpells((current) =>
        current.map((spell) => ({
          ...spell,
          prepared: payload.activeSpellIds.includes(spell.id),
        })),
      );
      setPreparedSpellIds(payload.activeSpellIds);
      setNextList(buildSlotsFromCurrent(payload.activeSpellIds));
      setDraftSaveStatus('idle');
      setDraftSaveTick(0);
      publishSpellSyncPayload(syncPayload);
      return syncPayload;
    }

    const nextPreparedIds = nextList
      .map((slot) => slot.spellId)
      .filter((spellId): spellId is string => Boolean(spellId));
    const nextPreparedSet = new Set(nextPreparedIds);
    setApiSpells((current) => current.map((spell) => ({ ...spell, prepared: nextPreparedSet.has(spell.id) })));
    setLocalPrepared(userId, characterId, nextPreparedSet);
    setPreparedSpellIds(nextPreparedIds);
    clearLocalPending(userId, characterId);
    setPendingActions([]);
    setPendingVersion(1);
    setNextList(buildSlotsFromCurrent(nextPreparedIds));
    setDraftSaveStatus('idle');
    setDraftSaveTick(0);
    publishSpellSyncPayload(syncPayload);
    return syncPayload;
  }, [apiSpells, authenticated, characterId, diff, mode.remotePendingPlanEnabled, nextList, userId]);

  const queuePendingAction = useCallback(
    async (action: Omit<UiPendingAction, 'id'>) => {
      const nextChange: ApiPendingChange = {
        type: action.type,
        spellId: action.spellId,
        replacementSpellId: action.replacementSpellId,
        note: action.note,
      };

      if (mode.remotePendingPlanEnabled && authenticated) {
        const payload = await appendPendingChange(characterId, pendingVersion, nextChange);
        setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
        setPendingVersion(payload.plan.version);
        setNextList(applyPendingChangesToNextList(preparedSpellIds, payload.plan.changes));
        return;
      }

      const nextChanges = [...mapUiPendingToApiPending(pendingActions), nextChange];
      const nextDraft = applyPendingChangesToNextList(preparedSpellIds, nextChanges);
      persistLocalDraft(nextDraft, nextChanges);
      setNextList(nextDraft);
    },
    [
      authenticated,
      characterId,
      mode.remotePendingPlanEnabled,
      pendingActions,
      pendingVersion,
      persistLocalDraft,
      preparedSpellIds,
    ],
  );

  const removePendingAction = useCallback(
    async (actionId: string) => {
      const nextUiActions = pendingActions.filter((action) => action.id !== actionId);
      const nextChanges = mapUiPendingToApiPending(nextUiActions);

      if (mode.remotePendingPlanEnabled && authenticated) {
        const payload = await setPendingPlan(characterId, pendingVersion, nextChanges);
        setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
        setPendingVersion(payload.plan.version);
        setNextList(applyPendingChangesToNextList(preparedSpellIds, payload.plan.changes));
        return;
      }

      const nextDraft = applyPendingChangesToNextList(preparedSpellIds, nextChanges);
      persistLocalDraft(nextDraft, nextChanges);
      setNextList(nextDraft);
    },
    [
      authenticated,
      characterId,
      mode.remotePendingPlanEnabled,
      pendingActions,
      pendingVersion,
      persistLocalDraft,
      preparedSpellIds,
    ],
  );

  const clearPendingActions = useCallback(async () => {
    if (mode.remotePendingPlanEnabled && authenticated) {
      const payload = await clearPendingPlan(characterId);
      setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
      setPendingVersion(payload.plan.version);
      setNextList(buildSlotsFromCurrent(preparedSpellIds));
      return;
    }

    clearLocalPending(userId, characterId);
    setPendingActions([]);
    setPendingVersion(1);
    setNextList(buildSlotsFromCurrent(preparedSpellIds));
  }, [authenticated, characterId, mode.remotePendingPlanEnabled, preparedSpellIds, userId]);

  const applyPendingActions = useCallback(async () => {
    await applyAll();
  }, [applyAll]);

  const handleSignUp = useCallback(
    async (nextUserId: string, nextDisplayName?: string) => {
      await signUp(nextUserId, nextDisplayName, characterId);
      await reloadAll();
    },
    [characterId, reloadAll],
  );

  const handleSignIn = useCallback(
    async (nextUserId: string) => {
      await signIn(nextUserId, characterId);
      await reloadAll();
    },
    [characterId, reloadAll],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    await reloadAll();
  }, [reloadAll]);

  const contextValue = useMemo<AppContextType>(
    () => ({
      loading,
      error,
      spells,
      mode,
      currentCharacter,
      characters: currentCharacter ? [currentCharacter] : [],
      userId,
      displayName,
      authenticated,
      saveMode,
      currentList,
      nextList,
      diff,
      draftSaveStatus,
      draftSaveTick,
      setCharacterId,
      refreshNow,
      resetLocalDrafts,
      signUp: handleSignUp,
      signIn: handleSignIn,
      signOut: handleSignOut,
      createSpell,
      updateSpell,
      deleteSpell,
      togglePrepared,
      queuePendingAction,
      removePendingAction,
      clearPendingActions,
      applyPendingActions,
      setNextSlot,
      setSlotNote,
      applyOne,
      applyAll,
    }),
    [
      applyAll,
      applyOne,
      applyPendingActions,
      authenticated,
      createSpell,
      currentCharacter,
      deleteSpell,
      diff,
      draftSaveStatus,
      draftSaveTick,
      error,
      handleSignIn,
      handleSignOut,
      handleSignUp,
      loading,
      mode,
      nextList,
      queuePendingAction,
      refreshNow,
      removePendingAction,
      resetLocalDrafts,
      saveMode,
      setNextSlot,
      setSlotNote,
      setCharacterId,
      spells,
      togglePrepared,
      updateSpell,
      userId,
      displayName,
      clearPendingActions,
      currentList,
    ],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function toCsvInput(values: string[]): string {
  return values.join(', ');
}

export function fromCsvInput(value: string): string[] {
  return parseListInput(value);
}

export function newPendingActionId() {
  return generateActionId();
}
