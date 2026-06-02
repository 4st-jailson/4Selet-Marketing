// scripts/lib/status_bootstrap.js — bootstrap idempotente de status.json.
// Usado por scripts/orchestrator.js (wrapper) e skills/orchestrator/scripts/orchestrate.js (real).
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
function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  let raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  try { return JSON.parse(raw); } catch (e) {
    const err = new Error("E_STATUS_PARSE: JSON invalido em " + p + ": " + e.message);
    err.code = "E_STATUS_PARSE"; throw err;
  }
}
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", { encoding: "utf8" });
  fs.renameSync(tmp, p);
}

// Bootstrap idempotente. Cria status.json se nao existir; se existir, anexa
// history (re-bootstrap) ou bloqueia (approved/rejected).
//
// Args: { taskName, date, campaignAngle?, platforms?, taskDir? }
// Retorna: { created: bool, status, statusPath, action: "created"|"rebootstrapped" }
// Pode lancar:
//   E_REBOOTSTRAP_BLOCKED — task ja existe em approved/rejected (nao sobrescrever historico)
//   E_STATUS_PARSE         — status.json corrompido
function bootstrapStatusJson(opts) {
  const taskName = opts.taskName;
  const date = opts.date;
  const campaignAngle = opts.campaignAngle == null ? null : opts.campaignAngle;
  const platforms = Array.isArray(opts.platforms) && opts.platforms.length > 0
    ? opts.platforms : ["instagram"];
  const taskDir = opts.taskDir || path.resolve("outputs", taskName + "_" + date);
  const statusPath = path.join(taskDir, "status.json");

  fs.mkdirSync(taskDir, { recursive: true });

  if (fs.existsSync(statusPath)) {
    const cur = readJsonSafe(statusPath);
    if (!cur) {
      const err = new Error("E_STATUS_PARSE: status.json vazio/invalido em " + statusPath);
      err.code = "E_STATUS_PARSE"; throw err;
    }
    if (cur.status === "approved" || cur.status === "rejected") {
      const err = new Error(
        "E_REBOOTSTRAP_BLOCKED: task ja existe em estado '" + cur.status +
        "' — nao sobrescrever historico. Para retomar, rode: " +
        "node scripts/promote_task.js --task " + taskName + " --date " + date + " --to in_review"
      );
      err.code = "E_REBOOTSTRAP_BLOCKED"; throw err;
    }
    const now = nowIso();
    cur.history.push({
      from: cur.status, to: cur.status, at: now,
      by: "orchestrator", event_type: "transition",
      reason: "re-bootstrap (pasta ja existia em estado '" + cur.status + "')",
    });
    cur.last_updated_at = now;
    writeJsonAtomic(statusPath, cur);
    return { created: false, status: cur, statusPath, action: "rebootstrapped" };
  }

  const now = nowIso();
  const status = {
    task_name: taskName,
    task_date: date,
    status: "draft",
    created_at: now,
    last_updated_at: now,
    approved_by: null,
    approved_at: null,
    campaign_angle: campaignAngle,
    platforms: platforms,
    history: [
      { from: null, to: "draft", at: now, by: "orchestrator", event_type: "first_creation" },
    ],
  };
  writeJsonAtomic(statusPath, status);
  return { created: true, status, statusPath, action: "created" };
}

module.exports = { bootstrapStatusJson, nowIso, readJsonSafe, writeJsonAtomic };
