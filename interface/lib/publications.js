// lib/publications.js — HISTÓRICO de publicações reais no Instagram (agendadas OU diretas).
// Antes só as agendadas deixavam rastro (schedule.json); aqui registramos TODA publicação que
// foi ao ar, pra a aba "Publicados" ser completa. Append-only. Estado em data/publications.json.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS, DESTINO_IDS } = require("./config");

const FILE = path.join(PATHS.DATA_DIR, "publications.json");

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return []; } }
function save(list) {
  if (!fs.existsSync(PATHS.DATA_DIR)) fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

// Registra uma publicação real. rec: { folder, label?, kind?, caption?, post_id?, permalink?,
// scheduled_at? (null se direta), by?, published_at? (data informada), manual? (marcação manual) }.
// Evita duplicar o MESMO post (idempotência por post_id).
function add(rec) {
  rec = rec || {};
  const list = load();
  if (rec.post_id && list.some((x) => x.post_id === rec.post_id)) return null;
  const item = {
    id: crypto.randomBytes(8).toString("hex"),
    folder: String(rec.folder || ""),
    label: String(rec.label || rec.folder || ""),
    kind: rec.kind || null,
    // Destino da publicação. Registro antigo (sem o campo) e lido como "feed", que era o unico
    // destino que existia quando ele foi gravado — assim o historico nao fica com buraco.
    destino: DESTINO_IDS.indexOf(rec.destino) >= 0 ? rec.destino : "feed",
    caption: rec.caption || null,
    post_id: rec.post_id || null,
    permalink: rec.permalink || null,
    scheduled_at: rec.scheduled_at || null, // preenchido = veio de agendamento
    by: rec.by || null,
    manual: !!rec.manual, // marcada manualmente (publicação feita por fora do painel)
    published_at: rec.published_at || new Date().toISOString(),
  };
  list.push(item); save(list); return item;
}
// Mais recentes primeiro.
function list() { return load().slice().sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))); }

// Um registro pelo id. Devolve null se não existir.
function get(id) { return load().find((x) => x.id === String(id || "")) || null; }

// Tira a linha do histórico. Usado nos DOIS caminhos: depois de apagar de verdade no Instagram,
// e quando a pessoa já apagou pelo celular e o painel ficou anunciando um post que não existe
// mais (foi o caso do Story cortado de 19/08 — apagado à mão, e a lista continuava mostrando).
// `motivo` fica gravado no registro de saída para o histórico não perder a razão.
function remove(id, motivo, quem) {
  const list = load();
  const i = list.findIndex((x) => x.id === String(id || ""));
  if (i < 0) return null;
  const [fora] = list.splice(i, 1);
  save(list);
  return Object.assign({}, fora, { removido_em: new Date().toISOString(), removido_motivo: motivo || null, removido_por: quem || null });
}

module.exports = { add, list, get, remove };
