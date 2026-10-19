// ============================================================================
// arm-viewer.js — embedded product viewer for the real EPQ 5-DOF arm CAD.
//
// Self-contained Three.js viewer, dropped into the portfolio page as a quiet
// product render on drafting paper: transparent canvas (paper grid shows
// through), no floor, no in-canvas UI, adaptive framing that keeps the whole
// assembly in frame at any canvas aspect ratio.
//
// The mount transform, joint rotation axes, camera preset directions, and the
// environment / light rig are taken from the validated HAVK build
// (HAVK/three-arm/src/realArm.js + main.js), not reinvented.
//
// Public API (the page's src/main.js is written against this):
//   const viewer = await createArmViewer(canvas, { modelUrl, reducedMotion, onPose })
//   viewer.ready                       Promise<void> — model loaded + first frame drawn
//   viewer.setPreset(name, { immediate })
//                                      name: 'iso' | 'profile' | 'front' | 'top' | 'detail'
//   viewer.setPose([j1..j5], { immediate })
//                                      joint targets in DEGREES, eased
//   viewer.play()  viewer.pause()  viewer.resize()  viewer.dispose()
//
// `onPose(deg5)` fires on pose change, throttled to <= 10 Hz.
// ============================================================================
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// ---------------------------------------------------------------------------
// Joint limits — EPQ report FR-03: shoulder 0–150°, elbow 0–140°; the rest are
// design values. Same table as HAVK/three-arm/src/motion.js.
// ---------------------------------------------------------------------------
const JOINT_LIMITS = [
  { min: -120, max: 120 }, // J1 base yaw
  { min: 0, max: 150 }, // J2 shoulder pitch
  { min: -135, max: 135 }, // J3 upper-arm roll
  { min: 0, max: 140 }, // J4 elbow pitch
  { min: -180, max: 180 } // J5 wrist roll
]
const HOME_DEG = [0, 0, 0, 0, 0]

// ---------------------------------------------------------------------------
// Camera — HAVK's validated preset directions / targets, with `fill` as the
// fraction of the canvas the model's projected bounds are allowed to occupy.
// Distance is derived from the live model bounds (see fitDistance), so the
// preset values are directions + targets, not fixed distances.
// ---------------------------------------------------------------------------
const FOV = 36
const PRESET_MS = 700
const MIN_DIST = 0.45
const MAX_DIST = 8

// HAVK's preset camera positions (validated directions / composition). The
// pivot itself is re-centred on the model's measured bounds when the GLB
// loads: HAVK's targets assumed the arm sits at y≈0.42, while the real
// assembly's centre is lower — a measured pivot is what keeps the arm centred
// and filling the plate at every canvas aspect ratio.
const VIEWS = {
  iso: { pos: [0.98, 0.88, 1.12], havkTarget: [0.0, 0.42, 0.0], fillY: 0.86, fillX: 0.92 },
  profile: { pos: [1.7, 0.58, 0.0], havkTarget: [0.0, 0.42, 0.0], fillY: 0.84, fillX: 0.92 },
  front: { pos: [0.0, 0.64, 1.66], havkTarget: [0.0, 0.42, 0.0], fillY: 0.84, fillX: 0.92 },
  top: { pos: [0.0, 1.75, 0.001], havkTarget: [0.0, 0.32, 0.0], fillY: 0.88, fillX: 0.92 },
  detail: { pos: [0.72, 0.6, 0.72], havkTarget: [0.0, 0.42, 0.0], fillY: 0.88, fillX: 0.94 }
}
// Pre-compute the spherical direction (azimuth around +Y, elevation from the
// horizontal plane) of every preset from HAVK's camera position - target pair.
for (const key of Object.keys(VIEWS)) {
  const v = VIEWS[key]
  const dx = v.pos[0] - v.havkTarget[0]
  const dy = v.pos[1] - v.havkTarget[1]
  const dz = v.pos[2] - v.havkTarget[2]
  const len = Math.hypot(dx, dy, dz) || 1
  v.az = Math.atan2(dx, dz)
  v.el = Math.asin(THREE.MathUtils.clamp(dy / len, -1, 1))
  v.refDist = len
  v.havkTargetVec = new THREE.Vector3(v.havkTarget[0], v.havkTarget[1], v.havkTarget[2])
}

// ---------------------------------------------------------------------------
// Gentle looping showcase — deliberately calm (a product turntable, not a
// demo-reel). Every joint drifts well inside its limit.
// ---------------------------------------------------------------------------
const SHOWCASE_KEYS = [
  { pose: [0, 0, 0, 0, 0], hold: 1.8 },
  { pose: [8, 18, 4, 24, 14], hold: 1.3 },
  { pose: [-10, 28, -6, 34, -16], hold: 1.3 },
  { pose: [12, 12, 3, 18, 22], hold: 1.3 },
  { pose: [-5, 22, 9, 30, -9], hold: 1.3 }
]
const SHOWCASE_SEG = 3.2
const SHOWCASE = (() => {
  const segs = []
  let total = 0
  for (let i = 0; i < SHOWCASE_KEYS.length; i++) {
    const from = SHOWCASE_KEYS[i].pose.map((d) => d * D2R)
    const next = SHOWCASE_KEYS[(i + 1) % SHOWCASE_KEYS.length]
    const to = next.pose.map((d) => d * D2R)
    segs.push({ from, to, hold: next.hold, start: total })
    total += SHOWCASE_SEG + next.hold
  }
  return { segs, total }
})()

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const wrapAngle = (a) => {
  // shortest signed delta from 0 to `a`
  const t = (((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  return t - Math.PI
}

function sampleShowcase(t) {
  const { segs, total } = SHOWCASE
  const time = ((t % total) + total) % total
  for (const seg of segs) {
    if (time < seg.start + SHOWCASE_SEG + seg.hold) {
      const k = easeInOut(clamp((time - seg.start) / SHOWCASE_SEG, 0, 1))
      return seg.from.map((a, i) => lerp(a, seg.to[i], k))
    }
  }
  return segs[0].from.slice()
}

// ---------------------------------------------------------------------------
// Materials — palette locked by the sheet: dark printed polymer, near-black
// motors, two greys of metal, and one oxide accent on the tool tip only.
// ---------------------------------------------------------------------------
function createMaterials() {
  const mat = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o })
  return {
    printed: mat({ color: 0x1b222c, roughness: 0.62, metalness: 0.08 }),
    motor: mat({ color: 0x11151c, roughness: 0.45, metalness: 0.6 }),
    silver: mat({ color: 0x99a1ac, roughness: 0.42, metalness: 0.88 }),
    steel: mat({ color: 0xaab1bb, roughness: 0.3, metalness: 0.95 }),
    accent: mat({
      color: 0xc2410c,
      roughness: 0.45,
      metalness: 0.15,
      emissive: 0x3c1304,
      emissiveIntensity: 0.35
    })
  }
}

// ---------------------------------------------------------------------------
// Light rig — HAVK's validated studio rig (hemisphere + warm key + cool fill +
// two rims + bounce + front fill). No shadows: the arm floats on paper.
// ---------------------------------------------------------------------------
function createLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe4ecf5, 1.15))
  const dir = (color, intensity, x, y, z) => {
    const l = new THREE.DirectionalLight(color, intensity)
    l.position.set(x, y, z)
    scene.add(l)
    return l
  }
  dir(0xfff6ec, 3.2, 1.15, 1.75, 0.95) // key
  dir(0x9fc4e8, 1.2, -1.7, 0.75, 0.9) // cool fill
  dir(0x0a7194, 1.3, -1.3, 1.2, -1.5) // rim
  dir(0xc2410c, 0.9, 1.5, 0.75, -1.4) // warm rim
  dir(0xd3dde8, 0.6, 0.3, -1.0, 0.8) // bounce
  dir(0xffffff, 0.9, -0.4, 0.35, 2.0) // front fill
}

// ---------------------------------------------------------------------------
// Environment (PMREM room) — same as HAVK. Rebuilt after a context restore
// because render-target contents do not survive a lost WebGL context.
// ---------------------------------------------------------------------------
function buildEnvironment(renderer, scene, state) {
  if (state.envRT) {
    state.envRT.dispose()
    state.envRT = null
  }
  const pmrem = new THREE.PMREMGenerator(renderer)
  let envScene = null
  try {
    envScene = new RoomEnvironment()
    state.envRT = pmrem.fromScene(envScene, 0.04)
    scene.environment = state.envRT.texture
    scene.environmentIntensity = 0.8
  } finally {
    pmrem.dispose()
    if (envScene) disposeObject(envScene)
  }
}

// ---------------------------------------------------------------------------
// Geometry / material disposal helper.
// ---------------------------------------------------------------------------
function disposeObject(root) {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  root.traverse((obj) => {
    if (obj.geometry) geometries.add(obj.geometry)
    const list = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
    for (const m of list) {
      materials.add(m)
      for (const key in m) {
        const value = m[key]
        if (value && value.isTexture) textures.add(value)
      }
    }
  })
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
  textures.forEach((t) => t.dispose())
}

// ---------------------------------------------------------------------------
// Model loading — mount transform, joint lookup and material swap are copied
// verbatim from HAVK realArm.js (validated against his QA screenshots).
// ---------------------------------------------------------------------------
async function loadArm(modelUrl, materials) {
  await MeshoptDecoder.ready
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(modelUrl)

  const root = gltf.scene
  root.name = 'EPQ_ARM'

  // Swap the exported PBR materials for the scene palette, keyed by material
  // name (printed / motor / silver / steel). Unknown names fall back to printed.
  const oldMaterials = []
  root.traverse((obj) => {
    if (!obj.isMesh) return
    obj.castShadow = false
    obj.receiveShadow = false
    const apply = (m) => materials[m && m.name] || materials.printed
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => oldMaterials.push(m))
      obj.material = obj.material.map(apply)
    } else {
      if (obj.material) oldMaterials.push(obj.material)
      obj.material = apply(obj.material)
    }
    if (obj.geometry && !obj.geometry.attributes.normal) obj.geometry.computeVertexNormals()
  })
  // The exported PBR materials are no longer referenced: release them (and
  // any maps they own) so the GLB's original materials do not leak.
  for (const m of new Set(oldMaterials)) {
    if (!m) continue
    for (const key in m) {
      const value = m[key]
      if (value && value.isTexture) value.dispose()
    }
    if (typeof m.dispose === 'function') m.dispose()
  }

  const joints = ['J1', 'J2', 'J3', 'J4', 'J5'].map((name) => {
    const node = root.getObjectByName(name)
    if (!node) throw new Error('arm-opt.glb is missing joint node ' + name)
    return node
  })

  // Tool point: the centre of the J5 output face. J5 carries a node scale of
  // 0.01965, so a child offset of 1.0 in J5 local units is 19.65 mm along the
  // wrist axis — the distal face of the CAD flange (world +Y-down at rest).
  const endEffector = new THREE.Object3D()
  endEffector.name = 'EEF'
  endEffector.position.set(1.0, 0, 0)
  joints[4].add(endEffector)

  // Rotate the base-mounted export into the original chest-mount orientation:
  // J1 motor/axis horizontal, the arm hanging below it in front of the mount.
  const mountR = new THREE.Matrix4().set(0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)
  const mount = new THREE.Group()
  mount.quaternion.setFromRotationMatrix(mountR)
  mount.position.set(0, 0.45596, -0.32048)
  mount.add(root)

  const outer = new THREE.Group()
  outer.name = 'EPQ_ARM_FLOATING'
  outer.add(mount)

  // Oxide accent: one small marker sitting proud of the tool face. It is the
  // only accent-coloured object in the scene.
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), materials.accent)
  tip.name = 'EEF_TIP'
  tip.position.set(0.06, 0, 0) // J5 local units: just outside the flange face
  endEffector.add(tip)

  const meshes = []
  outer.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj)
  })
  outer.updateMatrixWorld(true)

  return { root: outer, joints, endEffector, meshes }
}

// ---------------------------------------------------------------------------
// Framing: exact perspective fit of the projected bounds.
//
// For a camera at target + dir*D the screen position of a point p is
//   x_ndc = dot(p-target, right) / ((D - dot(p-target, dir)) * tanH)
//   y_ndc = dot(p-target, up)    / ((D - dot(p-target, dir)) * tanV)
// so |x_ndc| <= fillX and |y_ndc| <= fillY hold for every corner when
//   D >= dot(p-target, dir) + |x| / (fillX * tanH)  (and likewise for y).
// Taking the max over the 8 bounds corners gives the closest distance that
// still shows the whole arm with the requested margin — at any aspect ratio.
// ---------------------------------------------------------------------------
const _upWorld = new THREE.Vector3(0, 1, 0)
const _fitDir = new THREE.Vector3()
const _fitRight = new THREE.Vector3()
const _fitUp = new THREE.Vector3()
const _fitPoint = new THREE.Vector3()

function cameraBasis(az, el) {
  const ce = Math.cos(el)
  _fitDir.set(ce * Math.sin(az), Math.sin(el), ce * Math.cos(az)) // target -> camera
  if (Math.abs(_fitDir.y) > 0.9999) {
    // looking almost straight down/up: derive the basis from the azimuth so the
    // camera keeps a stable "north" orientation instead of flipping.
    _fitRight.set(Math.cos(az), 0, -Math.sin(az))
  } else {
    _fitRight.crossVectors(_upWorld, _fitDir).normalize()
  }
  _fitUp.crossVectors(_fitDir, _fitRight).normalize()
}

function fitDistance(bounds, target, az, el, aspect, fillY, fillX) {
  if (!bounds || bounds.isEmpty()) return 2
  cameraBasis(az, el)
  const tanV = Math.tan((FOV * D2R) / 2)
  const tanH = tanV * Math.max(aspect, 0.05)
  let dist = MIN_DIST
  const min = bounds.min
  const max = bounds.max
  for (let i = 0; i < 8; i++) {
    _fitPoint.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z)
    _fitPoint.sub(target)
    const depthOff = _fitPoint.dot(_fitDir)
    const x = Math.abs(_fitPoint.dot(_fitRight))
    const y = Math.abs(_fitPoint.dot(_fitUp))
    dist = Math.max(dist, depthOff + x / (fillX * tanH), depthOff + y / (fillY * tanV))
  }
  return clamp(dist, MIN_DIST, MAX_DIST)
}

// ---------------------------------------------------------------------------
// createArmViewer
// ---------------------------------------------------------------------------
export async function createArmViewer(canvas, opts = {}) {
  const settings = {
    modelUrl: typeof opts.modelUrl === 'string' && opts.modelUrl ? opts.modelUrl : './models/arm-opt.glb',
    reducedMotion:
      typeof opts.reducedMotion === 'boolean'
        ? opts.reducedMotion
        : typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
          : false,
    onPose: typeof opts.onPose === 'function' ? opts.onPose : null,
    autoplay: opts.autoplay !== false
  }

  // ---------------------------------------------------------------- state
  const state = {
    canvas,
    settings,
    renderer: null,
    scene: null,
    camera: null,
    arm: null,
    materials: null,
    envRT: null,
    // pose (radians)
    pose: HOME_DEG.map((d) => d * D2R),
    poseTarget: HOME_DEG.map((d) => d * D2R),
    // camera orbit state
    preset: 'iso',
    az: VIEWS.iso.az,
    el: VIEWS.iso.el,
    target: VIEWS.iso.havkTargetVec.clone(),
    framingCenter: VIEWS.iso.havkTargetVec.clone(),
    dist: VIEWS.iso.refDist,
    tween: null,
    // drag state
    drag: null,
    // showcase
    playing: false,
    showcaseTime: 0,
    // viewport
    aspect: 1,
    viewW: 0,
    viewH: 0,
    // lifetime
    disposed: false,
    contextLost: false,
    visible: true,
    loaded: false,
    needsRender: true,
    rafId: 0,
    lastFrame: 0,
    // pose emission
    lastEmit: 0,
    lastEmitPose: HOME_DEG.slice(),
    // framing
    bounds: new THREE.Box3(),
    boundsPose: HOME_DEG.slice(),
    boundsDirty: true,
    observers: []
  }

  // -------------------------------------------------------------- deferred
  let resolveReady = null
  let rejectReady = null
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // Keep an ignored `ready` from surfacing as an unhandled rejection; callers
  // can still await/catch it and see the failure (page shows its fallback).
  ready.catch(() => {})

  const fail = (err) => {
    if (resolvingReady) return
    resolvingReady = true
    rejectReady(err instanceof Error ? err : new Error(String(err)))
  }
  let resolvingReady = false

  // --------------------------------------------------------------- measure
  function measure() {
    const parent = canvas.parentElement
    const w =
      canvas.clientWidth ||
      (parent ? parent.clientWidth : 0) ||
      (typeof window !== 'undefined' ? Math.max(1, window.innerWidth) : 1)
    const h =
      canvas.clientHeight ||
      (parent ? parent.clientHeight : 0) ||
      (typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 1)
    return { w: Math.max(1, w), h: Math.max(1, h) }
  }

  // ------------------------------------------------------------ pose apply
  function applyPose() {
    const joints = state.arm.joints
    const p = state.pose
    // validated real-CAD axes: J1 Y, J2 Z, J3 X (negated), J4 Z, J5 X (negated)
    joints[0].rotation.y = p[0]
    joints[1].rotation.z = p[1]
    joints[2].rotation.x = -p[2]
    joints[3].rotation.z = p[3]
    joints[4].rotation.x = -p[4]
  }

  // --------------------------------------------------------- bounds update
  const _bCorner = new THREE.Vector3()
  function updateBounds() {
    if (!state.arm) return
    state.arm.root.updateMatrixWorld(true)
    state.bounds.makeEmpty()
    for (const mesh of state.arm.meshes) {
      const geo = mesh.geometry
      if (!geo.boundingBox) geo.computeBoundingBox()
      const bb = geo.boundingBox
      if (!bb) continue
      for (let i = 0; i < 8; i++) {
        _bCorner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z)
        _bCorner.applyMatrix4(mesh.matrixWorld)
        state.bounds.expandByPoint(_bCorner)
      }
    }
    state.boundsPose = state.pose.slice()
    state.boundsDirty = false
  }

  // --------------------------------------------------------- camera update
  function viewFill() {
    return VIEWS[state.preset] || VIEWS.iso
  }

  function fitFor(az, el, target, presetName) {
    const view = VIEWS[presetName] || VIEWS.iso
    return fitDistance(state.bounds, target, az, el, state.aspect, view.fillY, view.fillX)
  }

  function updateCamera(dt) {
    const view = viewFill()
    let moved = false

    if (state.tween) {
      const tw = state.tween
      tw.t += dt * 1000
      const k = Math.min(1, tw.t / tw.dur)
      const e = easeInOut(k)
      state.az = lerp(tw.startAz, tw.toAz, e)
      state.el = lerp(tw.startEl, tw.toEl, e)
      state.target.lerpVectors(tw.startTarget, tw.toTarget, e)
      const need = fitFor(state.az, state.el, state.target, state.preset)
      state.dist = Math.max(lerp(tw.startDist, tw.toDist, e), need)
      if (k >= 1) state.tween = null
      moved = true
    } else {
      // The camera distance always tracks the closest distance that still
      // frames the whole arm: expand immediately (never clip), contract gently
      // so pose changes / aspect changes do not pop.
      const need = fitFor(state.az, state.el, state.target, state.preset)
      if (state.dist < need) {
        state.dist = need
        moved = true
      } else {
        const next = state.dist + (need - state.dist) * (1 - Math.exp(-dt * 8))
        if (Math.abs(next - state.dist) > 1e-6) moved = true
        state.dist = next
      }
    }

    const ce = Math.cos(state.el)
    const px = state.target.x + state.dist * ce * Math.sin(state.az)
    const py = state.target.y + state.dist * Math.sin(state.el)
    const pz = state.target.z + state.dist * ce * Math.cos(state.az)
    if (px !== state.camera.position.x || py !== state.camera.position.y || pz !== state.camera.position.z) {
      state.camera.position.set(px, py, pz)
      moved = true
    }
    state.camera.up.set(0, 1, 0)
    state.camera.lookAt(state.target)
    return moved
  }

  // ------------------------------------------------------------ pose emit
  function emitPose(now, force = false) {
    const onPose = state.settings.onPose
    if (!onPose) return
    const deg = state.pose.map((r) => Math.round(r * R2D * 10) / 10)
    let changed = force
    for (let i = 0; i < 5; i++) {
      if (Math.abs(deg[i] - state.lastEmitPose[i]) > 0.05) changed = true
    }
    if (!changed) return
    if (state.lastEmit !== 0 && now - state.lastEmit < 100) return
    state.lastEmit = now
    state.lastEmitPose = deg
    try {
      onPose(deg.slice())
    } catch (err) {
      // a page-side readout error must never break the render loop
    }
  }

  // --------------------------------------------------------------- update
  function update(dt, now) {
    let moved = false

    // gentle showcase drives the pose target
    if (state.playing && !state.settings.reducedMotion) {
      state.showcaseTime += dt
      const sample = sampleShowcase(state.showcaseTime)
      for (let i = 0; i < 5; i++) state.poseTarget[i] = sample[i]
      moved = true
    }

    // ease the actual pose toward the target
    const k = 1 - Math.exp(-dt * (state.playing ? 7 : 9))
    for (let i = 0; i < 5; i++) {
      const delta = state.poseTarget[i] - state.pose[i]
      if (Math.abs(delta) > 1e-5) {
        state.pose[i] += delta * k
        moved = true
      } else if (delta !== 0) {
        state.pose[i] = state.poseTarget[i]
        moved = true
      }
    }
    if (state.arm && moved) {
      applyPose()
      let poseChanged = false
      for (let i = 0; i < 5; i++) {
        if (Math.abs(state.pose[i] - state.boundsPose[i]) > 0.25 * D2R) poseChanged = true
      }
      if (poseChanged) state.boundsDirty = true
    }
    if (state.boundsDirty && state.arm) updateBounds()

    if (updateCamera(dt)) moved = true
    emitPose(now)
    return moved
  }

  // ---------------------------------------------------------------- frame
  function frame(now) {
    if (state.disposed) return
    state.rafId = requestAnimationFrame(frame)
    const dt = state.lastFrame ? Math.min(0.05, Math.max(0, (now - state.lastFrame) / 1000)) : 1 / 60
    state.lastFrame = now
    if (!state.renderer || state.contextLost) return
    if (!state.visible || (typeof document !== 'undefined' && document.hidden)) return
    const moved = update(dt, now)
    if (moved || state.needsRender) {
      state.needsRender = false
      state.renderer.render(state.scene, state.camera)
    }
  }

  // --------------------------------------------------------------- resize
  function resize() {
    if (state.disposed || !state.renderer) return
    const { w, h } = measure()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (w === state.viewW && h === state.viewH && dpr === state.renderer.getPixelRatio()) return
    state.viewW = w
    state.viewH = h
    state.aspect = w / h
    state.camera.aspect = state.aspect
    state.camera.updateProjectionMatrix()
    state.renderer.setPixelRatio(dpr)
    state.renderer.setSize(w, h, false) // CSS owns the element size
    if (state.arm) {
      // a resize must never leave the arm clipped: pull out immediately
      const need = fitFor(state.az, state.el, state.target, state.preset)
      if (state.dist < need) state.dist = need
      state.needsRender = true
    }
  }

  // -------------------------------------------------------------- presets
  function setPreset(name, { immediate = false } = {}) {
    if (state.disposed) return false
    const key = VIEWS[name] ? name : 'iso'
    const view = VIEWS[key]
    state.preset = key

    const snap = immediate || state.settings.reducedMotion || !state.arm
    if (snap) {
      state.tween = null
      state.az = view.az
      state.el = view.el
      state.target.copy(state.loaded ? state.framingCenter : view.havkTargetVec)
      if (state.arm) {
        state.dist = fitFor(state.az, state.el, state.target, key)
      } else {
        state.dist = view.refDist
      }
      state.needsRender = true
      return true
    }

    const toAz = state.az + wrapAngle(view.az - state.az)
    state.tween = {
      startAz: state.az,
      toAz,
      startEl: state.el,
      toEl: view.el,
      startTarget: state.target.clone(),
      toTarget: (state.loaded ? state.framingCenter : view.havkTargetVec).clone(),
      startDist: state.dist,
      toDist: fitFor(toAz, view.el, state.loaded ? state.framingCenter : view.havkTargetVec, key),
      t: 0,
      dur: PRESET_MS
    }
    state.needsRender = true
    return true
  }

  // ----------------------------------------------------------------- pose
  function setPose(deg5, { immediate = false } = {}) {
    if (state.disposed || !deg5 || typeof deg5.length !== 'number') return false
    const target = state.poseTarget.slice()
    let any = false
    for (let i = 0; i < 5; i++) {
      const value = Number(deg5[i])
      if (!Number.isFinite(value)) continue
      target[i] = clamp(value, JOINT_LIMITS[i].min, JOINT_LIMITS[i].max) * D2R
      any = true
    }
    if (!any) return false
    state.poseTarget = target
    state.playing = false // an explicit pose wins over the showcase loop
    if (immediate || state.settings.reducedMotion) {
      state.pose = target.slice()
      if (state.arm) {
        applyPose()
        state.boundsDirty = true
        updateBounds()
      }
    }
    state.needsRender = true
    emitPose(performance.now(), true)
    return true
  }

  // -------------------------------------------------------------- playback
  function play() {
    if (state.disposed || state.settings.reducedMotion) return false
    if (state.playing) return true
    state.playing = true
    state.needsRender = true
    return true
  }

  function pause() {
    if (state.disposed) return false
    if (!state.playing) return true
    state.playing = false
    state.poseTarget = state.pose.slice() // hold the current pose, no snap
    state.needsRender = true
    return true
  }

  // ------------------------------------------------------------- orbit drag
  const ORBIT_SENSITIVITY = 0.006 // radians per pixel
  const EL_MIN = -75 * D2R
  const EL_MAX = 89.5 * D2R

  function orbitBy(dx, dy) {
    state.az -= dx * ORBIT_SENSITIVITY
    state.el = clamp(state.el + dy * ORBIT_SENSITIVITY, EL_MIN, EL_MAX)
    state.needsRender = true
  }

  function onPointerDown(event) {
    if (state.disposed) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    state.tween = null // dragging takes over from any preset fly-through
    state.drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      touch: event.pointerType === 'touch',
      mode: event.pointerType === 'touch' ? 'undecided' : 'orbit'
    }
    canvas.style.cursor = 'grabbing'
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch (err) {
      /* pointer capture is best-effort */
    }
  }

  function onPointerMove(event) {
    const drag = state.drag
    if (!drag || event.pointerId !== drag.id) return
    const dx = event.clientX - drag.lastX
    const dy = event.clientY - drag.lastY
    if (drag.mode === 'undecided') {
      const totalX = Math.abs(event.clientX - drag.startX)
      const totalY = Math.abs(event.clientY - drag.startY)
      if (Math.max(totalX, totalY) < 7) return // not a deliberate gesture yet
      if (totalX > totalY) {
        drag.mode = 'orbit' // horizontal gesture: orbit, ignore vertical
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        return
      }
      // vertical gesture: hand it back to the browser (page scroll)
      state.drag = null
      canvas.style.cursor = ''
      return
    }
    if (drag.mode === 'orbit') {
      // touch keeps touch-action: pan-y, so only horizontal orbit is ours;
      // mouse is free to orbit on both axes.
      orbitBy(dx, drag.touch ? 0 : dy)
      drag.lastX = event.clientX
      drag.lastY = event.clientY
    }
  }

  function endDrag(event) {
    if (event && state.drag && event.pointerId !== state.drag.id) return
    state.drag = null
    canvas.style.cursor = ''
    try {
      if (event && canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
    } catch (err) {
      /* best-effort */
    }
  }

  // ---------------------------------------------------- webgl context loss
  function onContextLost(event) {
    event.preventDefault()
    state.contextLost = true
    state.needsRender = true
  }

  function onContextRestored() {
    if (state.disposed || !state.renderer) return
    state.contextLost = false
    // The renderer re-initialises its GL state itself; render-target contents
    // (the PMREM environment) do not survive, so rebuild them.
    try {
      buildEnvironment(state.renderer, state.scene, state)
    } catch (err) {
      /* lighting still works without the environment */
    }
    state.viewW = 0
    state.viewH = 0
    resize()
    state.needsRender = true
  }

  // -------------------------------------------------------------- dispose
  function dispose() {
    if (state.disposed) return
    state.disposed = true
    if (!resolvingReady) {
      // dispose() before the model finished loading: settle `ready` so callers
      // awaiting it cannot hang.
      resolvingReady = true
      rejectReady(new Error('arm viewer disposed before ready'))
    }
    cancelAnimationFrame(state.rafId)
    state.rafId = 0
    removeListeners()
    for (const observer of state.observers) {
      try {
        observer.disconnect()
      } catch (err) {
        /* ignore */
      }
    }
    state.observers.length = 0
    if (state.scene) disposeObject(state.scene)
    if (state.envRT) {
      state.envRT.dispose()
      state.envRT = null
    }
    if (state.scene) {
      state.scene.environment = null
      state.scene.clear()
    }
    if (state.renderer) {
      try {
        state.renderer.dispose()
        if (state.renderer.forceContextLoss) state.renderer.forceContextLoss()
      } catch (err) {
        /* nothing else to release */
      }
    }
    state.arm = null
    state.materials = null
    state.camera = null
    state.scene = null
    state.renderer = null
  }

  // ------------------------------------------------------------ listeners
  const listenerPairs = []

  function addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options)
    listenerPairs.push([target, type, handler, options])
  }

  function removeListeners() {
    for (const [target, type, handler, options] of listenerPairs) {
      target.removeEventListener(type, handler, options)
    }
    listenerPairs.length = 0
  }

  // ------------------------------------------------------------------ init
  function initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = false
    state.renderer = renderer

    const scene = new THREE.Scene()
    state.scene = scene
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 30)
    state.camera = camera
    camera.position.set(1.7, 1.05, 1.95)
    camera.lookAt(VIEWS.iso.havkTargetVec)
    createLights(scene)

    // paper is the background: the page grid shows through the canvas
    scene.background = null
    buildEnvironment(renderer, scene, state)
  }

  function attachInteraction() {
    // A custom drag orbit (not OrbitControls): no wheel zoom, no touch-action
    // hijack — touch only orbits horizontally so vertical page scroll still works.
    canvas.style.touchAction = 'pan-y'
    canvas.style.display = canvas.style.display || 'block'
    canvas.style.userSelect = 'none'
    canvas.style.webkitUserSelect = 'none'
    canvas.style.cursor = 'grab'
    canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent')

    addListener(canvas, 'pointerdown', onPointerDown)
    addListener(canvas, 'pointermove', onPointerMove)
    addListener(canvas, 'pointerup', endDrag)
    addListener(canvas, 'pointercancel', endDrag)
    addListener(canvas, 'webglcontextlost', onContextLost, false)
    addListener(canvas, 'webglcontextrestored', onContextRestored, false)
    addListener(window, 'resize', resize)

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => resize())
      ro.observe(canvas)
      state.observers.push(ro)
    }
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          state.visible = !!(entry && entry.isIntersecting)
          if (state.visible) state.needsRender = true
        },
        { threshold: 0 }
      )
      io.observe(canvas)
      state.observers.push(io)
    }
    addListener(document, 'visibilitychange', () => {
      if (!document.hidden) {
        state.lastFrame = 0
        state.needsRender = true
      }
    })
  }

  async function load() {
    resize()
    attachInteraction()

    const materials = createMaterials()
    state.materials = materials
    const arm = await loadArm(settings.modelUrl, materials)
    if (state.disposed) return // disposed while the GLB was loading
    state.arm = arm
    state.scene.add(arm.root)
    applyPose()
    updateBounds()

    // start framed exactly as the page will show it
    state.framingCenter.copy(state.bounds.getCenter(new THREE.Vector3()))
    state.az = VIEWS.iso.az
    state.el = VIEWS.iso.el
    state.target.copy(state.framingCenter)
    state.dist = fitFor(state.az, state.el, state.target, 'iso')
    state.needsRender = true

    // one guaranteed frame before ready resolves
    state.renderer.render(state.scene, state.camera)
    state.needsRender = false
    state.loaded = true
    emitPose(performance.now(), true)
    resolvingReady = true
    resolveReady()

    if (settings.autoplay && !settings.reducedMotion) play()

    state.lastFrame = 0
    state.rafId = requestAnimationFrame(frame)
  }

  // ---------------------------------------------------------------- public
  const api = {
    ready,
    setPreset,
    setPose,
    play,
    pause,
    resize,
    dispose,
    // Extra, non-contract inspection helper for QA harnesses and the page's
    // own diagnostics. Safe to ignore.
    debug() {
      if (!state.renderer) return { loaded: false }
      return {
        loaded: state.loaded,
        preset: state.preset,
        playing: state.playing,
        reducedMotion: settings.reducedMotion,
        poseDeg: state.pose.map((r) => Math.round(r * R2D * 10) / 10),
        camera: {
          position: state.camera.position.toArray(),
          target: state.target.toArray(),
          fov: state.camera.fov,
          aspect: state.camera.aspect
        },
        orbit: { az: state.az, el: state.el },
        tweening: Boolean(state.tween),
        distance: state.dist,
        bounds: state.bounds.isEmpty()
          ? null
          : { min: state.bounds.min.toArray(), max: state.bounds.max.toArray() },
        render: { calls: state.renderer.info.render.calls, triangles: state.renderer.info.render.triangles }
      }
    }
  }

  // ----------------------------------------------------------------- boot
  try {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('createArmViewer: a canvas element is required')
    }
    if (typeof window === 'undefined') {
      throw new Error('createArmViewer: browser environment required')
    }
    initRenderer()
  } catch (err) {
    fail(err)
    return api
  }

  load().catch((err) => {
    if (!state.disposed) fail(err)
  })

  return api
}
