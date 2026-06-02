# Workflow de Aprovação — Equipe de Marketing 4Selet
## Especificação Técnica · Níveis 1 e 2 · **v1.1** (pós-implementação)

---

## Changelog v1.0 → v1.1 (2026-06-02)

Esta v1.1 documenta a especificação **como implementada**, com os desvios deliberados e issues fechadas/abertas em relação ao spec base.

### Desvios deliberados em relação à v1.0

| # | Item | Desvio | Por quê |
|---|---|---|---|
| 1 | **`scripts/orchestrator.js`** (wrapper) | Criado como wrapper sobre `scripts/lib/status_bootstrap.js`, ao lado do `skills/orchestrator/scripts/orchestrate.js` (real, BullMQ-target). | Test plan v1.0 §8 passo 1 referenciava `scripts/orchestrator.js`; mantive o nome literal. O `orchestrate.js` real foi cabeado também via `bootstrapStatusJson` (require da lib comum). |
| 2 | **MD parser inline mínimo** no `preview.html` | Cobre: parágrafos, headings (h1–h6), listas (ul/ol), code blocks (`\`\`\``), inline code, links, imagens, tabelas básicas, blockquote, hr. Não cobre: listas aninhadas, HTML embutido, footnotes, definition lists. | Spec v1.0 §5.1 §5 pedia "tipografia consistente" sem dependência npm. Cenário conhecido coberto; casos exóticos podem renderizar como texto. |
| 3 | **`refresh_index` estendido** | Dispara também em `approved → in_review` (`src.zone === "approved"`), não só em `target ∈ {approved, rejected}` como §6.2 passo 8. | Conflito interno do spec: §8 passo 8 esperava INDEX limpo após rework de approved, mas §6.2 não disparava refresh. Resolvido a favor do test plan. |
| 4 | **`scripts/orchestrator.js` vs `skills/orchestrator/scripts/orchestrate.js`** | Mantidos como dois scripts distintos (decisão consciente, ver renomeação como G7 em "issues abertas"). | Trocar nomes agora quebra `pipeline_plan.json` e o test plan literal. |

### Issues fechadas em v1.1

- ✅ **§3.5 content_hash / auto-revert** — implementado em A.2 desta task:
  - `scripts/lib/content_hash.js` (SHA-256 por arquivo / por pasta + `diffHashes`).
  - `promote_task.js` grava `status.content_hashes` ao transicionar para `approved` (exclui o próprio `status.json` do hash).
  - `scripts/check_approved_integrity.js` recalcula e (com `--auto-revert`) move task de volta para `draft` com `event_type: "edit_revert"`, preservando `previous_approval = { approved_at, approved_by }`.
- ✅ **G2 — `orchestrate.js` real desacoplado do bootstrap** — cabeado em A.3 via `require("../../../scripts/lib/status_bootstrap")`. Bootstrap idempotente disparado após `fs.mkdirSync(logsDir)`. Bloqueia em `approved/rejected` com `E_REBOOTSTRAP_BLOCKED`.
- ✅ **G3 — Persistência sem git** — git v2.54.0 instalado em A.1; `.gitignore` configurado para versionar `outputs/approved/` e `outputs/archive/` e ignorar tasks em andamento (`outputs/<task>_<date>/`). Commit inicial feito.
- ✅ **G5 — `generate_preview` desacoplado do pipeline** — em C.2, `orchestrate.js` injeta job sintético `preview_generator` no `pipeline_plan.json` após `distribution_agent` (worker BullMQ futuro o executa automaticamente).
- ✅ **G6 — Tasks legadas sem `status.json`** — `scripts/migrate_legacy.js` + `scripts/validate_status.js` entregues. Migração marca `legacy: true` e `event_type: "legacy_import"`.
- ✅ **G8 — Cobertura adversarial** — 7 cenários (B.1.1–B.1.7) executados e passando.

### Issues abertas em v1.1 (Sprint seguinte)

- 🟡 **G4 — Estado `published` ausente do enum** — decisão: fica **fora do escopo Níveis 1/2**, será reavaliado em Nível 3 (webapp + integração Meta API direta).
- 🟡 **G7 — Renomear `scripts/orchestrator.js` para `scripts/init_task.js`** — adiado para próxima major (quebra test plan literal e referência em `pipeline_plan.json`).
- 🟡 **G9 — `outputs/INDEX.md` (zona ativa)** — não gerado; só `outputs/approved/INDEX.md` existe. Task-promoter `Step 1` instrui consulta a ambos; o ativo é opcional.
- 🔴 **R5 — Gate duplo no `distribution-agent` Step 5** — antes de Meta API entrar, Step 5 deve ler `status.json` e abortar se `status !== "approved"`. Implementar antes do primeiro post real.
- 🔴 **Lock multi-usuário em `status.json`** — sem controle de concorrência (single-user). `proper-lockfile` por task_dir quando multi-operador entrar.

---

## Cenários adversariais cobertos (B.1.1–B.1.7)

| # | Cenário | Comando | Exit | Padrão stderr |
|---|---|---|---|---|
| B.1.1 | draft → approved direto | `promote_task --to approved --by QA` (em task draft) | 1 | `E_INVALID_TRANSITION` + rota legal |
| B.1.2 | rejected → approved (pular rework) | `promote_task --to approved --by QA` (em task rejected) | 1 | `E_INVALID_TRANSITION` + "Rota legal: rejected → in_review → approved" |
| B.1.3 | `--by` ausente em approved | `promote_task --to approved` (sem `--by`) | 1 | `E_MISSING_APPROVER: --by <user> obrigatorio` |
| B.1.4 | Estado fora do enum | `promote_task --to published --by QA` | 1 | `E_UNKNOWN_STATE: 'published' ... Validos: draft\|in_review\|approved\|rejected` |
| B.1.5 | `status.json` corrompido | `promote_task` em task com JSON inválido | 2 | `E_STATUS_PARSE: JSON invalido em ...` |
| B.1.6 | Task em duas zonas | `promote_task` com pasta em `outputs/` e `outputs/approved/` | 2 | `E_DUPLICATE_LOCATION: task encontrada em 2 zonas` |
| B.1.7 | Idempotência `generate_preview` | Rodar 2x em `in_review` | 0 | `history.length` não duplica (h1 == h2) |

**Resultado:** 7/7 PASS após fix do catch block (`E_JSON_CORRUPT` → `E_STATUS_PARSE`).

---

## Referência à v1.0

A v1.0 (especificação base — sumário, glossário, máquina de estados, schema JSON, design do preview, contratos dos scripts, mudanças nos SKILL.md, plano de testes 10 passos, critérios de aceitação) foi entregue como prompt em 2026-06-02 e está integralmente refletida no código + edits do commit raiz. Esta v1.1 sobrescreve apenas as seções com desvios listados acima; o restante permanece válido.

---

## Mapa de arquivos (v1.1)

```
scripts/
├── lib/
│   ├── content_hash.js          ← A.2 (SHA-256 + diffHashes)
│   └── status_bootstrap.js      ← A.3 (bootstrap idempotente, reusado)
├── orchestrator.js              ← wrapper Step 1.5
├── generate_preview.js          ← preview HTML + 6 regras + promove draft→in_review
├── promote_task.js              ← unico ponto de transicao + content_hashes em approved
├── refresh_index.js             ← outputs/approved/INDEX.md
├── check_approved_integrity.js  ← A.2 (verifica hashes; --auto-revert)
├── migrate_legacy.js            ← C.3 (legacy_import)
├── validate_status.js           ← C.3 (auditoria de schema/zona/hashes)
└── render_ad.js                 ← legacy (antes da bundling em skills/)

skills/
├── orchestrator/SKILL.md        ← Step 1.5
├── distribution-agent/SKILL.md  ← Step 4.5 (preview + promocao)
├── task-promoter/SKILL.md       ← NOVA
├── ad-creative-designer/SKILL.md ← CRITICAL Re-aprovacao
├── video-ad-specialist/SKILL.md  ← CRITICAL Re-aprovacao
├── copywriter-agent/SKILL.md     ← CRITICAL Re-aprovacao
└── marketing-research-agent/SKILL.md ← CRITICAL Re-aprovacao

outputs/
├── approved/INDEX.md            ← versionado em git
├── approved/<task>_<date>/      ← versionado em git
└── archive/<task>_<date>/       ← versionado em git
```
