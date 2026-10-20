// ============================================================================
// process-stage.js — the 3D stage for the process page.
//
// Three states on one canvas:
//   ring    — the A1 mini and the five motor drive units ride an indexing
//             turret: a tilted orbit drawn like a drawing sheet (rail, degree
//             dial, centre lines). The turret spins up out of its hub, then
//             steps one station at a time with real inertia — overshoot,
//             settle, parts leaning out and leaving speed lines on the fast
//             moves — and presents whichever part reaches the front.
//             Everything sits in real 3D, so the front items pass in front of
//             the ones behind.
//   printer — step 01: the printer alone, in its own framing.
//   motors  — step 02: three motor types (big / shoulder-lift / small) hover in
//             the free half of the screen, each with its own orientation + depth.
//
// Every hand-off is scrubbed by the scroll (setTrack), never run on a timer:
//   hero → 01  the turret holds still, the balloons clear, the other parts
//              shrink away where they are, the dial rewinds, and the printer —
//              wherever it sits on the ring — enlarges straight into its
//              step-01 framing as the eye swings round.
//   01 → 02    the printer rises out with step 01's copy while the motors come
//              up with step 02's, in parallax, turning into place.
// Scroll back and each one plays in reverse.
//
// PUBLIC API
//   const stage = await createProcessStage(canvas, {
//     printerUrl, motorsUrl, reducedMotion, phone, onLoadProgress, onFrame
//   })
//   stage.ready                     model loaded + first frame drawn
//   stage.play()                    run the turret's spin-up (call when the
//                                   curtain lifts; until then the hub is empty)
//   stage.setStage('ring'|'printer'|'motors'|'off')
//                                   which act owns the screen (bookkeeping only:
//                                   the motion comes from setTrack)
//   stage.setPointer(x, y)          pointer -1..1 for a little parallax
//   stage.pick(x, y)                ring part id under a client point, or null
//   stage.grab(x, y) / drag(x) / release()
//                                   spin the turret by hand; release() returns
//                                   the part id when it was a click, not a drag
//   stage.present(id)               index the turret until that part is in front
//   stage.setTrack(printer, motors) where each step's act sits, in viewports
//                                   from the top of the screen (0 = its act at
//                                   the top, 1 = scrolled a viewport past it)
//   onFrame(hud)                    per-frame screen data for the part balloons
//   stage.setVisible(bool)          pause drawing
//   stage.resize()
//   stage.dispose()
//   stage.debug()                   non-contract QA readout
// ============================================================================
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const FOV = 30
const NEAR = 0.01
const FAR = 60
const MAX_DPR = 2
const TAU = Math.PI * 2
const TAN_HALF = Math.tan((FOV * Math.PI) / 360)
const UP = new THREE.Vector3(0, 1, 0)

// The turret: a spring drives the ring angle toward a target that is itself
// eased from station to station, so each index starts smoothly and lands with
// a small mechanical overshoot.
const TURRET = {
  stiffness: 42,
  damping: 8.2, // ζ ≈ 0.63 → ~6% overshoot on a station step
  move: 0.5, // s the target takes to travel one station
  dwell: 2.1, // s each part is presented
  dwellAfterHand: 4.2, // s of rest after the visitor has spun it
  friction: 1.5, // 1/s while coasting after a flick
  snapVel: 1.6, // rad/s below which a coasting turret picks its station
}

// The hero → step 01 hand-off, scrubbed by the scroll: `hand` runs 0 → 1 while
// step 01's act climbs from `from` to `to` viewports below the top of the
// screen. Each beat is a slice of it, overlapping so the motion never stalls.
const HANDOFF = {
  from: -0.86,
  to: -0.1,
  balloons: [0, 0.14], // the balloons and the name tag clear first
  recede: [0.04, 0.46], // the other parts shrink away where they are, J1 first …
  recedeStagger: 0.04, // … J5 last
  undraw: [0.06, 0.55], // the dial rewinds into the front station
  ring: [0.04, 0.65], // haze and shadow go with it
  out: [0.02, 0.96], // the printer enlarges straight into its step-01 framing
  camera: [0.06, 1], // and the eye swings round to the printer's view
}

// The printer's existing framings (az/el radians; fill = viewport share;
// x/y = screen offset as a fraction of the viewport).
const PRINTER_PRESETS = {
  hero: { az: 1.34, el: 0.09, fillX: 0.5, fillY: 0.5, x: 0.195, y: -0.01 },
  step: { az: 1.22, el: 0.07, fillX: 0.52, fillY: 0.54, x: 0.2, y: -0.02 },
  phone: { az: 1.26, el: 0.08, fillX: 0.66, fillY: 0.38, x: 0.0, y: -0.13 },
}

// Ring composition: cx/cy = ring centre as a viewport fraction,
// radius/item = world size as a fraction of the viewport width, present = how
// much the part at the front station grows, pitch/roll = the dial plane's tilt.
const RING_VIEW = {
  desktop: { az: 0.06, el: 0.3, dist: 2.8, fov: 38, cx: 0.215, cy: 0.07, radius: 0.19, item: 0.122, present: 1.5, pitch: 0.2, roll: 0.15 },
  phone: { az: 0.05, el: 0.36, dist: 2.2, fov: 38, cx: 0.0, cy: 0.1, radius: 0.37, item: 0.25, present: 1.45, pitch: 0.24, roll: 0.08 },
}
// per-part trim on the turret: scale, resting yaw on the platter, and the
// extra turn it makes to show its best face while it is presented
const RING_TRIM = {
  printer: { scale: 0.78, yaw: 0.0, show: -0.62 },
  'motor-J1': { scale: 1, yaw: 0.18, show: 0.55 },
  'motor-J2': { scale: 1, yaw: -0.2, show: 0.6 },
  'motor-J3': { scale: 0.92, yaw: 0.22, show: 0.5 },
  'motor-J4': { scale: 0.92, yaw: -0.16, show: 0.55 },
  'motor-J5': { scale: 0.92, yaw: 0.12, show: 0.5 },
}
// each ring item bobs on its own spot instead of pinwheeling on its axis
const RING_HOVER = { ampX: 0.006, ampY: 0.01, ampZ: 0.006 }

// The spin-up when the curtain lifts (seconds): the rail draws itself, the
// dial ticks sweep in, the parts unfurl out of the hub while the turret winds
// down from a turn and a quarter into the first station.
const INTRO = { spin: 2.5, turns: 1.25, rail: 1.35, ticks: [0.15, 1.5], partsAt: 0.18, partStagger: 0.085, partDur: 1.15, hud: [1.9, 0.7] }

// The dial is drawn in drawing-sheet ink, not lit like the parts.
const INK = 0x101214
const SIGNAL = 0xb23e22
const PAPER = 0xf6f6f4

// Step 02: three motor types floating in the free half of the screen.
// sx/sy are viewport fractions from the centre, depth pushes toward the camera,
// size is the max dimension as a fraction of the viewport width, rot is the
// resting orientation as it was tuned under a camera at HOVER_TUNED.az (step 02
// now shares the printer's camera, so rot is turned by the difference).
// travel = viewports moved per viewport of scroll (nearer parts travel further,
// so they arrive in parallax); turn = extra rotation per viewport of travel, so
// each part turns into its resting pose as it arrives and on out as it leaves.
const HOVER_TUNED = { desktop: { az: 0.12 }, phone: { az: 0.1 } }
const HOVER_ITEMS = {
  desktop: [
    { node: 'motor-J1', sx: 0.27, sy: 0.03, depth: 0.18, size: 0.215, rot: [0.08, 0.62, -0.05], phase: 0.0, amp: [0.008, 0.011], travel: 1.12, turn: [0.22, -0.7, 0.1] },
    { node: 'motor-J2', sx: 0.01, sy: 0.2, depth: 0.0, size: 0.195, rot: [0.3, -0.5, 0.14], phase: 1.9, amp: [0.007, 0.01], travel: 0.92, turn: [-0.26, 0.55, -0.14] },
    { node: 'motor-J3', sx: 0.125, sy: -0.155, depth: 0.28, size: 0.17, rot: [-0.26, 0.85, -0.3], phase: 3.4, amp: [0.008, 0.01], travel: 1.3, turn: [0.36, -0.9, 0.24] },
  ],
  phone: [
    { node: 'motor-J1', sx: 0.17, sy: 0.05, depth: 0.15, size: 0.29, rot: [0.08, 0.62, -0.05], phase: 0.0, amp: [0.008, 0.011], travel: 1.12, turn: [0.22, -0.7, 0.1] },
    { node: 'motor-J2', sx: 0.01, sy: 0.2, depth: 0.0, size: 0.3, rot: [0.3, -0.5, 0.14], phase: 1.9, amp: [0.007, 0.01], travel: 0.92, turn: [-0.26, 0.55, -0.14] },
    { node: 'motor-J3', sx: -0.12, sy: -0.02, depth: 0.22, size: 0.21, rot: [-0.26, 0.85, -0.3], phase: 3.4, amp: [0.008, 0.01], travel: 1.3, turn: [0.36, -0.9, 0.24] },
  ],
}
// The printer on the same track: it rises out with step 01's copy, tipping back
// and turning away as it goes. smooth = how closely the objects follow the
// scroll (1/s) — a touch of lag reads as weight.
const TRACK = { printerTravel: 1.08, printerTurn: [0.16, -0.55, 0.0], smooth: 9, hideBeyond: 1.7 }

const MOTOR_NAMES = ['motor-J1', 'motor-J2', 'motor-J3', 'motor-J4', 'motor-J5']
// The turret steps forward (angle increasing), and the part at ring index i is
// in front when angle ≡ -i·step — so the motors sit in reverse to be presented
// printer, J1, J2 … J5: the order the build happened in.
const RING_ORDER = ['printer', 'motor-J5', 'motor-J4', 'motor-J3', 'motor-J2', 'motor-J1']
const HOVER_TYPES = new Set(['motor-J1', 'motor-J2', 'motor-J3'])

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4)
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const ease = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt))
const wrapPi = (a) => a - TAU * Math.round(a / TAU)

// ------------------------------------------------------------ dial drawing
class RingCurve extends THREE.Curve {
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * TAU
    return target.set(Math.sin(a), 0, Math.cos(a))
  }
}

const RAIL_SEGMENTS = 384
const RAIL_SIDES = 6
const TICKS = 120

function inkMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    fog: true,
  })
}

/** Long-dash / short-dash centre line along one axis of the dial plane. */
function chainLine(axis, from, to, out) {
  const pattern = [0.15, 0.035, 0.022, 0.035] // dash, gap, dot, gap
  let t = from
  let k = 0
  while (t < to) {
    const len = pattern[k % 4]
    const end = Math.min(to, t + len)
    if (k % 2 === 0) {
      if (axis === 'x') out.push(t, 0, 0, end, 0, 0)
      else out.push(0, 0, t, 0, 0, end)
    }
    t = end
    k++
  }
}

// Speed lines: three lanes of thin ribbon that trail each part along the rail
// while the turret moves fast. Built once; the vertex shader bends them onto
// the arc behind the part from a handful of uniforms, so no per-frame buffers.
const TRAIL_SEGMENTS = 56
function makeTrailGeometry() {
  const lanes = [-1, 0, 1]
  const count = lanes.length * (TRAIL_SEGMENTS + 1) * 2
  const aU = new Float32Array(count)
  const aSide = new Float32Array(count)
  const aLane = new Float32Array(count)
  const index = []
  let v = 0
  for (const lane of lanes) {
    const base = v
    for (let s = 0; s <= TRAIL_SEGMENTS; s++) {
      for (const side of [-1, 1]) {
        aU[v] = s / TRAIL_SEGMENTS
        aSide[v] = side
        aLane[v] = lane
        v++
      }
    }
    for (let s = 0; s < TRAIL_SEGMENTS; s++) {
      const a = base + s * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
  geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1))
  geo.setAttribute('aLane', new THREE.BufferAttribute(aLane, 1))
  geo.setIndex(index)
  return geo
}

function makeTrailMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uAngle: { value: 0 },
      uLen: { value: 0 },
      uRadius: { value: 1 },
      uLift: { value: 0 },
      uGap: { value: 0.05 },
      uWidth: { value: 0.003 },
      uAlpha: { value: 0 },
      // already in display space: the shader writes it straight out
      uColor: { value: new THREE.Vector3(0.063, 0.071, 0.078) },
    },
    vertexShader: /* glsl */ `
      attribute float aU;
      attribute float aSide;
      attribute float aLane;
      uniform float uAngle;
      uniform float uLen;
      uniform float uRadius;
      uniform float uLift;
      uniform float uGap;
      uniform float uWidth;
      varying float vU;
      varying float vLane;
      void main() {
        // the outer lanes are shorter, so the wake tapers like a brush stroke
        float lane = abs(aLane);
        float a = uAngle - uLen * aU * (1.0 - 0.28 * lane);
        float y = uLift + aLane * uGap + aSide * uWidth * (1.0 - 0.6 * aU);
        vec3 p = vec3(sin(a) * uRadius, y, cos(a) * uRadius);
        vU = aU;
        vLane = aLane;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying float vU;
      varying float vLane;
      void main() {
        float a = pow(1.0 - vU, 0.85) * smoothstep(0.0, 0.05, vU) * (1.0 - 0.25 * abs(vLane));
        gl_FragColor = vec4(uColor, a * uAlpha);
      }
    `,
  })
}

export async function createProcessStage(canvas, opts = {}) {
  const settings = {
    printerUrl: typeof opts.printerUrl === 'string' ? opts.printerUrl : '',
    motorsUrl: typeof opts.motorsUrl === 'string' ? opts.motorsUrl : '',
    reducedMotion: opts.reducedMotion === true,
    phone: opts.phone === true,
    onLoadProgress: typeof opts.onLoadProgress === 'function' ? opts.onLoadProgress : null,
    onFrame: typeof opts.onFrame === 'function' ? opts.onFrame : null,
  }
  if (!settings.printerUrl || !settings.motorsUrl) throw new Error('createProcessStage: model urls required')
  const mode = () => (settings.phone ? 'phone' : 'desktop')

  const state = {
    disposed: false,
    visible: true,
    loaded: false,
    frames: 0,
    width: 1,
    height: 1,
    dpr: 1,
    stage: 'ring',
    appliedStage: 'ring',
    hand: 0, // hero → step 01 progress, from the scroll
    // the angle the turret was held at when the hand-off began
    scrub: { active: false, from: 0 },
    cameraSnap: false,
    ringAngle: 0,
    // derived from the scroll every frame (kept on state for debug())
    ringAlpha: 1,
    motorsAlpha: 0, // 1 = the step-02 motors are on the scroll track
    out: 0,
    time: 0,
    hoverTime: 0,
    // the spin-up: held at 0 until play(), done once it has run its course
    intro: { t: 0, playing: false, done: settings.reducedMotion },
    // turret physics: angle/vel are the ring; target is where the spring pulls
    spin: {
      angle: 0,
      vel: 0,
      target: 0,
      from: 0,
      to: 0,
      moveT: 1,
      mode: 'index', // 'index' | 'drag' | 'free'
      next: 0, // state.time of the next automatic index
      drag: null,
    },
    // where steps 01/02 sit on the page (viewports past their act's top), as
    // reported by the page and as eased toward by the objects
    track: { printer: -1, motors: -2, set: false },
    trackLive: { printer: -1, motors: -2 },
    angVel: 0, // measured ring speed, whatever drove it (spring, hand, exit)
    lastAngle: 0,
    present: new Array(6).fill(0),
    itemFade: new Array(6).fill(1),
    printerFade: 1,
    textRects: [],
    camera: null,
    pointer: { x: 0, y: 0, liveX: 0, liveY: 0 },
    observers: [],
  }
  let pendingStage = null
  // turret bookkeeping and per-frame scratch (declared before the first pose)
  const STEP = TAU / RING_ORDER.length
  const spin = state.spin
  const nearestStation = (angle) => Math.round(angle / STEP) * STEP
  /** Ring index of the part at the front station for a ring angle. */
  const frontIndex = (angle) => ((-Math.round(angle / STEP) % RING_ORDER.length) + RING_ORDER.length) % RING_ORDER.length
  const _dialEuler = new THREE.Euler(0, 0, 0, 'ZYX')
  const _dialQuat = new THREE.Quaternion()
  const _halfQuat = new THREE.Quaternion()
  const _q = new THREE.Quaternion()
  const _qLean = new THREE.Quaternion()
  const _qYaw = new THREE.Quaternion()
  const _euler = new THREE.Euler()
  const _v = new THREE.Vector3()
  const _tangent = new THREE.Vector3()
  const _proj = new THREE.Vector3()
  const IDENTITY = new THREE.Quaternion()
  const hudFrame = { alpha: 0, time: 0, front: null, settled: 0, items: [] }

  const _scratchRect = { l: 0, r: 0, t: 0, b: 0 }
  const _box = new THREE.Box3()
  const _corner = new THREE.Vector3()

  /* ------------------------------------------------------------- renderer */
  let renderer
  let scene
  let camera
  let envRT = null
  let shadowCatcher = null
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    scene = new THREE.Scene()
    // paper-coloured depth haze: the far side of the turret recedes into the
    // sheet. Pushed out of reach whenever the ring is not on stage.
    scene.fog = new THREE.Fog(PAPER, 100, 101)
    camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR)
    const pmrem = new THREE.PMREMGenerator(renderer)
    envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envRT.texture
    scene.environmentIntensity = 0.95
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe6edf5, 1.05))
    const key = new THREE.DirectionalLight(0xfff6ec, 3.1)
    key.position.set(1.1, 3.0, 1.3)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -2.6
    key.shadow.camera.right = 2.6
    key.shadow.camera.top = 2.6
    key.shadow.camera.bottom = -2.6
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 9
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.015
    key.shadow.radius = 2
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x9fc4e8, 0.9)
    fill.position.set(-2.0, 1.0, 1.2)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0x0a7194, 1.1)
    rim.position.set(-1.6, 1.5, -1.8)
    scene.add(rim)

    // a soft paper shadow to ground the floating objects
    shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.ShadowMaterial({ color: 0x0b1b2f, opacity: 0.12, transparent: true, depthWrite: false }),
    )
    shadowCatcher.rotation.x = -Math.PI / 2
    shadowCatcher.position.y = -0.34
    shadowCatcher.receiveShadow = true
    shadowCatcher.visible = !settings.phone
    scene.add(shadowCatcher)
  } catch (err) {
    console.error('[process-stage] renderer failed', err)
    return null
  }

  /* --------------------------------------------------------------- resize */
  function measure() {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || (parent ? parent.clientWidth : 0) || window.innerWidth
    const h = canvas.clientHeight || (parent ? parent.clientHeight : 0) || window.innerHeight
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
  }
  function resize() {
    if (!renderer || state.disposed) return
    const { w, h } = measure()
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    if (w === state.width && h === state.height && dpr === state.dpr) return
    state.width = w
    state.height = h
    state.dpr = dpr
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  addEventListener('resize', resize)
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    state.observers.push(ro)
  }

  /* --------------------------------------------------------- camera basis */
  function makeBasis(cam) {
    const dir = new THREE.Vector3(
      Math.sin(cam.az) * Math.cos(cam.el),
      Math.sin(cam.el),
      Math.cos(cam.az) * Math.cos(cam.el),
    ).normalize()
    const target = new THREE.Vector3(cam.tx || 0, cam.ty || 0, cam.tz || 0)
    const right = new THREE.Vector3().crossVectors(UP, dir).normalize()
    const up = new THREE.Vector3().crossVectors(dir, right).normalize()
    const viewH = 2 * cam.dist * Math.tan(((cam.fov || FOV) * Math.PI) / 360)
    const viewW = viewH * (state.width / state.height)
    return {
      cam,
      dir,
      right,
      up,
      target,
      viewW,
      viewH,
      cameraPos: target.clone().addScaledVector(dir, cam.dist),
    }
  }

  function pointOn(basis, fracX, fracY, depth) {
    // fracX/fracY are fractions of the whole viewport measured from its centre;
    // depth is a fraction of the viewport height toward the camera.
    return basis.target
      .clone()
      .addScaledVector(basis.right, fracX * basis.viewW)
      .addScaledVector(basis.up, fracY * basis.viewH)
      .addScaledVector(basis.dir, -depth * basis.viewH)
  }

  // tight, glyph-level text boxes so items ghost out only where actual type is
  const _textRoots = ['.act--hero', '.chrome', '.progress']
  function refreshTextRects() {
    if (!state.loaded) return
    const rects = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    // gather visible text nodes that live inside one of the text roots
    const roots = [...document.querySelectorAll(_textRoots.join(','))]
    let node
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue
      let parent = node.parentElement
      if (!parent || !roots.some((r) => r.contains(parent))) continue
      const style = getComputedStyle(parent)
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) {
        if (r.width < 3 || r.height < 3) continue
        if (r.bottom < -40 || r.top > state.height + 40) continue
        rects.push({ l: r.left - 8, t: r.top - 8, r: r.right + 8, b: r.bottom + 8 })
      }
    }
    state.textRects = rects
  }

  /* ------------------------------------------------------------- cameras */
  function ringCamera() {
    const ring = RING_VIEW[mode()]
    // a slow drift of the eye keeps parallax alive on the dial
    const drift = settings.reducedMotion ? 0 : Math.sin(state.time * 0.11) * 0.045
    return { az: ring.az + drift, el: ring.el, dist: ring.dist, fov: ring.fov, tx: 0, ty: 0, tz: 0 }
  }
  function printerCamera() {
    const preset = settings.phone ? PRINTER_PRESETS.phone : PRINTER_PRESETS.step
    const aspect = state.width / state.height
    const size = printer.size
    const distY = size.y / 2 / (TAN_HALF * preset.fillY)
    const distX = size.x / 2 / (TAN_HALF * aspect * preset.fillX)
    return { az: preset.az, el: preset.el, dist: Math.max(distY, distX, 0.4), fov: FOV, tx: 0, ty: 0, tz: 0, preset }
  }
  /** The eye follows the hand-off: the ring's view, the printer's, or between. */
  function goalCamera() {
    const k = smooth(HANDOFF.camera[0], HANDOFF.camera[1], state.hand)
    if (k <= 0) return ringCamera()
    if (k >= 1) return printerCamera()
    const a = ringCamera()
    const b = printerCamera()
    const mix = (key) => a[key] + (b[key] - a[key]) * k
    return { az: mix('az'), el: mix('el'), dist: mix('dist'), fov: mix('fov'), tx: 0, ty: 0, tz: 0 }
  }

  /* --------------------------------------------------------------- models */
  let readyResolve
  let readyReject
  let settled = false
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })
  ready.catch(() => {})
  const settle = (fn, arg) => {
    if (settled) return
    settled = true
    try {
      fn(arg)
    } catch {
      /* ignore */
    }
  }

  const printerPivot = new THREE.Group()
  printerPivot.name = 'printer-pivot'
  scene.add(printerPivot)
  const motorPivots = new Map()
  const ringItems = []
  let printer = null

  /* ------------------------------------------------------------ the dial */
  // Everything here is built at unit radius in the dial plane (XZ); the group
  // carries the ring centre, the tilt and the radius each frame.
  const dial = new THREE.Group()
  dial.name = 'dial'
  scene.add(dial)
  const dialParts = (() => {
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new RingCurve(), RAIL_SEGMENTS, 0.0032, RAIL_SIDES, true),
      inkMaterial(INK, 0.5),
    )
    rail.userData.base = 0.5
    dial.add(rail)

    // degree dial outside the rail: every 3°, longer every 15° and 30°
    const tickGeo = new THREE.BoxGeometry(1, 1, 1)
    const ticks = new THREE.InstancedMesh(tickGeo, inkMaterial(INK, 0.34), TICKS)
    ticks.userData.base = 0.34
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    const sc = new THREE.Vector3()
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * TAU
      const len = i % 10 === 0 ? 0.085 : i % 5 === 0 ? 0.05 : 0.026
      const r0 = 1.075
      q.setFromAxisAngle(UP, a)
      p.set(Math.sin(a) * (r0 + len / 2), 0, Math.cos(a) * (r0 + len / 2))
      sc.set(i % 10 === 0 ? 0.0062 : 0.0042, 0.0042, len)
      ticks.setMatrixAt(i, m.compose(p, q, sc))
    }
    ticks.instanceMatrix.needsUpdate = true
    ticks.frustumCulled = false
    dial.add(ticks)

    // centre lines and a dashed pitch circle, in hairline
    const chain = []
    chainLine('x', -1.3, 1.3, chain)
    chainLine('z', -1.3, 1.3, chain)
    const dashes = []
    const DASHES = 96
    for (let i = 0; i < DASHES; i++) {
      const a0 = (i / DASHES) * TAU
      const a1 = a0 + (TAU / DASHES) * 0.55
      dashes.push(Math.sin(a0) * 0.64, 0, Math.cos(a0) * 0.64, Math.sin(a1) * 0.64, 0, Math.cos(a1) * 0.64)
    }
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([...chain, ...dashes], 3))
    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false, fog: true }),
    )
    lines.userData.base = 0.32
    dial.add(lines)

    // the presentation station: a signal-red index mark at the front of the dial
    const mark = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 3), inkMaterial(SIGNAL, 0.95))
    mark.geometry.rotateX(-Math.PI / 2) // point it at the hub
    mark.position.set(0, 0, 1.235)
    mark.userData.base = 0.95
    dial.add(mark)

    // the lock-in ripple: a ring that spreads across the platter under a part
    // the moment it lands on the station
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 4, 128), inkMaterial(INK, 0))
    ripple.geometry.rotateX(Math.PI / 2)
    ripple.position.set(0, 0, 1)
    ripple.visible = false
    dial.add(ripple)

    return { rail, ticks, lines, mark, ripple }
  })()
  const rippleState = { t: 9, armed: false }
  const railIndexCount = dialParts.rail.geometry.index.count
  const trailGeo = makeTrailGeometry()

  function collectMaterials(root) {
    const set = new Set()
    root.traverse((o) => {
      if (!o.isMesh) return
      const list = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of list) set.add(m)
    })
    root.userData.mats = [...set]
  }

  function cloneMaterials(root) {
    root.traverse((o) => {
      if (!o.isMesh) return
      const list = Array.isArray(o.material) ? o.material : [o.material]
      const clones = list.map((m) => {
        const c = m.clone()
        c.userData.baseOpacity = m.opacity
        c.userData.baseTransparent = m.transparent
        return c
      })
      o.material = clones.length === 1 ? clones[0] : clones
    })
  }

  function setAlpha(root, alpha) {
    const a = clamp(alpha, 0, 1)
    for (const m of root.userData.mats) {
      m.opacity = a * (m.userData.baseOpacity == null ? 1 : m.userData.baseOpacity)
      const transparent = a < 0.995 || m.userData.baseTransparent === true
      const depthWrite = a > 0.55
      if (m.transparent !== transparent || m.depthWrite !== depthWrite) {
        m.transparent = transparent
        m.depthWrite = depthWrite
        m.needsUpdate = true
      }
    }
    root.visible = a > 0.004
  }

  let grainTexture = null
  function makeGrainTexture() {
    const size = 256
    const canvas2 = document.createElement('canvas')
    canvas2.width = canvas2.height = size
    const ctx = canvas2.getContext('2d')
    let seed = 7311
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    // cast/machined mottling: a few soft blotches under a fine grain
    ctx.fillStyle = '#cfcfcf'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 46; i++) {
      const x = rand() * size
      const y = rand() * size
      const r = 12 + rand() * 46
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const light = rand() > 0.5
      g.addColorStop(0, light ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    const img = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * 44
      const v = Math.max(120, Math.min(255, img.data[i] + n))
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas2)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = 4
    return tex
  }

  function boxProjectUVs(geometry) {
    if (!geometry || geometry.attributes.uv || !geometry.attributes.position || !geometry.attributes.normal) return
    const pos = geometry.attributes.position
    const nrm = geometry.attributes.normal
    const uv = new Float32Array(pos.count * 2)
    const scale = 9
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const nx = Math.abs(nrm.getX(i))
      const ny = Math.abs(nrm.getY(i))
      const nz = Math.abs(nrm.getZ(i))
      let u, v
      if (nx >= ny && nx >= nz) {
        u = z * scale
        v = y * scale
      } else if (ny >= nx && ny >= nz) {
        u = x * scale
        v = z * scale
      } else {
        u = x * scale
        v = y * scale
      }
      uv[i * 2] = u
      uv[i * 2 + 1] = v
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }

  function prettifyMotorMaterials(root) {
    if (!grainTexture) grainTexture = makeGrainTexture()
    root.traverse((o) => {
      if (!o.isMesh) return
      boxProjectUVs(o.geometry)
      const list = Array.isArray(o.material) ? o.material : [o.material]
      const next = list.map((m) => {
        const name = m.name || ''
        const metal = clamp((m.metalness ?? 0.5) + (name === 'motor' ? 0.12 : 0.1), 0, 1)
        const rough = Math.max(name === 'steel' ? 0.24 : 0.3, (m.roughness ?? 0.5) * 0.95)
        const phys = new THREE.MeshPhysicalMaterial({
          color: m.color.clone(),
          metalness: metal,
          roughness: rough,
          clearcoat: name === 'motor' ? 0.08 : 0.16,
          clearcoatRoughness: name === 'motor' ? 0.6 : 0.42,
          envMapIntensity: 1.2,
          roughnessMap: grainTexture,
          bumpMap: grainTexture,
          bumpScale: name === 'motor' ? 0.00045 : 0.0006,
          side: m.side,
          transparent: false,
        })
        phys.name = name
        phys.userData.baseOpacity = 1
        phys.userData.baseTransparent = false
        return phys
      })
      o.material = next.length === 1 ? next[0] : next
    })
  }

  function castShadows(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }

  function wrapModel(model, { prettify = false } = {}) {
    const holder = new THREE.Group()
    holder.add(model)
    holder.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(holder)
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center) // metres; the holder is unscaled
    holder.updateMatrixWorld(true)
    const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3())
    cloneMaterials(holder)
    if (prettify) prettifyMotorMaterials(holder)
    castShadows(holder)
    collectMaterials(holder)
    return { pivot: holder, size, maxDim: Math.max(size.x, size.y, size.z) || 1 }
  }

  const loader = new GLTFLoader()
  let loadedBytes = 0
  const weight = { printer: 2.68, motors: 1.77 }
  const totalWeight = weight.printer + weight.motors

  try {
    await MeshoptDecoder.ready
    loader.setMeshoptDecoder(MeshoptDecoder)
    const progress = { printer: 0, motors: 0 }
    const note = () => {
      loadedBytes = weight.printer * progress.printer + weight.motors * progress.motors
      settings.onLoadProgress?.(clamp(loadedBytes / totalWeight, 0, 1))
    }
    let printerGltf
    let motorsGltf
    ;[printerGltf, motorsGltf] = await Promise.all([
      new Promise((resolve, reject) => {
        loader.load(
          settings.printerUrl,
          resolve,
          (e) => {
            if (e && e.total) {
              progress.printer = e.loaded / e.total
              note()
            }
          },
          reject,
        )
      }),
      new Promise((resolve, reject) => {
        loader.load(
          settings.motorsUrl,
          resolve,
          (e) => {
            if (e && e.total) {
              progress.motors = e.loaded / e.total
              note()
            }
          },
          reject,
        )
      }),
    ])
    if (state.disposed) return null

    printer = wrapModel(printerGltf.scene)
    printerPivot.add(printer.pivot)
    printer.pivot.name = 'printer'

    const container =
      motorsGltf.scene.children.find(
        (c) => c.children && c.children.some((ch) => ch.name && ch.name.startsWith('motor-')),
      ) || motorsGltf.scene
    const nodes = new Map()
    for (const child of [...container.children]) {
      if (child.name && child.name.startsWith('motor-')) nodes.set(child.name, child)
    }
    for (const name of MOTOR_NAMES) {
      const node = nodes.get(name)
      if (!node) continue
      node.removeFromParent()
      const wrapped = wrapModel(node, { prettify: true })
      wrapped.pivot.name = name
      scene.add(wrapped.pivot)
      motorPivots.set(name, wrapped)
    }

    for (let i = 0; i < RING_ORDER.length; i++) {
      const id = RING_ORDER[i]
      const item = id === 'printer' ? printer : motorPivots.get(id)
      if (!item) continue
      const trail = new THREE.Mesh(trailGeo, makeTrailMaterial())
      trail.frustumCulled = false
      trail.renderOrder = 2
      dial.add(trail)
      ringItems.push({ id, item, index: i, trail, hud: { id, x: 0, y: 0, r: 0, depth: 0, present: 0, alpha: 0 } })
    }

    state.loaded = true
    state.camera = ringCamera()
    update(1 / 60) // pose the ring before the curtain lifts on this frame
    renderer.render(scene, camera)
    state.frames++
    settle(readyResolve)
  } catch (err) {
    console.error('[process-stage] load failed', err)
    settle(readyReject, err)
    return null
  }

  // requested before the model was ready
  if (pendingStage) {
    const p = pendingStage
    pendingStage = null
    applyStage(p)
  }

  /* -------------------------------------------------------------- turret */
  /** Ease the spring's target to an absolute ring angle. */
  function indexTo(angle, dwell = TURRET.dwell) {
    spin.mode = 'index'
    spin.from = spin.target
    spin.to = angle
    spin.moveT = 0
    spin.next = state.time + TURRET.move + dwell
  }

  function settleSpin(angle) {
    spin.angle = spin.target = spin.from = spin.to = angle
    spin.vel = 0
    spin.moveT = 1
    spin.mode = 'index'
    state.lastAngle = angle
  }

  function finishIntro(keepAngle = false) {
    if (state.intro.done) return
    state.intro.done = true
    state.intro.playing = false
    settleSpin(keepAngle ? spin.angle : 0)
    spin.next = state.time + TURRET.dwell
  }

  /** While the hero → 01 hand-off is under way the turret holds still, so the
      printer leaves from wherever it is. */
  function syncScrub(hand) {
    const sc = state.scrub
    if (hand > 0.0005) {
      if (!sc.active) {
        // scrolled during the spin-up: finish it where it is
        finishIntro(true)
        sc.active = true
        sc.from = spin.angle
        settleSpin(sc.from)
      }
      spin.drag = null
    } else if (sc.active) {
      // back on the hero: the turret picks up where the hand-off found it
      sc.active = false
      settleSpin(sc.from)
      indexTo(nearestStation(sc.from))
    }
  }

  function tickTurret(dt) {
    if (state.scrub.active) return
    if (!state.intro.done) {
      const it = state.intro
      if (it.playing) it.t += dt
      const k = clamp(it.t / INTRO.spin, 0, 1)
      spin.angle = -TAU * INTRO.turns * (1 - easeOutQuart(k))
      if (it.t >= INTRO.spin + 0.05) finishIntro()
      return
    }
    if (settings.reducedMotion) return
    const active = state.hand <= 0.0005

    if (spin.mode === 'drag') return // the pointer owns the angle
    if (spin.mode === 'free') {
      spin.vel *= Math.exp(-TURRET.friction * dt)
      spin.angle += spin.vel * dt
      if (Math.abs(spin.vel) < TURRET.snapVel) {
        // carry on to the next station in the direction of travel
        const dir = Math.sign(spin.vel) || 1
        const s = Math.floor(spin.angle / STEP + (dir > 0 ? 1 : 0)) * STEP
        spin.target = spin.angle
        indexTo(s, TURRET.dwellAfterHand)
        spin.moveT = 0.45 // the turret is already moving: skip the slow start
      }
      return
    }

    // index mode: the target travels, the spring follows
    if (spin.moveT < 1) {
      spin.moveT = Math.min(1, spin.moveT + dt / TURRET.move)
      spin.target = spin.from + (spin.to - spin.from) * easeInOut(spin.moveT)
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      const acc = TURRET.stiffness * (spin.target - spin.angle) - TURRET.damping * spin.vel
      spin.vel += acc * h
      spin.angle += spin.vel * h
    }
    if (active && spin.moveT >= 1 && state.time >= spin.next) {
      indexTo(nearestStation(spin.to) + STEP)
    }
  }

  /* ------------------------------------------------------- stage changes */
  function applyStage(next) {
    // bookkeeping only: every hand-off is driven by the scroll (setTrack)
    state.appliedStage = next
    state.stage = next
  }

  /* --------------------------------------------------------------- update */
  const clock = new THREE.Clock()

  const _qFix = new THREE.Quaternion()
  const _qTurn = new THREE.Quaternion()
  const _eTurn = new THREE.Euler()
  function hoverPose(cfg, basis) {
    const depthWorld = cfg.depth * basis.viewH
    const planeDist = Math.max(0.3, state.camera.dist - depthWorld)
    // on the track: below the fold before step 02, above it after
    const shift = clamp(state.trackLive.motors, -TRACK.hideBeyond, TRACK.hideBeyond)
    const pos = pointOn(basis, cfg.sx, cfg.sy + shift * cfg.travel, cfg.depth)
    if (!settings.reducedMotion) {
      const t = state.hoverTime
      pos
        .addScaledVector(basis.right, Math.sin(t * 0.55 + cfg.phase) * cfg.amp[0] * basis.viewW)
        .addScaledVector(basis.up, Math.cos(t * 0.45 + cfg.phase * 1.3) * cfg.amp[1] * basis.viewH)
        .addScaledVector(basis.dir, Math.sin(t * 0.35 + cfg.phase * 0.7) * 0.01 * basis.viewH)
    }
    // rot was tuned under the old step-02 camera; turn it to read the same under
    // the shared one, then add the arrive / leave turn
    const preset = settings.phone ? PRINTER_PRESETS.phone : PRINTER_PRESETS.step
    _qFix.setFromAxisAngle(UP, preset.az - HOVER_TUNED[mode()].az)
    const quat = _qFix.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(cfg.rot[0], cfg.rot[1], cfg.rot[2])))
    if (!settings.reducedMotion && shift !== 0) {
      _eTurn.set(cfg.turn[0] * shift, cfg.turn[1] * shift, cfg.turn[2] * shift)
      quat.multiply(_qTurn.setFromEuler(_eTurn))
    }
    if (!settings.reducedMotion) {
      const wobble = new THREE.Euler(
        Math.sin(state.hoverTime * 0.4 + cfg.phase) * 0.05,
        Math.sin(state.hoverTime * 0.33 + cfg.phase * 1.7) * 0.07,
        Math.cos(state.hoverTime * 0.29 + cfg.phase) * 0.04,
      )
      quat.multiply(new THREE.Quaternion().setFromEuler(wobble))
    }
    const item = motorPivots.get(cfg.node)
    const worldSize = cfg.size * basis.viewW * (planeDist / state.camera.dist)
    return {
      position: pos,
      quaternion: quat,
      scale: worldSize / Math.max(0.0001, item.maxDim),
      gone: Math.abs(shift * cfg.travel) >= TRACK.hideBeyond - 0.05,
    }
  }

  function screenRectFor(object, out) {
    _box.setFromObject(object)
    if (_box.isEmpty()) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < 8; i++) {
      _corner.set(
        i & 1 ? _box.max.x : _box.min.x,
        i & 2 ? _box.max.y : _box.min.y,
        i & 4 ? _box.max.z : _box.min.z,
      ).project(camera)
      const x = (_corner.x * 0.5 + 0.5) * state.width
      const y = (-_corner.y * 0.5 + 0.5) * state.height
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    out.l = minX; out.r = maxX; out.t = minY; out.b = maxY
    return out
  }
  function textOverlap(rect) {
    const area = Math.max(1, (rect.r - rect.l) * (rect.b - rect.t))
    let hit = 0
    for (const t of state.textRects) {
      const w = Math.min(rect.r, t.r) - Math.max(rect.l, t.l)
      const h = Math.min(rect.b, t.b) - Math.max(rect.t, t.t)
      if (w > 0 && h > 0) hit = Math.max(hit, (w * h) / area)
    }
    return hit
  }

  function update(dt) {
    state.time += dt
    state.hoverTime += dt
    state.pointer.liveX = ease(state.pointer.liveX, state.pointer.x, 3.2, dt)
    state.pointer.liveY = ease(state.pointer.liveY, state.pointer.y, 3.2, dt)

    const tl = state.trackLive
    const tr = state.track
    if (settings.reducedMotion) {
      tl.printer = tr.printer
      tl.motors = tr.motors
    } else {
      tl.printer = ease(tl.printer, tr.printer, TRACK.smooth, dt)
      tl.motors = ease(tl.motors, tr.motors, TRACK.smooth, dt)
    }
    // hero → step 01: everything below is a function of this one number
    const hand = smooth(HANDOFF.from, HANDOFF.to, tl.printer)
    state.hand = hand
    syncScrub(hand)
    tickTurret(dt)
    // measured speed drives the lean and the speed lines, whatever moved it
    const measured = dt > 0 ? (spin.angle - state.lastAngle) / dt : 0
    state.angVel = ease(state.angVel, measured, 18, dt)
    state.lastAngle = spin.angle
    const speed = Math.abs(state.angVel)

    // one gentle curve, so the printer starts to grow as soon as the scroll does
    const outK = smooth(HANDOFF.out[0], HANDOFF.out[1], hand)
    const ringVis = 1 - smooth(HANDOFF.ring[0], HANDOFF.ring[1], hand)
    const dialK = 1 - smooth(HANDOFF.undraw[0], HANDOFF.undraw[1], hand)
    state.out = outK
    state.ringAlpha = ringVis
    // the step-02 motors join the scroll track once they have shrunk away
    state.motorsAlpha = hand >= 0.999 ? 1 : 0

    // camera eases toward the framing the hand-off wants (tighter mid-scrub)
    const wantCam = goalCamera()
    if (state.cameraSnap) {
      Object.assign(state.camera, wantCam)
      state.cameraSnap = false
    }
    {
      const rate = settings.reducedMotion ? 1000 : hand > 0 && hand < 1 ? 7 : 3.1
      state.camera.az = ease(state.camera.az, wantCam.az, rate, dt)
      state.camera.el = ease(state.camera.el, wantCam.el, rate, dt)
      state.camera.dist = ease(state.camera.dist, wantCam.dist, rate, dt)
      state.camera.fov = ease(state.camera.fov || FOV, wantCam.fov || FOV, rate, dt)
      state.camera.tx = ease(state.camera.tx, wantCam.tx, rate, dt)
      state.camera.ty = ease(state.camera.ty, wantCam.ty, rate, dt)
    }
    if (Math.abs(camera.fov - state.camera.fov) > 1e-4) {
      camera.fov = state.camera.fov
      camera.updateProjectionMatrix()
    }
    const basis = makeBasis(state.camera)
    camera.position.copy(basis.cameraPos)
    camera.lookAt(basis.target)
    camera.updateMatrixWorld()

    // parallax nudge shared by everything
    const px = state.pointer.liveX * 0.012
    const py = state.pointer.liveY * -0.008

    const rv = RING_VIEW[mode()]
    const ringCenter = pointOn(basis, rv.cx + px, rv.cy + py, 0)
    const ringRadius = rv.radius * basis.viewW
    const ringItemWorld = rv.item * basis.viewW
    const intro = state.intro
    const introT = intro.done ? 99 : intro.t

    // the dial plane tilts toward the pointer like a gimbal
    const breathe = settings.reducedMotion ? 0 : Math.sin(state.time * 0.23) * 0.018
    _dialEuler.set(rv.pitch + breathe + state.pointer.liveY * 0.07, 0, rv.roll - state.pointer.liveX * 0.06, 'ZYX')
    _dialQuat.setFromEuler(_dialEuler)
    // parts ride the platter but only take half its tilt, so they stay upright
    _halfQuat.copy(IDENTITY).slerp(_dialQuat, 0.5)

    const collapse = 0.82 + 0.18 * ringVis
    dial.position.copy(ringCenter)
    dial.quaternion.copy(_dialQuat)
    dial.scale.setScalar(ringRadius * collapse)
    dial.visible = ringVis > 0.004

    // dial drawing: rail draws itself, ticks sweep in, lines and mark follow —
    // and on the way to step 01 it all rewinds into the front station
    const railK = (intro.done ? 1 : easeOutCubic(clamp(introT / INTRO.rail, 0, 1))) * easeInOut(dialK)
    const tickK = (intro.done ? 1 : clamp((introT - INTRO.ticks[0]) / (INTRO.ticks[1] - INTRO.ticks[0]), 0, 1)) * dialK
    const segs = Math.floor(railK * RAIL_SEGMENTS)
    dialParts.rail.geometry.setDrawRange(0, Math.min(railIndexCount, segs * RAIL_SIDES * 6))
    dialParts.ticks.count = Math.floor(easeOutCubic(tickK) * TICKS)
    const lineK = (intro.done ? 1 : smooth(0.5, 1.6, introT)) * dialK
    const markK = (intro.done ? 1 : smooth(1.4, 2.0, introT)) * dialK
    dialParts.rail.material.opacity = dialParts.rail.userData.base * ringVis
    dialParts.ticks.material.opacity = dialParts.ticks.userData.base * ringVis
    dialParts.lines.material.opacity = dialParts.lines.userData.base * ringVis * lineK
    // the index mark shows between parts; a part parked on it covers it
    const parked = Math.max(...state.present)
    dialParts.mark.material.opacity = dialParts.mark.userData.base * ringVis * markK * (1 - smooth(0.5, 0.95, parked))
    dialParts.ticks.visible = dialParts.ticks.count > 0

    // lock-in: arm on a real move, fire when the turret comes to rest on a station
    if (speed > 1.2) rippleState.armed = true
    if (rippleState.armed && speed < 0.35 && intro.done && hand <= 0.0005) {
      rippleState.armed = false
      rippleState.t = 0
    }
    rippleState.t += dt
    const rk = clamp(rippleState.t / 1.1, 0, 1)
    const ripple = dialParts.ripple
    ripple.visible = rk < 1 && !settings.reducedMotion && hand <= 0.0005
    if (ripple.visible) {
      ripple.scale.setScalar(0.06 + 0.34 * easeOutCubic(rk))
      ripple.material.opacity = 0.55 * (1 - rk) * (1 - rk) * ringVis
    }

    // paper haze over the far half of the turret (off once the ring leaves)
    const camToRing = camera.position.distanceTo(ringCenter)
    const haze = ringVis
    scene.fog.near = haze > 0.01 ? camToRing - ringRadius * 0.15 : 100
    scene.fog.far = haze > 0.01 ? camToRing + ringRadius * (2.6 + 6 * (1 - haze)) : 101

    if (shadowCatcher) {
      // the soft shadow is a hero-ring device; step 02 floats free of it
      shadowCatcher.position.y = ringCenter.y - ringRadius * 0.62
      shadowCatcher.material.opacity = 0.1 * ringVis
      shadowCatcher.visible = !settings.phone && shadowCatcher.material.opacity > 0.004
    }

    // where the printer sits once it is out of the ring (step-01 framing)
    const goalPrinter = printerCamera()
    const printerBasis = makeBasis(goalPrinter)
    const preset = goalPrinter.preset
    // the printer only rides the track once its act is reached: before that the
    // hand-off carries it in
    const printerShift = clamp(tl.printer, 0, TRACK.hideBeyond)
    const stagePos = pointOn(printerBasis, preset.x + px * 0.5, -(preset.y || 0) + py * 0.5 + printerShift * TRACK.printerTravel, 0)

    // the lean: parts tip outward on fast moves, and lag a touch in yaw
    const lean = settings.reducedMotion ? 0 : 0.2 * smooth(0.3, 4.2, speed)
    const lag = settings.reducedMotion ? 0 : clamp(-state.angVel * 0.045, -0.2, 0.2)
    const trailLen = clamp(state.angVel * 0.4, -1.4, 1.4)
    const trailAlpha = settings.reducedMotion ? 0 : smooth(0.45, 2.2, speed) * ringVis

    hudFrame.alpha = intro.done ? 1 : smooth(INTRO.hud[0], INTRO.hud[0] + INTRO.hud[1], introT)
    hudFrame.alpha *= 1 - smooth(HANDOFF.balloons[0], HANDOFF.balloons[1], hand)
    hudFrame.time = state.time
    hudFrame.front = RING_ORDER[frontIndex(spin.angle)]
    hudFrame.settled = intro.done ? 1 - smooth(0.25, 1.1, speed) : 0
    hudFrame.items.length = 0

    for (const ringItem of ringItems) {
      const { id, item, index, trail } = ringItem
      const trim = RING_TRIM[id] || { scale: 1, yaw: 0, show: 0 }
      const angle = spin.angle + index * STEP
      const rel = wrapPi(angle) // 0 at the front station
      const order = (index === 0 ? 0 : RING_ORDER.length - index) // presentation order

      // spin-up: each part unfurls out of the hub on its own beat
      const partK = intro.done ? 1 : clamp((introT - INTRO.partsAt - order * INTRO.partStagger) / INTRO.partDur, 0, 1)
      const reach = intro.done ? 1 : easeOutCubic(partK)
      const grow = intro.done ? 1 : Math.max(0, easeOutBack(partK))
      // hand-off: the other parts shrink away where they are, J1 first
      const r0 = HANDOFF.recede[0] + HANDOFF.recedeStagger * (order - 1)
      const recede = id === 'printer' ? 0 : easeInOut(smooth(r0, r0 + HANDOFF.recede[1] - HANDOFF.recede[0], hand))

      // the part at the front station is presented: bigger, lifted, turned
      const presentTarget = 1 - smooth(0.0, STEP * 0.62, Math.abs(rel))
      state.present[index] = settings.reducedMotion ? presentTarget : ease(state.present[index], presentTarget, 9, dt)
      const pres = state.present[index] * (intro.done ? 1 : smooth(1.2, 2.4, introT))

      const r = ringRadius * collapse * reach
      _v.set(Math.sin(angle) * r, ringRadius * 0.05 * pres, Math.cos(angle) * r).applyQuaternion(_dialQuat)
      const ringPos = _v.clone().add(ringCenter)
      // hover drift: every item bobs gently around its orbit position
      if (!settings.reducedMotion) {
        const phase = index * 1.73 + 0.4
        const heavy = (id === 'printer' ? 0.55 : 1) * (1 - 0.6 * pres)
        ringPos
          .addScaledVector(basis.right, Math.sin(state.hoverTime * 0.5 + phase) * RING_HOVER.ampX * basis.viewW * heavy)
          .addScaledVector(basis.up, Math.cos(state.hoverTime * 0.37 + phase * 1.3) * RING_HOVER.ampY * basis.viewH * heavy)
          .addScaledVector(basis.dir, Math.sin(state.hoverTime * 0.29 + phase * 0.7) * RING_HOVER.ampZ * basis.viewH * heavy)
      }
      const wobble = settings.reducedMotion ? 0 : 1
      // orientation: platter tilt → lean outward about the tangent → yaw
      _tangent.set(Math.cos(angle), 0, -Math.sin(angle))
      _qLean.setFromAxisAngle(_tangent, lean)
      const swivel = settings.reducedMotion ? 0 : Math.sin(state.time * 0.55 + index) * 0.12 * pres
      _qYaw.setFromAxisAngle(UP, angle + trim.yaw + (trim.show + swivel) * pres + lag)
      _euler.set(
        Math.sin(state.hoverTime * 0.33 + index * 0.9) * 0.03 * wobble,
        0,
        Math.cos(state.hoverTime * 0.31 + index * 1.2) * 0.026 * wobble,
      )
      const ringQuat = _halfQuat.clone().multiply(_qLean).multiply(_qYaw).multiply(_q.setFromEuler(_euler))
      const ringScale = ((ringItemWorld * trim.scale) / item.maxDim) * (1 + (rv.present - 1) * pres) * grow

      const target = id === 'printer' ? printerPivot : item.pivot
      const screenRect = screenRectFor(target, _scratchRect)
      item.debugRect = screenRect ? [Math.round(screenRect.l), Math.round(screenRect.t), Math.round(screenRect.r), Math.round(screenRect.b)] : null
      let fadeTarget = 1
      if (state.textRects.length && screenRect) {
        if (id === 'printer' ? outK < 0.12 : ringVis > 0.03) {
          // fade only where the object genuinely sits over type, not for a marginal brush
          const hit = textOverlap(screenRect)
          if (hit > 0.02) fadeTarget = 1 - 0.86 * Math.min(1, hit / 0.22)
        }
      }
      let fade
      if (id === 'printer') {
        state.printerFade = ease(state.printerFade, fadeTarget, 7, dt)
        fade = state.printerFade
      } else {
        state.itemFade[index] = ease(state.itemFade[index], fadeTarget, 7, dt)
        fade = state.itemFade[index]
      }

      // speed lines behind the part, at its own height on the rail
      const tu = trail.material.uniforms
      tu.uAngle.value = angle
      tu.uLen.value = trailLen
      tu.uRadius.value = reach
      tu.uLift.value = 0.05 * pres
      tu.uGap.value = ((ringScale * item.maxDim) / Math.max(1e-4, ringRadius)) * 0.24
      tu.uWidth.value = 0.0058
      tu.uAlpha.value =
        trailAlpha * fade * (1 - recede) * (id === 'printer' ? 1 - outK : 1) * (0.55 + 0.45 * (1 - (1 - Math.cos(rel)) / 2))
      trail.visible = tu.uAlpha.value > 0.003

      // screen data for the part balloons
      if (screenRect) {
        const hud = ringItem.hud
        _proj.copy(target.position).project(camera)
        hud.x = (_proj.x * 0.5 + 0.5) * state.width
        hud.y = (-_proj.y * 0.5 + 0.5) * state.height
        hud.r = 0.5 * Math.min(screenRect.r - screenRect.l, screenRect.b - screenRect.t)
        hud.depth = (1 - Math.cos(rel)) / 2
        hud.present = pres
        hud.order = order
        hud.alpha = fade * Math.min(1, grow) * (1 - recede)
        hudFrame.items.push(hud)
      }

      if (id === 'printer') {
        const k = outK
        const sway = settings.reducedMotion
          ? 0
          : Math.sin(state.time * 0.22) * 0.035 + state.pointer.liveX * 0.03
        const stageQuat = new THREE.Quaternion().setFromAxisAngle(UP, sway)
        if (!settings.reducedMotion && printerShift > 0) {
          const pt = TRACK.printerTurn
          _eTurn.set(pt[0] * printerShift, pt[1] * printerShift, pt[2] * printerShift)
          stageQuat.multiply(_qTurn.setFromEuler(_eTurn))
        }
        printerPivot.position.copy(ringPos).lerp(stagePos, k)
        printerPivot.quaternion.copy(ringQuat).slerp(stageQuat, k)
        printerPivot.scale.setScalar(Math.max(1e-5, ringScale + (1 - ringScale) * k))
        const printerGone = k > 0.98 && printerShift * TRACK.printerTravel >= TRACK.hideBeyond - 0.05
        setAlpha(printer.pivot, printerGone ? 0 : state.printerFade * (k > 0.02 ? 1 : Math.min(1, grow * 4)))
        continue
      }

      const pivot = item.pivot
      const cfg = HOVER_TYPES.has(id) ? HOVER_ITEMS[mode()].find((h) => h.node === id) : null
      let pos = ringPos
      let quat = ringQuat
      let scale = ringScale
      let gone = false
      if (cfg && state.motorsAlpha > 0) {
        // on the scroll track, waiting for (or riding) step 02
        const hp = hoverPose(cfg, basis)
        pos = hp.position
        quat = hp.quaternion
        scale = hp.scale
        gone = hp.gone
      } else if (recede > 0) {
        // shrinking away on its station
        scale *= 1 - recede
        gone = recede > 0.985
      }
      pivot.position.copy(pos)
      pivot.quaternion.copy(quat)
      pivot.scale.setScalar(Math.max(1e-5, scale))
      setAlpha(pivot, gone ? 0 : fade * Math.min(1, grow * 4))
    }
  }

  function frame() {
    if (state.disposed) return
    const dt = Math.min(0.05, clock.getDelta())
    if (!state.visible || document.hidden || !state.loaded) return
    if (state.stage === 'ring' && state.frames % 24 === 0) refreshTextRects()
    update(dt)
    renderer.render(scene, camera)
    state.frames++
    settings.onFrame?.(hudFrame)
  }
  renderer.setAnimationLoop(frame)

  /* ------------------------------------------------------------ by hand */
  const handReady = () => state.loaded && state.intro.done && state.hand <= 0.0005 && !settings.reducedMotion

  function pickAt(x, y) {
    // front-most part whose (slightly tightened) screen box holds the point
    let best = null
    let bestDepth = Infinity
    for (const ri of ringItems) {
      const r = ri.item.debugRect
      if (!r) continue
      const w = r[2] - r[0]
      const h = r[3] - r[1]
      const inset = 0.14
      if (x < r[0] + w * inset || x > r[2] - w * inset || y < r[1] + h * inset || y > r[3] - h * inset) continue
      if (ri.hud.depth < bestDepth) {
        bestDepth = ri.hud.depth
        best = ri.id
      }
    }
    return best
  }

  function ringBounds() {
    let l = Infinity
    let t = Infinity
    let r = -Infinity
    let b = -Infinity
    for (const ri of ringItems) {
      const d = ri.item.debugRect
      if (!d) continue
      l = Math.min(l, d[0]); t = Math.min(t, d[1]); r = Math.max(r, d[2]); b = Math.max(b, d[3])
    }
    return { l, t, r, b }
  }

  /* ----------------------------------------------------------------- api */
  const api = {
    ready,
    play() {
      if (state.intro.done || state.intro.playing) return
      if (settings.reducedMotion) finishIntro()
      else state.intro.playing = true
    },
    pick(x, y) {
      return handReady() ? pickAt(x, y) : null
    },
    grab(x, y) {
      if (!handReady()) return false
      const b = ringBounds()
      if (!pickAt(x, y) && (x < b.l || x > b.r || y < b.t || y > b.b)) return false
      spin.mode = 'drag'
      spin.drag = { x, lastX: x, lastT: performance.now(), vel: 0, moved: 0, id: pickAt(x, y) }
      spin.vel = 0
      return true
    },
    drag(x) {
      const d = spin.drag
      if (spin.mode !== 'drag' || !d) return
      // a pointer sweep across the ring's radius turns it about one radian
      const radiusPx = Math.max(60, RING_VIEW[mode()].radius * state.width)
      const dx = x - d.lastX
      const now = performance.now()
      const dts = Math.max(0.001, (now - d.lastT) / 1000)
      spin.angle += dx / radiusPx
      d.vel = ease(d.vel, dx / radiusPx / dts, 0.5, 1) // light smoothing of the fling
      d.moved += Math.abs(dx)
      d.lastX = x
      d.lastT = now
    },
    release() {
      const d = spin.drag
      if (spin.mode !== 'drag' || !d) return null
      spin.drag = null
      const stale = performance.now() - d.lastT > 90
      if (d.moved < 5) {
        // a click, not a drag: bring that part round to the front
        spin.mode = 'index'
        spin.target = spin.angle
        spin.vel = 0
        if (d.id) api.present(d.id)
        return d.id
      }
      spin.vel = stale ? 0 : clamp(d.vel, -14, 14)
      spin.mode = 'free'
      return null
    },
    present(id) {
      if (!handReady()) return false
      const index = RING_ORDER.indexOf(id)
      if (index < 0) return false
      // shortest way round to the angle that puts this part at the front
      const goal = -index * STEP
      const target = spin.angle + wrapPi(goal - spin.angle)
      spin.target = spin.angle
      spin.mode = 'index'
      spin.from = spin.angle
      spin.to = target
      spin.moveT = 0
      spin.next = state.time + TURRET.move + TURRET.dwellAfterHand
      return true
    },
    setTrack(printerShift, motorsShift) {
      const tr = state.track
      tr.printer = Number(printerShift) || 0
      tr.motors = Number(motorsShift) || 0
      if (!tr.set) {
        // first report (load / deep link): start where the page is
        tr.set = true
        state.trackLive.printer = tr.printer
        state.trackLive.motors = tr.motors
        state.cameraSnap = true
      }
    },
    setStage(name) {
      if (!['ring', 'printer', 'motors', 'off'].includes(name)) return false
      if (!state.loaded) {
        pendingStage = name
        return true
      }
      applyStage(name)
      return true
    },
    setPointer(x, y) {
      state.pointer.x = clamp(Number(x) || 0, -1, 1)
      state.pointer.y = clamp(Number(y) || 0, -1, 1)
    },
    setVisible(visible) {
      state.visible = visible === true
      if (state.visible) clock.getDelta()
    },
    resize,
    dispose() {
      state.disposed = true
      renderer?.setAnimationLoop(null)
      for (const o of state.observers) o.disconnect()
      scene?.traverse((object) => {
        if (object.isMesh) {
          object.geometry?.dispose()
          const mats = Array.isArray(object.material) ? object.material : [object.material]
          for (const m of mats) m?.dispose()
        }
      })
      envRT?.dispose?.()
      renderer?.dispose()
    },
    /** QA: step the scene by fixed frames (pair with setVisible(false)). */
    advance(seconds, fps = 60) {
      if (!state.loaded) return
      const n = Math.max(1, Math.round(seconds * fps))
      for (let i = 0; i < n; i++) {
        update(1 / fps)
        settings.onFrame?.(hudFrame)
      }
      refreshTextRects()
      renderer.render(scene, camera)
    },
    debug() {
      return {
        loaded: state.loaded,
        frames: state.frames,
        stage: state.stage,
        appliedStage: state.appliedStage,
        hand: +state.hand.toFixed(3),
        ringAngle: spin.angle,
        spinMode: spin.mode,
        angVel: +state.angVel.toFixed(3),
        intro: { ...state.intro },
        front: RING_ORDER[frontIndex(spin.angle)],
        out: state.out,
        ringAlpha: state.ringAlpha,
        motorsAlpha: state.motorsAlpha,
        track: { printer: +state.trackLive.printer.toFixed(3), motors: +state.trackLive.motors.toFixed(3) },
        camera: state.camera
          ? { az: state.camera.az, el: state.camera.el, dist: state.camera.dist }
          : null,
        printerSize: printer ? printer.size.toArray().map((v) => +v.toFixed(3)) : null,
        printerScale: printer ? +printerPivot.scale.x.toFixed(3) : null,
        printerPos: printerPivot.position.toArray().map((v) => +v.toFixed(3)),
        camPos: camera.position.toArray().map((v) => +v.toFixed(3)),
        itemFade: state.itemFade.map((v) => +v.toFixed(2)),
        itemRects: ringItems.map((ri) => ri.item.debugRect),
        textRects: state.textRects.map((t) => [Math.round(t.l), Math.round(t.t), Math.round(t.r), Math.round(t.b)]),
        printerFade: +state.printerFade.toFixed(2),

        sampleMaterial: (() => {
          let out = null
          for (const [, item] of motorPivots) {
            item.pivot.traverse((o) => {
              if (out || !o.isMesh) return
              const m = Array.isArray(o.material) ? o.material[0] : o.material
              if (m) out = { name: m.name, hasUv: Boolean(o.geometry.attributes.uv), hasBump: Boolean(m.bumpMap), bumpScale: m.bumpScale, hasRough: Boolean(m.roughnessMap), roughness: m.roughness, metalness: m.metalness, clearcoat: m.clearcoat }
            })
            if (out) break
          }
          return out
        })(),
      }
    },
  }
  return api
}
