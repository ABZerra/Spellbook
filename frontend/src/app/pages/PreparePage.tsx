import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, RefreshCw, Wand2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { computeDiff, computePreview } from '../domain/planner';
import { CharacterSwitcher } from '../components/CharacterSwitcher';
import { SpellCard } from '../components/SpellCard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export function PreparePage() {
  const {
    spells,
    currentCharacter,
    loading,
    error,
    mode,
    saveMode,
    refreshNow,
    queuePendingAction,
    removePendingAction,
    clearPendingActions,
    applyPendingActions,
  } = useApp();

  const [actionType, setActionType] = useState<'add' | 'remove' | 'replace'>('add');
  const [spellId, setSpellId] = useState('');
  const [replacementSpellId, setReplacementSpellId] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentPreparedIds = currentCharacter?.preparedSpellIds || [];
  const pendingActions = currentCharacter?.pendingActions || [];
  const previewIds = useMemo(() => computePreview(currentPreparedIds, pendingActions), [currentPreparedIds, pendingActions]);

  const currentSpells = useMemo(
    () => spells.filter((spell) => currentPreparedIds.includes(spell.id)),
    [currentPreparedIds, spells],
  );
  const previewSpells = useMemo(
    () => spells.filter((spell) => previewIds.includes(spell.id)),
    [previewIds, spells],
  );

  const availableSpells = useMemo(
    () => spells.filter((spell) => !currentPreparedIds.includes(spell.id)),
    [currentPreparedIds, spells],
  );

  const diff = useMemo(
    () => computeDiff(currentPreparedIds, previewIds, pendingActions, spells),
    [currentPreparedIds, pendingActions, previewIds, spells],
  );

  const spellById = useMemo(() => new Map(spells.map((spell) => [spell.id, spell])), [spells]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleQueueAction() {
    if (!spellId) {
      setActionError('Select a spell first.');
      return;
    }
    if (actionType === 'replace' && !replacementSpellId) {
      setActionError('Select the currently prepared spell to replace.');
      return;
    }

    await run(async () => {
      await queuePendingAction({
        type: actionType,
        spellId,
        replacementSpellId: actionType === 'replace' ? replacementSpellId : undefined,
      });
      setSpellId('');
      setReplacementSpellId('');
    });
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Wand2 className="h-8 w-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold text-gray-100">Preparation Planner</h1>
                <p className="text-sm text-gray-400">Queue and apply long-rest changes</p>
              </div>
            </div>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Catalog
              </Button>
            </Link>
          </div>
          <CharacterSwitcher />
        </div>
      </header>

      <div className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Current:</span>
            <Badge variant="secondary">{currentSpells.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Pending:</span>
            <Badge variant="outline">{pendingActions.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Preview:</span>
            <Badge className="bg-green-600">{previewSpells.length}</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
            <Button variant="outline" size="sm" onClick={() => void refreshNow()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-semibold text-gray-100">Queue Change</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Select value={actionType} onValueChange={(value) => setActionType(value as 'add' | 'remove' | 'replace')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add spell</SelectItem>
                  <SelectItem value="remove">Remove spell</SelectItem>
                  <SelectItem value="replace">Replace spell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={spellId} onValueChange={setSpellId}>
                <SelectTrigger><SelectValue placeholder={actionType === 'remove' ? 'Spell to remove' : 'Spell'} /></SelectTrigger>
                <SelectContent>
                  {(actionType === 'remove' ? currentSpells : availableSpells).map((spell) => (
                    <SelectItem key={spell.id} value={spell.id}>{spell.name} (Lvl {spell.level})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              {actionType === 'replace' ? (
                <Select value={replacementSpellId} onValueChange={setReplacementSpellId}>
                  <SelectTrigger><SelectValue placeholder="Replace prepared spell" /></SelectTrigger>
                  <SelectContent>
                    {currentSpells.map((spell) => (
                      <SelectItem key={spell.id} value={spell.id}>{spell.name} (Lvl {spell.level})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10" />
              )}
            </div>

            <div>
              <Button className="w-full" disabled={busy} onClick={() => void handleQueueAction()}>
                Queue
              </Button>
            </div>
          </div>
          {actionError && <p className="text-sm text-red-400">{actionError}</p>}
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-3 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Current Prepared</CardTitle>
            <CardDescription>{currentSpells.length} spells</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentSpells.length === 0 ? <p className="text-sm text-gray-400">No prepared spells.</p> : currentSpells.map((spell) => <SpellCard key={spell.id} spell={spell} compact showPrepared={false} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Pending Queue</CardTitle>
                <CardDescription>{pendingActions.length} actions</CardDescription>
              </div>
              {pendingActions.length > 0 && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => clearPendingActions())}>Clear</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingActions.length === 0 && <p className="text-sm text-gray-400">No pending actions.</p>}
            {pendingActions.map((action) => {
              const spell = spellById.get(action.spellId);
              const replacement = action.replacementSpellId ? spellById.get(action.replacementSpellId) : null;
              return (
                <div key={action.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline">{action.type}</Badge>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => removePendingAction(action.id))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {action.type === 'replace' && replacement && (
                    <p className="text-gray-400">{replacement.name} {'->'} {spell?.name || action.spellId}</p>
                  )}
                  {action.type !== 'replace' && <p className="text-gray-200">{spell?.name || action.spellId}</p>}
                </div>
              );
            })}
            {pendingActions.length > 0 && (
              <Button className="w-full" disabled={busy} onClick={() => void run(() => applyPendingActions())}>
                <Check className="mr-2 h-4 w-4" />
                Apply Plan
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>{previewSpells.length} spells after apply</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingActions.length > 0 && (
              <div className="rounded-lg border border-purple-700 bg-purple-500/10 p-3 text-sm">
                {diff.replaced.length > 0 && (
                  <p className="text-blue-300">Replaced: {diff.replaced.map((entry) => `${entry.oldSpell.name} -> ${entry.newSpell.name}`).join(', ')}</p>
                )}
                {diff.added.length > 0 && <p className="text-green-300">Added: {diff.added.map((entry) => entry.name).join(', ')}</p>}
                {diff.removed.length > 0 && <p className="text-red-300">Removed: {diff.removed.map((entry) => entry.name).join(', ')}</p>}
              </div>
            )}
            {previewSpells.length === 0 ? <p className="text-sm text-gray-400">No spells in preview.</p> : previewSpells.map((spell) => <SpellCard key={spell.id} spell={spell} compact showPrepared={false} />)}
          </CardContent>
        </Card>
      </main>

      {loading && <p className="px-4 pb-6 text-gray-400">Loading prepare state...</p>}
      {!loading && error && <p className="px-4 pb-6 text-red-400">{error}</p>}
      {mode.staticDataMode && <p className="px-4 pb-6 text-sm text-yellow-300">Static mode active: pending actions and prepared state are stored in browser storage.</p>}
    </div>
  );
}
