# Status do Projeto — Sistema de Marketing com IA (4Selet)

*Atualizado em 2026-07-13 · Marca: 4Selet · Painel web (interface principal, em produção) + Pipeline executável + 7 skills + Workflow de Aprovação Níveis 1/2*

> **Resumo:** O **Painel web** (`interface/`, `http://localhost:4500` local · **`https://mkt.4st.co` em produção**) é a **interface principal** de operação — campanhas, geração de conteúdo com IA (Claude e ChatGPT), refino, editor visual de arte, prévia no celular, coleções e workflow de aprovação visual; a extensão Claude Code no VSCode é o caminho **secundário/avançado**. O sistema de skills está **funcionalmente completo** (7 skills); o **pipeline executável** (`pipeline/`, sequencial + BullMQ) foi **entregue** (commit e787dc7); e o **Workflow de Aprovação Níveis 1+2 está implementado (v1.1)**, com 7 scripts em `scripts/` (+ módulos em `scripts/lib/`), `content_hash` para integridade pós-aprovação, `status.json` versionado em git como fonte da verdade, e bateria de testes 10/10 felizes + 7/7 adversariais validada. O **render real funciona** para ad estático (Playwright) e vídeo (Remotion). A geração usa **chave Anthropic e/ou OpenAI** configuradas no painel (multi-provedor). A **pesquisa ao vivo via Tavily** está integrada ao painel (chave inserida em *Configurações*), e a **publicação no Instagram feed** é real (Graph API, atrás do gate de aprovação, com agendamento). Hosting de mídia em Supabase e publicação no YouTube seguem pendentes. **Persistência resolvida** — git instalado e `outputs/approved/` + `outputs/archive/` versionados. **Deploy em produção ATIVO** — `https://mkt.4st.co` (Docker Compose: painel + Caddy, HTTPS, login único).

---

## 1. Ambiente / Stack

| Item | Status |
|---|---|
| **Painel web (`interface/`)** | ✅ **Pronto — interface principal** (`npm start` → `http://localhost:4500`) |
| Node.js | ✅ Instalado (v24.16.0) + npm 11.13.0 |
| **git** | ✅ **Instalado (v2.54.0.windows.1)** — repo init, outputs/approved + archive versionados |
| Remotion + React | ✅ Instalado (remotion 4.0.469, React 19.2.6) |
| Playwright + Chromium | ✅ Instalado (HTML→PNG funcional) |
| `package.json` / `tsconfig.json` / `remotion.config.ts` / `.gitignore` | ✅ Presentes |
| **`pipeline/` (orchestrator + worker + agents)** | ✅ **Entregue** (sequencial + BullMQ, commit e787dc7) |
| **Deploy em produção** | ✅ **Ativo** — `https://mkt.4st.co` (Docker Compose: painel + Caddy, HTTPS, login único) |
| **Chave de IA no painel (multi-provedor)** | ⚠️ Configurar em *Configurações* (Claude/Anthropic e/ou ChatGPT/OpenAI) — sem ela, geração simulada |
| **Tavily (pesquisa ao vivo no painel)** | ✅ **Integrado** — chave inserida em *Configurações* (grava em `interface/data/tavily.json`); opt-in por geração |
| **Publicação no Instagram feed** | ✅ **Real** (Graph API, atrás do gate + agendamento); token/ID configurados em *Configurações* (admin) |
| Supabase (`@supabase/supabase-js`) | ⏳ Não instalado / sem `SUPABASE_URL`+`KEY` |
| BullMQ + Redis | ✅ `pipeline/` pronto · ⏳ falta `REDIS_URL` (roda sequencial sem ele) |
| OAuth YouTube | ⏳ Não configurado (publicação no YouTube não existe no painel) |

---

## 2. Concluído

### 2.1 Skills (7/7 criadas) — `skills/`

| Skill | Arquivos | Engine / script | Estado real |
|---|---|---|---|
| **marketing-research-agent** | `SKILL.md` + `scripts/research.js` | Tavily (lazy require) | Simulado sem `TAVILY_API_KEY` |
| **ad-creative-designer** | `SKILL.md` + `scripts/render_ad.js` + `examples/` | Playwright HTML→PNG | ✅ Funcional |
| **video-ad-specialist** | `SKILL.md` | Remotion (composition/props) | ✅ Funcional |
| **copywriter-agent** | `SKILL.md` | Texto (sem script) | ✅ Funcional |
| **distribution-agent** | `SKILL.md` + `scripts/upload_supabase.js` | Supabase (lazy require) | Simulado; posting **gated** |
| **orchestrator** | `SKILL.md` + `scripts/orchestrate.js` | BullMQ (alvo) / sequencial | Sequencial; valida payload + plano; bootstraps `status.json` (Workflow) |
| **task-promoter** *(nova)* | `SKILL.md` | Transições do Workflow | ✅ Funcional via `scripts/promote_task.js` |

Todas com a regra **CRITICAL Re-aprovação** nas 4 skills de conteúdo (ad/video/copywriter/research).

### 2.2 Workflow de Aprovação — Níveis 1+2 (v1.1)

Implementado em 2026-06-02. Máquina de estados explícita `draft → in_review → approved/rejected → in_review`. **Fonte da verdade:** `status.json` por task, versionado em git.

**Scripts em `scripts/` (7 scripts + módulos em `scripts/lib/`):**

| Script | Propósito |
|---|---|
| `scripts/orchestrator.js` | Wrapper fino — bootstrap `status.json` (Step 1.5) |
| `scripts/generate_preview.js` | Gera `preview.html` (Inter+JetBrains Mono, 6 seções, checklist 6 regras de marca) + promove `draft→in_review` idempotente |
| `scripts/promote_task.js` | **Único ponto** de transição. Matriz `LEGAL_TRANSITIONS`, mover pasta atômico, grava `content_hashes` em approved |
| `scripts/refresh_index.js` | Regenera `outputs/approved/INDEX.md` |
| `scripts/check_approved_integrity.js` | Verifica `content_hashes` SHA-256 + `--auto-revert` se editado |
| `scripts/migrate_legacy.js` | Bootstrap retroativo de tasks pré-Workflow (`legacy: true`, `event_type=legacy_import`) |
| `scripts/validate_status.js` | Auditoria — campos obrigatórios, `status` vs `history.last.to`, zone vs status, hashes em approved |
| `scripts/lib/content_hash.js` | SHA-256 por arquivo / por pasta + `diffHashes` |
| `scripts/lib/status_bootstrap.js` | Bootstrap idempotente reusado por `orchestrator.js` e `skills/orchestrator/scripts/orchestrate.js` |

**Testes validados:**
- 10/10 **caminhos felizes** (bootstrap → preview → approve → rework → reject)
- 7/7 **adversariais** (B.1.1–B.1.7): `E_INVALID_TRANSITION`, `E_MISSING_APPROVER`, `E_UNKNOWN_STATE`, `E_STATUS_PARSE`, `E_DUPLICATE_LOCATION`, idempotência do `generate_preview`

### 2.3 Pipeline de vídeo (Remotion) — `src/`

- Composition **`BrandStory`** — **composition de produção** parametrizada (consome `props.concept`/`cta`/`scenes[]`); é a que o **painel** renderiza ao gerar vídeo (`interface/lib/render.js`).
- Composition **`AdVideo`** (1080×1920, 15s) — estática de **referência**: 5 scenes, SVGs inline, Inter+JetBrains Mono, paleta oficial.
- Composition **`CampanhaDemo`** — adaptação do AdVideo para o ângulo "Migração Sem Trauma" (campanha-demo).

### 2.4 Dry-runs e fixtures

- `outputs/e2e_*_2026-06-10/` — tasks de validação end-to-end por tipo (vídeo Remotion real, carrossel, feed, LinkedIn); `outputs/approved/e2e_image_2026-06-10/` (aprovada) e `outputs/archive/e2e_threads_2026-06-10/` (rejected) cobrem os dois estados versionados do Workflow
- `test/RESULTADOS_TESTES.md` + `test/TESTES_AGENTES.md` — registro dos testes dos agentes; `test/assets/` — fixtures de assets (ex.: `teste_skip_assets/`)
- `skills/ad-creative-designer/examples/` — fixture canônico do pipeline simulado

### 2.5 Cenários cobertos (Workflow)

- **Felizes (10):** bootstrap, status inicial, preview gerado, status promovido, aprovação com `--by`, movimentação para `approved/`, INDEX atualizado, rework para `in_review`, INDEX limpo, arquivamento com `reason`.
- **Adversariais (7):** todos com exit code + mensagem stderr corretos.

### 2.6 Painel web (`interface/`) — interface principal

Aplicação web local (Express + SPA vanilla, tema 4Selet) que é o **caminho principal** de operação. Reutiliza os `knowledge/` files, os `scripts/` oficiais e `outputs/` como fonte única de verdade.

- **Campanhas** (CRUD em `campaigns/*.json`), **Criar Conteúdo** (geração + refino com IA via Claude, prompt padrão montado no back), **Conteúdo/Aprovados** (biblioteca + workflow visual: preview → aprovar/rejeitar → versiona em `outputs/approved/`).
- **Governança de marca** roda no back (`lib/validation.js`) **antes** de gravar — bloqueia (422) concorrentes/emojis de hype, avisa sobre hashtags/tamanho/CTAs.
- Render real de **PNG** (Playwright) e **MP4** (Remotion parametrizado) disparável pela peça.
- Chave Anthropic em `interface/.env` (fora do git). Sem chave → modo simulado rotulado.
- Interface **refeita do zero** (design system editorial 4Selet, tema claro/escuro), validada no navegador, commit `0f05312`.

### 2.7 Pipeline executável (`pipeline/`)

Entregue (commit e787dc7): `orchestrator.js` (enqueue/plano), `worker.js` (processamento) e `agents.js`. Roda **sequencial por padrão**; com `REDIS_URL` ativa a **fila BullMQ** assíncrona.

### 2.8 Autenticação multi-usuário do painel (`interface/lib/auth.js`)

Login por pessoa substituindo a "portaria" externa. **Contas individuais** (arquivo `interface/data/users.json`), senha com hash **scrypt** (nativo do Node), sessão por **cookie httpOnly assinado (HMAC)** com validade de 12h. **Papéis:** `admin` (usa o painel e gerencia usuários) e `membro` (só usa o painel). **Convite por magic-link** (`createInvite`/`acceptInvite`, token de uso único guardado como hash SHA-256, expira em 7 dias). **Senha obrigatória no 1º acesso** (`must_change_password`) — enforçada no back (`server.js` bloqueia tudo, exceto `/api/auth/*`, até a pessoa definir a própria senha). Troca/reset de senha derruba sessões antigas (`session_epoch`).

### 2.9 Multi-provedor de IA (`interface/lib/ai.js`)

Dispatcher que escolhe o adaptador **por chamada** (vindo da tela de geração) ou pelo **padrão** (`AI_PROVIDER`, controlado em *Configurações*). Dois provedores registrados: **Claude (Anthropic)** (`interface/lib/anthropic.js`) e **ChatGPT (OpenAI)** (`interface/lib/openai.js`). O painel exibe qual provedor respondeu e mostra o status de cada chave. Extensível — somar outro provedor é criar o adaptador e registrar em `ADAPTERS`.

### 2.10 Pesquisa de mercado ao vivo — Tavily (`interface/lib/research.js`)

Pesquisa **ao vivo** via Tavily integrada à geração do painel. **Opt-in** (só roda quando a geração pede, `research === true`), consulta 3 focos (tendências, mercado, hooks de anúncio) e injeta a inteligência no prompt. A **chave é inserida no próprio painel** (*Configurações*) e gravada em `interface/data/tavily.json` (volume gravável, fora do git); `saveKey`/`testKey` disponíveis. **Degrada com elegância:** sem chave ou sem o SDK `@tavily/core`, retorna `{ available:false }` e a geração segue sem o bloco de inteligência de mercado.

### 2.11 Publicação no Instagram feed — real, atrás do gate (`interface/lib/publish.js` + `interface/routes/publish.js`)

Publicação **real** no Instagram feed via **Graph API v21.0** — **imagem única** e **carrossel**. Integrada ao **gate de aprovação (R5)**: só publica peça na zona `approved` **e** com os `content_hashes` batendo em runtime (`assertApproved`); qualquer edição pós-aprovação bloqueia. Token e ID da conta ficam em `interface/data/publish.json` (0600, fora do git) e **nunca** vão ao front nem ao log; a imagem é servida à Meta por um **link público temporário** que expira (`interface/lib/media_tokens.js`). Configuração (token/ID) é **só admin**; `testConnection` valida o token e descobre a conta IG Business pela Página ligada. **Agendamento** (`interface/lib/schedule.js`): a peça aprovada pode ser agendada e um worker em segundo plano publica no horário, passando pelo mesmo gate. **DRY-RUN por padrão** enquanto o Instagram não estiver conectado (prepara tudo e publica nada).

### 2.12 Editor visual de arte, prévia no celular e coleções (painel)

- **Editor visual de arte** — o painel permite ajustar a arte diretamente (edição do HTML real da peça no iframe do editor, com área segura e guias); há também **"Ajustar com IA"**, que aceita descrição do que mudar e imagens de referência (a IA "vê" via visão). Sidecars do editor (`*.canvas.json` / `*.editable.json`) não são entregáveis.
- **Prévia no celular** — mockup de smartphone que mostra a peça (imagem ou vídeo) como o público veria no feed.
- **Coleções** — agrupamento de peças (`interface/routes/collections.js` + `interface/lib/collections.js`): a coleção guarda só identificadores de peças em ordem, resolvidos contra o estado real das tasks; referências órfãs são ignoradas na leitura, com capa configurável.

### 2.13 Deploy em produção (`https://mkt.4st.co`)

Painel **em produção e ATIVO** em `https://mkt.4st.co` — **Docker Compose** (serviços: painel + **Caddy** como proxy reverso, HTTPS). **Login único** pelo próprio painel (a portaria externa `basic_auth` do Caddy foi removida; a autenticação é a do §2.8). O painel expõe `/api/health` para monitoramento/auto-restart e trata encerramento limpo (SIGTERM/SIGINT) para rodar sob supervisor.

---

## 3. Pendente / Level-up

| # | Pendência | Impacto | Como resolver |
|---|---|---|---|
| 0 | ~~**Chave de IA no painel (multi-provedor)**~~ | ✅ **Configurável** — painel roda em **modo real** com Claude (Anthropic) e/ou ChatGPT (OpenAI); dispatcher em `interface/lib/ai.js` | — concluído |
| 1 | **`REDIS_URL` para a fila BullMQ** | A `pipeline/` **já existe** (entregue) mas roda **sequencial** sem Redis | Provisionar Redis (Upstash) + setar `REDIS_URL` + `npm run pipeline:run` — **passo a passo no §7.2** |
| 2 | ~~**Pesquisa ao vivo (Tavily)**~~ | ✅ **Entregue no painel** (`interface/lib/research.js`) — chave inserida em *Configurações* (`interface/data/tavily.json`), opt-in por geração, degrada para simulado sem a chave | — concluído |
| 3 | **Supabase não configurado** | Mídia não é hospedada (URLs placeholder) | `npm i @supabase/supabase-js` + `SUPABASE_URL`/`KEY` — *adiado por decisão do Hugo (2026-06-15)* |
| 4a | ~~**Publicação no Instagram feed**~~ | ✅ **Real** (Graph API v21.0, imagem + carrossel) atrás do gate de aprovação (R5), com agendamento — `interface/lib/publish.js` + `interface/routes/publish.js` | — concluído |
| 4b | **OAuth YouTube** | Publicação no YouTube impossível | Publicação no YouTube **ainda não existe** no painel (só há aba de diagnóstico em *Configurações*); implementar rota/lib + `YOUTUBE_REFRESH_TOKEN` |
| 5 | **Estado `published` no enum** | Não há transição terminal "campanha foi ao ar" | Adicionar `published` ao enum + transição manual em `promote_task.js` |
| 6 | **Lock multi-usuário concorrente em `status.json`** | Race em execuções simultâneas de `promote_task.js` na mesma task | `proper-lockfile` por task_dir |
| 7 | **Skills não empacotadas p/ distribuição** | Arquivos no repo, não `.zip` instaláveis | Zipar cada pasta de skill se for distribuir |

> **Segurança (por design):** pipeline **nunca publica sozinho**. Posting real exige (i) referência explícita ao Publish MD pelo nome, (ii) `dry_run: false`, (iii) tokens presentes (gate no distribution-agent).

---

## 4. Estrutura atual (resumo)

```
Claude Equipe de Marketing - 6 Agentes/
├── .git/  .gitignore                          ← versionamento (v2.54.0)
├── CLAUDE.md  STATUS_PROJETO.md  GUIA_DE_USO.md  SPEC_WORKFLOW_APROVACAO.md
├── package.json  tsconfig.json  remotion.config.ts
├── public/logo-4selet-light.png
├── knowledge/ (brand_identity, product_campaign, platform_guidelines)
├── assets/ (logos, brand-identity kit, reference-videos)
├── src/ (Remotion: Root, BrandStory, AdVideo, CampanhaDemo, scenes/*, theme, components)
├── scripts/
│   ├── lib/ (content_hash, status_bootstrap)
│   ├── orchestrator.js · generate_preview.js · promote_task.js · refresh_index.js
│   ├── check_approved_integrity.js · migrate_legacy.js · validate_status.js
│   └── render_ad.js (legacy, antes da bundling em skills/)
├── skills/ (7 skills, com scripts/ bundled em cada agente)
│   └── task-promoter/SKILL.md (skill nova de transição)
└── outputs/
    ├── approved/INDEX.md          ← versionado em git (auto-regenerado)
    ├── approved/<task>_<date>/    ← versionado em git
    ├── archive/<task>_<date>/     ← versionado em git
    └── <task>_<date>/             ← ignorado por .gitignore (tasks em andamento)
```

---

## 5. Como rodar (estado atual)

### 5.1 Workflow de Aprovação

```bash
# Bootstrap de uma task (cria outputs/<task>_<date>/status.json):
node scripts/orchestrator.js --task <name> --date <YYYY-MM-DD> [--platforms instagram,youtube] [--angle "<texto>"]

# Gerar preview consolidado + promover draft -> in_review:
node scripts/generate_preview.js --task <name> --date <YYYY-MM-DD>

# Aprovar / arquivar / voltar para revisão:
node scripts/promote_task.js --task <name> --date <YYYY-MM-DD> --to approved --by "<aprovador>"
node scripts/promote_task.js --task <name> --date <YYYY-MM-DD> --to rejected --reason "<motivo>" --by "<quem>"
node scripts/promote_task.js --task <name> --date <YYYY-MM-DD> --to in_review

# Auditoria e integridade:
node scripts/validate_status.js                          # auditar todos
node scripts/check_approved_integrity.js [--auto-revert] # detectar edicoes pos-approval
node scripts/migrate_legacy.js [--dry-run] [--include-test]
node scripts/refresh_index.js                            # regenera outputs/approved/INDEX.md
```

### 5.2 Produção de conteúdo

```bash
npm run render        # vídeo Remotion -> outputs/remotion_test_video/video.mp4
node scripts/render_ad.js <html> <out.png> 1080 1080
node skills/marketing-research-agent/scripts/research.js --task <t> --date <d> --topic "<topico>" --out <dir>
node skills/distribution-agent/scripts/upload_supabase.js --task <t> --date <d> --out <dir>
node skills/orchestrator/scripts/orchestrate.js --file <payload.json>
```

---

## 6. Próximos passos recomendados

1. **Configurar a chave de IA no painel** (*Configurações* — Claude/Anthropic e/ou ChatGPT/OpenAI) — liga a geração real; é o passo mais imediato para o uso diário.
2. **Fazer o 1º post de teste real no Instagram** — a publicação já é real e o feed está conectado; validar uma peça aprovada de ponta a ponta (imagem e carrossel).
3. **Ativar a fila BullMQ** — `pipeline/` já está pronto; basta provisionar `REDIS_URL` para sair do modo sequencial.
4. **Configurar chaves externas restantes** para sair do modo simulado: Supabase (hosting de mídia) → OAuth YouTube (quando houver publicação no YouTube). *(Tavily e Instagram feed já entregues.)*
5. **Lock multi-usuário** em `status.json` se evoluir para multi-operador.
6. **Estado `published`** para registrar publicação efetiva (Nível 3 — já há webapp/painel).

---

## 7. Passo a passo das integrações pendentes (escopo atual)

*Atualização 2026-07-13: **Tavily** (pesquisa ao vivo) e **Instagram feed** (publicação real) foram **entregues** e saíram desta lista de pendências — a chave da Tavily agora é inserida **no próprio painel** (*Configurações*), não mais por variável de ambiente. Permanecem no escopo pendente apenas **Redis** (opcional, abaixo), **Supabase** (item 3) e **OAuth YouTube** (item 4b).*

> **Onde as variáveis moram.** O `interface/.env` é lido **só pelo painel** (chaves de IA e afins). A chave da **Tavily** e as credenciais do **Instagram** são gravadas pelo painel em `interface/data/` (`tavily.json`, `publish.json`), fora do git. Os scripts de pipeline/skills leem `process.env` **diretamente**. Logo, `REDIS_URL` e afins precisam existir no **ambiente real do processo**: no **PM2** (`pm2 set painel-4selet:VAR "valor"` ou via `ecosystem.config.js`) ou exportados no shell antes de rodar o comando.

### 7.1 Tavily — pesquisa de mercado ao vivo — ✅ *entregue*

**Finalidade:** dá **pesquisa de mercado ao vivo** à geração do painel (tendências, mercado, hooks de anúncio). **Já integrada** (`interface/lib/research.js`): a chave é inserida em *Configurações* e gravada em `interface/data/tavily.json`; a pesquisa é **opt-in** por geração e **degrada para simulado** sem a chave ou sem o SDK `@tavily/core`. (Passo antigo por `TAVILY_API_KEY` no ambiente permanece válido como fallback, mas o caminho recomendado é o painel.)

### 7.2 Redis — fila BullMQ assíncrona (`REDIS_URL`) — *opcional*

**Finalidade:** ativa a fila **BullMQ**. Hoje o pipeline roda **sequencial** (um agente após o outro, no mesmo processo). Com Redis, os jobs entram numa fila e um **worker** os processa de forma **assíncrona/paralela**. Só compensa com **volume alto** de campanhas simultâneas — para uso normal, o modo sequencial atual já atende.

1. Criar conta em **upstash.com** → *Create Database* → **Redis** (região próxima, ex.: `sa-east-1`).
2. Copiar a connection string **`redis://…`** (ou `rediss://…` com TLS).
3. Instalar as libs: `npm i bullmq ioredis`
4. Definir as variáveis: `pm2 set painel-4selet:REDIS_URL "rediss://default:SENHA@host:porta"` — opcional `PIPELINE_CONCURRENCY=2` (jobs em paralelo).
5. Subir o worker num processo separado: `node pipeline/worker.js`
6. **Testar:** ao rodar `npm run pipeline:run`, o log deve dizer `queued (BullMQ+Redis)` em vez de `sequential (sem Redis)`.

> **Itens fora do escopo atual (adiados):** Supabase (§3 item 3) e OAuth YouTube (§3 item 4b) permanecem documentados na tabela, mas **não** serão configurados neste momento. **Instagram feed já foi entregue** (§2.11 / §3 item 4a). A trava de segurança permanece válida: a publicação **nunca ocorre sozinha fora do gate** — a peça precisa estar `approved` com `content_hashes` íntegros em runtime (gate R5), e o Publish MD do pipeline continua exigindo referência explícita, `dry_run:false` e tokens presentes.
