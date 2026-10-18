/* =========================================================================
   SERVIDOR DO MERCADO — Cloud Functions do Saque Infinito
   O aplicativo nunca grava ouro nem anúncios direto no banco: tudo passa por
   estas funções, que rodam em transações e conferem cada item com regras.js.
   ========================================================================= */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const R = require('./regras');

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

const MAX_OFFLINE = 12 * 3600;  // segundos de ganho que uma sincronização pode cobrir
const PRIMEIRO_TETO = 500;      // ouro que um jogador novo pode trazer do aparelho
const MAX_ANUNCIOS = 20;
const ID = /^[a-z0-9]{6,24}$/;

function exigirLogin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no jogo para negociar.');
  return req.auth.uid;
}
const apelido = s => String(s || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) || 'Herói';
const chave = it => (it.pet || it.b) + ':' + it.r;
async function lerCarteira(tx, uid) {
  const ref = db.doc(`carteiras/${uid}`);
  const s = await tx.get(ref);
  const c = s.exists ? s.data() : {};
  return { ref, ouro: Math.max(0, Math.floor(+c.ouro || 0)), zona: Math.max(1, +c.zona || 1), v: +c.v || 0, sync: c.sync || null };
}

/* ---------------------------------------------------------------------------
   sincronizar({ delta, zona })
   O jogo informa quanto ouro ganhou (delta > 0) ou gastou (delta < 0) desde a
   última vez. Ganhos são limitados pelo tempo real que passou e pela zona;
   a zona só pode subir 1 a cada R.ZONE_MIN_SECONDS. */
exports.sincronizar = onCall(async req => {
  const uid = exigirLogin(req);
  const delta = Math.trunc(Number(req.data && req.data.delta) || 0);
  const zonaPedida = Math.max(1, Math.floor(Number(req.data && req.data.zona) || 1));
  return db.runTransaction(async tx => {
    const c = await lerCarteira(tx, uid);
    const agora = Date.now();
    const segundos = c.sync ? Math.min(MAX_OFFLINE, Math.max(0, (agora - c.sync.toMillis()) / 1000)) : 0;
    const zona = Math.max(c.zona, Math.min(zonaPedida, c.zona + Math.floor(segundos / R.ZONE_MIN_SECONDS)));
    const teto = c.sync ? Math.floor(segundos * R.goldCapPerSec(zona)) : PRIMEIRO_TETO;
    const credito = delta >= 0 ? Math.min(delta, teto) : Math.max(delta, -c.ouro);
    const ouro = c.ouro + credito, v = c.v + 1;
    tx.set(c.ref, { ouro, zona, v, sync: Timestamp.fromMillis(agora) }, { merge: true });
    return { ouro, zona, v, creditado: credito, recusado: Math.max(0, delta - credito) };
  });
});

/* ---------------------------------------------------------------------------
   anunciar({ item, preco, apelido })
   Confere o item, registra o dono e cria o anúncio. Um item já negociado só
   pode ser anunciado por quem o tem hoje, e só uma vez. */
exports.anunciar = onCall(async req => {
  const uid = exigirLogin(req);
  const preco = Math.floor(Number(req.data && req.data.preco));
  if (!(preco >= 1 && preco <= 1e12)) throw new HttpsError('invalid-argument', 'Preço inválido.');
  return db.runTransaction(async tx => {
    const c = await lerCarteira(tx, uid);
    const item = R.cleanItem(req.data && req.data.item, c.zona + 3);
    if (!item) throw new HttpsError('invalid-argument', 'Item inválido.');
    const anRef = db.doc(`anuncios/${item.id}`), donoRef = db.doc(`donos/${item.id}`);
    const abertosQ = db.collection('anuncios').where('vendedor', '==', uid).where('status', '==', 'aberto').limit(MAX_ANUNCIOS);
    const [an, dono, abertos] = await Promise.all([tx.get(anRef), tx.get(donoRef), tx.get(abertosQ)]);
    if (an.exists) throw new HttpsError('already-exists', 'Este item já está anunciado.');
    if (dono.exists && dono.data().uid !== uid) throw new HttpsError('permission-denied', 'Este item não pertence a você.');
    if (abertos.size >= MAX_ANUNCIOS) throw new HttpsError('resource-exhausted', `Você já tem ${MAX_ANUNCIOS} anúncios abertos.`);
    tx.set(anRef, {
      item, preco, vendedor: uid, vendedorNome: apelido(req.data.apelido), status: 'aberto',
      chave: chave(item), criadoEm: FieldValue.serverTimestamp(),
    });
    tx.set(donoRef, { uid: 'anuncio', em: FieldValue.serverTimestamp() });
    return { ok: true, id: item.id };
  });
});

/* ---------------------------------------------------------------------------
   comprar({ id, preco })
   Numa única transação: confere o anúncio e o ouro do comprador, paga o
   vendedor (menos a taxa), passa o item para a caixa do comprador e registra
   o preço no histórico. */
exports.comprar = onCall(async req => {
  const uid = exigirLogin(req);
  const id = String((req.data && req.data.id) || '');
  if (!ID.test(id)) throw new HttpsError('invalid-argument', 'Anúncio inválido.');
  return db.runTransaction(async tx => {
    const anRef = db.doc(`anuncios/${id}`);
    const an = await tx.get(anRef);
    if (!an.exists || an.data().status !== 'aberto') throw new HttpsError('not-found', 'Este item já foi vendido.');
    const a = an.data();
    if (a.vendedor === uid) throw new HttpsError('failed-precondition', 'Você não pode comprar o próprio anúncio.');
    const esperado = Number(req.data.preco);
    if (esperado && esperado !== a.preco) throw new HttpsError('failed-precondition', 'O preço mudou. Confira o anúncio de novo.');
    const [comp, vend] = await Promise.all([lerCarteira(tx, uid), lerCarteira(tx, a.vendedor)]);
    if (comp.ouro < a.preco) throw new HttpsError('failed-precondition', 'Ouro insuficiente.');
    const liquido = R.net(a.preco);
    tx.set(comp.ref, { ouro: comp.ouro - a.preco, v: comp.v + 1 }, { merge: true });
    tx.set(vend.ref, { ouro: vend.ouro + liquido, v: vend.v + 1 }, { merge: true });
    tx.delete(anRef);
    tx.set(db.doc(`donos/${id}`), { uid, em: FieldValue.serverTimestamp() });
    tx.set(db.doc(`jogadores/${uid}/caixa/${id}`), { tipo: 'item', item: a.item, em: FieldValue.serverTimestamp() });
    tx.set(db.doc(`jogadores/${a.vendedor}/caixa/venda-${id}`), { tipo: 'venda', item: a.item, valor: liquido, em: FieldValue.serverTimestamp() });
    tx.set(db.collection('historico').doc(), { chave: a.chave, preco: a.preco, em: FieldValue.serverTimestamp() });
    return { ok: true };
  });
});

/* ---------------------------------------------------------------------------
   cancelar({ id })
   Tira o anúncio e devolve o item pela caixa de entrada do vendedor. */
exports.cancelar = onCall(async req => {
  const uid = exigirLogin(req);
  const id = String((req.data && req.data.id) || '');
  if (!ID.test(id)) throw new HttpsError('invalid-argument', 'Anúncio inválido.');
  return db.runTransaction(async tx => {
    const anRef = db.doc(`anuncios/${id}`);
    const an = await tx.get(anRef);
    if (!an.exists || an.data().status !== 'aberto') throw new HttpsError('not-found', 'Este anúncio já foi vendido ou cancelado.');
    const a = an.data();
    if (a.vendedor !== uid) throw new HttpsError('permission-denied', 'Este anúncio não é seu.');
    tx.delete(anRef);
    tx.set(db.doc(`donos/${id}`), { uid, em: FieldValue.serverTimestamp() });
    tx.set(db.doc(`jogadores/${uid}/caixa/${id}`), { tipo: 'item', item: a.item, em: FieldValue.serverTimestamp() });
    return { ok: true };
  });
});
