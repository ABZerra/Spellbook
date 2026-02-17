import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { UiSpell } from '../../types/spell';
import { Button } from '../ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command';
import { Textarea } from '../ui/textarea';

interface SearchAutocompleteProps {
  open: boolean;
  busy: boolean;
  currentSpellName: string;
  selectedSpellId: string | null;
  note: string;
  duplicateWarningText: string | null;
  options: UiSpell[];
  onSelectedSpellIdChange: (spellId: string | null) => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function SearchAutocomplete({
  open,
  busy,
  currentSpellName,
  selectedSpellId,
  note,
  duplicateWarningText,
  options,
  onSelectedSpellIdChange,
  onNoteChange,
  onSave,
  onClose,
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter(
      (spell) =>
        spell.name.toLowerCase().includes(normalized) ||
        spell.id.toLowerCase().includes(normalized) ||
        String(spell.level) === normalized,
    );
  }, [options, query]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Edit Next Long Rest Slot"
      description={`Select the spell for this slot. Current prepared spell: ${currentSpellName}.`}
      contentClassName="border-border-dark bg-bg-1 text-text"
      commandClassName="bg-bg text-text"
    >
      <div className="border-b border-border-dark px-4 py-3">
        <p className="text-sm text-text-muted">Current slot</p>
        <p className="font-display text-base font-semibold text-text">{currentSpellName}</p>
      </div>

      <CommandInput placeholder="Search spell name..." value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[48vh] bg-bg">
        <CommandGroup heading="Spells">
          {filteredOptions.map((spell) => (
            <CommandItem
              key={spell.id}
              value={`${spell.name} ${spell.id} ${spell.level}`}
              className="text-text hover:bg-accent-soft data-[selected=true]:bg-accent-soft data-[selected=true]:text-text"
              onSelect={() => {
                onSelectedSpellIdChange(spell.id);
                setQuery(spell.name);
              }}
            >
              <span>{spell.name}</span>
              <span className="text-xs text-text-dim">Lvl {spell.level}</span>
              {selectedSpellId === spell.id && <span className="ml-auto text-xs text-accent">Selected</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandEmpty>No matching spells.</CommandEmpty>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="remove spell"
            className="text-text hover:bg-accent-soft data-[selected=true]:bg-accent-soft data-[selected=true]:text-text"
            onSelect={() => {
              onSelectedSpellIdChange(null);
              setQuery('');
            }}
          >
            Remove spell
            {selectedSpellId === null && <span className="ml-auto text-xs text-accent">Selected</span>}
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="border-t border-border-dark p-5">
        {duplicateWarningText && (
          <p className="mb-3 flex items-start gap-2 rounded-md border border-accent-soft bg-accent-soft px-3 py-2 text-sm text-text" role="status">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {duplicateWarningText}
          </p>
        )}

        <div className="rounded-lg border border-border-dark bg-bg-2 p-2">
          <p className="mb-2 text-sm text-text-muted">Optional Note</p>
          <Textarea
            className="min-h-20 border-border-dark bg-bg"
            placeholder="Capture your rationale for this change..."
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="brandSecondary" onClick={onClose}>Cancel</Button>
          <Button variant="brandPrimary" disabled={busy} onClick={onSave}>Save</Button>
        </div>
      </div>
    </CommandDialog>
  );
}
