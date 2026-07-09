// lib/openai.js — cliente OpenAI (ChatGPT) via fetch nativo (sem dependencia extra).
// MESMA interface do lib/anthropic.js (hasKey/getModel/complete/testKey/saveApiKey/
// saveModel/maskKey) para o dispatcher lib/ai.js escolher o provedor. Suporta visao
// (blocos image_url). Sem chave -> simulador rotulado, igual ao adaptador Anthropic.
"use strict";
const fs = require("fs");
const { PATHS } = require("./config");

// Modelo com visao, amplamente disponivel. O modelo EXATO e configuravel em
// Configuracoes (OPENAI_MODEL) — este e so o padrao inicial.
const DEFAULT_MODEL = "gpt-4o";
const API_URL = "https://api.openai.com/v1/chat/completions";

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

function getApiKey() { return process.env.OPENAI_API_KEY || readEnvFile().OPENAI_API_KEY || ""; }
function getModel() { return process.env.OPENAI_MODEL || readEnvFile().OPENAI_MODEL || DEFAULT_MODEL; }
function hasKey() { const k = getApiKey(); return typeof k === "string" && k.trim().length > 10; }
function saveApiKey(key) {
  const clean = String(key || "").trim();
  if (clean.length < 10) throw new Error("chave invalida (muito curta)");
  writeEnvVar("OPENAI_API_KEY", clean); process.env.OPENAI_API_KEY = clean; return true;
}
function saveModel(model) {
  const clean = String(model || "").trim() || DEFAULT_MODEL;
  writeEnvVar("OPENAI_MODEL", clean); process.env.OPENAI_MODEL = clean; return clean;
}
function maskKey(k) {
  const key = k || getApiKey(); if (!key) return "";
  if (key.length <= 12) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

// content do usuario: texto puro, ou [texto, image_url...] quando ha imagens (visao).
function userContent(prompt, images) {
  const imgs = (Array.isArray(images) ? images : [])
    .filter((u) => typeof u === "string" && /^(data:image\/|https?:\/\/)/i.test(u)).slice(0, 8);
  if (!imgs.length) return prompt;
  return [{ type: "text", text: prompt }].concat(imgs.map((url) => ({ type: "image_url", image_url: { url } })));
}

function mapError(status, body) {
  const detail = (body && body.error && body.error.message) || "";
  let msg;
  if (status === 401) msg = "Chave da OpenAI inválida ou sem permissão — verifique em Configurações.";
  else if (status === 429) msg = "Limite de requisições da OpenAI atingido. Aguarde e tente de novo.";
  else if (/quota|billing|insufficient_quota/i.test(detail)) msg = "Sem créditos/quota na OpenAI — verifique o billing da sua conta OpenAI.";
  else if (status >= 500) msg = "A API da OpenAI está instável no momento. Tente novamente.";
  else msg = detail || ("A OpenAI recusou a requisição (HTTP " + status + ").");
  const err = new Error(msg);
  err.status = status === 429 ? 429 : (status === 401 ? 401 : (status >= 500 ? 502 : (status || 500)));
  err.code = "E_AI_OPENAI_" + (status || "UNKNOWN");
  return err;
}

async function testKey() {
  if (!hasKey()) return { ok: false, error: "nenhuma chave configurada" };
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getApiKey() },
      body: JSON.stringify({ model: getModel(), max_tokens: 8, messages: [{ role: "user", content: "responda apenas: ok" }] }),
    });
    if (!r.ok) { let b = null; try { b = await r.json(); } catch (_) {} return { ok: false, error: mapError(r.status, b).message }; }
    const data = await r.json();
    return { ok: true, model: data.model || getModel() };
  } catch (e) { return { ok: false, error: (e && e.message) || "falha ao conectar na OpenAI" }; }
}

// Mesma assinatura do anthropic.complete: { system, prompt, images?, maxTokens?, model?, simulate? }.
async function complete(opts) {
  const maxTokens = opts.maxTokens || 2000;
  if (!hasKey()) {
    const text = typeof opts.simulate === "function" ? opts.simulate() : "[conteudo simulado — configure a chave OpenAI em Configuracoes]";
    return { text, simulated: true, model: "simulado" };
  }
  const model = opts.model || getModel();
  const messages = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: userContent(opts.prompt, opts.images) });
  const imgN = Array.isArray(opts.images) ? opts.images.length : 0;
  console.log("[ai] req (openai) " + new Date().toISOString() + " model=" + model + " max_out=" + maxTokens + (imgN ? " imgs=" + imgN : ""));
  let r, data;
  try {
    r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getApiKey() },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });
    data = await r.json();
  } catch (e) {
    const err = new Error("Falha de conexão com a API da OpenAI. Verifique a internet e tente de novo.");
    err.status = 502; err.code = "E_AI_OPENAI_CONN"; throw err;
  }
  if (!r.ok) {
    const mapped = mapError(r.status, data);
    console.warn("[ai] erro openai " + (mapped.code || "") + ": " + mapped.message);
    throw mapped;
  }
  const text = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
  const usage = data.usage || {};
  console.log("[ai] res (openai) model=" + (data.model || model) + " out=" + (usage.completion_tokens != null ? usage.completion_tokens : "?"));
  return { text, simulated: false, model: data.model || model, usage };
}

module.exports = { DEFAULT_MODEL, getApiKey, getModel, hasKey, saveApiKey, saveModel, testKey, complete, maskKey };
