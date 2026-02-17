import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CircleHelp, Sparkles, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import type { DiffItem } from '../types/spell';
import { CharacterSwitcher } from '../components/CharacterSwitcher';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { useIsMobile } from '../components/ui/use-mobile';
import { CurrentList } from '../components/prepare/CurrentList';
import { NextList } from '../components/prepare/NextList';
import { PrepareSystemPanel } from '../components/prepare/PrepareSystemPanel';
import { RitualSummary } from '../components/prepare/RitualSummary';
import { SearchAutocomplete } from '../components/prepare/SearchAutocomplete';
import {
  asSpellName,
  buildDuplicateIndexMap,
  getDuplicateWarningForSelection,
  getDuplicateWarnings,
} from '../components/prepare/prepareUtils';

interface EditState {
  index: number;
  selectedSpellId: string | null;
  note: string;
}

function formatDuplicateWarning(
  warning: { indexes: number[] } | null,
  selectedSpellName: string,
  activeIndex: number,
): string | null {
  if (!warning) return null;

  const otherSlots = warning.indexes.filter((index) => index !== activeIndex).map((index) => index + 1);
  if (otherSlots.length === 0) return null;

  return `${selectedSpellName} is already selected in slot${otherSlots.length === 1 ? '' : 's'} ${otherSlots.join(', ')}. Duplicates are allowed, but review before applying.`;
}

export function PreparePage() {
  const {
    spells,
    loading,
    error,
    saveMode,
    draftSaveStatus,
    draftSaveTick,
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
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [animateChangeBadge, setAnimateChangeBadge] = useState(false);

  const nextCount = useMemo(() => nextList.filter((slot) => slot.spellId).length, [nextList]);

  useEffect(() => {
    setAnimateChangeBadge(true);
    const timeout = setTimeout(() => setAnimateChangeBadge(false), 220);
    return () => clearTimeout(timeout);
  }, [diff.length]);

  const spellMap = useMemo(() => new Map(spells.map((spell) => [spell.id, spell.name])), [spells]);
  const currentSpells = useMemo(
    () => currentList.map((spellId) => ({ spellId, name: asSpellName(spellMap, spellId) })),
    [currentList, spellMap],
  );

  const replacedByIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of diff) {
      if (item.action !== 'replace') continue;
      map.set(item.index, asSpellName(spellMap, item.fromSpellId));
    }
    return map;
  }, [diff, spellMap]);

  const duplicateWarnings = useMemo(() => getDuplicateWarnings(nextList), [nextList]);
  const duplicateCountByIndex = useMemo(() => buildDuplicateIndexMap(duplicateWarnings), [duplicateWarnings]);

  const selectedDuplicateWarning = useMemo(
    () => getDuplicateWarningForSelection(duplicateWarnings, editState?.selectedSpellId || null, editState?.index ?? -1),
    [duplicateWarnings, editState],
  );

  const duplicateWarningText = useMemo(() => {
    if (!editState) return null;
    const selectedSpellName = asSpellName(spellMap, editState.selectedSpellId);
    return formatDuplicateWarning(selectedDuplicateWarning, selectedSpellName, editState.index);
  }, [editState, selectedDuplicateWarning, spellMap]);

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
      toast(message);
    });
  }

  async function applyAllChanges() {
    const count = diff.length;

    await run(async () => {
      await applyAll();
      setShowComplete(true);
      toast(`Long Rest Updated: applied ${count} change${count === 1 ? '' : 's'}.`);

      const prefersReducedMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const durationMs = prefersReducedMotion ? 0 : 1400;
      setTimeout(() => setShowComplete(false), durationMs);
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

  async function applySingleChangeByIndex(index: number) {
    const item = diff.find((entry) => entry.index === index);
    if (!item) return;
    await applySingleChange(item);
  }

  async function clearDiffByIndex(index: number) {
    const item = diff.find((entry) => entry.index === index);
    if (!item) return;
    await clearDiffItem(item);
  }

  return (
    <div className="min-h-screen bg-[#040a17] pb-44 text-gray-100">
      <header className="border-b border-[#1b2a46] bg-[#07142d]">
        <div className="mx-auto max-w-[1500px] px-6 py-4">
          <div className="rounded-2xl border border-[#253a5f] bg-[#081734] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wand2 className="h-7 w-7 text-amber-300" />
                <div>
                  <h1 className="text-2xl font-semibold">✨ Preparation Ritual</h1>
                  <p className="text-sm text-[#90a2c0]">Edit next long rest spells</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link to="/catalog">
                  <Button variant="outline" className="h-10 border-[#2a3c5f] bg-[#0e1a33] text-gray-100 hover:bg-[#162744]">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Catalog
                  </Button>
                </Link>
                <CharacterSwitcher showAccountDetails={false} />
                <PrepareSystemPanel
                  saveMode={saveMode}
                  draftSaveStatus={draftSaveStatus}
                  draftSaveTick={draftSaveTick}
                  hasChanges={diff.length > 0}
                  onRefresh={() => {
                    void refreshNow();
                  }}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#9eb4da] hover:text-gray-100" title="Open system panel">
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-[#b8c8e4]">
              <span>Current {currentList.length}</span>
              <span className="text-[#7488b0]">→</span>
              <span>Next {nextCount}</span>
              <Badge
                className={`ml-2 bg-amber-500 text-black transition-transform motion-reduce:transition-none ${animateChangeBadge ? 'scale-105' : 'scale-100'}`}
              >
                {diff.length} Changes
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-6 py-8 md:grid-cols-2">
        {isMobile ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-100">✨ Next Long Rest</h2>
            <NextList
              slots={nextList}
              diff={diff}
              spellNameById={spellMap}
              replacedByIndex={replacedByIndex}
              duplicateCountByIndex={duplicateCountByIndex}
              onApplySingleChangeByIndex={(index) => {
                void applySingleChangeByIndex(index);
              }}
              onClearDiffByIndex={(index) => {
                void clearDiffByIndex(index);
              }}
              onRequestEdit={(index, slot) => {
                setEditState({ index, selectedSpellId: slot.spellId, note: slot.note || '' });
              }}
            />

            <Accordion type="single" collapsible className="rounded-xl border border-[#2a3c5f] bg-[#0d1527] px-3">
              <AccordionItem value="current">
                <AccordionTrigger>Current Prepared</AccordionTrigger>
                <AccordionContent>
                  <CurrentList currentSpells={currentSpells} isMobile />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-[#1f2f4c] bg-[#091325] p-4">
              <h2 className="mb-3 text-base font-medium text-[#93a8d0]">Current Prepared</h2>
              <CurrentList currentSpells={currentSpells} />
            </section>

            <section className="rounded-2xl border border-[#2f4770] bg-[#0c1a33] p-4 shadow-[0_0_0_1px_rgba(250,209,120,0.2)]">
              <h2 className="mb-3 text-lg font-semibold text-gray-100">✨ Next Long Rest</h2>
              <NextList
                slots={nextList}
                diff={diff}
                spellNameById={spellMap}
                replacedByIndex={replacedByIndex}
                duplicateCountByIndex={duplicateCountByIndex}
                onApplySingleChangeByIndex={(index) => {
                  void applySingleChangeByIndex(index);
                }}
                onClearDiffByIndex={(index) => {
                  void clearDiffByIndex(index);
                }}
                onRequestEdit={(index, slot) => {
                  setEditState({ index, selectedSpellId: slot.spellId, note: slot.note || '' });
                }}
              />
            </section>
          </>
        )}
      </main>

      <SearchAutocomplete
        open={Boolean(editState)}
        busy={busy}
        currentSpellName={asSpellName(spellMap, editState ? currentList[editState.index] || null : null)}
        selectedSpellId={editState?.selectedSpellId || null}
        note={editState?.note || ''}
        duplicateWarningText={duplicateWarningText}
        options={spells}
        onSelectedSpellIdChange={(spellId) => {
          setEditState((current) => (current ? { ...current, selectedSpellId: spellId } : current));
        }}
        onNoteChange={(note) => {
          setEditState((current) => (current ? { ...current, note } : current));
        }}
        onSave={() => {
          void saveSlot();
        }}
        onClose={() => {
          setEditState(null);
        }}
      />

      <RitualSummary
        isMobile={isMobile}
        diff={diff}
        busy={busy}
        spellNameById={spellMap}
        duplicateWarnings={duplicateWarnings}
        onClearDiffItem={(item) => {
          void clearDiffItem(item);
        }}
        onApplySingleChange={(item) => {
          void applySingleChange(item);
        }}
        onApplyAllChanges={() => {
          void applyAllChanges();
        }}
      />

      {showComplete && (
        <div className="prepare-complete-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/35 motion-reduce:animate-none">
          <div className="rounded-2xl border border-amber-300/50 bg-[#111c32] px-6 py-5 text-center shadow-2xl motion-reduce:transition-none">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-300" />
            <p className="text-lg font-semibold text-amber-100">Long Rest Updated</p>
          </div>
        </div>
      )}

      {loading && <p className="px-6 pb-6 text-gray-400">Loading prepare state...</p>}
      {!loading && error && <p className="px-6 pb-6 text-red-400">{error}</p>}
      {actionError && <p className="px-6 pb-6 text-red-400">{actionError}</p>}
    </div>
  );
}
