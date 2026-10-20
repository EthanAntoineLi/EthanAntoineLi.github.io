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
