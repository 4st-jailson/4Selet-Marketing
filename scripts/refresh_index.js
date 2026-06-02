// scripts/refresh_index.js — regenera outputs/approved/INDEX.md.
// Idempotente; sem args; safe quando nao ha tasks aprovadas.
//
// Exit codes: 0 ok (mesmo com 0 tasks), 2 erro tecnico.
"use strict";
const fs = require("fs");
const path = require("path");

function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  let raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  try { return JSON.parse(raw); } catch (e) { return null; }
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
function fmtDateBr(iso) {
  // recebe ISO; retorna DD/MM HH:MM em local
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, "0");
  return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
function info(msg) { console.log("[refresh_index] " + msg); }
function warn(msg) { console.error("[refresh_index] WARN: " + msg); }

const approvedDir = path.resolve("outputs", "approved");
try {
  fs.mkdirSync(approvedDir, { recursive: true });

  const entries = fs.readdirSync(approvedDir, { withFileTypes: true });
  const rows = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const taskDir = path.join(approvedDir, ent.name);
    const statusPath = path.join(taskDir, "status.json");
    const status = readJsonSafe(statusPath);
    if (!status) { warn("status.json invalido/ausente em " + statusPath + " (pulando)"); continue; }
    if (status.status !== "approved") {
      warn("task em " + ent.name + " tem status '" + status.status + "' dentro de approved/ (pulando)");
      continue;
    }
    rows.push({
      task: status.task_name,
      date: status.task_date,
      angle: status.campaign_angle || "—",
      platforms: Array.isArray(status.platforms) ? status.platforms.join(", ") : "—",
      approved_at: status.approved_at,
      approved_by: status.approved_by || "—",
      dirname: ent.name,
    });
  }

  rows.sort((a, b) => {
    if (!a.approved_at) return 1;
    if (!b.approved_at) return -1;
    return b.approved_at.localeCompare(a.approved_at);
  });

  let md = "# Campanhas Aprovadas\n\n";
  md += "*Atualizado em " + nowIso() + "*\n\n";
  if (rows.length === 0) {
    md += "Nenhuma campanha aprovada ainda.\n";
  } else {
    md += "| Task | Data | Ângulo | Plataformas | Aprovado em | Por | Preview |\n";
    md += "|---|---|---|---|---|---|---|\n";
    for (const r of rows) {
      const previewLink = "[ver](./" + r.dirname + "/preview.html)";
      const angle = String(r.angle).replace(/\|/g, "\\|").slice(0, 80);
      md += "| `" + r.task + "` | " + r.date + " | " + angle + " | " + r.platforms + " | " + fmtDateBr(r.approved_at) + " | " + r.approved_by + " | " + previewLink + " |\n";
    }
  }
  const indexPath = path.join(approvedDir, "INDEX.md");
  fs.writeFileSync(indexPath, md, { encoding: "utf8" });
  info(rows.length + " campanhas indexadas em outputs/approved/INDEX.md");
  process.exit(0);
} catch (e) {
  console.error("[refresh_index] falha tecnica: " + (e && e.message ? e.message : e));
  process.exit(2);
}
