// Jeito 2, passo 3 (código): monta o destampando a partir do plano.json, sem decisão criativa.
// Uso: node destampando.mjs <nome-curto>   (gera o rascunho e a folha de revisão)
//      node destampando.mjs <nome-curto> --final   (render final + entrega sem metadados)
import fs from 'node:fs';
import path from 'node:path';
import { APP, proj, rodar, segmentos, mapear, cortar, mixar, render, folhaDeQuadros, entregar } from './comum.mjs';

const [slug, flag] = process.argv.slice(2);
const P = proj(slug), J = path.join(P, 'jeito2');
const plano = JSON.parse(fs.readFileSync(path.join(J, 'plano.json'), 'utf8'));
const ctx = JSON.parse(fs.readFileSync(path.join(J, 'contexto.json'), 'utf8'));

if (flag === '--final') {
  render(P, 'high', 'renders/final.mp4');
  const destino = entregar(path.join(P, 'renders', 'final.mp4'), slug);
  const linhas = plano.pares.map((p, i) => `| ${i + 1} | ${p.nunca} | ${p.certo} | ${p.saiNunca.toFixed(1)} s | ${p.saiCerto.toFixed(1)} s |`);
  fs.writeFileSync(path.join(APP, '03-roteiros', `${slug}.md`), [`# Destampando: NUNCA ${plano.verbo} x ${plano.verbo} (${slug})`, '',
    `Vídeo final: 02-finais/${path.basename(destino)} (feito pelo Jeito 2: plano do Claude + montagem por código)`, '',
    '| Linha | Nunca | Certo | Tarja vermelha sai | Tarja verde sai |', '| --- | --- | --- | --- | --- |', ...linhas, '',
    plano.cta ? `CTA: "${plano.cta.frase}" + Seguir` : 'Sem CTA', '', '## Legenda sugerida', plano.legenda_post || ''].join('\n'));
  console.log(`ENTREGUE: ${destino}`);
  process.exit(0);
}

// 1. cortes (tempo do bruto -> tempo final)
const { segs, total } = segmentos(plano.manter, ctx.palavras);
const T = (t) => mapear(segs, t);
cortar(ctx.fonte, segs, path.join(P, 'assets', 'cut.mp4'), path.join(P, 'assets', 'voz.wav'), plano.zoom || 1);
const DUR = +total.toFixed(2);
fs.writeFileSync(path.join(P, 'cuts.json'), JSON.stringify({ segmentos: segs.map((g) => ({ de: +g.s.toFixed(3), ate: +g.e.toFixed(3), saida: g.out, frase: g.ws.map((w) => w.t).join(' ') })), zoom: plano.zoom || 1 }, null, 1));
for (const p of plano.pares) { p.saiNunca = T(p.t_nunca); p.saiCerto = T(p.t_certo); }
const tCta = plano.cta ? T(plano.cta.t) : null;

// 2. som: biblioteca fixa com volumes já medidos (pá no erro, blim no certo, whoosh em cada tarja, toque no CTA)
const SOM = { pa: { ganho: -14.2, dur: 0.5 }, whoosh: { ganho: -18, dur: 0.6 }, blim: { ganho: -3.4, dur: 1.2 }, tap: { ganho: -5.6, dur: 0.48 } };
const ev = (som, t) => ({ som, t, ...SOM[som] });
const eventos = plano.sons === false ? [] : plano.pares.flatMap((p) => [ev('whoosh', p.saiNunca - 0.03), ev('pa', p.saiNunca), ev('whoosh', p.saiCerto - 0.08), ev('blim', p.saiCerto)]);
if (tCta != null && plano.sons !== false) eventos.push(ev('tap', tCta + 0.2));
mixar(path.join(P, 'assets', 'sfx'), path.join(P, 'assets', 'voz.wav'), eventos, path.join(P, 'assets', 'mix.wav'));

// 3. layout pela regra do rosto (tudo abaixo do queixo)
const n = plano.pares.length;
const titTop = Math.max(1045, plano.queixo_max_px + 50);
const etTop = titTop + 108;
const rowsTop = titTop + 113 + (plano.etiqueta ? 60 : 0);
const H = Math.max(50, Math.min(90, Math.floor((1460 - rowsTop) / n)));
const maiorTexto = Math.max(...plano.pares.flatMap((p) => [p.nunca.length, p.certo.length]));
const fonte = Math.max(36, Math.min(Math.round(H * 0.62), Math.floor(390 / (maiorTexto * 0.56))));
const ctaTop = Math.min(1472, rowsTop + n * H + 14);
if (rowsTop + n * H > 1560) console.warn('AVISO: o bloco passou de 1560 px. Diminua o zoom no plano.');
if (fonte < 44) console.warn('AVISO: texto das linhas ficou pequeno. Encurte os textos no plano (até 15 letras).');

// 4. tela (modelo fixo do destampando)
const cortesSaida = segs.slice(1).map((g) => g.out);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const contorno = plano.contorno ? '-webkit-text-stroke:5px #000;paint-order:stroke fill;' : '';
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>NUNCA ${esc(plano.verbo)}</title>
<script src="assets/gsap.min.js"></script>
<style>
@font-face{font-family:"Poppins";src:url("assets/fonts/poppins-700.woff2") format("woff2");font-weight:700;font-style:normal}
@font-face{font-family:"Poppins";src:url("assets/fonts/poppins-800.woff2") format("woff2");font-weight:800;font-style:normal}
@font-face{font-family:"Poppins";src:url("assets/fonts/poppins-900.woff2") format("woff2");font-weight:900;font-style:normal}
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000;color:#fff;-webkit-font-smoothing:antialiased}
#main{position:relative;width:1080px;height:1920px;overflow:hidden;background:#000;font-family:"Poppins",Arial,sans-serif}
#vwrap{position:absolute;inset:0;transform-origin:50% 52%;will-change:transform}
#clip{position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover}
#ui{position:absolute;inset:0}
.ttl{position:absolute;top:${titTop}px;height:96px;padding:0 20px;border-radius:7px;display:flex;align-items:center;font-weight:800;font-size:66px;line-height:1;letter-spacing:-1px;white-space:nowrap}
#tL{left:92px;background:#e5252a}
#tR{right:110px;background:#10b31a}
#et{position:absolute;top:${etTop}px;left:50%;transform:translateX(-50%);height:55px;padding:0 18px;border-radius:6px;background:#e5252a;display:flex;align-items:center;font-weight:800;font-size:40px;white-space:nowrap}
.row{position:absolute;left:0;width:1080px;height:${H}px}
.cell{position:absolute;top:0;height:${H}px;display:flex;align-items:center;white-space:nowrap}
.cL{left:92px;width:443px;justify-content:flex-start;padding-left:6px}
.cR{left:538px;width:432px;justify-content:flex-end;padding-right:6px}
.cell span{display:inline-block;font-weight:700;font-size:${fonte}px;line-height:1;letter-spacing:-1px;${contorno}
  text-shadow:0 0 3px rgba(0,0,0,.95),0 2px 8px rgba(0,0,0,.85),0 0 18px rgba(0,0,0,.45);will-change:transform}
.cL span{transform-origin:0% 50%}.cR span{transform-origin:100% 50%}
.tarja{position:absolute;inset:0;will-change:clip-path}
.cL .tarja{background:#e5252a}.cR .tarja{background:#10b31a}
#cta{position:absolute;left:100px;top:${ctaTop}px;width:880px;height:92px;border-radius:26px;padding:0 18px 0 34px;display:flex;align-items:center;justify-content:space-between;opacity:0;
  background:rgba(10,10,14,.55);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:2px solid rgba(255,255,255,.25);box-shadow:0 14px 34px rgba(0,0,0,.35)}
#cta p{margin:0;font-weight:800;font-size:34px;line-height:1.1;letter-spacing:-.5px}
#cta .btn{height:68px;padding:0 30px;border-radius:34px;background:#0095f6;display:flex;align-items:center;font-weight:800;font-size:36px;white-space:nowrap}
</style></head><body>
<div id="main" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="1080" data-height="1920">
  <div id="vwrap"><video id="clip" data-start="0" data-duration="${DUR}" data-track-index="0" src="assets/cut.mp4" muted playsinline></video></div>
  <audio id="mix" data-start="0" data-duration="${DUR}" data-track-index="1" src="assets/mix.wav" data-volume="1"></audio>
  <div id="ui" class="clip" data-start="0" data-duration="${DUR}" data-track-index="2">
    <div id="tL" class="ttl">NUNCA ${esc(plano.verbo)}</div>
    <div id="tR" class="ttl">${esc(plano.verbo)}</div>
    ${plano.etiqueta ? `<div id="et">${esc(plano.etiqueta)}</div>` : ''}
    <div id="rows"></div>
    ${plano.cta ? `<div id="cta"><p>${esc(plano.cta.frase)}</p><div class="btn">+ Seguir</div></div>` : ''}
  </div>
</div>
<script>
const DUR=${DUR};
// [nunca, certo, sai vermelho, sai verde] (tempos no vídeo cortado, vindos do plano)
const PARES=${JSON.stringify(plano.pares.map((p) => [p.nunca, p.certo, p.saiNunca, p.saiCerto]))};
const TOP=${rowsTop}, H=${H};
const rows=document.getElementById('rows');
PARES.forEach(function(p,i){
  const r=document.createElement('div');r.className='row';r.style.top=(TOP+i*H)+'px';
  r.innerHTML='<div class="cell cL" id="L'+i+'"><span>'+p[0]+'</span><div class="tarja"></div></div>'+
              '<div class="cell cR" id="R'+i+'"><span>'+p[1]+'</span><div class="tarja"></div></div>';
  rows.appendChild(r);
});
const tl=gsap.timeline({paused:true});
// zoom leve alternado em cada corte, pra disfarçar o pulo (origem na altura do queixo)
const CUTS=${JSON.stringify([0, ...cortesSaida, DUR])};
for(let i=0;i<CUTS.length-1;i++){
  const s=i%2===0?1.0:1.05;
  tl.set('#vwrap',{scale:s},CUTS[i]);
  tl.to('#vwrap',{scale:s+0.02,duration:CUTS[i+1]-CUTS[i],ease:'none'},CUTS[i]);
}
// tarjas: a vermelha recolhe pra esquerda, a verde pra direita
PARES.forEach(function(p,i){
  tl.fromTo('#L'+i+' .tarja',{clipPath:'inset(0% 0% 0% 0%)'},{clipPath:'inset(0% 100% 0% 0%)',duration:.36,ease:'power2.inOut'},p[2]);
  tl.fromTo('#L'+i+' span',{scale:.96},{scale:1,duration:.3,ease:'power2.out'},p[2]+.06);
  tl.fromTo('#R'+i+' .tarja',{clipPath:'inset(0% 0% 0% 0%)'},{clipPath:'inset(0% 0% 0% 100%)',duration:.36,ease:'power2.inOut'},p[3]);
  tl.fromTo('#R'+i+' span',{scale:.96},{scale:1.04,duration:.2,ease:'power2.out'},p[3]+.08);
  tl.to('#R'+i+' span',{scale:1,duration:.3,ease:'power2.inOut'},p[3]+.28);
});
${tCta != null ? `tl.fromTo('#cta',{opacity:0,y:24,scale:.92},{opacity:1,y:0,scale:1,duration:.35,ease:'back.out(1.8)'},${tCta.toFixed(2)});
tl.fromTo('#cta .btn',{scale:1},{scale:1.08,duration:.16,ease:'power2.out'},${(tCta + 0.6).toFixed(2)});
tl.to('#cta .btn',{scale:1,duration:.4,ease:'elastic.out(1,.5)'},${(tCta + 0.76).toFixed(2)});` : ''}
tl.set({},{},DUR);
window.__timelines=window.__timelines||{};window.__timelines['main']=tl;
</script></body></html>
`;
fs.writeFileSync(path.join(P, 'index.html'), html);
fs.writeFileSync(path.join(J, 'plano.json'), JSON.stringify(plano, null, 2));

// 5. lint, rascunho e folha de revisão
rodar('npx', ['hyperframes', 'lint'], { cwd: P, shell: true });
render(P, 'draft', 'renders/draft1.mp4');
const tempos = [0.3, ...plano.pares.flatMap((p) => [p.saiNunca - 0.15, p.saiNunca + 0.5, p.saiCerto + 0.5]), ...(tCta != null ? [tCta + 0.8] : []), DUR - 0.2];
folhaDeQuadros(path.join(P, 'renders', 'draft1.mp4'), tempos, path.join(J, 'revisao.png'));
console.log(JSON.stringify({ duracao: DUR, cortes: segs.length, titulos: titTop, linhas: rowsTop, alturaLinha: H, fonte, cta: tCta, tarjas: plano.pares.map((p) => [p.saiNunca, p.saiCerto]) }));
console.log(`Revisão: ${path.join(J, 'revisao.png')}`);
