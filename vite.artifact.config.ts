import { defineConfig } from 'vite';

// Single-file build of the game (one JS chunk) for sharing as a standalone page.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-artifact',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: 'index.html', output: { inlineDynamicImports: true } },
  },
});
