# Status do Projeto — Sistema de Marketing com IA (4Selet)

*Atualizado em 2026-06-12 · Marca: 4Selet · Painel web (interface principal) + Pipeline executável + 7 skills + Workflow de Aprovação Níveis 1/2*

> **Resumo:** O **Painel web** (`interface/`, `http://localhost:4500`) é a **interface principal** de operação — campanhas, geração de conteúdo com IA, refino e workflow de aprovação visual; a extensão Claude Code no VSCode é o caminho **secundário/avançado**. O sistema de skills está **funcionalmente completo** (7 skills); o **pipeline executável** (`pipeline/`, sequencial + BullMQ) foi **entregue** (commit e787dc7); e o **Workflow de Aprovação Níveis 1+2 está implementado (v1.0)**, com 7 scripts em `scripts/` (+ módulos em `scripts/lib/`), `content_hash` para integridade pós-aprovação, `status.json` versionado em git como fonte da verdade, e bateria de testes 10/10 felizes + 7/7 adversariais validada. O **render real funciona** para ad estático (Playwright) e vídeo (Remotion). A geração do painel exige a **chave Anthropic** configurada; pesquisa, hosting de mídia e publicação rodam em **modo simulado** porque as chaves externas (Tavily, Supabase, Redis, OAuth) ainda não foram configuradas. **Persistência resolvida** — git instalado e `outputs/approved/` + `outputs/archive/` versionados.

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
| **Chave Anthropic (painel)** | ⚠️ Configurar em *Configurações* (`interface/.env`) — sem ela, geração simulada |
| Tavily (`@tavily/core`) | ⏳ Não instalado / sem `TAVILY_API_KEY` |
| Supabase (`@supabase/supabase-js`) | ⏳ Não instalado / sem `SUPABASE_URL`+`KEY` |
| BullMQ + Redis | ✅ `pipeline/` pronto · ⏳ falta `REDIS_URL` (roda sequencial sem ele) |
| OAuth YouTube / token Instagram | ⏳ Não configurado |

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

### 2.2 Workflow de Aprovação — Níveis 1+2 (v1.0)

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

- Composition **`AdVideo`** (1080×1920, 15s) — 5 scenes, SVGs inline, Inter+JetBrains Mono, paleta oficial.
- Composition **`CampanhaDemo`** — adaptação do AdVideo para o ângulo "Migração Sem Trauma" (campanha-demo).

### 2.4 Dry-runs e fixtures

- `test/campanha-demo/taxa_zero_demo_2026-05-29/` — campanha-demo completa (4 ads + vídeo Remotion real + copy 4 plataformas + Publish MD)
- `test/outputs/teste_*` — artefatos dos 10 testes felizes + 5 payloads em `test/payloads/`
- `outputs/archive/test_workflow_aprovacao_2026-06-02/` e `adv2_2026-06-02/` — evidência dos testes do Workflow (rejected)
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

---

## 3. Pendente / Level-up

| # | Pendência | Impacto | Como resolver |
|---|---|---|---|
| 0 | **Chave Anthropic no painel** | Geração do painel roda **simulada** sem ela | Painel → *Configurações* → colar `sk-ant-...` → salvar (grava em `interface/.env`) |
| 1 | **`REDIS_URL` para a fila BullMQ** | A `pipeline/` **já existe** (entregue) mas roda **sequencial** sem Redis | Provisionar Redis (Upstash) + setar `REDIS_URL` + `npm run pipeline:run` |
| 2 | **`TAVILY_API_KEY` ausente** | Research é simulado | `npm i @tavily/core` + setar a chave |
| 3 | **Supabase não configurado** | Mídia não é hospedada (URLs placeholder) | `npm i @supabase/supabase-js` + `SUPABASE_URL`/`KEY` |
| 4 | **OAuth YouTube / token Instagram** | Publicação real impossível | Configurar `YOUTUBE_REFRESH_TOKEN` + IG Graph token |
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
├── src/ (Remotion: Root, AdVideo, CampanhaDemo, scenes/*, theme, components)
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

1. **Configurar a chave Anthropic no painel** (*Configurações*) — liga a geração real; é o passo mais imediato para o uso diário.
2. **Ativar a fila BullMQ** — `pipeline/` já está pronto; basta provisionar `REDIS_URL` para sair do modo sequencial.
3. **Configurar demais chaves externas** para sair do modo simulado: Tavily → Supabase → OAuth YouTube + IG.
4. **Validar caminhos reais** (busca Tavily, upload Supabase) com tasks de teste rotuladas.
5. **Lock multi-usuário** em `status.json` se evoluir para multi-operador.
6. **Estado `published`** para registrar publicação efetiva (Nível 3 — já há webapp/painel).
