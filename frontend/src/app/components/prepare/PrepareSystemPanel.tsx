import React from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
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
      <SheetContent side="right" className="border-[#24385b] bg-[#081734] text-gray-100 sm:max-w-md">
        <SheetHeader className="px-5 pt-6">
          <SheetTitle>System Panel</SheetTitle>
          <SheetDescription className="text-[#90a2c0]">Infrastructure controls for draft mode and account state.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-6">
          <div className="rounded-xl border border-[#2a3c5f] bg-[#0e1a33] p-3">
            <p className="mb-2 text-sm font-semibold text-[#c9d8f6]">Draft Status</p>
            <DraftPersistence
              saveMode={saveMode}
              draftSaveStatus={draftSaveStatus}
              draftSaveTick={draftSaveTick}
              hasChanges={hasChanges}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="min-h-10 border-[#2a3c5f] bg-[#0e1a33]" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>
              {saveMode === 'remote' ? 'Remote' : 'Local draft'}
            </Badge>
          </div>

          <div className="rounded-xl border border-[#2a3c5f] bg-[#0e1a33] p-3">
            <p className="mb-2 text-sm font-semibold text-[#c9d8f6]">Account & Session</p>
            <CharacterSwitcher showAccountDetails showCharacterControl={false} />
          </div>

          <Link to="/catalog">
            <Button className="h-10 border border-white/20 bg-white text-black hover:bg-gray-200">
              <BookOpen className="mr-2 h-4 w-4" />
              Spell Catalog
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
