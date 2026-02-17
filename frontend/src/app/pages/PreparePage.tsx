import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { PrepareSpellDrawer } from '../components/prepare/PrepareSpellDrawer';
import { RitualSummary } from '../components/prepare/RitualSummary';
import {
  asSpellName,
  buildDuplicateIndexMap,
  formatDiffLabel,
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
    setSlotNote,
    applyOne,
    applyAll,
    clearPendingActions,
  } = useApp();

  const isMobile = useIsMobile();
  const [editState, setEditState] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [animateChangeBadge, setAnimateChangeBadge] = useState(false);
  const slotPersistTimerRef = useRef<number | null>(null);
  const notePersistTimerRef = useRef<number | null>(null);

  const nextCount = useMemo(() => nextList.filter((slot) => slot.spellId).length, [nextList]);

  useEffect(() => {
    setAnimateChangeBadge(true);
    const timeout = setTimeout(() => setAnimateChangeBadge(false), 220);
    return () => clearTimeout(timeout);
  }, [diff.length]);

  useEffect(() => {
    return () => {
      if (slotPersistTimerRef.current) window.clearTimeout(slotPersistTimerRef.current);
      if (notePersistTimerRef.current) window.clearTimeout(notePersistTimerRef.current);
    };
  }, []);

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

  function queueSlotPersist(index: number, spellId: string | null, note: string, announce: boolean) {
    if (slotPersistTimerRef.current) window.clearTimeout(slotPersistTimerRef.current);

    slotPersistTimerRef.current = window.setTimeout(() => {
      void run(async () => {
        await setNextSlot(index, spellId, note);
        if (announce) {
          toast('Change queued.');
        }
      });
    }, 300);
  }

  function queueNotePersist(index: number, note: string) {
    if (notePersistTimerRef.current) window.clearTimeout(notePersistTimerRef.current);

    notePersistTimerRef.current = window.setTimeout(() => {
      void run(async () => {
        await setSlotNote(index, note);
      });
    }, 350);
  }

  async function applyAllChanges() {
    const summaryLines = diff.map((item) => formatDiffLabel(item, spellMap));

    await run(async () => {
      await applyAll();
      setShowComplete(true);

      const visibleLines = summaryLines.slice(0, 3);
      const overflow = summaryLines.length - visibleLines.length;
      const detail = visibleLines.length > 0 ? ` ${visibleLines.join(' • ')}` : '';
      const overflowLabel = overflow > 0 ? ` (+${overflow} more)` : '';
      toast(`Long Rest Updated.${detail}${overflowLabel}`);

      const prefersReducedMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const durationMs = prefersReducedMotion ? 0 : 1400;
      setTimeout(() => setShowComplete(false), durationMs);
    });
  }

  async function clearDiffItem(item: DiffItem) {
    const restoreSpellId = item.action === 'add' ? null : item.fromSpellId || null;

    await run(async () => {
      await setNextSlot(item.index, restoreSpellId);
      toast('Change undone.');
    });
  }

  async function applySingleChange(item: DiffItem) {
    await run(async () => {
      await applyOne(item);
      toast(`Applied: ${formatDiffLabel(item, spellMap)}.`);
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

  async function discardAllChanges() {
    await run(async () => {
      await clearPendingActions();
      toast('Discarded all queued changes.');
    });
  }

  return (
    <div className="min-h-screen bg-bg pb-44 text-text">
      <header className="border-b border-border-dark bg-bg-2">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="rounded-2xl border border-border-dark bg-bg-1 p-4 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wand2 className="h-7 w-7 text-accent" />
                <div>
                  <h1 className="font-display text-[32px] leading-10 tracking-wide text-text">Preparation Ritual</h1>
                  <p className="text-sm text-text-muted">Plan your next long rest loadout in one flow</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link to="/catalog">
                  <Button variant="brandSecondary" className="h-10">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Spell Catalog
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-text" title="Open system panel">
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[minmax(0,1fr)_max-content]">
        {isMobile ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[18px] leading-6 tracking-wide text-gold">Next Long Rest Planned Spell List</h2>
              <div className="h-px w-10 bg-gold-soft" />
              <Badge className="border border-accent-soft bg-accent-soft text-text">{nextCount}</Badge>
              <Badge
                className={`border border-accent-soft bg-accent-soft text-text transition-transform motion-reduce:transition-none ${animateChangeBadge ? 'scale-105' : 'scale-100'}`}
              >
                {diff.length} Changes
              </Badge>
            </div>
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

            <Accordion type="single" collapsible className="rounded-xl border border-border-dark bg-bg-1 px-3">
              <AccordionItem value="current">
                <AccordionTrigger className="gap-2">
                  <span>Current Active Spell List</span>
                  <Badge className="border border-accent-soft bg-accent-soft text-text">{currentList.length}</Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <CurrentList currentSpells={currentSpells} isMobile />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-border-dark bg-bg-1 p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-display text-[18px] leading-6 tracking-wide text-gold">Next Long Rest Planned Spell List</h2>
                <div className="h-px w-10 bg-gold-soft" />
                <Badge className="border border-accent-soft bg-accent-soft text-text">{nextCount}</Badge>
                <Badge
                  className={`border border-accent-soft bg-accent-soft text-text transition-transform motion-reduce:transition-none ${animateChangeBadge ? 'scale-105' : 'scale-100'}`}
                >
                  {diff.length} Changes
                </Badge>
              </div>
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

            <section className="rounded-2xl border border-border-dark bg-bg-1 p-4 shadow-panel">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-display text-[18px] leading-6 tracking-wide text-gold">Current Active Spell List</h2>
                <div className="h-px w-10 bg-gold-soft" />
                <Badge className="border border-accent-soft bg-accent-soft text-text">{currentList.length}</Badge>
              </div>
              <CurrentList currentSpells={currentSpells} />
            </section>
          </>
        )}
      </main>

      <PrepareSpellDrawer
        open={Boolean(editState)}
        isMobile={isMobile}
        busy={busy}
        currentSpellName={asSpellName(spellMap, editState ? currentList[editState.index] || null : null)}
        selectedSpellId={editState?.selectedSpellId || null}
        note={editState?.note || ''}
        duplicateWarningText={duplicateWarningText}
        options={spells}
        onOpenChange={(open) => {
          if (!open) setEditState(null);
        }}
        onSelectedSpellIdChange={(spellId) => {
          setEditState((current) => {
            if (!current) return current;
            const isMeaningfulChange = current.selectedSpellId !== spellId;
            queueSlotPersist(current.index, spellId, current.note, isMeaningfulChange);
            return { ...current, selectedSpellId: spellId };
          });
        }}
        onNoteChange={(note) => {
          setEditState((current) => {
            if (!current) return current;
            queueNotePersist(current.index, note);
            return { ...current, note };
          });
        }}
      />

      <RitualSummary
        isMobile={isMobile}
        diff={diff}
        busy={busy}
        spellNameById={spellMap}
        duplicateWarnings={duplicateWarnings}
        onApplyAllChanges={() => {
          void applyAllChanges();
        }}
        onDiscardAllChanges={() => {
          void discardAllChanges();
        }}
      />

      {showComplete && (
        <div className="prepare-complete-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm motion-reduce:animate-none">
          <div className="rounded-2xl border border-accent-soft bg-bg-1 px-6 py-5 text-center shadow-panel motion-reduce:transition-none">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-accent" />
            <p className="font-display text-lg font-semibold text-text">Long Rest Updated</p>
          </div>
        </div>
      )}

      {loading && <p className="px-6 pb-6 text-text-muted">Loading prepare state...</p>}
      {!loading && error && <p className="px-6 pb-6 text-blood-2">{error}</p>}
      {actionError && <p className="px-6 pb-6 text-blood-2">{actionError}</p>}
    </div>
  );
}
