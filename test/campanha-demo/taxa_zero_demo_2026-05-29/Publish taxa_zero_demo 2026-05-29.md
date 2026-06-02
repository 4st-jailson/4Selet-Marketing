# Publish — taxa_zero_demo — 2026-05-29

> ⚠️ **DEMO · DRY-RUN — NÃO PUBLICAR.** Nenhum upload real ao Supabase, nenhum posting de API. URLs são placeholders. Modo simulado onde faltar chave (research / Supabase). PNGs e vídeo são **renders reais** (Playwright e Remotion), apenas não hospedados.

- **Task:** `taxa_zero_demo` · **Data:** 2026-05-29 · **Marca/Campanha:** 4Selet — Taxa Zero
- **Ângulo selecionado:** *Migração sem perder margem — 0% por 3 meses ou até R$ 300 mil em vendas.*
- **Âncora de vídeo (4 conceitos):** **Migração Sem Trauma**
- **Plataformas-alvo:** Instagram (feed + story + Reels), Threads/X, YouTube, LinkedIn

---

## Mídia (URLs Supabase SIMULADAS)

| Asset | Local | Public URL (placeholder) |
|---|---|---|
| IG Square 1080×1080 | `ads/square/instagram_ad_square.png` | `https://PLACEHOLDER.supabase.co/.../taxa_zero_demo_2026-05-29/instagram_ad_square.png` |
| IG Feed 1080×1350 | `ads/feed/instagram_ad_feed.png` | `https://PLACEHOLDER.supabase.co/.../instagram_ad_feed.png` |
| IG Story 1080×1920 | `ads/story/instagram_ad_story.png` | `https://PLACEHOLDER.supabase.co/.../instagram_ad_story.png` |
| YouTube Thumb 1280×720 | `ads/thumb/youtube_thumb.png` | `https://PLACEHOLDER.supabase.co/.../youtube_thumb.png` |
| Vídeo Reels 1080×1920 (15s) | `video/campanha.mp4` | `https://PLACEHOLDER.supabase.co/.../campanha.mp4` |

---

## Instagram

**Feed (post):**
```
Vai perder vendas migrando? Não.

A 4Selet conduz a migração da sua operação em 5 etapas e abre 3 meses de 0% pela
plataforma — ou até R$ 300 mil em vendas, o que vier primeiro. R$ 1,99 por
transação. PIX em D+10. 95% de aprovação no cartão.

Solicitar convite no link da bio. →
```
**Hashtags:** `#4Selet #TaxaZero #PlataformaDePagamentos #ProdutorDigital #DigitalSerio`
**CTA:** Solicitar convite
**Story:** texto on-image (asset `instagram_ad_story.png`). Reels: `campanha.mp4` + caption acima.

## Threads / X

```
"Vou perder vendas migrando" é a objeção número 1. Faz sentido — você já construiu uma operação.

A 4Selet conduz a migração em 5 etapas e te dá 3 meses de 0% pela plataforma pra
você medir as 4 variáveis (taxa, prazo, aprovação, suporte) sem custo de transição.

R$ 1,99 por transação. 95% de aprovação no cartão. O convite tá aberto.
```
**CTA:** sem CTA explícito (encerramento seco). **API:** sem API estável — **post manual**.

## LinkedIn

Post editorial completo em `copy/linkedin_post.txt` (~1.300 chars). Tese: os 3 custos invisíveis de uma migração malfeita; como a 4Selet resolve antes; Taxa Zero como corredor financeiro; âncora técnica em 95% de aprovação.
**Hashtags:** `#4Selet #TaxaZero #PagamentosDigitais #Infoproduto #NegocioDigital`
**CTA:** Falar com o time · **API:** sem API estável — **post manual**.

## YouTube

**Title:** `Migração Sem Trauma: 0% por 3 Meses na 4Selet (Taxa Zero)` (54 chars)
**Description (1ª dobra):** Vai perder vendas migrando? Não. A 4Selet conduz a migração em 5 etapas e abre 3 meses de 0% pela plataforma (ou até R$ 300 mil em vendas). R$ 1,99/transação, PIX D+10, cartão D+30, 95% de aprovação.
**Tags:** `4selet, taxa zero, plataforma de pagamentos, infoproduto, multi-adquirencia, produtor digital, migracao de plataforma`
**Thumbnail:** `ads/thumb/youtube_thumb.png`
**Vídeo:** `video/campanha.mp4` (Reels 9:16; para YouTube Short serve direto; para vídeo padrão exigiria reenquadre 16:9)
**CTA:** Solicitar convite

---

## Agendamento sugerido (do `platform_guidelines.md`)

| Dia | Plataforma | Asset |
|---|---|---|
| Segunda | LinkedIn | `linkedin_post.txt` |
| Terça (manhã) | Instagram Feed | `ads/feed/instagram_ad_feed.png` + caption |
| Quarta | YouTube | `campanha.mp4` + thumb + metadata |
| Quinta | Instagram Reels + Threads | `campanha.mp4` (Reels) · `threads_post.txt` |
| Sexta | Instagram Story | `ads/story/instagram_ad_story.png` |

---

## Brand Governance — checklist final

- ✅ Cores: paleta oficial (Darker/Navy/Blue/Sky/Mist/Cloud); sem branco/preto puro/neon
- ✅ Tipografia: Inter + JetBrains Mono (sem Playfair/Arial)
- ✅ CTAs: Solicitar convite / Falar com o time (aprovados)
- ✅ Números Taxa Zero corretos: 0% por 3 meses OU R$ 300 mil · R$ 1,99 · PIX D+10 · cartão D+30 · 95% aprovação · por convite
- ✅ Nenhum concorrente nominal; mercado em abstrato
- ✅ Emoji máx 1 funcional (`→`); sem hype 🔥🚀💰
- ✅ Coerência: `selected_campaign_angle` ("Migração sem perder margem") aparece no ad, no vídeo e na copy

---

## Execução de Publicação — GATE

- **Status:** `dry-run` → **bloqueado por design.** Nenhum posting executado.
- Posting real exigiria **TODAS** as condições:
  1. Usuário referencia este Publish MD **pelo nome** (`Publish taxa_zero_demo 2026-05-29.md`)
  2. `dry_run: false`
  3. Tokens: IG Graph (`IG_ACCESS_TOKEN` + business id), YouTube OAuth (`YOUTUBE_REFRESH_TOKEN`)
- Threads/X e LinkedIn: **sem API estável** → texto no MD para post manual.

> Em modo dry-run, nada é publicado. Para destravar, configurar tokens e iniciar com referência explícita a este arquivo.
