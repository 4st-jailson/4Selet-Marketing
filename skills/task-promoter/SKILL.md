---
name: task-promoter
description: >
  Promove uma task do Workflow de Aprovacao 4Selet entre status (draft -> in_review ->
  approved/rejected -> in_review). Use quando o usuario disser "aprove a campanha",
  "aprovar task", "rejeite", "volte para revisao", "promover task", ou variacoes que
  indiquem mudanca de status. "Arquivar" e ambiguo hoje — pergunte (ver Triggers). NAO use
  para criar tasks novas (orchestrator), gerar criativos (agentes especificos), gerar preview
  (distribution-agent) ou publicar (a publicacao acontece no painel, atras do gate R5).
license: proprietary
metadata:
  author: Marketing 4Selet
  version: 2.0.0
  category: marketing
  tags: [workflow, approval, status, 4selet, task-management]
---

# task-promoter — Promotor de Status de Task

Promove uma campanha no Workflow de Aprovacao 4Selet (Niveis 1/2). E o **unico caminho manual/por comando** para transicionar `status.json` — nunca edite a mao. *(O auto-revert de integridade tambem transiciona, sozinho: `approved -> draft`. Ver a matriz.)*

## Caminho principal: o painel

O Hugo aprova e publica pelo **painel** (`https://mkt.4st.co`), nao pelo CLI. Os botoes chamam **exatamente este script**, com a mesma matriz e os mesmos erros:

| Botao no painel | Equivalente CLI |
|---|---|
| **Aprovar** | `--to approved --by "<quem>"` |
| **Rejeitar** | `--to rejected --reason "<motivo>"` |
| **Reabrir para edicao** | `--to in_review` |
| **Descartar peca** | *(nao existe flag)* — move para `outputs/_archived/` sem tocar no status |

> **Ressalva importante:** o CLI so afeta a copia **local** de `outputs/`. A peca do Hugo esta no container de **producao** — rodar o script nesta maquina nao muda nada para ele. Para peca em producao, a transicao tem que ser feita **no painel**.

## When to Use This Skill

Use SEMPRE que o usuario pedir, em linguagem natural, mudanca de status de uma campanha existente:

- *"Aprove a campanha black_friday, task_date 2026-06-01"*
- *"Rejeite essa campanha porque o claim esta fora da marca"*
- *"Volte para revisao a campanha black_friday"*

## NAO use para

- Criar task nova -> `orchestrator` (`node scripts/orchestrator.js`).
- Gerar/editar criativos -> skills do agente (ad/video/copywriter).
- Gerar preview -> `distribution-agent` (`node scripts/generate_preview.js`).
- Publicar/postar -> a publicacao real acontece **no painel** (botao "Publicar ou agendar"), atras do gate R5 (`status approved` + `content_hashes` conferidos em runtime, em `interface/lib/publish.js`). No caminho CLI/agente historico, o gate adicional continua sendo a referencia explicita ao Publish MD.

## Steps

### Step 1 — Identificar a task
Extrair `task_name` e `task_date` do prompt. Sem `task_date`:

- tasks **nao aprovadas**: listar as pastas de `outputs/` no formato `<task_name>_<YYYY-MM-DD>` (nao existe `outputs/INDEX.md` — nenhum script gera esse arquivo);
- tasks **aprovadas**: `outputs/approved/INDEX.md` (o unico INDEX gerado, por `scripts/refresh_index.js`).

Multiplas com o mesmo nome -> perguntar qual.

### Step 2 — Identificar a transicao
Mapear via tabela de triggers abaixo. Frases ambiguas -> perguntar status alvo.
- Para `--to approved`, **exigir** `--by` (quem aprovou).
- Para `--to rejected`, capturar `--reason` se houver na frase; senao, perguntar (recomendado).
- **Antes de `--to in_review` numa peca ja publicada** (com `published_at`), avisar o usuario: a marca de publicacao **sera apagada** (ver "O que o script muda alem do status").

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
Task <task_name> (<task_date>) promovida: <anterior> -> <novo>
Local atual: <caminho da pasta>
INDEX atualizado.
```

Se aprovada: o proximo passo real e o botao **"Publicar ou agendar"** no painel — a peca precisa estar em `approved` com os hashes intactos.
Se voltou de `approved` para `in_review` **e a peca estava publicada**: avisar explicitamente que a marca de publicada foi removida.

## O que o script muda alem do status

| Alvo | Efeitos colaterais |
|---|---|
| `approved` | grava `approved_by`, `approved_at`, `content_hashes` e `preview_hash` |
| `rejected` | grava `rejected_by`, `rejected_at`, `rejection_reason`; move para `outputs/archive/` |
| `in_review` **vindo de approved** | **APAGA `published_at`, `published_by` e `last_post_id`**, movendo-os para `previous_publication`. A peca sai de "Publicado" no painel |
| `in_review` **vindo de rejected** | limpa `rejected_by`/`rejected_at`/`rejection_reason` e **incrementa `revision`** |

O painel depende dessas marcas: com `published_at` presente, publicar de novo devolve `E_ALREADY_PUBLISHED` e o botao de publicar fica escondido. Reabrir uma peca publicada e, na pratica, "destravar" para republicar — informe isso antes de rodar.

## Triggers e Mapeamento

| Frase do usuario | `--to` | Obrigatorio |
|---|---|---|
| "aprove", "aprovar", "aprovada" | `approved` | `--by` |
| "rejeite", "rejeitar", "reprovar" | `rejected` | `--reason` (opc., recomendado) |
| "volte para revisao", "reabrir para edicao" | `in_review` | — |
| **"arquive", "arquivar"** | **perguntar** | Hoje sao **duas operacoes diferentes**: *Rejeitar* (status `rejected`, vai para `outputs/archive/`) ou *Descartar peca* (vai para `outputs/_archived/`, **sem mudar o status**, feito no painel — nao ha flag no `promote_task.js`) |
| "promover task" (generico) | perguntar status alvo | — |

## Examples

### Example 1 — Aprovacao
**Usuario:** "Aprove a campanha black_friday, task_date 2026-06-01. Aprovado por Joao."
**Acao:**
```bash
node scripts/promote_task.js --task black_friday --date 2026-06-01 --to approved --by "Joao"
```

### Example 2 — Rejeicao com motivo
**Usuario:** "Rejeite a campanha teste_meta de 2026-05-15 porque o publico esta errado."
**Acao:**
```bash
node scripts/promote_task.js --task teste_meta --date 2026-05-15 --to rejected --reason "publico esta errado"
```

### Example 3 — Retorno para revisao
**Usuario:** "Volte para revisao a campanha lancamento_curso de 2026-05-20."
**Acao:** conferir se ha `published_at`; se houver, avisar que a marca de publicada sera removida. Depois:
```bash
node scripts/promote_task.js --task lancamento_curso --date 2026-05-20 --to in_review
```

### Example 4 — "Arquive essa peca"
**Usuario:** "Arquive a campanha teste_meta."
**Acao:** **perguntar** — "Rejeitar (marca como rejeitada e vai para os arquivos) ou apenas descartar da lista (sem mudar o status)?" Nao chutar.

## Transicoes legais (matriz)

```
null      -> draft
draft     -> in_review
in_review -> approved | rejected
approved  -> in_review
rejected  -> in_review
approved  -> draft      (edit_revert — NAO e feito pelo promote_task.js;
                         so por scripts/check_approved_integrity.js --auto-revert)
```

Tentativas fora dessa matriz retornam exit 1 com `E_INVALID_TRANSITION` e mensagem acionavel.

> **Sobre o 6o arco:** quando uma peca aprovada e editada, o `check_approved_integrity.js --auto-revert` detecta a divergencia de hashes, grava `previous_approval` e devolve a peca para `draft` dentro de `outputs/`. **Isso e estado legitimo, nao corrupcao.** A rota de volta e `generate_preview.js` (-> `in_review`) e depois `--to approved`.

## Zonas (onde a peca pode estar)

| Zona | Status | Quem coloca la |
|---|---|---|
| `outputs/<task>_<data>/` | `draft` / `in_review` | orchestrator, preview, rework |
| `outputs/approved/<task>_<data>/` | `approved` | `promote_task.js --to approved` |
| `outputs/archive/<task>_<data>/` | `rejected` | `promote_task.js --to rejected` |
| `outputs/_archived/<task>_<data>/` | **status inalterado** | "Descartar peca" no painel (`discardTask`) |

O `promote_task.js` procura em **tres** zonas (`outputs/`, `approved/`, `archive/`) — **ele nao enxerga `_archived/`**. Peca descartada precisa ser restaurada antes.

## Troubleshooting

1. **Task nao encontrada** — listar as pastas de `outputs/` e conferir `outputs/approved/INDEX.md`. Se nao aparecer, checar `outputs/_archived/` (descartada pelo painel — o script nao enxerga essa zona). Nao inventar caminhos.
2. **Transicao invalida** (ex.: `draft -> approved`) — rodar `generate_preview.js` antes (passa por `in_review`).
3. **Peca em `draft` dentro de `outputs/` que voce jurava estar aprovada** — provavel `edit_revert` (edicao pos-aprovacao detectada). Conferir `previous_approval` no `status.json`.
4. **Ambiguidade** — sempre perguntar antes de rodar (nunca chute). Vale especialmente para "arquivar".
5. **`--by` ausente em aprovacao** — perguntar quem esta aprovando.
6. **INDEX desatualizado** — rodar `node scripts/refresh_index.js` (idempotente; gera **apenas** `outputs/approved/INDEX.md`).

## Quality Checklist

- [ ] Identifiquei `task_name` e `task_date`.
- [ ] Confirmei a transicao alvo (e desambiguei "arquivar").
- [ ] Obtive `--by` quando alvo == `approved`.
- [ ] Avisei sobre perda da marca de publicacao antes de reabrir peca publicada.
- [ ] Rodei o script (NUNCA editei `status.json` a mao).
- [ ] Reportei estado anterior, novo, novo caminho e efeitos colaterais.
- [ ] Deixei claro se a peca esta em producao (painel) ou so na copia local.
- [ ] Nao publiquei nem editei conteudo.

## Relacionamento

```
orchestrator                     -> cria status.json (draft)
preview_generator/distribution   -> gera preview, promove draft -> in_review
task-promoter (esta)             -> in_review -> approved | rejected · approved/rejected -> in_review
check_approved_integrity         -> approved -> draft (edit_revert, automatico)
agentes de conteudo              -> bloqueados em outputs/approved/ (regra CRITICAL Re-aprovacao)
painel                           -> executa os mesmos comandos pelos botoes; publica atras do gate R5
```

## Performance Notes

- Seguranca > velocidade. Em duvida sobre status alvo ou `--by`, **pergunte**.
- **Chamar com `current == target` NAO e no-op:** aborta com `E_INVALID_TRANSITION: task ja esta em '<alvo>'` e exit 1, **sem escrever nada**. Reporte como "nenhuma mudanca — a peca ja estava em `<alvo>`", nunca como sucesso.
- Apos approved/rejected, o INDEX de aprovados e regenerado automaticamente.
