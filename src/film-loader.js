// ============================================================================
// film-loader.js — the loading curtain shared by Sheet 01's film and its
// process page.
//
// The curtain is a promise, not a timer: it lifts when the scene reports its
// first real frame (model parsed, first frame drawn), so a still plate or a
// half-built scene is never seen as a preview. The counter is real too — the
// model's transfer owns 35-90 %, the parse + first frame the last 10 %. A 15 s
// safety valve lifts it anyway, and the scene's own ready promise is still
// awaited afterwards.
// ============================================================================

const body = document.body
const MAX_WAIT_MS = 15000

let progress = 0
let lifted = false

/** The scene reports 0..1 transfer progress here (monotonic; never goes back). */
export function reportLoadProgress(value) {
  const p = Number(value)
  if (!Number.isFinite(p)) return
  progress = Math.max(progress, Math.min(1, p))
}

/** True once the curtain has lifted — pages use it to start reveals that must
 *  not play underneath it (the arm's entry assembly). */
export function wasCurtainLifted() {
  return lifted
}

/**
 * @param {object} opts
 * @param {boolean} opts.reducedMotion
 * @param {Promise<unknown>} opts.sceneReady resolves when the scene has drawn
 *        its first real frame (or failed and the still plate won)
 * @param {() => void} [opts.onLift] called after the curtain starts lifting
 */
export function initFilmLoader({ reducedMotion, sceneReady, onLift }) {
  const MIN_MS = reducedMotion ? 300 : 1200 // never flash the curtain away
  const countEl = document.getElementById('loader-count')
  const barEl = document.getElementById('loader-bar')
  const asciiEl = document.getElementById('loader-ascii')

  const paint = (value) => {
    const v = Math.min(1, Math.max(0, value))
    if (countEl) countEl.textContent = String(Math.round(v * 100)).padStart(3, '0')
    if (barEl) barEl.style.width = `${(v * 100).toFixed(2)}%`
    if (asciiEl) {
      const filled = Math.round(v * 10)
      asciiEl.textContent = '='.repeat(filled) + '-'.repeat(10 - filled)
    }
  }

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    paint(1)
    lifted = true
    body.classList.remove('is-loading')
    body.classList.add('loaded')
    onLift?.()
  }

  body.classList.add('is-loading')
  const start = performance.now()

  // No animation (reduced motion / missing nodes): still wait for the scene, so
  // the hand-off stays a hand-off and not a plate-to-model pop.
  if (!countEl || !barEl || reducedMotion) {
    paint(1)
    Promise.race([sceneReady, new Promise((r) => setTimeout(r, MAX_WAIT_MS))]).then(() => {
      setTimeout(finish, Math.max(0, MIN_MS - (performance.now() - start)))
    })
    return
  }

  let ready = false
  sceneReady.then(() => {
    ready = true
    // Timer safety, not the normal path: rAF can be throttled (background tab,
    // exhausted GPU) and the curtain must never become a dead end.
    setTimeout(() => {
      paint(1)
      finish()
    }, MIN_MS + 1200)
  })
  setTimeout(() => {
    ready = true
  }, MAX_WAIT_MS)

  // Wall-clock driven on purpose: a frame-count animation stretches on a slow
  // GPU, which is exactly where the model takes longest and the curtain matters
  // most. The last 10 % is a short ramp from wherever the bar actually is.
  let shown = 0
  let transferSeen = 0
  let last = 0
  let completeAt = 0
  let completeFrom = 0
  const paintShown = (v) => {
    shown = Math.min(1, Math.max(0, v))
    paint(shown)
  }
  const tick = (now) => {
    const elapsed = now - start
    const dt = last ? Math.min(100, now - last) : 16
    last = now

    if (ready && elapsed >= MIN_MS) {
      if (!completeAt) {
        completeAt = now
        completeFrom = shown
      }
      const p = Math.min(1, (now - completeAt) / 350)
      paintShown(completeFrom + (1 - completeFrom) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(tick)
      else finish()
      return
    }

    // 0 -> 35 %: a short ease out while the bundle and the scene boot, so the
    // counter moves before the model has reported any bytes.
    const sweep = 0.35 * (1 - Math.pow(1 - Math.min(1, elapsed / 1000), 3))
    // 35 -> 90 %: the GLB's real transfer, damped so jumpy progress events
    // still read as a smooth scan. 100 % (parse + first frame) is the last 10 %.
    const transferTarget = progress > 0 ? 0.35 + 0.55 * progress : 0
    transferSeen += (transferTarget - transferSeen) * (1 - Math.exp(-dt / 120))
    paintShown(Math.min(0.9, Math.max(sweep, transferSeen)))
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
