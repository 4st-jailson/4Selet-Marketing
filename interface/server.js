// server.js — Painel 4Selet. App web local (Express) para gestao de campanhas e
// criacao de conteudo de marketing com IA (Claude). Reusa os scripts oficiais do
// projeto como fonte unica de verdade do ciclo de vida das tasks.
"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { PATHS, PALETTE, ALLOWED_PLATFORMS, BRAND_PILLARS, CONTENT_TYPES, KIND_LABELS } = require("./lib/config");

const app = express();
app.use(express.json({ limit: "2mb" }));

// Metadados para o front (dropdowns, tema)
app.get("/api/meta", (req, res) => {
  res.json({
    palette: PALETTE,
    platforms: ALLOWED_PLATFORMS,
    pillars: BRAND_PILLARS,
    content_types: CONTENT_TYPES,
    kind_labels: KIND_LABELS,
  });
});

app.use("/api/settings", require("./routes/settings"));
app.use("/api/campaigns", require("./routes/campaigns"));
app.use("/api/content", require("./routes/content"));
app.use("/api/generate", require("./routes/generate"));

// Servir assets de marca (logos) read-only
app.use("/brand-assets", express.static(PATHS.ASSETS_DIR));
// Front
app.use("/", express.static(path.join(__dirname, "public")));

// 404 JSON para rotas /api desconhecidas
app.use("/api", (req, res) => res.status(404).json({ error: "rota nao encontrada" }));

// Handler de erro
app.use((err, req, res, next) => {
  console.error("[erro]", err && err.message ? err.message : err);
  res.status(err.status || 500).json({ error: err.message || "erro interno", code: err.code || null });
});

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => {
  console.log("Painel 4Selet rodando em http://localhost:" + PORT);
  console.log("Raiz do projeto: " + PATHS.PROJECT_ROOT);
});
