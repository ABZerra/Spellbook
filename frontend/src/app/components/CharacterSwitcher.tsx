import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function CharacterSwitcher() {
  const {
    currentCharacter,
    setCharacterId,
    authenticated,
    mode,
    userId,
    displayName,
    signIn,
    signOut,
    signUp,
  } = useApp();

  const [characterIdInput, setCharacterIdInput] = useState(currentCharacter?.id || 'default-character');
  const [signinId, setSigninId] = useState('');
  const [signupId, setSignupId] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identityLabel = useMemo(() => {
    if (!authenticated || !userId) return 'Not signed in';
    if (displayName && displayName !== userId) return `${displayName} (${userId})`;
    return userId;
  }, [authenticated, displayName, userId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900/70 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Label>Character ID</Label>
          <Input
            value={characterIdInput}
            onChange={(event) => setCharacterIdInput(event.target.value)}
            placeholder="default-character"
          />
        </div>
        <Button
          variant="outline"
          disabled={busy || (mode.remotePendingPlanEnabled && !authenticated)}
          onClick={() => run(() => setCharacterId(characterIdInput))}
        >
          Switch Character
        </Button>
      </div>

      <p className="text-sm text-gray-400">{mode.remotePendingPlanEnabled ? `Remote mode: ${identityLabel}` : 'Local mode (no remote auth)'}</p>

      {mode.remotePendingPlanEnabled && (
        <div className="grid gap-2 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Sign In User ID</Label>
            <Input value={signinId} onChange={(event) => setSigninId(event.target.value)} placeholder="user-123" />
            <Button className="w-full" variant="secondary" disabled={busy || !signinId.trim()} onClick={() => run(() => signIn(signinId.trim()))}>
              Sign In
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Sign Up User ID</Label>
            <Input value={signupId} onChange={(event) => setSignupId(event.target.value)} placeholder="new-user" />
            <Input value={signupDisplayName} onChange={(event) => setSignupDisplayName(event.target.value)} placeholder="Display name (optional)" />
            <Button className="w-full" variant="secondary" disabled={busy || !signupId.trim()} onClick={() => run(() => signUp(signupId.trim(), signupDisplayName.trim() || undefined))}>
              Sign Up
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Session</Label>
            <Button className="w-full" variant="outline" disabled={busy || !authenticated} onClick={() => run(() => signOut())}>
              Log Out
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
