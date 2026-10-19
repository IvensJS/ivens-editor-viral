// Jeito 2: funções comuns a todos os formatos (preparar, cortar, mixar, renderizar, entregar).
// O Claude só escreve o plano.json; o resto é código e sai sempre igual.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const HOME = os.homedir();
export const KIT = path.join(HOME, 'hyperframes-student-kit');
export const APP = path.join(HOME, 'Documents', 'projetos', 'app-edicao');
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

// Volume em pedaços de 0,05 s e pausas (trechos 30 dB abaixo do pico)
export function silencios(video, minimo = 0.25) {
  const pcm = Buffer.from(spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 30 }).stdout);
  const passo = 800, n = Math.floor(pcm.length / 2 / passo), db = [];
  for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < passo; i++) { const v = pcm.readInt16LE((k * passo + i) * 2) / 32768; s += v * v; } db.push(20 * Math.log10(Math.sqrt(s / passo) + 1e-9)); }
  const pico = Math.max(...db), out = []; let ini = null;
  db.forEach((d, k) => { const q = d < pico - 30; if (q && ini === null) ini = k; if (!q && ini !== null) { if ((k - ini) * 0.05 >= minimo) out.push([+(ini * 0.05).toFixed(2), +(k * 0.05).toFixed(2)]); ini = null; } });
  return out;
}

// Trechos do plano (tempo do bruto) -> segmentos sem pausas acima de 0,2 s, colados pelas palavras
export function segmentos(manter, palavras, { pre = 0.06, pos = 0.09, gap = 0.2, folgaFim = 0.35 } = {}) {
  const segs = [];
  manter.forEach(([a, b], idx) => {
    const ws = palavras.filter((w) => w.s >= a - 0.01 && w.e <= b + 0.01);
    let cur = null;
    ws.forEach((w, i) => {
      const ultimo = idx === manter.length - 1 && i === ws.length - 1;
      const s = Math.max(a, w.s - pre), e = Math.min(b + folgaFim, w.e + (ultimo ? folgaFim : pos));
      if (cur && s - cur.e <= gap) { cur.e = Math.max(cur.e, e); cur.ws.push(w); } else { if (cur) segs.push(cur); cur = { s, e, ws: [w] }; }
    });
    if (cur) segs.push(cur);
  });
  for (let i = 1; i < segs.length; i++) if (segs[i].s < segs[i - 1].e) { const m = (segs[i - 1].ws.at(-1).e + segs[i].ws[0].s) / 2; segs[i - 1].e = m; segs[i].s = m; }
  let t = 0; for (const g of segs) { g.out = +t.toFixed(3); g.dur = +(g.e - g.s).toFixed(3); t += g.dur; }
  return { segs, total: +t.toFixed(3) };
}
// Tempo do bruto -> tempo do vídeo cortado
export function mapear(segs, t) {
  for (const g of segs) { if (t < g.s) return g.out; if (t <= g.e) return +(g.out + t - g.s).toFixed(3); }
  return segs.at(-1).out + segs.at(-1).dur;
}

// Corta e emenda, com o enquadramento (zoom ancorado no topo), highpass e -15 LUFS
export function cortar(video, segs, saidaVideo, saidaVoz, zoom = 1) {
  const cw = Math.round(1080 / zoom / 2) * 2, ch = Math.round(1920 / zoom / 2) * 2, cx = Math.round((1080 - cw) / 2);
  let fc = '';
  segs.forEach((g, i) => {
    fc += `[0:v]trim=${g.s.toFixed(3)}:${g.e.toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=1080:1920,crop=${cw}:${ch}:${cx}:0,scale=1080:1920,setsar=1[v${i}];\n`;
    fc += `[0:a]atrim=${g.s.toFixed(3)}:${g.e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${(g.dur - 0.01).toFixed(3)}:d=0.01[a${i}];\n`;
  });
  fc += segs.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${segs.length}:v=1:a=1[vc][ac];\n[ac]highpass=f=80,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[aout]`;
  const arq = path.join(path.dirname(saidaVideo), 'cortes-filter.txt');
  fs.writeFileSync(arq, fc);
  ffmpeg(['-i', video, '-/filter_complex', arq, '-map', '[vc]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-g', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', saidaVideo,
    '-map', '[aout]', '-c:a', 'pcm_s16le', saidaVoz]);
}

// Mixa a voz com os efeitos. eventos: [{som, t, ganho (dB), dur}]
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

export function render(dir, qualidade, saida) {
  rodar('npx', ['hyperframes', 'render', '-q', qualidade, '-w', '1', '-o', saida], { cwd: dir, shell: true, stdio: 'inherit' });
}

// Quadros escolhidos lado a lado, pra revisão do Claude
export function folhaDeQuadros(video, tempos, saida, colunas = 6) {
  const sel = tempos.map((t) => `between(t,${t.toFixed(3)},${(t + 0.034).toFixed(3)})`).join('+');
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
