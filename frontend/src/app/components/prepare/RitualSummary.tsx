import React, { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { DiffItem } from '../../types/spell';
import { Button } from '../ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../ui/drawer';
import { asSpellName, formatDiffLabel, groupDiff, type DuplicateWarning } from './prepareUtils';

interface RitualSummaryProps {
  isMobile: boolean;
  diff: DiffItem[];
  busy: boolean;
  spellNameById: Map<string, string>;
  duplicateWarnings: DuplicateWarning[];
  onApplyAllChanges: () => void;
  onDiscardAllChanges: () => void;
}

function DiffItemCard({ item, spellNameById }: { item: DiffItem; spellNameById: Map<string, string> }) {
  return (
    <div className="rounded-lg border border-[#2a3c5f] bg-[#101a30] p-3">
      <p className="text-sm text-gray-100">{formatDiffLabel(item, spellNameById)}</p>
      {item.note ? <p className="mt-2 whitespace-pre-wrap text-xs text-[#9fb3d8]">{item.note}</p> : null}
    </div>
  );
}

function DuplicateWarningList({ warnings, spellNameById }: { warnings: DuplicateWarning[]; spellNameById: Map<string, string> }) {
  if (warnings.length === 0) {
    return <p className="text-xs text-[#7083a8]">None</p>;
  }

  return (
    <div className="space-y-2">
      {warnings.map((warning) => {
        const spellName = asSpellName(spellNameById, warning.spellId);
        const slotsLabel = warning.indexes.map((index) => index + 1).join(', ');

        return (
          <div key={`dup-${warning.spellId}`} className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
            {spellName} appears in slots {slotsLabel}
          </div>
        );
      })}
    </div>
  );
}

export function RitualSummary({
  isMobile,
  diff,
  busy,
  spellNameById,
  duplicateWarnings,
  onApplyAllChanges,
  onDiscardAllChanges,
}: RitualSummaryProps) {
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [showDesktopSummary, setShowDesktopSummary] = useState(false);
  const diffGroups = useMemo(() => groupDiff(diff), [diff]);
  const hasAnyDiff = diff.length > 0;
  const hasDuplicateWarnings = duplicateWarnings.length > 0;

  const content = (
    <>
      {diffGroups.replaced.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#9eb4da]">Replaced</p>
          {diffGroups.replaced.map((item) => (
            <DiffItemCard
              key={`replaced-${item.index}-${item.fromSpellId || 'none'}-${item.toSpellId || 'none'}`}
              item={item}
              spellNameById={spellNameById}
            />
          ))}
        </div>
      )}

      {diffGroups.removed.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#9eb4da]">Removed</p>
          {diffGroups.removed.map((item) => (
            <DiffItemCard
              key={`removed-${item.index}-${item.fromSpellId || 'none'}`}
              item={item}
              spellNameById={spellNameById}
            />
          ))}
        </div>
      )}

      {diffGroups.added.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#9eb4da]">Added</p>
          {diffGroups.added.map((item) => (
            <DiffItemCard
              key={`added-${item.index}-${item.toSpellId || 'none'}`}
              item={item}
              spellNameById={spellNameById}
            />
          ))}
        </div>
      )}

      {hasDuplicateWarnings && (
        <div className="space-y-2 md:col-span-3">
          <p className="text-sm font-semibold text-[#9eb4da]">Duplicate warnings</p>
          <DuplicateWarningList warnings={duplicateWarnings} spellNameById={spellNameById} />
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
        <DrawerTrigger asChild>
          <Button className="fixed bottom-4 right-4 z-30 h-12 rounded-full px-4">
            {diff.length} queued
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-[#081734] text-gray-100">
          <DrawerHeader>
            <DrawerTitle>Queued Ritual Changes</DrawerTitle>
            <DrawerDescription className="text-[#90a2c0]">Review queued changes before applying.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 pb-4">
            {hasAnyDiff ? content : <p className="rounded-lg border border-[#2a3c5f] bg-[#101a30] px-3 py-2 text-sm text-[#90a2c0]">No queued changes.</p>}
            <div className="flex gap-2">
              <Button className="flex-1 min-h-11" disabled={busy || !hasAnyDiff} onClick={onApplyAllChanges}>
                Apply All
              </Button>
              <Button className="flex-1 min-h-11" variant="destructive" disabled={busy || !hasAnyDiff} onClick={onDiscardAllChanges}>
                Discard All
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!hasAnyDiff) return null;

  return (
    <section className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#24385b] bg-[#081734]/95 px-6 py-2 backdrop-blur">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2a3c5f] bg-[#101a30] px-3 py-2">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setShowDesktopSummary((current) => !current)}
          >
            <p className="text-sm text-[#90a2c0]">{diff.length} changes queued</p>
            <ChevronDown className={`h-4 w-4 text-[#90a2c0] transition-transform ${showDesktopSummary ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center gap-2">
            <Button className="min-h-10" variant="destructive" disabled={busy || !hasAnyDiff} onClick={onDiscardAllChanges}>
              Discard All
            </Button>
            <Button className="min-h-10" disabled={busy || !hasAnyDiff} onClick={onApplyAllChanges}>
              <Check className="mr-2 h-4 w-4" />
              Apply All
            </Button>
          </div>
        </div>

        {showDesktopSummary && (
          <div className="mt-3 max-h-[28vh] space-y-3 overflow-y-auto pb-1 md:grid md:grid-cols-3 md:gap-3 md:space-y-0">
            {content}
          </div>
        )}
      </div>
    </section>
  );
}
