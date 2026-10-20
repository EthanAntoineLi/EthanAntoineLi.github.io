# Ethan Antoine Li — engineering portfolio

A static site laid out like an engineering drawing set. **Sheet 00** is the index (`/`). Two sheets
are published: **01** the arm film (`/work/arm/`) and **02** Nora, the personal AI (`/work/nora/`).

**Status:** built and verified locally (2026-10-20). **Not deployed** yet — see *Deploy* below. The
direction and the open decisions live in [`HUB-PLAN.md`](HUB-PLAN.md).

---

## What the site is

| Route | Sheet | Content |
| --- | --- | --- |
| `/` | 00 — index | Name, one line, current state, works register (01 and 02 published, 03–05 in prep), mission band with the system diagram, built/in build/next, record, contact, title block. No 3D. |
| `/work/arm/` | 01 — the arm | The v6 **product film**: fixed 3D stage, six camera stops, the real articulated `arm-opt.glb`, mesh/points/x-ray modes, free view with part details. Unchanged except a back link to the index. |
| `/work/nora/` | 02 — Nora | The personal AI that runs 24/7 on a Mac of her own, with an **interactive pixel-art desk cat** as its status window. Argument, state table, build diagram, and the live demo. |
| `/work/nora/demo/` | — | The actual desk-cat page, copied into the site and permanently in demo mode (fake events, no server). Embedded on Sheet 02; `?full` opens the complete pet page. |

Register rules: a sheet is only linked when it has real content. Sheets 03–05 (drone, AI interviewer,
physics) are listed as `SHEET IN PREP` until each has a real visual and facts to show.

Content rules: **nothing claims the drone vision system works**; **nothing from Nora's real activity
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
npm run dev       # http://localhost:5178/  (hub)  + /work/arm/, /work/nora/, /work/nora/demo/
npm run build     # → dist/ (all entries)
npm run preview   # http://localhost:4178/
```

Requires Node 18+ (tested on Node 24). Ports are pinned in `vite.config.js`.

## Assets

| File | Size | Origin |
| --- | --- | --- |
| `public/models/arm-opt.glb` | 1.6 MB, 290k tris | EPQ 3.1 Design FINAL.step (Shapr3D) → articulated GLB via `HAVK/three-arm/tools` (meshopt + quantization), joints `J1…J5` |
| `public/img/plates/arm-16x10.png/.webp` | 156 KB / 22 KB | 16:10 hub plate composed from a 1600×1000 render of the page's own `arm-viewer.js` at pose `[12, 38, 8, 52, 20]` |
| `public/img/plates/nora-16x10.png/.webp` | 112 KB / 11 KB | 16:10 hub plate composed from a 1600×900 capture of the Nora demo (working state) |
| `public/img/plates/nora-states.png/.webp` | 178 KB / 63 KB | 2×2 contact sheet of four demo states (listening, working, error, offline) |
| `public/img/arm-plate.png/.webp` | 193 / 46 KB | The film's own hero / no-WebGL still (portrait) |
| `public/fonts/*.woff2` | 48 KB total | Inter Tight 300/400, Instrument Serif italic — latin subsets, self-hosted |

Plate pipeline (local tooling, `dev/` is git-ignored): arm plate via `node dev/make-plate.mjs`; Nora
plates by capturing `?state=<state>` from the demo at 1280×720 / 1600×900 and composing on paper.

The desk cat itself is a copy of the Nora project's public page (`work/nora/demo/`, 58 KB JS + 7 KB
CSS, all pixel art drawn in code) with two small changes for the portfolio: an embed mode that fills a
160:90 iframe, and a scripted demo cycle rewritten around Nora's real jobs. It never connects to an
agent server.

## Performance

- Hub initial payload: ~70 KB (HTML 4 + CSS 4.4 gzip + fonts + 22 KB plate + 1 KB JS); no three.js.
- Sheet 02: ~14 KB gzip of page CSS/JS + 11 KB cover + 63 KB state figure (lazy); the demo iframe
  loads ~16 KB gzip of its own JS/CSS + no images.
- The film's hard 3D (≈167 KB gzip + 1.6 MB GLB) is still lazy and remains out of the hub's path.
- Hub and sheets read fine with **JavaScript disabled** — the sheet falls back from the live demo to
  the still plate. `prefers-reduced-motion` disables entrances.

## Deploy

`.github/workflows/deploy.yml` builds `dist/` and publishes it to GitHub Pages on push to `master`.
Two things are still manual / unverified:

1. The site is intended for the **user-site root** (`https://ethanantoineli.github.io/`), so the repo
   should be renamed `EthanAntoineLi.github.io`. `vite.config.js` uses `base: '/'`; build with
   `BASE=/personal-page/ npm run build` if it stays a project site.
2. GitHub Pages on the free plan needs a **public** repository. Verify before relying on the workflow.

`HUB-PLAN.md` §8–10 tracks the deploy/URL decision.

## Layout

```
personal-page/
  index.html               # Sheet 00 — hub
  work/arm/index.html      # Sheet 01 — the v6 film (verbatim, + back link)
  work/nora/index.html     # Sheet 02 — Nora
  work/nora/demo/          # the desk-cat page, demo-only (iframe target; ?full = full page)
    index.html nora.js style.css
  src/
    tokens.css             # shared design tokens + @font-face
    hub.css                # hub + shared components (chrome, sections, plates, title block, reveal)
    sheet.css              # sheet-specific layout (hero, demo, jobs, stack, states, status)
    scroll.js              # shared reveals / nav / ghost word
    hub.js                 # hub-only: copy-email (+ imports scroll.js)
    style.css              # film styles (mirrors the tokens)
    main.js                # film behaviour
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

QA captures and the iteration record for the hub + Sheet 02 are in `../review-v10/` (hub, phase 1)
and `../review-v11/` (Nora sheet, demo states, production pass).
