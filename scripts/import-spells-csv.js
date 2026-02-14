#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node scripts/import-spells-csv.js <input.csv> <output.json>');
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(value);
      value = '';
      continue;
    }

    if (ch === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    value += ch;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function toArray(value) {
  if (!value) return [];
  return value
    .split(/[,;|]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toSpell(row, index) {
  const level = row['Spell Level'] === '' ? null : Number(row['Spell Level']);
  const source = toArray(row['Source']);
  const tags = toArray(row['Tags']);
  const name = (row['Name'] || '').trim();

  const idBase = [name, level ?? 'x', source[0] || 'unknown'].join('-');
  const id = slugify(idBase) || `spell-${index + 1}`;

  return {
    id,
    name,
    level,
    prepared: (row['Prepared?'] || '').trim().toLowerCase() === 'yes',
    source,
    tags,
    component: (row['Component'] || '').trim() || null,
    notes: (row['Notes'] || '').trim() || null,
    preparation: (row['Preparation'] || '').trim() || null,
    combos: (row['Combos'] || '').trim() || null,
    items: (row['🎒 Items'] || '').trim() || null,
    raw: row,
  };
}

function main() {
  const [inputPath, outputPath] = process.argv.slice(2);

  if (!inputPath || !outputPath) {
    usage();
    process.exit(1);
  }

  const inputAbs = path.resolve(process.cwd(), inputPath);
  const outputAbs = path.resolve(process.cwd(), outputPath);

  if (!fs.existsSync(inputAbs)) {
    console.error(`Input file not found: ${inputAbs}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputAbs, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(raw);

  if (rows.length < 2) {
    console.error('CSV has no data rows.');
    process.exit(1);
  }

  const header = rows[0];
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== ''));

  const rowObjects = dataRows.map((row) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = row[i] ?? '';
    }
    return obj;
  });

  const spells = rowObjects
    .map((row, index) => toSpell(row, index))
    .sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name));

  const output = {
    schemaVersion: 1,
    importedAt: new Date().toISOString(),
    sourceFile: path.basename(inputAbs),
    totalSpells: spells.length,
    spells,
  };

  fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
  fs.writeFileSync(outputAbs, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Imported ${spells.length} spells from ${path.basename(inputAbs)} -> ${outputPath}`);
}

main();
