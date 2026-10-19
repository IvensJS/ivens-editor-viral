// Jeito 2, passo 3 (código): monta o contraste a partir do plano.json (título acima da cabeça, etiquetas nos ombros,
// exemplo aparece embaixo e é arrastado pro lado do veredito).
// Uso: node contraste.mjs <nome-curto>  (rascunho + revisao.png)   |   node contraste.mjs <nome-curto> --final
import path from 'node:path';
import { rodarFormato, segmentos, mapear, cortar, prepararFotos, som, esc, cabecalho, corpo, CSS_CTA, htmlCta, animCta } from './comum.mjs';

// sons fixos: pop quando o exemplo aparece, whoosh no arrasto, sino no lado bom, batida grave no lado ruim, toque no CTA
const S = som({ pop: { ganho: -14.3, dur: 0.48 }, whoosh: { ganho: -18, dur: 0.6 }, good: { ganho: -3.4, dur: 1.2 }, bad: { ganho: -14.2, dur: 0.5 }, tap: { ganho: -5.6, dur: 0.48 } });
const COR = { verde: '#12b81e', vermelho: '#e5252a', azul: '#1f6feb', laranja: '#f28c00' };

rodarFormato({
  montar({ P, plano, ctx }) {
    const { segs, total } = segmentos(plano.manter, ctx.palavras);
    const T = (t) => mapear(segs, t), DUR = +total.toFixed(2);
    cortar(ctx.fonte, segs, path.join(P, 'assets', 'cut.mp4'), path.join(P, 'assets', 'voz.wav'), plano.enquadramento);
    const ex = plano.exemplos.map((e, i) => ({ ...e, id: `e${i + 1}`, ap: T(e.t_aparece), ve: T(e.t_veredito), dir: e.lado === 'esq' ? -1 : 1 }));
    prepararFotos(P, ex.map((e) => (e.foto ? { nome: e.id, ...e.foto } : null)));
    const yL = plano.y_lados || 995, yEx = yL + 123, tCta = plano.cta ? T(plano.cta.t) : null;
    const corBoa = (lado) => (plano.lados[lado].cor || (lado === 'esq' ? 'verde' : 'vermelho')) !== 'vermelho';
    const css = `#titulo{position:absolute;left:0;top:${plano.y_titulo || 205}px;width:1080px;text-align:center;font-weight:900;font-size:${plano.tamanho_titulo || 88}px;line-height:1.05;letter-spacing:-1px;
  -webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 6px 0 rgba(0,0,0,.45)}
.lado{position:absolute;top:${yL}px;height:108px;padding:0 34px;border-radius:18px;display:flex;align-items:center;font-weight:800;font-size:64px;letter-spacing:.5px;white-space:nowrap;
  -webkit-text-stroke:2.5px #000;paint-order:stroke fill;text-shadow:0 3px 0 rgba(0,0,0,.35);box-shadow:0 8px 22px rgba(0,0,0,.28);will-change:transform}
#ladoL{left:80px;background:${COR[plano.lados.esq.cor || 'verde']};transform-origin:0% 50%}
#ladoR{right:90px;background:${COR[plano.lados.dir.cor || 'vermelho']};transform-origin:100% 50%}
.ex{position:absolute;left:310px;top:${yEx}px;width:460px;height:460px;border-radius:22px;overflow:hidden;background:#fff;opacity:0;box-shadow:0 14px 34px rgba(0,0,0,.35);will-change:transform}
.ex img{width:100%;height:100%;object-fit:cover;display:block}
.ex.txt{height:auto;min-height:150px;padding:26px 30px;display:flex;align-items:center;justify-content:center;text-align:center;color:#111;font-weight:900;font-size:56px;line-height:1.08;letter-spacing:-1px}
${CSS_CTA}`;
    const ui = `    <div id="titulo">${esc(plano.titulo)}</div>
    <div id="ladoL" class="lado">${esc(plano.lados.esq.texto)}</div>
    <div id="ladoR" class="lado">${esc(plano.lados.dir.texto)}</div>
${ex.map((e) => (e.foto ? `    <div id="${e.id}" class="ex"><img src="assets/produtos/${e.id}.png" alt=""></div>` : `    <div id="${e.id}" class="ex txt">${esc(e.texto)}</div>`)).join('\n')}
    ${plano.cta ? htmlCta(plano.cta.frase, plano.cta.top || 1400) : ''}`;
    const cortes = segs.slice(1).map((g) => g.out);
    const script = `document.getElementById('vwrap').style.transformOrigin='50% ${plano.origem_zoom_y || 34}%';
const CUTS=${JSON.stringify([0, ...cortes, DUR])};
for(let i=0;i<CUTS.length-1;i++){const s=i%2===0?1.0:1.05;tl.set('#vwrap',{scale:s},CUTS[i]);tl.to('#vwrap',{scale:s+0.02,duration:CUTS[i+1]-CUTS[i],ease:'none'},CUTS[i]);}
// [id, aparece, veredito, lado: -1 = esquerda, 1 = direita] (tempos do vídeo cortado, vindos do plano)
${JSON.stringify(ex.map((e) => [`#${e.id}`, e.ap, e.ve, e.dir]))}.forEach(function(e){
  const id=e[0], t=e[1], v=e[2], lado=e[3], lab=lado<0?'#ladoL':'#ladoR';
  tl.fromTo(id,{opacity:0,scale:.7,x:0,rotation:0},{opacity:1,scale:1,duration:.3,ease:'back.out(2)'},t);
  tl.fromTo(lab,{scale:1},{scale:1.1,duration:.12,ease:'power2.out'},v);
  tl.to(lab,{scale:1,duration:.4,ease:'elastic.out(1,.5)'},v+.12);
  tl.to(id,{x:lado*900,rotation:lado*10,duration:.46,ease:'power2.in'},v+.02);
  tl.set(id,{opacity:0},v+.5);
});
${tCta != null ? animCta(tCta) : ''}`;
    const eventos = ex.flatMap((e) => [S('pop', e.ap), S('whoosh', e.ve), S(corBoa(e.lado) ? 'good' : 'bad', e.ve + 0.1)]);
    if (tCta != null) eventos.push(S('tap', tCta));
    return {
      html: cabecalho(plano.titulo, css) + corpo(DUR, ui, script),
      eventos,
      revisao: [0.3, ...ex.flatMap((e) => [e.ap + 0.4, e.ve + 0.25]), ...(tCta != null ? [tCta + 0.8] : []), DUR - 0.2],
      resumo: { duracao: DUR, cortes: segs.length, exemplos: ex.map((e) => ({ exemplo: e.nome || e.texto, lado: e.lado, aparece: e.ap, veredito: e.ve })), cta: tCta },
    };
  },
  roteiro: ({ plano, arquivo }) => [`# Contraste: ${plano.titulo} (${plano.slug})`, '', `Vídeo final: 02-finais/${arquivo} (feito pelo Jeito 2)`, '',
    `| Exemplo | Lado |`, '| --- | --- |', ...plano.exemplos.map((e) => `| ${e.nome || e.texto} | ${plano.lados[e.lado].texto} |`), '',
    plano.cta ? `CTA: "${plano.cta.frase.replace(/\n/g, ' ')}" + Seguir` : 'Sem CTA', '', '## Legenda sugerida', plano.legenda_post || ''].join('\n'),
});
