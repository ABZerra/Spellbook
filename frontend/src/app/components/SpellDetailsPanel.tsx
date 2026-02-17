import React from 'react';
import type { UiSpell } from '../types/spell';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { SchoolTag } from './SchoolTag';
import { RuneIcon } from './icons/RuneIcon';
import {
  AttackRollIcon,
  ConcentrationIcon,
  DamageIcon,
  HealingIcon,
  MaterialIcon,
  RitualIcon,
  SaveIcon,
  SomaticIcon,
  VerbalIcon,
} from './icons/runeIcons';
import { parseComponentsFlags, spellHasConcentration, spellHasRitual } from '../utils/spellIconUtils';

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
      <Card className="rounded-2xl border border-paper-border bg-paper text-ink shadow-insetPaper spellbook-paper-watermark">
        <CardHeader>
          <CardTitle className="font-display text-[20px] text-ink">{title}</CardTitle>
          <CardDescription className="text-ink-muted">Select a spell to view details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasRitual = spellHasRitual(spell);
  const hasConcentration = spellHasConcentration(spell);
  const componentFlags = parseComponentsFlags(spell.components);
  const isHealing = /heal|restor/i.test(`${spell.description} ${spell.damage}`);

  return (
    <Card className="rounded-2xl border border-paper-border bg-paper text-ink shadow-insetPaper spellbook-paper-watermark">
      <CardHeader>
        <CardTitle className="font-display text-[20px] text-ink">{spell.name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 text-ink-muted">
          <Badge variant="outline" className="border-accent-soft text-xs text-ink">Level {spell.level}</Badge>
          {spell.school && <SchoolTag school={spell.school} surface="paper" />}
          {hasRitual && <RuneIcon icon={RitualIcon} label="Ritual spell (no slot)" size={16} variant="gold" interactive />}
          {hasConcentration && <RuneIcon icon={ConcentrationIcon} label="Concentration required" size={16} variant="gold" interactive />}
          <Badge className={spell.prepared ? 'border border-accent-soft bg-accent-soft text-ink' : 'border border-paper-border bg-paper-2 text-ink'}>
            {spell.prepared ? 'Prepared' : 'Not Prepared'}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailRow label="Source" value={spell.source.join(', ')} />
        <DetailRow label="Tags" value={spell.tags.join(', ')} />

        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink">
            <RuneIcon icon={VerbalIcon} label="Verbal component" size={16} variant="gold" interactive={componentFlags.verbal} />
            <RuneIcon icon={SomaticIcon} label="Somatic component" size={16} variant="gold" interactive={componentFlags.somatic} />
            <RuneIcon icon={MaterialIcon} label="Material component" size={16} variant="gold" interactive={componentFlags.material} />
          </div>
          <DetailRow label="Components" value={spell.components} />

          {spell.save && (
            <div className="inline-flex items-center gap-2">
              <RuneIcon icon={SaveIcon} label="Saving throw" size={16} variant="gold" interactive />
              <DetailRow label="Save" value={spell.save} />
            </div>
          )}

          {spell.damage && (
            <div className="inline-flex items-center gap-2">
              <RuneIcon icon={DamageIcon} label="Damage type" size={16} variant="gold" interactive />
              <DetailRow label="Damage" value={spell.damage} />
            </div>
          )}

          {spell.damage && (
            <div className="inline-flex items-center gap-2">
              <RuneIcon icon={AttackRollIcon} label="Attack roll" size={16} variant="gold" interactive />
              <DetailRow label="Attack" value="Attack roll" />
            </div>
          )}

          {isHealing && (
            <div className="inline-flex items-center gap-2">
              <RuneIcon icon={HealingIcon} label="Healing" size={16} variant="gold" interactive />
              <DetailRow label="Healing" value="Healing" />
            </div>
          )}

          <DetailRow label="Casting Time" value={spell.castingTime} />
          <DetailRow label="Range" value={spell.range} />
          <DetailRow label="Duration" value={spell.duration} />
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
