// pipeline/worker.js — Fase 2: worker BullMQ que processa jobs do pipeline.
//
// Degrada com elegância: se REDIS_URL não estiver definido ou bullmq não estiver
// instalado, explica como rodar em modo sequencial e sai com código 0 (não é erro
// — é a configuração padrão do projeto, que roda sem Redis).
//
// Uso: REDIS_URL=redis://localhost:6379 node pipeline/worker.js
"use strict";
const agents = require("./agents");

function degradeMessage(why) {
  console.log("[worker] " + why);
  console.log("[worker] o pipeline roda SEM Redis por padrão. Use o modo sequencial:");
  console.log("[worker]   node pipeline/orchestrator.js --task <t> --date <d> --brief \"<...>\"");
  console.log("[worker]   (ou npm run pipeline:run -- --task <t> --date <d> --brief \"<...>\")");
}

function main() {
  if (!process.env.REDIS_URL) {
    degradeMessage("REDIS_URL não definido — não há fila para processar.");
    return;
  }
  let bullmq;
  try { bullmq = require("bullmq"); }
  catch (e) { degradeMessage("bullmq não instalado (npm i bullmq)."); return; }

  const { Worker } = bullmq;
  const connection = { url: process.env.REDIS_URL };
  const concurrency = Number(process.env.PIPELINE_CONCURRENCY || 1);

  console.log(`[worker] online — fila=marketing-pipeline conc=${concurrency} redis=${process.env.REDIS_URL}`);

  const worker = new Worker("marketing-pipeline", async (job) => {
    const prefix = `[job ${job.id}]`;
    console.log(`${prefix} iniciando ${job.data.task_name}_${job.data.task_date}`);
    const summary = await agents.runPipeline(job.data, {
      log: (m) => console.log(`${prefix} ${m}`),
    });
    return summary;
  }, { connection, concurrency });

  worker.on("completed", (job) => console.log(`[worker] job ${job.id} concluído`));
  worker.on("failed", (job, err) => console.error(`[worker] job ${job && job.id} falhou: ${err && err.message}`));

  const shutdown = async () => {
    console.log("[worker] encerrando…");
    try { await worker.close(); } catch (e) { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) main();

module.exports = { main };
