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

// Esta peça já foi ao ar? A trava tem que enxergar a MESMA cópia que o gate vai publicar.
// `content.getTask` acha a peça pelo nome e olha a zona ATIVA antes da aprovada; o gate publica
// sempre a cópia que está em `approved`. Com uma peça de mesmo nome nas duas zonas, as duas
// pontas do mesmo pedido enxergavam peças diferentes: a marca de "já publicado" ficava numa e a
// publicação saía da outra, e o mesmo post ia à conta real duas vezes. Basta UMA das duas dizer
// que já saiu para barrar — na dúvida, não se publica de novo.
function jaPublicada(task, folder) {
  if (task && task.status && task.status.published_at) return true;
  const aprovada = publish.statusAprovado(folder);
  return !!(aprovada && aprovada.published_at);
}

// status/config (sem segredos)
router.get("/status", (req, res) => {
  res.json({ instagram: publish.publicConfig() });
});

// salvar token + ID da conta + base pública (admin). Nunca ecoa o token de volta.
router.post("/config", adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    const salvo = publish.setInstagram({ access_token: b.access_token, ig_user_id: b.ig_user_id, public_base_url: b.public_base_url });
    // DIZ O QUE FOI COLADO. O painel aceitava um token de 1 hora em silêncio e chamava de
    // "conectado" — a conexão caiu duas vezes por isso, e a informação estava a uma chamada de
    // distância. Agora a resposta traz tipo, validade e se dá para publicar; a tela mostra na hora.
    let token = null;
    if (b.access_token) {
      try { token = await publish.inspecionaToken(b.access_token); } catch (e) { token = null; }
    }
    // TOKEN NOVO JÁ SAI CONFERIDO. Salvar deixava o selo em "não testado" e exigia um segundo
    // clique em "Testar" — e, antes disso, deixava o selo preso em "Conexão expirada", falando de
    // um token que nem estava mais salvo. Já estamos falando com a Meta aqui; então o veredito
    // que a tela mostra passa a ser o de agora, e não o da falha antiga.
    let teste = null;
    if (salvo.trocouToken) {
      try { teste = await publish.testConnection(); }
      catch (e) { teste = { ok: false, error: (e && e.message) || "Não consegui conferir com a Meta." }; }
    }
    // A configuração vai DEPOIS do teste: é ela que carrega o estado da conexão para a tela.
    res.json({ ok: true, instagram: publish.publicConfig(), token, teste });
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

// CONFERE, post a post, se o que está no histórico ainda existe no Instagram.
//
// Por que existe: a Meta não avisa quando alguém apaga um post — não há webhook de exclusão.
// Sem conferir, o painel anuncia "Publicado" para sempre, o botão "Ver no Instagram" leva a uma
// página morta e a peça segue travada como já publicada.
//
// O que esta rota NÃO resolve, e é decisão de produto em aberto: o Dashboard segue contando o
// post apagado em "publicações no mês" e pode apontar para ele como "última publicação". Não é
// esquecimento — publicar e depois apagar É um fato que aconteceu, e subtrair isso do histórico
// de atividade em silêncio seria reescrever o passado. Enquanto ninguém decidir, o Dashboard
// fica como está e quem quer a verdade sobre o que está NO AR olha "Saíram do ar" no Aprovados.
//
// O que ele NÃO faz, de propósito: não destrava a peça e não mexe no que está na conta. Só
// registra o que descobriu. Quem decide o que fazer com a peça é a pessoa — foi o pedido.
// Curto de propósito. A conferência roda TODA VEZ que a aba abre — a janela existe só para o
// caso de a tela ser remontada em sequência (voltar, trocar de aba, atualizar), que gastaria uma
// chamada por post sem nenhuma chance de a resposta ter mudado. Dois minutos protegem disso sem
// a lista ficar velha: apagou o post e abriu a aba, o painel vê.
// Curto de propósito. A conferência roda TODA VEZ que a aba abre — a janela existe só para o
// caso de a tela ser remontada em sequência (voltar, trocar de aba, atualizar), que gastaria uma
// chamada por post sem chance de a resposta ter mudado. 45s cobrem isso e não viram armadilha:
// apagar o post pelo celular e voltar ao painel demora mais do que isso.
const CONFERENCIA_VALE_MS = 45 * 1000;
// Teto da rodada. O histórico só cresce, e uma chamada por cartão com 30s de teto cada vira
// minutos numa instabilidade da Meta — segurando a trava e o pedido do navegador junto.
const MAX_POR_RODADA = 40;
// A trava guarda a HORA, não um sim/não. Trava booleana que não é solta por um caminho de erro
// cala a conferência até o processo reiniciar; com carimbo, o pior caso é conferir duas vezes.
const TRAVA_VALE_MS = 5 * 60 * 1000;
let conferindoDesde = 0;
router.post("/publications/conferir", async (req, res) => {
  const agora = Date.now();
  if (conferindoDesde && (agora - conferindoDesde) < TRAVA_VALE_MS) {
    return res.status(409).json({ error: "Já tem uma conferência em andamento.", code: "E_CONFERINDO" });
  }
  if (!publish.isConfigured()) return res.json({ ok: false, motivo: "sem_conexao", itens: [] });
  conferindoDesde = agora;
  const itens = [];
  const paraGravar = [];
  try {
    for (const rec of publications.list().slice(0, MAX_POR_RODADA)) {
      const recente = Date.parse(rec.conferido_em || "");
      if (isFinite(recente) && (agora - recente) < CONFERENCIA_VALE_MS) {
        itens.push({ id: rec.id, folder: rec.folder, estado: rec.estado_conferencia || "no_ar", doCache: true });
        continue;
      }
      const ids = publications.idsDe(rec);
      let r;
      if (!ids.length) r = { estado: "sem_id", total: 0, sumiram: 0 };
      else if (publish.storyJaExpirou(rec, agora)) r = { estado: "story_expirado", total: ids.length, sumiram: 0 };
      else r = await publish.conferirMidias(ids);

      // A decisão do que gravar mora em lib/publish.js e é medida caso a caso pela bateria — foi
      // por não estar medida que o pior defeito desta funcionalidade passou.
      const patch = publish.patchDaConferencia(rec, r, agora);
      paraGravar.push({ id: rec.id, patch });
      itens.push({ id: rec.id, folder: rec.folder, label: rec.label, estado: r.estado, sumiram: r.sumiram || 0, total: r.total || 0 });
    }
    // UMA gravação para a rodada inteira. `update` reescreve o arquivo completo a cada chamada —
    // num laço, o histórico era reescrito uma vez por registro, e cada reescrita é uma janela em
    // que uma queda deixa o arquivo pela metade.
    try { publications.updateMany(paraGravar); }
    catch (e) { console.error("[conferir] falha ao gravar a rodada:", e && e.message); }
  } catch (e) {
    return res.status(502).json({ error: (e && e.message) || "Não consegui conferir com o Instagram.", code: "E_CONFERIR" });
  } finally {
    conferindoDesde = 0;
  }
  const sumidas = itens.filter((x) => x.estado === "sumiu" || x.estado === "parcial");
  res.json({ ok: true, itens: itens, sumidas: sumidas.length, conferidas: itens.length });
});

// TIRA uma publicação do ar. DOIS caminhos, e a diferença importa:
//   ?no_instagram=1  → apaga DE VERDADE no Instagram (DELETE na Graph API) e depois some da lista.
//   sem isso         → só some da lista do painel; o post no Instagram fica onde está. É o caso de
//                      quem já apagou pelo celular e ficou com o painel anunciando um post morto.
// A peça em si NÃO é apagada: ela volta a poder ser publicada, e é isso que se quer depois de
// tirar do ar um post que saiu errado.
router.delete("/publications/:id", adminOnly, async (req, res) => {
  const item = publications.get(req.params.id);
  if (!item) return res.status(404).json({ error: "este registro de publicação não existe mais." });
  const noInstagram = String(req.query.no_instagram || "") === "1";
  const who = req.user && (req.user.name || req.user.username);
  let apagadoLa = false, aviso = null, conferido = false, cartoesApagados = 0;
  if (noInstagram) {
    // TODOS os cartões desta publicação, não só o primeiro. Um carrossel publicado no Story
    // virou N stories na conta: apagar o cartão 1, perguntar à Meta só por ele e anunciar
    // "saiu do ar" deixava os outros N-1 publicados — e a linha sumia da lista levando junto a
    // única pista que existia deles. Registro antigo tem um id só, e `idsDe` continua lendo.
    const ids = publications.idsDe(item);
    let r;
    try {
      r = await publish.deleteMedias(ids);
    } catch (e) {
      // Não some da lista se o post continua no ar: sumir aqui daria a impressão de que foi
      // apagado lá, e o post seguiria publicado sem ninguém sabendo.
      return res.status(e.code === "E_SEM_PERMISSAO_APAGAR" ? 403 : 502).json({ error: e.message, code: e.code || "E_APAGAR" });
    }
    if (!r.todos) {
      const primeira = r.falharam[0] || {};
      const motivo = primeira.message || "o Instagram recusou apagar.";
      if (!r.apagados.length) {
        // Nada saiu: mesma resposta de sempre — a linha fica na lista e o texto explica o motivo.
        return res.status(primeira.code === "E_SEM_PERMISSAO_APAGAR" ? 403 : 502).json({ error: motivo, code: primeira.code || "E_APAGAR" });
      }
      // PARCIAL. A publicação FICA na lista, apontando só para os cartões que continuam no ar —
      // assim a próxima tentativa não bate nos que já sumiram e a pessoa não perde a conta do
      // que falta. Dizer "apaguei" aqui seria mentir sobre o que saiu do ar, que é pior do que
      // falhar: ninguém iria conferir depois.
      const restantes = ids.filter((id) => r.apagados.indexOf(id) < 0);
      try {
        publications.update(item.id, {
          cartoes: restantes,
          post_id: restantes[0] || null,
          // O link "Ver no Instagram" era do cartão que acabou de sair do ar: mantê-lo daria
          // uma página inexistente a quem clicasse.
          permalink: restantes.indexOf(item.post_id) >= 0 ? item.permalink : null,
          cartoes_apagados: (Array.isArray(item.cartoes_apagados) ? item.cartoes_apagados : []).concat(r.apagados),
          parcial_em: new Date().toISOString(),
        });
      } catch (e) { console.error("[publish] falha ao guardar o que sobrou da publicação:", item.id, e && e.message); }
      return res.status(502).json({
        code: "E_APAGAR_PARCIAL",
        error: "Apaguei " + r.apagados.length + " de " + r.total + " cartões desta publicação. "
          + (restantes.length === 1 ? "1 cartão ainda está no ar" : restantes.length + " cartões ainda estão no ar")
          + " e a publicação continua na lista para você tentar de novo ou apagar pelo aplicativo. O que impediu: " + motivo,
        apagados: r.apagados.length, restantes: restantes.length, total: r.total,
      });
    }
    apagadoLa = true;
    conferido = !!r.conferido;
    cartoesApagados = r.apagados.length;
    if (r.ja_nao_existiam >= r.total) {
      aviso = r.total > 1
        ? "Estes " + r.total + " cartões já não existiam no Instagram — provavelmente foram apagados pelo aplicativo. Tirei da lista do painel."
        : "Este post já não existia no Instagram — provavelmente foi apagado pelo aplicativo. Tirei da lista do painel.";
    } else if (r.ja_nao_existiam > 0) {
      aviso = r.ja_nao_existiam + " de " + r.total + " cartões já não existiam no Instagram — provavelmente foram apagados pelo aplicativo. Apaguei os que restavam e tirei a publicação da lista do painel.";
    }
  }
  const fora = publications.remove(req.params.id, noInstagram ? "apagado no Instagram pelo painel" : "removido do histórico (apagado por fora)", who);
  // A peça volta a ficar publicável: sem isso o botão de publicar continuaria apagado, dizendo
  // "já publicado", para uma publicação que não existe mais.
  let task = null;
  try { content.clearPublished(item.folder, noInstagram ? "apagada no Instagram pelo painel" : "apagada por fora e tirada do histórico"); task = content.getTask(item.folder); } catch (e) { /* peça pode ter sido descartada; a lista já foi limpa */ }
  // `cartoes` diz QUANTOS posts saíram do ar nesta operação (um Story de carrossel são vários).
  res.json({ ok: true, removido: fora, apagado_no_instagram: apagadoLa, conferido: conferido, cartoes: cartoesApagados, task: task, aviso: aviso });
});

// marca uma peça APROVADA como JÁ PUBLICADA manualmente — para publicações feitas por fora
// do painel (ou antes do rastreamento existir). Registra no histórico p/ aparecer em "Publicados",
// SEM postar de novo no Instagram (evita duplicar o post). Body: { published_at?, post_id?, permalink? }.
router.post("/:folder/mark-published", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "peça não encontrada" });
  if (t.zone !== "approved") return res.status(409).json({ error: "só peças aprovadas podem ser marcadas como publicadas.", code: "E_NOT_APPROVED" });
  if (jaPublicada(t, req.params.folder)) return res.status(409).json({ error: "esta peça já consta como publicada.", code: "E_ALREADY_PUBLISHED" });
  const b = req.body || {};
  const who = req.user && (req.user.name || req.user.username);
  let at = null;
  if (b.published_at) { const d = new Date(b.published_at); if (!isNaN(d.getTime())) at = d.toISOString(); }
  try {
    // MESMO gate das rotas de publicar e de agendar. Sem ele, uma peça adulterada depois de
    // aprovada (ou aprovada sem as assinaturas dos arquivos) era recusada para publicar e
    // ACEITA para entrar no histórico — e aí o histórico deixa de ser registro confiável do que
    // foi ao ar, que é a única coisa que ele serve para ser.
    publish.assertApproved(req.params.folder);
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
  } catch (e) {
    // Os códigos do gate viram 409 com o MESMO texto que as rotas de publicar e agendar já
    // mostram — a recusa tem que ser a mesma, venha por onde vier.
    const gate = ["E_NOT_APPROVED", "E_INVALID_STATE", "E_GATE_NO_HASHES", "E_HASH_MISMATCH", "E_BAD_FOLDER"].indexOf(e.code) >= 0;
    if (gate) return res.status(409).json({ error: e.message, code: e.code });
    res.status(500).json({ error: e.message });
  }
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
    if (jaPublicada(t0, folder)) {
      return res.status(409).json({ error: "Esta peça já foi publicada. Para publicar de novo, reabra a peça primeiro.", code: "E_ALREADY_PUBLISHED" });
    }
    if (publishingNow.has(folder)) {
      return res.status(409).json({ error: "Esta peça já está sendo publicada agora. Aguarde alguns segundos.", code: "E_PUBLISH_IN_FLIGHT" });
    }
    publishingNow.add(folder);
  }
  try {
    // O DESTINO vem da tela. Sem ele, o painel usava o padrão do tipo — e registrava "feed"
    // fixo no histórico, qualquer que fosse a peça.
    const r = await publish.publishTask(folder, { kind: b.kind, destino: b.destino, caption: b.caption, dryRun: b.dryRun });
    // Só quando saiu DE VERDADE (não dry-run): marca a peça como publicada + registra no histórico.
    const warnings = [];
    if (r && r.ok && !r.dry_run) {
      const who = req.user && (req.user.name || req.user.username);
      const t = content.getTask(folder);
      // O post JÁ ESTÁ NO AR aqui. Se o registro falhar, não dá para desfazer — mas o usuário
      // PRECISA saber, senão a peça continua parecendo não-publicada e alguém posta de novo.
      try { content.setPublished(folder, { by: who, post_id: r.post_id }); }
      catch (e) { console.error("[publish] post publicado mas falhou ao marcar a peça:", folder, e && e.message); warnings.push("O post foi publicado, mas não consegui marcar a peça como publicada. Marque manualmente para não publicar de novo."); }
      // `cartoes` viaja junto: um carrossel no Story vira VÁRIOS posts na conta, e o registro
      // que guardasse só o primeiro deixaria os outros no ar sem nenhum botão que os alcançasse.
      try { publications.add({ folder: folder, label: (t && t.status && t.status.title) || folder, kind: r.type, destino: r.destino || "feed", caption: b.caption, post_id: r.post_id, cartoes: r.cartoes, permalink: r.permalink, scheduled_at: null, by: who }); }
      catch (e) { console.error("[publish] post publicado mas falhou ao registrar no histórico:", folder, e && e.message); warnings.push("O post foi publicado, mas não entrou no histórico de Publicados."); }
      // Publicou agora: qualquer agendamento pendente desta peça viraria um post duplicado.
      try {
        // Só os agendamentos DO MESMO destino viram duplicata: publicar no story agora não
        // invalida um feed marcado para amanhã.
        const cancelled = schedule.cancelPendingFor(folder, undefined, r.destino || "feed");
        if (cancelled.length) warnings.push("Cancelei " + cancelled.length + (cancelled.length === 1 ? " agendamento pendente" : " agendamentos pendentes") + " desta peça para não publicar duas vezes.");
      } catch (e) { console.error("[publish] falha ao cancelar agendamentos da peça:", folder, e && e.message); }
    }
    res.json(Object.assign({ ok: true, task: content.getTask(folder), warnings: warnings }, r));
  } catch (e) {
    let msg = e.message;
    // O Story saiu PELA METADE: alguns cartões já estão no ar e o seguinte falhou. Sem registrar
    // nada, esses cartões publicados ficavam fora do histórico — nenhum botão do painel os
    // alcançava, e a peça continuava parecendo não-publicada (um "Publicar" depois duplicaria os
    // que já saíram). Registra o que saiu e marca a peça, para o painel dizer a verdade.
    if (e.code === "E_STORY_PARCIAL" && Array.isArray(e.publicados) && e.publicados.length) {
      const who = req.user && (req.user.name || req.user.username);
      const t = content.getTask(folder);
      try { content.setPublished(folder, { by: who, post_id: e.publicados[0] }); }
      catch (e2) { console.error("[publish] story parcial: falhou ao marcar a peça:", folder, e2 && e2.message); }
      try {
        publications.add({ folder: folder, label: (t && t.status && t.status.title) || folder, kind: e.publicados.length > 1 ? e.publicados.length + " cartões de story" : "story", destino: "story", post_id: e.publicados[0], cartoes: e.publicados, scheduled_at: null, by: who });
        msg += " Registrei em Publicações os " + e.publicados.length
          + (e.publicados.length === 1 ? " cartão que saiu" : " cartões que saíram")
          + ", para você poder apagá-los pelo painel se quiser.";
      } catch (e2) { console.error("[publish] story parcial: falhou ao registrar no histórico:", folder, e2 && e2.message); }
    }
    const gate = ["E_NOT_APPROVED", "E_INVALID_STATE", "E_GATE_NO_HASHES", "E_HASH_MISMATCH"].indexOf(e.code) >= 0;
    res.status(gate ? 409 : (e.code === "E_NO_IMAGE" ? 422 : 400)).json({ error: msg, code: e.code });
  } finally {
    if (isReal) publishingNow.delete(folder);
  }
});

module.exports = router;
