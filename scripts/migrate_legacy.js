// scripts/migrate_legacy.js — bootstrap retroativo de status.json em tasks legadas.
// Varre outputs/* (e opcionalmente test/campanha-demo/*) procurando pastas sem
// status.json e cria o arquivo com event_type=legacy_import.
//
// Uso: node scripts/migrate_legacy.js [--dry-run] [--include-test]
// Exit codes: 0 ok, 2 erro tecnico.
"use strict";
const fs = require("fs");
const path = require("path");

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
function mtimeIso(p) {
  const stat = fs.statSync(p);
  const d = new Date(stat.mtimeMs);
  const pad = (n) => String(n).padStart(2, "0");
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const tzH = pad(Math.floor(Math.abs(tzMin) / 60));
  const tzM = pad(Math.abs(tzMin) % 60);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
    sign + tzH + ":" + tzM;
}
function info(msg) { console.log("[migrate_legacy] " + msg); }
function warn(msg) { console.error("[migrate_legacy] WARN: " + msg); }

const dryRun = process.argv.includes("--dry-run");
const includeTest = process.argv.includes("--include-test");

// Tenta extrair task_name + task_date da forma "<slug>_<YYYY-MM-DD>" ou usar fallback
function parseFolderName(name) {
  const m = name.match(/^(.+)_(\d{4}-\d{2}-\d{2})$/);
  if (m) return { task_name: m[1], task_date: m[2] };
  // fallback: nome todo como task_name; data = hoje
  return { task_name: name, task_date: nowIso().slice(0, 10) };
}

function scanZone(zoneRoot, zoneLabel) {
  if (!fs.existsSync(zoneRoot)) return [];
  const out = [];
  for (const ent of fs.readdirSync(zoneRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    // pula subzonas (approved/, archive/) ao escanear outputs/ raiz
    if (zoneLabel === "outputs" && (ent.name === "approved" || ent.name === "archive")) continue;
    const dir = path.join(zoneRoot, ent.name);
    const statusPath = path.join(dir, "status.json");
    if (fs.existsSync(statusPath)) continue; // ja tem status; pular
    out.push({ dir, name: ent.name, zone: zoneLabel });
  }
  return out;
}

try {
  const targets = [
    ...scanZone(path.resolve("outputs"), "outputs"),
    ...scanZone(path.resolve("outputs", "approved"), "outputs/approved"),
    ...scanZone(path.resolve("outputs", "archive"), "outputs/archive"),
  ];
  if (includeTest) {
    targets.push(...scanZone(path.resolve("test", "campanha-demo"), "test/campanha-demo"));
  }

  if (targets.length === 0) { info("nenhuma task legada encontrada"); process.exit(0); }

  info((dryRun ? "[DRY-RUN] " : "") + "alvos: " + targets.length);
  let migrated = 0;
  for (const t of targets) {
    const parsed = parseFolderName(t.name);
    const created_at = mtimeIso(t.dir);
    const status = {
      task_name: parsed.task_name,
      task_date: parsed.task_date,
      status: t.zone === "outputs/approved" ? "approved" : (t.zone === "outputs/archive" ? "rejected" : "draft"),
      created_at: created_at,
      last_updated_at: nowIso(),
      approved_by: t.zone === "outputs/approved" ? "legacy_import" : null,
      approved_at: t.zone === "outputs/approved" ? nowIso() : null,
      campaign_angle: null,
      platforms: ["instagram"],
      legacy: true,
      history: [{
        from: null, to: "draft", at: created_at,
        by: "migrate_legacy", event_type: "legacy_import",
        reason: "bootstrap retroativo de task pre-Workflow (" + t.zone + ")",
      }],
    };
    if (status.status !== "draft") {
      status.history.push({
        from: "draft", to: status.status, at: nowIso(),
        by: "migrate_legacy", event_type: "legacy_import",
        reason: "estado inferido da zona '" + t.zone + "'",
      });
    }
    if (status.status === "rejected") { status.rejection_reason = "(importado de archive sem motivo registrado)"; status.rejected_by = "legacy_import"; status.rejected_at = nowIso(); }

    const statusPath = path.join(t.dir, "status.json");
    if (dryRun) {
      info("  [DRY] " + t.zone + "/" + t.name + " -> status=" + status.status + " · campos=" + Object.keys(status).join(","));
    } else {
      const tmp = statusPath + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(status, null, 2) + "\n", "utf8");
      fs.renameSync(tmp, statusPath);
      info("  migrada: " + t.zone + "/" + t.name + " -> status=" + status.status);
      migrated++;
    }
  }
  info((dryRun ? "DRY-RUN: " : "") + migrated + "/" + targets.length + " tasks migradas");
  process.exit(0);
} catch (e) {
  console.error("[migrate_legacy] falha tecnica: " + (e && e.message ? e.message : e));
  process.exit(2);
}
