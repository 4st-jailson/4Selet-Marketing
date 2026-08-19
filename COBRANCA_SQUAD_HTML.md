# Mensagem para o time do squad — falta o HTML da arte

> Copie daqui para baixo e envie. É curta de propósito: o documento completo da integração
> (`PROMPT_SQUAD_WEBHOOK.md`) vocês já têm, e esta mensagem só aponta o que ficou faltando.

---

Pessoal, a integração está funcionando — as artes chegam, entram no painel e ficam prontas para
publicar. Obrigado por isso.

Falta uma parte, e é a que decide se conseguimos **editar** a arte de vocês depois: **o HTML de
cada card não está vindo no payload.**

## O que está chegando hoje

Conferimos a entrega do post 5. Cada card vem assim:

```json
{ "n": 1, "tipo": "capa", "png": "data:image/png;base64,…", "destaque": "acelera" }
```

Só a imagem. Sem o campo `html`.

## Por que isso trava do nosso lado

Com apenas o PNG, o texto da arte virou pixel. No painel dá para mexer **em cima** da peça —
acrescentar uma linha, mover o logo, reenquadrar. Mas não dá para mexer **dentro** dela: não
conseguimos corrigir uma palavra do título, trocar um número ou ajustar uma quebra de linha.

Na prática: se a arte chegar com um erro de digitação, a única saída é vocês regerarem. Com o
HTML junto, a gente corrige em dez segundos e publica.

## O que precisamos

O campo **`cards[].html`** vindo junto do `png`, em toda entrega.

O HTML **já existe** no processo de vocês e está sendo descartado: em `postgen.py`, o `_prep()`
retorna `(html, agente, custo)` e o `gerar()` usa esse html para renderizar o PNG — e o joga fora
em seguida. É só levá-lo adiante:

```python
# postgen.py, dentro de gerar()
cards_out.append({
    "n": i, "tipo": c["tipo"], "agente": agente,
    "destaque": c.get("destaque"),
    "html": html,                      # <— o html que o _prep já devolveu
    "png": "data:image/png;base64," + base64.b64encode(png).decode(),
})
```

O `png` continua vindo. Ele não é redundante: é o que garante que a peça entre inteira mesmo se o
desenho tiver algum problema.

## Um cuidado que faz o HTML funcionar do nosso lado

**O HTML não pode depender de nada que esteja fora dele.**

Desenhamos o HTML recebido **com a rede bloqueada** — é HTML vindo de outro sistema, então é regra
de segurança nossa. Qualquer `file://`, `http://` ou `https://` dentro dele (imagem, fonte, folha
de estilo) simplesmente não carrega.

O ponto que já sabemos que precisa de ajuste é a capa. Em `_prep()`, a foto gerada é gravada num
arquivo temporário e o caminho local entra no HTML:

```python
cf = os.path.join(tempfile.gettempdir(), f"4s_cover_{uuid.uuid4().hex}.png")
open(cf, "wb").write(raw)
css, inner = _html_capa(c, A, "file://" + cf, carrossel)
```

Esse `file:///tmp/...` só existe dentro do container de vocês. Embutindo a imagem resolve:

```python
cover_uri = "data:image/png;base64," + base64.b64encode(raw).decode()
css, inner = _html_capa(c, A, cover_uri, carrossel)
```

Se o `_assets()` já usa data URI, só a capa precisa dessa mudança.

## Como saber que ficou certo

Três checagens, do lado de vocês:

1. O payload enviado tem `cards[].html` preenchido, em todos os cards.
2. Buscar por `file://`, `http://` e `https://` dentro desse HTML **não retorna nada**.
3. Na peça que aparecer no painel, conseguimos clicar num texto da arte e reescrever.

## Enquanto isso não entra

Nada quebra. As artes continuam chegando e sendo publicadas normalmente — só entram como imagem
chapada, e o painel passa a registrar um aviso na peça dizendo que o desenho editável não veio.

Isso está descrito nas seções **3.2** e **3.3** do documento da integração que vocês já têm.

Qualquer dúvida sobre o formato, é só chamar.
