// lib/render.js — renderizacao de midia final a partir do conceito gerado pela IA.
//   image    -> PNG 1080x1080 (Playwright via scripts/render_ad.js)
//   feed     -> PNG 1080x1350 (mesma engine)
//   carousel -> 1 PNG por slide (slides/slide_1.png ...)
//   video    -> MP4 9:16 (Remotion, composition BrandStory parametrizada)
// Tudo local, sem chaves externas. Respeita a regra: so renderiza em zona active.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { PATHS, PALETTE, contentTypeById } = require("./config");
const { findTask } = require("./content");

// --- Fila de render (assincrona + serializada) ------------------------------
// Antes usavamos spawnSync, que BLOQUEIA o event loop: enquanto o Playwright/
// Remotion rodava, o painel inteiro ficava travado (health, biblioteca, geracao
// de IA — tudo esperava). Agora cada processo roda via spawn (assincrono) e o
// painel segue respondendo. A fila garante UM render por vez: Chromium/Remotion
// sao pesados; sem isso, uma rajada (ou carrossel) abriria varios processos
// simultaneos e estouraria a memoria da VPS. Resultado: nao-bloqueante E seguro.
let _renderChain = Promise.resolve();
function enqueueRender(task) {
  const run = _renderChain.then(task, task); // roda mesmo se o anterior rejeitou
  _renderChain = run.then(() => undefined, () => undefined); // cadeia nunca quebra
  return run;
}

// Roda um processo Node (render_ad.js / remotion-cli) de forma assincrona, dentro
// da fila. opts.timeout (ms) mata o processo se estourar (usado no video).
// Resolve sempre (nunca rejeita) com { code, stdout, stderr, error, timedOut, ok }.
function spawnAsync(args, opts) {
  opts = opts || {};
  return enqueueRender(() => new Promise((resolve) => {
    let child;
    try {
      const env = opts.env ? Object.assign({}, process.env, opts.env) : process.env;
      child = spawn(process.execPath, args, { cwd: PATHS.PROJECT_ROOT, env });
    } catch (e) {
      return resolve({ code: -1, stdout: "", stderr: "", error: (e && e.message) || String(e), timedOut: false, ok: false });
    }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "", stderr = "", error = "", timedOut = false;
    const MAX = 1024 * 1024 * 16; // teto de captura (evita memoria sem limite)
    child.stdout.on("data", (d) => { if (stdout.length < MAX) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < MAX) stderr += d; });
    let timer = null;
    if (opts.timeout) {
      timer = setTimeout(() => {
        timedOut = true;
        try { child.kill("SIGTERM"); } catch (e) {}
        setTimeout(() => { try { child.kill("SIGKILL"); } catch (e) {} }, 5000).unref();
      }, opts.timeout);
    }
    child.on("error", (err) => { error = (err && err.message) || String(err); });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        code: code === null ? -1 : code,
        stdout: stdout.trim(), stderr: stderr.trim(),
        error, timedOut, ok: code === 0,
      });
    });
  }));
}

const ASSETS = PATHS.ASSETS_DIR;
// file:// CORRETO em qualquer OS. Windows: caminho começa com "C:/" -> "file:///C:/..." (igual
// ao antigo). Linux: caminho começa com "/app/..." -> "file:///app/..." (3 barras). O antigo
// "file:///"+"/app" gerava "file:////app" (4 barras, malformado) e a foto/logo não carregavam no render.
function fileUrl(p) { let s = path.resolve(p).replace(/\\/g, "/"); if (s[0] !== "/") s = "/" + s; return "file://" + s; }
const LOGO_LIGHT = fileUrl(path.join(ASSETS, "logo-4selet-light.png"));
const LOGO_DARK = fileUrl(path.join(ASSETS, "logo-4selet.png"));
const SIMBOLO = fileUrl(path.join(ASSETS, "simbolo.svg"));

// Resolve o JS do CLI do Remotion (sem depender do shim .cmd do npx).
let _remotionCli = null;
function remotionCliPath() {
  if (_remotionCli) return _remotionCli;
  const pkg = require.resolve("@remotion/cli/package.json");
  _remotionCli = path.join(path.dirname(pkg), "remotion-cli.js");
  return _remotionCli;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); } catch (e) { return null; }
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Escape p/ valor de ATRIBUTO (ex.: src="..."). Alem de &<>, neutraliza aspas.
function escAttr(s) { return esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
// Resolve a imagem do template Foto: caminhos locais (/uploads/...) viram file://
// (carregam sempre, sem depender de host externo); http(s)/data/file passam direto.
function resolveImage(u) {
  u = String(u || "");
  if (!u) return "";
  if (/^(https?:|data:|file:)/i.test(u)) return u;
  if (u.charAt(0) === "/") return fileUrl(path.join(__dirname, "..", "public", u.replace(/^\/+/, "")));
  return u;
}

function requireActive(folder) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone !== "active") {
    const e = new Error("renderizar exige zona 'active' (atual: " + loc.zone + ")");
    e.code = "E_NOT_EDITABLE"; throw e;
  }
  return loc;
}

// Executa o render_ad.js oficial (Playwright) — HTML -> PNG. Assincrono (spawn).
// `scale` = deviceScaleFactor: 1 = base; 2 = ALTA RESOLUCAO (ex.: 2160px) p/ download.
async function htmlToPng(htmlPath, outPng, width, height, scale, opts) {
  const script = path.join(PATHS.SCRIPTS_DIR, "render_ad.js");
  const args = [script, htmlPath, outPng, String(width), String(height)];
  if (scale && scale !== 1) args.push(String(scale));
  // strictNet: bloqueia rede externa no render (usado p/ HTML do editor, nao confiavel).
  const spawnOpts = (opts && opts.strictNet) ? { env: { RENDER_STRICT_NET: "1" } } : undefined;
  const r = await spawnAsync(args, spawnOpts);
  return { code: r.code, stdout: r.stdout, stderr: r.stderr || r.error, ok: r.ok };
}

// Fator de resolucao dos renders FINAIS (salvos/baixados): 2x = alta resolucao.
// A previa (renderPreview) fica em 1x de proposito — e so visualizacao na tela.
// Tunavel por env: RENDER_SCALE.
const RENDER_SCALE = Number(process.env.RENDER_SCALE || 2) || 2;

// ---- Templates visuais da marca -------------------------------------------
// 3 layouts on-brand (paleta 4Selet, Inter/JetBrains Mono, logo, Selet Dots).
// Contrato comum: { width, height, eyebrow, headline(HTML), subtext, cta, badge, footer }.
// `headline` chega como HTML ja realcado (spans .accent); os demais sao escapados.
const FONT_LINK = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>';
const DEFAULT_FOOTER = ""; // sem rodapé automático (Hugo: tirar "Para quem sabe que é Selet" de toda postagem)

// Comprimento VISÍVEL do headline (ignora as tags <span> do realce). Usado para
// dimensionar a fonte: sem isso, o markup do destaque (ex.: "0%" vira
// '<span class="accent">0%</span>') inflava a contagem e derrubava a fonte do
// número — quebrando o efeito grande dos headlines curtos do template Destaque.
function headlineLen(html) { return String(html || "").replace(/<[^>]+>/g, "").length; }

// 1) Editorial — radial azul, dots, logo no topo, headline a esquerda, CTA embaixo.
function tplEditorial({ width, height, eyebrow, headline, subtext, cta, badge, footer, dots }) {
  const n = headlineLen(headline);
  const headlineSize = n > 36 ? 100 : n > 22 ? 120 : 168;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; }
  .card {
    position:relative; width:${width}px; height:${height}px; overflow:hidden;
    background: radial-gradient(120% 120% at 80% 10%, ${PALETTE.blue} 0%, ${PALETTE.navy} 42%, ${PALETTE.darker} 100%);
    color:${PALETTE.cloud}; font-family:'Inter',sans-serif;
    display:flex; flex-direction:column; justify-content:space-between;
    padding:96px 92px;
  }
  .dots { position:absolute; inset:0;
    background-image: radial-gradient(${PALETTE.sky}22 2px, transparent 2px);
    background-size: 46px 46px; opacity:.5; }
  .top { position:relative; display:flex; align-items:center; justify-content:space-between; }
  .logo { height:54px; }
  .badge { font-family:'JetBrains Mono',monospace; font-size:30px; letter-spacing:1px;
    color:${PALETTE.darker}; background:${PALETTE.sky}; padding:10px 22px; border-radius:999px; font-weight:500; }
  .mid { position:relative; }
  .eyebrow { font-family:'JetBrains Mono',monospace; color:${PALETTE.sky};
    font-size:32px; letter-spacing:3px; text-transform:uppercase; margin-bottom:30px; }
  .headline { font-weight:700; font-size:${headlineSize}px; line-height:0.98;
    color:#FFFFFF; letter-spacing:-2px; }
  .headline .accent { color:${PALETTE.sky}; font-weight:900; }
  .subtext { margin-top:36px; font-size:40px; line-height:1.34; color:${PALETTE.mist};
    max-width:90%; font-weight:400; }
  .bottom { position:relative; display:flex; align-items:center; justify-content:space-between; }
  .cta { font-weight:800; font-size:36px;
    background:${PALETTE.blue}; color:#FFFFFF; padding:26px 48px; border-radius:999px; }
  .footer { font-family:'JetBrains Mono',monospace; font-size:26px; color:${PALETTE.mist}; opacity:.85; }
</style></head>
<body><div class="card"><div class="dots"></div>
  <div class="top">
    <img class="logo" src="${LOGO_LIGHT}" alt="4Selet"/>
    ${badge ? `<span class="badge">${esc(badge)}</span>` : ""}
  </div>
  <div class="mid">
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    <div class="headline">${headline || ""}</div>
    ${subtext ? `<div class="subtext">${esc(subtext)}</div>` : ""}
  </div>
  <div class="bottom">
    ${cta ? `<span class="cta">${esc(cta)} →</span>` : "<span></span>"}
    ${dots || ""}<span class="footer">${esc(dots ? "" : (footer || DEFAULT_FOOTER))}</span>
  </div>
</div></body></html>`;
}

// 2) Bold — fundo Darker solido, simbolo "4" como marca d'agua, tudo centralizado.
// Pensado p/ headlines curtas number-forward (ex.: "0%", "95%", "Os 4 numeros").
function tplBold({ width, height, eyebrow, headline, subtext, cta, badge, footer, dots }) {
  const n = headlineLen(headline);
  const headlineSize = n > 40 ? 88 : n > 26 ? 104 : n > 16 ? 132 : n > 8 ? 168 : 196;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; }
  .card {
    position:relative; width:${width}px; height:${height}px; overflow:hidden;
    background: linear-gradient(160deg, ${PALETTE.navy} 0%, ${PALETTE.darker} 100%);
    color:${PALETTE.cloud}; font-family:'Inter',sans-serif;
    display:flex; flex-direction:column; align-items:center; justify-content:space-between;
    text-align:center; padding:104px 96px;
  }
  .mark { position:absolute; right:-${Math.round(width * 0.18)}px; bottom:-${Math.round(height * 0.12)}px;
    width:${Math.round(width * 0.72)}px; opacity:.06; }
  .logo { position:relative; height:50px; }
  .mid { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; }
  .eyebrow { font-family:'JetBrains Mono',monospace; color:${PALETTE.sky};
    font-size:32px; letter-spacing:4px; text-transform:uppercase; margin-bottom:36px; }
  .badge { font-family:'JetBrains Mono',monospace; font-size:28px; letter-spacing:1px;
    color:${PALETTE.darker}; background:${PALETTE.sky}; padding:9px 22px; border-radius:999px; font-weight:500; margin-bottom:40px; }
  .headline { font-weight:700; font-size:${headlineSize}px; line-height:0.96;
    color:#FFFFFF; letter-spacing:-3px; }
  .headline .accent { color:${PALETTE.sky}; font-weight:900; }
  .subtext { margin-top:40px; font-size:42px; line-height:1.32; color:${PALETTE.mist};
    max-width:84%; font-weight:400; }
  .bottom { position:relative; display:flex; flex-direction:column; align-items:center; gap:28px; }
  .cta { font-weight:800; font-size:38px;
    background:${PALETTE.blue}; color:#FFFFFF; padding:28px 56px; border-radius:999px; }
  .footer { font-family:'JetBrains Mono',monospace; font-size:26px; color:${PALETTE.mist}; opacity:.85; }
</style></head>
<body><div class="card">
  <img class="mark" src="${SIMBOLO}" alt=""/>
  <img class="logo" src="${LOGO_LIGHT}" alt="4Selet"/>
  <div class="mid">
    ${badge ? `<span class="badge">${esc(badge)}</span>` : ""}
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    <div class="headline">${headline || ""}</div>
    ${subtext ? `<div class="subtext">${esc(subtext)}</div>` : ""}
  </div>
  <div class="bottom">
    ${cta ? `<span class="cta">${esc(cta)} →</span>` : ""}
    ${dots || ""}<span class="footer">${esc(dots ? "" : (footer || DEFAULT_FOOTER))}</span>
  </div>
</div></body></html>`;
}

// 3) Split — banda superior clara (Cloud, logo dark + eyebrow) + banda inferior
// escura (Navy/Darker) com headline e CTA. Contraste editorial.
function tplSplit({ width, height, eyebrow, headline, subtext, cta, badge, footer, dots }) {
  // Em formato quadrado (1080x1080) a banda inferior e mais curta — reduz a
  // tipografia e o padding para o subtexto e o CTA nao serem cortados.
  const square = height < 1200;
  const n = headlineLen(headline);
  const headlineSize = square ? (n > 52 ? 72 : n > 36 ? 84 : n > 22 ? 100 : 124)
                              : (n > 52 ? 84 : n > 36 ? 96 : n > 22 ? 112 : 150);
  const subSize = square ? 34 : 40;
  const topFlex = square ? 22 : 26;
  const botPad = square ? 76 : 104;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; }
  .card { position:relative; width:${width}px; height:${height}px; overflow:hidden;
    font-family:'Inter',sans-serif; display:flex; flex-direction:column; }
  .band-top { position:relative; flex:0 0 ${topFlex}%; background:${PALETTE.cloud}; color:${PALETTE.navy};
    display:flex; flex-direction:column; justify-content:center; gap:22px; padding:0 104px; }
  .band-top .dots { position:absolute; inset:0;
    background-image: radial-gradient(${PALETTE.blue}1f 2px, transparent 2px);
    background-size: 44px 44px; opacity:.6; }
  .logo { position:relative; height:48px; align-self:flex-start; }
  .eyebrow { position:relative; font-family:'JetBrains Mono',monospace; color:${PALETTE.blue};
    font-size:30px; letter-spacing:3px; text-transform:uppercase; }
  .badge { position:relative; align-self:flex-start; font-family:'JetBrains Mono',monospace; font-size:28px;
    color:#FFFFFF; background:${PALETTE.blue}; padding:9px 22px; border-radius:999px; font-weight:500; }
  .band-bot { position:relative; flex:1; min-height:0; background:linear-gradient(160deg, ${PALETTE.navy} 0%, ${PALETTE.darker} 100%);
    color:${PALETTE.cloud}; display:flex; flex-direction:column; justify-content:space-between; padding:${botPad}px 104px; }
  .headline { font-weight:700; font-size:${headlineSize}px; line-height:0.99;
    color:#FFFFFF; letter-spacing:-2px; }
  .headline .accent { color:${PALETTE.sky}; font-weight:900; }
  .subtext { margin-top:28px; font-size:${subSize}px; line-height:1.3; color:${PALETTE.mist};
    max-width:92%; font-weight:400; }
  .bottom { display:flex; align-items:center; justify-content:space-between; }
  .cta { font-weight:800; font-size:36px;
    background:${PALETTE.blue}; color:#FFFFFF; padding:26px 48px; border-radius:999px; }
  .footer { font-family:'JetBrains Mono',monospace; font-size:26px; color:${PALETTE.mist}; opacity:.85; }
</style></head>
<body><div class="card">
  <div class="band-top"><div class="dots"></div>
    <img class="logo" src="${LOGO_DARK}" alt="4Selet"/>
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    ${badge ? `<span class="badge">${esc(badge)}</span>` : ""}
  </div>
  <div class="band-bot">
    <div class="headline">${headline || ""}</div>
    <div>
      ${subtext ? `<div class="subtext">${esc(subtext)}</div>` : ""}
    </div>
    <div class="bottom">
      ${cta ? `<span class="cta">${esc(cta)} →</span>` : "<span></span>"}
      ${dots || ""}<span class="footer">${esc(dots ? "" : (footer || DEFAULT_FOOTER))}</span>
    </div>
  </div>
</div></body></html>`;
}

// 4) Foto — imagem como HEROI (object-fit cover) + wash navy p/ coesao de marca
// + scrim inferior p/ legibilidade. Logo no topo, headline/subtexto/CTA na base.
// Espelha as capas humanizadas do feed @4selet (ver Referencia-Instagram): a arte
// deixa de ser so cor solida + texto e passa a combinar foto (pessoa/objeto/cena)
// com a copy por cima. Sem `image`, cai num fundo navy (nada quebra).
function tplPhoto({ width, height, eyebrow, headline, subtext, cta, badge, footer, image, dots, titleOffsetY, titleOffsetX, titleScale }) {
  const n = headlineLen(headline);
  const headlineSize = Math.round((n > 40 ? 84 : n > 26 ? 100 : n > 16 ? 124 : 156) * (Number(titleScale) || 1));
  const photo = image ? `<img class="photo" src="${escAttr(resolveImage(image))}" alt=""/>` : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; }
  .card {
    position:relative; width:${width}px; height:${height}px; overflow:hidden;
    background: linear-gradient(160deg, ${PALETTE.navy} 0%, ${PALETTE.darker} 100%);
    color:${PALETTE.cloud}; font-family:'Inter',sans-serif;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  .photo { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  /* wash de marca: da unidade navy a qualquer foto */
  .wash { position:absolute; inset:0;
    background: linear-gradient(160deg, ${PALETTE.navy}59 0%, ${PALETTE.darker}26 45%, ${PALETTE.darker}80 100%); }
  /* scrim inferior: garante leitura da copy sobre a foto */
  .scrim { position:absolute; inset:0;
    background: linear-gradient(0deg, ${PALETTE.darker}f2 0%, ${PALETTE.darker}d9 14%, ${PALETTE.darker}00 54%); }
  .top { position:relative; display:flex; align-items:center; justify-content:space-between; padding:80px 88px 0; }
  .logo { height:50px; filter:drop-shadow(0 2px 10px rgba(0,0,0,.45)); }
  .badge { font-family:'JetBrains Mono',monospace; font-size:28px; letter-spacing:1px;
    color:${PALETTE.darker}; background:${PALETTE.sky}; padding:9px 22px; border-radius:999px; font-weight:500; }
  .content { position:relative; padding:0 88px 84px; display:flex; flex-direction:column; }
  .eyebrow { font-family:'JetBrains Mono',monospace; color:${PALETTE.sky};
    font-size:30px; letter-spacing:3px; text-transform:uppercase; margin-bottom:24px;
    text-shadow:0 2px 12px rgba(0,0,0,.5); }
  .headline { font-weight:700; font-size:${headlineSize}px; line-height:1.0;
    color:#FFFFFF; letter-spacing:-2px; text-shadow:0 3px 22px rgba(0,0,0,.55); }
  .headline .accent { color:${PALETTE.sky}; font-weight:900; }
  .subtext { margin-top:26px; font-size:38px; line-height:1.3; color:${PALETTE.cloud};
    max-width:90%; font-weight:400; text-shadow:0 2px 14px rgba(0,0,0,.5); }
  .bottom { margin-top:40px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
  .cta { font-weight:800; font-size:34px;
    background:${PALETTE.blue}; color:#FFFFFF; padding:24px 46px; border-radius:999px; box-shadow:0 8px 30px rgba(0,0,0,.4); }
  .footer { font-family:'JetBrains Mono',monospace; font-size:24px; color:${PALETTE.mist}; text-shadow:0 2px 10px rgba(0,0,0,.5); }
</style></head>
<body><div class="card">
  ${photo}
  <div class="wash"></div>
  <div class="scrim"></div>
  <div class="top">
    <img class="logo" src="${LOGO_LIGHT}" alt="4Selet"/>
    ${badge ? `<span class="badge">${esc(badge)}</span>` : "<span></span>"}
  </div>
  <div class="content"${(titleOffsetX || titleOffsetY) ? ` style="transform:translate(${Number(titleOffsetX) || 0}px, ${Number(titleOffsetY) || 0}px)"` : ""}>
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    <div class="headline">${headline || ""}</div>
    ${subtext ? `<div class="subtext">${esc(subtext)}</div>` : ""}
    <div class="bottom">
      ${cta ? `<span class="cta">${esc(cta)} →</span>` : "<span></span>"}
      ${dots || ""}<span class="footer">${esc(dots ? "" : (footer || DEFAULT_FOOTER))}</span>
    </div>
  </div>
</div></body></html>`;
}

// ---- 4Selet na Mídia: mockup do print da matéria num DISPOSITIVO, na identidade da marca.
// Modelos: tablet | celular | notebook | janela. O print (imagem enviada) entra na "tela".
// Foco na postagem. Layout adapta: 4:5 empilhado (título topo, device centro) e 16:9 lado a lado.
const MED_BEZEL = "0 55px 130px rgba(0,0,0,.6), 0 0 0 2px rgba(84,153,181,.22)";
function mediaDevice(model, imgSrc, url) {
  const shot = imgSrc ? `<img src="${escAttr(imgSrc)}" alt=""/>` : `<div class="scr-empty">print da matéria</div>`;
  if (model === "celular" || model === "phone") {
    return `<div class="dev" style="width:406px;height:846px;background:#0a1015;border-radius:56px;padding:14px;box-shadow:${MED_BEZEL};position:relative;transform:rotate(.5deg)"><div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:116px;height:32px;background:#05090d;border-radius:18px;z-index:2"></div><div class="scr" style="width:100%;height:100%;border-radius:44px">${shot}</div></div>`;
  }
  if (model === "notebook") {
    return `<div class="dev" style="display:flex;flex-direction:column;align-items:center"><div style="width:812px;height:512px;background:#0a1015;border-radius:18px 18px 5px 5px;padding:16px 16px 15px;box-shadow:${MED_BEZEL};position:relative"><div style="position:absolute;top:7px;left:50%;transform:translateX(-50%);width:7px;height:7px;border-radius:50%;background:#243039"></div><div class="scr" style="width:100%;height:100%;border-radius:6px">${shot}</div></div><div style="width:928px;height:30px;background:linear-gradient(180deg,#cfd7dc,#9aa8b0);clip-path:polygon(2.5% 0,97.5% 0,100% 100%,0 100%);border-radius:0 0 12px 12px;box-shadow:0 24px 50px rgba(0,0,0,.45)"></div></div>`;
  }
  if (model === "janela" || model === "browser") {
    return `<div class="dev" style="width:812px;border-radius:16px;overflow:hidden;box-shadow:${MED_BEZEL};border:1px solid ${PALETTE.sky}59"><div style="height:52px;background:#e7ecef;display:flex;align-items:center;gap:10px;padding:0 20px"><span style="width:12px;height:12px;border-radius:50%;background:#c6ced4"></span><span style="width:12px;height:12px;border-radius:50%;background:#c6ced4"></span><span style="width:12px;height:12px;border-radius:50%;background:#c6ced4"></span>${url ? `<span style="margin-left:14px;background:#f2f5f7;color:#6c7c84;font-family:'JetBrains Mono',monospace;font-size:20px;padding:7px 20px;border-radius:999px">${esc(url)}</span>` : ""}</div><div class="scr" style="height:620px">${shot}</div></div>`;
  }
  return `<div class="dev" style="perspective:2600px"><div style="width:566px;height:820px;background:#0a1015;border-radius:40px;padding:18px;box-shadow:${MED_BEZEL};transform:rotateX(4deg) rotateY(-6deg) rotate(1deg);position:relative"><div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:7px;height:7px;border-radius:50%;background:#243039"></div><div class="scr" style="width:100%;height:100%;border-radius:24px">${shot}</div></div></div>`;
}
function tplMedia({ width, height, image, url, eyebrow, headline, model }) {
  const land = width > height;
  const dev = mediaDevice(model || "tablet", resolveImage(image), url);
  const veic = eyebrow ? `<div class="veic">${esc(eyebrow)}</div>` : "";
  const title = `<div class="ttl">4Selet <span class="a">na mídia</span></div>`;
  const logo = `<img class="logo" src="${LOGO_LIGHT}" alt="4Selet"/>`;
  const common = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${width}px;height:${height}px}
    .card{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(130% 130% at 82% 6%, ${PALETTE.blue} 0%, ${PALETTE.navy} 44%, ${PALETTE.darker} 100%);color:${PALETTE.cloud};font-family:'Inter',sans-serif}
    .dots{position:absolute;inset:0;background-image:radial-gradient(${PALETTE.sky}1f 2px,transparent 2px);background-size:48px 48px;opacity:.5}
    .ttl{font-size:${land ? 56 : 62}px;font-weight:800;letter-spacing:-1px}.ttl .a{color:${PALETTE.sky}}
    .veic{font-family:'JetBrains Mono',monospace;color:${PALETTE.mist};font-size:${land ? 22 : 23}px;letter-spacing:3px;text-transform:uppercase;margin-top:8px}
    .logo{height:44px;opacity:.95}
    .scr{background:#fff;overflow:hidden}.scr img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
    .scr-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9fb0b8;font-size:30px;background:repeating-linear-gradient(45deg,#eef2f4,#eef2f4 20px,#e6ebee 20px,#e6ebee 40px)}`;
  const body = land
    ? `<div class="dots"></div><div style="position:relative;height:100%;display:flex;align-items:center;gap:80px;padding:80px 92px">
        <div style="flex:0 0 auto;display:flex;justify-content:center;flex:1">${dev}</div>
        <div style="flex:1;display:flex;flex-direction:column;gap:22px">${title}${veic}${logo}</div></div>`
    : `<div class="dots"></div><div style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:74px 60px 58px">
        ${title}${veic}<div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%">${dev}</div><div style="margin-top:8px">${logo}</div></div>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}<style>${common}</style></head><body><div class="card">${body}</div></body></html>`;
}

const TEMPLATES = { editorial: tplEditorial, bold: tplBold, split: tplSplit, photo: tplPhoto };
const TEMPLATE_IDS = Object.keys(TEMPLATES);
function resolveTemplate(id) { return TEMPLATES[id] || tplEditorial; }

// Persistencia leve da escolha de template por task (render.json na raiz).
// Permite que "Re-renderizar" e a reabertura mantenham o layout escolhido.
function readRenderPref(loc) {
  const j = readJson(path.join(loc.path, "render.json"));
  return (j && typeof j.template === "string" && TEMPLATES[j.template]) ? j.template : null;
}
function writeRenderPref(loc, template) {
  if (!TEMPLATES[template]) return;
  try { fs.writeFileSync(path.join(loc.path, "render.json"), JSON.stringify({ template }, null, 2) + "\n", "utf8"); } catch (e) {}
}
// Decide o template efetivo: opcao da request > preferencia salva > editorial.
function pickTemplate(loc, requested) {
  const id = (requested && TEMPLATES[requested]) ? requested
    : (readRenderPref(loc) || "editorial");
  if (requested && TEMPLATES[requested]) writeRenderPref(loc, requested);
  return { id, build: resolveTemplate(id) };
}

// Destaca numeros/percentuais no headline (ex.: "0%", "R$ 1,99", "D+10") e permite
// realce MANUAL de palavra com o marcador ==palavra== (azul + sublinhado da marca).
// Ordem importa: numeros primeiro (o marcador nao tem digito), depois o marcador —
// assim os digitos do proprio estilo inline (0.07em) nunca sao confundidos com valor.
function highlightHeadline(text) {
  const HL = "color:" + PALETTE.sky + ";font-weight:800;text-decoration:underline;"
    + "text-decoration-color:" + PALETTE.sky + ";text-decoration-thickness:0.07em;text-underline-offset:0.14em;";
  return esc(text)
    .replace(/(?<![A-Za-zÀ-ÿ])(\d+[%.,]?\d*\s*%?|R\$\s?\d[\d.,]*|D\+\d+)(?![A-Za-zÀ-ÿ])/g, '<span class="accent">$1</span>')
    .replace(/==(.+?)==/g, '<span style="' + HL + '">$1</span>');
}

// Barra de navegacao do carrossel: bolinhas (dots), a atual vira uma pilula.
// Estilo inline (autossuficiente) p/ funcionar tanto nos arquetipos (carDoc)
// quanto na capa (templates de arte). Posicionada absoluta no rodape-centro.
function dotsBar(n, total, theme) {
  if (!total || total < 2) return "";
  const on = (theme && theme.dotOn) || PALETTE.sky;
  const dim = (theme && theme.dot) || (PALETTE.mist + "4d");
  let d = "";
  for (let i = 1; i <= total; i++) {
    d += '<span style="display:inline-block;height:13px;border-radius:999px;width:'
      + (i === n ? "38px" : "13px") + ";background:" + (i === n ? on : dim) + ';"></span>';
  }
  return '<div style="position:absolute;left:0;right:0;bottom:54px;display:flex;gap:13px;'
    + 'align-items:center;justify-content:center;z-index:6;">' + d + "</div>";
}

// Temas do carrossel: ESCURO (padrao, sobrio) x CLARO (editorial, mais suave —
// espelha a referencia do usuario: fundo Cloud + tipografia display + marca d'agua).
// Trazer um slide claro no meio de slides escuros da RITMO e tira a cara de "IA dura".
const THEME_DARK = {
  bg: `linear-gradient(160deg, ${PALETTE.navy} 0%, ${PALETTE.darker} 100%)`,
  text: "#FFFFFF", eyebrow: PALETTE.sky, dotTex: PALETTE.sky + "1f",
  dot: PALETTE.mist + "4d", dotOn: PALETTE.sky, logo: LOGO_LIGHT,
  wm: PALETTE.sky, wmOp: 0.05,
};
const THEME_LIGHT = {
  bg: `linear-gradient(155deg, #E9ECE6 0%, ${PALETTE.cloud} 55%, #CBD2CC 100%)`,
  text: PALETTE.darker, eyebrow: PALETTE.blue, dotTex: PALETTE.navy + "12",
  dot: PALETTE.navy + "33", dotOn: PALETTE.blue, logo: LOGO_DARK,
  wm: PALETTE.mist, wmOp: 0.6,
};
function resolveTheme(v) { return String(v || "").toLowerCase() === "light" ? THEME_LIGHT : THEME_DARK; }

// Marca d'agua tipografica: palavra display gigante transbordando a direita, ATRAS
// do conteudo. Profundidade editorial que tira o "achatado/duro" das artes.
// Estilos: "word" (palavra display, padrao), "outline" (palavra vazada/contorno),
// "symbol" (o simbolo "4" da 4Selet), "none". Aceita string (=palavra) OU { text, style }.
function watermark(spec, theme) {
  const t = theme || THEME_DARK;
  const s = (spec && typeof spec === "object") ? spec : { text: spec, style: "word" };
  const style = String(s.style || "word").toLowerCase();
  if (style === "none" || style === "off") return "";
  const op = Number(t.wmOp) || 0.05;
  if (style === "symbol") {
    return '<img src="' + SIMBOLO + '" alt="" style="position:absolute;top:50%;right:-8%;transform:translateY(-50%);'
      + "width:60%;height:auto;z-index:0;pointer-events:none;opacity:" + Math.min(op + 0.06, 0.7) + ';" />';
  }
  const text = esc(s.text != null && String(s.text) !== "" ? String(s.text) : "SELET");
  const base = "position:absolute;top:50%;right:-4%;transform:translateY(-50%);z-index:0;"
    + "font-family:'Inter',sans-serif;font-weight:800;font-size:440px;line-height:0.78;letter-spacing:-14px;white-space:nowrap;pointer-events:none;";
  if (style === "outline") {
    return '<div style="' + base + "opacity:" + Math.min(op + 0.14, 0.85) + ";color:transparent;-webkit-text-stroke:2px " + t.wm + ';">' + text + "</div>";
  }
  return '<div style="' + base + "color:" + t.wm + ";opacity:" + op + ';">' + text + "</div>";
}

// ---- Arquetipos de SLIDE do carrossel -------------------------------------
// Diferente dos 3 templates de arte estatica: o carrossel compoe LAYOUTS
// distintos por slide (capa, grade de numeros, lista, texto, CTA), espelhando o
// design system real do feed @4selet (ver Referencia-Instagram), em vez de
// repetir um unico template. A CAPA usa o template de arte escolhido
// (editorial|bold|split); os demais slides usam estes arquetipos navy.
function carBase(width, height, theme) {
  const t = theme || THEME_DARK;
  return `* { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; }
  .card { position:relative; width:${width}px; height:${height}px; overflow:hidden;
    font-family:'Inter',sans-serif; color:${t.text};
    background:${t.bg};
    display:flex; flex-direction:column; padding:90px 86px; }
  .dots { position:absolute; inset:0; background-image:radial-gradient(${t.dotTex} 2px, transparent 2px); background-size:46px 46px; opacity:.5; }
  .top { position:relative; z-index:2; display:flex; align-items:center; justify-content:space-between; }
  .logo { height:46px; }
  .pageno { font-family:'JetBrains Mono',monospace; font-size:26px; color:${PALETTE.mist}; opacity:.8; }
  .eyebrow { font-family:'JetBrains Mono',monospace; color:${t.eyebrow}; font-size:30px; letter-spacing:3px; text-transform:uppercase; margin-bottom:26px; }
  .mid { position:relative; z-index:2; flex:1; display:flex; flex-direction:column; justify-content:center; }
  .s-title { font-weight:700; font-size:84px; line-height:1.02; color:${t.text}; letter-spacing:-1.5px; }
  .s-title .accent { color:${t.eyebrow}; font-weight:900; }
  .footer { position:relative; font-family:'JetBrains Mono',monospace; font-size:26px; color:${PALETTE.mist}; opacity:.85; }`;
}
function carDoc(ctx, extraCss, bodyInner) {
  // Continuidade visual entre slides: desloca os Selet Dots como se os slides
  // formassem uma FAIXA UNICA — ao deslizar o carrossel, o padrao "encadeia" de
  // um slide para o outro (espelha as primeiras postagens reais do feed @4selet).
  // A logo no topo-esquerda em todos os slides reforça o encadeamento.
  const TILE = 46;
  const offX = -((((ctx.n || 1) - 1) * (ctx.width || 1080)) % TILE);
  const wm = ctx.watermark ? watermark(ctx.watermark, ctx.theme) : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}
<style>${carBase(ctx.width, ctx.height, ctx.theme)}${extraCss || ""}</style></head>
<body><div class="card"><div class="dots" style="background-position:${offX}px 0;"></div>${wm}${bodyInner}${dotsBar(ctx.n, ctx.total, ctx.theme)}</div></body></html>`;
}
function carTop(ctx) {
  const logo = (ctx.theme && ctx.theme.logo) || LOGO_LIGHT;
  return `<div class="top"><img class="logo" src="${logo}" alt="4Selet"/></div>`;
}
// Rodape textual aposentado: a navegacao do carrossel agora e visual (dotsBar em carDoc).
function carFooter() { return ""; }

// Texto (desenvolvimento): titulo forte + paragrafo de apoio.
function slideText(slide, ctx) {
  const light = String(slide.theme || "").toLowerCase() === "light";
  ctx.theme = resolveTheme(slide.theme);
  // Marca d'agua editorial no slide de frase (default "SELET"; "" desliga).
  ctx.watermark = slide.watermark != null ? slide.watermark : "SELET";
  const bodyColor = light ? PALETTE.navy : PALETTE.mist;
  // No tema claro, o realce ==palavra== vai a Selet Blue (melhor contraste no Cloud).
  const accentFix = light
    ? `.s-title span { color:${PALETTE.blue} !important; text-decoration-color:${PALETTE.blue} !important; }`
    : "";
  const css = `.s-body { margin-top:34px; font-size:42px; line-height:1.42; color:${bodyColor}; max-width:92%; }
    ${accentFix}`;
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    <div class="s-title">${highlightHeadline(slide.title || "")}</div>
    ${slide.body ? `<div class="s-body">${esc(slide.body)}</div>` : ""}
  </div>`;
  return carDoc(ctx, css, inner);
}
// Grade de numeros (2x2): ate 4 cartoes valor + rotulo.
function slideStatGrid(slide, ctx) {
  const stats = (Array.isArray(slide.stats) ? slide.stats : []).slice(0, 4);
  const cells = stats.map((s) => `<div class="stat"><div class="stat-v">${highlightHeadline(String(s.value == null ? "" : s.value))}</div><div class="stat-l">${esc(s.label || "")}</div></div>`).join("");
  const css = `.s-title.sm { font-size:60px; margin-bottom:46px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:28px; }
    .stat { background:${PALETTE.navy}; border:2px solid ${PALETTE.blue}55; border-radius:28px; padding:44px 40px; }
    .stat-v { font-weight:900; font-size:94px; line-height:1; color:#FFFFFF; letter-spacing:-2px; }
    .stat-v .accent { color:${PALETTE.sky}; }
    .stat-l { margin-top:16px; font-size:33px; line-height:1.24; color:${PALETTE.mist}; }`;
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.title ? `<div class="s-title sm">${highlightHeadline(slide.title)}</div>` : ""}
    <div class="grid">${cells}</div>
  </div>
  ${carFooter(ctx)}`;
  return carDoc(ctx, css, inner);
}
// Lista com marcadores: titulo + itens com marcador Selet Blue.
function slideList(slide, ctx) {
  const items = (Array.isArray(slide.items) ? slide.items : []).slice(0, 6)
    .map((it) => (typeof it === "string" ? it : (it && it.text) || ""));
  const lis = items.map((t) => `<div class="li"><span class="mk">&#9656;</span><span class="lt">${esc(t)}</span></div>`).join("");
  const css = `.s-title.sm { font-size:64px; margin-bottom:42px; }
    .list { display:flex; flex-direction:column; gap:28px; }
    .li { display:flex; align-items:flex-start; gap:24px; }
    .mk { color:${PALETTE.sky}; font-size:44px; line-height:1.1; font-weight:900; flex:0 0 auto; }
    .lt { font-size:44px; line-height:1.28; color:${PALETTE.cloud}; font-weight:600; }
    .s-body { margin-top:40px; font-size:36px; line-height:1.3; color:${PALETTE.mist}; }`;
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.title ? `<div class="s-title sm">${highlightHeadline(slide.title)}</div>` : ""}
    <div class="list">${lis}</div>
    ${slide.body ? `<div class="s-body">${esc(slide.body)}</div>` : ""}
  </div>
  ${carFooter(ctx)}`;
  return carDoc(ctx, css, inner);
}
// CTA de fechamento: centralizado, logo + headline + pilula de CTA.
function slideCta(slide, ctx) {
  const headline = slide.title || ctx.cta || "Para quem sabe que é Selet";
  const hl = highlightHeadline(headline);
  const n = headlineLen(hl);

  // Variante CLARA (editorial, alinhada a esquerda) — igual a referencia do usuario:
  // fundo Cloud, logo dark no topo-esquerda, headline display BOLD + enfase em Blue,
  // corpo (ex.: "Venha para a 4Selet...") no mesmo tratamento + marca d'agua "SELET".
  if (String(slide.theme || "").toLowerCase() === "light") {
    ctx.theme = THEME_LIGHT;
    ctx.watermark = slide.watermark != null ? slide.watermark : "SELET";
    // Corpo no MESMO formato do headline (tamanho/peso/cor) — igual a referencia:
    // texto uniforme, so o trecho de enfase muda de COR. Tamanho pelo total p/ caber.
    const total = n + (slide.body ? String(slide.body).length : 0);
    const sz = total > 120 ? 54 : total > 92 ? 62 : total > 60 ? 72 : 84;
    const cssL = `.s-title.big { font-size:${sz}px; font-weight:700; line-height:1.07; }
      .s-title.big span, .cta-body span { color:${PALETTE.blue} !important; font-weight:700 !important; text-decoration:none !important; }
      .cta-body { margin-top:26px; font-size:${sz}px; font-weight:700; line-height:1.07; color:${PALETTE.darker}; max-width:94%; }
      .cta-pill { align-self:flex-start; margin-top:48px; font-weight:800; font-size:36px; background:${PALETTE.blue}; color:#FFFFFF; padding:26px 54px; border-radius:999px; }`;
    const innerL = `${carTop(ctx)}
    <div class="mid">
      <div class="s-title big">${hl}</div>
      ${slide.body ? `<div class="cta-body">${highlightHeadline(slide.body)}</div>` : ""}
      ${ctx.cta ? `<span class="cta-pill">${esc(ctx.cta)} &#8594;</span>` : ""}
    </div>`;
    return carDoc(ctx, cssL, innerL);
  }

  // Tamanho adaptativo p/ caber titulos-pergunta mais longos no fecho.
  const size = n > 66 ? 58 : n > 46 ? 68 : n > 30 ? 80 : 92;
  const css = `.mid.center { align-items:center; text-align:center; }
    .logo-c { height:62px; margin-bottom:40px; }
    /* Fecho em BOLD (700), sem extra-bold: enfase por COR, mesmo peso, sem sublinhado (ref. do usuario). */
    .s-title.big { font-size:${size}px; font-weight:700; }
    .s-title.big span { font-weight:700 !important; text-decoration:none !important; }
    .s-body { margin-top:28px; font-size:40px; line-height:1.32; color:${PALETTE.mist}; max-width:86%; }
    .cta { margin-top:52px; font-weight:800; font-size:40px; background:${PALETTE.blue}; color:#FFFFFF; padding:30px 60px; border-radius:999px; }`;
  const inner = `<div class="top"><span></span></div>
  <div class="mid center">
    <img class="logo-c" src="${LOGO_LIGHT}" alt="4Selet"/>
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    <div class="s-title big">${hl}</div>
    ${slide.body ? `<div class="s-body">${esc(slide.body)}</div>` : ""}
    ${ctx.cta ? `<span class="cta">${esc(ctx.cta)} &#8594;</span>` : ""}
  </div>
  ${carFooter(ctx)}`;
  return carDoc(ctx, css, inner);
}
// Icones de tom (SVG inline, stroke=currentColor -> a cor vem do CSS do no).
// Feather-style; sem emoji (regra de marca: glyph/SVG na arte).
const ICON_ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const ICON_SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';

// Conjunto de icones nomeados p/ os nos do fluxo (feather-style, stroke=currentColor).
const FLOW_ICONS = {
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M4 10h16"/><path d="M5 6l7-3 7 3"/><path d="M5 10v11"/><path d="M9 10v11"/><path d="M15 10v11"/><path d="M19 10v11"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  shield: ICON_SHIELD,
  alert: ICON_ALERT,
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};
function flowIcon(name) { return FLOW_ICONS[String(name || "").toLowerCase()] || ""; }

// Fluxo (diagrama): sequencia de nos ligados por seta. Serve p/ "antes x depois".
// tone: "muted" (cinza, alerta) x "accent" (azul, escudo). orient: "row" (icones em
// linha + setas + rotulo abaixo, espelha a referencia) x padrao vertical (cartoes).
// Cada no: { label, sub?, icon?, mark? }. slide.note -> caixa de callout ao pe.
function slideFlow(slide, ctx) {
  const nodes = (Array.isArray(slide.flow) ? slide.flow : []).slice(0, 4);
  const accent = String(slide.tone || "").toLowerCase() === "accent";
  const line = accent ? PALETTE.blue : PALETTE.mist;
  const emph = accent ? PALETTE.sky : PALETTE.mist;
  const toneIcon = accent ? ICON_SHIELD : ICON_ALERT;
  const head = (slide.eyebrow ? '<div class="eyebrow">' + esc(slide.eyebrow) + "</div>" : "")
    + (slide.title ? '<div class="s-title sm">' + highlightHeadline(slide.title) + "</div>" : "");
  const note = slide.note
    ? '<div class="fnote"><span class="fnote-ic">' + toneIcon + "</span><span>" + esc(slide.note) + "</span></div>"
    : "";

  if (String(slide.orient || "").toLowerCase() === "row") {
    const cells = nodes.map((nd, i) => {
      const label = typeof nd === "string" ? nd : (nd && nd.label) || "";
      const sub = (nd && nd.sub) || "";
      const hi = !!(nd && nd.mark);
      const ic = flowIcon((nd && nd.icon) || "");
      return (i > 0 ? '<div class="fr-arrow">&#8594;</div>' : "")
        + '<div class="fr-cell"><div class="fr-ic' + (hi ? " hi" : "") + '">' + ic + "</div>"
        + '<div class="fr-l">' + esc(label) + "</div>"
        + (sub ? '<div class="fr-s">' + esc(sub) + "</div>" : "") + "</div>";
    }).join("");
    const css = ".s-title.sm { font-size:56px; margin-bottom:64px; line-height:1.05; }"
      + ".frow { display:flex; align-items:flex-start; justify-content:center; gap:6px; }"
      + ".fr-cell { flex:1 1 0; display:flex; flex-direction:column; align-items:center; text-align:center; gap:18px; max-width:240px; }"
      + ".fr-ic { width:128px; height:128px; border-radius:38px; display:flex; align-items:center; justify-content:center; background:" + PALETTE.navy + "; border:1px solid " + PALETTE.blue + "33; box-shadow:0 14px 38px " + PALETTE.darker + "59; color:" + PALETTE.cloud + "; }"
      + ".fr-ic.hi { border-color:" + (accent ? PALETTE.blue : PALETTE.mist) + "; background:" + (accent ? PALETTE.blue + "26" : PALETTE.navy) + "; color:" + emph + "; }"
      + ".fr-ic svg { width:64px; height:64px; }"
      + ".fr-l { font-size:28px; font-weight:800; color:#FFFFFF; line-height:1.15; text-transform:uppercase; letter-spacing:0.4px; }"
      + ".fr-s { font-size:25px; color:" + PALETTE.mist + "; line-height:1.22; }"
      + ".fr-arrow { align-self:flex-start; margin-top:44px; font-size:54px; line-height:1; color:" + line + "; font-weight:700; flex:0 0 auto; }"
      + ".fnote { margin-top:66px; display:flex; gap:22px; align-items:center; background:" + PALETTE.navy + "; border:2px solid " + (accent ? PALETTE.blue : PALETTE.mist) + "40; border-left-width:8px; border-radius:20px; padding:32px 36px; }"
      + ".fnote-ic { flex:0 0 auto; width:50px; height:50px; color:" + emph + "; display:flex; align-items:center; justify-content:center; }"
      + ".fnote-ic svg { width:50px; height:50px; }"
      + ".fnote span:last-child { font-size:33px; line-height:1.3; color:" + PALETTE.cloud + "; }";
    const inner = carTop(ctx) + '<div class="mid">' + head
      + '<div class="frow">' + cells + "</div>" + note + "</div>" + carFooter(ctx);
    return carDoc(ctx, css, inner);
  }

  // Vertical (padrao): cartoes empilhados ligados por seta descendente.
  const nodeHtml = nodes.map((nd, i) => {
    const label = typeof nd === "string" ? nd : (nd && nd.label) || "";
    const sub = (nd && nd.sub) || "";
    const hi = !!(nd && nd.mark);
    const ic = flowIcon((nd && nd.icon) || "") || (hi ? toneIcon : "");
    return (i > 0 ? '<div class="arrow">&#8595;</div>' : "")
      + '<div class="node' + (hi ? " node-hi" : "") + '">'
      + (ic ? '<span class="node-ic">' + ic + "</span>" : "")
      + '<div class="node-tx"><div class="node-l">' + esc(label) + "</div>"
      + (sub ? '<div class="node-s">' + esc(sub) + "</div>" : "") + "</div></div>";
  }).join("");
  const css = ".s-title.sm { font-size:58px; margin-bottom:40px; line-height:1.04; }"
    + ".flow { display:flex; flex-direction:column; align-items:stretch; gap:16px; }"
    + ".arrow { text-align:center; font-size:50px; line-height:0.6; color:" + line + "; font-weight:700; }"
    + ".node { display:flex; align-items:center; gap:26px; background:" + PALETTE.navy + "; border:2px solid " + PALETTE.blue + "40; border-radius:26px; padding:34px 40px; }"
    + ".node-hi { background:" + (accent ? PALETTE.blue + "26" : PALETTE.navy) + "; border-color:" + (accent ? PALETTE.blue : PALETTE.mist) + "; }"
    + ".node-ic { flex:0 0 auto; width:62px; height:62px; color:" + emph + "; display:flex; align-items:center; justify-content:center; }"
    + ".node-ic svg { width:62px; height:62px; }"
    + ".node-l { font-size:42px; font-weight:700; color:#FFFFFF; line-height:1.12; }"
    + ".node-s { margin-top:8px; font-size:30px; color:" + PALETTE.mist + "; line-height:1.24; }"
    + ".flow-note { margin-top:38px; font-size:34px; line-height:1.32; color:" + PALETTE.mist + "; }";
  const inner = carTop(ctx) + '<div class="mid">' + head
    + '<div class="flow">' + nodeHtml + "</div>"
    + (slide.body ? '<div class="flow-note">' + esc(slide.body) + "</div>" : "")
    + note + "</div>" + carFooter(ctx);
  return carDoc(ctx, css, inner);
}
const SLIDE_ARCHETYPES = { stat_grid: slideStatGrid, list: slideList, text: slideText, cta: slideCta, flow: slideFlow };

// Decide o arquetipo de um slide: override explicito (layout/type) > inferencia
// por posicao (1o=capa, ultimo=cta) e por conteudo (flow=>fluxo, stats=>grade, items=>lista).
function slideArchetype(slide, i, total) {
  const ex = String((slide && (slide.layout || slide.type)) || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (ex === "stats" || ex === "grid" || ex === "stat_grid" || ex === "number_grid") return "stat_grid";
  if (ex === "list" || ex === "lista" || ex === "bullets") return "list";
  if (ex === "flow" || ex === "fluxo" || ex === "diagram" || ex === "diagrama") return "flow";
  if (ex === "cover" || ex === "capa" || ex === "hook") return "cover";
  if (ex === "cta") return "cta";
  if (ex === "text" || ex === "texto") return "text";
  if (i === 0) return "cover";
  if (i === total - 1 && total > 1) return "cta";
  if (Array.isArray(slide && slide.flow) && slide.flow.length) return "flow";
  if (Array.isArray(slide && slide.stats) && slide.stats.length) return "stat_grid";
  if (Array.isArray(slide && slide.items) && slide.items.length) return "list";
  return "text";
}

// ---- Renders por tipo -----------------------------------------------------
async function renderImage(folder, opts) {
  const loc = requireActive(folder);
  const tpl = pickTemplate(loc, opts && opts.template);
  const concept = readJson(path.join(loc.path, "ads", "concept.json")) || {};
  const htmlPath = path.join(loc.path, "ads", "ad.html");
  const outPng = path.join(loc.path, "ads", "ad.png");
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  const html = tpl.build({
    width: 1080, height: 1080,
    eyebrow: concept.eyebrow || "",
    headline: highlightHeadline(concept.headline || "Para quem sabe que é Selet."),
    subtext: concept.subtext || "",
    cta: concept.cta || "",
    badge: concept.badge || "",
    image: concept.image || (opts && opts.image) || "",
  });
  fs.writeFileSync(htmlPath, html, "utf8");
  const r = await htmlToPng(htmlPath, outPng, 1080, 1080, RENDER_SCALE);
  return Object.assign(r, { rel: "ads/ad.png", template: tpl.id });
}

async function renderFeed(folder, opts) {
  const loc = requireActive(folder);
  const tpl = pickTemplate(loc, opts && opts.template);
  // Le a caption salva (txt) e usa a 1a linha forte como headline.
  let caption = "";
  try { caption = fs.readFileSync(path.join(loc.path, "copy", "instagram_caption.txt"), "utf8"); } catch (e) {}
  const firstLine = caption.split("\n").map((s) => s.trim()).filter(Boolean)[0] || "Para quem sabe que é Selet.";
  const headline = firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;
  const htmlPath = path.join(loc.path, "ads", "feed.html");
  const outPng = path.join(loc.path, "ads", "feed.png");
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  const html = tpl.build({
    width: 1080, height: 1350,
    eyebrow: "",
    headline: highlightHeadline(headline),
    subtext: "",
    cta: "",
    badge: "",
    image: (opts && opts.image) || "",
  });
  fs.writeFileSync(htmlPath, html, "utf8");
  const r = await htmlToPng(htmlPath, outPng, 1080, 1350, RENDER_SCALE);
  return Object.assign(r, { rel: "ads/feed.png", template: tpl.id });
}

// Monta o HTML de TODOS os slides do carrossel a partir do conceito (capa via template
// escolhido, demais via arquetipos). PURA (sem I/O) — usada pelo renderCarousel (grava PNG)
// e pelo renderPreview (mostra todos os slides sem salvar), garantindo que a previa bate com
// o render final. buildCover = funcao de template da capa (tpl.build, ex.: tplEditorial).
function carouselSlidesHtml(concept, buildCover) {
  const slides = Array.isArray(concept.slides) && concept.slides.length
    ? concept.slides
    : [{ title: "Para quem sabe que é Selet", body: "" }];
  const total = slides.length;
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const n = i + 1;
    const arch = slideArchetype(s, i, total);
    let html;
    if (arch === "cover") {
      // A capa usa o template de arte escolhido (editorial|bold|split|photo).
      html = buildCover({
        width: 1080, height: 1350,
        eyebrow: concept.eyebrow || "",
        headline: highlightHeadline(s.title || ""),
        subtext: s.body || "",
        cta: "",
        badge: "",
        image: (s && s.image) || concept.image || "",
        dots: dotsBar(n, total),
        titleOffsetY: s && s.titleOffsetY, // ajuste fino de posicao do titulo (camadas)
        titleOffsetX: s && s.titleOffsetX,
        titleScale: s && s.titleScale,
      });
    } else {
      html = SLIDE_ARCHETYPES[arch](s, {
        width: 1080, height: 1350, n: n, total: total,
        cta: arch === "cta" ? (concept.cta || "") : "",
        footer: concept.footer,
        tagline: arch === "cta",
      });
    }
    out.push({ n: n, html: html });
  }
  return out;
}

async function renderCarousel(folder, opts) {
  const loc = requireActive(folder);
  const tpl = pickTemplate(loc, opts && opts.template);
  const concept = readJson(path.join(loc.path, "copy", "instagram_carousel.json")) || {};
  const dir = path.join(loc.path, "slides");
  fs.mkdirSync(dir, { recursive: true });
  const built = carouselSlidesHtml(concept, tpl.build);
  const total = built.length;
  const rels = [];
  let lastErr = null;
  // Sequencial (await em fila): renderiza um slide por vez, sem abrir N Chromium
  // ao mesmo tempo. Nao bloqueia o event loop (cada htmlToPng e assincrono).
  for (const item of built) {
    const htmlPath = path.join(dir, "slide_" + item.n + ".html");
    const outPng = path.join(dir, "slide_" + item.n + ".png");
    fs.writeFileSync(htmlPath, item.html, "utf8");
    const r = await htmlToPng(htmlPath, outPng, 1080, 1350, RENDER_SCALE);
    if (!r.ok) lastErr = r.stderr || r.stdout;
    else rels.push("slides/slide_" + item.n + ".png");
  }
  return { ok: rels.length === total, rels, stderr: lastErr || "", count: rels.length, total: total, template: tpl.id };
}

// ---- Video (Remotion parametrizado) ---------------------------------------
async function renderVideo(folder) {
  const loc = requireActive(folder);
  const concept = readJson(path.join(loc.path, "video", "concept.json")) || {};
  const scenes = Array.isArray(concept.scenes) && concept.scenes.length ? concept.scenes : [
    { type: "hook", text: concept.hook || "Para quem sabe que é Selet.", visual: "" },
  ];
  // Props para a composition BrandStory (src/BrandStory.tsx).
  // IMPORTANTE: o campo `visual` do conceito e DIRECAO DE ARTE (ex.: "Fundo Selet
  // Darker. Inter Black 88pt...") — NAO aparece na tela. A copy on-screen de cada
  // cena e: headline = `text`; segunda linha (subtexto) = `subtitle` (voltada ao
  // espectador). A composition exibe o prop `visual` como subtexto, entao passamos
  // o `subtitle` ali — nunca a direcao de arte.
  const props = {
    concept: concept.concept || "",
    cta: concept.cta || "Conhecer a plataforma",
    scenes: scenes.map((s) => ({ type: s.type || "benefit", text: s.text || "", visual: s.subtitle || "" })),
  };
  const videoDir = path.join(loc.path, "video");
  fs.mkdirSync(videoDir, { recursive: true });
  const propsPath = path.join(videoDir, "scenes.json");
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2) + "\n", "utf8");
  const outMp4 = path.join(videoDir, "video.mp4");

  // Render chamando o CLI do Remotion via `node` direto (NAO `npx.cmd`).
  // Node 24 (pos-CVE-2024-27980) recusa spawnar arquivos .cmd/.bat sem shell:true,
  // entao `npx.cmd` retornava status null (code:-1) com stderr vazio. Resolvendo o
  // JS do CLI (@remotion/cli/remotion-cli.js) e rodando com process.execPath e
  // robusto e cross-platform.
  const cliJs = remotionCliPath();
  // 12min: o 1o render apos subir o servidor faz o bundle webpack a frio (cold-start);
  // 8min encostava no limite. Render quente leva ~2min. spawnAsync mata no timeout.
  const r = await spawnAsync(
    [cliJs, "render", "src/index.ts", "BrandStory", outMp4, "--props=" + propsPath, "--log=error"],
    { timeout: 1000 * 60 * 12 }
  );
  const spawnErr = r.error || "";
  const timedOut = r.timedOut;
  return {
    code: r.code,
    stdout: r.stdout,
    stderr: r.stderr || spawnErr ||
      (timedOut ? "render de video excedeu o tempo limite (cold-start). Tente novamente — o cache fica quente." : ""),
    ok: r.code === 0 && fs.existsSync(outMp4),
    rel: "video/video.mp4",
  };
}

// ---- Previa de arte (render efemero, sem salvar) --------------------------
// Renderiza a partir do conceito EM MEMORIA (parsed da geracao), sem exigir task
// nem zona active, e devolve um data URL PNG. Usado na tela de criacao para o
// usuario ver a arte antes de salvar. Espelha o mapeamento de campos dos renders
// por tipo (renderImage/renderFeed/renderCarousel).
function previewFields(ct, parsed) {
  parsed = parsed || {};
  if (ct.kind === "image") {
    return {
      width: 1080, height: 1080,
      eyebrow: parsed.eyebrow || "",
      headline: highlightHeadline(parsed.headline || "Para quem sabe que é Selet."),
      subtext: parsed.subtext || "",
      cta: parsed.cta || "",
      badge: parsed.badge || "",
      image: parsed.image || "",
    };
  }
  if (ct.kind === "feed") {
    const caption = String(parsed.body || parsed.caption || "");
    const firstLine = caption.split("\n").map((s) => s.trim()).filter(Boolean)[0] || "Para quem sabe que é Selet.";
    const headline = firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;
    return {
      width: 1080, height: 1350,
      eyebrow: "",
      headline: highlightHeadline(headline),
      subtext: "",
      cta: "",
      badge: "",
      image: parsed.image || "",
    };
  }
  if (ct.kind === "carousel") {
    const slides = Array.isArray(parsed.slides) && parsed.slides.length
      ? parsed.slides : [{ title: "Para quem sabe que é Selet", body: "" }];
    const s = slides[0] || {};
    return {
      width: 1080, height: 1350,
      eyebrow: parsed.eyebrow || "",
      headline: highlightHeadline(s.title || ""),
      subtext: s.body || "",
      cta: "",
      badge: parsed.badge || "",
      image: parsed.image || "",
    };
  }
  return null;
}

// Renderiza um HTML (string) para dataURL PNG via arquivo temporario. Resolucao base (1x):
// e so visualizacao na tela. Sufixo aleatorio evita colisao entre previas concorrentes.
async function htmlStringToPngDataUrl(html, w, h) {
  const uniq = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const base = path.join(os.tmpdir(), "4selet-preview-" + process.pid + "-" + uniq);
  const htmlPath = base + ".html";
  const outPng = base + ".png";
  try {
    fs.writeFileSync(htmlPath, html, "utf8");
    const r = await htmlToPng(htmlPath, outPng, w, h);
    if (!r.ok || !fs.existsSync(outPng)) return { ok: false, error: (r.stderr || r.stdout || "falha ao renderizar a previa").slice(0, 400) };
    return { ok: true, dataUrl: "data:image/png;base64," + fs.readFileSync(outPng).toString("base64") };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { fs.unlinkSync(htmlPath); } catch (e) {}
    try { fs.unlinkSync(outPng); } catch (e) {}
  }
}

async function renderPreview({ content_type, parsed, template } = {}) {
  const ct = contentTypeById(content_type);
  if (!ct || ct.media !== "image") return { ok: false, error: "este tipo nao tem previa de arte" };
  const tplId = (template && TEMPLATES[template]) ? template : "editorial";
  // Carrossel: a previa mostra TODOS os slides (nao so a capa) — renderiza cada um in-memory,
  // com a MESMA montagem do render final (carouselSlidesHtml).
  if (ct.kind === "carousel") {
    const built = carouselSlidesHtml(parsed || {}, TEMPLATES[tplId]);
    const slidesOut = [];
    for (const item of built) {
      const png = await htmlStringToPngDataUrl(item.html, 1080, 1350);
      if (!png.ok) return { ok: false, error: png.error, template: tplId };
      slidesOut.push({ n: item.n, dataUrl: png.dataUrl });
    }
    return { ok: true, slides: slidesOut, template: tplId, kind: ct.kind, width: 1080, height: 1350 };
  }
  const fields = previewFields(ct, parsed);
  if (!fields) return { ok: false, error: "este tipo nao tem previa de arte" };
  const png = await htmlStringToPngDataUrl(resolveTemplate(tplId)(fields), fields.width, fields.height);
  if (!png.ok) return { ok: false, error: png.error, template: tplId };
  return { ok: true, dataUrl: png.dataUrl, template: tplId, kind: ct.kind, width: fields.width, height: fields.height };
}

// ---- Download em resolucao escolhida --------------------------------------
// Re-renderiza a peca a partir do HTML salvo (ads/ad.html, ads/feed.html,
// slides/slide_N.html) na escala pedida (1x..4x), para o usuario baixar o PNG na
// resolucao que quiser. Read-only: NAO exige zona active e NAO sobrescreve o PNG
// salvo (gera um arquivo temporario). Se a escala pedida resultar na MESMA
// resolucao do PNG ja salvo, devolve o proprio (sem re-render).
function _pngBaseDims(html) {
  const m = /html\s*,\s*body\s*\{[^}]*?width:\s*(\d+)px[^}]*?height:\s*(\d+)px/i.exec(String(html || ""));
  return m ? { w: parseInt(m[1], 10), h: parseInt(m[2], 10) } : null;
}
function _pngDims(file) {
  try {
    const fd = fs.openSync(file, "r"); const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd);
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch (e) {}
  return null;
}
async function renderForDownload(folder, rel, scale) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  rel = String(rel || "").replace(/^[\\/]+/, "");
  const root = path.resolve(loc.path);
  const absPng = path.resolve(root, rel);
  // Confina ao folder da task e exige PNG.
  if (!(absPng === root || absPng.startsWith(root + path.sep)) || !/\.png$/i.test(absPng)) {
    const e = new Error("arquivo invalido para download em resolucao"); e.code = "E_BAD_REL"; throw e;
  }
  const htmlPath = absPng.replace(/\.png$/i, ".html");
  if (!fs.existsSync(htmlPath)) { const e = new Error("origem (HTML) da peca nao encontrada para re-render"); e.code = "E_NO_SOURCE_HTML"; throw e; }
  const rawHtml = fs.readFileSync(htmlPath, "utf8");
  const base = _pngBaseDims(rawHtml);
  if (!base) { const e = new Error("nao foi possivel ler as dimensoes da peca"); e.code = "E_NO_SOURCE_HTML"; throw e; }
  const s = Math.max(1, Math.min(4, Math.round(Number(scale) || 1)));
  const reqW = base.w * s, reqH = base.h * s;
  // Ja salvo nessa exata resolucao? serve o proprio (rapido, sem re-render).
  const stored = _pngDims(absPng);
  if (stored && stored.w === reqW && stored.h === reqH) return { path: absPng, width: reqW, height: reqH, temp: false };
  const uniq = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const outPng = path.join(os.tmpdir(), "4selet-dl-" + process.pid + "-" + uniq + ".png");
  // Re-localiza assets p/ o ambiente atual (a peça pode ter file:// de outro ambiente) e renderiza
  // a partir de um HTML temporário — senão a foto/logo somem no download em resolução.
  const tmpHtml = path.join(os.tmpdir(), "4selet-dl-" + process.pid + "-" + uniq + ".html");
  fs.writeFileSync(tmpHtml, relocalizeAssets(rawHtml), "utf8");
  const r = await htmlToPng(tmpHtml, outPng, base.w, base.h, s);
  try { fs.unlinkSync(tmpHtml); } catch (e) {}
  if (!r.ok || !fs.existsSync(outPng)) { const e = new Error((r.stderr || "falha ao renderizar em resolucao").slice(0, 300)); e.code = "E_RENDER_FAIL"; throw e; }
  return { path: outPng, width: reqW, height: reqH, temp: true };
}

// Sanitiza HTML vindo do EDITOR (nao confiavel — qualquer usuario logado envia).
// Remove scripts, handlers on*, tags perigosas, javascript: e <link> externos que nao
// sejam de fontes. E a defesa PRIMARIA; a secundaria e o bloqueio de rede no render
// (RENDER_STRICT_NET), que impede SSRF/exfiltracao mesmo se algo escapar daqui.
function sanitizeArtHtml(html) {
  let s = String(html);
  s = s.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");   // <script>...</script>
  s = s.replace(/<script\b[^>]*>/gi, "");                     // <script ...> solto
  s = s.replace(/<\/?(iframe|object|embed|base|form|meta|noscript|template|applet)\b[^>]*>/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");           // onload="..."
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");           // onload='...'
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");           // onload=x
  s = s.replace(/(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
  // neutraliza src/href http(s) EXTERNOS (exceto fontes do Google) — defesa extra alem do bloqueio de rede
  s = s.replace(/(src|href|xlink:href)\s*=\s*(["'])\s*https?:\/\/(?!fonts\.(?:googleapis|gstatic)\.com\/)[^"']*\2/gi, "$1=$2$2");
  s = s.replace(/<link\b[^>]*>/gi, (m) => /fonts\.googleapis\.com/i.test(m) ? m : ""); // so <link> de fonte
  return s;
}

// Re-localiza os caminhos de asset (foto em /uploads/, logo em /assets|/brand-assets/) para o
// file:// do AMBIENTE ATUAL. A arte editada pode carregar file:// ABSOLUTO de OUTRO ambiente
// (peca feita no Windows local e editada em prod Linux) OU a URL servida (/uploads/, /brand-assets/).
// O render roda no container, entao caminho de outra maquina nao existe -> foto/logo somem. Aqui
// reescrevemos o prefixo ATE /<seg>/ (inclusive) pelo diretorio LOCAL correto, em src/href/xlink:href.
function relocalizeAssets(html) {
  const up = fileUrl(path.join(__dirname, "..", "public", "uploads")) + "/";
  const as = fileUrl(PATHS.ASSETS_DIR) + "/";
  const rw = (h, seg, abs) => h.replace(new RegExp('((?:src|href|xlink:href)\\s*=\\s*["\'])[^"\']*?/' + seg + '/', "gi"), "$1" + abs);
  let h = html;
  h = rw(h, "uploads", up);
  h = rw(h, "brand-assets", as); // servido como /brand-assets/ mapeia para o dir assets/
  h = rw(h, "assets", as);
  return h;
}

// Editor HTML (item A): grava o HTML EDITADO da peca no proprio .html da arte e
// re-renderiza o PNG via Playwright — pixel-perfect (a arte JA e HTML). So zona active.
// Seguranca: SANITIZA o HTML (nao confiavel), so EDITA arte que ja existe, renderiza com
// REDE BLOQUEADA (strictNet) e RESTAURA o HTML original se o render falhar.
async function renderEditedHtml(folder, rel, html) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone !== "active") { const e = new Error("edicao so na zona active (rode rework primeiro)"); e.code = "E_NOT_EDITABLE"; throw e; }
  rel = String(rel || "").replace(/^[\\/]+/, "");
  const root = path.resolve(loc.path);
  const absPng = path.resolve(root, rel);
  if (!(absPng === root || absPng.startsWith(root + path.sep)) || !/\.png$/i.test(absPng)) { const e = new Error("arquivo invalido"); e.code = "E_BAD_REL"; throw e; }
  const htmlPath = absPng.replace(/\.png$/i, ".html");
  // M5: so EDITA uma arte que JA existe — nao cria par .html/.png arbitrario.
  if (!fs.existsSync(htmlPath)) { const e = new Error("origem (HTML) da peca nao encontrada para editar"); e.code = "E_NO_SOURCE_HTML"; throw e; }
  const clean = relocalizeAssets(sanitizeArtHtml(String(html)));
  const base = _pngBaseDims(clean);
  if (!base) { const e = new Error("nao foi possivel ler as dimensoes do HTML editado"); e.code = "E_NO_DIMS"; throw e; }
  const backup = fs.readFileSync(htmlPath, "utf8"); // p/ restaurar se o render falhar
  fs.writeFileSync(htmlPath, clean, "utf8");
  const r = await htmlToPng(htmlPath, absPng, base.w, base.h, RENDER_SCALE, { strictNet: true });
  if (!r.ok || !fs.existsSync(absPng)) {
    try { fs.writeFileSync(htmlPath, backup, "utf8"); } catch (e) { /* melhor esforco */ }
    const e = new Error((r.stderr || "falha ao renderizar").slice(0, 300)); e.code = "E_RENDER_FAIL"; throw e;
  }
  return { ok: true, w: base.w, h: base.h, rel };
}

// 4Selet na Mídia: renderiza o print num dispositivo (modelo escolhido em status.media.model),
// em 2 formatos: 4:5 (ads/feed.png — publicável no IG) e 16:9 (ads/media_16x9.png — site).
// A legenda vai em copy/instagram_caption.txt (fluxo de feed). Metadados em status.media.
async function renderMedia(folder, opts) {
  const loc = requireActive(folder);
  const status = readJson(path.join(loc.path, "status.json")) || {};
  const meta = status.media || {};
  const model = (opts && opts.template) || meta.model || "tablet";
  const props = { image: meta.print || (opts && opts.image) || "", url: meta.url || "", eyebrow: meta.vehicle || "", model };
  const dir = path.join(loc.path, "ads");
  fs.mkdirSync(dir, { recursive: true });
  const rels = []; let err = "";
  const jobs = [
    { w: 1080, h: 1350, html: "feed.html", png: "feed.png", rel: "ads/feed.png" },
    { w: 1920, h: 1080, html: "media_16x9.html", png: "media_16x9.png", rel: "ads/media_16x9.png" },
  ];
  for (const j of jobs) {
    const hp = path.join(dir, j.html), pp = path.join(dir, j.png);
    fs.writeFileSync(hp, tplMedia(Object.assign({ width: j.w, height: j.h }, props)), "utf8");
    const r = await htmlToPng(hp, pp, j.w, j.h, RENDER_SCALE);
    if (r.ok) rels.push(j.rel); else err = r.stderr || err;
  }
  return { ok: rels.indexOf("ads/feed.png") !== -1, rels, stderr: err, template: model };
}

// Dispatcher por kind. `opts.template` (editorial|bold|split) so afeta estaticos.
// Assincrono: o chamador (rota) deve usar `await render.render(...)`.
async function render(folder, kind, opts) {
  switch (kind) {
    case "image": return renderImage(folder, opts);
    case "feed": return renderFeed(folder, opts);
    case "media": return renderMedia(folder, opts);
    case "carousel": return renderCarousel(folder, opts);
    case "video": return renderVideo(folder);
    default: { const e = new Error("kind sem render de midia: " + kind); e.code = "E_NO_RENDER"; throw e; }
  }
}

module.exports = {
  render, renderPreview, renderForDownload, renderEditedHtml,
  TEMPLATE_IDS,
};
