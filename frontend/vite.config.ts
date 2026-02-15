import path from 'path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const base =
  process.env.SPELLBOOK_BASE_PATH ||
  (process.env.GITHUB_ACTIONS ? '/Spellbook/' : '/');

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
      '/spells.json': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
      '/domain': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
});
