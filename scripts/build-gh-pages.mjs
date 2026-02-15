#!/usr/bin/env node

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

cpSync(path.join(rootDir, 'ui'), distDir, { recursive: true });

mkdirSync(path.join(distDir, 'domain'), { recursive: true });
cpSync(path.join(rootDir, 'src', 'domain', 'planner.js'), path.join(distDir, 'domain', 'planner.js'));

cpSync(path.join(rootDir, 'data', 'spells.json'), path.join(distDir, 'spells.json'));
writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');

console.log(`Built GitHub Pages bundle at ${distDir}`);
