# Acento quebrado nas artes: o que aconteceu e o que precisa ser feito

**Para:** time do AI-SQUAD
**De:** 4Selet — painel de marketing (mkt.4st.co)
**Data:** 25/08/2026
**Assunto:** as artes chegam com "NinguÃ©m" no lugar de "Ninguém" — causa, correção já aplicada no código de vocês, e os passos que dependem de vocês

---

## Aviso antes de tudo: mexemos no código de vocês

Com autorização do Hugo, **alteramos um arquivo do `radar-api`**: `app/main.py`.
A mudança está **aplicada no disco mas NÃO está valendo** — o código roda assado na imagem, então
só passa a existir depois de um rebuild (passo 1 abaixo).

- **Backup do arquivo original:** `app/main.py.bak-charset-202608251102` (mesma pasta)
- **Para reverter:** `cp app/main.py.bak-charset-202608251102 app/main.py` e repetir o passo 1
- O diff completo está na seção **"O que mudamos"**, para vocês revisarem antes de subir

Se preferirem escrever a correção de outro jeito, tudo bem — o que importa é o resultado da
seção 4. Restaurem o backup e sigam pelo caminho de vocês.

---

## 1. O sintoma

A entrega de 21/08 (`post_id` **12**, "A porta de entrada do seu produto mudou de lugar") chegou
com todos os acentos corrompidos na **arte desenhada**:

| Devia aparecer | Apareceu |
|---|---|
| Ninguém | NinguÃ©m |
| Operação | OperaÃ§Ã£o |
| você | vocÃª |

A capa do carrossel foi publicada assim. É o padrão clássico de UTF-8 lido como Latin-1.

---

## 2. A causa (medida, não suposta)

**O texto de vocês está certo.** Conferimos o HTML entregue, byte a byte: está em UTF-8 correto,
"Ninguém" com o acento no lugar. O problema não é o conteúdo — é que **ninguém diz qual é a
codificação**.

O HTML de vocês abre assim:

```html
<!doctype html><html><head><style>@font-face{...base64...}
```

Não há `<meta charset="utf-8">`. Sem essa declaração, o navegador que desenha o HTML (usamos
Chromium headless) precisa **adivinhar** a codificação — e ele adivinha olhando só o **começo** do
arquivo.

E aqui está o detalhe que fecha o caso: **a primeira letra de texto dessa arte está no byte
1.146.848**, porque o documento abre com ~1,1 MB de fonte embutida em base64. O detector não
encontra pista nenhuma no trecho que examina, desiste, e assume **windows-1252**.

Reproduzido no servidor de vocês, com o arquivo real:

```
document.characterSet === "windows-1252"
texto lido: "NinguÃ©m mais pergunta pro Google."
```

Com a declaração injetada, o **mesmo arquivo**:

```
document.characterSet === "UTF-8"
texto lido: "Ninguém mais pergunta pro Google."
```

> **Por que só apareceu agora:** artes com pouca fonte embutida têm texto perto do início, e o
> detector acerta sozinho. Quanto mais pesado o cabeçalho, maior a chance de errar. Não é aleatório
> — é o tamanho do preâmbulo que decide.

---

## 3. O que mudamos no `app/main.py`

Duas coisas, e nada mais foi tocado. `python3 -m py_compile app/main.py` passa, e a função foi
testada nos quatro casos (sem charset, já com charset, sem `<head>`, valor nulo).

**a) Um ajudante**, logo após os imports auxiliares (onde `_re` já existe):

```python
def _html_com_charset(html):
    """Garante <meta charset="utf-8"> no HTML do card antes de enviar ao painel."""
    if not html or not isinstance(html, str):
        return html
    if _re.search(r"<meta[^>]+charset", html, _re.I):
        return html
    meta = '<meta charset="utf-8">'
    m = _re.search(r"<head\b[^>]*>", html, _re.I)
    if m:
        return html[:m.end()] + meta + html[m.end():]
    m = _re.search(r"<html\b[^>]*>", html, _re.I)
    if m:
        return html[:m.end()] + "<head>" + meta + "</head>" + html[m.end():]
    return meta + html
```

**b) A montagem dos cards no `pauta_enviar`** passa o `html` por ele:

```diff
-        "cards": [{k: c.get(k) for k in ("n", "tipo", "html", "png", "destaque") if c.get(k) is not None} for c in cards],
+        "cards": [{k: (_html_com_charset(c.get(k)) if k == "html" else c.get(k))
+                   for k in ("n", "tipo", "html", "png", "destaque") if c.get(k) is not None} for c in cards],
```

É idempotente: se o HTML já declarar a codificação, nada é acrescentado.

---

## 4. O que precisa ser feito

### Passo 1 — Subir a correção (obrigatório, só vocês podem)

O stack de vocês é isolado (projeto `radar`). Reconstruir **só a api** — `db` e `web` não são
tocados:

```bash
cd /home/sysadmin/ai-squad/compose
docker compose build api
docker compose up -d api
```

Interrupção esperada: alguns segundos, só na API. O disco do host estava com 50 GB livres em 25/08.

**Conferir que subiu:**

```bash
docker compose ps api
docker exec radar-api grep -c "_html_com_charset" app/main.py    # deve responder 3
```

### Passo 2 — Reprocessar a entrega do post 12

Depois do passo 1, reenviem a pauta para o painel. Pela interface de vocês é o botão de enviar da
pauta; pela API:

```
POST /api/pautas4selet/posts/12/enviar
```

O evento sai como `post.atualizado` (o post já foi enviado uma vez) e o painel cria a peça nova.
**Não precisam regerar a arte** — o HTML gravado já está correto; o que faltava era a declaração,
que agora é acrescentada no envio.

### Passo 3 — Preencher o `foco` da pauta (pequeno, mas evita retrabalho)

O `pauta_enviar` manda `titulo` e `pauta` a partir do `foco` da pauta. **Nessa entrega o `foco`
estava vazio**, então o painel caiu no plano B: usar o começo da legenda como nome da peça. O
resultado foi um nome cortado no meio da palavra:

> "A porta de entrada do seu produto mudou de lugar. Uma parte do seu púb"

Já melhoramos o plano B do nosso lado (passamos a usar a primeira frase inteira). Mas o nome bom
mesmo é o que vocês escrevem. **Preencham o `foco` da pauta** e ele vira o título da peça.

### Passo 4 — A versão 9:16 das artes (pedido que continua aberto)

Segue valendo o que está em **`SQUAD_FORMATO_STORY.md`, seção 4**: mandar o campo irmão opcional
`cards[].story` com a versão vertical da mesma arte.

Enquanto não vem, o painel encaixa a arte de feed em 1080×1920 sozinho — a peça sai inteira, sem
corte, mas com as faixas de cima e de baixo preenchidas pela própria imagem desfocada. **Encaixar
não é desenhar.** Para o Story sair como foi pensado, a arte precisa ser desenhada em 9:16.

Duas observações que valem para quando isso for feito:

- **A instrução "ARRASTE PARA O LADO →" não deve existir na versão de Story.** No carrossel ela
  ensina o gesto certo; no Story, arrastar para o lado **pula o conteúdo**. Hoje o painel remove
  essa instrução sozinho ao converter, mas na arte desenhada por vocês ela simplesmente não deve
  estar lá.
- O `<meta charset="utf-8">` vale para o `story.html` também.

---

## 5. Como conferir que ficou certo

Depois do passo 2, olhem a peça nova no painel. O teste é direto: **a capa precisa dizer
"Ninguém mais pergunta pro Google"**, com o acento.

Se quiserem conferir do lado de vocês antes de enviar, este comando responde sim ou não:

```bash
docker exec radar-api python3 -c "from app.main import _html_com_charset as f; print(f('<html><head></head><body>x</body></html>'))"
```

- **Antes do passo 1** ele falha com `ImportError: cannot import name '_html_com_charset'` — e isso
  é a confirmação de que a correção ainda **não** está valendo (testamos, é o que acontece hoje).
- **Depois do passo 1** ele imprime o HTML com `<meta charset="utf-8">` dentro do `<head>`.

Ou seja: o mesmo comando serve de "antes e depois".

---

## 6. Resumo

| # | O que | Quem | Bloqueia o quê |
|---|---|---|---|
| 1 | `docker compose build api && docker compose up -d api` | **Squad** | Tudo |
| 2 | Reenviar a pauta do post 12 | **Squad** | A peça corrigida |
| 3 | Preencher o `foco` das pautas | **Squad** | Só a qualidade do nome |
| 4 | Mandar `cards[].story` (9:16) | **Squad** | A qualidade do Story |

Do lado da 4Selet já está feito, e sobe no próximo deploy do painel: o HTML que vem de fora passa a
ter a declaração de codificação garantida **na entrada** (mesmo que ela venha, nosso sanitizador
removia as tags `<meta>` — isso foi corrigido), e uma entrega que chegue com acento quebrado da
origem agora vira **aviso visível na peça** em vez de ser publicada calada.

Dúvida em qualquer passo, é só chamar.
