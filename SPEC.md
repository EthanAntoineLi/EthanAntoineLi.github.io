# SPEC — Ethan's Personal Page

> **Status note (2026-10-20):** this is the v2 single-page spec, kept for the content facts and the
> design language. The site is now a v7 **hub + sheets** build; the current direction, information
> architecture and open decisions live in [`HUB-PLAN.md`](HUB-PLAN.md) and the built state in
> [`README.md`](README.md) / [`ARCHITECTURE.md`](ARCHITECTURE.md).

**v2 — 2026-10-19.** This supersedes the v1 "scroll-story" spec (one cinematic Three.js scene over
three placeholder Meshy models). v2 keeps the content facts and the mission, and changes the form:
a **drafting-sheet portfolio** with the real CAD arm as the only 3D object. Why v1 was replaced is
recorded in `BUILD-LOG.md`; the short version is that the placeholder meshes could not carry the
story (71 MB, 660–883k tris, one merged mesh each, no rig), the white-clay look was unreadable, and
the production build shipped without the models at all.

Written in my voice, as instructions to any designer, developer, or future me.

---

## 1. Purpose & audience

This page is my **engineering portfolio**. It exists for two overlapping audiences:

1. **Universities** — I'm an A-level student applying for engineering. The page is a portfolio
   artifact that shows I build real hardware, not just talk about it.
2. **Peers & future employers** — anyone who wants to see what I'm building and why.

The page has to do three jobs:

- **Show the mission** — the "why" behind everything: mountain-rescue robotics.
- **Show the builds** — my two real prototypes, honestly framed as prototypes (no invented
  achievements).
- **Give a way to reach me** — email + GitHub + the full arm visualiser.

Tone: builder's logbook. Mission-driven, honest about the prototype stage, **zero hype**. If
something isn't built yet, the page says so.

---

## 2. Page structure

Single page, normal document scroll. Sections in order:

1. **Hero** — name, mission question, short lede, facts strip; the arm still render (`FIG. 01`) on
   the right. No 3D in the first viewport: the hero must paint instantly.
2. **01 — Mission** — the accident I keep seeing, and the intended system as a line diagram
   (`FIG. 02`): drone finds → position fix → handoff → arm reaches.
3. **02 — The arm** — the EPQ artefact. Copy, two spec tables, and the **live CAD viewer** in a
   sticky right column: real geometry, drag to orbit, iso/profile/front/top presets, play/pause,
   live joint-angle readout. Link out to the full visualiser (HAVK).
4. **03 — The drone** — what flies today vs. the recognition/fix/handoff layer that does not exist.
5. **04 — Status** — Built / In build / Next, plainly.
6. **05 — Contact** — email (with copy button), GitHub, arm demo.
7. **Footer** — engineering title block (project / subject / sheet / scale / rev / status) and a
   "built by hand · no tracking · no cookies" line.

---

## 3. Content notes per section (FACTS ONLY)

Keep everything factual. Do **not** invent achievements, stats, dates, or skills I never stated.
Where the page is a placeholder, label it as such.

### 3.1 Hero

- **Name:** Ethan Antoine Li.
- **Mission line:** *"Why send more people into the same dangerous ground to save someone — why
  not robots?"*
- **Lede:** A-level student; designs, prints and programs the pieces of a mountain-rescue system;
  a five-axis robotic arm and an FPV drone; both prototypes; the page says where things aren't
  built.
- **Facts strip:** Discipline (A-level: Maths, Further Maths, Physics, Chemistry) · Toolchain
  (Shapr3D, Bambu Lab H2S, STM32F407, three.js) · State (prototype, in build).
- **Plate:** `FIG. 01 — EPQ 3.1 arm`, caption `5 DOF built · 6 DOF designed`.

### 3.2 Mission

- **What I've seen:** I ski; every winter the same shape of accident — a person down on a line that
  is difficult, exposed or both, and a team that has to commit people to that ground.
- **The system:** two machines and a handoff. Drone finds the person and stays overhead; arm does
  the reaching and the lifting. Each half is a prototype; the handoff does not exist.
- **Diagram:** `FIG. 02 — system intent`, labelled "not a simulation". Drone = flying as FPV; arm =
  bench prototype; position fix and handoff explicitly marked **not built**; subject position
  unknown.

### 3.3 The arm (5-DOF robotic arm)

- **What it is:** my rescue robot's first piece — the EPQ artefact. Designed in **Shapr3D**, printed
  on a **Bambu Lab H2S**.
- **DOF:** **6 designed, 5 built** — the budget stopped at five motors. This phrasing resolves the
  old 5-vs-6 ambiguity and must stay consistent everywhere.
- **Architecture (from the EPQ):**
  - Actuators: UMIR57 ×2 (J1, J2), UMIR42 ×3 (J3–J5) steppers.
  - Reductions: 25:1 planetary on the base; self-locking 50:1 worm on the shoulder.
  - Torque: 19 N·m base, 5.4 N·m shoulder.
  - Controller: STM32F407; bus: RS485 / Modbus-RTU.
  - Payload **target**: 500 g.
- **Joint travel:** J1 ±120°, J2 0–150°, J3 ±135°, J4 0–140°, J5 ±180° (J2/J4 ranges from the EPQ
  report, FR-03; others are design values).
- **Viewer copy:** the arm on the page is the real CAD assembly (same file as the EPQ model),
  exported with five articulated joint nodes and posed at runtime — no stand-in geometry, no video.
- **Full visualiser:** link to `https://ethanantoineli.github.io/HAVK/`.

### 3.4 The drone (FPV drone)

- **What it is:** an FPV drone — pilot, goggles, video feed. Flown today as FPV only.
- **Role in the mission:** find the injured person, hold position, hand a location to the arm.
- **Status pipeline:** Fly = built · Recognise = not built · Fix = not built · Hand off = not built.
- Say openly that the recognition/positioning layer is the next build and that this section stays
  short until there is something real to show.

### 3.5 Status

- **Built:** arm CAD finalised (EPQ 3.1 Design FINAL); five joints printed, assembled and moving;
  real-geometry articulation in three.js; drone flying as FPV (pilot + video link only).
- **In build:** arm firmware on the STM32F407; RS485/Modbus-RTU joint control; payload work toward
  the 500 g target.
- **Next:** drone person-recognition; a usable position fix; the handoff from fix to arm.
- Footnote: "Last updated — October 2026 · corrections welcome."

### 3.6 Contact

- **Email:** ethan.li.1@outlook.com (professional address; copy button).
- **GitHub:** [EthanAntoineLi](https://github.com/EthanAntoineLi).
- **Arm demo:** `https://ethanantoineli.github.io/HAVK`.

---

## 4. Design language (v2)

### 4.1 The sheet

The page is a technical sheet, not a landing page:

- **Paper** `#EEF2F7` background with a fine grid (`#D3DDE8`, 32 px) that fades at the edges, a
  fixed hairline sheet border (12 px inset), and a fixed topbar with the name/nav/status.
- **Structure** carried by hairline rules and a left index column (`01 MISSION` …), never by
  rounded cards or shadows. Section headers are asymmetric: mono index left, serif statement right.
- **Colour** is restrained: ink `#0B1B2F` for text, muted `#4A5B70` for prose, signal orange
  `#C2410C` only for meaning (missing links in the diagram, "not built" notes, current section,
  accent marks). No gradients as decoration; no dark mode.
- **Type:** Instrument Serif (400, roman + italic) for the name, section statements and mission
  lines; system sans for body prose; system mono (uppercase, letterspaced) for labels, tables,
  annotations, fig captions and status.
- **Furniture:** figure captions (`FIG. 01 — …`), table headers (`TABLE 01 — ARCHITECTURE`),
  corner ticks on image plates, engineering title block in the footer, `SHEET 01 OF 01`.

### 4.2 The one 3D object

- The arm viewer in section 02 is the only 3D in the page (sticky in the right column), sized
  `clamp(420px, 61vh, 640px)` tall on desktop, static below 1040 px.
- Transparent canvas over the paper grid; no floor, no rings, no in-canvas UI; the model floats.
- Materials: printed `#1B222C`, motors `#11151C`, silver `#99A1AC`, steel `#AAB1BB`, with HAVK's
  environment/light rig so metal reads correctly. A small accent tip marks the end effector.
- Camera presets from HAVK (iso / profile / front / top), 700 ms eased; drag orbits (touch: only
  horizontal drags orbit, so vertical page scroll is never blocked); **no wheel zoom** on the page.
- Gentle showcase motion, pausable; disabled under `prefers-reduced-motion`, with the still plate as
  the no-WebGL fallback.
- The hero plate is a 2× render from this same viewer, so the still and the live model agree.

### 4.3 Rules

- No trackers, no analytics, no cookies, no external requests (fonts and assets self-hosted).
- Initial payload budget: **< 200 KB** before the 3D section is approached. 3D chunk and GLB must
  stay lazy.
- Content is static HTML — it must read fine with JavaScript disabled.
- Respect `prefers-reduced-motion`.
- Everything must be true. Do not reintroduce the v1 placeholder meshes.

---

## 5. Tech stack

- **Vite 5** for dev/build; `base: './'` so the build works at any Pages path.
- **three.js 0.170** for the arm viewer only (dynamically imported).
- **Vanilla JS ES modules**, no framework, no UI library, no CSS framework.
- **No backend, no database, no tracking.** Fonts and GLB are static assets in `public/`.
- Node 18+; dev port 5178, preview port 4178 (pinned in `vite.config.js`).

---

## 6. File map

```
personal-page/
  index.html                  # content + inline SVG system diagram
  src/style.css               # design tokens, layout, responsive, reduced motion
  src/main.js                 # reveals, nav state, lazy viewer, copy-email
  src/arm-viewer.js           # three.js viewer (standalone, contract in ARCHITECTURE.md)
  public/models/arm-opt.glb   # articulated CAD arm, 1.6 MB, 290k tris
  public/img/arm-plate.*      # 2× still render (WebP + PNG fallback)
  public/fonts/*.woff2        # Instrument Serif, latin subset
  public/favicon.svg
  vite.config.js
  package.json
  SPEC.md / ARCHITECTURE.md / BUILD-LOG.md / README.md
  .github/workflows/deploy.yml
```

---

## 7. Deployment

- GitHub Pages, deployed from GitHub Actions on push to `master` (build `dist/`).
- **The repository is private.** Pages on the free plan needs a public repo (or a Pro plan) — decide
  this before the first deploy.
- `base: './'` means no path changes are needed for `EthanAntoineLi.github.io/personal-page/`.
- Custom domain is optional and not configured.

---

## 8. Open items (confirm before/after deploy)

1. **Status list** — the "Built / In build / Next" items are drafted from the EPQ notes; confirm each
   is still true (especially firmware/RS485 progress and the payload work).
2. **500 g payload** — page calls it a *target*, not a result. Confirm wording.
3. **A-level subject list** in the hero facts strip — confirm it should be public.
4. **Date** — "Last updated — October 2026". Update when the page changes.
5. **Drone copy** — recognises only "FPV flying" as built. If the airframe/parts differ from that
   wording, correct it.
6. **Repo visibility / Pages** — make public or use Pro; then enable Pages (source: GitHub Actions).

---

## 9. Done vs. not done

**Done (v2):** drafting-sheet layout (hero, mission + diagram, arm + live CAD viewer + spec tables,
drone pipeline, status, contact, title-block footer); real articulated CAD arm viewer with presets,
drag orbit, live joint readout, reduced-motion and no-WebGL fallbacks; self-hosted fonts; responsive
down to 360 px; production build verified (models are in `dist/`, unlike v1); performance budget met;
GitHub Actions deploy workflow prepared.

**Not done:** deploy / Pages enablement (needs the visibility decision); real photographs of the
printed arm and the drone; drone vision video (doesn't exist yet); custom domain; optional link to
the EPQ report once finalised.
