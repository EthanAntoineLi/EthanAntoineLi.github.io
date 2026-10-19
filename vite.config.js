import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the built site works at any GitHub Pages path
  // (e.g. /personal-page/ or a custom domain root).
  base: './',
  server: {
    host: true,
    port: 5178,
    strictPort: true,
    hmr: { overlay: false },
  },
  preview: {
    port: 4178,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 900,
  },
})
