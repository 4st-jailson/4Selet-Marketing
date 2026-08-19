## Visão Geral do Projeto

Este projeto implementa um **Sistema de Automação de Conteúdo para Redes Sociais com IA** construído com Claude Code dentro da Antigravity IDE.

O sistema usa **cinco agentes de IA especializados** coordenados por um **Orchestrator** para pesquisar, gerar, renderizar e distribuir conteúdo de marketing.

O objetivo do projeto é **gerar materiais de marketing para a 4Selet** — ads estáticos, vídeos short-form, captions platform-native e pacotes de publicação — orquestrando **workflows de pesquisa, geração criativa, produção de mídia e distribuição social** via skills modulares, knowledge files e APIs.

> **Marca:** A marca deste projeto é a **4Selet** — a marca real, não uma demo. Toda a comunicação gerada pelos agentes deve seguir os knowledge files oficiais da 4Selet em `knowledge/`.

**Sobre a 4Selet:** plataforma brasileira de pagamentos e venda de infoprodutos, construída para produtores que operam com seriedade no digital. Fundada em 2022 por **Fabricio Gonçalves** (sócio administrador, referência nacional no mercado de trade) e **Hugo Belo**. O acesso à plataforma é **por convite** — o nome "Selet" vem de "seletos". O posicionamento é de **parceria estratégica**: *"Para quem sabe que é Selet."*

A 4Selet está atualmente com a campanha **Taxa Zero** ativa: 0% de taxa pela plataforma por 3 meses ou até R$ 300 mil em vendas (o que ocorrer primeiro), R$ 1,99 fixo por transação, PIX em D+10 e cartão em D+30. O público-alvo primário é o **produtor estabelecido** (faturamento R$ 50 mil+/mês). Toda peça gerada pelos agentes deve referenciar a campanha ativa e o posicionamento de exclusividade convidativa.

---

# Arquitetura do Sistema

O sistema consiste em cinco agentes gerenciados por um orchestrator central:

```
Marketing Research Agent
        │
        ├──► Ad Creative Designer  ─┐
        ├──► Video Ad Specialist   ─┼──► Distribution Agent
        └──► Copywriter Agent      ─┘
```

O **Orchestrator** skill coordena todos os agentes via filas de job **BullMQ** backed por **Upstash Redis**. Agentes rodam em ordem de dependência — research primeiro, depois os três agentes criativos em paralelo, depois distribution por último.

Cada agente usa uma combinação de **custom skills, knowledge files e APIs** para executar suas tarefas.

## Tipos de conteúdo e pilares (o vocabulário real do produto)

Fonte de verdade: `interface/lib/config.js`. **É por aqui que a operação pensa hoje** — os "5 agentes" são papéis conceituais; o eixo de execução é o **tipo de conteúdo**.

| Tipo (`id`) | Rótulo | Arquivo de conteúdo | Arte |
|---|---|---|---|
| `instagram_caption` | Feed Instagram | `copy/instagram_caption.txt` | `ads/feed.png` (1080×1350) |
| `instagram_carousel` | Carrossel | `copy/instagram_carousel.json` | `slides/slide_N.png` |
| `instagram_story` | **Story Instagram** | `copy/instagram_story.json` | `story/story_N.png` (1080×1920) |
| `ad_creative` | Imagem / Anúncio | `ads/concept.json` | `ads/ad.png` (1080×1080) |
| `media_mention` | **4Selet na Mídia** | `copy/instagram_caption.txt` | `ads/{feed,square,story,media_16x9}.png` |
| `video_idea` | Vídeo (short-form) | `video/concept.json` | `video/video.mp4` (9:16) |
| `linkedin_post` | LinkedIn | `copy/linkedin_post.txt` | — |
| `threads_post` | Threads/X | `copy/threads_post.txt` | — |

**6 pilares de conteúdo** (eixo temático de toda peça, distinto das 5 colunas estratégicas da marca): `taxa_zero`, `educacional`, `curiosidade_mercado`, `prova_plataforma`, `novidade`, `motivacional`. Regra dura injetada no prompt: *"NEM toda peça é sobre Taxa Zero."*

**"Story Instagram"** (`instagram_story`) é a sequência de **3 a 7 cartões verticais 1080×1920**, com as faixas que o aplicativo do Instagram cobre já reservadas (`STORY_SAFE` em `interface/lib/config.js`: 250px em cima, 250px embaixo, 96px nas laterais). **Story não tem legenda** — o texto mora na arte. Renderizado por `renderStory`; a publicação é **manual** (não há endpoint de Stories na Graph API).

**"4Selet na Mídia"** é o tipo para aparição na imprensa: o print da matéria montado num de **10 modelos** de dispositivo/cena (`hand_tablet`, `foto_real`, `foto_mesa`, `foto_maos_mesa`, `celular`, `navegador`, `citacao`, `split`, `selo`, `camadas`), em até 4 formatos. Renderizado por `renderMedia`/`tplMedia` a partir de `status.media`.

> **O prompt de geração vive em `interface/lib/prompts.js`.** O bloco `GOVERNANCE` (regras duras) vem primeiro e **os knowledge files são injetados literalmente** logo depois (`interface/lib/knowledge.js` → `brandContext()`). Editar `knowledge/*.md` **muda o comportamento da geração em produção**. Regra dura em vigor: **nunca assinar peça com a frase-tag** *"Para quem sabe que é Selet."*

> **Atualização 2026-07-30 (auditoria dos agentes):** este arquivo estava congelado em 12/jun. Foram corrigidos os contratos de arquivo (ad, vídeo), a descrição da distribuição/publicação, a árvore de output e o status das chaves. Novidades que faltavam aqui: o **tipo nativo "4Selet na Mídia"** (`media_mention`), os **6 pilares de conteúdo**, a **busca de imagens Pexels**, o **editor visual** e o fato de que o prompt de geração vive em `interface/lib/prompts.js` e injeta os knowledge files **literalmente**. Relatório completo dos achados: `AUDITORIA_AGENTES_2026-07-30.md`.

> **Estado de implementação (2026-06-12, com correções de 2026-07-30):**
> **Interface principal:** o **Painel web** em `interface/` (`npm start` → `http://localhost:4500`) é o **caminho principal** de operação — gerência de campanhas, geração de conteúdo com IA e workflow de aprovação visual. A **extensão Claude Code no VSCode** é o caminho **secundário/avançado** (chat direto com os agentes, pipeline e scripts). Ver `GUIA_DE_USO.md` (Seções 4 e 8) e `interface/README.md`.
> **PRONTO ✅** — **Painel web** (`interface/`: Express + SPA, geração/refino/aprovação, governança de marca); **pipeline executável** (`pipeline/orchestrator.js` + `worker.js` + `agents.js`, sequencial + BullMQ, entregue commit e787dc7); knowledge files (`knowledge/`), assets de marca (`assets/`), as **7 skills** em `skills/` (5 agentes + orchestrator + **task-promoter**), o projeto **Remotion** em `src/` (compositions `AdVideo` + `CampanhaDemo` + `BrandStory`), `package.json` / `tsconfig.json` / `remotion.config.ts` / `.gitignore`, e dependências instaladas (**Node v24.16.0, git v2.54.0, Remotion 4.0.469 + React 19, Playwright + Chromium**). **Workflow de Aprovação Níveis 1+2 (v1.0)** implementado: 7 scripts em `scripts/` + módulos em `scripts/lib/` (content_hash, status_bootstrap), `status.json` por task como fonte da verdade, `outputs/approved/` e `outputs/archive/` versionados em git, 10 testes felizes + 7 adversariais validados. **Pesquisa de mercado ao vivo (Tavily)** ENTREGUE no painel (`interface/lib/research.js`; opt-in por geração, chave gravada em `interface/data/tavily.json`; degrada para simulado sem a chave). **Publicação real no Instagram feed** ENTREGUE (`interface/lib/publish.js` + `interface/routes/publish.js` via **Graph API v21.0** — imagem única + carrossel — atrás do **gate de aprovação R5**, com **agendamento** em `interface/lib/schedule.js`). **Autenticação multi-usuário do painel** ENTREGUE (`interface/lib/auth.js`: login por pessoa, hash scrypt, sessão por cookie assinado HMAC, perfis **admin** e **membro**, convite por magic-link). **Suporte multi-provedor de IA** ENTREGUE (`interface/lib/ai.js`: dispatcher **Claude (Anthropic)** + **ChatGPT (OpenAI)**, escolha por chamada ou padrão em Configurações). **Painel em PRODUÇÃO** em **`https://mkt.4st.co`** (Docker Compose, Linux .63).
> **PENDENTE ⏳** — `@supabase/supabase-js` + Supabase (**não é pré-requisito de publicação** — ver Distribution Agent), **`REDIS_URL`** para ativar a fila BullMQ (a pasta `pipeline/` já existe; sem Redis roda **sequencial**), **OAuth YouTube** (publicação no YouTube **não existe** no painel — não há publisher). ⚠️ **Corrigido em 2026-07-30:** a **chave de IA está configurada** (`ANTHROPIC_API_KEY` em `interface/.env`; produção mostra "IA conectada") e a **chave Tavily também** (`TAVILY_API_KEY`) — a geração **não** roda simulada. A chave do **Pexels** fica em `interface/data/pexels.json` (Configurações do painel).
> **Documentação de referência** (ordem de leitura): 1) `STATUS_PROJETO.md` — estado atual · 2) `GUIA_DE_USO.md` — passo a passo (§23 Workflow) · 3) `SPEC_WORKFLOW_APROVACAO.md` — contrato v1.1 · 4) `skills/<nome>/SKILL.md` — comportamento por agente.
> ⚠️ **Regra CRITICAL Re-aprovação** ativa nas 4 skills de conteúdo: NÃO editar `outputs/approved/<task>/` diretamente — rework via `node scripts/promote_task.js --to in_review`.

---

# Orchestrator

O Orchestrator não é um agente — é uma skill de coordenação que gerencia o pipeline completo.

Skill File: `skills/orchestrator/SKILL.md`

Responsabilidades:
- Aceitar um Job Payload (JSON) com `task_name`, `task_date`, **`brief`** (obrigatório, mín. 8 chars), `platforms` (**não** `platform_targets`), `content_types` e flags opcionais
- Validar o payload e enforçar a ordering de dependências
- Rodar **um job por tipo de conteúdo** (o job leva o id do tipo — não existem jobs `ad_creative_designer`/`video_ad_specialist`/`copywriter_agent` no executável)
- Enqueue na fila BullMQ `marketing-pipeline` via `pipeline/orchestrator.js` quando `REDIS_URL` existir; sem Redis, roda sequencial
- Rastrear status com os estados reais (`done`/`skipped`/`blocked`/`error`) — **não há log por job em disco**; o resumo vai para `pipeline_run.json`
- Rodar o job `preview_generator` ao fim (gera `preview.html` e promove `draft → in_review`)
- Reportar a conclusão apontando `distribution/plan.md` e `pipeline_run.json`

> ⚠️ **`media_mention` (4Selet na Mídia) NÃO está na lista default do pipeline** — ele depende de um print da matéria que alguém precisa enviar, então sem esse insumo a peça sairia vazia; para gerar uma, passe o tipo explicitamente em `content_types`. Os demais **7 tipos** entram por padrão (a lista é derivada de `CONTENT_TYPES` em `pipeline/agents.js`, e não mais copiada à mão — era essa cópia que deixava Story e Mídia de fora sem avisar). E **`dry_run` não tem efeito** no executável: para não renderizar, use `--no-render`.

### Comandos do Pipeline

```bash
# argumentos são OBRIGATÓRIOS — sem eles o script sai com exit 2
npm run pipeline:run -- --task <t> --date <YYYY-MM-DD> --brief "<brief>"
npm run pipeline:run:payload '<json>'    # rodar com JSON payload inline
node pipeline/worker.js                  # iniciar o BullMQ worker (terminal separado)
```

> ✅ **Entregue (commit e787dc7):** a pasta `pipeline/` (`orchestrator.js` + `worker.js` + `agents.js`) já existe e é executável. Por padrão roda em **modo sequencial**; ao definir `REDIS_URL`, usa a **fila BullMQ** assíncrona. O caminho histórico `node skills/orchestrator/scripts/orchestrate.js --file <payload.json>` (valida payload + monta plano) continua disponível. ⏳ **Pendente:** apenas a chave `REDIS_URL` para a fila e os scripts npm `pipeline:run` no `package.json`, se ainda não estiverem mapeados.

### Skip Flags

| Flag | Efeito |
|---|---|
| `skip_research: true` | Pula o Research Agent; requer que `assets/<task_name>/` exista |
| `skip_image: true` | Pula o Ad Creative Designer |
| `skip_video: true` | Pula o Video Ad Specialist |

---

# Agentes e Responsabilidades

## 1. Marketing Research Agent

Propósito:
Conduzir pesquisa estruturada de inteligência de mercado usando o **Tavily AI SDK** via um script local Node.js.

Skill File: `skills/marketing-research-agent/SKILL.md`

Responsabilidades:
- Rodar 5 buscas Tavily direcionadas (tendências, concorrentes, audiência, hooks, tópicos virais)
- Sintetizar achados em categorias de inteligência de marketing
- Gerar três deliverables: JSON estruturado, brief em Markdown com diagramas Mermaid, e um report HTML interativo com Chart.js

Output Típico — **depende do caminho** (três comportamentos diferentes):
- **Skill/CLI** (5 buscas Tavily): `research_raw.json` + `research_results.json` (contrato machine-readable) + `research_brief.md` (Mermaid) + `interactive_report.html` (Chart.js)
- **Painel** (3 buscas Tavily, opt-in por geração): **nenhum arquivo** — os achados entram direto no prompt e as fontes ficam em `status.json.research_sources`
- **Pipeline** (job `research_agent`): advisory determinístico **sem Tavily** → `research/insights.md`

> A chave Tavily tem **duas casas** que não se enxergam: `TAVILY_API_KEY` (ambiente/`interface/.env`, lida pelo script e pelo painel) e `interface/data/tavily.json` (gravada pelas Configurações do painel; o script **não** lê). Conferir as duas antes de concluir "sem chave".

---

## 2. Ad Creative Designer

Propósito:
Gerar **criativos de anúncio estáticos** como design JSON estruturado, depois renderizar para PNG via **Playwright**.

Skill File: `skills/ad-creative-designer/SKILL.md`

Responsabilidades:
- Escolher o **pilar de conteúdo** e um dos **4 templates reais** de arte: `editorial`, `bold` (Destaque), `split` (Dividido), `photo` (Foto)
- Gerar copy de marketing (headline ≤4 palavras, subtext, CTA opcional)
- Gerar o **concept JSON** (schema plano: `eyebrow`, `headline`, `subtext`, `cta`, `badge`, `image`)
- Gerar `ad.html` com **CSS inline** (não existe `styles.css` no fluxo atual)
- Renderizar o HTML para PNG 1080×1080 via Playwright, com `scale 2` (`scripts/render_ad.js`)

Output Típico (salvo em `outputs/<task_name>_<date>/ads/`):
- `concept.json` — especificação de design (blueprint)
- `ad.html` — arte em HTML, CSS inline, com `html,body{width/height}` e container `.card`
- `ad.png` — screenshot Playwright 1080×1080 @2x, mais os sidecars `ad.editable.json` + `ad.bg.png`

> Foto de fundo (acervo `/uploads/` ou busca **Pexels**) entra pelo campo `concept.image` com o template `photo`. Variantes de logo/marca d'água por peça ficam em `render.json` na raiz da task.

---

## 3. Video Ad Specialist

Propósito:
Gerar conceitos de video ad short-form e **estruturas de scene Remotion-ready**.

Skill File: `skills/video-ad-specialist/SKILL.md`

Responsabilidades:
- Gerar um conceito de vídeo (hook, arco emocional, estilo visual, intenção de CTA)
- Construir um breakdown scene-by-scene (Hook → Product Showcase → Benefit → CTA)
- Gerar scene JSON para renderização Remotion
- Renderização real via o projeto Remotion em `src/` (React + SVG, `useCurrentFrame()`/`interpolate()`, fontes via `@remotion/google-fonts`). O **painel** (`interface/lib/render.js`) renderiza a composition **`BrandStory`** e grava `video/video.mp4`; o CLI `npm run render` está fixo na composition `AdVideo` (referência estática) — para renderizar `BrandStory`/`CampanhaDemo` use o Remotion Studio (`npm run studio`) ou `remotion render src/index.ts <Composition> <saida>`. *(Não existe skill `remotion-best-practices`; o mecanismo de render é o projeto Remotion em `src/`.)*

Output Típico (salvo em `outputs/<task_name>_<date>/video/`):
- **`concept.json`** — o arquivo canônico, com schema **plano** (`concept`, `hook`, `emotional_arc`, `visual_style`, `scenes[]`, `cta`, `notes`). É o que o painel e o pipeline leem.
- `scenes.json` — **arquivo de SAÍDA**, gerado pelo render como props do Remotion. Não escrever à mão.
- `video.mp4` — render da composition **`BrandStory`** (`src/BrandStory.tsx`; `AdVideo` é estática de referência), sempre **1080×1920 (9:16)**.
- Na tela aparecem `scenes[].type` (eyebrow), `scenes[].text` (headline), o subtexto e — no card final — o **`cta`**, que vira a pílula azul (com `cta` vazio, nenhuma pílula aparece). `concept`, `hook`, `emotional_arc` e `visual_style` são metadados. Duração real = **nº de cenas × 3,0s** (90 frames por cena, sem sobreposição).
- ✅ Corrigido (ago/2026): o card final não carimba mais a frase-tag — usa `props.cta`. As cenas de exemplo do `src/Root.tsx` (o que o Remotion Studio abre e o CLI usa sem `--props`) fecham com *"Acesso por convite."*.
- ⚠️ Aberto: pelo painel, o adaptador de props troca `cta` vazio por `"Conhecer a plataforma"` (`renderVideo` em `interface/lib/render.js`) — a peça sai com uma chamada que a IA não escreveu.
- Schema detalhado e regras: `skills/video-ad-specialist/SKILL.md` (fonte de verdade).

---

## 4. Copywriter Agent

Propósito:
Transformar output de pesquisa em **copy de marketing platform-native** para Instagram, Threads/X, YouTube e LinkedIn.

Skill File: `skills/copywriter-agent/SKILL.md`

Responsabilidades:
- Selecionar um ângulo de campanha consistente a partir do output de pesquisa
- Escrever copy platform-specific adaptado em tom, tamanho, CTA e formato de hashtag
- Gerar JSON estruturado e arquivos de texto individuais por plataforma

Output Típico (salvo em `outputs/<task_name>_<date>/copy/`):
- `instagram_caption.txt` — hook factual com número + benefício + CTA (opcional) + 3–5 hashtags. **Também é o arquivo da peça "4Selet na Mídia"** (legenda de prova social)
- `instagram_carousel.json` — roteiro de 4–7 slides + caption (eyebrow, slides[] com title/body/layout, hashtags, cta)
- `threads_post.txt` — provocação controlada com dado, ≤500 characters, 0–1 hashtag
- `linkedin_post.txt` — editorial premium (1.200–1.500 chars) com tese, dados e CTA suave
- `youtube_metadata.json` — **legado**: nenhum tipo do painel ou do pipeline gera isso, e não há publicação no YouTube

> No painel, **uma peça = um tipo = um arquivo** (não existe pacote `copy.json`). O texto passa por um gate de governança em runtime (`runBrandGovernance`, `interface/lib/validation.js`) que **bloqueia a gravação com HTTP 422** quando encontra: **concorrente citado**, **emoji banido**, **número oficial da campanha contraditório** ou a **frase-tag assinando a peça** (esta última só é liberada quando o próprio brief pede a frase). **CTA de urgência fake é AVISO, não bloqueio** — os padrões são pedaços de frase ("não perca" casa com "não perca margem") e a tela não oferece "salvar assim mesmo", então erro duro ali prenderia quem escreveu copy legítima.

---

## 5. Distribution Agent

Propósito:
Conferir o que é publicável, montar metadata publish-ready, recomendar agendamento e **descrever o gate** que protege a publicação real.

Skill File: `skills/distribution-agent/SKILL.md`

Responsabilidades:
- Localizar a arte publicável (`ads/feed.png` 4:5 ou `slides/slide_N.png`) e a legenda (`copy/instagram_caption.txt`)
- Montar metadata final por plataforma
- Gerar recomendações de agendamento (LinkedIn 2ªf → Instagram 3ªf → Reels/Threads 5ªf — ver `platform_guidelines.md`)
- Escrever `distribution/plan.md` (é o que o pipeline grava)
- **Nunca publicar** — reportar o status do gate

Como a publicação real funciona hoje (**no painel**, `interface/lib/publish.js` + `interface/routes/publish.js`):
- **Instagram feed** via Graph API v21.0 — **imagem única e carrossel**. Vídeo/Reels/Stories **não são publicáveis** (fase 1)
- A mídia chega na Meta por um **link público temporário** `/m/:token` (TTL 20 min, base em `public_base_url`) — **não** por Supabase
- Token do Instagram é colado em **Configurações > Publicação Instagram** (admin) e gravado em `interface/data/publish.json`; o `ig_user_id` é descoberto pelo botão "Testar". A variável `IG_ACCESS_TOKEN` **não é lida**
- **Gate R5:** peça em `outputs/approved/` + `status.status === "approved"` + `content_hashes` conferidos em runtime (exclui `status.json` e `preview.html`) + confirmação humana + `dryRun: false` + Instagram conectado + peça não publicada antes
- **Agendamento executável** (`interface/lib/schedule.js`), histórico de publicados (`interface/lib/publications.js`) e travas anti-duplicidade (`E_ALREADY_SCHEDULED`, `E_ALREADY_PUBLISHED`, `publishingNow`, "Marcar como já publicada")
- **YouTube:** não existe publisher — estado permanente de manual/mock. **Threads/X e LinkedIn:** post manual
- ⚠️ **Não existe mais "Publish MD":** nenhum script gera `Publish <task> <date>.md`, e o gate não depende de citá-lo. Supabase e `media_urls.json` são caminho legado (arquivo de campanha), não pré-requisito de publicação

Output Típico (salvo em `outputs/<task_name>_<date>/`):
- `distribution/plan.md` — metadata por plataforma, agendamento recomendado e status do gate
- `pipeline_run.json` — resumo da run (quando veio do pipeline)

---

# Workflow de Aprovação — Níveis 1+2 (v1.1)

Camada de governança sobre os 5 agentes + orchestrator (7 skills no total, incluindo o task-promoter). Transforma artefatos em entregáveis com **trilha rastreável de revisão**, **integridade pós-aprovação** (SHA-256) e **gate duplo de publicação** (estado lógico + hashes em runtime).

## Máquina de estados

```
null → draft → in_review → approved → in_review (rework)
                       └── rejected → in_review
                       (approved também pode auto-revert para draft via check_approved_integrity)
```

Cada task tem `status.json` na raiz (versionado em git como fonte da verdade): `task_name`, `task_date`, `status`, `created_at`, `last_updated_at`, `approved_by`, `approved_at`, `campaign_angle`, `platforms`, `content_hashes` (SHA-256 por arquivo, em approved), `history` (append-only). Detalhes em `SPEC_WORKFLOW_APROVACAO.md` v1.1.

## Localizações

| Status | Pasta | Versionado em git |
|---|---|---|
| `draft` / `in_review` | `outputs/<task>_<date>/` | ❌ (ignorado pelo .gitignore) |
| `approved` | `outputs/approved/<task>_<date>/` | ✅ |
| `rejected` | `outputs/archive/<task>_<date>/` | ✅ |

## Scripts (em `scripts/`)

| Script | Propósito |
|---|---|
| `orchestrator.js` | Bootstrap idempotente de `status.json` (wrapper sobre `lib/status_bootstrap.js`) |
| `generate_preview.js` | Gera `preview.html` (single-file, 6 seções + checklist de 6 regras de marca) e promove `draft → in_review` |
| `promote_task.js` | **Único ponto** de transição. Calcula `content_hashes` (excluindo `status.json` e `preview.html`) ao transicionar para `approved`. Move pasta atomicamente |
| `refresh_index.js` | Regenera `outputs/approved/INDEX.md` |
| **`check_approval_gate.js`** ⚠️ | **Gate duplo (R5)** — verifica `status === approved` E `content_hashes` em RUNTIME antes de qualquer post. Lança `E_INVALID_STATE` / `E_HASH_MISMATCH` / `E_GATE_NO_HASHES` |
| `check_approved_integrity.js` | Varre `outputs/approved/`; com `--auto-revert` move tasks editadas para `draft` com `event_type="edit_revert"` e `previous_approval` preservado |
| `migrate_legacy.js` | Bootstrap retroativo de tasks pré-Workflow (`legacy: true`) |
| `validate_status.js` | Auditoria — schema, zona vs status, hashes em approved |

Módulos compartilhados em `scripts/lib/`: `content_hash.js` (SHA-256 + `diffHashes`), `status_bootstrap.js`.

## Regra CRITICAL Re-aprovação

As 4 skills de conteúdo (`ad-creative-designer`, `video-ad-specialist`, `copywriter-agent`, `marketing-research-agent`) **NÃO** podem escrever em `outputs/approved/<task>/`. Para editar:

```bash
node scripts/promote_task.js --task <name> --date <date> --to in_review
```

Isso move a pasta de volta para `outputs/<task>_<date>/`. Reaprovação obrigatória antes de publicar. Contracheque automático via `check_approved_integrity.js --auto-revert` detecta edições silenciosas e reverte (preservando `previous_approval`).

## Gate de publicação

**No painel (caminho real de publicação — Instagram feed):** todas estas invariantes, em `interface/lib/publish.js` + `interface/routes/publish.js`:

1. ⚠️ **R5:** peça em `outputs/approved/` **e** `status.status === "approved"` **e** `content_hashes` conferidos em runtime (`assertApproved`; exclui `status.json` e `preview.html`).
2. ✅ Confirmação humana no painel ("Publicar ou agendar").
3. ✅ `dryRun: false`.
4. ✅ Instagram conectado (token em `interface/data/publish.json`, via Configurações — a env `IG_ACCESS_TOKEN` **não é lida**).
5. ✅ Peça ainda não publicada (`E_ALREADY_PUBLISHED`) e nenhuma publicação em voo (`publishingNow`).

**No caminho CLI/agente:** `node scripts/check_approval_gate.js` (ou `assertPublishApproved({taskName, date})`) — mesma invariante, implementação separada, erros `E_TASK_NOT_FOUND`/`E_INVALID_STATE`/`E_GATE_NO_HASHES`/`E_HASH_MISMATCH`.

Falha em qualquer = não publicar essa task (não bloqueia outras). **Vídeo, Stories e YouTube não são publicáveis hoje.**

## Comandos diários

```bash
# 1) Criar task
node scripts/orchestrator.js --task <name> --date YYYY-MM-DD --platforms instagram,youtube

# 2) Rodar agentes (Claude executa cada SKILL.md em ordem, cada uma respeita CRITICAL Re-aprovação)

# 3) Gerar preview + promover para revisão
node scripts/generate_preview.js --task <name> --date YYYY-MM-DD

# 4) Aprovar (humano)
node scripts/promote_task.js --task <name> --date YYYY-MM-DD --to approved --by "<aprovador>"

# 5) Verificar antes de publicar (R5)
node scripts/check_approval_gate.js --task <name> --date YYYY-MM-DD

# Auditoria periódica
node scripts/check_approved_integrity.js [--auto-revert]
node scripts/validate_status.js
```

Detalhes operacionais em `GUIA_DE_USO.md` §23.

## Validação (testes que passaram)

- **10/10 caminhos felizes** (bootstrap → preview → approve → rework → reject)
- **7/7 adversariais** (B.1.1–B.1.7): `E_INVALID_TRANSITION`, `E_MISSING_APPROVER`, `E_UNKNOWN_STATE`, `E_STATUS_PARSE`, `E_DUPLICATE_LOCATION`, idempotência
- **3/3 runtime de integridade** (B.2.1–B.2.3): edit detection sem mutação · `--auto-revert` restaura com `previous_approval` · gate bloqueia task vazia com `E_GATE_NO_HASHES`

## Backup remoto

`outputs/approved/` versionado em git local. **Falta configurar remote** — instruções em `GIT_REMOTE_SETUP.md`. Hook `post-commit` instalado em `.git/hooks/post-commit` (push automático em background quando remote estiver configurado). Sem remote, falha de disco apaga `history[]`, `content_hashes`, decisões de approver.

---

# Knowledge Files

Todos os agentes devem referenciar os seguintes knowledge files localizados no diretório **knowledge/**. São a fonte de verdade da marca 4Selet e devem ser lidos **antes** de qualquer geração.

> ⚠️ **Estes arquivos NÃO são documentação passiva.** `interface/lib/knowledge.js` (`brandContext()`) injeta `brand_identity.md` + `product_campaign.md` + `platform_guidelines.md` **literalmente** no system prompt de toda geração do painel (`interface/lib/prompts.js`), precedidos de *"Use EXCLUSIVAMENTE os knowledge files oficiais abaixo como fonte de verdade da marca"*. **Editar um deles muda a geração em produção agora.** Qualquer divergência em relação ao bloco `GOVERNANCE` do mesmo arquivo chega ao modelo como ordem contraditória.

### brand_identity.md
*4Selet — Brand Identity Guide (v1.2 · Julho/2026)*

Define:
- posicionamento e essência da marca (*"Para quem sabe que é Selet."*) e o DNA de exclusividade (acesso por convite)
- as 5 colunas estratégicas (Experiência, Lucratividade, Sabedoria, Exclusividade, Segurança), público-alvo primário/secundário e personalidade de marca (*Sóbrio. Estruturado. Estrategista*)
- identidade visual: **paleta oficial** (Selet Darker `#07212B`, Navy `#003554`, Blue `#006494`, Sky `#5499B5`, Mist `#AFBCC9`, Cloud `#D9DCD6`) e tipografia (**Inter** para tudo; **JetBrains Mono** só para snippets técnicos)
- voice & tone, regras de emoji (máx 1 funcional em captions), CTAs aprovados/proibidos e estratégia de hashtags
- as 3 **frases-tag oficiais** — com a **regra dura**: *"Para quem sabe que é Selet."* **não assina peça** (não é rodapé, fecho, headline nem legenda); só entra se o brief pedir
- os **6 pilares de conteúdo** (eixo temático da peça) e a seção **4Selet na Mídia** (prova social de imprensa)
- regra de fotografia atualizada: **foto de banco (Pexels) é permitida** desde que tratada na marca e usada como fundo
- o **brand governance checklist** (7 perguntas + a 8ª sobre a frase-tag) e a seção *What 4Selet Is Not* (lista fechada de concorrentes proibidos em criativos abertos)

Usado por: **o painel (injetado no prompt de todos os 8 tipos)** e pelas skills dos cinco agentes

---

### product_campaign.md
*Product & Campaign Knowledge: 4Selet (v1.2 · Maio/2026)*

Define:
- visão geral do produto, fundadores, domínios e canais oficiais (contato comercial: **Flávio del Lima — WhatsApp (62) 98310-1414**)
- portfólio (Plataforma 4Selet core + Termômetro + VPS), métodos de pagamento por status e o processo de **migração em 5 etapas**
- a **campanha Taxa Zero** completa (0% por 3 meses ou R$ 300 mil, R$ 1,99/transação, PIX D+10, cartão D+30) e o banco de headlines aprovadas
- os **9 Diferenciais Oficiais** (Checkout Amigável · Líder em Aprovação 95%+ · Área de Membros Imersiva · Gestor de Conta Dedicado · Premiação 4Selet · Redundância Inteligente · Ofertas Flexíveis · 4Selet FlexPay · Migração Facilitada)
- a prova-âncora *95% de aprovação no cartão* e o ângulo killer *12x (participação nos juros)*
- visual assets, motion style (editorial sóbrio azul), specs Remotion e 4 conceitos de vídeo (Os 4 Números · Vs. Mercado · O Convite · Migração Sem Trauma)
- estrutura de persuasão em 6 passos e glossário operacional

Usado por: Marketing Research Agent · Ad Creative Designer · Video Ad Specialist · Copywriter Agent

---

### platform_guidelines.md
*Platform Guidelines: 4Selet (v1.2 · Julho/2026)*

Define best practices, specs de formatação e calibração de tom por plataforma:

- **Instagram** — **feed 4:5 (1080×1350, o publicável)**, imagem/anúncio 1:1, story 9:16, site 16:9; design rules de paleta/tipografia/Selet Dots, margem segura **88–104px**, estrutura de caption, hashtags 3–5 (só `#4Selet` obrigatória), regras de carrossel e a seção **2.6 — 4Selet na Mídia** (formatos, 10 modelos, regras de conteúdo)
- **Threads / X** — provocação controlada com dado, máx 1 hashtag, sem auto-depreciação, números específicos obrigatórios
- **YouTube** — titles 60–70 chars, descriptions, thumbnails Navy/Darker, hook nos primeiros 5s. **Referência editorial apenas:** não há tipo de conteúdo, render nem publicação de YouTube no sistema
- **LinkedIn** — posts editoriais premium 1.200–1.500 chars, autoridade técnica, 3–5 hashtags, sem auto-depreciação
- quick reference cheat sheet, tom & voz por plataforma e o **sequenciamento de distribuição** (LinkedIn 2ªf → Instagram 3ªf → YouTube 4ªf → Reels/Threads 5ªf → Story 6ªf)

Usado por: Ad Creative Designer · Copywriter Agent · Distribution Agent

---

# Assets

`assets/` contém os assets reais da marca 4Selet — logos oficiais, kit de identidade visual e vídeos de campanha para referência.

### Logos oficiais (raiz de `assets/`)

| Arquivo | Uso |
|---|---|
| `logo-4selet.png` | Logo completo (dark) — para fundos claros |
| `logo-4selet-light.png` | Logo completo (light) — para fundos escuros (Navy/Darker) |
| `logo-4selet.svg` | Logo completo vetorial escalável |
| `simbolo.svg` | Símbolo "4" isolado — favicon, monograma, accent decorativo |

### Kit de Identidade Visual (`assets/brand-identity/`)

Kit oficial com 31 imagens de alta resolução + gerador HTML/Node. Estrutura:

```
assets/brand-identity/
├── 01-logos/              ← logos (dark/light/SVG) + símbolo + showcases (Cloud/Navy)
├── 02-cores/              ← palette-board.png + 6 swatches individuais da paleta
├── 03-tipografia/         ← inter-specimen.png
├── 04-texturas-padroes/   ← Selet Dots (dots-navy, dots-darker, dots-blue-on-cloud)
├── 05-fundos/             ← 10 backgrounds prontos (sólidos + gradiente radial em 1:1/4:5/9:16/16:9)
├── 06-social-templates/   ← 5 templates com área segura (IG feed/square/story, LinkedIn, YouTube thumb)
├── _html/                 ← generate.js + manifest.json (gerador dos assets)
└── README.md              ← mapa de uso do kit
```

### Vídeos de referência (`assets/reference-videos/`)

Vídeos da campanha de Abril/2026 para **referência de tom/estilo** (não para reuse direto):

| Arquivo | Formato | Referência |
|---|---|---|
| `4Selet-Edit-Copy-1.mp4` | Long-form | Roteiro institucional |
| `Ads-03_1080x1350.mp4` | Feed 4:5 | Pacing e tipografia editorial |
| `Ads-03_1080x1920.mp4` | Story/Reel 9:16 | Adaptação para vertical |
| `Ads-04_1080x1350.mp4` | Feed 4:5 | Hook + prova |
| `Ads-05_1080x1350.mp4` | Feed 4:5 | Fechamento / CTA |

> **Regra crítica de uso:** logo light em fundos escuros, dark em fundos claros, sem efeitos. Paleta e tipografia oficiais sempre — ver `knowledge/brand_identity.md`. Screenshots da plataforma sempre com dados mascarados.

### Materiais de Referência da Marca

- **Kit `brand-identity/`** — fonte canônica de logos, cores, tipografia, padrões Selet Dots, fundos e templates sociais (com `README.md` e gerador em `_html/`).
- **Vídeos de campanha (`reference-videos/`)** — material de referência de motion/editorial para o Video Ad Specialist.
- **Deck oficial de proposta de parceria** (referenciado nos knowledge files): contém as frases-tag, os 9 diferenciais, as 5 etapas de migração e a tabela de faixas de faturamento/participação 12x. É **material comercial restrito** — não reproduzir em criativo aberto.

---

# Estrutura da Pasta de Output do Pipeline

```
outputs/<task_name>_<date>/
├── status.json                   ← fonte da verdade do workflow (estado, hashes, pilar, mídia)
├── render.json                   ← variantes de marca da peça (logo, marca d'água, template)
├── research/insights.md          ← Research (advisory do pipeline; NÃO usa Tavily)
├── ads/
│   ├── concept.json              ← Ad Creative Designer (blueprint, schema plano)
│   ├── ad.html                   ← arte em HTML (CSS inline)
│   ├── ad.png                    ← Playwright 1080×1080 @2x (+ ad.editable.json · ad.bg.png)
│   ├── feed.png                  ← 1080×1350 (peça de feed · o publicável no Instagram)
│   └── square.png · story.png · media_16x9.png   ← formatos da peça "4Selet na Mídia"
├── slides/slide_N.png            ← carrossel (1080×1350 por slide)
├── story/story_N.png             ← Story Instagram (1080×1920 por cartão)
├── video/
│   ├── concept.json              ← Video Ad Specialist (schema PLANO — o arquivo canônico)
│   ├── scenes.json               ← derivado (props do Remotion, escrito pelo render)
│   └── video.mp4                 ← Remotion, composition BrandStory, 1080×1920
├── copy/
│   ├── instagram_caption.txt     ← feed OU "4Selet na Mídia"
│   ├── instagram_carousel.json   ← roteiro do carrossel
│   ├── instagram_story.json      ← roteiro dos cartões do Story
│   ├── threads_post.txt
│   └── linkedin_post.txt
├── distribution/plan.md          ← Distribution (advisory; nunca publica)
├── pipeline_run.json             ← resumo consolidado da run
└── preview.html                  ← gerado por scripts/generate_preview.js (draft → in_review)
```

> **Não existem mais** (eram do contrato antigo): `research_results.json` (legado do CLI), `media_urls.json`, `ads/layout.json`, `ads/styles.css`, `ads/instagram_ad.png`, `copy/copy.json`, `Publish <task> <date>.md` e a pasta `logs/` — o pipeline executável escreve no console e consolida em `pipeline_run.json`.

> A pasta `outputs/` **já contém artefatos**: tasks de validação end-to-end, dezenas de peças "4Selet na Mídia" (`outputs/midia_*`), além das tasks aprovadas em `outputs/approved/`. A árvore acima é o **layout-alvo** — cada peça tem só os arquivos do seu tipo. Zonas: `outputs/` (draft/in_review), `outputs/approved/`, `outputs/archive/` (rejeitadas) e `outputs/_archived/` (descartadas pelo painel — o `promote_task.js` não enxerga essa zona).

---

# Tech Stack

| Ferramenta | Propósito | Status |
|---|---|---|
| Node.js + npm | Runtime / registry | ✅ Instalado (v24.16.0) |
| Remotion + React | Rendering de video ads (React + SVG) | ✅ Instalado (4.0.469 / React 19) |
| Playwright (`chromium`) | Rendering HTML-to-PNG de ads | ✅ Instalado |
| BullMQ + Upstash Redis | Job queuing e worker orchestration | ✅ `pipeline/` entregue · ⏳ falta `REDIS_URL` (roda sequencial sem ele) |
| Tavily AI SDK (`@tavily/core`) | Pesquisa de mercado ao vivo no painel (`interface/lib/research.js`) | ✅ Ativo/Configurado (opt-in; chave em `interface/data/tavily.json`) |
| Claude (Anthropic) + ChatGPT (OpenAI) | Geração de conteúdo — multi-provedor (`interface/lib/ai.js`) | ✅ Ativo/Configurado (`ANTHROPIC_API_KEY` em `interface/.env`; produção mostra "IA conectada") |
| Autenticação do painel (`interface/lib/auth.js`) | Login multi-usuário, perfis admin/membro, sessão HMAC | ✅ Ativo (em produção) |
| Supabase (`@supabase/supabase-js`) | Hosting de mídia (caminho legado — **não** é usado na publicação) | ⏳ Pendente (SDK + chaves) |
| Pexels (`interface/lib/pexels.js`) | Busca de fotos para arte e fundo de slide | ✅ Ativo (chave em `interface/data/pexels.json`, via Configurações) |
| Instagram Graph API (v21.0) | Publicação no Instagram (`interface/lib/publish.js`) | ✅ Ativo/Configurado (feed: imagem + carrossel, gate R5 + agendamento). Vídeo/Reels/Stories **não publicáveis** |
| YouTube Data API | Publicação no YouTube | ❌ **Não implementada** — não existe publisher (não é só OAuth pendente) |

> **Status do stack (2026-06-12):** o **painel web** (`interface/`) está **em PRODUÇÃO** em `https://mkt.4st.co` (Docker Compose), com **autenticação multi-usuário** (`lib/auth.js`), **geração multi-provedor Claude + ChatGPT** (`lib/ai.js`), **pesquisa Tavily ao vivo** (`lib/research.js`) e **publicação real no Instagram feed** via Graph API v21.0 com agendamento (`lib/publish.js` + `lib/schedule.js`, atrás do gate R5). A pasta **`pipeline/`** (BullMQ + worker), `package.json`, `skills/` (7 skills), `src/` (Remotion) e as deps **Remotion + React** e **Playwright + Chromium** já estão criados/instalados. Faltam apenas **chaves/contas externas**: chave de IA no painel (Anthropic e/ou OpenAI), `REDIS_URL` (ativa a fila; sem ele roda sequencial), `@supabase/supabase-js` + Supabase, e **OAuth YouTube** (publicação no YouTube **não existe** no painel). Sem elas, hosting/YouTube rodam em **modo simulado**. Fonte de verdade do progresso: `STATUS_PROJETO.md`.