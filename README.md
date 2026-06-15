# 4Selet-Marketing

Sistema de automação de conteúdo para redes sociais com IA, construído para a marca **4Selet**. Cinco agentes especializados (pesquisa, ad estático, vídeo, copy, distribuição) coordenados por um **Orchestrator**, com governança de aprovação (SHA-256 + gate duplo de publicação) sobre os artefatos gerados.

## Caminho principal — Painel web

O **Painel web** em `interface/` é a forma principal de operar o sistema (gerência de campanhas, geração de conteúdo com IA, render e workflow de aprovação visual).

```bash
cd interface
npm install        # primeira vez
npm start          # → http://localhost:4500
```

Configure a **chave Anthropic** em *Configurações* no painel (gravada em `interface/.env`). Sem ela, a geração roda em **modo simulado**. Em produção local o painel roda como serviço via **PM2** (`pm2 restart painel-4selet`).

## Caminho secundário — Extensão Claude Code (VSCode)

Chat direto com os agentes, pipeline executável e scripts. As **7 skills** ficam em `skills/` (5 agentes + orchestrator + task-promoter).

```bash
npm run pipeline:run                  # pipeline com payload padrão (sequencial; BullMQ se REDIS_URL)
node scripts/orchestrator.js --task <nome> --date AAAA-MM-DD --platforms instagram,youtube
node scripts/generate_preview.js --task <nome> --date AAAA-MM-DD
node scripts/promote_task.js --task <nome> --date AAAA-MM-DD --to approved --by "<aprovador>"
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `interface/` | Painel web (Express + SPA) — caminho principal |
| `skills/` | 7 skills (agentes + orchestrator + task-promoter) |
| `pipeline/` | Orchestrator + worker + agents (sequencial / BullMQ) |
| `scripts/` | Workflow de Aprovação (preview, promote, gates, integridade) |
| `src/` | Projeto Remotion (compositions de vídeo) |
| `knowledge/` | Fonte de verdade da marca 4Selet (brand, campanha, plataformas) |
| `assets/` | Logos, kit de identidade visual e vídeos de referência |
| `outputs/` | Artefatos gerados; `approved/` e `archive/` versionados em git |
| `docs/` | Material de aula (`docs/aula/`) e histórico (`docs/historico/`) |

## Documentação

Ordem de leitura: **`STATUS_PROJETO.md`** (estado atual) · **`GUIA_DE_USO.md`** (passo a passo; também em `GUIA_DE_USO.html`) · **`SPEC_WORKFLOW_APROVACAO.md`** (contrato v1.1) · **`CLAUDE.md`** (arquitetura) · `skills/<nome>/SKILL.md` (comportamento por agente).

> **Marca:** 4Selet — a marca real, não uma demo. Toda comunicação gerada deve seguir os knowledge files em `knowledge/`.
