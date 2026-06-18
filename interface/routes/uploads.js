// routes/uploads.js — acervo de imagens locais (upload do usuário) para as artes "Foto".
// Salva em public/uploads/ (servido em /uploads/) e o render resolve para file:// (confiável,
// sem depender de host externo). Aceita dataURL base64 (sem dependência de multipart).
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const UP_DIR = path.join(__dirname, "..", "public", "uploads");
function ensureDir() { try { fs.mkdirSync(UP_DIR, { recursive: true }); } catch (e) {} }
function safeName(name) {
  const raw = String(name || "imagem");
  const ext = (path.extname(raw) || ".png").toLowerCase().replace(/[^.a-z0-9]/g, "");
  const stem = path.basename(raw, path.extname(raw)).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "img";
  return stem + "_" + Date.now().toString(36) + (/\.(png|jpe?g|webp|gif)$/i.test(ext) ? ext : ".png");
}
// Confere a assinatura (magic bytes) — nao confiar so no prefixo data:image.
function magicOk(b) {
  if (!b || b.length < 12) return false;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;                   // JPEG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;                   // GIF
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true; // WEBP
  return false;
}

// GET /api/uploads — lista o acervo (mais recentes primeiro)
router.get("/", (req, res) => {
  ensureDir();
  let files = [];
  try { files = fs.readdirSync(UP_DIR).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)); } catch (e) {}
  files.sort((a, b) => { try { return fs.statSync(path.join(UP_DIR, b)).mtimeMs - fs.statSync(path.join(UP_DIR, a)).mtimeMs; } catch (e) { return 0; } });
  res.json({ images: files.map((f) => ({ name: f, url: "/uploads/" + f })) });
});

// POST /api/uploads { name, dataUrl } — salva uma imagem do acervo
router.post("/", express.json({ limit: "14mb" }), (req, res) => {
  const body = req.body || {};
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(String(body.dataUrl || ""));
  if (!m) return res.status(400).json({ error: "imagem invalida (esperado dataURL base64)" });
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length) return res.status(400).json({ error: "imagem vazia" });
  if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: "imagem muito grande (max 10MB)" });
  if (!magicOk(buf)) return res.status(400).json({ error: "o arquivo nao parece uma imagem valida (PNG, JPEG, WebP ou GIF)" });
  ensureDir();
  const file = safeName(body.name);
  try { fs.writeFileSync(path.join(UP_DIR, file), buf); } catch (e) { return res.status(500).json({ error: "falha ao salvar a imagem" }); }
  res.json({ ok: true, name: file, url: "/uploads/" + file });
});

// DELETE /api/uploads/:name — remove do acervo
router.delete("/:name", (req, res) => {
  const f = path.basename(String(req.params.name || ""));
  const target = path.join(UP_DIR, f);
  if (!target.startsWith(UP_DIR + path.sep)) return res.status(400).json({ error: "nome invalido" });
  try { fs.unlinkSync(target); res.json({ ok: true }); }
  catch (e) { res.status(404).json({ error: "imagem nao encontrada" }); }
});

module.exports = router;
