// server.js — Painel 4Selet. App web local (Express) para gestao de campanhas e
// criacao de conteudo de marketing com IA (Claude). Reusa os scripts oficiais do
// projeto como fonte unica de verdade do ciclo de vida das tasks.
"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { PATHS, PALETTE, ALLOWED_PLATFORMS, BRAND_PILLARS, CONTENT_PILLARS, CONTENT_TYPES, KIND_LABELS } = require("./lib/config");
const ai = require("./lib/anthropic");
const auth = require("./lib/auth");

const app = express();
// 16mb: precisa acomodar upload de imagem em base64 (acervo de fotos). As rotas
// validam o tamanho real da imagem (uploads.js limita a 10MB por arquivo).
app.use(express.json({ limit: "16mb" }));

// Health-check — usado por scripts de auto-restart/monitoramento na VPS.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "painel-4selet",
    uptime_s: Math.round(process.uptime()),
    ai_key: ai.hasKey(),
    now: new Date().toISOString(),
  });
});

// --- Autenticacao do painel: login por pessoa + perfis (admin/membro) ---
auth.bootstrap(); // garante um admin inicial (ADMIN_USERNAME/ADMIN_PASSWORD do .env)
app.use("/api/auth", require("./routes/auth")); // login/logout/me — publico

// Deste ponto em diante, TODAS as rotas /api exigem sessao valida.
app.use("/api", (req, res, next) => {
  const user = auth.userFromRequest(req);
  if (!user) return res.status(401).json({ error: "não autenticado", code: "E_AUTH" });
  req.user = user;
  next();
});

// Metadados para o front (dropdowns, tema)
app.get("/api/meta", (req, res) => {
  res.json({
    palette: PALETTE,
    platforms: ALLOWED_PLATFORMS,
    pillars: BRAND_PILLARS,
    content_pillars: CONTENT_PILLARS,
    content_types: CONTENT_TYPES,
    kind_labels: KIND_LABELS,
  });
});

app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/campaigns", require("./routes/campaigns"));
app.use("/api/collections", require("./routes/collections"));
app.use("/api/content", require("./routes/content"));
app.use("/api/generate", require("./routes/generate"));
app.use("/api/uploads", require("./routes/uploads"));

// Servir assets de marca (logos) read-only
app.use("/brand-assets", express.static(PATHS.ASSETS_DIR));
// Front. HTML/JS/CSS com "no-cache" (revalida sempre): o navegador guarda, mas
// confere antes de usar — 304 quando nada mudou (rapido), 200 com o novo quando
// mudou. Evita o painel exibir JS/CSS antigos depois de uma atualizacao.
app.use("/", express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css)$/i.test(filePath)) res.setHeader("Cache-Control", "no-cache");
  },
}));

// 404 JSON para rotas /api desconhecidas
app.use("/api", (req, res) => res.status(404).json({ error: "rota nao encontrada" }));

// Handler de erro
app.use((err, req, res, next) => {
  console.error("[erro]", err && err.message ? err.message : err);
  res.status(err.status || 500).json({ error: err.message || "erro interno", code: err.code || null });
});

// Rede de seguranca do processo: uma promise rejeitada fora dos try/catch das rotas
// NAO deve derrubar o painel. unhandledRejection -> apenas loga (segue de pe).
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", (reason && reason.stack) || reason);
});
process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", (err && err.stack) || err);
  process.exit(1); // estado incerto: sai limpo e deixa o PM2 reiniciar
});

const PORT = process.env.PORT || 4500;
// HOST controla a interface de rede:
//   - vazio/ausente  => bind em todas as interfaces (comportamento atual; acessivel pela rede da VPS)
//   - 127.0.0.1      => somente local (acesso apenas de dentro da VPS, via RDP)
// Defina em interface/.env. Sem autenticacao no painel, "127.0.0.1" e a opcao mais segura.
const HOST = process.env.HOST || undefined;
const server = app.listen(PORT, HOST, () => {
  const where = HOST ? HOST : "0.0.0.0 (todas as interfaces)";
  console.log("Painel 4Selet rodando em http://localhost:" + PORT + "  [bind: " + where + "]");
  if (!HOST) {
    console.log("[info] Painel com login proprio (usuarios + senha). Em producao fica atras do proxy (Caddy) sob HTTPS.");
  }
  console.log("Raiz do projeto: " + PATHS.PROJECT_ROOT);
});

// Encerramento limpo (para auto-restart/servico na VPS).
function shutdown(sig) {
  console.log("[" + sig + "] encerrando painel...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
