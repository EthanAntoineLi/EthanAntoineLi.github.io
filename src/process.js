// ============================================================================
// process.js — Sheet 01 / process page.
//
// The arm film's chrome and act choreography, plus the 3D stage this page
// owns: the indexing turret of parts on the hero (spin it by hand, click a
// part to bring it round), the A1 mini that leaves it for 01 / Why, the three
// motor types that hover on 04 / Motors, the A1 mini printing the J1 → J2 link
// on 08 / Printing (the download link shows once the print is done) and that
// link parked in Rev B's frame on 09 / Revision, with the first design (Rev A)
// in the frame beside it, under the same physics. Every hand-off between them
// is scrubbed by the scroll (syncTrack), so the 3D moves with the copy; the
// copy-and-table acts in between leave the stage empty.
// Scene: ./process-stage.js. Balloons: ./process-hud.js. Curtain: ./film-loader.js.
// ============================================================================
import { createProcessStage } from './process-stage.js'
import { createRingHud } from './process-hud.js'
import motorsUrl from './assets/process/arm-motors.glb?url'
import { initFilmLoader, reportLoadProgress, wasCurtainLifted } from './film-loader.js'

const PRINTER_MODEL_URL = import.meta.env.BASE_URL + 'models/printer-a1-mini.glb'
const LINK_MODEL_URL = import.meta.env.BASE_URL + 'models/arm-parts/parts/link-J1-J2.glb'
const REV_A_MODEL_URL = import.meta.env.BASE_URL + 'models/arm-parts/parts/link-J1-J2-rev-a.glb'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const body = document.body
const canvas = document.getElementById('printer-canvas')
const hudCanvas = document.getElementById('ring-hud')
const phone = window.matchMedia('(max-width: 820px)').matches

// The turret's balloons: the printer, then the five actuators as built
// (05 / Gearboxes on the page carries the same facts).
const RING_PARTS = {
  printer: { n: '01', name: 'A1 mini', spec: 'Bambu Lab · 3D printer' },
  'motor-J1': { n: '02', name: 'J1 · base', spec: 'UMIR57 · planetary 25:1' },
  'motor-J2': { n: '03', name: 'J2 · shoulder', spec: 'UMIR42 · worm 50:1' },
  'motor-J3': { n: '04', name: 'J3 · roll', spec: 'UMIR42 · planetary 50:1' },
  'motor-J4': { n: '05', name: 'J4 · pitch', spec: 'UMIR42 · planetary 50:1' },
  'motor-J5': { n: '06', name: 'J5 · roll', spec: 'UMIR42 · planetary 50:1' },
}

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
   printer takes over for 01, the motors hover for 04, the printer prints for
   08 and the printed link sits in its frame for 09; every other act is copy
   only ('off'). */
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
      const hud = hudCanvas ? createRingHud(hudCanvas, { parts: RING_PARTS, reducedMotion, phone }) : null
      scene = await createProcessStage(canvas, {
        printerUrl: PRINTER_MODEL_URL,
        motorsUrl,
        linkUrl: LINK_MODEL_URL,
        revAUrl: REV_A_MODEL_URL,
        reducedMotion,
        phone,
        onLoadProgress: reportLoadProgress,
        onFrame: (frame) => {
          hud?.draw(frame)
          syncSlot()
        },
        onPrint: showPrint,
      })
      if (!scene) return null
      await scene.ready
      window.__printer = scene // dev/QA handle (harmless)
      window.__processStage = scene
      body.classList.add('scene-ready')
      if (!scene.printable) body.classList.add('no-part')
      if (scene.hasRevA) body.classList.add('compare-a-live')
      syncTrack()
      syncStage()
      scene.setStage(wantedStage) // honour a deep link / restored scroll position
      if (wasCurtainLifted()) scene.play() // the safety valve lifted it first
      return scene
    } catch (err) {
      console.warn('[scene] unavailable, keeping still render:', err)
      return null
    }
  })()
  return sceneTask
}

/* Where the printer's, the motors' and the print's acts sit, in viewports past
   the top of the screen — the stage moves each object with its own act. */
const PRINTER_ACT = ACTS.find((a) => a.stage === 'printer')
const MOTORS_ACT = ACTS.find((a) => a.stage === 'motors')
const PRINT_ACT = ACTS.find((a) => a.stage === 'print')
function syncTrack() {
  if (!scene || !PRINTER_ACT || !MOTORS_ACT) return
  const y = window.scrollY
  const vh = window.innerHeight || 1
  scene.setTrack(
    (y - PRINTER_ACT.el.offsetTop) / vh,
    (y - MOTORS_ACT.el.offsetTop) / vh,
    PRINT_ACT ? (y - PRINT_ACT.el.offsetTop) / vh : -3,
  )
}

/* Both revision frames are handed over as they are on screen, entrance and
   reveal transforms included, so the printed link lands exactly in Rev B's and
   Rev A sits exactly in its own. Read every rendered frame while 09 is near
   (the transforms run on their own). Rev A shows once its frame is revealed. */
const COMPARE_ACT = ACTS.find((a) => a.stage === 'compare')
const compareSlot = document.getElementById('compare-slot')
const compareSlotA = document.getElementById('compare-slot-a')
let slotSynced = false
function syncSlot() {
  if (!scene || !compareSlot || !COMPARE_ACT) return
  const vh = window.innerHeight || 1
  const vw = window.innerWidth || 1
  if (slotSynced && Math.abs(window.scrollY - COMPARE_ACT.el.offsetTop) > vh * 1.8) {
    scene.setSlotA(null)
    return
  }
  slotSynced = true
  const r = compareSlot.getBoundingClientRect()
  scene.setSlot(r.left / vw, r.top / vh, r.width / vw, r.height / vh)
  if (compareSlotA && COMPARE_ACT.el.classList.contains('is-in')) {
    const a = compareSlotA.getBoundingClientRect()
    scene.setSlotA(a.left / vw, a.top / vh, a.width / vw, a.height / vh)
  } else {
    scene.setSlotA(null)
  }
}

/* -------------------------------------------------------------- the print */
// Step 03's status line follows the print; once it is done the download link
// takes its place (body.print-done). A scene that never prints shows it at once.
const printStatusLabel = document.getElementById('print-status-label')
const printStatusPct = document.getElementById('print-status-pct')
const printMeter = document.getElementById('print-meter')
function showPrint({ progress, done }) {
  const p = done ? 1 : Math.min(1, Math.max(0, Number(progress) || 0))
  if (printStatusPct) printStatusPct.textContent = `${Math.round(p * 100)}%`
  if (printMeter) printMeter.style.setProperty('--p', p.toFixed(3))
  if (done) {
    if (printStatusLabel) printStatusLabel.textContent = 'Printed · link J1 → J2'
    body.classList.add('print-done')
  }
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
    // the no-WebGL still steps aside for the copy-only acts' tables
    body.classList.toggle('stage-idle', wanted === 'off')
  }
}

/* -------------------------------------------------------- turret by hand */
// Mouse: drag anywhere on the ring to spin it, click a part to bring it round.
// Touch: a tap on a part brings it round; swipes stay the page's scroll.
let turning = false
function initTurretHand() {
  if (reducedMotion) return
  let tap = null
  const blocked = (e) =>
    e.target instanceof Element && Boolean(e.target.closest('a, button, input, .index-panel, .chrome'))

  window.addEventListener('pointerdown', (e) => {
    if (!scene || blocked(e)) return
    if (e.pointerType === 'mouse') {
      if (e.button !== 0 || !scene.grab(e.clientX, e.clientY)) return
      turning = true
      e.preventDefault()
      document.documentElement.classList.add('is-turning')
    } else {
      tap = { x: e.clientX, y: e.clientY, t: performance.now() }
    }
  })
  window.addEventListener(
    'pointermove',
    (e) => {
      if (turning) scene?.drag(e.clientX)
    },
    { passive: true },
  )
  const end = (e) => {
    if (turning) {
      turning = false
      scene?.release()
      document.documentElement.classList.remove('is-turning')
    }
    if (tap && e?.type === 'pointerup') {
      const near = Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10
      if (near && performance.now() - tap.t < 450) {
        const id = scene?.pick(e.clientX, e.clientY)
        if (id) scene.present(id)
      }
    }
    tap = null
  }
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  window.addEventListener('blur', end)
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

// An act taller than the screen (a table on a phone) only starts to leave once
// its bottom edge has come up: `over` is how far it runs past one viewport.
function overrun(a, vh) {
  return Math.max(0, a.el.offsetHeight - vh)
}

function updateTransitions(y, vh) {
  if (reducedMotion) return
  for (const a of ACTS) {
    const top = a.el.offsetTop
    const enter = Math.min(1, Math.max(0, (y - (top - vh * 0.8)) / (vh * 0.8)))
    const exit = Math.min(1, Math.max(0, (y - (top + overrun(a, vh) + vh * 0.2)) / (vh * 0.6)))
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
    const over = overrun(a, vh)
    const off = top > 0 ? top : top < -over ? -(top + over) : 0
    const f = Math.min(1, Math.max(0.04, 1 - off / (vh * 0.82)))
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
  syncTrack()
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
      // a part on the turret is a control too: drag to spin, click to bring round
      const part = !target && (turning || scene?.pick(x, y))
      document.documentElement.classList.toggle('over-part', Boolean(part))
      cursor.classList.toggle('is-hover', Boolean(target || part))
      if (label) {
        label.textContent = part ? 'DRAG' : target?.dataset.cursor ? target.dataset.cursor.toUpperCase() : ''
      }
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
  // the turret spins up out of its hub as the curtain goes
  onLift: () => scene?.play(),
})
initReveals()
initTurretHand()
initCursor()
initClock()
initFrameCounter()
initIndex()
initScroll()
measure()

requestAnimationFrame(() => {
  startScene().then((ready) => {
    // no scene, no print: the models are still a click away
    if (!ready) showPrint({ progress: 1, done: true })
    settleScene(ready)
  })
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
