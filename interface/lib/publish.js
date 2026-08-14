// lib/publish.js — Publicação no Instagram (Graph API), integrada ao workflow de
// aprovação do painel. FASE 1: feed (imagem única) + carrossel. Stories/Reels depois.
//
// Segurança e integração:
//   - SÓ publica peça na zona `approved` E com os content_hashes batendo (gate R5).
//   - DRY-RUN por padrão enquanto o Instagram não estiver conectado (ou quando pedido):
//     prepara tudo e publica NADA.
//   - O token e o ID da conta ficam em interface/data/publish.json (0600, fora do git,
//     persistido no volume) — NUNCA vão pro front nem pro log.
//   - A imagem é servida à Meta por um LINK PÚBLICO TEMPORÁRIO (lib/media_tokens) que expira.
"use strict";
const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");
const media = require("./media_tokens");
const { hashDirectory, diffHashes } = require(path.join(PATHS.SCRIPTS_DIR, "lib", "content_hash"));

const GRAPH = "https://graph.facebook.com/v21.0";
const CONFIG_FILE = path.join(PATHS.DATA_DIR, "publish.json");
const APPROVED_DIR = path.join(PATHS.OUTPUTS_DIR, "approved");

// ---- config (token + ig_user_id + base pública) ----
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch (e) { return {}; }
}
function saveConfig(cfg) {
  if (!fs.existsSync(PATHS.DATA_DIR)) fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const tmp = CONFIG_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, CONFIG_FILE);
}
function ig() {
  const c = (loadConfig().instagram) || {};
  // Sanea o token na LEITURA: tokens da Meta não têm espaços/quebras. Remover whitespace
  // interno auto-corrige um token colado quebrado (uma das causas de "Cannot parse access
  // token") sem exigir re-salvar. No SAVE também saneamos.
  if (c.access_token != null) c.access_token = String(c.access_token).replace(/\s+/g, "");
  return c;
}
function isConfigured() { const c = ig(); return !!(c.access_token && c.ig_user_id); }
function publicBase() {
  const c = loadConfig();
  return String(c.public_base_url || process.env.PUBLIC_BASE_URL || "https://mkt.4st.co").replace(/\/+$/, "");
}
// Config SEM segredos (p/ o front).
function publicConfig() {
  const c = ig();
  return {
    configured: isConfigured(),
    ig_user_id: c.ig_user_id || null,
    username: c.username || null,
    public_base_url: publicBase(),
    connected_at: c.connected_at || null,
    token_hint: c.access_token ? ("…" + String(c.access_token).slice(-4)) : null,
    connection: connectionState(),  // estado VERIFICADO com a Meta (nao apenas "tem token salvo")
  };
}
// Salva token/ID/base. NÃO valida com a Meta aqui (use testConnection depois).
function setInstagram({ access_token, ig_user_id, public_base_url }) {
  const cfg = loadConfig();
  cfg.instagram = cfg.instagram || {};
  if (access_token != null) cfg.instagram.access_token = String(access_token).replace(/\s+/g, "");
  if (ig_user_id != null) cfg.instagram.ig_user_id = String(ig_user_id).trim();
  if (public_base_url != null) cfg.public_base_url = String(public_base_url).trim();
  cfg.instagram.connected_at = new Date().toISOString();
  saveConfig(cfg);
  return publicConfig();
}

// Inspeciona um token na própria Meta: que TIPO ele é e até quando vale.
//
// Existe porque o painel aceitava um token de 1 hora sem dizer nada — e isso derrubou a conexão duas
// vezes. A informação sempre esteve a uma chamada de distância: o `debug_token` responde tipo,
// validade e permissões. Guardar o resultado permite avisar ANTES de a publicação falhar, em vez de
// a pessoa descobrir pelo post que não saiu.
async function inspecionaToken(token) {
  const t = String(token || "").replace(/\s+/g, "");
  if (!t) return { ok: false, motivo: "sem token" };
  // O próprio token inspeciona a si mesmo: vale para tokens do mesmo app, e evita precisar do
  // app_secret — que seria mais um segredo para guardar aqui dentro.
  const r = await graphGet("/debug_token", { input_token: t, access_token: t }, "inspecionar o token");
  const d = r.ok && r.body && r.body.data;
  if (!d) {
    const e = r.body && r.body.error;
    return { ok: false, motivo: (e && e.message) || "não consegui inspecionar este token" };
  }
  const expiraEm = Number(d.expires_at) || 0;   // 0 = não expira
  const acessoAte = Number(d.data_access_expires_at) || 0;
  const escopos = Array.isArray(d.scopes) ? d.scopes : [];
  return {
    ok: true,
    valido: !!d.is_valid,
    tipo: String(d.type || "").toUpperCase(),          // USER | PAGE
    permanente: expiraEm === 0,
    expira_em: expiraEm ? new Date(expiraEm * 1000).toISOString() : null,
    acesso_ate: acessoAte ? new Date(acessoAte * 1000).toISOString() : null,
    escopos,
    pode_publicar: escopos.indexOf("instagram_content_publish") >= 0,
  };
}

// Deriva o token da PÁGINA a partir do token de usuário guardado, e troca — se ele for permanente.
// É a dança que fizemos à mão: o token de Página tirado de um token de usuário de longa duração não
// tem data de validade, e só alcança a Página, não a conta inteira da pessoa.
async function tornarPermanente() {
  const c = ig();
  if (!c.access_token) return { ok: false, error: "Cole o token de acesso primeiro." };
  const atual = await inspecionaToken(c.access_token);
  if (!atual.ok) return { ok: false, error: atual.motivo };
  if (atual.tipo === "PAGE" && atual.permanente) {
    return { ok: true, ja_permanente: true, mensagem: "A conexão já é permanente: o token é da Página e não tem data para vencer." };
  }
  if (!atual.permanente) {
    return {
      ok: false, code: "E_TOKEN_CURTO",
      error: "Este token vence em " + (atual.expira_em ? new Date(atual.expira_em).toLocaleString("pt-BR") : "breve")
        + ". Estenda ele antes (no depurador de tokens da Meta, botão \"Estender token de acesso\") e cole o estendido aqui — só a partir de um token de longa duração é possível gerar um da Página que não expira.",
    };
  }
  // Token de usuário permanente: acha a Página com o Instagram certo.
  const disc = await graphGet("/me/accounts", { fields: "name,access_token,instagram_business_account{id,username}", access_token: c.access_token }, "listar as Páginas");
  if (!disc.ok || (disc.body && disc.body.error)) {
    const e = disc.body && disc.body.error;
    return { ok: false, error: (e && e.message) || "Não consegui listar as Páginas com este token." };
  }
  const paginas = Array.isArray(disc.body.data) ? disc.body.data : [];
  const alvo = paginas.find((p) => p.instagram_business_account && (!c.ig_user_id || p.instagram_business_account.id === c.ig_user_id))
    || paginas.find((p) => p.instagram_business_account);
  if (!alvo || !alvo.access_token) {
    return { ok: false, error: "Não achei uma Página com conta Instagram vinculada neste token." };
  }
  const daPagina = await inspecionaToken(alvo.access_token);
  if (!daPagina.ok || !daPagina.permanente) {
    return { ok: false, code: "E_PAGINA_NAO_PERMANENTE", error: "O token da Página veio com data de validade — o token de usuário não era de longa duração." };
  }
  // Guarda o anterior antes de trocar: a troca precisa ser reversível.
  const cfg = loadConfig();
  cfg.instagram = cfg.instagram || {};
  cfg.instagram.token_anterior = { valor: cfg.instagram.access_token, trocado_em: new Date().toISOString() };
  cfg.instagram.access_token = alvo.access_token;
  cfg.instagram.token_kind = "page";
  cfg.instagram.ig_user_id = alvo.instagram_business_account.id;
  cfg.instagram.username = alvo.instagram_business_account.username || cfg.instagram.username;
  cfg.instagram.page_id = alvo.id; cfg.instagram.page_name = alvo.name;
  cfg.instagram.connected_at = new Date().toISOString();
  saveConfig(cfg);
  return { ok: true, trocado: true, pagina: alvo.name, username: cfg.instagram.username, acesso_ate: daPagina.acesso_ate };
}

// ---- Graph API ----
// Teto de tempo por chamada. Sem isso, uma instabilidade da Meta segurava a requisição do
// usuário por minutos (o padrão do fetch do Node é longuíssimo): a tela ficava em "publicando",
// ele reenviava e saía post duplicado; no agendador, o tick inteiro travava naquele item.
const GRAPH_TIMEOUT_MS = Number(process.env.GRAPH_TIMEOUT_MS || 30000) || 30000;
function graphTimeoutError(step) {
  const e = new Error("O Instagram não respondeu a tempo ao " + step + ". Confira no Instagram se o post saiu antes de tentar de novo.");
  e.code = "E_GRAPH_TIMEOUT";
  return e;
}
// GET: o access_token vai no header Authorization, NÃO na query string — token em URL vaza em
// log de proxy, de APM e em mensagens de erro que incluem a URL. (A Graph API aceita Bearer.)
async function graphGet(p, params, step) {
  const params2 = Object.assign({}, params || {});
  const token = String(params2.access_token == null ? "" : params2.access_token).replace(/\s+/g, "");
  delete params2.access_token;
  const qs = new URLSearchParams(params2);
  const headers = token ? { Authorization: "Bearer " + token } : {};
  let r;
  try {
    r = await fetch(GRAPH + p + (qs.toString() ? "?" + qs.toString() : ""), { headers, signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) throw graphTimeoutError(step || "consultar a conta");
    throw e;
  }
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}
async function graphPost(p, params, token, step) {
  token = String(token == null ? "" : token).replace(/\s+/g, "");
  if (!token) { const e = new Error("Instagram não conectado — cole o token em Configurações › Publicação Instagram."); e.code = "E_NO_TOKEN"; throw e; }
  const body = new URLSearchParams(Object.assign({}, params, { access_token: token }));
  let r;
  try {
    r = await fetch(GRAPH + p, { method: "POST", body, signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) throw graphTimeoutError(step || "publicar");
    throw e;
  }
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

// Verifica o token e, se preciso, DESCOBRE o ID da conta IG pela Página ligada — assim o
// usuário só precisa colar o TOKEN. Retorna { ok, username?, ig_user_id?, error? }.
async function testConnection() {
  const c = ig();
  if (!c.access_token) return { ok: false, configured: false, error: "Cole o token de acesso primeiro." };
  // Sem ig_user_id ainda: acha a conta IG Business ligada a uma Página do Facebook.
  if (!c.ig_user_id) {
    const disc = await graphGet("/me/accounts", { fields: "name,instagram_business_account{id,username}", access_token: c.access_token }, "listar as Páginas");
    if (!disc.ok || disc.body.error) { const de = disc.body && disc.body.error; const dmsg = (de && de.message) || "Não consegui listar as Páginas com esse token."; recordCheck(false, { code: (de && de.code) || null, message: dmsg }); return { ok: false, configured: false, error: dmsg }; }
    const pg = (Array.isArray(disc.body.data) ? disc.body.data : []).find((p) => p.instagram_business_account && p.instagram_business_account.id);
    if (!pg) return { ok: false, configured: false, error: "Token ok, mas não achei uma conta Instagram Business ligada a uma Página. Confirme que @4selet é Profissional e está vinculada a uma Página do Facebook." };
    const cfg = loadConfig(); cfg.instagram = cfg.instagram || {};
    cfg.instagram.ig_user_id = pg.instagram_business_account.id;
    cfg.instagram.username = pg.instagram_business_account.username || cfg.instagram.username;
    cfg.instagram.page_id = pg.id; cfg.instagram.page_name = pg.name; // guardado p/ o cross-post no Facebook (fase 2)
    saveConfig(cfg);
    recordCheck(true);
    return { ok: true, configured: true, username: cfg.instagram.username, ig_user_id: cfg.instagram.ig_user_id, page: pg.name };
  }
  // Já temos o ID: valida.
  const r = await graphGet("/" + c.ig_user_id, { fields: "username,name", access_token: c.access_token }, "conferir a conta");
  if (!r.ok || r.body.error) {
    const e = r.body && r.body.error;
    const expirou = e && (e.code === 190 || e.type === "OAuthException");
    const msg = expirou
      ? "A conexão com o Instagram expirou. Cole um token novo em Configurações › Publicação Instagram e clique em Testar."
      : ((e && e.message) || ("HTTP " + r.status));
    recordCheck(false, { code: (e && e.code) || null, message: msg });
    return { ok: false, configured: true, error: msg };
  }
  const cfg = loadConfig(); cfg.instagram.username = r.body.username || cfg.instagram.username; saveConfig(cfg);
  recordCheck(true);
  return { ok: true, configured: true, username: r.body.username, ig_user_id: c.ig_user_id };
}

// ---- gate de aprovação (mesma invariante do check_approval_gate) ----
function assertApproved(folder) {
  const dir = path.join(APPROVED_DIR, String(folder));
  if (!dir.startsWith(APPROVED_DIR + path.sep)) { const e = new Error("peça inválida"); e.code = "E_BAD_FOLDER"; throw e; }
  if (!fs.existsSync(dir)) { const e = new Error("A peça precisa estar APROVADA para publicar."); e.code = "E_NOT_APPROVED"; throw e; }
  let status; try { status = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8").replace(/^﻿/, "")); } catch (e) { status = null; }
  if (!status || status.status !== "approved") { const e = new Error("status.json não está 'approved'."); e.code = "E_INVALID_STATE"; throw e; }
  if (!status.content_hashes || !Object.keys(status.content_hashes).length) { const e = new Error("Aprovada sem content_hashes — re-aprove a peça."); e.code = "E_GATE_NO_HASHES"; throw e; }
  const divs = diffHashes(status.content_hashes, hashDirectory(dir, ["status.json", "preview.html"]));
  if (divs.length) { const e = new Error("O conteúdo mudou depois de aprovado — rode a verificação e re-aprove."); e.code = "E_HASH_MISMATCH"; throw e; }
  return { dir, status };
}

// Descobre as imagens a publicar (na ordem) a partir da pasta aprovada.
// Depois que uma arte importada é preparada para edição, o slide passa a existir em dois
// arquivos ao mesmo tempo (slide_1.jpg trazido pela pessoa + slide_1.png redesenhado).
// Sem esta escolha, o carrossel ia para o Instagram com CADA slide publicado duas vezes.
// Fica o PNG, que é a versão redesenhada e editável.
function umaPorSlide(nomes) {
  const ordem = { png: 3, jpg: 2, jpeg: 2, webp: 1 };
  const porNumero = new Map();
  for (const f of nomes) {
    const n = parseInt((f.match(/slide_0*(\d+)\./i) || [])[1] || "0", 10);
    const ext = (f.match(/\.([^.]+)$/) || [, ""])[1].toLowerCase();
    const atual = porNumero.get(n);
    const extAtual = atual ? (atual.match(/\.([^.]+)$/) || [, ""])[1].toLowerCase() : "";
    if (!atual || (ordem[ext] || 0) > (ordem[extAtual] || 0)) porNumero.set(n, f);
  }
  return Array.from(porNumero.entries()).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}
function pickImages(dir, kind) {
  const slidesDir = path.join(dir, "slides");
  if (fs.existsSync(slidesDir)) {
    const slides = umaPorSlide(fs.readdirSync(slidesDir)
      .filter((f) => /^slide_0*\d+\.(png|jpe?g|webp)$/i.test(f)))
      .map((f) => path.join(slidesDir, f));
    if (slides.length) return slides;
  }
  const ads = path.join(dir, "ads");
  for (const name of ["feed.png", "feed.jpg", "feed.jpeg", "ad.png", "ad.jpg", "ad.jpeg"]) {
    const p = path.join(ads, name);
    if (fs.existsSync(p)) return [p];
  }
  return [];
}
function readCaption(dir) {
  const p = path.join(dir, "copy", "instagram_caption.txt");
  try { return fs.readFileSync(p, "utf8").trim(); } catch (e) { return ""; }
}

async function publishImage(igUserId, token, imageUrl, caption) {
  const c = await graphPost("/" + igUserId + "/media", { image_url: imageUrl, caption: caption || "" }, token, "preparar a imagem");
  if (!c.ok || !c.body.id) throw gerr("criar o contêiner da imagem", c);
  const p = await graphPost("/" + igUserId + "/media_publish", { creation_id: c.body.id }, token, "publicar a imagem");
  if (!p.ok || !p.body.id) throw gerr("publicar a imagem", p);
  return { post_id: p.body.id, creation_id: c.body.id };
}
async function publishCarousel(igUserId, token, imageUrls, caption) {
  const children = [];
  for (const url of imageUrls) {
    const c = await graphPost("/" + igUserId + "/media", { image_url: url, is_carousel_item: "true" }, token, "preparar um slide do carrossel");
    if (!c.ok || !c.body.id) throw gerr("criar um slide do carrossel", c);
    children.push(c.body.id);
  }
  const car = await graphPost("/" + igUserId + "/media", { media_type: "CAROUSEL", children: children.join(","), caption: caption || "" }, token, "montar o carrossel");
  if (!car.ok || !car.body.id) throw gerr("montar o carrossel", car);
  const p = await graphPost("/" + igUserId + "/media_publish", { creation_id: car.body.id }, token, "publicar o carrossel");
  if (!p.ok || !p.body.id) throw gerr("publicar o carrossel", p);
  return { post_id: p.body.id, creation_id: car.body.id };
}
function gerr(step, r) {
  const err = r.body && r.body.error;
  let msg = (err && err.message) || ("HTTP " + r.status);
  // Erro 190 / OAuthException = token expirado, revogado ou malformado. Troca o texto cru da
  // Meta ("Invalid OAuth access token - Cannot parse access token") por orientação clara.
  if (err && (err.code === 190 || err.type === "OAuthException")) {
    msg = "a conexão com o Instagram expirou ou o token está inválido. Reconecte em Configurações › Publicação Instagram (cole um token novo e clique em Testar).";
    recordCheck(false, { code: 190, message: msg }); // o painel para de dizer "Conectado"
  }
  const e = new Error("Falha ao " + step + ": " + msg); e.code = "E_GRAPH"; return e;
}

// Memória do ÚLTIMO contato real com a Meta. Sem isto, o painel dizia "Conectado" só porque
// existia um token salvo no disco — e ficou 18 dias anunciando uma conexão morta (o token
// colado em 17/07 era de curta duração e venceu no mesmo dia). Agora todo contato com a
// Graph API deixa registro, e a tela mostra o que foi de fato verificado.
function recordCheck(ok, err) {
  try {
    const cfg = loadConfig();
    cfg.instagram = cfg.instagram || {};
    cfg.instagram.last_check = {
      ok: !!ok,
      at: new Date().toISOString(),
      code: (err && err.code) || null,
      message: ok ? null : String((err && err.message) || "Falha ao falar com o Instagram.").slice(0, 300),
    };
    saveConfig(cfg);
  } catch (e) { /* registrar o estado nunca pode derrubar a publicação */ }
}

// Traduz o que sabemos para um estado que a tela pode mostrar sem mentir.
//   sem_token    -> nunca foi configurado
//   nao_testado  -> tem token, mas ninguém confirmou com a Meta ainda
//   conectado    -> último contato com a Meta deu certo
//   expirado     -> último contato falhou por token inválido/expirado
//   com_erro     -> último contato falhou por outro motivo (rede, permissão)
function connectionState() {
  const c = ig();
  if (!c.access_token) return { state: "sem_token", checked_at: null, message: null };
  const lc = c.last_check;
  if (!lc || !lc.at) return { state: "nao_testado", checked_at: null, message: null };
  if (lc.ok) return { state: "conectado", checked_at: lc.at, message: null };
  const expirado = lc.code === 190;
  return { state: expirado ? "expirado" : "com_erro", checked_at: lc.at, message: lc.message || null };
}

// Orquestra a publicação de uma peça aprovada. dryRun (ou não-configurado) = simula.
async function publishTask(folder, opts) {
  opts = opts || {};
  const gate = assertApproved(folder); // lança se não estiver aprovada/íntegra
  const images = pickImages(gate.dir, opts.kind);
  if (!images.length) { const e = new Error("Não achei imagem publicável nesta peça."); e.code = "E_NO_IMAGE"; throw e; }
  const caption = (opts.caption != null ? String(opts.caption) : readCaption(gate.dir));
  const dryRun = !!opts.dryRun || !isConfigured();
  if (dryRun) {
    return {
      ok: true, dry_run: true,
      reason: isConfigured() ? "Publicação simulada (dry-run)." : "Instagram ainda não conectado — simulado.",
      images: images.length, type: images.length > 1 ? "carrossel" : "imagem",
      caption_preview: caption.slice(0, 120),
    };
  }
  const c = ig();
  const base = publicBase();
  const urls = images.map((abs) => base + "/m/" + media.mint(abs));
  const res = images.length > 1
    ? await publishCarousel(c.ig_user_id, c.access_token, urls, caption)
    : await publishImage(c.ig_user_id, c.access_token, urls[0], caption);
  // Busca o link público do post (pra "ver no Instagram" no histórico). Best-effort.
  let permalink = "";
  try { const pl = await graphGet("/" + res.post_id, { fields: "permalink", access_token: c.access_token }, "buscar o link do post"); if (pl.ok && pl.body && pl.body.permalink) permalink = pl.body.permalink; } catch (e) { /* segue sem link: o post ja saiu */ }
  return { ok: true, dry_run: false, type: images.length > 1 ? "carrossel" : "imagem", post_id: res.post_id, permalink };
}

module.exports = {
  connectionState,
  isConfigured, publicConfig, setInstagram, testConnection, publishTask, assertApproved,
  inspecionaToken, tornarPermanente,   // diz o QUE o token e e ate quando vale; e deriva o da Pagina
};
