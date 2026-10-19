# Ivens Editor Viral

Edite vídeos curtos pro Instagram, TikTok e Shorts com IA, do vídeo bruto até o arquivo final em 1080x1920.
São **6 skills do Claude Code** que cortam as pausas, leem a fala, montam a tela, colocam efeitos e sons e
renderizam o vídeo, e o **Editor Viral**, um aplicativo com telas simples (no computador e no celular)
pra usar as skills sem precisar escrever nada.

## As 6 skills

| Comando | Formato |
| --- | --- |
| `/agente-video-classificacao` | Ranking (Top 5, Top 10), com cada item indo pro lugar dele conforme a fala |
| `/agente-video-contraste` | Dois lados (Indico x Não indico), com cada exemplo arrastado pro lado do veredito |
| `/agente-video-mao-de-vaca` | Produto caro x produto barato, com foto e preço pesquisados na internet |
| `/agente-video-destampando` | NUNCA x certo, com tarjas que somem linha a linha conforme a fala |
| `/agente-video-problema-solucao` | Você duas vezes na tela (errado x certo), juntando duas gravações num cenário só |
| `/agente-video-avaliacao` | Produtos numa escala verde, amarelo e vermelho, com a foto entrando no nível na hora da nota |

## O que você precisa

- Computador Windows ou Mac com 8 GB de RAM e uns 5 GB livres (não funciona no celular; o celular só abre o app).
- Assinatura do [Claude](https://claude.ai) (Pro ou Max) com o app instalado (aba Code).
- Conta na [ElevenLabs](https://elevenlabs.io) com créditos (transcrição da fala e efeitos sonoros).
- Conta no [Firecrawl](https://www.firecrawl.dev), conectada no Claude (fotos e preços de produtos).
- O resto (Node.js, Git, FFmpeg, Chrome e o [HyperFrames Student Kit](https://github.com/nateherkai/hyperframes-student-kit), gratuito) o próprio Claude instala.

## Como instalar

1. Abra o app do Claude, entre na aba **Code** e comece uma conversa nova em qualquer pasta.
2. Copie o texto abaixo inteiro (Ctrl+C, no Mac Cmd+C), cole na conversa (Ctrl+V) e aperte Enter.
3. Aprove o que o Claude pedir pra instalar. No Windows, pode aparecer uma janela pedindo "Sim" de administrador.

```text
Instala pra mim o Ivens Editor Viral. Siga estes passos e me avise em cada um:
1. Baixa o repositório github.com/IvensJS/ivens-editor-viral pra pasta Documentos/projetos.
2. Instala o que faltar: Node.js 22 ou mais novo, Git, FFmpeg completo (com ffprobe) e Chrome. No Windows use o winget; no Mac use o Homebrew.
3. Instala o HyperFrames Student Kit (github.com/nateherkai/hyperframes-student-kit) na minha pasta de usuário, numa pasta chamada hyperframes-student-kit, com npm ci, npm run setup e npm test. Depois roda npx hyperframes browser ensure dentro dela pra instalar o Chrome que renderiza os vídeos.
4. Copia as pastas de skills/ do ivens-editor-viral pra minha .claude/skills, as fontes/ pra assets/fonts do HyperFrames e os modelos/ pra video-projects do HyperFrames.
5. Cria a pasta Documentos/projetos/app-edicao com as pastas 01-brutos, 02-finais e 03-roteiros e coloca lá o CLAUDE.md que está em pasta-de-trabalho/.
6. Troca SEU-USUARIO pelo caminho deste computador nas skills e no CLAUDE.md (no Mac, ajusta também o formato do caminho).
7. Abre o arquivo .env do HyperFrames no Bloco de Notas pra eu colar a minha chave da ElevenLabs. Não me peça a chave no chat.
8. Quando eu avisar que salvei, testa tudo: o HyperFrames, o render de um vídeo de teste e a transcrição da ElevenLabs.
```

Depois da instalação:

1. **Chave da ElevenLabs:** no site da ElevenLabs, vá no seu perfil, depois em **API Keys**, e crie uma chave com
   **Speech to Text** e **Sound Effects**. Cole no Bloco de Notas que o Claude abriu, logo depois de
   `ELEVENLABS_API_KEY=`, e salve com Ctrl+S. Nunca cole a chave na conversa.
2. **Firecrawl:** em claude.ai, vá em **Configurações**, depois **Conectores**, e adicione o Firecrawl.

## Como usar

**Pelo aplicativo (o jeito fácil):**

1. Na pasta `Documentos/projetos/ivens-editor-viral`, clique duas vezes em `iniciar-editor.bat`. Por enquanto o aplicativo só roda no Windows; no Mac, use as skills direto no Claude (abaixo).
2. O navegador abre em http://localhost:3210. A senha aparece na janela preta.
3. Escolha o formato, conte sobre o vídeo, mande o vídeo gravado (até 2 minutos) e aperte **Editar meu vídeo**.
4. No celular, no mesmo Wi-Fi, abra o endereço "No celular" que aparece na janela. Na primeira vez, o Windows pergunta se libera o acesso na rede: clique em Permitir.
5. O vídeo pronto aparece na tela, em `app-edicao/02-finais` e na Área de Trabalho. Dá pra pedir até 2 ajustes.

**Direto no Claude:**

1. Coloque o vídeo em `Documentos/projetos/app-edicao/01-brutos`.
2. No app do Claude, aba Code, comece uma conversa nova **escolhendo a pasta app-edicao**.
3. Digite o comando do formato (tabela lá em cima) e responda as perguntas.
4. O vídeo pronto vai pra `02-finais`, e o roteiro com a legenda do post vai pra `03-roteiros`.

## O que tem aqui

| Pasta ou arquivo | O que é |
| --- | --- |
| `skills/` | As 6 skills (e o script que trata as fotos dos produtos) |
| `fontes/` | Poppins (700, 800, 900) e Lilita One |
| `modelos/` | Projetos de exemplo que as skills usam como modelo de design |
| `pasta-de-trabalho/CLAUDE.md` | Regras da pasta app-edicao (onde ficam os vídeos brutos, finais e roteiros) |
| `servidor.js`, `formatos.js`, `public/`, `iniciar-editor.bat` | O aplicativo Editor Viral (Node.js, sem dependências pra instalar) |

## Bom saber

- Os vídeos ficam no seu computador. O app só usa a sua internet pra transcrição (ElevenLabs), fotos (Firecrawl) e o Claude.
- Cada edição usa o limite do seu plano do Claude e leva uns 10 a 30 minutos.
- O app roda o Claude Code com permissões limitadas: só os programas de edição, o Firecrawl e as pastas do projeto. Ele não lê o `.env` e não mexe nas skills.
- Música de fundo não entra: escolha um áudio em alta direto no app na hora de postar.
- O HyperFrames Student Kit é de Nate Herk (licença MIT). As fontes Poppins e Lilita One são do Google Fonts (SIL Open Font License 1.1).
