// scripts/lib/content_hash.js — utilitario SHA-256 por arquivo / por pasta.
// Usado por promote_task (gravar) e check_approved_integrity (verificar).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function hashFile(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Retorna { "rel/path": "<sha256>", ... } excluindo paths em `exclude`.
// Caminhos relativos sempre com "/" (cross-platform).
function hashDirectory(dir, exclude) {
  const excludeSet = new Set(exclude || []);
  const out = {};
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      const rel = path.relative(dir, full).replace(/\\/g, "/");
      if (excludeSet.has(rel)) continue;
      out[rel] = hashFile(full);
    }
  }
  walk(dir);
  return out;
}

// Compara dois maps de hashes e retorna divergencias.
// Cada divergencia: { rel, kind: "missing"|"modified"|"added" }
function diffHashes(stored, current) {
  const out = [];
  for (const rel of Object.keys(stored)) {
    if (!(rel in current)) out.push({ rel, kind: "missing" });
    else if (current[rel] !== stored[rel]) out.push({ rel, kind: "modified" });
  }
  for (const rel of Object.keys(current)) {
    if (!(rel in stored)) out.push({ rel, kind: "added" });
  }
  return out;
}

module.exports = { hashFile, hashDirectory, diffHashes };
