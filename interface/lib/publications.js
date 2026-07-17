// lib/publications.js — HISTÓRICO de publicações reais no Instagram (agendadas OU diretas).
// Antes só as agendadas deixavam rastro (schedule.json); aqui registramos TODA publicação que
// foi ao ar, pra a aba "Publicados" ser completa. Append-only. Estado em data/publications.json.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS } = require("./config");

const FILE = path.join(PATHS.DATA_DIR, "publications.json");

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return []; } }
function save(list) {
  if (!fs.existsSync(PATHS.DATA_DIR)) fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

// Registra uma publicação real. rec: { folder, label?, kind?, caption?, post_id?, permalink?,
// scheduled_at? (null se direta), by? }. Evita duplicar o MESMO post (idempotência por post_id).
function add(rec) {
  rec = rec || {};
  const list = load();
  if (rec.post_id && list.some((x) => x.post_id === rec.post_id)) return null;
  const item = {
    id: crypto.randomBytes(8).toString("hex"),
    folder: String(rec.folder || ""),
    label: String(rec.label || rec.folder || ""),
    kind: rec.kind || null,
    caption: rec.caption || null,
    post_id: rec.post_id || null,
    permalink: rec.permalink || null,
    scheduled_at: rec.scheduled_at || null, // preenchido = veio de agendamento
    by: rec.by || null,
    published_at: new Date().toISOString(),
  };
  list.push(item); save(list); return item;
}
// Mais recentes primeiro.
function list() { return load().slice().sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))); }

module.exports = { add, list };
