import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, RefreshCw, Wand2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { computeDiff, computePreview } from '../domain/planner';
import { CharacterSwitcher } from '../components/CharacterSwitcher';
import { SpellCard } from '../components/SpellCard';
import { SpellDetailsPanel } from '../components/SpellDetailsPanel';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

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
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);

  const currentPreparedIds = currentCharacter?.preparedSpellIds || [];
  const pendingActions = currentCharacter?.pendingActions || [];
  const previewIds = useMemo(
    () => computePreview(currentPreparedIds, pendingActions),
    [currentPreparedIds, pendingActions],
  );

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
  const selectedSpell = useMemo(
    () => (selectedSpellId ? spellById.get(selectedSpellId) || null : null),
    [selectedSpellId, spellById],
  );

  useEffect(() => {
    if (!selectedSpellId) return;
    if (spellById.has(selectedSpellId)) return;
    setSelectedSpellId(null);
  }, [selectedSpellId, spellById]);

  function handleInspectSpell(spellId: string) {
    setSelectedSpellId((current) => (current === spellId ? null : spellId));
  }

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
    <div className="min-h-screen bg-[#030814] text-gray-100">
      <header className="border-b border-[#1b2a46] bg-[#07142d]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Wand2 className="h-8 w-8 text-violet-400" />
            <div>
              <h1 className="text-3xl font-bold">Preparation Planner</h1>
              <p className="text-sm text-[#90a2c0]">Queue and apply long-rest changes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CharacterSwitcher />
            <Link to="/catalog">
              <Button variant="outline" className="h-10 border-[#2c3f62] bg-[#101b31] text-gray-100 hover:bg-[#182743]">
                <BookOpen className="mr-2 h-4 w-4" />
                Catalog
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#1b2a46] bg-[#081734]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-6 py-3 text-sm">
          <div className="flex items-center gap-2"><span>Current:</span><Badge className="bg-[#1b2740] text-gray-100">{currentSpells.length}</Badge></div>
          <div className="flex items-center gap-2"><span>Pending:</span><Badge className="bg-[#1b2740] text-gray-100">{pendingActions.length}</Badge></div>
          <div className="flex items-center gap-2"><span>Preview:</span><Badge className="bg-green-600 text-white">{previewSpells.length}</Badge></div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
            <Button variant="outline" size="sm" onClick={() => void refreshNow()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1b2a46] bg-[#081734]">
        <div className="mx-auto grid max-w-[1500px] gap-3 px-6 py-4 md:grid-cols-4">
          <Select value={actionType} onValueChange={(value) => setActionType(value as 'add' | 'remove' | 'replace')}>
            <SelectTrigger className="h-10 border-[#2c3f62] bg-[#101b31]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Add spell</SelectItem>
              <SelectItem value="remove">Remove spell</SelectItem>
              <SelectItem value="replace">Replace spell</SelectItem>
            </SelectContent>
          </Select>

          <Select value={spellId} onValueChange={setSpellId}>
            <SelectTrigger className="h-10 border-[#2c3f62] bg-[#101b31]"><SelectValue placeholder={actionType === 'remove' ? 'Spell to remove' : 'Spell'} /></SelectTrigger>
            <SelectContent>
              {(actionType === 'remove' ? currentSpells : availableSpells).map((spell) => (
                <SelectItem key={spell.id} value={spell.id}>{spell.name} (Lvl {spell.level})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {actionType === 'replace' ? (
            <Select value={replacementSpellId} onValueChange={setReplacementSpellId}>
              <SelectTrigger className="h-10 border-[#2c3f62] bg-[#101b31]"><SelectValue placeholder="Replace prepared spell" /></SelectTrigger>
              <SelectContent>
                {currentSpells.map((spell) => (
                  <SelectItem key={spell.id} value={spell.id}>{spell.name} (Lvl {spell.level})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <div />}

          <Button className="h-10" disabled={busy} onClick={() => void handleQueueAction()}>Queue Change</Button>
        </div>
        {actionError && <p className="mx-auto max-w-[1500px] px-6 pb-4 text-sm text-red-400">{actionError}</p>}
      </section>

      <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-6 py-8 xl:grid-cols-3">
        <Card className="border-[#24385b] bg-[#070b14]">
          <CardHeader>
            <CardTitle className="text-gray-100">Current Prepared</CardTitle>
            <CardDescription>{currentSpells.length} spells currently prepared</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentSpells.length === 0 ? (
              <p className="py-8 text-sm text-gray-500">No prepared spells.</p>
            ) : (
              currentSpells.map((spell) => (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  compact
                  showPrepared={false}
                  onInspect={(nextSpell) => handleInspectSpell(nextSpell.id)}
                  isSelected={spell.id === selectedSpell?.id}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-[#24385b] bg-[#070b14]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-gray-100">Pending Queue</CardTitle>
                <CardDescription>{pendingActions.length} actions queued</CardDescription>
              </div>
              {pendingActions.length > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => clearPendingActions())}>Clear All</Button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingActions.length === 0 && <p className="py-12 text-center text-sm text-[#6f7c96]">No pending actions</p>}
            {pendingActions.map((action) => {
              const spell = spellById.get(action.spellId);
              const replacement = action.replacementSpellId ? spellById.get(action.replacementSpellId) : null;
              return (
                <div key={action.id} className="rounded-xl border border-[#2b3f63] bg-[#121b2d] p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge className={action.type === 'add' ? 'bg-green-600 text-white' : action.type === 'remove' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}>{action.type}</Badge>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => removePendingAction(action.id))}><X className="h-4 w-4" /></Button>
                  </div>
                  {action.type === 'replace' && replacement && <p className="text-gray-300"><span className="line-through text-gray-500">{replacement.name}</span> {'->'} {spell?.name || action.spellId}</p>}
                  {action.type !== 'replace' && <p className="text-gray-100">{spell?.name || action.spellId}</p>}
                </div>
              );
            })}
            {pendingActions.length > 0 && (
              <Button className="w-full bg-white text-black hover:bg-gray-200" disabled={busy} onClick={() => void run(() => applyPendingActions())}>
                <Check className="mr-2 h-4 w-4" />Apply Plan
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#24385b] bg-[#070b14]">
          <CardHeader>
            <CardTitle className="text-gray-100">Preview</CardTitle>
            <CardDescription>{previewSpells.length} spells after applying changes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingActions.length > 0 && (
              <div className="rounded-xl border border-purple-700 bg-purple-500/10 p-3 text-sm">
                <p className="mb-1 font-semibold text-purple-200">Changes Summary:</p>
                {diff.replaced.length > 0 && <p className="text-blue-300">{diff.replaced.length} Replaced: {diff.replaced.map((entry) => `${entry.oldSpell.name} -> ${entry.newSpell.name}`).join(', ')}</p>}
                {diff.added.length > 0 && <p className="text-green-300">{diff.added.length} Added: {diff.added.map((entry) => entry.name).join(', ')}</p>}
                {diff.removed.length > 0 && <p className="text-red-300">{diff.removed.length} Removed: {diff.removed.map((entry) => entry.name).join(', ')}</p>}
              </div>
            )}
            {previewSpells.length === 0 ? (
              <p className="py-8 text-sm text-gray-500">No spells in preview.</p>
            ) : (
              previewSpells.map((spell) => (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  compact
                  showPrepared={false}
                  onInspect={(nextSpell) => handleInspectSpell(nextSpell.id)}
                  isSelected={spell.id === selectedSpell?.id}
                />
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <div
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-300 ${selectedSpell ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSelectedSpellId(null)}
      />
      <aside
        className={`fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-[420px] transform transition-transform duration-300 ${selectedSpell ? 'translate-x-0' : 'translate-x-[110%]'}`}
      >
        <div className="relative max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[#2a4067] bg-[#050c1b] p-1 shadow-2xl">
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-3 top-3 z-10"
            onClick={() => setSelectedSpellId(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          <SpellDetailsPanel spell={selectedSpell || null} title="Prepare Details" />
        </div>
      </aside>

      {loading && <p className="px-6 pb-6 text-gray-400">Loading prepare state...</p>}
      {!loading && error && <p className="px-6 pb-6 text-red-400">{error}</p>}
      {mode.staticDataMode && <p className="px-6 pb-6 text-sm text-yellow-300">Static mode active: pending actions and prepared state are stored in browser storage.</p>}
    </div>
  );
}
