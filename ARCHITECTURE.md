# ARCHITECTURE.md — personal-page module contracts (v2)

Static portfolio site. Stack: **Vite 5 + three.js 0.170 + vanilla ES modules**.
No framework, no backend, no runtime data. Everything ships as static files.

## File layout

```
personal-page/
  index.html                  # HTML: all content, section ids, inline SVG diagram
  src/style.css               # all styling + design tokens
  src/main.js                 # page behaviour; dynamically imports arm-viewer.js
  src/arm-viewer.js           # three.js viewer for the articulated arm GLB
  public/models/arm-opt.glb   # 1.6 MB, meshopt + quantization, J1..J5 hierarchy
  public/img/arm-plate.webp   # 2x still render (paper-transparent), PNG fallback
  public/fonts/*.woff2        # Instrument Serif latin regular + italic
  public/favicon.svg
  vite.config.js              # base './', ports 5178 / 4178
```

`public/` is copied verbatim into `dist/`, so asset URLs in HTML/CSS are root-relative
(`./img/…`, `/fonts/…`, `./models/…`). **Do not move `models/` back to the repo root** — that is
exactly what broke the v1 production build (Vite does not copy root-level folders).

## Ownership / what each file owns

| File | Owns | Must not |
| --- | --- | --- |
| `index.html` | Content, semantics, section structure, diagram SVG | contain style/JS logic beyond hooks |
| `src/style.css` | Design tokens, layout, responsive, motion | be duplicated inline |
| `src/main.js` | Reveals, nav state, viewer boot, copy-email | implement 3D rendering |
| `src/arm-viewer.js` | Everything three.js: loading, materials, camera, orbits, pose | touch the DOM outside its canvas |

## HTML hooks (contract with main.js)

| Selector / id | Purpose |
| --- | --- |
| `#arm-canvas` | canvas the viewer renders into |
| `.viewer-stage` | observed container; when it approaches the viewport the viewer boots |
| `#arm-fallback` | still image shown until the canvas is ready (and if WebGL fails) |
| `#viewer-status` | loading/error line; gets `.is-hidden` when the model is live |
| `#pose-readout` | live joint angles (updated from `onPose`) |
| `[data-preset]` | camera preset buttons (`iso`, `profile`, `front`, `top`) |
| `#play-toggle` | play/pause, `aria-pressed` reflects state, `.pp-label` text |
| `.nav a[data-nav]` | section links; `aria-current="true"` on the active section |
| `#copy-email[data-email]` | clipboard button |
| `#mission`, `#arm`, `#drone`, `#status`, `#contact` | scroll targets + nav observers |

## src/arm-viewer.js — public API

```js
export async function createArmViewer(canvas, opts = {}) {
  // opts: { modelUrl = './models/arm-opt.glb', reducedMotion = false,
  //         onPose = null, autoplay = true }
  // returns:
  //   ready    Promise<void>            model loaded + one frame rendered
  //   setPreset(name, { immediate })    'iso' | 'profile' | 'front' | 'top' | 'detail'
  //   setPose(deg5, { immediate })      joint targets in degrees, clamped to limits, eased
  //   play() / pause()
  //   resize()                          also self-wires ResizeObserver on the canvas
  //   dispose()                         listeners, geometries, materials, renderer, env RT
}
```

Behaviour that the page depends on:

- **Loading:** `GLTFLoader` + `MeshoptDecoder` (`three/addons/libs/meshopt_decoder.module.js`),
  `RoomEnvironment` PMREM for metal reflections.
- **Geometry:** the GLB keeps the EPQ hierarchy `ArmRoot → J1 → J2 → J3 → J4 → J5` plus a mount
  transform copied from HAVK's `realArm.js` (chest-mount orientation, J1 axis horizontal). Joint
  rotation axes: J1 `y`, J2 `z`, J3 `x` (negated), J4 `z`, J5 `x` (negated).
- **Materials** are applied by GLB material name: `printed #1B222C`, `motor #11151C`,
  `silver #99A1AC`, `steel #AAB1BB`. A small `#C2410C` marker sits at the end effector.
- **Renderer:** `alpha: true`, clear alpha `0` (paper grid shows through), ACESFilmic tone mapping,
  SRGB output, pixel ratio capped at 2.
- **Framing:** distance is derived from the measured model bounds and the canvas aspect, so the arm
  is fully in frame at any canvas shape (desktop ≈ 1.0:1, phone ≈ 0.8:1).
- **Interaction:** custom orbit (not OrbitControls), so the page never loses vertical scroll on
  touch; horizontal drags orbit on touch, both axes on mouse; no wheel zoom.
- **Performance:** lazy boot via IntersectionObserver (500 px margin) + in-module IntersectionObserver
  so rendering pauses off-screen; render only when something changed (`needsRender`).
- **Reduced motion:** no showcase animation; static plate pose; presets still work.
- **Failure:** if the GLB/WebGL fails, `ready` rejects, the page keeps the still image and reports
  "3D view unavailable — still shown". No console errors in the happy path.

## src/main.js — behaviour

1. `html.js` class for reveal CSS (inlined in `<head>` to avoid a flash).
2. IntersectionObserver reveals for section heads/bodies/figures (`prefers-reduced-motion` → visible
   immediately).
3. Scroll-driven nav state (`aria-current`), rAF-throttled.
4. Arm viewer: dynamically imports `arm-viewer.js` only when the viewer is within 500 px; wires
   presets, play/pause, pose readout, fallback. Initial pose is `PLATE_POSE = [12, 38, 8, 52, 20]`
   so the still → live handoff is seamless; motion starts immediately after (unless reduced motion).
5. Copy-email with clipboard API + `execCommand` fallback.

## Build & deploy

- `npm run dev` → port **5178**; `npm run build` → `dist/`; `npm run preview` → port **4178**.
- `base: './'` — relative asset URLs, valid at a Pages project path or a domain root.
- Code-splitting is intentional: `arm-viewer.js` becomes a separate ~600 KB (156 KB gzip) chunk and
  is only requested on approach; the GLB is fetched by that chunk.
- CI: `.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on `master`.
  Required manual step: repo must be public on the free plan (or account on Pro) for Pages.

## Asset pipeline (how to regenerate)

**Arm GLB** — source of truth is the EPQ CAD (`HAVK/cad/EPQ-3.1-Design-FINAL.step`, Shapr3D). The
articulated export comes from `HAVK/three-arm/tools/export_model.py` + `optimize.mjs` (meshopt +
quantization). Regenerate there, copy to `public/models/arm-opt.glb`, then update the still:

**Hero / fallback still** — render from the page's own viewer, 2×, transparent:

```js
// in a Playwright page on the dev server, after forcing preserveDrawingBuffer:
const mod = await import('/src/arm-viewer.js')
const canvas = document.createElement('canvas')       // CSS 1200x1500, dpr 2
const viewer = await mod.createArmViewer(canvas, { reducedMotion: true, autoplay: false })
await viewer.ready
viewer.setPreset('iso', { immediate: true })
viewer.setPose([12, 38, 8, 52, 20], { immediate: true })
const png = canvas.toDataURL('image/png')             // keep alpha
```

Then crop to the alpha bounding box + 120 px padding (2×), resize to 900 px wide, export
`arm-plate.png` (optimised) and `arm-plate.webp` (quality 90). Keep `PLATE_POSE` in `main.js` and the
SPEC in sync with the pose used.

**Fonts** — Instrument Serif (SIL OFL) downloaded from Google Fonts as latin-subset WOFF2, stored in
`public/fonts/`, declared with `@font-face` + preload in `index.html`. No CDN requests.
