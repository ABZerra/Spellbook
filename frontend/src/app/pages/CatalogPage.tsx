import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, RefreshCw, Wand2 } from 'lucide-react';
import { useApp, fromCsvInput } from '../context/AppContext';
import { CharacterSwitcher } from '../components/CharacterSwitcher';
import { SpellCard } from '../components/SpellCard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const SORT_OPTIONS = ['name', 'level', 'source', 'tags', 'prepared'] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

export function CatalogPage() {
  const {
    spells,
    currentCharacter,
    mode,
    loading,
    error,
    saveMode,
    refreshNow,
    resetLocalDrafts,
    createSpell,
  } = useApp();

  const [nameFilter, setNameFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagsFilter, setTagsFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState({
    id: '',
    name: '',
    level: 0,
    source: '',
    tags: '',
    school: '',
    castingTime: '',
    range: '',
    components: '',
    duration: '',
    description: '',
  });

  const filteredSpells = useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    const sourceTerms = fromCsvInput(sourceFilter).map((entry) => entry.toLowerCase());
    const tagTerms = fromCsvInput(tagsFilter).map((entry) => entry.toLowerCase());

    const next = spells.filter((spell) => {
      if (name && !spell.name.toLowerCase().includes(name)) return false;
      if (levelFilter !== 'all' && spell.level !== Number.parseInt(levelFilter, 10)) return false;

      if (sourceTerms.length > 0) {
        const sourceSet = spell.source.map((item) => item.toLowerCase());
        if (!sourceTerms.some((term) => sourceSet.includes(term))) return false;
      }

      if (tagTerms.length > 0) {
        const tagSet = spell.tags.map((item) => item.toLowerCase());
        if (!tagTerms.every((term) => tagSet.includes(term))) return false;
      }

      return true;
    });

    next.sort((left, right) => {
      let result = 0;

      if (sortKey === 'level') {
        result = left.level - right.level || left.name.localeCompare(right.name);
      } else if (sortKey === 'source') {
        result = left.source.join(', ').localeCompare(right.source.join(', '));
      } else if (sortKey === 'tags') {
        result = left.tags.join(', ').localeCompare(right.tags.join(', '));
      } else if (sortKey === 'prepared') {
        result = Number(left.prepared) - Number(right.prepared);
      } else {
        result = left.name.localeCompare(right.name);
      }

      return sortDirection === 'asc' ? result : -result;
    });

    return next;
  }, [levelFilter, nameFilter, sourceFilter, sortDirection, sortKey, spells, tagsFilter]);

  const preparedCount = currentCharacter?.preparedSpellIds.length || 0;

  async function handleCreateSpell() {
    setIsCreating(true);
    setCreateError(null);
    try {
      await createSpell({
        id: draft.id.trim(),
        name: draft.name.trim(),
        level: Number(draft.level),
        source: fromCsvInput(draft.source),
        tags: fromCsvInput(draft.tags),
        school: draft.school.trim(),
        castingTime: draft.castingTime.trim(),
        range: draft.range.trim(),
        components: draft.components.trim(),
        duration: draft.duration.trim(),
        description: draft.description.trim(),
        prepared: false,
      });
      setCreateOpen(false);
      setDraft({
        id: '',
        name: '',
        level: 0,
        source: '',
        tags: '',
        school: '',
        castingTime: '',
        range: '',
        components: '',
        duration: '',
        description: '',
      });
    } catch (nextError) {
      setCreateError(nextError instanceof Error ? nextError.message : 'Unable to create spell.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold text-gray-100">Spellbook</h1>
                <p className="text-sm text-gray-400">Catalog</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/prepare">
                <Button>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Prepare
                </Button>
              </Link>
            </div>
          </div>
          <CharacterSwitcher />
        </div>
      </header>

      <div className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Total:</span>
            <Badge variant="secondary">{spells.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Prepared:</span>
            <Badge className="bg-green-600">{preparedCount}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Showing:</span>
            <Badge variant="outline">{filteredSpells.length}</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
            <Button variant="outline" size="sm" onClick={() => void refreshNow()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {saveMode === 'local' && (
              <Button variant="outline" size="sm" onClick={resetLocalDrafts}>
                Reset local edits
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-6 sm:px-6 lg:px-8">
          <div className="space-y-1 lg:col-span-2">
            <Label>Search</Label>
            <Input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Spell name" />
          </div>
          <div className="space-y-1">
            <Label>Level</Label>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                  <SelectItem key={level} value={String(level)}>{level === 0 ? 'Cantrip (0)' : `Level ${level}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Source</Label>
            <Input value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Druid" />
          </div>
          <div className="space-y-1">
            <Label>Tags</Label>
            <Input value={tagsFilter} onChange={(event) => setTagsFilter(event.target.value)} placeholder="Concentration" />
          </div>
          <div className="space-y-1">
            <Label>Sort</Label>
            <div className="flex gap-2">
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}>
                {sortDirection === 'asc' ? 'Asc' : 'Desc'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Spells</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" />New Spell</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Spell</DialogTitle>
                <DialogDescription>Create a new shared spell in the catalog.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label>Spell ID</Label><Input value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></div>
                  <div className="space-y-1"><Label>Name</Label><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
                  <div className="space-y-1"><Label>Level</Label><Input type="number" min={0} value={draft.level} onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })} /></div>
                  <div className="space-y-1"><Label>School</Label><Input value={draft.school} onChange={(event) => setDraft({ ...draft, school: event.target.value })} /></div>
                  <div className="space-y-1"><Label>Source (csv)</Label><Input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></div>
                  <div className="space-y-1"><Label>Tags (csv)</Label><Input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1"><Label>Casting Time</Label><Input value={draft.castingTime} onChange={(event) => setDraft({ ...draft, castingTime: event.target.value })} /></div>
                  <div className="space-y-1"><Label>Range</Label><Input value={draft.range} onChange={(event) => setDraft({ ...draft, range: event.target.value })} /></div>
                  <div className="space-y-1"><Label>Components</Label><Input value={draft.components} onChange={(event) => setDraft({ ...draft, components: event.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Duration</Label><Input value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} /></div>
                <div className="space-y-1"><Label>Description</Label><Input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
                {createError && <p className="text-sm text-red-400">{createError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button disabled={isCreating} onClick={() => void handleCreateSpell()}>{isCreating ? 'Creating...' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading && <p className="text-gray-400">Loading spells...</p>}
        {!loading && error && <p className="text-red-400">{error}</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredSpells.map((spell) => (
            <SpellCard key={spell.id} spell={spell} />
          ))}
        </div>

        {!loading && filteredSpells.length === 0 && (
          <p className="mt-6 text-sm text-gray-400">No spells match the current filters.</p>
        )}

        {mode.staticDataMode && (
          <p className="mt-6 text-sm text-yellow-300">Static mode active: API unavailable, using local `spells.json` with browser draft persistence.</p>
        )}
      </main>
    </div>
  );
}
