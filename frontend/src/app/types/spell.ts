import type { ApiPendingChange, ApiSpell, ChangeType } from './api';

export type { ApiSpell, ApiPendingChange, ChangeType };

export interface UiSpell {
  id: string;
  name: string;
  level: number;
  source: string[];
  tags: string[];
  prepared: boolean;
  description: string;
  duration: string;
  components: string;
  spellList: string[];
  school: string;
  range: string;
  castingTime: string;
  save: string;
  damage: string;
  notes: string;
  preparation: string;
  combos: string;
  items: string;
}

export interface UiPendingAction {
  id: string;
  type: ChangeType;
  spellId: string;
  replacementSpellId?: string;
  note?: string;
}

export interface SlotDraft {
  spellId: string | null;
  note?: string;
}

export interface DiffItem {
  action: ChangeType;
  index: number;
  fromSpellId?: string;
  toSpellId?: string;
  note?: string;
}

export interface UiSpellDraft {
  id?: string;
  name?: string;
  level?: number;
  source?: string[];
  tags?: string[];
  prepared?: boolean;
  description?: string;
  duration?: string;
  components?: string;
  spellList?: string[];
  school?: string;
  range?: string;
  castingTime?: string;
  save?: string;
  damage?: string;
  notes?: string;
  preparation?: string;
  combos?: string;
  items?: string;
}

export interface CharacterSummary {
  id: string;
  name: string;
  preparedSpellIds: string[];
  pendingActions: UiPendingAction[];
  nextList?: SlotDraft[];
}

export type Spell = UiSpell;
export type Character = CharacterSummary;

export interface PreviewDiff {
  replaced: Array<{ oldSpell: UiSpell; newSpell: UiSpell }>;
  added: UiSpell[];
  removed: UiSpell[];
}

export interface PlannerState {
  current: string[];
  pending: UiPendingAction[];
  preview: string[];
}

export interface AppMode {
  remotePendingPlanEnabled: boolean;
  spellsBackend: string;
  allowLocalDraftEdits: boolean;
  staticDataMode: boolean;
}
