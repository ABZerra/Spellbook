import path from 'path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const base =
  process.env.SPELLBOOK_BASE_PATH ||
  (process.env.GITHUB_ACTIONS ? '/Spellbook/' : '/');
const apiTarget = process.env.SPELLBOOK_API_TARGET || 'http://localhost:3001';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: false,
      },
      '/spells.json': {
        target: apiTarget,
        changeOrigin: false,
      },
      '/domain': {
        target: apiTarget,
        changeOrigin: false,
      },
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
});
