// orchestrate.js — empacotado com a skill orchestrator (persiste com a skill).
// Valida o Job Payload, resolve o plano de dependencias/skips, cria logs/ e pipeline_plan.json.
// NAO roda os agentes (sao skills executadas pelo Claude, ou worker BullMQ no futuro).
// Rodar a partir da RAIZ do projeto.
// Uso: node skills/orchestrator/scripts/orchestrate.js --file <payload.json>
//   ou: node skills/orchestrator/scripts/orchestrate.js --payload '<json inline>'
const fs = require("fs");
const path = require("path");
// A.3 — cabeamento com o Workflow de Aprovacao (bootstrap idempotente do status.json)
let bootstrapStatusJson;
try { bootstrapStatusJson = require("../../../scripts/lib/status_bootstrap").bootstrapStatusJson; }
catch (e) { /* opcional: workflow nao instalado; segue sem bootstrap */ }

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

let payload;
const file = arg("file", null);
const inline = arg("payload", null);
try {
  const stripBom = (s) => s.replace(/^﻿/, "");
  if (file) payload = JSON.parse(stripBom(fs.readFileSync(path.resolve(file), "utf8")));
  else if (inline) payload = JSON.parse(stripBom(inline));
  else {
    console.error("[orchestrator] forneca --file <payload.json> ou --payload '<json>'");
    process.exit(2);
  }
} catch (e) {
  console.error("[orchestrator] payload JSON invalido:", e.message);
  process.exit(2);
}

const task = payload.task_name;
const date = payload.task_date;
if (!task || !date) {
  console.error("[orchestrator] payload invalido: task_name e task_date sao obrigatorios.");
  process.exit(2);
}

const flags = payload.user_flags || {};
const pick = (k) => (flags[k] !== undefined ? flags[k] : payload[k]) || false;
const skipResearch = pick("skip_research");
const skipImage = pick("skip_image");
const skipVideo = pick("skip_video");
const platforms = payload.platform_targets || [];
const dryRun = payload.dry_run || false;

const outDir = path.resolve(`outputs/${task}_${date}`);
const logsDir = path.join(outDir, "logs");

const jobs = [];
let blocked = false;
let blockNote = null;

if (skipResearch) {
  const assetsDir = path.resolve(`assets/${task}`);
  if (!fs.existsSync(assetsDir)) {
    blocked = true;
    blockNote = `Task nao pode prosseguir ate a source folder ser uploaded (assets/${task}/ ausente).`;
    jobs.push({ job_name: "research_agent", status: "blocked", dependencies: [], notes: blockNote });
  } else {
    jobs.push({ job_name: "research_agent", status: "skipped", dependencies: [], notes: `skip_research=true; assets/${task}/ presente` });
  }
} else {
  jobs.push({ job_name: "research_agent", status: "queued", dependencies: [], notes: "roda primeiro" });
}

jobs.push({ job_name: "ad_creative_designer", status: skipImage ? "skipped" : "queued", dependencies: ["research_agent"], notes: skipImage ? "skip_image=true" : "" });
jobs.push({ job_name: "video_ad_specialist", status: skipVideo ? "skipped" : "queued", dependencies: ["research_agent"], notes: skipVideo ? "skip_video=true" : "" });
jobs.push({ job_name: "copywriter_agent", status: "queued", dependencies: ["research_agent"], notes: "" });
jobs.push({ job_name: "distribution_agent", status: "queued", dependencies: ["ad_creative_designer", "video_ad_specialist", "copywriter_agent"], notes: "roda por ultimo; nao publica (gate)" });
// C.2 — job sintetico: gera preview.html + promove draft -> in_review (idempotente)
jobs.push({
  job_name: "preview_generator",
  status: "queued",
  dependencies: ["distribution_agent"],
  script: "scripts/generate_preview.js",
  args: ["--task", task, "--date", date],
  notes: "auto-gera preview.html + promove status para in_review (Workflow de Aprovacao)",
});

const mode = process.env.REDIS_URL ? "queued (BullMQ+Redis)" : "sequential (sem Redis)";

fs.mkdirSync(logsDir, { recursive: true });

// A.3 — bootstrap idempotente do status.json para o Workflow de Aprovacao
if (typeof bootstrapStatusJson === "function") {
  try {
    bootstrapStatusJson({
      taskName: task,
      date: date,
      campaignAngle: null,
      platforms: Array.isArray(platforms) && platforms.length > 0 ? platforms : ["instagram"],
      taskDir: outDir,
    });
  } catch (e) {
    if (e && e.code === "E_REBOOTSTRAP_BLOCKED") {
      console.error("[orchestrator] " + e.message);
      process.exit(1);
    }
    console.error("[orchestrator] WARN bootstrap status.json falhou: " + (e && e.message ? e.message : e));
  }
}
const ts = new Date().toISOString();
for (const j of jobs) {
  const logFile = path.join(logsDir, `${j.job_name}.log`);
  fs.writeFileSync(logFile, `[${ts}] ${j.job_name} status=${j.status} deps=[${j.dependencies.join(",")}] ${j.notes}\n`, "utf8");
}

const plan = {
  task_name: task,
  task_date: date,
  platform_targets: platforms,
  dry_run: dryRun,
  mode,
  blocked,
  block_note: blockNote,
  jobs,
};
fs.writeFileSync(path.join(outDir, "pipeline_plan.json"), JSON.stringify(plan, null, 2), "utf8");

console.log(`[orchestrator] task=${task}_${date} modo=${mode} dry_run=${dryRun}`);
for (const j of jobs) console.log(`  - ${j.job_name}: ${j.status}${j.notes ? " (" + j.notes + ")" : ""}`);
console.log(`[orchestrator] plano -> ${path.join(outDir, "pipeline_plan.json")} | logs -> ${logsDir}`);
if (blocked) {
  console.error(`[orchestrator] BLOQUEADO: ${blockNote}`);
  process.exit(1);
}
console.log("[orchestrator] plano valido. Proximo: executar os agentes na ordem (sequencial) ou enfileirar (BullMQ).");
