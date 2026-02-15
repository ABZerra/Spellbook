#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const frontendDir = path.join(rootDir, 'frontend');
const frontendDistDir = path.join(frontendDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

try {
  execSync('npm ci', { cwd: frontendDir, stdio: 'inherit' });
  execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
} catch (error) {
  console.error('Frontend build failed.');
  throw error;
}

if (existsSync(frontendDistDir)) {
  cpSync(frontendDistDir, distDir, { recursive: true });
} else {
  cpSync(path.join(rootDir, 'ui'), distDir, { recursive: true });
}

mkdirSync(path.join(distDir, 'domain'), { recursive: true });
cpSync(path.join(rootDir, 'src', 'domain', 'planner.js'), path.join(distDir, 'domain', 'planner.js'));

cpSync(path.join(rootDir, 'data', 'spells.json'), path.join(distDir, 'spells.json'));
writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
if (existsSync(path.join(distDir, 'index.html'))) {
  cpSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));
}

console.log(`Built GitHub Pages bundle at ${distDir}`);
