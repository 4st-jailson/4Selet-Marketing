// scripts/orchestrator.js — wrapper fino sobre scripts/lib/status_bootstrap.
// Cria a pasta outputs/<task>_<date>/ e grava status.json inicial (Step 1.5).
//
// Uso: node scripts/orchestrator.js --task <name> --date <YYYY-MM-DD> [--platforms <csv>] [--angle "<text>"]
// Exit codes: 0 ok, 1 erro de dominio, 2 erro tecnico.
"use strict";
const path = require("path");
const { bootstrapStatusJson } = require("./lib/status_bootstrap");

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
function fail(msg, code) { console.error("[orchestrator] " + msg); process.exit(code || 2); }
function info(msg) { console.log("[orchestrator] " + msg); }

const args = parseArgs(process.argv);
const task = args.task;
const date = args.date;
if (!task || !date) {
  fail("uso: --task <name> --date <YYYY-MM-DD> [--platforms <csv>] [--angle \"<text>\"]", 1);
}
if (!/^[a-z0-9][a-z0-9_\-]*$/.test(task)) fail("task_name invalido (slug a-z0-9_-): " + task, 1);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("task_date invalido (YYYY-MM-DD): " + date, 1);

const ALLOWED_PLAT = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "whatsapp", "email"];
let platforms = ["instagram"];
if (typeof args.platforms === "string") {
  platforms = args.platforms.split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of platforms) {
    if (!ALLOWED_PLAT.includes(p)) fail("plataforma invalida: " + p + " (use: " + ALLOWED_PLAT.join(",") + ")", 1);
  }
}
const angle = typeof args.angle === "string" ? args.angle : null;

try {
  const r = bootstrapStatusJson({
    taskName: task,
    date: date,
    campaignAngle: angle,
    platforms: platforms,
    taskDir: path.resolve("outputs", task + "_" + date),
  });
  if (r.created) info("task bootstrapped: " + r.statusPath + " (status=draft, platforms=" + platforms.join(",") + ")");
  else info("status.json existente preservado (status=" + r.status.status + ") em " + r.statusPath);
  process.exit(0);
} catch (e) {
  if (e && (e.code === "E_REBOOTSTRAP_BLOCKED" || e.code === "E_STATUS_PARSE")) {
    fail(e.message, 1);
  }
  fail("falha inesperada: " + (e && e.message ? e.message : e), 2);
}
