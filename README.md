# Ethan Antoine Li — engineering portfolio

A static site laid out like an engineering drawing set. **Sheet 00** is the index (`/`). Three sheets
are published: **01** the arm film (`/work/arm/`), **02** Nora, the personal AI (`/work/nora/`), and
**03** the FPV drone (`/work/drone/`). The drone sheet leads with a concept render of the search
configuration (captioned as a concept, not the build); the build's own airframe model and photographs
are still to come. A new top-level area, **the grand plan** (`/plan/`), is being built — intro
written, three concept figures in, section copy to come.

**Live:** <https://ethanantoineli.github.io/personal-page/> — deployed 2026-10-20 (GitHub Pages,
project site). The direction and the open decisions live in [`HUB-PLAN.md`](HUB-PLAN.md).

---

## What the site is

| Route | Sheet | Content |
| --- | --- | --- |
| `/` | 00 — index | Name, one line, current state, works register (01–03 published, 04–05 in prep), mission band carrying **the grand plan copy + its `The grand plan ↗` button** (rust→ink, same component as the sheet CTAs), system diagram, built/in build/next, record, contact, title block. No 3D. The Nora plate is a live canvas: the cat alone on paper, idling through her movement bank; the drone plate is a 16:10 crop of the search-drone concept render. |
| `/work/arm/` | 01 — the arm | The v6 **product film**: fixed 3D stage, six camera stops, the real articulated `arm-opt.glb`, mesh/points/x-ray modes, free view with part details. Unchanged except a back link to the index. |
| `/work/arm/process/` | 01 — process | How the arm got made, in order. The hero is an indexing turret of the six parts (A1 mini + five motors) on a drawn dial, presenting each in build order with a drawing-sheet balloon — drag to spin it, click a part to bring it round. Step 01 (the Bambu Lab A1 mini) and step 02 (the motors) are live 3D; step 03 has the A1 mini print the J1 → J2 link (head along the gantry, bed shuttling, gantry climbing a layer at a time), then shows the **Download the 3D models** link; step 04 compares that link's two revisions (Rev B live in its frame, Rev A waiting on its model); steps 05–06 (design, assemble) are written. Same film chrome as the arm sheet. |
| `/work/nora/` | 02 — Nora | The personal AI that runs 24/7 on a Mac of her own, with an **interactive pixel-art desk cat** as its status window. Same loading curtain and top-bar shell as Sheet 01. Argument, state table, build diagram, and the live demo. |
| `/work/nora/demo/` | — | The actual desk-cat page, copied into the site and permanently in demo mode (fake events, no server). Embedded on Sheet 02; `?full` opens the complete pet page. |
| `/work/drone/` | 03 — FPV drone | The rescue system's eye, built and not flying. Hero with a **concept render of the search drone** (5:6, captioned "concept render — not the build"), the build and its parts table (no part but the airframe has a CAD model), the five-stage chain (video link works; flight not solved; recognition / position fix / handoff not built), the two test flights, and the design lesson. **Build figures pending**: the airframe model and photographs are marked "to come"; the hub plate is a 16:10 crop of the same concept render. |
| `/plan/` | — (area) | **The grand plan** — the long-range rescue system: one full robot doing the rescue job, with drones working alongside it as its larger eye. **Intro written; concept figures in**: the `01 Robot` and `02 Drone` sections carry the accepted concept plates, `03 Parallel` the wide scene; the copy slots are still dashed "to come" frames. Entered from the hub's Mission band via its `The grand plan ↗` button. |

Register rules: a sheet is linked once it has real content. **03 FPV drone** is published from
2026-10-21 — the sheet is written, its concept render is labelled as a concept, and its build figures
are honestly pending — and 04–05 (AI interviewer, physics) are still in prep until their assets exist.

Content rules: **nothing claims the drone vision system works**; the search-drone render is always
captioned as a concept, never as a photograph of the build; **nothing from Nora's real activity
log appears on the site** — the demo only ever shows a scripted fake week. Prototype/status labels
wherever they matter.

## Stack

- **Vite 5** multi-page build + **three.js 0.170** on the film page only (vanilla ES modules, no
  framework, no router, no trackers).
- Self-hosted **Inter Tight** (display/prose) and **Instrument Serif** italic (voice) — no external
  font/CDN requests.
- Palette and type tokens live in [`src/tokens.css`](src/tokens.css), shared by the hub and sheets;
  the film keeps a mirrored copy at the top of `src/style.css` until it is migrated (HUB-PLAN §8.1).
- Paper `#f6f6f4` · ink `#101214` · signal rust `#b23e22`.

## Run it

```bash
npm install
npm run dev       # http://localhost:5178/  (hub)  + /plan/, /work/arm/, /work/arm/process/, /work/nora/, /work/nora/demo/, /work/drone/
npm run build     # → dist/ (all entries)
npm run preview   # http://localhost:4178/
```

Requires Node 18+ (tested on Node 24). Ports are pinned in `vite.config.js`.

## Assets

| File | Size | Origin |
| --- | --- | --- |
| `public/models/arm-opt.glb` | 1.6 MB, 290k tris | EPQ 3.1 Design FINAL.step (Shapr3D) → articulated GLB via `HAVK/three-arm/tools` (meshopt + quantization), joints `J1…J5` |
| `public/img/plates/arm-16x10.png/.webp` | 156 KB / 22 KB | 16:10 hub plate composed from a 1600×1000 render of the page's own `arm-viewer.js` at pose `[12, 38, 8, 52, 20]` |
| `public/img/plates/nora-16x10.png/.webp` | 112 KB / 11 KB | Sheet 02's 16:10 room still — the demo figure's no-JS *and* reduced-motion fallback (the 16:10 paper band is trimmed to 16:9 by CSS) |
| `public/img/plates/nora-cat.png/.webp` | 5 KB / 5 KB | Transparent still of the cat alone — the exact hub canvas layout — shown when JS is off |
| `public/img/plates/nora-states.png/.webp` | 178 KB / 63 KB | 2×2 contact sheet of four demo states (listening, working, error, offline) |
| `public/img/plates/drone-search-5x6.webp` | 1145×1374 · 117 KB | The search-drone **concept render** (Ethan's render, the same image as `/plan/` Fig. 02) — Sheet 03's hero plate |
| `public/img/plates/drone-16x10.webp` | 1145×716 · 98 KB | 16:10 crop of the same render for the hub row's plate |
| `public/img/arm-plate.png/.webp` | 193 / 46 KB | The film's own hero / no-WebGL still (portrait) |
| `public/models/arm-parts/` | 1.7 MB + 9 parts | The same arm split into its nine parts (five motors, four printed links), one GLB each + `manifest.json`; `parts/link-J1-J2.glb` is the part printed on the process page |
| `public/downloads/3d-models.zip` | 5.2 MB | `arm-opt.glb`, `printer-a1-mini.glb` and `arm-parts/` with a README — the process page's download (browsable unzipped under `public/models/`) |
| `public/img/link-j1-j2.png` | 121 KB | Transparent still of the J1 → J2 link, Rev B's stand-in before the scene is up |
| `public/fonts/*.woff2` | 48 KB total | Inter Tight 300/400, Instrument Serif italic — latin subsets, self-hosted |

Plate pipeline (local tooling, `dev/` is git-ignored): arm plate via `node dev/make-plate.mjs`; Nora
plates by capturing `?state=<state>` from the demo at 1280×720 / 1600×900 and composing on paper.

The desk cat itself is a copy of the Nora project's public page (`work/nora/demo/`, 58 KB JS + 7 KB
CSS, all pixel art drawn in code) adapted for the portfolio: an embed mode that fills a 160:90 iframe,
a scripted demo cycle rewritten around Nora's real jobs, and no server code at all (the connect branch,
event stream and infrastructure strings are gone). `?full` shows the complete pet page with a
`← Sheet 02` back link and a persistent demo label. For the hub, the room is removed: `src/nora-cat.js`
redraws just the cat from the same sprites and plays the sitting part of her movement bank (blink,
look, groom, yawn, tail flick, knead, nap) on a transparent canvas, with the eyes following the
pointer.

The cat canvas runs at 15 fps, pauses off-screen, and renders one static frame under
`prefers-reduced-motion`. Without JavaScript the plate shows the transparent still.

## Performance

- Hub initial payload: ~75 KB (HTML 4 + CSS 4.4 gzip + fonts + 22 KB arm plate + 3.4 KB JS, including the cat canvas module); no three.js.
- Sheet 02: ~14 KB gzip of page CSS/JS + 11 KB cover + 63 KB state figure (lazy); the demo iframe
  loads ~16 KB gzip of its own JS/CSS + no images.
- The film's hard 3D (≈167 KB gzip + 1.6 MB GLB) is still lazy and remains out of the hub's path.
- Hub and sheets read fine with **JavaScript disabled** — the sheet falls back from the live demo to
  the still plate. `prefers-reduced-motion` disables entrances and swaps the embedded demo for the
  same still frame (caption switches with it).

## Deploy

Live: <https://ethanantoineli.github.io/personal-page/>. `.github/workflows/deploy.yml` builds `dist/`
and publishes it to GitHub Pages on push to `master` (Pages enabled, source: GitHub Actions, repo
public). To publish the current work: `git push origin hub:master`.

Because the site lives on a **project path**, the workflow builds with `BASE=/personal-page/` and all
internal navigation links are document-relative, so the same markup also works from a user-site root.
If the repo is later renamed `EthanAntoineLi.github.io`, delete the `BASE` env from the workflow and
the site moves to <https://ethanantoineli.github.io/> (OG/canonical then need the final URLs).

`HUB-PLAN.md` §8–10 tracks the remaining deploy/URL decisions.

## Layout

```
personal-page/
  index.html               # Sheet 00 — hub
  work/arm/index.html      # Sheet 01 — the v6 film (verbatim, + back link)
  work/arm/process/        # Sheet 01 / process — turret, A1 mini, motors, the print, the J1 → J2 revision
  work/nora/index.html     # Sheet 02 — Nora
  work/nora/demo/          # the desk-cat page, demo-only (iframe target; ?full = full page)
    index.html nora.js style.css
  work/drone/index.html    # Sheet 03 — FPV drone (concept render in; build figures pending)
  src/
    tokens.css             # shared design tokens + @font-face
    shell.css              # shared shell: loading curtain + top chrome (every page)
    hub.css                # hub layout + shared components (sections, plates, title block, reveal)
    sheet.css              # shared sheet layout (hero type, lede/meta, status band, next)
    drone.css              # Sheet 03 only: figure slots, parts table, chain, flight log, order list
    scroll.js              # shared reveals / nav / ghost word
    hub.js                 # hub-only: copy-email + the cat plate (+ imports scroll.js)
    nora-cat.js            # the hub's living cat plate (idle movement bank, no room)
    nora-loader.js         # Nora's loading-curtain promise (fonts, frames, demo document)
    style.css              # film styles (mirrors the tokens) + the film's chrome controls
    main.js                # film behaviour
    film-loader.js         # shared curtain behaviour (arm, process, Nora)
    arm-scene.js           # film three.js scene
    arm-viewer.js          # standalone viewer (dev harness + plate renders)
  public/
    fonts/ img/ models/ favicon.svg
  HUB-PLAN.md              # v7 direction: IA, design system, tech, open decisions
  SPEC.md                  # v2 spec (historical — the current direction is HUB-PLAN)
  ARCHITECTURE.md          # module contracts + build/routes
  BUILD-LOG.md             # v1–v7 build history
  .github/workflows/deploy.yml
```

QA captures and the iteration record for the hub + Sheet 02 are in `../review-v10/` (hub, phase 1),
`../review-v11/` (Nora sheet, demo states, first production pass) and `../review-v12/` (Sheet 02 final
pass: fresh capture set, QA report, independent critic notes). Sheet 03's captures and its 54-check
QA report are in `../review-v21/` (`qa-drone.json`, dev + production preview); the hub row + concept
render pass is in `../review-drone-hub/` (67 checks, screenshots).
