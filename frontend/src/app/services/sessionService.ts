import type { ConfigResponse, SessionResponse } from '../types/api';
import { apiRequest } from './apiClient';

export function getConfig() {
  return apiRequest<ConfigResponse>('/api/config');
}

export function getSession() {
  return apiRequest<SessionResponse>('/api/session');
}

export function switchCharacter(characterId: string) {
  return apiRequest<SessionResponse & { ok: boolean }>('/api/session', {
    method: 'PUT',
    body: { characterId },
  });
}

export function signUp(userId: string, displayName?: string, characterId?: string) {
  return apiRequest('/api/auth/signup', {
    method: 'POST',
    body: { userId, displayName, characterId },
  });
}

export function signIn(userId: string, characterId?: string) {
  return apiRequest('/api/auth/signin', {
    method: 'POST',
    body: { userId, characterId },
  });
}

export function signOut() {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}
