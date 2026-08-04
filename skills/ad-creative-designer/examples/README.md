# Fixture canônico — dry-run `test_job_payload_1`

Exemplo completo (1 por estágio) da execução end-to-end do pipeline de marketing 4Selet, em modo **TESTE / DRY-RUN** (nenhum posting real, URLs placeholder).

## Por que isto vive aqui (e não só em `outputs/`)

`outputs/` **não persiste de forma garantida entre turnos** neste ambiente (artefatos de texto já foram varridos uma vez; binários renderizados sobreviveram). É comportamento de sandbox/checkpoint, não de hook (`.claude/settings.json` sem regra de limpeza). Por isso o fixture canônico é salvo sob `skills/` — diretório que **empiricamente persistiu** entre turnos.

> Mitigação durável: versionar com git (já instalado, v2.54.0). Enquanto o repositório não estiver inicializado/commitado, esta pasta é a cópia canônica.

## Conteúdo

```
examples/
├── job_payload.json                         ← input do Orchestrator (dry-run)
├── research_results.json                    ← Marketing Research Agent (simulado; formato LEGADO do caminho CLI)
├── ads/                                     ← CONTRATO ATUAL
│   ├── concept.json                         ← Ad Creative Designer (blueprint, schema plano)
│   ├── ad.html                              ← arte em HTML com CSS INLINE (html,body com dimensoes · .card · span.cta)
│   ├── ad.png                               ← render Playwright 1080x1080 @2x
│   └── ad.editable.json · ad.bg.png         ← sidecars de edicao (gerados pelo render_ad.js)
├── video/
│   ├── scenes.json                          ← saida DERIVADA (props do Remotion). O contrato do autor e video/concept.json (schema plano)
│   └── ad.mp4                               ← render Remotion legado (selo TESTE); o contrato atual gera video/video.mp4 via BrandStory
├── copy/
│   ├── instagram_caption.txt
│   ├── youtube_metadata.json                ← LEGADO: nenhum tipo do painel/pipeline gera YouTube hoje
│   └── copy.json                            ← Copywriter Agent (estruturado; caminho manual — o painel grava 1 arquivo por peca)
├── media_urls.json                          ← LEGADO (Supabase); a publicacao real usa link temporario /m/:token
├── Publish test_job_payload_1 2026-03-31.md ← LEGADO (advisory); nenhum script gera Publish MD hoje
└── _legacy/ads/                             ← contrato ANTIGO do ad (layout.json · styles.css · instagram_ad.png) — nao copiar
```

> **Atenção (auditoria 2026-07-30):** os itens marcados como LEGADO existem só como histórico do caminho CLI. O que o painel e o pipeline leem hoje está em `interface/lib/config.js` (`CONTENT_TYPES`): `ads/concept.json`, `video/concept.json`, `copy/instagram_carousel.json`, `copy/instagram_caption.txt`. Nenhum fixture aqui pode trazer a frase-tag *"Para quem sabe que é Selet."* como assinatura — regra dura em vigor.

## Como regenerar os renders

```bash
# Ad (HTML -> PNG, Playwright) — scale 2 e o padrao das artes finais:
node scripts/render_ad.js skills/ad-creative-designer/examples/ads/ad.html skills/ad-creative-designer/examples/ads/ad.png 1080 1080 2

# Video: a composition de produção é BrandStory. O caminho real é o painel
# (interface/lib/render.js, kind "video"), que lê video/concept.json, deriva os
# props ({concept, cta, scenes:[{type,text,visual}]}) e gera video/video.mp4.
#
# Direto via CLI Remotion, --props espera o OBJETO de props (não o envelope
# {composition, props} do scenes.json deste fixture — esse é a saída canônica do
# Video Ad Specialist). Extraia o .props antes de passar:
#   node -e "const j=require('./skills/ad-creative-designer/examples/video/scenes.json');require('fs').writeFileSync('props.json',JSON.stringify(j.props))"
#   npx remotion render src/index.ts BrandStory <saida>/video.mp4 --props=props.json
```

Tudo rotulado **TESTE** no conteúdo. Não publicar.
