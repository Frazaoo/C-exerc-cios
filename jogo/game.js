'use strict';
/* =========================================================================
   SOBREVIVENTES DA NOITE — jogo de sobrevivência em pixel art para celular
   Canvas em baixa resolução ampliado com "pixelated"; interface em HTML.
   ========================================================================= */

const TAU = Math.PI * 2;
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (a, n) => ((a % n) + n) % n;
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---------------------------- PALETA (Sweetie 16) ---------------------------- */
const PAL = {
  k: '#1a1c2c', p: '#5d275d', r: '#b13e53', R: '#ef7d57', y: '#ffcd75', g: '#a7f070', G: '#38b764', t: '#257179',
  n: '#8b5a2b', N: '#5a3a1e', b: '#3b5dc9', B: '#41a6f6', c: '#73eff7', w: '#f4f4f4', E: '#94b0c2', e: '#566c86',
  o: '#333c57', P: '#9b4fc4', s: '#f2c09a', S: '#c98a6a',
};

function makeSprite(rows, swap) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = mk(w, h), x = c.getContext('2d');
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const k = (swap && swap[ch]) || ch;
      x.fillStyle = PAL[k] || k;
      x.fillRect(i, j, 1, 1);
    }
  });
  const f = mk(w, h), fx = f.getContext('2d');
  fx.translate(w, 0); fx.scale(-1, 1); fx.drawImage(c, 0, 0);
  const wh = mk(w, h), wx = wh.getContext('2d');
  wx.drawImage(c, 0, 0); wx.globalCompositeOperation = 'source-in'; wx.fillStyle = '#fff'; wx.fillRect(0, 0, w, h);
  return { img: c, flip: f, white: wh, w, h, url: {} };
}
function sprURL(s, sc = 4) {
  if (s.url[sc]) return s.url[sc];
  const c = mk(s.w * sc, s.h * sc), x = c.getContext('2d');
  x.imageSmoothingEnabled = false; x.drawImage(s.img, 0, 0, c.width, c.height);
  return (s.url[sc] = c.toDataURL());
}

/* ---------------------------- SPRITES ---------------------------- */
const ART = {
  guerreiro: [
    '....kkkk....', '...kEEEEk...', '..kEEEEEEk..', '..kEkkkkEk..', '..kEcEEcEk..', '..kEEEEEEk..', '...kEEEEk...',
    '..krrEErrk..', '.kEkrrrrkEk.', '.kEkEbbEkEk.', '.kskEEEEksk.', '..kkeeeekk..', '..keek.keek.', '..kkk..kkk..',
  ],
  arqueira: [
    '....kkkk....', '...kGGGGk...', '..kGGGGGGk..', '..kGssssGk..', '..kGskskGk..', '..kGssssGk..', '...kGssGk...',
    '..knGGGGnk..', '.kGknnnnkGk.', '.kskGGGGksk.', '..kGGGGGGk..', '...knk.knk..', '...kNk.kNk..', '...kk...kk..',
  ],
  mago: [
    '.....kk.....', '....kBBk....', '...kBBBk....', '...kBByBk...', '..kBBBBBBk..', '.kkkkkkkkkk.', '..kskssksk..',
    '..kwwwwwwk..', '..kBwwwwBk..', '.kBBBwwBBBk.', '.kBBBBBBBBk.', '.ksBBBBBBsk.', '..kBBbbBBk..', '..kkkkkkkk..',
  ],
  necromante: [
    '....kkkk....', '...kppppk...', '..kpPPPPpk..', '..kpEEEEpk..', '..kpgEEgpk..', '..kpEkkEpk..', '...kpEEpk...',
    '..kppPPppk..', '.kpPPPPPPpk.', '.kEkPPPPkEk.', '..kpPPPPpk..', '..kpPPPPpk..', '..kppppppk..', '..kkkkkkkk..',
  ],
  morcego: ['k..........k', 'kk..k..k..kk', 'kpk.kkkk.kpk', 'kPpkpypypkPk', '.kPppppppPk.', '..kk.kk.kk..'],
  slime: ['...kkkk...', '..kggggk..', '.kgwggggk.', 'kgggggggGk', 'kgkggkgGGk', 'kgggggGGGk', 'kGGGGGGGGk', '.kkkkkkkk.'],
  zumbi: [
    '..kkkkk...', '.kGgggGk..', '.kgkggkk..', '.kgggggk..', '.kGgrrGk..', '..kkkkk...', '.kttttttk.', 'kgktttttkgk',
    'kgkttGttkg.', '.kktttttkk.', '..kNNkNNk..', '..kNk.kNk..', '..kgk.kgk..', '..kk...kk..',
  ],
  esqueleto: [
    '...kkkk...', '..kwwwwk..', '.kwkwwkwk.', '.kwwwwwwk.', '..kwkkwk..', '...kwwk...', '..kkwwkk..', '.kwkwwkwk.',
    '.kwkEEkwk.', '..kkwwkk..', '..kwkkwk..', '..kwk.kwk.', '..kwk.kwk.', '..kk...kk.',
  ],
  fantasma: [
    '...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkcwwkcwk.', '.kwwwwwwwwk.', '.kwwwkkwwwk.',
    '.kwwwwwwwwk.', '.kEwwwwwwEk.', '.kEEwwwwEEk.', '.kEkEwwEkEk.', '..k.kkkk.k..',
  ],
  golem: [
    '....kkkkkkkk....', '...keeeeeeeek...', '..keEEeeeeEEek..', '..keeyekkeyeek..', '..keeeeeeeeeek..', '..kkeekkkkeekk..',
    '.keekeeeeeekeek.', 'keEEkeEEEEekEEek', 'keEekeeeeeekeEek', 'keeekeeEeeekeeek', '.kkkkeeeeeekkkk.', '....keeeeeek....',
    '...keeekkeeek...', '...keek..keek...', '..keeek..keeek..', '..kkkkk..kkkkk..',
  ],
  ceifador: [
    '.....kkkkkk.....', '....kooooook....', '...kooooooook...', '...kookwwkook...', '...kokwwwwkok...', '...kowrwwrwok...',
    '...kowwwwwwok...', '...koowkkwook...', '..koooooooooook.', '.koooooooooooook', 'kooEooooooooEook', 'koowoooooooowook',
    '.kooooooooooook.', '.kooooooooooook.', '.koooopoooopook.', '..kooppooppook..', '..kpopkopkpopk..', '...k.k..k..k....',
  ],
  // ícones de armas
  espada: ['......Ew', '.....EwE', '....EwE.', '...EwE..', 'y.EwE...', '.yEE....', '.ny.y...', 'n.......'],
  missil: ['...cc...', '..cBBc..', '.cBwwBc.', 'cBwwwwBc', 'cBwwwwBc', '.cBwwBc.', '..cBBc..', '...cc...'],
  flechas: ['....wEEE', '......EE', '.....n.E', '....n...', '...n....', 'r.n.....', '.rr.....', 'rr.r....'],
  machado: ['..EEE...', '.EwwEE..', 'EwwEnE..', 'EEE.n...', '....n...', '.....n..', '.....n..', '......n.'],
  orbes: ['..yy....', '.yRRy...', '.yRRy.y.', '..yy.yRy', '......y.', '.y......', 'yRy.....', '.y......'],
  aura: ['..yyyy..', '.y....y.', 'y..yy..y', 'y.yRRy.y', 'y.yRRy.y', 'y..yy..y', '.y....y.', '..yyyy..'],
  raio: ['....yy..', '...yy...', '..yy....', '.yyyyyy.', '....yy..', '...yy...', '..yy....', '.y......'],
  fogo: ['..kwwk..', '..kEEk..', '.kRRRRk.', 'kRyRRyRk', 'kRyyRRRk', 'krRRRRrk', '.krrrrk.', '..kkkk..'],
  foice: ['.EEEE...', 'EwwwwE..', 'E....nE.', '.....n.E', '....n...', '...n....', '..n.....', '.n......'],
  // ícones de passivas
  forca: ['...kk...', '..kEEk..', '..kRRk..', '.kRrrRk.', 'kRrrrrRk', 'kRrwrrRk', '.kRrrRk.', '..kkkk..'],
  armadura: ['kEEEEEEk', 'kEwbbbEk', 'kEbbbbEk', 'kEbbbbEk', '.kEbbEk.', '.kEbbEk.', '..kEEk..', '...kk...'],
  coracao: ['.kk..kk.', 'kRRkkRRk', 'kRwRRRrk', 'kRRRRRrk', '.kRRRrk.', '..kRrk..', '...kk...', '........'],
  botas: ['..kkkk..', '..knnk..', '..knnk..', '..knnk..', '..knnnkk', '.knnnnnk', '.kNNNNNk', '..kkkkk.'],
  tomo: ['.kkkkkk.', 'kbBBBBbk', 'kbByyBbk', 'kbByyBbk', 'kbBBBBbk', 'kbwwwwbk', 'kbbbbbbk', '.kkkkkk.'],
  cristal: ['...kk...', '..kcck..', '.kcBwck.', 'kcBBwcck', 'kcBBBcck', '.kcBBck.', '..kcck..', '...kk...'],
  duplicador: ['..yy....', '.y..y...', 'y....y..', '.y..yyy.', '..yyy..y', '...y...y', '....y..y', '.....yy.'],
  ampulheta: ['kkkkkkkk', '.kyyyyk.', '..kyyk..', '...ky...', '...yk...', '..k..k..', '.kyyyyk.', 'kkkkkkkk'],
  ima: ['ww....ww', 'RR....RR', 'RR....RR', 'RR....RR', 'RRR..RRR', '.RRRRRR.', '..RRRR..', '........'],
  anel: ['...GG...', '..gGGg..', '.yy..yy.', 'y......y', 'y......y', '.y....y.', '..yyyy..', '........'],
  // coletáveis e cenário
  gema: ['..k..', '.kck.', 'kcBbk', 'kBBbk', '.kbk.', '..k..'],
  moeda: ['.kkk.', 'kyyRk', 'kywRk', 'kyRRk', '.kkk.'],
  frango: ['.kkk...', 'kRRRk..', 'kRwRRk.', 'kRRRrk.', '.kRrkk.', '..kkwwk', '....kwk'],
  bau: ['.kkkkkkkk.', 'knnnnnnnnk', 'knNNNNNNnk', 'kkkkyykkkk', 'knnnyynnnk', 'knnnnnnnnk', 'kNNNNNNNNk', 'kkkkkkkkkk'],
  lapide: ['..kkkk..', '.kEEEEk.', 'kEEkEEek', 'kEkkkEek', 'kEEkEEek', 'kEEkEEek', 'kEEEEEek', 'keeeeeek', 'kkkkkkkk'],
  arbusto: ['...kkk.kk...', '..kGGGkGGk..', '.kGgGGGGgGk.', 'kGGGGtGGGGGk', 'kGtGGGGGtGGk', 'ktGGtGGGGGtk', '.kttttttttk.', '..kkkkkkkk..'],
  osso: ['w....w', 'wwwwww', 'w....w'],
  cogumelo: ['.rrr.', 'rwrwr', 'rrrrr', '.kSk.', '..S..'],
};
const SPR = {};
for (const k in ART) SPR[k] = makeSprite(ART[k]);
SPR.piromante = makeSprite(ART.mago, { B: 'r', b: 'p', w: 'N', y: 'y' });
SPR.gemaV = makeSprite(ART.gema, { c: 'g', B: 'G', b: 't' });
SPR.gemaR = makeSprite(ART.gema, { c: 'R', B: 'r', b: 'p' });
SPR.golemElite = makeSprite(ART.golem, { y: 'R' });
const EVO_SWAP = { E: 'y', w: 'y', B: 'P', c: 'P', b: 'p', R: 'P', r: 'p', n: 'N', y: 'w' };
for (const k of ['espada', 'missil', 'flechas', 'machado', 'orbes', 'aura', 'raio', 'fogo', 'foice']) SPR[k + 'Evo'] = makeSprite(ART[k], EVO_SWAP);

/* ---------------------------- FONTE DE NÚMEROS 3x5 ---------------------------- */
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
const digCache = {};
function digits(color) {
  if (digCache[color]) return digCache[color];
  return (digCache[color] = DIG.map(d => {
    const c = mk(4, 6), x = c.getContext('2d');
    for (let i = 0; i < 15; i++) if (d[i] === '1') {
      x.fillStyle = PAL.k; x.fillRect(i % 3 + 1, ((i / 3) | 0) + 1, 1, 1);
      x.fillStyle = color; x.fillRect(i % 3, (i / 3) | 0, 1, 1);
    }
    return c;
  }));
}
function drawNum(n, x, y, color) {
  const s = String(n), d = digits(color), w = s.length * 4;
  for (let i = 0; i < s.length; i++) ctx.drawImage(d[+s[i]], Math.round(x - w / 2 + i * 4), Math.round(y));
}

/* ---------------------------- DADOS: ARMAS ---------------------------- */
const WEAPONS = {
  espada: {
    nome: 'Espada', req: 'armadura', evoNome: 'Excalibur', evoD: 'Cortes sagrados em 4 direções, enormes e rápidos.',
    d: ['Corta na direção em que você olha.', '+4 de dano.', 'Corta também para trás.', '+6 de dano e +25% de área.', '+8 de dano e recarga menor.'],
    L: [{ dmg: 12, cd: 1.3, area: 1, n: 1 }, { dmg: 16, cd: 1.3, area: 1, n: 1 }, { dmg: 16, cd: 1.3, area: 1, n: 2 },
      { dmg: 22, cd: 1.3, area: 1.25, n: 2 }, { dmg: 30, cd: 1.1, area: 1.25, n: 2 }],
    E: { dmg: 48, cd: 0.85, area: 1.6, n: 4 },
    fire(w, s) {
      const p = G.p, dirs = [[p.face, 0], [-p.face, 0], [0, -1], [0, 1]];
      for (let i = 0; i < s.n; i++) {
        const [dx, dy] = dirs[i], len = 34 * s.area, th = 16 * s.area;
        const hw = dx ? len : th, hh = dx ? th : len;
        const ox = dx * (len / 2 + 3), oy = dy * (len / 2 + 3) - 2;
        G.effects.push({ k: 'slash', ox, oy, w: hw, h: hh, dx, dy, life: 0.2, max: 0.2, evo: w.evo });
        forEnemiesInRect(p.x + ox - hw / 2, p.y + oy - hh / 2, hw, hh, e => hurtEnemy(e, s.dmg, 1.3));
      }
      sfx('slash');
    },
  },
  missil: {
    nome: 'Míssil Mágico', req: 'tomo', amount: true, evoNome: 'Tempestade Arcana', evoD: 'Uma torrente sem fim de mísseis perfurantes.',
    d: ['Dispara no inimigo mais próximo.', '+1 míssil.', '+4 de dano.', '+1 míssil.', '+4 de dano e recarga menor.'],
    L: [{ dmg: 10, cd: 1.1, n: 1, pierce: 1, speed: 150 }, { dmg: 10, cd: 1.1, n: 2, pierce: 1, speed: 150 }, { dmg: 14, cd: 1.1, n: 2, pierce: 1, speed: 150 },
      { dmg: 14, cd: 1.1, n: 3, pierce: 1, speed: 150 }, { dmg: 18, cd: 0.9, n: 3, pierce: 1, speed: 160 }],
    E: { dmg: 20, cd: 0.22, n: 2, pierce: 3, speed: 210 },
    fire(w, s) {
      const ts = nearestEnemies(G.p.x, G.p.y, s.n, 240);
      if (!ts.length) { w.t = 0.2; return; }
      for (let i = 0; i < s.n; i++) {
        const e = ts[i % ts.length], a = Math.atan2(e.y - G.p.y, e.x - G.p.x) + (i >= ts.length ? rnd(-0.4, 0.4) : 0);
        addProj({ k: 'missil', x: G.p.x, y: G.p.y - 3, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, dmg: s.dmg, pierce: s.pierce, life: 1.8, r: 3 * s.area, evo: w.evo, target: e, spd: s.speed });
      }
      sfx('shoot');
    },
  },
  flechas: {
    nome: 'Arco', req: 'botas', amount: true, evoNome: 'Chuva de Flechas', evoD: 'Flechas disparam em todas as direções ao mesmo tempo.',
    d: ['Atira flechas na direção do movimento.', '+1 flecha.', 'Perfura +1 inimigo, +3 de dano.', '+1 flecha.', '+4 de dano, perfura +1.'],
    L: [{ dmg: 9, cd: 0.9, n: 1, pierce: 1, speed: 230 }, { dmg: 9, cd: 0.9, n: 2, pierce: 1, speed: 230 }, { dmg: 12, cd: 0.9, n: 2, pierce: 2, speed: 230 },
      { dmg: 12, cd: 0.9, n: 3, pierce: 2, speed: 230 }, { dmg: 16, cd: 0.85, n: 3, pierce: 3, speed: 240 }],
    E: { dmg: 18, cd: 0.7, n: 14, pierce: 4, speed: 250 },
    fire(w, s) {
      const p = G.p, base = Math.atan2(p.ay, p.ax);
      for (let i = 0; i < s.n; i++) {
        const a = w.evo ? base + (i / s.n) * TAU + G.t : base + (i - (s.n - 1) / 2) * 0.14;
        addProj({ k: 'flecha', x: p.x, y: p.y - 2, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, dmg: s.dmg, pierce: s.pierce, life: 1.2, r: 3, evo: w.evo });
      }
      sfx('shoot');
    },
  },
  machado: {
    nome: 'Machado', req: 'forca', amount: true, evoNome: 'Ragnarök', evoD: 'Machados gigantes caem como uma tempestade.',
    d: ['Arremessado para cima, cai atravessando tudo.', '+1 machado.', '+8 de dano.', '+30% de área.', '+1 machado e +8 de dano.'],
    L: [{ dmg: 22, cd: 1.6, n: 1, area: 1 }, { dmg: 22, cd: 1.6, n: 2, area: 1 }, { dmg: 30, cd: 1.6, n: 2, area: 1 },
      { dmg: 30, cd: 1.6, n: 2, area: 1.3 }, { dmg: 38, cd: 1.5, n: 3, area: 1.3 }],
    E: { dmg: 60, cd: 1.1, n: 5, area: 1.8 },
    fire(w, s) {
      for (let i = 0; i < s.n; i++) {
        addProj({ k: 'machado', x: G.p.x, y: G.p.y, vx: rnd(-40, 40) + (i - (s.n - 1) / 2) * 35 + G.p.ax * 20, vy: rnd(-240, -200), g: 420, dmg: s.dmg, pierce: 99, life: 2.2, r: 5 * s.area, sc: s.area, rot: 0, evo: w.evo });
      }
      sfx('throw');
    },
  },
  orbes: {
    nome: 'Orbes Solares', req: 'cristal', amount: true, evoNome: 'Galáxia', evoD: 'Seis sóis orbitam você para sempre.',
    d: ['Esferas giram ao seu redor por um tempo.', '+1 orbe.', '+4 de dano, dura mais.', '+1 orbe.', '+4 de dano e +25% de área.'],
    L: [{ dmg: 9, cd: 3.5, n: 2, dur: 3, area: 1, spd: 3 }, { dmg: 9, cd: 3.5, n: 3, dur: 3, area: 1, spd: 3 }, { dmg: 13, cd: 3.5, n: 3, dur: 3.5, area: 1, spd: 3 },
      { dmg: 13, cd: 3.5, n: 4, dur: 3.5, area: 1, spd: 3.2 }, { dmg: 17, cd: 3.2, n: 4, dur: 3.5, area: 1.25, spd: 3.4 }],
    E: { dmg: 26, cd: 0.1, n: 6, dur: 99999, area: 1.5, spd: 3.8 },
    fire(w, s) { w.until = G.t + s.dur; w.t = s.cd + s.dur; sfx('orb'); },
    update(w, s) {
      w.orbs = [];
      if (G.t >= (w.until || 0)) return;
      const R = 30 * s.area;
      for (let i = 0; i < s.n; i++) {
        const a = G.t * s.spd + (i / s.n) * TAU, ox = G.p.x + Math.cos(a) * R, oy = G.p.y + Math.sin(a) * R * 0.9;
        w.orbs.push([ox, oy]);
        forEnemiesInRadius(ox, oy, 5 * s.area, e => { if (hitOnce(e, 'orbes', 0.4)) hurtEnemy(e, s.dmg, 1); });
      }
    },
  },
  aura: {
    nome: 'Aura Sagrada', req: 'coracao', evoNome: 'Santuário', evoD: 'Aura gigante que cura você e deixa inimigos lentos.',
    d: ['Fere continuamente quem chegar perto.', '+2 de dano.', '+20% de área.', '+2 de dano.', '+2 de dano e +20% de área.'],
    L: [{ dmg: 4, tick: 0.6, area: 1 }, { dmg: 6, tick: 0.6, area: 1 }, { dmg: 6, tick: 0.6, area: 1.2 }, { dmg: 8, tick: 0.55, area: 1.2 }, { dmg: 10, tick: 0.5, area: 1.4 }],
    E: { dmg: 15, tick: 0.45, area: 1.85 },
    update(w, s, dt) {
      w.tick = (w.tick || 0) - dt;
      w.R = 26 * s.area;
      if (w.tick > 0) return;
      w.tick = s.tick * G.st.cd;
      forEnemiesInRadius(G.p.x, G.p.y, w.R, e => { hurtEnemy(e, s.dmg, 0.6); if (w.evo) e.slow = 0.6; });
      if (w.evo) healPlayer(0.6);
    },
  },
  raio: {
    nome: 'Raio', req: 'duplicador', amount: true, evoNome: 'Ira dos Céus', evoD: 'Cada raio salta em corrente entre vários inimigos.',
    d: ['Raios caem em inimigos aleatórios.', '+1 raio.', '+8 de dano.', '+1 raio.', '+8 de dano e recarga menor.'],
    L: [{ dmg: 20, cd: 2.2, n: 1, area: 1 }, { dmg: 20, cd: 2.2, n: 2, area: 1 }, { dmg: 28, cd: 2.2, n: 2, area: 1 }, { dmg: 28, cd: 2.2, n: 3, area: 1 }, { dmg: 36, cd: 1.8, n: 3, area: 1 }],
    E: { dmg: 46, cd: 1.1, n: 4, area: 1.3, chain: 5 },
    fire(w, s) {
      const vis = G.enemies.filter(e => !e.dead && Math.abs(e.x - G.p.x) < VW / 2 && Math.abs(e.y - G.p.y) < VH / 2);
      if (!vis.length) { w.t = 0.3; return; }
      for (let i = 0; i < s.n; i++) {
        const e = pick(vis);
        bolt(e.x, e.y);
        forEnemiesInRadius(e.x, e.y, 12 * s.area, o => hurtEnemy(o, s.dmg, 0.5));
        if (s.chain) {
          const hit = new Set([e]); let cur = e;
          for (let c = 0; c < s.chain; c++) {
            let best = null, bd = 80 * 80;
            for (const o of G.enemies) {
              if (o.dead || hit.has(o)) continue;
              const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2;
              if (d < bd) { bd = d; best = o; }
            }
            if (!best) break;
            G.effects.push({ k: 'chain', x1: cur.x, y1: cur.y, x2: best.x, y2: best.y, life: 0.2, max: 0.2 });
            hurtEnemy(best, s.dmg * 0.7, 0.3); hit.add(best); cur = best;
          }
        }
      }
      G.shake = Math.max(G.shake, 0.08);
      sfx('zap');
    },
  },
  fogo: {
    nome: 'Frasco de Fogo', req: 'ampulheta', amount: true, evoNome: 'Inferno', evoD: 'Campos de fogo enormes que duram muito mais.',
    d: ['Arremessa frascos que deixam o chão em chamas.', '+1 frasco.', '+25% de área.', '+2 de dano, dura mais.', '+1 frasco.'],
    L: [{ dmg: 5, cd: 3, n: 1, dur: 2.5, area: 1, tick: 0.35 }, { dmg: 5, cd: 3, n: 2, dur: 2.5, area: 1, tick: 0.35 }, { dmg: 5, cd: 3, n: 2, dur: 2.5, area: 1.25, tick: 0.35 },
      { dmg: 7, cd: 3, n: 2, dur: 3, area: 1.25, tick: 0.35 }, { dmg: 7, cd: 2.8, n: 3, dur: 3, area: 1.25, tick: 0.3 }],
    E: { dmg: 11, cd: 2, n: 4, dur: 4.5, area: 1.8, tick: 0.3 },
    fire(w, s) {
      const ts = nearestEnemies(G.p.x, G.p.y, 20, 140);
      for (let i = 0; i < s.n; i++) {
        const e = ts.length ? pick(ts) : null;
        const tx = e ? e.x : G.p.x + rnd(-70, 70), ty = e ? e.y : G.p.y + rnd(-70, 70);
        addProj({ k: 'frasco', x: G.p.x, y: G.p.y, sx: G.p.x, sy: G.p.y, tx, ty, age: 0, life: 0.45, max: 0.45, nohit: true, s, evo: w.evo });
      }
      sfx('throw');
    },
  },
  foice: {
    nome: 'Foice', req: 'anel', amount: true, evoNome: 'Foice Vampírica', evoD: 'Foices gigantes que roubam vida a cada corte.',
    d: ['Vai até o inimigo e volta como bumerangue.', '+4 de dano.', '+1 foice.', '+4 de dano e +30% de área.', '+1 foice.'],
    L: [{ dmg: 14, cd: 1.5, n: 1, area: 1, speed: 170 }, { dmg: 18, cd: 1.5, n: 1, area: 1, speed: 170 }, { dmg: 18, cd: 1.5, n: 2, area: 1, speed: 170 },
      { dmg: 22, cd: 1.5, n: 2, area: 1.3, speed: 180 }, { dmg: 22, cd: 1.4, n: 3, area: 1.3, speed: 180 }],
    E: { dmg: 32, cd: 1.1, n: 4, area: 1.6, speed: 200 },
    fire(w, s) {
      const ts = nearestEnemies(G.p.x, G.p.y, s.n, 200);
      for (let i = 0; i < s.n; i++) {
        const a = ts[i] ? Math.atan2(ts[i].y - G.p.y, ts[i].x - G.p.x) : Math.atan2(G.p.ay, G.p.ax) + i * (TAU / s.n);
        addProj({ k: 'foice', x: G.p.x, y: G.p.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, spd: s.speed, age: 0, dmg: s.dmg, pierce: 999, rehit: 0.3, life: 4, r: 6 * s.area, sc: s.area, rot: 0, evo: w.evo });
      }
      sfx('throw');
    },
  },
};

/* ---------------------------- DADOS: PASSIVAS ---------------------------- */
const PASSIVES = {
  forca: { nome: 'Poção de Força', d: '+10% de dano.', max: 5, apply: (st, l) => { st.might += 0.1 * l; } },
  armadura: { nome: 'Escudo', d: 'Reduz em 1 o dano recebido.', max: 5, apply: (st, l) => { st.armor += l; } },
  coracao: { nome: 'Coração', d: '+20% de vida máxima.', max: 5, apply: (st, l) => { st.hpMul += 0.2 * l; } },
  botas: { nome: 'Botas', d: '+10% de velocidade.', max: 5, apply: (st, l) => { st.spd += 0.1 * l; } },
  tomo: { nome: 'Tomo Veloz', d: '-8% no tempo de recarga.', max: 5, apply: (st, l) => { st.cd -= 0.08 * l; } },
  cristal: { nome: 'Cristal', d: '+10% de área das armas.', max: 5, apply: (st, l) => { st.area += 0.1 * l; } },
  duplicador: { nome: 'Duplicador', d: '+1 projétil em várias armas.', max: 2, apply: (st, l) => { st.amount += l; } },
  ampulheta: { nome: 'Ampulheta', d: '+15% de duração dos efeitos.', max: 5, apply: (st, l) => { st.dur += 0.15 * l; } },
  ima: { nome: 'Ímã', d: '+30% de alcance de coleta.', max: 5, apply: (st, l) => { st.magnet += 0.3 * l; } },
  anel: { nome: 'Anel Vital', d: 'Regenera 0,2 de vida por segundo.', max: 5, apply: (st, l) => { st.regen += 0.2 * l; } },
};

/* ---------------------------- DADOS: CLASSES ---------------------------- */
const CLASSES = {
  guerreiro: { nome: 'Guerreiro', arma: 'espada', hp: 130, spr: 'guerreiro', custo: 0, bonus: { armor: 1 }, ds: 'Vida alta e +1 de armadura.' },
  arqueira: { nome: 'Arqueira', arma: 'flechas', hp: 95, spr: 'arqueira', custo: 0, bonus: { spd: 0.15, might: 0.1 }, ds: '+15% de velocidade e +10% de dano.' },
  mago: { nome: 'Mago', arma: 'missil', hp: 85, spr: 'mago', custo: 120, bonus: { cd: -0.1, area: 0.1 }, ds: 'Recarga 10% menor e +10% de área.' },
  necromante: { nome: 'Necromante', arma: 'foice', hp: 100, spr: 'necromante', custo: 250, bonus: { regen: 0.3, dur: 0.2 }, ds: 'Regenera vida e efeitos duram mais.' },
  piromante: { nome: 'Piromante', arma: 'fogo', hp: 90, spr: 'piromante', custo: 400, bonus: { area: 0.2, might: 0.05 }, ds: '+20% de área e +5% de dano.' },
};

/* ---------------------------- DADOS: INIMIGOS ---------------------------- */
const ENEMIES = {
  morcego: { hp: 6, speed: 50, dmg: 5, xp: 1, r: 5, spr: 'morcego', fly: true },
  slime: { hp: 11, speed: 28, dmg: 6, xp: 1, r: 5, spr: 'slime' },
  zumbi: { hp: 24, speed: 26, dmg: 8, xp: 2, r: 5, spr: 'zumbi' },
  esqueleto: { hp: 32, speed: 40, dmg: 10, xp: 3, r: 5, spr: 'esqueleto' },
  fantasma: { hp: 20, speed: 60, dmg: 9, xp: 3, r: 5, spr: 'fantasma', ghost: true },
  golem: { hp: 160, speed: 24, dmg: 18, xp: 25, r: 8, spr: 'golemElite', elite: true, kbRes: 0.8 },
  ceifador: { hp: 9000, speed: 42, dmg: 30, xp: 0, r: 13, spr: 'ceifador', boss: true, kbRes: 1, sc: 2 },
};

/* ---------------------------- LOJA (progresso permanente) ---------------------------- */
const SHOP = {
  forca: { nome: 'Poder', d: '+5% de dano por nível.', max: 5, base: 40 },
  vida: { nome: 'Vitalidade', d: '+10% de vida por nível.', max: 5, base: 40 },
  vel: { nome: 'Agilidade', d: '+5% de velocidade por nível.', max: 5, base: 40 },
  ima: { nome: 'Atração', d: '+15% de alcance de coleta.', max: 5, base: 30 },
  ganancia: { nome: 'Ganância', d: '+20% de ouro coletado.', max: 5, base: 50 },
  couraca: { nome: 'Couraça', d: '+1 de armadura por nível.', max: 3, base: 90 },
};

/* ---------------------------- SAVE ---------------------------- */
const SAVE_KEY = 'sobreviventes_noite_v1';
let SAVE = { gold: 0, shop: {}, unlocked: { guerreiro: true, arqueira: true }, best: 0, wins: 0, evos: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) SAVE = Object.assign(SAVE, s); } catch (e) { /* sem armazenamento */ }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* ignora */ } }

/* ---------------------------- ÁUDIO (sintetizado) ---------------------------- */
let AC = null, muted = false;
try { muted = localStorage.getItem(SAVE_KEY + '_mute') === '1'; } catch (e) { /* ignora */ }
const lastS = {};
const SFX = {
  hit: [260, 120, 0.05, 'square', 0.025], xp: [900, 1400, 0.05, 'triangle', 0.04], lvl: [440, 990, 0.35, 'square', 0.06],
  hurt: [180, 50, 0.18, 'sawtooth', 0.08], shoot: [700, 300, 0.07, 'triangle', 0.03], slash: [500, 150, 0.09, 'sawtooth', 0.03],
  throw: [300, 500, 0.1, 'triangle', 0.03], zap: [1200, 80, 0.2, 'sawtooth', 0.05], orb: [600, 900, 0.15, 'sine', 0.04],
  chest: [520, 1560, 0.5, 'square', 0.06], boss: [110, 40, 1.2, 'sawtooth', 0.12], die: [200, 40, 0.6, 'square', 0.08],
  coin: [1300, 1800, 0.08, 'square', 0.03], heal: [500, 800, 0.2, 'sine', 0.05], evo: [300, 1200, 0.8, 'square', 0.07],
};
function sfx(n) {
  if (!AC || muted) return;
  const now = AC.currentTime;
  if (lastS[n] && now - lastS[n] < 0.045) return;
  lastS[n] = now;
  const [f0, f1, d, type, vol] = SFX[n];
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(f1, now + d);
  g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  o.connect(g).connect(AC.destination); o.start(now); o.stop(now + d + 0.02);
}
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
}

/* ---------------------------- CANVAS ---------------------------- */
const cv = $('#cv'), ctx = cv.getContext('2d');
let VW = 200, VH = 300, SCALE = 2, vignette = null;
function resize() {
  const w = innerWidth, h = innerHeight;
  SCALE = Math.max(2, Math.round(Math.min(w, h) / 190));
  VW = Math.ceil(w / SCALE); VH = Math.ceil(h / SCALE);
  cv.width = VW; cv.height = VH;
  cv.style.width = VW * SCALE + 'px'; cv.style.height = VH * SCALE + 'px';
  ctx.imageSmoothingEnabled = false;
  vignette = mk(VW, VH);
  const vx = vignette.getContext('2d');
  const gr = vx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.25, VW / 2, VH / 2, Math.hypot(VW, VH) * 0.6);
  gr.addColorStop(0, 'rgba(10,8,30,0)'); gr.addColorStop(1, 'rgba(10,8,30,0.7)');
  vx.fillStyle = gr; vx.fillRect(0, 0, VW, VH);
}
addEventListener('resize', resize);
resize();

// chão: ladrilho 64x64 de grama noturna
const tile = mk(64, 64);
(() => {
  const x = tile.getContext('2d');
  x.fillStyle = '#22322a'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64 * 64; i++) {
    const r = hash(i, 7);
    if (r < 0.06) { x.fillStyle = '#2b3f33'; x.fillRect(i % 64, (i / 64) | 0, 1, 1); }
    else if (r < 0.1) { x.fillStyle = '#1b2721'; x.fillRect(i % 64, (i / 64) | 0, 1, 1); }
    else if (r < 0.104) { x.fillStyle = '#3a5444'; x.fillRect(i % 64, (i / 64) | 0, 1, 2); }
  }
})();
const groundPat = ctx.createPattern(tile, 'repeat');
const DECOR = ['lapide', 'arbusto', 'osso', 'cogumelo', 'arbusto', 'osso'];

/* ---------------------------- ESTADO ---------------------------- */
let G = null, state = 'menu', menuCam = 0;
const input = { kx: 0, ky: 0, jx: 0, jy: 0 };
const keys = {};

function xpFor(l) { return Math.round(5 + (l - 1) * 9 + Math.pow(l - 1, 1.7)); }

function newGame(cls) {
  G = {
    cls, t: 0, kills: 0, gold: 0,
    p: { x: 0, y: 0, hp: 0, maxHp: 0, lvl: 1, xp: 0, xpNext: xpFor(1), face: 1, ax: 1, ay: 0, hurt: 0, inv: 0, moving: false, anim: 0 },
    weapons: [], passives: {}, enemies: [], projs: [], effects: [], zones: [], pickups: [], parts: [], nums: [],
    spawnAcc: 0, nextElite: 60, hordes: [150, 300, 450], boss: null, bossSpawned: false, pendingLevels: 0,
    shake: 0, ended: false, pid: 0, hudDirty: true, readyToast: {},
  };
  const dbg = new URLSearchParams(location.search).get('t');
  if (dbg) { G.t = +dbg; G.nextElite = Math.ceil((G.t + 1) / 60) * 60; G.hordes = G.hordes.filter(h => h > G.t); }
  addWeapon(CLASSES[cls].arma);
  recalc();
  G.p.hp = G.p.maxHp;
}

function recalc() {
  const c = CLASSES[G.cls], sv = SAVE.shop;
  const st = { might: 1, armor: 0, hpMul: 1, spd: 1, cd: 1, area: 1, amount: 0, dur: 1, magnet: 1, regen: 0, greed: 1 };
  for (const k in c.bonus) st[k] += c.bonus[k];
  st.might += 0.05 * (sv.forca || 0); st.hpMul += 0.1 * (sv.vida || 0); st.spd += 0.05 * (sv.vel || 0);
  st.magnet += 0.15 * (sv.ima || 0); st.greed += 0.2 * (sv.ganancia || 0); st.armor += sv.couraca || 0;
  for (const id in G.passives) PASSIVES[id].apply(st, G.passives[id]);
  st.cd = Math.max(0.4, st.cd);
  G.st = st;
  const old = G.p.maxHp;
  G.p.maxHp = Math.round(c.hp * st.hpMul);
  if (old) G.p.hp += Math.max(0, G.p.maxHp - old);
  G.p.hp = Math.min(G.p.hp, G.p.maxHp);
  for (const w of G.weapons) w.s = wstats(w);
  G.hudDirty = true;
}
function wstats(w) {
  const d = WEAPONS[w.id], st = G.st, s = { ...(w.evo ? d.E : d.L[w.lvl - 1]) };
  s.dmg *= st.might;
  if (s.cd) s.cd *= st.cd;
  s.area = (s.area || 1) * st.area;
  if (s.dur) s.dur *= st.dur;
  if (d.amount && s.n != null) s.n += st.amount;
  return s;
}
function addWeapon(id) { G.weapons.push({ id, lvl: 1, t: 0.3, evo: false }); if (G.st) recalc(); }
function canEvolve(w) { const d = WEAPONS[w.id]; return !w.evo && w.lvl >= d.L.length && G.passives[d.req] > 0; }

/* ---------------------------- GRADE ESPACIAL ---------------------------- */
const GRID = new Map(), CS = 32;
const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
function gridBuild() {
  GRID.clear();
  for (const e of G.enemies) {
    const k = gkey(Math.floor(e.x / CS), Math.floor(e.y / CS));
    const a = GRID.get(k);
    if (a) a.push(e); else GRID.set(k, [e]);
  }
}
function forNear(x, y, r, cb) {
  const x0 = Math.floor((x - r) / CS), x1 = Math.floor((x + r) / CS), y0 = Math.floor((y - r) / CS), y1 = Math.floor((y + r) / CS);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = GRID.get(gkey(cx, cy));
    if (a) for (const e of a) if (!e.dead) cb(e);
  }
}
function forEnemiesInRadius(x, y, r, cb) {
  forNear(x, y, r + 16, e => { const dx = e.x - x, dy = e.y - y, rr = r + e.r; if (dx * dx + dy * dy <= rr * rr) cb(e); });
}
function forEnemiesInRect(x, y, w, h, cb) {
  forNear(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 16, e => {
    if (e.x + e.r > x && e.x - e.r < x + w && e.y + e.r > y && e.y - e.r < y + h) cb(e);
  });
}
function nearestEnemies(x, y, n, range) {
  const r2 = range * range, out = [];
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < r2) out.push([d, e]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, n).map(a => a[1]);
}
function hitOnce(e, key, cd) {
  if ((e.icd[key] || 0) > G.t) return false;
  e.icd[key] = G.t + cd; return true;
}

/* ---------------------------- ENTIDADES ---------------------------- */
function spawnEnemy(type, x, y) {
  const d = ENEMIES[type], tm = d.boss ? 1 : 1 + G.t / 150;
  const e = {
    type, d, x, y, hp: d.hp * tm, maxHp: d.hp * tm, speed: d.speed * (1 + Math.min(0.35, G.t / 1500)),
    dmg: Math.round(d.dmg * (1 + G.t / 700)), r: d.r, spr: SPR[d.spr], kx: 0, ky: 0, flash: 0, hitCd: 0, icd: {},
    face: 1, ph: Math.random() * TAU, slow: 0, kbRes: d.kbRes || 0, sc: d.sc || 1, dash: 0, act: 3,
  };
  G.enemies.push(e);
  return e;
}
function addProj(o) { o.id = ++G.pid; o.hit = new Set(); G.projs.push(o); }
function addNum(x, y, v, color) { if (G.nums.length < 70) G.nums.push({ x: x + rnd(-3, 3), y, v, life: 0.6, color }); }
function burst(x, y, color, n = 6, sp = 50) {
  for (let i = 0; i < n && G.parts.length < 400; i++) {
    const a = Math.random() * TAU, v = rnd(sp * 0.3, sp);
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.25, 0.5), color, s: Math.random() < 0.3 ? 2 : 1 });
  }
}
function bolt(x, y) {
  const pts = []; let cx = x + rnd(-10, 10), cy = y - VH * 0.7;
  while (cy < y) { pts.push([cx, cy]); cy += rnd(8, 16); cx += rnd(-7, 7); }
  pts.push([x, y]);
  G.effects.push({ k: 'bolt', pts, x, y, life: 0.22, max: 0.22 });
}

function hurtEnemy(e, dmg, kb = 1) {
  if (e.dead) return 0;
  dmg = Math.max(1, Math.round(dmg * rnd(0.9, 1.1)));
  e.hp -= dmg; e.flash = 0.1;
  if (kb && e.kbRes < 1) {
    const a = Math.atan2(e.y - G.p.y, e.x - G.p.x), f = 70 * kb * (1 - e.kbRes);
    e.kx += Math.cos(a) * f; e.ky += Math.sin(a) * f;
  }
  addNum(e.x, e.y - e.spr.h * e.sc / 2 - 4, dmg, dmg >= 40 ? PAL.y : PAL.w);
  sfx('hit');
  if (e.hp <= 0) killEnemy(e);
  return dmg;
}
function killEnemy(e) {
  e.dead = true; G.kills++;
  burst(e.x, e.y, e.d.ghost ? PAL.c : PAL.r, e.d.boss ? 60 : 7, e.d.boss ? 120 : 50);
  if (e.d.xp) dropGem(e.x, e.y, Math.round(e.d.xp * (1 + G.t / 600)));
  const r = Math.random();
  if (e.d.elite) G.pickups.push({ k: 'bau', x: e.x, y: e.y });
  else if (r < 0.035) G.pickups.push({ k: 'moeda', x: e.x + 4, y: e.y, v: 1 + ((Math.random() * 3) | 0) });
  else if (r < 0.045) G.pickups.push({ k: 'frango', x: e.x, y: e.y });
  else if (r < 0.049) G.pickups.push({ k: 'ima', x: e.x, y: e.y });
  if (e.d.boss) {
    G.boss = null; $('#bossbar').hidden = true;
    G.shake = 0.6; sfx('die');
    setTimeout(() => endGame(true), 1600);
  }
}
function dropGem(x, y, v) {
  let n = 0;
  for (const p of G.pickups) if (p.k === 'xp') n++;
  if (n > 260) {
    // junta experiência em uma gema distante para não pesar o jogo
    for (let i = G.pickups.length - 1; i >= 0; i--) if (G.pickups[i].k === 'xp' && !G.pickups[i].mag) { G.pickups[i].v += v; return; }
  }
  G.pickups.push({ k: 'xp', x: x + rnd(-2, 2), y: y + rnd(-2, 2), v });
}
function healPlayer(v) {
  const p = G.p, before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + v);
  if (p.hp - before >= 5) addNum(p.x, p.y - 14, Math.round(p.hp - before), PAL.g);
}
function damagePlayer(d) {
  const p = G.p;
  if (p.inv > 0 || G.ended) return;
  d = Math.max(1, Math.round(d - G.st.armor));
  p.hp -= d; p.hurt = 0.18; p.inv = 0.1; G.shake = Math.max(G.shake, 0.12);
  addNum(p.x, p.y - 14, d, PAL.r);
  sfx('hurt');
  if (p.hp <= 0) { p.hp = 0; burst(p.x, p.y, PAL.r, 30, 90); endGame(false); }
}

/* ---------------------------- DIRETOR DE ONDAS ---------------------------- */
function pickType() {
  const m = G.t / 60, pool = [['morcego', m < 4 ? 3 : 1], ['slime', m < 3 ? 3 : 0.8]];
  if (m >= 1) pool.push(['zumbi', 3]);
  if (m >= 3) pool.push(['esqueleto', 3]);
  if (m >= 5) pool.push(['fantasma', 2.5]);
  if (m >= 7) pool.push(['esqueleto', 2], ['fantasma', 1.5]);
  let tot = 0; for (const [, w] of pool) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
  return 'morcego';
}
function spawnRadius() { return Math.hypot(VW, VH) / 2 + 14; }
function director(dt) {
  const p = G.p, R = spawnRadius(), cap = 360;
  let rate = 1 + G.t / 22;
  if (G.boss) rate *= 0.35;
  const minAlive = Math.min(cap, 12 + G.t / 2.4);
  G.spawnAcc += dt * rate;
  if (G.enemies.length < minAlive) G.spawnAcc += dt * 8;
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length >= cap) break;
    const a = Math.random() * TAU;
    spawnEnemy(pickType(), p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
  }
  if (G.t >= G.nextElite && !G.bossSpawned) {
    G.nextElite += 60;
    const a = Math.random() * TAU;
    spawnEnemy('golem', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
    toast('Um GOLEM surgiu! Derrote-o para ganhar um baú');
  }
  if (G.hordes.length && G.t >= G.hordes[0]) {
    G.hordes.shift();
    const type = G.t < 200 ? 'morcego' : G.t < 400 ? 'esqueleto' : 'fantasma';
    for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; spawnEnemy(type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
    toast('UMA HORDA CERCA VOCÊ!');
  }
  if (!G.bossSpawned && G.t >= 600) {
    G.bossSpawned = true;
    G.boss = spawnEnemy('ceifador', p.x, p.y - R);
    $('#bossbar').hidden = false;
    toast('O CEIFADOR CHEGOU! Derrote-o para vencer');
    sfx('boss'); G.shake = 0.5;
  }
}

/* ---------------------------- ATUALIZAÇÃO ---------------------------- */
function update(dt) {
  const p = G.p, st = G.st;
  G.t += dt;

  // movimento do jogador
  let ix = input.kx + input.jx, iy = input.ky + input.jy;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  p.moving = il > 0.05;
  if (p.moving) {
    const sp = 62 * st.spd;
    p.x += ix * sp * dt; p.y += iy * sp * dt;
    if (Math.abs(ix) > 0.15) p.face = Math.sign(ix);
    const l = Math.hypot(ix, iy); p.ax = ix / l; p.ay = iy / l;
    p.anim += dt;
  }
  p.hurt -= dt; p.inv -= dt;
  if (st.regen) p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);

  gridBuild();
  director(dt);

  // armas
  for (const w of G.weapons) {
    const d = WEAPONS[w.id];
    if (d.update) d.update(w, w.s, dt);
    if (d.fire) { w.t -= dt; if (w.t <= 0) { w.t = w.s.cd; d.fire(w, w.s); } }
  }

  // projéteis
  for (const pr of G.projs) {
    pr.life -= dt;
    if (pr.k === 'machado') { pr.vy += pr.g * dt; pr.rot += dt * 14; }
    else if (pr.k === 'missil') {
      const t = pr.target;
      if (t && !t.dead) {
        const a = Math.atan2(t.y - pr.y, t.x - pr.x), cur = Math.atan2(pr.vy, pr.vx);
        let da = mod(a - cur + Math.PI, TAU) - Math.PI; da = clamp(da, -5 * dt, 5 * dt);
        pr.vx = Math.cos(cur + da) * pr.spd; pr.vy = Math.sin(cur + da) * pr.spd;
      }
      if (Math.random() < 0.5) G.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.2, color: pr.evo ? PAL.P : PAL.c, s: 1 });
    } else if (pr.k === 'foice') {
      pr.age += dt; pr.rot += dt * 16;
      if (pr.age < 0.55) { const f = 1 - pr.age / 0.55; pr.x += pr.vx * f * dt; pr.y += pr.vy * f * dt; }
      else {
        const dx = p.x - pr.x, dy = p.y - pr.y, d = Math.hypot(dx, dy) || 1, sp = pr.spd * Math.min(1.6, (pr.age - 0.55) * 3 + 0.3);
        pr.x += (dx / d) * sp * dt; pr.y += (dy / d) * sp * dt;
        if (d < 8) pr.life = 0;
      }
    } else if (pr.k === 'frasco') {
      pr.age += dt;
      const f = Math.min(1, pr.age / pr.max);
      pr.x = pr.sx + (pr.tx - pr.sx) * f; pr.y = pr.sy + (pr.ty - pr.sy) * f - Math.sin(f * Math.PI) * 30;
      if (pr.life <= 0) {
        const s = pr.s;
        G.zones.push({ x: pr.tx, y: pr.ty, r: 17 * s.area, life: s.dur, max: s.dur, dmg: s.dmg, tick: s.tick, t: 0, evo: pr.evo });
        burst(pr.tx, pr.ty, PAL.R, 8, 40);
      }
    }
    if (pr.k !== 'foice' && pr.k !== 'frasco') { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    if (pr.nohit || pr.life <= 0) continue;
    forEnemiesInRadius(pr.x, pr.y, pr.r, e => {
      if (pr.pierce <= 0) return;
      if (pr.rehit) { if (!hitOnce(e, 'p' + pr.id, pr.rehit)) return; }
      else { if (pr.hit.has(e)) return; pr.hit.add(e); }
      const dealt = hurtEnemy(e, pr.dmg, pr.k === 'machado' ? 0.6 : 0.8);
      if (pr.k === 'foice' && pr.evo) healPlayer(dealt * 0.03);
      pr.pierce--;
      if (pr.k === 'missil') burst(pr.x, pr.y, pr.evo ? PAL.P : PAL.c, 3, 30);
    });
    if (pr.pierce <= 0) pr.life = 0;
  }
  G.projs = G.projs.filter(pr => pr.life > 0 && Math.abs(pr.x - p.x) < VW && Math.abs(pr.y - p.y) < VH + 60);

  // zonas de fogo
  for (const z of G.zones) {
    z.life -= dt; z.t -= dt;
    if (z.t <= 0) { z.t = z.tick; forEnemiesInRadius(z.x, z.y, z.r, e => hurtEnemy(e, z.dmg, 0.1)); }
  }
  G.zones = G.zones.filter(z => z.life > 0);

  // inimigos
  const R = spawnRadius();
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    let sp = e.speed * (e.slow > 0 ? 0.55 : 1);
    if (e.d.boss) {
      e.act -= dt;
      if (e.act <= 0) {
        e.act = 4;
        if (Math.random() < 0.5) { e.dash = 0.7; sfx('slash'); }
        else { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; spawnEnemy('morcego', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20); } }
      }
      if (e.dash > 0) { e.dash -= dt; sp *= 3.2; }
      $('#bossfill').style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
    }
    e.slow -= dt;
    let mx = (dx / d) * sp, my = (dy / d) * sp;
    if (e.d.fly) my += Math.sin(G.t * 6 + e.ph) * 20;
    e.x += (mx + e.kx) * dt; e.y += (my + e.ky) * dt;
    const decay = Math.max(0, 1 - 9 * dt); e.kx *= decay; e.ky *= decay;
    e.face = dx < 0 ? -1 : 1;
    e.flash -= dt; e.hitCd -= dt;
    // separação
    if (!e.d.ghost) {
      let n = 0;
      forNear(e.x, e.y, 10, o => {
        if (o === e || n > 6 || o.d.ghost) return;
        const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy, rr = e.r + o.r;
        if (dd < rr * rr && dd > 0.01) {
          const dl = Math.sqrt(dd), push = ((rr - dl) / dl) * 0.5;
          const w = o.d.boss ? 1 : e.d.boss ? 0 : 0.5;
          e.x += ox * push * w; e.y += oy * push * w; n++;
        }
      });
    }
    // contato com o jogador
    if (d < e.r + 5 && e.hitCd <= 0) { damagePlayer(e.dmg); e.hitCd = 0.6; }
    // reposiciona quem ficou para trás
    if (d > R * 1.6 && !e.d.boss) {
      const a = Math.atan2(p.ay, p.ax) + rnd(-1, 1);
      e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R;
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);

  // coletáveis
  const mag = 26 * st.magnet;
  for (const it of G.pickups) {
    const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy) || 1;
    if (!it.mag && d < (it.k === 'bau' ? 14 : mag)) it.mag = true;
    if (it.mag) {
      it.sp = (it.sp || 40) + 260 * dt;
      it.x += (dx / d) * it.sp * dt; it.y += (dy / d) * it.sp * dt;
      if (d < 7) { it.got = true; collect(it); }
    }
  }
  G.pickups = G.pickups.filter(it => !it.got);

  // partículas, efeitos e números
  for (const q of G.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; }
  G.parts = G.parts.filter(q => q.life > 0);
  for (const f of G.effects) f.life -= dt;
  G.effects = G.effects.filter(f => f.life > 0);
  for (const n of G.nums) { n.life -= dt; n.y -= 22 * dt; }
  G.nums = G.nums.filter(n => n.life > 0);
  G.shake = Math.max(0, G.shake - dt);

  updateHud();
  if (G.pendingLevels > 0 && state === 'play' && !G.ended) openLevelUp();
}

function collect(it) {
  const p = G.p;
  if (it.k === 'xp') {
    p.xp += it.v; sfx('xp');
    while (p.xp >= p.xpNext) { p.xp -= p.xpNext; p.lvl++; p.xpNext = xpFor(p.lvl); G.pendingLevels++; }
  } else if (it.k === 'moeda') { G.gold += Math.max(1, Math.round(it.v * G.st.greed)); sfx('coin'); }
  else if (it.k === 'frango') { healPlayer(30); sfx('heal'); }
  else if (it.k === 'ima') { for (const q of G.pickups) if (q.k === 'xp') q.mag = true; sfx('orb'); }
  else if (it.k === 'bau') openChest();
}

/* ---------------------------- DESENHO ---------------------------- */
function sprDraw(s, x, y, flip, white, sc = 1, sy = 1) {
  const w = s.w * sc, h = s.h * sc * sy;
  ctx.drawImage(white ? s.white : flip ? s.flip : s.img, Math.round(x - w / 2), Math.round(y + (s.h * sc) / 2 - h), w, h);
}
function shadow(x, y, w) { ctx.fillStyle = 'rgba(10,8,25,0.45)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2); }
function line(x0, y0, x1, y1, color) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, guard = 0;
  ctx.fillStyle = color;
  while (guard++ < 600) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function drawGround(cx, cy) {
  ctx.save();
  ctx.translate(-mod(cx, 64), -mod(cy, 64));
  ctx.fillStyle = groundPat; ctx.fillRect(0, 0, VW + 64, VH + 64);
  ctx.restore();
  // decoração determinística por pedaço de mundo
  const C = 80, x0 = Math.floor(cx / C) - 1, x1 = Math.floor((cx + VW) / C) + 1, y0 = Math.floor(cy / C) - 1, y1 = Math.floor((cy + VH) / C) + 1;
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    if (hash(i, j) > 0.55) continue;
    const s = SPR[DECOR[(hash(j, i) * DECOR.length) | 0]];
    const dx = i * C + hash(i * 3, j) * C - cx, dy = j * C + hash(i, j * 5) * C - cy;
    ctx.drawImage(s.img, Math.round(dx), Math.round(dy));
  }
}

function draw() {
  const p = G.p;
  let cx = Math.round(p.x - VW / 2), cy = Math.round(p.y - VH / 2);
  if (G.shake > 0) { cx += Math.round(rnd(-2, 2)); cy += Math.round(rnd(-2, 2)); }
  drawGround(cx, cy);
  ctx.save();
  ctx.translate(-cx, -cy);

  // zonas de fogo
  for (const z of G.zones) {
    const a = Math.min(1, z.life / 0.4);
    ctx.globalAlpha = 0.25 * a; ctx.fillStyle = z.evo ? PAL.P : PAL.r;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = a;
    for (let i = 0; i < z.r * 0.9; i++) {
      const ang = Math.random() * TAU, rr = Math.sqrt(Math.random()) * z.r;
      ctx.fillStyle = pick(z.evo ? [PAL.P, PAL.y, PAL.w] : [PAL.R, PAL.y, PAL.r]);
      ctx.fillRect(Math.round(z.x + Math.cos(ang) * rr), Math.round(z.y + Math.sin(ang) * rr * 0.75 - Math.random() * 4), 1, 2);
    }
    ctx.globalAlpha = 1;
  }

  // aura
  for (const w of G.weapons) if (w.id === 'aura' && w.R) {
    ctx.globalAlpha = 0.16 + Math.sin(G.t * 4) * 0.04;
    ctx.fillStyle = w.evo ? PAL.g : PAL.y;
    ctx.beginPath(); ctx.arc(p.x, p.y, w.R, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.fillStyle = w.evo ? PAL.g : PAL.y;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + G.t; ctx.fillRect(Math.round(p.x + Math.cos(a) * w.R), Math.round(p.y + Math.sin(a) * w.R), 1, 1); }
    ctx.globalAlpha = 1;
  }

  // coletáveis
  for (const it of G.pickups) {
    if (Math.abs(it.x - p.x) > VW / 2 + 10 || Math.abs(it.y - p.y) > VH / 2 + 10) continue;
    const bob = Math.round(Math.sin(G.t * 5 + it.x) * 1);
    if (it.k === 'xp') ctx.drawImage((it.v >= 10 ? SPR.gemaR : it.v >= 3 ? SPR.gemaV : SPR.gema).img, Math.round(it.x - 2), Math.round(it.y - 3 + bob));
    else if (it.k === 'bau') {
      ctx.globalAlpha = 0.3 + Math.sin(G.t * 6) * 0.2; ctx.fillStyle = PAL.y;
      ctx.beginPath(); ctx.arc(it.x, it.y, 9, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      sprDraw(SPR.bau, it.x, it.y + bob);
    } else sprDraw(SPR[it.k], it.x, it.y + bob);
  }

  // inimigos e jogador ordenados por profundidade
  const list = [];
  for (const e of G.enemies) if (Math.abs(e.x - p.x) < VW / 2 + 30 && Math.abs(e.y - p.y) < VH / 2 + 40) list.push(e);
  list.push(p);
  list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e === p) { drawPlayer(); continue; }
    const s = e.spr, sc = e.sc;
    shadow(e.x, e.y + (s.h * sc) / 2 - 1, s.w * sc * 0.7);
    if (e.d.ghost) ctx.globalAlpha = 0.72;
    let sy = 1, y = e.y;
    if (e.d.fly) sy = Math.sin(G.t * 18 + e.ph) > 0 ? 1 : 0.6;
    else y += Math.round(Math.sin(G.t * 8 + e.ph) * 0.6);
    if (e.d.elite) { ctx.globalAlpha = 0.35; ctx.fillStyle = PAL.r; ctx.beginPath(); ctx.arc(e.x, e.y, 11, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    sprDraw(s, e.x, y, e.face < 0, e.flash > 0, sc, sy);
    if (e.d.boss) {
      // foice do ceifador
      const hx = e.x + e.face * 12, hy = e.y - 4;
      line(hx, hy + 18, hx, hy - 16, PAL.n);
      line(hx, hy - 16, hx - e.face * 14, hy - 10, PAL.E);
      line(hx, hy - 15, hx - e.face * 12, hy - 9, PAL.w);
    }
    ctx.globalAlpha = 1;
  }

  // orbes
  for (const w of G.weapons) if (w.orbs) for (const [ox, oy] of w.orbs) {
    const r = Math.round(3 * w.s.area);
    ctx.globalAlpha = 0.35; ctx.fillStyle = w.evo ? PAL.c : PAL.y;
    ctx.beginPath(); ctx.arc(ox, oy, r + 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = w.evo ? PAL.B : PAL.R;
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.w; ctx.fillRect(Math.round(ox - 1), Math.round(oy - 1), 1, 1);
  }

  // projéteis
  for (const pr of G.projs) {
    if (pr.k === 'missil') {
      ctx.fillStyle = pr.evo ? PAL.P : PAL.B; ctx.fillRect(Math.round(pr.x - 2), Math.round(pr.y - 2), 4, 4);
      ctx.fillStyle = PAL.w; ctx.fillRect(Math.round(pr.x - 1), Math.round(pr.y - 1), 2, 2);
    } else if (pr.k === 'flecha') {
      const l = Math.hypot(pr.vx, pr.vy), ux = pr.vx / l, uy = pr.vy / l;
      line(pr.x - ux * 7, pr.y - uy * 7, pr.x, pr.y, pr.evo ? PAL.y : PAL.n);
      line(pr.x - ux * 2, pr.y - uy * 2, pr.x, pr.y, PAL.w);
      ctx.fillStyle = PAL.r; ctx.fillRect(Math.round(pr.x - ux * 7), Math.round(pr.y - uy * 7), 1, 1);
    } else if (pr.k === 'machado' || pr.k === 'foice' || pr.k === 'frasco') {
      const s = SPR[pr.k === 'frasco' ? 'fogo' : pr.k + (pr.evo ? 'Evo' : '')], sc = pr.sc || 1;
      ctx.save(); ctx.translate(Math.round(pr.x), Math.round(pr.y)); ctx.rotate(pr.rot || pr.age * 10 || 0);
      const w = Math.round(s.w * sc), h = Math.round(s.h * sc);
      ctx.drawImage(s.img, -w / 2, -h / 2, w, h); ctx.restore();
    }
  }

  // efeitos
  for (const f of G.effects) {
    const a = f.life / f.max;
    if (f.k === 'slash') {
      const x = p.x + f.ox, y = p.y + f.oy;
      ctx.globalAlpha = a; ctx.lineWidth = 2;
      const cols = f.evo ? [PAL.y, PAL.w] : [PAL.E, PAL.w];
      for (let i = 0; i < 2; i++) {
        ctx.strokeStyle = cols[i];
        ctx.beginPath();
        const rx = f.w / 2 - i * 3, ry = f.h / 2 - i * 2;
        if (f.dx) ctx.ellipse(x - f.dx * 4, y, Math.max(1, rx), Math.max(1, ry), 0, f.dx > 0 ? -1.3 : Math.PI - 1.3, f.dx > 0 ? 1.3 : Math.PI + 1.3);
        else ctx.ellipse(x, y - f.dy * 4, Math.max(1, rx), Math.max(1, ry), 0, f.dy > 0 ? 0.3 : Math.PI + 0.3, f.dy > 0 ? Math.PI - 0.3 : TAU - 0.3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (f.k === 'bolt') {
      ctx.globalAlpha = a;
      for (let i = 1; i < f.pts.length; i++) {
        line(f.pts[i - 1][0] + 1, f.pts[i - 1][1], f.pts[i][0] + 1, f.pts[i][1], PAL.B);
        line(f.pts[i - 1][0], f.pts[i - 1][1], f.pts[i][0], f.pts[i][1], PAL.w);
      }
      ctx.fillStyle = PAL.c; ctx.globalAlpha = a * 0.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, 10 * (1.3 - a), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (f.k === 'chain') {
      ctx.globalAlpha = a; line(f.x1, f.y1, f.x2, f.y2, PAL.c); ctx.globalAlpha = 1;
    }
  }

  // partículas
  for (const q of G.parts) { ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
  // números de dano
  for (const n of G.nums) { ctx.globalAlpha = Math.min(1, n.life * 3); drawNum(n.v, n.x, n.y, n.color); }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.drawImage(vignette, 0, 0);
  if (G.p.hurt > 0) { ctx.fillStyle = 'rgba(177,62,83,0.22)'; ctx.fillRect(0, 0, VW, VH); }
}

function drawPlayer() {
  const p = G.p, s = SPR[CLASSES[G.cls].spr];
  shadow(p.x, p.y + s.h / 2 - 1, 9);
  const bob = p.moving ? (Math.floor(p.anim * 8) % 2) : 0;
  sprDraw(s, p.x, p.y - bob, p.face < 0, p.hurt > 0 && Math.floor(p.hurt * 30) % 2 === 0);
  // barra de vida
  const w = 16, x = Math.round(p.x - w / 2), y = Math.round(p.y + s.h / 2 + 2);
  ctx.fillStyle = PAL.k; ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = PAL.r; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = PAL.g; ctx.fillRect(x, y, Math.round((w * p.hp) / p.maxHp), 2);
}

function drawMenuBg(dt) {
  menuCam += dt * 14;
  drawGround(Math.round(menuCam), Math.round(menuCam * 0.4));
  const t = performance.now() / 1000;
  const list = ['morcego', 'zumbi', 'esqueleto', 'fantasma', 'slime', 'morcego', 'esqueleto'];
  list.forEach((k, i) => {
    const s = SPR[k], x = mod(i * 47 + t * (12 + i * 3), VW + 40) - 20, y = VH * 0.78 + Math.sin(i * 2.1) * 18;
    ctx.globalAlpha = k === 'fantasma' ? 0.7 : 1;
    sprDraw(s, x, y + Math.round(Math.sin(t * 6 + i)), false, false);
  });
  ctx.globalAlpha = 1;
  ctx.drawImage(vignette, 0, 0);
}

/* ---------------------------- HUD ---------------------------- */
let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function fmtTime(t) { t = Math.floor(t); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
function updateHud() {
  const p = G.p;
  $('#xpfill').style.width = Math.min(100, (p.xp / p.xpNext) * 100) + '%';
  setText('#lvl', 'NV ' + p.lvl);
  setText('#timer', fmtTime(G.t));
  setText('#kills', String(G.kills));
  setText('#goldc', String(G.gold));
  if (G.hudDirty) {
    G.hudDirty = false;
    let h = '';
    for (const w of G.weapons) {
      const ready = canEvolve(w);
      h += `<div class="slot ${w.evo ? 'evo' : ''} ${ready ? 'ready' : ''}"><img class="px" src="${sprURL(SPR[w.id + (w.evo ? 'Evo' : '')], 2)}" alt=""><b>${w.evo ? '★' : w.lvl}</b></div>`;
      if (ready && !G.readyToast[w.id]) { G.readyToast[w.id] = true; toast('COMBO PRONTO! Abra um baú para evoluir ' + WEAPONS[w.id].nome); }
    }
    for (const id in G.passives) h += `<div class="slot"><img class="px" src="${sprURL(SPR[id], 2)}" alt=""><b>${G.passives[id]}</b></div>`;
    $('#inv').innerHTML = h;
  }
}
let toastT = 0;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2800);
}

/* ---------------------------- TELAS ---------------------------- */
function show(html, solid) { $('#screen').innerHTML = `<div class="scr ${solid ? 'solid' : ''}">${html}</div>`; }
function hide() { $('#screen').innerHTML = ''; }
const icon = (k, sc = 4) => `<img class="px" src="${sprURL(SPR[k], sc)}" alt="">`;

function menuScreen() {
  state = 'menu'; G = null;
  $('#hud').hidden = true; $('#bossbar').hidden = true;
  show(`
    <div class="logo"><h1>SOBREVIVENTES<em>DA NOITE</em></h1><p>Sobreviva 10 minutos e derrote o Ceifador</p></div>
    <div class="spacer"></div>
    <div class="col">
      <button class="btn main" data-act="classes">JOGAR</button>
      <button class="btn" data-act="shop">LOJA</button>
      <button class="btn" data-act="codex">LIVRO DE COMBOS</button>
      <button class="btn small" data-act="mute">SOM: ${muted ? 'DESLIGADO' : 'LIGADO'}</button>
    </div>
    <div class="row"><span class="gold">${SAVE.gold}</span>${SAVE.best ? `<span class="hint">Recorde: ${fmtTime(SAVE.best)}${SAVE.wins ? ' · Vitórias: ' + SAVE.wins : ''}</span>` : ''}</div>
    <div class="spacer"></div>`, true);
}

function classScreen() {
  let h = '<h2>ESCOLHA SUA CLASSE</h2><div class="classes">';
  for (const id in CLASSES) {
    const c = CLASSES[id], ok = SAVE.unlocked[id];
    h += `<button class="cls ${ok ? '' : 'locked'}" data-act="${ok ? 'start' : 'unlock'}" data-arg="${id}">
      ${icon(c.spr, 6)}<span class="nm">${c.nome}</span>
      <span class="wp">${icon(c.arma, 2)}${WEAPONS[c.arma].nome}</span>
      <span class="ds">${c.ds}<br>Vida ${c.hp}</span>
      ${ok ? '' : `<span class="gold">${c.custo} para liberar</span>`}
    </button>`;
  }
  h += `</div><span class="gold">${SAVE.gold}</span><button class="btn small" data-act="menu">VOLTAR</button>`;
  show(h);
}

function shopScreen() {
  let h = `<h2>LOJA</h2><p class="sub">Melhorias permanentes para todas as partidas.</p><span class="gold">${SAVE.gold}</span><div class="shop">`;
  for (const id in SHOP) {
    const it = SHOP[id], l = SAVE.shop[id] || 0, cost = it.base * (l + 1), max = l >= it.max;
    h += `<div class="shopi"><div><div class="nm">${it.nome}</div><div class="ds">${it.d}</div></div>
      <button class="btn small" data-act="buy" data-arg="${id}" ${max || SAVE.gold < cost ? 'disabled' : ''}>${max ? 'MÁX' : '● ' + cost}</button>
      <div class="pips">${Array.from({ length: it.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>`;
  }
  h += '</div><button class="btn small" data-act="menu">VOLTAR</button>';
  show(h);
}

function codexHtml() {
  let h = '';
  for (const id in WEAPONS) {
    const d = WEAPONS[id], done = SAVE.evos[id];
    h += `<div class="combo ${done ? 'done' : ''}">${icon(id, 4)}<span class="op">+</span>${icon(d.req, 4)}<span class="op">=</span>
      <div class="txt"><b>${d.evoNome}${done ? ' ✓' : ''}</b>${d.nome} no nível máximo + ${PASSIVES[d.req].nome}. ${d.evoD}</div></div>`;
  }
  return h;
}
function codexScreen() {
  show(`<h2>LIVRO DE COMBOS</h2><p class="sub">Leve uma arma ao nível máximo, tenha o item indicado e abra um baú de golem.</p>${codexHtml()}<button class="btn small" data-act="menu">VOLTAR</button>`);
}

function buildHtml() {
  let h = '<div class="build">';
  for (const w of G.weapons) h += `<div>${icon(w.id + (w.evo ? 'Evo' : ''), 3)}<b>${w.evo ? '★' : w.lvl}</b></div>`;
  for (const id in G.passives) h += `<div>${icon(id, 3)}<b>${G.passives[id]}</b></div>`;
  return h + '</div>';
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  show(`<h2>PAUSADO</h2>${buildHtml()}
    <div class="col"><button class="btn main" data-act="resume">CONTINUAR</button>
    <button class="btn small" data-act="mute">SOM: ${muted ? 'DESLIGADO' : 'LIGADO'}</button>
    <button class="btn small" data-act="quit">DESISTIR</button></div>
    <p class="sub">Combos</p>${codexHtml()}`);
}

/* --- subir de nível --- */
let choices = [];
function buildChoices() {
  const opts = [];
  for (const w of G.weapons) if (!w.evo && w.lvl < WEAPONS[w.id].L.length) opts.push({ k: 'w', id: w.id, wt: 3 });
  for (const id in G.passives) if (G.passives[id] < PASSIVES[id].max) opts.push({ k: 'p', id, wt: 2.5 });
  if (G.weapons.length < 6) for (const id in WEAPONS) if (!G.weapons.some(w => w.id === id)) opts.push({ k: 'w', id, novo: true, wt: 1 });
  if (Object.keys(G.passives).length < 6) for (const id in PASSIVES) if (!G.passives[id]) opts.push({ k: 'p', id, novo: true, wt: 1 });
  const out = [];
  while (out.length < 3 && opts.length) {
    let tot = 0; for (const o of opts) tot += o.wt;
    let r = Math.random() * tot, i = 0;
    for (; i < opts.length - 1; i++) { r -= opts[i].wt; if (r <= 0) break; }
    out.push(opts.splice(i, 1)[0]);
  }
  if (!out.length) out.push({ k: 'heal' }, { k: 'gold' });
  return out;
}
function choiceCard(o, i) {
  if (o.k === 'heal') return `<button class="card" data-act="choose" data-arg="${i}">${icon('frango', 5)}<span class="nm">Frango Assado</span><span class="ds">Recupera 50 de vida.</span></button>`;
  if (o.k === 'gold') return `<button class="card" data-act="choose" data-arg="${i}">${icon('moeda', 7)}<span class="nm">Saco de Ouro</span><span class="ds">+25 de ouro.</span></button>`;
  if (o.k === 'w') {
    const d = WEAPONS[o.id], w = G.weapons.find(x => x.id === o.id), lvl = w ? w.lvl + 1 : 1;
    const req = PASSIVES[d.req];
    return `<button class="card" data-act="choose" data-arg="${i}">${icon(o.id, 5)}
      <span class="nm">${d.nome}<i>${o.novo ? 'NOVA!' : 'NV ' + lvl}</i></span>
      <span class="ds">${d.d[lvl - 1]}</span>
      <span class="tag">Combo: + ${req.nome} = ${d.evoNome}</span></button>`;
  }
  const d = PASSIVES[o.id], lvl = (G.passives[o.id] || 0) + 1;
  const combos = Object.keys(WEAPONS).filter(k => WEAPONS[k].req === o.id).map(k => WEAPONS[k].evoNome);
  return `<button class="card" data-act="choose" data-arg="${i}">${icon(o.id, 5)}
    <span class="nm">${d.nome}<i>${o.novo ? 'NOVO!' : 'NV ' + lvl}</i></span>
    <span class="ds">${d.d}</span>
    <span class="tag">${combos.length ? 'Combo: ' + combos.join(', ') : '&nbsp;'}</span></button>`;
}
function openLevelUp() {
  state = 'levelup'; sfx('lvl');
  choices = buildChoices();
  show(`<h2>SUBIU DE NÍVEL!</h2><p class="sub">Nível ${G.p.lvl - G.pendingLevels + 1} — escolha uma melhoria</p>
    <div class="cards">${choices.map(choiceCard).join('')}</div>`);
}
function applyChoice(o) {
  if (o.k === 'heal') healPlayer(50);
  else if (o.k === 'gold') G.gold += 25;
  else if (o.k === 'w') {
    const w = G.weapons.find(x => x.id === o.id);
    if (w) w.lvl++; else addWeapon(o.id);
  } else G.passives[o.id] = (G.passives[o.id] || 0) + 1;
  recalc();
}

/* --- baú --- */
function openChest() {
  state = 'chest'; sfx('chest');
  const ready = G.weapons.filter(canEvolve);
  let html;
  if (ready.length) {
    const w = ready[0], d = WEAPONS[w.id];
    w.evo = true; w.t = 0; w.until = 0;
    SAVE.evos[w.id] = true; save();
    recalc(); sfx('evo');
    html = `<div class="card evo">${icon(w.id + 'Evo', 5)}<span class="nm">${d.evoNome}<i>COMBO!</i></span><span class="ds">${d.evoD}</span><span class="tag">${d.nome} + ${PASSIVES[d.req].nome}</span></div>`;
  } else {
    const opts = buildChoices().filter(o => o.k !== 'heal' && o.k !== 'gold' && !o.novo);
    const g = Math.round(rnd(15, 35) * G.st.greed);
    G.gold += g;
    if (opts.length) { applyChoice(opts[0]); html = choiceCard(opts[0], 0).replace('data-act="choose"', ''); }
    else html = '';
    html += `<span class="gold">+${g}</span>`;
  }
  show(`${icon('bau', 8).replace('class="px"', 'class="px chestimg"')}<h2>BAÚ DO GOLEM</h2><div class="cards">${html}</div><button class="btn main" data-act="closechest">CONTINUAR</button>`);
}

/* --- fim de partida --- */
function endGame(win) {
  if (G.ended) return;
  G.ended = true;
  if (win) G.gold += 100;
  SAVE.gold += G.gold;
  SAVE.best = Math.max(SAVE.best || 0, Math.floor(G.t));
  if (win) SAVE.wins = (SAVE.wins || 0) + 1;
  save();
  if (!win) sfx('die');
  setTimeout(() => {
    state = 'over';
    show(`<h2>${win ? 'VITÓRIA!' : 'VOCÊ CAIU'}</h2>
      <p class="sub">${win ? 'O Ceifador foi derrotado e a noite acabou.' : 'A noite ainda não acabou. Tente outra build.'}</p>
      <div class="result"><span>Tempo</span><span>${fmtTime(G.t)}</span><span>Nível</span><span>${G.p.lvl}</span>
      <span>Abates</span><span>${G.kills}</span><span>Ouro ganho</span><span>${G.gold}</span></div>
      ${buildHtml()}
      <div class="col"><button class="btn main" data-act="again">JOGAR DE NOVO</button><button class="btn small" data-act="menu">MENU</button></div>`);
  }, win ? 0 : 900);
}

function startGame(cls) {
  initAudio();
  newGame(cls);
  hudCache = {};
  $('#hud').hidden = false; $('#bossbar').hidden = true;
  hide(); state = 'play';
  toast(matchMedia('(pointer: coarse)').matches ? 'Arraste o dedo na tela para andar' : 'Use WASD ou as setas para andar');
}

/* ---------------------------- AÇÕES ---------------------------- */
let lastCls = 'guerreiro';
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  initAudio();
  const a = b.dataset.act, arg = b.dataset.arg;
  if (a === 'classes') classScreen();
  else if (a === 'shop') shopScreen();
  else if (a === 'codex') codexScreen();
  else if (a === 'menu') menuScreen();
  else if (a === 'start') { lastCls = arg; startGame(arg); }
  else if (a === 'again') startGame(lastCls);
  else if (a === 'unlock') {
    const c = CLASSES[arg];
    if (SAVE.gold >= c.custo) { SAVE.gold -= c.custo; SAVE.unlocked[arg] = true; save(); sfx('chest'); }
    else toastMenu(`Faltam ${c.custo - SAVE.gold} de ouro para liberar ${c.nome}`);
    classScreen();
  } else if (a === 'buy') {
    const it = SHOP[arg], l = SAVE.shop[arg] || 0, cost = it.base * (l + 1);
    if (l < it.max && SAVE.gold >= cost) { SAVE.gold -= cost; SAVE.shop[arg] = l + 1; save(); sfx('coin'); }
    shopScreen();
  } else if (a === 'mute') {
    muted = !muted;
    try { localStorage.setItem(SAVE_KEY + '_mute', muted ? '1' : '0'); } catch (e) { /* ignora */ }
    b.textContent = 'SOM: ' + (muted ? 'DESLIGADO' : 'LIGADO');
  } else if (a === 'pause') pauseGame();
  else if (a === 'resume') { hide(); state = 'play'; }
  else if (a === 'quit') { hide(); state = 'play'; endGame(false); }
  else if (a === 'choose') {
    if (state !== 'levelup') return;
    applyChoice(choices[+arg]);
    G.pendingLevels--;
    if (G.pendingLevels > 0) openLevelUp(); else { hide(); state = 'play'; }
  } else if (a === 'closechest') { hide(); state = 'play'; }
});
function toastMenu(msg) { const el = $('#toast'); $('#hud').hidden = false; toast(msg); setTimeout(() => { if (state === 'menu') $('#hud').hidden = true; }, 2900); }

/* ---------------------------- CONTROLES ---------------------------- */
const joy = { id: null, ox: 0, oy: 0 };
const joyEl = $('#joy'), knob = $('#knob');
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || joy.id !== null) return;
  joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY;
  joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.hidden = false;
  knob.style.transform = '';
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const l = Math.hypot(dx, dy), max = 42;
  if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  const m = clamp((l - 6) / 28, 0, 1);
  input.jx = l ? (dx / Math.min(l, max)) * m : 0; input.jy = l ? (dy / Math.min(l, max)) * m : 0;
});
function joyEnd(e) {
  if (e.pointerId !== joy.id) return;
  joy.id = null; input.jx = input.jy = 0; joyEl.hidden = true;
}
cv.addEventListener('pointerup', joyEnd);
cv.addEventListener('pointercancel', joyEnd);

function readKeys() {
  input.kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  input.ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
}
addEventListener('keydown', e => {
  keys[e.code] = true; readKeys();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pauseGame(); else if (state === 'pause') { hide(); state = 'play'; } }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; readKeys(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; readKeys(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------------------- LAÇO PRINCIPAL ---------------------------- */
let last = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (ts - last) / 1000 || 0);
  last = ts;
  if (state === 'play') update(dt);
  if (G) draw(); else drawMenuBg(dt);
}
menuScreen();
requestAnimationFrame(loop);

// gancho de teste (usado para validar o jogo automaticamente)
window.__jogo = { get G() { return G; }, get state() { return state; }, update, SAVE, input, recalc, openChest };
