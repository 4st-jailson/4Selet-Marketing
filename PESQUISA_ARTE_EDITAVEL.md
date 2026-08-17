# Como o Canva torna uma imagem editável — e o que dá para fazer no nosso painel

**Pergunta:** como o Canva recebe uma imagem qualquer, analisa e permite alterar cada elemento dentro dela.
**Pesquisa feita em:** 17 de agosto de 2026, com fontes primárias (documentação do Canva, papers, repositórios).

---

## 1. A resposta curta

**O Canva faz isso, e o recurso tem nome: Magic Layers.** Lançado em beta público em 11 de março de
2026. Você sobe um PNG ou JPG chapado e ele quebra a imagem em camadas editáveis dentro do editor:
separa os objetos, devolve o texto como caixas de texto **vivas**, isola o fundo e preserva o layout.
Depois disso dá para mover, redimensionar, trocar a fonte, mudar a cor.

Mas há três ressalvas que mudam o que dá para esperar:

**Não é mágica, é uma receita de quatro partes.** Segmentação dos objetos + leitura do texto (OCR)
com tentativa de casar a fonte + preenchimento generativo do fundo atrás do que saiu + uma leitura
da estrutura do design. Não é vetorização.

**Funciona bem em peça gráfica, não em fotografia.** A própria ajuda do Canva diz que o recurso é
para design gráfico, ilustração e visual estilizado — imagem foto-realista não se separa de forma
limpa. *Isso é uma boa notícia para nós:* as artes que chegam ao painel são exatamente peça gráfica.

**É beta, pago, em quatro países, e sem API.** Só PNG/JPG, uma página, teto de ~5000px, exige plano
pago e consome cota de IA. Está disponível nos EUA, Reino Unido, Canadá e Austrália. **Não dá para
terceirizar para o Canva** — não existe API pública desse recurso.

E dois recursos que costumam ser confundidos com ele:

- **Magic Grab** pega **um** objeto (o sujeito da foto) e permite movê-lo, preenchendo o fundo. A
  documentação diz textualmente que pegar *qualquer* objeto ainda é coisa do futuro.
- **Grab Text** é o pedaço de OCR: transforma o texto de dentro da imagem em caixas editáveis. A
  própria ajuda avisa que o casamento de fonte erra com frequência e orienta reformatar à mão.

---

## 2. O achado mais importante da pesquisa

Quando você importa um **PDF ou um PPTX** no Canva, os elementos viram editáveis — e isso **não tem
nada de inteligência artificial**. É leitura de estrutura: o arquivo já carrega o texto, as fontes e
as coordenadas por dentro, e o Canva só traduz para objetos do editor.

A prova está na própria ajuda deles: **se o PDF for um scan, entra como uma imagem achatada e nada
pode ser editado.** A editabilidade vem do arquivo ter estrutura, não do Canva ser esperto.

> **Traduzindo para o nosso caso:** reconstruir arte a partir de PNG é um problema de adivinhação.
> A partir de HTML, PDF ou SVG é um problema de leitura — exato, barato e sem risco.
>
> É exatamente por isso que o caminho certo com o sistema do squad é **pedir o HTML na origem**.
> Eles têm o HTML de cada card e o descartam. Um campo no envio resolve com fidelidade total o que
> nenhuma IA resolveria com fidelidade parcial.

---

## 3. O estado da técnica, em números

O problema tem nome na literatura — *layered design decomposition* — e virou linha de pesquisa
quente entre o fim de 2025 e 2026. O consenso é que **ninguém resolve com um modelo só**: a solução
que funciona é híbrida — um modelo de visão lê o **texto** e devolve um protocolo estruturado, e um
modelo de difusão cuida do **fundo** e dos elementos gráficos.

As peças estão em estados bem diferentes de maturidade:

| Peça do problema | Estado em 2026 |
|---|---|
| Ler o texto com posição | Praticamente resolvido (96,3% num benchmark de referência) |
| Apagar texto e refazer o fundo | Maduro — e em fundo chapado, como o nosso azul, é o caso fácil |
| Segmentar objetos | Bom (SAM 3 aceita pedido por conceito em texto) |
| **Identificar a fonte** | **É o elo fraco, por larga margem** |

Sobre a fonte: modelos de visão de fronteira acertam entre **8% e 31%** num teste com 15 fontes,
porque não olham a borda do caractere. Quem resolve isso é um classificador dedicado sobre um
catálogo fechado. Para nós isso quase não importa — nossa lista de fontes é fechada e curta.

**E o alerta mais direto contra o caminho ingênuo:** no estudo do LayerD, pedir as camadas
diretamente a um modelo de visão foi a **pior** das três abordagens testadas. E no benchmark
Omni-I2C, os melhores modelos de 2026 entregam ~41% de acurácia e ~76% de fidelidade visual em
"imagem → código", com 60% dos erros em omitir elemento e errar proporção. Ou seja: **dá uma
reconstrução plausível, não fiel.**

O trabalho que mais se aproxima do pedido é o **CreatiParser** (julho/2026): 0,896 de acerto nas
caixas de texto e 87,3% nas fontes. Mesmo ele erra **1 fonte em cada 8** — qualquer fluxo aqui
precisa prever revisão humana. O código ainda não foi liberado.

Existe uma opção de prateleira hoje: o **LayerD** é Apache-2.0, instala por pip e roda em CPU. Mas
o texto sai como **imagem**, não como texto editável (o OCR está marcado como "em breve") — serve
para separar fundo e elementos, não para trocar uma palavra.

---

## 4. O que dá para fazer no nosso painel

Um achado da própria auditoria do código muda a ordem das coisas:

> **Toda arte que o painel desenha já gera um manifesto de camadas** — o arquivo `.editable.json`,
> com texto, posição, tamanho, fonte, cor e alinhamento de cada elemento, mais um `.bg.png` com a
> arte sem esses elementos. É quase campo a campo o "protocolo de texto" que a pesquisa descreve
> como estado da arte. **E ninguém lê esses arquivos** — sobraram do editor antigo.
>
> Ou seja: o formato-alvo já existe e já é produzido de graça. Falta o consumidor.

### O plano, do mais barato ao mais caro

**Etapa 0 — aceitar HTML também na importação.** Qualquer arte que possa ser exportada como HTML
entra editável por dentro, com **fidelidade total** — porque não é reconstrução, é o original. O
caminho já está construído e testado (é o mesmo que a arte do squad usa). Falta abrir na tela de
Importar. *Custo: baixo. Risco: baixo.*

**Etapa 1 — trocar uma palavra sem IA nenhuma.** No editor, você seleciona uma área, o painel
amostra a cor do entorno, cobre com um retângulo daquela cor e abre um bloco de texto por cima. É
exatamente o gesto que você descreve — "trocar uma palavra do título, mudar um número" — no caso
que a pesquisa mostra ser o fácil: fundo chapado ou degradê, que é o nosso. Sem IA, sem custo por
uso, funciona offline. *Sobre foto ou textura a emenda aparece — e aparece na hora, na tela.*

**Etapa 2 — os textos viram camadas de verdade.** Botão "ler os textos desta arte": o painel manda
a imagem para o Claude e recebe as caixas de texto com posição e cor, escrevendo-as como camadas
por cima da arte original, que continua intacta embaixo. O encanamento de visão **já existe** no
painel (é o que o "Ajustar com IA" usa para imagem de referência).
*Regra inegociável:* cada bloco lido é confirmado por você, um a um. Peça com número, alíquota ou
percentual não pode ter "aceitar tudo" — o risco que mata aqui é o **número plausível e errado**.

**Etapa 3 — usar o manifesto que já existe.** Para arte nascida no painel, decomposição perfeita e
gratuita. Serve também de gabarito para medir o erro da Etapa 2 contra a verdade.

**Etapa 4 — recortar objeto (o selo, a foto).** Exige Python, pesos de modelo e um serviço novo ao
lado do painel. **Recomendo não fazer agora.**

**O que eu recomendo não fazer:** reconstruir a arte inteira por visão. Nossas peças carregam
número fiscal, e o modo de falha documentado é a arte ficar visualmente idêntica com o número
errado — passa na revisão de relance e vai para o @4selet. O ganho sobre a Etapa 2 é estético; o
risco é editorial.

---

## 5. O teto, sem maquiagem

**"Editar cada elemento de uma imagem qualquer, com fidelidade" não é alcançável — nem no Canva.**
Lá é beta, em quatro países, só para design gráfico, com resultado que muda entre uma execução e
outra, e sem API. Do nosso lado o teto é mais baixo ainda: o painel é Node + Chromium, sem Python e
sem biblioteca de imagem.

O que **é** alcançável, e cobre a maior parte do que você pede na prática:

1. **Fidelidade total, custo quase zero** — para arte que chegar em HTML. Já está construído; depende
   de um campo no envio do outro lado.
2. **Texto editável com revisão** — para arte que só existe como imagem. Espere revisar 1 bloco em
   cada 8, e conferir sempre que houver número.
3. **Trocar palavra ou número em fundo chapado** — determinístico, instantâneo, sem IA.

---

## Fontes principais

- Canva — anúncio do Magic Layers (11/03/2026) e páginas de ajuda de Magic Layers, Magic Grab, Grab Text, importação de PDF e de PowerPoint
- LayerD — *Decomposing Raster Graphic Designs into Layers* (ICCV 2025, CyberAgent AI Lab) — arxiv.org/abs/2509.25134 · github.com/CyberAgentAILab/LayerD
- CreatiParser (14/07/2026) — arxiv.org/abs/2604.19632
- Qwen-Image-Layered (Alibaba, 19/12/2025) — github.com/QwenLM/Qwen-Image-Layered
- Benchmarks Omni-I2C e Design2Code para "imagem → código"
