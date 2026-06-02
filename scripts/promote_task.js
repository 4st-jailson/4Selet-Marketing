// scripts/promote_task.js — UNICO ponto de transicao de estado do workflow.
// Centraliza a matriz de transicoes e a movimentacao fisica de pastas.
//
// Uso: node scripts/promote_task.js --task <name> --date <YYYY-MM-DD> --to <draft|in_review|approved|rejected> [--by <user>] [--reason <text>]
// Exit codes: 0 ok, 1 transicao invalida / args insuficientes, 2 erro tecnico.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { hashDirectory } = require("./lib/content_hash");

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
  return (
    d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
    sign + tzH + ":" + tzM
  );
}
function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  let raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  try { return JSON.parse(raw); } catch (e) {
    const err = new Error("E_STATUS_PARSE: JSON invalido em " + p + ": " + e.message + ". Restaure o arquivo a partir de um backup ou git log.");
    err.code = "E_STATUS_PARSE"; throw err;
  }
}
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", { encoding: "utf8" });
  fs.renameSync(tmp, p);
}
function moveDirRobust(src, dst) {
  // tenta rename; cross-device → cp -r + rm -rf; retry 1x em FS lock
  const tryRename = () => { fs.renameSync(src, dst); };
  try { tryRename(); return; } catch (e) {
    if (e.code === "EBUSY" || e.code === "EPERM") {
      // FS lock no Windows → retry 1x apos 200ms
      const wait = Date.now() + 200;
      while (Date.now() < wait) { /* busy-wait curto */ }
      try { tryRename(); return; } catch (e2) {
        throw new Error("falha ao mover (lock): " + src + " -> " + dst + " (" + e2.message + ")");
      }
    }
    if (e.code === "EXDEV") {
      // cross-device → copia + apaga
      fs.cpSync(src, dst, { recursive: true });
      fs.rmSync(src, { recursive: true, force: true });
      return;
    }
    throw e;
  }
}
function info(msg) { console.log("[promote_task] " + msg); }
function warn(msg) { console.error("[promote_task] WARN: " + msg); }
function fail(msg, code) { console.error("[promote_task] " + msg); process.exit(code || 2); }

// ---- main ----------------------------------------------------------------
const args = parseArgs(process.argv);
const task = args.task;
const date = args.date;
const target = args.to;
const by = args.by;
const reason = args.reason;

if (!task || !date || !target) {
  fail("uso: --task <name> --date <YYYY-MM-DD> --to <draft|in_review|approved|rejected> [--by <user>] [--reason <text>]", 1);
}

const VALID_STATES = ["draft", "in_review", "approved", "rejected"];
if (!VALID_STATES.includes(target)) {
  fail("E_UNKNOWN_STATE: '" + target + "' nao e um estado valido. Validos: " + VALID_STATES.join("|"), 1);
}

const LEGAL_TRANSITIONS = {
  null: ["draft"],
  draft: ["in_review"],
  in_review: ["approved", "rejected"],
  approved: ["in_review"],
  rejected: ["in_review"],
};

const folderName = task + "_" + date;
const candidates = [
  { path: path.resolve("outputs", folderName), zone: "active" },
  { path: path.resolve("outputs", "approved", folderName), zone: "approved" },
  { path: path.resolve("outputs", "archive", folderName), zone: "archive" },
];
const found = candidates.filter((c) => fs.existsSync(c.path));
if (found.length === 0) fail("task nao encontrada em outputs/ (" + folderName + ")", 1);
if (found.length > 1) {
  const list = found.map((f) => "  - " + f.path).join("\n");
  fail("E_DUPLICATE_LOCATION: task encontrada em " + found.length + " zonas — resolva manualmente:\n" + list, 2);
}

const src = found[0];
const statusPath = path.join(src.path, "status.json");
let status;
try {
  status = readJsonSafe(statusPath);
  if (!status) fail("status.json ausente em " + statusPath, 2);
} catch (e) {
  if (e.code === "E_STATUS_PARSE" || e.code === "E_JSON_CORRUPT") fail(e.message, 2); else throw e;
}

const current = status.status;
if (current === target) {
  fail("E_INVALID_TRANSITION: task ja esta em '" + target + "'", 1);
}
const legal = LEGAL_TRANSITIONS[current] || [];
if (!legal.includes(target)) {
  let sug = "";
  if (current === "draft" && target === "approved") sug = " Rota legal: draft -> in_review -> approved. Rode primeiro 'node scripts/generate_preview.js --task " + task + " --date " + date + "'.";
  else if (current === "rejected" && target === "approved") sug = " Rota legal: rejected -> in_review -> approved. Rode primeiro --to in_review (rework).";
  else if (current === "approved" && target === "rejected") sug = " Aprovadas nao podem ser rejeitadas. Use --to in_review (rework) e depois rejeite, ou edite os arquivos (auto-revert).";
  fail("E_INVALID_TRANSITION: '" + current + "' -> '" + target + "' nao e permitido. Legais a partir de '" + current + "': [" + legal.join(", ") + "]." + sug, 1);
}

if (target === "approved" && !by) {
  fail("E_MISSING_APPROVER: --by <user> obrigatorio em transicoes para approved. Exemplo: --by \"QA\"", 1);
}
if (target === "rejected" && !reason) {
  warn("--reason ausente em rejected (recomendado)");
}

// Mutar status.json
const now = nowIso();
status.status = target;
status.last_updated_at = now;
if (target === "approved") {
  status.approved_by = by;
  status.approved_at = now;
  // A.2 — snapshot SHA-256 dos arquivos (excluindo o proprio status.json) para
  // permitir check_approved_integrity detectar edicoes pos-aprovacao.
  try {
    status.content_hashes = hashDirectory(src.path, ["status.json"]);
  } catch (e) {
    warn("falha ao calcular content_hashes (seguindo sem): " + e.message);
  }
} else if (target === "rejected") {
  status.rejected_by = by || "unknown";
  status.rejected_at = now;
  status.rejection_reason = reason || "";
} else if (target === "in_review" && (current === "rejected" || current === "approved")) {
  // rework: limpa rejeicao; preserva approved_by/approved_at como historico
  if (current === "rejected") {
    delete status.rejected_by; delete status.rejected_at; delete status.rejection_reason;
    status.revision = (status.revision || 0) + 1;
  }
}

const histEntry = {
  from: current,
  to: target,
  at: now,
  by: by || "promote_task",
  event_type: "promoted",
};
if (target === "rejected" && reason) histEntry.reason = reason;
status.history.push(histEntry);

// Decidir destino
let dstDir;
if (target === "approved") {
  dstDir = path.resolve("outputs", "approved", folderName);
} else if (target === "rejected") {
  dstDir = path.resolve("outputs", "archive", folderName);
} else if (target === "in_review" && (src.zone === "approved" || src.zone === "archive")) {
  dstDir = path.resolve("outputs", folderName);
} else {
  dstDir = src.path; // sem movimento (in_review vindo de draft, etc.)
}

// Mover pasta (se aplicavel)
if (dstDir !== src.path) {
  // garantir parent
  fs.mkdirSync(path.dirname(dstDir), { recursive: true });
  if (fs.existsSync(dstDir)) {
    fail("destino ja existe: " + dstDir + " (resolva manualmente)", 2);
  }
  try {
    moveDirRobust(src.path, dstDir);
  } catch (e) {
    fail("falha ao mover: " + e.message, 2);
  }
}

// Persistir status.json no path final
const finalStatusPath = path.join(dstDir, "status.json");
try {
  writeJsonAtomic(finalStatusPath, status);
} catch (e) {
  fail("falha ao escrever status.json em " + finalStatusPath + ": " + e.message, 2);
}

// Side-effect: refresh INDEX se aprovado/rejeitado OU se origem era approved/
// (cobre rework approved -> in_review, mantendo INDEX limpo).
if (target === "approved" || target === "rejected" || src.zone === "approved") {
  const refreshScript = path.resolve("scripts", "refresh_index.js");
  if (fs.existsSync(refreshScript)) {
    const r = spawnSync(process.execPath, [refreshScript], { stdio: "inherit" });
    if (r.status !== 0) warn("refresh_index.js retornou exit " + r.status + " (nao fatal)");
  } else {
    warn("scripts/refresh_index.js nao encontrado — INDEX nao atualizado");
  }
}

info(folderName + ": " + current + " -> " + target + " | path: " + dstDir);
process.exit(0);
