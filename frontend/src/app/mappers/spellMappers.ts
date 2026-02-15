import type { ApiPendingChange, ApiSpell } from '../types/api';
import type { UiPendingAction, UiSpell, UiSpellDraft } from '../types/spell';

function nonEmptyString(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function listOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => nonEmptyString(entry)).filter(Boolean);
}

export function mapApiSpellToUiSpell(apiSpell: ApiSpell): UiSpell {
  return {
    id: nonEmptyString(apiSpell.id),
    name: nonEmptyString(apiSpell.name, 'Unknown Spell'),
    level: Number.isFinite(apiSpell.level) ? Number(apiSpell.level) : 0,
    source: listOfStrings(apiSpell.source),
    tags: listOfStrings(apiSpell.tags),
    prepared: Boolean(apiSpell.prepared),
    description: nonEmptyString(apiSpell.description),
    duration: nonEmptyString(apiSpell.duration),
    components: nonEmptyString(apiSpell.components ?? apiSpell.component),
    spellList: listOfStrings(apiSpell.spellList),
    school: nonEmptyString(apiSpell.school),
    range: nonEmptyString(apiSpell.range),
    castingTime: nonEmptyString(apiSpell.castingTime),
    save: nonEmptyString(apiSpell.save),
    damage: nonEmptyString(apiSpell.damage),
    notes: nonEmptyString(apiSpell.notes),
    preparation: nonEmptyString(apiSpell.preparation),
    combos: nonEmptyString(apiSpell.combos),
    items: nonEmptyString(apiSpell.items),
  };
}

export function mapUiDraftToApiPatch(draft: UiSpellDraft): Partial<ApiSpell> {
  const payload: Partial<ApiSpell> = {};

  if (typeof draft.id === 'string') payload.id = nonEmptyString(draft.id);
  if (typeof draft.name === 'string') payload.name = nonEmptyString(draft.name);
  if (typeof draft.level === 'number' && Number.isFinite(draft.level)) payload.level = Math.max(0, Math.floor(draft.level));
  if (Array.isArray(draft.source)) payload.source = draft.source.map((item) => nonEmptyString(item)).filter(Boolean);
  if (Array.isArray(draft.tags)) payload.tags = draft.tags.map((item) => nonEmptyString(item)).filter(Boolean);
  if (typeof draft.prepared === 'boolean') payload.prepared = draft.prepared;

  if (typeof draft.description === 'string') payload.description = nonEmptyString(draft.description) || null;
  if (typeof draft.duration === 'string') payload.duration = nonEmptyString(draft.duration) || null;
  if (typeof draft.components === 'string') payload.components = nonEmptyString(draft.components) || null;
  if (Array.isArray(draft.spellList)) payload.spellList = draft.spellList.map((item) => nonEmptyString(item)).filter(Boolean);
  if (typeof draft.school === 'string') payload.school = nonEmptyString(draft.school) || null;
  if (typeof draft.range === 'string') payload.range = nonEmptyString(draft.range) || null;
  if (typeof draft.castingTime === 'string') payload.castingTime = nonEmptyString(draft.castingTime) || null;
  if (typeof draft.save === 'string') payload.save = nonEmptyString(draft.save) || null;
  if (typeof draft.damage === 'string') payload.damage = nonEmptyString(draft.damage) || null;
  if (typeof draft.notes === 'string') payload.notes = nonEmptyString(draft.notes) || null;
  if (typeof draft.preparation === 'string') payload.preparation = nonEmptyString(draft.preparation) || null;
  if (typeof draft.combos === 'string') payload.combos = nonEmptyString(draft.combos) || null;
  if (typeof draft.items === 'string') payload.items = nonEmptyString(draft.items) || null;

  return payload;
}

export function mapUiPendingToApiPending(actions: UiPendingAction[]): ApiPendingChange[] {
  return actions.map((action) => ({
    type: action.type,
    spellId: action.spellId,
    replacementSpellId: action.replacementSpellId,
  }));
}

export function mapApiPendingToUiPending(changes: ApiPendingChange[]): UiPendingAction[] {
  return changes.map((change, index) => ({
    id: `pending-${index}-${change.type}-${change.spellId}-${change.replacementSpellId || 'none'}`,
    type: change.type,
    spellId: change.spellId,
    replacementSpellId: change.replacementSpellId,
  }));
}
