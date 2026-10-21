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
// Part hover / click are live only while the visitor owns the camera: from
// arriving in the free view until the scroll hand-off takes it back.
let freeControl = false
const isFree = () => activeAct === FREE_INDEX && freeControl

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

// Free view -> scan: one timeline on the free act's local scroll progress t
// (0 = the free view at rest, 1 = the scan act has arrived).
//   0    – hand   free view: the visitor owns orbit + zoom (idle spin after 4 s)
//   hand          control returns to the page: no snap, the idle spin stops
//   hand – camEnd camera free -> scan, the visitor's orbit / zoom easing out on
//                 the same curve (span 0.6, close to the other moves' 1.0)
//   wipeStart – wipeEnd  the cut sweeps the arm top -> bottom in the scan
//                 framing: x-ray above it, the solid model below
// Reversing retraces the same positions, so nothing depends on direction.
const SCAN_TIMELINE = { hand: 0.08, camEnd: 0.68, wipeStart: 0.48, wipeEnd: 0.96 }
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth01 = (v) => {
  const x = clamp01(v)
  return x * x * (3 - 2 * x)
}
let scanTarget = 0 // scroll-driven wipe progress: 0 = base look, 1 = x-ray
let scanSnap = true // the first placement jumps (no wipe replay on load)

function applyStop(i, t = 1, dir = 0) {
  const act = ACTS[i]
  if (!act || !scene) return
  try {
    const next = ACTS[i + 1]
    freeControl = act.stop === 'free' && (dir === 0 || t < SCAN_TIMELINE.hand)
    if (!freeControl) hoverPartId = null
    if (dir === 0) {
      // Scene-ready arrival: show this act's preset now, and let a full
      // measure() on the next frame place the camera, hand-off and scan
      // exactly where the page is scrolled to.
      if (act.stop === 'free') {
        scene.setStop('free', 1)
        scene.setControlMode('free')
      } else {
        scene.setControlMode('scroll', act.stop)
        scene.setStop(act.stop, 1)
      }
      onScroll()
      return
    }
    if (act.stop === 'free') {
      const T = SCAN_TIMELINE
      if (t < T.hand) {
        // Free view: the visitor owns orbit + zoom. A hand-off that had begun
        // is undone, so scrolling back gives them their own view again.
        scene.setStop('free', 1)
        scene.releaseManual(0)
        scene.setControlMode('free')
      } else {
        // The page has the camera again: free -> next on one curve, with the
        // visitor's orbit / zoom eased out on that same curve.
        const u = clamp01((t - T.hand) / (T.camEnd - T.hand))
        scene.setControlMode('scroll', next ? next.stop : act.stop)
        scene.setStop('free', 1)
        if (next) scene.setStop(next.stop, u)
        scene.releaseManual(smooth01(u))
        if (hideDetailCard) hideDetailCard()
      }
    } else {
      scene.setControlMode('scroll', act.stop)
      // The scene blends between an arrived stop and a destination stop:
      // pin the current one, then blend towards the next by its local progress.
      scene.setStop(act.stop, 1)
      if (next && t < 1) scene.setStop(next.stop, t)
      // Scrolling up out of the free view eases its orbit / zoom out along
      // this blend; any other act finishes a pending hand-off on its own.
      scene.releaseManual(next && next.stop === 'free' ? 1 - smooth01(t) : 1)
    }
    if (i >= SCAN_INDEX) scanTarget = 1
    else if (i !== SCAN_BOUNDARY) scanTarget = 0
    else if (reducedMotion) scanTarget = activeAct === SCAN_INDEX ? 1 : 0
    else {
      const T = SCAN_TIMELINE
      scanTarget = smooth01((t - T.wipeStart) / (T.wipeEnd - T.wipeStart))
    }
    applyLook(scanSnap)
    scanSnap = false
  } catch {
    /* scene not ready — no-op */
  }
}

// What the arm shows. The visitor's mode pick (userMode) holds everywhere but
// the scan act: the scan always wipes from it into the x-ray, which is the
// act's content. A pick made inside the scan act cancels the wipe there and
// holds until they scroll back out of it.
let userMode = null
let scanPick = null
let modeShown = null
function applyLook(snap = false) {
  if (activeAct !== SCAN_INDEX) scanPick = null
  const base = userMode || 'mesh'
  const shown = scanPick || (scanTarget >= 0.5 ? 'xray' : base)
  if (scene) {
    scene.setMode?.(scanPick || base)
    scene.setScan?.(scanPick ? null : scanTarget, snap)
    trackScanLine()
  }
  if (shown !== modeShown) {
    modeShown = shown
    document.querySelectorAll('.mode button').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === shown)
    })
  }
}

// The hairline rides the cut on every rendered frame, not only on scroll
// events: the wipe and the camera keep easing after the scroll stops. It runs
// while a cut is on the model and stops itself once the wipe has settled.
const scanLineInfo = { alpha: 0, settled: true }
let scanLineRaf = 0
let scanLineOn = false
function trackScanLine() {
  if (scanLineRaf || !scanLine || !scene?.scanScreenY || reducedMotion) return
  const step = () => {
    const y = scene.scanScreenY(scanLineInfo)
    // Only over an untransformed canvas: elsewhere a stage motion would carry
    // the model off the line (the scan boundary itself keeps the stage still).
    const fam = stageEl ? stageEl.dataset.fam : ''
    const flat = !fam || fam === 'none'
    if (y !== null && Number.isFinite(y) && flat && scanLineInfo.alpha > 0.001) {
      const dpr = window.devicePixelRatio || 1
      const top = Math.round((y - 0.5) * dpr) / dpr // 1px line centred on the cut
      scanLine.style.transform = `translate3d(0, ${top}px, 0)`
      scanLine.style.opacity = scanLineInfo.alpha.toFixed(3)
      scanLineOn = true
    } else if (scanLineOn) {
      scanLine.style.opacity = '0'
      scanLineOn = false
    }
    if (y === null && scanLineInfo.settled) {
      scanLineRaf = 0
      return
    }
    scanLineRaf = requestAnimationFrame(step)
  }
  scanLineRaf = requestAnimationFrame(step)
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

// The spec figures count up on the same scroll progress as the body of their
// slide (--in-1), so they scrub both ways instead of running a one-shot timer.
// updateTransitions() calls this every frame; with reduced motion the figures
// keep their final values.
function countSpecs() {
  if (reducedMotion) return
  if (!specsCounted) {
    specsCounted = true
    for (const el of document.querySelectorAll('.spec-num')) {
      el.dataset.value = el.textContent
      const a = ACTS.find((x) => x.el.contains(el))
      if (!a) continue
      if (!a.specNums) a.specNums = []
      a.specNums.push(el)
    }
  }
  for (const a of ACTS) {
    if (!a.specNums || !a.textIn) continue
    for (const el of a.specNums) {
      const v = String(Math.round((Number(el.dataset.value) || 0) * a.textIn[1]))
      if (el.textContent !== v) el.textContent = v
    }
  }
}

// Which named joint a transition dives into. Boundary 3 (free view -> scan) is
// the scan itself, so it has no close-up. The film now ends on the scan act.
const CLOSEUP_BY_BOUNDARY = ['shoulder', 'elbow', null, null]

function updateStage(y, vh) {
  if (!stageEl || reducedMotion) return
  let fam = 'none'
  let bump = 0
  let closeAnchor = null
  for (let n = 0; n < ACTS.length - 1; n++) {
    const centre = ACTS[n + 1].el.offsetTop - vh * 0.5
    const span = vh * 0.36
    const p = (y - (centre - span)) / (span * 2)
    if (p > 0 && p < 1) {
      // The scan boundary keeps the stage still: the wipe is its transition
      // (camera + scan run from applyStop, the hairline from trackScanLine).
      fam = n === SCAN_BOUNDARY ? 'none' : ACTS[n + 1].el.dataset.ent || 'none'
      bump = Math.sin(Math.PI * p)
      if (n !== SCAN_BOUNDARY) closeAnchor = CLOSEUP_BY_BOUNDARY[n]
    }
  }
  stageEl.dataset.fam = fam
  rootStyle.setProperty('--bump', bump.toFixed(3))

  if (!scene) return
  scene.setCloseUp(closeAnchor || 'elbow', closeAnchor ? bump * (phone ? 0.3 : 0.85) : 0)
}

function updateTransitions(y, vh) {
  if (reducedMotion) return
  updateStage(y, vh)
  // The text hand-off (styled in src/arm-film.css). Every value is a pure
  // function of scroll position, so scrolling up plays it backwards.
  const hold = Boolean(lenis) && TEXT_HOLD_MQ.matches
  const tops = ACTS.map((a) => a.el.offsetTop) // read layout once, before any writes
  let shownText = 0
  for (let n = 0; n < ACTS.length; n++) {
    const a = ACTS[n]
    const top = tops[n]
    const prevTop = n > 0 ? tops[n - 1] : null
    const nextTop = n < ACTS.length - 1 ? tops[n + 1] : null
    // Scroll progress from the previous slide to this one, and from this one
    // to the next (the same 0..1 the camera blends over).
    const pIn = prevTop === null ? 1 : (y - prevTop) / Math.max(1, top - prevTop)
    const pOut = nextTop === null ? 0 : (y - top) / Math.max(1, nextTop - top)
    const enter = textRamp(pIn, TEXT.fade.in)
    const exit = textRamp(pOut, TEXT.fade.out)
    const f = textSmooth(enter) * (1 - textSmooth(exit))
    const in0 = textEaseOut(textRamp(pIn, TEXT.in[0]))
    const in1 = textEaseOut(textRamp(pIn, TEXT.in[1]))
    const out0 = textEaseIn(textRamp(pOut, TEXT.out[0]))
    const out1 = textEaseIn(textRamp(pOut, TEXT.out[1]))

    // Hold the copy near its rest position while the page scrolls, so it
    // fades where it was read instead of sliding under the chrome or across
    // the arm. An act taller than the viewport scrolls its overflow first.
    let dy = y - top
    if (dy > 0) {
      const span = nextTop === null ? 0 : nextTop - top
      dy = Math.min(Math.max(0, dy - Math.max(0, span - vh)), span * 0.5)
    } else if (prevTop !== null) {
      dy = Math.max(dy, -(top - prevTop) * 0.5)
    }
    const pin = hold ? dy * (1 - TEXT.drift) : 0

    a.f = f
    a.textIn = [in0, in1]
    setTextVar(a, '--enter', enter.toFixed(3))
    setTextVar(a, '--exit', exit.toFixed(3))
    setTextVar(a, '--f', f.toFixed(3))
    setTextVar(a, '--in-0', in0.toFixed(3))
    setTextVar(a, '--in-1', in1.toFixed(3))
    setTextVar(a, '--out-0', out0.toFixed(3))
    setTextVar(a, '--out-1', out1.toFixed(3))
    setTextVar(a, '--pin', `${pin.toFixed(1)}px`)
    // fully handed-off copy must not catch clicks or drags meant for the arm
    a.el.classList.toggle('is-off', f === 0)
    shownText = Math.max(shownText, f)
  }
  rootStyle.setProperty('--film-text', shownText.toFixed(3))
  countSpecs()
}

// Text hand-off timing, as fractions of the scroll between two slides. The
// outgoing copy is gone by 40% and the incoming copy starts at 60%, so only one
// slide's text is ever readable and the arm has the middle to itself.
//   fade  the whole slide's opacity (--f)
//   in    entrance of the head (eyebrow + title, --in-0) and body (--in-1)
//   out   exit of the head (--out-0) and body (--out-1). The head leads both
//         ways, so a slide's title goes first and its button goes last.
//   drift share of the scroll that held copy still follows (see --pin)
const TEXT = {
  fade: { in: [0.6, 0.84], out: [0.1, 0.4] },
  in: [
    [0.6, 0.8],
    [0.68, 0.88],
  ],
  out: [
    [0.1, 0.3],
    [0.18, 0.4],
  ],
  drift: 0.12,
}
// Holding the copy is a scroll-linked transform. It only stays in step with the
// page when Lenis drives the scroll from the main thread (desktop wheel); on
// phones the native, threaded scroll would make held copy shake, so it scrolls
// normally there and only fades.
const TEXT_HOLD_MQ = window.matchMedia('(min-width: 821px)')
const textRamp = (p, [a, b]) => Math.min(1, Math.max(0, (p - a) / (b - a)))
const textSmooth = (t) => t * t * (3 - 2 * t)
const textEaseOut = (t) => 1 - (1 - t) ** 3
const textEaseIn = (t) => t ** 3
function setTextVar(a, name, value) {
  if (!a.textVars) a.textVars = {}
  if (a.textVars[name] === value) return
  a.textVars[name] = value
  a.el.style.setProperty(name, value)
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

  // Each act's copy fade (--f) is part of the text hand-off, set with the rest
  // of it in updateTransitions(); with reduced motion it stays at 1.
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
  // zoom when the transition into the next slide starts, and again on arrival.
  // Leaving the free view is the exception: applyStop() eases the visitor's
  // orbit / zoom out on the scroll timeline there, so it is not dropped here.
  if (i !== stopIndex) {
    const fromFree = stopIndex === FREE_INDEX
    stopIndex = i
    resetMark = fromFree ? i : -1
    if (scene && ACTS[i].stop !== 'free' && !fromFree) scene.releaseManual?.()
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
// The copy's reveal is scrubbed by scroll (updateTransitions + arm-film.css),
// not fired once by a timer, so every act is handed to that driver at boot:
// `is-in` is style.css's at-rest state, and the scroll values sit on top of it.
// Keyboard focus landing in a slide whose copy is faded brings that slide to
// rest, so a focused control is never invisible.
function initReveals() {
  ACTS.forEach((a) => a.el.classList.add('is-in'))
  document.addEventListener('focusin', (e) => {
    const target = e.target instanceof Element ? e.target : null
    if (!target || !target.matches(':focus-visible')) return
    const a = ACTS.find((x) => x.el.contains(target))
    if (!a || !(a.f < 0.98)) return
    const top = a.el.offsetTop
    if (lenis) lenis.scrollTo(top)
    else window.scrollTo({ top, behavior: 'smooth' })
  })
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
// A visitor's pick. Outside the scan act it becomes the film's look (and the
// look the scan wipes from); inside the scan act it overrides the x-ray until
// they scroll out of it. applyLook() (next to applyStop) resolves the rest.
function setMode(mode) {
  if (mode !== 'mesh' && mode !== 'points' && mode !== 'xray') return
  if (activeAct === SCAN_INDEX) scanPick = mode
  else userMode = mode
  applyLook()
}

function initMode() {
  const buttons = [...document.querySelectorAll('.mode button')]
  if (!buttons.length) return
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
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
