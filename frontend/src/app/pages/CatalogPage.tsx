import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, RefreshCw, Search, Wand2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

const SORT_OPTIONS = ['name', 'level', 'source', 'tags', 'prepared'] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

export function CatalogPage() {
  const { spells, currentCharacter, mode, loading, error, saveMode, refreshNow, resetLocalDrafts, createSpell } = useApp();

  const [nameFilter, setNameFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagsFilter, setTagsFilter] = useState('');
  const [preparedFilter, setPreparedFilter] = useState<'all' | 'prepared' | 'unprepared'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
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
      if (name && !spell.name.toLowerCase().includes(name) && !spell.description.toLowerCase().includes(name)) return false;
      if (levelFilter !== 'all' && spell.level !== Number.parseInt(levelFilter, 10)) return false;

      if (preparedFilter === 'prepared' && !spell.prepared) return false;
      if (preparedFilter === 'unprepared' && spell.prepared) return false;

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
      if (sortKey === 'level') return left.level - right.level || left.name.localeCompare(right.name);
      if (sortKey === 'source') return left.source.join(', ').localeCompare(right.source.join(', '));
      if (sortKey === 'tags') return left.tags.join(', ').localeCompare(right.tags.join(', '));
      if (sortKey === 'prepared') return Number(right.prepared) - Number(left.prepared);
      return left.name.localeCompare(right.name);
    });

    return next;
  }, [levelFilter, nameFilter, preparedFilter, sourceFilter, sortKey, spells, tagsFilter]);

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
      setDraft({ id: '', name: '', level: 0, source: '', tags: '', school: '', castingTime: '', range: '', components: '', duration: '', description: '' });
    } catch (nextError) {
      setCreateError(nextError instanceof Error ? nextError.message : 'Unable to create spell.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030814] text-gray-100">
      <header className="border-b border-[#1b2a46] bg-[#07142d]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-violet-400" />
            <div>
              <h1 className="text-4xl font-bold leading-none">Spellbook</h1>
              <p className="mt-1 text-sm text-[#90a2c0]">Spell Catalog & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CharacterSwitcher />
            <Link to="/prepare">
              <Button className="h-10 border border-white/20 bg-white text-black hover:bg-gray-200">
                <Wand2 className="mr-2 h-4 w-4" />
                Prepare Spells
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#1b2a46] bg-[#081734]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-6 px-6 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-200">Total Spells:</span>
            <Badge className="bg-[#1b2740] text-gray-100">{spells.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-200">Prepared:</span>
            <Badge className="bg-green-600 text-white">{preparedCount}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-200">Showing:</span>
            <Badge className="bg-[#1b2740] text-gray-100">{filteredSpells.length}</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
            <Button variant="outline" size="sm" onClick={() => void refreshNow()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {saveMode === 'local' && <Button variant="outline" size="sm" onClick={resetLocalDrafts}>Reset local edits</Button>}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1b2a46] bg-[#081734]">
        <div className="mx-auto max-w-[1500px] px-6 py-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Search spells by name, description, or class..."
              className="h-12 border-[#2c3f62] bg-[#101b31] pl-10 text-gray-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_220px_1fr_220px_170px]">
            <div className="space-y-1">
              <Label>School:</Label>
              <Input value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="All" className="h-10 border-[#2c3f62] bg-[#101b31]" />
            </div>
            <div className="space-y-1">
              <Label>Level:</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-10 border-[#2c3f62] bg-[#101b31]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                    <SelectItem key={level} value={String(level)}>{level === 0 ? 'Cantrip' : `Level ${level}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status:</Label>
              <Tabs value={preparedFilter} onValueChange={(value) => setPreparedFilter(value as 'all' | 'prepared' | 'unprepared')}>
                <TabsList className="h-10 bg-[#2a2f3a]">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="prepared">Prepared</TabsTrigger>
                  <TabsTrigger value="unprepared">Unprepared</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1">
              <Label>Sort:</Label>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="h-10 border-[#2c3f62] bg-[#101b31]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-10 w-full border-[#2c3f62] bg-[#101b31] text-gray-100 hover:bg-[#182743]">
                    <Plus className="mr-2 h-4 w-4" />
                    New Spell
                  </Button>
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
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1500px] px-6 py-8">
        {loading && <p className="text-gray-400">Loading spells...</p>}
        {!loading && error && <p className="text-red-400">{error}</p>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {filteredSpells.map((spell) => <SpellCard key={spell.id} spell={spell} />)}
        </div>

        {!loading && filteredSpells.length === 0 && <p className="mt-6 text-sm text-gray-400">No spells match the current filters.</p>}

        {mode.staticDataMode && <p className="mt-6 text-sm text-yellow-300">Static mode active: API unavailable, using local `spells.json` with browser draft persistence.</p>}
      </main>
    </div>
  );
}
