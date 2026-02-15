# Local Development

## Prerequisites
- Node.js `>=20`
- npm

## Install
```bash
npm install
```

## Run Tests
```bash
npm test
```

## Run Main App (UI + API)
```bash
npm run dev
```

Default URL:
- `http://localhost:3000`

Pages:
- `http://localhost:3000/` (Catalog)
- `http://localhost:3000/prepare` (Prepare)

## Run Standalone Spells API (Local File State)
```bash
node scripts/serve-spells-api.js
```

Default URL:
- `http://localhost:8787`

## Rebuild Spell JSON from CSV
```bash
node scripts/import-spells-csv.js Spells.csv data/spells.json
```

## Build Static GitHub Pages Bundle
```bash
npm run build:pages
```

Output:
- `dist/`
