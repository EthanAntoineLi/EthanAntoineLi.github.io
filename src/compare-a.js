// ============================================================================
// compare-a.js — Sheet 01 / process page, step 04 / Revision: Rev A.
//
// Rev B's link is parked in its frame by the main process stage. Rev A is a
// different model, so it runs its own small scene: the same light rig, the same
// printed-black PLA material and the same slow turn as the parked Rev B part,
// so the two plates read as one object drawn twice.
//
// Rev B is parked at the frame's *eased* rect (process-stage TRACK.smooth), so
// while the page scrolls it drifts a few pixels against its frame. Rev A used
// to sit dead still inside its frame, which read as a different weight; it now
// eases its frame rect the same way and offsets the model by the lag.
//
// Lazy: the caller initialises this only when the frame comes near the screen.
// Reduced motion: one static frame, no turn, no drift.
// No WebGL / failed load: resolves false and the baked image stays in the frame.
// ============================================================================
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const MODEL_URL = import.meta.env.BASE_URL + 'models/arm-parts/parts/link-J1-J2-rev-a.glb'
const FOV = 30
const SPIN = 0.32 // rad/s — same as the stage's parked link
const FILL = 0.62 // fraction of the frame the part fills
const DRIFT_RATE = 9 // 1/s — the stage's TRACK.smooth, so both parts share a weight
const UP = new THREE.Vector3(0, 1, 0)
const BASE_QUAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)

export function initCompareA(canvas, { reducedMotion = false } = {}) {
  return new Promise((resolve) => {
    let renderer = null
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      })
    } catch (err) {
      resolve(false)
      return
    }

    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.003, 40)
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.95
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe6edf5, 1.05))

    // The process stage's exact light rig (src/process-stage.js).
    const key = new THREE.DirectionalLight(0xfff6ec, 3.1)
    key.position.set(1.1, 3.0, 1.3)
    const fill = new THREE.DirectionalLight(0x9fc4e8, 0.9)
    fill.position.set(-2.0, 1.0, 1.2)
    const rim = new THREE.DirectionalLight(0x0a7194, 1.1)
    rim.position.set(-1.6, 1.5, -1.8)
    scene.add(key, fill, rim)

    const printed = new THREE.MeshPhysicalMaterial({
      color: 0x1d2024,
      roughness: 0.56,
      metalness: 0.0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      envMapIntensity: 1.15,
      side: THREE.DoubleSide,
    })

    const pivot = new THREE.Group()
    scene.add(pivot)

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    let radius = 1
    let distance = 2
    let spin = 0
    let ready = false
    let onScreen = false
    let running = false
    let lastTime = 0
    // the frame's rect in viewport fractions, eased the way the stage eases
    // Rev B's slot; the difference from the real rect is the drift, in viewports
    let driftY = null
    let driftH = null
    // the stage captures Rev B's slot in its onFrame (after that frame's
    // ease), so the parked part always chases a rect one frame old. Keep the
    // same one-frame-old target here, or Rev A would lead Rev B slightly.
    let pendingY = null
    let pendingH = null

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      const halfTan = Math.tan((FOV * Math.PI) / 360)
      distance = radius / (FILL * halfTan)
      const az = THREE.MathUtils.degToRad(30)
      const el = THREE.MathUtils.degToRad(18)
      camera.position.set(
        Math.sin(az) * Math.cos(el) * distance,
        Math.sin(el) * distance,
        Math.cos(az) * Math.cos(el) * distance,
      )
      camera.lookAt(0, 0, 0)
    }

    // Mirror the parked Rev B: the part is drawn at a position that lags the
    // frame by ~1/TRACK.smooth of a second, so scrolling makes it float a few
    // pixels inside its drawing frame instead of being glued to it.
    const applyDrift = (dt) => {
      const rect = canvas.getBoundingClientRect()
      const vh = window.innerHeight || 1
      if (!(rect.height > 0)) return
      const targetY = rect.top / vh
      const targetH = rect.height / vh
      if (driftY === null || reducedMotion) {
        driftY = targetY
        driftH = targetH
        pendingY = targetY
        pendingH = targetH
      } else {
        const k = 1 - Math.exp(-DRIFT_RATE * Math.max(0, dt))
        driftY += (pendingY - driftY) * k
        driftH += (pendingH - driftH) * k
        pendingY = targetY
        pendingH = targetH
      }
      // one viewport of screen = this much world at the pivot's depth
      const viewH = 2 * distance * Math.tan((FOV * Math.PI) / 360)
      pivot.position.y = -(driftY - targetY) * viewH
      const scale = targetH > 0 ? driftH / targetH : 1
      pivot.scale.setScalar(scale)
    }

    const renderStatic = () => {
      if (!ready) return
      pivot.quaternion.setFromAxisAngle(UP, spin).multiply(BASE_QUAT)
      renderer.render(scene, camera)
    }

    const tick = (now) => {
      if (!running) return
      const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016)
      lastTime = now
      applyDrift(dt)
      if (!reducedMotion) spin += dt * SPIN
      pivot.quaternion.setFromAxisAngle(UP, spin).multiply(BASE_QUAT)
      renderer.render(scene, camera)
      requestAnimationFrame(tick)
    }

    const start = () => {
      if (!ready || running) return
      if (reducedMotion) {
        renderStatic()
        return
      }
      running = true
      lastTime = performance.now()
      requestAnimationFrame(tick)
    }

    const stop = () => {
      running = false
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          onScreen = entry.isIntersecting
          if (onScreen) start()
          else stop()
        }
      },
      { rootMargin: '0px' },
    )
    observer.observe(canvas)

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop()
      else if (onScreen) start()
    })

    window.addEventListener('resize', resize, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        resize()
        renderStatic()
      })
      ro.observe(canvas)
    }

    // dev-only probe: the QA script reads the drift while it scrolls
    if (import.meta.env.DEV) {
      window.__compareA = {
        drift: () => {
          const rect = canvas.getBoundingClientRect()
          const vh = window.innerHeight || 1
          const rectY = rect.top / vh
          return {
            ready,
            running,
            offsetPx: driftY === null ? 0 : (driftY - rectY) * vh,
            y: driftY,
            targetY: rectY,
            h: driftH,
            targetH: rect.height / vh,
          }
        },
      }
    }

    loader
      .loadAsync(MODEL_URL)
      .then((gltf) => {
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return
          child.material = printed
          child.frustumCulled = false
        })
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const centre = box.getCenter(new THREE.Vector3())
        gltf.scene.position.sub(centre)
        pivot.add(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        radius = Math.max(size.x, size.y, size.z) * 0.5
        ready = true
        resize()
        renderStatic()
        if (onScreen) start()
        resolve(true)
      })
      .catch((err) => {
        console.warn('[compare-a] model unavailable, keeping the still render:', err)
        observer.disconnect()
        resolve(false)
      })
  })
}
