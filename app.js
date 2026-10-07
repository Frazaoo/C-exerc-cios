import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, runTransaction, updateDoc, deleteDoc,
  writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// ---------- Firebase ----------
// Os dados ficam no Firestore e são sincronizados em tempo real entre todos os computadores.
const configurado = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('COLE');
const app = configurado ? initializeApp(firebaseConfig) : null;
const auth = app && getAuth(app);
const db = app && getFirestore(app);
const colecao = db && collection(db, 'cautelas');
const contador = db && doc(db, 'contadores', 'cautelas');

let cautelas = [];
let pararEscuta = null;

// ---------- Datas (sempre "AAAA-MM-DD", sem fuso horário) ----------
const pad = (n) => String(n).padStart(2, '0');
const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hojeIso = () => isoDe(new Date());
const formatar = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---------- Regras ----------
function status(c) {
  if (c.devolvida) return 'devolvida';
  if (c.prevista < hojeIso()) return 'atrasada';
  return 'ativa';
}
const ROTULO_STATUS = { ativa: 'Ativa', atrasada: 'Atrasada', devolvida: 'Devolvida' };

// Eventos exibidos no calendário para um dia específico.
function eventosDoDia(iso) {
  const mostrarRet = $('#f-retiradas').checked;
  const mostrarPrev = $('#f-devolucoes').checked;
  const mostrarDev = $('#f-devolvidas').checked;
  const eventos = [];
  for (const c of cautelas) {
    const st = status(c);
    if (mostrarRet && c.retirada === iso) {
      eventos.push({ c, tipo: 'retirada', texto: `Retirada: ${c.material}` });
    }
    if (mostrarPrev && !c.devolvida && c.prevista === iso) {
      eventos.push({ c, tipo: st === 'atrasada' ? 'atrasada' : 'prevista', texto: `Devolver: ${c.material}` });
    }
    if (mostrarDev && c.devolvida === iso) {
      eventos.push({ c, tipo: 'devolvida', texto: `Devolvida: ${c.material}` });
    }
  }
  return eventos;
}

// ---------- Utilidades DOM ----------
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const f of filhos) e.append(f);
  return e;
}

// ---------- Estatísticas ----------
function renderStats() {
  const hoje = hojeIso();
  let ativas = 0, hojeCount = 0, atrasadas = 0, devolvidas = 0;
  for (const c of cautelas) {
    const st = status(c);
    if (st === 'devolvida') devolvidas++;
    else {
      ativas++;
      if (st === 'atrasada') atrasadas++;
      if (c.prevista === hoje) hojeCount++;
    }
  }
  $('#st-ativas').textContent = ativas;
  $('#st-hoje').textContent = hojeCount;
  $('#st-atrasadas').textContent = atrasadas;
  $('#st-devolvidas').textContent = devolvidas;
}

// ---------- Calendário ----------
const MAX_CHIPS = 3;
let mesAtual = new Date();
mesAtual.setDate(1);
let diaSelecionado = null;

function renderCalendario() {
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const nomeMes = MESES[mes][0].toUpperCase() + MESES[mes].slice(1);
  $('#cal-titulo').textContent = `${nomeMes} de ${ano}`;

  const grade = $('#cal-dias');
  grade.replaceChildren();
  const inicio = new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay());
  const hoje = hojeIso();

  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const iso = isoDe(d);
    const classes = ['dia'];
    if (d.getMonth() !== mes) classes.push('fora');
    if (iso === hoje) classes.push('hoje');
    if (iso === diaSelecionado) classes.push('selecionado');

    const celula = el('div', { class: classes.join(' '), onclick: () => selecionarDia(iso) },
      el('span', { class: 'dia-num' }, String(d.getDate())));

    const eventos = eventosDoDia(iso);
    eventos.slice(0, MAX_CHIPS).forEach((ev) => {
      celula.append(el('div', {
        class: `chip ${ev.tipo}`,
        title: `${ev.texto} — ${ev.c.responsavel}`,
        onclick: (e) => { e.stopPropagation(); abrirModal(ev.c); },
      }, ev.texto));
    });
    if (eventos.length > MAX_CHIPS) {
      celula.append(el('span', { class: 'mais' }, `+${eventos.length - MAX_CHIPS} mais`));
    }
    grade.append(celula);
  }

  if (diaSelecionado) renderPainelDia();
}

function selecionarDia(iso) {
  diaSelecionado = iso;
  renderCalendario();
  $('#dia-painel').hidden = false;
}

function renderPainelDia() {
  const [a, m, d] = diaSelecionado.split('-').map(Number);
  const data = new Date(a, m - 1, d);
  $('#dia-titulo').textContent =
    `${data.toLocaleDateString('pt-BR', { weekday: 'long' })}, ${formatar(diaSelecionado)}`;

  const lista = $('#dia-lista');
  lista.replaceChildren();
  const eventos = eventosDoDia(diaSelecionado);
  if (!eventos.length) {
    lista.append(el('li', { class: 'empty' }, 'Nenhuma movimentação neste dia.'));
    return;
  }
  for (const ev of eventos) {
    lista.append(el('li', { onclick: () => abrirModal(ev.c) },
      el('i', { class: `dot ${ev.tipo === 'atrasada' ? 'prevista' : ev.tipo}` }),
      el('div', { class: 'info' },
        `${ev.texto}${ev.c.patrimonio ? ` (${ev.c.patrimonio})` : ''} × ${ev.c.quantidade}`,
        el('small', {}, `Cautela nº ${ev.c.numero} · ${ev.c.responsavel}` +
          `${ev.c.identificacao ? ` – ${ev.c.identificacao}` : ''}`)),
      el('span', { class: `badge ${status(ev.c)}` }, ROTULO_STATUS[status(ev.c)])));
  }
}

// ---------- Lista ----------
function renderLista() {
  const termo = $('#busca').value.trim().toLowerCase();
  const filtro = $('#filtro-status').value;
  const linhas = cautelas
    .filter((c) => !filtro || status(c) === filtro)
    .filter((c) => !termo || [c.material, c.patrimonio, c.responsavel, c.identificacao, c.obs, String(c.numero)]
      .some((v) => (v || '').toLowerCase().includes(termo)))
    .sort((x, y) => (x.prevista < y.prevista ? -1 : x.prevista > y.prevista ? 1 : 0));

  const tbody = $('#tabela');
  tbody.replaceChildren();
  for (const c of linhas) {
    const st = status(c);
    tbody.append(el('tr', { onclick: () => abrirModal(c) },
      el('td', {}, String(c.numero)),
      el('td', {}, c.material),
      el('td', {}, c.patrimonio || '—'),
      el('td', {}, String(c.quantidade)),
      el('td', {}, c.responsavel),
      el('td', {}, formatar(c.retirada)),
      el('td', {}, formatar(c.prevista)),
      el('td', {}, el('span', { class: `badge ${st}` }, ROTULO_STATUS[st])),
      el('td', {}, st === 'devolvida' ? '' : el('button', {
        class: 'btn small',
        onclick: (e) => { e.stopPropagation(); registrarDevolucao(c); },
      }, 'Devolver'))));
  }
  $('#lista-vazia').hidden = linhas.length > 0;
}

// ---------- Modal ----------
const modal = $('#modal');
const form = $('#form');

function abrirModal(cautela = null, dataPadrao = null) {
  form.reset();
  $('#form-erro').hidden = true;
  const editando = Boolean(cautela);
  $('#modal-titulo').textContent = editando ? `Cautela nº ${cautela.numero}` : 'Nova cautela';
  $('#btn-excluir').hidden = !editando;
  $('#btn-devolver').hidden = !editando || Boolean(cautela.devolvida);

  if (editando) {
    for (const [k, v] of Object.entries(cautela)) {
      if (form.elements[k]) form.elements[k].value = v ?? '';
    }
  } else {
    const inicio = dataPadrao || hojeIso();
    form.elements.retirada.value = inicio;
    const [a, m, d] = inicio.split('-').map(Number);
    form.elements.prevista.value = isoDe(new Date(a, m - 1, d + 7));
  }
  modal.showModal();
  form.elements.material.focus();
}

function atualizarTudo() {
  renderStats();
  renderCalendario();
  renderLista();
}

// Executa uma gravação no Firestore mostrando o estado na barra superior.
async function gravar(acao) {
  const sync = $('#sync');
  sync.className = 'sync salvando';
  sync.textContent = '● Salvando…';
  try {
    await acao();
    sync.className = 'sync';
    sync.textContent = '● Online';
    return true;
  } catch (err) {
    console.error(err);
    sync.className = 'sync offline';
    sync.textContent = '● Erro ao salvar';
    alert(`Não foi possível salvar: ${err.message || err}`);
    return false;
  }
}

const quem = () => auth.currentUser?.email || '';

// Cria a cautela e reserva o próximo número numa transação, para que dois
// computadores salvando ao mesmo tempo nunca recebam o mesmo número.
function criarCautela(dados) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(contador);
    const numero = (snap.exists() ? snap.data().ultimo || 0 : 0) + 1;
    tx.set(contador, { ultimo: numero });
    tx.set(doc(colecao), {
      ...dados, numero, criadoPor: quem(), criadoEm: serverTimestamp(),
      atualizadoPor: quem(), atualizadoEm: serverTimestamp(),
    });
  });
}

function atualizarCautela(id, dados) {
  return updateDoc(doc(colecao, id), { ...dados, atualizadoPor: quem(), atualizadoEm: serverTimestamp() });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  if (f.prevista < f.retirada) {
    mostrarErro('A devolução prevista não pode ser anterior à retirada.');
    return;
  }
  if (f.devolvida && f.devolvida < f.retirada) {
    mostrarErro('A data de devolução não pode ser anterior à retirada.');
    return;
  }
  const dados = {
    material: f.material.trim(),
    patrimonio: f.patrimonio.trim(),
    quantidade: Math.max(1, parseInt(f.quantidade, 10) || 1),
    responsavel: f.responsavel.trim(),
    identificacao: f.identificacao.trim(),
    retirada: f.retirada,
    prevista: f.prevista,
    devolvida: f.devolvida || '',
    cautelante: f.cautelante.trim(),
    obs: f.obs.trim(),
  };
  const botao = form.querySelector('button[type=submit]');
  botao.disabled = true;
  const ok = await gravar(() => (f.id ? atualizarCautela(f.id, dados) : criarCautela(dados)));
  botao.disabled = false;
  if (ok) modal.close();
});

function mostrarErro(msg) {
  const p = $('#form-erro');
  p.textContent = msg;
  p.hidden = false;
}

function registrarDevolucao(c) {
  const data = hojeIso() < c.retirada ? c.retirada : hojeIso();
  return gravar(() => atualizarCautela(c.id, { devolvida: data }));
}

$('#btn-cancelar').addEventListener('click', () => modal.close());
$('#btn-devolver').addEventListener('click', async () => {
  const c = cautelas.find((x) => x.id === form.elements.id.value);
  if (c && await registrarDevolucao(c)) modal.close();
});
$('#btn-excluir').addEventListener('click', async () => {
  const id = form.elements.id.value;
  const c = cautelas.find((x) => x.id === id);
  if (c && confirm(`Excluir a cautela nº ${c.numero} (${c.material})?`)) {
    if (await gravar(() => deleteDoc(doc(colecao, id)))) modal.close();
  }
});

// ---------- Exportar / importar ----------
function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = el('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const CAMPOS = ['id', 'numero', 'material', 'patrimonio', 'quantidade', 'responsavel', 'identificacao',
  'retirada', 'prevista', 'devolvida', 'cautelante', 'obs'];
const soCampos = (c) => Object.fromEntries(CAMPOS.map((k) => [k, c[k] ?? '']));

$('#btn-export').addEventListener('click', () => {
  baixar(`cautelas-${hojeIso()}.json`, JSON.stringify(cautelas.map(soCampos), null, 2), 'application/json');
});

$('#btn-csv').addEventListener('click', () => {
  const cab = ['Nº', 'Material', 'Patrimônio/Série', 'Quantidade', 'Responsável', 'Identificação',
    'Retirada', 'Devolução prevista', 'Devolvida em', 'Entregue por', 'Status', 'Observações'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = cautelas.map((c) => [c.numero, c.material, c.patrimonio, c.quantidade, c.responsavel,
    c.identificacao, formatar(c.retirada), formatar(c.prevista), c.devolvida ? formatar(c.devolvida) : '',
    c.cautelante, ROTULO_STATUS[status(c)], c.obs].map(esc).join(';'));
  baixar(`cautelas-${hojeIso()}.csv`, '﻿' + [cab.map(esc).join(';'), ...linhas].join('\r\n'), 'text/csv');
});

// Importa um backup JSON: cautelas com o mesmo id são atualizadas, as demais são adicionadas.
$('#btn-import').addEventListener('change', async (e) => {
  const arquivo = e.target.files[0];
  e.target.value = '';
  if (!arquivo) return;
  let dados;
  try {
    dados = JSON.parse(await arquivo.text());
    const validos = Array.isArray(dados) && dados.every((c) => c && c.id && c.material && c.retirada && c.prevista);
    if (!validos) throw new Error('formato');
  } catch {
    alert('Arquivo inválido. Use um backup JSON gerado por este sistema.');
    return;
  }
  if (!confirm(`Importar ${dados.length} cautela(s)? Cautelas já existentes com o mesmo código serão atualizadas.`)) return;
  await gravar(async () => {
    for (let i = 0; i < dados.length; i += 400) {
      const lote = writeBatch(db);
      for (const c of dados.slice(i, i + 400)) {
        const { id, ...resto } = soCampos(c);
        lote.set(doc(colecao, String(id)), {
          ...resto, quantidade: Number(resto.quantidade) || 1, numero: Number(resto.numero) || 0,
          atualizadoPor: quem(), atualizadoEm: serverTimestamp(),
        });
      }
      await lote.commit();
    }
    const maior = dados.reduce((m, c) => Math.max(m, Number(c.numero) || 0), 0);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(contador);
      if (!snap.exists() || (snap.data().ultimo || 0) < maior) tx.set(contador, { ultimo: maior });
    });
  });
});

// ---------- Navegação ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${tab.dataset.view}`; });
  });
});

$('#cal-prev').addEventListener('click', () => { mesAtual.setMonth(mesAtual.getMonth() - 1); renderCalendario(); });
$('#cal-next').addEventListener('click', () => { mesAtual.setMonth(mesAtual.getMonth() + 1); renderCalendario(); });
$('#cal-hoje').addEventListener('click', () => {
  mesAtual = new Date();
  mesAtual.setDate(1);
  selecionarDia(hojeIso());
});
['#f-retiradas', '#f-devolucoes', '#f-devolvidas'].forEach((s) => $(s).addEventListener('change', renderCalendario));
$('#busca').addEventListener('input', renderLista);
$('#filtro-status').addEventListener('change', renderLista);
$('#btn-nova').addEventListener('click', () => abrirModal());
$('#dia-nova').addEventListener('click', () => abrirModal(null, diaSelecionado));

// ---------- Login ----------
function mostrarTela(qual) {
  $('#tela-aviso').hidden = qual !== 'aviso';
  $('#tela-login').hidden = qual !== 'login';
  $('#app').hidden = qual !== 'app';
}

function escutarCautelas() {
  pararEscuta = onSnapshot(colecao, { includeMetadataChanges: true }, (snap) => {
    cautelas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sync = $('#sync');
    if (!sync.classList.contains('salvando')) {
      sync.className = snap.metadata.fromCache ? 'sync offline' : 'sync';
      sync.textContent = snap.metadata.fromCache ? '● Sem conexão' : '● Online';
    }
    atualizarTudo();
  }, (err) => {
    console.error(err);
    $('#sync').className = 'sync offline';
    $('#sync').textContent = '● Sem permissão';
    alert(`Não foi possível ler as cautelas: ${err.message || err}`);
  });
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const erro = $('#login-erro');
  erro.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, f.get('email').trim(), f.get('senha'));
  } catch {
    erro.textContent = 'E-mail ou senha incorretos.';
    erro.hidden = false;
  }
});

$('#btn-esqueci').addEventListener('click', async () => {
  const email = $('#form-login').elements.email.value.trim();
  const erro = $('#login-erro');
  if (!email) {
    erro.textContent = 'Digite seu e-mail acima e clique novamente.';
    erro.hidden = false;
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    erro.textContent = 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.';
  } catch {
    erro.textContent = 'Não foi possível enviar o e-mail. Confira o endereço.';
  }
  erro.hidden = false;
});

$('#btn-sair').addEventListener('click', () => signOut(auth));

// ---------- Inicialização ----------
$('#cal-weekdays').append(...DIAS_SEMANA.map((d) => el('div', {}, d)));

if (!configurado) {
  $('#aviso-texto').textContent =
    'Falta configurar o Firebase: preencha o arquivo firebase-config.js (veja o README).';
} else {
  onAuthStateChanged(auth, (usuario) => {
    if (pararEscuta) { pararEscuta(); pararEscuta = null; }
    cautelas = [];
    if (usuario) {
      $('#usuario').textContent = usuario.email;
      mostrarTela('app');
      atualizarTudo();
      escutarCautelas();
    } else {
      modal.close();
      mostrarTela('login');
    }
  });
}
