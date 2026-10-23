import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { 'style-test': 'style-test.html' },
    },
  },
});
