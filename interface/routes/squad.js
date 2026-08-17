// routes/squad.js — o lado de DENTRO da integração com o squad.4st.co: a conexão em
// Configurações e a tela de Requisições. Fica atrás do login (o irmão público que RECEBE
// as artes é routes/squad_webhook.js, montado antes do gate).
"use strict";
const express = require("express");
const router = express.Router();
const squad = require("../lib/squad");
const content = require("../lib/content");

// Mesmo desenho do resto do painel: ler pode qualquer pessoa logada; mexer no token e
// reprocessar requisição é de administrador.
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem alterar esta conexão." });
  }
  next();
}

// Como está a conexão (nunca devolve o token inteiro).
router.get("/", (req, res) => {
  // O endereço tem que ser o PÚBLICO (o mesmo que a publicação no Instagram usa), não o que o
  // navegador tem na barra: um admin que abra o painel por IP interno passaria ao time do
  // squad um endereço que só funciona dentro da rede.
  let base = "";
  try { base = require("../lib/publish").publicConfig().public_base_url || ""; } catch (e) {}
  res.json(Object.assign({}, squad.estado(), {
    caminho: "/api/squad/webhook",
    endereco: (base ? String(base).replace(/\/+$/, "") : "") + "/api/squad/webhook",
  }));
});

// Guarda o token que o sistema do squad gerou — ou um que o painel gerou a pedido.
router.post("/token", adminOnly, (req, res) => {
  const b = req.body || {};
  try {
    const token = b.gerar ? squad.gerarToken() : String(b.token || "").trim();
    squad.salvarToken(token, req.user.username, b.gerar ? "gerado" : "colado");
    // O valor completo volta UMA vez, só quando o painel acabou de gerar: é a única
    // chance de copiá-lo. Token colado pela pessoa ela já tem, então não repetimos.
    res.json({ ok: true, token: b.gerar ? token : null, estado: squad.estado() });
  } catch (e) {
    res.status(e.code === "E_TOKEN_CURTO" ? 400 : 500).json({ error: e.message, code: e.code || null });
  }
});

router.delete("/token", adminOnly, (req, res) => {
  squad.removerToken();
  res.json({ ok: true, estado: squad.estado() });
});

// O log das chamadas recebidas.
router.get("/requisicoes", (req, res) => {
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 60, 1), 300);
  const estado = squad.estado();
  res.json({ requisicoes: squad.listar(limite), total: estado.total_requisicoes, estado });
});

router.get("/requisicoes/:id", (req, res) => {
  const r = squad.obter(req.params.id);
  if (!r) return res.status(404).json({ error: "requisição não encontrada" });
  const payload = squad.lerPayload(req.params.id);
  // O corpo cru pesa dezenas de MB por causa das imagens em base64. Mandar isso para a tela
  // travaria o navegador — então vai um retrato: tudo, menos o conteúdo das artes.
  res.json({ requisicao: r, resumo_payload: resumoDoPayload(payload) });
});

function resumoDoPayload(p) {
  if (!p) return null;
  // "artes" é apelido aceito de "cards" na leitura da entrega. Enxugar só um dos dois deixava
  // o outro passar inteiro: dezenas de MB de imagem em base64 indo para o navegador, que
  // trava a aba na hora de abrir os detalhes.
  const campo = Array.isArray(p.cards) ? "cards" : (Array.isArray(p.artes) ? "artes" : null);
  if (!campo) return p;
  const cards = p[campo];
  const enxuto = Object.assign({}, p);
  delete enxuto.artes;
  enxuto.cards = cards.map((c, i) => {
    const o = (c && typeof c === "object") ? c : { png: c };
    const img = String(o.png || o.imagem || (typeof c === "string" ? c : "") || "");
    return {
      n: o.n || i + 1,
      tipo: o.tipo || null,
      imagem: img ? (img.slice(0, 32) + "… (" + Math.round(img.length / 1024) + " KB)") : null,
      html: typeof o.html === "string" ? ("HTML de " + Math.round(o.html.length / 1024) + " KB") : null,
    };
  });
  return enxuto;
}

// Reprocessar: monta a peça de novo a partir do corpo guardado. Cria uma peça NOVA — não
// mexe na que já existe, para nunca sobrescrever algo que a pessoa já editou ou publicou.
router.post("/requisicoes/:id/reprocessar", adminOnly, async (req, res) => {
  const reg = squad.obter(req.params.id);
  if (!reg) return res.status(404).json({ error: "requisição não encontrada" });
  const payload = squad.lerPayload(req.params.id);
  if (!payload) {
    return res.status(409).json({
      error: "O conteúdo desta requisição não está mais guardado (os mais antigos são apagados para não encher o disco). Peça ao sistema do squad para enviar de novo.",
      code: "E_SEM_PAYLOAD",
    });
  }
  const logs = [];
  const log = (m) => { logs.push({ em: new Date().toISOString(), texto: m }); };

  // Lê antes de responder: erro de leitura vira mensagem na hora, na tela de quem clicou.
  let lido;
  try { lido = squad.normalizar(payload); }
  catch (e) { return res.status(400).json({ error: e.message, code: e.code || null }); }

  // Monta em segundo plano, pelo mesmo motivo do recebimento: um carrossel leva mais de um
  // minuto e a conexão morreria no meio do caminho, deixando a tela sem resposta.
  const novo = squad.registrar({
    origem_ip: reg.origem_ip, origem_id: reg.origem_id, bytes: reg.bytes,
    titulo: lido.titulo, formato: lido.formato, cards: lido.cards.length,
    resultado: "montando", reprocessamento_de: reg.id, logs,
  });
  res.json({ ok: true, requisicao: novo.id, montando: true });

  squad.receber(payload, { log, jaLido: lido }).then((r) => {
    novo.resultado = "criada"; novo.peca = r.peca; novo.avisos = r.avisos || []; novo.logs = logs;
    squad.atualizar(novo);
    console.log("[squad] reprocessada " + reg.id + " -> " + r.peca);
  }).catch((e) => {
    novo.resultado = "erro"; novo.erro = e.message; novo.erro_code = e.code || null; novo.logs = logs;
    squad.atualizar(novo);
    console.error("[squad] reprocessar falhou: " + (e.code || "") + " " + e.message);
  });
});

module.exports = router;
