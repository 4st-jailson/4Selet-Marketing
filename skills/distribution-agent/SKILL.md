---
name: distribution-agent
description: >
  Estagio FINAL do pipeline 4Selet: hospeda a midia no Supabase (bucket campaign-uploads), monta
  metadata publish-ready por plataforma e gera o arquivo "Publish <task> <date>.md" com URLs,
  agendamento e instrucoes. Consome a midia gerada (ad PNG, video MP4), o research_results.json e o
  copy.json. PROTEGE a publicacao: NUNCA posta de verdade sem o usuario referenciar explicitamente o
  Publish MD pelo nome (e fora de dry-run). Sem Supabase configurado, opera em modo SIMULADO (URLs
  placeholder). Use quando o usuario pedir "distribuir", "publicar", "agendar", "subir a midia",
  "preparar publicacao", "Publish ...", ou quando o Orchestrator acionar o Distribution Agent.
  NAO gera ad (ad-creative-designer), video (video-ad-specialist), copy (copywriter-agent) nem
  pesquisa (marketing-research-agent).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 1.0.0
  category: marketing
  tags: [distribution, supabase, publishing, scheduling, 4selet]
---

# Distribution Agent

Estagio final: **hospeda a midia**, **monta metadata** publish-ready e **escreve o Publish MD** com agendamento. Comporta-se como um social media manager — nunca publica sem aprovacao explicita.

## CRITICAL: gate de publicacao (seguranca)

Postar e uma acao **publica e dificil de reverter**. Portanto:

- **NUNCA** execute posting real automaticamente.
- Posting real so ocorre quando **TODAS** estas condicoes forem verdadeiras:
  1. O usuario referencia **explicitamente o arquivo Publish MD pelo nome** (ex.: *"Publica usando Publish test_job_payload_1 2026-03-31.md"*).
  2. NAO esta em `dry_run`/teste.
  3. As credenciais da plataforma existem (IG/YouTube tokens).
- Sem isso, o trabalho para no **Publish MD** (advisory). Em duvida, **pergunte** — nao poste.

## CRITICAL: reconciliacoes com o contrato real do projeto

- **Pasta canonica:** `outputs/<task_name>_<date>/` (underscore, dir unico) — nao `outputs/<task>/<date>/`. Consistente com todas as outras skills.
- **Input do research:** `research_results.json` (nome real emitido por `marketing-research-agent`); copy = `copy.json` (emitido por `copywriter-agent`).
- **Supabase:** requer `SUPABASE_URL` + `SUPABASE_KEY` (service role) **e** `npm i @supabase/supabase-js`. Sem isso -> modo **SIMULADO** (URLs placeholder, `_simulated: true`).
- **Plataformas:** Instagram + YouTube tem API; **Threads/X e LinkedIn nao tem API estavel -> texto vai no Publish MD para post manual** (coerente com o copy.json de 4 plataformas).

## CRITICAL: antes de montar metadata/agendamento

Carregue:

1. `knowledge/brand_identity.md` -> Hashtags, CTAs aprovados, Brand Governance (checklist final).
2. `knowledge/platform_guidelines.md` -> Sequenciamento de Distribuicao, specs por plataforma.
3. Upstream: `outputs/<task>_<date>/research_results.json` (tendencias/keywords p/ agendamento) e `copy.json` (captions, titulos, tags).

## Inputs

| Input | Fonte |
|-------|-------|
| task_name / task_date | payload do Orchestrator ou usuario |
| Media files | `outputs/<task>_<date>/ads/*.png`, `video/*.mp4` (imagens e videos; multiplos por task) |
| Research JSON | `outputs/<task>_<date>/research_results.json` |
| Copy JSON | `outputs/<task>_<date>/copy/copy.json` |
| Publish command | usuario cita `Publish <task> <date>.md` (gate de posting) |

---

## Step 1: Supabase media hosting -> media_urls.json

Suba toda a midia da task para o bucket `campaign-uploads`, com **filenames unicos por task** (prefixo `<task>_<date>/`). Use o script empacotado:

```bash
node skills/distribution-agent/scripts/upload_supabase.js --task <task> --date <date> --out outputs/<task>_<date>
```

- Com `SUPABASE_URL` + `SUPABASE_KEY`: faz upload real e grava `media_urls.json` com **public URLs validas**.
- Sem config: gera `media_urls.json` com **URLs placeholder** (`_simulated: true`) — o pipeline segue, mas nada foi hospedado de fato.

`media_urls.json` (schema):

```json
{
  "task_name": "...", "task_date": "...", "bucket": "campaign-uploads",
  "media": {
    "instagram_ad_png": { "local": "ads/instagram_ad.png", "public_url": "https://.../instagram_ad.png", "platform": "instagram" },
    "video_ad_mp4":    { "local": "video/ad.mp4", "public_url": "https://.../ad.mp4", "platform": "instagram_reels | youtube" }
  },
  "_simulated": false
}
```

## Step 2: Montar metadata por plataforma (do copy.json)

Extraia do `copy.json` e organize por plataforma:

- **Instagram:** caption + hashtags (3–5) + CTA + URL da imagem/video.
- **YouTube:** title (60–70) + description (com keywords + link) + tags + URL do video.
- **Threads/X:** post curto (manual — sem API).
- **LinkedIn:** post editorial (manual — sem API).

Rode o **Brand Governance checklist** (`brand_identity.md`): paleta/tom/CTA/numeros/concorrentes — antes de aprovar.

## Step 3: Advisory de agendamento

Use o **Sequenciamento de Distribuicao** (`platform_guidelines.md`) e tendencias do research:

| Dia | Plataforma | Formato |
|-----|-----------|---------|
| Segunda | LinkedIn | post editorial |
| Terca (manha) | Instagram Feed | static ad |
| Quarta | YouTube | video |
| Quinta | Instagram Reels + Threads | video curto |
| Sexta | Instagram Story | sticker/poll |

Ajuste para as `platform_targets` da task (ex.: so IG+YT -> Terca IG, Quarta YT, Quinta Reels).

## Step 4: Escrever o Publish MD

`outputs/<task>_<date>/Publish <task> <date>.md`, contendo:

- URLs da midia (Supabase ou placeholder).
- Metadata por plataforma (captions, hashtags, titulos, descriptions, tags).
- Horarios sugeridos de postagem (Step 3).
- Notas de conclusao da task.
- **Instrucoes e STATUS do gate de publicacao** (ver abaixo). Se for dry-run/simulado, rotular **TESTE** no topo.

## Step 4.5: Gerar preview consolidado e promover para revisao (Workflow de Aprovacao)

Apos escrever o Publish MD, rodar:

```bash
node scripts/generate_preview.js --task <task_name> --date <task_date>
```

O script consolida toda a pasta da task (ads, video, copy, research,
Publish MD), cruza com `knowledge/`, gera `preview.html` (single-file,
Inter + JetBrains Mono, paleta oficial) com **checklist de marca de 6
regras** (numeros Taxa Zero, CTAs aprovados, paleta/tipografia, sem
concorrentes, emoji ≤1, hashtags validas), e atualiza `status.json`
promovendo **`draft -> in_review`** (idempotente; re-execucao regenera
o HTML sem poluir history).

Reportar EXATAMENTE neste formato apos a geracao:

```
✓ Preview pronto em outputs/<task_name>_<task_date>/preview.html

Para aprovar:           "Aprove a campanha <task_name>, task_date <task_date>"
Para arquivar:          "Arquive a campanha <task_name>, task_date <task_date>"
Para retomar revisao:   "Volte para revisao a campanha <task_name>, task_date <task_date>"
```

NAO publicar nada neste step. O **gate de POSTING continua valido** — a
publicacao real exige referencia explicita ao Publish MD (Step 5).

## Step 5a (CRITICAL): Pre-publish gate — verificar status + content_hashes em RUNTIME

> ⚠️ **Bloqueador absoluto antes de Meta API / YouTube API real (R5 do reporte v1.1).**
> Localizacao em `outputs/approved/` **nao basta** — uma pasta orfa (falha parcial de
> `promote_task`, restore de backup, edicao manual) com `status.status !== "approved"`
> ou com `content_hashes` divergentes seria publicada sem este gate.

Antes de **qualquer** chamada de API que publique conteudo (POST IG Graph
`/media_publish`, YouTube `videos.insert`, etc.), e para **cada** task, rodar:

```bash
node scripts/check_approval_gate.js --task <task_name> --date <task_date>
```

ou, programaticamente, no codigo do publisher:

```js
const { assertPublishApproved } = require("../../scripts/check_approval_gate");
assertPublishApproved({ taskName, date });  // lanca em violacao; nao continuar
```

O gate verifica **duas invariantes em runtime**:

1. **Estado logico:** `status.status === "approved"` (le `outputs/approved/<task>_<date>/status.json`).
2. **Integridade de conteudo:** recalcula SHA-256 de cada arquivo (excluindo o proprio
   `status.json`) e compara com `status.content_hashes`. Qualquer divergencia
   (`missing`/`modified`/`added`) aborta.

Codigos de erro:

| Code | Causa | Acao |
|---|---|---|
| `E_TASK_NOT_FOUND` | `outputs/approved/<task>_<date>/` ausente | Task nao aprovada (ou nunca foi). Rodar `validate_status.js` |
| `E_INVALID_STATE` | pasta em `approved/` mas `status.status !== "approved"` | Reconciliar via `promote_task.js` |
| `E_GATE_NO_HASHES` | task aprovada sem `content_hashes` (legacy ou pre-A.2) | Re-promover (`--to in_review` -> `--to approved`) para gerar hashes |
| `E_HASH_MISMATCH` | conteudo alterado pos-aprovacao | `check_approved_integrity.js --auto-revert` e re-aprovar |

**Se qualquer codigo acima for retornado, NAO publicar essa task.** Falha de uma task
nao deve bloquear outras — registrar em log e seguir com as que passaram no gate.

> O gate `R5` e **independente** e **adicional** a:
> - Regra do Publish MD (referencia explicita pelo nome) — Step 5 abaixo.
> - Regra `dry_run: false` — Step 5 abaixo.
> - Regra CRITICAL Re-aprovacao nos agentes de conteudo (`outputs/approved/` e read-only para edicao).
>
> Os quatro gates juntos protegem o ponto de nao-retorno (impressao real cobrada).

## Step 5: Publishing layer (GATED — so com referencia explicita)

Somente se o gate (topo) for satisfeito:

- **Instagram:** Graph API — `POST /media` (cria container com `image_url`/`video_url` + caption) -> `POST /media_publish`. Requer `IG_ACCESS_TOKEN` + IG Business account id.
- **YouTube:** Data API (`videos.insert`) — requer OAuth `YOUTUBE_REFRESH_TOKEN`. Sem OAuth -> **mockar** (logar o que seria postado).
- **Threads/X, LinkedIn:** sem API estavel -> **post manual**; o texto ja esta no Publish MD.

Se qualquer condicao do gate faltar: **nao poste**, reporte o que falta.

## Output storage

```
outputs/<task_name>_<date>/
├── media_urls.json                       ← Step 1
└── Publish <task_name> <date>.md         ← Step 4
```

(Midia de origem fica em `ads/` e `video/`.) Se for fixture canonico, salve copia em `skills/distribution-agent/examples/` — `outputs/` pode nao persistir.

---

## Brand Guardrails (4Selet)

- **Hashtags:** `#4Selet` (obrigatorio IG) + `#TaxaZero` + produto + nicho (3–5). Banidas: `#Sucesso`, `#DinheiroFacil`, `#MentorDoSucesso`.
- **CTAs aprovados:** Solicitar convite · Ver condicoes · Falar com o time. Proibidos: "Compre ja!", "Ultima chance!".
- **Numeros Taxa Zero corretos:** 0% por 3 meses OU R$ 300 mil; R$ 1,99; D+10; D+30; 95%.
- **Concorrentes:** nunca nominal (Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay) — mercado em abstrato.
- **Posting:** nunca sem aprovacao explicita; sem urgencia fake.

## Examples

### Example 1: Preparar distribuicao (dry-run)
**Usuario:** "Prepara a distribuicao do test_job_payload_1." -> sobe midia (simulado, placeholder URLs) -> media_urls.json -> monta metadata do copy.json -> Publish MD rotulado TESTE -> **nao posta** (sem referencia + dry-run).

### Example 2: Publicar (gate satisfeito)
**Usuario:** "Publica usando Publish taxa_zero_maio 2026-05-26.md" -> gate OK (referencia explicita) -> se tokens existem: IG via Graph API, YouTube via Data API (ou mock); Threads/LinkedIn manual. Se faltam tokens: reporta e nao posta.

### Example 3: Sem Supabase
**Usuario:** "Sobe a midia." -> sem `SUPABASE_URL`/`SUPABASE_KEY` -> media_urls.json com placeholders (`_simulated: true`); avisa que nada foi hospedado de fato.

## Troubleshooting

### "SUPABASE_URL/KEY ausente" ou "Cannot find module '@supabase/supabase-js'"
**Solution:** modo simulado (placeholders) OU `npm i @supabase/supabase-js` + setar `SUPABASE_URL`/`SUPABASE_KEY`.

### Usuario pediu para publicar mas sem citar o MD
**Solution:** **nao poste**. Gere/atualize o Publish MD e peca a referencia explicita pelo nome.

### Sem OAuth do YouTube
**Solution:** mockar o posting (logar payload); registrar no Publish MD que YouTube ficou pendente de OAuth.

## Quality Checklist

- [ ] Knowledge files + research_results.json + copy.json carregados
- [ ] Midia hospedada (Supabase real) OU media_urls.json com placeholders rotulado `_simulated`
- [ ] Metadata por plataforma montada do copy.json; Brand Governance checklist rodado
- [ ] Agendamento conforme sequenciamento + platform_targets da task
- [ ] Publish MD escrito em `outputs/<task>_<date>/`; dry-run rotulado TESTE
- [ ] **Nenhum posting real** sem referencia explicita ao Publish MD + fora de dry-run + tokens presentes

## Relacionamento com outras skills (contrato — estagio final)

```
research_results.json ─┐
ads/instagram_ad.png ──┤
video/ad.mp4 ──────────┼─► distribution-agent (esta skill)
copy/copy.json ────────┘        ├─ media_urls.json (Supabase/placeholder)
                                └─ Publish <task> <date>.md (metadata + agendamento + gate)
```

Roda **por ultimo**. Agrega midia + research + copy num pacote publish-ready; a publicacao real fica atras do gate.

## Performance Notes

- Seguranca > velocidade: na duvida sobre postar, **pergunte**.
- Filenames unicos por task (prefixo `<task>_<date>/`) evitam colisao no bucket.
- Em simulado, deixe explicito que as URLs sao placeholders e nada foi hospedado.
