// ============================================================
// main.js — integration (LEAD / Lior). Owned by the studio lead.
// Contract: ARCHITECTURE.md.
//
// Wires together the two workstream outputs:
//   - createScene(canvas)        → { scene, camera, renderer, refs, idle }
//   - createChoreography(...)    → scroll-driven camera + captions
// This file owns ONLY: bootstrap, render loop, resize, CTA, loading fade.
// ============================================================
import { createScene } from './scene.js'
import { createChoreography } from './choreography.js'
import './style.css'

const canvas = document.getElementById('scene')
const loading = document.getElementById('loading')

// Simple clock for idle(dt) — dt in seconds.
let lastTime = performance.now()

async function bootstrap() {
  try {
    const { scene, camera, renderer, refs, idle } = await createScene(canvas)

    // Scroll-driven camera + captions + dim overlay.
    createChoreography({ camera, refs })

    // Hide the loading overlay once the world is ready.
    loading.classList.add('hidden')

    // Render loop.
    function frame(now) {
      const dt = (now - lastTime) / 1000
      lastTime = now
      idle(dt)
      renderer.render(scene, camera)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)

    // Resize.
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    })

    // CTA scrolls into the story.
    document.getElementById('cta').addEventListener('click', () => {
      document.getElementById('story').scrollIntoView({ behavior: 'smooth' })
    })
  } catch (err) {
    console.error('Failed to load models:', err)
    loading.textContent = 'failed to load models — check console'
  }
}

bootstrap()
