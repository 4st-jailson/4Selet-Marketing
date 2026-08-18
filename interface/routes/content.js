// routes/content.js — tasks (conteudo): listar, detalhar, ler arquivo, preview,
// promover (workflow de aprovacao). Integra os scripts oficiais via lib/content.
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const content = require("../lib/content");
const render = require("../lib/render");
const campaigns = require("../lib/campaigns");
const thumbs = require("../lib/thumbs");

router.get("/", (req, res) => {
  res.json({ tasks: content.listTasks() });
});

// Sniff por magic bytes -> extensão canônica. Aceita só PNG e JPEG (formatos seguros p/ o
// feed do Instagram). Não confia no prefixo data:image.
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png"; // PNG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";                     // JPEG
  return null;
}
function slugifyName(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

// POST /import — cria uma peça de RASCUNHO a partir de imagens PRONTAS (feitas fora do
// painel). kind "feed" (1 imagem) ou "carousel" (2-10). As imagens vão para ads/feed.<ext>
// ou slides/slide_N.<ext>; a legenda para copy/instagram_caption.txt (mesmo caminho que a
// publicação lê); status.imported=true. Depois segue o fluxo normal: revisar → aprovar →
// agendar/publicar. Valida e decodifica TUDO antes de criar a task (falha atômica).
router.post("/import", async (req, res, next) => {
  try {
    const b = req.body || {};
    const kind = b.kind === "carousel" ? "carousel" : (b.kind === "feed" ? "feed" : null);
    if (!kind) return res.status(400).json({ error: "tipo inválido (use feed ou carousel)" });
    const title = String(b.title || "").trim();
    if (title.length < 3) return res.status(400).json({ error: "dê um título à peça (mín. 3 caracteres)" });
    const date = String(b.task_date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "data inválida (use AAAA-MM-DD)" });
    const task = (String(b.task_name || "").trim() || slugifyName(title));
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(task)) return res.status(400).json({ error: "identificador inválido (use a-z, 0-9, _ ou -)" });

    const imgs = Array.isArray(b.images) ? b.images : [];
    if (kind === "feed" && imgs.length !== 1) return res.status(400).json({ error: "o feed precisa de exatamente 1 imagem" });
    if (kind === "carousel" && (imgs.length < 2 || imgs.length > 10)) return res.status(400).json({ error: "o carrossel precisa de 2 a 10 imagens" });

    // decodifica + valida ANTES de tocar no disco
    const decoded = [];
    for (let i = 0; i < imgs.length; i++) {
      const m = /^data:image\/[a-z0-9.+-]+;base64,([\s\S]+)$/i.exec(String(imgs[i] || ""));
      if (!m) return res.status(400).json({ error: "imagem " + (i + 1) + " inválida (esperado dataURL base64)" });
      const buf = Buffer.from(m[1], "base64");
      const ext = sniffImage(buf);
      if (!ext) return res.status(400).json({ error: "imagem " + (i + 1) + " não é PNG nem JPEG" });
      if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: "imagem " + (i + 1) + " passa de 10MB" });
      decoded.push({ buf, ext });
    }

    const folder = task + "_" + date;
    if (content.findTask(folder)) return res.status(409).json({ error: "já existe uma peça com esse identificador e data", code: "E_EXISTS" });

    // Resolve a campanha UMA vez: só liga/grava se ela existir de verdade (senão gravaríamos
    // uma referência-fantasma no status.json que a campanha não lista de volta).
    const camp = b.campaign_id ? campaigns.get(b.campaign_id) : null;
    const angle = camp ? (camp.angle || null) : null;
    const create = await content.createTask({ task_name: task, task_date: date, platforms: ["instagram"], angle });
    if (!create.ok) return res.status(400).json({ error: "falha ao criar a peça", detail: create.stderr || create.stdout });

    try {
      if (kind === "feed") {
        content.writeMediaFile(folder, "ads/feed." + decoded[0].ext, decoded[0].buf);
      } else {
        decoded.forEach((d, i) => content.writeMediaFile(folder, "slides/slide_" + (i + 1) + "." + d.ext, d.buf));
      }
      content.writeContentFile(folder, "copy/instagram_caption.txt", String(b.caption || "").trim() + "\n", "importação");
    } catch (e) {
      // A peça já foi criada acima. Se a gravação falhou (disco cheio, permissão), deixá-la de
      // pé criava uma casca vazia na biblioteca E travava o identificador: a tentativa seguinte
      // batia em 409 "já existe" e o usuário tinha que descartar à mão algo que nunca pediu.
      try { content.discardTask(folder); } catch (e2) { console.error("[import] falha ao descartar a peça incompleta:", folder, e2 && e2.message); }
      return res.status(500).json({ error: "falha ao gravar os arquivos da peça: " + e.message, code: e.code || null });
    }

    content.setTitle(folder, title);
    content.setImported(folder);
    if (b.pillar) content.setPillar(folder, b.pillar);
    if (camp) { try { campaigns.linkContent(camp.id, folder); content.setCampaignId(folder, camp.id); } catch (e) { /* liga é best-effort */ } }

    res.json({ ok: true, folder, kind, images: decoded.length, task: content.getTask(folder) });
  } catch (e) { next(e); }
});

// POST /:folder/caption — grava/edita a legenda (copy/instagram_caption.txt). Usado para
// corrigir a legenda de peças importadas. Só na zona active (writeContentFile já impõe).
router.post("/:folder/caption", (req, res) => {
  const caption = String((req.body && req.body.caption) || "");
  try {
    const rel = content.writeContentFile(req.params.folder, "copy/instagram_caption.txt", caption.trim() + "\n", "legenda");
    res.json({ ok: true, file: rel });
  } catch (e) {
    const code = e.code === "E_NOT_EDITABLE" ? 409 : (e.code === "E_TASK_NOT_FOUND" ? 404 : 500);
    res.status(code).json({ error: e.message, code: e.code || null });
  }
});

router.get("/:folder", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  // #4 — carimba a primeira visualizacao (remove o selo "Novo" na biblioteca).
  try { content.markViewed(req.params.folder); } catch (e) { /* nao critico */ }
  res.json({ task: t });
});

router.get("/:folder/file", (req, res) => {
  const rel = req.query.rel;
  if (!rel) return res.status(400).json({ error: "parametro rel obrigatorio" });
  const body = content.readFile(req.params.folder, String(rel));
  if (body == null) return res.status(404).json({ error: "arquivo nao encontrado" });
  res.type("text/plain").send(body);
});

// Serve um arquivo binario (imagem/video) inline para preview na biblioteca.
router.get("/:folder/raw", (req, res) => {
  const rel = req.query.rel;
  if (!rel) return res.status(400).json({ error: "parametro rel obrigatorio" });
  const f = content.resolveFile(req.params.folder, String(rel));
  if (!f) return res.status(404).json({ error: "arquivo nao encontrado" });
  // no-cache: o navegador revalida (o front ainda versiona por ?v=mtime p/ garantir).
  res.set("Cache-Control", "no-cache");
  // M4: HTML/SVG servido inline nunca deve executar — serve como texto puro.
  if (/\.(html?|svg)$/i.test(String(rel))) { try { return res.type("text/plain").send(fs.readFileSync(f.abs)); } catch (e) { return res.status(404).end(); } }
  // ?thumb=1 — o cartão da biblioteca quer só a miniatura (ver lib/thumbs.js). Enquanto ela não
  // existe, serve a arte original: a tela nunca fica pior do que era, só melhora depois.
  if (req.query.thumb) {
    const mini = thumbs.miniatura(f.abs, String(rel));
    if (mini) return res.type("image/jpeg").sendFile(mini);
  }
  res.sendFile(f.abs);
});

// Download com Content-Disposition (forca salvar o arquivo).
// ?scale=1|2|4 (so PNG): baixa a arte na resolucao escolhida — re-renderiza a peca
// a partir do HTML salvo. Sem `scale`, serve o arquivo salvo como esta. Se o
// re-render falhar (ex.: sem HTML de origem), cai para o arquivo salvo (degrada bem).
router.get("/:folder/download", async (req, res) => {
  const rel = req.query.rel;
  if (!rel) return res.status(400).json({ error: "parametro rel obrigatorio" });
  const wantsScale = req.query.scale != null && String(req.query.scale) !== "";
  if (wantsScale && /\.png$/i.test(String(rel))) {
    const scale = Math.max(1, Math.min(4, parseInt(req.query.scale, 10) || 1));
    try {
      const out = await render.renderForDownload(req.params.folder, String(rel), scale);
      const stem = path.basename(String(rel)).replace(/\.png$/i, "");
      const name = stem + "_" + out.width + "x" + out.height + ".png";
      return res.download(out.path, name, () => { if (out.temp) { try { fs.unlinkSync(out.path); } catch (e) {} } });
    } catch (e) {
      console.warn("[download] re-render em escala falhou (" + (e.code || "") + "): " + e.message + " — servindo arquivo salvo");
      // cai para servir o arquivo salvo abaixo
    }
  }
  const f = content.resolveFile(req.params.folder, String(rel));
  if (!f) return res.status(404).json({ error: "arquivo nao encontrado" });
  res.download(f.abs, f.name);
});

// #5 — Define as tags (rotulos livres) da task. Body: { tags: [] | "a,b,c" }.
router.post("/:folder/tags", (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  const tags = (req.body && req.body.tags != null) ? req.body.tags : [];
  const saved = content.setTags(req.params.folder, tags);
  if (saved == null) return res.status(400).json({ error: "nao foi possivel salvar as tags" });
  res.json({ ok: true, tags: saved });
});

// Prepara uma peça IMPORTADA para edição: a imagem vira a primeira camada de uma prancheta que o
// editor sabe abrir. O original fica guardado como <nome>.orig.<ext> dentro da própria peça.
// É um passo EXPLÍCITO, e não parte do "Importar": importar continua instantâneo e à prova de falha,
// e assim a peça que já foi importada antes desta mudança também vira editável, sem reimportar.
router.post("/:folder/preparar-edicao", async (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  try {
    const r = await render.prepararImportada(req.params.folder);
    console.log("[preparar-edicao] " + req.params.folder + ": " + r.preparadas.length + " arte(s), "
      + r.ja_preparadas.length + " ja estavam prontas — por " + ((req.user && req.user.username) || "?"));
    res.json(r);
  } catch (e) {
    const humano = {
      E_SEM_ARTE: "Não encontrei nenhuma arte importada nesta peça para preparar.",
      E_SEM_DIMENSAO: "Não consegui ler o tamanho da imagem. Envie um PNG ou JPEG comum.",
      E_PRANCHETA: "Não consegui montar a prancheta desta arte.",
      // requireActive lança E_NOT_EDITABLE, não E_NOT_ACTIVE: a tradução estava presa no código
      // errado e a pessoa via a mensagem técnica crua ("renderizar exige zona active…").
      E_NOT_EDITABLE: "Esta peça está aprovada, e peça aprovada fica selada. Use “Reabrir para edição” antes de preparar.",
      E_NOT_ACTIVE: "Esta peça está aprovada. Reabra para edição antes de preparar.",
    };
    // 409 = "o estado não permite", não é falha do servidor: peça sem arte e peça aprovada
    // são as duas situações em que o pedido faz sentido mas a hora está errada.
    const conflito = e.code === "E_SEM_ARTE" || e.code === "E_NOT_EDITABLE" || e.code === "E_NOT_ACTIVE";
    res.status(conflito ? 409 : 500)
      .json({ error: humano[e.code] || e.message, code: e.code || "E_PREPARAR" });
  }
});

// Renderiza a midia final (PNG/MP4) a partir do conceito. ?kind=image|feed|carousel|video
router.post("/:folder/render", async (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  // Peça IMPORTADA não se re-renderiza: "Gerar arte final" redesenharia pelo template da marca e
  // sobrescreveria a imagem que a pessoa trouxe pronta. A tela já esconde o botão — mas só a tela.
  // Uma chamada direta a esta rota destruía a arte, e o resultado é irreversível.
  if (t.status && t.status.imported) {
    return res.status(409).json({
      error: "Esta peça foi importada por você. Gerar a arte final substituiria a sua imagem pelo desenho do painel.",
      code: "E_PECA_IMPORTADA",
    });
  }
  const kind = String((req.query.kind || req.body && req.body.kind || t.kind || "").trim());
  const reqTpl = String((req.query.template || (req.body && req.body.template) || "").trim());
  // PECA_IDS, nao TEMPLATE_IDS: alem dos 4 templates classicos, a peca unica agora aceita os
  // arquetipos que valem sozinhos (numero, palavra, citacao, comparacao, grade, lista, fluxo).
  // Validando so contra os 4, `template=numero` virava undefined ANTES de chegar ao render — e era
  // por isso que a peca continuava saindo com a mesma cara depois de todo o trabalho dos arquetipos.
  const template = render.PECA_IDS.includes(reqTpl) ? reqTpl : undefined;
  const reqLogo = String((req.query.logo || (req.body && req.body.logo) || "").trim());
  const logo = (render.LOGO_IDS.includes(reqLogo) || reqLogo === "auto") ? reqLogo : undefined;
  const reqWm = String((req.query.watermark || (req.body && req.body.watermark) || "").trim());
  const watermark = (render.WATERMARK_IDS.includes(reqWm) || reqWm === "auto") ? reqWm : undefined;
  // Tipografia da peça: lista FECHADA (render.FAMILIA_IDS) + "auto" p/ voltar à identidade da marca.
  const reqFont = String((req.query.font || (req.body && req.body.font) || "").trim());
  const font = (render.FAMILIA_IDS.includes(reqFont) || reqFont === "auto") ? reqFont : undefined;
  // Superfície da peça: lista FECHADA (render.FUNDO_IDS). É o que permite corrigir um fundo
  // escolhido errado na criação sem refazer a peça inteira.
  const reqFundo = String((req.query.fundo || (req.body && req.body.fundo) || "").trim());
  const fundo = (render.FUNDO_IDS.includes(reqFundo) || reqFundo === "auto") ? reqFundo : undefined;
  try {
    if (fundo) content.setRenderPref(req.params.folder, { fundo: fundo });
    const r = await render.render(req.params.folder, kind, { template, logo, watermark, font, fundo: fundo === "auto" ? "" : fundo });
    const task = content.getTask(req.params.folder);
    const payload = Object.assign({ kind, task }, r);
    // Sem isto, uma falha de render (r.ok=false) chegava ao front como "HTTP 400" cru
    // (o api.js só lê `error`). Agora mostra o motivo real (ex.: stderr do Playwright).
    if (!r.ok && !payload.error) payload.error = (r.stderr && String(r.stderr).slice(0, 300)) || "Não foi possível gerar a arte. Tente novamente.";
    return res.status(r.ok ? 200 : 400).json(payload);
  } catch (e) {
    const code = e.code === "E_NOT_EDITABLE" ? 409 : (e.code === "E_NO_RENDER" ? 422 : 500);
    return res.status(code).json({ error: e.message, code: e.code });
  }
});

// Descarta (move para outputs/_archived/, reversivel).
router.post("/:folder/discard", (req, res) => {
  try {
    const r = content.discardTask(req.params.folder);
    return res.json(Object.assign({ ok: true }, r));
  } catch (e) {
    const code = e.code === "E_TASK_NOT_FOUND" ? 404 : (e.code === "E_NOT_DISCARDABLE" ? 409 : 500);
    return res.status(code).json({ error: e.message, code: e.code });
  }
});

// Gera o preview.html oficial e promove draft -> in_review
router.post("/:folder/preview", async (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  const r = await content.generatePreview(t.status.task_name, t.status.task_date);
  if (!r.ok && !r.error) r.error = (r.stderr && String(r.stderr).slice(0, 300)) || "Não foi possível gerar a prévia da peça.";
  res.status(r.ok ? 200 : 400).json(r);
});

// Transicao de estado (in_review/approved/rejected) via promote_task.js
router.post("/:folder/promote", async (req, res) => {
  const t = content.getTask(req.params.folder);
  if (!t) return res.status(404).json({ error: "task nao encontrada" });
  const { to, by, reason } = req.body || {};
  if (!to) return res.status(400).json({ error: "campo 'to' obrigatorio" });
  const r = await content.promote(t.status.task_name, t.status.task_date, to, by, reason);
  if (!r.ok && !r.error) r.error = (r.stderr && String(r.stderr).slice(0, 300)) || "Não foi possível concluir a transição da peça.";
  res.status(r.ok ? 200 : 400).json(r);
});

// --- Historico de versoes: desfazer/restaurar ajustes (zona active) ---
router.get("/:folder/versions", (req, res) => {
  try { res.json({ versions: content.listContentVersions(req.params.folder, req.query.rel) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.post("/:folder/restore", (req, res) => {
  try {
    const { rel, id } = req.body || {};
    if (!rel || !id) return res.status(400).json({ error: "rel e id são obrigatórios" });
    const file = content.restoreContentVersion(req.params.folder, rel, id);
    res.json({ ok: true, file, task: content.getTask(req.params.folder) });
  } catch (e) {
    const code = e.code === "E_NOT_EDITABLE" ? 409 : (e.code === "E_VERSION_NOT_FOUND" ? 404 : 400);
    res.status(code).json({ error: e.message, code: e.code });
  }
});


// Baixa TODAS as artes da peca (png/jpg/webp/mp4) num unico .zip. Sem dependencia (lib/zip).
router.get("/:folder/zip", (req, res) => {
  try {
    const t = content.getTask(req.params.folder);
    if (!t) return res.status(404).json({ error: "task nao encontrada" });
    const files = content.collectMediaForZip(req.params.folder);
    if (!files.length) return res.status(404).json({ error: "esta peça não tem artes para baixar" });
    const zip = require("../lib/zip").zipStore(files);
    const base = String(req.params.folder).replace(/[^a-z0-9._-]+/gi, "_") || "pecas";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="' + base + '.zip"');
    res.setHeader("Content-Length", zip.length);
    res.send(zip);
  } catch (e) {
    res.status(e.code === "E_TASK_NOT_FOUND" ? 404 : 400).json({ error: e.message, code: e.code });
  }
});

// Editor HTML (item A): grava o HTML editado da peca + re-renderiza o PNG (pixel-perfect).
router.post("/:folder/edit-html", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.rel || !body.html) return res.status(400).json({ error: "rel e html são obrigatórios" });
    if (String(body.html).length > 4 * 1024 * 1024) return res.status(413).json({ error: "HTML muito grande (máx. 4 MB)." });
    const r = await render.renderEditedHtml(req.params.folder, String(body.rel), String(body.html));
    res.json(Object.assign({ ok: true, task: content.getTask(req.params.folder) }, r));
  } catch (e) {
    const code = e.code === "E_NOT_EDITABLE" ? 409 : (e.code === "E_RENDER_FAIL" ? 422 : 400);
    res.status(code).json({ error: e.message, code: e.code });
  }
});

module.exports = router;
