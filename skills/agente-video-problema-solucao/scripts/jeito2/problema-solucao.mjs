// Jeito 2, passo 3 (código): monta o problema e solução (as duas gravações num cenário só, com máscara de pena no meio;
// quem não fala fica congelado; etiquetas em caixa acima das cabeças; legenda em pedaços; sem efeitos sonoros).
// Uso: node problema-solucao.mjs <nome-curto>  (rascunho + revisao.png)   |   node problema-solucao.mjs <nome-curto> --final
import path from 'node:path';
import { rodarFormato, segmentos, mapear, filtroEnquadramento, gravarVideo, cabecalho, corpo, esc, CSS_CTA, htmlCta, animCta } from './comum.mjs';

// Pedaços de legenda: até 4 palavras, quebrando na pontuação
function pedacos(segs, semLegenda) {
  const out = [];
  for (const g of segs) {
    let cur = [];
    const fecha = () => { if (cur.length) { out.push({ ini: g.out + cur[0].s - g.s, fim: g.out + cur.at(-1).e - g.s, txt: cur.map((w) => w.t).join(' ') }); cur = []; } };
    for (const w of g.ws) {
      if (semLegenda.some((r) => r.video === g.fonte && w.s >= r.de && w.s <= r.ate)) { fecha(); continue; }
      cur.push(w);
      if (cur.length >= 4 || /[.,?!…]$/.test(w.t)) fecha();
    }
    fecha();
  }
  // cada pedaço fica até o próximo começar (no máximo +0,6 s depois da última palavra)
  out.forEach((p, i) => { const prox = out[i + 1]; p.fim = Math.min(prox ? prox.ini - 0.04 : p.fim + 0.6, p.fim + 0.6); });
  return out.map((p) => [+(p.ini - 0.04).toFixed(2), +p.fim.toFixed(2), p.txt.replace(/\.\.\.$/, '...')]);
}

rodarFormato({
  montar({ P, plano, ctx }) {
    const pal = { A: ctx.palavras, B: ctx.palavras2 };
    const fontes = { A: ctx.fonte, B: ctx.fonte2 };
    const { segs, total } = segmentos(plano.turnos.map((t) => ({ ...t, fonte: t.video, palavras: pal[t.video] })), null);
    const DUR = +total.toFixed(2);
    // vídeo: base = quem fica na direita; por cima, quem fica na esquerda com a máscara (pena no meio)
    const esq = plano.lado_esq || 'B', dir = esq === 'A' ? 'B' : 'A';
    const idx = { A: 0, B: 1 }, flip = plano.espelhar ? 'hflip,' : '';
    const fe = filtroEnquadramento(plano.enquadramento);
    let fc = `[2:v]format=gray,split=${segs.length}${segs.map((_, i) => `[m${i}]`).join('')};\n`;
    const trecho = (v, g, i) => (g.fonte === v
      ? `[${idx[v]}:v]trim=${g.s.toFixed(3)}:${g.e.toFixed(3)},setpts=PTS-STARTPTS,${flip}fps=30,scale=1080:1920,setsar=1`
      : `[${idx[v]}:v]trim=start=${g.congela.toFixed(3)}:duration=0.04,setpts=PTS-STARTPTS,${flip}fps=30,scale=1080:1920,setsar=1,tpad=stop_mode=clone:stop_duration=${g.dur.toFixed(3)},trim=duration=${g.dur.toFixed(3)},setpts=PTS-STARTPTS`);
    segs.forEach((g, i) => {
      fc += `${trecho(dir, g, i)}[d${i}];\n${trecho(esq, g, i)},format=rgba[e${i}];\n`;
      fc += `[m${i}]trim=duration=${g.dur.toFixed(3)},setpts=PTS-STARTPTS[mm${i}];[e${i}][mm${i}]alphamerge[em${i}];\n`;
      fc += `[d${i}][em${i}]overlay=0:0:shortest=1,${fe},setsar=1[v${i}];\n`;
      fc += `[${idx[g.fonte]}:a]atrim=${g.s.toFixed(3)}:${g.e.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.01,afade=t=out:st=${(g.dur - 0.01).toFixed(3)}:d=0.01[a${i}];\n`;
    });
    fc += segs.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${segs.length}:v=1:a=1[vc][ac];\n[ac]highpass=f=80,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[aout]`;
    gravarVideo([fontes.A, fontes.B, ['-loop', '1', '-i', path.join(P, 'assets', 'mascara.png')]], fc, path.join(P, 'assets', 'cut.mp4'), path.join(P, 'assets', 'voz.wav'));
    // quem fala em cada trecho, legenda e CTA
    const turnos = []; for (const g of segs) { const l = g.fonte === esq ? 'L' : 'R'; if (turnos.length && turnos.at(-1)[0] === l) turnos.at(-1)[2] = g.out + g.dur; else turnos.push([l, g.out, g.out + g.dur]); }
    const leg = plano.legenda === false ? [] : pedacos(segs, plano.sem_legenda || []);
    const tCta = plano.cta ? mapear(segs, plano.cta.t, plano.cta.video) : null;
    const css = `.st{-webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 5px 0 rgba(0,0,0,.45)}
#titulo{position:absolute;left:0;top:${plano.y_titulo || 205}px;width:1080px;text-align:center;font-weight:900;font-size:84px;line-height:1.05;letter-spacing:-1px}
.etq{position:absolute;top:${plano.y_etiquetas || 398}px;max-width:460px;padding:16px 30px 18px;border-radius:26px;text-align:center;font-weight:900;font-size:64px;line-height:1.0;box-shadow:0 10px 26px rgba(0,0,0,.3);will-change:transform,opacity}
#etqL{left:270px;transform:translateX(-50%);background:#e5252a}
#etqR{left:800px;transform:translateX(-50%);background:#12b81e}
#leg{position:absolute;left:80px;top:${plano.y_legenda || 1090}px;width:920px;text-align:center;font-weight:800;font-size:64px;line-height:1.12;-webkit-text-stroke:5px #000}
#leg span{position:absolute;left:0;top:0;width:920px;opacity:0;display:block}
${CSS_CTA}`;
    const ui = `    <div id="titulo" class="st">${esc(plano.titulo)}</div>
    <div id="etqL" class="etq st">${esc(plano.etiquetas.esq).replace(/\n/g, '<br>')}</div>
    <div id="etqR" class="etq st">${esc(plano.etiquetas.dir).replace(/\n/g, '<br>')}</div>
    <div id="leg" class="st"></div>
    ${plano.cta ? htmlCta(plano.cta.frase, plano.cta.top || 1392) : ''}`;
    const script = `const TURNOS=${JSON.stringify(turnos.map((t) => [t[0], +t[1].toFixed(2), +t[2].toFixed(2)]))};
const LEG=${JSON.stringify(leg)};
const leg=document.getElementById('leg');
LEG.forEach(function(l,i){const s=document.createElement('span');s.id='l'+i;s.textContent=l[2];leg.appendChild(s);});
TURNOS.forEach(function(t){
  const on=t[0]==='L'?'#etqL':'#etqR', off=t[0]==='L'?'#etqR':'#etqL';
  tl.to(on,{opacity:1,scale:1.04,duration:t[1]===0?0.01:.2,ease:'power2.out'},t[1]);
  tl.to(off,{opacity:.55,scale:.96,duration:t[1]===0?0.01:.2,ease:'power2.out'},t[1]);
});
LEG.forEach(function(l,i){
  tl.fromTo('#l'+i,{opacity:0,scale:.92},{opacity:1,scale:1,duration:.12,ease:'power2.out'},Math.max(0,l[0]));
  tl.to('#l'+i,{opacity:0,duration:.08,ease:'none'},Math.max(l[0]+.15,l[1]-.08));
});
${tCta != null ? animCta(tCta) : ''}`;
    return {
      html: cabecalho(plano.titulo, css) + corpo(DUR, ui, script, { semZoom: true }),
      eventos: [],
      revisao: [0.3, ...turnos.map((t) => (t[1] + t[2]) / 2), ...turnos.slice(1).map((t) => t[1] + 0.1), ...(tCta != null ? [tCta + 0.8] : []), DUR - 0.2].sort((a, b) => a - b),
      resumo: { duracao: DUR, cortes: segs.length, turnos, legenda: leg.length, cta: tCta },
    };
  },
  roteiro: ({ plano, arquivo }) => [`# Problema e solução: ${plano.titulo} (${plano.slug})`, '', `Vídeo final: 02-finais/${arquivo} (feito pelo Jeito 2)`, '',
    `Esquerda: ${plano.etiquetas.esq.replace(/\n/g, ' ')} | Direita: ${plano.etiquetas.dir.replace(/\n/g, ' ')}`, '',
    '| Lado | Fala |', '| --- | --- |', ...plano.turnos.map((t) => `| ${t.video === (plano.lado_esq || 'B') ? 'Esquerda' : 'Direita'} | ${t.fala || ''} |`), '',
    plano.cta ? `CTA: "${plano.cta.frase.replace(/\n/g, ' ')}" + Seguir` : 'Sem CTA', '', '## Legenda sugerida', plano.legenda_post || ''].join('\n'),
});
