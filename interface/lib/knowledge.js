// lib/knowledge.js — carrega e cacheia os knowledge files oficiais da 4Selet
// para injetar como contexto de marca nos prompts de geracao.
"use strict";
const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");

const FILES = ["brand_identity.md", "product_campaign.md", "platform_guidelines.md"];

let _cache = null;

function loadAll() {
  if (_cache) return _cache;
  const out = {};
  for (const f of FILES) {
    const p = path.join(PATHS.KNOWLEDGE_DIR, f);
    try {
      out[f] = fs.readFileSync(p, "utf8");
    } catch (e) {
      out[f] = "";
    }
  }
  _cache = out;
  return out;
}

// Bloco de contexto de marca para o system prompt.
function brandContext() {
  const all = loadAll();
  const parts = [];
  for (const f of FILES) {
    if (all[f]) parts.push("===== " + f + " =====\n" + all[f].trim());
  }
  return parts.join("\n\n");
}

function reload() {
  _cache = null;
  return loadAll();
}

module.exports = { loadAll, brandContext, reload, FILES };
