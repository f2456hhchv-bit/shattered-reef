import { defineConfig, type Plugin } from 'vite';
import { syncArt } from './scripts/art-sync.mjs';

/** Your edited PNGs in art/ replace the game's art: synced at start-up and whenever a file in art/ changes. */
function artOverrides(): Plugin {
  const root = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/\/$/, '');
  return {
    name: 'art-overrides',
    buildStart() { const n = syncArt(root); if (n) console.log(`art: ${n} edited asset(s) in use`); },
    configureServer(server) {
      server.watcher.add(`${root}/art`);
      server.watcher.on('change', (f) => { if (f.includes(`${root}/art/`) && f.endsWith('.png')) { syncArt(root); server.ws.send({ type: 'full-reload' }); } });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [artOverrides()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', 'style-test': 'style-test.html' },
    },
  },
});
