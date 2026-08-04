---
name: video-ad-specialist
description: >
  Converte intenção de marketing da 4Selet em scenes estruturadas de video ad
  short-form (Remotion-ready) como JSON válido. Seleciona a estratégia do anúncio,
  otimiza pacing e estrutura por plataforma (Instagram Reels e Feed, YouTube Shorts)
  e gera a sequência de scenes (hook, problem, product, benefit, proof, offer, cta).
  Use quando o usuário pedir "video ad", "Reels", "Shorts", "roteiro de vídeo",
  "vídeo da campanha Taxa Zero", ou quando o Orchestrator acionar o tipo de conteúdo
  "Vídeo (short-form)" / video_idea. Esta skill NÃO renderiza o vídeo — o JSON
  alimenta o projeto Remotion em src/. NÃO usar para imagem estática (use a
  skill ad-creative-designer) nem para captions/legendas (use copywriter-agent).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 2.0.0
  category: marketing
  tags: [video-ads, remotion, scene-generation, short-form, 4selet]
---

# Video Ad Specialist

Converte contexto de marketing em **scene JSON Remotion-ready** para video ads short-form da 4Selet. Gera estratégia + sequência de scenes; **não renderiza** — o output é consumido pela skill de rendering Remotion.

## Onde isto se encaixa

O caminho principal de operação hoje é o **painel web** (`interface/`, em produção em `https://mkt.4st.co`), onde o tipo de conteúdo se chama **"Vídeo (short-form)"** (`video_idea`). O painel grava `video/concept.json` e chama `render.render(folder, "video")`, que deriva os props e renderiza o MP4. Esta skill cobre o caminho CLI/agente e usa **o mesmo contrato de arquivo**.

## When to Use This Skill

- Usuário pede um "video ad", "Reels", "Shorts" ou "roteiro de vídeo curto" para a 4Selet.
- O Orchestrator enfileira um job do tipo `video_idea`.
- Há pesquisa disponível (no painel, a pesquisa ao vivo entra pelo prompt; no CLI, o `research_results.json` é legado e pode não existir).

**NÃO use para:** imagem estática 1080×1080 (skill `ad-creative-designer`), captions/títulos/hashtags (skill `copywriter-agent`), ou renderização final em `.mp4` (skill de rendering Remotion).

## CRITICAL: Regra de Re-aprovacao (Workflow de Aprovacao)

Antes de QUALQUER escrita em `outputs/`, esta skill DEVE verificar o caminho.

**Deteccao:** se o caminho comeca com `outputs/approved/`, a task ja foi aprovada por
um humano. Qualquer edicao invalida a aprovacao.

**Acao obrigatoria:** PARAR. NAO escrever, NAO sobrescrever, NAO criar. Avisar:

> A task `<task_name>` (`<task_date>`) esta APROVADA. Para editar, rode:
>
> `node scripts/promote_task.js --task <task_name> --date <task_date> --to in_review`
>
> Isso move a task de volta para `outputs/<task_name>_<task_date>/`. Depois disso, a
> skill pode editar normalmente, e a task precisara ser re-aprovada pelo fluxo padrao.

**Apos confirmacao e execucao:** reler `status.json`, confirmar `status = "in_review"`
e caminho `outputs/<task>_<date>/`, e SO ENTAO retomar.

**Reportar ao final:**

> Aviso: task `<task_name>` saiu de `approved` e voltou para `in_review`. Precisa ser
> re-aprovada antes de publicar.

Inegociavel. Sem excecao para "edicao minima" ou "fix rapido".

## CRITICAL: Antes de gerar qualquer scene

Sempre carregue, nesta ordem, os knowledge files do projeto:

1. `knowledge/brand_identity.md` → Visual Identity, Brand Personality, Sample Copy, CTAs aprovados, lista fechada de concorrentes proibidos.
2. `knowledge/product_campaign.md` → Seções 7–11: Video Production Constraints, Motion Style, **Video Campaign Concepts 1–4**, Do's & Don'ts, Estrutura de Persuasão.
3. `knowledge/platform_guidelines.md` → specs e composition sizes por plataforma.

Pesquisa: pelo painel, a busca ao vivo (Tavily) é opt-in e entra direto no prompt, deixando rastro em `status.json.research_sources`. O `research_results.json` é **legado do caminho CLI** e pode não existir — se existir, extraia `ad_hooks`, `marketing_angles` e `keywords` e ancore a estratégia neles.

Guidance técnico de Remotion (componentes React + SVG, `useCurrentFrame()`, `interpolate()`, `@remotion/google-fonts`): ver o **projeto Remotion em `src/`**. A composition de produção parametrizada por scenes é **`BrandStory`** (`src/BrandStory.tsx`) — é o que o painel e o pipeline renderizam para `video/video.mp4`. `AdVideo` (`src/AdVideo.tsx`) é uma composition estática de referência (sem props). (Não existe skill `remotion-best-practices`.) Esta skill produz só o JSON — não escreve componentes React.

## Inputs

| Input | Exemplo | Obrigatório |
|-------|---------|-------------|
| **Pilar de conteúdo** | `taxa_zero`, `educacional`, `curiosidade_mercado`, `prova_plataforma`, `novidade`, `motivacional` | Sim — perguntar se ausente |
| Tema/brief da peça | "por que migrar não custa mês" | Sim |
| Target audience | Produtor estabelecido (R$ 50k+/mês) | Inferir se ausente |
| Platform | `instagram_reels`, `instagram_feed`, `youtube_shorts`, `youtube` | Inferir `instagram_reels` — **metadado de estratégia** (ver Step 2) |
| Campaign goal | Migração / aquisição qualificada | Inferir "solicitar convite" |

**Defaults quando faltar input:** audience = Produtor Estabelecido; platform = `instagram_reels`; goal = trazer produtor qualificado. Sempre declare ao usuário quais defaults assumiu.

> **O pilar define o TEMA — Taxa Zero não é default.** O painel modela 6 pilares de conteúdo (`interface/lib/config.js`, `CONTENT_PILLARS`) e injeta no prompt a regra: *"NEM toda peça é sobre Taxa Zero. Respeite o pilar como eixo temático, ainda que a campanha ativa exista."* Vídeo entra nessa regra como qualquer outro formato: um vídeo educacional ou de curiosidade de mercado não vira anúncio da campanha.

---

## Step 1: Ad Strategy Generation

Escolha **uma** estratégia com base em product + audience + platform + goal. A estratégia define estrutura narrativa, pacing, ordenação de scenes e ênfase.

| Strategy | Quando usar | Fit 4Selet |
|----------|-------------|------------|
| `problem_solution` | Objeção real do produtor (ex.: "vou perder vendas migrando?") | ⭐ Forte — base do Conceito 4 "Migração Sem Trauma" |
| `limited_offer` | Comunicar a mecânica da Taxa Zero | ⭐ Forte — base dos Conceitos 1 e 2. Comunicar a regra **completa** (3 meses OU R$ 300 mil) |
| `product_showcase` | Diferenciais da plataforma (95% aprovação, multi-adquirência) | ⭐ Forte |
| `testimonial` | Prova social | ⚠️ Só com depoimento real autorizado. A 4Selet **não usa personagens fictícios**. Na dúvida, prefira `proof` |
| `lifestyle` | Aspiração de estilo de vida | ⚠️ Fraco — quase sempre off-brand (tom sóbrio) |
| `meme_style` | Humor/tendência | ❌ **Off-brand. Não usar** para a 4Selet |

**Decisão rápida:** goal de aquisição/migração → `limited_offer` (Taxa Zero) ou `problem_solution`. Foco em features → `product_showcase`. Prova de autoridade → `product_showcase` com scene `proof`.

## Step 2: Platform Optimization

Adapte estrutura, pacing e composition size por plataforma. O motion style da 4Selet é **editorial sóbrio**: 3–5s por scene beat, transições suaves (fade/slide/wipe — **nunca hard cut**), tipografia animada word-by-word com `easeOut`.

> **Só existe um formato renderizável hoje: 9:16 (1080×1920).** A composition `BrandStory` está registrada com `width=1080 / height=1920` fixos (`src/Root.tsx`) e o render é chamado sem nenhuma flag de dimensão (`interface/lib/render.js`). O painel descreve o tipo como "Reels/short vertical (9:16)". Declarar `platform: "youtube"` **não** produz um vídeo 16:9 — sai 9:16 do mesmo jeito. Se 4:5 ou 16:9 for necessário, é trabalho de código em `src/Root.tsx` (width/height via `calculateMetadata`); até lá, **não prometa esses formatos**.

| Platform | `platform` value | Formato entregue | Estrutura | Duração alvo |
|----------|------------------|------------------|-----------|--------------|
| Instagram Reels | `instagram_reels` | **1080×1920 (9:16)** | Hook → Product → Benefit → CTA | 15–20s |
| Instagram Feed | `instagram_feed` | 9:16 (4:5 não suportado) | Hook → Proof/Benefit → Offer → CTA | 15–20s |
| YouTube Shorts | `youtube_shorts` | **1080×1920 (9:16)** | Hook → Problem → Solution → CTA | 15–25s |
| YouTube | `youtube` | 9:16 (16:9 não suportado) | Hook → Problem → Solution → Proof → CTA | 25–30s |

`platform` é **metadado de estratégia**: guia a estrutura e o pacing do roteiro, não a dimensão do arquivo.

> Pacing 4Selet: mesmo em Reels, mantenha cada beat em 3–5s de intenção (mais lento que ads frenéticos). Hook precisa entregar dor real ou número-âncora nos primeiros ~2–3s. **Atenção à matemática real do renderer** — ver Step 4.

## Step 3: Scene Generation

Converta a estratégia em scenes sequenciais. Cada scene é uma unidade que o renderer Remotion traduz em visual.

**Scene types com rótulo (eyebrow) próprio no renderer:** `hook`, `problem`, `product`, `benefit`, `cta`.

> **Não use `proof`, `offer` nem `testimonial`.** O mapeamento de eyebrow do `BrandStory` (`eyebrowFor`, em `src/BrandStory.tsx`) só conhece os cinco acima; qualquer outro valor cai no rótulo genérico "4SELET" na tela. Para prova-âncora ("95% de aprovação"), use `benefit` ou `product` com o número no `text`. O schema que o painel pede à IA é ainda mais estreito — `hook|product|benefit|cta` — e `problem`, embora suportado no render, não é oferecido lá.

Estrutura mínima de uma scene (campos obrigatórios):

```json
{ "type": "hook", "text": "Vou perder vendas migrando?" }
```

Cada scene **deve** ter `type` e `text` (headline on-screen). Campos opcionais:

- `subtitle` — **subtexto on-screen** (segunda linha, voltada ao espectador).
- `visual` — **direção de arte** (background da paleta, layout, asset). No contrato do autor, não aparece como texto na tela.
- `transition` — `fade` | `slide` | `wipe` (nunca hard cut). Metadado de estratégia.
- `animation` — ex.: `"word-by-word easeOut"`, `"spring contido"`, `"pulse 1x Selet Blue"`. Metadado de estratégia.

> **Tradução importante entre o contrato do autor e o componente.** O tipo de cena do `BrandStory` é `{ type, text, visual }` — **não existe `subtitle` lá**, e o que o componente desenha como segunda linha é o campo `visual`. Quem faz a ponte é o adaptador do painel (`interface/lib/render.js`): ele monta os props como `visual: s.subtitle`. Ou seja: **pelo painel, escreva `subtitle` normalmente**; se for montar props à mão para o CLI/Studio do Remotion, o subtexto tem que ir no campo `visual`, senão a sua direção de arte ("Background Selet Darker com Selet Dots 8%…") vai impressa na tela e o `subtitle` é descartado.

**Fundo por cena não existe.** O `BrandStory` aplica **um único gradiente global** para o vídeo inteiro e o `SceneWrapper` não aceita prop de cor. Não escreva mapeamento de background por cena — trate cor como direção de arte para futuras compositions. Accent e números-âncora aparecem no destaque padrão do componente.

## Step 4: Output — `video/concept.json`

Gere **apenas JSON válido** e salve em:

```
outputs/<task_name>_<date>/video/concept.json
```

Este é o arquivo canônico do tipo `video_idea` (`interface/lib/config.js`). O painel e o pipeline leem **só** ele.

> **`video/scenes.json` é arquivo de SAÍDA, não de entrada.** Quem escreve é o render: ele lê o `concept.json`, adapta os campos e grava/sobrescreve `scenes.json` como os props que vão para o Remotion. Se você salvar o roteiro em `scenes.json`, ele é ignorado (ninguém lê) e ainda é apagado no primeiro render. **Não escreva `scenes.json`.**

**Schema — plano, sem envelope `{composition, props}`** (espelha `SCHEMAS.video_idea` em `interface/lib/prompts.js`):

```json
{
  "concept": "Taxa Zero: 0% pela plataforma por 3 meses para quem opera com seriedade.",
  "hook": "Taxa média do mercado: 7,9% — e o dinheiro ainda demora a cair.",
  "emotional_arc": "Tensão do custo invisível → alívio da regra clara",
  "visual_style": "Editorial sóbrio azul, Inter Black, motion contido",
  "scenes": [
    {
      "type": "hook",
      "text": "Taxa média do mercado: 7,9%.",
      "subtitle": "E você ainda divide isso com prazos longos.",
      "visual": "Direção de arte: Selet Darker com Selet Dots 8%; Inter Black."
    },
    {
      "type": "product",
      "text": "0% por 3 meses.",
      "subtitle": "R$ 1,99 por transação. Sem letra miúda.",
      "visual": "Direção de arte: número 0% gigante em Selet Blue."
    },
    {
      "type": "benefit",
      "text": "PIX em D+10. Cartão em D+30.",
      "subtitle": "95% de aprovação no cartão.",
      "visual": "Direção de arte: bullets com indicador em Selet Blue."
    },
    {
      "type": "cta",
      "text": "Solicitar convite.",
      "subtitle": "Acesso por convite.",
      "visual": "Direção de arte: logo light em fade-in."
    }
  ],
  "cta": "Solicitar convite",
  "notes": "Pilar taxa_zero; regra completa da campanha no beat de produto."
}
```

**Campos obrigatórios:** `concept`, `scenes[]` (cada uma com `type` + `text`), `cta`.

### O que realmente vai para a tela

Apenas três coisas: **`scenes[].type`** (vira o eyebrow), **`scenes[].text`** (a headline) e **o subtexto** (que o adaptador do painel entrega ao componente como `visual`).

`concept`, `cta`, `hook`, `emotional_arc`, `visual_style` e `notes` são **metadados** — servem à peça, à legenda e ao racional, **não são desenhados**. Em particular:

> **Bug aberto no renderer:** o card final do `BrandStory` estampa a string fixa *"Para quem sabe que é Selet."* (`src/BrandStory.tsx`, e também `src/Root.tsx`) em vez de usar `props.cta`. Ou seja, **mesmo um JSON limpo sai com a frase-tag no vídeo** — o que contraria a regra dura vigente. Enquanto isso não for corrigido no componente (trocar o texto fixo por `props.cta`), registre a limitação ao entregar o vídeo. Não é algo que o JSON resolva.

### Duração real

A matemática do renderer não é "3s por cena". Cada cena avança **78 frames** (as cenas se sobrepõem num crossfade de 12 frames): `duração = n_cenas × 2,6s + 0,4s`.

| Cenas | Duração |
|---|---|
| 4 | ~10,8s |
| 6 | ~16,0s |
| 7 | ~18,6s |
| 8 | ~21,2s |

Para 15–20s, use **6 a 8 cenas**. Um roteiro de 4 cenas planejado para 18s sai com 10,8s. Não existe campo `duration` no contrato — se escrever, ninguém lê.

---

## Brand Guardrails (4Selet) — checar antes de finalizar

- **Frase-tag:** **nunca** use *"Para quem sabe que é Selet."* como fecho, assinatura, headline, subtexto ou cena de CTA — regra dura (GOVERNANCE em `interface/lib/prompts.js`), aplicada como gate no pipeline. Só se o brief pedir explicitamente. (Lembre do bug do renderer descrito no Step 4: o card final ainda carimba a frase sozinho — reporte, não reproduza no JSON.)
- **Pilar:** o tema segue o pilar escolhido; Taxa Zero é um pilar entre seis.
- **Cores:** apenas a paleta oficial — `Selet Darker #07212B`, `Navy #003554`, `Blue #006494`, `Sky #5499B5`, `Mist #AFBCC9`, `Cloud #D9DCD6`. Sem preto puro, sem neon, sem gradiente quente. `Selet Blue` aparece em toda peça. *(Limitação conhecida: o `BrandStory` usa `#FFFFFF` na tipografia principal — isso vem do componente, não do JSON, e não é verificável pelo roteiro.)*
- **Tipografia:** Inter (display/body/UI); JetBrains Mono **apenas** em snippets técnicos (códigos, prazos como label). Nunca Arial/Roboto/system fonts.
- **CTAs aprovados (9):** "Solicitar convite", "Ver as condições", "Conhecer a plataforma", "Migrar minha operação", "Calcular minha economia", "Falar com o time", "Acessar o material", "Ler o playbook", "Ver como funciona". **Proibidos:** "Compre já!", "Última chance!", "Garanta sua vaga gratuita", urgência fake.
- **Números da Taxa Zero (precisão obrigatória):** 0% por **3 meses OU até R$ 300 mil** (o que vier primeiro); R$ 1,99/transação; PIX D+10; cartão D+30; prova-âncora 95% de aprovação. Nunca "0% pra sempre" nem "100% grátis".
- **Concorrentes:** **nunca** citar Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay — nem por nome, sigla, descrição ou logo. Mercado só em abstrato ("taxas de mercado em torno de 7,9%").
- **Motion:** transições fade/slide/wipe, texto animado word-by-word, `easeOut`. Sem footage/live-action, sem personagens fictícios, sem trending audio cliché. *(O ritmo efetivo é de 2,6s por cena — ver Step 4.)*
- **Tom:** sócio experiente, sóbrio. Cada claim com número/prazo/processo. Sem motivacional vazio, sem promessa mágica.

## Examples

### Example 1: Reels de migração (problem_solution)

**Usuário diz:** "Cria um Reels respondendo a dúvida de quem tem medo de migrar."
**Actions:** Carrega knowledge files → pilar `prova_plataforma`, estratégia `problem_solution`, base no Conceito 4 → 6 cenas: hook(problem) → problem → product (migração assistida) → benefit → benefit (95%) → cta "Falar com o time" → salva em `outputs/.../video/concept.json`.
**Result:** JSON plano com `concept`, `hook`, `scenes[]` (6 cenas ≈ 16s) e `cta`.

### Example 2: Short da mecânica (limited_offer)

**Usuário diz:** "Quero um Short explicando a Taxa Zero."
**Actions:** Pilar `taxa_zero`, estratégia `limited_offer`, platform `youtube_shorts` (metadado — sai 9:16), estrutura Hook → Problem → Solution → CTA em 7 cenas (~18,6s), números completos da campanha, CTA "Ver as condições".
**Result:** `video/concept.json` com a regra completa (3 meses OU R$ 300 mil) presente e sem frase-tag.

### Example 3: Inputs faltando

**Usuário diz:** "Faz um video ad da 4Selet."
**Actions:** Pergunta o **pilar** e o tema; aplica os demais defaults (Produtor Estabelecido · `instagram_reels`), **declara os defaults assumidos**, então gera o JSON.

## Troubleshooting

### JSON inválido ou campo obrigatório ausente
**Cause:** falta `concept`, `cta` ou `scenes[]`, ou uma cena sem `type`/`text`.
**Solution:** valide o objeto contra o schema do Step 4 antes de salvar. Output deve ser **apenas** JSON — sem texto fora do bloco.

### O vídeo saiu com 1 cena só / o roteiro sumiu
**Cause:** o JSON foi salvo com o envelope `{ "composition": "BrandStory", "props": {...} }` ou no arquivo `video/scenes.json`. O render lê `video/concept.json` com schema plano; o envelope faz o componente receber `{composition, props}` e cair no fallback de uma cena.
**Solution:** salvar o schema plano em `video/concept.json`.

### A direção de arte apareceu escrita na tela
**Cause:** props montados à mão para o CLI/Studio com o subtexto em `subtitle`. O componente desenha `visual`.
**Solution:** ao montar props direto para o Remotion, coloque o subtexto em `visual`. Pelo painel, `subtitle` funciona (o adaptador traduz).

### Número da campanha errado
**Cause:** "0% pra sempre" / "grátis" / saque no mesmo dia.
**Solution:** reconferir Seção 3 de `product_campaign.md`. Regra: 0% por 3 meses OU R$ 300 mil; R$ 1,99/transação; PIX D+10; cartão D+30.

### Concorrente citado / tom hype / cor off-brand
**Cause:** desvio das guardrails de marca.
**Solution:** rodar o checklist abaixo; corrigir antes de entregar.

## Quality Checklist

- [ ] Knowledge files carregados (brand_identity, product_campaign, platform_guidelines)
- [ ] **Pilar de conteúdo** definido (Taxa Zero não é default)
- [ ] Estratégia escolhida tem fit 4Selet (não `meme_style`/`lifestyle`)
- [ ] Schema **plano** (sem `composition`/`props`); `concept`, `cta` e `scenes[]` preenchidos
- [ ] Tipos de cena restritos a `hook`/`problem`/`product`/`benefit`/`cta`
- [ ] Nº de cenas calibrado pela conta real (n × 2,6s + 0,4s) para a faixa da plataforma
- [ ] **Nenhuma cena assina com a frase-tag**
- [ ] Paleta, fontes, CTA aprovado (grafia canônica) e números da Taxa Zero corretos
- [ ] Nenhum concorrente citado; sem urgência fake
- [ ] Output é **apenas JSON válido**, salvo em `outputs/<task_name>_<date>/video/concept.json` (nunca em `scenes.json`)

## Relacionamento com outras skills

```
Research → Video Ad Specialist (esta skill) → video/concept.json
   → render.render(folder, "video") → video/scenes.json (props, derivado) → BrandStory → video/video.mp4
   → Copywriter (legenda) → Distribution (publicação no painel)
```

Esta skill é a ponte entre **estratégia de marketing** e **produção de vídeo**: gera a estrutura do ad; a renderização é feita pelo **projeto Remotion em `src/`** (composition `BrandStory`, acionada pelo painel `interface/lib/render.js`) — não há skill `remotion-best-practices`. **Vídeo não é publicável no Instagram hoje** — o publisher cobre imagem única e carrossel; Reels/Stories ficam para depois.

## Performance Notes

- Qualidade > velocidade. Não pule a leitura dos knowledge files nem o checklist.
- Lidere a mensagem com o **número-âncora** (Taxa Zero ou 95% aprovação), depois explique.
- Na dúvida sobre uma scene, ancore num dos **Conceitos 1–4** de `product_campaign.md`.
