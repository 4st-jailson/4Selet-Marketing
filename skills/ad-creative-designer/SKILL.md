---
name: ad-creative-designer
description: >
  Gera criativos ESTATICOS da 4Selet como concept JSON estruturado (o blueprint), depois
  ad.html (CSS inline) e renderiza para PNG via Playwright (Chromium headless). A IA cria a
  especificacao de design — nao gera pixels com modelo de imagem. Escolhe um dos 4 templates
  reais (editorial, bold, split, photo), escreve copy curta (headline ate ~4 palavras, subtext,
  CTA) e aplica a identidade visual oficial da 4Selet. Use quando o usuario pedir "ad estatico",
  "post/imagem para Instagram", "criativo", "layout de anuncio", "ad 1080x1080", ou quando o
  Orchestrator acionar o Ad Creative Designer no pipeline. NAO renderiza video (use a skill
  video-ad-specialist), nao escreve captions longas (use copywriter-agent) e NAO e o caminho
  para aparicao na imprensa (tipo "4Selet na Midia" — ver roteamento abaixo).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 2.0.0
  category: marketing
  tags: [static-ads, design-spec, playwright, html-to-png, 4selet]
---

# Ad Creative Designer

Gera **criativos estaticos** da 4Selet como **concept JSON** (blueprint) -> **ad.html** (CSS inline) -> **PNG renderizado via Playwright**. A IA cria a especificacao de design; o pixel sai do navegador headless. Deterministico, sem API de imagem paga, sem GPU.

## Onde isto se encaixa

O **caminho principal de operacao hoje e o painel web** (`interface/`, em producao em `https://mkt.4st.co`): o usuario escolhe o tipo "Imagem / Anuncio", o pilar e o estilo, e o painel gera `ads/concept.json` e renderiza `ads/ad.png`. Esta skill cobre o caminho **CLI/agente** e usa **exatamente o mesmo contrato de arquivos** — peca gerada por aqui tem que abrir, re-renderizar e editar no painel sem adaptacao.

## When to Use This Skill

- Usuario pede um "ad estatico", "criativo", "post/imagem para Instagram", "layout de anuncio", "ad 1080x1080".
- O Orchestrator enfileira o job do tipo `ad_creative`.

**NAO use para:**

- **Aparicao na imprensa** ("saiu uma materia sobre a 4Selet", "faz uma peca da reportagem") -> esse e o tipo **`media_mention` / "4Selet na Midia"**, um tipo NATIVO do painel com 10 modelos de mockup (`hand_tablet`, `foto_real`, `foto_mesa`, `foto_maos_mesa`, `celular`, `navegador`, `citacao`, `split`, `selo`, `camadas`) e 4 formatos (4:5, 1:1, 9:16, 16:9), renderizado por `renderMedia`/`tplMedia` a partir de `status.media` (print, veiculo, url, headline, modelo, tamanhos). **Nao e trabalho do blueprint de ad** — um ad generico com headline+CTA nao substitui o mockup do print.
- Video (skill `video-ad-specialist`), captions/titulos/hashtags (skill `copywriter-agent`), hosting/publicacao (skill `distribution-agent`).

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

- O agente gera `ads/ad.html` (com o CSS **inline**, num `<style>`) a partir do concept.
- Renderiza com **Playwright** (`chromium.launch()` headless) -> screenshot PNG no tamanho exato.
- `canvas.getContext("2d")` + `toDataURL()` + `link.click()` (metodo antigo) **nao e usado** — nao roda no pipeline headless. Ignore esse caminho mesmo se aparecer em docs antigos.

## CRITICAL: antes de gerar qualquer design

Carregue, nesta ordem, os knowledge files:

1. `knowledge/brand_identity.md` -> Visual Identity, Color Palette/Rules, Photography, **Pilares de Conteudo**, CTAs aprovados, concorrentes proibidos.
2. `knowledge/product_campaign.md` -> Campanha Taxa Zero (numeros), headlines aprovadas, selling points, visual assets.
3. `knowledge/platform_guidelines.md` -> specs por formato, design rules, margem segura.

**Pesquisa:** hoje a pesquisa ao vivo (Tavily) e opt-in pelo painel (`interface/lib/research.js`), entra direto no prompt de geracao e deixa rastro em `status.json.research_sources`. O arquivo `research_results.json` e **legado do caminho CLI** e pode nao existir — se existir, extraia `ad_hooks` e `selected_campaign_angle` e ancore o criativo neles.

## Inputs

| Input | Exemplo | Obrigatorio |
|-------|---------|-------------|
| **Pilar de conteudo** | `taxa_zero`, `educacional`, `curiosidade_mercado`, `prova_plataforma`, `novidade`, `motivacional` | Sim — perguntar se ausente |
| Tema/brief da peca | "o custo invisivel do parcelamento" | Sim |
| Target audience | Produtor estabelecido (R$ 50k+/mes) | Inferir se ausente |
| Formato | `1080x1080` (Imagem/Anuncio) ou `1080x1350` (feed 4:5) | Inferir `1080x1080` |
| Template de arte | `editorial`, `bold`, `split`, `photo` | Inferir por objetivo |
| Foto de fundo | caminho do acervo (`/uploads/...`) ou URL | So no template `photo` |

**Defaults:** audience = Produtor Estabelecido; formato = 1080x1080; template = `editorial`; **sem CTA** (o padrao do painel e nao forcar chamada). Sempre declare os defaults assumidos.

> **O pilar define o TEMA — Taxa Zero nao e default.** O painel modela a variedade real do feed em 6 pilares (`interface/lib/config.js`, `CONTENT_PILLARS`) e injeta no prompt a regra: *"NEM toda peca e sobre Taxa Zero. Respeite o pilar como eixo tematico, ainda que a campanha ativa exista."* O campo `eyebrow` do concept deve refletir o pilar (ex.: "Curiosidade de mercado", "Mentalidade"), nao a campanha.

---

## Step 1: Selecionar o template de arte

Sao **4 templates reais** (`interface/lib/render.js`, `TEMPLATES`; validados em `interface/lib/content.js`, `VALID_TEMPLATES`). Nao invente ids — `pickTemplate` cai silenciosamente em `editorial` se o valor nao existir.

| Template (id) | Rotulo na UI | Estrutura | Quando usar |
|----------|-----------|-----------|-------------|
| `editorial` | Editorial | Gradiente radial azul + Selet Dots; logo no topo, headline a esquerda, CTA embaixo | Padrao. Oferta/feature direta, texto com respiro |
| `bold` | Destaque | Fundo escuro solido, tudo centralizado, simbolo "4" como marca d'agua | Headline curta number-forward ("0%", "95%", "Os 4 numeros") |
| `split` | Dividido | Faixa clara com logo + faixa escura com o conteudo | Comparativo, antes/depois, dois blocos de leitura |
| `photo` | Foto | Imagem de fundo (acervo ou Pexels) com scrim e texto por cima | Peca com foto, clima/mood, institucional |

## Step 2: Escrever a copy do criativo

- **Eyebrow:** rotulo curto que ancora o **pilar** (ex.: "Curiosidade de mercado", "Campanha Taxa Zero").
- **Headline:** ate ~4 palavras, Inter Bold/Black. Quando o pilar for de oferta ou prova, lidere com o numero-ancora (*"0% de taxa."*, *"95% de aprovacao."*).
- **Subtext:** 1 frase com a regra completa/prova (ex.: *"Por 3 meses ou ate R$ 300 mil. R$ 1,99 por transacao."*).
- **CTA (opcional — padrao e sem CTA):** so quando a peca tem intencao de conversao ou o brief pede. Lista canonica de 9: *Solicitar convite · Ver as condicoes · Conhecer a plataforma · Migrar minha operacao · Calcular minha economia · Falar com o time · Acessar o material · Ler o playbook · Ver como funciona*.
- **Badge (opcional):** pilula curta no canto superior (ex.: "TAXA ZERO", "NOVO").

> **REGRA DURA — nao assine a peca com a frase-tag.** *"Para quem sabe que e Selet."* nao entra como rodape, fecho, assinatura, headline ou subtext. So se o brief pedir explicitamente. Nao existe mais rodape automatico nas artes (`DEFAULT_FOOTER = ""` em `interface/lib/render.js`).

## Step 3: Gerar o concept JSON (o blueprint)

Salve em **`ads/concept.json`** (este e o arquivo que o painel e o pipeline leem — `interface/lib/config.js`, tipo `ad_creative`). O schema e **plano**, sem `elements[]`:

```json
{
  "eyebrow": "CURIOSIDADE DE MERCADO",
  "headline": "0% de taxa.",
  "subtext": "Por 3 meses ou até R$ 300 mil em vendas. R$ 1,99 por transação. PIX em D+10.",
  "cta": "",
  "badge": "TAXA ZERO",
  "image": "/uploads/acervo_produtor_retrato.jpg",
  "layout_type": "editorial",
  "visual_direction": "Gradiente radial azul, Selet Dots 6-10%, headline a esquerda com respiro",
  "notes": "Pilar taxa_zero; numero-ancora na headline, regra completa no subtext"
}
```

Campos que o render **consome de verdade**: `eyebrow`, `headline`, `subtext`, `cta`, `badge`, `image`. Sobre os demais:

- `image` — caminho do acervo (`/uploads/...`) ou URL. E o que alimenta o template `photo`. O render reescreve os prefixos `/uploads/` e `/assets/` para o diretorio local do ambiente (`relocalizeAssets`), entao **nao** use caminho relativo tipo `../../assets/`.
- `layout_type` e `visual_direction` sao **metadados de racional** (aparecem no painel como texto livre), nao instrucoes de render.
- **Nao existem** `width`, `height`, `background`, `palette` nem `elements[]` no contrato — se voce escrever, ninguem le. O tamanho do PNG vem do render (`renderImage` e fixo em 1080x1080), nao do JSON.
- Para realcar uma palavra na headline em azul, use `==palavra==` (o render converte em `<span class="accent">`).

## Step 4: Gerar ads/ad.html

Converta o concept em **`ads/ad.html`**, um arquivo **auto-contido**, no tamanho exato do formato.

Requisitos duros (nao sao estetica — o painel depende deles):

- **CSS sempre inline**, num `<style>` no `<head>`. **Nao existe `styles.css`** no fluxo atual: `sanitizeArtHtml()` remove todo `<link>` que nao seja de fonte do Google, entao um `<link rel="stylesheet" href="styles.css">` simplesmente some e a arte re-renderiza sem estilo.
- **Obrigatorio** declarar as dimensoes em `html,body`: `html,body { width:1080px; height:1080px; }`. O painel extrai o tamanho da peca exatamente desse trecho (`_pngBaseDims`); sem ele, salvar do editor visual falha com `E_NO_DIMS`.
- Container `.card` (nao `.ad-container`), com `position:relative; overflow:hidden` e as mesmas dimensoes.
- CTA como **`<span class="cta">`** (nao `<button>`), background Selet Blue.
- Fontes via Google Fonts no `<head>` (o render headless busca da CDN):
  `https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap`
- **Inter** para headline/subtext/CTA; **JetBrains Mono** para eyebrow/badge/labels.
- Background da paleta + **Selet Dots** 6–10% opacity (`radial-gradient` dot pattern).
- Margem segura **88–104px** (~96px em 1080x1080) — e o que os templates de producao usam.
- Logo: `<img class="logo">` apontando para o arquivo oficial. **Padrao = wordmark completo**; o simbolo isolado (`assets/simbolo-selo.png`) so quando a peca escolhe "So o simbolo". Screenshots da plataforma sempre com dados mascarados. O renderer aguarda as `<img>` decodificarem antes do screenshot.

Recorte fiel ao `tplEditorial` (a referencia canonica esta em `interface/lib/render.js`):

```html
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1080px; height:1080px; }
  .card { position:relative; width:1080px; height:1080px; overflow:hidden;
    background: radial-gradient(120% 120% at 80% 10%, #006494 0%, #003554 42%, #07212B 100%);
    color:#D9DCD6; font-family:'Inter',sans-serif;
    display:flex; flex-direction:column; justify-content:space-between; padding:96px 92px; }
  .dots { position:absolute; inset:0;
    background-image: radial-gradient(#5499B522 2px, transparent 2px);
    background-size:46px 46px; opacity:.5; }
  .eyebrow { font-family:'JetBrains Mono',monospace; color:#5499B5; font-size:32px;
    letter-spacing:3px; text-transform:uppercase; margin-bottom:30px; }
  .headline { font-weight:700; font-size:168px; line-height:.98; color:#FFFFFF; letter-spacing:-2px; }
  .headline .accent { color:#5499B5; font-weight:900; }
  .subtext { margin-top:36px; font-size:40px; line-height:1.34; color:#AFBCC9; max-width:90%; }
  .cta { font-weight:800; font-size:36px; background:#006494; color:#FFFFFF;
    padding:26px 48px; border-radius:999px; }
</style></head>
<body><div class="card"><div class="dots"></div>
  <div class="top"><img class="logo" src="file:///.../assets/logo-4selet-light.png" alt="4Selet" style="height:54px"/></div>
  <div class="mid">
    <div class="eyebrow">CAMPANHA TAXA ZERO</div>
    <div class="headline"><span class="accent">0%</span> de taxa.</div>
    <div class="subtext">Por 3 meses ou até R$ 300 mil. R$ 1,99 por transação.</div>
  </div>
  <div class="bottom"><span class="cta">Solicitar convite →</span></div>
</div></body></html>
```

> **Branco puro:** `#FFFFFF` e permitido como **texto** sobre fundo Navy/Darker (e o que os templates fazem em headline e CTA). Como **fundo/card**, use Selet Cloud `#D9DCD6`.

## Step 5: Renderizar PNG via Playwright

Use o renderer **canonico do projeto**, na raiz (Chromium ja instalado via `npx playwright install chromium`):

```bash
node scripts/render_ad.js outputs/<task_name>_<date>/ads/ad.html outputs/<task_name>_<date>/ads/ad.png 1080 1080 2
```

- O 5o argumento e o **`scale`** (deviceScaleFactor). **O padrao das artes finais e `2`** (PNG de 2160px) — e o que o painel usa (`RENDER_SCALE=2`). Renderizar em 1x entrega uma peca visivelmente menos nitida que as do painel.
- `RENDER_STRICT_NET=1` bloqueia rede (protecao SSRF) — use ao renderizar HTML nao confiavel, como HTML vindo do editor visual.
- Nomear o PNG como `ad.png` (ou `feed.png` / `slide_N.png`) importa: o script so emite os sidecars de edicao (`<nome>.editable.json` + `<nome>.bg.png`) para esses nomes. Um `instagram_ad.png` fica sem o pipeline de edicao.
- A copia `skills/ad-creative-designer/scripts/render_ad.js` e um **fallback offline desatualizado** (4 argumentos, scale fixo em 1, sem strict-net, sem sidecars). Prefira sempre `scripts/render_ad.js` da raiz.

**Sempre inspecione o PNG resultante** (abra/leia a imagem) antes de considerar pronto — render OK nao garante layout correto.

## Step 6: Output storage

Salve tudo em `outputs/<task_name>_<date>/ads/`:

```
ads/
├── concept.json       ← blueprint (o que o painel/pipeline leem)
├── ad.html            ← arte em HTML, CSS inline
├── ad.png             ← render final (Playwright, scale 2)
├── ad.editable.json   ← sidecar de edicao (gerado pelo render_ad.js)
└── ad.bg.png          ← sidecar de fundo (gerado pelo render_ad.js)
```

Variantes de marca por peca (logo `light`/`dark`/`symbol` e marca d'agua `word`/`symbol`/`outline`/`none`/`canto`/`padrao`) ficam em **`render.json` na raiz da task**, nao no concept.

Nenhum arquivo gerado fora de `outputs/`.

---

## Formatos

| Contexto | Dimensoes | Arquivo |
|--------------|-----------|-----|
| Imagem / Anuncio (`ad_creative`) | 1080×1080 | `ads/ad.png` |
| Feed 4:5 (`instagram_caption`) | 1080×1350 | `ads/feed.png` |
| Carrossel (`instagram_carousel`) | 1080×1350 por slide | `slides/slide_N.png` |
| 4Selet na Midia (`media_mention`) | 4:5 · 1:1 · 9:16 · 16:9 | `ads/{feed,square,story,media_16x9}.png` |

Story 9:16 e thumbnail de YouTube **nao fazem parte do fluxo de producao** da peca estatica: nao existe tipo de conteudo de YouTube na taxonomia atual e nao ha publicacao no YouTube. Se alguem pedir, trate como peca avulsa fora do painel e diga isso.

## Brand Guardrails (4Selet) — checar antes de finalizar

- **Frase-tag:** **nunca** assinar a peca com *"Para quem sabe que e Selet."* — regra dura (GOVERNANCE em `interface/lib/prompts.js`). So se o brief pedir.
- **Pilar:** o tema da peca segue o pilar escolhido; Taxa Zero e um pilar entre seis, nao o default.
- **Cores:** paleta oficial. **Sem preto puro**, sem neon, sem gradiente quente. Branco puro so como texto sobre fundo escuro. Selet Blue aparece em toda peca.
- **Tipografia:** Inter (headline/body/CTA) + JetBrains Mono (labels/dados). **Nunca Playfair, DM Sans, Arial, Roboto ou system fonts**.
- **Logo:** `logo-4selet-light.png` em fundos escuros, `logo-4selet.png` em fundos claros; padrao e o wordmark completo. Nunca esticar/distorcer/recriar a wordmark.
- **CTAs aprovados (9):** Solicitar convite · Ver as condicoes · Conhecer a plataforma · Migrar minha operacao · Calcular minha economia · Falar com o time · Acessar o material · Ler o playbook · Ver como funciona. Proibidos: "Compre ja!", "Ultima chance!", urgencia fake.
- **Foto:** foto de banco (Pexels) e do acervo e permitida no template `photo`, sempre tratada na marca (dessaturada, tint Navy/Darker, scrim de leitura) e como **fundo**, nunca como assunto. Evitar o cliche corporativo (aperto de mao, executivo sorrindo).
- **Numeros Taxa Zero (precisao):** 0% por **3 meses OU ate R$ 300 mil**; R$ 1,99/transacao; PIX D+10; cartao D+30; prova 95% aprovacao. Nunca "0% pra sempre" / "100% gratis".
- **Concorrentes:** nunca citar Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay — mercado so em abstrato ("~7,9%").
- **Screenshots da plataforma:** sempre com dados mascarados (`c••••@email.com`, `pur_XXX•••••XXX`).
- **Tom:** sobrio, premium, espaco negativo ativo. Sem estetica guru/hype.

## Examples

### Example 1: Ad quadrado Taxa Zero (editorial)
**Usuario:** "Cria um ad de Instagram da Taxa Zero." -> pilar `taxa_zero`, template `editorial`, 1080x1080; headline "0% de taxa.", subtext com a regra completa, badge "TAXA ZERO", CTA "Solicitar convite" (peca de conversao). Sem rodape/tagline. Render com scale 2. Inspecionar PNG.

### Example 2: Comparativo (split)
**Usuario:** "Ad mostrando a diferenca de taxa vs mercado." -> pilar `curiosidade_mercado`, template `split`: bloco de texto + numero-ancora "7,9%" (mercado, em abstrato) vs "0%" em Selet Blue. Sem citar concorrente. Sem CTA forcado.

### Example 3: Peca com foto (photo)
**Usuario:** "Faz uma peca de mentalidade com foto." -> pilar `motivacional`, template `photo`, `concept.image` apontando para o acervo (`/uploads/...`) ou foto buscada no Pexels; texto curto com scrim de leitura; eyebrow "Mentalidade"; sem CTA.

### Example 4: Inputs faltando
**Usuario:** "Faz um criativo da 4Selet." -> perguntar o **pilar** (e o tema); aplicar os demais defaults, **declara-los**, gerar concept + render.

## Troubleshooting

### Fontes erradas / serifadas no PNG
**Cause:** Google Fonts nao carregou antes do screenshot. **Solution:** `<link>` das fontes no `<head>`; o script aguarda `document.fonts.ready`. Atencao: com `RENDER_STRICT_NET=1` a rede e bloqueada e a fonte nao carrega — use strict-net so para HTML nao confiavel.

### PNG com tamanho/recorte errado
**Cause:** viewport != formato, ou conteudo transbordando. **Solution:** passar `width height` corretos ao `render_ad.js`; `html,body` e `.card` com dimensoes exatas e `overflow: hidden`.

### "origem (HTML) da peca nao encontrada para editar" (`E_NO_SOURCE_HTML`)
**Cause:** o editor visual deriva o HTML trocando `.png` por `.html`. Se o PNG se chama `instagram_ad.png`, ele procura `instagram_ad.html`. **Solution:** nomear o par como `ad.html` + `ad.png`.

### "nao foi possivel ler as dimensoes do HTML editado" (`E_NO_DIMS`)
**Cause:** falta a regra `html,body { width:Npx; height:Npx }` no `<style>`. **Solution:** declarar as dimensoes exatamente nesse seletor.

### Arte re-renderiza sem estilo
**Cause:** CSS em arquivo separado — o `<link>` foi removido no saneamento. **Solution:** CSS inline no `<style>`.

### Peca "perdeu a copy" ao gerar arte final
**Cause:** o blueprint foi salvo como `ads/layout.json`. O render le `ads/concept.json` e cai nos fallbacks (headline vira "4Selet."). **Solution:** salvar em `ads/concept.json`.

### Cor off-brand / concorrente citado / CTA proibido
**Solution:** rodar o checklist; corrigir antes de entregar.

## Quality Checklist

- [ ] Knowledge files carregados (brand_identity, product_campaign, platform_guidelines)
- [ ] **Pilar de conteudo** definido e refletido no eyebrow (Taxa Zero nao e default)
- [ ] Template escolhido entre os 4 reais (`editorial`/`bold`/`split`/`photo`)
- [ ] Headline curta; CTA so quando faz sentido (padrao: sem CTA), grafia canonica
- [ ] **Nenhuma assinatura com a frase-tag** "Para quem sabe que e Selet."
- [ ] `ads/concept.json` (schema plano) + `ads/ad.html` (CSS inline, `html,body` com dimensoes, `.card`, `<span class="cta">`)
- [ ] Paleta oficial (sem preto puro/neon; branco so como texto), Inter + JetBrains Mono
- [ ] Numeros Taxa Zero corretos; nenhum concorrente citado; screenshots mascarados
- [ ] `ads/ad.png` renderizado via `scripts/render_ad.js` com **scale 2** e **inspecionado visualmente**
- [ ] Tudo salvo em `outputs/<task_name>_<date>/ads/`

## Relacionamento com outras skills

```
Research (painel: Tavily no prompt · CLI: research_results.json legado)
   → Ad Creative Designer (esta skill) → ads/{concept.json, ad.html, ad.png}
   → Distribution Agent (publicacao no painel, atras do gate R5)
```

O `concept.json` (blueprint) e a fonte de verdade do design; `ad.html` o materializa; o PNG e o asset final publicavel. Aparicao na imprensa nao passa por aqui — vai para o tipo `media_mention` ("4Selet na Midia").

## Performance Notes

- Qualidade > velocidade. Nao pule a leitura dos knowledge files nem a inspecao do PNG.
- Quando o pilar for de oferta ou prova, lidere com o **numero-ancora**, depois explique.
- Na duvida sobre layout/cor, ancore nas Design Rules de `platform_guidelines.md` e na paleta de `brand_identity.md`.
