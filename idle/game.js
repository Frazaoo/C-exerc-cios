'use strict';
/* =========================================================================
   SAQUE INFINITO — RPG idle em pixel art com party de 3 heróis, pets,
   fusão de itens e mercado entre jogadores (local, compartilhado ou Firebase).
   Regras de itens, classes e pets ficam em regras.js (compartilhado com o servidor).
   ========================================================================= */

const RG = window.REGRAS;
const { RAR, STATS, CLASSES, BASES, SLOTS, PETS, clamp, rnd, pick, rid } = RG;
const $ = s => document.querySelector(s);
const mod = (a, n) => ((a % n) + n) % n;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0) + 'k';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e8 ? 1 : 0) + 'M';
  return (n / 1e9).toFixed(1) + 'B';
};
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      if (ch === '.' || ch === ' ') continue;
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
  // heróis (olhando para a direita)
  cavaleiro: ['....kkkk....', '...kEEEEk...', '..kEEEEEEk..', '..kEkkkkEk..', '..kEcEEcEk..', '..kEEEEEEk..', '...kEEEEk...', '..krrEErrk..', '.kEkrrrrkEk.', '.kEkEbbEkEk.', '.kskEEEEksk.', '..kkeeeekk..', '..keek.keek.', '..kkk..kkk..'],
  arqueira: ['....kkkk....', '...kGGGGk...', '..kGGGGGGk..', '..kGssssGk..', '..kGskskGk..', '..kGssssGk..', '...kGssGk...', '..knGGGGnk..', '.kGknnnnkGk.', '.kskGGGGksk.', '..kGGGGGGk..', '...knk.knk..', '...kNk.kNk..', '...kk...kk..'],
  sacerdote: ['....kkkk....', '...kwwwwk...', '..kwwwwwwk..', '..kwskskwk..', '..kwsSSswk..', '...kwwwwk...', '..kwwyywwk..', '.kwwwyywwwk.', '.kswwyywwsk.', '..kwwyywwk..', '..kwwyywwk..', '..kEwwwwEk..', '..kEEEEEEk..', '..kkkkkkkk..'],
  mago: ['.....kk.....', '....kBBk....', '...kBBBk....', '...kBByBk...', '..kBBBBBBk..', '.kkkkkkkkkk.', '..kskssksk..', '..kwwwwwwk..', '..kBwwwwBk..', '.kBBBwwBBBk.', '.kBBBBBBBBk.', '.ksBBBBBBsk.', '..kBBbbBBk..', '..kkkkkkkk..'],
  barbaro: ['E..........E', 'Ek.kkkkkk.kE', '.kkeeeeeekk.', '..keeeeeek..', '..kskssksk..', '..kssNNssk..', '...kNNNNk...', '.kskssssksk.', '.kskssssksk.', '.kskNnnNksk.', '..knnnnnnk..', '..knnk.knnk.', '..kSSk.kSSk.', '..kkk..kkk..'],
  ladino: ['....kkkk....', '...kooook...', '..kooooook..', '..kokkkkok..', '..kokrkrok..', '..kooooook..', '...kooook...', '..koNNNNok..', '.kokoooookok', '.kskooooksk.', '..kooooook..', '...kok.kok..', '...kNk.kNk..', '...kk...kk..'],
  necromante: ['....kkkk....', '...kppppk...', '..kpPPPPpk..', '..kpEEEEpk..', '..kpgEEgpk..', '..kpEkkEpk..', '...kpEEpk...', '..kppPPppk..', '.kpPPPPPPpk.', '.kEkPPPPkEk.', '..kpPPPPpk..', '..kpPPPPpk..', '..kppppppk..', '..kkkkkkkk..'],
  bardo: ['........kk..', '.......kRk..', '...kkkkkRk..', '..krrrrrrk..', '.kkkkkkkkkk.', '..kssssssk..', '..kskssksk..', '...kssssk...', '..kyGGGGyk..', '.ksGGyyGGsk.', '..kGGGGGGk..', '...kGk.kGk..', '...kNk.kNk..', '...kk...kk..'],
  // inimigos
  slime: ['...kkkk...', '..kggggk..', '.kgwggggk.', 'kgggggggGk', 'kgkggkgGGk', 'kgggggGGGk', 'kGGGGGGGGk', '.kkkkkkkk.'],
  morcego: ['k..........k', 'kk..k..k..kk', 'kpk.kkkk.kpk', 'kPpkpypypkPk', '.kPppppppPk.', '..kk.kk.kk..'],
  goblin: ['k..kkkk..k', 'kgkggggkgk', '.kgyggygk.', '..kggggk..', '..kgrrgk..', '...kkkk...', '..knnnnk..', '.kgknnkgk.', '.kgknnkgk.', '..knnnnk..', '..kgkkgk..', '..kk..kk..'],
  lobo: ['...........kk.', '..........keEk', 'kk.......keeek', 'kekkkkkkkeeyEkk', '.keeeeeeeeeeEEk', '.keeEEEeeeeekk.', '..keeeeeeeek...', '..kek.kek.kek..', '..kk..kk..kk...'],
  esqueleto: ['...kkkk...', '..kwwwwk..', '.kwkwwkwk.', '.kwwwwwwk.', '..kwkkwk..', '...kwwk...', '..kkwwkk..', '.kwkwwkwk.', '.kwkEEkwk.', '..kkwwkk..', '..kwkkwk..', '..kwk.kwk.', '..kwk.kwk.', '..kk...kk.'],
  fantasma: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkcwwkcwk.', '.kwwwwwwwwk.', '.kwwwkkwwwk.', '.kwwwwwwwwk.', '.kEwwwwwwEk.', '.kEEwwwwEEk.', '.kEkEwwEkEk.', '..k.kkkk.k..'],
  zumbi: ['..kkkkk...', '.kGgggGk..', '.kgkggkk..', '.kgggggk..', '.kGgrrGk..', '..kkkkk...', '.kttttttk.', 'kgktttttkgk', 'kgkttGttkg.', '.kktttttkk.', '..kNNkNNk..', '..kNk.kNk..', '..kgk.kgk..', '..kk...kk..'],
  golem: ['....kkkkkkkk....', '...keeeeeeeek...', '..keEEeeeeEEek..', '..keeyekkeyeek..', '..keeeeeeeeeek..', '..kkeekkkkeekk..', '.keekeeeeeekeek.', 'keEEkeEEEEekEEek', 'keEekeeeeeekeEek', 'keeekeeEeeekeeek', '.kkkkeeeeeekkkk.', '....keeeeeek....', '...keeekkeeek...', '...keek..keek...', '..keeek..keeek..', '..kkkkk..kkkkk..'],
  ceifador: ['.....kkkkkk.....', '....kooooook....', '...kooooooook...', '...kookwwkook...', '...kokwwwwkok...', '...kowrwwrwok...', '...kowwwwwwok...', '...koowkkwook...', '..koooooooooook.', '.koooooooooooook', 'kooEooooooooEook', 'koowoooooooowook', '.kooooooooooook.', '.kooooooooooook.', '.koooopoooopook.', '..kooppooppook..', '..kpopkopkpopk..', '...k.k..k..k....'],
  // pets
  petSlime: ['..kkkk..', '.kyyyyk.', 'kywyyyyk', 'kykyykyk', 'kyyyyyRk', 'kRRRRRRk', '.kkkkkk.'],
  petLobo: ['.k....k.', 'kek..kek', 'keekkeek', 'keyeeyek', '.keEEek.', '..keek..', '.kekkek.', '.kk..kk.'],
  petFantasma: ['..kkkk..', '.kwwwwk.', 'kwkwwkwk', 'kwcwwcwk', 'kwwwwwwk', 'kwwkkwwk', 'kwkwwkwk', '.k.kk.k.'],
  petGolem: ['.kkkkkk.', 'keEEEEek', 'keykkyek', 'keeeeeek', '.keeeek.', 'kekeekek', 'keekkeek', 'kkk..kkk'],
  petDragao: ['......kk.', '.k...kRk.', 'krk.kRRRk', 'krrkRRkRk', '.kRRRRRk.', '..kRwwRk.', '.kRk.kRk.', '.kk...kk.'],
  // itens: "E" é a cor da raridade
  espada: ['........Ew', '.......EwE', '......EwE.', '.....EwE..', '....EwE...', '.y.EwE....', '..yEE.....', '..ny......', '.n..y.....', 'n.........'],
  martelo: ['..kkkkkk..', '.kEEEEEEk.', '.kEwEEEEk.', '.kEEEEEEk.', '..kkkkkk..', '....kn....', '....kn....', '....kn....', '....kn....', '....kk....'],
  arco: ['...nnk....', '..n...w...', '.n.....w..', 'n.......E.', 'n........E', 'n.......E.', '.n.....w..', '..n...w...', '...nnk....'],
  besta: ['k........k', 'Ek......kE', '.Ek....kE.', '..EkwwkE..', '....nn....', '....nn....', '....nn....', '...kNNk...', '...kNNk...', '....kk....'],
  cetro: ['....kk....', '...kyyk...', '..kyEEyk..', '..kyEEyk..', '...kyyk...', '....yy....', '....nn....', '....nn....', '....nn....', '....kk....'],
  livro: ['.kkkkkkkk.', 'kNEEEEEENk', 'kNEwEEEENk', 'kNEEyyEENk', 'kNEyyyyENk', 'kNEEyyEENk', 'kNEEEEEENk', 'kNwwwwwwNk', '.kkkkkkkk.'],
  cajado: ['....kkk...', '...kEwEk..', '...kEEEk..', '....kkk...', '....n.....', '....n.....', '...n......', '...n......', '..n.......', '..n.......'],
  orbe: ['...kkkk...', '..kEEEEk..', '.kEwwEEEk.', '.kEwEEEEk.', '.kEEEEEEk.', '..kEEEEk..', '...kkkk...', '..knnnnk..', '.knNNNNnk.', '..kkkkkk..'],
  machado: ['..kkk.....', '.kEEEk....', 'kEwwEEk...', 'kEwEEnk...', 'kEEEknk...', '.kkk.n....', '......n...', '.......n..', '........n.', '.........n'],
  montante: ['.......kEw', '......kEwk', '.....kEwk.', '....kEwk..', '...kEwk...', 'yykEwk....', '.yyEk.....', '..ny......', '.nk.y.....', 'nk........'],
  adaga: ['..........', '......kEw.', '.....kEwk.', '....kEwk..', '...kEwk...', '..yyEk....', '...yy.....', '..n.y.....', '.n........'],
  laminas: ['Ew......wE', '.Ew....wE.', '..Ew..wE..', '...EwwE...', '....EE....', '...yEEy...', '..y.nn.y..', '.n......n.', 'n........n'],
  foice: ['.EEEEE....', 'EwwwwwE...', 'E.....nE..', '......n.E.', '.....n....', '.....n....', '....n.....', '....n.....', '...n......', '..n.......'],
  grimorio: ['.kkkkkkkk.', 'kpEEEEEEpk', 'kpEwwwEEpk', 'kpEwkwkEpk', 'kpEwwwwEpk', 'kpEEwwEEpk', 'kpEEEEEEpk', 'kppppppppk', '.kkkkkkkk.'],
  alaude: ['........kn', '.......kn.', '......kn..', '..kkkkn...', '.kEEEEk...', 'kEEkkEEk..', 'kEkwwkEk..', 'kEEkkEEk..', '.kEEEEk...', '..kkkk....'],
  flauta: ['.........k', '........kE', '.......kEk', '......kwk.', '.....kEk..', '....kwk...', '...kEk....', '..kwk.....', '.kEk......', 'kEk.......'],
  elmo: ['..kkkkkk..', '.kEEEEEEk.', 'kEwEEEEEEk', 'kEEEEEEEEk', 'kEkkkkkkEk', 'kEkrkkrkEk', 'kEEEkkEEEk', '.kEEkkEEk.', '..kk..kk..'],
  capuz: ['...kkkk...', '..kEEEEk..', '.kEEEEEEk.', '.kEkkkkEk.', 'kEkkkkkkEk', 'kEkykkykEk', 'kEEkkkkEEk', 'kEEEEEEEEk', '.kkkkkkkk.'],
  peitoral: ['.kk....kk.', 'kEEkkkkEEk', 'kEwEEEEEEk', 'kEEEyyEEEk', '.kEEEEEEk.', '.kEEEEEEk.', '.kEEnnEEk.', '.kEEEEEEk.', '..kkkkkk..'],
  manto: ['...kkkk...', '..kEyyEk..', '.kEEEEEEk.', '.kEwEEEEk.', 'kEEEEEEEEk', 'kEEEEEEEEk', 'kEEEEEEEEk', 'kEkEkkEkEk', '.k.k..k.k.'],
  botas: ['..kkkk....', '..kEEk....', '..kEEk....', '..kEEk....', '..kEEkkk..', '.kEEEEEEk.', '.kEwEEEEk.', '.knnnnnnk.', '..kkkkkk..'],
  anel: ['....kk....', '...kwwk...', '...kEEk...', '....kk....', '..yyyyyy..', '.y......y.', 'y........y', 'y........y', '.y......y.', '..yyyyyy..'],
  amuleto: ['y........y', '.y......y.', '..y....y..', '...y..y...', '....kk....', '...kEEk...', '..kEwEEk..', '..kEEEEk..', '...kEEk...', '....kk....'],
  talisma: ['....kk....', '...kyyk...', '..kyEEyk..', '.kyEwEEyk.', '.kyEEEEyk.', '..kyEEyk..', '...kyyk...', '....kk....'],
  // cenário
  arbusto: ['...kkk.kk...', '..kGGGkGGk..', '.kGgGGGGgGk.', 'kGGGGtGGGGGk', 'kGtGGGGGtGGk', 'ktGGtGGGGGtk', '.kttttttttk.'],
  arvore: ['....kkkk....', '..kkGGGGkk..', '.kGGgGGGGGk.', 'kGGGGGGtGGGk', 'kGtGGGGGGtGk', '.kGGGtGGGGk.', '..kkGGGGkk..', '....knnk....', '....knnk....', '....knnk....', '...kNnnNk...'],
  lapide: ['..kkkk..', '.kEEEEk.', 'kEEkEEek', 'kEkkkEek', 'kEEkEEek', 'kEEkEEek', 'kEEEEEek', 'keeeeeek'],
  pedra: ['..kkkk..', '.kEEEek.', 'kEwEEeek', 'kEEEeeek', '.kkkkkk.'],
  cristal: ['...kk...', '..kcck..', '.kcBwck.', 'kcBBwcck', '.kcBBck.', '..kkkk..'],
  osso: ['w....w', 'wwwwww', 'w....w'],
  moeda: ['.kkk.', 'kyyRk', 'kywRk', 'kyRRk', '.kkk.'],
  nota: ['..kk', '..kw', '..k.', 'kkk.', 'kwk.'],
};
const SPR = {};
for (const k in ART) SPR[k] = makeSprite(ART[k]);
SPR.slimeRei = makeSprite(ART.slime, { g: 'y', G: 'R' });
SPR.loboAlfa = makeSprite(ART.lobo, { e: 'o', E: 'r', y: 'R' });
SPR.lich = makeSprite(ART.necromante, { p: 'k', P: 't', g: 'R' });
SPR.golemRei = makeSprite(ART.golem, { e: 'b', E: 'c', y: 'w' });
SPR.demonio = makeSprite(ART.zumbi, { g: 'R', G: 'r', t: 'p' });
SPR.esqueletoAliado = makeSprite(ART.esqueleto, { w: 'c', E: 'B' });
const PET_SPR = { slime: SPR.petSlime, lobinho: SPR.petLobo, fantasminha: SPR.petFantasma, golemzinho: SPR.petGolem, dragaozinho: SPR.petDragao };
const ICON = {};
for (const b in BASES) ICON[b] = RAR.map(r => makeSprite(ART[b], { E: r.c }));
const iconSpr = it => (it.pet ? PET_SPR[it.pet] : ICON[it.b][it.r]);
const icon = (it, sc = 4) => sprURL(iconSpr(it), sc);
const clsIcon = (cls, sc = 4) => sprURL(SPR[cls], sc);
const FACE_LEFT = new Set(['lobo', 'loboAlfa']); // sprites desenhados olhando para a direita

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

/* ---------------------------- MUNDO ---------------------------- */
const BIOMES = [
  { n: 'Campos Verdes', sky: ['#3b5dc9', '#73eff7'], hill: '#257179', ground: '#38b764', dirt: '#257179', mobs: ['slime', 'morcego'], boss: 'slimeRei', deco: ['arbusto', 'arvore', 'pedra'], clima: 'vaga' },
  { n: 'Floresta Sombria', sky: ['#1a1c2c', '#29366f'], hill: '#1b2b2a', ground: '#257179', dirt: '#1a1c2c', mobs: ['goblin', 'lobo'], boss: 'loboAlfa', deco: ['arvore', 'arvore', 'arbusto'], clima: 'folhas' },
  { n: 'Cripta Esquecida', sky: ['#1a1c2c', '#5d275d'], hill: '#333c57', ground: '#566c86', dirt: '#333c57', mobs: ['esqueleto', 'fantasma'], boss: 'lich', deco: ['lapide', 'osso', 'lapide'], clima: 'almas' },
  { n: 'Picos Gelados', sky: ['#41a6f6', '#f4f4f4'], hill: '#94b0c2', ground: '#f4f4f4', dirt: '#94b0c2', mobs: ['golem', 'morcego'], boss: 'golemRei', deco: ['pedra', 'cristal', 'pedra'], clima: 'neve' },
  { n: 'Terras de Cinza', sky: ['#5d275d', '#ef7d57'], hill: '#333c57', ground: '#5a3a1e', dirt: '#1a1c2c', mobs: ['zumbi', 'demonio'], boss: 'ceifador', deco: ['osso', 'pedra', 'lapide'], clima: 'brasas' },
];
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII'];
const biomeIdx = z => Math.floor((z - 1) / 5) % BIOMES.length;
const biomeOf = z => BIOMES[biomeIdx(z)];
const zoneName = z => `${z} · ${biomeOf(z).n}${ROMAN[Math.min(7, Math.floor((z - 1) / 25))] || ''}`;
const ZK = 12; // inimigos por zona antes do chefe
function makeFoe(z, boss) {
  const hp = 22 * Math.pow(1.17, z - 1) * (boss ? 12 : 1);
  const key = boss ? biomeOf(z).boss : pick(biomeOf(z).mobs), spr = SPR[key];
  return {
    hp, maxHp: hp, atk: 3.5 * Math.pow(1.14, z - 1) * (boss ? 2 : 1), aspd: boss ? 0.7 : 0.8,
    gold: RG.enemyGold(z) * (boss ? 10 : 1), xp: 4 * Math.pow(1.15, z - 1) * (boss ? 8 : 1),
    boss, key, spr, sc: boss ? (spr.w > 14 ? 1.5 : 2) : 1, flash: 0, kb: 0, atkT: rnd(0.4, 1.2), lunge: 0, dead: false, dieT: 0,
    fly: key === 'morcego', ghost: key === 'fantasma', top: GY - spr.h,
  };
}
const xpFor = l => Math.round(15 * Math.pow(1.22, l - 1));
const RECRUIT_ORDER = Object.keys(CLASSES);

/* ---------------------------- SAVE ---------------------------- */
const SAVE_KEY = 'saque_infinito_v1';
const BAG_MAX = 80, PETS_MAX = 30;
function newHero(cls) { return { lvl: 1, xp: 0, equip: { arma: RG.makeItem(1, 0, CLASSES[cls].armas[0]) } }; }
function freshSave() {
  return {
    v: 2, gold: 0, zone: 1, maxZone: 1, zk: 0, auto: true, autoScrap: 0, nick: 'Herói' + (1000 + ((Math.random() * 9000) | 0)),
    heroes: { cavaleiro: newHero('cavaleiro'), arqueira: newHero('arqueira'), sacerdote: newHero('sacerdote') },
    party: ['cavaleiro', 'arqueira', 'sacerdote'], sel: 'cavaleiro',
    bag: [], pets: [], pet: null, petsFound: {}, log: [],
    kills: 0, found: [0, 0, 0, 0, 0, 0], pity: [0, 0, 0, 0, 0], fuse: { ok: 0, fail: 0 }, seen: Date.now(), t: Date.now(),
  };
}
function cleanHero(o, cls) {
  const h = { lvl: clamp((o && o.lvl) | 0, 1, 9999), xp: Math.max(0, +(o && o.xp) || 0), equip: {} };
  if (o && o.equip) for (const k in SLOTS) {
    const it = RG.cleanItem(o.equip[k]);
    if (it && !it.pet && BASES[it.b].s === k && (!BASES[it.b].cls || BASES[it.b].cls === cls)) h.equip[k] = it;
  }
  if (!h.equip.arma) h.equip.arma = RG.makeItem(1, 0, CLASSES[cls].armas[0]);
  return h;
}
function cleanSave(o) {
  const s = freshSave();
  if (!o || typeof o !== 'object') return s;
  for (const k of ['gold', 'zone', 'maxZone', 'zk', 'autoScrap', 'kills', 'seen', 't']) if (Number.isFinite(+o[k])) s[k] = +o[k];
  s.zone = clamp(s.zone | 0, 1, 9999); s.maxZone = Math.max(s.zone, s.maxZone | 0); s.zk = clamp(s.zk | 0, 0, ZK);
  s.autoScrap = clamp(s.autoScrap | 0, 0, 3); s.auto = o.auto !== false;
  if (typeof o.nick === 'string') s.nick = o.nick.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16) || s.nick;
  const extra = [];
  if (o.heroes && typeof o.heroes === 'object') {
    s.heroes = {};
    for (const cls in CLASSES) if (o.heroes[cls]) s.heroes[cls] = cleanHero(o.heroes[cls], cls);
  } else if (o.equip) {
    // save da versão 1: um herói só. Vira o Cavaleiro; armas de outras classes vão para a mochila.
    const old = {};
    for (const k in SLOTS) {
      const it = RG.cleanItem(o.equip[k]);
      if (it && BASES[it.b]) { if (BASES[it.b].cls && BASES[it.b].cls !== 'cavaleiro') extra.push(it); else old[k] = it; }
    }
    s.heroes.cavaleiro = cleanHero({ lvl: o.lvl, xp: o.xp, equip: old }, 'cavaleiro');
  }
  for (const c of ['cavaleiro', 'arqueira', 'sacerdote']) if (!s.heroes[c]) s.heroes[c] = newHero(c);
  if (Array.isArray(o.party)) {
    const p = [...new Set(o.party.filter(c => s.heroes[c]))].slice(0, 3);
    if (p.length) s.party = p;
  }
  s.sel = s.heroes[o.sel] ? o.sel : s.party[0];
  s.bag = [...extra, ...(Array.isArray(o.bag) ? o.bag.map(x => RG.cleanItem(x)).filter(x => x && !x.pet) : [])].slice(0, BAG_MAX);
  s.pets = Array.isArray(o.pets) ? o.pets.map(x => RG.cleanItem(x)).filter(x => x && x.pet).slice(0, PETS_MAX) : [];
  s.pet = s.pets.some(p => p.id === o.pet) ? o.pet : null;
  if (o.petsFound && typeof o.petsFound === 'object') for (const k in PETS) if (o.petsFound[k]) s.petsFound[k] = true;
  s.log = Array.isArray(o.log) ? o.log.filter(e => e && typeof e === 'object').slice(0, 30).map(e => ({ k: e.k === 'compra' ? 'compra' : 'venda', r: clamp(e.r | 0, 0, 5), n: String(e.n || '').slice(0, 40), p: +e.p || 0, npc: !!e.npc, t: +e.t || 0 })) : [];
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
function saveSoon(ms = 15000) {
  const due = Date.now() + ms;
  if (saveDue && saveDue <= due) return;
  clearTimeout(saveTimer); saveDue = due; saveTimer = setTimeout(saveNow, ms);
}
function saveNow() { clearTimeout(saveTimer); saveDue = 0; saveLocal(); Market.pushSave(); }

/* ---------------------------- STATUS ---------------------------- */
let PS = {};
const PARTY = { mul: 1, goldMul: 1, luck: 1, dps: 1 };
const activePet = () => S.pets.find(p => p.id === S.pet) || null;
function heroStats(cls) {
  const c = CLASSES[cls], h = S.heroes[cls], g = RG.growth(h.lvl);
  const st = { atk: c.atk * g.atk, hp: c.hp * g.hp, def: c.def * g.def, crit: 5, cdmg: 50 };
  for (const k in STATS) if (STATS[k].pct && !(k in st)) st[k] = 0;
  for (const k in c.bonus) st[k] += c.bonus[k];
  for (const s in h.equip) { const it = h.equip[s]; if (it) for (const k in it.st) st[k] += it.st[k]; }
  const pet = activePet();
  if (pet) {
    const v = RG.petBonus(pet), k = PETS[pet.pet].stat;
    if (k === 'hpPct') st.hp *= 1 + v / 100; else st[k] += v;
  }
  for (const k in STATS) if (STATS[k].cap) st[k] = Math.min(STATS[k].cap, st[k]);
  st.rate = c.aspd * (1 + st.aspd / 100);
  return st;
}
function recalc() {
  PS = {};
  for (const cls of S.party) PS[cls] = heroStats(cls);
  let buff = 0, gold = 0, loot = 0, dps = 0;
  for (const cls of S.party) { buff += PS[cls].buff; gold += PS[cls].gold; loot += PS[cls].loot; }
  PARTY.mul = 1 + buff / 100; PARTY.goldMul = 1 + gold / 100; PARTY.luck = 1 + loot / 100;
  for (const cls of S.party) {
    const st = PS[cls];
    let d = st.atk * st.rate * (1 + (st.crit / 100) * (st.cdmg / 100)) * PARTY.mul;
    if (cls === 'mago') d *= 1.6 * (1 + st.area / 100);
    if (cls === 'sacerdote') d *= 0.5;
    dps += d;
  }
  PARTY.dps = dps;
  syncParty();
}
function heroPower(cls) { const s = heroStats(cls); return Math.round(s.atk * s.rate * 4 + s.hp / 3 + s.def * 3); }

/* ---------------------------- BATALHA ---------------------------- */
const B = {
  heroes: [], foes: [], projs: [], fx: [], parts: [], nums: [], drops: [], summons: [], weather: [],
  scroll: 0, walking: true, spawnT: 0.8, shake: 0, wall: 0, ballad: 0, wipe: 0, flash: 0, time: 0, petT: 3,
};
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 200, H = 120, SC = 2, GY = 100;
let skyCache = {};
function resize() {
  const r = cv.getBoundingClientRect();
  SC = Math.max(2, Math.round(r.width / 210));
  W = Math.max(120, Math.ceil(r.width / SC)); H = Math.max(80, Math.ceil(r.height / SC));
  cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
  GY = H - 16; skyCache = {};
  layout();
}
addEventListener('resize', resize);

function syncParty() {
  const old = Object.fromEntries(B.heroes.map(h => [h.cls, h]));
  B.projs = B.projs.filter(p => !p.owner || S.party.includes(p.owner));
  B.summons = B.summons.filter(m => S.party.includes(m.owner.cls));
  B.heroes = S.party.map(cls => {
    const o = old[cls], max = PS[cls].hp;
    if (o) { o.hp = o.dead ? 0 : Math.min(max, (o.hp / o.max) * max); o.max = max; return o; }
    return { cls, hp: max, max, dead: false, atkT: rnd(0.2, 0.9), skillT: CLASSES[cls].skill.cd * 0.5, x: 0, x0: 0, lunge: 0, swing: 0, hurt: 0, cast: 0, glow: 0, spin: 0, vanish: 0, ph: Math.random() * 6 };
  });
  layout();
  buildPartyBar();
}
function layout() {
  const order = [...B.heroes].sort((a, b) => CLASSES[b.cls].front - CLASSES[a.cls].front);
  const fx = Math.round(W * 0.44);
  order.forEach((h, i) => { h.x0 = fx - i * 17; if (!h.x) h.x = h.x0; });
}
const frontX = () => (B.heroes.length ? Math.max(...B.heroes.map(h => h.x0)) : 60);
const alive = () => B.heroes.filter(h => !h.dead);
const engaged = () => B.foes.filter(f => !f.dead && f.arrived);

function spawnWave() {
  const z = S.zone, boss = S.zk >= ZK && S.auto;
  const n = boss ? 1 + Math.min(2, Math.floor(z / 8)) : 1 + (Math.random() < 0.55 ? 1 : 0) + (z >= 6 && Math.random() < 0.35 ? 1 : 0);
  B.foes = [];
  for (let i = 0; i < n; i++) {
    const f = makeFoe(z, boss && i === 0);
    f.x = W + 10 + i * 20;
    B.foes.push(f);
  }
  if (boss) { callout('CHEFE!', W * 0.7, GY - 44, RAR[5].c, true); B.shake = 0.4; B.flash = 0.3; }
}
function foeSlotX(f) {
  let x = frontX() + 12;
  for (const o of B.foes) {
    if (o.dead) continue;
    const half = (o.spr.w * o.sc) / 2;
    if (o === f) return x + half;
    x += half * 2 + 3;
  }
  return x;
}

/* --- efeitos visuais --- */
function addNum(x, y, v, color, big) { if (B.nums.length < 40) B.nums.push({ x: x + rnd(-3, 3), y, v: Math.max(1, Math.round(v)), color, life: 0.8, big }); }
function burst(x, y, color, n = 6, sp = 45) {
  for (let i = 0; i < n && B.parts.length < 260; i++) {
    const a = rnd(Math.PI, Math.PI * 2), v = rnd(sp * 0.3, sp);
    B.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.6), color, g: 120 });
  }
}
function sparkle(x, y, color, n = 5) {
  for (let i = 0; i < n && B.parts.length < 260; i++) B.parts.push({ x: x + rnd(-5, 5), y: y + rnd(-6, 2), vx: rnd(-6, 6), vy: rnd(-30, -12), life: rnd(0.4, 0.8), color, g: 0, star: true });
}
function callout(text, gx, gy, color, big) {
  const box = $('#callouts');
  if (!box || box.children.length > 6) return;
  const el = document.createElement('div');
  el.className = 'callout' + (big ? ' big' : '');
  el.textContent = text;
  el.style.left = (gx * SC) + 'px'; el.style.top = (gy * SC) + 'px';
  if (color) el.style.color = color;
  box.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/* --- dano e cura --- */
function heroHit(h, mult) {
  const st = PS[h.cls];
  if (!st) return [0, false]; // herói saiu da party com um golpe a caminho
  let d = st.atk * mult * PARTY.mul * rnd(0.9, 1.1);
  const crit = Math.random() * 100 < st.crit;
  if (crit) d *= 1 + st.cdmg / 100;
  return [d, crit];
}
function damageFoe(f, d, crit, h) {
  if (f.dead || !(d > 0)) return 0;
  f.hp -= d; f.flash = 0.08; f.kb = crit ? 4 : 2;
  addNum(f.x, f.top - 3, d, crit ? PAL.y : PAL.w, crit);
  burst(f.x - 3, f.top + 6, f.ghost ? PAL.c : PAL.r, crit ? 6 : 3);
  if (crit) B.shake = Math.max(B.shake, 0.08);
  if (h && PS[h.cls]) {
    const heal = d * PS[h.cls].leech / 100;
    if (heal > 0) { const tgt = h.cls === 'necromante' ? lowestAlly() : h; if (tgt) healHero(tgt, heal, true); }
  }
  if (f.hp <= 0) killFoe(f);
  return d;
}
function lowestAlly() {
  let best = null, r = 2;
  for (const h of alive()) { const x = h.hp / h.max; if (x < r) { r = x; best = h; } }
  return best;
}
function healHero(h, v, quiet) {
  if (h.dead) return;
  const before = h.hp;
  h.hp = Math.min(h.max, h.hp + v);
  if (!quiet && h.hp - before >= 1) { addNum(h.x, GY - 22, h.hp - before, PAL.g); sparkle(h.x, GY - 8, PAL.g, 3); }
}
function damageHero(h, d) {
  const st = PS[h.cls];
  if (Math.random() * 100 < st.dodge) { callout('ESQUIVA', h.x, GY - 26, PAL.c); return; }
  if (Math.random() * 100 < st.block) { callout('BLOQUEIO', h.x, GY - 26, PAL.E); sparkle(h.x + 5, GY - 8, PAL.w, 3); return; }
  d = d * (50 / (50 + st.def)) * (B.wall > 0 ? 0.5 : 1);
  h.hp -= d; h.hurt = 0.15;
  addNum(h.x, GY - 22, d, PAL.R);
  if (h.hp <= 0) { h.hp = 0; h.dead = true; burst(h.x, GY - 6, PAL.E, 10); callout('CAIU', h.x, GY - 26, RAR[5].c); }
}

/* --- ataques de cada classe --- */
function shoot(k, h, target, onHit, opts = {}) {
  B.projs.push({ k, x: h.x + 6, y: GY - 9, target, onHit, owner: h.cls, speed: 170, life: 2, delay: 0, ...opts });
}
function attack(h) {
  const fs = engaged(), front = fs[0];
  if (!front) return;
  const cls = h.cls, st = PS[cls];
  if (CLASSES[cls].alcance === 'perto') {
    h.lunge = 0.12; h.swing = 0.2;
    const [d, crit] = heroHit(h, 1);
    B.fx.push({ k: 'slash', x: h.x + 10, y: GY - 8, life: 0.15, max: 0.15, color: cls === 'ladino' ? PAL.P : PAL.w });
    damageFoe(front, d, crit, h);
  } else if (cls === 'arqueira') {
    h.lunge = -0.08;
    shoot('flecha', h, front, f => { const [d, c] = heroHit(h, 1); damageFoe(f, d, c, h); }, { speed: 230 });
  } else if (cls === 'mago') {
    h.cast = 0.2;
    const mult = 0.7 * (1 + st.area / 100);
    fs.forEach((f, i) => shoot('fogo', h, f, t => { const [d, c] = heroHit(h, mult); damageFoe(t, d, c, h); }, { speed: 130, delay: i * 0.06 }));
  } else if (cls === 'sacerdote') {
    h.cast = 0.2;
    const tgt = lowestAlly();
    if (tgt && tgt.hp / tgt.max < 0.92) {
      B.fx.push({ k: 'raio', x: tgt.x, life: 0.35, max: 0.35, color: PAL.y });
      healHero(tgt, (st.hp * 0.16 + st.atk * 1.5) * (1 + st.heal / 100));
    } else shoot('luz', h, front, f => { const [d, c] = heroHit(h, 0.9); damageFoe(f, d, c, h); }, { speed: 160 });
  } else if (cls === 'necromante') {
    h.cast = 0.2;
    shoot('sombra', h, front, f => { const [d, c] = heroHit(h, 1); damageFoe(f, d, c, h); }, { speed: 140 });
  } else if (cls === 'bardo') {
    h.cast = 0.2;
    shoot('nota', h, front, f => { const [d, c] = heroHit(h, 0.8); damageFoe(f, d, c, h); }, { speed: 120 });
  }
}
function castSkill(h) {
  const fs = engaged(), st = PS[h.cls], sk = CLASSES[h.cls].skill;
  if (!fs.length) return false;
  h.glow = 0.5;
  callout(sk.n.toUpperCase(), h.x, GY - 36, PAL.y);
  switch (h.cls) {
    case 'cavaleiro': B.wall = 4; break;
    case 'arqueira':
      for (let i = 0; i < 6; i++) shoot('flecha', h, null, f => { const [d, c] = heroHit(h, 0.8); damageFoe(f, d, c, h); }, { speed: 260, delay: i * 0.08, pickFoe: true });
      break;
    case 'sacerdote':
      for (const a of B.heroes) {
        if (a.dead) { a.dead = false; a.hp = a.max * 0.4; } else healHero(a, a.max * 0.4 * (1 + st.heal / 100));
        B.fx.push({ k: 'pilar', x: a.x, life: 0.7, max: 0.7, color: PAL.y });
      }
      break;
    case 'mago': {
      const tx = fs.reduce((a, f) => a + f.x, 0) / fs.length;
      B.fx.push({ k: 'meteoro', x: tx + 40, y: -20, tx, ty: GY - 6, life: 0.55, max: 0.55, onEnd: () => {
        B.shake = 0.35; B.flash = 0.15;
        B.fx.push({ k: 'anel', x: tx, y: GY - 4, life: 0.4, max: 0.4, r: 30, color: PAL.R });
        burst(tx, GY - 4, PAL.R, 24, 80); burst(tx, GY - 4, PAL.y, 12, 60);
        for (const f of engaged()) { const [d, c] = heroHit(h, 3 * (1 + st.area / 100)); damageFoe(f, d, c, h); }
      } });
      break;
    }
    case 'barbaro':
      h.spin = 0.6;
      for (const f of fs) { const [d, c] = heroHit(h, 1.6 * (1 + st.area / 200)); damageFoe(f, d, c, h); healHero(h, d * 0.1, true); }
      B.fx.push({ k: 'anel', x: h.x, y: GY - 7, life: 0.4, max: 0.4, r: 22, color: PAL.E });
      break;
    case 'ladino': {
      const f = fs[0];
      h.vanish = 0.35;
      burst(h.x, GY - 6, PAL.o, 10, 30);
      B.fx.push({ k: 'atraso', life: 0.3, max: 0.3, onEnd: () => {
        if (f.dead) return;
        B.fx.push({ k: 'corte', x: f.x, y: f.top + 6, life: 0.3, max: 0.3 });
        damageFoe(f, st.atk * 5 * (1 + st.cdmg / 100) * PARTY.mul, true, h);
      } });
      break;
    }
    case 'necromante':
      for (let i = 0; i < 2; i++) {
        B.summons.push({ x: frontX() + 4 - i * 9, life: 8, atkT: 0.5 + i * 0.3, rise: 0.4, mult: 0.55, owner: h, swing: 0 });
        burst(frontX() + 4 - i * 9, GY - 2, PAL.P, 8, 25);
      }
      break;
    case 'bardo': B.ballad = 5; break;
  }
  return true;
}

function killFoe(f) {
  f.dead = true; f.dieT = 0.4;
  burst(f.x, f.top + 8, f.boss ? PAL.y : PAL.E, f.boss ? 30 : 10, f.boss ? 90 : 50);
  const g = f.gold * PARTY.goldMul;
  S.gold += g; S.kills++;
  for (let i = 0; i < (f.boss ? 8 : 2); i++) B.parts.push({ x: f.x, y: f.top + 6, vx: rnd(-30, 30), vy: rnd(-80, -40), life: 0.9, color: PAL.y, g: 160, coin: true });
  for (const h of B.heroes) gainXp(h, f.xp);
  if (Math.random() < (f.boss ? 1 : 0.12) * Math.min(3, PARTY.luck)) {
    const it = RG.makeItem(S.zone, RG.rollRarity(PARTY.luck, f.boss ? 2 : 0));
    B.drops.push({ x: f.x, it, t: 0 });
    gotItem(it);
  }
  if (f.boss) {
    tryPet();
    S.zone++; S.maxZone = Math.max(S.maxZone, S.zone); S.zk = 0;
    toast(`Chefe derrotado! Zona ${zoneName(S.zone)}`, RAR[4].c);
    saveSoon(1000);
  } else S.zk = Math.min(ZK, S.zk + 1);
  saveSoon();
}
function tryPet() {
  const key = Object.keys(PETS).find(k => PETS[k].bioma === biomeIdx(S.zone));
  if (!key) return;
  const first = !S.petsFound[key];
  if (!first && Math.random() > RG.PET_DROP * Math.min(3, PARTY.luck)) return;
  if (S.pets.length >= PETS_MAX) { toast('Limite de pets atingido. Solte algum para pegar novos.', RAR[5].c); return; }
  const p = RG.makePet(key, first ? 0 : RG.rollRarity(PARTY.luck));
  S.pets.push(p); S.petsFound[key] = true;
  if (!S.pet) { S.pet = p.id; recalc(); }
  callout('NOVO PET!', W * 0.55, GY - 46, RAR[p.r].c, true);
  toast(`Pet encontrado: ${PETS[key].n} (${RAR[p.r].n})`, RAR[p.r].c);
  if (tab === 'mochila' || tab === 'party') render();
}
function gainXp(h, x) {
  const hero = S.heroes[h.cls];
  hero.xp += x;
  let up = false;
  while (hero.xp >= xpFor(hero.lvl)) { hero.xp -= xpFor(hero.lvl); hero.lvl++; up = true; }
  if (up) {
    recalc();
    if (!h.dead) h.hp = h.max;
    B.fx.push({ k: 'pilar', x: h.x, life: 0.8, max: 0.8, color: PAL.y });
    sparkle(h.x, GY - 10, PAL.y, 8);
    callout('NÍVEL ' + hero.lvl, h.x, GY - 30, PAL.B);
    if (tab === 'party') render();
  }
}
function gotItem(it, quiet) {
  S.found[it.r]++;
  if (it.r <= S.autoScrap - 1 || S.bag.length >= BAG_MAX) {
    S.gold += RG.scrapValue(it);
    if (!quiet && S.bag.length >= BAG_MAX && it.r > S.autoScrap - 1) toast('Mochila cheia! Item vendido como sucata', RAR[5].c);
    return false;
  }
  S.bag.push(it);
  if (!quiet && it.r >= 3) { toast(`${RAR[it.r].n.toUpperCase()}! ${RG.itemName(it)}`, RAR[it.r].c); B.flash = Math.max(B.flash, 0.12); }
  if (tab === 'mochila') render();
  return true;
}

function step(dt) {
  B.time += dt;
  for (const k of ['shake', 'wall', 'ballad', 'flash']) B[k] = Math.max(0, B[k] - dt);
  // party caída: recomeça a zona
  if (B.wipe > 0) {
    B.wipe -= dt;
    if (B.wipe <= 0) { for (const h of B.heroes) { h.dead = false; h.hp = h.max; } B.spawnT = 0.8; }
  } else if (B.heroes.length && B.heroes.every(h => h.dead)) {
    const boss = B.foes.some(f => f.boss && !f.dead);
    for (const f of B.foes) if (!f.dead) { f.dead = true; f.dieT = 0.4; }
    S.zk = 0; B.wipe = 2; B.summons = [];
    toast(boss ? 'O chefe venceu. Melhore o equipamento e tente de novo' : 'A party caiu e recomeçou a zona', RAR[5].c);
  }
  // ondas
  const living = B.foes.filter(f => !f.dead);
  if (!living.length && B.wipe <= 0) {
    if (B.foes.length && B.foes.every(f => f.dieT <= 0)) {
      B.foes = [];
      for (const h of B.heroes) if (h.dead) { h.dead = false; h.hp = h.max * 0.4; sparkle(h.x, GY - 8, PAL.y, 4); }
      B.spawnT = 0.7;
    }
    if (!B.foes.length) { B.spawnT -= dt; if (B.spawnT <= 0) spawnWave(); }
  }
  let anyArrived = false;
  for (const f of B.foes) {
    if (f.dead) { f.dieT -= dt; continue; }
    const tx = foeSlotX(f);
    if (f.x > tx + 0.5) { f.x = Math.max(tx, f.x - 75 * dt); f.arrived = f.x - tx < 2; } else { f.x = tx; f.arrived = true; }
    if (f.arrived) anyArrived = true;
    f.top = GY - f.spr.h * f.sc + (f.fly ? -8 : 0);
    f.flash -= dt; f.kb = Math.max(0, f.kb - dt * 20); f.lunge = Math.max(0, f.lunge - dt);
    if (f.arrived && B.wipe <= 0) {
      f.atkT -= dt;
      if (f.atkT <= 0) {
        f.atkT = 1 / f.aspd; f.lunge = 0.12;
        const al = alive();
        if (al.length) {
          // inimigos preferem o tanque; sem ele, atacam quem está na frente
          const tank = al.find(h => h.cls === 'cavaleiro');
          const tgt = tank && Math.random() < 0.7 ? tank : (Math.random() < 0.6 ? al.reduce((a, b) => (b.x0 > a.x0 ? b : a)) : pick(al));
          damageHero(tgt, f.atk * rnd(0.9, 1.1));
        }
      }
    }
  }
  B.walking = !anyArrived && B.wipe <= 0;
  // heróis
  const fight = engaged().length > 0;
  for (const h of B.heroes) {
    h.lunge = h.lunge > 0 ? Math.max(0, h.lunge - dt) : Math.min(0, h.lunge + dt);
    for (const k of ['swing', 'hurt', 'cast', 'glow', 'spin', 'vanish']) h[k] = Math.max(0, h[k] - dt);
    h.x += (h.x0 - h.x) * Math.min(1, dt * 8);
    if (h.dead) continue;
    if (!fight) { h.hp = Math.min(h.max, h.hp + h.max * 0.08 * dt); continue; }
    h.atkT -= dt * (B.ballad > 0 ? 1.6 : 1);
    if (h.atkT <= 0) { h.atkT = 1 / PS[h.cls].rate; attack(h); }
    h.skillT -= dt;
    if (h.skillT <= 0 && castSkill(h)) h.skillT = CLASSES[h.cls].skill.cd;
  }
  // invocações do Necromante
  for (const s of B.summons) {
    s.life -= dt; s.rise = Math.max(0, s.rise - dt); s.atkT -= dt; s.swing = Math.max(0, s.swing - dt);
    const f = engaged()[0];
    if (f && s.atkT <= 0 && s.rise <= 0) {
      s.atkT = 0.9; s.swing = 0.15;
      const [d, c] = heroHit(s.owner, s.mult); damageFoe(f, d, c);
    }
  }
  B.summons = B.summons.filter(s => s.life > 0);
  // o Dragãozinho cospe fogo
  const pet = activePet();
  if (pet && pet.pet === 'dragaozinho' && fight) {
    B.petT -= dt;
    if (B.petT <= 0) {
      B.petT = 4;
      const f = engaged()[0];
      let sum = 0; for (const c of S.party) sum += PS[c].atk;
      B.fx.push({ k: 'sopro', x: petX(), y: GY - 12, tx: f.x, life: 0.4, max: 0.4 });
      damageFoe(f, sum * 0.5 * (1 + RG.petBonus(pet) / 20), false);
    }
  }
  // projéteis
  for (const p of B.projs) {
    if (p.delay > 0) { p.delay -= dt; continue; }
    if (!p.target || p.target.dead) { const fs = engaged(); p.target = fs.length ? (p.pickFoe ? pick(fs) : fs[0]) : null; if (!p.target) { p.life = 0; continue; } }
    const tx = p.target.x, ty = p.target.top + p.target.spr.h * p.target.sc * 0.4;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    p.ang = Math.atan2(dy, dx);
    if (d < p.speed * dt + 2) { p.life = 0; p.onHit(p.target); if (p.k === 'fogo') burst(tx, ty, PAL.R, 5, 35); continue; }
    p.x += (dx / d) * p.speed * dt; p.y += (dy / d) * p.speed * dt;
    p.life -= dt;
    if (p.k === 'fogo' && Math.random() < 0.7) B.parts.push({ x: p.x, y: p.y, vx: rnd(-8, 8), vy: rnd(-12, 0), life: 0.25, color: pick([PAL.R, PAL.y, PAL.r]), g: 0 });
    if (p.k === 'sombra' && Math.random() < 0.6) B.parts.push({ x: p.x, y: p.y, vx: 0, vy: rnd(-6, 6), life: 0.3, color: PAL.P, g: 0 });
    if (p.k === 'luz' && Math.random() < 0.5) B.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, color: PAL.y, g: 0 });
  }
  B.projs = B.projs.filter(p => p.life > 0);
  // efeitos
  for (const e of B.fx) {
    e.life -= dt;
    if (e.k === 'meteoro') {
      const f = 1 - e.life / e.max; e.cx = e.x + (e.tx - e.x) * f; e.cy = e.y + (e.ty - e.y) * f;
      if (Math.random() < 0.9) B.parts.push({ x: e.cx, y: e.cy, vx: rnd(-10, 10), vy: rnd(-10, 5), life: 0.35, color: pick([PAL.R, PAL.y]), g: 0 });
    }
    if (e.life <= 0 && e.onEnd) { const fn = e.onEnd; e.onEnd = null; fn(); }
  }
  B.fx = B.fx.filter(e => e.life > 0);
  if (B.walking) B.scroll += 32 * dt;
  for (const n of B.nums) { n.life -= dt; n.y -= 16 * dt; }
  B.nums = B.nums.filter(n => n.life > 0);
  for (const p of B.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if (p.y > GY && p.g) { p.y = GY; p.vy *= -0.3; p.vx *= 0.6; } }
  B.parts = B.parts.filter(p => p.life > 0);
  for (const d of B.drops) d.t += dt;
  B.drops = B.drops.filter(d => d.t < 1.6);
  weather(dt);
}

/* --- clima de cada bioma --- */
function weather(dt) {
  const k = biomeOf(S.zone).clima, rate = reduceMotion ? 2 : 10;
  if (B.weather.length < 50 && Math.random() < rate * dt) {
    const w = { x: rnd(0, W), y: rnd(0, GY), life: rnd(3, 6), k, ph: Math.random() * 6, vx: 0, vy: 0 };
    if (k === 'neve' || k === 'folhas') { w.y = -2; w.vx = k === 'folhas' ? rnd(-12, -4) : rnd(-4, 2); w.vy = k === 'folhas' ? rnd(10, 18) : rnd(8, 16); }
    else if (k === 'brasas' || k === 'almas') { w.y = GY + rnd(-4, 2); w.vx = rnd(-4, 4); w.vy = k === 'brasas' ? rnd(-18, -8) : rnd(-8, -3); }
    else { w.vx = rnd(-3, 3); w.vy = rnd(-3, 3); w.y = rnd(GY * 0.4, GY - 4); }
    B.weather.push(w);
  }
  for (const w of B.weather) { w.life -= dt; w.x += (w.vx + (B.walking ? -10 : 0)) * dt; w.y += w.vy * dt; w.ph += dt * 3; }
  B.weather = B.weather.filter(w => w.life > 0 && w.y < GY + 6 && w.x > -4);
}

/* ---------------------------- DESENHO ---------------------------- */
function sky(bm) {
  const key = bm.n + W + 'x' + H;
  if (skyCache[key]) return skyCache[key];
  const c = mk(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, GY);
  g.addColorStop(0, bm.sky[0]); g.addColorStop(1, bm.sky[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // degraus de cor, para lembrar pixel art
  for (let i = 1; i < 8; i++) { x.fillStyle = 'rgba(26,28,44,0.06)'; x.fillRect(0, Math.round((GY * i) / 8), W, Math.round(GY / 16)); }
  return (skyCache[key] = c);
}
const petX = () => (B.heroes.length ? Math.min(...B.heroes.map(h => h.x0)) : 40) - 14;
function drawSprite(s, x, y, flip, white, sc = 1, alpha = 1) {
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(white ? s.white : flip ? s.flip : s.img, Math.round(x - (s.w * sc) / 2), Math.round(y - s.h * sc), s.w * sc, s.h * sc);
  if (alpha < 1) ctx.globalAlpha = 1;
}
function bar(x, y, w, v, color) {
  x = Math.round(x - w / 2); y = Math.round(y);
  ctx.fillStyle = PAL.k; ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = PAL.o; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.round(w * clamp(v, 0, 1)), 2);
}
function draw() {
  const bm = biomeOf(S.zone), t = B.time;
  ctx.save();
  if (B.shake > 0 && !reduceMotion) ctx.translate(Math.round(rnd(-2, 2)), Math.round(rnd(-1, 1)));
  ctx.drawImage(sky(bm), 0, 0);
  for (let i = 0; i < 14; i++) {
    const x = mod(hash(i, 3) * 400 - B.scroll * 0.05, W + 20) - 10, y = hash(i, 9) * GY * 0.45;
    ctx.fillStyle = `rgba(244,244,244,${0.3 + 0.3 * Math.sin(t * 2 + i)})`;
    ctx.fillRect(Math.round(x), Math.round(y), hash(i, 1) > 0.7 ? 2 : 1, 1);
  }
  // duas camadas de colinas em velocidades diferentes dão profundidade
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? bm.hill : 'rgba(26,28,44,0.25)';
    const sp = layer ? 0.3 : 0.12, amp = layer ? 1 : 1.6;
    for (let x = 0; x < W; x++) {
      const wx = x + B.scroll * sp + layer * 300;
      const h = (10 + Math.sin(wx * 0.035) * 6 + Math.sin(wx * 0.013 + 2) * 8) * amp;
      ctx.fillRect(x, Math.round(GY - h), 1, Math.ceil(h));
    }
  }
  const off = B.scroll * 0.7, C = 46;
  for (let i = Math.floor(off / C) - 1; i <= Math.floor((off + W) / C) + 1; i++) {
    if (hash(i, 77) > 0.7) continue;
    const s = SPR[bm.deco[(hash(i, 5) * bm.deco.length) | 0]];
    ctx.drawImage(s.img, Math.round(i * C + hash(i, 11) * 20 - off), GY - s.h + 1);
  }
  ctx.fillStyle = bm.ground; ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = bm.dirt; ctx.fillRect(0, GY + 3, W, H - GY - 3);
  for (let x = 0; x < W; x++) {
    const wx = Math.floor(x + B.scroll);
    if (hash(wx, 1) < 0.25) { ctx.fillStyle = bm.ground; ctx.fillRect(x, GY + 3 + ((hash(wx, 2) * (H - GY - 4)) | 0), 1, 1); }
    if (hash(wx, 4) < 0.15) { ctx.fillStyle = bm.dirt; ctx.fillRect(x, GY - 1, 1, 1); }
  }
  for (const w of B.weather) drawWeather(w);
  // escudo da Muralha
  if (B.wall > 0 && B.heroes.length) {
    const xs = B.heroes.map(h => h.x0), x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10;
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 10); ctx.fillStyle = PAL.B;
    ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, GY - 2, (x1 - x0) / 2, 20, 0, Math.PI, 0); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = PAL.c; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  }
  // pet
  const pet = activePet();
  if (pet) {
    const s = PET_SPR[pet.pet], fly = pet.pet === 'fantasminha' || pet.pet === 'dragaozinho';
    const bob = fly ? Math.round(Math.sin(t * 4) * 2) - 8 : -(B.walking ? Math.floor(t * 8) % 2 : 0);
    ctx.fillStyle = 'rgba(10,8,25,0.35)'; ctx.fillRect(Math.round(petX() - 3), GY, 6, 1);
    drawSprite(s, petX(), GY + bob, false, false, 1, pet.pet === 'fantasminha' ? 0.8 : 1);
    if (pet.r >= 4 && Math.random() < 0.15) sparkle(petX(), GY - 4, RAR[pet.r].c, 1);
  }
  // esqueletos invocados saem do chão
  for (const s of B.summons) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, GY + 1); ctx.clip();
    drawSprite(SPR.esqueletoAliado, s.x + (s.swing > 0 ? 2 : 0), GY + (s.rise / 0.4) * 14, true, false, 1, s.life < 1 ? s.life : 0.9);
    ctx.restore();
  }
  for (const h of [...B.heroes].sort((a, b) => a.x0 - b.x0)) drawHero(h, t);
  // inimigos
  for (const f of B.foes) {
    if (f.dead && f.dieT <= 0) continue;
    const s = f.spr, w = s.w * f.sc;
    const a = f.dead ? Math.max(0, f.dieT / 0.4) : f.ghost ? 0.75 : 1;
    const bob = f.fly ? Math.round(Math.sin(t * 9 + f.x) * 2) : (B.walking || !f.arrived ? Math.floor(t * 7 + f.x) % 2 : 0);
    const x = f.x + f.kb - (f.lunge > 0 ? 3 : 0), y = GY + (f.fly ? -8 : 0) - bob + (f.dead ? (1 - a) * 4 : 0);
    ctx.fillStyle = 'rgba(10,8,25,0.4)'; ctx.fillRect(Math.round(f.x - w * 0.35), GY, Math.round(w * 0.7), 2);
    if (f.boss && !f.dead) {
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 6); ctx.fillStyle = PAL.r;
      ctx.beginPath(); ctx.ellipse(f.x, GY - (s.h * f.sc) / 2, w * 0.7, s.h * f.sc * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    drawSprite(s, x, y, FACE_LEFT.has(f.key), f.flash > 0, f.sc, a);
    if (!f.dead) bar(f.x, f.top - 5, f.boss ? 30 : 14, f.hp / f.maxHp, PAL.r);
  }
  // projéteis
  for (const p of B.projs) {
    if (p.delay > 0) continue;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.k === 'flecha') {
      const ux = Math.cos(p.ang || 0), uy = Math.sin(p.ang || 0);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i < 2 ? PAL.w : i === 6 ? PAL.r : PAL.n; ctx.fillRect(Math.round(x - ux * i), Math.round(y - uy * i), 1, 1); }
    } else if (p.k === 'fogo') { ctx.fillStyle = PAL.R; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = PAL.y; ctx.fillRect(x - 1, y - 1, 2, 2); }
    else if (p.k === 'sombra') { ctx.fillStyle = PAL.p; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = PAL.P; ctx.fillRect(x - 1, y - 1, 2, 2); }
    else if (p.k === 'luz') { ctx.fillStyle = PAL.y; ctx.fillRect(x - 1, y - 2, 2, 4); ctx.fillRect(x - 2, y - 1, 4, 2); ctx.fillStyle = PAL.w; ctx.fillRect(x, y, 1, 1); }
    else if (p.k === 'nota') ctx.drawImage(SPR.nota.img, x - 2, y - 3 + Math.round(Math.sin(t * 20)));
  }
  for (const e of B.fx) drawFx(e);
  // itens caindo, com feixe de luz para épicos ou melhores
  for (const d of B.drops) {
    const s = iconSpr(d.it), f = Math.min(1, d.t / 0.5);
    const x = d.x - f * 14, y = GY - 10 - Math.sin(f * Math.PI) * 22 - (d.t > 1.1 ? (d.t - 1.1) * 50 : 0);
    if (d.it.r >= 3) { ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 12); ctx.fillStyle = RAR[d.it.r].c; ctx.fillRect(Math.round(x - 2), 0, 5, GY); ctx.globalAlpha = 1; }
    ctx.globalAlpha = d.t > 1.1 ? Math.max(0, 1 - (d.t - 1.1) * 2) : 1;
    ctx.drawImage(s.img, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
    ctx.globalAlpha = 1;
    if (d.it.r >= 2 && Math.random() < 0.4) sparkle(x, y, RAR[d.it.r].c, 1);
  }
  for (const p of B.parts) {
    ctx.globalAlpha = Math.min(1, p.life * 3);
    if (p.coin) ctx.drawImage(SPR.moeda.img, Math.round(p.x - 2), Math.round(p.y - 2));
    else if (p.star) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3); ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); }
    else { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  }
  ctx.globalAlpha = 1;
  // números de dano; críticos aparecem em dobro
  for (const n of B.nums) {
    ctx.globalAlpha = Math.min(1, n.life * 3);
    const s = String(n.v > 99999 ? fmt(n.v).replace(/\D/g, '') : n.v), d = digits(n.color), sc = n.big ? 2 : 1;
    const pop = n.big && n.life > 0.65 ? 2 : 0;
    for (let i = 0; i < s.length; i++) ctx.drawImage(d[+s[i]], Math.round(n.x - s.length * 2 * sc + i * 4 * sc), Math.round(n.y - pop), 4 * sc, 6 * sc);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (B.flash > 0) { ctx.fillStyle = `rgba(244,244,244,${B.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (B.ballad > 0) { ctx.fillStyle = `rgba(167,240,112,${0.06 + 0.03 * Math.sin(t * 8)})`; ctx.fillRect(0, 0, W, H); }
}
function drawHero(h, t) {
  const s = SPR[h.cls], melee = CLASSES[h.cls].alcance === 'perto';
  if (h.dead) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(Math.round(h.x), GY - 3); ctx.rotate(-Math.PI / 2);
    ctx.drawImage(s.img, -s.w / 2, -s.h / 2); ctx.restore(); ctx.globalAlpha = 1;
    return;
  }
  const walk = B.walking ? Math.floor(t * 7 + h.ph) % 2 : (Math.sin(t * 2.5 + h.ph) > 0.6 ? 1 : 0);
  const lx = h.lunge > 0 ? 5 * (h.lunge / 0.12) : h.lunge < 0 ? -2 : 0;
  const x = h.x + lx, y = GY - walk;
  ctx.fillStyle = 'rgba(10,8,25,0.4)'; ctx.fillRect(Math.round(h.x - 5), GY, 10, 2);
  if (h.glow > 0) { ctx.globalAlpha = h.glow; ctx.fillStyle = PAL.y; ctx.beginPath(); ctx.ellipse(h.x, GY - 7, 10, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (h.vanish > 0) { if (Math.random() < 0.5) burst(h.x, GY - 6, PAL.o, 1, 15); return; }
  ctx.save();
  if (h.spin > 0) { ctx.translate(Math.round(x), 0); ctx.scale(Math.cos(h.spin * 30) >= 0 ? 1 : -1, 1); ctx.translate(-Math.round(x), 0); }
  drawSprite(s, x, y, false, h.hurt > 0 && Math.floor(h.hurt * 40) % 2 === 0);
  if (h.cast > 0 && !melee) { ctx.globalAlpha = Math.min(1, h.cast * 3); drawSprite(s, x, y, false, true); ctx.globalAlpha = 1; }
  const wpn = S.heroes[h.cls].equip.arma;
  if (wpn) {
    const ws = ICON[wpn.b][wpn.r];
    const ang = melee ? (h.swing > 0 ? -1.2 + (1 - h.swing / 0.2) * 2.6 : -0.4) : -0.1 + Math.sin(t * 2 + h.ph) * 0.05;
    ctx.save(); ctx.translate(Math.round(x + 5), Math.round(y - 5)); ctx.rotate(ang);
    ctx.drawImage(ws.img, -2, -ws.h + 2); ctx.restore();
  }
  ctx.restore();
  bar(h.x, GY + 4, 12, h.hp / h.max, h.hp / h.max < 0.3 ? PAL.R : PAL.g);
}
function drawFx(e) {
  const a = Math.max(0, e.life / e.max);
  ctx.globalAlpha = a;
  if (e.k === 'slash') {
    ctx.strokeStyle = e.color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x - 4, e.y, 7 + (1 - a) * 3, -1.2, 1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(e.x - 5, e.y, 5 + (1 - a) * 3, -1, 1); ctx.stroke();
  } else if (e.k === 'corte') {
    ctx.strokeStyle = PAL.P; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(e.x - 10, e.y - 10); ctx.lineTo(e.x + 10, e.y + 10); ctx.moveTo(e.x + 10, e.y - 10); ctx.lineTo(e.x - 10, e.y + 10); ctx.stroke();
  } else if (e.k === 'pilar' || e.k === 'raio') {
    const w = e.k === 'pilar' ? 10 : 4;
    ctx.fillStyle = e.color; ctx.globalAlpha = a * 0.45; ctx.fillRect(Math.round(e.x - w / 2), 0, w, GY);
    ctx.globalAlpha = a; ctx.fillStyle = PAL.w; ctx.fillRect(Math.round(e.x - 1), 0, 2, GY);
    if (Math.random() < 0.5) sparkle(e.x, GY - rnd(0, 20), e.color, 1);
  } else if (e.k === 'meteoro' && e.cx != null) {
    ctx.fillStyle = PAL.R; ctx.beginPath(); ctx.arc(e.cx, e.cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAL.y; ctx.beginPath(); ctx.arc(e.cx - 1, e.cy - 1, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.k === 'anel') {
    ctx.strokeStyle = e.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, Math.max(1, e.r * (1.2 - a)), Math.max(1, e.r * 0.4 * (1.2 - a)), 0, 0, Math.PI * 2); ctx.stroke();
  } else if (e.k === 'sopro') {
    for (let i = 0; i < 6; i++) {
      const f = Math.min(1, (1 - a) + i * 0.05);
      ctx.fillStyle = pick([PAL.R, PAL.y, PAL.r]); ctx.fillRect(Math.round(e.x + (e.tx - e.x) * f), Math.round(e.y + rnd(-3, 3)), 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}
function drawWeather(w) {
  const x = Math.round(w.x), y = Math.round(w.y);
  if (w.k === 'neve') { ctx.fillStyle = PAL.w; ctx.fillRect(x, y, 1, 1); }
  else if (w.k === 'folhas') { ctx.fillStyle = Math.sin(w.ph) > 0 ? PAL.R : PAL.G; ctx.fillRect(x + Math.round(Math.sin(w.ph) * 2), y, 2, 1); }
  else if (w.k === 'brasas') { ctx.fillStyle = Math.sin(w.ph * 3) > 0 ? PAL.R : PAL.y; ctx.fillRect(x, y, 1, 1); }
  else if (w.k === 'almas') { ctx.globalAlpha = 0.5; ctx.fillStyle = PAL.P; ctx.fillRect(x, y, 2, 2); ctx.globalAlpha = 1; }
  else { ctx.globalAlpha = 0.4 + 0.6 * Math.max(0, Math.sin(w.ph * 2)); ctx.fillStyle = PAL.g; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1; }
}

/* ---------------------------- PROGRESSO OFFLINE ---------------------------- */
function offline(sec) {
  sec = Math.min(sec, 12 * 3600);
  if (sec < 30) return;
  const e = makeFoe(S.zone, false);
  const killT = e.hp / Math.max(1, PARTY.dps) + 1.2;
  const kills = Math.floor(sec / killT);
  if (!kills) return;
  const gold = kills * e.gold * PARTY.goldMul, lvl0 = S.party.map(c => S.heroes[c].lvl);
  S.gold += gold; S.kills += kills;
  for (const h of B.heroes) gainXp(h, kills * e.xp);
  const drops = Math.floor(kills * 0.12 * Math.min(3, PARTY.luck)), got = [0, 0, 0, 0, 0, 0];
  let scrapGold = 0;
  for (let i = 0; i < Math.min(drops, 300); i++) {
    const it = RG.makeItem(S.zone, RG.rollRarity(PARTY.luck));
    const before = S.gold;
    if (gotItem(it, true)) got[it.r]++; else scrapGold += S.gold - before;
  }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  const kept = got.map((n, i) => (n ? `<span style="color:${RAR[i].c}">${n} ${RAR[i].n.toLowerCase()}</span>` : '')).filter(Boolean).join(', ');
  openSheet(`<h3>Enquanto você estava fora</h3>
    <p class="small muted">Sua party lutou por ${h ? h + 'h ' : ''}${m}min na zona ${S.zone}.</p>
    <div class="stats"><span>Inimigos derrotados</span><span>${fmt(kills)}</span><span>Ouro</span><span>+${fmt(gold + scrapGold)}</span>
    ${S.party.map((c, i) => `<span>${CLASSES[c].n}</span><span>${lvl0[i] === S.heroes[c].lvl ? 'Nv ' + lvl0[i] : 'Nv ' + lvl0[i] + ' → ' + S.heroes[c].lvl}</span>`).join('')}</div>
    <p class="small">${kept ? 'Itens guardados: ' + kept : 'Nenhum item novo guardado.'}</p>
    <div class="row end"><button class="btn gold" data-act="close">COLETAR</button></div>`, RAR[4].c);
  saveSoon(500);
}

/* ---------------------------- MERCADO ----------------------------
   Três modos com a mesma interface:
   - "firebase": servidor próprio (Cloud Functions conferem cada anúncio e compra)
   - "shared": banco compartilhado do claude.ai (página publicada)
   - "local": só mercadores NPC (arquivo aberto direto)
   Os mercadores NPC aparecem em todos os modos. */
const NPC_NAMES = ['Mercador Zé', 'Dona Brisa', 'Velho Otto', 'Irmã Lume', 'Caravana Sul', 'Ferreiro Bento', 'Ladina Kira', 'Barão Fino'];
const NPC_KEY = SAVE_KEY + '_npc', LOCAL_KEY = SAVE_KEY + '_mkt';
const histKey = it => (it.pet || it.b) + ':' + it.r;
const FB_VER = '10.12.2', FB_REGIAO = 'southamerica-east1';
function loadScript(src) {
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
}
const Market = {
  mode: 'local', db: null, user: null, me: 'eu', tab: rid(),
  npc: [], players: [], names: {}, busy: new Set(), ready: false, hist: {},
  fb: null, goldServer: 0, knownV: -1, syncing: null, pendingSnap: null,
  async init() {
    try { const o = JSON.parse(localStorage.getItem(NPC_KEY)); if (o && Array.isArray(o.list)) this.npc = o.list.map(l => this.cleanListing(l, true)).filter(Boolean); } catch (e) { /* vazio */ }
    try { const o = JSON.parse(localStorage.getItem(LOCAL_KEY)); if (Array.isArray(o)) this.players = o.map(l => this.cleanListing(l)).filter(Boolean); } catch (e) { /* vazio */ }
    this.refreshNpc(true);
    setInterval(() => { this.refreshNpc(false); this.npcBuyers(); }, 20000);
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
      try { await this.initFirebase(window.FIREBASE_CONFIG); }
      catch (e) { console.warn('Firebase indisponível', e); this.mode = 'local'; toast('Servidor indisponível. Jogando com mercadores locais.', RAR[5].c); }
    } else if (window.claude && typeof window.claude.use === 'function') {
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (db && user) {
          const [id, can] = await Promise.all([user.id(), user.can('data.write')]);
          if (id && can !== false) { this.db = db; this.user = user; this.me = id; this.mode = 'shared'; this.players = []; }
        }
      } catch (e) { /* segue no modo local */ }
      if (this.mode === 'shared') { await this.loadCloudSave(); this.subscribe(); }
    }
    this.ready = true;
    if (tab === 'mercado') render();
  },
  cleanListing(l, npc) {
    if (!l || typeof l !== 'object') return null;
    const item = RG.cleanItem(l.item);
    if (!item) return null;
    const t = l.t || (l.criadoEm && typeof l.criadoEm.toMillis === 'function' ? l.criadoEm.toMillis() : 0) || Date.now();
    return {
      id: typeof l.id === 'string' ? l.id.slice(0, 40) : item.id, item, price: clamp(Math.round(+(l.price || l.preco)) || 1, 1, 1e12),
      seller: npc ? 'npc' : String(l.seller || l.vendedor || ''),
      sellerName: npc ? (NPC_NAMES.includes(l.sellerName) ? l.sellerName : NPC_NAMES[0]) : String(l.vendedorNome || '').slice(0, 16),
      status: l.status === 'vendido' ? 'vendido' : 'aberto', t: +t, npc: !!npc,
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
    if (!first && this.npc.length) this.npc.splice((Math.random() * this.npc.length) | 0, 1);
    this.npc = this.npc.filter(l => now - l.t < 30 * 60000);
    while (this.npc.length < 12) {
      const r = RG.rollRarity(2.5, 1);
      const it = Math.random() < 0.12 ? RG.makePet(pick(Object.keys(PETS)), r) : RG.makeItem(clamp(z + ((Math.random() * 5) | 0) - 2, 1, 9999), r);
      this.npc.push({ id: 'npc' + it.id, item: it, price: Math.round(RG.fairPrice(it) * rnd(1.05, 1.7)), seller: 'npc', sellerName: pick(NPC_NAMES), status: 'aberto', t: now - ((Math.random() * 600000) | 0), npc: true });
    }
    this.saveLocalLists();
    if (tab === 'mercado' && !first) render();
  },
  // mercadores compram anúncios de jogadores quando o preço está perto do justo
  npcBuyers() {
    if (this.mode === 'firebase') return;
    for (const l of this.players.filter(x => x.seller === this.me && x.status === 'aberto' && Date.now() - x.t > 30000)) {
      const p = 0.25 * Math.pow(clamp((RG.fairPrice(l.item) * 1.2) / l.price, 0, 1.5), 3);
      if (Math.random() < p) this.settle(l, true);
    }
  },
  open() { return [...this.npc, ...this.players.filter(l => l.status === 'aberto' && l.seller !== this.me)]; },
  mine() { return this.players.filter(l => l.seller === this.me && l.status === 'aberto'); },
  displayName(l) { return l.npc ? l.sellerName : (this.names[l.seller] || l.sellerName || 'Jogador'); },
  modeText() {
    return {
      firebase: ['Mercado online', 'Servidor próprio: cada compra e venda é conferida pelo servidor. Mercadores também vendem itens.'],
      shared: ['Mercado compartilhado', 'Anúncios ao vivo de todos que jogam por esta página, mais os mercadores.'],
      local: ['Mercado local', 'Você negocia com mercadores. Eles também compram seus anúncios quando o preço é justo.'],
    }[this.mode];
  },
  takeFromInventory(it) {
    const list = it.pet ? S.pets : S.bag, i = list.findIndex(x => x.id === it.id);
    if (i < 0) return false;
    list.splice(i, 1);
    if (it.pet && S.pet === it.id) { S.pet = null; recalc(); }
    return true;
  },
  giveToInventory(it) {
    const list = it.pet ? S.pets : S.bag;
    if (list.some(x => x.id === it.id)) return;
    if (!it.pet && S.bag.length >= BAG_MAX) { S.gold += RG.scrapValue(it); return; }
    list.push(it);
  },

  /* ---- ações ---- */
  async list(it, price) {
    price = clamp(Math.round(price), 1, 1e12);
    if (this.mode === 'firebase') {
      try { await this.call('anunciar', { item: it, preco: price, apelido: S.nick }); }
      catch (e) { return e.message || 'Não foi possível anunciar.'; }
      this.takeFromInventory(it); saveNow(); return null;
    }
    if (!this.takeFromInventory(it)) return 'Item não está no inventário';
    const l = { id: it.id, item: it, price, seller: this.me, status: 'aberto', t: Date.now() };
    if (this.mode === 'shared') {
      try { await this.db.collection('mercado').doc(it.id).set(l); }
      catch (e) { this.giveToInventory(it); return e && e.code === 'quota_exceeded' ? 'O mercado está cheio agora. Tente mais tarde.' : 'Não foi possível anunciar. Verifique sua conexão.'; }
      this.players = [...this.players.filter(x => x.id !== l.id), { ...l, npc: false }];
    } else this.players.push({ ...l, npc: false });
    this.saveLocalLists(); saveNow();
    return null;
  },
  async cancel(l) {
    if (this.mode === 'firebase') {
      try { await this.call('cancelar', { id: l.id }); } catch (e) { return e.message || 'Não foi possível cancelar.'; }
      this.players = this.players.filter(x => x.id !== l.id);
      return null; // o item volta pela caixa de entrada
    }
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
    this.giveToInventory(l.item);
    this.saveLocalLists(); saveNow();
    return null;
  },
  async buy(l) {
    if (S.gold < l.price) return 'Ouro insuficiente';
    if (!l.item.pet && S.bag.length >= BAG_MAX) return 'Mochila cheia';
    if (l.item.pet && S.pets.length >= PETS_MAX) return 'Limite de pets atingido';
    if (!l.npc && this.mode === 'firebase') {
      try { await this.sync(); await this.call('comprar', { id: l.id, preco: l.price }); }
      catch (e) { return e.message || 'Não foi possível comprar.'; }
      this.players = this.players.filter(x => x.id !== l.id);
      logTrade('compra', l.item, l.price, false);
      return null; // o item chega pela caixa de entrada e o ouro sai pela carteira
    }
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
      // o histórico de preços é só informativo: uma falha aqui não pode desfazer a compra
      try { this.db.collection('historico').add({ k: histKey(l.item), preco: l.price, t: Date.now() }).catch(() => {}); } catch (e) { /* ignora */ }
    }
    S.gold -= l.price;
    this.giveToInventory(l.item);
    if (l.npc) this.npc = this.npc.filter(x => x.id !== l.id);
    else if (this.mode === 'local') this.players = this.players.filter(x => x.id !== l.id);
    if (this.mode !== 'shared' || l.npc) this.localHist(l.item, l.price);
    logTrade('compra', l.item, l.price, l.npc);
    this.saveLocalLists(); saveNow();
    return null;
  },
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
      S.gold += RG.net(l.price);
      if (byNpc) this.localHist(l.item, l.price);
      logTrade('venda', l.item, RG.net(l.price), byNpc);
      toast(`Vendido! ${RG.itemName(l.item)} por ${fmt(RG.net(l.price))} de ouro`, PAL.y);
      this.saveLocalLists(); saveNow();
      if (tab === 'mercado') render();
    } catch (e) { /* tenta de novo no próximo aviso */ } finally { this.busy.delete(l.id); }
  },

  /* ---- histórico de preços (ajuda a escolher o preço do anúncio) ---- */
  localHist(it, price) {
    const k = histKey(it);
    this.hist[k] = [price, ...(this.hist[k] || [])].slice(0, 5);
  },
  async history(it) {
    const k = histKey(it);
    try {
      if (this.mode === 'firebase') {
        const q = await this.fb.db.collection('historico').where('chave', '==', k).orderBy('em', 'desc').limit(5).get();
        return q.docs.map(d => +d.data().preco).filter(Number.isFinite);
      }
      if (this.mode === 'shared') {
        const q = await this.db.collection('historico').where('k', '==', k).orderBy('t', 'desc').limit(5).get();
        return q.docs.map(d => +d.data().preco).filter(Number.isFinite);
      }
    } catch (e) { /* sem histórico */ }
    return this.hist[k] || [];
  },

  /* ---- banco compartilhado do claude.ai ---- */
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

  /* ---- Firebase ---- */
  async initFirebase(cfg) {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    if (!window.firebase) {
      await loadScript(base + 'firebase-app-compat.js');
      await Promise.all(['auth', 'firestore', 'functions'].map(m => loadScript(base + `firebase-${m}-compat.js`)));
    }
    const app = window.firebase.initializeApp(cfg);
    const auth = app.auth(), db = app.firestore(), fn = app.functions(FB_REGIAO);
    if (window.FIREBASE_EMULADOR) {
      auth.useEmulator('http://127.0.0.1:9099'); db.useEmulator('127.0.0.1', 8080); fn.useEmulator('127.0.0.1', 5001);
    }
    const cred = await auth.signInAnonymously();
    this.fb = { auth, db, fn };
    this.me = cred.user.uid; this.mode = 'firebase'; this.players = [];
    // save na nuvem: o mais recente vence (o ouro oficial vem da carteira do servidor)
    try {
      const snap = await db.doc('jogadores/' + this.me).get();
      if (snap.exists && snap.data().save) {
        const cloud = cleanSave(snap.data().save);
        if (cloud.t > S.t) { S = cloud; recalc(); render(); }
      }
    } catch (e) { /* segue com o save local */ }
    const first = await this.sync(true);
    if (first) toast('Conectado ao servidor do mercado', RAR[1].c);
    // só vale o que o servidor confirmou; gravações locais pendentes são ignoradas
    db.doc('carteiras/' + this.me).onSnapshot(s => { if (s.exists && !s.metadata.hasPendingWrites) this.onWallet(s.data()); }, () => {});
    db.collection(`jogadores/${this.me}/caixa`).onSnapshot(q => q.docs.forEach(d => this.onMail(d)), () => {});
    db.collection('anuncios').where('status', '==', 'aberto').orderBy('criadoEm', 'desc').limit(300).onSnapshot(q => {
      this.players = q.docs.map(d => this.cleanListing({ ...d.data(), id: d.id })).filter(Boolean);
      if (tab === 'mercado') render();
    }, e => console.warn('anúncios', e));
    setInterval(() => this.sync(), 30000);
    this.pushSave();
  },
  call(name, data) {
    return this.fb.fn.httpsCallable(name)(data).then(r => r.data).catch(e => { throw new Error(e.message || 'Erro no servidor'); });
  },
  // o servidor guarda o ouro oficial; o jogo envia quanto ganhou ou gastou desde a última vez
  async sync(first) {
    if (this.mode !== 'firebase') return null;
    if (this.syncing) return this.syncing;
    const base = first ? 0 : this.goldServer;
    const delta = Math.floor(S.gold - base);
    this.syncing = this.call('sincronizar', { delta, zona: S.maxZone, primeiro: !!first }).then(r => {
      // o que foi ganho durante a chamada continua pendente para a próxima
      const unsynced = S.gold - base - delta;
      S.gold = r.ouro + Math.max(0, unsynced);
      this.goldServer = r.ouro; this.knownV = r.v;
      this.syncing = null;
      if (this.pendingSnap && +this.pendingSnap.v > this.knownV) { const p = this.pendingSnap; this.pendingSnap = null; this.onWallet(p); }
      return r;
    }).catch(e => { console.warn('sincronizar', e); this.syncing = null; return null; });
    return this.syncing;
  },
  onWallet(d) {
    const v = +d.v || 0;
    if (v <= this.knownV) return;
    if (this.syncing) { this.pendingSnap = d; return; }
    S.gold += (+d.ouro || 0) - this.goldServer;
    this.goldServer = +d.ouro || 0; this.knownV = v;
  },
  async onMail(doc) {
    const d = doc.data();
    try { await doc.ref.delete(); } catch (e) { return; }
    const it = RG.cleanItem(d.item);
    if (!it) return;
    if (d.tipo === 'item') { this.giveToInventory(it); toast(`${RG.itemName(it)} chegou ao inventário`, RAR[it.r].c); }
    else if (d.tipo === 'venda') { logTrade('venda', it, +d.valor || 0, false); toast(`Vendido! ${RG.itemName(it)} por ${fmt(+d.valor || 0)} de ouro`, PAL.y); }
    saveNow();
    if (tab !== 'party') render();
  },

  /* ---- save na nuvem ---- */
  cloudRef() { return this.db.doc('data/users/' + this.me + '/save'); },
  async loadCloudSave() {
    try {
      const snap = await this.cloudRef().get();
      if (snap.exists) { const cloud = cleanSave(snap.data()); if (cloud.t > S.t) { S = cloud; recalc(); render(); } }
      this.pushSave();
    } catch (e) { /* segue com o save local */ }
  },
  pushing: null, again: false,
  async pushSave() {
    if (this.mode !== 'shared' && this.mode !== 'firebase') return;
    if (this.pushing) { this.again = true; return; }
    const data = JSON.parse(JSON.stringify(S));
    this.pushing = (this.mode === 'firebase'
      ? this.fb.db.doc('jogadores/' + this.me).set({ save: data, t: Date.now() })
      : this.cloudRef().set(data)).catch(() => { /* fica no save local */ });
    await this.pushing;
    this.pushing = null;
    if (this.again) { this.again = false; this.pushSave(); }
    if (this.mode === 'firebase') this.sync();
  },
};
function logTrade(k, it, p, npc) {
  S.log.unshift({ k, r: it.r, n: RG.itemName(it), p, npc, t: Date.now() });
  S.log = S.log.slice(0, 30);
}

/* ---------------------------- FUSÃO ---------------------------- */
const PLURAL = ['comuns', 'incomuns', 'raros', 'épicos', 'lendários', 'míticos'];
const fuseChance = r => Math.min(0.95, RG.FUSE_CHANCE[r] + S.pity[r]);
let forge = [], forging = false, forgeErr = '';
const forgeItems = () => forge.map(id => S.bag.find(x => x.id === id)).filter(Boolean);
const forgeLevel = items => Math.max(1, Math.round(items.reduce((a, it) => a + it.l, 0) / items.length));
function forgePick(id) {
  const it = S.bag.find(x => x.id === id);
  if (!it || it.r >= 5) return;
  const cur = forgeItems();
  if (forge.includes(id)) forge = forge.filter(x => x !== id);
  else if (cur.length && cur[0].r !== it.r) forge = [id];
  else if (cur.length < RG.FUSE_N) forge.push(id);
}
function forgeAuto() {
  const cur = forgeItems();
  let r = cur.length ? cur[0].r : -1;
  if (r < 0) {
    const n = [0, 0, 0, 0, 0];
    for (const it of S.bag) if (it.r < 5) n[it.r]++;
    r = n.findIndex(c => c >= RG.FUSE_N);
    if (r < 0) return `Você precisa de ${RG.FUSE_N} itens da mesma raridade`;
  }
  const pool = S.bag.filter(it => it.r === r && !forge.includes(it.id)).sort((a, b) => a.l - b.l);
  while (forge.length < RG.FUSE_N && pool.length) forge.push(pool.shift().id);
  return forge.length < RG.FUSE_N ? `Faltam ${RG.FUSE_N - forge.length} itens ${PLURAL[r]}` : null;
}
function doFuse() {
  const items = forgeItems();
  if (items.length !== RG.FUSE_N || forging) return null;
  const r = items[0].r;
  if (r >= 5 || items.some(it => it.r !== r)) return null;
  const l = forgeLevel(items), cost = RG.fuseCost(r, l);
  if (S.gold < cost) return null;
  S.gold -= cost;
  S.bag = S.bag.filter(it => !forge.includes(it.id));
  forge = [];
  const chance = fuseChance(r), ok = Math.random() < chance;
  let out = null;
  if (ok) {
    // o tipo que mais aparece entre os 6 decide o resultado
    const cnt = {};
    for (const it of items) cnt[it.b] = (cnt[it.b] || 0) + 1;
    const top = Math.max(...Object.values(cnt));
    out = RG.makeItem(l, r + 1, pick(Object.keys(cnt).filter(b => cnt[b] === top)));
    S.bag.push(out); S.found[r + 1]++; S.pity[r] = 0; S.fuse.ok++;
  } else {
    S.pity[r] = Math.round((S.pity[r] + RG.FUSE_PITY[r]) * 100) / 100; S.fuse.fail++;
  }
  saveNow();
  return { ok, r, items, out, chance };
}

/* ---------------------------- INTERFACE ---------------------------- */
let tab = 'party', mktView = 'comprar', bagView = 'itens';
const filt = { s: '', r: 0, o: 'recentes' };
const rv = r => `--r:${RAR[r].c}`;
function setText(sel, v) { const el = $(sel); if (el && el.textContent !== v) el.textContent = v; }
function hud() {
  setText('#gold', fmt(S.gold));
  setText('#zoneName', zoneName(S.zone));
  setText('#bagCount', String(S.bag.length));
  const boss = S.zk >= ZK && S.auto, bf = B.foes.find(f => f.boss && !f.dead);
  const fill = $('#zoneFill');
  fill.style.width = (boss && bf ? Math.max(0, bf.hp / bf.maxHp) * 100 : (S.zk / ZK) * 100) + '%';
  fill.classList.toggle('boss', boss);
  setText('#zoneTxt', boss ? 'CHEFE' : S.zk + '/' + ZK);
  for (const h of B.heroes) {
    const el = document.querySelector(`.pm[data-cls="${h.cls}"]`);
    if (!el) continue;
    const hero = S.heroes[h.cls];
    el.querySelector('.hp i').style.width = (h.hp / h.max) * 100 + '%';
    el.querySelector('.sk i').style.width = (1 - clamp(h.skillT / CLASSES[h.cls].skill.cd, 0, 1)) * 100 + '%';
    el.querySelector('.xp i').style.width = Math.min(100, (hero.xp / xpFor(hero.lvl)) * 100) + '%';
    el.classList.toggle('dead', h.dead);
    const lv = el.querySelector('.lv');
    if (lv.textContent !== ' ' + hero.lvl) lv.textContent = ' ' + hero.lvl;
  }
}
function buildPartyBar() {
  const el = $('#partyBar');
  if (!el) return;
  el.innerHTML = S.party.map(cls => `<button class="pm" data-cls="${cls}" data-act="hero" data-id="${cls}" aria-label="${CLASSES[cls].n}">
    <img class="px" src="${clsIcon(cls, 2)}" alt=""><span class="nm">${CLASSES[cls].n}<b class="lv"></b></span>
    <span class="bars"><span class="hp"><i></i></span><span class="sk"><i></i></span><span class="xp"><i></i></span></span></button>`).join('');
}

function render() {
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  const p = $('#panel'), y = p.scrollTop;
  p.innerHTML = tab === 'party' ? partyHtml() : tab === 'mochila' ? bagHtml() : marketHtml();
  p.scrollTop = y;
}

/* --- party --- */
const roleChip = cls => `<span class="chip">${CLASSES[cls].papel}</span>`;
function partyHtml() {
  const sel = S.heroes[S.sel] ? S.sel : S.party[0], c = CLASSES[sel], st = heroStats(sel), hero = S.heroes[sel];
  let h = '<h3>Party</h3><div class="party">';
  S.party.forEach((cls, i) => {
    h += `<div class="pcard ${cls === sel ? 'on' : ''}"><button class="pick" data-act="hero" data-id="${cls}"><img class="px" src="${clsIcon(cls, 4)}" alt="">
      <span class="nm">${CLASSES[cls].n}</span>${roleChip(cls)}<span class="small muted">Nv ${S.heroes[cls].lvl}</span></button>
      <button class="btn small" data-act="roster" data-v="${i}">TROCAR</button></div>`;
  });
  for (let i = S.party.length; i < 3; i++) h += `<div class="pcard empty"><button class="btn small" data-act="roster" data-v="${i}">+ HERÓI</button></div>`;
  h += `</div>
    <div class="herobox"><div class="hhead"><img class="px" src="${clsIcon(sel, 5)}" alt=""><div><div class="hn">${c.n} ${roleChip(sel)}</div>
      <p class="small muted">${c.ds}</p><p class="small"><b class="gold-t">${c.skill.n}</b> · a cada ${c.skill.cd}s · ${c.skill.ds}</p></div></div>
    <div class="stats"><span>Nível · Poder</span><span>${hero.lvl} · ${fmt(heroPower(sel))}</span><span>Ataque</span><span>${fmt(st.atk)}</span><span>Vida</span><span>${fmt(st.hp)}</span>
    <span>Defesa</span><span>${fmt(st.def)}</span><span>Ataques/s</span><span>${st.rate.toFixed(2)}</span>
    <span>Crítico</span><span>${st.crit.toFixed(0)}% · ${(100 + st.cdmg).toFixed(0)}%</span>
    ${['area', 'heal', 'leech', 'block', 'dodge', 'buff', 'gold', 'loot'].filter(k => st[k] > 0).map(k => `<span>${STATS[k].n}</span><span>${+st[k].toFixed(1)}%</span>`).join('')}</div>
    <div class="equip">`;
  for (const k in SLOTS) {
    const it = hero.equip[k];
    h += it
      ? `<button class="slot r${it.r}" style="${rv(it.r)}" data-act="item" data-src="equip" data-id="${it.id}"><img class="px" src="${icon(it, 4)}" alt=""><span class="nm">${esc(RG.itemName(it))}</span><span>Nv ${it.l}</span></button>`
      : `<button class="slot" data-act="pickslot" data-v="${k}"><span class="ph"></span><span class="nm">${SLOTS[k]}</span><span>vazio</span></button>`;
  }
  h += `</div><p class="small muted">Armas: ${c.armas.map(b => BASES[b].n).join(' ou ')}. Armaduras e acessórios servem em qualquer herói.</p></div>`;
  const pet = activePet();
  h += `<h3>Pet</h3>${pet
    ? `<button class="lst" style="${rv(pet.r)}" data-act="pet" data-id="${pet.id}"><img class="px" src="${icon(pet, 4)}" alt=""><span class="nm">${PETS[pet.pet].n}</span>
      <span class="pr">ATIVO</span><span class="sub">${RAR[pet.r].n} · +${RG.petBonus(pet)}% ${RG.PET_STAT_N[PETS[pet.pet].stat]}</span></button>`
    : '<div class="empty small">Nenhum pet ativo. Chefes deixam pets: o primeiro chefe de cada bioma sempre deixa um.</div>'}
    ${S.pets.length ? `<button class="btn small" data-act="tab" data-tab="mochila" data-v="pets">VER PETS (${S.pets.length})</button>` : ''}`;
  h += `<h3>Heróis</h3><div class="roster">${RECRUIT_ORDER.map(cls => {
    const has = S.heroes[cls], inP = S.party.includes(cls), cc = CLASSES[cls];
    return `<div class="rc ${has ? '' : 'locked'}"><img class="px" src="${clsIcon(cls, 3)}" alt=""><div><div class="nm">${cc.n} ${roleChip(cls)}</div>
      <div class="small muted">${has ? 'Nv ' + has.lvl + (inP ? ' · na party' : ' · na reserva') : cc.ds}</div></div>
      ${has ? (inP ? '' : `<button class="btn small" data-act="hero" data-id="${cls}">VER</button>`)
        : `<button class="btn small gold" data-act="recruit" data-id="${cls}" ${S.gold < cc.custo ? 'disabled' : ''}>● ${fmt(cc.custo)}</button>`}</div>`;
  }).join('')}</div>`;
  h += `<h3>Ajustes</h3><div class="opts">
    <label>Avançar para o chefe sozinho <input type="checkbox" id="optAuto" ${S.auto ? 'checked' : ''}></label>
    <label>Vender como sucata ao achar
      <select id="optScrap">${['Nada', 'Comuns', 'Até incomuns', 'Até raros'].map((n, i) => `<option value="${i}" ${S.autoScrap === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Nome no mercado <input id="optNick" type="text" maxlength="16" value="${esc(S.nick)}"></label>
    <div class="row"><button class="btn" data-act="zonedown" ${S.zone <= 1 ? 'disabled' : ''}>◀ ZONA</button><button class="btn" data-act="zoneup" ${S.zone >= S.maxZone ? 'disabled' : ''}>ZONA ▶</button>
    <span class="small muted">Melhor zona: ${S.maxZone}</span></div></div>
    <h3>Coleção</h3><div class="stats">${RAR.map((r, i) => `<span style="color:${r.c}">${r.n}</span><span>${fmt(S.found[i])}</span>`).join('')}
    <span>Pets descobertos</span><span>${Object.keys(S.petsFound).length}/${Object.keys(PETS).length}</span>
    <span>Inimigos derrotados</span><span>${fmt(S.kills)}</span></div>`;
  return h;
}
function openRoster(slot) {
  const opts = Object.keys(S.heroes).filter(c => !S.party.includes(c));
  openSheet(`<h3>Escolher herói</h3>${opts.length ? `<div class="list">${opts.map(cls => `<button class="lst" style="--r:var(--line)" data-act="setparty" data-id="${cls}" data-v="${slot}">
      <img class="px" src="${clsIcon(cls, 4)}" alt=""><span class="nm" style="color:var(--bone)">${CLASSES[cls].n}</span><span class="pr">Nv ${S.heroes[cls].lvl}</span>
      <span class="sub">${CLASSES[cls].papel} · ${CLASSES[cls].ds}</span></button>`).join('')}</div>`
    : '<p class="small muted">Todos os heróis recrutados já estão na party. Recrute novas classes na lista de heróis.</p>'}
    <div class="row end">${S.party.length > 1 && slot < S.party.length ? `<button class="btn red" data-act="unparty" data-v="${slot}">TIRAR DA PARTY</button>` : ''}<button class="btn" data-act="close">FECHAR</button></div>`);
}
function compatibleHeroes(it) {
  if (it.pet) return [];
  const cls = BASES[it.b].cls;
  return Object.keys(S.heroes).filter(c => !cls || c === cls).sort((a, b) => S.party.includes(b) - S.party.includes(a));
}
function openSlotPicker(slot) {
  const sel = S.sel, list = S.bag.filter(it => BASES[it.b].s === slot && (!BASES[it.b].cls || BASES[it.b].cls === sel)).sort((a, b) => b.r - a.r || b.l - a.l);
  openSheet(`<h3>${SLOTS[slot]} para ${CLASSES[sel].n}</h3>${list.length ? `<div class="grid">${list.map(it => `<button class="tile r${it.r}" style="${rv(it.r)}" data-act="item" data-src="bag" data-id="${it.id}"><img class="px" src="${icon(it, 4)}" alt=""><b>${it.l}</b></button>`).join('')}</div>`
    : '<p class="small muted">Nenhum item compatível na mochila. Continue lutando ou procure no mercado.</p>'}
    <div class="row end"><button class="btn" data-act="close">FECHAR</button></div>`);
}

/* --- mochila --- */
function bagHtml() {
  const seg = `<div class="seg three"><button data-act="bview" data-v="itens" class="${bagView === 'itens' ? 'on' : ''}">ITENS ${S.bag.length}</button><button data-act="bview" data-v="pets" class="${bagView === 'pets' ? 'on' : ''}">PETS ${S.pets.length}</button><button data-act="bview" data-v="forja" class="${bagView === 'forja' ? 'on' : ''}">FUSÃO</button></div>`;
  if (bagView === 'forja') { const h = forgeHtml(forgeErr); forgeErr = ''; return seg + h; }
  if (bagView === 'pets') return seg + petsHtml();
  if (!S.bag.length) return seg + '<div class="empty">Sua mochila está vazia.<br>A party guarda aqui os itens que encontrar.</div>';
  const list = [...S.bag].sort((a, b) => b.r - a.r || b.l - a.l);
  let h = seg + `<div class="row"><span class="small muted" style="flex:1">${S.bag.length}/${BAG_MAX} · toque para equipar, anunciar ou vender.</span><button class="btn small" data-act="scrapall">SUCATA DOS COMUNS</button></div><div class="grid">`;
  for (const it of list) {
    const cls = BASES[it.b].cls;
    h += `<button class="tile r${it.r}" style="${rv(it.r)}" data-act="item" data-src="bag" data-id="${it.id}" aria-label="${esc(RG.itemName(it))}"><img class="px" src="${icon(it, 4)}" alt=""><b>${it.l}</b>${cls ? `<img class="cl px" src="${clsIcon(cls, 1)}" alt="${CLASSES[cls].n}">` : ''}</button>`;
  }
  return h + '</div>';
}
function petsHtml() {
  const where = `<h3>Onde encontrar</h3><div class="stats">${Object.entries(PETS).map(([k, p]) => `<span>${S.petsFound[k] ? p.n : '???'}</span><span>${BIOMES[p.bioma].n}</span>`).join('')}</div>`;
  if (!S.pets.length) return '<div class="empty">Nenhum pet ainda.<br>Derrote chefes: o primeiro chefe de cada bioma sempre deixa um pet, e os outros têm chance.</div>' + where;
  const list = [...S.pets].sort((a, b) => b.r - a.r);
  return `<div class="list">${list.map(p => `<button class="lst" style="${rv(p.r)}" data-act="pet" data-id="${p.id}"><img class="px" src="${icon(p, 4)}" alt=""><span class="nm">${PETS[p.pet].n}</span>
    <span class="pr">${p.id === S.pet ? 'ATIVO' : ''}</span><span class="sub">${RAR[p.r].n} · +${RG.petBonus(p)}% ${RG.PET_STAT_N[PETS[p.pet].stat]} · Nº ${String(p.m).padStart(4, '0')}</span></button>`).join('')}</div>` + where;
}
function forgeHtml(err) {
  forge = forge.filter(id => S.bag.some(x => x.id === id));
  const items = forgeItems(), r = items.length ? items[0].r : -1, N = RG.FUSE_N;
  let h = '<div class="forge">';
  for (let i = 0; i < N; i++) {
    const it = items[i];
    h += it ? `<button class="tile r${it.r}" style="${rv(it.r)}" data-act="fpick" data-id="${it.id}" aria-label="Tirar ${esc(RG.itemName(it))}"><img class="px" src="${icon(it, 4)}" alt=""><b>${it.l}</b></button>` : '<div class="tile ghost"></div>';
  }
  h += '</div>';
  if (r >= 0) {
    const l = forgeLevel(items), cost = RG.fuseCost(r, l), ch = fuseChance(r), full = items.length === N;
    h += `<div class="fusebox" style="${rv(r + 1)}">
      <div class="fuseline"><span style="color:${RAR[r].c}">${N}× ${RAR[r].n}</span><span class="muted">→</span><span style="color:${RAR[r + 1].c}">1× ${RAR[r + 1].n}</span></div>
      <div class="chance"><div style="width:${ch * 100}%"></div><span>${Math.round(ch * 100)}% de chance${S.pity[r] ? ` (+${Math.round(S.pity[r] * 100)}% de bônus)` : ''}</span></div>
      <div class="stats"><span>Nível do resultado</span><span>${l}</span><span>Custo</span><span style="color:var(--gold)">● ${fmt(cost)}</span></div>
      <p class="small muted">Se falhar, os ${N} itens se perdem e a próxima fusão de itens ${PLURAL[r]} ganha +${Math.round(RG.FUSE_PITY[r] * 100)}% de chance.</p>
      ${err ? `<p class="err">${esc(err)}</p>` : ''}
      <div class="row"><button class="btn gold" data-act="fuse" ${!full || S.gold < cost ? 'disabled' : ''}>${!full ? `FALTAM ${N - items.length}` : S.gold < cost ? 'OURO INSUFICIENTE' : 'FUNDIR'}</button>
      ${full ? '' : '<button class="btn" data-act="fauto">COMPLETAR</button>'}<button class="btn" data-act="fclear">LIMPAR</button></div></div>`;
  } else {
    h += `<p class="small muted">Escolha ${N} itens da mesma raridade para tentar criar um item da raridade seguinte.</p>
      ${err ? `<p class="err">${esc(err)}</p>` : ''}<div class="row"><button class="btn gold" data-act="fauto">ESCOLHER AUTOMÁTICO</button></div>`;
  }
  const pool = S.bag.filter(it => it.r < 5).sort((a, b) => a.r - b.r || a.l - b.l);
  h += pool.length ? '<div class="grid">' + pool.map(it => {
    const sel = forge.includes(it.id), dim = r >= 0 && it.r !== r;
    return `<button class="tile r${it.r} ${sel ? 'sel' : ''} ${dim ? 'dim' : ''}" style="${rv(it.r)}" data-act="fpick" data-id="${it.id}" aria-pressed="${sel}" aria-label="${esc(RG.itemName(it))}"><img class="px" src="${icon(it, 4)}" alt=""><b>${it.l}</b></button>`;
  }).join('') + '</div>' : '<div class="empty">Nenhum item para fundir. Itens míticos já estão no topo.</div>';
  h += `<h3>Chances</h3><div class="stats">${RG.FUSE_CHANCE.map((c, i) => `<span><span style="color:${RAR[i].c}">${RAR[i].n}</span> → <span style="color:${RAR[i + 1].c}">${RAR[i + 1].n}</span></span><span>${Math.round(fuseChance(i) * 100)}%</span>`).join('')}
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
      openItem('bag', res.out.id, null, `<h3 style="color:${RAR[res.r + 1].c}">SUCESSO!</h3>`);
      toast(`Fusão: ${RG.itemName(res.out)}!`, RAR[res.r + 1].c);
    } else {
      openSheet(`<h3 style="color:var(--r5)">A FUSÃO FALHOU</h3><div class="fx broken">${ring}</div>
        <p class="small">Os ${RG.FUSE_N} itens ${PLURAL[res.r]} viraram pó.</p>
        <p class="small muted">A próxima fusão de itens ${PLURAL[res.r]} agora tem ${Math.round(fuseChance(res.r) * 100)}% de chance.</p>
        <div class="row"><button class="btn" data-act="close">OK</button></div>`, RAR[5].c);
    }
    render();
  }, reduceMotion ? 300 : 1300);
}

/* --- mercado --- */
const FILTERS = [['', 'Tudo'], ...Object.keys(CLASSES).map(c => ['c:' + c, 'Armas: ' + CLASSES[c].n]), ...Object.entries(SLOTS).filter(([k]) => k !== 'arma').map(([k, n]) => ['s:' + k, n]), ['pet', 'Pets']];
function matchFilter(it) {
  if (!filt.s) return true;
  if (filt.s === 'pet') return !!it.pet;
  if (it.pet) return false;
  const [k, v] = filt.s.split(':');
  return k === 'c' ? BASES[it.b].cls === v : BASES[it.b].s === v;
}
function marketHtml() {
  const [title, text] = Market.modeText();
  let h = `<div class="mode ${Market.mode !== 'local' ? 'live' : ''}"><i></i><div><b>${title}</b><br>${text} Taxa de venda: 5%.</div></div>
    <div class="seg"><button data-act="mview" data-v="comprar" class="${mktView === 'comprar' ? 'on' : ''}">COMPRAR</button><button data-act="mview" data-v="vendas" class="${mktView === 'vendas' ? 'on' : ''}">MINHAS VENDAS ${Market.mine().length || ''}</button></div>`;
  if (mktView === 'comprar') {
    h += `<div class="filters">
      <select id="fS" aria-label="Tipo">${FILTERS.map(([k, n]) => `<option value="${k}" ${filt.s === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="fR" aria-label="Raridade">${RAR.map((r, i) => `<option value="${i}" ${filt.r === i ? 'selected' : ''}>${i ? r.n + '+' : 'Qualquer'}</option>`).join('')}</select>
      <select id="fO" aria-label="Ordem">${[['recentes', 'Recentes'], ['barato', 'Mais barato'], ['caro', 'Mais caro'], ['nivel', 'Maior nível']].map(([k, n]) => `<option value="${k}" ${filt.o === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    const ls = Market.open().filter(l => matchFilter(l.item) && l.item.r >= filt.r);
    const ord = { recentes: (a, b) => b.t - a.t, barato: (a, b) => a.price - b.price, caro: (a, b) => b.price - a.price, nivel: (a, b) => (b.item.l || 0) - (a.item.l || 0) }[filt.o];
    ls.sort(ord);
    h += ls.length ? `<div class="list">${ls.slice(0, 80).map(l => listingHtml(l)).join('')}</div>` : '<div class="empty">Nenhum anúncio com esses filtros.</div>';
  } else {
    const mine = Market.mine();
    h += mine.length ? `<div class="list">${mine.map(l => listingHtml(l, true)).join('')}</div>` : '<div class="empty">Você não tem itens à venda.<br>Abra um item ou pet e toque em ANUNCIAR.</div>';
    h += '<h3>Histórico</h3>';
    h += S.log.length ? `<div class="log">${S.log.slice(0, 15).map(e => `<div><span>${e.k === 'venda' ? 'Vendeu' : 'Comprou'} <span style="color:${RAR[e.r].c}">${esc(e.n)}</span>${e.npc ? ' (mercador)' : ''}</span><span>${e.k === 'venda' ? '+' : '-'}${fmt(e.p)}</span></div>`).join('')}</div>`
      : '<p class="small muted">Suas compras e vendas aparecem aqui.</p>';
  }
  return h;
}
function statLine(it, max = 3) {
  return Object.entries(it.st).slice(0, max).map(([k, v]) => `+${v}${STATS[k].pct ? '%' : ''} ${STATS[k].n}`).join(' · ');
}
function itemSub(it) {
  if (it.pet) return `Pet · ${RAR[it.r].n} · +${RG.petBonus(it)}% ${RG.PET_STAT_N[PETS[it.pet].stat]}`;
  const cls = BASES[it.b].cls;
  return `Nv ${it.l} · ${RAR[it.r].n}${cls ? ' · ' + CLASSES[cls].n : ''} · ${statLine(it, 2)}`;
}
function listingHtml(l, mine) {
  const it = l.item;
  return `<button class="lst" style="${rv(it.r)}" data-act="listing" data-id="${esc(l.id)}">
    <img class="px" src="${icon(it, 4)}" alt=""><span class="nm">${esc(RG.itemName(it))}</span>
    <span class="pr">● ${fmt(l.price)}<small>${mine ? 'você recebe ' + fmt(RG.net(l.price)) : esc(Market.displayName(l))}</small></span>
    <span class="sub">${esc(itemSub(it))}</span></button>`;
}

/* --- janelas --- */
let sheetCtx = null;
function openSheet(html, color) { $('#modal').innerHTML = `<div class="ov" data-act="ovclose"><div class="sheet" style="--r:${color || 'var(--line)'}">${html}</div></div>`; }
function closeSheet() { $('#modal').innerHTML = ''; sheetCtx = null; }
function findItem(src, id) {
  if (src === 'bag') return S.bag.find(x => x.id === id);
  if (src === 'pet') return S.pets.find(x => x.id === id);
  for (const cls in S.heroes) for (const k in S.heroes[cls].equip) { const it = S.heroes[cls].equip[k]; if (it && it.id === id) return it; }
  return null;
}
function ownerOf(id) {
  for (const cls in S.heroes) for (const k in S.heroes[cls].equip) if (S.heroes[cls].equip[k] && S.heroes[cls].equip[k].id === id) return cls;
  return null;
}
function compareHtml(it, cls) {
  if (it.pet) return `<div class="istats"><span>${RG.PET_STAT_N[PETS[it.pet].stat]} (party)</span><span>+${RG.petBonus(it)}%</span><span></span></div>`;
  const cur = cls ? S.heroes[cls].equip[BASES[it.b].s] : null;
  const other = cur && cur !== it ? cur : null;
  const keys = [...new Set([...Object.keys(it.st), ...(other ? Object.keys(other.st) : [])])];
  return `<div class="istats">${keys.map(k => {
    const v = it.st[k] || 0, c = other ? other.st[k] || 0 : null, d = c == null ? 0 : v - c;
    const u = STATS[k].pct ? '%' : '';
    return `<span>${STATS[k].n}${RG.STAT_DESC[k] ? `<small>${RG.STAT_DESC[k]}</small>` : ''}</span><span>${v ? '+' + v + u : '—'}</span><span class="${d > 0 ? 'up' : d < 0 ? 'down' : 'eq'}">${c == null ? '' : d === 0 ? '=' : (d > 0 ? '▲' : '▼') + Math.abs(d) + u}</span>`;
  }).join('')}</div>`;
}
function itemHead(it) {
  const sub = it.pet ? `Pet · ${RAR[it.r].n}` : `${RAR[it.r].n} · ${SLOTS[BASES[it.b].s]}${BASES[it.b].cls ? ' de ' + CLASSES[BASES[it.b].cls].n : ''} · Nível ${it.l}`;
  return `<div class="ihead"><img class="px" src="${icon(it, 6)}" alt=""><div><div class="nm">${esc(RG.itemName(it))}</div>
    <div class="sub">${sub}<br>Nº ${String(it.m).padStart(4, '0')}</div></div></div>`;
}
function openItem(src, id, err, top) {
  const it = findItem(src, id);
  if (!it) return closeSheet();
  sheetCtx = { src, id };
  const owner = src === 'equip' ? ownerOf(id) : null;
  const heroes = compatibleHeroes(it);
  const target = owner || (heroes.includes(S.sel) ? S.sel : heroes[0]);
  const note = owner ? `Equipado em ${CLASSES[owner].n}.` : target ? `▲▼ comparado com o item de ${CLASSES[target].n}.` : `Recrute ${CLASSES[BASES[it.b].cls].n} para usar esta arma.`;
  openSheet(`${top || ''}${itemHead(it)}${compareHtml(it, target)}<p class="small muted">${note}</p>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    ${owner ? `<div class="row"><button class="btn" data-act="unequip" ${S.bag.length >= BAG_MAX ? 'disabled' : ''}>GUARDAR</button><button class="btn" data-act="close">FECHAR</button></div>`
      : `${heroes.length ? `<div class="small">Equipar em:</div><div class="row">${heroes.map(c => `<button class="btn green small" data-act="equip" data-id="${c}"><img class="px mini" src="${clsIcon(c, 1)}" alt=""> ${CLASSES[c].n.toUpperCase()}</button>`).join('')}</div>` : ''}
      <div class="row"><button class="btn gold" data-act="sellform">ANUNCIAR</button><button class="btn red" data-act="scrap">SUCATA +${fmt(RG.scrapValue(it))}</button><button class="btn" data-act="close">FECHAR</button></div>`}`, RAR[it.r].c);
}
function openPet(id, err) {
  const p = S.pets.find(x => x.id === id);
  if (!p) return closeSheet();
  sheetCtx = { src: 'pet', id };
  openSheet(`${itemHead(p)}${compareHtml(p)}<p class="small muted">${PETS[p.pet].n} dá ${PETS[p.pet].ds} para toda a party. Só um pet fica ativo por vez.</p>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <div class="row">${p.id === S.pet ? '<button class="btn" data-act="petoff">GUARDAR</button>' : '<button class="btn green" data-act="peton">ATIVAR</button>'}
    <button class="btn gold" data-act="sellform">ANUNCIAR</button><button class="btn red" data-act="scrap">SOLTAR +${fmt(RG.scrapValue(p))}</button><button class="btn" data-act="close">FECHAR</button></div>`, RAR[p.r].c);
}
function openSellForm(err) {
  const src = sheetCtx && sheetCtx.src === 'pet' ? 'pet' : 'bag';
  const it = findItem(src, sheetCtx && sheetCtx.id);
  if (!it) return closeSheet();
  const fair = RG.fairPrice(it);
  const back = it.pet ? `data-act="pet" data-id="${it.id}"` : `data-act="item" data-src="bag" data-id="${it.id}"`;
  openSheet(`${itemHead(it)}<div class="pricebox">
    <label class="small" for="priceIn">Preço em ouro</label>
    <input id="priceIn" type="number" inputmode="numeric" min="1" step="1" value="${fair}">
    <div class="small muted" id="netOut">Você recebe ${fmt(RG.net(fair))} após a taxa de 5%.</div>
    <div class="small muted">Preço justo estimado: ${fmt(fair)}.</div><div class="small muted" id="histOut">Buscando vendas recentes...</div>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}</div>
    <div class="row"><button class="btn gold" data-act="list">ANUNCIAR</button><button class="btn" ${back}>VOLTAR</button></div>`, RAR[it.r].c);
  sheetCtx = { src, id: it.id };
  showHistory(it);
}
async function showHistory(it) {
  const h = await Market.history(it), el = $('#histOut');
  if (!el) return;
  const name = it.pet ? PETS[it.pet].n : BASES[it.b].n;
  el.textContent = h.length
    ? `Últimas vendas (${name} ${RAR[it.r].n.toLowerCase()}): ${h.map(fmt).join(', ')} · média ${fmt(h.reduce((a, b) => a + b, 0) / h.length)}`
    : `Ainda não há vendas registradas de ${name} ${RAR[it.r].n.toLowerCase()}.`;
}
function openListing(id, err) {
  const l = [...Market.npc, ...Market.players].find(x => x.id === id);
  if (!l) { closeSheet(); toast('Este anúncio não está mais disponível', RAR[5].c); return; }
  sheetCtx = { listing: id };
  const it = l.item, mine = l.seller === Market.me && !l.npc;
  const hs = compatibleHeroes(it), target = hs.includes(S.sel) ? S.sel : hs[0];
  openSheet(`${itemHead(it)}${compareHtml(it, target)}
    <div class="stats"><span>Vendedor</span><span>${mine ? 'Você' : esc(Market.displayName(l))}</span><span>Preço</span><span style="color:var(--gold)">● ${fmt(l.price)}</span>
    ${mine ? `<span>Você recebe</span><span>${fmt(RG.net(l.price))}</span>` : `<span>Seu ouro</span><span>${fmt(S.gold)}</span>`}</div>
    <div class="small muted" id="histOut"></div>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <div class="row">${mine ? '<button class="btn red" data-act="cancel">CANCELAR ANÚNCIO</button>'
      : `<button class="btn gold" data-act="buy" ${S.gold < l.price ? 'disabled' : ''}>${S.gold < l.price ? 'OURO INSUFICIENTE' : 'COMPRAR'}</button>`}
      <button class="btn" data-act="close">FECHAR</button></div>`, RAR[it.r].c);
  showHistory(it);
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
  if (a === 'tab') { tab = b.dataset.tab; if (b.dataset.v) bagView = b.dataset.v; render(); $('#panel').scrollTop = 0; return; }
  if (a === 'item') return openItem(b.dataset.src, b.dataset.id);
  if (a === 'pet') return openPet(b.dataset.id);
  if (a === 'listing') return openListing(b.dataset.id);
  if (a === 'mview') { mktView = b.dataset.v; render(); return; }
  if (a === 'bview') { bagView = b.dataset.v; render(); return; }
  if (a === 'hero') { S.sel = b.dataset.id; tab = 'party'; render(); return; }
  if (a === 'roster') return openRoster(+b.dataset.v);
  if (a === 'pickslot') return openSlotPicker(b.dataset.v);
  if (a === 'setparty') {
    const i = +b.dataset.v, cls = b.dataset.id;
    if (!S.heroes[cls] || S.party.includes(cls)) return closeSheet();
    if (i < S.party.length) S.party[i] = cls; else S.party.push(cls);
    S.sel = cls; recalc(); saveSoon(1000); closeSheet(); render(); return;
  }
  if (a === 'unparty') { S.party.splice(+b.dataset.v, 1); S.sel = S.party[0]; recalc(); saveSoon(1000); closeSheet(); render(); return; }
  if (a === 'recruit') {
    const cls = b.dataset.id, c = CLASSES[cls];
    if (S.heroes[cls] || S.gold < c.custo) return;
    S.gold -= c.custo; S.heroes[cls] = newHero(cls); S.sel = cls;
    if (S.party.length < 3) { S.party.push(cls); recalc(); }
    toast(`${c.n} entrou para o grupo!`, RAR[3].c); saveNow(); render(); return;
  }
  if (a === 'zonedown' || a === 'zoneup') {
    S.zone = clamp(S.zone + (a === 'zoneup' ? 1 : -1), 1, S.maxZone); S.zk = 0; B.foes = []; B.spawnT = 0.5;
    saveSoon(); render(); return;
  }
  if (a === 'scrapall') {
    let g = 0;
    S.bag = S.bag.filter(it => { if (it.r === 0) { g += RG.scrapValue(it); return false; } return true; });
    S.gold += g; if (g) toast(`+${fmt(g)} de ouro em sucata`, PAL.y);
    saveSoon(); render(); return;
  }
  if (a === 'equip') {
    const cls = b.dataset.id, i = S.bag.findIndex(x => x.id === sheetCtx.id);
    if (i < 0 || !S.heroes[cls]) return closeSheet();
    const it = S.bag[i], slot = BASES[it.b].s;
    if (BASES[it.b].cls && BASES[it.b].cls !== cls) return;
    const old = S.heroes[cls].equip[slot];
    S.bag.splice(i, 1); S.heroes[cls].equip[slot] = it; if (old) S.bag.push(old);
    S.sel = cls; recalc(); saveSoon(1000); closeSheet(); render();
    toast(`${RG.itemName(it)} equipado em ${CLASSES[cls].n}`, RAR[it.r].c); return;
  }
  if (a === 'unequip') {
    const it = findItem('equip', sheetCtx.id), cls = ownerOf(sheetCtx.id);
    if (!it || !cls) return closeSheet();
    if (BASES[it.b].s === 'arma') { openItem('equip', sheetCtx.id, 'Todo herói precisa de uma arma. Equipe outra para trocar.'); return; }
    delete S.heroes[cls].equip[BASES[it.b].s]; S.bag.push(it);
    recalc(); saveSoon(1000); closeSheet(); render(); return;
  }
  if (a === 'scrap') {
    const list = sheetCtx.src === 'pet' ? S.pets : S.bag, i = list.findIndex(x => x.id === sheetCtx.id);
    if (i >= 0) {
      const it = list.splice(i, 1)[0];
      S.gold += RG.scrapValue(it); toast(`+${fmt(RG.scrapValue(it))} de ouro`, PAL.y);
      if (it.pet && S.pet === it.id) { S.pet = null; recalc(); }
    }
    saveSoon(); closeSheet(); render(); return;
  }
  if (a === 'peton' || a === 'petoff') { S.pet = a === 'peton' ? sheetCtx.id : null; recalc(); saveSoon(1000); closeSheet(); render(); return; }
  if (a === 'sellform') return openSellForm();
  if (a === 'fpick') { forgePick(b.dataset.id); render(); return; }
  if (a === 'fclear') { forge = []; render(); return; }
  if (a === 'fauto') { forgeErr = forgeAuto() || ''; render(); return; }
  if (a === 'fuse') { const res = doFuse(); if (res) openFuseResult(res); render(); return; }
  if (acting) return;
  if (a === 'list') {
    const it = findItem(sheetCtx.src === 'pet' ? 'pet' : 'bag', sheetCtx.id), price = Math.round(+$('#priceIn').value);
    if (!it) return closeSheet();
    if (!(price >= 1)) return openSellForm('Digite um preço de pelo menos 1 de ouro.');
    acting = true; b.disabled = true;
    const err = await Market.list(it, price);
    acting = false;
    if (err) return openSellForm(err);
    closeSheet(); toast(`${RG.itemName(it)} anunciado por ${fmt(price)}`, PAL.y); tab = 'mercado'; mktView = 'vendas'; render(); return;
  }
  if (a === 'buy' || a === 'cancel') {
    const id = sheetCtx && sheetCtx.listing, l = [...Market.npc, ...Market.players].find(x => x.id === id);
    if (!l) return closeSheet();
    acting = true; b.disabled = true;
    const err = await (a === 'buy' ? Market.buy(l) : Market.cancel(l));
    acting = false;
    if (err) return openListing(id, err);
    closeSheet();
    toast(a === 'buy' ? `Comprado: ${RG.itemName(l.item)}` : 'Anúncio cancelado. O item volta para o inventário', PAL.y);
    render(); return;
  }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'priceIn') { const p = Math.max(0, Math.round(+ev.target.value) || 0); $('#netOut').textContent = `Você recebe ${fmt(RG.net(p))} após a taxa de 5%.`; }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'optAuto') { S.auto = t.checked; saveSoon(); }
  else if (t.id === 'optScrap') { S.autoScrap = +t.value; saveSoon(); }
  else if (t.id === 'optNick') { S.nick = t.value.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16) || S.nick; t.value = S.nick; saveSoon(); }
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
const away = (Date.now() - S.seen) / 1000;
render(); hud();
if (away > 30 && S.kills > 0) offline(away);
S.seen = Date.now();
Market.init();
requestAnimationFrame(loop);

// gancho usado pelos testes automáticos
window.__idle = { get S() { return S; }, B, Market, step, recalc, offline, render, RG, get PS() { return PS; }, PARTY, spawnWave };
