export type ChangeType = 'add' | 'remove' | 'replace';

export interface ApiPendingChange {
  type: ChangeType;
  spellId: string;
  replacementSpellId?: string;
}

export interface ApiSpell {
  id: string;
  name: string;
  level: number;
  source?: string[];
  tags?: string[];
  prepared?: boolean;
  description?: string | null;
  duration?: string | null;
  components?: string | null;
  component?: string | null;
  spellList?: string[];
  school?: string | null;
  range?: string | null;
  castingTime?: string | null;
  save?: string | null;
  damage?: string | null;
  notes?: string | null;
  preparation?: string | null;
  combos?: string | null;
  items?: string | null;
  archived?: boolean;
}

export interface SpellsResponse {
  count: number;
  spells: ApiSpell[];
  syncMeta?: {
    stale?: boolean;
    refreshedAt?: string | null;
  };
}

export interface ConfigResponse {
  remotePendingPlanEnabled: boolean;
  defaultCharacterId: string;
  characterId: string;
  authenticated: boolean;
  userId: string | null;
  displayName: string | null;
  spellsBackend: 'json' | 'notion' | string;
  allowLocalDraftEdits: boolean;
}

export interface SessionResponse {
  authenticated: boolean;
  userId: string | null;
  displayName: string | null;
  characterId: string;
}

export interface PendingPlanPayload {
  plan: {
    version: number;
    changes: ApiPendingChange[];
  };
  activeSpellIds: string[];
}

export interface ApplyPlanPayload extends PendingPlanPayload {
  summary: {
    added: string[];
    removed: string[];
    replaced: Array<{ from: string; to: string }>;
  };
}
