// routes/pexels.js — busca de imagens de banco (Pexels) + baixar SO a foto escolhida pro acervo
// local (/uploads/, servido e resolvido para file:// no render — confiavel). Zero storage do resto.
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const pexels = require("../lib/pexels");
const router = express.Router();

const UP_DIR = path.join(__dirname, "..", "public", "uploads");
function ensureDir() { try { fs.mkdirSync(UP_DIR, { recursive: true }); } catch (e) {} }
// Extensao pela assinatura (magic bytes) — nao confiar so no content-type.
function magicExt(b) {
  if (!b || b.length < 12) return "";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ".png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ".jpg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return ".gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return ".webp";
  return "";
}
function safeStem(name) { return String(name || "pexels").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) || "pexels"; }

// POST /api/pexels/search { query, page, orientation, perPage, color, size } -> { ok, photos:[...], total, hasMore }
router.post("/search", express.json({ limit: "8kb" }), async (req, res) => {
  const b = req.body || {};
  if (!pexels.isConfigured()) return res.status(400).json({ ok: false, error: "no_key" });
  const r = await pexels.search(b.query, { page: b.page, orientation: b.orientation, perPage: b.perPage, color: b.color, size: b.size });
  res.status(r.ok ? 200 : 400).json(r);
});

// POST /api/pexels/pick { url, name } -> baixa SO essa foto (server-side, valida ser da Pexels) pro
// /uploads/ e devolve { ok, url }. O front insere essa url na peca (render usa file:// local).
router.post("/pick", express.json({ limit: "8kb" }), async (req, res) => {
  const b = req.body || {};
  if (!pexels.isConfigured()) return res.status(400).json({ ok: false, error: "no_key" });
  try {
    const img = await pexels.fetchImage(b.url);
    const ext = magicExt(img.buffer);
    if (!ext) return res.status(400).json({ ok: false, error: "a resposta nao e uma imagem valida" });
    if (img.buffer.length > 12 * 1024 * 1024) return res.status(413).json({ ok: false, error: "imagem muito grande" });
    ensureDir();
    const file = "pexels_" + safeStem(b.name) + "_" + Date.now().toString(36) + ext;
    fs.writeFileSync(path.join(UP_DIR, file), img.buffer);
    res.json({ ok: true, url: "/uploads/" + file, name: file });
  } catch (e) { res.status(400).json({ ok: false, error: (e && e.message) || "falha ao baixar a imagem" }); }
});

module.exports = router;
