// Sheet 02 behaviour. Progressive: without this file the first screen is a
// static composition (the resting-angle shell frame, see sheet.css).
//
//   1. Screen fit — the demo iframe is projected onto the monitor's glass with
//      a homography, so the cat lives inside the angled screen.
//   2. Zoom + turn — the hero is a short 3D turn sequence (22° → face-on) with
//      the live glass mapped onto each frame's screen quad: as the page
//      scrolls the camera pushes in and the monitor turns at the same time.
//      The paper background fades to ink and the subtitle rises at the end.
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
const shells = hero ? [...hero.querySelectorAll('.device-shell')] : []
const screenEl = hero?.querySelector('.device-screen')
const screenFrame = hero?.querySelector('.device-screen iframe')
const copy = hero?.querySelector('.hero-copy')
const cue = hero?.querySelector('.hero-cue')
const dim = hero?.querySelector('.hero-dim')
const words = hero?.querySelector('.zoom-words')

/* The glass quad per turn frame, in image fractions (frames share one crop and
   camera), ordered visual top-left, top-right, bottom-right, bottom-left.
   Rendered by dev/monitor/render-seq.html at yaw 22° → 0°. */
const QUADS = [
  // 22°
  [
    [0.03536869723696048, 0.03801701910649521],
    [0.89941037090710330, 0.10151846471396643],
    [0.92488830143574896, 0.72081986645978113],
    [0.04710295729449392, 0.75084796526288677],
  ],
  // 19°
  [
    [0.03182663145607406, 0.04180963102336784],
    [0.91330990133694956, 0.09710221634857757],
    [0.93382479057129952, 0.72325389879795521],
    [0.03934047815347675, 0.74938439504017806],
  ],
  // 16°
  [
    [0.02932717879722277, 0.04568113538486710],
    [0.92613237648957958, 0.09258636635161788],
    [0.94204787132421419, 0.72566051326951975],
    [0.03347843966824860, 0.74780175657160075],
  ],
  // 13°
  [
    [0.02783843354904772, 0.04963960492833738],
    [0.93777496232276836, 0.08799605901160283],
    [0.94956286982164440, 0.72802416272997128],
    [0.02948863975778443, 0.74610078997665341],
  ],
  // 10°
  [
    [0.02734328459109476, 0.05365804459349229],
    [0.94819555454694093, 0.08332811273674952],
    [0.95631211647241732, 0.73035126368346237],
    [0.02731883712570926, 0.74430519125318595],
  ],
  // 7°
  [
    [0.02781548843492285, 0.05774127438187061],
    [0.95729518588001927, 0.07860731413416736],
    [0.96229483261669735, 0.73262962508896301],
    [0.02691855189610660, 0.74241908062376827],
  ],
  // 4°
  [
    [0.02922780580763414, 0.06186747789607355],
    [0.96502531025494442, 0.07383607679370460],
    [0.96745901177967575, 0.73486126993234613],
    [0.02823204049440544, 0.74046066335612004],
  ],
  // 0°
  [
    [0.03253489553041241, 0.06743451571762507],
    [0.97305038664959409, 0.06743451571762507],
    [0.97305038664959409, 0.73775036498628010],
    [0.03253489553041241, 0.73775036498628010],
  ],
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

/* Blend of the four turn frames at progress t (0 = resting angle, 1 = face-on). */
function quadAt(t) {
  const p = clamp01(t) * (QUADS.length - 1)
  const i = Math.min(QUADS.length - 2, Math.floor(p))
  const f = p - i
  const quad = QUADS[i].map((pt, k) => [
    lerp(pt[0], QUADS[i + 1][k][0], f),
    lerp(pt[1], QUADS[i + 1][k][1], f),
  ])
  return { i, f, quad }
}

/* Place the live screen on the glass for turn progress t and crossfade the
   shell frames; used both by the scroll zoom and the static fallbacks. */
function placeScreen(t) {
  if (!metrics || !screenEl) return
  const { i, f, quad } = quadAt(t)
  const corners = quad.map(([x, y]) => [x * metrics.W, y * metrics.H])
  const h = homography(metrics.layout, corners)
  if (h) screenEl.style.transform = cssMatrix3d(h)

  // Both blended frames are warped so their glass lands exactly on the blended
  // quad: the crossfade then only changes the hardware's perspective (no
  // double bezel, no gap between the glass and the live screen).
  shells.forEach((el, j) => {
    const src = QUADS[j].map(([x, y]) => [x * metrics.W, y * metrics.H])
    const hj = homography(src, corners)
    if (hj) el.style.transform = cssMatrix3d(hj)
    el.style.opacity = j === i ? '1' : j === i + 1 ? f.toFixed(3) : '0'
  })
}

function measure() {
  if (!device) return
  device.style.transform = ''
  device.style.transformOrigin = ''
  metrics = null

  const W = device.clientWidth
  const H = device.clientHeight
  if (!W || !H || !screenEl) return

  const dr = device.getBoundingClientRect()
  const front = QUADS[QUADS.length - 1].map(([x, y]) => [x * W, y * H])
  const U = Math.abs(front[1][0] - front[0][0])
  const V = Math.abs(front[3][1] - front[0][1])
  screenEl.style.width = `${U.toFixed(2)}px`
  screenEl.style.height = `${V.toFixed(2)}px`

  metrics = {
    W,
    H,
    dr,
    U,
    V,
    layout: [
      [0, 0],
      [U, 0],
      [U, V],
      [0, V],
    ],
    frontCentre: [(front[0][0] + front[2][0]) / 2, (front[0][1] + front[2][1]) / 2],
  }

  if (!zoomOn()) return

  const vw = window.innerWidth
  const vh = window.innerHeight
  metrics.vw = vw
  metrics.vh = vh
  metrics.travel = Math.max(1, hero.offsetHeight - pin.offsetHeight)
  // The glass covers the viewport at the end (uniform scale, cropped sides).
  metrics.sFill = Math.max(vw / U, vh / V)
  metrics.restCentrePage = [dr.left + metrics.frontCentre[0], dr.top + metrics.frontCentre[1]]
}

function resetOverlays() {
  for (const el of [device, copy, cue, dim, words]) {
    if (!el) continue
    el.style.transform = ''
    el.style.opacity = ''
  }
  if (device) device.style.transformOrigin = ''
}

function update() {
  raf = 0
  if (!metrics) return
  if (!zoomOn()) {
    placeScreen(0)
    return
  }

  const scroll = clamp01(window.scrollY / metrics.travel)
  const zoom = smooth(clamp01((scroll - 0.04) / 0.8))
  const titleFade = clamp01(scroll / 0.16)

  // Turn and zoom are one gesture: the glass quad blends from the resting
  // angle to face-on while the whole device pushes toward the camera.
  placeScreen(zoom)

  // The push-in finishes a little before the turn does: the glass is full bleed
  // while the last few degrees of the turn and the subtitle settle.
  const push = smooth(clamp01(zoom / 0.62))
  const s = 1 + (metrics.sFill - 1) * push
  const tx = (metrics.vw / 2 - metrics.restCentrePage[0]) * push
  const ty = (metrics.vh / 2 - metrics.restCentrePage[1]) * push
  if (device) {
    device.style.transformOrigin = `${metrics.frontCentre[0].toFixed(1)}px ${metrics.frontCentre[1].toFixed(1)}px`
    device.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`
  }

  // Background fades to ink while the camera moves in, then goes transparent
  // once the glass covers the viewport (invisible behind it), so the section
  // hands off to the paper intro without a dark band.
  if (dim) {
    const inkUp = clamp01((zoom - 0.02) / 0.22)
    const inkAway = clamp01((zoom - 0.55) / 0.12)
    dim.style.opacity = (inkUp * (1 - inkAway)).toFixed(3)
  }

  copy.style.opacity = `${(1 - titleFade).toFixed(3)}`
  copy.style.transform = `translate3d(0, ${(-28 * titleFade).toFixed(1)}px, 0)`

  // Words rise from the bottom once the glass is nearly face-on and full bleed.
  const rise = clamp01((zoom - 0.9) / 0.1)
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
  if (!metrics) return
  placeScreen(0)
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
