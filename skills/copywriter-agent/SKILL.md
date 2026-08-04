---
name: copywriter-agent
description: >
  Transforma a inteligencia de pesquisa em COPY platform-native da 4Selet: feed do Instagram,
  roteiro de carrossel, legenda de "4Selet na Midia" (aparicao na imprensa), Threads/X e
  LinkedIn. Escolhe o PILAR de conteudo e UM angulo de campanha, mantendo-o coerente entre
  plataformas e adaptando tom, tamanho, CTA e hashtags ao estilo nativo de cada uma. Ancora
  tudo nos knowledge files (brand_identity, product_campaign, platform_guidelines). Use quando
  o usuario pedir "copy", "caption", "legenda", "post", "thread", "roteiro de carrossel",
  "legenda da materia que saiu", ou quando o Orchestrator acionar o Copywriter Agent. NAO gera
  imagem (ad-creative-designer), video (video-ad-specialist) nem publica (distribution-agent).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 2.0.0
  category: marketing
  tags: [copywriting, captions, platform-native, seo, 4selet]
---

# Copywriter Agent

Transforma research em **copy platform-native** da 4Selet. Comporta-se como um membro do time de marketing — alinhado a marca, consistente em campanha, integrado aos agentes anteriores — nao um gerador de texto generico.

## When to Use This Skill

- Usuario pede "copy", "caption", "legenda", "post", "thread", "titulo/descricao de YouTube", "post de LinkedIn".
- O Orchestrator enfileira o job `copywriter_agent` (apos o research).

**NAO use para:** imagem (`ad-creative-designer`), video (`video-ad-specialist`), upload/publicacao (`distribution-agent`).

## CRITICAL: Regra de Re-aprovacao (Workflow de Aprovacao)

Antes de QUALQUER escrita em `outputs/`, esta skill DEVE verificar o caminho.

**Deteccao:** se o caminho comeca com `outputs/approved/`, a task ja foi aprovada por
um humano. Qualquer edicao invalida a aprovacao.

**Acao obrigatoria:** PARAR. NAO escrever, NAO sobrescrever, NAO criar. Avisar:

> A task `<task_name>` (`<task_date>`) esta APROVADA. Para editar, rode:
>
> `node scripts/promote_task.js --task <task_name> --date <task_date> --to in_review`
>
> Isso move a task de volta para `outputs/<task_name>_<task_date>/`. Depois disso, a
> skill pode editar normalmente, e a task precisara ser re-aprovada pelo fluxo padrao.

**Apos confirmacao e execucao:** reler `status.json`, confirmar `status = "in_review"`
e caminho `outputs/<task>_<date>/`, e SO ENTAO retomar.

**Reportar ao final:**

> Aviso: task `<task_name>` saiu de `approved` e voltou para `in_review`. Precisa ser
> re-aprovada antes de publicar.

Inegociavel. Sem excecao para "edicao minima" ou "fix rapido".

## CRITICAL: dois caminhos de execucao (leia antes de escrever qualquer arquivo)

**(a) Painel / pipeline — o caminho principal hoje.** O painel (`interface/`, producao em `https://mkt.4st.co`) gera **uma peca por vez**: cada peca tem UM tipo e grava UM arquivo (o `ct.file` do tipo em `interface/lib/config.js`). Nao existe pacote de 5 arquivos por task, e **`copy.json` nao e escrito por nenhum codigo** do painel nem do pipeline. Antes de gravar, o texto passa por um **gate de governanca em runtime** (`runBrandGovernance`, em `interface/lib/validation.js`): violacao **bloqueia a gravacao com HTTP 422** ("conteudo viola regras de marca"). Emoji banido, por exemplo, e ERRO — nao aviso.

**(b) Execucao manual da skill (CLI/agente).** Aqui vale o pacote `copy/` + `copy.json` consumido pelo distribution-agent. O Quality Checklist deste documento e **condicional ao caminho** usado.

## CRITICAL: reconciliacoes com o contrato real do projeto

- **Tipos de copy que o painel produz** (`interface/lib/config.js`): `instagram_caption` (feed), `instagram_carousel` (roteiro de slides), `media_mention` ("4Selet na Midia"), `linkedin_post`, `threads_post` — alem da copy embutida em `ad_creative` e `video_idea`. **Nao existe tipo de YouTube.**
- **Pilar de conteudo:** toda peca tem um dos 6 pilares como eixo tematico. Ver Step 1.5.
- **Campos do research** (contrato do `marketing-research-agent`): `selected_campaign_angle`, `ad_hooks`, `marketing_angles`, `keywords`, `video_concepts`, `campaign_facts`. (Mapeie: "content_angles" -> `marketing_angles`; "video_ideas" -> `video_concepts`.)
- **Path do research:** `outputs/<task_name>_<date>/research_results.json` — **legado do caminho CLI**; no painel a pesquisa ao vivo entra pelo prompt e as fontes ficam em `status.json.research_sources`.
- **Emoji:** maximo **1 funcional** por caption (regra do `brand_identity.md`) — brand guidelines vencem qualquer guia generico.

## Regra 1 (CRITICAL): referenciar knowledge files primeiro

Antes de gerar QUALQUER copy, carregue:

1. `knowledge/brand_identity.md` -> Voice & Tone, CTAs aprovados/proibidos, regras de emoji, hashtags, frases-tag, What 4Selet Is Not.
2. `knowledge/product_campaign.md` -> Campanha Taxa Zero (numeros), headlines aprovadas, selling points, glossario.
3. `knowledge/platform_guidelines.md` -> Caption Guidelines e Tom por plataforma.

**Em conflito, brand guidelines tem prioridade** sobre qualquer copy generico.

## Step 1 (Regra 2): ler o research output

Se houver `outputs/<task_name>_<date>/research_results.json`, extraia e deixe influenciar o copy:

| Campo do research | Influencia |
|-------------------|-----------|
| `selected_campaign_angle` | o angulo unico (ver Step 2) |
| `ad_hooks` | hooks de abertura das captions/titulos |
| `marketing_angles` | variacoes de mensagem |
| `keywords` | YouTube tags + termos da description |
| `campaign_facts` | numeros corretos (0% / R$1,99 / D+10 / D+30 / 95%) |

Sem research disponivel: ancore no **pilar escolhido** (Step 1.5) e nos knowledge files, e declare isso.

## Step 1.5: escolher o PILAR de conteudo (antes do angulo)

O pilar e o eixo tematico da peca. Sao 6 (`interface/lib/config.js`, `CONTENT_PILLARS`):

| Pilar (`id`) | Angulo | Reflexo na copy |
|---|---|---|
| `taxa_zero` | A oferta ativa (0% por 3 meses ou R$ 300 mil, R$ 1,99, PIX D+10) | Numeros da campanha, convite, transparencia. `#TaxaZero` cabe aqui |
| `educacional` | Ensina estrategia/gestao/financas do negocio digital | Autoridade que educa. **Sem empurrar oferta**; CTA suave ou nenhum |
| `curiosidade_mercado` | Dado pouco obvio sobre plataformas, checkout, juros | Provocacao com numero; mercado sempre em abstrato |
| `prova_plataforma` | Diferenciais verificaveis (95% de aprovacao, prazos, gestor) | Mostra resultado, nao promete |
| `novidade` | Lancamento/atualizacao ou movimento de mercado | O que muda na pratica para a operacao |
| `motivacional` | Mentalidade e decisao de longo prazo | Sobrio; inspiracao ancorada em raciocinio concreto |

> **Regra dura de variedade** (injetada no prompt do painel): *"Mantenha a variedade real do feed 4Selet: NEM toda peca e sobre Taxa Zero. Respeite o pilar como eixo tematico, ainda que a campanha ativa exista."* Taxa Zero e **um** pilar, nao o default.

## Step 2 (Regra 3): selecionar UM angulo de campanha

Use o `selected_campaign_angle` do research (ex.: *"Migracao sem perder margem: 0% por 3 meses ou ate R$ 300 mil"*). Esse angulo deve permanecer **consistente** em Threads, Instagram, LinkedIn e YouTube — a mensagem-mae nao muda; muda a roupagem por plataforma.

## Step 3 (Regras 4 + 5): copy por plataforma

Cada plataforma no seu estilo nativo. **Nunca** copie texto identico entre plataformas. Specs (de `platform_guidelines.md`):

| Tipo / Plataforma | Tamanho | Hashtags | Emoji | CTA | Tom |
|------------|---------|----------|-------|-----|-----|
| **Feed Instagram** (`instagram_caption`) | 1–3 frases antes das hashtags | 3–5, `#4Selet` obrigatoria | máx 1 funcional (`→`) | **condicional** (ver abaixo) | Editorial, sobrio, com numero |
| **Carrossel** (`instagram_carousel`) | roteiro de 4–7 slides + caption | 3–5, `#4Selet` obrigatoria | máx 1 na caption | condicional (slide de CTA no fim) | Editorial; capa-gancho → desenvolvimento → fecho |
| **4Selet na Midia** (`media_mention`) | 1–3 frases de prova social | 3–5 com `#4Selet` + `#NaMidia`, **sem `#TaxaZero`** | máx 1 | suave ou **vazio** | Sobrio, de quem foi reconhecido. **Nao inventar trechos da materia** |
| **Threads/X** (`threads_post`) | 1–3 frases curtas (≤500 chars) | 0–1 (nunca comecar com #) | máx 1 | opcional (pode fechar com observacao seca) | Provocacao controlada COM dado |
| **LinkedIn** (`linkedin_post`) | 1.200–1.500 chars, hook nas 2 primeiras linhas | 3–5 | 0–1 funcional | suave | Editorial premium, autoridade tecnica |
| **YouTube** *(legado/manual)* | title 60–70 chars + description 2–4 frases | via tags | evitar no titulo | no fim + link | Didatico, sem clickbait. **Nenhum tipo do painel gera isso** |

> **CTA — o padrao e SEM CTA.** Inclua quando o brief define a chamada ou quando a peca tem intencao de conversao (pilar `taxa_zero`, `prova_plataforma`). Sem CTA no brief, encerre com fechamento suave de relacionamento e deixe o campo `cta` vazio — e o que o painel injeta no prompt: *"NAO use chamadas de conversao. Deixe o campo cta do JSON vazio e encerre o texto de forma natural."*

Estrutura de caption do feed: hook factual com numero → beneficio/valor → (CTA, se houver) → quebra de linha → hashtags.

### Carrossel — contrato de saida

Arquivo: **`copy/instagram_carousel.json`**. Schema real (`interface/lib/prompts.js`):

```json
{
  "eyebrow": "rotulo curto da capa (o pilar/tema)",
  "slides": [
    { "title": "titulo curto (use ==palavra== p/ realcar em azul)", "body": "texto de apoio (opcional)", "layout": "cover|stat_grid|list|flow|text|cta" }
  ],
  "caption": "caption que acompanha o post",
  "hashtags": ["#4Selet", "..."],
  "cta": "CTA aprovado ou vazio",
  "notes": "1-2 frases de racional de marca"
}
```

**4 a 7 slides, com variedade de layout:** capa-gancho (`cover`) → desenvolvimento (`stat_grid` para numeros, `list` para enumeracao, `flow` para etapas, `text` para frase forte) → fecho (`cta`). Nem todo slide precisa de todos os campos.

### 4Selet na Midia — contrato de saida

Arquivo: **`copy/instagram_caption.txt`** — o **mesmo caminho** do feed (a peca e marcada como tipo Midia no `status.json`, via `setMediaMeta`). Cuidado com a colisao: nao escreva caption de feed por cima de uma peca de Midia.

Regras: legenda de **prova social** sobre a aparicao na imprensa, ancorada no que o veiculo representa; **proibido inventar trecho, citacao ou numero da materia**; veiculo nomeado com exatidao; tom sobrio de reconhecimento externo (sem hype, sem autopromocao); hashtags 3–5 com `#4Selet` + `#NaMidia`; CTA suave (ex.: *Conhecer a plataforma*) ou vazio.

## Step 4 (Regra 6): output estruturado (copy.json)

Para os agentes downstream consumirem:

```json
{
  "task_name": "...",
  "campaign_angle": "<selected_campaign_angle do research>",
  "instagram": { "caption": "...", "hashtags": ["#4Selet", "#TaxaZero", "..."], "cta": "Solicitar convite" },
  "threads": { "post": "...", "hashtag": "#4Selet" },
  "linkedin": { "post": "...", "hashtags": ["#4Selet", "..."], "cta": "Falar com o time" },
  "youtube": { "title": "...", "description": "...", "tags": ["4selet", "taxa zero", "..."] }
}
```

## Step 5 (Regra 7): arquivos de output

**Caminho (a) painel/pipeline — uma peca, um arquivo.** Grave apenas o arquivo do tipo escolhido:

| Tipo | Arquivo |
|---|---|
| Feed Instagram (`instagram_caption`) | `copy/instagram_caption.txt` |
| Carrossel (`instagram_carousel`) | `copy/instagram_carousel.json` |
| 4Selet na Midia (`media_mention`) | `copy/instagram_caption.txt` (mesmo caminho do feed) |
| LinkedIn (`linkedin_post`) | `copy/linkedin_post.txt` |
| Threads/X (`threads_post`) | `copy/threads_post.txt` |

**Caminho (b) execucao manual da skill — pacote completo** (para o distribution-agent do fluxo CLI):

```
copy/
├── instagram_caption.txt
├── threads_post.txt
├── linkedin_post.txt
├── youtube_metadata.json   (title, description, tags) — LEGADO, so no caminho manual
└── copy.json               (estruturado; nenhum codigo do painel/pipeline le)
```

Nenhum arquivo fora de `outputs/`. (Se for fixture canonico para reuso, salve copia em `skills/copywriter-agent/examples/` — `outputs/` pode nao persistir.)

---

## Brand Guardrails (4Selet)

- **CTAs aprovados (9, grafia canonica):** Solicitar convite · **Ver as condicoes** · Conhecer a plataforma · Migrar minha operacao · Calcular minha economia · Falar com o time · Acessar o material · Ler o playbook · Ver como funciona. **Proibidos:** "Compre ja!", "Ultima chance!", "Clica aqui agora!", "Inscreva-se gratuitamente" (a 4Selet e por convite, nao gratuita).
- **Numeros Taxa Zero (precisao):** 0% por 3 meses **OU ate R$ 300 mil**; R$ 1,99/transacao; PIX D+10; cartao D+30; 95% aprovacao. Nunca "0% pra sempre" / "100% gratis" / saque no mesmo dia.
- **Concorrentes:** nunca citar Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay — mercado so em abstrato ("~7,9%").
- **Emoji:** máx 1 funcional em caption (`→` `▸` `•`). **Banidos (lista fechada de 8):** 🔥 ⚡ 🚀 💸 💰 😱 🤯 ✨. Emoji banido **bloqueia a gravacao** no painel (erro 422) — nao e aviso. Nunca em headline/hero.
- **Hashtags (Instagram, 3–5):** `#4Selet` e a **unica obrigatoria** (e a unica que a validacao exige). `#TaxaZero` **so no pilar taxa_zero** ou quando a peca fala da oferta ativa. `#NaMidia` nas pecas de 4Selet na Midia. Completar com produto (`#PlataformaDePagamentos`/`#Infoproduto`/`#AreaDeMembros`) + nicho (`#ProdutorDigital`/`#DigitalSerio`). Banidas: `#Sucesso`, `#DinheiroFacil`, `#MentorDoSucesso`.
- **Sem auto-depreciacao** (Threads/LinkedIn): a 4Selet e sobria, nao casual/zoeira.
- **Frase-tag — REGRA DURA:** *"Para quem sabe que e Selet."* **NAO** entra como rodape, fecho, assinatura, headline, body de slide ou legenda. **Nao assine as pecas com ela.** So se o brief pedir explicitamente (GOVERNANCE em `interface/lib/prompts.js`). As outras frases-tag (*"A escolha de quem ja performa."*, *"Produtor nao e numero. E parceiro."*) seguem disponiveis como conteudo editorial — nao como carimbo. *(O `knowledge/brand_identity.md` foi corrigido nesse ponto em julho/2026; versoes antigas mandavam assinar toda peca.)*
- **Tom:** socio experiente, sobrio. Cada claim com numero/prazo/processo. Sem promessa magica nem motivacional vazio.

## Examples

### Example 1: Caption Instagram (Taxa Zero)
```
0% por 3 meses. R$ 1,99 por transacao. PIX em D+10.

A 4Selet abriu um corredor de migracao para produtores estabelecidos que querem trocar de plataforma sem perder mes.

Solicitar convite no link da bio. →

#4Selet #TaxaZero #PlataformaDePagamentos #ProdutorDigital #DigitalSerio
```

### Example 2: Threads (provocacao com dado)
> Taxa de 7,9% e problema dos outros. O seu problema e por que o seu cartao ta aprovando 78% em vez de 95%.

### Example 3: 4Selet na Midia (aparicao na imprensa)
**Usuario:** "Saiu uma materia sobre a 4Selet no [veiculo], escreve a legenda." -> tipo `media_mention`, pilar `prova_plataforma`:
```
A 4Selet foi destaque no [veiculo].

Reconhecimento de fora vale pelo que ele mede: seriedade de operacao, nao volume de barulho.

#4Selet #NaMidia #PlataformaDePagamentos #ProdutorDigital
```
Sem CTA de conversao, sem `#TaxaZero`, **sem citar nada que a materia nao disse**. Arquivo: `copy/instagram_caption.txt`.

### Example 4: Carrossel educacional
**Usuario:** "Faz um carrossel ensinando as 4 variaveis da rentabilidade." -> tipo `instagram_carousel`, pilar `educacional`: capa-gancho (`cover`) → 4 slides de desenvolvimento (`list`/`stat_grid`) → fecho suave (`text`), **sem oferta**, `cta` vazio. Arquivo: `copy/instagram_carousel.json`.

### Example 5: Sem research
**Usuario:** "Escreve as captions da 4Selet." -> pergunta o **pilar**; sem `research_results.json`, ancora no pilar e nos knowledge files, **declara** que nao usou research, mantem 1 angulo entre plataformas.

### Example 6: YouTube title *(caminho legado/manual)*
> 0% de Taxa por 3 Meses: A Mecanica Completa da Taxa Zero 4Selet

Lembre: nenhum tipo do painel ou do pipeline gera `youtube_metadata.json`, e nao ha publicacao no YouTube. So produza se o usuario pedir explicitamente.

## Troubleshooting

### Copy identico entre plataformas
**Solution:** re-adaptar por plataforma (Regra 4) — Threads provocativo curto, IG editorial, LinkedIn longo/autoridade, YouTube SEO.

### Numero da campanha errado / concorrente citado / CTA proibido / emoji de hype
**Solution:** rodar o checklist; brand guidelines vencem.

### Angulo inconsistente entre plataformas
**Solution:** fixar `campaign_angle` (Step 2) e derivar todas as variacoes dele.

## Quality Checklist

- [ ] Knowledge files carregados; em conflito, brand vence
- [ ] **Pilar de conteudo** definido (Taxa Zero nao e default) e refletido no tema/hashtags
- [ ] Pesquisa considerada (painel: ao vivo no prompt · CLI: `research_results.json` se existir); 1 `campaign_angle` fixado e consistente
- [ ] Copy distinto por plataforma (nunca identico); specs de tamanho/hashtag/emoji/CTA respeitadas
- [ ] **Nenhuma peca assinada com a frase-tag** "Para quem sabe que e Selet."
- [ ] CTA so quando faz sentido (padrao: sem CTA), na grafia canonica; numeros Taxa Zero corretos; nenhum concorrente; emoji máx 1 funcional e nenhum dos 8 banidos; sem hashtag banida
- [ ] Peca de **4Selet na Midia**: nada inventado sobre a materia; `#NaMidia` presente; sem `#TaxaZero`
- [ ] Arquivos conforme o caminho usado — (a) painel/pipeline: so o arquivo do tipo; (b) manual: pacote `copy/` + `copy.json`
- [ ] Tudo em `outputs/<task_name>_<date>/copy/`

## Relacionamento com outras skills (contrato)

```
Pesquisa (painel: Tavily no prompt · CLI: research_results.json)
   (selected_campaign_angle, ad_hooks, marketing_angles, keywords, campaign_facts)
        ↓
copywriter-agent (esta skill)
   (a) painel/pipeline → 1 arquivo por peca (copy/instagram_caption.txt · copy/instagram_carousel.json · ...)
   (b) manual/CLI     → pacote copy/ + copy.json
        ↓
distribution-agent → publicacao no painel (gate R5) · Publish MD so no caminho CLI
```

Consome o angulo e os fatos do research; entrega a copy que vai para a peca. A legenda publicada no Instagram e lida de `copy/instagram_caption.txt` (`interface/lib/publish.js`). O `campaign_angle` mantem coerencia com ad e video.

## Performance Notes

- Qualidade > velocidade. Sempre ancore nos knowledge files, no **pilar** e no `selected_campaign_angle`.
- Quando o pilar for de oferta ou prova, lidere com numero-ancora (Taxa Zero / 95%), depois explique.
- "Voce pode crescer" (vago) esta ERRADO; "3 meses para medir as 4 variaveis da sua rentabilidade" (concreto) esta CERTO.
