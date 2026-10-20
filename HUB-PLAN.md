# HUB-PLAN — from one-object film to a portfolio hub

Draft for discussion · 2026-10-20 · **phase 1 built locally** (see below)
The previous site was the v6 "product film" (`master`, see `BUILD-LOG.md`). This plan does not
replace `SPEC.md`; it is the v7 direction.

## Status — 2026-10-20

Phase 1 is implemented on the `hub` branch, locally only (no deploy, no push):

- `/` is the hub (hero, works register, mission band with system diagram, status, record, contact,
  title block); `/work/arm/` is the v6 film moved verbatim, plus an `← index` link back to the hub.
- Tech path for this phase: **Vite MPA** (the acceptable fallback in §8.1), not Astro yet — no
  dependency changes were possible/needed. The IA and design are unchanged by that choice; an Astro
  migration remains open.
- `base` moved from `./` to `/` (user-site root assumption); set `BASE=/personal-page/` for a project
  path. The film's model URL now derives from `BASE_URL`.
- Hub plate is a fresh 16:10 render from `arm-viewer.js` (no new asset pipeline).
- Verified: desktop/laptop/mobile, no-JS, fast-scroll reveals, production build + preview, and the
  film scene still loads with zero console errors. Captures in `../review-v10/`.
- **Sheet 02 — Nora** was built on 2026-10-20 (personal AI + desk cat, with the real pet page embedded
  as a demo). The register is now `05 sheets · 02 published`: 01 arm, 02 Nora, with drone / AI
  interviewer / physics renumbered 03–05 and still `SHEET IN PREP`.
- Per Ethan's privacy call, the Nora page publishes no ports, localhost/launchd details or repo links,
  and uses only the demo mode with scripted fake events — the real activity log is never used.
- The remaining open decisions in §10 are unchanged, particularly the repo/URL rename and deployment.

---

## 1. Diagnosis — why the current page cannot just be "expanded"

The v6 page is a **film about one object**: fixed 3D stage, six camera stops, ~170 words, the real
EPQ arm. As a film it is strong. As a hub it fails structurally, not cosmetically:

| Blocker | Why it matters |
| --- | --- |
| **No index** | A visitor cannot see that anything else exists. There is no wayfinding beyond the film's own chapters. |
| **The scroll choreography is global** | The fixed stage + scroll-scrubbed camera belongs to one object. Repeating it for N projects means N competing stage animations and a page that fights the reader. |
| **Only one thing is visual** | The arm is the only asset. Every other project would be text — the opposite of the "show, don't tell" brief the film was built to. |
| **No deep links** | Nothing can be shared as "my drone project". Universities, peers and future employers all need per-project URLs. |
| **No-JS / mobile gaps** | The film is desktop-tuned and assumes JS (the loader covers the page without it). A hub must be readable cold, on a phone, from a link in an email. |

The conclusion is not "change the design language". It is **split the roles**: the film stays the
flagship exhibit, and a new index page sits in front of it.

---

## 2. Concept — the site as an engineering drawing set

> **Sheet 00 is the index. Sheets 01–0N are the projects. The arm film is Sheet 01, untouched.**

Carry over the strongest thing the site already has — the drafting-sheet/film identity: paper, ink,
rust, hairlines, mono annotations, the honest "not built" labels. Add the one thing it lacks: a
**register of drawings** you can scan in ten seconds.

The hub answers four questions without scrolling far:

1. **Who** — name, one line, what he builds.
2. **What** — the works index, each with a status.
3. **Is it real** — status per project: `BUILT` / `IN BUILD` / `PROPOSED` / `STUDY`.
4. **How to reach him** — mail, GitHub, live model.

Honesty stays the brand. Every project says what it is *and* what it is not; that is the differentiator
against a normal student portfolio, and it is already the voice of the film.

### Directions considered and rejected

| Direction | Why not |
| --- | --- |
| **One long page, every project as a section** | No per-project URLs, no OG cards, unbounded growth, and the film's scroll choreography would have to be abandoned or repeated. |
| **Generic portfolio card grid** | Loses the drafting/film identity and the status honesty; looks like every other student site. |
| **Everything hung off the rescue mission** | Forces unrelated work (AI interviewer, physics investigations) into a false narrative. The mission is a band on the hub, not the taxonomy. |
| **Keep the film as the home page, add links at the bottom** | Visitors bounce before the links; the film is a poor index. |

---

## 3. Site map

```
/                        Sheet 00 — title, works index, mission band, record, contact
/work/arm/               Sheet 01 — the current film, verbatim (flagship)
/work/nora/              Sheet 02 — Nora, the personal AI, with the desk-cat demo
/work/nora/demo/         the desk-cat page, demo-only (iframe target; ?full)
/work/drone/             Sheet 03 — FPV drone prototype
/work/perception/        Sheet 04 — AI interviewer / emotion-dataset study  (name TBD)
/work/physics/           Sheet 05 — lab investigations (PASCO centripetal, diode I-V)  (name TBD)
/about/                  optional — bio, toolchain, CV PDF, record
/404.html
```

Rules:

- **One page per thing worth a link.** Small investigations share one "studies" sheet instead of
  becoming three thin pages.
- **Awards are not projects.** ASDAN etc. live in a compact *Record* strip on the home page, not in a
  fake case study.
- **HAVK is not a separate project.** It is the arm's live model — linked from Sheet 01 and from
  contact, never double-counted.
- **Nothing ships as a placeholder page.** An unbuilt project either has real content or does not get
  a URL yet.

---

## 4. Home page — layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ ethan antoine li            INDEX  ABOUT  MAIL     SHEET 00 · REV 26 │
├──────────────────────────────────────────────────────────────────────┤
│ ENGINEERING · RESCUE ROBOTICS                                        │
│                                                                      │
│  Ethan                                                               │
│  Antoine Li                                                          │
│                                                                      │
│  I build the pieces of a mountain-rescue robot —                     │
│  an arm, a drone, and the code between them.                         │
│                                                                      │
│  [5-axis arm · built] [FPV drone · flying] [perception · not built]  │
│                                                                      │
│  SELECTED WORK ↓                                                     │
├──────────────────────────────────────────────────────────────────────┤
│ 01 ──────────────────────────────────────  ┌──────────────────────┐  │
│ FIVE-AXIS ROBOTIC ARM                      │   plate: arm still   │  │
│ six axes drawn, five built · EPQ artefact  │   16:10, paper mat   │  │
│ HARDWARE / 2026 / BUILT                    └──────────────────────┘  │
│                                             OPEN SHEET ↗            │
├──────────────────────────────────────────────────────────────────────┤
│ 02 ──────────────────────────────────────  [ plate: drone ]          │
│ FPV DRONE                                                            │
│ pilot, goggles, video — no autonomy yet                              │
│ HARDWARE / 2026 / FLYING                          OPEN SHEET ↗       │
├──────────────────────────────────────────────────────────────────────┤
│ … 03, 04 — same row; rows are links, hover lifts the plate 1.02×     │
├──────────────────────────────────────────────────────────────────────┤
│ MISSION — why rescue robotics                                        │
│   two sentences, the drone → fix → arm diagram, "the handoff does    │
│   not exist yet"                                                     │
├──────────────────────────────────────────────────────────────────────┤
│ RECORD — 2026 EPQ artefact · 2026 ASDAN final · …   (small table)    │
├──────────────────────────────────────────────────────────────────────┤
│ CONTACT — mail · github · live model                                 │
│ TITLE BLOCK  portfolio / sheet 00 of 00 / rev 2026.10 / scale 1:1    │
└──────────────────────────────────────────────────────────────────────┘
```

Decisions inside the layout:

- **Works before mission.** Both audiences scan for evidence first; the "why" lands better after they
  have seen the object.
- **Rows, not cards.** A row is a register line: number, title, one-line, tags, plate. It reads like a
  drawing index and still shows an image — `01` is taller than the rest (the flagship), which is the
  "show-off" moment without a second 3D scene.
- **Every row carries its plate.** Not hover-only: touch devices and fast scrollers get the image too.
  Hover only adds the arrow / 1.02× lift.
- **No 3D on the home page.** The home must paint in under ~150 KB; the film is one click away and its
  model is lazy-loaded there. (Variant to discuss: a small draggable arm on the home hero. It costs
  ~160 KB of JS plus a GLB and competes with the film — not recommended.)
- **Mobile:** rows stack (plate above title), hero type scales, no hover-dependent information, the
  index stays one column.

### Variant B (only if we want more theatre)

Split-screen index: compact 80 px rows on the left, sticky plate preview on the right that swaps on
hover. More "drawing set", more desktop-only, more fragile on mobile. Recommended only after the
content is in place — the row layout above is the safe default.

---

## 5. Project sheet template (Sheets 02+)

The film keeps its own choreography; other sheets are **readable case studies**, not films.

```
← SHEET INDEX                                         SHEET 02 / 05
SHEET 02 · HARDWARE · 2026
FPV Drone
one sentence of what it is

[ meta table: STATUS / ROLE / TOOLS / LINKS ]

[ PLATE 01 — the real thing, 16:10, framed, FIG. 01 caption ]

WHAT IT IS          → 2–4 sentences
HOW IT WORKS        → 1 diagram or spec table + 2–3 sentences
WHAT'S REAL         → status pipeline: FLY / RECOGNISE / FIX / HAND OFF
                       (built / not built / not built / not built)
WHAT'S NEXT         → 1–2 sentences, honest

[ optional PLATE 02 ]

NEXT SHEET →  / back to index
```

Rules:

- **150–300 words per sheet**, 2–4 figures. Show, don't narrate.
- **One primary status** (`BUILT` / `IN BUILD` / `PROPOSED` / `STUDY`) plus a pipeline block only
  where it is genuinely a pipeline (arm, drone).
- **Every claim is evidenced or labelled.** No invented stats, no "95% accurate", no skill bars.
- **One interactive element max** per sheet (the arm's 3D is the exception, already built).
- A sheet with no visual is a diagram sheet, not a fake-photo sheet.

---

## 6. Design system

### Carried over (unchanged)

| Token / element | Value |
| --- | --- |
| Paper | `#f6f6f4`; recessed band `#efefec`; ink band `#101214` for the mission/record band |
| Ink | `#101214`; body `#3c4045`; muted `#5f6469` |
| Signal rust | `#b23e22` — meaning only (status, missing links, arrows, current sheet) |
| Hairlines | `rgba(16,18,20,.14)` / `.07` |
| Type | Inter Tight 300/400 (display + prose) · Instrument Serif italic (voice, one per page) · system mono (labels, tables, captions) |
| Furniture | plate frames + corner ticks, `FIG. 0X —` captions, `TABLE 0X —` headers, title-block footer |
| Motion | masked line reveals, 400–700 ms, `--ease: cubic-bezier(.22,1,.36,1)`; reduced-motion = static |

### New components (shared, extracted from the film's CSS)

- `.sheet-row` — number, title, one-line, tags, plate, arrow; keyboard focusable as one link.
- `.plate` — 16:10 frame on paper, hairline inset + corner ticks, mono caption below. The current arm
  still is a portrait 3:4 crop made for the film hero; a landscape re-render comes from the same viewer
  (`arm-viewer.js` fits any canvas aspect), so no new asset pipeline is needed.
- `.status` — text chip/stamp: `BUILT` / `IN BUILD` / `PROPOSED` / `STUDY`; text first, colour second.
- `.meta-table` — two-column mono spec/meta table.
- `.record-row` — year, item, one line; no badges.
- `.next-sheet` — footer link to the next sheet.

### Retired on the hub (film-only)

Frame counter, GMT+8 clock, mesh/points/x-ray switch, progress ticks, scroll-scrubbed stage, index
overlay. These are film equipment; carrying them onto the hub would make the hub feel like a fake film.
Custom cursor: keep only a small `OPEN ↗` label over rows/sheets, or drop it on touch.

### Copy voice

Builder's logbook. Short declaratives, no hype, status labels where it matters. The hub is allowed a
warm first person; the sheets stay technical.

---

## 7. Content inventory — what exists, what is missing

| Project | Evidence available now | Missing | Verdict |
| --- | --- | --- | --- |
| **5-axis arm** (EPQ) | Real articulated GLB (1.6 MB, 290k tris), 2× still plate, film, specs, HAVK live model | Real photos of the printed/assembled arm — would be the single strongest credibility asset | Sheet 01, already done |
| **FPV drone** | Description only (pilot + goggles + video, no autonomy) | Photo of the build, parts list, flight clip | Needs assets before it becomes a sheet; a diagram-only sheet is the fallback |
| **AI interviewer** | Profile-level description (Python, emotion-dataset analysis → apparent-confidence score) | Repo link, screenshot, result chart, what the data actually showed | Good candidate — every asset is generatable from code/data, no photos needed |
| **Physics investigations** | PASCO centripetal-force experiment, diode I-V / Shockley equation | Graphs, data tables, photos of the setup | Strong "studies" sheet; publishable as lab notes if the data can be exported |
| **ASDAN Senior Physics Challenge** | Finalist, 2026-06-27 (confirm details before publishing) | Certificate/photo optional | Record row, not a sheet |
| **EPQ report** | Exists (P304) | Permission/copyright check, PDF size | Optional download from Sheet 01 — strong evidence, cheap to add |
| **Nora — personal AI + desk cat** | `nora-pet` delivery package (plugin, server, pixel page, install docs); real activity log 10/17–10/20 | Nothing blocking — Ethan confirmed it runs 24/7, all functions work | **Sheet 02, published 2026-10-20**; demo embedded, no infra details published |
| **Mech sandbox / web toys** | `games/mech-sandbox` in the workspace (28 engine tests, single-file build) | Confirm authorship/framing | If it is his to show, a "web experiments" sheet is the most fun exhibit and needs no photography |
| **HAVK visualiser** | Built, deployed, linked | — | Link from Sheet 01 + contact; not a project |
| **GitHub profile README** | Profile currently empty per the 2026-10-19 snapshot | Needs writing | Second front door — quick win, links to the hub |

**The real bottleneck is assets, not design.** Five projects with one good visual each is a hub; five
pages of prose is not. The one-hero-asset rule: every sheet gets at least one 1600×1000 plate
(photo, render, screenshot or diagram) on the same paper mat so mixed work feels like one collection.

---

## 8. Technical plan

### 8.1 Build approach

| | **Vite MPA** (current stack) | **Astro 5 static** (recommended) |
| --- | --- | --- |
| Migration | none | ~half a day; film ported verbatim into one `.astro` page |
| Adding a project | copy an HTML page, edit 5 places | add one `.md` + frontmatter + images |
| Shared chrome | duplicated per page (or a custom plugin) | layouts/components |
| No-JS content | only if hand-written carefully | default |
| 3D | same vanilla script | same vanilla script (no island framework needed) |
| Risk | pages drift; every redesign touches N files | migration must not regress the film |
| Fit for heavy iteration | poor | good |

**Recommendation: Astro**, because the site will be redesigned more than once (eight review rounds in two
days is the evidence) and projects will be added over time. Keep the film as its own page with its own
CSS/JS, untouched; extract only tokens + the plate/status components into shared CSS. If the goal is
"ship the hub this week", Vite MPA is an acceptable fallback — the IA and design above do not change.

Content model (Astro collections / or one `projects.js` for MPA):

```yaml
title: Five-axis robotic arm
slug: arm
order: 1
year: 2026
field: hardware          # hardware | software | research
status: built            # built | in-build | proposed | study
featured: true
oneLine: Six axes drawn, five built. EPQ artefact.
cover: /img/plates/arm.webp
links: [{ label: Live model, href: https://ethanantoineli.github.io/HAVK/ }]
```

### 8.2 URL and deploy

- **Rename the repo** `personal-page` → `EthanAntoineLi.github.io` so the hub lives at
  `https://ethanantoineli.github.io/` and sheets at `/work/arm/…`. Short URLs matter for a page that
  gets pasted into UCAS-adjacent emails and messages. Old project-site links will need updating; GitHub
  redirects the repo web URL, not the Pages path.
- **Repo must be public** on the free plan for Pages (the README still says it is private — verify current
  state). Keep the GitHub Actions workflow; point it at `dist/`.
- **Custom domain: not now.** Add later if wanted; it only changes `base`/canonical/OG URLs.
- Keep HAVK at `/HAVK/` as a separate project site; link, don't merge.

### 8.3 Budgets and rules

- **Hub:** < 150 KB before covers (HTML + CSS + 2 fonts + hero WebP), LCP < 1.5 s on 4G. Covers lazy,
  WebP 40–80 KB each.
- **Sheets:** < 250 KB + figures; no three.js except Sheet 01.
- **Sheet 01:** unchanged — 3D chunk and 1.6 MB GLB stay lazy; still plate for no-WebGL/phones.
- **No trackers, no cookies, no external requests** (self-hosted fonts) — keep the v2 rule.
- **No-JS:** hub and sheets are static HTML and readable; the film gets a `<noscript>` line so the
  loader can't hide the page.
- **Accessibility:** rows are real links, visible focus, status as text not colour only, alt text on
  every plate, `prefers-reduced-motion` respected.
- **SEO/OG:** per-page `<title>` / description / `og:image` (1200×630 crop of the plate, generated at
  build or by hand). Title pattern: `Sheet 04 — Physics at the bench · Ethan Antoine Li`.

---

## 9. Ship order (priority, not dates)

| Phase | Work | Keeps the site live? |
| --- | --- | --- |
| **0 — Decide** | Project list, assets, tech path, URL (this discussion) | — |
| **1 — Split** | Move the film to `/work/arm/`; build the hub with the real arm row + chrome + contact; deploy | Yes — every step deployable |
| **2 — Content** | First two sheets with real assets (drone and/or physics studies), one plate each | Yes |
| **3 — Close** | Record strip, about/CV (optional), 404, OG images, mobile QA, GitHub profile README | Yes |
| **4 — Later** | Variant B index, more sheets, custom domain, EPQ report PDF | Yes |

Do not start with the hover-theatre or a new 3D scene. The order is: **index → real sheets → polish.**

---

## 10. Decisions needed from Ethan

1. **Current state** — what is the live URL today; is the repo public; is Pages enabled? (The README
   from yesterday says "not deployed / private".)
2. **The list** — what counts as "everything": arm, drone, AI interviewer, physics investigations,
   ASDAN, anything else? Is the mech-sandbox game yours to show? Can the EPQ report be public?
3. **Assets** — photos of the printed arm? the drone? lab graphs? AI-interviewer screenshots? This
   decides whether the hub ships with one strong exhibit or five.
4. **Home 3D** — keep the home purely static (recommended) or give the arm a small draggable model
   there too?
5. **Tech** — Astro migration vs Vite MPA; and rename the repo to `EthanAntoineLi.github.io`?
6. **Audience** — admissions readers first, or peers/employers? (Changes how much Record/About gets.)
7. **Visual direction** — keep v6 paper/ink/rust (recommended, it is already distinctive) or start a
   new skin?

---

## 11. Not doing (this round)

No CMS, no blog, no dark mode, no analytics, no custom domain, no login, no 3D on the hub, no skill
bars, no invented photos, no second redesign of the film. The film is the asset — protect it.
