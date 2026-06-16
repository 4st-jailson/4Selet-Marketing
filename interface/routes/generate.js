// routes/generate.js — geracao de conteudo com IA (prompt PADRAO + Claude),
// parsing estruturado, brand governance e salvamento na task/campanha.
"use strict";
const express = require("express");
const router = express.Router();
const ai = require("../lib/anthropic");
const prompts = require("../lib/prompts");
const campaigns = require("../lib/campaigns");
const content = require("../lib/content");
const researchLib = require("../lib/research");
const render = require("../lib/render");
const { contentTypeById } = require("../lib/config");
const { runBrandGovernance, validateContentRequest } = require("../lib/validation");

// Extrai o primeiro objeto JSON de um texto (tolera code fences / texto ao redor).
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

// Junta os campos textuais de um conteudo estruturado para rodar governance.
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
  if (Array.isArray(parsed.scenes)) parsed.scenes.forEach((s) => parts.push(s.text || ""));
  if (Array.isArray(parsed.hashtags)) parts.push(parsed.hashtags.join(" "));
  return parts.join("\n");
}

// Formata o conteudo final que sera gravado no arquivo da task.
function formatContentFile(ct, parsed, raw) {
  if (!parsed) return raw || "";
  if (ct.format === "json") return JSON.stringify(parsed, null, 2) + "\n";
  // texto: body + hashtags
  let out = parsed.body || raw || "";
  if (Array.isArray(parsed.hashtags) && parsed.hashtags.length) {
    out = out.trim() + "\n\n" + parsed.hashtags.join(" ");
  }
  return out.trim() + "\n";
}

// POST /api/generate — gera (NAO salva). Retorna parsed + governance.
router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    if (!body.brief || String(body.brief).trim().length < 8) {
      return res.status(400).json({ error: "brief/tema obrigatorio (min 8 caracteres)" });
    }
    let campaign = null;
    if (body.campaign_id) {
      campaign = campaigns.get(body.campaign_id);
    }

    // Pesquisa de mercado ao vivo (Tavily) — opt-in via body.research. Degrada
    // com elegancia: se a chave/SDK faltar ou nada retornar, a geracao segue sem ela.
    let research = null;
    if (body.research) {
      const topic = [body.brief, campaign && campaign.angle].filter(Boolean).join(" — ");
      try {
        const r = await researchLib.marketIntel(topic, {});
        if (r && r.available) research = r;
      } catch (e) { research = null; }
    }

    const req2 = Object.assign({}, body, { campaign, research });
    const system = prompts.systemPrompt();
    const userPrompt = prompts.generationPrompt(req2);

    const result = await ai.complete({
      system,
      prompt: userPrompt,
      maxTokens: 2500,
      simulate: () => prompts.simulate(req2),
    });

    const parsed = extractJson(result.text);
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || result.text, { type: body.content_type });

    res.json({
      simulated: result.simulated,
      model: result.model,
      parsed,
      raw: result.text,
      governance: gov,
      content_type: body.content_type,
      research_requested: !!body.research,
      research_used: !!research,
      research_sources: research ? research.sources : [],
    });
  } catch (e) { next(e); }
});

// POST /api/generate/refine — ajusta uma peca existente conforme orientacao do
// usuario (mantendo o resto). NAO salva — retorna parsed + governance.
router.post("/refine", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    if (!body.instruction || String(body.instruction).trim().length < 3) {
      return res.status(400).json({ error: "orientacao de ajuste obrigatoria (min 3 caracteres)" });
    }
    if (body.current == null || String(body.current).trim() === "") {
      return res.status(400).json({ error: "conteudo atual ausente para ajustar" });
    }
    const campaign = body.campaign_id ? campaigns.get(body.campaign_id) : null;
    const req2 = Object.assign({}, body, { campaign });
    const system = prompts.systemPrompt();
    const userPrompt = prompts.refinementPrompt(req2);

    const result = await ai.complete({
      system,
      prompt: userPrompt,
      maxTokens: 2500,
      simulate: () => String(body.current), // sem chave: ecoa o atual (sinalizado como SIMULADO)
    });

    const parsed = extractJson(result.text);
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || result.text, { type: body.content_type });

    res.json({
      simulated: result.simulated,
      model: result.model,
      parsed,
      raw: result.text,
      governance: gov,
      content_type: body.content_type,
    });
  } catch (e) { next(e); }
});

// POST /api/generate/preview — previa RENDERIZADA da arte a partir do conceito em
// memoria (parsed), sem salvar nem exigir task. So vale para tipos visuais (image).
router.post("/preview", (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    const out = render.renderPreview({
      content_type: body.content_type,
      parsed: body.parsed || extractJson(body.raw),
      template: body.template,
    });
    if (!out.ok) return res.status(422).json(out);
    res.json(out);
  } catch (e) { next(e); }
});

// POST /api/generate/assistant — assistente de ajuda/uso da ferramenta.
router.post("/assistant", async (req, res, next) => {
  try {
    const question = (req.body && req.body.question) || "";
    if (!question.trim()) return res.status(400).json({ error: "pergunta obrigatoria" });
    const ctx = req.body.context ? "\n\nContexto da tela atual: " + req.body.context : "";
    const result = await ai.complete({
      system: prompts.assistantSystem(),
      prompt: question + ctx,
      maxTokens: 1200,
      simulate: () => "Assistente em modo SIMULADO — configure a chave Anthropic em Configuracoes para respostas reais.\n\nFluxo do painel: 1) crie/abra uma Campanha; 2) em 'Criar Conteudo', escolha o tipo, preencha o brief e gere com IA; 3) revise o preview e aprove.",
    });
    res.json({ simulated: result.simulated, model: result.model, answer: result.text });
  } catch (e) { next(e); }
});

// POST /api/generate/save — cria/garante a task, liga a campanha e grava o arquivo.
router.post("/save", async (req, res, next) => {
  try {
    const body = req.body || {};
    const v = validateContentRequest(body);
    if (!v.ok) return res.status(400).json({ error: "validacao falhou", errors: v.errors });
    const ct = v.contentType;
    const parsed = body.parsed || extractJson(body.raw);
    if (!parsed && !body.raw) return res.status(400).json({ error: "nenhum conteudo para salvar" });

    // Gate de governanca: bloqueia erros duros antes de gravar
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || body.raw, { type: body.content_type });
    if (gov.errors.length && !body.force) {
      return res.status(422).json({ error: "conteudo viola regras de marca", governance: gov });
    }

    // 1) garante a task (orchestrator.js — idempotente)
    const angle = body.campaign_id ? (campaigns.get(body.campaign_id) || {}).angle : (body.angle || null);
    const create = content.createTask({
      task_name: body.task_name,
      task_date: body.task_date,
      platforms: body.platforms || (ct.platform ? [ct.platform] : ["instagram"]),
      angle,
    });
    if (!create.ok) return res.status(400).json({ error: "falha ao criar task", detail: create.stderr || create.stdout });

    const folder = body.task_name + "_" + body.task_date;

    // 2) liga a campanha (bidirecional)
    if (body.campaign_id) {
      campaigns.linkContent(body.campaign_id, folder);
      content.setCampaignId(folder, body.campaign_id);
    }

    // 2b) grava o titulo de exibicao humanizado (separado do slug tecnico)
    if (body.title) content.setTitle(folder, body.title);

    // 2c) #8 — semente da variante visual escolhida no brief (default da arte;
    // ignora "auto"/vazio para deixar a rotacao automatica por slug atuar).
    if (body.template_variant) content.setTemplate(folder, body.template_variant);

    // 2d) grava o pilar de conteudo (eixo tematico) escolhido no brief.
    // Validado na taxonomia fechada; pilar invalido/ausente e ignorado.
    if (body.pillar) content.setPillar(folder, body.pillar);

    // 3) grava o arquivo de conteudo
    const text = formatContentFile(ct, parsed, body.raw);
    let rel;
    try {
      rel = content.writeContentFile(folder, ct.file, text);
    } catch (e) {
      return res.status(e.code === "E_NOT_EDITABLE" ? 409 : 500).json({ error: e.message, code: e.code });
    }

    res.json({ ok: true, folder, file: rel, governance: gov, task: content.getTask(folder) });
  } catch (e) { next(e); }
});

module.exports = router;
