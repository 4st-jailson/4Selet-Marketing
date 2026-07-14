# Painel 4Selet — Marketing

Interface web local para gerir **campanhas** e **criar conteúdo de marketing com IA** (Claude),
no padrão de marca da 4Selet. Construído sobre o projeto de agentes existente: reutiliza os
`knowledge/` files, os `scripts/` oficiais (orchestrator, preview, promote) e a estrutura de
`outputs/` como fonte única de verdade.

## Como rodar

```bash
cd "Claude Equipe de Marketing - 6 Agentes/interface"
npm install        # só na primeira vez
npm start
```

Abra **http://localhost:4500** no navegador.

## Configurar a IA (1ª vez)

1. Vá em **Configurações** no menu lateral.
2. Cole sua **chave Anthropic** (`sk-ant-...`) e clique em *Salvar chave* → *Testar conexão*.
   - A chave é gravada apenas localmente em `interface/.env` (fora do git).
3. Escolha o modelo (padrão: Sonnet 4.6).

> Sem chave, o painel funciona em **modo simulado** (conteúdo rotulado `SIMULADO`), útil para
> conhecer o fluxo. Assim que a chave for salva, a geração passa a ser real.

## Fluxo de uso

1. **Login**: o painel exige entrar com usuário e senha (`routes/auth.js` + `lib/auth.js`; perfis
   **admin** e **membro**). No **primeiro acesso** via link de convite, a pessoa define a própria
   senha. Administradores gerenciam contas em **Usuários** (criar, renomear, trocar perfil, resetar
   senha, **gerar link de convite**) — via `routes/users.js`.
2. **Campanhas** → *Nova campanha*: defina nome, objetivo, ângulo, pilar e mensagens-chave.
3. **Criar Conteúdo**: escolha a campanha + o tipo (caption, carrossel, post LinkedIn/Threads,
   conceito de ad, ideia de vídeo) + o **pilar de conteúdo** (eixo temático — Taxa Zero, educacional,
   curiosidade de mercado, prova da plataforma, novidade ou motivacional; ou deixe a IA decidir pelo
   tema), preencha o brief e clique em **Gerar com IA**.
   - **Provedor de IA**: é possível escolher na hora entre **Claude (Anthropic)** e **ChatGPT (OpenAI)**;
     sem escolha, usa o padrão de **Configurações** (`lib/ai.js` faz o dispatch).
   - **Pesquisa de mercado ao vivo** (opcional): ao ativar, o painel roda uma busca **Tavily** para
     enriquecer o prompt com inteligência de mercado (`lib/research.js`; degrada para simulado sem a
     chave, sem travar a geração).
   - O painel monta o **prompt padrão** com os knowledge files + o contexto da campanha.
   - O resultado vem estruturado e editável, com um **checklist de marca** (governança). Dá para
     **Ajustar com IA** (inclusive anexando uma imagem de referência, que a IA "vê").
4. **Salvar na campanha**: cria a peça em `outputs/<nome>_<data>/` (via `orchestrator.js`) e a
   vincula à campanha.
5. **Renderizar a arte** (peças visuais): o painel gera a mídia final localmente (`lib/render.js`) —
   PNG via Playwright (imagem/feed/carrossel) ou MP4 via Remotion (composition `BrandStory`).
   - **Editor visual**: abra a arte no **editor HTML** para reposicionar/editar textos direto sobre a
     peça e re-renderizar pixel-perfect (`routes/content.js` → `edit-html`).
   - **Prévia no celular**: veja a peça num mockup de smartphone, como o público veria no feed.
6. **Conteúdo** → abra a peça → **workflow de aprovação**: gerar preview (→ em revisão),
   **Aprovar** (versiona em `outputs/approved/` com hash SHA-256) ou **Rejeitar**.
   - Em **Aprovados › Coleções**, agrupe peças aprovadas em conjuntos curados com ordem própria
     (opcionais; não substituem tags nem campanhas).
7. **Publicar no Instagram**: peças **aprovadas** podem ser publicadas no feed (imagem única ou
   carrossel) ou **agendadas** para um horário (`routes/publish.js` + `lib/publish.js` + `lib/schedule.js`).
   - A publicação passa pelo **gate de aprovação R5** (status `approved` + hashes íntegros em runtime).
   - Token e ID da conta são configurados **só por admin** em Configurações; a imagem é entregue à Meta
     por um **link público temporário** que expira (`lib/media_tokens.js`).

## Validação de estrutura padrão (front + back)

- **Front**: campos obrigatórios, slugs, datas e plataformas válidas antes de enviar.
- **Back** (`lib/validation.js`): valida schema de campanha/peça **e** aplica *brand governance* —
  bloqueia (HTTP 422) conteúdo que cite concorrentes proibidos ou use emojis de hype; avisa sobre
  contagem de hashtags, tamanho de post, CTAs de urgência fake, etc. O gate roda **antes** de gravar.

## Estrutura

```
interface/
├── server.js            # Express (API + estáticos)
├── lib/                 # config, knowledge, prompts, campaigns, content, collections, validation,
│                        #   ai (dispatcher Claude/ChatGPT) + anthropic + openai,
│                        #   auth (login/usuários), publish (Instagram) + schedule + media_tokens,
│                        #   research (Tavily), render (Playwright/Remotion), zip, credentials
├── routes/              # auth (login/convite), users (gestão), settings, campaigns, collections,
│                        #   content, generate, uploads, publish (Instagram + agendamento)
├── public/              # index.html + css + js (SPA vanilla, tema 4Selet)
├── data/                # estado gravável fora do git: usuários, publish.json, schedule.json,
│                        #   tavily.json, credentials.json
└── .env                 # chaves de IA (local, ignorada no git)
```

Dados:
- **Campanhas** → `../campaigns/*.json` (versionável em git)
- **Peças** → `../outputs/<task>_<date>/` + `status.json` (workflow oficial)

## Assistente IA

Botão **Assistente IA** (topo): tira dúvidas sobre como usar o painel e dá sugestões de conteúdo
no tom da marca.
