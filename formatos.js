// Os formatos do Editor Viral. Cada um aponta pra uma skill que já existe
// em ~/.claude/skills (o app só usa as skills, nunca altera).
// Campos: tipo texto | area | select | toggle | lista (vários campos com o mesmo rótulo).
// "dicas" vêm das regras de gravação de cada skill.

const FORMATOS = [
  {
    id: 'classificacao',
    nome: 'Classificação',
    frase: 'Ranking tipo Top 5 ou Top 10, com cada item indo pro lugar dele.',
    skill: 'agente-video-classificacao',
    videos: [{ slot: 'principal', rotulo: 'Seu vídeo', partes: 6 }],
    sons: true,
    campos: [
      { id: 'top', tipo: 'select', rotulo: 'É um Top quanto?', obrigatorio: true,
        opcoes: ['5', '6', '7', '8', '10'], padrao: '5' },
      { id: 'titulo', tipo: 'texto', rotulo: 'Título no topo',
        dica: 'Se deixar vazio, a gente cria pelo assunto.', exemplo: 'Os melhores leites condensados pra pudim' },
      { id: 'itens', tipo: 'lista', rotulo: 'Itens na ordem que você falou',
        dica: 'Opcional. Ajuda a acertar o nome das marcas.', tamanhoDe: 'top', rotuloItem: (n) => `${n}º lugar`, ordem: 'decrescente' },
      { id: 'imagens', tipo: 'select', rotulo: 'Como os itens aparecem',
        opcoes: ['Com foto, se der pra achar de todos', 'Só escrito com emoji'], padrao: 'Com foto, se der pra achar de todos' },
      { id: 'visual', tipo: 'texto', rotulo: 'Quer um visual diferente?',
        dica: 'Deixe vazio pro padrão: letra branca com contorno e top 3 em ouro, prata e bronze.' },
    ],
    dicas: [
      'Fale o nome do item e depois a posição. Ex: "Moça... esse vai pro quarto lugar".',
      'Deixe o lado esquerdo da tela livre: é lá que o ranking aparece.',
      'Faça uma ação simples do nicho enquanto fala (mexer a massa, mostrar o produto).',
      'Errou? Repita a frase inteira. A gente fica com a última versão boa.',
      'Peça pra seguir no meio do vídeo.',
    ],
  },
  {
    id: 'contraste',
    nome: 'Contraste',
    frase: 'Dois lados, tipo Indico x Não indico, com cada exemplo indo pro lado certo.',
    skill: 'agente-video-contraste',
    videos: [{ slot: 'principal', rotulo: 'Seu vídeo', partes: 6 }],
    sons: true,
    campos: [
      { id: 'titulo', tipo: 'texto', rotulo: 'Título no topo (o assunto)', exemplo: 'Leite condensado',
        dica: 'Se deixar vazio, a gente tira da sua fala.' },
      { id: 'ladoBom', tipo: 'texto', rotulo: 'Lado bom', exemplo: 'Indico' },
      { id: 'ladoRuim', tipo: 'texto', rotulo: 'Lado ruim', exemplo: 'Não indico' },
      { id: 'neutros', tipo: 'toggle', rotulo: 'Os dois lados são neutros (nenhum é bom ou ruim)', padrao: false },
      { id: 'exemplos', tipo: 'area', rotulo: 'Os exemplos, na ordem',
        dica: 'Opcional. Um por linha. Se você fala eles no vídeo, pode deixar vazio.' },
    ],
    dicas: [
      'Fale o exemplo, faça uma pausinha e depois dê o veredito.',
      'Arraste a mão pro lado do veredito, sempre o mesmo lado pra cada um.',
      'Deixe espaço acima da cabeça (título) e na altura do peito (etiquetas).',
      'Errou? Repita a frase inteira.',
    ],
  },
  {
    id: 'mao-de-vaca',
    nome: 'Mão de vaca',
    frase: 'Produto caro x produto barato, com foto e preço de cada um.',
    skill: 'agente-video-mao-de-vaca',
    videos: [{ slot: 'principal', rotulo: 'Seu vídeo', partes: 6 }],
    sons: true,
    campos: [
      { id: 'trocas', tipo: 'lista', rotulo: 'As 3 trocas (caro e barato)', tamanho: 3,
        rotuloItem: (n) => `Troca ${n}`, exemplo: 'Hollyland Lark M2 por Hollyland Lark A1',
        dica: 'Opcional. Se você fala no vídeo, pode deixar vazio.' },
      { id: 'precos', tipo: 'select', rotulo: 'Preços',
        opcoes: ['Eu falo os preços no vídeo', 'Pesquisa o preço pra mim'], padrao: 'Eu falo os preços no vídeo' },
      { id: 'foto', tipo: 'select', rotulo: 'Foto do produto',
        opcoes: ['Quadrado branco', 'Produto solto, sem fundo'], padrao: 'Quadrado branco' },
    ],
    dicas: [
      'Fique na metade de baixo da tela: os produtos aparecem em cima.',
      'Aponte pra cima: pro lado esquerdo no produto caro e pro direito no barato.',
      'Comece com "Tá sem dinheiro pra comprar esse...? Vai nesse."',
      'São 3 trocas por vídeo.',
    ],
  },
  {
    id: 'destampando',
    nome: 'Destampando',
    frase: 'NUNCA em vermelho x o certo em verde, com tarjas que somem conforme você fala.',
    skill: 'agente-video-destampando',
    videos: [{ slot: 'principal', rotulo: 'Seu vídeo', partes: 6 }],
    sons: true,
    campos: [
      { id: 'tipo', tipo: 'select', rotulo: 'Tipo de título',
        opcoes: ['Tira da minha fala', 'NUNCA DIGA / DIGA', 'NUNCA USE / USE', 'NUNCA FAÇA / FAÇA', 'NUNCA COMPRE / COMPRE'], padrao: 'Tira da minha fala' },
      { id: 'etiqueta', tipo: 'texto', rotulo: 'Etiqueta embaixo do título', exemplo: 'Versão vendas',
        dica: 'Opcional. Se deixar vazio, fica sem.' },
      { id: 'pares', tipo: 'area', rotulo: 'Os pares (errado e certo)',
        dica: 'Opcional. Um por linha, ex: "Orçamento > Proposta".' },
    ],
    dicas: [
      'Comece com "Nunca diga X. Diga Y."',
      'Fale cada par: primeiro o errado, depois o certo.',
      'Rosto na parte de cima da tela, peito livre: o quadro aparece ali.',
      'De 4 a 6 pares.',
    ],
  },
  {
    id: 'problema-solucao',
    nome: 'Problema e solução',
    frase: 'Você duas vezes na tela: o jeito errado de um lado e o certo do outro.',
    skill: 'agente-video-problema-solucao',
    videos: [
      { slot: 'errado', rotulo: 'Vídeo do lado errado (você na esquerda)' },
      { slot: 'certo', rotulo: 'Vídeo do lado certo (você na direita)' },
    ],
    sons: false,
    campos: [
      { id: 'papelErrado', tipo: 'texto', rotulo: 'Nome do lado errado', exemplo: 'Amador' },
      { id: 'papelCerto', tipo: 'texto', rotulo: 'Nome do lado certo', exemplo: 'Vendedor' },
      { id: 'roteiro', tipo: 'area', rotulo: 'O roteiro (as falas em pares)',
        dica: 'Opcional. Se deixar vazio, a gente tira da sua fala.' },
      { id: 'legenda', tipo: 'toggle', rotulo: 'Legenda da fala no meio da tela', padrao: true },
    ],
    dicas: [
      'Celular no tripé, parado, no mesmo lugar nos dois vídeos.',
      'Vídeo 1: você no lado esquerdo, falando as frases do lado errado.',
      'Vídeo 2: você no lado direito, falando as frases do lado certo.',
      'Uma pausa entre uma frase e outra.',
      'No último par, o lado certo pede pra seguir.',
    ],
  },
  {
    id: 'avaliacao',
    nome: 'Avaliação',
    frase: 'Produtos numa escala verde, amarelo e vermelho, com o porquê de cada um.',
    skill: 'agente-video-avaliacao',
    videos: [{ slot: 'principal', rotulo: 'Seu vídeo', partes: 6 }],
    sons: true,
    campos: [
      { id: 'titulo', tipo: 'texto', rotulo: 'Título no topo (a categoria)', exemplo: 'Sabonetes líquidos para crianças',
        dica: 'Se deixar vazio, a gente tira da sua fala.' },
      { id: 'niveis', tipo: 'lista', rotulo: 'Nomes dos 3 níveis', tamanho: 3,
        rotuloItem: (n) => ['Verde (melhor)', 'Amarelo (meio)', 'Vermelho (pior)'][n - 1],
        exemplos: ['Ótimo', 'Bom', 'Ruim'], ordem: 'crescente', dica: 'Opcional. Se deixar vazio, a gente tira da sua fala.' },
      { id: 'produtos', tipo: 'area', rotulo: 'Os produtos e a nota de cada um',
        dica: 'Opcional. Um por linha, ex: "Granado bebê: ótimo".' },
    ],
    dicas: [
      'Diga a nota em voz alta: "esse é ótimo", "esse é ruim".',
      'Explique o porquê de cada produto: é o que segura o público.',
      'Deixe espaço acima da cabeça ou no lado esquerdo da tela.',
      'Pode fazer várias rodadas no mesmo vídeo (ex: microfones, depois suportes).',
    ],
  },
];

// Em pausa: a edição magnética gasta muito token (cada vídeo é diferente). Pra voltar, mova o item pra lista FORMATOS
// e a skill de .claude/skills-em-pausa de volta pra .claude/skills.
const EM_PAUSA = [
  {
    id: 'edicao-magnetica',
    nome: 'Edição magnética',
    frase: 'Você falando pra câmera, com cortes rápidos, zoom, legenda e efeitos que prendem.',
    skill: 'agente-video-edicao-magnetica',
    videos: [{ slot: 'principal', rotulo: 'Seu vídeo', partes: 6 }],
    sons: true,
    campos: [
      { id: 'legenda', tipo: 'toggle', rotulo: 'Legenda dinâmica', padrao: true },
      { id: 'zoom', tipo: 'select', rotulo: 'Força dos zooms', opcoes: ['Leve', 'Médio', 'Forte'], padrao: 'Médio' },
      { id: 'emojis', tipo: 'toggle', rotulo: 'Emojis e imagens de apoio', padrao: true },
    ],
    dicas: [
      'Comece direto na frase mais forte: é ela que prende nos 3 primeiros segundos.',
      'Fale olhando pra câmera, com o rosto bem enquadrado.',
      'Errou? Repita a frase. A gente fica com a última versão boa.',
      'Peça pra seguir, comentar ou salvar no fim.',
    ],
  },
];

// Versão pra mandar pro navegador (sem funções).
function formatosPublicos() {
  return FORMATOS.map((f) => ({
    id: f.id, nome: f.nome, frase: f.frase, videos: f.videos, sons: f.sons, dicas: f.dicas,
    campos: f.campos.map((c) => {
      const out = { ...c };
      if (typeof c.rotuloItem === 'function') {
        const n = c.tamanho || 10;
        out.rotulos = Array.from({ length: n }, (_, i) => c.rotuloItem(i + 1));
      }
      delete out.rotuloItem;
      return out;
    }),
  }));
}

module.exports = { FORMATOS, formatosPublicos };
