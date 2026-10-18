// Editor Viral: front simples, sem framework.
const $ = (s) => document.querySelector(s);
const estado = { formatos: [], formato: null, arquivos: {}, jobId: null, timer: null };
const salvarLocal = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const lerLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

async function chamar(url, opcoes = {}) {
  const r = await fetch(url, { credentials: 'same-origin', ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) } });
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('/login')) { mostrar('tela-login'); throw new Error(dados.erro || 'Entre com a senha.'); }
  if (!r.ok) throw new Error(dados.erro || 'Deu um erro. Tenta de novo.');
  return dados;
}

function mostrar(id) {
  document.querySelectorAll('.tela').forEach((t) => { t.hidden = t.id !== id; });
  document.body.classList.toggle('modo-escuro', id === 'tela-editando');
  document.querySelector('meta[name=theme-color]').content = id === 'tela-editando' ? '#15131D' : '#F3F2F7';
  const passo = { 'tela-formato': 1, 'tela-briefing': 2, 'tela-upload': 3 }[id];
  $('#passos').hidden = !passo;
  document.querySelectorAll('#passos i').forEach((i, n) => i.classList.toggle('feito', passo && n < passo));
  window.scrollTo(0, 0);
}

// ---------- login ----------
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-erro').hidden = true;
  try {
    await chamar('/api/login', { method: 'POST', body: JSON.stringify({ senha: $('#senha').value.trim() }) });
    iniciar();
  } catch (err) { $('#login-erro').textContent = err.message; $('#login-erro').hidden = false; }
});

// ---------- tela 1 ----------
function montarFormatos() {
  const lista = $('#lista-formatos');
  lista.innerHTML = '';
  for (const f of estado.formatos) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'formato'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<strong></strong><span></span>`;
    b.querySelector('strong').textContent = f.nome;
    b.querySelector('span').textContent = f.frase;
    b.addEventListener('click', () => {
      estado.formato = f;
      lista.querySelectorAll('.formato').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#ir-briefing').disabled = false;
    });
    lista.appendChild(b);
  }
}
$('#ir-briefing').addEventListener('click', () => { montarBriefing(); mostrar('tela-briefing'); });

// ---------- tela 2 ----------
function criarCampo(c) {
  const wrap = document.createElement('div');
  if (c.tipo === 'toggle') {
    wrap.innerHTML = `<label class="chave"><input type="checkbox"><span class="trilho"></span><span></span></label>`;
    wrap.querySelector('input').dataset.campo = c.id;
    wrap.querySelector('input').checked = !!c.padrao;
    wrap.querySelector('span:last-child').textContent = c.rotulo;
    return wrap;
  }
  const label = document.createElement(c.tipo === 'lista' ? 'div' : 'label');
  label.className = 'campo';
  const titulo = document.createElement('span'); titulo.textContent = c.rotulo + (c.obrigatorio ? '' : '');
  label.appendChild(titulo);
  let el;
  if (c.tipo === 'select') {
    el = document.createElement('select');
    for (const o of c.opcoes) { const op = document.createElement('option'); op.value = o; op.textContent = c.id === 'top' ? `Top ${o}` : o; el.appendChild(op); }
    el.value = c.padrao || c.opcoes[0];
  } else if (c.tipo === 'area') {
    el = document.createElement('textarea'); el.rows = 4;
  } else if (c.tipo === 'lista') {
    el = document.createElement('div'); el.className = 'grupo-lista';
  } else {
    el = document.createElement('input');
  }
  el.dataset.campo = c.id;
  if (c.exemplo && c.tipo !== 'lista') el.placeholder = `Ex: ${c.exemplo}`;
  label.appendChild(el);
  if (c.dica) { const s = document.createElement('small'); s.textContent = c.dica; label.appendChild(s); }
  wrap.appendChild(label);
  return wrap;
}

function montarLista(c, caixa, tamanho) {
  const antigos = [...caixa.querySelectorAll('input')].map((i) => i.value);
  caixa.innerHTML = '';
  for (let k = 0; k < tamanho; k++) {
    let rotulo;
    if (c.tamanhoDe) rotulo = `${tamanho - k}º lugar`;
    else rotulo = (c.rotulos && c.rotulos[k]) || `${k + 1}`;
    const l = document.createElement('label');
    l.innerHTML = '<em></em><input>';
    l.querySelector('em').textContent = rotulo;
    const inp = l.querySelector('input');
    inp.value = antigos[k] || '';
    if (c.exemplos && c.exemplos[k]) inp.placeholder = `Ex: ${c.exemplos[k]}`;
    else if (c.exemplo && k === 0) inp.placeholder = `Ex: ${c.exemplo}`;
    caixa.appendChild(l);
  }
}

function montarBriefing() {
  const f = estado.formato;
  $('#b-formato').textContent = f.nome; $('#u-formato').textContent = f.nome;
  const box = $('#campos-formato');
  box.innerHTML = '';
  for (const c of f.campos) box.appendChild(criarCampo(c));
  for (const c of f.campos.filter((x) => x.tipo === 'lista')) {
    const caixa = box.querySelector(`[data-campo="${c.id}"]`);
    if (c.tamanhoDe) {
      const sel = box.querySelector(`[data-campo="${c.tamanhoDe}"]`);
      const atualizar = () => montarLista(c, caixa, parseInt(sel.value, 10));
      sel.addEventListener('change', atualizar); atualizar();
    } else montarLista(c, caixa, c.tamanho || 3);
  }
  $('#linha-sons').hidden = !f.sons;
}

function lerBriefing() {
  const f = estado.formato;
  const campos = {};
  for (const c of f.campos) {
    const el = document.querySelector(`#campos-formato [data-campo="${c.id}"]`);
    if (c.tipo === 'toggle') campos[c.id] = el.checked;
    else if (c.tipo === 'lista') campos[c.id] = [...el.querySelectorAll('input')].map((i, k, todos) => {
      const r = el.querySelectorAll('em')[k].textContent;
      return i.value.trim() ? `${r}: ${i.value.trim()}` : '';
    });
    else campos[c.id] = el.value.trim();
  }
  return { formato: f.id, nicho: $('#nicho').value.trim(), sobre: $('#sobre').value.trim(), sons: f.sons && $('#sons').checked, campos };
}

$('#ir-upload').addEventListener('click', () => {
  if (!$('#form-briefing').reportValidity()) return;
  montarUpload(); mostrar('tela-upload');
});
document.querySelectorAll('[data-voltar]').forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.voltar)));

// ---------- tela 3 ----------
const LIMITE_SEG = 120;
const mmss = (seg) => { const s = Math.round(seg); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Lê a duração no próprio aparelho, antes de enviar. Alguns navegadores não leem MOV do iPhone:
// aí volta null e o servidor confere depois do envio.
function lerDuracao(arq) {
  return new Promise((ok) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(arq);
    const fim = (d) => { clearTimeout(t); URL.revokeObjectURL(url); ok(Number.isFinite(d) && d > 0 ? d : null); };
    const t = setTimeout(() => fim(null), 8000);
    v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => fim(v.duration);
    v.onerror = () => fim(null);
    v.src = url;
  });
}

function totalConhecido() {
  let t = 0, faltaLer = false;
  for (const ps of Object.values(estado.arquivos)) for (const p of ps) { if (p.duracao == null) faltaLer = true; else t += p.duracao; }
  return { t, faltaLer };
}

function montarUpload() {
  estado.arquivos = {};
  for (const v of estado.formato.videos) estado.arquivos[v.slot] = [];
  const ul = $('#lista-dicas'); ul.innerHTML = '';
  for (const d of [...estado.formato.dicas, 'Manda o material todo com menos de 2 minutos, somando todas as partes. Se passar, corta antes de enviar.']) {
    const li = document.createElement('li'); li.textContent = d; ul.appendChild(li);
  }
  avisoUpload(null);
  pintarUploads();
}

function pintarUploads() {
  const f = estado.formato;
  const box = $('#lista-uploads');
  box.innerHTML = '';
  const { t, faltaLer } = totalConhecido();
  const passou = t > LIMITE_SEG + 0.5;
  const tot = document.createElement('p');
  tot.className = 'total-material' + (passou ? ' passou' : '');
  tot.textContent = `Material: ${mmss(t)} de 2:00${faltaLer ? ' (alguma parte a gente confere no envio)' : ''}`;
  box.appendChild(tot);

  for (const v of f.videos) {
    const max = v.partes || 1;
    const partes = estado.arquivos[v.slot];
    const grupo = document.createElement('div');
    grupo.className = 'cartao grupo-upload';
    grupo.dataset.slot = v.slot;
    const h = document.createElement('h2'); h.textContent = v.rotulo; grupo.appendChild(h);
    if (max > 1) { const s = document.createElement('p'); s.className = 'sub pequeno'; s.textContent = `Pode mandar até ${max} partes. A gente junta na ordem da lista.`; grupo.appendChild(s); }

    const lista = document.createElement('ol'); lista.className = 'partes';
    partes.forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="nome"></span><span class="dur"></span><button type="button" class="tirar">Tirar</button><div class="envio" hidden><div></div></div>';
      li.querySelector('.nome').textContent = p.arq.name;
      li.querySelector('.dur').textContent = p.duracao == null ? '' : mmss(p.duracao);
      li.querySelector('.tirar').addEventListener('click', () => { partes.splice(i, 1); avisoUpload(null); pintarUploads(); });
      p.li = li;
      lista.appendChild(li);
    });
    if (partes.length) grupo.appendChild(lista);

    if (partes.length < max) {
      const l = document.createElement('label');
      l.className = 'upload';
      l.innerHTML = '<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov"><div class="caixa"><strong></strong><span>MP4 ou MOV</span></div>';
      l.querySelector('strong').textContent = partes.length ? 'Adicionar outra parte' : 'Toque pra escolher o vídeo';
      l.querySelector('input').addEventListener('change', async (e) => {
        const arq = e.target.files[0];
        if (!arq) return;
        if (!/\.(mp4|mov)$/i.test(arq.name)) return avisoUpload('Manda um vídeo MP4 ou MOV.');
        const duracao = await lerDuracao(arq);
        const novoTotal = totalConhecido().t + (duracao || 0);
        if (duracao != null && novoTotal > LIMITE_SEG + 0.5) {
          return avisoUpload(`Com essa parte o material todo daria ${mmss(novoTotal)}, e o limite é 2:00. Corta os vídeos antes e manda tudo somando menos de 2 minutos.`);
        }
        partes.push({ arq, duracao });
        avisoUpload(null);
        pintarUploads();
      });
      grupo.appendChild(l);
    }
    box.appendChild(grupo);
  }
  $('#editar').disabled = passou || !f.videos.every((v) => estado.arquivos[v.slot].length);
}
function avisoUpload(t) { $('#upload-erro').hidden = !t; $('#upload-erro').textContent = t || ''; }

function enviarArquivo(jobId, slot, arq, aoProgresso) {
  return new Promise((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open('PUT', `/api/jobs/${jobId}/videos/${slot}`);
    x.setRequestHeader('x-nome', encodeURIComponent(arq.name));
    x.upload.onprogress = (e) => e.lengthComputable && aoProgresso(e.loaded);
    x.onload = () => {
      let d = {}; try { d = JSON.parse(x.responseText); } catch {}
      x.status === 200 ? ok(d) : falha(new Error(d.erro || 'Não deu pra mandar o vídeo.'));
    };
    x.onerror = () => falha(new Error('A conexão caiu no meio do envio. Tenta de novo.'));
    x.send(arq);
  });
}

$('#editar').addEventListener('click', async () => {
  const btn = $('#editar');
  btn.disabled = true; avisoUpload(null);
  let job = null;
  try {
    btn.textContent = 'Preparando...';
    job = await chamar('/api/jobs', { method: 'POST', body: JSON.stringify(lerBriefing()) });
    const todas = estado.formato.videos.flatMap((v) => estado.arquivos[v.slot].map((p) => ({ slot: v.slot, p })));
    const bytesTotal = todas.reduce((s, x) => s + x.p.arq.size, 0);
    let enviados = 0;
    for (const { slot, p } of todas) {
      const barra = p.li && p.li.querySelector('.envio'); if (barra) barra.hidden = false;
      await enviarArquivo(job.id, slot, p.arq, (n) => {
        if (barra) barra.firstElementChild.style.width = `${Math.round((n / p.arq.size) * 100)}%`;
        btn.textContent = `Enviando ${Math.round(((enviados + n) / bytesTotal) * 100)}%`;
      });
      enviados += p.arq.size;
    }
    btn.textContent = 'Começando...';
    await chamar(`/api/jobs/${job.id}/iniciar`, { method: 'POST' });
    estado.jobId = job.id; salvarLocal('ev_job', job.id);
    acompanhar();
  } catch (err) {
    if (job) fetch(`/api/jobs/${job.id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    avisoUpload(err.message);
    pintarUploads();
  } finally { btn.textContent = 'Editar meu vídeo'; }
});

// ---------- tela 4 ----------
function pintarEditando(j) {
  mostrar('tela-editando');
  const lista = $('#ed-etapas');
  const ids = j.etapas.map((e) => e.id);
  const atual = ids.indexOf(j.etapa);
  const editando = j.status === 'editando';
  lista.innerHTML = '';
  j.etapas.forEach((e, i) => {
    const li = document.createElement('li');
    li.textContent = e.rotulo;
    if (i === 0 || i < atual) li.className = 'feita';
    else if (i === atual && editando) li.className = 'agora';
    else if (i === atual + 1 && editando && atual === 0) li.className = 'agora';
    lista.appendChild(li);
  });
  const prog = Math.max(0.04, (atual + (editando ? 0.5 : 0)) / ids.length);
  $('#ed-barra').style.width = `${Math.round(prog * 100)}%`;

  $('#ed-pergunta').hidden = j.status !== 'aguardando_resposta';
  $('#ed-erro').hidden = j.status !== 'erro';
  if (j.status === 'na_fila') {
    $('#ed-titulo').textContent = j.fila <= 1 ? 'Você é o próximo' : `Você é o ${j.fila}º da fila`;
    $('#ed-sub').textContent = 'Tem outro vídeo sendo editado agora. Assim que ele terminar, começa o seu.';
  } else if (j.status === 'aguardando_resposta') {
    $('#ed-titulo').textContent = 'Pausei pra te perguntar';
    $('#ed-sub').textContent = 'Responde aqui embaixo e a edição continua de onde parou.';
    $('#ed-pergunta-texto').textContent = j.pergunta.pergunta;
    $('#ed-pergunta-detalhe').hidden = !j.pergunta.detalhe;
    $('#ed-pergunta-detalhe').textContent = j.pergunta.detalhe || '';
    $('#ed-pergunta').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (j.status === 'erro') {
    $('#ed-titulo').textContent = 'A edição parou';
    $('#ed-sub').textContent = '';
    $('#ed-erro-texto').textContent = j.erro || 'Deu um problema na edição.';
  } else {
    $('#ed-titulo').textContent = 'Editando seu vídeo';
    $('#ed-sub').textContent = 'Pode deixar essa tela aberta. Leva uns 15 a 30 minutos. Se fechar, é só abrir de novo que ela volta aqui.';
  }
}

async function acompanhar() {
  clearTimeout(estado.timer);
  let j;
  try { j = await chamar(`/api/jobs/${estado.jobId}`); }
  catch (e) {
    if (/não existe/.test(e.message)) { salvarLocal('ev_job', null); return mostrar('tela-formato'); }
    estado.timer = setTimeout(acompanhar, 4000); return;
  }
  if (j.status === 'pronto') return pintarPronto(j);
  if (j.status === 'rascunho') { salvarLocal('ev_job', null); return mostrar('tela-formato'); }
  pintarEditando(j);
  if (j.status === 'editando' || j.status === 'na_fila') estado.timer = setTimeout(acompanhar, 2500);
}

$('#ed-responder').addEventListener('click', async () => {
  const texto = $('#ed-resposta').value.trim();
  if (!texto) return $('#ed-resposta').focus();
  try {
    await chamar(`/api/jobs/${estado.jobId}/responder`, { method: 'POST', body: JSON.stringify({ texto }) });
    $('#ed-resposta').value = '';
    acompanhar();
  } catch (e) { alert(e.message); }
});
$('#ed-tentar').addEventListener('click', async () => {
  try { await chamar(`/api/jobs/${estado.jobId}/tentar`, { method: 'POST' }); acompanhar(); }
  catch (e) { alert(e.message); }
});

// ---------- tela 5 ----------
function pintarPronto(j) {
  mostrar('tela-pronto');
  const src = `/api/jobs/${j.id}/final?v=${j.versao}`;
  const v = $('#final');
  if (v.dataset.src !== src) { v.src = src; v.dataset.src = src; }
  $('#pr-resumo').textContent = j.versao > 1 ? `Versão ${j.versao}, com o seu ajuste. Também salvei na sua Área de Trabalho.` : 'Também salvei uma cópia na sua Área de Trabalho.';
  $('#baixar').href = `${src}&baixar=1`;
  $('#ajustes-restantes').textContent = j.ajustesRestantes > 0
    ? `Você ainda pode pedir ${j.ajustesRestantes} ajuste${j.ajustesRestantes > 1 ? 's' : ''} neste vídeo.`
    : 'Esse vídeo já usou os 2 ajustes.';
  $('#abrir-ajuste').hidden = j.ajustesRestantes <= 0;
  $('#form-ajuste').hidden = true;
}
$('#baixar').addEventListener('click', async (e) => {
  // No celular com https, abre o "Salvar vídeo" do aparelho. Sem https, baixa normal.
  if (!(navigator.canShare && window.isSecureContext)) return;
  e.preventDefault();
  try {
    const blob = await (await fetch($('#baixar').href)).blob();
    const arq = new File([blob], 'video-editado.mp4', { type: 'video/mp4' });
    if (navigator.canShare({ files: [arq] })) await navigator.share({ files: [arq] });
    else location.href = $('#baixar').href;
  } catch { location.href = $('#baixar').href; }
});
$('#abrir-ajuste').addEventListener('click', () => { $('#form-ajuste').hidden = false; $('#ajuste').focus(); });
$('#form-ajuste').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = $('#ajuste').value.trim();
  if (!texto) return $('#ajuste').focus();
  try {
    await chamar(`/api/jobs/${estado.jobId}/ajustar`, { method: 'POST', body: JSON.stringify({ texto }) });
    $('#ajuste').value = '';
    acompanhar();
  } catch (err) { alert(err.message); }
});

// ---------- novo vídeo ----------
document.querySelectorAll('[data-novo]').forEach((b) => b.addEventListener('click', () => {
  clearTimeout(estado.timer);
  estado.jobId = null; estado.formato = null; salvarLocal('ev_job', null);
  $('#form-briefing').reset(); $('#final').removeAttribute('src'); $('#final').dataset.src = '';
  montarFormatos(); $('#ir-briefing').disabled = true;
  mostrar('tela-formato');
}));

// ---------- início ----------
async function iniciar() {
  const s = await chamar('/api/sessao').catch(() => ({ logado: false }));
  if (!s.logado) return mostrar('tela-login');
  estado.formatos = await chamar('/api/formatos');
  montarFormatos();
  const salvo = lerLocal('ev_job');
  if (salvo) { estado.jobId = salvo; return acompanhar(); }
  mostrar('tela-formato');
}
iniciar();
