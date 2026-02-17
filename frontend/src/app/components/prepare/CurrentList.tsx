import React from 'react';

interface CurrentListProps {
  currentSpells: Array<{ spellId: string; name: string }>;
  isMobile?: boolean;
}

export function CurrentList({ currentSpells, isMobile = false }: CurrentListProps) {
  return (
    <div className="space-y-2">
      {currentSpells.map((spell, index) => (
        <div
          key={`current-${spell.spellId}-${index}`}
          className={isMobile
            ? 'rounded-lg border border-[#2a3c5f] bg-[#111c32] p-2 text-sm'
            : 'rounded-lg border border-[#2a3c5f] bg-[#111c32] px-3 py-2 text-sm'}
        >
          {spell.name}
        </div>
      ))}
    </div>
  );
}
