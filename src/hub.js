// ============================================================================
// hub.js — Sheet 00 behaviour. Small on purpose: reveals, nav state, ghost type,
// copy-email. No 3D, no smooth-scroll library, no analytics.
// ============================================================================

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const body = document.body

/* --------------------------------------------------------------- reveals */
// Scroll-driven, not IntersectionObserver-only: a fast jump (anchor click, key
// repeat, restored scroll) can move an element from below the viewport to above
// it between two frames, and an observer then never fires for it — leaving it
// invisible for good. Checking positions in the same rAF as the nav state means
// every element is revealed as it passes the trigger line, however the visitor
// got there.
const revealEls = [...document.querySelectorAll('.reveal')]
const pendingReveals = new Set(revealEls)

function reveal(el) {
  if (!pendingReveals.delete(el)) return
  el.classList.add('is-in')
}

function flushReveals() {
  if (!pendingReveals.size) return
  const limit = window.innerHeight * 0.92
  for (const el of pendingReveals) {
    if (el.getBoundingClientRect().top < limit) reveal(el)
  }
}

if (reducedMotion) {
  revealEls.forEach((el) => el.classList.add('is-in'))
  pendingReveals.clear()
  body.classList.add('is-ready')
} else {
  requestAnimationFrame(() => body.classList.add('is-ready'))
}

/* ----------------------------------------------------- nav + ghost word */
const sections = [...document.querySelectorAll('[data-ghost]')]
const navLinks = [...document.querySelectorAll('[data-nav]')]
const ghost = document.getElementById('ghost')
const chromeH = 54

let activeSection = null
let ghostWord = ghost ? ghost.textContent : ''
let ghostTimer = 0
let ticking = false

function setGhost(word) {
  if (!ghost || !word || word === ghostWord) return
  ghostWord = word
  window.clearTimeout(ghostTimer)
  ghost.classList.add('is-out')
  ghostTimer = window.setTimeout(
    () => {
      ghost.textContent = word
      ghost.classList.remove('is-out')
    },
    reducedMotion ? 0 : 260
  )
}

function setNav(id) {
  for (const link of navLinks) {
    const href = link.getAttribute('href')
    const on = href === `#${id}` || (id === 'record' && href === '#status')
    if (on) link.setAttribute('aria-current', 'true')
    else link.removeAttribute('aria-current')
  }
}

function updateScrollState() {
  flushReveals()
  const probe = window.scrollY + window.innerHeight * 0.32
  const atBottom =
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
  let current = sections[0]
  if (atBottom) {
    current = sections[sections.length - 1]
  } else {
    for (const section of sections) {
      if (section.offsetTop <= probe) current = section
    }
  }
  if (current && current !== activeSection) {
    activeSection = current
    setGhost(current.dataset.ghost)
    setNav(current.id)
  }
  ticking = false
}

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(updateScrollState)
}

window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', onScroll)
updateScrollState()

/* ---------------------------------------------------------- copy e-mail */
const copyBtn = document.getElementById('copy-email')

if (copyBtn) {
  const label = copyBtn.querySelector('.copy-label')
  const original = copyBtn.dataset.label || 'Copy'
  let resetTimer = 0

  const fallbackCopy = (text) => {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    field.remove()
    return ok
  }

  copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email || ''
    let ok = false
    try {
      await navigator.clipboard.writeText(email)
      ok = true
    } catch {
      ok = fallbackCopy(email)
    }
    if (!ok) return

    label.textContent = 'Copied'
    copyBtn.classList.add('is-copied')
    window.clearTimeout(resetTimer)
    resetTimer = window.setTimeout(() => {
      label.textContent = original
      copyBtn.classList.remove('is-copied')
    }, 1600)
  })
}
