import React from 'react';
import type { UiSpell } from '../../types/spell';
import { RuneIcon } from '../icons/RuneIcon';
import { ConcentrationIcon, RitualIcon } from '../icons/runeIcons';
import { SCHOOL_ICON_BY_KEY, normalizeSchoolKey } from '../icons/runeIcons';
import { spellHasConcentration, spellHasRitual } from '../../utils/spellIconUtils';

interface CurrentListProps {
  currentSpells: Array<{ spellId: string; name: string; spell?: UiSpell | null }>;
  isMobile?: boolean;
}

export function CurrentList({ currentSpells, isMobile = false }: CurrentListProps) {
  return (
    <div className="space-y-2">
      {currentSpells.map((entry, index) => {
        const schoolKey = normalizeSchoolKey(entry.spell?.school);
        const SchoolIcon = schoolKey ? SCHOOL_ICON_BY_KEY[schoolKey] : null;
        const hasRitual = Boolean(entry.spell && spellHasRitual(entry.spell));
        const hasConcentration = Boolean(entry.spell && spellHasConcentration(entry.spell));

        return (
          <div
            key={`current-${entry.spellId}-${index}`}
            className={isMobile
              ? 'rounded-lg border border-border-dark bg-bg-2 p-2 text-sm text-text'
              : 'rounded-lg border border-border-dark bg-bg-2 px-3 py-2 text-sm text-text-muted opacity-85'}
          >
            <div className="flex flex-wrap items-center gap-2">
              {SchoolIcon && <RuneIcon icon={SchoolIcon} label={`${entry.spell?.school || 'Unknown'} spell`} size={16} interactive variant="gold" />}
              <span>{entry.name}</span>
              {hasRitual && <RuneIcon icon={RitualIcon} label="Ritual spell (no slot)" size={16} interactive variant="gold" />}
              {hasConcentration && <RuneIcon icon={ConcentrationIcon} label="Concentration required" size={16} interactive variant="gold" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
