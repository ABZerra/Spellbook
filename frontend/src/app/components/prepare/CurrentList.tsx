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
            ? 'rounded-lg border border-[#223453] bg-[#0d1527] p-2 text-sm text-[#b1c1de]'
            : 'rounded-lg border border-[#1e2e49] bg-[#0b1323] px-3 py-2 text-sm text-[#9cb0d6] opacity-85'}
        >
          {spell.name}
        </div>
      ))}
    </div>
  );
}
