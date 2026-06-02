# 4Selet — Kit de Identidade Visual

Conjunto de assets visuais da marca 4Selet em alta resolução, para uso direto pelos agentes de marketing (Ad Creative Designer, Video Ad Specialist, Distribution) e pelo time humano. Todas as peças seguem o brandbook v2 — paleta oficial, tipografia Inter e o motif de "Selet Dots".

> **Referência cruzada:** `knowledge/brand_identity.md` (regras), `knowledge/product_campaign.md` (produto) e `knowledge/platform_guidelines.md` (specs por plataforma).

---

## Estrutura

```
brand-identity/
├── 01-logos/                  Logos oficiais + showcases
├── 02-cores/                  Paleta (board + swatches individuais)
├── 03-tipografia/             Specimen da fonte Inter
├── 04-texturas-padroes/       Padrões "Selet Dots" tileáveis
├── 05-fundos/                 Fundos prontos (gradientes) em vários formatos
├── 06-social-templates/       Frames sociais com logo + área segura
├── _html/                     Gerador (generate.js + manifest.json) — para recriar/editar
└── README.md
```

---

## 01 — Logos

| Arquivo | Uso |
| ----- | ----- |
| `logo-4selet.png` | Logo completo **dark** — para fundos claros |
| `logo-4selet-light.png` | Logo completo **light** — para fundos escuros (uso principal) |
| `logo-4selet.svg` | Versão vetorial escalável |
| `simbolo.svg` | Símbolo "4" isolado — favicon, monograma, watermark, pattern |
| `logo-showcase-navy-1x1.png` | Logo light aplicado sobre fundo navy (1080×1080) — demonstração |
| `logo-showcase-cloud-1x1.png` | Logo dark sobre fundo claro (1080×1080) — demonstração |
| `simbolo-showcase-1x1.png` | Símbolo em cartão com gradiente azul (1080×1080) |

**Regras (do brandbook):** nunca esticar, rotacionar, aplicar efeitos/sombra/borda. Espaço livre mínimo = altura do "4". Light em fundo escuro, dark em fundo claro.

## 02 — Cores

| Arquivo | Conteúdo |
| ----- | ----- |
| `palette-board.png` | Board completo (1800×1100) — 6 cores de marca + 3 funcionais com HEX/RGB |
| `swatch-darker.png` · `swatch-navy.png` · `swatch-blue.png` · `swatch-sky.png` · `swatch-mist.png` · `swatch-cloud.png` | Swatch individual de cada cor (800×800) com HEX/RGB |

Paleta: Darker `#07212B` · Navy `#003554` · Blue `#006494` · Sky `#5499B5` · Mist `#AFBCC9` · Cloud `#D9DCD6`. Funcionais (só status): Sucesso `#16A34A` · Alerta `#D97706` · Erro `#DC2626`.

## 03 — Tipografia

| Arquivo | Conteúdo |
| ----- | ----- |
| `inter-specimen.png` | Specimen da **Inter** (1800×1100) — alfabeto, números, pesos (Light/Medium/Bold/Black) e JetBrains Mono para snippets |

## 04 — Texturas e Padrões

| Arquivo | Uso |
| ----- | ----- |
| `dots-navy.png` | Selet Dots sobre fundo Navy (1080×1080) |
| `dots-darker.png` | Selet Dots sobre fundo Darker (1080×1080) |
| `dots-blue-on-cloud.png` | Dots azuis sobre fundo claro (1080×1080) |

Use como camada de profundidade sutil — nunca como decoração principal.

## 05 — Fundos prontos (canvas para criativos)

Gradientes oficiais com watermark sutil do símbolo + dots mascarados. **Prontos para receber texto/elementos por cima.**

| Arquivo | Dimensões | Formato |
| ----- | ----- | ----- |
| `bg-navy-1x1.png` | 1080×1080 | Feed quadrado |
| `bg-navy-4x5.png` | 1080×1350 | Feed retrato |
| `bg-navy-9x16.png` | 1080×1920 | Story/Reel |
| `bg-navy-16x9.png` | 1920×1080 | YouTube/LinkedIn vídeo |
| `bg-darker-1x1.png` | 1080×1080 | Feed quadrado (mais sóbrio) |
| `bg-darker-9x16.png` | 1080×1920 | Story (mais sóbrio) |
| `bg-darker-16x9.png` | 1920×1080 | Vídeo (mais sóbrio) |
| `bg-blue-radial-1x1.png` | 1080×1080 | Destaque/hero vívido |
| `bg-cloud-1x1.png` | 1080×1080 | Fundo claro |
| `bg-cloud-4x5.png` | 1080×1350 | Fundo claro retrato |

## 06 — Templates sociais

Frames com logo, área segura demarcada (linha tracejada) e label do formato. Servem de **base de composição** para o Ad Creative Designer.

| Arquivo | Plataforma | Dimensões |
| ----- | ----- | ----- |
| `template-instagram-feed-4x5.png` | Instagram Feed | 1080×1350 |
| `template-instagram-square-1x1.png` | Instagram Feed | 1080×1080 |
| `template-instagram-story-9x16.png` | Instagram Story/Reel | 1080×1920 |
| `template-linkedin-1x1.png` | LinkedIn | 1200×1200 |
| `template-youtube-thumb-16x9.png` | YouTube Thumb | 1280×720 |

> A linha tracejada de "área segura" é apenas **guia** — não deve aparecer no material final. É referência para o agente posicionar o conteúdo.

---

## Como regenerar / editar o kit

Os assets são gerados via HTML→PNG (Chrome headless). Para recriar ou editar:

```bash
# 1. copiar os logos para _html/ (simbolo.svg, logo-4selet.png, logo-4selet-light.png)
# 2. gerar os HTMLs + manifest
node _html/generate.js
# 3. renderizar cada item do manifest com Chrome headless no tamanho indicado
#    (window-size = w,h do manifest.json · --virtual-time-budget=4000)
```

Editar cores, textos ou formatos no `_html/generate.js` e rodar de novo.

---

*Kit gerado em Maio/2026 · 31 imagens · alta resolução · paleta e tipografia conforme brandbook v2 da 4Selet*
