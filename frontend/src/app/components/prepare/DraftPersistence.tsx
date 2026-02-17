import React from 'react';
import { Badge } from '../ui/badge';

interface DraftPersistenceProps {
  saveMode: 'remote' | 'local';
  draftSaveStatus: 'idle' | 'saved' | 'error';
  draftSaveTick: number;
  hasChanges: boolean;
}

export function DraftPersistence({ saveMode, draftSaveStatus, draftSaveTick, hasChanges }: DraftPersistenceProps) {
  if (!hasChanges) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
        <Badge className="border border-accent-soft bg-accent-soft text-text">No draft changes</Badge>
      </div>
    );
  }

  const statusLabel =
    draftSaveStatus === 'saved' ? `Draft saved (${draftSaveTick})` : draftSaveStatus === 'error' ? 'Draft save failed' : 'Draft saving';

  const statusClassName =
    draftSaveStatus === 'saved'
      ? 'border border-accent-soft bg-accent-soft text-text'
      : draftSaveStatus === 'error'
        ? 'bg-blood text-text'
        : 'border border-border-dark bg-bg-2 text-text';

  return (
    <div className="flex items-center gap-2">
      <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
      <Badge className={statusClassName}>{statusLabel}</Badge>
    </div>
  );
}
