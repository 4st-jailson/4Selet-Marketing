# Arte para Story: o Instagram está cortando o conteúdo de vocês

**Para:** time do squad.4st.co
**De:** 4Selet — Painel de Marketing (`https://mkt.4st.co`)
**Data:** 20 de agosto de 2026
**Assunto:** as artes entregues hoje perdem ~228 px de cada lado quando publicadas no Story

---

## 1. O que aconteceu

No dia 20/08 publicamos no Story do @4selet uma arte que vocês entregaram (post `5` — *"IA de vendas não conserta oferta ruim. Ela só acelera a rejeição."*).

A arte saiu **cortada nas laterais**. O começo de cada linha do texto sumiu: quem viu no celular leu *"...de vendas / ...o conserta / ...erta ruim"*. Tivemos que apagar a publicação.

Isso não é defeito da arte de vocês nem do nosso painel. É o comportamento do Instagram, e é previsível.

## 2. Por que acontece (a conta)

O Instagram **não completa com borda** uma arte que não seja 9:16 no Story. Ele amplia a imagem até ela **preencher a tela inteira** e descarta o que sobra.

| | |
|---|---|
| Arte entregue | **1080 × 1350** (4:5, formato de feed) |
| Tela do Story | **1080 × 1920** (9:16) |
| Fator de ampliação | 1920 ÷ 1350 = **1,422** |
| Largura depois de ampliar | 1080 × 1,422 = **1536 px** |
| **Descartado** | (1536 − 1080) ÷ 2 = **228 px de cada lado** |

São 228 px comidos à esquerda e 228 à direita — **21% da largura**. Como o texto de vocês costuma começar na margem esquerda, é exatamente ele que desaparece.

O mesmo vale para arte 1:1 (1080×1080): o corte sobe para **330 px de cada lado**.

## 3. O que já fizemos do nosso lado

O painel **não depende de vocês para publicar**. Quando a entrega vem só no formato de feed, ele encaixa a arte inteira em 1080×1920 e preenche as faixas de cima e de baixo com a própria imagem ampliada e desfocada. Nada é cortado.

Mas **encaixar é remendo, não design**:

- a arte fica menor na tela, com ~285 px de moldura em cima e embaixo;
- a composição foi pensada para 4:5 e aparece dentro de um 9:16 — o respiro, o peso do texto e o ponto focal não são os que vocês escolheram;
- vocês perdem controle sobre o resultado final.

Também avisamos na tela, agora, sempre que uma entrega chega sem a versão vertical.

## 4. O que pedimos

**Mandem as duas versões da mesma arte na mesma entrega.**

Isso é o que a 4Selet propôs e é o caminho que resolve de verdade: quem desenha decide como a peça fica em cada proporção, e o painel entrega o formato certo conforme o destino escolhido na hora de publicar (Feed ou Story).

### O contrato

Nada do que existe hoje muda. O `png` e o `html` de cada card continuam sendo a versão **de feed**. Acrescenta-se um campo irmão **opcional** chamado `story`:

```json
{
  "post_id": "123",
  "formato": "post_unico",
  "legenda": "IA de vendas não conserta oferta ruim...\n\n#4Selet",
  "cards": [
    {
      "n": 1,

      "png":  "data:image/png;base64,...",
      "html": "<!doctype html><html>...</html>",
      "largura": 1080,
      "altura": 1350,

      "story": {
        "png":  "data:image/png;base64,...",
        "html": "<!doctype html><html>...</html>",
        "largura": 1080,
        "altura": 1920
      }
    }
  ]
}
```

**Regras do campo `story`:**

| Campo | Obrigatório | Observação |
|---|---|---|
| `story.png` | um dos dois | data URI, PNG ou JPEG, até 15 MB |
| `story.html` | um dos dois | mesmas regras do `html` de feed: **autossuficiente**, sem buscar nada do servidor de vocês |
| `story.largura` / `story.altura` | não | ajuda o painel a desenhar o HTML no tamanho certo |

- Se vierem os dois (`png` **e** `html`), o painel usa o HTML — é ele que deixa a arte editável de verdade, com o texto acessível em vez de assado na figura.
- Se vier só um, o painel usa o que veio.
- **Se não vier nada**, tudo segue funcionando como hoje — o painel encaixa a de feed e avisa na tela.

### A especificação da arte de Story

**1080 × 1920 px (9:16).**

O aplicativo do Instagram **cobre parte da tela** com a interface dele. Essas faixas precisam ficar livres de texto e de logo:

| Faixa | Medida | O que fica ali |
|---|---|---|
| Topo | **250 px** | foto de perfil, nome da conta, horário, "×" |
| Base | **250 px** | caixa "Enviar mensagem", coração, avião |
| Laterais | **96 px** | margem de segurança |

Sobra uma **área útil de 888 × 1420 px**. Todo o conteúdo legível precisa caber aí dentro.

**Não desenhem a barra de progresso da sequência.** O Instagram desenha a dele por cima de todo Story — se a arte trouxer outra, saem duas. (Nós tínhamos esse mesmo erro e tiramos.)

## 5. Como conferir se ficou certo

Antes de entregar, façam esta conta com a arte de Story pronta:

1. A imagem é exatamente **1080 × 1920**?
2. Nenhum texto ou logo entra nos **250 px de cima**, nos **250 de baixo** ou nos **96 px das laterais**?
3. Não há barra de progresso desenhada na arte?

Se as três respostas forem sim, ela sai inteira no aplicativo.

## 6. Aceite

> A entrega passa a incluir, para cada card, o campo **`cards[].story`** com a arte em **1080 × 1920**, respeitando a zona segura de 250 px (topo), 250 px (base) e 96 px (laterais), sem barra de progresso desenhada. Quando houver `story.html`, ele é autossuficiente — não busca imagem, fonte nem folha de estilo de fora.

**O painel já está pronto para receber.** Não precisamos fazer nada quando vocês começarem a enviar: o campo é lido, a arte vai para o lugar certo e passa a ser usada automaticamente sempre que o destino da publicação for o Story.

## 7. Onde isso se encaixa no que já pedimos

Este documento complementa o `PROMPT_SQUAD_WEBHOOK.md`, que já pedia o `cards[].html` junto do `png` (seção 3.2) — e que continua pendente. As duas coisas são independentes:

- **seção 3.2** — o `html` da arte de feed, para a peça ser editável no painel;
- **este documento (seção 4)** — a versão **9:16**, para o Story sair inteiro.

Vale resolver as duas na mesma passada: são o mesmo trecho de código do emissor de vocês.

---

**Contato:** Hugo Belo — hugo@4selet.com.br
