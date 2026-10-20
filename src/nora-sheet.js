// Sheet 02 — focus ring for the embedded demo.
//
// The demo is a separate document. When keyboard focus moves into it, the
// host iframe matches neither :focus nor :focus-within in Chrome, so a CSS
// ring never paints on the tab path. The iframe is same-origin, so the child
// window's own focus events can drive a marker class on the host instead.
const frame = document.querySelector('.demo-frame iframe')

if (frame) {
  const setFocused = (on) => frame.classList.toggle('is-focused', on)

  frame.addEventListener('focus', () => setFocused(true))
  frame.addEventListener('blur', () => setFocused(false))

  frame.addEventListener('load', () => {
    const win = frame.contentWindow
    if (!win) return
    win.addEventListener('focus', () => setFocused(true))
    win.addEventListener('blur', () => setFocused(false))
  })
}
