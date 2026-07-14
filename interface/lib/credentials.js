// lib/credentials.js — credenciais de integração inseridas PELO PAINEL (admin).
// Grava em interface/data/credentials.json (volume GRAVÁVEL) — o .env em prod é montado
// read-only, então não dá pra escrever lá (mesmo motivo do Tavily em data/tavily.json).
// No boot, loadIntoEnv() joga os valores no process.env; o envHas() das integrações
// (routes/settings.js) já lê process.env, então o status reflete sem código extra.
// NUNCA retorna os VALORES ao front — só os nomes das variáveis gravadas.
"use strict";
const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");

const CREDS_FILE = path.join(PATHS.DATA_DIR, "credentials.json");
// Nome de variável de ambiente: MAIÚSCULA, dígitos e underscore (ex.: REDIS_URL).
const NAME_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

function readAll() {
  try { const o = JSON.parse(fs.readFileSync(CREDS_FILE, "utf8")); return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}

// Carrega as credenciais gravadas para o process.env. Chamada UMA vez no boot.
// NÃO sobrescreve o que já veio do ambiente real (Docker/.env têm prioridade).
function loadIntoEnv() {
  const all = readAll();
  for (const [k, v] of Object.entries(all)) {
    if (!process.env[k] && v != null && String(v).trim()) process.env[k] = String(v);
  }
}

// Grava/atualiza UMA credencial. Vale imediatamente pra quem lê process.env em runtime;
// integrações que só conectam no boot (ex.: fila Redis) passam a valer no próximo restart.
function saveCred(name, value) {
  const n = String(name || "").trim().toUpperCase();
  if (!NAME_RE.test(n)) throw new Error("nome de variável inválido — use MAIÚSCULAS_COM_UNDERSCORE (ex.: REDIS_URL)");
  const val = String(value == null ? "" : value).trim();
  if (!val) throw new Error("valor vazio");
  const all = readAll();
  all[n] = val;
  try { fs.mkdirSync(PATHS.DATA_DIR, { recursive: true }); } catch (e) { /* já existe */ }
  fs.writeFileSync(CREDS_FILE, JSON.stringify(all, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  process.env[n] = val;
  return true;
}

// Só os NOMES gravados (nunca os valores) — pro front indicar o que já foi inserido.
function savedNames() { return Object.keys(readAll()); }

module.exports = { loadIntoEnv, saveCred, savedNames, CREDS_FILE };
