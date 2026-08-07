// lib/research.js — pesquisa de mercado (Tavily) do painel.
//
// REESCRITO em 2026-08-07 depois de medir o que a versão anterior realmente entregava. O desenho
// antigo disparava 3 buscas (6 créditos) dentro de TODA geração com o checkbox ligado e injetava 12
// achados no prompt sem ninguém olhar. Medido, dos 12: 5 eram repetição da mesma página, 2 eram o
// FAQ público de 4selet.com.br dizendo "7,9% + R$ 2,00 no plano Starter" (contra o 0% por 3 meses e
// R$ 1,99 oficiais da campanha), 1 era o verbete de GEOMETRIA da Wikipédia sobre "ângulo" e 1 era um
// tópico de fórum do Google Ads. Só 3 tinham a ver com o assunto — e 2 desses citavam concorrente
// com taxa e tudo.
//
// O que mudou, e por quê:
//  1. UMA busca por pilar, curada, escrita como MÉTRICA DE SETOR e nunca como preço para o vendedor.
//     Medido: pergunta de métrica deu 0 concorrente em 8 resultados; a mesma família de assunto
//     perguntada como preço deu 4 em 6, mesmo com todos os filtros ligados.
//  2. A query NÃO recebe mais o briefing concatenado. Era isso que produzia salada — "tendencias
//     <briefing de 200 chars> 2026" casava com tendência de FOTOGRAFIA e de design gráfico.
//  3. topic:'news' + country:'brazil' + days:180. O country é o que mata o colapso lexical medido
//     (busca por "prazo" trazia o remédio "Prazo 20mg"; "produtor" trazia produtor RURAL).
//  4. O `score` que a Tavily devolve DEIXA de ser descartado e vira piso.
//  5. Concorrente vira DESCARTE do achado inteiro, nunca máscara. Mascarar é pior que nada: apaga o
//     nome e deixa o número, virando "[plataforma do mercado] cobra 9,99% + R$1" — um dado de
//     mercado sem dono, que o modelo pode usar como se fosse nosso.
//  6. Nada entra no prompt sozinho. A rota devolve CARTÕES para a pessoa aceitar ou recusar.
//
// includeAnswer foi testado e DESCARTADO: a síntese que a Tavily devolve é a tabela de preço dos
// concorrentes em um parágrafo único e confiante.
"use strict";
const fs = require("fs");
const path = require("path");
const {
  PATHS, BANNED_COMPETITORS,
  RESEARCH_QUERIES, RESEARCH_SCORE_MIN, RESEARCH_CACHE_TTL_H, RESEARCH_MAX_ACEITOS,
  RESEARCH_EXCLUDE_DOMAINS, RESEARCH_COMPARISON_LEXICON, RESEARCH_INSTITUTIONS_OK,
} = require("./config");

// A chave fica em interface/data/ (volume GRAVÁVEL) — o .env em prod é montado read-only,
// então não dá pra gravar lá. data/ é o mesmo lugar de users.json/publish.json.
const TAVILY_FILE = path.join(PATHS.DATA_DIR, "tavily.json");
const CACHE_FILE = path.join(PATHS.DATA_DIR, "research_cache.json");

function dataFileKey() {
  try { return (JSON.parse(fs.readFileSync(TAVILY_FILE, "utf8")).key || "").trim(); } catch (e) { return ""; }
}

let _tavily; // cache do require (undefined = nao tentou; null = indisponivel)
function loadTavily() {
  if (_tavily !== undefined) return _tavily;
  try { _tavily = require("@tavily/core").tavily; } catch (e) { _tavily = null; }
  return _tavily;
}

// Le uma variavel do interface/.env (mesmo arquivo da chave Anthropic). Fallback
// duravel: o painel funciona mesmo que o daemon PM2 nao tenha a var no ambiente.
function envFileVar(name) {
  try {
    const raw = fs.readFileSync(PATHS.ENV_FILE, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "");
    }
  } catch (e) { /* sem .env */ }
  return "";
}

function getKey() {
  return process.env.TAVILY_API_KEY || dataFileKey() || envFileVar("TAVILY_API_KEY") || "";
}
function isConfigured() { return !!getKey() && !!loadTavily(); }

// ---- Funil determinístico ---------------------------------------------------
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Concorrente por NOME. Palavra inteira, para "rede" não casar dentro de "aprendizagem" e
// "guru" não casar dentro de "guruja". Instituição de pesquisa é liberada de propósito: ABComm,
// Sebrae e Banco Central são a FONTE do dado, não concorrência.
function citaConcorrente(txt) {
  const t = semAcento(txt);
  if (RESEARCH_INSTITUTIONS_OK.some((i) => t.indexOf(semAcento(i)) >= 0)) {
    // ainda assim confere nome de concorrente — instituição não dá salvo-conduto ao texto inteiro
  }
  return BANNED_COMPETITORS.some((c) => new RegExp("(^|[^a-z0-9])" + semAcento(c).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(t));
}

// Página de COMPARAÇÃO de plataformas: existe só para ranquear concorrente. Mesmo sem citar nome
// conhecido, não serve para peça da 4Selet.
function ehComparativo(titulo, url) {
  const t = semAcento(titulo + " " + url);
  return RESEARCH_COMPARISON_LEXICON.some((p) => t.indexOf(semAcento(p)) >= 0);
}

// A regra ESTRUTURAL: nome próprio colado a um percentual. É o que pega o concorrente que não está
// em lista nenhuma — plataforma nova, nome que ninguém mapeou. Custa um falso positivo de vez em
// quando (o Banco Central também é nome próprio perto de número), e por isso as instituições
// conhecidas ficam de fora da regra.
function nomeProprioComPercentual(txt) {
  const s = String(txt || "");
  const re = /\b([A-ZÀ-Ý][\wÀ-ÿ]{2,})\b[^.!?]{0,40}?\b\d{1,2}(?:[.,]\d+)?\s*%/g;
  let m;
  while ((m = re.exec(s))) {
    const nome = semAcento(m[1]);
    if (RESEARCH_INSTITUTIONS_OK.some((i) => semAcento(i) === nome || semAcento(i).indexOf(nome) === 0)) continue;
    // Palavras comuns que abrem frase e não são marca.
    if (["a", "o", "os", "as", "em", "no", "na", "com", "para", "segundo", "de", "do", "da", "esse", "essa",
      "brasil", "pix", "e-commerce", "ecommerce", "cartao", "credito", "mercado", "taxa", "hoje", "ja",
      "conforme", "apenas", "cerca", "mais", "menos", "quase", "entre"].indexOf(nome) >= 0) continue;
    return true;
  }
  return false;
}

// Texto de NAVEGAÇÃO raspado junto com a página: menu, chamada de assinatura, lista de tags. Vinha
// passando como se fosse fato — medido, um achado era literalmente "Assine o 247, Apoie por Pix,
// TV 247, Cortes 247, Tags: desenrola 2.0 MEI procred 360". Reconhece pelo excesso de marcadores e
// pela ausência de frase: fato de verdade tem verbo e ponto final, menu não tem.
function ehNavegacao(txt) {
  const s = String(txt || "");
  const marcas = (s.match(/[#★♥▶|»•]|\bTags?:|\bAssine\b|\bApoie\b|\bNewsletter\b|\bCompartilhe\b|\bLeia mais\b|\bContinuar lendo\b|\bMenu\b|\bLogin\b|\bCadastre\b/gi) || []).length;
  if (marcas >= 3) return true;
  const frases = s.split(/[.!?]\s/).filter((f) => f.trim().split(/\s+/).length >= 6);
  return frases.length === 0;   // nenhuma frase de 6+ palavras: é lista de links, não texto
}

// O achado precisa CARREGAR UM DADO USÁVEL, não só conter um algarismo. A versão anterior aceitava
// qualquer número com 3 dígitos e por isso deixou passar "procred 360" e "TV 247" — nome de produto
// e de canal viravam "fato". Agora o número tem que vir com UNIDADE: percentual, dinheiro, ou uma
// grandeza escrita por extenso (milhões/bilhões/mil). É o que separa dado de numeral solto.
function temDado(txt) {
  const s = String(txt || "");
  if (/\b\d{1,3}(?:[.,]\d+)?\s*%/.test(s)) return true;                        // 72%  /  9,9 %
  if (/\bR\$\s*\d[\d.,]*\s*(?:mil|milh\w*|bilh\w*|tri\w*)?/i.test(s)) return true; // R$ 1,99 · R$ 100 bilhões
  if (/\b\d[\d.,]*\s*(?:mil|milh\w*|bilh\w*|tri\w*)\b/i.test(s)) return true;  // 2,3 milhões
  if (/\bD\s*\+\s*\d+\b/i.test(s)) return true;                                 // D+10
  if (/\b\d+\s*(?:vezes|x)\s+(?:maior|mais|menor)\b/i.test(s)) return true;     // 2 vezes maior
  return false;
}
// Data de publicação: a Tavily devolve RFC ("Fri, 07 Aug 2026 10:00:00 GMT") e o corte cru em 10
// caracteres produzia "Fri, 07 Au" na tela. Aqui vira ISO, e o que não der para ler vira "".
function dataISO(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// Conteúdo patrocinado com cara de jornalismo. Não descarta (às vezes o dado é bom), mas MARCA,
// para a pessoa decidir sabendo. Medido: valor.globo.com/patrocinado/dino apareceu com score 0,791.
function ehPatrocinado(url) {
  return /\/(patrocinado|publieditorial|branded|conteudo-de-marca|dino|sponsored)\b/i.test(String(url || ""));
}

function dominioDe(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, "").toLowerCase(); } catch (e) { return ""; }
}

// ---- Cache local ------------------------------------------------------------
// A Tavily é determinística: 3 chamadas idênticas deram sobreposição de URLs 1,00. Clicar de novo
// custaria 2 créditos para receber o mesmo. 6h cobre a sessão de trabalho sem servir notícia velha.
function lerCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) || {}; } catch (e) { return {}; }
}
function gravaCache(chave, valor) {
  try {
    const c = lerCache();
    c[chave] = { at: Date.now(), valor };
    // Poda o que já venceu, para o arquivo não crescer para sempre.
    const lim = Date.now() - RESEARCH_CACHE_TTL_H * 3600 * 1000;
    for (const k of Object.keys(c)) if (!c[k] || c[k].at < lim) delete c[k];
    fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(c), "utf8");
  } catch (e) { /* cache é otimização, nunca bloqueia */ }
}
function doCache(chave) {
  const c = lerCache()[chave];
  if (!c) return null;
  if (Date.now() - c.at > RESEARCH_CACHE_TTL_H * 3600 * 1000) return null;
  return c.valor;
}

// ---- A busca ----------------------------------------------------------------
// buscaFatos({ pillar, alternativa }) ->
//   { available, cartoes[], descartados{...}, creditos, query, doCache } | { available:false, reason }
async function buscaFatos({ pillar, alternativa } = {}) {
  const key = getKey();
  if (!key) return { available: false, reason: "no_key" };
  const tavily = loadTavily();
  if (!tavily) return { available: false, reason: "no_sdk" };

  const tabela = RESEARCH_QUERIES[pillar] || RESEARCH_QUERIES.curiosidade_mercado;
  const query = alternativa ? tabela.alternativa : tabela.principal;
  const chaveCache = (alternativa ? "alt:" : "pri:") + (pillar || "curiosidade_mercado");
  const cacheado = doCache(chaveCache);
  if (cacheado) return Object.assign({}, cacheado, { doCache: true });

  const client = tavily({ apiKey: key });
  let res;
  try {
    res = await client.search(query, {
      topic: "news",
      days: 180,
      country: "brazil",
      searchDepth: "advanced",
      maxResults: 8,
      excludeDomains: RESEARCH_EXCLUDE_DOMAINS,
      includeUsage: true,
    });
  } catch (e) {
    return { available: false, reason: "erro_busca", detalhe: (e && e.message) || "" };
  }

  const bruto = (res && res.results) || [];
  const descartados = { relevancia: 0, sem_dado: 0, navegacao: 0, concorrente: 0, comparativo: 0, repetido: 0 };
  const rejeitados = [];   // só para calibragem/diagnóstico: NÃO vai para a tela
  const vistos = new Set();
  const cartoes = [];
  for (const r of bruto) {
    const url = String(r.url || "");
    const dom = dominioDe(url);
    const titulo = String(r.title || "").trim();
    const texto = String(r.content || "").replace(/\s+/g, " ").trim();
    if (vistos.has(url) || vistos.has(titulo)) { descartados.repetido++; continue; }
    vistos.add(url); vistos.add(titulo);
    if (Number(r.score || 0) < RESEARCH_SCORE_MIN) { descartados.relevancia++; rejeitados.push({ p: "relevancia", s: Number(r.score||0), t: titulo.slice(0,70) }); continue; }
    if (ehComparativo(titulo, url)) { descartados.comparativo++; continue; }
    if (citaConcorrente(titulo + " " + texto + " " + dom) || nomeProprioComPercentual(texto)) { descartados.concorrente++; continue; }
    if (ehNavegacao(texto)) { descartados.navegacao++; continue; }
    if (!temDado(texto)) { descartados.sem_dado++; continue; }
    cartoes.push({
      fato: texto.slice(0, 300),
      veiculo: dom,
      titulo: titulo.slice(0, 140),
      url,
      data: dataISO(r.publishedDate),
      score: Number(r.score || 0),
      patrocinado: ehPatrocinado(url),
    });
    if (cartoes.length >= RESEARCH_MAX_ACEITOS) break;
  }
  const saida = {
    available: true,
    cartoes,
    descartados,
    examinados: bruto.length,
    _rejeitados: rejeitados,   // diagnóstico interno (a rota não devolve isto)
    creditos: (res && res.usage && res.usage.credits) || 0,
    query,
    pillar: pillar || "curiosidade_mercado",
    alternativa: !!alternativa,
  };
  gravaCache(chaveCache, saida);
  return saida;
}

// Revalida no SERVIDOR o que o cliente diz ter aceitado. Sem isto, o campo seria uma porta para
// injetar texto arbitrário no prompt de geração — o mesmo funil de segurança roda de novo aqui.
function validaAceitos(lista) {
  if (!Array.isArray(lista)) return [];
  const out = [];
  for (const f of lista.slice(0, RESEARCH_MAX_ACEITOS)) {
    if (!f || typeof f !== "object") continue;
    const fato = String(f.fato || "").replace(/\s+/g, " ").trim().slice(0, 300);
    const veiculo = String(f.veiculo || "").slice(0, 60);
    const url = String(f.url || "").slice(0, 400);
    if (fato.length < 20) continue;
    if (!temDado(fato)) continue;
    if (citaConcorrente(fato + " " + veiculo + " " + url) || nomeProprioComPercentual(fato)) continue;
    if (ehComparativo(String(f.titulo || ""), url)) continue;
    out.push({ fato, veiculo, url, data: String(f.data || "").slice(0, 10) });
  }
  return out;
}

// Salva a chave Tavily em interface/data/ e no processo — sem reiniciar. NUNCA loga/retorna o valor.
function saveKey(key) {
  const clean = String(key || "").trim();
  if (clean.length < 8) throw new Error("chave Tavily inválida (muito curta)");
  try { fs.mkdirSync(PATHS.DATA_DIR, { recursive: true }); } catch (e) { /* já existe */ }
  fs.writeFileSync(TAVILY_FILE, JSON.stringify({ key: clean }) + "\n", { encoding: "utf8", mode: 0o600 });
  process.env.TAVILY_API_KEY = clean;
  return true;
}

// Testa a chave fazendo uma busca mínima. Retorna { ok, results } ou { ok:false, error }.
async function testKey() {
  const key = getKey();
  if (!key) return { ok: false, error: "Sem chave Tavily salva." };
  const tavily = loadTavily();
  if (!tavily) return { ok: false, error: "SDK @tavily/core não está instalado no servidor." };
  try {
    const client = tavily({ apiKey: key });
    const res = await client.search("comercio eletronico brasileiro", { maxResults: 1 });
    return { ok: true, results: (res.results || []).length };
  } catch (e) { return { ok: false, error: (e && e.message) || "falha ao testar a chave" }; }
}

module.exports = {
  buscaFatos, validaAceitos, isConfigured, saveKey, testKey,
  // expostas para teste/uso do gate de saída
  citaConcorrente, nomeProprioComPercentual, ehComparativo, temDado,
};
