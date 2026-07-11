// lib/schedule.js — agendamento de publicações. Guarda os posts a disparar e um worker
// em segundo plano publica no horário marcado. A publicação em si (com o gate de aprovação)
// é o lib/publish; aqui é só a fila + o relógio. Estado em interface/data/schedule.json.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS } = require("./config");

const FILE = path.join(PATHS.DATA_DIR, "schedule.json");

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return []; } }
function save(list) {
  if (!fs.existsSync(PATHS.DATA_DIR)) fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

// Cria um agendamento (pendente). scheduled_at = ISO string.
function add({ folder, kind, caption, scheduled_at, by, label }) {
  const when = new Date(scheduled_at);
  if (isNaN(when.getTime())) { const e = new Error("Data/hora inválida."); e.code = "E_BAD_DATE"; throw e; }
  const list = load();
  const item = {
    id: crypto.randomBytes(8).toString("hex"),
    folder, label: label || folder, kind: kind || null, caption: caption || null,
    scheduled_at: when.toISOString(), status: "pending",
    created_at: new Date().toISOString(), by: by || null,
  };
  list.push(item); save(list); return item;
}
function list() { return load().slice().sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))); }
function get(id) { return load().find((x) => x.id === id) || null; }
function update(id, patch) {
  const l = load(); const it = l.find((x) => x.id === id);
  if (!it) return null; Object.assign(it, patch); save(l); return it;
}
// Cancela/suspende um agendamento ainda pendente.
function cancel(id) {
  const l = load(); const it = l.find((x) => x.id === id);
  if (!it) return null;
  if (it.status !== "pending") { const e = new Error("Só dá para cancelar um agendamento que ainda está pendente."); e.code = "E_NOT_PENDING"; throw e; }
  it.status = "cancelled"; it.cancelled_at = new Date().toISOString(); save(l); return it;
}

// Worker: a cada minuto, dispara os pendentes cujo horário já chegou. publishFn recebe
// (folder, {kind, caption}) e devolve { ok, dry_run, post_id }. Marca "publishing" antes
// de chamar (evita disparo duplo) e grava o resultado.
let started = false;
function startWorker(publishFn) {
  if (started) return; started = true;
  const tick = async () => {
    const now = Date.now();
    const due = load().filter((x) => x.status === "pending" && new Date(x.scheduled_at).getTime() <= now);
    for (const it of due) {
      update(it.id, { status: "publishing", started_at: new Date().toISOString() });
      try {
        const r = await publishFn(it.folder, { kind: it.kind, caption: it.caption });
        update(it.id, { status: r && r.dry_run ? "simulado" : "published", post_id: (r && r.post_id) || null, published_at: new Date().toISOString() });
      } catch (e) {
        update(it.id, { status: "failed", error: (e && e.message ? e.message : String(e)).slice(0, 300), failed_at: new Date().toISOString() });
      }
    }
  };
  setInterval(() => { tick().catch(() => {}); }, 60 * 1000).unref();
  setTimeout(() => { tick().catch(() => {}); }, 4000).unref(); // roda logo após o boot (pega atrasados)
}

module.exports = { add, list, get, update, cancel, startWorker };
