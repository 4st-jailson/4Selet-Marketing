---
name: video-ad-specialist
description: >
  Converte intenção de marketing da 4Selet em scenes estruturadas de video ad
  short-form (Remotion-ready) como JSON válido. Seleciona a estratégia do anúncio,
  otimiza pacing e estrutura por plataforma (Instagram Reels e Feed, YouTube Shorts)
  e gera a sequência de scenes (hook, problem, product, benefit, proof, offer, cta).
  Use quando o usuário pedir "video ad", "Reels", "Shorts", "roteiro de vídeo",
  "scene JSON", "vídeo da campanha Taxa Zero", ou quando o Orchestrator acionar o
  Video Ad Specialist no pipeline. Esta skill NÃO renderiza o vídeo — o JSON
  alimenta a skill de rendering Remotion. NÃO usar para imagem estática (use a
  skill ad-creative-designer) nem para captions/legendas (use copywriter-agent).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 1.0.0
  category: marketing
  tags: [video-ads, remotion, scene-generation, short-form, 4selet]
---

# Video Ad Specialist

Converte contexto de marketing em **scene JSON Remotion-ready** para video ads short-form da 4Selet. Gera estratégia + sequência de scenes; **não renderiza** — o output é consumido pela skill de rendering Remotion.

## When to Use This Skill

- Usuário pede um "video ad", "Reels", "Shorts", "roteiro de vídeo curto" ou "scene JSON" para a 4Selet.
- O Orchestrator enfileira o job `video_ad_specialist` no pipeline.
- Há um output de pesquisa em `outputs/<task_name>_<date>/research_results.json` que deve virar vídeo.

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

Se existir pesquisa em `outputs/<task_name>_<date>/research_results.json`, extraia `ad_hooks`, `marketing_angles` e `keywords` e ancore a estratégia neles.

Guidance técnico de Remotion (componentes React + SVG, `useCurrentFrame()`, `interpolate()`, `@remotion/google-fonts`): ver o **projeto Remotion em `src/`** — a composition `AdVideo` (`src/AdVideo.tsx` + `src/scenes/*`) é a implementação de referência; renderize com `npm run render`. (Não existe skill `remotion-best-practices`.) Esta skill produz só o JSON — não escreve componentes React.

## Inputs

| Input | Exemplo | Obrigatório |
|-------|---------|-------------|
| Product / oferta | Plataforma 4Selet · Campanha Taxa Zero | Sim |
| Target audience | Produtor estabelecido (R$ 50k+/mês) | Inferir se ausente |
| Platform | `instagram_reels`, `instagram_feed`, `youtube_shorts`, `youtube` | Inferir `instagram_reels` |
| Campaign goal | Migração / aquisição qualificada | Inferir "solicitar convite" |

**Defaults quando faltar input:** product = Campanha Taxa Zero; audience = Produtor Estabelecido; platform = `instagram_reels`; goal = trazer produtor qualificado (CTA "Solicitar convite"). Sempre declare ao usuário quais defaults assumiu.

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

| Platform | `platform` value | Composition size | Estrutura | Duração alvo |
|----------|------------------|------------------|-----------|--------------|
| Instagram Reels | `instagram_reels` | 1080×1920 (9:16) | Hook → Product → Benefit → CTA | 15–20s |
| Instagram Feed | `instagram_feed` | 1080×1350 (4:5) | Hook → Proof/Benefit → Offer → CTA | 15–20s |
| YouTube Shorts | `youtube_shorts` | 1080×1920 (9:16) | Hook → Problem → Solution → CTA | 15–25s |
| YouTube | `youtube` | 1920×1080 (16:9) | Hook → Problem → Solution → Proof → CTA | 25–30s |

> Pacing 4Selet: mesmo em Reels, mantenha cada beat em 3–5s (mais lento que ads frenéticos). Use o teto da duração se a mensagem tiver número-âncora a respirar. Hook precisa entregar dor real ou número-âncora nos primeiros ~2–3s.

## Step 3: Scene Generation

Converta a estratégia em scenes sequenciais. Cada scene é uma unidade que o renderer Remotion traduz em visual.

**Scene types suportados:** `hook`, `problem`, `product`, `benefit`, `proof`, `offer`, `testimonial`, `cta`.

> `proof` é a adição 4Selet-specific para a prova-âncora "95% de aprovação no cartão". Prefira-a a `testimonial` quando não houver depoimento real autorizado.

Estrutura mínima de uma scene (campos obrigatórios):

```json
{ "type": "hook", "text": "Vou perder vendas migrando?" }
```

Cada scene **deve** ter `type` e `text`. Campos opcionais — preencha com direção de marca para facilitar o trabalho do renderer Remotion:

- `visual` — direção visual (background da paleta, layout, asset). Ponte com a noção de `text_overlay`/`visual` do pipeline.
- `transition` — `fade` | `slide` | `wipe` (nunca hard cut).
- `animation` — ex.: `"word-by-word easeOut"`, `"spring contido"`, `"pulse 1x Selet Blue"`.

Mapeie scene → background da paleta (ver Step 5): hook/problem em `Selet Darker`, product/benefit/proof em `Selet Darker` ou `Navy`, offer/cta em `Selet Navy`. Accent e números-âncora em `Selet Blue`.

## Step 4: Remotion Configuration Output

Gere **apenas JSON válido**, diretamente compatível com a skill de rendering Remotion.

**Campos obrigatórios:** `composition`, `props.style`, `props.duration`, `props.platform`, `props.scenes`. Cada scene: `type` + `text`.

```json
{
  "composition": "AdVideo",
  "props": {
    "style": "limited_offer",
    "duration": 18,
    "platform": "instagram_reels",
    "scenes": [
      {
        "type": "hook",
        "text": "Taxa média do mercado: 7,9%.",
        "visual": "Background Selet Darker (#07212B) com Selet Dots 8% opacity. Inter Black em Selet Cloud.",
        "transition": "fade",
        "animation": "word-by-word easeOut"
      },
      {
        "type": "offer",
        "text": "0% pela plataforma por 3 meses. R$ 1,99 por transação.",
        "visual": "Bloco Selet Navy (#003554); número 0% gigante em Selet Blue (#006494).",
        "transition": "slide",
        "animation": "spring contido"
      },
      {
        "type": "benefit",
        "text": "PIX em D+10. Cartão em D+30. Sem letra miúda.",
        "visual": "Bullets com indicador ▸ em Selet Blue sobre Selet Darker.",
        "transition": "fade",
        "animation": "staggered"
      },
      {
        "type": "cta",
        "text": "Solicitar convite.",
        "visual": "Selet Navy; Inter Black em Selet Cloud; logo-4selet-light.png fade-in.",
        "transition": "fade",
        "animation": "logo reveal"
      }
    ]
  }
}
```

**Salve o output** seguindo a convenção do pipeline:

```
outputs/<task_name>_<date>/video/scenes.json
```

A duração total (`props.duration`, em segundos) deve bater com a soma aproximada dos beats das scenes e respeitar a faixa da plataforma (Step 2).

---

## Brand Guardrails (4Selet) — checar antes de finalizar

- **Cores:** apenas a paleta oficial — `Selet Darker #07212B`, `Navy #003554`, `Blue #006494`, `Sky #5499B5`, `Mist #AFBCC9`, `Cloud #D9DCD6`. Sem branco puro, sem preto puro, sem neon, sem gradiente quente. `Selet Blue` aparece em toda peça.
- **Tipografia:** Inter (display/body/UI); JetBrains Mono **apenas** em snippets técnicos (códigos, prazos como label). Nunca Arial/Roboto/system fonts.
- **CTAs aprovados:** "Solicitar convite", "Ver condições", "Falar com o time", "Conhecer a plataforma", "Migrar minha operação", "Calcular minha economia". **Proibidos:** "Compre já!", "Última chance!", "Garanta sua vaga gratuita", urgência fake.
- **Números da Taxa Zero (precisão obrigatória):** 0% por **3 meses OU até R$ 300 mil** (o que vier primeiro); R$ 1,99/transação; PIX D+10; cartão D+30; prova-âncora 95% de aprovação. Nunca "0% pra sempre" nem "100% grátis".
- **Concorrentes:** **nunca** citar Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay — nem por nome, sigla, descrição ou logo. Mercado só em abstrato ("taxas de mercado em torno de 7,9%").
- **Motion:** beats 3–5s, transições fade/slide/wipe, texto animado word-by-word, `easeOut`. Sem footage/live-action, sem personagens fictícios, sem trending audio cliché.
- **Tom:** sócio experiente, sóbrio. Cada claim com número/prazo/processo. Sem motivacional vazio, sem promessa mágica.

## Examples

### Example 1: Reels de migração (problem_solution)

**Usuário diz:** "Cria um Reels respondendo a dúvida de quem tem medo de migrar."
**Actions:** Carrega knowledge files → estratégia `problem_solution`, platform `instagram_reels`, base no Conceito 4 → scenes Hook(problem) → product(migração assistida) → benefit → cta "Falar com o time." → salva em `outputs/.../video/scenes.json`.
**Result:** JSON com `style: "problem_solution"`, `platform: "instagram_reels"`, `duration: 18`, 4 scenes brand-aligned.

### Example 2: YouTube Short da mecânica (limited_offer)

**Usuário diz:** "Quero um Short explicando a Taxa Zero."
**Actions:** Estratégia `limited_offer`, platform `youtube_shorts`, estrutura Hook → Problem → Solution → CTA, números completos da campanha, CTA "Ver condições.".
**Result:** JSON `youtube_shorts` 1080×1920, `duration: 22`, regra completa (3 meses OU R$ 300 mil) presente.

### Example 3: Inputs faltando

**Usuário diz:** "Faz um video ad da 4Selet."
**Actions:** Aplica defaults (Taxa Zero · Produtor Estabelecido · `instagram_reels` · CTA "Solicitar convite"), **declara os defaults assumidos**, então gera o JSON.

## Troubleshooting

### JSON inválido ou campo obrigatório ausente
**Cause:** falta `composition`, `props.style/duration/platform/scenes`, ou uma scene sem `type`/`text`.
**Solution:** valide o objeto contra o schema do Step 4 antes de salvar. Output deve ser **apenas** JSON — sem texto fora do bloco.

### Número da campanha errado
**Cause:** "0% pra sempre" / "grátis" / saque no mesmo dia.
**Solution:** reconferir Seção 3 de `product_campaign.md`. Regra: 0% por 3 meses OU R$ 300 mil; R$ 1,99/transação; PIX D+10; cartão D+30.

### Concorrente citado / tom hype / cor off-brand
**Cause:** desvio das guardrails de marca.
**Solution:** rodar o checklist abaixo; corrigir antes de entregar.

## Quality Checklist

- [ ] Knowledge files carregados (brand_identity, product_campaign, platform_guidelines)
- [ ] Estratégia escolhida tem fit 4Selet (não `meme_style`/`lifestyle`)
- [ ] `platform` válido e composition size correto para a plataforma
- [ ] Todas as scenes têm `type` + `text`; opcionais `visual`/`transition`/`animation` preenchidos
- [ ] `props.duration` bate com a soma dos beats e a faixa da plataforma
- [ ] Paleta, fontes, CTA aprovado e números da Taxa Zero corretos
- [ ] Nenhum concorrente citado; sem urgência fake; sem branco/preto puro
- [ ] Output é **apenas JSON válido**, salvo em `outputs/<task_name>_<date>/video/scenes.json`

## Relacionamento com outras skills

```
Research Agent → Ad Creative Designer → Video Ad Specialist (esta skill)
   → scenes.json → Remotion (composition AdVideo em src/, npm run render) → ad.mp4 → Copywriter → Distribution
```

Esta skill é a ponte entre **estratégia de marketing** e **produção de vídeo**: gera a estrutura do ad; a renderização é feita pelo **projeto Remotion em `src/`** (composition `AdVideo`, `npm run render`) — não há skill `remotion-best-practices`. O mesmo scene JSON pode alimentar outros formatos (image ads, captions, distribution metadata), garantindo mensagem consistente entre mídias.

## Performance Notes

- Qualidade > velocidade. Não pule a leitura dos knowledge files nem o checklist.
- Lidere a mensagem com o **número-âncora** (Taxa Zero ou 95% aprovação), depois explique.
- Na dúvida sobre uma scene, ancore num dos **Conceitos 1–4** de `product_campaign.md`.
