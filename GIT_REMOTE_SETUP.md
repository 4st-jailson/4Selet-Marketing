# Git Remote Setup — Backup Remoto do Workflow

*Última atualização: 2026-06-02 · Prerequisito de produção (R5 do reporte v1.1)*

> Sem remoto + push automatizado, `.git/` mora apenas no disco da VPS. Falha de disco apaga `history[]`, `content_hashes`, decisões de approver. Durabilidade local ≠ durabilidade real.

## O que já está pronto

- ✅ `git` v2.54.0 instalado
- ✅ Repositório local inicializado (`bde9f60`, `9bc30be`, futuros)
- ✅ `.gitignore` configurado (versiona `outputs/approved/` + `outputs/archive/`)
- ✅ **Hook `post-commit` instalado** em `.git/hooks/post-commit` — faz `git push origin main` em background, fail-silent

## O que falta (5 minutos)

### 1. Criar repo privado

No GitHub (ou GitLab, Bitbucket), criar repositório **PRIVADO**:
- Nome sugerido: `4selet-marketing-workflow`
- Visibilidade: **Private**
- Não inicializar com README, .gitignore ou license (vamos fazer push do existente).

### 2. Configurar remote

```bash
cd "C:\Users\Administrator\Documents\Agentes_Marketing_4Selet\Claude Equipe de Marketing - 6 Agentes"
git remote add origin git@github.com:<org>/4selet-marketing-workflow.git
# ou via HTTPS com token:
# git remote add origin https://github.com/<org>/4selet-marketing-workflow.git
git push -u origin main
```

> ⚠️ Verificar autenticação. Para HTTPS: criar Personal Access Token (escopo `repo`). Para SSH: gerar par de chaves (`ssh-keygen`) e adicionar `~/.ssh/id_ed25519.pub` em Settings → SSH Keys.

### 3. Verificar push automatizado

```bash
echo "test backup" >> STATUS_PROJETO.md
git add STATUS_PROJETO.md
git commit -m "test: verificar post-commit hook"
# o hook dispara push em background — verificar logs/ ou GitHub UI em 5s
```

### 4. (Opcional, recomendado) Cron de fallback de 5 em 5 min

No Linux/cron (VPS):
```cron
*/5 * * * * cd /caminho/Agentes_Marketing_4Selet && git push origin main 2>/dev/null
```

No Windows (Task Scheduler):
- Trigger: a cada 5 minutos
- Action: `cmd /c "cd /d C:\path\to\repo && git push origin main"`

## Verificações pós-setup

| Verificação | Como | Esperado |
|---|---|---|
| Remote configurado | `git remote -v` | duas linhas (fetch, push) apontando ao repo privado |
| Hook executável (Linux) | `ls -l .git/hooks/post-commit` | `-rwxr-xr-x` |
| Push manual funciona | `git push origin main` | "Everything up-to-date" ou commits enviados |
| Push automático após commit | criar commit dummy, esperar 5s, ver UI | commit aparece no remoto |
| Backup completo de aprovações | navegar `outputs/approved/` no GitHub UI | INDEX.md + tasks aprovadas todos versionados |

## Caveats

- **Hook só roda localmente** — se outra pessoa clonar e commitar, o hook não está no repo (vive em `.git/hooks/` que não é versionado). Cron é mais robusto.
- **Falha de rede** — push silencia em fail; commit local segue válido. Próximo `git push` envia tudo. Cron de fallback cobre isso.
- **Dados sensíveis no repo** — knowledge files contêm contato comercial (Flávio del Lima · WhatsApp). Por isso o repo **DEVE ser privado**. Para abrir ao público, antes mascarar contatos.
- **Tamanho do repo** — assets de marca (`assets/`) e vídeos de referência (`reference-videos/*.mp4`) somam ~50MB. Aceitável para GitHub free. Se crescer, considerar Git LFS para mp4s.

## Conexão com R5

O backup remoto **não** substitui o gate duplo do `distribution-agent` Step 5a — eles protegem riscos diferentes:

| Risco | Protegido por |
|---|---|
| Edição maliciosa pós-aprovação | `check_approval_gate.js` (E_HASH_MISMATCH) |
| Pasta órfã com estado inconsistente | `check_approval_gate.js` (E_INVALID_STATE) |
| Falha de disco / perda de dados | **Git remote (este doc)** |
| Concorrência multi-operador | Pendente (lock proper-lockfile, fora desta task) |

Os quatro são necessários para uso real. Esta task entrega 1, 2 e prepara 3.
