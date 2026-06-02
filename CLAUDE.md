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

> **Estado de implementação (2026-06-02):**
> **PRONTO ✅** — knowledge files (`knowledge/`), assets de marca (`assets/`), as **7 skills** em `skills/` (5 agentes + orchestrator + **task-promoter**), o projeto **Remotion** em `src/` (composition `AdVideo` + `CampanhaDemo`), `package.json` / `tsconfig.json` / `remotion.config.ts` / `.gitignore`, e dependências instaladas (**Node v24.16.0, git v2.54.0, Remotion 4.0.469 + React 19, Playwright + Chromium**). **Workflow de Aprovação Níveis 1+2 (v1.0)** implementado: 7 scripts em `scripts/` + módulos em `scripts/lib/` (content_hash, status_bootstrap), `status.json` por task como fonte da verdade, `outputs/approved/` e `outputs/archive/` versionados em git, 10 testes felizes + 7 adversariais validados.
> **PENDENTE ⏳** — a pasta `pipeline/` (BullMQ `orchestrator.js` + `worker.js`) e os scripts npm `pipeline:run`; e os **SDKs/chaves externos**: `@tavily/core` + `TAVILY_API_KEY`, `@supabase/supabase-js` + Supabase, `bullmq` + Redis, OAuth YouTube / token Instagram. Enquanto a fila BullMQ não existe, o orchestrator roda em **modo sequencial**; research/hosting/posting rodam **simulados** sem as chaves.
> **Documentação de referência** (ordem de leitura): 1) `STATUS_PROJETO.md` — estado atual · 2) `GUIA_DE_USO.md` — passo a passo (§23 Workflow) · 3) `SPEC_WORKFLOW_APROVACAO.md` — contrato v1.1 · 4) `skills/<nome>/SKILL.md` — comportamento por agente.
> ⚠️ **Regra CRITICAL Re-aprovação** ativa nas 4 skills de conteúdo: NÃO editar `outputs/approved/<task>/` diretamente — rework via `node scripts/promote_task.js --to in_review`.

---

# Orchestrator

O Orchestrator não é um agente — é uma skill de coordenação que gerencia o pipeline completo.

Skill File: `skills/orchestrator/SKILL.md`

Responsabilidades:
- Aceitar um Job Payload (JSON) com `task_name`, `task_date`, `platform_targets` e skip flags opcionais
- Validar o payload e enforçar a ordering de dependências
- Enqueue todos os agent jobs na fila BullMQ `ai-content-pipeline` via `pipeline/orchestrator.js`
- Iniciar o BullMQ worker (`pipeline/worker.js`) para processar jobs enfileirados
- Rastrear status dos jobs via log files em `outputs/<task_name>_<date>/logs/`
- Reportar conclusão do pipeline e surfacear o Publish MD file gerado

### Comandos do Pipeline

```bash
npm run pipeline:run                     # rodar com payload padrão
npm run pipeline:run:payload '<json>'    # rodar com JSON payload inline
node pipeline/worker.js                  # iniciar o BullMQ worker (terminal separado)
```

> ⏳ **Pendente:** `pipeline/orchestrator.js`, `pipeline/worker.js` e os scripts `pipeline:run` ainda não existem. Hoje o orchestrator **valida o payload e monta o plano** via `node skills/orchestrator/scripts/orchestrate.js --file <payload.json>` e os agentes rodam em **modo sequencial** (sem fila). Os comandos acima são o alvo com BullMQ + Redis.

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

Output Típico (salvo em `outputs/<task_name>_<date>/`):
- `research_results.json` — dados estruturados machine-readable consumidos por agentes downstream
- `research_brief.md` — report Markdown human-readable com gráficos Mermaid
- `interactive_report.html` — dashboard interativo estilizado com a marca usando Chart.js

---

## 2. Ad Creative Designer

Propósito:
Gerar **criativos de anúncio estáticos** como design JSON estruturado, depois renderizar para PNG via **Playwright**.

Skill File: `skills/ad-creative-designer/SKILL.md`

Responsabilidades:
- Selecionar tipo de layout do ad (Product Focus, Split ou Lifestyle) baseado na plataforma e objetivo da campanha
- Gerar copy de marketing (headline ≤4 palavras, subtext, CTA)
- Gerar um design JSON spec
- Gerar `ad.html` + `styles.css` a partir do layout spec
- Renderizar o HTML para PNG screenshot 1080×1080 usando Playwright (`chromium.launch()`)

Output Típico (salvo em `outputs/<task_name>_<date>/ads/`):
- `layout.json` — especificação de design
- `ad.html` + `styles.css` — HTML ad gerado
- `instagram_ad.png` — screenshot renderizado via Playwright a 1080×1080

---

## 3. Video Ad Specialist

Propósito:
Gerar conceitos de video ad short-form e **estruturas de scene Remotion-ready**.

Skill File: `skills/video-ad-specialist/SKILL.md`

Responsabilidades:
- Gerar um conceito de vídeo (hook, arco emocional, estilo visual, intenção de CTA)
- Construir um breakdown scene-by-scene (Hook → Product Showcase → Benefit → CTA)
- Gerar scene JSON para renderização Remotion
- Renderização real via a composition Remotion **`AdVideo`** em `src/` (React + SVG, `useCurrentFrame()`/`interpolate()`, fontes via `@remotion/google-fonts`) — rodar com `npm run render`. *(Não existe skill `remotion-best-practices`; o mecanismo de render é o projeto Remotion em `src/`.)*

Output Típico (salvo em `outputs/<task_name>_<date>/video/`):
- `scenes.json` — scene JSON no schema canônico `composition` / `props`: no topo `composition` (ex.: `"AdVideo"`); dentro de `props`, os campos `style`, `duration` (segundos), `platform` e `scenes[]`. Cada scene tem `type` + `text` obrigatórios e `visual` / `transition` / `animation` opcionais.
- Schema detalhado e regras de marca: `skills/video-ad-specialist/SKILL.md` (fonte de verdade).

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
- `instagram_caption.txt` — hook factual com número + benefício + CTA + 3–5 hashtags
- `threads_post.txt` — provocação controlada com dado, ≤500 characters, 0–1 hashtag
- `youtube_metadata.json` — title (60–70 chars), description e keyword tags
- `linkedin_post.txt` — editorial premium (1.200–1.500 chars) com tese, dados e CTA suave

---

## 5. Distribution Agent

Propósito:
Hospedar mídia no **Supabase**, montar metadata publish-ready, gerar recomendações de agendamento e gate-protect a publicação real.

Skill File: `skills/distribution-agent/SKILL.md`

Responsabilidades:
- Fazer upload de todos os media files da campanha para o bucket de storage `campaign-uploads` do Supabase
- Gerar public URLs e salvar em `media_urls.json`
- Montar metadata final por plataforma a partir dos outputs do Copywriter Agent
- Gerar recomendações de agendamento baseadas no sequenciamento de distribuição (LinkedIn 2ªf → Instagram 3ªf → YouTube 4ªf → Reels/Threads 5ªf — ver `platform_guidelines.md`)
- Escrever um arquivo advisory `Publish <task_name> <date>.md`
- Executar posting real via API **somente** quando o usuário referenciar explicitamente o Publish MD file pelo nome

Plataformas:
- **Instagram** — Graph API (`/media` + `/media_publish`)
- **YouTube** — YouTube Data API (requer OAuth `YOUTUBE_REFRESH_TOKEN`)
- **Threads / X** — Sem API pública estável; texto do post é incluído no Publish MD para posting manual
- **LinkedIn** — texto incluído no Publish MD para posting manual

Output Típico (salvo em `outputs/<task_name>_<date>/`):
- `media_urls.json` — URLs públicas do Supabase para toda mídia uploaded
- `Publish <task_name> <date>.md` — advisory completo com captions, metadata, agendamento e instruções de publicação

---

# Knowledge Files

Todos os agentes devem referenciar os seguintes knowledge files localizados no diretório **knowledge/**. São a fonte de verdade da marca 4Selet e devem ser lidos **antes** de qualquer geração.

### brand_identity.md
*4Selet — Brand Identity Guide (v1.1 · Maio/2026)*

Define:
- posicionamento e essência da marca (*"Para quem sabe que é Selet."*) e o DNA de exclusividade (acesso por convite)
- as 5 colunas estratégicas (Experiência, Lucratividade, Sabedoria, Exclusividade, Segurança), público-alvo primário/secundário e personalidade de marca (*Sóbrio. Estruturado. Estrategista*)
- identidade visual: **paleta oficial** (Selet Darker `#07212B`, Navy `#003554`, Blue `#006494`, Sky `#5499B5`, Mist `#AFBCC9`, Cloud `#D9DCD6`) e tipografia (**Inter** para tudo; **JetBrains Mono** só para snippets técnicos)
- voice & tone, regras de emoji (máx 1 funcional em captions), CTAs aprovados/proibidos e estratégia de hashtags
- as 3 **frases-tag oficiais** (*"Produtor não é número. É parceiro. E parceiro vende junto."* / *"Para quem sabe que é Selet."* / *"A escolha de quem já performa."*)
- o **brand governance checklist** (7 perguntas) e a seção *What 4Selet Is Not* (lista fechada de concorrentes proibidos em criativos abertos)

Usado por: **todos os cinco agentes**

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
*Platform Guidelines: 4Selet (v1.1 · Maio/2026)*

Define best practices, specs de formatação e calibração de tom por plataforma:

- **Instagram** (feed 4:5 / story 9:16 / square 1:1) — design rules de paleta/tipografia/Selet Dots, estrutura de caption, hashtags 3–5 obrigatórias, regras de carrossel
- **Threads / X** — provocação controlada com dado, máx 1 hashtag, sem auto-depreciação, números específicos obrigatórios
- **YouTube** — titles 60–70 chars informativos, descriptions, thumbnails de alto contraste Navy/Darker, hook nos primeiros 5s
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
├── research_results.json         ← Research Agent
├── research_brief.md             ← Research Agent
├── interactive_report.html       ← Research Agent
├── media_urls.json               ← Distribution Agent
├── ads/
│   ├── layout.json               ← Ad Creative Designer
│   ├── ad.html                   ← Ad Creative Designer
│   ├── styles.css                ← Ad Creative Designer
│   └── instagram_ad.png          ← Ad Creative Designer (Playwright render)
├── video/
│   ├── scenes.json               ← Video Ad Specialist (JSON composition/props)
│   └── ad.mp4                    ← Remotion (composition AdVideo em src/ · npm run render)
├── copy/
│   ├── instagram_caption.txt     ← Copywriter Agent
│   ├── threads_post.txt          ← Copywriter Agent
│   ├── linkedin_post.txt         ← Copywriter Agent
│   └── youtube_metadata.json     ← Copywriter Agent
├── logs/
│   ├── research_agent.log
│   ├── ad_creative_designer.log
│   ├── video_ad_specialist.log
│   ├── copywriter_agent.log
│   └── distribution_agent.log
└── Publish <task_name> <date>.md ← Distribution Agent
```

> A pasta `outputs/` **já contém artefatos**: `outputs/test_job_payload_1/` (dry-run end-to-end completo, rotulado TESTE) e `outputs/remotion_test_video/` (vídeo Remotion renderizado + stills). A árvore acima é o **layout-alvo** de uma run completa — nem todo arquivo existe em toda task (ex.: `research_brief.md` / `interactive_report.html` e `logs/` só quando efetivamente gerados; o dry-run atual tem `research_results.json` mas não os reports HTML/Mermaid).

---

# Tech Stack

| Ferramenta | Propósito | Status |
|---|---|---|
| Node.js + npm | Runtime / registry | ✅ Instalado (v24.16.0) |
| Remotion + React | Rendering de video ads (React + SVG) | ✅ Instalado (4.0.469 / React 19) |
| Playwright (`chromium`) | Rendering HTML-to-PNG de ads | ✅ Instalado |
| BullMQ + Upstash Redis | Job queuing e worker orchestration | ⏳ Pendente (`pipeline/` + Redis) |
| Tavily AI SDK (`@tavily/core`) | Pesquisa de mercado via scripts Node.js | ⏳ Pendente (SDK + `TAVILY_API_KEY`) |
| Supabase (`@supabase/supabase-js`) | Hosting de mídia e geração de public URLs | ⏳ Pendente (SDK + chaves) |
| Instagram Graph API | Publicação no Instagram | ⏳ Pendente (token; gated) |
| YouTube Data API | Publicação no YouTube (requer OAuth) | ⏳ Pendente (OAuth; gated) |

> **Status do stack (2026-05-26):** `package.json`, `skills/` (6 skills), `src/` (Remotion) e as deps **Remotion + React** e **Playwright + Chromium** já estão criados/instalados. Falta a pasta `pipeline/` (BullMQ + worker) e os SDKs/chaves externos (`bullmq` + Redis, `@tavily/core`, `@supabase/supabase-js`, OAuth/token). Sem eles, research/hosting/posting rodam em **modo simulado** e o orchestrator roda **sequencial**. Fonte de verdade do progresso: `STATUS_PROJETO.md`.