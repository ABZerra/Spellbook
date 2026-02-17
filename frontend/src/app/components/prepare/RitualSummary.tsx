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
import { ApplyActions } from './ApplyActions';
import { asSpellName, groupDiff, type DuplicateWarning } from './prepareUtils';

interface RitualSummaryProps {
  isMobile: boolean;
  diff: DiffItem[];
  busy: boolean;
  spellNameById: Map<string, string>;
  duplicateWarnings: DuplicateWarning[];
  onClearDiffItem: (item: DiffItem) => void;
  onApplySingleChange: (item: DiffItem) => void;
  onApplyAllChanges: () => void;
}

function renderDiffLabel(item: DiffItem, spellNameById: Map<string, string>): string {
  const fromName = asSpellName(spellNameById, item.fromSpellId);
  const toName = asSpellName(spellNameById, item.toSpellId);

  if (item.action === 'replace') return `${fromName} -> ${toName}`;
  if (item.action === 'remove') return fromName;
  return toName;
}

function DiffItemCard({
  item,
  busy,
  spellNameById,
  onClear,
  onApply,
}: {
  item: DiffItem;
  busy: boolean;
  spellNameById: Map<string, string>;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#2a3c5f] bg-[#111c32] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-100">{renderDiffLabel(item, spellNameById)}</p>
        <ApplyActions busy={busy} onClear={onClear} onApply={onApply} />
      </div>
      {item.note && <p className="mt-2 whitespace-pre-wrap text-xs text-[#9fb3d8]">{item.note}</p>}
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
  onClearDiffItem,
  onApplySingleChange,
  onApplyAllChanges,
}: RitualSummaryProps) {
  const [showDesktopSummary, setShowDesktopSummary] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const diffGroups = useMemo(() => groupDiff(diff), [diff]);

  const content = (
    <>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#9eb4da]">Replaced</p>
        {diffGroups.replaced.length === 0
          ? <p className="text-xs text-[#7083a8]">None</p>
          : diffGroups.replaced.map((item) => (
            <DiffItemCard
              key={`replaced-${item.index}-${item.fromSpellId || 'none'}-${item.toSpellId || 'none'}`}
              item={item}
              busy={busy}
              spellNameById={spellNameById}
              onClear={() => onClearDiffItem(item)}
              onApply={() => onApplySingleChange(item)}
            />
          ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#9eb4da]">Removed</p>
        {diffGroups.removed.length === 0
          ? <p className="text-xs text-[#7083a8]">None</p>
          : diffGroups.removed.map((item) => (
            <DiffItemCard
              key={`removed-${item.index}-${item.fromSpellId || 'none'}`}
              item={item}
              busy={busy}
              spellNameById={spellNameById}
              onClear={() => onClearDiffItem(item)}
              onApply={() => onApplySingleChange(item)}
            />
          ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#9eb4da]">Added</p>
        {diffGroups.added.length === 0
          ? <p className="text-xs text-[#7083a8]">None</p>
          : diffGroups.added.map((item) => (
            <DiffItemCard
              key={`added-${item.index}-${item.toSpellId || 'none'}`}
              item={item}
              busy={busy}
              spellNameById={spellNameById}
              onClear={() => onClearDiffItem(item)}
              onApply={() => onApplySingleChange(item)}
            />
          ))}
      </div>
      <div className="space-y-2 md:col-span-3">
        <p className="text-sm font-semibold text-[#9eb4da]">Duplicate warnings</p>
        <DuplicateWarningList warnings={duplicateWarnings} spellNameById={spellNameById} />
      </div>
    </>
  );

  if (isMobile) {
    return (
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
            {content}
            <Button className="w-full min-h-11" disabled={busy || diff.length === 0} onClick={onApplyAllChanges}>
              Apply All Changes
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <section className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#24385b] bg-[#081734]/95 px-6 py-3 backdrop-blur">
      <div className="mx-auto max-w-[1500px]">
        <button className="flex w-full items-center justify-between text-left" onClick={() => setShowDesktopSummary((current) => !current)}>
          <div>
            <p className="text-sm text-[#90a2c0]">{diff.length} Changes</p>
            <p className="font-medium">View Ritual Summary</p>
          </div>
          <ChevronDown className={`h-5 w-5 transition-transform motion-reduce:transition-none ${showDesktopSummary ? 'rotate-180' : ''}`} />
        </button>

        {showDesktopSummary && (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {content}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <Button className="min-h-11" disabled={busy || diff.length === 0} onClick={onApplyAllChanges}>
            <Check className="mr-2 h-4 w-4" />
            Apply All Changes
          </Button>
        </div>
      </div>
    </section>
  );
}
