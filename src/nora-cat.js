// ============================================================================
// nora-cat.js — the hub's Nora plate.
//
// Nora alone on paper, no room: the sitting part of her real movement bank,
// picked at random — blink, look, groom, yawn, tail flick, knead, nap — plus
// pointer-following eyes. Drawn from the same sprites as the desk-cat page on
// a 15 fps canvas, paused when off-screen, static under prefers-reduced-motion.
// ============================================================================

const PAL = {
  K: '#25222d', // outline
  G: '#a3a2b0', // grey fur
  D: '#6f6d7e', // tabby stripes
  L: '#dcdae3', // light chest / muzzle
  W: '#ffffff',
  P: '#f3a3b8', // pink nose / inner ears
  S: '#e4a5bb', // blush
  E: '#a9dc6c', // eyes
  M: '#4b2230', // open mouth
};

// Nora sitting, facing you, 24 × 25. '.' is transparent.
const CAT = [
  '.....K............K.....',
  '....KGK..........KGK....',
  '....KPGK........KGPK....',
  '...KGPPGKKKKKKKKGPPGK...',
  '...KGGGGGDGGGGDGGGGGK...',
  '..KGGGGGGGDGGDGGGGGGGK..',
  '..KGGGGGGGGDDGGGGGGGGK..',
  '.KGGGGGGGGGGGGGGGGGGGGK.',
  '.KDGGGGGGGGGGGGGGGGGGDK.',
  '.KGGGGGGGGGGGGGGGGGGGGK.',
  '.KDGSSGGGLLPPLLGGGSSGDK.',
  '.KGGGGGGKLLKKLLKGGGGGGK.',
  '..KGGGGLLKKLLKKLLGGGGK..',
  '...KKGGLLLLLLLLLLGGKK...',
  '.....KKKKKKKKKKKKKK.....',
  '....KGGGGLLLLLLGGGGK....',
  '...KGGDGGLLLLLLGGDGGK...',
  '...KGGGGGLLLLLLGGGGGK...',
  '..KGGDGGGGLLLLGGGGDGGK..',
  '..KGGGGGGGLLLLGGGGGGGK..',
  '..KGDGGGGGGLLGGGGGGDGK..',
  '..KGGGGGGGGGGGGGGGGGGK..',
  '..KGGGGKGGGGGGGGKGGGGK..',
  '..KGGGGKLLLKKLLLKGGGGK..',
  '...KKKKKKKKKKKKKKKKKK...',
];

// Same cat with ears flattened sideways (used only for the grumpy face).
const CAT_FLAT = CAT.slice();
CAT_FLAT[0] = '........................';
CAT_FLAT[1] = '........................';
CAT_FLAT[2] = '.KKK................KKK.';
CAT_FLAT[3] = 'KPPGKKKKKKKKKKKKKKKKGPPK';
CAT_FLAT[4] = '.KKKGGGGGDGGGGDGGGGGKKK.';

const MOUTH_OPEN = ['KMMK', 'KPPK', '.KK.'];
const PAW_UP = ['.KKK.', 'KLLLK', 'KLLLK', 'KGGGK', 'KGDGK', 'KGGGK', 'KGGGK'];
const PAW_TOP = ['.KKK.', 'KLLLK', 'KGGGK'];
const NO_PAW_R = ['KGGGG'];
const LIFTED_PAW = ['KLLLK', '.KKK.'];

// ------------------------------------------------------------------ layout
// The cat is drawn in a 44 × 34 logical box; the whole box is scaled by an
// integer and centred in the plate so the pixels stay square.
const BOX_W = 44;
const BOX_H = 34;
const CAT_X = 6;
const SIT_Y = 5;
const NAP_Y = 2;
const FLOOR = 30;

// ---------------------------------------------------------------- helpers
function rect(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}

function ellipse(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry || 1))));
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

// Draw an ASCII sprite, merging same-colour runs into single rects.
function blit(ctx, rows, x, y) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    let i = 0;
    while (i < row.length) {
      const ch = row[i];
      if (ch === '.') {
        i++;
        continue;
      }
      let k = i + 1;
      while (k < row.length && row[k] === ch) k++;
      ctx.fillStyle = PAL[ch];
      ctx.fillRect(x + i, y + j, k - i, 1);
      i = k;
    }
  }
}

function drawTail(ctx, p0, p1, p2, w, stripe) {
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18;
    const a = (1 - u) * (1 - u);
    const bb = 2 * (1 - u) * u;
    const cc = u * u;
    pts.push([
      Math.round(a * p0[0] + bb * p1[0] + cc * p2[0]),
      Math.round(a * p0[1] + bb * p1[1] + cc * p2[1]),
    ]);
  }
  ctx.fillStyle = PAL.K;
  for (const [x, y] of pts) ctx.fillRect(x - 1, y - 1, w + 2, w + 2);
  pts.forEach(([x, y], i) => {
    ctx.fillStyle = i >= pts.length - 3 || (stripe && i % 6 === 4) ? PAL.D : PAL.G;
    ctx.fillRect(x, y, w, w);
  });
}

function tailSway(tail, now) {
  return Math.round(Math.sin((now / 1000) * Math.PI * 2 * (tail.speed || 0.3)) * (tail.amp || 2));
}

function drawWhiskers(ctx, x0, y0) {
  ctx.globalAlpha = 0.85;
  rect(ctx, x0 - 2, y0 + 10, 3, 1, '#ebe9f1');
  rect(ctx, x0 - 1, y0 + 12, 3, 1, '#ebe9f1');
  rect(ctx, x0 + 23, y0 + 10, 3, 1, '#ebe9f1');
  rect(ctx, x0 + 22, y0 + 12, 3, 1, '#ebe9f1');
  ctx.globalAlpha = 1;
}

function drawEyes(ctx, x0, y, kind, look) {
  for (const ex of [x0 + 5, x0 + 15]) {
    switch (kind) {
      case 'closed': // content "u" shape
        rect(ctx, ex, y + 1, 1, 1, PAL.K);
        rect(ctx, ex + 1, y + 2, 2, 1, PAL.K);
        rect(ctx, ex + 3, y + 1, 1, 1, PAL.K);
        break;
      case 'blink':
        rect(ctx, ex, y + 1, 4, 1, PAL.K);
        break;
      case 'happy': // "^" shape
        rect(ctx, ex, y + 1, 1, 1, PAL.K);
        rect(ctx, ex + 1, y, 2, 1, PAL.K);
        rect(ctx, ex + 3, y + 1, 1, 1, PAL.K);
        break;
      case 'wide':
        rect(ctx, ex, y - 1, 4, 4, PAL.E);
        rect(ctx, ex + 1, y + 1, 2, 1, PAL.K);
        rect(ctx, ex + 2, y, 1, 1, PAL.W);
        break;
      default: {
        // open, pupils follow `look`
        rect(ctx, ex, y, 4, 3, PAL.E);
        const px = ex + 1 + (look ? look.dx : 0);
        const py = y + (look && look.dy < 0 ? 0 : 1);
        rect(ctx, px, py, 2, 2, PAL.K);
        rect(ctx, px + 1, py, 1, 1, PAL.W);
      }
    }
  }
}

// Sitting, facing you.
function drawSit(ctx, x0, y0, p, now) {
  const sway = tailSway(p.tail, now);
  drawTail(
    ctx,
    [x0 + 19, y0 + 21],
    [x0 + 30, y0 + 23],
    [x0 + 26 + sway, y0 + 8],
    2,
    true
  );

  const body = p.ears === 'flat' ? CAT_FLAT : CAT;
  blit(ctx, body, x0, y0);
  if (p.paw === 'groom' || p.paw === 'chin') blit(ctx, NO_PAW_R, x0 + 11, y0 + 23);
  if (p.knead) {
    const px = p.knead === 'L' ? 7 : 12;
    blit(ctx, LIFTED_PAW, x0 + px, y0 + 22);
  }
  if (p.ears === 'perk') {
    rect(ctx, x0 + 5, y0 - 1, 1, 1, PAL.K);
    rect(ctx, x0 + 5, y0, 1, 1, PAL.G);
    rect(ctx, x0 + 18, y0 - 1, 1, 1, PAL.K);
    rect(ctx, x0 + 18, y0, 1, 1, PAL.G);
  }
  drawWhiskers(ctx, x0, y0);
  drawEyes(ctx, x0, y0 + 7, p.eyes, p.look);
  if (p.mouth === 'open') blit(ctx, MOUTH_OPEN, x0 + 10, y0 + 11);
  if (p.mouth === 'tongue') rect(ctx, x0 + 11, y0 + 13, 2, 1, PAL.P);
  if (p.paw === 'groom') blit(ctx, PAW_UP, x0 + 13, y0 + 11);
  if (p.paw === 'chin') blit(ctx, PAW_UP, x0 + 14, y0 + 13);
}

// Curled up asleep (a compact loaf; no tail, cats tuck it).
function drawLoaf(ctx, x0, y0, now) {
  const t = now / 1000;
  const breath = Math.sin((t * Math.PI * 2) / 3.6) > 0 ? 1 : 0;

  ctx.globalAlpha = 0.05;
  ellipse(ctx, x0 + 12, y0 + 27, 12, 2, PAL.K);
  ctx.globalAlpha = 1;

  ellipse(ctx, x0 + 12, y0 + 23 - breath, 13, 5 + breath, PAL.K);
  ellipse(ctx, x0 + 12, y0 + 23 - breath, 12, 4 + breath, PAL.G);
  for (const x of [4, 7, 17, 20]) rect(ctx, x0 + x, y0 + 21 - 2 * breath, 1, 3, PAL.D);

  const hy = y0 + 10 - breath;
  blit(ctx, CAT.slice(0, 15), x0, hy);
  drawEyes(ctx, x0, hy + 7, 'closed');
  drawWhiskers(ctx, x0, hy);
  blit(ctx, PAW_TOP, x0 + 4, y0 + 24);
  blit(ctx, PAW_TOP, x0 + 13, y0 + 24);
}

// --------------------------------------------------------------- movement
// The sitting part of Nora's movement bank. The room-dependent moves (walk,
// bowl, window, plant, butterfly) need the room and are not used here.
const ACTION_MS = {
  rest: null, // random
  groom: 2600,
  yawn: 1600,
  look: 2400,
  flick: 1500,
  knead: 4200,
  nap: 5200,
};
const BANK = ['groom', 'yawn', 'look', 'flick', 'knead', 'nap'];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// -------------------------------------------------------------- the canvas
export function initNoraCat(canvas, opts = {}) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const reducedMotion =
    opts.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const still = Boolean(opts.still);

  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let scale = 1;
  let originX = 0;
  let originY = 0;
  let action = 'rest';
  let actionStart = 0;
  let actionUntil = 0;
  let lastAction = '';
  let look = { dx: 0, dy: 0 };
  let blinkUntil = 0;
  let nextBlink = 0;
  let earUntil = 0;
  let nextEar = 0;
  let running = false;
  let raf = 0;
  let lastPaint = 0;
  const pointer = { x: 0, y: 0, at: 0, inside: false };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = Math.round(rect.width);
    cssH = Math.round(rect.height);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    scale = Math.max(
      2,
      Math.min(10, Math.floor(Math.min((cssH * 0.95) / BOX_H, (cssW * 0.95) / BOX_W)))
    );
    originX = Math.round((cssW - BOX_W * scale) / 2);
    originY = Math.round((cssH - BOX_H * scale) / 2);
    if (!running) paint(performance.now());
  }

  function pointerLook(now) {
    if (!pointer.inside || now - pointer.at > 2600) return null;
    const cx = originX + (CAT_X + 12) * scale;
    const cy = originY + (SIT_Y + 12) * scale;
    return {
      dx: pointer.x < cx - scale * 7 ? -1 : pointer.x > cx + scale * 7 ? 1 : 0,
      dy: pointer.y < cy - scale * 5 ? -1 : 0,
    };
  }

  function startAction(now) {
    if (still) {
      action = 'rest';
      actionStart = now;
      actionUntil = now + 1e9;
      return;
    }
    // Half the time she just sits; the other half one of the bank moves.
    if (Math.random() < 0.45) {
      action = 'rest';
      actionUntil = now + rand(2600, 5200);
    } else {
      let next = BANK[Math.floor(Math.random() * BANK.length)];
      if (next === lastAction) next = BANK[(BANK.indexOf(next) + 1) % BANK.length];
      action = next;
      actionUntil = now + ACTION_MS[next];
    }
    actionStart = now;
    canvas.dataset.action = action;
    if (action === 'look') look = { dx: Math.random() < 0.5 ? -1 : 1, dy: 0 };
    if (action === 'rest') look = { dx: 0, dy: 0 };
    if (action !== 'rest') lastAction = action;
    blinkUntil = 0;
    earUntil = 0;
  }

  function progress(now) {
    if (now >= actionUntil) startAction(now);
    if (action === 'rest' || action === 'look' || action === 'flick') {
      if (now > nextBlink) {
        blinkUntil = now + 130;
        nextBlink = now + rand(2200, 5200);
      }
    }
    if (action === 'rest' && now > nextEar) {
      earUntil = now + 260;
      nextEar = now + rand(3800, 9000);
    }
  }

  function pose(now) {
    const t = now - actionStart;
    const p = {
      eyes: 'open',
      look: { dx: 0, dy: 0 },
      ears: null,
      mouth: null,
      paw: null,
      knead: null,
      tail: { amp: 2, speed: 0.3 },
    };

    switch (action) {
      case 'groom':
        p.paw = 'groom';
        p.eyes = 'closed';
        p.mouth = Math.floor(now / 220) % 2 ? 'tongue' : null;
        break;
      case 'yawn':
        p.eyes = 'closed';
        p.mouth = 'open';
        p.tail = { amp: 3, speed: 0.5 };
        break;
      case 'look':
        p.look = look;
        break;
      case 'flick':
        p.tail = { amp: 4, speed: 1.6 };
        break;
      case 'knead':
        p.eyes = 'happy';
        p.knead = Math.floor(t / 300) % 2 ? 'L' : 'R';
        p.tail = { amp: 2.5, speed: 0.5 };
        break;
      case 'nap':
        return p; // handled by drawLoaf
      default:
        if (now < earUntil) p.ears = 'perk';
        break;
    }

    if (action !== 'nap' && p.eyes === 'open') {
      const follow = pointerLook(now);
      if (follow) p.look = follow;
      if (now < blinkUntil) p.eyes = 'blink';
    }
    return p;
  }

  function paint(now) {
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);

    // a quiet wash of shadow, so she sits on the sheet instead of floating
    ctx.globalAlpha = 0.055;
    ellipse(ctx, CAT_X + 12, FLOOR, 12, 2, PAL.K);
    ctx.globalAlpha = 1;

    if (action === 'nap') {
      drawLoaf(ctx, CAT_X, NAP_Y, now);
    } else {
      drawSit(ctx, CAT_X, SIT_Y, pose(now), now);
    }
    ctx.restore();
  }

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (now - lastPaint < 66) return; // ~15 fps is plenty for this
    lastPaint = now;
    progress(now);
    paint(now);
  }

  function start() {
    if (running || still) return;
    running = true;
    lastPaint = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // start from a deterministic resting pose with eyes open
  const now0 = performance.now();
  canvas.dataset.action = 'rest';
  actionStart = now0;
  actionUntil = now0 + 3200;
  nextBlink = now0 + 2200;
  nextEar = now0 + 5200;

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.at = performance.now();
    pointer.inside = true;
  });
  canvas.addEventListener('pointerenter', () => {
    pointer.inside = true;
    pointer.at = performance.now();
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  if (reducedMotion || still) {
    // one static frame; no timer, no blinking
    paint(performance.now());
    return { resize, paint };
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    },
    { threshold: 0.01 }
  );
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (canvas.getBoundingClientRect().top < window.innerHeight) start();
  });

  return { resize, paint, start, stop };
}
