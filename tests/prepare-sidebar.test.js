import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('prepare sidebar includes expanded detail slots', () => {
  const html = fs.readFileSync('ui/prepare.html', 'utf8');

  for (const id of [
    'spellDetailDescription',
    'spellDetailDuration',
    'spellDetailComponents',
    'spellDetailSpellList',
    'spellDetailSchool',
    'spellDetailRange',
    'spellDetailCastingTime',
    'spellDetailSave',
    'spellDetailDamage',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
