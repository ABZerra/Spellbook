import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { RuneIcon } from '../icons/RuneIcon';
import {
  CommitRitualIcon,
  DiffChangesIcon,
  DiscardPlanIcon,
  NoteIntentIcon,
  ReplaceSpellIcon,
  UndoChangeIcon,
} from '../icons/runeIcons';
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
    <div className="rounded-lg border border-border-dark bg-bg-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <RuneIcon icon={DiffChangesIcon} label="Queued change" size={16} variant="muted" interactive />
          <p className="text-sm text-text">{formatDiffLabel(item, spellNameById)}</p>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button type="button" className="rounded-md p-1 text-text-muted hover:bg-gold-soft hover:text-gold" aria-label="Undo this change">
                <RuneIcon icon={UndoChangeIcon} label="" size={16} interactive={false} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Undo this change</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button type="button" className="rounded-md p-1 text-text-muted hover:bg-gold-soft hover:text-gold" aria-label="Add a note">
                <RuneIcon icon={NoteIntentIcon} label="" size={16} interactive={false} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Add a note</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button type="button" className="rounded-md p-1 text-text-muted hover:bg-gold-soft hover:text-gold" aria-label="Replace again">
                <RuneIcon icon={ReplaceSpellIcon} label="" size={16} interactive={false} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Replace again</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {item.note ? (
        <div className="mt-2 inline-flex items-center gap-2">
          <RuneIcon icon={NoteIntentIcon} label="Change note" size={14} variant="gold" interactive />
          <p className="whitespace-pre-wrap text-xs text-text-muted">{item.note}</p>
        </div>
      ) : null}
    </div>
  );
}

function DuplicateWarningList({ warnings, spellNameById }: { warnings: DuplicateWarning[]; spellNameById: Map<string, string> }) {
  if (warnings.length === 0) {
    return <p className="text-xs text-text-dim">None</p>;
  }

  return (
    <div className="space-y-2">
      {warnings.map((warning) => {
        const spellName = asSpellName(spellNameById, warning.spellId);
        const slotsLabel = warning.indexes.map((index) => index + 1).join(', ');

        return (
          <div key={`dup-${warning.spellId}`} className="rounded-lg border border-accent-soft bg-accent-soft px-3 py-2 text-sm text-text">
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
          <p className="font-display text-sm font-semibold text-gold">Replaced</p>
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
          <p className="font-display text-sm font-semibold text-gold">Removed</p>
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
          <p className="font-display text-sm font-semibold text-gold">Added</p>
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
          <p className="font-display text-sm font-semibold text-gold">Duplicate warnings</p>
          <DuplicateWarningList warnings={duplicateWarnings} spellNameById={spellNameById} />
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={mobileSummaryOpen} onOpenChange={setMobileSummaryOpen}>
        <DrawerTrigger asChild>
          <Button variant="brandPrimary" className="fixed bottom-4 right-4 z-30 h-12 rounded-full px-4">
            <RuneIcon icon={DiffChangesIcon} label="Changes waiting to apply" size={16} interactive={false} />
            {diff.length} changes queued
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-bg-1 text-text">
          <DrawerHeader>
            <DrawerTitle className="font-display text-gold">Queued Ritual Changes</DrawerTitle>
            <DrawerDescription className="text-text-muted">Review queued changes before applying.</DrawerDescription>
          </DrawerHeader>
          <div className="arcane-scrollbar max-h-[60vh] space-y-3 overflow-y-auto px-4 pb-4">
            {hasAnyDiff ? content : <p className="rounded-lg border border-border-dark bg-bg-2 px-3 py-2 text-sm text-text-muted">No queued changes.</p>}
            <div className="flex gap-2">
              <Button variant="brandPrimary" className="flex-1 min-h-11" disabled={busy || !hasAnyDiff} onClick={onApplyAllChanges}>
                <RuneIcon icon={CommitRitualIcon} label="Commit preparation plan" size={16} interactive={false} />
                Apply All
              </Button>
              <Button className="flex-1 min-h-11" variant="brandSecondary" disabled={busy || !hasAnyDiff} onClick={onDiscardAllChanges}>
                <RuneIcon icon={DiscardPlanIcon} label="Discard preparation plan" size={16} interactive={false} />
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
    <section className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-dark bg-bg-1/95 px-6 py-2 backdrop-blur">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border-dark bg-bg-2 px-3 py-2">
          <button className="flex items-center gap-2 text-left" onClick={() => setShowDesktopSummary((current) => !current)}>
            <RuneIcon icon={DiffChangesIcon} label="Changes waiting to apply" size={16} variant="gold" interactive />
            <p className="text-sm text-text-muted">{diff.length} changes queued</p>
            <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${showDesktopSummary ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center gap-2">
            <Button className="min-h-10" variant="brandSecondary" disabled={busy || !hasAnyDiff} onClick={onDiscardAllChanges}>
              <RuneIcon icon={DiscardPlanIcon} label="Discard preparation plan" size={16} interactive={false} />
              Discard All
            </Button>
            <Button className="min-h-10" variant="brandPrimary" disabled={busy || !hasAnyDiff} onClick={onApplyAllChanges}>
              <RuneIcon icon={CommitRitualIcon} label="Commit preparation plan" size={16} interactive={false} />
              Apply All
            </Button>
          </div>
        </div>

        {showDesktopSummary && (
          <div className="arcane-scrollbar mt-3 max-h-[28vh] space-y-3 overflow-y-auto pb-1 md:grid md:grid-cols-3 md:gap-3 md:space-y-0">
            {content}
          </div>
        )}
      </div>
    </section>
  );
}
