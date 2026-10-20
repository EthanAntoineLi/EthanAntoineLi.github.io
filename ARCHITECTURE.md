# ARCHITECTURE.md — module contracts (v7 hub + sheets)

Static portfolio site, four HTML entries. Stack: **Vite 5 (MPA) + three.js 0.170 + vanilla ES
modules**. No framework, no backend, no runtime data. Everything ships as static files.

```
/                → index.html                 Sheet 00, the hub
/work/arm/       → work/arm/index.html        Sheet 01, the v6 film
/work/nora/      → work/nora/index.html       Sheet 02, Nora
/work/nora/demo/ → work/nora/demo/index.html  the desk-cat demo (iframe target; ?full = full page)
```

## File layout

```
personal-page/
  index.html                  # hub: hero, works register, mission, status, record, contact, title block
  work/arm/index.html         # film: chrome, loader, fixed stage, six acts, contact, inline index panel
  work/nora/index.html        # Nora sheet: hero, iframe demo, jobs, build stack, states, status
  work/nora/demo/index.html   # desk-cat page: copied from the Nora project, demo-only
  work/nora/demo/nora.js      # its behaviour: canvas room, states, sounds, interactions, demo loop
  work/nora/demo/style.css    # its styling + the portfolio embed mode
  src/
    tokens.css                # design tokens + @font-face
    hub.css                   # hub + shared components (chrome, sections, plates, title block, reveal)
    sheet.css                 # sheet layout (hero, demo, jobs, stack, states, status, next)
    scroll.js                 # shared: reveals, nav state, ghost word, hero-ready flag
    hub.js                    # hub-only: copy-email + cat plate init; imports scroll.js
    nora-cat.js               # hub's living cat plate (movement bank, no room)
    style.css                 # film styling + tokens mirror
    main.js                   # film behaviour (loader, Lenis, stop blending, ghost, cursor, copy)
    arm-scene.js              # film three.js scene (GLB, six stops, point cloud, free view)
    arm-viewer.js             # standalone arm viewer (dev harness, arm plate renders)
  public/                     # copied verbatim into dist/
    models/arm-opt.glb        # 1.6 MB articulated CAD, J1..J5
    img/arm-plate.*           # film hero / no-WebGL still (portrait)
    img/plates/arm-16x10.*    # hub 16:10 plate
    img/plates/nora-16x10.*   # hub 16:10 plate (desk cat, working)
    img/plates/nora-states.*  # 2×2 contact sheet of four demo states
    img/og.jpg
    fonts/*.woff2             # Inter Tight 300/400, Instrument Serif italic (latin)
    favicon.svg
  dev/                        # local-only QA + plate tooling, git-ignored
  vite.config.js              # base '/', appType 'mpa', four rollup inputs
  .github/workflows/deploy.yml
```

## Routes and base

- `base: '/'` — the site is meant for the GitHub user-site root (`EthanAntoineLi.github.io`). For a
  project-path deploy use `BASE=/personal-page/ npm run build`.
- `appType: 'mpa'` — no SPA history fallback; each directory serves its own `index.html` in dev and
  preview.
- Film asset URLs are absolute (`/fonts/...`, `/img/...`); the GLB URL derives from
  `import.meta.env.BASE_URL + 'models/arm-opt.glb'`.
- The Nora sheet iframes `/work/nora/demo/` (same origin, no server, demo events only).

## Ownership / what each file owns

| File | Owns | Must not |
| --- | --- | --- |
| `index.html` | Hub content, semantics, section ids, plate markup | contain style/JS logic beyond hooks |
| `src/hub.css` | Tokens import, chrome, section heads, plates, title block, responsive, reveal states | style the film or the demo |
| `src/sheet.css` | Sheet-only layout (hero, demo frame, jobs, build stack, state table, status band, next) | restyle hub components |
| `src/scroll.js` | Shared reveals, nav active state, ghost word, `body.is-ready` | know anything about a specific page |
| `src/hub.js` | Copy-email + cat-plate init (imports `scroll.js`) | duplicate scroll logic |
| `src/nora-cat.js` | The hub's cat canvas: layout, movement bank, pointer look, visibility pause | know about the room, the demo page or a server |
| `work/arm/index.html` + `src/style.css`, `main.js`, `arm-scene.js` | The film, unchanged (v4/v6 contracts) | be reused by the hub or sheets |
| `work/nora/demo/*` | The desk-cat page (copied) + embed/demo adaptations | talk to a server or read real data |

## Shared page behaviour (scroll.js)

| Hook | Purpose |
| --- | --- |
| `.reveal` | progressive entrance; revealed when `rect.top < innerHeight` on a rAF scroll-position check (not IO-only, so fast jumps can't strand an element invisible) |
| `[data-ghost]` | section → giant background word (`WORK`, `AI`, `HOW`, `CAT`, `NOW`, …) |
| `[data-nav]` | nav links; `aria-current="true"` from the active section (page-bottom special case) |
| `#ghost` | fixed ghost word element (optional) |
| `#nora-cat` | hub plate canvas; initialised by `hub.js`, `data-action` exposes the current idle action for QA |
| `body.is-ready` | starts the hero name reveal after first paint |

The reveal threshold is `innerHeight`, not an 8% inset: elements aligned to the bottom of the first
viewport (the hub's hero status strip) must not wait for a scroll to become visible.

## Sheet 02 structure

- `.sheet-hero` — eyebrow, `h1.sheet-name`, serif subtitle, lede + `dl.sheet-meta`.
- `.demo-figure` — iframe (`/work/nora/demo/`, 160:9 aspect) in a `plate-frame`; below it the caption
  and `?full` link; `<picture class="demo-fallback">` shown when JS is off.
- `#what` — `.jobs` two-column list of four jobs.
- `#build` — `.build-grid`: prose + `.stack` (base framework / my layers / sub-agents / machine).
- `#cat` — `.states` table (state colour from the pet palette) + `state-figure` contact sheet + copy.
- `#status` — `.status-band` (running 24/7; demo is fake events; nothing real is shown).
- `.sheet-next` + the shared `title-block` footer.

## The Nora demo page (`work/nora/demo/`)

Copied from the Nora project's `server/public/` and adapted for static hosting:

- **No server.** `const DEMO = true`; the page never opens an EventSource or fetches an API.
- **Embed mode (default).** `html.embed-demo` hides the header, status panels, hint and footer and
  fills a 160:90 iframe. `?full` removes the class and shows the complete pet page.
- **Fractional fit.** In embed mode `fit()` uses `scale = width / 160` instead of the integer-snapped
  scale, so the canvas fills the iframe exactly and bubble anchors stay aligned. Speech-bubble type and
  border scale with the room.
- **Scripted demo.** `runDemo()` plays a fake week built from Nora's real jobs (a reminder, then a
  question-bank request handled by a sub-agent), then idles and goes offline. Every state and idle
  action from the original page is preserved; no real logs, names, channels or infrastructure details
  are published.
- `?state=<state>` freezes one state (used for the state plate); `?activity=…` freezes an idle action.

## Film contracts (unchanged from v4/v6)

Hooks and viewer API remain as before: `#arm-canvas`, `.viewer-stage`, `#arm-fallback`, `#viewer-status`,
`#pose-readout`, `[data-preset]`, `#play-toggle`, `.nav a[data-nav]`, `#copy-email`, and
`createArmViewer()`'s `ready / setPreset / setPose / play / pause / resize / dispose`. The only v7 edits:
asset/model URLs made absolute / `BASE_URL`-derived, and a `← sheet 00` link in the chrome.

## Build & deploy

- `npm run dev` → 5178; `npm run build` → `dist/` with all four entries; `npm run preview` → 4178.
- Chunks: `scroll.js` (~0.7 KB gzip), `hub.js` (~0.5 KB), demo chunk (~13.6 KB gzip), film chunk
  (~167 KB gzip) + GLB. The film's 3D only loads on `/work/arm/`.
- Pages deploy: `.github/workflows/deploy.yml` on push to `master`. Repo must be public on the free
  plan; the site expects the user-site root (HUB-PLAN §8).

## Asset pipeline

**Arm GLB** — source of truth `HAVK/cad/EPQ-3.1-Design-FINAL.step` (Shapr3D); articulated export via
`HAVK/three-arm/tools/export_model.py` + `optimize.mjs`, then copy to `public/models/arm-opt.glb`.

**Film still** — rendered from the page's own viewer: pose `[12, 38, 8, 52, 20]`, iso preset,
transparent canvas, 2×.

**Arm plate** — `dev/make-plate.mjs` screenshots `dev/plate.html` (arm-viewer.js, 1600×1000) at the
same pose; compose a 16:10 plate on `#f6f6f4`, arm at 94% height, centre; export WebP + PNG.

**Nora plates** — in the demo page, `?state=<state>` at 1600×900; the working state composes to the
16:10 hub plate (paper margins), and listening/working/error/offline compose to the 2×2 contact sheet.

**Hub cat still** — `dev/cat-still.html` renders `src/nora-cat.js` at 540 × 337 CSS (2×, transparent);
clip the canvas with `omitBackground`, export `public/img/plates/nora-cat.png/.webp`, and show it under
the live canvas until `initNoraCat()` adds `.is-live` to the plate. `nora-16x10` is now only Sheet 02's
demo fallback.

**Fonts** — Inter Tight 300/400 and Instrument Serif italic, latin subsets from Google Fonts, stored in
`public/fonts/`, declared in `src/tokens.css` with preloads in the HTML heads. No CDN requests.

## QA

`dev/shoot-hub.mjs` (hub phase 1) and `dev/qa-nora.mjs` (hub + Sheet 02 + demo + film) use the shared
Playwright install at `../_qa/node_modules`, capture desktop/mobile/no-JS/production passes and write a
JSON report (console errors, failed requests, layout metrics, reveal counts, iframe interaction).
Latest captures: `../review-v11/`.
