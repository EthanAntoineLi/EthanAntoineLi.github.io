# SPEC — Ethan's Personal Page

**What I want.** This is my complete spec for the personal-page project. Hand this to any designer, developer, or (future) me to rebuild, extend, or finish the site. It is written in my voice as instructions.

---

## 1. Purpose & audience

This page is my **engineering portfolio**. It exists for two overlapping audiences:

1. **Universities** — I'm an A-level student applying to **Oxford Engineering Science / Mechanical Engineering**. The page is a portfolio artifact that shows I build real hardware, not just talk about it.
2. **Peers & future employers** — anyone who wants to see what I'm building and why.

The page has to do three jobs:

- **Show the mission** — the "why" behind everything: mountain-rescue robotics.
- **Show the builds** — my two real prototypes, honestly framed as prototypes (no invented achievements).
- **Give a way to reach me** — GitHub + email.

Tone: builder's logbook. Mission-driven, honest about the prototype stage, **zero hype**. If something isn't built yet, the page says so.

---

## 2. Page structure (section by section)

The page is a **single page** that tells a story as you scroll. It is NOT a flat list of sections. The scroll drives a 3D camera through a scene.

Order of beats:

1. **Hero (first viewport)** — my name, one mission line, one button, and a dot-matrix stats strip.
2. **The scene (scroll story)** — a single Three.js 3D scene. Scrolling moves the camera through four keyframes: wide scene → the arm → close on the arm → the drone.
3. **Tail (after the story)** — three compact blocks: Toolbox, In progress, Contact — plus a footer.

Details per section are in **§3 Content notes** below.

---

## 3. Content notes per section (FACTS ONLY)

Keep everything factual. Do **not** invent achievements, stats, dates, or skills I never stated. Where the page is a placeholder, label it as such.

### 3.1 Hero

- **Name:** Ethan Antoine Li.
- **Mission line (the hook):** *"Why send more people into the same dangerous ground to save someone — why not robots?"*
- **One button:** "See the system" → scrolls into the story.
- **Dot-matrix stats strip:** `2 PROTOTYPES · 5 DOF · 1 RESCUE MISSION · ∞ QUESTIONS` — honest mini-metrics, no fake "trusted by" numbers.

### 3.2 The scene (scroll story)

The story is the two builds framed as one rescue system:

- **Beat 1 — wide:** an injured person lying on a clay slope, the robot kneeling beside them, the drone hovering overhead. (Ski-rescue framing — scattered skis/poles.)
- **Beat 2 — the arm:** camera pushes in on the robot's mechanical arm. Caption: **"01 / The arm — This is what I designed — a 5-DOF robotic arm."**
- **Beat 3 — the drone:** camera pulls out to the drone, which fills about half the frame, person + robot small in the depth below. Caption: **"02 / The drone — Visual recognition + spatial recognition, feeding the robot."**

### 3.3 The arm (5-DOF robotic arm)

- **What it is:** my rescue robot's first piece — a **5-DOF robotic arm**.
- **How it's built:** designed in **Shapr3D**, 3D-printed on a **Bambu Lab H2S**.
- **Status:** **prototype, in progress** — it is my EPQ.
- **Source of truth:** my EPQ document (the arm case-study facts come from there; nothing beyond it).

> **Note to self — CONFIRM DOF count.** The page copy uses **5-DOF**; my EPQ framing has been written as **6-DOF**. Pick one number and use it consistently across hero, captions, and this spec. (The arm grows in degrees of freedom as the design matures — I'll confirm the final number when the EPQ is finalised.)

### 3.4 The drone (FPV drone)

- **What it is:** an **FPV drone** — the future *eyes* of the system.
- **Role in the mission:** locate the injured person and give visual feedback to the robot.
- **Status:** **prototype** — currently flown as FPV. The vision system (visual + spatial recognition) is **not built yet** and is the next step. Say this openly; do not imply the vision works.

### 3.5 The mission (why)

- I'm a skier. Every year I see mountain injuries, and the same question keeps coming back: **why send more people into dangerous ground to rescue someone, when robots could do it?**
- The vision is one system: **a drone finds the person and watches over them; a robot does the rescue.** Early prototypes today — that's the direction.

### 3.6 Toolbox

Only what I actually use — nothing invented:

- **3D printing:** Bambu Lab H2S
- **3D modelling:** Shapr3D

### 3.7 In progress / next

- **Arm:** my EPQ, ongoing.
- **Drone:** vision module next.
- (ESAT exam: Oct 12 — only mention publicly if I decide to.)

### 3.8 Contact

- **GitHub:** [EthanAntoineLi](https://github.com/EthanAntoineLi)
- **Email:** ethan.li.1@outlook.com

> **Note:** the page previously showed email only (my GitHub was empty). Now that the repo is public, the contact section should include the GitHub link too.

---

## 4. Design language

Two interlocking ideas:

### 4.1 Scroll-story (scrollytelling)

One cinematic scroll through a 3D scene — SpaceX / Tesla / Apple-style camera moves, not a flat page. The **scene itself is the hero background** (no video file needed): the 3D world drifts behind the text.

### 4.2 3D scene + choreography

From `ARCHITECTURE.md` (the module contract — this is authoritative):

- **Stack:** Vite + Three.js (vanilla, no framework, no GSAP — plain scroll listener).
- **Clay look:** every mesh shares a `MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.95, metalness: 0 })`. Monochrome, near-white, matte — a "Blender preview stage" aesthetic. **This is a placeholder look**, not the final art direction.
- **Color-reveal plan (locked):** clay = concept/vision; **color = my real designs**. The person, robot, and terrain stay clay. My real arm and drone models drop in (via `models/`) in their true colors later.
- **Lighting:** soft monochrome studio — HemisphereLight + key DirectionalLight + rim DirectionalLight + AmbientLight.
- **Terrain:** tilted plane slope + 3–4 low mounds (scaled spheres), all clay.
- **Normalization:** scale so the **largest dimension** = 1.9 (robot, person) / 1.6 (drone); center X/Z; feet at y=0.
- **Poses:** person lying (rotation.z ≈ π/2), robot leaning/kneeling toward the person, drone hovering (y ≈ 3.2).
- **Camera choreography (4 keyframes):**
  1. wide `[0,2.2,8.5] → [0,0.8,0]`
  2. arm-push `[1.5,1.5,2.6] → [1.2,1.0,0.1]`
  3. arm-close `[1.1,1.2,1.4] → [1.1,1.05,-0.1]`
  4. drone `[0.4,3.6,2.2] → [0.2,3.0,-0.8]`
  - (Round-6 refinement locked the drone keyframe to pos `(0.6,5.6,-1.0)` targeting the drone `(0.2,3.5,-0.8)` so the pair stays in the lower frame.)
  - `#story` scroll → progress 0..1, smoothstep-lerp camera position + lookAt.
- **Captions:** `#cap1` active 0.32–0.55, `#cap2` active 0.68–0.92 (fade opacity).
- **Dim overlay:** `#dim` opacity 0.72 at top → 0 mid-story (0.05–0.9) → back at the tail.
- **Typography:** mix of **Playfair Display** (serif, editorial headline) + **DotGothic16** (dot-matrix retro for kickers/strip/footer). Both open-source Google Fonts.
- **Palette:** pure black background, near-white clay world, gray accents. Dark mode, responsive `clamp()` type, `prefers-reduced-motion` respected.

---

## 5. Tech stack

- **Vite** (build/dev tooling) — `npm run dev`, `npm run build`, `npm run preview`.
- **Three.js** (^0.170.0) — the 3D scene + camera choreography.
- **Vanilla JS ES modules** — no framework, no UI library.
- **No backend, no database, no tracking.**
- Fonts loaded from Google Fonts (Playfair Display + DotGothic16).

---

## 6. File map

```
personal-page/
  SPEC.md               # this spec (what I want)
  README.md             # how to run + what this is
  ARCHITECTURE.md       # module contracts (scene/choreography/UI/integration)
  BUILD-LOG.md          # build history, decisions, review rounds
  index.html            # page markup: hero + story + tail (all required IDs)
  package.json          # deps: three, vite
  package-lock.json
  vite.config.js        # base './', dev port 5173
  .gitignore            # node_modules/, *.log
  src/
    main.js             # integration: bootstrap, render loop, resize, CTA, loading
    scene.js            # createScene(canvas) → {scene, camera, renderer, refs, idle}
    choreography.js     # createChoreography({camera, refs}) → scroll camera + captions + dim
    style.css           # all styling (monochrome, serif + dot fonts)
  models/
    robot.glb           # robot (rescue backpack + antenna)
    person.glb          # human (ski helmet, winter gear)
    drone.glb           # quadcopter drone (PLACEHOLDER until my real drone arrives)
  dist/                 # production build output (vite build)
```

**Module ownership (from ARCHITECTURE.md):** `scene.js` + `choreography.js` are the "3D child"; `index.html` + `style.css` are the "UI child"; `main.js` is the lead's integration; `models/`, `package.json`, `vite.config.js`, `BUILD-LOG.md` are untouchable by feature work.

---

## 7. Future plans (what's still to finish)

From `BUILD-LOG.md`, in priority order:

1. **Real models.** Replace the placeholder GLBs with my real arm + drone files (drop-in via `models/`). This also fixes the one residual visual issue — the drone doesn't read crisply as a quadcopter because the placeholder model is monochrome white-on-white. The real colored drone model resolves it; no amount of camera framing will.
2. **Decimate the models for web.** Current Meshy GLBs are 658k–883k tris / 20–29 MB each — far too heavy. Decimate to well under ~100k tris/model and add real materials in Blender before shipping.
3. **Rigging.** The person/robot poses are rough transforms, not rigged. Real rigging (and the arm/drone models) come later.
4. **GitHub Pages deployment.** Target URL: `EthanAntoineLi.github.io` (or `EthanAntoineLi.github.io/personal-page`). Deploy the `dist/` build. Not yet done — deploy only with my explicit OK.
5. **Contact section** — add the GitHub link (now that the repo is public).
6. **Confirm the DOF number** (5 vs 6) and use it consistently.
7. **Content pass.** Arm case-study detail from my EPQ document once finalised.

---

## 8. Done vs. not done (honest status)

**Done (v1 build):** full scroll-story page — hero, 4-keyframe 3D scene, captions, dim overlay, toolbox/in-progress/contact tail. Beats 1 (wide) and 2 (arm) PASS visual review; beat 3 (drone) composition PASS with a placeholder-model readability residual (deferred to the real drone model).

**Not done:** real models, web decimation, rigging, GitHub Pages deploy, GitHub link in contact, DOF-number confirmation, final content pass.

---

*This spec is the source of truth for "what Ethan wants." When it and the code disagree, update the code to match — or fix this spec and note the change in BUILD-LOG.md.*
