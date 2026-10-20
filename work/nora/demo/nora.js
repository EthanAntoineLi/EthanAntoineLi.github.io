/* Nora: a pixel-art desk cat that mirrors what an OpenClaw agent is doing.
   Plain JS, no dependencies.

   Preview without a server:
     ?demo                          looping fake conversation
     ?demo&state=working            freeze one agent state: idle, listening, thinking, working,
                                    replying, done, error, offline (or nap)
     ?demo&activity=window          start idle with one activity: groom, yawn, look, flick, knead,
                                    butterfly, spin, snack, window, plant, wander, nap */
(() => {
  'use strict';

  const W = 160, H = 90;            // the room, in logical pixels
  const FPS = 15;                   // pixel art doesn't need more; easy on an 8 GB M1
  const HOME = 80;                  // Nora's spot on the rug (centre x)
  const CY = 57;                    // top of the sitting sprite
  const CX = HOME - 12;             // left of the sitting sprite when she's home
  const FLOOR = 82;                 // where her feet touch the floor
  const WINDOW_X = 31, BOWL_X = 118, PLANT_X = 127;
  const WALK_SPEED = 16, RUN_SPEED = 48;   // logical px per second

  const qs = new URLSearchParams(location.search);
  // This copy is the portfolio's demo build: it never talks to a server. The
  // page is embedded by default (?full opens the whole pet page); ?state=... freezes
  // one state for screenshots.
  const DEMO = true;
  const EMBED = document.documentElement.classList.contains('embed-demo');
  const PIN = qs.get('state');
  const FORCE_ACT = PIN === 'nap' ? 'nap' : qs.get('activity');

  const $ = (id) => document.getElementById(id);
  const canvas = $('scene');
  const g = canvas.getContext('2d');
  const roomEl = $('room');
  const bubbleEl = $('bubble');
  const ui = {
    chip: $('stateChip'), forEl: $('stateFor'), line: $('stateLine'), doing: $('factDoing'),
    agent: $('factAgent'), today: $('factToday'), pets: $('factPets'), conn: $('conn'),
    log: $('log'), logEmpty: $('logEmpty'), sound: $('soundBtn'), foot: $('foot'),
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (a, b) => a + Math.random() * (b - a);
  const ease = (u) => u * u * (3 - 2 * u);
  const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const isNight = () => { const h = new Date().getHours(); return h >= 21 || h < 6; };

  // ------------------------------------------------------------------ palette

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
    R: '#e8505b',
    Y: '#ffd35a',
    O: '#f29e4c',
    C: '#a0683d', // kibble
    V: '#5fae6b', // leaf
  };

  // ------------------------------------------------------------------ sprites
  // Nora sitting and facing you, 24 x 25. '.' is transparent.
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

  // Same cat with ears flattened sideways (annoyed / scared).
  const CAT_FLAT = CAT.slice();
  CAT_FLAT[0] = '........................';
  CAT_FLAT[1] = '........................';
  CAT_FLAT[2] = '.KKK................KKK.';
  CAT_FLAT[3] = 'KPPGKKKKKKKKKKKKKKKKGPPK';
  CAT_FLAT[4] = '.KKKGGGGGDGGGGDGGGGGKKK.';

  // Nora from behind (looking out of the window), made from the front sprite:
  // keep the outline, fill the inside with fur and tabby stripes.
  const BACK = CAT.map((row, j) => {
    if (j <= 3) return row.replace(/P/g, 'G');
    if (j === 14 || j === 24) return row;
    let a = row.indexOf('K');
    while (row[a + 1] === 'K') a++;
    let b = row.lastIndexOf('K');
    while (row[b - 1] === 'K') b--;
    let out = '';
    for (let i = 0; i < row.length; i++) {
      if (i <= a || i >= b) { out += row[i]; continue; }
      let ch = 'G';
      if (j >= 4 && j <= 8 && (i === 9 || i === 14 || ((i === 11 || i === 12) && j >= 6))) ch = 'D';
      if (j >= 15 && (i === 11 || i === 12)) ch = 'D';
      if ((j === 17 || j === 20) && ((i >= 5 && i <= 7) || (i >= 16 && i <= 18))) ch = 'D';
      out += ch;
    }
    return out;
  });

  // Nora walking, side view facing right, 26 wide. Legs and tail are drawn separately.
  const SIDE = [
    '................K...K.....',
    '...............KPK.KPK....',
    '...............KGGGGGGK...',
    '..............KGGDGDGGGK..',
    '..............KGGGGGEEGGK.',
    '...KKKKKKKKKKKGGGGGGEKGGGK',
    '..KGGDGGDGGDGGGGGGGSSLLLPK',
    '.KGGGGGGGGGGGGGGGGGGGLLKLK',
    '.KGGDGGGDGGGGGGGGGGGLLLLK.',
    '.KGGGGGGGGGGGGGGGGKKLLKK..',
    '.KGGGGGGGGGGGGGGGLLLK.....',
    '.KGGGGGGGGGGGGGGLLLLK.....',
    '..KGGGGLLLLLLLLLLLLK......',
    '...KKKKKKKKKKKKKKKK.......',
  ];
  const SIDE_W = SIDE[0].length;
  const flip = (rows) => rows.map((r) => [...r].reverse().join(''));
  const SIDE_L = flip(SIDE);

  // Mouth overlays, drawn over the default "ω" smile.
  const MOUTH_OPEN = ['KMMK', 'KPPK', '.KK.'];                 // happy meow / yawn, at (10, 11)
  const MOUTH_HISS = ['LLKMMKLL', 'LKMMMMKL', '..KKKK..'];     // wide open, no smile, at (8, 11)
  const MOUTH_FLAT = ['LLLKKLLL', 'LLKKKKLL'];                 // unimpressed, at (8, 11)

  const PAW_UP = ['.KKK.', 'KLLLK', 'KLLLK', 'KGGGK', 'KGDGK', 'KGGGK', 'KGGGK'];
  const PAW_SIDE = ['.KKKKKK.', 'KGGGGLLK', 'KGDGGLLK', '.KKKKKK.'];
  const PAW_SIDE_L = flip(PAW_SIDE);
  const PAW_TOP = ['.KKK.', 'KLLLK', 'KGGGK'];
  // When a front paw is raised, its spot at the bottom becomes plain fur (no third paw).
  const NO_PAW_R = ['KGGGG'];        // at (11, 23)
  const NO_PAW_L = ['GGGGK'];        // at (8, 23)
  const LIFTED_PAW = ['KLLLK', '.KKK.'];   // kneading: toes one row up, at (7 or 12, 22)

  const PARTICLES = {
    heart: ['.R.R.', 'RPRRR', 'RRRRR', '.RRR.', '..R..'],
    spark: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'],
    sparkS: ['.Y.', 'YWY', '.Y.'],
    z: ['WWWW', '..W.', '.W..', 'WWWW'],
    bang: ['YY', 'YY', 'YY', '..', 'YY'],
    anger: ['RR.RR', 'R...R', '.....', 'R...R', 'RR.RR'],
    crumb: ['C'],
    leaf: ['VV', '.V'],
  };
  const FLY = [['OY.YO', 'YYKYY', '.O.O.'], ['.....', 'OYKYO', '.Y.Y.']];
  const BIRD = [['K...K', '.K.K.', '..K..'], ['.....', 'KK.KK', '..K..']];

  // ------------------------------------------------------------------ drawing helpers

  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  function ellipse(c, cx, cy, rx, ry, col) {
    c.fillStyle = col;
    for (let dy = -ry; dy <= ry; dy++) {
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry || 1))));
      c.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }

  function line(c, x0, y0, x1, y1, col) {
    c.fillStyle = col;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Draw an ASCII sprite, merging same-colour runs into single rects.
  function blit(rows, x, y, map, alpha) {
    if (alpha != null) g.globalAlpha = Math.max(0, Math.min(1, alpha));
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      let i = 0;
      while (i < row.length) {
        const ch = row[i];
        if (ch === '.') { i++; continue; }
        let k = i + 1;
        while (k < row.length && row[k] === ch) k++;
        g.fillStyle = (map && map[ch]) || PAL[ch];
        g.fillRect(x + i, y + j, k - i, 1);
        i = k;
      }
    }
    if (alpha != null) g.globalAlpha = 1;
  }

  function silhouette(rows, x, y, col) {
    g.fillStyle = col;
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== '.') g.fillRect(x + i, y + j, 1, 1);
    }
  }

  // ------------------------------------------------------------------ the room (cached, redrawn each minute)

  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  const b = bg.getContext('2d');
  let bgKey = '';

  function skyFor(h) {
    if (h >= 7 && h < 17) return { kind: 'day', bands: ['#79c1f0', '#9bd3f5', '#c4e7fa'], city: '#8fa9c8', lit: null };
    if (h >= 17 && h < 20) return { kind: 'dusk', bands: ['#4f4486', '#c0628a', '#f4a56c'], city: '#3b3360', lit: '#ffd57a' };
    if (h >= 5 && h < 7) return { kind: 'dawn', bands: ['#6278bb', '#e09fb1', '#fad1a0'], city: '#59577f', lit: '#ffd57a' };
    return { kind: 'night', bands: ['#10152f', '#161d45', '#1f2955'], city: '#0c0b1d', lit: '#ffd57a' };
  }

  function drawBowl(c) {
    ellipse(c, 118, 83, 7, 1, 'rgba(0,0,0,.3)');
    rect(c, 112, 78, 13, 1, '#2a2339');
    rect(c, 112, 79, 13, 1, '#6fb0dd');
    rect(c, 113, 80, 11, 2, '#4b8fbf');
    rect(c, 114, 82, 9, 1, '#3a7099');
    for (const kx of [114, 116, 118, 120, 122]) rect(c, kx, 77 + (kx % 4 ? 0 : -1) + 1, 1, 1, '#a0683d');
  }

  function drawRoom(date) {
    const h = date.getHours(), m = date.getMinutes();
    const key = `${h}:${m}`;
    if (key === bgKey) return;
    bgKey = key;
    const c = b;

    // wall + wallpaper
    rect(c, 0, 0, W, 61, '#3b3252');
    for (let x = 2; x < W; x += 8) rect(c, x, 0, 1, 60, '#42395b');
    for (let y = 4; y < 58; y += 8) for (let x = 6; x < W; x += 8) rect(c, x, y + ((x >> 3) % 2 ? 4 : 0), 1, 1, '#4c4268');
    // baseboard
    rect(c, 0, 59, W, 1, '#51476b');
    rect(c, 0, 60, W, 4, '#2a2339');
    // floor planks
    rect(c, 0, 64, W, 26, '#6f4c37');
    rect(c, 0, 64, W, 1, '#83593f');
    for (const y of [69, 75, 82]) rect(c, 0, y, W, 1, '#5c3e2c');
    for (const [y, hgt, off] of [[65, 4, 7], [70, 5, 22], [76, 6, 13], [83, 7, 28]]) {
      for (let x = off; x < W; x += 31) rect(c, x, y, 1, hgt, '#5c3e2c');
    }

    // window
    const wx = 14, wy = 9, ww = 34, wh = 30;
    const sky = skyFor(h);
    rect(c, wx - 7, wy - 5, 4, wh + 10, '#a34f66');   // curtains
    rect(c, wx + ww + 3, wy - 5, 4, wh + 10, '#a34f66');
    for (let y = wy - 5; y < wy + wh + 5; y += 3) { rect(c, wx - 6, y, 1, 2, '#8b3f55'); rect(c, wx + ww + 5, y, 1, 2, '#8b3f55'); }
    rect(c, wx - 9, wy - 6, ww + 18, 1, '#2a2339');    // curtain rod
    rect(c, wx - 2, wy - 2, ww + 4, wh + 4, '#2a2339');
    rect(c, wx - 1, wy - 1, ww + 2, wh + 2, '#cdb991');
    for (let y = 0; y < wh; y++) {
      const band = Math.min(2, Math.floor(y / (wh / 3)));
      rect(c, wx, wy + y, ww, 1, sky.bands[band]);
    }
    if (sky.kind === 'night') {
      for (const [sx, sy] of [[3, 3], [11, 7], [21, 3], [29, 11], [6, 15], [26, 17], [16, 12], [31, 4]]) rect(c, wx + sx, wy + sy, 1, 1, '#fff4c4');
      ellipse(c, wx + 25, wy + 7, 3, 3, '#f4efc9');
      ellipse(c, wx + 27, wy + 6, 3, 3, sky.bands[0]);
    } else if (sky.kind === 'day') {
      ellipse(c, wx + 8, wy + 7, 4, 1, '#ffffff'); ellipse(c, wx + 11, wy + 6, 3, 1, '#ffffff');
      ellipse(c, wx + 25, wy + 12, 4, 1, '#f2f8ff');
      ellipse(c, wx + 27, wy + 5, 2, 2, '#fff1a8');
    } else {
      ellipse(c, wx + 22, wy + wh - 6, 4, 4, '#ffd27a');
    }
    // skyline at the bottom of the window
    const heights = [5, 5, 9, 9, 9, 4, 4, 7, 7, 7, 7, 11, 11, 11, 3, 3, 6, 6, 6, 8, 8, 8, 8, 5, 5, 10, 10, 10, 4, 4, 7, 7, 7, 7];
    for (let i = 0; i < ww; i++) rect(c, wx + i, wy + wh - heights[i], 1, heights[i], sky.city);
    if (sky.lit) for (const [lx, ly] of [[3, 7], [9, 5], [12, 9], [19, 6], [26, 8], [31, 5]]) rect(c, wx + lx, wy + wh - ly, 1, 1, sky.lit);
    rect(c, wx + (ww >> 1), wy, 1, wh, '#cdb991');     // mullions
    rect(c, wx, wy + (wh >> 1), ww, 1, '#cdb991');
    rect(c, wx - 4, wy + wh + 1, ww + 8, 2, '#d9c59c'); // sill
    rect(c, wx - 4, wy + wh + 3, ww + 8, 1, '#2a2339');

    // clock (shows the real time)
    const ccx = 124, ccy = 14;
    ellipse(c, ccx, ccy, 7, 7, '#2a2339');
    ellipse(c, ccx, ccy, 6, 6, '#f1e8d4');
    for (const [tx, ty] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) rect(c, ccx + tx, ccy + ty, 1, 1, '#9b8f77');
    const ha = (((h % 12) + m / 60) / 12) * Math.PI * 2, ma = (m / 60) * Math.PI * 2;
    line(c, ccx, ccy, ccx + Math.round(Math.sin(ha) * 3), ccy - Math.round(Math.cos(ha) * 3), '#2a2339');
    line(c, ccx, ccy, ccx + Math.round(Math.sin(ma) * 5), ccy - Math.round(Math.cos(ma) * 5), '#b8434f');
    rect(c, ccx, ccy, 1, 1, '#2a2339');

    // shelf with books and a trailing plant
    const sx = 102, sy = 34;
    for (const [bx, bh, col] of [[3, 9, '#e07a5f'], [6, 11, '#3d8bbf'], [9, 8, '#f2cc8f'], [12, 10, '#81b29a'], [15, 7, '#b56576']]) {
      rect(c, sx + bx, sy - bh, 3, bh, col);
      rect(c, sx + bx, sy - bh, 3, 1, '#2a2339');
      rect(c, sx + bx + 1, sy - bh + 2, 1, 2, 'rgba(255,255,255,.35)');
    }
    rect(c, sx + 27, sy - 5, 7, 5, '#c96f4a');
    rect(c, sx + 26, sy - 6, 9, 1, '#a85a3a');
    for (const [lx, ly] of [[28, -8], [30, -10], [32, -8], [29, -11], [31, -12], [33, -10]]) rect(c, sx + lx, sy + ly, 2, 2, '#5fae6b');
    for (let i = 0; i < 9; i++) rect(c, sx + 34 + (i % 2), sy + 1 + i, 2, 1, i % 3 ? '#4f9a5c' : '#6cc07a');
    rect(c, sx, sy, 42, 2, '#8a5e3c');
    rect(c, sx, sy + 2, 42, 1, '#2a2339');
    rect(c, sx + 4, sy + 3, 2, 3, '#6d4a2f');
    rect(c, sx + 35, sy + 3, 2, 3, '#6d4a2f');

    // floor plant
    for (const [lx, ly, rx, ry, col] of [[140, 64, 5, 2, '#4f9a5c'], [150, 62, 5, 2, '#5fae6b'], [145, 57, 3, 4, '#3f8a50'], [138, 59, 3, 2, '#5fae6b'], [152, 68, 3, 2, '#3f8a50']]) {
      ellipse(c, lx, ly, rx, ry, col);
    }
    line(c, 145, 72, 141, 64, '#3f8a50');
    line(c, 146, 72, 150, 62, '#3f8a50');
    line(c, 145, 72, 145, 58, '#3f8a50');
    rect(c, 139, 72, 13, 2, '#a85a3a');
    rect(c, 140, 74, 11, 9, '#c96f4a');
    rect(c, 140, 74, 11, 1, '#2a2339');
    rect(c, 141, 76, 1, 5, '#db8a63');

    // rug
    ellipse(c, 80, 82, 34, 6, '#2a2339');
    ellipse(c, 80, 82, 33, 5, '#7d3f55');
    ellipse(c, 80, 82, 28, 3, '#94516a');
    ellipse(c, 80, 82, 22, 2, '#7d3f55');

    drawBowl(c);
  }

  // ------------------------------------------------------------------ the cat

  const cat = { x: HOME, face: 1, walking: false, stride: 0 };

  function drawTail(p0, p1, p2, w, stripe) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18, a = (1 - u) * (1 - u), bb = 2 * (1 - u) * u, cc = u * u;
      pts.push([Math.round(a * p0[0] + bb * p1[0] + cc * p2[0]), Math.round(a * p0[1] + bb * p1[1] + cc * p2[1])]);
    }
    g.fillStyle = PAL.K;
    for (const [x, y] of pts) g.fillRect(x - 1, y - 1, w + 2, w + 2);
    pts.forEach(([x, y], i) => {
      g.fillStyle = i >= pts.length - 3 || (stripe && i % 6 === 4) ? PAL.D : PAL.G;
      g.fillRect(x, y, w, w);
    });
  }

  function tailSway(tail, now) {
    return Math.round(Math.sin((now / 1000) * Math.PI * 2 * (tail.speed || 0.3)) * (tail.amp || 2));
  }

  function drawWhiskers(x0, y0) {
    g.globalAlpha = 0.85;
    rect(g, x0 - 2, y0 + 10, 3, 1, '#ebe9f1');
    rect(g, x0 - 1, y0 + 12, 3, 1, '#ebe9f1');
    rect(g, x0 + 23, y0 + 10, 3, 1, '#ebe9f1');
    rect(g, x0 + 22, y0 + 12, 3, 1, '#ebe9f1');
    g.globalAlpha = 1;
  }

  function drawEyes(x0, y, kind, look) {
    for (const ex of [x0 + 5, x0 + 15]) {
      switch (kind) {
        case 'closed': // content "u" shape
          rect(g, ex, y + 1, 1, 1, PAL.K); rect(g, ex + 1, y + 2, 2, 1, PAL.K); rect(g, ex + 3, y + 1, 1, 1, PAL.K);
          break;
        case 'blink':
          rect(g, ex, y + 1, 4, 1, PAL.K);
          break;
        case 'happy': // "^" shape
          rect(g, ex, y + 1, 1, 1, PAL.K); rect(g, ex + 1, y, 2, 1, PAL.K); rect(g, ex + 3, y + 1, 1, 1, PAL.K);
          break;
        case 'wide':
          rect(g, ex, y - 1, 4, 4, PAL.E); rect(g, ex + 1, y + 1, 2, 1, PAL.K); rect(g, ex + 2, y, 1, 1, PAL.W);
          break;
        case 'half':
          rect(g, ex, y, 4, 1, PAL.D); rect(g, ex, y + 1, 4, 1, PAL.K); rect(g, ex, y + 2, 4, 1, PAL.E); rect(g, ex + 1, y + 2, 2, 1, PAL.K);
          break;
        case 'dizzy': // little "x" eyes
          rect(g, ex, y, 1, 1, PAL.K); rect(g, ex + 3, y, 1, 1, PAL.K); rect(g, ex + 1, y + 1, 2, 1, PAL.K);
          rect(g, ex, y + 2, 1, 1, PAL.K); rect(g, ex + 3, y + 2, 1, 1, PAL.K);
          break;
        default: { // open, pupils follow `look`
          rect(g, ex, y, 4, 3, PAL.E);
          const px = ex + 1 + (look ? look.dx : 0), py = y + (look && look.dy < 0 ? 0 : 1);
          rect(g, px, py, 2, 2, PAL.K);
          rect(g, px + 1, py, 1, 1, PAL.W);
        }
      }
    }
  }

  function drawPuff(body, x0, y0, now) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]]) silhouette(body, x0 + dx, y0 + dy, PAL.K);
    const j = Math.floor(now / 100) % 2;
    g.fillStyle = PAL.K;
    for (let r = 15; r <= 23; r += 2) {
      const k = (r + j) % 4 === 0 ? 1 : 0;
      g.fillRect(x0 - k, y0 + r, 1, 1);
      g.fillRect(x0 + 23 + k, y0 + r, 1, 1);
    }
  }

  function drawLaptop(x0, y0, now) {
    g.globalAlpha = 0.16;
    rect(g, x0 + 3, y0 + 7, 18, 7, '#9fd8ff');   // screen glow on her face
    g.globalAlpha = 1;
    const lx = x0, ly = y0 + 15, lw = 24, lh = 10;
    rect(g, lx, ly, lw, lh, PAL.K);
    rect(g, lx + 1, ly + 1, lw - 2, lh - 2, '#c5c9d4');
    rect(g, lx + 1, ly + 1, lw - 2, 1, '#e4e7ee');
    // little paw-print logo on the lid
    rect(g, lx + 11, ly + 5, 3, 2, '#9aa0ad');
    for (const [px, py] of [[10, 3], [12, 2], [14, 3]]) rect(g, lx + px, ly + py, 1, 1, '#9aa0ad');
    rect(g, lx - 2, ly + lh, lw + 4, 2, '#3a3c48');
    const ph = Math.floor(now / 130) % 2;
    blit(PAW_TOP, lx + 5, ly - 2 - (ph ? 1 : 0));
    blit(PAW_TOP, lx + 14, ly - 2 - (ph ? 0 : 1));
  }

  function drawShadow(rx) {
    g.globalAlpha = 0.28;
    ellipse(g, Math.round(cat.x), FLOOR, rx, 1, '#000');
    g.globalAlpha = 1;
  }

  // Sitting, facing you.
  function drawSit(p, now) {
    const x0 = Math.round(cat.x) - 12 + (p.shake || 0), y0 = CY - Math.round(p.hop || 0);
    const sway = tailSway(p.tail, now);
    drawTail([x0 + 19, y0 + 21], [x0 + 30, y0 + 23], [x0 + 26 + sway, y0 + 8], p.tail.puff ? 4 : 2, true);

    const body = p.ears === 'flat' ? CAT_FLAT : CAT;
    if (p.puffed) drawPuff(body, x0, y0, now);
    blit(body, x0, y0);
    if (p.paw === 'groom' || p.paw === 'chin' || p.paw === 'swatR') blit(NO_PAW_R, x0 + 11, y0 + 23);
    if (p.paw === 'swatL') blit(NO_PAW_L, x0 + 8, y0 + 23);
    if (p.knead) {
      const px = p.knead === 'L' ? 7 : 12;
      g.drawImage(bg, x0 + px + 1, y0 + 24, 3, 1, x0 + px + 1, y0 + 24, 3, 1);   // floor shows under the lifted paw
      blit(LIFTED_PAW, x0 + px, y0 + 22);
    }
    if (p.ears === 'perk') {
      rect(g, x0 + 5, y0 - 1, 1, 1, PAL.K); rect(g, x0 + 5, y0, 1, 1, PAL.G);
      rect(g, x0 + 18, y0 - 1, 1, 1, PAL.K); rect(g, x0 + 18, y0, 1, 1, PAL.G);
    }
    drawWhiskers(x0, y0);
    drawEyes(x0, y0 + 7, p.eyes, p.look);
    if (p.mouth === 'open') blit(MOUTH_OPEN, x0 + 10, y0 + 11);
    if (p.mouth === 'hiss') blit(MOUTH_HISS, x0 + 8, y0 + 11);
    if (p.mouth === 'flat') blit(MOUTH_FLAT, x0 + 8, y0 + 11);
    if (p.mouth === 'tongue') rect(g, x0 + 11, y0 + 13, 2, 1, PAL.P);
    if (p.laptop) drawLaptop(x0, y0, now);
    if (p.paw === 'groom') blit(PAW_UP, x0 + 13, y0 + 11);
    if (p.paw === 'chin') blit(PAW_UP, x0 + 14, y0 + 13);
    if (p.paw === 'swatR') blit(PAW_SIDE, x0 + 20, y0 + 15);
    if (p.paw === 'swatL') blit(PAW_SIDE_L, x0 - 4, y0 + 15);
  }

  // Walking or standing, side view. phase = 0..1 through a stride, or null when standing still.
  function drawSide(p, now) {
    const face = p.face || 1;
    const sx = Math.round(cat.x) - 13;
    const bob = p.phase != null && (p.phase % 0.5) < 0.25 ? 1 : 0;
    const sy = FLOOR - 18 - (p.hop || 0) + (p.bob || 0) - bob;
    const mx = (c) => (face > 0 ? sx + c : sx + SIDE_W - 1 - c);
    const swing = p.phase == null ? 0 : Math.sin(p.phase * Math.PI * 2);

    const sway = tailSway({ amp: 2, speed: p.phase == null ? 0.5 : 1.2 }, now);
    drawTail([mx(2), sy + 8], [mx(-5), sy + 9], [mx(-5) + sway * face, sy - 3], 2, true);

    const leg = (col, dir, far) => {
      const xs = [];
      for (let y = far ? 12 : 13; y <= 17; y++) {
        const k = (y - 12) / 5;
        const lx = Math.round(col + dir * swing * 2 * k);
        const X = face > 0 ? sx + lx : sx + SIDE_W - 2 - lx;
        xs.push([X, y]);
        rect(g, X - 1, sy + y, 4, 1, PAL.K);
      }
      for (const [X, y] of xs) rect(g, X, sy + y, 2, 1, y === 17 ? PAL.L : far ? PAL.D : PAL.G);
      const [X] = xs[xs.length - 1];
      rect(g, X - 1, sy + 18, 4, 1, PAL.K);
    };
    leg(5, 1, true);     // far back leg
    leg(16, -1, true);   // far front leg
    blit(face > 0 ? SIDE : SIDE_L, sx, sy);
    leg(3, -1, false);   // near back leg
    leg(14, 1, false);   // near front leg
  }

  // Sitting with her back to you (looking out of the window).
  function drawBack(p, now) {
    const x0 = Math.round(cat.x) - 12, y0 = CY;
    blit(BACK, x0, y0);
    if (p.perk) {
      rect(g, x0 + 5, y0 - 1, 1, 1, PAL.K); rect(g, x0 + 5, y0, 1, 1, PAL.G);
      rect(g, x0 + 18, y0 - 1, 1, 1, PAL.K); rect(g, x0 + 18, y0, 1, 1, PAL.G);
    }
    const sway = tailSway(p.tail || { amp: 2, speed: 0.4 }, now);
    drawTail([x0 + 12, y0 + 22], [x0 + 22, y0 + 27], [x0 + 27 + sway, y0 + 13], 2, true);
  }

  // Head down in the food bowl.
  function drawEat(now) {
    const x0 = Math.round(cat.x) - 12, y0 = CY;
    const munch = Math.floor(now / 280) % 2;
    const sway = tailSway({ amp: 2, speed: 0.6 }, now);
    drawTail([x0 + 19, y0 + 21], [x0 + 30, y0 + 23], [x0 + 26 + sway, y0 + 8], 2, true);
    blit(CAT.slice(15), x0, y0 + 15);
    const hy = y0 + 4 + munch;
    blit(CAT.slice(0, 15), x0, hy);
    drawEyes(x0, hy + 7, 'closed');
    drawWhiskers(x0, hy);
    if (munch) blit(MOUTH_OPEN, x0 + 10, hy + 11);
    drawBowl(g);
  }

  function drawBoxBack() {
    rect(g, 62, 57, 36, 1, '#3d2712');           // back flap
    rect(g, 62, 58, 36, 6, '#b88651');
    rect(g, 62, 58, 1, 6, '#3d2712'); rect(g, 97, 58, 1, 6, '#3d2712');
    rect(g, 61, 64, 38, 7, '#5a3b20');           // dark inside
  }

  function drawBoxFront() {
    for (let i = 0; i < 6; i++) {                // side flaps flopped open
      rect(g, 53 + i, 64 + i, 7, 1, '#b88651');
      rect(g, 53 + i, 64 + i, 1, 1, '#3d2712');
      rect(g, 100 - i, 64 + i, 7, 1, '#b88651');
      rect(g, 106 - i, 64 + i, 1, 1, '#3d2712');
    }
    rect(g, 53, 63, 7, 1, '#3d2712'); rect(g, 100, 63, 7, 1, '#3d2712');
    rect(g, 59, 70, 42, 14, '#3d2712');
    rect(g, 60, 71, 40, 12, '#c99a5f');
    rect(g, 60, 71, 40, 1, '#dcb27a');
    rect(g, 60, 80, 40, 3, '#b5854c');
    rect(g, 78, 71, 4, 12, '#e6cf9c');           // tape
    rect(g, 65, 75, 7, 2, '#5a3b20');            // handle holes
    rect(g, 88, 75, 7, 2, '#5a3b20');
  }

  // Curled up asleep, on the rug or in her box.
  function drawLoaf(now, inBox) {
    const t = now / 1000;
    const breath = Math.sin((t * Math.PI * 2) / 3.6) > 0 ? 1 : 0;
    const head = CAT.slice(0, 15);
    if (inBox) {
      drawBoxBack();
      blit(head, CX, 58 + breath);
      drawEyes(CX, 58 + breath + 7, 'closed');
      drawWhiskers(CX, 58 + breath);
      drawBoxFront();
      blit(PAW_TOP, 72, 68);
      blit(PAW_TOP, 83, 68);
      return;
    }
    g.globalAlpha = 0.28; ellipse(g, 80, 83, 17, 1, '#000'); g.globalAlpha = 1;
    ellipse(g, 80, 77 - breath, 16, 6 + breath, PAL.K);
    ellipse(g, 80, 77 - breath, 15, 5 + breath, PAL.G);
    for (const x of [67, 70, 90, 93]) rect(g, x, 73 - 2 * breath, 1, 3, PAL.D);
    const sway = Math.round(Math.sin(t * 0.8) * 1.5);
    drawTail([93, 79], [96, 85], [70 + sway, 83], 2, false);
    const hy = 64 - breath;
    blit(head, CX, hy);
    drawEyes(CX, hy + 7, 'closed');
    drawWhiskers(CX, hy);
    blit(PAW_TOP, 73, 78);
    blit(PAW_TOP, 82, 78);
  }

  // ------------------------------------------------------------------ particles

  const parts = [];

  function spawn(kind, x, y, o = {}) {
    parts.push({ kind, x, y, vx: o.vx ?? 0, vy: o.vy ?? -0.01, wob: o.wob ?? 0, born: performance.now(), life: o.life ?? 1500, map: o.map });
    if (parts.length > 60) parts.shift();
  }

  function drawParticles(now) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const age = now - p.born;
      if (age > p.life) { parts.splice(i, 1); continue; }
      const x = Math.round(p.x + p.vx * age + Math.sin(age / 280) * p.wob);
      const y = Math.round(p.y + p.vy * age);
      const fade = age > p.life * 0.65 ? 1 - (age - p.life * 0.65) / (p.life * 0.35) : 1;
      let spr = PARTICLES[p.kind];
      if (p.kind === 'spark' && Math.floor(age / 150) % 2) spr = PARTICLES.sparkS;
      blit(spr, x, y, p.map, fade);
    }
  }

  // ------------------------------------------------------------------ sound (synthesised, no files)

  function envGain(c, t, peak, attack, dur) {
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(peak, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    gn.connect(c.destination);
    return gn;
  }

  function noise(c, dur) {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    return src;
  }

  const SOUNDS = {
    meow(c, t) {
      const o = c.createOscillator(); o.type = 'square';
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
      const gn = envGain(c, t, 0.06, 0.04, 0.55);
      o.frequency.setValueAtTime(480, t); o.frequency.linearRampToValueAtTime(780, t + 0.14); o.frequency.linearRampToValueAtTime(420, t + 0.5);
      f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2600, t + 0.15); f.frequency.linearRampToValueAtTime(700, t + 0.5);
      o.connect(f).connect(gn); o.start(t); o.stop(t + 0.56);
    },
    mrrp(c, t) {
      const o = c.createOscillator(); o.type = 'square';
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const gn = envGain(c, t, 0.045, 0.02, 0.22);
      o.frequency.setValueAtTime(360, t); o.frequency.linearRampToValueAtTime(560, t + 0.18);
      o.connect(f).connect(gn); o.start(t); o.stop(t + 0.23);
    },
    purr(c, t) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 46;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      const trem = c.createGain(); trem.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 23;
      const depth = c.createGain(); depth.gain.value = 0.5;
      lfo.connect(depth).connect(trem.gain);
      const gn = envGain(c, t, 0.16, 0.18, 1.5);
      o.connect(f).connect(trem).connect(gn);
      o.start(t); lfo.start(t); o.stop(t + 1.55); lfo.stop(t + 1.55);
    },
    hiss(c, t) {
      const src = noise(c, 0.6);
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2800;
      const gn = envGain(c, t, 0.05, 0.03, 0.6);
      src.connect(f).connect(gn); src.start(t);
    },
    chirp(c, t) {
      [[880, 0], [1320, 0.09]].forEach(([hz, dt]) => {
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = hz;
        const gn = envGain(c, t + dt, 0.035, 0.01, 0.08);
        o.connect(gn); o.start(t + dt); o.stop(t + dt + 0.09);
      });
    },
  };

  const Sound = {
    ctx: null,
    on: !!store.get('nora.sound', false),
    lastAt: 0,
    unlock() {
      if (!this.on) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch { /* no audio */ }
    },
    play(name) {
      if (!this.on) return;
      this.unlock();
      const c = this.ctx;
      if (!c || c.state !== 'running') return;
      const now = performance.now();
      if (now - this.lastAt < 450) return;
      this.lastAt = now;
      try { SOUNDS[name](c, c.currentTime + 0.01); } catch { /* ignore */ }
    },
  };

  function renderSoundBtn() {
    ui.sound.setAttribute('aria-pressed', String(Sound.on));
    ui.sound.querySelector('.btn-icon').textContent = Sound.on ? '🔊' : '🔇';
    ui.sound.querySelector('.btn-text').textContent = Sound.on ? 'Sound on' : 'Sound off';
  }

  ui.sound.addEventListener('click', () => {
    Sound.on = !Sound.on;
    store.set('nora.sound', Sound.on);
    renderSoundBtn();
    if (Sound.on) { Sound.unlock(); setTimeout(() => Sound.play('mrrp'), 60); }
  });

  // ------------------------------------------------------------------ agent state (from the server)

  let snap = { state: 'offline', since: Date.now(), text: '', tool: '', online: false, lastSignal: 0, activeRuns: 0, today: null, serverTime: Date.now() };
  let clockSkew = 0;
  let connected = false;
  const serverNow = () => Date.now() + clockSkew;

  function applyState(s) {
    snap = { ...snap, ...s };
    if (s.serverTime) clockSkew = s.serverTime - Date.now();
    updateStatus();
  }

  function setConnected(v) {
    if (connected === v) return;
    connected = v;
    updateStatus();
  }

  // ------------------------------------------------------------------ idle life: what Nora does on her own

  // Each activity is a short list of steps. 'walk' steps move her; the rest last `ms`.
  const ACTIVITIES = {
    groom: () => [{ kind: 'groom', ms: 2600 }],
    yawn: () => [{ kind: 'yawn', ms: 1500 }],
    look: () => [{ kind: 'look', ms: 2400, dx: Math.random() < 0.5 ? -1 : 1 }],
    flick: () => [{ kind: 'flick', ms: 1500 }],
    knead: () => [{ kind: 'knead', ms: 4200 }],
    butterfly: () => [{ kind: 'butterfly', ms: 9500 }],
    spin: () => [{ kind: 'spin', ms: 1900 }, { kind: 'dizzy', ms: 1500 }],
    snack: () => [{ kind: 'walk', x: BOWL_X }, { kind: 'eat', ms: 5200 }, { kind: 'walk', x: HOME }],
    window: () => [{ kind: 'walk', x: WINDOW_X }, { kind: 'watch', ms: 12000 }, { kind: 'walk', x: HOME }],
    plant: () => [{ kind: 'walk', x: PLANT_X }, { kind: 'sniff', ms: 2400 }, { kind: 'sneeze', ms: 1200 }, { kind: 'walk', x: HOME }],
    wander: () => {
      let x;
      do { x = Math.round(rand(46, 108)); } while (Math.abs(x - HOME) < 14);
      return [{ kind: 'walk', x }, { kind: 'sit', ms: rand(5000, 9000) }, { kind: 'walk', x: HOME }];
    },
    nap: () => [{ kind: 'walk', x: HOME }, { kind: 'nap', ms: isNight() ? rand(150_000, 300_000) : rand(60_000, 150_000) }, { kind: 'yawn', ms: 1500 }],
    home: () => [{ kind: 'walk', x: HOME }],
  };

  const life = { activity: 'rest', last: '', queue: [], step: null, idleSince: 0, forced: false };

  function setStep(s, now) {
    life.step = s;
    s.start = now;
    s.until = s.ms ? now + s.ms : 0;
    if (s.kind === 'butterfly') { s.night = isNight(); s.nextSwat = now + 1500; }
    if (s.kind === 'watch') s.night = isNight();
    if (s.kind === 'sneeze') {
      setLocalBubble('speech', '<div class="txt">Achoo! 🌿</div>', 1300);
      spawn('leaf', 146, 60, { vx: -0.004, vy: 0.009, wob: 2, life: 2000 });
    }
  }

  function rest(now, ms = rand(4000, 9000)) {
    if (life.activity !== 'rest') life.last = life.activity;
    life.activity = 'rest';
    life.queue = [];
    setStep({ kind: 'sit', ms }, now);
  }

  function startActivity(name, now) {
    life.activity = name;
    life.queue = ACTIVITIES[name]();
    advance(now);
  }

  function advance(now) {
    const s = life.queue.shift();
    if (s) setStep(s, now);
    else rest(now);
  }

  function pickActivity(now) {
    if (Math.abs(cat.x - HOME) > 1) return 'home';
    const night = isNight();
    const idleFor = now - life.idleSince;
    const weights = {
      groom: 3, yawn: 1.5, look: 2, flick: 1, knead: 2, spin: 1,
      butterfly: night ? 1 : 2.2, snack: 1.6, window: 2.4, plant: 1.1, wander: 2.2,
      nap: idleFor > 3 * 60_000 ? (night ? 4 : 1.2) : 0,
    };
    delete weights[life.last];
    let total = 0;
    for (const v of Object.values(weights)) total += v;
    let r = Math.random() * total;
    for (const [k, v] of Object.entries(weights)) { if ((r -= v) < 0) return k; }
    return 'groom';
  }

  function moveToward(target, speed, dt, strideRate) {
    const d = target - cat.x;
    if (Math.abs(d) < 0.5) { cat.x = target; cat.walking = false; return true; }
    cat.face = Math.sign(d);
    cat.walking = true;
    cat.stride += dt * strideRate;
    cat.x += Math.sign(d) * Math.min(Math.abs(d), (speed * dt) / 1000);
    return false;
  }

  function updateLife(now, dt) {
    if (!life.step) rest(now, rand(2500, 4500));
    const s = life.step;
    if (s.kind === 'walk') {
      if (moveToward(s.x, WALK_SPEED, dt, 1)) advance(now);
      return;
    }
    cat.walking = false;
    if (s.until && now >= s.until) {
      if (life.activity === 'rest') startActivity(pickActivity(now), now);
      else advance(now);
    }
  }

  function butterflyPos(s, now) {
    const t = (now - s.start) / 1000, T = s.ms / 1000;
    const orbit = [cat.x + 2 + Math.sin(t * 1.4) * 17, 50 + Math.sin(t * 2.3) * 6 + Math.cos(t * 0.8) * 3];
    if (t < 1.8) return lerp2([WINDOW_X, 24], orbit, ease(t / 1.8));
    if (t > T - 2) return lerp2(orbit, [-8, 4], ease(Math.min(1, (t - (T - 2)) / 2)));
    return orbit;
  }

  function drawButterfly(s, now) {
    const [bx, by] = butterflyPos(s, now);
    blit(FLY[Math.floor(now / 110) % 2], Math.round(bx) - 2, Math.round(by) - 1, s.night ? { O: '#cfc7b4', Y: '#ebe5d6' } : null);
  }

  function drawWindowVisitor(s, now) {
    const t = (now - s.start) / 1000;
    g.save();
    g.beginPath();
    g.rect(14, 9, 34, 30);
    g.clip();
    if (!s.night && t > 3 && t < 7) {
      const u = (t - 3) / 4;
      blit(BIRD[Math.floor(now / 160) % 2], Math.round(9 + u * 42), Math.round(17 + Math.sin(u * 9) * 2));
    }
    if (s.night && t > 4 && t < 5.4) {        // shooting star
      const u = (t - 4) / 1.4;
      const sx = Math.round(44 - u * 28), sy = Math.round(11 + u * 12);
      for (let i = 0; i < 5; i++) { g.globalAlpha = 1 - i * 0.2; rect(g, sx + i * 2, sy - i, 1, 1, '#fff6c8'); }
      g.globalAlpha = 1;
    }
    g.restore();
    if (t > (s.night ? 4 : 3) && !s.noticed) {
      s.noticed = true;
      spawn('bang', Math.round(cat.x) - 1, CY - 9, { vy: 0, life: 900 });
    }
  }

  // ------------------------------------------------------------------ poses

  let vState = null;
  let enteredAt = 0;
  let react = null;             // { kind: 'pet' | 'annoyed' | 'swat', until, dir }
  let localBubble = null;       // { cls, html, until }
  let clicks = [];
  let pets = Number(store.get('nora.pets', 0)) || 0;
  let lastZ = 0, lastSpark = 0, lastCrumb = 0;
  const mouse = { x: 80, y: 60, at: -1e9 };
  const blink = { at: 0, until: 0 };

  function visualState() {
    if (!connected) return 'offline';
    return snap.state || 'idle';
  }

  function onEnter(vs, prev, now) {
    if (vs === 'idle') {
      life.idleSince = now;
      life.last = '';
      if (FORCE_ACT && !life.forced && ACTIVITIES[FORCE_ACT]) { life.forced = true; startActivity(FORCE_ACT, now); }
      else rest(now, rand(3000, 5000));
    } else {
      life.step = null;
      life.queue = [];
      life.activity = 'rest';
    }
    if (prev === null) return;   // first paint: no fanfare
    if (vs === 'listening') { spawn('bang', CX + 11, CY - 9, { vy: 0, life: 1100 }); Sound.play('chirp'); }
    if (vs === 'done') {
      for (let i = 0; i < 6; i++) spawn('spark', CX - 6 + Math.random() * 34, CY - 6 + Math.random() * 22, { vy: -0.004, life: 900 + Math.random() * 400 });
      Sound.play('meow');
    }
    if (vs === 'error') { spawn('bang', CX + 11, CY - 10, { vy: 0, life: 1400, map: { Y: PAL.R } }); Sound.play('hiss'); }
  }

  function mouseLook(now) {
    if (now - mouse.at > 3000) return null;
    return { dx: mouse.x < cat.x - 8 ? -1 : mouse.x > cat.x + 8 ? 1 : 0, dy: mouse.y < CY + 2 ? -1 : 0 };
  }

  function frontPose(now) {
    return {
      kind: 'sit', eyes: 'open', look: mouseLook(now) || { dx: 0, dy: 0 }, ears: null, mouth: null,
      paw: null, knead: null, laptop: false, hop: 0, shake: 0, puffed: false, tail: { amp: 2, speed: 0.3 },
    };
  }

  function butterflyPose(p, s, now) {
    const [bx, by] = butterflyPos(s, now);
    const t = now - s.start;
    p.look = { dx: bx < cat.x - 5 ? -1 : bx > cat.x + 5 ? 1 : 0, dy: by < CY + 3 ? -1 : 0 };
    p.tail = { amp: 3, speed: 1.5 };
    const pounce = t - s.ms * 0.55;
    if (pounce > 0 && pounce < 520) { p.hop = Math.sin((pounce / 520) * Math.PI) * 6; p.eyes = 'wide'; return; }
    if (now < (s.swatUntil || 0)) { p.paw = s.swatDir; p.ears = 'perk'; return; }
    const off = Math.abs(bx - cat.x);
    if (now > s.nextSwat && t > 1800 && t < s.ms - 2000 && by > CY - 4 && off > 6 && off < 22) {
      s.swatDir = bx < cat.x ? 'swatL' : 'swatR';
      s.swatUntil = now + 380;
      s.nextSwat = now + rand(900, 1600);
      p.paw = s.swatDir;
    }
  }

  function idlePose(now) {
    const s = life.step;
    const p = frontPose(now);
    if (!s) return p;
    const t = now - s.start;
    switch (s.kind) {
      case 'walk': return { kind: 'side', face: cat.face, phase: (cat.stride / 520) % 1 };
      case 'groom': p.paw = 'groom'; p.eyes = 'closed'; p.mouth = Math.floor(now / 220) % 2 ? 'tongue' : null; break;
      case 'yawn': p.eyes = 'closed'; p.mouth = 'open'; break;
      case 'look': if (now - mouse.at > 3000) p.look = { dx: s.dx, dy: 0 }; break;
      case 'flick': p.tail = { amp: 4, speed: 1.6 }; break;
      case 'knead': p.eyes = 'happy'; p.knead = Math.floor(t / 300) % 2 ? 'L' : 'R'; p.tail = { amp: 2.5, speed: 0.5 }; break;
      case 'butterfly': butterflyPose(p, s, now); break;
      case 'spin': {
        const f = Math.floor(t / 110) % 4;
        if (f === 1) return { kind: 'side', face: 1, phase: null };
        if (f === 2) return { kind: 'back', tail: { amp: 4, speed: 2 } };
        if (f === 3) return { kind: 'side', face: -1, phase: null };
        p.tail = { amp: 5, speed: 3 };
        break;
      }
      case 'dizzy': p.eyes = 'dizzy'; p.tail = { amp: 1, speed: 0.4 }; break;
      case 'eat': return { kind: 'eat' };
      case 'watch': {
        const bird = t > 3000 && t < 7000;
        return { kind: 'back', perk: bird, tail: bird ? { amp: 3, speed: 2.2 } : { amp: 2, speed: 0.4 } };
      }
      case 'sniff': return { kind: 'side', face: 1, phase: null, bob: Math.floor(t / 260) % 2 };
      case 'sneeze': return { kind: 'side', face: 1, phase: null, hop: t < 350 ? 2 : 0 };
      case 'nap': return { kind: 'loaf' };
      default: break; // 'sit': just sitting, blinking, watching your cursor
    }
    return p;
  }

  function busyPose(vs, now) {
    const age = now - enteredAt;
    const p = frontPose(now);
    switch (vs) {
      case 'listening':
        p.ears = 'perk'; p.eyes = age < 1000 ? 'wide' : 'open'; p.look = { dx: 0, dy: 0 }; p.tail = { amp: 3, speed: 1.1 };
        break;
      case 'thinking':
        p.look = { dx: 1, dy: -1 }; p.paw = Math.floor(age / 3500) % 2 ? 'chin' : null; p.tail = { amp: 2.5, speed: 0.7 };
        break;
      case 'working':
        p.laptop = true; p.look = { dx: 0, dy: 1 }; p.tail = { amp: 1.5, speed: 1.4 };
        break;
      case 'replying':
        p.mouth = age % 800 < 320 ? 'open' : null; p.look = { dx: 0, dy: 0 }; p.tail = { amp: 3, speed: 0.9 };
        break;
      case 'done':
        p.hop = age < 1100 ? Math.abs(Math.sin((age / 550) * Math.PI)) * 5 : 0; p.eyes = 'happy'; p.tail = { amp: 4, speed: 1.8 };
        break;
      case 'error':
        p.puffed = true; p.ears = 'flat'; p.eyes = 'wide'; p.mouth = age < 1300 ? 'hiss' : 'flat';
        p.shake = age < 1500 ? (Math.floor(age / 70) % 2 ? 1 : -1) : 0;
        p.tail = { amp: 1, speed: 3, puff: true };
        break;
    }
    return p;
  }

  function poseFor(vs, now) {
    if (vs === 'offline') return { kind: 'box' };
    if (vs !== 'idle' && cat.walking) return { kind: 'side', face: cat.face, phase: (cat.stride / 520) % 1 };
    const p = vs === 'idle' ? idlePose(now) : busyPose(vs, now);
    if (p.kind !== 'sit') return p;
    if (p.eyes === 'open' && now < blink.until) p.eyes = 'blink';
    if (react && now < react.until) {
      if (react.kind === 'pet') { p.eyes = 'happy'; p.ears = null; p.knead = null; p.tail = { amp: 3, speed: 0.6 }; }
      if (react.kind === 'annoyed') { p.ears = 'flat'; p.eyes = 'half'; p.mouth = 'flat'; p.tail = { amp: 4, speed: 2.6 }; }
      if (react.kind === 'swat') { p.paw = react.dir === 'L' ? 'swatL' : 'swatR'; p.ears = 'flat'; p.eyes = 'half'; p.mouth = 'flat'; }
    }
    return p;
  }

  function setLocalBubble(cls, html, ms) {
    localBubble = { cls, html, until: performance.now() + ms };
  }

  function poke(pt) {
    const now = performance.now();
    clicks = clicks.filter((t) => now - t < 2500);
    clicks.push(now);
    const vs = vState;

    if (vs === 'offline') {
      setLocalBubble('speech', '<div class="txt">Zzz… <span class="hint-text">(agent is offline)</span></div>', 1800);
      spawn('z', CX + 19, CY, { vx: 0.006, vy: -0.008, wob: 1, life: 2200 });
      return;
    }
    if (vs === 'idle' && life.step) {
      const k = life.step.kind;
      if (k === 'nap') {                       // wake her up gently
        life.activity = 'yawn'; life.queue = [];
        setStep({ kind: 'yawn', ms: 1500 }, now);
        return;
      }
      // Whatever she was doing, she stops and turns to face you.
      if (!['sit', 'groom', 'yawn', 'look', 'flick', 'knead', 'dizzy'].includes(k)) {
        cat.walking = false;
        rest(now, rand(3500, 6000));
      }
    }
    if (clicks.length >= 6) {
      clicks = [];
      react = { kind: 'annoyed', until: now + 2800 };
      setLocalBubble('speech alert', '<div class="txt">Hey! Enough. 😾</div>', 2000);
      spawn('anger', Math.round(cat.x) + 7, CY - 2, { vy: 0, life: 1500 });
      Sound.play('hiss');
      return;
    }
    if (react && react.kind === 'annoyed' && now < react.until) return;
    if (vs === 'working' || vs === 'thinking') {
      react = { kind: 'swat', dir: pt.x < cat.x ? 'L' : 'R', until: now + 650 };
      setLocalBubble('speech', '<div class="txt">busy!</div>', 1100);
      Sound.play('mrrp');
      return;
    }
    react = { kind: 'pet', until: now + 1700 };
    for (let i = 0; i < 3; i++) {
      setTimeout(() => spawn('heart', cat.x - 7 + Math.random() * 13, CY + 1, { vy: -0.014, vx: (Math.random() - 0.5) * 0.01, life: 1300 }), i * 180);
    }
    Sound.play('purr');
    pets++;
    store.set('nora.pets', pets);
    ui.pets.textContent = petsText();
  }

  // ------------------------------------------------------------------ bubble

  let bubbleKey = '';
  let scale = 4;
  let anchor = [CX + 20, CY - 1];

  function anchorFor(p) {
    const x = Math.round(cat.x);
    switch (p.kind) {
      case 'side': return [x + (p.face > 0 ? 4 : -4), FLOOR - 19];
      case 'eat': return [x + 8, CY + 3];
      case 'box': case 'loaf': return [CX + 20, CY + 3];
      default: return [x + 8, CY - 1];
    }
  }

  function bubbleContent(vs, now) {
    if (localBubble && now < localBubble.until) return localBubble;
    const t = snap.text || '', tool = snap.tool || '';
    switch (vs) {
      case 'listening': return { cls: 'speech', html: t ? `<div class="txt">📩 ${esc(t)}</div>` : '<div class="txt">📩 New message!</div>' };
      case 'thinking': return { cls: 'thought', html: '<span class="dots"><span>●</span> <span>●</span> <span>●</span></span>' };
      case 'working': return { cls: 'speech', html: `<div class="txt">🔧 <span class="tool">${esc(tool || 'tool')}</span>${t ? ` <span class="hint-text">${esc(t)}</span>` : ''}</div>` };
      case 'replying': return { cls: 'speech', html: `<div class="txt">💬 ${t ? esc(t) : 'Replying…'}</div>` };
      case 'done': return { cls: 'speech happy', html: '<div class="txt">Done! ✨</div>' };
      case 'error': return { cls: 'speech alert', html: `<div class="txt">⚠️ ${esc(t || 'Something went wrong')}</div>` };
      default: return null;
    }
  }

  function placeBubble() {
    if (bubbleEl.hidden) return;
    let x = canvas.offsetLeft + anchor[0] * scale;
    const y = canvas.offsetTop + anchor[1] * scale;
    const maxX = roomEl.clientWidth - bubbleEl.offsetWidth - 6;
    if (x > maxX) x = Math.max(6, maxX);
    bubbleEl.style.left = `${x}px`;
    bubbleEl.style.top = `${y}px`;
  }

  function updateBubble(vs, now, p) {
    const a = anchorFor(p);
    const moved = a[0] !== anchor[0] || a[1] !== anchor[1];
    anchor = a;
    const c = bubbleContent(vs, now);
    const key = c ? c.cls + c.html : '';
    if (key === bubbleKey) { if (moved) placeBubble(); return; }
    bubbleKey = key;
    if (!c) { bubbleEl.hidden = true; return; }
    bubbleEl.className = `bubble ${c.cls}`;
    bubbleEl.innerHTML = c.html;   // every dynamic piece above is escaped
    bubbleEl.hidden = false;
    bubbleEl.style.animation = 'none';
    void bubbleEl.offsetWidth;
    bubbleEl.style.animation = '';
    placeBubble();
  }

  // ------------------------------------------------------------------ main loop

  let lastTick = 0;

  function render(now) {
    const dt = lastTick ? Math.min(1000, now - lastTick) : 0;   // keeps pace even if frames are slow
    lastTick = now;
    drawRoom(new Date());
    g.drawImage(bg, 0, 0);

    const vs = visualState();
    if (vs !== vState) {
      const prev = vState;
      vState = vs;
      enteredAt = now;
      onEnter(vs, prev, now);
      updateStatus();
    }
    if (now > blink.at) {
      blink.until = now + 140;
      blink.at = now + 2500 + Math.random() * 3500;
    }

    if (vs === 'offline') { cat.x = HOME; cat.walking = false; }
    else if (vs === 'idle') updateLife(now, dt);
    else moveToward(HOME, RUN_SPEED, dt, 2.2);   // hurry back to the rug when there's work

    const step = vs === 'idle' ? life.step : null;
    if (step && step.kind === 'watch') drawWindowVisitor(step, now);

    const p = poseFor(vs, now);
    switch (p.kind) {
      case 'box': drawLoaf(now, true); break;
      case 'loaf': drawLoaf(now, false); break;
      case 'side': drawShadow(11); drawSide(p, now); break;
      case 'back': drawShadow(12); drawBack(p, now); break;
      case 'eat': drawShadow(12); drawEat(now); break;
      default: drawShadow(Math.max(8, 13 - Math.round(p.hop))); drawSit(p, now);
    }
    if (step && step.kind === 'butterfly') drawButterfly(step, now);

    if (vs === 'offline') {
      g.fillStyle = 'rgba(10, 8, 26, 0.5)';
      g.fillRect(0, 0, W, H);
    }
    if ((vs === 'offline' || p.kind === 'loaf') && now - lastZ > 1500) {
      lastZ = now;
      spawn('z', CX + 18, vs === 'offline' ? CY + 1 : CY + 6, { vx: 0.006, vy: -0.008, wob: 1, life: 2600 });
    }
    if (vs === 'done' && now - lastSpark > 320) {
      lastSpark = now;
      spawn('spark', CX - 6 + Math.random() * 36, CY - 8 + Math.random() * 20, { vy: -0.004, life: 900 });
    }
    if (step && step.kind === 'dizzy' && now - lastSpark > 260) {
      lastSpark = now;
      const a = now / 300;
      spawn('sparkS', Math.round(cat.x + Math.cos(a) * 11) - 1, CY - 4 + Math.round(Math.sin(a) * 2), { vy: 0, life: 300 });
    }
    if (p.kind === 'eat' && now - lastCrumb > 700) {
      lastCrumb = now;
      spawn('crumb', BOWL_X - 5 + Math.round(Math.random() * 10), 76, { vy: -0.006, vx: (Math.random() - 0.5) * 0.01, life: 450 });
    }
    drawParticles(now);
    updateBubble(vs, now, p);
  }

  let lastFrame = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastFrame < 1000 / FPS - 2) return;
    lastFrame = ts;
    render(ts);
  }

  function fit() {
    const avail = roomEl.clientWidth;
    if (EMBED) {
      // The iframe is 160:90, so a fractional scale fills it without distortion
      // and keeps bubble positions (which use `scale`) lined up.
      scale = avail / W;
      canvas.style.width = `${avail}px`;
      canvas.style.height = `${(avail * H) / W}px`;
      placeBubble();
      return;
    }
    scale = Math.max(1, Math.min(7, Math.floor(avail / W)));
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    placeBubble();
  }

  // ------------------------------------------------------------------ pointer

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  const onCat = (pt) => Math.abs(pt.x - cat.x) <= 16 && pt.y >= CY - 7 && pt.y <= FLOOR + 3;

  window.addEventListener('pointermove', (e) => {
    const pt = toLogical(e);
    mouse.x = pt.x; mouse.y = pt.y; mouse.at = performance.now();
    canvas.style.cursor = onCat(pt) ? 'pointer' : 'default';
  }, { passive: true });

  canvas.addEventListener('pointerdown', (e) => {
    Sound.unlock();
    const pt = toLogical(e);
    if (onCat(pt)) poke(pt);
  });

  // ------------------------------------------------------------------ status panel + log

  const COPY = {
    offline: ['Offline', 'Asleep in her box. The agent isn’t running.'],
    idle: ['Idle', 'Lounging on the rug, waiting for something to do.'],
    listening: ['New message', 'Ears up! A message just arrived.'],
    thinking: ['Thinking', 'Thinking it over…'],
    working: ['Working', 'Busy at the laptop.'],
    replying: ['Replying', 'Sending a reply.'],
    done: ['Done', 'All done! ✨'],
    error: ['Problem', 'Something went wrong.'],
  };

  function idleCaption() {
    const s = life.step;
    if (!s) return COPY.idle[1];
    const night = isNight();
    const away = Math.abs(cat.x - HOME) > 1;
    if (s.kind === 'walk') {
      if (s.x === HOME) return 'Strolling back to the rug.';
      return {
        snack: 'Trotting over to her food bowl.', window: 'Heading to the window.',
        plant: 'Off to inspect the plant.', wander: 'Wandering around the room.',
      }[life.activity] || 'Walking around.';
    }
    switch (s.kind) {
      case 'sit': return away ? 'Sitting somewhere new, just because.' : COPY.idle[1];
      case 'groom': return 'Grooming her paw.';
      case 'yawn': return 'Big yawn.';
      case 'look': return 'Looking around the room.';
      case 'flick': return 'Flicking her tail.';
      case 'knead': return 'Kneading the rug (making biscuits).';
      case 'butterfly': return s.night ? 'Chasing a moth!' : 'Chasing a butterfly!';
      case 'spin': return 'Chasing her own tail!';
      case 'dizzy': return 'A little dizzy…';
      case 'eat': return 'Having a snack. Nom nom.';
      case 'watch': return s.night ? 'Gazing at the stars.' : 'Watching birds out the window.';
      case 'sniff': return 'Sniffing the plant.';
      case 'sneeze': return 'Achoo!';
      case 'nap': return night ? 'Fast asleep. It’s late.' : 'Taking a cat nap.';
      default: return COPY.idle[1];
    }
  }

  function dur(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  const petsText = () => (pets === 1 ? '1 pet so far' : `${pets} pets so far`);

  function updateStatus() {
    const vs = vState || visualState();
    document.body.dataset.state = connected ? vs : 'offline';

    let [chip, text] = COPY[vs] || COPY.idle;
    if (!connected) { chip = 'No server'; text = 'Can’t reach Nora’s server on this Mac.'; }
    else if (vs === 'idle') text = idleCaption();
    else if (vs === 'working' && snap.tool) text = `Busy at the laptop, running ${snap.tool}.`;
    ui.chip.textContent = chip;
    ui.line.textContent = text;
    ui.forEl.textContent = connected ? `for ${dur(serverNow() - snap.since)}` : '';
    canvas.setAttribute('aria-label', `Nora the cat. ${text}`);

    ui.doing.textContent = '';
    if (connected && vs === 'working' && snap.tool) {
      const code = document.createElement('code');
      code.textContent = snap.tool;
      ui.doing.append(code);
      if (snap.text) ui.doing.append(` · ${snap.text}`);
    } else if (connected && vs === 'thinking') {
      ui.doing.textContent = 'Waiting on the model';
    } else if (connected && snap.text && ['listening', 'replying', 'error'].includes(vs)) {
      ui.doing.textContent = snap.text;
    } else {
      ui.doing.textContent = '—';
    }

    if (!connected) ui.agent.textContent = 'Unknown';
    else if (snap.online) ui.agent.textContent = `Online · last signal ${dur(serverNow() - snap.lastSignal)} ago`;
    else ui.agent.textContent = 'Offline';

    const td = snap.today;
    ui.today.textContent = td
      ? `${td.messages} messages · ${td.tools} tools · ${td.runs} runs${td.errors ? ` · ${td.errors} errors` : ''}`
      : '—';

    if (!connected && !DEMO) {
      ui.conn.hidden = false;
      ui.conn.textContent = location.protocol === 'file:'
        ? 'This page needs Nora’s server. Open http://localhost:7766 instead, or add ?demo to the address to preview.'
        : 'Can’t reach Nora’s server. Retrying… (Is the ai.nora.pet service running?)';
    } else {
      ui.conn.hidden = true;
    }
  }

  const ICON = { in: '📩', tool: '🔧', out: '💬', done: '✅', error: '⚠️', online: '🟢', offline: '💤', helper: '🐾', tidy: '🧹', note: '📝' };
  const seen = new Set();

  function logItem(e, fresh) {
    const li = document.createElement('li');
    li.className = `${e.kind}${fresh ? ' fresh' : ''}`;
    const time = document.createElement('time');
    const d = new Date(e.t);
    time.dateTime = d.toISOString();
    time.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.textContent = ICON[e.kind] || '•';
    const tx = document.createElement('span');
    tx.className = 'tx';
    tx.textContent = e.text;
    li.append(time, ic, tx);
    return li;
  }

  function setLog(entries) {
    ui.log.textContent = '';
    seen.clear();
    for (const e of entries.slice().reverse()) { seen.add(e.id); ui.log.append(logItem(e, false)); }
    ui.logEmpty.hidden = entries.length > 0;
  }

  function addLog(e) {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    ui.log.prepend(logItem(e, true));
    while (ui.log.children.length > 100) ui.log.lastElementChild.remove();
    ui.logEmpty.hidden = true;
  }

  // ------------------------------------------------------------------ live connection

  function connect() {
    if (location.protocol === 'file:') { updateStatus(); return; }
    const es = new EventSource('/api/stream');
    es.addEventListener('hello', (e) => {
      const d = JSON.parse(e.data);
      applyState(d.state);
      setLog(d.log || []);
      setConnected(true);
    });
    es.addEventListener('state', (e) => applyState(JSON.parse(e.data)));
    es.addEventListener('log', (e) => addLog(JSON.parse(e.data)));
    es.onerror = () => {
      setConnected(false);
      if (es.readyState === EventSource.CLOSED) { es.close(); setTimeout(connect, 5000); }
    };
  }

  // ------------------------------------------------------------------ demo mode (no server needed)

  function runDemo() {
    ui.foot.textContent = 'Demo mode: fake events, not connected to an agent'
    connected = true;
    let id = 0;
    const log = (kind, text) => addLog({ id: ++id, t: Date.now(), kind, text });
    const ask1 = 'You: remind me about the physics past paper at 7';
    const answer1 = 'Reminder set for 19:00 — physics past paper.';
    const ask2 = 'You: five questions on thermal physics, please';
    const answer2 = 'Five ready: specific heat, latent heat, gas laws, pressure, and a graph question.';
    const base = () => ({
      online: true,
      lastSignal: Date.now(),
      serverTime: Date.now(),
      today: { messages: 2, tools: 4, runs: 2, errors: 0 },
    });
    // [state, duration, tool, bubble text, log entry]
    const steps = [
      ['idle', 6000, '', '', ['online', 'Agent is online']],
      ['listening', 2600, '', ask1, ['in', ask1]],
      ['thinking', 2200],
      ['working', 3200, 'reminder', 'physics past paper · 19:00', ['tool', 'reminder · physics past paper · 19:00']],
      ['replying', 3000, '', answer1, ['out', `Replied: ${answer1}`]],
      ['done', 3800, '', '', ['done', 'Finished in 4s']],
      ['idle', 3500],
      ['listening', 2600, '', ask2, ['in', ask2]],
      ['thinking', 2200],
      ['working', 3000, 'question_bank', 'thermal physics · 5 questions', ['tool', 'question_bank · thermal physics · 5 questions']],
      ['working', 3600, 'question_maker', 'sub-agent · thermal physics', ['helper', 'Question-maker sub-agent started']],
      ['replying', 3400, '', answer2, ['out', `Replied: ${answer2}`]],
      ['done', 4200, '', '', ['done', 'Finished in 18s']],
      ['idle', 16000],
      ['offline', 6000, '', '', ['offline', 'Agent went offline']],
    ];
    setLog([]);
    if (PIN || FORCE_ACT) {
      const state = PIN && PIN !== 'nap' ? PIN : 'idle';
      const step = steps.find((s) => s[0] === state) || ['idle', 0];
      for (const s of steps.slice(0, 10)) if (s[4]) log(...s[4]);
      applyState({ ...base(), state, since: Date.now(), tool: step[2] || '', text: step[3] || '', online: state !== 'offline' });
      return;
    }
    let i = 0;
    const next = () => {
      const [state, ms, tool = '', text = '', entry] = steps[i++ % steps.length];
      applyState({ ...base(), state, since: Date.now(), tool, text, online: state !== 'offline' });
      if (entry) log(...entry);
      setTimeout(next, ms);
    };
    next();
  }

  // ------------------------------------------------------------------ go

  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(roomEl);
  else window.addEventListener('resize', fit);
  fit();
  renderSoundBtn();
  ui.pets.textContent = petsText();
  setInterval(updateStatus, 1000);
  if (DEMO) runDemo(); else connect();
  // ?tick keeps animating with a timer even when the page is hidden (handy for automated previews).
  if (qs.has('tick')) setInterval(() => render(performance.now()), 1000 / FPS);
  else requestAnimationFrame(loop);
})();
