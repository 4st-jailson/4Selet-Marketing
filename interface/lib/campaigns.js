// lib/campaigns.js — CRUD de campanhas (1 arquivo JSON por campanha em ../campaigns).
"use strict";
const fs = require("fs");
const path = require("path");
const { PATHS, BRAND_PILLARS } = require("./config");

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

function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "campanha";
}

function ensureDir() { fs.mkdirSync(PATHS.CAMPAIGNS_DIR, { recursive: true }); }
function filePath(id) { return path.join(PATHS.CAMPAIGNS_DIR, id + ".json"); }
function readJson(p) {
  const raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  return JSON.parse(raw);
}
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, p);
}

function list() {
  ensureDir();
  const out = [];
  for (const f of fs.readdirSync(PATHS.CAMPAIGNS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try { out.push(readJson(path.join(PATHS.CAMPAIGNS_DIR, f))); } catch (e) { /* ignora corrompido */ }
  }
  out.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return out;
}

function get(id) {
  const p = filePath(id);
  if (!fs.existsSync(p)) return null;
  return readJson(p);
}

function uniqueId(base) {
  let id = base, n = 2;
  while (fs.existsSync(filePath(id))) { id = base + "-" + n; n++; }
  return id;
}

function create(obj) {
  ensureDir();
  const now = nowIso();
  const id = obj.id && /^[a-z0-9][a-z0-9_\-]*$/.test(obj.id) ? obj.id : uniqueId(slugify(obj.name));
  if (fs.existsSync(filePath(id))) { const e = new Error("E_CAMPAIGN_EXISTS: id ja existe: " + id); e.code = "E_CAMPAIGN_EXISTS"; throw e; }
  const campaign = {
    id,
    name: String(obj.name).trim(),
    objective: obj.objective || "",
    angle: obj.angle || "",
    status: obj.status || "active",
    pillar: BRAND_PILLARS.includes(obj.pillar) ? obj.pillar : "",
    platforms: Array.isArray(obj.platforms) ? obj.platforms : [],
    key_messages: Array.isArray(obj.key_messages) ? obj.key_messages : (obj.key_messages ? String(obj.key_messages).split("\n").map((s) => s.trim()).filter(Boolean) : []),
    start_date: obj.start_date || "",
    end_date: obj.end_date || "",
    notes: obj.notes || "",
    content_ids: [],
    created_at: now,
    updated_at: now,
  };
  writeJsonAtomic(filePath(id), campaign);
  return campaign;
}

function update(id, patch) {
  const cur = get(id);
  if (!cur) { const e = new Error("E_CAMPAIGN_NOT_FOUND: " + id); e.code = "E_CAMPAIGN_NOT_FOUND"; throw e; }
  const allowed = ["name", "objective", "angle", "status", "pillar", "platforms", "key_messages", "start_date", "end_date", "notes"];
  for (const k of allowed) {
    if (patch[k] === undefined) continue;
    if (k === "key_messages" && !Array.isArray(patch[k])) {
      cur[k] = String(patch[k]).split("\n").map((s) => s.trim()).filter(Boolean);
    } else {
      cur[k] = patch[k];
    }
  }
  cur.updated_at = nowIso();
  writeJsonAtomic(filePath(id), cur);
  return cur;
}

function remove(id) {
  const p = filePath(id);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

// Liga uma task (folder name <task>_<date>) a uma campanha (idempotente).
function linkContent(id, taskFolder) {
  const cur = get(id);
  if (!cur) return null;
  if (!cur.content_ids.includes(taskFolder)) {
    cur.content_ids.push(taskFolder);
    cur.updated_at = nowIso();
    writeJsonAtomic(filePath(id), cur);
  }
  return cur;
}

module.exports = { list, get, create, update, remove, linkContent, slugify, nowIso };
