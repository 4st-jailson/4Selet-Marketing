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

O painel também oferece:

- **Login por usuário** — cada pessoa entra com conta própria. Novos usuários são criados pelo admin, que envia um **link de convite** (uso único) para a pessoa definir a própria senha. Há dois **perfis**: `admin` (usa o painel e gerencia usuários) e `membro` (só usa o painel).
- **Mais de um provedor de IA** — além do Claude (Anthropic), o painel também fala com o **ChatGPT (OpenAI)**. Você escolhe o provedor padrão em *Configurações* e pode trocar por geração; cada provedor tem sua própria chave.
- **Pesquisa de mercado ao vivo (opcional)** — com uma chave **Tavily** configurada, dá para ligar a pesquisa de mercado **por peça** na hora de gerar, enriquecendo o conteúdo com dados atuais. Sem a chave (ou desligada), a geração segue normalmente.
- **Editor visual da arte + prévia no celular** — edite a arte gerada direto no painel e veja um **mockup de smartphone** mostrando como a peça apareceria para o público.
- **Publicação e agendamento no Instagram (feed)** — publique ou agende peças **aprovadas** no Instagram, sempre atrás do **gate de aprovação** (só publica peça na zona `approved` com os hashes de conteúdo batendo). Enquanto o Instagram não está conectado, roda em **modo simulado**.

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
