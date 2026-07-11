// lib/media_tokens.js — links PÚBLICOS TEMPORÁRIOS de mídia.
// A Meta precisa BUSCAR a imagem numa URL pública (a arte do painel fica atrás de login).
// Aqui a gente cunha um token opaco (curta duração) que aponta pra um arquivo de arte
// específico; a rota pública GET /m/:token serve só esse arquivo, e o token EXPIRA.
// Em memória de propósito: some no restart (nenhum link fica válido pra sempre).
"use strict";
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const TTL_MS = 20 * 60 * 1000; // 20 min — folga p/ a Meta processar o contêiner
const store = new Map(); // token -> { abs, exp }

function sweep() {
  const now = Date.now();
  for (const [t, v] of store) { if (v.exp < now) store.delete(t); }
}
setInterval(sweep, 5 * 60 * 1000).unref();

// Cunha um token para um arquivo ABSOLUTO existente. Retorna o token.
function mint(absPath) {
  const abs = path.resolve(String(absPath));
  if (!fs.existsSync(abs)) { const e = new Error("arquivo de mídia não existe"); e.code = "E_NO_MEDIA"; throw e; }
  const token = crypto.randomBytes(20).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  store.set(token, { abs, exp: Date.now() + TTL_MS });
  return token;
}

// Resolve um token para o caminho absoluto (ou null se inválido/expirado).
function resolve(token) {
  const v = store.get(String(token || ""));
  if (!v) return null;
  if (v.exp < Date.now()) { store.delete(token); return null; }
  return v.abs;
}

module.exports = { mint, resolve, TTL_MS };
