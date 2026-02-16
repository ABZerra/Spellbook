import type { ApiPendingChange, ApplyPlanPayload, PendingPlanPayload } from '../types/api';
import { apiRequest } from './apiClient';

export function getPendingPlan(characterId: string) {
  return apiRequest<PendingPlanPayload>(`/api/characters/${encodeURIComponent(characterId)}/pending-plan`);
}

export function setPendingPlan(characterId: string, version: number, changes: ApiPendingChange[]) {
  return apiRequest<PendingPlanPayload>(`/api/characters/${encodeURIComponent(characterId)}/pending-plan`, {
    method: 'PUT',
    body: { version, changes },
  });
}

export function appendPendingChange(characterId: string, version: number, change: ApiPendingChange) {
  return apiRequest<PendingPlanPayload>(`/api/characters/${encodeURIComponent(characterId)}/pending-plan/changes`, {
    method: 'POST',
    body: { version, change },
  });
}

export function clearPendingPlan(characterId: string) {
  return apiRequest<PendingPlanPayload>(`/api/characters/${encodeURIComponent(characterId)}/pending-plan`, {
    method: 'DELETE',
  });
}

export function applyPendingPlan(characterId: string) {
  return apiRequest<ApplyPlanPayload>(`/api/characters/${encodeURIComponent(characterId)}/pending-plan/apply`, {
    method: 'POST',
  });
}

export function applyOnePendingChange(characterId: string, version: number, change: ApiPendingChange) {
  return apiRequest<ApplyPlanPayload>(`/api/characters/${encodeURIComponent(characterId)}/pending-plan/apply-one`, {
    method: 'POST',
    body: { version, change },
  });
}
