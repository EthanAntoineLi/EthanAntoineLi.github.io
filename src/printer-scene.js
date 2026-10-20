// ============================================================================
// printer-scene.js — the 3D printer on the process page.
//
// One model, one purpose: show the Bambu Lab A1 mini as the start of the build.
// Same light-room setup and transparent canvas as the arm film, minus the six
// camera stops — here the camera eases between two framings and a small idle
// sway keeps the object alive.
//
// PUBLIC API
//   const scene = await createPrinterScene(canvas, {
//     modelUrl: '/models/printer-a1-mini.glb',
//     reducedMotion: false,
//     phone: false,
//     onLoadProgress: (p) => {}      // 0..1 transfer progress
//   })
//   scene.ready                      Promise<void> — model in the scene, first
//                                    frame drawn, camera framed
//   scene.setPreset('hero' | 'step') target framing; the camera + object ease
//   scene.setPointer(x, y)           pointer in -1..1 for the parallax
//   scene.setVisible(bool)           pause/resume drawing (page hides the stage)
//   scene.resize()                   re-measure; also self-wires a ResizeObserver
//   scene.dispose()
//   scene.debug()                    non-contract QA readout
// ============================================================================
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const DEFAULT_MODEL_URL = import.meta.env.BASE_URL + 'models/printer-a1-mini.glb'
const MAX_DPR = 2
const FOV = 30
const NEAR = 0.01
const FAR = 40

const D2R = Math.PI / 180

// az/el in radians; fillX/fillY are the fraction of the viewport the model's
// bounding box may use; x/y shift the model on screen (fraction of the viewport,
// +x right, +y down), which is how the copy column keeps its side of the page.
const PRESETS = {
  hero: { az: 1.34, el: 0.09, fillX: 0.50, fillY: 0.50, x: 0.195, y: -0.01 },
  step: { az: 1.22, el: 0.07, fillX: 0.52, fillY: 0.54, x: 0.20, y: -0.02 },
  phone: { az: 1.26, el: 0.08, fillX: 0.66, fillY: 0.38, x: 0.0, y: -0.13 },
}

const ease = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt))

export async function createPrinterScene(canvas, opts = {}) {
  const settings = {
    modelUrl: typeof opts.modelUrl === 'string' && opts.modelUrl ? opts.modelUrl : DEFAULT_MODEL_URL,
    reducedMotion: opts.reducedMotion === true,
    phone: opts.phone === true,
    onLoadProgress: typeof opts.onLoadProgress === 'function' ? opts.onLoadProgress : null,
  }

  const state = {
    disposed: false,
    visible: true,
    loaded: false,
    width: 1,
    height: 1,
    dpr: 1,
    pointer: { x: 0, y: 0, liveX: 0, liveY: 0 },
    preset: settings.phone ? 'phone' : 'hero',
    live: null,
    idle: 0,
    frames: 0,
    lastFrame: 0,
    observers: [],
  }

  const presetFor = (name) => PRESETS[name] || (settings.phone ? PRESETS.phone : PRESETS.hero)
  state.live = { ...presetFor(state.preset), rotation: 0 }

  let resolveReady
  let rejectReady
  let settled = false
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  ready.catch(() => {})

  const fail = (err) => {
    if (settled) return
    settled = true
    try {
      rejectReady(err instanceof Error ? err : new Error(String(err)))
    } catch {
      /* ignore */
    }
  }

  let renderer = null
  let scene = null
  let camera = null
  let root = null
  let envRT = null
  const bounds = { center: new THREE.Vector3(0, 0.5, 0), size: new THREE.Vector3(1, 1, 1) }
  const basePosition = new THREE.Vector3(0, 0, 0)

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

  // Solve the camera so the model fills the preset's share of the viewport and
  // sits at the preset's screen offset.
  const _dir = new THREE.Vector3()
  const _target = new THREE.Vector3()
  const _position = new THREE.Vector3()
  const _right = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)

  function placeCamera(live) {
    const aspect = state.width / state.height
    const tanHalf = Math.tan((FOV * D2R) / 2)
    const size = bounds.size
    // distance needed to fit each axis
    const distY = size.y / 2 / (tanHalf * live.fillY)
    const distX = size.x / 2 / (tanHalf * aspect * live.fillX)
    const dist = Math.max(distY, distX, 0.4)

    _dir.set(Math.sin(live.az) * Math.cos(live.el), Math.sin(live.el), Math.cos(live.az) * Math.cos(live.el)).normalize()
    _target.copy(bounds.center)
    _position.copy(_target).addScaledVector(_dir, dist)
    camera.position.copy(_position)
    camera.lookAt(_target)
    camera.updateProjectionMatrix()

    // Screen placement is the object's own job: shift it across the view plane
    // so it can sit right of the copy column (and lower on phones).
    if (!root) return
    const viewHeight = 2 * dist * tanHalf
    const viewWidth = viewHeight * aspect
    // camera-right on the ground plane
    _right.set(Math.cos(live.az), 0, -Math.sin(live.az)).normalize()
    root.position.copy(basePosition)
    root.position.addScaledVector(_right, live.x * viewWidth)
    root.position.addScaledVector(UP, -live.y * viewHeight)
  }

  const clock = new THREE.Clock()

  function frame(now) {
    if (state.disposed) return
    const dt = Math.min(0.05, clock.getDelta())
    if (!state.visible || document.hidden || !root) return

    const target = presetFor(state.preset)
    const live = state.live
    const isStatic = settings.reducedMotion
    if (!isStatic) {
      state.idle += dt
      live.az = ease(live.az, target.az + Math.sin(state.idle * 0.25) * 0.05, 2.6, dt)
      live.el = ease(live.el, target.el, 2.6, dt)
      live.fillX = ease(live.fillX, target.fillX, 2.6, dt)
      live.fillY = ease(live.fillY, target.fillY, 2.6, dt)
      live.x = ease(live.x, target.x, 2.6, dt)
      live.y = ease(live.y, target.y, 2.6, dt)
      state.pointer.liveX = ease(state.pointer.liveX, state.pointer.x, 4, dt)
      state.pointer.liveY = ease(state.pointer.liveY, state.pointer.y, 4, dt)
      live.rotation = Math.sin(state.idle * 0.18) * 0.06 + state.pointer.liveX * 0.05
    } else {
      Object.assign(live, target)
      live.rotation = 0
    }

    root.rotation.y = live.rotation
    placeCamera(live)
    renderer.render(scene, camera)
    state.frames++
  }

  function startLoop() {
    renderer.setAnimationLoop((now) => frame(now))
  }

  try {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('createPrinterScene: canvas required')
    if (typeof window === 'undefined') throw new Error('createPrinterScene: browser required')

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

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR)

    const pmrem = new THREE.PMREMGenerator(renderer)
    envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envRT.texture
    scene.environmentIntensity = 0.9

    resize()
    startLoop()

    addEventListener('resize', resize)
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => resize())
      observer.observe(canvas)
      state.observers.push(observer)
    }
  } catch (err) {
    console.error('[printer-scene] initialisation failed', err)
    fail(err)
    return null
  }

  // ------------------------------------------------------------------ load
  try {
    await MeshoptDecoder.ready
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    const gltf = await loader.loadAsync(settings.modelUrl, (event) => {
      if (!settings.onLoadProgress || !event || !event.total) return
      settings.onLoadProgress(Math.min(1, event.loaded / event.total))
    })
    if (state.disposed) return null

    root = gltf.scene
    root.name = 'A1mini'
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    box.getCenter(bounds.center)
    box.getSize(bounds.size)
    basePosition.copy(bounds.center).negate()
    basePosition.y += bounds.size.y / 2
    root.position.copy(basePosition)
    root.updateMatrixWorld(true)
    scene.add(root)
    state.loaded = true

    // First frame is guaranteed before `ready` resolves: the loader curtain can
    // lift on it rather than on a still plate.
    placeCamera(state.live)
    renderer.render(scene, camera)
    state.frames++
    settled = true
    resolveReady()
  } catch (err) {
    console.error('[printer-scene] could not load', settings.modelUrl, err)
    fail(err)
    return null
  }

  /* ---------------------------------------------------------------- api */
  const api = {
    ready,
    setPreset(name) {
      if (!PRESETS[name] && !(name === 'phone' && PRESETS.phone)) return false
      state.preset = name
      return true
    },
    setPointer(x, y) {
      state.pointer.x = Math.max(-1, Math.min(1, Number(x) || 0))
      state.pointer.y = Math.max(-1, Math.min(1, Number(y) || 0))
    },
    setVisible(visible) {
      state.visible = visible === true
      if (state.visible) clock.getDelta() // drop the paused gap
    },
    resize,
    dispose() {
      state.disposed = true
      renderer?.setAnimationLoop(null)
      for (const observer of state.observers) observer.disconnect()
      scene?.traverse((object) => {
        if (object.isMesh) {
          object.geometry?.dispose()
          const material = object.material
          if (Array.isArray(material)) material.forEach((m) => m.dispose())
          else material?.dispose()
        }
      })
      envRT?.dispose?.()
      renderer?.dispose()
    },
    debug() {
      return {
        loaded: state.loaded,
        frames: state.frames,
        preset: state.preset,
        visible: state.visible,
        rotation: state.live.rotation,
        size: bounds.size.toArray(),
        cameraDistance: camera ? camera.position.distanceTo(_target) : null,
      }
    },
  }
  return api
}
