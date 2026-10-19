# Central de edição de vídeos

Esta pasta é a base de trabalho para tudo de edição de vídeo. Abra o Claude sempre a partir daqui (nunca do System32).

Fale sempre em português informal, simples e direto. Nunca use travessão (—) nos textos dos vídeos nem nas mensagens.

## Pastas
- `01-brutos/`: vídeos gravados, do jeito que saíram do celular. Nunca apagar nem alterar o original.
- `02-finais/`: vídeos prontos para postar. Nome: `<nome-curto-do-video>-v1.mp4` (se já existir, v2, v3...).
- `03-roteiros/`: ideias, roteiros e legendas gerados pelos agentes (classificação, contraste etc.), um `.md` por vídeo.

## Onde fica o kit de edição
O HyperFrames Student Kit continua em `C:\Users\SEU-USUARIO\hyperframes-student-kit` (não mover: tem 1,7 GB de dependências e os agentes apontam pra lá).
- Projetos de edição (index.html, cortes, sfx, renders de rascunho) ficam em `hyperframes-student-kit\video-projects\<nome-curto>`.
- Chaves (ElevenLabs, Kie.ai) ficam no `.env` do kit. Nunca mostrar o valor.

## Regras que valem por cima dos agentes
- Quando um agente pedir o caminho do vídeo, procurar primeiro em `01-brutos/`.
- Quando um agente mandar copiar o vídeo final para a Área de Trabalho, copiar para `02-finais/` em vez disso.
- Quando gerar roteiro ou legenda, salvar também em `03-roteiros/`.
- PC com cerca de 7,7 GB de RAM: renderizar sempre com `-w 1`.

## Agentes disponíveis
- `/agente-video-classificacao`: edita vídeo de ranking (Top 5, Top 10...).
- `/agente-video-contraste`: edita vídeo de contraste.
- `/agente-video-mao-de-vaca`: edita vídeo mão de vaca (caro x barato), com fotos e preços pesquisados pelo Firecrawl.
- `/agente-video-destampando`: edita vídeo destampando (NUNCA x certo, tarjas que somem conforme a fala), só texto. Usa o Jeito 2 (Claude escreve o plano, scripts fazem o resto): mais rápido e gasta menos tokens.
- `/agente-video-problema-solucao`: edita vídeo problema e solução (a mesma pessoa duas vezes, errado na esquerda x certo na direita), juntando as duas gravações num cenário só.
- `/agente-video-avaliacao`: edita vídeo de avaliação (produtos numa escala de 3 níveis verde, amarelo e vermelho, foto entrando no nível na hora da nota), com fotos do Firecrawl.
- `/agente-classificacao`, `/agente-contraste`, `/agente-preguicoso`, `/agente-mao-de-vaca`, `/agente-destampando`, `/agente-problema-solucao`, `/agente-avaliacao`, `/agente-viral`: geram ideias e roteiros.
