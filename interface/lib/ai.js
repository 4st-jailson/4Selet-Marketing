// lib/ai.js — dispatcher de provedores de IA. Escolhe o adaptador (Claude/OpenAI)
// POR CHAMADA (opts.provider, vindo da tela de geracao) ou pelo PADRAO (AI_PROVIDER
// no .env, controlado em Configuracoes). Mesma interface complete() dos adaptadores.
// Extensivel: para somar Gemini/outro, basta criar o adaptador e registrar em ADAPTERS.
"use strict";
const fs = require("fs");
const { PATHS } = require("./config");
const anthropic = require("./anthropic");
const openai = require("./openai");

const ADAPTERS = { anthropic, openai };
const PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "ChatGPT (OpenAI)" },
];

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

function defaultProvider() {
  const v = process.env.AI_PROVIDER || readEnvFile().AI_PROVIDER || "anthropic";
  return ADAPTERS[v] ? v : "anthropic";
}
function setDefaultProvider(id) {
  if (!ADAPTERS[id]) throw new Error("provedor invalido: " + id);
  writeEnvVar("AI_PROVIDER", id); process.env.AI_PROVIDER = id; return id;
}
function adapterFor(provider) { return ADAPTERS[provider] || ADAPTERS[defaultProvider()] || anthropic; }

// Roteia a geracao para o provedor pedido (ou o padrao). Devolve tambem qual provedor
// respondeu (p/ o front exibir "gerado com Claude/ChatGPT").
async function complete(opts) {
  opts = opts || {};
  const provider = (opts.provider && ADAPTERS[opts.provider]) ? opts.provider : defaultProvider();
  const r = await adapterFor(provider).complete(opts);
  return Object.assign({ provider }, r);
}

function providers() {
  const def = defaultProvider();
  return PROVIDERS.map((p) => {
    const a = ADAPTERS[p.id];
    return {
      id: p.id, label: p.label,
      configured: a.hasKey(), model: a.getModel(), default_model: a.DEFAULT_MODEL,
      masked_key: a.maskKey(), is_default: p.id === def,
    };
  });
}
function hasKey(provider) { return adapterFor(provider).hasKey(); }
function getModel(provider) { return adapterFor(provider).getModel(); }
function saveKey(provider, key) { return adapterFor(provider).saveApiKey(key); }
function saveModel(provider, model) { return adapterFor(provider).saveModel(model); }
function testKey(provider) { return adapterFor(provider).testKey(); }
function maskKey(provider) { return adapterFor(provider).maskKey(); }

module.exports = {
  complete, providers, defaultProvider, setDefaultProvider,
  saveKey, saveModel, testKey,
};
