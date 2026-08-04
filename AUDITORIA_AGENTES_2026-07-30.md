# Auditoria dos agentes — contexto perdido / desatualizado

Data: 2026-07-30. Metodo: 9 auditores em paralelo; cada um leu o documento e CONFERIU as afirmacoes no codigo real (interface/, scripts/, pipeline/, src/, knowledge/).

**Placar:** 9 documentos · **24 achados ALTA** · 37 media · 22 baixa

---

## STATUS: CORRIGIDO (2026-07-30, mesma data)

**Todos os 83 achados foram aplicados.** Resumo do que mudou:

| Documento | O que foi feito |
|---|---|
| `knowledge/brand_identity.md` | v1.2: frase-tag deixou de ser assinatura (regra dura); novas secoes **Pilares de Conteudo** e **4Selet na Midia**; foto de banco (Pexels) permitida com tratamento; branco puro escopado (texto sim, fundo nao); neutros de interface como excecao; emojis reduzidos a `→ ▸ •`; `#TaxaZero` condicional ao pilar; logo/simbolo corrigidos; Quick Map por tipo de conteudo |
| `knowledge/platform_guidelines.md` | v1.2: feed = **4:5** (o 1:1 e a peca de anuncio); nova secao **2.6 — 4Selet na Midia**; matriz completa de formatos (4:5 · 1:1 · 9:16 · 16:9); margem segura 88–104px; CTA condicional; hashtags por pilar; coluna "onde se produz" e escopo do YouTube |
| `knowledge/product_campaign.md` *(nao estava entre os 9 — mesmo defeito)* | Tirada a instrucao de assinar peca com a frase-tag; headline de exemplo limpa; grafia "Ver as condicoes" |
| `skills/ad-creative-designer/SKILL.md` | v2.0: contrato real (`ads/concept.json` → `ads/ad.html` CSS inline → `ads/ad.png` @2x); schema plano; 4 templates reais; roteamento para `media_mention`; pilares; regras duras de HTML (`html,body` com dimensoes, `.card`, `<span class="cta">`); renderer da raiz com `scale`/`RENDER_STRICT_NET`; foto/logo/marca d'agua; 9 CTAs |
| `skills/video-ad-specialist/SKILL.md` | v2.0: arquivo canonico `video/concept.json` (schema plano; `scenes.json` e saida derivada); so 9:16 renderizavel; duracao real (n × 2,6s + 0,4s); tipos de cena reduzidos aos com eyebrow; traducao `subtitle` → `visual`; bug do card final registrado |
| `skills/copywriter-agent/SKILL.md` | v2.0: dois caminhos (painel = 1 arquivo por peca + gate 422 · manual = pacote); carrossel e **4Selet na Midia** documentados; pilares; CTA condicional; 8 emojis banidos como erro; YouTube rebaixado a legado |
| `skills/distribution-agent/SKILL.md` | v2.0: gate real do painel (approved + hashes em runtime + confirmacao + dryRun + IG conectado + nao publicada + trava em voo); link temporario `/m/:token` no lugar do Supabase; token em Configuracoes (nao `IG_ACCESS_TOKEN`); carrossel incluido, video/Stories/YouTube declarados nao publicaveis; agendamento executavel e anti-duplicidade; nomes de arquivo reais |
| `skills/orchestrator/SKILL.md` | v2.0: eixo `content_types` (job = id do tipo); `platforms` (nao `platform_targets`); `dry_run` sem efeito; `skip_research` nao bloqueia; estados reais (`done`/`skipped`/`blocked`/`error`), chave `job`, sem `logs/`; `preview_generator` na tabela; painel como caminho principal; aviso de que `media_mention` nao entra por default |
| `skills/task-promoter/SKILL.md` | v2.0: 6o arco `approved → draft` (edit_revert); efeitos colaterais do script (rework apaga marca de publicacao); 4 zonas incluindo `_archived/`; "arquivar" virou pergunta; painel como caminho principal; `current == target` e erro, nao no-op; `outputs/INDEX.md` removido |
| `skills/marketing-research-agent/SKILL.md` | v2.0: chave Tavily **esta** configurada (busca real e o padrao); duas casas da chave; tres caminhos separados (skill 5 buscas · painel 3 buscas sem arquivo · pipeline advisory sem Tavily); frase-tag proibida nos campos que descem para as pecas; mapeamento tipo/pilar |
| Fixtures (`skills/ad-creative-designer/examples/`) | Convertidos ao contrato atual (`concept.json` + `ad.html` inline + `ad.png` @2x + sidecars, **renderizado e conferido**); o antigo foi para `_legacy/` com README explicando por que saiu; tagline removida de `research_results.json`, `copy/copy.json` e `video/scenes.json` |
| `CLAUDE.md`, `STATUS_PROJETO.md`, `GUIA_DE_USO.md`, `README.md` | Tipos/pilares/"4Selet na Midia"/Pexels documentados; arvore de output corrigida; gate de publicacao real; status das chaves corrigido (IA e Tavily **configuradas**); YouTube declarado nao implementado |

**Validacao:** geracao REAL pelo caminho de prompt do painel (`systemPrompt` + `generationPrompt` + `ai.complete`, Claude Sonnet 4.6) em dois casos — peca educacional e peca "4Selet na Midia". Resultado: nenhuma assinou com a frase-tag, nenhuma forcou `#TaxaZero` fora do pilar, a peca de Midia trouxe `#NaMidia` sem inventar conteudo da materia, e o `runBrandGovernance` retornou **0 erros e 0 avisos** nos dois. O fixture do ad foi re-renderizado com o Playwright e conferido visualmente.

---

| Documento | Saude | Alta | Media | Baixa |
|---|---|---|---|---|
| C:\Users\Administrator\Documents\Agentes_Marketing_4Selet\Claude Equipe de Marketing - 6 Agentes\skills\video-ad-specialist\SKILL.md | desatualizado_grave | 3 | 5 | 3 |
| orchestrator/SKILL.md | desatualizado_grave | 4 | 4 | 2 |
| copywriter-agent/SKILL.md | desatualizado_grave | 3 | 4 | 2 |
| distribution-agent/SKILL.md | desatualizado_grave | 3 | 4 | 3 |
| ad-creative-designer/SKILL.md | desatualizado_grave | 4 | 5 | 4 |
| task-promoter/SKILL.md | desatualizado_grave | 2 | 4 | 2 |
| knowledge/platform_guidelines.md | desatualizado_grave | 2 | 4 | 1 |
| knowledge/brand_identity.md | desatualizado_grave | 2 | 4 | 4 |
| marketing-research-agent/SKILL.md | desatualizado_leve | 1 | 3 | 1 |

---

## C:\Users\Administrator\Documents\Agentes_Marketing_4Selet\Claude Equipe de Marketing - 6 Agentes\skills\video-ad-specialist\SKILL.md

**Saude:** desatualizado_grave

O documento perdeu o contrato real: manda salvar o JSON no arquivo errado (video/scenes.json com envelope composition/props) quando o painel e o pipeline leem video/concept.json com schema plano, e ainda descreve como "desenhados na tela" campos (props.concept, props.cta) que o src/BrandStory.tsx sequer usa. A parte de marca tambem envelheceu: o exemplo canonico assina a peca com a frase-tag hoje proibida, e as promessas de formato por plataforma, duracao por beat e fundo por cena nao existem no renderer.

### 1. [ALTA]

- **Documento diz:** Step 4 / Checklist: "Salve o output seguindo a convencao do pipeline: outputs/<task_name>_<date>/video/scenes.json" com envelope obrigatorio {"composition": "BrandStory", "props": {...}} (SKILL.md linhas 150, 199-205, 262).
- **Realidade:** O arquivo de entrada do video no painel e no pipeline e video/concept.json, com schema PLANO (sem envelope composition/props): interface/lib/config.js (tipo video_idea, `file: "video/concept.json"`), interface/lib/prompts.js SCHEMAS.video_idea = { concept, hook, emotional_arc, visual_style, scenes[], cta, notes }, e interface/lib/render.js:2128 (`readJson(path.join(loc.path, "video", "concept.json"))`). O video/scenes.json e arquivo de SAIDA: render.js:2145-2146 escreve/sobrescreve ele com os props ja adaptados. pipeline/agents.js grava via content.writeContentFile(folder, ct.file) e chama render.render(folder, ct.kind) — nunca le scenes.json.
- **Impacto:** Um JSON gerado exatamente como a skill manda e ignorado pelo painel e pelo pipeline (que leem concept.json) e ainda e apagado pelo render, que reescreve scenes.json. Alem disso o envelope {composition, props} nao funciona como --props= do Remotion (o componente receberia {composition, props} e cairia no fallback de 1 cena). A skill tambem nunca nomeia o tipo de conteudo real do painel ("Video (short-form)" / video_idea), que hoje e o caminho principal de operacao.
- **Correcao:** Reescrever o Step 4: arquivo canonico = outputs/<task>_<date>/video/concept.json, schema plano { concept, hook, emotional_arc, visual_style, scenes[], cta, notes } (espelhar prompts.js SCHEMAS.video_idea). Explicar que video/scenes.json e derivado (gerado por render.js como props do Remotion) e nao deve ser escrito pela skill. Citar o tipo video_idea do painel e o caminho painel/pipeline -> render.render(folder, "video").

### 2. [ALTA]

- **Documento diz:** "O que o renderer BrandStory realmente consome (campos efetivamente desenhados na tela): concept — tese/conceito do video; cta — CTA final aprovado; scenes[]..." e no checklist "props.concept e props.cta preenchidos" (SKILL.md linhas 139-142, 150, 256).
- **Realidade:** src/BrandStory.tsx:93 desestrutura apenas `scenes` (`export const BrandStory: React.FC<BrandStoryProps> = ({ scenes }) => {`). `concept` e `cta` existem no type BrandStoryProps mas nunca sao usados no JSX — nada deles vai para a tela. No lugar do CTA, o card final estampa texto fixo: src/BrandStory.tsx:85 renderiza a string hardcoded "Para quem sabe que e Selet." dentro do botao.
- **Impacto:** Quem segue a skill acredita que o CTA aprovado que escreveu aparece no video final; ele nao aparece em lugar nenhum. O video sempre fecha com a frase-tag fixa, independentemente do JSON. A skill promete um contrato que o renderer nao cumpre.
- **Correcao:** Corrigir a lista: os unicos campos desenhados sao scenes[].type (eyebrow), scenes[].text (headline) e o subtexto. Declarar concept e cta como METADADOS (uteis para a peca/legenda, nao para a tela) — ou registrar como bug aberto em src/BrandStory.tsx que props.cta deveria substituir o texto fixo do card final.

### 3. [ALTA]

- **Documento diz:** O exemplo canonico de JSON usa a tagline como subtexto da cena de CTA: `"subtitle": "Para quem sabe que e Selet."` (SKILL.md linha 189). A secao Brand Guardrails (linhas 209-217) nao menciona nenhuma restricao a frase-tag.
- **Realidade:** A regra dura vigente esta em interface/lib/prompts.js:16 (bloco GOVERNANCE): "NUNCA use a frase-tag 'Para quem sabe que e Selet.' como rodape, fecho ou assinatura automatica de peca (headline, body de slide, legenda ou cena de video)". O pipeline aplica esse GOVERNANCE como gate (pipeline/agents.js:156-160 bloqueia a peca com gov.errors). O renderer ainda desobedece por conta propria: src/BrandStory.tsx:85 e :96 e src/Root.tsx:14 carimbam a frase.
- **Impacto:** O exemplo que a skill manda copiar viola diretamente a regra dura de marca e pode ser bloqueado pelo gate de governanca do pipeline; e a skill nao avisa que o BrandStory estampa a frase sozinho no card final, entao mesmo um JSON limpo sai com a tagline no video.
- **Correcao:** Trocar o subtitle da cena cta no exemplo (ex.: "Acesso por convite.") e incluir nos Brand Guardrails a regra: a frase-tag nao entra como fecho/assinatura em pecas novas, so se o brief pedir explicitamente. Registrar tambem que src/BrandStory.tsx:85 precisa deixar de hardcodar a frase (usar props.cta).

### 4. [MEDIA]

- **Documento diz:** "`subtitle` — subtexto on-screen. E o que o BrandStory desenha abaixo da headline" e "`visual` e direcao de arte ... nunca aparece como texto na tela" (SKILL.md linhas 128, 130, 148), com a renderizacao descrita como possivel "via painel interface/lib/render.js ou CLI Remotion" (linha 271).
- **Realidade:** O tipo real da cena nao tem subtitle: src/BrandStory.tsx:8 `export type BrandScene = { type: string; text: string; visual?: string };` e as linhas 58-70 desenham exatamente `{scene.visual}` como segunda linha na tela. Quem faz a traducao e o adaptador do painel: interface/lib/render.js:2141 `scenes.map((s) => ({ type: ..., text: ..., visual: s.subtitle || "" }))`.
- **Impacto:** A afirmacao so vale pelo caminho do painel. Renderizando pelo CLI/Studio com o proprio exemplo da skill como props, a DIRECAO DE ARTE ("Background Selet Darker (#07212B) com Selet Dots 8% opacity...") vai impressa na tela e o subtitle e descartado — exatamente o desastre que o documento diz estar prevenido.
- **Correcao:** Explicitar a traducao: no contrato do autor o campo e `subtitle`; o adaptador em interface/lib/render.js:2141 o entrega ao prop `visual` do BrandStory. Avisar que o BrandStory cru desenha `visual`, entao props montados a mao para o CLI devem colocar o subtexto em `visual` (ou o componente deve passar a aceitar `subtitle`).

### 5. [MEDIA]

- **Documento diz:** Step 2 promete composition size por plataforma: 1080x1350 (instagram_feed), 1920x1080 (youtube), 1080x1920 (reels/shorts), e o checklist exige "platform valido e composition size correto para a plataforma" (SKILL.md linhas 103-108, 257).
- **Realidade:** src/Root.tsx:37-50 registra a Composition BrandStory fixa em width=1080 / height=1920, e o calculateMetadata devolve apenas durationInFrames. interface/lib/render.js:2157-2159 chama o CLI sem qualquer flag de dimensao (`[cliJs, "render", "src/index.ts", "BrandStory", outMp4, "--props="+propsPath, "--log=error"]`). O painel descreve o tipo como 9:16 apenas (interface/lib/config.js, video_idea: "Reels/short vertical (9:16)").
- **Impacto:** Todo video sai 1080x1920, mesmo quando a skill declarou platform instagram_feed ou youtube. O checklist pede conferir algo que o JSON nao controla, e a peca prometida em 4:5 ou 16:9 nunca existe.
- **Correcao:** Marcar `platform` como metadado de estrategia e registrar que hoje o unico formato renderizavel e 9:16 (1080x1920). Se 4:5/16:9 for necessario, e trabalho de codigo em src/Root.tsx (width/height via calculateMetadata) — declarar como nao suportado ate la.

### 6. [MEDIA]

- **Documento diz:** "Cada beat do BrandStory ocupa ~3s (90 frames @ 30fps); calibre o no de scenes para a faixa de duracao" e o exemplo com 4 cenas declara `"duration": 18` (SKILL.md linhas 159, 205); as faixas alvo sao 15-30s.
- **Realidade:** src/BrandStory.tsx:105 encadeia as cenas com sobreposicao (`from={i * (PER_SCENE - FADE)}`) e src/BrandStory.tsx:114-115 define `brandStoryDuration = n * (90 - 12) + 12`. Ou seja, cada cena avanca 78 frames (2,6s), nao 90. Quatro cenas = 324 frames = 10,8s. Nenhum codigo le `props.duration` (render.js:2138-2142 monta os props so com concept, cta, scenes).
- **Impacto:** Seguindo a regra do documento, um Reels planejado para 18s sai com 10,8s — abaixo da faixa que a propria skill define para a plataforma. E `props.duration` passa a falsa impressao de controlar o tamanho do video.
- **Correcao:** Corrigir a matematica: duracao = n_cenas x 2,6s + 0,4s (78 frames uteis por cena, crossfade de 12). Para 15-20s use 6-8 cenas. Deixar claro que `props.duration` e apenas metadado descritivo, nao entra no render.

### 7. [MEDIA]

- **Documento diz:** "Scene types suportados: hook, problem, product, benefit, proof, offer, testimonial, cta" e "type ... (vira o eyebrow da cena)", com destaque para `proof` como "adicao 4Selet-specific" (SKILL.md linhas 116, 118, 144).
- **Realidade:** src/BrandStory.tsx:18-27 (eyebrowFor) mapeia apenas hook, problem, product, benefit e cta; qualquer outro valor cai no `default: return "4SELET"`. Logo proof, offer e testimonial nao tem rotulo proprio. O schema que o painel pede a IA e ainda mais estreito: interface/lib/prompts.js:66 oferece `"type": "hook|product|benefit|cta"`.
- **Impacto:** Cenas de proof, offer e testimonial saem rotuladas com o generico "4SELET" em vez do eyebrow correspondente, e o tipo `problem` — suportado no render — nem e oferecido no schema do painel. A promessa de 8 tipos nao se sustenta na tela.
- **Correcao:** Reduzir a lista aos tipos com eyebrow real (hook, problem, product, benefit, cta) e marcar proof/offer/testimonial como nao suportados hoje pelo renderer (caem em "4SELET") — ou pedir a extensao de eyebrowFor em src/BrandStory.tsx antes de recomenda-los.

### 8. [MEDIA]

- **Documento diz:** "Defaults quando faltar input: product = Campanha Taxa Zero..." e todo o eixo tematico da skill gira em torno da Taxa Zero; nenhuma mencao a pilares de conteudo (SKILL.md linha 80 e Steps 1-2).
- **Realidade:** O painel organiza toda peca por PILAR: interface/lib/config.js CONTENT_PILLARS (taxa_zero, educacional, curiosidade_mercado, prova_plataforma, novidade, motivacional) e interface/lib/prompts.js:106-110 injeta o pilar no prompt com a instrucao explicita "Mantenha a variedade real do feed 4Selet: NEM toda peca e sobre Taxa Zero. Respeite o pilar acima como eixo tematico, ainda que a campanha ativa exista."
- **Impacto:** A skill empurra Taxa Zero como default em todo video, contradizendo a regra de variedade tematica que o painel aplica hoje. Videos gerados pela skill ficam monotematicos e fora do padrao do feed.
- **Correcao:** Adicionar `pillar` aos Inputs (com os 6 ids de CONTENT_PILLARS), tirar Taxa Zero de default incondicional e replicar a regra de variedade: o pilar define o tema, a campanha ativa nao sobrepoe o pilar.

### 9. [BAIXA]

- **Documento diz:** "Mapeie scene -> background da paleta (ver Step 5): hook/problem em Selet Darker, product/benefit/proof em Selet Darker ou Navy, offer/cta em Selet Navy" (SKILL.md linha 133).
- **Realidade:** src/BrandStory.tsx:98-101 aplica UM unico fundo global para o video inteiro (`radial-gradient(125% 125% at 50% 28%, blue 0%, navy 42%, darker 100%)`) e src/components.tsx:11-53 (SceneWrapper) nao aceita nenhuma prop de cor/fundo. Nao ha campo de background por cena em lugar nenhum do schema. Alem disso, a referencia "(ver Step 5)" aponta para uma secao inexistente — o documento so tem Steps 1 a 4.
- **Impacto:** Instrucao inexecutavel: nenhuma escolha de fundo por cena chega ao render, e o leitor procura um Step 5 que nao existe.
- **Correcao:** Remover a tabela de mapeamento por cena (ou marcar como direcao de arte para futuras compositions) e corrigir o cross-reference quebrado para a secao Brand Guardrails.

### 10. [BAIXA]

- **Documento diz:** Brand Guardrails: "Sem branco puro, sem preto puro" e o checklist final "sem branco/preto puro" (SKILL.md linhas 211, 261).
- **Realidade:** src/BrandStory.tsx:54 usa `color: "#FFFFFF"` na headline de toda cena e :79 usa `color: "#FFFFFF"` no texto do card de CTA.
- **Impacto:** O item do checklist nao e verificavel a partir do JSON: mesmo um scene JSON impecavel produz um video com branco puro na tipografia principal. Quem audita a peca pelo checklist da a peca como aprovada indevidamente.
- **Correcao:** Anotar a limitacao no documento (o branco puro vem do componente, nao do JSON) e abrir a correcao em src/BrandStory.tsx para usar COLORS.cloud (#D9DCD6) no lugar de #FFFFFF.

### 11. [BAIXA]

- **Documento diz:** "CTAs aprovados: 'Solicitar convite', 'Ver condicoes', 'Falar com o time', 'Conhecer a plataforma', 'Migrar minha operacao', 'Calcular minha economia'" (SKILL.md linha 213).
- **Realidade:** A lista canonica tem 7 itens e a redacao e outra: knowledge/brand_identity.md:304 traz "Ver as condicoes" e :311 traz "Ver como funciona"; interface/lib/prompts.js:15 repete os 7 (Solicitar convite, Ver as condicoes, Conhecer a plataforma, Migrar minha operacao, Calcular minha economia, Falar com o time, Ver como funciona).
- **Impacto:** Divergencia pequena de redacao e um CTA aprovado a menos no repertorio da skill; nada quebra, mas a skill deixa de usar "Ver como funciona" e escreve o CTA com texto diferente do oficial.
- **Correcao:** Sincronizar a lista com interface/lib/prompts.js:15 / knowledge/brand_identity.md: incluir "Ver como funciona" e corrigir para "Ver as condicoes".


## orchestrator/SKILL.md

**Saude:** desatualizado_grave

O documento acertou a parte que foi reconciliada na epoca (modos sequencial/BullMQ, pasta canonica, schema do status.json, flags reais do executavel), mas o contrato de coordenacao em si envelheceu: os arquivos entre estagios, os nomes dos jobs, os estados, os logs e o Publish MD descrevem um pipeline que nao existe mais em disco. Pior, ele ignora inteiramente o painel web (caminho principal de operacao hoje), a publicacao real no Instagram com gate R5, o eixo `content_types` e o tipo novo '4Selet na Midia'.

### 1. [ALTA]

- **Documento diz:** Secao 'Pipeline (contrato entre estagios)' (linhas 193-201) e Step 3 (linha 130): 'research_agent -> research_results.json' ... 'ad_creative_designer -> ads/{layout.json, ad.html, styles.css, instagram_ad.png}' ... 'video_ad_specialist -> video/{scenes.json, video.mp4}' ... 'copywriter_agent -> copy/{copy.json + .txt/.json}' ... 'distribution_agent -> media_urls.json + Publish <task> <date>.md'
- **Realidade:** Nenhum desses arquivos existe no projeto. `find outputs -maxdepth 2/3` por research_results.json, media_urls.json, scenes.json e 'Publish*.md' retorna VAZIO. O que o pipeline real grava (pipeline/agents.js:121 researchAgent, :213 distributionAgent, :307 summary) e `research/insights.md`, `distribution/plan.md` e `pipeline_run.json`. Os arquivos de peca vem de interface/lib/config.js (CONTENT_TYPES): ad_creative -> `ads/concept.json`, video_idea -> `video/concept.json`, instagram_carousel -> `copy/instagram_carousel.json`, instagram_caption/media_mention -> `copy/instagram_caption.txt`. As artes reais nas tasks sao `ads/feed.png`, `ads/square.png`, `ads/story.png`, `ads/media_16x9.png` e `slides/slide_N.png` (ex.: outputs/midia_hand_tablet_valor_2026-07-29/, outputs/prova_95_aprovacao_2026-06-17/).
- **Impacto:** Quem seguir o documento vai procurar/esperar arquivos que nunca sao criados e pode concluir que o pipeline falhou, ou escrever integracoes lendo caminhos inexistentes. E o coracao do documento (o contrato entre estagios) apontando para um layout de saida morto.
- **Correcao:** Reescrever a secao 'Pipeline (contrato entre estagios)' e o Step 3 com o contrato real: research -> research/insights.md; cada peca gerada em `ct.file` conforme interface/lib/config.js (ads/concept.json, video/concept.json, copy/*.txt|json); artes renderizadas em ads/*.png e slides/slide_N.png; distribution -> distribution/plan.md; resumo da run em pipeline_run.json. Remover research_results.json, layout.json, styles.css, instagram_ad.png, scenes.json e media_urls.json do contrato (ou marca-los como legado do caminho Claude-executa-skills, se ainda quiser mante-lo).

### 2. [ALTA]

- **Documento diz:** Frontmatter (linha 12) e Step 5 (linhas 147-148): 'NUNCA publica conteudo (a publicacao e manual via distribution-agent + Publish MD)'; 'Surface o Publish MD gerado pelo distribution-agent (outputs/<task>_<date>/Publish <task> <date>.md)'; 'Lembrete: nada foi publicado — publicacao e manual via referencia ao Publish MD'.
- **Realidade:** (a) Nenhum arquivo 'Publish *.md' existe em outputs/ (busca retornou vazio) e pipeline/agents.js:213 grava `distribution/plan.md`, nao um Publish MD. (b) A publicacao real HOJE acontece no painel web: interface/lib/publish.js publica no Instagram via Graph API atras do gate `assertApproved()` (publish.js:138-147, checa status approved + content_hashes), com agendamento em interface/lib/schedule.js e rota em interface/routes/publish.js. O 'gate' nao e mais 'usuario citar o Publish MD pelo nome'.
- **Impacto:** O passo final documentado (surfacear o Publish MD) e impossivel de cumprir, e o modelo mental de publicacao esta errado: o operador pode achar que precisa citar um arquivo que nao existe, quando na pratica a publicacao e um botao no painel protegido pelo gate de aprovacao + hashes.
- **Correcao:** Trocar o Step 5 por: reportar o resumo dos jobs, apontar `distribution/plan.md` e `pipeline_run.json`, e dizer que a peca segue para revisao no painel (in_review -> approved) e que a publicacao real no Instagram e feita pelo painel (interface/lib/publish.js) atras do gate R5 (status approved + content_hashes conferidos em runtime), com agendamento opcional. Manter a regra 'o orchestrator nunca publica', mas descrever o gate real.

### 3. [ALTA]

- **Documento diz:** Frontmatter (linhas 4-8) e Step 2/Step 3: o pipeline e descrito como 5 jobs fixos com nome de agente — `research_agent`, `ad_creative_designer`, `video_ad_specialist`, `copywriter_agent`, `distribution_agent`.
- **Realidade:** No executavel, os tres jobs criativos nao existem com esses nomes: pipeline/agents.js roda UM job por tipo de conteudo (`creativeAgent`, linha 130) e nomeia o job pelo id do tipo — `{ job: contentTypeId, ... }` (agents.js:136, :159, :184, :276). A lista default e `ALL_CONTENT_TYPES` (agents.js:23-26): instagram_caption, instagram_carousel, ad_creative, video_idea, linkedin_post, threads_post. O documento nunca menciona `content_types`, que e o eixo real da execucao (payload.content_types, agents.js:240).
- **Impacto:** O leitor rastreia status por nomes de job que nunca aparecem no `pipeline_run.json`, e nao sabe que o payload aceita `content_types` para escolher quais pecas gerar. A tabela de dependencias fica inutil para depurar uma run real.
- **Correcao:** Reescrever o Step 2 em torno dos jobs reais: research_agent -> N jobs criativos (um por content_type, nomeados pelo id do tipo) -> distribution_agent -> preview_generator. Documentar o campo `content_types` do payload e a lista default de agents.js, deixando claro que 'ad/video/copy' sao papeis conceituais, nao nomes de job.

### 4. [ALTA]

- **Documento diz:** O documento inteiro so conhece dois caminhos: 'Sequencial (padrao)' e 'Enfileirado (BullMQ + Redis)' (secao 'CRITICAL: modos de execucao'), e trata o tipo de peca como 'ad / video / copy'.
- **Realidade:** O caminho principal de operacao hoje e o PAINEL WEB (interface/), que nao aparece uma unica vez no documento. O painel garante a task chamando o mesmo `scripts/orchestrator.js` (interface/routes/generate.js:232, via interface/lib/content.js:255) e faz preview/promote pelos mesmos scripts (content.js:544, :551). Alem disso existe um tipo de conteudo NOVO que o documento ignora: `media_mention` — '4Selet na Midia' (interface/lib/config.js:180) — que nem esta em `ALL_CONTENT_TYPES` do pipeline (grep 'media_mention' em pipeline/ = vazio), ou seja, uma run default do pipeline nunca gera esse tipo.
- **Impacto:** O documento descreve um sistema paralelo ao que se usa de verdade. Quem seguir so ele nunca descobre o painel, e uma run do pipeline silenciosamente nao produz pecas '4Selet na Midia' — sem nenhum aviso no doc de que o tipo existe.
- **Correcao:** Adicionar uma secao curta 'Onde isto se encaixa': o painel (interface/) e o caminho principal; o pipeline em pipeline/ e a via em lote/CLI; os dois compartilham scripts/orchestrator.js, generate_preview.js e promote_task.js. Listar os 7 tipos de conteudo atuais de config.js, marcando que `media_mention` ainda NAO esta no default do pipeline (precisa vir explicito em `content_types`) — ou pedir a correcao no codigo.

### 5. [MEDIA]

- **Documento diz:** Payload canonico (linha 52) usa `"platform_targets": ["instagram", "youtube"]`, o Step 1.5 grava `"platforms": <payload.platform_targets>` e a nota da linha 60 diz que o executavel 'Aceita `platforms` (alias de `platform_targets`)'.
- **Realidade:** O executavel NAO le `platform_targets`: grep por 'platform_targets' em pipeline/ retorna vazio. pipeline/agents.js:239 le apenas `payload.platforms` e cai para `["instagram"]` quando ausente. So o caminho legado skills/orchestrator/scripts/orchestrate.js:47 le `payload.platform_targets`.
- **Impacto:** Um payload escrito exatamente como o exemplo do documento, passado com --file para pipeline/orchestrator.js, perde as plataformas em silencio e a task nasce com platforms=['instagram'] — sem erro nem aviso.
- **Correcao:** Inverter a redacao: no payload do pipeline executavel o campo e `platforms`; `platform_targets` so e lido pelo orchestrate.js legado (nao e alias). Atualizar o JSON de exemplo para usar `platforms` (ou mostrar os dois com a ressalva de qual script le qual).

### 6. [MEDIA]

- **Documento diz:** Regra repetida em 3 lugares (Step 2 linha 117 e 123, Skip Flags linha 155, Troubleshooting linha 176): 'skip_research: true -> exige `assets/<task>/`; se ausente, BLOQUEIA o pipeline' e 'Task nao pode prosseguir ate a source folder ser uploaded'.
- **Realidade:** Isso so acontece no caminho legado: skills/orchestrator/scripts/orchestrate.js:57-65 checa `assets/<task>` e marca blocked. No pipeline executavel, pipeline/agents.js:258-263 simplesmente pula o research e segue (`{ job: 'research_agent', status: 'skipped' }`) — nenhuma verificacao de assets. Alem disso `assets/` nao tem subpastas por task hoje (so brand-identity/, logos e mockup-hand-tablet.jpg).
- **Impacto:** Regra apresentada como invariante do pipeline que nao existe onde o pipeline roda de fato. Quem confiar nela acha que ha uma protecao contra rodar sem insumo, e nao ha.
- **Correcao:** Marcar a regra de bloqueio como especifica do orchestrate.js (caminho legado) e registrar que em pipeline/agents.js `skip_research` apenas pula o estagio. Se o bloqueio ainda for desejado, abrir tarefa de codigo — nao documentar como se ja existisse. Revisar tambem a convencao `assets/<task>/`, que nao e usada por nenhuma task atual.

### 7. [MEDIA]

- **Documento diz:** Step 4 (linhas 134-140): 'Estados: queued, running, complete, skipped, failed, blocked'; 'Um log por job em outputs/<task>_<date>/logs/<job_name>.log'; exemplo de saida `{ "job_name": "video_ad_specialist", "status": "complete", ... }`. Repetido no Quality Checklist (linha 186).
- **Realidade:** Tres divergencias confirmadas: (1) os estados reais sao outros — orchestrate.js emite queued/skipped/blocked; pipeline/agents.js emite `done`, `skipped`, `blocked`, `error` (agents.js:123, :136, :159, :184, :276) — 'complete', 'running' e 'failed' nao existem em lugar nenhum. (2) A chave e `job`, nao `job_name`, no executavel. (3) pipeline/agents.js nao escreve NENHUM log em disco: so console (`opts.log`) e o resumo `pipeline_run.json` (agents.js:307). `find outputs -maxdepth 2 -type d -name logs` retorna VAZIO — nenhuma task tem pasta logs/.
- **Impacto:** O rastreamento de status descrito nao pode ser feito: quem procurar logs/<job>.log ou filtrar por status 'complete' nao encontra nada, e conclui erradamente que a run nao aconteceu.
- **Correcao:** Atualizar o Step 4 para os estados reais (done/skipped/blocked/error no executavel; queued/skipped/blocked no plano), trocar `job_name` por `job` no exemplo, e substituir 'um log por job em logs/' por: saida no console + resumo consolidado em `outputs/<task>_<date>/pipeline_run.json` (logs/<job>.log so existem se o orchestrate.js legado for usado).

### 8. [MEDIA]

- **Documento diz:** Payload de exemplo traz `"dry_run": false` (linha 54) e o Step 5 (linha 149) + Quality Checklist (linha 189) + Performance Notes (linha 207) mandam 'rotular o report como TESTE' e 'nao usar chaves externas' quando dry_run estiver ligado.
- **Realidade:** `dry_run` nao existe no pipeline executavel: grep por 'dry_run' em pipeline/ retorna vazio. pipeline/agents.js chama a IA de verdade via `completeWithRetry` -> interface/lib/anthropic (agents.js:16, :147) e so cai para simulado se nao houver chave (fallback `simulate:` do proprio lib). Apenas skills/orchestrator/scripts/orchestrate.js:48 le dry_run, e so o copia para o pipeline_plan.json — nao muda comportamento nenhum.
- **Impacto:** Falsa sensacao de seguranca: alguem manda `dry_run: true` achando que nada real sera gerado/consumido, e o pipeline gera pecas de verdade gastando token de IA e renderizando arte.
- **Correcao:** Dizer explicitamente que `dry_run` NAO tem efeito no pipeline executavel (e apenas registrado no plano do orchestrate.js legado), e que o unico modo 'sem chamada real' e nao ter chave de IA configurada (o proprio resultado vem com `simulated: true`, agents.js:154). Para pular o render use `--no-render` / `skip_render`.

### 9. [BAIXA]

- **Documento diz:** A tabela do Step 2 lista 5 jobs e o Step 1.5 (linha 110-111) diz que 'O distribution-agent promovera draft -> in_review ao gerar o preview (scripts/generate_preview.js)'.
- **Realidade:** Existe um 6o job que o documento nao lista: `preview_generator`. skills/orchestrator/scripts/orchestrate.js:75-82 o adiciona ao plano (dependencia: distribution_agent, script scripts/generate_preview.js) e pipeline/agents.js:288-292 o executa como etapa 5 propria (`content.generatePreview`), depois do distribution — nao como efeito colateral do distribution-agent.
- **Impacto:** A tabela de dependencias fica incompleta em relacao ao pipeline_plan.json que o proprio script gera, e a atribuicao da promocao draft->in_review ao distribution-agent confunde quem depura por que a peca ja apareceu em revisao.
- **Correcao:** Acrescentar a linha `preview_generator | depende de distribution_agent | sem skip | gera preview.html e promove draft -> in_review (scripts/generate_preview.js)` na tabela do Step 2, e ajustar o Step 1.5 para dizer que quem promove e o job preview_generator do pipeline.

### 10. [BAIXA]

- **Documento diz:** Step 3 (linha 128): 'Comandos: `npm run pipeline:run`, `npm run pipeline:run:payload '<json inline>'`, `npm run pipeline:worker`'. E a linha 36 diz que os agentes sao rodados 'pelo Claude seguindo o plano, ou o worker BullMQ no futuro'.
- **Realidade:** (a) `npm run pipeline:run` sozinho nao roda: executado agora, `node pipeline/orchestrator.js` sai com exit 2 e a mensagem '[pipeline] obrigatorios: --task, --date e --brief'. Os scripts existem em package.json:9-11, mas exigem argumentos. (b) Contradicao interna: a linha 35 do proprio documento diz que `pipeline/worker.js` ja esta entregue e executavel (commit e787dc7, confirmado no git log), enquanto a linha 36 fala do worker 'no futuro'.
- **Impacto:** O primeiro comando que o operador tenta falha, e a frase 'no futuro' faz duvidar do que a linha acima afirma estar pronto.
- **Correcao:** Mostrar os comandos com argumentos obrigatorios: `npm run pipeline:run -- --task <t> --date <YYYY-MM-DD> --brief "<...>"` (mesma forma que pipeline/worker.js:15 sugere) e corrigir a linha 36 para 'ou o worker BullMQ (pipeline/worker.js), quando REDIS_URL estiver configurado'.


## copywriter-agent/SKILL.md

**Saude:** desatualizado_grave

O documento continua correto no que descreve (specs por plataforma batem com knowledge/platform_guidelines.md, o contrato do research bate com marketing-research-agent e o comando de re-aprovacao bate com scripts/promote_task.js), mas ficou preso ao contrato de 2026-05: ignora dois tipos de copy que o painel produz hoje (4Selet na Midia e carrossel), ignora os 6 pilares de conteudo e ainda autoriza a tagline que virou regra dura de proibicao. Como e a skill dona da copy, essas lacunas fazem ela gerar texto que o proprio painel recusaria ou sobrescreveria.

### 1. [ALTA]

- **Documento diz:** Step 3 lista o repertorio de copy em 4 plataformas (Instagram / Threads-X / YouTube / LinkedIn) e o Step 5 fixa os entregaveis em instagram_caption.txt, threads_post.txt, linkedin_post.txt, youtube_metadata.json e copy.json. O tipo "4Selet na Midia" (media_mention) nao aparece em nenhum lugar do documento.
- **Realidade:** media_mention e um CONTENT_TYPE de primeira classe hoje: interface/lib/config.js:180-191 (label "4Selet na Midia", kind "media", file "copy/instagram_caption.txt"), com schema proprio em interface/lib/prompts.js:55-60 e bloco de prompt dedicado em interface/lib/prompts.js:124-128. As regras dele sao o oposto das regras de caption de feed do documento: legenda de PROVA SOCIAL, hashtags com #NaMidia, "CTA aprovado suave [...] ou vazio" e "NAO invente trechos da materia". E ele grava no MESMO arquivo do feed (interface/lib/content.js:76-84 documenta exatamente essa colisao).
- **Impacto:** Quem seguir a skill escreve uma caption de feed (hook com numero + CTA obrigatorio + #TaxaZero) por cima de copy/instagram_caption.txt de uma peca de Midia, que exige tom sobrio de reconhecimento externo e nao pode inventar conteudo da materia. E o formato mais novo do painel (julho/2026) e o unico tipo de copy que a skill nao sabe que existe.
- **Correcao:** Adicionar uma linha "4Selet na Midia (media_mention)" na tabela do Step 3 e no Step 5, com as regras reais: legenda de prova social sobre a aparicao na imprensa, ancorada no que o veiculo representa; proibido inventar trechos/citacoes da materia; hashtags 3-5 com #4Selet + #NaMidia; CTA suave (ex.: Conhecer a plataforma) ou vazio. Registrar que o arquivo de saida e copy/instagram_caption.txt (mesmo caminho do feed) e que o tipo e marcado em status.json via setMediaMeta.

### 2. [ALTA]

- **Documento diz:** Brand Guardrails, linha 147: "**Frases-tag** (quando houver espaco editorial): *\"Para quem sabe que e Selet.\"* - *\"A escolha de quem ja performa.\"* - *\"Produtor nao e numero. E parceiro.\"*"
- **Realidade:** interface/lib/prompts.js:16 (bloco GOVERNANCE, aplicado a TODA geracao do painel): "NUNCA use a frase-tag 'Para quem sabe que e Selet.' como rodape, fecho ou assinatura automatica de peca (headline, body de slide, legenda ou cena de video). NAO assine as pecas com ela. So use uma frase-tag da marca se o brief pedir explicitamente." O knowledge/brand_identity.md:330 ainda traz a versao antiga ("assinatura final de toda peca quando houver espaco") e e justamente a fonte que a skill esta espelhando.
- **Impacto:** A skill autoriza exatamente o que a regra dura de hoje proibe. Copy gerada pela skill sai assinada com a tagline e diverge do que o painel produz em producao — o proprio Hugo mandou tirar a tagline das pecas novas.
- **Correcao:** Reescrever o item: a tagline "Para quem sabe que e Selet." NAO deve ser usada como rodape, fecho ou assinatura automatica de peca; so entra se o brief pedir explicitamente. Espelhar o texto de interface/lib/prompts.js:16 e sinalizar que knowledge/brand_identity.md:330 esta desatualizado nesse ponto.

### 3. [ALTA]

- **Documento diz:** O documento trata a campanha Taxa Zero como eixo unico: "Sem research disponivel: ancore direto nos knowledge files (Taxa Zero)" (linha 88); hashtags = "#4Selet (obrigatorio) + #TaxaZero + produto + nicho" (linha 145); checklist exige "numeros Taxa Zero corretos" (linha 188). Nao ha nenhuma mencao a pilar de conteudo.
- **Realidade:** O painel tem um eixo tematico fechado de 6 pilares em interface/lib/config.js:53-102 (taxa_zero, educacional, curiosidade_mercado, prova_plataforma, novidade, motivacional), cada um com um `angle` injetado no prompt. E interface/lib/prompts.js:106-111 injeta literalmente: "Mantenha a variedade real do feed 4Selet: NEM toda peca e sobre Taxa Zero. Respeite o pilar acima como eixo tematico, ainda que a campanha ativa exista." O pilar e persistido por peca (interface/routes/generate.js, content.setPillar).
- **Impacto:** A skill produz um feed monotematico de Taxa Zero e forca #TaxaZero em pecas educacionais, de curiosidade de mercado ou motivacionais — exatamente o problema que os 6 pilares foram criados para resolver. Note que a validacao do painel so exige #4Selet (interface/lib/validation.js:120-127); #TaxaZero nao e obrigatorio.
- **Correcao:** Inserir um passo "pilar de conteudo" antes do Step 2 (angulo), listando os 6 pilares de config.js e seus angulos; deixar claro que Taxa Zero e UM pilar, nao o default. Ajustar a regra de hashtag: #4Selet obrigatoria; #TaxaZero somente quando a peca for do pilar taxa_zero. Ajustar o fallback sem research para "ancore no pilar escolhido" em vez de "ancore em Taxa Zero".

### 4. [MEDIA]

- **Documento diz:** Step 5 lista os entregaveis de copy (instagram_caption.txt, threads_post.txt, linkedin_post.txt, youtube_metadata.json, copy.json) e o checklist da linha 189 repete essa lista. Carrossel nao e citado em nenhum ponto do documento.
- **Realidade:** instagram_carousel e um CONTENT_TYPE com arquivo de copy proprio: interface/lib/config.js:157-166 (file "copy/instagram_carousel.json"), schema completo de roteiro de slides em interface/lib/prompts.js:26-35 (eyebrow, slides[] com title/body/layout, caption, hashtags, cta) e ate regeneracao de UM slide em interface/routes/generate.js (POST /slide, le copy/instagram_carousel.json). knowledge/platform_guidelines.md tem uma secao "Regras de Carrossel".
- **Impacto:** O formato de copy mais estruturado do painel (roteiro de 4-7 slides + caption) nao tem nenhuma orientacao na skill que e a dona da copy. Quem aciona o copywriter-agent para um carrossel fica sem contrato de saida e sem as regras de variedade de layout (cover / stat_grid / list / flow / text / cta).
- **Correcao:** Acrescentar o carrossel ao Step 3 e ao Step 5, com o caminho copy/instagram_carousel.json e o schema real de prompts.js:26-35 (eyebrow, slides[] com title/body/layout, caption, hashtags, cta, notes), mais a regra de 4-7 slides com variedade de layout e capa-gancho -> desenvolvimento -> CTA.

### 5. [MEDIA]

- **Documento diz:** YouTube aparece como uma das 4 plataformas obrigatorias (linha 61: "4 plataformas (nao 3)"), com specs proprias (linha 102), bloco no copy.json (linha 118) e youtube_metadata.json como entregavel travado no checklist (linha 189).
- **Realidade:** Nenhum caminho executavel produz copy de YouTube hoje. interface/lib/config.js:142-231 nao tem tipo de YouTube (os 7 tipos sao instagram_caption, instagram_carousel, ad_creative, media_mention, video_idea, linkedin_post, threads_post); pipeline/agents.js:22-25 lista 6 tipos, nenhum de YouTube, e o plano de distribuicao em pipeline/agents.js:196-199 mapeia apenas instagram/linkedin/x. Grep por "youtube_metadata" em todo o codigo .js do projeto retorna zero ocorrencias. YouTube sobrevive so como plataforma aceita em config.js:40 e como campo opcional de credencial em interface/routes/settings.js:97.
- **Impacto:** O checklist da skill fica impossivel de fechar por qualquer peca criada no painel ou no pipeline, e cria a expectativa de um entregavel que nao tem produtor nem consumidor no sistema atual (publicacao no YouTube tambem nao existe no painel).
- **Correcao:** Rebaixar YouTube a "caminho manual/legado": manter as specs como referencia, mas marcar explicitamente que nenhum tipo de conteudo do painel nem do pipeline gera youtube_metadata.json, e tirar esse arquivo da lista de itens obrigatorios do Quality Checklist (deixar condicional).

### 6. [MEDIA]

- **Documento diz:** O documento descreve um unico modo de operacao: a skill escreve os 5 arquivos direto em outputs/<task>_<date>/copy/ (Step 5 e checklist linha 190). Nao ha nenhuma mencao ao painel, a interface/ ou a qualquer gate de runtime alem da regra de re-aprovacao.
- **Realidade:** O caminho principal hoje e o painel (interface/), e ele grava UM arquivo por peca — interface/routes/generate.js:272 escreve apenas ct.file do tipo escolhido — alem de aplicar um gate de governanca em runtime que BLOQUEIA a gravacao com HTTP 422 "conteudo viola regras de marca" (interface/routes/generate.js:227-230, chamando runBrandGovernance de interface/lib/validation.js). copy.json nao e escrito por nenhum codigo do painel nem do pipeline (grep: so aparece em skills/*.md e exemplos).
- **Impacto:** A skill descreve um pacote de 5 arquivos por task que nao corresponde a nenhuma peca real produzida hoje (uma peca = um tipo = um arquivo), e ignora que ha um validador automatico que rejeita o texto antes de gravar. Quem usa a skill para revisar/completar uma peca do painel busca arquivos que nunca existiram naquela pasta.
- **Correcao:** Acrescentar uma secao "dois caminhos": (a) painel/pipeline, onde cada peca gera apenas o arquivo do seu tipo (config.js CONTENT_TYPES.file) e passa pelo gate runBrandGovernance; (b) execucao manual da skill, onde vale o pacote copy/ + copy.json consumido pelo distribution-agent. Deixar o Quality Checklist condicional ao caminho usado.

### 7. [MEDIA]

- **Documento diz:** Brand Guardrails, linha 144: "Banidos: 🔥 ⚡ 🚀 💸 💰 😱 (hype)."
- **Realidade:** A lista fechada tem 8 emojis: interface/lib/config.js:114 BANNED_EMOJIS = ["🔥","⚡","🚀","💸","💰","😱","🤯","✨"], igual a knowledge/brand_identity.md:293. E esses sao ERRO duro, nao aviso: interface/lib/validation.js:107-110 empurra para o array `errors`, que bloqueia a gravacao com 422 em interface/routes/generate.js:227-230.
- **Impacto:** Uma caption com ✨ ou 🤯 passa no checklist da skill e e recusada pelo painel na hora de salvar. O documento tambem nao avisa que emoji banido bloqueia (nao so avisa).
- **Correcao:** Completar a lista com 🤯 e ✨ e anotar que emoji banido e ERRO que impede a gravacao no painel (nao um aviso). Vale citar a lista de aprovados fechada do brand_identity.md:292: → ▸ • 📌 🔧 💡 📊.

### 8. [BAIXA]

- **Documento diz:** Tabela do Step 3, linha 100: para Instagram o CTA e "obrigatorio, conducao"; o checklist (linha 188) exige "CTA aprovado" sempre.
- **Realidade:** O padrao do painel hoje e SEM CTA: interface/public/js/app.js:3749 rotula o campo como "padrao: sem CTA", e interface/lib/prompts.js:122 injeta "SEM CTA forcado: NAO use chamadas de conversao (ex.: 'Solicitar convite', 'Ver as condicoes'). Deixe o campo cta do JSON vazio" quando o usuario nao escolhe um. O schema de media_mention (prompts.js:58) admite CTA vazio explicitamente.
- **Impacto:** A skill forca CTA de conversao em pecas onde o operador escolheu deliberadamente nao ter (educacional, motivacional, midia), gerando copy fora do que o painel entrega.
- **Correcao:** Trocar "obrigatorio" por "obrigatorio quando o brief define um CTA; se o brief nao trouxer CTA, encerrar com fechamento suave de relacionamento e deixar o campo cta vazio", alinhado a prompts.js:122.

### 9. [BAIXA]

- **Documento diz:** Brand Guardrails, linha 141: "CTAs aprovados: Solicitar convite - Ver condicoes - Falar com o time - Conhecer a plataforma - Migrar minha operacao - Calcular minha economia."
- **Realidade:** A lista oficial tem 9 entradas: knowledge/brand_identity.md:301-311 e interface/lib/config.js:117-121 (APPROVED_CTAS) incluem tambem "Acessar o material", "Ler o playbook" e "Ver como funciona"; e o texto correto e "Ver as condicoes", nao "Ver condicoes". interface/lib/prompts.js:14 repete a lista completa no GOVERNANCE.
- **Impacto:** A skill descarta 3 CTAs validos — justamente os de pilar educacional/relacionamento (Acessar o material, Ler o playbook) — e propaga uma variante textual que nao bate com a lista canonica.
- **Correcao:** Substituir pela lista de 9 de config.js:117-121: Solicitar convite, Ver as condicoes, Conhecer a plataforma, Migrar minha operacao, Calcular minha economia, Falar com o time, Acessar o material, Ler o playbook, Ver como funciona.


## distribution-agent/SKILL.md

**Saude:** desatualizado_grave

O documento descreve um caminho de distribuicao que praticamente nao existe mais: o gate central por \"Publish MD citado pelo nome\", a hospedagem de midia no Supabase e a configuracao por IG_ACCESS_TOKEN foram substituidos, na pratica, pelo painel (interface/lib/publish.js com gate de aprovacao + hashes, link temporario /m/:token e token em interface/data/publish.json). Alem disso ele ignora capacidades ja em producao — carrossel, agendamento executavel com anti-duplicidade, historico de publicados e o tipo \"4Selet na Midia\" — e usa nomes de arquivo que o publisher real nao reconhece.

### 1. [ALTA]

- **Documento diz:** Gate de publicacao (linhas 30-34): "Posting real so ocorre quando TODAS estas condicoes forem verdadeiras: 1. O usuario referencia explicitamente o arquivo Publish MD pelo nome"; e Step 5: "Publishing layer (GATED — so com referencia explicita)".
- **Realidade:** O publisher real e o painel: interface/lib/publish.js (publishTask) chamado por interface/routes/publish.js (POST /api/publish/:folder). Nenhum dos dois le, exige ou sequer menciona um Publish MD. Nenhum arquivo "Publish *.md" existe em outputs/ (busca recursiva sem resultados) e nenhum script gera um — scripts/generate_preview.js apenas EXIBE um se existir (linhas 200-203 e 429-432, com fallback "Sem Publish MD."). O caminho executavel do pipeline grava outputs/<task>/distribution/plan.md (pipeline/agents.js:213), nao "Publish <task> <date>.md".
- **Impacto:** A trava central descrita pelo documento nao existe em lugar nenhum do sistema, e as travas que de fato protegem a publicacao ficam invisiveis para quem le a skill: zona approved + status approved + content_hashes (interface/lib/publish.js:138-148), flag dryRun (publish.js:211), Instagram configurado, peca ainda nao publicada (E_ALREADY_PUBLISHED em routes/publish.js:104) e trava de publicacao em voo (publishingNow, routes/publish.js:93-110). Resultado: falsa sensacao de seguranca e uma instrucao impossivel de cumprir no painel.
- **Correcao:** Reescrever a secao "CRITICAL: gate de publicacao" e o Step 5 descrevendo as invariantes reais do painel (peca em outputs/approved + status.status=approved + content_hashes batendo + confirmacao humana no painel + dryRun=false + Instagram conectado + peca nao publicada antes). Manter a referencia ao Publish MD apenas como caminho historico/CLI, deixando explicito que ele nao e gerado por nenhum script hoje.

### 2. [ALTA]

- **Documento diz:** Step 1: "Suba toda a midia da task para o bucket campaign-uploads" via skills/distribution-agent/scripts/upload_supabase.js -> media_urls.json com public URLs; e no cabecalho: "Sem Supabase configurado, opera em modo SIMULADO (URLs placeholder)", tratando o Supabase como caminho de hospedagem da publicacao.
- **Realidade:** A publicacao real nao passa por Supabase. interface/lib/publish.js:222 monta a URL que a Meta busca como `base + "/m/" + media.mint(abs)`, usando interface/lib/media_tokens.js (token opaco em memoria, TTL de 20 min, comentario: "A Meta precisa BUSCAR a imagem numa URL publica... o token EXPIRA") servido pela rota GET /m/:token em interface/server.js:51. Nenhuma referencia a supabase em interface/lib/ ou interface/routes/ alem de um rotulo informativo em interface/routes/settings.js:85-88. Nenhum media_urls.json existe em outputs/.
- **Impacto:** Quem seguir a skill vai tentar configurar/instalar Supabase como pre-requisito de publicacao (e vai concluir que esta "simulado" sem ele), quando a publicacao real ja funciona hoje sem Supabase. Tambem esconde a restricao operacional que existe de verdade: o link e temporario (20 min) e depende de public_base_url correto (publish.js:41-44).
- **Correcao:** Marcar o Step 1/Supabase como caminho legado/opcional (arquivo de campanha), e documentar como a midia chega na Meta hoje: link publico temporario /m/:token (interface/lib/media_tokens.js), base configuravel em public_base_url (interface/data/publish.json), expiracao de 20 min.

### 3. [ALTA]

- **Documento diz:** Step 5: "Instagram: Graph API ... Requer `IG_ACCESS_TOKEN` + IG Business account id"; e gate item 3: "As credenciais da plataforma existem (IG/YouTube tokens)".
- **Realidade:** interface/lib/publish.js le token e conta de interface/data/publish.json (CONFIG_FILE, linha 19; modo 0600), gravado por setInstagram (linha 58) a partir de POST /api/publish/config, admin-only (interface/routes/publish.js:22). Alem disso testConnection (publish.js:114-135) DESCOBRE sozinho o ig_user_id via GET /me/accounts — o usuario so cola o token. A variavel IG_ACCESS_TOKEN aparece apenas como rotulo de status em interface/routes/settings.js:93-94 e nao e lida por publish.js.
- **Impacto:** Instrucao leva a configurar credencial no lugar errado (.env) e a acreditar que e preciso descobrir manualmente o IG Business account id. Com IG_ACCESS_TOKEN no .env e sem data/publish.json, isConfigured() retorna false e toda publicacao cai em dry-run silencioso (publish.js:211-219).
- **Correcao:** Trocar a instrucao por: token colado em Configuracoes > Publicacao Instagram (POST /api/publish/config, so admin), persistido em interface/data/publish.json; o ig_user_id e descoberto pelo botao Testar (testConnection); e sem essa configuracao o publishTask retorna dry_run com o motivo "Instagram ainda nao conectado — simulado".

### 4. [MEDIA]

- **Documento diz:** Step 5: "Instagram: Graph API — POST /media (cria container com image_url/video_url + caption) -> POST /media_publish"; e Step 5a manda o publisher chamar `const { assertPublishApproved } = require("../../scripts/check_approval_gate"); assertPublishApproved({ taskName, date });`.
- **Realidade:** interface/lib/publish.js implementa imagem unica (publishImage, linha 173) E CARROSSEL (publishCarousel, linha 180, com is_carousel_item + media_type=CAROUSEL) — carrossel nao aparece no documento. Video NAO e suportado: pickImages (linhas 151-167) so aceita png/jpg/jpeg e o cabecalho do arquivo diz "FASE 1: feed (imagem unica) + carrossel. Stories/Reels depois." — nao existe video_url nem media_type=REELS. E o painel nao chama scripts/check_approval_gate: reimplementa a mesma invariante em publish.js assertApproved (linhas 138-148), com codigo de erro proprio E_NOT_APPROVED no lugar de E_TASK_NOT_FOUND.
- **Impacto:** O documento promete publicacao de video que nao existe (uma peca de video passaria no gate e falharia com E_NO_IMAGE, publish.js:209) e omite o carrossel, que e o formato mais usado hoje. A instrucao de import tambem induz a acreditar que existe um unico ponto de gate, quando ha duas implementacoes que precisam ser mantidas em sincronia.
- **Correcao:** Atualizar o Step 5 para: imagem unica e carrossel via interface/lib/publish.js (Graph v21.0); video/Reels/Stories NAO publicaveis hoje. No Step 5a, dizer que o gate CLI scripts/check_approval_gate.js vale para o caminho CLI e que o painel usa o equivalente publish.assertApproved (mesmas invariantes, codigo E_NOT_APPROVED).

### 5. [MEDIA]

- **Documento diz:** Step 3 e Step 4 tratam agendamento como advisory: "Horarios sugeridos de postagem" escritos no Publish MD, com a tabela Segunda/Terca/Quarta.
- **Realidade:** O agendamento e executavel: interface/lib/schedule.js mantem fila em interface/data/schedule.json com worker que publica no horario; POST /api/publish/:folder/schedule roda publish.assertApproved ANTES de agendar (interface/routes/publish.js:80), DELETE /api/publish/schedule/:id cancela, e o que foi ao ar entra no historico via interface/lib/publications.js (GET /api/publish/publications). Ha ainda protecoes de duplicidade que o documento ignora: um agendamento pendente por peca (schedule.js add, E_ALREADY_SCHEDULED), cancelPendingFor ao publicar/marcar como publicada, e POST /:folder/mark-published para posts feitos fora do painel.
- **Impacto:** Quem le a skill nao sabe que existe fila real e acha que precisa postar manualmente no horario; e desconhece as regras anti-post-duplicado, que sao justamente o risco alto nessa etapa.
- **Correcao:** Adicionar ao Step 3/Step 4 uma secao sobre o agendamento executavel do painel (fila, gate no momento de agendar, cancelamento, historico de Publicados, marcar como publicada) e manter a tabela de sequenciamento apenas como recomendacao editorial.

### 6. [MEDIA]

- **Documento diz:** Inputs e schemas citam `ads/instagram_ad.png`, `video/ad.mp4`, `outputs/<task>_<date>/research_results.json`, `copy/copy.json`; e o Step 2 cobre so 4 plataformas (Instagram, YouTube, Threads/X, LinkedIn).
- **Realidade:** Os nomes reais produzidos hoje sao outros: interface/lib/render.js grava ads/feed.png (linha 2017), ads/ad.png (linha 2003), slides/slide_N.png (2097-2102), video/video.mp4 (2147/2169) e, para o tipo Midia, ads/feed.png + square.png + story.png + media_16x9.png (MEDIA formats, 2431-2434). A legenda fica em copy/instagram_caption.txt (lida por publish.js readCaption, linha 169). Nao existe nenhum copy/copy.json nem research_results.json em outputs/ hoje. E interface/lib/config.js CONTENT_TYPES tem dois tipos que o documento ignora: instagram_carousel e media_mention ("4Selet na Midia", kind media, renderizado por tplMedia/renderMedia — render.js:1521 e 2439).
- **Impacto:** Uma peca montada exatamente como o documento descreve nao e publicavel: publish.js pickImages so procura slides/slide_N.* e ads/{feed,ad}.{png,jpg,jpeg} — "ads/instagram_ad.png" nao entra e a chamada morre em E_NO_IMAGE. E o tipo "4Selet na Midia" (o formato mais novo, ja com dezenas de pecas em outputs/midia_*) nao tem nenhuma orientacao de distribuicao.
- **Correcao:** Atualizar a tabela de Inputs e o schema de media_urls.json para os arquivos reais (ads/feed.png, ads/ad.png, slides/slide_N.png, ads/square|story|media_16x9.png, video/video.mp4, copy/instagram_caption.txt) e incluir carrossel e media_mention (4Selet na Midia) no Step 2, deixando claro que so o 4:5 (ads/feed.png) e os slides sao publicaveis no feed.

### 7. [MEDIA]

- **Documento diz:** Secao "Brand Guardrails (4Selet)" lista hashtags, CTAs, numeros Taxa Zero e concorrentes — e nao diz nada sobre a frase-tag da marca. Nas skills irmas ela aparece como recurso liberado (skills/copywriter-agent/SKILL.md:147; skills/ad-creative-designer/SKILL.md:105).
- **Realidade:** A regra dura vigente esta em interface/lib/prompts.js:16 (GOVERNANCE): "NUNCA use a frase-tag 'Para quem sabe que e Selet.' como rodape, fecho ou assinatura automatica de peca (headline, body de slide, legenda ou cena de video). NAO assine as pecas com ela."
- **Impacto:** A distribution e a ultima barreira antes do post e roda o brand governance checklist; sem essa regra no guardrail, uma legenda assinada com a tagline passa direto para o Instagram.
- **Correcao:** Acrescentar aos Brand Guardrails e ao checklist de qualidade a regra de nao assinar peca com a frase-tag "Para quem sabe que e Selet.", replicando o texto de interface/lib/prompts.js.

### 8. [BAIXA]

- **Documento diz:** Brand Guardrails: "CTAs aprovados: Solicitar convite · Ver condicoes · Falar com o time".
- **Realidade:** knowledge/brand_identity.md (secao CTAs aprovados) lista nove: Solicitar convite, Ver as condicoes, Conhecer a plataforma, Migrar minha operacao, Calcular minha economia, Falar com o time, Acessar o material, Ler o playbook, Ver como funciona — mesma lista espelhada em interface/lib/config.js APPROVED_CTAS. A grafia correta e "Ver as condicoes", nao "Ver condicoes".
- **Impacto:** Ao conferir a copy no checklist final, a skill pode marcar como fora do padrao CTAs que sao aprovados (ex.: "Calcular minha economia"), gerando retrabalho desnecessario.
- **Correcao:** Substituir a lista de 3 CTAs pela lista completa de 9 de knowledge/brand_identity.md, com a grafia "Ver as condicoes".

### 9. [BAIXA]

- **Documento diz:** Step 5a: o gate "recalcula SHA-256 de cada arquivo (excluindo o proprio status.json) e compara com status.content_hashes".
- **Realidade:** Sao DUAS exclusoes: scripts/check_approval_gate.js:58 chama hashDirectory(taskDir, ["status.json", "preview.html"]) — e interface/lib/publish.js:145 faz o mesmo. O proprio Step 4.5 manda gerar preview.html, que e regravado a cada execucao.
- **Impacto:** Leitura literal sugere que regerar o preview de uma peca aprovada quebraria o gate com E_HASH_MISMATCH — o que faria o operador evitar uma acao que na verdade e segura.
- **Correcao:** Corrigir para "excluindo status.json e preview.html" no texto do Step 5a.

### 10. [BAIXA]

- **Documento diz:** Step 5: "YouTube: Data API (videos.insert) — requer OAuth YOUTUBE_REFRESH_TOKEN. Sem OAuth -> mockar"; e a tabela de agendamento coloca YouTube na quarta-feira como plataforma com API.
- **Realidade:** Nao existe nenhuma implementacao de publicacao no YouTube no projeto: em interface/ a palavra youtube so aparece em rotulos (interface/routes/settings.js na lista de integracoes, interface/lib/config.js ALLOWED_PLATFORMS, public/js/app.js) e nao ha nenhum modulo equivalente ao lib/publish.js para YouTube; o CLAUDE.md registra "publicacao no YouTube nao existe no painel".
- **Impacto:** Sugere um caminho de publicacao que nao tem codigo por tras; o "mockar" acaba sendo o unico comportamento possivel, mas isso nao esta declarado como estado permanente.
- **Correcao:** Declarar explicitamente que a publicacao no YouTube NAO esta implementada (nao ha publisher), que o item permanece sempre em modo mock/manual e que a unica plataforma com publicacao real hoje e o Instagram feed.


## ad-creative-designer/SKILL.md

**Saude:** desatualizado_grave

O documento descreve um fluxo de ad estático que o projeto abandonou: ele ainda manda gerar layout.json + styles.css + instagram_ad.png com templates product_focus/lifestyle, enquanto o caminho real (painel e pipeline) usa ads/concept.json -> ads/ad.html -> ads/ad.png com os templates editorial/bold/split/photo, e ainda instrui a assinar a peça com a tagline que hoje é proibida por regra dura. Também ignora capacidades já em produção: o tipo 4Selet na Mídia, os 6 pilares de conteúdo, foto de fundo (acervo/Pexels) e as variantes de logo/marca d'água por peça.

### 1. [ALTA]

- **Documento diz:** Step 3/4/6: "Salve em `ads/layout.json`", gere `ads/ad.html` + `ads/styles.css` e renderize `ads/instagram_ad.png` — árvore final `ads/{layout.json, ad.html, styles.css, instagram_ad.png}`.
- **Realidade:** O contrato real da peça estática é `ads/concept.json` (interface/lib/config.js:172, `id: "ad_creative", file: "ads/concept.json"`), e o render grava `ads/ad.html` + `ads/ad.png` (interface/lib/render.js, renderImage: `readJson(path.join(loc.path,"ads","concept.json"))`, `outPng = ads/ad.png`, retorna `rel: "ads/ad.png"`). Nenhuma peça real tem layout.json/styles.css/instagram_ad.png — ex.: outputs/cur_ad_sabia_2026-06-18/ads/ = {ad.html, ad.png, concept.json}; idem outputs/prova_imagem_aprovacao_2026-06-17/ads/. O CSS é inline (`<style>` dentro do HTML), não existe styles.css em lugar nenhum do fluxo atual.
- **Impacto:** Peça criada seguindo a skill fica órfã do painel: classifyKind ainda tolera `ads/layout.json` (interface/lib/content.js:96), então a peça aparece na biblioteca, mas ao clicar em "Gerar arte final"/re-renderizar o renderImage lê concept.json inexistente e cai nos fallbacks — headline vira "4Selet." e eyebrow/subtext/CTA somem (perda silenciosa da copy). Além disso o editor visual quebra: renderEditedHtml deriva o HTML trocando .png por .html (interface/lib/render.js), então `instagram_ad.png` procura `instagram_ad.html`, que não existe → E_NO_SOURCE_HTML ("origem (HTML) da peça não encontrada para editar").
- **Correcao:** Reescrever Steps 3–6 para o contrato atual: blueprint em `ads/concept.json`, arte em `ads/ad.html` (CSS inline, sem styles.css) e PNG em `ads/ad.png`. Remover `layout.json`, `styles.css` e `instagram_ad.png` do texto, do checklist e do diagrama de relacionamento entre skills.

### 2. [ALTA]

- **Documento diz:** Step 3 define o blueprint como JSON com `format`, `width`, `height`, `layout_type`, `background`, `palette{}` e um array `elements[]` com `{type: eyebrow|headline|subtext|cta|image|footer}`.
- **Realidade:** O schema real do ad_creative é plano, sem elements[]: interface/lib/prompts.js:47 (`SCHEMAS.ad_creative`) pede `{headline, subtext, cta, layout_type, visual_direction, notes}`, e o render consome só campos planos — interface/lib/render.js renderImage lê `concept.eyebrow`, `concept.headline`, `concept.subtext`, `concept.cta`, `concept.badge`, `concept.image`. Os concept.json reais confirmam (outputs/prova_imagem_aprovacao_2026-06-17/ads/concept.json = {eyebrow, headline, subtext, cta, image}). `width/height/background/palette/elements` não são lidos por ninguém; `layout_type` e `visual_direction` só existem como texto decorativo (campo livre "Layout" em interface/public/js/app.js:4591; nenhum consumidor no render).
- **Impacto:** Quem seguir a skill produz um JSON que o render ignora inteiro: a arte sai com os defaults e os campos `badge` e `image` (que o painel usa de verdade) nunca são preenchidos. Também induz a crer que dá pra trocar formato mudando width/height no JSON, o que não existe — renderImage é fixo em 1080x1080.
- **Correcao:** Substituir o exemplo de blueprint pelo schema real e plano: `{eyebrow, headline, subtext, cta, badge, image, layout_type, visual_direction, notes}`, documentando que `image` aceita caminho do acervo (`/uploads/...`) ou URL, que `badge` vira a pílula do canto superior e que `layout_type`/`visual_direction` são metadados de racional, não instruções de render.

### 3. [ALTA]

- **Documento diz:** Step 1: "Use templates" com a tabela `product_focus` | `split` | `lifestyle`, repetida no Quality Checklist ("Layout template escolhido (product_focus/split/lifestyle)").
- **Realidade:** Os templates de arte hoje são quatro e com outros ids: interface/lib/render.js — `const TEMPLATES = { editorial: tplEditorial, bold: tplBold, split: tplSplit, photo: tplPhoto }`; validação em interface/lib/content.js:387 `const VALID_TEMPLATES = ["editorial","bold","split","photo"]`; rótulos na UI em interface/public/js/app.js:1670 (Editorial / Destaque / Dividido / Foto) e no seletor de estilo da criação (app.js:3758). `product_focus` e `lifestyle` não existem em nenhum arquivo do projeto — grep em interface/, scripts/, pipeline/ e knowledge/ não retorna nada.
- **Impacto:** A skill manda escolher entre nomes que o motor de render não reconhece; pickTemplate cai no default `editorial` silenciosamente. E, pior, esconde o template `photo` (arte com foto de fundo) e o `bold` — justamente os dois mais usados hoje para peça número-forte e para peça com imagem.
- **Correcao:** Trocar a tabela do Step 1 pelos 4 templates reais (editorial = gradiente azul com headline à esquerda; bold/Destaque = fundo escuro centralizado com número em evidência; split/Dividido = faixa clara com logo + faixa escura; photo/Foto = imagem de fundo + texto por cima) e alinhar o checklist.

### 4. [ALTA]

- **Documento diz:** Step 2: "Footer/tagline (opcional): *Para quem sabe que e Selet.*"; o blueprint do Step 3 inclui `{ "type": "footer", "text": "Para quem sabe que é Selet." }`, o HTML do Step 4 tem `<div class="footer">Para quem sabe que é Selet.</div>` e o Example 1 manda gerar com "footer tagline".
- **Realidade:** Regra dura em vigor proíbe: interface/lib/prompts.js:16 (bloco GOVERNANCE) — "NUNCA use a frase-tag 'Para quem sabe que e Selet.' como rodape, fecho ou assinatura automatica de peca ... NAO assine as pecas com ela. So use uma frase-tag da marca se o brief pedir explicitamente". O render também já foi limpo: interface/lib/render.js, `const DEFAULT_FOOTER = ""; // sem rodapé automático (Hugo: tirar "4Selet" de toda postagem)`. O exemplo empacotado na própria skill ainda carrega a violação (skills/ad-creative-designer/examples/ads/ad.html e ads/layout.json).
- **Impacto:** A skill instrui explicitamente a assinar a peça com a tagline que o dono do projeto mandou tirar — e em três lugares (copy, blueprint e HTML), então a chance de reproduzir o erro é alta. Peça gerada assim precisa ser refeita.
- **Correcao:** Remover a tagline do Step 2, do JSON do Step 3, do HTML do Step 4 e do Example 1; incluir a regra dura no bloco Brand Guardrails ("nunca assinar peça com frase-tag; só se o brief pedir"). Limpar também skills/ad-creative-designer/examples/ads/{ad.html,layout.json}.

### 5. [MEDIA]

- **Documento diz:** O documento cobre apenas ad estático genérico (Steps 1–6) e diz "NAO use para: video, captions, hosting" — não existe uma única menção ao painel (interface/), nem ao tipo "4Selet na Mídia".
- **Realidade:** Existe desde julho/2026 um tipo nativo de peça ESTÁTICA que é renderizado pelo mesmo Playwright e não é ad_creative: interface/lib/config.js:180-191 (`id: "media_mention"`, label "4Selet na Mídia", kind "media"). Ele tem 10 modelos de arte próprios (interface/lib/content.js:441: hand_tablet, celular, navegador, citacao, split, selo, camadas, foto_real, foto_mesa, foto_maos_mesa) e 4 formatos (interface/lib/render.js, MEDIA_SIZES: 4x5→feed.png, 1x1→square.png, 9x16→story.png, 16x9→media_16x9.png), com templates dedicados (tplMediaHand, tplMediaNavegador, tplMediaCitacao, tplMediaSplit, tplMediaSelo, tplMediaCamadas, tplMediaFotoReal) e schema próprio no prompt (interface/lib/prompts.js, `SCHEMAS.media_mention`). Há ~16 peças reais desse tipo em outputs/ (midia_*_2026-07-29/30).
- **Impacto:** O gatilho da skill é amplo ("post/imagem para Instagram", "criativo") e ela se declara a autoridade de peça estática. Um pedido do tipo "faz uma peça da matéria que saiu sobre a 4Selet" cai nela e sai um ad genérico com headline+CTA, em vez do mockup de dispositivo com o print da matéria — que é o formato correto e já pronto no produto.
- **Correcao:** Acrescentar em "When to Use"/"NAO use para" o roteamento explícito: aparição na imprensa = tipo `media_mention` ("4Selet na Mídia"), com os 10 modelos e os 4 formatos, renderizado por renderMedia/tplMedia a partir de `status.media` (print, vehicle, url, headline, model, sizes) — não é trabalho do blueprint de ad.

### 6. [MEDIA]

- **Documento diz:** "**Defaults:** product = Taxa Zero; audience = Produtor Estabelecido..." e todos os exemplos e a régua de copy giram em torno de Taxa Zero ("Lidere com o numero-ancora (Taxa Zero ou 95%)").
- **Realidade:** O eixo temático hoje é a taxonomia de 6 pilares de conteúdo: interface/lib/config.js:53 `CONTENT_PILLARS` = taxa_zero, educacional, curiosidade_mercado, prova_plataforma, novidade, motivacional — com o comentário no próprio código: "Modela a variedade real do feed @4selet: o conteudo NAO e so Taxa Zero ... Vale para TODOS os formatos (feed, carrossel, ad, video, texto)". O pilar é gravado em status.json (content.js setPillar) e o `angle` do pilar é injetado no prompt (interface/lib/prompts.js). As peças estáticas reais confirmam: outputs/cur_ad_sabia_2026-06-18 (eyebrow "Curiosidade de mercado"), outputs/mot_ad_performa_foto_2026-06-18 (eyebrow "Mentalidade").
- **Impacto:** A skill puxa todo criativo para a oferta Taxa Zero, que é exatamente o viés que a taxonomia de pilares foi criada para corrigir. Resultado: feed monotemático e eyebrow/ângulo desalinhados do pilar escolhido pelo usuário no painel.
- **Correcao:** Substituir o default "product = Taxa Zero" por "pilar de conteúdo" como input de primeira classe, listando os 6 pilares com seus ângulos, e amarrar o campo `eyebrow` do concept ao pilar. Manter Taxa Zero como um pilar entre seis, não como padrão universal.

### 7. [MEDIA]

- **Documento diz:** Step 5: "Use o renderer headless **empacotado com a skill** (`skills/ad-creative-designer/scripts/render_ad.js`) ... O script vive **dentro da skill** (persiste com ela, ao contrario de `outputs/`)", com a chamada `node skills/ad-creative-designer/scripts/render_ad.js <html> <png> 1080 1080`.
- **Realidade:** O renderer canônico do produto é o da raiz: interface/lib/render.js, htmlToPng monta `path.join(PATHS.SCRIPTS_DIR, "render_ad.js")` — ou seja, scripts/render_ad.js. Esse script aceita um 5º argumento `[scale]` (deviceScaleFactor) e é chamado com RENDER_SCALE=2 por padrão (render.js: `const RENDER_SCALE = Number(process.env.RENDER_SCALE || 2) || 2`), suporta `RENDER_STRICT_NET=1` (bloqueio de rede/SSRF usado ao re-renderizar HTML editado) e emite os sidecars `<nome>.editable.json` + `<nome>.bg.png` para artes finais (scripts/render_ad.js:73: `/^(ad|feed)\.png$/` ou `slide_N.png`). A cópia dentro da skill (skills/ad-creative-designer/scripts/render_ad.js) não tem nenhuma dessas três coisas — só 4 argumentos e deviceScaleFactor fixo em 1.
- **Impacto:** Seguir a skill produz PNG em 1x (1080px) enquanto o painel entrega 2x (2160px) — peça visivelmente menos nítida no mesmo lugar; e o nome `instagram_ad.png` nem casa com o regex dos sidecars, então nada do pipeline de edição é gerado.
- **Correcao:** Apontar o Step 5 para `node scripts/render_ad.js <html> <png> <w> <h> [scale]`, documentar `scale 2` como padrão das artes finais e `RENDER_STRICT_NET=1` para HTML não confiável; ou declarar a cópia da skill como fallback offline e sincronizá-la com a da raiz.

### 8. [MEDIA]

- **Documento diz:** Step 4, requisitos do HTML: "`.ad-container` com `width`/`height` exatos do formato; `overflow: hidden`", CSS num arquivo separado `ads/styles.css`, e "CTA em estilo de botao (elemento `<button class="cta">`)".
- **Realidade:** Os templates reais usam outra estrutura e são auto-contidos: interface/lib/render.js tplEditorial/tplBold/tplSplit/tplPhoto geram `<style>` inline com `html,body { width:${width}px; height:${height}px; }` e um `<div class="card">` (não `.ad-container`), e o CTA é `<span class="cta">`. Isso não é estética: interface/lib/render.js `_pngBaseDims(html)` extrai as dimensões da peça exatamente com o regex `/html\s*,\s*body\s*\{[^}]*?width:\s*(\d+)px[^}]*?height:\s*(\d+)px/i`, e `sanitizeArtHtml(html)` remove TODO `<link>` que não seja de fonte do Google (`s.replace(/<link\b[^>]*>/gi, m => /fonts.googleapis.com/i.test(m) ? m : "")`).
- **Impacto:** HTML feito na régua da skill não sobrevive ao editor visual do painel: sem a regra `html,body{width/height}` o salvamento morre em E_NO_DIMS ("nao foi possivel ler as dimensoes do HTML editado"), e o `<link rel="stylesheet" href="styles.css">` é removido no saneamento — a arte re-renderiza sem estilo nenhum.
- **Correcao:** Reescrever os requisitos do Step 4: CSS sempre inline em `<style>`; obrigatório `html,body{width:Npx;height:Npx}` além do container; container `.card`; CTA como `<span class="cta">`. Trocar o snippet de HTML mínimo por um recorte fiel ao tplEditorial.

### 9. [MEDIA]

- **Documento diz:** Sobre imagens, a skill só prevê dois papéis: "`class="logo"` (logo oficial) ou `class="product"` (screenshot da plataforma, sempre com dados mascarados)", e nos Brand Guardrails só trata da escolha entre logo light e dark.
- **Realidade:** O painel evoluiu em três frentes que o doc ignora: (1) foto de fundo na arte — template `photo` (interface/lib/render.js tplPhoto) alimentado por `concept.image`, que hoje vem do acervo `/uploads/...` ou da busca Pexels (interface/lib/pexels.js, interface/routes/pexels.js), como nas peças reais outputs/mot_ad_performa_foto_2026-06-18/ads/concept.json (`"image": "/uploads/acervo_produtor_retrato.jpg"`); (2) variantes por peça gravadas em render.json — interface/lib/render.js `LOGO_IDS = ["light","dark","symbol"]` e `WATERMARK_IDS = ["word","symbol","outline","none","canto","padrao"]` (espelhados em interface/lib/content.js:401-402); (3) logo padrão = wordmark completo, com o selo "4" (assets/simbolo-selo.png) só quando a peça escolhe "symbol" (render.js logoSrc).
- **Impacto:** A skill descreve um repertório visual menor do que o produto tem: nada de foto de banco/acervo, nada de marca d'água, nada da variante "só o símbolo". Peça gerada por ela sai sempre chapada, e o usuário do painel recebe algo aquém do que consegue clicando na interface.
- **Correcao:** Adicionar ao Step 4/Guardrails: `concept.image` (acervo /uploads ou Pexels) com o template `photo`; as variantes `logo` (light/dark/symbol) e `watermark` (word/symbol/outline/none/canto/padrao) persistidas em `render.json` na raiz da task; e a regra de que o padrão é o wordmark completo.

### 10. [BAIXA]

- **Documento diz:** "**CTAs aprovados:** Solicitar convite · Ver condicoes · Falar com o time · Conhecer a plataforma" (Step 2 e Brand Guardrails).
- **Realidade:** A lista oficial tem 9 itens e a redação de um deles está errada: interface/lib/config.js:117 `APPROVED_CTAS` e knowledge/brand_identity.md:301-311 = Solicitar convite, **Ver as condições**, Conhecer a plataforma, Migrar minha operação, Calcular minha economia, Falar com o time, Acessar o material, Ler o playbook, Ver como funciona. O bloco GOVERNANCE do painel (interface/lib/prompts.js) repete essa lista.
- **Impacto:** Empobrece o repertório de fecho (some "Calcular minha economia" e "Migrar minha operação", que são os CTAs de conversão da campanha) e ensina uma redação fora do padrão ("Ver condicoes" em vez de "Ver as condições").
- **Correcao:** Substituir pela lista de 9 CTAs de config.js/brand_identity.md, com a grafia exata.

### 11. [BAIXA]

- **Documento diz:** Step 4, variante com imagem de produto: `<img class="product" src="../../assets/platform-dashboard.png" alt="" />` e "Caminho relativo a `assets/`".
- **Realidade:** O arquivo não existe: `assets/` contém apenas brand-identity/, logo-4selet-light.png, logo-4selet.png, logo-4selet.svg, mockup-hand-tablet.jpg, simbolo-selo.png e simbolo.svg — busca por *platform-dashboard* em assets/ e outputs/approved/ não retorna nada. E o caminho relativo está errado por um nível: a partir de `outputs/<task>_<date>/ads/ad.html`, `../../assets/` resolve para `outputs/assets/` (seriam três níveis). O render real nem usa caminho relativo: interface/lib/render.js monta `file://` absoluto (fileUrl/LOGO_LIGHT) e `relocalizeAssets()` reescreve os prefixos /uploads/ e /assets/ para o diretório local do ambiente.
- **Impacto:** Copiar o snippet gera `<img>` quebrado no PNG (imagem some sem erro visível, já que o render só aguarda decode com catch vazio).
- **Correcao:** Trocar o exemplo por um asset que existe e por caminho absoluto file:// (ou `/uploads/<arquivo>`, que o relocalizeAssets resolve), e explicar que o render reescreve os prefixos /uploads/ e /assets/ para o ambiente atual.

### 12. [BAIXA]

- **Documento diz:** Tabela "Formatos por plataforma" oferece `youtube_thumbnail` 1280×720 ("headline ≤5-6 palavras, alto contraste Navy/Darker"), e a própria description da skill cita o gatilho "thumbnail do YouTube".
- **Realidade:** Não existe tipo de conteúdo YouTube na taxonomia atual: interface/lib/config.js CONTENT_TYPES = instagram_caption, instagram_carousel, ad_creative, media_mention, video_idea, linkedin_post, threads_post. O render só produz 1080x1080 (renderImage), 1080x1350 (renderFeed/carrossel) e os 4 tamanhos de mídia (MEDIA_SIZES). Publicação no YouTube não existe no painel (CLAUDE.md, Tech Stack: OAuth YouTube pendente).
- **Impacto:** Gatilho órfão: a skill se oferece para um formato que nenhum tipo de peça, render ou canal de publicação do produto consome hoje — thumbnail gerada não tem onde entrar no fluxo.
- **Correcao:** Marcar `youtube_thumbnail` como formato avulso fora do fluxo do painel (ou remover), deixando claro que só existem 1080x1080 e 1080x1350 no caminho de produção da peça estática.

### 13. [BAIXA]

- **Documento diz:** "Existe pesquisa em `outputs/<task_name>_<date>/research_results.json` para ancorar hook e angulo" (When to Use) e "Se existir `research_results.json`, extraia `ad_hooks` e `selected_campaign_angle`" (CRITICAL antes de gerar).
- **Realidade:** O caminho de pesquisa hoje não grava esse arquivo: interface/lib/research.js expõe `marketIntel/isConfigured/saveKey/testKey` e a rota interface/routes/generate.js chama `researchLib.marketIntel(topic)` injetando o resultado direto no prompt; o que fica persistido é `research_requested/research_used/research_sources` no status.json. O único consumidor remanescente de research_results.json é scripts/generate_preview.js:196. Nenhuma task recente em outputs/ tem o arquivo.
- **Impacto:** Baixo (a instrução é condicional), mas desatualiza o entendimento: quem lê acha que precisa procurar um arquivo que o fluxo atual não produz, e não sabe que a pesquisa ao vivo (Tavily) já chega pelo prompt e que as fontes ficam em status.json.
- **Correcao:** Reescrever a referência: pesquisa ao vivo é opt-in via painel (interface/lib/research.js), entra no prompt e deixa rastro em `status.json.research_sources`; `research_results.json` é legado do caminho CLI e pode não existir.


## task-promoter/SKILL.md

**Saude:** desatualizado_grave

O nucleo executavel do documento continua correto — a matriz de 5 arcos, as flags do CLI, a obrigatoriedade do --by em approved e os codigos de erro batem linha a linha com scripts/promote_task.js. O que se perdeu foi o contexto ao redor: a maquina de estados real tem um 6o arco (approved -> draft, via check_approved_integrity --auto-revert), o rework hoje apaga a marca de publicacao da peca, existe uma 4a zona (outputs/_archived) que o script nao enxerga, e o painel web — que e por onde o Hugo realmente aprova e publica — nao aparece uma unica vez no documento.

### 1. [ALTA]

- **Documento diz:** O bloco "## Transicoes legais (matriz)" lista exatamente 5 arcos (`null -> draft`, `draft -> in_review`, `in_review -> approved | rejected`, `approved -> in_review`, `rejected -> in_review`) e afirma "Tentativas fora dessa matriz retornam exit 1 com E_INVALID_TRANSITION". No topo: "E o **unico** caminho para transicionar `status.json` — nunca edite a mao."
- **Realidade:** Existe um 6o arco real, approved -> draft, executado por OUTRO script: scripts/check_approved_integrity.js linhas 100-107 grava `status.previous_approval = {approved_at, approved_by}`, `status.status = "draft"` e empurra em history `{from:"approved", to:"draft", by:"check_approved_integrity", event_type:"edit_revert"}` quando roda com --auto-revert. SPEC_WORKFLOW_APROVACAO.md linha 24 e o CLAUDE.md ja documentam esse arco; so a SKILL.md nao. A matriz das linhas 94-100 de scripts/promote_task.js bate com o documento, mas a maquina de estados do sistema nao.
- **Impacto:** O agente trata a matriz como completa. Uma peca que voltou sozinha para `draft` dentro de outputs/ (edicao pos-aprovacao detectada) vira um estado 'impossivel' aos olhos da skill — ela nao sabe de onde veio, nao sabe que a rota de volta e generate_preview.js -> in_review -> approved, e pode concluir que o status.json esta corrompido. E a frase "unico caminho" e literalmente falsa.
- **Correcao:** Acrescentar na matriz a linha `approved -> draft   (edit_revert, so via scripts/check_approved_integrity.js --auto-revert)` com nota de que esse arco NAO e feito pelo promote_task.js, e trocar "E o unico caminho para transicionar status.json" por "E o unico caminho MANUAL/por comando; o auto-revert de integridade tambem transiciona (approved -> draft)".

### 2. [ALTA]

- **Documento diz:** Step 4 (Reportar) e o Example 3 ("Volte para revisao a campanha lancamento_curso") tratam `--to in_review` como uma simples volta de status: o relatorio sugerido so cita "<anterior> -> <novo>" e "Local atual". Nenhuma mencao a efeitos colaterais.
- **Realidade:** scripts/promote_task.js linhas 169-183: no rework a partir de approved, se `status.published_at` existir, o script APAGA `published_at`, `published_by` e `last_post_id` e move tudo para `previous_publication`. Em rejected -> in_review ele ainda incrementa `status.revision` e apaga rejected_by/rejected_at/rejection_reason. Na aprovacao grava tambem `preview_hash` (linha 163), alem de content_hashes. O painel depende disso: interface/routes/publish.js linhas 101-105 devolve E_ALREADY_PUBLISHED enquanto published_at existir, e interface/public/js/app.js linha 3129 esconde "Publicar ou agendar" nesse estado.
- **Impacto:** Se o usuario pedir "volte para revisao" numa peca JA PUBLICADA, a marca de publicacao e apagada — a peca some de Publicações/'Publicado' no painel — e a skill manda o agente reportar apenas 'approved -> in_review', sem avisar. Perda de informacao visivel para o Hugo sem aviso previo.
- **Correcao:** Criar uma secao "O que o script muda alem do status" listando por alvo: approved (approved_by/approved_at, content_hashes, preview_hash); rejected (rejected_by/rejected_at/rejection_reason); in_review vindo de approved (LIMPA published_at/published_by/last_post_id -> previous_publication) e vindo de rejected (limpa a rejeicao, incrementa revision). E no Step 2/4: antes de rodar `--to in_review` numa peca com published_at, avisar o usuario que a marca de publicada sera removida.

### 3. [MEDIA]

- **Documento diz:** Toda a skill (Steps, Examples, Relacionamento) descreve exclusivamente o caminho CLI local: "node scripts/promote_task.js ...". O painel web nao e citado uma unica vez.
- **Realidade:** O caminho principal de operacao hoje e o painel: interface/lib/content.js linhas 547-552 (`promote()` -> `runScript("promote_task.js", argv)`), rota POST /api/content/:folder/promote em interface/routes/content.js linhas 218-224, e os botoes em interface/public/js/app.js linhas 3125-3160 ("Aprovar" -> to:approved com `by`; "Rejeitar" -> to:rejected com motivo; "Reabrir para edicao" -> to:in_review). O painel roda em producao em https://mkt.4st.co, fora desta maquina.
- **Impacto:** O agente roda o script no repositorio local achando que promoveu a peca do Hugo, quando a peca real esta no container de producao — a transicao nunca aparece para ele. E, ao contrario, nao sabe informar que o botao do painel executa exatamente este script (mesma matriz, mesmos erros).
- **Correcao:** Adicionar uma secao "Caminho principal: painel" no inicio, com o mapa botao -> flag (Aprovar = --to approved --by; Rejeitar = --to rejected --reason; Reabrir para edicao = --to in_review) e a ressalva de que o CLI so afeta a copia local de outputs/ — para pecas em producao, a transicao tem que ser feita no painel.

### 4. [MEDIA]

- **Documento diz:** Troubleshooting item 1: "**Task nao encontrada** — verificar `outputs/INDEX.md` e `outputs/approved/INDEX.md`. Nao inventar caminhos." O documento so reconhece as pastas outputs/ e outputs/approved/.
- **Realidade:** Existem QUATRO zonas. scripts/promote_task.js linhas 103-107 procura em tres (`outputs/<folder>`, `outputs/approved/<folder>`, `outputs/archive/<folder>`) — a skill nunca menciona `outputs/archive/`, que e onde as rejeitadas caem (linha 200). E interface/lib/content.js linhas 583-599 (`discardTask`) move pecas descartadas no painel para `outputs/_archived/<folder>`, zona que o promote_task.js NAO enxerga; hoje ha ~20 pastas la (ex.: outputs/_archived/carrossel_junho_2026-06-15).
- **Impacto:** Peca descartada pelo painel faz o script falhar com "task nao encontrada em outputs/" e o agente conclui que ela nao existe, quando ela so precisa ser restaurada de _archived/ antes. E o agente nao sabe informar onde uma peca rejeitada foi parar.
- **Correcao:** Reescrever o item 1 do Troubleshooting com as 4 zonas: `outputs/<task>_<data>` (draft/in_review), `outputs/approved/<...>`, `outputs/archive/<...>` (rejeitadas) e `outputs/_archived/<...>` (descartadas pelo painel — o promote_task nao acha; restaurar antes). Acrescentar a tabela de localizacao por status.

### 5. [MEDIA]

- **Documento diz:** Tabela "Triggers e Mapeamento": | "arquive", "arquivar", "rejeite", "rejeitar" | `rejected` | — trata arquivar como sinonimo de rejeitar. O mesmo aparece no frontmatter ("arquive", "arquivar").
- **Realidade:** No painel "arquivar" virou outra coisa: interface/public/js/app.js linha 3032 e 3069 tem o botao "Descartar peca" com o texto "Move a peca para os arquivados — pode ser restaurada depois", que chama discardTask -> `outputs/_archived/` SEM tocar no status. Rejeitar e um botao separado (linhas 3125 e 3156, "Rejeitada e arquivada" -> outputs/archive, status rejected). Alem disso ZONE_LABELS (linha 168) rotula tanto `archive` quanto `archived` como "Arquivado".
- **Impacto:** "Arquive a peca X" e ambiguo hoje: seguindo a tabela, o agente marca a peca como REJEITADA (status muda, vai para outputs/archive) quando o usuario possivelmente queria so descartar/tirar da lista. Duas operacoes diferentes com o mesmo nome.
- **Correcao:** Tirar "arquive/arquivar" do mapeamento automatico para `rejected` e move-lo para a linha "perguntar": esclarecer se e Rejeitar (status rejected, outputs/archive) ou Descartar (outputs/_archived, sem mudar status, feito no painel — nao existe flag no promote_task.js para isso).

### 6. [MEDIA]

- **Documento diz:** Secao "NAO use para": "Publicar/postar -> o **gate de POSTING** nao passa pelo task-promoter; continua exigindo referencia explicita ao Publish MD." E no Step 4: "Se aprovada: lembrar que **publicacao exige referencia explicita ao Publish MD**."
- **Realidade:** A publicacao real hoje sai do painel, sem Publish MD nenhum: interface/lib/publish.js linhas 137-148 (`assertApproved`: pasta em approved/ + status===approved + content_hashes conferidos em runtime, mesma invariante do gate R5) e interface/routes/publish.js; ha agendamento (interface/lib/schedule.js) e "Marcar como ja publicada" (interface/lib/content.js linha 463, `setPublished`). O Publish MD sobrevive so no caminho CLI/agente (skills/distribution-agent/SKILL.md linha 127 e scripts/generate_preview.js linha 429, onde ele e apenas uma secao da previa).
- **Impacto:** A ultima frase que a skill manda o agente dizer ao usuario depois de aprovar aponta para um ritual que nao existe no caminho que o Hugo usa. Ele aprova e o proximo passo real e o botao "Publicar ou agendar".
- **Correcao:** Reescrever para: "Publicacao real acontece no painel (botao 'Publicar ou agendar'), atras do gate R5 (status approved + content_hashes conferidos em runtime — interface/lib/publish.js). No caminho CLI/agente, o gate adicional continua sendo a referencia explicita ao Publish MD."

### 7. [BAIXA]

- **Documento diz:** Step 1: "consultar `outputs/INDEX.md` (se existir) ou `outputs/approved/INDEX.md`"; Troubleshooting 1: "verificar `outputs/INDEX.md` e `outputs/approved/INDEX.md`"; Troubleshooting 5: "**INDEX desatualizado** — rodar `node scripts/refresh_index.js` (idempotente)".
- **Realidade:** scripts/refresh_index.js linha 1 e linhas 84-86 geram SOMENTE `outputs/approved/INDEX.md`. `outputs/INDEX.md` nao existe no projeto (verificado: apenas outputs/approved/INDEX.md esta em disco) e nenhum script o produz. Ou seja, tasks em draft/in_review nao tem indice algum — so as pastas `outputs/<task>_<data>/`.
- **Impacto:** O agente procura um arquivo inexistente para descobrir o task_date de pecas nao aprovadas — justamente o caso mais comum de uso da skill (promover algo que ainda nao foi aprovado) — e nao acha nada.
- **Correcao:** Trocar por: "para tasks nao aprovadas, listar as pastas de `outputs/` no formato `<task_name>_<YYYY-MM-DD>`; `outputs/approved/INDEX.md` cobre apenas as aprovadas (unico INDEX gerado, por scripts/refresh_index.js)". Remover as duas mencoes a outputs/INDEX.md.

### 8. [BAIXA]

- **Documento diz:** Performance Notes: "O `promote_task.js` e idempotente para `current == target` (retorna exit 1 com aviso)."
- **Realidade:** scripts/promote_task.js linhas 126-128: `if (current === target) { fail("E_INVALID_TRANSITION: task ja esta em '" + target + "'", 1); }` — `fail` escreve em stderr com o prefixo [promote_task] e faz process.exit(1). E um ERRO com codigo E_INVALID_TRANSITION, nao um aviso, e nada e reexecutado (nao ha idempotencia; o processo aborta antes de qualquer escrita).
- **Impacto:** Chamar de "idempotente" induz o agente a tratar o exit 1 como sucesso silencioso ("ja estava la, tudo bem") e a reportar uma promocao que nao aconteceu, ou a nao investigar um estado divergente do que o usuario esperava.
- **Correcao:** Trocar por: "Chamar com `current == target` NAO e no-op: aborta com `E_INVALID_TRANSITION: task ja esta em '<alvo>'` e exit 1, sem escrever nada. Reporte como 'nenhuma mudanca — a peca ja estava em <alvo>'."


## knowledge/platform_guidelines.md

**Saude:** desatualizado_grave

O documento parou em Maio/2026 e descreve um mundo de 4 plataformas genericas, enquanto o painel (caminho principal de operacao) evoluiu para 7 tipos de conteudo com uma matriz propria de formatos — inclusive o tipo "4Selet na Midia", que o documento ignora por completo. Agrava porque `interface/lib/knowledge.js` injeta este arquivo VERBATIM no system prompt de toda geracao (`interface/lib/prompts.js:83`), entao cada erro de spec vira instrucao direta para a IA e colide com as regras que o proprio painel injeta no mesmo prompt.

### 1. [ALTA]

- **Documento diz:** Secao 2, tabela de Specs do Instagram: "| **Feed Post** | 1080 × 1080 px | 1:1 |" (linha 30). O carrossel e que aparece como 1080 × 1350 / 4:5 (linha 31).
- **Realidade:** No painel, "Feed Instagram" (content_type `instagram_caption`) e 4:5. `interface/lib/render.js` linha 3 declara "feed -> PNG 1080x1350" e `renderFeed()` (linhas 2020 e 2030) renderiza com `width: 1080, height: 1350`. `interface/lib/config.js:153` descreve o tipo como "Post de feed: imagem 1080x1350". O 1080x1080 pertence a outro tipo — `ad_creative` / "Imagem / Anúncio" — em `renderImage()` (linhas 1992 e 2002) e `config.js:177`. O proprio documento se contradiz: a cheat sheet da Secao 6 (linha 252) ja diz "Feed dimensions | 1080×1350 (4:5)".
- **Impacto:** O documento inteiro entra verbatim no system prompt de geracao (`interface/lib/knowledge.js` -> `brandContext()` -> `interface/lib/prompts.js:83`). A IA recebe "feed = quadrado 1:1" e compoe headline, hierarquia e quebra de linha para uma tela quadrada, mas o Playwright entrega 1080x1350 — sobra vertical, texto descentrado e briefing de arte errado. Alem disso o documento se contradiz internamente (Secao 2 x Secao 6), entao quem consulta nao tem como saber qual das duas vale.
- **Correcao:** Reescrever a tabela da Secao 2 com o vocabulario real do painel: `Feed (post principal) | 1080 × 1350 | 4:5`; `Imagem / Anúncio (quadrado) | 1080 × 1080 | 1:1`; `Carrossel | 1080 × 1350 | 4:5`; `Story / Reel | 1080 × 1920 | 9:16`. Deixar explicito que 4:5 e o formato-padrao publicavel no feed e que 1:1 e o criativo estatico de anuncio, alinhando com a cheat sheet da Secao 6.

### 2. [ALTA]

- **Documento diz:** Nada. O tipo "4Selet na Mídia" nao aparece em lugar nenhum: a Secao 1 lista o Instagram apenas como "Image posts, Stories, Reels, Carrosséis" (linha 15) e um grep por midia/imprensa/mockup/dispositivo/veiculo no arquivo inteiro retorna zero ocorrencias.
- **Realidade:** `media_mention` ("4Selet na Mídia") e um content_type nativo e ativo: `interface/lib/config.js:180-191` (kind `media`, platform `instagram`, icone SVG proprio) e `interface/lib/config.js:238` (KIND_LABELS.media = "4Selet na Mídia"). O render existe em `interface/lib/render.js`: `renderMedia()` (linhas 2439-2460), `tplMedia()` (linhas 1521-1550) e o dispatcher (linha 2468, `case "media"`). Sao 10 modelos de dispositivo — `hand_tablet`, `foto_real`, `foto_mesa`, `foto_maos_mesa`, `celular`, `navegador`, `citacao`, `split`, `selo`, `camadas` — declarados em `render.js:1523-1530` e em `interface/public/js/app.js:115-126` (MEDIA_MODELS). O prompt tem schema dedicado em `interface/lib/prompts.js:55-60` e bloco de contexto em `prompts.js:124-127`.
- **Impacto:** A peca mais nova do painel gera legenda e arte sem NENHUMA regra de plataforma escrita. A IA recebe o documento como fonte de verdade e nao encontra orientacao sobre prova social de imprensa: nem tom, nem tratamento do print da materia, nem hashtags, nem o que pode/nao pode ser afirmado sobre a materia. Os agentes Ad Creative e Copywriter (que a Secao 9 manda consultar este arquivo) tambem nao sabem que existem 10 modelos de mockup nem quais formatos gerar.
- **Correcao:** Criar uma subsecao "2.x 4Selet na Mídia (media_mention)" dentro do Instagram, cobrindo: (a) proposito = prova social de aparicao na imprensa; (b) os 4 formatos gerados (4:5 publicavel, 1:1, 9:16, 16:9) e quais marcar por default; (c) os 10 modelos de dispositivo com quando usar cada um e a proporcao ideal do print (o painel ja avisa isso em `app.js:136-142`); (d) regra de conteudo: NAO inventar trechos da materia, tom sobrio de reconhecimento externo, CTA suave ou vazio; (e) hashtags do tipo. Adicionar a linha correspondente na Secao 1 e na cheat sheet da Secao 6.

### 3. [MEDIA]

- **Documento diz:** A matriz de formatos so contempla 4:5, 1:1 e 9:16 no Instagram (Secao 2, linhas 30-33). 16:9 aparece exclusivamente como formato de VIDEO do YouTube (linha 134) e do LinkedIn (linha 204). A cheat sheet da Secao 6 (linhas 252-253) so tem linhas de "Feed dimensions" e "Vertical dimensions" — nao ha linha para o quadrado 1:1 nem para 16:9 no Instagram.
- **Realidade:** O painel gera os 4 formatos como imagens ESTATICAS numa unica peca: `interface/lib/render.js:2430-2435` define `MEDIA_SIZES = { "4x5": 1080x1350 -> feed.png, "1x1": 1080x1080 -> square.png, "9x16": 1080x1920 -> story.png, "16x9": 1920x1080 -> media_16x9.png }`, e `render.js:2447` fixa o default `["4x5", "16x9"]`. Na interface, `interface/public/js/app.js:156-161` expoe as 4 opcoes ("Feed 4:5", "Quadrado 1:1", "Story 9:16", "Site 16:9") e `app.js:3739` deixa 4x5 e 16x9 marcados por padrao.
- **Impacto:** O 16:9 estatico e gerado por padrao em toda peca de Mídia e nao tem uma unica regra de composicao escrita — nem margem, nem hierarquia, nem onde entra o logo em paisagem (o `tplMedia` muda o layout inteiro quando `width > height`, `render.js:1522` e 1543-1548). Quem consulta o documento conclui que 16:9 so existe para video de YouTube e que o Instagram nao produz paisagem. O quadrado 1:1 tambem fica orfao na cheat sheet.
- **Correcao:** Trocar a Secao 6 de "Feed dimensions / Vertical dimensions" para uma matriz completa por formato (4:5 · 1:1 · 9:16 · 16:9) x plataforma, marcando onde cada um e publicavel e onde e so ativo institucional. Documentar explicitamente que o 16:9 (1920x1080) e formato de site/apresentacao — nao publicavel no feed — e escrever as regras de composicao em paisagem (o layout muda de empilhado para lado a lado).

### 4. [MEDIA]

- **Documento diz:** Secao 2, Design Rules: "**Margem segura:** 64px em todos os lados (Inter pede mais respiro)" (linha 43).
- **Realidade:** Nenhum template do painel usa 64px. Em `interface/lib/render.js`: template editorial `padding:96px 92px` (linha 175), template bold `padding:104px 96px` (linha 229), template split `padding:0 104px` (linhas 285 e 295), template photo `padding:80px 88px 0` e `padding:0 88px 84px` (linhas 351 e 355). A skill que o proprio documento manda seguir tambem discorda: `skills/ad-creative-designer/SKILL.md:146` diz "Margem segura generosa (~96px em 1080x1080)", enquanto a linha 73 da mesma skill aponta este documento como fonte da "regra de margem segura".
- **Impacto:** O numero esta 30-40% abaixo do que a producao real usa. Quando a IA (ou uma pessoa) usa 64px como referencia para posicionar elemento no editor visual, o resultado sai visualmente mais apertado que todas as pecas ja aprovadas — quebra a consistencia do feed. E cria conflito circular: a skill aponta para o documento e o documento contradiz a skill.
- **Correcao:** Corrigir para a faixa real: "Margem segura: 88-104px (~96px de referencia em 1080x1080); em 1080x1350 o respiro vertical e maior no topo/base". Referenciar que os templates do painel (editorial/bold/split/photo) ja aplicam esses valores, para que o numero do documento e o do render nunca mais divirjam.

### 5. [MEDIA]

- **Documento diz:** Secao 2, Caption Guidelines: "**CTA:** Sempre incluir; antes das hashtags" (linha 52), reforcado na cheat sheet da Secao 6: "**CTA obrigatório** | Instagram ✅ Sim" (linha 255).
- **Realidade:** O padrao do painel hoje e SEM CTA. `interface/public/js/app.js:3749` rotula o campo como "(padrão: sem CTA; oriente a IA aqui...)" e `app.js:3750` diz "deixe vazio para a peça não trazer chamada". Quando o campo fica vazio, `interface/lib/prompts.js:122` injeta a instrucao oposta a do documento: "SEM CTA forcado: NAO use chamadas de conversao (ex.: 'Solicitar convite', 'Ver as condicoes'). Deixe o campo cta do JSON vazio e encerre o texto de forma natural".
- **Impacto:** As duas instrucoes chegam no MESMO prompt e se anulam — o documento (via brandContext) manda sempre incluir CTA, o prompt do painel manda nao incluir. O resultado da geracao vira loteria: peca de pilar educacional/motivacional sai com "Solicitar convite" colado no fim, exatamente o que o painel tenta evitar.
- **Correcao:** Reescrever para condicional: "CTA: opcional. Inclua quando a peca tem intencao de conversao (Taxa Zero, prova de plataforma). Em pecas de relacionamento/autoridade (educacional, motivacional, 4Selet na Mídia) o padrao e encerrar sem chamada — no maximo um fechamento suave." Ajustar a linha da cheat sheet de "✅ Sim" para "Condicional (padrão: sem CTA)".

### 6. [MEDIA]

- **Documento diz:** Secao 2, Regras de Hashtags: "Mix obrigatório: **marca** (`#4Selet`) + **campanha ativa** (`#TaxaZero`) + **produto/categoria** + **nicho**" (linha 70). Toda a Secao 2 assume que cada post orbita a Taxa Zero.
- **Realidade:** O painel modela 6 pilares tematicos em `interface/lib/config.js:53-102` (taxa_zero, educacional, curiosidade_mercado, prova_plataforma, novidade, motivacional) — 5 deles nao sao Taxa Zero. O pilar `educacional` (config.js:68) manda explicitamente "Sem empurrar oferta". E `interface/lib/prompts.js:110` injeta a regra contraria a do documento: "Mantenha a variedade real do feed 4Selet: NEM toda peca e sobre Taxa Zero." O tipo Mídia tem ate hashtag propria no schema: `prompts.js:57` sugere `["#4Selet", "#NaMidia", ...]`, sem #TaxaZero.
- **Impacto:** Novamente duas instrucoes contraditorias no mesmo prompt. Forcar #TaxaZero em post educacional ou em aparicao na imprensa descaracteriza o pilar e transforma conteudo de autoridade em anuncio — que e justamente o que o sistema de pilares foi criado para evitar.
- **Correcao:** Trocar o mix fixo por um mix por pilar: obrigatorio so `#4Selet`; `#TaxaZero` apenas quando o pilar for taxa_zero (ou a peca falar da oferta ativa); nos demais pilares completar com produto/categoria/nicho. Acrescentar `#NaMidia` como hashtag do tipo 4Selet na Mídia. Incluir na secao uma nota de que existem 6 pilares de conteudo e que o feed nao e monotematico.

### 7. [BAIXA]

- **Documento diz:** Secao 1 lista quatro plataformas ativas em pe de igualdade (Instagram, Threads/X, YouTube, LinkedIn, linhas 15-18) e dedica a Secao 4 inteira ao YouTube (titles, descriptions, thumbnails 1280x720).
- **Realidade:** No painel — que e o caminho principal de operacao — nao existe nenhum content_type de YouTube: `interface/lib/config.js:142-231` so tem tipos com platform `instagram`, `linkedin` e `x`. "youtube" aparece apenas como tag de plataforma em ALLOWED_PLATFORMS (`config.js:40`), e um grep por youtube em `interface/lib/` retorna somente essa linha (nao ha publicacao nem geracao). O YouTube segue valido apenas no caminho secundario das skills — `skills/copywriter-agent/SKILL.md:102` ainda produz `youtube_metadata.json`.
- **Impacto:** Quem le o documento assume que da para produzir YouTube pelo painel e nao encontra o tipo. Nao e informacao errada (a Secao 4 continua correta como guia editorial), mas falta o mapa de onde cada plataforma e realmente operavel hoje.
- **Correcao:** Adicionar uma coluna "Onde se produz" na tabela da Secao 1: Instagram (feed, carrossel, imagem/anuncio, 4Selet na Mídia, video) e LinkedIn e Threads/X = painel; YouTube = apenas via skill copywriter-agent (`youtube_metadata.json`), sem geracao nem publicacao no painel. Manter a Secao 4 como referencia editorial e marcar esse escopo no cabecalho dela.


## knowledge/brand_identity.md

**Saude:** desatualizado_grave

O nucleo do documento continua valido — paleta, tipografia, publico, tom, concorrentes proibidos e CTAs batem com interface/lib/config.js e com o bloco GOVERNANCE de interface/lib/prompts.js. O problema e que ele parou em Maio/2026: manda assinar toda peca com a tagline que o painel proibe expressamente, ignora o tipo nativo \"4Selet na Midia\" e os 6 pilares de conteudo, e nega a fotografia de banco (Pexels) que hoje e recurso de producao — tudo isso injetado literalmente no mesmo system prompt que carrega as regras opostas.

### 1. [ALTA]

- **Documento diz:** Sample Copy, linha 330: "Para quem sabe que e Selet." (tagline-mae; assinatura final de toda peca quando houver espaco)", reforcado na linha 7 ("tres frases-tag estrela ... prioridade alta") e no exemplo de headline da linha 336 ("Zero taxa por 3 meses. Para quem sabe que e Selet.").
- **Realidade:** O painel proibe exatamente isso. interface/lib/prompts.js:16 (bloco GOVERNANCE): "NUNCA use a frase-tag 'Para quem sabe que e Selet.' como rodape, fecho ou assinatura automatica de peca (headline, body de slide, legenda ou cena de video). NAO assine as pecas com ela." E interface/lib/render.js:153: `const DEFAULT_FOOTER = ""; // sem rodape automatico (Hugo: tirar "4Selet" de toda postagem)`.
- **Impacto:** O documento inteiro e injetado LITERALMENTE no system prompt de geracao (interface/lib/knowledge.js:8 e :32 -> interface/lib/prompts.js:83), no mesmo prompt que contem a proibicao. A IA recebe duas ordens opostas sobre a mesma frase; qualquer deriva do modelo reintroduz a tagline nas pecas novas, que e justamente o que foi mandado tirar. As skills tambem herdaram a regra velha (skills/ad-creative-designer/SKILL.md:105 "Footer/tagline (opcional)"; skills/copywriter-agent/SKILL.md:147).
- **Correcao:** Reescrever a entrada da tagline no Sample Copy: manter "Para quem sabe que e Selet." como ESSENCIA/posicionamento interno, mas trocar "assinatura final de toda peca quando houver espaco" por "NAO usar como rodape, fecho, assinatura, headline ou legenda de peca nova; so aparece se o brief pedir explicitamente". Ajustar tambem a linha 7 e o exemplo de headline da linha 336 (usar "Zero taxa por 3 meses." sem a tagline), e registrar que nao existe mais rodape automatico nas artes.

### 2. [ALTA]

- **Documento diz:** Nada. O documento nao tem uma linha sobre aparicao na imprensa/prova social: nao ha ocorrencia de "midia", "imprensa" ou mockup de dispositivo (grep na knowledge/brand_identity.md so acha "carrossel" de passagem na linha 328). A secao Photography & Visual Content (linhas 203-223) so prevê screenshots da plataforma, composicoes tipograficas e "mockups de laptop/desktop".
- **Realidade:** "4Selet na Midia" (media_mention) e tipo de conteudo NATIVO em producao: interface/lib/config.js:180-191 (label "4Selet na Midia", kind "media", descricao "Aparicao na imprensa: o print da materia num dispositivo"), schema proprio de legenda em interface/lib/prompts.js:55-60, e 10 modelos de arte em interface/lib/render.js (linhas 1523-1529: hand_tablet, celular, foto_real, foto_mesa, foto_maos_mesa + LAYOUTS navegador/citacao/split/selo/camadas) com cenarios fotograficos em PHOTO_SCENES (render.js:615-641).
- **Impacto:** O formato que mais depende de regra de marca (usa print de materia de terceiro, nome/logo de veiculo, mockup de dispositivo, foto real) e o unico sem qualquer governanca no documento. A IA gera legenda de prova social sem regra escrita de tom, de citacao de veiculo ou de hashtag — o prompt ja pede "#NaMidia" (prompts.js:57), hashtag que nao existe no mix aprovado do documento (linhas 378-382). Alem disso interface/lib/validation.js:120-137 so aplica limite de emoji/hashtag a instagram_caption e threads_post, entao a legenda de midia passa sem checagem.
- **Correcao:** Criar uma secao "4Selet na Midia (prova social)" no documento: tom sobrio de quem foi reconhecido (sem hype/autopromocao), proibicao de inventar trecho da materia, como nomear o veiculo, uso do print e dos mockups de dispositivo/foto como excecao autorizada a regra de fotografia, e incluir #NaMidia no mix de hashtags aprovado. Adicionar linha no Agent Reference Quick Map.

### 3. [MEDIA]

- **Documento diz:** Linhas 205 e 216: "A 4Selet nao usa fotografia generica de banco de imagens" e, em Evite, "Stock photos de 'executivo sorrindo apertando mao'".
- **Realidade:** Banco de imagens virou recurso de primeira classe do painel: interface/lib/pexels.js (busca Pexels, chave em Configuracoes), interface/routes/pexels.js (busca + baixar a foto escolhida pro acervo), foto de fundo POR SLIDE do carrossel com scrim de leitura em interface/lib/render.js:1733-1741, e os mockups foto-reais partem de foto de banco — render.js:409 diz explicitamente "FOTO real de mao segurando um tablet (assets/mockup-hand-tablet.jpg, cottonbro studio/Pexels)" e render.js:438 cita "cottonbro/Pexels 5998828"; PHOTO_SCENES (615-641) usa cenas de maos/mesa com cafe e caderno.
- **Impacto:** A regra escrita nega uma capacidade que ja esta no ar e e usada pelo Hugo. Como o texto vai inteiro pro prompt, a IA pode recusar ou desaconselhar foto de fundo, e nao existe criterio escrito para escolher/tratar a foto (por isso o codigo aplica grade e tint navy por conta propria: render.js:621-639).
- **Correcao:** Reescrever o bloco de fotografia: permitir foto de banco (Pexels) desde que tratada na marca (grade dessaturado + tint Navy/Darker, scrim de leitura, foto como fundo e nunca como assunto), manter a proibicao apenas para o cliche corporativo (aperto de mao, executivo sorrindo, mansao/carro) e documentar o acervo /uploads + credito do fotografo.

### 4. [MEDIA]

- **Documento diz:** Color Rules, linha 163: "Substituir #FFFFFF por Selet Cloud (#D9DCD6) em todos os fundos — nunca usar branco puro"; e o checklist de governanca (linha 397) repete "Sem branco puro". O proprio documento se contradiz na linha 209 ("texto branco com hierarquia clara").
- **Realidade:** O renderizador de producao usa #FFFFFF como cor de TEXTO em todos os templates: interface/lib/render.js:188 e 194 (headline e CTA do template foto/hero), 240 e 246 (Bold), 293 e 297 (Split), 360/366, e o tema escuro do carrossel em render.js:1650 (`THEME_DARK = { text: "#FFFFFF" }`). Pecas ja APROVADAS contem branco puro: outputs/approved/e2e_image_2026-06-10/ads/ad.html:24 e :30, outputs/approved/prova_ad_95_foto_2026-06-18/ads/ad.html:21 e :27.
- **Impacto:** A regra, do jeito que esta escrita, reprova a arte oficial da propria marca. O checklist automatico de aprovacao aplica a regra ao pe da letra — scripts/generate_preview.js:263-264 marca qualquer #fff/#ffffff como "blacklist: branco puro" — entao toda peca real cai em warning e o checklist perde credibilidade (vira ruido que o revisor aprende a ignorar).
- **Correcao:** Trocar a regra por uma formulacao escopada: "#FFFFFF e permitido como TEXTO/foreground sobre fundo Navy/Darker (headline e CTA); e proibido como cor de FUNDO, de card ou de area chapada — nesses casos use Selet Cloud (#D9DCD6)". Ajustar a pergunta 1 do checklist de governanca no mesmo sentido (e alinhar scripts/generate_preview.js:263-264).

### 5. [MEDIA]

- **Documento diz:** Linha 140: "Todos os agentes devem usar EXCLUSIVAMENTE estas cores nos criativos" (as 6 da paleta + 3 funcionais de status), e Evite, linha 221: "Composicoes poluidas (mais de 3 cores por peca)".
- **Realidade:** A paleta em si esta correta e espelhada 1:1 em interface/lib/config.js:26-36 — mas o render usa dezenas de hexes fora dela: tema CLARO do carrossel com #E9ECE6 e #CBD2CC no gradiente (render.js:1655); molduras de dispositivo #0a1015 / #243039 (render.js:396-404); chrome de navegador #e7ecef, #c6ced4, #f2f5f7, #6c7c84 (render.js:402) e #0d3244 / #0a2a39 (render.js:825); e os tres pontos do navegador em #ff5f57, #febc2e, #28c840 (render.js:827-829), que sao cores quentes/neon proibidas pela leitura literal do documento.
- **Impacto:** A palavra EXCLUSIVAMENTE torna off-brand por definicao o layout "navegador" e o tema claro do carrossel, que estao em producao e foram aprovados pelo Hugo. Fica impossivel usar o documento como criterio objetivo de reprovacao — e a IA, ao seguir o texto, evita ou critica layouts legitimos.
- **Correcao:** Acrescentar uma excecao explicita na secao de cor: "neutros de interface (molduras, chrome de navegador, sombras) e os stops de gradiente do tema claro sao permitidos apenas dentro de mockups de dispositivo e do tema editorial claro; nunca como cor de marca, de texto ou de destaque". Listar os stops do tema claro (#E9ECE6, #CBD2CC) como derivados oficiais de Selet Cloud.

### 6. [MEDIA]

- **Documento diz:** Core Values (linhas 47-55): "Os agentes devem ancorar copy e visual em pelo menos uma destas colunas" — as 5 colunas estrategicas. E Hashtags (linha 379): "Campanha ativa: #TaxaZero (durante a campanha atual)" como item fixo do mix de 3-5 hashtags de todo post.
- **Realidade:** Existe um segundo eixo, hoje o que realmente define o tema de cada peca: os 6 PILARES DE CONTEUDO em interface/lib/config.js:53-102 (taxa_zero, educacional, curiosidade_mercado, prova_plataforma, novidade, motivacional), cada um com um `angle` injetado no prompt (interface/lib/prompts.js:106-111). E o prompt afirma o oposto do mix fixo: prompts.js:110 — "Mantenha a variedade real do feed 4Selet: NEM toda peca e sobre Taxa Zero." As 5 colunas so sobrevivem como BRAND_PILLARS (config.js:44-46), usadas apenas para validar campanha (validation.js:45).
- **Impacto:** O documento nao descreve o eixo que governa o tema das pecas, entao nao ha regra de marca escrita para os pilares educacional/curiosidade/novidade/motivacional — sobra so a campanha. E o mix de hashtags manda #TaxaZero em todo post, o que contradiz a variedade exigida no prompt e polui pecas educacionais/de prova com a oferta.
- **Correcao:** Adicionar uma secao "Pilares de conteudo (eixo tematico)" com os 6 pilares e o angulo de cada um, deixando claro que sao distintos das 5 colunas estrategicas. Na secao de hashtags, tornar #TaxaZero CONDICIONAL ("apenas quando a peca for do pilar Taxa Zero") e sugerir substitutos por pilar.

### 7. [BAIXA]

- **Documento diz:** Cabecalho (linha 3): "Knowledge file consumido por todos os 5 agentes (Research, Ad Creative, Video Ad, Copywriter, Distribution)", e o Agent Reference Quick Map (linhas 427-433) so mapeia esses 5 agentes.
- **Realidade:** O consumidor principal hoje e o painel web: interface/lib/knowledge.js:8 carrega brand_identity.md e :32 o concatena no contexto de marca, que interface/lib/prompts.js:83 injeta no system prompt de TODOS os 7 tipos de conteudo de interface/lib/config.js:142-231 (feed, carrossel, imagem/anuncio, 4Selet na Midia, video, LinkedIn, Threads/X). O painel esta em producao em https://mkt.4st.co.
- **Impacto:** Quem le o documento nao descobre onde ele e realmente aplicado, e o mapa de referencia nao da direcao para os formatos que o painel produz (carrossel e midia nao tem linha nenhuma). Manutencao futura tende a atualizar so as skills e esquecer o caminho que gera de verdade.
- **Correcao:** Atualizar o cabecalho para "consumido pelo painel web (interface/lib/knowledge.js -> prompts.js) e pelas skills dos 5 agentes" e acrescentar linhas no Quick Map por TIPO DE CONTEUDO do painel (Feed, Carrossel, Imagem/Anuncio, 4Selet na Midia, Video, LinkedIn, Threads/X) apontando as secoes-chave.

### 8. [BAIXA]

- **Documento diz:** Secao Emojis (linhas 281-293): tabela com contextos "Newsletter (corpo)" e "WhatsApp / Comunidade", e "Emojis aprovados (lista fechada para criativos): -> ▸ • 📌 🔧 💡 📊".
- **Realidade:** A regra dura em runtime e mais estreita: interface/lib/prompts.js:13 — "Emojis: no maximo 1 funcional em captions/threads (-> ▸ • permitidos); proibido em headline/body de ad"; os banidos estao em interface/lib/config.js:114 e viram ERRO em interface/lib/validation.js:107-110. Newsletter e WhatsApp nao sao tipos de conteudo do painel (config.js:142-231 nao tem nenhum), e a contagem de emoji so roda para instagram_caption e threads_post (validation.js:120-133) — legenda de 4Selet na Midia fica sem checagem.
- **Impacto:** O documento autoriza 📌 🔧 💡 📊 como "aprovados para criativos" enquanto o prompt so permite -> ▸ •, e os dois textos chegam juntos ao modelo. Duas linhas da tabela descrevem canais que o sistema nao produz, o que dilui a regra que importa.
- **Correcao:** Reduzir a lista fechada de criativos a -> ▸ • e mover 📌 🔧 💡 📊 para um bloco separado "canais nao automatizados (newsletter/WhatsApp) — fora do escopo do painel". Incluir a legenda de 4Selet na Midia na regra de maximo 1 emoji funcional.

### 9. [BAIXA]

- **Documento diz:** Secao Logo (linhas 121-126): lista apenas tres arquivos — logo-4selet-light.png, logo-4selet.png e simbolo.svg, este ultimo descrito como "Para favicons, avatars, icones de app".
- **Realidade:** assets/ tem tambem logo-4selet.svg e simbolo-selo.png. E o render inverte o papel do simbolo: interface/lib/render.js:77-79 documenta SIMBOLO_SELO (assets/simbolo-selo.png, crop do simbolo do logo oficial) como "a marca que aparece na arte por padrao (preferencia do Hugo). O simbolo.svg (traco) fica so p/ marca d'agua"; render.js:1612 usa SIMBOLO_SELO quando a peca escolhe "So o simbolo".
- **Impacto:** Quem segue o documento usaria simbolo.svg como simbolo da peca, que hoje e reservado a marca d'agua — resultando em simbolo diferente do que a marca padronizou nas artes. O SVG do logo completo nem aparece no documento.
- **Correcao:** Atualizar a lista de arquivos: incluir logo-4selet.svg (vetorial do lockup) e simbolo-selo.png (simbolo '4' oficial usado NA ARTE quando a peca escolhe 'So o simbolo'), e reclassificar simbolo.svg como uso de marca d'agua/favicon.

### 10. [BAIXA]

- **Documento diz:** CTAs aprovados (linhas 301-311): nove CTAs, entre eles "Ver as condicoes", "Acessar o material" e "Ler o playbook".
- **Realidade:** Nenhuma das duas implementacoes usa a lista completa: scripts/generate_preview.js:254 procura "Ver condicoes" (sem o "as") e so seis CTAs, sem "Acessar o material", "Ler o playbook" e "Ver como funciona"; interface/lib/prompts.js:14 lista sete e omite "Acessar o material" e "Ler o playbook". A lista completa so existe em interface/lib/config.js:117-121, que nao e usada para validar o texto gerado (validation.js so checa os CTAs PROIBIDOS).
- **Impacto:** Uma peca que usa exatamente o CTA canonico "Ver as condicoes" nao casa com a busca por "Ver condicoes" do checklist, que entao pode reportar "Nenhum CTA aprovado detectado" numa peca correta. E a IA raramente ve dois CTAs aprovados que o documento considera oficiais.
- **Correcao:** Fixar a grafia canonica no documento ("Ver as condicoes") e marcar quais CTAs sao reconhecidos automaticamente hoje; alinhar as listas de scripts/generate_preview.js:254 e interface/lib/prompts.js:14 a lista de nove do documento.


## marketing-research-agent/SKILL.md

**Saude:** desatualizado_leve

A espinha dorsal do documento continua valida: o script `skills/marketing-research-agent/scripts/research.js` existe, roda as 5 buscas descritas, grava `research_raw.json`, e o schema/contrato e o fluxo de re-aprovacao (`scripts/promote_task.js --to in_review`) batem com o codigo. O que envelheceu e o contexto ao redor da Tavily: o documento ainda afirma que o projeto NAO tem chave (tem, e a busca real funciona — verifiquei executando o script), confunde o que o painel faz com o que o pipeline faz, ignora a segunda casa da chave (`interface/data/tavily.json`) e nao incorpora a regra dura da frase-tag nem as taxonomias novas do painel.

### 1. [ALTA]

- **Documento diz:** Secao "CRITICAL: chave Tavily e modo simulado": "**Sem a chave** (estado atual do projeto): a skill opera em **modo SIMULADO (dry-run)**" — e o frontmatter repete "Requer TAVILY_API_KEY para busca real; sem chave, opera em modo SIMULADO". A premissa de que o projeto NAO tem chave atravessa a skill inteira (Example 2, Quality Checklist, `_simulated: true`).
- **Realidade:** A chave existe e a busca real funciona hoje. `TAVILY_API_KEY` esta em `interface/.env` (valor de 58 caracteres) e tambem no ambiente do shell; `@tavily/core` e dependencia declarada (`package.json:20`, `"@tavily/core": "^0.7.6"`) e instalada em `node_modules/@tavily`. Executei o proprio script empacotado (`node skills/marketing-research-agent/scripts/research.js --task audit_probe --date 2026-07-30 --topic "teste" --out <tmp>`) e ele rodou as 5 buscas REAIS ("[research] ok: tendencias (5 resultados)" ... "topicos_virais"), gravou `research_raw.json` e saiu 0.
- **Impacto:** O agente le "estado atual do projeto = sem chave", pula o Step 1 e entrega inteligencia SIMULADA (rotulada `_simulated: true`) quando havia pesquisa real disponivel. O deliverable perde valor e a peca sai ancorada em suposicao, nao em mercado.
- **Correcao:** Trocar "(estado atual do projeto)" por "Estado atual: chave CONFIGURADA (`TAVILY_API_KEY` em `interface/.env`) e SDK `@tavily/core` ja instalado (dependencia do `package.json`) — o caminho padrao e busca REAL; o modo simulado e a excecao (ambiente sem a chave exportada)". Ajustar o frontmatter, o Example 2 e o Quality Checklist para tratar simulado como fallback, nao como default.

### 2. [MEDIA]

- **Documento diz:** Nota "Dois caminhos de execucao" (linha 65): "O **pipeline executavel** (`pipeline/agents.js`) e o **painel** (`interface/lib/research.js`) seguem um caminho mais enxuto: gravam um advisory `research/insights.md` e o painel roda **3 buscas** (nao 5) para enriquecer o prompt de geracao."
- **Realidade:** Sao dois comportamentos diferentes, e o texto mistura os dois. (a) Quem grava `research/insights.md` e SO o pipeline: `pipeline/agents.js:121` (`content.writeContentFile(folder, "research/insights.md", ...)`), e o proprio arquivo se declara "Gerado pelo pipeline em modo advisory (sem Tavily/fontes externas)" — ou seja, o pipeline NAO usa Tavily de forma alguma. (b) O painel nao grava arquivo nenhum de pesquisa: `interface/routes/generate.js:86-95` chama `researchLib.marketIntel(topic)` e injeta os achados no prompt (`interface/lib/prompts.js:129-133`), devolvendo `research_used` e `research_sources` na resposta da API. As 3 buscas do painel estao em `interface/lib/research.js:63-67` (tendencias, mercado, ad_hooks) — esse numero o documento acertou.
- **Impacto:** Quem le acha que o pipeline faz pesquisa ao vivo (nao faz) e procura um `research/insights.md` gerado pelo painel que nunca existe. Leva a diagnostico errado quando a pesquisa "nao aparece" no painel.
- **Correcao:** Reescrever a nota separando os caminhos: "`pipeline/agents.js` (research_agent) e ADVISORY DETERMINISTICO — nao usa Tavily — e grava `research/insights.md`. O painel (`interface/lib/research.js`) roda 3 buscas Tavily ao vivo (opt-in por geracao) e NAO grava arquivo: os achados entram no prompt de geracao e as fontes voltam na resposta (`research_sources`)." Vale acrescentar que o painel ja MASCARA nomes de concorrentes de forma deterministica antes de mandar ao prompt (`interface/lib/research.js:74-75`).

### 3. [MEDIA]

- **Documento diz:** "**Busca real** requer `TAVILY_API_KEY` no ambiente" e o Troubleshooting: "Cannot find module '@tavily/core' — **Solution:** `npm i @tavily/core`" / "`npm i @tavily/core` + setar `TAVILY_API_KEY` para busca real". O documento so conhece a variavel de ambiente como lugar da chave.
- **Realidade:** Existem dois mecanismos de chave, e eles nao se enxergam. O script empacotado le SOMENTE a variavel de ambiente (`skills/marketing-research-agent/scripts/research.js:32`, `const key = process.env.TAVILY_API_KEY;`). O painel resolve a chave em 3 fontes (`interface/lib/research.js:41-43`): `process.env.TAVILY_API_KEY || dataFileKey() || envFileVar("TAVILY_API_KEY")`, sendo `dataFileKey()` o arquivo `interface/data/tavily.json`, onde a tela de Configuracoes grava (`saveKey`, linhas 99-106). O SDK, alem disso, ja e dependencia do projeto (`package.json:20`), entao o `npm i` do Troubleshooting nao se aplica mais ao caso normal.
- **Impacto:** Se a chave foi colada no painel (Configuracoes -> `interface/data/tavily.json`) e nao exportada no shell, o comando do Step 1 imprime "TAVILY_API_KEY ausente" e o agente cai em modo simulado achando que o projeto nao tem chave — quando tem. Diagnostico falso, pesquisa real perdida.
- **Correcao:** Documentar as duas casas da chave e a assimetria: "a chave pode estar em (1) `TAVILY_API_KEY` no ambiente/`interface/.env` — usada pelo script da skill e pelo painel — ou (2) `interface/data/tavily.json`, gravada pela tela de Configuracoes do painel, que o script empacotado NAO le. Antes de concluir 'sem chave', conferir `interface/.env` e `interface/data/tavily.json`." No Troubleshooting, trocar `npm i @tavily/core` por "o SDK ja e dependencia do `package.json`; se faltar, rode `npm install` na raiz".

### 4. [MEDIA]

- **Documento diz:** A secao "Brand Guardrails (4Selet)" lista as regras duras (concorrentes, numeros da Taxa Zero, audiencia, tom, rotulo de simulado) e NAO menciona a frase-tag "Para quem sabe que e Selet." em lugar nenhum do documento.
- **Realidade:** Hoje existe regra dura em codigo proibindo essa frase-tag: `interface/lib/prompts.js:16` — "NUNCA use a frase-tag 'Para quem sabe que e Selet.' como rodape, fecho ou assinatura automatica de peca (headline, body de slide, legenda ou cena de video). NAO assine as pecas com ela. So use uma frase-tag da marca se o brief pedir explicitamente." E o unico exemplo canonico do contrato desta skill no repo ja viola a regra: `skills/ad-creative-designer/examples/research_results.json` traz em `ad_hooks` o item "0% por 3 meses. Para quem sabe que e Selet.".
- **Impacto:** `ad_hooks` e `selected_campaign_angle` sao exatamente os campos que descem para ad/video/copy. Um hook de pesquisa carregando a tagline reintroduz, pela porta dos fundos, a assinatura que o painel bloqueia no prompt — inconsistencia entre o que a skill entrega e o que o produto aceita.
- **Correcao:** Adicionar em Brand Guardrails: "Frase-tag 'Para quem sabe que e Selet.' NAO entra em `ad_hooks`, `marketing_angles`, `content_topics` nem `selected_campaign_angle` — regra dura vigente (`interface/lib/prompts.js`, GOVERNANCE); so aparece se o brief pedir explicitamente." E corrigir o `ad_hooks` do fixture `skills/ad-creative-designer/examples/research_results.json`, que hoje serve de modelo errado.

### 5. [BAIXA]

- **Documento diz:** O contrato downstream ("Relacionamento com outras skills") descreve o consumo por 3 skills criativas (ad-creative-designer, video-ad-specialist, copywriter-agent) e os campos de sintese do Step 2 (`content_topics`, `video_concepts` etc.), sem nenhuma referencia as taxonomias operacionais do painel.
- **Realidade:** O painel — hoje o caminho principal de operacao (CLAUDE.md) — trabalha com 7 tipos de conteudo em `interface/lib/config.js` (`instagram_caption`, `instagram_carousel`, `ad_creative`, `media_mention` na linha 180, `video_idea`, `linkedin_post`, `threads_post`) e 6 pilares de conteudo (`taxa_zero`, `educacional`, `curiosidade_mercado`, `prova_plataforma`, `novidade`, `motivacional`, linhas 55-95). A pesquisa ao vivo entra em QUALQUER um desses tipos (`interface/routes/generate.js:86-95` roda antes do `generationPrompt`, sem filtro por tipo), inclusive no `media_mention`, que tem bloco proprio de prompt (`interface/lib/prompts.js:124-128`). Nenhum arquivo em `skills/` cita pilar/pillar (grep sem resultado).
- **Impacto:** A inteligencia sai organizada num vocabulario (content_topics soltos) que nao conversa com o eixo tematico real do feed nem com o tipo "4Selet na Midia", entao ela nao pluga direto na operacao do painel — o operador precisa traduzir na mao.
- **Correcao:** Acrescentar uma nota curta de mapeamento: "No painel, o consumo e por TIPO (`instagram_caption`, `instagram_carousel`, `ad_creative`, `media_mention` = 4Selet na Midia, `video_idea`, `linkedin_post`, `threads_post`) e por PILAR (`taxa_zero`, `educacional`, `curiosidade_mercado`, `prova_plataforma`, `novidade`, `motivacional`) — ver `interface/lib/config.js`. Etiquete cada `content_topic` com o pilar correspondente e inclua angulos de prova externa/imprensa, que alimentam o tipo `media_mention`."

