// Trata a foto de um produto para o formato mão de vaca.
//
// Uso:
//   node tratar-produto.mjs <entrada> <saida.png> [--modo quadrado|solto] [--tolerancia 30] [--tamanho 900]
//
// --modo quadrado (padrão): corta o excesso de branco em volta e centraliza o
//   produto num quadrado branco, com uma margem pequena. Igual à referência.
// --modo solto: apaga só o branco que encosta nas bordas da foto (o branco de
//   dentro do produto fica) e salva PNG com fundo transparente, já recortado.
//
// Usa a biblioteca sharp que já vem instalada no HyperFrames Student Kit.

import { createRequire } from "node:module";

const KIT = "C:/Users/SEU-USUARIO/hyperframes-student-kit/package.json";
const sharp = createRequire(KIT)("sharp");

const args = process.argv.slice(2);
const pos = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));
const opt = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};

const [entrada, saida] = pos;
if (!entrada || !saida) {
  console.error("Uso: node tratar-produto.mjs <entrada> <saida.png> [--modo quadrado|solto] [--tolerancia 30] [--tamanho 900]");
  process.exit(1);
}
const modo = opt("modo", "quadrado");
const tolerancia = Number(opt("tolerancia", 30));
const tamanho = Number(opt("tamanho", 900));

const { data, info } = await sharp(entrada)
  .rotate()
  .flatten({ background: "#ffffff" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width: w, height: h } = info;
const limite = 255 - tolerancia;
const ehBranco = (p) => data[p] >= limite && data[p + 1] >= limite && data[p + 2] >= limite;

// Preenche a partir das bordas: marca só o branco conectado à borda da foto.
const fundo = new Uint8Array(w * h);
const pilha = [];
const empurra = (x, y) => {
  const i = y * w + x;
  if (fundo[i] || !ehBranco(i * 4)) return;
  fundo[i] = 1;
  pilha.push(i);
};
for (let x = 0; x < w; x++) { empurra(x, 0); empurra(x, h - 1); }
for (let y = 0; y < h; y++) { empurra(0, y); empurra(w - 1, y); }
while (pilha.length) {
  const i = pilha.pop();
  const x = i % w, y = (i / w) | 0;
  if (x > 0) empurra(x - 1, y);
  if (x < w - 1) empurra(x + 1, y);
  if (y > 0) empurra(x, y - 1);
  if (y < h - 1) empurra(x, y + 1);
}

// Caixa do produto (tudo que não é fundo).
let x0 = w, y0 = h, x1 = -1, y1 = -1;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (fundo[y * w + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
if (x1 < 0) {
  console.error("A foto parece toda branca. Escolha outra imagem.");
  process.exit(1);
}

const fundoNaBorda = fundo.reduce((s, v) => s + v, 0) / (w * h);

if (modo === "solto") {
  for (let i = 0; i < w * h; i++) if (fundo[i]) data[i * 4 + 3] = 0;
}

const recorte = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
  .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  .png()
  .toBuffer();

if (modo === "solto") {
  await sharp(recorte)
    .resize(tamanho, tamanho, { fit: "inside", withoutEnlargement: false })
    .png()
    .toFile(saida);
} else {
  const util = Math.round(tamanho * 0.88);
  const produto = await sharp(recorte)
    .resize(util, util, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .toBuffer();
  await sharp({ create: { width: tamanho, height: tamanho, channels: 3, background: "#ffffff" } })
    .composite([{ input: produto, gravity: "center" }])
    .png()
    .toFile(saida);
}

console.log(JSON.stringify({
  saida,
  modo,
  original: `${w}x${h}`,
  produto: `${x1 - x0 + 1}x${y1 - y0 + 1}`,
  fundoBrancoRemovido: `${Math.round(fundoNaBorda * 100)}%`,
  aviso: fundoNaBorda < 0.05 ? "Quase não tinha fundo branco: confira se a foto serve (pode ter cenário atrás)." : undefined,
}));
