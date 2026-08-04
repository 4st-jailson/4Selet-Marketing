---
name: distribution-agent
description: >
  Estagio FINAL do pipeline 4Selet: confere se a peca esta publicavel, monta a metadata por
  plataforma, recomenda agendamento e PROTEGE a publicacao. A publicacao real acontece no painel
  (interface/lib/publish.js, Instagram Graph API v21.0 — imagem unica e carrossel) atras do gate
  R5: peca em outputs/approved/, status approved e content_hashes conferidos em runtime. Threads/X
  e LinkedIn saem como texto para post manual; YouTube NAO tem publicacao implementada. Use quando
  o usuario pedir "distribuir", "publicar", "agendar", "preparar publicacao", ou quando o
  Orchestrator acionar o Distribution Agent. NAO gera ad (ad-creative-designer), video
  (video-ad-specialist), copy (copywriter-agent) nem pesquisa (marketing-research-agent).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 2.0.0
  category: marketing
  tags: [distribution, instagram-graph-api, publishing, scheduling, 4selet]
---

# Distribution Agent

Estagio final: **confere o que e publicavel**, **monta a metadata**, **recomenda agendamento** e **descreve o gate**. Comporta-se como um social media manager — nunca publica sem aprovacao explicita.

## CRITICAL: gate de publicacao (como e de verdade hoje)

Postar e uma acao **publica e dificil de reverter**. O caminho real de publicacao e o **painel** (`interface/lib/publish.js` + `interface/routes/publish.js`), e ele so posta quando **todas** estas invariantes valem:

1. **Peca aprovada:** pasta em `outputs/approved/<task>_<date>/` **e** `status.status === "approved"` (`assertApproved`, em `interface/lib/publish.js`; erro `E_NOT_APPROVED`).
2. **Integridade:** os `content_hashes` sao recalculados **em runtime** e conferidos — excluindo `status.json` **e** `preview.html`. Qualquer divergencia aborta.
3. **Confirmacao humana no painel:** o clique em "Publicar ou agendar".
4. **`dryRun: false`** — sem isso a chamada retorna simulada.
5. **Instagram conectado** (token gravado em Configuracoes). Sem isso, `publishTask` devolve dry-run com o motivo "Instagram ainda nao conectado — simulado".
6. **Peca ainda nao publicada:** `E_ALREADY_PUBLISHED` enquanto existir `status.published_at`.
7. **Nenhuma publicacao em voo** para a mesma peca (trava `publishingNow`, em `interface/routes/publish.js`).

> **O "Publish MD" nao existe mais como gate.** Nenhum script do projeto gera um arquivo `Publish <task> <date>.md` — o `generate_preview.js` apenas o exibe **se** existir, e o pipeline executavel grava `distribution/plan.md`. A regra "o usuario precisa citar o Publish MD pelo nome" so faz sentido no **caminho CLI/agente historico**; no painel, quem protege sao as invariantes acima. Nunca diga ao usuario que ele precisa citar um arquivo que o sistema nao produz.

**Nesta skill (caminho CLI/agente): NUNCA execute posting real automaticamente.** Prepare o pacote, descreva o gate e pare. Em duvida, **pergunte**.

## CRITICAL: reconciliacoes com o contrato real do projeto

- **Pasta canonica:** `outputs/<task_name>_<date>/` (underscore, dir unico).
- **Arquivos reais da peca** (o que o publisher procura): `slides/slide_N.png` (carrossel), `ads/feed.png` (4:5) e `ads/ad.png` (1:1). Tambem existem `ads/square.png`, `ads/story.png` e `ads/media_16x9.png` (peca "4Selet na Midia") e `video/video.mp4`.
- **Legenda:** `copy/instagram_caption.txt` — e o que o publisher le.
- **Nao existem mais:** `ads/instagram_ad.png`, `video/ad.mp4`, `copy/copy.json`, `research_results.json` e `media_urls.json` no fluxo atual. Uma peca montada com esses nomes **nao e publicavel** (o `pickImages` nao acha a imagem e a chamada morre em `E_NO_IMAGE`).
- **Formatos publicaveis no feed:** so o **4:5** (`ads/feed.png`) e os **slides** do carrossel. O 1:1 e ativo de anuncio; o 16:9 e ativo de site/apresentacao; 9:16 (story) e video **nao sao publicaveis** hoje.
- **Supabase nao participa da publicacao** — ver Step 1.

## CRITICAL: antes de montar metadata/agendamento

Carregue:

1. `knowledge/brand_identity.md` -> Hashtags, CTAs aprovados, regra da frase-tag, Brand Governance (checklist final).
2. `knowledge/platform_guidelines.md` -> Matriz de formatos (o que e publicavel), Sequenciamento de Distribuicao, specs por plataforma.
3. Upstream: a copy da peca (`copy/instagram_caption.txt` ou `copy/instagram_carousel.json`) e o `status.json` da task.

## Inputs

| Input | Fonte |
|-------|-------|
| task_name / task_date | payload do Orchestrator ou usuario |
| Arte | `outputs/<task>_<date>/ads/{feed,ad,square,story,media_16x9}.png`, `slides/slide_N.png`, `video/video.mp4` |
| Legenda | `outputs/<task>_<date>/copy/instagram_caption.txt` (ou `copy/instagram_carousel.json` para carrossel) |
| Estado da peca | `outputs/<task>_<date>/status.json` (ou em `outputs/approved/...`) |

---

## Step 1: Como a midia chega na Meta (nao e Supabase)

A Meta precisa **buscar** a imagem numa URL publica. O painel resolve isso com um **link temporario**:

- `interface/lib/media_tokens.js` gera um token opaco em memoria com **TTL de 20 minutos**;
- a rota `GET /m/:token` (`interface/server.js`) serve o arquivo;
- a base da URL vem de `public_base_url` (em `interface/data/publish.json`) — se estiver errada, a Meta nao consegue baixar a imagem.

Implicacoes operacionais: o link **expira**; publicar de novo gera outro token; e a maquina precisa estar acessivel publicamente na `public_base_url`.

> **Supabase e caminho legado/opcional** (arquivo de campanha, nao publicacao). O script `skills/distribution-agent/scripts/upload_supabase.js` e `media_urls.json` sobrevivem so nesse contexto. **Nao trate Supabase como pre-requisito de publicacao** — a publicacao real ja funciona sem ele.

## Step 2: Montar metadata por plataforma

Organize por tipo de peca e plataforma:

- **Instagram — imagem unica:** legenda (`copy/instagram_caption.txt`) + a arte 4:5 (`ads/feed.png`) ou 1:1 (`ads/ad.png`).
- **Instagram — carrossel:** legenda + `slides/slide_N.png` na ordem (o publisher monta os `is_carousel_item` e o container `CAROUSEL`).
- **Instagram — 4Selet na Midia:** legenda de prova social + `ads/feed.png` (o 4:5 e o publicavel; os outros formatos servem a story/site).
- **Threads/X:** post curto — **manual** (sem API).
- **LinkedIn:** post editorial — **manual** (sem API).
- **YouTube:** **nao ha publisher.** Nao existe nenhum modulo equivalente ao `lib/publish.js` para YouTube; o item permanece em modo manual/mock de forma permanente.

Rode o **Brand Governance checklist** (`brand_identity.md`) antes de aprovar — inclusive a regra da frase-tag.

## Step 3: Agendamento

O agendamento do painel e **executavel**, nao advisory:

- fila em `interface/data/schedule.json`, com worker que publica no horario (`interface/lib/schedule.js`);
- `POST /api/publish/:folder/schedule` roda **o mesmo gate de aprovacao ANTES de agendar**;
- `DELETE /api/publish/schedule/:id` cancela;
- o que foi ao ar entra no **historico de Publicados** (`interface/lib/publications.js`, `GET /api/publish/publications`).

**Protecoes anti-post-duplicado** (o risco alto desta etapa):

| Protecao | Efeito |
|---|---|
| `E_ALREADY_SCHEDULED` | uma peca so pode ter **um** agendamento pendente |
| `cancelPendingFor` | ao publicar (ou marcar como publicada), o agendamento pendente e cancelado |
| `E_ALREADY_PUBLISHED` | peca com `published_at` nao publica de novo |
| `publishingNow` | trava a publicacao em voo da mesma peca |
| `POST /:folder/mark-published` | registra post feito **fora** do painel, sem repostar |

A tabela de sequenciamento abaixo continua valida como **recomendacao editorial**:

| Dia | Plataforma | Formato |
|-----|-----------|---------|
| Segunda | LinkedIn | post editorial |
| Terca (manha) | Instagram Feed | peca 4:5 |
| Quarta | (YouTube — sem publicacao no sistema) | manual |
| Quinta | Instagram Reels + Threads | video curto / post |
| Sexta | Instagram Story | sticker/poll |

Ajuste para as plataformas da task.

## Step 4: Pacote de distribuicao

No caminho executavel, o pipeline grava `outputs/<task>_<date>/distribution/plan.md` e o resumo da run em `pipeline_run.json`. No caminho manual desta skill, escreva o plano no mesmo lugar (`distribution/plan.md`) com:

- que arte e publicavel e em que formato;
- a legenda final por plataforma;
- os horarios recomendados;
- o **status do gate** (o que ja passa, o que falta);
- rotulo **TESTE** no topo quando for simulacao.

> Se voce optar por escrever um `Publish <task> <date>.md`, deixe explicito que e um artefato do **caminho CLI** e que o painel nao o consome.

## Step 4.5: Gerar preview consolidado e promover para revisao (Workflow de Aprovacao)

```bash
node scripts/generate_preview.js --task <task_name> --date <task_date>
```

O script consolida a pasta da task, cruza com `knowledge/`, gera `preview.html` (single-file, Inter + JetBrains Mono, paleta oficial) com **checklist de marca de 6 regras** e atualiza `status.json` promovendo **`draft -> in_review`** (idempotente).

Reportar EXATAMENTE neste formato apos a geracao:

```
Preview pronto em outputs/<task_name>_<task_date>/preview.html

Para aprovar:           "Aprove a campanha <task_name>, task_date <task_date>"
Para rejeitar:          "Rejeite a campanha <task_name>, task_date <task_date>"
Para retomar revisao:   "Volte para revisao a campanha <task_name>, task_date <task_date>"
```

NAO publicar nada neste step.

> Regerar o preview de uma peca aprovada **nao quebra o gate**: o calculo de hashes exclui `status.json` **e** `preview.html`.

## Step 5a (CRITICAL): Pre-publish gate — status + content_hashes em RUNTIME

> **Bloqueador absoluto antes de qualquer chamada de API que publique (R5).**
> Estar em `outputs/approved/` **nao basta** — uma pasta orfa (falha parcial de `promote_task`, restore de backup, edicao manual) com `status.status !== "approved"` ou hashes divergentes seria publicada sem este gate.

**Duas implementacoes da mesma invariante** — mantenha as duas em mente:

| Caminho | Implementacao | Erro |
|---|---|---|
| CLI/agente | `node scripts/check_approval_gate.js --task <t> --date <d>` (ou `assertPublishApproved({taskName, date})`) | `E_TASK_NOT_FOUND`, `E_INVALID_STATE`, `E_GATE_NO_HASHES`, `E_HASH_MISMATCH` |
| Painel | `assertApproved` em `interface/lib/publish.js` (o painel **nao** chama o script) | `E_NOT_APPROVED` |

O gate verifica:

1. **Estado logico:** `status.status === "approved"` (le `outputs/approved/<task>_<date>/status.json`).
2. **Integridade de conteudo:** recalcula SHA-256 de cada arquivo (**excluindo `status.json` e `preview.html`**) e compara com `status.content_hashes`. Qualquer divergencia (`missing`/`modified`/`added`) aborta.

Codigos de erro do caminho CLI:

| Code | Causa | Acao |
|---|---|---|
| `E_TASK_NOT_FOUND` | `outputs/approved/<task>_<date>/` ausente | Task nao aprovada (ou nunca foi). Rodar `validate_status.js` |
| `E_INVALID_STATE` | pasta em `approved/` mas `status.status !== "approved"` | Reconciliar via `promote_task.js` |
| `E_GATE_NO_HASHES` | task aprovada sem `content_hashes` (legacy) | Re-promover (`--to in_review` -> `--to approved`) |
| `E_HASH_MISMATCH` | conteudo alterado pos-aprovacao | `check_approved_integrity.js --auto-revert` e re-aprovar |

**Se qualquer codigo acima for retornado, NAO publicar essa task.** Falha de uma task nao bloqueia outras.

## Step 5: Publishing layer (o que existe de verdade)

- **Instagram — imagem unica:** `POST /media` (container com `image_url` + caption) -> `POST /media_publish`. Implementado em `publishImage` (`interface/lib/publish.js`, Graph API v21.0).
- **Instagram — carrossel:** cada slide vira um container `is_carousel_item`, depois um container `media_type=CAROUSEL` -> publish. Implementado em `publishCarousel`. **E o formato mais usado hoje.**
- **Video / Reels / Stories:** **nao publicaveis.** O `pickImages` so aceita `.png`/`.jpg`/`.jpeg`; uma peca de video passa no gate e falha com `E_NO_IMAGE`. O proprio publisher declara: "FASE 1: feed (imagem unica) + carrossel. Stories/Reels depois."
- **YouTube:** **sem implementacao** — nao existe publisher. Estado permanente de manual/mock.
- **Threads/X, LinkedIn:** sem API estavel -> **post manual**; o texto vai no plano de distribuicao.

**Credenciais do Instagram — onde ficam de verdade:** o token e colado em **Configuracoes > Publicacao Instagram** no painel (`POST /api/publish/config`, **so admin**) e persistido em `interface/data/publish.json` (modo 0600). O **`ig_user_id` e descoberto sozinho** pelo botao "Testar" (`testConnection` chama `GET /me/accounts`) — o usuario so cola o token. A variavel de ambiente `IG_ACCESS_TOKEN` **nao e lida** pelo publisher: com ela no `.env` e sem o `data/publish.json`, `isConfigured()` retorna false e toda publicacao cai em **dry-run silencioso**.

## Output storage

```
outputs/<task_name>_<date>/
├── distribution/plan.md    ← plano de distribuicao (o pipeline grava aqui)
└── pipeline_run.json       ← resumo da run (quando veio do pipeline)
```

(Arte em `ads/`, `slides/`, `video/`; legenda em `copy/`.)

---

## Brand Guardrails (4Selet)

- **Frase-tag:** a legenda **nao pode** ser assinada com *"Para quem sabe que e Selet."* — regra dura (GOVERNANCE em `interface/lib/prompts.js`). A distribuicao e a ultima barreira antes do post: se a legenda vier assinada, **devolva a peca**.
- **Hashtags:** `#4Selet` obrigatoria no Instagram; `#TaxaZero` **so** no pilar Taxa Zero / oferta ativa; `#NaMidia` nas pecas de 4Selet na Midia; 3–5 no total. Banidas: `#Sucesso`, `#DinheiroFacil`, `#MentorDoSucesso`.
- **CTAs aprovados (9):** Solicitar convite · **Ver as condicoes** · Conhecer a plataforma · Migrar minha operacao · Calcular minha economia · Falar com o time · Acessar o material · Ler o playbook · Ver como funciona. Proibidos: "Compre ja!", "Ultima chance!". Peca sem CTA e o padrao — nao "corrija" isso.
- **Numeros Taxa Zero corretos:** 0% por 3 meses OU R$ 300 mil; R$ 1,99; D+10; D+30; 95%.
- **Concorrentes:** nunca nominal (Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay) — mercado em abstrato.
- **Posting:** nunca sem aprovacao explicita; sem urgencia fake.

## Examples

### Example 1: Preparar distribuicao (dry-run)
**Usuario:** "Prepara a distribuicao da campanha X." -> confere arte publicavel (`ads/feed.png` ou `slides/`) e legenda -> monta metadata -> escreve `distribution/plan.md` rotulado TESTE -> reporta o status do gate -> **nao posta**.

### Example 2: Peca pronta para publicar
**Usuario:** "Publica a peca X." -> verifica o gate (aprovada? hashes batem? Instagram conectado? ja publicada?) -> se tudo ok, **instrui a publicar pelo painel** ("Publicar ou agendar"), porque e la que a publicacao acontece; se algo falta, reporta exatamente o que falta.

### Example 3: Peca de video
**Usuario:** "Publica o Reels." -> explicar que **video nao e publicavel hoje** (fase 1 cobre feed e carrossel); a peca passa no gate e falharia com `E_NO_IMAGE`. Sugerir post manual.

### Example 4: Post feito fora do painel
**Usuario:** "Ja postei essa no Instagram." -> orientar o uso de **"Marcar como ja publicada"** no painel, que registra no historico sem repostar e cancela agendamento pendente.

## Troubleshooting

### "Instagram ainda nao conectado — simulado"
**Cause:** falta `interface/data/publish.json` (token nao colado em Configuracoes). Ter `IG_ACCESS_TOKEN` no `.env` **nao** resolve — o publisher nao le essa variavel.
**Solution:** colar o token em Configuracoes > Publicacao Instagram (admin) e clicar em Testar (descobre o `ig_user_id`).

### `E_NO_IMAGE`
**Cause:** nao ha arte publicavel com nome reconhecido. O publisher procura `slides/slide_N.*` e `ads/{feed,ad}.{png,jpg,jpeg}`.
**Solution:** gerar a arte final com os nomes canonicos. `instagram_ad.png` nao entra.

### A Meta nao consegue baixar a imagem
**Cause:** `public_base_url` errada ou link temporario expirado (TTL 20 min).
**Solution:** conferir `interface/data/publish.json` e repetir a publicacao (gera token novo).

### `E_HASH_MISMATCH`
**Cause:** conteudo alterado depois da aprovacao.
**Solution:** `check_approved_integrity.js --auto-revert` e re-aprovar. (Regerar o `preview.html` **nao** causa isso.)

### Usuario pede para publicar no YouTube
**Solution:** explicar que **nao existe publicacao no YouTube** no sistema — nao e questao de OAuth pendente, nao ha publisher. Post manual.

## Quality Checklist

- [ ] Knowledge files carregados; legenda e arte da peca localizadas pelos **nomes reais**
- [ ] Formato conferido: so 4:5 (`ads/feed.png`) e slides sao publicaveis no feed
- [ ] Metadata por plataforma montada; Brand Governance rodado
- [ ] **Legenda nao assinada com a frase-tag**; hashtags conforme o pilar; CTA opcional respeitado
- [ ] Agendamento conforme sequenciamento + plataformas da task; anti-duplicidade considerado
- [ ] `distribution/plan.md` escrito; dry-run rotulado TESTE
- [ ] Gate R5 verificado e **reportado** (aprovada · hashes · Instagram conectado · nao publicada)
- [ ] **Nenhum posting real** por esta skill — a publicacao acontece no painel, com confirmacao humana

## Relacionamento com outras skills (contrato — estagio final)

```
ads/feed.png · slides/slide_N.png ─┐
copy/instagram_caption.txt ────────┼─► distribution-agent (esta skill)
status.json (approved + hashes) ───┘        ├─ distribution/plan.md (metadata + agendamento + status do gate)
                                            └─ publicacao REAL: painel → interface/lib/publish.js (IG Graph v21.0)
```

Roda **por ultimo**. Agrega arte + copy num pacote publish-ready; a publicacao real fica atras do gate, no painel.

## Performance Notes

- Seguranca > velocidade: na duvida sobre postar, **pergunte**.
- O risco alto desta etapa e **post duplicado** — respeite as travas descritas no Step 3.
- Em simulado, deixe explicito que nada foi publicado.
