// server.js — Painel 4Selet. App web local (Express) para gestao de campanhas e
// criacao de conteudo de marketing com IA (Claude). Reusa os scripts oficiais do
// projeto como fonte unica de verdade do ciclo de vida das tasks.
"use strict";
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { PATHS, PALETTE, ALLOWED_PLATFORMS, BRAND_PILLARS, CONTENT_PILLARS, CONTENT_TYPES, KIND_LABELS } = require("./lib/config");
const auth = require("./lib/auth");

const app = express();
// 16mb: precisa acomodar upload de imagem em base64 (acervo de fotos). As rotas
// validam o tamanho real da imagem (uploads.js limita a 10MB por arquivo).
app.use(express.json({ limit: "16mb" }));

// --- Cabecalhos de seguranca (M3) + checagem de Origin anti-CSRF (B3) ---
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // (X-Frame-Options removido: o CSP abaixo já traz frame-ancestors 'self', equivalente
  //  moderno; os dois juntos eram redundantes.)
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob: https://*.pexels.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
    "script-src 'self' 'unsafe-inline'; frame-src 'self' blob:; connect-src 'self'; " +
    "object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  // anti-CSRF: rejeita mutacoes cujo Origin nao bate com o host. Se nao veio Origin, cai no
  // Referer; sem NENHUM dos dois a mutacao e recusada (antes ela passava direto — o "if (origin)"
  // sem else deixava um furo para qualquer cliente que simplesmente omitisse o header).
  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE" || req.method === "PATCH") {
    const bad = () => res.status(403).json({ error: "origem inválida", code: "E_BAD_ORIGIN" });
    const src = req.headers.origin || req.headers.referer;
    if (!src) return bad();
    try { if (new URL(src).host !== req.headers.host) return bad(); }
    catch (e) { return bad(); }
  }
  next();
});

// Health-check — usado por scripts de auto-restart/monitoramento na VPS. Publico:
// so um sinal de vida, sem expor estado interno (ex.: presenca de chave de IA).
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "painel-4selet", uptime_s: Math.round(process.uptime()) });
});

// Link PÚBLICO TEMPORÁRIO de mídia (fora do login): a Meta busca a imagem da arte por
// aqui na hora de publicar no Instagram. Token opaco + expira (lib/media_tokens).
app.get("/m/:token", (req, res) => {
  const abs = require("./lib/media_tokens").resolve(req.params.token);
  if (!abs) return res.status(404).end();
  res.set("Cache-Control", "no-store");
  res.sendFile(abs);
});

// Credenciais de integracao inseridas pelo painel (data/credentials.json -> process.env).
// Antes das rotas, pra que integracoes que leem env ja enxerguem os valores gravados.
require("./lib/credentials").loadIntoEnv();

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

// Enforcement server-side da troca de senha obrigatoria (M1): uma conta marcada
// must_change so consegue usar /api/auth/* (login/logout/me/first-password — montadas
// ANTES deste gate). Todo o resto fica bloqueado ate ela definir a propria senha, entao
// nao adianta pular o front (curl) para usar o painel com a senha temporaria.
app.use("/api", (req, res, next) => {
  if (req.user && req.user.must_change) return res.status(403).json({ error: "Defina uma nova senha antes de continuar.", code: "E_MUST_CHANGE" });
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

// Freio nas rotas CARAS. Cada chamada de geração é dinheiro na conta da Anthropic/OpenAI e cada
// render sobe um Chromium na fila serializada — uma rajada (laço com bug no front, F5 repetido,
// sessão vazada) sairia cara e derrubaria a fila para todo mundo. Os limites são folgados para
// o uso normal de uma equipe pequena: quem trabalha nunca esbarra.
const { limitar } = require("./lib/ratelimit");
const limiteIA = limitar({ nome: "ia", max: 30, janelaMs: 5 * 60 * 1000, mensagem: "Muitas gerações seguidas." });
const limiteRender = limitar({ nome: "render", max: 40, janelaMs: 5 * 60 * 1000, mensagem: "Muitos pedidos de arte seguidos." });
const limitePexels = limitar({ nome: "pexels", max: 60, janelaMs: 5 * 60 * 1000, mensagem: "Muitas buscas de imagem seguidas." });

app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/campaigns", require("./routes/campaigns"));
app.use("/api/collections", require("./routes/collections"));
// só o que renderiza/gera entra no freio; ler a biblioteca, abrir peça e baixar seguem livres
app.use("/api/content/:folder/render", limiteRender);
app.use("/api/content/:folder/edit-html", limiteRender);
app.use("/api/content", require("./routes/content"));
// O freio de IA vale só para as rotas que REALMENTE chamam o modelo. SALVAR e mandar para
// revisão não gastam IA — se entrassem na mesma cota, alguém que gerasse muito ficaria sem
// conseguir gravar o trabalho, que é exatamente o pior desfecho possível.
app.post(["/api/generate", "/api/generate/refine", "/api/generate/assistant", "/api/generate/slide", "/api/generate/slide-mem"], limiteIA);
app.use("/api/generate", require("./routes/generate"));
app.use("/api/uploads", require("./routes/uploads"));
app.use("/api/pexels", limitePexels, require("./routes/pexels"));
app.use("/api/publish", require("./routes/publish"));

// Disparador de agendamentos: publica as peças agendadas no horário (passando pelo gate).
// O 2o argumento responde "esta peça já foi publicada?" — o worker pula quem já foi ao ar na
// mão depois de agendada, para não sair o mesmo post duas vezes.
require("./lib/schedule").startWorker(
  require("./lib/publish").publishTask,
  (folder) => { const t = require("./lib/content").getTask(folder); return !!(t && t.status && t.status.published_at); }
);

// Confere a conexão com o Instagram ao subir e a cada 6h, em segundo plano. Sem isto o painel
// só descobria que o token morreu na hora de publicar — foi assim que ficou 18 dias anunciando
// "Conectado" com uma sessão expirada. Falha aqui não derruba nada: só registra o estado.
(function vigiaConexaoInstagram() {
  const publish = require("./lib/publish");
  const conferir = () => {
    if (!publish.isConfigured()) return;
    publish.testConnection()
      .then((r) => { if (!r.ok) console.warn("[instagram] conexão indisponível:", r.error); })
      .catch((e) => console.warn("[instagram] não consegui conferir a conexão:", e && e.message));
  };
  setTimeout(conferir, 8000).unref();                 // logo após o boot
  setInterval(conferir, 6 * 60 * 60 * 1000).unref();  // e a cada 6 horas
})();

// Servir assets de marca (logos) read-only. Filtro de extensao (B6): so mídia/fontes/css
// — nunca serve .env/.json/.md/etc. que por acaso caiam em assets/. Publico (fora do gate).
app.use("/brand-assets", (req, res, next) => {
  if (!/\.(png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|css)$/i.test(req.path)) return res.status(404).end();
  next();
}, express.static(PATHS.ASSETS_DIR));
// Cache-busting dos assets do front. O Cloudflare cacheia /js/*.js e /css/*.css na BORDA e
// reescreve o Cache-Control do navegador para max-age=14400 (4h), ignorando o "no-cache" da
// origem — entao um deploy demorava ate 4h pra chegar no navegador do usuario (ex.: sumia a
// secao "Criacao avancada" pra quem estava com o app.js velho). A raiz (index.html) NAO e
// cacheada (Cf-Cache-Status DYNAMIC), entao aqui injetamos ?v=<hash> nas URLs dos assets: a
// cada deploy o conteudo muda -> hash novo -> URL nova -> navegador e CF buscam o novo na hora,
// sem hard-refresh. Hash calculado UMA vez no boot (os arquivos nao mudam durante o processo).
const PUBLIC_DIR = path.join(__dirname, "public");
function assetHash(rel) {
  try { return crypto.createHash("sha1").update(fs.readFileSync(path.join(PUBLIC_DIR, rel))).digest("hex").slice(0, 10); }
  catch (e) { return "0"; }
}
const ASSET_VERS = { css: assetHash("css/styles.css"), api: assetHash("js/api.js"), app: assetHash("js/app.js") };
function serveIndex(req, res) {
  let html;
  try { html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8"); }
  catch (e) { return res.status(500).type("text").send("index.html indisponivel"); }
  html = html
    .replace("/css/styles.css", "/css/styles.css?v=" + ASSET_VERS.css)
    .replace("/js/api.js", "/js/api.js?v=" + ASSET_VERS.api)
    .replace("/js/app.js", "/js/app.js?v=" + ASSET_VERS.app);
  res.setHeader("Cache-Control", "no-cache");
  res.type("html").send(html);
}
app.get(["/", "/index.html"], serveIndex);

// Conteudo de TRABALHO dentro de public/ exige login. O gate de sessao cobria so /api, entao
// as fotos do acervo (/uploads) e os artefatos em /outputs e /propostas ficavam abertos na
// internet — bastava acertar o nome do arquivo (que e previsivel: nome + timestamp em base36).
// Material de marca nao publicado nao pode sair por ai. O canal publico de midia continua
// sendo so o /m/:token (link temporario que a Meta usa na hora de publicar), e o render nao
// depende destas URLs (resolve para file:// local).
app.use(["/uploads", "/outputs", "/propostas"], (req, res, next) => {
  if (auth.userFromRequest(req)) return next();
  res.status(401).type("text").send("Faça login no painel para ver este arquivo.");
});

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
// Defina em interface/.env. O painel tem login proprio (usuario/senha, perfis admin/membro);
// o bind em "127.0.0.1" continua sendo defesa em profundidade, nao a unica protecao.
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
