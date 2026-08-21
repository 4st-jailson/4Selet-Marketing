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
// `(?<![\d.,])0` — o zero da oferta e o ZERO INTEIRO, nao o ultimo digito de outro numero. Sem
// essa trava, "sua aprovacao no cartao esta em 80%, voce esta faturando R$ 80 mil" era lido como
// "0% ... R$ 80 mil" e virava ERRO DURO: copy educacional legitima, medida numa geracao real,
// bloqueada no 422 sem saida pela tela. Vale para "95%", "7,0%" e "100%" pelo mesmo motivo.
//
// O QUE ANCORA O ASSUNTO NA FRASE (correcao de ago/2026).
// As duas regras da Taxa Zero disparavam com QUALQUER "0%" perto de QUALQUER numero. Medido:
// "Aprovacao alta, 0% de recusa, cada R$ 100 mil vira caixa no dia certo" caia no 422 dizendo
// que o teto da campanha estava errado — o 0% ali e de RECUSA e o R$ 100 mil nao e teto de nada.
// Como a tela nao oferece "salvar assim mesmo" (o `force` so existe pela API), o gate PARAVA o
// trabalho: a pessoa reescrevia ate a expressao parar de bater, sem entender o motivo.
// Afrouxar tambem e ruim (numero oficial errado no @4selet e alegacao falsa publicada), entao a
// leitura passou a ter DUAS partes dentro do `contexto` de cada regra, e as duas precisam bater:
//   1) o gancho e mesmo a campanha: a peca diz "taxa zero" com todas as letras, ou o
//      "0%" e de taxa/comissao/tarifa/plataforma, ou vem solto ("0% por 3 meses", que e como a
//      propria campanha se escreve). "0% de recusa" e "0% de burocracia" nao sao a oferta.
//   2) o numero esta na POSICAO em que a campanha declara aquele limite: teto so e
//      teto quando vem como limite ("ate/ou/teto/limite/maximo/primeiros R$ N mil", "R$ N mil em
//      vendas"); prazo so e prazo quando e futuro ("por 6 meses"), nao tempo corrido ("ha 2
//      meses", "nos ultimos 6 meses").
// Estas duas regras varrem o NUMERO e olham para tras (a ancora tem de vir ANTES dele, na mesma
// frase). Antes o regex ia da ancora ate o PRIMEIRO numero e parava: numa frase com dois valores
// ("...voce fica com R$ 90 mil e o teto e R$ 500 mil"), o segundo — o errado — nunca era lido.

// Palavras que fazem o "0%" ser o zero da PLATAFORMA, e nao de outra coisa qualquer.
const COISA_DA_TAXA = /^(?:taxas?|tarifas?|comiss[ãa]o|comiss[õo]es|custos?|encargos?|cobran[çc]as?|plataforma|intermedia[çc][ãa]o|reten[çc][ãa]o)$/i;
// Onde a mencao a campanha comeca dentro do trecho — serve so para CITAR a frase no erro, para a
// pessoa ler o que o painel entendeu em vez de um numero solto.
const ANCORA = /(?<![\d.,])0\s*%|taxa\s*zero/i;
// O trecho que vai na mensagem: da mencao a campanha ate o numero contestado.
function citarDaAncora(texto, de, antes, m) {
  const p = antes.search(ANCORA);
  return String(texto).slice(p < 0 ? m.index : de + p, m.index + m[0].length).trim();
}
const ZERO_QUALIFICADO = /(?<![\d.,])0\s*%(?:\s*(?:de|da|do|em|na|no|pela|pelo)\s+([\p{L}]+))?/giu;
// `trecho` e o pedaco da frase ANTES do numero. Diz se o que esta ali fala da oferta da campanha.
function ofertaAntesDe(trecho) {
  const t = String(trecho);
  if (/taxa\s*zero/i.test(t)) return true;
  for (const z of t.matchAll(ZERO_QUALIFICADO)) {
    if (!z[1]) return true;                    // "0%" solto — e assim que a oferta se escreve
    if (COISA_DA_TAXA.test(z[1])) return true; // "0% de taxa", "0% na plataforma"
  }
  return false;                                // so sobrou "0% de <outra coisa>"
}
// Onde comeca a frase em que este numero esta. A ancora da campanha tem de estar na MESMA frase:
// "taxa zero" no periodo anterior nao autoriza ler o numero deste como se fosse da oferta.
function inicioDaFrase(texto, idx) {
  const m = String(texto).slice(0, idx).match(/[.!?\n][^.!?\n]*$/);
  return m ? idx - m[0].length + 1 : 0;
}
// O que marca um "R$ N mil" como TETO e nao como um valor qualquer da frase.
// A borda e escrita como `(?![\p{L}])` com a flag `u`, e nao como `\b`: em JavaScript o `\b` e
// ASCII, entao depois de "até" (que termina em acento) ele NUNCA fecha — "0% de taxa até R$ 500
// mil" escapava da regra por causa disso, justo o caso que a regra existe para pegar.
const TETO_ANTES = /(?:^|[^\p{L}])(?:at[ée]|ou|teto|limite|m[áa]xim[oa]|m[áa]x\.?|primeiros?|chegar\s+a|bater)(?![\p{L}])[^.!?\n]{0,16}$/iu;
const TETO_DEPOIS = /^\s*(?:em|de)\s+(?:vendas|faturamento|receita)\b|^\s*(?:vendidos|faturados)\b|^[^.!?\n]{0,26}\bo\s+que\s+(?:ocorrer|vier|acontecer)\s+primeiro\b/i;
// "R$ 80 mil POR MES" e o faturamento de alguem, nunca o teto (que e total, uma vez so).
const VALOR_POR_PERIODO = /^\s*(?:\/|por|ao|a\s+cada|todo|todos\s+os)\s*(?:m[êe]s|meses|ano|semana|dia)|^\s*mensa/i;
// Tempo que JA correu nao e a duracao prometida: "ha 2 meses", "nos ultimos 6 meses",
// "dobrou o faturamento em 6 meses". A campanha promete "por/durante/nos primeiros N meses".
const PRAZO_NAO_E_OFERTA = /(?:^|[^\p{L}])(?:[úu]ltimos?|passados?|h[áa]|desde|faz|em|ap[óo]s|depois\s+de)\s+(?:os\s+|as\s+)?$/iu;

const NUMEROS_OFICIAIS = [
  { oq: "a duracao da Taxa Zero", oficial: 3,
    re: /\b(\d{1,2})\s*(?:meses|mes|mês)\b/i,
    contexto: (m, texto) => {
      const t = String(texto);
      const de = Math.max(inicioDaFrase(t, m.index), m.index - 90);
      const antes = t.slice(de, m.index);
      if (!ofertaAntesDe(antes)) return false;
      if (PRAZO_NAO_E_OFERTA.test(antes)) return false;
      return citarDaAncora(t, de, antes, m);
    } },
  { oq: "o teto de vendas da Taxa Zero", oficial: 300,
    re: /\bR\$\s*(\d{2,4})\s*mil\b/i,
    contexto: (m, texto) => {
      const t = String(texto);
      const ini = inicioDaFrase(t, m.index);
      const de = Math.max(ini, m.index - 90);
      const antes = t.slice(de, m.index);
      if (!ofertaAntesDe(antes)) return false;
      const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (VALOR_POR_PERIODO.test(depois)) return false;
      if (!TETO_ANTES.test(antes) && !TETO_DEPOIS.test(depois)) return false;
      return citarDaAncora(t, de, antes, m);
    } },
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

// Tira acento e caixa para comparar texto. O modelo escreve a frase-tag das duas formas ("e
// Selet" e "é Selet"), e no caminho do render ela ja chegou sem acento nenhum — comparar cru
// deixava passar metade das grafias.
function semAcento(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
// A frase-tag da marca NAO assina peca (knowledge/brand_identity.md, regra dura de jul/2026, e o
// bloco GOVERNANCE de lib/prompts.js). A regra estava escrita em tres documentos e em NENHUM
// lugar do codigo: peca assinada com ela salvava sem erro e sem aviso — tem uma aprovada no
// acervo com a frase, saida da propria geracao.
const FRASE_TAG_RE = /para\s+quem\s+sabe\s+que\s+e\s+selet/;

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
  for (const { re, oficial, oq, naoNoMeio, contexto } of NUMEROS_OFICIAIS) {
    let m;
    const rex = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = rex.exec(String(text))) !== null) {
      const achado = String(m[m.length - 1]).replace(",", ".");
      if (parseFloat(achado) === oficial) continue;
      // o outro meio de pagamento entrou no meio: o prazo nao e do assunto desta regra
      if (naoNoMeio && naoNoMeio.test(m[0])) continue;
      // A frase precisa estar mesmo falando da oferta E o numero precisa estar na posicao em que
      // a campanha declara aquele limite. Sem esta porta, "0%" virava curinga (ver o bloco acima).
      const ctx = contexto ? contexto(m, String(text)) : true;
      if (!ctx) continue;
      const citado = typeof ctx === "string" ? ctx : m[0].trim();
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
      const msg = oq + ' esta errado: a peca diz "' + citado + '", e o oficial e ' + oficial + ".";
      // Mesmo recado duas vezes so faz a pessoa achar que sao dois problemas diferentes.
      if (!errors.includes(msg)) errors.push(msg);
    }
  }

  // 2.7) Frase-tag assinando a peca (ERRO)
  //
  // A excecao da regra e o BRIEF: "so entra se o brief pedir explicitamente". Quem chama passa o
  // pedido em `opts.brief` — se a frase esta la, ela e permitida na peca. Sem brief em maos, a
  // regra vale cheia. Hoje quem passa o brief e o pipeline (pipeline/agents.js); a rota /save do
  // painel ainda nao passa, entao la a excecao so vale pela API (`force: true`) — falta uma linha
  // em interface/routes/generate.js, que e de outro dono.
  const briefPediu = FRASE_TAG_RE.test(semAcento(opts.brief));
  if (!briefPediu && FRASE_TAG_RE.test(semAcento(text))) {
    errors.push('assina a peca com a frase-tag "Para quem sabe que e Selet." — ela nao assina peca ' +
      "(nao e rodape, fecho, headline nem legenda). So entra se o pedido pedir a frase.");
  }

  // 3) CTAs de urgencia fake / proibidos (AVISO)
  //
  // Fica em AVISO DE PROPOSITO — o CLAUDE.md e que prometia bloqueio, e foi ele que se corrigiu.
  // Motivo: estes padroes sao PEDACOS de frase, nao CTAs inteiros ("nao perca" tambem casa com
  // "nao perca margem para a taxa"), e a tela nao oferece "salvar assim mesmo" (o `force` do
  // /save so existe pela API). Erro duro aqui deixaria a pessoa presa reescrevendo ate o regex
  // parar de bater, sem saida. O gate duro fica com o que e sempre errado e nao tem leitura
  // ambigua: concorrente, emoji de hype, numero oficial contraditorio e frase-tag.
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
