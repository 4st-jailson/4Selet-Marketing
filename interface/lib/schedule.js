// lib/schedule.js — agendamento de publicações. Guarda os posts a disparar e um worker
// em segundo plano publica no horário marcado. A publicação em si (com o gate de aprovação)
// é o lib/publish; aqui é só a fila + o relógio. Estado em interface/data/schedule.json.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS, DESTINO_IDS } = require("./config");
const publications = require("./publications");

const FILE = path.join(PATHS.DATA_DIR, "schedule.json");

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return []; } }
function save(list) {
  if (!fs.existsSync(PATHS.DATA_DIR)) fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

// Agendamentos ainda pendentes de uma peça (usado para evitar duplicidade).
// Pendentes de uma peça. Com `destino`, só os daquele destino — é o que permite ter o feed
// publicado e o story ainda agendado ao mesmo tempo. Sem `destino`, todos (usado ao descartar a peça).
// Agendamento antigo, gravado antes deste campo existir, conta como "feed".
function destinoDe(x) { return DESTINO_IDS.indexOf(x && x.destino) >= 0 ? x.destino : "feed"; }
function pendingFor(folder, destino) {
  return load().filter((x) => x.folder === folder && x.status === "pending"
    && (!destino || destinoDe(x) === destino));
}

// Cancela todos os pendentes de uma peça. Usado quando a peça é publicada por outro caminho
// (botão "Publicar agora" ou marcação manual): sem isso, o agendamento dispararia depois e
// postaria a MESMA peça uma segunda vez, horas mais tarde, sem ninguém olhando.
function cancelPendingFor(folder, reason, destino) {
  const l = load();
  const hit = l.filter((x) => x.folder === folder && x.status === "pending"
    && (!destino || destinoDe(x) === destino));
  if (!hit.length) return [];
  const now = new Date().toISOString();
  for (const it of hit) { it.status = "cancelled"; it.cancelled_at = now; it.cancelled_reason = reason || "a peça foi publicada por outro caminho"; }
  save(l);
  return hit;
}

// Cria um agendamento (pendente). scheduled_at = ISO string.
function add({ folder, kind, caption, scheduled_at, by, label, destino }) {
  const when = new Date(scheduled_at);
  if (isNaN(when.getTime())) { const e = new Error("Data/hora inválida."); e.code = "E_BAD_DATE"; throw e; }
  // Um agendamento pendente por peça. Duplo clique no botão "Agendar" (ou um retry) criava dois
  // itens iguais, e cada um virava um post no horário marcado.
  const dest = DESTINO_IDS.indexOf(destino) >= 0 ? destino : "feed";
  if (pendingFor(folder, dest).length) {
    const e = new Error("Esta peça já tem um agendamento pendente para " + dest + ". Cancele o atual antes de criar outro.");
    e.code = "E_ALREADY_SCHEDULED"; throw e;
  }
  const list = load();
  const item = {
    id: crypto.randomBytes(8).toString("hex"),
    folder, label: label || folder, kind: kind || null, caption: caption || null, destino: dest,
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

// Destrava itens que ficaram presos em "publishing". O processo pode morrer (deploy, OOM)
// entre marcar "publishing" e gravar o resultado; como o tick só olha "pending", o item ficava
// nesse limbo PARA SEMPRE e ninguém sabia se o post tinha saído. Aqui marcamos como falho, com
// texto pedindo conferência manual no Instagram — nunca republicamos sozinhos (risco de post duplo).
const STUCK_MS = 10 * 60 * 1000;
function recoverStuck() {
  const l = load();
  const now = Date.now();
  let changed = false;
  for (const it of l) {
    if (it.status !== "publishing") continue;
    const since = it.started_at ? new Date(it.started_at).getTime() : 0;
    if (since && now - since < STUCK_MS) continue; // ainda pode estar rodando
    it.status = "failed";
    it.error = "A publicação foi interrompida (o painel reiniciou no meio). Confira no Instagram se o post saiu antes de publicar de novo.";
    it.failed_at = new Date().toISOString();
    changed = true;
    console.error("[schedule] agendamento preso em publishing destravado:", it.id, it.folder);
  }
  if (changed) save(l);
}

function startWorker(publishFn, isPublishedFn) {
  if (started) return; started = true;
  recoverStuck();
  const tick = async () => {
    recoverStuck();
    const now = Date.now();
    const due = load().filter((x) => x.status === "pending" && new Date(x.scheduled_at).getTime() <= now);
    for (const it of due) {
      // A peça pode ter sido publicada na mão depois de agendada. Publicar de novo aqui
      // duplicaria o post na conta real, então pulamos e registramos o porquê.
      if (typeof isPublishedFn === "function") {
        let already = false;
        try { already = !!isPublishedFn(it.folder); } catch (e) { already = false; }
        if (already) {
          update(it.id, { status: "skipped", skipped_at: new Date().toISOString(), error: "A peça já tinha sido publicada antes do horário agendado — não publiquei de novo." });
          continue;
        }
      }
      update(it.id, { status: "publishing", started_at: new Date().toISOString() });
      try {
        const r = await publishFn(it.folder, { kind: it.kind, caption: it.caption });
        update(it.id, { status: r && r.dry_run ? "simulado" : "published", post_id: (r && r.post_id) || null, published_at: new Date().toISOString() });
        if (r && r.ok && !r.dry_run) {
          // MARCA A PEÇA como publicada — sem isto, o post agendado não deixa rastro no
          // status.json e o guard de post duplicado (409 E_ALREADY_PUBLISHED na rota) NÃO
          // dispara: um "Publicar agora" depois do agendado sairia como SEGUNDO post na conta
          // real. A rota já fazia isto; o disparador do agendamento não fazia.
          try { require("./content").setPublished(it.folder, { by: it.by, post_id: r.post_id }); }
          catch (e) { console.error("[schedule] post publicado mas falhou ao marcar a peça:", it.folder, e && e.message); }
          // registra no histórico de publicações (aba "Publicados") quando saiu de verdade
          try { publications.add({ folder: it.folder, label: it.label, kind: it.kind, destino: destinoDe(it), caption: it.caption, post_id: r.post_id, permalink: r.permalink, scheduled_at: it.scheduled_at, by: it.by }); }
          catch (e) { console.error("[schedule] post publicado mas falhou ao registrar no histórico:", it.folder, e && e.message); }
        }
      } catch (e) {
        update(it.id, { status: "failed", error: (e && e.message ? e.message : String(e)).slice(0, 300), failed_at: new Date().toISOString() });
      }
    }
  };
  setInterval(() => { tick().catch(() => {}); }, 60 * 1000).unref();
  setTimeout(() => { tick().catch(() => {}); }, 4000).unref(); // roda logo após o boot (pega atrasados)
}

module.exports = { add, list, update, cancel, startWorker, pendingFor, cancelPendingFor };
