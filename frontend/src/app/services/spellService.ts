import type { ApiSpell, SpellsResponse } from '../types/api';
import type { UiSpellDraft } from '../types/spell';
import { mapUiDraftToApiPatch } from '../mappers/spellMappers';
import { apiRequest } from './apiClient';

export async function listSpells(filters?: {
  name?: string;
  level?: string;
  source?: string;
  tags?: string;
  prepared?: string;
}) {
  const query = new URLSearchParams();
  if (filters?.name) query.set('name', filters.name);
  if (filters?.level) query.set('level', filters.level);
  if (filters?.source) query.set('source', filters.source);
  if (filters?.tags) query.set('tags', filters.tags);
  if (filters?.prepared) query.set('prepared', filters.prepared);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<SpellsResponse>(`/api/spells${suffix}`);
}

export function createSpell(draft: UiSpellDraft) {
  return apiRequest<{ ok: boolean; spell: ApiSpell }>('/api/spells', {
    method: 'POST',
    body: mapUiDraftToApiPatch(draft),
  });
}

export function updateSpell(spellId: string, draft: UiSpellDraft) {
  return apiRequest<{ ok: boolean; spell: ApiSpell }>(`/api/spells/${encodeURIComponent(spellId)}`, {
    method: 'PATCH',
    body: mapUiDraftToApiPatch(draft),
  });
}

export function deleteSpell(spellId: string) {
  return apiRequest<{ ok: boolean; deletedSpellId: string }>(`/api/spells/${encodeURIComponent(spellId)}`, {
    method: 'DELETE',
  });
}

export function syncSpells() {
  return apiRequest<{ ok: boolean; count: number }>('/api/spells/sync', { method: 'POST' });
}
