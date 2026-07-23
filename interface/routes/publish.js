// routes/publish.js — publicação no Instagram (Graph API), atrás do gate de auth.
// Config (token/ID) só admin. Publicar exige peça aprovada (gate no lib/publish).
"use strict";
const express = require("express");
const router = express.Router();
const publish = require("../lib/publish");
const schedule = require("../lib/schedule");
const publications = require("../lib/publications");
const content = require("../lib/content");

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Só administradores configuram a publicação." });
  next();
}

// status/config (sem segredos)
router.get("/status", (req, res) => {
  res.json({ instagram: publish.publicConfig() });
});

// salvar token + ID da conta + base pública (admin). Nunca ecoa o token de volta.
router.post("/config", adminOnly, (req, res) => {
  try {
    const b = req.body || {};
    const cfg = publish.setInstagram({ access_token: b.access_token, ig_user_id: b.ig_user_id, public_base_url: b.public_base_url });
    res.json({ ok: true, instagram: cfg });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// testar conexão com a Meta (valida token + retorna @ da conta)
router.post("/test", adminOnly, async (req, res) => {
  try { res.json(await publish.testConnection()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// histórico de publicações que foram ao ar (agendadas OU diretas) — aba "Publicados"
router.get("/publications", (req, res) => res.json({ items: publications.list() }));

// marca uma peça APROVADA como JÁ PUBLICADA manualmente — para publicações feitas por fora
// do painel (ou antes do rastreamento existir). Registra no histórico p/ aparecer em "Publicados",
// SEM postar de novo no Instagram (evita duplicar o post). Body: { published_at?, post_id?, permalink? }.
router.post("/:folder/mark-published", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "peça não encontrada" });
  if (t.zone !== "approved") return res.status(409).json({ error: "só peças aprovadas podem ser marcadas como publicadas.", code: "E_NOT_APPROVED" });
  if (t.status && t.status.published_at) return res.status(409).json({ error: "esta peça já consta como publicada.", code: "E_ALREADY_PUBLISHED" });
  const b = req.body || {};
  const who = req.user && (req.user.name || req.user.username);
  let at = null;
  if (b.published_at) { const d = new Date(b.published_at); if (!isNaN(d.getTime())) at = d.toISOString(); }
  try {
    content.setPublished(req.params.folder, { by: who, at: at, post_id: b.post_id });
    const item = publications.add({ folder: req.params.folder, label: (t.status && t.status.title) || req.params.folder, kind: t.kind, post_id: b.post_id || null, permalink: b.permalink || null, published_at: at, scheduled_at: null, by: who, manual: true });
    res.json({ ok: true, item: item, task: content.getTask(req.params.folder) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- agendamento ---
// lista os agendamentos (fila)
router.get("/schedule", (req, res) => res.json({ items: schedule.list() }));
// cancela/suspende um agendamento pendente
router.delete("/schedule/:id", (req, res) => {
  try {
    const it = schedule.cancel(req.params.id);
    if (!it) return res.status(404).json({ error: "agendamento não encontrado" });
    res.json({ ok: true, item: it });
  } catch (e) { res.status(e.code === "E_NOT_PENDING" ? 409 : 400).json({ error: e.message, code: e.code }); }
});
// agenda uma peça APROVADA. Body: { kind?, caption?, scheduled_at (ISO), label? }.
router.post("/:folder/schedule", (req, res) => {
  try {
    const b = req.body || {};
    if (!b.scheduled_at) return res.status(400).json({ error: "scheduled_at (data/hora) é obrigatório" });
    publish.assertApproved(req.params.folder); // gate ANTES de agendar (peça precisa estar aprovada+íntegra)
    const item = schedule.add({ folder: req.params.folder, kind: b.kind, caption: b.caption, scheduled_at: b.scheduled_at, label: b.label, by: req.user && req.user.username });
    res.json({ ok: true, item });
  } catch (e) {
    const gate = ["E_NOT_APPROVED", "E_INVALID_STATE", "E_GATE_NO_HASHES", "E_HASH_MISMATCH"].indexOf(e.code) >= 0;
    res.status(gate ? 409 : (e.code === "E_BAD_DATE" ? 400 : 400)).json({ error: e.message, code: e.code });
  }
});

// publicar (ou simular) uma peça APROVADA. Body: { kind?, caption?, dryRun? }.
router.post("/:folder", async (req, res) => {
  try {
    const b = req.body || {};
    const r = await publish.publishTask(req.params.folder, { kind: b.kind, caption: b.caption, dryRun: b.dryRun });
    // Só quando saiu DE VERDADE (não dry-run): marca a peça como publicada + registra no histórico.
    if (r && r.ok && !r.dry_run) {
      const who = req.user && (req.user.name || req.user.username);
      const t = content.getTask(req.params.folder);
      try { content.setPublished(req.params.folder, { by: who, post_id: r.post_id }); } catch (e) { /* best-effort */ }
      try { publications.add({ folder: req.params.folder, label: (t && t.status && t.status.title) || req.params.folder, kind: r.type, caption: b.caption, post_id: r.post_id, permalink: r.permalink, scheduled_at: null, by: who }); } catch (e) { /* best-effort */ }
    }
    res.json(Object.assign({ ok: true, task: content.getTask(req.params.folder) }, r));
  } catch (e) {
    const gate = ["E_NOT_APPROVED", "E_INVALID_STATE", "E_GATE_NO_HASHES", "E_HASH_MISMATCH"].indexOf(e.code) >= 0;
    res.status(gate ? 409 : (e.code === "E_NO_IMAGE" ? 422 : 400)).json({ error: e.message, code: e.code });
  }
});

module.exports = router;
