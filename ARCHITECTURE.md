# ARCHITECTURE.md — module contracts (v7 hub + sheets)

Static portfolio site, seven HTML entries. Stack: **Vite 5 (MPA) + three.js 0.170 + vanilla ES
modules**. No framework, no backend, no runtime data. Everything ships as static files.

```
/                → index.html                 Sheet 00, the hub
/work/arm/       → work/arm/index.html        Sheet 01, the v6 film
/work/arm/process/ → work/arm/process/index.html  Sheet 01 / process, steps 01-06 (3D on the hero + steps 01-04)
/work/nora/      → work/nora/index.html       Sheet 02, Nora
/work/nora/demo/ → work/nora/demo/index.html  the desk-cat demo (iframe target; ?full = full page)
/work/drone/     → work/drone/index.html      Sheet 03, FPV drone (published; concept render in, build figures to come)
/plan/           → plan/index.html            the grand plan: intro + concept figures (copy pending)
```

## File layout

```
personal-page/
  index.html                  # hub: hero, works register, mission, status, record, contact, title block
  plan/index.html             # the grand plan: intro, three concept plates, copy slots, title block
  work/arm/index.html         # film: chrome, loader, fixed stage, six acts, contact, inline index panel
  work/arm/process/index.html # process page: film chrome + acts, printer stage
  work/nora/index.html        # Nora sheet: loader curtain, hero, iframe demo, jobs, build stack, states, status
  work/nora/demo/index.html   # desk-cat page: copied from the Nora project, demo-only
  work/nora/demo/nora.js      # its behaviour: canvas room, states, sounds, interactions, demo loop
  work/nora/demo/style.css    # its styling + the portfolio embed mode
  work/drone/index.html       # FPV drone sheet: hero (concept-render plate) + airframe/photo slots, parts table, chain, flight log, lesson, status
  src/
    tokens.css                # design tokens + @font-face (incl. the phone bar/gutter override)
    shell.css                 # shared fixed furniture: loader curtain + top chrome (all pages)
    hub.css                   # hub layout + shared components (sections, plates, CTA buttons, title block, reveal)
    sheet.css                 # sheet layout shared by Sheets 02–03 (hero type, lede/meta, status band, next)
    plan.css                  # the grand plan only: section rhythm + placeholder slots
    drone.css                 # Sheet 03 only: figure slots, parts table, five-stage chain, flight log, order list
    scroll.js                 # shared: reveals, nav state, ghost word, hero-ready flag
    hub.js                    # hub-only: copy-email + cat plate init; imports scroll.js
    nora-cat.js               # hub's living cat plate (movement bank, no room)
    nora-sheet.js             # sheet-only: iframe `.is-focused` marker for the keyboard focus ring
    nora-loader.js            # sheet-only: the promise behind Nora's loading curtain
    style.css                 # film styling + tokens mirror
    main.js                   # film behaviour (Lenis, stop blending, ghost, cursor, copy)
    process.js                # process page behaviour: film chrome + acts + printer scene wiring
    film-loader.js            # shared promise-based loading curtain (arm film, process page, Nora sheet)
    printer-scene.js          # process page three.js scene (A1 mini GLB, two framings, idle sway)
    arm-scene.js              # film three.js scene (GLB, six stops, point cloud, free view)
    arm-viewer.js             # standalone arm viewer (dev harness, arm plate renders)
  public/                     # copied verbatim into dist/
    models/arm-opt.glb        # 1.6 MB articulated CAD, J1..J5 (meshopt)
    models/printer-a1-mini.glb # 2.6 MB Bambu Lab A1 mini (287k tris, meshopt, WebP textures)
    img/arm-plate.*           # film hero / no-WebGL still (portrait)
    img/printer-plate.png     # process page no-WebGL / no-JS still (transparent crop)
    img/link-j1-j2.png        # process page Rev B still (the J1 → J2 link, transparent)
    models/arm-parts/         # the arm split into 9 parts (arm-parts.glb, parts/*.glb, manifest.json)
    models/README.txt         # what each model file is (shipped inside the zip too)
    downloads/3d-models.zip   # 5.2 MB: arm-opt, printer-a1-mini, arm-parts — process step 03's download
    img/plates/arm-16x10.*    # hub 16:10 plate
    img/plates/nora-16x10.*   # hub 16:10 plate (desk cat, working)
    img/plates/nora-states.*  # 2×2 contact sheet of four demo states
    img/plates/drone-search-5x6.webp # Sheet 03 hero: the search-drone concept render (1145×1374)
    img/plates/drone-16x10.webp      # hub plate: 16:10 crop of the same render (1145×716)
    img/plates/plan-robot-5x6.webp   # /plan/ Fig. 01: the humanoid robot concept (1145×1374)
    img/plates/plan-drone-5x6.webp   # /plan/ Fig. 02: the search-drone concept (1145×1374)
    img/plates/plan-parallel-16x6.webp # /plan/ Fig. 03: robot + drone, one job (2048×768)
    img/og.jpg
    fonts/*.woff2             # Inter Tight 300/400, Instrument Serif italic (latin)
    favicon.svg
  dev/                        # local-only QA + plate tooling, git-ignored
  vite.config.js              # base '/', appType 'mpa', seven rollup inputs
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
- The process page owns one canvas (`src/process-stage.js`): an act that shows a 3D object carries
  `data-stage="ring|printer|motors|print|compare"`, and `process.js` feeds the stage each act's
  position (`setTrack`) plus Rev B's frame rect (`setSlot`) so every object rides its own act.
  Step 03 (`print`) runs the A1 mini's print of the J1 → J2 link once and reports it through
  `onPrint`; `body.print-done` then swaps the progress line for the download link. Step 04
  (`compare`) parks that link in Rev B's frame; Rev A is a placeholder until its model exists.

## Status vocabulary

The plan's four words are the only project statuses (`HUB-PLAN.md` §2: BUILT = works, can show;
IN BUILD = partly works; PROPOSED = designed, not made; STUDY = investigation/report, not an
artefact). Every project carries exactly one, and every status field on the site uses the same set:

| Status | Where |
| --- | --- |
| `BUILT` | hub chips 01 / 02, hero strip, Sheet 02 meta + title block |
| `IN BUILD` | hub chip 03, hero strip, mission diagram, Sheet 03 meta + title block |
| `PROPOSED` | reserved — no current project; the humanoid on `/plan/` is a concept only |
| `STUDY` | hub register 04 / 05 |

The sheets' own status bands keep the specific state in its own words (Sheet 02 `Running · 24/7`,
Sheet 03 `Not flying`): that is the evidence behind the primary status, not a second status.
Unpublished sheets carry no "in prep" tag — the register's footnote and its list label say they are
not linked yet. `.state` / `.state--built` in `hub.css` render the chips (rust for built, muted
outline for the others). The hub's bottom Built / In build / Next board is a work board, not a
project status.

## Ownership / what each file owns

| File | Owns | Must not |
| --- | --- | --- |
| `index.html` | Hub content, semantics, section ids, plate markup | contain style/JS logic beyond hooks |
| `plan/index.html` + `src/plan.css` | The grand plan area: the hero intro (Ethan's copy), the `01 Robot` / `02 Drone` / `03 Parallel` concept plates (5:6, 5:6, 16:6), the two remaining copy slots, its title block. Section copy is Ethan's to dictate; the plates are accepted concept renders, captioned not built | invent claims, present a concept as the build, or restyle the shell/section primitives it borrows from `hub.css` |
| `src/shell.css` | The site shell shared by every page: the loader curtain (markup contract, type, animation, `body.is-loading`, no-JS hide) and the top chrome (grid, height, brand, back link, meta, one mono scale, right cluster, responsive collapse) | know about any page's content or controls |
| `src/hub.css` | Hub layout, section heads, plates, the one CTA button component (`.sheet-open` on the sheet rows, `.mission-cta` on the Mission band), title block, responsive, reveal states; imports `tokens.css` + `shell.css` | style the film or the demo |
| `src/sheet.css` | Sheet layout shared by Sheets 02–03: hero name/sub type, sheet lede + meta table, status band, `.sheet-next` | restyle hub components |
| `src/drone.css` | Sheet 03 only: the two-column hero with its concept-render plate, dashed figure slots (airframe + photographs), the parts table, the five-stage chain, the flight log, the "design the system" order list | touch the shell or the shared sheet primitives |
| `work/drone/index.html` | Sheet 03 content: hero (copy + concept-render plate), build (figure slot + parts table), system (chain), tests (flight log + photo slot), lesson (order list), status, title block. Copy is Ethan's account of the build — no invented specs or claims; the render is captioned concept / not the build | present the concept render as the build, or add figures or model numbers until Ethan supplies them |
| `src/scroll.js` | Shared reveals, nav active state, ghost word, `body.is-ready` | know anything about a specific page |
| `src/hub.js` | Copy-email + cat-plate init (imports `scroll.js`) | duplicate scroll logic |
| `src/nora-cat.js` | The hub's cat canvas: layout, movement bank, pointer look, visibility pause | know about the room, the demo page or a server |
| `src/nora-sheet.js` | Sheet 02 only: marks the demo iframe `.is-focused` from its window focus/blur events (keyboard focus lands inside the child document, where `:focus`/`:focus-within` never match) | touch anything but the demo iframe |
| `src/nora-loader.js` | Sheet 02 only: the readiness promise behind the curtain — fonts, the eight monitor frames decoded, the demo document loaded, then two frames for the projected hero | draw or animate the curtain (that is `film-loader.js`) |
| `work/arm/index.html` + `src/style.css`, `main.js`, `arm-scene.js` | The film, unchanged (v4/v6 contracts) | be reused by the hub or sheets |
| `work/arm/process/index.html` + `src/process.js` | The process page: film chrome, eight acts (hero, steps 01–06, back), the stage wiring (tracks, Rev B slot, print status → `body.print-done`); copy lives in the HTML | touch the arm scene |
| `src/film-loader.js` | The shared loading curtain: promise-based lift on the page's first real frame, real progress reporting, safety valve | know what the page renders |
| `src/printer-scene.js` | The process page's A1 mini: framing presets, idle sway, pointer parallax, dispose | know the page layout |
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

## Site shell (shell.css)

One component for every page. `src/style.css` (film) and `src/hub.css` (sheets, incl. the hub) both
`@import './shell.css'` first, so the shell is defined once and the two families cannot drift.

| Part | Contract |
| --- | --- |
| `.loader` | fixed curtain with `.loader-label` / `#loader-count` / `.loader-bar span` / `#loader-ascii` / `.loader-foot`; `body.is-loading` locks scroll; `body.loaded` fades it; `html:not(.js)` hides it outright. Only the film, process and Nora pages carry the markup. |
| `.chrome` | fixed bar, `grid-template-columns: 1fr auto 1fr`, `--chrome-h` (54 desktop / 48 phones), `--gutter` padding. Slots, in order: `.chrome-left` (`.brand` + `.sheet-back`), `.chrome-meta`, then the page's own right cluster (`.chrome-right` on the film, `.nav` on the sheets). |
| Type | one mono scale inside the bar: `.chrome .mono` = 10px / 500 / 0.15em; brand 14.5px, tag 9px / 0.2em. |
| Collapse | ≤1024px the meta drops; ≤860px the tag drops and gaps/type tighten; ≤560px type tightens again. Pages hide only their own controls after that (e.g. the film drops frame counter, modes and clock at ≤820px). |
| Loader promises | `film-loader.js` owns the animation and lifts on the page's own promise + real progress. The film/process report GLB transfer progress and first frame; `nora-loader.js` reports font / monitor-frame / demo-document completion, then two rAFs. All share the 15 s safety valve and `prefers-reduced-motion` handling. |

## Sheet 02 structure

- `.sheet-hero` — eyebrow, `h1.sheet-name`, serif subtitle, lede + `dl.sheet-meta`.
- `.demo-figure` — iframe (`/work/nora/demo/`, 160:90 aspect) in a `plate-frame`; below it the caption
  and `?full` link. `<picture class="demo-fallback">` replaces the iframe when JS is off **or**
  `prefers-reduced-motion: reduce` is set (both modes swap the caption via `.live-only` /
  `.still-only`; the 16:10 plate is trimmed to 16:9 with `aspect-ratio` + `object-fit: cover`).
- `#what` — `.jobs` two-column list of four jobs.
- `#build` — `.build-grid`: prose + `.stack` (base framework / my layers / sub-agents / machine).
- `#cat` — `.states` table (state colour from the pet palette) + `state-figure` contact sheet + copy.
- `#status` — `.status-band` (running 24/7; demo is fake events; nothing real is shown).
- `.sheet-next` + the shared `title-block` footer.

## Sheet 03 structure

A case-study sheet, not a film: no loader, no 3D. The hero carries the search-drone concept render;
the build's own airframe model and photographs are the pending figures. `src/hub.css` supplies the
shell, section heads and title block, `src/sheet.css` the shared sheet type/meta/status band,
`src/drone.css` the page's own figures.

- `.hero` + `.drone-hero` — two-column `.drone-hero-top`: copy left (eyebrow, two-line
  `h1.sheet-name` "FPV / drone", serif subtitle) and a 5:6 `.drone-hero-plate` right (the concept
  render, max 430 px, hairline mount, caption `Concept render — the search drone. Not the build.`).
  Below, `.hero-foot`: the lede next to the `dl.sheet-meta` (Status / Built / Attempts / Role).
  ≤860 px the render drops under the copy, left-aligned, max 380 px.
- `#build` — `.figure-slot` (Fig. 01, the airframe — 3D model + photographs pending), the build copy,
  and `TABLE 01` (`parts-table`): six parts with no CAD model, the airframe as the only one.
- `#system` — `.chain` (Fig. 02): five stages — video link (works), flight (not solved), recognition /
  position fix / hand off (not built) — then links to Sheet 01 and `/plan/`.
- `#tests` — `.log` flight log (two attempts, what each ended with), then `.figure-slot--photo`
  (Fig. 03, photographs pending).
- `#design` — the lesson copy plus `.order` (five steps, frame last).
- `#status` — `.status-band` ("Not flying").
- Ghost words: `LIFT` / `BUILD` / `CHAIN` / `TEST` / `DESIGN` / `NOW`. Nav: Build / System / Tests /
  Status.
- **Hub entry** — published as the third `.sheet-row--lead` on the hub (2026-10-21). Its plate is a
  1145×716 16:10 crop of the same concept render (`/img/plates/drone-16x10.webp`), captioned
  `Fig. 03 — the search drone · concept render`, so the row is full-bleed like 01/02. Sheet 02's
  `.sheet-next` now links here.

## The Nora demo page (`work/nora/demo/`)

Copied from the Nora project's `server/public/` and adapted for static hosting:

- **No server.** The server branch was removed from this copy: no `EventSource`, no API paths, no
  ports or service names ship with the page. `runDemo()` always runs.
- **Embed mode (default).** The inline script in `<head>` adds `html.embed-demo` unless `?full` is in
  the URL (so the class is not in the markup and the page still renders with JS off). The class hides
  the header, status panels, hint and footer and fills a 160:90 iframe; `?full` omits it, showing the
  complete pet page with a `← Sheet 02` back link and a `demo` header chip.
- **Fractional fit.** In embed mode `fit()` uses `scale = width / 160` instead of the integer-snapped
  scale, so the canvas fills the iframe exactly and bubble anchors stay aligned. Speech-bubble type and
  border scale with the room.
- **Scripted demo.** `runDemo()` plays a fake week built from Nora's real jobs (a reminder, then a
  question-bank request handled by a sub-agent), then idles and goes offline. Every state and idle
  action from the original page is preserved; no real logs, names, channels or infrastructure details
  are published.
- `?state=<state>` freezes one state (used for the state plate); `?activity=…` freezes an idle action.

## The grand plan page (`/plan/`) — intro written, concept figures in, copy to come

A top-level area for the long-range rescue system: one full robot doing the rescue job, with drones
working alongside it as its larger eye. Built from the shared furniture, not new components:
`src/hub.css` supplies tokens, reset, chrome, section heads and the title block, `src/plan.css`
supplies the page rhythm, the intro type and the placeholder frames, and `src/scroll.js` supplies
reveals / nav / ghost. No loader — nothing heavy to wait for.

- `.plan-hero` — eyebrow, `h1.hero-name` ("The grand plan."), `.plan-lede` (the plan paragraph,
  Ethan's copy), a `#robot` cue.
- `01 / The robot`, `02 / The drone` — `.section-title` + `.plan-grid` of a copy block (label + skeleton rules) and a 5:6 concept plate (`.plan-plate` / `.plan-plate-media`), mirrored on `02`.
- `03 / In parallel` — full-width 16:6 concept plate (`.plan-plate--wide`).
- The five-cell title block ends the page (`State: draft`, `Status: concept figures in — copy to come`).
- The two copy slots are dashed, opaque paper-tint frames with a mono label; the figures themselves are solid hairline plates, captioned `Fig. 01 — concept` / `Not built`, `Fig. 02 — concept` / `Not built`, `Fig. 03 — one job, in parallel` / `Concept · not built`. The fixed ghost word (`PLAN` / `ROBOT` / `DRONE` / `ONE`) does not read through the copy slots. The hero intro is plain `.plan-lede` copy, not a slot.
- Nav: Robot / Drone / Parallel (same `.nav` contract as the sheets); back link `← sheet 00` hidden
  ≤700 px like the sheets.
- **Entry:** the hub's Mission band carries the same plan copy and a `The grand plan ↗` CTA
  (`.mission-cta`, the same rust→ink button component as the sheet rows) linking to this page. The
  hub's Mission band keeps its ink background; `/plan/` stays paper/ink like the rest of the sheets.

## Film contracts (unchanged from v4/v6)

Hooks and viewer API remain as before: `#arm-canvas`, `.viewer-stage`, `#arm-fallback`, `#viewer-status`,
`#pose-readout`, `[data-preset]`, `#play-toggle`, `.nav a[data-nav]`, `#copy-email`, and
`createArmViewer()`'s `ready / setPreset / setPose / play / pause / resize / dispose`. The only v7 edits:
asset/model URLs made absolute / `BASE_URL`-derived, and a `← sheet 00` link in the chrome.

## Build & deploy

- `npm run dev` → 5178; `npm run build` → `dist/` with all seven entries; `npm run preview` → 4178.
- Chunks: `scroll.js` (~0.7 KB gzip), `nora-sheet.js` (~0.2 KB, Sheet 02 only), `hub.js` (~0.5 KB),
  demo chunk (~13.6 KB gzip), film chunk (~167 KB gzip) + GLB. The film's 3D only loads on `/work/arm/`.
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

**Drone plates** — from Ethan's search-drone concept render (1145×1374, the same image as `/plan/`'s
Fig. 02): the source saved as `drone-search-5x6.webp` (q88) for the Sheet 03 hero, and cropped to
1145×716 for the hub's 16:10 plate. Both are captioned as concept renders — the render is never
shown as a photograph of the build.

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
Latest captures: `../review-v11/`. Sheet 03's hub row + concept-render pass: `_qa/qa-drone-hub.mjs`
(67 checks) with captures in `../review-drone-hub/`.
