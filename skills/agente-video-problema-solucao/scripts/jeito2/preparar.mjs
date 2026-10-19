// Jeito 2, passo 1 (código): prepara o projeto e gera o que o Claude precisa pra escrever o plano.
// Uso: node preparar.mjs <vídeo> <nome-curto> <formato> [--mais <parte2> --mais <parte3> ...] [--video2 <vídeo>] [--transcricao <json>]
//   --mais: outras partes da mesma gravação, NA ORDEM em que foram gravadas (junta tudo num vídeo só antes de editar).
//   --video2: segunda gravação (problema e solução: lado B). --transcricao: reaproveita uma transcrição pronta (não gasta ElevenLabs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIT, APP, proj, rodar, ffmpeg, duracao, silencios, copiarBase } from './comum.mjs';

const args = process.argv.slice(2);
const opc = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
const video2 = opc('--video2'), trPronta = opc('--transcricao'), trPronta2 = opc('--transcricao2');
// --mais <arquivo> (pode repetir): outras partes da MESMA gravação, na ordem em que foram gravadas
const mais = []; for (let m; (m = opc('--mais'));) mais.push(m);
const [video, slug, formato = 'destampando'] = args;
if (!video || !slug) { console.error('Uso: node preparar.mjs <video> <nome-curto> <formato> [--video2 <video>]'); process.exit(1); }
const P = proj(slug);
const RECURSOS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'recursos');

// 1. bruto em 01-brutos (sem mexer no original) e projeto novo no kit
if (!fs.existsSync(P)) rodar(process.execPath, [path.join(KIT, 'scripts', 'new-video.mjs'), slug], { cwd: KIT });
fs.writeFileSync(path.join(P, 'meta.json'), JSON.stringify({ id: 'main', name: slug, width: 1080, height: 1920, fps: 30 }, null, 2));
for (const d of ['source', 'jeito2']) fs.mkdirSync(path.join(P, d), { recursive: true });
copiarBase(P, RECURSOS);

// Junta as partes num arquivo só: cada uma vira 1080x1920 em pé, 30 fps, áudio 48 kHz estéreo, e emenda na ordem
function juntarPartes(partes, destino) {
  let fc = '';
  partes.forEach((_, i) => {
    fc += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1,format=yuv420p[v${i}];`;
    fc += `[${i}:a]aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.01[a${i}];`;
  });
  fc += partes.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${partes.length}:v=1:a=1[v][a]`;
  ffmpeg([...partes.flatMap((p) => ['-i', p]), '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-c:a', 'pcm_s16le', destino]);
}

function preparaVideo(arqs, sufixo, trPr) {
  const lista = Array.isArray(arqs) ? arqs : [arqs];
  // cada parte vai pra 01-brutos sem mexer no original
  lista.forEach((arq, i) => {
    const nome = `${slug}${sufixo}${lista.length > 1 ? `-parte${i + 1}` : ''}${path.extname(arq).toLowerCase()}`;
    if (!fs.existsSync(path.join(APP, '01-brutos', nome)) && !fs.existsSync(path.join(APP, '01-brutos', path.basename(arq)))) fs.copyFileSync(arq, path.join(APP, '01-brutos', nome));
  });
  const ext = lista.length > 1 ? '.mov' : path.extname(lista[0]).toLowerCase();
  const fonte = path.join(P, 'source', `bruto${sufixo}${ext}`);
  if (!fs.existsSync(fonte)) { if (lista.length > 1) juntarPartes(lista, fonte); else fs.copyFileSync(lista[0], fonte); }
  // transcrição (reaproveita se já tiver)
  const tr = path.join(P, 'assets', `transcript${sufixo || '.source'}.json`);
  if (trPr && !fs.existsSync(tr)) fs.copyFileSync(trPr, tr);
  if (!fs.existsSync(tr)) rodar(process.execPath, [path.join(KIT, 'scripts', 'transcribe-elevenlabs.mjs'), fonte, '--output', tr, '--language', 'pt', '--no-diarize'], { cwd: KIT });
  const palavras = JSON.parse(fs.readFileSync(tr, 'utf8')).words.filter((w) => w.type === 'word').map((w) => ({ t: w.text, s: +w.start.toFixed(2), e: +w.end.toFixed(2) }));
  // pausas e folha de quadros (1 por segundo, grade de 100 px), já em pé
  const dur = duracao(fonte), pausas = silencios(fonte);
  const folha = path.join(P, 'jeito2', `folha${sufixo}.png`);
  const linhas = Math.ceil(dur / 10);
  ffmpeg(['-i', fonte, '-vf', `fps=1,scale=1080:1920,drawgrid=w=100:h=100:t=3:c=red@0.5,drawgrid=w=500:h=500:t=6:c=cyan@0.7,scale=216:-1,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{pts\\:hms}':x=3:y=3:fontsize=18:fontcolor=yellow:box=1:boxcolor=black,tile=10x${linhas}`, '-frames:v', '1', folha]);
  return { fonte, palavras, pausas, dur, folha };
}
const A = preparaVideo([video, ...mais], '', trPronta);
const B = video2 ? preparaVideo(video2, '-b', trPronta2) : null;

// 4. contexto pro Claude: frases (quebra em pausa > 0,4 s) com o tempo de cada palavra
function frases(palavras) {
  const out = []; let atual = [];
  palavras.forEach((w, i) => { if (atual.length && w.s - palavras[i - 1].e > 0.4) { out.push(atual); atual = []; } atual.push(w); });
  if (atual.length) out.push(atual);
  return out.map((f) => `[${f[0].s.toFixed(2)}-${f.at(-1).e.toFixed(2)}] ` + f.map((w) => `${w.t}@${w.s.toFixed(2)}`).join(' '));
}
const bloco = (nome, v) => [`${nome}: ${v.dur.toFixed(2)} s`, `Pausas (s): ${v.pausas.map((p) => p.join('-')).join('  ')}`, 'Frases (tempo do bruto):', ...frases(v.palavras), `Folha: ${v.folha}`];
const txt = [`Formato: ${formato}`, '', ...bloco(B ? 'Vídeo A' : 'Vídeo', A), ...(B ? ['', ...bloco('Vídeo B', B)] : [])].join('\n');
fs.writeFileSync(path.join(P, 'jeito2', 'contexto.txt'), txt);
fs.writeFileSync(path.join(P, 'jeito2', 'contexto.json'), JSON.stringify({ slug, formato, duracao: A.dur, fonte: A.fonte, palavras: A.palavras, pausas: A.pausas,
  ...(B ? { fonte2: B.fonte, palavras2: B.palavras, duracao2: B.dur } : {}) }, null, 1));
console.log(txt);
console.log(`\nAgora o Claude escreve ${path.join(P, 'jeito2', 'plano.json')}`);
