# Relatório de Validação — Workflow de Aprovação 4Selet (Níveis 1+2)

## Veredito executivo

**Status: Médio — pronto para uso interno supervisionado, bloqueador para produção multi-operador.** A implementação base entregou 10/10 testes felizes, os 4 scripts em `scripts/`, a 7ª skill (`task-promoter`), edições nos 3 SKILLs existentes e a regra CRITICAL nas 4 skills de conteúdo. O gate de POSTING do `distribution-agent` permanece intacto e o escopo "fora de" foi respeitado (sem webapp, sem publicação automática, sem notificações externas). Porém, três gaps bloqueiam uso real: (1) o `content_hash` da §3.5 não foi implementado — a invariante "approved é imutável" depende apenas do Claude obedecer instrução textual; (2) o `orchestrate.js` real (em `skills/orchestrator/scripts/`) não foi modificado e só dispara o bootstrap de `status.json` se o Claude ler a SKILL e lembrar; (3) sem git instalado, `outputs/approved/` e `outputs/archive/` não têm durabilidade — um `rm -rf` apaga toda a fonte de verdade. Antes de operação real, é necessário fechar esses três e rodar a bateria adversarial de 7 cenários (transições inválidas, args malformados, estado corrompido) cujos ramos já existem no código mas nunca foram exercitados.

## O que está sólido

- **Scripts em `scripts/` conforme spec**: `generate_preview.js`, `promote_task.js`, `refresh_index.js` entregues com nomes e propósitos corretos.
- **Schema de `status.json`**: todos os campos da spec presentes (task_name, date, status, created_at/last_updated_at com offset `-03:00`, approved_by/at, campaign_angle, platforms, history). Confirmado em `outputs/archive/test_workflow_aprovacao_2026-06-02/status.json` com history de 5 entradas.
- **Matriz `LEGAL_TRANSITIONS`** cobre níveis 1/2: `null→draft`, `draft→in_review`, `in_review→approved/rejected`, `approved→in_review`, `rejected→in_review`. `--by` obrigatório em `approved` (validação em `promote_task.js:135`).
- **Mutação atômica + movimentação robusta**: `writeJsonAtomic` + `moveDirRobust` com fallback `cp -r` + `rm -rf` para EXDEV e retry para EBUSY/EPERM no Windows.
- **Preview single-file** com Inter + JetBrains Mono, paleta oficial, header sticky, navegação âncora, 6 seções (ads/video/captions/research/publish/checklist) e checklist de 6 regras de marca (numbers/ctas/palette/competitors/emoji/hashtags).
- **Promoção idempotente** `draft→in_review` ao gerar preview (linhas 567–580 de `generate_preview.js`).
- **Edições nas SKILLs**: Step 1.5 em `orchestrator/SKILL.md`, Step 4.5 em `distribution-agent/SKILL.md`, `task-promoter/SKILL.md` novo. CRITICAL Re-aprovação confirmada em `ad-creative-designer`, `video-ad-specialist`, `copywriter-agent` e `marketing-research-agent` (linha ~33 em cada).
- **Gate de POSTING preservado**: as 3 condições originais permanecem em `distribution-agent/SKILL.md:26-34`, e o Step 4.5 reitera "NAO publicar nada neste step". Nenhum script em `scripts/` chama API de IG/YouTube nem `upload_supabase.js`.
- **Fora de escopo respeitado**: nenhuma webapp, nenhum lockfile multi-usuário, nenhuma publicação automática, nenhum webhook/email/Slack.

## Gaps e desvios (priorizados)

### Crítico

**G1 — `content_hash` / auto-revert não implementado (§3.5 da spec)**
- Spec exige detecção filesystem-level de edição em `outputs/approved/`. Implementação confia em instrução textual ("CRITICAL Re-aprovação") nas 4 skills.
- Impacto: qualquer edição via VSCode, script ou comando direto em `approved/` passa silenciosa. Sem checksum, sem trilha de auditoria, sem revert automático.
- Mitigação: armazenar SHA-256 por arquivo em `status.json` ao entrar em `approved` + script `scripts/check_approved_integrity.js` rodado por cron/pre-commit que recalcula hash e força revert para `in_review` se divergir.

**G2 — `orchestrate.js` real não invoca bootstrap de `status.json`**
- `skills/orchestrator/scripts/orchestrate.js` **não foi modificado**. O bootstrap só acontece se o Claude ler `orchestrator/SKILL.md` e rodar manualmente `scripts/orchestrator.js`.
- Impacto: execução via `orchestrate.js --file <payload>` (caminho documentado) cria a task sem `status.json`. O `generate_preview.js` no final cria com defaults, perdendo `created_at` real e history correto.
- Mitigação: extrair bootstrap como `scripts/lib/status_bootstrap.js` e invocá-lo de dentro de `orchestrate.js` (após `fs.mkdirSync(logsDir)`).

**G3 — Persistência: git ausente, `outputs/approved/` não versionado**
- Confirmado em `STATUS_PROJETO.md`. Sem versionamento, a fonte de verdade de campanhas aprovadas mora apenas no filesystem local.
- Impacto: bloqueador absoluto de produção. Qualquer `rm`, sweep de disco ou corrupção apaga aprovações.
- Mitigação: instalar git, `.gitignore` específico (versionar `outputs/approved/` + `outputs/archive/`, ignorar `outputs/<task>_<date>/` em andamento), commit inicial.

### Médio

**G4 — Estado `published` ausente do enum**
- Spec definia 5 estados; implementação tem 4. Não há transição terminal "campanha foi ao ar".
- Mitigação: adicionar `published` ao enum + transição manual única `approved → published` exigindo `--by` e timestamp. Sem isso, não há registro auditável de publicação.

**G5 — `distribution-agent` não invoca `generate_preview.js` no código**
- Step 4.5 da SKILL pede o preview, mas nada no pipeline real força. Em execução automatizada futura (worker), o Claude não está no loop.
- Mitigação: adicionar `preview_generator` como job sintético em `pipeline_plan.json` após `distribution_agent`, ou encadear em `upload_supabase.js`.

**G6 — Tasks legadas sem `status.json`**
- `test/campanha-demo/taxa_zero_demo_2026-05-29/` e `outputs/test_job_payload_1/` existem sem `status.json`. Workflow as ignora.
- Mitigação: `scripts/migrate_legacy.js` que faz bootstrap retroativo (status=draft, history com `legacy_import`) + `scripts/validate_status.js` para auditoria em lote.

**G7 — `scripts/orchestrator.js` colide conceitualmente com `skills/orchestrator/scripts/orchestrate.js`**
- Dois scripts com nomes quase iguais e responsabilidades distintas.
- Mitigação: renomear o wrapper para `scripts/init_task.js` ou similar.

**G8 — Cobertura de teste estreita**
- 10 caminhos felizes passaram. As 7 transições inválidas, `--by` ausente, JSON corrompido, task em múltiplas pastas, knowledge ausente, edição em approved, concorrência e migração nunca foram exercitados.
- Os ramos de erro existem (`E_INVALID_TRANSITION`, etc.) mas nunca foram validados.

### Baixo

**G9 — `outputs/INDEX.md` (zona ativa) não gerado** — `task-promoter/SKILL.md` Step 1 instrui consultá-lo, mas só existe `outputs/approved/INDEX.md`.

**G10 — MD parser inline mínimo** — cobre cenário conhecido; listas aninhadas, HTML embutido e footnotes podem renderizar mal.

**G11 — Docs desatualizadas** — `STATUS_PROJETO.md`, `CLAUDE.md` e `GUIA_DE_USO.md §23` referem-se a 6 agentes / 5 estados / pipeline antigo.

## Edge cases prioritários a testar

**E1 — Transição inválida `draft → approved` direto**
```bash
node scripts/promote_task.js --task campanha-x --date 2026-06-02 --to approved --by QA
```
Esperado: `exit 1` · stderr: `E_INVALID_TRANSITION: draft→approved não permitido. Rota legal: draft→in_review→approved.`

**E2 — `rejected → approved` (pular rework)**
```bash
node scripts/promote_task.js --task campanha-rej --date 2026-06-02 --to approved --by QA
```
Esperado: `exit 1` · stderr: `E_INVALID_TRANSITION: rejected→approved. Refaça: rejected→in_review→approved.`

**E3 — `--by` ausente em `approved`**
```bash
node scripts/promote_task.js --task campanha-x --date 2026-06-02 --to approved
```
Esperado: `exit 1` · stderr: `E_MISSING_APPROVER: --by é obrigatório em transições para approved.`

**E4 — Status fora do enum**
```bash
node scripts/promote_task.js --task campanha-x --date 2026-06-02 --to published --by QA
```
Esperado: `exit 1` · stderr: `E_UNKNOWN_STATE: published. Válidos: draft|in_review|approved|rejected.`

**E5 — `status.json` corrompido (JSON inválido)**
```bash
echo "{ status: draft," > outputs/campanha-x_2026-06-02/status.json
node scripts/promote_task.js --task campanha-x --date 2026-06-02 --to in_review
```
Esperado: `exit 2` · stderr: `E_STATUS_PARSE: JSON.parse falhou em outputs/campanha-x_2026-06-02/status.json.`

**E6 — Task em duas zonas simultaneamente**
```bash
mkdir outputs/campanha-x_2026-06-02 outputs/approved/campanha-x_2026-06-02
node scripts/promote_task.js --task campanha-x --date 2026-06-02 --to in_review
```
Esperado: `exit 2` · stderr: `E_DUPLICATE_LOCATION: task encontrada em 2 zonas (outputs/ e approved/).`

**E7 — Idempotência: `generate_preview` rodado 2x**
```bash
node scripts/generate_preview.js --task campanha-x --date 2026-06-02
node scripts/generate_preview.js --task campanha-x --date 2026-06-02
```
Esperado: segunda execução detecta `status === in_review`, regenera `preview.html` mas **não duplica entry em `history`**. Auditar se hoje empilha — risco de history poluído.

## Riscos de integração

**R1 — `orchestrate.js` real desacoplado do bootstrap** (🔴) — duplo orchestrator, acoplamento por prompt. Extrair `scripts/lib/status_bootstrap.js` chamado pelos dois.

**R2 — `generate_preview.js` depende do Claude lembrar do Step 4.5** (🔴) — adicionar `preview_generator` como job sintético no `pipeline_plan.json` ou encadear em `upload_supabase.js`.

**R3 — Tasks legadas (`test/campanha-demo/`, `outputs/test_job_payload_1/`)** (🟡) — `migrate_legacy.js` + `validate_status.js` + decidir destino de `test/` (recomendado: migrar demo para `outputs/campanha-demo_2026-05-29/`).

**R4 — Persistência sem git** (🔴) — instalar git + `.gitignore` (versionar `outputs/approved/`, `outputs/archive/`; excluir `outputs/<task>_<date>/` em andamento) + commit inicial.

**R5 — Gate duplo quando Meta API entrar** (🟡) — `distribution-agent` Step 5 deve ler `status.json` e abortar se `status !== "approved"`. Adicionar agora, antes do Meta API entrar, evita janela de risco.

## Documentação a atualizar

**D1 — STATUS_PROJETO.md** (hoje) — mover "Workflow de Aprovação" para Implementado v1.0; listar os 4 scripts; contagem de skills 6→7; reforçar caveat de git ausente.

**D2 — CLAUDE.md** (hoje) — é auto-carregado; sem atualização, agentes futuros executam o pipeline antigo. Documentar Step 1.5, Step N+1, 7ª skill, regra CRITICAL Re-aprovação, links para SPEC e GUIA §23.

**D3 — GUIA_DE_USO.md §23** (hoje) — auditar contra implementação real: 4 estados (sem `published`), `scripts/orchestrator.js` como wrapper novo, texto do Step N+1 casando com output do `generate_preview.js`, matriz LEGAL_TRANSITIONS, fix do refresh em `approved→in_review`.

## Recomendação final

Em ordem:

1. **Hoje (pré-produção)**: instalar git + commit inicial (R4); implementar `content_hash` + `scripts/check_approved_integrity.js` (G1); extrair `scripts/lib/status_bootstrap.js` e cabear em `orchestrate.js` (G2/R1); atualizar STATUS_PROJETO.md, CLAUDE.md e GUIA_DE_USO.md §23 (D1/D2/D3).
2. **Sprint 1**: rodar bateria adversarial (E1–E7) + 8 cenários complementares (G8); criar `migrate_legacy.js` + `validate_status.js` (G6/R3); cabear `preview_generator` no pipeline (G5/R2).
3. **Sprint 2**: adicionar estado `published` (G4); renomear `scripts/orchestrator.js` para `scripts/init_task.js` (G7); gerar `outputs/INDEX.md` da zona ativa (G9); cabear gate `status === approved` no distribution-agent Step 5 (R5).
4. **Quando uso multi-operador entrar**: adicionar `proper-lockfile` por task_dir (race no `status.json`); eval suite de 20 prompts medindo obediência da regra CRITICAL (target 100%).

---

# Prompt de Ajustes — Pronto para VPS

```
Implementar AJUSTES no Workflow de Aprovação 4Selet (Níveis 1+2).
A implementação base já está pronta e passou 10/10 testes felizes; agora cobrir os
gaps de robustez, integração com pipeline existente e documentação.

───────────────────────────────────────────────────────────────
CONTEXTO
───────────────────────────────────────────────────────────────

Já está pronto:
- 4 scripts em scripts/: orchestrator.js (wrapper), generate_preview.js, promote_task.js, refresh_index.js
- 7ª skill task-promoter/SKILL.md
- Step 1.5 em orchestrator/SKILL.md, Step 4.5 em distribution-agent/SKILL.md
- Regra CRITICAL Re-aprovação em 4 skills de conteúdo
- Schema completo de status.json (timezone -03:00, history, approved_by/at)
- Matriz LEGAL_TRANSITIONS com 4 estados (draft, in_review, approved, rejected)
- writeJsonAtomic + moveDirRobust (fallback EXDEV, retry EBUSY/EPERM)
- Preview single-file (Inter + JetBrains Mono, paleta oficial, 6 seções, checklist 6 regras)
- 10 testes felizes confirmados em outputs/archive/test_workflow_aprovacao_2026-06-02/

Falta cobrir:
- content_hash da §3.5 (auto-revert filesystem-level — hoje só governance via prompt)
- Integração real com orchestrate.js (bootstrap depende do Claude ler SKILL)
- Integração real com distribution-agent (preview depende do Claude lembrar Step 4.5)
- Tasks legadas sem status.json (test/campanha-demo, outputs/test_job_payload_1)
- Persistência (git não instalado — outputs/approved/ sem durabilidade)
- Bateria adversarial (7 cenários — ramos existem no código mas nunca foram exercitados)
- Docs (STATUS_PROJETO.md, CLAUDE.md, GUIA_DE_USO.md §23 desatualizadas)

───────────────────────────────────────────────────────────────
DELIVERABLES (priorizados)
───────────────────────────────────────────────────────────────

A) AJUSTES CRÍTICOS (🔴 — pré-produção)

A.1 — Instalar git + persistência de outputs/approved
   Arquivo: .gitignore (novo na raiz)
   Mudança: versionar outputs/approved/ e outputs/archive/; ignorar outputs/<task>_<date>/
            em andamento, node_modules/, logs/.
   Como testar:
     git status deve listar apenas approved/ e archive/ como rastreáveis;
     tasks em andamento (outputs/<task>_<date>/) não aparecem.
   Comando final: git init && git add . && git commit -m "Workflow de Aprovação v1.0"

A.2 — content_hash + integridade de approved
   Arquivo novo: scripts/lib/content_hash.js (utilitário SHA-256 por arquivo).
   Arquivo novo: scripts/check_approved_integrity.js
   Mudança em promote_task.js:
     - Ao transicionar para approved, calcular SHA-256 de cada arquivo da pasta
       e armazenar em status.json sob "content_hashes": { "<path>": "<sha>" }.
   check_approved_integrity.js:
     - Varre outputs/approved/*/status.json
     - Recalcula hashes; se divergir, escreve warning em logs/integrity_<ts>.log
       e (opcional via --auto-revert) move a task de volta para in_review,
       adicionando entry em history com event_type="auto_revert".
   Como testar:
     1) promote task X para approved
     2) editar manualmente arquivo em outputs/approved/X/
     3) rodar node scripts/check_approved_integrity.js — deve listar divergência
     4) rodar com --auto-revert — task volta para outputs/<task>_<date>/ com history atualizado

A.3 — Extrair bootstrap como módulo + cabear em orchestrate.js real
   Arquivo novo: scripts/lib/status_bootstrap.js
   Mudança:
     - Extrair as ~40 linhas de criação de status.json hoje em scripts/orchestrator.js
       para um módulo exportando bootstrapStatusJson({ taskName, date, campaignAngle,
       platforms, taskDir }).
     - scripts/orchestrator.js passa a importar e chamar esse módulo.
     - skills/orchestrator/scripts/orchestrate.js: após fs.mkdirSync(logsDir, ...),
       importar e invocar bootstrapStatusJson() com os mesmos args derivados do payload.
   Bloqueio: se status.json já existir com status ∈ {approved, rejected}, abortar com
     E_REBOOTSTRAP_BLOCKED (não sobrescrever histórico de tasks já avaliadas).
   Como testar:
     1) node skills/orchestrator/scripts/orchestrate.js --file test/payload.json
     2) Verificar que outputs/<task>_<date>/status.json é criado com created_at,
        history inicial e timezone -03:00.
     3) Rodar novamente — segunda execução deve detectar status.json existente e
        emitir aviso sem sobrescrever.

B) ROBUSTEZ (🟡 — alto valor)

B.1 — Bateria de testes adversariais (test/workflow_adversarial.spec.js)
   Sete testes obrigatórios, cada um valida exit code + mensagem stderr:

   B.1.1 — draft → approved direto
     Cmd: node scripts/promote_task.js --task adv1 --date 2026-06-02 --to approved --by QA
     Esperado: exit 1, stderr contém "E_INVALID_TRANSITION" e "draft→approved"

   B.1.2 — rejected → approved
     Cmd: node scripts/promote_task.js --task adv2 --date 2026-06-02 --to approved --by QA
     Esperado: exit 1, "E_INVALID_TRANSITION" e "rejected→approved"

   B.1.3 — --by ausente em approved
     Cmd: node scripts/promote_task.js --task adv3 --date 2026-06-02 --to approved
     Esperado: exit 1, "E_MISSING_APPROVER"

   B.1.4 — estado fora do enum
     Cmd: node scripts/promote_task.js --task adv4 --date 2026-06-02 --to published --by QA
     Esperado: exit 1, "E_UNKNOWN_STATE: published" + lista de válidos

   B.1.5 — status.json corrompido
     Preparação: gravar "{ status: draft," em status.json
     Cmd: node scripts/promote_task.js --task adv5 --date 2026-06-02 --to in_review
     Esperado: exit 2, "E_STATUS_PARSE"

   B.1.6 — task em duas zonas
     Preparação: criar outputs/adv6_.../ e outputs/approved/adv6_.../
     Cmd: node scripts/promote_task.js --task adv6 --date 2026-06-02 --to in_review
     Esperado: exit 2, "E_DUPLICATE_LOCATION"

   B.1.7 — idempotência de generate_preview
     Cmd: rodar generate_preview.js 2x na mesma task em in_review
     Esperado: preview.html regenerado, history NÃO duplicado (mesma contagem antes/depois
       da segunda execução). Auditar e corrigir se houver duplicação.

B.2 — Adicionar mensagens acionáveis em cada ramo de erro
   Garantir que todo throw inclua: código (E_*), descrição da causa, rota correta de recuperação.
   Exemplo: "E_INVALID_TRANSITION: draft→approved não permitido. Rota legal:
            draft→in_review→approved. Rode primeiro --to in_review."

C) INTEGRAÇÃO COM PIPELINE EXISTENTE (🟡)

C.1 — orchestrate.js (real) invoca bootstrap (coberto em A.3).

C.2 — distribution-agent invoca generate_preview.js diretamente
   Opção escolhida: adicionar job sintético "preview_generator" ao pipeline_plan.json
   em orchestrate.js, após o job distribution_agent.
   Mudança em skills/orchestrator/scripts/orchestrate.js:
     - Após montar a lista de jobs, push de:
       { name: "preview_generator", script: "scripts/generate_preview.js",
         args: ["--task", taskName, "--date", date], depends_on: "distribution_agent" }
   Worker que executa pipeline_plan.json roda automaticamente ao chegar nesse job.
   Como testar: rodar pipeline ponta-a-ponta e confirmar que preview.html é gerado
     sem o Claude ter sido instruído a rodar manualmente.

C.3 — scripts/migrate_legacy.js + scripts/validate_status.js
   migrate_legacy.js:
     - Varre outputs/* e test/campanha-demo/*
     - Pula pastas que já tenham status.json
     - Cria status.json com status="draft", legacy=true,
       created_at = mtime da pasta, history=[{ event_type: "legacy_import",
       by: "migrate_legacy", at: <now> }]
     - Decidir destino do test/campanha-demo: migrar para outputs/campanha-demo_2026-05-29/
       (recomendado) OU manter em test/ com flag --include-test.
   validate_status.js:
     - Varre outputs/*/status.json e outputs/approved/*/status.json
     - Reporta: campos faltantes, status divergente do último history.to,
       pasta em zona inconsistente com status, content_hashes ausentes em approved.
     - Exit 0 se tudo OK; exit 1 com lista de inconsistências caso contrário.
   Como testar:
     1) node scripts/migrate_legacy.js --dry-run — lista o que faria
     2) node scripts/migrate_legacy.js — executa
     3) node scripts/validate_status.js — exit 0

D) DOCUMENTAÇÃO (🟢🟡)

D.1 — STATUS_PROJETO.md
   - Mover "Workflow de Aprovação" da seção pendente para Implementado (v1.0).
   - Listar os 4 scripts em scripts/ com 1 linha de propósito cada.
   - Trocar contagem de skills: 6 → 7 (incluir task-promoter).
   - Reforçar caveat: git agora instalado (após A.1), outputs/approved/ versionado.
   - Adicionar bloco "Cenários cobertos": 10 felizes + 7 adversariais (após B.1).

D.2 — CLAUDE.md
   - Atualizar pipeline canônico: incluir Step 1.5 (bootstrap status.json) e
     Step N+1 (preview + promoção draft→in_review).
   - Trocar "6 agentes" por "7 agentes"; listar task-promoter como skill de transição.
   - Adicionar bloco "Documentação de referência" no topo com ordem de leitura:
     1) STATUS_PROJETO.md  2) GUIA_DE_USO.md  3) SPEC_WORKFLOW_APROVACAO.md
     4) skills/<nome>/SKILL.md
   - Mencionar regra CRITICAL Re-aprovação (não editar approved/ direto — rework via promote_task).

D.3 — GUIA_DE_USO.md §23
   - Confirmar 4 estados (draft, in_review, approved, rejected) — remover qualquer "published".
   - Confirmar scripts/orchestrator.js é wrapper novo (≠ skills/orchestrator/scripts/orchestrate.js).
   - Validar texto do Step N+1 contra o output real do generate_preview.js.
   - Atualizar §6.2: refresh_index também dispara em approved → in_review.
   - Confirmar matriz LEGAL_TRANSITIONS bate com o código.

D.4 — SPEC_WORKFLOW_APROVACAO.md — v1.1 pós-implementação
   - Adicionar changelog no topo com desvios deliberados:
     (a) scripts/orchestrator.js criado como wrapper (não edição do orchestrate.js real
         — corrigido em A.3 desta task)
     (b) MD parser inline mínimo no preview (parágrafos, headings, listas, code,
         link/img, tabelas básicas)
     (c) refresh_index estendido para approved → in_review
   - Bloco "Issues conhecidas":
     - content_hash da §3.5 implementado em A.2 (atualizar para "feito")
     - status enum mantido em 4 estados (decisão: published fica fora do escopo
       Níveis 1/2; será reavaliado em Nível 3)
   - Bloco "Cenários adversariais cobertos" listando os 7 testes B.1.1–B.1.7.

───────────────────────────────────────────────────────────────
ACEITAÇÃO
───────────────────────────────────────────────────────────────

1. git instalado, .gitignore configurado, commit inicial feito com outputs/approved/
   e outputs/archive/ versionados.
2. content_hash gravado em status.json ao entrar em approved; check_approved_integrity.js
   detecta divergência e (com --auto-revert) move task para in_review.
3. orchestrate.js real cria status.json automaticamente via scripts/lib/status_bootstrap.js
   (sem depender do Claude rodar scripts/orchestrator.js manualmente).
4. Pipeline gera preview.html automaticamente ao final do distribution_agent
   (job sintético preview_generator em pipeline_plan.json).
5. Todos os 7 testes adversariais (B.1.1–B.1.7) passam com exit codes e mensagens
   stderr esperadas.
6. migrate_legacy.js + validate_status.js entregues e testados.
7. STATUS_PROJETO.md, CLAUDE.md, GUIA_DE_USO.md §23 sincronizados com implementação.
8. SPEC_WORKFLOW_APROVACAO.md marcado como v1.1 com changelog e issues conhecidas.

───────────────────────────────────────────────────────────────
NÃO MEXER
───────────────────────────────────────────────────────────────

- Gate de POSTING do distribution-agent (linhas 26-34 da SKILL.md).
- Knowledge files (knowledge/*.md, knowledge/*.json).
- Lógica de mover pasta em promote_task.js (moveDirRobust + writeJsonAtomic já
  validadas nos 10 testes felizes).
- A regra CRITICAL Re-aprovação nas 4 skills de conteúdo (continua válida —
  agora reforçada por filesystem em A.2).
- Matriz LEGAL_TRANSITIONS atual — qualquer ampliação (ex: published) é fora
  do escopo desta task.

───────────────────────────────────────────────────────────────
REPORTE AO FINAL
───────────────────────────────────────────────────────────────

1. Diff resumido de cada arquivo tocado (paths absolutos + linhas afetadas).
2. Resultado dos 7 testes adversariais — tabela com:
   teste | comando | exit code observado | exit code esperado | match (✅/❌) | stderr trecho
3. Lista de docs atualizadas (caminho + versão antes/depois).
4. Output de `git log --oneline -5` confirmando commits.
5. Bloco "Issues abertas pós-task" — se algo não foi possível concluir, listar
   com justificativa e proposta de próximo passo.
```
