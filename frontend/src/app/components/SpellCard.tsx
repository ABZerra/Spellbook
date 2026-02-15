import React, { useState } from 'react';
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

interface SpellCardProps {
  spell: UiSpell;
  showPrepared?: boolean;
  compact?: boolean;
}

export function SpellCard({ spell, showPrepared = true, compact = false }: SpellCardProps) {
  const { updateSpell, deleteSpell, togglePrepared, currentCharacter } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editedSpell, setEditedSpell] = useState(spell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPrepared = currentCharacter?.preparedSpellIds.includes(spell.id) || false;

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
      <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-gray-100">{spell.name}</p>
            <Badge variant="secondary">Level {spell.level}</Badge>
            {spell.school && <Badge variant="outline">{spell.school}</Badge>}
          </div>
        </div>
        {showPrepared && (
          <div className="flex items-center gap-2">
            <Label htmlFor={`prepared-${spell.id}`} className="text-sm text-gray-400">
              Prepared
            </Label>
            <Switch id={`prepared-${spell.id}`} checked={isPrepared} disabled={busy} onCheckedChange={() => void run(() => togglePrepared(spell.id))} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={isPrepared ? 'border-green-500/40 bg-green-500/10' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {isEditing ? (
              <Input value={editedSpell.name} onChange={(event) => setEditedSpell({ ...editedSpell, name: event.target.value })} />
            ) : (
              <CardTitle>{spell.name}</CardTitle>
            )}
            <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Level {spell.level}</Badge>
              {spell.school && <Badge variant="outline">{spell.school}</Badge>}
              {spell.source.length > 0 && <span className="text-xs text-gray-400">{spell.source.join(', ')}</span>}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => deleteSpell(spell.id))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={handleSave}>
                  <Save className="h-4 w-4 text-green-500" />
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
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
          <>
            {spell.description && <p className="text-sm text-gray-300">{spell.description}</p>}
            <div className="grid gap-2 text-sm text-gray-400 md:grid-cols-2">
              {spell.components && <p><span className="font-medium text-gray-300">Components:</span> {spell.components}</p>}
              {spell.duration && <p><span className="font-medium text-gray-300">Duration:</span> {spell.duration}</p>}
              {spell.castingTime && <p><span className="font-medium text-gray-300">Casting Time:</span> {spell.castingTime}</p>}
              {spell.range && <p><span className="font-medium text-gray-300">Range:</span> {spell.range}</p>}
            </div>
          </>
        )}

        {showPrepared && !isEditing && (
          <div className="flex items-center gap-2 border-t border-gray-700 pt-3">
            <Switch id={`prepared-full-${spell.id}`} checked={isPrepared} disabled={busy} onCheckedChange={() => void run(() => togglePrepared(spell.id))} />
            <Label htmlFor={`prepared-full-${spell.id}`}>{isPrepared ? 'Prepared' : 'Not Prepared'}</Label>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
