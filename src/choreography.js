// ============================================================
// choreography.js — scroll-driven camera choreography + DOM fades.
// Owned by WS-A/B (3D child). Contract: ARCHITECTURE.md.
//
// Exports:
//   createChoreography({ camera, refs })
// Installs its own scroll listener (passive, dependency-free) and returns
// nothing. It drives:
//   - camera position + lookAt target across 4 keyframes (smoothstep blend)
//   - #cap1 / #cap2 caption opacity fades
//   - #dim overlay opacity (dark at top → clear mid-story → dark at tail)
// ============================================================
import * as THREE from 'three'

// 4 camera keyframes. Each: position → lookAt target.
// World refs: person lies on back at ~(-0.7,0,0) head→+X; robot KNEELS at
// ~(0.15,-0.45,0.6) leaning over them; drone hovers at ~(0.2,3.5,-0.8).
const KEYFRAMES = [
  // 0 — wide establishing (pair + scattered gear + drone overhead)
  { pos: [0, 2.8, 9.5], target: [0, 0.7, 0.2] },
  // 1 — over-the-shoulder onto the robot's arm (arm fills most of the frame)
  { pos: [0.05, 0.6, 1.15], target: [-0.05, 0.22, -0.1] },
  // 2 — tight close-up on the arm / mechanical detail
  { pos: [-0.05, 0.5, 0.75], target: [-0.05, 0.2, -0.05] },
  // 3 — drone HERO: camera raised + aimed at the drone (pair in depth below)
  { pos: [0.6, 5.6, -1.0], target: [0.2, 3.5, -0.8] },
]

// Caption fade windows (story progress 0..1).
const CAPTIONS = [
  { id: 'cap1', start: 0.32, end: 0.55 },
  { id: 'cap2', start: 0.68, end: 0.92 },
]

const FADE_EDGE = 0.06 // caption fade in/out ramp width (progress units)

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smoothstep(a, b, t) {
  const x = clamp01((t - a) / (b - a))
  return x * x * (3 - 2 * x)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpV3(out, a, b, t) {
  out.x = lerp(a[0], b[0], t)
  out.y = lerp(a[1], b[1], t)
  out.z = lerp(a[2], b[2], t)
}

// ---------------------------------------------------------------------------
// Choreography
// ---------------------------------------------------------------------------

export function createChoreography({ camera, refs }) {
  const story = document.getElementById('story')
  const dim = document.getElementById('dim')
  const captionEls = CAPTIONS.map((c) => ({
    ...c,
    el: document.getElementById(c.id),
  }))

  const camPos = new THREE.Vector3()
  const camTarget = new THREE.Vector3()

  // Map scroll position of #story to a 0..1 progress value.
  function storyProgress() {
    if (!story) return 0
    const rect = story.getBoundingClientRect()
    const total = story.offsetHeight - window.innerHeight
    if (total <= 0) return 0
    return clamp01(-rect.top / total)
  }

  function update() {
    const p = storyProgress()

    // --- Camera: smoothstep-lerp position + lookAt across keyframes ---------
    const n = KEYFRAMES.length - 1
    const f = p * n
    const i = Math.min(Math.floor(f), n - 1)
    const t = smoothstep(i, i + 1, f)

    lerpV3(camPos, KEYFRAMES[i].pos, KEYFRAMES[i + 1].pos, t)
    lerpV3(camTarget, KEYFRAMES[i].target, KEYFRAMES[i + 1].target, t)

    camera.position.copy(camPos)
    camera.lookAt(camTarget)

    // --- #dim overlay --------------------------------------------------------
    // 0.72 at the very top → clear during mid-story → back to 0.72 at the tail.
    if (dim) {
      let opacity = 0.72
      if (p > 0.05 && p < 0.9) opacity = 0.0
      dim.style.opacity = opacity.toFixed(3)
    }

    // --- Captions -----------------------------------------------------------
    for (const c of captionEls) {
      if (!c.el) continue
      const active = p >= c.start && p <= c.end
      const fadeIn = smoothstep(c.start, c.start + FADE_EDGE, p)
      const fadeOut = 1 - smoothstep(c.end - FADE_EDGE, c.end, p)
      c.el.style.opacity = (active ? Math.min(fadeIn, fadeOut) : 0).toFixed(3)
    }
  }

  window.addEventListener('scroll', update, { passive: true })

  // Set initial state (progress 0 at load).
  update()
}
