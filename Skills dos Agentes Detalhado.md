# Video Ad Specialist

## Video Ad Specialist Skill — Key Details

### Skill Name

video-ad-specialist

### Propósito

A skill Video Ad Specialist converte intenção de marketing em scenes estruturadas de video ad short-form otimizadas para plataformas de redes sociais.

Esta skill não renderiza o vídeo em si. Em vez disso, ela gera JSON estruturado descrevendo a estratégia do ad e a sequência de scenes, que é então consumido pela skill de rendering Remotion para produzir o vídeo final.

Isso separa a geração de estratégia de marketing da renderização de vídeo.

### Core Responsibilities

A skill Video Ad Specialist executa quatro funções primárias.

**1️⃣ Ad Strategy Generation**

A skill determina a melhor estrutura de anúncio baseada no produto, audiência, plataforma e objetivo da campanha.

Exemplos de tipos de estratégia:
- product_showcase
- problem_solution
- testimonial
- limited_offer
- lifestyle
- meme_style

A estratégia selecionada determina:
- estrutura narrativa
- pacing
- ordenação de scenes
- ênfase na mensagem

**2️⃣ Platform Optimization**

A skill adapta o pacing e estrutura do ad dependendo da plataforma alvo.

Exemplo de lógica de otimização:

**Instagram Reels**
Estrutura rápida hook-driven:
Hook → Product → Benefit → CTA

Pacing típico:
Hook – ~2s
Product – ~5s
Benefit – ~3s
CTA – ~2s
Total: 10–12 segundos

**YouTube Shorts**
Estrutura mais narrativa:
Hook → Problem → Solution → CTA
Total: 12–15 segundos

**3️⃣ Scene Generation**

A skill converte a estratégia escolhida em scenes estruturadas.

Cada scene representa uma unidade que o renderer Remotion pode traduzir em visuais.

Tipos de scene podem incluir:
- hook
- problem
- product
- benefit
- testimonial
- offer
- cta

Exemplo de estrutura de scene:

```json
{
  "type": "hook",
  "text": "Você ainda constrói do zero?"
}
```

Exemplo de fluxo de scenes:

Scene 1 – Hook
Scene 2 – Introdução do produto
Scene 3 – Benefício-chave
Scene 4 – CTA

**4️⃣ Remotion Configuration Output**

O output final deve ser JSON diretamente compatível com a skill de rendering Remotion.

Exemplo de output:

```json
{
  "composition": "AdVideo",
  "props": {
    "style": "product_showcase",
    "duration": 12,
    "platform": "instagram_reels",
    "scenes": [
      { "type": "hook", "text": "Você ainda constrói do zero?" },
      { "type": "product", "text": "88 templates testados em produção" },
      { "type": "benefit", "text": "O mesmo agente que eu vendo por R$7.500" },
      { "type": "cta", "text": "Copia e cola." }
    ]
  }
}
```

Este JSON é passado diretamente para o projeto Remotion, que renderiza o vídeo final.

### Input Requirements

A skill espera contexto de marketing como:

| Input | Exemplo |
|-------|---------|
| Product | Kit Definitivo N8N / Mente Mestra Claude Code |
| Target Audience | Freelancers e donos de agência |
| Platform | Instagram Reels |
| Campaign Goal | Converter em compra |

Se inputs estiverem faltando, a skill deve inferir defaults razoáveis.

### Output Format

A skill deve gerar apenas JSON válido.

Campos obrigatórios:
- composition
- props.style
- props.duration
- props.platform
- props.scenes

Cada scene deve incluir:
- type
- text

Propriedades opcionais podem incluir:
- visual
- transition
- animation

### Relacionamento com Outras Skills

Esta skill fica no pipeline antes do rendering Remotion.

Fluxo do pipeline:

```
User Prompt
     ↓
Video Ads Agent
     ↓
Video Ad Specialist Skill
     ↓
Ad Scene JSON
     ↓
Remotion Rendering Skill
     ↓
Rendered Video
```

A Video Ad Specialist gera a estrutura do ad, enquanto a skill Remotion renderiza o video asset final.

### Papel no Pipeline de Marketing

Dentro do sistema completo de marketing com IA:

```
Research Agent
     ↓
Ad Creative Designer
     ↓
Video Ad Specialist
     ↓
Remotion Rendering
     ↓
Copywriter Agent
     ↓
Distribution Agent
```

A Video Ad Specialist atua como ponte entre estratégia de marketing e produção de vídeo.

### Princípio de Design

O formato de output deve ser reutilizável em múltiplos marketing assets.

O mesmo ad strategy JSON pode potencialmente alimentar:
- Remotion video ads
- Static image ads
- Social captions
- Distribution metadata

Isso garante mensagem consistente entre formatos de mídia.

---

# Ad Creative Designer

## 1. Conceito

Ao invés de gerar pixels com um modelo de IA, o agente gera uma especificação de design. O frontend lê essa especificação e renderiza o ad.

Então o pipeline fica:

```
User Prompt
     ↓
Image Ads Agent
     ↓
Ad Creative Designer Skill
     ↓
Layout JSON
     ↓
Frontend Renderer
     ↓
Export PNG
```

A IA cria o design blueprint, não a imagem em si.

## 2. O Que o Agente Gera

O agente gera layout data estruturado.

Exemplo:

```json
{
  "format": "instagram_square",
  "background": "#F5F0E8",
  "elements": [
    {
      "type": "headline",
      "text": "Para de Construir do Zero",
      "x": 80,
      "y": 120,
      "fontSize": 64
    },
    {
      "type": "subtext",
      "text": "88 Templates Testados em Produção",
      "x": 80,
      "y": 200
    },
    {
      "type": "cta",
      "text": "Copia e Cola",
      "x": 80,
      "y": 350
    },
    {
      "type": "image",
      "src": "/assets/claude_code_terminal.png",
      "x": 600,
      "y": 200,
      "width": 300
    }
  ]
}
```

Esse JSON se torna seu design spec.

## 3. O Frontend Renderer

Você constrói um frontend simples usando React ou Next.js.

Ele renderiza o layout num HTML5 Canvas.

Ideia básica:

```javascript
const canvas = document.getElementById("adCanvas");
const ctx = canvas.getContext("2d");
ctx.fillStyle = layout.background;
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

Depois faz loop pelos elements.

## 4. Renderizando Texto

Exemplo de renderização de headline:

```javascript
ctx.font = "bold 64px Playfair Display";
ctx.fillStyle = "#2C1810";
ctx.fillText("Para de Construir do Zero", 80, 120);
```

O agente controla:
- text
- position
- font size

## 5. Renderizando Imagens

Exemplo:

```javascript
const img = new Image();
img.src = "/assets/claude_code_terminal.png";
img.onload = () => {
  ctx.drawImage(img, 600, 200, 300, 300);
};
```

Isso permite colocar screenshots de produto.

## 6. Renderizando Buttons / CTA

Retângulo simples:

```javascript
ctx.fillStyle = "#2C1810";
ctx.fillRect(80, 320, 220, 60);
ctx.fillStyle = "#FAF8F4";
ctx.fillText("Copia e Cola", 110, 360);
```

Seu agente decide:
- button text
- position
- style

## 7. Exportando a Imagem

Uma vez que o canvas está renderizado:

```javascript
const png = canvas.toDataURL("image/png");
```

Download:

```javascript
const link = document.createElement("a");
link.download = "ad.png";
link.href = png;
link.click();
```

Pronto — imagem de ad gerada.

## 8. Formatos para Diferentes Plataformas

Seu agente deve gerar tamanhos diferentes.

Exemplos:

Instagram Post: 1080 x 1080
Instagram Story: 1080 x 1920
Instagram Feed (4:5): 1080 x 1350
YouTube Thumbnail: 1280 x 720

O JSON poderia especificar:

```json
{
  "width": 1080,
  "height": 1080
}
```

O canvas redimensiona de acordo.

## 9. O Que Sua Custom Skill Faz

Sua Ad Creative Designer skill gera o layout spec.

Input:
- Product
- Audience
- Platform
- Style

Output:
- layout JSON

É aqui que a criatividade da IA acontece.

## 10. Folder Structure

Estrutura limpa pro projeto:

```
image-agent/
  agents/
    image_ads_agent.md
  skills/
    ad-creative-designer/
  frontend/
    components/
      CanvasRenderer.tsx
    pages/
      generator.tsx
  outputs/
    ads/
```

## 11. Exemplo de Workflow

Input do usuário:
- Product: Kit Definitivo N8N
- Platform: Instagram
- Style: Editorial Terroso

Agente gera layout:
- headline
- screenshot de produto
- CTA
- background

Frontend renderiza:
- ad_instagram.png

## 12. Por Que Essa Abordagem É Ótima Pro Seu Projeto

Esse método é perfeito porque:

✔ Sem APIs pagas
✔ Sem GPU necessária
✔ Totalmente explicável em tutorial
✔ Resultados determinísticos
✔ Fácil de customizar

E ainda parece design gerado por IA.

## 13. Um Truque Que Torna Isso Muito Melhor

Ao invés de deixar a IA posicionar coisas aleatoriamente, defina layout templates.

Exemplo:
- template: product_left
- template: product_right
- template: centered_minimal

O agente escolhe o template.

Isso previne layouts feios.

---

## Ad Creative Designer — Modificação

Atualize a skill existente ad-creative-designer para estender suas capacidades.

Não remova ou reescreva a lógica existente de geração de JSON layout. O design JSON ainda deve ser produzido exatamente como definido na skill.

Adicione o seguinte step adicional após o output JSON.

### Step 7: HTML Ad Rendering

Após gerar o design JSON, converta o layout num HTML advertisement renderizado.

Gere os seguintes arquivos:
- ad.html
- styles.css

O HTML deve representar o layout definido no JSON.

Requisitos:
- Canvas rendering não é mais o método de output primário
- O HTML layout deve corresponder ao layout type selecionado (product_focus, split, lifestyle)
- O design deve renderizar a 1080x1080 para formato Instagram square
- Tipografia deve priorizar claramente headline > subtext > CTA
- O CTA deve ser visualmente distinto (button style)

Exemplo de estrutura HTML:

```html
<div class="ad-container">
  <div class="headline">Para de Construir do Zero</div>
  <div class="subtext">88 templates testados em produção por R$47</div>
  <img class="product" src="claude_code_terminal.png" />
  <button class="cta">Copia e Cola</button>
</div>
```

CSS deve enforçar:
- width: 1080px
- height: 1080px
- espaçamento balanceado
- layout de marketing moderno e limpo

### Step 8: Playwright Screenshot Rendering

Após gerar o HTML layout, renderize usando Playwright.

Processo:
1. Lance Chromium usando Playwright
2. Set viewport para 1080x1080
3. Carregue o ad.html gerado
4. Aguarde imagens renderizarem
5. Capture um screenshot
6. Salve a imagem como instagram_ad.png

O screenshot deve capturar o frame completo do ad 1080x1080.

### Step 9: Output Storage Rules

Todos os arquivos gerados devem seguir as regras de output do projeto.

Crie uma nova pasta de task usando:
outputs/TASKNAME_DATE/

Dentro da pasta de task crie:
outputs/TASKNAME_DATE/ads/

Salve os arquivos aqui:
- ad.html
- styles.css
- instagram_ad.png

Não coloque nenhum arquivo gerado fora do diretório outputs.

### Outputs Resultantes

A skill agora produz três deliverables:

1. Design JSON (comportamento existente)
2. HTML ad layout
3. Imagem final renderizada para Instagram via Playwright screenshot

---

# Marketing Research Agent

O Research Agent recebe um nicho de negócio ou tópico como input e gera inteligência de marketing estruturada que o resto do pipeline pode consumir.

Ele usa Tavily web research para analisar tendências de mercado, mensagem de concorrentes e interesses comuns da audiência. Ao invés de retornar uma simples lista de ideias, o agente organiza a pesquisa em campos estruturados como:

- content topics
- marketing angles
- keywords
- video concepts
- ad hooks

A parte importante é que o output é dados estruturados machine-readable, não apenas texto. Isso significa que agentes downstream — como o gerador de vídeo, agente de visual ads e copywriter — podem consumir diretamente esta pesquisa como input.

Então no pipeline, o Research Agent atua como a camada estratégica, produzindo os insights de campanha que alimentam todos os creative assets gerados depois.

---

# Copywriter Agent

## Copywriter Agent — Regras Operacionais

### Regra 1 — Sempre Referenciar Knowledge Files

Antes de gerar qualquer copy, o agente deve revisar arquivos relevantes dentro da pasta knowledge/.

Estes arquivos definem:
- brand voice
- tom
- product messaging
- brand guidelines

Arquivos típicos podem incluir:
- knowledge/brand_identity.md
- knowledge/product_campaign.md
- knowledge/platform_guidelines.md

O agente deve alinhar todo copy gerado com:
- brand voice
- product positioning
- estilo de CTA
- prioridades de mensagem

Se houver conflito entre copy genérico e brand guidelines, brand guidelines têm prioridade.

### Regra 2 — Referenciar Research Outputs Quando Disponíveis

Se o prompt especificar um research output ou campaign run, o agente deve referenciar arquivos relevantes na pasta outputs/.

Exemplo de estrutura:

```
outputs/
  campaign_deploy_club/
    research/
      research_output.json
```

O agente deve extrair do research output:
- content_topics
- content_angles
- keywords
- ad_hooks
- video_ideas

Estes devem influenciar:
- hooks de mensagem
- copy por plataforma
- hashtags
- YouTube tags

Isso garante que o copy esteja alinhado com a estratégia de campanha produzida anteriormente.

### Regra 3 — Consistência de Campanha

Todo copy gerado deve usar um único ângulo de campanha selecionado do research output.

Exemplo:
Ângulo de Campanha: Para de Construir do Zero

Esse ângulo deve permanecer consistente em:
- Post do Threads
- Caption do Instagram
- Título do YouTube

### Regra 4 — Adaptação por Plataforma

Cada plataforma deve seguir seu estilo nativo.

| Plataforma | Estilo |
|------------|--------|
| Threads | curto, conversacional, provocativo |
| Instagram | editorial + CTA desafiador |
| YouTube | SEO optimized, didático |

Nunca gere copy idêntico entre plataformas.

### Regra 5 — Seguir Platform Formatting Guidelines

Referencie knowledge/platform_guidelines.md.

Exemplo de constraints:

**Instagram:**
- máximo 2 emojis
- 3–5 hashtags
- CTA claro e desafiador

**Threads:**
- short form
- 1–2 parágrafos curtos
- tom provocativo

**YouTube:**
- título otimizado para busca
- description inclui keywords
- lista de tags incluída

### Regra 6 — Output Deve Ser Estruturado

Retorne resultados como output estruturado para que outros agentes possam consumir.

Exemplo de formato:

```json
{
  "threads_post": "...",
  "instagram_caption": "...",
  "youtube": {
    "title": "...",
    "description": "...",
    "tags": []
  }
}
```

### Regra 7 — Localização do Output File

Todos os outputs devem ser salvos seguindo a estrutura do pipeline:

```
outputs/{task_name}_{date}/copy/
```

Exemplo:

```
outputs/deploy_club_campaign_2026-03-31/copy/
```

Arquivos:
- threads_post.txt
- instagram_caption.txt
- youtube_metadata.json

### Por Que Essas Regras Importam

Essas regras garantem:

✔ alinhamento com a marca
✔ consistência de campanha
✔ integração com agentes anteriores
✔ outputs previsíveis

Também faz o agente se comportar como um membro real de time de marketing, não um gerador de texto genérico.

---

# Distribution Agent

## Distribution Agent — Key Details

### Propósito

Lida com hosting de mídia (Supabase), readiness de publicação e advisory de agendamento de posts. Referencia outputs do Research Agent e Copywriting Agent para construir metadata e recomendações de agendamento. Publica somente quando o usuário referenciar explicitamente o MD file gerado.

### Responsabilidades

**1. Supabase Media Hosting**
- Faz upload de todos os outputs de `outputs/<task_name>/<date>/` para Supabase (bucket campaign-uploads)
- Gera public URLs para Instagram (imagens/vídeos)
- Garante que filenames sejam únicos por task

**2. Publishing Layer**
- Prepara metadata para Instagram (caption, hashtags, CTA) e YouTube (title, description, tags)
- Executa posting somente quando o usuário referenciar explicitamente o Publish MD file
- Pode mockar YouTube posting se OAuth não estiver configurado

**3. Post Scheduling Advisory**
- Gera um MD file por task:
  - `Publish <task_name> <YYYY-MM-DD>.md`
  - Inclui media URLs, horários recomendados de postagem, resumo de metadata e notas
- Usa knowledge files (`brand_identity.md`, `platform_guidelines.md`) e Research outputs para guidance de agendamento

**4. Pipeline Awareness**
- Referencia agentes upstream para outputs estruturados:
  - Research Agent → tendências, tópicos, keywords
  - Copywriting Agent → captions, títulos, tags
- Conhece a estrutura de pasta de output para localizar mídia e metadata mais recentes

### Input Requirements

| Input | Exemplo / Fonte |
|-------|----------------|
| Task Name | deploy_club_campaign |
| Task Date | 2026-03-31 |
| Media Files | `outputs/deploy_club_campaign_2026-03-31/video1.mp4, ad1.png` |
| Research JSON | `outputs/deploy_club_campaign_2026-03-31/research.json` |
| Copywriting JSON | `outputs/deploy_club_campaign_2026-03-31/copy.json` |
| Publish Command | Usuário cita `Publish deploy_club_campaign 2026-03-31.md` |

### Output

- **MD File:** `Publish <task_name> <date>.md`
  - Media file URLs (Supabase)
  - Horários sugeridos de postagem por plataforma
  - Resumo de metadata (captions, hashtags, títulos, descriptions)
  - Notas de conclusão de task e conselhos de agendamento
- **Regra de Execução:** Publicação acontece somente quando o usuário confirmar explicitamente usando este MD file.

### Rules / Constraints

1. Deve referenciar knowledge files e research outputs relevantes antes de gerar agendamentos ou metadata
2. Toda mídia deve ser uploaded para Supabase com public URLs válidas
3. Sem posting sem aprovação explícita do usuário
4. Manter estrutura de pasta de output consistente: `outputs/<task_name>/<date>/`
5. Suporta imagens e vídeos; múltiplos arquivos por task permitidos

### Extensões Opcionais

- Integração com BullMQ + Redis para queueing automatizado e execução agendada
- Direct API posting para YouTube com OAuth
- Expansão multi-plataforma (Threads, TikTok, LinkedIn)

---

# Orchestrator Agent

Você é o orchestrator de pipeline de IA usando BullMQ + Redis. Tasks (Jobs) são enqueued e executadas assincronamente. Cada Job Payload representa uma task de campanha, contendo:

- task_name
- task_date
- source_folder (opcional, para pular research)
- user_flags (skip_research, skip_image, skip_video)
- platform_targets (Instagram, YouTube)

Instruções:

1. Receba um Job Payload da Orchestrator Skill.
2. Cheque dependências para cada agente no pipeline:
   - Research Agent → deve rodar primeiro a menos que skip_research seja true.
   - Se pulado, confirme que o usuário fez upload da source folder dentro de `assets/<task_name>/`.
   - Se faltando, retorne uma nota: "Task não pode prosseguir até a source folder ser uploaded."
   - Ad Creative Designer → roda após research ou após confirmação de skip.
   - Video Ad Specialist → roda após research ou após confirmação de skip.
   - Copywriter Agent → roda após research ou confirmação de skip.
   - Distribution Agent → roda por último, após todos os outputs estarem prontos.
3. Enqueue jobs no BullMQ com dependências apropriadas.
4. Rastreie status de conclusão para cada job.
5. Suporte skips opcionais para criação de imagem/vídeo (ad designer ou video specialist). Se pulado, marque job como complete sem executar.
6. Gere logs e summaries para o Orchestrator agent reportar.
7. Notifique quando o pipeline completar com sucesso ou se erros ocorrerem.

Exemplo de output por job:

```json
{
  "job_name": "video_ad_specialist",
  "status": "queued/running/complete/failed",
  "dependencies": ["research_agent"],
  "notes": "Pulado por flag do usuário"
}
```

## Orchestrator Skill — Key Details

### Propósito

Recebe um Job Payload e roda o pipeline de conteúdo com IA como um único workflow coordenado. Gerencia dependências entre agentes, skips opcionais e validação de assets uploaded. Rastreia status de jobs e garante que outputs estejam prontos para o Distribution Agent.

### Responsabilidades

**1. Job Payload Intake**
- Recebe todos os parâmetros de task:
  - task_name, task_date
  - source_folder (para verificação de skip de research)
  - User flags: skip_research, skip_image, skip_video
  - platform_targets (Instagram, YouTube)
- Valida estrutura do payload

**2. Pipeline Execution**
- Ordem padrão do pipeline:
  - Research Agent → gera insights de marketing estruturados
  - Ad Creative Designer → gera layouts de ad estáticos (JSON)
  - Video Ad Specialist → gera vídeos usando Remotion + custom skill
  - Copywriter Agent → gera captions, títulos, tags
  - Distribution Agent → faz upload de outputs, gera Publish MD, aconselha agendamento
- Skips opcionais:
  - skip_research → verificar se `assets/<task_name>` existe; se não, bloquear pipeline
  - skip_image ou skip_video → job marcado como complete, sem geração

**3. Dependency Management**
- Garante que cada agente execute somente após outputs upstream existirem (ou skip confirmado)
- Usa BullMQ + Redis para enqueue jobs e rastrear conclusão
- Suporta execução paralela para tasks independentes (ex: jobs de vídeo e imagem podem rodar simultaneamente após research)

**4. Job Tracking**
- A execução de cada agente é tratada como um Job
- Estados do job: queued, running, complete, failed
- Logs gerados para cada job para ajudar debug ou mostrar progresso do pipeline

**5. User Control**
- Pipeline não publica conteúdo automaticamente
- Publicação ocorre somente via Distribution Agent quando usuário referenciar o Publish MD file

### Input Requirements

| Input | Exemplo / Notas |
|-------|----------------|
| Job Payload | JSON contendo task_name, task_date, source_folder, skip flags, platform_targets |
| Assets Folder | `assets/<task_name>/` (obrigatório se pulando research) |
| Knowledge Files | brand_identity.md, platform_guidelines.md, product_campaign.md |
| Research Output | Opcional, usado se research pulado |
| Copywriting Output | Opcional, usado pelo Distribution Agent |

### Outputs

- Job logs por agente (status, notas)
- Report final de conclusão do pipeline
- Publish MD files distribution-ready em `outputs/<task_name>/<date>/`
- Warnings opcionais se skips não puderem ser validados (source folder faltando)

### Rules / Constraints

1. Pipeline deve respeitar dependências entre agentes
2. Research não pode ser pulado sem source folder validada
3. Jobs de imagem e vídeo podem ser pulados a critério do usuário
4. Todos os outputs devem seguir a convenção de pasta `outputs/<task_name>/<date>/`
5. Publicação é manual: só triggered via Distribution Agent com referência ao MD file

### Features Opcionais de Level-Up

- Adicionar agendamento time-based usando BullMQ delayed jobs
- Lógica de retry para jobs falhos automaticamente
- Adicionar posting multi-plataforma (Threads, TikTok, LinkedIn) quando APIs estiverem disponíveis

Dessa forma, agora você pode rodar o pipeline completo a partir de um único Job Payload:

1. Usuário submete um JSON payload → Orchestrator Skill triggera
2. Jobs são enqueued no BullMQ + Redis → rodam de acordo com dependências
3. Todos os agentes executam automaticamente ou pulam por flags
4. Distribution Agent está pronto pra publicar quando o usuário confirmar
