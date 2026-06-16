// lib/anthropic.js — cliente Claude (Anthropic SDK) + storage da chave em .env +
// fallback SIMULADO rotulado quando nao ha chave (coerente com o projeto sem-chave).
"use strict";
const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");
const { PATHS } = require("./config");

const DEFAULT_MODEL = "claude-sonnet-4-6";

function readEnvFile() {
  try {
    const raw = fs.readFileSync(PATHS.ENV_FILE, "utf8");
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch (e) { return {}; }
}

function writeEnvVar(key, value) {
  let lines = [];
  try { lines = fs.readFileSync(PATHS.ENV_FILE, "utf8").split(/\r?\n/); } catch (e) { lines = []; }
  let found = false;
  lines = lines.map((l) => {
    if (new RegExp("^\\s*" + key + "\\s*=").test(l)) { found = true; return key + "=" + value; }
    return l;
  });
  if (!found) lines.push(key + "=" + value);
  fs.writeFileSync(PATHS.ENV_FILE, lines.filter((l, i) => !(l === "" && i === lines.length - 1)).join("\n") + "\n", "utf8");
}

function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const env = readEnvFile();
  return env.ANTHROPIC_API_KEY || "";
}

function getModel() {
  return process.env.MODEL || readEnvFile().MODEL || DEFAULT_MODEL;
}

function hasKey() {
  const k = getApiKey();
  return typeof k === "string" && k.trim().length > 10;
}

// Salva a chave em .env e no processo (sem reiniciar servidor).
function saveApiKey(key) {
  const clean = String(key || "").trim();
  if (clean.length < 10) throw new Error("chave invalida (muito curta)");
  writeEnvVar("ANTHROPIC_API_KEY", clean);
  process.env.ANTHROPIC_API_KEY = clean;
  return true;
}

function saveModel(model) {
  const clean = String(model || "").trim() || DEFAULT_MODEL;
  writeEnvVar("MODEL", clean);
  process.env.MODEL = clean;
  return clean;
}

function client() {
  // maxRetries baixo de proposito: o controle de 429 fica na fila/backoff de nivel-app
  // (createSerializedWithRetry), para nao empilhar dois backoffs (SDK + app) na mesma chamada.
  return new Anthropic({ apiKey: getApiKey(), maxRetries: 1, timeout: 90000 });
}

// Traduz erros do SDK Anthropic em mensagens claras (pt-BR) + status HTTP coerente.
// Retorna um Error com .status e .userMessage para o handler central repassar.
function mapAnthropicError(e) {
  const status = (e && typeof e.status === "number") ? e.status : null;
  let msg;
  if (status === 429) {
    let hint = "";
    try {
      const ra = e.headers && (e.headers["retry-after"] || e.headers.get && e.headers.get("retry-after"));
      if (ra) hint = " (sugerido aguardar ~" + ra + "s)";
    } catch (_) { /* headers opcional */ }
    msg = "Limite de requisições da API Anthropic atingido" + hint + ". Aguarde alguns segundos e clique de novo.";
  } else if (status === 401 || status === 403) {
    msg = "Chave da API inválida ou sem permissão — verifique a chave em Configurações.";
  } else if (status === 400 || status === 422) {
    msg = "A API recusou a requisição (conteúdo ou parâmetros inválidos). Ajuste o brief e tente de novo.";
  } else if (status && status >= 500) {
    msg = "A API da Anthropic está instável no momento. Tente novamente em instantes.";
  } else if (e && (e.name === "APIConnectionTimeoutError" || /timeout/i.test(e.message || ""))) {
    msg = "A IA demorou demais para responder (timeout). Tente novamente.";
  } else if (e && (e.name === "APIConnectionError" || /ECONN|ENOTFOUND|network/i.test(e.message || ""))) {
    msg = "Falha de conexão com a API da Anthropic. Verifique a internet e tente de novo.";
  } else {
    msg = (e && e.message) ? e.message : "Erro ao chamar a IA.";
  }
  const err = new Error(msg);
  err.status = status === 429 ? 429 : (status === 401 || status === 403 ? 401 : (status && status >= 500 ? 502 : (status || 500)));
  err.code = "E_AI_" + (status || "UNKNOWN");
  return err;
}

// --- Throttle: fila serializada + auto-retry em 429 ---------------------------
// A conta Anthropic pode ter limite baixo (Tier 1): rajadas de geracao batem 429.
// Em vez de devolver erro ao usuario, serializamos as chamadas (uma por vez, com
// um intervalo minimo entre os inicios) e re-tentamos sozinhos no 429 com backoff
// exponencial, respeitando o header retry-after quando presente. Efeito: sob
// limite a geracao fica mais LENTA, nunca quebra. Tunavel por env (AI_MIN_GAP_MS,
// AI_MAX_429_RETRIES, AI_BACKOFF_BASE_MS, AI_BACKOFF_MAX_MS).
const MIN_REQUEST_GAP_MS = Number(process.env.AI_MIN_GAP_MS || 1500);
const MAX_429_RETRIES = Number(process.env.AI_MAX_429_RETRIES || 6);
const BACKOFF_BASE_MS = Number(process.env.AI_BACKOFF_BASE_MS || 4000);
const BACKOFF_MAX_MS = Number(process.env.AI_BACKOFF_MAX_MS || 60000);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let _aiChain = Promise.resolve(); // cadeia de promessas = uma chamada por vez
let _aiLastStart = 0;             // timestamp do ultimo inicio (p/ o gap minimo)

// Serializa fn na fila global e garante o intervalo minimo entre os inicios.
function enqueue(fn) {
  const run = _aiChain.then(async () => {
    const wait = MIN_REQUEST_GAP_MS - (Date.now() - _aiLastStart);
    if (wait > 0) await sleep(wait);
    _aiLastStart = Date.now();
    return fn();
  });
  _aiChain = run.then(() => undefined, () => undefined); // a cadeia nao quebra em erro
  return run;
}

// Espera apos um 429: usa retry-after do header (se houver), senao backoff exp.
function retryDelayFor(e, attempt) {
  try {
    const h = e && e.headers;
    const v = h && (h["retry-after"] || (h.get && h.get("retry-after")));
    const ra = v != null ? parseInt(v, 10) : NaN;
    if (!Number.isNaN(ra)) return Math.min(ra * 1000 + 500, BACKOFF_MAX_MS);
  } catch (_) { /* header opcional */ }
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
}

// Cria a mensagem na fila, com auto-retry SOMENTE em 429 (rate limit). Outros erros
// sobem imediatamente (mapeados pelo chamador). Segura a vaga da fila durante o
// backoff de proposito: sob limite, disparar as proximas chamadas so geraria mais
// 429 — melhor esperar e liberar a fila ja com a janela de limite renovada.
function createSerializedWithRetry(params) {
  return enqueue(async () => {
    let attempt = 0;
    for (;;) {
      try {
        return await client().messages.create(params);
      } catch (e) {
        const status = (e && typeof e.status === "number") ? e.status : null;
        if (status === 429 && attempt < MAX_429_RETRIES) {
          const delay = retryDelayFor(e, attempt);
          attempt++;
          console.warn("[ai] 429 rate limit — aguardando " + Math.round(delay / 1000) + "s e re-tentando (" + attempt + "/" + MAX_429_RETRIES + ")");
          await sleep(delay);
          continue;
        }
        throw e;
      }
    }
  });
}

// Testa a chave com uma chamada minima. Retorna { ok, model?, error? }.
async function testKey() {
  if (!hasKey()) return { ok: false, error: "nenhuma chave configurada" };
  try {
    const msg = await client().messages.create({
      model: getModel(),
      max_tokens: 16,
      messages: [{ role: "user", content: "responda apenas: ok" }],
    });
    return { ok: true, model: msg.model };
  } catch (e) {
    return { ok: false, error: mapAnthropicError(e).message };
  }
}

// Geracao principal. Se nao houver chave, usa o simulador (rotulado).
// opts: { system, prompt, maxTokens?, model?, simulate? () => string }
async function complete(opts) {
  const maxTokens = opts.maxTokens || 2000;
  if (!hasKey()) {
    const text = typeof opts.simulate === "function" ? opts.simulate() : "[conteudo simulado — configure a chave Anthropic em Configuracoes]";
    return { text, simulated: true, model: "simulado" };
  }
  // #9 — Cada chamada e stateless (somente system + 1 mensagem do usuario, sem
  // historico acumulado). Log de auditoria compacto + alerta de contexto grande.
  const usedModel = opts.model || getModel();
  const approxIn = Math.round(((opts.system || "").length + (opts.prompt || "").length) / 4);
  if (approxIn > 150000) {
    console.warn("[ai] AVISO contexto grande ~" + approxIn + " tokens (perto do limite) — considere encurtar o brief/exemplos");
  }
  console.log("[ai] req " + new Date().toISOString() + " model=" + usedModel + " in≈" + approxIn + "tok max_out=" + maxTokens);
  let msg;
  try {
    msg = await createSerializedWithRetry({
      model: usedModel,
      max_tokens: maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
  } catch (e) {
    const mapped = mapAnthropicError(e);
    console.warn("[ai] erro " + (mapped.code || "") + ": " + mapped.message);
    throw mapped;
  }
  const usage = msg.usage || {};
  console.log("[ai] res model=" + msg.model + " in=" + (usage.input_tokens != null ? usage.input_tokens : "?") + " out=" + (usage.output_tokens != null ? usage.output_tokens : "?") + " stop=" + (msg.stop_reason || "?"));
  if (msg.stop_reason === "max_tokens") {
    console.warn("[ai] AVISO resposta truncada por max_tokens (" + maxTokens + ") — saida pode estar incompleta");
  }
  const text = (msg.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text, simulated: false, model: msg.model, stop_reason: msg.stop_reason || null, usage };
}

module.exports = {
  DEFAULT_MODEL,
  getApiKey,
  getModel,
  hasKey,
  saveApiKey,
  saveModel,
  testKey,
  complete,
  maskKey: (k) => {
    const key = k || getApiKey();
    if (!key) return "";
    if (key.length <= 12) return "****";
    return key.slice(0, 7) + "..." + key.slice(-4);
  },
};
