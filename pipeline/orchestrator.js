// pipeline/orchestrator.js — Fase 2: ponto de entrada do pipeline executável.
//
// Decide o modo de execução:
//   - REDIS_URL definido + bullmq instalado  -> ENFILEIRA o job (o worker processa).
//   - caso contrário                         -> roda SEQUENCIAL aqui mesmo (sem Redis).
//
// Uso:
//   node pipeline/orchestrator.js --task lancamento --date 2026-06-12 --brief "..." [--types ...] [--no-render] [--skip-video]
//   node pipeline/orchestrator.js --file payload.json
//   node pipeline/orchestrator.js --payload '{"task_name":"...","task_date":"...","brief":"..."}'
"use strict";
const fs = require("fs");
const path = require("path");
const agents = require("./agents");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : def;
}
function hasFlag(name) { return process.argv.includes("--" + name); }
function stripBom(s) { return s.replace(/^﻿/, ""); }

// Monta o payload a partir de --file / --payload ou das flags soltas.
function buildPayload() {
  const file = arg("file", null);
  const inline = arg("payload", null);
  if (file) return JSON.parse(stripBom(fs.readFileSync(path.resolve(file), "utf8")));
  if (inline) return JSON.parse(stripBom(inline));

  const payload = {
    task_name: arg("task", null),
    task_date: arg("date", null),
    brief: arg("brief", null),
    angle: arg("angle", null) || undefined,
    campaign_id: arg("campaign", null) || undefined,
  };
  const platforms = arg("platforms", null);
  if (platforms) payload.platforms = platforms.split(",").map((s) => s.trim()).filter(Boolean);
  const types = arg("types", null);
  if (types) payload.content_types = types.split(",").map((s) => s.trim()).filter(Boolean);
  payload.user_flags = {
    skip_research: hasFlag("skip-research"),
    skip_distribution: hasFlag("skip-distribution"),
    skip_render: hasFlag("no-render"),
    skip_video: hasFlag("skip-video"),
  };
  return payload;
}

// Tenta carregar o enfileiramento BullMQ. Degrada para null se indisponível.
function tryQueue() {
  if (!process.env.REDIS_URL) return null;
  let bullmq;
  try { bullmq = require("bullmq"); }
  catch (e) { return { unavailable: "bullmq não instalado (npm i bullmq) — caindo para modo sequencial" }; }
  return { bullmq };
}

async function main() {
  let payload;
  try { payload = buildPayload(); }
  catch (e) { console.error("[pipeline] payload inválido: " + e.message); process.exit(2); }

  if (!payload.task_name || !payload.task_date || !payload.brief) {
    console.error("[pipeline] obrigatórios: --task, --date e --brief (ou --file/--payload com esses campos).");
    process.exit(2);
  }

  const q = tryQueue();

  if (q && q.bullmq) {
    // Modo enfileirado: publica o job e sai. O worker (pipeline/worker.js) processa.
    const { Queue } = q.bullmq;
    const connection = { url: process.env.REDIS_URL };
    const queue = new Queue("marketing-pipeline", { connection });
    const job = await queue.add("run-pipeline", payload, {
      removeOnComplete: 50, removeOnFail: 100,
    });
    console.log(`[pipeline] ENFILEIRADO (BullMQ) job=${job.id} fila=marketing-pipeline`);
    console.log("[pipeline] inicie o worker: node pipeline/worker.js  (ou npm run pipeline:worker)");
    await queue.close();
    return;
  }

  if (q && q.unavailable) console.warn("[pipeline] " + q.unavailable);

  // Modo sequencial (sem Redis): executa aqui mesmo.
  console.log("[pipeline] modo: sequencial (sem Redis)");
  const summary = await agents.runPipeline(payload, { log: (m) => console.log(m) });
  const problems = summary.jobs.filter((j) => j.status === "error" || j.status === "blocked");
  if (problems.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => { console.error("[pipeline] ERRO fatal: " + (e && e.stack || e)); process.exit(1); });
}

module.exports = { buildPayload, tryQueue };
