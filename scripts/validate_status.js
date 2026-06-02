// scripts/validate_status.js — valida todos os status.json contra o schema basico.
// Reporta inconsistencias: campos faltantes, status divergente do history.to,
// pasta em zona inconsistente com status, content_hashes ausentes em approved.
//
// Uso: node scripts/validate_status.js [--task <name> --date <YYYY-MM-DD>]
// Exit codes: 0 ok / valido, 1 inconsistencias detectadas, 2 erro tecnico.
"use strict";
const fs = require("fs");
const path = require("path");

function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  let raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  try { return JSON.parse(raw); } catch (e) {
    return { __parse_error: e.message };
  }
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}

const REQUIRED = ["task_name", "task_date", "status", "created_at", "last_updated_at", "approved_by", "approved_at", "campaign_angle", "platforms", "history"];
const STATES = ["draft", "in_review", "approved", "rejected"];
const ZONES = { "outputs": "draft|in_review", "outputs/approved": "approved", "outputs/archive": "rejected" };

function validate(taskDir, zone) {
  const statusPath = path.join(taskDir, "status.json");
  const errors = [];
  if (!fs.existsSync(statusPath)) {
    errors.push("INVALID_SCHEMA_MISSING_STATUS_JSON");
    return errors;
  }
  const status = readJsonSafe(statusPath);
  if (!status) { errors.push("INVALID_SCHEMA_NULL"); return errors; }
  if (status.__parse_error) { errors.push("INVALID_SCHEMA_PARSE: " + status.__parse_error); return errors; }
  for (const k of REQUIRED) {
    if (!(k in status)) errors.push("INVALID_SCHEMA_MISSING_FIELD: " + k);
  }
  if (!STATES.includes(status.status)) errors.push("INVALID_STATUS_VALUE: '" + status.status + "'");
  if (!Array.isArray(status.history) || status.history.length === 0) errors.push("INVALID_HISTORY_EMPTY");
  else {
    const lastTo = status.history[status.history.length - 1].to;
    if (lastTo !== status.status) errors.push("STATUS_HISTORY_MISMATCH: status='" + status.status + "' mas history.last.to='" + lastTo + "'");
  }
  if (status.status === "approved") {
    if (!status.approved_by) errors.push("INCONSISTENT_APPROVAL_STATE: status='approved' mas approved_by=null");
    if (!status.approved_at) errors.push("INCONSISTENT_APPROVAL_STATE: status='approved' mas approved_at=null");
    if (!status.content_hashes || Object.keys(status.content_hashes || {}).length === 0) {
      errors.push("MISSING_CONTENT_HASHES (approved sem hashes — task aprovada antes do A.2 ou via importacao legacy)");
    }
  }
  if (status.task_date && !/^\d{4}-\d{2}-\d{2}$/.test(status.task_date)) errors.push("INVALID_DATE_FORMAT: '" + status.task_date + "'");
  // Coerencia zona vs status
  const expected = ZONES[zone];
  if (expected) {
    const ok = expected.split("|").includes(status.status);
    if (!ok) errors.push("ZONE_STATUS_MISMATCH: pasta em '" + zone + "' mas status='" + status.status + "' (esperado: " + expected + ")");
  }
  return errors;
}

function scanZone(zoneRoot, zoneLabel) {
  if (!fs.existsSync(zoneRoot)) return [];
  const out = [];
  for (const ent of fs.readdirSync(zoneRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (zoneLabel === "outputs" && (ent.name === "approved" || ent.name === "archive")) continue;
    out.push({ dir: path.join(zoneRoot, ent.name), name: ent.name, zone: zoneLabel });
  }
  return out;
}

try {
  const args = parseArgs(process.argv);
  let targets;
  if (args.task && args.date) {
    const folder = args.task + "_" + args.date;
    targets = [
      { dir: path.resolve("outputs", folder), name: folder, zone: "outputs" },
      { dir: path.resolve("outputs", "approved", folder), name: folder, zone: "outputs/approved" },
      { dir: path.resolve("outputs", "archive", folder), name: folder, zone: "outputs/archive" },
    ].filter((t) => fs.existsSync(t.dir));
    if (targets.length === 0) { console.error("[validate_status] task nao encontrada: " + folder); process.exit(2); }
  } else {
    targets = [
      ...scanZone(path.resolve("outputs"), "outputs"),
      ...scanZone(path.resolve("outputs", "approved"), "outputs/approved"),
      ...scanZone(path.resolve("outputs", "archive"), "outputs/archive"),
    ];
  }

  let bad = 0;
  for (const t of targets) {
    const errs = validate(t.dir, t.zone);
    if (errs.length === 0) {
      console.log("[validate_status] OK " + t.zone + "/" + t.name);
    } else {
      bad++;
      console.error("[validate_status] FAIL " + t.zone + "/" + t.name);
      for (const e of errs) console.error("  - " + e);
    }
  }
  console.log("[validate_status] " + (targets.length - bad) + "/" + targets.length + " validos");
  process.exit(bad > 0 ? 1 : 0);
} catch (e) {
  console.error("[validate_status] falha tecnica: " + (e && e.message ? e.message : e));
  process.exit(2);
}
