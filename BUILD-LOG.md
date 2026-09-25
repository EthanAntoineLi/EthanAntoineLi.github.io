# Build Log — Ethan's Personal Page (Scroll Story)

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
