// routes/capture.js — "capturar de um site": o painel abre a página num navegador de verdade e
// guarda o print no acervo, pronto para virar o print de um slide, o mockup da peça de Mídia ou o
// fundo de uma arte.
//
// Todo o julgamento de segurança do endereço mora em lib/urlguard.js e roda ANTES de qualquer
// navegador subir. Aqui só entram a autorização (quem está logado) e o formato da resposta.
"use strict";
const express = require("express");
const router = express.Router();
const capture = require("../lib/capture");

// GET /api/capture/presets — os tamanhos oferecidos na tela.
router.get("/presets", (req, res) => {
  res.json({ presets: capture.listaPresets(), padrao: capture.PRESET_PADRAO });
});

// POST /api/capture { url, preset } — captura e devolve a foto do acervo.
router.post("/", express.json({ limit: "16kb" }), async (req, res, next) => {
  try {
    const body = req.body || {};
    const r = await capture.capturaUrl({ url: body.url, preset: body.preset });
    if (!r.ok) return res.status(r.code === "E_URL" ? 400 : 502).json({ error: r.motivo, code: r.code });
    const quem = (req.user && (req.user.username || req.user.name)) || "?";
    console.log("[capture] " + quem + " capturou " + r.host + " -> " + r.name + " (" + r.largura + "x" + r.altura + ", " + Math.round(r.bytes / 1024) + "KB)");
    res.json(r);
  } catch (e) { next(e); }
});

module.exports = router;
