// lib/collections.js — CRUD de coleções (1 arquivo JSON por coleção em ../collections).
// Coleção = agrupamento CURADO de peças, com ordem própria. Funciona por REFERÊNCIA:
// guarda só os identificadores das peças (pasta <task>_<date>), nunca move nem copia
// arquivos. Por isso:
//   - excluir a coleção não afeta nenhuma peça;
//   - excluir/descartar uma peça vira referência órfã, ignorada na leitura (a ref é
//     mantida — se a peça for restaurada, ela reaparece na coleção);
//   - a mesma peça pode estar em N coleções;
//   - a ORDEM é a própria ordem de `item_ids` (preparada para virar sequência de
//     postagem / playlist / destaques no futuro).
// Coleções NÃO substituem tags (metadado de busca) nem campanhas (agrupamento de marketing).
"use strict";
const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");

function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const tzH = pad(Math.floor(Math.abs(tzMin) / 60));
  const tzM = pad(Math.abs(tzMin) % 60);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
    sign + tzH + ":" + tzM;
}

function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "colecao";
}

function ensureDir() { fs.mkdirSync(PATHS.COLLECTIONS_DIR, { recursive: true }); }
function filePath(id) { return path.join(PATHS.COLLECTIONS_DIR, id + ".json"); }
function readJson(p) {
  const raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  return JSON.parse(raw);
}
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, p);
}

// Garante a forma canônica (campos esperados) ao ler de disco.
function normalize(c) {
  return {
    id: c.id,
    name: c.name || "",
    description: c.description || "",
    cover: c.cover || "",
    item_ids: Array.isArray(c.item_ids) ? c.item_ids.filter((x) => typeof x === "string") : [],
    created_at: c.created_at || "",
    updated_at: c.updated_at || "",
  };
}

function list() {
  ensureDir();
  const out = [];
  for (const f of fs.readdirSync(PATHS.COLLECTIONS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try { out.push(normalize(readJson(path.join(PATHS.COLLECTIONS_DIR, f)))); } catch (e) { /* ignora corrompido */ }
  }
  out.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return out;
}

function get(id) {
  const p = filePath(id);
  if (!fs.existsSync(p)) return null;
  return normalize(readJson(p));
}

function uniqueId(base) {
  let id = base, n = 2;
  while (fs.existsSync(filePath(id))) { id = base + "-" + n; n++; }
  return id;
}

function create(obj) {
  ensureDir();
  const now = nowIso();
  const id = obj.id && /^[a-z0-9][a-z0-9_\-]*$/.test(obj.id) ? obj.id : uniqueId(slugify(obj.name));
  if (fs.existsSync(filePath(id))) { const e = new Error("E_COLLECTION_EXISTS: id ja existe: " + id); e.code = "E_COLLECTION_EXISTS"; throw e; }
  const collection = {
    id,
    name: String(obj.name).trim(),
    description: obj.description ? String(obj.description).trim() : "",
    cover: "",
    item_ids: [],
    created_at: now,
    updated_at: now,
  };
  writeJsonAtomic(filePath(id), collection);
  return collection;
}

function save(cur) {
  cur.updated_at = nowIso();
  writeJsonAtomic(filePath(cur.id), cur);
  return cur;
}

function notFound(id) { const e = new Error("E_COLLECTION_NOT_FOUND: " + id); e.code = "E_COLLECTION_NOT_FOUND"; return e; }

function update(id, patch) {
  const cur = get(id);
  if (!cur) throw notFound(id);
  if (patch.name !== undefined) cur.name = String(patch.name).trim();
  if (patch.description !== undefined) cur.description = String(patch.description).trim();
  // cover só é aceita se a peça já estiver na coleção (capa = uma das peças).
  if (patch.cover !== undefined) {
    cur.cover = (patch.cover && cur.item_ids.includes(patch.cover)) ? patch.cover : "";
  }
  return save(cur);
}

function remove(id) {
  const p = filePath(id);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

// Adiciona uma peça ao fim (idempotente — não duplica). A ordem fica em item_ids.
function addItem(id, folder) {
  const cur = get(id);
  if (!cur) throw notFound(id);
  if (typeof folder === "string" && folder && !cur.item_ids.includes(folder)) {
    cur.item_ids.push(folder);
    return save(cur);
  }
  return cur;
}

// Remove uma peça da coleção (não toca na peça em si). Limpa a capa se for ela.
function removeItem(id, folder) {
  const cur = get(id);
  if (!cur) throw notFound(id);
  const before = cur.item_ids.length;
  cur.item_ids = cur.item_ids.filter((f) => f !== folder);
  if (cur.cover === folder) cur.cover = "";
  if (cur.item_ids.length !== before) return save(cur);
  return cur;
}

// Reordena item_ids conforme a lista recebida. Só mantém ids que já pertencem à
// coleção; ids ausentes na nova ordem são anexados ao fim (não some nada por engano).
function reorder(id, order) {
  const cur = get(id);
  if (!cur) throw notFound(id);
  const owned = new Set(cur.item_ids);
  const seen = new Set();
  const next = [];
  for (const f of (Array.isArray(order) ? order : [])) {
    if (owned.has(f) && !seen.has(f)) { next.push(f); seen.add(f); }
  }
  for (const f of cur.item_ids) { if (!seen.has(f)) next.push(f); }
  cur.item_ids = next;
  return save(cur);
}

// Quais coleções contêm uma dada peça (para mostrar no detalhe da peça).
function collectionsForFolder(folder) {
  return list().filter((c) => c.item_ids.includes(folder));
}

module.exports = {
  list, get, create, update, remove, addItem, removeItem, reorder, slugify, nowIso,
};
