// scripts/generate_preview.js — gera preview.html consolidado da task e
// promove draft -> in_review (idempotente).
//
// Uso: node scripts/generate_preview.js --task <name> --date <YYYY-MM-DD>
// Exit codes: 0 ok, 1 task nao encontrada, 2 erro tecnico.
"use strict";
const fs = require("fs");
const path = require("path");

// ---- helpers inline ------------------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}
function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const tzH = pad(Math.floor(Math.abs(tzMin) / 60));
  const tzM = pad(Math.abs(tzMin) % 60);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
    sign + tzH + ":" + tzM;
}
function readTextSafe(p) {
  if (!fs.existsSync(p)) return null;
  try { return fs.readFileSync(p, "utf8").replace(/^﻿/, ""); } catch (e) { return null; }
}
function readJsonSafe(p) {
  const raw = readTextSafe(p);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch (e) {
    const err = new Error("JSON corrompido em " + p + ": " + e.message);
    err.code = "E_JSON_CORRUPT"; throw err;
  }
}
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", { encoding: "utf8" });
  fs.renameSync(tmp, p);
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function info(msg) { console.log("[generate_preview] " + msg); }
function warn(msg) { console.error("[generate_preview] WARN: " + msg); }
function fail(msg, code) { console.error("[generate_preview] " + msg); process.exit(code || 2); }

// ---- minimal Markdown -> HTML --------------------------------------------
function mdToHtml(md) {
  if (!md) return "";
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let out = []; let i = 0;
  const isFence = (s) => /^```/.test(s);
  const isHeading = (s) => /^#{1,6}\s+/.test(s);
  const isUl = (s) => /^[-*+]\s+/.test(s);
  const isOl = (s) => /^\d+\.\s+/.test(s);
  const isQuote = (s) => /^>\s?/.test(s);
  const isHr = (s) => /^---+\s*$/.test(s);
  const isTableSep = (s) => /^\|?[ :|\-]+\|[ :|\-]+\|?$/.test(s);

  function inlineFmt(s) {
    let r = escapeHtml(s);
    // images
    r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, a, src) => '<img alt="' + a + '" src="' + src + '"/>');
    // links
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => '<a href="' + u + '">' + t + "</a>");
    // bold
    r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // italic
    r = r.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
    // inline code
    r = r.replace(/`([^`]+)`/g, "<code>$1</code>");
    return r;
  }

  while (i < lines.length) {
    const L = lines[i];
    if (L.trim() === "") { i++; continue; }
    if (isFence(L)) {
      const lang = L.replace(/^```\s*/, "").trim();
      const block = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) { block.push(lines[i]); i++; }
      if (i < lines.length) i++; // skip closing fence
      out.push('<pre class="code"><code' + (lang ? ' data-lang="' + escapeHtml(lang) + '"' : "") + ">" + escapeHtml(block.join("\n")) + "</code></pre>");
      continue;
    }
    if (isHr(L)) { out.push("<hr/>"); i++; continue; }
    if (isHeading(L)) {
      const m = L.match(/^(#{1,6})\s+(.*)$/);
      const level = m[1].length;
      out.push("<h" + level + ">" + inlineFmt(m[2]) + "</h" + level + ">");
      i++; continue;
    }
    if (isQuote(L)) {
      const block = [];
      while (i < lines.length && isQuote(lines[i])) {
        block.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push("<blockquote>" + inlineFmt(block.join(" ")) + "</blockquote>");
      continue;
    }
    if (isUl(L)) {
      const items = [];
      while (i < lines.length && isUl(lines[i])) {
        items.push("<li>" + inlineFmt(lines[i].replace(/^[-*+]\s+/, "")) + "</li>");
        i++;
      }
      out.push("<ul>" + items.join("") + "</ul>");
      continue;
    }
    if (isOl(L)) {
      const items = [];
      while (i < lines.length && isOl(lines[i])) {
        items.push("<li>" + inlineFmt(lines[i].replace(/^\d+\.\s+/, "")) + "</li>");
        i++;
      }
      out.push("<ol>" + items.join("") + "</ol>");
      continue;
    }
    // table simples (linha com | e proxima e separador)
    if (L.indexOf("|") !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const splitRow = (s) => s.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const header = splitRow(L);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].indexOf("|") !== -1) {
        rows.push(splitRow(lines[i])); i++;
      }
      const th = header.map((c) => "<th>" + inlineFmt(c) + "</th>").join("");
      const trs = rows.map((r) => "<tr>" + r.map((c) => "<td>" + inlineFmt(c) + "</td>").join("") + "</tr>").join("");
      out.push("<table><thead><tr>" + th + "</tr></thead><tbody>" + trs + "</tbody></table>");
      continue;
    }
    // paragrafo
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !isFence(lines[i]) && !isHeading(lines[i]) && !isUl(lines[i]) && !isOl(lines[i]) && !isQuote(lines[i])) {
      para.push(lines[i]); i++;
    }
    out.push("<p>" + inlineFmt(para.join(" ")) + "</p>");
  }
  return out.join("\n");
}

// ---- localizar task -------------------------------------------------------
const args = parseArgs(process.argv);
const task = args.task;
const date = args.date;
if (!task || !date) fail("uso: --task <name> --date <YYYY-MM-DD>", 1);

const folderName = task + "_" + date;
const candidates = [
  path.resolve("outputs", folderName),
  path.resolve("outputs", "approved", folderName),
];
const taskDir = candidates.find((p) => fs.existsSync(p));
if (!taskDir) {
  fail("pasta nao encontrada para " + folderName + ". Rode 'node scripts/orchestrator.js --task=" + task + " --date=" + date + "' antes", 1);
}

// ---- coletar artefatos ----------------------------------------------------
function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      out.push(...listFiles(path.join(dir, ent.name), exts));
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      if (!exts || exts.includes(ext)) out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

const adImages = listFiles(path.join(taskDir, "ads"), [".png", ".jpg", ".jpeg", ".webp"]);
const adLayouts = listFiles(path.join(taskDir, "ads"), [".json"]);
const adStyles = listFiles(path.join(taskDir, "ads"), [".css"]);
const videoFiles = listFiles(path.join(taskDir, "video"), [".mp4", ".mov", ".webm"]);
const videoStills = listFiles(path.join(taskDir, "video"), [".png", ".jpg"]);
const copyTexts = listFiles(path.join(taskDir, "copy"), [".txt", ".md", ".json"]);
const researchFiles = [];
for (const name of ["research_results.json", "research_brief.md", "interactive_report.html"]) {
  const p = path.join(taskDir, name);
  if (fs.existsSync(p)) researchFiles.push(p);
}
let publishMd = null;
for (const ent of fs.readdirSync(taskDir, { withFileTypes: true })) {
  if (ent.isFile() && /^Publish\s.*\.md$/.test(ent.name)) {
    publishMd = path.join(taskDir, ent.name); break;
  }
}

const statusPath = path.join(taskDir, "status.json");
let status = null;
try { status = readJsonSafe(statusPath); } catch (e) {
  if (e.code === "E_JSON_CORRUPT") fail(e.message, 2); else throw e;
}
if (!status) {
  warn("status.json ausente — criando defaults");
  const now = nowIso();
  status = {
    task_name: task, task_date: date, status: "draft",
    created_at: now, last_updated_at: now,
    approved_by: null, approved_at: null,
    campaign_angle: null, platforms: ["instagram"],
    history: [{ from: null, to: "draft", at: now, by: "orchestrator", event_type: "first_creation" }],
  };
}

// ---- knowledge base (best-effort) ----------------------------------------
let knowledgeAvailable = true;
const brand = readTextSafe(path.resolve("knowledge", "brand_identity.md"));
const product = readTextSafe(path.resolve("knowledge", "product_campaign.md"));
if (!brand || !product) {
  warn("knowledge/ ausente — checklist seguira com 'marca indisponivel' em algumas regras");
  knowledgeAvailable = false;
}

// ---- 6 regras do checklist -----------------------------------------------
const allCopy = copyTexts.map((p) => readTextSafe(p) || "").join("\n\n");
const allPublish = publishMd ? (readTextSafe(publishMd) || "") : "";
const allText = allCopy + "\n\n" + allPublish;
const allLayouts = adLayouts.map((p) => readTextSafe(p) || "").join("\n");
const allStyles = adStyles.map((p) => readTextSafe(p) || "").join("\n");
const designSurface = allLayouts + "\n" + allStyles;

function ruleNumbers() {
  const targets = ["0%", "3 meses", "R$ 300 mil", "R$ 1,99", "D+10", "D+30", "95%"];
  const lower = allText.toLowerCase();
  const missing = [];
  for (const t of targets) {
    if (lower.indexOf(t.toLowerCase()) === -1) missing.push(t);
  }
  if (missing.length === 0) {
    return { status: "ok", evidence: "Todos presentes: " + targets.join(" · ") };
  }
  return { status: "warn", evidence: "Ausentes: " + missing.join(", ") };
}
function ruleCtas() {
  const ctas = ["Solicitar convite", "Ver condições", "Falar com o time", "Conhecer a plataforma", "Migrar minha operação", "Calcular minha economia"];
  const lower = allText.toLowerCase();
  const found = ctas.filter((c) => lower.indexOf(c.toLowerCase()) !== -1);
  if (found.length > 0) return { status: "ok", evidence: "Encontrados: " + found.join(", ") };
  return { status: "warn", evidence: "Nenhum CTA aprovado detectado" };
}
function rulePalette() {
  const allowed = ["#07212B", "#003554", "#006494", "#5499B5", "#AFBCC9", "#D9DCD6"];
  const blacklist = [
    { pat: /#fff(?![0-9a-f])/i, label: "#fff (branco puro)" },
    { pat: /#ffffff/i, label: "#ffffff (branco puro)" },
    { pat: /#000(?![0-9a-f])/i, label: "#000 (preto puro)" },
    { pat: /#000000/i, label: "#000000 (preto puro)" },
    { pat: /playfair/i, label: "Playfair (fonte off-brand)" },
    { pat: /\bArial\b/i, label: "Arial (fonte off-brand)" },
  ];
  const issues = [];
  for (const b of blacklist) {
    if (b.pat.test(designSurface)) issues.push(b.label);
  }
  // Hex colors fora do allowed
  const hexes = designSurface.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g) || [];
  const offBrand = [];
  for (const h of hexes) {
    const norm = h.toUpperCase();
    const found = allowed.some((a) => a.toUpperCase() === norm);
    if (!found && !["#FFF", "#FFFFFF", "#000", "#000000"].includes(norm)) offBrand.push(h);
  }
  const uniqueOff = [...new Set(offBrand)];
  if (issues.length === 0 && uniqueOff.length === 0) {
    return { status: "ok", evidence: "Paleta dentro de " + allowed.join(", ") };
  }
  const msg = [];
  if (issues.length) msg.push("blacklist: " + issues.join(", "));
  if (uniqueOff.length) msg.push("hexes off-brand: " + uniqueOff.slice(0, 8).join(", "));
  return { status: "warn", evidence: msg.join(" | ") };
}
function ruleCompetitors() {
  const names = ["Greenn", "Hubla", "Kiwify", "Hotmart", "Eduzz", "Ticto", "Cakto", "Monetizze", "Perfect Pay"];
  const re = new RegExp("\\b(" + names.join("|") + ")\\b", "gi");
  const matches = allText.match(re) || [];
  if (matches.length === 0) return { status: "ok", evidence: "Nenhum concorrente nominal" };
  return { status: "warn", evidence: "Citados: " + [...new Set(matches)].join(", ") };
}
function ruleEmoji() {
  // Banidos sempre warn:
  const banned = ["🔥", "⚡", "🚀", "💸", "💰", "😱"];
  const bannedFound = banned.filter((e) => allText.indexOf(e) !== -1);
  // Conta por caption (texto de cada copyTexts)
  let warnCount = 0;
  let evidence = [];
  for (const p of copyTexts) {
    const txt = readTextSafe(p) || "";
    let m;
    try { m = txt.match(/\p{Extended_Pictographic}/gu) || []; }
    catch (e) { m = txt.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []; }
    if (m.length > 1) {
      warnCount++;
      evidence.push(path.basename(p) + " (" + m.length + " emojis)");
    }
  }
  if (bannedFound.length > 0) {
    return { status: "warn", evidence: "Emojis banidos: " + bannedFound.join(" ") + (evidence.length ? " | " + evidence.join(", ") : "") };
  }
  if (warnCount > 0) return { status: "warn", evidence: "Captions com >1 emoji: " + evidence.join(", ") };
  return { status: "ok", evidence: "Emoji <= 1 funcional por caption" };
}
function ruleHashtags() {
  const allTags = (allText.match(/#\w+/g) || []);
  const required = "#4Selet";
  const banned = ["#Sucesso", "#DinheiroFacil", "#MentorDoSucesso"];
  const hasRequired = allTags.some((t) => t.toLowerCase() === required.toLowerCase());
  const bannedFound = allTags.filter((t) => banned.map((b) => b.toLowerCase()).includes(t.toLowerCase()));
  const issues = [];
  if (!hasRequired && allTags.length > 0) issues.push("falta " + required);
  if (bannedFound.length) issues.push("banidas: " + [...new Set(bannedFound)].join(", "));
  if (allTags.length === 0) return { status: "warn", evidence: "Nenhuma hashtag detectada" };
  if (issues.length === 0) return { status: "ok", evidence: "Hashtags OK (" + [...new Set(allTags)].join(" ") + ")" };
  return { status: "warn", evidence: issues.join(" | ") };
}

const checklist = [
  { id: "a", title: "Números Taxa Zero", result: ruleNumbers() },
  { id: "b", title: "CTAs aprovados", result: ruleCtas() },
  { id: "c", title: "Paleta oficial + tipografia", result: rulePalette() },
  { id: "d", title: "Concorrentes nominais", result: ruleCompetitors() },
  { id: "e", title: "Emoji ≤1 funcional", result: ruleEmoji() },
  { id: "f", title: "Hashtags válidas", result: ruleHashtags() },
];

// ---- HTML render ---------------------------------------------------------
function relAsset(p) {
  // path absoluto -> relativo ao taskDir (para uso em src= no HTML)
  return path.relative(taskDir, p).replace(/\\/g, "/");
}
const STATUS_LABEL = {
  draft: "Rascunho", in_review: "Em revisão", approved: "Aprovada", rejected: "Rejeitada",
};

const statusBadgeMod = "status-badge--" + (status.status || "draft");
const platforms = Array.isArray(status.platforms) ? status.platforms.join(" · ") : "—";

// Section 1: Ads grid
let adsSection = "";
if (adImages.length === 0) {
  adsSection = '<p class="empty">Sem entregáveis nesta seção.</p>';
} else {
  const cards = adImages.map((p) => {
    const rel = relAsset(p);
    const name = path.basename(p);
    return '<div class="card card--ad"><div class="thumb"><img src="' + rel + '" alt="' + escapeHtml(name) + '"/></div><div class="filename">' + escapeHtml(name) + "</div></div>";
  }).join("");
  adsSection = '<div class="grid">' + cards + "</div>";
}

// Section 2: Video
let videoSection = "";
if (videoFiles.length === 0) {
  videoSection = '<p class="empty">Sem entregáveis nesta seção.</p>';
} else {
  const poster = videoStills.length ? ' poster="' + relAsset(videoStills[0]) + '"' : "";
  videoSection = videoFiles.map((p) => {
    const rel = relAsset(p);
    return '<div class="video-wrap"><video controls preload="metadata"' + poster + '><source src="' + rel + '"/></video><div class="filename">' + escapeHtml(path.basename(p)) + "</div></div>";
  }).join("");
}

// Section 3: Captions
let captionsSection = "";
if (copyTexts.length === 0) {
  captionsSection = '<p class="empty">Sem entregáveis nesta seção.</p>';
} else {
  const cards = copyTexts.map((p) => {
    const name = path.basename(p);
    const txt = readTextSafe(p) || "";
    const tags = (txt.match(/#\w+/g) || []);
    const tagChips = tags.map((t) => '<span class="chip">' + escapeHtml(t) + "</span>").join("");
    const len = txt.length;
    const ext = path.extname(name);
    let displayBody;
    if (ext === ".json") {
      displayBody = '<pre class="copy-body">' + escapeHtml(txt) + "</pre>";
    } else {
      displayBody = '<pre class="copy-body">' + escapeHtml(txt) + "</pre>";
    }
    return '<div class="card card--copy"><div class="copy-head"><span class="copy-icon">▸</span><span class="copy-platform">' + escapeHtml(name) + '</span></div>' +
      displayBody +
      (tagChips ? '<div class="chips">' + tagChips + "</div>" : "") +
      '<div class="counter">' + len + " caracteres</div></div>";
  }).join("");
  captionsSection = '<div class="grid grid--2">' + cards + "</div>";
}

// Section 4: Research
let researchSection = "";
if (researchFiles.length === 0) {
  researchSection = '<p class="empty">Sem brief de pesquisa.</p>';
} else {
  const items = researchFiles.map((p) => {
    const name = path.basename(p);
    const ext = path.extname(name).toLowerCase();
    let body = "";
    if (ext === ".md") {
      const md = readTextSafe(p) || "";
      body = '<div class="md-rendered">' + mdToHtml(md) + "</div>";
    } else if (ext === ".json") {
      body = '<pre class="research-json">' + escapeHtml(readTextSafe(p) || "") + "</pre>";
    } else if (ext === ".html") {
      body = '<p>Report interativo: <a href="' + relAsset(p) + '" target="_blank">' + escapeHtml(name) + "</a></p>";
    }
    return '<details class="research-item"><summary>' + escapeHtml(name) + "</summary>" + body + "</details>";
  }).join("");
  researchSection = items;
}

// Section 5: Publish MD
let publishSection = "";
if (!publishMd) {
  publishSection = '<p class="empty">Sem Publish MD.</p>';
} else {
  const txt = readTextSafe(publishMd) || "";
  publishSection = '<div class="md-rendered publish-md">' + mdToHtml(txt) + "</div>";
}

// Section 6: Checklist
const ruleCards = checklist.map((r) => {
  const cls = "rule rule--" + r.result.status;
  const icon = r.result.status === "ok" ? "✅" : (r.result.status === "warn" ? "⚠️" : "❌");
  return '<div class="' + cls + '"><span class="icon">' + icon + '</span><div class="rule-body"><h3>' + escapeHtml(r.id + ") " + r.title) + '</h3><p class="evidence">' + escapeHtml(r.result.evidence) + "</p></div></div>";
}).join("");
const checklistSection = '<div class="checklist">' + ruleCards + "</div>";

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Preview — ${escapeHtml(status.task_name)} (${escapeHtml(status.task_date)})</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet"/>
<style>
:root{--darker:#07212B;--navy:#003554;--blue:#006494;--sky:#5499B5;--mist:#AFBCC9;--cloud:#D9DCD6;--bg:#FAFAF7;--ok:#1F7A4D;--warn:#C58A1F;--fail:#A43B2F;}
*{box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{margin:0;font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--darker);line-height:1.6;font-size:15px;}
header.sticky{position:sticky;top:0;z-index:50;background:var(--darker);color:var(--cloud);padding:18px 32px;min-height:96px;display:flex;align-items:center;gap:24px;box-shadow:0 2px 12px rgba(7,33,43,.2);}
header .brand{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px;letter-spacing:2px;color:var(--sky);}
header .title{font-weight:900;font-size:22px;letter-spacing:-.5px;}
header .meta{margin-left:auto;font-size:13px;color:var(--mist);text-align:right;}
header .meta div{margin:2px 0;}
.status-badge{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:600;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-family:'Inter';}
.status-badge--draft{background:var(--mist);color:var(--darker);}
.status-badge--in_review{background:var(--warn);color:var(--darker);}
.status-badge--approved{background:var(--ok);color:var(--cloud);}
.status-badge--rejected{background:var(--fail);color:var(--cloud);}
nav.anchors{position:sticky;top:96px;z-index:49;background:var(--navy);color:var(--cloud);padding:0 32px;height:48px;display:flex;align-items:center;gap:24px;font-size:14px;}
nav.anchors a{color:var(--cloud);text-decoration:none;opacity:.85;font-weight:500;}
nav.anchors a:hover{opacity:1;border-bottom:2px solid var(--sky);}
main{max-width:1280px;margin:0 auto;padding:32px;}
section{margin:48px 0;}
section h2{font-weight:700;font-size:24px;color:var(--darker);margin:0 0 18px;letter-spacing:-.3px;border-bottom:2px solid var(--mist);padding-bottom:10px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;}
.grid--2{grid-template-columns:repeat(auto-fill,minmax(420px,1fr));}
@media (max-width:1023px){.grid--2{grid-template-columns:1fr;}}
.card{background:var(--bg);border-radius:12px;padding:18px;box-shadow:0 2px 12px rgba(7,33,43,.07),0 1px 3px rgba(7,33,43,.04);border:1px solid rgba(175,188,201,.4);}
.card--ad .thumb{aspect-ratio:1/1;overflow:hidden;border-radius:8px;background:var(--navy);display:flex;align-items:center;justify-content:center;}
.card--ad .thumb img{max-width:100%;max-height:100%;display:block;}
.card .filename{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--navy);margin-top:10px;word-break:break-all;}
.video-wrap{max-width:360px;margin:0 auto;}
.video-wrap video{width:100%;border-radius:12px;background:#000;}
.video-wrap .filename{text-align:center;}
.card--copy{display:flex;flex-direction:column;}
.copy-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-weight:600;color:var(--navy);font-size:13px;}
.copy-icon{color:var(--blue);font-weight:900;}
.copy-platform{font-family:'JetBrains Mono',monospace;font-size:12px;}
.copy-body{white-space:pre-wrap;font-family:'Inter';font-size:14px;line-height:1.55;background:rgba(175,188,201,.15);padding:14px;border-radius:8px;margin:0 0 10px;overflow-x:auto;}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}
.chip{background:var(--blue);color:var(--cloud);font-family:'JetBrains Mono',monospace;font-size:11px;padding:3px 8px;border-radius:999px;}
.counter{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--sky);text-align:right;margin-top:6px;}
.research-item{background:#D9DCD6;border-radius:10px;margin:10px 0;padding:14px;}
.research-item summary{cursor:pointer;font-weight:600;color:var(--navy);font-family:'JetBrains Mono',monospace;font-size:13px;}
.research-json{font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--darker);color:var(--cloud);padding:14px;border-radius:6px;overflow-x:auto;max-height:400px;}
.md-rendered h1,.md-rendered h2,.md-rendered h3{margin-top:20px;color:var(--darker);}
.md-rendered h1{font-size:24px;font-weight:900;}
.md-rendered h2{font-size:20px;font-weight:700;color:var(--navy);}
.md-rendered h3{font-size:16px;font-weight:600;}
.md-rendered table{border-collapse:collapse;margin:14px 0;width:100%;font-size:13px;}
.md-rendered th,.md-rendered td{border:1px solid var(--mist);padding:6px 10px;text-align:left;}
.md-rendered th{background:var(--navy);color:var(--cloud);}
.md-rendered code{font-family:'JetBrains Mono',monospace;font-size:.9em;background:rgba(175,188,201,.3);padding:1px 5px;border-radius:3px;}
.md-rendered pre.code{background:var(--darker);color:var(--cloud);padding:14px;border-radius:8px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:12px;}
.md-rendered blockquote{border-left:3px solid var(--blue);padding-left:14px;color:var(--navy);font-style:italic;margin:10px 0;}
.md-rendered a{color:var(--blue);text-decoration:underline;}
.checklist-wrap{background:linear-gradient(135deg,var(--darker) 0%,var(--navy) 100%);padding:48px;border-radius:16px;color:var(--cloud);}
.checklist-wrap h2{color:var(--cloud);border-color:rgba(175,188,201,.3);}
.checklist{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media (max-width:1023px){.checklist{grid-template-columns:1fr;}}
.rule{display:flex;gap:14px;background:rgba(255,255,255,.04);padding:14px;border-radius:10px;border-left:4px solid;align-items:flex-start;}
.rule--ok{border-left-color:var(--ok);}
.rule--warn{border-left-color:var(--warn);}
.rule--fail{border-left-color:var(--fail);}
.rule .icon{font-size:22px;line-height:1;}
.rule h3{margin:0 0 4px;font-size:14px;font-weight:600;color:var(--cloud);}
.rule .evidence{margin:0;font-size:12px;color:var(--mist);font-family:'JetBrains Mono',monospace;line-height:1.5;word-break:break-word;}
.empty{color:var(--sky);font-style:italic;padding:20px;text-align:center;background:rgba(175,188,201,.1);border-radius:8px;}
footer{background:var(--darker);color:var(--mist);padding:24px 32px;min-height:64px;font-size:13px;margin-top:48px;}
footer code{font-family:'JetBrains Mono',monospace;color:var(--sky);}
@media print{body{background:#fff;}.card,.rule{box-shadow:none;border:1px solid var(--mist);}header.sticky,nav.anchors{position:static;}}
</style>
</head>
<body>
<header class="sticky">
  <div>
    <div class="brand">4SELET</div>
    <div class="title">${escapeHtml(status.task_name)}</div>
  </div>
  <div class="meta">
    <div><span class="status-badge ${statusBadgeMod}">${escapeHtml(STATUS_LABEL[status.status] || status.status)}</span></div>
    <div>Ângulo: <strong>${escapeHtml(status.campaign_angle || "(não definido)")}</strong></div>
    <div>Data: ${escapeHtml(status.task_date)} · Atualizado: ${escapeHtml(status.last_updated_at || "—")}</div>
    <div>Plataformas: ${escapeHtml(platforms)}</div>
  </div>
</header>
<nav class="anchors">
  <a href="#ads">Ads</a>
  <a href="#video">Vídeo</a>
  <a href="#captions">Captions</a>
  <a href="#research">Research</a>
  <a href="#publish">Publish</a>
  <a href="#checklist">Checklist</a>
</nav>
<main>
  <section id="ads"><h2>1. Ads</h2>${adsSection}</section>
  <section id="video"><h2>2. Vídeo</h2>${videoSection}</section>
  <section id="captions"><h2>3. Captions</h2>${captionsSection}</section>
  <section id="research"><h2>4. Research</h2>${researchSection}</section>
  <section id="publish"><h2>5. Publish MD</h2>${publishSection}</section>
  <section id="checklist"><div class="checklist-wrap"><h2 style="margin-top:0">6. Checklist de marca</h2>${checklistSection}</div></section>
</main>
<footer>
  <strong>Próximos passos:</strong> Para aprovar: <code>"Aprove a campanha ${escapeHtml(status.task_name)}, task_date ${escapeHtml(status.task_date)}"</code> · Para arquivar: <code>"Arquive a campanha ${escapeHtml(status.task_name)}, task_date ${escapeHtml(status.task_date)}"</code>
  <div style="margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:11px;">Campaign ID: ${escapeHtml(folderName)} · Gerado em ${escapeHtml(nowIso())}${knowledgeAvailable ? "" : " · ⚠ knowledge/ ausente"}</div>
</footer>
</body>
</html>
`;

const previewPath = path.join(taskDir, "preview.html");
fs.writeFileSync(previewPath, html, { encoding: "utf8" });
info("Preview pronto: " + previewPath);

// ---- mutacao idempotente do status.json ----------------------------------
if (status.status === "draft") {
  const now = nowIso();
  status.status = "in_review";
  status.last_updated_at = now;
  status.history.push({
    from: "draft", to: "in_review", at: now,
    by: "distribution-agent", event_type: "transition",
  });
  try { writeJsonAtomic(statusPath, status); }
  catch (e) { fail("falha ao escrever status.json: " + e.message, 2); }
  info("status promovido: draft -> in_review");
} else {
  info("status mantido em '" + status.status + "' (regeneracao idempotente)");
}

process.exit(0);
