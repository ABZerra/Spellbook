# Local Development

## Prerequisites
- Node.js `>=20`
- npm

## Install
```bash
npm install
```

## Test
```bash
npm test
```

## Run Integrated App (UI + API)
```bash
npm run dev
```

Default:
- `http://localhost:3000/`
- `http://localhost:3000/prepare`

## Run Standalone Local API
```bash
node scripts/serve-spells-api.js
```

Default:
- `http://localhost:8787`

## Rebuild Spell Catalog JSON from CSV
```bash
node scripts/import-spells-csv.js Spells.csv data/spells.json
```

## Build Static Bundle
```bash
npm run build:pages
```

Output:
- `dist/`
