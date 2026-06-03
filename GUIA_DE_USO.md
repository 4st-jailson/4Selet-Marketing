# Guia de Uso — Equipe de Marketing 4Selet

*Manual operacional do sistema de 6 agentes de marketing com IA.*

> **Versão 2.7** · Junho/2026 · Marca: 4Selet · Campanha ativa: Taxa Zero
> Mantido por: Marketing 4Selet · Documentos-irmãos: `CLAUDE.md` (contexto técnico), `STATUS_PROJETO.md` (estado atual), `SPEC_WORKFLOW_APROVACAO.md` (contrato técnico do Workflow), `GIT_REMOTE_SETUP.md` (backup remoto)

---

## Sumário

1. [Bem-vindo(a) — como ler este guia](#1-bem-vindoa--como-ler-este-guia)
2. [Glossário rápido](#2-glossário-rápido)
3. [Objetivo do projeto](#3-objetivo-do-projeto)
4. [Quickstart — sua primeira peça em 5 minutos](#4-quickstart--sua-primeira-peça-em-5-minutos)
5. [Os 6 agentes em detalhe](#5-os-6-agentes-em-detalhe)
6. [Como os agentes conversam (o "contrato")](#6-como-os-agentes-conversam-o-contrato)
7. [Estado atual do sistema](#7-estado-atual-do-sistema)
8. [Setup no VSCode + extensão Claude Code](#8-setup-no-vscode--extensão-claude-code)
9. [Como funciona uma sessão na prática](#9-como-funciona-uma-sessão-na-prática)
10. [Fluxos de uso (cenários reais)](#10-fluxos-de-uso-cenários-reais)
11. [Anatomia de um bom prompt](#11-anatomia-de-um-bom-prompt)
12. [Biblioteca de prompts (paste-ready)](#12-biblioteca-de-prompts-paste-ready)
13. [Rodar via terminal (PowerShell)](#13-rodar-via-terminal-powershell)
14. [Anatomia de uma campanha (o que cada arquivo significa)](#14-anatomia-de-uma-campanha-o-que-cada-arquivo-significa)
15. [Gabarito de marca — faz / não faz](#15-gabarito-de-marca--faz--não-faz)
16. [Troubleshooting](#16-troubleshooting)
17. [Perguntas frequentes (FAQ)](#17-perguntas-frequentes-faq)
18. [Próximos passos do projeto](#18-próximos-passos-do-projeto)
19. [Arquivos importantes do projeto](#19-arquivos-importantes-do-projeto)
20. [Casos de uso comuns (prompts diários)](#20-casos-de-uso-comuns-prompts-diários)
21. [Como criar / adaptar uma campanha](#21-como-criar--adaptar-uma-campanha)
22. [Integrar a API da Meta para postagens automatizadas](#22-integrar-a-api-da-meta-para-postagens-automatizadas)
23. [Workflow de aprovação: preview, aprovar, arquivar](#23-workflow-de-aprovação-preview-aprovar-arquivar)

---

## 1. Bem-vindo(a) — como ler este guia

Este guia é o **manual operacional** da equipe de marketing automatizada da 4Selet. Ele foi escrito para que **qualquer pessoa do time** consiga usar o sistema mesmo **sem conhecimento técnico profundo**. Se algum termo parecer estranho, ele provavelmente está no glossário (Seção 2). Na versão HTML do guia, basta **passar o mouse em cima da palavra sublinhada** para ver a definição inline.

### Como ler

Você pode usá-lo de duas formas:

- **Do início ao fim** se está começando — em ~30 minutos de leitura você entende o sistema todo.
- **Pulando direto para a seção que precisa** se já conhece — o sumário lateral te leva.

### Sugestão de ordem para quem está aprendendo

1. **Glossário rápido** (seção 2) — termos que aparecem ao longo do guia.
2. **Objetivo do projeto** (seção 3) — o "por que" e a analogia da agência interna.
3. **Quickstart** (seção 4) — rode UMA peça pra sentir como funciona.
4. **Os 6 agentes** (seção 5) — entenda quem é cada um.
5. **Como funciona uma sessão** (seção 9) — o que acontece quando você digita um prompt.
6. **Anatomia de um bom prompt** (seção 11) — como pedir as coisas direito.
7. Volte ao que interessa.

### O que você precisa para usar

- **Acesso remoto à VPS** (RDP) com as credenciais corretas — o projeto roda **na VPS**, não no seu computador local.
- Dentro da sessão da VPS: **VSCode** com a **extensão Claude Code** instalada e autenticada (já configurado).
- O projeto aberto na VPS em: `C:\Users\Administrator\Documents\Agentes_Marketing_4Selet\Claude Equipe de Marketing - 6 Agentes`.
- Disposição para **revisar** o que o sistema entrega antes de publicar.

> Você **não precisa** programar para usar. Não precisa saber Node, React, Remotion nem nada técnico. Tudo o que você faz é **escrever em português no chat do Claude**. As partes técnicas estão por baixo, automatizadas.

---

## 2. Glossário rápido

Definições curtas dos termos que aparecem o tempo todo. Volte aqui sempre que esbarrar num termo estranho.

| Termo | O que significa |
|---|---|
| **Agente** | Um "papel" especializado (pesquisador, designer, copywriter, etc.). **Não é um software autônomo** — é o Claude **incorporando** aquele papel quando você pede algo que case com a função dele. |
| **Skill** | A "ficha de instruções" de um agente. Mora em `skills/<nome>/SKILL.md`. Define o que o agente faz, quando entra em ação, como gera o output e o que ele **não pode** fazer. |
| **Knowledge file** | Documento oficial da marca que todo agente lê **antes** de gerar conteúdo. Os três principais: `brand_identity.md` (visual + voz), `product_campaign.md` (Taxa Zero, números, diferenciais), `platform_guidelines.md` (specs por plataforma). |
| **Trigger phrase** | Palavra ou expressão no seu prompt que faz o Claude saber qual skill usar. Ex.: *"ad estático"* → ativa `ad-creative-designer`; *"Reels"* → `video-ad-specialist`. |
| **Task** | Uma "campanha" ou "job de trabalho" identificado por **`task_name`** (nome curto em **snake_case** — minúsculas com `_` no lugar de espaço, ex.: `lancamento_junho`) + **`task_date`** (YYYY-MM-DD). Ex.: `taxa_zero_maio_2026-05-29`. Toda a saída dessa task vai pra uma pasta única com esse nome. |
| **Output** | O **resultado entregue** pelo agente. Vai sempre pra `outputs/<task_name>_<data>/`, com subpastas por tipo (`ads/`, `video/`, `copy/`). |
| **Pipeline** | A **sequência completa** dos 5 agentes criativos: research → ad + vídeo + copy → distribution. Coordenada pelo `orchestrator`. |
| **Contrato** | O acordo de "qual arquivo um agente entrega que o próximo consome". Ex.: research entrega `research_results.json`; ad/vídeo/copy o leem; distribution agrega tudo. |
| **Dry-run** | Modo "teste": tudo é gerado, **nada é publicado**. É o **padrão de segurança** — quase sempre você roda em dry-run. |
| **Gate** | Trava de segurança do `distribution-agent` que **impede publicação automática**. Só destrava com referência explícita ao arquivo `Publish <task> <data>.md`. |
| **Modo simulado** | Quando uma chave externa (Tavily, Supabase) **não está configurada**, o agente gera um output simulado e **rotulado** (`_simulated: true`) em vez de chamar a API real. **Não é bug** — é o comportamento atual esperado. |
| **Ângulo de campanha** (campaign_angle) | A "mensagem-mãe" da campanha, escolhida pelo research. Ex.: *"Migração sem perder margem"*. Tem que ser **o mesmo** em ad + vídeo + copy — é o que mantém a campanha coerente. |
| **Job payload** | JSON com a configuração de uma task (nome, data, plataformas, skips, dry-run). É o que o `orchestrator` lê para rodar a pipeline. Modelo na seção 12.6. |
| **Skip flag** | Opção pra pular um estágio (`skip_research`, `skip_image`, `skip_video`). Útil quando você já tem o asset pronto e não quer gerar de novo. |
| **Source folder** | Pasta com assets pré-existentes em `assets/<task_name>/`. **Obrigatória** se você pular o research (`skip_research: true`) — caso contrário o pipeline bloqueia. |
| **Scene** | Uma "cena" do vídeo (hook, problem, product, benefit, proof, offer, cta). Tem `type` + `text` obrigatórios. |
| **Layout type** | O modelo visual do ad estático: `product_focus` (oferta direta), `split` (comparativo), `lifestyle` (institucional). |
| **Platform targets** | Quais plataformas a campanha vai cobrir: `instagram`, `threads`, `youtube`, `linkedin`. Definido no payload. |
| **Publish MD** | Arquivo `Publish <task> <data>.md` gerado pelo `distribution-agent`. Contém URLs da mídia + metadata + agendamento sugerido + status do gate. É o que você **revisa** antes de qualquer publicação real. |

---

## 3. Objetivo do projeto

### Em uma frase
Este sistema é uma **equipe de marketing automatizada** que, a partir de um **briefing** simples em texto (isto é: instruções básicas — o que você quer, pra qual plataforma, com qual ângulo de mensagem), devolve **uma campanha completa** (pesquisa, ad estático, vídeo, copy multi-plataforma e pacote de publicação) **dentro da identidade oficial da 4Selet**.

### A analogia (pra ficar visual)
Imagine uma **agência de marketing interna** com 6 papéis:

| Papel | Equivalente no sistema |
|---|---|
| 🔍 Pesquisador de mercado | `marketing-research-agent` |
| 🎨 Designer gráfico | `ad-creative-designer` |
| 🎬 Roteirista de vídeo | `video-ad-specialist` |
| ✍️ Copywriter (legendas/títulos) | `copywriter-agent` |
| 📦 Gerente de distribuição | `distribution-agent` |
| 👔 Diretor de operações | `orchestrator` |

A **diferença** aqui é que esses 6 papéis são **interpretados pelo Claude** (via skills) que **lê os documentos da marca** (knowledge files) **antes** de produzir qualquer coisa. O resultado é conteúdo que respeita paleta, tipografia, voz, números corretos da campanha e — o mais importante — o que **pode e não pode** dizer (sem hype, sem citar concorrentes, sem inventar dados).

### O que ele faz

- **Produz peças individuais** quando você pede uma só (ex.: "me dá uma caption pro Instagram").
- **Roda campanhas inteiras** quando você submete um *job payload* completo (research + ad + vídeo + copy + pacote de publicação).
- **Renderiza artefatos reais**:
  - **Imagens PNG** (1080×1080, 1080×1350, 1080×1920, 1280×720) via **Playwright headless** (navegador Chromium que roda invisível, sem abrir tela — só pra capturar a imagem final).
  - **Vídeos MP4** via Remotion (composition `AdVideo` em React).
  - **Textos estruturados** (`copy.json`, captions, títulos, hashtags).
  - **Pacotes de publicação** prontos para revisão humana (`Publish MD`).
- **Mantém coerência**: o `selected_campaign_angle` do research aparece igualzinho no ad, no vídeo e na copy.
- **Protege a publicação real**: o sistema **nunca posta sozinho** — só com aprovação explícita.

### O que ele NÃO faz (por design, não é limitação)

- **Não publica automaticamente** em redes sociais. Tem um **gate** que só abre com referência explícita ao Publish MD + tokens válidos.
- **Não cita concorrentes** (Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay). Comparação com mercado só em abstrato (*"taxas de mercado em torno de 7,9%"*).
- **Não inventa depoimentos** nem personagens fictícios. Se faltar prova social real, usa a *scene `proof`* com o "95% de aprovação no cartão".
- **Não usa estética hype/guru** (🔥🚀💸, "última chance", "vaga gratuita", etc.).
- **Não trabalha pra outras marcas** — os knowledge files são 4Selet-specific.

### Quando usar

✅ Produzir creative para a campanha **Taxa Zero** (ads, vídeos, captions, pacotes de publicação).
✅ Gerar conteúdo para Instagram, Threads/X, YouTube e LinkedIn.
✅ Validar conteúdo contra a identidade de marca antes de subir.
✅ Acelerar produção mantendo a marca consistente.

### Quando NÃO usar

❌ Campanhas de outras marcas (os knowledge files são da 4Selet).
❌ Publicação automática sem revisão humana.
❌ Conteúdo institucional fora do escopo Taxa Zero / onboarding por convite.
❌ Geração de assets para áreas que não passaram pelo time de marca.

---

## 4. Quickstart — sua primeira peça em 5 minutos

Antes de mergulhar no resto, **rode uma peça** para sentir como funciona.

### Passo 1 — Conecte-se à VPS via RDP, depois abra o projeto

Antes de tudo, **conecte-se à VPS** (detalhes completos na seção 8):

1. Abra a Conexão de Área de Trabalho Remota (`Win + R` → digite `mstsc` → Enter).
2. Em **Computador**, digite o IP da VPS.
3. Faça login com o usuário (`administrator`) e a senha (do seu gerenciador de senhas).

Dentro da sessão da VPS, abra o VSCode → `File → Open Folder` → selecione:
`C:\Users\Administrator\Documents\Agentes_Marketing_4Selet\Claude Equipe de Marketing - 6 Agentes`

### Passo 2 — Abra o painel da extensão Claude Code

Sidebar ou atalho do seu setup (geralmente um ícone "Claude" na barra lateral do VSCode).

### Passo 3 — Cole este prompt no chat

```
Escreva uma caption de Instagram da Taxa Zero, ângulo "0% por 3 meses
para o produtor medir a diferença". task_name: teste_rapido,
task_date: 2026-06-01. Salve em outputs/teste_rapido_2026-06-01/copy/.
```

### Passo 4 — Aprove as permissões

O Claude vai pedir permissão pra:
- Ler os knowledge files (`brand_identity.md`, etc.)
- Escrever o arquivo `instagram_caption.txt`

**Aceite cada uma**. Você verá no painel cada ação antes de ser executada.

### Passo 5 — Abra o resultado

Navegue até `outputs/teste_rapido_2026-06-01/copy/instagram_caption.txt`. Lá está sua caption.

### O que você acabou de fazer
Você usou o **`copywriter-agent`** — uma das 6 skills. O Claude detectou pela palavra "caption" no seu prompt, leu os knowledge files da 4Selet, escreveu a caption respeitando os números da Taxa Zero, as regras de emoji (máx 1 funcional), hashtags (`#4Selet` obrigatória), CTA aprovado e tom sóbrio. Sem você precisar lembrar de nenhuma dessas regras.

**Próximo passo:** veja a seção 5 pra entender os outros 5 agentes e o que cada um faz.

---

## 5. Os 6 agentes em detalhe

Cada agente tem uma seção abaixo explicando: **o que faz**, **quando entra**, **o que lê**, **o que entrega**, **como acionar**.

### 5.1 `marketing-research-agent` — o pesquisador

**Em uma frase:** é o estrategista — pensa quem é o público, qual mensagem usar, e escreve um briefing que todos os outros agentes vão seguir.

**O que faz:** transforma um nicho/tópico em **inteligência de marketing estruturada** — tendências, ângulos, keywords, hooks, conceitos de vídeo, e o **ângulo único** que vai amarrar a campanha.

**Quando entra:** **primeiro** no pipeline. Sem ele, os outros não têm "norte estratégico".

**O que lê:**
- Os 3 knowledge files (brand_identity, product_campaign, platform_guidelines).
- Se tiver chave Tavily: faz **5 buscas web reais** (tendências, concorrentes, audiência, hooks, virais).
- Sem chave: opera em **modo simulado** ancorado nos knowledge files.

**O que entrega** (em `outputs/<task>_<data>/`):

| Arquivo | O que é |
|---|---|
| `research_results.json` | O **contrato machine-readable**. Tem `selected_campaign_angle`, `ad_hooks`, `marketing_angles`, `keywords`, `video_concepts`, `campaign_facts`. É o que os outros agentes consomem. |
| `research_brief.md` | Versão human-readable, com diagrama Mermaid do funil. |
| `interactive_report.html` | Dashboard interativo com Chart.js (paleta 4Selet) — priorização dos ângulos, dores, etc. |

**Como acionar:**
> *"Rode o marketing-research-agent para a campanha Taxa Zero..."*
> ou simplesmente *"Faça a pesquisa de mercado..."*

**Exemplo de campo do `research_results.json`:**
```json
"selected_campaign_angle": "Migração sem perder margem: 0% por 3 meses ou até R$ 300 mil em vendas",
"campaign_facts": {
  "taxa_plataforma": "0% por 3 meses ou ate R$ 300 mil em vendas",
  "custo_por_transacao": "R$ 1,99",
  "prazo_pix": "D+10",
  "prazo_cartao": "D+30",
  "prova_ancora": "95% de aprovacao no cartao"
}
```

---

### 5.2 `ad-creative-designer` — o designer gráfico

**Em uma frase:** é o designer — cria a imagem do post, em vários formatos (quadrado, story, thumb), pronta pra publicar.

**O que faz:** transforma um briefing em **imagem real** — gera um **blueprint JSON** (a "planta" do design: que template, cores, textos, posições), escreve HTML/CSS, e **renderiza** (transforma o HTML em arquivo PNG final) via **Playwright headless** (navegador rodando invisível em background).

**Quando entra:** depois do research (consome o `selected_campaign_angle` e o `ad_hooks`). Pode rodar em paralelo com video e copy.

**O que lê:**
- Knowledge files (especialmente `platform_guidelines.md` para specs por formato).
- `research_results.json` (se existe na task).

**O que entrega** (em `outputs/<task>_<data>/ads/`):

| Arquivo | O que é |
|---|---|
| `layout.json` | O **blueprint** semântico do design (template, paleta, elementos). |
| `ad.html` + `styles.css` | A materialização em HTML/CSS. |
| `instagram_ad.png` (ou outros nomes) | A **imagem final renderizada**. |

**Formatos suportados:**
- `instagram_square` 1080×1080 (feed quadrado)
- `instagram_feed` 1080×1350 (feed 4:5)
- `instagram_story` 1080×1920 (story/Reels cover)
- `youtube_thumbnail` 1280×720 (thumbnail)

**Templates de layout:**
- `product_focus` — eyebrow + headline grande + subtext + CTA (oferta direta).
- `split` — texto de um lado, número-âncora/mockup do outro (comparativo).
- `lifestyle` — full-bleed (gradiente + Selet Dots) com headline + CTA (institucional).

**Como acionar:**
> *"Crie um ad estático 1080×1080 da Taxa Zero..."*
> *"Faça uma imagem para Instagram..."*
> *"Gere uma thumbnail para YouTube..."*

---

### 5.3 `video-ad-specialist` — o roteirista de vídeo

**Em uma frase:** é o roteirista — escreve cena por cena o que o vídeo vai dizer e mostrar. A geração do `.mp4` em si acontece num passo separado, automaticamente.

**O que faz:** transforma o briefing em **scene JSON** estruturado, pronto para a composition Remotion renderizar.

> **Importante:** esta skill **não renderiza o vídeo** — só gera o JSON com a sequência de cenas, estratégia, pacing, transições. A renderização final (`.mp4`) é feita separadamente via `npm run render` em cima da composition `AdVideo` em `src/`.

**Quando entra:** depois do research. Paraleliza com ad e copy.

**O que lê:**
- Knowledge files (especialmente `product_campaign.md` com os 4 conceitos de vídeo).
- `research_results.json`.

**O que entrega** (em `outputs/<task>_<data>/video/`):

| Arquivo | O que é |
|---|---|
| `scenes.json` | O **roteiro estruturado** no schema `composition`/`props`. Apenas JSON válido — sem texto fora do bloco. |

**Estratégias suportadas:**
- `problem_solution` — começa pela dor, oferece a solução.
- `limited_offer` — comunica a mecânica Taxa Zero.
- `product_showcase` — destaca diferenciais (95% aprovação, etc.).
- `testimonial` — só com depoimento real autorizado (raro).

**Tipos de scene:**
`hook`, `problem`, `product`, `benefit`, `proof`, `offer`, `testimonial`, `cta`.

**Plataformas suportadas:**
- `instagram_reels` 1080×1920 (9:16, 15–20s)
- `instagram_feed` 1080×1350 (4:5, 15–20s)
- `youtube_shorts` 1080×1920 (9:16, 15–25s)
- `youtube` 1920×1080 (16:9, 25–30s)

**Como acionar:**
> *"Gere o scene JSON de um Reels da Taxa Zero..."*
> *"Faça o roteiro de um Short do YouTube..."*

**Para renderizar o `.mp4` (etapa separada):**
> *"Renderize o vídeo da task X reaproveitando a composition AdVideo..."*
> Ou via terminal: `npm run render`

---

### 5.4 `copywriter-agent` — o copywriter

**Em uma frase:** é o redator — escreve as legendas, títulos e descrições pra cada rede social, cada uma no tom certo daquela rede.

**O que faz:** transforma o ângulo de campanha em **copy platform-native** — adaptado ao estilo, tamanho, hashtags e CTA de cada rede.

**Quando entra:** depois do research. Paraleliza com ad e vídeo.

**O que lê:**
- Knowledge files (especialmente `platform_guidelines.md` com specs por plataforma).
- `research_results.json` (`selected_campaign_angle` e `ad_hooks`).

**O que entrega** (em `outputs/<task>_<data>/copy/`):

| Arquivo | O que é |
|---|---|
| `copy.json` | Estruturado, **todas as plataformas** num único objeto (consumível pelo distribution). |
| `instagram_caption.txt` | Caption pronta (gerada se `instagram` está em `platform_targets`). |
| `threads_post.txt` | Post Threads (se `threads` em targets). |
| `linkedin_post.txt` | Post LinkedIn longo (se `linkedin` em targets). |
| `youtube_metadata.json` | Title + description + tags (se `youtube` em targets). |

**Plataformas suportadas e estilo:**

| Plataforma | Estilo | Tamanho | Hashtags | Emoji | CTA |
|---|---|---|---|---|---|
| **Instagram** | Editorial, sóbrio, com número | 1–3 frases + hashtags | 3–5 (`#4Selet` obrigatória) | máx 1 funcional (`→`) | Sim, conduzido |
| **Threads/X** | Provocação controlada com dado | 1–3 frases curtas | 0–1 | máx 1 | Opcional |
| **YouTube** | Didático, SEO-friendly | Title 60–70 chars + description 2–4 frases | via tags | evitar no título | Sim, no fim |
| **LinkedIn** | Editorial premium, autoridade | 1.200–1.500 chars | 3–5 | 0–1 funcional | Suave |

**Como acionar:**
> *"Escreva a copy da Taxa Zero para Instagram e YouTube..."*
> *"Faça a caption..."*
> *"Gere o post de LinkedIn..."*

---

### 5.5 `distribution-agent` — o gerente de distribuição

**Em uma frase:** é o organizador final — junta imagem + vídeo + texto num pacote pronto pra você revisar e publicar manualmente. **Ele nunca publica sozinho.**

**O que faz:** **agrega** mídia + research + copy num pacote publish-ready, **gera URLs** (via Supabase ou placeholders) e escreve o **Publish MD** — o arquivo que a pessoa revisa antes de publicar.

> **Importante:** este agente tem o **gate de segurança**. Ele **nunca posta sozinho**. Posting real só rola com referência explícita ao Publish MD pelo nome + fora de dry-run + tokens das plataformas presentes.

**Quando entra:** **por último**, depois que ad + vídeo + copy estão prontos.

**O que lê:**
- Knowledge files (especialmente `platform_guidelines.md` para o sequenciamento de distribuição).
- Mídia da task (`ads/*.png`, `video/*.mp4`).
- `research_results.json` + `copy.json`.

**O que entrega** (em `outputs/<task>_<data>/`):

| Arquivo | O que é |
|---|---|
| `media_urls.json` | URLs públicas da mídia (Supabase real ou placeholders rotulados `_simulated: true`). |
| `Publish <task> <data>.md` | O **pacote final** humano: URLs da mídia, metadata por plataforma, agendamento sugerido, status do gate. **Você revisa este arquivo antes de publicar**. |

**O sequenciamento de distribuição padrão** (do `platform_guidelines.md`):

| Dia | Plataforma | Formato |
|---|---|---|
| Segunda | LinkedIn | post editorial |
| Terça (manhã) | Instagram Feed | static ad |
| Quarta | YouTube | video |
| Quinta | Instagram Reels + Threads | video curto |
| Sexta | Instagram Story | sticker/poll |

**Como acionar:**
> *"Prepare a distribuição da task X em dry-run..."*
> *"Gere o Publish MD da task..."*

**Para publicar de verdade** (quando configurado):
> *"Publica usando Publish taxa_zero_maio 2026-05-29.md"* — com o nome exato do arquivo.

---

### 5.6 `orchestrator` — o diretor de operações

**Em uma frase:** é o coordenador — você diz "roda a campanha completa" e ele aciona os 5 agentes na ordem certa, automaticamente.

**O que faz:** **coordena** os 5 agentes acima. Recebe um *job payload* JSON, valida, resolve dependências e skips, dispara cada agente na ordem certa, rastreia status e gera logs.

> **Importante:** **NÃO é um agente criativo**. Não escreve, não desenha, não pesquisa. Apenas **organiza** quem faz o quê e quando.

**Quando entra:** quando você quer **rodar a pipeline completa** (não uma peça isolada).

**Modos de execução:**

| Modo | Como funciona | Pré-requisito |
|---|---|---|
| **Sequencial** (atual) | Claude segue o plano e dispara cada skill na ordem | Nenhum extra |
| **Enfileirado** (futuro) | BullMQ + Redis processam em fila assíncrona | `npm i bullmq` + `REDIS_URL` + pasta `pipeline/` |

**Ordem de execução:**
```
research → (ad + video + copy paralelos) → distribution
```

**Dependências e regras:**
- `research_agent` roda primeiro (a menos que `skip_research: true`).
- Se `skip_research: true`, **exige** a pasta `assets/<task_name>/` — senão **bloqueia**.
- `ad_creative_designer`, `video_ad_specialist`, `copywriter_agent` rodam **após** o research.
- `distribution_agent` roda **por último**, depois que todos os outros entregaram.

**Job payload — campos obrigatórios:**

```json
{
  "task_name": "nome_curto_snake_case",
  "task_date": "YYYY-MM-DD",
  "platform_targets": ["instagram", "youtube"],
  "user_flags": {
    "skip_research": false,
    "skip_image": false,
    "skip_video": false
  },
  "source_folder": null,
  "dry_run": true
}
```

**O que entrega** (em `outputs/<task>_<data>/`):

| Arquivo | O que é |
|---|---|
| `pipeline_plan.json` | O plano com dependências, ordem, status de cada job. |
| `logs/<agente>.log` | Um log por agente (5 arquivos). |

**Como acionar:**
> *"Rode o pipeline completo com este payload: [cole JSON]"*
> *"Orquestre a campanha taxa_zero_maio com IG e YouTube..."*

---

## 6. Como os agentes conversam (o "contrato")

**Em palavras simples:** o pesquisador escreve um **briefing**. Os outros 3 (designer, roteirista, redator) **leem esse briefing antes de criar** suas peças. Assim, todos seguem a mesma linha — a mensagem da imagem, do vídeo e do texto bate. No fim, o organizador da distribuição junta tudo num pacote pra você revisar.

Tecnicamente: a coerência da campanha vem de um **contrato de arquivos** — o que um agente entrega, o próximo consome. É o **`selected_campaign_angle` do research** que mantém ad + vídeo + copy alinhados.

### O fluxo visualizado

```
┌─────────────────────────────┐
│  marketing-research-agent   │
│  ↓                          │
│  research_results.json      │
│  • selected_campaign_angle  │
│  • ad_hooks                 │
│  • marketing_angles         │
│  • keywords                 │
│  • video_concepts           │
│  • campaign_facts           │
└──────────┬──────────────────┘
           │
           ├─► ad-creative-designer
           │   ├─ usa: selected_campaign_angle, ad_hooks
           │   └─ gera: ads/{layout.json, ad.html, styles.css, *.png}
           │
           ├─► video-ad-specialist
           │   ├─ usa: marketing_angles, video_concepts, campaign_facts
           │   └─ gera: video/scenes.json (→ Remotion render → ad.mp4)
           │
           └─► copywriter-agent
               ├─ usa: selected_campaign_angle, ad_hooks, keywords
               └─ gera: copy/{copy.json, *.txt, youtube_metadata.json}
                          │
                          ▼
              ┌────────────────────────────┐
              │   distribution-agent       │
              │   (agregador final)        │
              │   ├─ media_urls.json       │
              │   └─ Publish <task>.md     │
              │      ↑ GATE: não posta     │
              │        sem aprovação       │
              └────────────────────────────┘
```

### Por que isso importa

Se o copywriter usar um ângulo diferente do ad, a campanha **vira uma colcha de retalhos**. Por isso o research decide UM ângulo, e todo mundo segue.

> **Regra de ouro do contrato:** se você rodar a pipeline pela orchestrator, isso é automático. Se você rodar agentes isolados, **passe o `selected_campaign_angle` no prompt** pra todos eles, ou referencie o `research_results.json` da task.

---

## 7. Estado atual do sistema

| Componente | Status | O que isso significa na prática |
|---|---|---|
| Node.js, Remotion, Playwright | ✅ Instalados | Renders de PNG e MP4 saem **reais** |
| `skills/` (7 skills + scripts) | ✅ Pronto | Os 6 agentes + a **task-promoter** (Workflow de Aprovação) funcionando |
| `src/` (composition AdVideo Remotion) | ✅ Pronto | Vídeo pode ser renderizado via `npm run render` |
| Knowledge files (`knowledge/`) | ✅ brand v1.1 · product v1.2 · platform v1.1 | Fontes de verdade da marca atualizadas |
| **Workflow de Aprovação v1.1** | ✅ Implementado (R5 gate duplo + B.2 runtime + git local) | 10 felizes + 7 adversariais B.1 + 3 runtime B.2 passaram |
| Pasta `pipeline/` (BullMQ) | ⏳ Pendente | Pipeline roda **sequencial** (não enfileirada). Funciona, mas não é assíncrono |
| `TAVILY_API_KEY` | ⏳ Pendente | Research roda em **modo simulado** (sintetiza dos knowledge files, não busca na web) |
| `SUPABASE_URL` + `SUPABASE_KEY` | ⏳ Pendente | Distribution gera URLs **placeholder** (`_simulated: true`) — nada hospedado de fato |
| OAuth YouTube + token Instagram | ⏳ Pendente | Posting real **impossível** — gate sempre fechado |
| `git` | ✅ Instalado (v2.54.0) | Hook `post-commit` ativo (push automático em background, fail-silent). **Remoto pendente** — ver `GIT_REMOTE_SETUP.md` e Seção 18 |

### Implicações práticas para você

1. **Renders de ad (PNG) e vídeo (MP4) saem REAIS** e ficam na pasta — não dependem de chave externa.
2. **Research e Supabase rodam simulados** — os outputs são gerados, mas vêm com `_simulated: true` marcado. Use-os como se fossem reais para revisão, **mas saiba que** a "pesquisa" não consultou a web e as URLs do Supabase são fake.
3. **Posting real não acontece** — o pipeline sempre para no Publish MD pra revisão humana. Você ainda pode postar manualmente copiando o texto do Publish MD.
4. **Persistência garantida localmente** via commits automáticos a cada mudança (hook `post-commit`). Persistência **remota** ainda exige `git remote add origin <URL>` — passo a passo em `GIT_REMOTE_SETUP.md`.

Para destravar os caminhos reais, ver seção 18.

---

## 8. Setup no VSCode + extensão Claude Code (via VPS)

> **Importante:** o projeto **roda na VPS** — não localmente. A pasta `Claude Equipe de Marketing - 6 Agentes/` mora no servidor remoto. Você se conecta à VPS via Área de Trabalho Remota (RDP) e, **dentro da sessão da VPS**, abre o projeto no VSCode com a extensão Claude Code.

### Pré-requisitos

| Item | Detalhes |
|---|---|
| **Cliente RDP** | Já vem com Windows ("Conexão de Área de Trabalho Remota" / `mstsc.exe`). Em Mac: "Microsoft Remote Desktop" (App Store). Em Linux: Remmina ou similar. |
| **Acesso à rede da VPS** | Tem que conseguir alcançar o IP da VPS (rede aberta ou VPN, conforme o setup da empresa). |
| **Credenciais da VPS** | IP, usuário e senha — armazene em **gerenciador seguro** (1Password, Bitwarden, etc.). **NÃO** salve em arquivo no projeto. |
| **Na VPS (já instalado)** | VSCode + extensão Claude Code + Node.js 24+ + Remotion + Playwright. Nada pra fazer ali. |

### Credenciais

| Campo | Valor |
|---|---|
| **IP da VPS** | `143.14.247.176` |
| **Usuário** | `administrator` |
| **Senha** | _consulte com seu gestor / gerenciador de senhas — **não está documentada aqui** por segurança_ |
| **Porta RDP** | `3389` (padrão) |

> ⚠️ **Segurança:** **nunca** registre a senha neste guia, em README, em commits ou em prints compartilhados. Mantenha-a em gerenciador de senhas. Se vazar, peça rotação imediata ao gestor. Quem precisa de acesso pede ao responsável.

### Passo a passo — conectar à VPS (RDP)

1. **Abrir o cliente RDP** (Windows: `Win + R` → digite `mstsc` → Enter).
2. Em **Computador**, digite o **IP da VPS** (`143.14.247.176`).
3. Clique em **Conectar**.
4. Na tela de login, informe o usuário (`administrator`) e a senha (do seu gerenciador).
5. Aguarde a sessão da VPS abrir — você verá a **área de trabalho do servidor**. A partir daqui, tudo acontece dentro dela.

> **Aviso de certificado na primeira vez:** o Windows pode mostrar um aviso de "certificado não confiável". Confirme o nome do servidor com seu gestor antes de aceitar. Aceitar uma vez é suficiente.

### Passo a passo — abrir o projeto e usar o Claude Code

(Tudo abaixo é feito **dentro da sessão da VPS**.)

#### 1) Abrir o VSCode
Atalho na área de trabalho da VPS ou menu Iniciar → "Visual Studio Code". Já está autenticado na extensão Claude Code.

#### 2) Abrir a pasta do projeto
`File → Open Folder` → navegar até:
`C:\Users\Administrator\Documents\Agentes_Marketing_4Selet\Claude Equipe de Marketing - 6 Agentes`

#### 3) Aguardar o Claude Code reconhecer o projeto
Assim que abre, o Claude Code lê automaticamente:
- `CLAUDE.md` — contexto técnico principal.
- Cada `skills/<nome>/SKILL.md` — a definição dos agentes (7 skills no total).
- Os arquivos em `knowledge/` — a fonte de verdade da marca.

O painel da extensão indica quantas skills foram carregadas.

#### 4) Conferir que as 7 skills estão disponíveis
Procure no painel a lista de skills. Devem aparecer:
- `marketing-research-agent`
- `ad-creative-designer`
- `video-ad-specialist`
- `copywriter-agent`
- `distribution-agent`
- `orchestrator`
- `task-promoter` *(novo — workflow de aprovação)*

Se faltar alguma, cheque se o `SKILL.md` correspondente existe em `skills/<nome>/`.

#### 5) Fazer o primeiro pedido
- Clique no campo de input do painel.
- Digite ou cole o prompt (use o Quickstart da seção 4, ou a biblioteca da seção 12).
- Pressione Enter.

#### 6) Aprovar as permissões
Para cada ação com efeito colateral (ler arquivo, escrever arquivo, executar script), o Claude **pede permissão**. Você vê:
- O que ele quer fazer (ex.: "escrever em `outputs/.../caption.txt`")
- O conteúdo / comando exato
- Botões: **Allow** / **Deny**

> **Dica:** aceite tudo na primeira vez para entender o fluxo. Você pode revogar e ajustar a confiança depois.

#### 7) Ver as saídas
- Outputs vão para `outputs/<task_name>_<data>/` (ou onde você pediu) **na VPS**.
- Use o explorador do VSCode pra navegar.
- PNGs/MP4s o VSCode abre direto. JSON/MD/HTML também.

### Boas práticas de uso remoto

- **Não copie arquivos pra sua máquina local** sem motivo — o projeto inteiro mora na VPS. Edições locais não voltam pra lá automaticamente.
- **Não rode duas sessões RDP simultâneas** com o mesmo usuário — uma vai expulsar a outra; trabalho não-salvo pode ser perdido.
- **Encerre a sessão pelo menu Iniciar → Desconectar** (não feche só no `X` da janela — isso pode deixar processos rodando indefinidamente).
- **Mantenha a senha em gerenciador.** Se vazar, rotacione imediatamente.
- **Para trabalho offline** ou edição via terminal: peça acesso por SSH ao gestor, ou aguarde o git ser instalado (seção 18) pra clonar.
- **Sessão expirando?** O Windows Server desconecta sessões ociosas após um tempo. Salve seu trabalho de tempos em tempos.

### Dicas operacionais (mesmas do uso local)

- **Skill não disparou?** Mencione-a pelo nome no prompt: *"Use a skill `ad-creative-designer` para..."*.
- **Quer ver o que ele está fazendo?** Deixe o painel da extensão aberto — ele lista cada *tool call* (read/write/bash) antes de executar.
- **Quer agilizar?** Em pedidos comuns o Claude já sabe que precisa ler os knowledge files; em pedidos novos, lembre-o: *"Antes de gerar, leia `knowledge/brand_identity.md`..."*.
- **Quer rodar script direto?** Use o terminal integrado do VSCode (PowerShell) na sessão da VPS. Ver seção 13.

---

## 9. Como funciona uma sessão na prática

Pra você ver "por dentro" o que acontece quando digita um prompt.

### Anatomia de uma sessão

```
Você → digita prompt no chat do Claude
   ↓
Claude → identifica a SKILL (pela trigger phrase ou referência direta)
   ↓
Claude → carrega o SKILL.md daquele agente
   ↓
Claude → carrega os KNOWLEDGE FILES indicados no SKILL.md
   ↓
Claude → segue os STEPS do SKILL.md (1, 2, 3...)
   ↓
Para cada AÇÃO com efeito colateral:
   ↓
   Claude → pede PERMISSÃO (Read, Write, Bash)
   ↓
   Você → aprova / nega
   ↓
   Claude → executa (ou pula se negado)
   ↓
Claude → roda o QUALITY CHECKLIST do SKILL.md
   ↓
Claude → entrega o output em `outputs/<task>_<data>/`
   ↓
Claude → reporta o que fez no chat (resumo + caminhos)
```

### Exemplo na prática

**Você cola:**
> *"Crie um ad estático 1080×1080 da Taxa Zero, layout product_focus, ancorado em 'Migração sem perder margem'. task_name: teste_ad, task_date: 2026-06-01."*

**O que acontece (em 4 movimentos):**

1. **Claude entende o pedido** → reconhece "ad estático" e ativa o designer (`ad-creative-designer`).
2. **Lê as regras da marca** → carrega os 3 knowledge files. Você aprova com um clique.
3. **Cria os arquivos** → especificação do design, HTML/CSS, e gera o PNG. Você aprova cada um conforme ele vai criando.
4. **Confere o resultado** → abre o PNG gerado e te avisa: *"Pronto. Headline 'Migração sem perder margem' em destaque, '0%' em azul Selet, CTA 'Solicitar convite' no botão, paleta oficial."*

**Você abre o PNG no VSCode, vê o ad pronto.** Toda a parte técnica (qual fonte, qual cor, em que pasta salvar) ele resolveu seguindo as regras dos knowledge files.

> 🔧 **Por dentro (pra quem quer entender):** o Claude faz dezenas de ações pequenas (ler arquivo, escrever arquivo, executar script) e te pede permissão pra cada uma. Você aceita ou nega. Tudo aparece listado no painel — nada acontece sem você ver e aprovar.

### O que mais pode acontecer

- Se Claude **não encontrar** o knowledge file que precisa, ele **pergunta**.
- Se você **negar** uma permissão, ele **pula** essa parte e segue (ou para se for crítica).
- Se o checklist final falhar (ex.: número errado da Taxa Zero), ele **se corrige antes de entregar**.

---

## 10. Fluxos de uso (cenários reais)

### Fluxo A — "Preciso de UMA caption agora"

*Dia a dia: post de Instagram pra publicar logo.*

1. Abra o Claude Code no projeto.
2. Cole o prompt da seção [12.4](#124-copy-multi-plataforma-copywriter-agent), trocando `<nome>` e a data.
3. Aprove as permissões.
4. Abra `outputs/<nome>_<data>/copy/instagram_caption.txt`.
5. Copie a caption pro seu app de publicação. Posta.

⏱️ **Tempo:** ~1 minuto.

### Fluxo B — "Quero o pacote inteiro de uma campanha"

*Lançamento de uma nova investida da Taxa Zero, com ad + vídeo + copy + Publish MD.*

1. Defina o **payload** (seção 12.6) — nome, data, plataformas alvo.
2. No Claude: *"Rode o pipeline completo com este payload: [cole o JSON]"*.
3. Aprove cada etapa (são várias — o Claude executa research → ad + vídeo + copy → distribution na ordem).
4. Ao final, revise o `Publish <task> <data>.md`.
5. Publique manualmente nas redes (ou mantenha em dry-run pra ajustes).

⏱️ **Tempo:** ~5–10 minutos dependendo de quantos formatos.

### Fluxo C — "Quero algo apresentável pra mostrar a um cliente/parceiro"

*Demo profissional, sem deixar nada na metade.*

Use o prompt da seção [12.7](#127-campanha-demo-apresentável). Gera:
- Ads em 4 formatos (1080×1080, 1080×1350, 1080×1920, 1280×720)
- Vídeo `.mp4` real (1080×1920)
- Copy nas 4 plataformas
- Publish MD
- `README.md` índice
- Tudo em `tests/campanha-demo/` (preserva entre sessões)

⏱️ **Tempo:** ~10–15 minutos.

### Fluxo D — "Quero auditar um asset que alguém me mandou"

*Alguém te mandou um ad/caption pra revisar — quer saber se está on-brand.*

Use o prompt da seção [12.9](#129-revisão-e-correção):
> *"Audite o arquivo X contra os knowledge files..."*

Claude vai apontar: cores off-brand, fontes erradas, números errados da Taxa Zero, CTAs proibidos, concorrentes citados, hashtags banidas, etc.

⏱️ **Tempo:** ~30 segundos.

### Fluxo E — "Quero rodar um script via terminal"

*Você sabe o que quer (rodar `render_ad.js` num HTML específico, por exemplo) — não precisa da camada do chat.*

Abra o terminal integrado (PowerShell) e use os comandos da seção 13.

⏱️ **Tempo:** segundos.

---

## 11. Anatomia de um bom prompt

Um prompt bem-feito faz três coisas: **invoca a skill certa**, **passa os parâmetros**, **diz onde salvar**.

### A receita

```
[AÇÃO] [TIPO DE ATIVO] [DETALHES DA MARCA/CAMPANHA].
task_name: <nome>, task_date: <YYYY-MM-DD>.
[ONDE SALVAR / O QUE INSPECIONAR].
```

### Componentes explicados

| Componente | Pra que serve | Exemplos |
|---|---|---|
| **Ação** | Verbo que diz o que fazer | *"Crie"*, *"Gere"*, *"Escreva"*, *"Renderize"*, *"Rode"*, *"Audite"* |
| **Tipo de ativo** | Define a skill que vai entrar | *"ad estático"*, *"Reels"*, *"caption"*, *"pipeline"* |
| **Detalhes** | Específica formato, plataforma, ângulo, layout | *"1080×1080 para Instagram, layout product_focus, ângulo 'X'"* |
| **task_name + task_date** | Identifica a task (sem isso o sistema não sabe onde salvar) | *"task_name: teste_ad, task_date: 2026-06-01"* |
| **Onde salvar** | Caminho de saída (opcional — Claude usa o padrão se não disser) | *"Salve em outputs/teste_ad_2026-06-01/ads/"* |

### Exemplo bom vs ruim

❌ **Ruim:**
> *"faz um post pra 4selet"*

(Sem ação clara, tipo vago, sem task, sem ângulo, sem plataforma.)

✅ **Bom:**
> *"Escreva uma caption de Instagram da Taxa Zero, ângulo 'Migração sem perder margem'. task_name: lancamento_q2, task_date: 2026-06-01. Salve em outputs/lancamento_q2_2026-06-01/copy/."*

(Verbo claro, tipo específico, plataforma definida, ângulo nomeado, task identificada, destino explícito.)

### Quando o Claude não acertar a skill

Se ele entrar com a skill errada, **mencione pelo nome**:
> *"Use a skill `ad-creative-designer` para criar um ad..."*

Isso força o trigger.

### Para pedidos longos / múltiplas tarefas

Quebre em passos numerados:
> *"Faça o seguinte:*
> *1. Gere o scene JSON do Reels da Taxa Zero (15s, limited_offer).*
> *2. Salve em outputs/X_Y/video/scenes.json.*
> *3. Depois renderize o vídeo via npm run render, salvando como outputs/X_Y/video/ad.mp4."*

---

## 12. Biblioteca de prompts (paste-ready)

> 🟡 **Convenção:** tudo que aparecer entre `<...>` nos prompts (ex.: `<nome>`, `<YYYY-MM-DD>`, `<angulo>`, `<plataformas>`, `<caminho>`) é **placeholder** — você troca pelo valor real antes de enviar. O resto pode ficar como está. **No HTML do guia esses campos aparecem destacados em amarelo** para facilitar visualizar onde editar.

`task_name` é um identificador curto em snake_case (ex.: `lancamento_junho`); `task_date` é `YYYY-MM-DD` (geralmente hoje).

**Checklist mínimo a trocar antes de enviar qualquer prompt:**
- [ ] `<nome>` / `<task_name>` → seu identificador da task
- [ ] `<YYYY-MM-DD>` / `<data>` → data atual ou da campanha
- [ ] `<angulo>` → ângulo da campanha (ou deixe o agente escolher)
- [ ] `<plataformas>` → quais redes (instagram, threads, youtube, linkedin)
- [ ] Para audit/correção: `<caminho>` → arquivo a auditar
- [ ] Para scripts: `<input.html>`, `<output.png>`, `<largura>`, `<altura>` → caminhos/dimensões reais

### 12.1 Pesquisa de mercado (`marketing-research-agent`)

```
Rode o marketing-research-agent para a campanha Taxa Zero da 4Selet, público
produtor estabelecido (R$ 50k+/mês). task_name: <nome>, task_date: <YYYY-MM-DD>.
Sem chave Tavily, opere em modo SIMULADO ancorado nos knowledge files. Gere os
3 deliverables (research_results.json + research_brief.md + interactive_report.html)
em outputs/<nome>_<data>/.
```

### 12.2 Ad estático (`ad-creative-designer`)

```
Crie um ad estático 1080×1080 da Taxa Zero para Instagram, layout product_focus,
ancorado no ângulo "<angulo>" (ex.: "Migração sem perder margem"). task_name: <nome>,
task_date: <YYYY-MM-DD>. Gere layout.json + ad.html + styles.css e renderize via
render_ad.js. Inspecione o PNG antes de finalizar.
```

**Variações de formato** (mude o tamanho passado ao `render_ad.js`):
- Feed 4:5 → `1080 1350`
- Story 9:16 → `1080 1920` (texto na zona segura central)
- YouTube thumbnail 16:9 → `1280 720` (headline ≤ 6 palavras, alto contraste)

**Variações de layout** (campo `layout_type` no `layout.json`):
- `product_focus` — eyebrow + headline grande + subtext + CTA (oferta direta).
- `split` — texto de um lado, número-âncora/mockup do outro (comparativo).
- `lifestyle` — full-bleed (gradiente + Selet Dots) com headline + CTA (institucional).

### 12.3 Vídeo (`video-ad-specialist`)

```
Gere o scene JSON de um Reels da Taxa Zero, estratégia limited_offer, plataforma
instagram_reels, duração 15–20s. Ancore no Conceito <X> de product_campaign.md
("Os 4 Números" / "Vs. Mercado" / "O Convite" / "Migração Sem Trauma").
task_name: <nome>, task_date: <YYYY-MM-DD>. Salve apenas JSON válido em
outputs/<nome>_<data>/video/scenes.json (sem texto fora do bloco).
```

**Para renderizar o `.mp4`** (após gerar o scenes.json):

```
Renderize o vídeo da task <nome> reaproveitando a composition AdVideo em src/.
Adapte o conteúdo das scenes ao ângulo da campanha (1080×1920). Salve em
outputs/<nome>_<data>/video/<nome>.mp4 + preview_frame.png. Use `npm run render`.
```

### 12.4 Copy multi-plataforma (`copywriter-agent`)

```
Escreva a copy da Taxa Zero para <plataformas>. Se existir
outputs/<nome>_<data>/research_results.json, use o selected_campaign_angle.
Senão, ancore nos knowledge files. task_name: <nome>, task_date: <YYYY-MM-DD>.
Gere copy.json + os arquivos por plataforma em outputs/<nome>_<data>/copy/.
```

Plataformas suportadas: `instagram`, `threads`, `youtube`, `linkedin`.

### 12.5 Distribuição (`distribution-agent`)

```
Prepare a distribuição da task <nome> em modo dry-run (NÃO POSTAR).
task_date: <YYYY-MM-DD>. Suba a mídia em modo simulado (sem Supabase → URLs
placeholder com _simulated: true), monte metadata por plataforma a partir do
copy.json, e gere "Publish <nome> <data>.md" com URLs + metadata + agendamento
sugerido + status do gate.
```

### 12.6 Pipeline completo (`orchestrator`)

**Job payload modelo:**

```json
{
  "task_name": "<nome_curto_snake>",
  "task_date": "<YYYY-MM-DD>",
  "platform_targets": ["instagram", "youtube"],
  "user_flags": { "skip_research": false, "skip_image": false, "skip_video": false },
  "source_folder": null,
  "dry_run": true
}
```

**Prompt:**

```
Rode o pipeline completo da equipe de marketing com este payload:
<cole o JSON acima>

Execute: orchestrate.js (gera plano + logs) → research → ad + video + copy →
distribution. Tudo dry-run; nenhum posting real. Reporte cada etapa.
```

**Variações úteis de payload:**

Pular só o vídeo:
```json
"user_flags": { "skip_research": false, "skip_image": false, "skip_video": true }
```

Pular research (exige `assets/<task_name>/` populada **antes**):
```json
"user_flags": { "skip_research": true, "skip_image": false, "skip_video": false },
"source_folder": "assets/<task_name>"
```

4 plataformas:
```json
"platform_targets": ["instagram", "threads", "youtube", "linkedin"]
```

### 12.7 Campanha-demo (apresentável)

```
Crie uma CAMPANHA-DEMO COMPLETA da Taxa Zero dentro de tests/campanha-demo/.
Selecione UM ângulo (ex.: "Migração sem perder margem") e mantenha consistente
em ad + vídeo + copy. Entregue:
- research (3 deliverables, simulado)
- ads em 4 formatos (1080×1080, 1080×1350, 1080×1920, 1280×720) RENDERIZADOS via Playwright e inspecionados
- vídeo .mp4 REAL via Remotion (1080×1920, reaproveitando AdVideo)
- copy para IG, Threads, YouTube, LinkedIn
- Publish MD (dry-run, gate fechado)
- README.md índice
Não toque em outputs/.
```

### 12.8 Variações específicas (campanha)

**Comparativo "vs. mercado" (sem citar concorrentes):**
```
Cria um ad split (1080×1080) comparando taxa de mercado (~7,9%, em abstrato)
vs Taxa Zero da 4Selet. Use "split" como layout_type. Nenhum concorrente
nominal. CTA: "Calcular minha economia".
```

**Story 9:16 com número-âncora:**
```
Cria um ad instagram_story 1080×1920 da Taxa Zero, layout product_focus,
liderando com "95% de aprovação no cartão". Texto na zona segura central.
CTA: "Solicitar convite".
```

**Reels institucional "O Convite":**
```
Gera o scene JSON de um Reels (15s) ancorado no Conceito "O Convite" do
product_campaign.md, estratégia product_showcase, plataforma instagram_reels.
Inclua uma scene proof com "95% de aprovação no cartão".
```

**Caption + Story sequenciados (mesma campanha):**
```
Para a task <nome> (já existente), gere:
1) copy/instagram_caption.txt — caption de feed (com CTA "Solicitar convite")
2) ads/story.html + story.png — story 9:16 com a mesma headline da caption
Mantenha o mesmo selected_campaign_angle entre os dois.
```

### 12.9 Revisão e correção

**Auditar um asset existente contra a marca:**
```
Audite o arquivo <caminho> contra os knowledge files (brand_identity,
product_campaign, platform_guidelines). Aponte: cores off-brand, fontes erradas,
números da Taxa Zero incorretos, CTAs proibidos, concorrentes citados, hype/
emojis banidos. Sugira correções.
```

**Corrigir um asset:**
```
Reescreva <caminho> aplicando as correções da auditoria acima. Mantenha o
campaign_angle. Salve como <caminho>.v2.
```

### 12.10 Exemplos preenchidos (referência rápida)

Os prompts em 12.1–12.9 são **templates com placeholders** (`<...>`). Aqui estão **versões reais e preenchidas** dos 6 casos mais comuns — prontas pra copiar-colar e adaptar minimamente.

**A) Caption do Instagram (`copywriter-agent`)**
```
Escreva uma caption de Instagram da Taxa Zero, ângulo "Migração sem perder margem".
task_name: lancamento_junho, task_date: 2026-06-15. Salve em
outputs/lancamento_junho_2026-06-15/copy/instagram_caption.txt.
```

**B) Ad estático 1080×1080 (`ad-creative-designer`)**
```
Crie um ad estático 1080×1080 da Taxa Zero para Instagram Feed, layout product_focus,
ancorado no ângulo "Migração sem perder margem". task_name: ad_migracao,
task_date: 2026-06-15. Gere layout.json + ad.html + styles.css e renderize via
render_ad.js. Inspecione o PNG antes de finalizar.
```

**C) Story 9:16 com prova-âncora (variação)**
```
Crie um ad instagram_story 1080×1920 da Taxa Zero, layout product_focus,
liderando com "95% de aprovação no cartão". Texto na zona segura central.
CTA: "Solicitar convite". task_name: story_aprovacao, task_date: 2026-06-15.
```

**D) Reels 15s — gerar scene JSON (`video-ad-specialist`)**
```
Gere o scene JSON de um Reels (15s) da Taxa Zero, estratégia limited_offer,
plataforma instagram_reels. Ancore no Conceito "Os 4 Números" do
product_campaign.md. task_name: reels_4numeros, task_date: 2026-06-15.
Salve em outputs/reels_4numeros_2026-06-15/video/scenes.json (apenas JSON válido).
```

**E) Renderizar o `.mp4` do Reels acima**
```
Renderize o vídeo da task reels_4numeros reaproveitando a composition AdVideo
em src/. Adapte o conteúdo das scenes ao Conceito "Os 4 Números" (1080×1920).
Salve em outputs/reels_4numeros_2026-06-15/video/reels.mp4 + preview_frame.png.
Use `npm run render`.
```

**F) Pipeline completo IG + YouTube (`orchestrator`)**

Payload pronto:
```json
{
  "task_name": "campanha_junho_completa",
  "task_date": "2026-06-15",
  "platform_targets": ["instagram", "youtube"],
  "user_flags": { "skip_research": false, "skip_image": false, "skip_video": false },
  "source_folder": null,
  "dry_run": true
}
```

Prompt:
```
Rode o pipeline completo da equipe de marketing com este payload:
[cole o JSON acima]

Execute: orchestrate.js (gera plano + logs) → research → ad + video + copy →
distribution. Tudo dry-run; nenhum posting real. Reporte cada etapa.
```

**G) Auditoria rápida de um asset existente**
```
Audite o arquivo outputs/lancamento_junho_2026-06-15/copy/instagram_caption.txt
contra os knowledge files (brand_identity, product_campaign, platform_guidelines).
Aponte: cores off-brand, fontes erradas, números da Taxa Zero incorretos, CTAs
proibidos, concorrentes citados, hype/emojis banidos. Sugira correções.
```

> **Para adaptar:** troque `task_name`, `task_date`, e — quando aplicável — o **ângulo da campanha**, **plataforma** ou **formato**. O resto pode ficar como está.

---

## 13. Rodar via terminal (PowerShell)

Para os casos em que você prefere bypassar o chat do Claude e rodar scripts direto (útil pra automação, testes rápidos, etc.).

```powershell
# Render de vídeo (composition AdVideo)
npm run render
# → outputs/remotion_test_video/video.mp4

# Render de ad estático (Playwright)
node skills/ad-creative-designer/scripts/render_ad.js `
  <input.html> <output.png> <largura> <altura>

# Research (modo simulado sem TAVILY_API_KEY)
node skills/marketing-research-agent/scripts/research.js `
  --task <task> --date <data> --topic "<topico>" --out outputs/<task>_<data>

# Upload simulado de mídia
node skills/distribution-agent/scripts/upload_supabase.js `
  --task <task> --date <data> --out outputs/<task>_<data>

# Validar payload + gerar plano de pipeline
node skills/orchestrator/scripts/orchestrate.js --file <payload.json>
# Ou inline:
node skills/orchestrator/scripts/orchestrate.js --payload '<json inline>'
```

> O acento grave `` ` `` no PowerShell é continuação de linha.

---

## 14. Anatomia de uma campanha (o que cada arquivo significa)

**Em palavras simples:** quando uma campanha completa termina, você recebe uma **pasta com 5 grupos de arquivos** — a pesquisa, as imagens, o vídeo, os textos e o "pacote de publicação" final. Os outros arquivos (logs, planos) são internos do sistema; você normalmente só olha os 5 grupos principais.

A árvore técnica:

```
outputs/<task_name>_<YYYY-MM-DD>/
│
├── research_results.json        ← O "contrato": dados estruturados
│                                  consumidos por todos
├── research_brief.md            ← Resumo humano da pesquisa (+ Mermaid)
├── interactive_report.html      ← Dashboard com gráficos (Chart.js)
│
├── ads/
│   ├── layout.json              ← Blueprint do design (template, paleta)
│   ├── ad.html                  ← Materialização em HTML
│   ├── styles.css               ← Estilos do ad
│   └── instagram_ad.png         ← A IMAGEM FINAL renderizada (Playwright)
│
├── video/
│   ├── scenes.json              ← Roteiro estruturado (composition/props)
│   └── ad.mp4                   ← O VÍDEO FINAL (Remotion)
│
├── copy/
│   ├── copy.json                ← Estruturado, todas as plataformas
│   ├── instagram_caption.txt    ← Caption pronta
│   ├── threads_post.txt         ← Post Threads (se em platform_targets)
│   ├── linkedin_post.txt        ← Post LinkedIn (se em platform_targets)
│   └── youtube_metadata.json    ← Title + description + tags
│
├── logs/                        ← Log por agente (se via orchestrator)
│   ├── research_agent.log
│   ├── ad_creative_designer.log
│   ├── video_ad_specialist.log
│   ├── copywriter_agent.log
│   └── distribution_agent.log
│
├── pipeline_plan.json           ← Plano de execução (dependências, status)
├── media_urls.json              ← URLs da mídia (Supabase ou placeholders)
├── Publish <task> <data>.md     ← PACOTE FINAL pra revisão e publicação
├── preview.html                 ← REVIEW CONSOLIDADO (workflow Seção 23)
└── status.json                  ← ESTADO da task (workflow Seção 23)
```

> **Após aprovação** (ver Seção 23), a pasta inteira é movida pra `outputs/approved/<task>_<data>/`. Rejeitadas vão pra `outputs/archive/`.

### O que abrir primeiro

Se você for revisar uma campanha gerada:

1. **`Publish <task> <data>.md`** — vê o resumo + agendamento + status do gate.
2. **`ads/instagram_ad.png`** (e outros formatos) — vê os criativos.
3. **`video/ad.mp4`** — vê o vídeo.
4. **`copy/instagram_caption.txt`** (e outros) — lê o texto.
5. **`research_brief.md`** — confirma o ângulo escolhido.

### O que checar (revisão rápida)

- Os números da Taxa Zero estão corretos? (0% · 3 meses ou R$ 300 mil · R$ 1,99 · D+10 · D+30 · 95%)
- Nenhum concorrente foi citado nominalmente?
- O CTA é um dos aprovados?
- A paleta visual está oficial (sem branco/preto puro, sem Playfair)?
- O `campaign_angle` aparece coerente no ad, no vídeo e na copy?

Se sim em tudo: publica. Se não: peça correção (seção 12.9).

> **Persistência:** com git instalado (v2.54.0) e hook `post-commit` ativo, cada mudança em `outputs/` é versionada localmente automaticamente. Para backup **fora da VPS**, configure o `git remote` (ver `GIT_REMOTE_SETUP.md` e Seção 18). A cópia para `tests/` segue válida como atalho informal.

---

## 15. Gabarito de marca — faz / não faz

Resumo do que está em `knowledge/brand_identity.md` + `product_campaign.md` + `platform_guidelines.md`. Use como checklist rápido.

### ✅ Sempre

- **Paleta oficial:** Selet Darker `#07212B` · Navy `#003554` · Blue `#006494` · Sky `#5499B5` · Mist `#AFBCC9` · Cloud `#D9DCD6`. Selet Blue aparece em toda peça.
- **Tipografia:** Inter (display/body/UI) + JetBrains Mono (snippets técnicos, dados/prazos).
- **Números da Taxa Zero:** 0% pela plataforma por **3 meses OU até R$ 300 mil** (o que vier primeiro) · R$ 1,99 por transação · PIX **D+10** · cartão **D+30** · 95% aprovação · acesso **por convite**.
- **CTAs aprovados:** *Solicitar convite* · *Ver condições* · *Falar com o time* · *Conhecer a plataforma* · *Migrar minha operação* · *Calcular minha economia*.
- **Hashtags Instagram (3–5):** `#4Selet` (obrigatória) + `#TaxaZero` + produto (`#PlataformaDePagamentos`/`#Infoproduto`/`#AreaDeMembros`) + nicho (`#ProdutorDigital`/`#DigitalSerio`).
- **Frases-tag oficiais:** *"Para quem sabe que é Selet."* · *"A escolha de quem já performa."* · *"Produtor não é número. É parceiro."*

### ❌ Nunca

- Branco puro / preto puro / neon / gradiente quente / bege editorial.
- Playfair, DM Sans, Arial, Roboto, system fonts.
- Citar concorrentes nominalmente: Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay. Mercado só em abstrato (`~7,9%`).
- "0% pra sempre" / "100% grátis" / saque no mesmo dia.
- Emojis de hype 🔥 ⚡ 🚀 💸 💰 😱 ; hashtags banidas `#Sucesso` `#DinheiroFacil` `#MentorDoSucesso`.
- CTAs proibidos: *"Compre já!"* · *"Última chance!"* · *"Garanta sua vaga gratuita!"*.
- Personagens fictícios / depoimentos inventados (na dúvida, use a scene `proof` com o 95% de aprovação).
- Estética guru / hype / motivacional vazio.

> **Regra de ouro:** brand guidelines vencem qualquer prompt do usuário. Se um pedido conflitar com os knowledge files, o agente **corrige ou recusa** — não obedece cego.

---

## 16. Troubleshooting

### Erros e mensagens

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Cannot find module '@tavily/core'` | SDK não instalado | Modo simulado já cobre — só rotule `_simulated: true`. Para busca real: `npm i @tavily/core` + setar `TAVILY_API_KEY` |
| `TAVILY_API_KEY ausente` | Sem chave | **Esperado** — modo simulado, output rotulado |
| `SUPABASE_URL/KEY ausente` | Sem config | **Esperado** — `media_urls.json` com placeholders |
| `Cannot find module 'bullmq'` | `pipeline/` real não construído | Use o modo **sequencial** (`orchestrate.js` planeja, Claude dispara as skills em ordem) |
| `orchestrate.js` retorna exit 1 (`BLOQUEADO`) | `skip_research: true` sem `assets/<task>/` | Crie `assets/<task_name>/` com pelo menos 1 arquivo, ou desligue `skip_research` |

### Comportamento estranho

| Sintoma | Causa provável | Solução |
|---|---|---|
| Fontes serifadas / erradas no PNG | Google Fonts não carregou antes do screenshot | `<link>` no `<head>` do `ad.html`; o `render_ad.js` aguarda `document.fonts.ready` |
| PNG cortado / tamanho errado | Viewport ≠ formato | Passe `width height` correto ao `render_ad.js`; `.ad-container` com dimensões exatas e `overflow: hidden` |
| Skill não disparou | Claude não detectou trigger | Mencione a skill pelo nome no prompt: *"Use a skill `<nome>`…"* |
| Output sumiu entre sessões | Persistência remota não configurada (git local OK, falta `git remote`) | Configure o remoto (`GIT_REMOTE_SETUP.md`) ou copie para `tests/` como atalho informal |
| `outputs/<task>/logs/<agente>.log` vazio | Agente não rodou (dependência) | Cheque ordem: research 1º; distribution último; revisar `pipeline_plan.json` |
| Vídeo Remotion não renderiza | Composition `AdVideo` precisa de props que faltam | Cheque `src/AdVideo.tsx` — adapte o conteúdo das scenes ao ângulo antes de rodar `npm run render` |
| Claude entrou com a skill errada | Trigger phrase ambígua | Mencione a skill pelo nome explicitamente |
| Caption com 3 emojis | Generic prompting (sem ler brand_identity) | Force a leitura: *"Antes de gerar, leia `knowledge/brand_identity.md` (regras de emoji)..."* |
| Citou um concorrente | Idem | Force a leitura do knowledge file. Se persistir, é prompt ambíguo — peça explicitamente "sem nomes" |
| Headline com 8 palavras | Não leu a regra de ≤4 palavras | Diga: *"Headline com no máximo 4 palavras, liderando com número-âncora"* |

---

## 17. Perguntas frequentes (FAQ)

### "Eu preciso programar pra usar?"
**Não.** Tudo o que você faz é escrever em português no chat. As partes técnicas (renderizar PNG/MP4, executar scripts) acontecem automaticamente quando o Claude pede permissão e você aprova.

### "E se eu pedir algo que conflite com a marca?"
O agente vai **corrigir ou recusar**. Ex.: se você pedir "0% pra sempre", ele responde explicando que é 0% por 3 meses ou R$ 300 mil, e reescreve. Ele **não obedece cego**.

### "Posso usar esses agentes pra outra marca?"
**Não** sem reescrever os knowledge files. Tudo é 4Selet-specific — paleta, voz, números da Taxa Zero, frases-tag, lista de concorrentes proibidos. Se quiser adaptar pra outra marca, é um trabalho de reescrita dos `knowledge/*.md`.

### "Por que o research diz `_simulated: true`?"
Porque não tem `TAVILY_API_KEY` configurada. O agente, em vez de chamar a Tavily, sintetiza a inteligência a partir dos knowledge files e rotula como simulado. **Funciona** — só não é uma busca web real. Pra ativar busca real, ver seção 18.

### "Por que `outputs/` some entre sessões?"
Não some mais — **git está instalado (v2.54.0)** com hook `post-commit` ativo, versionando cada mudança localmente. O que ainda **não** existe é o **remoto** (backup fora da VPS) — se a VPS falhar, perde-se tudo. Configure via `GIT_REMOTE_SETUP.md` (Seção 18). Como atalho informal, copiar pra `tests/` segue válido.

### "O sistema publica sozinho?"
**Não.** Por design. O `distribution-agent` tem um *gate* que só destrava com referência explícita ao Publish MD pelo nome **+** fora de dry-run **+** tokens das plataformas. Mesmo cumprindo as 3 condições, é uma decisão consciente sua.

### "E se o vídeo `.mp4` ficar feio?"
A composition `AdVideo` é fixa (5 cenas, 1080×1920). Pra adaptar a outro ângulo, você precisa editar o conteúdo das scenes em `src/scenes/*.tsx` e re-renderizar. Para ajustes pequenos, peça ao Claude:
> *"Edite src/scenes/Hook.tsx para usar o texto 'X' em vez do atual, e renderize de novo."*

### "Como eu sei se o agente leu mesmo os knowledge files?"
Você vê no painel da extensão cada **Read** que ele faz, antes de aprovar. Se ele NÃO leu, peça explicitamente: *"Antes de gerar, leia knowledge/brand_identity.md e knowledge/product_campaign.md."*

### "Quantos agentes posso rodar ao mesmo tempo?"
Em modo sequencial (atual), **um por vez**. O orchestrator paraleliza conceitualmente (ad + vídeo + copy podem rodar em qualquer ordem), mas o Claude executa um após o outro. Quando o BullMQ for instalado (seção 18), aí sim paraleliza de verdade em workers separados.

### "O que é o `pipeline_plan.json`?"
É o plano de execução que o `orchestrator.js` gera ao receber um payload. Lista cada job, sua dependência (ex.: `ad_creative_designer` depende de `research_agent`), seu status (`queued`/`running`/`complete`/`skipped`/`blocked`) e notas. Útil pra debug quando algo trava.

### "Posso editar um output e re-renderizar?"
Sim. Por exemplo: você gerou um ad, não gostou do texto. Edite o `ad.html` à mão e rode:
```powershell
node skills/ad-creative-designer/scripts/render_ad.js outputs/<task>/ads/ad.html outputs/<task>/ads/instagram_ad.png 1080 1080
```
Que ele re-renderiza o PNG com a sua edição.

### "Tem como criar um novo agente?"
Sim, mas é trabalho. Veja como os existentes estão estruturados em `skills/<nome>/SKILL.md` (frontmatter + steps + examples + troubleshooting + checklist) e replique o padrão. Mantenha o vínculo com os knowledge files.

### "Como contribuir / melhorar este guia?"
Edite o `GUIA_DE_USO.md` direto no projeto. A versão HTML pode ser regenerada por qualquer pessoa do time pedindo:
> *"Regere o GUIA_DE_USO.html a partir do GUIA_DE_USO.md."*

---

## 18. Próximos passos do projeto

Em ordem de prioridade (do `STATUS_PROJETO.md`):

### 1) Criar repositório remoto e configurar `git remote`
**Por quê:** Git local **já está instalado** (v2.54.0) com hook `post-commit` ativo empurrando em background. Falta apenas o **remoto** para backup fora da VPS — sem isso, falha de disco apaga `history[]`, `content_hashes` e decisões de aprovador.
**Como:** criar repo **privado** (GitHub/GitLab/Bitbucket), depois `git remote add origin <URL>` + `git push -u origin main`. Passo a passo + fallback cron de 5 min em `GIT_REMOTE_SETUP.md`.

### 2) Configurar `TAVILY_API_KEY`
**Por quê:** Desliga o modo simulado da pesquisa, libera as 5 buscas web reais (tendências, concorrentes, audiência, hooks, virais).
**Como:** `npm i @tavily/core`, criar conta na Tavily, gerar API key, setar como variável de ambiente `TAVILY_API_KEY=...` (no `.env` ou no shell).

### 3) Configurar Supabase
**Por quê:** Desliga o modo simulado do hosting de mídia, gera URLs públicas reais consumíveis pelas APIs do Instagram/YouTube.
**Como:** `npm i @supabase/supabase-js`, criar projeto no Supabase, criar bucket `campaign-uploads` público, pegar `SUPABASE_URL` e `SUPABASE_KEY` (service role), setar como env vars.

### 4) Construir `pipeline/` (BullMQ + Redis)
**Por quê:** Execução enfileirada em vez de sequencial — paraleliza ad/vídeo/copy em workers separados, retry automático, agendamento.
**Como:** `npm i bullmq`, configurar `REDIS_URL` (Upstash funciona bem como serviço gerenciado), criar `pipeline/orchestrator.js` (enqueue) e `pipeline/worker.js` (processamento).

### 5) OAuth YouTube + token Instagram
**Por quê:** Habilita posting real (sempre **atrás do gate** de aprovação manual).
**Como:** seguir docs do YouTube Data API (OAuth refresh token) e do Instagram Graph API (token de Business Account). Adicionar credenciais ao distribution-agent.

---

## 19. Arquivos importantes do projeto

| Arquivo | Para que serve |
|---|---|
| `CLAUDE.md` | Contexto técnico principal — auto-carregado pela extensão Claude Code |
| `STATUS_PROJETO.md` | Estado atual (o que está pronto / pendente) |
| **`GUIA_DE_USO.md`** | **Este documento** — como operar o sistema no dia a dia |
| **`GUIA_DE_USO.html`** | Versão estilizada do guia (mesma informação, para abrir no browser) |
| `knowledge/brand_identity.md` | Identidade visual + voz + governance (v1.1) |
| `knowledge/product_campaign.md` | Taxa Zero, números, 9 diferenciais, 4 conceitos de vídeo (v1.2) |
| `knowledge/platform_guidelines.md` | Specs e tom por plataforma (v1.1) |
| `skills/<nome>/SKILL.md` | Definição de cada agente (steps, examples, checklist) |
| `skills/<nome>/scripts/*.js` | Scripts auxiliares (render, research, upload, orchestrate) |
| `src/AdVideo.tsx` + `src/scenes/*` | Composition Remotion (vídeo) |
| `assets/` | Logos oficiais, kit de identidade, vídeos de referência |
| `SPEC_WORKFLOW_APROVACAO.md` | Spec técnica do Workflow de Aprovação (v1.1 pós-implementação com changelog + issues fechadas/abertas) |
| `VALIDACAO_E_AJUSTES_WORKFLOW.md` | Relatório da auditoria inicial + prompt de ajustes pra VPS (referência histórica) |
| `VALIDACAO_FINAL_v1.1.md` | Validação final pós-v1.1+ (3 críticos fechados, B.2 runtime, decisões abertas) |
| `GIT_REMOTE_SETUP.md` | Passo a passo pra configurar repo remoto + push automatizado + cron de fallback |
| `Skills dos Agentes Detalhado.md` | Documento-fonte original (escopo) — referência histórica, **não editar** |

<!-- test/TESTES_AGENTES.md (spec dos 17 testes) e test/RESULTADOS_TESTES.md
     (relatório antigo, parcial) existem em test/ mas foram removidos desta
     tabela. Re-adicionar quando os 17 testes forem re-executados sob a
     v1.1 (R5 + B.2 + content_hash) e o relatório for regenerado. -->

---

## 20. Casos de uso comuns (prompts diários)

Esta seção é um **índice por necessidade** — você sabe o que quer fazer, ela mostra qual prompt usar. Para a referência completa **por agente**, ver Seção 12.

### 🟢 "Quero fazer UM post de Instagram (feed)"
**Receita:** ad estático + caption.
1. Crie o ad: Seção 12.2 (formato 1080×1080 quadrado, ou 1080×1350 para 4:5).
2. Escreva a caption: Seção 12.4 (plataforma `instagram`).

### 🟢 "Quero fazer UM Story"
**Receita:** ad estático no formato story.
- Seção 12.2 com tamanho **1080×1920** (`instagram_story`). Cuide pra texto ficar na **zona segura central** (~60% do meio — em torno do logo do perfil em cima e da barra de "Enviar mensagem" embaixo).
- Stories geralmente não levam caption longa — coloque a copy-chave no próprio visual.

### 🟢 "Quero fazer UM Reels (vídeo curto)"
**Receita:** roteiro + render.
1. Gere o scene JSON: Seção 12.3 (plataforma `instagram_reels`).
2. Renderize o `.mp4`: Seção 12.3 (prompt do render).
3. Opcional: caption pro Reels via Seção 12.4.

### 🟡 "Quero um carrossel pro Instagram"
**⚠️ Limitação conhecida:** o `ad-creative-designer` gera **UMA imagem por vez**. Carrossel é uma **sequência**. Workflow:

1. Defina **quantos slides** (3 a 5 é o ideal) e o **arco narrativo**:
   - Slide 1: hook (número-âncora ou pergunta)
   - Slides 2 a N−1: desenvolvimento
   - Slide N: CTA
2. Rode Seção 12.2 **uma vez para cada slide**, mantendo o `task_name` e variando o conteúdo:
   ```
   Crie ad slide 1 da Taxa Zero, layout product_focus, 1080×1080,
   hook "0% de taxa". task_name: carrossel_junho, task_date: 2026-06-15.
   Salve como outputs/carrossel_junho_2026-06-15/ads/slide_1.png.
   ```
   ```
   Crie ad slide 2 da Taxa Zero, layout product_focus, 1080×1080,
   "Por 3 meses ou até R$ 300 mil em vendas". task_name: carrossel_junho...
   Salve como slide_2.png. MESMO layout e MESMA paleta do slide 1 (coerência visual).
   ```
3. Escreva a caption do carrossel via Seção 12.4.
4. **No Instagram, faça upload manual dos N PNGs** na ordem. (Não há automação de carrossel hoje — Meta API permite, mas não está implementado — ver Seção 22.)

### 🟢 "Quero uma thumbnail de YouTube"
**Receita:** ad estático no formato 16:9.
- Seção 12.2 com tamanho **1280×720**. Headline com até **6 palavras**, alto contraste Navy/Darker, foco em UM número-âncora.

### 🟢 "Quero adaptar um post de feed para Story"
**Mesma campanha, formato diferente:**
```
Para a task <nome_existente> (já criada), gere uma versão Story (1080×1920) do ad.
Mantenha o mesmo selected_campaign_angle e o mesmo headline. Reposicione o texto
na zona segura central. Salve em outputs/<nome>/ads/story.png.
```

### 🟢 "Quero várias variações do mesmo ad pra testar A/B"
```
Crie 3 variações do ad da Taxa Zero (1080×1080, product_focus), cada uma com um
ângulo diferente: (1) Migração sem trauma, (2) 95% de aprovação no cartão,
(3) 0% por 3 meses pra medir a diferença. task_name: teste_ab_junho,
task_date: 2026-06-15. Salve como variacao_1.png, variacao_2.png, variacao_3.png
em outputs/teste_ab_junho_2026-06-15/ads/.
```

### 🟢 "Quero o conjunto de uma semana inteira (cronograma)"
Use o pipeline completo (Seção 12.6) **e depois** peça as adaptações por dia da semana:
1. Rode a pipeline (research + ad + vídeo + copy + Publish MD).
2. A partir da pasta gerada, peça versões adicionais (story do ad, thumbnail, carrossel) reaproveitando o `selected_campaign_angle`.
3. O Publish MD vai trazer o **sequenciamento sugerido** (Seg LinkedIn → Ter IG Feed → Qua YouTube → Qui Reels+Threads → Sex Story).

### 🟢 "Quero auditar um conteúdo antes de publicar"
**Seção 12.9 (Auditoria de marca).** Envie o caminho do arquivo, o sistema aponta o que está off-brand (cores, fontes, números, CTAs, concorrentes citados, hype).

### 🟢 "Quero a campanha COMPLETA (tudo de uma vez)"
**Seção 12.6 (Pipeline completo).** Um payload, todos os agentes rodam em ordem. Saída em `outputs/<task>_<data>/` com tudo organizado.

> **Dúvida frequente:** "qual agente eu uso para X?" Se não souber, use o **prompt em linguagem natural** descrevendo o resultado que quer ("uma imagem pro Instagram", "um vídeo de 15s") — o Claude detecta o agente certo pela trigger phrase. Se acertar a skill errada, mencione-a pelo nome: *"Use a skill `<nome>`..."*.

---

## 21. Como criar / adaptar uma campanha

A 4Selet hoje tem **Taxa Zero** como campanha principal. Mas você vai precisar de variações eventualmente. Três níveis — escolha o que cabe no seu caso:

### Nível 1 — Mesmo guarda-chuva, ângulo diferente (TRIVIAL)
*Exemplo: dentro de Taxa Zero, focar em "95% de aprovação" em vez de "0% por 3 meses".*

**Como fazer:** **só trocar o `<angulo>` no prompt.** O agente já tem todos os fatos da Taxa Zero no `product_campaign.md` — você só escolhe a ênfase.

```
Crie um ad estático 1080×1080 da Taxa Zero, layout product_focus,
ancorado no ângulo "95% de aprovação no cartão = mais receita líquida".
task_name: campanha_aprovacao, task_date: 2026-06-15.
```

⏱️ Tempo: instantâneo. **Nada técnico precisa mudar.**

### Nível 2 — Sub-campanha NOVA da 4Selet (MÉDIO)
*Exemplo: lançar "Indique e Ganhe", "Aniversário Selet", "Black Friday Selet".*

**Duas opções, dependendo se é pontual ou recorrente:**

**🅐 Opção A — Pontual (uma vez só):** descreva a campanha no próprio prompt, com **mais contexto** que o normal. O agente trabalha em cima do `brand_identity.md` geral e adapta:
```
Crie um ad estático 1080×1080 para a campanha "Indique e Ganhe" da 4Selet.
Mecânica: produtor estabelecido que indica outro produtor estabelecido ganha
30 dias adicionais de Taxa Zero. Use o tom sóbrio da marca, paleta oficial,
CTA "Indicar agora". task_name: indique_e_ganhe, task_date: 2026-06-15.
```

⏱️ Tempo: minutos. **Nada permanente muda.**

**🅑 Opção B — Permanente (várias peças ao longo do tempo):** peça pra **atualizar o `product_campaign.md`** adicionando uma seção sobre a nova campanha. A partir daí, ela faz parte do knowledge base e o sistema usa naturalmente:
```
Adicione ao knowledge/product_campaign.md uma nova seção (após a Taxa Zero)
descrevendo a campanha "Indique e Ganhe": mecânica, números, headlines aprovadas,
conceitos de vídeo, CTAs. Mantenha o tom e a estrutura das outras seções.
```

Depois disso, **qualquer prompt** ("crie um ad da Indique e Ganhe...") aciona os fatos corretos automaticamente — sem precisar repetir contexto.

⏱️ Tempo: ~15-30 min (uma edição do knowledge file + revisão).

### Nível 3 — Marca diferente (GRANDE)
*Exemplo: usar o sistema pra produzir conteúdo de outra empresa.*

**Não é o caso de uso esperado.** Os knowledge files são totalmente 4Selet-specific — paleta, voz, números, frases-tag, lista de concorrentes proibidos.

**Tecnicamente possível** reescrever os 3 arquivos `knowledge/*.md` pra outra marca, mas isso é **um projeto à parte** — clone a estrutura num diretório novo, refaça `brand_identity` / `product_campaign` / `platform_guidelines`, ajuste os exemplos nos `SKILL.md`.

⏱️ Tempo: dias/semana. **Trabalho real de adaptação.**

> **Resumo prático:** Nível 1 e 2 cobrem 99% dos casos. Nível 3 é refazer o projeto pra outra marca — discuta com o time antes.

---

## 22. Integrar a API da Meta para postagens automatizadas

### ⚠️ Antes de mais nada — duas verdades importantes

**Verdade 1:** o sistema foi desenhado pra **PROTEGER você** de postar sem revisão. O **gate** do `distribution-agent` **continua existindo** mesmo com a API da Meta configurada. Você ainda precisa dizer *"publica usando Publish X.md"* pra cada peça. Isso é proteção contra erros caros (texto errado, número errado, momento errado).

**Verdade 2:** "**postar sem fazer mais nada**" — automação 100%, sem revisão humana — **NÃO é recomendado**. Já vimos marcas postando conteúdo errado de bot sem ninguém olhar. Pra a 4Selet, que tem voz sóbria e regras estritas de marca, é alto risco de **queimar reputação por economizar 30 segundos**.

### O que muda com a API configurada (caminho recomendado)

| Hoje (sem API) | Com Meta API |
|---|---|
| Gera a campanha → revisa Publish MD → **copia caption à mão, faz upload da imagem no app, posta** | Gera a campanha → revisa Publish MD → **"publica usando Publish X.md"** → sistema posta automaticamente |

**O que economiza:** o trabalho **manual** de upload + cópia.
**O que NÃO economiza:** a **revisão**. E é assim por design.

### O fluxo do usuário, comparado

**Hoje** (gate fechado, sem API):
1. Rodar pipeline ou peça única
2. Revisar o Publish MD
3. **Copiar a caption no Instagram à mão**
4. **Fazer upload do PNG no Instagram à mão**
5. **Publicar manualmente**

**Com Meta API + Supabase configurados** (gate fechado, posting automatizado):
1. Rodar pipeline ou peça única
2. Revisar o Publish MD
3. *"Publica usando Publish taxa_zero_maio 2026-05-29.md"*
4. **Sistema posta automaticamente** e devolve `post_id` + URL pública

Passos 1, 2 e 3 continuam exigindo você. O passo 4 substitui upload manual.

### O que precisa ser configurado (trabalho de dev/admin, não do usuário)

**Do lado da Meta:**
- Conta **Facebook Business** ativa.
- **Página do Facebook** conectada à conta **Instagram Business** (Instagram pessoal **não** funciona).
- App no **Facebook Developers** com as permissões: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `pages_manage_posts`.
- App pode precisar passar por **App Review** da Meta — pode levar dias ou semanas, dependendo do tipo de uso e da documentação enviada.
- **Long-lived access token** (`IG_ACCESS_TOKEN`).
- ID da conta business (`IG_BUSINESS_ACCOUNT_ID`).

**Do lado do projeto 4Selet:**
- Configurar **Supabase** (ou outro hosting) — Instagram **exige URLs públicas** pra publicar a partir de mídia externa.
- Setar variáveis de ambiente: `IG_ACCESS_TOKEN`, `IG_BUSINESS_ACCOUNT_ID`.
- Implementar as chamadas Graph API no `distribution-agent` (já existe um esqueleto no `SKILL.md` descrevendo o alvo — falta o código real).

**YouTube** segue padrão similar mas com **OAuth 2.0** (mais complicado de obter, porque exige tela de consentimento do Google e armazenamento seguro do refresh token).

### Plataformas e limites

| Plataforma | API | Limite/dia | Status do projeto |
|---|---|---|---|
| Instagram (Feed + Reels) | Graph API | ~25 posts | Implementável (gate + Supabase necessários) |
| YouTube (Shorts + Long-form) | Data API v3 | ~6 uploads | Implementável (OAuth necessário) |
| Threads / X | — | — | **Sem API pública estável** → continua post manual |
| LinkedIn | — | — | **Sem API pública estável** pra orgânico → continua post manual |

### Se quiser desabilitar o gate (autopublicação 100%)

**Tecnicamente possível, mas:** você assume o risco de publicar conteúdo errado **sem nenhuma revisão humana**. Pra desabilitar, modificaria-se o `distribution-agent` removendo a checagem do gate.

**Recomendação:** **NÃO faça.** O ganho de "uma frase a menos" não compensa o risco de queimar a marca com um post errado. Se for absolutamente necessário (ex.: uma automação noturna agendada), implemente um **gate condicional** (só auto-posta se o conteúdo passou no Brand Governance checklist **sem nenhum aviso**). Mas isso é design fino — vale discutir com o time antes.

### Resumo executivo

- ✅ **Pode automatizar o upload e a chamada de API** (esse é o ganho real, e é seguro).
- ❌ **Não recomendamos automatizar a APROVAÇÃO** (perde-se a revisão humana — a marca paga o preço se sair errado).
- 🔧 **É trabalho de dev/admin**, não de usuário. Discuta com o time técnico antes de iniciar.
- 📅 **Pré-requisito:** Supabase configurado (sem isso, não dá pra postar via API).

---

## 23. Workflow de aprovação: preview, aprovar, arquivar

Máquina de estados explícita para cada campanha (task), com `status.json` como fonte da verdade versionada em git. Implementado na v1.1 (R5 gate duplo + content_hash SHA-256 + B.2 runtime validados).

### 23.1 Estados

| Estado | Pasta | Quem pode escrever | Significado |
|---|---|---|---|
| `draft` | `outputs/<task>_<date>/` | agentes de conteúdo | task criada; agentes produzindo |
| `in_review` | `outputs/<task>_<date>/` | nenhum agente (só humano) | preview gerado, aguarda decisão |
| `approved` | `outputs/approved/<task>_<date>/` | **ninguém** (auto-revert se editar) | aprovada; `content_hashes` SHA-256 registradas |
| `rejected` | `outputs/archive/<task>_<date>/` | agentes via rework | rejeitada com `reason` |

### 23.2 Transições legais

```
null      → draft         (orchestrator: bootstrap)
draft     → in_review     (distribution-agent: gera preview)
in_review → approved      (humano via task-promoter, exige --by)
in_review → rejected      (humano via task-promoter, recomenda --reason)
approved  → in_review     (rework manual ou auto-revert)
rejected  → in_review     (rework)
```

Tentativas fora dessa matriz → `E_INVALID_TRANSITION` (exit 1).

### 23.3 Comandos essenciais

**Criar uma task nova:**
```bash
node scripts/orchestrator.js --task minha_campanha --date 2026-06-15 --platforms instagram,youtube
```

**Gerar preview + promover para revisão:**
```bash
node scripts/generate_preview.js --task minha_campanha --date 2026-06-15
# abre outputs/minha_campanha_2026-06-15/preview.html no navegador
```

**Aprovar:**
```bash
node scripts/promote_task.js --task minha_campanha --date 2026-06-15 --to approved --by "Hugo"
```

**Rejeitar com motivo:**
```bash
node scripts/promote_task.js --task minha_campanha --date 2026-06-15 --to rejected --reason "claim fora da marca" --by "Hugo"
```

**Rework (voltar para revisão):**
```bash
node scripts/promote_task.js --task minha_campanha --date 2026-06-15 --to in_review
```

### 23.4 Auditoria e integridade

```bash
# Validar todos os status.json (schema, zona vs status, hashes em approved)
node scripts/validate_status.js

# Verificar integridade SHA-256 de outputs/approved/ (exclui status.json e preview.html)
node scripts/check_approved_integrity.js                # só relata
node scripts/check_approved_integrity.js --auto-revert  # move para draft se editado

# Regenerar INDEX.md (auto-disparado por approve/reject; manual se necessário)
node scripts/refresh_index.js

# Migrar tasks pré-Workflow (sem status.json)
node scripts/migrate_legacy.js --dry-run                # lista o que faria
node scripts/migrate_legacy.js                          # executa
node scripts/migrate_legacy.js --include-test           # inclui test/campanha-demo/
```

### 23.4a Gate duplo de publicação (R5) ⚠️

**OBRIGATÓRIO antes de qualquer post real (IG Graph, YouTube Data API).** Verifica em runtime que:
1. `status.status === "approved"` (não basta pasta em `outputs/approved/` — pode ser órfã)
2. `content_hashes` batem com SHA-256 do conteúdo atual (não basta pasta intacta — pode ter sido editada)

```bash
# Como CLI (uma task):
node scripts/check_approval_gate.js --task <name> --date <date>
# Exit 0 → OK publicar. Exit 1 → bloqueado (ler stderr para código)

# Como módulo (no código do publisher):
const { assertPublishApproved } = require('./scripts/check_approval_gate');
assertPublishApproved({ taskName: 'x', date: '2026-06-02' });  // lança em violação
```

`content_hashes` exclui `status.json` (mutável por design) e `preview.html` (artefato gerado). Tasks sem conteúdo real (só status + preview) → `content_hashes = {}` → gate bloqueia com `E_GATE_NO_HASHES` (proteção contra task vazia bypass).

### 23.5 O que a `preview.html` mostra

Single-file HTML (sem deps; Google Fonts via CDN):
- **Header sticky** com nome da campanha, `.status-badge`, ângulo, data e plataformas.
- **Nav âncora**: Ads · Vídeo · Captions · Research · Publish · Checklist.
- **Seções 1–5**: thumbnails dos ads, player do vídeo, captions com contador de caracteres, research brief colapsável, Publish MD renderizado.
- **Seção 6 — Checklist de marca** (6 regras automáticas):
  - a) Números Taxa Zero (`0%`, `3 meses`, `R$ 300 mil`, `R$ 1,99`, `D+10`, `D+30`, `95%`)
  - b) CTAs aprovados (`Solicitar convite`, `Falar com o time`, etc.)
  - c) Paleta oficial + tipografia (sem `#fff`/`#000`/Playfair/Arial)
  - d) Concorrentes nominais (lista negra: Hotmart/Kiwify/Eduzz/Ticto/etc.)
  - e) Emoji ≤1 funcional por caption (banidos: 🔥⚡🚀💸💰😱)
  - f) Hashtags válidas (`#4Selet` obrigatória; banidas: `#Sucesso`/`#DinheiroFacil`/`#MentorDoSucesso`)

Cada regra: ✅ (ok) · ⚠️ (warn, com evidência textual) · ❌ (fail).

### 23.6 Códigos de erro

**Transições e bootstrap (`promote_task.js`, `orchestrator.js`, `generate_preview.js`):**

| Código | Exit | Causa típica | Como recuperar |
|---|---|---|---|
| `E_INVALID_TRANSITION` | 1 | Transição fora da matriz | Mensagem sugere rota legal |
| `E_MISSING_APPROVER` | 1 | `--by` ausente em `approved` | Adicionar `--by "<nome>"` |
| `E_UNKNOWN_STATE` | 1 | `--to <x>` com `<x>` fora do enum | Usar `draft|in_review|approved|rejected` |
| `E_STATUS_PARSE` | 2 | `status.json` corrompido (JSON inválido) | Restaurar do git: `git checkout HEAD -- outputs/.../status.json` |
| `E_DUPLICATE_LOCATION` | 2 | Task em múltiplas zonas (outputs/, approved/, archive/) | Decidir manualmente qual é canônica, apagar as outras |
| `E_REBOOTSTRAP_BLOCKED` | 1 | `orchestrator.js` chamado em task aprovada/rejeitada | Rodar `--to in_review` antes |

**Gate duplo de publicação (`check_approval_gate.js` — R5):**

| Código | Exit | Causa típica | Como recuperar |
|---|---|---|---|
| `E_TASK_NOT_FOUND` | 1 | `outputs/approved/<task>_<date>/` ausente | Task nunca foi aprovada; checar com `validate_status.js` |
| `E_INVALID_STATE` | 1 | Pasta em `approved/` mas `status.status !== "approved"` (órfã) | Reconciliar via `promote_task.js`; investigar como ficou inconsistente |
| `E_GATE_NO_HASHES` | 1 | Task aprovada **sem** `content_hashes` (legacy ou pre-A.2 ou task vazia) | Re-promover (`--to in_review` → `--to approved`) ou migrar via `migrate_legacy.js`. **Bypass para task vazia é NEGADO por design.** |
| `E_HASH_MISMATCH` | 1 | Conteúdo alterado pós-aprovação | `check_approved_integrity.js --auto-revert`, reaprovar |

### 23.7 Gate de POSTING (inalterado)

O Workflow **não** mudou o gate de POSTING. Publicação real exige **TODAS** as condições:
1. Usuário referencia o Publish MD **pelo nome** (`Publish <task> <date>.md`).
2. `dry_run: false`.
3. Tokens presentes (IG Graph, YouTube OAuth).
4. **R5 (Step 5a):** `assertPublishApproved({ taskName, date })` retorna sucesso → `status.status === "approved"` E `content_hashes` batem em runtime.

Em modo dry-run / sem tokens → fica no Publish MD para post manual.

### 23.8 Regra CRITICAL Re-aprovação

Os 4 agentes de conteúdo (research, ad, video, copy) têm a regra CRITICAL no início do `SKILL.md`: **se o caminho começa com `outputs/approved/`, PARAR**. Para editar, rodar `promote_task --to in_review` primeiro.

Como contracheque automático: `scripts/check_approved_integrity.js` calcula SHA-256 dos arquivos no momento da aprovação (`status.content_hashes`); divergência detectada (edição manual via VSCode, script, etc.) → com `--auto-revert`, a task volta para `draft` com `event_type: "edit_revert"` no history e `previous_approval` preservado.

### 23.9 Testes que validam o Workflow

- **10/10 caminhos felizes** (bootstrap → preview → approve → rework → reject)
- **7/7 adversariais B.1** (B.1.1–B.1.7): transições inválidas, `--by` ausente, estado fora do enum, `status.json` corrompido, task em múltiplas zonas, idempotência do `generate_preview`
- **3/3 runtime B.2** (B.2.1–B.2.3): edit detection sem mutação · `--auto-revert` restaura com `previous_approval` preservado · gate bloqueia task vazia com `E_GATE_NO_HASHES`

Ver `SPEC_WORKFLOW_APROVACAO.md` v1.1 para o contrato técnico completo.
