# Implementar o envio dos posts para o Painel de Marketing 4Selet

**Para:** quem desenvolve o `radar-api` / `squad.4st.co`
**O que fazer:** construir, no sistema do squad, o envio automático de cada post gerado para o
painel de marketing da 4Selet, via webhook HTTP.

> **Como usar este documento:** ele é a especificação completa do lado que RECEBE (o painel) e o
> roteiro do lado que ENVIA (o squad). Dá para entregá-lo direto a um desenvolvedor ou a um
> assistente de código com acesso ao repositório do `radar-api`.
>
> Tudo que está afirmado aqui sobre o `radar-api` foi lido no código, em
> `/home/sysadmin/ai-squad/repo/`, com arquivo e linha citados — os dois sistemas rodam no mesmo
> servidor. Se algo divergir do código atual, o código manda: avise, porque foi nele que a
> especificação se baseou.

---

## 1. Por que isto existe

A 4Selet tem duas ferramentas que hoje não se falam, com um passo manual entre elas.

**O squad** (`squad.4st.co`) é o lado da **criação**: lê o radar, escolhe a pauta, escreve os
textos, gera as imagens e monta o post. Quando o post fica pronto, ele termina ali — e alguém
precisa baixar o ZIP e subir à mão no outro sistema.

**O painel de marketing** (`mkt.4st.co`) é o lado da **operação e da publicação**: é onde o post é
revisado visualmente, ajustado, agendado e publicado no Instagram (@4selet), com histórico do que
saiu. Ele tem controle de estados por peça (rascunho → em revisão → aprovada) e uma trava de
integridade: peça aprovada é "selada" com assinatura por arquivo, e só publica se as assinaturas
baterem na hora do post.

**Esta integração elimina o passo manual.** O post gerado no squad chega ao painel sozinho, já em
**Aprovados**, marcado como vindo do squad, pronto para publicar ou ajustar.

### A divisão de responsabilidades

| | **Squad (vocês)** | **Painel de marketing** |
|---|---|---|
| Escolher a pauta e escrever | ✔ | — |
| Gerar as imagens dos cards | ✔ | — |
| **Revisar o conteúdo** | ✔ | — |
| **Avisar que o post está pronto** | ✔ ← *é o que este documento pede* | — |
| Guardar, versionar e organizar | — | ✔ |
| Ajustar a arte (mover, acrescentar, corrigir) | — | ✔ |
| Agendar e publicar no Instagram | — | ✔ |
| Histórico do que foi publicado | — | ✔ |

O painel **não revisa o conteúdo de novo e não re-gera nada**. A arte entra direto em Aprovados
justamente porque a revisão já aconteceu do lado do squad. Isso é uma responsabilidade que fica
com vocês.

---

## 2. O contrato do receptor (o que o painel expõe)

Esta seção é a fonte da verdade. Implementem contra ela.

### 2.1 Endereço e autenticação

```
POST https://mkt.4st.co/api/squad/webhook
```

A autenticação é por **token compartilhado**, aceito de três formas — usem a que for mais
conveniente:

| Forma | Como |
|---|---|
| Query string | `POST https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN` |
| Cabeçalho próprio | `X-Painel-Token: SEU_TOKEN` |
| Bearer padrão | `Authorization: Bearer SEU_TOKEN` |

O token é gerado no painel e entregue por canal separado deste documento. Sem ele, a resposta é
`401` e nada entra. Barra no fim do caminho (`/api/squad/webhook/`) funciona normalmente.

**Recomendação:** guardem o token como credencial, não no código. Se usarem a query string,
lembrem que ela costuma aparecer em log de servidor — o cabeçalho é mais limpo.

### 2.2 Os eventos

O campo `evento` diz **o que aconteceu do lado do squad**. A lista é fechada: evento desconhecido
é recusado com uma mensagem dizendo quais valem — nunca é tratado como "arte pronta". Se o campo
não vier, o painel assume `post.pronto`.

#### `post.pronto` — a arte ficou pronta *(o principal)*

O post foi gerado e revisado. O painel cria a peça e a deixa em **Aprovados**.

*Quando disparar:* quando o post for aprovado internamente por vocês — seja um clique do usuário,
seja automaticamente ao fim da geração. Reenviar o mesmo `post_id` é seguro: o painel reconhece e
**não duplica**.

```json
{ "evento": "post.pronto", "post_id": 412, "legenda": "...", "cards": [ ... ] }
```

#### `post.atualizado` — a arte do mesmo post foi refeita

*Este evento é obrigatório se vocês permitirem regerar um post.* Sem ele, o reenvio é entendido
como repetição e **a arte nova é descartada** — o painel não tem como adivinhar que o conteúdo
mudou se o `post_id` é o mesmo.

Com ele, o painel cria uma **peça nova** e guarda o vínculo com a anterior (a peça mostra "esta é
uma versão refeita" e um link para a antiga). A anterior **não é sobrescrita**: ela pode já ter
sido editada, agendada ou publicada, e essa decisão é de quem opera.

```json
{ "evento": "post.atualizado", "post_id": 412, "legenda": "...", "cards": [ ... ] }
```

#### `post.cancelado` — o post foi cancelado no squad

O painel **não apaga nada**. Ele marca a peça com um aviso visível (motivo e data) e registra a
ocorrência. Se a peça já tiver sido publicada, o aviso deixa claro que cancelar aqui não desfaz a
publicação. Não precisa mandar `cards`.

```json
{ "evento": "post.cancelado", "post_id": 412, "motivo": "a pauta saiu do ar" }
```

#### `teste` — conferir a ligação sem criar nada

Não cria peça, não suja Aprovados; só confirma URL e token, e fica registrado na tela do painel.
Útil ao ligar a integração e depois de qualquer troca de token.

```json
{ "evento": "teste" }
```

### 2.3 O payload, campo a campo

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
| `post_id` | **sim** (exceto no `teste`) | Chave da não-duplicação. Aceita `id` como sinônimo. |
| `cards` | **sim** (nos eventos com arte) | 1 a 10 itens. Aceita `artes` como sinônimo. |
| `cards[].png` | sim, se não houver `html` | Data URI `data:image/png;base64,…`. PNG ou JPEG, até 15 MB por card. |
| `cards[].html` | não, mas **muito recomendado** | O desenho editável. Precisa ser autossuficiente (ver 3.3). |
| `cards[].n` | não | Ordem. Sem ele, vale a ordem da lista. |
| `cards[].largura` / `altura` | não | Só se o HTML não declarar. Sem nada, o painel assume 1080×1350. |
| `legenda` | não | Vira a legenda da publicação. Pode vir sem hashtag. |
| `hashtags` | não | Lista; o painel junta à legenda. |
| `titulo` | não | Vira o nome da peça. Sem ele, o painel usa o começo da legenda. |
| `formato` | não | `carrossel`, `post_unico` ou `reel`. Sem ele, o painel deduz pelo número de cards (mais de um = carrossel). |
| `pauta` | não | Aparece na peça, ajuda a lembrar de onde veio a ideia. Aceita `foco` e `justificativa`. |
| `motivo` | não | Só no `post.cancelado`. |

**Limites que valem conhecer:**
- **Máximo 10 cards** — é o limite do carrossel do Instagram. Vindo mais, o painel recusa a entrega
  **inteira**, de propósito: melhor recusar do que aceitar uma peça que sairia pela metade.
- **15 MB por card**, 80 MB no corpo inteiro.
- `formato: "reel"` é aceito e guardado, mas o painel não publica vídeo hoje: a peça entra marcada
  para postagem manual, e isso fica visível na tela.

### 2.4 As respostas

**A resposta é rápida e não espera a peça ficar pronta.** Montar um carrossel do lado do painel
leva mais de 30 segundos (é um navegador por card, mais duas etapas de aprovação). Se a resposta
esperasse tudo, vocês veriam erro de tempo esgotado em **toda entrega bem-sucedida**.

| Situação | HTTP | Corpo |
|---|---|---|
| Entrega aceita | 200 | `{"ok": true, "recebido": true, "requisicao": "<id>", "cards": 5, "formato": "carrossel"}` |
| Mesmo `post_id` de novo | 200 | `{"ok": true, "ja_recebido": true, "peca": "…"}` |
| Teste de conexão | 200 | `{"ok": true, "teste": true, "pronto_para_receber": true}` |
| Cancelamento registrado | 200 | `{"ok": true, "cancelado": true, "peca": "…"}` |
| Token errado ou ausente | 401 | `{"ok": false, "erro": "token inválido"}` |
| Problema com o conteúdo | 200 | `{"ok": false, "erro": "…", "requisicao": "<id>"}` |

`"ok": true, "recebido": true` significa **"chegou, está guardado, estou montando"** — não "a peça
está pronta". O resultado final aparece na tela de Requisições do painel; vocês não precisam
consultar nada depois.

**Só o token responde com erro de HTTP.** Todo o resto responde 200 e vocês olham o campo `ok`,
inclusive quando o conteúdo veio errado. É de propósito: a entrega chegou e ficou guardada no
painel, então o problema se resolve de lá (existe um botão de reprocessar) sem vocês reenviarem.
Se fosse 4xx/5xx, um cliente HTTP trataria como queda de rede e o rastro se perderia.

---

## 3. O que implementar no squad

### 3.0 Ponto de partida: parte disso já está escrito

Antes de começar do zero, reaproveitem o que existe. Em `radar-api/app/main.py`, **linha 1143**
(verificado no servidor em 17/08/2026), há um endpoint de envio já pronto e desligado:

```python
@app.post("/api/pautas4selet/posts/{post_id}/enviar")
def pauta_enviar(post_id: int, user=Depends(auth.get_current_user)):
    """Envia o post pra outro sistema via webhook. Inativo ate o webhook ser cadastrado."""
    cred = _get_credencial("webhook_post")
    if not cred:
        return {"ok": False, "motivo": "webhook ainda nao configurado"}
    d = postgen.obter_post(post_id, emp)
    ...
    r = httpx.post(cred, json={"post_id": post_id, "legenda": d["resultado"].get("legenda"),
                               "cards": [c["png"] for c in d["resultado"].get("cards", [])]}, timeout=30)
```

Ele responde `"webhook ainda nao configurado"` porque a integração `webhook_post` não está
cadastrada — conferido no banco do radar, que hoje tem `apify`, `claude`, `elevenlabs`, `gemini` e
`magnific`, e nenhuma `webhook_post`.

Ou seja: **existe uma base funcional**, e o trabalho abaixo é completá-la. Se preferirem
reescrever, o contrato da seção 2 é o que importa.

### 3.1 Guardar a configuração

Cadastrar a integração `tipo=webhook_post` com a URL de destino:

```
https://mkt.4st.co/api/squad/webhook?token=<<COLE_AQUI_O_TOKEN>>
```

O código atual usa a credencial **como a URL inteira** (`httpx.post(cred, ...)`), então o token na
query funciona sem alterar nada. Se forem mexer no código de qualquer forma, prefiram separar:
guardem a URL e o token em campos distintos e mandem o token no cabeçalho `X-Painel-Token`.

**Aceite:** `_get_credencial("webhook_post")` retorna a URL, e um `GET` nela com o token responde
`{"ok":true,"pronto_para_receber":true}`.

### 3.2 Levar o HTML de cada card junto com a imagem

Hoje o payload leva só o PNG. Com apenas a imagem, o operador do painel consegue mexer **em cima**
da arte (mover, acrescentar texto, logo, formas), mas não **dentro** dela — não dá para corrigir
uma palavra do título nem trocar um número, porque tudo já virou pixel.

O HTML já existe no processo: em `postgen.py`, `_prep()` retorna `(html, agente, custo)` e
`gerar()` usa esse html para renderizar o PNG — e depois **descarta**. Basta levá-lo adiante:

```python
# postgen.py, dentro de gerar()
cards_out.append({
    "n": i, "tipo": c["tipo"], "agente": agente,
    "destaque": c.get("destaque"),
    "html": html,                      # <— o html que o _prep já devolveu
    "png": "data:image/png;base64," + base64.b64encode(png).decode(),
})
```

```python
# main.py, no envio
r = httpx.post(cred, json={
    "evento": "post.pronto",
    "post_id": post_id,
    "legenda": d["resultado"].get("legenda"),
    "cards": d["resultado"].get("cards", []),     # objetos completos, com html + png
}, timeout=30)
```

O painel aceita as duas formas — lista de strings (como é hoje) ou lista de objetos — então isso
pode ser feito em qualquer ordem, sem quebrar nada no meio do caminho.

**Aceite:** o payload enviado contém `cards[].html` não vazio, e a peça criada no painel permite
editar o texto por dentro.

### 3.3 Tornar o HTML autossuficiente

**Esta é a parte que falha em silêncio se ninguém cuidar.**

Em `_prep()`, a capa gera a foto com o Nano Banana, grava num arquivo temporário e embute o
**caminho local** dentro do HTML:

```python
cf = os.path.join(tempfile.gettempdir(), f"4s_cover_{uuid.uuid4().hex}.png")
open(cf, "wb").write(raw)
css, inner = _html_capa(c, A, "file://" + cf, carrossel)
```

Esse `file:///tmp/...` só existe **dentro do container do squad**. O mesmo vale para qualquer
imagem, fonte ou folha de estilo carregada por `https://`: o painel desenha o HTML recebido **com
a rede bloqueada** (é HTML vindo de fora — é regra de segurança), e o navegador, na hora de
editar, também barra recurso externo.

Conserto: embutir a imagem no próprio HTML.

```python
cover_uri = "data:image/png;base64," + base64.b64encode(raw).decode()
css, inner = _html_capa(c, A, cover_uri, carrossel)
```

**Regra geral: o HTML enviado não pode depender de nada que esteja fora dele.** Se o `_assets()`
já usa data URI (o `_b64(p, mime)` sugere que sim), só a capa precisa de ajuste.

> O painel **não deixa isso virar arte quebrada**: se o desenho depender de algo que não veio
> junto, ele usa a imagem pronta do mesmo card e registra um aviso explicando a limitação. A peça
> sai inteira — só perde a edição por dentro. Ninguém publica um card com buraco por acidente.

**Aceite:** buscar por `file://`, `http://` e `https://` no HTML gerado não retorna nada.

### 3.4 Disparar os eventos nos momentos certos

| Momento no squad | Evento a enviar |
|---|---|
| Post gerado e aprovado internamente | `post.pronto` |
| Post regerado depois de já ter sido enviado | `post.atualizado` |
| Post cancelado/descartado depois de já ter sido enviado | `post.cancelado` |
| Botão "testar conexão" na tela de integrações | `teste` |

O ponto crítico é o `post.atualizado`: se houver qualquer caminho no sistema que refaça a arte de
um post já enviado, ele precisa disparar esse evento — senão o painel entende como repetição e a
arte nova se perde.

**Aceite:** regerar um post já enviado e reenviar produz uma peça nova no painel, e a anterior
continua lá.

### 3.5 Tratar a resposta

```python
try:
    r = httpx.post(url, json=payload, headers={"X-Painel-Token": token}, timeout=30)
    dados = r.json()
except Exception as e:
    # falha de rede: registrar e permitir reenvio manual
    registrar_falha(post_id, str(e)); return

if r.status_code == 401:
    alertar("Token do painel de marketing inválido ou não cadastrado")
elif not dados.get("ok"):
    # chegou, mas não virou peça — a mensagem vem em português, pronta para exibir
    alertar(dados.get("erro"))
else:
    marcar_enviado(post_id, requisicao=dados.get("requisicao"))
```

Mostrem o campo `erro` na tela de vocês quando `ok` for `false`: a mensagem já vem escrita para
uma pessoa ler, e quase sempre indica algo que se resolve do lado do painel.

**Aceite:** um envio com `cards: []` mostra na tela do squad a frase que o painel devolveu, em vez
de um erro genérico.

### 3.6 Reenvio

Reenviar é seguro e não precisa de trava do lado de vocês: o painel usa o `post_id` para não criar
a mesma peça duas vezes, inclusive enquanto a primeira ainda está sendo montada. Se implementarem
repetição automática em caso de falha de rede, podem repetir à vontade.

---

## 4. Como testar

**Passo 1 — a porta responde?** (não cria nada)

```bash
curl -sS "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN"
```

Esperado: `{"ok":true,"servico":"painel-4selet","pronto_para_receber":true}`.
Se vier `401`, o token está errado ou ainda não foi cadastrado no painel.

**Passo 2 — o evento de teste pelo próprio código de vocês** (não cria nada)

```bash
curl -sS -X POST "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"evento":"teste"}'
```

**Passo 3 — ponta a ponta, com um card de verdade**

```bash
curl -sS -X POST "https://mkt.4st.co/api/squad/webhook?token=SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"post_id":999,"legenda":"teste de conexao","cards":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="]}'
```

Voltando `{"ok": true, ...}`, está conectado. A peça de teste aparece no painel e é descartada de lá.

**Passo 4 — um post real**, com HTML incluído, conferindo no painel que dá para editar o texto por
dentro da arte.

> **Atenção ao endereço:** é `/api/squad/webhook`. Se aparecer `/api/webhook/squad` em algum
> lugar, está invertido.

---

## 5. Checklist de entrega

- [ ] Integração `webhook_post` cadastrada com a URL + token
- [ ] `cards[].html` incluído no payload
- [ ] Capa (e qualquer outro recurso) embutida como data URI — nenhum `file://` ou `https://` no HTML
- [ ] `evento` declarado no envio
- [ ] `post.atualizado` disparado quando um post já enviado é regerado
- [ ] `post.cancelado` disparado quando um post já enviado é cancelado
- [ ] Resposta tratada: `401` alerta credencial, `ok:false` mostra o `erro` na tela
- [ ] Passos 1 a 4 da seção 4 executados com sucesso

Dúvidas sobre o lado do painel: falar com o Hugo, que tem o contato de quem o mantém.
