# `/plan/` — figure prompts for an image generator

Three concept plates for the three dashed frames on the grand-plan page:

| Slot | Frame | Subject | File to land |
| --- | --- | --- | --- |
| `01 / The robot` | 5:6 portrait | the whole rescue robot — humanoid body, EPQ arm language | `public/img/plates/plan-robot-5x6.webp` |
| `02 / The drone` | 5:6 portrait | the 3-inch FPV quad as the search drone | `public/img/plates/plan-drone-5x6.webp` |
| `03 / In parallel` | 16:6 | both machines, one rescue job, same moment | `public/img/plates/plan-parallel-16x6.webp` |

These are **concept renders of the plan, not records of built hardware**. The captions on the page
must say so (`Concept — not built`). The arm is the one real object: keep its geometry and finish
close to `public/img/plates/arm-16x10.png` (charcoal printed links, silver stepper cans, worm-gear
shoulder, planetary base). The humanoid body, the sensor head and the drone's search pod are design
proposals — that is exactly what the page is for.

**Accepted 2026-10-21:** these three plates were generated from this file and are now on `/plan/`
(see `plan/index.html` and `src/plan.css`). The page uses 5:6 portrait frames for the two renders
instead of the original 16:10 placeholders.

**Direction change (Ethan, 2026-10-21):** the first tracked-vehicle render was rejected — *"01 不想要
这种车子"*. The robot is **humanoid**; the arm's look stays (black printed links, silver stepper
motors, five axes). Do not put the arm on a tracked or wheeled chassis again.

---

## 0. Shared style core (append to every prompt)

```text
Quiet engineering-portfolio concept plate. Seamless warm off-white studio background (#f6f6f4),
soft large-source key light from the upper left, gentle fill from the right, one long soft contact
shadow, no horizon line, no set dressing. Palette restricted to matte charcoal, bare aluminium,
paper white and one signal-rust (#b23e22) accent. Honest prototype finish: visible hex bolts, faint
3D-print layer lines, braided cable sleeving, zip ties, small scuffs; not glossy sci-fi, not toy
plastic. Industrial-design render, 50 mm lens, three-quarter view slightly above eye level,
tack-sharp, natural colour, unlabelled, no text, no logos, no watermark, no people. Subject fills
about 70% of the frame height with clean empty margin on every side.
```

The palette values are the site's real tokens: paper `#f6f6f4`, ink `#101214`, rust `#b23e22`.
Keeping the background slightly warm means the plate sits on the page without a visible box.

For the two scene prompts (robot in context, parallel), keep the light, palette and finish rules but
drop the seamless studio background and the "subject fills 70% of frame height" line — those two
lines exist for the clean plates only.

---

## 1. The robot — `Fig. 01`, 5:6 portrait

**What the image has to say:** one complete humanoid rescue machine, built by one person, with the
EPQ arm's design language running through both arms. Not a vehicle, not a soldier, not a glossy
sci-fi android.

**Design decisions baked into the prompt**

- **Humanoid, ~1.65 m**, wide stable stance, knees slightly bent, flat foot pads with small steel
  crampons — it has to stand on snow and scree.
- **Two five-axis arms** built from the same modules as the EPQ arm: base yaw, shoulder pitch,
  upper-arm roll, elbow pitch, wrist roll; self-locking worm shoulder, planetary base; charcoal
  printed links, silver stepper cans.
- **Right arm = two-finger gripper; left arm = compact tool mount** — one hand for the person, one
  for a tool. No weapon.
- **No face**: a smooth head shell with a single horizontal sensor bar, two small warm work lights,
  a thin telemetry antenna.
- **Backpack** for battery and computer, with a folded rescue line clipped to it; one rust-orange
  lifting eye on the upper back.
- **Prototype cues**: printed panel seams, layer lines, exposed motors, braided cable, hex bolts,
  scuffed paint.
- **Charcoal + aluminium + one rust accent**; no livery, no branding, no armour plating.

```text
Concept render of a humanoid mountain-rescue robot — the planned whole machine built around a
student's five-axis arm modules. About 1.65 m tall, standing in a wide stable stance, knees slightly
bent, flat foot pads with small steel crampons. Slender but sturdy body in matte charcoal 3D-printed
shell panels with faint layer lines and visible panel seams; exposed silver stepper motors at the
shoulders, elbows, hips and knees; black cable looms in braided sleeving; visible hex bolts; one
rust-orange lifting eye on the upper back. No face: a smooth head shell with a single horizontal dark
sensor bar, two small warm work lights at the temples, a thin telemetry antenna. Both arms are built
from the same five-axis modules as the EPQ arm — planetary-reduction base yaw, self-locking worm-gear
shoulder, four dark printed links, silver stepper cans with black end caps — the right arm ending in a
two-finger gripper, the left in a compact tool mount. A slim backpack carries the battery and
computer, with a folded rescue line clipped to it. One arm half raised, head turned slightly toward
the camera, as if about to step forward. Honest student prototype build, not a soldier, not a glossy
sci-fi android. [append style core]
```

**Variant — in context** (for an `og:` image or a later full-bleed band; not the page slot)

```text
Same humanoid, same design language, on a wind-scoured snow slope at flat grey dawn: one knee down,
one hand braced on the crust, the other arm reaching toward a single rust-orange marker flag. Low-
contrast overcast light, fine snow grains in the air, a lot of empty snow around it. Documentary,
not heroic: no sunrise, no lens flare, no orange-and-teal grade, no people [append style core, but
replace the studio background with the slope].
```

**Working with a reference:** in Gemini / Nano Banana, attach `public/img/plates/arm-16x10.png` and
say *"use these joint modules, this finish and these proportions for both arms of a humanoid; do not
copy any tracked base from a previous attempt."* In Midjourney, use the same file as an image prompt
at `--iw 1.5`.

The real arm is still a 500 g bench prototype. The humanoid is the plan; the page caption has to say
so, and nothing in the copy may imply this machine exists.

**Reject the image if:** there are tracks, wheels or any vehicle chassis, armour plates, a helmet, a
weapon, glowing red eyes, a human face or skin, more than two arms, glossy white plastic, or a
full-size industrial scale. Also reject it if the humanoid reads as a soldier or a toy.

---

## 2. The drone — `Fig. 02`, 5:6 portrait

**What the image has to say:** a home-built 3-inch FPV quad that has been given a job — the camera
that can fly, now carrying a downward search sensor. Not a sleek consumer drone, not a military
quad.

**Design decisions baked into the prompt**

- **3-inch class**, roughly 15 cm motor-to-motor; compact, exposed, repairable.
- **Four motors, four props** — the most common failure in generated quad images. Say it twice.
- **Real FPV anatomy**: carbon X frame, FC + 4-in-1 ESC stack, VTX and whip antenna, camera uptilt,
  4S pack strapped on top, XT60, receiver antenna, zip ties, solder joints.
- **Search pod bolted underneath** — a matte-black housing with a glass lens. It is the plan's
  addition and should look added, not moulded in. This is what turns the FPV quad into the
  "larger eye".
- **Slight wear** — scuffed prop tips, worn carbon edges, no stickers.

```text
Concept render of the search drone — a small 3-inch FPV quadcopter hovering at chest height.
Compact carbon-fibre X frame with exactly four exposed outrunner motors, one at each corner, and
3-inch tri-blade propellers turning into soft circular blur; a stack of flight controller and 4-in-1
ESC, a video transmitter with a whip antenna, an FPV camera at 30 degrees of uptilt, a 4S LiPo pack
strapped on top with a rust-orange strap, XT60 plug, receiver antenna, zip ties, visible solder
joints and slightly scuffed prop tips. Bolted under the frame, a small matte-black downward sensor
pod with a glass lens — the planned search payload, clearly added on rather than moulded in. Slight
nose-down hover attitude, three-quarter front view, the four rotors fully readable. [append style
core]
```

**Variant — in context:** same quad high over a grey snow slope, tiny in a wide empty frame, one
faint search cone falling to the ground; no pilot, no goggles, no dramatic sky.

**Reject the image if:** there are five rotors, ducted fans, a DJI-style folding body, a gimbal ball,
a military payload, or the sensor pod looks integrated like a factory product. The point is a
student's airframe with a purpose bolted on.

---

## 3. In parallel — `Fig. 03`, 16:6

This section is **not a workflow diagram**. It is one job, seen at one moment, with two machines
doing different parts of it at the same time: the drone is the eye further out, the robot is the
hand on the ground. Keep both in the same frame and the same light.

**Recommended method (hybrid):** generate the scene as a clean wide plate *without* diagram lines,
then draw the dashed links, search cones and labels in SVG/CSS on the page. Image models produce
crooked lines and gibberish text; the page's drafting language is already hairline-thin and exact.
That also keeps the figure sharp at 2400 × 900.

**Order matters:** finish and accept the humanoid in Fig. 01 first, then feed *that* image as the
reference for this scene. Do **not** use the rejected tracked-vehicle render as a reference — the
model will copy the tracks straight back in, which is exactly what happened on the first attempt at
this figure.

```text
Wide editorial concept plate of one mountain-rescue job in progress: two machines working in
parallel. Side elevation of a snow-covered slope in flat paper-white and pale-grey planes, thin
hairline contour lines, no dramatic sky. In the lower left third stands a bipedal humanoid rescue
robot on two articulated legs — the same roughly 1.65 m humanoid as Fig. 01, matte charcoal printed
shell panels, silver stepper motors at the joints, one five-axis arm reaching down the slope toward a
single rust-orange marker flag. It is standing on the slope on its own two feet, not riding a vehicle.
In the upper right third, higher and further out, a small 3-inch FPV quadcopter holds position, its
four rotors readable, no larger than the marker flag in the frame, one faint pale search beam falling
from it to the same patch of slope. The two machines are clearly doing different parts of the same job
at the same moment. Restrained drafting language: hairline strokes, flat muted colour, subtle paper
grain, generous empty paper at the top and bottom, unlabelled, no callout boxes, no legend, no arrows
with words. Ultra-wide 8:3 composition; reads at thumbnail size. [append style core, but replace the
studio background with the slope]
```

**Reject this figure if:** the robot has tracks, wheels or any vehicle chassis; the drone is
oversized or reads as a toy; the two machines are not doing different parts of the same job; or the
scene looks like a poster rather than a quiet technical plate.

**Fallback — one-image diagram** (only if the page is going to use it as a single `<img>` with no
overlay; expect to retouch the lines):

> Same prompt, plus: *"thin dashed rust telemetry lines connect the drone to the robot and the robot
> to the flag; a faint translucent search cone drops from the drone; hairline technical-diagram
> language, no text."*

**Composition for the page:** the slot is 16:6 on desktop and collapses to a taller, narrower frame
on phones, where `object-fit: cover` will trim the sides hard. Keep both machines and the flag inside
the central ~60% of the width, and keep the top and bottom 15% free of important detail so the
mobile crop still works.

**Do not put text in the image.** Labels like `drone · eye`, `robot · hand`, `one job` belong in
HTML/SVG where they can use Inter Tight / mono and stay sharp.

---

## 4. Negative prompt (all three)

```text
text, letters, numbers, labels, captions, callouts, legend, logo, brand name, watermark, signature,
UI, HUD, frame, border, collage, contact sheet, multiple views, extra arms, extra joints, impossible
linkage, floating parts, disconnected cables, five rotors, three rotors, ducted fans, tracks, wheels,
vehicle chassis, tank, armour plates, helmet, weapon, glowing red eyes, human face, human skin,
glossy plastic, chrome, neon, cyberpunk, orange-and-teal grade, dramatic sunset, god rays, lens flare,
shallow depth of field, bokeh, motion blur on the body, people, hands, faces, crowd, cartoon, toy,
oversaturated, low resolution, jpeg artifacts
```

Use the same negative list for the parallel plate except keep `people` out of it only if you
deliberately want a tiny distant figure; the safer choice is the rust flag as the subject marker.

---

## 5. Settings per tool

| Tool | Robot / drone (5:6) | Parallel (16:6) | Notes |
| --- | --- | --- | --- |
| **Midjourney v7** | `--ar 5:6 --style raw --v 7 --s 100` | `--ar 8:3 --style raw --v 7 --s 100` | `--no text,labels,logo,watermark,people`; reuse the accepted robot plate with `--sref` for the drone and parallel so light and palette match. |
| **Gemini 2.5 Flash Image** ("Nano Banana") | attach `public/img/plates/arm-16x10.png`, ask to keep the arm and change the body/scene | attach the accepted robot plate and ask for the wide scene | Best at *editing* an existing render; good for "same finish, new body". Ask explicitly for "no text anywhere". |
| **GPT-Image-1** | 1024 × 1536, then crop to 5:6 | 1536 × 1024 and outpaint to 8:3, or generate 3:1 and crop | Reliable at "no text" when it is in the prompt; less reliable on exact joint counts. |
| **Flux.1 / SDXL** | 1600 × 1000 | 2400 × 900 | CFG 3.5–4.5; Flux handles the long prompt well, SDXL may need the style core trimmed to the first two sentences. |

If the tool has a style-reference or seed feature: **generate the robot first**, accept it, then feed
it as the style reference for the drone and the parallel plate. That is what keeps the three plates
looking like one set rather than three stock images.

---

## 6. When the images land

The 2026-10-21 plates are already in place. If any of them is regenerated, use the same targets:

1. Keep the portrait renders **1145 × 1374** (5:6) and the parallel scene **2048 × 768** (8:3); do
   not letterbox a portrait into a wide box.
2. Export **WebP q88**; the current files are 126 KB / 114 KB / 138 KB.
3. Names: `plan-robot-5x6.webp`, `plan-drone-5x6.webp`, `plan-parallel-16x6.webp` in
   `public/img/plates/`.
4. `plan/index.html` uses `<figure class="plan-plate">` with a 5:6 media frame; the parallel figure
   adds `plan-plate--wide` (16:6). Captions read `Fig. 01 — concept` / `Not built`.
5. Captions must carry the status: **"Concept — the plan, not the build."** The page's honesty rule
   applies to images exactly as it does to copy.
6. Current alt text: robot "Concept render of the planned humanoid rescue robot: charcoal printed
   shells, silver stepper motors, a five-axis arm and a sensor head."; drone "Concept render of the
   planned search drone: a three-inch FPV quad with a downward sensor pod, battery and whip antenna.";
   parallel "Concept scene of one rescue job: a humanoid robot reaching down a snow slope toward a
   marker flag while an FPV drone searches from above."

The figures are no longer "to come" — only the section copy is. The dashed copy slots stay until
Ethan dictates it.
