import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { UiSpell } from '../../types/spell';
import { SpellDetailsPanel } from '../SpellDetailsPanel';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Textarea } from '../ui/textarea';
import {
  deriveSpellCategory,
  formatSpellPickerMeta,
  spellHasConcentration,
  spellHasRitual,
} from './prepareUtils';

type SpellCategoryFilter = 'all' | 'damage' | 'healing' | 'utility';

interface PrepareSpellDrawerProps {
  open: boolean;
  isMobile: boolean;
  busy: boolean;
  currentSpellName: string;
  selectedSpellId: string | null;
  note: string;
  duplicateWarningText: string | null;
  options: UiSpell[];
  onOpenChange: (open: boolean) => void;
  onSelectedSpellIdChange: (spellId: string | null) => void;
  onNoteChange: (note: string) => void;
}

export function PrepareSpellDrawer({
  open,
  isMobile,
  busy,
  currentSpellName,
  selectedSpellId,
  note,
  duplicateWarningText,
  options,
  onOpenChange,
  onSelectedSpellIdChange,
  onNoteChange,
}: PrepareSpellDrawerProps) {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [ritualOnly, setRitualOnly] = useState(false);
  const [concentrationOnly, setConcentrationOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<SpellCategoryFilter>('all');
  const [inspectedSpellId, setInspectedSpellId] = useState<string | null>(null);

  function resetFilters() {
    setQuery('');
    setLevelFilter('all');
    setSchoolFilter('all');
    setRitualOnly(false);
    setConcentrationOnly(false);
    setCategoryFilter('all');
    setInspectedSpellId(null);
  }

  useEffect(() => {
    if (open) return;
    resetFilters();
  }, [open]);

  const schools = useMemo(() => {
    return [...new Set(options.map((spell) => spell.school).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }, [options]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return options.filter((spell) => {
      if (normalizedQuery) {
        const searchable = `${spell.name} ${spell.id} ${spell.description} ${spell.tags.join(' ')}`.toLowerCase();
        if (!searchable.includes(normalizedQuery)) return false;
      }

      if (levelFilter !== 'all' && spell.level !== Number.parseInt(levelFilter, 10)) return false;
      if (schoolFilter !== 'all' && spell.school !== schoolFilter) return false;
      if (ritualOnly && !spellHasRitual(spell)) return false;
      if (concentrationOnly && !spellHasConcentration(spell)) return false;
      if (categoryFilter !== 'all' && deriveSpellCategory(spell) !== categoryFilter) return false;
      return true;
    });
  }, [categoryFilter, concentrationOnly, levelFilter, options, query, ritualOnly, schoolFilter]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      query.trim() ||
      levelFilter !== 'all' ||
      schoolFilter !== 'all' ||
      ritualOnly ||
      concentrationOnly ||
      categoryFilter !== 'all',
    );
  }, [categoryFilter, concentrationOnly, levelFilter, query, ritualOnly, schoolFilter]);

  const inspectedSpell = useMemo(() => {
    const selected = options.find((spell) => spell.id === (inspectedSpellId || selectedSpellId));
    return selected || null;
  }, [inspectedSpellId, options, selectedSpellId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={`border-border-dark bg-bg-1 text-text ${isMobile ? 'max-h-[92vh]' : 'w-[90vw] sm:max-w-[900px]'}`}
      >
        <SheetHeader className="border-b border-border-dark px-5 py-4">
          <SheetTitle className="font-display text-xl tracking-wide text-gold">Replace Spell Slot</SheetTitle>
          <SheetDescription className="text-base text-text-muted">
            Current active spell: {currentSpellName}. Changes are queued automatically.
          </SheetDescription>
        </SheetHeader>

        <div className={`grid gap-4 overflow-hidden px-4 pb-4 pt-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-[1fr_380px]'}`}>
          <div className="min-h-0 space-y-4">
            {duplicateWarningText && (
              <p className="flex items-start gap-2 rounded-md border border-gold-soft bg-gold-soft/60 px-3 py-2 text-sm text-text" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {duplicateWarningText}
              </p>
            )}

            <div className="rounded-xl border border-border-dark bg-bg-2 p-3">
              <p className="text-xs uppercase tracking-widest text-text-dim">Selected Replacement</p>
              <p className="mt-1 font-display text-base font-semibold text-text">
                {options.find((spell) => spell.id === selectedSpellId)?.name || 'Empty Slot'}
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border-dark bg-bg-2 p-3">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search spells by name, id, or effect..."
                className="h-10 border-border-dark bg-bg"
              />

              <div className="grid gap-2 md:grid-cols-2">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-9 border-border-dark bg-bg"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {level === 0 ? 'Cantrip' : `Level ${level}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                  <SelectTrigger className="h-9 border-border-dark bg-bg"><SelectValue placeholder="School" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools</SelectItem>
                    {schools.map((school) => (
                      <SelectItem key={school} value={school}>
                        {school}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={ritualOnly ? 'brandPrimary' : 'brandSecondary'} size="sm" onClick={() => setRitualOnly((current) => !current)}>
                  Ritual Only
                </Button>
                <Button
                  type="button"
                  variant={concentrationOnly ? 'brandPrimary' : 'brandSecondary'}
                  size="sm"
                  onClick={() => setConcentrationOnly((current) => !current)}
                >
                  Concentration Only
                </Button>
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as SpellCategoryFilter)}>
                  <SelectTrigger className="h-9 w-[160px] border-border-dark bg-bg">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="healing">Healing</SelectItem>
                    <SelectItem value="utility">Utility</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" className="text-text-muted" onClick={resetFilters}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
              <p className="text-xs text-text-dim">{hasActiveFilters ? 'Filters active' : 'No filters active'}</p>
            </div>

            <div className="min-h-0 rounded-xl border border-border-dark bg-bg-2">
              <div className="max-h-[40vh] overflow-y-auto p-2">
                <button
                  type="button"
                  className={`mb-2 w-full rounded-md border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-[0.55] ${selectedSpellId === null ? 'border-gold bg-gold-soft/20' : 'border-border-dark hover:border-gold-soft'}`}
                  onClick={() => onSelectedSpellIdChange(null)}
                  disabled={busy}
                >
                  <p className="font-display text-sm font-semibold text-text">Empty Slot</p>
                  <p className="text-xs text-text-dim">Remove spell from this slot.</p>
                </button>

                {filteredOptions.map((spell) => (
                  <button
                    key={spell.id}
                    type="button"
                    className={`mb-2 w-full rounded-md border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-[0.55] ${selectedSpellId === spell.id ? 'border-gold bg-gold-soft/20' : 'border-border-dark hover:border-gold-soft'}`}
                    onClick={() => onSelectedSpellIdChange(spell.id)}
                    onMouseEnter={() => setInspectedSpellId(spell.id)}
                    disabled={busy}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-sm font-semibold text-text">{spell.name}</p>
                      {selectedSpellId === spell.id && <Badge className="border border-gold-soft bg-gold-soft text-text">Selected</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-text-dim">{formatSpellPickerMeta(spell)}</p>
                    <p className="mt-1 text-xs text-text-dim">Range: {spell.range || 'Unknown'}</p>
                  </button>
                ))}

                {filteredOptions.length === 0 && (
                  <p className="px-2 py-4 text-sm text-text-dim">
                    {hasActiveFilters ? 'No spells match current filters.' : 'No spells available.'}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-dark bg-bg-2 p-3">
              <p className="mb-2 text-sm text-text-muted">Change Note</p>
              <Textarea
                className="min-h-20 border-border-dark bg-bg"
                placeholder="Capture your rationale for this change..."
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
              />
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto rounded-xl border border-border-dark bg-paper p-2">
            <SpellDetailsPanel spell={inspectedSpell} title="Spell Details (In Ritual)" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
