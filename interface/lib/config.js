// lib/config.js — caminhos do projeto + constantes oficiais da marca 4Selet.
// Fonte de verdade da marca: ../knowledge/brand_identity.md (espelhado aqui para
// validacao em runtime no back-end).
"use strict";
const path = require("path");

const INTERFACE_DIR = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(INTERFACE_DIR, "..");

const PATHS = {
  INTERFACE_DIR,
  PROJECT_ROOT,
  OUTPUTS_DIR: path.join(PROJECT_ROOT, "outputs"),
  KNOWLEDGE_DIR: path.join(PROJECT_ROOT, "knowledge"),
  SCRIPTS_DIR: path.join(PROJECT_ROOT, "scripts"),
  ASSETS_DIR: path.join(PROJECT_ROOT, "assets"),
  CAMPAIGNS_DIR: path.join(PROJECT_ROOT, "campaigns"),
  COLLECTIONS_DIR: path.join(PROJECT_ROOT, "collections"),
  ENV_FILE: path.join(INTERFACE_DIR, ".env"),
  DATA_DIR: path.join(INTERFACE_DIR, "data"),
  USERS_FILE: path.join(INTERFACE_DIR, "data", "users.json"),
  SESSION_SECRET_FILE: path.join(INTERFACE_DIR, "data", ".session_secret"),
};

// Paleta oficial (brand_identity.md §Color Palette)
const PALETTE = {
  darker: "#07212B",
  navy: "#003554",
  blue: "#006494",
  sky: "#5499B5",
  mist: "#AFBCC9",
  cloud: "#D9DCD6",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
};

// Paletas alternativas POR CAMPANHA. O padrão é e continua sendo a paleta oficial acima: uma
// campanha só sai dela se alguém escolher, e o painel avisa antes que aquilo não é a identidade.
// Existe porque campanha sazonal pede outra cor — "uma campanha de fim de ano, algo vermelhão" —
// sem que isso vire a cara da marca o ano inteiro. Só as quatro cores estruturais mudam; os
// neutros (mist/cloud) e as cores de estado ficam, senão o texto perde contraste.
// darker = fundo mais profundo · navy = fundo dos blocos · blue = acento forte (pílula, bordas)
// sky = acento claro (rótulo, realce da headline).
const PALETAS_CAMPANHA = {
  "": { label: "4Selet (identidade oficial)", cores: null },
  vermelho: { label: "Vermelho de campanha", cores: { darker: "#2B0A0C", navy: "#5A0F16", blue: "#A81D2A", sky: "#E0777F" } },
  dourado: { label: "Dourado", cores: { darker: "#1B1508", navy: "#3D3011", blue: "#9A7A1E", sky: "#D9BC6A" } },
  ambar: { label: "Âmbar sobre preto", cores: { darker: "#0A0A0C", navy: "#1A1A1F", blue: "#C8901A", sky: "#F0C462" } },
  verde: { label: "Verde profundo", cores: { darker: "#07231A", navy: "#0C4032", blue: "#12775C", sky: "#5FBFA1" } },
};
const PALETA_IDS = Object.keys(PALETAS_CAMPANHA).filter(Boolean);

// Plataformas aceitas (alinhado a scripts/orchestrator.js ALLOWED_PLAT)
const ALLOWED_PLATFORMS = [
  "instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "whatsapp", "email",
];

// 5 colunas estrategicas (brand_identity.md §Core Values)
const BRAND_PILLARS = [
  "Experiência", "Lucratividade", "Sabedoria", "Exclusividade", "Segurança",
];

// Pilares de CONTEUDO (eixo TEMATICO da peca) — distinto das 5 colunas
// estrategicas da marca acima. Modela a variedade real do feed @4selet: o
// conteudo NAO e so Taxa Zero. Vale para TODOS os formatos (feed, carrossel,
// ad, video, texto), nao so carrossel. Cada pilar guia o ANGULO/tema da peca;
// `angle` e injetado no prompt de geracao (lib/prompts.js).
const CONTENT_PILLARS = [
  {
    id: "taxa_zero",
    label: "Campanha Taxa Zero",
    short: "Taxa Zero",
    description: "A oferta ativa: 0% por 3 meses, R$ 1,99/transação, PIX D+10. Convite e condições.",
    angle:
      "Foque na campanha Taxa Zero como oferta central: 0% de taxa da plataforma por 3 meses ou até R$ 300 mil em vendas (o que ocorrer primeiro), R$ 1,99 fixo por transação, PIX em D+10 e cartão em D+30. Ancore em exclusividade por convite. Transparência sobre condições (sem letra miúda).",
  },
  {
    id: "educacional",
    label: "Educacional",
    short: "Educacional",
    description: "Ensina um conceito de negócio digital, recomenda livro/playbook, estrutura uma ideia.",
    angle:
      "Ensine algo de valor real ao produtor estabelecido (estratégia, gestão, finanças do negócio digital, recomendação de livro/playbook como 'De Zero a Um'). A marca aparece como autoridade que educa, não como anúncio. Sem empurrar oferta — entregue conhecimento primeiro; CTA suave de relacionamento.",
  },
  {
    id: "curiosidade_mercado",
    label: "Curiosidade de mercado",
    short: "Curiosidade",
    description: "Dado ou curiosidade sobre plataformas de venda, checkout, juros do parcelamento.",
    angle:
      "Traga uma curiosidade ou dado pouco óbvio sobre o mercado de plataformas de venda e checkout (ex.: quanto o juro do parcelamento pesa, custo invisível além da taxa percentual, como a aprovação do cartão muda a margem). Provoque reflexão com número específico. Fale do 'mercado' em abstrato, nunca cite concorrente.",
  },
  {
    id: "prova_plataforma",
    label: "Prova da plataforma",
    short: "Prova",
    description: "Resultados e diferenciais que provam a 4Selet: 95% de aprovação, prazos, gestor de conta.",
    angle:
      "Prove a plataforma com diferenciais concretos: 95%+ de aprovação no cartão, PIX D+10/cartão D+30, gestor de conta dedicado, checkout amigável, redundância inteligente. Use prova-âncora e números verificáveis dos 9 diferenciais oficiais. Tom de quem mostra resultado, não de quem promete.",
  },
  {
    id: "novidade",
    label: "Novidade",
    short: "Novidade",
    description: "Lançamento, atualização da plataforma ou novidade relevante do mercado.",
    angle:
      "Comunique uma novidade: atualização/recurso da plataforma 4Selet ou movimento relevante do mercado que afeta o produtor. Posicione a 4Selet como quem acompanha e antecipa o mercado. Foque no que muda na prática para a operação do produtor.",
  },
  {
    id: "motivacional",
    label: "Motivacional / estratégico",
    short: "Motivacional",
    description: "Mentalidade de produtor sério, decisões melhores, visão estratégica de longo prazo.",
    angle:
      "Mensagem de mentalidade e estratégia para o produtor que opera com seriedade: decisões melhores, foco em margem e parceria de longo prazo, desenvolver o negócio. Sóbrio e estruturado — nunca motivacional vazio nem promessa mágica; ancore a inspiração em um raciocínio concreto.",
  },
];

function pillarById(id) {
  return CONTENT_PILLARS.find((p) => p.id === id) || null;
}

// Concorrentes proibidos em criativos abertos (brand_identity.md). A lista tinha 9 nomes e a
// medição mostrou que ela vazava justamente os que aparecem de verdade nas buscas: HeroSpark,
// Mercado Pago, Loja Integrada, Kirvano e Cielo passaram inteiros, com taxa e tudo. O documento de
// marca fecha a frase com "e qualquer outra plataforma concorrente" — a parte que importa e que
// nunca foi implementável por lista. Por isso a lista agora é maior E existe uma regra ESTRUTURAL
// junto (nome próprio colado a percentual), em lib/validation.js e em lib/research.js.
const BANNED_COMPETITORS = [
  "greenn", "hubla", "kiwify", "hotmart", "eduzz", "ticto", "cakto", "monetizze", "perfect pay", "perfectpay",
  "herospark", "hero spark", "kirvano", "braip", "digital manager guru", "guru", "yampi", "appmax",
  "doppus", "payt", "lastlink", "hero", "voomp", "adoorei", "pepper", "kiwi", "eduzz.com",
  "mercado pago", "mercadopago", "pagseguro", "pagbank", "cielo", "stone", "getnet", "rede",
  "loja integrada", "nuvemshop", "shopify", "wbuy", "tray", "vtex", "kajabi", "teachable", "thinkific",
];

// ---- Pesquisa de mercado (Tavily) ------------------------------------------
// Medido em 2026-08-07: o desenho antigo disparava 3 buscas (6 créditos) em toda geração, uma delas
// com query CONSTANTE que não continha o tema — e era a de maior relevância, o que fazia o material
// mais confiável que chegava ao modelo ser sempre uma tabela de preço de concorrente. Pior: o FAQ
// público de 4selet.com.br entrava no prompt dizendo "7,9% + R$ 2,00 no plano Starter", contra o 0%
// por 3 meses e R$ 1,99 oficiais — a peça podia publicar o preço errado da própria empresa.
//
// O desenho novo: UMA busca por pilar, escrita como MÉTRICA DE SETOR e nunca como preço para o
// vendedor (medido: pergunta de métrica deu 0 concorrente em 8; a mesma família perguntada como
// preço deu 4 em 6, mesmo com todos os filtros ligados).
// ÂNGULOS de pesquisa por pilar, em ordem de aposta. Era um par {principal, alternativa} — e o
// botão "Procurar outro ângulo" ALTERNAVA entre os dois: o segundo clique voltava ao primeiro. Com
// o cache de 6h, voltava instantâneo e idêntico, então parecia que o botão não fazia nada. Pior:
// quando o segundo ângulo vinha vazio, a única saída oferecida era voltar para o de onde se veio.
// Agora é uma FILA — cada clique avança um ângulo, e a tela diz em qual você está.
// AS CONSULTAS VÃO ACENTUADAS, de propósito. Estavam sem acento ("adquirencia", "regulacao",
// "aprovacao") e o efeito foi medido: a imprensa brasileira escreve com acento, o casamento lexical
// falhava, e o que voltava era imprensa estrangeira em inglês. Medição de 24 buscas: 4 fatos
// aproveitáveis em 188 páginas, com 128 cortadas pelo piso de relevância — e os cortados de MAIOR
// score eram FinTech Magazine, Retail Gazette e "UK payments sector". Não era o piso: era o idioma.
//
// Com acento, a mesma pergunta de "prova_plataforma" passou de 1 para 2 acima do piso e trouxe o
// Valor com 0,785. Com acento + imprensa brasileira (RESEARCH_INCLUDE_DOMAINS), foi para 4 — e
// "educacional" saiu de 0 para 6, com o score médio subindo de 0,079 para 0,374.
const RESEARCH_QUERIES = {
  taxa_zero: {
    angulos: [
      "custo de adquirência e meios de pagamento para pequenas empresas no Brasil",
      "meios de pagamento mais usados no varejo brasileiro",
      "taxa de intercâmbio e MDR no mercado brasileiro de cartões",
      "custo de operação e margem de lucro do pequeno empresário brasileiro",
    ],
  },
  educacional: {
    angulos: [
      "capital de giro e prazo de recebimento de vendas online de pequenas empresas no Brasil",
      "inadimplência e chargeback no comércio eletrônico brasileiro",
      "antecipação de recebíveis para pequenos negócios no Brasil",
      "educação financeira e crédito para empreendedores brasileiros",
    ],
  },
  // Medido em 3 variantes: a primeira deu 8 de 8 resultados acima do piso (0,82 / 0,82 / 0,79), com
  // manchetes que falam do público real da 4Selet ("Criador de conteúdo virou vendedor: a explosão
  // do social commerce"). A que estava aqui antes ("educacao online e cursos digitais") deu 0 de 7
  // — trazia IA no trabalho, 5G e o Ideb de Goiânia.
  curiosidade_mercado: {
    angulos: [
      "economia da criação de conteúdo e creator economy no Brasil",
      "vendas do comércio eletrônico brasileiro faturamento e ticket médio",
      "mercado de infoprodutos e cursos online no Brasil",
      "hábitos de consumo digital do brasileiro e social commerce",
    ],
  },
  prova_plataforma: {
    angulos: [
      "taxa de aprovação de pagamento com cartão no e-commerce brasileiro",
      "antifraude e recusa de transação em pagamentos online no Brasil",
      "abandono de carrinho e checkout no e-commerce brasileiro",
      "experiência de pagamento e conversão em lojas online no Brasil",
    ],
  },
  novidade: {
    angulos: [
      "regulação do Banco Central para meios de pagamento e arranjos de pagamento",
      "novas regras de pagamentos instantâneos e Pix no Brasil",
      "Pix automático e Pix parcelado novidades no Brasil",
      "open finance e novidades de pagamento digital no Brasil",
    ],
  },
  motivacional: {
    angulos: [
      "empreendedorismo digital e profissionalização de pequenos negócios no Brasil",
      "produtividade e gestão de pequenas empresas brasileiras",
      "crescimento de MEIs e pequenos negócios digitais no Brasil",
      "trabalho autônomo e renda de criadores de conteúdo no Brasil",
    ],
  },
};
// A pesquisa passa a olhar SÓ a imprensa brasileira. `country: "brazil"` não estava segurando o
// idioma — o topo dos resultados era FinTech Magazine, Retail Gazette e The Fintech Times, sobre
// Reino Unido e Estados Unidos. Restringir aos veículos daqui é o que faz a busca devolver o dado
// que a peça pode citar de cabeça erguida.
//
// A lista é generosa de propósito: fechar demais transformaria a pesquisa em eco de dois jornais.
// O preço é conhecido e aceito — um dado bom publicado num veículo fora da lista não aparece.
const RESEARCH_INCLUDE_DOMAINS = [
  "valor.globo.com", "g1.globo.com", "oglobo.globo.com", "exame.com", "infomoney.com.br",
  "estadao.com.br", "einvestidor.estadao.com.br", "folha.uol.com.br", "uol.com.br",
  "cnnbrasil.com.br", "poder360.com.br", "seudinheiro.com", "neofeed.com.br", "braziljournal.com",
  "ecommercebrasil.com.br", "mercadoeconsumo.com.br", "startups.com.br", "agenciabrasil.ebc.com.br",
  "istoedinheiro.com.br", "veja.abril.com.br", "gazetadopovo.com.br", "terra.com.br",
  "abcomm.org", "sebrae.com.br", "bcb.gov.br", "ibge.gov.br", "cndl.org.br", "fecomercio.com.br",
];
// Piso de relevância aplicado no NOSSO código. A Tavily já devolve um `score` por resultado e o
// código antigo o descartava na linha seguinte. Calibrado em ~30 resultados: o corte tira vaga de
// emprego (0,069) e vale-brinde (0,149) e mantém matéria de veículo grande (0,79 / 0,49 / 0,32).
const RESEARCH_SCORE_MIN = 0.30;
const RESEARCH_CACHE_TTL_H = 6;   // a Tavily é determinística: repetir a mesma pergunta devolve o mesmo
const RESEARCH_MAX_ACEITOS = 4;   // teto do que pode ir para o prompt
// Fora da busca: rede social e vídeo (texto de navegação, não fato), agregadores de comparação, os
// domínios dos concorrentes — e 4selet.com.br, porque o FAQ público da casa contradiz a campanha.
const RESEARCH_EXCLUDE_DOMAINS = [
  "instagram.com", "youtube.com", "tiktok.com", "facebook.com", "pinterest.com", "x.com", "twitter.com",
  "linkedin.com", "reddit.com", "quora.com", "pt.wikipedia.org", "en.wikipedia.org",
  "4selet.com.br",
  "hotmart.com", "kiwify.com.br", "eduzz.com", "monetizze.com.br", "ticto.com.br", "braip.com",
  "herospark.com", "kirvano.com", "cakto.com.br", "hubla.com", "greenn.com.br", "perfectpay.com.br",
  "mercadopago.com.br", "pagseguro.uol.com.br", "lojaintegrada.com.br", "nuvemshop.com.br",
  // Conteúdo de marca vestido de reportagem: o Blue Studio é o estúdio de publicidade do Estadão.
  // Saiu na medição como "Agência de Comunicação — O verdadeiro custo de exportar" com score 0,489.
  "bluestudio.estadao.com.br",
];
// Título/URL que denuncia página de COMPARAÇÃO de plataformas: mesmo sem citar nome conhecido, é
// conteúdo que só existe para ranquear concorrente. Descarta o achado inteiro.
const RESEARCH_COMPARISON_LEXICON = [
  "melhor plataforma", "melhores plataformas", "alternativas a", "alternativa a", "comparativo",
  "qual plataforma", " vs ", "vs.", "taxas da", "quanto cobra", "ranking de plataformas",
  "top 5", "top 6", "top 10", "concorrentes",
];
// Instituições cujo nome PODE aparecer num fato (não são concorrentes; são fonte de dado setorial).
const RESEARCH_INSTITUTIONS_OK = [
  "abcomm", "cndl", "sebrae", "ibge", "banco central", "bacen", "serasa", "cnc", "fgv", "ipea",
  "nielsen", "ebit", "opinion box", "neotrust", "febraban",
];

// Emojis banidos (associados a hype) — brand_identity.md §Emojis
const BANNED_EMOJIS = ["🔥", "⚡", "🚀", "💸", "💰", "😱", "🤯", "✨"];

// CTAs aprovados (brand_identity.md §CTAs aprovados)
const APPROVED_CTAS = [
  "Solicitar convite", "Ver as condicoes", "Ver as condições", "Conhecer a plataforma",
  "Migrar minha operacao", "Migrar minha operação", "Calcular minha economia",
  "Falar com o time", "Acessar o material", "Ler o playbook", "Ver como funciona",
];

// Teto do texto que a leitura do tema aceita. Vive aqui porque tinha DUAS casas que nao se
// enxergavam — a rota devolvia 413 acima de 4000 e o prompt ainda cortava em 4000 por dentro,
// entao subir so a rota deixaria o corte escondido. Um briefing de diretor de arte passa
// tranquilamente de 8 mil caracteres; medido, o modelo nao degrada com muito mais que isso.
// Acima deste teto o texto ja e um documento, e documento pede leitura por secao — outro assunto.
const BRIEF_MAX_CHARS = 32000;

// Padroes de CTA tipicamente proibidos (urgencia fake / hype)
const BANNED_CTA_PATTERNS = [
  /compre j[aá]/i, /n[aã]o perca/i, /clica aqui/i, /urgente/i, /garanta o seu/i,
  /inscreva-se gratuit/i, /vaga limitada/i, /[uú]ltima chance/i,
];

// Hashtags obrigatorias / regras (brand_identity.md §Hashtags)
const HASHTAG_RULES = {
  min: 3,
  max: 5,
  mandatory: "#4Selet",
  campaign: "#TaxaZero",
};

// Tipos de conteudo suportados. `media` indica o que pode ser renderizado:
//   "image" -> PNG via Playwright (render_ad.js)
//   "video" -> MP4 via Remotion (composition BrandStory)
//   "text"  -> apenas copy (sem render de midia)
// `kind` agrupa na biblioteca/aprovados; `icon` e exibido no seletor visual.
const CONTENT_TYPES = [
  {
    id: "instagram_caption",
    label: "Feed Instagram",
    short: "Feed",
    platform: "instagram",
    file: "copy/instagram_caption.txt",
    format: "text",
    media: "image",
    kind: "feed",
    icon: "▣",
    description: "Post de feed: imagem 1080x1350 + caption (hook + número + CTA + 3-5 hashtags).",
  },
  {
    id: "instagram_carousel",
    label: "Carrossel Instagram",
    short: "Carrossel",
    platform: "instagram",
    file: "copy/instagram_carousel.json",
    format: "json",
    media: "image",
    kind: "carousel",
    icon: "▦",
    description: "Roteiro de slides (capa + desenvolvimento + CTA) renderizados em PNG.",
  },
  {
    id: "instagram_story",
    label: "Story Instagram",
    short: "Story",
    platform: "instagram",
    file: "copy/instagram_story.json",
    format: "json",
    media: "image",
    kind: "story",
    icon: "▯",
    // "cards", e nao "slides", de proposito: `slides` cairia nos regex de classifyKind e nos
    // apelidos do carrossel, e a peca seria classificada como carrossel na biblioteca.
    description: "Sequência de 3 a 7 cartões verticais 1080x1920, com a área que o app do Instagram cobre já reservada. Story não tem legenda: o texto mora na arte.",
  },
  {
    id: "ad_creative",
    label: "Imagem / Anúncio",
    short: "Imagem",
    platform: "instagram",
    file: "ads/concept.json",
    format: "json",
    media: "image",
    kind: "image",
    icon: "◧",
    description: "Criativo estático 1080x1080: headline <=4 palavras, subtext, CTA e arte da marca.",
  },
  {
    id: "media_mention",
    label: "4Selet na Mídia",
    short: "Mídia",
    platform: "instagram",
    file: "copy/instagram_caption.txt",
    format: "text",
    media: "image",
    kind: "media",
    icon: "▤",
    iconSvg: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true" style="vertical-align:-0.14em"><rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M9 18h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    description: "Aparição na imprensa: o print da matéria num dispositivo (tablet/celular/notebook/janela) na identidade da marca + legenda de prova social.",
  },
  {
    id: "video_idea",
    label: "Vídeo (short-form)",
    short: "Vídeo",
    platform: "instagram",
    file: "video/concept.json",
    format: "json",
    media: "video",
    kind: "video",
    icon: "►",
    // SVG inline (player com play): le claramente como "video" — o glyph "►" sozinho
    // parecia um aviao de papel/enviar. `icon` fica de fallback textual.
    iconSvg: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true" style="vertical-align:-0.14em"><rect x="2.6" y="5.2" width="18.8" height="13.6" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M10 9.3v5.4l4.7-2.7z" fill="currentColor"/></svg>',
    description: "Reels/short vertical (9:16): hook, arco e roteiro de cenas, gerado como vídeo final.",
  },
  {
    id: "linkedin_post",
    label: "Post LinkedIn",
    short: "LinkedIn",
    platform: "linkedin",
    file: "copy/linkedin_post.txt",
    format: "text",
    media: "text",
    kind: "linkedin",
    icon: "in",
    description: "Editorial premium 1.200-1.500 chars, tese + dados + CTA suave.",
  },
  {
    id: "threads_post",
    label: "Post Threads / X",
    short: "Threads/X",
    platform: "x",
    file: "copy/threads_post.txt",
    format: "text",
    media: "text",
    kind: "threads",
    icon: "@",
    description: "Provocação controlada com dado, <=500 chars, 0-1 hashtag.",
  },
];

// Rotulos amigaveis por "kind" (biblioteca de aprovados / agrupamento).
// A faixa que o aplicativo do Instagram COBRE no story, em 1080x1920. Mora aqui porque render.js,
// prompts.js e a tela (via /api/meta) precisam ler o MESMO número — antes havia dois que discordavam
// e nenhum chegava ao renderizador: a prosa "evitar top/bottom 250px" no platform_guidelines.md e o
// overlay de 14%/20%/6% da tela (269px / 384px / 65px — e 65px ainda furava o piso de 88px da marca).
// Em cima: foto, nome do perfil, horário e o "x". Embaixo: a caixa "Enviar mensagem" e os ícones.
const STORY_SAFE = {
  w: 1080, h: 1920,
  top: 250, bottom: 250, side: 96,
  ctaBottom: 340,                                  // onde uma pílula de chamada ainda é clicável
  stickerBand: { w: 888, h: 320, bottom: 1580 },   // espaço reservado p/ o sticker que a pessoa cola no app
};

// Rótulo operacional do destaque a que o story pertence. Não existe endpoint de Highlights na
// Graph API: isto é instrução para a pessoa, não automação.
// Para ONDE uma publicação vai. É campo da PUBLICAÇÃO, não da peça: a mesma arte de feed pode
// virar story, e um carrossel pode ir ao feed hoje e ter um slide reaproveitado como story amanhã.
// `auto` = o painel publica pela Graph API; `manual` = a arte sai pronta e a pessoa posta no app.
const DESTINOS = [
  { id: "feed", label: "Feed", modo: "auto", kinds: ["feed", "image", "carousel", "media"] },
  { id: "story", label: "Story", modo: "manual", kinds: ["story", "feed", "image", "carousel", "media"] },
  { id: "reels", label: "Reels", modo: "manual", kinds: ["video"] },
  { id: "outro", label: "Outro", modo: "manual", kinds: [] },
];
const DESTINO_IDS = DESTINOS.map((d) => d.id);
function destinoById(id) { return DESTINOS.find((d) => d.id === String(id || "")) || null; }
// O destino que o painel sugere para uma peça, pelo tipo dela. É sugestão: quem manda é a pessoa.
function destinoPadrao(kind) {
  const k = String(kind || "");
  if (k === "story") return "story";
  if (k === "video") return "reels";
  return "feed";
}
// O painel publica sozinho? Só o feed, e só para os tipos que a Graph API aceita hoje.
function publicaSozinho(destino, kind) {
  const d = destinoById(destino);
  if (!d || d.modo !== "auto") return false;
  return d.kinds.indexOf(String(kind || "")) >= 0;
}

const STORY_HIGHLIGHTS = ["", "quem_somos", "nosso_dna", "diferenciais"];

const KIND_LABELS = {
  feed: "Feed",
  carousel: "Carrossel",
  story: "Story",
  image: "Imagem / Anúncio",
  media: "4Selet na Mídia",
  video: "Vídeo",
  linkedin: "LinkedIn",
  threads: "Threads / X",
  other: "Outros",
};

function contentTypeById(id) {
  return CONTENT_TYPES.find((c) => c.id === id) || null;
}

module.exports = {
  PATHS,
  PALETTE,
  PALETAS_CAMPANHA,
  PALETA_IDS,
  RESEARCH_QUERIES,
  RESEARCH_SCORE_MIN,
  RESEARCH_CACHE_TTL_H,
  RESEARCH_MAX_ACEITOS,
  RESEARCH_EXCLUDE_DOMAINS,
  RESEARCH_INCLUDE_DOMAINS,
  RESEARCH_COMPARISON_LEXICON,
  RESEARCH_INSTITUTIONS_OK,
  ALLOWED_PLATFORMS,
  BRAND_PILLARS,
  CONTENT_PILLARS,
  BANNED_COMPETITORS,
  BANNED_EMOJIS,
  APPROVED_CTAS,
  BRIEF_MAX_CHARS,
  BANNED_CTA_PATTERNS,
  HASHTAG_RULES,
  CONTENT_TYPES,
  KIND_LABELS,
  STORY_SAFE, STORY_HIGHLIGHTS,
  DESTINOS, DESTINO_IDS, destinoById, destinoPadrao, publicaSozinho,
  contentTypeById,
  pillarById,
};
