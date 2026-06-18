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
      child = spawn(process.execPath, args, { cwd: PATHS.PROJECT_ROOT });
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
function fileUrl(p) { return "file:///" + path.resolve(p).replace(/\\/g, "/"); }
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
async function htmlToPng(htmlPath, outPng, width, height, scale) {
  const script = path.join(PATHS.SCRIPTS_DIR, "render_ad.js");
  const args = [script, htmlPath, outPng, String(width), String(height)];
  if (scale && scale !== 1) args.push(String(scale));
  const r = await spawnAsync(args);
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
const DEFAULT_FOOTER = "Para quem sabe que é Selet.";

// Comprimento VISÍVEL do headline (ignora as tags <span> do realce). Usado para
// dimensionar a fonte: sem isso, o markup do destaque (ex.: "0%" vira
// '<span class="accent">0%</span>') inflava a contagem e derrubava a fonte do
// número — quebrando o efeito grande dos headlines curtos do template Destaque.
function headlineLen(html) { return String(html || "").replace(/<[^>]+>/g, "").length; }

// 1) Editorial — radial azul, dots, logo no topo, headline a esquerda, CTA embaixo.
function tplEditorial({ width, height, eyebrow, headline, subtext, cta, badge, footer }) {
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
    <span class="footer">${esc(footer || DEFAULT_FOOTER)}</span>
  </div>
</div></body></html>`;
}

// 2) Bold — fundo Darker solido, simbolo "4" como marca d'agua, tudo centralizado.
// Pensado p/ headlines curtas number-forward (ex.: "0%", "95%", "Os 4 numeros").
function tplBold({ width, height, eyebrow, headline, subtext, cta, badge, footer }) {
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
    <span class="footer">${esc(footer || DEFAULT_FOOTER)}</span>
  </div>
</div></body></html>`;
}

// 3) Split — banda superior clara (Cloud, logo dark + eyebrow) + banda inferior
// escura (Navy/Darker) com headline e CTA. Contraste editorial.
function tplSplit({ width, height, eyebrow, headline, subtext, cta, badge, footer }) {
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
      <span class="footer">${esc(footer || DEFAULT_FOOTER)}</span>
    </div>
  </div>
</div></body></html>`;
}

// 4) Foto — imagem como HEROI (object-fit cover) + wash navy p/ coesao de marca
// + scrim inferior p/ legibilidade. Logo no topo, headline/subtexto/CTA na base.
// Espelha as capas humanizadas do feed @4selet (ver Referencia-Instagram): a arte
// deixa de ser so cor solida + texto e passa a combinar foto (pessoa/objeto/cena)
// com a copy por cima. Sem `image`, cai num fundo navy (nada quebra).
function tplPhoto({ width, height, eyebrow, headline, subtext, cta, badge, footer, image }) {
  const n = headlineLen(headline);
  const headlineSize = n > 40 ? 84 : n > 26 ? 100 : n > 16 ? 124 : 156;
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
  <div class="content">
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    <div class="headline">${headline || ""}</div>
    ${subtext ? `<div class="subtext">${esc(subtext)}</div>` : ""}
    <div class="bottom">
      ${cta ? `<span class="cta">${esc(cta)} →</span>` : "<span></span>"}
      <span class="footer">${esc(footer || DEFAULT_FOOTER)}</span>
    </div>
  </div>
</div></body></html>`;
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

// Destaca numeros/percentuais no headline (ex.: "0%", "R$ 1,99", "D+10").
function highlightHeadline(text) {
  return esc(text).replace(/(\d+[%.,]?\d*\s*%?|R\$\s?\d[\d.,]*|D\+\d+)/g, '<span class="accent">$1</span>');
}

// ---- Arquetipos de SLIDE do carrossel -------------------------------------
// Diferente dos 3 templates de arte estatica: o carrossel compoe LAYOUTS
// distintos por slide (capa, grade de numeros, lista, texto, CTA), espelhando o
// design system real do feed @4selet (ver Referencia-Instagram), em vez de
// repetir um unico template. A CAPA usa o template de arte escolhido
// (editorial|bold|split); os demais slides usam estes arquetipos navy.
function carBase(width, height) {
  return `* { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${width}px; height:${height}px; }
  .card { position:relative; width:${width}px; height:${height}px; overflow:hidden;
    font-family:'Inter',sans-serif; color:${PALETTE.cloud};
    background:linear-gradient(160deg, ${PALETTE.navy} 0%, ${PALETTE.darker} 100%);
    display:flex; flex-direction:column; padding:90px 86px; }
  .dots { position:absolute; inset:0; background-image:radial-gradient(${PALETTE.sky}1f 2px, transparent 2px); background-size:46px 46px; opacity:.5; }
  .top { position:relative; display:flex; align-items:center; justify-content:space-between; }
  .logo { height:46px; }
  .pageno { font-family:'JetBrains Mono',monospace; font-size:26px; color:${PALETTE.mist}; opacity:.8; }
  .eyebrow { font-family:'JetBrains Mono',monospace; color:${PALETTE.sky}; font-size:30px; letter-spacing:3px; text-transform:uppercase; margin-bottom:26px; }
  .mid { position:relative; flex:1; display:flex; flex-direction:column; justify-content:center; }
  .s-title { font-weight:700; font-size:84px; line-height:1.02; color:#FFFFFF; letter-spacing:-1.5px; }
  .s-title .accent { color:${PALETTE.sky}; font-weight:900; }
  .footer { position:relative; font-family:'JetBrains Mono',monospace; font-size:26px; color:${PALETTE.mist}; opacity:.85; }`;
}
function carDoc(ctx, extraCss, bodyInner) {
  // Continuidade visual entre slides: desloca os Selet Dots como se os slides
  // formassem uma FAIXA UNICA — ao deslizar o carrossel, o padrao "encadeia" de
  // um slide para o outro (espelha as primeiras postagens reais do feed @4selet).
  // A logo no topo-esquerda em todos os slides reforça o encadeamento.
  const TILE = 46;
  const offX = -((((ctx.n || 1) - 1) * (ctx.width || 1080)) % TILE);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}
<style>${carBase(ctx.width, ctx.height)}${extraCss || ""}</style></head>
<body><div class="card"><div class="dots" style="background-position:${offX}px 0;"></div>${bodyInner}</div></body></html>`;
}
function carTop(ctx) {
  return `<div class="top"><img class="logo" src="${LOGO_LIGHT}" alt="4Selet"/><span class="pageno">${ctx.n} / ${ctx.total}</span></div>`;
}
// Slogan só no slide de fechamento (ctx.tagline) — evita repetir a frase em todo slide.
function carFooter(ctx) { return ctx.tagline ? `<div class="footer">${esc(ctx.footer || DEFAULT_FOOTER)}</div>` : ""; }

// Texto (desenvolvimento): titulo forte + paragrafo de apoio.
function slideText(slide, ctx) {
  const css = `.s-body { margin-top:34px; font-size:42px; line-height:1.34; color:${PALETTE.mist}; max-width:94%; }`;
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    <div class="s-title">${highlightHeadline(slide.title || "")}</div>
    ${slide.body ? `<div class="s-body">${esc(slide.body)}</div>` : ""}
  </div>
  ${carFooter(ctx)}`;
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
  const css = `.mid.center { align-items:center; text-align:center; }
    .logo-c { height:62px; margin-bottom:40px; }
    .s-title.big { font-size:92px; }
    .s-body { margin-top:28px; font-size:40px; line-height:1.32; color:${PALETTE.mist}; max-width:86%; }
    .cta { margin-top:52px; font-weight:800; font-size:40px; background:${PALETTE.blue}; color:#FFFFFF; padding:30px 60px; border-radius:999px; }`;
  const inner = `<div class="top"><span></span><span class="pageno">${ctx.n} / ${ctx.total}</span></div>
  <div class="mid center">
    <img class="logo-c" src="${LOGO_LIGHT}" alt="4Selet"/>
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    <div class="s-title big">${highlightHeadline(headline)}</div>
    ${slide.body ? `<div class="s-body">${esc(slide.body)}</div>` : ""}
    ${ctx.cta ? `<span class="cta">${esc(ctx.cta)} &#8594;</span>` : ""}
  </div>
  ${carFooter(ctx)}`;
  return carDoc(ctx, css, inner);
}
const SLIDE_ARCHETYPES = { stat_grid: slideStatGrid, list: slideList, text: slideText, cta: slideCta };

// Decide o arquetipo de um slide: override explicito (layout/type) > inferencia
// por posicao (1o=capa, ultimo=cta) e por conteudo (stats=>grade, items=>lista).
function slideArchetype(slide, i, total) {
  const ex = String((slide && (slide.layout || slide.type)) || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (ex === "stats" || ex === "grid" || ex === "stat_grid" || ex === "number_grid") return "stat_grid";
  if (ex === "list" || ex === "lista" || ex === "bullets") return "list";
  if (ex === "cover" || ex === "capa" || ex === "hook") return "cover";
  if (ex === "cta") return "cta";
  if (ex === "text" || ex === "texto") return "text";
  if (i === 0) return "cover";
  if (i === total - 1 && total > 1) return "cta";
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

async function renderCarousel(folder, opts) {
  const loc = requireActive(folder);
  const tpl = pickTemplate(loc, opts && opts.template);
  const concept = readJson(path.join(loc.path, "copy", "instagram_carousel.json")) || {};
  const slides = Array.isArray(concept.slides) && concept.slides.length
    ? concept.slides
    : [{ title: "Para quem sabe que é Selet", body: "" }];
  const dir = path.join(loc.path, "slides");
  fs.mkdirSync(dir, { recursive: true });
  const rels = [];
  let lastErr = null;
  const total = slides.length;
  // Sequencial (await em fila): renderiza um slide por vez, sem abrir N Chromium
  // ao mesmo tempo. Nao bloqueia o event loop (cada htmlToPng e assincrono).
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const n = i + 1;
    const arch = slideArchetype(s, i, total);
    const htmlPath = path.join(dir, "slide_" + n + ".html");
    const outPng = path.join(dir, "slide_" + n + ".png");
    let html;
    if (arch === "cover") {
      // A capa usa o template de arte escolhido (editorial|bold|split).
      html = tpl.build({
        width: 1080, height: 1350,
        eyebrow: concept.eyebrow || "",
        headline: highlightHeadline(s.title || ""),
        subtext: s.body || "",
        cta: "",
        badge: concept.badge || "",
        image: (s && s.image) || concept.image || "",
      });
    } else {
      const ctx = {
        width: 1080, height: 1350, n: n, total: total,
        cta: arch === "cta" ? (concept.cta || "") : "",
        footer: concept.footer,
        tagline: arch === "cta",
      };
      html = SLIDE_ARCHETYPES[arch](s, ctx);
    }
    fs.writeFileSync(htmlPath, html, "utf8");
    const r = await htmlToPng(htmlPath, outPng, 1080, 1350, RENDER_SCALE);
    if (!r.ok) lastErr = r.stderr || r.stdout;
    else rels.push("slides/slide_" + n + ".png");
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

async function renderPreview({ content_type, parsed, template } = {}) {
  const ct = contentTypeById(content_type);
  if (!ct || ct.media !== "image") return { ok: false, error: "este tipo nao tem previa de arte" };
  const fields = previewFields(ct, parsed);
  if (!fields) return { ok: false, error: "este tipo nao tem previa de arte" };
  const tplId = (template && TEMPLATES[template]) ? template : "editorial";
  const html = resolveTemplate(tplId)(fields);
  // Sufixo aleatorio: agora que o render e assincrono, duas previas podem rodar
  // "ao mesmo tempo" — nomes unicos evitam colisao no arquivo temporario.
  const uniq = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const base = path.join(os.tmpdir(), "4selet-preview-" + process.pid + "-" + uniq);
  const htmlPath = base + ".html";
  const outPng = base + ".png";
  try {
    fs.writeFileSync(htmlPath, html, "utf8");
    // Previa fica em resolucao base (1x) de proposito: e so visualizacao na tela —
    // alta resolucao so vale p/ o render final salvo (download).
    const r = await htmlToPng(htmlPath, outPng, fields.width, fields.height);
    if (!r.ok || !fs.existsSync(outPng)) {
      return { ok: false, error: (r.stderr || r.stdout || "falha ao renderizar a previa").slice(0, 400), template: tplId };
    }
    const b64 = fs.readFileSync(outPng).toString("base64");
    return { ok: true, dataUrl: "data:image/png;base64," + b64, template: tplId, kind: ct.kind, width: fields.width, height: fields.height };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { fs.unlinkSync(htmlPath); } catch (e) {}
    try { fs.unlinkSync(outPng); } catch (e) {}
  }
}

// Dispatcher por kind. `opts.template` (editorial|bold|split) so afeta estaticos.
// Assincrono: o chamador (rota) deve usar `await render.render(...)`.
async function render(folder, kind, opts) {
  switch (kind) {
    case "image": return renderImage(folder, opts);
    case "feed": return renderFeed(folder, opts);
    case "carousel": return renderCarousel(folder, opts);
    case "video": return renderVideo(folder);
    default: { const e = new Error("kind sem render de midia: " + kind); e.code = "E_NO_RENDER"; throw e; }
  }
}

module.exports = {
  render, renderImage, renderFeed, renderCarousel, renderVideo, renderPreview,
  TEMPLATE_IDS,
};
