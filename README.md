# Ethan Antoine Li — Rescue Robotics

A one-page engineering portfolio, laid out like a drafting sheet: paper, hairlines, mono
annotations, one signal colour — and, in section 02, the **real CAD assembly** of my 5-DOF
robotic arm, articulated live in the browser.

**Mission:** *Why send more people into the same dangerous ground to save someone — why not robots?*

Live: _not deployed yet_ · Local: `npm run dev` → http://localhost:5178/

---

## What the page is

| Section | Content |
| --- | --- |
| Hero | Name, mission line, one arm still render (`FIG. 01`), the facts strip |
| 01 — Mission | Why mountain rescue, and the intended drone → fix → arm system as a drawing |
| 02 — The arm | The EPQ artefact: real CAD arm viewer, architecture + joint-travel tables, link to the full visualiser |
| 03 — The drone | What the FPV drone does today vs. the recognition layer that isn't built |
| 04 — Status | Built / In build / Next, stated plainly |
| 05 — Contact | Email, GitHub, arm visualiser |

Content rule: **nothing claims the drone vision system works.** Prototype status is labelled
wherever it matters. If a fact changes, change it here first.

## Stack

- **Vite 5** + **three.js 0.170** (vanilla ES modules, no framework, no router, no trackers).
- Self-hosted **Instrument Serif** (WOFF2, latin subset, SIL OFL) — serif for voice, system sans
  for prose, system mono for technical annotation. No external font/CDN requests.
- Palettes carried over from the EPQ arm visualiser (HAVK): paper `#EEF2F7`, ink `#0B1B2F`,
  accent `#C2410C`, grid `#D3DDE8`.

## Run it

```bash
npm install
npm run dev       # http://localhost:5178/
npm run build     # → dist/ (static, relative paths)
npm run preview   # http://localhost:4178/
```

Requires Node 18+. The dev server binds all interfaces; ports are pinned in `vite.config.js`.

## Assets

| File | Size | Origin |
| --- | --- | --- |
| `public/models/arm-opt.glb` | 1.6 MB, 290k tris | EPQ 3.1 Design FINAL.step (Shapr3D) → articulated GLB via the HAVK export pipeline (`HAVK/three-arm/tools/export_model.py`, `optimize.mjs`); meshopt + quantization compression, joints `J1…J5` |
| `public/img/arm-plate.png/.webp` | 193 / 46 KB | 2× render from the page's own viewer (iso preset, pose `[12, 38, 8, 52, 20]`), cropped and padded |
| `public/fonts/instrument-serif-*.woff2` | 30 KB total | Instrument Serif, SIL Open Font License, latin subset self-hosted |

The old `robot.glb` / `person.glb` / `drone.glb` Meshy meshes (660–883k tris, 71 MB total, no
usable hierarchy) are **not** part of this build. They were archived outside the repo and removed
from git in the v2 rebuild — see `BUILD-LOG.md`.

## Performance

Initial payload before the 3D section is reached: ~130 KB (HTML + CSS + page JS + fonts + hero
WebP). The arm viewer chunk (156 KB gzip) and the GLB (1.6 MB) are dynamically imported only when
section 02 comes within 500 px of the viewport, so the page reads instantly and the 3D is never in
the critical path. The canvas is transparent (paper grid shows through), `prefers-reduced-motion`
disables the pose animation, and without WebGL the page falls back to the still plate.

## Deploy

`.github/workflows/deploy.yml` builds `dist/` and publishes it to GitHub Pages on every push to
`master` (Pages source: *GitHub Actions*). One manual step is required first: the repository is
currently **private**, and GitHub Pages on the free plan only serves public repositories — make the
repo public (or use a Pro plan) before the first deploy.

`vite.config.js` uses `base: './'`, so the build works both at `EthanAntoineLi.github.io/personal-page/`
and at a custom-domain root without changes.

## Layout

```
personal-page/
  index.html              # all content, semantic sections, inline system diagram (SVG)
  src/
    style.css             # design tokens, layout, responsive rules, reduced motion
    main.js               # reveals, nav state, lazy arm viewer wiring, copy-email
    arm-viewer.js         # three.js viewer for public/models/arm-opt.glb (standalone)
  public/
    fonts/                # Instrument Serif woff2 (latin)
    img/                  # hero / fallback plate renders
    models/arm-opt.glb    # articulated arm CAD (1.6 MB)
    favicon.svg
  SPEC.md                 # what this page wants to be, content facts, design language
  ARCHITECTURE.md         # module contracts + asset pipeline
  BUILD-LOG.md            # v1 scroll-story record, then the v2 rebuild rationale
  .github/workflows/deploy.yml
```

`src/arm-viewer.js` is self-contained and can be reused: it loads the articulated GLB, fits the
camera to the model bounds at any canvas aspect, orbits on drag, switches to iso/profile/front/top,
and exposes `setPose(deg5)` / `play()` / `pause()`.
