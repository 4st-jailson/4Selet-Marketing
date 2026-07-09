// routes/settings.js — configurar/testar a chave Anthropic e o modelo +
// status das integracoes externas (somente leitura, sem expor segredos).
"use strict";
const fs = require("fs");
const express = require("express");
const router = express.Router();
const ai = require("../lib/anthropic");
const aihub = require("../lib/ai"); // multi-provedor (Claude / OpenAI / ...)
const research = require("../lib/research");
const { PATHS } = require("../lib/config");

router.get("/", (req, res) => {
  res.json({
    has_key: ai.hasKey(),
    masked_key: ai.maskKey(),
    model: ai.getModel(),
    default_model: ai.DEFAULT_MODEL,
  });
});

// Le todas as vars do interface/.env (sem expor valores ao front).
function envFileVars() {
  try {
    const raw = fs.readFileSync(PATHS.ENV_FILE, "utf8");
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch (e) { return {}; }
}
function envHas(name, fileVars) {
  return !!(process.env[name] && String(process.env[name]).trim()) ||
         !!(fileVars[name] && String(fileVars[name]).trim());
}

// GET /api/settings/integrations — status (configurado ou nao) de cada integracao
// externa. NUNCA retorna o valor das chaves, apenas booleans + descricoes.
router.get("/integrations", (req, res) => {
  const f = envFileVars();
  const supaOk = envHas("SUPABASE_URL", f) && (envHas("SUPABASE_KEY", f) || envHas("SUPABASE_SERVICE_ROLE_KEY", f));
  const integrations = [
    {
      id: "anthropic", name: "Anthropic (Claude)", required: true,
      purpose: "Geração e refino de conteúdo com IA no painel.",
      configured: ai.hasKey(),
      detail: ai.hasKey() ? "Modelo atual: " + ai.getModel() : "Cole a chave Anthropic acima.",
    },
    {
      id: "tavily", name: "Tavily (pesquisa de mercado)", required: false,
      purpose: "Pesquisa de mercado ao vivo injetada na geração (opt-in pelo toggle ao gerar).",
      configured: research.isConfigured(),
      detail: research.isConfigured()
        ? "Pronta — marque 'Pesquisar mercado com Tavily' ao gerar."
        : "Defina TAVILY_API_KEY e instale @tavily/core.",
    },
    {
      id: "redis", name: "Redis / BullMQ (fila)", required: false,
      purpose: "Processa campanhas em fila assíncrona. Sem ele, o pipeline roda sequencial.",
      configured: envHas("REDIS_URL", f),
      detail: envHas("REDIS_URL", f) ? "Fila BullMQ habilitada." : "Defina REDIS_URL (Upstash) para ativar a fila.",
    },
    {
      id: "supabase", name: "Supabase (hospedagem de mídia)", required: false,
      purpose: "Hospeda mídia e gera URLs públicas — pré-requisito para publicação real.",
      configured: supaOk,
      detail: supaOk ? "Conectado." : "Defina SUPABASE_URL + SUPABASE_KEY.",
    },
    {
      id: "instagram", name: "Instagram (Graph API)", required: false,
      purpose: "Publicação automática no Instagram (protegida por gate de aprovação).",
      configured: envHas("IG_ACCESS_TOKEN", f),
      detail: envHas("IG_ACCESS_TOKEN", f) ? "Token presente." : "Defina IG_ACCESS_TOKEN + IG Business account id.",
    },
    {
      id: "youtube", name: "YouTube (Data API)", required: false,
      purpose: "Publicação automática no YouTube via OAuth (protegida por gate de aprovação).",
      configured: envHas("YOUTUBE_REFRESH_TOKEN", f),
      detail: envHas("YOUTUBE_REFRESH_TOKEN", f) ? "OAuth configurado." : "Defina YOUTUBE_REFRESH_TOKEN (OAuth).",
    },
  ];
  res.json({ integrations });
});

router.post("/key", (req, res) => {
  try {
    ai.saveApiKey(req.body && req.body.key);
    res.json({ ok: true, has_key: true, masked_key: ai.maskKey() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/model", (req, res) => {
  const model = ai.saveModel(req.body && req.body.model);
  res.json({ ok: true, model });
});

router.post("/test", async (req, res) => {
  const r = await ai.testKey();
  res.status(r.ok ? 200 : 400).json(r);
});

// --- Multi-provedor de IA: listar/configurar Claude, ChatGPT (e futuros) ---
// A chave e o MODELO de cada provedor sao controlados aqui (Configuracoes); a
// ESCOLHA de qual usar acontece na hora de gerar. NUNCA retorna a chave em claro.
router.get("/providers", (req, res) => {
  res.json({ providers: aihub.providers(), default: aihub.defaultProvider() });
});
router.post("/provider/key", (req, res) => {
  try {
    const { provider, key } = req.body || {};
    aihub.saveKey(provider, key);
    res.json({ ok: true, providers: aihub.providers() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post("/provider/model", (req, res) => {
  try {
    const { provider, model } = req.body || {};
    const m = aihub.saveModel(provider, model);
    res.json({ ok: true, model: m, providers: aihub.providers() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post("/provider/test", async (req, res) => {
  const r = await aihub.testKey((req.body || {}).provider);
  res.status(r.ok ? 200 : 400).json(r);
});
router.post("/provider/default", (req, res) => {
  try {
    const p = aihub.setDefaultProvider((req.body || {}).provider);
    res.json({ ok: true, default: p, providers: aihub.providers() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
