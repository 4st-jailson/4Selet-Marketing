// pipeline/agents.js — Fase 2: execucao real dos agentes do pipeline.
//
// Diferente de skills/orchestrator/scripts/orchestrate.js (que só monta o PLANO
// e bootstrapa o status.json, sem rodar nada), este modulo EXECUTA os agentes
// criativos de verdade, reusando a mesma engine do painel (interface/lib):
//   - copy/criativos  -> Claude (anthropic.complete) + brand governance + render
//   - research        -> advisory deterministico (sem Tavily/keys externas)
//   - distribution    -> advisory deterministico (gate: nunca publica)
//
// runPipeline() roda os jobs em ordem (sequencial). O orchestrator decide entre
// rodar isto direto (sem Redis) ou enfileirar para o worker (BullMQ).
"use strict";
const fs = require("fs");
const path = require("path");

const ai = require("../interface/lib/anthropic");
const prompts = require("../interface/lib/prompts");
const content = require("../interface/lib/content");
const render = require("../interface/lib/render");
const { contentTypeById } = require("../interface/lib/config");
const { runBrandGovernance } = require("../interface/lib/validation");

const ALL_CONTENT_TYPES = [
  "instagram_caption", "instagram_carousel", "ad_creative",
  "video_idea", "linkedin_post", "threads_post",
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nop() {}

// ---- helpers de parsing/formatacao (espelham routes/generate.js) ----------

function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(s); } catch (e) { /* tenta achar bloco */ }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { /* nada */ }
  }
  return null;
}

function textForGovernance(contentTypeId, parsed) {
  if (!parsed) return "";
  if (typeof parsed.body === "string") {
    return parsed.body + "\n" + (Array.isArray(parsed.hashtags) ? parsed.hashtags.join(" ") : "") + "\n" + (parsed.cta || "");
  }
  const parts = [];
  for (const k of ["headline", "subtext", "concept", "hook", "caption", "cta"]) {
    if (parsed[k]) parts.push(parsed[k]);
  }
  if (Array.isArray(parsed.slides)) parsed.slides.forEach((s) => parts.push((s.title || "") + " " + (s.body || "")));
  if (Array.isArray(parsed.scenes)) parsed.scenes.forEach((s) => parts.push((s.text || "") + " " + (s.subtitle || "")));
  if (Array.isArray(parsed.hashtags)) parts.push(parsed.hashtags.join(" "));
  return parts.join("\n");
}

function formatContentFile(ct, parsed, raw) {
  if (!parsed) return raw || "";
  if (ct.format === "json") return JSON.stringify(parsed, null, 2) + "\n";
  let out = parsed.body || raw || "";
  if (Array.isArray(parsed.hashtags) && parsed.hashtags.length) {
    out = out.trim() + "\n\n" + parsed.hashtags.join(" ");
  }
  return out.trim() + "\n";
}

// ---- chamada à IA com retry de rate-limit (org cap ~10k tok/min) ----------

async function completeWithRetry(opts, label, log, maxRetries) {
  maxRetries = maxRetries == null ? 3 : maxRetries;
  let attempt = 0;
  for (;;) {
    try {
      return await ai.complete(opts);
    } catch (e) {
      const status = e && (e.status || (e.response && e.response.status));
      const is429 = status === 429 || /rate.?limit|429/i.test((e && e.message) || "");
      if (is429 && attempt < maxRetries) {
        attempt++;
        log(`    [${label}] rate limit — aguardando 65s (tentativa ${attempt}/${maxRetries})…`);
        await sleep(65000);
        continue;
      }
      throw e;
    }
  }
}

// ---- research_agent (advisory, deterministico, sem chaves externas) --------

function researchAgent(ctx) {
  const { folder, brief, angle, campaign, log } = ctx;
  log("[research_agent] gerando briefing estrategico (advisory, sem fontes externas)…");
  const lines = [
    "# Research — briefing estrategico (advisory)",
    "",
    "> Gerado pelo pipeline em modo advisory (sem Tavily/fontes externas).",
    "> Use como ancoragem; não substitui pesquisa de campo.",
    "",
    "## Brief",
    "- Tema/objetivo: " + (brief || "(não informado)"),
    angle ? "- Ângulo: " + angle : null,
    campaign ? "- Campanha: " + (campaign.name || campaign.id || "") : null,
    "",
    "## Âncoras factuais da marca (campanha Taxa Zero)",
    "- 0% de taxa por 3 meses ou até R$ 300 mil em vendas.",
    "- R$ 1,99 fixo por transação.",
    "- Recebimento: PIX em D+10, cartão em D+30.",
    "- 95%+ de aprovação no cartão.",
    "- Acesso por convite — \"Para quem sabe que é Selet.\"",
    "",
    "## Direcionais de tom",
    "- Sócio experiente e sobrio; factual, com números/prazos concretos.",
    "- Nunca citar concorrentes; falar do \"mercado\" em abstrato.",
    "- Sem urgência fake, sem promessa mágica.",
  ].filter(Boolean);
  const rel = content.writeContentFile(folder, "research/insights.md", lines.join("\n") + "\n");
  log("  -> " + rel);
  return { job: "research_agent", status: "done", file: rel, simulated: true };
}

// ---- agentes criativos (Claude real + governance + render) -----------------
// Um único motor cobre copywriter_agent / ad_creative_designer / video_ad_specialist:
// o tipo de conteudo decide o schema, o arquivo e o render de midia.

async function creativeAgent(ctx) {
  const {
    folder, contentTypeId, brief, angle, campaign, platforms,
    doRender, log,
  } = ctx;
  const ct = contentTypeById(contentTypeId);
  if (!ct) return { job: contentTypeId, status: "skipped", reason: "content_type desconhecido" };

  log(`[${contentTypeId}] (${ct.label}) gerando com IA…`);
  const req = {
    content_type: contentTypeId,
    brief, platforms,
    campaign: campaign || (angle ? { name: angle, angle } : null),
  };
  const system = prompts.systemPrompt();
  const userPrompt = prompts.generationPrompt(req);

  const result = await completeWithRetry({
    system, prompt: userPrompt, maxTokens: 2500,
    simulate: () => prompts.simulate(req),
  }, contentTypeId, log);

  const parsed = extractJson(result.text);
  const gov = runBrandGovernance(textForGovernance(contentTypeId, parsed) || result.text, { type: contentTypeId });
  log(`  gerado | simulated: ${result.simulated} | gov errors: ${gov.errors.length} | warnings: ${gov.warnings.length}`);

  // Gate de governanca: não grava peças que violam regras duras de marca.
  if (gov.errors.length) {
    log(`  BLOQUEADO por governance: ${gov.errors.join("; ")}`);
    return { job: contentTypeId, status: "blocked", governance: gov, simulated: result.simulated };
  }

  const text = formatContentFile(ct, parsed, result.text);
  const file = content.writeContentFile(folder, ct.file, text);
  log("  salvo: " + file);

  let renderInfo = null;
  const renderable = ct.media === "image" || ct.media === "video";
  if (doRender && renderable) {
    log(`  renderizando mídia (${ct.kind})…`);
    try {
      const r = await render.render(folder, ct.kind);
      renderInfo = { ok: r.ok, code: r.code, rel: r.rel || null };
      if (r.ok) log("  mídia: " + (r.rel || "ok"));
      else log("  mídia FALHOU (code " + r.code + "): " + (r.stderr || "").slice(0, 200));
    } catch (e) {
      renderInfo = { ok: false, error: e.message, code: e.code || null };
      log("  mídia ERRO: " + e.message);
    }
  } else if (renderable) {
    log("  render pulado (flag).");
  }

  return {
    job: contentTypeId, status: "done", file,
    simulated: result.simulated, model: result.model,
    governance: gov, render: renderInfo,
  };
}

// ---- distribution_agent (advisory; NUNCA publica — gate de aprovacao) ------

function distributionAgent(ctx) {
  const { folder, pieces, log } = ctx;
  log("[distribution_agent] montando plano de distribuição (advisory; não publica)…");
  const done = pieces.filter((p) => p.status === "done");
  const byPlatform = {
    instagram: ["instagram_caption", "instagram_carousel", "ad_creative", "video_idea"],
    linkedin: ["linkedin_post"],
    x: ["threads_post"],
  };
  const lines = ["# Plano de distribuição (advisory)", "",
    "> O pipeline NÃO publica. Esta é uma sugestão de sequenciamento; a publicação",
    "> exige aprovação humana no painel (status in_review -> approved).", ""];
  for (const [plat, ids] of Object.entries(byPlatform)) {
    const here = done.filter((p) => ids.includes(p.job));
    if (!here.length) continue;
    lines.push("## " + plat);
    here.forEach((p) => lines.push("- " + p.job + " -> " + p.file));
    lines.push("");
  }
  lines.push("## Próximo passo");
  lines.push("Revisar cada peça no painel (zona in_review) e aprovar antes de publicar.");
  const rel = content.writeContentFile(folder, "distribution/plan.md", lines.join("\n") + "\n");
  log("  -> " + rel);
  return { job: "distribution_agent", status: "done", file: rel, simulated: true };
}

// ---- runPipeline: executa o DAG em ordem (sequencial) ----------------------
//
// payload: {
//   task_name, task_date, brief, angle?, platforms?, campaign_id?,
//   content_types?: string[],            // default: todos os 6
//   user_flags?: { skip_research, skip_distribution, skip_render, skip_video }
// }
// Retorna um resumo (pipeline_run.json) e o grava na pasta da task.

async function runPipeline(payload, opts) {
  opts = opts || {};
  const log = typeof opts.log === "function" ? opts.log : nop;
  const startedAt = new Date().toISOString();

  const taskName = payload.task_name;
  const taskDate = payload.task_date;
  if (!taskName || !taskDate) throw new Error("payload invalido: task_name e task_date sao obrigatorios");
  const brief = payload.brief || "";
  if (String(brief).trim().length < 8) throw new Error("payload invalido: brief obrigatorio (min 8 caracteres)");

  const flags = payload.user_flags || {};
  const platforms = (payload.platforms && payload.platforms.length) ? payload.platforms : ["instagram"];
  let contentTypes = (payload.content_types && payload.content_types.length)
    ? payload.content_types.slice() : ALL_CONTENT_TYPES.slice();
  if (flags.skip_video) contentTypes = contentTypes.filter((c) => c !== "video_idea");

  const folder = taskName + "_" + taskDate;

  // 1) garante a task (idempotente) — cria pasta + status.json (draft).
  log(`== pipeline ${folder} == (${contentTypes.length} peças)`);
  log("[setup] garantindo task (orchestrator.js)…");
  const create = content.createTask({
    task_name: taskName, task_date: taskDate, platforms, angle: payload.angle || null,
  });
  if (!create.ok) throw new Error("falha ao criar task: " + (create.stderr || create.stdout));
  if (payload.campaign_id) content.setCampaignId(folder, payload.campaign_id);

  const results = [];

  // 2) research (advisory)
  if (!flags.skip_research) {
    results.push(researchAgent({ folder, brief, angle: payload.angle, campaign: payload.campaign, log }));
  } else {
    log("[research_agent] pulado (skip_research).");
    results.push({ job: "research_agent", status: "skipped" });
  }

  // 3) agentes criativos (um por content_type)
  const doRender = !flags.skip_render;
  for (const contentTypeId of contentTypes) {
    try {
      const r = await creativeAgent({
        folder, contentTypeId, brief, angle: payload.angle,
        campaign: payload.campaign, platforms, doRender, log,
      });
      results.push(r);
    } catch (e) {
      log(`[${contentTypeId}] ERRO: ${e.message}`);
      results.push({ job: contentTypeId, status: "error", error: e.message });
    }
  }

  // 4) distribution (advisory; gate)
  if (!flags.skip_distribution) {
    results.push(distributionAgent({ folder, pieces: results, log }));
  } else {
    log("[distribution_agent] pulado (skip_distribution).");
    results.push({ job: "distribution_agent", status: "skipped" });
  }

  // 5) preview_generator: gera preview.html + promove draft -> in_review
  log("[preview_generator] gerando preview + promovendo para in_review…");
  const prev = content.generatePreview(taskName, taskDate);
  if (prev.ok) log("  preview/in_review: ok");
  else log("  preview FALHOU: " + (prev.stderr || prev.stdout || "").slice(0, 200));

  const summary = {
    task_name: taskName,
    task_date: taskDate,
    folder,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    platforms,
    content_types: contentTypes,
    flags,
    preview_ok: !!prev.ok,
    jobs: results,
  };
  // grava o resumo na task (zona active).
  try { content.writeContentFile(folder, "pipeline_run.json", JSON.stringify(summary, null, 2) + "\n"); } catch (e) { /* best-effort */ }

  const ok = results.filter((r) => r.status === "done").length;
  const bad = results.filter((r) => r.status === "error" || r.status === "blocked").length;
  log(`== fim == done:${ok} problemas:${bad} preview:${prev.ok ? "ok" : "falhou"}`);
  return summary;
}

module.exports = {
  ALL_CONTENT_TYPES,
  runPipeline,
  researchAgent,
  creativeAgent,
  distributionAgent,
  completeWithRetry,
  extractJson,
  textForGovernance,
  formatContentFile,
};
