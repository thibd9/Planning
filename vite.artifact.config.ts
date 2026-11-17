import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Construction pour une page hébergée (claude.ai) : noms de fichiers stables, sans empreinte,
 * pour que chaque republication remplace les mêmes fichiers.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
