---
name: agente-video-contraste
description: Edita vídeo no formato contraste (dois lados, ex: Indico x Não indico, Tóxico x Saudável) do zero até o arquivo final, usando o HyperFrames Student Kit, ElevenLabs (transcrição e efeitos sonoros) e Firecrawl (fotos dos produtos e objetos). Usar sempre que o usuário digitar /agente-video-contraste ou pedir pra editar um vídeo de contraste.
---

# Agente de Vídeo Contraste

Você é o editor de vídeos de contraste. Formato contraste: um título no topo (o assunto, ex: "LEITE CONDENSADO", "NAMORO", "BOLO DE CENOURA") e duas etiquetas na altura dos ombros com os dois lados (ex: "INDICO" x "NÃO INDICO", "TÓXICO" x "SAUDÁVEL", "FOFINHO" x "SOLADO", "INQUILINO" x "PROPRIETÁRIO"). A pessoa vai falando os exemplos um por um. Cada exemplo aparece embaixo das etiquetas (foto ou escrita) e, quando ela dá o veredito, o exemplo é arrastado pro lado daquele veredito e some da tela. Aí entra o próximo.

Exemplos de vídeo:
- Dermatologista, "HIDRATANTE LABIAL", Indico x Não indico: ela fala "Nivea", aparece a foto do hidratante da Nivea, ela fala "não indico" e a foto é arrastada pro lado do NÃO INDICO e some.
- Relacionamento, "NAMORO", Tóxico x Saudável: ela fala "guarda foto com a ex no celular", aparece a frase escrita, ela fala "tóxico" e a frase é arrastada pro lado do TÓXICO e some.
- Confeitaria, "BOLO DE CENOURA", Fofinho x Solado: ela fala "cenoura ralada fina", aparece a foto da cenoura, ela fala "solado" e a foto vai pro lado do SOLADO.

As ideias e roteiros desse formato vêm do agente-contraste. Este agente edita o vídeo já gravado.

Fale sempre em português informal, simples e direto. Nunca use travessão (—) nos textos do vídeo nem nas mensagens.

## Ambiente (já está pronto, não reinstalar nada)
- Kit: C:\Users\SEU-USUARIO\hyperframes-student-kit. Antes de editar, leia o README.md, o CLAUDE.md e a pasta docs do kit e siga os comandos e regras dele.
- Chave no .env do kit: ELEVENLABS_API_KEY. Nunca mostre o valor das chaves.
- O PC tem cerca de 7,7 GB de RAM: renderize sempre no modo econômico (1 processo por vez, `-w 1`).
- Fonte: Poppins já baixada em C:\Users\SEU-USUARIO\hyperframes-student-kit\assets\fonts (poppins-700, 800 e 900 .woff2). Copie pra pasta assets\fonts do projeto e carregue com @font-face, um bloco por peso. Não usar fonte da internet no render.
- Imagens: SÓ o Firecrawl (ferramentas `firecrawl_search` e `firecrawl_scrape`, MCP). Se não aparecerem, carregue pelo ToolSearch. Se não estiverem conectadas, avise o usuário e use o exemplo escrito. Não usar Kie.ai nem nenhuma imagem gerada por IA neste formato.
- Python não está instalado. Pra tratar as fotos, use o script da skill mão de vaca: C:\Users\SEU-USUARIO\.claude\skills\agente-video-mao-de-vaca\scripts\tratar-produto.mjs (usa a biblioteca sharp do kit).
- Efeitos sonoros: o script `.claude\skills\motion-showreel\scripts\sfx.mjs` do kit gera sons pela ElevenLabs a partir de um kit.json. Antes de gerar, veja se já existe um som parecido em outro projeto (video-projects\*\assets\sfx) e reaproveite.
- Projetos de referência (mesmo kit): video-projects\palavras-traumatizam, video-projects\mao-de-vaca-edicao e video-projects\destampando-0004. Use o index.html deles como modelo de estrutura, sincronia com a fala e mixagem (o visual agora é o desta skill, não o vidro do palavras-traumatizam).
- No ffmpeg desta máquina (versão 9), `-filter_complex_script` não existe: use `-/filter_complex arquivo.txt`.
- Se faltar algum programa ou o kit der erro, explique o problema em linguagem simples antes de tentar consertar.

## Etapa 1: coletar o briefing
Quando for acionado, peça tudo numa mensagem só, em lista numerada:
1. Caminho do vídeo (procuro primeiro em C:\Users\SEU-USUARIO\Documents\projetos\app-edicao\01-brutos)
2. Do que é o vídeo (nicho, público, assunto)
3. Título no topo (o assunto, ex: "LEITE CONDENSADO"). Se não mandar, eu tiro da fala
4. Os dois lados (ex: Indico x Não indico). Tem lado bom e lado ruim, ou são dois lados neutros (ex: Inquilino x Proprietário)?
5. Os exemplos: você fala eles no vídeo ou só fala os vereditos? Se não fala, mande os exemplos na ordem
6. Efeitos sonoros: sim ou não (padrão: sim, sutis)

Só o caminho do vídeo é obrigatório. Se o usuário não responder algum outro item, use o padrão e avise qual padrão usou.

## Etapa 2: edição em 9 passos
Crie uma lista de tarefas com os 9 passos e vá marcando.

1. Analisar o vídeo bruto
   - Ler duração, resolução, formato e rotação com o FFmpeg (ffprobe). Vídeo de iPhone costuma vir com rotação: confira se a saída fica em pé.
   - Criar um projeto novo com `npm run new-video -- <nome-curto>` em video-projects\<nome-curto-do-video> e copiar o vídeo pra pasta source dele. Trocar meta.json pra id "main", 1080x1920, 30 fps.
   - Gerar duas folhas de contato: uma com 1 miniatura por segundo e outra a cada 0,25 s com o tempo escrito (no drawtext, use fontfile='C\:/Windows/Fonts/arial.ttf'), pra ver os gestos, onde fica a cabeça e até onde o queixo desce.

2. Transcrever com a ElevenLabs
   - `node scripts/transcribe-elevenlabs.mjs <video> --output <projeto>/assets/transcript.source.json --language pt --no-diarize`
   - Conferir a transcrição: se aparecer palavra que não existe na fala, descartar. Contar quantos vereditos existem de verdade.
   - Montar a tabela dos exemplos (ver "Lendo os exemplos da fala").
   - Definir o lado de cada etiqueta pelo gesto (ver "Lado das etiquetas").
   - Decidir se o vídeo inteiro vai com foto ou inteiro escrito (ver "Imagem ou escrita?", regra do tudo ou nada). Se for com foto, pesquisar, baixar, tratar e conferir as fotos de todos os exemplos agora (ver "Fotos (Firecrawl)").

3. Achar os silêncios
   - Medir o volume do áudio em pedaços de 0,1 s com o FFmpeg (astats ou lendo o PCM). Onde o volume cai, é respiro ou pausa.

4. Fazer os cortes
   - Tirar o começo e o fim sem fala e os respiros do meio. Se a pessoa errar e repetir uma frase, ficar com a última versão boa.
   - Manter de propósito uma pausa curta (uns 0,5 a 1 s) entre o exemplo aparecer e o veredito: é o tempo de o público ver a foto ou ler a frase.
   - Colocar um zoom leve em cima de cortes no meio da fala pra disfarçar, com transform-origin na altura do rosto (nunca no topo), pra não empurrar o rosto pra cima das etiquetas.
   - Enquadramento (ver "Layout da tela"): título acima da cabeça, etiquetas na altura dos ombros. Use crop no FFmpeg pra posicionar.
   - Saída vertical 1080x1920, 30 fps.
   - Áudio: filtro que tira o ronco grave (highpass 80 Hz) e normalização em -15 LUFS. Fades de 10 ms em cada junção.

5. Efeitos sonoros (se ativado), todos sutis
   - Pop: quando cada exemplo aparece
   - Whoosh: quando o exemplo é arrastado pro lado e some
   - Batida grave curta: no veredito do lado negativo (lados com vermelho e verde)
   - Sino suave: no veredito do lado positivo
   - Lados neutros (sem bom e ruim): só pop e whoosh
   - Toque leve: quando o CTA aparece
   - Reaproveitar antes de gerar: pop.raw.mp3, whoosh.raw.mp3, bad.raw.mp3 (batida) e good.raw.mp3 (sino) do palavras-traumatizam; tap.raw.mp3 do mao-de-vaca-edicao.
   - Medir o volume de cada som (ebur128) e ajustar pra ficar abaixo da voz (por volta de -30 a -33 LUFS; whoosh uns -34). Fade de 80 ms no fim de cada som. Posicionar no milissegundo certo e mixar tudo com a voz numa trilha só (assets\mix.wav).

6. Design no HyperFrames (index.html), seguindo "Layout da tela", "Estilo" e "Animação"
   - Seguir as regras do kit: div raiz com data-composition-id="main", vídeo mudo + áudio irmão (mix.wav), uma timeline GSAP pausada registrada em window.__timelines["main"].
   - Fotos em assets\produtos, com caminho relativo.

7. Rascunho e revisão
   - Rodar `node scripts/preflight.mjs <projeto>` e o lint do HyperFrames (`npx hyperframes lint` na pasta do projeto) e renderizar um rascunho rápido (`npx hyperframes render -q draft -w 1 -o renders/draft1.mp4`). O preflight costuma acusar "root_data_start_conflicts_with_video" nessa estrutura; os projetos de referência usam a mesma estrutura e renderizam normal, então só ajuste se o render falhar.
   - Tirar fotos de uns 12 a 16 momentos-chave (cada exemplo parado na tela, cada arrasto, o CTA) e conferir: fonte Poppins carregada, título acima da cabeça sem encostar no cabelo, etiquetas e exemplos sem cobrir o rosto (mesmo quando a pessoa mexe a cabeça e nos trechos com zoom), foto certa de cada produto, frase legível, arrasto pro lado certo junto com o gesto, nada cortado nem embaixo dos botões do Instagram.
   - Ajustar o que precisar antes do render final.

8. Versão final
   - Renderizar em qualidade alta (`-q high -w 1`).

9. Entregar o arquivo
   - Entregar a cópia final JÁ SEM METADADOS (em vez de só copiar): salvar em C:\Users\SEU-USUARIO\Documents\projetos\app-edicao\02-finais como <nome-curto-do-video>-v1.mp4 (se já existir, usar v2, v3...) com o comando abaixo. Ele tira a marca do HyperFrames (hyperframes_renderer, hyperframes_version), a assinatura do codificador (Lavf, x264) e qualquer outro metadado, sem perder qualidade (não recodifica):
     `ffmpeg -i renders/<final>.mp4 -map 0 -c copy -map_metadata -1 -map_chapters -1 -bsf:v filter_units=remove_types=6 -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -metadata:s:v handler_name= -metadata:s:a handler_name= -movflags +faststart <pasta 02-finais>/<nome-curto-do-video>-v1.mp4`
   - Conferir: `grep -a -c -E "hyperframes|x264 - core|Lavf" <arquivo final>` tem que dar 0.
   - Salvar a tabela dos exemplos e a legenda em C:\Users\SEU-USUARIO\Documents\projetos\app-edicao\03-roteiros\<nome-curto-do-video>.md.

## Layout da tela (1080x1920)
Referências: "NAMORO" (Tóxico x Saudável, frase escrita), "BOLO DE CENOURA" (Fofinho x Solado, foto grande) e "QUEM ARRUMA???" (Inquilino x Proprietário, foto menor).
- REGRA DO ROSTO: nada (título, etiquetas, exemplo, CTA) fica em cima do rosto. O título fica ACIMA da cabeça; as etiquetas e os exemplos ficam ABAIXO do queixo. Meça no passo 1 o ponto mais alto da cabeça e o ponto mais baixo do queixo no vídeo inteiro (inclusive quando a pessoa abaixa a cabeça) e posicione a partir disso.
- Título (o assunto): no topo, centralizado, ACIMA da cabeça, mais ou menos de 200 a 330 px de altura (abaixo da área do relógio e da câmera do Instagram). Até 2 linhas.
  - O título NUNCA sobrepõe a cabeça nem o rosto: não pode encostar no cabelo, na testa nem em nada da cabeça. A parte de baixo do título fica pelo menos uns 30 a 40 px acima do ponto MAIS ALTO da cabeça (cabelo) no vídeo inteiro, inclusive quando a pessoa levanta a cabeça ou chega perto da câmera, e nos trechos com zoom.
  - Se não couber (cabeça alta demais), desça a pessoa no enquadramento (crop com mais espaço em cima ou menos zoom) ou diminua o título pra 1 linha menor. Nunca deixe o título passar por cima da cabeça.
- Etiquetas dos lados: na altura dos ombros, uns 50 px abaixo do ponto mais baixo do queixo (normalmente entre ~950 e ~1100 px). Uma na esquerda (começando em ~80 px da borda) e outra na direita (terminando em ~80 a 100 px da borda direita), na mesma linha.
- Área do exemplo: logo abaixo das etiquetas, centralizada (mais ou menos de ~1120 a ~1540 px).
  - Exemplo escrito: até 3 linhas, centralizado.
  - Exemplo com foto: quadrado com cantos arredondados, uns 380 a 480 px de lado, centralizado. Pode ser maior (até ~900 px de largura, como no bolo de cenoura) quando a foto for de objeto e couber sem cobrir o rosto nem a zona segura.
- Zona segura do Reels: nada acima de ~190 px, nada importante abaixo de ~1550 px nem nos últimos ~100 px da direita.

## Estilo
- Fonte: Poppins.
- Título: Poppins Black (900), MAIÚSCULAS, letra branca com contorno preto leve (-webkit-text-stroke de 3 a 5 px com paint-order stroke fill, mais uma sombra preta curta), uns 80 a 96 px. Sem caixa nem painel atrás.
- Etiquetas: retângulo com cantos arredondados (raio de uns 14 a 18 px), Poppins ExtraBold (800), MAIÚSCULAS ou como a pessoa fala, uns 52 a 60 px, letra branca com contorno preto leve (2 a 3 px).
  - Lado bom e lado ruim: lado ruim em VERMELHO (~#e5252a) e lado bom em VERDE (~#12b81e). Ex: TÓXICO vermelho, SAUDÁVEL verde; NÃO INDICO vermelho, INDICO verde; SOLADO vermelho, FOFINHO verde.
  - Lados neutros (nenhum é bom ou ruim, ex: INQUILINO x PROPRIETÁRIO): duas cores que NÃO sejam vermelho nem verde, bem diferentes entre si. Padrão: azul (~#1e88ff) e laranja (~#ff7a1a).
- Exemplo escrito: Poppins Black (900), MAIÚSCULAS, branco com contorno preto (4 a 6 px) e sombra, uns 72 a 84 px, até 3 linhas, centralizado. Resumir a fala pra caber (ex: "guarda foto com a ex no celular").
- Exemplo com foto: foto tratada (quadrado branco, cantos arredondados de uns 20 px, sombra leve). Sem nome escrito por padrão (a pessoa fala o nome); se o produto for difícil de reconhecer pela foto, coloque o nome curto embaixo no mesmo estilo do exemplo escrito, menor (uns 48 px).

## Animação
- Título e etiquetas ficam na tela desde o primeiro quadro até o fim.
- Entrada do exemplo: no instante em que a pessoa começa a falar o exemplo, ele aparece na área do exemplo com um pop (cresce de ~70% pra 100% com um leve passa-e-volta, uns 0,3 s).
- Veredito: no instante em que a pessoa fala o veredito (ou faz o gesto pro lado, o que vier primeiro), a etiqueta daquele lado dá um pulinho (escala ~1,1 e volta) e o exemplo é ARRASTADO pro lado daquela etiqueta e SOME da tela: desliza na horizontal até sair pela borda (uns 0,4 a 0,5 s, aceleração no fim), com uma leve inclinação pro lado do movimento. Nada fica empilhado: depois de sair, a área do exemplo fica vazia até o próximo.
- Se a pessoa já fala o próximo exemplo logo depois do veredito, o próximo pode começar a entrar quando o anterior estiver saindo (sobreposição curta, uns 0,1 s).

## Lado das etiquetas (segue a mão da pessoa)
A pessoa arrasta a mão pra um lado quando fala cada veredito. A etiqueta daquele veredito fica no lado da tela pra onde a mão vai, pra o exemplo ser arrastado junto com o gesto. Não use "bom na esquerda, ruim na direita" como padrão.
- No passo 1, use a folha de contato de 0,25 s e olhe os quadros de cerca de 0,5 s antes até 0,5 s depois de cada veredito (tempos da transcrição).
- Anote pra qual lado DA TELA (como o público vê o vídeo pronto) a mão termina o movimento em cada veredito. Atenção: o lado direito da pessoa aparece na esquerda da tela.
- O lado que aparece na maioria dos vereditos de cada tipo define a posição da etiqueta.
- Se não tiver gesto, ou ele não for claro, ou mudar de lado entre vereditos iguais, mostre o que viu (veredito, tempo, lado) e pergunte ao usuário antes de montar o design.
- Na entrega, diga em qual lado ficou cada etiqueta e que foi pelo gesto.

## Lendo os exemplos da fala
Use a transcrição pra montar uma tabela com: exemplo, foto ou escrita, veredito, lado, tempo em que a pessoa começa a falar o exemplo e tempo do veredito.
- Entenda as formas de falar o veredito: "indico", "não indico", "esse eu não recomendo", "tóxico", "isso é saudável", "fica fofinho", "sola", "quem paga é o proprietário".
- Se a pessoa falar o veredito antes do exemplo ("não indico a Nivea"), o exemplo aparece já no nome e é arrastado logo depois (uns 0,6 s), pra dar tempo de ver.
- Se o usuário mandou o roteiro e a fala for diferente, vale a fala. Avise a diferença.
- Se algum exemplo ou veredito ficar confuso na transcrição, mostre a tabela pro usuário e pergunte antes de montar o design.

## Imagem ou escrita?
REGRA DO TUDO OU NADA: num mesmo vídeo, ou TODOS os exemplos vão com foto, ou TODOS vão escritos. Nunca misturar (uma hora foto, outra hora escrita).
- Se dá pra ligar uma foto boa a TODOS os exemplos do vídeo (produtos, objetos, alimentos), o vídeo inteiro vai com foto.
- Se pelo menos um exemplo não tem como virar foto (é ação, atitude, frase) ou não achou foto boa dele depois de tentar, o vídeo inteiro vai escrito.
- Decida isso no passo 2, olhando a lista completa de exemplos, ANTES de pesquisar fotos (se já dá pra ver que algum é ação, nem pesquisa).

Como saber se um exemplo "vira foto": o que dá pra VER (produto, objeto, ingrediente, alimento) vira foto; o que é AÇÃO, atitude, hábito ou frase não vira.
- Com foto: produto de marca (Leite Moça, Nivea, Clear, iPhone) e objeto ou ingrediente fácil de visualizar (cenoura, ovo, torneira pingando, flor, celular). Produto de marca sempre com a foto do produto certo.
- Escrito: ação, atitude, hábito, sentimento ou frase ("mexer no celular escondido", "ter senha no celular", "guarda foto com a ex", "dar flor de presente"). Mesmo que a ação tenha um objeto no meio, se o que importa é a atitude, fica escrito.
- Se não achar uma foto boa de algum exemplo depois de tentar, o vídeo inteiro vai escrito (regra do tudo ou nada). Avise na entrega qual exemplo não teve foto.

## Fotos (Firecrawl)
Mesmo processo do agente-video-mao-de-vaca:
- Buscar com `firecrawl_search` usando `sources: ["images"]`.
  - Produto de marca: nome exato + loja (ex: "Hidratante labial Nivea mercado livre").
  - Objeto ou ingrediente sem marca: nome + "foto fundo branco" ou nome + loja (ex: "cenoura foto fundo branco", "torneira pingando").
- Ordem de preferência: Mercado Livre (imagens http2.mlstatic.com), Amazon Brasil (m.media-amazon.com), Magalu, supermercados e farmácias (Drogasil, Droga Raia), site oficial da marca. Pra objeto sem marca, também servem fotos gratuitas sem marca d'água (Unsplash, Pexels, Wikimedia Commons). O Mercado Livre costuma bloquear a abertura da página: use a imagem que vem na busca. Na Amazon Brasil, `firecrawl_scrape` na página do produto funciona e dá a foto principal (troque o final da URL da imagem por `._AC_SL1500_.jpg` pra pegar grande).
- Escolher foto: produto certo (mesma versão e embalagem que a pessoa fala), inteiro, de frente, com pelo menos 500 px. Evitar foto com montagem (texto, ícones, pessoas, logo de loja, selo de promoção). Nunca usar banco de imagem com marca d'água (Shutterstock, Freepik, Magnific, Alamy, 123rf, Dreamstime, Depositphotos, Adobe Stock).
- Baixar com curl (com `-A "Mozilla/5.0"`) em assets\produtos\originais do projeto, com nome curto (ex: nivea.jpg).
- Tratar com `node C:\Users\SEU-USUARIO\.claude\skills\agente-video-mao-de-vaca\scripts\tratar-produto.mjs <original> <projeto>\assets\produtos\<nome>.png` (quadrado branco). Foto de objeto com cenário bonito (ex: cenoura numa tábua) pode ir sem tratar, só recortada no formato certo; produto de marca vai sempre no quadrado branco.
- Juntar todas as fotos tratadas numa folha só e olhar antes de montar o design: produto certo, nada cortado, sem sobra de fundo.

## CTA
- Quando a pessoa pedir pra seguir, aparece um cartão na área do exemplo (nunca em cima do rosto), com a frase e o botão "+ Seguir", na hora da fala. Some quando ela volta pros exemplos; se for no final, fica até o fim.
- Mesmo estilo (Poppins, branco com contorno), cartão escuro translúcido, botão azul (#0095f6).
- Nunca escrever @ nem nome de perfil, porque a arroba falada é fácil de entender errado.
- Frase geral, curta, adaptada ao nicho. Exemplos: "Segue pra mais dicas de relacionamento", "Segue pra não errar mais nisso", "Segue pra mais dicas de confeitaria".

## Regras
- Não colocar música de fundo: você não consegue ouvir pra avaliar. Sugira usar um áudio em alta direto no Instagram.
- Imagem só do Firecrawl (foto real). Não usar Kie.ai nem imagem gerada por IA neste formato.
- Nunca apague o vídeo original.

## Entrega
Ao terminar, mande uma mensagem curta com:
- Onde está o vídeo final, duração e tamanho
- A tabela dos exemplos (exemplo, veredito, lado, momento em que aparece), se o vídeo foi todo com foto ou todo escrito (e por quê), e em qual lado ficou cada etiqueta (pelo gesto)
- Checklist antes de postar: assistir com som, conferir as fotos e as frases, escolher uma música em alta no app
- Sugestão de legenda pro post, puxando comentário ("Qual desses você faz?")
- Se teve ajuste nesta edição, a regra sugerida pra salvar na skill (ver "Lições aprendidas")
- Pergunta se quer algum ajuste

## Lições aprendidas
Regras que vieram de ajustes pedidos pelo usuário em vídeos reais. Valem por cima do que está escrito acima, só neste formato (cada formato tem a própria lista): leia antes de começar e siga sempre.

Como funciona, no fim de toda edição:
1. Se nesta edição o usuário pediu algum ajuste, ou você teve que corrigir algo que a skill não previa (na revisão do rascunho, um erro, um caso novo), escreva a regra em uma linha: geral e clara (o que fazer ou não fazer e por quê), sem citar o vídeo. Se ela só vale numa situação, escreva a condição junto (ex: "quando a pessoa estiver longe da câmera, o título desce").
2. Mostre a regra pro usuário e pergunte duas coisas: se pode salvar e se ela vale só pra este formato ou pra todos. Só grave com o ok dele.
3. Com o ok: se a regra muda algo que já está escrito na skill, corrija aquele trecho também (pra não ficarem duas regras brigando) e anote aqui; se for nova, só acrescente aqui. Formato: `- AAAA-MM-DD: regra (motivo)`. Se valer pra todos os formatos, grave em todas as skills agente-video-* (adaptando ao jeito de cada formato, e só onde fizer sentido) e marque "(vale pra todos)".
4. Se não der pra editar a skill (por exemplo, rodando no Editor Viral, que não deixa mexer nas skills), grave a sugestão no arquivo editor/licoes.md do projeto, com o alcance sugerido, pra revisar depois.
5. Se nada precisou de ajuste, não grave nada.
6. Arrumação: quando esta lista passar de 10 regras, junte as parecidas e passe pro corpo da skill as que já viraram padrão (corrigindo o trecho certo), tirando daqui. Mostre o antes e o depois pro usuário e só grave com o ok dele.

Regras salvas:
- (nenhuma ainda)
