# Status do Projeto — Sistema de Marketing com IA (4Selet)

*Gerado em 2026-05-26 · Marca: 4Selet · Pipeline de 5 agentes + Orchestrator*

> **Resumo:** O sistema de skills está **funcionalmente completo** — as 6 skills (5 agentes + orchestrator) existem, com scripts empacotados e validados nos caminhos sem-chave. O **render real funciona** para ad estático (Playwright) e vídeo (Remotion). Pesquisa, hosting de mídia, fila de jobs e publicação rodam em **modo simulado** porque as chaves/serviços externos (Tavily, Supabase, Redis, OAuth) ainda não foram configurados. Falta a camada de execução enfileirada real (BullMQ + Redis) e versionamento (git).

---

## 1. Ambiente / Stack

| Item | Status |
|---|---|
| Node.js | ✅ Instalado (v24.16.0) + npm 11.13.0 |
| Remotion + React | ✅ Instalado (remotion 4.0.469, React 19.2.6, @remotion/cli, @remotion/google-fonts) |
| Playwright + Chromium | ✅ Instalado (HTML→PNG funcional) |
| `package.json` / `tsconfig.json` / `remotion.config.ts` | ✅ Presentes |
| **git** | ❌ **Não instalado** (sem versionamento) |
| Tavily (`@tavily/core`) | ❌ Não instalado / sem `TAVILY_API_KEY` |
| Supabase (`@supabase/supabase-js`) | ❌ Não instalado / sem `SUPABASE_URL`+`KEY` |
| BullMQ + Redis | ❌ Não instalado / sem `REDIS_URL` |
| OAuth YouTube / token Instagram | ❌ Não configurado |

---

## 2. Concluído

### 2.1 Skills (6/6 criadas) — `skills/`

| Skill | Arquivos | Engine / script | Estado real |
|---|---|---|---|
| **marketing-research-agent** | `SKILL.md` + `scripts/research.js` | Tavily (lazy require) | Simulado sem `TAVILY_API_KEY` |
| **ad-creative-designer** | `SKILL.md` + `scripts/render_ad.js` + `examples/` (fixture) | Playwright HTML→PNG | ✅ **Funcional** |
| **video-ad-specialist** | `SKILL.md` | Remotion (composition/props) | ✅ **Funcional** (render validado) |
| **copywriter-agent** | `SKILL.md` | Texto (sem script) | ✅ Funcional |
| **distribution-agent** | `SKILL.md` + `scripts/upload_supabase.js` | Supabase (lazy require) | Simulado; posting **gated** |
| **orchestrator** | `SKILL.md` + `scripts/orchestrate.js` | BullMQ (alvo) / sequencial | Sequencial; valida payload + plano |

Todas seguem o guia de skills (frontmatter com trigger phrases, steps, examples, troubleshooting, quality checklist) e estão **alinhadas à marca 4Selet** (paleta oficial, Inter/JetBrains Mono, campanha Taxa Zero, CTAs aprovados, sem citar concorrentes).

### 2.2 Pipeline de vídeo (Remotion) — `src/`

- Composition **`AdVideo`** (1080×1920, 15s) com 5 scenes (Hook, Problem, Solution, Benefits, CTA), SVGs inline animados, fontes via `@remotion/google-fonts`, paleta oficial.
- Render validado: `outputs/remotion_test_video/video.mp4` + 5 stills de verificação.
- *Nota:* o wrapper `AdVideoTest` (selo TESTE) foi revertido num rollback; hoje só existe a composition `AdVideo`. Re-criável se necessário.

### 2.3 Dry-run end-to-end — `test_job_payload_1`

Pipeline completo simulado (sem chaves), rotulado TESTE, em dois lugares:
- **Live:** `outputs/test_job_payload_1/` (research, ad html/css/png, vídeo scenes+mp4, copy ×3, media_urls, Publish MD).
- **Fixture durável:** `skills/ad-creative-designer/examples/` (cópia canônica + `README.md`).

### 2.4 Scripts empacotados (todos validados no caminho sem-chave)

| Script | Função | Smoke test |
|---|---|---|
| `ad-creative-designer/scripts/render_ad.js` | HTML→PNG (Playwright), espera fontes+imagens | ✅ render + img |
| `marketing-research-agent/scripts/research.js` | 5 buscas Tavily ou aviso simulado | ✅ sem-chave |
| `distribution-agent/scripts/upload_supabase.js` | Upload Supabase ou URLs placeholder | ✅ simulado |
| `orchestrator/scripts/orchestrate.js` | Valida payload + plano de dependências/skips + logs | ✅ plano + bloqueio (tolera BOM) |

### 2.5 Outros

- `CLAUDE.md` alinhado ao schema de vídeo canônico (`composition`/`props`) + árvore de `video/`.
- `public/logo-4selet-light.png` para uso no Remotion/render.
- Memória do projeto registrada (schema de vídeo, persistência, padrão de construção de skills).

---

## 3. Pendente / Level-up

| # | Pendência | Impacto | Como resolver |
|---|---|---|---|
| 1 | **git não instalado** | Sem versionamento; persistência não garantida | Instalar git + `git init` + commit |
| 2 | **`pipeline/` (BullMQ) não existe** | Orquestração roda sequencial/manual, não enfileirada | `npm i bullmq` + `REDIS_URL` + criar `pipeline/orchestrator.js` e `worker.js` + scripts `pipeline:run` |
| 3 | **`TAVILY_API_KEY` ausente** | Research é simulado (não busca web real) | `npm i @tavily/core` + setar a chave |
| 4 | **Supabase não configurado** | Mídia não é hospedada (URLs placeholder) | `npm i @supabase/supabase-js` + `SUPABASE_URL`/`KEY` |
| 5 | **OAuth YouTube / token Instagram** | Publicação real impossível (fica no Publish MD) | Configurar `YOUTUBE_REFRESH_TOKEN` + IG Graph token |
| 6 | **Caminhos reais não testados** | Tavily, Supabase upload e posting real sem validação | Validar após configurar chaves |
| 7 | **Skills não empacotadas p/ distribuição** | São arquivos no repo, não `.zip` instaláveis | Zipar cada pasta de skill se for distribuir |

> **Segurança (por design):** o pipeline **nunca publica sozinho**. Posting real exige referência explícita ao Publish MD + fora de dry-run + tokens presentes (gate no distribution-agent).

---

## 4. Estrutura atual (resumo)

```
Claude Equipe de Marketing - 6 Agentes/
├── CLAUDE.md, STATUS_PROJETO.md, *.md (docs)
├── package.json, tsconfig.json, remotion.config.ts
├── public/logo-4selet-light.png
├── knowledge/ (brand_identity, product_campaign, platform_guidelines)
├── assets/ (logos, brand-identity kit, reference-videos)
├── src/ (Remotion: Root, AdVideo, scenes/*, theme, components)
├── skills/
│   ├── marketing-research-agent/ (SKILL.md + scripts/research.js)
│   ├── ad-creative-designer/ (SKILL.md + scripts/render_ad.js + examples/)
│   ├── video-ad-specialist/ (SKILL.md)
│   ├── copywriter-agent/ (SKILL.md)
│   ├── distribution-agent/ (SKILL.md + scripts/upload_supabase.js)
│   └── orchestrator/ (SKILL.md + scripts/orchestrate.js)
└── outputs/
    ├── remotion_test_video/ (video.mp4 + frames)
    └── test_job_payload_1/ (dry-run completo)
```

---

## 5. Como rodar (estado atual)

```bash
# Render do vídeo (Remotion):
npm run render        # -> outputs/remotion_test_video/video.mp4

# Render de ad estático (Playwright):
node skills/ad-creative-designer/scripts/render_ad.js <html> <out.png> 1080 1080

# Research (simulado sem chave):
node skills/marketing-research-agent/scripts/research.js --task <t> --date <d> --topic "<topico>" --out outputs/<t>_<d>

# Hosting de mídia (simulado sem Supabase):
node skills/distribution-agent/scripts/upload_supabase.js --task <t> --date <d> --out outputs/<t>_<d>

# Validar payload + plano do pipeline:
node skills/orchestrator/scripts/orchestrate.js --file <payload.json>
```

---

## 6. Persistência (nota importante)

Houve **um rollback pontual** de um turno (revertendo `outputs/` em texto, `scripts/` da raiz, `AdVideoTest.tsx`); arquivos binários renderizados sobreviveram, e desde então `outputs/` e `skills/` **persistiram**. Como **não há git**, a persistência **não é garantida**. Mitigação adotada: cópias canônicas/scripts vivem sob `skills/` (que se mostrou estável). **Fix definitivo: instalar git e versionar.**

---

## 7. Próximos passos recomendados (prioridade)

1. **Instalar git + versionar** o projeto (resolve persistência de vez).
2. **Configurar chaves** para sair do modo simulado: Tavily → Supabase → OAuth.
3. **Construir `pipeline/` (BullMQ + Redis)** para execução enfileirada real a partir do `job_payload.json`.
4. **Validar os caminhos reais** (busca Tavily, upload Supabase) e, por fim, publicação via gate.
