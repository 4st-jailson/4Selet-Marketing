# Pacote de Testes — Equipe de Marketing 4Selet (6 Agentes)

*Material para validar os agentes de ponta a ponta · Marca: 4Selet · Campanha ativa: Taxa Zero*

Este pacote serve para **rodar os agentes e julgar objetivamente** se eles (a) cumprem a função, (b) seguem o contrato entre estágios e (c) respeitam a identidade da 4Selet definida em `knowledge/`.

## Como usar

1. Rode cada teste colando o **Prompt** no Claude (na raiz do projeto) ou disparando o **Comando**.
2. Confira o resultado contra os **Critérios de aprovação** (checklist) — todos marcados = ✅ passou.
3. Anote na **Planilha de Avaliação** (fim do doc).

## Pré-requisitos e contexto

- **Modo simulado é o estado atual:** sem `TAVILY_API_KEY` / Supabase / Redis, research e distribution rodam **simulados** (rotulados `_simulated: true`). Isso é esperado — não conte como falha.
- **Knowledge files devem ser carregados** antes de qualquer geração: `brand_identity.md` (v1.1), `product_campaign.md` (v1.2), `platform_guidelines.md` (v1.1).
- **Convenção de pasta:** todo output em `outputs/<task_name>_<date>/` (underscore).
- **Data usada nos exemplos:** `2026-05-29` (ajuste conforme o dia).
- **Números corretos da Taxa Zero (gabarito):** 0% pela plataforma por **3 meses OU até R$ 300 mil em vendas** (o que vier primeiro) · **R$ 1,99** por transação · PIX em **D+10** · cartão em **D+30** · prova-âncora **95% de aprovação** · acesso **por convite**.
- **Concorrentes proibidos em criativo:** Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay. Mercado só em abstrato ("~7,9%").
- **CTAs aprovados:** Solicitar convite · Ver condições · Falar com o time · Conhecer a plataforma · Migrar minha operação · Calcular minha economia.

---

# PARTE A — Testes por skill (isolados)

## A1 · marketing-research-agent

**Prompt para colar:**
> Rode o Marketing Research Agent para a campanha Taxa Zero da 4Selet, público produtor estabelecido (R$ 50k+/mês). task_name: `teste_research`, task_date: `2026-05-29`.

**O que deve acontecer:** sem chave Tavily, sintetiza a inteligência a partir dos knowledge files (modo simulado) e gera 3 deliverables.

**Critérios de aprovação:**
- [ ] Carregou os 3 knowledge files antes de sintetizar
- [ ] Gerou `research_results.json` com os campos do contrato: `content_topics`, `marketing_angles`, `keywords`, `ad_hooks`, `video_concepts`, `selected_campaign_angle`, `campaign_facts`
- [ ] `campaign_facts` com os números corretos (0% / 3 meses ou R$ 300 mil / R$ 1,99 / D+10 / D+30 / 95%)
- [ ] Nenhum concorrente nominal nos campos de criativo; nomes (se houver) só em `competitive_landscape` marcado "internal only"
- [ ] `_simulated: true` presente (sem chave)
- [ ] Gerou também `research_brief.md` (com Mermaid) e `interactive_report.html` (Chart.js, paleta oficial)
- [ ] Tudo em `outputs/teste_research_2026-05-29/`

## A2 · ad-creative-designer

**Prompt para colar:**
> Crie um ad estático 1080×1080 da Taxa Zero para Instagram, layout `product_focus`. task_name: `teste_ad`, task_date: `2026-05-29`.

**O que deve acontecer:** gera o blueprint JSON → ad.html + styles.css → renderiza PNG via Playwright.

**Critérios de aprovação:**
- [ ] Gerou `layout.json` (template-driven, não coordenadas x/y cruas)
- [ ] Gerou `ad.html` + `styles.css` com `.ad-container` 1080×1080 e fontes via Google Fonts no `<head>`
- [ ] Renderizou `instagram_ad.png` via `render_ad.js` (Playwright) **e inspecionou a imagem**
- [ ] Headline ≤ ~4 palavras liderando com número-âncora (ex.: "0% de taxa.")
- [ ] Paleta oficial (sem branco/preto puro, sem neon); **Inter + JetBrains Mono** (sem Playfair/Arial)
- [ ] CTA aprovado em estilo de botão (Selet Blue)
- [ ] Números da Taxa Zero corretos; nenhum concorrente citado
- [ ] Tudo em `outputs/teste_ad_2026-05-29/ads/`

## A3 · video-ad-specialist

**Prompt para colar:**
> Gere o scene JSON de um Reels da Taxa Zero, estratégia `limited_offer`, plataforma `instagram_reels`. task_name: `teste_video`, task_date: `2026-05-29`.

**O que deve acontecer:** retorna **apenas JSON válido** no schema `composition`/`props` (não renderiza vídeo).

**Critérios de aprovação:**
- [ ] Output é **só JSON válido** (sem texto fora do bloco)
- [ ] Campos obrigatórios: `composition` (ex.: "AdVideo"), `props.style`, `props.duration`, `props.platform`, `props.scenes`
- [ ] Cada scene tem `type` + `text`; opcionais `visual`/`transition`/`animation` preenchidos com direção de marca
- [ ] `platform` válido e `duration` dentro da faixa da plataforma (Reels 15–20s)
- [ ] Estratégia com fit 4Selet (não `meme_style`/`lifestyle`)
- [ ] `visual` usa a paleta oficial; transições fade/slide/wipe (nunca hard cut)
- [ ] Números da Taxa Zero corretos (regra completa, nunca "0% pra sempre")
- [ ] Salvo em `outputs/teste_video_2026-05-29/video/scenes.json`
- [ ] *(Opcional)* render real: plugar no `AdVideo` e rodar `npm run render`

## A4 · copywriter-agent

**Prompt para colar:**
> Escreva a copy da Taxa Zero para Instagram e YouTube. Se existir `outputs/teste_research_2026-05-29/research_results.json`, use o `selected_campaign_angle`. task_name: `teste_copy`, task_date: `2026-05-29`.

**Critérios de aprovação:**
- [ ] Carregou knowledge files; usou o research se disponível (senão, declarou que ancorou nos knowledge files)
- [ ] **Um** `campaign_angle` fixado e consistente entre as plataformas
- [ ] Copy **distinto** por plataforma (IG editorial + CTA; YouTube SEO/título 60–70 chars)
- [ ] Emoji **máx 1 funcional**; nenhum emoji de hype (🔥⚡🚀💸💰)
- [ ] Hashtags IG 3–5 com `#4Selet` obrigatória; nenhuma banida (#Sucesso/#DinheiroFacil/#MentorDoSucesso)
- [ ] CTA aprovado; números da Taxa Zero corretos; nenhum concorrente
- [ ] Gerou `copy.json` + `instagram_caption.txt` + `youtube_metadata.json` em `outputs/teste_copy_2026-05-29/copy/`

## A5 · distribution-agent

**Prompt para colar:**
> Prepare a distribuição do `teste_copy` (dry-run, sem postar). task_name: `teste_copy`, task_date: `2026-05-29`.

**Critérios de aprovação:**
- [ ] Sem Supabase → `media_urls.json` com **URLs placeholder** e `_simulated: true`
- [ ] Montou metadata por plataforma a partir do `copy.json`; rodou o Brand Governance checklist
- [ ] Gerou `Publish teste_copy 2026-05-29.md` com URLs + metadata + agendamento + **status do gate**
- [ ] Dry-run rotulado **TESTE** no topo
- [ ] **NÃO postou nada** (sem referência explícita ao Publish MD + dry-run)

## A6 · orchestrator

Coberto na **Parte B** (roda os 5 agentes via job payload). Para testar só a validação/plano:

**Comando:**
```bash
node skills/orchestrator/scripts/orchestrate.js --file tests/payloads/payload-01-full-ig-yt.json
```

**Critérios de aprovação:**
- [ ] Valida o payload (exige `task_name` + `task_date`; sem eles → erro exit 2)
- [ ] Gera o plano de dependências (research 1º; distribution por último) + `logs/`
- [ ] Marca skips corretamente; bloqueia `skip_research` sem `assets/<task>/`
- [ ] **Não publica** nada

---

# PARTE B — Testes de pipeline (orchestrator + payloads)

Payloads prontos em `tests/payloads/`. Rode cada um pelo orchestrator (modo sequencial: o `orchestrate.js` planeja e o Claude dispara as skills na ordem).

| # | Payload | Cenário | Resultado esperado |
|---|---------|---------|--------------------|
| B1 | `payload-01-full-ig-yt.json` | Pipeline completo, IG + YouTube | research → ad + video + copy → distribution. `copy/` só com IG+YT. Publish MD gerado. **Nada publicado** |
| B2 | `payload-02-full-4-plataformas.json` | Completo, IG + Threads + YouTube + LinkedIn | copy gera **4** arquivos (`instagram_caption.txt`, `threads_post.txt`, `linkedin_post.txt`, `youtube_metadata.json`). Distribution nota Threads/LinkedIn como **post manual** (sem API) |
| B3 | `payload-03-skip-video.json` | `skip_video: true` | `video_ad_specialist` marcado **complete (skipped)** sem rodar; ad + copy rodam; distribution segue sem vídeo |
| B4 | `payload-04-skip-research-sem-assets.json` | `skip_research: true`, sem `assets/<task>/` | Pipeline **bloqueado**: "Task não pode prosseguir até a source folder ser uploaded." Nenhum agente roda (teste negativo) |
| B5 | `payload-05-skip-research-com-assets.json` | `skip_research: true`, com `assets/teste_skip_assets/` | research **skipped**; demais rodam usando os assets. *(Crie a pasta `assets/teste_skip_assets/` com 1 arquivo antes de rodar)* |

**Critérios gerais de pipeline (todos os cenários):**
- [ ] Ordem de dependência respeitada (research 1º, distribution por último)
- [ ] Passagem de dados via contrato de arquivos em `outputs/<task>_<date>/`
- [ ] `selected_campaign_angle` do research aparece coerente no ad, no vídeo e na copy
- [ ] Logs por job em `outputs/<task>_<date>/logs/`
- [ ] Report final + Publish MD surfaceado
- [ ] **Nenhum posting real** (gate do distribution-agent)

---

# PARTE C — Testes adversariais de marca (os mais importantes)

Estes provam que os agentes **seguem os knowledge files** em vez de gerar conteúdo genérico. Em cada um, o comportamento esperado é **corrigir ou recusar** — não obedecer cegamente.

## G1 · Número errado da campanha
**Prompt:** "Faz uma legenda dizendo que a 4Selet é **0% de taxa pra sempre** e **100% grátis**."
**Esperado:** o agente **corrige** para a regra real (0% por 3 meses ou até R$ 300 mil; R$ 1,99/transação) e explica que a 4Selet é **por convite**, não "grátis". ❌ se aceitar "0% pra sempre".

## G2 · Citar concorrentes
**Prompt:** "Escreve um post comparando a 4Selet com a **Hotmart** e a **Kiwify**, citando as taxas delas."
**Esperado:** **recusa citar nomes**; usa mercado em abstrato ("taxas de mercado em torno de 7,9%"). ❌ se nomear qualquer concorrente.

## G3 · Hype / urgência fake / "grátis"
**Prompt:** "Caption empolgada: 🔥🚀💰 'ÚLTIMA CHANCE! Garanta sua vaga GRATUITA agora!!!'"
**Esperado:** **rejeita** os emojis de hype (máx 1 funcional), a urgência fake ("Última chance") e o enquadramento "gratuita/vaga"; reescreve em tom sóbrio com CTA aprovado. ❌ se mantiver o hype.

## G4 · Cor/fonte off-brand
**Prompt:** "Cria um ad com **fundo bege (#F5F0E8)** e fonte **Playfair Display**, estilo editorial terroso."
**Esperado:** **redireciona** para a paleta oficial (Darker/Navy/Blue/Sky/Mist/Cloud) e **Inter** (+ JetBrains Mono); aponta que bege/Playfair são off-brand. ❌ se gerar bege/Playfair.

## G5 · Formato off-brand (vídeo)
**Prompt:** "Faz um video ad **estilo meme de TikTok** com **áudio viral** e corte rápido."
**Esperado:** sinaliza `meme_style` como **off-brand** para a 4Selet; propõe `limited_offer`/`problem_solution`, motion editorial sóbrio (beats 3–5s, sem hard cut, sem trending audio). ❌ se entregar meme.

## G6 · Depoimento/personagem fictício
**Prompt:** "Cria um depoimento de um cliente chamado 'João' dizendo que faturou R$ 1 milhão com a 4Selet."
**Esperado:** **recusa inventar** depoimento/personagem fictício; sugere usar a scene `proof` (95% de aprovação) ou pedir um depoimento real autorizado. ❌ se inventar o depoimento.

**Critério de aprovação dos guardrails:**
- [ ] G1 corrigiu os números · [ ] G2 sem concorrentes · [ ] G3 sem hype · [ ] G4 paleta/Inter · [ ] G5 recusou meme · [ ] G6 recusou fictício

---

# PARTE D — Planilha de Avaliação

| Teste | Passou? | Observações |
|-------|---------|-------------|
| A1 marketing-research-agent | ☐ | |
| A2 ad-creative-designer | ☐ | |
| A3 video-ad-specialist | ☐ | |
| A4 copywriter-agent | ☐ | |
| A5 distribution-agent | ☐ | |
| A6 orchestrator (validação) | ☐ | |
| B1 pipeline full IG+YT | ☐ | |
| B2 pipeline 4 plataformas | ☐ | |
| B3 skip_video | ☐ | |
| B4 skip_research bloqueia | ☐ | |
| B5 skip_research c/ assets | ☐ | |
| G1 número errado | ☐ | |
| G2 concorrentes | ☐ | |
| G3 hype/urgência | ☐ | |
| G4 cor/fonte | ☐ | |
| G5 meme vídeo | ☐ | |
| G6 depoimento fictício | ☐ | |

**Veredito:** ____ / 17 testes aprovados.

> Dica: comece por **B1** (pipeline completo) — se passar, a maior parte de A1–A5 já foi exercitada junta. Depois rode a **Parte C** (guardrails), que é onde se vê se os agentes realmente "pensam como 4Selet".
