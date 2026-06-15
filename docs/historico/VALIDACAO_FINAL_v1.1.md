# Validação Final v1.1 — Workflow de Aprovação 4Selet

## Veredito de production readiness

**🟡 MÉDIO — Estruturalmente pronto, operacionalmente bloqueado.** O trabalho de v1.1 fechou os 3 gaps críticos (G1 content_hash, G2 bootstrap, G3 git) no nível de código e os 7 testes adversariais B.1.x passaram. Porém, **nenhum dos 3 gaps foi exercitado end-to-end em runtime** — a bateria B.1 testa estados e parsing, não os fluxos centrais. Além disso, **R5 (gate duplo no distribution-agent) está aberto** e é incompatível com qualquer integração Meta API real. **Condições mínimas para ir a uso real:** (1) implementar R5 gate duplo, (2) rodar bateria B.2 de runtime proof do content_hash, (3) configurar git remote + push automatizado. Sem esses 3, o sistema é "v1.1 declarada", não "v1.1 validada".

## ✅ O que está consolidado

- **G1 content_hash** — `scripts/lib/content_hash.js` com SHA-256, `promote_task.js` gravando hashes, `check_approved_integrity.js --auto-revert` implementado, preservação de `previous_approval`. Padrão `crypto.createHash` é trivial e baixo risco.
- **G2 bootstrap** — `scripts/lib/status_bootstrap.js` idempotente, cabeado em `skills/orchestrator/scripts/orchestrate.js`, `E_REBOOTSTRAP_BLOCKED` para tasks `approved/rejected`, job sintético `preview_generator` no `pipeline_plan.json`.
- **G3 git** — v2.54.0 instalado, `.gitignore` versionando `approved/` + `archive/` e ignorando working dirs, 176 arquivos comitados (`bde9f60`, `9bc30be`).
- **Bateria adversarial B.1** — 7/7 testes PASS cobrindo transições de estado, parsing de `status.json`, idempotência de `generate_preview`, status corrompido/duplicado.
- **Scripts auxiliares** — 9 scripts presentes (7 em `scripts/` + 2 em `scripts/lib/`), incluindo `validate_status.js` e `migrate_legacy.js`.
- **7ª skill** — `task-promoter` integrada ao pipeline.
- **GUIA Desktop v2.6** — guia operacional completo de 1664 linhas com §23 dedicada ao workflow (estados, prompts, schema do `status.json`, distinção wrapper vs orchestrate.js real).

## 🟡 Gaps que ficaram (priorizados)

### 🔴 Críticos — bloqueiam produção real

1. **R5 — Gate duplo no distribution-agent Step 5** — Sem ler `status.json.state === 'approved'` em runtime e reverificar `content_hashes`, qualquer pasta `approved/` órfã (falha parcial de `reject_task`, restore de backup, edição manual) vaza para a Meta API com cobrança de impressão real.
2. **Bateria B.2 ausente** — G1 não foi exercitado adversarialmente. Os 3 testes obrigatórios (edit detection, auto-revert com reversão de bytes, task vazia) não rodaram. `diffHashes` pode comparar campos errados, `--auto-revert` pode não restaurar bytes corretamente — sem prova, é fé.
3. **G2 sem runtime proof** — O cenário canônico `node skills/orchestrator/scripts/orchestrate.js --file payload.json` → assert `status.json` criado **não foi testado**. B.1.5/B.1.6 pressupõem o arquivo já existente.
4. **Backup remoto inexistente** — `.git` mora apenas no disco da VPS. Falha de disco apaga `history[]`, `content_hashes`, decisões de approver. Durabilidade local ≠ durabilidade real.

### 🟡 Médios — próximo sprint

5. **Tasks legadas não migradas** — `migrate_legacy.js` existe há horas e não rodou. 2/4 tasks falhando no `validate_status` poluem o sinal de auditorias futuras.
6. **Documentação fragmentada** — CLAUDE.md com "4 linhas" é insuficiente; STATUS_PROJETO local ainda diz `git ❌` e "6 skills"; SPEC v1.0 (805 linhas) vs SPEC v1.1 VPS (93 linhas) = perda massiva de design.
7. **Concorrência sem lock real** — Dois `generate_preview.js` simultâneos sobrescrevem `status.json`; `--auto-revert` durante leitura de `INDEX.md` gera incoerência. Documentar regra "1 comando por task" antes de planejar `proper-lockfile` v1.2.
8. **preview.html paths quebrados** — Quando `generate_preview` lê de `approved/<task>/` mas grava preview em `outputs/<task>/`, paths relativos `<img src="ads/banner.jpg">` apontam para diretório inexistente.

### 🟢 Baixos — polish

9. **Permission denied no rename** (Windows com lock do explorer/IDE) — falta fallback, exit code não-mapeado.
10. **EXDEV cross-device move** — `fs.renameSync` falha se `outputs/` e `approved/` em mounts diferentes; falta fallback `copy+unlink`.
11. **INDEX.md O(n)** — regeneração linear aceitável até 200 aprovadas, mas leitura humana já degrada em 50+.
12. **GUIA §23 desatualizado** — linha 1604 ainda diz "content_hash não foi implementado"; não documenta os 6 códigos de erro nem os scripts auxiliares.

## 🚨 Bloqueador imediato

**R5 — Gate duplo no distribution-agent.** Por que é o bloqueador #1 antes de qualquer integração Meta API:

O Step 5 do `distribution-agent` é **o ponto de não-retorno** — uma vez que `POST /act_<id>/ads` sai com `status: 'ACTIVE'`, a Meta cobra impressão real. A v1.1 atual lista `approved/` por filesystem, **não por estado lógico**. Cenário concreto: operador roda `reject_task`, script falha após gravar `status.json` mas antes de mover a pasta (ou vice-versa) — pasta `approved/<task>/` persiste com `state: 'rejected'`. Distribution-agent publica. Custo: ad veiculado + pausa manual na Meta + risco reputacional se foi reprovado por compliance.

`content_hash` **não** protege contra isso — ele protege contra adulteração silenciosa do criativo, não contra publicação de criativo cujo estado lógico não é `approved`. Custo de implementação: ~30 linhas. **Implementar antes mesmo de testar credencial Meta.**

## 🎯 Próximos 3 passos (em ordem)

1. **Implementar R5 no distribution-agent** como `Step 5a — Pre-publish gate` (ler `status.json.state` + reverificar `content_hashes` em runtime, abortar se divergir). Custo: ~30 minutos.
2. **Rodar bateria B.2** (3 testes runtime do G1) + smoke test do G2 (`orchestrate.js --file payload.json` → assert `status.json`). Custo: ~2 horas.
3. **Configurar git remote privado + push automatizado** (GitHub privado gratuito, `git remote add origin`, hook `post-commit` ou cron 5min). Custo: ~15 minutos.

Depois disso (sprint seguinte): rodar `migrate_legacy.js --dry-run`, consolidar GUIA único, expandir CLAUDE.md.

## 🔧 Prompt de ajustes mínimo para a VPS

```
Implementar 3 itens críticos antes de Meta API:

1) R5 GATE DUPLO no distribution-agent (Step 5a, pre-publish):
   Antes de qualquer POST /act_<id>/ads, para cada task em approved/:

   const status = JSON.parse(fs.readFileSync(`approved/${task}/status.json`));
   if (status.state !== 'approved') {
     throw new Error(`E_INVALID_STATE: ${task} state=${status.state}`);
   }
   const currentHashes = computeContentHashes(`approved/${task}`);
   const diff = diffHashes(status.content_hashes, currentHashes);
   if (diff.length > 0) {
     throw new Error(`E_HASH_MISMATCH: ${task} fields=${diff.join(',')}`);
   }
   // só então publicar

2) BATERIA B.2 (scripts/tests/b2_runtime.js) — 3 cenários:
   B.2.1: promote task fixture → editar 1 byte em approved/<task>/ad.html
          → rodar check_approved_integrity.js (sem flag)
          → assert exit=1, stderr cita hash esperado vs atual, sem mutação
   B.2.2: idem com --auto-revert
          → assert pasta voltou para outputs/, INDEX.md sem a linha,
                   status.state='draft', history[] tem event_type='edit_revert',
                   previous_approval preservado
   B.2.3: promover task sem ads/, video/, copy/
          → verificar se content_hashes={} ou ausente
          → confirmar que integrity NÃO retorna 0 silencioso
            (evitar bypass do gate R5 via task vazia)

3) BACKUP REMOTO:
   - Criar repo privado em github.com/4selet/marketing-workflow
   - git remote add origin git@github.com:4selet/marketing-workflow.git
   - git push -u origin main
   - Adicionar .git/hooks/post-commit:
       #!/bin/sh
       git push origin main 2>/dev/null &
   - chmod +x .git/hooks/post-commit
   - Cron de fallback: */5 * * * * cd /path/repo && git push origin main
```

## 📋 Sobre o conflito de 2 guias

**Diagnóstico:** coexistem dois GUIA_DE_USO.md divergentes:

- **Desktop v2.6** (1664 linhas, 25 seções) — operacional completo, com §23 cobrindo workflow de aprovação, schema do `status.json`, 4 prompts canônicos, distinção wrapper `scripts/orchestrator.js` vs `skills/orchestrator/scripts/orchestrate.js`. Mas linha 1604 ainda afirma "content_hash não foi implementado" (fato superado pelo G1) e não documenta códigos de erro (E_INVALID_TRANSITION, E_MISSING_APPROVER, E_UNKNOWN_STATE, E_STATUS_PARSE, E_DUPLICATE_LOCATION, E_REBOOTSTRAP_BLOCKED), `validate_status.js`, `check_approved_integrity.js --auto-revert` ou `migrate_legacy.js`.
- **VPS v1.0** (134 linhas) — aparentemente criado do zero em vez de portar a v2.6, com placeholders nas demais seções. É uma **regressão**, não um avanço.

Mesma análise se aplica ao SPEC: local v1.0 (805 linhas de design) vs VPS v1.1 (93 linhas) = perda de 712 linhas de fundamentação.

**Decisão recomendada:**

1. **GUIA** — Descartar VPS v1.0. Adotar Desktop v2.6 como base canônica. Atualizar §23: remover aviso "content_hash não implementado", adicionar tabela dos 6 códigos de erro, documentar `validate_status`, `check_approved_integrity --auto-revert`, `migrate_legacy`, atualizar contagem para 7 skills (incluir `task-promoter`). Publicar como **v2.7**. Deletar VPS v1.0.
2. **SPEC** — Manter v1.0 (805 linhas) como corpo do design. **Anexar no topo** changelog v1.0→v1.1 com (a) 4 desvios deliberados, (b) 6 issues fechadas com IDs G1/G2/G3, (c) 5 issues abertas G4/G7/G9/R5/lock, (d) mapa atualizado incluindo `scripts/lib/content_hash.js` e `scripts/lib/status_bootstrap.js`. Republicar como **v1.1** preservando o design.
3. **CLAUDE.md** — Adicionar seção "Workflow de Aprovação v1.1" com: 7 skills (não 6), Step 1.5 bootstrap, **status atual de R5 como aberto** (não anunciar gate como pronto), regra CRITICAL Re-aprovação, comandos `node scripts/<x>.js`. Quatro linhas é insuficiente.
4. **STATUS_PROJETO.md** — Flip `git ❌` → `✅ v2.54.0`; "6 skills" → "7 skills"; adicionar bloco "Workflow v1.1" listando os 9 scripts, 7/7 adversariais PASS, e os 4 itens deliberadamente fora de escopo.

Manter dois guias é receita pra divergência silenciosa — usuários copiam comando antigo, auditorias contradizem realidade.

## Conclusão

O sistema está **estruturalmente sólido mas operacionalmente não-validado**: os 3 críticos foram fechados no código, mas nenhum exercitado em runtime nos pontos exatos onde o gap original doía; para ir a produção real, fechar **R5 gate duplo + bateria B.2 + git remote** — sem esses três, qualquer integração Meta API publica com risco de criativo não-aprovado e qualquer falha de disco apaga toda a trilha de aprovação.
