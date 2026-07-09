// lib/prompts.js — prompts de criacao PADRAO por tipo de conteudo + assistente de
// ajuda. O system prompt injeta os knowledge files; o user prompt fixa o schema
// de saida (estrutura padrao) que o back valida.
"use strict";
const { brandContext } = require("./knowledge");
const { contentTypeById, pillarById, HASHTAG_RULES } = require("./config");

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
  "eyebrow": "rotulo curto da capa (ex.: tema/pilar)",
  "slides": [
    { "title": "titulo curto (use ==palavra== p/ realcar palavra em azul sublinhado)", "body": "texto de apoio (opcional)", "layout": "cover|stat_grid|list|text|flow|cta (opcional — inferido pela posicao/conteudo se ausente)", "image": "/uploads/... (SO na capa 'cover': foto de fundo do acervo)", "titleOffsetY": "numero, SO na capa: desloca o titulo N px na vertical (negativo sobe, ex.: -50)", "titleOffsetX": "numero, SO capa: desloca o titulo N px na horizontal", "titleScale": "numero, SO capa: escala do titulo (1 = normal, 1.3 = 30% maior)", "theme": "dark|light — SO em slide de FRASE (layout text): light = editorial claro (fundo Cloud, texto escuro, marca d'agua) — use p/ intercalar 1-2 slides claros no meio dos escuros e dar variedade/respiro", "watermark": "marca d'agua do slide: string (palavra) OU objeto {text, style} — style: word|outline|symbol|none (padrao word 'SELET')", "items": ["item de lista"], "stats": [{ "value": "95%", "label": "rotulo" }], "orient": "row (SO no layout flow: icones em linha + setas)", "tone": "muted|accent (SO no flow: cinza+alerta x azul+escudo)", "flow": [{ "label": "ROTULO CURTO", "sub": "detalhe opcional", "icon": "cart|bank|person|shield|alert|lock|wallet|check|money|clock", "mark": true }], "note": "frase da caixa de callout ao pe do flow (opcional)" }
  ],  // 4-7 slides com VARIEDADE de layout: capa (gancho, pode ter foto no campo image) -> desenvolvimento (stat_grid p/ numeros; list p/ enumeracao; flow p/ diagrama de etapas com icones — use orient:"row" e um icon por no; text p/ frase forte) -> CTA. Escolha o layout que melhor comunica; nem todo slide precisa de items/stats/flow.
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
  const pillar = pillarById(req.pillar);
  if (pillar) {
    lines.push("PILAR DE CONTEUDO: " + pillar.label + " — " + pillar.description);
    lines.push("Angulo do pilar (define o TEMA desta peca, vale para este formato): " + pillar.angle);
    lines.push("Mantenha a variedade real do feed 4Selet: NEM toda peca e sobre Taxa Zero. Respeite o pilar acima como eixo tematico, ainda que a campanha ativa exista.");
    lines.push("");
  }
  lines.push("BRIEF DA PECA (campos preenchidos pelo usuario):");
  lines.push("- Tema/objetivo: " + req.brief);
  if (pillar) lines.push("- Pilar de conteudo: " + pillar.label);
  if (req.platforms && req.platforms.length) lines.push("- Plataforma(s): " + req.platforms.join(", "));
  if (req.tone) lines.push("- Tom desejado: " + req.tone);
  if (req.key_offer) lines.push("- Oferta/numero a destacar: " + req.key_offer);
  if (req.mood) lines.push("- Referencia visual/mood (clima e estilo a evocar, sempre dentro da marca): " + req.mood);
  if (req.extra) lines.push("- Observacoes extras: " + req.extra);
  if (req.cta) lines.push("- Chamada para acao (CTA): use EXATAMENTE \"" + req.cta + "\" como CTA — coloque no campo cta do JSON e, quando fizer sentido, como fechamento natural do texto.");
  else lines.push("- SEM CTA forcado: NAO use chamadas de conversao (ex.: 'Solicitar convite', 'Ver as condicoes'). Deixe o campo cta do JSON vazio (\"\") e encerre o texto de forma natural, no maximo um fechamento suave de relacionamento.");
  lines.push("");
  if (req.research && Array.isArray(req.research.findings) && req.research.findings.length) {
    lines.push("INTELIGENCIA DE MERCADO (pesquisa AO VIVO via Tavily — use como apoio factual e de atualidade; NAO copie literalmente: sintetize, valide contra os knowledge files e mantenha a voz/regras da marca 4Selet):");
    req.research.findings.slice(0, 12).forEach((f) => lines.push("- " + f));
    lines.push("");
  }
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
  const pillar = pillarById(req.pillar);
  if (pillar) {
    lines.push("PILAR DE CONTEUDO desta peca (eixo tematico — preserve, a menos que a orientacao peca para mudar): " + pillar.label + " — " + pillar.angle);
    lines.push("");
  }
  lines.push("CONTEUDO ATUAL (base — preserve tudo que a orientacao NAO pedir para mudar):");
  lines.push(String(req.current || "(vazio)"));
  lines.push("");
  lines.push("ORIENTACAO DE AJUSTE DO USUARIO:");
  lines.push(String(req.instruction || ""));
  lines.push("");
  if (Array.isArray(req.images) && req.images.length) {
    lines.push("IMAGEM(NS) DE REFERENCIA ANEXADA(S) (" + req.images.length + "): voce CONSEGUE ve-la(s). Use como INSPIRACAO de layout/estrutura/estilo — ex.: se mostra um fluxo com icones, adote layout \"flow\" com \"orient\":\"row\" e um \"icon\" adequado por no; se mostra grade de numeros, use \"stat_grid\". NAO copie texto nem marcas de terceiros da imagem; mantenha a identidade e as regras da 4Selet.");
    lines.push("");
  }
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
// Amostras por pilar para os tipos mais visiveis, garantindo que a variedade
// TEMATICA apareca mesmo sem chave (nao so Taxa Zero). Quando o pilar nao tem
// amostra propria, cai no comportamento Taxa Zero padrao.
const PILLAR_SIM = {
  educacional: {
    eyebrow: "Educacional",
    caption: "Antes de escalar trafego, conheca seus 4 numeros: taxa por transacao, prazo de recebimento, aprovacao do cartao e custo de suporte. E a soma deles que define a margem — nao a taxa percentual isolada.\n\nSalva esse post pro proximo planejamento. ▸",
    hashtags: ["#4Selet", "#NegocioDigital", "#GestaoFinanceira"],
    cta: "Acessar o material",
    headline: "Os 4 numeros",
    subtext: "O que todo produtor estabelecido deveria medir antes de escalar.",
    badge: "Playbook",
    threads: "Antes de escalar trafego, olhe seus 4 numeros: taxa por transacao, prazo de recebimento, aprovacao do cartao e custo de suporte. A margem mora na soma deles — nao no percentual isolado do checkout. Qual desses voce nunca mediu?",
    linkedin: "A maioria dos produtores escolhe plataforma pela taxa percentual. E o numero errado para otimizar.\n\nRentabilidade real e a soma de quatro variaveis: taxa por transacao, prazo de recebimento, taxa de aprovacao do gateway e custo de suporte. Cortar uma e perder nas outras tres e prejuizo disfarcado de economia.\n\nO exercicio que recomendo antes de qualquer migracao: modele os quatro numeros lado a lado, com volume real de vendas. O ranking de plataformas quase sempre muda quando a conta sai do percentual e entra na margem liquida.\n\nNa 4Selet esses quatro numeros foram desenhados como operacao, nao como promessa: 95%+ de aprovacao no cartao, PIX em D+10 e gestor de conta dedicado.",
    notes: "Pilar educacional: ensina, nao vende.",
  },
  curiosidade_mercado: {
    eyebrow: "Curiosidade de mercado",
    caption: "Curiosidade: no parcelado em 12x, o juro embutido pode comer mais margem do que a propria taxa da plataforma. A maioria so olha o percentual do checkout.\n\nVoce ja calculou quanto o 12x custa de verdade? ▸",
    hashtags: ["#4Selet", "#Checkout"],
    cta: "Ver como funciona",
    headline: "O custo invisivel",
    subtext: "O juro do parcelado pesa mais que a taxa do checkout.",
    badge: "Voce sabia?",
    threads: "Curiosidade: no parcelado em 12x, o juro embutido costuma comer mais margem do que a taxa da plataforma. Quase todo mundo olha so o percentual do checkout. Voce ja calculou quanto o 12x custa de verdade na sua operacao?",
    linkedin: "Existe um custo que quase nenhum produtor coloca na planilha: o juro do parcelado em 12x.\n\nA conversa do mercado gira em torno da taxa do checkout — 6%, 7%, 8%. Mas quando a venda e parcelada em 12x, o juro embutido pode pesar mais na margem do que a propria taxa da plataforma. O percentual do checkout vira apenas a parte visivel de um custo bem maior.\n\nNao se trata de evitar o 12x — ele converte e amplia ticket. Trata-se de precificar com consciencia de onde a margem realmente vaza, e de repassar (ou nao) com criterio.\n\nNa 4Selet o modelo de ofertas flexiveis existe justamente para que essa decisao seja estrategica, e nao automatica.",
    notes: "Pilar curiosidade: dado pouco obvio, mercado em abstrato.",
  },
  prova_plataforma: {
    eyebrow: "Prova da plataforma",
    caption: "95% de aprovacao no cartao nao e meta — e o padrao de operacao na 4Selet. Some PIX em D+10, gestor de conta dedicado e redundancia inteligente.\n\nMenos venda perdida, mais margem que fica. ▸",
    hashtags: ["#4Selet", "#Aprovacao", "#PlataformaDePagamentos"],
    cta: "Conhecer a plataforma",
    headline: "95% aprovados",
    subtext: "A prova esta na taxa de aprovacao, no prazo e no suporte.",
    badge: "Prova",
    threads: "95% de aprovacao no cartao nao e meta de campanha — e o padrao de operacao. Some PIX em D+10 e gestor de conta dedicado: menos venda perdida na aprovacao, mais margem que fica. Qual e a sua taxa de aprovacao hoje?",
    linkedin: "Taxa de aprovacao no cartao e a metrica que mais silenciosamente derruba faturamento — e a que menos gente acompanha.\n\nA diferenca entre 78% e 95% de aprovacao nao aparece no relatorio de taxas. Aparece nas vendas que simplesmente nao acontecem. Em volume, sao dezenas de milhares de reais por mes que evaporam antes de virarem receita.\n\nNa 4Selet, 95%+ de aprovacao e o padrao de operacao, sustentado por redundancia inteligente entre adquirentes. Some PIX em D+10, cartao em D+30 e um gestor de conta que conhece a sua operacao pelo nome.\n\nMenos venda perdida na borda. Mais margem que chega ao caixa.",
    notes: "Pilar prova: diferenciais verificaveis dos 9 oficiais.",
  },
  novidade: {
    eyebrow: "Novidade",
    caption: "O mercado de checkout esta mudando o jogo da previsibilidade de recebimento. A 4Selet ja opera com PIX em D+10 e cartao em D+30 — prazo que voce planeja.\n\nO que muda na sua operacao quando o caixa fica previsivel? ▸",
    hashtags: ["#4Selet", "#Novidade"],
    cta: "Ver como funciona",
    headline: "Caixa previsivel",
    subtext: "PIX D+10 e cartao D+30: o prazo entra no seu planejamento.",
    badge: "Novidade",
    threads: "O jogo da previsibilidade de recebimento esta mudando. A 4Selet ja opera com PIX em D+10 e cartao em D+30 — prazo que entra direto no planejamento. O que muda na sua operacao quando o caixa fica previsivel?",
    linkedin: "Previsibilidade de caixa deixou de ser detalhe operacional e virou vantagem competitiva no digital.\n\nQuem planeja trafego, equipe e estoque com base em quando o dinheiro realmente entra opera com uma folga que o concorrente nao tem. O problema e que prazo de recebimento costuma ser a ultima coisa que o produtor olha ao escolher plataforma — e a primeira que aperta quando a operacao cresce.\n\nA 4Selet trabalha com PIX em D+10 e cartao em D+30: prazos que entram no seu planejamento sem surpresa. Recebimento previsivel nao acelera so o caixa — acelera a decisao.\n\nQuando voce sabe quando o dinheiro chega, voce escala com menos medo.",
    notes: "Pilar novidade: movimento de mercado + leitura da 4Selet.",
  },
  motivacional: {
    eyebrow: "Motivacional",
    caption: "Produtor nao e numero. E parceiro. E parceiro vende junto.\n\nQuem opera com seriedade no digital nao escolhe plataforma pela menor taxa do mes — escolhe pela parceria que sustenta a operacao no ano. ▸",
    hashtags: ["#4Selet", "#ProdutorDigital"],
    cta: "Falar com o time",
    headline: "Decisoes melhores",
    subtext: "Quem ja performa escolhe parceria, nao desconto do mes.",
    badge: "Estrategia",
    threads: "Produtor nao e numero. E parceiro. Quem opera com seriedade no digital nao troca de plataforma pela menor taxa do mes — escolhe a parceria que sustenta a operacao no ano inteiro.",
    linkedin: "Produtor nao e numero. E parceiro. E parceiro vende junto.\n\nNo digital serio, a escolha de plataforma deixou de ser uma decisao de custo para virar uma decisao de parceria. A menor taxa do mes nao sustenta uma operacao que precisa de aprovacao alta, recebimento previsivel e suporte que entende o negocio.\n\nQuem ja performa entende a diferenca entre economizar no percentual e ganhar no ano. Entre um fornecedor que apenas processa transacao e um parceiro que divide o objetivo de vender mais.\n\nNa 4Selet o acesso e por convite — porque parceria de verdade se constroi com quem leva a operacao a serio. A escolha de quem ja performa.",
    notes: "Pilar motivacional: mentalidade ancorada em raciocinio concreto.",
  },
};

function simulate(req) {
  const tag = " (SIMULADO — configure a chave Anthropic)";
  const offer = req.key_offer || "0% de taxa por 3 meses";
  const p = (req.pillar && req.pillar !== "taxa_zero") ? PILLAR_SIM[req.pillar] : null;
  switch (req.content_type) {
    case "instagram_caption":
      if (p) return JSON.stringify({ body: p.caption, hashtags: p.hashtags, cta: p.cta, notes: p.notes + tag }, null, 2);
      return JSON.stringify({
        body: offer + ". R$ 1,99 por transacao. PIX em D+10.\n\nA 4Selet abriu um corredor para produtores estabelecidos migrarem sem perder margem. Acesso por convite. →",
        hashtags: ["#4Selet", "#TaxaZero", "#PlataformaDePagamentos", "#ProdutorDigital"],
        cta: "Solicitar convite",
        notes: "Ancorado em Taxa Zero + exclusividade por convite." + tag,
      }, null, 2);
    case "instagram_carousel":
      if (p) return JSON.stringify({
        eyebrow: p.eyebrow,
        slides: [
          { layout: "cover", title: p.headline, body: p.subtext },
          { layout: "stat_grid", title: "Os numeros que sustentam", stats: [
            { value: "95%", label: "aprovacao no cartao" },
            { value: "D+10", label: "PIX na sua conta" },
            { value: "D+30", label: "cartao na sua conta" },
            { value: "R$ 1,99", label: "fixo por transacao" },
          ] },
          { layout: "list", title: "Por que isso importa", items: [
            "Menos venda perdida na aprovacao",
            "Caixa previsivel para planejar o mes",
            "Gestor de conta dedicado de verdade",
          ] },
          { layout: "text", title: "Na pratica", body: p.caption.split("\n")[0] },
          { layout: "cta", title: p.cta, body: "Para quem sabe que e Selet." },
        ],
        caption: p.caption,
        hashtags: p.hashtags,
        cta: p.cta,
        notes: p.notes + " Layouts variados (capa, grade, lista, CTA)." + tag,
      }, null, 2);
      return JSON.stringify({
        eyebrow: "Campanha Taxa Zero",
        slides: [
          { layout: "cover", title: "Para quem sabe que e Selet", body: "O que muda quando a plataforma trabalha a favor da sua margem." },
          { layout: "stat_grid", title: "A oferta em numeros", stats: [
            { value: "0%", label: "de taxa por 3 meses" },
            { value: "R$ 1,99", label: "fixo por transacao" },
            { value: "D+10", label: "PIX na sua conta" },
            { value: "95%", label: "aprovacao no cartao" },
          ] },
          { layout: "list", title: "O que entra na conta", items: [
            "0% por 3 meses ou ate R$ 300 mil em vendas",
            "Cartao em D+30, sem surpresa no prazo",
            "Gestor de conta dedicado para a sua operacao",
          ] },
          { layout: "cta", title: "Acesso por convite", body: "Solicitar convite." },
        ],
        caption: "Migrar de plataforma sem perder margem. " + offer + ".",
        hashtags: ["#4Selet", "#TaxaZero", "#NegocioDigital"],
        cta: "Solicitar convite",
        notes: "Capa -> grade de numeros -> lista -> CTA (layouts variados)." + tag,
      }, null, 2);
    case "threads_post":
      if (p) return JSON.stringify({ body: p.threads || p.caption.split("\n\n")[0], hashtags: [p.hashtags[0]], notes: p.notes + " Provocacao platform-native (<=500 chars, 1 hashtag)." + tag }, null, 2);
      return JSON.stringify({
        body: "Taxa de mercado em torno de 7,9% e so parte da conta. O que define sua margem e aprovacao do cartao: 78% ou 95%?",
        hashtags: ["#4Selet"],
        notes: "Provocacao com dado, sem citar concorrente." + tag,
      }, null, 2);
    case "linkedin_post":
      if (p) return JSON.stringify({
        body: p.linkedin || (p.subtext + "\n\n" + p.caption.replace(/\n+/g, " ") + "\n\nNa 4Selet isso vira operacao: 95%+ de aprovacao, PIX D+10 e gestor de conta dedicado. A escolha de quem ja performa."),
        hashtags: p.hashtags.concat(["#DigitalSerio"]).slice(0, 5),
        cta: p.cta,
        notes: p.notes + " Editorial premium platform-native." + tag,
      }, null, 2);
      return JSON.stringify({
        body: "O produtor que olha apenas a taxa percentual esta olhando para o lugar errado.\n\nRentabilidade real e a soma de quatro variaveis: taxa por transacao, prazo de recebimento, taxa de aprovacao do gateway e custo de suporte. Reduzir uma e perder nas outras tres e prejuizo disfarcado de economia.\n\nNa 4Selet o cartao aprova 95%+, o PIX cai em D+10 e o suporte tem gestor de conta dedicado. " + offer + " para quem migra agora.\n\nAcesso por convite. A escolha de quem ja performa.",
        hashtags: ["#4Selet", "#TaxaZero", "#DigitalSerio"],
        cta: "Falar com o time",
        notes: "Editorial premium ancorado nos 4 numeros." + tag,
      }, null, 2);
    case "ad_creative":
      if (p) return JSON.stringify({
        headline: p.headline,
        subtext: p.subtext,
        cta: p.cta,
        layout_type: "Split",
        badge: p.badge,
        visual_direction: "Fundo Selet Navy com gradiente radial; headline Inter Black branco; Selet Dots; numero/dado em destaque Selet Blue.",
        notes: p.notes + tag,
      }, null, 2);
      return JSON.stringify({
        headline: "Zero taxa. Tres meses.",
        subtext: "Migre sua operacao para quem trata pagamento como operacao seria.",
        cta: "Ver as condicoes",
        layout_type: "Split",
        visual_direction: "Fundo Selet Navy com gradiente radial sutil; headline em Inter Black branco; Selet Dots no canto; numero 0% em destaque Selet Blue.",
        notes: "Headline <=4 palavras, paleta azul, CTA aprovado." + tag,
      }, null, 2);
    case "video_idea":
      if (p) return JSON.stringify({
        concept: p.subtext,
        hook: "Tela escura, " + p.headline + " surge em destaque. Voz sobria.",
        emotional_arc: "Curiosidade -> raciocinio concreto -> conviccao.",
        visual_style: "Editorial sobrio azul, Inter, motion contido, Selet Dots.",
        scenes: [
          { type: "hook", text: p.headline, subtitle: p.subtext, visual: "numero/dado grande em fundo Navy" },
          { type: "benefit", text: "Por que importa", subtitle: p.caption.split("\n")[0], visual: "destaque do dado" },
          { type: "cta", text: "Para quem sabe que e Selet.", subtitle: p.cta, visual: "logo light em Navy + CTA" },
        ],
        cta: p.cta,
        notes: p.notes + tag,
      }, null, 2);
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
