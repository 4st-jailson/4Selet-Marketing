# Integração squad.4st.co → Painel de Marketing 4Selet

**Para:** time que mantém o `radar-api` / `squad.4st.co`
**Assunto:** entregar os posts gerados por vocês direto no painel de marketing
**Esforço estimado:** o mínimo é cadastrar uma URL (zero código). O ideal são ~4 linhas em `postgen.py` e `main.py`.

---

## 1. O contexto: dois sistemas, um fluxo só

Hoje a 4Selet tem **duas ferramentas que não se falam**, e um passo manual entre elas.

**O sistema de vocês** (`squad.4st.co`) é o lado da **criação**: lê o radar, escolhe a pauta, escreve
os textos, gera as imagens e monta o post. Quando o post fica pronto, ele termina lá — e alguém
precisa baixar o ZIP e subir à mão no outro lado.

**O painel de marketing** (`mkt.4st.co`) é o lado da **operação e da publicação**. É onde o Hugo
revisa, ajusta a arte, agenda e publica no Instagram (@4selet), com um histórico do que já saiu.
Ele tem um controle de estados por peça — rascunho, em revisão, aprovada — e uma trava de
integridade: uma peça aprovada é "selada" (assinatura por arquivo), e só publica se as assinaturas
baterem na hora do post. Isso existe para garantir que o que foi liberado é exatamente o que vai ao ar.

**O que esta integração faz:** elimina o passo manual. O post que vocês geraram chega no painel
sozinho, já em **Aprovados**, marcado como vindo do squad, pronto para o Hugo publicar ou ajustar.

### Quem faz o quê

| | **Sistema do squad** | **Painel de marketing** |
|---|---|---|
| Escolher a pauta e escrever | ✔ | — |
| Gerar as imagens dos cards | ✔ | — |
| **Revisar o conteúdo** | ✔ (a revisão de conteúdo é de vocês) | — |
| Avisar que o post está pronto | ✔ (é o webhook) | — |
| Guardar, versionar e organizar | — | ✔ |
| Ajustar a arte (mover, acrescentar, corrigir) | — | ✔ |
| Agendar e publicar no Instagram | — | ✔ |
| Histórico do que foi publicado | — | ✔ |

Repare no que **não** está pedido: o painel não vai revisar o conteúdo de novo, nem re-gerar nada.
A arte chega em Aprovados justamente porque a revisão já aconteceu do lado de vocês.

---

## 2. A boa notícia: o emissor já existe

Vocês já construíram isto. Em `radar-api/app/main.py`:

```python
@app.post("/api/pautas4selet/posts/{post_id}/enviar")
def pauta_enviar(post_id: int, user=Depends(auth.get_current_user)):
    """Envia o post pra outro sistema via webhook. Inativo ate o webhook ser cadastrado."""
    cred = _get_credencial("webhook_post")
    if not cred:
        return {"ok": False, "motivo": "webhook ainda nao configurado"}
    ...
```

Ele responde `"webhook ainda nao configurado"` porque a integração `webhook_post` está vazia.
**Cadastrar a URL já liga tudo.**

---

## 3. O que fazer — em três níveis

### Nível 1 — obrigatório: cadastrar a URL (nada de código)

Cadastrem a integração `tipo=webhook_post` com esta URL:

```
https://mkt.4st.co/api/squad/webhook?token=<<COLE_AQUI_O_TOKEN>>
```

O token vem junto com este documento, por canal separado. Ele é a senha da porta: sem ele, o
painel devolve `401` e não recebe nada.

> **Por que o token vai na URL:** o emissor de vocês chama `httpx.post(cred, json=...)` sem
> `headers=`, e `cred` é a URL inteira. Então a query é o único jeito de autenticar **sem vocês
> mexerem em código**. Se forem tocar nessa função de qualquer forma, prefiram o cabeçalho
> `X-Painel-Token: <token>` — aí a URL fica limpa, sem o `?token=`. O painel aceita os dois.

Com só isso já funciona: o post chega, vira peça, com a legenda e os cards na ordem certa.

### Nível 2 — recomendado: mandem o HTML de cada card

Hoje o payload leva só o PNG. Com a imagem, o Hugo mexe **em cima** da arte (mover, acrescentar
texto, logo, formas), mas não mexe **dentro** dela — não dá para corrigir uma palavra do título
ou trocar um número, porque virou pixel.

E vocês **já têm o HTML**: em `postgen.py`, `_prep()` retorna `(html, agente, custo)`, o `gerar()`
usa esse html para renderizar o PNG — e depois **descarta**. Basta levá-lo junto:

```python
cards_out.append({
    "n": i, "tipo": c["tipo"], "agente": agente,
    "destaque": c.get("destaque"),
    "html": html,                      # <— o html que o _prep já devolveu
    "png": "data:image/png;base64," + base64.b64encode(png).decode(),
})
```

E no `enviar`, mandar o card inteiro em vez de só o PNG:

```python
r = httpx.post(cred, json={
    "evento": "post.pronto",
    "post_id": post_id,
    "legenda": d["resultado"].get("legenda"),
    "cards": d["resultado"].get("cards", []),     # objetos completos, com html + png
}, timeout=30)
```

O painel aceita **as duas formas** — lista de strings (como é hoje) ou lista de objetos. Nada
quebra enquanto vocês não mexerem.

### Nível 3 — a pegadinha que estraga em silêncio

Em `_prep()`, a capa gera a foto com o Nano Banana, grava num arquivo temporário e embute o
**caminho local** dentro do HTML:

```python
cf = os.path.join(tempfile.gettempdir(), f"4s_cover_{uuid.uuid4().hex}.png")
open(cf, "wb").write(raw)
css, inner = _html_capa(c, A, "file://" + cf, carrossel)
```

Esse `file:///tmp/...` só existe **dentro do container de vocês**. O mesmo vale para qualquer
imagem, fonte ou folha de estilo carregada por `https://`: o painel desenha o HTML recebido **com
a rede bloqueada** (é HTML de terceiro, é regra de segurança), e o navegador, na hora de editar,
também barra recurso externo.

O conserto é embutir no próprio HTML:

```python
cover_uri = "data:image/png;base64," + base64.b64encode(raw).decode()
css, inner = _html_capa(c, A, cover_uri, carrossel)
```

**Regra geral: o HTML precisa ser autossuficiente.** Se o `_assets()` já usa data URI (o
`_b64(p, mime)` sugere que sim), só a capa precisa de ajuste.

> **O painel não deixa isso virar arte quebrada.** Se o desenho depender de algo que não veio
> junto, ele usa a imagem pronta do mesmo card (que está correta), registra um aviso explicando,
> e mostra esse aviso na peça. A peça sai inteira — só perde a edição por dentro. Ninguém publica
> um card com buraco por acidente.

---

## 4. Os eventos que o painel espera receber

O campo `evento` diz **o que aconteceu do lado de vocês**. A lista é fechada: evento desconhecido
é recusado com uma mensagem dizendo quais valem — nunca tratado como "arte pronta".

**Se vocês não mandarem `evento`, o painel assume `post.pronto`.** Ou seja, o emissor atual
continua funcionando sem alteração nenhuma.

### `post.pronto` — a arte ficou pronta *(o principal)*

O post foi gerado e revisado por vocês. O painel cria a peça e a deixa em **Aprovados**.

Enviar quando: o usuário de vocês clicar em enviar, ou automaticamente ao fim da geração.
Reenviar o mesmo `post_id` é seguro — o painel reconhece e **não duplica**.

```json
{ "evento": "post.pronto", "post_id": 412, "legenda": "...", "cards": [ ... ] }
```

### `post.atualizado` — vocês refizeram a arte do mesmo post

Este existe por um motivo concreto: se vocês regerarem um post e reenviarem como `post.pronto`,
o painel entende como repetição e **descarta a arte nova**. Com `post.atualizado`, ela entra.

O painel cria uma **peça nova** e guarda o vínculo com a anterior (a peça mostra "esta é uma
versão refeita" e um link para a antiga). A anterior **não é sobrescrita** — ela pode já ter sido
editada, agendada ou publicada, e essa decisão é de quem opera, não nossa.

```json
{ "evento": "post.atualizado", "post_id": 412, "legenda": "...", "cards": [ ... ] }
```

### `post.cancelado` — vocês desistiram do post

O painel **não apaga nada**. Ele marca a peça com um aviso visível ("o time do squad cancelou
este post", com o motivo e a data) e registra a ocorrência. Se a peça já tiver sido publicada, o
aviso deixa isso claro — cancelar aqui não desfaz uma publicação que já aconteceu.

Não precisa mandar `cards`.

```json
{ "evento": "post.cancelado", "post_id": 412, "motivo": "a pauta saiu do ar" }
```

### `teste` — conferir a ligação sem criar nada

Útil no dia de ligar a integração e depois de qualquer troca de token. Não cria peça, não suja
Aprovados — só confirma que a URL e o token estão certos, e fica registrado na tela de Requisições.

```json
{ "evento": "teste" }
```

---

## 5. O payload, campo a campo

```json
{
  "evento": "post.pronto",
  "post_id": 412,
  "titulo": "Seu público trocou o CPF pelo CNPJ",
  "formato": "carrossel",
  "legenda": "Texto da legenda, voz 4Selet, sem hashtag.",
  "hashtags": ["#4Selet"],
  "pauta": "split payment da reforma tributária",
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

| Campo | Obrigatório | O que faz |
|---|---|---|
| `evento` | não | O que aconteceu. Sem ele, vale `post.pronto`. |
| `post_id` | **sim** (exceto no `teste`) | É a chave da não-duplicação. Aceita `id` como sinônimo. |
| `cards` | **sim** (nos eventos com arte) | 1 a 10 itens. Aceita `artes` como sinônimo. |
| `cards[].png` | sim, se não houver `html` | Data URI `data:image/png;base64,…`. PNG ou JPEG, até 15 MB por card. |
| `cards[].html` | não | O desenho editável. Precisa ser autossuficiente (ver item 3). |
| `cards[].n` | não | Ordem. Sem ele, vale a ordem da lista. |
| `cards[].largura` / `altura` | não | Só se o HTML não declarar. Sem nada, o painel assume 1080×1350. |
| `legenda` | não | Vai para a legenda da publicação. Pode vir sem hashtag. |
| `hashtags` | não | Lista; o painel junta à legenda. |
| `titulo` | não | Vira o nome da peça. Sem ele, o painel usa o começo da legenda. |
| `formato` | não | `carrossel`, `post_unico` ou `reel`. Sem ele, o painel deduz pelo número de cards (mais de um = carrossel) — a mesma regra que vocês usam. |
| `pauta` | não | Aparece na peça, ajuda a lembrar de onde veio a ideia. Aceita `foco` e `justificativa`. |
| `motivo` | não | Só no `post.cancelado`. |

**Sobre `formato: "reel"`:** é aceito e guardado, mas o painel não publica vídeo hoje. A peça
entra marcada para postagem manual, e isso fica visível na tela. Melhor receber e avisar do que
recusar e perder.

**Limite de 10 cards:** é o limite do carrossel do Instagram. Vindo mais, o painel recusa a
entrega **inteira** — de propósito, para vocês não receberem um "ok" de uma peça que sairia pela metade.

---

## 6. Como o painel responde

**A resposta é rápida e não espera a peça ficar pronta.** Isto importa para vocês: o
`httpx.post(..., timeout=30)` desiste em 30 segundos, e montar um carrossel do lado de cá leva
mais que isso (é um navegador por card, mais duas etapas de aprovação). Se a resposta esperasse
tudo, vocês veriam **erro de tempo esgotado em toda entrega bem-sucedida** — e o reenvio criaria
uma peça duplicada.

| Situação | HTTP | Corpo |
|---|---|---|
| Entrega aceita | 200 | `{"ok": true, "recebido": true, "requisicao": "<id>", "cards": 5, "formato": "carrossel"}` |
| Mesmo `post_id` de novo | 200 | `{"ok": true, "ja_recebido": true, "peca": "…"}` |
| Teste de conexão | 200 | `{"ok": true, "teste": true, "pronto_para_receber": true}` |
| Cancelamento registrado | 200 | `{"ok": true, "cancelado": true, "peca": "…"}` |
| Token errado ou ausente | 401 | `{"ok": false, "erro": "token inválido"}` |
| Problema com o conteúdo | 200 | `{"ok": false, "erro": "…", "requisicao": "<id>"}` |

`"ok": true, "recebido": true` quer dizer **"chegou, está guardado, estou montando"** — não "a
peça está pronta". O resultado final aparece na tela de Requisições do painel; vocês não precisam
consultar nada depois.

**Só o token responde com erro de HTTP.** Todo o resto responde 200 e vocês olham o campo `ok` —
inclusive quando o conteúdo veio errado. É de propósito: a entrega chegou e ficou guardada aqui,
então o problema se resolve deste lado (o Hugo reprocessa pela tela) sem vocês reenviarem. Se
devolvêssemos 4xx/5xx, o emissor trataria como queda de rede e o rastro se perderia.

Tratem `ok: false` como "chegou, mas não virou peça" e mostrem o `erro` na tela de vocês: a
mensagem já vem escrita em português, pronta para ler.

---

## 7. Como testar

O teste mais leve não envia nada e não cria nada:

```bash
curl -sS "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN"
```

Esperado: `{"ok":true,"servico":"painel-4selet","pronto_para_receber":true}`.
Se vier `401`, o token está errado ou ainda não foi cadastrado do lado do painel.

Pelo próprio emissor de vocês, o equivalente é mandar o evento de teste:

```bash
curl -sS -X POST "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"evento":"teste"}'
```

E o teste de ponta a ponta, com um card de verdade:

```bash
curl -sS -X POST "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"post_id":999,"legenda":"teste de conexao","cards":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="]}'
```

Se voltar `{"ok": true, ...}`, está conectado. A peça de teste aparece no painel e o Hugo descarta.

> **Atenção ao endereço:** é `/api/squad/webhook`. Se aparecer `/api/webhook/squad` em algum
> lugar, está invertido. Barra no fim (`/api/squad/webhook/`) funciona normalmente.

---

## 8. Resumo do que fazer

1. **Cadastrar** a integração `webhook_post` com a URL + token. *(obrigatório, sem código)*
2. **Incluir `html`** no `cards_out` do `gerar()` e mandar os cards inteiros no `enviar()`. *(2 linhas)*
3. **Trocar o `file://` da capa por data URI** no `_prep()`. *(1 linha)*
4. **Declarar o `evento`** no `enviar()` e mandar `post.atualizado` quando o post for regerado. *(2 linhas)*
5. **Mostrar o `erro`** na tela de vocês quando a resposta vier com `ok: false`.

Dúvida sobre qualquer item, o Hugo tem o contato do lado de cá.
