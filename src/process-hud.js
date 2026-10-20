// ============================================================================
// process-hud.js — the part balloons over the process page's turret.
//
// Drawing-sheet callouts on a 2D canvas laid over the 3D stage: every part on
// the ring carries a numbered balloon on a leader line, the far side of the
// ring fading back with the haze, and the part at the front station gets a
// filled signal balloon plus a name tag that types itself in when the turret
// settles. The stage hands over screen positions each frame (onFrame); this
// module only draws.
//
//   const hud = createRingHud(canvas, { parts, reducedMotion })
//   hud.draw(frame)     frame = { alpha, settled, front, time, items: [{ id,
//                       x, y, r, depth, present, alpha }] } in CSS px; time is
//                       the scene clock in seconds
//   hud.clear()
// ============================================================================

const INK = '#101214'
const PAPER = '#f6f6f4'
const SIGNAL = '#b23e22'
const MUTED = '#5f6469'
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, "IBM Plex Mono", monospace'
const SANS = '"Inter Tight", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'
const SCRAMBLE = '-=+/\\<>_#'
const TYPE_MS = 26 // per character

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ parts: Record<string, { n: string, name: string, spec: string }>, reducedMotion?: boolean, phone?: boolean }} opts
 */
export function createRingHud(canvas, { parts, reducedMotion = false, phone = false }) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { draw() {}, clear() {} }
  let w = 0
  let h = 0
  let dpr = 1
  let drawn = false
  const tag = { id: null, t0: 0, alpha: 0 }
  const sorted = []

  // balloons hang up and to the right of their part, all on one leader angle,
  // the way a drawing keeps its callouts parallel
  const DIR = { x: 0.6, y: -0.8 }
  const R = phone ? 9 : 11.5

  function fit() {
    const cw = canvas.clientWidth || window.innerWidth
    const ch = canvas.clientHeight || window.innerHeight
    const d = Math.min(window.devicePixelRatio || 1, 2)
    if (cw === w && ch === h && d === dpr) return
    w = cw
    h = ch
    dpr = d
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }

  function clear() {
    if (!drawn) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawn = false
  }

  function typed(text, elapsed) {
    if (reducedMotion) return text
    const shown = Math.floor(elapsed / TYPE_MS)
    if (shown >= text.length) return text
    let out = text.slice(0, Math.max(0, shown))
    for (let i = Math.max(0, shown); i < Math.min(text.length, shown + 3); i++) {
      out += text[i] === ' ' ? ' ' : SCRAMBLE[(i * 7 + Math.floor(elapsed / 60)) % SCRAMBLE.length]
    }
    return out
  }

  function balloonPos(item) {
    const reach = item.r * 0.86 + (phone ? 14 : 22)
    return {
      ax: item.x + DIR.x * item.r * 0.1,
      ay: item.y + DIR.y * item.r * 0.1,
      cx: item.x + DIR.x * reach,
      cy: item.y + DIR.y * reach,
    }
  }

  function draw(frame) {
    fit()
    clear()
    if (!frame || frame.alpha < 0.01 || !frame.items.length) return
    drawn = true
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'

    // far side first, so near balloons sit on top
    sorted.length = 0
    for (const it of frame.items) sorted.push(it)
    sorted.sort((a, b) => b.depth - a.depth)

    const now = (frame.time || 0) * 1000
    if (frame.front !== tag.id) {
      tag.id = frame.front
      tag.t0 = now
    }

    for (const it of sorted) {
      const part = parts[it.id]
      if (!part) continue
      const a = frame.alpha * clamp(it.alpha, 0, 1) * (1 - 0.68 * it.depth)
      if (a < 0.02) continue
      const { ax, ay, cx, cy } = balloonPos(it)
      const lit = smooth(0.45, 0.9, it.present) * frame.settled

      // leader: dot on the part, hairline out to the balloon's edge
      ctx.globalAlpha = a * 0.75
      ctx.strokeStyle = INK
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(cx - DIR.x * R, cy - DIR.y * R)
      ctx.stroke()
      ctx.globalAlpha = a
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(ax, ay, 2.2, 0, Math.PI * 2)
      ctx.fill()

      // the balloon: paper with an ink ring, filling signal-red when presented
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = PAPER
      ctx.fill()
      if (lit > 0.01) {
        ctx.globalAlpha = a * lit
        ctx.fillStyle = SIGNAL
        ctx.fill()
        ctx.globalAlpha = a
      }
      ctx.strokeStyle = lit > 0.5 ? SIGNAL : INK
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = lit > 0.5 ? PAPER : INK
      ctx.font = `500 ${phone ? 8.5 : 10}px ${MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(part.n, cx, cy + 0.5)

      // the name tag on the presented part: a shoulder line, name over, spec under
      if (it.id === frame.front) {
        tag.alpha = a * smooth(0.55, 0.92, it.present) * frame.settled
        // the tag types itself in from the moment it shows, every time it shows
        if (tag.alpha > 0.02) drawTag(part, cx, cy, now - tag.t0)
        else tag.t0 = now
      }
    }
    ctx.globalAlpha = 1
  }

  function drawTag(part, cx, cy, elapsed) {
    const name = typed(part.name, elapsed)
    const spec = typed(part.spec.toUpperCase(), Math.max(0, elapsed - 120))
    const nameSize = phone ? 13 : 17
    const specFont = `500 ${phone ? 8.5 : 9.5}px ${MONO}`
    const nameFont = `400 ${nameSize}px ${SANS}`
    ctx.font = nameFont
    const nameW = ctx.measureText(part.name).width
    ctx.font = specFont
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.12em'
    const specW = ctx.measureText(part.spec.toUpperCase()).width
    const gap = phone ? 6 : 9
    const textW = Math.max(nameW, specW)
    const full = gap * 2 + textW
    const len = Math.min(1, elapsed / 260) * full
    // the tag reads to the right of its balloon unless that runs off the sheet
    const flip = cx + R + full > w - 8
    const side = flip ? -1 : 1
    const x0 = cx + R * side
    const tx = flip ? x0 - gap - textW : x0 + gap

    // a paper plate under the tag so it reads over a part as well as over paper
    ctx.globalAlpha = tag.alpha * 0.86
    ctx.fillStyle = PAPER
    const plateW = Math.max(0, len - gap + 4)
    ctx.fillRect(flip ? x0 - gap + 1 - plateW : x0 + gap - 5, cy - nameSize - (phone ? 6 : 9), plateW, nameSize + (phone ? 24 : 32))
    ctx.globalAlpha = tag.alpha

    ctx.strokeStyle = INK
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x0, cy)
    ctx.lineTo(x0 + len * side, cy)
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = MUTED
    ctx.fillText(spec, tx, cy + (phone ? 13 : 16))
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    ctx.font = nameFont
    ctx.fillStyle = INK
    ctx.fillText(name, tx, cy - (phone ? 5 : 7))
  }

  return { draw, clear }
}
