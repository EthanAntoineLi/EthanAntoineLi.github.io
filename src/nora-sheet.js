// Sheet 02 behaviour. Progressive: without this file the first screen is a
// static composition (the monitor shell's own baked glass, see sheet.css).
//
//   1. Screen fit — the demo iframe is projected onto the monitor's glass with
//      a homography (the glass is a trapezoid because the monitor is angled).
//   2. Hero zoom — as the page scrolls, the glass straightens toward the camera
//      and expands until it fills the viewport, the shell dissolves, the paper
//      background fades to ink and the subtitle rises from the bottom.
//   3. Scroll pause — the cat holds its pose while the visitor scrolls, so the
//      camera move is the only motion; the loop resumes shortly after.
//   4. Focus ring — keyboard focus enters the demo's own document, where the
//      host iframe matches neither :focus nor :focus-within, so the child
//      window's focus/blur events drive a marker class.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const desktop = window.matchMedia('(min-width: 901px)')
const finePointer = window.matchMedia('(pointer: fine)')

/* --------------------------------------------------------------- refs */
const hero = document.querySelector('.hero-zoom')
const pin = hero?.querySelector('.hero-pin')
const device = hero?.querySelector('.device')
const shell = hero?.querySelector('.device-shell')
const screenEl = hero?.querySelector('.device-screen')
const screenFrame = hero?.querySelector('.device-screen iframe')
const copy = hero?.querySelector('.hero-copy')
const cue = hero?.querySelector('.hero-cue')
const dim = hero?.querySelector('.hero-dim')
const scrim = hero?.querySelector('.zoom-scrim')
const words = hero?.querySelector('.zoom-words')

/* The glass quad in the shell render (dev/monitor/render-angle.html), as
   fractions of the image: visual top-left, top-right, bottom-right, bottom-left. */
const GLASS = [
  [0.05107673052246478, 0.09771883505613911],
  [0.9742678538265039, 0.03257024789414502],
  [0.9616801653839601, 0.7543939776882912],
  [0.023618273105361368, 0.7236035109588671],
]

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (p) => p * p * (3 - 2 * p)
const lerp = (a, b, t) => a + (b - a) * t

/* 4-point homography (h22 fixed to 1) from src to dst, both [TL,TR,BR,BL]. */
function homography(src, dst) {
  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [X, Y] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }
  const n = 8
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    if (Math.abs(M[piv][col]) < 1e-12) return null
    if (piv !== col) [M[col], M[piv]] = [M[piv], M[col]]
    const d = M[col][col]
    for (let c = col; c <= n; c++) M[col][c] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      if (!f) continue
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row) => row[n])
}

const cssMatrix3d = (h) =>
  `matrix3d(${h[0]},${h[3]},0,${h[6]}, ${h[1]},${h[4]},0,${h[7]}, 0,0,1,0, ${h[2]},${h[5]},0,1)`

let metrics = null
let raf = 0
let pauseTimer = 0

const zoomOn = () =>
  Boolean(hero && pin && device && screenEl && screenFrame) &&
  desktop.matches &&
  finePointer.matches &&
  !reducedMotion.matches

/* Put the live screen on the glass. Works in every JS mode so phones and
   reduced motion get the same aligned composition without the zoom. */
function fitScreen() {
  if (!device || !screenEl) return null
  const W = device.clientWidth
  const H = device.clientHeight
  if (!W || !H) return null

  const dr = device.getBoundingClientRect()
  const rest = GLASS.map(([x, y]) => [x * W, y * H])
  const U = Math.hypot(rest[1][0] - rest[0][0], rest[1][1] - rest[0][1])
  const V = Math.hypot(rest[3][0] - rest[0][0], rest[3][1] - rest[0][1])
  const layout = [
    [0, 0],
    [U, 0],
    [U, V],
    [0, V],
  ]
  screenEl.style.width = `${U.toFixed(2)}px`
  screenEl.style.height = `${V.toFixed(2)}px`
  const h = homography(layout, rest)
  screenEl.style.transform = h ? cssMatrix3d(h) : ''
  const glassCentre = [
    rest.reduce((sum, p) => sum + p[0], 0) / 4,
    rest.reduce((sum, p) => sum + p[1], 0) / 4,
  ]
  return { W, H, dr, rest, U, V, layout, glassCentre }
}

function measure() {
  if (device) {
    device.style.transform = ''
    device.style.transformOrigin = ''
  }
  const fit = fitScreen()
  if (!fit || !zoomOn()) {
    metrics = null
    return
  }

  const chromeH =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h')) || 54
  const vh = window.innerHeight
  const vw = window.innerWidth

  // The camera pushes in until the glass covers the viewport (uniform scale,
  // cropped sides); a short final phase straightens the trapezoid.
  const sFill = Math.max(vw / fit.U, vh / fit.V)

  metrics = {
    ...fit,
    vw,
    vh,
    chromeH,
    sFill,
    restCentrePage: [fit.dr.left + fit.glassCentre[0], fit.dr.top + fit.glassCentre[1]],
    travel: Math.max(1, hero.offsetHeight - pin.offsetHeight),
  }
}

function resetOverlays() {
  for (const el of [device, copy, cue, dim, scrim, words]) {
    if (!el) continue
    el.style.transform = ''
    el.style.opacity = ''
  }
  if (device) device.style.transformOrigin = ''
  if (shell) {
    shell.style.opacity = ''
    shell.style.transform = ''
  }
}

function update() {
  raf = 0
  if (!metrics) {
    resetOverlays()
    return
  }

  const scroll = clamp01(window.scrollY / metrics.travel)
  const zoom = smooth(clamp01((scroll - 0.04) / 0.8))
  const titleFade = clamp01(scroll / 0.16)

  // Phase A: the camera dollies into the angled monitor (hardware and glass
  // move together — nothing detaches). Phase B: the glass straightens to the
  // viewport and the hardware dissolves.
  const phaseA = smooth(clamp01(zoom / 0.6))
  const phaseB = clamp01((zoom - 0.6) / 0.4)

  const s = 1 + (metrics.sFill - 1) * phaseA
  const tx = (metrics.vw / 2 - metrics.restCentrePage[0]) * phaseA
  const ty = (metrics.vh / 2 - metrics.restCentrePage[1]) * phaseA
  if (device) {
    device.style.transformOrigin = `${metrics.glassCentre[0].toFixed(1)}px ${metrics.glassCentre[1].toFixed(1)}px`
    device.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`
  }

  // Straighten in device-local space: inverse of the current camera transform.
  let corners = metrics.rest
  if (phaseB > 0) {
    const tw = metrics.U * metrics.sFill
    const th = metrics.V * metrics.sFill
    const gx = (metrics.vw - tw) / 2
    const gy = (metrics.vh - th) / 2
    const desired = [
      [gx, gy],
      [gx + tw, gy],
      [gx + tw, gy + th],
      [gx, gy + th],
    ]
    const local = desired.map(([X, Y]) => [
      metrics.glassCentre[0] + (X - metrics.dr.left - tx - metrics.glassCentre[0]) / s,
      metrics.glassCentre[1] + (Y - metrics.dr.top - ty - metrics.glassCentre[1]) / s,
    ])
    const b = smooth(phaseB)
    corners = metrics.rest.map((p, i) => [lerp(p[0], local[i][0], b), lerp(p[1], local[i][1], b)])
  }
  const h = homography(metrics.layout, corners)
  if (h) screenEl.style.transform = cssMatrix3d(h)

  if (shell) shell.style.opacity = (1 - phaseB).toFixed(3)

  copy.style.opacity = `${(1 - titleFade).toFixed(3)}`
  copy.style.transform = `translate3d(0, ${(-28 * titleFade).toFixed(1)}px, 0)`

  // Background fades to ink while the camera moves in.
  if (dim) dim.style.opacity = clamp01((zoom - 0.02) / 0.5).toFixed(3)

  // Words rise from the bottom as the glass settles.
  const rise = clamp01((phaseB - 0.45) / 0.5)
  if (scrim) scrim.style.opacity = rise.toFixed(3)
  if (words) {
    words.style.opacity = rise.toFixed(3)
    words.style.transform = `translate3d(0, ${((1 - rise) * 64).toFixed(1)}px, 0)`
  }

  if (cue) cue.style.opacity = `${(1 - clamp01(scroll / 0.08)).toFixed(3)}`
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(update)
}

function reset() {
  resetOverlays()
  measure()
  update()
}

/* The cat holds its pose while the visitor scrolls (the camera move should be
   the only motion); it picks the loop back up shortly after scrolling stops. */
const setDemoPaused = (v) => {
  try {
    screenFrame?.contentWindow?.__noraPause?.(v)
  } catch {
    /* same-origin; ignore if the demo is not ready */
  }
}

if (hero && pin && device && screenEl && screenFrame) {
  reset()
  window.addEventListener(
    'scroll',
    () => {
      schedule()
      setDemoPaused(true)
      window.clearTimeout(pauseTimer)
      pauseTimer = window.setTimeout(() => setDemoPaused(false), 240)
    },
    { passive: true }
  )
  window.addEventListener('resize', reset)
  window.addEventListener('load', reset)
  setTimeout(reset, 300)
  reducedMotion.addEventListener('change', reset)
  desktop.addEventListener('change', reset)
  finePointer.addEventListener('change', reset)
}

/* ------------------------------------------------------------- focus ring */
if (screenFrame) {
  const setFocused = (on) => screenFrame.classList.toggle('is-focused', on)

  screenFrame.addEventListener('focus', () => setFocused(true))
  screenFrame.addEventListener('blur', () => setFocused(false))

  screenFrame.addEventListener('load', () => {
    const win = screenFrame.contentWindow
    if (!win) return
    win.addEventListener('focus', () => setFocused(true))
    win.addEventListener('blur', () => setFocused(false))
  })
}
