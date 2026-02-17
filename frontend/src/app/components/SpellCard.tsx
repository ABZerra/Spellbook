import React, { useMemo, useState } from 'react';
import { useApp, fromCsvInput, toCsvInput } from '../context/AppContext';
import type { UiSpell } from '../types/spell';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { SchoolTag } from './SchoolTag';
import { RuneIcon } from './icons/RuneIcon';
import {
  CastingTimeIcon,
  DurationIcon,
  RangeIcon,
} from './icons/runeIcons';

interface SpellCardProps {
  spell: UiSpell;
  showPrepared?: boolean;
  compact?: boolean;
  onInspect?: (spell: UiSpell) => void;
  isSelected?: boolean;
}

export function SpellCard({
  spell,
  showPrepared = true,
  compact = false,
  onInspect,
  isSelected = false,
}: SpellCardProps) {
  const { updateSpell, deleteSpell, togglePrepared, currentCharacter } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editedSpell, setEditedSpell] = useState(spell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPrepared = currentCharacter?.preparedSpellIds.includes(spell.id) || false;
  const sourceText = useMemo(() => spell.source.join(', '), [spell.source]);

  function shouldSkipInspect(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('button, a, input, textarea, select, label, [role="switch"], [data-no-inspect="true"]'));
  }

  function handleInspect(event: React.MouseEvent<HTMLElement>) {
    if (!onInspect) return;
    if (shouldSkipInspect(event.target)) return;
    onInspect(spell);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  const handleSave = () => {
    void run(async () => {
      await updateSpell(spell.id, {
        name: editedSpell.name,
        level: editedSpell.level,
        source: editedSpell.source,
        tags: editedSpell.tags,
        description: editedSpell.description,
        duration: editedSpell.duration,
        components: editedSpell.components,
        spellList: editedSpell.spellList,
        school: editedSpell.school,
        range: editedSpell.range,
        castingTime: editedSpell.castingTime,
        save: editedSpell.save,
        damage: editedSpell.damage,
        notes: editedSpell.notes,
        preparation: editedSpell.preparation,
        combos: editedSpell.combos,
        items: editedSpell.items,
      });
      setIsEditing(false);
    });
  };

  if (compact) {
    return (
      <div
        onClick={handleInspect}
        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isSelected ? 'border-accent bg-accent-soft' : 'border-border-dark bg-bg-2 hover:border-accent-soft'} ${onInspect ? 'cursor-pointer' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-base text-text">{spell.name}</p>
            {spell.school && <SchoolTag school={spell.school} variant="pill" surface="dark" />}
            <Badge variant="outline" className="border-accent-soft text-xs text-text">Level {spell.level}</Badge>
          </div>
        </div>
        {showPrepared && (
          <div className="flex items-center gap-2">
            <Label htmlFor={`prepared-${spell.id}`} className="text-xs text-text-muted">Prepared</Label>
            <Switch
              id={`prepared-${spell.id}`}
              checked={isPrepared}
              disabled={busy}
              onCheckedChange={() => void run(() => togglePrepared(spell.id))}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card
      onClick={handleInspect}
      className={`rounded-2xl border bg-bg-1 text-text shadow-panel transition-colors ${isPrepared ? 'border-accent-soft' : 'border-border-dark'} ${isSelected ? 'border-accent bg-accent-soft' : 'hover:border-accent-soft'} ${onInspect ? 'cursor-pointer' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {isEditing ? (
              <Input value={editedSpell.name} onChange={(event) => setEditedSpell({ ...editedSpell, name: event.target.value })} />
            ) : (
              <CardTitle className="font-display text-[20px] leading-7 text-text">{spell.name}</CardTitle>
            )}
            <CardDescription className="mt-3 flex flex-wrap items-center gap-2 text-text-muted">
              {spell.school && <SchoolTag school={spell.school} variant="pill" surface="dark" />}
              <Badge variant="outline" className="border-accent-soft text-xs text-text">Level {spell.level}</Badge>
              {sourceText && <span className="text-xs uppercase tracking-wider text-text-dim">{sourceText}</span>}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {!isEditing ? (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 text-text" />
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => deleteSpell(spell.id))}>
                  <Trash2 className="h-4 w-4 text-blood-2" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={handleSave}>
                  <Save className="h-4 w-4 text-accent" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setEditedSpell(spell);
                    setIsEditing(false);
                  }}
                >
                  <X className="h-4 w-4 text-text-muted" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isEditing ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Source</Label>
                <Input value={toCsvInput(editedSpell.source)} onChange={(event) => setEditedSpell({ ...editedSpell, source: fromCsvInput(event.target.value) })} />
              </div>
              <div>
                <Label>Tags</Label>
                <Input value={toCsvInput(editedSpell.tags)} onChange={(event) => setEditedSpell({ ...editedSpell, tags: fromCsvInput(event.target.value) })} />
              </div>
              <div>
                <Label>Casting Time</Label>
                <Input value={editedSpell.castingTime} onChange={(event) => setEditedSpell({ ...editedSpell, castingTime: event.target.value })} />
              </div>
              <div>
                <Label>Range</Label>
                <Input value={editedSpell.range} onChange={(event) => setEditedSpell({ ...editedSpell, range: event.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={4} value={editedSpell.description} onChange={(event) => setEditedSpell({ ...editedSpell, description: event.target.value })} />
            </div>
          </>
        ) : (
          <div className="moonlit-surface mt-4 max-h-[90px] min-h-[82px] overflow-hidden p-4 text-moon-ink">
            <div className="moonlit-accent" />
            <div className="moonlit-watermark" style={{ backgroundSize: '320px' }} />
            <div className="relative flex flex-wrap items-center gap-6 text-[13px] leading-[1.55] text-moon-ink">
              <div className="flex min-w-0 items-center gap-2">
                <RuneIcon icon={CastingTimeIcon} label="Casting time" size={16} variant="muted" interactive className="text-moon-ink-muted" />
                <p className="truncate text-sm"><span className="font-semibold">Casting time:</span> {spell.castingTime || 'Unknown'}</p>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <RuneIcon icon={RangeIcon} label="Range" size={16} variant="muted" interactive className="text-moon-ink-muted" />
                <p className="truncate text-sm"><span className="font-semibold">Range:</span> {spell.range || 'Unknown'}</p>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <RuneIcon icon={DurationIcon} label="Duration" size={16} variant="muted" interactive className="text-moon-ink-muted" />
                <p className="truncate text-sm"><span className="font-semibold">Duration:</span> {spell.duration || 'Unknown'}</p>
              </div>
            </div>
          </div>
        )}

        {showPrepared && !isEditing && (
          <div className="flex items-center gap-2 border-t border-border-dark pt-3">
            <Switch id={`prepared-full-${spell.id}`} checked={isPrepared} disabled={busy} onCheckedChange={() => void run(() => togglePrepared(spell.id))} />
            <Label htmlFor={`prepared-full-${spell.id}`} className="text-text">
              {isPrepared ? 'Prepared' : 'Not Prepared'}
            </Label>
          </div>
        )}

        {error && <p className="text-sm text-blood-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
