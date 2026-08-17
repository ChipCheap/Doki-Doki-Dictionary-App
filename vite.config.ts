import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Served from a GitHub Pages project path. architecture.md D7: this origin+path
// pair is load-bearing for data durability — IndexedDB is per-origin, so changing
// it strands every user's progress at the old address. Do not change casually.
const BASE = '/Doki-Doki-Dictionary-App/';

export default defineConfig({
  base: BASE,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      // Packs are fetched once and imported into IndexedDB; precaching them too
      // would duplicate ~10 MB in the service-worker cache (architecture.md D9).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['**/packs/**'],
        navigateFallback: `${BASE}index.html`,
      },
      manifest: {
        id: BASE,
        scope: BASE,
        start_url: BASE,
        name: 'Doki-Doki Dictionary',
        short_name: 'Doki Dict',
        description: 'Learn vocabulary with spaced repetition. Works offline.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1B1613',
        theme_color: '#1B1613',
        lang: 'en',
        categories: ['education'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
