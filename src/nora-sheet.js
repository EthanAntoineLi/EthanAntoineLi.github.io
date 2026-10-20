// Sheet 02 behaviour. Progressive: without this file the first screen is a
// static composition (see the `.hero-zoom` CSS).
//
//   1. Hero zoom — the laptop showing Nora's interface scales up as the page
//      scrolls until the screen fills the viewport; the title fades out on the
//      way and the hardware (bezel, base) fades as the screen takes
//      over. Only on desktop, and never for reduced motion.
//   2. Focus ring — keyboard focus moves into the demo's own document, where
//      the host iframe matches neither :focus nor :focus-within, so the
//      child window's focus/blur events drive a marker class.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const desktop = window.matchMedia('(min-width: 901px)')
const finePointer = window.matchMedia('(pointer: fine)')

/* --------------------------------------------------------------- hero zoom */
const hero = document.querySelector('.hero-zoom')
const pin = hero?.querySelector('.hero-pin')
const device = hero?.querySelector('.device')
const screenFrame = hero?.querySelector('.device-screen iframe')
const copy = hero?.querySelector('.hero-copy')
const cue = hero?.querySelector('.hero-cue')

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (p) => p * p * (3 - 2 * p)

let metrics = null
let raf = 0

const zoomOn = () =>
  Boolean(hero && pin && device && screenFrame) &&
  desktop.matches &&
  finePointer.matches &&
  !reducedMotion.matches

function clearZoom() {
  metrics = null
  for (const el of [device, copy, cue]) {
    if (!el) continue
    el.style.transform = ''
    el.style.opacity = ''
  }
  if (device) {
    device.style.transformOrigin = ''
    device.style.willChange = ''
  }
}

function measure() {
  if (!zoomOn()) {
    clearZoom()
    return
  }

  // Measure the untransformed layout.
  device.style.transform = 'none'
  device.style.transformOrigin = ''

  const screen = screenFrame.getBoundingClientRect()
  const frameBox = device.getBoundingClientRect()
  const chromeH =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h')) || 54
  const vh = window.innerHeight

  metrics = {
    screenW: screen.width,
    screenH: screen.height,
    originX: screen.left - frameBox.left + screen.width / 2,
    originY: screen.top - frameBox.top + screen.height / 2,
    restCentreY: screen.top + screen.height / 2,
    vh,
    chromeH,
    travel: Math.max(1, hero.offsetHeight - pin.offsetHeight),
    // The screen covers the whole viewport at the end (crop, don't letterbox).
    targetCentreY: vh / 2,
    targetScale: Math.max(window.innerWidth / screen.width, vh / screen.height),
  }

  device.style.transformOrigin = `${metrics.originX}px ${metrics.originY}px`
  device.style.willChange = 'transform'
}

function update() {
  raf = 0
  if (!metrics) return

  const scroll = clamp01(window.scrollY / metrics.travel)
  // Zoom completes at ~84% of the pinned range; the rest is a short hold on
  // the full-screen interface before the intro scrolls in.
  const zoom = smooth(clamp01((scroll - 0.04) / 0.8))
  const titleFade = clamp01(scroll / 0.16)

  const scale = 1 + (metrics.targetScale - 1) * zoom
  const ty = (metrics.targetCentreY - metrics.restCentreY) * zoom
  device.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`

  copy.style.opacity = `${(1 - titleFade).toFixed(3)}`
  copy.style.transform = `translate3d(0, ${(-28 * titleFade).toFixed(1)}px, 0)`

  if (cue) cue.style.opacity = `${(1 - clamp01(scroll / 0.08)).toFixed(3)}`
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(update)
}

function reset() {
  measure()
  update()
}

if (hero && pin && device && screenFrame) {
  reset()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', reset)
  window.addEventListener('load', reset)
  setTimeout(reset, 300)
  reducedMotion.addEventListener('change', reset)
  desktop.addEventListener('change', reset)
  finePointer.addEventListener('change', reset)
}

/* ------------------------------------------------------------- focus ring */
const demoFrame = document.querySelector('.device-screen iframe')

if (demoFrame) {
  const setFocused = (on) => demoFrame.classList.toggle('is-focused', on)

  demoFrame.addEventListener('focus', () => setFocused(true))
  demoFrame.addEventListener('blur', () => setFocused(false))

  demoFrame.addEventListener('load', () => {
    const win = demoFrame.contentWindow
    if (!win) return
    win.addEventListener('focus', () => setFocused(true))
    win.addEventListener('blur', () => setFocused(false))
  })
}
