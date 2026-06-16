// lib/content.js — leitura/escrita de tasks (conteudo) reusando os scripts
// oficiais do projeto como fonte unica de verdade do ciclo de vida.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { PATHS, contentTypeById } = require("./config");

const ZONES = [
  { dir: PATHS.OUTPUTS_DIR, zone: "active" },
  { dir: path.join(PATHS.OUTPUTS_DIR, "approved"), zone: "approved" },
  { dir: path.join(PATHS.OUTPUTS_DIR, "archive"), zone: "archive" },
];

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); } catch (e) { return null; }
}

// Roda um script de scripts/ com cwd = raiz do projeto.
function runScript(scriptFile, argv) {
  const script = path.join(PATHS.SCRIPTS_DIR, scriptFile);
  const r = spawnSync(process.execPath, [script, ...argv], {
    cwd: PATHS.PROJECT_ROOT,
    encoding: "utf8",
  });
  return {
    code: r.status === null ? -1 : r.status,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
    ok: r.status === 0,
  };
}

function isTaskDir(p) {
  return fs.existsSync(path.join(p, "status.json"));
}

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp"];
const VIDEO_EXT = [".mp4", ".mov", ".webm"];
function extOf(rel) { return path.extname(rel).toLowerCase(); }
function isImage(rel) { return IMAGE_EXT.includes(extOf(rel)); }
function isVideo(rel) { return VIDEO_EXT.includes(extOf(rel)); }

// Deduz o "kind" da peca a partir dos arquivos presentes (e do status).
function classifyKind(files) {
  const rels = files.map((f) => (typeof f === "string" ? f : f.rel));
  const has = (re) => rels.some((r) => re.test(r));
  if (rels.some(isVideo) || has(/video\/(scenes|concept)\.json$/)) return "video";
  const slidePngs = rels.filter((r) => /slide_\d+\.png$/i.test(r));
  if (slidePngs.length > 1 || has(/instagram_carousel\.json$/)) return "carousel";
  if (has(/linkedin_post\.txt$/)) return "linkedin";
  if (has(/threads_post\.txt$/)) return "threads";
  // Feed antes de image: o feed tem copy/instagram_caption.txt e renderiza em
  // ads/feed.png — sem esta checagem cairia no ramo generico de ads/*.png (image).
  if (has(/instagram_caption\.txt$/) || has(/ads\/feed\.(png|jpg|jpeg)$/)) return "feed";
  if (has(/ads\/.+\.(png|jpg|jpeg)$/) || has(/ads\/(concept|layout)\.json$/)) return "image";
  if (rels.some(isImage)) return "image";
  return "other";
}

// Primeiro arquivo de imagem (thumbnail) ou video, para preview na biblioteca.
function pickThumb(files) {
  const rels = files.map((f) => (typeof f === "string" ? f : f.rel));
  const img = rels.find((r) => /slide_0*1\.png$/i.test(r)) || rels.find(isImage);
  if (img) return { rel: img, type: "image" };
  const vid = rels.find(isVideo);
  if (vid) return { rel: vid, type: "video" };
  return null;
}

// Lista todas as tasks nas 3 zonas.
function listTasks() {
  const out = [];
  for (const z of ZONES) {
    if (!fs.existsSync(z.dir)) continue;
    for (const name of fs.readdirSync(z.dir)) {
      const full = path.join(z.dir, name);
      let stat;
      try { stat = fs.statSync(full); } catch (e) { continue; }
      if (!stat.isDirectory()) continue;
      if (!isTaskDir(full)) continue;
      const status = readJsonSafe(path.join(full, "status.json"));
      if (!status) continue;
      const files = listFiles(full).filter((f) => f.rel !== "status.json");
      out.push({
        folder: name,
        zone: z.zone,
        path: full,
        task_name: status.task_name,
        title: status.title || null,
        task_date: status.task_date,
        status: status.status,
        campaign_id: status.campaign_id || null,
        campaign_angle: status.campaign_angle || null,
        platforms: status.platforms || [],
        last_updated_at: status.last_updated_at,
        first_viewed_at: status.first_viewed_at || null,
        tags: Array.isArray(status.tags) ? status.tags : [],
        kind: classifyKind(files),
        thumb: pickThumb(files),
      });
    }
  }
  out.sort((a, b) => String(b.last_updated_at || "").localeCompare(String(a.last_updated_at || "")));
  return out;
}

function findTask(folder) {
  for (const z of ZONES) {
    const full = path.join(z.dir, folder);
    if (fs.existsSync(path.join(full, "status.json"))) {
      return { path: full, zone: z.zone };
    }
  }
  return null;
}

// Lista arquivos (recursivo raso) de uma task para exibir no detalhe.
function listFiles(dir, base) {
  base = base || dir;
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...listFiles(full, base));
    } else {
      out.push({ rel: path.relative(base, full).split(path.sep).join("/"), size: stat.size });
    }
  }
  return out;
}

function getTask(folder) {
  const loc = findTask(folder);
  if (!loc) return null;
  const status = readJsonSafe(path.join(loc.path, "status.json"));
  const files = listFiles(loc.path).filter((f) => f.rel !== "status.json");
  // Anota cada arquivo com flags de midia para o front decidir preview.
  const annotated = files.map((f) => ({
    rel: f.rel,
    size: f.size,
    isImage: isImage(f.rel),
    isVideo: isVideo(f.rel),
  }));
  return {
    folder,
    zone: loc.zone,
    path: loc.path,
    status,
    files: annotated,
    tags: Array.isArray(status && status.tags) ? status.tags : [],
    kind: classifyKind(files),
    thumb: pickThumb(files),
    template: (function () {
      const rp = readJsonSafe(path.join(loc.path, "render.json"));
      return (rp && typeof rp.template === "string") ? rp.template : null;
    })(),
  };
}

function readFile(folder, rel) {
  const loc = findTask(folder);
  if (!loc) return null;
  // proteger contra path traversal
  const target = path.normalize(path.join(loc.path, rel));
  if (target !== loc.path && !target.startsWith(loc.path + path.sep)) return null;
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target, "utf8");
}

// Resolve um arquivo da task para servir binario (preview/download).
// Retorna { abs, name } ou null (com guarda de path traversal).
function resolveFile(folder, rel) {
  const loc = findTask(folder);
  if (!loc) return null;
  const target = path.normalize(path.join(loc.path, rel));
  if (target !== loc.path && !target.startsWith(loc.path + path.sep)) return null;
  let stat;
  try { stat = fs.statSync(target); } catch (e) { return null; }
  if (!stat.isFile()) return null;
  return { abs: target, name: path.basename(target) };
}

// Cria a task via orchestrator.js oficial.
function createTask({ task_name, task_date, platforms, angle }) {
  const argv = ["--task", task_name, "--date", task_date];
  if (platforms && platforms.length) argv.push("--platforms", platforms.join(","));
  if (angle) argv.push("--angle", angle);
  return runScript("orchestrator.js", argv);
}

// Escreve um arquivo de conteudo gerado dentro da task (apenas zona active).
// Respeita a regra CRITICAL: nunca escrever em outputs/approved/.
function writeContentFile(folder, rel, content) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone !== "active") {
    const e = new Error("task esta em '" + loc.zone + "' — para editar, rode rework (promote --to in_review) primeiro");
    e.code = "E_NOT_EDITABLE"; throw e;
  }
  const target = path.normalize(path.join(loc.path, rel));
  if (target !== loc.path && !target.startsWith(loc.path + path.sep)) { const e = new Error("path invalido"); e.code = "E_BAD_PATH"; throw e; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return path.relative(loc.path, target).split(path.sep).join("/");
}

// Grava campaign_id no status.json (link bidirecional com a campanha).
function setCampaignId(folder, campaignId) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.campaign_id = campaignId;
  fs.writeFileSync(p, JSON.stringify(status, null, 2) + "\n", "utf8");
  return true;
}

// Grava um titulo de exibicao (humanizado) no status.json, separado do slug tecnico.
function setTitle(folder, title) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.title = String(title || "").slice(0, 120);
  fs.writeFileSync(p, JSON.stringify(status, null, 2) + "\n", "utf8");
  return true;
}

// #8 — Grava a variante de template visual escolhida (render.json) como default
// da arte, SEM renderizar. So vale para pecas estaticas (image/feed/carousel).
const VALID_TEMPLATES = ["editorial", "bold", "split"];
function setTemplate(folder, template) {
  if (!VALID_TEMPLATES.includes(String(template))) return false;
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "render.json");
  const cur = readJsonSafe(p) || {};
  cur.template = String(template);
  fs.writeFileSync(p, JSON.stringify(cur, null, 2) + "\n", "utf8");
  return true;
}

// #5 — Normaliza tags: trim, minusculas, sem vazios/duplicatas, limite de 12.
function normalizeTags(tags) {
  const arr = Array.isArray(tags) ? tags : String(tags || "").split(",");
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const t = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 32);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

// #5 — Grava tags (rotulos livres) no status.json. Funciona em qualquer zona
// (apenas metadado, nao altera conteudo aprovado). Retorna a lista normalizada.
function setTags(folder, tags) {
  const loc = findTask(folder);
  if (!loc) return null;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return null;
  const norm = normalizeTags(tags);
  status.tags = norm;
  fs.writeFileSync(p, JSON.stringify(status, null, 2) + "\n", "utf8");
  return norm;
}

// #4 — Marca a primeira visualizacao da peca (carimba first_viewed_at uma unica
// vez). Idempotente: so escreve se ainda nao houver carimbo. Funciona em qualquer
// zona (apenas grava metadado, nao altera conteudo aprovado).
function markViewed(folder) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status || status.first_viewed_at) return false;
  status.first_viewed_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(status, null, 2) + "\n", "utf8");
  return true;
}

function generatePreview(task_name, task_date) {
  return runScript("generate_preview.js", ["--task", task_name, "--date", task_date]);
}

function promote(task_name, task_date, to, by, reason) {
  const argv = ["--task", task_name, "--date", task_date, "--to", to];
  if (by) argv.push("--by", by);
  if (reason) argv.push("--reason", reason);
  return runScript("promote_task.js", argv);
}

// Descarta uma task movendo-a (reversivel) para outputs/_archived/.
// Nunca remove fisicamente. Recusa tasks ja aprovadas (zona approved).
function discardTask(folder) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone === "approved") {
    const e = new Error("task aprovada nao pode ser descartada — rode rework antes");
    e.code = "E_NOT_DISCARDABLE"; throw e;
  }
  const archivedRoot = path.join(PATHS.OUTPUTS_DIR, "_archived");
  fs.mkdirSync(archivedRoot, { recursive: true });
  let dest = path.join(archivedRoot, folder);
  if (fs.existsSync(dest)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    dest = path.join(archivedRoot, folder + "__" + stamp);
  }
  fs.renameSync(loc.path, dest);
  return { from: loc.path, to: dest };
}

module.exports = {
  listTasks, getTask, findTask, readFile, resolveFile, createTask, writeContentFile,
  setCampaignId, setTitle, setTemplate, markViewed, setTags, normalizeTags, generatePreview, promote, discardTask, classifyKind, pickThumb, runScript,
};
