# Build Log — Ethan's Personal Page

## 2026-10-19 — v2 rebuild: drafting sheet + the real CAD arm (current)

### Why v1 was replaced

**Verdict:** the v1 scroll-story was not salvageable, not fixable with polish. Ethan's call was "大改".
Diagnosis from reading the code and running it (evidence, not taste):

1. **The production build had no models.** `models/*.glb` sat at the repo root; Vite only copies
   `public/` into `dist/`, so `/models/robot.glb` 404'd. Opening the build showed a black page with
   `failed to load models — check console`. In other words the page that would have been deployed
   could not have worked at all. (Old build: 71 MB of GLBs, 3.2 MB dist → new build: 3.2 MB total
   incl. assets, verified.)
2. **The assets were unusable for the concept.** `robot.glb` 658k tris, `person.glb` 685k, `drone.glb`
   883k — 21–29 MB each, one merged mesh per file, no skeleton, no named parts, one material, no
   textures (Meshy / text-to-3D output). The story demanded an arm close-up and a rigged pose
   ("kneeling, hand on chest"); no amount of transforms can deliver that from a single blob. The
   "clay monochrome" treatment then turned white-on-white geometry into a whiteout, and the 0.72 dim
   overlay hid what little read.
3. **71 MB of downloads for a one-page portfolio** on a page whose hero is text.
4. **No mobile pass, no deploy, no tests.** The repo had one commit, no build verification, no QA.

### Decision

Replace the form, keep the facts. New direction: a **drafting-sheet portfolio** (paper, hairlines,
mono annotations, one signal colour) whose single 3D object is **Ethan's real arm CAD** — the
articulated mesh already validated in his HAVK EPQ visualiser (290k tris, meshopt-compressed to
1.6 MB, five real joints). Reuse HAVK's palette (`#EEF2F7` paper, `#0B1B2F` ink, `#C2410C` accent)
so the portfolio and the EPQ artefact read as one body of work.

### Built

- **Page:** hero (name, mission, `FIG. 01` arm still, facts strip) → 01 mission (why + inline SVG
  system diagram with the missing position-fix/handoff links drawn as missing) → 02 arm (real CAD
  viewer, architecture + joint-travel tables, "reading the model" note, HAVK link) → 03 drone
  (Fly/Recognise/Fix/Hand off pipeline, only Fly built) → 04 status (Built/In build/Next) → 05
  contact (email + copy, GitHub, arm demo) → engineering title-block footer.
- **Arm viewer** (`src/arm-viewer.js`, new): real articulated GLB, transparent canvas over the paper
  grid, camera fitted to measured bounds at any aspect, iso/profile/front/top presets, custom drag
  orbit (never blocks page scroll on touch), play/pause showcase, live joint-angle readout, lazy
  boot on approach, reduced-motion + no-WebGL fallbacks, dispose/context-loss handling.
- **Design system:** Instrument Serif (self-hosted, latin subset) + system sans + system mono;
  hairline grid, sheet frame, index column, fig/table furniture, `prefers-reduced-motion` support.
- **Assets:** `arm-opt.glb` (1.6 MB) from the HAVK export pipeline into `public/models/`; hero and
  fallback stills rendered from the page's own viewer at 2× and cropped (`arm-plate.webp` 46 KB /
  `.png` 193 KB); fonts self-hosted, no CDN.
- **Repo hygiene:** the 71 MB Meshy meshes archived outside the repo and removed from git (recoverable
  from the v1 commit); stale `dist/` untracked; `models/` no longer at the root (that was the build
  bug); GitHub Actions Pages workflow added.
- **Docs:** README / SPEC / ARCHITECTURE rewritten for v2; this log prepended.

### Verified

- `npm run build` green; `dist/` contains `models/`, `img/`, `fonts/`; production preview
  (`4178`) renders the page and loads the live arm — the exact failure mode of v1 is gone.
- Dev + production screenshots at 1440×900 and 390×844: no horizontal overflow, no console errors,
  fonts loaded, sticky viewer composited correctly, player/presets/readout exercised.
- Interaction test on the real page: presets switch (`on` state + camera), play/pause toggles
  `aria-pressed` and label, drag orbits, pose readout tracks the joints, copy-email → "Copied".
- Payload: initial page ≈ 130 KB (HTML + CSS + main JS + fonts + hero WebP). 3D chunk 156 KB gzip +
  1.6 MB GLB are lazy, requested only when section 02 approaches.

### Known limits / next

- 3D boot is intentional-lazy: in software-rendered headless Chrome it takes several seconds; on
  real hardware it is ~1–2 s. The still plate covers the wait.
- No real photographs of the printed arm or the drone yet; no real vision footage (it does not
  exist). Add when they exist — both would strengthen the page more than any further styling.
- Deploy pending: repo is private, Pages on the free plan needs public (or Pro). Needs Ethan's OK.
- Status facts ("in build" firmware/bus, payload work) are drafted from the EPQ notes and flagged in
  `SPEC.md §8` for confirmation.

---

## v1 archive — scroll story (2026-09-16 → 2026-09-25)

> The build described below was replaced on 2026-10-19. Its source files (`scene.js`,
> `choreography.js`, `models/*.glb`) no longer exist in the repo; this is kept as history only.


Project: `C:\Users\Ethan\.openclaw\workspace-coder\personal-page\`
Stack: Vite + Three.js (vanilla). Local preview only, no deploy.

## 2026-09-16 — Initial build (GO given 22:40)

### Orchestration (re-run as lead, not solo)
Split the build into parallel workstreams with module contracts in `ARCHITECTURE.md`:
- **WS-A/B** (subagent `WS-A/B · 3D scene + choreography`) → `src/scene.js` + `src/choreography.js`.
- **WS-C** (subagent `WS-C · hero + tail UI`) → `index.html` + `src/style.css`.
- **LEAD (Lior)** → `src/main.js` integration + review.

Review verdicts:
- WS-A/B: PASS — normalize-by-largest-dimension (handles flat drone correctly), shared clay material on all meshes, monochrome 4-light studio setup, tilted slope + mounds, correct poses, `idle(dt)` in seconds. Choreography: 4 keyframes, smoothstep camera+lookAt lerp, caption/dim fade windows, passive scroll. Build green.
- WS-C: PASS — all 10 required IDs present, monochrome palette, Playfair + DotGothic16 (open-source), responsive clamp type, prefers-reduced-motion. Fixed `#hero` positioning (absolutely-positioned `.strip` anchoring), removed `#dim` CSS transition (would fight JS per-frame opacity), removed tail gradient.
- Integration: PASS — `main.js` wires scene + choreography, render loop with dt clock, resize, CTA, loading fade. `npm run build` green; browser-verified render (drone + terrain + figures visible).

### Done
- Scaffolded fresh Vite + Three.js project (clean slate).
- Identified the 3D models:
  - `person.glb` (original) → **ROBOT** — rescue backpack with medical cross + antenna, segmented mechanical joints.
  - `person-v2.glb` (original) → **HUMAN** — ski helmet, winter jacket, mittens, boots.
  - `drone.glb` → quadcopter drone.
  - Renamed in `models/` → `robot.glb`, `person.glb`, `drone.glb`. Originals untouched.
- Hero: pure black full-viewport, serif editorial headline ("Ethan Antoine Li" + mission line), dot-matrix strip ("2 PROTOTYPES · 5 DOF · 1 RESCUE MISSION · ∞ QUESTIONS"), one button "See the system" → scrolls to story.
- Scroll story: single Three.js scene, scroll-driven camera across 4 keyframes:
  1. Wide — person lying on clay slope, robot kneeling beside, drone hovering above.
  2. Push into robot's arm (mechanical detail).
  3. Close on the arm.
  4. Pull out to drone (half frame).
  - Captions fade in/out at the arm + drone beats.
- Tail: Toolbox (Bambu Lab H2S, Shapr3D), In progress (arm = EPQ, drone vision next), Contact (email only, no GitHub).
- Monochrome clay look: shared `MeshStandardMaterial` (roughness 0.95), soft studio lighting (hemi + key + rim + fill).
- Fonts: Playfair Display (serif) + DotGothic16 (dot-matrix) — open-source (Google Fonts).
- Production build verified: `npm run build` → dist/ (JS 568 KB / 146 KB gzip).

### Posing (v1, approximate transforms)
- Person: `rotation.z = π/2` to lie on back, on the slope.
- Robot: lowered + leaned toward person (`rotation.z ≈ 0.18`, `rotation.x ≈ 0.12`).
- Drone: hovering above, gentle idle bob/rotation.
- Precise rigging + real arm/drone models: later (drop-in via `models/`).

### Known limitations / next steps
- Models are high-poly (658k–883k tris, 20–29 MB each) → load is heavy; decimate for web later.
- Robot/human poses are rough transforms, not rigged.
- Ethan's real arm + drone GLBs will replace placeholders (file-swap in `models/`).
- Camera keyframes need a visual pass — tune after Ethan sees it.

### Preview
- Dev server gets reaped after 30 min in background. To view: `cd C:\Users\Ethan\.openclaw\workspace-coder\personal-page && npm.cmd run dev` then open http://localhost:5173/.

## 2026-09-17 — Visual-match iteration loop (reviewer = Lior; worker = subagent)

Keyframes (locked, from page-plan.md + inbound PNGs):
- K1 wide (…9a726e4d, 21:14): skier lying on back, robot KNEELING beside with hand on chest (medical-cross backpack), drone overhead, skis/poles scattered.
- K2 arm (…544c84fa, 21:23): over-the-shoulder close-up on the robot's ARM — mechanical joints in focus, skier's face blurred in background, drone small in distance.
- K3 drone (…238b88a0, 21:26): drone LARGE in foreground (~half frame), robot+skier blurred in depth below.

### Round 1 (worker subagent `Visual-match · scene iteration`)
- Worker rewrote scene.js (near-white clay material 0xf2f2f2, roughness 1.0; gray studio backdrop + fog; brighter exposure 1.3; person lying via rig, robot leaned forward, drone overhead; skis+poles added) and choreography.js (4 new keyframes). Build green.
- Lior's screenshot verdict:
  - Clay look: PASS — reads as high-key white/gray matte clay.
  - Beat 1 (wide): PARTIAL — person lying + gear good, but robot is STANDING upright, not kneeling; drone barely visible.
  - Beat 2 (arm): FAIL — frames the full robot body, not a close-up on the arm; skier not in background.
  - Beat 3 (drone): FAIL — drone small and at an odd angle (reads like a floating figure), not large in foreground.
- Feedback sent to round 2: kneel the robot (lower + lean, hand toward chest), move gear off the body to scattered positions, tighten beat-2 keyframes onto the arm region, enlarge + reframe drone for beat 3 so it reads as a quadcopter.

### Round 2 (same worker session)
- Worker: robot sunk -0.45m to kneel + 43° lean; drone moved to (0.2,3.5,-0.8) overhead; bg darkened to 0xc7c7c7 for silhouette; keyframes retargeted (arm camera to ~0.5-0.6m height / ~0.75-1.15m distance; drone camera to ~1.1m from drone). Build green.
- Lior's screenshot verdict:
  - Beat 1 (wide): PASS — person lying, robot crouched/reaching, drone overhead, skis visible. Matches K1.
  - Beat 2 (arm): PASS — segmented robotic-limb close-up, mechanical detail, caption "01 / The arm". Matches K2.
  - Beat 3 (drone): FAIL — the robot's raised arm fills the frame, drone NOT visible as the subject. Camera keyframe 3 still not framing the drone.
- Feedback sent to round 3: fix beat-3 camera so the DRONE fills ~half the frame (robot+person small in depth below), not the robot's arm.

### Round 3 (same worker session)
- Worker: keyframe 3 camera → (0.3,5.0,-1.2) looking at (0,0.4,0) so drone + pair are collinear (drone dead-center ~2/3 frame); drone slight pitch/roll for quadcopter read. Build green.
- Lior's screenshot verdict:
  - Beat 1 (wide): PASS (unchanged).
  - Beat 2 (arm): PASS (unchanged).
  - Beat 3 (drone): PARTIAL — drone is now centered/large but still doesn't read unambiguously as a quadcopter; overall contrast is so low the scene reads as whiteout (shapes hard to distinguish).
- Feedback sent to round 4: increase beat-3 drone readability (crisp silhouette vs darker sky, ensure 4 rotor arms visible), and add general gray separation between terrain/figures/sky so shapes read.

### Round 4 (same worker session)
- Worker: added terrainMaterial 0xd0d0d0 + sky 0x9a9a9a (3-tier gray separation); drone scale 1.2→1.4, flattened pitch/roll for top-down X-frame read. Build green.
- Lior's screenshot verdict:
  - Beat 1 (wide): PASS (tonal separation improved).
  - Beat 2 (arm): PASS.
  - Beat 3 (drone): STILL FAIL — the camera lookAt still points at the PAIR (0,0.4,0), so the two figures are centered/prominent and the drone floats above them as abstract shapes. Drone is not the dominant subject.
- Feedback sent to round 5: point beat-3 camera AT the drone (lookAt drone center), drone as dominant foreground, pair small at bottom edge.

### Round 5 (same worker session) — final
- Worker: keyframe 3 → pos (1.6,3.6,-0.3), target (0.2,3.5,-0.8) (aimed at drone); drone yaw -0.79 for X-frame read. Build green (dist/ regenerated).
- Lior's screenshot verdict:
  - Beat 1 (wide): PASS.
  - Beat 2 (arm): PASS.
  - Beat 3 (drone): PARTIAL — drone now centered/dominant and camera is aimed at it (correct direction), but (a) the pair falls OUTSIDE the frame (worker-flagged, ~59° below view axis) so the K3 "pair in depth below" composition is missing, and (b) the drone still doesn't read unambiguously as a quadcopter in the screenshot.
- Loop cap (5 rounds) reached. Residual gap: beat-3 pair-in-frame + drone quadcopter read. Ready fix (worker identified): raise camera + aim down (e.g. pos (0.6,5.6,-1.0), target drone) to keep drone large AND bring pair into lower frame; or widen FOV to ~60°.

## Visual-match loop — final verdicts
- **Beat 1 (wide): PASS** — person lying, robot kneeling/reaching, drone overhead, tonal separation. Matches K1.
- **Beat 2 (arm): PASS** — segmented robotic-limb close-up + caption. Matches K2.
- **Beat 3 (drone): PARTIAL** — drone centered/dominant, but pair out of frame + quadcopter read not crisp. One ready fix outstanding.

### Round 6 (final, Ethan-approved beat-3 camera fix)
- Worker: keyframe 3 → pos (0.6,5.6,-1.0), target (0.2,3.5,-0.8) (aimed down at drone); FOV left at 45°. Build green; dist/ regenerated.
- Lior's screenshot verdict:
  - Beat 1 (wide): PASS (unchanged).
  - Beat 2 (arm): PASS (unchanged).
  - Beat 3 (drone): COMPOSITION FIXED (drone dominant + pair back in lower frame), but the drone STILL does not read crisply as a quadcopter — it reads as abstract floating shapes in the white-on-white render. This is a placeholder-model + low-contrast limitation, not a camera-framing issue.

### FINAL visual-match verdict
- **Beat 1 (wide): PASS**
- **Beat 2 (arm): PASS**
- **Beat 3 (drone): PARTIAL** — composition correct, drone readability residual. Root cause: placeholder drone.glb + monochrome white-on-white; the real colored drone model (arriving later, drop-in via models/) will resolve the quadcopter read, per the locked color-reveal plan.

## PAUSED 2026-09-17 18:08 — Ethan gaming; loop parked mid-flight
- State: 6 rounds complete (R1–R5 loop + final beat-3 camera fix). Beats 1–2 PASS; beat 3 composition fixed, quadcopter-read residual (deferred to real drone model). No subagent running, no file writes in progress. Resume on Nora's go.

## RESUMED 2026-09-17 23:21 — finalized (no further rounds needed)
- Read STUDIO-HANDBOOK.md + TASK-TEMPLATE.md. Handbook §2 is decisive: monochrome clay is a placeholder look; near-white untextured geometry reads as abstract shapes, and NO camera framing fixes silhouette/readability — "Do not burn review rounds on camera fixes for a placeholder-model readability issue; document it as residual and defer to the real model."
- Decision: the loop already met its cap (6 rounds). Beats 1–2 PASS, beat 3 composition PASS (drone dominant + pair in frame). The only residual (drone quadcopter read) is the placeholder-model limitation, exactly the case the handbook says to defer, not loop on. No further worker round spawned.
- Re-verified on-disk state matches round 6 (keyframe 3 = (0.6,5.6,-1.0)→drone; drone yaw -0.79; terrainMaterial + sky 0x9a9a9a). Ran `npm run build` — green, dist/ regenerated.

## FINAL visual-match verdict (locked)
- **Beat 1 (wide): PASS**
- **Beat 2 (arm): PASS**
- **Beat 3 (drone): PASS (composition)** — drone dominant + pair in depth below; quadcopter readability deferred to the real colored drone model (drop-in models/ swap, per locked color-reveal plan).

## 2026-10-19 — v3 visual pass (branch `design/v3`)

Design-only pass; no content, copy or JS behaviour changed.

- Reworked the palette to warm paper (`#f2eee5`), ink (`#14171b`), rust signal (`#b23e22`) and a
  blueprint navy (`#0f2438`). Every text pair re-checked for WCAG AA.
- Body type moved from the system sans to self-hosted Instrument Sans 400 (latin subset, 17 KB);
  mono annotations raised to 10.5px and darkened.
- Mission is now a full-bleed navy plate, the diagram re-inked in white/rust; the drone section is a
  recessed band with a "NOT BUILT — 2026" stamp; contact closes on ink. Section rhythm is no longer
  monotone paper.
- Hero render gets a drop shadow and crosshair; the viewer stage gets a raised-paper radial.
- Added sheet-edge label, paper grain, ghost status numerals via CSS counters, line-clip hero
  entrance, and a tightened reveal curve.
- Verified: `npm run build` green; no console errors; no horizontal overflow at 1440/390.
- Reference board and design rationale: `../review-v3/DESIGN-NOTES.md`.

## 2026-10-19 — v4 "scan film" (branch `design/v4`)

Full rewrite of the shell. v3 was a document; v4 is a product film: one fixed canvas,
five 100vh acts, ~171 words on the whole page (v2 had ~1,100).

- New `src/arm-scene.js`: the real `arm-opt.glb` on a transparent stage with five camera
  stops (`hero / joints / profile / scan / outro`), damped blending, drag orbit, pointer
  parallax, and a 90k-point cloud sampled from the same CAD (`mesh` / `points` / `xray`).
  60 fps on Metal at 1440x900 DPR2, 20 draw calls, 290k tris.
- New `index.html` / `src/style.css` / `src/main.js`: fixed chrome (frame counter, GMT+8
  clock, progress, index overlay), scan-counter loader, custom crosshair cursor, per-act
  ghost type, scroll-scrubbed stops, scroll cross-fade between acts, masked line reveals.
- Type: Inter Tight 300/400 self-hosted + Instrument Serif italic for the single pull
  quote. Paper `#f6f6f4`, ink `#101214`, rust `#b23e22`.
- Copy cut to: name + one 3-line line, one pull quote, 3 spec figures, 5 joint ranges,
  two honest lines about the drone half, contact.
- Added `lenis` dependency; `dev/scene-test.html` fixture for tuning stops in isolation.
- Reference: https://drone.riotters.com/ (Awwwards) + a six-site mechanisms survey at
  `../review-v4/ref/awwwards/MECHANISMS.md`. Design notes: `../review-v4/DESIGN-NOTES.md`.
- Verified: build green, no console errors at 1440x900, scene fallback image when WebGL
  fails, reduced-motion path, resize re-fit.

### v4 addendum (same day)
- Deferred scene creation until after the loader curtain; phones (≤820px) keep the
  still render and skip WebGL, so mobile is presentable without being tuned.
- Loader is wall-clock driven (the GLB parse used to stretch the frame-count animation).
- Tuned the `joints` stop to clear the spec row; contact outro sits lower-right with the
  footer note moved bottom-left; progress marker moved to the left edge; index overlay is
  opaque.

## 2026-10-19 — mobile pass (branch `mobile`)

- Phone layout (≤820px): the 3D stage stays, the scene re-composes its stops for
  portrait (`phone: true` → object centred, lifted into the upper half, fills ×0.68–0.9,
  DPR capped at 1.5). Copy becomes a bottom-anchored single column.
- Scene: hero/payload/geometry/scan/outro all reframed for 390×844; spec figures become
  compact stacked rows; joint table compresses; contact centres; market chrome keeps only
  brand + INDEX; progress/mode/frame/clock hidden.
- Fixed a real mobile bug: horizontal entrance transforms (swing) and the velocity tilt
  on the fixed stage widened the layout viewport (innerWidth 449 on a 390 screen). Phones
  now use vertical-only transitions and a clipped, untransformed stage.
- Close-up strength on phones reduced to 0.3 (was 0.85).
- Verified: innerWidth == clientWidth == 390, no horizontal scroll, scene-ready, 0 console
  errors; desktop 1440×900 unchanged.

## 2026-10-20 — free view hand-over to presets

- The Free view now hands the camera back to the page as soon as the visitor
  scrolls out of it (in either direction): the camera eases from whatever
  orbit/zoom they left it at back to the neighbouring slide's preset.
- Arriving on any slide is deterministic: after free-view manipulation the
  Scan framing matches a clean pass (az/el/distance within damping epsilon).
- Scrolling back up into Free view resets it to its own preset, so the section
  always starts from the same framing; idle spin restarts from there.
- Boot/reload at the Free section no longer counts as "leaving" (direction is
  only known after real scroll input).

## 2026-10-20 — every slide arrives at its preset

- Root cause of "moved it on slide 1, slide 2 looks different": the clamped drag
  orbit is global, so a nudge on one slide leaked into every following slide.
- Fixed with preset hygiene in `measure()`: a one-shot `releaseManual()` when a
  slide's transition starts (local t > 0.5) and again when a new slide is
  reached. Orbit/zoom are reset (damped) so every slide settles on its own
  framing, no matter how the previous slide was left.
- Verified: dragging payload/geometry/scan then moving on gives Δaz/Δel ≤ 0.003
  rad and Δdistance ≤ 0.002 vs a clean pass (free view hand-over already exact).

## 2026-10-20 — v7 hub, phase 1 (branch `hub`, local only)

The site stops being one film and becomes a drawing set: **Sheet 00** is an index, **Sheet 01** is the
existing arm film. Design rationale and the open decisions are in `HUB-PLAN.md`; this entry records
what was built.

- **Split, not rewrite.** `index.html` moved to `work/arm/index.html`; its asset URLs became absolute
  (`/fonts`, `/img`, `/src`) and the GLB URL is derived from `import.meta.env.BASE_URL`. The film's
  markup, CSS, scene and behaviour are otherwise untouched. Added a left-side `← sheet 00` link in the
  chrome back to the hub.
- **New hub** (`index.html`, `src/hub.css`, `src/hub.js`, `src/tokens.css`): hero (name, one line,
  three state chips), works register (`01` arm live + `02` drone / `03` AI interviewer / `04` physics
  marked `SHEET IN PREP`), dark mission band with a responsive drone → fix → handoff → arm diagram,
  built/in-build/next columns, a small record table, contact with copy-email, and a title-block footer.
  Collagraphy carried over: paper/ink/rust, hairlines, mono annotations, Instrument Serif italic for
  one phrase per section, ghost word per section, custom corner ticks on plates.
- **Hub plate** rendered from the real CAD: `dev/plate.html` + `dev/make-plate.mjs` (1600×1000,
  arm-viewer.js, pose `[12, 38, 8, 52, 20]`), composed to a 16:10 paper plate (arm at 94% height),
  exported WebP 22 KB + PNG 156 KB.
- **Build:** Vite MPA (`appType: 'mpa'`, two rollup inputs), `base: '/'` for the intended user-site
  root (`BASE=/personal-page/` for a project path). Hub payload stays ~70 KB; the film's three.js
  chunk and GLB remain lazy and only on `/work/arm/`.
- **Reveal fix:** hub entrances use a scroll-position check in the same rAF as nav/ghost state instead
  of IntersectionObserver-only. A fast jump (anchor, key repeat, restored scroll) can move an element
  from below the viewport to above it between frames, and an observer never fires — the element stayed
  at `opacity: 0` for good. The check also makes the page's own QA deterministic.
- **Mobile:** hub is single-column with stacked register rows, horizontal scroll cue, vertical system
  diagram; overflow checked at 390 px (`innerWidth == scrollWidth`).
- **No-JS:** hub and film copy are static HTML; the hub's reveals are enhancement only. (The film still
  assumes JS for its loader, as before.)
- **Verified:** `npm run build` green with both entries; production preview (4178) served hub + film;
  Playwright pass at 1440/1280/390 (plus 1920/1024/900 spot checks) with **zero console errors and zero
  failed requests**; film smoke test still gets `scene-ready` with the GLB loaded; no-JS render shows
  all content. Captures + JSON report: `../review-v10/`.
- **Not done:** deploy/Pages (repo visibility + URL rename still open), Astro migration, sheets 02–04
  (need real assets), OG image/URL, custom domain, About page.

## 2026-10-20 — v7 Sheet 02: Nora (personal AI + desk cat)

Second published sheet, built from the `nora-pet` delivery package (OpenClaw plugin, Node server, the
pixel-cat page, launchd setup, agent-facing install instructions) plus Ethan's answers about what Nora
actually does.

- **Content.** `work/nora/index.html`: hero (Nora, 24/7 on a Mac of her own, OpenClaw as the base
  framework with custom layers), an interactive demo, the four jobs (long-term memory, reminders,
  morning timetable, question-bank practice questions via a specialist question-maker sub-agent), the
  layered build diagram, the eight-state interface table with the pet's own state colours, a four-state
  contact sheet, and a status band. English, builder's-logbook voice, ~380 words.
- **Demo, not screenshots.** The real desk-cat page is copied to `work/nora/demo/` and embedded as a
  160:90 iframe on the sheet. It is static-hosted and **permanently in demo mode**: `DEMO = true`, no
  server, no EventSource. Added an embed mode (chrome hidden, fractional canvas fit so the room and
  bubbles fill the frame) and `?full` for the complete page; `?state=` freezes one state.
- **Scripted demo content.** The demo loop was rewritten around Nora's real jobs — a reminder, then a
  question-bank request handled by the question-maker sub-agent — keeping every original state and idle
  action (groom, yawn, butterfly, box, nap). It remains clearly labelled fake: "fake events, no agent
  connected".
- **Privacy boundary** (per Ethan): no ports, localhost, launchd/plist or repository links are
  published; the zip's real `data/nora.json` (100 recent activity lines, message snippets) is not used.
  The page explicitly says the demo shows nothing from the real agent.
- **Plates.** `nora-16x10` hub plate from a 1600×900 capture of the working state on paper; `nora-states`
  2×2 contact sheet of listening / working / error / offline. Demo capture uses `?state=` so the art is
  deterministic.
- **Hub integration.** Works register now lists 05 sheets / 02 published: arm (01) and Nora (02) as
  full-width sheet rows, with drone / AI interviewer / physics renumbered 03–05 and still `SHEET IN
  PREP`. Hero line and meta description now include the software half; title block reads `00 / 05`.
- **Shared behaviour.** `hub.js` split into `scroll.js` (reveals, nav/ghost state) + `hub.js` (copy
  email). Reveal threshold changed from 92% of the viewport to the viewport edge after the new hub hero
  status strip sat just below the old threshold and stayed hidden on a 1000px-tall window.
- **Verified.** `npm run build` green with all four entries; production preview QA: hub, Nora sheet,
  demo iframe (pet/click interaction increments the pet counter), full demo page, no-JS fallback plate,
  fast PageDown reveals, film scene still `scene-ready`; 1440/390 no horizontal overflow; **zero console
  errors, zero failed requests**. Captures + report: `../review-v11/`.
- **Not done:** deploy, sheets 03–05, About page, OG image/URL, any public repo for the Nora source.

## 2026-10-20 — hub final pass: Nora's plate is the cat alone

Hub-only change; Sheet 02 is untouched.

- **The room screenshot is gone from the hub.** The 02 row's plate is now a transparent canvas with
  only Nora on the sheet (`src/nora-cat.js`), drawn from the same sprites as the desk-cat page.
- **Movement bank.** She picks at random between resting (blinks, ear twitch), looking, grooming,
  yawning, tail flicking, kneading and a short nap. The room-dependent moves from the real bank
  (walking, bowl, window, plant, butterfly) are not used; the plate has no room. Her eyes follow the
  pointer when it is over the plate.
- **Craft/perf:** integer-scaled pixel art, 44 × 34 logical box, faint shadow so she sits on the paper;
  15 fps; pauses via IntersectionObserver off-screen and on tab hide; one static frame under
  `prefers-reduced-motion`. A transparent `nora-cat.png/.webp` still covers the no-JS case and is hidden
  once the canvas initialises.
- **Hub only:** the `nora-16x10` room plate remains in the repo as Sheet 02's demo no-JS fallback; the
  sheet's own layout and copy were not touched.
- **Verified:** build green; hub at 1440/390 with no overflow; canvas animation changes between frames;
  reduced-motion canvas is stable; no-JS shows the still; screenshot QA for every movement (rest, nap,
  knead, groom, yawn, look); no console errors. Captures: `../review-v11/cat-plate-*`, `act-*`.

## 2026-10-20 — Sheet 02 final pass (sign-off)

Sheet 02 is frozen for sign-off; the hub is untouched. Production preview (4178) QA is green; the
captures, QA report and an independent critique are in `../review-v12/`.

- **Privacy.** The copied demo bundle still carried the pet project's dead server branch
  (`EventSource('/api/stream')`, `http://localhost:7766`, the service name) even though demo mode made
  it unreachable. Removed the branch, the reconnect loop and the unreachable "no server" copy;
  `runDemo()` now runs unconditionally. No port, localhost or service strings ship in the demo JS.
- **Attribution.** Ethan's call: footer `Designed by me, built with Nora · no tracking · no cookies`.
  The hero meta gained `Role — Design + build` (the duplicated `Updated` row is gone; the Status
  section keeps the date), and the build copy now says what he made in the first person
  ("OpenClaw is the base framework … I built the layers on top").
- **Facts.** "naps after five minutes" was wrong (the idle clock naps after 3 min) → "a few quiet
  minutes". "its own Mac" → "her own Mac"; the unconfirmed "before I ask for it" timetable line is
  gone; sub-agent row now says "woken by the main agent".
- **Copy.** Prose trimmed to ~280 words by cutting the four-job list repeated in the hero lede, the
  duplicated click/poke instructions, the duplicated 160×90/15fps line, and tightening the status
  band. Cat copy now says sound is off in the embed and only the full demo has it. Meta description
  cut from 179 to 151 chars.
- **Numbering.** Chrome meta `Sheet 02 / 05 · rev 2026.10`, hero eyebrow `Software · personal AI`, job
  items lost their 01–04 numbers (they collided with the section numbers). Headings got a space before
  `<br>` so text extraction no longer reads "andeverything".
- **Contrast.** Shared `--dim` `#6f7377` (4.42:1 at the 9px captions) darkened to `#666a6e` (~5.0:1)
  in `tokens.css` and the film's mirrored block in `style.css` — also fixes the hub's plate captions.
- **Reduced motion / no-JS.** The embedded demo becomes a still plate in both modes: iframe
  `display:none`, `.demo-fallback` block, caption swapped to "still frame · animation off in this
  mode". The 16:10 plate's paper bands are trimmed (`aspect-ratio: 160/90` + `object-fit: cover`) so
  the figure is 1334×751 in every mode — the no-JS/reduced-motion layout is now identical to live.
- **Demo page (`?full`).** It was blank with JS off because `html.embed-demo` sat in the markup and
  only a script could remove it. Inverted: the class is added by the inline head script unless `?full`.
  Static copy no longer advertises a server ("Demo", "Scripted events — no agent connected.", demo
  footer), the brand subtitle is "desk cat · status window", and `?full` gained a `← Sheet 02` back
  link plus a persistent `demo` chip. The embed itself is unchanged (160:90, no chrome, no scrollbars).
- **Small a11y/SEO.** 24 px tap targets on the phone nav and Full-demo link; visible focus ring on the
  demo iframe for pointer *and* keyboard focus (the keyboard path needs `src/nora-sheet.js`, because
  focus lands inside the child document where `:focus` / `:focus-within` never match on the host);
  new-tab link labelled for screen readers; Fig. 01/03 captions and alt fixed ("in reading order",
  "demo states"); Inter Tight 300 preload removed from the hub and the sheet (never used there; the
  film still preloads it).
- **Verified on the production preview.** Build green (four entries); zero console errors / failed
  requests; pet click 0 → 3 and the grumpy bubble after six pokes; no horizontal overflow at
  390/768/1024/1280/1440; no-JS still figure exactly 16:9; reduced-motion static; `?full` renders with
  JS off; nav anchors clear the fixed chrome; captions ≥5:1. Evidence: `../review-v12/`.
- **Not done / open.** No deploy or push (per rule). `og:image` / `og:url` / canonical remain deferred
  to the final URL (HUB-PLAN §8.2/§8.3) — the sheet is signed off *pre-deploy*. A "What's next" block
  needs one honest sentence from Ethan; Q8 (must-say / never-say) is still "add later". The arm page
  also still carries the pre-split absolute `og:url`/`og:image` — site-wide leftover, not touched here.

## 2026-10-20 — one shell for every page (loading curtain + top bar)

The arm and Nora were running two different pieces of page furniture (Nora had no loading screen
at all, and her bar shared nothing with the film's console bar). Ethan's call: the same loading
page for both, and one shell for the top bars — identical grid, height and type, with each page
keeping its own controls on the right.

- **New `src/shell.css`** — the shared fixed furniture, imported first by `style.css` (film) and
  `hub.css` (sheets): the loading curtain (loader markup, type, animation, `body.is-loading` scroll
  lock, no-JS hide) and the top chrome (grid `1fr auto 1fr`, 54 px / 48 px on phones, brand + back
  link on the left, meta centred, a flex right cluster in one mono scale — 10 px / 500 / 0.15 em).
  The duplicated chrome and loader blocks left both stylesheets, so the bar can no longer drift
  page to page.
- **Same loader on Nora.** `work/nora/index.html` now gets the film's curtain (same markup, same
  `SCANNING` label and counter) with a page foot `NORA · PERSONAL AI · DESK CAT`.
  `src/nora-loader.js` gives it a real promise: `document.fonts.ready`, the eight monitor frames
  decoded, and the demo iframe's document loaded — then two rAFs for the hero projection and the
  first cat room. `film-loader.js` is unchanged; the arm and process pages keep their own
  first-frame / transfer-progress behaviour.
- **Same nav shell on Nora.** Brand + `← sheet 00` + meta centre + section links now sit in
  exactly the arm's slot order; the links stay the sheet's own (Assistant / Build / Cat / Status).
  The small `← index` link moved out of the link list into the shared back-link slot. The hub got
  the same `.chrome-left` wrapper, so all four pages render one component.
- **Brand tag unified** to `portfolio` on the arm and process pages (was `rescue robotics`); the
  film's identity already lives in the eyebrow and the centre meta line.
- **One token set at the bar:** `--gutter` is `clamp(22px, 3.6vw, 56px)` in `style.css` too (was
  24 / 3.4vw / 52), and phones use the 48 px chrome + 20 px gutter on every page (`tokens.css`
  gained the same override the film already had). The brand mark/name land on the same x/y
  everywhere; right clusters share a 20 px gap (14 px ≤ 860, 11 px ≤ 560).
- **Mobile fixed.** Nora's 390 px bar used to overlap itself (brand + `← index` + four links). With
  the back link in its own slot, the ≤ 700 px rule hides it and the four links get the room.
- **Verified** — dev (5178) and production preview (4178): zero console errors / failed requests;
  bar geometry identical on all four pages at 1440 (chrome h 54, brand x 51.83, right edge
  1388.17); no bar overlap and no horizontal body overflow at 390 / 480 / 560 / 600 / 700 / 701 /
  720 / 768 / 860 / 861 / 900 / 1024 / 1200 / 1440 (the film's 58–177 px document overflow is its
  own act entrance transforms, clipped by `overflow-x: hidden` — pre-existing, unchanged); Nora
  curtain lifts ~1.6 s warm and ~0.38 s under reduced motion; no-JS hides the curtain and shows the
  still hero; the arm's INDEX overlay still opens/closes (chrome z 60 above panel z 45); Nora's
  nav active state and back link work; build green (five entries).
- **Not done.** No deploy/push (per rule). The hub intentionally has no curtain — it has nothing
  heavy to wait for.

## 2026-10-20 — the hub sets its CTA: "Open sheet" becomes a button

Ethan's call: the text-only `OPEN SHEET ↗` under each published sheet was not obvious enough. He
asked for a button — rust by default, black on hover — which is already the site's CTA language on
the film's process slide (`.process-cta`), so the hub inherits the same component instead of
inventing a second one.

- **Markup** (`index.html`, both published rows): the label and arrow are now their own spans
  (`.sheet-open` / `.sheet-open-arrow`) so the arrow can animate independently of the text.
- **Style** (`src/hub.css`): `.sheet-open` is a filled button — `--accent` (`#b23e22`) ground,
  `--paper` type, 11 px mono uppercase at 0.18 em, 13/18/12 px padding, 2 px radius — matching the
  film's `.process-cta` exactly. Row hover / `:focus-visible` turns it `--ink` (`#101214`); the
  arrow nudges 2 px up-right on the same 0.25 s beat. Hovering anywhere on the row fills it, since
  the whole row is the link; the old gap-widening transition is gone.
- **Verified** — dev (5178) and production preview (4178), `dev/qa-sheet-open.mjs` (12/12 pass,
  evidence in `../review-v16/`): default `rgb(178,62,34)` / paper text, hover `rgb(16,18,20)` / paper
  text; contrast 5.38:1 default, 17.35:1 hover; two CTAs 140.6 × 41.5 px, no horizontal overflow at
  390 / 560 / 700 / 860 / 1024 / 1440; keyboard focus still lands on the row with the rust focus
  ring; zero console errors or failed requests; build green.
- **Not done.** No deploy/push (per rule) — the live GitHub Pages site still shows the old label.

## 2026-10-20 — sheet 01 ends on the scan: the contact act is gone

Ethan's call: the last act of the arm film ("Let's talk." / email / GitHub / arm demo) repeats the
hub's contact section on sheet 00. Removed the act rather than reword it.

- **The film is now five stops**: hero → arm → process → free view → scan. The scan act is the last
  one, so the film closes on *"This half is real. The drone half isn't built yet."* with the X-ray
  read and the `REAL` ghost word; the persistent `← sheet 00` in the chrome is the way back.
- **`work/arm/index.html`** — contact section deleted, the index overlay drops `05 Contact` (now
  01 Payload / 02 Process / 03 Free view / 04 Scan) and the progress list counts 5.
- **`src/main.js`** — the end-of-film `body.at-end` toggle removed: it existed to hide the still
  plate behind the centred contact copy, and with the scan act last it would have hidden the fallback
  on a WebGL-less browser. `CLOSEUP_BY_BOUNDARY` trimmed to the four remaining boundaries.
- **`src/arm-scene.js`** — the `outro` keyframe (the full-reach pose composed for the centred contact
  copy) is gone, since no page can reach that stop now; the scene-test harness lists the four live
  stops. Shared contact CSS (`.act--contact`, `.contact-title`, `.email`, `.links`, `.colophon`)
  stays: the process page's closing "back to the arm" act uses the same rules and is untouched — it
  is navigation back to sheet 01, not a second contact pitch.
- **Verified** — dev (5178) and production preview (4178), `dev/qa-arm-ending.mjs`, 38/38 pass,
  evidence in `../review-v17/`: five acts with the scan last; no contact node or copy; five ticks;
  four index entries, all anchors resolve; end state = progress `05`, ghost `REAL`, scene stop
  `scan`, X-ray on, no `body.at-end`; phone 390, reduced motion, no-JS, and no-WebGL (the still plate
  stays visible on the final act) all clean; process page smoke (6 acts, back act, mailto link) and
  zero console errors / failed requests; `npm run build` green.
- **Not done.** No deploy/push (per rule). The arm page no longer carries the colophon
  (`Built by hand · no tracking · no cookies`) — it went with the contact act.

## 2026-10-20 — sheet 01's hero takes the project name: HAVK

Ethan's call: the film's hero should carry the project, not his full name — the arm's project name
is HAVK. The hero's whole identity changes, so the type was recomposed for a single word rather
than swapped in place.

- **`work/arm/index.html`** — the h1 is now a single-line `HAVK` wordmark
  (`hero-name hero-name--project`) instead of `Ethan` / `Antoine Li`. Title and `og:title` follow the
  other sheets' pattern — `Sheet 01 — HAVK · Ethan Antoine Li` (Sheet 02 is
  `Sheet 02 — Nora · Ethan Antoine Li`). The author meta, the chrome brand (`ethan antoine li`) and
  the rest of the site keep his name: the wordmark is the sheet's identity, the chrome is the site's.
- **`src/style.css`** — `.hero-name--project` sets a display size for the four-letter wordmark,
  `clamp(88px, 10.4vw, 172px)` at -0.06em tracking (the two-line name was 8.6vw / -0.055em); the
  ≤820px `.hero-name` clamp still wins on phones, so HAVK is 52px at 390 like the name was.
- **Verified** — dev (5178) and production preview (4178), `dev/qa-arm-hero.mjs`, 25/25 pass, evidence
  in `../review-v18/`: h1 `HAVK` at 149.76px/1440 with the reveal complete, no "Ethan Antoine Li"
  text left in `main`, title/og:title match, wordmark fits at 1440 / 1024 / 860 / 700 / 560 / 390 with
  no layout overflow once the film's own entrance transforms are neutralised (the raw 1615px document
  width is the pre-existing stage/act transform overflow, clipped by `body { overflow-x: hidden }`),
  the scene still lands on the `hero` stop, the hub hero is unchanged, the process page is unchanged,
  zero console errors / failed requests, build green.
- **Not done.** No deploy/push (per rule). The HAVK live-demo link left with the contact act — the
  hub's contact section still links it as `Live model ↗`.

## 2026-10-20 — the grand plan gets its place: `/plan/`, skeleton only

Ethan's next area is the long-range rescue system: a rescue robot and a locating drone working in
parallel toward one job. He asked for **the place first** — a basic framework consistent with the
rest of the site (same chrome, same colours), with the content to be dictated later. So this is a
structure, not a page draft: shared furniture, working section titles, and every copy/figure slot
explicitly marked "to come". Nothing was invented.

- **New route `/plan/`** — sixth Vite entry (`plan/index.html`). It loads `src/hub.css` (tokens,
  reset, chrome via `shell.css`, section heads, title block, reveal states) plus its own
  `src/plan.css`, exactly the way Sheet 02 layers `sheet.css` over `hub.css`. No loader: nothing
  heavy to wait for.
- **Chrome, same as every page** — brand + `← sheet 00`, centre meta `THE GRAND PLAN · DRAFT`,
  nav `ROBOT / DRONE / PARALLEL`; phone back-link hidden ≤700 px like the sheets. Footer is the
  shared five-cell title block (Project / Area / Rev / State / Status = "structure only — content
  to come") + the colophon.
- **Skeleton** — hero "The grand plan." with a one-line copy slot; `01 / The robot` and
  `02 / The drone`, each a copy slot + a 16:10 `figure — to come` frame (mirrored on 02);
  `03 / In parallel` as a full-width `system figure — to come` frame. Six dashed, opaque
  paper-tint slots with mono "— to come" labels and skeleton rules; the ghost words `PLAN` /
  `ROBOT` / `DRONE` / `ONE` do not read through them.
- **`src/plan.css`** — page-only layout: section rhythm, `.plan-grid` (and its mirrored variant),
  slot/figure frames, responsive collapse. Nothing in it invents content.
- **Small shared fix** — at ≤560 px the -11 px active-nav dot sat flush against the previous label
  (11 px gaps); `shell.css` now puts it at -8 px. That also un-crowds the hub's and Nora's bars.
- **Verified** — `dev/qa-plan-page.mjs`, 36/36, dev (5178) + production preview (4178), evidence in
  `../review-v19/`: chrome geometry identical to the hub (54 px bar, brand x 51.83, same background
  and type), same tokens (paper `#f6f6f4` / ink `#101214` / rust `#b23e22`), four `[data-ghost]`
  sections and three nav anchors all resolving, six dashed labelled slots, headings exactly the
  skeleton, five-cell title block, no layout overflow at 1440 / 1024 / 860 / 700 / 560 / 390 (fixed a
  grid `min-width: auto` overflow caused by the 16:6 frame), reveals / nav active state / ghost
  switching behave, no-JS and reduced-motion render everything, zero console errors / failed
  requests, build green (six entries). Also smoke-checked the hub and Nora after the shell change.
- **Open / not done** — the page is **not linked from the hub** yet (no nav item, no mission link):
  Ethan to say where it hangs. The three section headings and the slot count are a proposal; he
  dictates the copy and can reshape the sections. No deploy/push (per rule).

## 2026-10-20 — fix: the hero reveal was clipping descenders

Ethan caught it on the new hero: the **g** in "The grand" was missing its descender (and the **p** in
"plan." was cut at the bottom). Not a font or glyph problem — the reveal's final state was the bug.

- **Cause** — `.is-ready .hero-name .line` kept `clip-path: inset(-10% -6% -10% -6%)` after the
  reveal. The display type is set at `line-height: 0.86`, so the glyph ink (descenders, and the
  tightest ascenders) hangs outside the line box; -10 % only cleared the line box, not the ink.
  The old hero ("Ethan / Antoine Li") has no descenders, so the hub never showed it.
- **Fix** — `src/hub.css`: the final clip is now `inset(-26% -6% -26% -6%)` (line box + the font's ink
  overflow) with a comment. The reveal animation is untouched; the hub hero is visually unchanged.
- **Verified** — `/plan/` and `/` heroes at 1440 and 390: the g/p descenders render fully (element
  screenshots clipped vs unclipped), the plan page QA stays green (36/36), build green, no console
  errors.

## 2026-10-20 — the grand plan: the intro is written (Ethan's brief)

Ethan dictated the intro for `/plan/` and asked for it before any section copy. It replaces the
hero's "Copy — to come" slot; the three section slots are untouched.

**The copy, as shipped:**

> The grand plan is one full robot that does the rescue job itself. Drones work further out and
> alongside it — looking around, watching for dangers, helping it locate the person. The robot will
> have its own visual detection; the drone is its larger eye, more of the environment from further
> away.

**Content boundaries he gave, honoured:**
- Everything above is his plan, stated as a plan. Nothing claims it is built.
- **Left out on purpose** (he said "don't write this"): the lack of electronics experience / limited
  time, the drone not flying, and "this could technically be saved through AI". If a "current state"
  section ever gets written, those are his call to include — not the hero's.
- No new facts were added: no dates, specs, ranges, autonomy levels or capabilities beyond the two
  sentences-worth he gave (robot does the job; drones look around / watch for danger / help locate
  the person / are the larger eye; the robot has its own visual detection).

- **`plan/index.html`** — `.plan-lede` paragraph in the hero; meta description / `og:description`
  updated to match ("…draft page — intro only, more to come").
- **`src/plan.css`** — `.plan-lede` (54ch measure, hub hero-line type scale, ink-soft); the now
  unused `.slot--line` rule removed.
- **Verified** — `dev/qa-plan-page.mjs`, 37/37, dev + preview: intro text present (no "to come" in
  the hero), 5 slots left (all dashed and labelled), everything else unchanged; 1440 / 390
  screenshots in `../review-v19/`; build green. Hero reveal descenders still intact (the earlier
  clip fix).
- **Not done** — hub entry still not wired. Mission stays (Ethan's call); the natural entry is a
  "The grand plan ↗" link at the end of the hub's Mission section (which already sits after The set),
  optionally plus a `Plan` item in the hub nav. Waiting on his word. No deploy/push.

## 2026-10-20 — the hub's Mission carries the plan, and a button into it

Ethan: change the hub's Mission part so it matches the new plan page, add a button to the page in
the same orange→black button style he likes, and leave `/plan/` white/black.

- **Mission copy** (`index.html`) — the band now tells the plan, not the old handoff. Title
  `Two machines. One job.` (was `One handoff.`); the second paragraph is the same intro copy as
  `/plan/` (one full robot does the rescue job; drones alongside as its larger eye); the ski
  paragraph and the honest state line stay — now `<strong>The two machines do not work together
  yet.</strong>`. The system diagram (drone → position fix → handoff → arm) is kept unchanged: it is
  still the honest decomposition of the intent.
- **The button** — `<a class="mission-cta mono" href="./plan/">The grand plan ↗</a>` under the copy.
  It is the site's one filled-button component, now shared in `src/hub.css` by `.sheet-open` (sheet
  rows) and `.mission-cta` (this band): rust `#b23e22` by default, ink `#101214` on hover, paper
  text, 11px mono uppercase / 0.18em, 2px radius, arrow nudges 2px up-right.
- **Hover on the ink band** — an ink fill would vanish into the Mission background, so the
  `.mission-cta` ink hover keeps a 22% paper hairline (inset 1px). Colour states are still exactly
  rust → ink; the hairline is the only addition, and it can be dropped if Ethan prefers.
- **`/plan/` untouched** — still paper `#f6f6f4` / ink `#101214`; after clicking the button from the
  hub the target page's palette and intro are identical to before.
- **Verified** — dev/5178 + production preview/4178, `dev/qa-hub-plan.mjs` 33/33, evidence in
  `../review-v20/`: title/copy/CTA (href, colours, size, tap target, keyboard), hover (ink + hairline
  + arrow), click-through to `/plan/` (paper/ink intact, intro intact), sheet-row CTAs unchanged,
  no overflow at 1440/1024/860/700/560/390, no-JS visible, zero console errors / failed requests,
  plan-page QA still 37/37, build green.
- **Not done** — hub top nav still has no `Plan` item (the Mission button is the only entry); no
  deploy/push (per rule).

## 2026-10-20 — hub: the drone is not flying (correction)

Ethan's account of the drone (20:10): the goggles receive the video feed, but the quad never flew
under control — test flight 1 broke the antenna, test 2 "just went directly forward". The live hub
claimed `Flying` in five places. Corrected, text only, no layout change:

- hero strip: `FPV drone — flying` → `FPV drone — not flying` (filled ink square → hollow muted square)
- register row 03: state `Flying` → `Not flying`
- mission diagram: `FPV · flying` → `FPV · not flying`; the figure's aria-label now says the video
  link works but it does not fly
- status / Built: `Drone flying as FPV — pilot, goggles, video` → `Drone airframe and FPV video
  link — goggles show the feed`
- status / In build: new line `Drone flight — no stable hover yet`

Verified on dev 5178: read-back of all five strings, element captures at 1440 in
`../review-v20/` (`drone-status-strip/row03/system/status.png`), zero console errors. **Pending
Ethan's word** on the label (`not flying` / `on the bench` / `in build`) and on the In-build line
(if the drone is parked, it moves). No deploy. The dictated parts list and the sheet brief live
outside the repo in `../_intake/drone-sheet-brief.md`.

## 2026-10-20 — Sheet 03: the FPV drone sheet is designed (figures pending)

Ethan: start designing the page, make it look like the other pages — the airframe model and photographs
come later. So the sheet is fully written and laid out, and its two figures are honest dashed slots.

**Route `/work/drone/`** — seventh Vite entry, a case-study sheet in the Sheet 02 family (not a film,
no loader, no 3D yet). Loads `hub.css` + `sheet.css` + the new `src/drone.css`; its only script is
`scroll.js`. **Not linked from the hub yet**: the register row 03 still says `Sheet in prep` until the
figures land.

**Structure** — hero (two-line `FPV / drone`, serif sub, lede + meta table); `01 The build` (Fig. 01
airframe slot, parts table: six parts with no CAD model, the airframe as the only one); `02 The system`
(Fig. 02, five-stage chain: video link works → flight not solved → recognition / position fix / hand
off not built); `03 The tests` (flight log — antenna broke; straight forward) + Fig. 03 photo slot;
`04 What I'd do differently` (design the system; five-step order, frame last); `05 Status` (`Not
flying`). Ghost words `LIFT / BUILD / CHAIN / TEST / DESIGN / NOW`; nav Build / System / Tests / Status.

**Copy rules honoured** — only what he dictated: the goggles receive the video feed; test 1 broke the
antenna; test 2 went directly forward; ~3-inch props, 4S 75C battery, flight controller / video
transmitter / camera / four motors / an unidentified ESP board; nothing but the frame has a model. No
model numbers yet (he offered them), no claim about *why* it failed, no claim that the vision layer
exists. The two figures are dashed "to come" frames in the same language as `/plan/`, so the page says
what is missing instead of faking it.

**Verified** — `dev/qa-drone.mjs`, **54/54** on dev (5178) and on production preview (4178): chrome
geometry identical to the hub (54 px bar, brand x 51.83), same tokens (paper `#f6f6f4` / ink `#101214`
/ rust `#b23e22`), one h1, nav anchors resolve and mark the active section, ghost words follow the
sections, no horizontal overflow at 1440 / 1024 / 860 / 700 / 560 / 390, all reveals fire, no-JS
renders every section, reduced motion static, zero console errors / failed requests; build green with
seven entries (sheet CSS 6.7 kB raw). Evidence in `../review-v21/` (`qa-drone.json`, hero + section
captures at 1440 and 390).

## 2026-10-20 — process hero: the slow ring becomes an indexing turret

Ethan: the parts turning in a circle were "more or less" right but did not hit — not visual enough, not
fascinating enough. The old ring drifted at 0.09 rad/s (a turn every 70 s) and its tilt (roll 0.7) read
as a loose diagonal pile; nothing showed it was a ring, and nothing ever happened.

**The turret** (`src/process-stage.js`, ring state only — step 01 / 02 framings untouched)
- **A drawn orbit.** The ring is now visible as a drawing in 3D: an ink rail (tube), a 120-tick degree
  dial outside it, chain-line centre lines and a dashed pitch circle, a signal-red index mark at the
  front station. Paper-coloured fog hazes the far side so the depth reads.
- **Indexing, not drifting.** A spring (ζ ≈ 0.63) chases a target eased one station (60°) at a time:
  each part is presented for ~2 s, then the turret steps with a small mechanical overshoot and settle.
  Parts lean outward on fast moves, lag a touch in yaw, and trail ink speed lines along the rail; a
  ripple spreads across the platter when a part locks onto the station.
- **Presentation.** The part at the front grows ×1.5, lifts, and turns to a better face. Order is the
  build order: A1 mini → J1 → J2 → J3 → J4 → J5.
- **Spin-up.** When the curtain lifts the rail draws itself, the ticks sweep in, and the parts unfurl
  out of the hub while the turret winds down from 1¼ turns into the first station (2.5 s).
- **By hand.** Mouse: drag anywhere on the ring to spin it (it coasts, then picks a station); click a
  part to bring it round the short way; the cursor reads `DRAG` over a part. Touch: tap a part. A page
  scroll on the hero flicks it on a station before the existing spin-out hands the printer to step 01.
- Composition retuned: smaller ring (radius 0.19 vw), centred in the free right half, clear of the
  bottom copy; FOV 38 on the ring only (eases back to 30 for the printer / motors framings).

**Balloons** (`src/process-hud.js`, new) — a 2D canvas over the stage draws drawing-sheet callouts:
each part has a numbered balloon (01–06) on a parallel leader line, fading with depth; the presented
part's balloon fills signal-red and a name tag types itself in (`A1 mini · Bambu Lab · the printer`,
`J1 · base · UMIR57 stepper`, … `J5 · UMIR42 stepper` — the same facts as the step copy). The tag
sits on a paper plate and flips left when it would leave the sheet (phones).

**Reduced motion** — no spin-up, no indexing, no trails: a still, composed dial with the printer
presented and its tag shown.

**Verified** on dev (5178), headless Chromium / SwiftShader, stepped with the stage's QA `advance()`:
spin-up, index, mid-move trails and settled frames at 1440×900 and 390×844; hero → step 01 (spin-out,
printer leaves) → step 02 (motors) → back to the hero; click-to-present (J4 via the short way), drag
fling → coast → snap, scroll nudge → next station; reduced motion; zero console errors; build green.
