// ============================================================================
// process.js — Sheet 01 / process page.
//
// The arm film's chrome and act choreography, plus the 3D stage this page
// owns: the motor ring that spins on the hero, the A1 mini that leaves it for
// step 01, and the three motor types that hover on step 02.
// Scene: ./process-stage.js. Curtain: ./film-loader.js.
// ============================================================================
import { createProcessStage } from './process-stage.js'
import motorsUrl from './assets/process/arm-motors.glb?url'
import { initFilmLoader, reportLoadProgress } from './film-loader.js'

const PRINTER_MODEL_URL = import.meta.env.BASE_URL + 'models/printer-a1-mini.glb'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const body = document.body
const canvas = document.getElementById('printer-canvas')
const phone = window.matchMedia('(max-width: 820px)').matches

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

/* -------------------------------------------------------------- the acts */
const ACTS = [...document.querySelectorAll('.act')].map((el) => ({
  el,
  stop: el.dataset.stop || '',
  ghost: el.dataset.ghost || '',
  index: el.dataset.index || '',
  // which 3D object (if any) lives behind this act, and its framing preset
  stage: el.dataset.stage || '',
  preset: el.dataset.preset || '',
}))
let activeAct = 0

/* Which stage the scroll position wants. The ring spins on the hero, the
   printer takes over for 01, the motors hover for 02; 03+ are copy only. */
let wantedStage = 'ring'
let lastStageY = 0

/* --------------------------------------------------------- the 3D printer */
// Same contract as the arm film: probe WebGL before importing three.js, start
// the scene in parallel with the loader, and let a failed scene fall back to
// the still plate without a console error.
function hasWebGL() {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

let scene = null
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
      scene = await createProcessStage(canvas, {
        printerUrl: PRINTER_MODEL_URL,
        motorsUrl,
        reducedMotion,
        phone,
        onLoadProgress: reportLoadProgress,
      })
      if (!scene) return null
      await scene.ready
      window.__printer = scene // dev/QA handle (harmless)
      window.__processStage = scene
      body.classList.add('scene-ready')
      syncStage()
      scene.setStage(wantedStage) // honour a deep link / restored scroll position
      return scene
    } catch (err) {
      console.warn('[scene] unavailable, keeping still render:', err)
      return null
    }
  })()
  return sceneTask
}

function syncStage() {
  const y = window.scrollY
  const vh = window.innerHeight
  const dir = y >= lastStageY ? 1 : -1
  lastStageY = y

  // Walk the acts and take the last one whose approach threshold has passed.
  let wanted = ACTS[0] ? ACTS[0].stage || 'off' : 'off'
  for (let i = 1; i < ACTS.length; i++) {
    const act = ACTS[i]
    const trigger = act.el.offsetTop - vh * (dir > 0 ? 0.55 : 0.72)
    if (y >= trigger) wanted = act.stage || 'off'
  }
  if (wanted !== wantedStage) {
    wantedStage = wanted
    scene?.setStage(wanted)
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
  ghostTimer = window.setTimeout(
    () => {
      ghostEl.textContent = word
      ghostEl.classList.remove('is-out')
    },
    reducedMotion ? 0 : 280,
  )
}

/* ---------------------------------------------------------------- progress */
const progressNum = document.getElementById('progress-num')
const progressTicks = [...document.querySelectorAll('#progress-ticks li')]
function setProgress(i) {
  if (progressNum) progressNum.textContent = String(i + 1).padStart(2, '0')
  progressTicks.forEach((li, n) => li.classList.toggle('on', n === i))
}

/* ------------------------------------------------------- motion transitions */
let vel = 0
let lastY = window.scrollY

function updateTransitions(y, vh) {
  if (reducedMotion) return
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

  // Cross-fade each act's copy with the fold so two sections' text never shout
  // over each other during a transition.
  for (const a of ACTS) {
    const top = a.el.getBoundingClientRect().top
    const f = Math.min(1, Math.max(0.04, 1 - Math.abs(top) / (vh * 0.82)))
    a.el.style.setProperty('--f', f.toFixed(3))
  }
  updateVelocity(y)

  // The act whose top is closest to the fold owns the chrome (ghost word,
  // progress). Stops sit at the top of each 100vh act.
  let i = 0
  for (let n = 0; n < ACTS.length; n++) {
    if (y >= ACTS[n].el.offsetTop - 1) i = n
  }
  const act = ACTS[i]
  const next = ACTS[i + 1]
  const start = act.el.offsetTop
  const end = next ? next.el.offsetTop : start + act.el.offsetHeight
  const t = Math.min(1, Math.max(0, (y - start) / Math.max(1, end - start)))

  const shown = t > 0.5 && next ? i + 1 : i
  if (shown !== activeAct) {
    activeAct = shown
    const shownAct = ACTS[shown]
    setGhost(shownAct.ghost)
    setProgress(shown)
    body.classList.toggle('at-end', shown === ACTS.length - 1)
  }
  syncStage()
  // Runs last: transition state depends on the freshly updated activeAct.
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
window.addEventListener('resize', onScroll)

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
      cursor.classList.toggle('is-hover', Boolean(target))
      if (label) label.textContent = target?.dataset.cursor ? target.dataset.cursor.toUpperCase() : ''
    },
    { passive: true },
  )
  window.addEventListener('pointerleave', () => cursor.classList.remove('is-on'))
}

/* ------------------------------------------------------------- frame counter */
function initFrameCounter() {
  const el = document.getElementById('chrome-frame')
  if (!el || reducedMotion) return
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

/* -------------------------------------------------------------- boot */
// The curtain needs the scene's promise before the scene exists: settle it once
// startScene() runs on the next frame, after the loader has painted.
let settleScene = () => {}
const sceneReady = new Promise((resolve) => {
  settleScene = resolve
})
initFilmLoader({
  reducedMotion,
  sceneReady,
  // The stage is a static object, not a film: no entry reveal to start.
  onLift: () => {},
})
initReveals()
initCursor()
initClock()
initFrameCounter()
initIndex()
initScroll()
measure()

requestAnimationFrame(() => {
  startScene().then(settleScene)
})

// pointer parallax on the object (the canvas itself is not interactive)
window.addEventListener(
  'pointermove',
  (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    scene?.setPointer?.(nx, ny)
  },
  { passive: true },
)

// Keep the layout in sync if fonts or images change the act heights.
window.addEventListener('load', onScroll)
