import React from 'react';
import type { UiSpell } from '../types/spell';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface SpellDetailsPanelProps {
  spell?: UiSpell | null;
  title?: string;
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[#7d8aa4]">{label}</p>
      <p className="mt-1 text-sm text-gray-100">{value}</p>
    </div>
  );
}

export function SpellDetailsPanel({ spell, title = 'Spell Details' }: SpellDetailsPanelProps) {
  if (!spell) {
    return (
      <Card className="border-[#24385b] bg-[#070b14] text-gray-100">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Select a spell to view details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-[#24385b] bg-[#070b14] text-gray-100">
      <CardHeader>
        <CardTitle className="text-xl">{spell.name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 text-gray-400">
          <Badge variant="secondary" className="bg-gray-700 text-xs text-gray-100">Level {spell.level}</Badge>
          {spell.school && <Badge variant="outline" className="border-[#33507f] text-xs text-[#b6caef]">{spell.school}</Badge>}
          <Badge className={spell.prepared ? 'bg-green-600 text-white' : 'bg-[#1b2740] text-gray-100'}>
            {spell.prepared ? 'Prepared' : 'Not Prepared'}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailRow label="Source" value={spell.source.join(', ')} />
        <DetailRow label="Tags" value={spell.tags.join(', ')} />
        <div className="grid grid-cols-1 gap-3">
          <DetailRow label="Casting Time" value={spell.castingTime} />
          <DetailRow label="Range" value={spell.range} />
          <DetailRow label="Components" value={spell.components} />
          <DetailRow label="Duration" value={spell.duration} />
          <DetailRow label="Save" value={spell.save} />
          <DetailRow label="Damage" value={spell.damage} />
          <DetailRow label="Spell List" value={spell.spellList.join(', ')} />
          <DetailRow label="Preparation" value={spell.preparation} />
          <DetailRow label="Combos" value={spell.combos} />
          <DetailRow label="Items" value={spell.items} />
          <DetailRow label="Notes" value={spell.notes} />
        </div>
        <DetailRow label="Description" value={spell.description} />
      </CardContent>
    </Card>
  );
}
