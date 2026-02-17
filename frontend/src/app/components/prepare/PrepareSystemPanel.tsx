import React from 'react';
import { RefreshCw } from 'lucide-react';
import { CharacterSwitcher } from '../CharacterSwitcher';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { DraftPersistence } from './DraftPersistence';

interface PrepareSystemPanelProps {
  saveMode: 'remote' | 'local';
  draftSaveStatus: 'idle' | 'saved' | 'error';
  draftSaveTick: number;
  hasChanges: boolean;
  onRefresh: () => void;
  trigger: React.ReactNode;
}

export function PrepareSystemPanel({
  saveMode,
  draftSaveStatus,
  draftSaveTick,
  hasChanges,
  onRefresh,
  trigger,
}: PrepareSystemPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="right" className="border-border-dark bg-bg-1 text-text sm:max-w-md">
        <SheetHeader className="px-5 pt-6">
          <SheetTitle className="font-display text-gold">System Panel</SheetTitle>
          <SheetDescription className="text-text-muted">Infrastructure controls for draft mode and account state.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-6">
          <div className="rounded-xl border border-border-dark bg-bg-2 p-3">
            <p className="mb-2 font-display text-sm font-semibold text-gold">Draft Status</p>
            <DraftPersistence
              saveMode={saveMode}
              draftSaveStatus={draftSaveStatus}
              draftSaveTick={draftSaveTick}
              hasChanges={hasChanges}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="brandSecondary"
              className="min-h-10"
              onClick={onRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Badge className={saveMode === 'remote' ? 'border border-gold-soft bg-gold-soft text-text' : 'border border-border-dark bg-bg-2 text-text'}>
              {saveMode === 'remote' ? 'Remote' : 'Local draft'}
            </Badge>
          </div>

          <div className="rounded-xl border border-border-dark bg-bg-2 p-3">
            <p className="mb-2 font-display text-sm font-semibold text-gold">Account & Session</p>
            <CharacterSwitcher showAccountDetails showCharacterControl={false} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
