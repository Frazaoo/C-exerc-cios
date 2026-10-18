/* =========================================================================
   REGRAS DO SAQUE INFINITO
   Fonte única de verdade para classes, itens, atributos e pets.
   Carregado pelo jogo (navegador) e pelas Cloud Functions (Node), para que
   cliente e servidor validem itens exatamente do mesmo jeito.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.REGRAS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const rid = () => {
    const bytes = new Uint8Array(10);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  };

  /* ---------------- raridades ----------------
     mult: multiplica todos os atributos do item (as porcentagens crescem com a raridade)
     afixos: quantos atributos extras o item ganha */
  const RAR = [
    { n: 'Comum', c: '#94b0c2', w: 600, mult: 1, afixos: 0, scrap: 1, mkt: 1.5 },
    { n: 'Incomum', c: '#a7f070', w: 250, mult: 1.25, afixos: 1, scrap: 2.5, mkt: 2 },
    { n: 'Raro', c: '#41a6f6', w: 100, mult: 1.6, afixos: 2, scrap: 6, mkt: 3 },
    { n: 'Épico', c: '#b86ef0', w: 38, mult: 2.1, afixos: 3, scrap: 15, mkt: 4 },
    { n: 'Lendário', c: '#ffcd75', w: 10, mult: 2.8, afixos: 4, scrap: 40, mkt: 5 },
    { n: 'Mítico', c: '#ff6b8a', w: 2, mult: 3.8, afixos: 5, scrap: 120, mkt: 6 },
  ];

  /* ---------------- atributos ----------------
     base(l): valor de um item Comum de nível l com peso 1.
     cap: limite do total no herói (porcentagens). */
  const STATS = {
    atk: { n: 'Ataque', base: l => 3 + l * 1.8 },
    hp: { n: 'Vida', base: l => 12 + l * 9 },
    def: { n: 'Defesa', base: l => 2 + l * 1.1 },
    crit: { n: 'Crítico', pct: true, cap: 80, base: l => 4 * (1 + l / 80) },
    cdmg: { n: 'Dano crítico', pct: true, cap: 400, base: l => 15 * (1 + l / 80) },
    aspd: { n: 'Vel. de ataque', pct: true, cap: 300, base: l => 6 * (1 + l / 80) },
    area: { n: 'Dano em área', pct: true, cap: 400, base: l => 10 * (1 + l / 80) },
    heal: { n: 'Poder de cura', pct: true, cap: 400, base: l => 10 * (1 + l / 80) },
    leech: { n: 'Roubo de vida', pct: true, cap: 40, base: l => 2.5 * (1 + l / 80) },
    block: { n: 'Bloqueio', pct: true, cap: 60, base: l => 4 * (1 + l / 80) },
    dodge: { n: 'Esquiva', pct: true, cap: 50, base: l => 3 * (1 + l / 80) },
    buff: { n: 'Inspiração', pct: true, cap: 200, base: l => 4 * (1 + l / 80) },
    gold: { n: 'Ouro extra', pct: true, cap: 500, base: l => 10 * (1 + l / 80) },
    loot: { n: 'Sorte', pct: true, cap: 300, base: l => 6 * (1 + l / 80) },
  };
  const STAT_DESC = {
    block: 'chance de anular um golpe', dodge: 'chance de desviar', leech: 'cura parte do dano causado',
    area: 'aumenta dano em vários inimigos', heal: 'aumenta as curas', buff: 'aumenta o dano de toda a party',
  };

  /* ---------------- classes ----------------
     papel: especialidade · armas: tipos que a classe usa · front: posição na formação (maior = mais à frente)
     cresc: crescimento por nível de vida, ataque e defesa */
  const CLASSES = {
    cavaleiro: {
      n: 'Cavaleiro', papel: 'Tanque', armas: ['espada', 'martelo'], hp: 120, atk: 6, def: 5, aspd: 0.9, front: 3, alcance: 'perto',
      bonus: { block: 12 }, custo: 0, ds: 'Atrai os ataques dos inimigos e bloqueia golpes.',
      skill: { n: 'Muralha', cd: 12, ds: 'A party recebe 50% menos dano por 4s.' },
    },
    arqueira: {
      n: 'Arqueira', papel: 'Dano', armas: ['arco', 'besta'], hp: 60, atk: 9, def: 1, aspd: 1.5, front: 1, alcance: 'longe',
      bonus: { crit: 10 }, custo: 0, ds: 'O maior dano contínuo em um alvo.',
      skill: { n: 'Rajada', cd: 9, ds: 'Dispara 6 flechas rápidas.' },
    },
    sacerdote: {
      n: 'Sacerdote', papel: 'Cura', armas: ['cetro', 'livro'], hp: 70, atk: 4, def: 2, aspd: 0.9, front: 0, alcance: 'longe',
      bonus: { heal: 0 }, custo: 0, ds: 'Cura o aliado mais ferido a cada ataque.',
      skill: { n: 'Luz Sagrada', cd: 14, ds: 'Cura 40% da vida de todos e revive caídos.' },
    },
    mago: {
      n: 'Mago', papel: 'Área', armas: ['cajado', 'orbe'], hp: 55, atk: 8, def: 1, aspd: 0.8, front: 0, alcance: 'longe',
      bonus: { area: 10 }, custo: 300, ds: 'Cada ataque atinge todos os inimigos.',
      skill: { n: 'Meteoro', cd: 12, ds: 'Causa 300% de dano em todos os inimigos.' },
    },
    barbaro: {
      n: 'Bárbaro', papel: 'Equilibrado', armas: ['machado', 'montante'], hp: 100, atk: 8, def: 3, aspd: 1.0, front: 2, alcance: 'perto',
      bonus: { leech: 5 }, custo: 1200, ds: 'Bom dano, boa vida e se cura ao bater.',
      skill: { n: 'Redemoinho', cd: 10, ds: 'Gira causando 160% de dano em todos.' },
    },
    ladino: {
      n: 'Ladino', papel: 'Crítico', armas: ['adaga', 'laminas'], hp: 60, atk: 7, def: 1, aspd: 1.6, front: 2, alcance: 'perto',
      bonus: { crit: 25, cdmg: 50, dodge: 15 }, custo: 4000, ds: 'Críticos devastadores e muita esquiva.',
      skill: { n: 'Golpe Sombrio', cd: 10, ds: 'Some e reaparece com um crítico de 500%.' },
    },
    necromante: {
      n: 'Necromante', papel: 'Dreno', armas: ['foice', 'grimorio'], hp: 65, atk: 7, def: 1.5, aspd: 0.9, front: 1, alcance: 'longe',
      bonus: { leech: 15 }, custo: 12000, ds: 'Rouba vida e cura o aliado mais ferido.',
      skill: { n: 'Exército', cd: 15, ds: 'Invoca 2 esqueletos que lutam por 8s.' },
    },
    bardo: {
      n: 'Bardo', papel: 'Suporte', armas: ['alaude', 'flauta'], hp: 70, atk: 5, def: 1.5, aspd: 1.1, front: 0, alcance: 'longe',
      bonus: { buff: 10 }, custo: 30000, ds: 'Aumenta o dano de toda a party.',
      skill: { n: 'Balada', cd: 13, ds: 'A party ataca 60% mais rápido por 5s.' },
    },
  };
  const growth = l => ({ hp: 1 + 0.12 * (l - 1), atk: 1 + 0.11 * (l - 1), def: 1 + 0.1 * (l - 1) });

  /* ---------------- itens ----------------
     p: atributos principais com peso. Armas pertencem a uma classe e têm perfis
     diferentes (ex.: Besta = golpe forte e lento; Arco = rápido). */
  const BASES = {
    // armas
    espada: { n: 'Espada', s: 'arma', cls: 'cavaleiro', p: [['atk', 1], ['block', 0.8]] },
    martelo: { n: 'Martelo', s: 'arma', cls: 'cavaleiro', p: [['atk', 1.2], ['hp', 0.6]] },
    arco: { n: 'Arco', s: 'arma', cls: 'arqueira', p: [['atk', 0.9], ['aspd', 1]] },
    besta: { n: 'Besta', s: 'arma', cls: 'arqueira', p: [['atk', 1.3], ['cdmg', 1]] },
    cetro: { n: 'Cetro', s: 'arma', cls: 'sacerdote', p: [['heal', 1.2], ['hp', 0.6]] },
    livro: { n: 'Livro Sagrado', s: 'arma', cls: 'sacerdote', p: [['heal', 1], ['aspd', 0.8]] },
    cajado: { n: 'Cajado', s: 'arma', cls: 'mago', p: [['atk', 1], ['area', 1]] },
    orbe: { n: 'Orbe', s: 'arma', cls: 'mago', p: [['area', 1.3], ['crit', 0.8]] },
    machado: { n: 'Machado', s: 'arma', cls: 'barbaro', p: [['atk', 1.1], ['cdmg', 0.8]] },
    montante: { n: 'Montante', s: 'arma', cls: 'barbaro', p: [['atk', 1], ['leech', 1]] },
    adaga: { n: 'Adaga', s: 'arma', cls: 'ladino', p: [['aspd', 1], ['crit', 1]] },
    laminas: { n: 'Lâminas Gêmeas', s: 'arma', cls: 'ladino', p: [['crit', 1], ['dodge', 1]] },
    foice: { n: 'Foice', s: 'arma', cls: 'necromante', p: [['atk', 1], ['leech', 1.2]] },
    grimorio: { n: 'Grimório', s: 'arma', cls: 'necromante', p: [['atk', 0.9], ['area', 1]] },
    alaude: { n: 'Alaúde', s: 'arma', cls: 'bardo', p: [['buff', 1.2], ['aspd', 0.8]] },
    flauta: { n: 'Flauta', s: 'arma', cls: 'bardo', p: [['buff', 1], ['heal', 0.8]] },
    // armaduras e acessórios (qualquer classe)
    elmo: { n: 'Elmo', s: 'elmo', p: [['hp', 1], ['def', 0.5]] },
    capuz: { n: 'Capuz', s: 'elmo', p: [['hp', 0.8], ['dodge', 0.8]] },
    peitoral: { n: 'Peitoral', s: 'armadura', p: [['def', 1], ['block', 0.6]] },
    manto: { n: 'Manto', s: 'armadura', p: [['hp', 1], ['heal', 0.6]] },
    botas: { n: 'Botas', s: 'botas', p: [['aspd', 1], ['dodge', 0.6]] },
    anel: { n: 'Anel', s: 'anel', p: [['crit', 1], ['cdmg', 0.6]] },
    amuleto: { n: 'Amuleto', s: 'amuleto', p: [['hp', 1], ['gold', 0.6]] },
    talisma: { n: 'Talismã', s: 'amuleto', p: [['loot', 1], ['buff', 0.6]] },
  };
  const SLOTS = { arma: 'Arma', elmo: 'Cabeça', armadura: 'Armadura', botas: 'Botas', anel: 'Anel', amuleto: 'Amuleto' };
  const SUFIX = {
    atk: 'da Fúria', hp: 'do Urso', def: 'da Muralha', crit: 'da Precisão', cdmg: 'do Carrasco', aspd: 'do Vento', area: 'da Tempestade',
    heal: 'da Aurora', leech: 'do Vampiro', block: 'do Bastião', dodge: 'da Sombra', buff: 'da Canção', gold: 'da Fortuna', loot: 'da Sorte',
  };
  const MITICOS = {
    espada: 'Aurora Partida', martelo: 'Juízo de Pedra', arco: 'Sussurro Final', besta: 'Fim da Caçada', cetro: 'Bastão da Alvorada',
    livro: 'Códice dos Céus', cajado: 'Vara do Eclipse', orbe: 'Olho da Tempestade', machado: 'Racha-Montanhas', montante: 'Sede Eterna',
    adaga: 'Picada da Víbora', laminas: 'Par da Meia-Noite', foice: 'Ceifa-Almas', grimorio: 'Livro dos Mortos', alaude: 'Canto da Sereia',
    flauta: 'Sopro da Primavera', elmo: 'Coroa do Rei Caído', capuz: 'Véu da Meia-Noite', peitoral: 'Coração de Ferro', manto: 'Manto das Estrelas',
    botas: 'Passos do Trovão', anel: 'Olho do Abismo', amuleto: 'Lágrima de Dragão', talisma: 'Trevo Eterno',
  };

  /* ---------------- pets ----------------
     Caem dos chefes. O bônus vale para toda a party e cresce com a raridade. */
  const PETS = {
    slime: { n: 'Slime Dourado', bioma: 0, stat: 'gold', base: 15, ds: 'mais ouro' },
    lobinho: { n: 'Lobinho', bioma: 1, stat: 'buff', base: 6, ds: 'mais dano da party' },
    fantasminha: { n: 'Fantasminha', bioma: 2, stat: 'loot', base: 10, ds: 'mais sorte nos itens' },
    golemzinho: { n: 'Golemzinho', bioma: 3, stat: 'hpPct', base: 8, ds: 'mais vida para a party' },
    dragaozinho: { n: 'Dragãozinho', bioma: 4, stat: 'crit', base: 4, ds: 'mais crítico e cospe fogo' },
  };
  const PET_STAT_N = { gold: 'Ouro extra', buff: 'Dano da party', loot: 'Sorte', hpPct: 'Vida da party', crit: 'Crítico' };
  const petBonus = p => Math.round(PETS[p.pet].base * RAR[p.r].mult * 10) / 10;
  const PET_DROP = 0.08;

  /* ---------------- criação e validação ---------------- */
  function rollRarity(luck, floor) {
    floor = floor || 0;
    const w = RAR.map((r, i) => (i >= 2 ? r.w * luck : r.w));
    let tot = 0;
    for (let i = floor; i < w.length; i++) tot += w[i];
    let x = Math.random() * tot;
    for (let i = floor; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
    return floor;
  }
  function statValue(k, l, r, wgt) { return STATS[k].base(l) * RAR[r].mult * wgt; }
  // maior valor possível de um atributo para esse item (usado para validar)
  function maxStat(b, k, l, r) {
    const prim = BASES[b].p.find(p => p[0] === k);
    const wgt = (prim ? prim[1] : 0) + 0.45;
    return Math.ceil(statValue(k, l, r, wgt) * 1.16) + 1;
  }
  function makeItem(l, r, b) {
    b = b || pick(Object.keys(BASES));
    const base = BASES[b], st = {};
    const roll = (k, wgt) => {
      st[k] = (st[k] || 0) + Math.max(1, Math.round(statValue(k, l, r, wgt) * rnd(0.85, 1.15)));
    };
    for (const [k, w] of base.p) roll(k, w);
    const pool = Object.keys(STATS).filter(k => !base.p.some(p => p[0] === k));
    let sx = null;
    for (let i = 0; i < RAR[r].afixos && pool.length; i++) {
      const k = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      roll(k, 0.45);
      if (!sx) sx = k;
    }
    for (const k in st) st[k] = Math.min(st[k], maxStat(b, k, l, r));
    return { id: rid(), b, r, l, st, sx, m: 1 + ((Math.random() * 9999) | 0) };
  }
  function makePet(pet, r) { return { id: rid(), pet, r, m: 1 + ((Math.random() * 9999) | 0) }; }

  // aceita só campos conhecidos e atributos possíveis para aquele item
  function cleanItem(o, maxLevel) {
    if (!o || typeof o !== 'object') return null;
    const id = typeof o.id === 'string' && /^[a-z0-9]{6,24}$/.test(o.id) ? o.id : null;
    if (!id) return null;
    const r = clamp(o.r | 0, 0, 5), m = clamp(o.m | 0, 1, 9999);
    if (o.pet) return PETS[o.pet] ? { id, pet: o.pet, r, m } : null;
    if (!BASES[o.b]) return null;
    const l = clamp(o.l | 0, 1, maxLevel || 9999), st = {};
    if (o.st && typeof o.st === 'object') {
      for (const k in o.st) {
        const v = +o.st[k];
        if (STATS[k] && Number.isFinite(v) && v > 0) st[k] = Math.min(Math.round(v), maxStat(o.b, k, l, r));
      }
    }
    return { id, b: o.b, r, l, st, sx: STATS[o.sx] ? o.sx : null, m };
  }
  function itemName(it) {
    if (it.pet) return PETS[it.pet].n;
    if (it.r === 5) return MITICOS[it.b];
    return BASES[it.b].n + (it.r >= 2 && it.sx ? ' ' + SUFIX[it.sx] : '');
  }
  const scrapValue = it => Math.round((4 + (it.l || 10) * 2.5) * RAR[it.r].scrap * (it.pet ? 3 : 1));
  const fairPrice = it => Math.max(5, Math.round(scrapValue(it) * RAR[it.r].mkt));

  /* ---------------- economia (usado pelo servidor para limitar ganhos) ---------------- */
  const enemyGold = z => 2 * Math.pow(1.16, z - 1);
  // teto generoso de ouro por segundo numa zona (inimigos, chefes, sucata e bônus)
  const goldCapPerSec = z => enemyGold(z) * 12 + (4 + z * 2.5) * 6;
  const ZONE_MIN_SECONDS = 20; // uma zona não pode ser vencida mais rápido que isso
  const FEE = 0.05;
  const net = p => Math.floor(p * (1 - FEE));

  /* ---------------- fusão ---------------- */
  const FUSE_N = 6;
  const FUSE_CHANCE = [0.9, 0.75, 0.55, 0.35, 0.15];
  const FUSE_PITY = [0.05, 0.06, 0.08, 0.08, 0.05];
  const FUSE_COST = [1, 3, 8, 20, 60];
  const fuseCost = (r, l) => Math.round((10 + l * 4) * FUSE_COST[r]);

  return {
    clamp, rnd, pick, rid, RAR, STATS, STAT_DESC, CLASSES, growth, BASES, SLOTS, SUFIX, MITICOS, PETS, PET_STAT_N, petBonus, PET_DROP,
    rollRarity, maxStat, makeItem, makePet, cleanItem, itemName, scrapValue, fairPrice,
    enemyGold, goldCapPerSec, ZONE_MIN_SECONDS, FEE, net, FUSE_N, FUSE_CHANCE, FUSE_PITY, FUSE_COST, fuseCost,
  };
});
