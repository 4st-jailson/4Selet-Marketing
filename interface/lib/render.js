// lib/render.js — renderizacao de midia final a partir do conceito gerado pela IA.
//   image    -> PNG 1080x1080 (Playwright via scripts/render_ad.js)
//   feed     -> PNG 1080x1350 (mesma engine)
//   carousel -> 1 PNG por slide (slides/slide_1.png ...)
//   video    -> MP4 9:16 (Remotion, composition BrandStory parametrizada)
// Tudo local, sem chaves externas. Respeita a regra: so renderiza em zona active.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { PATHS, PALETTE } = require("./config");
const { findTask } = require("./content");

const ASSETS = PATHS.ASSETS_DIR;
function fileUrl(p) { return "file:///" + path.resolve(p).replace(/\\/g, "/"); }
const LOGO_LIGHT = fileUrl(path.join(ASSETS, "logo-4selet-light.png"));

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

function requireActive(folder) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone !== "active") {
    const e = new Error("renderizar exige zona 'active' (atual: " + loc.zone + ")");
    e.code = "E_NOT_EDITABLE"; throw e;
  }
  return loc;
}

// Executa o render_ad.js oficial (Playwright) — HTML -> PNG.
function htmlToPng(htmlPath, outPng, width, height) {
  const script = path.join(PATHS.SCRIPTS_DIR, "render_ad.js");
  const r = spawnSync(process.execPath, [script, htmlPath, outPng, String(width), String(height)], {
    cwd: PATHS.PROJECT_ROOT, encoding: "utf8",
  });
  return {
    code: r.status === null ? -1 : r.status,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
    ok: r.status === 0,
  };
}

// ---- Template HTML da marca (1 cartao) ------------------------------------
// Gera um criativo editorial sobrio (paleta azul, Selet Dots, logo).
function brandCard({ width, height, eyebrow, headline, subtext, cta, badge, footer }) {
  const headlineSize = headline && headline.length > 22 ? 120 : 168;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>
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
  .headline { font-weight:900; font-size:${headlineSize}px; line-height:0.98;
    color:#FFFFFF; letter-spacing:-2px; }
  .headline .accent { color:${PALETTE.sky}; }
  .subtext { margin-top:36px; font-size:40px; line-height:1.34; color:${PALETTE.mist};
    max-width:90%; font-weight:400; }
  .bottom { position:relative; display:flex; align-items:center; justify-content:space-between; }
  .cta { font-weight:800; font-size:36px; color:${PALETTE.darker};
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
    <span class="footer">${esc(footer || "Para quem sabe que e Selet.")}</span>
  </div>
</div></body></html>`;
}

// Destaca numeros/percentuais no headline (ex.: "0%", "R$ 1,99", "D+10").
function highlightHeadline(text) {
  return esc(text).replace(/(\d+[%.,]?\d*\s*%?|R\$\s?\d[\d.,]*|D\+\d+)/g, '<span class="accent">$1</span>');
}

// ---- Renders por tipo -----------------------------------------------------
function renderImage(folder) {
  const loc = requireActive(folder);
  const concept = readJson(path.join(loc.path, "ads", "concept.json")) || {};
  const htmlPath = path.join(loc.path, "ads", "ad.html");
  const outPng = path.join(loc.path, "ads", "ad.png");
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  const html = brandCard({
    width: 1080, height: 1080,
    eyebrow: concept.layout_type || "Taxa Zero",
    headline: highlightHeadline(concept.headline || "Zero taxa. Tres meses."),
    subtext: concept.subtext || "",
    cta: concept.cta || "Ver as condicoes",
    badge: "#TaxaZero",
  });
  fs.writeFileSync(htmlPath, html, "utf8");
  const r = htmlToPng(htmlPath, outPng, 1080, 1080);
  return Object.assign(r, { rel: "ads/ad.png" });
}

function renderFeed(folder) {
  const loc = requireActive(folder);
  // Le a caption salva (txt) e usa a 1a linha forte como headline.
  let caption = "";
  try { caption = fs.readFileSync(path.join(loc.path, "copy", "instagram_caption.txt"), "utf8"); } catch (e) {}
  const firstLine = caption.split("\n").map((s) => s.trim()).filter(Boolean)[0] || "Para quem sabe que e Selet.";
  const headline = firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;
  const htmlPath = path.join(loc.path, "ads", "feed.html");
  const outPng = path.join(loc.path, "ads", "feed.png");
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  const html = brandCard({
    width: 1080, height: 1350,
    eyebrow: "Feed",
    headline: highlightHeadline(headline),
    subtext: "",
    cta: "Solicitar convite",
    badge: "#TaxaZero",
  });
  fs.writeFileSync(htmlPath, html, "utf8");
  const r = htmlToPng(htmlPath, outPng, 1080, 1350);
  return Object.assign(r, { rel: "ads/feed.png" });
}

function renderCarousel(folder) {
  const loc = requireActive(folder);
  const concept = readJson(path.join(loc.path, "copy", "instagram_carousel.json")) || {};
  const slides = Array.isArray(concept.slides) && concept.slides.length
    ? concept.slides
    : [{ title: "Para quem sabe que e Selet", body: "" }];
  const dir = path.join(loc.path, "slides");
  fs.mkdirSync(dir, { recursive: true });
  const rels = [];
  let lastErr = null;
  slides.forEach((s, i) => {
    const n = i + 1;
    const isCover = i === 0;
    const isCta = i === slides.length - 1;
    const htmlPath = path.join(dir, "slide_" + n + ".html");
    const outPng = path.join(dir, "slide_" + n + ".png");
    const html = brandCard({
      width: 1080, height: 1350,
      eyebrow: isCover ? "Taxa Zero" : (n + " / " + slides.length),
      headline: highlightHeadline(s.title || ""),
      subtext: s.body || "",
      cta: isCta ? (concept.cta || "Solicitar convite") : "",
      badge: isCover ? "#TaxaZero" : "",
    });
    fs.writeFileSync(htmlPath, html, "utf8");
    const r = htmlToPng(htmlPath, outPng, 1080, 1350);
    if (!r.ok) lastErr = r.stderr || r.stdout;
    else rels.push("slides/slide_" + n + ".png");
  });
  return { ok: rels.length === slides.length, rels, stderr: lastErr || "", count: rels.length, total: slides.length };
}

// ---- Video (Remotion parametrizado) ---------------------------------------
function renderVideo(folder) {
  const loc = requireActive(folder);
  const concept = readJson(path.join(loc.path, "video", "concept.json")) || {};
  const scenes = Array.isArray(concept.scenes) && concept.scenes.length ? concept.scenes : [
    { type: "hook", text: concept.hook || "Para quem sabe que e Selet.", visual: "" },
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
  const r = spawnSync(
    process.execPath,
    [cliJs, "render", "src/index.ts", "BrandStory", outMp4, "--props=" + propsPath, "--log=error"],
    // 12min: o 1o render apos subir o servidor faz o bundle webpack a frio (cold-start);
    // 8min encostava no limite e retornava status null. Render quente leva ~2min.
    { cwd: PATHS.PROJECT_ROOT, encoding: "utf8", timeout: 1000 * 60 * 12, maxBuffer: 1024 * 1024 * 32 }
  );
  const spawnErr = r.error ? (r.error.message || String(r.error)) : "";
  const timedOut = !spawnErr && r.status === null;
  return {
    code: r.status === null ? -1 : r.status,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim() || spawnErr ||
      (timedOut ? "render de video excedeu o tempo limite (cold-start). Tente novamente — o cache fica quente." : ""),
    ok: r.status === 0 && fs.existsSync(outMp4),
    rel: "video/video.mp4",
  };
}

// Dispatcher por kind.
function render(folder, kind) {
  switch (kind) {
    case "image": return renderImage(folder);
    case "feed": return renderFeed(folder);
    case "carousel": return renderCarousel(folder);
    case "video": return renderVideo(folder);
    default: { const e = new Error("kind sem render de midia: " + kind); e.code = "E_NO_RENDER"; throw e; }
  }
}

module.exports = { render, renderImage, renderFeed, renderCarousel, renderVideo };
