// Jeito 2, passo 3 (código): monta o mão de vaca a partir do plano.json, sem decisão criativa.
// Uso: node mao-de-vaca.mjs <nome-curto>  (rascunho + revisao.png)   |   node mao-de-vaca.mjs <nome-curto> --final
import path from 'node:path';
import { rodarFormato, segmentos, mapear, cortar, prepararFotos, som, esc, cabecalho, corpo } from './comum.mjs';

// biblioteca fixa de sons (volumes já medidos): pop no caro, caixa registradora no barato, whoosh na saída, toque no CTA
const S = som({ pop: { ganho: -13.3, dur: 0.48 }, cash: { ganho: -10.3, dur: 0.8 }, whoosh: { ganho: -15, dur: 0.6 }, tap: { ganho: -5.6, dur: 0.48 } });

rodarFormato({
  montar({ P, plano, ctx }) {
    const { segs, total } = segmentos(plano.manter, ctx.palavras);
    const T = (t) => mapear(segs, t), DUR = +total.toFixed(2);
    cortar(ctx.fonte, segs, path.join(P, 'assets', 'cut.mp4'), path.join(P, 'assets', 'voz.wav'), plano.enquadramento);
    const trocas = plano.trocas.map((tr, i) => ({ ...tr, i: i + 1, ec: T(tr.t_caro), eb: T(tr.t_barato), sai: tr.t_sai != null ? T(tr.t_sai) - 0.12 : null }));
    trocas.forEach((tr, i) => { if (tr.sai == null) tr.sai = i + 1 < trocas.length ? trocas[i + 1].ec - 0.2 : (plano.cta ? T(plano.cta.t) - 0.15 : DUR); });
    prepararFotos(P, trocas.flatMap((tr) => [{ nome: `troca${tr.i}-caro`, ...tr.caro.foto }, { nome: `troca${tr.i}-barato`, ...tr.barato.foto }]));
    const tCta = plano.cta ? T(plano.cta.t) : null;
    const nm = (s) => Math.min(46, Math.floor(430 / (s.length * 0.6)));
    const prod = (id, lado, tr) => `<div id="${id}" class="prod"><div class="photo"><img src="assets/produtos/troca${tr.i}-${lado}.png" alt=""></div><div class="tag txt"><div class="nm" style="font-size:${nm(tr[lado].nome)}px">${esc(tr[lado].nome)}</div><div class="pr">${esc(tr[lado].preco)}</div></div></div>`;
    const css = `.txt{color:#fff;-webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 5px 0 rgba(0,0,0,.55)}
.col{position:absolute;top:225px;width:470px}
#colL{left:40px}#colR{left:570px}
.label{position:relative;height:112px;border-radius:30px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:62px;line-height:1;letter-spacing:-1px;box-shadow:0 8px 22px rgba(0,0,0,.28);will-change:transform}
#colL .label{background:#ff1f1f}#colR .label{background:#22dd22}
.prod{position:absolute;left:0;top:132px;width:470px;opacity:0;will-change:transform;transform-origin:50% 40%}
.photo{position:relative;margin:0 auto;width:380px;height:380px;border-radius:24px;background:#fff;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,.30)}
.photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.tag{position:relative;margin-top:-18px;width:470px;min-height:118px;border-radius:28px;padding:10px 14px 12px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,.28)}
#colL .tag{background:#ff1f1f}#colR .tag{background:#22dd22}
.tag .nm{font-weight:800;line-height:1.05;letter-spacing:-.5px;white-space:nowrap}
.tag .pr{font-weight:900;font-size:58px;line-height:1.05;letter-spacing:-1px}
#cta{position:absolute;left:90px;top:380px;width:900px;padding:40px 44px 46px;border-radius:44px;text-align:center;opacity:0;
  background:rgba(10,10,14,.46);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:2px solid rgba(255,255,255,.28);box-shadow:0 20px 50px rgba(0,0,0,.35)}
#cta p{margin:0;font-weight:900;font-size:62px;line-height:1.1;letter-spacing:-1px}
#cta .btn{display:inline-flex;align-items:center;margin-top:30px;height:104px;padding:0 54px;border-radius:52px;background:#0095f6;font-weight:900;font-size:54px;box-shadow:0 10px 26px rgba(0,0,0,.35)}`;
    const ui = `    <div id="colL" class="col"><div class="label txt">${esc(plano.rotulos?.caro || 'TÁ SEM $$?')}</div>${trocas.map((tr) => prod(`c${tr.i}`, 'caro', tr)).join('')}</div>
    <div id="colR" class="col"><div class="label txt">${esc(plano.rotulos?.barato || 'VAI NESSE!')}</div>${trocas.map((tr) => prod(`b${tr.i}`, 'barato', tr)).join('')}</div>
    ${plano.cta ? `<div id="cta"><p class="txt">${esc(plano.cta.frase).replace(/\n/g, '<br>')}</p><div class="btn txt">+ Seguir</div></div>` : ''}`;
    const cortes = segs.slice(1).map((g) => g.out);
    const script = `document.getElementById('vwrap').style.transformOrigin='50% 0%';
const CUTS=${JSON.stringify([0, ...cortes, DUR])};
for(let i=0;i<CUTS.length-1;i++){const s=i%2===0?1.0:1.05;tl.set('#vwrap',{scale:s},CUTS[i]);tl.to('#vwrap',{scale:s+0.02,duration:CUTS[i+1]-CUTS[i],ease:'none'},CUTS[i]);}
function pop(id,col,t){
  tl.fromTo(id,{opacity:0,scale:.6},{opacity:1,scale:1,duration:.3,ease:'back.out(2.2)'},t);
  tl.fromTo(col+' .label',{scale:1},{scale:1.07,duration:.1,ease:'power2.out'},t);
  tl.to(col+' .label',{scale:1,duration:.35,ease:'elastic.out(1,.5)'},t+.1);
}
function out(id,t){ tl.to(id,{opacity:0,scale:.6,duration:.2,ease:'power2.in'},t); }
// [caro, barato, entra caro, entra barato, sai] (tempos do vídeo cortado, vindos do plano)
${JSON.stringify(trocas.map((tr) => [`#c${tr.i}`, `#b${tr.i}`, tr.ec, tr.eb, +tr.sai.toFixed(2)]))}.forEach(function(r){pop(r[0],'#colL',r[2]);pop(r[1],'#colR',r[3]);out(r[0],r[4]);out(r[1],r[4]);});
${tCta != null ? `tl.fromTo('#cta',{opacity:0,scale:.75,y:30},{opacity:1,scale:1,y:0,duration:.35,ease:'back.out(1.8)'},${tCta.toFixed(2)});
tl.fromTo('#cta .btn',{scale:1},{scale:1.08,duration:.18,ease:'power2.out'},${(tCta + 1.4).toFixed(2)});
tl.to('#cta .btn',{scale:1,duration:.4,ease:'elastic.out(1,.5)'},${(tCta + 1.58).toFixed(2)});` : ''}`;
    const eventos = trocas.flatMap((tr) => [S('pop', tr.ec), S('cash', tr.eb), S('whoosh', tr.sai - 0.04)]);
    if (tCta != null) eventos.push(S('tap', tCta));
    return {
      html: cabecalho(plano.titulo || 'Mão de vaca', css) + corpo(DUR, ui, script),
      eventos,
      revisao: [0.3, ...trocas.flatMap((tr) => [tr.ec - 0.1, tr.ec + 0.5, tr.eb + 0.5, tr.sai - 0.1]), ...(tCta != null ? [tCta + 0.6] : []), DUR - 0.2],
      resumo: { duracao: DUR, cortes: segs.length, trocas: trocas.map((tr) => ({ caro: tr.caro.nome, barato: tr.barato.nome, entraCaro: tr.ec, entraBarato: tr.eb, sai: +tr.sai.toFixed(2) })), cta: tCta },
    };
  },
  roteiro: ({ plano, calc, arquivo }) => [`# Mão de vaca (${plano.slug})`, '', `Vídeo final: 02-finais/${arquivo} (feito pelo Jeito 2)`, '',
    '| Troca | Caro | Preço | Barato | Preço |', '| --- | --- | --- | --- | --- |',
    ...plano.trocas.map((t, i) => `| ${i + 1} | ${t.caro.nome} | ${t.caro.preco} | ${t.barato.nome} | ${t.barato.preco} |`), '',
    plano.cta ? `CTA: "${plano.cta.frase.replace(/\n/g, ' ')}" + Seguir` : 'Sem CTA', '', '## Legenda sugerida', plano.legenda_post || ''].join('\n'),
});
