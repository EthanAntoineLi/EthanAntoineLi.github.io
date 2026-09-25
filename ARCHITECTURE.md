# ARCHITECTURE.md — personal-page module contract

Scroll-driven 3D portfolio. Stack: Vite + Three.js (vanilla). Local preview only.

## File layout
```
personal-page/
  index.html            # WS-C (UI child)
  src/main.js           # LEAD (Lior) — integration only
  src/style.css         # WS-C (UI child)
  src/scene.js          # WS-A/B (3D child)
  src/choreography.js   # WS-A/B (3D child)
  models/robot.glb      # robot (has rescue backpack + antenna)
  models/person.glb     # human (ski helmet, winter gear)
  models/drone.glb      # quadcopter drone
```

## Ownership
- **WS-A/B (3D child)** writes `src/scene.js` + `src/choreography.js` ONLY.
- **WS-C (UI child)** writes `index.html` + `src/style.css` ONLY.
- **LEAD (Lior)** writes `src/main.js` (integration) and this file. No other file ownership.
- No one touches `models/`, `package.json`, `vite.config.js`, `BUILD-LOG.md`.

## Contracts (exact signatures)

### src/scene.js (WS-A/B)
```js
export async function createScene(canvas) {
  // returns { scene, camera, renderer, refs, idle }
}
```
- `refs = { robot, person, drone }` — normalized, posed Object3D groups, already added to scene.
- `idle(dt)` — per-frame animation (drone hover bob + slow rotation).
- Clay material: `MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.95, metalness: 0 })` applied to every mesh.
- Lighting: HemisphereLight + key DirectionalLight + rim DirectionalLight + AmbientLight (monochrome, soft studio).
- Terrain: tilted `PlaneGeometry` slope + 3–4 low mounds (scaled spheres), all clay material.
- Normalize: scale so LARGEST dimension = 1.9 (robot, person) / 1.6 (drone); center X/Z; feet at y=0.
- Poses: person lying (rotation.z ≈ Math.PI/2), robot leaning/kneeling toward person, drone hovering (y ≈ 3.2).
- Camera: `PerspectiveCamera(45)`, `scene.background = 0x000000`, ACESFilmicToneMapping.
- Models load from `/models/robot.glb`, `/models/person.glb`, `/models/drone.glb`.

### src/choreography.js (WS-A/B)
```js
export function createChoreography({ camera, refs }) {
  // installs scroll listener; returns nothing
}
```
- KEYFRAMES (4): wide `[0,2.2,8.5]→[0,0.8,0]` · arm-push `[1.5,1.5,2.6]→[1.2,1.0,0.1]` · arm-close `[1.1,1.2,1.4]→[1.1,1.05,-0.1]` · drone `[0.4,3.6,2.2]→[0.2,3.0,-0.8]`.
- Map `#story` scroll → progress 0..1, smoothstep-lerp camera pos + lookAt.
- CAPTIONS: `#cap1` active 0.32–0.55 · `#cap2` active 0.68–0.92 (fade opacity).
- `#dim` overlay opacity: 0.72 at top → 0 mid-story (0.05–0.9) → back at tail.

### index.html + style.css (WS-C)
Required IDs (used by JS): `scene`, `dim`, `scroll`, `hero`, `cta`, `story`, `cap1`, `cap2`, `tail`, `loading`.
Structure + locked copy are in the workstream brief.

## Integration (LEAD, src/main.js)
```js
import { createScene } from './scene.js'
import { createChoreography } from './choreography.js'
import './style.css'
// canvas = #scene
// const { scene, camera, renderer, refs, idle } = await createScene(canvas)
// createChoreography({ camera, refs })
// render loop: idle(dt); renderer.render(scene, camera)
// resize handler; #cta click → #story.scrollIntoView({behavior:'smooth'}); hide #loading
```
