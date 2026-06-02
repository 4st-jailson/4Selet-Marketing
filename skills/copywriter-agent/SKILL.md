---
name: copywriter-agent
description: >
  Transforma a inteligencia de pesquisa em COPY platform-native da 4Selet para Instagram,
  Threads/X, YouTube e LinkedIn. Seleciona UM angulo de campanha (selected_campaign_angle do
  research) e o mantem coerente entre plataformas, adaptando tom, tamanho, CTA e hashtags ao
  estilo nativo de cada uma. Le research_results.json quando disponivel e ancora tudo nos
  knowledge files (brand_identity, product_campaign, platform_guidelines). Produz copy.json
  estruturado + arquivos por plataforma (instagram_caption.txt, threads_post.txt,
  linkedin_post.txt, youtube_metadata.json). Use quando o usuario pedir "copy", "caption",
  "legenda", "post", "thread", "titulo/descricao de YouTube", ou quando o Orchestrator acionar
  o Copywriter Agent. NAO gera imagem (ad-creative-designer), video (video-ad-specialist) nem
  publica (distribution-agent).
license: MIT
metadata:
  author: Marketing 4Selet
  version: 1.0.0
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

## CRITICAL: reconciliacoes com o contrato real do projeto

- **4 plataformas** (nao 3): Instagram, Threads/X, YouTube **e LinkedIn** (CLAUDE.md + `platform_guidelines.md`).
- **Campos do research** (contrato real emitido por `marketing-research-agent`): `selected_campaign_angle`, `ad_hooks`, `marketing_angles`, `keywords`, `video_concepts`, `campaign_facts`. (Mapeie: "content_angles" -> `marketing_angles`; "video_ideas" -> `video_concepts`.)
- **Path do research:** `outputs/<task_name>_<date>/research_results.json`.
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

Sem research disponivel: ancore direto nos knowledge files (Taxa Zero) e declare isso.

## Step 2 (Regra 3): selecionar UM angulo de campanha

Use o `selected_campaign_angle` do research (ex.: *"Migracao sem perder margem: 0% por 3 meses ou ate R$ 300 mil"*). Esse angulo deve permanecer **consistente** em Threads, Instagram, LinkedIn e YouTube — a mensagem-mae nao muda; muda a roupagem por plataforma.

## Step 3 (Regras 4 + 5): copy por plataforma

Cada plataforma no seu estilo nativo. **Nunca** copie texto identico entre plataformas. Specs (de `platform_guidelines.md`):

| Plataforma | Tamanho | Hashtags | Emoji | CTA | Tom |
|------------|---------|----------|-------|-----|-----|
| **Instagram** | 1–3 frases antes das hashtags | 3–5 (obrigatorias) | máx 1 funcional (`→`) | obrigatorio, conducao | Editorial, sobrio, com numero |
| **Threads/X** | 1–3 frases curtas | 0–1 (nunca comecar com #) | máx 1 | opcional (pode fechar com observacao seca) | Provocacao controlada COM dado |
| **YouTube** | title 60–70 chars + description 2–4 frases | via tags | evitar no titulo | no fim + link | Didatico, informativo, sem clickbait |
| **LinkedIn** | 1.200–1.500 chars, hook nas 2 primeiras linhas | 3–5 | 0–1 funcional | suave | Editorial premium, autoridade tecnica |

Estrutura de caption Instagram: hook factual com numero → beneficio/valor → CTA → quebra de linha → hashtags.

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

Salve em `outputs/<task_name>_<date>/copy/`:

```
copy/
├── instagram_caption.txt
├── threads_post.txt
├── linkedin_post.txt
├── youtube_metadata.json   (title, description, tags)
└── copy.json               (estruturado, todas as plataformas)
```

Nenhum arquivo fora de `outputs/`. (Se for fixture canonico para reuso, salve copia em `skills/copywriter-agent/examples/` — `outputs/` pode nao persistir.)

---

## Brand Guardrails (4Selet)

- **CTAs aprovados:** Solicitar convite · Ver condicoes · Falar com o time · Conhecer a plataforma · Migrar minha operacao · Calcular minha economia. **Proibidos:** "Compre ja!", "Ultima chance!", "Clica aqui agora!", "Inscreva-se gratuitamente" (a 4Selet e por convite, nao gratuita).
- **Numeros Taxa Zero (precisao):** 0% por 3 meses **OU ate R$ 300 mil**; R$ 1,99/transacao; PIX D+10; cartao D+30; 95% aprovacao. Nunca "0% pra sempre" / "100% gratis" / saque no mesmo dia.
- **Concorrentes:** nunca citar Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay — mercado so em abstrato ("~7,9%").
- **Emoji:** máx 1 funcional em caption (`→` `▸` `•`). Banidos: 🔥 ⚡ 🚀 💸 💰 😱 (hype). Nunca em headline/hero.
- **Hashtags (Instagram, 3–5):** `#4Selet` (obrigatorio) + `#TaxaZero` + produto (`#PlataformaDePagamentos`/`#Infoproduto`/`#AreaDeMembros`) + nicho (`#ProdutorDigital`/`#DigitalSerio`). Banidas: `#Sucesso`, `#DinheiroFacil`, `#MentorDoSucesso`.
- **Sem auto-depreciacao** (Threads/LinkedIn): a 4Selet e sobria, nao casual/zoeira.
- **Frases-tag** (quando houver espaco editorial): *"Para quem sabe que e Selet."* · *"A escolha de quem ja performa."* · *"Produtor nao e numero. E parceiro."*
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

### Example 3: YouTube title
> 0% de Taxa por 3 Meses: A Mecanica Completa da Taxa Zero 4Selet

### Example 4: Sem research
**Usuario:** "Escreve as captions da 4Selet." -> sem `research_results.json`, ancora nos knowledge files (Taxa Zero), **declara** que nao usou research, mantem 1 angulo entre plataformas.

## Troubleshooting

### Copy identico entre plataformas
**Solution:** re-adaptar por plataforma (Regra 4) — Threads provocativo curto, IG editorial, LinkedIn longo/autoridade, YouTube SEO.

### Numero da campanha errado / concorrente citado / CTA proibido / emoji de hype
**Solution:** rodar o checklist; brand guidelines vencem.

### Angulo inconsistente entre plataformas
**Solution:** fixar `campaign_angle` (Step 2) e derivar todas as variacoes dele.

## Quality Checklist

- [ ] Knowledge files carregados; em conflito, brand vence
- [ ] `research_results.json` lido (se existe); 1 `campaign_angle` fixado e consistente nas 4 plataformas
- [ ] Copy distinto por plataforma (nunca identico); specs de tamanho/hashtag/emoji/CTA respeitadas
- [ ] CTA aprovado; numeros Taxa Zero corretos; nenhum concorrente; emoji máx 1 funcional; sem hashtag banida
- [ ] `copy.json` + `instagram_caption.txt` + `threads_post.txt` + `linkedin_post.txt` + `youtube_metadata.json`
- [ ] Tudo em `outputs/<task_name>_<date>/copy/`

## Relacionamento com outras skills (contrato)

```
marketing-research-agent → research_results.json
   (selected_campaign_angle, ad_hooks, marketing_angles, keywords, campaign_facts)
        ↓
copywriter-agent (esta skill) → copy/{copy.json + .txt/.json por plataforma}
        ↓
distribution-agent → Publish MD (metadata por plataforma a partir do copy.json)
```

Consome o angulo e os fatos do research; entrega a copy que o Distribution Agent agrega no Publish MD. O `campaign_angle` mantem coerencia com ad e video (que vem do mesmo research).

## Performance Notes

- Qualidade > velocidade. Sempre ancore nos knowledge files e no `selected_campaign_angle`.
- Lidere com numero-ancora (Taxa Zero / 95%), depois explique.
- "Voce pode crescer" (vago) esta ERRADO; "3 meses para medir as 4 variaveis da sua rentabilidade" (concreto) esta CERTO.
