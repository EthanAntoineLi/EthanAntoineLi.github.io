// ============================================================
// main.js — page behaviour for the portfolio.
//
// Owns: reveal animations, section nav state, the lazy arm viewer,
// camera presets / play toggle, live pose readout, copy-email.
// The Three.js viewer itself lives in ./arm-viewer.js.
// ============================================================

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The pose used for the rendered stills (hero plate + viewer placeholder), so
// the hand-off from still to live 3D is seamless.
const PLATE_POSE = [12, 38, 8, 52, 20]

/* ------------------------------------------------------------- reveals */
function initReveals() {
  const targets = document.querySelectorAll(
    '.sec-head, .sec-body, .figure, .pipeline, .status-grid, .status-foot, .contact-rows, .titleblock',
  )
  if (!targets.length) return

  if (reducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'))
    return
  }

  targets.forEach((el) => el.classList.add('reveal'))

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.04 },
  )
  targets.forEach((el) => io.observe(el))
}

/* ------------------------------------------------------------ nav state */
function initNav() {
  const links = [...document.querySelectorAll('.nav a[data-nav]')]
  if (!links.length) return
  const sections = links
    .map((link) => document.getElementById(link.dataset.nav))
    .filter(Boolean)
  if (!sections.length) return

  let queued = false
  const update = () => {
    queued = false
    const line = window.innerHeight * 0.4
    let current = null
    for (const section of sections) {
      const rect = section.getBoundingClientRect()
      if (rect.top <= line && rect.bottom > line) current = section.id
    }
    for (const link of links) {
      const active = link.dataset.nav === current
      if (active) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    }
  }
  const onScroll = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(update)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  update()
}

/* ---------------------------------------------------------- arm viewer */
function initArmViewer() {
  const stage = document.querySelector('.viewer-stage')
  const canvas = document.getElementById('arm-canvas')
  const fallback = document.getElementById('arm-fallback')
  const status = document.getElementById('viewer-status')
  const readout = document.getElementById('pose-readout')
  const playBtn = document.getElementById('play-toggle')
  const presetButtons = [...document.querySelectorAll('[data-preset]')]
  const viewerHost = canvas ? canvas.parentElement : stage
  if (!canvas || !viewerHost) return

  let viewer = null
  let playing = false
  let started = false

  const setStatus = (text, hidden = false) => {
    if (!status) return
    status.textContent = text
    status.classList.toggle('is-hidden', hidden)
  }

  const showFallback = (message) => {
    if (fallback) {
      fallback.hidden = false
      fallback.alt =
        'Still render of the 5-DOF robotic arm CAD assembly, shown because the interactive 3D view could not start.'
    }
    canvas.hidden = true
    setStatus(message)
  }

  const setPlaying = (next) => {
    if (!viewer) return
    playing = next
    if (next) viewer.play()
    else viewer.pause()
    if (playBtn) {
      playBtn.setAttribute('aria-pressed', String(next))
      const label = playBtn.querySelector('.pp-label')
      if (label) label.textContent = next ? 'Pause' : 'Play'
    }
  }

  const start = async () => {
    if (started) return
    started = true
    setStatus('Loading CAD…')
    try {
      const { createArmViewer } = await import('./arm-viewer.js')
      viewer = await createArmViewer(canvas, {
        modelUrl: './models/arm-opt.glb',
        reducedMotion,
        onPose: (deg) => {
          if (!readout) return
          readout.textContent = deg
            .map((value, index) => `J${index + 1} ${Math.round(value)}°`)
            .join(' · ')
        },
      })
      await viewer.ready
      viewer.setPose(PLATE_POSE, { immediate: true })
      if (fallback) fallback.hidden = true
      setStatus('', true)
      if (!reducedMotion) setPlaying(true)
      else {
        if (playBtn) {
          playBtn.setAttribute('aria-pressed', 'false')
          const label = playBtn.querySelector('.pp-label')
          if (label) label.textContent = 'Play'
        }
      }
    } catch (error) {
      console.error('arm viewer failed:', error)
      showFallback('3D view unavailable — still shown')
      if (playBtn) playBtn.hidden = true
      presetButtons.forEach((button) => (button.hidden = true))
    }
  }

  // Load only when the viewer is close to the viewport.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          io.disconnect()
          start()
        }
      },
      { rootMargin: '500px 0px' },
    )
    io.observe(viewerHost)
  } else {
    start()
  }

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!viewer) return
      presetButtons.forEach((other) => other.classList.toggle('on', other === button))
      try {
        viewer.setPreset(button.dataset.preset)
      } catch (error) {
        console.error(error)
      }
    })
  })

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!viewer) return
      setPlaying(!playing)
    })
  }
}

/* -------------------------------------------------------- copy email */
function initCopyEmail() {
  const button = document.getElementById('copy-email')
  if (!button) return
  const original = button.textContent
  let timer = null

  const done = (label) => {
    button.textContent = label
    button.classList.add('is-done')
    clearTimeout(timer)
    timer = setTimeout(() => {
      button.textContent = original
      button.classList.remove('is-done')
    }, 1800)
  }

  button.addEventListener('click', async () => {
    const email = button.dataset.email || ''
    try {
      await navigator.clipboard.writeText(email)
      done('Copied')
    } catch (error) {
      const field = document.createElement('textarea')
      field.value = email
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      try {
        document.execCommand('copy')
        done('Copied')
      } catch (fallbackError) {
        done('Copy failed')
      }
      field.remove()
    }
  })
}

/* ------------------------------------------------------------- boot */
function boot() {
  document.documentElement.classList.add('js')
  initReveals()
  initNav()
  initArmViewer()
  initCopyEmail()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
