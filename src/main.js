// ============================================================================
// main.js — page behaviour for the v4 product-film portfolio.
//
// Owns: loader, Lenis smooth scroll, section/stop choreography into the 3D
// scene, ghost type, progress, custom cursor, clock, index overlay, mode
// switch, drag-to-orbit routing, scroll reveals.
//
// The 3D scene itself lives in ./arm-scene.js (createArmScene).
// ============================================================================
import { createArmScene } from './arm-scene.js'
import { initFilmLoader, reportLoadProgress, wasCurtainLifted } from './film-loader.js'

const MODEL_URL = import.meta.env.BASE_URL + 'models/arm-opt.glb'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const body = document.body

/* --------------------------------------------------------- smooth scroll */
let lenis = null
function initScroll() {
  if (reducedMotion) return null
  return import('lenis')
    .then(({ default: Lenis }) => {
      lenis = new Lenis({
        duration: 1.15,
        smoothWheel: true,
        wheelMultiplier: 1,
      })
      const raf = (time) => {
        lenis.raf(time)
        requestAnimationFrame(raf)
      }
      requestAnimationFrame(raf)
      return lenis
    })
    .catch(() => null)
}

/* -------------------------------------------------------------- the scene */
const ACTS = [...document.querySelectorAll('.act')].map((el) => ({
  el,
  stop: el.dataset.stop,
  ghost: el.dataset.ghost || '',
  index: el.dataset.index || '',
}))

const SCAN_INDEX = ACTS.findIndex((a) => a.stop === 'scan')
const FREE_INDEX = ACTS.findIndex((a) => a.stop === 'free')
const SCAN_BOUNDARY = SCAN_INDEX - 1
const isFree = () => activeAct === FREE_INDEX

// Copy for the click-through details in the Free view. Facts only — the same
// numbers the tables and the EPQ report use.
const PART_INFO = {
  j1: {
    id: 'J1',
    title: 'Base yaw',
    rows: [
      ['Travel', '±120°'],
      ['Actuator', 'UMIR57 stepper'],
      ['Reduction', '25 : 1 planetary'],
      ['Torque', '19 N·m'],
    ],
  },
  j2: {
    id: 'J2',
    title: 'Shoulder pitch',
    rows: [
      ['Travel', '0–150°'],
      ['Actuator', 'UMIR57 stepper'],
      ['Reduction', '50 : 1 worm · self-locking'],
      ['Torque', '5.4 N·m'],
    ],
  },
  j3: {
    id: 'J3',
    title: 'Upper-arm roll',
    rows: [
      ['Travel', '±135°'],
      ['Actuator', 'UMIR42 stepper'],
      ['Role', 'rolls the upper arm'],
    ],
  },
  j4: {
    id: 'J4',
    title: 'Elbow pitch',
    rows: [
      ['Travel', '0–140°'],
      ['Actuator', 'UMIR42 stepper'],
      ['Role', 'folds the forearm'],
    ],
  },
  j5: {
    id: 'J5',
    title: 'Wrist roll',
    rows: [
      ['Travel', '±180°'],
      ['Actuator', 'UMIR42 stepper'],
      ['Role', 'orients the end effector'],
    ],
  },
}

let hoverPartId = null
let hideDetailCard = null

let scene = null
let activeAct = 0
let scrollPrev = typeof window !== 'undefined' ? window.scrollY : 0
let scrollDir = 1
// Preset hygiene: the camera is only "borrowed" by a slide. A one-shot reset
// when a slide's transition starts (t > 0.5) and when a new slide is reached
// makes every arrival identical, however the visitor left the previous slide.
let stopIndex = -1
let resetMark = -1

const canvas = document.getElementById('arm-canvas')
const phone = window.matchMedia('(max-width: 820px)').matches

// Old GPUs / blocked WebGL are an expected environment, not an error: probe
// before importing three.js so the still plate wins without console errors.
function hasWebGL() {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

// Scene creation is kicked off one frame after boot (so the loader paints
// first), in parallel with the loader. Parsing the GLB and building the
// 90k-point cloud is several hundred ms of main-thread work; the curtain is
// what covers it. The loader then waits for `scene.ready` — the first frame
// with the real model — so the still plate is never seen as a preview.
let sceneTask = null
function startScene() {
  if (sceneTask) return sceneTask
  if (!canvas) return Promise.resolve(null)
  if (!hasWebGL()) {
    console.warn('[scene] WebGL unavailable, keeping still render')
    return Promise.resolve(null)
  }
  sceneTask = (async () => {
    try {
      scene = await createArmScene(canvas, {
        modelUrl: MODEL_URL,
        reducedMotion,
        phone,
        deferEntry: !reducedMotion,
        onLoadProgress: reportLoadProgress,
      })
      await scene.ready
      window.__scene = scene // dev/QA handle (harmless)
      body.classList.add('scene-ready')
      applyStop(activeAct, 1)
      // Curtain already up (slow load past the safety valve): play it now.
      if (wasCurtainLifted()) scene.playEntry?.()
      return scene
    } catch (err) {
      console.warn('[scene] unavailable, keeping still render:', err)
      return null
    }
  })()
  return sceneTask
}

function applyStop(i, t = 1, dir = 0) {
  const act = ACTS[i]
  if (!act || !scene) return
  try {
    if (act.stop === 'free') {
      // Hand-over zone: once the visitor scrolls out of the act (in either
      // direction) the camera eases back to the neighbouring preset, so every
      // slide always arrives in the same framing no matter how they left the
      // free view.
      if (t > 0.72 && dir !== 0) {
        const next = ACTS[i + 1]
        scene.setControlMode('scroll')
        scene.setStop('free', 1)
        if (dir > 0 && next) {
          const bt = Math.min(1, (t - 0.72) / 0.28)
          scene.setStop(next.stop, bt)
        }
        return
      }
      // Free view: the visitor owns orbit + zoom, the page stops steering.
      scene.setStop('free', 1)
      scene.setControlMode('free')
      return
    }
    scene.setControlMode('scroll')
    // The scene blends between an arrived stop and a destination stop:
    // pin the current one, then blend towards the next by its local progress.
    scene.setStop(act.stop, 1)
    const next = ACTS[i + 1]
    if (next && t < 1) scene.setStop(next.stop, t)
  } catch {
    /* scene not ready — no-op */
  }
}

/* --------------------------------------------------------------- ghost type */
const ghostEl = document.getElementById('ghost')
let ghostWord = ghostEl ? ghostEl.textContent : ''
let ghostTimer = 0
function setGhost(word) {
  if (!ghostEl || !word || word === ghostWord) return
  ghostWord = word
  clearTimeout(ghostTimer)
  ghostEl.classList.add('is-out')
  ghostTimer = window.setTimeout(() => {
    ghostEl.textContent = word
    ghostEl.classList.remove('is-out')
  }, reducedMotion ? 0 : 280)
}

/* ---------------------------------------------------------------- progress */
const progressNum = document.getElementById('progress-num')
const progressTicks = [...document.querySelectorAll('#progress-ticks li')]
function setProgress(i) {
  if (progressNum) progressNum.textContent = String(i + 1).padStart(2, '0')
  progressTicks.forEach((li, n) => li.classList.toggle('on', n === i))
}

/* ------------------------------------------------------- motion transitions */
const stageEl = document.querySelector('.stage')
const scanLine = document.getElementById('scan-line')
const rootStyle = document.documentElement.style
// Each boundary uses a different motion family (see CSS): rise, split,
// slide, dolly. Pure movement, single palette — no colour wipes.
let vel = 0
let lastY = window.scrollY
let specsCounted = false

function countSpecs() {
  if (specsCounted || reducedMotion) return
  specsCounted = true
  const nums = [...document.querySelectorAll('.spec-num')]
  if (!nums.length) return
  const targets = nums.map((el) => Number(el.textContent) || 0)
  const start = performance.now()
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 900)
    const e = 1 - Math.pow(1 - t, 3)
    nums.forEach((el, n) => {
      el.textContent = String(Math.round(targets[n] * e))
    })
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// Which named joint a transition dives into. Boundary 3 (free view -> scan) is
// the scan itself, so it has no close-up. The film now ends on the scan act.
const CLOSEUP_BY_BOUNDARY = ['shoulder', 'elbow', null, null]

function updateStage(y, vh) {
  if (!stageEl || reducedMotion) return
  let fam = 'none'
  let bump = 0
  let scanP = null
  let closeAnchor = null
  for (let n = 0; n < ACTS.length - 1; n++) {
    const centre = ACTS[n + 1].el.offsetTop - vh * 0.5
    const span = vh * 0.36
    const p = (y - (centre - span)) / (span * 2)
    if (p > 0 && p < 1) {
      fam = ACTS[n + 1].el.dataset.ent || 'none'
      bump = Math.sin(Math.PI * p)
      if (n === SCAN_BOUNDARY) scanP = p
      else closeAnchor = CLOSEUP_BY_BOUNDARY[n]
    }
  }
  stageEl.dataset.fam = fam
  rootStyle.setProperty('--bump', bump.toFixed(3))

  if (!scene) return
  scene.setCloseUp(closeAnchor || 'elbow', closeAnchor ? bump * (phone ? 0.3 : 0.85) : 0)
  if (scanP !== null) {
    scene.setScan(scanP)
  } else if (activeAct === 3) {
    scene.setScan(1)
  } else {
    scene.setScan(null)
  }
  if (!userMode) setMode(scanP !== null || activeAct === SCAN_INDEX ? 'xray' : 'mesh', false)

  if (scanLine) {
    if (scanP !== null && scene.scanScreenY) {
      const y = scene.scanScreenY()
      if (y !== null && Number.isFinite(y)) {
        scanLine.style.top = `${y.toFixed(1)}px`
        scanLine.style.opacity = '1'
      } else {
        scanLine.style.opacity = '0'
      }
    } else {
      scanLine.style.opacity = '0'
    }
  }
}

function updateTransitions(y, vh) {
  if (reducedMotion) return
  updateStage(y, vh)
  for (const a of ACTS) {
    const top = a.el.offsetTop
    const enter = Math.min(1, Math.max(0, (y - (top - vh * 0.8)) / (vh * 0.8)))
    const exit = Math.min(1, Math.max(0, (y - (top + vh * 0.2)) / (vh * 0.6)))
    a.el.style.setProperty('--enter', enter.toFixed(3))
    a.el.style.setProperty('--exit', exit.toFixed(3))
  }
}

function updateVelocity(y) {
  if (reducedMotion) return
  const raw = (y - lastY) / 220
  lastY = y
  const target = Math.max(-1, Math.min(1, raw))
  vel += (target - vel) * 0.12
  document.documentElement.style.setProperty('--vel', vel.toFixed(3))
}

/* -------------------------------------------------------------- scroll map */
function measure() {
  const y = window.scrollY
  const vh = window.innerHeight
  const delta = y - scrollPrev
  scrollPrev = y
  if (Math.abs(delta) > 0.5) scrollDir = delta > 0 ? 1 : -1

  // Cross-fade each act's copy with the fold so two sections' text never shout
  // over each other during a transition.
  for (const a of ACTS) {
    const top = a.el.getBoundingClientRect().top
    const f = Math.min(1, Math.max(0.04, 1 - Math.abs(top) / (vh * 0.82)))
    a.el.style.setProperty('--f', f.toFixed(3))
  }
  updateVelocity(y)

  // Stops sit at the top of each 100vh act. Scroll progress between two act
  // tops is the blend t; the act whose top is closest to the fold owns the
  // chrome (ghost word, progress, mode).
  let i = 0
  for (let n = 0; n < ACTS.length; n++) {
    if (y >= ACTS[n].el.offsetTop - 1) i = n
  }
  const act = ACTS[i]
  const next = ACTS[i + 1]
  const start = act.el.offsetTop
  const end = next ? next.el.offsetTop : start + act.el.offsetHeight
  const t = Math.min(1, Math.max(0, (y - start) / Math.max(1, end - start)))

  // every slide must arrive in its preset framing: wipe any borrowed orbit /
  // zoom when the transition into the next slide starts, and again on arrival
  if (i !== stopIndex) {
    stopIndex = i
    resetMark = -1
    if (scene && ACTS[i].stop !== 'free') scene.releaseManual?.()
  }
  if (scene && ACTS[i].stop !== 'free' && t > 0.5 && resetMark !== i) {
    scene.releaseManual?.()
    resetMark = i
  }

  const shown = t > 0.5 && next ? i + 1 : i
  if (shown !== activeAct) {
    activeAct = shown
    const shownAct = ACTS[shown]
    setGhost(shownAct.ghost)
    setProgress(shown)
    if (shown === 1) countSpecs()
    if (shown !== FREE_INDEX && hideDetailCard) hideDetailCard()
  }
  applyStop(i, t, scrollDir)
  // Runs last: the stage/scan/close-up state depends on the freshly updated
  // activeAct (otherwise it is one frame behind and can sit in the wrong mode).
  updateTransitions(y, vh)
}

let queued = false
function onScroll() {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    measure()
  })
}
window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', () => {
  onScroll()
  if (scene) scene.resize?.()
})

/* --------------------------------------------------------------- reveals */
function initReveals() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add('is-in')
      }
    },
    { rootMargin: '0px 0px -18% 0px', threshold: 0.12 },
  )
  ACTS.forEach((a) => io.observe(a.el))
}

/* ------------------------------------------------------------------ cursor */
function initCursor() {
  const cursor = document.getElementById('cursor')
  const label = document.getElementById('cursor-label')
  if (!cursor || reducedMotion) return
  let x = window.innerWidth / 2
  let y = window.innerHeight / 2
  let cx = x
  let cy = y

  const loop = () => {
    cx += (x - cx) * 0.22
    cy += (y - cy) * 0.22
    cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  window.addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX
      y = e.clientY
      cursor.classList.add('is-on')

      const target = e.target instanceof Element ? e.target.closest('a, button, [data-cursor]') : null
      const overCanvas = e.target === canvas
      cursor.classList.toggle('is-hover', Boolean(target) || overCanvas)
      if (label) {
        label.textContent = target?.dataset.cursor
          ? target.dataset.cursor.toUpperCase()
          : overCanvas
            ? isFree() && hoverPartId
              ? 'CLICK'
              : 'DRAG'
            : ''
      }
    },
    { passive: true },
  )
  window.addEventListener(
    'pointermove',
    (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      scene?.setPointer?.(nx, ny)
    },
    { passive: true },
  )
  window.addEventListener('pointerleave', () => cursor.classList.remove('is-on'))
}

/* ------------------------------------------------------------- frame counter */
function initFrameCounter() {
  const el = document.getElementById('chrome-frame')
  if (!el || reducedMotion) return 0
  let frames = 0
  let last = 0
  const loop = (now) => {
    frames++
    if (now - last > 80) {
      last = now
      el.textContent = 'F ' + String(frames).padStart(6, '0')
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

/* ------------------------------------------------------------------- clock */
function initClock() {
  const el = document.getElementById('clock')
  if (!el) return
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const update = () => {
    el.textContent = `GMT+8 ${fmt.format(new Date())}`
  }
  update()
  setInterval(update, 15000)
}

/* ----------------------------------------------------------- index overlay */
function initIndex() {
  const toggle = document.getElementById('index-toggle')
  const panel = document.getElementById('index-panel')
  if (!toggle || !panel) return

  const setOpen = (open) => {
    panel.hidden = false
    panel.classList.toggle('is-open', open)
    toggle.setAttribute('aria-expanded', String(open))
    body.style.overflow = open ? 'hidden' : ''
    // Focus only once the panel is actually visible: a focused element inside a
    // still-hidden panel silently refuses focus, and the visibility transition
    // keeps it hidden for a frame or two after the class lands.
    if (open) focusWhenVisible()
    else if (panel.contains(document.activeElement)) toggle.focus({ preventScroll: true })
  }

  const focusWhenVisible = (frames = 0) => {
    const first = panel.querySelector('a')
    if (!first) return
    if (getComputedStyle(panel).visibility === 'visible') first.focus({ preventScroll: true })
    else if (frames < 30) requestAnimationFrame(() => focusWhenVisible(frames + 1))
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true')
  })
  panel.addEventListener('click', (e) => {
    if (e.target === panel) setOpen(false)
  })
  panel.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false))
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false)
  })
}

/* --------------------------------------------------------------- mode switch */
let userMode = null
let appliedMode = null
function setMode(mode, fromUser = true) {
  if (fromUser) userMode = mode
  if (mode === appliedMode && !fromUser) return
  appliedMode = mode
  document.querySelectorAll('.mode button').forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === mode)
  })
  scene?.setMode?.(mode)
}

function initMode() {
  const buttons = [...document.querySelectorAll('.mode button')]
  if (!buttons.length) return
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode, true))
  })
}

/* -------------------------------------------------------------- free view */
function initFreeView() {
  const card = document.getElementById('detail-card')
  if (!card) return
  const closeBtn = document.getElementById('detail-close')
  const idEl = document.getElementById('detail-id')
  const titleEl = document.getElementById('detail-title')
  const rowsEl = document.getElementById('detail-rows')

  const hideCard = () => {
    card.hidden = true
    body.classList.remove('detail-open')
    if (scene) scene.setHighlight?.(null)
  }
  hideDetailCard = hideCard

  const showCard = (partId) => {
    const info = PART_INFO[partId]
    if (!info) return hideCard()
    if (idEl) idEl.textContent = info.id
    if (titleEl) titleEl.textContent = info.title
    if (rowsEl) {
      rowsEl.innerHTML = ''
      for (const [label, value] of info.rows) {
        const dt = document.createElement('dt')
        dt.textContent = label
        const dd = document.createElement('dd')
        dd.textContent = value
        rowsEl.append(dt, dd)
      }
    }
    card.hidden = false
    body.classList.add('detail-open')
    if (scene) scene.setHighlight?.(partId)
  }

  closeBtn?.addEventListener('click', hideCard)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCard()
  })

  document.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      scene?.zoomBy?.(btn.dataset.zoom === 'in' ? 0.85 : 1.18)
    })
  })
  document.querySelector('[data-free-reset]')?.addEventListener('click', () => {
    scene?.resetView?.()
    hideCard()
    hoverPartId = null
    scene?.setHighlight?.(null)
  })

  // hover: highlight + cursor label (mouse only)
  let lastHover = 0
  canvas.addEventListener('pointermove', (e) => {
    if (!isFree() || e.pointerType !== 'mouse') return
    const now = performance.now()
    if (now - lastHover < 60) return
    lastHover = now
    const hit = scene?.pick?.(e.clientX, e.clientY)
    const nextId = hit?.id || null
    if (nextId !== hoverPartId) {
      hoverPartId = nextId
      scene?.setHighlight?.(hoverPartId)
    }
  })
  canvas.addEventListener('pointerleave', () => {
    hoverPartId = null
    if (isFree() && scene) scene.setHighlight?.(null)
  })

  // click (not a drag): open details for the part under the pointer
  let downX = 0
  let downY = 0
  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX
    downY = e.clientY
  })
  canvas.addEventListener('pointerup', (e) => {
    if (!isFree()) return
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7) return
    const hit = scene?.pick?.(e.clientX, e.clientY)
    if (hit?.id) showCard(hit.id)
    else hideCard()
  })
}

/* ------------------------------------------------------------- drag orbit */
function initDrag() {
  if (!canvas) return
  let dragging = false
  let lastX = 0
  let lastY = 0

  const down = (e) => {
    if (e.target !== canvas) return
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.classList.add('is-grabbing')
    canvas.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    scene?.setOrbit?.(dx * 0.005, dy * 0.004)
  }
  const up = (e) => {
    if (!dragging) return
    dragging = false
    canvas.classList.remove('is-grabbing')
    canvas.releasePointerCapture?.(e.pointerId)
  }
  canvas.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/* -------------------------------------------------------------- boot */
// The curtain needs the scene's promise before the scene exists: settle it once
// startScene() runs on the next frame.
let settleScene = () => {}
const sceneReady = new Promise((resolve) => {
  settleScene = resolve
})
initFilmLoader({
  reducedMotion,
  sceneReady,
  // The film's entry reveal starts with the curtain, not under it.
  onLift: () => scene?.playEntry?.(),
})
initReveals()
initCursor()
initClock()
initFrameCounter()
initIndex()
initMode()
initDrag()
initFreeView()

initScroll()
measure()

// Next frame: the loader has painted, so the heavy scene work no longer delays
// the first visible frame.
requestAnimationFrame(() => {
  startScene().then(settleScene)
})

// Keep the scene in sync if fonts or images change layout.
window.addEventListener('load', () => {
  onScroll()
  if (scene) scene.resize?.()
})
