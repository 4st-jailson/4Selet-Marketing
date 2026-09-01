// server.js — Painel 4Selet. App web local (Express) para gestao de campanhas e
// criacao de conteudo de marketing com IA (Claude). Reusa os scripts oficiais do
// projeto como fonte unica de verdade do ciclo de vida das tasks.
"use strict";
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { PATHS, PALETTE, ALLOWED_PLATFORMS, BRAND_PILLARS, CONTENT_PILLARS, CONTENT_TYPES, KIND_LABELS, DESTINOS } = require("./lib/config");
const auth = require("./lib/auth");

const app = express();

// --- Porta do sistema squad.4st.co (artes prontas chegando de fora) -------------------
// Precisa vir ANTES do parser global por dois motivos, os dois medidos:
//   1) TAMANHO. Um post de carrossel do squad tem cards de 1080x1350 em 2x com foto de IA:
//      5,3 MB CADA, mais de 30 MB no total. O parser global abaixo aceita 16 MB e, uma vez
//      que ele roda, marca o corpo como lido — um limite maior declarado depois é ignorado
//      em silêncio. O jeito de valer é este: um parser próprio, registrado primeiro.
//   2) SEGURANÇA. Quem chama não tem login, então o token é o porteiro — e ele é conferido
//      AQUI, antes de ler o corpo. Sem isso, qualquer um na internet faria o painel
//      bufferizar 80 MB só para tomar 401 depois.
const squadLib = require("./lib/squad");
// Uma forma só do caminho, usada TAMBÉM pela exceção anti-CSRF mais abaixo. Quando as duas
// checagens discordavam, um simples "/" a mais no fim do endereço (o erro mais provável de
// quem digita a URL à mão) passava pelo token e morria depois com "origem inválida" — sem
// virar linha na tela, sem conteúdo guardado, e com uma mensagem que aponta para o lugar errado.
const CAMINHO_SQUAD = /^\/api\/squad\/webhook\/?$/i;
app.use("/api/squad/webhook", (req, res, next) => {
  const apresentado = squadLib.tokenDaRequisicao(req);
  if (!squadLib.confere(apresentado)) {
    // Fica registrado (com freio). A tela de Requisições existe para responder "chegou
    // alguma coisa?" — e o token errado é justamente o tropeço mais provável no dia de ligar
    // a integração. Sem isto, a tela diria "nada chegou" enquanto as entregas batiam na porta.
    //
    // Os dois casos pedem providências opostas, então a mensagem os separa: SEM token quase
    // sempre é alguém varrendo a internet e não exige nada de ninguém; COM token errado é
    // quase sempre a integração mal cadastrada, e aí vale conferir o endereço com o time.
    const semToken = !apresentado;
    const conectado = squadLib.estado().conectado;
    const motivo = semToken
      ? (conectado
        ? "Alguém bateu nesta porta sem apresentar token nenhum. Costuma ser varredura automática da internet, e não exige nada de você — a porta continuou fechada."
        : "Bateram nesta porta, mas ainda não há token cadastrado aqui. Se era o time do squad, gere o token em Configurações e passe o endereço a eles.")
      : "Uma entrega chegou com um token que não confere com o que está salvo em Configurações. Confira com o time do squad se eles cadastraram o endereço certo.";
    try { squadLib.registrarRecusa(squadLib.clientIp(req), motivo); } catch (e) {}
    console.warn("[squad] recusada na porta (" + (semToken ? "sem token" : "token não confere") + ") — de " + squadLib.clientIp(req));
    return res.status(401).json({ ok: false, erro: "token inválido" });
  }
  next();
}, express.json({ limit: "80mb" }));

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
    // Exceção única e explícita: o webhook do squad é servidor-para-servidor e não manda
    // Origin nem Referer — nenhum servidor manda. Isto NÃO abre buraco de CSRF: o ataque de
    // CSRF depende do navegador anexar o cookie de sessão da vítima, e esta rota não olha
    // cookie nenhum; ela só aceita quem apresenta o token secreto, que um site de terceiro
    // não tem como saber. Quem protege aqui é o token, conferido antes até do corpo.
    if (CAMINHO_SQUAD.test(req.path)) return next();
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

// Recebimento das artes do squad.4st.co — PÚBLICO por necessidade (quem chama é o servidor
// deles, sem cookie), autenticado pelo token conferido lá em cima. Precisa ficar aqui, antes
// do gate abaixo: o único mecanismo de rota pública neste painel é a ORDEM de registro.
app.use("/api/squad", require("./routes/squad_webhook"));

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

// A versão do front viaja DE CARONA em toda resposta de /api. É ~30 bytes num cabeçalho, em
// requisições que o painel já faz de qualquer jeito — custo de rede zero.
//
// A 1ª versão disto era um relógio: o front pedia /api/meta a cada 5 minutos e toda vez que a aba
// voltava a ficar visível. Medido, /api/meta pesa 6.090 bytes para entregar ~20 bytes de versão,
// não tem freio de requisição, e o relógio nunca parava — nem depois do aviso aparecer. Alternar
// entre abas (que é o que se faz o dia inteiro) viraria uma rajada de chamadas de 6KB por nada.
app.use("/api", (req, res, next) => {
  res.setHeader("X-Painel-Versao", ASSET_VERS.app + "-" + ASSET_VERS.css);
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
    destinos: DESTINOS,
    kind_labels: KIND_LABELS,
    // Versão do front que ESTE servidor tem. O painel NÃO usa isto (ele lê o cabeçalho
    // X-Painel-Versao, que vem em toda resposta e não custa requisição nenhuma). Fica aqui para
    // conferência: um `curl /api/meta` diz qual versão está no ar sem ter que ler o HTML.
    app_version: ASSET_VERS.app + "-" + ASSET_VERS.css,
  });
});

// Freio nas rotas CARAS. Cada chamada de geração é dinheiro na conta da Anthropic/OpenAI e cada
// render sobe um Chromium na fila serializada — uma rajada (laço com bug no front, F5 repetido,
// sessão vazada) sairia cara e derrubaria a fila para todo mundo. Os limites são folgados para
// o uso normal de uma equipe pequena: quem trabalha nunca esbarra.
const { limitar } = require("./lib/ratelimit");
const limiteIA = limitar({ nome: "ia", max: 30, janelaMs: 5 * 60 * 1000, mensagem: "Muitas gerações seguidas." });
// Interpretar o tema e uma chamada curta e barata, disparada a cada peca — se dividisse o
// balde com a geracao, escrever o tema comeria a cota de gerar. Balde proprio, mais folgado.
const limiteInterpret = limitar({ nome: "interpret", max: 60, janelaMs: 5 * 60 * 1000, mensagem: "Muitas interpretações seguidas — aguarde alguns instantes." });
const limiteRender = limitar({ nome: "render", max: 40, janelaMs: 5 * 60 * 1000, mensagem: "Muitos pedidos de arte seguidos." });
const limitePexels = limitar({ nome: "pexels", max: 60, janelaMs: 5 * 60 * 1000, mensagem: "Muitas buscas de imagem seguidas." });
// Capturar um site sobe um Chromium inteiro e fala com a internet a partir do servidor: é a rota
// mais cara e a de maior superfície do painel. Balde curto de propósito.
const limiteCapture = limitar({ nome: "capture", max: 20, janelaMs: 5 * 60 * 1000, mensagem: "Muitas capturas de site seguidas — aguarde alguns instantes." });

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
app.post(["/api/generate", "/api/generate/refine", "/api/generate/assistant", "/api/generate/slide", "/api/generate/slide-mem", "/api/generate/research"], limiteIA);
app.post("/api/generate/interpret", limiteInterpret);
app.use("/api/generate", require("./routes/generate"));
app.use("/api/uploads", require("./routes/uploads"));
app.use("/api/pexels", limitePexels, require("./routes/pexels"));
app.post("/api/capture", limiteCapture);
app.use("/api/capture", require("./routes/capture"));
app.use("/api/publish", require("./routes/publish"));
// O lado de dentro da integração com o squad: conexão em Configurações + tela de Requisições.
// Mesmo prefixo do irmão público acima, mas só responde nos caminhos que ele não usa.
app.use("/api/squad", require("./routes/squad"));

// Disparador de agendamentos: publica as peças agendadas no horário (passando pelo gate).
// O 2o argumento responde "esta peça já foi publicada?" — o worker pula quem já foi ao ar na
// mão depois de agendada, para não sair o mesmo post duas vezes.
require("./lib/schedule").startWorker(
  require("./lib/publish").publishTask,
  // As DUAS copias. `getTask` acha a peca pelo nome e olha a zona ativa ANTES da aprovada, mas
  // quem publica e sempre a copia aprovada: com uma peca de mesmo nome nas duas zonas, a
  // pergunta caia na errada e o agendador postava de novo o que ja estava no ar. E a mesma
  // regra que a rota usa (routes/publish.js, `jaPublicada`).
  (folder) => {
    const t = require("./lib/content").getTask(folder);
    if (t && t.status && t.status.published_at) return true;
    const a = require("./lib/publish").statusAprovado(folder);
    return !!(a && a.published_at);
  }
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
// ATENCAO: o gate NAO pode depender do casamento de rota do Express.
// Com `app.use(["/uploads", ...])`, um pedido por "//uploads/foto.png" (barra dobrada) ou por
// "/%75ploads/foto.png" (a letra "u" codificada) NAO casa com o caminho montado — entao o gate
// nem roda. So que o express.static logo abaixo, montado na raiz, NORMALIZA e DECODIFICA o
// caminho antes de procurar o arquivo, e entrega a imagem. Medido: sem cookie nenhum,
// "//uploads/_art_hand_11.png" devolvia 200 com o PNG inteiro (1.157.873 bytes), enquanto
// "/uploads/_art_hand_11.png" devolvia 401. Qualquer pessoa na internet que acertasse o nome do
// arquivo baixava material de marca nao publicado.
// A regra passa a olhar o caminho JA decodificado e normalizado — o mesmo que o express.static
// vai olhar — em vez de confiar na montagem.
const PASTAS_SOB_LOGIN = ["uploads", "outputs", "propostas"];
function primeiraPasta(req) {
  var p = req.path || "/";
  // UMA decodificacao, igual a do serve-static: decodificar duas vezes recusaria um arquivo cujo
  // nome contenha "%" de verdade, e o static nao chegaria nele de qualquer forma.
  try { p = decodeURIComponent(p); } catch (e) { /* caminho malformado: segue com o cru */ }
  p = p.split("\\").join("/");              // barra invertida (Windows) vira barra normal
  p = p.replace(new RegExp("/{2,}", "g"), "/"); // barras repetidas viram uma
  var partes = p.split("/").filter(function (x) { return x && x !== "."; });
  return partes.length ? partes[0].toLowerCase() : "";
}
app.use(function (req, res, next) {
  if (PASTAS_SOB_LOGIN.indexOf(primeiraPasta(req)) < 0) return next();
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
