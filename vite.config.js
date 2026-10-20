import { defineConfig } from 'vite'

// Two HTML entries:
//   /            → Sheet 00, the hub (index)
//   /work/arm/   → Sheet 01, the v6 film (unchanged behaviour)
//
// `base` is '/' because the site is meant to live at the GitHub user-site root
// (https://ethanantoineli.github.io/). If it has to be built for a project path
// instead, pass BASE=/personal-page/ to the build.
export default defineConfig({
  base: process.env.BASE || '/',
  // MPA: no SPA history fallback, so /work/arm/ resolves to its own index.html.
  appType: 'mpa',
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
    rollupOptions: {
      input: {
        hub: 'index.html',
        arm: 'work/arm/index.html',
        nora: 'work/nora/index.html',
        noraDemo: 'work/nora/demo/index.html',
      },
    },
  },
})
