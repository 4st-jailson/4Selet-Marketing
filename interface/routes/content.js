// routes/content.js — tasks (conteudo): listar, detalhar, ler arquivo, preview,
// promover (workflow de aprovacao). Integra os scripts oficiais via lib/content.
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const content = require("../lib/content");
const render = require("../lib/render");

router.get("/", (req, res) => {
  res.json({ tasks: content.listTasks() });
});

router.get("/:folder", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  // #4 — carimba a primeira visualizacao (remove o selo "Novo" na biblioteca).
  try { content.markViewed(req.params.folder); } catch (e) { /* nao critico */ }
  res.json({ task: t });
});

router.get("/:folder/file", (req, res) => {
  const rel = req.query.rel;
  if (!rel) return res.status(400).json({ error: "parametro rel obrigatorio" });
  const body = content.readFile(req.params.folder, String(rel));
  if (body == null) return res.status(404).json({ error: "arquivo nao encontrado" });
  res.type("text/plain").send(body);
});

// Serve um arquivo binario (imagem/video) inline para preview na biblioteca.
router.get("/:folder/raw", (req, res) => {
  const rel = req.query.rel;
  if (!rel) return res.status(400).json({ error: "parametro rel obrigatorio" });
  const f = content.resolveFile(req.params.folder, String(rel));
  if (!f) return res.status(404).json({ error: "arquivo nao encontrado" });
  // no-cache: o navegador revalida (o front ainda versiona por ?v=mtime p/ garantir).
  res.set("Cache-Control", "no-cache");
  res.sendFile(f.abs);
});

// Download com Content-Disposition (forca salvar o arquivo).
// ?scale=1|2|4 (so PNG): baixa a arte na resolucao escolhida — re-renderiza a peca
// a partir do HTML salvo. Sem `scale`, serve o arquivo salvo como esta. Se o
// re-render falhar (ex.: sem HTML de origem), cai para o arquivo salvo (degrada bem).
router.get("/:folder/download", async (req, res) => {
  const rel = req.query.rel;
  if (!rel) return res.status(400).json({ error: "parametro rel obrigatorio" });
  const wantsScale = req.query.scale != null && String(req.query.scale) !== "";
  if (wantsScale && /\.png$/i.test(String(rel))) {
    const scale = Math.max(1, Math.min(4, parseInt(req.query.scale, 10) || 1));
    try {
      const out = await render.renderForDownload(req.params.folder, String(rel), scale);
      const stem = path.basename(String(rel)).replace(/\.png$/i, "");
      const name = stem + "_" + out.width + "x" + out.height + ".png";
      return res.download(out.path, name, () => { if (out.temp) { try { fs.unlinkSync(out.path); } catch (e) {} } });
    } catch (e) {
      console.warn("[download] re-render em escala falhou (" + (e.code || "") + "): " + e.message + " — servindo arquivo salvo");
      // cai para servir o arquivo salvo abaixo
    }
  }
  const f = content.resolveFile(req.params.folder, String(rel));
  if (!f) return res.status(404).json({ error: "arquivo nao encontrado" });
  res.download(f.abs, f.name);
});

// #5 — Define as tags (rotulos livres) da task. Body: { tags: [] | "a,b,c" }.
router.post("/:folder/tags", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  const tags = (req.body && req.body.tags != null) ? req.body.tags : [];
  const saved = content.setTags(req.params.folder, tags);
  if (saved == null) return res.status(400).json({ error: "nao foi possivel salvar as tags" });
  res.json({ ok: true, tags: saved });
});

// Renderiza a midia final (PNG/MP4) a partir do conceito. ?kind=image|feed|carousel|video
router.post("/:folder/render", async (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  const kind = String((req.query.kind || req.body && req.body.kind || t.kind || "").trim());
  const reqTpl = String((req.query.template || (req.body && req.body.template) || "").trim());
  const template = render.TEMPLATE_IDS.includes(reqTpl) ? reqTpl : undefined;
  try {
    const r = await render.render(req.params.folder, kind, { template });
    const task = content.getTask(req.params.folder);
    return res.status(r.ok ? 200 : 400).json(Object.assign({ kind, task }, r));
  } catch (e) {
    const code = e.code === "E_NOT_EDITABLE" ? 409 : (e.code === "E_NO_RENDER" ? 422 : 500);
    return res.status(code).json({ error: e.message, code: e.code });
  }
});

// Descarta (move para outputs/_archived/, reversivel).
router.post("/:folder/discard", (req, res) => {
  try {
    const r = content.discardTask(req.params.folder);
    return res.json(Object.assign({ ok: true }, r));
  } catch (e) {
    const code = e.code === "E_TASK_NOT_FOUND" ? 404 : (e.code === "E_NOT_DISCARDABLE" ? 409 : 500);
    return res.status(code).json({ error: e.message, code: e.code });
  }
});

// Gera o preview.html oficial e promove draft -> in_review
router.post("/:folder/preview", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  const r = content.generatePreview(t.status.task_name, t.status.task_date);
  res.status(r.ok ? 200 : 400).json(r);
});

// Transicao de estado (in_review/approved/rejected) via promote_task.js
router.post("/:folder/promote", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  const { to, by, reason } = req.body || {};
  if (!to) return res.status(400).json({ error: "campo 'to' obrigatorio" });
  const r = content.promote(t.status.task_name, t.status.task_date, to, by, reason);
  res.status(r.ok ? 200 : 400).json(r);
});

// --- Historico de versoes: desfazer/restaurar ajustes (zona active) ---
router.get("/:folder/versions", (req, res) => {
  try { res.json({ versions: content.listContentVersions(req.params.folder, req.query.rel) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.post("/:folder/restore", (req, res) => {
  try {
    const { rel, id } = req.body || {};
    if (!rel || !id) return res.status(400).json({ error: "rel e id são obrigatórios" });
    const file = content.restoreContentVersion(req.params.folder, rel, id);
    res.json({ ok: true, file, task: content.getTask(req.params.folder) });
  } catch (e) {
    const code = e.code === "E_NOT_EDITABLE" ? 409 : (e.code === "E_VERSION_NOT_FOUND" ? 404 : 400);
    res.status(code).json({ error: e.message, code: e.code });
  }
});

module.exports = router;
