import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RuneIcon } from './RuneIcon';
import { ReplaceSpellIcon } from './runeIcons';

describe('RuneIcon', () => {
  it('renders with aria-label text', () => {
    const html = renderToStaticMarkup(
      <RuneIcon icon={ReplaceSpellIcon} label="Replace this spell" interactive={false} />,
    );
    expect(html).toContain('aria-label="Replace this spell"');
  });

  it('applies disabled styles', () => {
    const html = renderToStaticMarkup(
      <RuneIcon icon={ReplaceSpellIcon} label="Replace this spell" disabled interactive />,
    );
    expect(html).toContain('cursor-not-allowed');
    expect(html).toContain('opacity-55');
  });

  it('applies hover classes when interactive', () => {
    const html = renderToStaticMarkup(
      <RuneIcon icon={ReplaceSpellIcon} label="Replace this spell" interactive variant="default" />,
    );
    expect(html).toContain('hover:text-gold');
    expect(html).toContain('hover:bg-gold-soft');
  });
});
