import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', 'style-test': 'style-test.html' },
    },
  },
});
