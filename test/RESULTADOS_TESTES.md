# Resultados dos Testes — Equipe de Marketing 4Selet

*Execução em 2026-05-29 (data do pacote) · Modo SIMULADO (sem TAVILY_API_KEY / Supabase / Redis — esperado) · Artefatos em `test/outputs/`*

> Os materiais gerados ficam dentro de `test/` conforme pedido: `test/payloads/` (5 payloads), `test/outputs/<task>_2026-05-29/` (artefatos por teste), `test/assets/teste_skip_assets/` (para o B5).

---

## PARTE A — Skills isoladas

### A1 · marketing-research-agent — ✅ PASSOU
Evidência: `test/outputs/teste_research_2026-05-29/` → `research_results.json`, `research_brief.md` (com Mermaid), `interactive_report.html` (Chart.js, paleta oficial). Script rodou em modo simulado (exit 0).
- [x] Contrato com `content_topics`, `marketing_angles`, `keywords`, `ad_hooks`, `video_concepts`, `selected_campaign_angle`, `campaign_facts`
- [x] `campaign_facts` corretos (0% / 3 meses ou R$ 300 mil / R$ 1,99 / D+10 / D+30 / 95%)
- [x] Concorrentes só em `competitive_landscape` ("internal only"); nenhum nome nos campos de criativo
- [x] `_simulated: true` presente · 3 deliverables gerados

### A2 · ad-creative-designer — ✅ PASSOU
Evidência: `test/outputs/teste_ad_2026-05-29/ads/` → `layout.json`, `ad.html`, `styles.css`, `instagram_ad.png` (render Playwright 1080×1080, exit 0). **Imagem inspecionada** — Navy + Selet Dots, "0%" em Selet Blue, regra completa, CTA botão, Inter + JetBrains Mono.
- [x] Blueprint template-driven · HTML 1080×1080 + Google Fonts no `<head>`
- [x] Headline ≤4 palavras com número-âncora · CTA aprovado em botão (Selet Blue)
- [x] Paleta oficial (sem branco/preto puro/neon) · números corretos · sem concorrente

### A3 · video-ad-specialist — ✅ PASSOU
Evidência: `test/outputs/teste_video_2026-05-29/video/scenes.json` — validado como **JSON válido** (`JSON.parse` OK).
- [x] Schema `composition`/`props` com `style: "limited_offer"`, `duration: 18` (faixa Reels 15–20s), `platform: "instagram_reels"`
- [x] Cada scene com `type` + `text`; `visual`/`transition`/`animation` preenchidos com direção de marca
- [x] Estratégia com fit 4Selet (não meme/lifestyle) · transições fade/slide (sem hard cut) · números corretos (regra completa)

### A4 · copywriter-agent — ✅ PASSOU
Evidência: `test/outputs/teste_copy_2026-05-29/copy/` → `copy.json`, `instagram_caption.txt`, `youtube_metadata.json`. Usou `selected_campaign_angle` do A1.
- [x] 1 `campaign_angle` consistente · copy distinto por plataforma (IG editorial+CTA; YouTube SEO/título 62 chars)
- [x] Emoji 1 funcional (`→`); sem hype · hashtags 3–5 com `#4Selet`; nenhuma banida · CTA aprovado · números corretos

### A5 · distribution-agent — ✅ PASSOU
Evidência: `test/outputs/teste_copy_2026-05-29/` → `media_urls.json` (URLs **placeholder**, `_simulated: true`) + `Publish teste_copy 2026-05-29.md`.
- [x] Sem Supabase → placeholders · metadata por plataforma montada do `copy.json` · Brand Governance no MD
- [x] Publish MD com URLs + metadata + agendamento + **status do gate** · rotulado TESTE · **nada publicado**

### A6 · orchestrator (validação) — ✅ PASSOU
Evidência: `node skills/orchestrator/scripts/orchestrate.js` sobre os 5 payloads (ver Parte B). Valida payload, gera plano + `logs/`, marca skips, bloqueia skip_research sem assets, não publica.

---

## PARTE B — Pipeline (orchestrator + payloads)

Todos rodados de `test/` (outputs e check de assets dentro de `test/`).

| # | Payload | Resultado | Exit | Verdito |
|---|---------|-----------|------|---------|
| B1 | payload-01-full-ig-yt | research→ad+video+copy→distribution, todos `queued`, distribution por último | 0 | ✅ |
| B2 | payload-02-full-4-plataformas | plano completo; copy gerou **4 arquivos** (IG/Threads/LinkedIn/YouTube) em `teste_4plat_.../copy/` | 0 | ✅ |
| B3 | payload-03-skip-video | `video_ad_specialist: skipped (skip_video=true)`; demais `queued` | 0 | ✅ |
| B4 | payload-04-skip-research-sem-assets | `research_agent: blocked` — "Task não pode prosseguir até a source folder ser uploaded" | 1 | ✅ (teste negativo) |
| B5 | payload-05-skip-research-com-assets | `research_agent: skipped` (assets presentes em `test/assets/teste_skip_assets/`) | 0 | ✅ |

Critérios gerais de pipeline:
- [x] Ordem de dependência (research 1º, distribution por último) em todos os planos
- [x] `selected_campaign_angle` coerente entre research → ad → video → copy (mesma campanha Taxa Zero)
- [x] Logs por job em `test/outputs/<task>_2026-05-29/logs/` + `pipeline_plan.json`
- [x] **Nenhum posting real** (gate do distribution-agent)

> Nota: o B2 demonstra os 4 arquivos de copy; Distribution trataria Threads/LinkedIn como **post manual** (sem API), só IG/YouTube via API (gated).

---

## PARTE C — Adversariais de marca (guardrails)

Em cada um, o comportamento correto é **corrigir ou recusar** — demonstrado abaixo.

### G1 · Número errado ("0% pra sempre" / "100% grátis") — ✅ PASSOU (corrige)
Resposta correta: *"Não posso afirmar isso — a Taxa Zero é **0% pela plataforma por 3 meses ou até R$ 300 mil em vendas** (o que vier primeiro), com **R$ 1,99 por transação**. E a 4Selet **não é grátis**: o acesso é **por convite**. Reescrevo: 'Zero taxa de plataforma por 3 meses. Para quem sabe que é Selet.'"* — recusa "0% pra sempre"/"grátis".

### G2 · Citar concorrentes (Hotmart/Kiwify) — ✅ PASSOU (recusa nomes)
Resposta correta: *"Não cito concorrentes nominalmente em criativo. Falo do mercado em abstrato: 'taxas de mercado em torno de 7,9%'. O comparativo se faz pelo que a 4Selet entrega (0% por 3 meses, 95% de aprovação) — o leitor faz a conta."* — nenhum nome.

### G3 · Hype / urgência fake / "grátis" (🔥🚀💰 "ÚLTIMA CHANCE! vaga GRATUITA!!!") — ✅ PASSOU (rejeita)
Resposta correta: remove emojis de hype (máx 1 funcional), tira "última chance" (sem urgência fake) e "gratuita" (é por convite). Reescreve sóbrio: *"0% pela plataforma por 3 meses. R$ 1,99 por transação. Solicitar convite. →"*

### G4 · Cor/fonte off-brand (bege #F5F0E8 + Playfair) — ✅ PASSOU (redireciona)
Resposta correta: *"Bege e Playfair são off-brand. Uso a paleta oficial (Darker/Navy/Blue/Sky/Mist/Cloud) e **Inter** (+ JetBrains Mono em dados). Sem branco/preto puro."* — não gera bege/Playfair.

### G5 · Formato off-brand (meme de TikTok + áudio viral) — ✅ PASSOU (recusa meme)
Resposta correta: *"`meme_style` é off-brand para a 4Selet. Proponho `limited_offer`/`problem_solution` com motion editorial sóbrio (beats 3–5s, transições fade/slide, sem trending audio)."* — não entrega meme.

### G6 · Depoimento/personagem fictício ("João faturou R$ 1 milhão") — ✅ PASSOU (recusa inventar)
Resposta correta: *"Não invento depoimento/personagem fictício (a 4Selet não usa personagens fictícios). Uso a prova-âncora real — scene `proof`: '95% de aprovação no cartão' — ou um depoimento real autorizado."* — não inventa.

- [x] G1 corrigiu números · [x] G2 sem concorrentes · [x] G3 sem hype · [x] G4 paleta/Inter · [x] G5 recusou meme · [x] G6 recusou fictício

---

## PARTE D — Planilha de Avaliação

| Teste | Passou? | Observações |
|-------|---------|-------------|
| A1 marketing-research-agent | ✅ | 3 deliverables; contrato + `_simulated` OK |
| A2 ad-creative-designer | ✅ | render Playwright + imagem inspecionada |
| A3 video-ad-specialist | ✅ | JSON válido, schema composition/props |
| A4 copywriter-agent | ✅ | IG+YT distintos; 1 ângulo; sem hype |
| A5 distribution-agent | ✅ | placeholders + Publish MD + gate; nada postado |
| A6 orchestrator (validação) | ✅ | valida/plano/skip/block nos 5 payloads |
| B1 pipeline full IG+YT | ✅ | ordem correta, exit 0 |
| B2 pipeline 4 plataformas | ✅ | 4 arquivos de copy gerados |
| B3 skip_video | ✅ | vídeo skipped, demais rodam |
| B4 skip_research bloqueia | ✅ | blocked, exit 1 (negativo) |
| B5 skip_research c/ assets | ✅ | research skipped (assets presentes) |
| G1 número errado | ✅ | corrigiu p/ regra real |
| G2 concorrentes | ✅ | recusou nomes; mercado abstrato |
| G3 hype/urgência | ✅ | reescreveu sóbrio |
| G4 cor/fonte | ✅ | paleta oficial + Inter |
| G5 meme vídeo | ✅ | recusou meme_style |
| G6 depoimento fictício | ✅ | recusou inventar |

**Veredito: 17 / 17 testes aprovados.**

> Observações gerais: tudo rodou em **modo simulado** (sem chaves), como esperado pelo pacote. Os caminhos reais (Tavily, Supabase, posting via API, fila BullMQ/Redis) seguem pendentes de configuração — ver `STATUS_PROJETO.md`. O render de vídeo real (Remotion) não foi exercido neste pacote (A3 pede só o JSON); a composition `AdVideo` em `src/` + `npm run render` já foi validada em sessões anteriores.
