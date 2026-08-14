# Para o time do squad.4st.co — enviar os posts para o painel de marketing

O painel da 4Selet (`https://mkt.4st.co`) passou a **receber** os posts gerados por vocês. A arte chega
lá dentro como uma peça normal: dá para revisar, editar, agendar e publicar no Instagram.

A boa notícia é que **vocês já construíram o emissor**. Ele está em
`radar-api/app/main.py`, na rota `POST /api/pautas4selet/posts/{post_id}/enviar`, e hoje devolve
`{"ok": false, "motivo": "webhook ainda nao configurado"}` porque a integração `webhook_post` está vazia.

Este documento tem **uma coisa obrigatória** (cadastrar a URL) e **duas melhorias** que valem muito a pena.

---

## 1. Obrigatório: cadastrar a URL (nada de código)

Cadastrem a integração `tipo=webhook_post` com esta URL, exatamente como está, incluindo o token:

```
https://mkt.4st.co/api/squad/webhook?token=COLE_AQUI_O_TOKEN
```

O Hugo passa o token — ele sai de **Configurações › Conexões › Sistema squad** no painel.

Por que o token vai na URL e não num cabeçalho: o emissor de vocês chama
`httpx.post(cred, json=...)` sem `headers=`, e `cred` é a URL inteira. Colocar o token na query é o
único jeito de autenticar **sem vocês mexerem em código**. Se preferirem o jeito mais limpo, o painel
também aceita o cabeçalho `X-Painel-Token: <token>` — aí a URL fica sem o `?token=`. Recomendamos o
cabeçalho se vocês forem tocar nessa função de qualquer forma.

Com só isso, já funciona: o post chega no painel como peça, com a legenda, na ordem certa, marcado
como vindo do squad.

---

## 2. Melhoria importante: mandem o HTML de cada card

Hoje o payload leva só o PNG:

```python
json={"post_id": post_id,
      "legenda": d["resultado"].get("legenda"),
      "cards": [c["png"] for c in d["resultado"].get("cards", [])]}
```

Com só a imagem, o Hugo consegue mexer **em cima** da arte (mover, acrescentar texto, logo, formas),
mas não consegue mexer **dentro** dela — não dá para corrigir uma palavra do título, trocar um número
ou mudar uma cor, porque a essa altura tudo virou pixel.

Só que vocês **já têm o HTML**. Em `postgen.py`, a função `_prep()` retorna `(html, agente, custo)` e o
`gerar()` usa esse html para renderizar o PNG — e depois **descarta**. O `cards_out` guarda só o PNG:

```python
cards_out.append({
    "n": i, "tipo": c["tipo"], "agente": agente,
    "destaque": c.get("destaque"),
    "png": "data:image/png;base64," + base64.b64encode(png).decode(),
})
```

Basta acrescentar uma chave — o valor já está na mão, em `preps`:

```python
cards_out.append({
    "n": i, "tipo": c["tipo"], "agente": agente,
    "destaque": c.get("destaque"),
    "html": html,                      # <— o html que o _prep já devolveu
    "png": "data:image/png;base64," + base64.b64encode(png).decode(),
})
```

E, no `enviar`, mandar o card inteiro em vez de só o PNG:

```python
r = httpx.post(cred, json={
    "post_id": post_id,
    "legenda": d["resultado"].get("legenda"),
    "cards": d["resultado"].get("cards", []),     # objetos completos, com html + png
}, timeout=30)
```

O painel aceita **as duas formas** — lista de strings (como é hoje) ou lista de objetos. Não quebra nada
enquanto vocês não mexerem.

---

## 3. A pegadinha da capa: `file:///tmp` não existe do lado de cá

Esta é a parte que vai dar errado silenciosamente se ninguém avisar.

Em `_prep()`, a capa gera a foto com o Nano Banana, grava num arquivo temporário e embute o caminho
local dentro do HTML:

```python
cf = os.path.join(tempfile.gettempdir(), f"4s_cover_{uuid.uuid4().hex}.png")
open(cf, "wb").write(raw)
css, inner = _html_capa(c, A, "file://" + cf, carrossel)
```

Esse `file:///tmp/4s_cover_xxx.png` só existe **dentro do container de vocês**. Se o HTML viajar assim,
a arte chega no painel com um buraco no lugar da foto — e o pior é que o PNG vem certinho, então parece
que está tudo bem até alguém abrir o editor.

O conserto é embutir a imagem no próprio HTML, como data URI:

```python
cover_uri = "data:image/png;base64," + base64.b64encode(raw).decode()
css, inner = _html_capa(c, A, cover_uri, carrossel)
```

O mesmo vale para qualquer logo, fonte ou textura carregada de fora — **inclusive por `https://`**.
O painel desenha o HTML com a rede bloqueada de propósito (é HTML de terceiro), e o navegador, na
hora de editar, também barra imagem externa. Ou seja: `file://`, `https://` e `//` dão todos no
mesmo resultado. **O HTML precisa ser autossuficiente.** Se vocês já usam data URI em `_assets()`
(o `_b64(p, mime)` sugere que sim), então só a capa precisa de ajuste.

O painel detecta isso e **não deixa virar arte quebrada**: quando o desenho depende de algo que não
veio junto, ele usa a imagem pronta que veio no mesmo card (que está correta) e registra um aviso
explicando que a edição fica limitada. A peça sai inteira de qualquer jeito — só perde a
possibilidade de editar o texto por dentro.

---

## 4. Campos opcionais que melhoram o resultado

Nada aqui é obrigatório; cada um que vier deixa a peça mais completa do lado de cá:

| Campo | Para quê |
|---|---|
| `formato` | `"carrossel"`, `"post_unico"` ou `"reel"`. Sem ele, o painel deduz pelo número de cards (mais de um = carrossel), que é a mesma regra que vocês usam em `postgen.py`. |
| `titulo` | Vira o nome da peça no painel. Sem ele, o painel usa o começo da legenda. |
| `hashtags` | Lista, ex.: `["#4Selet"]`. A legenda de vocês vem sem hashtag por regra — o painel junta na hora de publicar. |
| `pauta` / `justificativa` | Vira anotação na peça, ajuda o Hugo a lembrar de onde veio a ideia. |

Formato `reel` é aceito e guardado, mas o painel **não publica vídeo** hoje: a peça entra marcada
para postagem manual, e isso fica visível na tela. Melhor receber e avisar do que recusar e perder.

---

## 5. Payload completo, do jeito ideal

```json
{
  "post_id": 412,
  "titulo": "Seu público trocou o CPF pelo CNPJ",
  "formato": "carrossel",
  "legenda": "Texto da legenda, voz 4Selet, sem hashtag.",
  "hashtags": ["#4Selet"],
  "cards": [
    {
      "n": 1,
      "tipo": "capa",
      "html": "<!doctype html><html>…</html>",
      "png": "data:image/png;base64,iVBORw0…",
      "largura": 1080,
      "altura": 1350
    },
    { "n": 2, "tipo": "statement", "html": "…", "png": "data:image/png;base64,…" }
  ]
}
```

---

## 6. O que o painel responde

**A resposta é rápida e não espera a peça ficar pronta.** Isso é importante para vocês: o
`httpx.post(..., timeout=30)` do emissor desiste em 30 segundos, e montar um carrossel aqui leva
mais que isso (é um navegador por card, mais duas etapas de aprovação). Se a resposta esperasse
tudo, vocês veriam erro de tempo esgotado **em toda entrega bem-sucedida**, e o reenvio criaria
uma segunda peça do mesmo post.

Então o painel confirma o recebimento na hora e monta em seguida:

| Situação | HTTP | Corpo |
|---|---|---|
| Entrega aceita | 200 | `{"ok": true, "recebido": true, "requisicao": "<id>", "cards": 5, "formato": "carrossel"}` |
| Mesmo `post_id` de novo | 200 | `{"ok": true, "ja_recebido": true, "peca": "…"}` — é idempotente, reenviar não duplica |
| Token errado ou ausente | 401 | `{"ok": false, "erro": "token inválido"}` |
| Problema com o conteúdo | 200 | `{"ok": false, "erro": "…", "requisicao": "<id>"}` |

`"ok": true, "recebido": true` quer dizer **"chegou, está guardado, estou montando"** — não
"a peça está pronta". O resultado final aparece na tela de Requisições do painel, e o Hugo
acompanha por lá. Vocês não precisam consultar nada depois.

Só o token responde com erro de HTTP. **Tudo o mais responde 200 e você olha o campo `ok`** —
inclusive quando o conteúdo veio errado (sem card, imagem corrompida, mais de 10 artes). É de
propósito: a entrega chegou e ficou guardada aqui, então o que falhou se resolve deste lado
(o Hugo reprocessa pela tela) sem vocês reenviarem. Se devolvêssemos 4xx/5xx, o emissor de
vocês trataria como queda de rede e o rastro se perderia.

Tratem `ok: false` como "chegou, mas não virou peça" e mostrem o `erro` na tela de vocês: a
mensagem já vem escrita em português, pronta para ler.

Reenvio é seguro: o painel usa o `post_id` para não criar a mesma peça duas vezes — inclusive
enquanto a primeira ainda está sendo montada.

---

## 7. Como testar

O teste mais leve não envia nada — só confere se a URL e o token estão certos:

```bash
curl -sS "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN"
```

Resposta esperada: `{"ok":true,"servico":"painel-4selet","pronto_para_receber":true}`.
Se vier `401`, o token está errado ou ainda não foi cadastrado do lado do painel.

Para um teste de ponta a ponta, mande um card de verdade:

```bash
curl -sS -X POST "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"post_id":999,"legenda":"teste de conexao","cards":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="]}'
```

Se voltar `{"ok": true, ...}`, está conectado. A peça de teste aparece no painel e o Hugo pode
descartá-la. A entrega fica registrada em **Requisições**, com o que vocês mandaram, para conferência.

> Atenção ao endereço: é `/api/squad/webhook`. Se aparecer `/api/webhook/squad` em algum lugar,
> está invertido.
