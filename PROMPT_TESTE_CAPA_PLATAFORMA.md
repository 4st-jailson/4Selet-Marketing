# Prompt para testar: quando a capa pede a tela da própria 4Selet

Você pediu isto em 17/08 e eu ficei devendo. É um teste de **um caminho específico**: quando a
capa do carrossel precisa mostrar a plataforma da 4Selet, o painel **não pode** buscar uma foto
qualquer em banco de imagens — nenhum banco tem a nossa tela. Ele tem que parar e te dizer isso.

## Como testar

Abra **Criar Conteúdo › Carrossel** e cole no campo *"O que você quer publicar"*:

```
Carrossel mostrando como é o checkout da 4Selet por dentro, para produtores que estão pensando
em migrar de plataforma. A capa tem que mostrar a tela do nosso próprio checkout — a plataforma
da 4Selet, não uma imagem genérica de tecnologia. Nos slides seguintes, os três passos da
migração e o número de 95% de aprovação no cartão.
```

Clique em **Gerar com IA** e depois em **Salvar peça**.

## O que tem que acontecer

Logo abaixo da "Conferência da marca", no painel da direita, tem que aparecer um aviso **laranja**:

> **A capa ficou sem foto.** A capa pediu a tela da própria 4Selet, e isso não existe em banco de
> imagens.
> *Abra a peça e use "Buscar imagem" para anexar o print, ou capture a tela do site.*

**O que NÃO pode acontecer:** a capa sair com uma foto aleatória de banco (um notebook genérico,
um circuito, uma pessoa mexendo no celular) fingindo ser a nossa plataforma.

## Se o aviso não aparecer

Copie o que apareceu no lugar e me mande. O que decide isso é o campo `fonte` que a IA devolve
junto da busca da capa: quando ela entende que a imagem é *nossa*, marca `fonte: "propria"` e o
painel recusa ir ao banco. Se ela marcar `banco`, o texto do brief não deixou claro que a tela é
a nossa — e aí o ajuste é no prompt do sistema, não na sua escrita.

## Como resolver a peça depois do aviso

Duas saídas, as duas dentro do painel:

1. **Capturar do site** — abra a peça, vá em *Imagem* › *Capturar de um site*, cole o endereço da
   página do checkout. O painel abre a página, tira o print e aplica na capa.
2. **Enviar um print** — se você já tem a imagem no computador, *Imagem* › *Enviar um arquivo*.

Em qualquer um dos dois, a capa passa a usar o layout **Foto** automaticamente.
