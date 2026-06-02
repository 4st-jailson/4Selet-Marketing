# Publish — test_job_payload_1 — 2026-03-31

> ⚠️ **TESTE · DRY-RUN — NÃO PUBLICAR.** Validação end-to-end do pipeline. Nenhum upload real ao Supabase, **nenhum posting de API**. URLs são placeholders. Fixture canônico versionado aqui porque `outputs/` não persiste entre turnos.

- **Task:** `test_job_payload_1` · **Data:** 2026-03-31
- **Plataformas-alvo:** Instagram, YouTube
- **Marca / Campanha:** 4Selet — Taxa Zero · **Modo:** dry-run

---

## Mídia (URLs Supabase SIMULADAS)

| Asset | Local | Public URL (placeholder) |
|---|---|---|
| Static ad (IG 1080×1080) | `ads/instagram_ad.png` | `https://PLACEHOLDER.supabase.co/.../test_job_payload_1/instagram_ad.png` |
| Video ad (9:16 1080×1920) | `video/ad.mp4` | `https://PLACEHOLDER.supabase.co/.../test_job_payload_1/ad.mp4` |

## Instagram

**Caption:**

```
0% por 3 meses. R$ 1,99 por transacao. PIX em D+10.

A 4Selet abriu um corredor de migracao para produtores estabelecidos que querem
trocar de plataforma sem perder mes. 0% de taxa pela plataforma nos primeiros
3 meses ou ate R$ 300 mil em vendas.

Solicitar convite no link da bio. →
```

**Hashtags:** `#4Selet #TaxaZero #PlataformaDePagamentos #ProdutorDigital #DigitalSerio` · **CTA:** Solicitar convite

## YouTube

**Title:** `0% de Taxa por 3 Meses: A Mecanica Completa da Taxa Zero 4Selet`
**Description (1ª dobra):** A mecanica completa da Taxa Zero: 0% por 3 meses ou ate R$ 300 mil, R$ 1,99 por transacao, PIX D+10, cartao D+30. Acesso por convite. `[TESTE / DRY-RUN]`
**Tags:** `4selet, taxa zero, plataforma de pagamentos, infoproduto, multi-adquirencia, produtor digital`

---

## Posting Advice (agendamento sugerido)

| Dia | Plataforma | Formato |
|---|---|---|
| Terça (manhã) | Instagram Feed | Static ad 1080×1080 |
| Quarta | YouTube | Vídeo / Short |
| Quinta | Instagram Reels | Vídeo 9:16 |

## Execução de Publicação

- **Gate:** posting real só ocorreria com referência a este MD pelo nome **e** dry-run desligado.
- **Status:** `dry-run` — **bloqueado por design**. Instagram Graph API e YouTube Data API **não executados**.

## Checklist do dry-run

- [x] Research → `research_results.json`
- [x] Ad Creative Designer → `ads/{layout.json, ad.html, styles.css, instagram_ad.png}`
- [x] Video Ad Specialist → `video/{scenes.json, ad.mp4}` (Remotion reaproveitado)
- [x] Copywriter → `copy/{instagram_caption.txt, youtube_metadata.json, copy.json}`
- [x] Distribution → `media_urls.json` + este Publish MD
- [x] Nenhum posting real · nenhuma chave externa · tudo rotulado TESTE
