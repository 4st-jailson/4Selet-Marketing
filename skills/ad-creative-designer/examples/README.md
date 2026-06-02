# Fixture canônico — dry-run `test_job_payload_1`

Exemplo completo (1 por estágio) da execução end-to-end do pipeline de marketing 4Selet, em modo **TESTE / DRY-RUN** (nenhum posting real, URLs placeholder).

## Por que isto vive aqui (e não só em `outputs/`)

`outputs/` **não persiste entre turnos** neste ambiente (artefatos de texto foram varridos; só binários renderizados sobreviveram). Diagnóstico: **não é git** (git não instalado, sem `.git`) nem **hook** (`.claude/settings.json` vazio) — é comportamento de sandbox/checkpoint. Como não há git para `add -f`, o fixture é salvo sob `skills/` — diretório que **empiricamente persistiu** entre turnos.

> Mitigação ideal e durável: inicializar controle de versão (requer instalar git). Enquanto isso, esta pasta é a cópia canônica.

## Conteúdo

```
examples/
├── job_payload.json                         ← input do Orchestrator (dry-run)
├── research_results.json                    ← Marketing Research Agent (simulado)
├── ads/
│   ├── layout.json                          ← Ad Creative Designer (design spec)
│   ├── ad.html · styles.css                 ← layout em HTML/CSS
│   └── instagram_ad.png                     ← render Playwright 1080x1080
├── video/
│   ├── scenes.json                          ← Video Ad Specialist (composition/props)
│   └── ad.mp4                               ← render Remotion (AdVideoTest, com selo TESTE)
├── copy/
│   ├── instagram_caption.txt
│   ├── youtube_metadata.json
│   └── copy.json                            ← Copywriter Agent (estruturado)
├── media_urls.json                          ← Distribution (URLs Supabase placeholder)
└── Publish test_job_payload_1 2026-03-31.md ← Distribution (advisory + gate)
```

## Como regenerar os renders

```bash
# Ad (HTML -> PNG, Playwright):
node scripts/render_ad.js skills/ad-creative-designer/examples/ads/ad.html skills/ad-creative-designer/examples/ads/instagram_ad.png 1080 1080

# Video (Remotion): re-adicionar o wrapper AdVideoTest e
npx remotion render src/index.ts AdVideoTest <saida>/ad.mp4
```

Tudo rotulado **TESTE** no conteúdo. Não publicar.
