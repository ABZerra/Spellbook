import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { computePreview, generateActionId } from '../domain/planner';
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
  getLocalPending,
  getLocalPrepared,
  setLocalPending,
  setLocalPatches,
  setLocalPrepared,
} from '../services/localFallbackService';
import {
  appendPendingChange,
  applyPendingPlan,
  clearPendingPlan,
  getPendingPlan,
  setPendingPlan,
} from '../services/pendingPlanService';
import { signIn, signOut, signUp, switchCharacter } from '../services/sessionService';
import { createSpell as createSpellRequest, deleteSpell as deleteSpellRequest, listSpells, syncSpells, updateSpell as updateSpellRequest } from '../services/spellService';
import type { ConfigResponse } from '../types/api';
import type { ApiPendingChange, ApiSpell, AppMode, CharacterSummary, UiPendingAction, UiSpell, UiSpellDraft } from '../types/spell';

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
  const [pendingActions, setPendingActions] = useState<UiPendingAction[]>([]);
  const [pendingVersion, setPendingVersion] = useState(1);

  const loadConfig = useCallback(async (): Promise<ConfigResponse> => {
    const response = await fetch('/api/config', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Failed to load configuration.');
    }
    const payload = (await response.json()) as ConfigResponse;
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
      return;
    } catch {
      // Fall through to static fallback.
    }

    const staticResponse = await fetch('/spells.json', { cache: 'no-store' });
    if (!staticResponse.ok) {
      throw new Error('Unable to load spells from API or static fallback.');
    }

    const staticPayload = await staticResponse.json();
    const baseSpells: ApiSpell[] = Array.isArray(staticPayload?.spells) ? staticPayload.spells : [];
    const patches = getLocalPatches(nextUserId, nextCharacterId);
    const patchedSpells = baseSpells.map((spell) => applyPatchToSpell(spell, patches[spell.id]));
    const defaults = patchedSpells.filter((spell) => spell.prepared).map((spell) => spell.id);
    const localPrepared = getLocalPrepared(nextUserId, nextCharacterId, defaults);

    setApiSpells(patchedSpells.map((spell) => ({ ...spell, prepared: localPrepared.has(spell.id) })));
    setMode((current) => ({ ...current, staticDataMode: true }));
    setSaveMode('local');
  }, []);

  const loadPendingActions = useCallback(
    async (nextCharacterId: string, nextUserId: string | null, remoteEnabled: boolean, isAuthenticated: boolean) => {
      if (remoteEnabled && isAuthenticated) {
        const payload = await getPendingPlan(nextCharacterId);
        setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
        setPendingVersion(payload.plan.version);
        return;
      }

      const localChanges = getLocalPending(nextUserId, nextCharacterId);
      setPendingActions(mapApiPendingToUiPending(localChanges));
      setPendingVersion(1);
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

      await loadSpells(activeCharacterId, config.userId, nextMode);
      await loadPendingActions(activeCharacterId, config.userId, nextMode.remotePendingPlanEnabled, Boolean(config.authenticated));
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

  const preparedSpellIds = useMemo(
    () => apiSpells.filter((spell) => spell.prepared).map((spell) => spell.id),
    [apiSpells],
  );

  const currentCharacter: CharacterSummary | null = useMemo(
    () => ({
      id: characterId,
      name: characterId,
      preparedSpellIds,
      pendingActions,
    }),
    [characterId, pendingActions, preparedSpellIds],
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
      await loadSpells(nextCharacterId, userId, mode);
      await loadPendingActions(nextCharacterId, userId, mode.remotePendingPlanEnabled, authenticated);
    },
    [authenticated, defaultCharacterId, loadPendingActions, loadSpells, mode, userId],
  );

  const refreshNow = useCallback(async () => {
    try {
      await syncSpells();
    } catch {
      // Manual sync is best effort; fallback is plain reload.
    }

    await loadSpells(characterId, userId, mode);
  }, [characterId, loadSpells, mode, userId]);

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
      try {
        const response = await updateSpellRequest(spellId, { prepared: nextPrepared });
        setApiSpells((current) => current.map((entry) => (entry.id === spellId ? response.spell : entry)));
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
      }
    },
    [apiSpells, characterId, mode.allowLocalDraftEdits, updateLocalFallbackPatch, userId],
  );

  const persistLocalPending = useCallback(
    (changes: ApiPendingChange[]) => {
      setLocalPending(userId, characterId, changes);
      setPendingActions(mapApiPendingToUiPending(changes));
      setPendingVersion(1);
    },
    [characterId, userId],
  );

  const queuePendingAction = useCallback(
    async (action: Omit<UiPendingAction, 'id'>) => {
      if (mode.remotePendingPlanEnabled && authenticated) {
        const payload = await appendPendingChange(characterId, pendingVersion, {
          type: action.type,
          spellId: action.spellId,
          replacementSpellId: action.replacementSpellId,
        });
        setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
        setPendingVersion(payload.plan.version);
        return;
      }

      const nextChanges = [
        ...mapUiPendingToApiPending(pendingActions),
        {
          type: action.type,
          spellId: action.spellId,
          replacementSpellId: action.replacementSpellId,
        },
      ];
      persistLocalPending(nextChanges);
    },
    [authenticated, characterId, mode.remotePendingPlanEnabled, pendingActions, pendingVersion, persistLocalPending],
  );

  const removePendingAction = useCallback(
    async (actionId: string) => {
      const nextUiActions = pendingActions.filter((action) => action.id !== actionId);
      const nextChanges = mapUiPendingToApiPending(nextUiActions);

      if (mode.remotePendingPlanEnabled && authenticated) {
        const payload = await setPendingPlan(characterId, pendingVersion, nextChanges);
        setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
        setPendingVersion(payload.plan.version);
        return;
      }

      persistLocalPending(nextChanges);
    },
    [authenticated, characterId, mode.remotePendingPlanEnabled, pendingActions, pendingVersion, persistLocalPending],
  );

  const clearPendingActions = useCallback(async () => {
    if (mode.remotePendingPlanEnabled && authenticated) {
      const payload = await clearPendingPlan(characterId);
      setPendingActions(mapApiPendingToUiPending(payload.plan.changes));
      setPendingVersion(payload.plan.version);
      return;
    }

    clearLocalPending(userId, characterId);
    setPendingActions([]);
    setPendingVersion(1);
  }, [authenticated, characterId, mode.remotePendingPlanEnabled, userId]);

  const applyPendingActions = useCallback(async () => {
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
      return;
    }

    const previewIds = new Set(computePreview(preparedSpellIds, pendingActions));
    setApiSpells((current) => current.map((spell) => ({ ...spell, prepared: previewIds.has(spell.id) })));
    setLocalPrepared(userId, characterId, previewIds);
    clearLocalPending(userId, characterId);
    setPendingActions([]);
    setPendingVersion(1);
  }, [authenticated, characterId, mode.remotePendingPlanEnabled, pendingActions, preparedSpellIds, userId]);

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
    }),
    [
      applyPendingActions,
      authenticated,
      createSpell,
      currentCharacter,
      deleteSpell,
      error,
      handleSignIn,
      handleSignOut,
      handleSignUp,
      loading,
      mode,
      queuePendingAction,
      refreshNow,
      removePendingAction,
      resetLocalDrafts,
      saveMode,
      setCharacterId,
      spells,
      togglePrepared,
      updateSpell,
      userId,
      displayName,
      clearPendingActions,
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
