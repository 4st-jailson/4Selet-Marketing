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
const RESEARCH_QUERIES = {
  taxa_zero: {
    principal: "custo de adquirencia e meios de pagamento para pequenas empresas no Brasil",
    alternativa: "meios de pagamento mais usados no varejo brasileiro",
  },
  educacional: {
    principal: "prazo de recebimento de vendas online e capital de giro de pequenas empresas no Brasil",
    alternativa: "inadimplencia e chargeback no comercio eletronico brasileiro",
  },
  // Medido em 3 variantes: esta deu 8 de 8 resultados acima do piso (0,82 / 0,82 / 0,79), com
  // manchetes que falam do público real da 4Selet ("Criador de conteúdo virou vendedor: a explosão
  // do social commerce"). A que estava aqui antes ("educacao online e cursos digitais") deu 0 de 7
  // — trazia IA no trabalho, 5G e o Ideb de Goiânia.
  curiosidade_mercado: {
    principal: "economia da criacao de conteudo e creator economy no Brasil",
    alternativa: "vendas do comercio eletronico brasileiro faturamento e ticket medio",
  },
  prova_plataforma: {
    principal: "taxa de aprovacao de pagamento com cartao no e-commerce brasileiro",
    alternativa: "antifraude e recusa de transacao em pagamentos online no Brasil",
  },
  novidade: {
    principal: "regulacao do Banco Central para meios de pagamento e arranjos de pagamento",
    alternativa: "novas regras de pagamentos instantaneos e Pix no Brasil",
  },
  motivacional: {
    principal: "empreendedorismo digital e profissionalizacao de pequenos negocios no Brasil",
    alternativa: "produtividade e gestao de pequenas empresas brasileiras",
  },
};
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
const KIND_LABELS = {
  feed: "Feed",
  carousel: "Carrossel",
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
  contentTypeById,
  pillarById,
};
