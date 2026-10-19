// Jeito 2, passo 3 (código): monta a classificação (ranking com números na esquerda, item aparece quando a pessoa
// fala o nome e voa pra linha quando fala a posição, top 3 em ouro, prata e bronze) a partir do plano.json.
// Uso: node classificacao.mjs <nome-curto>  (rascunho + revisao.png)   |   node classificacao.mjs <nome-curto> --final
import path from 'node:path';
import { rodarFormato, segmentos, mapear, cortar, prepararFotos, som, esc, cabecalho, corpo, CSS_CTA, htmlCta, animCta } from './comum.mjs';

// sons fixos: pop quando o item aparece, whoosh quando voa, tique ao pousar (brilho no top 3), fanfarra no 1º, final no CTA
const S = som({ pop: { ganho: -2.8, dur: 0.48 }, whoosh: { ganho: -15, dur: 0.6 }, tick: { ganho: -1, dur: 0.48 }, shine: { ganho: -14.5, dur: 1.0 }, fanfare: { ganho: -11.6, dur: 1.6 }, final: { ganho: -11.1, dur: 1.0 } });

rodarFormato({
  montar({ P, plano, ctx }) {
    const { segs, total } = segmentos(plano.manter, ctx.palavras);
    const T = (t) => mapear(segs, t), DUR = +total.toFixed(2);
    cortar(ctx.fonte, segs, path.join(P, 'assets', 'cut.mp4'), path.join(P, 'assets', 'voz.wav'), plano.enquadramento);
    const N = plano.itens.length, TOP = plano.y_lista || 440, ROW = Math.min(202, Math.floor(((plano.y_fim_lista || 1450) - TOP) / N));
    const k = ROW / 202;
    const espera = plano.espera || { x: 360, y: 930, escala: 1.2 };
    const itens = plano.itens.map((it, i) => ({ ...it, n: i + 1, show: T(it.t_nome), v: T(it.t_posicao), w: it.espera || espera }));
    prepararFotos(P, itens.map((it) => (it.foto ? { nome: `item${it.n}`, ...it.foto } : null)));
    const comCta = plano.cta && plano.cta.tipo !== 'comenta';
    const css = `@font-face{font-family:"Segoe UI Emoji";src:local("Segoe UI Emoji")}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.42) 0,rgba(0,0,0,.12) 24%,transparent 34%),linear-gradient(90deg,rgba(0,0,0,.30) 0,transparent 30%)}
#flash{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse 80% 60% at 50% 45%,transparent 30%,rgba(255,200,0,.42) 100%)}
.ig{color:#fff;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 4px 14px rgba(0,0,0,.45)}
.em{-webkit-text-stroke:0;font-family:"Segoe UI Emoji",sans-serif;text-shadow:0 3px 10px rgba(0,0,0,.35)}
#title{position:absolute;left:40px;width:1000px;top:${plano.y_titulo || 200}px;margin:0;text-align:center;font-size:60px;line-height:1.12;font-weight:800;letter-spacing:-1.2px}
.num{position:absolute;left:44px;width:140px;height:${ROW}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(176 * k)}px;line-height:1;font-weight:900;letter-spacing:-4px;-webkit-text-stroke:${Math.max(4, Math.round(7 * k))}px #000;transform:skewX(-8deg)}
.num span{display:block;transform-origin:50% 55%}
.item{position:absolute;left:196px;width:${plano.largura_item || 470}px;height:${ROW}px;display:flex;align-items:center;opacity:0;will-change:transform}
.item p{margin:0;font-size:${Math.round(56 * Math.max(k, 0.7))}px;line-height:1.08;font-weight:800;letter-spacing:-1px}
.item .em{font-size:${Math.round(54 * Math.max(k, 0.7))}px;margin-right:12px}
.item img{height:${Math.round(ROW * 0.8)}px;margin-right:14px;border-radius:14px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
#ctaC{position:absolute;left:0;width:1080px;top:${plano.cta?.top || 1462}px;display:flex;align-items:center;justify-content:center;gap:20px;opacity:0}
#ctaC p{margin:0;font-size:52px;font-weight:800;letter-spacing:-1px}
#ctaC .btn{height:82px;padding:0 34px;border-radius:41px;background:#fff;color:#111;display:flex;align-items:center;font-size:44px;font-weight:900;letter-spacing:.5px;border:3px solid #000;box-shadow:0 10px 26px rgba(0,0,0,.35)}
#ctaC .sub{position:absolute;top:92px;left:0;right:0;text-align:center;font-size:32px;font-weight:700}
${CSS_CTA}`;
    const nums = Array.from({ length: N }, (_, i) => `    <div id="n${i + 1}" class="num ig" style="top:${TOP + i * ROW}px"><span>${i + 1}</span></div>`).join('\n');
    const lis = itens.map((it) => `    <div id="it${it.n}" class="item" style="top:${TOP + (it.posicao - 1) * ROW}px"><p class="ig">${it.foto ? `<img src="assets/produtos/item${it.n}.png" alt="">` : it.emoji ? `<span class="em">${it.emoji}</span>` : ''}${esc(it.texto)}</p></div>`).join('\n');
    let ctaHtml = '', ctaAnim = '';
    if (plano.cta && plano.cta.tipo === 'comenta') {
      const c = T(plano.cta.t), ce = plano.cta.t_fim != null ? T(plano.cta.t_fim) : DUR;
      ctaHtml = `<div id="ctaC"><p class="ig">Comenta</p><div class="btn">${esc(plano.cta.palavra)}</div><p class="ig"><span class="em">💬</span></p><div class="sub ig">${esc(plano.cta.sub || 'que eu te envio no direct')}</div></div>`;
      ctaAnim = `tl.fromTo('#ctaC',{opacity:0,y:40,scale:.8},{opacity:1,y:0,scale:1,duration:.34,ease:'back.out(1.9)'},${c});
tl.fromTo('#ctaC .btn',{scale:1},{scale:1.1,duration:.12,ease:'power2.out'},${c + 0.9});
tl.to('#ctaC .btn',{scale:1,duration:.35,ease:'elastic.out(1,.5)'},${c + 1.02});
${ce < DUR ? `tl.to('#ctaC',{opacity:0,y:20,duration:.22,ease:'power2.in'},${ce});` : ''}`;
    } else if (comCta) { ctaHtml = htmlCta(plano.cta.frase, plano.cta.top || 1462); ctaAnim = animCta(T(plano.cta.t)); }
    const tCta = plano.cta ? T(plano.cta.t) : null;
    const primeiro = itens.find((it) => it.posicao === 1);
    const ui = `    <div class="shade"></div><div id="flash"></div>
    <h1 id="title" class="ig">${esc(plano.titulo)}</h1>
${nums}
${lis}
    ${ctaHtml}`;
    const cortes = segs.slice(1).map((g) => g.out);
    const script = `document.getElementById('vwrap').style.transformOrigin='${plano.origem_zoom || '72% 31%'}';
const CUTS=${JSON.stringify([0, ...cortes, DUR])};
for(let i=0;i<CUTS.length-1;i++){const s=i%2===0?1.0:1.05;tl.set('#vwrap',{scale:s},CUTS[i]);tl.to('#vwrap',{scale:s+0.02,duration:CUTS[i+1]-CUTS[i],ease:'none'},CUTS[i]);}
const COLORS={1:'#ffd60a',2:'#d8dde6',3:'#d08a4e'};
const GLOW={1:'0 0 34px rgba(255,214,10,.9),0 4px 14px rgba(0,0,0,.45)',2:'0 0 26px rgba(216,221,230,.75),0 4px 14px rgba(0,0,0,.45)',3:'0 0 26px rgba(208,138,78,.8),0 4px 14px rgba(0,0,0,.45)'};
tl.from('.num',{x:-60,opacity:0,duration:.35,stagger:.05,ease:'expo.out'},0);
const TOP=${TOP}, ROW=${ROW};
const items=${JSON.stringify(itens.map((it) => ({ n: it.n, rank: it.posicao, show: it.show, v: it.v, wx: it.w.x, wy: it.w.y, ws: it.w.escala })))};
const rowCenter=function(r){return TOP+ROW/2+(r-1)*ROW;};
items.forEach(function(it){
  const el='#it'+it.n, p=el+' p', num='#n'+it.rank+' span';
  const x0=it.wx-196, y0=it.wy-rowCenter(it.rank), s0=it.ws, lag=.1, fly=.45, land=it.v+lag+fly;
  tl.set(el,{transformOrigin:'0% 50%'},0);
  tl.fromTo(el,{opacity:0,x:x0,y:y0+40,scale:s0*.7},{opacity:1,x:x0,y:y0,scale:s0,duration:.34,ease:'back.out(1.9)'},it.show);
  if(it.v-it.show>1.2)tl.to(el,{scale:s0*1.04,duration:it.v-it.show-.4,ease:'sine.inOut'},it.show+.34);
  tl.to(el,{scale:s0*1.1,duration:lag,ease:'power2.out'},it.v);
  tl.to(el,{x:0,y:0,scale:it.rank===1?1.12:1,duration:fly,ease:'power3.inOut'},it.v+lag);
  tl.fromTo(num,{scale:1},{scale:1.22,duration:.1,ease:'power2.out'},land-.05);
  tl.to(num,{scale:1,duration:.45,ease:'elastic.out(1,.45)'},land+.05);
  if(COLORS[it.rank]){tl.to([num,p],{color:COLORS[it.rank],textShadow:GLOW[it.rank],duration:.15,ease:'power1.out'},land-.05);}
  if(it.rank===1){tl.to(el,{scale:1,duration:.5,ease:'elastic.out(1,.5)'},land);}
});
${primeiro ? `// 1º lugar: flash dourado (sem tremidinha)
const W=${(primeiro.v + 0.55).toFixed(2)};
tl.to('#flash',{opacity:1,duration:.08,ease:'none'},W-.03);
tl.to('#flash',{opacity:0,duration:1.1,ease:'power2.out'},W+.05);` : ''}
${ctaAnim}`;
    const pousa = (it) => it.v + 0.1 + 0.45;
    const eventos = itens.flatMap((it) => [S('pop', it.show), S('whoosh', it.v + 0.08), it.posicao === 1 ? S('fanfare', pousa(it) - 0.05) : it.posicao <= 3 ? S('shine', pousa(it) - 0.05) : S('tick', pousa(it) - 0.05)]);
    if (tCta != null) eventos.push(S('final', tCta));
    return {
      html: cabecalho(plano.titulo, css) + corpo(DUR, ui, script),
      eventos,
      revisao: [0.3, ...itens.flatMap((it) => [it.show + 0.45, pousa(it) + 0.3]), ...(tCta != null ? [tCta + 1] : []), DUR - 0.2],
      resumo: { duracao: DUR, cortes: segs.length, linha: ROW, itens: itens.map((it) => ({ item: it.texto, posicao: it.posicao, aparece: it.show, posicaoFalada: it.v })), cta: tCta },
    };
  },
  roteiro: ({ plano, arquivo }) => [`# Classificação: ${plano.titulo} (${plano.slug})`, '', `Vídeo final: 02-finais/${arquivo} (feito pelo Jeito 2)`, '',
    '| Posição | Item |', '| --- | --- |', ...[...plano.itens].sort((a, b) => a.posicao - b.posicao).map((it) => `| ${it.posicao}º | ${it.emoji || ''} ${it.texto} |`), '',
    plano.cta ? (plano.cta.tipo === 'comenta' ? `CTA: Comenta "${plano.cta.palavra}"` : `CTA: "${plano.cta.frase}" + Seguir`) : 'Sem CTA', '', '## Legenda sugerida', plano.legenda_post || ''].join('\n'),
});
