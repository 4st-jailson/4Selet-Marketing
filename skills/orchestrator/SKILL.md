---
name: orchestrator
description: >
  Skill de COORDENACAO (nao e um agente) do pipeline de marketing 4Selet. Recebe um Job Payload
  (task_name, task_date, brief, platforms, content_types, flags skip_research/skip_video/
  skip_distribution/skip_render) e roda o pipeline respeitando dependencias: research primeiro,
  depois UM job criativo por tipo de conteudo, depois distribution e o preview_generator (que
  promove draft -> in_review). Valida o payload, aplica skips, rastreia o status de cada job e
  reporta a conclusao apontando distribution/plan.md e pipeline_run.json. Modo de execucao:
  SEQUENCIAL por padrao (sem Redis) ou enfileirado BullMQ+Redis quando configurado. Use quando o
  usuario submeter um job payload, pedir "rodar o pipeline", "pipeline:run", "orquestrar a
  campanha" ou "rodar todos os agentes". NUNCA publica conteudo — a publicacao real acontece no
  painel, atras do gate de aprovacao.
license: MIT
metadata:
  author: Marketing 4Selet
  version: 2.0.0
  category: marketing
  tags: [orchestration, pipeline, bullmq, redis, 4selet]
---

# Orchestrator

Coordena o pipeline de conteudo 4Selet a partir de **um Job Payload**: valida, resolve dependencias e skips, dispara os jobs na ordem certa, rastreia status e reporta — **sem publicar**.

## Onde isto se encaixa

Existem **dois caminhos** de operacao, e eles compartilham os mesmos scripts de estado:

| Caminho | O que e | Quando usar |
|---|---|---|
| **Painel web** (`interface/`, producao em `https://mkt.4st.co`) | **Caminho principal.** O usuario cria uma peca por vez pela interface; o painel garante a task chamando o mesmo `scripts/orchestrator.js`, e faz preview/promote pelos mesmos `generate_preview.js` e `promote_task.js` | Operacao do dia a dia |
| **Pipeline** (`pipeline/orchestrator.js` + `worker.js` + `agents.js`) | Via **em lote/CLI**: gera varias pecas de uma vez a partir de um brief | Campanha inteira de uma vez, automacao |

**Os 8 tipos de conteudo atuais** (`interface/lib/config.js`): `instagram_caption`, `instagram_carousel`, `instagram_story` ("Story Instagram"), `ad_creative`, `media_mention` ("4Selet na Midia"), `video_idea`, `linkedin_post`, `threads_post`.

> **Atencao:** o default do pipeline (`ALL_CONTENT_TYPES`, em `pipeline/agents.js`) e **derivado de `CONTENT_TYPES`** — sao os **7 tipos**, com `media_mention` de fora. "4Selet na Midia" fica fora de proposito: a peca depende de um print da materia que alguem precisa enviar, e sem esse insumo sairia vazia. Para gerar uma, passe o tipo explicitamente em `content_types`. (Ate agosto/2026 a lista era copiada a mao e tinha perdido tambem o `instagram_story`; agora, tipo novo no painel entra sozinho no pipeline.)

## When to Use This Skill

- Usuario submete um Job Payload (JSON) ou pede "rodar o pipeline", "pipeline:run", "orquestrar a campanha".
- Precisa coordenar a geracao de varias pecas de ponta a ponta para uma task.

**NAO use para** gerar uma unica peca (chame a skill do agente, ou use o painel) nem para publicar.

## CRITICAL: modos de execucao

- **Sequencial (padrao):** sem `REDIS_URL`, `pipeline/orchestrator.js` roda os jobs aqui mesmo, em ordem.
- **Enfileirado (BullMQ + Redis):** com `REDIS_URL` + `bullmq`, faz enqueue na fila `marketing-pipeline`; `pipeline/worker.js` (ja entregue e executavel, commit e787dc7) processa.
- O script empacotado `skills/orchestrator/scripts/orchestrate.js` e o **caminho historico**: valida o payload e gera o **plano** (`pipeline_plan.json` + `logs/`), mas **nao roda** os agentes.

## CRITICAL: reconciliacoes com o contrato real

- **Pasta canonica:** `outputs/<task_name>_<date>/` (underscore, dir unico).
- **O eixo de execucao e `content_types`, nao "os 5 agentes".** No executavel nao existem jobs chamados `ad_creative_designer`, `video_ad_specialist` ou `copywriter_agent` — ha **um job por tipo de conteudo**, nomeado com o **id do tipo**.
- **`platforms`, nao `platform_targets`:** o pipeline executavel le **`payload.platforms`** e cai para `["instagram"]` se ausente. `platform_targets` so e lido pelo `orchestrate.js` legado — **nao e alias**. Um payload com `platform_targets` passado ao pipeline perde as plataformas em silencio.
- **`dry_run` nao tem efeito** no pipeline executavel: ele chama a IA de verdade e renderiza. O unico modo "sem chamada real" e nao haver chave de IA configurada (o resultado volta com `simulated: true`). Para pular o render, use `--no-render` / `skip_render`.
- **Pipeline NUNCA publica** automaticamente.

## Inputs — Job Payload

```json
{
  "task_name": "taxa_zero_maio",
  "task_date": "2026-05-26",
  "brief": "Anunciar a Taxa Zero para produtores estabelecidos (50k+/mes)",
  "platforms": ["instagram", "linkedin"],
  "content_types": ["instagram_caption", "instagram_carousel", "ad_creative"],
  "user_flags": { "skip_research": false, "skip_video": false, "skip_distribution": false, "skip_render": false },
  "angle": null,
  "campaign_id": null
}
```

**Obrigatorios no pipeline executavel:** `task_name`, `task_date` **e `brief`** (min. 8 caracteres) — sem `brief`, sai com exit 2.

`content_types` escolhe quais pecas gerar; ausente, usa a lista default de 7 (todos, menos `media_mention`).

## Step 1: Intake + validacao

Pelo pipeline executavel (argumentos sao obrigatorios — `npm run pipeline:run` sozinho falha com *"[pipeline] obrigatorios: --task, --date e --brief"*):

```bash
npm run pipeline:run -- --task <task> --date <YYYY-MM-DD> --brief "<brief>"
```

Pelo caminho historico (so planeja):

```bash
node skills/orchestrator/scripts/orchestrate.js --file <payload.json>
```

## Step 1.5: Inicializar status.json (Workflow de Aprovacao)

Antes de qualquer job, a task precisa existir com `status.json` em `draft`:

```bash
node scripts/orchestrator.js --task <task_name> --date <task_date> [--platforms <csv>]
```

(O pipeline ja faz isso sozinho, de forma idempotente, via `content.createTask`.)

```json
{
  "task_name": "<task_name>",
  "task_date": "<task_date>",
  "status": "draft",
  "created_at": "<ISO now com timezone>",
  "last_updated_at": "<ISO now>",
  "approved_by": null,
  "approved_at": null,
  "campaign_angle": null,
  "platforms": ["instagram"],
  "history": [
    { "from": null, "to": "draft", "at": "<ISO now>", "by": "orchestrator", "event_type": "first_creation" }
  ]
}
```

Regras:
- Timestamp ISO 8601 **com timezone** (ex.: `2026-06-02T09:14:22-03:00`).
- Se `status.json` ja existir: NAO sobrescrever; apenas anexar em `history` e atualizar `last_updated_at`. **NUNCA rebaixar `approved` ou `rejected`** automaticamente — pare e avise que a task precisa ser promovida pelo `task-promoter`.
- `campaign_angle` permanece `null`.
- Quem promove `draft -> in_review` e o job **`preview_generator`** (etapa 5), nao o distribution.

## Step 2: Jobs, dependencias e skips

| Job | Nome no resultado | Depende de | Skip | Regra |
|-----|---|-----------|------|-------|
| Research (advisory) | `research_agent` | — | `skip_research` | Roda 1o. **Advisory deterministico — nao usa Tavily.** Grava `research/insights.md` |
| Criativo (1 por tipo) | **o id do tipo** (`instagram_caption`, `ad_creative`, …) | research | `skip_video` remove `video_idea`; `content_types` escolhe o resto | Gera o arquivo do tipo + render (salvo `skip_render`) |
| Distribution (advisory) | `distribution_agent` | pecas | `skip_distribution` | Grava `distribution/plan.md`. **Nunca publica** |
| Preview | `preview_generator` | distribution | — | Gera `preview.html` e promove `draft -> in_review` |

> **`skip_research` nao bloqueia nada no executavel.** Em `pipeline/agents.js` ele simplesmente pula o estagio (`status: "skipped"`). A regra "exige `assets/<task>/`, senao bloqueia" existe **apenas** no caminho legado `orchestrate.js` — e hoje `assets/` nem tem subpastas por task. Nao apresente esse bloqueio como protecao do pipeline.

## Step 3: Executar o plano

- **Sequencial:** `research` -> N jobs criativos (um por `content_type`) -> `distribution` -> `preview_generator`. Cada job le/escreve em `outputs/<task>_<date>/` conforme o contrato de arquivos.
- **Enfileirado:** com `REDIS_URL` + `bullmq`, enqueue na fila `marketing-pipeline`; `node pipeline/worker.js` processa.

Comandos:

```bash
npm run pipeline:run -- --task <t> --date <YYYY-MM-DD> --brief "<...>"
npm run pipeline:run:payload '<json inline>'
node pipeline/worker.js        # worker BullMQ, quando REDIS_URL estiver configurado
```

## Step 4: Job tracking

- **Estados reais:** `done`, `skipped`, `blocked`, `error` (no executavel); `queued`/`skipped`/`blocked` no plano do `orchestrate.js`. **Nao existem** `complete`, `running` nem `failed`.
- A chave do resultado e **`job`** (nao `job_name`):

```json
{ "job": "ad_creative", "status": "done", "file": "ads/concept.json", "rendered": true }
```

- **Nao ha log por job em disco.** O executavel escreve no console e consolida tudo em **`outputs/<task>_<date>/pipeline_run.json`** (task, plataformas, content_types, flags, `preview_ok` e a lista de jobs). A pasta `logs/<job>.log` so existe se o `orchestrate.js` legado for usado.

Se um job falha: ele vira `error` no resumo, o pipeline **segue** com os demais tipos, e voce deve **notificar qual peca falhou** e oferecer re-rodar so aquele tipo (`content_types: ["<tipo>"]`).

## Step 5: Report final

- Resumo da run: status de cada job, lido de `pipeline_run.json`.
- Apontar **`outputs/<task>_<date>/distribution/plan.md`** e **`pipeline_run.json`**.
- Dizer o proximo passo real: as pecas estao em **`in_review`** e seguem para revisao no painel (`in_review -> approved`). **A publicacao real no Instagram e feita pelo painel** (`interface/lib/publish.js`), atras do gate R5 (status `approved` + `content_hashes` conferidos em runtime), com agendamento opcional.
- Se algum job voltou `simulated: true` (sem chave de IA), rotular o report como TESTE/simulado.

## Flags

| Flag | Efeito |
|------|--------|
| `skip_research: true` | Pula o research advisory (nao bloqueia nada) |
| `skip_video: true` | Remove `video_idea` da lista de tipos |
| `skip_distribution: true` | Pula o plano de distribuicao |
| `skip_render: true` / `--no-render` | Gera o JSON/texto das pecas sem renderizar arte |
| `content_types: [...]` | Escolhe exatamente quais pecas gerar (inclua `media_mention` se quiser peca de imprensa) |

*(`skip_image` so existe no caminho historico `orchestrate.js`.)*

## Examples

### Example 1: Campanha completa
**Payload:** task `taxa_zero_maio`, brief da campanha, `platforms: ["instagram","linkedin"]`, sem `content_types`. -> research -> 7 jobs criativos (um por tipo default) -> distribution -> preview. Report aponta `pipeline_run.json`; pecas em `in_review`. Nada publicado.

### Example 2: So as pecas de imagem
**Payload:** `content_types: ["ad_creative","instagram_caption"]`. -> 2 jobs criativos; os outros tipos nem sao tentados.

### Example 3: Incluir "4Selet na Midia"
**Payload:** `content_types: ["media_mention"]` (explicito — nao entra por default). Lembrar que a peca de imprensa precisa do print da materia e dos metadados do veiculo.

### Example 4: Sem render
**Payload:** `user_flags: { skip_render: true }`. -> gera os JSONs/textos; a arte fica para depois ("Gerar arte final" no painel).

## Troubleshooting

### `npm run pipeline:run` sai com erro de obrigatorios
**Cause:** o script exige argumentos. **Solution:** `npm run pipeline:run -- --task <t> --date <d> --brief "<...>"`.

### As plataformas sumiram (task nasceu so com instagram)
**Cause:** o payload usou `platform_targets`. **Solution:** no pipeline executavel o campo e **`platforms`**.

### Passei `dry_run: true` e mesmo assim gerou peca de verdade
**Cause:** `dry_run` nao existe no executavel. **Solution:** para nao gerar arte, use `--no-render`; para nao consumir IA, rode sem chave configurada (as pecas voltam com `simulated: true`).

### A run nao gerou peca de "4Selet na Midia"
**Cause:** `media_mention` nao esta no default (depende do print da materia). **Solution:** passar em `content_types`.

### Procurei `logs/<job>.log` e nao existe
**Cause:** o executavel nao escreve log em disco. **Solution:** ler `pipeline_run.json` (e o console da run).

### Sem Redis / "Cannot find module 'bullmq'"
**Solution:** modo **sequencial** (padrao). Para enfileirado: `npm i bullmq` + `REDIS_URL`.

## Quality Checklist

- [ ] Payload validado (`task_name`, `task_date`, **`brief`**, `platforms`, `content_types`)
- [ ] Campo `platforms` usado (nao `platform_targets`)
- [ ] `media_mention` incluido explicitamente, se a campanha precisar
- [ ] Ordem respeitada: research -> criativos -> distribution -> preview_generator
- [ ] Status lido com os estados reais (`done`/`skipped`/`blocked`/`error`), chave `job`
- [ ] Report aponta `distribution/plan.md` + `pipeline_run.json` e diz que as pecas estao em `in_review`
- [ ] **Nada publicado** automaticamente; publicacao e no painel, atras do gate R5
- [ ] Peca `simulated: true` rotulada como TESTE

## Pipeline (contrato entre estagios)

```
Job Payload → orchestrator (esta skill)
  research_agent → research/insights.md            (advisory; sem Tavily)
     └─► N jobs criativos, um por content_type → o arquivo do tipo:
             instagram_caption / media_mention → copy/instagram_caption.txt
             instagram_carousel                → copy/instagram_carousel.json (+ slides/slide_N.png)
             instagram_story                   → copy/instagram_story.json    (+ story/story_N.png)
             ad_creative                       → ads/concept.json      (+ ads/ad.png)
             video_idea                        → video/concept.json    (+ video/video.mp4)
             linkedin_post                     → copy/linkedin_post.txt
             threads_post                      → copy/threads_post.txt
              ↓
  distribution_agent → distribution/plan.md        (gate: nao publica)
              ↓
  preview_generator  → preview.html + draft → in_review
              ↓
  resumo da run      → pipeline_run.json
```

Artes renderizadas: `ads/ad.png` (1:1), `ads/feed.png` (4:5), `slides/slide_N.png` (carrossel), `ads/{square,story,media_16x9}.png` (4Selet na Midia), `video/video.mp4`.

## Performance Notes

- Respeite a ordem de dependencia — nunca rode um job criativo antes de a task existir.
- Em duvida sobre publicar: o orchestrator **nunca** publica.
- Sem chave de IA, as pecas voltam `simulated: true` — rotule o report e nao trate como entregavel final.
