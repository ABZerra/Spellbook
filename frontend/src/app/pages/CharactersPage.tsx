import { Link } from 'react-router-dom';
import { BookOpen, Wand2, User } from 'lucide-react';
import { CharacterSwitcher } from '../components/CharacterSwitcher';
import { RuneDivider } from '../components/icons/RuneDivider';
import { RuneIcon } from '../components/icons/RuneIcon';
import { CharacterIcon, LibraryIcon } from '../components/icons/runeIcons';
import { Button } from '../components/ui/button';

export function CharactersPage() {
  return (
    <div className="min-h-screen bg-bg pb-12 text-text spellbook-leather-watermark">
      <header className="border-b border-border-dark bg-bg-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3 self-center">
            <User className="h-8 w-8 text-gold" />
            <div>
              <h1 className="font-display text-[32px] leading-10 tracking-wide text-text">Characters</h1>
              <p className="mt-1 text-sm text-text-muted">Character sheet and spell preparation context</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CharacterSwitcher showAccountDetails={false} />
            <Link to="/catalog">
              <Button variant="brandSecondary" className="h-10">
                <BookOpen className="mr-2 h-4 w-4" />
                Spell Catalog
              </Button>
            </Link>
            <Link to="/prepare">
              <Button variant="brandPrimary" className="h-10">
                <Wand2 className="mr-2 h-4 w-4" />
                Prepare Spells
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <section className="rounded-2xl border border-border-dark bg-bg-1 p-5 shadow-panel">
          <div className="flex items-center gap-3">
            <RuneIcon icon={CharacterIcon} label="Character sheet" size={20} variant="gold" interactive />
            <h2 className="font-display text-[20px] leading-7 tracking-wide text-text">Character Sheet</h2>
          </div>
          <div className="mt-2"><RuneDivider kind="ornate" className="text-gold" /></div>
          <p className="mt-4 text-sm text-text-muted">
            Character sheets are being prepared. This page will host character details, loadout history, and build tools.
          </p>
        </section>

        <section className="rounded-2xl border border-border-dark bg-bg-1 p-5 shadow-panel">
          <div className="mb-3 flex items-center gap-2">
            <RuneIcon icon={LibraryIcon} label="Prepared spells" size={18} variant="gold" interactive />
            <h2 className="font-display text-[18px] leading-6 tracking-wide text-gold">Prepared Spells</h2>
          </div>
          <p className="text-sm text-text-muted">Prepared-spell summaries for each character will appear here.</p>
        </section>
      </main>
    </div>
  );
}
