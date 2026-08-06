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

// ---- Schema: Colecao -----------------------------------------------------
function validateCollection(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { ok: false, errors: ["payload invalido"] };
  if (!obj.name || String(obj.name).trim().length < 3) {
    errors.push("nome da colecao e obrigatorio (min 3 caracteres)");
  }
  if (obj.id && !SLUG_RE.test(obj.id)) {
    errors.push("id invalido (use slug: a-z, 0-9, hifen, underscore)");
  }
  if (obj.description != null && String(obj.description).length > 500) {
    errors.push("descricao muito longa (max 500 caracteres)");
  }
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
// Mecanica oficial da campanha, com o padrao que identifica a peca DECLARANDO cada numero.
// Fonte: knowledge/product_campaign.md secao 3 (e o bloco GOVERNANCE de lib/prompts.js).
// Cada regra e deliberadamente estreita — precisa do contexto ao redor — porque o objetivo e
// pegar a contradicao, nao qualquer digito que apareca no texto.
const NUMEROS_OFICIAIS = [
  { oq: "a duracao da Taxa Zero", oficial: 3,
    re: /(?:0\s*%|taxa zero)[^.!?\n]{0,70}?\b(\d{1,2})\s*(?:meses|mes|mês)\b/i },
  { oq: "o teto de vendas da Taxa Zero", oficial: 300,
    re: /(?:0\s*%|taxa zero)[^.!?\n]{0,70}?\bR\$\s*(\d{2,4})\s*mil\b/i },
  { oq: "o custo fixo por transacao", oficial: 1.99,
    re: /R\$\s*(\d{1,2}[,.]\d{2})\s*(?:fixos?\s*)?(?:por|\/)\s*transa/i },
  // `naoNoMeio`: o outro meio de pagamento NAO pode estar entre o assunto e o prazo. Sem isso,
  // "95% de aprovacao no cartao e PIX em D+10" era lido como "cartao em D+10" e virava erro duro
  // numa frase correta — o prazo ali e do PIX, o cartao so aparece antes.
  { oq: "o prazo do PIX", oficial: 10, naoNoMeio: /cart[ãa]o/i,
    re: /\bPIX\b[^.!?\n]{0,25}?\bD\s*\+\s*(\d{1,2})\b/i },
  { oq: "o prazo do cartao", oficial: 30, naoNoMeio: /\bPIX\b/i,
    re: /\bcart[ãa]o\b[^.!?\n]{0,25}?\bD\s*\+\s*(\d{1,2})\b/i },
];

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

  // 2.5) Numeros da campanha CONTRADITORIOS (ERRO)
  //
  // Numero errado sobre a propria oferta e o pior defeito possivel: vira alegacao falsa numa
  // peca publicada, e ninguem percebe olhando a arte — "0% por 6 meses" parece tao plausivel
  // quanto "0% por 3 meses". As regras abaixo so disparam quando o texto esta DECLARANDO a
  // mecanica da campanha, para nao atropelar copy legitima: "taxa de mercado em torno de 7,9%"
  // e "seu cartao ta aprovando 78% em vez de 95%" continuam passando.
  // A peca pode falar do MERCADO em vez de falar da 4Selet: "a media do mercado libera seu PIX em
  // D+30. A 4Selet libera em D+10." Comparar com o mercado e argumento legitimo — e era barrado.
  const COMPARA_MERCADO = /m[ée]dia do mercado|no mercado|do mercado|outras plataformas|a maioria das plataformas|por a[ií]|concorr[êe]nc/i;
  for (const { re, oficial, oq, naoNoMeio } of NUMEROS_OFICIAIS) {
    let m;
    const rex = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = rex.exec(String(text))) !== null) {
      const achado = String(m[m.length - 1]).replace(",", ".");
      if (parseFloat(achado) === oficial) continue;
      // o outro meio de pagamento entrou no meio: o prazo nao e do assunto desta regra
      if (naoNoMeio && naoNoMeio.test(m[0])) continue;
      // ENUMERACAO nao e contradicao. Uma frase que lista os dois prazos — "recebimento: cartao,
      // PIX em D+10 e D+30" — casa o regex do cartao com o numero do PIX e virava erro duro,
      // barrando copy correta. Se a MESMA frase tambem traz o numero oficial deste item, o texto
      // esta enumerando e nao afirmando outra coisa.
      const inicio = String(text).lastIndexOf("\n", m.index) + 1;
      let fim = String(text).slice(m.index).search(/[.!?\n]/);
      fim = fim < 0 ? String(text).length : m.index + fim + 1;
      const frase = String(text).slice(inicio, fim);
      const temOficial = new RegExp("(?:^|[^\\d.,])" + String(oficial).replace(".", "[.,]") + "(?![\\d])").test(frase);
      if (temOficial) continue;
      if (COMPARA_MERCADO.test(frase)) continue;
      errors.push(oq + ' esta errado: a peca diz "' + m[0].trim() + '", e o oficial e ' + oficial + ".");
    }
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
  validateCollection,
  validateContentRequest,
  runBrandGovernance,
  countEmojis,
  countHashtags,
  SLUG_RE,
  DATE_RE,
};
