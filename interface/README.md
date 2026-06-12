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

1. **Campanhas** → *Nova campanha*: defina nome, objetivo, ângulo, pilar e mensagens-chave.
2. **Criar Conteúdo**: escolha a campanha + o tipo (caption, carrossel, post LinkedIn/Threads,
   conceito de ad, ideia de vídeo), preencha o brief e clique em **Gerar com IA**.
   - O painel monta o **prompt padrão** com os knowledge files + o contexto da campanha.
   - O resultado vem estruturado e editável, com um **checklist de marca** (governança).
3. **Salvar na campanha**: cria a peça em `outputs/<nome>_<data>/` (via `orchestrator.js`) e a
   vincula à campanha.
4. **Conteúdo** → abra a peça → **workflow de aprovação**: gerar preview (→ em revisão),
   **Aprovar** (versiona em `outputs/approved/` com hash SHA-256) ou **Rejeitar**.

## Validação de estrutura padrão (front + back)

- **Front**: campos obrigatórios, slugs, datas e plataformas válidas antes de enviar.
- **Back** (`lib/validation.js`): valida schema de campanha/peça **e** aplica *brand governance* —
  bloqueia (HTTP 422) conteúdo que cite concorrentes proibidos ou use emojis de hype; avisa sobre
  contagem de hashtags, tamanho de post, CTAs de urgência fake, etc. O gate roda **antes** de gravar.

## Estrutura

```
interface/
├── server.js            # Express (API + estáticos)
├── lib/                 # config, knowledge, anthropic, prompts, campaigns, content, validation
├── routes/              # settings, campaigns, content, generate
├── public/              # index.html + css + js (SPA vanilla, tema 4Selet)
└── .env                 # chave Anthropic (local, ignorada no git)
```

Dados:
- **Campanhas** → `../campaigns/*.json` (versionável em git)
- **Peças** → `../outputs/<task>_<date>/` + `status.json` (workflow oficial)

## Assistente IA

Botão **Assistente IA** (topo): tira dúvidas sobre como usar o painel e dá sugestões de conteúdo
no tom da marca.
