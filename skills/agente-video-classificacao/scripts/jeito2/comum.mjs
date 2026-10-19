// Jeito 2: funções comuns a todos os formatos (preparar, cortar, mixar, renderizar, entregar).
// O Claude só escreve o plano.json; o resto é código e sai sempre igual.
// Este arquivo é o mesmo em todas as skills agente-video-* (copie pra todas se mudar).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const HOME = os.homedir();
export const KIT = path.join(HOME, 'hyperframes-student-kit');
export const APP = path.join(HOME, 'Documents', 'projetos', 'app-edicao');
export const SKILLS = path.join(HOME, '.claude', 'skills');
export const proj = (slug) => path.join(KIT, 'video-projects', slug);

export function rodar(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 6).join(' ')} falhou:\n${(r.stderr || r.stdout || '').slice(-2000)}`);
  return r.stdout;
}
export const ffmpeg = (args, opts) => rodar('ffmpeg', ['-v', 'error', '-y', ...args], opts);
export function duracao(arq) {
  return parseFloat(rodar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).trim());
}
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Volume em pedaços de 0,05 s e pausas (trechos 30 dB abaixo do pico)
export function silencios(video, minimo = 0.25) {
  const pcm = Buffer.from(spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 30 }).stdout);
  const passo = 800, n = Math.floor(pcm.length / 2 / passo), db = [];
  for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < passo; i++) { const v = pcm.readInt16LE((k * passo + i) * 2) / 32768; s += v * v; } db.push(20 * Math.log10(Math.sqrt(s / passo) + 1e-9)); }
  const pico = Math.max(...db), out = []; let ini = null;
  db.forEach((d, k) => { const q = d < pico - 30; if (q && ini === null) ini = k; if (!q && ini !== null) { if ((k - ini) * 0.05 >= minimo) out.push([+(ini * 0.05).toFixed(2), +(k * 0.05).toFixed(2)]); ini = null; } });
  return out;
}

// Trechos do plano (tempo do bruto) -> segmentos sem pausas acima de 0,2 s, colados pelas palavras.
// Cada trecho pode ser [de, até] ou {de, ate, ...extras}; os extras vão junto em cada segmento.
export function segmentos(manter, palavras, { pre = 0.06, pos = 0.09, gap = 0.2, folgaFim = 0.35 } = {}) {
  const segs = [];
  manter.forEach((tr, idx) => {
    const [a, b] = Array.isArray(tr) ? tr : [tr.de, tr.ate];
    const extra = Array.isArray(tr) ? {} : tr;
    const ws = (extra.palavras || palavras).filter((w) => w.s >= a - 0.01 && w.e <= b + 0.01);
    let cur = null;
    ws.forEach((w, i) => {
      const ultimo = idx === manter.length - 1 && i === ws.length - 1;
      const s = Math.max(a, w.s - pre), e = Math.min(b + folgaFim, w.e + (ultimo ? folgaFim : pos));
      if (cur && s - cur.e <= gap) { cur.e = Math.max(cur.e, e); cur.ws.push(w); } else { if (cur) segs.push(cur); cur = { ...extra, palavras: undefined, s, e, ws: [w], trecho: idx }; }
    });
    if (cur) segs.push(cur);
  });
  for (let i = 1; i < segs.length; i++) if (segs[i].trecho === segs[i - 1].trecho && segs[i].s < segs[i - 1].e) { const m = (segs[i - 1].ws.at(-1).e + segs[i].ws[0].s) / 2; segs[i - 1].e = m; segs[i].s = m; }
  let t = 0; for (const g of segs) { g.out = +t.toFixed(3); g.dur = +(g.e - g.s).toFixed(3); t += g.dur; }
  return { segs, total: +t.toFixed(3) };
}
// Tempo do bruto -> tempo do vídeo cortado (com 2 gravações, passe a fonte)
export function mapear(segs, t, fonte) {
  const lista = fonte ? segs.filter((g) => (g.fonte || 'A') === fonte) : segs;
  for (const g of lista) { if (t < g.s) return g.out; if (t <= g.e) return +(g.out + t - g.s).toFixed(3); }
  return lista.at(-1).out + lista.at(-1).dur;
}

// Enquadramento: zoom (1 = vídeo inteiro) e o canto de cima/esquerdo do recorte em px do quadro 1080x1920.
// Sem x, fica centralizado; sem y, ancorado no topo. Escala antes de recortar (vídeo 4K não perde qualidade).
export function filtroEnquadramento(enq) {
  const e = typeof enq === 'number' ? { zoom: enq } : (enq || {});
  const z = e.zoom || 1, W = Math.round(1080 * z / 2) * 2, H = Math.round(1920 * z / 2) * 2;
  const x = e.x != null ? e.x : (1080 - 1080 / z) / 2, y = e.y || 0;
  const cx = Math.max(0, Math.min(W - 1080, Math.round(x * z))), cy = Math.max(0, Math.min(H - 1920, Math.round(y * z)));
  return `scale=${W}:${H}:flags=lanczos,crop=1080:1920:${cx}:${cy}`;
}

// Corta e emenda, com o enquadramento, highpass e -15 LUFS
export function cortar(video, segs, saidaVideo, saidaVoz, enq = 1) {
  const fe = filtroEnquadramento(enq);
  let fc = '';
  segs.forEach((g, i) => {
    fc += `[0:v]trim=${g.s.toFixed(3)}:${g.e.toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=1080:1920,${fe},setsar=1[v${i}];\n`;
    fc += `[0:a]atrim=${g.s.toFixed(3)}:${g.e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${(g.dur - 0.01).toFixed(3)}:d=0.01[a${i}];\n`;
  });
  fc += segs.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${segs.length}:v=1:a=1[vc][ac];\n[ac]highpass=f=80,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[aout]`;
  gravarVideo(video ? [video] : [], fc, saidaVideo, saidaVoz);
}
export function gravarVideo(entradas, fc, saidaVideo, saidaVoz) {
  const arq = path.join(path.dirname(saidaVideo), 'cortes-filter.txt');
  fs.writeFileSync(arq, fc);
  ffmpeg([...entradas.flatMap((e) => (Array.isArray(e) ? e : ['-i', e])), '-/filter_complex', arq,
    '-map', '[vc]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-g', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', saidaVideo,
    '-map', '[aout]', '-c:a', 'pcm_s16le', saidaVoz]);
}

// Mixa a voz com os efeitos. eventos: [{som, t, ganho (dB), dur}]. Sons em assets/sfx/<som>.raw.mp3
export function mixar(dirSfx, voz, eventos, saida) {
  const ins = ['-i', voz]; let fc = '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v0];\n'; const labs = [];
  eventos.forEach((ev, i) => {
    ins.push('-i', path.join(dirSfx, `${ev.som}.raw.mp3`));
    const ms = Math.max(0, Math.round(ev.t * 1000));
    fc += `[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${ev.dur},asetpts=PTS-STARTPTS,volume=${ev.ganho}dB,afade=t=out:st=${(ev.dur - 0.08).toFixed(2)}:d=0.08,adelay=${ms}|${ms}[s${i}];\n`;
    labs.push(`[s${i}]`);
  });
  fc += `[v0]${labs.join('')}amix=inputs=${labs.length + 1}:normalize=0:duration=first,alimiter=limit=0.84:level=false[out]`;
  const arq = path.join(dirSfx, 'mix-filter.txt'); fs.writeFileSync(arq, fc);
  ffmpeg([...ins, '-/filter_complex', arq, '-map', '[out]', '-c:a', 'pcm_s16le', saida]);
}
// Biblioteca de sons do formato: { nome: {ganho, dur} } -> função que cria eventos
export const som = (lib) => (nome, t) => ({ som: nome, t, ...lib[nome] });

// Fotos do plano: {arquivo: caminho local já tratado} ou {url, modo: 'solto'|'quadrado'} (baixa e trata)
export function prepararFotos(P, fotos) {
  const dir = path.join(P, 'assets', 'produtos'); fs.mkdirSync(path.join(dir, 'originais'), { recursive: true });
  // o script de tratar foto fica na skill mão de vaca, ao lado desta (funciona em .claude/skills e no app)
  const tratar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'agente-video-mao-de-vaca', 'scripts', 'tratar-produto.mjs');
  for (const f of fotos) {
    if (!f || f.texto) continue;
    const destino = path.join(dir, `${f.nome}.png`);
    if (f.arquivo) { fs.copyFileSync(f.arquivo, destino); continue; }
    if (!f.url) throw new Error(`Foto sem arquivo nem url: ${f.nome}`);
    const orig = path.join(dir, 'originais', `${f.nome}${path.extname(new URL(f.url).pathname) || '.jpg'}`);
    if (!fs.existsSync(orig)) rodar('curl', ['-sL', '-A', 'Mozilla/5.0', '-o', orig, f.url]);
    rodar(process.execPath, [tratar, orig, destino, '--modo', f.modo || 'solto']);
  }
}

// Cópia das fontes e do GSAP do kit pro projeto (formatos que não passaram pelo preparar)
export function copiarBase(P, recursos) {
  for (const d of ['assets/fonts', 'assets/sfx']) fs.mkdirSync(path.join(P, d), { recursive: true });
  for (const f of ['poppins-700.woff2', 'poppins-800.woff2', 'poppins-900.woff2']) fs.copyFileSync(path.join(KIT, 'assets', 'fonts', f), path.join(P, 'assets', 'fonts', f));
  for (const f of fs.readdirSync(recursos)) {
    const dest = f.endsWith('.raw.mp3') ? path.join(P, 'assets', 'sfx', f) : path.join(P, 'assets', f);
    fs.copyFileSync(path.join(recursos, f), dest);
  }
}

export function render(dir, qualidade, saida) {
  rodar(`npx hyperframes render -q ${qualidade} -w 1 -o ${saida}`, [], { cwd: dir, shell: true, stdio: 'inherit' });
}
export function lint(dir) { rodar('npx hyperframes lint', [], { cwd: dir, shell: true }); }

// Quadros escolhidos lado a lado, pra revisão do Claude
export function folhaDeQuadros(video, tempos, saida, colunas = 6) {
  const sel = tempos.map((t) => `between(t,${Math.max(0, t).toFixed(3)},${(Math.max(0, t) + 0.03).toFixed(3)})`).join('+');
  const linhas = Math.ceil(tempos.length / colunas);
  ffmpeg(['-i', video, '-vf', `select='${sel}',scale=270:-1,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{pts\\:flt}':x=4:y=4:fontsize=20:fontcolor=yellow:box=1:boxcolor=black,tile=${colunas}x${linhas}`, '-fps_mode', 'vfr', '-frames:v', '1', saida]);
}

// Entrega: tira os metadados (sem recodificar) e salva a próxima versão em 02-finais
export function entregar(final, slug) {
  const pasta = path.join(APP, '02-finais'); let v = 1;
  while (fs.existsSync(path.join(pasta, `${slug}-v${v}.mp4`))) v++;
  const destino = path.join(pasta, `${slug}-v${v}.mp4`);
  ffmpeg(['-i', final, '-map', '0', '-c', 'copy', '-map_metadata', '-1', '-map_chapters', '-1', '-bsf:v', 'filter_units=remove_types=6',
    '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact', '-metadata:s:v', 'handler_name=', '-metadata:s:a', 'handler_name=', '-movflags', '+faststart', destino]);
  const txt = fs.readFileSync(destino).toString('latin1');
  const marcas = ['hyperframes', 'x264 - core', 'Lavf'].filter((m) => txt.includes(m));
  if (marcas.length) throw new Error(`Sobrou metadado: ${marcas.join(', ')}`);
  return destino;
}

// Fluxo padrão de um formato: node <formato>.mjs <nome-curto> [--final]
// montar({P, J, plano, ctx}) -> { html, eventos, voz, revisao: [tempos], resumo, dur }
// roteiro({plano}) -> texto do 03-roteiros
export function rodarFormato({ montar, roteiro }) {
  const [slug, flag] = process.argv.slice(2);
  const P = proj(slug), J = path.join(P, 'jeito2');
  const plano = JSON.parse(fs.readFileSync(path.join(J, 'plano.json'), 'utf8'));
  const ctx = JSON.parse(fs.readFileSync(path.join(J, 'contexto.json'), 'utf8'));
  if (flag === '--final') {
    render(P, 'high', 'renders/final.mp4');
    const destino = entregar(path.join(P, 'renders', 'final.mp4'), slug);
    const calc = fs.existsSync(path.join(J, 'calculado.json')) ? JSON.parse(fs.readFileSync(path.join(J, 'calculado.json'), 'utf8')) : {};
    fs.writeFileSync(path.join(APP, '03-roteiros', `${slug}.md`), roteiro({ plano, calc, arquivo: path.basename(destino) }));
    console.log(`ENTREGUE: ${destino}`);
    return;
  }
  const r = montar({ P, J, plano, ctx });
  fs.writeFileSync(path.join(P, 'index.html'), r.html);
  fs.writeFileSync(path.join(J, 'calculado.json'), JSON.stringify(r.resumo, null, 1));
  mixar(path.join(P, 'assets', 'sfx'), path.join(P, 'assets', 'voz.wav'), r.eventos, path.join(P, 'assets', 'mix.wav'));
  lint(P);
  render(P, 'draft', 'renders/draft1.mp4');
  folhaDeQuadros(path.join(P, 'renders', 'draft1.mp4'), r.revisao, path.join(J, 'revisao.png'));
  console.log(JSON.stringify(r.resumo));
  console.log(`Revisão: ${path.join(J, 'revisao.png')}`);
}

// Pedaço de HTML comum a todos os formatos (cabeçalho com Poppins e GSAP)
export function cabecalho(titulo, css) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<script src="assets/gsap.min.js"></script>
<style>
@font-face{font-family:"Poppins";src:url("assets/fonts/poppins-700.woff2") format("woff2");font-weight:700;font-style:normal}
@font-face{font-family:"Poppins";src:url("assets/fonts/poppins-800.woff2") format("woff2");font-weight:800;font-style:normal}
@font-face{font-family:"Poppins";src:url("assets/fonts/poppins-900.woff2") format("woff2");font-weight:900;font-style:normal}
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000;color:#fff;-webkit-font-smoothing:antialiased}
#main{position:relative;width:1080px;height:1920px;overflow:hidden;background:#000;font-family:"Poppins",Arial,sans-serif}
#vwrap{position:absolute;inset:0;transform-origin:50% 40%;will-change:transform}
#clip{position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover}
#ui{position:absolute;inset:0}
${css}
</style></head><body>`;
}
export function corpo(dur, ui, script, { semZoom = false } = {}) {
  const video = `<video id="clip" data-start="0" data-duration="${dur}" data-track-index="0" src="assets/cut.mp4" muted playsinline></video>`;
  return `
<div id="main" data-composition-id="main" data-start="0" data-duration="${dur}" data-width="1080" data-height="1920">
  ${semZoom ? video : `<div id="vwrap">${video}</div>`}
  <audio id="mix" data-start="0" data-duration="${dur}" data-track-index="1" src="assets/mix.wav" data-volume="1"></audio>
  <div id="ui" class="clip" data-start="0" data-duration="${dur}" data-track-index="2">
${ui}
  </div>
</div>
<script>
const DUR=${dur};
const tl=gsap.timeline({paused:true});
${script}
tl.set({},{},DUR);
window.__timelines=window.__timelines||{};window.__timelines['main']=tl;
</script></body></html>
`;
}
// Zoom leve alternado em cada corte, pra disfarçar o pulo
export function zoomNosCortes(cortes, dur, origem = '50% 40%') {
  return `document.getElementById('vwrap').style.transformOrigin='${origem}';
const CUTS=${JSON.stringify([0, ...cortes, dur])};
for(let i=0;i<CUTS.length-1;i++){const s=i%2===0?1.0:1.05;tl.set('#vwrap',{scale:s},CUTS[i]);tl.to('#vwrap',{scale:s+0.02,duration:CUTS[i+1]-CUTS[i],ease:'none'},CUTS[i]);}`;
}
// CTA padrão (cartão com frase e "+ Seguir")
export const CSS_CTA = `#cta{position:absolute;left:100px;width:880px;height:124px;border-radius:30px;padding:0 20px 0 34px;display:flex;align-items:center;justify-content:space-between;opacity:0;
  background:rgba(10,10,14,.55);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:2px solid rgba(255,255,255,.25);box-shadow:0 14px 34px rgba(0,0,0,.35)}
#cta p{margin:0;font-weight:800;font-size:41px;line-height:1.1;-webkit-text-stroke:2px #000;paint-order:stroke fill}
#cta .btn{height:84px;padding:0 34px;border-radius:42px;background:#0095f6;display:flex;align-items:center;font-weight:800;font-size:42px;white-space:nowrap;-webkit-text-stroke:2px #000;paint-order:stroke fill}`;
export const htmlCta = (frase, top) => `<div id="cta" style="top:${top}px"><p>${esc(frase).replace(/\\n|\n/g, '<br>')}</p><div class="btn">+ Seguir</div></div>`;
export const animCta = (t) => `tl.fromTo('#cta',{opacity:0,y:24,scale:.92},{opacity:1,y:0,scale:1,duration:.35,ease:'back.out(1.8)'},${t.toFixed(2)});
tl.fromTo('#cta .btn',{scale:1},{scale:1.08,duration:.16,ease:'power2.out'},${(t + 1).toFixed(2)});
tl.to('#cta .btn',{scale:1,duration:.4,ease:'elastic.out(1,.5)'},${(t + 1.16).toFixed(2)});`;
