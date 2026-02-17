import React from 'react';
import { Button } from '../ui/button';

interface ApplyActionsProps {
  busy: boolean;
  onClear: () => void;
  onApply: () => void;
}

export function ApplyActions({ busy, onClear, onApply }: ApplyActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={onClear}>
        Undo
      </Button>
      <Button size="sm" className="min-h-11" disabled={busy} onClick={onApply}>
        Apply
      </Button>
    </div>
  );
}
