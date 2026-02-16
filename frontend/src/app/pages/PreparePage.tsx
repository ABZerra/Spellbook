import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, ChevronDown, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import type { DiffItem } from '../types/spell';
import { CharacterSwitcher } from '../components/CharacterSwitcher';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../components/ui/drawer';
import { useIsMobile } from '../components/ui/use-mobile';

interface EditState {
  index: number;
  selectedSpellId: string | null;
  note: string;
}

function asSpellName(spellMap: Map<string, string>, spellId?: string | null): string {
  if (!spellId) return 'Empty Slot';
  return spellMap.get(spellId) || spellId;
}

export function PreparePage() {
  const {
    spells,
    loading,
    error,
    saveMode,
    refreshNow,
    currentList,
    nextList,
    diff,
    setNextSlot,
    applyOne,
    applyAll,
  } = useApp();

  const isMobile = useIsMobile();
  const [editState, setEditState] = useState<EditState | null>(null);
  const [query, setQuery] = useState('');
  const [editorListOpen, setEditorListOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  const spellMap = useMemo(() => new Map(spells.map((spell) => [spell.id, spell.name])), [spells]);
  const currentSpells = useMemo(() => currentList.map((spellId) => ({ spellId, name: asSpellName(spellMap, spellId) })), [currentList, spellMap]);
  const nextSlots = useMemo(
    () =>
      nextList
        .map((slot, index) => ({ index, spellId: slot.spellId, note: slot.note, name: asSpellName(spellMap, slot.spellId) }))
        .sort((left, right) => {
          const leftEmpty = left.spellId === null;
          const rightEmpty = right.spellId === null;
          if (leftEmpty !== rightEmpty) return leftEmpty ? -1 : 1;
          return left.index - right.index;
        }),
    [nextList, spellMap],
  );

  const availableSpellOptions = useMemo(() => {
    const preparedSet = new Set(currentList);
    if (!editState?.selectedSpellId) {
      return spells.filter((spell) => !preparedSet.has(spell.id));
    }
    return spells.filter((spell) => spell.id === editState.selectedSpellId || !preparedSet.has(spell.id));
  }, [currentList, editState?.selectedSpellId, spells]);

  const filteredSpells = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = !normalized
      ? availableSpellOptions
      : availableSpellOptions.filter(
      (spell) =>
        spell.name.toLowerCase().includes(normalized) ||
        spell.id.toLowerCase().includes(normalized) ||
        spell.level.toString() === normalized,
    );
    return base;
  }, [availableSpellOptions, query]);

  const diffGroups = useMemo(
    () => ({
      replaced: diff.filter((item) => item.action === 'replace'),
      removed: diff.filter((item) => item.action === 'remove'),
      added: diff.filter((item) => item.action === 'add'),
    }),
    [diff],
  );
  const replacedByIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of diff) {
      if (item.action !== 'replace') continue;
      map.set(item.index, asSpellName(spellMap, item.fromSpellId));
    }
    return map;
  }, [diff, spellMap]);

  useEffect(() => {
    if (!editState) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editState]);

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

  async function saveSlot() {
    if (!editState) return;
    const currentSpellName = asSpellName(spellMap, currentList[editState.index] || null);
    const selectedSpellName = asSpellName(spellMap, editState.selectedSpellId);
    const message =
      currentList[editState.index] && editState.selectedSpellId
        ? `Draft saved: Replaced ${currentSpellName} with ${selectedSpellName}.`
        : currentList[editState.index] && !editState.selectedSpellId
          ? `Draft saved: Removed ${currentSpellName}.`
          : !currentList[editState.index] && editState.selectedSpellId
            ? `Draft saved: Added ${selectedSpellName}.`
            : `Draft saved: Updated slot ${editState.index + 1}.`;
    await run(async () => {
      await setNextSlot(editState.index, editState.selectedSpellId, editState.note);
      setEditState(null);
      setQuery('');
      setEditorListOpen(false);
      toast(message);
    });
  }

  async function applyAllChanges() {
    const count = diff.length;
    await run(async () => {
      await applyAll();
      setShowSummary(false);
      setMobileSummaryOpen(false);
      setShowComplete(true);
      toast(`Long Rest Complete: applied ${count} change${count === 1 ? '' : 's'}.`);
      setTimeout(() => setShowComplete(false), 1400);
    });
  }

  async function clearDiffItem(item: DiffItem) {
    const restoreSpellId = item.action === 'add' ? null : item.fromSpellId || null;
    const fromName = asSpellName(spellMap, item.fromSpellId);
    const toName = asSpellName(spellMap, item.toSpellId);
    const summary =
      item.action === 'replace'
        ? `cleared replace (${fromName} -> ${toName})`
        : item.action === 'remove'
          ? `cleared removal (${fromName})`
          : `cleared addition (${toName})`;
    await run(async () => {
      await setNextSlot(item.index, restoreSpellId);
      toast(`Draft saved: ${summary}.`);
    });
  }

  async function applySingleChange(item: DiffItem) {
    const fromName = asSpellName(spellMap, item.fromSpellId);
    const toName = asSpellName(spellMap, item.toSpellId);
    const summary =
      item.action === 'replace'
        ? `Applied replace: ${fromName} -> ${toName}.`
        : item.action === 'remove'
          ? `Applied remove: ${fromName}.`
          : `Applied add: ${toName}.`;
    await run(async () => {
      await applyOne(item);
      toast(summary);
    });
  }

  function renderDiffItem(item: DiffItem) {
    const fromName = asSpellName(spellMap, item.fromSpellId);
    const toName = asSpellName(spellMap, item.toSpellId);
    const label =
      item.action === 'replace'
        ? `${fromName} -> ${toName}`
        : item.action === 'remove'
          ? fromName
          : toName;

    return (
      <div key={`${item.action}-${item.index}-${item.fromSpellId || 'none'}-${item.toSpellId || 'none'}`} className="rounded-lg border border-[#2a3c5f] bg-[#111c32] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-100">{label}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void clearDiffItem(item)}>
              Clear Change
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void applySingleChange(item)}>
              Apply Change
            </Button>
          </div>
        </div>
        {item.note && <p className="mt-2 whitespace-pre-wrap text-xs text-[#9fb3d8]">{item.note}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040a17] pb-44 text-gray-100">
      <header className="border-b border-[#1b2a46] bg-[#07142d]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Wand2 className="h-8 w-8 text-amber-300" />
            <div>
              <h1 className="text-3xl font-semibold">Preparation Ritual</h1>
              <p className="text-sm text-[#90a2c0]">Edit next long rest spells directly</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CharacterSwitcher />
            <Link to="/catalog">
              <Button className="h-10 border border-white/20 bg-white text-black hover:bg-gray-200">
                <BookOpen className="mr-2 h-4 w-4" />
                Spell Catalog
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#1b2a46] bg-[#081734]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-6 py-3 text-sm">
          <div className="flex items-center gap-2"><span>Current:</span><Badge className="bg-[#1b2740] text-gray-100">{currentList.length}</Badge></div>
          <div className="flex items-center gap-2"><span>Next:</span><Badge className="bg-[#1b2740] text-gray-100">{nextSlots.filter((slot) => slot.spellId).length}</Badge></div>
          <div className="flex items-center gap-2"><span>Changes:</span><Badge className="bg-amber-500 text-black transition-all">{diff.length}</Badge></div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
            <Button variant="outline" size="sm" onClick={() => void refreshNow()}>Refresh</Button>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-6 py-8 md:grid-cols-2">
        {isMobile ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Next Long Rest</h2>
            {nextSlots.map((slot) => (
              <div key={`next-mobile-${slot.index}`} className={`rounded-xl border p-3 ${diff.some((item) => item.index === slot.index) ? 'border-amber-300 shadow-[0_0_0_1px_rgba(251,191,36,0.45)]' : 'border-[#2a3c5f] bg-[#0d1527]'}`}>
                <button
                  className="w-full text-left"
                  onClick={() => {
                    setEditState({ index: slot.index, selectedSpellId: slot.spellId, note: slot.note || '' });
                    setQuery('');
                    setEditorListOpen(false);
                  }}
                >
                  <p className="flex items-center gap-2 text-sm">
                    <span className="text-gray-100">{slot.name}</span>
                    {replacedByIndex.has(slot.index) && (
                      <span className="text-gray-500 line-through">{replacedByIndex.get(slot.index)}</span>
                    )}
                  </p>
                  {slot.note && <p className="text-xs text-[#8ea4ca]">Note saved</p>}
                </button>
              </div>
            ))}

            <Accordion type="single" collapsible className="rounded-xl border border-[#2a3c5f] bg-[#0d1527] px-3">
              <AccordionItem value="current">
                <AccordionTrigger>Current Prepared</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {currentSpells.map((spell, index) => (
                      <div key={`current-mobile-${spell.spellId}-${index}`} className="rounded-lg border border-[#2a3c5f] bg-[#111c32] p-2 text-sm">
                        {spell.name}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-[#24385b] bg-[#070b14] p-4">
              <h2 className="mb-3 text-lg font-semibold text-gray-100">Current Prepared</h2>
              <div className="space-y-2">
                {currentSpells.map((spell, index) => (
                  <div key={`current-desktop-${spell.spellId}-${index}`} className="rounded-lg border border-[#2a3c5f] bg-[#111c32] px-3 py-2 text-sm">
                    {spell.name}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#24385b] bg-[#070b14] p-4">
              <h2 className="mb-3 text-lg font-semibold text-gray-100">Next Long Rest</h2>
              <div className="space-y-2">
                {nextSlots.map((slot) => (
                  <div key={`next-desktop-${slot.index}`} className={`rounded-lg border px-3 py-2 transition-colors ${diff.some((item) => item.index === slot.index) ? 'border-amber-300 bg-[#1a2238]' : 'border-[#2a3c5f] bg-[#111c32]'}`}>
                    <button
                      className="w-full text-left"
                      onClick={() => {
                        setEditState({ index: slot.index, selectedSpellId: slot.spellId, note: slot.note || '' });
                        setQuery('');
                        setEditorListOpen(false);
                      }}
                    >
                      <p className="flex items-center gap-2 text-sm">
                        <span className="text-gray-100">{slot.name}</span>
                        {replacedByIndex.has(slot.index) && (
                          <span className="text-gray-500 line-through">{replacedByIndex.get(slot.index)}</span>
                        )}
                      </p>
                      {slot.note && <p className="text-xs text-[#8ea4ca]">Note saved</p>}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {editState && (
        <section className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#2a3c5f] bg-[#0d1527] p-4">
            <p className="mb-2 text-lg font-bold text-white">
              {asSpellName(spellMap, currentList[editState.index] || null)}
            </p>
            <div className="space-y-2">
              <Input
                placeholder="Search spell name..."
                value={query}
                onFocus={() => setEditorListOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setEditorListOpen(true);
                }}
                className="border-[#2a3c5f] bg-[#111c32]"
              />
              {editorListOpen && (
                <div
                  className="max-h-52 overflow-y-auto overscroll-contain rounded-md border border-[#2a3c5f] bg-[#111c32] p-1"
                  onWheel={(event) => event.stopPropagation()}
                >
                {filteredSpells.map((spell) => (
                  <button
                    key={spell.id}
                    className={`mt-1 w-full rounded px-2 py-2 text-left text-sm ${editState.selectedSpellId === spell.id ? 'bg-[#223454] text-white' : 'text-gray-200 hover:bg-[#1a2a44]'}`}
                    onClick={() => {
                      setEditState((current) => (current ? { ...current, selectedSpellId: spell.id } : current));
                      setQuery(spell.name);
                      setEditorListOpen(false);
                    }}
                  >
                    {spell.name} <span className="text-xs text-[#90a2c0]">(Lvl {spell.level})</span>
                  </button>
                ))}
                {filteredSpells.length === 0 && <p className="px-2 py-2 text-sm text-[#90a2c0]">No matching spells.</p>}
                <button
                  className={`mt-1 w-full rounded px-2 py-2 text-left text-sm ${editState.selectedSpellId === null ? 'bg-[#223454] text-white' : 'text-gray-200 hover:bg-[#1a2a44]'}`}
                  onClick={() => {
                    setEditState((current) => (current ? { ...current, selectedSpellId: null } : current));
                    const currentSpellName = asSpellName(spellMap, currentList[editState.index] || null);
                    setQuery(`Remove ${currentSpellName}`);
                    setEditorListOpen(false);
                  }}
                >
                  Remove spell
                </button>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-lg border border-[#2a3c5f] bg-[#111c32] p-2">
              <p className="mb-2 text-sm text-[#9db2d8]">Optional Note</p>
              <Textarea
                className="min-h-20 border-[#2a3c5f] bg-[#0d1527]"
                placeholder="Capture your rationale for this change..."
                value={editState.note}
                onChange={(event) => setEditState((current) => (current ? { ...current, note: event.target.value } : current))}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditState(null); setEditorListOpen(false); }}>Cancel</Button>
              <Button disabled={busy} onClick={() => void saveSlot()}>Save</Button>
            </div>
          </div>
        </section>
      )}

      {!isMobile && (
        <section className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#24385b] bg-[#081734]/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto max-w-[1500px]">
            <button className="flex w-full items-center justify-between text-left" onClick={() => setShowSummary((current) => !current)}>
              <div>
                <p className="text-sm text-[#90a2c0]">{diff.length} Changes</p>
                <p className="font-medium">View Ritual Summary</p>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${showSummary ? 'rotate-180' : ''}`} />
            </button>

            {showSummary && (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#9eb4da]">Replaced</p>
                  {diffGroups.replaced.length === 0 ? <p className="text-xs text-[#7083a8]">None</p> : diffGroups.replaced.map(renderDiffItem)}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#9eb4da]">Removed</p>
                  {diffGroups.removed.length === 0 ? <p className="text-xs text-[#7083a8]">None</p> : diffGroups.removed.map(renderDiffItem)}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#9eb4da]">Added</p>
                  {diffGroups.added.length === 0 ? <p className="text-xs text-[#7083a8]">None</p> : diffGroups.added.map(renderDiffItem)}
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <Button disabled={busy || diff.length === 0} onClick={() => void applyAllChanges()}>
                <Check className="mr-2 h-4 w-4" />
                Apply All Changes
              </Button>
            </div>
          </div>
        </section>
      )}

      {isMobile && (
        <Drawer open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
          <DrawerTrigger asChild>
            <Button className="fixed bottom-4 right-4 z-30 h-12 rounded-full px-4">
              {diff.length} Changes
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-[#081734] text-gray-100">
            <DrawerHeader>
              <DrawerTitle>Ritual Summary</DrawerTitle>
              <DrawerDescription className="text-[#90a2c0]">Apply one change or complete the full ritual.</DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 pb-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#9eb4da]">Replaced</p>
                {diffGroups.replaced.length === 0 ? <p className="text-xs text-[#7083a8]">None</p> : diffGroups.replaced.map(renderDiffItem)}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#9eb4da]">Removed</p>
                {diffGroups.removed.length === 0 ? <p className="text-xs text-[#7083a8]">None</p> : diffGroups.removed.map(renderDiffItem)}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#9eb4da]">Added</p>
                {diffGroups.added.length === 0 ? <p className="text-xs text-[#7083a8]">None</p> : diffGroups.added.map(renderDiffItem)}
              </div>
              <Button className="w-full" disabled={busy || diff.length === 0} onClick={() => void applyAllChanges()}>
                Apply All Changes
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35">
          <div className="rounded-2xl border border-amber-300/50 bg-[#111c32] px-6 py-5 text-center shadow-2xl">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-300" />
            <p className="text-lg font-semibold text-amber-100">Long Rest Complete</p>
          </div>
        </div>
      )}

      {loading && <p className="px-6 pb-6 text-gray-400">Loading prepare state...</p>}
      {!loading && error && <p className="px-6 pb-6 text-red-400">{error}</p>}
      {actionError && <p className="px-6 pb-6 text-red-400">{actionError}</p>}
    </div>
  );
}
