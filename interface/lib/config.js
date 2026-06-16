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

// Lista fechada de concorrentes proibidos em criativos abertos (brand_identity.md)
const BANNED_COMPETITORS = [
  "greenn", "hubla", "kiwify", "hotmart", "eduzz", "ticto", "cakto", "monetizze", "perfect pay", "perfectpay",
];

// Emojis banidos (associados a hype) — brand_identity.md §Emojis
const BANNED_EMOJIS = ["🔥", "⚡", "🚀", "💸", "💰", "😱", "🤯", "✨"];

// CTAs aprovados (brand_identity.md §CTAs aprovados)
const APPROVED_CTAS = [
  "Solicitar convite", "Ver as condicoes", "Ver as condições", "Conhecer a plataforma",
  "Migrar minha operacao", "Migrar minha operação", "Calcular minha economia",
  "Falar com o time", "Acessar o material", "Ler o playbook", "Ver como funciona",
];

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
    id: "video_idea",
    label: "Vídeo (short-form)",
    short: "Vídeo",
    platform: "instagram",
    file: "video/concept.json",
    format: "json",
    media: "video",
    kind: "video",
    icon: "►",
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
  ALLOWED_PLATFORMS,
  BRAND_PILLARS,
  CONTENT_PILLARS,
  BANNED_COMPETITORS,
  BANNED_EMOJIS,
  APPROVED_CTAS,
  BANNED_CTA_PATTERNS,
  HASHTAG_RULES,
  CONTENT_TYPES,
  KIND_LABELS,
  contentTypeById,
  pillarById,
};
