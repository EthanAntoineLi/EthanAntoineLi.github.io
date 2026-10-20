// ============================================================================
// nora-loader.js — Sheet 02's loading curtain. The same curtain as the arm
// (src/film-loader.js: same markup, same counter, same lift), but the promise
// underneath is this sheet's own: type is set, the eight monitor frames are
// decoded, and the demo iframe has painted its room. The counter is real —
// each asset that finishes is one step; nothing here is a timer.
//
// JS off: shell.css hides the curtain and the still composition is the page.
// ============================================================================

import { initFilmLoader, reportLoadProgress } from './film-loader.js'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const shells = [...document.querySelectorAll('.device-shell')]
const demo = document.querySelector('.device-screen iframe')

const total = shells.length + 2 // monitor frames + fonts + demo
let done = 0
const step = () => reportLoadProgress(Math.min(1, ++done / total))

/* Type first: the name is set in Inter Tight and Instrument Serif, so the hero
   must not be composed out of fallback faces. */
const fonts = (document.fonts?.ready ?? Promise.resolve()).then(() => {
  step()
})

/* The monitor shot is eight turn frames (22° → face-on). Decode each one
   before the curtain lifts, so the hero never pops a blurry frame. */
const frames = Promise.all(
  shells.map(
    (img) =>
      new Promise((resolve) => {
        const finish = () => {
          step()
          resolve()
        }
        const decode = () => {
          ;(img.decode?.() ?? Promise.resolve()).catch(() => {}).then(finish)
        }
        if (img.complete) return decode()
        img.addEventListener('load', decode, { once: true })
        img.addEventListener('error', finish, { once: true })
      })
  )
)

/* The demo is the point of the sheet, so wait for its document — but never let
   an iframe stuck on its own font hold the whole page hostage. */
const demoReady = new Promise((resolve) => {
  if (!demo) return resolve()
  const finish = () => {
    step()
    resolve()
  }
  if (demo.contentDocument?.readyState === 'complete') return finish()
  demo.addEventListener('load', finish, { once: true })
  window.setTimeout(finish, 5000)
})

const sceneReady = Promise.all([fonts, frames, demoReady]).then(
  () =>
    new Promise((resolve) => {
      // Two frames after the last byte: nora-sheet.js has projected the screen
      // onto the monitor and the cat has drawn its first room, so the curtain
      // lifts on the composed hero, not on a bare shell.
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
)

initFilmLoader({ reducedMotion, sceneReady })
