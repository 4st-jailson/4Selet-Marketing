// lib/pexels.js — busca de imagens de banco (Pexels) para as artes do painel.
// Mesmo padrao da chave Tavily (lib/research.js): opt-in, chave gravada em interface/data/pexels.json
// (volume gravavel), degrada com elegancia sem a chave. NUNCA loga/retorna o valor da chave.
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const { PATHS } = require("./config");

const PEXELS_FILE = path.join(PATHS.DATA_DIR, "pexels.json");

function dataFileKey() {
  try { return (JSON.parse(fs.readFileSync(PEXELS_FILE, "utf8")).key || "").trim(); } catch (e) { return ""; }
}
// Le uma variavel do interface/.env (mesmo fallback duravel da chave Anthropic/Tavily).
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
  return process.env.PEXELS_API_KEY || dataFileKey() || envFileVar("PEXELS_API_KEY") || "";
}
function isConfigured() { return !!getKey(); }

// GET https com header Authorization = chave. Resolve o JSON.
function apiGet(urlStr, key) {
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, { headers: { Authorization: key, "User-Agent": "4Selet-Painel" } }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        if (res.statusCode === 401) return reject(new Error("chave Pexels invalida (401)"));
        if (res.statusCode === 429) return reject(new Error("limite da Pexels atingido (429) — aguarde e tente de novo"));
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error("Pexels HTTP " + res.statusCode));
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("resposta invalida da Pexels")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout na Pexels")));
  });
}

// Cores aceitas pela Pexels (filtro opcional da busca avancada).
const PEXELS_COLORS = ["red", "orange", "yellow", "green", "turquoise", "blue", "violet", "pink", "brown", "black", "gray", "white"];
// search(query, opts) -> { ok, photos:[...], total, page, perPage, hasMore }
// opts: { perPage, page, orientation(landscape|portrait|square), color(nome|hex 6 dig), size(large|medium|small) }
async function search(query, opts = {}) {
  const key = getKey();
  if (!key) return { ok: false, error: "no_key" };
  const q = String(query || "").trim().slice(0, 100);
  if (!q) return { ok: false, error: "busca vazia" };
  // Ate 80 (limite da Pexels): o modal compacto pede 24; a pagina avancada pede mais.
  const perPage = Math.max(1, Math.min(80, Number(opts.perPage) || 24));
  const page = Math.max(1, Number(opts.page) || 1);
  const orient = /^(landscape|portrait|square)$/.test(opts.orientation || "") ? "&orientation=" + opts.orientation : "";
  const colorRaw = String(opts.color || "").toLowerCase().replace(/^#/, "");
  const color = (PEXELS_COLORS.includes(colorRaw) || /^[0-9a-f]{6}$/.test(colorRaw)) ? "&color=" + encodeURIComponent(colorRaw) : "";
  const size = /^(large|medium|small)$/.test(opts.size || "") ? "&size=" + opts.size : "";
  // ATENCAO: NAO usar &locale=pt-BR — a Pexels IGNORA o filtro &color quando o locale esta setado
  // (cor amarela/vermelha voltavam identicas a busca sem cor, e o total_results ficava sempre 8000/
  // nao refletia os filtros). Sem locale, cor+tamanho+orientacao filtram de verdade e o total bate.
  // A busca multilingue da Pexels entende o termo em portugues mesmo sem locale (validado).
  const url = "https://api.pexels.com/v1/search?query=" + encodeURIComponent(q) + "&per_page=" + perPage + "&page=" + page + orient + color + size;
  try {
    const j = await apiGet(url, key);
    const photos = (j.photos || []).map((p) => ({
      id: p.id,
      thumb: (p.src && (p.src.medium || p.src.small || p.src.tiny)) || "",
      full: (p.src && (p.src.large2x || p.src.large || p.src.original)) || "",
      alt: p.alt || "",
      photographer: p.photographer || "",
      photographer_url: p.photographer_url || "",
      width: p.width, height: p.height,
      avg_color: p.avg_color || "", // cor média da foto — usada p/ REFINAR o filtro de cor no front
    })).filter((p) => p.full);
    const total = j.total_results || photos.length;
    // hasMore: a Pexels manda next_page quando ha mais; confirmamos pela contagem tambem.
    const hasMore = !!j.next_page || (page * perPage) < total;
    return { ok: true, photos, total, page, perPage, hasMore };
  } catch (e) { return { ok: false, error: (e && e.message) || "falha na busca Pexels" }; }
}

// Baixa uma imagem (SO de *.pexels.com) e devolve { buffer, contentType }. Usado p/ salvar SO a foto escolhida.
function fetchImage(urlStr) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(String(urlStr)); } catch (e) { return reject(new Error("url invalida")); }
    if (u.protocol !== "https:" || !/(^|\.)pexels\.com$/i.test(u.hostname)) return reject(new Error("url nao e da Pexels"));
    const req = https.get(u.href, { headers: { "User-Agent": "4Selet-Painel" } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
      const ct = res.headers["content-type"] || "";
      if (!/^image\//i.test(ct)) { res.resume(); return reject(new Error("resposta nao e imagem")); }
      const chunks = []; let size = 0;
      res.on("data", (c) => { chunks.push(c); size += c.length; if (size > 15 * 1024 * 1024) req.destroy(new Error("imagem muito grande")); });
      res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: ct }));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("timeout ao baixar a imagem")));
  });
}

// Salva a chave em interface/data/pexels.json (mode 0600) e no processo. NUNCA loga/retorna o valor.
function saveKey(key) {
  const clean = String(key || "").trim();
  if (clean.length < 16) throw new Error("chave Pexels invalida (muito curta)");
  try { fs.mkdirSync(PATHS.DATA_DIR, { recursive: true }); } catch (e) { /* ja existe */ }
  fs.writeFileSync(PEXELS_FILE, JSON.stringify({ key: clean }) + "\n", { encoding: "utf8", mode: 0o600 });
  process.env.PEXELS_API_KEY = clean;
  return true;
}

// Testa a chave com uma busca minima. Retorna { ok, results } ou { ok:false, error }.
async function testKey() {
  const key = getKey();
  if (!key) return { ok: false, error: "Sem chave Pexels salva." };
  try {
    const j = await apiGet("https://api.pexels.com/v1/search?query=business&per_page=1", key);
    return { ok: true, results: (j.photos || []).length };
  } catch (e) { return { ok: false, error: (e && e.message) || "falha ao testar a chave" }; }
}

module.exports = { search, fetchImage, isConfigured, saveKey, testKey, getKey };
