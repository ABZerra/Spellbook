import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, User } from 'lucide-react';

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-[220px]">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={characterIdInput}
            onChange={(event) => setCharacterIdInput(event.target.value)}
            placeholder="My Character"
            className="h-10 border-[#2a3b5e] bg-[#0f1c33] pl-9 text-gray-100"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 border-[#2a3b5e] bg-[#0f1c33] text-gray-100 hover:bg-[#172742]"
          disabled={busy || (mode.remotePendingPlanEnabled && !authenticated)}
          onClick={() => run(() => setCharacterId(characterIdInput))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {mode.remotePendingPlanEnabled && (
        <details className="rounded-md border border-[#263754] bg-[#0d1527] p-3 text-sm text-gray-300">
          <summary className="cursor-pointer text-gray-200">Account ({identityLabel})</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Sign In User ID</Label>
              <Input value={signinId} onChange={(event) => setSigninId(event.target.value)} placeholder="user-123" />
              <Button
                className="w-full"
                variant="secondary"
                disabled={busy || !signinId.trim()}
                onClick={() => run(() => signIn(signinId.trim()))}
              >
                Sign In
              </Button>
            </div>

            <div className="space-y-1">
              <Label>Sign Up User ID</Label>
              <Input value={signupId} onChange={(event) => setSignupId(event.target.value)} placeholder="new-user" />
              <Input
                value={signupDisplayName}
                onChange={(event) => setSignupDisplayName(event.target.value)}
                placeholder="Display name (optional)"
              />
              <Button
                className="w-full"
                variant="secondary"
                disabled={busy || !signupId.trim()}
                onClick={() => run(() => signUp(signupId.trim(), signupDisplayName.trim() || undefined))}
              >
                Sign Up
              </Button>
            </div>

            <div className="space-y-1">
              <Label>Session</Label>
              <Button
                className="w-full"
                variant="outline"
                disabled={busy || !authenticated}
                onClick={() => run(() => signOut())}
              >
                Log Out
              </Button>
            </div>
          </div>
        </details>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
