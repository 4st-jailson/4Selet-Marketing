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
const config = require("./config");
const { PATHS } = config;
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
// A arte que vai ao ar depende do DESTINO, não só do que existe na pasta. Antes esta função
// recebia o tipo da peça e o descartava: olhava slides/ e ads/feed.png e mais nada. Duas
// consequências medidas — a peça de Story morria com "não achei imagem publicável" (a pasta
// story/ nunca era consultada), e a peça de Mídia gerada em 4:5 + 9:16 publicava só o feed e
// descartava o vertical em silêncio, dizendo "Publicado!".
function pickImages(dir, kind, destino) {
  const dest = String(destino || "feed");
  const nomes = (sub, re) => {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => re.test(f)).map((f) => path.join(d, f));
  };
  if (dest === "story") {
    // Os cartões do Story, em ordem. Cada um vira uma postagem própria.
    const cartoes = nomes("story", /^story_0*\d+\.(png|jpe?g|webp)$/i)
      .sort((a, b) => (parseInt((a.match(/story_0*(\d+)\./i) || [])[1] || "0", 10))
        - (parseInt((b.match(/story_0*(\d+)\./i) || [])[1] || "0", 10)));
    if (cartoes.length) return cartoes;
    // A peça de Mídia gera o 9:16 como ads/story.png — é o vertical dela.
    for (const n of ["story.png", "story.jpg", "story.jpeg"]) {
      const p = path.join(dir, "ads", n);
      if (fs.existsSync(p)) return [p];
    }
    // Sem vertical próprio, vale a arte da peça: o Instagram encaixa a 4:5 no Story.
    // É uma escolha da pessoa (ela pediu Story), não um palpite do painel.
  }
  const slidesDir = path.join(dir, "slides");
  if (fs.existsSync(slidesDir)) {
    const slides = umaPorSlide(fs.readdirSync(slidesDir)
      .filter((f) => /^slide_0*\d+\.(png|jpe?g|webp)$/i.test(f)))
      .map((f) => path.join(slidesDir, f));
    // No Story não existe carrossel: cada cartão é uma postagem. Mandar os 5 slides como
    // 5 stories seguidos é o que a pessoa espera de "postar este carrossel no story".
    if (slides.length) return slides;
  }
  const ads = path.join(dir, "ads");
  // square.png (1:1) entrou na lista: é formato de feed válido, e a peça de Mídia gerada só em
  // 1:1 morria com "não achei imagem publicável" por não estar aqui.
  for (const name of ["feed.png", "feed.jpg", "feed.jpeg", "ad.png", "ad.jpg", "ad.jpeg", "square.png", "square.jpg"]) {
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
// STORY. Não existe carrossel de story: cada cartão é uma postagem própria, e é assim que o
// aplicativo funciona também. Publica em ordem e devolve todos os ids — se o terceiro falhar,
// os dois primeiros JÁ ESTÃO no ar, e quem chamou precisa saber disso para não mandar de novo.
async function publishStories(igUserId, token, imageUrls) {
  const feitos = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const c = await graphPost("/" + igUserId + "/media",
        { image_url: imageUrls[i], media_type: "STORIES" }, token, "preparar o cartão " + (i + 1) + " do story");
      if (!c.ok || !c.body.id) throw gerr("criar o cartão " + (i + 1) + " do story", c);
      const p = await graphPost("/" + igUserId + "/media_publish",
        { creation_id: c.body.id }, token, "publicar o cartão " + (i + 1) + " do story");
      if (!p.ok || !p.body.id) throw gerr("publicar o cartão " + (i + 1) + " do story", p);
      feitos.push(p.body.id);
    } catch (e) {
      if (!feitos.length) throw e;   // nada saiu: o erro sobe limpo
      // Parcial: dizer QUANTOS foram é o que evita a pessoa republicar tudo e duplicar o story.
      const err = new Error("Publiquei " + feitos.length + " de " + imageUrls.length
        + " cartões do story e o seguinte falhou: " + e.message
        + " Os que já saíram estão no ar — poste só os que faltam, pelo celular.");
      err.code = "E_STORY_PARCIAL"; err.publicados = feitos; throw err;
    }
  }
  return { post_id: feitos[0], cartoes: feitos };
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
// ---- Apagar um post do Instagram ---------------------------------------------------------
// A Meta APAGA de verdade: DELETE /<IG_MEDIA_ID>. Vale para post comum, Story, Reel e álbum de
// carrossel INTEIRO (não dá para tirar um slide de dentro do carrossel). Exige a permissão
// `instagram_manage_contents` no app — que é DIFERENTE da que publica (`instagram_content_publish`).
// Conferido em 19/08/2026: o token da conta tem instagram_basic + instagram_content_publish e NÃO
// tem manage_contents, então a chamada volta com erro de permissão. Por isso o erro é traduzido
// aqui: sem isso a pessoa recebe "(#200) Requires ... permission" e não tem como saber o que fazer.
async function deleteMedia(postId) {
  const id = String(postId || "").trim();
  if (!id) { const e = new Error("Este registro não guardou o identificador do post no Instagram, então o painel não sabe qual apagar. Apague pelo aplicativo e use “Tirar do histórico”."); e.code = "E_SEM_POST_ID"; throw e; }
  if (!isConfigured()) { const e = new Error("Instagram não conectado — cole o token em Configurações › Publicação Instagram."); e.code = "E_NO_TOKEN"; throw e; }
  const c = ig();
  const token = String(c.access_token || "").replace(/\s+/g, "");
  let r;
  try {
    r = await fetch(GRAPH + "/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) throw graphTimeoutError("apagar o post no Instagram");
    throw e;
  }
  const body = await r.json().catch(() => ({}));
  const v = leituraDoApagar(r.status, body, id);
  if (!v.ok) {
    if (v.code === "E_TOKEN") recordCheck(false, v.message);
    const e = new Error(v.message); e.code = v.code; throw e;
  }
  // CONFERE em vez de confiar. Dizer "apagado" com o post no ar é o pior desfecho possível: a
  // linha some do histórico, a peça volta a ficar publicável, e o post segue lá sem ninguém
  // olhando. A leitura da resposta é boa mas não é prova — e um dos casos que ela aceita é
  // justamente "esse objeto não existe", que também é o que a Meta responde quando ela recusou
  // a operação por outro motivo. Uma consulta a mais resolve a dúvida de vez.
  const aindaLa = await mediaAindaExiste(id, token);
  if (aindaLa === true) {
    const e = new Error("A Meta aceitou o pedido mas o post continua no ar. Não tirei da lista para "
      + "você não perder o rastro dele. Tente de novo em instantes; se insistir, apague pelo aplicativo "
      + "e use “Só tirar desta lista”.");
    e.code = "E_APAGAR_NAO_PEGOU"; throw e;
  }
  recordCheck(true);
  // `conferido` diz se a saída do ar foi CONFIRMADA com a Meta ou apenas aceita por ela. A tela
  // usa isso para escolher a frase: afirmar "confirmei" sem ter confirmado é como o painel
  // anunciava conexão viva só por existir um token salvo.
  return Object.assign({}, v, { conferido: aindaLa === false });
}

// O post ainda existe? true = existe, false = não existe, null = não deu para saber (rede, timeout).
// O `null` é de propósito: na dúvida NÃO se afirma que o post sobreviveu — seria bloquear a
// limpeza do histórico por causa de uma consulta que falhou.
async function mediaAindaExiste(id, token) {
  try {
    const r = await graphGet("/" + encodeURIComponent(id), { fields: "id", access_token: token }, "conferir se o post saiu do ar");
    if (r.ok && r.body && r.body.id) return true;
    const err = (r.body && r.body.error) || {};
    if (Number(err.code) === 100) return false;   // sumiu, que é o que se queria
    return null;
  } catch (e) { return null; }
}

// A LEITURA da resposta da Meta, separada da chamada de rede — assim dá para conferir cada
// resposta possível na bateria sem bater na Meta de verdade (apagar não é coisa que se testa
// com chamada real). Devolve {ok:true,...} ou {ok:false, code, message}.
function leituraDoApagar(status, body, id) {
  if (status >= 200 && status < 300 && body && (body.success === true || body.deleted_id)) {
    return { ok: true, deleted_id: body.deleted_id || id };
  }
  const err = (body && body.error) || {};
  const msg = String(err.message || "");
  const cod = Number(err.code || 0);
  // Falta a permissão: é o caso ESPERADO hoje (o token da conta tem instagram_basic e
  // instagram_content_publish, não tem manage_contents), e o único que a pessoa resolve sozinha.
  if (cod === 200 || cod === 10 || /permission|manage_contents/i.test(msg)) {
    return { ok: false, code: "E_SEM_PERMISSAO_APAGAR", message:
      "Falta a permissão instagram_manage_contents no app da Meta — é ela que autoriza apagar post, "
      + "Story e Reel. Como a conta @4selet é sua e você tem papel no app, o Acesso Padrão basta: "
      + "não precisa passar por Análise do App. Caminho: developers.facebook.com › app “Painel 4Selet "
      + "Marketing” › Permissões e recursos › procure instagram_manage_contents › Obter acesso padrão. "
      + "Depois gere um token com essa permissão, cole em Configurações › Publicação Instagram e clique "
      + "em “Tornar permanente”. Enquanto isso, apague pelo aplicativo e use “Só tirar desta lista”." };
  }
  // O post já não existe (apagado pelo celular antes): não é erro, é o resultado que se queria.
  // A frase tem que dizer que o OBJETO sumiu. "Unsupported delete request" sozinho NÃO serve:
  // é o que a Meta responde quando recusa a operação — e aceitá-lo aqui fazia o painel anunciar
  // "apagado" com o post no ar. A confirmação final é a consulta em deleteMedia, mas esta porta
  // também não pode ficar aberta: leituraDoApagar é chamada direto pela bateria.
  if (cod === 100 && /does not exist|cannot be loaded|nonexisting/i.test(msg)) {
    return { ok: true, deleted_id: id, ja_nao_existia: true };
  }
  if (cod === 190) {
    return { ok: false, code: "E_TOKEN", message: "A conexão com o Instagram expirou. Cole um token novo em Configurações e tente de novo." };
  }
  return { ok: false, code: "E_APAGAR", message: "O Instagram recusou apagar este post: " + (msg || ("erro " + status)) + "." };
}

// O tipo da peça, lido da peça. `require` preguiçoso de propósito: content.js é o módulo grande
// do painel e carregá-lo no topo daqui amarra os dois em ciclo na primeira vez que alguém fizer
// content.js falar com a publicação. Se por qualquer motivo não der para classificar, devolve ""
// — e "" só bate em destino nenhum, então a peça cai na recusa explicada em vez de ir para o
// lugar errado calada.
function kindDaPeca(folder) {
  try {
    const content = require("./content");
    const t = content.getTask(folder);
    return (t && t.kind) ? String(t.kind) : "";
  } catch (e) { return ""; }
}

async function publishTask(folder, opts) {
  opts = opts || {};
  const gate = assertApproved(folder); // lança se não estiver aprovada/íntegra
  // O TIPO da peça vem da PRÓPRIA PEÇA, não do que a tela mandou. A tela chama sem `kind`
  // (sempre chamou), e enquanto a trava de destino lia `opts.kind` cru ela recebia vazio,
  // não encontrava esse vazio na lista de tipos aceitos por nenhum destino e recusava TUDO
  // com "Uma peça de conteúdo não vai para o Story" — inclusive a peça certa, no destino certo.
  // classifyKind é a mesma conta que a tela usa para desenhar a peça, então as duas pontas
  // enxergam o mesmo tipo. opts.kind, quando vem, ainda manda (é o caminho do agendamento).
  const kind = String(opts.kind || "") || kindDaPeca(folder);
  // O DESTINO é quem manda: ele decide a arte que vai ao ar e como a Meta é chamada. Sem ele,
  // o painel decidia por "quantos arquivos achei", e todo post saía no feed.
  const destino = config.DESTINO_IDS.indexOf(String(opts.destino || "")) >= 0
    ? String(opts.destino) : config.destinoPadrao(kind);
  if (!config.publicaSozinho(destino, kind)) {
    const d = config.destinoById(destino);
    const nome = (d && d.label) || destino;
    // DOIS motivos diferentes para a mesma recusa, e culpar o errado confunde:
    //   (a) o destino existe mas é manual (Reels): o painel não sabe publicar ali;
    //   (b) o destino é automático, mas não aceita ESTE tipo de peça (um Story 9:16 não é
    //       post de feed). Aqui o problema é a combinação, não o painel.
    const manual = !d || d.modo !== "auto";
    const e = manual
      ? new Error("O painel não publica " + nome + " sozinho — poste pelo celular e use “Já publiquei esta peça por fora — só registrar”.")
      : new Error("Uma peça de " + (config.KIND_LABELS[kind] || kind || "conteúdo")
        + " não vai para o " + nome + ". Escolha outro destino nesta janela.");
    e.code = manual ? "E_DESTINO_MANUAL" : "E_DESTINO_INCOMPATIVEL"; throw e;
  }
  const images = pickImages(gate.dir, kind, destino);
  if (!images.length) {
    const e = new Error(destino === "story"
      ? "Esta peça não tem arte vertical para o Story. Gere a arte da peça (ou, na peça de Mídia, marque o formato 9:16)."
      : "Não achei imagem publicável nesta peça.");
    e.code = "E_NO_IMAGE"; throw e;
  }
  // Story não leva legenda: o texto mora na arte. Mandar legenda ali é campo que não vai a lugar
  // nenhum — e a tela deixou de pedir.
  const caption = destino === "story" ? ""
    : (opts.caption != null ? String(opts.caption) : readCaption(gate.dir));
  const tipo = destino === "story"
    ? (images.length > 1 ? images.length + " cartões de story" : "story")
    : (images.length > 1 ? "carrossel" : "imagem");
  const dryRun = !!opts.dryRun || !isConfigured();
  if (dryRun) {
    return {
      ok: true, dry_run: true, destino,
      reason: isConfigured() ? "Publicação simulada (dry-run)." : "Instagram ainda não conectado — simulado.",
      images: images.length, type: tipo,
      caption_preview: caption.slice(0, 120),
    };
  }
  const c = ig();
  const base = publicBase();
  const urls = images.map((abs) => base + "/m/" + media.mint(abs));
  const res = destino === "story"
    ? await publishStories(c.ig_user_id, c.access_token, urls)
    : (images.length > 1
      ? await publishCarousel(c.ig_user_id, c.access_token, urls, caption)
      : await publishImage(c.ig_user_id, c.access_token, urls[0], caption));
  // Busca o link público do post (pra "ver no Instagram" no histórico). Best-effort.
  let permalink = "";
  try { const pl = await graphGet("/" + res.post_id, { fields: "permalink", access_token: c.access_token }, "buscar o link do post"); if (pl.ok && pl.body && pl.body.permalink) permalink = pl.body.permalink; } catch (e) { /* segue sem link: o post ja saiu */ }
  return { ok: true, dry_run: false, destino, type: tipo, post_id: res.post_id, cartoes: res.cartoes || null, permalink };
}

module.exports = {
  connectionState,
  isConfigured, publicConfig, setInstagram, testConnection, publishTask, assertApproved,
  // Exportado para a bateria: é ele que decide QUAL arte vai ao ar por destino, e essa
  // decisão precisa ser verificável sem chamar a Meta.
  pickImages,
  inspecionaToken, tornarPermanente,   // diz o QUE o token e e ate quando vale; e deriva o da Pagina
  deleteMedia, leituraDoApagar,         // apaga um post publicado; a leitura da resposta e testavel sem rede
};
