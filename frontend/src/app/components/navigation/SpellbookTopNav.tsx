import type React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';
import { RuneIcon } from '../icons/RuneIcon';
import {
  CharacterIcon,
  PreparationRitualIcon,
  SpellCatalogIcon,
  SpellbookMarkIcon,
} from '../icons/runeIcons';

function NavItem({
  to,
  label,
  tooltip,
  icon: Icon,
}: {
  to: string;
  label: string;
  tooltip: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          className={({ isActive }) => cn(
            'inline-flex items-center gap-2 rounded-md border border-border-dark px-3 py-2 text-sm transition-colors',
            isActive ? 'border-gold-soft bg-gold-soft text-gold' : 'text-text-muted hover:bg-gold-soft hover:text-gold',
          )}
        >
          <RuneIcon icon={Icon} label="" size={16} interactive={false} variant="default" />
          <span>{label}</span>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function SpellbookTopNav({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-dark bg-bg-1 p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Link to="/prepare" className="inline-flex items-center justify-center rounded-md border border-border-dark p-2 text-text-muted transition-colors hover:bg-gold-soft hover:text-gold" aria-label="Spellbook Home">
                <RuneIcon icon={SpellbookMarkIcon} label="" size={20} interactive={false} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">Spellbook Home</TooltipContent>
          </Tooltip>

          <NavItem to="/prepare" label="Prepare" tooltip="Preparation Ritual" icon={PreparationRitualIcon} />
          <NavItem to="/catalog" label="Catalog" tooltip="Spell Catalog" icon={SpellCatalogIcon} />
          <NavItem to="/characters" label="Characters" tooltip="Character List" icon={CharacterIcon} />
        </div>

        {rightSlot}
      </div>
    </div>
  );
}
