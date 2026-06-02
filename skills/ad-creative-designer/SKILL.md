---
name: ad-creative-designer
description: >
  Gera criativos de anuncio ESTATICOS da 4Selet como design JSON estruturado (o blueprint),
  depois ad.html + styles.css, e renderiza para PNG via Playwright (Chromium headless). A IA
  cria a especificacao de design — nao gera pixels com modelo de imagem. Seleciona um layout
  template (product_focus, split, lifestyle), escreve copy curta (headline ate 4 palavras,
  subtext, CTA) e aplica a identidade visual oficial da 4Selet. Use quando o usuario pedir
  "ad estatico", "post/imagem para Instagram", "criativo", "layout de anuncio", "ad 1080x1080",
  "thumbnail do YouTube", ou quando o Orchestrator acionar o Ad Creative Designer no pipeline.
  NAO renderiza video (use a skill video-ad-specialist) nem escreve captions longas (use
  copywriter-agent).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 1.1.0
  category: marketing
  tags: [static-ads, design-spec, playwright, html-to-png, 4selet]
---

# Ad Creative Designer

Gera **criativos estaticos** da 4Selet como **design JSON** (blueprint) -> **ad.html + styles.css** -> **PNG renderizado via Playwright**. A IA cria a especificacao de design; o pixel sai do navegador headless. Determinístico, sem API de imagem paga, sem GPU.

## When to Use This Skill

- Usuario pede um "ad estatico", "criativo", "post/imagem para Instagram", "layout de anuncio", "ad 1080x1080" ou "thumbnail".
- O Orchestrator enfileira o job `ad_creative_designer`.
- Existe pesquisa em `outputs/<task_name>_<date>/research_results.json` para ancorar hook e angulo.

**NAO use para:** video (skill `video-ad-specialist`), captions/títulos/hashtags (skill `copywriter-agent`), ou hosting/publicacao (skill `distribution-agent`).

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

## CRITICAL: metodo de rendering (leia primeiro)

O metodo canonico deste projeto e **HTML/CSS + Playwright screenshot**, NAO HTML5 Canvas.

- O agente gera `ad.html` + `styles.css` a partir do layout spec.
- Renderiza com **Playwright** (`chromium.launch()` headless) -> screenshot PNG no tamanho exato.
- `canvas.getContext("2d")` + `toDataURL()` + `link.click()` (metodo antigo) **nao e usado** — nao roda no pipeline headless. Ignore esse caminho mesmo se aparecer em docs antigos.

## CRITICAL: antes de gerar qualquer design

Carregue, nesta ordem, os knowledge files:

1. `knowledge/brand_identity.md` -> Visual Identity, Color Palette/Rules, Typography, CTAs aprovados, concorrentes proibidos.
2. `knowledge/product_campaign.md` -> Campanha Taxa Zero (numeros), headlines aprovadas, selling points, visual assets.
3. `knowledge/platform_guidelines.md` -> specs por plataforma, design rules, regra de margem segura.

Se existir `research_results.json`, extraia `ad_hooks` e `selected_campaign_angle` e ancore o criativo neles.

## Inputs

| Input | Exemplo | Obrigatorio |
|-------|---------|-------------|
| Product / oferta | Plataforma 4Selet · Campanha Taxa Zero | Sim |
| Target audience | Produtor estabelecido (R$ 50k+/mes) | Inferir se ausente |
| Platform / format | `instagram_square`, `instagram_feed`, `instagram_story`, `youtube_thumbnail` | Inferir `instagram_square` |
| Style / layout | `product_focus`, `split`, `lifestyle` | Inferir por objetivo |

**Defaults:** product = Taxa Zero; audience = Produtor Estabelecido; format = `instagram_square` (1080x1080); layout = `product_focus`; CTA = "Solicitar convite". Sempre declare os defaults assumidos.

---

## Step 1: Selecionar layout template

Use **templates** (nunca posicionar elementos aleatoriamente — isso evita layouts feios).

| Template | Estrutura | Quando usar |
|----------|-----------|-------------|
| `product_focus` | Eyebrow + headline grande + subtext + CTA, empilhados; logo/screenshot como accent | Oferta/feature direta (Taxa Zero, 95% aprovacao) |
| `split` | Dois blocos: texto de um lado, visual (número-âncora, mockup ou screenshot mascarado) do outro | Comparativo "vs mercado", product showcase |
| `lifestyle` | Fundo full-bleed (solido/gradiente + Selet Dots) com headline + CTA sobrepostos | Institucional / frase-tag da marca |

## Step 2: Escrever a copy do criativo

- **Headline:** ate ~4 palavras, Inter Black. Lidere com numero-ancora (ex.: *"0% de taxa."*, *"95% de aprovacao."*).
- **Subtext:** 1 frase com a regra completa/prova (ex.: *"Por 3 meses ou ate R$ 300 mil. R$ 1,99 por transacao."*).
- **CTA:** um dos aprovados — *Solicitar convite*, *Ver condicoes*, *Falar com o time*, *Conhecer a plataforma*.
- **Footer/tagline (opcional):** *"Para quem sabe que e Selet."*

## Step 3: Gerar o design JSON (o blueprint)

Salve em `ads/layout.json`. Schema:

```json
{
  "format": "instagram_square",
  "width": 1080,
  "height": 1080,
  "layout_type": "product_focus",
  "background": "#003554",
  "palette": {
    "darker": "#07212B", "navy": "#003554", "blue": "#006494",
    "sky": "#5499B5", "mist": "#AFBCC9", "cloud": "#D9DCD6"
  },
  "elements": [
    { "type": "eyebrow",  "text": "CAMPANHA TAXA ZERO" },
    { "type": "headline", "text": "0% de taxa." },
    { "type": "subtext",  "text": "Por 3 meses ou até R$ 300 mil em vendas. R$ 1,99 por transação. PIX em D+10." },
    { "type": "cta",      "text": "Solicitar convite" },
    { "type": "image",    "src": "assets/logo-4selet-light.png", "role": "logo" },
    { "type": "footer",   "text": "Para quem sabe que é Selet." }
  ]
}
```

> O JSON e **semantico/template-driven** (não coordenadas x/y cruas). O template + CSS cuidam do posicionamento — mais robusto e consistente que pixel-positioning manual.

## Step 4: Gerar ad.html + styles.css

Converta o layout spec em `ads/ad.html` + `ads/styles.css`, renderizando no tamanho exato (ex.: 1080x1080).

Requisitos:
- `.ad-container` com `width`/`height` exatos do formato; `overflow: hidden`.
- Hierarquia tipografica clara: **headline > subtext > CTA**. CTA com estilo de botao (background Selet Blue).
- Carregar fontes via Google Fonts no `<head>` (o render headless busca da CDN):
  `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@500;700&display=swap`
- **Inter** para headline/subtext/CTA; **JetBrains Mono** para labels/dados (eyebrow, valores, prazos).
- Background da paleta + **Selet Dots** 6–10% opacity (`radial-gradient` dot pattern).
- Margem segura generosa (~96px em 1080x1080).
- **Elementos `image` viram `<img>`**: `class="logo"` (logo oficial) ou `class="product"` (screenshot da plataforma, **sempre com dados mascarados**). Caminho relativo a `assets/`. Posicione conforme o template (ex.: em `split`, o produto fica de um lado). O renderer aguarda as `<img>` decodificarem antes do screenshot.
- **CTA em estilo de botao** (elemento `<button class="cta">`), visualmente distinto, background Selet Blue.

Estrutura HTML mínima (product_focus, só texto):

```html
<div class="ad-container">
  <div class="dots"></div>
  <div class="eyebrow">CAMPANHA TAXA ZERO</div>
  <div class="headline"><span class="accent">0%</span> de taxa.</div>
  <div class="subtext">Por 3 meses ou até R$ 300 mil. R$ 1,99 por transação.</div>
  <button class="cta">Solicitar convite</button>
  <div class="footer">Para quem sabe que é Selet.</div>
</div>
```

Variante com imagem de produto (ex.: `split` / product showcase):

```html
<img class="product" src="../../assets/platform-dashboard.png" alt="" /> <!-- screenshot mascarado -->
<button class="cta">Solicitar convite</button>
```

## Step 5: Renderizar PNG via Playwright

Use o renderer headless **empacotado com a skill** (`skills/ad-creative-designer/scripts/render_ad.js`), rodando a partir da raiz do projeto (Chromium ja instalado via `npx playwright install chromium`):

```bash
node skills/ad-creative-designer/scripts/render_ad.js outputs/<task_name>_<date>/ads/ad.html outputs/<task_name>_<date>/ads/instagram_ad.png 1080 1080
```

O script lanca Chromium, seta o viewport para `width x height`, abre o `ad.html` (`file://`), aguarda `document.fonts.ready` **e todas as `<img>` decodificarem**, e captura screenshot recortado no tamanho exato. O script vive **dentro da skill** (persiste com ela, ao contrario de `outputs/`). **Sempre inspecione o PNG resultante** (abra/leia a imagem) antes de considerar pronto — render OK nao garante layout correto.

## Step 6: Output storage

Salve tudo em `outputs/<task_name>_<date>/ads/`:

```
ads/
├── layout.json        ← design spec (blueprint)
├── ad.html            ← layout em HTML
├── styles.css         ← estilos
└── instagram_ad.png   ← render final (Playwright)
```

Nenhum arquivo gerado fora de `outputs/`.

## Os três deliverables (mapeamento com a "Modificação" documentada)

A skill produz **três deliverables**, cobrindo os steps documentados — **sem alterar a lógica de geração do JSON**:

1. **Design JSON** (`layout.json`) — Step 3 (comportamento existente, preservado).
2. **HTML ad layout** (`ad.html` + `styles.css`) — Step 4 ≙ "Step 7: HTML Ad Rendering".
3. **Imagem final** (`instagram_ad.png`) — Step 5 ≙ "Step 8: Playwright Screenshot". Output storage (Step 6) ≙ "Step 9".

---

## Formatos por plataforma

| Format value | Dimensoes | Uso |
|--------------|-----------|-----|
| `instagram_square` | 1080×1080 | Feed quadrado |
| `instagram_feed` | 1080×1350 | Feed 4:5 (mais area vertical) |
| `instagram_story` | 1080×1920 | Story/Reels cover (texto na zona segura central) |
| `youtube_thumbnail` | 1280×720 | Thumbnail (headline ≤5–6 palavras, alto contraste Navy/Darker) |

Passe `width`/`height` correspondentes ao `render_ad.js`.

## Brand Guardrails (4Selet) — checar antes de finalizar

- **Cores:** so a paleta oficial. **Sem branco puro** (use Cloud `#D9DCD6`), **sem preto puro** (use Darker `#07212B`), sem neon, sem gradiente quente. Selet Blue aparece em toda peca. Máximo ~3 cores por peca.
- **Tipografia:** Inter (headline/body/CTA) + JetBrains Mono (labels/dados). **Nunca Playfair, DM Sans, Arial, Roboto ou system fonts** (os exemplos "terrosos"/Playfair em docs antigas sao off-brand).
- **Logo:** `logo-4selet-light.png` em fundos escuros, `logo-4selet.png` em fundos claros. Nunca esticar/distorcer/recriar a wordmark.
- **CTAs aprovados:** Solicitar convite · Ver condicoes · Falar com o time · Conhecer a plataforma. Proibidos: "Compre ja!", "Ultima chance!", urgencia fake.
- **Numeros Taxa Zero (precisao):** 0% por **3 meses OU ate R$ 300 mil**; R$ 1,99/transacao; PIX D+10; cartao D+30; prova 95% aprovacao. Nunca "0% pra sempre" / "100% gratis".
- **Concorrentes:** nunca citar Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay — mercado so em abstrato ("~7,9%").
- **Screenshots da plataforma:** sempre com dados mascarados (`c••••@email.com`, `pur_XXX•••••XXX`).
- **Tom:** sobrio, premium, espaco negativo ativo. Sem estetica guru/hype.

## Examples

### Example 1: Ad quadrado Taxa Zero (product_focus)
**Usuario:** "Cria um ad de Instagram da Taxa Zero." -> defaults `instagram_square`/`product_focus`; headline "0% de taxa.", subtext com regra completa, CTA "Solicitar convite", footer tagline, logo light. Render 1080x1080. Inspecionar PNG.

### Example 2: Comparativo (split)
**Usuario:** "Ad mostrando a diferenca de taxa vs mercado." -> `split`: bloco texto + número-âncora "7,9%" (mercado, em abstrato) vs "0%" (Selet Blue). Sem citar concorrente.

### Example 3: Inputs faltando
**Usuario:** "Faz um criativo da 4Selet." -> aplica defaults, **declara** os defaults, gera blueprint + render.

## Troubleshooting

### Fontes erradas / serifadas no PNG
**Cause:** Google Fonts nao carregou antes do screenshot. **Solution:** `<link>` das fontes no `<head>` + o script aguarda `document.fonts.ready`; adicione pequeno delay se necessario.

### PNG com tamanho/recorte errado
**Cause:** viewport != formato, ou conteudo transbordando. **Solution:** passar `width height` corretos ao `render_ad.js`; `.ad-container` com dimensoes exatas e `overflow: hidden`; screenshot com `clip`.

### Cor off-brand / concorrente citado / CTA proibido
**Solution:** rodar o checklist; corrigir antes de entregar.

## Quality Checklist

- [ ] Knowledge files carregados (brand_identity, product_campaign, platform_guidelines)
- [ ] Layout template escolhido (product_focus/split/lifestyle) — não posicionamento aleatório
- [ ] Headline ≤4 palavras liderando com numero-ancora; CTA aprovado
- [ ] `layout.json` + `ad.html` + `styles.css` gerados; dimensoes exatas do formato
- [ ] Paleta oficial (sem branco/preto puro/neon), Inter + JetBrains Mono (sem Playfair/Arial)
- [ ] Numeros Taxa Zero corretos; nenhum concorrente citado; screenshots mascarados
- [ ] `instagram_ad.png` renderizado via Playwright **e inspecionado visualmente**
- [ ] Tudo salvo em `outputs/<task_name>_<date>/ads/`

## Relacionamento com outras skills

```
Research Agent → research_results.json (ad_hooks, angulo)
   → Ad Creative Designer (esta skill) → ads/{layout.json, ad.html, styles.css, instagram_ad.png}
   → Distribution Agent (upload + Publish MD)
```

O `layout.json` (blueprint) e a fonte de verdade do design; `ad.html`/`styles.css` o materializam; o PNG e o asset final consumido pelo Distribution Agent. O mesmo blueprint pode gerar outros formatos (story, thumbnail) so trocando `width`/`height` e ajustando o template.

## Performance Notes

- Qualidade > velocidade. Não pule a leitura dos knowledge files nem a inspecao do PNG.
- Lidere com o **numero-ancora** (Taxa Zero ou 95%), depois explique.
- Na duvida sobre layout/cor, ancore nas Design Rules de `platform_guidelines.md` e na paleta de `brand_identity.md`.
