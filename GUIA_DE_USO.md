# Guia de Uso — Equipe de Marketing 4Selet

*Versão 1.0 · 2026-06-02 · Operação prática do sistema*

> Este guia é orientado a **uso** (o que rodar, em que ordem). Para o **contrato** dos contratos JSON, ver `SPEC_WORKFLOW_APROVACAO.md`. Para o **estado** atual, ver `STATUS_PROJETO.md`.

## Índice

1–22. Operação de conteúdo (research → ad → vídeo → copy → distribution)
**23. Workflow de Aprovação (Níveis 1+2)** ← foco deste documento na v1.0
24. Persistência, git e backups
25. Troubleshooting rápido

---

## §23 · Workflow de Aprovação (Níveis 1+2)

Máquina de estados explícita para cada campanha (task), com `status.json` como fonte da verdade versionada em git.

### 23.1 Estados

| Estado | Pasta | Quem pode escrever | Significado |
|---|---|---|---|
| `draft` | `outputs/<task>_<date>/` | agentes de conteúdo | task criada; agentes produzindo |
| `in_review` | `outputs/<task>_<date>/` | nenhum agente (só humano) | preview gerado, aguarda decisão |
| `approved` | `outputs/approved/<task>_<date>/` | **ninguém** (auto-revert se editar) | aprovada; `content_hashes` SHA-256 registradas |
| `rejected` | `outputs/archive/<task>_<date>/` | agentes via rework | rejeitada com `reason` |

### 23.2 Transições legais

```
null      → draft         (orchestrator: bootstrap)
draft     → in_review     (distribution-agent: gera preview)
in_review → approved      (humano via task-promoter, exige --by)
in_review → rejected      (humano via task-promoter, recomenda --reason)
approved  → in_review     (rework manual ou auto-revert)
rejected  → in_review     (rework)
```

Tentativas fora dessa matriz → `E_INVALID_TRANSITION` (exit 1).

### 23.3 Comandos essenciais

**Criar uma task nova:**
```bash
node scripts/orchestrator.js --task minha_campanha --date 2026-06-15 --platforms instagram,youtube
```

**Gerar preview + promover para revisão:**
```bash
node scripts/generate_preview.js --task minha_campanha --date 2026-06-15
# abre outputs/minha_campanha_2026-06-15/preview.html no navegador
```

**Aprovar:**
```bash
node scripts/promote_task.js --task minha_campanha --date 2026-06-15 --to approved --by "Hugo"
```

**Rejeitar com motivo:**
```bash
node scripts/promote_task.js --task minha_campanha --date 2026-06-15 --to rejected --reason "claim fora da marca" --by "Hugo"
```

**Rework (voltar para revisão):**
```bash
node scripts/promote_task.js --task minha_campanha --date 2026-06-15 --to in_review
```

### 23.4 Auditoria e integridade

```bash
# Validar todos os status.json (schema, zona vs status, hashes em approved)
node scripts/validate_status.js

# Verificar integridade SHA-256 de outputs/approved/
node scripts/check_approved_integrity.js                # só relata
node scripts/check_approved_integrity.js --auto-revert  # move para draft se editado

# Regenerar INDEX.md (auto-disparado por approve/reject; manual se necessário)
node scripts/refresh_index.js

# Migrar tasks pré-Workflow (sem status.json)
node scripts/migrate_legacy.js --dry-run                # lista o que faria
node scripts/migrate_legacy.js                          # executa
node scripts/migrate_legacy.js --include-test           # inclui test/campanha-demo/
```

### 23.5 O que a `preview.html` mostra

Single-file HTML (sem deps; Google Fonts via CDN):
- **Header sticky** com nome da campanha, `.status-badge`, ângulo, data e plataformas.
- **Nav âncora**: Ads · Vídeo · Captions · Research · Publish · Checklist.
- **Seções 1–5**: thumbnails dos ads, player do vídeo, captions com contador de caracteres, research brief colapsável, Publish MD renderizado.
- **Seção 6 — Checklist de marca** (6 regras automáticas):
  - a) Números Taxa Zero (`0%`, `3 meses`, `R$ 300 mil`, `R$ 1,99`, `D+10`, `D+30`, `95%`)
  - b) CTAs aprovados (`Solicitar convite`, `Falar com o time`, etc.)
  - c) Paleta oficial + tipografia (sem `#fff`/`#000`/Playfair/Arial)
  - d) Concorrentes nominais (lista negra: Hotmart/Kiwify/Eduzz/Ticto/etc.)
  - e) Emoji ≤1 funcional por caption (banidos: 🔥⚡🚀💸💰😱)
  - f) Hashtags válidas (`#4Selet` obrigatória; banidas: `#Sucesso`/`#DinheiroFacil`/`#MentorDoSucesso`)

Cada regra: ✅ (ok) · ⚠️ (warn, com evidência textual) · ❌ (fail).

### 23.6 Códigos de erro

| Código | Exit | Causa típica | Como recuperar |
|---|---|---|---|
| `E_INVALID_TRANSITION` | 1 | Transição fora da matriz | Mensagem sugere rota legal |
| `E_MISSING_APPROVER` | 1 | `--by` ausente em `approved` | Adicionar `--by "<nome>"` |
| `E_UNKNOWN_STATE` | 1 | `--to <x>` com `<x>` fora do enum | Usar `draft|in_review|approved|rejected` |
| `E_STATUS_PARSE` | 2 | `status.json` corrompido (JSON inválido) | Restaurar do git: `git checkout HEAD -- outputs/.../status.json` |
| `E_DUPLICATE_LOCATION` | 2 | Task em múltiplas zonas (outputs/, approved/, archive/) | Decidir manualmente qual é canônica, apagar as outras |
| `E_REBOOTSTRAP_BLOCKED` | 1 | `orchestrator.js` chamado em task aprovada/rejeitada | Rodar `--to in_review` antes |

### 23.7 Gate de POSTING (inalterado)

O Workflow **não** mudou o gate de POSTING. Publicação real exige **TODAS** as condições:
1. Usuário referencia o Publish MD **pelo nome** (`Publish <task> <date>.md`).
2. `dry_run: false`.
3. Tokens presentes (IG Graph, YouTube OAuth).

Em modo dry-run / sem tokens → fica no Publish MD para post manual.

### 23.8 Regra CRITICAL Re-aprovação

Os 4 agentes de conteúdo (research, ad, video, copy) têm a regra CRITICAL no início do `SKILL.md`: **se o caminho começa com `outputs/approved/`, PARAR**. Para editar, rodar `promote_task --to in_review` primeiro.

Como contracheque automático: `scripts/check_approved_integrity.js` calcula SHA-256 dos arquivos no momento da aprovação (`status.content_hashes`); divergência detectada (edição manual via VSCode, script, etc.) → com `--auto-revert`, a task volta para `draft` com `event_type: "edit_revert"` no history e `previous_approval` preservado.

---

*Seções 1–22 e 24–25 serão expandidas em revisões futuras conforme o pipeline e a fila BullMQ entrarem em produção.*
