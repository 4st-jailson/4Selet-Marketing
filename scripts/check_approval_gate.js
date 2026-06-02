// scripts/check_approval_gate.js — Gate duplo (R5) para qualquer publicacao real.
//
// CHAMAR ANTES de qualquer POST a Meta API / YouTube API / etc., para CADA task que
// se pretende publicar. Verifica em RUNTIME duas invariantes que o filesystem
// sozinho nao protege:
//   1. status.status === "approved" no status.json (estado logico, nao so localizacao)
//   2. content_hashes batem com o conteudo atual da pasta (deteccao de adulteracao)
//
// Pode ser usado como CLI:
//   node scripts/check_approval_gate.js --task <name> --date <YYYY-MM-DD>
//   Exit 0 ok, 1 gate negado (state ou hashes), 2 erro tecnico.
// OU como modulo:
//   const { assertPublishApproved } = require("./check_approval_gate");
//   assertPublishApproved({ taskName, date });   // lanca em violacao
"use strict";
const fs = require("fs");
const path = require("path");
const { hashDirectory, diffHashes } = require("./lib/content_hash");

function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  let raw = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  try { return JSON.parse(raw); } catch (e) {
    const err = new Error("E_STATUS_PARSE: JSON invalido em " + p + ": " + e.message);
    err.code = "E_STATUS_PARSE"; throw err;
  }
}

// Lanca E_TASK_NOT_FOUND, E_INVALID_STATE, E_HASH_MISMATCH ou E_GATE_NO_HASHES.
// Retorna { taskDir, status, currentHashes } em caso de sucesso.
function assertPublishApproved(opts) {
  const taskName = opts.taskName;
  const date = opts.date;
  if (!taskName || !date) {
    const err = new Error("E_GATE_BAD_ARGS: taskName e date sao obrigatorios"); err.code = "E_GATE_BAD_ARGS"; throw err;
  }
  const folder = taskName + "_" + date;
  const taskDir = path.resolve("outputs", "approved", folder);
  if (!fs.existsSync(taskDir)) {
    const err = new Error("E_TASK_NOT_FOUND: outputs/approved/" + folder + " nao existe — a task nao esta aprovada (ou nunca foi). Verificar com 'node scripts/validate_status.js --task " + taskName + " --date " + date + "'.");
    err.code = "E_TASK_NOT_FOUND"; throw err;
  }
  const statusPath = path.join(taskDir, "status.json");
  const status = readJsonSafe(statusPath);
  if (!status) {
    const err = new Error("E_GATE_NO_STATUS: status.json ausente em " + statusPath); err.code = "E_GATE_NO_STATUS"; throw err;
  }
  // Invariante 1: estado logico
  if (status.status !== "approved") {
    const err = new Error("E_INVALID_STATE: task " + folder + " esta em outputs/approved/ mas status.status='" + status.status + "' (esperado 'approved'). Pasta orfa ou desincronizada — investigar e reconciliar via promote_task.js antes de publicar.");
    err.code = "E_INVALID_STATE"; throw err;
  }
  // Invariante 2: hashes
  if (!status.content_hashes || Object.keys(status.content_hashes).length === 0) {
    const err = new Error("E_GATE_NO_HASHES: task " + folder + " aprovada mas SEM content_hashes (provavel legacy_import ou aprovacao pre-A.2). Re-promover via promote_task.js --to in_review depois --to approved para gerar hashes, OU rodar migrate_legacy.js. Bypass NAO permitido — protecao contra task vazia (B.2.3).");
    err.code = "E_GATE_NO_HASHES"; throw err;
  }
  const currentHashes = hashDirectory(taskDir, ["status.json", "preview.html"]);
  const divs = diffHashes(status.content_hashes, currentHashes);
  if (divs.length > 0) {
    const summary = divs.slice(0, 8).map((d) => d.rel + "(" + d.kind + ")").join(", ");
    const err = new Error("E_HASH_MISMATCH: " + divs.length + " divergencia(s) em " + folder + ": " + summary + (divs.length > 8 ? " (+" + (divs.length - 8) + " mais)" : "") + ". Conteudo alterado pos-aprovacao. Rode 'node scripts/check_approved_integrity.js --auto-revert' para reverter e re-aprovar.");
    err.code = "E_HASH_MISMATCH"; throw err;
  }
  return { taskDir, status, currentHashes };
}

// Modo CLI
if (require.main === module) {
  function arg(name) {
    const i = process.argv.indexOf("--" + name);
    return i !== -1 ? process.argv[i + 1] : undefined;
  }
  const taskName = arg("task");
  const date = arg("date");
  try {
    const r = assertPublishApproved({ taskName, date });
    console.log("[check_approval_gate] OK " + path.basename(r.taskDir) +
      " · status=approved · " + Object.keys(r.currentHashes).length + " arquivos com hash batendo");
    process.exit(0);
  } catch (e) {
    const code = e && e.code ? e.code : "E_GATE_TECH";
    console.error("[check_approval_gate] " + e.message);
    // Exit 1 para violacoes logicas (E_INVALID_STATE, E_HASH_MISMATCH, E_GATE_NO_HASHES, E_TASK_NOT_FOUND, E_GATE_BAD_ARGS)
    // Exit 2 para falhas tecnicas (E_STATUS_PARSE, etc.)
    const technical = code === "E_STATUS_PARSE" || code === "E_GATE_NO_STATUS" || code === "E_GATE_TECH";
    process.exit(technical ? 2 : 1);
  }
}

module.exports = { assertPublishApproved };
