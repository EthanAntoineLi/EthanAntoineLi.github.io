// ============================================================================
// hub.js — hub-only behaviour. Loads the shared scroll/reveal module and adds
// the copy-email button. (The sheet pages load scroll.js directly.)
// ============================================================================

import './scroll.js'

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
