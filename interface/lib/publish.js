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
function ig() { return (loadConfig().instagram) || {}; }
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
  };
}
// Salva token/ID/base. NÃO valida com a Meta aqui (use testConnection depois).
function setInstagram({ access_token, ig_user_id, public_base_url }) {
  const cfg = loadConfig();
  cfg.instagram = cfg.instagram || {};
  if (access_token != null) cfg.instagram.access_token = String(access_token).trim();
  if (ig_user_id != null) cfg.instagram.ig_user_id = String(ig_user_id).trim();
  if (public_base_url != null) cfg.public_base_url = String(public_base_url).trim();
  cfg.instagram.connected_at = new Date().toISOString();
  saveConfig(cfg);
  return publicConfig();
}

// ---- Graph API ----
async function graphGet(p, params) {
  const qs = new URLSearchParams(params || {});
  const r = await fetch(GRAPH + p + "?" + qs.toString());
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}
async function graphPost(p, params, token) {
  const body = new URLSearchParams(Object.assign({}, params, { access_token: token }));
  const r = await fetch(GRAPH + p, { method: "POST", body });
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
    const disc = await graphGet("/me/accounts", { fields: "name,instagram_business_account{id,username}", access_token: c.access_token });
    if (!disc.ok || disc.body.error) return { ok: false, configured: false, error: (disc.body.error && disc.body.error.message) || "Não consegui listar as Páginas com esse token." };
    const pg = (Array.isArray(disc.body.data) ? disc.body.data : []).find((p) => p.instagram_business_account && p.instagram_business_account.id);
    if (!pg) return { ok: false, configured: false, error: "Token ok, mas não achei uma conta Instagram Business ligada a uma Página. Confirme que @4selet é Profissional e está vinculada a uma Página do Facebook." };
    const cfg = loadConfig(); cfg.instagram = cfg.instagram || {};
    cfg.instagram.ig_user_id = pg.instagram_business_account.id;
    cfg.instagram.username = pg.instagram_business_account.username || cfg.instagram.username;
    cfg.instagram.page_id = pg.id; cfg.instagram.page_name = pg.name; // guardado p/ o cross-post no Facebook (fase 2)
    saveConfig(cfg);
    return { ok: true, configured: true, username: cfg.instagram.username, ig_user_id: cfg.instagram.ig_user_id, page: pg.name };
  }
  // Já temos o ID: valida.
  const r = await graphGet("/" + c.ig_user_id, { fields: "username,name", access_token: c.access_token });
  if (!r.ok || r.body.error) return { ok: false, configured: true, error: (r.body.error && r.body.error.message) || ("HTTP " + r.status) };
  const cfg = loadConfig(); cfg.instagram.username = r.body.username || cfg.instagram.username; saveConfig(cfg);
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
function pickImages(dir, kind) {
  const slidesDir = path.join(dir, "slides");
  if (fs.existsSync(slidesDir)) {
    const slides = fs.readdirSync(slidesDir)
      .filter((f) => /^slide_0*\d+\.(png|jpe?g)$/i.test(f))
      .map((f) => ({ f, n: parseInt((f.match(/slide_0*(\d+)\./i) || [])[1] || "0", 10) }))
      .sort((a, b) => a.n - b.n)
      .map((s) => path.join(slidesDir, s.f));
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
  const c = await graphPost("/" + igUserId + "/media", { image_url: imageUrl, caption: caption || "" }, token);
  if (!c.ok || !c.body.id) throw gerr("criar o contêiner da imagem", c);
  const p = await graphPost("/" + igUserId + "/media_publish", { creation_id: c.body.id }, token);
  if (!p.ok || !p.body.id) throw gerr("publicar a imagem", p);
  return { post_id: p.body.id, creation_id: c.body.id };
}
async function publishCarousel(igUserId, token, imageUrls, caption) {
  const children = [];
  for (const url of imageUrls) {
    const c = await graphPost("/" + igUserId + "/media", { image_url: url, is_carousel_item: "true" }, token);
    if (!c.ok || !c.body.id) throw gerr("criar um slide do carrossel", c);
    children.push(c.body.id);
  }
  const car = await graphPost("/" + igUserId + "/media", { media_type: "CAROUSEL", children: children.join(","), caption: caption || "" }, token);
  if (!car.ok || !car.body.id) throw gerr("montar o carrossel", car);
  const p = await graphPost("/" + igUserId + "/media_publish", { creation_id: car.body.id }, token);
  if (!p.ok || !p.body.id) throw gerr("publicar o carrossel", p);
  return { post_id: p.body.id, creation_id: car.body.id };
}
function gerr(step, r) {
  const msg = (r.body && r.body.error && r.body.error.message) || ("HTTP " + r.status);
  const e = new Error("Falha ao " + step + ": " + msg); e.code = "E_GRAPH"; return e;
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
  return { ok: true, dry_run: false, type: images.length > 1 ? "carrossel" : "imagem", post_id: res.post_id };
}

module.exports = {
  isConfigured, publicConfig, setInstagram, testConnection, publishTask, assertApproved,
};
