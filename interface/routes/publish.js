// routes/publish.js — publicação no Instagram (Graph API), atrás do gate de auth.
// Config (token/ID) só admin. Publicar exige peça aprovada (gate no lib/publish).
"use strict";
const express = require("express");
const router = express.Router();
const publish = require("../lib/publish");
const schedule = require("../lib/schedule");
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
    // Registra "publicado" na peça (metadado) só quando saiu DE VERDADE (não dry-run/simulado).
    if (r && r.ok && !r.dry_run) {
      try { content.setPublished(req.params.folder, { by: req.user && (req.user.name || req.user.username), post_id: r.post_id }); } catch (e) { /* metadado best-effort */ }
    }
    res.json(Object.assign({ ok: true, task: content.getTask(req.params.folder) }, r));
  } catch (e) {
    const gate = ["E_NOT_APPROVED", "E_INVALID_STATE", "E_GATE_NO_HASHES", "E_HASH_MISMATCH"].indexOf(e.code) >= 0;
    res.status(gate ? 409 : (e.code === "E_NO_IMAGE" ? 422 : 400)).json({ error: e.message, code: e.code });
  }
});

module.exports = router;
