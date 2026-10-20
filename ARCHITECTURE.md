# ARCHITECTURE.md — module contracts (v7 hub)

Static portfolio site, two HTML entries. Stack: **Vite 5 (MPA) + three.js 0.170 + vanilla ES modules**.
No framework, no backend, no runtime data. Everything ships as static files.

```
/            → index.html          Sheet 00, the hub
/work/arm/   → work/arm/index.html Sheet 01, the v6 film
```

## File layout

```
personal-page/
  index.html                  # hub: hero, works register, mission, status, record, contact, title block
  work/arm/index.html         # film: chrome, loader, fixed stage, six acts, contact, inline index panel
  src/
    tokens.css                # design tokens + @font-face (shared; film mirrors them in style.css)
    hub.css                   # hub styling only
    hub.js                    # hub behaviour only
    style.css                 # film styling + tokens mirror
    main.js                   # film behaviour (loader, Lenis, stop blending, ghost, cursor, copy)
    arm-scene.js              # film three.js scene (GLB, six stops, point cloud, free view)
    arm-viewer.js             # standalone arm viewer (dev harness, hub plate renders)
  public/                     # copied verbatim into dist/
    models/arm-opt.glb        # 1.6 MB articulated CAD, J1..J5
    img/arm-plate.*           # film hero / no-WebGL still (portrait)
    img/plates/arm-16x10.*    # hub 16:10 plate
    img/og.jpg
    fonts/*.woff2             # Inter Tight 300/400, Instrument Serif italic (latin)
    favicon.svg
  dev/                        # local-only QA tooling, git-ignored
  vite.config.js              # base '/', appType 'mpa', two rollup inputs
  .github/workflows/deploy.yml
```

## Routes and base

- `base: '/'` — the site is meant for the GitHub user-site root (`EthanAntoineLi.github.io`). For a
  project-path deploy use `BASE=/personal-page/ npm run build`.
- `appType: 'mpa'` — no SPA history fallback; `/work/arm/` resolves to its own `index.html` in dev and
  preview.
- Film asset URLs are absolute (`/fonts/...`, `/img/...`); the GLB URL is derived from
  `import.meta.env.BASE_URL + 'models/arm-opt.glb'` so it follows the base.

## Ownership / what each file owns

| File | Owns | Must not |
| --- | --- | --- |
| `index.html` | Hub content, semantics, section ids, plate markup | contain style/JS logic beyond hooks |
| `src/hub.css` | Hub tokens import, layout, register, mission band, title block, responsive | style the film |
| `src/hub.js` | Hub reveals, nav/ghost state, copy-email | load three.js |
| `work/arm/index.html` | Film content + stage markup | change the film's copy without BUILD-LOG |
| `src/style.css` / `main.js` / `arm-scene.js` | The film, unchanged (see v4 DESIGN-NOTES) | be reused by the hub |
| `src/tokens.css` | Tokens + font faces | diverge from the film's mirror |

## Hub contracts (hub.js)

| Hook | Purpose |
| --- | --- |
| `.reveal` | progressive entrance; revealed when `rect.top < innerHeight * 0.92` on a rAF scroll check (not IO-only, so fast jumps can't strand an element invisible) |
| `[data-ghost]` | section → giant background word (`WORK`, `WHY`, `NOW`, `REC`, `TALK`) |
| `[data-nav]` | nav links; `aria-current="true"` set from the active section (`record` maps to `Status`) |
| `#ghost` | fixed ghost word element |
| `#copy-email[data-email]` | clipboard button with `execCommand` fallback |
| `body.is-ready` | starts the hero name reveal after first paint |
| `#work`, `#mission`, `#status`, `#record`, `#contact` | scroll targets |

Reveals are a **scroll-position check**, not IntersectionObserver-only: jumping from below a section to
above it (anchor click, key repeat, restored scroll) would otherwise skip the observer and leave the
element at `opacity: 0` forever. The hub keeps the check in the same rAF as the nav/ghost state.

Active section: last `[data-ghost]` section whose `offsetTop` is above `scrollY + 32% viewport`, with a
page-bottom special case so `Contact` wins at the end of the document.

## Film contracts (unchanged from v4/v6)

The film's public behaviour and hooks are documented in the v4 design notes and were not changed when
it moved under `/work/arm/`. The only edits in v7:

- asset/model URLs made absolute / `BASE_URL`-derived;
- a left-side `← sheet 00` link to the hub added to the chrome (`src/style.css` gains `.chrome-left` /
  `.sheet-back`).

Hooks and viewer API remain as before: `#arm-canvas`, `.viewer-stage`, `#arm-fallback`, `#viewer-status`,
`#pose-readout`, `[data-preset]`, `#play-toggle`, `.nav a[data-nav]`, `#copy-email`, and
`createArmViewer()`'s `ready / setPreset / setPose / play / pause / resize / dispose`.

## Build & deploy

- `npm run dev` → 5178 (hub + film); `npm run build` → `dist/` with both entries; `npm run preview` →
  4178.
- Code-splitting: `hub.js` (~1 KB gzip) is separate; the film chunk (~167 KB gzip) and GLB stay lazy.
- Pages deploy: `.github/workflows/deploy.yml` on push to `master`. Repo must be public on the free
  plan; the site expects the user-site root (see HUB-PLAN §8).

## Asset pipeline

**Arm GLB** — source of truth `HAVK/cad/EPQ-3.1-Design-FINAL.step` (Shapr3D); articulated export via
`HAVK/three-arm/tools/export_model.py` + `optimize.mjs`, then copy to `public/models/arm-opt.glb`.

**Film still** — rendered from the page's own viewer (contract in the v4 notes): pose
`[12, 38, 8, 52, 20]`, iso preset, transparent canvas, 2×.

**Hub plate** — `dev/make-plate.mjs` screenshots `dev/plate.html` (arm-viewer.js, 1600×1000, paper
background) at the same pose; compose a 16:10 plate on `#f6f6f4` with the arm at 94% height, centre;
export WebP (quality 86) + optimised PNG. Keep the pose in sync with the film's `PLATE_POSE`.

**Fonts** — Inter Tight 300/400 and Instrument Serif italic, latin subsets from Google Fonts, stored in
`public/fonts/`, declared in `src/tokens.css` with preloads in both HTML heads. No CDN requests.

## QA

`dev/shoot-hub.mjs` (local, git-ignored) uses the shared Playwright install at `../_qa/node_modules`,
captures desktop/laptop/mobile, a no-JS pass, a film smoke test and a production-preview pass, and
writes a JSON report (console errors, request failures, layout metrics, reveal counts). Latest
captures: `../review-v10/`.
