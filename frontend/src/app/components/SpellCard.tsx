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

interface SpellCardProps {
  spell: UiSpell;
  showPrepared?: boolean;
  compact?: boolean;
  onInspect?: (spell: UiSpell) => void;
  isSelected?: boolean;
}

function schoolBadgeClass(school: string) {
  const name = school.toLowerCase();
  if (name === 'abjuration') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (name === 'evocation') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (name === 'divination') return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  if (name === 'enchantment') return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
  if (name === 'transmutation') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (name === 'conjuration') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  if (name === 'illusion') return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  if (name === 'necromancy') return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
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
        className={`flex items-center gap-3 rounded-xl border p-3 ${isSelected ? 'border-cyan-400 bg-[#172440]' : 'border-[#2b3f63] bg-[#131d30]'} ${onInspect ? 'cursor-pointer' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate text-gray-100">{spell.name}</p>
            {spell.school && (
              <Badge variant="outline" className={`border text-xs ${schoolBadgeClass(spell.school)}`}>
                {spell.school}
              </Badge>
            )}
            <Badge variant="secondary" className="bg-gray-700 text-xs text-gray-100">
              Level {spell.level}
            </Badge>
          </div>
        </div>
        {showPrepared && (
          <div className="flex items-center gap-2">
            <Label htmlFor={`prepared-${spell.id}`} className="text-xs text-gray-300">
              Prepared
            </Label>
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
      className={`border-[#24385b] bg-[#070b14] text-gray-100 shadow-sm ${isPrepared ? 'ring-1 ring-green-500/50' : ''} ${isSelected ? 'ring-2 ring-cyan-400/80' : ''} ${onInspect ? 'cursor-pointer' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={editedSpell.name}
                onChange={(event) => setEditedSpell({ ...editedSpell, name: event.target.value })}
              />
            ) : (
              <CardTitle className="text-xl font-semibold text-gray-100">{spell.name}</CardTitle>
            )}
            <CardDescription className="mt-3 flex flex-wrap items-center gap-2 text-gray-400">
              {spell.school && (
                <Badge variant="outline" className={`border text-xs ${schoolBadgeClass(spell.school)}`}>
                  {spell.school}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-gray-700 text-xs text-gray-100">
                Level {spell.level}
              </Badge>
              {sourceText && <span className="text-xs text-[#71809a]">{sourceText}</span>}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {!isEditing ? (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 text-gray-200" />
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => deleteSpell(spell.id))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={handleSave}>
                  <Save className="h-4 w-4 text-green-400" />
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
                  <X className="h-4 w-4 text-gray-300" />
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
                <Input
                  value={toCsvInput(editedSpell.source)}
                  onChange={(event) =>
                    setEditedSpell({ ...editedSpell, source: fromCsvInput(event.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Tags</Label>
                <Input
                  value={toCsvInput(editedSpell.tags)}
                  onChange={(event) =>
                    setEditedSpell({ ...editedSpell, tags: fromCsvInput(event.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Casting Time</Label>
                <Input
                  value={editedSpell.castingTime}
                  onChange={(event) =>
                    setEditedSpell({ ...editedSpell, castingTime: event.target.value })
                  }
                />
              </div>
              <div>
                <Label>Range</Label>
                <Input
                  value={editedSpell.range}
                  onChange={(event) => setEditedSpell({ ...editedSpell, range: event.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={editedSpell.description}
                onChange={(event) =>
                  setEditedSpell({ ...editedSpell, description: event.target.value })
                }
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {spell.castingTime && (
                <p>
                  <span className="font-semibold text-gray-100">Casting Time:</span>{' '}
                  <span className="text-gray-200">{spell.castingTime}</span>
                </p>
              )}
              {spell.range && (
                <p>
                  <span className="font-semibold text-gray-100">Range:</span>{' '}
                  <span className="text-gray-200">{spell.range}</span>
                </p>
              )}
              {spell.components && (
                <p>
                  <span className="font-semibold text-gray-100">Components:</span>{' '}
                  <span className="text-gray-200">{spell.components}</span>
                </p>
              )}
              {spell.duration && (
                <p>
                  <span className="font-semibold text-gray-100">Duration:</span>{' '}
                  <span className="text-gray-200">{spell.duration}</span>
                </p>
              )}
            </div>
            {spell.description && (
              <p className="line-clamp-5 text-sm text-[#6f7c96]">{spell.description}</p>
            )}
          </>
        )}

        {showPrepared && !isEditing && (
          <div className="flex items-center gap-2 border-t border-[#253752] pt-3">
            <Switch
              id={`prepared-full-${spell.id}`}
              checked={isPrepared}
              disabled={busy}
              onCheckedChange={() => void run(() => togglePrepared(spell.id))}
            />
            <Label htmlFor={`prepared-full-${spell.id}`} className="text-gray-200">
              {isPrepared ? 'Prepared' : 'Not Prepared'}
            </Label>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
