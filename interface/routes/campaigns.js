// routes/campaigns.js — CRUD de campanhas + validacao de schema (estrutura padrao).
"use strict";
const express = require("express");
const router = express.Router();
const campaigns = require("../lib/campaigns");
const content = require("../lib/content");
const { validateCampaign } = require("../lib/validation");

router.get("/", (req, res) => {
  res.json({ campaigns: campaigns.list() });
});

router.post("/", (req, res) => {
  const v = validateCampaign(req.body);
  if (!v.ok) return res.status(400).json({ error: "validacao falhou", errors: v.errors });
  try {
    const c = campaigns.create(req.body);
    res.status(201).json({ campaign: c });
  } catch (e) {
    res.status(e.code === "E_CAMPAIGN_EXISTS" ? 409 : 500).json({ error: e.message, code: e.code });
  }
});

router.get("/:id", (req, res) => {
  const c = campaigns.get(req.params.id);
  if (!c) return res.status(404).json({ error: "campanha nao encontrada" });
  // anexa as tasks ligadas (lidas do estado real de outputs/)
  const tasks = content.listTasks().filter((t) => t.campaign_id === c.id);
  res.json({ campaign: c, tasks });
});

router.put("/:id", (req, res) => {
  const v = validateCampaign(Object.assign({ name: "xxx" }, req.body));
  if (!v.ok) return res.status(400).json({ error: "validacao falhou", errors: v.errors });
  try {
    const c = campaigns.update(req.params.id, req.body);
    res.json({ campaign: c });
  } catch (e) {
    res.status(e.code === "E_CAMPAIGN_NOT_FOUND" ? 404 : 500).json({ error: e.message, code: e.code });
  }
});

router.delete("/:id", (req, res) => {
  const ok = campaigns.remove(req.params.id);
  res.status(ok ? 200 : 404).json({ ok });
});

module.exports = router;
