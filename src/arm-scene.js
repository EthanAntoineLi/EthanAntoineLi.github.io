// ============================================================================
// arm-scene.js — the portfolio's one WebGL object: Ethan's real 5-DOF CAD arm,
// staged as a light, minimal product film on a transparent canvas.
//
// The module owns the canvas only. It knows nothing about the page layout; the
// page drives it through the small API below.
//
// ---------------------------------------------------------------------------
// PUBLIC API (the page is written against exactly this)
// ---------------------------------------------------------------------------
//   const scene = await createArmScene(canvas, {
//     modelUrl: './models/arm-opt.glb',   // default
//     reducedMotion: false                // default (auto-detects the media query)
//   })
//
//   scene.ready                    Promise<void> — GLB loaded, point cloud built,
//                                   first frame drawn (the entry reveal then keeps
//                                   running for ~2.2 s; see "scan reveal" below)
//   scene.setStop(name, t = 1)     name: 'hero' | 'joints' | 'profile' | 'scan' | 'outro'
//   scene.setMode(mode)            'mesh' | 'points' | 'xray'
//                                  xray = translucent shell + crisp black edges
//   scene.setScan(0..1 | null)     clip-plane wipe revealing the x-ray model
//                                  top-down, with a thin line at the slice
//   scene.setCloseUp(name, 0..1)   macro push-in aimed at an anchor:
//                                  'base'|'shoulder'|'elbow'|'wrist'|'tip'
//   scene.setOrbit(dx, dy)         add user drag deltas in RADIANS (clamped, damped)
//   scene.setPointer(x, y)         pointer position normalised to -1..1 (subtle parallax)
//   scene.projectAnchor(name)      -> { x, y, visible }  canvas-local CSS pixels
//                                  name: 'base' | 'shoulder' | 'elbow' | 'wrist' | 'tip'
//   scene.resize()                 re-measure + resize; also self-wires a ResizeObserver
//   scene.dispose()                release geometries / materials / renderer / observers
//
// `scene.debug()` is a non-contract escape hatch for QA harnesses (frame stats,
// live camera, an entry-reveal freeze hook). The page can ignore it.
//
// ---------------------------------------------------------------------------
// HOW setStop / the scroll blend works (documented because it is the subtle bit)
// ---------------------------------------------------------------------------
// Every stop owns a static keyframe: spherical camera direction (azimuth /
// elevation), field of view, framing fill, a pose (5 joint angles in degrees),
// a focus offset and a point-size multiplier. Keyframes are configs only; the
// live camera is a damped approximation of them.
//
//   setStop(name, 1)      arrive at `name`: it becomes the active stop, and the
//                         blend source is cleared.
//   setStop(name, t<1)    treat `name` as the destination and the previously
//                         arrived stop as the source; the target camera + pose
//                         are lerped with smoothstep(t) between the two. t is
//                         the page's local scroll progress between stops.
//
// The page's intended usage is therefore, on every scroll frame:
//
//   scene.setStop(currentStop)          // t = 1: pins the source of the blend
//   scene.setStop(nextStop, localT)     // t = 0..1: blends towards nextStop
//
// The live camera then damps toward that blended target (exponential smoothing,
// frame-rate independent), so repeated calls are cheap: setStop only writes
// three scalars and never allocates. Camera distance is re-fitted every frame
// from the measured model bounds, the live aspect ratio and the live FOV, and
// can only expand instantly (never clip) while it contracts smoothly.
//
// ---------------------------------------------------------------------------
// MODEL + ANCHORS
// ---------------------------------------------------------------------------
// The GLB is chest-mounted in its source CAD: the validated mount transform
// (from src/arm-viewer.js / the HAVK build) leaves the mount plate at the top
// and the arm hanging in front of it. We keep that transform, ground the model
// so its lowest bound sits at y = 0 and centre it on x/z. Model space therefore
// is "grounded, centred". Anchor definitions:
//   base      centre of the CAD `Static` mounting plate (the arm's base/chest
//             mount — it is physically the top of this hanging assembly)
//   shoulder  J2 joint origin
//   elbow     J3 joint origin
//   wrist     J5 joint origin
//   tip       end-effector tip (J5 output face + 1.2 mm)
// Anchor points are read from live joint world matrices, so they follow the
// pose; projection is a single camera-space test plus perspective divide.
// ============================================================================
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'

const D2R = Math.PI / 180
const UP = new THREE.Vector3(0, 1, 0)

const DEFAULT_MODEL_URL = './models/arm-opt.glb'
const POINT_COUNT = 90000
const ENTRY_MS = 2200
const MAX_DPR = 2

// Camera near/far are generous because the profile stop is a long lens.
const NEAR = 0.01
const FAR = 60
const MIN_DIST = 0.12

// ---------------------------------------------------------------------------
// Stop keyframes. `fill` is the fraction of the viewport the projected model
// bounds may occupy (0.72 => 72 % of viewport height). `focus` pushes the look
// target toward an anchor by `focusAmount` (0 = centred on the bounds).
// ---------------------------------------------------------------------------
const STOP_DEFS = {
  hero: {
    az: 0.62, // 3/4 from the front right
    el: 0.12,
    fov: 32,
    fillX: 0.78,
    fillY: 0.7, // hangs vertically, so it can be taller
    focus: null,
    focusAmount: 0,
    // All joints at zero: the "powered down, hanging vertical" state.
    pose: [0, 0, 0, 0, 0],
    // sit right of the name column
    screenX: 0.36,
    pointSize: 1,
    screenY: 0
  },
  joints: {
    az: -0.3, // low, only slightly three-quarter: keeps the close-up narrow
    el: -0.05,
    fov: 33,
    fillX: 0.74,
    fillY: 0.58, // close, but never the whole viewport: the copy column stays clear
    focus: 'elbow',
    focusAmount: 0.34,
    // A display pose: base turned a little, shoulder up, elbow folded ~95°,
    // wrist cocked. Reads as a deliberate product pose, not a random bend.
    pose: [18, 52, 0, 96, 24],
    pointSize: 1.12,
    // Push the close-up into the right third so the left ~third of the page's
    // "Built to hold 500 grams" copy stays legible underneath.
    screenX: 0.3,
    // Lifted so the arm's lower edge clears the full-width spec row.
    screenY: 0.26
  },
  profile: {
    // Three-quarter from above: looking down onto the linkage instead of a
    // flat side elevation. Short lens so the perspective is visible.
    az: 2.42,
    el: 0.58,
    fov: 26,
    fillX: 0.8,
    fillY: 0.74,
    focus: null,
    focusAmount: 0,
    pose: [0, 14, 0, 26, 0],
    pointSize: 0.92,
    screenX: 0,
    screenY: 0
  },
  scan: {
    az: -0.9, // wider top-ish three-quarter
    el: 0.68, // ~39° above
    fov: 43,
    fillX: 0.62,
    fillY: 0.58,
    focus: null,
    focusAmount: 0,
    pose: [-10, 18, -8, 38, 14],
    pointSize: 1.32,
    // Nudge the cloud right of the copy column so the scan read stays clear.
    screenX: 0.08,
    screenY: -0.02
  },
  outro: {
    // A full reach: shoulder up to horizontal, elbow straight, wrist neutral.
    // Deliberately unlike the folded payload pose.
    az: 0.82,
    el: 0.26,
    fov: 34,
    fillX: 0.5,
    fillY: 0.52,
    focus: null,
    focusAmount: 0,
    pose: [0, 96, 0, 0, 0],
    pointSize: 0.82,
    // Composition: sit the arm in the lower-right third, below and right of the
    // centred contact copy ("Let's talk." / email / links) so all of it stays
    // legible and clickable.
    screenX: 0.53,
    screenY: -0.46
  }
}
const STOP_NAMES = Object.keys(STOP_DEFS)
for (const key of STOP_NAMES) {
  STOP_DEFS[key].poseRad = STOP_DEFS[key].pose.map((d) => d * D2R)
}

// Mode target opacities. Mesh opacity is the PBR material set, points opacity
// the sampled cloud. X-ray = ghosted translucent mesh + a dense point cloud.
const MODE_TARGETS = {
  mesh: { mesh: 1, points: 0, pointsSize: 1, lines: 0 },
  points: { mesh: 0, points: 1, pointsSize: 1.15, lines: 0 },
  // X-ray is the technical drawing: a barely-there translucent shell with
  // crisp black edge lines. No stipple — edges carry the perspective.
  xray: { mesh: 0.16, points: 0, pointsSize: 1, lines: 1 }
}

// Point colours come from the source material name (the same four materials the
// GLB ships: printed / motor / silver / steel), lifted a little so the stipple
// reads on paper without turning into noise.
const POINT_COLORS = {
  printed: 0x2e3944,
  motor: 0x1e242c,
  silver: 0x606b77,
  steel: 0x7d8794
}

// Number of real surface vertices used for silhouette fitting. The 8 corners of
// a rotated AABB are mostly empty space, so fitting them under-fills badly
// (~60 % instead of the requested 72 %). Sampling ~6k actual surface points
// gives a near-exact projected silhouette at negligible cost (only recomputed
// when the pose moves).
const FIT_SAMPLES = 6000

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep01 = (t) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3)
const wrapAngle = (a) => {
  const t = (((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  return t - Math.PI
}
// Frame-rate independent exponential approach.
function damp(current, target, rate, dt) {
  const next = current + (target - current) * (1 - Math.exp(-rate * dt))
  return Math.abs(target - next) < 1e-6 ? target : next
}
function dampAngle(current, target, rate, dt) {
  const delta = wrapAngle(target - current)
  const next = current + delta * (1 - Math.exp(-rate * dt))
  return Math.abs(delta) < 1e-6 ? target : next
}

// ---------------------------------------------------------------------------
// A round, soft-edged point sprite (no external texture, no network).
// ---------------------------------------------------------------------------
function makeDiscTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const r = size / 2
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.62, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.86, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

// ---------------------------------------------------------------------------
// Point material. A tiny shader patch is used for the entry reveal: each point
// stores its assembled position AND a random start offset; a shared uProgress
// uniform interpolates between them on the GPU (so 90k points assemble without
// touching a buffer per frame). The rest is stock PointsMaterial, which keeps
// three's colour management / tone mapping / sprite map behaviour intact.
// ---------------------------------------------------------------------------
function createPointsMaterial(uniforms, texture, baseSize) {
  const material = new THREE.PointsMaterial({
    size: baseSize,
    sizeAttenuation: true,
    vertexColors: true,
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    alphaTest: 0.03,
    blending: THREE.NormalBlending
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uProgress = uniforms.uProgress
    shader.uniforms.uSizeMul = uniforms.uSizeMul
    shader.vertexShader =
      'attribute vec3 aStart;\nuniform float uProgress;\nuniform float uSizeMul;\n' +
      shader.vertexShader
        .replace('#include <begin_vertex>', 'vec3 transformed = mix(position + aStart, position, uProgress);')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * uSizeMul;')
  }
  return material
}

// ---------------------------------------------------------------------------
// Load + rig the GLB. Mount transform, joint axes and end-effector point are
// copied from the validated src/arm-viewer.js implementation.
// ---------------------------------------------------------------------------
async function loadArm(modelUrl) {
  await MeshoptDecoder.ready
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(modelUrl)
  const gltfRoot = gltf.scene
  gltfRoot.name = 'EPQ_ARM'

  const joints = ['J1', 'J2', 'J3', 'J4', 'J5'].map((name) => {
    const node = gltfRoot.getObjectByName(name)
    if (!node) throw new Error('arm-opt.glb is missing joint node ' + name)
    return node
  })

  // Tool point: 1.06 J5-local units along +X => the distal face + 1.2 mm.
  const endEffector = new THREE.Object3D()
  endEffector.name = 'EEF'
  endEffector.position.set(1.06, 0, 0)
  joints[4].add(endEffector)

  // Chest-mount orientation (validated in the HAVK build): the exported arm is
  // rotated so the chain hangs below the mounting plate in front of it.
  const mountR = new THREE.Matrix4().set(0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)
  const mount = new THREE.Group()
  mount.name = 'mount'
  mount.quaternion.setFromRotationMatrix(mountR)
  mount.position.set(0, 0.45596, -0.32048)
  mount.add(gltfRoot)

  const root = new THREE.Group()
  root.name = 'EPQ_ARM_SCENE'
  root.add(mount)

  // Ground + centre the model in its own space: lowest bound at y = 0, centred
  // on x/z. Everything downstream (camera targets, anchors, point cloud) works
  // in this grounded model space.
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  root.position.set(-center.x, -box.min.y, -center.z)
  root.updateMatrixWorld(true)
  box.setFromObject(root)

  const staticNode = gltfRoot.getObjectByName('Static') || null

  // Collect the primitive meshes.
  const meshes = []
  root.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj)
  })
  return { root, gltfRoot, joints, endEffector, staticNode, mount, meshes, box }
}

// ---------------------------------------------------------------------------
// Replace the exported materials with clones we can fade, keeping the source
// PBR look (original metalness / roughness / colours) as required by `mesh`
// mode. Cloning per material NAME means the whole assembly shares 4 materials,
// so per-frame opacity updates stay cheap.
// ---------------------------------------------------------------------------
function installMaterials(meshes) {
  const byName = new Map()
  const originals = new Set()
  for (const mesh of meshes) {
    const original = mesh.material
    const name = (original && original.name) || 'printed'
    originals.add(original)
    let material = byName.get(name)
    if (!material) {
      material = original.clone()
      material.name = name
      material.side = THREE.DoubleSide
      material.transparent = true
      material.opacity = 1
      material.depthWrite = true
      material.envMapIntensity = 0.9
      byName.set(name, material)
    }
    mesh.material = material
    mesh.castShadow = false
    mesh.receiveShadow = false
    if (mesh.geometry && !mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals()
  }
  for (const material of originals) {
    if (material) {
      for (const key in material) {
        const value = material[key]
        if (value && value.isTexture) value.dispose()
      }
      material.dispose()
    }
  }
  return byName
}

// ---------------------------------------------------------------------------
// X-ray edges: one LineSegments per primitive, parented to the same node, so
// the wireframe follows the joint animation exactly like the mesh does.
// ---------------------------------------------------------------------------
// Dense parts (motor cans, gear teeth) get a coarser angle threshold and a
// fainter line, so the x-ray reads as a drawing instead of a scribble. Simple
// box-like parts keep their crisp edges.
const EDGE_STYLE = {
  printed: { threshold: 30, opacity: 0.9 },
  motor: { threshold: 52, opacity: 0.34 },
  silver: { threshold: 38, opacity: 0.7 },
  steel: { threshold: 38, opacity: 0.7 }
}
const EDGE_FALLBACK = { threshold: 34, opacity: 0.75 }

function buildEdges(arm) {
  const materials = new Map()
  const objects = []
  for (const mesh of arm.meshes) {
    if (!mesh.geometry || !mesh.geometry.attributes.position) continue
    const name = (mesh.material && mesh.material.name) || 'printed'
    const style = EDGE_STYLE[name] || EDGE_FALLBACK
    let material = materials.get(name)
    if (!material) {
      material = new THREE.LineBasicMaterial({
        color: 0x0c0f12,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false
      })
      material.userData.baseOpacity = style.opacity
      materials.set(name, material)
    }
    const edges = new THREE.EdgesGeometry(mesh.geometry, style.threshold)
    const lines = new THREE.LineSegments(edges, material)
    lines.renderOrder = 3
    lines.visible = false
    lines.frustumCulled = false
    mesh.add(lines)
    objects.push(lines)
  }
  return { materials: [...materials.values()], objects }
}

// ---------------------------------------------------------------------------
// Sample the animated meshes into one point cloud. Each primitive's points are
// stored in its parent's space (position baked through the mesh's local matrix)
// and parented to that same node, so the cloud follows the joint animation for
// free — no per-frame CPU work.
// ---------------------------------------------------------------------------
function buildPoints(arm, pointsMaterial, scatterRadius) {
  const meshes = arm.meshes
  const samplers = []
  const weights = []
  let totalWeight = 0

  for (const mesh of meshes) {
    const sampler = new MeshSurfaceSampler(mesh)
    sampler.build()
    const distribution = sampler.distribution
    const localWeight = distribution && distribution.length ? distribution[distribution.length - 1] : 1
    const scale = new THREE.Vector3().setFromMatrixColumn(mesh.matrixWorld, 0).length()
    const weight = Math.max(1e-9, localWeight * scale * scale)
    samplers.push({ mesh, sampler })
    weights.push(weight)
    totalWeight += weight
  }

  const color = new THREE.Color()
  const point = new THREE.Vector3()
  const objects = []
  let produced = 0

  for (let index = 0; index < samplers.length; index++) {
    const { mesh, sampler } = samplers[index]
    let count = Math.max(3, Math.round((POINT_COUNT * weights[index]) / totalWeight))
    // Rounding can overshoot by a few; clamp the last one so the total is exact.
    count = Math.min(count, POINT_COUNT - produced)
    if (count <= 0) continue
    produced += count

    const materialName = (mesh.material && mesh.material.name) || 'printed'
    const baseColor = POINT_COLORS[materialName] !== undefined ? POINT_COLORS[materialName] : POINT_COLORS.printed
    color.setHex(baseColor)

    const posArray = new Float32Array(count * 3)
    const startArray = new Float32Array(count * 3)
    const colorArray = new Float32Array(count * 3)
    const localMatrix = mesh.matrix // parent-space transform of the geometry

    for (let n = 0; n < count; n++) {
      sampler.sample(point)
      point.applyMatrix4(localMatrix)
      posArray[n * 3] = point.x
      posArray[n * 3 + 1] = point.y
      posArray[n * 3 + 2] = point.z

      // Random direction on the unit sphere, random radius: the cloud assembles
      // from a loose shell around the arm rather than from a grid.
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const rr = Math.sqrt(1 - u * u)
      const radius = scatterRadius * (0.35 + Math.random() * 1.15)
      startArray[n * 3] = Math.cos(theta) * rr * radius
      startArray[n * 3 + 1] = u * radius
      startArray[n * 3 + 2] = Math.sin(theta) * rr * radius

      // Tiny per-point luminance variation so the stipple has a little depth.
      const shade = 0.86 + Math.random() * 0.28
      colorArray[n * 3] = color.r * shade
      colorArray[n * 3 + 1] = color.g * shade
      colorArray[n * 3 + 2] = color.b * shade
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
    geometry.setAttribute('aStart', new THREE.BufferAttribute(startArray, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))
    const object = new THREE.Points(geometry, pointsMaterial)
    object.name = 'points_' + mesh.name
    object.frustumCulled = false // shader-displaced during reveal; never cull
    object.renderOrder = 3
    object.visible = false
    if (mesh.parent) mesh.parent.add(object)
    else mesh.add(object)
    objects.push(object)
  }

  // Drop sampler references (their per-triangle distributions are no longer
  // needed and would keep several MB alive).
  samplers.length = 0
  return { objects, produced }
}

// ---------------------------------------------------------------------------
// Per-frame camera basis + exact perspective fit.
//
// For a camera at target + dir*D, a world point p projects to
//   x_ndc = dot(p-target, right) / ((D - dot(p-target, dir)) * tanH)
//   y_ndc = dot(p-target, up)    / ((D - dot(p-target, dir)) * tanV)
// so requiring every point inside the fill rectangle gives
//   D >= depth + |x| / (fillX * tanH)      (and likewise for y).
// Taking the max over REAL surface samples (not AABB corners) makes the fitted
// silhouette touch the requested fill exactly, at any aspect ratio.
// ---------------------------------------------------------------------------
const _dir = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _corner = new THREE.Vector3()

function cameraBasis(az, el) {
  const ce = Math.cos(el)
  _dir.set(ce * Math.sin(az), Math.sin(el), ce * Math.cos(az))
  _right.crossVectors(UP, _dir)
  if (_right.lengthSq() < 1e-10) _right.set(Math.cos(az), 0, -Math.sin(az))
  _right.normalize()
  _up.crossVectors(_dir, _right).normalize()
}

function fitDistance(bounds, samples, target, az, el, fov, aspect, fillX, fillY) {
  cameraBasis(az, el)
  const tanV = Math.tan((fov * D2R) / 2)
  const tanH = tanV * Math.max(aspect, 0.05)
  const fx = Math.max(0.05, fillX)
  const fy = Math.max(0.05, fillY)
  let dist = MIN_DIST
  if (samples && samples.length > 2) {
    const dx = _dir.x
    const dy = _dir.y
    const dz = _dir.z
    const rx = _right.x
    const ry = _right.y
    const rz = _right.z
    const ux = _up.x
    const uy = _up.y
    const uz = _up.z
    const invX = 1 / (fx * tanH)
    const invY = 1 / (fy * tanV)
    for (let i = 0; i < samples.length; i += 3) {
      const px = samples[i] - target.x
      const py = samples[i + 1] - target.y
      const pz = samples[i + 2] - target.z
      const depth = px * dx + py * dy + pz * dz
      const needX = depth + Math.abs(px * rx + py * ry + pz * rz) * invX
      const needY = depth + Math.abs(px * ux + py * uy + pz * uz) * invY
      if (needX > dist) dist = needX
      if (needY > dist) dist = needY
    }
    return dist
  }
  if (!bounds || bounds.isEmpty()) return 2
  const { min, max } = bounds
  for (let i = 0; i < 8; i++) {
    _corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).sub(target)
    const depthOffset = _corner.dot(_dir)
    const x = Math.abs(_corner.dot(_right)) / (fx * tanH)
    const y = Math.abs(_corner.dot(_up)) / (fy * tanV)
    dist = Math.max(dist, depthOffset + x, depthOffset + y)
  }
  return dist
}

// ---------------------------------------------------------------------------
// createArmScene
// ---------------------------------------------------------------------------
export async function createArmScene(canvas, opts = {}) {
  const settings = {
    modelUrl: typeof opts.modelUrl === 'string' && opts.modelUrl ? opts.modelUrl : DEFAULT_MODEL_URL,
    reducedMotion:
      typeof opts.reducedMotion === 'boolean'
        ? opts.reducedMotion
        : typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
          : false
  }

  const state = {
    canvas,
    settings,
    renderer: null,
    scene: null,
    camera: null,
    arm: null,
    materials: null, // Map name -> shared PBR material
    pointsMaterial: null,
    pointsTexture: null,
    pointsObjects: [],
    edgeMaterials: [],
    edgeObjects: [],
    // close-up camera override: aim at a named anchor by `amount` (0..1)
    closeup: { anchor: 'elbow', amount: 0, live: 0 },
    // scan reveal: vertical clip plane + a line on the model at the slice
    scan: { on: false, value: 1, plane: null, line: null },
    envRT: null,
    loaded: false,
    disposed: false,
    contextLost: false,
    visible: true,
    // viewport
    width: 1,
    height: 1,
    aspect: 1,
    dpr: 1,
    // model measurements
    bounds: new THREE.Box3(),
    center: new THREE.Vector3(0, 0.24, 0),
    size: new THREE.Vector3(1, 1, 1),
    radius: 1,
    // silhouette samples used for exact framing: local vertex positions per
    // mesh + the world-space copy refreshed whenever the pose moves
    samplesLocal: [],
    samplesWorld: new Float32Array(0),
    sampleCount: 0,
    // stop blending
    activeStop: 'hero',
    fromStop: null,
    blendT: 1,
    // live camera rig
    live: {
      az: STOP_DEFS.hero.az,
      el: STOP_DEFS.hero.el,
      fov: STOP_DEFS.hero.fov,
      fillX: STOP_DEFS.hero.fillX,
      fillY: STOP_DEFS.hero.fillY,
      screenX: 0,
      screenY: 0,
      target: new THREE.Vector3(0, 0.24, 0),
      lookTarget: new THREE.Vector3(0, 0.24, 0),
      dist: 2
    },
    // drag orbit (target + damped) and pointer parallax
    orbit: { az: 0, el: 0, liveAz: 0, liveEl: 0 },
    pointer: { x: 0, y: 0, liveX: 0, liveY: 0 },
    // pose
    pose: STOP_DEFS.hero.poseRad.slice(),
    // modes
    mode: 'mesh',
    modeLive: { mesh: 1, points: 0, pointsSize: 1, lines: 0 },
    // entry reveal
    entryStart: 0,
    entryRaw: 1,
    entryFrozen: null,
    entryDone: true,
    // uniforms
    uniforms: {
      uProgress: { value: 1 },
      uSizeMul: { value: 1 }
    },
    // focus offsets per stop (world-space offset from bounds centre)
    focusOffsets: {},
    // anchors (scratch vectors reused by projectAnchor)
    anchors: {
      base: new THREE.Vector3(),
      shoulder: new THREE.Vector3(),
      elbow: new THREE.Vector3(),
      wrist: new THREE.Vector3(),
      tip: new THREE.Vector3()
    },
    // frame stats
    frameTimes: new Float32Array(120),
    frameCount: 0,
    renderedFrames: 0,
    lastFrameTime: 0,
    observers: []
  }

  // ------------------------------------------------------------------ ready
  let resolveReady
  let rejectReady
  let settled = false
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // Never surface an unhandled rejection if the page chooses not to await it.
  ready.catch(() => {})

  function fail(err) {
    if (settled) return
    settled = true
    try {
      rejectReady(err instanceof Error ? err : new Error(String(err)))
    } catch (e) {
      /* ignore */
    }
  }

  // -------------------------------------------------------------- measuring
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
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
  }

  function resize() {
    if (state.disposed || !state.renderer) return
    const { w, h } = measure()
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, MAX_DPR)
    if (w === state.width && h === state.height && dpr === state.dpr) return
    state.width = w
    state.height = h
    state.aspect = w / h
    state.dpr = dpr
    state.renderer.setPixelRatio(dpr)
    state.renderer.setSize(w, h, false) // CSS owns the element size
    state.camera.aspect = state.aspect
    state.camera.updateProjectionMatrix()
    if (state.loaded) {
      // A resize must never leave the arm clipped or off-centre: re-solve the
      // framing immediately (the render loop keeps it up to date afterwards).
      state.live.dist = solveFraming(
        state.live.target,
        state.live.az + state.orbit.liveAz,
        state.live.el + state.orbit.liveEl,
        state.live.fov,
        state.aspect,
        state.live.fillX,
        state.live.fillY,
        state.live.screenX,
        state.live.screenY
      )
      placeCameraFromLive()
    }
  }

  // ------------------------------------------------------------ pose helpers
  function applyPose() {
    if (!state.arm) return
    const joints = state.arm.joints
    const p = state.pose
    // validated real-CAD axes: J1 Y, J2 Z, J3 X (negated), J4 Z, J5 X (negated)
    joints[0].rotation.y = p[0]
    joints[1].rotation.z = p[1]
    joints[2].rotation.x = -p[2]
    joints[3].rotation.z = p[3]
    joints[4].rotation.x = -p[4]
  }

  // --------------------------------------------------- silhouette measurement
  // Real surface samples beat AABB corners for framing: the fitted silhouette
  // touches the requested fill exactly instead of under-filling by ~20 %.
  // Sample positions are stored per mesh in geometry space and re-transformed
  // only when the pose actually moves.
  const _samplePoint = new THREE.Vector3()

  function buildFitSamples() {
    if (!state.arm) return
    const meshes = state.arm.meshes
    let totalVerts = 0
    for (const mesh of meshes) {
      const position = mesh.geometry.attributes.position
      if (position) totalVerts += position.count
    }
    const stride = Math.max(1, Math.ceil(totalVerts / FIT_SAMPLES))
    const groups = []
    let total = 0
    for (const mesh of meshes) {
      const position = mesh.geometry.attributes.position
      if (!position || position.count === 0) continue
      const count = Math.ceil(position.count / stride)
      const local = new Float32Array(count * 3)
      let w = 0
      for (let i = 0; i < position.count; i += stride) {
        local[w++] = position.getX(i)
        local[w++] = position.getY(i)
        local[w++] = position.getZ(i)
      }
      groups.push({ mesh, local })
      total += w / 3
    }
    state.samplesLocal = groups
    state.sampleCount = total
    state.samplesWorld = new Float32Array(total * 3)
  }

  function updateMeasurements() {
    if (!state.arm) return
    state.arm.root.updateMatrixWorld(true)
    const world = state.samplesWorld
    const bounds = state.bounds
    bounds.makeEmpty()
    let w = 0
    for (const group of state.samplesLocal) {
      const mesh = group.mesh
      const local = group.local
      const matrix = mesh.matrixWorld
      for (let i = 0; i < local.length; i += 3) {
        _samplePoint.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(matrix)
        world[w++] = _samplePoint.x
        world[w++] = _samplePoint.y
        world[w++] = _samplePoint.z
        bounds.expandByPoint(_samplePoint)
      }
    }
    bounds.getCenter(state.center)
    bounds.getSize(state.size)
    state.radius = 0.5 * Math.max(state.size.x, state.size.y, state.size.z)
  }

  function measureFit(target, az, el, fov, aspect, fillX, fillY) {
    return fitDistance(state.bounds, state.samplesWorld, target, az, el, fov, aspect, fillX, fillY)
  }

  // ------------------------------------------------------- stop blend target
  const desired = {
    az: 0,
    el: 0,
    fov: 34,
    fillX: 0.78,
    fillY: 0.72,
    screenX: 0,
    screenY: 0,
    focus: new THREE.Vector3(),
    pose: new Float32Array(5),
    pointSize: 1
  }
  const _focusTmp = new THREE.Vector3()
  const _centerTmp = new THREE.Vector3()

  function computeDesired() {
    const to = STOP_DEFS[state.activeStop] || STOP_DEFS.hero
    const from = state.fromStop && state.blendT < 1 ? STOP_DEFS[state.fromStop] : null
    const t = from ? smoothstep01(state.blendT) : 1
    desired.az = from ? lerp(from.az, to.az, t) : to.az
    desired.el = from ? lerp(from.el, to.el, t) : to.el
    desired.fov = from ? lerp(from.fov, to.fov, t) : to.fov
    desired.fillX = from ? lerp(from.fillX, to.fillX, t) : to.fillX
    desired.fillY = from ? lerp(from.fillY, to.fillY, t) : to.fillY
    desired.pointSize = from ? lerp(from.pointSize, to.pointSize, t) : to.pointSize
    desired.screenX = from ? lerp(from.screenX || 0, to.screenX || 0, t) : to.screenX || 0
    desired.screenY = from ? lerp(from.screenY || 0, to.screenY || 0, t) : to.screenY || 0
    for (let i = 0; i < 5; i++) {
      desired.pose[i] = from ? lerp(from.poseRad[i], to.poseRad[i], t) : to.poseRad[i]
    }
    // Focus target = live bounds centre + (offset blended between stops).
    if (!state.arm) {
      desired.focus.set(0, 0, 0)
      return
    }
    _centerTmp.copy(state.center)
    const toOffset = state.focusOffsets[state.activeStop] || null
    const fromOffset = from ? state.focusOffsets[state.fromStop] || null : null
    if (fromOffset && toOffset) {
      _focusTmp.copy(fromOffset).lerp(toOffset, t)
    } else if (toOffset) {
      _focusTmp.copy(toOffset)
    } else if (fromOffset) {
      _focusTmp.copy(fromOffset).multiplyScalar(1 - t)
    } else {
      _focusTmp.set(0, 0, 0)
    }
    desired.focus.copy(_centerTmp).add(_focusTmp)
  }

  // ------------------------------------------------------ anchor measurement
  const _anchorWorld = new THREE.Vector3()

  function anchorWorld(name, target) {
    if (!state.arm) {
      target.set(0, 0, 0)
      return target
    }
    const arm = state.arm
    switch (name) {
      case 'base':
        ;(arm.staticNode || arm.mount).getWorldPosition(target)
        break
      case 'shoulder':
        arm.joints[1].getWorldPosition(target)
        break
      case 'elbow':
        arm.joints[2].getWorldPosition(target)
        break
      case 'wrist':
        arm.joints[4].getWorldPosition(target)
        break
      case 'tip':
        arm.endEffector.getWorldPosition(target)
        break
      default:
        target.set(0, 0, 0)
    }
    return target
  }

  function computeFocusOffsets() {
    _centerTmp.copy(state.center)
    const offset = new THREE.Vector3()
    for (const name of STOP_NAMES) {
      const def = STOP_DEFS[name]
      if (!def.focus || !def.focusAmount) {
        state.focusOffsets[name] = null
        continue
      }
      anchorWorld(def.focus, _anchorWorld)
      offset.copy(_anchorWorld).sub(_centerTmp).multiplyScalar(def.focusAmount)
      state.focusOffsets[name] = offset.clone()
    }
  }

  // ------------------------------------------------------------- framing solve
  // Fitting alone is not enough: the look target is the model's AABB centre,
  // but perspective makes the projected silhouette asymmetric about it, so one
  // side hits the fill rectangle while the other leaves a gap (the "joints"
  // stop under-filled by ~25 % this way). After fitting the distance we measure
  // the live projected extents and pan the target by half their midpoint, then
  // re-fit — three cheap passes over ~6k samples, only when the pose/camera
  // move. Result: the silhouette is centred AND touches the requested fill.
  function sampleExtentMid(target, dist, az, el, fov, aspect) {
    const samples = state.samplesWorld
    if (samples.length < 3) return { x: 0, y: 0 }
    cameraBasis(az, el)
    const tanV = Math.tan((fov * D2R) / 2)
    const tanH = tanV * Math.max(aspect, 0.05)
    const dx = _dir.x
    const dy = _dir.y
    const dz = _dir.z
    const rx = _right.x
    const ry = _right.y
    const rz = _right.z
    const ux = _up.x
    const uy = _up.y
    const uz = _up.z
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < samples.length; i += 3) {
      const px = samples[i] - target.x
      const py = samples[i + 1] - target.y
      const pz = samples[i + 2] - target.z
      const denom = Math.max(dist - (px * dx + py * dy + pz * dz), 1e-4)
      const nx = (px * rx + py * ry + pz * rz) / (denom * tanH)
      const ny = (px * ux + py * uy + pz * uz) / (denom * tanV)
      if (nx < minX) minX = nx
      if (nx > maxX) maxX = nx
      if (ny < minY) minY = ny
      if (ny > maxY) maxY = ny
    }
    return { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 }
  }

  function solveFraming(baseTarget, az, el, fov, aspect, fillX, fillY, screenX = 0, screenY = 0) {
    state.live.lookTarget.copy(baseTarget)
    let dist = fitDistance(state.bounds, state.samplesWorld, state.live.lookTarget, az, el, fov, aspect, fillX, fillY)
    for (let iteration = 0; iteration < 3; iteration++) {
      const mid = sampleExtentMid(state.live.lookTarget, dist, az, el, fov, aspect)
      if (Math.abs(mid.x) < 0.003 && Math.abs(mid.y) < 0.003) break
      cameraBasis(az, el)
      const tanV = Math.tan((fov * D2R) / 2)
      const tanH = tanV * Math.max(aspect, 0.05)
      state.live.lookTarget.addScaledVector(_right, mid.x * dist * tanH)
      state.live.lookTarget.addScaledVector(_up, mid.y * dist * tanV)
      dist = fitDistance(state.bounds, state.samplesWorld, state.live.lookTarget, az, el, fov, aspect, fillX, fillY)
    }
    // Composition offset, applied last: shifting the look target moves the
    // silhouette in the opposite screen direction. screenX/Y are fractions of
    // the half-viewport (0.3 => the object centre sits 30 % of a half-width off
    // centre), which is exactly what the page's copy-safe zones need.
    if (screenX || screenY) {
      cameraBasis(az, el)
      const tanV = Math.tan((fov * D2R) / 2)
      const tanH = tanV * Math.max(aspect, 0.05)
      state.live.lookTarget.addScaledVector(_right, -screenX * dist * tanH)
      state.live.lookTarget.addScaledVector(_up, -screenY * dist * tanV)
    }
    return dist
  }

  const _closeAnchor = new THREE.Vector3()
  const _closeTarget = new THREE.Vector3()

  function placeCameraFromLive() {
    const az = state.live.az + state.orbit.liveAz + state.pointer.liveX * 0.035
    const el = state.live.el + state.orbit.liveEl - state.pointer.liveY * 0.022
    cameraBasis(az, el)
    const camera = state.camera
    let target = state.live.lookTarget
    let dist = state.live.dist
    // A macro close-up on a named anchor: drives the transitions that dive
    // into a joint instead of just moving the copy.
    if (state.closeup.live > 0.002 && state.arm) {
      anchorWorld(state.closeup.anchor, _closeAnchor)
      _closeTarget.copy(target).lerp(_closeAnchor, state.closeup.live * 0.94)
      dist = dist * (1 - state.closeup.live * 0.58)
      target = _closeTarget
    }
    camera.position.copy(target).addScaledVector(_dir, dist)
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    if (Math.abs(camera.fov - state.live.fov) > 1e-4) {
      camera.fov = state.live.fov
      camera.updateProjectionMatrix()
    }
  }

  function snapToDesired() {
    computeDesired()
    // pose
    for (let i = 0; i < 5; i++) state.pose[i] = desired.pose[i]
    applyPose()
    updateMeasurements()
    computeFocusOffsets()
    // camera
    state.live.az = desired.az
    state.live.el = desired.el
    state.live.fov = desired.fov
    state.live.fillX = desired.fillX
    state.live.fillY = desired.fillY
    state.live.screenX = desired.screenX
    state.live.screenY = desired.screenY
    state.live.target.copy(desired.focus)
    state.orbit.liveAz = state.orbit.az
    state.orbit.liveEl = state.orbit.el
    state.pointer.liveX = state.pointer.x
    state.pointer.liveY = state.pointer.y
    state.live.dist = solveFraming(
      state.live.target,
      state.live.az + state.orbit.liveAz,
      state.live.el + state.orbit.liveEl,
      state.live.fov,
      state.aspect,
      state.live.fillX,
      state.live.fillY,
      state.live.screenX,
      state.live.screenY
    )
    placeCameraFromLive()
    // mode weights
    const target = MODE_TARGETS[state.mode] || MODE_TARGETS.mesh
    state.modeLive.mesh = target.mesh
    state.modeLive.points = target.points
    state.modeLive.pointsSize = target.pointsSize
    state.modeLive.lines = target.lines || 0
    state.uniforms.uSizeMul.value = state.modeLive.pointsSize
  }

  // ----------------------------------------------------------- per-frame tick
  const _desiredTarget = new THREE.Vector3()

  function update(dt, now) {
    if (!state.arm) return

    // ---- entry reveal -----------------------------------------------------
    if (state.entryFrozen != null) {
      state.entryRaw = clamp(state.entryFrozen, 0, 1)
      state.entryDone = state.entryRaw >= 1
    } else if (!state.entryDone) {
      const raw = (now - state.entryStart) / ENTRY_MS
      if (raw >= 1) {
        state.entryRaw = 1
        state.entryDone = true
      } else {
        state.entryRaw = Math.max(0, raw)
      }
    }
    const entryEase = easeOutCubic(state.entryRaw)
    state.uniforms.uProgress.value = entryEase

    // ---- stop blend -> pose ----------------------------------------------
    computeDesired()
    const poseRate = state.settings.reducedMotion ? 40 : 4.2
    let poseMoved = false
    for (let i = 0; i < 5; i++) {
      const next = state.settings.reducedMotion
        ? desired.pose[i]
        : damp(state.pose[i], desired.pose[i], poseRate, dt)
      if (Math.abs(next - state.pose[i]) > 1e-6) poseMoved = true
      state.pose[i] = next
    }
    if (poseMoved) {
      applyPose()
      updateMeasurements()
    }

    // ---- camera rig -------------------------------------------------------
    const rate = state.settings.reducedMotion ? 40 : 5.2
    state.live.az = dampAngle(state.live.az, desired.az, rate, dt)
    state.live.el = damp(state.live.el, desired.el, rate, dt)
    state.live.fov = damp(state.live.fov, desired.fov, rate, dt)
    state.live.fillX = damp(state.live.fillX, desired.fillX, rate, dt)
    state.live.fillY = damp(state.live.fillY, desired.fillY, rate, dt)
    state.live.screenX = damp(state.live.screenX, desired.screenX, rate, dt)
    state.live.screenY = damp(state.live.screenY, desired.screenY, rate, dt)

    // target = blended focus point; the live target dams towards it so pose
    // changes pan the camera instead of snapping it.
    _desiredTarget.copy(desired.focus)
    state.live.target.x = damp(state.live.target.x, _desiredTarget.x, rate, dt)
    state.live.target.y = damp(state.live.target.y, _desiredTarget.y, rate, dt)
    state.live.target.z = damp(state.live.target.z, _desiredTarget.z, rate, dt)

    // ---- drag orbit + pointer parallax -----------------------------------
    const orbitRate = state.settings.reducedMotion ? 30 : 9
    state.orbit.liveAz = damp(state.orbit.liveAz, state.orbit.az, orbitRate, dt)
    state.orbit.liveEl = damp(state.orbit.liveEl, state.orbit.el, orbitRate, dt)
    const pointerRate = state.settings.reducedMotion ? 30 : 5.5
    state.pointer.liveX = damp(state.pointer.liveX, state.pointer.x, pointerRate, dt)
    state.pointer.liveY = damp(state.pointer.liveY, state.pointer.y, pointerRate, dt)

    // ---- distance + centring: exact fit to the live frame ----------------
    const az = state.live.az + state.orbit.liveAz + state.pointer.liveX * 0.035
    const el = state.live.el + state.orbit.liveEl - state.pointer.liveY * 0.022
    state.live.dist = solveFraming(
      state.live.target,
      az,
      el,
      state.live.fov,
      state.aspect,
      state.live.fillX,
      state.live.fillY,
      state.live.screenX,
      state.live.screenY
    )
    placeCameraFromLive()

    // ---- modes (+ entry reveal override) ---------------------------------
    const modeTarget = MODE_TARGETS[state.mode] || MODE_TARGETS.mesh
    const modeRate = state.settings.reducedMotion ? 40 : 7
    state.modeLive.mesh = damp(state.modeLive.mesh, modeTarget.mesh, modeRate, dt)
    state.modeLive.points = damp(state.modeLive.points, modeTarget.points, modeRate, dt)
    state.modeLive.pointsSize = damp(state.modeLive.pointsSize, modeTarget.pointsSize, modeRate, dt)
    state.modeLive.lines = damp(state.modeLive.lines, modeTarget.lines, modeRate, dt)
    state.uniforms.uSizeMul.value = state.modeLive.pointsSize
    // close-up damp
    state.closeup.live = damp(state.closeup.live, state.closeup.amount, 6, dt)

    // Entry reveal: the cloud is visible regardless of mode, converges, then
    // the mesh materialises while the last points fade. Never a pop.
    const revealMesh = state.settings.reducedMotion ? 1 : smoothstep01((state.entryRaw - 0.34) / 0.5)
    const revealPoints = state.settings.reducedMotion ? 0 : 1 - smoothstep01((state.entryRaw - 0.62) / 0.38)
    const meshOpacity = state.modeLive.mesh * revealMesh
    const pointsOpacity = Math.max(state.modeLive.points, revealPoints * 0.92)
    const linesOpacity = state.modeLive.lines * (state.settings.reducedMotion ? 1 : revealMesh)
    applyMaterialState(meshOpacity, pointsOpacity, linesOpacity)
  }

  // Shared PBR materials are only recalculated when opacity actually moves.
  let lastMeshOpacity = -1
  let lastPointsOpacity = -1
  let lastLinesOpacity = -1
  let lastLinesVisible = null
  let lastTransparent = null

  function applyMaterialState(meshOpacity, pointsOpacity, linesOpacity = 0) {
    const clampedMesh = clamp(meshOpacity, 0, 1)
    const clampedPoints = clamp(pointsOpacity, 0, 1)
    const clampedLines = clamp(linesOpacity, 0, 1)
    // Mesh
    if (meshOpacity > 0.004) {
      if (Math.abs(clampedMesh - lastMeshOpacity) > 0.0015) {
        for (const material of state.materials.values()) material.opacity = clampedMesh
        lastMeshOpacity = clampedMesh
      }
      const transparent = clampedMesh < 0.995
      const depthWrite = transparent ? clampedMesh > 0.85 : true
      if (lastTransparent !== transparent) {
        for (const material of state.materials.values()) {
          material.transparent = transparent
          material.depthWrite = depthWrite
          material.needsUpdate = true
        }
        lastTransparent = transparent
      } else {
        for (const material of state.materials.values()) material.depthWrite = depthWrite
      }
      for (const mesh of state.arm.meshes) mesh.visible = true
    } else {
      for (const mesh of state.arm.meshes) mesh.visible = false
      lastMeshOpacity = -1
    }
    // X-ray edges (per-material base opacity: motors stay faint)
    if (state.edgeMaterials.length) {
      if (Math.abs(clampedLines - lastLinesOpacity) > 0.0015) {
        for (const material of state.edgeMaterials) {
          material.opacity = clampedLines * (material.userData.baseOpacity || 0.8)
        }
        lastLinesOpacity = clampedLines
      }
      const showLines = clampedLines > 0.004
      if (showLines !== lastLinesVisible) {
        for (const object of state.edgeObjects) object.visible = showLines
        lastLinesVisible = showLines
      }
    }
    // Points
    if (pointsOpacity > 0.004) {
      if (Math.abs(clampedPoints - lastPointsOpacity) > 0.0015) {
        state.pointsMaterial.opacity = clampedPoints
        lastPointsOpacity = clampedPoints
      }
      for (const object of state.pointsObjects) object.visible = true
    } else {
      for (const object of state.pointsObjects) object.visible = false
      lastPointsOpacity = -1
    }
  }

  // --------------------------------------------------------------- the loop
  function frame(now) {
    if (state.disposed) return
    const last = state.lastFrameTime
    const rawDt = last ? Math.max(0, (now - last) / 1000) : 1 / 60
    const dt = Math.min(1 / 30, rawDt)
    state.lastFrameTime = now
    if (state.contextLost) return
    if (!state.renderer || !state.scene || !state.camera) return
    if (!state.visible || (typeof document !== 'undefined' && document.hidden)) return
    update(dt, now)
    state.renderer.render(state.scene, state.camera)
    state.renderedFrames++
    // rolling frame-time stats (ms) for the QA readout
    state.frameTimes[state.frameCount % state.frameTimes.length] = rawDt * 1000
    state.frameCount++
  }

  // ------------------------------------------------------------- interaction
  function onContextLost(event) {
    event.preventDefault()
    state.contextLost = true
  }

  function onContextRestored() {
    if (state.disposed || !state.renderer) return
    state.contextLost = false
    try {
      buildEnvironment()
    } catch (err) {
      /* lighting still works without the environment */
    }
    state.width = 0
    state.height = 0
    resize()
    state.lastFrameTime = 0
  }

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

  // -------------------------------------------------------------- env/lights
  function buildEnvironment() {
    if (state.envRT) {
      state.envRT.dispose()
      state.envRT = null
    }
    const pmrem = new THREE.PMREMGenerator(state.renderer)
    let envScene = null
    try {
      envScene = new RoomEnvironment()
      state.envRT = pmrem.fromScene(envScene, 0.04)
      state.scene.environment = state.envRT.texture
      state.scene.environmentIntensity = 0.7
    } finally {
      pmrem.dispose()
      if (envScene) disposeObject(envScene)
    }
  }

  function createLights() {
    state.scene.add(new THREE.HemisphereLight(0xffffff, 0xe4ecf5, 1.1))
    const dir = (color, intensity, x, y, z) => {
      const light = new THREE.DirectionalLight(color, intensity)
      light.position.set(x, y, z)
      state.scene.add(light)
      return light
    }
    dir(0xfff6ec, 2.2, 1.15, 1.75, 0.95) // warm key
    dir(0x9fc4e8, 0.9, -1.7, 0.75, 0.9) // cool fill
    dir(0x0a7194, 0.9, -1.3, 1.2, -1.5) // cool rim
    dir(0xc2410c, 0.5, 1.5, 0.75, -1.4) // warm rim
    dir(0xd3dde8, 0.5, 0.3, -1.0, 0.8) // bounce
    dir(0xffffff, 0.7, -0.4, 0.35, 2.0) // front fill
  }

  function disposeObject(root) {
    const geometries = new Set()
    const materials = new Set()
    const textures = new Set()
    root.traverse((obj) => {
      if (obj.geometry) geometries.add(obj.geometry)
      const list = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
      for (const material of list) {
        materials.add(material)
        for (const key in material) {
          const value = material[key]
          if (value && value.isTexture) textures.add(value)
        }
      }
    })
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
    textures.forEach((t) => t.dispose())
  }

  // ----------------------------------------------------------------- public
  function setStop(name, t = 1) {
    if (state.disposed) return false
    const key = STOP_DEFS[name] ? name : 'hero'
    const blend = Number(t)
    const tt = Number.isFinite(blend) ? clamp(blend, 0, 1) : 1
    if (tt >= 0.9995) {
      state.activeStop = key
      state.fromStop = null
      state.blendT = 1
    } else {
      if (!state.fromStop) state.fromStop = state.activeStop
      state.activeStop = key
      state.blendT = tt
    }
    return true
  }

  function setMode(mode) {
    if (state.disposed) return false
    if (!MODE_TARGETS[mode]) return false
    state.mode = mode
    return true
  }

  function setOrbit(dx, dy) {
    if (state.disposed) return false
    const x = Number(dx)
    const y = Number(dy)
    if (Number.isFinite(x)) state.orbit.az = clamp(state.orbit.az + x, -0.9, 0.9)
    if (Number.isFinite(y)) state.orbit.el = clamp(state.orbit.el + y, -0.45, 0.45)
    return true
  }

  function setPointer(x, y) {
    if (state.disposed) return false
    const nx = Number(x)
    const ny = Number(y)
    if (Number.isFinite(nx)) state.pointer.x = clamp(nx, -1, 1)
    if (Number.isFinite(ny)) state.pointer.y = clamp(ny, -1, 1)
    return true
  }

  const _world = new THREE.Vector3()
  const _view = new THREE.Vector3()
  const _projMatrix = new THREE.Matrix4()

  function projectAnchor(name) {
    const result = { x: 0, y: 0, visible: false }
    if (!state.arm || !state.camera || state.disposed) return result
    const key = state.anchors[name] ? name : null
    if (!key) return result
    anchorWorld(key, _world)
    _view.copy(_world).applyMatrix4(state.camera.matrixWorldInverse)
    if (_view.z >= -state.camera.near) return result // behind the camera
    _world.project(state.camera)
    if (_world.z < -1 || _world.z > 1) return result
    result.x = (_world.x * 0.5 + 0.5) * state.width
    result.y = (1 - (_world.y * 0.5 + 0.5)) * state.height
    result.visible = _world.x >= -1 && _world.x <= 1 && _world.y >= -1 && _world.y <= 1
    return result
  }

  function dispose() {
    if (state.disposed) return
    state.disposed = true
    if (state.renderer && state.renderer.setAnimationLoop) state.renderer.setAnimationLoop(null)
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
    if (state.pointsTexture) {
      state.pointsTexture.dispose()
      state.pointsTexture = null
    }
    for (const material of state.edgeMaterials) material.dispose()
    state.edgeMaterials = []
    for (const object of state.edgeObjects) {
      if (object.geometry) object.geometry.dispose()
    }
    state.edgeObjects = []
    if (state.scan.line) {
      if (state.scan.line.geometry) state.scan.line.geometry.dispose()
      if (state.scan.line.material) state.scan.line.material.dispose()
      state.scan.line = null
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
    state.pointsMaterial = null
    state.pointsObjects = []
    state.camera = null
    state.scene = null
    state.renderer = null
  }

  // ------------------------------------------------------------ x-ray scan

  function buildScanRing() {
    if (!state.arm || !state.scan || state.scan.line) return
    const b = state.bounds
    if (!Number.isFinite(b.min.x) || !Number.isFinite(b.max.x)) return
    const ring = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(b.min.x - 0.03, 0, b.min.z - 0.03),
      new THREE.Vector3(b.max.x + 0.03, 0, b.min.z - 0.03),
      new THREE.Vector3(b.max.x + 0.03, 0, b.max.z + 0.03),
      new THREE.Vector3(b.min.x - 0.03, 0, b.max.z + 0.03)
    ])
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x8f3a22,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      depthWrite: false
    })
    const line = new THREE.LineLoop(ring, ringMat)
    line.renderOrder = 6
    line.visible = false
    line.frustumCulled = false
    state.arm.root.add(line)
    state.scan.line = line
  }

  function applyScanPlane() {
    if (!state.scan.plane) return
    const b = state.bounds
    const range = Math.max(1e-4, b.max.y - b.min.y)
    const y = b.max.y - state.scan.value * range
    state.scan.plane.constant = -y
    if (state.scan.line) {
      state.scan.line.position.y = y
      state.scan.line.visible = state.scan.on
    }
    const planes = state.scan.on ? [state.scan.plane] : null
    if (state.materials) {
      for (const material of state.materials.values()) {
        const current = material.clippingPlanes
        const count = current ? current.length : 0
        if (count !== (planes ? planes.length : 0)) {
          material.clippingPlanes = planes
          material.needsUpdate = true
        }
      }
    }
    for (const material of state.edgeMaterials) {
      const current = material.clippingPlanes
      const count = current ? current.length : 0
      if (count !== (planes ? planes.length : 0)) {
        material.clippingPlanes = planes
        material.needsUpdate = true
      }
    }
  }

  function setScan(value) {
    if (state.disposed) return false
    if (value === null || value === undefined) {
      state.scan.on = false
      state.scan.value = 1
      applyScanPlane()
      return true
    }
    const v = Number(value)
    if (!Number.isFinite(v)) return false
    state.scan.value = clamp(v, 0, 1)
    state.scan.on = state.scan.value < 0.998
    applyScanPlane()
    return true
  }

  // Screen-space y (CSS px) of the scan plane right now, so the page can draw a
  // hairline exactly on the cut. Returns null when the scanner is off.
  const _scanWorld = new THREE.Vector3()
  function scanScreenY() {
    if (!state.arm || !state.camera || !state.scan.on) return null
    const b = state.bounds
    const range = Math.max(1e-4, b.max.y - b.min.y)
    const y = b.max.y - state.scan.value * range
    _scanWorld.set(0, y, 0)
    state.arm.root.localToWorld(_scanWorld)
    _scanWorld.project(state.camera)
    return ((1 - _scanWorld.y) / 2) * state.height
  }

  const CLOSEUP_ANCHORS = new Set(['base', 'shoulder', 'elbow', 'wrist', 'tip'])

  function setCloseUp(name, amount) {
    if (state.disposed) return false
    const a = Number(amount)
    if (!Number.isFinite(a)) return false
    if (name && CLOSEUP_ANCHORS.has(name)) state.closeup.anchor = name
    state.closeup.amount = clamp(a, 0, 1)
    return true
  }

  const api = {
    ready,
    setStop,
    setMode,
    setScan,
    setCloseUp,
    scanScreenY,
    setOrbit,
    setPointer,
    projectAnchor,
    resize,
    dispose,
    // Non-contract QA escape hatch: live state + entry-reveal freeze hook.
    debug() {
      const times = state.frameTimes
      const count = Math.min(state.frameCount, times.length)
      let sum = 0
      let max = 0
      for (let i = 0; i < count; i++) {
        sum += times[i]
        if (times[i] > max) max = times[i]
      }
      return {
        loaded: state.loaded,
        disposed: state.disposed,
        stop: state.activeStop,
        fromStop: state.fromStop,
        blendT: state.blendT,
        mode: state.mode,
        entryRaw: state.entryRaw,
        entryDone: state.entryDone,
        frame: {
          samples: count,
          avgMs: count ? sum / count : 0,
          maxMs: max,
          fps: count && sum > 0 ? (count * 1000) / sum : 0
        },
        camera: state.camera
          ? {
              position: state.camera.position.toArray(),
              target: state.live.lookTarget.toArray(),
              baseTarget: state.live.target.toArray(),
              fov: state.camera.fov,
              aspect: state.camera.aspect,
              distance: state.live.dist,
              az: state.live.az + state.orbit.liveAz,
              el: state.live.el + state.orbit.liveEl
            }
          : null,
        orbit: { az: state.orbit.az, el: state.orbit.el },
        pointCount: state.pointsObjects.reduce((n, o) => n + o.geometry.attributes.position.count, 0),
        primitiveCount: state.arm ? state.arm.meshes.length : 0,
        bounds: state.bounds.isEmpty() ? null : { min: state.bounds.min.toArray(), max: state.bounds.max.toArray() },
        fill: { x: state.live.fillX, y: state.live.fillY, samples: state.sampleCount },
        materialOpacity: {
          mesh: state.materials && state.materials.size
            ? state.materials.values().next().value.opacity
            : 0,
          points: state.pointsMaterial ? state.pointsMaterial.opacity : 0
        },
        /** QA only: actual NDC extent of the silhouette samples in the live frame. */
        projectedExtent() {
          if (!state.camera || !state.samplesWorld.length) return null
          const samples = state.samplesWorld
          const view = state.camera.matrixWorldInverse
          const projection = state.camera.projectionMatrix
          const m = _projMatrix.multiplyMatrices(projection, view)
          let minX = Infinity
          let maxX = -Infinity
          let minY = Infinity
          let maxY = -Infinity
          let minZ = Infinity
          let maxZ = -Infinity
          for (let i = 0; i < samples.length; i += 3) {
            const x = samples[i]
            const y = samples[i + 1]
            const z = samples[i + 2]
            const w = m.elements[3] * x + m.elements[7] * y + m.elements[11] * z + m.elements[15]
            if (w === 0) continue
            const nx = (m.elements[0] * x + m.elements[4] * y + m.elements[8] * z + m.elements[12]) / w
            const ny = (m.elements[1] * x + m.elements[5] * y + m.elements[9] * z + m.elements[13]) / w
            const nz = (m.elements[2] * x + m.elements[6] * y + m.elements[10] * z + m.elements[14]) / w
            if (nx < minX) minX = nx
            if (nx > maxX) maxX = nx
            if (ny < minY) minY = ny
            if (ny > maxY) maxY = ny
            if (nz < minZ) minZ = nz
            if (nz > maxZ) maxZ = nz
          }
          return { minX, maxX, minY, maxY, minZ, maxZ }
        },
        render: state.renderer
          ? {
              calls: state.renderer.info.render.calls,
              triangles: state.renderer.info.render.triangles,
              points: state.renderer.info.render.points,
              frames: state.renderedFrames
            }
          : null,
        /** Freeze the entry reveal at a 0..1 progress (QA only, pass null to resume). */
        setEntryProgress(value) {
          if (value == null) {
            state.entryFrozen = null
            return
          }
          state.entryFrozen = clamp(Number(value) || 0, 0, 1)
          state.entryRaw = state.entryFrozen
          state.entryDone = state.entryRaw >= 1
          state.uniforms.uProgress.value = easeOutCubic(state.entryRaw)
        }
      }
    }
  }

  // ------------------------------------------------------------- bootstrap
  try {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('createArmScene: a canvas element is required')
    }
    if (typeof window === 'undefined') {
      throw new Error('createArmScene: browser environment required')
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false
    })
    state.renderer = renderer
    renderer.localClippingEnabled = true
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = false

    const scene = new THREE.Scene()
    scene.background = null // the page's paper shows through
    state.scene = scene

    const camera = new THREE.PerspectiveCamera(34, 1, NEAR, FAR)
    camera.position.set(1.4, 0.6, 2.4)
    state.camera = camera

    createLights()
    buildEnvironment()

    state.pointsTexture = makeDiscTexture()
    state.pointsMaterial = createPointsMaterial(state.uniforms, state.pointsTexture, 0.001)
    state.pointsMaterial.opacity = 0

    // interaction listeners
    canvas.style.touchAction = 'pan-y'
    canvas.style.display = canvas.style.display || 'block'
    canvas.style.userSelect = 'none'
    canvas.style.webkitUserSelect = 'none'
    addListener(canvas, 'webglcontextlost', onContextLost, false)
    addListener(canvas, 'webglcontextrestored', onContextRestored, false)
    addListener(window, 'resize', resize)
    addListener(document, 'visibilitychange', () => {
      state.lastFrameTime = 0
    })
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => resize())
      observer.observe(canvas)
      state.observers.push(observer)
    }
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          state.visible = !!(entry && entry.isIntersecting)
          if (state.visible) state.lastFrameTime = 0
        },
        { threshold: 0 }
      )
      observer.observe(canvas)
      state.observers.push(observer)
    }

    resize()
    void load()
  } catch (err) {
    // Renderer / environment failure: stay transparent and let `ready` reject.
    console.error('[arm-scene] initialisation failed', err)
    fail(err)
  }

  async function load() {
    try {
      const arm = await loadArm(settings.modelUrl)
      if (state.disposed) return
      state.arm = arm
      state.materials = installMaterials(arm.meshes)
      const edges = buildEdges(arm)
      state.edgeMaterials = edges.materials
      state.edgeObjects = edges.objects
      state.scene.add(arm.root)
      // scan slice: a clip plane plus a thin line around the model at the slice
      state.scan.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      state.loaded = true

      // Initial pose + grounded measurements (silhouette samples first).
      buildFitSamples()
      updateMeasurements()

      // Sample the point cloud in the rest pose; points are parented to the
      // animated nodes, so they follow the joints afterwards.
      const scatterRadius = Math.max(0.08, state.radius * 1.35)
      const cloud = buildPoints(arm, state.pointsMaterial, scatterRadius)
      state.pointsObjects = cloud.objects
      // Point size scales with the object, so the stipple reads identically at
      // every stop / viewport size. World units, size-attenuated.
      state.pointsMaterial.size = Math.max(0.0015, state.radius * 0.019)
      state.pointsMaterial.needsUpdate = true

      snapToDesired()

      // Entry reveal: points start scattered, assemble over ~2.2 s.
      if (settings.reducedMotion) {
        state.entryStart = -ENTRY_MS * 2
        state.entryRaw = 1
        state.entryDone = true
        state.uniforms.uProgress.value = 1
      } else {
        state.entryStart = performance.now()
        state.entryRaw = 0
        state.entryDone = false
        state.uniforms.uProgress.value = 0
      }
      state.modeLive.mesh = settings.reducedMotion ? state.modeLive.mesh : 0
      state.modeLive.points = settings.reducedMotion ? state.modeLive.points : 0
      applyMaterialState(0, settings.reducedMotion ? 0 : 0.92)
      state.renderer.render(state.scene, state.camera) // guaranteed first frame
      state.renderedFrames++

      state.lastFrameTime = 0
      state.renderer.setAnimationLoop(frame)
      settled = true
      resolveReady()
    } catch (err) {
      console.error('[arm-scene] could not load', settings.modelUrl, err)
      fail(err)
    }
  }

  return api
}
