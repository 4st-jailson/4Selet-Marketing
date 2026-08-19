# **Platform Guidelines: 4Selet**

*Versão 1.3 · Agosto/2026*

> **Propósito:** Garantir que todo conteúdo seja **corretamente formatado e estilizado por plataforma** antes de publicar. Referenciar **antes de finalizar** qualquer post, vídeo ou caption. Cobre specs, ajustes de tom e regras de formatação para cada plataforma ativa. Sempre usar **junto** ao `brand_identity.md` e `product_campaign.md`.

> **Atenção — este arquivo entra literalmente no prompt de produção.** O painel injeta este documento no system prompt de cada geração (`interface/lib/knowledge.js` → `interface/lib/prompts.js`). Spec errada aqui vira instrução errada para a IA.

> **O que mudou na v1.3 (Agosto/2026):** o tipo **Story Instagram** (`instagram_story`) passou a existir neste documento — ele já era gerado e renderizado pelo painel, mas nenhum knowledge file o descrevia, então um agente que lesse só estes documentos nunca proporia o formato. Entram: a linha do Story na tabela de specs, a **seção 2.7** com a zona segura real (250 px em cima, 250 px embaixo, 96 px nas laterais, faixa do sticker) e a matriz de formatos separando Story de Reel.
>
> **O que mudou na v1.2 (Julho/2026):** specs do Instagram corrigidas (feed é **4:5**, o quadrado 1:1 é a peça de anúncio); nova seção **2.6 — 4Selet na Mídia**; matriz de formatos completa (4:5 · 1:1 · 9:16 · 16:9) substituindo "feed/vertical dimensions"; margem segura corrigida para a faixa real dos templates (88–104px); CTA passou a ser **condicional** (padrão: sem CTA); mix de hashtags agora acompanha o **pilar de conteúdo**; coluna "onde se produz" na visão geral.

> **O que veio da v1.1:** ajuste editorial na regra de tom do Threads/X (auto-depreciação explicitamente vetada).

---

## **1. Visão Geral das Plataformas**

| Plataforma | Tipo de Conteúdo | Tom Primário | Hashtags | Onde se produz hoje |
| ----- | ----- | ----- | ----- | ----- |
| **Instagram** | Feed 4:5, Carrossel, **Story**, Imagem/Anúncio 1:1, **4Selet na Mídia**, Reels | Editorial, sóbrio, premium | Obrigatórias (3–5) · Story não tem legenda | **Painel** (6 tipos) · publicação real de feed, carrossel **e Story**; Reel sai pronto para postar no aplicativo |
| **Threads / X** | Short text posts | Provocativo controlado, com dado | Opcional (0–1) | **Painel** (`threads_post`) · publicação manual |
| **LinkedIn** | Posts editoriais, vídeos | Editorial premium, autoridade | Opcional (3–5) | **Painel** (`linkedin_post`) · publicação manual |
| **YouTube** | Long & short-form video | Didático, técnico-acessível | Via tags/description | **Fora do painel** — só pela skill `copywriter-agent` (`youtube_metadata.json`); sem geração de arte e **sem publicação** |

> **Pensar B2B:** o público da 4Selet é **decisor estabelecido**. LinkedIn é especialmente relevante e deve aparecer no mix de distribuição. Instagram é volumoso mas tem espaço para conteúdo sério se feito com cuidado editorial.

> **Onde cada coisa é operável:** o painel (`https://mkt.4st.co`) gera 8 tipos de conteúdo e publica de verdade no Instagram, via Graph API, em **dois destinos**: o **feed** (imagem única e carrossel) e o **Story** (cada arte da sequência vira um Story, na ordem). Quem escolhe o destino é a janela de publicar — a peça de Story já nasce apontando para o Story, e o carrossel para o feed. **Reels o painel não publica sozinho**: a arte sai pronta, você posta pelo aplicativo e depois marca a peça como publicada. LinkedIn e Threads/X saem como texto para publicação manual. YouTube permanece como referência editorial — a Seção 4 continua válida como guia de redação, mas nada do YouTube é gerado ou publicado pelo sistema.

---

## **2. Instagram**

### **Specs**

| Formato (tipo no painel) | Dimensões | Aspect Ratio | Arquivo gerado |
| ----- | ----- | ----- | ----- |
| **Feed (post principal)** — `instagram_caption` | 1080 × 1350 px | **4:5** | `ads/feed.png` |
| **Carrossel** — `instagram_carousel` | 1080 × 1350 px | 4:5 | `slides/slide_N.png` |
| **Imagem / Anúncio (quadrado)** — `ad_creative` | 1080 × 1080 px | 1:1 | `ads/ad.png` |
| **4Selet na Mídia** — `media_mention` | 4 formatos (ver 2.6) | 4:5 · 1:1 · 9:16 · 16:9 | `ads/feed.png`, `square.png`, `story.png`, `media_16x9.png` |
| **Story Instagram** — `instagram_story` | 1080 × 1920 px | 9:16 | `story/story_N.png` (ver 2.7) |
| **Reel / vídeo** — `video_idea` | 1080 × 1920 px | 9:16 | `video/video.mp4` |

> **4:5 é o formato-padrão publicável no feed.** O quadrado 1:1 é o criativo estático de anúncio (tipo "Imagem / Anúncio"), não o post de feed. Essa distinção vale para toda a composição: headline, hierarquia e quebra de linha são pensadas para retrato, não para quadrado.

### **Design Rules**

* **Backgrounds:** Alternar entre **Selet Cloud** (`#D9DCD6`) e **Selet Navy** (`#003554`) — slides claros vs escuros
* **Headlines:** **Inter Bold/Black** (weight 700–800), letter-spacing -0.5 a -1.5px — nunca outras fontes
* **Body text:** **Inter Regular/Medium** (weight 400–500) — nunca centralizado, sempre à esquerda
* **Labels e tags:** **Inter Medium ALL CAPS**, letter-spacing +0.4px, cor **Selet Mist** (`#AFBCC9`) em slides escuros ou **Selet Blue** (`#006494`) em slides claros
* **Accent:** **Selet Blue** (`#006494`) para blocos de destaque, números-âncora e CTAs
* **Selet Dots:** padrão de pontos azuis 6–10% opacity em slides escuros para profundidade
* **Margem segura:** **88–104px** (referência ~96px em 1080×1080). É o que os templates de produção usam — editorial `96px 92px`, bold `104px 96px`, split `0 104px`, photo `80px 88px`. Em 1080×1350 o respiro vertical no topo/base é maior
* **Nunca:** preto puro (`#000000`), gradientes neon, drop shadows, emojis em hero. **Branco puro (`#FFFFFF`) é permitido como texto** sobre fundo Navy/Darker (é o que os templates fazem em headline e CTA) e proibido como cor de fundo/card — ali use Selet Cloud

### **Caption Guidelines**

* **Tamanho:** Curto — 1 a 3 frases antes do bloco de hashtags
* **Estrutura:** Hook factual com número/dado → Valor/Benefício específico → CTA claro → Quebra de linha → Hashtags
* **Tom:** **Sóbrio e direto, com números reais.** Como gestor experiente comentando uma decisão estratégica.
* **Emojis:** Máximo 1, **funcional** (`→` para CTA). Nunca em hero/headlines.
* **CTA: opcional — o padrão é sem CTA.** Inclua quando a peça tem intenção de conversão (pilar Taxa Zero, prova de plataforma) ou quando o brief define a chamada; nesse caso vem antes das hashtags, em tom de **convite/condução**, nunca de súplica ou urgência fake. Em peça de relacionamento/autoridade (educacional, motivacional, 4Selet na Mídia) encerre com um fechamento suave e deixe o campo `cta` vazio.

**Exemplo de estrutura de caption (Taxa Zero):**

```
0% por 3 meses. R$ 1,99 por transação. PIX em D+10.

A 4Selet abriu um corredor de migração para produtores estabelecidos que querem trocar de plataforma sem perder mês.

Solicitar convite no link da bio. →

#4Selet #TaxaZero #PlataformaDePagamentos #ProdutorDigital #DigitalSerio
```

### **Regras de Hashtags**

* Use **3–5 hashtags** por post
* Coloque hashtags **no fim da caption**, separadas por uma quebra de linha
* **Obrigatória: só `#4Selet`.** O resto do mix acompanha o **pilar de conteúdo** da peça
* `#TaxaZero` é **condicional** — só quando a peça for do pilar *Taxa Zero* ou falar da oferta ativa. Não force em peça educacional, de curiosidade de mercado, motivacional ou de mídia
* `#NaMidia` nas peças *4Selet na Mídia*; nos demais pilares complete com produto/categoria + nicho
* **Existem 6 pilares de conteúdo e o feed não é monotemático** — ver `brand_identity.md` → "Pilares de Conteúdo"
* Lista de hashtags aprovadas: ver `brand_identity.md` → seção "Hashtags"
* **Banidas:** `#Sucesso`, `#DinheiroFacil`, `#MentorDoSucesso`, hashtags em CAPS no meio da caption

### **Regras de Carrossel**

* **Slide 1 (capa):** Background Selet Navy ou Darker; headline em Inter Black; hook factual ou pergunta de decisão
* **Slides de conteúdo:** Alternar Navy (escuro) e Cloud (claro) — máximo 5 slides preferencialmente, máximo absoluto 7
* **Slides escuros:** Texto em branco ou Cloud, apoio em Mist. (O tema escuro do carrossel usa branco no texto principal — ver `THEME_DARK` em `interface/lib/render.js`. Branco é proibido como FUNDO, não como texto.)
* **Bullets/destaques em slides escuros:** Blocos de background Selet Blue (`#006494`) com texto Cloud
* **Slide de CTA:** Background Selet Navy; texto Inter Black grande em Cloud; CTA claro
* **Selet Dots como background pattern:** 8% opacity em slides escuros
* **Sem gradients neon, drop shadows ou efeitos de glow**

### **Content Notes**

* Screenshots da plataforma sempre com **dados mascarados** (e-mail `c••••@email.com`, código `pur_XXX•••••XXX`)
* Para Stories: manter texto na **zona segura central** — as medidas exatas estão em 2.7
* O **símbolo "4"** (do logo) pode ser usado como elemento decorativo sutil em opacidade reduzida (10–15%)
* Mockups de laptop mostrando a plataforma em uso real são bem-vindos — sempre com UI atualizada e dados fictícios

### **2.6 — 4Selet na Mídia (`media_mention`)**

Tipo de peça nativo do painel desde julho/2026: a aparição da 4Selet na imprensa, com o **print da matéria** montado num dispositivo ou cena fotográfica. Prova social de terceiro — não é anúncio.

**Formatos gerados (uma peça produz vários de uma vez):**

| Formato | Dimensões | Arquivo | Onde entra |
| ----- | ----- | ----- | ----- |
| **4:5** | 1080 × 1350 | `ads/feed.png` | Feed do Instagram — **o único publicável no feed** |
| **1:1** | 1080 × 1080 | `ads/square.png` | Grade, anúncio, avatar de campanha |
| **9:16** | 1080 × 1920 | `ads/story.png` | Story / Reel cover |
| **16:9** | 1920 × 1080 | `ads/media_16x9.png` | **Site e apresentação — não publicável no feed** |

Padrão marcado no painel: **4:5 + 16:9**.

**Modelos de arte (10):** *Tablet* (`hand_tablet`), *Foto real (mãos)*, *Foto real (mesa)*, *Foto real (mãos + mesa)*, *Celular*, *Navegador*, *Citação*, *Split*, *Selo*, *Camadas*.

* Print **vertical** (tela em pé) → Tablet, Celular, Camadas
* Print **horizontal** (página de site) → Navegador, Split
* Sem print utilizável ou matéria só em texto → Citação, Selo
* Os modelos foto-reais são a exceção autorizada à regra de fotografia — a foto é cena de contexto, tratada na marca

**Composição em paisagem (16:9):** o layout muda de empilhado para lado a lado — dispositivo de um lado, texto e marca do outro. Mantenha a mesma margem segura (88–104px), a hierarquia (veículo → título → marca) e o logo no canto oposto ao dispositivo. Não é o mesmo layout do 4:5 esticado.

**Regras de conteúdo:** tom sóbrio de reconhecimento externo, **proibido inventar trecho, citação ou número da matéria**, veículo nomeado com exatidão, CTA suave ou nenhum. Hashtags: `#4Selet` + `#NaMidia` + 1 a 3 complementares, sem `#TaxaZero`. Detalhe completo em `brand_identity.md` → "4Selet na Mídia".

### **2.7 — Story Instagram (`instagram_story`)**

Tipo de peça nativo do painel: uma **sequência de 3 a 7 cartões verticais 1080 × 1920**, gerados em `story/story_N.png`. **Story não é feed encolhido nem carrossel na vertical** — cada cartão é visto por cerca de 5 segundos.

**Story não tem legenda.** Todo o texto mora na arte; não existe arquivo de caption para esse tipo.

**Zona segura (o aplicativo cobre parte da arte):**

| Faixa | Medida | O que o app coloca ali |
| ----- | ----- | ----- |
| Topo | 250 px | foto e nome do perfil, horário, o "x" |
| Rodapé | 250 px | caixa "Enviar mensagem" e ícones |
| Laterais | 96 px | margem de leitura |
| Faixa do sticker | 888 × 320 px, a 1580 px do topo | espaço reservado para a enquete/pergunta que a pessoa cola no app |

Uma pílula de chamada só continua clicável até cerca de **340 px** acima da base. Essas medidas são as mesmas que o renderizador aplica (`STORY_SAFE` em `interface/lib/config.js`) — o desenho já reserva as faixas, mas **não escreva texto pensando em ocupar a tela toda**.

**Regras de composição:**

* **Uma ideia por cartão.** Frase curta e forte; nada de parágrafo.
* Intercale **1 cartão claro** (`theme: "light"`) no meio dos escuros — é o recurso de respiro da marca.
* Layouts disponíveis: `cover`, `text`, `number`, `quote`, `poll`, `photo`, `link`. O layout nasce do dado: um número vira `number`; frase de terceiro vira `quote`; pergunta ao público vira `poll` (a arte **reserva** o espaço e a enquete é colada no app).
* O **último cartão chama a ação** (`link`), com um CTA aprovado.
* Sequência pode ser marcada com um **destaque fixo do perfil**: `quem_somos`, `nosso_dna`, `diferenciais` ou nenhum. Isso é rótulo operacional para quem publica — **não existe endpoint de Destaques na Graph API**.

**Publicação:** manual. A Graph API não publica Stories; a arte sai pronta e a pessoa posta pelo aplicativo.

---

## **3. Threads / X (post curto)**

### **Specs**

* **Texto apenas** (imagens opcionais)
* **Tamanho máximo:** 500 characters (Threads) / 280 characters (X tradicional)
* Se anexar imagem, usar 1:1 ou 4:5

### **Caption Guidelines**

* **Tom:** Mais provocativo permitido, **mas sempre com dado**. A 4Selet pode soar afiada — não pode soar barata.
* **Tamanho:** 1–3 frases curtas; diretas e auto-suficientes
* **Hashtags:** Opcional — máximo 1; **nunca** comece com hashtags
* **Sem CTA obrigatório** — pode terminar com pergunta retórica, observação seca ou desafio factual

**Exemplos de estilo de post:**

> Taxa de 7,9% é problema dos outros. O seu problema é por que o seu cartão tá aprovando 78% em vez de 95%.

> Migrar de plataforma é caro. Ficar onde já não serve é mais caro. Faz o cálculo.

> A 4Selet é por convite. Não é marketing — é regra de quem entra.

> 0% por 3 meses. R$ 1,99 por transação. Quem leu a letra miúda saiu satisfeito — e quem só viu a manchete, também.

### **Content Notes**

* Evite soar como anúncio — Threads/X recompensam autenticidade controlada
* **Engagement bait** ("comenta aqui!") é proibido
* **Auto-depreciação NÃO é permitida** — a 4Selet é sóbria, não casual demais. Nada de "o idiota aqui, ó" ou tom de zoeira; o produtor estabelecido espera autoridade, não piada.
* Pode adaptar captions do Instagram — mas encurtar, manter o dado, retirar emojis e hashtags
* **Números específicos sempre.** 7,9% / 0% / R$ 1,99 / D+10 / D+30 / R$ 300 mil — esses são os números da campanha; use-os.

---

## **4. YouTube**

> **Escopo:** referência **editorial** apenas. Não existe tipo de conteúdo de YouTube no painel, não há render de thumbnail no fluxo de produção e **não há publicação** (o publisher só cobre o feed do Instagram). O único produtor de material de YouTube é a skill `copywriter-agent`, que escreve `youtube_metadata.json` no caminho manual/CLI. Use esta seção para redigir título e descrição — não espere que o sistema gere ou publique.

### **Specs**

| Formato | Dimensões | Aspect Ratio | Resolução Mínima |
| ----- | ----- | ----- | ----- |
| **Vídeo Padrão** | 1920 × 1080 px | 16:9 | 1080p |
| **Shorts** | 1080 × 1920 px | 9:16 | 1080p |
| **Thumbnail** | 1280 × 720 px | 16:9 | 72 dpi |

### **Title Guidelines**

* **Tamanho:** 60–70 characters (evita truncamento na busca)
* **Estrutura:** Frase descritiva + keyword(s) de SEO
* **Estilo:** **Claro e informativo primeiro, factual segundo.** Sem clickbait.
* A provocação, quando aparece, vem de **especificidade**, não de exagero

**Exemplos de títulos:**

> Como Funciona a Migração de Plataforma para a 4Selet (Sem Perder Mês de Faturamento)

> 0% de Taxa por 3 Meses — A Mecânica Completa da Campanha Taxa Zero

> Multi-Adquirência Inteligente: Por Que Seu Cartão Está Aprovando Menos do Que Deveria

> 4Selet por Dentro: Tour Pela Plataforma de Pagamentos Para Produtor Estabelecido

### **Description Guidelines**

* **Tamanho:** 2–4 frases na primeira "dobra" + bloco de links abaixo
* **Estrutura:** Sobre o que é o vídeo → Benefício-chave com número → CTA com link
* Incluir keywords relevantes naturalmente (plataforma de pagamentos, infoproduto, multi-adquirência, área de membros, antifraude, recorrência)
* Sempre terminar com CTA + link para solicitar convite (durante Taxa Zero)

**Exemplo de description:**

```
Nesse vídeo a gente mostra a mecânica completa da campanha Taxa Zero: 0% de taxa pela plataforma nos primeiros 3 meses ou até R$ 300 mil em vendas, R$ 1,99 fixo por transação, PIX em D+10 e cartão em D+30. Sem letra miúda.

A 4Selet é a plataforma de pagamentos para produtores que tratam o digital como negócio sério. Acesso por convite.

→ Solicitar convite: [link]
→ Wiki: wiki.4selet.com.br
→ Site: 4selet.com.br

#4Selet #TaxaZero #PlataformaDePagamentos
```

### **Thumbnail Guidelines**

* **Background:** **Selet Navy** (`#003554`) ou **Selet Darker** (`#07212B`) — alto contraste com texto Cloud
* **Tipografia:** **Inter Black** para headline — máximo 5–6 palavras
* **Texto deve ser legível em mobile** (preview de 168×94px no celular)
* **Alto contraste** — evitar backgrounds ocupados
* Pode incluir um número-âncora gigante (ex.: "0%" ou "R$ 1,99") como elemento visual primário
* **Sem rostos exagerados, sem setas vermelhas gritantes, sem CAPS LOCK na thumbnail**
* O **símbolo "4"** pode aparecer como elemento decorativo no canto

### **Content Notes**

* Vídeos devem abrir com hook nos **primeiros 5 segundos** — pergunta factual, número-âncora ou problema real
* **Shorts** seguem regras de Reels — ritmo controlado (3–5s por scene beat), resultado visível cedo
* Sempre incluir **CTA verbal ou on-screen** antes do vídeo terminar
* **Tom:** didático e profissional — como gestor experiente explicando para o time
* **Números específicos sempre:** os da Taxa Zero têm prioridade durante a campanha

---

## **5. LinkedIn**

### **Specs**

| Formato | Dimensões | Aspect Ratio |
| ----- | ----- | ----- |
| **Image Post** | 1200 × 1200 px | 1:1 |
| **Carrossel (PDF)** | 1080 × 1080 px ou 1080 × 1350 px | 1:1 ou 4:5 |
| **Vídeo nativo** | 1920 × 1080 px (16:9) ou 1080 × 1080 px (1:1) | 16:9 / 1:1 |

### **Post Guidelines**

* **Tamanho ideal:** 1.200–1.500 caracteres (LinkedIn premia posts com substância editorial)
* **Estrutura:** Hook factual nas primeiras 2 linhas (acima do "ver mais") → desenvolvimento em parágrafos curtos → reflexão estratégica → CTA suave → 3–5 hashtags
* **Tom:** **Editorial premium, autoridade técnica.** Como artigo curto de uma publicação financeira séria.
* **Emojis:** 0–1, funcional (`→` para item de lista, `▸` para bullet). Sem emojis decorativos.
* **Sem auto-depreciação.** LinkedIn é onde a 4Selet aparece com mais autoridade.

### **Hashtags LinkedIn**

* 3–5 hashtags, no final do post
* Mix: `#4Selet` + `#PagamentosDigitais` + `#Infoproduto` + `#NegocioDigital` + `#EmpreendedorismoDigital`
* Pode usar hashtags em inglês quando relevante: `#FinTech`, `#PaymentInfra`, `#CreatorEconomy`

**Exemplo de post LinkedIn:**

```
O produtor que olha apenas a taxa percentual está olhando para o lugar errado.

O que define a rentabilidade da operação digital é a soma de quatro variáveis:

→ Taxa por transação (todo mundo olha)
→ Prazo de recebimento (poucos calculam o custo de oportunidade)
→ Taxa de aprovação do gateway (a maior fonte de receita perdida silenciosa)
→ Custo do suporte em horas-equipe perdidas resolvendo problema de plataforma

Reduzir uma variável e perder nas outras três é prejuízo disfarçado de economia.

Por isso a Taxa Zero da 4Selet não é só sobre 0%. É sobre dar ao produtor 3 meses para medir as quatro variáveis num ambiente desenhado para quem opera com seriedade.

#4Selet #TaxaZero #PagamentosDigitais #Infoproduto #NegocioDigital
```

### **Content Notes para LinkedIn**

* LinkedIn é onde **citações de Fabricio Gonçalves** ou **dados de mercado** funcionam melhor
* Posts em formato "lista numerada" performam bem — usar parcimoniosamente
* **Carrosséis em PDF** (sempre 1:1 ou 4:5) são excelentes para tutoriais e análises mais profundas
* **Headline-grabber** nos primeiros 200 caracteres é tudo (define se a pessoa expande o "ver mais")

---

## **6. Quick Reference Cheat Sheet**

### Matriz de formatos (o que existe, onde entra)

| Formato | Instagram | Threads/X | YouTube | LinkedIn |
| ----- | ----- | ----- | ----- | ----- |
| **4:5 — 1080×1350** | **Publicável no feed** (post principal, carrossel, 4Selet na Mídia) | Anexo opcional | N/A | Aceito no post |
| **1:1 — 1080×1080** | Imagem/Anúncio; grade | Anexo opcional | N/A | 1200×1200 no post |
| **9:16 — 1080×1920** | Story (`instagram_story`, publicação manual) · Reel/vídeo | N/A | Shorts | N/A |
| **16:9 — 1920×1080** | **Não publicável no feed** — ativo de site/apresentação (4Selet na Mídia) | N/A | Vídeo e thumbnail (1280×720) | Vídeo |

### Redação e formatação

|  | Instagram | Threads/X | YouTube | LinkedIn |
| ----- | ----- | ----- | ----- | ----- |
| **Caption length** | 1–3 frases | 1–3 frases curtas | 2–4 frases | 1.200–1.500 chars |
| **CTA** | Condicional (padrão: sem CTA) | Opcional | **Sim** | **Sim** (suave) |
| **Hashtags** | 3–5, obrigatórias | 0–1, opcional | Na description/tags | 3–5 |
| **Emojis** | Máx 1, funcional | Máx 1 | Evitar em títulos | Máx 1, funcional |
| **Tom** | Editorial, sóbrio | Provocativo controlado | Didático, profissional | Editorial premium |
| **Headline font** | Inter 700–800 | N/A | Inter 700–800 | Inter 700–800 |
| **Body font** | Inter 400–500 | N/A | Inter 400–500 | Inter 400–500 |
| **Label font** | Inter 500–600 uppercase | N/A | Inter 500–600 uppercase | Inter 500–600 uppercase |
| **BG claro** | `#D9DCD6` Cloud | N/A | `#D9DCD6` Cloud | `#D9DCD6` Cloud |
| **BG escuro** | `#003554` Navy ou `#07212B` Darker | N/A | `#003554` Navy ou `#07212B` Darker | `#003554` Navy |
| **Accent** | `#006494` Blue | N/A | `#006494` Blue | `#006494` Blue |

---

## **7. Tom e Voz por Plataforma — Referência Rápida**

| Plataforma | Como a 4Selet fala aqui |
| ----- | ----- |
| **Instagram** | Editorial e premium no visual, sóbrio e direto no copy. "0% por 3 meses. R$ 1,99 por transação. Convite na bio." Tom de gestor experiente comentando uma decisão estratégica. |
| **Threads / X** | Provocação controlada com dado real. Pode ser afiada — não pode ser barata. "Taxa de 7,9% é problema dos outros. O seu problema é por que seu cartão tá aprovando 78%." |
| **YouTube** | Didático e profissional, como explicação de gestor experiente para o time. Storytelling com dados específicos + demonstração real da plataforma. |
| **LinkedIn** | Editorial premium, autoridade técnica. É onde a 4Selet aparece com mais peso — artigos curtos com tese, dados e reflexão estratégica. |

**Regra universal:** Cada claim precisa de um **número, prazo, processo ou prova concreta**. *"Você pode crescer"* está ERRADO. *"3 meses para você medir as 4 variáveis da sua rentabilidade"* está CERTO.

---

## **8. Sequenciamento de Distribuição (referência para Distribution Agent)**

Quando uma campanha tem múltiplos formatos prontos, **ordem sugerida de publicação:**

1. **LinkedIn primeiro (segunda-feira)** — alcança decisor estabelecido enquanto está planejando a semana
2. **Instagram Feed (terça-feira manhã)** — quando o público B2B está mais aberto a conteúdo estratégico
3. **YouTube (quarta-feira)** — vídeo longo para quem viu o teaser e quer aprofundar
4. **Instagram Reels + Threads (quinta-feira)** — formatos curtos para reforçar reach
5. **Instagram Story (sexta-feira)** — sticker de pergunta / poll para gerar conversa

> **Newsletter** segue ciclo próprio (terça de manhã) — ver `product_campaign.md` seção 4.

---

## **9. Agent Reference Summary**

| Agent | Seções-chave a referenciar |
| ----- | ----- |
| **Ad Creative Designer** | Specs por plataforma · Design Rules · Carrossel rules · **2.6 4Selet na Mídia** · **2.7 Story Instagram** · Matriz de formatos |
| **Copywriter Agent** | Caption Guidelines (todas) · Hashtags · Tom por plataforma · Estrutura de post LinkedIn · **2.6 4Selet na Mídia** |
| **Distribution Agent** | Matriz de formatos (o que é publicável) · Sequenciamento de Distribuição · CTAs por plataforma |

---

*Última atualização: Agosto 2026 (v1.3 — Story Instagram) · Mantido por: Marketing 4Selet · Knowledge file consumido pelo painel web (injetado no prompt de geração) e pelos agentes Ad Creative, Copywriter e Distribution*
