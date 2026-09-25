// ============================================================
// scene.js — Three.js scene construction for the scroll-driven portfolio.
// Owned by WS-A/B (3D child). Contract: ARCHITECTURE.md.
//
// Exports a single async factory:
//   const { scene, camera, renderer, refs, idle } = await createScene(canvas)
//   - refs = { robot, person, drone }  (normalized, posed Object3D groups,
//     already added to the scene)
//   - idle(dt)  per-frame animation. `dt` is in SECONDS (elapsed time since
//     the previous frame). Caller (main.js) owns the render loop and passes
//     dt; this file does NOT start its own requestAnimationFrame.
// ============================================================
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Shared monochrome clay material — applied to every MESH on the figures
// (robot/person/drone + gear). Near-white, fully rough (matte), zero
// metalness: reads as untextured white sculpting clay under soft studio light.
const clayMaterial = new THREE.MeshStandardMaterial({
  color: 0xf2f2f2,
  roughness: 1.0,
  metalness: 0.0,
})

// Terrain material — a step darker than the figures so ground/rolling hills
// separate from the near-white forms instead of merging into whiteout.
const terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0xd0d0d0,
  roughness: 1.0,
  metalness: 0.0,
})

// Model size targets (LARGEST dimension after normalize, in meters).
const MODEL_SCALE = {
  robot: 1.9, // humanoid rescue robot ~1.9 m tall
  person: 1.9, // human in ski gear ~1.9 m tall
  drone: 1.4, // quadcopter, enlarged so its rotor arms read clearly
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadModel(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject)
  })
}

// Replace every mesh material with the shared clay material.
function applyClay(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.material = clayMaterial
      node.castShadow = false
      node.receiveShadow = false
    }
  })
}

// Normalize a model group:
//   - scale so its LARGEST dimension equals `targetMax`
//   - center X/Z
//   - translate so the lowest point sits at y = 0 ("feet on the ground")
// Works for flat models (e.g. the quadcopter) because it keys off the
// single largest bounding-box axis, not a fixed height assumption.
function normalize(root, targetMax) {
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const largest = Math.max(size.x, size.y, size.z)

  const scale = targetMax / largest
  root.scale.setScalar(scale)

  // Re-measure AFTER scaling to get accurate centering offsets.
  const box2 = new THREE.Box3().setFromObject(root)
  const center = box2.getCenter(new THREE.Vector3())

  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y -= box2.min.y

  return root
}

// Drop the object so its current lowest point rests at y = 0.
// Used AFTER posing (e.g. tipping a figure onto its back) so it sits
// cleanly on the ground plane rather than floating or sinking.
function settleOnGround(root) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  root.position.y -= box.min.y
}

// ---------------------------------------------------------------------------
// Scene factory
// ---------------------------------------------------------------------------

export async function createScene(canvas) {
  // --- Renderer ------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3

  // --- Scene + camera ------------------------------------------------------
  const scene = new THREE.Scene()
  // Dark neutral-gray sky — darkest layer of the grayscale so the near-white
  // clay figures + drone pop with real contrast instead of blending to white.
  scene.background = new THREE.Color(0x9a9a9a)
  // Gentle gray depth falloff toward the horizon (matches the sky).
  scene.fog = new THREE.Fog(0x9a9a9a, 16, 70)

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  )
  camera.position.set(0, 2.7, 9.5)

  // --- Soft diffused studio lighting (monochrome) ---------------------------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9c9c9, 1.5)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xffffff, 1.7)
  key.position.set(4, 7, 5)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xffffff, 0.8)
  rim.position.set(-5, 3, -4)
  scene.add(rim)

  const fill = new THREE.AmbientLight(0xffffff, 0.55)
  scene.add(fill)

  // --- Terrain: broad clay surface + rolling background mounds --------------
  const slopeGroup = new THREE.Group()
  scene.add(slopeGroup)

  // Main ground plane the figures sit on (very gentle tilt → subtle slope).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 1, 1), terrainMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.rotation.z = 0.04
  ground.position.y = 0
  slopeGroup.add(ground)

  // Low scaled spheres as rolling clay mounds / distant hills.
  function mound(x, y, z, s) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), terrainMaterial)
    m.position.set(x, y, z)
    m.scale.set(s, s * 0.35, s)
    slopeGroup.add(m)
  }
  mound(-7, -1.0, -10, 8)
  mound(9, -1.2, -12, 10)
  mound(3, -1.6, -18, 12)
  mound(-5, -1.4, -16, 7)

  // --- Load models -----------------------------------------------------------
  const loader = new GLTFLoader()
  const [robotGlb, personGlb, droneGlb] = await Promise.all([
    loadModel(loader, '/models/robot.glb'),
    loadModel(loader, '/models/person.glb'),
    loadModel(loader, '/models/drone.glb'),
  ])

  // --- Person (lying flat on their back, face up) -----------------------------
  const person = personGlb.scene
  applyClay(person)
  normalize(person, MODEL_SCALE.person)
  person.position.y = 0 // re-center vertically for the lying pose
  person.rotation.x = Math.PI / 2 // tip onto back (face up; head → +Z locally)
  settleOnGround(person) // rest the back on the ground plane

  // Rig: place the body + choose its heading (head points +X, body spans X).
  const personRig = new THREE.Group()
  personRig.add(person)
  personRig.rotation.y = Math.PI / 2
  personRig.position.set(-0.7, 0, 0)
  scene.add(personRig)

  // --- Robot (KNEELING beside + leaning over the person's chest) ---------------
  const robot = robotGlb.scene
  applyClay(robot)
  normalize(robot, MODEL_SCALE.robot)
  robot.rotation.x = -0.75 // strong forward lean (toward face -Z, down over person)
  robot.rotation.z = 0.1 // slight roll = leaning in

  const robotRig = new THREE.Group()
  robotRig.add(robot)
  robotRig.rotation.y = 0 // face -Z, toward the person
  robotRig.position.set(0.15, -0.45, 0.6) // sunk well below torso level = kneeling
  scene.add(robotRig)

  // --- Drone (hovering high overhead) ------------------------------------------
  const drone = droneGlb.scene
  applyClay(drone)
  normalize(drone, MODEL_SCALE.drone)
  drone.position.set(0.2, 3.5, -0.8) // overhead, clearly inside the wide frame
  drone.rotation.y = -0.79 // ~45° yaw: presents the four rotor arms as an X-frame
  drone.rotation.x = 0.15 // slight nose-down pitch (3/4 read)
  drone.rotation.z = 0.1 // slight roll toward the beat-3 camera
  scene.add(drone)

  // --- Scattered gear: skis + poles (clay boxes/cylinders) ----------------------
  const gear = new THREE.Group()
  scene.add(gear)

  const skiGeo = new THREE.BoxGeometry(1.7, 0.05, 0.14)
  function ski(x, y, z, ry) {
    const s = new THREE.Mesh(skiGeo, clayMaterial)
    s.position.set(x, y, z)
    s.rotation.y = ry
    gear.add(s)
  }
  ski(-1.75, 0.03, -0.35, 0.4)
  ski(-1.55, 0.03, 0.55, -0.28)

  const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8)
  function pole(x, y, z, rx, rz) {
    const p = new THREE.Mesh(poleGeo, clayMaterial)
    p.position.set(x, y, z)
    p.rotation.x = rx
    p.rotation.z = rz
    gear.add(p)
  }
  pole(-1.95, 0.4, -0.1, 1.25, 0.2)
  pole(-1.45, 0.35, -0.8, 1.1, -0.35)

  // --- Idle animation ------------------------------------------------------------
  // `dt` is seconds since the previous frame. We accumulate elapsed time so the
  // bob/rotation stays smooth regardless of frame rate or caller timing.
  let elapsed = 0
  const baseDroneY = drone.position.y
  const baseDroneRotY = drone.rotation.y

  function idle(dt) {
    elapsed += dt
    // Hover bob (gentle vertical drift).
    drone.position.y = baseDroneY + Math.sin(elapsed * 1.6) * 0.15
    // Slow yaw sway around the base heading.
    drone.rotation.y = baseDroneRotY + Math.sin(elapsed * 0.7) * 0.06
  }

  return {
    scene,
    camera,
    renderer,
    refs: { robot: robotRig, person: personRig, drone },
    idle,
  }
}
