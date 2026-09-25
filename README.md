# Ethan Antoine Li — Personal Page

A scroll-story engineering portfolio: mountain-rescue robotics, told as one cinematic scroll through a 3D scene.

**Mission:** *Why send more people into the same dangerous ground to save someone — why not robots?*

- A **5-DOF robotic arm** (my EPQ) — the rescue robot's first piece.
- An **FPV drone** (prototype) — the future eyes of the system.
- Built with **Bambu Lab H2S** + **Shapr3D**.

> **Honest framing:** both builds are **prototypes**. The drone's vision system is not built yet — the page says so openly.

## Stack

- **Vite** + **Three.js** (vanilla, no framework).
- Scroll-driven camera over a monochrome "clay" 3D scene.
- Playfair Display (serif) + DotGothic16 (dot-matrix).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173/
```

Production build:

```bash
npm run build    # outputs to dist/
npm run preview  # preview the dist/ build
```

> Windows note: use `npm.cmd` in PowerShell (execution policy blocks `npm.ps1`).

## Layout

- `src/scene.js` — `createScene(canvas)` builds the 3D world (models, lighting, terrain, poses).
- `src/choreography.js` — `createChoreography(...)` maps scroll → camera + captions.
- `src/main.js` — integration (render loop, resize, CTA, loading).
- `models/` — GLB assets (robot, person, drone — drone is a placeholder).
- `dist/` — production build.

Full module contracts in `ARCHITECTURE.md`. Full "what I want" in `SPEC.md`. Build history in `BUILD-LOG.md`.

## Status

v1 build complete (hero + 4-keyframe scene + tail). Next: drop in the real arm/drone models, decimate for web, and deploy to GitHub Pages.

## Contact

- GitHub: [EthanAntoineLi](https://github.com/EthanAntoineLi)
- Email: ethan.li.1@outlook.com
