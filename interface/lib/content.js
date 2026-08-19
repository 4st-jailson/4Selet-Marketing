// lib/content.js — leitura/escrita de tasks (conteudo) reusando os scripts
// oficiais do projeto como fonte unica de verdade do ciclo de vida.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { PATHS, contentTypeById, CONTENT_PILLARS } = require("./config");

const ZONES = [
  { dir: PATHS.OUTPUTS_DIR, zone: "active" },
  { dir: path.join(PATHS.OUTPUTS_DIR, "approved"), zone: "approved" },
  { dir: path.join(PATHS.OUTPUTS_DIR, "archive"), zone: "archive" },
];

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); } catch (e) { return null; }
}

// Escrita ATOMICA de JSON (tmp + rename no mesmo diretorio). Sem isto, um crash/restart no
// meio de um writeFileSync deixava o status.json truncado — e como readJsonSafe devolve null
// em JSON invalido, a peca SUMIA da biblioteca e toda mutacao passava a falhar em silencio.
// O rename e atomico no mesmo filesystem, entao o arquivo final nunca fica pela metade.
// (Mesmo padrao ja usado em campaigns.js / collections.js / publications.js.)
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, p);
}

// Escrita ATOMICA de arquivo comum (texto ou binario) — mesma ideia do writeJsonAtomic.
function writeFileAtomic(target, data, encoding) {
  const tmp = target + ".tmp";
  if (encoding) fs.writeFileSync(tmp, data, encoding);
  else fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, target);
}

// Roda um script de scripts/ (transicao de workflow) com cwd = raiz do projeto.
// ASSINCRONO: antes usava spawnSync, que BLOQUEIA o event loop — cada Aprovar/Rejeitar/
// Reabrir/Previa subia um processo Node sincrono e CONGELAVA o painel inteiro (health,
// biblioteca, geracao, outros usuarios) ate terminar. Agora roda via spawn e o painel segue
// respondendo. Fila LEVE e PROPRIA (_scriptChain): serializa as transicoes entre si (evita
// corrida no status.json da mesma peca) SEM ficar atras dos renders pesados do render.js.
// Retorna Promise<{ code, stdout, stderr, ok }>. Nunca rejeita.
let _scriptChain = Promise.resolve();
function runScript(scriptFile, argv) {
  const script = path.join(PATHS.SCRIPTS_DIR, scriptFile);
  const run = _scriptChain.then(() => new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [script, ...argv], { cwd: PATHS.PROJECT_ROOT });
    } catch (e) {
      return resolve({ code: -1, stdout: "", stderr: (e && e.message) || String(e), ok: false });
    }
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    let stdout = "", stderr = "";
    const MAX = 1024 * 1024 * 8; // teto de captura
    child.stdout.on("data", (d) => { if (stdout.length < MAX) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < MAX) stderr += d; });
    child.on("error", (err) => { stderr += (err && err.message) || String(err); });
    child.on("close", (code) => { invalidateTasksCache(); resolve({ code: code === null ? -1 : code, stdout: stdout.trim(), stderr: stderr.trim(), ok: code === 0 }); });
  }));
  _scriptChain = run.then(() => undefined, () => undefined); // a cadeia nunca quebra
  return run;
}

function isTaskDir(p) {
  return fs.existsSync(path.join(p, "status.json"));
}

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp"];
const VIDEO_EXT = [".mp4", ".mov", ".webm"];
function extOf(rel) { return path.extname(rel).toLowerCase(); }
function isImage(rel) { return IMAGE_EXT.includes(extOf(rel)); }
function isVideo(rel) { return VIDEO_EXT.includes(extOf(rel)); }

// Deduz o "kind" da peca a partir dos arquivos presentes (e do status).
// O status vem PRIMEIRO: uma peca "4Selet na Midia" (media_mention) grava a legenda no MESMO
// arquivo do feed (copy/instagram_caption.txt) e a arte fica em ads/*.png — sem esta ancora ela
// se classificava como feed/image e o "Gerar arte final" renderizava um feed no lugar do mockup
// de device. status.media (setMediaMeta) e a fonte de verdade do tipo Midia; status.content_type
// (quando gravado) e um hint de maxima prioridade que sobrevive a edicoes manuais.
function classifyKind(files, status) {
  if (status && status.content_type === "media_mention") return "media";
  if (status && status.media) return "media";
  // Story ancorado pelo content_type ANTES de qualquer inferencia por arquivo — e a licao que a peca
  // de Midia deixou: la o kind era adivinhado, a peca virava feed e o "Gerar arte final" redesenhava
  // como feed em vez do mockup. Aqui o tipo e declarado na criacao e nao se perde.
  if (status && status.content_type === "instagram_story") return "story";
  const rels = files.map((f) => (typeof f === "string" ? f : f.rel));
  const has = (re) => rels.some((r) => re.test(r));
  // Antes do ramo de carrossel e do de feed: os cartoes se chamam story_N.png de proposito, para
  // nao caírem no regex de slide_N, mas o arquivo de conteudo tambem ancora.
  if (has(/instagram_story\.json$/) || has(/story\/story_\d+\.(png|jpe?g)$/i)) return "story";
  if (rels.some(isVideo) || has(/video\/(scenes|concept)\.json$/)) return "video";
  const slidePngs = rels.filter((r) => /slide_\d+\.(png|jpe?g)$/i.test(r));
  if (slidePngs.length > 1 || has(/instagram_carousel\.json$/)) return "carousel";
  if (has(/linkedin_post\.txt$/)) return "linkedin";
  if (has(/threads_post\.txt$/)) return "threads";
  // Feed antes de image: o feed tem copy/instagram_caption.txt e renderiza em
  // ads/feed.png — sem esta checagem cairia no ramo generico de ads/*.png (image).
  if (has(/instagram_caption\.txt$/) || has(/ads\/feed\.(png|jpg|jpeg)$/)) return "feed";
  if (has(/ads\/.+\.(png|jpg|jpeg)$/) || has(/ads\/(concept|layout)\.json$/)) return "image";
  if (rels.some(isImage)) return "image";
  return "other";
}

// A MESMA arte pode existir em mais de um formato: o .jpg que a pessoa importou e o .png que a
// prancheta redesenhou ao salvar a edição. A varredura da pasta devolve em ordem alfabética, então
// "slide_1.jpg" vinha antes de "slide_1.png" e o cartão da biblioteca ficava congelado na arte
// ANTIGA depois de editar — quem olhava a biblioteca concluía que tinha perdido o trabalho.
// Mesma preferência que a galeria da peça e a publicação já aplicam: png > jpg > webp.
const ORDEM_ARTE = { png: 3, jpg: 2, jpeg: 2, webp: 1 };
function extDe(rel) { return (String(rel).match(/\.([^.]+)$/) || [, ""])[1].toLowerCase(); }
function melhorVersao(rel, rels) {
  const base = String(rel).replace(/\.[^.]+$/, "");
  let melhor = rel, nota = ORDEM_ARTE[extDe(rel)] || 0;
  for (const r of rels) {
    if (r === rel || String(r).replace(/\.[^.]+$/, "") !== base) continue;
    const n = ORDEM_ARTE[extDe(r)] || 0;
    if (n > nota) { nota = n; melhor = r; }
  }
  return melhor;
}
// Primeiro arquivo de imagem (thumbnail) ou video, para preview na biblioteca.
function pickThumb(files) {
  const rels = files.map((f) => (typeof f === "string" ? f : f.rel));
  // Ignora *.bg.png (camada de FUNDO do editor, sem o print/artigo — deixava a
  // miniatura da biblioteca branca nas peças de mídia). Prefere a arte final.
  const img = rels.find((r) => /slide_0*1\.(png|jpe?g)$/i.test(r)) || rels.find((r) => isImage(r) && !/\.bg\.png$/i.test(r));
  if (img) return { rel: melhorVersao(img, rels), type: "image" };
  const vid = rels.find(isVideo);
  if (vid) return { rel: vid, type: "video" };
  return null;
}

// Cache curto de listTasks (2s): a varredura recursiva do FS (readdir/stat por peça) roda em
// várias telas; sem cache, cada navegação repete tudo. O TTL curto elimina as chamadas
// repetidas sem servir dado velho de verdade — as transições (criar/aprovar/rejeitar via
// runScript) invalidam na hora; ajustes de metadado aparecem em ≤2s.
let _tasksCache = null, _tasksCacheAt = 0;
const TASKS_CACHE_MS = 2000;
function invalidateTasksCache() { _tasksCache = null; }

// Lista todas as tasks nas 3 zonas.
function listTasks() {
  if (_tasksCache && (Date.now() - _tasksCacheAt) < TASKS_CACHE_MS) return _tasksCache;
  const out = [];
  for (const z of ZONES) {
    if (!fs.existsSync(z.dir)) continue;
    for (const name of fs.readdirSync(z.dir)) {
      const full = path.join(z.dir, name);
      let stat;
      try { stat = fs.statSync(full); } catch (e) { continue; }
      if (!stat.isDirectory()) continue;
      if (!isTaskDir(full)) continue;
      const status = readJsonSafe(path.join(full, "status.json"));
      if (!status) continue;
      const files = listFiles(full).filter((f) => f.rel !== "status.json");
      out.push({
        folder: name,
        zone: z.zone,
        path: full,
        task_name: status.task_name,
        title: status.title || null,
        task_date: status.task_date,
        status: status.status,
        published_at: status.published_at || null, // p/ o selo "Publicado" (vs só "Aprovado")
        campaign_id: status.campaign_id || null,
        campaign_angle: status.campaign_angle || null,
        platforms: status.platforms || [],
        last_updated_at: status.last_updated_at,
        created_at: status.created_at || null, // p/ o marcador "Novo" (recem-criado) na biblioteca
        recency: files.reduce((m, f) => Math.max(m, f.mtime || 0), 0), // mtime mais novo = criado/ajustado por ultimo
        first_viewed_at: status.first_viewed_at || null,
        tags: Array.isArray(status.tags) ? status.tags : [],
        pillar: (typeof status.pillar === "string") ? status.pillar : null,
        imported: !!status.imported,
        // De onde a peça veio, quando não nasceu aqui (hoje: o sistema squad). A lista precisa
        // disso para mostrar a etiqueta — sem sair na lista, a marca de origem seria invisível.
        origem: status.origem || null,
        kind: classifyKind(files, status),
        thumb: pickThumb(files),
      });
    }
  }
  // Mais recente no topo: pela atividade real (mtime dos arquivos), com last_updated_at de desempate.
  out.sort((a, b) => (b.recency || 0) - (a.recency || 0) || String(b.last_updated_at || "").localeCompare(String(a.last_updated_at || "")));
  _tasksCache = out; _tasksCacheAt = Date.now();
  return out;
}

function findTask(folder) {
  for (const z of ZONES) {
    const full = path.join(z.dir, folder);
    // Contenção de zona: 'folder' vem da URL; garante que o join não escapou da zona
    // (ex.: '../..'). Centraliza o guard p/ todos os callers (write/read/media).
    if (full !== z.dir && !full.startsWith(z.dir + path.sep)) continue;
    if (fs.existsSync(path.join(full, "status.json"))) {
      return { path: full, zone: z.zone };
    }
  }
  return null;
}

// Lista arquivos (recursivo raso) de uma task para exibir no detalhe.
function listFiles(dir, base) {
  base = base || dir;
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...listFiles(full, base));
    } else {
      out.push({ rel: path.relative(base, full).split(path.sep).join("/"), size: stat.size, mtime: Math.round(stat.mtimeMs) });
    }
  }
  return out;
}

function getTask(folder) {
  const loc = findTask(folder);
  if (!loc) return null;
  const status = readJsonSafe(path.join(loc.path, "status.json"));
  const files = listFiles(loc.path).filter((f) => f.rel !== "status.json");
  // Anota cada arquivo com flags de midia para o front decidir preview.
  const annotated = files.map((f) => ({
    rel: f.rel,
    size: f.size,
    mtime: f.mtime, // versao p/ cache-bust das imagens no front (muda a cada re-render)
    isImage: isImage(f.rel),
    isVideo: isVideo(f.rel),
  }));
  return {
    folder,
    zone: loc.zone,
    path: loc.path,
    status,
    files: annotated,
    tags: Array.isArray(status && status.tags) ? status.tags : [],
    kind: classifyKind(files, status),
    thumb: pickThumb(files),
    template: (function () {
      const rp = readJsonSafe(path.join(loc.path, "render.json"));
      return (rp && typeof rp.template === "string") ? rp.template : null;
    })(),
    // O conceito da peça de imagem, para a TELA saber de que dado ela dispõe. Sem isto o
    // seletor de estilo não tem como avisar que "Comparação" precisa de dois lados — ele
    // deixaria escolher e o motor cairia no editorial, sem explicação.
    concept: (function () { return readJsonSafe(path.join(loc.path, "ads", "concept.json")) || null; })(),
    logo: (function () { const rp = readJsonSafe(path.join(loc.path, "render.json")); return (rp && typeof rp.logo === "string") ? rp.logo : null; })(),
    watermark: (function () { const rp = readJsonSafe(path.join(loc.path, "render.json")); return (rp && typeof rp.watermark === "string") ? rp.watermark : null; })(),
    font: (function () { const rp = readJsonSafe(path.join(loc.path, "render.json")); return (rp && typeof rp.font === "string") ? rp.font : null; })(),
    // A superfície escolhida na peça. Sem expor, o painel de ajustes abria sempre em "Padrão" e
    // dizia à pessoa que a peça era azul quando ela estava em papel — o campo contradizendo a arte.
    fundo: (function () { const rp = readJsonSafe(path.join(loc.path, "render.json")); return (rp && typeof rp.fundo === "string") ? rp.fundo : null; })(),
    pillar: (status && typeof status.pillar === "string") ? status.pillar : null,
  };
}

function readFile(folder, rel) {
  const loc = findTask(folder);
  if (!loc) return null;
  // proteger contra path traversal
  const target = path.normalize(path.join(loc.path, rel));
  if (target !== loc.path && !target.startsWith(loc.path + path.sep)) return null;
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target, "utf8");
}

// Resolve um arquivo da task para servir binario (preview/download).
// Retorna { abs, name } ou null (com guarda de path traversal).
function resolveFile(folder, rel) {
  const loc = findTask(folder);
  if (!loc) return null;
  const target = path.normalize(path.join(loc.path, rel));
  if (target !== loc.path && !target.startsWith(loc.path + path.sep)) return null;
  let stat;
  try { stat = fs.statSync(target); } catch (e) { return null; }
  if (!stat.isFile()) return null;
  return { abs: target, name: path.basename(target) };
}

// Cria a task via orchestrator.js oficial.
function createTask({ task_name, task_date, platforms, angle }) {
  const argv = ["--task", task_name, "--date", task_date];
  if (platforms && platforms.length) argv.push("--platforms", platforms.join(","));
  if (angle) argv.push("--angle", angle);
  return runScript("orchestrator.js", argv);
}

// --- Historico de versoes (desfazer/restaurar ajustes) ---------------------
// Guarda copias do conteudo ANTES de cada sobrescrita, FORA da pasta da task
// (outputs/.history/, ignorado no git) — assim NAO interfere em listagem,
// aprovacao ou content_hashes. Rede de seguranca: falha aqui e nao-critica.
const HISTORY_ROOT = path.join(PATHS.OUTPUTS_DIR, ".history");
const HISTORY_MAX = 25;
function historyDir(folder) { return path.join(HISTORY_ROOT, String(folder).replace(/[^a-zA-Z0-9._-]/g, "_")); }
function readHistoryIndex(folder) { const idx = readJsonSafe(path.join(historyDir(folder), "index.json")); return Array.isArray(idx) ? idx : []; }
function writeHistoryIndex(folder, list) {
  const dir = historyDir(folder); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(list, null, 2) + "\n", "utf8");
}
function snapshotContentFile(loc, folder, rel, note) {
  const src = path.join(loc.path, rel);
  if (!fs.existsSync(src)) return null; // 1a gravacao: nada anterior p/ guardar
  const content = fs.readFileSync(src, "utf8");
  const dir = historyDir(folder); fs.mkdirSync(dir, { recursive: true });
  const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 6);
  fs.writeFileSync(path.join(dir, id + ".snap"), content, "utf8");
  let list = readHistoryIndex(folder);
  list.unshift({ id, rel, ts: new Date().toISOString(), note: String(note || "").slice(0, 200), size: Buffer.byteLength(content) });
  if (list.length > HISTORY_MAX) { // poda: mantem os mais recentes
    for (const d of list.slice(HISTORY_MAX)) { try { fs.unlinkSync(path.join(dir, d.id + ".snap")); } catch (e) {} }
    list = list.slice(0, HISTORY_MAX);
  }
  writeHistoryIndex(folder, list);
  return id;
}
function listContentVersions(folder, rel) { return readHistoryIndex(folder).filter((e) => !rel || e.rel === rel); }
function restoreContentVersion(folder, rel, id) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  const snap = path.join(historyDir(folder), String(id) + ".snap");
  if (!fs.existsSync(snap)) { const e = new Error("versão não encontrada no histórico"); e.code = "E_VERSION_NOT_FOUND"; throw e; }
  const content = fs.readFileSync(snap, "utf8");
  // writeContentFile ja tira snapshot do estado ATUAL antes de sobrescrever (da p/ desfazer a restauracao).
  return writeContentFile(folder, rel, content, "restauração de versão");
}

// Escreve um arquivo de conteudo gerado dentro da task (apenas zona active).
// Respeita a regra CRITICAL: nunca escrever em outputs/approved/.
function writeContentFile(folder, rel, content, note) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone !== "active") {
    const e = new Error("task esta em '" + loc.zone + "' — para editar, rode rework (promote --to in_review) primeiro");
    e.code = "E_NOT_EDITABLE"; throw e;
  }
  const target = path.normalize(path.join(loc.path, rel));
  if (target !== loc.path && !target.startsWith(loc.path + path.sep)) { const e = new Error("path invalido"); e.code = "E_BAD_PATH"; throw e; }
  // Rede de seguranca p/ "desfazer": snapshot do estado ATUAL antes de sobrescrever. Nao-critico.
  try { snapshotContentFile(loc, folder, rel, note); } catch (e) { console.warn("[history] snapshot falhou:", e && e.message); }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeFileAtomic(target, content, "utf8");
  invalidateTasksCache();
  return path.relative(loc.path, target).split(path.sep).join("/");
}

// Escreve um arquivo BINARIO (imagem importada) dentro da task, só na zona active.
// Mesmo guard de caminho do writeContentFile; sem snapshot de historico (binario não
// entra no "desfazer" de texto) e sem encoding utf8.
function writeMediaFile(folder, rel, buffer) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone !== "active") { const e = new Error("task esta em '" + loc.zone + "' — só a zona active aceita mídia"); e.code = "E_NOT_EDITABLE"; throw e; }
  const target = path.normalize(path.join(loc.path, rel));
  if (target !== loc.path && !target.startsWith(loc.path + path.sep)) { const e = new Error("path invalido"); e.code = "E_BAD_PATH"; throw e; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeFileAtomic(target, buffer);
  invalidateTasksCache();
  return path.relative(loc.path, target).split(path.sep).join("/");
}

// Junta as ARTES (png/jpg/webp/mp4) de uma peca para baixar em .zip. Ignora HTML/JSON/logs.
// Ordena os slides do carrossel numericamente (slide_1, slide_2, ...), depois o resto por nome.
function collectMediaForZip(folder) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  const out = [];
  const walk = (rel) => {
    const abs = path.join(loc.path, rel || ".");
    let st; try { st = fs.statSync(abs); } catch (e) { return; }
    if (st.isDirectory()) {
      if (/(^|\/)(logs|\.history)$/i.test(rel)) return; // nao zipa logs/historico
      for (const c of fs.readdirSync(abs)) walk(rel ? rel + "/" + c : c);
      return;
    }
    if (/\.(png|jpe?g|webp|mp4)$/i.test(rel) && !/\.bg\.png$/i.test(rel)) out.push({ name: rel, buffer: fs.readFileSync(abs), mtime: st.mtime });
  };
  walk("");
  out.sort((a, b) => {
    const na = (a.name.match(/slide_0*(\d+)\./i) || [])[1];
    const nb = (b.name.match(/slide_0*(\d+)\./i) || [])[1];
    if (na && nb) return parseInt(na, 10) - parseInt(nb, 10);
    if (na) return -1;
    if (nb) return 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

// Grava campaign_id no status.json (link bidirecional com a campanha).
function setCampaignId(folder, campaignId) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.campaign_id = campaignId;
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

// Grava um titulo de exibicao (humanizado) no status.json, separado do slug tecnico.
function setTitle(folder, title) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.title = String(title || "").slice(0, 120);
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

// #8 — Grava a variante de template visual escolhida (render.json) como default
// da arte, SEM renderizar. So vale para pecas estaticas (image/feed/carousel).
const VALID_TEMPLATES = ["editorial", "bold", "split", "photo"];
function setTemplate(folder, template) {
  if (!VALID_TEMPLATES.includes(String(template))) return false;
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "render.json");
  const cur = readJsonSafe(p) || {};
  cur.template = String(template);
  writeJsonAtomic(p, cur);
  invalidateTasksCache();
  return true;
}
// Grava a variante de LOGO e o estilo de MARCA D'ÁGUA por peça no mesmo render.json (MERGE —
// não apaga o template). "" ou inválido = não mexe naquele campo (mantém o que estava).
const VALID_LOGOS = ["light", "dark", "symbol"];
const VALID_WATERMARKS = ["word", "symbol", "outline", "none", "canto", "padrao"];
// Tipografia da peça — ESPELHO de FAMILIAS em lib/render.js. Lista fechada: o id vira URL do Google
// Fonts e vira CSS lá dentro, então família livre seria injeção.
const VALID_FONTS = ["playfair", "dmserif", "montserrat", "poppins", "oswald", "bebas", "spacegrotesk"];
// A SUPERFÍCIE da peça (fundo). Mesma família de logo/marca d'água: escolha de arte que precisa
// sobreviver ao "Gerar arte final". "padrao" é o azul da marca e também o valor de volta.
const VALID_FUNDOS = ["padrao", "grade", "solido", "papel", "vinheta"];
function setRenderPref(folder, patch) {
  const loc = findTask(folder);
  if (!loc || !patch) return false;
  const p = path.join(loc.path, "render.json");
  const cur = readJsonSafe(p) || {};
  if (patch.logo === "auto") delete cur.logo; // "auto" = voltar ao padrão do estilo
  else if (VALID_LOGOS.includes(String(patch.logo))) cur.logo = String(patch.logo);
  if (patch.watermark === "auto") delete cur.watermark;
  else if (VALID_WATERMARKS.includes(String(patch.watermark))) cur.watermark = String(patch.watermark);
  if (patch.font === "auto" || patch.font === "") delete cur.font;
  else if (VALID_FONTS.includes(String(patch.font))) cur.font = String(patch.font);
  // Foto da peça. Necessário porque o arquivo do FEED é um .txt e não guarda campo nenhum — sem
  // isto a foto escolhida na criação aparecia na prévia e sumia ao salvar. Só aceita caminho do
  // acervo servido pelo painel: nada de URL externa (o editor re-renderiza com a rede bloqueada) e
  // nada de subir a árvore de diretórios.
  if (patch.fundo === "auto" || patch.fundo === "") delete cur.fundo;
  else if (VALID_FUNDOS.includes(String(patch.fundo))) cur.fundo = String(patch.fundo);
  if (patch.image === "auto" || patch.image === "") delete cur.image;
  else if (typeof patch.image === "string" && /^\/(uploads|assets)\/[\w./-]+$/.test(patch.image) && patch.image.indexOf("..") < 0) {
    cur.image = patch.image;
  }
  // Manchete e apoio ESCRITOS PARA A ARTE do feed. Mesmo motivo do `fundo` acima: o arquivo do
  // feed é um .txt e não guarda campo nenhum, então sem isto os dois campos que a IA escreve
  // pensando na imagem morrem no caminho e o desenho volta a recortar a legenda no caractere 60 —
  // que era o defeito da frase inacabada na peça publicável. Tetos iguais aos do render.
  if (patch.dados === "auto" || patch.dados === "") delete cur.dados;
  else if (patch.dados && typeof patch.dados === "object") {
    const d = {};
    if (typeof patch.dados.headline === "string" && patch.dados.headline.trim()) d.headline = patch.dados.headline.trim().slice(0, 60);
    if (typeof patch.dados.subtext === "string" && patch.dados.subtext.trim()) d.subtext = patch.dados.subtext.trim().slice(0, 150);
    if (Object.keys(d).length) cur.dados = Object.assign({}, cur.dados, d);
  }
  writeJsonAtomic(p, cur);
  invalidateTasksCache();
  return true;
}

// Grava o pilar de conteudo (eixo tematico) no status.json. Validado contra a
// taxonomia fechada CONTENT_PILLARS; pilar invalido/ausente e ignorado.
function setPillar(folder, pillar) {
  const valid = CONTENT_PILLARS.some((p) => p.id === String(pillar));
  if (!valid) return false;
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.pillar = String(pillar);
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

// Metadados da peça "4Selet na Mídia": print da matéria + veículo + link + modelo do device.
// Gravados em status.media; o renderMedia (render.js) lê daqui pra montar a arte (4:5 + 16:9).
function setMediaMeta(folder, meta) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  const models = ["hand_tablet", "celular", "navegador", "citacao", "split", "selo", "camadas", "foto_real", "foto_mesa", "foto_maos_mesa", "tablet", "notebook", "janela"];
  const validSizes = ["4x5", "1x1", "9x16", "16x9"];
  let sizes = (Array.isArray(meta && meta.sizes) ? meta.sizes : []).filter((s) => validSizes.indexOf(s) !== -1);
  if (!sizes.length) sizes = ["4x5", "16x9"];
  status.media = {
    print: String((meta && meta.print) || "").slice(0, 400),
    url: String((meta && meta.url) || "").slice(0, 400),
    vehicle: String((meta && meta.vehicle) || "").slice(0, 120),
    headline: String((meta && meta.headline) || "").slice(0, 240),
    model: models.indexOf(String(meta && meta.model)) !== -1 ? String(meta.model) : "hand_tablet",
    sizes: sizes,
  };
  // Ancora o tipo no status: hint de maxima prioridade p/ o classifyKind (sobrevive a edicoes
  // que porventura removam status.media) — a peca Midia nunca mais se classifica como feed/image.
  status.content_type = "media_mention";
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

// Marca a peça como PUBLICADA de verdade no Instagram (metadado; NÃO entra nos content_hashes,
// então não fere o gate R5). Grava published_at/published_by/last_post_id no status.json.
function setPublished(folder, meta) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.published_at = (meta && meta.at) || new Date().toISOString(); // `at` = data informada (marcação manual de publicação antiga); senão agora
  if (meta && meta.by) status.published_by = String(meta.by).slice(0, 120);
  if (meta && meta.post_id) status.last_post_id = String(meta.post_id).slice(0, 120);
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

// TIRA a marca de publicada. Usado quando o post é apagado do Instagram (pelo painel ou pelo
// celular): sem isto o botão de publicar segue apagado dizendo "já publicado" para um post que
// não existe mais, e a peça fica travada para sempre. Guarda o rastro em `previous_publication`
// — mesmo campo que a reabertura da peça usa — para o histórico não sumir sem deixar registro.
function clearPublished(folder, motivo) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status || !status.published_at) return false;
  status.previous_publication = {
    published_at: status.published_at,
    published_by: status.published_by || null,
    last_post_id: status.last_post_id || null,
    cleared_at: new Date().toISOString(),
    motivo: motivo || null,
  };
  delete status.published_at; delete status.published_by; delete status.last_post_id;
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

// Marca a peça como IMPORTADA (imagens prontas trazidas de fora). O front usa a flag
// para NÃO oferecer re-render/editor de arte (não há HTML/JSON de origem), só legenda.
// De onde a peça veio, quando ela não nasceu aqui dentro (hoje: o sistema squad.4st.co).
// Mora no status.json de propósito: é o ÚNICO arquivo da peça que fica de fora do cálculo
// dos content_hashes. Qualquer arquivo novo dentro da pasta de uma peça aprovada derruba a
// publicação com E_HASH_MISMATCH — então rastro de origem não pode virar arquivo separado.
function setOrigem(folder, origem) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.origem = origem || null;
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}
function getOrigem(folder) {
  const loc = findTask(folder);
  if (!loc) return null;
  const status = readJsonSafe(path.join(loc.path, "status.json"));
  return (status && status.origem) || null;
}

function setImported(folder) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return false;
  status.imported = true;
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

// #5 — Normaliza tags: trim, minusculas, sem vazios/duplicatas, limite de 12.
function normalizeTags(tags) {
  const arr = Array.isArray(tags) ? tags : String(tags || "").split(",");
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const t = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 32);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

// #5 — Grava tags (rotulos livres) no status.json. Funciona em qualquer zona
// (apenas metadado, nao altera conteudo aprovado). Retorna a lista normalizada.
function setTags(folder, tags) {
  const loc = findTask(folder);
  if (!loc) return null;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status) return null;
  const norm = normalizeTags(tags);
  status.tags = norm;
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return norm;
}

// #4 — Marca a primeira visualizacao da peca (carimba first_viewed_at uma unica
// vez). Idempotente: so escreve se ainda nao houver carimbo. Funciona em qualquer
// zona (apenas grava metadado, nao altera conteudo aprovado).
function markViewed(folder) {
  const loc = findTask(folder);
  if (!loc) return false;
  const p = path.join(loc.path, "status.json");
  const status = readJsonSafe(p);
  if (!status || status.first_viewed_at) return false;
  status.first_viewed_at = new Date().toISOString();
  // SINCRONO de proposito. Antes era fire-and-forget (fs.writeFile assincrono) a partir de uma
  // copia lida ANTES: se outra escrita (setTags, setPublished, promote) acontecesse no meio, a
  // gravacao atrasada aterrissava por ultimo e RESTAURAVA o status.json antigo — tags e marcas
  // de publicado "sumiam" sem explicacao. Como o Node e single-thread, ler+gravar no mesmo tick
  // nao intercala com outra requisicao. O custo e um write pequeno no GET de abrir a peca.
  writeJsonAtomic(p, status);
  invalidateTasksCache();
  return true;
}

function generatePreview(task_name, task_date) {
  return runScript("generate_preview.js", ["--task", task_name, "--date", task_date]);
}

function promote(task_name, task_date, to, by, reason) {
  const argv = ["--task", task_name, "--date", task_date, "--to", to];
  if (by) argv.push("--by", by);
  if (reason) argv.push("--reason", reason);
  return runScript("promote_task.js", argv);
}

// Move uma pasta de forma robusta entre ZONAS. Em produção (Docker), outputs/ é um volume
// nomeado mas outputs/approved e outputs/archive são bind-mounts (dispositivos DIFERENTES),
// então fs.renameSync cruza filesystem e falha com EXDEV. Fallback: copia + apaga. (Mesmo
// padrão de scripts/promote_task.js:moveDirRobust.)
function moveDirRobust(src, dst) {
  const tryRename = () => { fs.renameSync(src, dst); };
  try { tryRename(); return; } catch (e) {
    if (e.code === "EBUSY" || e.code === "EPERM") { // lock de FS (Windows) → retry curto
      const wait = Date.now() + 200; while (Date.now() < wait) { /* busy-wait curto */ }
      tryRename(); return;
    }
    if (e.code === "EXDEV") { // cross-device (bind-mount vs volume) → copia + apaga
      // Copia para um destino PROVISORIO e so entao renomeia para o nome final. Sem isso, um
      // crash no meio do cpSync deixava a peca pela metade JA no nome definitivo (a zona de
      // destino listava uma peca incompleta) ou duplicada nas duas zonas. Com o .part, o nome
      // final so passa a existir quando a copia terminou — e o rename e no mesmo device.
      const part = dst + ".part";
      fs.rmSync(part, { recursive: true, force: true }); // sobra de tentativa anterior
      fs.cpSync(src, part, { recursive: true });
      fs.renameSync(part, dst);
      fs.rmSync(src, { recursive: true, force: true });
      return;
    }
    throw e;
  }
}

// Descarta uma task movendo-a (reversivel) para outputs/_archived/.
// Nunca remove fisicamente. Recusa tasks ja aprovadas (zona approved).
function discardTask(folder) {
  const loc = findTask(folder);
  if (!loc) { const e = new Error("task nao encontrada: " + folder); e.code = "E_TASK_NOT_FOUND"; throw e; }
  if (loc.zone === "approved") {
    const e = new Error("task aprovada nao pode ser descartada — rode rework antes");
    e.code = "E_NOT_DISCARDABLE"; throw e;
  }
  const archivedRoot = path.join(PATHS.OUTPUTS_DIR, "_archived");
  fs.mkdirSync(archivedRoot, { recursive: true });
  let dest = path.join(archivedRoot, folder);
  if (fs.existsSync(dest)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    dest = path.join(archivedRoot, folder + "__" + stamp);
  }
  moveDirRobust(loc.path, dest);
  invalidateTasksCache(); // senao a peca descartada ainda aparecia na lista por ate 2s
  return { from: loc.path, to: dest };
}

module.exports = {
  listTasks, getTask, findTask, readFile, resolveFile, createTask, writeContentFile, writeMediaFile,
  listContentVersions, restoreContentVersion, collectMediaForZip,
  setCampaignId, setTitle, setTemplate, setRenderPref, setPillar, setMediaMeta, setPublished, clearPublished, setImported, setOrigem, getOrigem, markViewed, setTags, generatePreview, promote, discardTask,
};
