// lib/prompts.js — prompts de criacao PADRAO por tipo de conteudo + assistente de
// ajuda. O system prompt injeta os knowledge files; o user prompt fixa o schema
// de saida (estrutura padrao) que o back valida.
"use strict";
const { brandContext } = require("./knowledge");
const { contentTypeById, HASHTAG_RULES } = require("./config");

const GOVERNANCE = `REGRAS DURAS (brand governance 4Selet) — cumpra TODAS:
- Paleta azul oficial; nunca branco puro nem preto puro; sem neon.
- Tipografia Inter (JetBrains Mono so para snippets tecnicos).
- Tom: socio experiente e sobrio. Estruturado, factual, com numeros/prazos concretos. Nunca motivacional vazio nem promessa magica.
- NUNCA cite concorrentes por nome (Greenn, Hubla, Kiwify, Hotmart, Eduzz, Ticto, Cakto, Monetizze, Perfect Pay). Fale do "mercado" em abstrato.
- Emojis: no maximo 1 funcional em captions/threads (-> ▸ • permitidos); proibido em headline/body de ad. Banidos: fogo, raio, foguete, dinheiro, etc.
- CTAs aprovados (use estes ou variacoes): Solicitar convite, Ver as condicoes, Conhecer a plataforma, Migrar minha operacao, Calcular minha economia, Falar com o time, Ver como funciona. Sem urgencia fake.
- Campanha ativa Taxa Zero: 0% por 3 meses ou ate R$ 300 mil, R$ 1,99/transacao, PIX D+10, cartao D+30. 95% de aprovacao no cartao. Acesso por convite ("Para quem sabe que e Selet.").`;

const SCHEMAS = {
  instagram_caption: `{
  "body": "texto da caption (hook factual com numero -> beneficio -> CTA)",
  "hashtags": ["#4Selet", "#TaxaZero", "..."],  // ${HASHTAG_RULES.min}-${HASHTAG_RULES.max} hashtags, incluir #4Selet
  "cta": "CTA aprovado",
  "notes": "1-2 frases: quais regras de marca/numeros voce ancorou"
}`,
  instagram_carousel: `{
  "slides": [
    { "title": "titulo curto do slide", "body": "texto de apoio do slide" }
  ],  // 4-7 slides: capa (gancho) -> desenvolvimento -> slide final com CTA
  "caption": "caption que acompanha o post",
  "hashtags": ["#4Selet", "..."],
  "cta": "CTA aprovado",
  "notes": "1-2 frases de racional de marca"
}`,
  threads_post: `{
  "body": "post <=500 caracteres, provocacao controlada com dado especifico",
  "hashtags": ["#4Selet"],  // 0-1 hashtag
  "notes": "1-2 frases de racional"
}`,
  linkedin_post: `{
  "body": "post editorial 1.200-1.500 caracteres: tese -> dados -> CTA suave",
  "hashtags": ["#4Selet", "..."],  // 3-5 hashtags
  "cta": "CTA aprovado",
  "notes": "1-2 frases de racional"
}`,
  ad_creative: `{
  "headline": "headline <=4 palavras",
  "subtext": "subtexto de apoio (1-2 linhas)",
  "cta": "CTA aprovado",
  "layout_type": "Product Focus | Split | Lifestyle",
  "visual_direction": "direcao visual concreta (fundo, cor da paleta, uso de Selet Dots, hierarquia)",
  "notes": "1-2 frases de racional de marca"
}`,
  video_idea: `{
  "concept": "1 frase resumindo o conceito do video",
  "hook": "fala/visual dos primeiros 3 segundos",
  "emotional_arc": "arco em 1 frase (ex.: tensao do problema -> alivio da solucao)",
  "visual_style": "estilo visual (editorial sobrio azul, tipografia, motion)",
  "scenes": [
    { "type": "hook|product|benefit|cta", "text": "headline on-screen da cena (curta, <=6 palavras)", "subtitle": "1 linha curta de apoio VISIVEL ao espectador (opcional)", "visual": "DIRECAO DE ARTE (nao aparece na tela): fundo, cor, motion" }
  ],
  "cta": "CTA aprovado",
  "notes": "1-2 frases de racional"
}`,
};

function systemPrompt() {
  return [
    "Voce e o time de marketing da 4Selet — copywriter e diretor criativo seniores.",
    "Gere conteudo de marketing 100% alinhado a marca 4Selet, pronto para publicacao.",
    "",
    GOVERNANCE,
    "",
    "Use EXCLUSIVAMENTE os knowledge files oficiais abaixo como fonte de verdade da marca:",
    "",
    brandContext(),
  ].join("\n");
}

// Monta o prompt de geracao a partir do formulario + contexto de campanha.
// req: { content_type, brief, platforms, tone?, key_offer?, extra?, campaign? }
function generationPrompt(req) {
  const ct = contentTypeById(req.content_type);
  const schema = SCHEMAS[req.content_type] || `{ "body": "...", "notes": "..." }`;
  const lines = [];
  lines.push("TAREFA: gerar **" + (ct ? ct.label : req.content_type) + "**.");
  if (ct) lines.push("Definicao do formato: " + ct.description);
  lines.push("");
  if (req.campaign) {
    lines.push("CAMPANHA: " + req.campaign.name);
    if (req.campaign.objective) lines.push("Objetivo da campanha: " + req.campaign.objective);
    if (req.campaign.angle) lines.push("Angulo: " + req.campaign.angle);
    if (req.campaign.pillar) lines.push("Pilar estrategico: " + req.campaign.pillar);
    if (req.campaign.key_messages && req.campaign.key_messages.length) {
      lines.push("Mensagens-chave: " + req.campaign.key_messages.join(" | "));
    }
    lines.push("");
  }
  lines.push("BRIEF DA PECA (campos preenchidos pelo usuario):");
  lines.push("- Tema/objetivo: " + req.brief);
  if (req.platforms && req.platforms.length) lines.push("- Plataforma(s): " + req.platforms.join(", "));
  if (req.tone) lines.push("- Tom desejado: " + req.tone);
  if (req.key_offer) lines.push("- Oferta/numero a destacar: " + req.key_offer);
  if (req.mood) lines.push("- Referencia visual/mood (clima e estilo a evocar, sempre dentro da marca): " + req.mood);
  if (req.extra) lines.push("- Observacoes extras: " + req.extra);
  lines.push("");
  lines.push("FORMATO DE SAIDA — responda APENAS com um objeto JSON valido, sem texto fora do JSON, neste schema:");
  lines.push(schema);
  return lines.join("\n");
}

// Monta o prompt de AJUSTE/refinamento de uma peca ja gerada.
// req: { content_type, current (string JSON ou texto), instruction, campaign? }
function refinementPrompt(req) {
  const ct = contentTypeById(req.content_type);
  const schema = SCHEMAS[req.content_type] || `{ "body": "...", "notes": "..." }`;
  const lines = [];
  lines.push("TAREFA: AJUSTAR uma peca ja existente de **" + (ct ? ct.label : req.content_type) + "** seguindo a orientacao do usuario.");
  if (ct) lines.push("Formato: " + ct.description);
  lines.push("");
  if (req.campaign) {
    lines.push("CAMPANHA: " + req.campaign.name + (req.campaign.angle ? " — angulo: " + req.campaign.angle : ""));
    lines.push("");
  }
  lines.push("CONTEUDO ATUAL (base — preserve tudo que a orientacao NAO pedir para mudar):");
  lines.push(String(req.current || "(vazio)"));
  lines.push("");
  lines.push("ORIENTACAO DE AJUSTE DO USUARIO:");
  lines.push(String(req.instruction || ""));
  lines.push("");
  lines.push("Aplique SOMENTE o ajuste pedido (mais correcoes de marca, se necessario). Mantenha tom, estrutura e os campos nao mencionados. Continue cumprindo TODAS as regras de marca.");
  lines.push("");
  lines.push("FORMATO DE SAIDA — responda APENAS com um objeto JSON valido, sem texto fora do JSON, neste schema:");
  lines.push(schema);
  return lines.join("\n");
}

// Assistente de ajuda (como usar a ferramenta + sugestoes de marca).
function assistantSystem() {
  return [
    "Voce e o assistente do Painel 4Selet — ajuda a equipe de marketing a usar a ferramenta e a criar melhores conteudos para a marca 4Selet.",
    "Seja direto, pratico e sobrio (no tom da propria marca). Responda em portugues do Brasil.",
    "Voce conhece o fluxo do painel: (1) criar/abrir uma Campanha, (2) criar Conteudo preenchendo o brief e gerando com IA, (3) revisar o preview e aprovar.",
    "Ao sugerir conteudo, siga sempre as regras de marca abaixo.",
    "",
    GOVERNANCE,
  ].join("\n");
}

// ---- Simuladores (fallback sem chave) — rotulados ------------------------
function simulate(req) {
  const tag = " (SIMULADO — configure a chave Anthropic)";
  const offer = req.key_offer || "0% de taxa por 3 meses";
  switch (req.content_type) {
    case "instagram_caption":
      return JSON.stringify({
        body: offer + ". R$ 1,99 por transacao. PIX em D+10.\n\nA 4Selet abriu um corredor para produtores estabelecidos migrarem sem perder margem. Acesso por convite. →",
        hashtags: ["#4Selet", "#TaxaZero", "#PlataformaDePagamentos", "#ProdutorDigital"],
        cta: "Solicitar convite",
        notes: "Ancorado em Taxa Zero + exclusividade por convite." + tag,
      }, null, 2);
    case "instagram_carousel":
      return JSON.stringify({
        slides: [
          { title: "Para quem sabe que e Selet", body: "O que muda quando a plataforma trabalha a favor da sua margem." },
          { title: "0% por 3 meses", body: "Ou ate R$ 300 mil em vendas. R$ 1,99 fixo por transacao." },
          { title: "Prazos que voce planeja", body: "PIX em D+10, cartao em D+30. Previsibilidade real." },
          { title: "Acesso por convite", body: "Solicitar convite." },
        ],
        caption: "Migrar de plataforma sem perder margem. " + offer + ".",
        hashtags: ["#4Selet", "#TaxaZero", "#NegocioDigital"],
        cta: "Solicitar convite",
        notes: "Estrutura capa -> prova -> prazo -> CTA." + tag,
      }, null, 2);
    case "threads_post":
      return JSON.stringify({
        body: "Taxa de mercado em torno de 7,9% e so parte da conta. O que define sua margem e aprovacao do cartao: 78% ou 95%?",
        hashtags: ["#4Selet"],
        notes: "Provocacao com dado, sem citar concorrente." + tag,
      }, null, 2);
    case "linkedin_post":
      return JSON.stringify({
        body: "O produtor que olha apenas a taxa percentual esta olhando para o lugar errado.\n\nRentabilidade real e a soma de quatro variaveis: taxa por transacao, prazo de recebimento, taxa de aprovacao do gateway e custo de suporte. Reduzir uma e perder nas outras tres e prejuizo disfarcado de economia.\n\nNa 4Selet o cartao aprova 95%+, o PIX cai em D+10 e o suporte tem gestor de conta dedicado. " + offer + " para quem migra agora.\n\nAcesso por convite. A escolha de quem ja performa.",
        hashtags: ["#4Selet", "#TaxaZero", "#DigitalSerio"],
        cta: "Falar com o time",
        notes: "Editorial premium ancorado nos 4 numeros." + tag,
      }, null, 2);
    case "ad_creative":
      return JSON.stringify({
        headline: "Zero taxa. Tres meses.",
        subtext: "Migre sua operacao para quem trata pagamento como operacao seria.",
        cta: "Ver as condicoes",
        layout_type: "Split",
        visual_direction: "Fundo Selet Navy com gradiente radial sutil; headline em Inter Black branco; Selet Dots no canto; numero 0% em destaque Selet Blue.",
        notes: "Headline <=4 palavras, paleta azul, CTA aprovado." + tag,
      }, null, 2);
    case "video_idea":
      return JSON.stringify({
        concept: "Os 4 numeros que definem a margem do produtor.",
        hook: "Tela escura, um numero aparece: 7,9%. Voz: 'esse nao e o seu problema.'",
        emotional_arc: "Tensao do custo invisivel -> clareza dos 4 numeros -> alivio da solucao.",
        visual_style: "Editorial sobrio azul, tipografia Inter, motion contido, Selet Dots.",
        scenes: [
          { type: "hook", text: "7,9% nao e o seu problema.", subtitle: "O custo invisivel esta nos outros numeros.", visual: "numero grande em fundo Navy" },
          { type: "benefit", text: "95% de aprovacao no cartao.", subtitle: "Mais vendas aprovadas, menos margem perdida.", visual: "comparativo de barras" },
          { type: "benefit", text: "PIX em D+10. " + offer + ".", subtitle: "Previsibilidade real de recebimento.", visual: "linha do tempo de recebimento" },
          { type: "cta", text: "Para quem sabe que e Selet.", subtitle: "Acesso por convite.", visual: "logo light em Navy + CTA" },
        ],
        cta: "Conhecer a plataforma",
        notes: "Conceito 'Os 4 Numeros', schema de cenas." + tag,
      }, null, 2);
    default:
      return JSON.stringify({ body: "Conteudo simulado para " + req.content_type + "." + tag, notes: tag }, null, 2);
  }
}

module.exports = { systemPrompt, generationPrompt, refinementPrompt, assistantSystem, simulate, SCHEMAS };
