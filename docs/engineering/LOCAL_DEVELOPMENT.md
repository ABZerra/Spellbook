# Local Development

## Prerequisites

- Node.js `>=20`
- npm

## Install

```bash
npm install
npm install --prefix frontend
```

## Test

```bash
npm test
npm test --prefix frontend
```

## Run API

```bash
npm run dev:api
```

Default API URL:
- `http://localhost:3000`

## Run Frontend

```bash
npm run dev:frontend
```

Default frontend URL:
- `http://localhost:5173`

## Rebuild Spell Catalog JSON from CSV

```bash
node scripts/import-spells-csv.js Spells.csv data/spells.json
```

## Build Frontend

```bash
npm run build:frontend
```

## Build Static Bundle

```bash
npm run build:pages
```

Output:
- `dist/`
