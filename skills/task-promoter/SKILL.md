---
name: task-promoter
description: >
  Promove uma task do Workflow de Aprovacao 4Selet entre status (draft -> in_review ->
  approved/rejected -> in_review). Use quando o usuario disser "aprove a campanha",
  "aprovar task", "arquive", "arquivar", "rejeite", "volte para revisao", "promover task",
  ou variacoes que indiquem mudanca de status. NAO use para criar tasks novas (orchestrator),
  gerar criativos (agentes especificos), gerar preview (distribution-agent) ou publicar
  (o gate de posting nao passa por aqui).
license: proprietary
metadata:
  author: Marketing 4Selet
  version: 1.0.0
  category: marketing
  tags: [workflow, approval, status, 4selet, task-management]
---

# task-promoter — Promotor de Status de Task

Promove uma campanha no Workflow de Aprovacao 4Selet (Niveis 1/2). E o **unico** caminho
para transicionar `status.json` — nunca edite a mao.

## When to Use This Skill

Use SEMPRE que o usuario pedir, em linguagem natural, mudanca de status de uma campanha existente:

- *"Aprove a campanha black_friday, task_date 2026-06-01"*
- *"Arquive a campanha teste_meta"*
- *"Rejeite essa campanha porque o claim esta fora da marca"*
- *"Volte para revisao a campanha black_friday"*

## NAO use para

- Criar task nova -> `orchestrator` (`node scripts/orchestrator.js`).
- Gerar/editar criativos -> skills do agente (ad/video/copywriter).
- Gerar preview -> `distribution-agent` (`node scripts/generate_preview.js`).
- Publicar/postar -> o **gate de POSTING** nao passa pelo task-promoter; continua exigindo
  referencia explicita ao Publish MD.

## Steps

### Step 1 — Identificar a task
Extrair `task_name` e `task_date` do prompt. Se `task_date` ausente, consultar
`outputs/INDEX.md` (se existir) ou `outputs/approved/INDEX.md`. Multiplas com mesmo nome
-> perguntar qual.

### Step 2 — Identificar a transicao
Mapear via tabela de triggers abaixo. Frases ambiguas -> perguntar status alvo.
- Para `--to approved`, **exigir** `--by` (quem aprovou).
- Para `--to rejected`, capturar `--reason` se houver na frase; senao, perguntar (recomendado).

### Step 3 — Rodar o script

```bash
node scripts/promote_task.js \
  --task <task_name> \
  --date <task_date> \
  --to <approved|rejected|in_review> \
  [--by <user>] [--reason <texto>]
```

### Step 4 — Reportar

```
✓ Task <task_name> (<task_date>) promovida: <anterior> -> <novo>
Local atual: <caminho da pasta>
INDEX atualizado.
```

Se aprovada: lembrar que **publicacao exige referencia explicita ao Publish MD**.

## Triggers e Mapeamento

| Frase do usuario | `--to` | Obrigatorio |
|---|---|---|
| "aprove", "aprovar", "aprovada" | `approved` | `--by` |
| "arquive", "arquivar", "rejeite", "rejeitar" | `rejected` | `--reason` (opc., recomendado) |
| "volte para revisao", "voltar pra revisao" | `in_review` | — |
| "promover task" (generico) | perguntar status alvo | — |

## Examples

### Example 1 — Aprovacao
**Usuario:** "Aprove a campanha black_friday, task_date 2026-06-01. Aprovado por Joao."
**Acao:**
```bash
node scripts/promote_task.js --task black_friday --date 2026-06-01 --to approved --by "Joao"
```

### Example 2 — Arquivamento com motivo
**Usuario:** "Arquive a campanha teste_meta de 2026-05-15 porque o publico esta errado."
**Acao:**
```bash
node scripts/promote_task.js --task teste_meta --date 2026-05-15 --to rejected --reason "publico esta errado"
```

### Example 3 — Retorno para revisao
**Usuario:** "Volte para revisao a campanha lancamento_curso de 2026-05-20."
**Acao:**
```bash
node scripts/promote_task.js --task lancamento_curso --date 2026-05-20 --to in_review
```

## Transicoes legais (matriz)

```
null      -> draft
draft     -> in_review
in_review -> approved | rejected
approved  -> in_review
rejected  -> in_review
```

Tentativas fora dessa matriz retornam exit 1 com `E_INVALID_TRANSITION` e mensagem
acionavel.

## Troubleshooting

1. **Task nao encontrada** — verificar `outputs/INDEX.md` e `outputs/approved/INDEX.md`.
   Nao inventar caminhos.
2. **Transicao invalida** (ex.: `draft -> approved`) — sugerir rodar `generate_preview.js`
   antes (que passa por `in_review`).
3. **Ambiguidade** — sempre perguntar antes de rodar (nunca chute).
4. **`--by` ausente em aprovacao** — perguntar quem esta aprovando.
5. **INDEX desatualizado** — rodar `node scripts/refresh_index.js` (idempotente).

## Quality Checklist

- [ ] Identifiquei `task_name` e `task_date`.
- [ ] Confirmei a transicao alvo.
- [ ] Obtive `--by` quando alvo == `approved`.
- [ ] Rodei o script (NUNCA editei `status.json` a mao).
- [ ] Reportei estado anterior, novo, e novo caminho.
- [ ] Nao publiquei nem editei conteudo.

## Relacionamento

```
orchestrator           -> cria status.json (draft)
distribution-agent     -> gera preview, promove draft -> in_review
task-promoter (esta)   -> in_review -> approved | rejected | in_review
agentes de conteudo    -> bloqueados em outputs/approved/ (regra CRITICAL Re-aprovacao)
```

## Performance Notes

- Seguranca > velocidade. Em duvida sobre status alvo ou `--by`, **pergunte**.
- O `promote_task.js` e idempotente para `current == target` (retorna exit 1 com aviso).
- Apos approved/rejected, o INDEX e regenerado automaticamente.
