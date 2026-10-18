'use strict';
/* =========================================================================
   SAQUE INFINITO — RPG idle em pixel art com mercado de itens entre jogadores
   O herói luta sozinho numa faixa de batalha; os itens têm raridade, número
   de série e status aleatórios, e podem ser vendidos para outros jogadores.
   ========================================================================= */

const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (a, n) => ((a % n) + n) % n;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0) + 'k';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e8 ? 1 : 0) + 'M';
  return (n / 1e9).toFixed(1) + 'B';
};
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---------------------------- PALETA E SPRITES ---------------------------- */
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
      if (ch === '.') continue;
      const k = (swap && swap[ch]) || ch;
      x.fillStyle = PAL[k] || k; x.fillRect(i, j, 1, 1);
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

const ART = {
  heroi: [
    '....kkkk....', '...kEEEEk...', '..kEEEEEEk..', '..kEkkkkEk..', '..kEcEEcEk..', '..kEEEEEEk..', '...kEEEEk...',
    '..krrEErrk..', '.kEkrrrrkEk.', '.kEkEbbEkEk.', '.kskEEEEksk.', '..kkeeeekk..', '..keek.keek.', '..kkk..kkk..',
  ],
  slime: ['...kkkk...', '..kggggk..', '.kgwggggk.', 'kgggggggGk', 'kgkggkgGGk', 'kgggggGGGk', 'kGGGGGGGGk', '.kkkkkkkk.'],
  morcego: ['k..........k', 'kk..k..k..kk', 'kpk.kkkk.kpk', 'kPpkpypypkPk', '.kPppppppPk.', '..kk.kk.kk..'],
  goblin: ['k..kkkk..k', 'kgkggggkgk', '.kgyggygk.', '..kggggk..', '..kgrrgk..', '...kkkk...', '..knnnnk..', '.kgknnkgk.', '.kgknnkgk.', '..knnnnk..', '..kgkkgk..', '..kk..kk..'],
  lobo: [
    '...........kk.', '..........keEk', 'kk.......keeek', 'kekkkkkkkeeyEkk', '.keeeeeeeeeeEEk', '.keeEEEeeeeekk.',
    '..keeeeeeeek...', '..kek.kek.kek..', '..kk..kk..kk...',
  ],
  esqueleto: [
    '...kkkk...', '..kwwwwk..', '.kwkwwkwk.', '.kwwwwwwk.', '..kwkkwk..', '...kwwk...', '..kkwwkk..', '.kwkwwkwk.',
    '.kwkEEkwk.', '..kkwwkk..', '..kwkkwk..', '..kwk.kwk.', '..kwk.kwk.', '..kk...kk.',
  ],
  fantasma: [
    '...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkcwwkcwk.', '.kwwwwwwwwk.', '.kwwwkkwwwk.',
    '.kwwwwwwwwk.', '.kEwwwwwwEk.', '.kEEwwwwEEk.', '.kEkEwwEkEk.', '..k.kkkk.k..',
  ],
  zumbi: [
    '..kkkkk...', '.kGgggGk..', '.kgkggkk..', '.kgggggk..', '.kGgrrGk..', '..kkkkk...', '.kttttttk.', 'kgktttttkgk',
    'kgkttGttkg.', '.kktttttkk.', '..kNNkNNk..', '..kNk.kNk..', '..kgk.kgk..', '..kk...kk..',
  ],
  golem: [
    '....kkkkkkkk....', '...keeeeeeeek...', '..keEEeeeeEEek..', '..keeyekkeyeek..', '..keeeeeeeeeek..', '..kkeekkkkeekk..',
    '.keekeeeeeekeek.', 'keEEkeEEEEekEEek', 'keEekeeeeeekeEek', 'keeekeeEeeekeeek', '.kkkkeeeeeekkkk.', '....keeeeeek....',
    '...keeekkeeek...', '...keek..keek...', '..keeek..keeek..', '..kkkkk..kkkkk..',
  ],
  necro: [
    '....kkkk....', '...kppppk...', '..kpPPPPpk..', '..kpEEEEpk..', '..kpgEEgpk..', '..kpEkkEpk..', '...kpEEpk...',
    '..kppPPppk..', '.kpPPPPPPpk.', '.kEkPPPPkEk.', '..kpPPPPpk..', '..kpPPPPpk..', '..kppppppk..', '..kkkkkkkk..',
  ],
  ceifador: [
    '.....kkkkkk.....', '....kooooook....', '...kooooooook...', '...kookwwkook...', '...kokwwwwkok...', '...kowrwwrwok...',
    '...kowwwwwwok...', '...koowkkwook...', '..koooooooooook.', '.koooooooooooook', 'kooEooooooooEook', 'koowoooooooowook',
    '.kooooooooooook.', '.kooooooooooook.', '.koooopoooopook.', '..kooppooppook..', '..kpopkopkpopk..', '...k.k..k..k....',
  ],
  // ícones de itens: "E" é a cor da raridade
  espada: ['........Ew', '.......EwE', '......EwE.', '.....EwE..', '....EwE...', '.y.EwE....', '..yEE.....', '..ny......', '.n..y.....', 'n.........'],
  machado: ['..kkk.....', '.kEEEk....', 'kEwwEEk...', 'kEwEEnk...', 'kEEEknk...', '.kkk.n....', '......n...', '.......n..', '........n.', '.........n'],
  cajado: ['....kkk...', '...kEwEk..', '...kEEEk..', '....kkk...', '....n.....', '....n.....', '...n......', '...n......', '..n.......', '..n.......'],
  arco: ['...nnk....', '..n...w...', '.n.....w..', 'n.......E.', 'n........E', 'n.......E.', '.n.....w..', '..n...w...', '...nnk....'],
  elmo: ['..kkkkkk..', '.kEEEEEEk.', 'kEwEEEEEEk', 'kEEEEEEEEk', 'kEkkkkkkEk', 'kEkrkkrkEk', 'kEEEkkEEEk', '.kEEkkEEk.', '..kk..kk..'],
  capuz: ['...kkkk...', '..kEEEEk..', '.kEEEEEEk.', '.kEkkkkEk.', 'kEkkkkkkEk', 'kEkykkykEk', 'kEEkkkkEEk', 'kEEEEEEEEk', '.kkkkkkkk.'],
  peitoral: ['.kk....kk.', 'kEEkkkkEEk', 'kEwEEEEEEk', 'kEEEyyEEEk', '.kEEEEEEk.', '.kEEEEEEk.', '.kEEnnEEk.', '.kEEEEEEk.', '..kkkkkk..'],
  manto: ['...kkkk...', '..kEyyEk..', '.kEEEEEEk.', '.kEwEEEEk.', 'kEEEEEEEEk', 'kEEEEEEEEk', 'kEEEEEEEEk', 'kEkEkkEkEk', '.k.k..k.k.'],
  botas: ['..kkkk....', '..kEEk....', '..kEEk....', '..kEEk....', '..kEEkkk..', '.kEEEEEEk.', '.kEwEEEEk.', '.knnnnnnk.', '..kkkkkk..'],
  anel: ['....kk....', '...kwwk...', '...kEEk...', '....kk....', '..yyyyyy..', '.y......y.', 'y........y', 'y........y', '.y......y.', '..yyyyyy..'],
  amuleto: ['y........y', '.y......y.', '..y....y..', '...y..y...', '....kk....', '...kEEk...', '..kEwEEk..', '..kEEEEk..', '...kEEk...', '....kk....'],
  // cenário
  arbusto: ['...kkk.kk...', '..kGGGkGGk..', '.kGgGGGGgGk.', 'kGGGGtGGGGGk', 'kGtGGGGGtGGk', 'ktGGtGGGGGtk', '.kttttttttk.'],
  arvore: ['....kkkk....', '..kkGGGGkk..', '.kGGgGGGGGk.', 'kGGGGGGtGGGk', 'kGtGGGGGGtGk', '.kGGGtGGGGk.', '..kkGGGGkk..', '....knnk....', '....knnk....', '....knnk....', '...kNnnNk...'],
  lapide: ['..kkkk..', '.kEEEEk.', 'kEEkEEek', 'kEkkkEek', 'kEEkEEek', 'kEEkEEek', 'kEEEEEek', 'keeeeeek'],
  pedra: ['..kkkk..', '.kEEEek.', 'kEwEEeek', 'kEEEeeek', '.kkkkkk.'],
  cristal: ['...kk...', '..kcck..', '.kcBwck.', 'kcBBwcck', '.kcBBck.', '..kkkk..'],
  osso: ['w....w', 'wwwwww', 'w....w'],
};
const SPR = {};
for (const k in ART) SPR[k] = makeSprite(ART[k]);
SPR.slimeRei = makeSprite(ART.slime, { g: 'y', G: 'R', w: 'w' });
SPR.loboAlfa = makeSprite(ART.lobo, { e: 'o', E: 'r', y: 'R' });
SPR.lich = makeSprite(ART.necro, { p: 'k', P: 't', g: 'R' });
SPR.golemRei = makeSprite(ART.golem, { e: 'b', E: 'c', y: 'w' });
SPR.demonio = makeSprite(ART.zumbi, { g: 'R', G: 'r', t: 'p' });

/* ---------------------------- FONTE 3x5 ---------------------------- */
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

/* ---------------------------- DADOS DE ITENS ---------------------------- */
const RAR = [
  { n: 'Comum', c: '#94b0c2', w: 600, mult: 1, scrap: 1, mkt: 1.5 },
  { n: 'Incomum', c: '#a7f070', w: 250, mult: 1.25, scrap: 2.5, mkt: 2 },
  { n: 'Raro', c: '#41a6f6', w: 100, mult: 1.6, scrap: 6, mkt: 3 },
  { n: 'Épico', c: '#b86ef0', w: 38, mult: 2.1, scrap: 15, mkt: 4 },
  { n: 'Lendário', c: '#ffcd75', w: 10, mult: 2.8, scrap: 40, mkt: 5 },
  { n: 'Mítico', c: '#ff6b8a', w: 2, mult: 3.8, scrap: 120, mkt: 6 },
];
const SLOTS = { arma: 'Arma', elmo: 'Cabeça', armadura: 'Armadura', botas: 'Botas', anel: 'Anel', amuleto: 'Amuleto' };
const BASES = {
  espada: { n: 'Espada', s: 'arma', p: ['atk', 'crit'] },
  machado: { n: 'Machado', s: 'arma', p: ['atk', 'cdmg'] },
  cajado: { n: 'Cajado', s: 'arma', p: ['atk', 'loot'] },
  arco: { n: 'Arco', s: 'arma', p: ['atk', 'aspd'] },
  elmo: { n: 'Elmo', s: 'elmo', p: ['hp', 'def'] },
  capuz: { n: 'Capuz', s: 'elmo', p: ['hp', 'crit'] },
  peitoral: { n: 'Peitoral', s: 'armadura', p: ['def', 'hp'] },
  manto: { n: 'Manto', s: 'armadura', p: ['hp', 'aspd'] },
  botas: { n: 'Botas', s: 'botas', p: ['aspd', 'def'] },
  anel: { n: 'Anel', s: 'anel', p: ['crit', 'atk'] },
  amuleto: { n: 'Amuleto', s: 'amuleto', p: ['hp', 'gold'] },
};
const STATS = {
  atk: { n: 'Ataque', base: l => 3 + l * 1.8 },
  hp: { n: 'Vida', base: l => 12 + l * 9 },
  def: { n: 'Defesa', base: l => 2 + l * 1.1 },
  crit: { n: 'Crítico', pct: true, base: l => 4 * (1 + l / 60) },
  aspd: { n: 'Vel. de ataque', pct: true, base: l => 6 * (1 + l / 60) },
  cdmg: { n: 'Dano crítico', pct: true, base: l => 15 * (1 + l / 60) },
  gold: { n: 'Ouro extra', pct: true, base: l => 10 * (1 + l / 60) },
  loot: { n: 'Sorte', pct: true, base: l => 6 * (1 + l / 60) },
};
const SUFIX = { atk: 'da Fúria', hp: 'do Urso', def: 'da Muralha', crit: 'da Precisão', aspd: 'do Vento', cdmg: 'do Carrasco', gold: 'da Fortuna', loot: 'da Sorte' };
const MITICOS = {
  espada: 'Aurora Partida', machado: 'Racha-Montanhas', cajado: 'Vara do Eclipse', arco: 'Sussurro Final', elmo: 'Coroa do Rei Caído',
  capuz: 'Véu da Meia-Noite', peitoral: 'Coração de Ferro', manto: 'Manto das Estrelas', botas: 'Passos do Trovão', anel: 'Olho do Abismo', amuleto: 'Lágrima de Dragão',
};
const ICON = {};
for (const b in BASES) ICON[b] = RAR.map(r => makeSprite(ART[b], { E: r.c }));
const icon = (it, sc = 4) => sprURL(ICON[it.b][it.r], sc);

function itemName(it) {
  if (it.r === 5) return MITICOS[it.b];
  return BASES[it.b].n + (it.r >= 2 && it.sx ? ' ' + SUFIX[it.sx] : '');
}
function maxStat(k, l, r) { return Math.ceil(STATS[k].base(l) * RAR[r].mult * 1.16) + 1; }
function makeItem(l, r, b) {
  b = b || pick(Object.keys(BASES));
  const base = BASES[b], st = {};
  const roll = (k, wgt) => {
    const v = STATS[k].base(l) * RAR[r].mult * wgt * rnd(0.85, 1.15);
    st[k] = (st[k] || 0) + Math.max(1, Math.round(v));
  };
  roll(base.p[0], 1); roll(base.p[1], 0.5);
  const pool = Object.keys(STATS).filter(k => !base.p.includes(k));
  let sx = null;
  for (let i = 0; i < r && pool.length; i++) {
    const k = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    roll(k, 0.45); if (!sx) sx = k;
  }
  for (const k in st) st[k] = Math.min(st[k], maxStat(k, l, r));
  return { id: rid(), b, r, l, st, sx, m: 1 + ((Math.random() * 9999) | 0) };
}
// valida um item vindo de outro jogador: só aceita campos conhecidos e status possíveis
function cleanItem(o) {
  if (!o || typeof o !== 'object' || !BASES[o.b]) return null;
  const r = clamp(o.r | 0, 0, 5), l = clamp(o.l | 0, 1, 9999), st = {};
  if (o.st && typeof o.st === 'object') for (const k in o.st) {
    const v = +o.st[k];
    if (STATS[k] && Number.isFinite(v) && v > 0) st[k] = Math.min(Math.round(v), maxStat(k, l, r));
  }
  const id = typeof o.id === 'string' && /^[a-z0-9]{6,20}$/.test(o.id) ? o.id : rid();
  return { id, b: o.b, r, l, st, sx: STATS[o.sx] ? o.sx : null, m: clamp(o.m | 0, 1, 9999) };
}
const scrapValue = it => Math.round((4 + it.l * 2.5) * RAR[it.r].scrap);
const fairPrice = it => Math.max(5, Math.round(scrapValue(it) * RAR[it.r].mkt));
const FEE = 0.05;
const net = p => Math.floor(p * (1 - FEE));
function statLine(it, max = 3) {
  return Object.entries(it.st).slice(0, max).map(([k, v]) => `+${v}${STATS[k].pct ? '%' : ''} ${STATS[k].n}`).join(' · ');
}

/* ---------------------------- MUNDO ---------------------------- */
const BIOMES = [
  { n: 'Campos Verdes', sky: ['#3b5dc9', '#73eff7'], hill: '#257179', ground: '#38b764', dirt: '#257179', mobs: ['slime', 'morcego'], boss: 'slimeRei', deco: ['arbusto', 'arvore', 'pedra'] },
  { n: 'Floresta Sombria', sky: ['#1a1c2c', '#29366f'], hill: '#1b2b2a', ground: '#257179', dirt: '#1a1c2c', mobs: ['goblin', 'lobo'], boss: 'loboAlfa', deco: ['arvore', 'arvore', 'arbusto'] },
  { n: 'Cripta Esquecida', sky: ['#1a1c2c', '#5d275d'], hill: '#333c57', ground: '#566c86', dirt: '#333c57', mobs: ['esqueleto', 'fantasma'], boss: 'lich', deco: ['lapide', 'osso', 'lapide'] },
  { n: 'Picos Gelados', sky: ['#41a6f6', '#f4f4f4'], hill: '#94b0c2', ground: '#f4f4f4', dirt: '#94b0c2', mobs: ['golem', 'morcego'], boss: 'golemRei', deco: ['pedra', 'cristal', 'pedra'] },
  { n: 'Terras de Cinza', sky: ['#5d275d', '#ef7d57'], hill: '#333c57', ground: '#5a3a1e', dirt: '#1a1c2c', mobs: ['zumbi', 'demonio'], boss: 'ceifador', deco: ['osso', 'pedra', 'lapide'] },
];
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII'];
const biomeOf = z => BIOMES[Math.floor((z - 1) / 5) % BIOMES.length];
const zoneName = z => `${z} · ${biomeOf(z).n}${ROMAN[Math.min(7, Math.floor((z - 1) / 25))] || ''}`;
function enemyFor(z, boss) {
  const hp = 18 * Math.pow(1.17, z - 1) * (boss ? 7 : 1);
  return {
    hp, maxHp: hp, atk: 4 * Math.pow(1.14, z - 1) * (boss ? 1.6 : 1), aspd: 0.8,
    gold: 2 * Math.pow(1.16, z - 1) * (boss ? 10 : 1), xp: 4 * Math.pow(1.15, z - 1) * (boss ? 8 : 1),
    boss, spr: SPR[boss ? biomeOf(z).boss : pick(biomeOf(z).mobs)],
  };
}
const xpFor = l => Math.round(15 * Math.pow(1.22, l - 1));

/* ---------------------------- SAVE ---------------------------- */
const SAVE_KEY = 'saque_infinito_v1';
const BAG_MAX = 60;
function freshSave() {
  return {
    v: 1, lvl: 1, xp: 0, gold: 0, zone: 1, maxZone: 1, zk: 0, auto: true, autoScrap: 0,
    equip: { arma: makeItem(1, 0, 'espada') }, bag: [], log: [],
    kills: 0, found: [0, 0, 0, 0, 0, 0], pity: [0, 0, 0, 0, 0], fuse: { ok: 0, fail: 0 }, seen: Date.now(), t: Date.now(),
  };
}
function cleanSave(o) {
  const s = freshSave();
  if (!o || typeof o !== 'object') return s;
  for (const k of ['lvl', 'xp', 'gold', 'zone', 'maxZone', 'zk', 'autoScrap', 'kills', 'seen', 't']) if (Number.isFinite(+o[k])) s[k] = +o[k];
  s.lvl = clamp(s.lvl | 0, 1, 9999); s.zone = clamp(s.zone | 0, 1, 9999); s.maxZone = Math.max(s.zone, s.maxZone | 0);
  s.auto = o.auto !== false;
  s.equip = {};
  if (o.equip) for (const k in SLOTS) { const it = cleanItem(o.equip[k]); if (it && BASES[it.b].s === k) s.equip[k] = it; }
  s.bag = Array.isArray(o.bag) ? o.bag.map(cleanItem).filter(Boolean).slice(0, BAG_MAX) : [];
  s.log = Array.isArray(o.log) ? o.log.filter(e => e && typeof e === 'object').slice(0, 30).map(e => ({ k: e.k === 'compra' ? 'compra' : 'venda', b: BASES[e.b] ? e.b : 'espada', r: clamp(e.r | 0, 0, 5), n: String(e.n || '').slice(0, 40), p: +e.p || 0, npc: !!e.npc, t: +e.t || 0 })) : [];
  if (Array.isArray(o.found)) s.found = RAR.map((_, i) => +o.found[i] || 0);
  if (Array.isArray(o.pity)) s.pity = s.pity.map((_, i) => clamp(+o.pity[i] || 0, 0, 1));
  if (o.fuse && typeof o.fuse === 'object') s.fuse = { ok: Math.max(0, +o.fuse.ok || 0), fail: Math.max(0, +o.fuse.fail || 0) };
  return s;
}
let S;
try { S = cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch (e) { S = freshSave(); }
let saveTimer = 0, saveDue = 0;
function saveLocal() {
  S.t = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* sem armazenamento */ }
}
// agenda um save; um save já marcado para antes não é adiado
function saveSoon(ms = 15000) {
  const due = Date.now() + ms;
  if (saveDue && saveDue <= due) return;
  clearTimeout(saveTimer); saveDue = due; saveTimer = setTimeout(saveNow, ms);
}
function saveNow() { clearTimeout(saveTimer); saveDue = 0; saveLocal(); Market.pushSave(); }

/* ---------------------------- STATUS DO HERÓI ---------------------------- */
let ST = null;
function recalc() {
  const L = S.lvl - 1;
  const st = { atk: 8 + 2.2 * L, hp: 60 + 14 * L, def: 1 + 0.6 * L, crit: 5, cdmg: 50, aspd: 0, gold: 0, loot: 0 };
  for (const k in S.equip) { const it = S.equip[k]; if (it) for (const s in it.st) st[s] += it.st[s]; }
  st.crit = Math.min(80, st.crit);
  st.aspdMul = 1 + Math.min(300, st.aspd) / 100;
  st.rate = 1.3 * st.aspdMul;
  st.goldMul = 1 + st.gold / 100;
  st.luck = 1 + st.loot / 100;
  st.dps = st.atk * st.rate * (1 + (st.crit / 100) * (st.cdmg / 100));
  ST = st;
  if (B.hp == null || B.hp > st.hp) B.hp = st.hp;
}

/* ---------------------------- BATALHA ---------------------------- */
const B = { enemy: null, spawnT: 0.6, hp: null, atkT: 0, scroll: 0, walking: true, lunge: 0, swing: 0, hurt: 0, nums: [], drops: [], parts: [], hpShown: 0 };
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 200, H = 100, SC = 2, GY = 80, HX = 50;
let skyCache = {};
function resize() {
  const r = cv.getBoundingClientRect();
  SC = Math.max(2, Math.round(r.width / 210));
  W = Math.ceil(r.width / SC); H = Math.ceil(r.height / SC);
  cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
  GY = H - 16; HX = Math.round(W * 0.28); skyCache = {};
}
addEventListener('resize', resize);

function spawn() {
  const boss = S.zk >= 10 && S.auto;
  const e = enemyFor(S.zone, boss);
  e.x = W + 12; e.atkT = 0.5; e.flash = 0; e.sc = boss ? (e.spr.w > 14 ? 1.5 : 2) : 1;
  B.enemy = e;
}
function addNum(x, y, v, color) { if (B.nums.length < 30) B.nums.push({ x: x + rnd(-3, 3), y, v: Math.max(1, Math.round(v)), color, life: 0.7 }); }
function burst(x, y, color, n = 6) {
  for (let i = 0; i < n; i++) { const a = rnd(Math.PI, Math.PI * 2), v = rnd(15, 45); B.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.6), color }); }
}

function step(dt) {
  const e = B.enemy;
  B.lunge = Math.max(0, B.lunge - dt); B.hurt = Math.max(0, B.hurt - dt); B.swing = Math.max(0, B.swing - dt);
  if (!e) {
    B.walking = true; B.spawnT -= dt;
    if (B.spawnT <= 0) spawn();
  } else {
    const reach = 13 + (e.spr.w * e.sc) / 3;
    if (e.x - HX > reach) { e.x -= 80 * dt; B.walking = true; }
    else {
      B.walking = false;
      B.atkT -= dt;
      if (B.atkT <= 0) {
        B.atkT = 1 / ST.rate;
        const crit = Math.random() * 100 < ST.crit;
        const d = ST.atk * rnd(0.9, 1.1) * (crit ? 1 + ST.cdmg / 100 : 1);
        e.hp -= d; e.flash = 0.08; B.lunge = 0.1; B.swing = 0.18;
        addNum(e.x, GY - e.spr.h * e.sc - 4, d, crit ? PAL.y : PAL.w);
        if (e.hp <= 0) kill(e);
      }
      if (B.enemy) {
        e.atkT -= dt;
        if (e.atkT <= 0) {
          e.atkT = 1 / e.aspd;
          const d = e.atk * (50 / (50 + ST.def));
          B.hp -= d; B.hurt = 0.15;
          addNum(HX, GY - 20, d, PAL.R);
          if (B.hp <= 0) die();
        }
      }
    }
    if (e.flash > 0) e.flash -= dt;
  }
  B.hp = Math.min(ST.hp, B.hp + ST.hp * (B.walking ? 0.06 : 0.01) * dt);
  if (B.walking) B.scroll += 30 * dt;
  for (const n of B.nums) { n.life -= dt; n.y -= 18 * dt; }
  B.nums = B.nums.filter(n => n.life > 0);
  for (const p of B.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
  B.parts = B.parts.filter(p => p.life > 0);
  for (const d of B.drops) { d.t += dt; }
  B.drops = B.drops.filter(d => d.t < 1.4);
}

function kill(e) {
  B.enemy = null; B.spawnT = 0.7;
  burst(e.x, GY - 6, e.boss ? PAL.y : PAL.r, e.boss ? 24 : 8);
  const g = e.gold * ST.goldMul;
  S.gold += g; S.kills++;
  addNum(e.x, GY - 8, g, PAL.y);
  gainXp(e.xp);
  // saque
  const chance = (e.boss ? 1 : 0.16) * Math.min(3, ST.luck);
  if (Math.random() < chance) {
    const it = makeItem(S.zone, rollRarity(ST.luck, e.boss ? 2 : 0));
    B.drops.push({ x: e.x, it, t: 0 });
    gotItem(it);
  }
  if (e.boss) {
    S.zone++; S.maxZone = Math.max(S.maxZone, S.zone); S.zk = 0;
    toast(`Chefe derrotado! Zona ${zoneName(S.zone)}`, RAR[4].c);
    saveSoon(500);
  } else S.zk = Math.min(10, S.zk + 1);
  saveSoon();
}
function die() {
  const boss = B.enemy && B.enemy.boss;
  B.enemy = null; B.spawnT = 1.5; B.hp = ST.hp; S.zk = 0;
  burst(HX, GY - 8, PAL.r, 12);
  toast(boss ? 'O chefe venceu. Junte itens melhores e tente de novo' : 'Seu herói caiu e recomeçou a zona', RAR[5].c);
}
function gainXp(x) {
  S.xp += x;
  let up = false;
  while (S.xp >= xpFor(S.lvl)) { S.xp -= xpFor(S.lvl); S.lvl++; up = true; }
  if (up) { recalc(); B.hp = ST.hp; toast(`Nível ${S.lvl}!`, PAL.B); if (tab === 'heroi') render(); }
}
function rollRarity(luck, floor = 0) {
  const w = RAR.map((r, i) => (i >= 2 ? r.w * luck : r.w));
  let tot = 0; for (let i = floor; i < w.length; i++) tot += w[i];
  let x = Math.random() * tot;
  for (let i = floor; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return floor;
}
function gotItem(it, quiet) {
  S.found[it.r]++;
  if (it.r <= S.autoScrap - 1 || S.bag.length >= BAG_MAX) {
    S.gold += scrapValue(it);
    if (!quiet && S.bag.length >= BAG_MAX && it.r > S.autoScrap - 1) toast('Mochila cheia! Item vendido como sucata', RAR[5].c);
    return false;
  }
  S.bag.push(it);
  if (!quiet && it.r >= 3) toast(`${RAR[it.r].n.toUpperCase()}! ${itemName(it)}`, RAR[it.r].c);
  if (tab === 'mochila') render();
  return true;
}

/* ---------------------------- PROGRESSO OFFLINE ---------------------------- */
function offline(sec) {
  sec = Math.min(sec, 12 * 3600);
  if (sec < 30) return;
  const e = enemyFor(S.zone, false);
  const killT = e.hp / ST.dps + 1.3;
  const kills = Math.floor(sec / killT);
  if (!kills) return;
  const gold = kills * e.gold * ST.goldMul, lvl0 = S.lvl;
  S.gold += gold; S.kills += kills;
  gainXp(kills * e.xp);
  const drops = Math.floor(kills * 0.16 * Math.min(3, ST.luck)), got = [0, 0, 0, 0, 0, 0];
  let scrapGold = 0;
  for (let i = 0; i < Math.min(drops, 300); i++) {
    const it = makeItem(S.zone, rollRarity(ST.luck));
    const before = S.gold;
    if (gotItem(it, true)) got[it.r]++; else scrapGold += S.gold - before;
  }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  const kept = got.map((n, i) => n ? `<span style="color:${RAR[i].c}">${n} ${RAR[i].n.toLowerCase()}</span>` : '').filter(Boolean).join(', ');
  openSheet(`<h3>Enquanto você estava fora</h3>
    <p class="small muted">Seu herói lutou por ${h ? h + 'h ' : ''}${m}min na zona ${S.zone}.</p>
    <div class="stats"><span>Inimigos derrotados</span><span>${fmt(kills)}</span><span>Ouro</span><span>+${fmt(gold + scrapGold)}</span>
    <span>Nível</span><span>${lvl0 === S.lvl ? S.lvl : lvl0 + ' → ' + S.lvl}</span></div>
    <p class="small">${kept ? 'Itens guardados: ' + kept : 'Nenhum item novo guardado.'}</p>
    <div class="row end"><button class="btn gold" data-act="close">COLETAR</button></div>`, RAR[4].c);
  saveSoon(500);
}

/* ---------------------------- DESENHO ---------------------------- */
function sky(bm) {
  const key = bm.n + W + 'x' + H;
  if (skyCache[key]) return skyCache[key];
  const c = mk(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, GY);
  g.addColorStop(0, bm.sky[0]); g.addColorStop(1, bm.sky[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // faixas para dar textura de pixel art
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(26,28,44,0.05)'; x.fillRect(0, Math.round((GY * i) / 6), W, 1); }
  return (skyCache[key] = c);
}
function draw() {
  const bm = biomeOf(S.zone);
  ctx.drawImage(sky(bm), 0, 0);
  // estrelas ou nuvens
  for (let i = 0; i < 14; i++) {
    const x = mod(hash(i, 3) * 400 - B.scroll * 0.05, W + 20) - 10, y = hash(i, 9) * GY * 0.5;
    ctx.fillStyle = 'rgba(244,244,244,0.5)'; ctx.fillRect(Math.round(x), Math.round(y), hash(i, 1) > 0.7 ? 2 : 1, 1);
  }
  // colinas
  ctx.fillStyle = bm.hill;
  for (let x = 0; x < W; x++) {
    const wx = x + B.scroll * 0.25;
    const h = 10 + Math.sin(wx * 0.035) * 6 + Math.sin(wx * 0.013 + 2) * 8;
    ctx.fillRect(x, Math.round(GY - h), 1, Math.ceil(h));
  }
  // cenário
  const off = B.scroll * 0.7, C = 46;
  for (let i = Math.floor(off / C) - 1; i <= Math.floor((off + W) / C) + 1; i++) {
    if (hash(i, 77) > 0.7) continue;
    const s = SPR[bm.deco[(hash(i, 5) * bm.deco.length) | 0]];
    ctx.drawImage(s.img, Math.round(i * C + hash(i, 11) * 20 - off), GY - s.h + 1);
  }
  // chão
  ctx.fillStyle = bm.ground; ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = bm.dirt; ctx.fillRect(0, GY + 3, W, H - GY - 3);
  for (let x = 0; x < W; x += 1) {
    const wx = Math.floor(x + B.scroll);
    if (hash(wx, 1) < 0.25) { ctx.fillStyle = bm.ground; ctx.fillRect(x, GY + 3 + ((hash(wx, 2) * (H - GY - 4)) | 0), 1, 1); }
    if (hash(wx, 4) < 0.15) { ctx.fillStyle = bm.dirt; ctx.fillRect(x, GY - 1, 1, 1); }
  }
  // inimigo
  const e = B.enemy;
  if (e) {
    const s = e.spr, w = s.w * e.sc, h = s.h * e.sc;
    ctx.fillStyle = 'rgba(10,8,25,0.4)'; ctx.fillRect(Math.round(e.x - w * 0.35), GY, Math.round(w * 0.7), 2);
    const bob = Math.round(Math.sin(performance.now() / 120) * (s === SPR.morcego ? 2 : 0.5));
    const y = GY - h + (s === SPR.morcego ? -8 : 0) + bob;
    ctx.drawImage(e.flash > 0 ? s.white : s.img, Math.round(e.x - w / 2), Math.round(y), w, h);
    const bw = e.boss ? 30 : 14, bx = Math.round(e.x - bw / 2), by = Math.round(y - 5);
    ctx.fillStyle = PAL.k; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
    ctx.fillStyle = PAL.r; ctx.fillRect(bx, by, Math.max(0, Math.round((bw * e.hp) / e.maxHp)), 2);
  }
  // herói
  const hs = SPR.heroi, walk = B.walking ? Math.floor(performance.now() / 140) % 2 : 0;
  const hx = HX + (B.lunge > 0 ? 3 : 0), hy = GY - hs.h - walk;
  ctx.fillStyle = 'rgba(10,8,25,0.4)'; ctx.fillRect(HX - 5, GY, 10, 2);
  ctx.drawImage(B.hurt > 0 && Math.floor(B.hurt * 40) % 2 ? hs.white : hs.img, Math.round(hx - hs.w / 2), hy);
  const wpn = S.equip.arma;
  if (wpn) {
    const ws = ICON[wpn.b][wpn.r];
    const ang = B.swing > 0 ? -0.6 + (1 - B.swing / 0.18) * 2.2 : -0.35;
    ctx.save(); ctx.translate(Math.round(hx + 5), Math.round(hy + 9)); ctx.rotate(ang);
    ctx.drawImage(ws.img, -2, -ws.h + 2); ctx.restore();
  }
  const bw = 16, bx = HX - 8, by = GY + 4;
  ctx.fillStyle = PAL.k; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
  ctx.fillStyle = PAL.r; ctx.fillRect(bx, by, bw, 2);
  ctx.fillStyle = PAL.g; ctx.fillRect(bx, by, Math.round((bw * Math.max(0, B.hp)) / ST.hp), 2);
  // itens caindo
  for (const d of B.drops) {
    const s = ICON[d.it.b][d.it.r], f = Math.min(1, d.t / 0.5);
    const x = d.x - f * 12, y = GY - 12 - Math.sin(f * Math.PI) * 18 - (d.t > 0.9 ? (d.t - 0.9) * 40 : 0);
    if (d.it.r >= 3) { ctx.globalAlpha = 0.35; ctx.fillStyle = RAR[d.it.r].c; ctx.fillRect(Math.round(x - 1), 0, 3, GY); ctx.globalAlpha = 1; }
    ctx.globalAlpha = d.t > 0.9 ? Math.max(0, 1 - (d.t - 0.9) * 2) : 1;
    ctx.drawImage(s.img, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
    ctx.globalAlpha = 1;
  }
  for (const p of B.parts) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  for (const n of B.nums) {
    ctx.globalAlpha = Math.min(1, n.life * 3);
    const s = String(n.v > 99999 ? fmt(n.v).replace(/\D/g, '') : n.v), d = digits(n.color);
    for (let i = 0; i < s.length; i++) ctx.drawImage(d[+s[i]], Math.round(n.x - s.length * 2 + i * 4), Math.round(n.y));
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------- MERCADO ----------------------------
   Dois modos com a mesma interface:
   - "shared": anúncios num banco compartilhado (quando a página roda no claude.ai)
   - "local": só os mercadores simulados (arquivo aberto direto ou sem permissão de escrita)
   Mercadores NPC sempre vendem itens e também compram anúncios com preço justo,
   para o mercado nunca ficar parado. Para lançar o jogo de verdade, troque a
   parte "shared" por um servidor que valide cada compra (ver README). */
const NPC_NAMES = ['Mercador Zé', 'Dona Brisa', 'Velho Otto', 'Irmã Lume', 'Caravana Sul', 'Ferreiro Bento', 'Ladina Kira', 'Barão Fino'];
const NPC_KEY = SAVE_KEY + '_npc', LOCAL_KEY = SAVE_KEY + '_mkt';
const Market = {
  mode: 'local', db: null, user: null, me: 'eu', tab: rid(),
  npc: [], players: [], names: {}, busy: new Set(), ready: false,
  async init() {
    try { const o = JSON.parse(localStorage.getItem(NPC_KEY)); if (o && Array.isArray(o.list)) this.npc = o.list.map(l => this.cleanListing(l, true)).filter(Boolean); } catch (e) { /* vazio */ }
    try { const o = JSON.parse(localStorage.getItem(LOCAL_KEY)); if (Array.isArray(o)) this.players = o.map(l => this.cleanListing(l)).filter(Boolean); } catch (e) { /* vazio */ }
    this.refreshNpc(true);
    setInterval(() => { this.refreshNpc(false); this.npcBuyers(); }, 20000);
    if (window.claude && typeof window.claude.use === 'function') {
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (db && user) {
          const [id, can] = await Promise.all([user.id(), user.can('data.write')]);
          if (id && can !== false) { this.db = db; this.user = user; this.me = id; this.mode = 'shared'; this.players = []; }
        }
      } catch (e) { /* segue no modo local */ }
    }
    if (this.mode === 'shared') { await this.loadCloudSave(); this.subscribe(); }
    this.ready = true;
    if (tab === 'mercado') render();
  },
  cleanListing(l, npc) {
    if (!l || typeof l !== 'object') return null;
    const item = cleanItem(l.item);
    if (!item) return null;
    return {
      id: typeof l.id === 'string' ? l.id.slice(0, 40) : item.id, item, price: clamp(Math.round(+l.price) || 1, 1, 1e12),
      seller: npc ? 'npc' : String(l.seller || ''), sellerName: npc ? (NPC_NAMES.includes(l.sellerName) ? l.sellerName : NPC_NAMES[0]) : '',
      status: l.status === 'vendido' ? 'vendido' : 'aberto', buyer: l.buyer ? String(l.buyer) : '', t: +l.t || 0, npc: !!npc,
    };
  },
  saveLocalLists() {
    try {
      localStorage.setItem(NPC_KEY, JSON.stringify({ list: this.npc }));
      if (this.mode === 'local') localStorage.setItem(LOCAL_KEY, JSON.stringify(this.players));
    } catch (e) { /* ignora */ }
  },
  refreshNpc(first) {
    const z = S.maxZone, now = Date.now();
    // um item velho sai a cada rodada, e a vitrine volta a ter 10
    if (!first && this.npc.length) this.npc.splice((Math.random() * this.npc.length) | 0, 1);
    this.npc = this.npc.filter(l => now - l.t < 30 * 60000);
    while (this.npc.length < 10) {
      const r = rollRarity(2.5, 1), it = makeItem(clamp(z + ((Math.random() * 5) | 0) - 2, 1, 9999), r);
      this.npc.push({ id: 'npc' + it.id, item: it, price: Math.round(fairPrice(it) * rnd(1.05, 1.7)), seller: 'npc', sellerName: pick(NPC_NAMES), status: 'aberto', t: now - ((Math.random() * 600000) | 0), npc: true });
    }
    this.saveLocalLists();
    if (tab === 'mercado' && !first) render();
  },
  // mercadores compram anúncios de jogadores quando o preço está perto do justo
  npcBuyers() {
    for (const l of this.players.filter(x => x.seller === this.me && x.status === 'aberto' && Date.now() - x.t > 30000)) {
      const p = 0.25 * Math.pow(clamp((fairPrice(l.item) * 1.2) / l.price, 0, 1.5), 3);
      if (Math.random() < p) this.settle(l, true);
    }
  },
  open() {
    return [...this.npc, ...this.players.filter(l => l.status === 'aberto' && l.seller !== this.me)];
  },
  mine() { return this.players.filter(l => l.seller === this.me && l.status === 'aberto'); },
  displayName(l) { return l.npc ? l.sellerName : (this.names[l.seller] || 'Jogador'); },

  /* ---- ações ---- */
  async list(it, price) {
    price = clamp(Math.round(price), 1, 1e12);
    const idx = S.bag.findIndex(x => x.id === it.id);
    if (idx < 0) return 'Item não está na mochila';
    S.bag.splice(idx, 1);
    const l = { id: it.id, item: it, price, seller: this.me, status: 'aberto', t: Date.now() };
    if (this.mode === 'shared') {
      try { await this.db.collection('mercado').doc(it.id).set(l); }
      catch (e) { S.bag.push(it); return e && e.code === 'quota_exceeded' ? 'O mercado está cheio agora. Tente mais tarde.' : 'Não foi possível anunciar. Verifique sua conexão.'; }
      this.players = [...this.players.filter(x => x.id !== l.id), { ...l, npc: false }];
    } else this.players.push({ ...l, npc: false });
    this.saveLocalLists(); saveNow();
    return null;
  },
  async cancel(l) {
    if (this.mode === 'shared') {
      const ref = this.db.doc('mercado/' + l.id);
      try {
        const lease = await ref.acquire({ holder: this.me + ':' + this.tab, ttlMs: 6000 });
        if (!lease.acquired) return 'Alguém está comprando este item agora';
        const snap = await ref.get(), d = snap.exists ? snap.data() : null;
        if (!d || d.seller !== this.me) return 'Anúncio não encontrado';
        if (d.status !== 'aberto') return 'Este item acabou de ser vendido';
        await ref.delete();
      } catch (e) { return 'Não foi possível cancelar. Tente de novo.'; }
    }
    this.players = this.players.filter(x => x.id !== l.id);
    if (S.bag.length >= BAG_MAX) S.gold += scrapValue(l.item); else S.bag.push(l.item);
    this.saveLocalLists(); saveNow();
    return null;
  },
  async buy(l) {
    if (S.gold < l.price) return 'Ouro insuficiente';
    if (S.bag.length >= BAG_MAX) return 'Mochila cheia';
    if (!l.npc && this.mode === 'shared') {
      const ref = this.db.doc('mercado/' + l.id);
      try {
        const lease = await ref.acquire({ holder: this.me + ':' + this.tab, ttlMs: 8000 });
        if (!lease.acquired) return 'Outra pessoa está comprando este item. Tente de novo em instantes.';
        const snap = await ref.get(), d = snap.exists ? snap.data() : null;
        if (!d || d.status !== 'aberto') return 'Este item já foi vendido';
        if (+d.price !== l.price) return 'O preço mudou. Confira o anúncio de novo.';
        await ref.update({ status: 'vendido', buyer: this.me, sold: Date.now() });
      } catch (e) { return 'Não foi possível comprar. Verifique sua conexão.'; }
    }
    S.gold -= l.price;
    S.bag.push(l.item);
    if (l.npc) this.npc = this.npc.filter(x => x.id !== l.id);
    else if (this.mode === 'local') this.players = this.players.filter(x => x.id !== l.id);
    logTrade('compra', l.item, l.price, l.npc);
    this.saveLocalLists(); saveNow();
    return null;
  },
  // o vendedor recebe o ouro: por um jogador (anúncio marcado "vendido") ou por um mercador NPC
  async settle(l, byNpc) {
    if (this.busy.has(l.id)) return;
    this.busy.add(l.id);
    try {
      if (this.mode === 'shared') {
        const ref = this.db.doc('mercado/' + l.id);
        const lease = await ref.acquire({ holder: this.me + ':' + this.tab, ttlMs: 6000 });
        if (!lease.acquired) return;
        const snap = await ref.get(), d = snap.exists ? snap.data() : null;
        if (!d || d.seller !== this.me) return;
        if (byNpc ? d.status !== 'aberto' : d.status !== 'vendido') return;
        await ref.delete();
      }
      this.players = this.players.filter(x => x.id !== l.id);
      S.gold += net(l.price);
      logTrade('venda', l.item, net(l.price), byNpc);
      toast(`Vendido! ${itemName(l.item)} por ${fmt(net(l.price))} de ouro`, PAL.y);
      this.saveLocalLists(); saveNow();
      if (tab === 'mercado') render();
    } catch (e) { /* tenta de novo no próximo aviso */ } finally { this.busy.delete(l.id); }
  },

  /* ---- banco compartilhado ---- */
  subscribe() {
    this.db.collection('mercado').orderBy('t', 'desc').limit(500).onSnapshot(snap => {
      this.players = snap.docs.map(d => this.cleanListing({ ...d.data(), id: d.id })).filter(Boolean);
      for (const l of this.players) if (l.seller === this.me && l.status === 'vendido') this.settle(l, false);
      this.resolveNames();
      if (tab === 'mercado') render();
    }, () => { this.mode = 'local'; toast('Mercado compartilhado indisponível. Usando mercadores locais.', RAR[5].c); if (tab === 'mercado') render(); });
  },
  async resolveNames() {
    const ids = [...new Set(this.players.map(l => l.seller).filter(id => id && !(id in this.names)))];
    if (!ids.length || !this.user) return;
    const ps = await this.user.profiles(ids);
    for (const id of ids) this.names[id] = (ps[id] && ps[id].name) || 'Jogador';
    if (tab === 'mercado') render();
  },
  cloudRef() { return this.db.doc('data/users/' + this.me + '/save'); },
  async loadCloudSave() {
    try {
      const snap = await this.cloudRef().get();
      if (snap.exists) {
        const cloud = cleanSave(snap.data());
        if (cloud.t > S.t) { S = cloud; recalc(); B.hp = ST.hp; render(); }
      }
      this.pushSave();
    } catch (e) { /* segue com o save local */ }
  },
  pushing: null, again: false,
  async pushSave() {
    if (this.mode !== 'shared') return;
    if (this.pushing) { this.again = true; return; }
    this.pushing = this.cloudRef().set(JSON.parse(JSON.stringify(S))).catch(() => { /* fica no save local */ });
    await this.pushing;
    this.pushing = null;
    if (this.again) { this.again = false; this.pushSave(); }
  },
};
function logTrade(k, it, p, npc) {
  S.log.unshift({ k, b: it.b, r: it.r, n: itemName(it), p, npc, t: Date.now() });
  S.log = S.log.slice(0, 30);
}

/* ---------------------------- FUSÃO ----------------------------
   6 itens da mesma raridade viram 1 item da raridade seguinte.
   Quanto mais alta a raridade, menor a chance. Se falhar, os 6 itens
   se perdem, mas a próxima fusão daquele nível ganha chance extra. */
const FUSE_N = 6;
const PLURAL = ['comuns', 'incomuns', 'raros', 'épicos', 'lendários', 'míticos'];
const FUSE_CHANCE = [0.9, 0.75, 0.55, 0.35, 0.15];   // por raridade de origem
const FUSE_PITY = [0.05, 0.06, 0.08, 0.08, 0.05];    // chance extra a cada falha
const FUSE_COST = [1, 3, 8, 20, 60];
const fuseChance = r => Math.min(0.95, FUSE_CHANCE[r] + S.pity[r]);
const fuseCost = (r, l) => Math.round((10 + l * 4) * FUSE_COST[r]);
let forge = [], forging = false, forgeErr = '';
const forgeItems = () => forge.map(id => S.bag.find(x => x.id === id)).filter(Boolean);
function forgeLevel(items) { return Math.max(1, Math.round(items.reduce((a, it) => a + it.l, 0) / items.length)); }
function forgePick(id) {
  const it = S.bag.find(x => x.id === id);
  if (!it || it.r >= 5) return;
  const cur = forgeItems();
  if (forge.includes(id)) forge = forge.filter(x => x !== id);
  else if (cur.length && cur[0].r !== it.r) forge = [id];
  else if (cur.length < FUSE_N) forge.push(id);
}
// preenche com os itens mais fracos da raridade que tem mais cópias
function forgeAuto() {
  const cur = forgeItems();
  let r = cur.length ? cur[0].r : -1;
  if (r < 0) {
    const n = [0, 0, 0, 0, 0];
    for (const it of S.bag) if (it.r < 5) n[it.r]++;
    r = n.findIndex(c => c >= FUSE_N);
    if (r < 0) return 'Você precisa de 6 itens da mesma raridade';
  }
  const pool = S.bag.filter(it => it.r === r && !forge.includes(it.id)).sort((a, b) => a.l - b.l);
  while (forge.length < FUSE_N && pool.length) forge.push(pool.shift().id);
  return forge.length < FUSE_N ? `Faltam ${FUSE_N - forge.length} itens ${PLURAL[r]}` : null;
}
function doFuse() {
  const items = forgeItems();
  if (items.length !== FUSE_N || forging) return null;
  const r = items[0].r;
  if (r >= 5 || items.some(it => it.r !== r)) return null;
  const l = forgeLevel(items), cost = fuseCost(r, l);
  if (S.gold < cost) return null;
  S.gold -= cost;
  S.bag = S.bag.filter(it => !forge.includes(it.id));
  forge = [];
  const chance = fuseChance(r), ok = Math.random() < chance;
  let out = null;
  if (ok) {
    // o tipo mais comum entre os 6 itens decide o resultado
    const cnt = {};
    for (const it of items) cnt[it.b] = (cnt[it.b] || 0) + 1;
    const top = Math.max(...Object.values(cnt));
    out = makeItem(l, r + 1, pick(Object.keys(cnt).filter(b => cnt[b] === top)));
    S.bag.push(out); S.found[r + 1]++; S.pity[r] = 0; S.fuse.ok++;
  } else {
    S.pity[r] = Math.round((S.pity[r] + FUSE_PITY[r]) * 100) / 100; S.fuse.fail++;
  }
  saveNow();
  return { ok, r, items, out, chance };
}

/* ---------------------------- INTERFACE ---------------------------- */
let tab = 'heroi', mktView = 'comprar', bagView = 'itens', filt = { s: '', r: 0, o: 'recentes' };
const rv = r => `--r:${RAR[r].c}`;
function setText(sel, v) { const el = $(sel); if (el.textContent !== v) el.textContent = v; }
function hud() {
  setText('#gold', fmt(S.gold));
  setText('#zoneName', zoneName(S.zone));
  setText('#lvl', 'NV ' + S.lvl);
  setText('#bagCount', String(S.bag.length));
  const boss = S.zk >= 10 && S.auto;
  const fill = $('#zoneFill');
  fill.style.width = (boss && B.enemy && B.enemy.boss ? Math.max(0, B.enemy.hp / B.enemy.maxHp) * 100 : (S.zk / 10) * 100) + '%';
  fill.classList.toggle('boss', boss);
  setText('#zoneTxt', boss ? 'CHEFE' : S.zk + '/10');
  $('#xpFill').style.width = Math.min(100, (S.xp / xpFor(S.lvl)) * 100) + '%';
}

function render() {
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  const p = $('#panel'), y = p.scrollTop;
  p.innerHTML = tab === 'heroi' ? heroHtml() : tab === 'mochila' ? bagHtml() : marketHtml();
  p.scrollTop = y;
}

function heroHtml() {
  const s = ST;
  let h = `<div class="hero"><div class="port"><img class="px" src="${sprURL(SPR.heroi, 5)}" alt="Herói"></div>
    <div class="stats"><span>Nível</span><span>${S.lvl}</span><span>Ataque</span><span>${fmt(s.atk)}</span>
    <span>Vida</span><span>${fmt(s.hp)}</span><span>Defesa</span><span>${fmt(s.def)}</span>
    <span>Crítico</span><span>${s.crit.toFixed(0)}% · ${(100 + s.cdmg).toFixed(0)}%</span>
    <span>Ataques/s</span><span>${s.rate.toFixed(2)}</span><span>Dano/s</span><span>${fmt(s.dps)}</span>
    <span>Ouro · Sorte</span><span>+${s.gold.toFixed(0)}% · +${s.loot.toFixed(0)}%</span></div></div>
    <h3>Equipamento</h3><div class="equip">`;
  for (const k in SLOTS) {
    const it = S.equip[k];
    h += it
      ? `<button class="slot r${it.r}" style="${rv(it.r)}" data-act="item" data-src="equip" data-id="${it.id}"><img class="px" src="${icon(it, 4)}" alt=""><span class="nm">${esc(itemName(it))}</span><span>Nv ${it.l}</span></button>`
      : `<button class="slot" data-act="tab" data-tab="mochila"><span class="ph"></span><span class="nm">${SLOTS[k]}</span><span>vazio</span></button>`;
  }
  h += `</div><h3>Ajustes</h3><div class="opts">
    <label>Avançar para o chefe sozinho <input type="checkbox" id="optAuto" ${S.auto ? 'checked' : ''}></label>
    <label>Vender como sucata ao achar
      <select id="optScrap">${['Nada', 'Comuns', 'Até incomuns', 'Até raros'].map((n, i) => `<option value="${i}" ${S.autoScrap === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="row"><button class="btn" data-act="zonedown" ${S.zone <= 1 ? 'disabled' : ''}>◀ ZONA</button><button class="btn" data-act="zoneup" ${S.zone >= S.maxZone ? 'disabled' : ''}>ZONA ▶</button>
    <span class="small muted">Melhor zona: ${S.maxZone}</span></div></div>
    <h3>Coleção</h3><div class="stats">${RAR.map((r, i) => `<span style="color:${r.c}">${r.n}</span><span>${fmt(S.found[i])}</span>`).join('')}
    <span>Inimigos derrotados</span><span>${fmt(S.kills)}</span></div>`;
  return h;
}

function bagHtml() {
  const seg = `<div class="seg"><button data-act="bview" data-v="itens" class="${bagView === 'itens' ? 'on' : ''}">ITENS ${S.bag.length}/${BAG_MAX}</button><button data-act="bview" data-v="forja" class="${bagView === 'forja' ? 'on' : ''}">FUSÃO</button></div>`;
  if (bagView === 'forja') { const h = forgeHtml(forgeErr); forgeErr = ''; return seg + h; }
  if (!S.bag.length) return seg + `<div class="empty">Sua mochila está vazia.<br>Seu herói guarda aqui os itens que encontrar lutando.</div>`;
  const list = [...S.bag].sort((a, b) => b.r - a.r || b.l - a.l);
  let h = seg + `<div class="row"><span class="small muted" style="flex:1">Toque num item para equipar, anunciar ou vender.</span><button class="btn" data-act="scrapall">SUCATA DOS COMUNS</button></div><div class="grid">`;
  for (const it of list) h += `<button class="tile r${it.r}" style="${rv(it.r)}" data-act="item" data-src="bag" data-id="${it.id}" aria-label="${esc(itemName(it))}"><img class="px" src="${icon(it, 4)}" alt=""><b>${it.l}</b></button>`;
  return h + '</div>';
}

function forgeHtml(err) {
  forge = forge.filter(id => S.bag.some(x => x.id === id));
  const items = forgeItems(), r = items.length ? items[0].r : -1;
  let h = '<div class="forge">';
  for (let i = 0; i < FUSE_N; i++) {
    const it = items[i];
    h += it ? `<button class="tile r${it.r}" style="${rv(it.r)}" data-act="fpick" data-id="${it.id}" aria-label="Tirar ${esc(itemName(it))}"><img class="px" src="${icon(it, 4)}" alt=""><b>${it.l}</b></button>`
      : '<div class="tile ghost"></div>';
  }
  h += '</div>';
  if (r >= 0) {
    const l = forgeLevel(items), cost = fuseCost(r, l), ch = fuseChance(r), full = items.length === FUSE_N;
    h += `<div class="fusebox" style="${rv(r + 1)}">
      <div class="fuseline"><span style="color:${RAR[r].c}">${FUSE_N}× ${RAR[r].n}</span><span class="muted">→</span><span style="color:${RAR[r + 1].c}">1× ${RAR[r + 1].n}</span></div>
      <div class="chance"><div style="width:${ch * 100}%"></div><span>${Math.round(ch * 100)}% de chance${S.pity[r] ? ` (+${Math.round(S.pity[r] * 100)}% de bônus)` : ''}</span></div>
      <div class="stats"><span>Nível do resultado</span><span>${l}</span><span>Custo</span><span style="color:var(--gold)">● ${fmt(cost)}</span></div>
      <p class="small muted">Se falhar, os ${FUSE_N} itens se perdem e a próxima fusão de itens ${PLURAL[r]} ganha +${Math.round(FUSE_PITY[r] * 100)}% de chance.</p>
      ${err ? `<p class="err">${esc(err)}</p>` : ''}
      <div class="row"><button class="btn gold" data-act="fuse" ${!full || S.gold < cost ? 'disabled' : ''}>${!full ? `FALTAM ${FUSE_N - items.length}` : S.gold < cost ? 'OURO INSUFICIENTE' : 'FUNDIR'}</button>
      ${full ? '' : '<button class="btn" data-act="fauto">COMPLETAR</button>'}<button class="btn" data-act="fclear">LIMPAR</button></div></div>`;
  } else {
    h += `<p class="small muted">Escolha ${FUSE_N} itens da mesma raridade para tentar criar um item da raridade seguinte.</p>
      ${err ? `<p class="err">${esc(err)}</p>` : ''}<div class="row"><button class="btn gold" data-act="fauto">ESCOLHER AUTOMÁTICO</button></div>`;
  }
  const pool = S.bag.filter(it => it.r < 5).sort((a, b) => a.r - b.r || a.l - b.l);
  h += pool.length ? '<div class="grid">' + pool.map(it => {
    const sel = forge.includes(it.id), dim = r >= 0 && it.r !== r;
    return `<button class="tile r${it.r} ${sel ? 'sel' : ''} ${dim ? 'dim' : ''}" style="${rv(it.r)}" data-act="fpick" data-id="${it.id}" aria-pressed="${sel}" aria-label="${esc(itemName(it))}"><img class="px" src="${icon(it, 4)}" alt=""><b>${it.l}</b></button>`;
  }).join('') + '</div>' : '<div class="empty">Nenhum item para fundir. Itens míticos já estão no topo.</div>';
  h += `<h3>Chances</h3><div class="stats">${FUSE_CHANCE.map((c, i) => `<span><span style="color:${RAR[i].c}">${RAR[i].n}</span> → <span style="color:${RAR[i + 1].c}">${RAR[i + 1].n}</span></span><span>${Math.round(fuseChance(i) * 100)}%</span>`).join('')}
    <span>Fusões: sucessos · falhas</span><span>${S.fuse.ok} · ${S.fuse.fail}</span></div>`;
  return h;
}
function openFuseResult(res) {
  const ring = res.items.map((it, i) => `<img class="px" style="--i:${i}" src="${icon(it, 3)}" alt="">`).join('');
  openSheet(`<h3>Fundindo...</h3><div class="fx">${ring}</div>`, RAR[res.r + 1].c);
  forging = true;
  setTimeout(() => {
    forging = false;
    if (res.ok) {
      sheetCtx = { src: 'bag', id: res.out.id };
      openSheet(`<h3 style="color:${RAR[res.r + 1].c}">SUCESSO!</h3>${itemHead(res.out)}${compareHtml(res.out)}
        <div class="row"><button class="btn green" data-act="equip">EQUIPAR</button><button class="btn" data-act="close">GUARDAR</button></div>`, RAR[res.r + 1].c);
      toast(`Fusão: ${itemName(res.out)}!`, RAR[res.r + 1].c);
    } else {
      openSheet(`<h3 style="color:var(--r5)">A FUSÃO FALHOU</h3>
        <div class="fx broken">${ring}</div>
        <p class="small">Os ${FUSE_N} itens ${PLURAL[res.r]} viraram pó.</p>
        <p class="small muted">A próxima fusão de itens ${PLURAL[res.r]} agora tem ${Math.round(fuseChance(res.r) * 100)}% de chance.</p>
        <div class="row"><button class="btn" data-act="close">OK</button></div>`, RAR[5].c);
    }
    render();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 1300);
}

function marketHtml() {
  const live = Market.mode === 'shared';
  let h = `<div class="mode ${live ? 'live' : ''}"><i></i><div><b>${live ? 'Mercado compartilhado' : 'Mercado local'}</b><br>${live
    ? 'Anúncios ao vivo de todos que jogam por esta página, mais os mercadores. Taxa de venda: 5%.'
    : 'Você negocia com mercadores. Eles também compram seus anúncios quando o preço é justo. Taxa de venda: 5%.'}</div></div>
    <div class="seg"><button data-act="mview" data-v="comprar" class="${mktView === 'comprar' ? 'on' : ''}">COMPRAR</button><button data-act="mview" data-v="vendas" class="${mktView === 'vendas' ? 'on' : ''}">MINHAS VENDAS ${Market.mine().length || ''}</button></div>`;
  if (mktView === 'comprar') {
    h += `<div class="filters">
      <select id="fS" aria-label="Tipo"><option value="">Tudo</option>${Object.entries(SLOTS).map(([k, n]) => `<option value="${k}" ${filt.s === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="fR" aria-label="Raridade">${RAR.map((r, i) => `<option value="${i}" ${filt.r === i ? 'selected' : ''}>${i ? r.n + '+' : 'Qualquer'}</option>`).join('')}</select>
      <select id="fO" aria-label="Ordem">${[['recentes', 'Recentes'], ['barato', 'Mais barato'], ['caro', 'Mais caro'], ['nivel', 'Maior nível']].map(([k, n]) => `<option value="${k}" ${filt.o === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    let ls = Market.open().filter(l => (!filt.s || BASES[l.item.b].s === filt.s) && l.item.r >= filt.r);
    const ord = { recentes: (a, b) => b.t - a.t, barato: (a, b) => a.price - b.price, caro: (a, b) => b.price - a.price, nivel: (a, b) => b.item.l - a.item.l }[filt.o];
    ls.sort(ord);
    h += ls.length ? `<div class="list">${ls.slice(0, 80).map(l => listingHtml(l)).join('')}</div>` : '<div class="empty">Nenhum anúncio com esses filtros.</div>';
  } else {
    const mine = Market.mine();
    h += mine.length ? `<div class="list">${mine.map(l => listingHtml(l, true)).join('')}</div>`
      : '<div class="empty">Você não tem itens à venda.<br>Abra um item na mochila e toque em ANUNCIAR.</div>';
    h += '<h3>Histórico</h3>';
    h += S.log.length ? `<div class="log">${S.log.slice(0, 15).map(e => `<div><span>${e.k === 'venda' ? 'Vendeu' : 'Comprou'} <span style="color:${RAR[e.r].c}">${esc(e.n)}</span>${e.npc ? ' (mercador)' : ''}</span><span>${e.k === 'venda' ? '+' : '-'}${fmt(e.p)}</span></div>`).join('')}</div>`
      : '<p class="small muted">Suas compras e vendas aparecem aqui.</p>';
  }
  return h;
}
function listingHtml(l, mine) {
  const it = l.item;
  return `<button class="lst" style="${rv(it.r)}" data-act="listing" data-id="${esc(l.id)}">
    <img class="px" src="${icon(it, 4)}" alt=""><span class="nm">${esc(itemName(it))}</span>
    <span class="pr">● ${fmt(l.price)}<small>${mine ? 'você recebe ' + fmt(net(l.price)) : esc(Market.displayName(l))}</small></span>
    <span class="sub">Nv ${it.l} · ${RAR[it.r].n} · ${esc(statLine(it, 2))}</span></button>`;
}

/* --- janela de item --- */
let sheetCtx = null;
function openSheet(html, color) { $('#modal').innerHTML = `<div class="ov" data-act="ovclose"><div class="sheet" style="--r:${color || 'var(--line)'}">${html}</div></div>`; }
function closeSheet() { $('#modal').innerHTML = ''; sheetCtx = null; }
function findItem(src, id) {
  if (src === 'bag') return S.bag.find(x => x.id === id);
  for (const k in S.equip) if (S.equip[k] && S.equip[k].id === id) return S.equip[k];
  return null;
}
function compareHtml(it) {
  const cur = S.equip[BASES[it.b].s];
  const keys = [...new Set([...Object.keys(it.st), ...(cur && cur !== it ? Object.keys(cur.st) : [])])];
  return `<div class="istats">${keys.map(k => {
    const v = it.st[k] || 0, c = cur && cur !== it ? cur.st[k] || 0 : null, d = c == null ? 0 : v - c;
    const u = STATS[k].pct ? '%' : '';
    return `<span>${STATS[k].n}</span><span>${v ? '+' + v + u : '—'}</span><span class="${d > 0 ? 'up' : d < 0 ? 'down' : 'eq'}">${c == null ? '' : d === 0 ? '=' : (d > 0 ? '▲' : '▼') + Math.abs(d) + u}</span>`;
  }).join('')}</div>`;
}
function itemHead(it) {
  return `<div class="ihead"><img class="px" src="${icon(it, 6)}" alt=""><div><div class="nm">${esc(itemName(it))}</div>
    <div class="sub">${RAR[it.r].n} · ${SLOTS[BASES[it.b].s]} · Nível ${it.l}<br>Nº ${String(it.m).padStart(4, '0')}</div></div></div>`;
}
function openItem(src, id, err) {
  const it = findItem(src, id);
  if (!it) return closeSheet();
  sheetCtx = { src, id };
  const equipped = src === 'equip';
  openSheet(`${itemHead(it)}${compareHtml(it)}
    ${equipped ? '' : `<p class="small muted">${S.equip[BASES[it.b].s] ? '▲▼ comparado com o item equipado.' : 'Nada equipado neste espaço.'}</p>`}
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <div class="row">${equipped
      ? `<button class="btn" data-act="unequip" ${S.bag.length >= BAG_MAX ? 'disabled' : ''}>GUARDAR</button>`
      : `<button class="btn green" data-act="equip">EQUIPAR</button><button class="btn gold" data-act="sellform">ANUNCIAR</button><button class="btn red" data-act="scrap">SUCATA +${fmt(scrapValue(it))}</button>`}
      <button class="btn" data-act="close">FECHAR</button></div>`, RAR[it.r].c);
}
function openSellForm(err) {
  const it = findItem('bag', sheetCtx && sheetCtx.id);
  if (!it) return closeSheet();
  const fair = fairPrice(it);
  openSheet(`${itemHead(it)}<div class="pricebox">
    <label class="small" for="priceIn">Preço em ouro</label>
    <input id="priceIn" type="number" inputmode="numeric" min="1" step="1" value="${fair}">
    <div class="small muted" id="netOut">Você recebe ${fmt(net(fair))} após a taxa de 5%.</div>
    <div class="small muted">Preço justo estimado: ${fmt(fair)}. Mercadores compram rápido perto desse valor; jogadores podem pagar mais por itens raros.</div>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}</div>
    <div class="row"><button class="btn gold" data-act="list">ANUNCIAR</button><button class="btn" data-act="item" data-src="bag" data-id="${it.id}">VOLTAR</button></div>`, RAR[it.r].c);
}
function openListing(id, err) {
  const l = [...Market.npc, ...Market.players].find(x => x.id === id);
  if (!l) { closeSheet(); toast('Este anúncio não está mais disponível', RAR[5].c); return; }
  sheetCtx = { listing: id };
  const it = l.item, mine = l.seller === Market.me && !l.npc;
  openSheet(`${itemHead(it)}${compareHtml(it)}
    <div class="stats"><span>Vendedor</span><span>${mine ? 'Você' : esc(Market.displayName(l))}</span><span>Preço</span><span style="color:var(--gold)">● ${fmt(l.price)}</span>
    ${mine ? `<span>Você recebe</span><span>${fmt(net(l.price))}</span>` : `<span>Seu ouro</span><span>${fmt(S.gold)}</span>`}</div>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <div class="row">${mine
      ? '<button class="btn red" data-act="cancel">CANCELAR ANÚNCIO</button>'
      : `<button class="btn gold" data-act="buy" ${S.gold < l.price ? 'disabled' : ''}>${S.gold < l.price ? 'OURO INSUFICIENTE' : 'COMPRAR'}</button>`}
      <button class="btn" data-act="close">FECHAR</button></div>`, RAR[it.r].c);
}

/* --- avisos --- */
function toast(msg, color) {
  const box = $('#toasts');
  while (box.children.length > 2) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  if (color) el.style.setProperty('--t', color);
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ---------------------------- EVENTOS ---------------------------- */
let acting = false;
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-act],[data-tab]');
  if (!b || b.disabled) return;
  const a = b.dataset.act;
  if (!a && b.dataset.tab) { tab = b.dataset.tab; render(); $('#panel').scrollTop = 0; return; }
  if (a === 'ovclose') { if (ev.target === b) closeSheet(); return; }
  if (a === 'close') return closeSheet();
  if (a === 'tab') { tab = b.dataset.tab; render(); return; }
  if (a === 'item') return openItem(b.dataset.src, b.dataset.id);
  if (a === 'listing') return openListing(b.dataset.id);
  if (a === 'mview') { mktView = b.dataset.v; render(); return; }
  if (a === 'bview') { bagView = b.dataset.v; render(); return; }
  if (a === 'fpick') { forgePick(b.dataset.id); render(); return; }
  if (a === 'fclear') { forge = []; render(); return; }
  if (a === 'fauto') { forgeErr = forgeAuto() || ''; render(); return; }
  if (a === 'fuse') { const res = doFuse(); if (res) openFuseResult(res); render(); return; }
  if (a === 'zonedown' || a === 'zoneup') {
    S.zone = clamp(S.zone + (a === 'zoneup' ? 1 : -1), 1, S.maxZone); S.zk = 0; B.enemy = null; B.spawnT = 0.5;
    saveSoon(); render(); return;
  }
  if (a === 'scrapall') {
    let g = 0; S.bag = S.bag.filter(it => { if (it.r === 0) { g += scrapValue(it); return false; } return true; });
    S.gold += g; if (g) toast(`+${fmt(g)} de ouro em sucata`, PAL.y);
    saveSoon(); render(); return;
  }
  if (a === 'equip') {
    const i = S.bag.findIndex(x => x.id === sheetCtx.id);
    if (i < 0) return closeSheet();
    const it = S.bag[i], slot = BASES[it.b].s, old = S.equip[slot];
    S.bag.splice(i, 1); S.equip[slot] = it; if (old) S.bag.push(old);
    recalc(); saveSoon(1000); closeSheet(); render(); return;
  }
  if (a === 'unequip') {
    const it = findItem('equip', sheetCtx.id);
    if (!it || BASES[it.b].s === 'arma') { openItem('equip', sheetCtx.id, 'O herói precisa de uma arma. Equipe outra para trocar.'); return; }
    delete S.equip[BASES[it.b].s]; S.bag.push(it);
    recalc(); saveSoon(1000); closeSheet(); render(); return;
  }
  if (a === 'scrap') {
    const i = S.bag.findIndex(x => x.id === sheetCtx.id);
    if (i >= 0) { const it = S.bag.splice(i, 1)[0]; S.gold += scrapValue(it); toast(`+${fmt(scrapValue(it))} de ouro`, PAL.y); }
    saveSoon(); closeSheet(); render(); return;
  }
  if (a === 'sellform') return openSellForm();
  if (acting) return;
  if (a === 'list') {
    const it = findItem('bag', sheetCtx.id), price = Math.round(+$('#priceIn').value);
    if (!it) return closeSheet();
    if (!(price >= 1)) return openSellForm('Digite um preço de pelo menos 1 de ouro.');
    acting = true; b.disabled = true;
    const err = await Market.list(it, price);
    acting = false;
    if (err) return openSellForm(err);
    closeSheet(); toast(`${itemName(it)} anunciado por ${fmt(price)}`, PAL.y); mktView = 'vendas'; render(); return;
  }
  if (a === 'buy' || a === 'cancel') {
    const id = sheetCtx && sheetCtx.listing, l = [...Market.npc, ...Market.players].find(x => x.id === id);
    if (!l) return closeSheet();
    acting = true; b.disabled = true;
    const err = await (a === 'buy' ? Market.buy(l) : Market.cancel(l));
    acting = false;
    if (err) return openListing(id, err);
    closeSheet(); toast(a === 'buy' ? `Comprado: ${itemName(l.item)}` : 'Anúncio cancelado. O item voltou para a mochila', PAL.y);
    render(); return;
  }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'priceIn') { const p = Math.max(0, Math.round(+ev.target.value) || 0); $('#netOut').textContent = `Você recebe ${fmt(net(p))} após a taxa de 5%.`; }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'optAuto') { S.auto = t.checked; saveSoon(); }
  else if (t.id === 'optScrap') { S.autoScrap = +t.value; saveSoon(); }
  else if (t.id === 'fS') { filt.s = t.value; render(); }
  else if (t.id === 'fR') { filt.r = +t.value; render(); }
  else if (t.id === 'fO') { filt.o = t.value; render(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { S.seen = Date.now(); saveNow(); }
  else { const gap = (Date.now() - S.seen) / 1000; if (gap > 30) offline(gap); S.seen = Date.now(); last = 0; }
});
addEventListener('pagehide', () => { S.seen = Date.now(); saveLocal(); });

/* ---------------------------- LAÇO ---------------------------- */
let last = 0, hudT = 0, seenT = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  step(dt);
  draw();
  hudT -= dt; seenT -= dt;
  if (hudT <= 0) { hudT = 0.2; hud(); }
  if (seenT <= 0) { seenT = 5; S.seen = Date.now(); saveLocal(); }
}

resize();
recalc();
B.hp = ST.hp;
const away = (Date.now() - S.seen) / 1000;
render(); hud();
if (away > 30 && S.kills > 0) offline(away);
S.seen = Date.now();
Market.init();
requestAnimationFrame(loop);

// gancho de teste
window.__idle = { get S() { return S; }, B, Market, step, recalc, offline, makeItem, render };
