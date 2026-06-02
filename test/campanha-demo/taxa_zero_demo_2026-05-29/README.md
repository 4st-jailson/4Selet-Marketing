# Campanha-Demo — Taxa Zero 4Selet

> **DEMO/DRY-RUN** · 2026-05-29 · Marca: **4Selet** · Campanha: **Taxa Zero** · Modo simulado onde faltar chave (research/Supabase); PNGs e vídeo são **renders reais**. **Nada é publicado** (gate do distribution-agent).

## Ângulo selecionado (consistente em todos os estágios)

> **Migração sem perder margem: 0% por 3 meses ou até R$ 300 mil em vendas.**

Ancorado em **um dos 4 conceitos de vídeo** do `product_campaign.md`: **"Migração Sem Trauma"**. Aparece no:
- **Research:** `selected_campaign_angle` em `research_results.json`
- **Ad:** eyebrow "MIGRAÇÃO SEM TRAUMA" no square, "Vai perder vendas migrando? / Não." no story, headline "Migrar sem perder mês." na thumb
- **Vídeo:** hook "Vai perder vendas migrando?" → "Não. O time conduz." (scenes 1–2)
- **Copy:** abertura "Vai perder vendas migrando? Não." em todas as 4 plataformas

## Índice dos arquivos

```
taxa_zero_demo_2026-05-29/
├── README.md                                 ← este arquivo
├── job_payload.json                          ← input do Orchestrator (dry-run, 4 plataformas)
├── pipeline_plan.json                        ← plano gerado pelo orchestrate.js
├── logs/                                     ← log por job (5 agentes)
│
├── research_results.json                     ← Marketing Research (CONTRATO machine-readable, _simulated:true)
├── research_brief.md                         ← Research (Markdown + Mermaid)
├── interactive_report.html                   ← Research (dashboard Chart.js, paleta oficial)
│
├── ads/
│   ├── square/    layout.json + ad.html + styles.css + instagram_ad_square.png   (1080×1080)
│   ├── feed/      layout.json + ad.html + styles.css + instagram_ad_feed.png     (1080×1350)
│   ├── story/     layout.json + ad.html + styles.css + instagram_ad_story.png    (1080×1920)
│   └── thumb/     layout.json + ad.html + styles.css + youtube_thumb.png         (1280×720)
│
├── video/
│   ├── scenes.json                           ← Video Ad Specialist (schema composition/props)
│   ├── campanha.mp4                          ← Render Remotion (composition CampanhaDemo em src/, 1080×1920, 15s)
│   └── preview_frame.png                     ← Still de verificação (cena Offer)
│
├── copy/
│   ├── copy.json                             ← Copywriter (estruturado, 4 plataformas, MESMO ângulo)
│   ├── instagram_caption.txt
│   ├── threads_post.txt
│   ├── linkedin_post.txt                     ← Editorial premium (~1.300 chars)
│   └── youtube_metadata.json                 ← title + description + tags
│
├── media_urls.json                           ← Distribution (URLs Supabase PLACEHOLDER, _simulated:true)
└── Publish taxa_zero_demo 2026-05-29.md      ← Distribution (advisory + agendamento + GATE bloqueado)
```

## Como cada agente foi rodado

| Estágio | Mecanismo real |
|---|---|
| Orchestrator | `node skills/orchestrator/scripts/orchestrate.js --file <payload>` (modo sequencial — sem Redis) |
| Research | `scripts/research.js` (sem `TAVILY_API_KEY` → avisa simulado) + agente sintetiza dos knowledge files |
| Ad Creative | layout.json → ad.html/styles.css → `scripts/render_ad.js` (Playwright, HTML→PNG) |
| Video | nova composition `src/CampanhaDemo.tsx` (adaptada ao ângulo) registrada em `src/Root.tsx` + `npx remotion render src/index.ts CampanhaDemo video/campanha.mp4` |
| Copy | agente escreve direto (sem script) — 4 plataformas distintas, 1 ângulo |
| Distribution | `scripts/upload_supabase.js` (sem `SUPABASE_URL/KEY` → URLs placeholder + `_simulated:true`) + Publish MD |

## Checklist de marca confirmado

- [x] **Números Taxa Zero corretos** em todo asset: `0%` por **3 meses OU até R$ 300 mil** em vendas · `R$ 1,99` por transação · PIX `D+10` · cartão `D+30` · `95%` de aprovação · acesso **por convite** · migração assistida em **5 etapas**
- [x] **CTAs aprovados apenas:** *Solicitar convite* (IG, YouTube), *Falar com o time* (LinkedIn)
- [x] **Nenhum concorrente nominal** (Greenn/Hubla/Kiwify/Hotmart/Eduzz/Ticto/Cakto/Monetizze/Perfect Pay); mercado em abstrato apenas
- [x] **Paleta oficial 4Selet:** Selet Darker `#07212B` · Navy `#003554` · Blue `#006494` · Sky `#5499B5` · Mist `#AFBCC9` · Cloud `#D9DCD6` (sem branco/preto puro, sem neon)
- [x] **Tipografia:** Inter (headline/body/CTA) + JetBrains Mono (eyebrow/dados); **sem Playfair/DM Sans/Arial/Roboto**
- [x] **Emoji:** máx 1 funcional (`→` no IG); sem hype (🔥⚡🚀💸💰😱 banidos)
- [x] **Hashtags IG (3–5):** `#4Selet` (obrigatória) + `#TaxaZero` + produto + nicho; nenhuma banida (#Sucesso/#DinheiroFacil/#MentorDoSucesso)
- [x] **Sem urgência fake** (sem "última chance"/"!!!"); sem "grátis" (a 4Selet é por convite)
- [x] **Sem depoimento/personagem fictício** (vídeo usa prova-âncora real "95%", não testemunho de pessoa inventada)
- [x] **Coerência inter-agentes:** mesmo `selected_campaign_angle` em research → ad → vídeo → copy → Publish MD

## Estado simulado vs. real

| Item | Estado |
|---|---|
| Tavily (research real) | Simulado — sem `TAVILY_API_KEY` |
| Supabase (hosting) | Simulado — URLs placeholder, nada hospedado |
| Posting IG/YouTube | **Gated** — não publicado (dry-run) |
| Posts Threads/LinkedIn | Manual (sem API estável) |
| Render do ad (Playwright HTML→PNG) | **Real** — Chromium headless |
| Render do vídeo (Remotion) | **Real** — `CampanhaDemo` em `src/`, 1080×1920, 15s |

## Notas

- O wrapper de vídeo `src/CampanhaDemo.tsx` foi criado especialmente para esta campanha-demo (ângulo "Migração Sem Trauma") e registrado em `src/Root.tsx` ao lado do `AdVideo` original — sem tocar nas scenes do AdVideo.
- Os PNGs dos 3 IG ads foram renomeados para `instagram_ad_{square,feed,story}.png` para satisfazer o requisito de **filenames únicos por task** do distribution-agent.
- Tudo aqui é **demo/teste**. Para sair do dry-run: configurar tokens (IG Graph, YouTube OAuth) + Supabase + Tavily, e referenciar o `Publish taxa_zero_demo 2026-05-29.md` pelo nome.
