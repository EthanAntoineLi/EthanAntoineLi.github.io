// ============================================================================
// process-stage.js — the 3D stage for the process page.
//
// Three states on one canvas:
//   ring    — five motor drive units + the A1 mini on a slowly spinning ring.
//             Everything sits in real 3D, so the front items pass in front of
//             the ones behind.
//   printer — the ring spins to its preset angle, the printer leaves the ring
//             and becomes the printer object for step 01 (the old printer scene).
//   motors  — step 02: three motor types (big / shoulder-lift / small) hover in
//             the free half of the screen, each with its own orientation + depth.
//
// PUBLIC API
//   const stage = await createProcessStage(canvas, {
//     printerUrl, motorsUrl, reducedMotion, phone, onLoadProgress
//   })
//   stage.ready                     model loaded + first frame drawn
//   stage.setStage('ring'|'printer'|'motors'|'off')
//                                   the ring spin + printer exit are sequenced
//                                   internally; safe to call any time
//   stage.setPointer(x, y)          pointer -1..1 for a little parallax
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

const RING_SPEED = 0.09 // rad/s — the ring drifts round very slowly
const SPIN_RATE = 6.5 // rad/s while spinning to the preset

// The printer's existing framings (az/el radians; fill = viewport share;
// x/y = screen offset as a fraction of the viewport).
const PRINTER_PRESETS = {
  hero: { az: 1.34, el: 0.09, fillX: 0.5, fillY: 0.5, x: 0.195, y: -0.01 },
  step: { az: 1.22, el: 0.07, fillX: 0.52, fillY: 0.54, x: 0.2, y: -0.02 },
  phone: { az: 1.26, el: 0.08, fillX: 0.66, fillY: 0.38, x: 0.0, y: -0.13 },
}

// Ring composition: cx/cy = ring centre as a viewport fraction,
// radius/item = world size as a fraction of the viewport width.
const RING_VIEW = {
  desktop: { az: 0.14, el: 0.25, dist: 2.8, cx: 0.165, cy: 0.05, radius: 0.23, item: 0.205, pitch: 0.18, roll: 0.7 },
  phone: { az: 0.12, el: 0.18, dist: 2.0, cx: 0.0, cy: 0.03, radius: 0.3, item: 0.28, pitch: 0.2, roll: 0.45 },
}
const RING_ITEM_SCALE = { printer: 0.62 }
// each ring item floats on its own spot instead of pinwheeling on its axis
const RING_HOVER = {
  yaw: [0.0, 0.16, -0.12, 0.2, -0.18, 0.1],
  tiltX: [0.03, -0.04, 0.05, -0.02, 0.04, -0.05],
  tiltZ: [-0.04, 0.05, -0.03, 0.06, -0.05, 0.03],
  ampX: 0.012,
  ampY: 0.017,
  ampZ: 0.009,
}

// Step 02: three motor types floating in the free half of the screen.
// sx/sy are viewport fractions from the centre, depth pushes toward the camera,
// size is the max dimension as a fraction of the viewport width, rot is the
// resting orientation.
const HOVER_VIEW = {
  desktop: { az: 0.12, el: 0.13, dist: 3.1, ty: 0.02 },
  phone: { az: 0.1, el: 0.1, dist: 2.5, ty: -0.02 },
}
const HOVER_ITEMS = {
  desktop: [
    { node: 'motor-J1', sx: 0.27, sy: 0.03, depth: 0.18, size: 0.215, rot: [0.08, 0.62, -0.05], phase: 0.0, amp: [0.008, 0.011] },
    { node: 'motor-J2', sx: 0.01, sy: 0.2, depth: 0.0, size: 0.195, rot: [0.3, -0.5, 0.14], phase: 1.9, amp: [0.007, 0.01] },
    { node: 'motor-J3', sx: 0.125, sy: -0.155, depth: 0.28, size: 0.17, rot: [-0.26, 0.85, -0.3], phase: 3.4, amp: [0.008, 0.01] },
  ],
  phone: [
    { node: 'motor-J1', sx: 0.17, sy: 0.05, depth: 0.15, size: 0.29, rot: [0.08, 0.62, -0.05], phase: 0.0, amp: [0.008, 0.011] },
    { node: 'motor-J2', sx: 0.01, sy: 0.2, depth: 0.0, size: 0.3, rot: [0.3, -0.5, 0.14], phase: 1.9, amp: [0.007, 0.01] },
    { node: 'motor-J3', sx: -0.12, sy: -0.02, depth: 0.22, size: 0.21, rot: [-0.26, 0.85, -0.3], phase: 3.4, amp: [0.008, 0.01] },
  ],
}

const MOTOR_NAMES = ['motor-J1', 'motor-J2', 'motor-J3', 'motor-J4', 'motor-J5']
const RING_ORDER = ['printer', ...MOTOR_NAMES]
const HOVER_TYPES = new Set(['motor-J1', 'motor-J2', 'motor-J3'])

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const ease = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt))

export async function createProcessStage(canvas, opts = {}) {
  const settings = {
    printerUrl: typeof opts.printerUrl === 'string' ? opts.printerUrl : '',
    motorsUrl: typeof opts.motorsUrl === 'string' ? opts.motorsUrl : '',
    reducedMotion: opts.reducedMotion === true,
    phone: opts.phone === true,
    onLoadProgress: typeof opts.onLoadProgress === 'function' ? opts.onLoadProgress : null,
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
    camGoal: 'ring',
    ringAngle: 0,
    ringAlpha: 1,
    printerAlpha: 1,
    motorsAlpha: 0,
    out: 0,
    time: 0,
    hoverTime: 0,
    itemSpin: new Array(6).fill(0),
    itemFade: new Array(6).fill(1),
    printerFade: 1,
    textRects: [],
    exit: null,
    tweens: new Map(),
    camera: null,
    pointer: { x: 0, y: 0, liveX: 0, liveY: 0 },
    observers: [],
  }
  let pendingStage = null
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
    const viewH = 2 * cam.dist * TAN_HALF
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
    return { az: ring.az, el: ring.el, dist: ring.dist, tx: 0, ty: 0, tz: 0 }
  }
  function hoverCamera() {
    const hv = HOVER_VIEW[mode()]
    return { az: hv.az, el: hv.el, dist: hv.dist, tx: 0, ty: hv.ty, tz: 0 }
  }
  function printerCamera() {
    const preset = settings.phone ? PRINTER_PRESETS.phone : PRINTER_PRESETS.step
    const aspect = state.width / state.height
    const size = printer.size
    const distY = size.y / 2 / (TAN_HALF * preset.fillY)
    const distX = size.x / 2 / (TAN_HALF * aspect * preset.fillX)
    return { az: preset.az, el: preset.el, dist: Math.max(distY, distX, 0.4), tx: 0, ty: 0, tz: 0, preset }
  }
  function goalCamera() {
    if (state.camGoal === 'printer') return printerCamera()
    if (state.camGoal === 'motors') return hoverCamera()
    if (state.camGoal === 'ring') return ringCamera()
    return null
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
      ringItems.push({ id, item, index: i })
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

  /* --------------------------------------------------------------- tweens */
  function tweenTo(key, to, dur, delay = 0, easing = easeInOut) {
    const from = state[key]
    if (settings.reducedMotion || dur <= 0.001) {
      state[key] = to
      state.tweens.delete(key)
      return
    }
    if (Math.abs(to - from) < 0.0005) {
      state[key] = to
      state.tweens.delete(key)
      return
    }
    state.tweens.set(key, { from, to, t: -delay, dur, easing })
  }
  function tickTweens(dt) {
    for (const [key, tw] of [...state.tweens]) {
      tw.t += dt
      if (tw.t < 0) continue
      const k = clamp(tw.t / tw.dur, 0, 1)
      state[key] = tw.from + (tw.to - tw.from) * tw.easing(k)
      if (k >= 1) state.tweens.delete(key)
    }
  }

  /* ------------------------------------------------------- stage changes */
  const presetAngle = () => Math.round(state.ringAngle / TAU) * TAU

  function beginSpinExit() {
    const mod = ((state.ringAngle % TAU) + TAU) % TAU
    const forward = (TAU - mod) % TAU
    const aligned = forward < 0.04 || forward > TAU - 0.04
    if (aligned || settings.reducedMotion) {
      state.ringAngle = presetAngle()
      startExit()
      return
    }
    const delta = TAU + forward // at least one full circle, then the preset
    const dur = Math.max(0.9, delta / SPIN_RATE)
    state.exit = { t: 0, dur, from: state.ringAngle, delta }
    state.camGoal = 'ring'
    tweenTo('ringAlpha', 1, 0.2)
  }

  function startExit() {
    state.exit = null
    state.ringAngle = presetAngle()
    tweenTo('out', 1, 0.62, 0.06)
    tweenTo('ringAlpha', 0, 0.22)
    tweenTo('printerAlpha', 1, 0.12)
    tweenTo('motorsAlpha', 0, 0.2)
    state.camGoal = 'printer'
  }

  function beginReturn() {
    state.exit = null
    state.ringAngle = presetAngle()
    tweenTo('out', 0, 0.85)
    tweenTo('ringAlpha', 1, 0.6, 0.3)
    tweenTo('printerAlpha', 1, 0.15)
    tweenTo('motorsAlpha', 0, 0.25)
    state.camGoal = 'ring'
  }

  function applyStage(next) {
    const prev = state.appliedStage
    if (next === prev) return
    state.appliedStage = next
    state.stage = next

    if (next === 'printer') {
      if (prev === 'ring') {
        beginSpinExit()
      } else {
        state.exit = null
        state.out = 1
        tweenTo('printerAlpha', 1, 0.5)
        tweenTo('motorsAlpha', 0, 0.35)
        tweenTo('ringAlpha', 0, 0.35)
        state.camGoal = 'printer'
      }
    } else if (next === 'ring') {
      if (prev === 'printer' || state.out > 0.01) {
        beginReturn()
      } else {
        state.exit = null
        state.out = 0
        tweenTo('ringAlpha', 1, 0.6, 0.15)
        tweenTo('printerAlpha', 1, 0.15)
        tweenTo('motorsAlpha', 0, 0.35)
        state.camGoal = 'ring'
      }
    } else if (next === 'motors') {
      state.exit = null
      if (prev === 'ring') state.out = 0
      tweenTo('printerAlpha', 0, 0.35)
      tweenTo('ringAlpha', 0, 0.35)
      tweenTo('motorsAlpha', 1, 0.7, 0.25)
      state.camGoal = 'motors'
    } else {
      // off: fade the stage out, leave the camera where it is
      state.exit = null
      tweenTo('ringAlpha', 0, 0.45)
      tweenTo('printerAlpha', 0, 0.45)
      tweenTo('motorsAlpha', 0, 0.45)
      state.camGoal = 'hold'
    }
  }

  /* --------------------------------------------------------------- update */
  const clock = new THREE.Clock()

  function hoverPose(cfg, basis) {
    const depthWorld = cfg.depth * basis.viewH
    const planeDist = Math.max(0.3, state.camera.dist - depthWorld)
    const pos = pointOn(basis, cfg.sx, cfg.sy, cfg.depth)
    if (!settings.reducedMotion) {
      const t = state.hoverTime
      pos
        .addScaledVector(basis.right, Math.sin(t * 0.55 + cfg.phase) * cfg.amp[0] * basis.viewW)
        .addScaledVector(basis.up, Math.cos(t * 0.45 + cfg.phase * 1.3) * cfg.amp[1] * basis.viewH)
        .addScaledVector(basis.dir, Math.sin(t * 0.35 + cfg.phase * 0.7) * 0.01 * basis.viewH)
    }
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(cfg.rot[0], cfg.rot[1], cfg.rot[2]))
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
    return { position: pos, quaternion: quat, scale: worldSize / Math.max(0.0001, item.maxDim) }
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

    // the scripted spin-before-exit
    if (state.exit) {
      const ex = state.exit
      ex.t += dt
      const k = clamp(ex.t / ex.dur, 0, 1)
      state.ringAngle = ex.from + ex.delta * easeInOut(k)
      if (k >= 1) startExit()
    }

    // idle spin while the ring is on stage and the printer is still in it
    if (state.stage === 'ring' && !state.exit && state.out < 0.02 && !settings.reducedMotion) {
      state.ringAngle += RING_SPEED * dt
    }
    state.ringAngle %= TAU * 1000

    tickTweens(dt)

    // camera eases toward the framing this stage wants
    const wantCam = goalCamera()
    if (wantCam) {
      const rate = settings.reducedMotion ? 1000 : 3.1
      state.camera.az = ease(state.camera.az, wantCam.az, rate, dt)
      state.camera.el = ease(state.camera.el, wantCam.el, rate, dt)
      state.camera.dist = ease(state.camera.dist, wantCam.dist, rate, dt)
      state.camera.tx = ease(state.camera.tx, wantCam.tx, rate, dt)
      state.camera.ty = ease(state.camera.ty, wantCam.ty, rate, dt)
    }
    const basis = makeBasis(state.camera)
    camera.position.copy(basis.cameraPos)
    camera.lookAt(basis.target)

    // parallax nudge shared by everything
    const px = state.pointer.liveX * 0.012
    const py = state.pointer.liveY * -0.008

    const rv = RING_VIEW[mode()]
    const ringCenter = pointOn(basis, rv.cx + px, rv.cy + py, 0)
    const ringRadius = rv.radius * basis.viewW
    const ringItemWorld = rv.item * basis.viewW
    const step = TAU / RING_ORDER.length

    if (shadowCatcher) {
      // the soft shadow is a hero-ring device; step 02 floats free of it
      shadowCatcher.material.opacity = 0.09 * state.ringAlpha
      shadowCatcher.visible = !settings.phone && shadowCatcher.material.opacity > 0.004
    }

    // where the printer sits once it is out of the ring (step-01 framing)
    const goalPrinter = printerCamera()
    const printerBasis = makeBasis(goalPrinter)
    const preset = goalPrinter.preset
    const stagePos = pointOn(printerBasis, preset.x + px * 0.5, -(preset.y || 0) + py * 0.5, 0)

    const vPitch = Math.sin(rv.pitch || 0)
    const cPitch = Math.cos(rv.pitch || 0)
    const sRoll = Math.sin(rv.roll || 0)
    const cRoll = Math.cos(rv.roll || 0)
    for (const ringItem of ringItems) {
      const { id, item, index } = ringItem
      const angle = state.ringAngle + index * step
      const ringX = Math.sin(angle) * ringRadius
      const ringZ0 = Math.cos(angle) * ringRadius
      // pitch around X, then roll around Z so the right side sits lower
      const pitchY = -ringZ0 * vPitch
      const pitchZ = ringZ0 * cPitch
      const tiltedX = ringX * cRoll - pitchY * sRoll
      const tiltedY = ringX * sRoll + pitchY * cRoll
      const ringPos = ringCenter.clone().add(new THREE.Vector3(tiltedX, tiltedY, pitchZ))
      // hover drift: every item bobs gently around its orbit position
      if (!settings.reducedMotion) {
        const phase = index * 1.73 + 0.4
        const heavy = id === 'printer' ? 0.55 : 1
        ringPos
          .addScaledVector(basis.right, Math.sin(state.hoverTime * 0.5 + phase) * RING_HOVER.ampX * basis.viewW * heavy)
          .addScaledVector(basis.up, Math.cos(state.hoverTime * 0.37 + phase * 1.3) * RING_HOVER.ampY * basis.viewH * heavy)
          .addScaledVector(basis.dir, Math.sin(state.hoverTime * 0.29 + phase * 0.7) * RING_HOVER.ampZ * basis.viewH)
      }
      const wobble = settings.reducedMotion
        ? { x: 0, y: 0, z: 0 }
        : {
            x: Math.sin(state.hoverTime * 0.33 + index * 0.9) * 0.032,
            y: Math.sin(state.hoverTime * 0.27 + index * 1.6) * 0.042,
            z: Math.cos(state.hoverTime * 0.31 + index * 1.2) * 0.028,
          }
      const ringQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          RING_HOVER.tiltX[index] + wobble.x,
          angle + RING_HOVER.yaw[index] + wobble.y,
          RING_HOVER.tiltZ[index] + wobble.z,
        ),
      )
      const ringScale = (ringItemWorld * (RING_ITEM_SCALE[id] || 1)) / item.maxDim

      const screenRect = screenRectFor(id === 'printer' ? printerPivot : item.pivot, _scratchRect)
      item.debugRect = screenRect ? [Math.round(screenRect.l), Math.round(screenRect.t), Math.round(screenRect.r), Math.round(screenRect.b)] : null
      let fadeTarget = 1
      if (state.textRects.length && screenRect) {
        if (id === 'printer' ? state.out < 0.12 : state.ringAlpha > 0.03) {
          // fade only where the object genuinely sits over type, not for a marginal brush
          const hit = textOverlap(screenRect)
          if (hit > 0.02) fadeTarget = 1 - 0.86 * Math.min(1, hit / 0.22)
        }
      }
      if (id === 'printer') {
        state.printerFade = ease(state.printerFade, fadeTarget, 7, dt)
      } else {
        state.itemFade[index] = ease(state.itemFade[index], fadeTarget, 7, dt)
      }

      if (id === 'printer') {
        const k = easeInOut(clamp(state.out, 0, 1))
        const sway = settings.reducedMotion
          ? 0
          : Math.sin(state.time * 0.22) * 0.035 + state.pointer.liveX * 0.03
        const stageQuat = new THREE.Quaternion().setFromAxisAngle(UP, sway)
        printerPivot.position.copy(ringPos).lerp(stagePos, k)
        printerPivot.quaternion.copy(ringQuat).slerp(stageQuat, k)
        printerPivot.scale.setScalar(ringScale + (1 - ringScale) * k)
        setAlpha(printer.pivot, state.printerAlpha * state.printerFade)
        continue
      }

      const pivot = item.pivot
      const cfg = HOVER_TYPES.has(id) ? HOVER_ITEMS[mode()].find((h) => h.node === id) : null
      const mix = cfg ? clamp(state.motorsAlpha, 0, 1) : 0
      let pos = ringPos
      let quat = ringQuat
      let scale = ringScale
      if (cfg && mix > 0.0005) {
        const hp = hoverPose(cfg, basis)
        pos = ringPos.clone().lerp(hp.position, mix)
        quat = ringQuat.clone().slerp(hp.quaternion, mix)
        scale = ringScale + (hp.scale - ringScale) * mix
      }
      // shrink the ring away while it fades during the printer exit
      if (state.out > 0.01 && state.motorsAlpha < 0.2) {
        scale *= 0.65 + 0.35 * state.ringAlpha
      }
      pivot.position.copy(pos)
      pivot.quaternion.copy(quat)
      pivot.scale.setScalar(scale)
      setAlpha(pivot, (cfg ? Math.max(state.ringAlpha, state.motorsAlpha) : state.ringAlpha) * state.itemFade[index])
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
  }
  renderer.setAnimationLoop(frame)

  /* ----------------------------------------------------------------- api */
  const api = {
    ready,
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
    debug() {
      return {
        loaded: state.loaded,
        frames: state.frames,
        stage: state.stage,
        appliedStage: state.appliedStage,
        camGoal: state.camGoal,
        ringAngle: state.ringAngle,
        out: state.out,
        ringAlpha: state.ringAlpha,
        printerAlpha: state.printerAlpha,
        motorsAlpha: state.motorsAlpha,
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
