---
name: orchestrator
description: >
  Skill de COORDENACAO (nao e um agente) do pipeline de marketing 4Selet. Recebe um Job Payload
  (task_name, task_date, platform_targets, user_flags skip_research/skip_image/skip_video,
  source_folder) e roda os 5 agentes como um workflow unico, respeitando dependencias: research
  primeiro, depois ad-creative-designer + video-ad-specialist + copywriter (paralelizaveis), e
  distribution por ultimo. Valida o payload, aplica skips, rastreia status por job + logs, e
  reporta a conclusao surfaceando o Publish MD. Modo de execucao: SEQUENCIAL por padrao (sem Redis)
  ou enfileirado BullMQ+Redis quando configurado. Use quando o usuario submeter um job payload,
  pedir "rodar o pipeline", "pipeline:run", "orquestrar a campanha" ou "rodar todos os agentes".
  NUNCA publica conteudo (a publicacao e manual via distribution-agent + Publish MD).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 1.0.0
  category: marketing
  tags: [orchestration, pipeline, bullmq, redis, 4selet]
---

# Orchestrator

Coordena o pipeline de conteudo 4Selet a partir de **um Job Payload**: valida, resolve dependencias e skips, dispara os 5 agentes na ordem certa, rastreia status + logs, e reporta — **sem publicar** (publicacao e gated no distribution-agent).

## When to Use This Skill

- Usuario submete um Job Payload (JSON) ou pede "rodar o pipeline", "pipeline:run", "orquestrar a campanha".
- Precisa coordenar os 5 agentes de ponta a ponta para uma task.

**NAO use para** executar um unico agente isolado (chame a skill do agente direto) nem para publicar (distribution-agent).

## CRITICAL: modos de execucao (realidade do projeto)

- **Sequencial (padrao, atual):** sem Redis/BullMQ instalados, o orchestrator dispara as skills dos agentes **em ordem de dependencia**, uma a uma (foi assim que o dry-run rodou). Os agentes sao **skills executadas pelo Claude** — nao servicos de codigo.
- **Enfileirado (BullMQ + Upstash Redis):** modo de producao. Requer `REDIS_URL` + `npm i bullmq`. Os scripts `pipeline/orchestrator.js` (enqueue na fila `marketing-pipeline`) e `pipeline/worker.js` (worker) **ja estao entregues e executaveis** (commit e787dc7); sem `REDIS_URL` o pipeline degrada para sequencial automaticamente.
- O script empacotado `scripts/orchestrate.js` **valida o payload e gera o plano de execucao + logs** em ambos os modos; ele NAO roda os agentes (isso e o Claude seguindo o plano, ou o worker BullMQ no futuro).

## CRITICAL: reconciliacoes com o contrato real

- **Pasta canonica:** `outputs/<task_name>_<date>/` (underscore) + subpasta `logs/`. (As key details citam `outputs/<task>/<date>/`.)
- **Os 5 agentes existem como skills:** `marketing-research-agent`, `ad-creative-designer`, `video-ad-specialist`, `copywriter-agent`, `distribution-agent`.
- **Pipeline NUNCA publica** automaticamente — distribution-agent so posta com referencia explicita ao Publish MD (gate).

## Inputs — Job Payload

```json
{
  "task_name": "taxa_zero_maio",
  "task_date": "2026-05-26",
  "brief": "Anunciar a Taxa Zero para produtores estabelecidos (50k+/mes)",
  "platform_targets": ["instagram", "youtube"],
  "user_flags": { "skip_research": false, "skip_image": false, "skip_video": false },
  "source_folder": null,
  "dry_run": false
}
```

(Aceita tambem skip flags no topo do payload. `source_folder`/`assets/<task>/` so e exigido se `skip_research: true`.)

> **Pipeline executavel (`pipeline/orchestrator.js`):** exige `task_name`, `task_date` **e `brief`** (min. 8 chars) — sem `brief` sai com exit 2. Aceita `platforms` (alias de `platform_targets`) e `content_types`. As skip flags do pipeline real sao `--skip-research`, `--skip-distribution`, `--no-render`, `--skip-video` (nao ha `--skip-image` no executavel; `skip_image` so existe no caminho historico `orchestrate.js`).

## Step 1: Intake + validacao

Valide o payload com o script empacotado (cria `outputs/<task>_<date>/logs/` e `pipeline_plan.json`):

```bash
node skills/orchestrator/scripts/orchestrate.js --file <payload.json>
# ou: node skills/orchestrator/scripts/orchestrate.js --payload '<json inline>'
```

Obrigatorios: `task_name`, `task_date`. Sem eles -> erro (exit 2).

## Step 1.5: Inicializar status.json (Workflow de Aprovacao)

Apos validar o payload e ANTES de disparar o `research_agent`, criar
`outputs/<task_name>_<task_date>/status.json` com o estado inicial do
workflow de aprovacao (Niveis 1/2):

```json
{
  "task_name": "<payload.task_name>",
  "task_date": "<payload.task_date>",
  "status": "draft",
  "created_at": "<ISO now com timezone>",
  "last_updated_at": "<ISO now>",
  "approved_by": null,
  "approved_at": null,
  "campaign_angle": null,
  "platforms": <payload.platform_targets>,
  "history": [
    { "from": null, "to": "draft", "at": "<ISO now>",
      "by": "orchestrator", "event_type": "first_creation" }
  ]
}
```

Bootstrap pratico:

```bash
node scripts/orchestrator.js --task <task_name> --date <task_date> [--platforms <csv>]
```

Regras:
- Timestamp ISO 8601 **com timezone** (ex.: `2026-06-02T09:14:22-03:00`).
- Se `status.json` ja existir: NAO sobrescrever; apenas anexar entrada em
  `history` e atualizar `last_updated_at`. **NUNCA rebaixar `approved` ou
  `rejected`** automaticamente — nesse caso, parar e avisar que a task
  precisa ser promovida manualmente via `task-promoter`.
- `campaign_angle` permanece `null`; o `copywriter-agent` preenchera depois.
- O `distribution-agent` promovera `draft -> in_review` ao gerar o preview
  (`scripts/generate_preview.js`).

## Step 2: Resolucao de dependencias + skips

| Job | Depende de | Skip | Regra |
|-----|-----------|------|-------|
| `research_agent` | — | `skip_research` | Roda 1o. Se skip -> **exige `assets/<task>/`**; se ausente, **bloqueia** o pipeline com nota |
| `ad_creative_designer` | research | `skip_image` | Apos research/skip. Se skip -> marcado complete sem rodar |
| `video_ad_specialist` | research | `skip_video` | Apos research/skip. Se skip -> marcado complete sem rodar |
| `copywriter_agent` | research | — | Apos research/skip |
| `distribution_agent` | ad + video + copy | — | **Por ultimo**, com todos os outputs prontos |

Bloqueio (skip_research sem assets): retorne *"Task nao pode prosseguir ate a source folder ser uploaded."* e pare.

## Step 3: Executar o plano

- **Sequencial:** dispare as skills nesta ordem — `research` -> (`ad` , `video`, `copy`) -> `distribution`. Os 3 do meio sao independentes (paralelizaveis conceitualmente; em modo Claude, rode em sequencia). Cada agente le/escreve em `outputs/<task>_<date>/` conforme seu contrato. Skips: marque o job `complete (skipped)` sem invocar a skill.
- **Enfileirado (entregue):** com `REDIS_URL` + `bullmq`, `pipeline/orchestrator.js` faz enqueue na fila `marketing-pipeline`; `pipeline/worker.js` processa. Comandos: `npm run pipeline:run`, `npm run pipeline:run:payload '<json inline>'`, `npm run pipeline:worker` (= `node pipeline/worker.js`).

Passagem de dados entre estagios = o **contrato de arquivos** em `outputs/<task>_<date>/` (research_results.json -> ad/video/copy; midia + copy -> distribution).

## Step 4: Job tracking + logs

- Estados: `queued`, `running`, `complete`, `skipped`, `failed`, `blocked`.
- Um log por job em `outputs/<task>_<date>/logs/<job_name>.log`.
- Output por job (formato):

```json
{ "job_name": "video_ad_specialist", "status": "complete", "dependencies": ["research_agent"], "notes": "" }
```

Se um job falha: logue, **notifique qual job falhou**, e ofereca recovery (re-rodar so aquele estagio). Nao prossiga para dependentes de um job falho.

## Step 5: Report final

- Resumo do pipeline (status de cada job).
- **Surface o Publish MD** gerado pelo distribution-agent (`outputs/<task>_<date>/Publish <task> <date>.md`).
- Lembrete: **nada foi publicado** — publicacao e manual via referencia ao Publish MD.
- Se `dry_run`/simulado: rotular o report como TESTE.

## Skip Flags

| Flag | Efeito |
|------|--------|
| `skip_research: true` | Pula research; **exige** `assets/<task_name>/`; senao bloqueia |
| `skip_image: true` | Pula ad-creative-designer (job complete, sem geracao) |
| `skip_video: true` | Pula video-ad-specialist (job complete, sem geracao) |

## Examples

### Example 1: Pipeline completo (sem skips)
**Payload:** task taxa_zero_maio, IG+YT, skips false. -> research -> ad+video+copy -> distribution -> report + Publish MD. Nada publicado.

### Example 2: Skip research com assets
**Payload:** `skip_research: true`, `assets/taxa_zero_maio/` existe. -> research `skipped`; demais rodam usando os assets. Sem assets -> **blocked**.

### Example 3: Skip video
**Payload:** `skip_video: true`. -> video_ad_specialist `complete (skipped)`; ad + copy rodam; distribution segue sem o video.

## Troubleshooting

### Sem Redis / "Cannot find module 'bullmq'"
**Solution:** modo **sequencial** (padrao) — `pipeline/orchestrator.js` roda os estagios aqui mesmo (ou orchestrate.js planeja e o Claude dispara as skills em ordem). Para enfileirado: `npm i bullmq` + `REDIS_URL` (a pasta `pipeline/` ja existe).

### skip_research sem `assets/<task>/`
**Solution:** pipeline **bloqueado**; peca o upload da source folder. Nao prossiga.

### Um agente falhou
**Solution:** logue, notifique o job, nao rode dependentes; ofereca re-rodar so o estagio.

## Quality Checklist

- [ ] Payload validado (task_name, task_date, platform_targets, flags)
- [ ] Dependencias respeitadas (research 1o; distribution por ultimo)
- [ ] skip_research sem assets -> bloqueado; skip_image/skip_video -> complete sem rodar
- [ ] Logs por job em `outputs/<task>_<date>/logs/`; status rastreado
- [ ] Report final + Publish MD surfaceado
- [ ] **Nada publicado** automaticamente (gate do distribution-agent)
- [ ] dry_run rotulado TESTE

## Pipeline (contrato entre estagios)

```
Job Payload → orchestrator (esta skill)
  research_agent → research_results.json
     ├─► ad_creative_designer → ads/{layout.json, ad.html, styles.css, instagram_ad.png}
     ├─► video_ad_specialist  → video/{scenes.json, video.mp4}
     └─► copywriter_agent     → copy/{copy.json + .txt/.json}
              ↓ (todos prontos)
  distribution_agent → media_urls.json + Publish <task> <date>.md  (gate: nao publica sozinho)
```

## Performance Notes

- Respeite a ordem de dependencia — nunca rode um agente antes do upstream existir (ou skip confirmado).
- Em duvida sobre publicar: o orchestrator **nunca** publica; so o distribution-agent, com aprovacao explicita.
- Em modo simulado/dry-run, rotule tudo como TESTE e nao use chaves externas.
