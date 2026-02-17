import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, RefreshCw, Search, Wand2, X } from 'lucide-react';
import { useApp, fromCsvInput } from '../context/AppContext';
import { CharacterSwitcher } from '../components/CharacterSwitcher';
import { SpellCard } from '../components/SpellCard';
import { SpellDetailsPanel } from '../components/SpellDetailsPanel';
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
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
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
  const selectedSpell = useMemo(
    () => (selectedSpellId ? filteredSpells.find((spell) => spell.id === selectedSpellId) || null : null),
    [filteredSpells, selectedSpellId],
  );

  useEffect(() => {
    if (!selectedSpellId) return;
    if (filteredSpells.some((spell) => spell.id === selectedSpellId)) return;
    setSelectedSpellId(null);
  }, [filteredSpells, selectedSpellId]);

  function handleInspectSpell(spellId: string) {
    setSelectedSpellId((current) => (current === spellId ? null : spellId));
  }

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
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border-dark bg-bg-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-gold" />
            <div>
              <h1 className="font-display text-[32px] leading-10 tracking-wide text-text">Spellbook</h1>
              <p className="mt-1 text-sm text-text-muted">Spell Catalog & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CharacterSwitcher />
            <Link to="/prepare">
              <Button variant="brandPrimary" className="h-10">
                <Wand2 className="mr-2 h-4 w-4" />
                Prepare Spells
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-border-dark bg-bg-1">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text">Total Spells:</span>
            <Badge className="border border-accent-soft bg-accent-soft text-text">{spells.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text">Prepared:</span>
            <Badge className="border border-accent-soft bg-accent-soft text-text">{preparedCount}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text">Showing:</span>
            <Badge className="border border-accent-soft bg-accent-soft text-text">{filteredSpells.length}</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={saveMode === 'remote' ? 'secondary' : 'outline'}>{saveMode === 'remote' ? 'Remote' : 'Local draft'}</Badge>
            <Button variant="brandSecondary" size="sm" onClick={() => void refreshNow()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {saveMode === 'local' && <Button variant="brandSecondary" size="sm" onClick={resetLocalDrafts}>Reset local edits</Button>}
          </div>
        </div>
      </section>

      <section className="border-b border-border-dark bg-bg-1">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
            <Input
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Search spells by name, description, or class..."
              className="h-12 border-border-dark bg-bg-2 pl-10 text-text"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_220px_1fr_220px_170px]">
            <div className="space-y-1">
              <Label>School:</Label>
              <Input value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="All" className="h-10 border-border-dark bg-bg-2" />
            </div>
            <div className="space-y-1">
              <Label>Level:</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-10 border-border-dark bg-bg-2"><SelectValue /></SelectTrigger>
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
                <TabsList className="h-10 border border-border-dark bg-bg-2">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="prepared">Prepared</TabsTrigger>
                  <TabsTrigger value="unprepared">Unprepared</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1">
              <Label>Sort:</Label>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="h-10 border-border-dark bg-bg-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="brandSecondary" className="h-10 w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    New Spell
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto border-border-dark bg-bg-1 text-text">
                  <DialogHeader>
                    <DialogTitle className="font-display text-gold">Create Spell</DialogTitle>
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
                    {createError && <p className="text-sm text-blood-2">{createError}</p>}
                  </div>
                  <DialogFooter>
                    <Button variant="brandSecondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button variant="brandPrimary" disabled={isCreating} onClick={() => void handleCreateSpell()}>{isCreating ? 'Creating...' : 'Create'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading && <p className="text-text-muted">Loading spells...</p>}
        {!loading && error && <p className="text-blood-2">{error}</p>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredSpells.map((spell) => (
            <SpellCard key={spell.id} spell={spell} onInspect={(nextSpell) => handleInspectSpell(nextSpell.id)} isSelected={spell.id === selectedSpell?.id} />
          ))}
        </div>

        {!loading && filteredSpells.length === 0 && <p className="mt-6 text-sm text-text-muted">No spells match the current filters.</p>}

        {mode.staticDataMode && <p className="mt-6 text-sm text-text-muted">Static mode active: API unavailable, using local `spells.json` with browser draft persistence.</p>}
      </main>

      <div
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300 ${selectedSpell ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSelectedSpellId(null)}
      />
      <aside className={`fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-[420px] transform transition-transform duration-300 ${selectedSpell ? 'translate-x-0' : 'translate-x-[110%]'}`}>
        <div className="relative max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-border-dark bg-bg-1 p-1 shadow-panel">
          <Button variant="ghost" size="sm" className="absolute right-3 top-3 z-10" onClick={() => setSelectedSpellId(null)}>
            <X className="h-4 w-4" />
          </Button>
          <SpellDetailsPanel spell={selectedSpell || null} title="Catalog Details" />
        </div>
      </aside>
    </div>
  );
}
