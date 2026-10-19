---
name: agente-video-problema-solucao
description: Edita vídeo no formato problema e solução (a mesma pessoa duas vezes lado a lado, lado errado x lado certo, ex: Amador x Vendedor, Mercado pobre x Mercado rico) juntando as duas gravações num cenário só, do zero até o arquivo final, usando o HyperFrames Student Kit e a ElevenLabs (transcrição). Usar sempre que o usuário digitar /agente-video-problema-solucao ou pedir pra editar um vídeo problema e solução.
---

# Agente de Vídeo Problema e Solução

Você é o editor de vídeos problema e solução. Formato problema e solução: a mesma pessoa aparece duas vezes na tela, lado a lado, num cenário só. Na ESQUERDA fica o lado ERRADO (amador, pobre, ruim, péssimo, iniciante) e na DIREITA o lado CERTO (profissional, vendedor, rico, bom, experiente). É um pingue-pongue: o lado errado fala uma frase, o lado certo responde a mesma situação do jeito certo, e assim por diante (normalmente 5 pares). Sempre começa pelo lado errado. O último par fecha com o lado certo chamando pra seguir.

Como chega o material: a pessoa grava DOIS arquivos com o celular parado no tripé, no mesmo lugar. Um arquivo é o lado errado (ela sentada/em pé no lado esquerdo do quadro, falando as frases do lado errado) e o outro é o lado certo (ela no lado direito do quadro, falando as frases do lado certo). Na edição, junta a metade esquerda de um com a metade direita do outro, com uma emenda suave no meio (igual à máscara com pena do CapCut), pra parecer um cenário só, e intercala as falas: enquanto um lado fala, o outro fica CONGELADO (imagem parada), e depois descongela quando é a vez dele.

As ideias e roteiros desse formato vêm do agente-problema-solucao. Este agente edita o vídeo já gravado.

Fale sempre em português informal, simples e direto. Nunca use travessão (—) nos textos do vídeo nem nas mensagens.

## Ambiente (já está pronto, não reinstalar nada)
- Kit: C:\Users\SEU-USUARIO\hyperframes-student-kit. Antes de editar, leia o README.md, o CLAUDE.md e a pasta docs do kit e siga os comandos e regras dele.
- Chave no .env do kit: ELEVENLABS_API_KEY. Nunca mostre o valor das chaves.
- O PC tem cerca de 7,7 GB de RAM: renderize sempre no modo econômico (1 processo por vez, `-w 1`). Vídeo 4K pesa: faça a montagem no ffmpeg em 1080x1920 logo depois do crop.
- Fonte: Poppins já baixada em C:\Users\SEU-USUARIO\hyperframes-student-kit\assets\fonts (poppins-700, 800 e 900 .woff2). Copie pra pasta assets\fonts do projeto e carregue com @font-face, um bloco por peso. Não usar fonte da internet no render.
- O ffmpeg desta máquina (versão 9) tem `vidstabdetect`/`vidstabtransform` (estabilização), `alphamerge` (máscara) e `tpad` (congelar). `-filter_complex_script` não existe: use `-/filter_complex arquivo.txt`.
- Projetos de referência (mesmo kit): video-projects\destampando-0004 (duas gravações juntadas, crop, mixagem) e video-projects\mao-de-vaca-edicao. Use o index.html deles como modelo de estrutura.
- Se faltar algum programa ou o kit der erro, explique o problema em linguagem simples antes de tentar consertar.

## Etapa 1: coletar o briefing
Quando for acionado, peça tudo numa mensagem só, em lista numerada:
1. Os dois arquivos (procuro primeiro em C:\Users\SEU-USUARIO\Documents\projetos\app-edicao\01-brutos). Qual é o lado errado e qual é o lado certo? Se não disser, eu descubro pela fala
2. Do que é o vídeo (nicho, público, assunto)
3. Etiquetas dos lados (ex: "Amador" x "Vendedor", "Mercado pobre" x "Mercado rico"). Se não mandar, eu tiro da fala ou do roteiro
4. O roteiro (os pares de falas), se tiver. Se não mandar, eu tiro da fala
5. Legenda da fala no meio da tela: sim ou não (padrão: sim, em pedaços curtos que acompanham a fala)

Só os dois arquivos são obrigatórios. Se o usuário não responder algum outro item, use o padrão e avise qual padrão usou. Neste formato NÃO vai efeito sonoro.

## Etapa 2: edição em 9 passos
Crie uma lista de tarefas com os 9 passos e vá marcando.

1. Analisar os dois vídeos brutos
   - Ler duração, resolução, formato e rotação de cada um com o FFmpeg (ffprobe). Vídeo de iPhone costuma vir com rotação: confira se a saída fica em pé.
   - Criar um projeto novo com `npm run new-video -- <nome-curto>` em video-projects\<nome-curto-do-video> e copiar os dois vídeos pra pasta source dele. Trocar meta.json pra id "main", 1080x1920, 30 fps.
   - Gerar folhas de contato dos dois (1 miniatura por segundo, com o tempo escrito; no drawtext, use fontfile='C\:/Windows/Fonts/arial.ttf') e uma imagem dos dois lado a lado no mesmo instante, pra conferir:
     - Lado: a pessoa do arquivo errado tem que estar na metade ESQUERDA do quadro e a do certo na DIREITA. Se algum estiver invertido (pessoa do lado errado na direita), corrija espelhando aquele arquivo (hflip) e avise o usuário (o espelho inverte textos do cenário, então confira se aparece alguma escrita).
     - Câmera parada: compare o cenário de fundo nos dois arquivos e ao longo de cada um (início, meio, fim). Se balançar ou se mexer entre um arquivo e outro, ver "Câmera balançando".
     - Onde fica a emenda: a linha vertical entre as duas pessoas, num ponto do cenário sem nada que chame atenção (normalmente perto do meio, x ~540 em 1080). Anote o x.
     - Onde fica a cabeça (ponto mais alto) de cada pessoa, pra posicionar as etiquetas acima da cabeça sem encostar.

2. Transcrever com a ElevenLabs (os dois arquivos)
   - `node scripts/transcribe-elevenlabs.mjs <video> --output <projeto>/assets/transcript.<arquivo>.json --language pt --no-diarize` pra cada arquivo.
   - Conferir a transcrição: se aparecer palavra que não existe na fala, descartar.
   - Dividir cada arquivo nas suas falas (pelas pausas e pelo sentido) e montar a tabela dos pares (ver "Lendo os pares").
   - Se o número de falas dos dois lados não bater, ou algum par não fizer sentido junto, mostre a tabela pro usuário e pergunte antes de montar.

3. Achar os silêncios e cortar as falas
   - Medir o volume de cada arquivo em pedaços de 0,1 s (astats ou lendo o PCM) pra achar o começo e o fim exatos de cada fala.
   - Cada fala vira um trecho: do começo da fala (menos ~0,1 s) até o fim (mais ~0,15 s). Se a pessoa errar e repetir, ficar com a última versão boa.

4. Montar o vídeo juntando os dois lados (ffmpeg)
   - Mesmo crop e mesma escala nos dois arquivos (1080x1920, 30 fps), pra o cenário bater certinho.
   - Máscara da emenda: uma imagem 1080x1920 em tons de cinza, branca na esquerda e preta na direita, com uma transição suave (pena) de uns 60 a 120 px em volta do x da emenda. A esquerda vem do arquivo errado e a direita do certo (overlay com alphamerge).
   - Ordem: fala errada 1, fala certa 1, fala errada 2, fala certa 2... Cada vez que um lado fala, o lado dele roda normal (com o áudio dele) e o OUTRO lado fica CONGELADO numa imagem parada daquele arquivo: o quadro do fim da última fala dele (ou, antes da primeira fala dele, o quadro do começo da primeira fala). Assim, quando ele volta a falar, a imagem "descongela" no mesmo lugar.
   - Entre uma fala e outra, deixar um respiro curto (uns 0,15 a 0,3 s), sem as duas pessoas falarem ao mesmo tempo.
   - Áudio: só o áudio do lado que está falando em cada trecho. Filtro que tira o ronco grave (highpass 80 Hz), normalização em -15 LUFS no final e fades de 10 ms em cada junção.
   - Saída: assets\cut.mp4 (vertical 1080x1920, 30 fps) e assets\voice.wav. Use a voz como mix.wav (sem efeito sonoro).
   - Salvar a lista de trechos (arquivo, de, até, lado, fala) em cuts.json.

5. Conferir a emenda
   - Tirar 4 a 6 quadros do cut.mp4 (em momentos com cada lado falando) e olhar de perto a linha do meio: o cenário tem que parecer um só, sem degrau, sem diferença de luz e sem pedaço de braço ou cabelo sumindo.
   - Se a emenda aparecer, mude o x da emenda pra um ponto mais neutro do cenário, aumente ou diminua a pena, ou ajuste brilho/cor de um lado (eq) pra bater com o outro.
   - Se uma pessoa passa a mão ou o corpo do outro lado da emenda, desloque a emenda pra longe daquele movimento.

6. Design no HyperFrames (index.html), seguindo "Layout da tela", "Estilo" e "Animação"
   - Seguir as regras do kit: div raiz com data-composition-id="main", vídeo mudo + áudio irmão (mix.wav), uma timeline GSAP pausada registrada em window.__timelines["main"].
   - O vídeo já vem montado do passo 4: o HTML só põe as etiquetas, o destaque de quem fala, a legenda e o CTA.

7. Rascunho e revisão
   - Rodar `node scripts/preflight.mjs <projeto>` e o lint do HyperFrames (`npx hyperframes lint` na pasta do projeto) e renderizar um rascunho rápido (`npx hyperframes render -q draft -w 1 -o renders/draft1.mp4`). O preflight costuma acusar "root_data_start_conflicts_with_video" nessa estrutura; os projetos de referência usam a mesma estrutura e renderizam normal, então só ajuste se o render falhar.
   - Tirar fotos de uns 12 momentos-chave (cada troca de quem fala, o CTA) e conferir: fonte Poppins, etiquetas acima das cabeças sem encostar, destaque no lado certo na hora certa, legenda legível e sem cobrir rosto, emenda invisível, congelado e descongelado no tempo certo, nada embaixo dos botões do Instagram.
   - Ajustar o que precisar antes do render final.

8. Versão final
   - Renderizar em qualidade alta (`-q high -w 1`).

9. Entregar o arquivo
   - Entregar a cópia final JÁ SEM METADADOS (em vez de só copiar): salvar em C:\Users\SEU-USUARIO\Documents\projetos\app-edicao\02-finais como <nome-curto-do-video>-v1.mp4 (se já existir, usar v2, v3...) com o comando abaixo. Ele tira a marca do HyperFrames (hyperframes_renderer, hyperframes_version), a assinatura do codificador (Lavf, x264) e qualquer outro metadado, sem perder qualidade (não recodifica):
     `ffmpeg -i renders/<final>.mp4 -map 0 -c copy -map_metadata -1 -map_chapters -1 -bsf:v filter_units=remove_types=6 -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -metadata:s:v handler_name= -metadata:s:a handler_name= -movflags +faststart <pasta 02-finais>/<nome-curto-do-video>-v1.mp4`
   - Conferir: `grep -a -c -E "hyperframes|x264 - core|Lavf" <arquivo final>` tem que dar 0.
   - Salvar a tabela dos pares e a legenda do post em C:\Users\SEU-USUARIO\Documents\projetos\app-edicao\03-roteiros\<nome-curto-do-video>.md.

## Câmera balançando
O usuário grava no tripé, mas pode chegar vídeo com um balanço leve ou com a câmera um pouco fora do lugar entre os dois arquivos.
- Balanço dentro de um arquivo: estabilizar aquele arquivo antes de montar (`vidstabdetect` e depois `vidstabtransform` com smoothing alto, uns 30, e `zoom` pequeno, uns 3 a 5%, pra esconder as bordas). Aplicar o mesmo zoom no outro arquivo pra o tamanho bater.
- Câmera em lugar diferente entre os dois arquivos: compare um ponto fixo do cenário (canto de prateleira, quadro, porta) nos dois e desloque/escale um deles (crop/scale/pad) até o cenário bater na região da emenda.
- Se mesmo assim a emenda ficar visível, use uma pena maior e coloque a emenda numa parte lisa do cenário (parede, fundo escuro). Se não tiver jeito, avise o usuário e mostre um quadro do problema.

## Layout da tela (1080x1920)
Referências: "Mercado pobre" x "Mercado rico" (etiquetas em caixa acima das cabeças, legenda no meio) e "Amador" x "Vendedor".
- Lado fixo, sempre: o lado ERRADO fica na ESQUERDA e o lado CERTO na DIREITA. Nunca inverter.
- REGRA DO ROSTO: nada (etiquetas, legenda, CTA) fica em cima do rosto ou da cabeça de nenhuma das duas pessoas.
- Etiquetas: uma em cima de cada pessoa, centralizada em cima dela (esquerda centrada mais ou menos em x ~270, direita em x ~810; ajuste pelo centro de cada pessoa), ACIMA da cabeça, sem encostar no cabelo (a parte de baixo da etiqueta fica uns 30 a 40 px acima do ponto mais alto da cabeça no vídeo inteiro). Normalmente entre ~380 e ~640 px de altura. Nunca acima de ~190 px (relógio e câmera do Instagram). Se não couber, mude o crop pra descer as pessoas.
- Legenda da fala: centralizada na largura toda, na altura do peito/barriga (normalmente entre ~1050 e ~1300 px), abaixo dos queixos. Até 2 linhas, largura máxima ~920 px.
- CTA: logo abaixo da legenda (uns ~1380 a ~1520 px), sem cobrir rosto.
- Zona segura do Reels: nada importante abaixo de ~1550 px nem nos últimos ~100 px da direita.

## Estilo
- Fonte: Poppins.
- Etiquetas: caixa com fundo sólido e cantos arredondados (raio de uns 22 a 28 px), padding de uns 16 x 28 px, até 2 linhas (ex: "Mercado / pobre"), largura máxima ~460 px cada. Texto Poppins Black (900), uns 66 a 76 px, letra branca com contorno preto (-webkit-text-stroke de 4 a 5 px com paint-order stroke fill) e sombra preta curta. Primeira letra maiúscula, como a pessoa escreve ("Mercado pobre", "Amador").
  - Lado errado (amador, pobre, ruim, péssimo, iniciante): fundo VERMELHO (~#e5252a).
  - Lado certo (profissional, vendedor, rico, bom, experiente): fundo VERDE (~#12b81e).
- Legenda da fala: Poppins ExtraBold (800), uns 54 a 60 px, branca com contorno preto (4 px) e sombra, sem fundo, centralizada.

## Animação
- Etiquetas na tela do primeiro quadro até o fim.
- Destaque de quem fala (sutil): a etiqueta de quem está falando fica 100% (opacidade 1, escala 1,04) e a do outro lado fica um pouco apagada (opacidade ~0,55, escala 0,96). Na troca, transição de uns 0,2 s. Nada de piscar, pular forte ou mudar de cor.
- Legenda: mostra a fala em pedaços de 3 a 6 palavras, sincronizados com o tempo de cada palavra da transcrição (no tempo do vídeo montado). Cada pedaço entra com um fade/pop bem curto (0,1 a 0,15 s). Some no fim de cada fala.
- CTA: no último par, quando o lado certo fala "segue...", aparece o cartão com a frase e o botão "+ Seguir" e fica até o fim.
- Sem efeito sonoro e sem música.

## Lendo os pares
Monte a tabela com: par (1 a 5), fala do lado errado, fala do lado certo, de onde vem cada uma (arquivo, começo, fim) e o tempo no vídeo montado.
- Cada arquivo tem as falas do seu lado, na ordem. A fala 1 do errado combina com a fala 1 do certo, e assim por diante.
- O roteiro pode vir do agente-problema-solucao (falas de diálogo com o cliente, tipo "Oi, flor!" x "Bom dia, Mariana!", ou em primeira pessoa, tipo "Eu deixo cestinha só na entrada" x "Eu espalho cestinha no mercado inteiro").
- Se o usuário mandou o roteiro e a fala for diferente, vale a fala. Avise a diferença.
- O último par: o lado errado mostra a atitude de quem não evolui e o lado certo fecha chamando pra seguir. Esse é o momento do CTA.

## CTA
- Cartão escuro translúcido com a frase e o botão "+ Seguir" (azul #0095f6), no estilo dos outros formatos (Poppins, branco com contorno).
- Nunca escrever @ nem nome de perfil, porque a arroba falada é fácil de entender errado. Frase geral, curta, adaptada ao nicho (ex: "Segue pra mais dicas de vendas", "Segue pra vender mais todo dia").

## Regras
- Lado errado sempre na esquerda, lado certo sempre na direita.
- Sem efeito sonoro e sem música de fundo. Sugira usar um áudio em alta direto no Instagram, baixinho.
- Nunca apague os vídeos originais.

## Entrega
Ao terminar, mande uma mensagem curta com:
- Onde está o vídeo final, duração e tamanho
- A tabela dos pares (par, fala errada, fala certa, momento em que cada uma começa)
- Se precisou estabilizar, espelhar ou ajustar a emenda, e como ficou
- Checklist antes de postar: assistir com som, conferir a emenda do meio em tela cheia, conferir as legendas, escolher uma música em alta no app
- Sugestão de legenda pro post, puxando comentário ("Você é qual dos dois?")
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
