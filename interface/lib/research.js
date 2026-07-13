// lib/research.js — pesquisa de mercado AO VIVO via Tavily para enriquecer a
// geracao do painel. Opt-in: so roda quando a rota pede (body.research === true).
// Degrada com elegancia: sem TAVILY_API_KEY ou sem @tavily/core -> { available:false }
// e a geracao segue normalmente (apenas sem o bloco de inteligencia de mercado).
"use strict";
const fs = require("fs");
const { PATHS } = require("./config");

let _tavily; // cache do require (undefined = nao tentou; null = indisponivel)
function loadTavily() {
  if (_tavily !== undefined) return _tavily;
  try {
    _tavily = require("@tavily/core").tavily;
  } catch (e) {
    _tavily = null;
  }
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
  return process.env.TAVILY_API_KEY || envFileVar("TAVILY_API_KEY") || "";
}

function isConfigured() {
  return !!getKey() && !!loadTavily();
}

// marketIntel(topic) -> { available, findings[], sources[], query_topic } | { available:false, reason }
async function marketIntel(topic, opts = {}) {
  const key = getKey();
  if (!key) return { available: false, reason: "no_key" };
  const tavily = loadTavily();
  if (!tavily) return { available: false, reason: "no_sdk" };

  const ano = new Date().getFullYear();
  const t = String(topic || "plataforma de pagamentos para produtor digital estabelecido")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const maxResults = Number(opts.maxResults) || 4;

  const queries = [
    { focus: "tendencias", q: `tendencias ${t} ${ano}` },
    { focus: "mercado", q: `taxas e prazos de plataformas de pagamento para infoproduto mercado ${ano}` },
    { focus: "ad_hooks", q: `angulos e hooks de anuncio que convertem ${t}` },
  ];

  const client = tavily({ apiKey: key });
  const findings = [];
  const sources = [];

  await Promise.all(
    queries.map(async ({ focus, q }) => {
      try {
        const res = await client.search(q, { maxResults, searchDepth: "advanced" });
        for (const r of res.results || []) {
          const snippet = String(r.content || "").replace(/\s+/g, " ").trim().slice(0, 220);
          if (!snippet) continue;
          findings.push(`[${focus}] ${r.title}: ${snippet}`);
          sources.push({ focus, title: r.title, url: r.url });
        }
      } catch (e) {
        // ignora foco que falhou; os demais ainda enriquecem o prompt
      }
    })
  );

  if (!findings.length) return { available: false, reason: "no_results" };
  return { available: true, findings, sources, query_topic: t };
}

// Salva a chave Tavily no interface/.env (mesmo arquivo/padrão da chave Anthropic) e no
// processo — sem reiniciar. NUNCA loga/retorna o valor.
function saveKey(key) {
  const clean = String(key || "").trim();
  if (clean.length < 8) throw new Error("chave Tavily inválida (muito curta)");
  let lines = [];
  try { lines = fs.readFileSync(PATHS.ENV_FILE, "utf8").split(/\r?\n/); } catch (e) { lines = []; }
  let found = false;
  lines = lines.map((l) => { if (/^\s*TAVILY_API_KEY\s*=/.test(l)) { found = true; return "TAVILY_API_KEY=" + clean; } return l; });
  if (!found) lines.push("TAVILY_API_KEY=" + clean);
  fs.writeFileSync(PATHS.ENV_FILE, lines.filter((l, i) => !(l === "" && i === lines.length - 1)).join("\n") + "\n", "utf8");
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
    const res = await client.search("4Selet plataforma de pagamentos para infoproduto", { maxResults: 1 });
    return { ok: true, results: (res.results || []).length };
  } catch (e) { return { ok: false, error: (e && e.message) || "falha ao testar a chave" }; }
}

module.exports = { marketIntel, isConfigured, saveKey, testKey };
