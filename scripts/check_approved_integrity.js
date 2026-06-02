// scripts/check_approved_integrity.js — verifica content_hashes de outputs/approved/*
// e (com --auto-revert) move tasks alteradas de volta para outputs/<task>_<date>/
// como draft, registrando event_type=edit_revert em history.
//
// Uso: node scripts/check_approved_integrity.js [--auto-revert]
// Exit codes: 0 ok / sem divergencia, 1 divergencias detectadas, 2 erro tecnico.
"use strict";
const fs = require("fs");
const path = require("path");
const { hashDirectory, diffHashes } = require("./lib/content_hash");

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
function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  let raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", { encoding: "utf8" });
  fs.renameSync(tmp, p);
}
function info(msg) { console.log("[check_approved_integrity] " + msg); }
function warn(msg) { console.error("[check_approved_integrity] WARN: " + msg); }

const autoRevert = process.argv.includes("--auto-revert");
const approvedDir = path.resolve("outputs", "approved");
if (!fs.existsSync(approvedDir)) { info("outputs/approved/ ausente — nada a verificar"); process.exit(0); }

const logsDir = path.resolve("logs");
fs.mkdirSync(logsDir, { recursive: true });
const ts = nowIso().replace(/[^0-9]/g, "").slice(0, 14);
const logPath = path.join(logsDir, "integrity_" + ts + ".log");
const logLines = ["# integrity check - " + nowIso(), ""];

let divergentTasks = 0;
let revertedTasks = 0;

try {
  const dirs = fs.readdirSync(approvedDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const ent of dirs) {
    const taskDir = path.join(approvedDir, ent.name);
    const statusPath = path.join(taskDir, "status.json");
    const status = readJsonSafe(statusPath);
    if (!status) { warn("status.json invalido em " + taskDir + " — pulando"); continue; }
    if (status.status !== "approved") continue;
    if (!status.content_hashes || Object.keys(status.content_hashes).length === 0) {
      warn(ent.name + ": sem content_hashes (task aprovada antes do A.2) — pulando");
      logLines.push("[" + ent.name + "] no content_hashes (legacy)");
      continue;
    }
    const current = hashDirectory(taskDir, ["status.json"]);
    const divs = diffHashes(status.content_hashes, current);
    if (divs.length === 0) {
      logLines.push("[" + ent.name + "] OK (" + Object.keys(current).length + " arquivos)");
      continue;
    }
    divergentTasks++;
    const divDesc = divs.map((d) => d.rel + "(" + d.kind + ")").join(", ");
    warn(ent.name + ": " + divs.length + " divergencias: " + divDesc);
    logLines.push("[" + ent.name + "] " + divs.length + " divergencias: " + divDesc);
    if (!autoRevert) continue;

    // auto-revert: mover para outputs/<task>_<date>/ + history edit_revert
    const dst = path.resolve("outputs", ent.name);
    if (fs.existsSync(dst)) {
      warn("  destino " + dst + " ja existe — pulando auto-revert para " + ent.name);
      logLines.push("  (auto-revert pulado: destino ja existe)");
      continue;
    }
    const now = nowIso();
    status.previous_approval = { approved_at: status.approved_at, approved_by: status.approved_by };
    status.status = "draft";
    status.last_updated_at = now;
    status.auto_reverted_at = now;
    status.revert_reason = "edit_after_approval";
    status.history.push({
      from: "approved", to: "draft", at: now,
      by: "check_approved_integrity", event_type: "edit_revert",
      reason: "edit_after_approval",
    });
    try {
      fs.renameSync(taskDir, dst);
      writeJsonAtomic(path.join(dst, "status.json"), status);
      revertedTasks++;
      info("  auto-revert: " + ent.name + " -> outputs/ (status=draft)");
      logLines.push("  auto-reverted to " + dst);
    } catch (e) {
      warn("  falha auto-revert: " + e.message);
      logLines.push("  ERROR auto-revert: " + e.message);
    }
  }

  fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf8");
  info(divergentTasks + " task(s) com divergencias; " + revertedTasks + " auto-revertidas; log: " + logPath);

  // se houve auto-revert, regenerar INDEX
  if (revertedTasks > 0) {
    const refresh = path.resolve("scripts", "refresh_index.js");
    if (fs.existsSync(refresh)) {
      const { spawnSync } = require("child_process");
      spawnSync(process.execPath, [refresh], { stdio: "inherit" });
    }
  }
  process.exit(divergentTasks > 0 ? 1 : 0);
} catch (e) {
  console.error("[check_approved_integrity] falha tecnica: " + (e && e.message ? e.message : e));
  process.exit(2);
}
