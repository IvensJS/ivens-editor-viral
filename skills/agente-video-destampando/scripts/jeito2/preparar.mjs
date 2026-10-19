// Jeito 2, passo 1 (código): prepara o projeto e gera o que o Claude precisa pra escrever o plano.
// Uso: node preparar.mjs <video> <nome-curto> <formato>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIT, APP, proj, rodar, ffmpeg, duracao, silencios } from './comum.mjs';

const [video, slug, formato = 'destampando'] = process.argv.slice(2);
if (!video || !slug) { console.error('Uso: node preparar.mjs <video> <nome-curto> <formato>'); process.exit(1); }
const P = proj(slug);
const ext = path.extname(video).toLowerCase();

// 1. bruto em 01-brutos (sem mexer no original) e projeto novo no kit
const bruto = path.join(APP, '01-brutos', `${slug}${ext}`);
if (!fs.existsSync(bruto)) fs.copyFileSync(video, bruto);
if (!fs.existsSync(P)) rodar(process.execPath, [path.join(KIT, 'scripts', 'new-video.mjs'), slug], { cwd: KIT });
fs.writeFileSync(path.join(P, 'meta.json'), JSON.stringify({ id: 'main', name: slug, width: 1080, height: 1920, fps: 30 }, null, 2));
for (const d of ['source', 'assets/fonts', 'assets/sfx', 'jeito2']) fs.mkdirSync(path.join(P, d), { recursive: true });
const fonte = path.join(P, 'source', `bruto${ext}`);
if (!fs.existsSync(fonte)) fs.copyFileSync(bruto, fonte);
for (const f of ['poppins-700.woff2', 'poppins-800.woff2', 'poppins-900.woff2']) fs.copyFileSync(path.join(KIT, 'assets', 'fonts', f), path.join(P, 'assets', 'fonts', f));
// GSAP e a biblioteca fixa de sons (volumes já medidos uma vez) vêm da pasta recursos, junto deste script
const rec = path.join(path.dirname(fileURLToPath(import.meta.url)), 'recursos');
fs.copyFileSync(path.join(rec, 'gsap.min.js'), path.join(P, 'assets', 'gsap.min.js'));
for (const s of ['pa', 'whoosh', 'blim', 'tap']) fs.copyFileSync(path.join(rec, `${s}.raw.mp3`), path.join(P, 'assets', 'sfx', `${s}.raw.mp3`));

// 2. transcrição
const tr = path.join(P, 'assets', 'transcript.source.json');
if (!fs.existsSync(tr)) rodar(process.execPath, [path.join(KIT, 'scripts', 'transcribe-elevenlabs.mjs'), fonte, '--output', tr, '--language', 'pt', '--no-diarize'], { cwd: KIT });
const palavras = JSON.parse(fs.readFileSync(tr, 'utf8')).words.filter((w) => w.type === 'word').map((w) => ({ t: w.text, s: +w.start.toFixed(2), e: +w.end.toFixed(2) }));

// 3. pausas e folha de quadros (1 por segundo, grade de 100 px)
const dur = duracao(fonte);
const pausas = silencios(fonte);
const folha = path.join(P, 'jeito2', 'folha.png');
const cols = 10, linhas = Math.ceil(dur / cols);
ffmpeg(['-i', fonte, '-vf', `fps=1,drawgrid=w=100:h=100:t=3:c=red@0.5,drawgrid=w=500:h=500:t=6:c=cyan@0.7,scale=216:-1,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{pts\\:hms}':x=3:y=3:fontsize=18:fontcolor=yellow:box=1:boxcolor=black,tile=${cols}x${linhas}`, '-frames:v', '1', folha]);

// 4. contexto pro Claude: frases (quebra em pausa > 0,4 s) com o tempo de cada palavra
const frases = []; let atual = [];
palavras.forEach((w, i) => { if (atual.length && w.s - palavras[i - 1].e > 0.4) { frases.push(atual); atual = []; } atual.push(w); });
if (atual.length) frases.push(atual);
const txt = [`Formato: ${formato}`, `Duração do bruto: ${dur.toFixed(2)} s`, `Pausas (s): ${pausas.map((p) => p.join('-')).join('  ')}`, '', 'Frases (tempo do bruto):',
  ...frases.map((f) => `[${f[0].s.toFixed(2)}-${f.at(-1).e.toFixed(2)}] ` + f.map((w) => `${w.t}@${w.s.toFixed(2)}`).join(' '))].join('\n');
fs.writeFileSync(path.join(P, 'jeito2', 'contexto.txt'), txt);
fs.writeFileSync(path.join(P, 'jeito2', 'contexto.json'), JSON.stringify({ slug, formato, duracao: dur, fonte, palavras, pausas }, null, 1));
console.log(txt);
console.log(`\nFolha de quadros: ${folha}\nAgora o Claude escreve ${path.join(P, 'jeito2', 'plano.json')}`);
