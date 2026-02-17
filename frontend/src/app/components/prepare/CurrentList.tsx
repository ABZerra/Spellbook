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
            ? 'rounded-lg border border-border-dark bg-bg-2 p-2 text-sm text-text'
            : 'rounded-lg border border-border-dark bg-bg-2 px-3 py-2 text-sm text-text-muted opacity-85'}
        >
          {spell.name}
        </div>
      ))}
    </div>
  );
}
