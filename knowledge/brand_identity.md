# **4Selet — Brand Identity Guide**

*Versão 1.3 · Agosto/2026 · Knowledge file consumido pelo **painel web** (`interface/lib/knowledge.js` → `interface/lib/prompts.js`, injetado no system prompt de TODOS os 7 tipos de conteúdo) e pelas **skills dos 5 agentes** (Research, Ad Creative, Video Ad, Copywriter, Distribution)*

> **Propósito:** Este documento define a identidade da marca 4Selet para ser usada em **toda peça gerada pelos agentes** — texto, imagem, vídeo, e-mail e metadata de publicação. Sempre referenciar antes de qualquer geração.

> **Atenção — este arquivo entra literalmente no prompt de produção.** O painel (`https://mkt.4st.co`) concatena este documento no system prompt de cada geração. Qualquer regra escrita aqui vira instrução direta para a IA, e qualquer divergência em relação ao bloco GOVERNANCE de `interface/lib/prompts.js` chega ao modelo como ordem contraditória. Ao editar, conferir os dois lados.

> **O que mudou na v1.3 (Agosto/2026) — revisão adversarial contra o código:** duas **ordens contraditórias** que chegavam juntas ao modelo foram resolvidas (branco puro; e a regra de variedade que não entrava quando ninguém escolhia pilar). Além disso: JetBrains Mono deixou de ser "exceção técnica" e assumiu o papel real de fonte dos rótulos estruturais; a tipografia ganhou **escala por meio** (os números antigos eram de tela web e a IA os copiava para artes de 1080px); "Selet Blue em toda peça" virou condicional (no template *Foto* sem CTA não existe azul); `logo-4selet.svg` foi marcado como legado (o arquivo viola três regras deste próprio documento); os neutros de mockup viraram regra **por elemento** em vez de lista fechada; e os emojis de marcação (`Sim`/`Não`) saíram do texto, já que ele entra literal num prompt que proíbe emoji.
>
> **O que mudou na v1.2 (Julho/2026):** a frase-tag *"Para quem sabe que é Selet."* deixou de ser assinatura automática de peça (regra dura — ver Sample Copy); nova seção **Pilares de conteúdo** (o eixo temático real das peças, distinto das 5 colunas estratégicas); nova seção **4Selet na Mídia** (prova social de aparição na imprensa); fotografia de banco (Pexels) passou a ser **permitida com tratamento de marca**; regra de branco puro reescrita por escopo (texto x fundo); `#TaxaZero` virou hashtag **condicional ao pilar**.
>
> **O que veio da v1.1:** três frases-tag no Sample Copy, *Social caption institucional* e a lista fechada de concorrentes proibidos em criativos abertos (Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay).

---

## **Brand Overview**

**4Selet** é a plataforma brasileira de pagamentos e venda de infoprodutos construída para quem opera com seriedade no digital. Não é mais uma "ferramenta para empreendedor iniciante" — é a infraestrutura escolhida por produtores que tratam o negócio digital como negócio de verdade.

Fundada em **2022** por **Fabricio Gonçalves** — referência nacional no mercado de trade no Brasil — junto com o sócio **Hugo Belo**, a 4Selet nasceu da insatisfação do próprio Fabricio com as plataformas existentes. Taxas que comiam a margem, prazos incoerentes, suporte impessoal, gateways instáveis. Em vez de aceitar, ele construiu a plataforma que ele próprio queria usar — para si e para o círculo de produtores sérios que conhecia.

Esse DNA permanece. A entrada na 4Selet **é por convite**: novos produtores só conseguem criar conta na plataforma quando recebem o aceite de alguém que já está lá dentro. O nome **Selet** vem exatamente daí — uma plataforma para **seletos**.

**Importante:** estamos atualmente em uma fase de campanhas (Taxa Zero ativa) com objetivo de **trazer mais pessoas qualificadas para dentro**, expandindo a base de produtores sem abrir mão da curadoria. Toda comunicação reforça a exclusividade — mas convida.

---

## **Brand Essence**

*"Para quem sabe que é Selet."*

A 4Selet ocupa uma posição rara no mercado de plataformas: a profundidade técnica de quem opera em produção todos os dias, a sobriedade de quem prioriza estabilidade sobre marketing barulhento, e a transparência de quem se posiciona como **parceria** — não como fornecedor. Não somos a maior plataforma do Brasil. Somos a plataforma de quem está pronto para crescer com seriedade.

Cada decisão de produto, cada linha de suporte, cada vírgula de comunicação carrega a mesma promessa: **proteção, estrutura e controle** para o produtor que entende que digital não é loteria — é operação.

---

## **Mission**

Oferecer um ambiente de pagamentos de alto nível — com **segurança, precisão e eficiência** — que garanta previsibilidade em cada etapa da operação do produtor digital. Não vendemos solução mágica: entregamos infraestrutura confiável, multi-adquirência inteligente e suporte próximo de quem entende como o mercado funciona de verdade.

---

## **Vision**

Ser reconhecida como a plataforma de pagamentos respeitada e confiável do mercado digital brasileiro — referência absoluta para produtores que operam com seriedade e buscam escala sustentável. Onde "estar na 4Selet" é, em si, um sinal de maturidade no mercado.

---

## **Core Values**

A 4Selet se sustenta em cinco colunas estratégicas oficiais — extraídas do brandbook e aplicadas em cada decisão de produto, atendimento e comunicação. **Os agentes devem ancorar copy e visual em pelo menos uma destas colunas.**

| Coluna | O que significa pra 4Selet |
| ----- | ----- |
| **Experiência / Usabilidade — Fácil** | Funciona sem ruído. Simples de usar, estável, feita para **não atrapalhar o crescimento do produtor**. Tela limpa, fluxo claro, zero fricção desnecessária. |
| **Lucratividade — Rentável** | Soluções que **reduzem custos, ampliam margens e aceleram resultados**. Não é desconto pontual — é arquitetura financeira pensada para o produtor ganhar mais. |
| **Sabedoria — Plataforma estratégica** | Ajudamos o produtor a entender o digital, a plataforma e a lógica do negócio. **Educamos enquanto entregamos**. |
| **Exclusividade — Não é pra todo mundo** | Construímos com quem está pronto para crescer. O **convite é parte da promessa**. |
| **Segurança Inegociável** | Confiabilidade, previsibilidade e proteção são a base de todo relacionamento. **Não negociamos isso por marketing, por preço ou por velocidade.** |

---

## **Pilares de Conteúdo (eixo temático da peça)**

As 5 colunas acima são o que a marca **é**. Os pilares abaixo são o que cada peça **fala** — o eixo temático escolhido a cada geração. São coisas diferentes e convivem: uma peça do pilar *Educacional* continua ancorada na coluna *Sabedoria*.

Fonte de verdade em código: `interface/lib/config.js` (`CONTENT_PILLARS`). O pilar escolhido é gravado no `status.json` da peça e o ângulo correspondente é injetado no prompt de geração (`interface/lib/prompts.js`). Vale para **todos os formatos** — feed, carrossel, imagem/anúncio, 4Selet na Mídia, vídeo, LinkedIn, Threads/X.

| Pilar (`id`) | Ângulo |
| ----- | ----- |
| **Campanha Taxa Zero** (`taxa_zero`) | A oferta ativa como assunto central: 0% de taxa da plataforma por 3 meses ou até R$ 300 mil em vendas, R$ 1,99 fixo por transação, PIX D+10, cartão D+30. Exclusividade por convite e transparência total sobre as condições. |
| **Educacional** (`educacional`) | Ensina algo de valor real ao produtor estabelecido (estratégia, gestão, finanças do negócio digital, recomendação de livro/playbook). A marca aparece como autoridade que educa. **Sem empurrar oferta** — CTA suave de relacionamento ou nenhum. |
| **Curiosidade de mercado** (`curiosidade_mercado`) | Dado ou curiosidade pouco óbvia sobre plataformas, checkout e juros do parcelamento. Provoca reflexão com número específico. Mercado sempre em abstrato — nunca citar concorrente. |
| **Prova da plataforma** (`prova_plataforma`) | Diferenciais concretos e verificáveis: 95%+ de aprovação no cartão, prazos, gestor de conta dedicado, checkout, redundância. Tom de quem mostra resultado, não de quem promete. |
| **Novidade** (`novidade`) | Lançamento/atualização da plataforma ou movimento do mercado que afeta o produtor. Foco no que muda na prática para a operação. |
| **Motivacional / estratégico** (`motivacional`) | Mentalidade e decisão de longo prazo do produtor sério. Sóbrio e estruturado — a inspiração vem de um raciocínio concreto, nunca de motivação vazia. |

**Regra de variedade (dura).** *"Mantenha a variedade real do feed 4Selet: NEM toda peça é sobre Taxa Zero. Respeite o pilar como eixo temático, ainda que a campanha ativa exista."* Taxa Zero é **um** pilar entre seis, não o padrão universal.

> Detalhe que já custou caro: escolher pilar é **opcional** no painel. Enquanto essa regra vivia só no bloco do pilar, quem não escolhia recebia apenas o lembrete da campanha ativa e nenhum contrapeso — era a origem mecânica do "tudo vira Taxa Zero". A regra passou para o bloco `GOVERNANCE` de `interface/lib/prompts.js`, que entra em **toda** geração, com ou sem pilar.

---

## **Target Audience**

### **Primário: O Produtor Estabelecido**

* Já fatura **R$ 50 mil ou mais por mês** vendendo infoprodutos ou serviços digitais
* Usa Hotmart, Kiwify, Eduzz ou Ticto — e está **insatisfeito com taxas, prazos ou suporte**
* Trata o negócio digital como **operação séria**, não como bico ou experimento
* Tem estrutura mínima (equipe, processos, financeiro) e quer plataforma que acompanhe esse nível
* Valoriza **previsibilidade > novidade**. Quer saber exatamente quando o dinheiro cai e quanto sai de taxa
* Está entre 30 e 50 anos, decisor, com background de profissional liberal, mercado financeiro, marketing digital, agência ou negócio próprio fora do digital
* **Mais sensível a estabilidade e suporte do que a preço** — embora preço importe quando o volume cresce

### **Secundário: O Produtor em Escala**

* Faturamento entre **R$ 20 mil e R$ 50 mil/mês**, estruturando o negócio
* Não veio do "boom" do marketing digital — veio de uma carreira sólida e está digitalizando
* Quer plataforma que **cresça junto**, sem precisar trocar tudo daqui a 6 meses
* Já entendeu que ferramenta barata sai cara — está pronto para investir em infraestrutura

### **Quem NÃO é o público da 4Selet** (não direcionar criativos para)

* Quem está começando absolutamente do zero, sem produto, sem audiência, sem clareza
* Quem busca "plataforma que faz tudo sozinho" ou promessa de faturamento mágico
* Quem prioriza taxa baixa acima de qualquer coisa, sem se importar com estabilidade ou suporte

---

## **Brand Personality**

A 4Selet fala como um **sócio experiente do produtor** — alguém que já viu todos os problemas que ele vai enfrentar, sabe exatamente como resolver, e está do lado dele. Não é o guru. Não é o vendedor. É a estrutura confiável que **resolve com firmeza e transparência**.

**Três palavras:** *Sóbrio. Estruturado. Estrategista.*

Se a 4Selet fosse uma pessoa: um sócio mais velho que abre a planilha, mostra o fluxo de caixa real, aponta o gargalo, propõe a solução — e cobra resultado. Sem motivação vazia, sem pressa fabricada, sem promessa que não cumpre.

### **Arquétipos da marca**

A 4Selet opera com dois arquétipos complementares. **O Governante lidera; o Criador entra quando o tema é construir/criar.**

| Arquétipo | Quando aparece |
| ----- | ----- |
| **O Governante** (primário) | Em tudo que envolve **segurança, estrutura, previsibilidade**. Comunicações sobre antifraude, multi-adquirência, prazos, suporte, decisões da plataforma. Postura firme, mas acolhedora. Transparência sobre processos. |
| **O Criador** (secundário) | Em tudo que envolve **possibilidades, autonomia, construção**. Comunicações sobre área de membros customizável, novos produtos, conquistas do produtor, novos recursos. Apresenta caminhos, organiza o caos criativo em processos simples. |

---

## **Visual Identity**

### **Philosophy**

A identidade visual da 4Selet é **sólida, técnica, premium, sem ruído**. A estética evoca **azul profundo, estrutura geométrica e respiro tipográfico** — nunca neon, nunca infantil, nunca decoração gratuita.

Inspiração visual:
* A profundidade do azul-marinho aplicado em interfaces financeiras sérias
* A sobriedade técnica de dashboards, terminais e ferramentas profissionais
* O contraste entre tons azuis frios e o respiro do espaço negativo
* O motif de **pontos azuis** (referência ao logo) usado como assinatura visual

---

### **Logo**

* **Símbolo:** "4" estilizado dentro de um quadrado de cantos arredondados, em azul marinho oficial
* **Wordmark:** "SELET" em letras maiúsculas, sans-serif
* **Primary lockup:** Símbolo + wordmark lado a lado
* **Light variant** (`logo-4selet-light.png`): Para fundos escuros — símbolo e texto em tons claros
* **Dark variant** (`logo-4selet.png`): Para fundos claros — símbolo em azul oficial, texto em tom escuro
* **Vetorial do lockup** (`logo-4selet.svg`): **LEGADO — não usar.** O arquivo é uma reconstrução (símbolo em Selet Sky e wordmark redesenhada com fallback Arial) e viola as regras de uso abaixo. Nenhum render o carrega. Para escala, use os PNGs oficiais.
* **Símbolo "4" oficial** (`simbolo-selo.png`): É **o símbolo que aparece na arte** quando a peça escolhe "Só o símbolo" — recorte do símbolo do logo oficial (`interface/lib/render.js`, `SIMBOLO_SELO`)
* **Símbolo de traço** (`simbolo.svg`): Reservado a **marca d'água**, favicon, avatar e ícone de app — não é o símbolo usado na arte

> **Padrão da marca nas peças:** o logo padrão é o **wordmark completo** ("4Selet"). O símbolo isolado só entra quando a peça escolhe explicitamente "Só o símbolo" — e nesse caso é o `simbolo-selo.png`, nunca o `simbolo.svg`. Variantes por peça no painel: `logo` = `light` | `dark` | `symbol`; `watermark` = `word` | `symbol` | `outline` | `none` | `canto` | `padrao` (persistidas em `render.json` na raiz da task).

**Regras de uso (CRITICAL para agents):**
* **Nunca** esticar, rotacionar, distorcer ou aplicar efeitos ao logo
* **Espaço mínimo livre** = altura do símbolo "4" em todos os lados
* **Nunca** sobre fundo fotográfico ocupado ou com baixo contraste
* **Nunca** com borda, sombra ou outline
* **Nunca** alterar as cores dos arquivos oficiais — usar `logo-4selet.png`, `logo-4selet-light.png` e `simbolo-selo.png` como estão. O `simbolo.svg` de traço é Selet Blue `#006494` por design e só vale como marca d'água
* **Nunca** recriar a tipografia "SELET" — usar sempre o arquivo oficial

---

### **Color Palette (Paleta Oficial da Marca)**

A paleta oficial vem direto do brandbook v2 da 4Selet. **Toda cor de marca, de texto e de destaque sai desta lista** — não existe "cor de campanha diferente". A exceção está descrita logo abaixo, em *Neutros de interface*.

| Nome | Hex | RGB | Uso |
| ----- | ----- | ----- | ----- |
| **Selet Darker** | `#07212B` | `7, 33, 43` | Texto primário em fundos claros, fundos escuros premium, headlines de máxima ênfase |
| **Selet Navy** | `#003554` | `0, 53, 84` | Logo (símbolo), título de seções, capas, fundos premium |
| **Selet Blue** | `#006494` | `0, 100, 148` | **Cor de marca principal** — botões, links, CTAs, destaques, gráficos |
| **Selet Sky** | `#5499B5` | `84, 153, 181` | Acento secundário, ilustrações, badges informativos |
| **Selet Mist** | `#AFBCC9` | `175, 188, 201` | Texto secundário, divisores em fundos escuros, elementos UI auxiliares |
| **Selet Cloud** | `#D9DCD6` | `217, 220, 214` | Fundos suaves, áreas de destaque, cards em fundo claro |

**Cores funcionais (uso restrito a indicadores de status):**

| Função | Hex | Uso |
| ----- | ----- | ----- |
| Sucesso | `#16A34A` | Status "pago", "ativo", indicadores positivos |
| Alerta | `#D97706` | Status "atrasada", warnings não-críticos |
| Erro | `#DC2626` | Status "cancelado", "estornado", erros |

### **Color Rules (regras duras para todos os agents)**

* **Selet Blue** (`#006494`) é a cor de marca — deve aparecer em toda peça **que tenha elemento de ação ou de acento** (CTA, realce de número, gradiente de capa). No template *Foto* sem CTA — que é o padrão — o azul entra pelo gradiente de fundo; **não force um CTA só para cumprir esta regra**
* **Selet Navy** (`#003554`) é o tom dominante em capas, hero sections e materiais de impacto
* **Branco puro (`#FFFFFF`), por escopo:** **permitido como TEXTO/foreground** sobre fundo Navy/Darker — é o que os templates de produção usam em headline e CTA (`interface/lib/render.js`). **Permitido também dentro de mockup:** a "tela" do dispositivo e o card com o nome do veículo nas peças *4Selet na Mídia* são brancos porque são citação literal de uma página de site. **Proibido como fundo da peça, card de conteúdo ou área chapada de marca** — nesses casos use **Selet Cloud** (`#D9DCD6`)
* Substituir `#000000` por **Selet Darker** (`#07212B`) em fundos escuros — **nunca usar preto puro**
* As três cores funcionais são para **status do sistema apenas** — não usar como cor decorativa
* **A paleta azul é o motor visual da marca** — headlines, hero sections, gráficos e acentos
* **Sem neon, sem gradiente quente, sem cor de campanha "diferente"** — coerência > variedade

**Neutros de interface (exceção autorizada):** molduras de dispositivo, chrome de navegador, sombras e os stops de gradiente do tema editorial claro podem usar neutros fora da paleta — é o que sustenta os mockups de dispositivo e o tema claro do carrossel, ambos em produção e aprovados. Valem apenas **dentro desses elementos**, nunca como cor de marca, de texto ou de destaque:

* Tema claro do carrossel: `#E9ECE6` e `#CBD2CC` — derivados oficiais de Selet Cloud
* Molduras, notch e corpo de dispositivo: escala de grafite fora da paleta (`#0a1015`, `#243039`, `#12181d`, `#080b0e`, `#05090d`) — nunca `#000000` puro
* Chrome de navegador e placeholder de tela vazia: cinzas de interface (`#e7ecef`, `#c6ced4`, `#f2f5f7`, `#6c7c84`, `#eef2f4`, `#e6ebee`, `#9fb0b8`, `#cfd7dc`, `#0d3244`, `#0a2a39`, `#0a2130`) e os três pontos do navegador (`#ff5f57`, `#febc2e`, `#28c840`) — citação literal de uma janela, não cor de campanha

> A regra é **por elemento, não por lista fechada**: dentro de moldura, chrome ou placeholder vale o neutro que o mockup exigir; fora deles, só a paleta oficial.

---

### **Typography**

A 4Selet usa **uma única família tipográfica** em toda comunicação: **Inter**. A diferenciação acontece através de peso, tamanho e tracking — não através de famílias diferentes.

**Display / Headlines**
* Typeface: *Inter* — weight 700–800 (Bold–Black)
* Use: Headlines de campanha, títulos editoriais, hero text, capas
* Style (arte, canvas 1080): 84–168px · line-height 0.96–1.0 · letter-spacing **-2px a -3px**. Em e-mail/web, divida por ~2,5

**Body / Editorial**
* Typeface: *Inter* — weight 400–500 (Regular–Medium)
* Use: Corpo de texto, descrições, e-mails
* Style (arte, canvas 1080): **38–42px** / line-height **1.30–1.34**; alinhado à esquerda sempre. Em e-mail/web: 15–17px / 1.55

**UI / Functional**
* Typeface: *Inter* — weight 500–600 (Medium–Semibold)
* Use: Labels, botões, metadados, navegação, badges
* Style (arte, canvas 1080): **24–32px** UPPERCASE, letter-spacing **+1 a +4px**. Em e-mail/web: 12–14px, +0.4px

**Mono / Código**
* Typeface: *JetBrains Mono* (carregado via `@remotion/google-fonts` ou Google Fonts)
* Use: Códigos de pedido (`pur_XXXXX`), URLs, parâmetros técnicos, snippets
* Style: 12–14px; cor Selet Navy

**Regras:**
* Headlines, corpo e UI **sempre em Inter** — não usar fontes alternativas
* **JetBrains Mono** tem dois usos legítimos: (a) snippets técnicos (código de pedido `pur_XXXXX`, URL, parâmetro) e (b) **rótulos estruturais das artes** — eyebrow, badge, footer e o rótulo do CTA, em uppercase com tracking positivo. É assim que os 4 templates de produção rodam. Nunca em headline, corpo ou legenda
* **Nunca** usar fontes genéricas (Arial, Helvetica, Times, Roboto, system fonts) em criativos oficiais
* Texto centralizado: **apenas** em capas e títulos isolados — corpo de texto sempre à esquerda

---

### **Photography & Visual Content**

Todo visual deve ser deliberado, premium e alinhado ao posicionamento sóbrio. **Fotografia de banco é permitida** — desde que tratada na marca e usada como fundo, nunca como assunto.

**Use:**
* Screenshots reais da plataforma (checkout, dashboard, área de membros) — sempre limpos, com dados fictícios ou mascarados
* Composições tipográficas em fundo Selet Navy / Selet Darker — texto branco com hierarquia clara
* Mockups de laptop/desktop/tablet mostrando a plataforma ou uma matéria em uso real
* **Foto de banco (Pexels) ou do acervo** (`/uploads/...`), sempre tratada na marca: dessaturada, com tint Navy/Darker e scrim de leitura por cima. A foto é **fundo**, o texto é o assunto. Busca e download pelo próprio painel (`interface/lib/pexels.js`); creditar o fotógrafo quando o uso exigir
* O motif de **pontos azuis** (Selet Dots) — referência ao logo — em capas e divisores
* Fundos sólidos da paleta com gradiente radial sutil para profundidade
* Ilustrações editoriais minimalistas em cinza-azulado, **nunca cartoonizadas**

**Evite:**
* O clichê corporativo: "executivo sorrindo apertando mão", equipe aplaudindo em sala de reunião, aperto de mão em close
* Foto sem tratamento (colorida, saturada, sem scrim) ou foto que compete com o texto
* Gradientes neon (rosa, verde elétrico, roxo psicodélico)
* Estética "tech bro" com fundos pretos e cores fluorescentes
* Emojis em materiais oficiais (exceções limitadas: WhatsApp informal, social caption casual)
* Screenshots borrados, com dados reais expostos ou de telas obsoletas
* Composições poluídas: **mais de um acento além da base azul**. A base (Navy/Darker/Blue em gradiente + Sky nos rótulos + branco/Mist no texto) é o sistema e não conta como "cores" — o que não pode é entrar uma cor de fora dele
* Mascotes, ícones tipo "flat 2.0", elementos infantilizados

---

### **4Selet na Mídia (prova social de imprensa)**

Tipo de peça **nativo e em produção** desde julho/2026 (`media_mention` no painel — "4Selet na Mídia"). É o print de uma matéria/entrevista real sobre a 4Selet montado num dispositivo ou cena fotográfica. É o formato que mais depende de regra de marca, porque usa **conteúdo de terceiro**: texto da matéria, nome e logo do veículo.

**Regras de conteúdo (duras):**
* **Nunca inventar** trecho, citação, número ou título da matéria. Se não está no print, não entra na legenda
* Tom **sóbrio de quem foi reconhecido** — a autoridade vem do veículo, não de nós. Sem hype, sem autopromoção, sem "somos os melhores"
* Nomear o veículo com respeito e exatidão (nome correto, sem apelido, sem trocadilho)
* A legenda ancora no **que o veículo representa** e no que o reconhecimento externo valida (seriedade da operação) — não no conteúdo que a matéria não disse
* CTA **suave ou nenhum** (ex.: *Conhecer a plataforma*). Peça de prova social não é peça de conversão
* Hashtags: `#4Selet` + `#NaMidia` + 1 a 3 complementares. **Sem `#TaxaZero`** (a menos que a matéria seja sobre a campanha)
* Vale a mesma regra de emoji das captions: no máximo 1 funcional

**Tratamento visual:** o print entra dentro de um mockup, nunca solto. São 10 modelos de arte no painel — *Tablet* (`hand_tablet`), *Foto real (mãos)*, *Foto real (mesa)*, *Foto real (mãos + mesa)*, *Celular*, *Navegador*, *Citação*, *Split*, *Selo* e *Camadas*. Os modelos foto-reais e os mockups de dispositivo são a **exceção autorizada** à regra de fotografia: a foto de banco entra como cena de contexto, sempre tratada na marca. Print vertical vai bem em Tablet e Celular; print largo vai bem em Navegador, Split e Camadas. (Não existe modelo "Notebook" — a lista acima é fechada.)

**Formatos gerados:** 4:5 (`feed.png`, o publicável no feed), 1:1 (`square.png`), 9:16 (`story.png`) e 16:9 (`media_16x9.png`, formato de site/apresentação — não publicável no feed). O padrão marcado é 4:5 + 16:9.

---

### **Texture & Pattern**

A 4Selet usa textura sutil — **nunca como decoração, sempre como reforço de hierarquia**.

* **Selet Dots** — motif de pontos azuis (referência ao logo) em capas, divisores e fundos premium. Pequenos, espaçados, em opacidade reduzida. Reforçam estrutura e contenção.
* **Gradientes radiais azuis** — em fundos Selet Navy / Selet Darker para evitar monotonia. Sempre sutis, sempre nos tons da paleta.
* **Sem padrões geométricos repetitivos** ou ornamentação gratuita
* **Espaço negativo é ativo** — nunca preencher por preencher; o respiro é parte do posicionamento premium

---

## **Voice & Tone**

### **Writing Principles (princípios para Copywriter Agent)**

**Confiança estruturada.** Cada afirmação é sustentada por dado, estrutura ou processo. *"Nossos prazos são previsíveis"* só se segue de **como**. Confiança sustentada, não performada.

**Profissionalismo acessível.** Sabemos muito, explicamos simples. Linguagem técnica quando necessário, sempre com tradução clara. Escrevemos pra esclarecer, não pra impressionar.

**Resultados reais.** Foco em lucro, fluxo de caixa, estabilidade. Cada mensagem responde implicitamente *"por que isso importa pra mim?"*. Sem encheção de linguiça.

**Construção e evolução.** Mentalidade de quem **constrói com método**. Falamos de processo, etapas, evolução — não de transformação mágica.

---

### **Tone Calibration por contexto**

| Contexto | Tom |
| ----- | ----- |
| **Ads e hooks** | Direto, factual, ancorado em problema real do mercado + prova com número. Sem promessa vazia. |
| **Posts educativos** | Didático, profissional, como uma boa explicação de gestor experiente para o time. |
| **Landing page / VSL** | Editorial. Storytelling com fundadores quando relevante. Especificidade absoluta nos números. |
| **Suporte e comunidade** | Próximo, prestativo, claro. Resolve o problema, ensina por que aconteceu. |
| **E-mail** | Profissional e direto. Sem firula. Frases curtas. Foco em uma ação por e-mail. |
| **Newsletter editorial** | Editorial, premium, sóbrio. Conteúdo que agrega valor — não venda disfarçada. |
| **Threads / X (post curto)** | Mais provocativo permitido, mas sem perder a sobriedade. Provoca com dado, não com cliché. |

---

### **Como a 4Selet fala — e como NÃO fala**

| **Sim** | **Não** |
| ----- | ----- |
| Claro | Infantil ou caricato |
| Maduro | Complexo / técnico demais |
| Didático (sem ser professoral) | Robótico ou frio |
| Profissional | Exagerado |
| Confiante | Arrogante |
| Amigável (sem ser informal demais) | Misterioso |
| Estrategista | Sensacionalista |
| De pessoa para pessoa | Motivacional vazio |
| De resultados reais | Promessa mágica |

---

### **Emojis: regras objetivas**

| Contexto | Política |
| ----- | ----- |
| **Headlines / hero text** | Nunca |
| **Body em ad / VSL / LP** | Nunca |
| **Caption Instagram** | Máximo 1, e só se for funcional (ex.: `→` para call-to-action, `▸` para item de lista) |
| **Caption Threads** | Máximo 1, mesma regra |
| **Legenda 4Selet na Mídia** | Máximo 1, mesma regra |

**Emojis aprovados** (lista fechada para criativos): `→` `▸` `•`

**Banidos:** 🔥 ⚡ 🚀 💸 💰 😱 🤯 ✨ (associados a hype) e qualquer emoji infantilizado/cartoon. **Emoji banido é erro duro** — o painel devolve HTTP 422 e recusa a gravação, salvo quando um admin força explicitamente. Já o teto de "1 emoji funcional" **não é contado pelo painel** para `→ ▸ •` (não são pictográficos): vale como disciplina de escrita, não como trava.

**Canais não automatizados (newsletter, WhatsApp, comunidade) — fora do escopo do painel:** ali `📌` (pauta), `🔧` (release), `💡` (dica) e `📊` (dado) são permitidos com parcimônia. Não valem para peça gerada pelos agentes.

---

### **CTAs aprovados**

CTAs sempre **claros, factuais, com baixa fricção e ancorados em ação concreta**. Sem urgência fake, sem CAPS LOCK, sem ponto de exclamação múltiplo.

**CTAs aprovados (grafia canônica — use exatamente assim ou variações próximas):**

* *Solicitar convite*
* *Ver as condições* — com o "as"; a grafia "Ver condições" é incorreta
* *Conhecer a plataforma*
* *Migrar minha operação*
* *Calcular minha economia*
* *Falar com o time*
* *Acessar o material*
* *Ler o playbook*
* *Ver como funciona*

**CTAs proibidos:**

* - *Compre já!*
* - *Não perca essa chance única!*
* - *Clica aqui agora!*
* - *URGENTE — vaga limitada!*
* - *Garanta o seu antes que acabe!*
* - *Inscreva-se gratuitamente* (a 4Selet não é gratuita; é por convite)

**Quando NÃO usar CTA:** o padrão do painel é **sem CTA**. Quando o brief não define uma chamada, a peça encerra com um fechamento suave de relacionamento e o campo `cta` fica vazio. CTA de conversão entra quando a peça tem intenção de conversão (pilar Taxa Zero, prova de plataforma) ou quando o brief pede — nunca colado por hábito no fim de peça educacional, motivacional ou de mídia.

> **Nota de implementação:** a lista de 9 acima é a canônica (`interface/lib/config.js`, `APPROVED_CTAS`). O bloco GOVERNANCE do prompt cita 7 (sem *Acessar o material* e *Ler o playbook*) e o checklist de `scripts/generate_preview.js` reconhece 6, com a grafia antiga "Ver condições". Um CTA correto pode, portanto, não ser detectado automaticamente pelo checklist — isso é limitação da checagem, não erro da peça.

---

### **Sample Copy (referência para o Copywriter Agent)**

**Frases-tag oficiais da marca:**

> ***Produtor não é número. É parceiro. E parceiro vende junto.*** *(slide 03 do deck oficial de proposta — uma das melhores frases da marca; usar em LinkedIn, hero de LP, capa de carrossel)*
>
> ***Para quem sabe que é Selet.*** *(tagline-mãe — **essência e posicionamento interno**; ver a regra dura abaixo antes de usar em peça)*
>
> ***A escolha de quem já performa.*** *(posicionamento; ideal para LinkedIn, VSL, materiais com produtor estabelecido)*

> **REGRA DURA — a tagline não assina peça.** *"Para quem sabe que é Selet."* **NÃO** deve ser usada como rodapé, fecho, assinatura automática, headline, body de slide, legenda ou cena de vídeo. **Não assine as peças com ela.** Ela só entra se o brief pedir explicitamente. Isso vale para todas as peças novas, em todos os formatos.
>
> A regra está espelhada em código: bloco GOVERNANCE de `interface/lib/prompts.js` e `DEFAULT_FOOTER = ""` em `interface/lib/render.js` — **não existe mais rodapé automático nas artes**. A frase continua sendo a essência da marca; o que mudou é que ela deixou de ser carimbo.

**Campaign headline (Taxa Zero):**

> Zero taxa por 3 meses.

**Sub-headline:**

> Migre sua operação para um ambiente desenhado para produtores que tratam o digital como negócio sério. 0% de taxa pela plataforma nos primeiros 3 meses ou até R$ 300 mil em vendas — só R$ 1,99 por transação. PIX em D+10, cartão em D+30.

**Product description (Plataforma):**

> A 4Selet é a plataforma de pagamentos para quem opera com seriedade no mercado digital. Multi-adquirência inteligente, antifraude integrado, área de membros premium e suporte de quem entende como o seu negócio realmente funciona. **Acesso por convite.**

**Post educativo (LinkedIn):**

> O produtor que olha apenas a taxa percentual está olhando para o lugar errado. O que define a rentabilidade da sua operação é a soma de quatro variáveis: taxa por transação, prazo de recebimento, taxa de aprovação do gateway e custo do suporte (em horas perdidas resolvendo problema da plataforma). Reduzir uma e perder nas outras três é prejuízo disfarçado de economia.

**Threads / X (post curto):**

> Taxa de 7,9% é problema dos outros. O seu problema é por que o seu cartão tá aprovando 78% em vez de 95%.

**Social caption (Instagram, Taxa Zero):**

> 0% por 3 meses. R$ 1,99 por transação. PIX em D+10.
>
> A 4Selet abriu um corredor para produtores estabelecidos que querem migrar de plataforma sem perder mês.
>
> O convite tá na bio. →

**Social caption (Instagram, institucional):**

> Produtor não é número. É parceiro. E parceiro vende junto.
>
> A 4Selet é a escolha de quem já performa. Acesso por convite.

**E-mail (newsletter):**

> Esta semana liberamos a edição de e-mail do aluno diretamente em "Meus Alunos" — sem precisar abrir ticket. A propagação para o registro da compra é automática, e o reenvio de confirmação fica a um clique.

---

## **Hashtags — Estratégia**

### **Mix por post (3–5 hashtags em Instagram) — o mix acompanha o pilar**

1. **Marca:** `#4Selet` — **única obrigatória** em todo post Instagram. Atenção: no painel isso é **aviso, não bloqueio**, e a checagem só roda no tipo *Feed Instagram* — em *4Selet na Mídia* nenhuma regra de hashtag é verificada automaticamente. Cumprir por disciplina de escrita, sem contar com o gate
2. **Campanha ativa:** `#TaxaZero` — **condicional**: só quando a peça for do pilar *Taxa Zero* ou falar da oferta ativa. Não force em peça educacional, de curiosidade, motivacional ou de mídia
3. **Tipo:** `#NaMidia` nas peças *4Selet na Mídia*
4. **Produto:** uma de — `#PlataformaDePagamentos`, `#Infoproduto`, `#NegocioDigital`, `#AreaDeMembros`
5. **Nicho:** uma de — `#ProdutorDigital`, `#MarketingDigital`, `#EscalarNegocio`, `#DigitalSerio`
6. **Opcional (relevante ao tema):** `#PixD10`, `#Multiadquirencia`, `#Antifraude`

Sugestão por pilar quando `#TaxaZero` não se aplica: *Educacional* → produto + nicho; *Curiosidade de mercado* → `#Multiadquirencia`/`#NegocioDigital` + nicho; *Prova da plataforma* → `#Antifraude`/`#PixD10` + produto; *Novidade* → produto + nicho; *Motivacional* → nicho.

### **Hashtags banidas**

* `#Sucesso #DinheiroFacil #FiqueRico` (promessa mágica)
* `#EmpreendedorDigital #MentorDoSucesso` (associados a guru)
* Mais de 5 hashtags por post (parece spam)
* Hashtags em CAPS LOCK no meio da caption

---

## **Brand Governance (checklist para agents)**

Antes de aprovar qualquer output, **passar pelas 7 perguntas:**

1. **Cor:** A paleta está dentro dos primitivos oficiais? (Sem preto puro, sem neon. Branco puro só como texto sobre fundo escuro — nunca como fundo/card. Neutros de interface valem só dentro de mockup de dispositivo e do tema claro.)
2. **Tipografia:** Está em Inter? (JetBrains Mono é exceção para snippets técnicos.)
3. **Logo:** Light em fundos escuros, dark em fundos claros, sem efeitos.
4. **Tom:** Soa como gestor experiente conversando com o produtor — ou soa motivacional/genérico?
5. **Específico:** Tem número, prazo, processo concreto — ou só promessa vaga?
6. **Coerência:** Posiciona a 4Selet como **estrutura e parceria** — não como ferramenta barata?
7. **Limpeza:** Tem espaço negativo? Ou tá poluído de elementos?

**Pergunta 8 (regra dura acrescentada em julho/2026):** A peça está **assinada com a frase-tag** *"Para quem sabe que é Selet."*? Se sim e o brief não pediu, **tire**.

---

## **What 4Selet Is Not**

Para proteger a coerência da marca, **evite explicitamente** os seguintes territórios — mesmo sob pressão de performance.

* **Plataforma "para todo mundo":** Não vendemos "qualquer um pode vender qualquer coisa". O convite e a curadoria são parte da promessa.
* **Promessa de faturamento mágico:** Nunca "ganhe R$ 100 mil em 30 dias". Mostramos estrutura, prazo e processo.
* **Comunicação corporativa fria:** A 4Selet não "potencializa sinergias". A 4Selet **resolve, protege e dá controle**.
* **Tom motivacional vazio:** Sem "vamos juntos!", "o céu é o limite!", "acredite!".
* **Comparação direta com concorrentes:** Mencionamos o mercado em abstrato ("taxas de mercado em torno de 7,9%"); **não atacamos nomes** em criativos institucionais.

  > **Lista fechada de nomes proibidos em criativos abertos** (ads pagos, posts orgânicos, vídeos públicos, carrosséis, captions): **Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay** e qualquer outra plataforma concorrente. Não citar nem por nome direto, nem por sigla/abreviação, nem por logo, nem por descrição reconhecível ("a do verde", "a do limão", "a da chama vermelha"). **Material com esses nomes só é permitido em proposta comercial direta** (deck `4selet-proposta-parceria-oficial`, reunião 1:1 com produtor qualificado) — nunca em campanha pública.
  >
  > **Como falar do mercado quando precisar contextualizar:** *"taxas de mercado em torno de 7,9%"*, *"prazos de mercado entre 15 e 30 dias"*, *"plataformas tradicionais"*, *"a oferta atual do mercado"*. O comparativo se faz pelo **que a 4Selet oferece** — o leitor faz a conta sozinho.
* **Pressão de urgência fake:** Sem countdown timer falso, sem "última chance!!!". Quando há prazo real (encerramento de Taxa Zero), comunicamos com clareza e antecedência.
* **Estética "guru":** Sem fotos de mansão, carro de luxo, "fórmula secreta". Profissionalismo sóbrio, sempre.

---

## **Agent Reference Quick Map**

### Por agente (caminho das skills)

| Agent | Seções-chave a referenciar |
| ----- | ----- |
| **Marketing Research Agent** | Target Audience · Pilares de Conteúdo · What 4Selet Is Not · Brand Governance |
| **Ad Creative Designer** | Visual Identity (toda) · Color Rules · Photography · Pilares de Conteúdo · CTAs aprovados |
| **Video Ad Specialist** | Visual Identity · Brand Personality · Sample Copy · Pilares de Conteúdo · CTAs aprovados |
| **Copywriter Agent** | Voice & Tone · Sample Copy · CTAs aprovados · Hashtags · Pilares de Conteúdo · Tone Calibration |
| **Distribution Agent** | Hashtags · CTAs aprovados · Brand Governance (checklist final) |

### Por tipo de conteúdo (caminho do painel — o principal hoje)

| Tipo (`id`) | Seções-chave |
| ----- | ----- |
| **Feed Instagram** (`instagram_caption`) | Voice & Tone · Sample Copy · Hashtags · CTAs · Pilares |
| **Carrossel** (`instagram_carousel`) | Visual Identity · Color Rules · Typography · Pilares · Hashtags |
| **Imagem / Anúncio** (`ad_creative`) | Visual Identity (toda) · Color Rules · Photography · CTAs |
| **4Selet na Mídia** (`media_mention`) | **4Selet na Mídia** · Photography · Hashtags · Emojis · Voice & Tone |
| **Vídeo** (`video_idea`) | Brand Personality · Sample Copy · Visual Identity · CTAs |
| **LinkedIn** (`linkedin_post`) | Voice & Tone · Tone Calibration · Sample Copy · Hashtags |
| **Threads/X** (`threads_post`) | Tone Calibration (Threads) · What 4Selet Is Not · Hashtags |

---

*Última atualização: Julho 2026 (v1.2 — auditoria dos agentes) · Mantido por: Marketing 4Selet · Doc de referência viva — atualizações são versionadas e distribuídas para os agentes e para o painel*
