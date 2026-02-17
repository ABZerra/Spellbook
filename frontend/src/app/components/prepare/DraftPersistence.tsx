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
        <Badge className="bg-[#1b2740] text-gray-100">No draft changes</Badge>
      </div>
    );
  }

  const statusLabel =
    draftSaveStatus === 'saved' ? `Draft saved (${draftSaveTick})` : draftSaveStatus === 'error' ? 'Draft save failed' : 'Draft saving';

  const statusClassName =
    draftSaveStatus === 'saved'
      ? 'bg-emerald-600 text-white'
      : draftSaveStatus === 'error'
        ? 'bg-red-600 text-white'
        : 'bg-[#1b2740] text-gray-100';

  return (
    <div className="flex items-center gap-2">
      <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
      <Badge className={statusClassName}>{statusLabel}</Badge>
    </div>
  );
}
