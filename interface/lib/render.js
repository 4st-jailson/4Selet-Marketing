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
const { PATHS, PALETTE, PALETAS_CAMPANHA, PALETA_IDS, contentTypeById } = require("./config");
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
// SELO da marca: o "4" recortado (vazado) do quadrado azul arredondado — EXTRAÍDO do logotipo oficial
// (assets/simbolo-selo.png, crop do símbolo de logo-4selet-light.png), SEM o wordmark SELET. É a marca que
// aparece na arte por padrao (preferencia do Hugo). O simbolo.svg (traço) fica só p/ marca d'agua.
const SIMBOLO_SELO = fileUrl(path.join(ASSETS, "simbolo-selo.png"));

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
// A foto existe MESMO? O modelo inventa caminho de arquivo: pedindo "foto de fundo" no tema, em 3
// de 3 gerações ele escreveu coisas como "/uploads/escritorio-moderno-computador.jpg", que não
// existem no acervo. O desenho então aplicava o véu de leitura por cima do nada — o slide saía mais
// escuro que os vizinhos, sem foto e sem ninguém avisar. Aqui a foto fantasma é tratada como
// ausência de foto, que é o que ela é.
function imagemExiste(u) {
  u = String(u || "");
  if (!u) return false;
  if (/^(https?:|data:)/i.test(u)) return true;          // externa: quem valida é a rede/CSP
  try {
    const publico = path.resolve(path.join(__dirname, "..", "public"));
    const alvo = /^file:/i.test(u)
      ? path.resolve(decodeURIComponent(u.replace(/^file:\/+/i, "")))
      : path.resolve(path.join(publico, u.replace(/^\/+/, "")));
    // Confinado a public/: sem isto, "/uploads/../../.env" resolveria para um arquivo real fora da
    // pasta servida e passaria como "foto existente" — o render então tentaria desenhá-lo.
    if (alvo !== publico && !alvo.startsWith(publico + path.sep)) return false;
    return fs.existsSync(alvo) && fs.statSync(alvo).isFile();
  } catch (e) { return false; }
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

// Teto de tempo de um render de PNG (Playwright). Tunavel por env: PNG_RENDER_TIMEOUT_MS.
const PNG_RENDER_TIMEOUT_MS = Number(process.env.PNG_RENDER_TIMEOUT_MS || 4 * 60 * 1000) || 4 * 60 * 1000;

// Executa o render_ad.js oficial (Playwright) — HTML -> PNG. Assincrono (spawn).
// `scale` = deviceScaleFactor: 1 = base; 2 = ALTA RESOLUCAO (ex.: 2160px) p/ download.
// Paleta da CAMPANHA aplicada no documento pronto. Ponto único de propósito: htmlToPng é por onde
// passa TODO render (arte, feed, slides, formatos da Mídia e as prévias, via htmlStringToPngDataUrl),
// então trocar aqui garante que a prévia e o arquivo salvo nunca discordem. A troca é sobre o hex
// literal que os templates escrevem — as quatro cores estruturais e mais nada: os neutros e as cores
// de estado ficam, senão o texto perde contraste. Idempotente: rodar de novo num HTML já trocado não
// acha mais os hexes da marca e não faz nada.
let PALETA_ATUAL = null;
const CORES_TROCAVEIS = ["darker", "navy", "blue", "sky"];
function aplicaPaletaDaCampanha(html) {
  const p = PALETA_ATUAL;
  if (!p) return html;
  let out = String(html);
  for (const k of CORES_TROCAVEIS) {
    if (!p[k] || p[k] === PALETTE[k]) continue;
    out = out.split(PALETTE[k]).join(p[k]).split(PALETTE[k].toLowerCase()).join(p[k]);
  }
  return out;
}
async function htmlToPng(htmlPath, outPng, width, height, scale, opts) {
  if (PALETA_ATUAL) {
    try { fs.writeFileSync(htmlPath, aplicaPaletaDaCampanha(fs.readFileSync(htmlPath, "utf8")), "utf8"); } catch (e) {}
  }
  const script = path.join(PATHS.SCRIPTS_DIR, "render_ad.js");
  const args = [script, htmlPath, outPng, String(width), String(height)];
  if (scale && scale !== 1) args.push(String(scale));
  // strictNet: bloqueia rede externa no render (usado p/ HTML do editor, nao confiavel).
  // timeout OBRIGATORIO: a fila de render e serializada (um por vez). Sem teto, um Chromium
  // travado deixava a promise pendurada e TODOS os renders seguintes (de todos os usuarios)
  // esperavam para sempre, ate reiniciar o painel. 4 min e folga larga p/ um PNG.
  const spawnOpts = { timeout: PNG_RENDER_TIMEOUT_MS };
  if (opts && opts.strictNet) spawnOpts.env = { RENDER_STRICT_NET: "1" };
  const r = await spawnAsync(args, spawnOpts);
  if (r.timedOut) {
    return { code: r.code, stdout: r.stdout, stderr: "O render da imagem passou de " + Math.round(PNG_RENDER_TIMEOUT_MS / 60000) + " minutos e foi interrompido. Tente de novo.", ok: false };
  }
  return { code: r.code, stdout: r.stdout, stderr: r.stderr || r.error, ok: r.ok };
}

// Fator de resolucao dos renders FINAIS (salvos/baixados): 2x = alta resolucao.
// Tunavel por env: RENDER_SCALE.
const RENDER_SCALE = Number(process.env.RENDER_SCALE || 2) || 2;
// Fator da PREVIA: era 1x (so thumbnail). Agora a previa e CLICAVEL p/ ampliar no lightbox, entao
// 1x ficava pixelado ao ampliar (ainda mais em tela de alta densidade). 2x = nitida ao ampliar.
const PREVIEW_SCALE = Number(process.env.PREVIEW_SCALE || 2) || 2;

// ---- Templates visuais da marca -------------------------------------------
// 3 layouts on-brand (paleta 4Selet, Inter/JetBrains Mono, logo, Selet Dots).
// Contrato comum: { width, height, eyebrow, headline(HTML), subtext, cta, badge, footer }.
// `headline` chega como HTML ja realcado (spans .accent); os demais sao escapados.
// O eixo `ital` da Inter entra aqui (e nao numa familia nova): o arquetipo de citacao precisa de
// italico DE VERDADE, e sem o eixo o navegador inclina a fonte na marra, o que engorda a haste e
// suja o traco. Custo zero de peso — e a mesma fonte, so com mais um corte.
const FONT_LINK_BASE = '<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>';

// ---- Tipografia fora da identidade (por peça) -----------------------------
// A identidade da 4Selet é Inter no texto e JetBrains Mono nos rótulos, e o prompt de geração diz
// "nenhuma outra família". Isso continua sendo o padrão: nada muda sem alguém pedir. Mas quando a
// pessoa pede outra família — no prompt ou no seletor da peça — o painel avisa que aquilo sai da
// identidade, pergunta, e só troca se ela disser sim. Lista FECHADA de propósito: o nome vai para
// dentro de uma URL do Google Fonts e para dentro de CSS, e família livre seria injeção.
const FAMILIAS = {
  "": { label: "Inter (identidade 4Selet)", css: null, marca: true },
  playfair: { label: "Playfair Display", css: "'Playfair Display',serif", google: "Playfair+Display:wght@400;600;700;800;900" },
  dmserif: { label: "DM Serif Display", css: "'DM Serif Display',serif", google: "DM+Serif+Display" },
  montserrat: { label: "Montserrat", css: "'Montserrat',sans-serif", google: "Montserrat:wght@400;600;700;800;900" },
  poppins: { label: "Poppins", css: "'Poppins',sans-serif", google: "Poppins:wght@400;600;700;800;900" },
  oswald: { label: "Oswald", css: "'Oswald',sans-serif", google: "Oswald:wght@400;600;700" },
  bebas: { label: "Bebas Neue", css: "'Bebas Neue',sans-serif", google: "Bebas+Neue" },
  spacegrotesk: { label: "Space Grotesk", css: "'Space Grotesk',sans-serif", google: "Space+Grotesk:wght@400;600;700" },
};
const FAMILIA_IDS = Object.keys(FAMILIAS).filter(Boolean);
// A peça sendo desenhada agora. A fila de render é serializada (um PNG por vez, ver htmlToPng), então
// um valor por processo basta — e é bem mais simples que enfiar a família nos 13 pontos que montam
// documento. Sempre limpo no `finally` de render(), para uma peça nunca herdar a fonte da anterior.
let FAMILIA_ATUAL = "";
function fontHead() {
  const f = FAMILIAS[FAMILIA_ATUAL];
  if (!f || !f.css) return FONT_LINK_BASE;
  const link = '<link href="https://fonts.googleapis.com/css2?family=' + f.google + '&display=swap" rel="stylesheet"/>';
  // Especificidade alta de propósito: vence os `font-family:'Inter'` escritos dentro de cada
  // template sem precisar reescrever os 20 lugares onde eles aparecem. Os rótulos estruturais
  // (eyebrow, selo, rodapé, numeração) seguem em JetBrains Mono — é o que dá o ar técnico da marca.
  const over = "<style>html body .card, html body .card * { font-family:" + f.css + " !important; }"
    + "html body .card .eyebrow, html body .card .badge, html body .card .footer, html body .card .pageno"
    + " { font-family:'JetBrains Mono',monospace !important; }</style>";
  return FONT_LINK_BASE + link + over;
}
const DEFAULT_FOOTER = ""; // sem rodapé automático (Hugo: tirar "4Selet" de toda postagem)

// Comprimento VISÍVEL do headline (ignora as tags <span> do realce). Usado para
// dimensionar a fonte: sem isso, o markup do destaque (ex.: "0%" vira
// '<span class="accent">0%</span>') inflava a contagem e derrubava a fonte do
// número — quebrando o efeito grande dos headlines curtos do template Destaque.
function headlineLen(html) { return String(html || "").replace(/<[^>]+>/g, "").length; }
// A escada de tamanho da headline reagia SÓ ao tamanho dela, nunca ao total empilhado no cartão.
// Como o miolo usa justify-content:space-between sem altura mínima, cada bloco a mais empurra o
// rodapé para fora: medido nos 10 anúncios reais do acervo, o Destaque com rótulo E selo cortava a
// arte em 55px (metade da pílula do CTA ficava fora), e o Editorial só com rótulo caía de 83px de
// margem para 10px em 5 das 10 peças. Aqui a headline cede espaço na medida do que mais existe na
// peça — quanto mais blocos, menor o passo. Sem blocos extras o fator é 1 e nada muda.
function fatorPilha(p) {
  p = p || {};
  const texto = (v) => String(v || "").replace(/<[^>]+>/g, "").trim();
  let peso = 0;
  if (texto(p.eyebrow)) peso += 1;
  if (texto(p.badge)) peso += 1;
  if (texto(p.cta)) peso += 1;
  const sub = texto(p.subtext).length;
  if (sub) peso += sub > 110 ? 2 : 1;
  // 0 blocos -> 1,00 · 1 -> 0,94 · 2 -> 0,88 · 3 -> 0,82 · 4+ -> 0,78 (piso)
  return Math.max(0.78, 1 - peso * 0.06);
}

// 1) Editorial — radial azul, dots, logo no topo, headline a esquerda, CTA embaixo.
function tplEditorial({ width, height, eyebrow, headline, subtext, cta, badge, footer, dots, logo, watermark: wmStyle }) {
  const n = headlineLen(headline);
  const headlineSize = Math.round((n > 36 ? 100 : n > 22 ? 120 : 168) * fatorPilha({ eyebrow, subtext, cta, badge }));
  const wm = wmStyle ? watermark({ style: wmStyle }, THEME_DARK) : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}
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
<body><div class="card"><div class="dots"></div>${wm}
  <div class="top">
    <img class="logo" src="${logoSrc(logo, LOGO_LIGHT)}" alt="4Selet"/>
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
function tplBold({ width, height, eyebrow, headline, subtext, cta, badge, footer, dots, logo, watermark: wmStyle }) {
  const n = headlineLen(headline);
  const headlineSize = Math.round((n > 40 ? 88 : n > 26 ? 104 : n > 16 ? 132 : n > 8 ? 168 : 196) * fatorPilha({ eyebrow, subtext, cta, badge }));
  const wm = wmStyle ? watermark({ style: wmStyle }, THEME_DARK) : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}
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
  ${wmStyle ? wm : '<img class="mark" src="' + SIMBOLO + '" alt=""/>'}
  <img class="logo" src="${logoSrc(logo, LOGO_LIGHT)}" alt="4Selet"/>
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
function tplSplit({ width, height, eyebrow, headline, subtext, cta, badge, footer, dots, logo, watermark: wmStyle }) {
  // Em formato quadrado (1080x1080) a banda inferior e mais curta — reduz a
  // tipografia e o padding para o subtexto e o CTA nao serem cortados.
  const square = height < 1200;
  const n = headlineLen(headline);
  const headlineSize = square ? (n > 52 ? 72 : n > 36 ? 84 : n > 22 ? 100 : 124)
                              : (n > 52 ? 84 : n > 36 ? 96 : n > 22 ? 112 : 150);
  const subSize = square ? 34 : 40;
  const topFlex = square ? 22 : 26;
  // Era 76 — apertado de propósito, porque sem a headline ceder espaço o CTA era cortado no
  // formato quadrado. Com fatorPilha() encolhendo o título conforme o que mais existe na peça,
  // dá para voltar para dentro da margem segura da marca (88-104): medido nos 10 anúncios reais
  // com rótulo E selo, 92px não corta nenhum e tira todos os 7 que estavam abaixo do piso.
  const botPad = square ? 92 : 104;
  const wm = wmStyle ? watermark({ style: wmStyle }, THEME_DARK) : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}
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
    <img class="logo" src="${logoSrc(logo, LOGO_DARK)}" alt="4Selet"/>
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    ${badge ? `<span class="badge">${esc(badge)}</span>` : ""}
  </div>
  <div class="band-bot">${wm}
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
function tplPhoto({ width, height, eyebrow, headline, subtext, cta, badge, footer, image, dots, titleOffsetY, titleOffsetX, titleScale, logo }) {
  const n = headlineLen(headline);
  const headlineSize = Math.round((n > 40 ? 84 : n > 26 ? 100 : n > 16 ? 124 : 156) * (Number(titleScale) || 1));
  const photo = image ? `<img class="photo" src="${escAttr(resolveImage(image))}" alt=""/>` : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}
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
    <img class="logo" src="${logoSrc(logo, LOGO_LIGHT)}" alt="4Selet"/>
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
    return `<div class="dev" data-stage="1" style="width:406px;height:846px;background:#0a1015;border-radius:56px;padding:14px;box-shadow:${MED_BEZEL};position:relative;transform:rotate(.5deg)"><div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:116px;height:32px;background:#05090d;border-radius:18px;z-index:2"></div><div class="scr" style="width:100%;height:100%;border-radius:44px">${shot}</div></div>`;
  }
  if (model === "notebook") {
    return `<div class="dev" data-stage="1" style="display:flex;flex-direction:column;align-items:center"><div style="width:812px;height:512px;background:#0a1015;border-radius:18px 18px 5px 5px;padding:16px 16px 15px;box-shadow:${MED_BEZEL};position:relative"><div style="position:absolute;top:7px;left:50%;transform:translateX(-50%);width:7px;height:7px;border-radius:50%;background:#243039"></div><div class="scr" style="width:100%;height:100%;border-radius:6px">${shot}</div></div><div style="width:928px;height:30px;background:linear-gradient(180deg,#cfd7dc,#9aa8b0);clip-path:polygon(2.5% 0,97.5% 0,100% 100%,0 100%);border-radius:0 0 12px 12px;box-shadow:0 24px 50px rgba(0,0,0,.45)"></div></div>`;
  }
  if (model === "janela" || model === "browser") {
    return `<div class="dev" data-stage="1" style="width:812px;border-radius:16px;overflow:hidden;box-shadow:${MED_BEZEL};border:1px solid ${PALETTE.sky}59"><div style="height:52px;background:#e7ecef;display:flex;align-items:center;gap:10px;padding:0 20px"><span style="width:12px;height:12px;border-radius:50%;background:#c6ced4"></span><span style="width:12px;height:12px;border-radius:50%;background:#c6ced4"></span><span style="width:12px;height:12px;border-radius:50%;background:#c6ced4"></span>${url ? `<span style="margin-left:14px;background:#f2f5f7;color:#6c7c84;font-family:'JetBrains Mono',monospace;font-size:20px;padding:7px 20px;border-radius:999px">${esc(url)}</span>` : ""}</div><div class="scr" style="height:620px">${shot}</div></div>`;
  }
  return `<div class="dev" data-stage="1" style="perspective:2600px"><div style="width:566px;height:820px;background:#0a1015;border-radius:40px;padding:18px;box-shadow:${MED_BEZEL};transform:rotateX(4deg) rotateY(-6deg) rotate(1deg);position:relative"><div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:7px;height:7px;border-radius:50%;background:#243039"></div><div class="scr" style="width:100%;height:100%;border-radius:24px">${shot}</div></div></div>`;
}

// TABLET LIMPO "4Selet na Mídia": a matéria entra RETA (retângulo perfeito) numa moldura de tablet
// com inclinação LEVE (rotação 2D só do device — nada de perspectiva que entorta). Fundo Navy +
// linhas de tecnologia + título + logo. Substituiu o warp fotográfico (matrix3d) que ENTORTAVA a
// matéria — feedback do Hugo 2026-07-29 ("a notícia está torta; marca séria não posta qualquer coisa").
// Segue a referência que o Hugo mandou (tablet limpo, matéria alinhada, grafismo navy).
function tplMediaTabletClean({ width, height, image, eyebrow, url, model, logo: logoVariant }) {
  const r = Math.round;
  const land = width > height;
  const img = resolveImage(image);
  const phone = model === "celular"; // celular: tela estreita → artigo encaixa por LARGURA (contain), não corta
  const shot = img ? `<img class="scr-img${phone ? " fit" : ""}" src="${escAttr(img)}" alt=""/>` : `<div class="scr-empty">print da matéria</div>`;
  const veh = String(eyebrow || "").split(/[·|]/)[0].trim();               // nome do veículo (card)
  const domain = (String(url || "").match(/^https?:\/\/([^/]+)/) || [, ""])[1].replace(/^www\./, ""); // URL do CTA
  // Device MAIOR (tablet ~3:4 ou celular estreito): o "4Selet na mídia" saiu do centro pro canto.
  const ASP = phone ? 0.478 : 0.75;
  const tbH = phone
    ? (land ? r(height * 0.80) : r(Math.min(height * 0.74, width * 1.26)))
    : (land ? r(height * 0.72) : r(Math.min(height * 0.60, width * 0.90)));
  const tbW = r(tbH * ASP);
  const pad = Math.max(10, r(tbW * (phone ? 0.04 : 0.028)));
  const rad = r(tbW * (phone ? 0.14 : 0.063));
  const srad = Math.max(10, rad - pad + 2);
  const rot = land ? -2.5 : -3;
  const tabFont = r(tbW * 0.06);
  const logoH = r((land ? height : width) * 0.04);
  const kickFont = r((land ? height : width) * 0.03);
  const cardFont = r((land ? height : width) * 0.026);
  const ctaFont = r((land ? height : width) * 0.024);
  const px = r(width * 0.062);
  const stageTop = r(height * 0.52 - tbH / 2);
  const tech = `<svg class="tech" viewBox="0 0 ${width} ${height}" fill="none" preserveAspectRatio="xMidYMid slice">
    <g stroke="${PALETTE.sky}" stroke-width="1" opacity="0.12">
      <path d="M-20 ${r(height*.28)} H${r(width*.12)} V${r(height*.34)} H${r(width*.21)}"/>
      <path d="M${width+20} ${r(height*.30)} H${r(width*.88)} V${r(height*.24)}"/>
      <path d="M-20 ${r(height*.72)} H${r(width*.15)} V${r(height*.66)}"/>
      <path d="M${width+20} ${r(height*.70)} H${r(width*.85)} V${r(height*.76)} H${r(width*.70)}"/>
    </g>
    <g fill="${PALETTE.sky}" opacity="0.45">
      <circle cx="${r(width*.21)}" cy="${r(height*.34)}" r="3"/><circle cx="${r(width*.88)}" cy="${r(height*.24)}" r="3"/>
      <circle cx="${r(width*.15)}" cy="${r(height*.66)}" r="3"/><circle cx="${r(width*.70)}" cy="${r(height*.76)}" r="3"/>
    </g></svg>`;
  const notch = phone ? `<div class="notch" style="width:${r(tbW*0.36)}px;height:${r(tbW*0.05)}px;top:${r(pad*0.42)}px"></div>` : "";
  const device = `<div class="dev-wrap" data-stage="1" style="transform:rotate(${rot}deg)"><div class="cast"></div>
    <div class="tablet" style="width:${tbW}px;height:${tbH}px;padding:${pad}px;border-radius:${rad}px">
      <div class="screen" style="border-radius:${srad}px">${shot}<div class="backlight"></div><div class="glass"></div></div>${notch}
    </div></div>`;
  const topbar = `<div class="topbar" style="top:${r(height*0.058)}px;left:${px}px;right:${px}px">
      <img class="logo4" src="${logoSrc(logoVariant, LOGO_LIGHT)}" alt="4Selet"/>
      <div class="kicker"><b>4Selet</b><i>na mídia</i><span class="kbar"></span></div></div>`;
  const botbar = `<div class="botbar" style="bottom:${r(height*0.052)}px;left:${px}px;right:${px}px">
      ${veh ? `<div class="veic-card">${esc(veh)}</div>` : "<span></span>"}
      ${domain ? `<div class="cta"><div class="cta-txt"><div class="cta-l">Leia a matéria completa</div><div class="cta-u">${esc(domain)}</div></div><div class="cta-arrow">&#8250;</div></div>` : "<span></span>"}</div>`;
  const css = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${width}px;height:${height}px}
    .card{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(circle,#5499B51f 1.5px,transparent 1.7px) 0 0/46px 46px,radial-gradient(128% 118% at 78% 6%, ${PALETTE.blue} 0%, ${PALETTE.navy} 45%, ${PALETTE.darker} 100%);color:${PALETTE.cloud};font-family:'Inter',sans-serif}
    .tech{position:absolute;inset:0;z-index:1;pointer-events:none}
    .vig{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(140% 92% at 50% 116%, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 55%),radial-gradient(120% 80% at 50% -18%, rgba(84,153,181,.14) 0%, rgba(0,0,0,0) 60%)}
    .topbar{position:absolute;display:flex;align-items:center;justify-content:space-between;z-index:5}
    .logo4{height:${logoH}px;display:block;opacity:.98}
    .kicker{display:flex;align-items:center;font-size:${kickFont}px;color:#fff}
    .kicker b{font-weight:800;color:#fff}.kicker i{font-style:normal;font-weight:600;color:${PALETTE.sky};margin-left:${r(kickFont*0.28)}px}
    .kicker .kbar{width:2px;height:${r(kickFont*1.15)}px;background:${PALETTE.sky};margin-left:${r(kickFont*0.5)}px;border-radius:2px}
    .stage{position:absolute;left:0;right:0;z-index:3;display:flex;justify-content:center}
    .dev-wrap{position:relative;transform-origin:center}
    .cast{position:absolute;left:50%;bottom:${r(-tbH*0.05)}px;width:${r(tbW*0.95)}px;height:${r(tbH*0.16)}px;transform:translateX(-50%);background:radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 72%);filter:blur(6px);z-index:0}
    .tablet{position:relative;z-index:2;background:linear-gradient(150deg,#12181d,#080b0e);box-shadow:0 2px 0 rgba(255,255,255,.05) inset,0 40px 90px -20px rgba(0,0,0,.72),0 18px 40px -14px rgba(0,0,0,.55),0 0 0 1px rgba(84,153,181,.16)}
    .tablet::before{content:"";position:absolute;inset:0;border-radius:${rad}px;padding:1px;background:linear-gradient(150deg, rgba(255,255,255,.22), rgba(255,255,255,0) 38%, rgba(84,153,181,.18));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
    .screen{position:relative;width:100%;height:100%;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.5) inset}
    .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
    .screen img.fit{object-fit:contain;object-position:top center;background:#fff}
    .notch{position:absolute;left:50%;transform:translateX(-50%);background:#05090d;border-radius:99px;z-index:4}
    .scr-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9fb0b8;font-size:${tabFont}px;background:repeating-linear-gradient(45deg,#eef2f4,#eef2f4 20px,#e6ebee 20px,#e6ebee 40px)}
    .backlight{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;background:radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 45%)}
    .glass{position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,.05) 16%, rgba(255,255,255,0) 34%)}
    .botbar{position:absolute;display:flex;align-items:flex-end;justify-content:space-between;z-index:5;gap:16px}
    .veic-card{background:#fff;border-radius:${r(cardFont*0.85)}px;padding:${r(cardFont*0.72)}px ${r(cardFont*1.25)}px;color:${PALETTE.navy};font-weight:800;font-size:${cardFont}px;letter-spacing:-.3px;box-shadow:0 12px 26px -8px rgba(0,0,0,.55);max-width:52%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cta{display:flex;align-items:center;gap:${r(ctaFont*0.7)}px}
    .cta-txt{text-align:right;line-height:1.18}
    .cta-l{color:${PALETTE.cloud};font-size:${ctaFont}px;font-weight:500}
    .cta-u{color:${PALETTE.sky};font-size:${r(ctaFont*1.02)}px;font-weight:700}
    .cta-arrow{width:${r(ctaFont*1.95)}px;height:${r(ctaFont*1.95)}px;border-radius:50%;border:2px solid ${PALETTE.sky};color:${PALETTE.sky};display:flex;align-items:center;justify-content:center;font-size:${r(ctaFont*1.35)}px;font-weight:700;line-height:1}`;
  const body = `${tech}<div class="vig"></div>
    ${topbar}
    <div class="stage" style="top:${stageTop}px">${device}</div>
    ${botbar}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}<style>${css}</style></head><body><div class="card">${body}</div></body></html>`;
}

// ===== Mockup FOTO-REAL =====
// Compoe o print da materia na TELA de um tablet de uma FOTO real (mao segurando o
// tablet numa mesa). A materia e mapeada nos 4 cantos da tela por HOMOGRAFIA
// (matrix3d): a perspectiva bate com a da foto, entao a noticia fica alinhada com o
// aparelho — nao "torta". A homografia foi validada (erro < 0.001px nos 4 cantos).
function _adj3(m) {
  return [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
}
function _mm3(a, b) {
  const c = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = s; }
  return c;
}
function _mv3(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
function _basis(x1, y1, x2, y2, x3, y3, x4, y4) {
  const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const v = _mv3(_adj3(m), [x4, y4, 1]);
  return _mm3(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
// Mapeia o retangulo (0,0,w,h) nos cantos tl,tr,br,bl (em px do wrapper). transform-origin: 0 0.
function quadMatrix3d(w, h, tl, tr, br, bl) {
  const s = _basis(0, 0, w, 0, 0, h, w, h);
  const d = _basis(tl[0], tl[1], tr[0], tr[1], bl[0], bl[1], br[0], br[1]);
  const t = _mm3(d, _adj3(s));
  for (let i = 0; i < 9; i++) t[i] = t[i] / t[8];
  const m = [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]];
  return "matrix3d(" + m.map((x) => (Math.abs(x) < 1e-10 ? 0 : +x.toFixed(8))).join(",") + ")";
}

// Cenarios foto-reais disponiveis. `screen` = os 4 cantos da AREA DE TELA em FRACOES
// da foto (0..1). Para adicionar um cenario novo: suba a foto em uploads/ e meça os cantos.
const PHOTO_SCENES = {
  // MAOS: duas maos segurando o tablet, tela desobstruida e quase perfeitamente de
  // frente (a materia sai reta). Tratada para o navy sobrio da marca.
  maos: {
    file: "base_maos_tablet.jpg", w: 867, h: 1300, zoom: 1,
    screen: { tl: [0.122, 0.153], tr: [0.873, 0.152], br: [0.874, 0.823], bl: [0.122, 0.824] },
    grade: "brightness(.8) saturate(.8) contrast(1.05)",
    tint: "linear-gradient(160deg, rgba(0,53,84,.34), rgba(7,33,43,.5))",
  },
  // MAOS + MESA ESCURA: o cenario mais proximo da referencia — duas maos segurando
  // o tablet sobre mesa de madeira ESCURA, com cafe preto, caneta e caderno.
  // Tela em paisagem: o print retrato entra por "cover" (mostra o topo da materia).
  maos_mesa: {
    file: "base_maos_mesa_escura.jpg", w: 1880, h: 1255, zoom: 1, safeW: 0.72, safeH: 0.48, straighten: true,
    screen: { tl: [0.245, 0.472], tr: [0.711, 0.314], br: [0.741, 0.655], bl: [0.306, 0.808] },
    grade: "brightness(.92) saturate(.9) contrast(1.04)",
    tint: "linear-gradient(155deg, rgba(0,53,84,.26), rgba(7,33,43,.44))",
  },
  // MESA: mesa de madeira com xicara, caderno, caneta e planta ao fundo — os mesmos
  // props da referencia. Tablet apoiado, tela de frente.
  mesa: {
    file: "base_mesa_cafe.jpg", w: 867, h: 1300, zoom: 1.34,
    screen: { tl: [0.4764, 0.3131], tr: [0.812, 0.3146], br: [0.7878, 0.6123], bl: [0.4348, 0.6008] },
    grade: "brightness(.66) saturate(.82) contrast(1.08)",
    tint: "linear-gradient(155deg, rgba(0,53,84,.38), rgba(7,33,43,.56))",
  },
};

function tplMediaFotoReal({ width, height, image, eyebrow, url, headline, logo: logoVariant, scene }) {
  const r = Math.round;
  const mn = Math.min(width, height);
  const sc = PHOTO_SCENES[scene] || PHOTO_SCENES.maos;
  const shot = resolveImage(image);
  const veh = String(eyebrow || "").split(/[·|]/)[0].trim();
  const domain = (String(url || "").match(/^https?:\/\/([^/]+)/) || [, ""])[1].replace(/^www\./, "");
  const baseUrl = resolveImage("/uploads/" + sc.file);

  // Foto em "cover" ancorada no CENTRO DA TELA do tablet: garante o aparelho em quadro
  // em qualquer formato (4:5 / 1:1 / 9:16 / 16:9), sem cortar o device.
  const pw = sc.w || 1000, ph = sc.h || 1500;
  const q = sc.screen;
  const cx0 = (q.tl[0] + q.tr[0] + q.br[0] + q.bl[0]) / 4;
  const cy0 = (q.tl[1] + q.tr[1] + q.br[1] + q.bl[1]) / 4;
  // ENDIREITAR: gira a FOTO INTEIRA ate a tela ficar na horizontal. A materia sai
  // RETA sem perder a mao nem o cenario — o que gira e a cena (numa foto de mesa
  // vista de cima, girar alguns graus e imperceptivel).
  let rotDeg = 0;
  if (sc.straighten) {
    const a1 = Math.atan2((q.tr[1] - q.tl[1]) * ph, (q.tr[0] - q.tl[0]) * pw);
    const a2 = Math.atan2((q.br[1] - q.bl[1]) * ph, (q.br[0] - q.bl[0]) * pw);
    rotDeg = -(((a1 + a2) / 2) * 180) / Math.PI;
  }
  const rad = (rotDeg * Math.PI) / 180, cosR = Math.cos(rad), sinR = Math.sin(rad);
  // bbox da tela DEPOIS de endireitar — e o que a trava de escala precisa respeitar
  const rotPt = (p) => { const dx = (p[0] - cx0) * pw, dy = (p[1] - cy0) * ph; return [dx * cosR - dy * sinR, dx * sinR + dy * cosR]; };
  const rp = [q.tl, q.tr, q.br, q.bl].map(rotPt);
  const qwPx = Math.max(...rp.map((p) => p[0])) - Math.min(...rp.map((p) => p[0]));
  const qhPx = Math.max(...rp.map((p) => p[1])) - Math.min(...rp.map((p) => p[1]));
  // zoom: folga extra alem do "cover" — permite recentralizar o aparelho no quadro
  let scale = Math.max(width / pw, height / ph) * (sc.zoom || 1);
  // Ao endireitar, NAO forcamos cobrir o quadro inteiro: a foto vira um "cartao"
  // levemente girado sobre o fundo da marca — assim a cena (mao, cafe, caderno)
  // aparece inteira em vez de ser devorada pelo zoom.
  // TRAVA: o aparelho tem que caber INTEIRO no formato. Em paisagem (16:9) o "cover"
  // de uma foto retrato cortaria a tela ao meio — aqui limitamos a escala pelo
  // tamanho da tela na foto (+ folga p/ moldura e barras de marca).
  const availW = width * (sc.safeW || 0.9), availH = height * (sc.safeH || 0.74); // folga p/ topbar/botbar
  const scaleMax = Math.min(availW / Math.max(1, qwPx), availH / Math.max(1, qhPx));
  if (scale > scaleMax) scale = scaleMax;
  const dispW = pw * scale, dispH = ph * scale;
  // Rotacao acontece EM TORNO do centro da tela, entao ancorar esse centro no centro
  // do quadro continua valendo depois de endireitar.
  const cx = cx0, cy = cy0;
  let offX = width / 2 - cx * dispW, offY = height / 2 - cy * dispH;
  // Se a foto cobre o formato, desliza dentro dos limites (sem mostrar borda vazia).
  // Se NAO cobre (paisagem), centraliza — o fundo da marca aparece em volta.
  // Com rotacao, NAO desliza: a tela fica no centro (o giro e em torno dela).
  if (!rotDeg) {
    offX = dispW >= width ? Math.min(0, Math.max(width - dispW, offX)) : (width - dispW) / 2;
    offY = dispH >= height ? Math.min(0, Math.max(height - dispH, offY)) : (height - dispH) / 2;
  }

  // Cantos da tela em px do wrapper
  const P = (p) => [p[0] * dispW, p[1] * dispH];
  const tl = P(q.tl), tr = P(q.tr), br = P(q.br), bl = P(q.bl);
  // Aspecto real da tela (media dos lados) — o print entra num retangulo com ESSE
  // aspecto e usa object-fit:cover, entao a materia nao distorce (so corta embaixo,
  // como um print de tela mesmo).
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wAvg = (dist(tl, tr) + dist(bl, br)) / 2;
  const hAvg = (dist(tl, bl) + dist(tr, br)) / 2;
  const srcW = 1400, srcH = Math.max(1, r(srcW * (hAvg / Math.max(1, wAvg))));
  const mtx = quadMatrix3d(srcW, srcH, tl, tr, br, bl);

  const logoH = r(mn * 0.04), kickFont = r(mn * 0.028), cardFont = r(mn * 0.024), ctaFont = r(mn * 0.022);
  const px = r(width * 0.06);

  const screenInner = shot
    ? `<img src="${escAttr(shot)}" alt=""/>`
    : `<div class="fr-empty">print da matéria</div>`;

  const topbar = `<div class="topbar" style="top:${r(height * 0.058)}px;left:${px}px;right:${px}px">
      <img class="logo4" src="${logoSrc(logoVariant, LOGO_LIGHT)}" alt="4Selet"/>
      <div class="kicker"><b>4Selet</b><i>na mídia</i><span class="kbar"></span></div></div>`;
  const botbar = `<div class="botbar" style="bottom:${r(height * 0.052)}px;left:${px}px;right:${px}px">
      ${veh ? `<div class="veic-card">${esc(veh)}</div>` : "<span></span>"}
      ${domain ? `<div class="cta"><div class="cta-txt"><div class="cta-l">Leia a matéria completa</div><div class="cta-u">${esc(domain)}</div></div><div class="cta-arrow">&#8250;</div></div>` : "<span></span>"}</div>`;

  const css = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${width}px;height:${height}px}
    .card{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(circle,#5499B51f 1.5px,transparent 1.7px) 0 0/46px 46px,radial-gradient(128% 118% at 78% 6%, ${PALETTE.blue} 0%, ${PALETTE.navy} 45%, ${PALETTE.darker} 100%);color:${PALETTE.cloud};font-family:'Inter',sans-serif}
    .ph{position:absolute;left:${r(offX)}px;top:${r(offY)}px;width:${r(dispW)}px;height:${r(dispH)}px;z-index:1;overflow:hidden;${rotDeg ? `transform:rotate(${rotDeg.toFixed(3)}deg);transform-origin:${r(cx * dispW)}px ${r(cy * dispH)}px;border-radius:${r(mn * 0.02)}px;box-shadow:0 ${r(mn * 0.035)}px ${r(mn * 0.08)}px -${r(mn * 0.02)}px rgba(0,0,0,.7);` : ""}${dispW < width || dispH < height ? `border-radius:${r(mn * 0.022)}px;box-shadow:0 ${r(mn * 0.03)}px ${r(mn * 0.07)}px -${r(mn * 0.02)}px rgba(0,0,0,.65)` : ""}}
    .ph>img.bg{width:100%;height:100%;object-fit:fill;display:block;filter:${sc.grade || "none"}}
    .tint{position:absolute;inset:0;pointer-events:none;background:${sc.tint || "none"};z-index:1}
    .scr{position:absolute;left:0;top:0;width:${srcW}px;height:${srcH}px;transform-origin:0 0;transform:${mtx};overflow:hidden;background:#fff;z-index:2}
    .scr img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;filter:brightness(.97) saturate(.98)}
    .fr-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9fb0b8;font-size:${r(srcW * 0.05)}px;background:repeating-linear-gradient(45deg,#eef2f4,#eef2f4 24px,#e6ebee 24px,#e6ebee 48px)}
    /* reflexo/vidro por cima da materia — deforma junto e vende o realismo */
    .scr .gloss{position:absolute;inset:0;pointer-events:none;background:linear-gradient(122deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,.06) 15%, rgba(255,255,255,0) 33%, rgba(0,0,0,.05) 100%)}
    /* scrim suave: garante leitura do chrome branco sobre a foto */
    .scrim{position:absolute;inset:0;z-index:3;pointer-events:none;background:linear-gradient(180deg, rgba(4,18,25,.58) 0%, rgba(4,18,25,.14) 22%, rgba(4,18,25,0) 42%, rgba(4,18,25,.16) 74%, rgba(4,18,25,.62) 100%)}
    .topbar{position:absolute;display:flex;align-items:center;justify-content:space-between;z-index:6}
    .logo4{height:${logoH}px;display:block;opacity:.98;filter:drop-shadow(0 2px 10px rgba(0,0,0,.5))}
    .kicker{display:flex;align-items:center;font-size:${kickFont}px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.45)}
    .kicker b{font-weight:800;color:#fff}.kicker i{font-style:normal;font-weight:600;color:${PALETTE.sky};margin-left:${r(kickFont * 0.28)}px}
    .kicker .kbar{width:2px;height:${r(kickFont * 1.15)}px;background:${PALETTE.sky};margin-left:${r(kickFont * 0.5)}px;border-radius:2px}
    .botbar{position:absolute;display:flex;align-items:flex-end;justify-content:space-between;z-index:6;gap:16px}
    .veic-card{background:#fff;border-radius:${r(cardFont * 0.85)}px;padding:${r(cardFont * 0.72)}px ${r(cardFont * 1.25)}px;color:${PALETTE.navy};font-weight:800;font-size:${cardFont}px;letter-spacing:-.3px;box-shadow:0 12px 26px -8px rgba(0,0,0,.6);max-width:52%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cta{display:flex;align-items:center;gap:${r(ctaFont * 0.7)}px;text-shadow:0 2px 10px rgba(0,0,0,.45)}
    .cta-txt{text-align:right;line-height:1.18}
    .cta-l{color:${PALETTE.cloud};font-size:${ctaFont}px;font-weight:500}
    .cta-u{color:${PALETTE.sky};font-size:${r(ctaFont * 1.02)}px;font-weight:700}
    .cta-arrow{width:${r(ctaFont * 1.95)}px;height:${r(ctaFont * 1.95)}px;border-radius:50%;border:2px solid ${PALETTE.sky};color:${PALETTE.sky};display:flex;align-items:center;justify-content:center;font-size:${r(ctaFont * 1.35)}px;font-weight:700;line-height:1}`;

  const body = `<div class="ph" data-stage="1"><img class="bg" src="${escAttr(baseUrl)}" alt=""/>
      <div class="tint"></div>
      <div class="scr">${screenInner}<div class="gloss"></div></div>
    </div>
    <div class="scrim"></div>
    ${topbar}
    ${botbar}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}<style>${css}</style></head><body><div class="card">${body}</div></body></html>`;
}

// ===== Layouts alternativos de "4Selet na Mídia" (gerados+validados 2026-07-29): navegador, citação, split, selo, camadas.
// Mesmo enquadramento de marca (logo topo, "4Selet na mídia", card do veículo, CTA). Matéria SEMPRE reta. =====
function tplMediaNavegador({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const land = width > height;
  const minDim = Math.min(width, height);
  const dom = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\./, '');
  const veic = String(eyebrow || '').split(/[·|]/)[0].trim();
  const img = resolveImage(image);
  const logo = logoSrc(logoVariant, LOGO_LIGHT);

  const px = Math.round(width * 0.06);
  const topPad = Math.round(height * 0.12);
  const botPad = Math.round(height * 0.135);
  const logoH = Math.round(minDim * 0.04);

  const P = PALETTE;

  const brandTag =
    '<div style="display:flex;align-items:center;gap:' + Math.round(minDim * 0.02) + 'px;">' +
      '<div style="font-family:\'Inter\',sans-serif;font-size:' + Math.round(minDim * 0.026) + 'px;line-height:1;letter-spacing:.2px;">' +
        '<span style="font-weight:800;color:#fff;">4Selet</span>' +
        '<span style="font-weight:700;color:' + P.sky + ';">&nbsp;na mídia</span>' +
      '</div>' +
      '<div style="width:' + Math.max(3, Math.round(minDim * 0.006)) + 'px;height:' + Math.round(minDim * 0.05) + 'px;background:' + P.sky + ';border-radius:99px;"></div>' +
    '</div>';

  const topBar =
    '<div style="position:absolute;top:' + Math.round(height * 0.05) + 'px;left:' + px + 'px;right:' + px + 'px;display:flex;align-items:center;justify-content:space-between;z-index:5;">' +
      '<img src="' + escAttr(logo) + '" style="height:' + logoH + 'px;width:auto;display:block;" />' +
      brandTag +
    '</div>';

  const veicCard = veic
    ? '<div style="background:#fff;border-radius:' + Math.round(minDim * 0.022) + 'px;padding:' + Math.round(minDim * 0.018) + 'px ' + Math.round(minDim * 0.032) + 'px;box-shadow:0 ' + Math.round(minDim * 0.012) + 'px ' + Math.round(minDim * 0.03) + 'px rgba(0,0,0,.28);max-width:' + Math.round(width * 0.5) + 'px;">' +
        '<div style="font-family:\'Inter\',sans-serif;font-weight:800;color:' + P.navy + ';font-size:' + Math.round(minDim * 0.03) + 'px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(veic) + '</div>' +
      '</div>'
    : '';

  const ctaBlock = dom
    ? '<div style="display:flex;align-items:center;gap:' + Math.round(minDim * 0.022) + 'px;">' +
        '<div style="text-align:right;font-family:\'Inter\',sans-serif;line-height:1.15;">' +
          '<div style="color:' + P.cloud + ';font-size:' + Math.round(minDim * 0.022) + 'px;font-weight:600;">Leia a matéria completa</div>' +
          '<div style="color:' + P.sky + ';font-size:' + Math.round(minDim * 0.026) + 'px;font-weight:700;">' + esc(dom) + '</div>' +
        '</div>' +
        '<div style="width:' + Math.round(minDim * 0.06) + 'px;height:' + Math.round(minDim * 0.06) + 'px;border-radius:99px;border:' + Math.max(2, Math.round(minDim * 0.004)) + 'px solid ' + P.sky + ';display:flex;align-items:center;justify-content:center;color:' + P.sky + ';font-size:' + Math.round(minDim * 0.036) + 'px;font-weight:700;line-height:1;font-family:\'Inter\',sans-serif;">&#8250;</div>' +
      '</div>'
    : '';

  const bottomBar =
    '<div style="position:absolute;bottom:' + Math.round(height * 0.05) + 'px;left:' + px + 'px;right:' + px + 'px;display:flex;align-items:center;justify-content:space-between;gap:' + Math.round(minDim * 0.03) + 'px;z-index:5;">' +
      veicCard +
      ctaBlock +
    '</div>';

  // Browser window
  const winRadius = Math.round(minDim * 0.028);
  const chromeH = Math.round(minDim * 0.055);
  const dotSz = Math.round(chromeH * 0.28);
  const dotGap = Math.round(dotSz * 0.7);

  const addressBar =
    '<div style="flex:1;height:' + Math.round(chromeH * 0.6) + 'px;margin:0 ' + Math.round(chromeH * 0.4) + 'px;background:rgba(255,255,255,.14);border-radius:99px;display:flex;align-items:center;padding:0 ' + Math.round(chromeH * 0.45) + 'px;overflow:hidden;">' +
      '<span style="color:' + P.mist + ';font-size:' + Math.round(chromeH * 0.32) + 'px;margin-right:' + Math.round(chromeH * 0.3) + 'px;line-height:1;">&#128274;</span>'.replace('&#128274;', '') +
      '<span style="font-family:\'JetBrains Mono\',monospace;color:' + P.cloud + ';font-size:' + Math.round(chromeH * 0.34) + 'px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(dom || 'matéria') + '</span>' +
    '</div>';

  const browserChrome =
    '<div style="height:' + chromeH + 'px;background:linear-gradient(180deg,#0d3244,#0a2a39);display:flex;align-items:center;padding:0 ' + Math.round(chromeH * 0.55) + 'px;border-bottom:1px solid rgba(255,255,255,.08);flex:0 0 auto;">' +
      '<div style="display:flex;gap:' + dotGap + 'px;flex:0 0 auto;">' +
        '<div style="width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:99px;background:#ff5f57;"></div>' +
        '<div style="width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:99px;background:#febc2e;"></div>' +
        '<div style="width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:99px;background:#28c840;"></div>' +
      '</div>' +
      addressBar +
    '</div>';

  const contentInner = img
    ? '<img src="' + escAttr(img) + '" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;" />'
    : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0a2130;padding:' + Math.round(minDim * 0.05) + 'px;box-sizing:border-box;">' +
        '<div style="font-family:\'Inter\',sans-serif;color:#fff;font-weight:800;font-size:' + Math.round(minDim * 0.042) + 'px;line-height:1.25;text-align:center;">' + esc(headline || '') + '</div>' +
      '</div>';

  const browserWindow =
    '<div style="width:100%;height:100%;border-radius:' + winRadius + 'px;overflow:hidden;background:#0a2a39;box-shadow:0 ' + Math.round(minDim * 0.03) + 'px ' + Math.round(minDim * 0.07) + 'px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06);display:flex;flex-direction:column;">' +
      browserChrome +
      '<div style="flex:1 1 auto;min-height:0;background:#fff;overflow:hidden;">' + contentInner + '</div>' +
    '</div>';

  // Janela do browser dimensionada pra que o CORPO tenha a proporção do print
  // (~3:4) — a matéria cabe INTEIRA, sem corte, em qualquer formato.
  const PRINT_ASPECT = 0.75;
  const availH = height - topPad - botPad;
  const availW = width - px * 2;
  let winW = Math.round((availH - chromeH) * PRINT_ASPECT);
  if (land && winW > availW * 0.5) winW = Math.round(availW * 0.5);
  if (!land && winW > availW) winW = availW;
  const winH = Math.round(winW / PRINT_ASPECT + chromeH);

  let centerArea;
  if (land) {
    centerArea =
      '<div style="position:absolute;top:' + topPad + 'px;left:' + px + 'px;right:' + px + 'px;bottom:' + botPad + 'px;display:flex;align-items:center;gap:' + Math.round(width * 0.05) + 'px;z-index:2;">' +
        '<div style="width:' + winW + 'px;height:' + winH + 'px;flex:0 0 auto;">' + browserWindow + '</div>' +
        '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;">' +
          (headline
            ? '<div style="font-family:\'JetBrains Mono\',monospace;color:' + P.sky + ';font-size:' + Math.round(minDim * 0.024) + 'px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:' + Math.round(minDim * 0.03) + 'px;">Na imprensa</div>' +
              '<div style="font-family:\'Inter\',sans-serif;color:#fff;font-weight:800;font-size:' + Math.round(minDim * 0.05) + 'px;line-height:1.18;">' + esc(headline) + '</div>'
            : '<div style="font-family:\'Inter\',sans-serif;color:#fff;font-weight:800;font-size:' + Math.round(minDim * 0.055) + 'px;line-height:1.15;">4Selet<br><span style="color:' + P.sky + ';">na mídia</span></div>') +
        '</div>' +
      '</div>';
  } else {
    centerArea =
      '<div style="position:absolute;top:' + topPad + 'px;left:' + px + 'px;right:' + px + 'px;bottom:' + botPad + 'px;display:flex;align-items:center;justify-content:center;z-index:2;">' +
        '<div style="width:' + winW + 'px;height:' + winH + 'px;">' + browserWindow + '</div>' +
      '</div>';
  }

  const circuit =
    '<svg viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" style="position:absolute;inset:0;opacity:.12;z-index:1;" preserveAspectRatio="none">' +
      '<g stroke="' + P.sky + '" stroke-width="' + Math.max(1, Math.round(minDim * 0.0018)) + '" fill="none">' +
        '<path d="M0 ' + Math.round(height * 0.2) + ' H' + Math.round(width * 0.3) + ' V' + Math.round(height * 0.32) + ' H' + Math.round(width * 0.55) + '"/>' +
        '<path d="M' + width + ' ' + Math.round(height * 0.15) + ' H' + Math.round(width * 0.72) + ' V' + Math.round(height * 0.28) + '"/>' +
        '<path d="M' + Math.round(width * 0.12) + ' ' + height + ' V' + Math.round(height * 0.78) + ' H' + Math.round(width * 0.4) + '"/>' +
        '<path d="M' + width + ' ' + Math.round(height * 0.82) + ' H' + Math.round(width * 0.68) + ' V' + Math.round(height * 0.7) + '"/>' +
      '</g>' +
      '<g fill="' + P.sky + '">' +
        '<circle cx="' + Math.round(width * 0.3) + '" cy="' + Math.round(height * 0.2) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.55) + '" cy="' + Math.round(height * 0.32) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.72) + '" cy="' + Math.round(height * 0.28) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.4) + '" cy="' + Math.round(height * 0.78) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.68) + '" cy="' + Math.round(height * 0.7) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
      '</g>' +
    '</svg>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8">' + fontHead() +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:' + width + 'px;height:' + height + 'px;}</style></head>' +
    '<body><div style="position:relative;width:' + width + 'px;height:' + height + 'px;overflow:hidden;background:radial-gradient(circle,#5499B51f 1.5px,transparent 1.7px) 0 0/46px 46px,radial-gradient(128% 118% at 78% 6%,' + P.blue + ' 0%,' + P.navy + ' 45%,' + P.darker + ' 100%);font-family:\'Inter\',sans-serif;">' +
      circuit +
      topBar +
      centerArea +
      bottomBar +
    '</div></body></html>';
}

function tplMediaCitacao({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const W = Number(width) || 1080;
  const H = Number(height) || 1350;
  const land = W > H;
  const MIN = Math.min(W, H);
  const MAX = Math.max(W, H);

  const src = image ? resolveImage(image) : '';
  const hasImg = !!src;
  const quote = String(headline || '').trim();
  const hasQuote = !!quote;

  const logo = logoSrc(logoVariant, LOGO_LIGHT);
  const P = PALETTE;

  const veiculo = String(eyebrow || '').split(/[·|]/)[0].trim();
  const domain = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\.|\/$/, '');
  const hasDomain = !!domain;

  // scaling refs
  const padX = Math.round(W * 0.06);
  const topSafe = Math.round(H * 0.12);
  const botSafe = Math.round(H * 0.135);
  const logoH = Math.round(MIN * 0.04);

  // typography
  const eyeSize = Math.round(MIN * 0.018);
  const brandSize = Math.round(MIN * 0.028);
  const veiculoSize = Math.round(MIN * 0.026);
  const ctaTopSize = Math.round(MIN * 0.017);
  const ctaDomSize = Math.round(MIN * 0.022);

  // quote sizing: bigger in portrait, moderate in landscape
  const qLen = quote.length;
  let quoteBase = land ? MIN * 0.052 : MIN * 0.06;
  if (qLen > 90) quoteBase *= 0.82;
  else if (qLen > 60) quoteBase *= 0.9;
  const quoteSize = Math.round(quoteBase);
  const bigMarkSize = Math.round(MIN * (land ? 0.2 : 0.24));

  // circuit graphism nodes
  const circuit = `
    <g stroke="${P.sky}" stroke-width="${Math.max(1, Math.round(MIN * 0.0016))}" fill="none" opacity="0.12">
      <path d="M ${W * 0.05} ${H * 0.3} H ${W * 0.28} V ${H * 0.46} H ${W * 0.4}"/>
      <path d="M ${W * 0.62} ${H * 0.62} H ${W * 0.8} V ${H * 0.78} H ${W * 0.95}"/>
      <path d="M ${W * 0.72} ${H * 0.16} V ${H * 0.32} H ${W * 0.9}"/>
      <path d="M ${W * 0.1} ${H * 0.7} V ${H * 0.86} H ${W * 0.34}"/>
      <circle cx="${W * 0.28}" cy="${H * 0.3}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.4}" cy="${H * 0.46}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.8}" cy="${H * 0.62}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.9}" cy="${H * 0.32}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.34}" cy="${H * 0.86}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.72}" cy="${H * 0.16}" r="${MIN * 0.007}"/>
    </g>`;

  // topbar (brand frame)
  const topbar = `
    <div style="position:absolute;top:${Math.round(H * 0.045)}px;left:${padX}px;right:${padX}px;display:flex;align-items:center;justify-content:space-between;">
      <img src="${escAttr(logo)}" style="height:${logoH}px;width:auto;display:block;" />
      <div style="display:flex;align-items:center;gap:${Math.round(MIN * 0.014)}px;">
        <span style="font-family:'Inter',sans-serif;font-size:${brandSize}px;line-height:1;">
          <span style="font-weight:800;color:#fff;">4Selet</span>
          <span style="font-weight:700;color:${P.sky};"> na mídia</span>
        </span>
        <span style="display:block;width:${Math.max(2, Math.round(MIN * 0.004))}px;height:${Math.round(brandSize * 1.25)}px;background:${P.sky};border-radius:2px;"></span>
      </div>
    </div>`;

  // footer left card + right CTA
  const footerCard = `
    <div style="display:inline-flex;align-items:center;background:#fff;border-radius:${Math.round(MIN * 0.02)}px;padding:${Math.round(MIN * 0.016)}px ${Math.round(MIN * 0.026)}px;box-shadow:0 ${Math.round(MIN * 0.008)}px ${Math.round(MIN * 0.024)}px rgba(0,0,0,0.28);">
      <span style="font-family:'Inter',sans-serif;font-weight:800;color:${P.navy};font-size:${veiculoSize}px;line-height:1;letter-spacing:-0.01em;">${esc(veiculo)}</span>
    </div>`;

  const ctaRight = hasDomain ? `
    <div style="display:flex;align-items:center;gap:${Math.round(MIN * 0.018)}px;">
      <div style="text-align:right;">
        <div style="font-family:'JetBrains Mono',monospace;font-weight:500;color:${P.cloud};font-size:${ctaTopSize}px;line-height:1;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:${Math.round(MIN * 0.008)}px;">Leia a matéria completa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:700;color:${P.sky};font-size:${ctaDomSize}px;line-height:1;">${esc(domain)}</div>
      </div>
      <div style="flex:0 0 auto;width:${Math.round(MIN * 0.058)}px;height:${Math.round(MIN * 0.058)}px;border-radius:50%;border:${Math.max(2, Math.round(MIN * 0.003))}px solid ${P.sky};display:flex;align-items:center;justify-content:center;">
        <span style="font-family:'Inter',sans-serif;color:${P.sky};font-size:${Math.round(MIN * 0.036)}px;line-height:1;font-weight:700;margin-top:-${Math.round(MIN * 0.004)}px;">›</span>
      </div>
    </div>` : '';

  const footer = `
    <div style="position:absolute;bottom:${Math.round(H * 0.05)}px;left:${padX}px;right:${padX}px;display:flex;align-items:center;justify-content:space-between;gap:${padX}px;">
      ${footerCard}
      ${ctaRight}
    </div>`;

  // thumbnail (small straight print card)
  const thumbCard = (w, h) => hasImg ? `
    <div style="width:${w}px;height:${h}px;border-radius:${Math.round(MIN * 0.016)}px;overflow:hidden;box-shadow:0 ${Math.round(MIN * 0.01)}px ${Math.round(MIN * 0.03)}px rgba(0,0,0,0.4);border:${Math.max(1, Math.round(MIN * 0.002))}px solid rgba(255,255,255,0.12);flex:0 0 auto;">
      <img src="${escAttr(src)}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;" />
    </div>` : '';

  // ===== central content =====
  let center;

  if (hasQuote) {
    // big decorative quote mark + headline as editorial quote + attribution + thumbnail
    const bigMark = `<div style="font-family:'Inter',sans-serif;font-weight:800;color:${P.sky};font-size:${bigMarkSize}px;line-height:0.7;opacity:0.9;height:${Math.round(bigMarkSize * 0.55)}px;overflow:hidden;">“</div>`;
    const attribution = `<div style="font-family:'Inter',sans-serif;font-weight:700;color:${P.sky};font-size:${Math.round(MIN * 0.026)}px;line-height:1;margin-top:${Math.round(MIN * 0.03)}px;">— ${esc(veiculo)}</div>`;
    const quoteBlock = `<div style="font-family:'Inter',sans-serif;font-weight:800;color:#fff;font-size:${quoteSize}px;line-height:1.18;letter-spacing:-0.015em;max-width:100%;">${esc(quote)}”</div>`;

    if (land) {
      const thW = Math.round(W * 0.26);
      const thH = Math.round(thW * 1.15);
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;align-items:center;gap:${Math.round(W * 0.05)}px;">
          <div style="flex:1 1 auto;min-width:0;">
            ${bigMark}
            ${quoteBlock}
            ${attribution}
          </div>
          ${thumbCard(thW, thH)}
        </div>`;
    } else {
      const thW = Math.round(W * 0.4);
      const thH = Math.round(thW * 0.72);
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;flex-direction:column;justify-content:center;">
          ${bigMark}
          ${quoteBlock}
          ${attribution}
          <div style="margin-top:${Math.round(MIN * 0.05)}px;">${thumbCard(thW, thH)}</div>
        </div>`;
    }
  } else {
    // fallback: large straight print card centered, no invented text
    if (hasImg) {
      let cW, cH;
      if (land) {
        cH = Math.round((H - topSafe - botSafe) * 0.92);
        cW = Math.round(cH * 1.25);
        if (cW > W - padX * 2) { cW = Math.round(W * 0.6); cH = Math.round(cW * 0.8); }
      } else {
        cW = Math.round(W - padX * 2);
        cH = Math.round((H - topSafe - botSafe) * 0.9);
      }
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;align-items:center;justify-content:center;">
          <div style="width:${cW}px;height:${cH}px;border-radius:${Math.round(MIN * 0.02)}px;overflow:hidden;box-shadow:0 ${Math.round(MIN * 0.014)}px ${Math.round(MIN * 0.04)}px rgba(0,0,0,0.45);border:${Math.max(1, Math.round(MIN * 0.0025))}px solid rgba(255,255,255,0.14);">
            <img src="${escAttr(src)}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;" />
          </div>
        </div>`;
    } else {
      const bigMark = `<div style="font-family:'Inter',sans-serif;font-weight:800;color:${P.sky};font-size:${bigMarkSize}px;line-height:0.7;">“</div>`;
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;">
          ${bigMark}
          <div style="font-family:'Inter',sans-serif;font-weight:800;color:#fff;font-size:${Math.round(MIN * 0.04)}px;line-height:1.2;">${esc(veiculo)}</div>
        </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
${fontHead()}
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;}
  body{overflow:hidden;background:${P.navy};}
  .stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;
    background:radial-gradient(circle,#5499B51f 1.5px,transparent 1.7px) 0 0/46px 46px,radial-gradient(128% 118% at 78% 6%, ${P.blue} 0%, ${P.navy} 45%, ${P.darker} 100%);}
  .circuit{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
</style>
</head>
<body>
  <div class="stage">
    <svg class="circuit" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${circuit}</svg>
    ${topbar}
    ${center}
    ${footer}
  </div>
</body>
</html>`;
}

function tplMediaSplit({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const land = width > height;
  const minDim = Math.min(width, height);
  const imgSrc = image ? resolveImage(image) : '';
  const hasHeadline = String(headline || '').trim().length > 0;
  const veiculo = String(eyebrow || '').split(/[·|]/)[0].trim();
  const domain = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\./, '');

  const logo = logoSrc(logoVariant, LOGO_LIGHT);
  const logoH = Math.round(minDim * 0.04);

  const padTop = Math.round(height * 0.12);
  const padBottom = Math.round(height * 0.135);
  const padSide = Math.round(width * 0.06);

  const barTopH = Math.round(minDim * 0.045);
  const barBotH = Math.round(minDim * 0.065);

  const p = PALETTE;

  const headlineSize = land ? Math.round(width * 0.036) : Math.round(width * 0.052);
  const eyebrowSize = Math.round(minDim * 0.02);
  const brandTagSize = Math.round(minDim * 0.026);
  const cardTextSize = Math.round(minDim * 0.028);
  const ctaTopSize = Math.round(minDim * 0.019);
  const ctaBotSize = Math.round(minDim * 0.024);

  const circuit = `
    <svg class="ckt" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${p.sky}" stroke-width="${Math.max(1, Math.round(minDim*0.0018))}" fill="none" opacity="0.12">
        <path d="M0 ${Math.round(height*0.22)} H ${Math.round(width*0.28)} V ${Math.round(height*0.34)} H ${Math.round(width*0.5)}"/>
        <path d="M ${width} ${Math.round(height*0.7)} H ${Math.round(width*0.7)} V ${Math.round(height*0.58)} H ${Math.round(width*0.5)}"/>
        <path d="M ${Math.round(width*0.14)} ${height} V ${Math.round(height*0.82)} H ${Math.round(width*0.34)}"/>
        <path d="M ${Math.round(width*0.86)} 0 V ${Math.round(height*0.16)} H ${Math.round(width*0.64)}"/>
      </g>
      <g fill="${p.sky}" opacity="0.12">
        <circle cx="${Math.round(width*0.28)}" cy="${Math.round(height*0.22)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.5)}" cy="${Math.round(height*0.34)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.7)}" cy="${Math.round(height*0.7)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.34)}" cy="${Math.round(height*0.82)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.64)}" cy="${Math.round(height*0.16)}" r="${Math.round(minDim*0.008)}"/>
      </g>
    </svg>`;

  const brandTop = `
    <div class="brand-top">
      <img class="logo" src="${escAttr(logo)}" alt="4Selet"/>
      <div class="brand-tag">
        <span class="bar-v"></span>
        <span><span class="b1">4Selet</span> <span class="b2">na mídia</span></span>
      </div>
    </div>`;

  const footer = `
    <div class="footer">
      ${veiculo ? `<div class="veic-card">${esc(veiculo)}</div>` : `<div></div>`}
      ${domain ? `<div class="cta">
        <div class="cta-txt">
          <div class="cta-top">Leia a matéria completa</div>
          <div class="cta-bot">${esc(domain)}</div>
        </div>
        <div class="cta-arrow">›</div>
      </div>` : `<div></div>`}
    </div>`;

  const deviceInner = imgSrc
    ? `<img class="shot" src="${escAttr(imgSrc)}" alt=""/>`
    : `<div class="shot shot-empty"></div>`;

  const device = `
    <div class="device">
      <div class="device-frame">${deviceInner}</div>
    </div>`;

  const textBlock = `
    <div class="text-block">
      <div class="eyebrow">${esc(String(eyebrow || veiculo || '').toUpperCase())}</div>
      ${hasHeadline ? `<h1 class="headline">${esc(headline)}</h1>` : ``}
    </div>`;

  const showText = hasHeadline;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${fontHead()}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${width}px;height:${height}px}
  .stage{position:relative;width:${width}px;height:${height}px;overflow:hidden;
    background:radial-gradient(circle,#5499B51f 1.5px,transparent 1.7px) 0 0/46px 46px,radial-gradient(128% 118% at 78% 6%, ${p.blue} 0%, ${p.navy} 45%, ${p.darker} 100%);
    font-family:'Inter',system-ui,sans-serif;color:#fff}
  .ckt{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .frame{position:absolute;inset:0;
    padding:${padTop}px ${padSide}px ${padBottom}px ${padSide}px;
    display:flex;flex-direction:column}
  .brand-top{position:absolute;top:${Math.round(height*0.045)}px;left:${padSide}px;right:${padSide}px;
    display:flex;align-items:center;justify-content:space-between}
  .logo{height:${logoH}px;width:auto;display:block}
  .brand-tag{display:flex;align-items:center;gap:${Math.round(minDim*0.014)}px;
    font-size:${brandTagSize}px;line-height:1}
  .bar-v{width:${Math.max(2,Math.round(minDim*0.004))}px;height:${Math.round(brandTagSize*1.1)}px;
    background:${p.sky};border-radius:2px;display:inline-block}
  .b1{font-weight:800;color:#fff}
  .b2{font-weight:700;color:${p.sky}}

  .content{flex:1;display:flex;min-height:0;
    ${land ? 'flex-direction:row;align-items:center;gap:'+Math.round(width*0.05)+'px'
           : 'flex-direction:column;align-items:stretch;gap:'+Math.round(height*0.045)+'px'}}

  .text-block{${land ? 'flex:1 1 44%;' : (showText ? 'flex:0 0 auto;' : 'display:none;')}
    display:flex;flex-direction:column;gap:${Math.round(minDim*0.022)}px;
    ${land ? '' : 'text-align:'+(land?'left':'left')+';'}}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-weight:500;color:${p.sky};
    font-size:${eyebrowSize}px;letter-spacing:${Math.round(eyebrowSize*0.14)}px;
    text-transform:uppercase;line-height:1.3;
    ${showText?'':'display:none'}}
  .headline{font-weight:800;color:#fff;font-size:${headlineSize}px;
    line-height:1.12;letter-spacing:-0.01em;
    text-wrap:balance}

  .device{${land ? 'flex:1 1 52%;' : 'flex:1 1 auto;min-height:0;'}
    display:flex;align-items:center;justify-content:center}
  .device-frame{position:relative;
    max-width:100%;max-height:100%;
    ${land ? 'height:'+Math.round(height*0.72)+'px;' : (showText? 'height:100%;' : 'height:100%;')}
    aspect-ratio:${land ? '4 / 3' : '4 / 3'};
    ${land ? '' : 'width:100%;'}
    border-radius:${Math.round(minDim*0.02)}px;
    background:${p.darker};
    padding:${Math.round(minDim*0.012)}px;
    box-shadow:0 ${Math.round(minDim*0.03)}px ${Math.round(minDim*0.06)}px rgba(0,0,0,.45),
      0 0 0 ${Math.max(1,Math.round(minDim*0.002))}px rgba(84,153,181,.35);
    transform:rotate(${land? -1.2 : -1}deg);
    overflow:hidden}
  .shot{width:100%;height:100%;display:block;object-fit:cover;object-position:top center;
    border-radius:${Math.round(minDim*0.012)}px}
  .shot-empty{background:linear-gradient(160deg,${p.navy},${p.darker})}

  .footer{position:absolute;bottom:${Math.round(height*0.05)}px;left:${padSide}px;right:${padSide}px;
    display:flex;align-items:center;justify-content:space-between;gap:${Math.round(width*0.03)}px}
  .veic-card{background:#fff;color:${p.navy};font-weight:800;
    font-size:${cardTextSize}px;line-height:1;
    padding:${Math.round(minDim*0.016)}px ${Math.round(minDim*0.028)}px;
    border-radius:${Math.round(minDim*0.02)}px;
    box-shadow:0 ${Math.round(minDim*0.006)}px ${Math.round(minDim*0.014)}px rgba(0,0,0,.25);
    max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cta{display:flex;align-items:center;gap:${Math.round(minDim*0.016)}px}
  .cta-txt{text-align:right;line-height:1.2}
  .cta-top{color:${p.cloud};font-size:${ctaTopSize}px;font-weight:500}
  .cta-bot{color:${p.sky};font-size:${ctaBotSize}px;font-weight:700}
  .cta-arrow{width:${Math.round(minDim*0.055)}px;height:${Math.round(minDim*0.055)}px;
    border:${Math.max(1,Math.round(minDim*0.003))}px solid ${p.sky};border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    color:${p.sky};font-size:${Math.round(minDim*0.036)}px;font-weight:700;
    line-height:0;padding-bottom:${Math.round(minDim*0.004)}px}
</style></head>
<body>
  <div class="stage">
    ${circuit}
    ${brandTop}
    <div class="frame">
      <div class="content">
        ${land ? textBlock + device : textBlock + device}
      </div>
    </div>
    ${footer}
  </div>
</body></html>`;
}

function tplMediaSelo({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const r = Math.round;
  const land = width > height;
  const mn = Math.min(width, height);
  const img = resolveImage(image);
  const shot = img ? `<img src="${escAttr(img)}" alt=""/>` : `<div class="scr-empty">print da matéria</div>`;
  const veh = String(eyebrow || "").split(/[·|]/)[0].trim();
  const domain = (String(url || "").match(/^https?:\/\/([^/]+)/) || [, ""])[1].replace(/^www\./, "");

  // area segura: topo ~12% / rodape ~13.5% / lateral ~6%
  const px = r(width * 0.06);
  const topSafe = r(height * 0.12);
  const botSafe = r(height * 0.135);
  const availH = height - topSafe - botSafe;
  const availW = width - px * 2;

  // CARD do print: retangulo reto, moldura fina. Retrato ~4:5, paisagem ~4:3 e menor (deixa ar).
  let cardW, cardH;
  if (land) {
    cardH = r(Math.min(availH * 0.9, availW * 0.5 * (5 / 4)));
    cardW = r(cardH * (4 / 5));
    if (cardW > availW * 0.52) { cardW = r(availW * 0.52); cardH = r(cardW * (5 / 4)); }
  } else {
    cardW = r(Math.min(availW * 0.82, availH * (4 / 5)));
    cardH = r(cardW * (5 / 4));
    if (cardH > availH * 0.94) { cardH = r(availH * 0.94); cardW = r(cardH * (4 / 5)); }
  }
  const cardRad = r(cardW * 0.045);
  const frame = Math.max(6, r(cardW * 0.022));
  const innerRad = Math.max(6, cardRad - frame);

  // SELO simples: badge circular com o SÍMBOLO "4" da marca — sem texto curvo
  // (o texto em arco cortava e ficava ilegível). Referência limpa ao logo 4Selet.
  const sealD = r(mn * (land ? 0.115 : 0.14));
  const ring = Math.max(2, r(sealD * 0.028));
  const cx = sealD / 2, cy = sealD / 2;
  const seal = `<div class="seal" style="width:${sealD}px;height:${sealD}px">
      <svg viewBox="0 0 ${sealD} ${sealD}" width="${sealD}" height="${sealD}">
        <circle cx="${cx}" cy="${cy}" r="${r(sealD / 2 - ring)}" fill="${PALETTE.darker}" stroke="${PALETTE.sky}" stroke-width="${ring}"/>
        <circle cx="${cx}" cy="${cy}" r="${r(sealD / 2 - ring * 3.2)}" fill="none" stroke="${PALETTE.sky}" stroke-width="1.5" opacity="0.4"/>
      </svg>
      <img class="seal-sym" src="${SIMBOLO_SELO}" alt="4Selet"/>
    </div>`;

  // grafismo de circuito
  const tech = `<svg class="tech" viewBox="0 0 ${width} ${height}" fill="none" preserveAspectRatio="xMidYMid slice">
    <g stroke="${PALETTE.sky}" stroke-width="1" opacity="0.12">
      <path d="M-20 ${r(height * .26)} H${r(width * .13)} V${r(height * .32)} H${r(width * .22)}"/>
      <path d="M${width + 20} ${r(height * .28)} H${r(width * .87)} V${r(height * .22)}"/>
      <path d="M-20 ${r(height * .74)} H${r(width * .16)} V${r(height * .68)}"/>
      <path d="M${width + 20} ${r(height * .72)} H${r(width * .84)} V${r(height * .78)} H${r(width * .69)}"/>
    </g>
    <g fill="${PALETTE.sky}" opacity="0.42">
      <circle cx="${r(width * .22)}" cy="${r(height * .32)}" r="3"/><circle cx="${r(width * .87)}" cy="${r(height * .22)}" r="3"/>
      <circle cx="${r(width * .16)}" cy="${r(height * .68)}" r="3"/><circle cx="${r(width * .69)}" cy="${r(height * .78)}" r="3"/>
    </g></svg>`;

  const logoH = r(mn * 0.04);
  const kickFont = r(mn * 0.028);
  const cardFont = r(mn * 0.024);
  const ctaFont = r(mn * 0.022);

  const topbar = `<div class="topbar" style="top:${r(height * 0.055)}px;left:${px}px;right:${px}px">
      <img class="logo4" src="${logoSrc(logoVariant, LOGO_LIGHT)}" alt="4Selet"/>
      <div class="kicker"><b>4Selet</b><i>na mídia</i><span class="kbar"></span></div></div>`;
  const botbar = `<div class="botbar" style="bottom:${r(height * 0.05)}px;left:${px}px;right:${px}px">
      ${veh ? `<div class="veic-card">${esc(veh)}</div>` : "<span></span>"}
      ${domain ? `<div class="cta"><div class="cta-txt"><div class="cta-l">Leia a matéria completa</div><div class="cta-u">${esc(domain)}</div></div><div class="cta-arrow">&#8250;</div></div>` : "<span></span>"}</div>`;

  const stage = `<div class="stage">
      <div class="card-wrap" style="width:${cardW}px">
        <div class="mshot" style="width:${cardW}px;height:${cardH}px;border-radius:${cardRad}px;padding:${frame}px">
          <div class="screen" style="border-radius:${innerRad}px">${shot}<div class="glass"></div></div>
        </div>
        ${seal}
      </div>
    </div>`;

  const css = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${width}px;height:${height}px}
    .card{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(circle,#5499B51f 1.5px,transparent 1.7px) 0 0/46px 46px,radial-gradient(128% 118% at 78% 6%, ${PALETTE.blue} 0%, ${PALETTE.navy} 45%, ${PALETTE.darker} 100%);color:${PALETTE.cloud};font-family:'Inter',sans-serif}
    .tech{position:absolute;inset:0;z-index:1;pointer-events:none}
    .vig{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(140% 92% at 50% 116%, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 55%),radial-gradient(120% 80% at 50% -18%, rgba(84,153,181,.12) 0%, rgba(0,0,0,0) 60%)}
    .topbar{position:absolute;display:flex;align-items:center;justify-content:space-between;z-index:6}
    .logo4{height:${logoH}px;display:block;opacity:.98}
    .kicker{display:flex;align-items:center;font-size:${kickFont}px;color:#fff}
    .kicker b{font-weight:800;color:#fff}.kicker i{font-style:normal;font-weight:700;color:${PALETTE.sky};margin-left:${r(kickFont * 0.28)}px}
    .kicker .kbar{width:2px;height:${r(kickFont * 1.15)}px;background:${PALETTE.sky};margin-left:${r(kickFont * 0.5)}px;border-radius:2px}
    .stage{position:absolute;left:${px}px;right:${px}px;top:${topSafe}px;height:${availH}px;display:flex;align-items:center;justify-content:center;z-index:3}
    .card-wrap{position:relative}
    .mshot{position:relative;background:linear-gradient(150deg,#fdfefe,#e7edf0);box-shadow:0 40px 90px -22px rgba(0,0,0,.7),0 16px 40px -16px rgba(0,0,0,.55),0 0 0 1px rgba(84,153,181,.2)}
    .screen{position:relative;width:100%;height:100%;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(7,33,43,.12) inset}
    .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
    .scr-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9fb0b8;font-size:${r(cardW * 0.06)}px;background:repeating-linear-gradient(45deg,#eef2f4,#eef2f4 20px,#e6ebee 20px,#e6ebee 40px)}
    .glass{position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,.04) 16%, rgba(255,255,255,0) 34%)}
    .seal{position:absolute;bottom:${r(-sealD * 0.16)}px;right:${r(-sealD * 0.12)}px;z-index:5;filter:drop-shadow(0 14px 26px rgba(0,0,0,.5))}
    .seal svg{display:block}
    .seal-sym{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${r(sealD * 0.46)}px;height:auto;display:block}
    .botbar{position:absolute;display:flex;align-items:flex-end;justify-content:space-between;z-index:6;gap:16px}
    .veic-card{background:#fff;border-radius:${r(cardFont * 0.85)}px;padding:${r(cardFont * 0.72)}px ${r(cardFont * 1.25)}px;color:${PALETTE.navy};font-weight:800;font-size:${cardFont}px;letter-spacing:-.3px;box-shadow:0 12px 26px -8px rgba(0,0,0,.5);max-width:52%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cta{display:flex;align-items:center;gap:${r(ctaFont * 0.7)}px}
    .cta-txt{text-align:right;line-height:1.18}
    .cta-l{color:${PALETTE.cloud};font-size:${ctaFont}px;font-weight:500}
    .cta-u{color:${PALETTE.sky};font-size:${r(ctaFont * 1.02)}px;font-weight:700}
    .cta-arrow{width:${r(ctaFont * 1.95)}px;height:${r(ctaFont * 1.95)}px;border-radius:50%;border:2px solid ${PALETTE.sky};color:${PALETTE.sky};display:flex;align-items:center;justify-content:center;font-size:${r(ctaFont * 1.35)}px;font-weight:700;line-height:1}`;

  const body = `${tech}<div class="vig"></div>${topbar}${stage}${botbar}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}<style>${css}</style></head><body><div class="card">${body}</div></body></html>`;
}

function tplMediaCamadas({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const W = width, H = height;
  const land = W > H;
  const mn = Math.min(W, H);
  const dom = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\./, '');
  const veiculo = String(eyebrow || '').split(/[·|]/)[0].trim();
  const brandTop = String(eyebrow || '').trim();
  const src = image ? resolveImage(image) : '';
  const logo = logoSrc(logoVariant, LOGO_LIGHT);

  const P = PALETTE;
  const pad = Math.round(mn * 0.06);
  const topH = Math.round(H * 0.12);
  const botH = Math.round(H * 0.135);
  const safeTop = topH;
  const safeBot = botH;
  const safeH = H - safeTop - safeBot;
  const safeW = W - pad * 2;

  const logoH = Math.round(mn * 0.04);
  const eyebrowFont = Math.round(mn * 0.018);
  const brandFont = Math.round(mn * 0.026);
  const veicFont = Math.round(mn * 0.026);
  const ctaTopFont = Math.round(mn * 0.016);
  const ctaDomFont = Math.round(mn * 0.021);
  const arrowR = Math.round(mn * 0.032);

  // ---- área central: camadas ----
  // Em paisagem: texto à esquerda, camadas à direita.
  // Em retrato: camadas ocupam a área segura central.
  let stageW, stageH, stageLeft, stageTop, textBlock = '';

  if (land) {
    const colGap = Math.round(safeW * 0.05);
    const textW = Math.round(safeW * 0.42);
    stageW = safeW - textW - colGap;
    stageH = safeH;
    stageLeft = pad + textW + colGap;
    stageTop = safeTop;

    const kFont = Math.round(mn * 0.052);
    if (headline) {
      textBlock = `
      <div style="position:absolute;left:${pad}px;top:${safeTop}px;width:${textW}px;height:${safeH}px;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:${eyebrowFont}px;letter-spacing:.18em;text-transform:uppercase;color:${P.sky};margin-bottom:${Math.round(mn*0.024)}px;">Na imprensa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:800;font-size:${kFont}px;line-height:1.08;color:#fff;letter-spacing:-.01em;">${esc(headline)}</div>
        <div style="width:${Math.round(mn*0.09)}px;height:${Math.round(mn*0.006)}px;background:${P.sky};border-radius:99px;margin-top:${Math.round(mn*0.03)}px;"></div>
      </div>`;
    } else {
      textBlock = `
      <div style="position:absolute;left:${pad}px;top:${safeTop}px;width:${textW}px;height:${safeH}px;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:${eyebrowFont}px;letter-spacing:.18em;text-transform:uppercase;color:${P.sky};margin-bottom:${Math.round(mn*0.028)}px;">Na imprensa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:800;font-size:${Math.round(mn*0.06)}px;line-height:1.05;color:#fff;letter-spacing:-.01em;">Cobertura<br/>na imprensa</div>
        <div style="width:${Math.round(mn*0.09)}px;height:${Math.round(mn*0.006)}px;background:${P.sky};border-radius:99px;margin-top:${Math.round(mn*0.03)}px;"></div>
      </div>`;
    }
  } else {
    stageW = safeW;
    stageH = safeH;
    stageLeft = pad;
    stageTop = safeTop;
  }

  // Card ÚNICO da matéria: mostra o print completo, reto, sem cortar nem duplicar.
  // (Antes eram dois cards sobrepostos — o de trás deixava a manchete "vazar".)
  const radius = Math.round(mn * 0.022);
  const frontBorder = Math.max(2, Math.round(mn * 0.004));
  let cardH = Math.round(stageH * (land ? 0.92 : 0.99));
  let cardW = Math.round(cardH * 0.75); // 3:4 = proporção do print da matéria
  const maxCardW = Math.round(stageW * (land ? 0.98 : 0.92));
  if (cardW > maxCardW) { cardW = maxCardW; cardH = Math.round(cardW / 0.75); }
  const cardLeft = Math.round(stageLeft + (stageW - cardW) / 2);
  const cardTop = Math.round(stageTop + (stageH - cardH) / 2);

  const imgStyle = `width:100%;height:100%;object-fit:cover;object-position:top center;display:block;`;
  const cardInner = src
    ? `<img src="${escAttr(src)}" style="${imgStyle}"/>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${P.navy};color:${P.mist};font-family:'Inter',sans-serif;font-weight:700;font-size:${Math.round(mn*0.03)}px;">print da matéria</div>`;

  const camadas = `
    <div style="position:absolute;left:${cardLeft}px;top:${cardTop}px;width:${cardW}px;height:${cardH}px;border-radius:${radius}px;overflow:hidden;border:${frontBorder}px solid rgba(255,255,255,.92);box-shadow:0 ${Math.round(mn*0.03)}px ${Math.round(mn*0.075)}px -${Math.round(mn*0.02)}px rgba(0,0,0,.6),0 0 0 1px rgba(84,153,181,.18);background:#fff;">
      ${cardInner}
    </div>`;

  // ---- barra vertical + brand topo-direita ----
  const brandBar = `<span style="display:inline-block;width:${Math.max(2,Math.round(mn*0.004))}px;height:${brandFont}px;background:${P.sky};border-radius:99px;margin-right:${Math.round(mn*0.014)}px;"></span>`;

  // ---- rodapé direita (CTA) ----
  const ctaBlock = dom ? `
    <div style="position:absolute;right:${pad}px;bottom:${Math.round(botH*0.28)}px;display:flex;align-items:center;gap:${Math.round(mn*0.016)}px;">
      <div style="text-align:right;">
        <div style="font-family:'Inter',sans-serif;font-weight:500;font-size:${ctaTopFont}px;color:${P.cloud};letter-spacing:.01em;">Leia a matéria completa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:${ctaDomFont}px;color:${P.sky};letter-spacing:.01em;">${esc(dom)}</div>
      </div>
      <div style="width:${arrowR*2}px;height:${arrowR*2}px;border-radius:99px;border:${Math.max(2,Math.round(mn*0.0035))}px solid ${P.sky};display:flex;align-items:center;justify-content:center;color:${P.sky};font-family:'Inter',sans-serif;font-weight:700;font-size:${Math.round(arrowR*1.3)}px;line-height:1;">›</div>
    </div>` : '';

  // ---- grafismo de circuito ----
  const circuit = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;opacity:.12;" preserveAspectRatio="none">
      <g stroke="${P.sky}" stroke-width="${Math.max(1,Math.round(mn*0.0016))}" fill="none">
        <path d="M0 ${Math.round(H*0.2)} H ${Math.round(W*0.28)} V ${Math.round(H*0.34)} H ${Math.round(W*0.4)}"/>
        <path d="M${W} ${Math.round(H*0.62)} H ${Math.round(W*0.7)} V ${Math.round(H*0.5)} H ${Math.round(W*0.58)}"/>
        <path d="M${Math.round(W*0.12)} ${H} V ${Math.round(H*0.78)} H ${Math.round(W*0.26)}"/>
        <path d="M${Math.round(W*0.88)} 0 V ${Math.round(H*0.16)} H ${Math.round(W*0.74)}"/>
      </g>
      <g fill="${P.sky}">
        <circle cx="${Math.round(W*0.28)}" cy="${Math.round(H*0.2)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.4)}" cy="${Math.round(H*0.34)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.7)}" cy="${Math.round(H*0.62)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.58)}" cy="${Math.round(H*0.5)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.26)}" cy="${Math.round(H*0.78)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.74)}" cy="${Math.round(H*0.16)}" r="${Math.round(mn*0.006)}"/>
      </g>
    </svg>`;

  // molduras de tecnologia nos cantos (frame Selet — referência do Hugo)
  const bt = Math.max(2, Math.round(mn * 0.0032));
  const bR = Math.round(mn * 0.03);
  const bW = Math.round(W * 0.24), bH = Math.round(H * 0.13);
  const boff = Math.round(mn * 0.085);
  const corner = (s) => `<div style="position:absolute;${s}width:${bW}px;height:${bH}px;border:${bt}px solid ${P.sky};border-radius:${bR}px;opacity:.18;pointer-events:none;"></div>`;
  const brackets =
    corner(`left:${-boff}px;top:${Math.round(topH * 0.5)}px;`) +
    corner(`right:${-boff}px;top:${Math.round(topH * 0.5)}px;`) +
    corner(`left:${-boff}px;top:${Math.round(H * 0.44)}px;`) +
    corner(`right:${-boff}px;top:${Math.round(H * 0.44)}px;`) +
    corner(`left:${-boff}px;bottom:${Math.round(botH * 0.5)}px;`) +
    corner(`right:${-boff}px;bottom:${Math.round(botH * 0.5)}px;`);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${fontHead()}
  <style>*{margin:0;padding:0;box-sizing:border-box;}</style></head>
  <body style="margin:0;">
    <div class="card" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(circle,#5499B51f 1.5px,transparent 1.7px) 0 0/46px 46px,radial-gradient(128% 118% at 78% 6%, ${P.blue} 0%, ${P.navy} 45%, ${P.darker} 100%);font-family:'Inter',sans-serif;">
      ${circuit}
      ${brackets}

      <div style="position:absolute;left:50%;top:${Math.round(topH*0.16)}px;transform:translateX(-50%);width:${Math.round(W*0.46)}px;height:${Math.round(topH*0.62)}px;border:${bt}px solid rgba(84,153,181,.55);border-radius:${bR}px;display:flex;align-items:center;justify-content:center;">
        <img src="${escAttr(logo)}" style="height:${logoH}px;display:block;"/>
      </div>

      <div style="position:absolute;right:${pad}px;top:${Math.round(topH*0.34)}px;display:flex;align-items:center;height:${logoH}px;">
        ${brandBar}
        <span style="font-family:'Inter',sans-serif;font-size:${brandFont}px;line-height:1;">
          <span style="font-weight:800;color:#fff;">4Selet</span> <span style="font-weight:700;color:${P.sky};">na mídia</span>
        </span>
      </div>

      ${textBlock}
      ${camadas}

      <div style="position:absolute;left:${pad}px;bottom:${Math.round(botH*0.28)}px;background:#fff;border-radius:${Math.round(mn*0.014)}px;padding:${Math.round(mn*0.014)}px ${Math.round(mn*0.024)}px;box-shadow:0 ${Math.round(mn*0.008)}px ${Math.round(mn*0.02)}px rgba(0,0,0,.35);max-width:${Math.round(W*0.45)}px;">
        <span style="font-family:'Inter',sans-serif;font-weight:800;font-size:${veicFont}px;color:${P.navy};letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${esc(veiculo)}</span>
      </div>

      ${ctaBlock}
    </div>
  </body></html>`;
}

function tplMedia({ width, height, image, url, eyebrow, headline, model, logo: logoVariant }) {
  const land = width > height;
  if (model === "hand_tablet" || model === "celular") return tplMediaTabletClean({ width, height, image, eyebrow, url, model, logo: logoVariant });
  // foto_real / foto_mesa: mockups FOTOGRAFICOS — a materia e encaixada na tela do
  // tablet da foto por homografia (perspectiva real, materia reta).
  if (model === "foto_real") return tplMediaFotoReal({ width, height, image, eyebrow, url, headline, logo: logoVariant, scene: "maos" });
  if (model === "foto_mesa") return tplMediaFotoReal({ width, height, image, eyebrow, url, headline, logo: logoVariant, scene: "mesa" });
  if (model === "foto_maos_mesa") return tplMediaFotoReal({ width, height, image, eyebrow, url, headline, logo: logoVariant, scene: "maos_mesa" });
  const LAYOUTS = { navegador: tplMediaNavegador, citacao: tplMediaCitacao, split: tplMediaSplit, selo: tplMediaSelo, camadas: tplMediaCamadas };
  if (LAYOUTS[model]) return LAYOUTS[model]({ width, height, image, eyebrow, url, headline, logo: logoVariant });
  const dev = mediaDevice(model || "tablet", resolveImage(image), url);
  const veic = eyebrow ? `<div class="veic">${esc(eyebrow)}</div>` : "";
  const title = `<div class="ttl">4Selet <span class="a">na mídia</span></div>`;
  const logo = `<img class="logo" src="${logoSrc(logoVariant, LOGO_LIGHT)}" alt="4Selet"/>`;
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
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}<style>${common}</style></head><body><div class="card">${body}</div></body></html>`;
}

const TEMPLATES = { editorial: tplEditorial, bold: tplBold, split: tplSplit, photo: tplPhoto };
const TEMPLATE_IDS = Object.keys(TEMPLATES);
function resolveTemplate(id) { return TEMPLATES[id] || tplEditorial; }

// Persistencia leve da escolha de template por task (render.json na raiz).
// Permite que "Re-renderizar" e a reabertura mantenham o layout escolhido.
// Variantes por peça (além do template): logo e marca d'água. "" = padrão do estilo.
const LOGO_IDS = ["light", "dark", "symbol"];
const WATERMARK_IDS = ["word", "symbol", "outline", "none", "canto", "padrao"];
function readRenderJson(loc) { return readJson(path.join(loc.path, "render.json")) || {}; }
function readRenderPref(loc) {
  const j = readRenderJson(loc);
  if (typeof j.template !== "string") return null;
  // Aceita tanto os 4 templates de arte quanto os arquetipos que valem como peca unica. Antes so
  // aceitava os 4, entao o `writeRenderPref({template: arq})` do renderImage era codigo morto: a
  // peca era re-derivada do dado a cada render e podia trocar de cara sozinha ao editar o texto.
  if (TEMPLATES[j.template]) return j.template;
  if (SLIDE_ARCHETYPES[j.template] && ARQ_PECA.indexOf(j.template) >= 0) return j.template;
  return null;
}
function readLogoPref(loc) { const v = readRenderJson(loc).logo; return LOGO_IDS.indexOf(v) >= 0 ? v : null; }
function readFontPref(loc) { const v = readRenderJson(loc).font; return FAMILIA_IDS.indexOf(v) >= 0 ? v : ""; }
// Qual paleta a peça herda da campanha à qual está vinculada. Lê o arquivo da campanha direto (e
// não via lib/campaigns) para não criar dependência circular: campanhas não sabem de render.
function paletaDaCampanha(loc) {
  try {
    const st = readJson(path.join(loc.path, "status.json")) || {};
    if (!st.campaign_id) return null;
    const c = readJson(path.join(PATHS.CAMPAIGNS_DIR, String(st.campaign_id) + ".json"));
    const id = c && c.palette;
    return (PALETA_IDS.indexOf(id) >= 0 && PALETAS_CAMPANHA[id].cores) ? PALETAS_CAMPANHA[id].cores : null;
  } catch (e) { return null; }
}
// Mesma regra do logo/marca d'água: "auto" volta para a identidade; escolha válida manda e fica.
function pickFont(loc, requested) {
  if (requested === "auto" || requested === "") { deleteRenderPref(loc, "font"); return ""; }
  const ok = FAMILIA_IDS.indexOf(requested) >= 0;
  if (ok) writeRenderPref(loc, { font: requested });
  return ok ? requested : readFontPref(loc);
}
function readWatermarkPref(loc) { const v = readRenderJson(loc).watermark; return WATERMARK_IDS.indexOf(v) >= 0 ? v : null; }
// MERGE (não sobrescreve): guardar template NÃO pode apagar logo/watermark, e vice-versa.
function writeRenderPref(loc, patch) {
  if (!patch || typeof patch !== "object") return;
  try {
    const p = path.join(loc.path, "render.json");
    const cur = readJson(p) || {};
    // "image" entra aqui porque a peça de FEED não tem onde guardar a foto: o arquivo dela é um
    // .txt puro. A foto escolhida aparecia na prévia e sumia ao salvar — render.json é o lugar
    // certo, é a mesma família de template/logo/marca d'água (preferência de arte da peça).
    ["template", "logo", "watermark", "image", "font"].forEach((k) => { if (patch[k] != null && patch[k] !== "") cur[k] = patch[k]; });
    fs.writeFileSync(p, JSON.stringify(cur, null, 2) + "\n", "utf8");
  } catch (e) {}
}
// Decide o template efetivo: opcao da request > preferencia salva > editorial.
// Rotacao deterministica do estilo da arte. A tela oferece "Automático (varia por peça)" desde
// sempre, e ate aqui isso era falso: sem preferencia salva, TODA peca caia em "editorial" — medido,
// 24 de 43 pecas do acervo. Pior, a conta que varia existia no front e rodava so na PREVIA, entao a
// arte aprovada na previa nao era a arte salva.
//
// A decisao vem para o servidor e passa a ser uma so. Ordem:
//   1. o que a pessoa escolheu na tela (sempre vence);
//   2. o que ja foi gravado no render.json — e por isso re-renderizar NUNCA muda a cara da peca;
//   3. "photo", se a peca tem foto (o unico template que desenha a imagem);
//   4. hash do nome da pasta sobre os demais.
//
// O `layout_type` que o modelo emite NAO entra na cascata de proposito: medido em 9 geracoes reais,
// ele escolheu editorial 5 e bold 4, e nunca split ou photo. Como editorial e bold sao o mesmo
// desenho com alinhamento diferente, obedecer o modelo daria cara-ou-coroa entre dois irmaos em vez
// de rotacao. O hash cobre os tres.
const TEMPLATES_ROTACAO = ["editorial", "bold", "split"];
// FNV-1a com finalizador de avalanche. O hash antigo (h*31+c) NÃO servia para módulo 3: como 31 e 1
// mod 3, o resto virava praticamente a soma dos caracteres, então nomes parecidos caíam sempre no
// mesmo estilo e os nomes reais do acervo distribuíam 5-1-2 em vez de perto de 3-3-2. Medido.
// Se mexer aqui, mexer TAMBÉM em autoVariant (public/js/app.js) — as duas contas têm que bater,
// senão o rádio da tela mostra um estilo e a arte sai com outro.
function hashDoNome(s) {
  s = String(s || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
function pickTemplate(loc, requested, extra) {
  const pedido = (requested && TEMPLATES[requested]) ? requested : null;
  let id = pedido || readRenderPref(loc);
  if (!id) {
    id = (extra && extra.temFoto && TEMPLATES.photo)
      ? "photo"
      : TEMPLATES_ROTACAO[hashDoNome(path.basename(loc.path)) % TEMPLATES_ROTACAO.length];
    writeRenderPref(loc, { template: id });   // grava na PRIMEIRA vez: a peça não muda de cara depois
  }
  if (pedido) writeRenderPref(loc, { template: pedido });
  return { id, build: resolveTemplate(id) };
}
// Remove uma chave do render.json (usado pra "voltar ao padrão do estilo").
function deleteRenderPref(loc, key) {
  try {
    const p = path.join(loc.path, "render.json");
    const cur = readJson(p); if (!cur || !(key in cur)) return;
    delete cur[key];
    fs.writeFileSync(p, JSON.stringify(cur, null, 2) + "\n", "utf8");
  } catch (e) {}
}
// Logo/marca d'água efetivos: "auto" LIMPA a escolha (volta ao padrão); request válida > pref salva > "".
function pickLogo(loc, requested) {
  if (requested === "auto") { deleteRenderPref(loc, "logo"); return ""; }
  const ok = LOGO_IDS.indexOf(requested) >= 0;
  if (ok) writeRenderPref(loc, { logo: requested });
  return ok ? requested : (readLogoPref(loc) || "");
}
function pickWatermark(loc, requested) {
  if (requested === "auto") { deleteRenderPref(loc, "watermark"); return ""; }
  const ok = WATERMARK_IDS.indexOf(requested) >= 0;
  if (ok) writeRenderPref(loc, { watermark: requested });
  return ok ? requested : (readWatermarkPref(loc) || "");
}
// Resolve a src do logo pela variante escolhida na peça; "" mantém o padrão do template (fallback).
function logoSrc(variant, fallback) {
  const v = String(variant || "").toLowerCase();
  if (v === "light") return LOGO_LIGHT;   // wordmark completo (fundo escuro)
  if (v === "dark") return LOGO_DARK;     // wordmark completo (fundo claro)
  if (v === "symbol") return SIMBOLO_SELO; // só o selo "4" (opção "Só o símbolo" na peça)
  // PADRAO da arte = LOGO COMPLETO "4Selet" (wordmark). O selo "4" só quando a peça escolhe "symbol".
  return fallback || LOGO_LIGHT;
}

// Destaca numeros/percentuais no headline (ex.: "0%", "R$ 1,99", "D+10") e permite
// realce MANUAL de palavra com o marcador ==palavra== (azul + sublinhado da marca).
// Ordem importa: numeros primeiro (o marcador nao tem digito), depois o marcador —
// assim os digitos do proprio estilo inline (0.07em) nunca sao confundidos com valor.
function highlightHeadline(text) {
  const HL = "color:" + PALETTE.sky + ";font-weight:800;text-decoration:underline;"
    + "text-decoration-color:" + PALETTE.sky + ";text-decoration-thickness:0.07em;text-underline-offset:0.14em;";
  // ::palavra:: = marca-texto (fundo azul translúcido atrás da palavra). É o recurso de hierarquia
  // mais usado na fase atual do perfil real, e o painel só tinha o sublinhado. Fica DEPOIS do
  // sublinhado na ordem para os dois poderem conviver na mesma frase.
  const MK = "background:" + PALETTE.blue + "33;padding:0 .14em;border-radius:.12em;";
  return esc(text)
    .replace(/(?<![A-Za-zÀ-ÿ])(\d+[%.,]?\d*\s*%?|R\$\s?\d[\d.,]*|D\+\d+)(?![A-Za-zÀ-ÿ])/g, '<span class="accent">$1</span>')
    .replace(/==(.+?)==/g, '<span style="' + HL + '">$1</span>')
    .replace(/::(.+?)::/g, '<span class="mark" style="' + MK + '">$1</span>');
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
  if (style === "canto") {
    // símbolo pequeno e discreto no canto inferior direito — assinatura leve (z-index:0 = atrás do conteúdo)
    return '<img src="' + SIMBOLO + '" alt="" style="position:absolute;bottom:56px;right:56px;'
      + "width:92px;height:auto;z-index:0;pointer-events:none;opacity:" + Math.min(op + 0.22, 0.6) + ';" />';
  }
  if (style === "padrao" || style === "tile") {
    // símbolo repetido em padrão sutil cobrindo o fundo
    return '<div style="position:absolute;inset:0;z-index:0;pointer-events:none;opacity:'
      + Math.min(op + 0.03, 0.1) + ";background-image:url('" + SIMBOLO + "');background-repeat:repeat;background-size:160px 160px;\"></div>";
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
    /* 92px, não 86. A margem segura da marca é 88-104px (platform_guidelines.md) e o carrossel era o
     único abaixo do piso — sobrava menos respiro lateral que em qualquer outro template, e num
     formato que o Instagram corta nas bordas. Conferido antes de mexer: os 5 layouts de slide
     (fluxo cheio, grade de 4 números, lista de 6 itens, texto longo e fecho) cabem em 86, 88, 92,
     96 e até 104 — então subir para dentro da faixa não aperta nada. */
  display:flex; flex-direction:column; padding:90px 92px; }
  .dots { position:absolute; inset:0; background-image:radial-gradient(${t.dotTex} 2px, transparent 2px); background-size:46px 46px; opacity:.5; }
  /* Foto de fundo opcional do slide (atras de tudo) + scrim de leitura acima dela. */
  .s-photo { position:absolute; inset:0; z-index:0; background-size:cover; background-position:center; }
  .s-scrim { position:absolute; inset:0; z-index:1; }
  .card.has-photo .dots { opacity:.16; z-index:1; }
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
  // ctx.watermark = spec do arquétipo (slideText/slideCta); senão a escolha da PEÇA (ctx.wmStyle) vale p/ todo slide.
  const wmSpec = ctx.watermark != null ? ctx.watermark : (ctx.wmStyle ? { style: ctx.wmStyle } : null);
  const wm = wmSpec ? watermark(wmSpec, ctx.theme) : "";
  // Foto de fundo do slide (opcional, por-slide): fica ATRAS do conteudo com um scrim que
  // preserva a leitura do texto. O scrim adapta a cor ao tema (escuro -> escurece; claro ->
  // clareia) pra o texto (claro no escuro / escuro no claro) continuar legivel sobre a foto.
  let photo = "";
  // Só desenha (e só escurece com o véu) se a foto existir de verdade — ver imagemExiste().
  const temFoto = ctx.image && imagemExiste(ctx.image);
  if (temFoto) {
    const scrim = ctx.theme === THEME_LIGHT
      ? "linear-gradient(180deg, rgba(224,228,222,.74) 0%, rgba(224,228,222,.56) 42%, rgba(224,228,222,.9) 100%)"
      : "linear-gradient(180deg, rgba(4,20,28,.64) 0%, rgba(4,20,28,.48) 42%, rgba(4,20,28,.88) 100%)";
    photo = `<div class="s-photo" style="background-image:url('${escAttr(resolveImage(ctx.image))}')"></div><div class="s-scrim" style="background:${scrim}"></div>`;
  }
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${fontHead()}
<style>${carBase(ctx.width, ctx.height, ctx.theme)}${extraCss || ""}</style></head>
<body><div class="card${temFoto ? " has-photo" : ""}">${photo}<div class="dots" style="background-position:${offX}px 0;"></div>${wm}${bodyInner}${dotsBar(ctx.n, ctx.total, ctx.theme)}</div></body></html>`;
}
function carTop(ctx) {
  const logo = logoSrc(ctx.logo, (ctx.theme && ctx.theme.logo) || LOGO_LIGHT);
  return `<div class="top"><img class="logo" src="${logo}" alt="4Selet"/></div>`;
}
// Rodape textual aposentado: a navegacao do carrossel agora e visual (dotsBar em carDoc).
function carFooter() { return ""; }

// Texto (desenvolvimento): titulo forte + paragrafo de apoio.
function slideText(slide, ctx) {
  const light = String(slide.theme || "").toLowerCase() === "light";
  ctx.theme = resolveTheme(slide.theme);
  // Marca d'agua editorial no slide de frase (default "SELET"; "" desliga).
  ctx.watermark = slide.watermark != null ? slide.watermark : (ctx.wmStyle ? { style: ctx.wmStyle } : "SELET");
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
    ${slide.body ? `<div class="s-body">${highlightHeadline(slide.body)}</div>` : ""}
  </div>`;
  return carDoc(ctx, css, inner);
}
// Grade de numeros (2x2): ate 4 cartoes valor + rotulo.
// Pílula de chamada para os arquétipos que NÃO tinham nenhuma. No carrossel isso não fazia falta —
// a chamada mora no slide de fecho. Mas quando um destes layouts vira uma PEÇA ÚNICA (imagem ou
// feed), não existe slide seguinte: sem isto, a chamada some sem aviso, e 7 dos 10 anúncios reais
// do acervo têm uma. Só desenha quando ctx.cta vem preenchido, então o carrossel não muda.
function pilulaCta(ctx) {
  const t = String((ctx && ctx.cta) || "").trim();
  return t ? '<div class="ac-cta">' + esc(t) + " &#8594;</div>" : "";
}
const CSS_PILULA_CTA = ".ac-cta { align-self:flex-start; margin-top:44px; font-weight:800; font-size:36px;"
  + " background:" + PALETTE.blue + "; color:#FFFFFF; padding:26px 48px; border-radius:999px; }";
// Quanto o conteúdo pesa no cartão, e quanto o desenho tem que ceder. Estes arquétipos nasceram para
// o slide de carrossel (1080x1350, sem rótulo e sem chamada). Como PEÇA ÚNICA eles perdem 270px de
// altura E ganham dois blocos — por isso o formato quadrado e cada extra entram na conta. Em vez de
// cortar item, número ou etapa em silêncio, a tipografia e o espaçamento cedem em dois níveis.
// Medido: sem isto, 6 itens longos estouravam 278px e 4 números de rótulo longo sobravam 28px de
// margem, contra os 88px que a marca exige (platform_guidelines.md).
function cargaSlide(slide, ctx, blocos, temApoio) {
  const quadrado = Number(ctx && ctx.height) > 0 && Number(ctx.height) < 1200;
  const extras = (temApoio && slide.body ? 1 : 0) + (slide.note ? 1 : 0) + (slide.eyebrow ? 1 : 0)
    + (String((ctx && ctx.cta) || "").trim() ? 1 : 0);
  // Título que quebra em duas linhas custa quase uma etapa/item a mais. Conta só o texto VISÍVEL
  // (os marcadores ==destaque== não ocupam espaço), e só a partir do ponto em que ele de fato quebra.
  const tituloLen = String(slide.title || "").replace(/==/g, "").length;
  return blocos + extras * 1.4 + (quadrado ? 1.6 : 0) + (tituloLen > 34 ? 0.8 : 0);
}
// Devolve v(folgado, compacto, mínimo): escolhe o valor conforme o nível de aperto.
function cede(carga, corte1, corte2) {
  const apertado = carga >= corte1;
  const muito = carga >= corte2;
  const v = (folgado, compacto, minimo) => (muito ? (minimo == null ? compacto : minimo) : apertado ? compacto : folgado);
  v.apertado = apertado;
  v.muito = muito;
  return v;
}
// Rótulo do topo e pílula de chamada só existem quando o arquétipo vira peça única — e juntos custam
// os ~30px por lado que empurravam a arte para cima da margem segura. Cedem junto com o resto.
function cssExtrasApertados(v) {
  return v.apertado
    ? ".eyebrow { font-size:" + v(30, 27, 24) + "px; margin-bottom:" + v(26, 16, 10) + "px; }"
      + ".ac-cta { margin-top:" + v(44, 32, 26) + "px; font-size:" + v(36, 34, 32) + "px; padding:" + v(26, 21, 18) + "px 44px; }"
    : "";
}
function slideStatGrid(slide, ctx) {
  const stats = (Array.isArray(slide.stats) ? slide.stats : []).slice(0, 4);
  // Tema é TINTA, não layout: resolvido aqui e nunca entra no roteador de arquétipo. O campo
  // `theme` já existia no schema e era jogado fora por quatro dos seis arquétipos — alternar claro
  // e escuro dentro do mesmo carrossel é o principal recurso de ritmo do perfil real.
  ctx.theme = resolveTheme(slide.theme);
  const light = ctx.theme === THEME_LIGHT;
  // Sem números: NÃO renderiza uma grade vazia (o slide ficava só com o título). Cai no layout
  // de texto p/ mostrar o conteúdo — o usuário pode escolher esse layout sem quebrar a peça.
  if (!stats.length) return slideText(slide, ctx);
  // UM número só não é grade: é um cartão solitário ocupando meia arte. Delega para o arquétipo do
  // número gigante mesmo quando a grade foi escolhida à mão — medido numa geração real, o modelo
  // pede "stat_grid" com um stat só e o desenho saía pobre.
  if (stats.length === 1) return slideNumero(slide, ctx);
  const cells = stats.map((s) => `<div class="stat"><div class="stat-v">${highlightHeadline(String(s.value == null ? "" : s.value))}</div><div class="stat-l">${esc(s.label || "")}</div></div>`).join("");
  // Rótulo longo vira duas linhas dentro do cartão: pesa quase como um número a mais.
  const longos = stats.filter((s) => String((s && s.label) || "").length > 22).length;
  const v = cede(cargaSlide(slide, ctx, stats.length + longos * 0.5, false), 9, 11.5);
  // Par de cores explícito. Os valores ESCUROS são exatamente os que já estavam aqui — nada de token
  // único: `.stat` usa blue+"55" e o `.accent` usa Sky, e um helper genérico mudaria peça escura já
  // publicada. O par claro nunca põe Mist sobre Cloud (1,4:1 de contraste — some).
  const c = light ? {
    cartao: PALETTE.cloud, borda: PALETTE.blue + "33", valor: PALETTE.darker,
    acento: PALETTE.blue, rotulo: PALETTE.navy,
  } : {
    cartao: PALETTE.navy, borda: PALETTE.blue + "55", valor: "#FFFFFF",
    acento: PALETTE.sky, rotulo: PALETTE.mist,
  };
  const css = `.s-title.sm { font-size:${v(60, 54, 48)}px; margin-bottom:${v(46, 32, 22)}px; line-height:1.04; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:${v(28, 22, 18)}px; }
    .stat { background:${c.cartao}; border:2px solid ${c.borda}; border-radius:28px; padding:${v(44, 34, 26)}px ${v(40, 34, 30)}px; }
    .stat-v { font-weight:900; font-size:${v(94, 80, 68)}px; line-height:1; color:${c.valor}; letter-spacing:-2px; }
    .stat-v .accent { color:${c.acento}; }
    .stat-l { margin-top:${v(16, 12, 9)}px; font-size:${v(33, 30, 27)}px; line-height:1.24; color:${c.rotulo}; }
    ${light ? `.s-title span { color:${PALETTE.blue} !important; text-decoration-color:${PALETTE.blue} !important; }` : ""}` + CSS_PILULA_CTA + cssExtrasApertados(v);
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    ${slide.title ? `<div class="s-title sm">${highlightHeadline(slide.title)}</div>` : ""}
    <div class="grid">${cells}</div>
    ${pilulaCta(ctx)}
  </div>
  ${carFooter(ctx)}`;
  return carDoc(ctx, css, inner);
}
// Lista com marcadores: titulo + itens com marcador Selet Blue.
function slideList(slide, ctx) {
  const items = (Array.isArray(slide.items) ? slide.items : []).slice(0, 6)
    .map((it) => (typeof it === "string" ? it : (it && it.text) || ""))
    .filter((t) => String(t || "").trim());
  ctx.theme = resolveTheme(slide.theme);
  const light = ctx.theme === THEME_LIGHT;
  // Sem itens: NÃO renderiza uma lista vazia. Cai no texto p/ mostrar o conteúdo do slide.
  if (!items.length) return slideText(slide, ctx);
  const lis = items.map((t) => `<div class="li"><span class="mk">&#9656;</span><span class="lt">${esc(t)}</span></div>`).join("");
  // Item longo quebra em duas linhas: pesa quase como um item a mais.
  const longos = items.filter((t) => String(t || "").length > 34).length;
  const v = cede(cargaSlide(slide, ctx, items.length + longos * 0.5, true), 10.5, 13.5);
  const c = light
    ? { marcador: PALETTE.blue, item: PALETTE.darker, apoio: PALETTE.navy }
    : { marcador: PALETTE.sky, item: PALETTE.cloud, apoio: PALETTE.mist };
  const css = `.s-title.sm { font-size:${v(64, 52, 48)}px; margin-bottom:${v(42, 24, 18)}px; line-height:1.04; }
    .list { display:flex; flex-direction:column; gap:${v(28, 15, 12)}px; }
    .li { display:flex; align-items:flex-start; gap:${v(24, 20, 18)}px; }
    .mk { color:${c.marcador}; font-size:${v(44, 35, 32)}px; line-height:1.1; font-weight:900; flex:0 0 auto; }
    .lt { font-size:${v(44, 34, 30)}px; line-height:1.28; color:${c.item}; font-weight:600; }
    .s-body { margin-top:${v(40, 22, 16)}px; font-size:${v(36, 29, 27)}px; line-height:1.3; color:${c.apoio}; }
    ${light ? `.s-title span, .s-body span { color:${PALETTE.blue} !important; text-decoration-color:${PALETTE.blue} !important; }` : ""}` + CSS_PILULA_CTA + cssExtrasApertados(v);
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    ${slide.title ? `<div class="s-title sm">${highlightHeadline(slide.title)}</div>` : ""}
    <div class="list">${lis}</div>
    ${slide.body ? `<div class="s-body">${highlightHeadline(slide.body)}</div>` : ""}
    ${pilulaCta(ctx)}
  </div>
  ${carFooter(ctx)}`;
  return carDoc(ctx, css, inner);
}
// Print DENTRO de um aparelho, como slide do carrossel (ou peça de Imagem).
//
// Existia um buraco constrangedor aqui: o Hugo pediu, num prompt detalhado, "uma captura real da
// plataforma dentro de um mockup de notebook ou janela de sistema" — e o painel entregou uma grade
// de números, calado. O desenho do notebook e o da janela de navegador JÁ EXISTIAM no código
// (mediaDevice), mas presos dentro da peça "4Selet na Mídia": nenhum caminho ligava um slide de
// carrossel a eles. Aqui o aparelho vira arquétipo de slide como qualquer outro, passando pelo
// mesmo carDoc (fundo, Selet Dots, logo, marca d'água) para não virar remendo visível no meio do
// carrossel.
//
// Sem véu por cima da tela e sem perspectiva, de propósito: o pedido dizia "não alterar os textos,
// números, proporções ou elementos reais da interface", e a lição de 29/07 sobre a matéria torta
// vale igual — warp entorta o print e derruba justamente esse requisito.
function slideDevice(slide, ctx) {
  const img = (slide && slide.image) || "";
  // Sem imagem de verdade, um aparelho vazio no meio do carrossel é pior que o layout de texto.
  if (!img || !imagemExiste(img)) return slideText(slide, ctx);
  const modelos = ["notebook", "janela", "celular", "tablet"];
  const model = modelos.indexOf(String(slide.device || "")) >= 0 ? slide.device : "notebook";
  // O carDoc desenha `ctx.image` como FOTO DE FUNDO do slide. Aqui a imagem é o conteúdo da TELA
  // do aparelho, não atmosfera — sem isto o print aparecia duas vezes: dentro do notebook e
  // gigante atrás dele, com o texto ilegível por cima. Medido na primeira montagem.
  ctx.image = "";
  const v = cede(cargaSlide(slide, ctx, 3, true), 4.6, 6.2);
  const css = ".s-title.sm { font-size:" + v(58, 50, 44) + "px; margin-bottom:" + v(30, 20, 14) + "px; line-height:1.04; }"
    + ".dev-wrap { display:flex; align-items:center; justify-content:center; flex:1; min-height:0; }"
    // O aparelho é desenhado em px fixos (herdados da peça de imprensa). O `zoom` encolhe o
    // conjunto inteiro para caber no slide sem reamostrar o print em sub-pixel, que é o que
    // amoleceria a captura — a mesma armadilha do backdrop-filter no lightbox.
    // O aparelho cresce quando o slide é leve. Medido na primeira captura de verdade (o dashboard
    // da 4Selet no notebook): com título curto e uma linha de apoio, sobrava vazio acima e abaixo e
    // o print — que é o CONTEÚDO do slide — saía pequeno demais para se ler no feed.
    // 0,95 é o teto: a base do notebook tem 928px e 928 × 0,95 = 882px, o que deixa 99px de margem
    // de cada lado, dentro da margem segura de 88–104px do platform_guidelines.md. Passar disso
    // encosta o aparelho na borda de corte do Instagram.
    + ".dev { zoom:" + v(0.95, 0.78, 0.66) + "; }"
    + ".dev .scr { overflow:hidden; background:#0d1317; }"
    + ".dev .scr img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }"
    + ".dev .scr-empty { display:flex; align-items:center; justify-content:center; height:100%; color:" + PALETTE.mist + "; font-size:26px; }"
    + ".dev-nota { margin-top:" + v(26, 18, 12) + "px; font-size:" + v(32, 29, 26) + "px; line-height:1.3; color:" + PALETTE.mist + "; }"
    + CSS_PILULA_CTA + cssExtrasApertados(v);
  const inner = carTop(ctx) + '<div class="mid">'
    + (slide.eyebrow ? '<div class="eyebrow">' + esc(slide.eyebrow) + "</div>" : "")
    + (slide.title ? '<div class="s-title sm">' + highlightHeadline(slide.title) + "</div>" : "")
    + '<div class="dev-wrap">' + mediaDevice(model, resolveImage(img), slide.url || "") + "</div>"
    + (slide.body ? '<div class="dev-nota">' + esc(slide.body) + "</div>" : "")
    + pilulaCta(ctx) + "</div>" + carFooter(ctx);
  return carDoc(ctx, css, inner);
}

// CTA de fechamento: centralizado, logo + headline + pilula de CTA.
function slideCta(slide, ctx) {
  const headline = slide.title || ctx.cta || "4Selet";
  const hl = highlightHeadline(headline);
  const n = headlineLen(hl);

  // Variante CLARA (editorial, alinhada a esquerda) — igual a referencia do usuario:
  // fundo Cloud, logo dark no topo-esquerda, headline display BOLD + enfase em Blue,
  // corpo (ex.: "Venha para a 4Selet...") no mesmo tratamento + marca d'agua "SELET".
  if (String(slide.theme || "").toLowerCase() === "light") {
    ctx.theme = THEME_LIGHT;
    ctx.watermark = slide.watermark != null ? slide.watermark : (ctx.wmStyle ? { style: ctx.wmStyle } : "SELET");
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
    <img class="logo-c" src="${logoSrc(ctx.logo, LOGO_LIGHT)}" alt="4Selet"/>
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    <div class="s-title big">${hl}</div>
    ${slide.body ? `<div class="s-body">${highlightHeadline(slide.body)}</div>` : ""}
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
  const nodes = (Array.isArray(slide.flow) ? slide.flow : []).slice(0, 4)
    .filter((nd) => String((typeof nd === "string" ? nd : (nd && nd.label)) || "").trim());
  // Sem etapas: NÃO desenha um diagrama vazio — saía um buraco no meio do slide, com o título em
  // cima e nada embaixo. Cai no texto, igual ao que stat_grid e list já faziam; o fluxo era o único
  // arquétipo sem essa rede, e é justamente o que a pessoa pode escolher no seletor sem ter os dados.
  if (!nodes.length) return slideText(slide, ctx);
  const accent = String(slide.tone || "").toLowerCase() === "accent";
  const line = accent ? PALETTE.blue : PALETTE.mist;
  const emph = accent ? PALETTE.sky : PALETTE.mist;
  const toneIcon = accent ? ICON_SHIELD : ICON_ALERT;
  const head = (slide.eyebrow ? '<div class="eyebrow">' + esc(slide.eyebrow) + "</div>" : "")
    + (slide.title ? '<div class="s-title sm">' + highlightHeadline(slide.title) + "</div>" : "");
  const note = slide.note
    ? '<div class="fnote"><span class="fnote-ic">' + toneIcon + "</span><span>" + esc(slide.note) + "</span></div>"
    : "";
  // A nota é emitida nos DOIS layouts (vertical e horizontal), mas o CSS dela só existia no
  // horizontal. No vertical o ícone é um SVG sem width/height, então sem regra ele esticava para a
  // largura toda: medido, a nota virava um bloco de 908x930px e empurrava o slide 661px para fora
  // do cartão — com 2 nós já estourava 292px. Agora a regra é uma só, usada pelos dois.
  const cssNota = ".fnote { margin-top:66px; display:flex; gap:22px; align-items:center; background:" + PALETTE.navy
    + "; border:2px solid " + (accent ? PALETTE.blue : PALETTE.mist) + "40; border-left-width:8px; border-radius:20px; padding:32px 36px; }"
    + ".fnote-ic { flex:0 0 auto; width:50px; height:50px; color:" + emph + "; display:flex; align-items:center; justify-content:center; }"
    + ".fnote-ic svg { width:50px; height:50px; }"
    + ".fnote span:last-child { font-size:33px; line-height:1.3; color:" + PALETTE.cloud + "; }";

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
      + cssNota + CSS_PILULA_CTA;
    const inner = carTop(ctx) + '<div class="mid">' + head
        + '<div class="frow">' + cells + "</div>" + note + pilulaCta(ctx) + "</div>" + carFooter(ctx);
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
  // O slide fica APERTADO quando junta muitas etapas com texto de apoio e/ou nota — o cartão tem
  // altura fixa e nada aqui encolhia. Em vez de cortar conteúdo em silêncio, o espaçamento e o
  // corpo da letra cedem um pouco. Medido: no pior caso (4 etapas longas + apoio + nota) isso é a
  // diferença entre estourar 190px e caber.
  // A pílula de chamada conta como bloco (ela só existe quando o fluxo vira uma PEÇA ÚNICA), e o
  // formato quadrado conta dobrado: 1080x1080 é 270px mais baixo que o 1080x1350 para o qual estes
  // arquétipos foram desenhados. Sem isso, o fluxo com 4 etapas mais chamada estourava 70px no
  // quadrado — medido.
  // Dois níveis, não um: no quadrado com 4 etapas e chamada, o primeiro nível economiza ~170px e
  // ainda faltavam 70. O segundo aperta mais um pouco em vez de cortar etapa do fluxo.
  const v = cede(cargaSlide(slide, ctx, nodes.length, true), 5.4, 7.0);
  const apertado = v.apertado;
  const css = ".s-title.sm { font-size:" + v(58, 52, 46) + "px; margin-bottom:" + v(40, 26, 18) + "px; line-height:1.04; }"
    + ".flow { display:flex; flex-direction:column; align-items:stretch; gap:" + v(16, 10, 8) + "px; }"
    + ".arrow { text-align:center; font-size:" + v(50, 40, 32) + "px; line-height:0.6; color:" + line + "; font-weight:700; }"
    + ".node { display:flex; align-items:center; gap:26px; background:" + PALETTE.navy + "; border:2px solid " + PALETTE.blue + "40; border-radius:26px; padding:" + v(34, 24, 16) + "px 40px; }"
    + ".node-hi { background:" + (accent ? PALETTE.blue + "26" : PALETTE.navy) + "; border-color:" + (accent ? PALETTE.blue : PALETTE.mist) + "; }"
    + ".node-ic { flex:0 0 auto; width:" + v(62, 54, 46) + "px; height:" + v(62, 54, 46) + "px; color:" + emph + "; display:flex; align-items:center; justify-content:center; }"
    + ".node-ic svg { width:" + v(62, 54, 46) + "px; height:" + v(62, 54, 46) + "px; }"
    + ".node-l { font-size:" + v(42, 37, 33) + "px; font-weight:700; color:#FFFFFF; line-height:1.12; }"
    + ".node-s { margin-top:" + v(8, 5, 4) + "px; font-size:" + v(30, 27, 25) + "px; color:" + PALETTE.mist + "; line-height:1.24; }"
    + ".flow-note { margin-top:" + v(38, 22) + "px; font-size:" + v(34, 30) + "px; line-height:1.32; color:" + PALETTE.mist + "; }"
    + cssNota
    + (apertado ? ".fnote { margin-top:30px; padding:24px 30px; } .fnote span:last-child { font-size:29px; }" : "")
    + CSS_PILULA_CTA
    + cssExtrasApertados(v);   // depois da pílula de propósito: sobrescreve
  const inner = carTop(ctx) + '<div class="mid">' + head
    + '<div class="flow">' + nodeHtml + "</div>"
    + (slide.body ? '<div class="flow-note">' + highlightHeadline(slide.body) + "</div>" : "")
    + note + pilulaCta(ctx) + "</div>" + carFooter(ctx);
  return carDoc(ctx, css, inner);
}
// ---- Arquetipos nascidos do estudo do Instagram real da 4Selet ------------
// As 63 publicacoes do perfil usam 20 familias visuais; o painel desenhava 5 inteiras. Estes cinco
// fecham as lacunas mais usadas. Regra que vale para todos: o gatilho e o DADO, nunca sorteio nem
// adjetivo — sem o campo correspondente o slide volta a ser texto, em vez de virar moldura vazia.
// Levantamento completo em ESTUDO_INSTAGRAM_4SELET.md.

// F04 — a palavra-conceito ocupando o slide (o perfil faz isso com "SELET", "Simplificar", "lógica").
// Nao e marca d'agua: e o conteudo. Por isso desliga a marca d'agua do slide, senao ficam duas
// palavras gigantes empilhadas.
function slidePalavra(slide, ctx) {
  const palavra = String(slide.word || "").trim();
  ctx.theme = resolveTheme(slide.theme);
  const light = ctx.theme === THEME_LIGHT;
  // A palavra E a marca d'agua deste slide.
  ctx.watermark = slide.watermark != null ? slide.watermark : "";
  const n = palavra.length;
  const teto = (Number(ctx.height) > 0 && Number(ctx.height) < 1200) ? 300 : 380;
  const util = Number(ctx.width || 1080) - 184;
  const tam = Math.min(teto, Math.round(util / Math.max(1, n * 0.56)));
  // Palavra longa demais viraria um fio ilegivel: melhor sair como texto do que sair errado.
  if (!palavra || tam < 96) return slideText(slide, ctx);
  const corPalavra = light ? PALETTE.mist : PALETTE.sky;
  // 0.30, e não a opacidade de marca d'água (0.05-0.18): aqui a palavra É o conteúdo. Medido na
  // primeira montagem, 0.18 sumia no gradiente e o slide lia como "fundo com sujeira".
  const op = light ? 0.95 : 0.30;
  const bodyColor = light ? PALETTE.navy : PALETTE.mist;
  const accentFix = light
    ? `.s-title span, .s-body span { color:${PALETTE.blue} !important; text-decoration-color:${PALETTE.blue} !important; }`
    : "";
  const css = `.pw { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:1; pointer-events:none; font-weight:900; line-height:.84; letter-spacing:-.045em;
      white-space:nowrap; color:${corPalavra}; opacity:${op}; font-size:${tam}px; }
    .mid { justify-content:flex-end; z-index:2; }
    .s-body { margin-top:30px; font-size:40px; line-height:1.42; color:${bodyColor}; max-width:88%; }
    ${accentFix}`;
  const inner = `${carTop(ctx)}
  <div class="pw">${esc(palavra)}</div>
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    ${slide.title ? `<div class="s-title">${highlightHeadline(slide.title)}</div>` : ""}
    ${slide.body ? `<div class="s-body">${highlightHeadline(slide.body)}</div>` : ""}
    ${pilulaCta(ctx)}
  </div>`;
  return carDoc(ctx, css, inner);
}

// F06 — UM numero, gigante. A grade (stat_grid) existe para 2 a 4; com um numero so ela desenhava
// um cartao solitario no canto. Separa nucleo e sufixo para o "%" e o "mil" nao competirem com o
// numero, que e quem tem que ser lido de longe.
function slideNumero(slide, ctx) {
  const stats = (Array.isArray(slide.stats) ? slide.stats : []).filter((s) => s && s.value != null);
  if (!stats.length) return slideText(slide, ctx);
  ctx.theme = resolveTheme(slide.theme);
  const light = ctx.theme === THEME_LIGHT;
  ctx.watermark = slide.watermark != null ? slide.watermark : (ctx.wmStyle ? { style: ctx.wmStyle } : "");
  const bruto = String(stats[0].value).trim();
  const m = bruto.match(/^\s*((?:R\$\s?)?[\d.,]+)\s*(.*)$/);
  const nucleo = m ? m[1] : bruto;
  const sufixo = m ? m[2] : "";
  // O tamanho sai da LARGURA DISPONIVEL, nao de uma escada fixa. Escada fixa foi a primeira versao
  // e estourou na medicao: "96,4%" saiu com 1039px de largura numa arte de 1080 com margem de 88.
  // Conta: cada glifo pesa ~0.6em no peso 900, o letter-spacing negativo devolve 16px por emenda, e
  // o sufixo ("%", "mil") entra proporcional porque fica na mesma linha, ao lado.
  const len = nucleo.length;
  if (len > 8) return slideText(slide, ctx);
  const util = (Number(ctx.width) || 1080) - 184;
  const pesoTotal = len + String(sufixo).length * 0.42;
  const tam = Math.min(460, Math.floor((util + (len - 1) * 16 - (sufixo ? 14 : 0)) / (pesoTotal * 0.6)));
  // Numero que so caberia minusculo nao e mais um numero gigante: melhor sair como texto.
  if (tam < 120) return slideText(slide, ctx);
  const corVal = light ? PALETTE.darker : "#FFFFFF";
  const corUn = light ? PALETTE.blue : PALETTE.sky;
  const corLab = light ? PALETTE.navy : PALETTE.mist;
  const accentFix = light
    ? `.s-title span, .n-body span { color:${PALETTE.blue} !important; text-decoration-color:${PALETTE.blue} !important; }`
    : "";
  const css = `.n-wrap { display:flex; align-items:baseline; gap:14px; margin-top:26px; }
    .n-val { font-weight:900; font-size:${tam}px; line-height:.82; letter-spacing:-16px; color:${corVal}; }
    .n-un { font-weight:800; font-size:${Math.round(tam * 0.42)}px; color:${corUn}; letter-spacing:-2px; }
    .n-lab { margin-top:22px; font-size:46px; font-weight:700; color:${corLab}; max-width:88%; line-height:1.24; }
    .n-body { margin-top:22px; font-size:38px; line-height:1.42; color:${corLab}; max-width:88%; }
    ${accentFix}`;
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    ${slide.title ? `<div class="s-title">${highlightHeadline(slide.title)}</div>` : ""}
    <div class="n-wrap"><div class="n-val">${esc(nucleo)}</div>${sufixo ? `<div class="n-un">${esc(sufixo)}</div>` : ""}</div>
    ${stats[0].label ? `<div class="n-lab">${esc(stats[0].label)}</div>` : ""}
    ${slide.body ? `<div class="n-body">${highlightHeadline(slide.body)}</div>` : ""}
    ${pilulaCta(ctx)}
  </div>`;
  return carDoc(ctx, css, inner);
}

// F07 + F18 — o item numerado de uma serie ("PRINCIPIO 2", "Regra 3"). O algarismo entra gigante e
// fantasma atras do texto, que e como o perfil desenha. Um campo so (`serie`) em vez de dois campos
// de mesma forma: escolher entre "principio" e "regra" seria adjetivo, e adjetivo vira sorteio.
function slideSerie(slide, ctx) {
  const s = slide.serie || {};
  const n = Number(s.n);
  if (!(n >= 1)) return slideText(slide, ctx);
  ctx.theme = resolveTheme(slide.theme);
  const light = ctx.theme === THEME_LIGHT;
  ctx.watermark = slide.watermark != null ? slide.watermark : "";
  const total = Number(s.total) > 0 ? Number(s.total) : 0;
  const rotulo = String(s.rotulo || slide.eyebrow || "").trim();
  const digitos = n < 10 ? ("0" + n) : String(n);
  const tamGhost = n >= 100 ? 420 : 560;
  const corGhost = light ? PALETTE.navy : PALETTE.sky;
  const opGhost = light ? 0.20 : 0.14;
  const bodyColor = light ? PALETTE.navy : PALETTE.mist;
  const accentFix = light
    ? `.s-title span, .sr-body span { color:${PALETTE.blue} !important; text-decoration-color:${PALETTE.blue} !important; }`
    : "";
  const css = `.sr-ghost { position:absolute; right:-52px; top:50%; transform:translateY(-50%); z-index:1;
      pointer-events:none; font-weight:900; font-size:${tamGhost}px; line-height:.78; letter-spacing:-42px;
      color:${corGhost}; opacity:${opGhost}; }
    .sr-head { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:22px; }
    .sr-de { font-size:28px; font-weight:700; letter-spacing:.06em; color:${light ? PALETTE.blue : PALETTE.sky}; }
    .mid { z-index:2; }
    .s-title { max-width:78%; }
    .sr-body { margin-top:28px; font-size:42px; line-height:1.42; color:${bodyColor}; max-width:72%; }
    ${accentFix}`;
  const inner = `${carTop(ctx)}
  <div class="sr-ghost">${esc(digitos)}</div>
  <div class="mid">
    ${(rotulo || total) ? `<div class="sr-head">
      ${rotulo ? `<div class="eyebrow" style="margin:0">${esc(rotulo)}</div>` : "<span></span>"}
      ${total ? `<div class="sr-de">${esc(digitos)} / ${esc(total < 10 ? "0" + total : String(total))}</div>` : ""}
    </div>` : ""}
    ${slide.title ? `<div class="s-title">${highlightHeadline(slide.title)}</div>` : ""}
    ${slide.body ? `<div class="sr-body">${highlightHeadline(slide.body)}</div>` : ""}
    ${pilulaCta(ctx)}
  </div>`;
  return carDoc(ctx, css, inner);
}

// F16 — comparacao de dois termos ("Liquidez > Volume"). O separador e uma lista fechada e so vale
// quando parte a frase em EXATAMENTE dois lados curtos: "Cadastro > Aprovacao > Repasse" tem que
// continuar sendo fluxo, nao virar comparacao com tres partes espremidas.
const SEP_VERSUS = /\s*(?:>|&gt;|\bversus\b|vs\.?(?=\s)|\sx\s|\s[–—]\s)\s*/i;
function parVersus(slide) {
  const v = slide && slide.versus;
  if (v && typeof v === "object" && v.a && v.b) return { a: String(v.a).trim(), b: String(v.b).trim() };
  const bruto = String((v && typeof v === "string" ? v : "") || slide.title || "").trim();
  if (!bruto) return null;
  const partes = bruto.split(SEP_VERSUS).map((x) => x.trim()).filter(Boolean);
  // Exatamente dois lados: três partes é fluxo ("Cadastro > Aprovação > Repasse"), não comparação.
  if (partes.length !== 2) return null;
  // Teto de 28 porque acima disso não é um TERMO, é uma frase — e duas frases empilhadas em corpo
  // 100px estouram o cartão. Piso é só "não vazio": "3 x 1" e "A vs B" são comparações legítimas.
  if (partes.some((p) => !p.length || p.length > 28)) return null;
  return { a: partes[0], b: partes[1] };
}
function slideComparacao(slide, ctx) {
  const par = parVersus(slide);
  if (!par) return slideText(slide, ctx);
  ctx.theme = resolveTheme(slide.theme);
  const light = ctx.theme === THEME_LIGHT;
  ctx.watermark = slide.watermark != null ? slide.watermark : (ctx.wmStyle ? { style: ctx.wmStyle } : "");
  const maior = Math.max(par.a.length, par.b.length);
  const tam = maior <= 10 ? 132 : maior <= 16 ? 104 : maior <= 22 ? 84 : 68;
  const corForte = light ? PALETTE.darker : "#FFFFFF";
  // No claro o termo rebaixado vai a Blue: Sky sobre Cloud da 2,29:1 e some.
  const corFraco = light ? PALETTE.blue : PALETTE.mist;
  const corGlifo = light ? PALETTE.sky : PALETTE.sky;
  const bodyColor = light ? PALETTE.navy : PALETTE.mist;
  const css = `.cp { display:flex; flex-direction:column; gap:8px; margin-top:20px; }
    .cp-a { font-weight:900; font-size:${tam}px; line-height:1.04; letter-spacing:-.03em; color:${corForte}; }
    .cp-s { font-weight:900; font-size:${Math.round(tam * 0.86)}px; line-height:1; color:${corGlifo}; margin:2px 0; }
    .cp-b { font-weight:600; font-size:${Math.round(tam * 0.78)}px; line-height:1.06; letter-spacing:-.02em; color:${corFraco}; }
    .cp-body { margin-top:34px; font-size:40px; line-height:1.42; color:${bodyColor}; max-width:88%; }`;
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    <div class="cp">
      <div class="cp-a">${esc(par.a)}</div>
      <div class="cp-s">&gt;</div>
      <div class="cp-b">${esc(par.b)}</div>
    </div>
    ${slide.body ? `<div class="cp-body">${highlightHeadline(slide.body)}</div>` : ""}
    ${pilulaCta(ctx)}
  </div>`;
  return carDoc(ctx, css, inner);
}

// F08 — citacao com autoria. O perfil usa isso com Churchill e Charles Mingus. Italico REAL da Inter
// (o eixo ital entrou no FONT_LINK_BASE); serifa continua fora, porque o GOVERNANCE proibe outra
// familia e a regra tem par no validador.
function slideCitacao(slide, ctx) {
  const c = slide.citacao || {};
  const texto = String((typeof c === "string" ? c : c.text) || "").trim();
  if (!texto) return slideText(slide, ctx);
  ctx.theme = resolveTheme(slide.theme);
  const light = ctx.theme === THEME_LIGHT;
  ctx.watermark = slide.watermark != null ? slide.watermark : "";
  const autor = String((c && c.autor) || (c && c.author) || "").trim();
  const papel = String((c && c.papel) || (c && c.role) || "").trim();
  const len = texto.length;
  const tam = len > 220 ? 44 : len > 150 ? 52 : len > 90 ? 60 : 68;
  const corTexto = light ? PALETTE.darker : "#FFFFFF";
  const corAspa = light ? PALETTE.blue : PALETTE.sky;
  const corAutor = light ? PALETTE.navy : PALETTE.mist;
  const css = `.qt-aspa { font-weight:900; font-size:300px; line-height:.62; color:${corAspa}; opacity:${light ? 0.34 : 0.42}; height:150px; }
    .qt-txt { font-style:italic; font-weight:400; font-size:${tam}px; line-height:1.34; color:${corTexto}; max-width:92%; }
    .qt-fio { width:96px; height:3px; background:${corAspa}; margin:34px 0 22px; border-radius:2px; }
    .qt-au { font-size:36px; font-weight:800; color:${corAutor}; }
    .qt-pa { margin-top:6px; font-size:28px; font-weight:500; color:${corAutor}; opacity:.82; }`;
  const inner = `${carTop(ctx)}
  <div class="mid">
    ${slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : ""}
    <div class="qt-aspa">&#8220;</div>
    <div class="qt-txt">${esc(texto)}</div>
    ${(autor || papel) ? `<div class="qt-fio"></div>` : ""}
    ${autor ? `<div class="qt-au">${esc(autor)}</div>` : ""}
    ${papel ? `<div class="qt-pa">${esc(papel)}</div>` : ""}
    ${pilulaCta(ctx)}
  </div>`;
  return carDoc(ctx, css, inner);
}

const SLIDE_ARCHETYPES = {
  stat_grid: slideStatGrid, list: slideList, text: slideText, cta: slideCta, flow: slideFlow, device: slideDevice,
  palavra: slidePalavra, numero: slideNumero, serie: slideSerie, comparacao: slideComparacao, citacao: slideCitacao,
};

// Apelidos aceitos no campo `layout`. Sem acento de propósito: o normalizador tira os acentos antes
// de comparar, então "princípio", "citação" e "opções" caem aqui sem precisar de entrada dupla.
const ALIAS_ARQUETIPO = {
  stats: "stat_grid", grid: "stat_grid", stat_grid: "stat_grid", number_grid: "stat_grid", grade: "stat_grid",
  list: "list", lista: "list", bullets: "list",
  flow: "flow", fluxo: "flow", diagram: "flow", diagrama: "flow",
  cover: "cover", capa: "cover", hook: "cover",
  cta: "cta", fecho: "cta",
  text: "text", texto: "text",
  device: "device", mockup: "device", print: "device", screenshot: "device", aparelho: "device",
  palavra: "palavra", word: "palavra", conceito: "palavra",
  numero: "numero", number: "numero", dado: "numero",
  serie: "serie", principio: "serie", regra: "serie", passo: "serie",
  comparacao: "comparacao", versus: "comparacao", vs: "comparacao",
  citacao: "citacao", quote: "citacao", frase: "citacao",
};

// Os campos que fazem um slide ter desenho PRÓPRIO. Um slide que traz um deles não é capa nem fecho,
// mesmo estando na primeira ou na última posição — foi o que a auditoria pegou: a citação de fecho
// (que existe nas peças reais do perfil) virava CTA, e o "Princípio 1" virava capa.
// `flow`, `stats` e `items` ficam DE FORA: são genéricos e aparecem em capa e em fecho o tempo todo.
const CAMPOS_PROPRIOS = ["word", "versus", "citacao", "serie"];
// O `versus` só CONTA como dado próprio quando de fato dá um par válido. Sem isto o roteador
// anunciava "comparacao" para "Cadastro > Aprovação > Repasse" e o desenho, que rejeita três
// partes, caía em texto — layout anunciado e desenho entregue tinham que ser a mesma coisa, senão
// a peça única grava um template que não corresponde ao que está na tela.
// O título NÃO entra aqui de propósito: um título com ">" não pode sequestrar o slide.
function versusValido(slide) {
  if (!slide || !slide.versus) return false;
  return !!parVersus({ versus: slide.versus, title: "" });
}
function temDadoProprio(slide) {
  if (!slide || typeof slide !== "object") return false;
  if (slide.word && String(slide.word).trim()) return true;
  if (versusValido(slide)) return true;
  if (slide.citacao && (typeof slide.citacao === "string" ? slide.citacao.trim() : String(slide.citacao.text || "").trim())) return true;
  if (slide.serie && Number(slide.serie.n) >= 1) return true;
  return false;
}

// Decide o arquetipo de um slide, em três degraus e nesta ordem:
//   1) apelido explícito no campo `layout`/`type` — a escolha da pessoa vence tudo;
//   2) posição (1o = capa, último = fecho), MAS cedendo quando o slide tem dado próprio;
//   3) o DADO, do mais específico ao mais genérico.
// A ordem do degrau 3 é a mesma de `arquetipoPorDado`, e mexer numa sem mexer na outra é bug.
function slideArchetype(slide, i, total) {
  const ex = String((slide && (slide.layout || slide.type)) || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
  if (ALIAS_ARQUETIPO[ex]) return ALIAS_ARQUETIPO[ex];

  const proprio = temDadoProprio(slide);
  if (i === 0 && !proprio) return "cover";
  if (i === total - 1 && total > 1 && !proprio) return "cta";
  return arquetipoDoDado(slide) || "text";
}

// O degrau do DADO, isolado para o roteador do carrossel e o da peça única usarem a MESMA ordem.
function arquetipoDoDado(slide) {
  if (!slide || typeof slide !== "object") return null;
  // Print de tela pedido em aparelho: o print manda, mesmo que o slide também tenha números.
  if (slide.image && slide.device) return "device";
  if (temDadoProprio(slide)) {
    if (slide.citacao) return "citacao";
    if (versusValido(slide)) return "comparacao";
    if (slide.word) return "palavra";
    if (slide.serie) return "serie";
  }
  if (Array.isArray(slide.flow) && slide.flow.length) return "flow";
  if (Array.isArray(slide.stats) && slide.stats.length === 1) return "numero";
  if (Array.isArray(slide.stats) && slide.stats.length >= 2) return "stat_grid";
  if (Array.isArray(slide.items) && slide.items.length) return "list";
  return null;
}

// ---- Renders por tipo -----------------------------------------------------
// Um dado estruturado (números, itens ou etapas) transforma a peça: medido no formato publicável,
// a grade de números preenche 30% da arte e o fluxo com ícones 33%, contra 7,3% do editorial. Esses
// desenhos existem, estão testados e até hoje SÓ o carrossel os alcançava — a peça de Imagem ia
// direto para os quatro templates de sempre. O gatilho é o DADO, não uma preferência: peça sem
// números/itens/etapas segue exatamente como era, e peça antiga não muda de cara sozinha.
// Dos 6 arquétipos de slide, só estes 3 fazem sentido como PEÇA ÚNICA. "cover", "text" e "cta"
// pressupõem vizinhos (capa de quê? fecho de quê?) e já têm equivalente nos 4 templates de sempre.
// Os arquetipos que fazem sentido como PECA UNICA. "cover", "text" e "cta" continuam de fora
// (capa de que? fecho de que?), e "serie" tambem: "2 de 5" pressupoe vizinhos.
const ARQ_PECA = ["stat_grid", "list", "flow", "palavra", "numero", "comparacao", "citacao"];
// A peca unica usa a MESMA ordem do carrossel (arquetipoDoDado), so filtrando o que nao vale
// sozinho. Duas listas separadas era o caminho garantido para elas divergirem com o tempo.
function arquetipoPorDado(concept) {
  if (!concept || typeof concept !== "object") return null;
  const arq = arquetipoDoDado(concept);
  if (arq && ARQ_PECA.indexOf(arq) >= 0) {
    // Grade e lista continuam exigindo 2+ entradas de verdade: uma so nao justifica o desenho
    // (e com um numero so quem responde e o arquetipo `numero`).
    const tem = (v) => Array.isArray(v) && v.filter((x) => x && (typeof x === "string" ? x.trim() : (x.label || x.value || x.text))).length >= 2;
    if (arq === "stat_grid" && !tem(concept.stats)) return null;
    if (arq === "list" && !tem(concept.items)) return null;
    if (arq === "flow" && !tem(concept.flow)) return null;
    return arq;
  }
  return null;
}
// Todos os ids que a tela pode mandar como "template" da peca unica: os 4 de sempre + os arquetipos
// que valem sozinhos. Sem isto a rota derruba `template=numero` antes de chegar aqui.
const PECA_IDS = TEMPLATE_IDS.concat(ARQ_PECA);
async function renderImage(folder, opts) {
  const loc = requireActive(folder);
  const concept = readJson(path.join(loc.path, "ads", "concept.json")) || {};
  const logoV = pickLogo(loc, opts && opts.logo);
  const wmV = pickWatermark(loc, opts && opts.watermark);
  const htmlPath = path.join(loc.path, "ads", "ad.html");
  const outPng = path.join(loc.path, "ads", "ad.png");
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });

  // Três travas, nesta ordem — a mesma invariante do pickTemplate ("re-renderizar nunca muda a cara
  // da peça"): (1) a escolha da pessoa na tela sempre manda e sai por aqui; (2) se a peça já foi
  // desenhada num arquétipo, ela CONTINUA nele mesmo que o texto mude; (3) peça já renderizada num
  // dos 4 templates de sempre NÃO vira grade de números só porque alguém acrescentou dados depois.
  const pedido = opts && opts.template;
  const gravado = readRenderPref(loc);
  const ehTpl = (id) => !!id && Object.prototype.hasOwnProperty.call(TEMPLATES, id);
  const ehArq = (id) => !!id && Object.prototype.hasOwnProperty.call(SLIDE_ARCHETYPES, id) && ARQ_PECA.indexOf(id) >= 0;
  const arq = ehTpl(pedido) ? null
    : (ehArq(pedido) ? pedido
      : (ehArq(gravado) ? gravado
        : (gravado ? null : arquetipoPorDado(concept))));
  if (arq) {
    const htmlArq = SLIDE_ARCHETYPES[arq](
      Object.assign({}, concept, { title: concept.headline || concept.title || "", body: concept.subtext || concept.body || "" }),
      { width: 1080, height: 1080, n: 1, total: 1, cta: concept.cta || "", logo: logoV, wmStyle: wmV, image: concept.image || (opts && opts.image) || "" }
    );
    fs.writeFileSync(htmlPath, htmlArq, "utf8");
    const rr = await htmlToPng(htmlPath, outPng, 1080, 1080, RENDER_SCALE);
    writeRenderPref(loc, { template: arq });   // grava na PRIMEIRA vez, como o pickTemplate
    return Object.assign(rr, { rel: "ads/ad.png", template: arq });
  }

  // A peça tem foto? Então "photo" é o único template que a desenha — os outros três nem recebem
  // o parâmetro `image` na assinatura e descartariam a imagem em silêncio.
  const tpl = pickTemplate(loc, opts && opts.template, { temFoto: !!((opts && opts.image) || concept.image) });
  const html = tpl.build({
    width: 1080, height: 1080,
    eyebrow: concept.eyebrow || "",
    headline: highlightHeadline(concept.headline || "4Selet."),
    subtext: concept.subtext || "",
    cta: concept.cta || "",
    badge: concept.badge || "",
    image: concept.image || (opts && opts.image) || "",
    logo: logoV, watermark: wmV,
  });
  fs.writeFileSync(htmlPath, html, "utf8");
  const r = await htmlToPng(htmlPath, outPng, 1080, 1080, RENDER_SCALE);
  return Object.assign(r, { rel: "ads/ad.png", template: tpl.id });
}

async function renderFeed(folder, opts) {
  const loc = requireActive(folder);
  // A foto do feed vive no render.json (o arquivo da peça é .txt e não guarda campo). Sem isto,
  // a rota de render nunca mandava `image` e a foto escolhida na criação sumia ao salvar — ela
  // aparecia só na prévia, que lia direto do formulário.
  const fotoSalva = readRenderJson(loc).image;
  const foto = (opts && opts.image) || (imagemExiste(fotoSalva) ? fotoSalva : "");
  if (opts && opts.image) writeRenderPref(loc, { image: opts.image });
  const tpl = pickTemplate(loc, opts && opts.template, { temFoto: !!foto });
  // Le a caption salva (txt) e usa a 1a linha forte como headline.
  let caption = "";
  try { caption = fs.readFileSync(path.join(loc.path, "copy", "instagram_caption.txt"), "utf8"); } catch (e) {}
  // A caption tem estrutura: 1a linha = gancho, paragrafos de desenvolvimento, hashtags no fim.
  // A arte usava SO a primeira linha e mandava eyebrow/subtexto/CTA vazios — por isso a peca de
  // feed saia como fundo + uma frase + logo. O texto de apoio ja estava no arquivo o tempo todo.
  const linhas = caption.split("\n").map((s) => s.trim()).filter(Boolean);
  const semHashtag = (s) => !/^#/.test(s);
  const firstLine = linhas.filter(semHashtag)[0] || "4Selet.";
  // Cortar em 57 caracteres cortava no meio da palavra ("...está olhando par…"). Agora o corte
  // acontece no ultimo espaco antes do limite, e so quando a frase realmente nao cabe.
  const cortaEmPalavra = (s, max) => {
    s = String(s || "").trim();
    if (s.length <= max) return s;
    const pedaco = s.slice(0, max);
    const esp = pedaco.lastIndexOf(" ");
    return (esp > max * 0.6 ? pedaco.slice(0, esp) : pedaco).replace(/[\s,;:.\-–—]+$/, "") + "…";
  };
  const headline = cortaEmPalavra(firstLine, 60);
  // Texto de apoio: o proximo paragrafo depois do gancho, sem hashtag e sem repetir o gancho.
  const apoio = linhas.filter(semHashtag).slice(1).find((s) => s.length > 24 && s !== firstLine) || "";
  const subtexto = cortaEmPalavra(apoio, 150);
  const logoV = pickLogo(loc, opts && opts.logo);
  const wmV = pickWatermark(loc, opts && opts.watermark);
  const htmlPath = path.join(loc.path, "ads", "feed.html");
  const outPng = path.join(loc.path, "ads", "feed.png");
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  const html = tpl.build({
    width: 1080, height: 1350,
    eyebrow: "",
    headline: highlightHeadline(headline),
    subtext: subtexto,
    cta: "",
    badge: "",
    image: foto,
    logo: logoV, watermark: wmV,
  });
  fs.writeFileSync(htmlPath, html, "utf8");
  const r = await htmlToPng(htmlPath, outPng, 1080, 1350, RENDER_SCALE);
  return Object.assign(r, { rel: "ads/feed.png", template: tpl.id });
}

// Monta o HTML de TODOS os slides do carrossel a partir do conceito (capa via template
// escolhido, demais via arquetipos). PURA (sem I/O) — usada pelo renderCarousel (grava PNG)
// e pelo renderPreview (mostra todos os slides sem salvar), garantindo que a previa bate com
// o render final. buildCover = funcao de template da capa (tpl.build, ex.: tplEditorial).
function carouselSlidesHtml(concept, buildCover, opts) {
  const logoV = (opts && opts.logo) || "";        // variante de logo da peça (carTop/capa)
  const wmV = (opts && opts.watermark) || "";     // estilo de marca d'água da peça (todos os slides)
  const slides = Array.isArray(concept.slides) && concept.slides.length
    ? concept.slides
    : [{ title: "4Selet", body: "" }];
  const total = slides.length;
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const n = i + 1;
    const arch = slideArchetype(s, i, total);
    let html;
    if (arch === "cover") {
      // A capa usa o template de arte escolhido (editorial|bold|split|photo) — MAS a foto manda.
      // Dos quatro templates, só o "Foto" recebe o parâmetro `image`; os outros três nem o têm na
      // assinatura. Ou seja: anexar foto na capa e estar com Editorial/Destaque/Dividido fazia a
      // imagem ser descartada em silêncio — a linha "Foto de fundo anexada" aparecia na tela com a
      // miniatura, e a arte saía sem foto nenhuma. Se há foto de verdade, a capa usa o layout que
      // sabe desenhá-la; sem foto, nada muda.
      const capaImg = (s && s.image) || concept.image || "";
      const desenha = (capaImg && imagemExiste(capaImg)) ? resolveTemplate("photo") : buildCover;
      html = desenha({
        width: 1080, height: 1350,
        eyebrow: concept.eyebrow || "",
        headline: highlightHeadline(s.title || ""),
        subtext: s.body || "",
        cta: "",
        badge: "",
        image: capaImg,
        dots: dotsBar(n, total),
        titleOffsetY: s && s.titleOffsetY, // ajuste fino de posicao do titulo (camadas)
        titleOffsetX: s && s.titleOffsetX,
        titleScale: s && s.titleScale,
        logo: logoV, watermark: wmV,
      });
    } else {
      html = SLIDE_ARCHETYPES[arch](s, {
        width: 1080, height: 1350, n: n, total: total,
        cta: arch === "cta" ? (concept.cta || "") : "",
        footer: concept.footer,
        tagline: arch === "cta",
        image: (s && s.image) || "", // foto de fundo por-slide (opcional) — o carDoc a desenha sob o conteudo
        logo: logoV, wmStyle: wmV,
      });
    }
    out.push({ n: n, html: html });
  }
  return out;
}

async function renderCarousel(folder, opts) {
  const loc = requireActive(folder);
  const tpl = pickTemplate(loc, opts && opts.template);
  const logoV = pickLogo(loc, opts && opts.logo);
  const wmV = pickWatermark(loc, opts && opts.watermark);
  const concept = readJson(path.join(loc.path, "copy", "instagram_carousel.json")) || {};
  const dir = path.join(loc.path, "slides");
  fs.mkdirSync(dir, { recursive: true });
  const built = carouselSlidesHtml(concept, tpl.build, { logo: logoV, watermark: wmV });
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

// Re-renderiza UM slide do carrossel (após regerar o conteúdo só dele), sem tocar nos outros.
async function renderCarouselSlide(folder, n) {
  const loc = requireActive(folder);
  FAMILIA_ATUAL = readFontPref(loc);   // regerar UM slide tem que sair na mesma fonte dos outros
  const tpl = pickTemplate(loc, null);
  const logoV = pickLogo(loc, null);
  const wmV = pickWatermark(loc, null);
  const concept = readJson(path.join(loc.path, "copy", "instagram_carousel.json")) || {};
  const dir = path.join(loc.path, "slides");
  fs.mkdirSync(dir, { recursive: true });
  const built = carouselSlidesHtml(concept, tpl.build, { logo: logoV, watermark: wmV });
  FAMILIA_ATUAL = "";   // documento já montado: devolve a identidade antes de qualquer espera
  const item = built.find((b) => b.n === n);
  if (!item) { const e = new Error("slide " + n + " nao existe no carrossel"); e.code = "E_NO_SLIDE"; throw e; }
  const htmlPath = path.join(dir, "slide_" + n + ".html"), outPng = path.join(dir, "slide_" + n + ".png");
  fs.writeFileSync(htmlPath, item.html, "utf8");
  const r = await htmlToPng(htmlPath, outPng, 1080, 1350, RENDER_SCALE);
  return { ok: r.ok, rel: "slides/slide_" + n + ".png", stderr: r.stderr || "" };
}

// ---- Video (Remotion parametrizado) ---------------------------------------
async function renderVideo(folder) {
  const loc = requireActive(folder);
  const concept = readJson(path.join(loc.path, "video", "concept.json")) || {};
  const scenes = Array.isArray(concept.scenes) && concept.scenes.length ? concept.scenes : [
    { type: "hook", text: concept.hook || "4Selet.", visual: "" },
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
      headline: highlightHeadline(parsed.headline || "4Selet."),
      subtext: parsed.subtext || "",
      cta: parsed.cta || "",
      badge: parsed.badge || "",
      image: parsed.image || "",
    };
  }
  if (ct.kind === "feed") {
    const caption = String(parsed.body || parsed.caption || "");
    const firstLine = caption.split("\n").map((s) => s.trim()).filter(Boolean)[0] || "4Selet.";
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
      ? parsed.slides : [{ title: "4Selet", body: "" }];
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

// Renderiza um HTML (string) para dataURL PNG via arquivo temporario. Escala em PREVIEW_SCALE (2x)
// p/ a previa ficar nitida ao AMPLIAR no lightbox. Sufixo aleatorio evita colisao entre previas concorrentes.
async function htmlStringToPngDataUrl(html, w, h, scale) {
  const uniq = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const base = path.join(os.tmpdir(), "4selet-preview-" + process.pid + "-" + uniq);
  const htmlPath = base + ".html";
  const outPng = base + ".png";
  try {
    fs.writeFileSync(htmlPath, html, "utf8");
    const r = await htmlToPng(htmlPath, outPng, w, h, scale || PREVIEW_SCALE);
    if (!r.ok || !fs.existsSync(outPng)) return { ok: false, error: (r.stderr || r.stdout || "falha ao renderizar a previa").slice(0, 400) };
    return { ok: true, dataUrl: "data:image/png;base64," + fs.readFileSync(outPng).toString("base64") };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { fs.unlinkSync(htmlPath); } catch (e) {}
    try { fs.unlinkSync(outPng); } catch (e) {}
  }
}

async function renderPreview({ content_type, parsed, template, logo, watermark, only, media, font } = {}) {
  const ct = contentTypeById(content_type);
  if (!ct || ct.media !== "image") return { ok: false, error: "este tipo nao tem previa de arte" };
  const tplId = (template && TEMPLATES[template]) ? template : "editorial";
  const logoV = LOGO_IDS.indexOf(logo) >= 0 ? logo : "";
  const wmV = WATERMARK_IDS.indexOf(watermark) >= 0 ? watermark : "";
  // A prévia tem que sair na MESMA tipografia da arte final — senão a tela mostra uma coisa e o
  // arquivo salvo sai outra, que é o erro que já custou caro aqui (foto/logo sumindo no render).
  FAMILIA_ATUAL = FAMILIA_IDS.indexOf(font) >= 0 ? font : "";
  // 4Selet na Mídia: a prévia monta o mockup de device (tplMedia) a partir dos metadados do form
  // (print/modelo/veículo), no 1º tamanho marcado. Sem print ainda, mostra a moldura vazia.
  if (ct.kind === "media") {
    const m = media || {};
    const szKey = (Array.isArray(m.sizes) ? m.sizes : []).find((k) => MEDIA_SIZES[k]) || "4x5";
    const sz = MEDIA_SIZES[szKey];
    const html = tplMedia({ width: sz.w, height: sz.h, image: m.print || "", url: m.url || "", eyebrow: m.vehicle || "", headline: m.headline || "", model: m.model || "hand_tablet", logo: logoV });
    FAMILIA_ATUAL = "";   // documento montado: devolve a identidade antes de esperar pelo PNG
    const png = await htmlStringToPngDataUrl(html, sz.w, sz.h);
    if (!png.ok) return { ok: false, error: png.error };
    return { ok: true, dataUrl: png.dataUrl, template: m.model || "tablet", kind: ct.kind, width: sz.w, height: sz.h };
  }
  // Carrossel: a previa mostra TODOS os slides (nao so a capa) — renderiza cada um in-memory,
  // com a MESMA montagem do render final (carouselSlidesHtml).
  if (ct.kind === "carousel") {
    const built = carouselSlidesHtml(parsed || {}, TEMPLATES[tplId], { logo: logoV, watermark: wmV });
    FAMILIA_ATUAL = "";   // idem: todos os slides já estão montados
    // "only" = renderiza SO o slide desse indice (o carrossel inteiro e montado p/ preservar o contexto
    // de posicao — 1o=capa, ultimo=cta). O frontend chama slide-a-slide p/ mostrar "slide N de M".
    if (only != null && built.length) {
      const i = Math.max(0, Math.min(built.length - 1, Number(only) || 0));
      const png = await htmlStringToPngDataUrl(built[i].html, 1080, 1350);
      if (!png.ok) return { ok: false, error: png.error, template: tplId };
      return { ok: true, slides: [{ n: built[i].n, dataUrl: png.dataUrl }], total: built.length, only: i, template: tplId, kind: ct.kind, width: 1080, height: 1350 };
    }
    const slidesOut = [];
    for (const item of built) {
      const png = await htmlStringToPngDataUrl(item.html, 1080, 1350);
      if (!png.ok) return { ok: false, error: png.error, template: tplId };
      slidesOut.push({ n: item.n, dataUrl: png.dataUrl });
    }
    return { ok: true, slides: slidesOut, total: built.length, template: tplId, kind: ct.kind, width: 1080, height: 1350 };
  }
  const fields = previewFields(ct, parsed);
  if (!fields) return { ok: false, error: "este tipo nao tem previa de arte" };
  const doc = resolveTemplate(tplId)(Object.assign({}, fields, { logo: logoV, watermark: wmV }));
  FAMILIA_ATUAL = "";
  const png = await htmlStringToPngDataUrl(doc, fields.width, fields.height);
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
// Decodifica entidades HTML dos casos que interessam aqui (&#106;avascript:, &#x6a;..., &colon;)
// ANTES de procurar esquema perigoso — senao `href="&#106;avascript:alert(1)"` passava batido,
// porque o literal "javascript:" nao aparece no texto cru.
function decodeEntitiesForCheck(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return m; } })
    .replace(/&#(\d+);?/g, (m, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch (e) { return m; } })
    .replace(/&colon;/gi, ":")
    .replace(/&Tab;|&NewLine;/gi, "");
}
// Esquema de URL perigoso? (javascript:, vbscript:, data:text/html — tolerando espacos,
// quebras de linha e maiusculas no meio, que os navegadores ignoram ao resolver o esquema.)
function isDangerousUrl(v) {
  const plain = decodeEntitiesForCheck(v).replace(/[\s -]/g, "").toLowerCase();
  return /^(javascript|vbscript|livescript):/.test(plain) || /^data:text\/html/.test(plain);
}

function sanitizeArtHtml(html) {
  let s = String(html);
  // Uma passada so nao basta: `<scr<script>ipt>` vira `<script>` DEPOIS da primeira remocao.
  // Repetimos ate o texto parar de mudar (com teto, para nao girar em falso).
  for (let pass = 0; pass < 5; pass++) {
    const before = s;
    s = s.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");   // <script>...</script>
    s = s.replace(/<script\b[^>]*>/gi, "");                     // <script ...> solto
    s = s.replace(/<\/?(iframe|object|embed|base|form|meta|noscript|template|applet|svg:script)\b[^>]*>/gi, "");
    // Handlers on*: o separador antes do atributo pode ser espaco, "/" OU a ASPA que fecha o
    // atributo anterior — `<img/onerror=x>` e `<img src="x"onerror="alert(1)">` sao os dois
    // HTML valido. A regra antiga exigia [\s/] e deixava o segundo caso passar INTACTO, porque
    // a regra de URL abaixo casa `src="x"` primeiro e devolve o trecho inteiro sem tocar.
    // Confirmado disparando de verdade no Chromium antes do fix.
    // O separador e CAPTURADO e devolvido: se ele for a aspa de fechamento do atributo
    // anterior, engoli-la deixaria `src="x >` (aspa aberta) e quebraria a arte legitima.
    s = s.replace(/([\s/"'])on[a-z]+\s*=\s*"[^"]*"/gi, "$1 ");  // onload="..."
    s = s.replace(/([\s/"'])on[a-z]+\s*=\s*'[^']*'/gi, "$1 ");  // onload='...'
    s = s.replace(/([\s/"'])on[a-z]+\s*=\s*[^\s>]+/gi, "$1 ");  // onload=x (sem aspas)
    // URLs perigosas — agora tambem sem aspas e com entidades decodificadas na checagem.
    s = s.replace(/(href|src|xlink:href|action|formaction)\s*=\s*(["'])([^"']*)\2/gi, (m, attr, q, val) => isDangerousUrl(val) ? (attr + "=" + q + "#" + q) : m);
    s = s.replace(/(href|src|xlink:href|action|formaction)\s*=\s*([^\s>"']+)/gi, (m, attr, val) => isDangerousUrl(val) ? (attr + '="#"') : m);
    // neutraliza src/href http(s) EXTERNOS (exceto fontes do Google) — defesa extra alem do bloqueio de rede
    s = s.replace(/(src|href|xlink:href)\s*=\s*(["'])\s*https?:\/\/(?!fonts\.(?:googleapis|gstatic)\.com\/)[^"']*\2/gi, "$1=$2$2");
    s = s.replace(/<link\b[^>]*>/gi, (m) => /fonts\.googleapis\.com/i.test(m) ? m : ""); // so <link> de fonte
    if (s === before) break;
  }
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
  // Também reescreve url(...) DENTRO de style (ex.: a marca d'água "padrão" usa background-image:url(.../assets/simbolo.svg)).
  const rwUrl = (h, seg, abs) => h.replace(new RegExp('(url\\(\\s*["\']?)[^"\')]*?/' + seg + '/', "gi"), "$1" + abs);
  let h = html;
  for (const [seg, abs] of [["uploads", up], ["brand-assets", as], ["assets", as]]) {
    h = rw(h, seg, abs);
    h = rwUrl(h, seg, abs);
  }
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

// Formatos da peça "4Selet na Mídia". 4:5 vai pra ads/feed.png (publicável no IG feed).
const MEDIA_SIZES = {
  "4x5":  { w: 1080, h: 1350, png: "feed.png" },
  "1x1":  { w: 1080, h: 1080, png: "square.png" },
  "9x16": { w: 1080, h: 1920, png: "story.png" },
  "16x9": { w: 1920, h: 1080, png: "media_16x9.png" },
};
const MEDIA_SIZE_IDS = Object.keys(MEDIA_SIZES);
// 4Selet na Mídia: renderiza o print num dispositivo (status.media.model), nos TAMANHOS
// escolhidos (status.media.sizes; default 4:5 + 16:9). A legenda vai em copy/instagram_caption.txt.
async function renderMedia(folder, opts) {
  const loc = requireActive(folder);
  const status = readJson(path.join(loc.path, "status.json")) || {};
  const meta = status.media || {};
  const model = (opts && opts.template) || meta.model || "tablet";
  const logoV = pickLogo(loc, opts && opts.logo);
  const props = { image: meta.print || (opts && opts.image) || "", url: meta.url || "", eyebrow: meta.vehicle || "", headline: meta.headline || "", model, logo: logoV };
  let sizes = (Array.isArray(meta.sizes) ? meta.sizes : []).filter((k) => MEDIA_SIZES[k]);
  if (!sizes.length) sizes = ["4x5", "16x9"];
  const dir = path.join(loc.path, "ads");
  fs.mkdirSync(dir, { recursive: true });
  // Monta TODOS os documentos de uma vez, antes de qualquer await — como o carrossel já fazia. Os
  // templates leem a tipografia da peça em desenho (fontHead), e essa leitura tem que acontecer
  // inteira dentro do mesmo instante: montar dentro do laço deixaria os formatos 2..4 sujeitos a
  // uma outra peça que começasse a renderizar no meio.
  const docs = sizes.map((key) => {
    const sz = MEDIA_SIZES[key];
    return { sz, html: tplMedia(Object.assign({ width: sz.w, height: sz.h }, props)) };
  });
  const rels = []; let err = "";
  for (const { sz, html } of docs) {
    const base = sz.png.replace(/\.png$/i, "");
    const hp = path.join(dir, base + ".html"), pp = path.join(dir, sz.png);
    fs.writeFileSync(hp, html, "utf8");
    const r = await htmlToPng(hp, pp, sz.w, sz.h, RENDER_SCALE);
    if (r.ok) rels.push("ads/" + sz.png); else err = r.stderr || err;
  }
  return { ok: rels.length > 0, rels, stderr: err, template: model };
}

// Dispatcher por kind. `opts.template` (editorial|bold|split) so afeta estaticos.
// Assincrono: o chamador (rota) deve usar `await render.render(...)`.
async function render(folder, kind, opts) {
  // A família tipográfica da peça vale para TODOS os documentos que este render montar (a arte, os
  // slides do carrossel, os formatos da Mídia). Fica valendo só durante esta chamada: o `finally`
  // devolve a identidade da marca, para a próxima peça nunca herdar a fonte da anterior.
  let loc = null;
  try { loc = requireActive(folder); } catch (e) { loc = null; }
  FAMILIA_ATUAL = loc ? pickFont(loc, opts && opts.font) : "";
  // A cor vem da CAMPANHA, não da peça: é a campanha que é sazonal ("uma de fim de ano, vermelhona"),
  // e assim todas as peças dela saem coerentes entre si sem ninguém repetir a escolha peça a peça.
  PALETA_ATUAL = loc ? paletaDaCampanha(loc) : null;
  try {
    switch (kind) {
      case "image": return await renderImage(folder, opts);
      case "feed": return await renderFeed(folder, opts);
      case "media": return await renderMedia(folder, opts);
      case "carousel": return await renderCarousel(folder, opts);
      case "video": return await renderVideo(folder);
      default: { const e = new Error("kind sem render de midia: " + kind); e.code = "E_NO_RENDER"; throw e; }
    }
  } finally { FAMILIA_ATUAL = ""; PALETA_ATUAL = null; }
}

module.exports = {
  render, renderPreview, renderForDownload, renderEditedHtml, renderCarouselSlide,
  carouselSlidesHtml, // pura (sem I/O): montagem HTML dos slides — reutilizavel/testavel
  tplMedia,           // pura: template da arte "4Selet na Midia" (device mockup / mao+tablet)
  imagemExiste,       // pura: a foto apontada existe mesmo? (o modelo inventa caminho)
  TEMPLATE_IDS, PECA_IDS, ARQ_PECA, LOGO_IDS, WATERMARK_IDS,
  slideArchetype, arquetipoDoDado,   // puras: o roteador de layout, testavel sem render
  FAMILIAS, FAMILIA_IDS,   // lista fechada de tipografia (a tela monta o seletor a partir daqui)
};
