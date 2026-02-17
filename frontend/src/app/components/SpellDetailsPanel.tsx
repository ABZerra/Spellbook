import React from 'react';
import type { UiSpell } from '../types/spell';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { SchoolTag } from './SchoolTag';

interface SpellDetailsPanelProps {
  spell?: UiSpell | null;
  title?: string;
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="mt-1 text-sm text-ink">{value}</p>
    </div>
  );
}

export function SpellDetailsPanel({ spell, title = 'Spell Details' }: SpellDetailsPanelProps) {
  if (!spell) {
    return (
      <Card className="rounded-2xl border border-paper-border bg-paper text-ink shadow-insetPaper">
        <CardHeader>
          <CardTitle className="font-display text-[20px] text-ink">{title}</CardTitle>
          <CardDescription className="text-ink-muted">Select a spell to view details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-paper-border bg-paper text-ink shadow-insetPaper">
      <CardHeader>
        <CardTitle className="font-display text-[20px] text-ink">{spell.name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 text-ink-muted">
          <Badge variant="outline" className="border-accent-soft text-xs text-ink">Level {spell.level}</Badge>
          {spell.school && <SchoolTag school={spell.school} surface="paper" />}
          <Badge className={spell.prepared ? 'border border-accent-soft bg-accent-soft text-ink' : 'border border-paper-border bg-paper-2 text-ink'}>
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
