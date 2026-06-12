// lib/validation.js — validacao de schema (estrutura padrao) + brand governance.
// Roda no BACK-END como gate. O FRONT espelha as regras estruturais para UX.
"use strict";
const {
  ALLOWED_PLATFORMS,
  BRAND_PILLARS,
  BANNED_COMPETITORS,
  BANNED_EMOJIS,
  BANNED_CTA_PATTERNS,
  HASHTAG_RULES,
  contentTypeById,
} = require("./config");

const SLUG_RE = /^[a-z0-9][a-z0-9_\-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
function countEmojis(text) {
  const m = String(text).match(/\p{Extended_Pictographic}/gu);
  return m ? m.length : 0;
}
function countHashtags(text) {
  const m = String(text).match(/#[\p{L}\p{N}_]+/gu);
  return m ? m : [];
}

// ---- Schema: Campanha ----------------------------------------------------
function validateCampaign(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { ok: false, errors: ["payload invalido"] };
  if (!obj.name || String(obj.name).trim().length < 3) {
    errors.push("nome da campanha e obrigatorio (min 3 caracteres)");
  }
  if (obj.id && !SLUG_RE.test(obj.id)) {
    errors.push("id invalido (use slug: a-z, 0-9, hifen, underscore)");
  }
  const status = obj.status || "active";
  if (!["active", "paused", "done"].includes(status)) {
    errors.push("status invalido (active | paused | done)");
  }
  const platforms = asArray(obj.platforms);
  for (const p of platforms) {
    if (!ALLOWED_PLATFORMS.includes(p)) errors.push("plataforma invalida: " + p);
  }
  if (obj.pillar && !BRAND_PILLARS.includes(obj.pillar)) {
    errors.push("pilar invalido (use: " + BRAND_PILLARS.join(", ") + ")");
  }
  if (obj.start_date && !DATE_RE.test(obj.start_date)) errors.push("start_date invalido (YYYY-MM-DD)");
  if (obj.end_date && !DATE_RE.test(obj.end_date)) errors.push("end_date invalido (YYYY-MM-DD)");
  return { ok: errors.length === 0, errors };
}

// ---- Schema: requisicao de geracao de conteudo ---------------------------
function validateContentRequest(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { ok: false, errors: ["payload invalido"] };
  const ct = contentTypeById(obj.content_type);
  if (!ct) errors.push("content_type invalido");
  if (!obj.task_name || !SLUG_RE.test(String(obj.task_name))) {
    errors.push("task_name e obrigatorio (slug: a-z, 0-9, hifen, underscore)");
  }
  if (!obj.task_date || !DATE_RE.test(String(obj.task_date))) {
    errors.push("task_date e obrigatorio (YYYY-MM-DD)");
  }
  if (!obj.brief || String(obj.brief).trim().length < 8) {
    errors.push("brief/tema e obrigatorio (descreva o objetivo da peca, min 8 caracteres)");
  }
  const platforms = asArray(obj.platforms);
  for (const p of platforms) {
    if (!ALLOWED_PLATFORMS.includes(p)) errors.push("plataforma invalida: " + p);
  }
  return { ok: errors.length === 0, errors, contentType: ct };
}

// ---- Brand governance sobre texto gerado/editado -------------------------
// Retorna { errors[], warnings[] }. errors bloqueiam aprovacao; warnings sinalizam.
function runBrandGovernance(text, opts) {
  opts = opts || {};
  const type = opts.type || "";
  const errors = [];
  const warnings = [];
  const lower = String(text || "").toLowerCase();

  // 1) Concorrentes proibidos em criativos abertos (ERRO)
  for (const name of BANNED_COMPETITORS) {
    if (lower.includes(name)) {
      errors.push("cita concorrente proibido em criativo aberto: \"" + name + "\"");
    }
  }

  // 2) Emojis banidos (hype) (ERRO)
  for (const e of BANNED_EMOJIS) {
    if (String(text).includes(e)) errors.push("usa emoji banido (hype): " + e);
  }

  // 3) CTAs de urgencia fake / proibidos (AVISO)
  for (const re of BANNED_CTA_PATTERNS) {
    if (re.test(String(text))) {
      warnings.push("possivel CTA proibido / urgencia fake detectado: " + re.source);
    }
  }

  // 4) Regras por tipo
  if (type === "instagram_caption") {
    const tags = countHashtags(text);
    if (tags.length < HASHTAG_RULES.min || tags.length > HASHTAG_RULES.max) {
      warnings.push("caption Instagram deve ter " + HASHTAG_RULES.min + "-" + HASHTAG_RULES.max +
        " hashtags (encontradas: " + tags.length + ")");
    }
    const hasBrand = tags.some((t) => t.toLowerCase() === HASHTAG_RULES.mandatory.toLowerCase());
    if (!hasBrand) warnings.push("caption Instagram deve incluir " + HASHTAG_RULES.mandatory);
    if (countEmojis(text) > 1) warnings.push("caption deve ter no maximo 1 emoji funcional");
  }
  if (type === "threads_post") {
    if (String(text).length > 500) warnings.push("post Threads/X deve ter <=500 caracteres (atual: " + String(text).length + ")");
    if (countEmojis(text) > 1) warnings.push("post deve ter no maximo 1 emoji funcional");
  }
  if (type === "linkedin_post") {
    const n = String(text).length;
    if (n < 1000 || n > 1800) warnings.push("post LinkedIn ideal entre ~1.200-1.500 caracteres (atual: " + n + ")");
  }

  return { errors, warnings };
}

module.exports = {
  validateCampaign,
  validateContentRequest,
  runBrandGovernance,
  countEmojis,
  countHashtags,
  SLUG_RE,
  DATE_RE,
};
