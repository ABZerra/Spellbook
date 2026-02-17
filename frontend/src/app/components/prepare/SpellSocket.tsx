import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';

interface SpellSocketProps {
  name: string;
  fromSpellName?: string;
  note?: string;
  hasDiff: boolean;
  duplicateCount?: number;
  onClick: () => void;
}

export function SpellSocket({ name, fromSpellName, note, hasDiff, duplicateCount = 0, onClick }: SpellSocketProps) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 transition-colors motion-reduce:transition-none ${hasDiff ? 'border-amber-300 bg-[#1a2238]' : 'border-[#2a3c5f] bg-[#111c32]'}`}
    >
      <button className="w-full text-left" onClick={onClick}>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-100">{name}</span>
          {fromSpellName && <span className="text-gray-500 line-through">{fromSpellName}</span>}
          {duplicateCount > 1 && (
            <Badge variant="destructive" className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Duplicate x{duplicateCount}
            </Badge>
          )}
        </p>
        {note && <p className="text-xs text-[#8ea4ca]">Note saved</p>}
      </button>
    </div>
  );
}
