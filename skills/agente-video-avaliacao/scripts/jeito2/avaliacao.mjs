// Jeito 2, passo 3 (código): monta a avaliação (layout em cima, uma ou várias rodadas) a partir do plano.json.
// Uso: node avaliacao.mjs <nome-curto>  (rascunho + revisao.png)   |   node avaliacao.mjs <nome-curto> --final
import path from 'node:path';
import { rodarFormato, segmentos, mapear, cortar, prepararFotos, som, cabecalho, corpo, CSS_CTA, htmlCta, animCta } from './comum.mjs';

// sons fixos: pop no produto, sino no verde, batida grave no vermelho, whoosh na troca de rodada, toque no CTA
const S = som({ pop: { ganho: -14.3, dur: 0.48 }, good: { ganho: -3.4, dur: 1.2 }, bad: { ganho: -14.2, dur: 0.5 }, whoosh: { ganho: -18, dur: 0.6 }, tap: { ganho: -5.6, dur: 0.48 } });

rodarFormato({
  montar({ P, plano, ctx }) {
    const trechos = [...plano.rodadas.map((r) => r.trecho), ...(plano.cta ? [plano.cta.trecho] : [])];
    const { segs, total } = segmentos(trechos, ctx.palavras);
    const T = (t) => mapear(segs, t), DUR = +total.toFixed(2);
    cortar(ctx.fonte, segs, path.join(P, 'assets', 'cut.mp4'), path.join(P, 'assets', 'voz.wav'), plano.enquadramento);
    const ini = (i) => segs.find((g) => g.trecho === i).out;
    const fim = (i) => { const g = segs.filter((x) => x.trecho === i).at(-1); return +(g.out + g.dur).toFixed(2); };
    const rod = plano.rodadas.map((r, i) => ({
      t: r.titulo, n: r.niveis.map((n) => (Array.isArray(n) ? n : [n, ''])),
      p: r.produtos.map((_, j) => `r${i}-${j}.png`), foto: r.produtos.map((p) => p.tipo === 'foto'),
      v: r.notas.map((t) => T(t)), ini: ini(i), fim: fim(i),
    }));
    prepararFotos(P, plano.rodadas.flatMap((r, i) => r.produtos.map((p, j) => ({ nome: `r${i}-${j}`, ...p.foto }))));
    const tCta = plano.cta ? T(plano.cta.t) : null;
    const css = `.st{-webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 5px 0 rgba(0,0,0,.45)}
.titulo{position:absolute;left:60px;top:190px;width:960px;text-align:center;font-weight:900;font-size:76px;line-height:1.05;letter-spacing:-1px;opacity:0}
.nivel{position:absolute;top:398px;width:250px;height:112px;margin-left:-125px;border-radius:24px;box-shadow:0 8px 22px rgba(0,0,0,.3);opacity:.75;will-change:transform,opacity}
.nivel span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:40px;line-height:1.02;
  -webkit-text-stroke:3.5px #000;paint-order:stroke fill;text-shadow:0 3px 0 rgba(0,0,0,.35);opacity:0}
.nivel span.g{font-size:54px}
.nivel span.m{font-size:33px}
#nV{left:200px;background:#12b81e}
#nA{left:460px;background:#ffcc00}
#nR{left:730px;background:#e5252a}
.prod{position:absolute;top:528px;width:250px;height:250px;margin-left:-125px;opacity:0;will-change:transform}
.prod img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 10px 14px rgba(0,0,0,.55))}
.prod.foto img{object-fit:cover;border-radius:26px;border:4px solid #fff;filter:drop-shadow(0 10px 14px rgba(0,0,0,.55))}
.prod .brilho{position:absolute;inset:-20px;border-radius:50%;opacity:0}
.V{left:200px}.A{left:460px}.R{left:730px}
.V .brilho{background:radial-gradient(circle,rgba(18,184,30,.55),transparent 65%)}
.A .brilho{background:radial-gradient(circle,rgba(255,204,0,.55),transparent 65%)}
.R .brilho{background:radial-gradient(circle,rgba(229,37,42,.55),transparent 65%)}
${CSS_CTA}`;
    const ui = `    <div id="titulos"></div>
    <div id="nV" class="nivel"></div><div id="nA" class="nivel"></div><div id="nR" class="nivel"></div>
    <div id="prods"></div>
    ${plano.cta ? htmlCta(plano.cta.frase, plano.cta.top || 1400) : ''}`;
    const cortes = segs.slice(1).map((g) => g.out);
    const script = `const CUTS=${JSON.stringify([0, ...cortes, DUR])};
for(let i=0;i<CUTS.length-1;i++){const s=i%2===0?1:1.05;tl.set('#vwrap',{scale:s},CUTS[i]);tl.to('#vwrap',{scale:s+0.02,duration:CUTS[i+1]-CUTS[i],ease:'none'},CUTS[i]);}
document.getElementById('vwrap').style.transformOrigin='50% 50%';
const RODADAS=${JSON.stringify(rod)};
const COL=['V','A','R'], NIV=['#nV','#nA','#nR'];
const titulos=document.getElementById('titulos'), prods=document.getElementById('prods');
RODADAS.forEach(function(r,i){
  const t=document.createElement('div');t.className='titulo st';t.id='t'+i;t.textContent=r.t;titulos.appendChild(t);
  r.n.forEach(function(n,j){const s=document.createElement('span');s.id='n'+i+'_'+j;if(n[1])s.className=n[1];s.innerHTML=n[0];document.querySelector(NIV[j]).appendChild(s);});
  r.p.forEach(function(src,j){const d=document.createElement('div');d.className='prod '+COL[j]+(r.foto[j]?' foto':'');d.id='p'+i+'_'+j;
    d.innerHTML='<div class="brilho"></div><img src="assets/produtos/'+src+'" alt="">';prods.appendChild(d);});
});
RODADAS.forEach(function(r,i){
  const ini=r.ini, ultima=i===RODADAS.length-1;
  tl.fromTo('#t'+i,{opacity:0,y:-16},{opacity:1,y:0,duration:i===0?0.01:.25,ease:'power2.out'},ini);
  r.n.forEach(function(_,j){tl.fromTo('#n'+i+'_'+j,{opacity:0},{opacity:1,duration:i===0?0.01:.2},ini);});
  NIV.forEach(function(nv){tl.to(nv,{opacity:.75,duration:.15},ini);});
  r.v.forEach(function(t,j){
    const p='#p'+i+'_'+j;
    tl.fromTo(p,{opacity:0,scale:.6},{opacity:1,scale:1,duration:.3,ease:'back.out(2.2)'},t);
    tl.fromTo(p+' .brilho',{opacity:0,scale:.6},{opacity:1,scale:1.1,duration:.15,ease:'power2.out'},t);
    tl.to(p+' .brilho',{opacity:0,duration:.45,ease:'power2.in'},t+.15);
    tl.to(NIV[j],{opacity:1,scale:1.08,duration:.12,ease:'power2.out'},t);
    tl.to(NIV[j],{scale:1,duration:.4,ease:'elastic.out(1,.5)'},t+.12);
  });
  const fim=r.fim;
  r.p.forEach(function(_,j){tl.to('#p'+i+'_'+j,{opacity:0,scale:.7,duration:.2,ease:'power2.in'},fim-.2);});
  tl.to('#t'+i,{opacity:0,duration:.18},fim-.18);
  r.n.forEach(function(_,j){tl.to('#n'+i+'_'+j,{opacity:0,duration:.15},fim-.15);});
  if(ultima){NIV.forEach(function(nv){tl.to(nv,{opacity:0,scale:.9,duration:.2,ease:'power2.in'},fim-.2);});}
});
${tCta != null ? animCta(tCta) : ''}`;
    const eventos = rod.flatMap((r, i) => [...(i > 0 ? [S('whoosh', r.ini)] : []), ...r.v.map((t) => S('pop', t)), S('good', r.v[0]), S('bad', r.v[2])]);
    if (tCta != null) eventos.push(S('tap', tCta));
    return {
      html: cabecalho(plano.titulo || 'Avaliação', css) + corpo(DUR, ui, script),
      eventos,
      revisao: [0.3, ...rod.flatMap((r) => [...r.v.map((t) => t + 0.45), r.fim - 0.35]), ...(tCta != null ? [tCta + 0.8] : []), DUR - 0.2],
      resumo: { duracao: DUR, cortes: segs.length, rodadas: rod.map((r) => ({ titulo: r.t, notas: r.v, ini: r.ini, fim: r.fim })), cta: tCta },
    };
  },
  roteiro: ({ plano, arquivo }) => [`# Avaliação (${plano.slug})`, '', `Vídeo final: 02-finais/${arquivo} (feito pelo Jeito 2)`, '',
    '| Rodada | Título | Verde | Amarelo | Vermelho |', '| --- | --- | --- | --- | --- |',
    ...plano.rodadas.map((r, i) => `| ${i + 1} | ${r.titulo} | ${r.produtos.map((p, j) => `${String(Array.isArray(r.niveis[j]) ? r.niveis[j][0] : r.niveis[j]).replace(/<br>/g, ' ')}: ${p.nome}`).join(' | ')} |`), '',
    plano.cta ? `CTA: "${plano.cta.frase.replace(/\n/g, ' ')}" + Seguir` : 'Sem CTA', '', '## Legenda sugerida', plano.legenda_post || ''].join('\n'),
});
