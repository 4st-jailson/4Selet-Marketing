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
  "Experiencia", "Lucratividade", "Sabedoria", "Exclusividade", "Seguranca",
];

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
    description: "Post de feed: imagem 1080x1350 + caption (hook + numero + CTA + 3-5 hashtags).",
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
    label: "Imagem / Anuncio",
    short: "Imagem",
    platform: "instagram",
    file: "ads/concept.json",
    format: "json",
    media: "image",
    kind: "image",
    icon: "◧",
    description: "Criativo estatico 1080x1080: headline <=4 palavras, subtext, CTA e arte da marca.",
  },
  {
    id: "video_idea",
    label: "Video (short-form)",
    short: "Video",
    platform: "instagram",
    file: "video/concept.json",
    format: "json",
    media: "video",
    kind: "video",
    icon: "►",
    description: "Reels/short 9:16: hook, arco e roteiro de cenas renderizado em MP4 (Remotion).",
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
    description: "Provocacao controlada com dado, <=500 chars, 0-1 hashtag.",
  },
];

// Rotulos amigaveis por "kind" (biblioteca de aprovados / agrupamento).
const KIND_LABELS = {
  feed: "Feed",
  carousel: "Carrossel",
  image: "Imagem / Anuncio",
  video: "Video",
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
  BANNED_COMPETITORS,
  BANNED_EMOJIS,
  APPROVED_CTAS,
  BANNED_CTA_PATTERNS,
  HASHTAG_RULES,
  CONTENT_TYPES,
  KIND_LABELS,
  contentTypeById,
};
