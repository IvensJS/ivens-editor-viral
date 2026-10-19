// Editor Viral: servidor local. Só usa o Node (sem dependências).
// Recebe o vídeo e o briefing, cria o projeto no HyperFrames Student Kit
// e chama o Claude Code (claude -p) com a skill do formato. Um vídeo por vez.

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { FORMATOS, formatosPublicos } = require('./formatos');

// ---------- caminhos e config ----------
const HOME = os.homedir();
const RAIZ = __dirname;
const PUBLIC = path.join(RAIZ, 'public');
const SKILLS_APP = path.join(RAIZ, 'skills'); // as skills que vêm com o app (Jeito 2)
const DADOS = process.env.EV_DADOS || path.join(RAIZ, 'dados');
const UPLOADS = path.join(DADOS, 'uploads');
const LOGS = path.join(RAIZ, 'logs');
const KIT = path.join(HOME, 'hyperframes-student-kit');
const APP_EDICAO = path.join(HOME, 'Documents', 'projetos', 'app-edicao');
const CLAUDE = path.join(HOME, '.local', 'bin', 'claude.exe');
const DESKTOP = [path.join(HOME, 'Desktop'), path.join(HOME, 'OneDrive', 'Desktop'), path.join(HOME, 'OneDrive', 'Área de Trabalho')]
  .find((p) => fs.existsSync(p)) || path.join(HOME, 'Desktop');
const MAX_AJUSTES = 2;
const MAX_UPLOAD = 6 * 1024 ** 3; // 6 GB por arquivo
const LIMITE_SEG = 120; // material bruto: no máximo 2 minutos somando todas as partes
for (const d of [DADOS, UPLOADS, LOGS]) fs.mkdirSync(d, { recursive: true });

const CONFIG_ARQ = path.join(RAIZ, 'config.json');
if (!fs.existsSync(CONFIG_ARQ)) {
  const senha = crypto.randomInt(100000, 999999).toString();
  fs.writeFileSync(CONFIG_ARQ, JSON.stringify({ porta: 3210, senha, rede: true }, null, 2));
}
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_ARQ, 'utf8'));
if (process.env.EV_PORTA) CONFIG.porta = parseInt(process.env.EV_PORTA, 10);

function logErro(titulo, detalhe) {
  const linha = `[${new Date().toISOString()}] ${titulo}\n${detalhe instanceof Error ? detalhe.stack : String(detalhe || '')}\n\n`;
  fs.appendFileSync(path.join(LOGS, 'erros.log'), linha);
}

// ---------- jobs (salvos em disco) ----------
const JOBS_ARQ = path.join(DADOS, 'jobs.json');
let JOBS = fs.existsSync(JOBS_ARQ) ? JSON.parse(fs.readFileSync(JOBS_ARQ, 'utf8')) : {};
let salvarTimer = null;
function salvar() {
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(() => fs.writeFileSync(JOBS_ARQ, JSON.stringify(JOBS, null, 2)), 150);
}
const FILA = []; // { jobId, tipo: 'editar' | 'responder' | 'ajustar' | 'continuar', texto }
let ATUAL = null; // { jobId, filho }

// Jobs antigos guardavam um vídeo por slot; agora cada slot é uma lista de partes.
for (const j of Object.values(JOBS)) {
  for (const [s, v] of Object.entries(j.uploads || {})) if (!Array.isArray(v)) j.uploads[s] = [{ id: '00000000', duracao: 0, ...v }];
  for (const [s, v] of Object.entries(j.videosProjeto || {})) if (!Array.isArray(v)) j.videosProjeto[s] = [v];
}

// Se o servidor caiu no meio de uma edição, avisa e deixa tentar de novo.
for (const j of Object.values(JOBS)) {
  if (j.status === 'editando' || j.status === 'na_fila') {
    j.status = 'erro';
    j.erro = 'O editor foi fechado no meio da edição. Toque em "Tentar de novo" pra continuar de onde parou.';
  }
}
salvar();

const ETAPAS = [
  { id: 'recebido', rotulo: 'Vídeo recebido' },
  { id: 'falas', rotulo: 'Lendo as falas' },
  { id: 'cortes', rotulo: 'Cortando as pausas' },
  { id: 'sons', rotulo: 'Colocando os sons' },
  { id: 'tela', rotulo: 'Montando a tela' },
  { id: 'final', rotulo: 'Finalizando' },
];
function etapasDo(job) {
  return ETAPAS.filter((e) => e.id !== 'sons' || job.briefing.sons);
}
function avancar(job, etapa) {
  const lista = etapasDo(job).map((e) => e.id);
  if (!lista.includes(etapa)) return;
  if (lista.indexOf(etapa) > lista.indexOf(job.etapa || 'recebido')) { job.etapa = etapa; salvar(); }
}

function posicaoNaFila(jobId) {
  const i = FILA.findIndex((f) => f.jobId === jobId);
  return i < 0 ? 0 : i + 1;
}

function visaoPublica(job) {
  const f = FORMATOS.find((x) => x.id === job.formato);
  return {
    id: job.id, formato: job.formato, formatoNome: f ? f.nome : job.formato,
    status: job.status, etapa: job.etapa, etapas: etapasDo(job),
    fila: posicaoNaFila(job.id), editandoOutro: !!(ATUAL && ATUAL.jobId !== job.id),
    pergunta: job.pergunta || null, erro: job.erro || null,
    resumo: job.resumo || null, temFinal: !!job.final,
    ajustesRestantes: MAX_AJUSTES - (job.ajustesUsados || 0),
    videos: Object.fromEntries(Object.entries(job.uploads || {}).map(([s, ps]) => [s, ps.map((p) => ({ id: p.id, nome: p.nome, duracao: p.duracao }))])),
    duracaoTotal: duracaoTotal(job), limite: LIMITE_SEG, versao: job.versao || 0,
  };
}

// ---------- duração do material bruto ----------
function ffprobeExe() {
  const nome = 'ffprobe.exe';
  for (const d of ambienteFilho().Path.split(';')) { const p = path.join(d, nome); if (d && fs.existsSync(p)) return p; }
  return 'ffprobe';
}
function duracaoDe(arquivo) {
  const r = spawnSync(ffprobeExe(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo], { encoding: 'utf8', windowsHide: true });
  const s = parseFloat((r.stdout || '').trim());
  return Number.isFinite(s) ? s : null;
}
function duracaoTotal(job) {
  let t = 0;
  for (const ps of Object.values(job.uploads || {})) for (const p of ps) t += p.duracao || 0;
  return Math.round(t * 10) / 10;
}
function mmss(seg) { const s = Math.round(seg); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
const AVISO_LIMITE = (total) => `O material todo deu ${mmss(total)} e o limite é 2:00. Corta os vídeos antes e manda tudo somando menos de 2 minutos.`;

// ---------- briefing e prompt ----------
function slugDe(formato) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${formato}-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${crypto.randomBytes(2).toString('hex')}`;
}

function linhasBriefing(job) {
  const f = FORMATOS.find((x) => x.id === job.formato);
  const b = job.briefing;
  const out = [`- Formato: ${f.nome}`, `- Nicho: ${b.nicho || '(não informado)'}`, `- Sobre o que é o vídeo: ${b.sobre || '(não informado)'}`];
  for (const c of f.campos) {
    const v = b.campos ? b.campos[c.id] : undefined;
    if (c.tipo === 'toggle') { out.push(`- ${c.rotulo}: ${v ? 'sim' : 'não'}`); continue; }
    if (c.tipo === 'lista') {
      const itens = (Array.isArray(v) ? v : []).filter((x) => x && x.trim());
      if (!itens.length) { out.push(`- ${c.rotulo}: (não informado, tire da fala)`); continue; }
      out.push(`- ${c.rotulo}:`);
      for (const it of v) if (it && it.trim()) out.push(`  - ${it.trim()}`);
      continue;
    }
    const t = (v || '').toString().trim();
    out.push(`- ${c.rotulo}: ${t || '(não informado, use o padrão da skill)'}`);
  }
  if (f.sons) out.push(`- Efeitos sonoros: ${b.sons ? 'sim, sutis' : 'não'}`);
  else out.push('- Efeitos sonoros: este formato não usa');
  return out.join('\n');
}

// Comando do passo "Preparar" do Jeito 2, já com os vídeos (e as partes, na ordem) que o usuário mandou
function comandoPreparar(job, f) {
  const dir = path.join(SKILLS_APP, f.skill, 'scripts', 'jeito2');
  const q = (s) => `"${s}"`;
  if (f.id === 'problema-solucao') {
    return `node ${q(path.join(dir, 'preparar.mjs'))} ${q(job.videosProjeto.certo[0])} ${job.slug} ${f.id} --video2 ${q(job.videosProjeto.errado[0])}`;
  }
  const ps = job.videosProjeto[f.videos[0].slot];
  return `node ${q(path.join(dir, 'preparar.mjs'))} ${q(ps[0])} ${job.slug} ${f.id}${ps.slice(1).map((p) => ` --mais ${q(p)}`).join('')}`;
}

function promptInicial(job) {
  const f = FORMATOS.find((x) => x.id === job.formato);
  const ed = path.join(job.projeto, 'editor');
  const videos = f.videos.map((v) => {
    const ps = job.videosProjeto[v.slot];
    if (ps.length === 1) return `- ${v.rotulo}: ${ps[0]}`;
    return `- ${v.rotulo}, em ${ps.length} partes, NESTA ORDEM (a ordem em que foram gravadas):\n${ps.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`;
  }).join('\n');
  const dirSkill = path.join(SKILLS_APP, f.skill);
  const ps = f.id === 'problema-solucao' ? '\nNo plano deste formato, o vídeo A é o do lado certo e o B o do lado errado: use "lado_esq": "B" e "espelhar": false.' : '';
  return `Use a skill ${f.skill}, que vem junto com o Editor Viral: leia o arquivo ${path.join(dirSkill, 'SKILL.md')} inteiro e siga ele (NÃO use outra cópia dessa skill que estiver em .claude/skills). Os scripts do Jeito 2 estão em ${path.join(dirSkill, 'scripts', 'jeito2')}: rode sempre com esse caminho completo. Onde a skill falar em C:\\Users\\SEU-USUARIO, é a pasta ${HOME}.

Você está rodando dentro do Editor Viral, um app local, em modo automático: ninguém está olhando este chat. O briefing abaixo já foi respondido pelo usuário no app: pule a Etapa 1 (não peça o briefing de novo) e faça a edição pelo Jeito 2 (Etapa 2 da skill).

PRIMEIRO PASSO (Preparar), já montado com os vídeos na ordem certa:
${comandoPreparar(job, f)}${ps}

BRIEFING
${linhasBriefing(job)}

VÍDEO(S) ENVIADO(S) (${mmss(duracaoTotal(job))} no total)
${videos}

PROJETO
O projeto já foi criado em ${job.projeto} e os vídeos estão na pasta source. O preparar usa esse mesmo projeto. Nome curto do vídeo: ${job.slug}. Se precisar cair no Jeito antigo e o material veio em partes, use o bruto já juntado pelo preparar (source\\bruto.mov).

REGRAS DO APP (valem por cima da skill)
1. Progresso: no começo de cada fase, grave o arquivo ${path.join(ed, 'progresso.json')} com {"etapa": "<id>"}, usando estes ids: "falas" (preparar, ler a fala, pesquisar fotos e escrever o plano), "cortes" e "sons" (montar o rascunho), "tela" (revisão), "final" (render final e entrega).
2. Dúvidas: quando a skill mandar perguntar ao usuário antes de seguir (tabela confusa, número que não bate, gesto sem lado claro, trecho que pode ser rodada nova ou repetição etc.), NÃO pergunte no chat. Grave ${path.join(ed, 'pergunta.json')} com {"pergunta": "a pergunta em português simples, sem travessão", "detalhe": "a tabela ou o contexto, em texto"} e encerre a sua resposta. A resposta do usuário chega na próxima mensagem desta mesma conversa.
3. Entrega: siga a skill (vídeo final em ${path.join(APP_EDICAO, '02-finais')}). No fim, grave ${path.join(ed, 'resultado.json')} com {"arquivo": "<caminho completo do mp4 final>", "resumo": "a mensagem de entrega da skill, em texto simples e curto, sem travessão"}.
4. Não leia nem mostre o .env. Não apague nada. Use só as ferramentas liberadas.`;
}

function promptResposta(texto) {
  return `Resposta do usuário à sua pergunta, enviada pelo app:\n\n${texto}\n\nSiga a edição de onde parou, com as mesmas regras do app (progresso.json, pergunta.json se surgir outra dúvida, resultado.json no fim).`;
}
function promptAjuste(texto) {
  return `O usuário viu o vídeo pronto e pediu este ajuste pelo app:\n\n${texto}\n\nFaça o ajuste em cima do mesmo projeto (não comece do zero), renderize de novo e entregue como a próxima versão (v2, v3...) seguindo a skill. Mesmas regras do app: atualize progresso.json a cada fase (comece em "tela" se só mudar o design), use pergunta.json se tiver dúvida e grave um resultado.json novo no fim.`;
}
function promptContinuar() {
  return 'A edição foi interrompida no meio. Confira o que já está pronto na pasta do projeto e continue de onde parou, com as mesmas regras do app (progresso.json, pergunta.json, resultado.json).';
}

// ---------- permissões do claude -p ----------
function permissoes() {
  const cmds = ['ffmpeg', 'ffprobe', 'node', 'npm run', 'npx hyperframes', 'curl', 'mkdir', 'cp', 'mv', 'ls', 'cd', 'grep -a -c', 'export PATH='];
  const allow = [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'ToolSearch',
    'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
    'mcp__claude_ai_Firecrawl__firecrawl_search', 'mcp__claude_ai_Firecrawl__firecrawl_scrape',
    ...cmds.map((c) => `Bash(${c}${c.endsWith('=') ? '' : ' '}*)`),
    ...cmds.map((c) => `PowerShell(${c}${c.endsWith('=') ? '' : ' '}*)`),
  ];
  const deny = [
    'Read(**/.env)', 'Read(**/.env.*)', 'Edit(**/.env)', 'Write(**/.env)',
    'Edit(~/.claude/**)', 'Write(~/.claude/**)',
    'Bash(rm *)', 'Bash(git *)', 'PowerShell(Remove-Item *)', 'PowerShell(git *)',
    'WebFetch', 'WebSearch',
    'mcp__claude_ai_Gmail', 'mcp__claude_ai_Google_Calendar', 'mcp__claude_ai_Google_Drive',
    'mcp__claude_ai_Canva', 'mcp__claude_ai_Claude_Docs', 'mcp__claude_ai_Microsoft_365',
  ];
  return { allow, deny };
}

// Heurística de progresso pelo que o Claude está rodando (reserva do progresso.json).
function etapaPorFerramenta(nome, input) {
  const cmd = String((input && (input.command || input.file_path)) || '');
  // Jeito 2: preparar = falas; montador = cortes/sons/tela; --final = final
  if (/preparar\.mjs/.test(cmd)) return 'falas';
  if (/jeito2[\\/][a-z-]+\.mjs"?\s+\S+\s+--final/.test(cmd)) return 'final';
  if (/jeito2[\\/](destampando|mao-de-vaca|avaliacao|contraste|classificacao|problema-solucao)\.mjs/.test(cmd)) return 'cortes';
  if (/firecrawl/i.test(nome) || /transcribe-elevenlabs|ffprobe/.test(cmd)) return 'falas';
  if (/astats|silencedetect|filter_complex|atrim|loudnorm/.test(cmd)) return 'cortes';
  if (/sfx\.mjs|sound-generation|adelay|amix|ebur128/.test(cmd)) return 'sons';
  if (/(Write|Edit)/.test(nome) && /index\.html$/.test(cmd)) return 'tela';
  if (/hyperframes (lint|render).*draft|preflight/.test(cmd)) return 'tela';
  if (/-q high|map_metadata/.test(cmd)) return 'final';
  return null;
}

function ambienteFilho() {
  const env = { ...process.env };
  const extras = [path.dirname(process.execPath)];
  const ff = path.join(HOME, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const d of fs.readdirSync(ff)) if (/^Gyan\.FFmpeg/.test(d)) {
      for (const sub of fs.readdirSync(path.join(ff, d))) extras.push(path.join(ff, d, sub, 'bin'));
    }
  } catch {}
  env.Path = [...extras, env.Path || env.PATH || ''].join(';');
  delete env.PATH;
  delete env.ELEVENLABS_API_KEY; delete env.KIE_API_KEY; // os scripts do kit leem do .env deles
  return env;
}

// ---------- rodar o Claude ----------
function rodar(item) {
  const job = JOBS[item.jobId];
  const ed = path.join(job.projeto, 'editor');
  for (const a of ['pergunta.json', 'resultado.json', 'progresso.json']) { try { fs.unlinkSync(path.join(ed, a)); } catch {} }
  let prompt;
  if (item.tipo === 'editar') prompt = promptInicial(job);
  else if (item.tipo === 'responder') prompt = promptResposta(item.texto);
  else if (item.tipo === 'ajustar') prompt = promptAjuste(item.texto);
  else prompt = promptContinuar();

  const { allow, deny } = permissoes();
  const args = ['-p', '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
    '--add-dir', KIT, '--add-dir', SKILLS_APP, '--add-dir', path.join(HOME, '.claude', 'skills'),
    '--allowedTools', ...allow, '--disallowedTools', ...deny];
  if (job.sessaoIniciada) args.push('--resume', job.sessao);
  else args.push('--session-id', job.sessao);

  job.status = 'editando'; job.erro = null; job.pergunta = null;
  if (item.tipo === 'ajustar') job.etapa = 'tela';
  salvar();

  const log = fs.createWriteStream(path.join(ed, 'claude.log'), { flags: 'a' });
  log.write(`\n===== ${new Date().toISOString()} ${item.tipo} =====\n`);
  fs.writeFileSync(path.join(ed, `prompt-${Date.now()}.md`), prompt);

  const filho = spawn(CLAUDE, args, { cwd: APP_EDICAO, env: ambienteFilho(), windowsHide: true });
  ATUAL = { jobId: job.id, filho };
  job.sessaoIniciada = true; salvar();
  filho.stdin.end(prompt);

  let buf = '', resultadoFinal = null, stderr = '';
  filho.stdout.on('data', (d) => {
    log.write(d);
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!linha) continue;
      let ev; try { ev = JSON.parse(linha); } catch { continue; }
      if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
        for (const c of ev.message.content) if (c.type === 'tool_use') {
          const e = etapaPorFerramenta(c.name, c.input); if (e) avancar(job, e);
        }
      }
      if (ev.type === 'result') resultadoFinal = ev;
    }
  });
  filho.stderr.on('data', (d) => { stderr += d; log.write(d); });

  const vigia = setInterval(() => {
    try { const p = JSON.parse(fs.readFileSync(path.join(ed, 'progresso.json'), 'utf8')); if (p.etapa) avancar(job, p.etapa); } catch {}
  }, 2000);

  filho.on('error', (e) => { logErro(`Falha ao abrir o claude (${job.id})`, e); });
  filho.on('close', async (codigo) => {
    clearInterval(vigia); log.end();
    try { await terminou(job, codigo, resultadoFinal, stderr); }
    catch (e) { logErro(`Erro ao fechar a edição ${job.id}`, e); job.status = 'erro'; job.erro = 'Deu um erro no fim da edição.'; }
    ATUAL = null; salvar(); proximo();
  });
}

function mensagemDeErro(texto) {
  const t = String(texto || '');
  if (/usage limit|rate.?limit|limit reached|quota/i.test(t)) return 'Seu limite de uso do Claude acabou por agora. Espera um pouco e toca em "Tentar de novo".';
  if (/ELEVENLABS|elevenlabs|401|402/i.test(t)) return 'A ElevenLabs recusou o pedido. Confere se a chave no .env está certa e se tem créditos.';
  if (/ENOENT|not found|não encontrado/i.test(t)) return 'Faltou algum programa ou arquivo pra editar. O detalhe está no log.';
  return 'Deu um problema na edição. O detalhe completo ficou salvo no log.';
}

async function terminou(job, codigo, res, stderr) {
  const ed = path.join(job.projeto, 'editor');
  const ler = (a) => { try { return JSON.parse(fs.readFileSync(path.join(ed, a), 'utf8')); } catch { return null; } };
  const pergunta = ler('pergunta.json');
  const resultado = ler('resultado.json');
  if (pergunta && pergunta.pergunta) {
    job.status = 'aguardando_resposta'; job.pergunta = pergunta; return;
  }
  let arquivo = resultado && resultado.arquivo && fs.existsSync(resultado.arquivo) ? resultado.arquivo : null;
  if (!arquivo && codigo === 0 && !(res && res.is_error)) {
    // reserva: o mp4 mais novo da 02-finais com o nome do projeto
    const finais = path.join(APP_EDICAO, '02-finais');
    const cand = (fs.existsSync(finais) ? fs.readdirSync(finais) : [])
      .filter((n) => n.startsWith(job.slug) && n.endsWith('.mp4'))
      .map((n) => path.join(finais, n)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    arquivo = cand[0] || null;
  }
  if (arquivo) {
    job.versao = (job.versao || 0) + 1;
    const destino = path.join(DESKTOP, path.basename(arquivo));
    await fsp.copyFile(arquivo, destino);
    job.final = arquivo; job.finalDesktop = destino;
    job.resumo = (resultado && resultado.resumo) || (res && res.result) || null;
    job.status = 'pronto'; job.etapa = 'final'; job.erro = null;
    return;
  }
  const detalhe = `codigo=${codigo}\nresultado=${res ? JSON.stringify(res).slice(0, 4000) : '(sem)'}\nstderr=${stderr.slice(-4000)}`;
  logErro(`Edição sem vídeo final (${job.id}, ${job.projeto})`, detalhe);
  job.status = 'erro';
  job.erro = mensagemDeErro(`${res && res.result} ${stderr}`);
}

function proximo() {
  if (ATUAL || !FILA.length) return;
  const item = FILA.shift();
  const job = JOBS[item.jobId];
  if (!job) return proximo();
  try { rodar(item); } catch (e) {
    logErro(`Não deu pra começar a edição ${job.id}`, e);
    job.status = 'erro'; job.erro = 'Não deu pra começar a edição. O detalhe está no log.'; ATUAL = null; salvar(); proximo();
  }
}
function enfileirar(item) {
  FILA.push(item);
  const job = JOBS[item.jobId]; job.status = 'na_fila'; salvar();
  proximo();
}

// ---------- criar o projeto no kit ----------
function criarProjeto(job) {
  const r = spawnSync(process.execPath, [path.join(KIT, 'scripts', 'new-video.mjs'), job.slug], { cwd: KIT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`new-video falhou: ${r.stderr || r.stdout}`);
  const proj = path.join(KIT, 'video-projects', job.slug);
  fs.writeFileSync(path.join(proj, 'meta.json'), JSON.stringify({ id: 'main', name: job.slug, width: 1080, height: 1920, fps: 30 }, null, 2));
  fs.mkdirSync(path.join(proj, 'source'), { recursive: true });
  fs.mkdirSync(path.join(proj, 'editor'), { recursive: true });
  job.projeto = proj; job.videosProjeto = {};
  for (const [slot, partes] of Object.entries(job.uploads)) {
    job.videosProjeto[slot] = partes.map((p, i) => {
      const sufixo = partes.length > 1 ? `-parte${i + 1}` : '';
      const destino = path.join(proj, 'source', `${slot}${sufixo}${path.extname(p.arquivo).toLowerCase()}`);
      fs.renameSync(p.arquivo, destino);
      return destino;
    });
  }
  fs.writeFileSync(path.join(proj, 'editor', 'briefing.md'), `# Briefing (Editor Viral)\n\n${linhasBriefing(job)}\n`);
}

// ---------- HTTP ----------
const SESSOES = new Map(); // token -> criado
const TENTATIVAS = new Map(); // ip -> { n, ate }

function cookies(req) {
  const out = {};
  for (const p of (req.headers.cookie || '').split(';')) { const [k, ...v] = p.trim().split('='); if (k) out[k] = decodeURIComponent(v.join('=')); }
  return out;
}
function logado(req) { const t = cookies(req).ev_sessao; return !!(t && SESSOES.has(t)); }
function json(res, codigo, obj, extra = {}) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(obj));
}
async function corpoJson(req, limite = 1e6) {
  let tam = 0; const partes = [];
  for await (const c of req) { tam += c.length; if (tam > limite) throw new Error('corpo grande demais'); partes.push(c); }
  return partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {};
}
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function servirArquivo(req, res, arquivo, baixar) {
  const st = fs.statSync(arquivo);
  const nome = path.basename(arquivo);
  const cab = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (baixar) cab['Content-Disposition'] = `attachment; filename="${nome}"`;
  const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (r) {
    const ini = r[1] ? parseInt(r[1], 10) : st.size - parseInt(r[2], 10);
    const fim = r[1] && r[2] ? parseInt(r[2], 10) : st.size - 1;
    res.writeHead(206, { ...cab, 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Content-Length': fim - ini + 1 });
    fs.createReadStream(arquivo, { start: ini, end: fim }).pipe(res);
  } else {
    res.writeHead(200, { ...cab, 'Content-Length': st.size });
    fs.createReadStream(arquivo).pipe(res);
  }
}

async function api(req, res, url) {
  const ip = req.socket.remoteAddress;
  const p = url.pathname;

  if (p === '/api/login' && req.method === 'POST') {
    const t = TENTATIVAS.get(ip) || { n: 0, ate: 0 };
    if (t.ate > Date.now()) return json(res, 429, { erro: 'Muitas tentativas. Espera uns minutos e tenta de novo.' });
    const { senha } = await corpoJson(req);
    const ok = typeof senha === 'string' && senha.length === String(CONFIG.senha).length &&
      crypto.timingSafeEqual(Buffer.from(senha), Buffer.from(String(CONFIG.senha)));
    if (!ok) {
      t.n += 1; if (t.n >= 5) { t.ate = Date.now() + 10 * 60 * 1000; t.n = 0; }
      TENTATIVAS.set(ip, t);
      return json(res, 401, { erro: 'Senha errada.' });
    }
    TENTATIVAS.delete(ip);
    const token = crypto.randomBytes(24).toString('hex');
    SESSOES.set(token, Date.now());
    return json(res, 200, { ok: true }, { 'Set-Cookie': `ev_sessao=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000` });
  }
  if (p === '/api/sessao') return json(res, 200, { logado: logado(req) });
  if (!logado(req)) return json(res, 401, { erro: 'Entre com a senha.' });

  if (p === '/api/formatos') return json(res, 200, formatosPublicos());

  if (p === '/api/jobs' && req.method === 'POST') {
    const b = await corpoJson(req);
    const f = FORMATOS.find((x) => x.id === b.formato);
    if (!f) return json(res, 400, { erro: 'Formato desconhecido.' });
    for (const c of f.campos) if (c.obrigatorio && !(b.campos && String(b.campos[c.id] || '').trim())) return json(res, 400, { erro: `Preencha: ${c.rotulo}` });
    const id = crypto.randomBytes(8).toString('hex');
    JOBS[id] = {
      id, formato: f.id, slug: slugDe(f.id), criado: new Date().toISOString(), status: 'rascunho',
      briefing: { nicho: String(b.nicho || '').slice(0, 300), sobre: String(b.sobre || '').slice(0, 2000), sons: f.sons && !!b.sons, campos: b.campos || {} },
      uploads: {}, sessao: crypto.randomUUID(), sessaoIniciada: false, ajustesUsados: 0, etapa: 'recebido',
    };
    salvar();
    return json(res, 200, visaoPublica(JOBS[id]));
  }

  const m = /^\/api\/jobs\/([a-f0-9]{16})(?:\/(.+))?$/.exec(p);
  if (!m) return json(res, 404, { erro: 'Não achei.' });
  const job = JOBS[m[1]]; const acao = m[2] || '';
  if (!job) return json(res, 404, { erro: 'Esse vídeo não existe mais.' });
  const f = FORMATOS.find((x) => x.id === job.formato);

  if (!acao && req.method === 'GET') return json(res, 200, visaoPublica(job));

  if (!acao && req.method === 'DELETE') {
    if (job.status !== 'rascunho') return json(res, 400, { erro: 'Esse vídeo já está na edição.' });
    fs.rmSync(path.join(UPLOADS, job.id), { recursive: true, force: true });
    delete JOBS[job.id]; salvar();
    return json(res, 200, { ok: true });
  }

  const tira = /^videos\/([a-z]+)\/([a-f0-9]{8})$/.exec(acao);
  if (tira && req.method === 'DELETE') {
    if (job.status !== 'rascunho') return json(res, 400, { erro: 'Esse vídeo já foi enviado.' });
    const ps = job.uploads[tira[1]] || [];
    const i = ps.findIndex((p) => p.id === tira[2]);
    if (i >= 0) { try { fs.unlinkSync(ps[i].arquivo); } catch {} ps.splice(i, 1); salvar(); }
    return json(res, 200, visaoPublica(job));
  }

  const up = /^videos\/([a-z]+)$/.exec(acao);
  if (up && req.method === 'PUT') {
    const slot = up[1];
    const def = f.videos.find((v) => v.slot === slot);
    if (!def) return json(res, 400, { erro: 'Vídeo inesperado.' });
    if (job.status !== 'rascunho') return json(res, 400, { erro: 'Esse vídeo já foi enviado.' });
    const maxPartes = def.partes || 1;
    if ((job.uploads[slot] || []).length >= maxPartes) return json(res, 400, { erro: maxPartes > 1 ? `Dá pra mandar até ${maxPartes} partes.` : 'Esse vídeo já foi enviado.' });
    const nomeOrig = decodeURIComponent(req.headers['x-nome'] || 'video.mp4');
    const ext = path.extname(nomeOrig).toLowerCase();
    if (!['.mp4', '.mov'].includes(ext)) return json(res, 400, { erro: 'Manda um vídeo MP4 ou MOV.' });
    const tam = parseInt(req.headers['content-length'] || '0', 10);
    if (tam > MAX_UPLOAD) return json(res, 413, { erro: 'Vídeo grande demais (máximo 6 GB).' });
    const pasta = path.join(UPLOADS, job.id); fs.mkdirSync(pasta, { recursive: true });
    const idParte = crypto.randomBytes(4).toString('hex');
    const destino = path.join(pasta, `${slot}-${idParte}${ext}`);
    await new Promise((ok, falha) => {
      const w = fs.createWriteStream(destino);
      let n = 0;
      req.on('data', (c) => { n += c.length; if (n > MAX_UPLOAD) { req.destroy(); falha(new Error('grande demais')); } });
      req.pipe(w); w.on('finish', ok); w.on('error', falha); req.on('error', falha);
    });
    const duracao = duracaoDe(destino);
    if (duracao == null) {
      try { fs.unlinkSync(destino); } catch {}
      return json(res, 400, { erro: `Não consegui ler o vídeo "${nomeOrig}". Confere se ele abre no celular e manda de novo.` });
    }
    const total = duracaoTotal(job) + duracao;
    if (total > LIMITE_SEG + 0.5) {
      try { fs.unlinkSync(destino); } catch {}
      return json(res, 400, { erro: AVISO_LIMITE(total), limite: true });
    }
    (job.uploads[slot] = job.uploads[slot] || []).push({ id: idParte, arquivo: destino, nome: nomeOrig, tamanho: fs.statSync(destino).size, duracao });
    salvar();
    return json(res, 200, visaoPublica(job));
  }

  if (acao === 'iniciar' && req.method === 'POST') {
    if (job.status !== 'rascunho') return json(res, 400, { erro: 'Esse vídeo já está na edição.' });
    const faltando = f.videos.filter((v) => !(job.uploads[v.slot] || []).length);
    if (faltando.length) return json(res, 400, { erro: `Falta mandar: ${faltando.map((v) => v.rotulo).join(', ')}` });
    if (duracaoTotal(job) > LIMITE_SEG + 0.5) return json(res, 400, { erro: AVISO_LIMITE(duracaoTotal(job)), limite: true });
    try { criarProjeto(job); } catch (e) { logErro(`criarProjeto ${job.id}`, e); return json(res, 500, { erro: 'Não deu pra criar a pasta do projeto. O detalhe está no log.' }); }
    enfileirar({ jobId: job.id, tipo: 'editar' });
    return json(res, 200, visaoPublica(job));
  }

  if (acao === 'responder' && req.method === 'POST') {
    if (job.status !== 'aguardando_resposta') return json(res, 400, { erro: 'Não tem pergunta esperando resposta.' });
    const { texto } = await corpoJson(req);
    if (!texto || !String(texto).trim()) return json(res, 400, { erro: 'Escreve a sua resposta.' });
    enfileirar({ jobId: job.id, tipo: 'responder', texto: String(texto).slice(0, 3000) });
    return json(res, 200, visaoPublica(job));
  }

  if (acao === 'ajustar' && req.method === 'POST') {
    if (job.status !== 'pronto') return json(res, 400, { erro: 'O vídeo ainda não está pronto.' });
    if ((job.ajustesUsados || 0) >= MAX_AJUSTES) return json(res, 400, { erro: 'Esse vídeo já usou os 2 ajustes.' });
    const { texto } = await corpoJson(req);
    if (!texto || !String(texto).trim()) return json(res, 400, { erro: 'Conta o que você quer mudar.' });
    job.ajustesUsados = (job.ajustesUsados || 0) + 1;
    enfileirar({ jobId: job.id, tipo: 'ajustar', texto: String(texto).slice(0, 3000) });
    return json(res, 200, visaoPublica(job));
  }

  if (acao === 'tentar' && req.method === 'POST') {
    if (job.status !== 'erro' || !job.projeto) return json(res, 400, { erro: 'Nada pra tentar de novo.' });
    enfileirar({ jobId: job.id, tipo: job.sessaoIniciada ? 'continuar' : 'editar' });
    return json(res, 200, visaoPublica(job));
  }

  if (acao === 'final' && req.method === 'GET') {
    if (!job.final || !fs.existsSync(job.final)) return json(res, 404, { erro: 'O vídeo final ainda não existe.' });
    return servirArquivo(req, res, job.final, url.searchParams.has('baixar'));
  }

  return json(res, 404, { erro: 'Não achei.' });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    let arq = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!arq.startsWith(PUBLIC) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) arq = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(arq).pipe(res);
  } catch (e) {
    logErro(`HTTP ${req.method} ${url.pathname}`, e);
    if (!res.headersSent) json(res, 500, { erro: 'Deu um erro aqui no servidor. O detalhe está no log.' });
    else res.end();
  }
});
servidor.requestTimeout = 0; // uploads grandes pelo Wi-Fi demoram

function ipDaRede() {
  const lista = [];
  for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) lista.push(i.address);
  return lista.find((a) => a.startsWith('192.168.')) || lista.find((a) => a.startsWith('10.')) || lista[0];
}

module.exports = { permissoes, ambienteFilho, promptInicial, CLAUDE, KIT, APP_EDICAO };
const NA_REDE = CONFIG.rede && !process.env.EV_SO_PC;
if (require.main === module) servidor.listen(CONFIG.porta, NA_REDE ? '0.0.0.0' : '127.0.0.1', () => {
  const ip = NA_REDE && ipDaRede();
  console.log('');
  console.log('  Editor Viral ligado!');
  console.log(`  No PC:      http://localhost:${CONFIG.porta}`);
  if (ip) console.log(`  No celular: http://${ip}:${CONFIG.porta}  (mesmo Wi-Fi)`);
  console.log(`  Senha:      ${CONFIG.senha}`);
  console.log('');
  console.log('  Deixe esta janela aberta enquanto usa. Pra desligar, feche ela.');
  console.log('');
});
