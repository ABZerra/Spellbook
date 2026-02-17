import React from 'react';
import { AlertTriangle, Check, Eraser, Pencil, ScrollText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface SpellSocketProps {
  name: string;
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

  return (
    <div
      className={`group rounded-lg border px-3 py-2 transition-colors motion-reduce:transition-none ${hasDiff ? 'border-gold bg-gold-soft/20 shadow-[inset_3px_0_0_var(--gold)]' : 'border-border-dark bg-bg-2 hover:border-gold-soft'}`}
    >
      <div className="flex items-center gap-2">
        <button className="min-w-0 flex-1 text-left" onClick={onClick}>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {fromSpellName ? (
              <>
                <span className="text-text-dim line-through">{fromSpellName}</span>
                <span className="text-gold">→</span>
                <span className="text-text">{name}</span>
              </>
            ) : (
              <span className="text-text">{name}</span>
            )}
            {duplicateCount > 1 && (
              <Badge variant="destructive" className="inline-flex items-center gap-1 border border-blood-soft bg-blood text-text">
                <AlertTriangle className="h-3 w-3" />
                Duplicate x{duplicateCount}
              </Badge>
            )}
            {note && (
              <span className="inline-flex items-center text-gold" title="Note saved">
                <ScrollText className="h-3.5 w-3.5" />
              </span>
            )}
          </p>
        </button>

        <div className="flex items-center gap-1">
          {showActions && (
            <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              {onClearChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-text-muted hover:text-text"
                  title="Clear this change"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClearChange();
                  }}
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              )}
              {onApplyChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gold hover:text-gold-2"
                  title="Apply this change"
                  onClick={(event) => {
                    event.stopPropagation();
                    onApplyChange();
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-text" title="Edit slot" onClick={onClick}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
