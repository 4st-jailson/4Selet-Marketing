// routes/publish.js — publicação no Instagram (Graph API), atrás do gate de auth.
// Config (token/ID) só admin. Publicar exige peça aprovada (gate no lib/publish).
"use strict";
const express = require("express");
const router = express.Router();
const publish = require("../lib/publish");
const schedule = require("../lib/schedule");
const publications = require("../lib/publications");
const content = require("../lib/content");
const config = require("../lib/config");

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Só administradores configuram a publicação." });
  next();
}

// status/config (sem segredos)
router.get("/status", (req, res) => {
  res.json({ instagram: publish.publicConfig() });
});

// salvar token + ID da conta + base pública (admin). Nunca ecoa o token de volta.
router.post("/config", adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    const cfg = publish.setInstagram({ access_token: b.access_token, ig_user_id: b.ig_user_id, public_base_url: b.public_base_url });
    // DIZ O QUE FOI COLADO. O painel aceitava um token de 1 hora em silêncio e chamava de
    // "conectado" — a conexão caiu duas vezes por isso, e a informação estava a uma chamada de
    // distância. Agora a resposta traz tipo, validade e se dá para publicar; a tela mostra na hora.
    let token = null;
    if (b.access_token) {
      try { token = await publish.inspecionaToken(b.access_token); } catch (e) { token = null; }
    }
    res.json({ ok: true, instagram: cfg, token });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Deriva o token da PÁGINA (que não expira) a partir do de usuário e troca. Um clique no lugar da
// sequência manual no Explorer + depurador, que já falhou duas vezes por um passo esquecido.
router.post("/tornar-permanente", adminOnly, async (req, res) => {
  try {
    const r = await publish.tornarPermanente();
    if (!r.ok) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// testar conexão com a Meta (valida token + retorna @ da conta)
router.post("/test", adminOnly, async (req, res) => {
  try { res.json(await publish.testConnection()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// histórico de publicações que foram ao ar (agendadas OU diretas) — aba "Publicados"
router.get("/publications", (req, res) => res.json({ items: publications.list() }));

// marca uma peça APROVADA como JÁ PUBLICADA manualmente — para publicações feitas por fora
// do painel (ou antes do rastreamento existir). Registra no histórico p/ aparecer em "Publicados",
// SEM postar de novo no Instagram (evita duplicar o post). Body: { published_at?, post_id?, permalink? }.
router.post("/:folder/mark-published", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "peça não encontrada" });
  if (t.zone !== "approved") return res.status(409).json({ error: "só peças aprovadas podem ser marcadas como publicadas.", code: "E_NOT_APPROVED" });
  if (t.status && t.status.published_at) return res.status(409).json({ error: "esta peça já consta como publicada.", code: "E_ALREADY_PUBLISHED" });
  const b = req.body || {};
  const who = req.user && (req.user.name || req.user.username);
  let at = null;
  if (b.published_at) { const d = new Date(b.published_at); if (!isNaN(d.getTime())) at = d.toISOString(); }
  try {
    content.setPublished(req.params.folder, { by: who, at: at, post_id: b.post_id });
    const destino = config.DESTINO_IDS.indexOf(b.destino) >= 0 ? b.destino : config.destinoPadrao(t.kind);
    const item = publications.add({ folder: req.params.folder, label: (t.status && t.status.title) || req.params.folder, kind: t.kind, destino: destino, post_id: b.post_id || null, permalink: b.permalink || null, published_at: at, scheduled_at: null, by: who, manual: true });
    // A peça já foi ao ar: um agendamento pendente dela publicaria o mesmo post de novo.
    const warnings = [];
    try {
      // Só os pendentes DESTE destino: marcar o feed como publicado não pode cancelar o story agendado.
      const cancelled = schedule.cancelPendingFor(req.params.folder, undefined, destino);
      if (cancelled.length) warnings.push("Cancelei " + cancelled.length + (cancelled.length === 1 ? " agendamento pendente" : " agendamentos pendentes") + " desta peça para não publicar duas vezes.");
    } catch (e) { console.error("[publish] falha ao cancelar agendamentos da peça:", req.params.folder, e && e.message); }
    res.json({ ok: true, item: item, task: content.getTask(req.params.folder), warnings: warnings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- agendamento ---
// lista os agendamentos (fila)
router.get("/schedule", (req, res) => res.json({ items: schedule.list() }));
// cancela/suspende um agendamento pendente
router.delete("/schedule/:id", (req, res) => {
  try {
    const it = schedule.cancel(req.params.id);
    if (!it) return res.status(404).json({ error: "agendamento não encontrado" });
    res.json({ ok: true, item: it });
  } catch (e) { res.status(e.code === "E_NOT_PENDING" ? 409 : 400).json({ error: e.message, code: e.code }); }
});
// agenda uma peça APROVADA. Body: { kind?, caption?, scheduled_at (ISO), label? }.
router.post("/:folder/schedule", (req, res) => {
  try {
    const b = req.body || {};
    if (!b.scheduled_at) return res.status(400).json({ error: "scheduled_at (data/hora) é obrigatório" });
    publish.assertApproved(req.params.folder); // gate ANTES de agendar (peça precisa estar aprovada+íntegra)
    const item = schedule.add({ folder: req.params.folder, kind: b.kind, caption: b.caption, scheduled_at: b.scheduled_at, label: b.label, destino: b.destino, by: req.user && req.user.username });
    res.json({ ok: true, item });
  } catch (e) {
    const gate = ["E_NOT_APPROVED", "E_INVALID_STATE", "E_GATE_NO_HASHES", "E_HASH_MISMATCH", "E_ALREADY_SCHEDULED"].indexOf(e.code) >= 0;
    res.status(gate ? 409 : 400).json({ error: e.message, code: e.code });
  }
});

// Peças com publicação EM VOO neste instante. Um post no Instagram leva alguns segundos
// (contêiner + publish, mais ainda no carrossel); sem esta trava, dois cliques no botão — ou
// um retry de rede — entravam nas duas requisições em paralelo e saíam DOIS posts iguais na
// conta real. Em memória basta: é uma janela de segundos e o painel é um processo só.
const publishingNow = new Set();

// publicar (ou simular) uma peça APROVADA. Body: { kind?, caption?, dryRun? }.
router.post("/:folder", async (req, res) => {
  const folder = req.params.folder;
  const b = req.body || {};
  const isReal = !b.dryRun;
  if (isReal) {
    // Já publicada? Não repete. (Para publicar de novo de propósito, o caminho é reabrir a peça
    // — o promote_task limpa a marca. Mesma regra que o mark-published já aplicava.)
    const t0 = content.getTask(folder);
    if (t0 && t0.status && t0.status.published_at) {
      return res.status(409).json({ error: "Esta peça já foi publicada. Para publicar de novo, reabra a peça primeiro.", code: "E_ALREADY_PUBLISHED" });
    }
    if (publishingNow.has(folder)) {
      return res.status(409).json({ error: "Esta peça já está sendo publicada agora. Aguarde alguns segundos.", code: "E_PUBLISH_IN_FLIGHT" });
    }
    publishingNow.add(folder);
  }
  try {
    const r = await publish.publishTask(folder, { kind: b.kind, caption: b.caption, dryRun: b.dryRun });
    // Só quando saiu DE VERDADE (não dry-run): marca a peça como publicada + registra no histórico.
    const warnings = [];
    if (r && r.ok && !r.dry_run) {
      const who = req.user && (req.user.name || req.user.username);
      const t = content.getTask(folder);
      // O post JÁ ESTÁ NO AR aqui. Se o registro falhar, não dá para desfazer — mas o usuário
      // PRECISA saber, senão a peça continua parecendo não-publicada e alguém posta de novo.
      try { content.setPublished(folder, { by: who, post_id: r.post_id }); }
      catch (e) { console.error("[publish] post publicado mas falhou ao marcar a peça:", folder, e && e.message); warnings.push("O post foi publicado, mas não consegui marcar a peça como publicada. Marque manualmente para não publicar de novo."); }
      try { publications.add({ folder: folder, label: (t && t.status && t.status.title) || folder, kind: r.type, destino: "feed", caption: b.caption, post_id: r.post_id, permalink: r.permalink, scheduled_at: null, by: who }); }
      catch (e) { console.error("[publish] post publicado mas falhou ao registrar no histórico:", folder, e && e.message); warnings.push("O post foi publicado, mas não entrou no histórico de Publicados."); }
      // Publicou agora: qualquer agendamento pendente desta peça viraria um post duplicado.
      try {
        // A publicação pela API é sempre no feed — é o único destino que a Graph API aceita hoje.
        const cancelled = schedule.cancelPendingFor(folder, undefined, "feed");
        if (cancelled.length) warnings.push("Cancelei " + cancelled.length + (cancelled.length === 1 ? " agendamento pendente" : " agendamentos pendentes") + " desta peça para não publicar duas vezes.");
      } catch (e) { console.error("[publish] falha ao cancelar agendamentos da peça:", folder, e && e.message); }
    }
    res.json(Object.assign({ ok: true, task: content.getTask(folder), warnings: warnings }, r));
  } catch (e) {
    const gate = ["E_NOT_APPROVED", "E_INVALID_STATE", "E_GATE_NO_HASHES", "E_HASH_MISMATCH"].indexOf(e.code) >= 0;
    res.status(gate ? 409 : (e.code === "E_NO_IMAGE" ? 422 : 400)).json({ error: e.message, code: e.code });
  } finally {
    if (isReal) publishingNow.delete(folder);
  }
});

module.exports = router;
