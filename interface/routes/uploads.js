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
  ensureDir();
  const file = safeName(body.name);
  try { fs.writeFileSync(path.join(UP_DIR, file), buf); } catch (e) { return res.status(500).json({ error: "falha ao salvar a imagem" }); }
  res.json({ ok: true, name: file, url: "/uploads/" + file });
});

// DELETE /api/uploads/:name — remove do acervo
router.delete("/:name", (req, res) => {
  const f = path.basename(String(req.params.name || ""));
  try { fs.unlinkSync(path.join(UP_DIR, f)); res.json({ ok: true }); }
  catch (e) { res.status(404).json({ error: "imagem nao encontrada" }); }
});

module.exports = router;
