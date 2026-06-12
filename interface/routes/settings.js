// routes/settings.js — configurar/testar a chave Anthropic e o modelo.
"use strict";
const express = require("express");
const router = express.Router();
const ai = require("../lib/anthropic");

router.get("/", (req, res) => {
  res.json({
    has_key: ai.hasKey(),
    masked_key: ai.maskKey(),
    model: ai.getModel(),
    default_model: ai.DEFAULT_MODEL,
  });
});

router.post("/key", (req, res) => {
  try {
    ai.saveApiKey(req.body && req.body.key);
    res.json({ ok: true, has_key: true, masked_key: ai.maskKey() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/model", (req, res) => {
  const model = ai.saveModel(req.body && req.body.model);
  res.json({ ok: true, model });
});

router.post("/test", async (req, res) => {
  const r = await ai.testKey();
  res.status(r.ok ? 200 : 400).json(r);
});

module.exports = router;
