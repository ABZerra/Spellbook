import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { RuneIcon } from '../icons/RuneIcon';
import {
  CommitRitualIcon,
  ConcentrationIcon,
  DiffChangesIcon,
  DuplicateWarningIcon,
  NoteIntentIcon,
  ReplaceSpellIcon,
  RitualIcon,
  UndoChangeIcon,
} from '../icons/runeIcons';
import { SCHOOL_ICON_BY_KEY, normalizeSchoolKey } from '../icons/runeIcons';

interface SpellSocketProps {
  name: string;
  school?: string;
  isRitual?: boolean;
  isConcentration?: boolean;
  fromSpellName?: string;
  note?: string;
  hasDiff: boolean;
  duplicateCount?: number;
  showInlineActions?: boolean;
  onApplyChange?: () => void;
  onClearChange?: () => void;
  onClick: () => void;
}

export function SpellSocket({
  name,
  school,
  isRitual = false,
  isConcentration = false,
  fromSpellName,
  note,
  hasDiff,
  duplicateCount = 0,
  showInlineActions = false,
  onApplyChange,
  onClearChange,
  onClick,
}: SpellSocketProps) {
  const showActions = showInlineActions && hasDiff && (onApplyChange || onClearChange);
  const schoolKey = normalizeSchoolKey(school);
  const SchoolIcon = schoolKey ? SCHOOL_ICON_BY_KEY[schoolKey] : null;

  return (
    <div
      className={`group rounded-lg border px-3 py-2 transition-colors motion-reduce:transition-none ${hasDiff ? 'border-accent bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]' : 'border-border-dark bg-bg-2 hover:border-accent-soft'}`}
    >
      <div className="flex items-center gap-2">
        {hasDiff && (
          <RuneIcon icon={DiffChangesIcon} label="Queued change" size={16} interactive variant="muted" />
        )}

        <button className="min-w-0 flex-1 text-left" onClick={onClick} aria-label="Replace this spell">
          <p className="flex flex-wrap items-center gap-2 text-sm leading-5">
            {SchoolIcon && (
              <RuneIcon
                icon={SchoolIcon}
                label={`${school || 'Unknown'} spell`}
                size={16}
                variant="gold"
                interactive
              />
            )}

            {fromSpellName ? (
              <>
                <span className="inline-flex items-center text-text-dim line-through">{fromSpellName}</span>
                <span className="text-accent">→</span>
                <span className="inline-flex items-center text-text">{name}</span>
              </>
            ) : (
              <span className="inline-flex items-center text-text">{name}</span>
            )}

            {duplicateCount > 1 && (
              <Badge variant="destructive" className="inline-flex items-center gap-1 border border-blood-soft bg-blood text-text">
                <RuneIcon icon={DuplicateWarningIcon} label="Duplicate warning" size={12} variant="danger" interactive={false} />
                Duplicate x{duplicateCount}
              </Badge>
            )}

            {isRitual && (
              <RuneIcon icon={RitualIcon} label="Ritual spell (no slot)" size={16} interactive variant="gold" />
            )}

            {isConcentration && (
              <RuneIcon icon={ConcentrationIcon} label="Concentration required" size={16} interactive variant="gold" />
            )}

            {note && (
              <RuneIcon icon={NoteIntentIcon} label="Change note" size={16} interactive variant="gold" />
            )}
          </p>
        </button>

        <div className="flex items-center gap-1">
          {showActions && (
            <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              {onClearChange && (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-text-muted hover:text-text"
                      aria-label="Undo this change"
                      title="Undo this change"
                      onClick={(event) => {
                        event.stopPropagation();
                        onClearChange();
                      }}
                    >
                      <RuneIcon icon={UndoChangeIcon} label="" size={16} interactive={false} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Undo this change</TooltipContent>
                </Tooltip>
              )}

              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-text-muted hover:text-text"
                    aria-label="Add a note"
                    title="Add a note"
                    onClick={(event) => {
                      event.stopPropagation();
                      onClick();
                    }}
                  >
                    <RuneIcon icon={NoteIntentIcon} label="" size={16} interactive={false} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Add a note</TooltipContent>
              </Tooltip>

              {onApplyChange && (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-text-muted hover:text-text"
                      aria-label="Send this change to D&D Beyond"
                      title="Send this change to D&D Beyond"
                      onClick={(event) => {
                        event.stopPropagation();
                        onApplyChange();
                      }}
                    >
                      <RuneIcon icon={CommitRitualIcon} label="" size={16} interactive={false} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Send this change to D&amp;D Beyond</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          <Button variant="brandSecondary" size="sm" className="h-8" onClick={onClick}>
            <RuneIcon icon={ReplaceSpellIcon} label="Replace this spell" size={16} interactive={false} />
            Replace
          </Button>
        </div>
      </div>
    </div>
  );
}
