// routes/collections.js — CRUD de coleções + resolução por referência.
// A coleção guarda só identificadores de peças (item_ids, em ordem). Aqui resolvemos
// esses ids contra o estado real das tasks (content.listTasks): refs órfãs (peça
// descartada/inexistente) são IGNORADAS na leitura, sem apagar a referência.
"use strict";
const express = require("express");
const router = express.Router();
const collections = require("../lib/collections");
const content = require("../lib/content");
const { validateCollection } = require("../lib/validation");

// Mapa pasta -> resumo da task (uma leitura por requisição).
function taskIndex() {
  const idx = {};
  for (const t of content.listTasks()) idx[t.folder] = t;
  return idx;
}

// Capa de uma coleção: a peça marcada como capa (se existir) ou a 1ª peça válida.
function coverOf(c, idx) {
  const pick = (folder) => {
    const t = folder && idx[folder];
    if (t && t.thumb && t.thumb.rel) return { folder: t.folder, rel: t.thumb.rel, type: t.thumb.type };
    return null;
  };
  if (c.cover) { const cv = pick(c.cover); if (cv) return cv; }
  for (const f of c.item_ids) { const cv = pick(f); if (cv) return cv; }
  return null;
}

router.get("/", (req, res) => {
  const idx = taskIndex();
  const out = collections.list().map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    cover: coverOf(c, idx),
    item_ids: c.item_ids,
    count: c.item_ids.filter((f) => idx[f]).length,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));
  res.json({ collections: out });
});

router.post("/", (req, res) => {
  const v = validateCollection(req.body);
  if (!v.ok) return res.status(400).json({ error: "validacao falhou", errors: v.errors });
  try {
    const c = collections.create(req.body);
    res.status(201).json({ collection: c });
  } catch (e) {
    res.status(e.code === "E_COLLECTION_EXISTS" ? 409 : 500).json({ error: e.message, code: e.code });
  }
});

router.get("/:id", (req, res) => {
  const c = collections.get(req.params.id);
  if (!c) return res.status(404).json({ error: "colecao nao encontrada" });
  const idx = taskIndex();
  // peças resolvidas, na ordem de item_ids; refs órfãs ignoradas.
  const items = c.item_ids.map((f) => idx[f]).filter(Boolean);
  const orphans = c.item_ids.filter((f) => !idx[f]).length;
  res.json({ collection: c, items, orphans });
});

router.put("/:id", (req, res) => {
  const v = validateCollection(Object.assign({ name: "xxx" }, req.body));
  if (!v.ok) return res.status(400).json({ error: "validacao falhou", errors: v.errors });
  try {
    res.json({ collection: collections.update(req.params.id, req.body) });
  } catch (e) {
    res.status(e.code === "E_COLLECTION_NOT_FOUND" ? 404 : 500).json({ error: e.message, code: e.code });
  }
});

router.delete("/:id", (req, res) => {
  const ok = collections.remove(req.params.id);
  res.status(ok ? 200 : 404).json({ ok });
});

router.post("/:id/items", (req, res) => {
  const folder = req.body && req.body.folder;
  if (!folder || typeof folder !== "string") return res.status(400).json({ error: "folder e obrigatorio" });
  if (!content.findTask(folder)) return res.status(404).json({ error: "peca nao encontrada: " + folder });
  try {
    res.json({ collection: collections.addItem(req.params.id, folder) });
  } catch (e) {
    res.status(e.code === "E_COLLECTION_NOT_FOUND" ? 404 : 500).json({ error: e.message, code: e.code });
  }
});

router.delete("/:id/items/:folder", (req, res) => {
  try {
    res.json({ collection: collections.removeItem(req.params.id, req.params.folder) });
  } catch (e) {
    res.status(e.code === "E_COLLECTION_NOT_FOUND" ? 404 : 500).json({ error: e.message, code: e.code });
  }
});

router.put("/:id/order", (req, res) => {
  const order = req.body && req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: "order deve ser uma lista de identificadores" });
  try {
    res.json({ collection: collections.reorder(req.params.id, order) });
  } catch (e) {
    res.status(e.code === "E_COLLECTION_NOT_FOUND" ? 404 : 500).json({ error: e.message, code: e.code });
  }
});

module.exports = router;
