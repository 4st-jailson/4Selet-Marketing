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
  return new Anthropic({ apiKey: getApiKey() });
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
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
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
  const msg = await client().messages.create({
    model: usedModel,
    max_tokens: maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
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
