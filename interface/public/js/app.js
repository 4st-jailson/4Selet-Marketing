// public/js/app.js — SPA do Painel 4Selet (reconstruído do zero).
// Vanilla JS, hash-router, sem build. Contrato de API inalterado (ver api.js).
"use strict";

const State = { meta: null, settings: null, campMap: null };

/* ============================ helpers ============================ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function slugify(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50); }
function todayISO() { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }

function toast(msg, type) {
  const t = document.createElement("div");
  t.className = "toast " + (type || "");
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, 4200);
}

// Mostra um erro de chamada de IA de forma clara. 429 (rate limit) vira aviso
// ambar com instrucao de re-tentar; demais erros viram toast de erro.
function toastAiError(e) {
  if (e && e.status === 429) {
    toast(e.message || "Limite de requisições da API atingido. Aguarde alguns segundos e tente de novo.", "warn");
  } else if (e && e.status === 401) {
    toast(e.message || "Chave da API inválida — verifique em Configurações.", "error");
  } else {
    toast((e && e.message) || "Erro ao chamar a IA.", "error");
  }
}

function setView(html) { $("#view").innerHTML = html; }
function setTitle(t) { $("#page-title").textContent = t; document.title = t + " · Painel 4Selet"; }
function metaType(id) { return (State.meta.content_types || []).find((c) => c.id === id); }
function kindLabel(k) { return (State.meta.kind_labels && State.meta.kind_labels[k]) || k || "Outros"; }
function pillarLabel(id) { const p = (State.meta.content_pillars || []).find((x) => x.id === id); return p ? (p.short || p.label) : null; }
function mediaLabel(m) { return m === "video" ? "vídeo" : (m === "image" ? "imagem" : "texto"); }
function isMediaKind(k) { return k === "image" || k === "feed" || k === "carousel" || k === "video"; }
function tag(text) { return '<span class="badge plain">' + esc(text) + "</span>"; }
function plural(n, sing, plur) { return n + " " + (n === 1 ? sing : plur); }
function platformLabel(p) { const m = { x: "Threads/X", threads: "Threads/X", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", whatsapp: "WhatsApp", email: "E-mail" }; return m[String(p || "").toLowerCase()] || p; }

/* ---- rótulos PT (status, zona) ---- */
const STATUS_LABELS = { draft: "Rascunho", in_review: "Em revisão", approved: "Aprovado", rejected: "Rejeitado", active: "Ativa", paused: "Pausada", done: "Concluída" };
const ZONE_LABELS = { active: "Em produção", approved: "Aprovado", archive: "Arquivado", archived: "Arquivado", rejected: "Rejeitado" };
function statusLabel(s) { return STATUS_LABELS[s] || s || "—"; }
function statusBadge(s) { return '<span class="badge ' + esc(s) + '">' + esc(statusLabel(s)) + "</span>"; }
function zoneLabel(z) { return ZONE_LABELS[z] || z || ""; }

/* ---- nome de exibição humanizado (esconde o slug técnico) ---- */
function humanize(s) {
  s = String(s == null ? "" : s).replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function displayName(t) {
  if (!t) return "—";
  const explicit = t.title || (t.status && t.status.title);
  if (explicit) return String(explicit);
  return humanize(t.task_name || (t.status && t.status.task_name) || "");
}

/* ---- nome amigável de arquivo + tamanho legível (esconde o slug técnico) ---- */
function fileLabel(rel) {
  const base = String(rel == null ? "" : rel).split("/").pop();
  const lower = base.toLowerCase();
  const slide = lower.match(/^slide_0*(\d+)\.png$/);
  if (slide) return "Slide " + slide[1];
  const named = { "render.json": "Instruções de geração", "status.json": "Dados da peça (interno)" };
  if (named[lower]) return named[lower];
  if (/\.html?$/.test(lower)) return "Prévia (HTML)";
  if (/\.(mp4|mov|webm)$/.test(lower)) return "Vídeo";
  if (/\.(png|jpe?g|webp|gif)$/.test(lower)) return "Imagem";
  if (/\.(txt|md)$/.test(lower)) return "Texto / legenda";
  if (/\.json$/.test(lower)) return "Dados (JSON)";
  return base;
}
function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

/* ---- nome legível da campanha (resolve id técnico → nome cadastrado) ---- */
function setCampMap(list) { State.campMap = {}; (list || []).forEach((c) => { State.campMap[c.id] = c.name; }); }
function campLabel(id) { if (!id) return ""; const m = State.campMap || {}; return m[id] || humanize(id); }
async function ensureCampMap() {
  if (State.campMap) return;
  try { const { campaigns } = await API.campaigns(); setCampMap(campaigns); }
  catch (e) { State.campMap = State.campMap || {}; }
}

/* ---- datas legíveis (pt-BR) ---- */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtDate(v) {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return parseInt(m[3], 10) + " " + MESES[parseInt(m[2], 10) - 1] + " " + m[1];
  const d = new Date(v); if (isNaN(d.getTime())) return String(v);
  return d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear();
}
function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v); if (isNaN(d.getTime())) return fmtDate(v);
  const p = (n) => String(n).padStart(2, "0");
  return d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear() + " às " + p(d.getHours()) + "h" + p(d.getMinutes());
}

/* ---- foco acessível em diálogos: prende o Tab dentro do diálogo e devolve o foco ao fechar ---- */
const FOCUSABLE_SEL = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
function focusablesIn(el) {
  return $$(FOCUSABLE_SEL, el).filter((n) => n.offsetParent !== null || n === document.activeElement);
}
function trapTabKey(container, e) {
  if (e.key !== "Tab" || !container) return;
  const els = focusablesIn(container);
  if (!els.length) return;
  const first = els[0], last = els[els.length - 1], active = document.activeElement;
  if (e.shiftKey && (active === first || !container.contains(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !container.contains(active))) { e.preventDefault(); first.focus(); }
}
function restoreFocus(el) { if (el && typeof el.focus === "function") { try { el.focus(); } catch (_) { /* elemento pode ter saído do DOM */ } } }

/* ---- Modal in-app (substitui prompt/confirm nativos) ---- */
function uiModal(opts) {
  opts = opts || {};
  const fields = opts.fields || [];
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-ov";
    const fieldHtml = fields.map((f, i) => {
      const ctrl = f.type === "textarea"
        ? `<textarea data-mf="${i}" rows="3" placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea>`
        : `<input data-mf="${i}" type="${esc(f.inputType || "text")}" placeholder="${esc(f.placeholder || "")}" value="${esc(f.value || "")}" />`;
      const sugg = (f.suggestions && f.suggestions.length)
        ? `<div class="sugg-row" data-msug="${i}">${f.suggestLabel ? '<span class="hint">' + esc(f.suggestLabel) + "</span>" : ""}${f.suggestions.map((s) => '<button type="button" class="sugg-chip" data-sugg="' + esc(s) + '">' + esc(s) + "</button>").join("")}</div>`
        : "";
      return `<div class="field"><label>${esc(f.label || "")}</label>${ctrl}${sugg}</div>`;
    }).join("");
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <h3>${esc(opts.title || "")}</h3>
      ${opts.message ? '<p class="muted mt">' + esc(opts.message) + "</p>" : ""}
      ${fieldHtml}
      <div class="modal-actions">
        <button class="btn btn-ghost" data-mx="cancel">${esc(opts.cancelText || "Cancelar")}</button>
        <button class="btn ${opts.confirmKind === "danger" ? "btn-danger" : "btn-primary"}" data-mx="ok">${esc(opts.confirmText || "Confirmar")}</button>
      </div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => ov.classList.add("open"));
    const opener = document.activeElement;
    const focusEl = ov.querySelector("[data-mf]") || ov.querySelector("[data-mx='ok']");
    if (focusEl) focusEl.focus();
    // chips de sugestão: clicar adiciona/remove no campo; digitar filtra as sugestões (typeahead)
    ov.querySelectorAll("[data-msug]").forEach((box) => {
      const inp = ov.querySelector('[data-mf="' + box.dataset.msug + '"]');
      const chips = Array.prototype.slice.call(box.querySelectorAll(".sugg-chip"));
      const refresh = (useFrag) => {
        const parts = inp.value.split(",");
        const frag = useFrag ? (parts[parts.length - 1] || "").trim().toLowerCase() : "";
        const sel = inp.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        chips.forEach((chip) => {
          const t = chip.dataset.sugg.toLowerCase();
          chip.classList.toggle("on", sel.indexOf(t) !== -1);
          chip.style.display = (!frag || t.indexOf(frag) !== -1) ? "" : "none";
        });
      };
      chips.forEach((chip) => {
        chip.onclick = () => {
          const parts = inp.value.split(",").map((s) => s.trim()).filter(Boolean);
          const idx = parts.findIndex((p) => p.toLowerCase() === chip.dataset.sugg.toLowerCase());
          if (idx === -1) parts.push(chip.dataset.sugg); else parts.splice(idx, 1);
          inp.value = parts.join(", ");
          refresh(false); inp.focus();
        };
      });
      inp.addEventListener("input", () => refresh(true));
      refresh(false);
    });
    const collect = () => { const o = {}; fields.forEach((f, i) => { o[f.name || i] = ov.querySelector('[data-mf="' + i + '"]').value.trim(); }); return o; };
    const done = (val) => {
      ov.classList.remove("open"); document.body.classList.remove("no-scroll");
      document.removeEventListener("keydown", onKey); setTimeout(() => ov.remove(), 160); restoreFocus(opener); resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); done(null); }
      else if (e.key === "Enter" && !fields.some((f) => f.type === "textarea")) { e.preventDefault(); done(fields.length ? collect() : true); }
      else if (e.key === "Tab") trapTabKey(ov, e);
    };
    ov.querySelector("[data-mx='ok']").onclick = () => done(fields.length ? collect() : true);
    ov.querySelector("[data-mx='cancel']").onclick = () => done(null);
    ov.addEventListener("click", (e) => { if (e.target === ov) done(null); });
    document.addEventListener("keydown", onKey);
  });
}
function uiConfirm(message, opts) {
  return uiModal(Object.assign({ title: "Confirmar", message: message, confirmText: "Confirmar" }, opts || {})).then((v) => !!v);
}
window.uiModal = uiModal; window.uiConfirm = uiConfirm;

/* ============================ router ============================ */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "") || "dashboard";
  const [pathPart, queryPart] = raw.split("?");
  const segs = pathPart.split("/");
  const query = {};
  if (queryPart) queryPart.split("&").forEach((kv) => { const [k, v] = kv.split("="); query[k] = decodeURIComponent(v || ""); });
  return { route: segs[0], arg: segs[1] ? decodeURIComponent(segs[1]) : null, query };
}

const Routes = {
  dashboard: viewDashboard,
  campaigns: viewCampaigns,
  campaign: viewCampaignDetail,
  content: viewContent,
  approved: viewApproved,
  task: viewTaskDetail,
  create: viewCreate,
  settings: viewSettings,
};

// Skeleton de carregamento com o formato do destino — load parece intencional,
// não um "piscar". Substituído pela view real assim que os dados chegam.
function skeletonFor(route) {
  const card = (rows) => `<div class="card"><div class="skel skel-h"></div>${Array.from({ length: rows || 3 }).map((_, i) => `<div class="skel skel-line" style="width:${85 - i * 11}%"></div>`).join("")}</div>`;
  const stat = () => `<div class="card sk-stat"><div class="skel skel-dot"></div><div class="sk-stat-body"><div class="skel skel-num"></div><div class="skel skel-line" style="width:72%"></div></div></div>`;
  const row = () => `<div class="sk-row"><div class="skel skel-dot"></div><div class="sk-row-body"><div class="skel skel-line" style="width:55%"></div><div class="skel skel-line" style="width:34%"></div></div></div>`;
  const head = (w) => `<div class="section-head"><div class="skel skel-h" style="width:${w || 170}px;margin-bottom:0"></div></div>`;
  if (route === "dashboard") return `<div class="stat-grid mb">${stat() + stat() + stat() + stat()}</div><div class="grid grid-2">${card(5)}${card(3)}</div>`;
  if (route === "campaigns" || route === "approved") return `${head()}<div class="grid grid-3">${card(3) + card(3) + card(3)}</div>`;
  if (route === "content") return `${head(150)}<div class="card">${Array.from({ length: 6 }).map(row).join("")}</div>`;
  if (route === "create") return `<div class="grid grid-2">${card(6)}${card(2)}</div>`;
  return `<div class="grid grid-2">${card(4)}${card(4)}</div>`;
}

let NAV_COUNT = 0;
// "Voltar": volta para a página anterior de fato (de onde o usuário veio). Se a peça
// foi aberta por link direto (sem histórico no painel), usa o fallback por zona.
function goBack(fallback) {
  if (NAV_COUNT > 1) history.back();
  else location.hash = fallback || "#/content";
}
window.goBack = goBack;
async function router() {
  NAV_COUNT++;
  const { route, arg, query } = parseHash();
  // Botão "voltar" na topbar: aparece em telas de detalhe (peça/campanha).
  const backBtn = $("#btn-back");
  if (backBtn) {
    backBtn.hidden = !(arg && (route === "task" || route === "campaign"));
    backBtn.dataset.fallback = route === "campaign" ? "#/campaigns" : "#/content";
  }
  $$("#nav a").forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  closeSidebar();
  const fn = Routes[route] || viewDashboard;
  setView(skeletonFor(route));
  try { await fn(arg, query); window.scrollTo({ top: 0 }); }
  catch (e) { setView('<div class="empty">Erro ao carregar: ' + esc(e.message) + "</div>"); toast(e.message, "error"); }
}

/* ---- status da IA (sidebar) ---- */
async function refreshKeyStatus() {
  try {
    State.settings = await API.settings();
    const el = $("#key-status");
    if (State.settings.has_key) { el.className = "key-status ok"; el.innerHTML = '<a href="#/settings" title="Modelo: ' + esc(State.settings.model || "") + '">IA conectada</a>'; }
    else { el.className = "key-status off"; el.innerHTML = '<a href="#/settings">IA não configurada</a>'; }
  } catch (e) { /* silencioso */ }
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
async function viewDashboard() {
  setTitle("Dashboard");
  const [{ campaigns }, { tasks }] = await Promise.all([API.campaigns(), API.content()]);
  setCampMap(campaigns);
  const active = campaigns.filter((c) => c.status === "active").length;
  const inReview = tasks.filter((t) => t.status === "in_review").length;
  const approved = tasks.filter((t) => t.status === "approved" || t.zone === "approved").length;
  const keyWarn = State.settings && !State.settings.has_key
    ? `<div class="card callout mb"><div class="flex-between"><div><h3>Configure a Inteligência Artificial</h3><p class="muted mt">Cole sua chave Anthropic para geração real. Sem chave, o painel funciona em modo simulado.</p></div><a class="btn btn-primary" href="#/settings">Configurar</a></div></div>` : "";
  setView(`
    ${keyWarn}
    <div class="stat-grid mb">
      <a class="card stat" data-accent="sky" href="#/campaigns" title="Ver campanhas"><span class="stat-ico">◈</span><div class="stat-body"><span class="num">${campaigns.length}</span><span class="lbl">Campanhas <em>${active} ativas</em></span></div></a>
      <a class="card stat" data-accent="blue" href="#/content" title="Ver todas as peças"><span class="stat-ico">▦</span><div class="stat-body"><span class="num">${tasks.length}</span><span class="lbl">Peças de conteúdo</span></div></a>
      <a class="card stat" data-accent="warn" href="#/content?status=in_review" title="Ver peças em revisão"><span class="stat-ico">◷</span><div class="stat-body"><span class="num">${inReview}</span><span class="lbl">Em revisão</span></div></a>
      <a class="card stat" data-accent="ok" href="#/approved" title="Ver peças aprovadas"><span class="stat-ico">✓</span><div class="stat-body"><span class="num">${approved}</span><span class="lbl">Aprovadas</span></div></a>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="section-head"><h2>Conteúdo recente</h2><a class="muted-link" href="#/content">ver tudo →</a></div>
        ${tasks.length ? '<div class="list">' + tasks.slice(0, 6).map(taskRow).join("") + "</div>" : '<div class="empty">Nenhuma peça ainda. <a href="#/create">Criar conteúdo</a></div>'}
      </div>
      <div class="card">
        <div class="section-head"><h2>Ações rápidas</h2></div>
        <div class="list">
          <a class="list-row action-row" href="#/create"><span class="lr-ico">＋</span><div class="lr-main"><div class="lr-title">Criar conteúdo com IA</div><div class="lr-meta">Caption, carrossel, anúncio ou vídeo no padrão da marca</div></div><span class="lr-go" aria-hidden="true">→</span></a>
          <a class="list-row action-row" href="#/campaigns"><span class="lr-ico">◈</span><div class="lr-main"><div class="lr-title">Nova campanha</div><div class="lr-meta">Defina ângulo, pilar e mensagens-chave</div></div><span class="lr-go" aria-hidden="true">→</span></a>
          <a class="list-row action-row" href="#/approved"><span class="lr-ico">✓</span><div class="lr-main"><div class="lr-title">Biblioteca de aprovados</div><div class="lr-meta">Peças aprovadas e prontas para publicar</div></div><span class="lr-go" aria-hidden="true">→</span></a>
        </div>
      </div>
    </div>`);
}

function taskRow(t) {
  return `<a class="list-row" href="#/task/${encodeURIComponent(t.folder)}">
    <span class="lr-ico" aria-hidden="true">${kindIcon(t.kind)}</span>
    <div class="lr-main"><div class="lr-title">${esc(displayName(t))}${!t.first_viewed_at ? ' <span class="lr-new">Novo</span>' : ""}</div>
    <div class="lr-meta">${esc(kindLabel(t.kind))} · ${esc(fmtDate(t.task_date))}${(t.pillar && pillarLabel(t.pillar)) ? ' · <span class="lr-pillar">' + esc(pillarLabel(t.pillar)) + "</span>" : ""}${(t.platforms || []).length ? " · " + esc(t.platforms.map(platformLabel).join(", ")) : ""}</div></div>
    ${statusBadge(t.status)}</a>`;
}

/* =====================================================================
   CAMPANHAS
   ===================================================================== */
async function viewCampaigns() {
  setTitle("Campanhas");
  const { campaigns } = await API.campaigns();
  setView(`
    <div class="section-head"><h2>Suas campanhas</h2><button class="btn btn-primary" id="new-camp">＋ Nova campanha</button></div>
    <div id="camp-form-wrap"></div>
    ${campaigns.length ? '<div class="grid grid-3">' + campaigns.map(campCard).join("") + "</div>" : '<div class="empty">Nenhuma campanha ainda. Crie a primeira para organizar suas peças.</div>'}`);
  $("#new-camp").onclick = () => { renderCampaignForm(); $("#camp-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" }); };
}

function campCard(c) {
  return `<a class="card card-link" href="#/campaign/${encodeURIComponent(c.id)}">
    <div class="flex-between"><h3>${esc(c.name)}</h3>${statusBadge(c.status)}</div>
    <p class="muted mt">${esc(c.objective || c.angle || "—")}</p>
    <div class="chips mt">${(c.platforms || []).map((p) => tag(platformLabel(p))).join("")}${c.pillar ? tag(c.pillar) : ""}</div>
    <div class="muted mt">${plural((c.content_ids || []).length, "peça vinculada", "peças vinculadas")}</div>
  </a>`;
}

function renderCampaignForm(existing) {
  const c = existing || {};
  const plats = State.meta.platforms.map((p) => checkPill("plat", p, (c.platforms || []).includes(p), platformLabel(p))).join("");
  const pillars = State.meta.pillars.map((p) => `<option ${c.pillar === p ? "selected" : ""}>${esc(p)}</option>`).join("");
  const wrap = $("#camp-form-wrap") || $("#view");
  wrap.innerHTML = `<div class="card mb">
    <h3>${existing ? "Editar campanha" : "Nova campanha"}</h3>
    <div class="field mt"><label>Nome <span class="hint">(mín. 3 caracteres)</span></label><input id="c-name" value="${esc(c.name || "")}" placeholder="ex.: Taxa Zero — 2º semestre" aria-describedby="e-name" /><div class="field-error" id="e-name" role="alert"></div></div>
    <div class="field"><label>Objetivo</label><textarea id="c-obj" rows="2" placeholder="O que esta campanha precisa alcançar?">${esc(c.objective || "")}</textarea></div>
    <div class="row">
      <div class="field"><label>Ângulo</label><input id="c-angle" value="${esc(c.angle || "")}" placeholder="ex.: 0% por 3 meses" /></div>
      <div class="field"><label>Pilar estratégico</label><select id="c-pillar"><option value="">—</option>${pillars}</select></div>
    </div>
    <div class="row">
      <div class="field"><label>Status</label><select id="c-status">
        ${["active", "paused", "done"].map((s) => `<option value="${s}" ${(c.status || "active") === s ? "selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}
      </select></div>
      <div class="field"><label>Período</label><div class="row"><input type="date" id="c-start" value="${esc(c.start_date || "")}" /><input type="date" id="c-end" value="${esc(c.end_date || "")}" /></div></div>
    </div>
    <div class="field"><label>Plataformas</label><div class="checks">${plats}</div></div>
    <div class="field"><label>Mensagens-chave <span class="hint">(uma por linha)</span></label><textarea id="c-msgs" rows="3">${esc((c.key_messages || []).join("\n"))}</textarea></div>
    <div class="field"><label>Notas</label><textarea id="c-notes" rows="2">${esc(c.notes || "")}</textarea></div>
    <div class="flex mt"><button class="btn btn-primary" id="c-save">${existing ? "Salvar alterações" : "Criar campanha"}</button><button class="btn btn-ghost" id="c-cancel">Cancelar</button></div>
  </div>`;
  bindCheckPills(wrap);
  $("#c-cancel").onclick = () => router();
  $("#c-save").onclick = async () => {
    const name = $("#c-name").value.trim();
    $("#e-name").textContent = ""; $("#c-name").removeAttribute("aria-invalid");
    if (name.length < 3) { $("#c-name").classList.add("invalid"); $("#c-name").setAttribute("aria-invalid", "true"); $("#e-name").textContent = "Nome obrigatório (mín. 3 caracteres)."; return; }
    const payload = {
      name, objective: $("#c-obj").value.trim(), angle: $("#c-angle").value.trim(),
      pillar: $("#c-pillar").value, status: $("#c-status").value,
      start_date: $("#c-start").value, end_date: $("#c-end").value,
      platforms: collectChecks(wrap, "plat"),
      key_messages: $("#c-msgs").value.split("\n").map((s) => s.trim()).filter(Boolean),
      notes: $("#c-notes").value.trim(),
    };
    try {
      if (existing) { await API.updateCampaign(existing.id, payload); toast("Campanha atualizada", "success"); location.hash = "#/campaign/" + existing.id; }
      else { const r = await API.createCampaign(payload); toast("Campanha criada", "success"); location.hash = "#/campaign/" + r.campaign.id; }
    } catch (e) {
      if (e.data && e.data.errors) e.data.errors.forEach((x) => toast(x, "error")); else toast(e.message, "error");
    }
  };
}

async function viewCampaignDetail(id) {
  const { campaign: c, tasks } = await API.campaign(id);
  State.campMap = Object.assign(State.campMap || {}, { [c.id]: c.name });
  setTitle(c.name);
  setView(`
    <div class="flex-between mb flex-wrap">
      <div class="flex flex-wrap">${statusBadge(c.status)}${c.pillar ? tag(c.pillar) : ""}${(c.platforms || []).map((p) => tag(platformLabel(p))).join("")}</div>
      <div class="flex"><button class="btn btn-sm" id="edit-camp">Editar</button><button class="btn btn-sm btn-primary" id="create-here">＋ Criar conteúdo</button><button class="btn btn-sm btn-danger" id="del-camp">Excluir</button></div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>Detalhes</h3>
        <div class="kv mt">
          <div class="k">Objetivo</div><div>${esc(c.objective || "—")}</div>
          <div class="k">Ângulo</div><div>${esc(c.angle || "—")}</div>
          <div class="k">Plataformas</div><div>${(c.platforms || []).map(platformLabel).join(", ") || "—"}</div>
          <div class="k">Período</div><div>${esc(c.start_date || "—")} ${c.end_date ? "→ " + esc(c.end_date) : ""}</div>
          <div class="k">Notas</div><div>${esc(c.notes || "—")}</div>
        </div>
        ${(c.key_messages || []).length ? '<hr class="sep" /><div class="k dim">Mensagens-chave</div><ul>' + c.key_messages.map((m) => "<li>" + esc(m) + "</li>").join("") + "</ul>" : ""}
      </div>
      <div class="card">
        <div class="section-head"><h2>Conteúdo (${tasks.length})</h2></div>
        ${tasks.length ? '<div class="list">' + tasks.map(taskRow).join("") + "</div>" : '<div class="empty">Sem peças ainda. <span class="muted-link" id="create-here2">Criar agora →</span></div>'}
      </div>
    </div>`);
  $("#edit-camp").onclick = () => { setView('<div id="camp-form-wrap"></div>'); renderCampaignForm(c); };
  $("#create-here").onclick = () => location.hash = "#/create?campaign=" + encodeURIComponent(c.id);
  if ($("#create-here2")) $("#create-here2").onclick = () => location.hash = "#/create?campaign=" + encodeURIComponent(c.id);
  $("#del-camp").onclick = async () => {
    const ok = await uiConfirm("As peças de conteúdo vinculadas NÃO são apagadas.", { title: "Excluir “" + c.name + "”?", confirmText: "Excluir campanha", confirmKind: "danger" });
    if (!ok) return;
    await API.deleteCampaign(c.id); toast("Campanha excluída", "success"); location.hash = "#/campaigns";
  };
}

/* =====================================================================
   CONTEÚDO (biblioteca de tasks)
   ===================================================================== */
function thumbHtml(t) {
  if (t.thumb && t.thumb.rel) {
    const url = API.rawUrl(t.folder, t.thumb.rel);
    if (t.thumb.type === "video") return `<video class="thumb" src="${url}" muted preload="metadata"></video>`;
    return `<img class="thumb" src="${url}" alt="" loading="lazy" onerror="this.style.display='none';this.closest('.content-card').classList.add('thumb-fallback')" />`;
  }
  return "";
}
// Ícone de um tipo de conteúdo: usa o SVG inline (iconSvg) quando houver — já é
// markup confiável vindo do nosso config, então NÃO escapamos —, senão o glyph.
function typeIconHtml(ct) {
  if (ct && ct.iconSvg) return ct.iconSvg;
  return esc((ct && ct.icon) || "▣");
}
function kindIcon(kind) {
  const ct = (State.meta.content_types || []).find((c) => c.kind === kind);
  return ct ? typeIconHtml(ct) : "▤";
}
// Sugere um Título legível a partir do Tema/objetivo digitado: remove o verbo
// imperativo inicial ("Anunciar a", "Divulgar o"...), pega a 1ª frase e limita o
// tamanho sem cortar palavra. É só um ponto de partida — o usuário pode editar.
function suggestTitleFromBrief(brief) {
  let s = String(brief || "").trim();
  if (!s) return "";
  s = s.split(/[.!?\n]/)[0].trim();
  // Remove o verbo imperativo inicial + artigo/preposição. O artigo exige espaço
  // depois (e vem do mais longo p/ o mais curto) para NÃO comer o "o" de "os" etc.
  s = s.replace(/^(anunciar|divulgar|comunicar|promover|apresentar|mostrar|explicar|ensinar|criar|fazer|gerar|postar|publicar|destacar|refor[cç]ar|lembrar|avisar(?:\s+sobre)?|falar\s+(?:sobre|de))\s+(?:(?:as|os|uma|um|sobre|da|do|de|a|o)\s+)?/i, "");
  if (!s) return "";
  // Corta numa fronteira natural (—, :, vírgula, "que", "para") p/ um título limpo,
  // desde que sobre texto suficiente — evita terminar no meio de uma oração.
  const cut = (re) => { const i = s.search(re); return (i >= 18) ? s.slice(0, i).trim() : null; };
  s = cut(/\s+[—–]\s+/) || cut(/\s*:\s+/) || cut(/,\s+/) || cut(/\s+que\s+/i) || cut(/\s+(?:para|pra)\s+/i) || s;
  if (s.length > 52) s = s.slice(0, 52).replace(/\s+\S*$/, "").trim();
  // Remove conectora pendurada no fim (ex.: "...percentual no" -> "...percentual").
  s = s.replace(/\s+(?:no|na|nos|nas|do|da|dos|das|de|e|o|a|os|as|em|ao|aos|para|pra|com|que)$/i, "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function taskCard(t) {
  const hasThumb = t.thumb && t.thumb.rel;
  const previewable = hasThumb && (t.thumb.type === "video" || t.thumb.type === "image" || /\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i.test(t.thumb.rel));
  const zoomBtn = previewable
    ? `<button class="cc-zoom" title="Pré-visualizar" aria-label="Pré-visualizar" onclick="event.preventDefault();event.stopPropagation();openLightbox('${API.rawUrl(t.folder, t.thumb.rel)}','${t.thumb.type === "video" ? "video" : "image"}','${API.downloadUrl(t.folder, t.thumb.rel)}')">⤢</button>`
    : "";
  const newBadge = !t.first_viewed_at ? '<span class="cc-new">Novo</span>' : "";
  const tagsHtml = (t.tags && t.tags.length)
    ? '<div class="cc-tags">' + t.tags.slice(0, 4).map((tg) => '<span class="cc-tag">' + esc(tg) + "</span>").join("") + (t.tags.length > 4 ? '<span class="cc-tag more">+' + (t.tags.length - 4) + "</span>" : "") + "</div>"
    : "";
  return `<a class="content-card ${hasThumb ? "" : "thumb-fallback"}" href="#/task/${encodeURIComponent(t.folder)}">
    <div class="cc-thumb">${thumbHtml(t)}<span class="cc-ph">${kindIcon(t.kind)}</span>${newBadge}${zoomBtn}</div>
    <div class="cc-body">
      <div class="cc-title">${esc(displayName(t))}</div>
      <div class="cc-meta">${esc(kindLabel(t.kind))} · ${esc(fmtDate(t.task_date))}${(t.pillar && pillarLabel(t.pillar)) ? ' · <span class="lr-pillar">' + esc(pillarLabel(t.pillar)) + "</span>" : ""}</div>
      ${tagsHtml}
      <div class="cc-foot">${statusBadge(t.status)}${t.campaign_id ? tag(campLabel(t.campaign_id)) : ""}</div>
    </div></a>`;
}

async function viewContent(arg, query) {
  setTitle("Conteúdo");
  const [{ tasks }, { campaigns }, collData] = await Promise.all([API.content(), API.campaigns(), API.collections().catch(() => ({ collections: [] }))]);
  setCampMap(campaigns);
  const active = tasks.filter((t) => t.zone !== "approved");
  // membership de coleções (já vem em item_ids) — para o filtro por coleção da biblioteca
  const colls = (collData && collData.collections) || [];
  const folderColls = {};
  colls.forEach((c) => (c.item_ids || []).forEach((f) => { (folderColls[f] = folderColls[f] || []).push(c.id); }));
  const collsActive = colls.filter((c) => (c.item_ids || []).some((f) => active.some((t) => t.folder === f)));
  const campName = (id) => { const c = campaigns.find((x) => x.id === id); return c ? c.name : id; };
  const kinds = ["all"].concat(Object.keys(State.meta.kind_labels || {}).filter((k) => active.some((t) => t.kind === k)));
  const statuses = Array.from(new Set(active.map((t) => t.status)));
  const campIds = Array.from(new Set(active.map((t) => t.campaign_id).filter(Boolean)));
  const tagSet = Array.from(new Set([].concat.apply([], active.map((t) => t.tags || [])))).sort((a, b) => a.localeCompare(b));

  const kindChips = kinds.map((k) => `<button class="chip-filter" data-fkind="${esc(k)}">${k === "all" ? "Todos os tipos" : esc(kindLabel(k))}</button>`).join("");
  const qualChips = [
    '<button type="button" class="qual-chip" data-q="status:">status:</button>',
    campIds.length ? '<button type="button" class="qual-chip" data-q="campanha:">campanha:</button>' : "",
    tagSet.length ? '<button type="button" class="qual-chip" data-q="tag:">tag:</button>' : "",
    collsActive.length ? '<button type="button" class="qual-chip" data-q="coleção:">coleção:</button>' : "",
  ].filter(Boolean).join("");
  const q0 = [];
  if (query && query.status && statuses.includes(query.status)) q0.push("status:" + query.status);
  if (query && query.tag && tagSet.indexOf(query.tag) !== -1) q0.push("tag:" + query.tag);
  if (query && query.collection && collsActive.some((c) => c.id === query.collection)) q0.push("coleção:" + query.collection);

  setView(`
    <div class="section-head"><h2>Biblioteca de conteúdo</h2><div class="flex" style="gap:8px;flex-wrap:wrap"><a class="btn btn-ghost" href="#/approved?view=collections" title="Agrupamentos de peças aprovadas">Coleções</a><button class="btn btn-primary" onclick="location.hash='#/create'">＋ Criar conteúdo</button></div></div>
    <div class="lib-toolbar">
      <input id="lib-search" class="lib-search" type="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Buscar por título, tema ou tag…  (ou filtre com os atalhos abaixo)" value="${esc(q0.join(" "))}" />
    </div>
    ${qualChips ? '<div class="lib-quals"><span class="hint">Filtrar na busca:</span>' + qualChips + "</div>" : ""}
    <div class="filter-bar" id="lib-kinds">${kindChips}</div>
    <div class="lib-meta"><span id="lib-count" class="muted"></span><button class="muted-link" id="lib-clear" type="button" hidden>Limpar filtros</button></div>
    <div id="lib-grid"></div>`);

  const st = { kind: (query && query.kind) || "all" };
  // resolve um valor digitado (parcial, sem acento exato) para o item real do filtro
  function resolveQual(key, val) {
    val = val.toLowerCase();
    if (key === "status") { const h = statuses.find((s) => statusLabel(s).toLowerCase().includes(val) || s.toLowerCase().includes(val)); return h || "__none__"; }
    if (key === "camp") { const h = campIds.find((id) => (campName(id) || "").toLowerCase().includes(val) || id.toLowerCase().includes(val)); return h || "__none__"; }
    if (key === "tag") { const h = tagSet.find((t) => t.toLowerCase().includes(val)); return h || "__none__"; }
    const h = collsActive.find((c) => c.name.toLowerCase().includes(val) || c.id.toLowerCase().includes(val)); return h ? h.id : "__none__";
  }
  // separa "status:rascunho tag:q3 texto livre" em qualifiers + busca textual
  function parseSearch(raw) {
    const quals = { status: null, camp: null, tag: null, coll: null }; const terms = [];
    raw.split(/\s+/).filter(Boolean).forEach((tok) => {
      const m = tok.match(/^(status|campanha|campaign|tag|cole(?:c|ç)[aã]o|collection):(.*)$/i);
      if (m) {
        if (!m[2]) return;
        const k = m[1].toLowerCase();
        if (k === "status") quals.status = resolveQual("status", m[2]);
        else if (k === "campanha" || k === "campaign") quals.camp = resolveQual("camp", m[2]);
        else if (k === "tag") quals.tag = resolveQual("tag", m[2]);
        else quals.coll = resolveQual("coll", m[2]);
      } else terms.push(tok);
    });
    return { quals, text: terms.join(" ").toLowerCase() };
  }
  function apply() {
    const raw = ($("#lib-search").value || "").trim();
    const { quals, text } = parseSearch(raw);
    let shown = active.slice();
    if (st.kind !== "all") shown = shown.filter((t) => t.kind === st.kind);
    if (quals.status) shown = shown.filter((t) => t.status === quals.status);
    else shown = shown.filter((t) => t.status !== "rejected");
    if (quals.camp) shown = shown.filter((t) => (t.campaign_id || "") === quals.camp);
    if (quals.coll) shown = shown.filter((t) => (folderColls[t.folder] || []).indexOf(quals.coll) !== -1);
    if (quals.tag) shown = shown.filter((t) => (t.tags || []).indexOf(quals.tag) !== -1);
    if (text) shown = shown.filter((t) => (displayName(t) + " " + (t.task_name || "") + " " + (t.tags || []).join(" ")).toLowerCase().includes(text));
    $$("#lib-kinds .chip-filter").forEach((b) => b.classList.toggle("on", b.dataset.fkind === st.kind));
    $("#lib-grid").innerHTML = shown.length
      ? '<div class="content-grid">' + shown.map(taskCard).join("") + "</div>"
      : '<div class="empty">Nenhuma peça com esses filtros. <a href="#/create">Criar conteúdo</a></div>';
    $("#lib-count").textContent = plural(shown.length, "peça", "peças");
    $("#lib-clear").hidden = !(st.kind !== "all" || raw);
  }
  $$("#lib-kinds .chip-filter").forEach((b) => { b.onclick = () => { st.kind = b.dataset.fkind; apply(); }; });
  $("#lib-search").oninput = apply;
  // dropdown de valores ao clicar num qualifier (status:/campanha:/tag:/coleção:) — seleciona e aplica
  let qualMenu = null;
  const onMenuKey = (e) => { if (e.key === "Escape") closeQualMenu(); };
  const onDocClick = (e) => { if (qualMenu && !e.target.closest(".qual-menu") && !e.target.closest(".qual-chip")) closeQualMenu(); };
  function closeQualMenu() { if (qualMenu) { qualMenu.remove(); qualMenu = null; document.removeEventListener("click", onDocClick); document.removeEventListener("keydown", onMenuKey); } }
  function setQual(key, value) {
    const inp = $("#lib-search");
    const toks = inp.value.split(/\s+/).filter(Boolean).filter((t) => t.toLowerCase().indexOf(key.toLowerCase() + ":") !== 0);
    toks.push(key + ":" + value);
    inp.value = toks.join(" ");
    apply();
  }
  function qualItems(key) {
    if (key === "status") return statuses.map((s) => ({ value: statusLabel(s).split(/\s+/).pop().toLowerCase(), label: statusLabel(s) }));
    if (key === "campanha") return campIds.map((id) => ({ value: id, label: campName(id) }));
    if (key === "tag") return tagSet.map((t) => ({ value: t, label: t }));
    if (key === "coleção") return collsActive.map((c) => ({ value: c.id, label: c.name }));
    return [];
  }
  function openQualMenu(chip, key) {
    closeQualMenu();
    const items = qualItems(key);
    const r = chip.getBoundingClientRect();
    qualMenu = document.createElement("div");
    qualMenu.className = "qual-menu";
    qualMenu.innerHTML = items.length
      ? items.map((it) => `<button type="button" class="qual-opt" data-v="${esc(it.value)}">${esc(it.label)}</button>`).join("")
      : '<div class="qual-opt is-empty">nada disponível</div>';
    qualMenu.style.left = Math.round(Math.min(r.left, window.innerWidth - 290)) + "px";
    qualMenu.style.top = Math.round(r.bottom + 4) + "px";
    document.body.appendChild(qualMenu);
    qualMenu.querySelectorAll(".qual-opt[data-v]").forEach((opt) => { opt.onclick = () => { setQual(key, opt.dataset.v); closeQualMenu(); $("#lib-search").focus(); }; });
    setTimeout(() => { document.addEventListener("click", onDocClick); document.addEventListener("keydown", onMenuKey); }, 0);
  }
  $$(".lib-quals .qual-chip").forEach((b) => { b.onclick = (e) => { e.stopPropagation(); openQualMenu(b, b.dataset.q.replace(/:$/, "")); }; });
  $("#lib-clear").onclick = () => { st.kind = "all"; $("#lib-search").value = ""; closeQualMenu(); apply(); };
  apply();
}

async function viewApproved(arg, query) {
  setTitle("Aprovados");
  if (query && query.collection) return openCollection(query.collection);
  if (query && query.view === "collections") return collectionsHome();
  return approvedPieces(query);
}

// Sub-navegação de Aprovados: peças aprovadas ⇄ coleções.
function approvedTabs(active) {
  const tab = (key, label, href) => `<a class="seg ${active === key ? "on" : ""}" href="${href}">${esc(label)}</a>`;
  return `<div class="seg-group mb">${tab("pieces", "Peças aprovadas", "#/approved")}${tab("collections", "Coleções", "#/approved?view=collections")}</div>`;
}

async function approvedPieces(query) {
  const [{ tasks }, { campaigns }] = await Promise.all([API.content(), API.campaigns()]);
  setCampMap(campaigns);
  const approved = tasks.filter((t) => t.zone === "approved" || t.status === "approved");
  const fc = (query && query.campaign) || "all";
  const shown = fc === "all" ? approved : approved.filter((t) => (t.campaign_id || "") === fc);
  const campSet = Array.from(new Set(approved.map((t) => t.campaign_id).filter(Boolean)));
  const campFilters = ['<button class="chip-filter ' + (fc === "all" ? "on" : "") + '" data-camp="all">Todas</button>']
    .concat(campSet.map((id) => {
      const c = campaigns.find((x) => x.id === id);
      return `<button class="chip-filter ${id === fc ? "on" : ""}" data-camp="${esc(id)}">${esc(c ? c.name : id)}</button>`;
    })).join("");
  const byKind = {};
  shown.forEach((t) => { (byKind[t.kind] = byKind[t.kind] || []).push(t); });
  const order = Object.keys(State.meta.kind_labels || {}).filter((k) => byKind[k]);
  const groups = order.map((k) => `
    <div class="kind-group">
      <div class="section-head"><h2>${esc(kindLabel(k))} <span class="dim">(${byKind[k].length})</span></h2></div>
      <div class="content-grid">${byKind[k].map(taskCard).join("")}</div>
    </div>`).join("");
  setView(`
    ${approvedTabs("pieces")}
    <div class="section-head"><h2>Conteúdo aprovado</h2><span class="dim">${plural(approved.length, "peça aprovada", "peças aprovadas")}</span></div>
    ${campSet.length ? '<div class="filter-bar">' + campFilters + "</div>" : ""}
    ${shown.length ? groups : '<div class="empty">Nenhuma peça aprovada ainda. Aprove peças em <a href="#/content">Conteúdo</a>.</div>'}`);
  $$(".filter-bar .chip-filter").forEach((b) => { b.onclick = () => { location.hash = "#/approved?campaign=" + encodeURIComponent(b.dataset.camp); }; });
}

/* =====================================================================
   COLEÇÕES (agrupamentos curados de peças, por referência, com ordem própria)
   ===================================================================== */
const FOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

async function collectionsHome() {
  const { collections } = await API.collections();
  await ensureCampMap();
  setView(`
    ${approvedTabs("collections")}
    <div class="section-head"><h2>Coleções</h2><button class="btn btn-primary" id="new-coll">＋ Nova coleção</button></div>
    <p class="muted mb">Agrupe peças aprovadas em coleções com ordem própria — úteis para sequência de postagem, destaques ou reaproveitamento. É opcional: as peças continuam onde estão; a coleção apenas aponta para elas, e a mesma peça pode estar em várias.</p>
    ${collections.length ? '<div class="coll-grid">' + collections.map(collectionTile).join("") + "</div>" : '<div class="empty">Nenhuma coleção ainda. Crie a primeira para organizar suas peças aprovadas.</div>'}`);
  $("#new-coll").onclick = async () => { const c = await newCollectionFlow(); if (c) location.hash = "#/approved?collection=" + encodeURIComponent(c.id); };
}

function collectionTile(c) {
  const cover = c.cover
    ? (c.cover.type === "video"
        ? `<video src="${API.rawUrl(c.cover.folder, c.cover.rel)}" muted preload="metadata"></video>`
        : `<img src="${API.rawUrl(c.cover.folder, c.cover.rel)}" alt="" loading="lazy" />`)
    : `<span class="coll-ph">${FOLDER_ICON}</span>`;
  return `<a class="coll-tile" href="#/approved?collection=${encodeURIComponent(c.id)}">
    <div class="coll-cover ${c.cover ? "" : "is-empty"}">${cover}</div>
    <div class="coll-tbody"><div class="coll-name">${esc(c.name)}</div><div class="coll-count">${plural(c.count, "peça", "peças")}</div></div></a>`;
}

async function openCollection(id) {
  const data = await API.collection(id).catch(() => null);
  if (!data) { setView('<div class="empty">Coleção não encontrada. <a href="#/approved?view=collections">Voltar para Coleções</a></div>'); return; }
  await ensureCampMap();
  const c = data.collection, items = data.items;
  setTitle(c.name);
  const lm = State.collLayout === "list" ? "list" : "grid";
  const itemsHtml = items.length
    ? (lm === "list"
        ? '<div class="list">' + items.map((t, i) => collItemRow(t, i, items.length)).join("") + "</div>"
        : '<div class="content-grid coll-items">' + items.map((t, i) => collItemCard(t, i, items.length)).join("") + "</div>")
    : '<div class="empty">Coleção vazia. Use “Adicionar peças” para incluir conteúdo aprovado.</div>';
  setView(`
    <div class="crumbs"><a href="#/approved?view=collections">Aprovados › Coleções</a> <span class="sep">›</span> <strong>${esc(c.name)}</strong></div>
    <div class="flex-between mb flex-wrap">
      <div>
        <h2 class="mt0">${esc(c.name)}</h2>
        ${c.description ? '<p class="muted">' + esc(c.description) + "</p>" : ""}
        <span class="dim">${plural(items.length, "peça", "peças")}${data.orphans ? " · " + plural(data.orphans, "indisponível", "indisponíveis") : ""}</span>
      </div>
      <div class="flex flex-wrap">
        <div class="seg-group sm">
          <button class="seg ${lm === "grid" ? "on" : ""}" data-lay="grid" title="Ver em grade" aria-label="Ver em grade">▦</button>
          <button class="seg ${lm === "list" ? "on" : ""}" data-lay="list" title="Ver em lista" aria-label="Ver em lista">≡</button>
        </div>
        <button class="btn btn-sm btn-primary" id="coll-add">＋ Adicionar peças</button>
        <button class="btn btn-sm" id="coll-edit">Renomear</button>
        <button class="btn btn-sm btn-danger" id="coll-del">Excluir coleção</button>
      </div>
    </div>
    ${data.orphans ? '<p class="muted">Algumas peças desta coleção foram descartadas e não aparecem aqui. Se forem restauradas, voltam automaticamente.</p>' : ""}
    <div id="coll-items-wrap">${itemsHtml}</div>`);
  $$("[data-lay]").forEach((b) => { b.onclick = () => { State.collLayout = b.dataset.lay; openCollection(id); }; });
  $("#coll-add").onclick = () => addPiecesFlow(c);
  $("#coll-edit").onclick = () => editCollectionFlow(c);
  $("#coll-del").onclick = () => deleteCollectionFlow(c);
  bindCollItemControls(c.id, items.map((t) => t.folder));
}

function collItemCtrls(t, idx, total) {
  return `<div class="coll-ctrls">
    <button class="cc-mini" data-cmove="up" data-folder="${esc(t.folder)}" title="Mover para cima" aria-label="Mover para cima" ${idx === 0 ? "disabled" : ""}>↑</button>
    <button class="cc-mini" data-cmove="down" data-folder="${esc(t.folder)}" title="Mover para baixo" aria-label="Mover para baixo" ${idx === total - 1 ? "disabled" : ""}>↓</button>
    <button class="cc-mini" data-ccover data-folder="${esc(t.folder)}" title="Usar como capa">capa</button>
    <button class="cc-mini danger" data-cremove data-folder="${esc(t.folder)}" title="Tirar da coleção" aria-label="Tirar da coleção">✕</button>
  </div>`;
}
function collItemCard(t, idx, total) {
  return `<div class="coll-item"><span class="coll-pos">${idx + 1}</span>${taskCard(t)}${collItemCtrls(t, idx, total)}</div>`;
}
function collItemRow(t, idx, total) {
  return `<div class="list-row coll-item-row">
    <span class="coll-pos">${idx + 1}</span>
    <div class="lr-main"><div class="lr-title"><a href="#/task/${encodeURIComponent(t.folder)}">${esc(displayName(t))}</a></div><div class="lr-meta">${esc(kindLabel(t.kind))} · ${esc(statusLabel(t.status))}</div></div>
    ${collItemCtrls(t, idx, total)}
  </div>`;
}

function bindCollItemControls(collId, order) {
  const wrap = $("#coll-items-wrap"); if (!wrap) return;
  const reopen = () => openCollection(collId);
  wrap.querySelectorAll("[data-cmove]").forEach((b) => b.onclick = async () => {
    const f = b.dataset.folder, i = order.indexOf(f); if (i < 0) return;
    const j = b.dataset.cmove === "up" ? i - 1 : i + 1; if (j < 0 || j >= order.length) return;
    const next = order.slice(); next[i] = order[j]; next[j] = f;
    try { await API.reorderCollection(collId, next); reopen(); } catch (e) { toast(e.message, "error"); }
  });
  wrap.querySelectorAll("[data-cremove]").forEach((b) => b.onclick = async () => {
    const ok = await uiConfirm("Tirar esta peça da coleção? A peça em si não é afetada — só sai deste agrupamento.", { title: "Remover da coleção", confirmText: "Remover", confirmKind: "danger" });
    if (!ok) return;
    try { await API.removeFromCollection(collId, b.dataset.folder); toast("Peça removida da coleção", "warn"); reopen(); } catch (e) { toast(e.message, "error"); }
  });
  wrap.querySelectorAll("[data-ccover]").forEach((b) => b.onclick = async () => {
    try { await API.updateCollection(collId, { cover: b.dataset.folder }); toast("Capa da coleção definida", "success"); } catch (e) { toast(e.message, "error"); }
  });
}

async function newCollectionFlow() {
  const res = await uiModal({
    title: "Nova coleção",
    message: "Dê um nome à coleção. As peças você adiciona depois.",
    fields: [
      { name: "name", label: "Nome", placeholder: "ex.: Sequência de lançamento" },
      { name: "description", label: "Descrição (opcional)", type: "textarea", placeholder: "para que serve esta coleção" },
    ],
    confirmText: "Criar coleção",
  });
  if (!res) return null;
  if (!res.name || res.name.length < 3) { toast("Dê um nome com ao menos 3 caracteres.", "error"); return null; }
  try { const r = await API.createCollection({ name: res.name, description: res.description }); toast("Coleção criada", "success"); return r.collection; }
  catch (e) { toast(e.message, "error"); return null; }
}

async function editCollectionFlow(c) {
  const res = await uiModal({
    title: "Editar coleção",
    fields: [
      { name: "name", label: "Nome", value: c.name },
      { name: "description", label: "Descrição", type: "textarea", value: c.description || "" },
    ],
    confirmText: "Salvar",
  });
  if (!res) return;
  if (!res.name || res.name.length < 3) { toast("Dê um nome com ao menos 3 caracteres.", "error"); return; }
  try { await API.updateCollection(c.id, { name: res.name, description: res.description }); toast("Coleção atualizada", "success"); openCollection(c.id); }
  catch (e) { toast(e.message, "error"); }
}

async function deleteCollectionFlow(c) {
  const ok = await uiConfirm("Excluir a coleção “" + c.name + "”? As peças NÃO são afetadas — só o agrupamento é removido.", { title: "Excluir coleção", confirmText: "Excluir coleção", confirmKind: "danger" });
  if (!ok) return;
  try { await API.deleteCollection(c.id); toast("Coleção excluída", "warn"); location.hash = "#/approved?view=collections"; }
  catch (e) { toast(e.message, "error"); }
}

async function addPiecesFlow(c) {
  const { tasks } = await API.content();
  const approved = tasks.filter((t) => t.zone === "approved" || t.status === "approved");
  const already = new Set(c.item_ids || []);
  const candidates = approved.filter((t) => !already.has(t.folder));
  if (!candidates.length) { toast("Não há outras peças aprovadas para adicionar.", "warn"); return; }
  const picked = await pickPiecesModal({ title: "Adicionar peças a “" + c.name + "”", candidates });
  if (!picked || !picked.length) return;
  try {
    for (const f of picked) await API.addToCollection(c.id, f);
    toast(plural(picked.length, "peça adicionada", "peças adicionadas"), "success");
    openCollection(c.id);
  } catch (e) { toast(e.message, "error"); }
}

// Seletor (multi) de peças aprovadas para incluir numa coleção.
function pickPiecesModal(opts) {
  const candidates = opts.candidates || [];
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-ov";
    const rows = candidates.map((t) => {
      const thumb = (t.thumb && t.thumb.rel)
        ? (t.thumb.type === "video" ? '<video src="' + API.rawUrl(t.folder, t.thumb.rel) + '" muted preload="metadata"></video>' : '<img src="' + API.rawUrl(t.folder, t.thumb.rel) + '" alt="" loading="lazy"/>')
        : '<span class="pick-ph">' + kindIcon(t.kind) + "</span>";
      return `<label class="pick-row">
        <input type="checkbox" value="${esc(t.folder)}" />
        <span class="pick-thumb">${thumb}</span>
        <span class="pick-main"><span class="pick-name">${esc(displayName(t))}</span><span class="pick-meta">${esc(kindLabel(t.kind))}${t.campaign_id ? " · " + esc(campLabel(t.campaign_id)) : ""}</span></span>
      </label>`;
    }).join("");
    ov.innerHTML = `<div class="modal modal-lg" role="dialog" aria-modal="true">
      <h3>${esc(opts.title || "Adicionar peças")}</h3>
      <p class="muted mt">Marque as peças aprovadas que entram na coleção.</p>
      <div class="pick-list">${rows}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-mx="cancel">Cancelar</button>
        <button class="btn btn-primary" data-mx="ok">Adicionar selecionadas</button>
      </div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add("no-scroll");
    const opener = document.activeElement;
    requestAnimationFrame(() => { ov.classList.add("open"); const f0 = focusablesIn(ov)[0]; if (f0) f0.focus(); });
    const done = (val) => { ov.classList.remove("open"); document.body.classList.remove("no-scroll"); document.removeEventListener("keydown", onKey); setTimeout(() => ov.remove(), 160); restoreFocus(opener); resolve(val); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); done(null); } else if (e.key === "Tab") trapTabKey(ov, e); };
    ov.querySelector("[data-mx='ok']").onclick = () => { const sel = $$('input[type="checkbox"]', ov).filter((x) => x.checked).map((x) => x.value); done(sel); };
    ov.querySelector("[data-mx='cancel']").onclick = () => done(null);
    ov.addEventListener("click", (e) => { if (e.target === ov) done(null); });
    document.addEventListener("keydown", onKey);
  });
}

// Mostra as coleções em que a peça está (no detalhe) e permite adicionar.
async function loadTaskCollections(folder) {
  const box = $("#task-colls"); if (!box) return;
  try {
    const { collections } = await API.collections();
    const mine = collections.filter((c) => (c.item_ids || []).includes(folder));
    box.innerHTML = mine.length
      ? mine.map((c) => '<a class="cc-tag link" href="#/approved?collection=' + encodeURIComponent(c.id) + '">' + esc(c.name) + "</a>").join("")
      : '<span class="muted">Esta peça não está em nenhuma coleção.</span>';
  } catch (e) { box.innerHTML = '<span class="muted">Não foi possível carregar as coleções.</span>'; }
}

async function addToCollectionFlow(folder) {
  let collections = [];
  try { collections = (await API.collections()).collections; } catch (e) { toast(e.message, "error"); return; }
  const choice = await chooseCollectionModal(collections, folder);
  if (!choice) return;
  try {
    if (choice.create) { const r = await API.createCollection({ name: choice.create }); await API.addToCollection(r.collection.id, folder); }
    else { await API.addToCollection(choice.id, folder); }
    toast("Peça adicionada à coleção", "success");
    loadTaskCollections(folder);
  } catch (e) { toast(e.message, "error"); }
}

function chooseCollectionModal(collections, folder) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-ov";
    const rows = collections.length
      ? collections.map((c) => {
          const has = (c.item_ids || []).includes(folder);
          return `<button class="coll-choose" data-cid="${esc(c.id)}" ${has ? "disabled" : ""}>${esc(c.name)} <span class="dim">${has ? "(já contém)" : plural(c.count, "peça", "peças")}</span></button>`;
        }).join("")
      : '<p class="muted">Nenhuma coleção ainda. Crie uma abaixo.</p>';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <h3>Adicionar a uma coleção</h3>
      <div class="coll-choose-list mt">${rows}</div>
      <hr class="sep" />
      <div class="field"><label>Ou crie uma nova coleção</label><input data-newcoll placeholder="nome da nova coleção" /></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-mx="cancel">Cancelar</button>
        <button class="btn btn-primary" data-mx="create">Criar e adicionar</button>
      </div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add("no-scroll");
    const opener = document.activeElement;
    requestAnimationFrame(() => { ov.classList.add("open"); const f0 = focusablesIn(ov)[0]; if (f0) f0.focus(); });
    const done = (val) => { ov.classList.remove("open"); document.body.classList.remove("no-scroll"); document.removeEventListener("keydown", onKey); setTimeout(() => ov.remove(), 160); restoreFocus(opener); resolve(val); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); done(null); } else if (e.key === "Tab") trapTabKey(ov, e); };
    $$("[data-cid]", ov).forEach((b) => { b.onclick = () => done({ id: b.dataset.cid }); });
    ov.querySelector("[data-mx='create']").onclick = () => { const v = ov.querySelector("[data-newcoll]").value.trim(); if (v.length < 3) { toast("Dê um nome com ao menos 3 caracteres.", "error"); return; } done({ create: v }); };
    ov.querySelector("[data-mx='cancel']").onclick = () => done(null);
    ov.addEventListener("click", (e) => { if (e.target === ov) done(null); });
    document.addEventListener("keydown", onKey);
  });
}

/* =====================================================================
   DETALHE DA TASK
   ===================================================================== */
function fileRow(folder, f) {
  const media = f.isImage || f.isVideo;
  const isHtml = /\.html?$/i.test(f.rel);
  const viewBtn = media
    ? `<button class="btn btn-sm" onclick="openLightbox('${API.rawUrl(folder, f.rel)}','${f.isVideo ? "video" : "image"}','${API.downloadUrl(folder, f.rel)}')">ver</button>`
    : isHtml
      ? `<button class="btn btn-sm" onclick="openHtmlLightbox('${esc(folder)}','${esc(f.rel)}','${API.downloadUrl(folder, f.rel)}')">ver</button>`
      : `<button class="btn btn-sm" onclick="openTextLightbox('${esc(folder)}','${esc(f.rel)}','${API.downloadUrl(folder, f.rel)}')">ver</button>`;
  return `<div class="list-row"><div class="lr-main"><div class="lr-title">${esc(fileLabel(f.rel))}</div><div class="lr-meta"><span class="codeblock">${esc(f.rel)}</span> · ${esc(fmtBytes(f.size))}</div></div>
    <div class="flex">${viewBtn}<a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, f.rel)}" download>baixar</a></div></div>`;
}

function mediaGallery(folder, task) {
  const imgs = task.files.filter((f) => f.isImage);
  const vids = task.files.filter((f) => f.isVideo);
  if (!imgs.length && !vids.length) return "";
  const items = []
    .concat(vids.map((f) => `<div class="media-item"><div class="media-frame"><video src="${API.rawUrl(folder, f.rel)}" controls preload="metadata"></video><button class="media-zoom" title="Ampliar" aria-label="Ampliar" onclick="openLightbox('${API.rawUrl(folder, f.rel)}','video','${API.downloadUrl(folder, f.rel)}')">⤢</button></div><a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, f.rel)}" download>baixar ${esc(f.rel.split("/").pop())}</a></div>`))
    .concat(imgs.map((f) => `<div class="media-item"><div class="media-frame"><img src="${API.rawUrl(folder, f.rel)}" alt="${esc(f.rel)}" loading="lazy" onclick="openLightbox('${API.rawUrl(folder, f.rel)}','image','${API.downloadUrl(folder, f.rel)}')" /><button class="media-zoom" title="Ampliar" aria-label="Ampliar" onclick="openLightbox('${API.rawUrl(folder, f.rel)}','image','${API.downloadUrl(folder, f.rel)}')">⤢</button></div><a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, f.rel)}" download>baixar</a></div>`));
  return `<div class="card"><h3>Arte gerada</h3><p class="muted mt">Clique na imagem para ampliar dentro do site.</p><div class="media-gallery mt">${items.join("")}</div></div>`;
}

// #2 — Galeria única e ordenada dos slides de um carrossel (slide_1..n): cada slide
// numerado, com ampliar e baixar. Substitui a "Arte gerada" p/ carrossel (evita duplicar).
function carouselStrip(folder, task) {
  const slides = task.files
    .filter((f) => /slide_0*\d+\.png$/i.test(f.rel))
    .map((f) => ({ f, n: parseInt((f.rel.match(/slide_0*(\d+)\.png$/i) || [])[1] || "0", 10) }))
    .sort((a, b) => a.n - b.n);
  if (slides.length < 2) return "";
  const items = slides.map((s) =>
    `<div class="media-item"><div class="media-frame">
      <span class="slide-num">${s.n}</span>
      <img src="${API.rawUrl(folder, s.f.rel)}" alt="Slide ${s.n}" loading="lazy" onclick="openLightbox('${API.rawUrl(folder, s.f.rel)}','image','${API.downloadUrl(folder, s.f.rel)}')" />
      <button class="media-zoom" title="Ampliar slide ${s.n}" aria-label="Ampliar slide ${s.n}" onclick="openLightbox('${API.rawUrl(folder, s.f.rel)}','image','${API.downloadUrl(folder, s.f.rel)}')">⤢</button>
    </div><a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, s.f.rel)}" download>baixar slide ${s.n}</a></div>`).join("");
  return `<div class="card"><h3>Slides do carrossel <span class="dim">(${slides.length})</span></h3>
    <p class="muted mt">Na ordem de publicação — clique para ampliar ou baixe cada slide.</p>
    <div class="media-gallery mt">${items}</div></div>`;
}

function renderPanel(folder, task) {
  if (!isMediaKind(task.kind)) return "";
  const hasMedia = task.files.some((f) => f.isImage || f.isVideo);
  if (task.zone !== "active") {
    return `<div class="card"><h3>Arte final</h3><p class="muted mt">A peça está em <strong>${esc(zoneLabel(task.zone))}</strong>. Para gerar a arte novamente, reabra a peça para edição.</p></div>`;
  }
  const label = task.kind === "video" ? "Gerar vídeo final" : "Gerar arte final";
  const reLabel = task.kind === "video" ? "Gerar nova versão do vídeo" : "Gerar nova versão da arte";
  const note = task.kind === "video"
    ? "Cria o vídeo final (formato vertical 9:16, ideal para Reels e Stories) a partir do roteiro de cenas. Pode levar alguns minutos."
    : "Gera a arte final no padrão da marca automaticamente.";
  return `<div class="card">
    <h3>Arte final</h3>
    <p class="muted mt">${note}</p>
    ${templatePicker(task)}
    <div class="flex mt"><button class="btn btn-primary" id="btn-render" data-kind="${esc(task.kind)}">${hasMedia ? reLabel : label}</button><span id="render-out" class="muted"></span></div>
  </div>`;
}

// Templates visuais disponiveis para pecas estaticas (image/feed/carousel).
const VISUAL_TEMPLATES = [
  { id: "editorial", name: "Editorial", desc: "Gradiente azul, dots, headline à esquerda" },
  { id: "bold", name: "Destaque", desc: "Fundo escuro centralizado, número em evidência" },
  { id: "split", name: "Dividido", desc: "Faixa clara (logo) + faixa escura (título)" },
];

// #8 — variação visual automática: quando a peça ainda não tem template salvo,
// escolhe uma variante por hash do slug (rotação determinística) para evitar que
// todas as gerações fiquem visualmente idênticas. O usuário ainda pode trocar.
function autoVariant(folder) {
  const s = String(folder || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return VISUAL_TEMPLATES[h % VISUAL_TEMPLATES.length].id;
}

function templatePicker(task) {
  if (task.kind === "video") return ""; // video usa a composition BrandStory
  const current = task.template || autoVariant(task.folder);
  const opts = VISUAL_TEMPLATES.map((t) => `
    <label class="tpl-opt${t.id === current ? " is-active" : ""}" data-tpl="${t.id}">
      <input type="radio" name="render-tpl" value="${t.id}"${t.id === current ? " checked" : ""} />
      <span class="tpl-name">${esc(t.name)}</span>
      <span class="tpl-desc">${esc(t.desc)}</span>
    </label>`).join("");
  return `<div class="tpl-picker mt">
    <div class="muted" style="font-size:13px;margin-bottom:8px">Estilo visual da arte</div>
    <div class="tpl-grid">${opts}</div>
  </div>`;
}

function selectedTemplate() {
  const el = document.querySelector('input[name="render-tpl"]:checked');
  return el ? el.value : undefined;
}

function autoRenders(kind) { return kind === "image" || kind === "feed" || kind === "carousel"; }

function refineCard(task) {
  if (task.zone !== "active") return "";
  const ct = (State.meta.content_types || []).find((c) => c.kind === task.kind);
  if (!ct) return "";
  const note = autoRenders(task.kind)
    ? "A IA ajusta o conteúdo e <strong>a arte é atualizada automaticamente</strong>."
    : (task.kind === "video"
      ? "A IA ajusta o roteiro; depois clique em <strong>Gerar nova versão do vídeo</strong> (vídeo é mais lento)."
      : "A IA ajusta o texto desta peça mantendo o resto.");
  return `<div class="card mt">
    <h3>Ajustar com IA</h3>
    <p class="muted mt">${note}</p>
    <div class="refine-box mt">
      <textarea id="refine-input" rows="2" placeholder="ex.: deixe o segundo slide mais direto e troque o CTA"></textarea>
      <button class="btn btn-primary mt" id="btn-refine" data-ct="${esc(ct.id)}" data-file="${esc(ct.file)}">Aplicar ajuste</button>
      <span id="refine-out" class="muted"></span>
    </div>
  </div>`;
}

async function refineTask(folder, task) {
  const btn = $("#btn-refine");
  const instruction = $("#refine-input").value.trim();
  if (instruction.length < 3) { toast("Escreva a orientação do ajuste.", "error"); return; }
  const s = task.status;
  const ctId = btn.dataset.ct, file = btn.dataset.file;
  btn.disabled = true; const orig = btn.textContent; btn.innerHTML = '<span class="spinner"></span> ajustando…';
  try {
    const current = await API.taskFile(folder, file);
    const r = await API.refine({ content_type: ctId, current, instruction, campaign_id: s.campaign_id || undefined, pillar: task.pillar || undefined });
    if (r.simulated) toast("Ajuste simulado (configure a chave para usar a IA real)", "warn");
    await API.save({
      content_type: ctId,
      brief: "Ajuste via painel: " + instruction,
      task_name: s.task_name, task_date: s.task_date,
      platforms: s.platforms || [], campaign_id: s.campaign_id || undefined,
      parsed: r.parsed, raw: r.raw,
    });
    if (autoRenders(task.kind)) {
      btn.innerHTML = '<span class="spinner"></span> atualizando a arte…';
      const rr = await API.renderMedia(folder, task.kind, selectedTemplate());
      if (!rr.ok) toast("Ajustado, mas falhou a geração da arte: " + (rr.stderr || rr.error || "erro"), "warn");
      else toast("Ajustado e arte atualizada", "success");
    } else if (task.kind === "video") {
      toast("Roteiro ajustado — clique em Gerar nova versão do vídeo", "success");
    } else {
      toast("Conteúdo ajustado", "success");
    }
    router();
  } catch (e) {
    if (e.status === 422 && e.data && e.data.governance) toast("Ajuste bloqueado por regra de marca — reescreva a orientação.", "error");
    else toastAiError(e);
    btn.disabled = false; btn.textContent = orig;
  }
}

async function viewTaskDetail(folder) {
  const { task } = await API.task(folder);
  await ensureCampMap();
  const s = task.status;
  setTitle(displayName(s));
  { const _bk = $("#btn-back"); if (_bk) _bk.dataset.fallback = task.zone === "approved" ? "#/approved" : "#/content"; }
  const actions = workflowActions(task);
  const canDiscard = task.zone !== "approved";
  const techSlug = s.title ? `<span class="dim" style="font-size:12.5px">identificador: <span class="codeblock">${esc(s.task_name)}</span></span>` : "";
  const pillarTag = (task.pillar && pillarLabel(task.pillar)) ? tag("Pilar: " + pillarLabel(task.pillar)) : "";
  setView(`
    <div class="flex flex-wrap mb">${statusBadge(s.status)}${tag(kindLabel(task.kind))}${pillarTag}${tag(zoneLabel(task.zone))}${(s.platforms || []).map((p) => tag(platformLabel(p))).join("")}${techSlug}</div>
    ${task.kind === "carousel" ? (carouselStrip(folder, task) || mediaGallery(folder, task)) : mediaGallery(folder, task)}
    <div class="grid grid-2 mt">
      <div class="card">
        <h3>Arquivos</h3>
        ${task.files.length ? '<div class="list mt">' + task.files.map((f) => fileRow(folder, f)).join("") + "</div>" : '<div class="empty">Sem arquivos de conteúdo.</div>'}
        <div id="file-view" class="mt"></div>
      </div>
      <div>
        ${renderPanel(folder, task)}
        ${refineCard(task)}
        <div class="card mt">
          <div class="flex-between"><h3>Tags</h3><button class="btn btn-sm" id="btn-tags">Editar</button></div>
          <div class="chips mt" id="task-tags">${(task.tags && task.tags.length) ? task.tags.map((tg) => '<span class="cc-tag">' + esc(tg) + "</span>").join("") : '<span class="muted">Sem tags ainda.</span>'}</div>
          <p class="muted mt">Rótulos livres para organizar e filtrar na biblioteca.</p>
        </div>
        <div class="card mt">
          <div class="flex-between"><h3>Coleções</h3><button class="btn btn-sm" id="btn-add-coll">Adicionar a uma coleção</button></div>
          <div class="chips mt" id="task-colls"><span class="muted">Carregando…</span></div>
          <p class="muted mt">Coleções são agrupamentos curados (opcionais) com ordem própria. Não substituem tags nem campanhas.</p>
        </div>
        <div class="card mt">
          <h3>Aprovação da peça</h3>
          <div class="kv mt">
            <div class="k">Campanha</div><div>${s.campaign_id ? '<a href="#/campaign/' + esc(s.campaign_id) + '">' + esc(campLabel(s.campaign_id)) + "</a>" : "—"}</div>
            <div class="k">Ângulo</div><div>${esc(s.campaign_angle || "—")}</div>
            <div class="k">Criada</div><div>${esc(fmtDateTime(s.created_at))}</div>
            <div class="k">Atualizada</div><div>${esc(fmtDateTime(s.last_updated_at))}</div>
            ${s.approved_by ? '<div class="k">Aprovada por</div><div>' + esc(s.approved_by) + " · " + esc(fmtDateTime(s.approved_at)) + "</div>" : ""}
          </div>
          <hr class="sep" />
          <div class="flex flex-wrap" id="wf-actions">${actions}</div>
          <p class="muted mt">${workflowHint(s.status)}</p>
          ${canDiscard ? '<hr class="sep" /><button class="btn btn-sm btn-danger" id="btn-discard">Descartar peça</button><p class="muted mt">Move a peça para os arquivados — pode ser restaurada depois; nada é apagado.</p>' : ""}
        </div>
      </div>
    </div>`);
  bindWorkflow(task);
  if ($("#btn-tags")) $("#btn-tags").onclick = () => editTags(folder, task.tags || []);
  loadTaskCollections(folder);
  if ($("#btn-add-coll")) $("#btn-add-coll").onclick = () => addToCollectionFlow(folder);
  if ($("#btn-refine")) $("#btn-refine").onclick = () => refineTask(folder, task);
  document.querySelectorAll('input[name="render-tpl"]').forEach((el) => {
    el.onchange = () => {
      document.querySelectorAll(".tpl-opt").forEach((o) => o.classList.toggle("is-active", o.dataset.tpl === el.value));
    };
  });
  if ($("#btn-render")) {
    $("#btn-render").onclick = async () => {
      const btn = $("#btn-render"); const out = $("#render-out");
      btn.disabled = true; const orig = btn.textContent; btn.innerHTML = '<span class="spinner"></span> gerando arte…';
      out.textContent = task.kind === "video" ? "isto pode levar alguns minutos…" : "";
      try {
        const r = await API.renderMedia(folder, btn.dataset.kind, selectedTemplate());
        if (!r.ok) throw new Error(r.stderr || r.error || "falha ao gerar a arte");
        toast("Arte gerada", "success"); router();
      } catch (e) { toast(e.message, "error"); btn.disabled = false; btn.textContent = orig; out.textContent = ""; }
    };
  }
  if ($("#btn-discard")) {
    $("#btn-discard").onclick = async () => {
      const ok = await uiConfirm("A peça vai para os arquivados — pode ser restaurada depois; nada é apagado.", { title: "Descartar “" + displayName(s) + "”?", confirmText: "Descartar peça", confirmKind: "danger" });
      if (!ok) return;
      try { await API.discard(folder); toast("Peça descartada (arquivada)", "warn"); location.hash = "#/content"; }
      catch (e) { toast(e.message, "error"); }
    };
  }
}

// #5 — Edita as tags da peça (rótulos livres, separados por vírgula).
async function editTags(folder, current) {
  let suggestions = [];
  try {
    const { tasks } = await API.content();
    suggestions = Array.from(new Set([].concat.apply([], tasks.map((t) => t.tags || [])))).sort((a, b) => a.localeCompare(b));
  } catch (e) {}
  const res = await uiModal({
    title: "Editar tags",
    message: "Separe por vírgula. Até 12 tags, 32 caracteres cada.",
    fields: [{ name: "tags", label: "Tags", value: (current || []).join(", "), placeholder: "ex.: taxa-zero, instagram, q3", suggestions, suggestLabel: suggestions.length ? "Já usadas (clique para usar):" : "" }],
    confirmText: "Salvar tags",
  });
  if (!res) return;
  try {
    await API.setTags(folder, res.tags);
    toast("Tags atualizadas", "success");
    router();
  } catch (e) { toast(e.message, "error"); }
}

// Exclui uma tag de TODAS as peças (remoção global). Sem endpoint dedicado: itera
// as peças que a usam e regrava as tags sem ela. Confirmação obrigatória.
async function deleteTagGlobally(tag) {
  const ok = await uiConfirm('Excluir a tag "' + tag + '" de todas as peças? Não dá para desfazer com um clique.', { title: "Excluir tag", confirmText: "Excluir tag", confirmKind: "danger" });
  if (!ok) return;
  let tasks = [];
  try { tasks = ((await API.content()).tasks || []).filter((t) => (t.tags || []).some((x) => x.toLowerCase() === tag.toLowerCase())); }
  catch (e) { toast("Não foi possível carregar as peças", "error"); return; }
  let done = 0, fail = 0;
  for (const t of tasks) {
    const next = (t.tags || []).filter((x) => x.toLowerCase() !== tag.toLowerCase());
    try { await API.setTags(t.folder, next); done++; } catch (e) { fail++; }
  }
  toast(fail ? ('Tag removida de ' + done + ' peça(s); ' + fail + " falhou(aram)") : ('Tag "' + tag + '" removida de ' + done + " peça(s)"), fail ? "warn" : "success");
  if (location.hash.indexOf("/settings") !== -1) viewSettings();
}

function workflowActions(task) {
  const s = task.status.status;
  if (s === "draft") return `<button class="btn btn-primary" data-wf="preview">Enviar para revisão</button>`;
  if (s === "in_review") return `<button class="btn btn-primary" data-wf="approve">Aprovar</button><button class="btn btn-danger" data-wf="reject">Rejeitar</button><button class="btn btn-sm" data-wf="preview">Gerar prévia de novo</button>`;
  if (s === "approved") return `<span class="badge approved">aprovada e salva</span><button class="btn btn-sm" data-wf="rework">Reabrir para edição</button>`;
  if (s === "rejected") return `<button class="btn btn-sm" data-wf="rework">Reabrir para edição</button>`;
  return "";
}
function workflowHint(s) {
  if (s === "draft") return "Envia a peça para revisão antes da aprovação.";
  if (s === "in_review") return "Aprovar salva uma versão final protegida da peça. Rejeitar arquiva a peça.";
  if (s === "approved") return "Aprovada: não altere os arquivos diretamente. Use “Reabrir para edição” para mudar e aprovar de novo.";
  if (s === "rejected") return "Rejeitada e arquivada. Reabra para editar de novo.";
  return "";
}
function bindWorkflow(task) {
  $$("#wf-actions [data-wf]").forEach((btn) => {
    btn.onclick = async () => {
      const wf = btn.dataset.wf;
      const orig = btn.innerHTML;
      const busy = () => { $$("#wf-actions [data-wf]").forEach((b) => (b.disabled = true)); btn.innerHTML = '<span class="spinner"></span> processando…'; };
      try {
        if (wf === "preview") {
          busy(); const r = await API.preview(task.folder); if (!r.ok) throw new Error(r.stderr || "falha ao gerar a prévia"); toast("Peça enviada para revisão", "success");
        } else if (wf === "approve") {
          const res = await uiModal({ title: "Aprovar peça", message: "Salva uma versão final protegida da peça.", fields: [{ name: "by", label: "Aprovado por (seu nome)", placeholder: "ex.: Hugo Belo" }], confirmText: "Aprovar peça" });
          if (!res || !res.by) return;
          busy(); const r = await API.promote(task.folder, { to: "approved", by: res.by }); if (!r.ok) throw new Error(r.stderr || "falha"); toast("Aprovada e salva", "success");
        } else if (wf === "reject") {
          const res = await uiModal({ title: "Rejeitar peça", message: "A peça será arquivada (reversível).", fields: [{ name: "reason", label: "Motivo da rejeição (opcional)", type: "textarea", placeholder: "ex.: headline fora do tom da marca" }], confirmText: "Rejeitar peça", confirmKind: "danger" });
          if (res === null) return;
          busy(); const r = await API.promote(task.folder, { to: "rejected", by: "painel", reason: res.reason || "" }); if (!r.ok) throw new Error(r.stderr || "falha"); toast("Rejeitada e arquivada", "warn");
        } else if (wf === "rework") {
          busy(); const r = await API.promote(task.folder, { to: "in_review" }); if (!r.ok) throw new Error(r.stderr || "falha"); toast("Reaberta para edição", "success");
        }
        router();
      } catch (e) { toast(e.message, "error"); $$("#wf-actions [data-wf]").forEach((b) => (b.disabled = false)); btn.innerHTML = orig; }
    };
  });
}

async function openFile(folder, rel) {
  try {
    const text = await API.taskFile(folder, rel);
    const host = $("#file-view");
    if (rel.endsWith(".html")) {
      const url = URL.createObjectURL(new Blob([text], { type: "text/html" }));
      host.innerHTML = '<div class="gen-out"><div class="flex-between mb"><strong>' + esc(rel) + '</strong>'
        + '<a class="btn btn-sm btn-ghost" href="' + url + '" target="_blank" rel="noopener">abrir em nova aba ↗</a></div>'
        + '<iframe class="file-frame" src="' + url + '" title="' + esc(rel) + '"></iframe></div>';
      host.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    host.innerHTML = '<div class="gen-out"><div class="flex-between mb"><strong>' + esc(rel) + '</strong></div><pre class="codeblock">' + esc(text) + "</pre></div>";
    host.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) { toast(e.message, "error"); }
}
window.openFile = openFile;

/* ---- Lightbox ---- */
let _lbBlobUrl = null;
let _lbOpener = null;
// Mostra/oculta o botão "abrir em nova aba" do lightbox (só faz sentido p/ HTML).
function setLightboxNewTab(url) {
  const nt = $("#lightbox-newtab");
  if (!nt) return;
  if (url) { nt.href = url; nt.style.display = ""; } else { nt.style.display = "none"; nt.removeAttribute("href"); }
}
// Abre o chrome do lightbox: guarda quem abriu, exibe e move o foco para o botão fechar.
function lbShow() {
  const lb = $("#lightbox"); if (!lb) return;
  _lbOpener = document.activeElement;
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  const cb = $("#lightbox-close"); if (cb) cb.focus();
}
function openLightbox(url, type, dlUrl) {
  const lb = $("#lightbox");
  const stage = $("#lightbox-stage");
  if (!lb || !stage) { window.open(url, "_blank"); return; }
  stage.innerHTML = type === "video"
    ? `<video src="${url}" controls autoplay playsinline></video>`
    : `<img src="${url}" alt="" />`;
  setLightboxNewTab(null);
  const dl = $("#lightbox-dl");
  if (dl) { dl.href = dlUrl || url; dl.style.display = dlUrl ? "" : "none"; }
  lbShow();
}
// #7 — Pré-visualiza .json/.txt num modal amplo com <pre> mono, scroll interno.
async function openTextLightbox(folder, rel, dlUrl) {
  const lb = $("#lightbox");
  const stage = $("#lightbox-stage");
  if (!lb || !stage) { window.open(API.rawUrl(folder, rel), "_blank"); return; }
  stage.innerHTML = '<div class="lightbox-loading"><span class="spinner"></span> carregando…</div>';
  setLightboxNewTab(null);
  lbShow();
  const dl = $("#lightbox-dl");
  if (dl) { dl.href = dlUrl || API.downloadUrl(folder, rel); dl.style.display = ""; }
  try {
    let text = await API.taskFile(folder, rel);
    if (/\.json$/i.test(rel)) { try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* mantém cru */ } }
    stage.innerHTML = `<pre class="lightbox-pre">${esc(text)}</pre>`;
  } catch (e) {
    stage.innerHTML = '<div class="lightbox-loading">Não foi possível abrir: ' + esc(e.message) + "</div>";
  }
}
// #6 — Pré-visualiza HTML (ex.: preview.html) num modal amplo e responsivo.
async function openHtmlLightbox(folder, rel, dlUrl) {
  const lb = $("#lightbox");
  const stage = $("#lightbox-stage");
  if (!lb || !stage) { window.open(API.rawUrl(folder, rel), "_blank"); return; }
  stage.innerHTML = '<div class="lightbox-loading"><span class="spinner"></span> carregando…</div>';
  setLightboxNewTab(null);
  lbShow();
  try {
    const text = await API.taskFile(folder, rel);
    if (_lbBlobUrl) { URL.revokeObjectURL(_lbBlobUrl); _lbBlobUrl = null; }
    _lbBlobUrl = URL.createObjectURL(new Blob([text], { type: "text/html" }));
    stage.innerHTML = `<iframe class="lightbox-frame" src="${_lbBlobUrl}" title="${esc(rel)}"></iframe>`;
    setLightboxNewTab(_lbBlobUrl);
    const dl = $("#lightbox-dl");
    if (dl) { dl.href = dlUrl || API.downloadUrl(folder, rel); dl.style.display = ""; }
  } catch (e) {
    stage.innerHTML = '<div class="lightbox-loading">Não foi possível abrir: ' + esc(e.message) + "</div>";
  }
}
function closeLightbox() {
  const lb = $("#lightbox");
  if (!lb) return;
  lb.classList.remove("open");
  lb.setAttribute("aria-hidden", "true");
  const stage = $("#lightbox-stage");
  if (stage) stage.innerHTML = "";
  setLightboxNewTab(null);
  if (_lbBlobUrl) { URL.revokeObjectURL(_lbBlobUrl); _lbBlobUrl = null; }
  document.body.classList.remove("no-scroll");
  restoreFocus(_lbOpener); _lbOpener = null;
}
function setupLightbox() {
  const lb = $("#lightbox");
  if (!lb) return;
  const closeBtn = $("#lightbox-close");
  if (closeBtn) closeBtn.onclick = closeLightbox;
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.id === "lightbox-stage") closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "Tab") trapTabKey(lb, e);
  });
}
window.openLightbox = openLightbox;
window.openHtmlLightbox = openHtmlLightbox;
window.openTextLightbox = openTextLightbox;
window.closeLightbox = closeLightbox;

/* =====================================================================
   CRIAR CONTEÚDO (geração com IA)
   ===================================================================== */
let LAST_GEN = null;
async function viewCreate(arg, query) {
  setTitle("Criar conteúdo");
  const { campaigns } = await API.campaigns();
  setCampMap(campaigns);
  const preCamp = (query && query.campaign) || "";
  const preType = (query && query.type) || State.meta.content_types[0].id;
  const campOpts = '<option value="">— sem campanha —</option>' + campaigns.map((c) => `<option value="${esc(c.id)}" ${c.id === preCamp ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  const prePillar = (query && query.pillar) || "";
  const pillarOpts = '<option value="">— a IA decide pelo tema da peça —</option>' + (State.meta.content_pillars || []).map((p) => `<option value="${esc(p.id)}" ${p.id === prePillar ? "selected" : ""} title="${esc(p.description)}">${esc(p.label)}</option>`).join("");
  const typeCards = State.meta.content_types.map((c) => `
    <button type="button" class="type-card ${c.id === preType ? "on" : ""}" data-type="${esc(c.id)}" title="${esc(c.description)}">
      <span class="tc-icon">${typeIconHtml(c)}</span>
      <span class="tc-label">${esc(c.short || c.label)}</span>
      <span class="tc-media badge plain">${esc(mediaLabel(c.media))}</span>
    </button>`).join("");
  setView(`
    <div class="grid grid-2">
      <div class="card">
        <h3>Descreva a peça</h3>
        <p class="muted create-lead">Você descreve uma vez. A IA pesquisa o tema, escreve no tom da 4Selet e confere a identidade da marca — como sua equipe de marketing faria.</p>

        <div class="form-section">
          <div class="form-section-head"><span class="fs-num">1</span><h4>O que criar</h4></div>
          <div class="field"><label>Tipo de conteúdo</label>
            <div class="type-grid" id="g-type-grid">${typeCards}</div>
            <input type="hidden" id="g-type" value="${esc(preType)}" />
            <div class="hint" id="g-type-desc"></div>
          </div>
          <div class="field"><label>Plataformas <span class="hint" id="g-plats-hint"></span></label><div class="checks" id="g-plats"></div></div>
          <div class="field"><label>Campanha <span class="hint">(opcional — liga a peça à campanha e já sugere o tema)</span></label><select id="g-camp">${campOpts}</select></div>
        </div>

        <div class="form-section">
          <div class="form-section-head"><span class="fs-num">2</span><h4>Sobre a peça</h4></div>
          <div class="field"><label>Título da peça <span class="hint">(nome legível, ex.: “Taxa Zero — produtores 50k+”)</span></label><input id="g-title" placeholder="Taxa Zero para produtores estabelecidos" aria-describedby="e-title" /><div class="field-error" id="e-title" role="alert"></div></div>
          <div class="field"><label>Tema / objetivo da peça <span class="hint" id="g-brief-count" aria-live="polite"></span></label><textarea id="g-brief" rows="3" placeholder="ex.: Anunciar a Taxa Zero para produtores que faturam 50k+ e estão insatisfeitos com prazos" aria-describedby="e-brief"></textarea><div class="field-error" id="e-brief" role="alert"></div></div>
          <div class="field"><label>Pilar de conteúdo <span class="hint">(o tema central da peça — seu feed não é só Taxa Zero)</span></label>
            <select id="g-pillar">${pillarOpts}</select>
            <div class="hint" id="g-pillar-desc"></div>
          </div>
          <div class="field"><label>Data</label><input type="date" id="g-date" value="${todayISO()}" style="max-width:220px" /></div>
        </div>

        <div class="form-section">
          <div class="form-section-head"><span class="fs-num">3</span><h4>Ajustes <span class="fs-opt">— opcional</span></h4></div>
        <details class="adv-block">
          <summary>Criação avançada — orientação, tom, oferta, estilo e referências</summary>
          <p class="muted adv-lead">Tudo opcional. Sem nada aqui, a IA decide com bom senso no padrão da 4Selet. Use para dar liberdade de expressão e não deixar o sistema adivinhar.</p>
          <div class="field"><label>Orientação na postagem — chamada para ação (CTA) <span class="hint">(padrão: sem CTA; escreva uma ação só se quiser orientar)</span></label>
            <input id="g-cta" placeholder="ex.: Solicitar convite — deixe vazio para a peça não trazer chamada" />
            <div class="sugg-row" id="g-cta-sugg">${["Solicitar convite", "Ver as condições", "Conhecer a plataforma", "Falar com o time", "Calcular minha economia", "Migrar minha operação", "Acessar o material", "Ver como funciona"].map((c) => `<button type="button" class="sugg-chip" data-cta="${esc(c)}">${esc(c)}</button>`).join("")}</div>
          </div>
          <div class="row">
            <div class="field"><label>Tom (opcional)</label><input id="g-tone" placeholder="ex.: editorial, direto" /></div>
            <div class="field"><label>Oferta/número a destacar</label><input id="g-offer" placeholder="ex.: 0% por 3 meses" /></div>
          </div>
          <div class="field art-only"><label>Estilo visual da arte (opcional) <span class="hint">(para Feed/Carrossel/Imagem — “Automático” varia a cada peça para o feed não ficar monótono)</span></label>
            <select id="g-style"><option value="">Automático (varia por peça)</option><option value="editorial">Editorial — gradiente azul, headline à esquerda</option><option value="bold">Destaque — fundo escuro, número em evidência</option><option value="split">Dividido — faixa clara (logo) + faixa escura</option><option value="photo">Foto — imagem enviada + texto por cima</option></select>
          </div>
          <div class="field" id="g-photo-row" style="display:none">
            <label>Imagem da peça <span class="hint">(enviada por você; entra como fundo da arte “Foto”)</span></label>
            <div class="photo-pick"><label class="btn btn-sm btn-ghost"><input type="file" id="g-photo-file" accept="image/*" hidden /> Enviar imagem</label><span class="hint" id="g-photo-hint"></span></div>
            <div class="photo-gallery" id="g-photo-gallery"></div>
            <input type="hidden" id="g-image" value="" />
          </div>
          <div class="field art-only"><label>Referência visual / clima (opcional) <span class="hint">(clima, estilo ou referência a evocar — sempre dentro da marca)</span></label><textarea id="g-mood" rows="2" placeholder="ex.: editorial sóbrio, foco em prova de número, sensação de exclusividade convidativa"></textarea></div>
          <div class="field"><label>Observações extras (opcional)</label><textarea id="g-extra" rows="2"></textarea></div>
        </details>
          <details class="adv-block">
            <summary>Identificador técnico (avançado)</summary>
            <div class="field"><label>Nome da pasta (identificador) <span class="hint">(derivado do título; só edite se souber o que faz)</span></label><input id="g-task" placeholder="taxa_zero_caption" aria-describedby="e-task" /><div class="field-error" id="e-task" role="alert"></div></div>
          </details>
        </div>

        <div class="form-foot">
          <label class="research-toggle"><input type="checkbox" id="g-research" /> <span>Pesquisar o mercado na internet antes de gerar <span class="hint">(busca tendências e concorrência ao vivo para embasar a peça com fatos atuais — leva alguns segundos a mais)</span></span></label>
          <button class="btn btn-primary btn-block" id="g-run">Gerar com IA</button>
        </div>
      </div>
      <div class="card create-result">
        <div class="flex-between"><h3>Resultado</h3><span id="g-flag"></span></div>
        <div id="g-result"><div class="empty">Descreva a peça e clique em <strong>Gerar com IA</strong>. Sua equipe de IA pesquisa o tema, escreve no tom da 4Selet e confere a identidade da marca.</div></div>
      </div>
    </div>`);

  const campMap = {}; campaigns.forEach((c) => { campMap[c.id] = c; });
  let platsTouched = false;
  let pillarTouched = false;
  const typePlatform = (id) => { const ct = metaType(id); return ct && ct.platform ? ct.platform : null; };
  function renderPlats(selected, inherited) {
    const set = (selected && selected.length) ? selected : ["instagram"];
    $("#g-plats").innerHTML = State.meta.platforms.map((p) => checkPill("gplat", p, set.includes(p), platformLabel(p))).join("");
    bindCheckPills($("#g-plats"));
    $("#g-plats-hint").textContent = inherited ? "(herdadas da campanha — ajuste se quiser)" : "";
  }
  // garante que a plataforma natural do tipo (config.js define .platform) esteja marcada
  function ensureTypePlatform() {
    const p = typePlatform($("#g-type").value);
    if (!p) return;
    const input = $("#g-plats").querySelector('input[value="' + p + '"]');
    if (input && !input.checked) { input.checked = true; const lab = input.closest(".check"); if (lab) lab.classList.add("on"); }
  }
  $("#g-plats").addEventListener("change", () => { platsTouched = true; });
  const preCampObj = preCamp && campMap[preCamp];
  renderPlats(preCampObj ? preCampObj.platforms : (typePlatform(preType) ? [typePlatform(preType)] : ["instagram"]), !!preCampObj);
  ensureTypePlatform();
  $("#g-camp").addEventListener("change", () => {
    const c = campMap[$("#g-camp").value];
    renderPlats(c && c.platforms && c.platforms.length ? c.platforms : ["instagram"], !!c);
    ensureTypePlatform();
    applyCampPillar(c);
  });
  const updDesc = () => { const ct = metaType($("#g-type").value); $("#g-type-desc").textContent = ct ? ct.description : ""; };
  // Esconde os ajustes de ARTE (estilo visual, referência visual) para tipos só-texto (LinkedIn/Threads).
  const updArtFields = () => { const ct = metaType($("#g-type").value); const isImg = !!(ct && ct.media === "image"); $$(".art-only").forEach((el) => { el.style.display = isImg ? "" : "none"; }); };
  $$("#g-type-grid .type-card").forEach((card) => {
    card.onclick = () => {
      $$("#g-type-grid .type-card").forEach((c) => c.classList.remove("on"));
      card.classList.add("on");
      $("#g-type").value = card.dataset.type;
      const p = typePlatform(card.dataset.type);
      // sem campanha e sem edição manual: plataforma vira exatamente a do tipo; senão, só garante a do tipo
      if (p && !platsTouched && !$("#g-camp").value) renderPlats([p], false);
      else ensureTypePlatform();
      updDesc();
      updArtFields();
      updPhotoRow();
    };
  });
  updDesc();
  updArtFields();
  // ---- acervo de imagens (estilo visual "Foto") ----
  const updPhotoRow = () => {
    const ct = metaType($("#g-type").value);
    const show = (($("#g-style") && $("#g-style").value) === "photo") && !!(ct && ct.media === "image");
    const row = $("#g-photo-row"); if (row) row.style.display = show ? "" : "none";
  };
  async function loadPhotoGallery(sel) {
    const g = $("#g-photo-gallery"); if (!g) return;
    let images = [];
    try { images = ((await fetch("/api/uploads").then((x) => x.json())) || {}).images || []; } catch (e) {}
    if (!images.length) { g.innerHTML = '<span class="hint">Nenhuma imagem no acervo ainda — envie a primeira.</span>'; return; }
    g.innerHTML = images.map((im) => `<button type="button" class="photo-thumb${im.url === sel ? " on" : ""}" data-url="${esc(im.url)}" title="${esc(im.name)}"><img src="${esc(im.url)}" alt="" loading="lazy"/></button>`).join("");
    $$("#g-photo-gallery .photo-thumb").forEach((b) => { b.onclick = () => { $("#g-image").value = b.dataset.url; $$("#g-photo-gallery .photo-thumb").forEach((x) => x.classList.toggle("on", x === b)); }; });
  }
  if ($("#g-style")) $("#g-style").addEventListener("change", updPhotoRow);
  if ($("#g-photo-file")) $("#g-photo-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const hint = $("#g-photo-hint"); if (hint) hint.textContent = "enviando…";
    try {
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(f); });
      const r = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, dataUrl }) }).then((x) => x.json());
      if (r && r.url) { $("#g-image").value = r.url; await loadPhotoGallery(r.url); if (hint) hint.textContent = "imagem enviada"; toast("Imagem adicionada ao acervo", "success"); }
      else { if (hint) hint.textContent = "falha no envio"; toast((r && r.error) || "falha no envio", "error"); }
    } catch (err) { if (hint) hint.textContent = "falha no envio"; toast("falha no envio", "error"); }
    e.target.value = "";
  });
  loadPhotoGallery("");
  updPhotoRow();
  const pillarById = (id) => (State.meta.content_pillars || []).find((p) => p.id === id);
  const updPillarDesc = () => { const pp = pillarById($("#g-pillar").value); $("#g-pillar-desc").textContent = pp ? pp.description : "Sem pilar fixo — a IA define o ângulo a partir do tema acima."; };
  // Sugere o pilar de conteúdo a partir da campanha (ex.: campanha "Taxa Zero" -> pilar "Campanha Taxa Zero").
  // Casa por palavra-chave do nome/ângulo/objetivo; o usuário pode sobrescrever a qualquer momento.
  const suggestPillarFromCamp = (c) => {
    if (!c) return "";
    const hay = ((c.name || "") + " " + (c.angle || "") + " " + (c.objective || "")).toLowerCase();
    for (const p of (State.meta.content_pillars || [])) {
      const kw = String(p.short || p.label || "").toLowerCase().trim();
      if (kw && hay.indexOf(kw) !== -1) return p.id;
    }
    return /taxa\s*zero/.test(hay) ? "taxa_zero" : "";
  };
  const applyCampPillar = (c) => {
    if (!c || pillarTouched) return;
    const pid = suggestPillarFromCamp(c);
    const sel = $("#g-pillar");
    if (pid && sel && sel.value !== pid) { sel.value = pid; updPillarDesc(); }
  };
  if ($("#g-pillar")) {
    $("#g-pillar").addEventListener("change", () => { pillarTouched = true; updPillarDesc(); });
    updPillarDesc();
  }
  if (preCampObj && !prePillar) applyCampPillar(preCampObj);
  $("#g-title").addEventListener("input", (e) => {
    if (e && e.isTrusted) $("#g-title").dataset.touched = "1"; // editou à mão → para de auto-sugerir
    if ($("#g-task").value === "" || $("#g-task").dataset.auto) { $("#g-task").value = slugify($("#g-title").value).slice(0, 40); $("#g-task").dataset.auto = "1"; }
  });
  $("#g-task").addEventListener("input", () => { delete $("#g-task").dataset.auto; });
  const briefCount = () => {
    const el = $("#g-brief-count"); if (!el) return;
    const n = $("#g-brief").value.trim().length;
    el.textContent = n === 0 ? "" : (n < 8 ? n + " caracteres — descreva um pouco mais" : n + " caracteres");
  };
  // Enquanto o título não foi tocado, sugere um a partir do tema (e re-deriva o slug).
  const suggestTitle = () => {
    const t = $("#g-title"); if (!t || t.dataset.touched) return;
    t.value = suggestTitleFromBrief($("#g-brief").value);
    if ($("#g-task").value === "" || $("#g-task").dataset.auto) { $("#g-task").value = slugify(t.value).slice(0, 40); $("#g-task").dataset.auto = "1"; }
  };
  $("#g-brief").addEventListener("input", () => { briefCount(); suggestTitle(); }); briefCount();
  const ctaChipSync = () => {
    const v = ($("#g-cta") && $("#g-cta").value.trim()) || "";
    $$("#g-cta-sugg .sugg-chip").forEach((b) => b.classList.toggle("on", b.dataset.cta === v));
  };
  $$("#g-cta-sugg .sugg-chip").forEach((b) => {
    b.onclick = () => { const inp = $("#g-cta"); inp.value = (inp.value.trim() === b.dataset.cta) ? "" : b.dataset.cta; ctaChipSync(); inp.focus(); };
  });
  if ($("#g-cta")) $("#g-cta").addEventListener("input", ctaChipSync);

  $("#g-run").onclick = runGenerate;
}

// Mostra as etapas da "equipe" enquanto a IA trabalha. Avança no tempo (o
// backend faz tudo numa chamada) só para dar a sensação de bastidores em ação.
function startGenProgress(host, research) {
  if (!host) return null;
  const steps = [
    research ? "Pesquisando o tema no mercado" : "Estudando o tema e o público",
    "Escrevendo no tom da 4Selet",
    "Aplicando a identidade da marca",
    "Conferência final da marca",
  ];
  host.innerHTML = `
    <div class="gen-progress" role="status" aria-live="polite">
      <div class="gp-head"><span class="spinner"></span> <strong>Sua equipe de marketing está montando a peça…</strong></div>
      <ol class="gp-steps">${steps.map((s, i) => `<li class="gp-step${i === 0 ? " on" : ""}"><span class="gp-dot"></span><span class="gp-txt">${esc(s)}</span></li>`).join("")}</ol>
      <p class="muted gp-note">Pesquisa, redação e checagem de marca acontecem nos bastidores.</p>
    </div>`;
  const lis = $$(".gp-step", host);
  let i = 0;
  const timer = setInterval(() => {
    if (i >= lis.length - 1) return;
    lis[i].classList.replace("on", "done");
    i++; lis[i].classList.add("on");
  }, 1100);
  return timer;
}

// Lê a orientação de CTA do brief avançado: "" / select aprovado / "Outra…" (texto livre).
// undefined = sem CTA forçado (padrão).
function ctaDirective() {
  const inp = $("#g-cta"); if (!inp) return undefined;
  return inp.value.trim() || undefined;
}
async function runGenerate() {
  const brief = $("#g-brief").value.trim();
  $("#e-brief").textContent = ""; $("#g-brief").classList.remove("invalid"); $("#g-brief").removeAttribute("aria-invalid");
  if (brief.length < 8) { $("#g-brief").classList.add("invalid"); $("#g-brief").setAttribute("aria-invalid", "true"); $("#e-brief").textContent = "Descreva o tema (mín. 8 caracteres)."; return; }
  const payload = {
    content_type: $("#g-type").value,
    brief,
    campaign_id: $("#g-camp").value || undefined,
    platforms: collectChecks($("#view"), "gplat"),
    tone: $("#g-tone").value.trim() || undefined,
    key_offer: $("#g-offer").value.trim() || undefined,
    mood: ($("#g-mood") && $("#g-mood").value.trim()) || undefined,
    extra: $("#g-extra").value.trim() || undefined,
    research: ($("#g-research") && $("#g-research").checked) || undefined,
    template_variant: ($("#g-style") && $("#g-style").value) || undefined,
    pillar: ($("#g-pillar") && $("#g-pillar").value) || undefined,
    cta: ctaDirective(),
    image: ((($("#g-style") && $("#g-style").value) === "photo") && $("#g-image") && $("#g-image").value) ? $("#g-image").value : undefined,
  };
  const btn = $("#g-run"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> gerando…';
  const prog = startGenProgress($("#g-result"), !!payload.research);
  try {
    const r = await API.generate(payload);
    clearInterval(prog);
    LAST_GEN = { req: payload, res: r };
    renderGenResult(r);
  } catch (e) {
    clearInterval(prog);
    $("#g-result").innerHTML = '<div class="empty">Não foi possível gerar agora. Ajuste a descrição e clique em <strong>Gerar com IA</strong> de novo.</div>';
    toastAiError(e);
  }
  finally { btn.disabled = false; btn.textContent = "Gerar com IA"; }
}

function renderGenResult(r) {
  $("#g-flag").innerHTML = r.simulated ? '<span class="sim-flag">SIMULADO</span>' : '<span class="badge plain">' + esc(r.model) + "</span>";
  if (r.research_requested) {
    $("#g-flag").innerHTML += r.research_used
      ? ' <span class="badge ok" title="Pesquisa de mercado ao vivo usada como apoio na geração">▸ Tavily: ' + ((r.research_sources || []).length) + " fontes</span>"
      : ' <span class="badge warn" title="Tavily não retornou dados — geração seguiu sem pesquisa">▸ Tavily indisponível</span>';
  }
  const researchHtml = (r.research_used && (r.research_sources || []).length)
    ? `<details class="research-box mt"><summary>Fontes da pesquisa Tavily (${r.research_sources.length})</summary>
         <ul class="research-list">${r.research_sources.map((s) => `<li><span class="research-focus">${esc(s.focus)}</span> <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a></li>`).join("")}</ul>
         <p class="muted" style="font-size:12px">Usadas como apoio factual; o conteúdo final segue as regras e o conhecimento da marca.</p>
       </details>`
    : "";
  const ct = metaType(r.content_type);
  let editorVal;
  if (ct.format === "json") editorVal = JSON.stringify(r.parsed || {}, null, 2);
  else editorVal = composeText(r.parsed, r.raw);
  const gov = r.governance || { errors: [], warnings: [] };
  const structHtml = ct.format === "json" ? structuredEditor(r.content_type, r.parsed) : null;
  const editorBlock = structHtml
    ? `<div class="field mt"><label>Conteúdo (editável por ${r.content_type === "video_idea" ? "cena" : (r.content_type === "instagram_carousel" ? "slide" : "campo")})</label>${structHtml}</div>
       <details class="json-adv mt"><summary>JSON (avançado)</summary>
         <textarea id="g-edit" rows="12" style="font-family:var(--mono)">${esc(editorVal)}</textarea>
         <p class="muted" style="font-size:12px;margin-top:6px">Atualizado automaticamente pelos campos acima. Para editar à mão, altere o JSON e clique em “Aplicar JSON”.</p>
         <button class="btn btn-ghost btn-sm" id="g-json-apply" type="button">Aplicar JSON aos campos</button>
       </details>`
    : `<div class="field mt"><label>Conteúdo (editável)</label><textarea id="g-edit" rows="${ct.format === "json" ? 16 : 8}" style="font-family:${ct.format === "json" ? "var(--mono)" : "var(--font)"}">${esc(editorVal)}</textarea></div>`;
  // #2 — pré-visualização ao vivo (mockup do card da rede) para LinkedIn e Threads/X.
  const mockKind = r.content_type === "linkedin_post" ? "linkedin" : (r.content_type === "threads_post" ? "threads" : null);
  const mockHtml = mockKind
    ? `<details class="social-mock-box mt" open><summary>Pré-visualização do post (${mockKind === "linkedin" ? "LinkedIn" : "Threads / X"})</summary>
         <div id="g-mock" class="social-mock">${socialMock(mockKind, editorVal)}</div>
         <p class="muted" style="font-size:12px">Prévia ilustrativa — atualiza conforme você edita o texto acima.</p>
       </details>`
    : "";
  // #1 — prévia RENDERIZADA da arte (imagem final) para tipos visuais.
  const visualKind = ct.kind === "feed" || ct.kind === "image" || ct.kind === "carousel";
  const artHtml = visualKind
    ? `<details class="art-preview-box mt" open><summary>Prévia da arte</summary>
         <p class="muted" style="font-size:12px;margin:8px 0">Renderiza a imagem final ${ct.kind === "carousel" ? "(slide de capa) " : ""}com o estilo visual escolhido nos ajustes. Não salva nada — confira e baixe a imagem se quiser (rascunho rápido).</p>
         <button class="btn btn-ghost btn-sm" id="g-art-btn" type="button">Ver prévia da arte</button>
         <div id="g-art" class="art-preview mt"></div>
       </details>`
    : "";
  $("#g-result").innerHTML = `
    ${researchHtml}
    ${editorBlock}
    ${mockHtml}
    ${artHtml}
    <div class="gov-head">Conferência da marca <span class="hint">(checagem automática das regras da 4Selet)</span></div>
    <div class="gov" id="g-gov">${govHtml(gov)}</div>
    <div class="refine-box mt">
      <label>Ajustar com IA <span class="hint">(descreva o que mudar; o resto é mantido)</span></label>
      <textarea id="g-refine" rows="2" placeholder="ex.: encurte o headline e troque o CTA por Solicitar convite"></textarea>
      <button class="btn btn-sm mt" id="g-refine-btn">Aplicar ajuste</button>
    </div>
    <div class="flex mt"><button class="btn btn-primary" id="g-save">Salvar na campanha</button><button class="btn btn-ghost" id="g-regen">Gerar de novo</button></div>`;
  $("#g-regen").onclick = runGenerate;
  $("#g-save").onclick = saveGenerated;
  $("#g-refine-btn").onclick = refineGenerated;
  if (structHtml) {
    bindStructuredEditor();
    if ($("#g-json-apply")) $("#g-json-apply").onclick = () => applyJsonToStructured(r.content_type);
  }
  // #2 — liga o mockup ao vivo ao textarea de conteúdo.
  if (mockKind && $("#g-edit")) {
    $("#g-edit").addEventListener("input", () => { const m = $("#g-mock"); if (m) m.innerHTML = socialMock(mockKind, $("#g-edit").value); });
  }
  // #1 — botão de prévia renderizada da arte.
  if (visualKind && $("#g-art-btn")) $("#g-art-btn").onclick = () => renderArtPreview(r.content_type, ct.kind);
}

// #1 — renderiza a arte final (sem salvar) a partir do conteúdo atual em tela.
async function renderArtPreview(contentType, kind) {
  const btn = $("#g-art-btn"); const box = $("#g-art");
  if (!btn || !box) return;
  const ct = metaType(contentType);
  let parsed = LAST_GEN && LAST_GEN.res ? LAST_GEN.res.parsed : null;
  const ed = $("#g-edit");
  if (ed) {
    if (ct && ct.format === "json") { try { parsed = JSON.parse(ed.value); } catch (e) { /* mantém o último parsed válido */ } }
    else parsed = { body: ed.value };
  }
  // Template: estilo escolhido no brief; se "Automático", a mesma variação por slug usada no salvamento.
  let template = (LAST_GEN && LAST_GEN.req && LAST_GEN.req.template_variant) || ($("#g-style") && $("#g-style").value) || "";
  if (!template) {
    const task = ($("#g-task") && $("#g-task").value) || slugify(($("#g-title") && $("#g-title").value) || "");
    const date = ($("#g-date") && $("#g-date").value) || todayISO();
    template = autoVariant(task + "_" + date);
  }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> renderizando…';
  box.innerHTML = "";
  try {
    const out = await API.renderPreview({ content_type: contentType, parsed, template });
    const fname = ((slugify(($("#g-title") && $("#g-title").value) || "") || "previa-4selet").slice(0, 40)) + ".png";
    box.innerHTML = `<img class="art-img" src="${out.dataUrl}" alt="Prévia da arte" />
      <div class="flex flex-between mt" style="align-items:center;gap:10px;flex-wrap:wrap">
        <span class="muted" style="font-size:12px">Estilo: <strong>${esc(out.template)}</strong> · ${out.width}×${out.height}${kind === "carousel" ? " · slide de capa" : ""}</span>
        <a class="btn btn-sm btn-ghost" href="${out.dataUrl}" download="${esc(fname)}">Baixar imagem</a>
      </div>`;
  } catch (e) {
    box.innerHTML = `<div class="field-error" style="display:block">${esc((e && e.message) || "falha ao renderizar a prévia")}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = "Atualizar prévia da arte";
  }
}

// #2 — gera o HTML do mockup de post social a partir do texto atual.
function socialMock(kind, text) {
  const raw = String(text || "").trim();
  const tags = (raw.match(/#[\p{L}0-9_]+/gu) || []);
  const body = raw.replace(/\s*#[\p{L}0-9_]+/gu, "").trim() || "—";
  const bodyHtml = esc(body).replace(/\n/g, "<br>");
  const tagsHtml = tags.length ? `<div class="sm-tags">${tags.map((t) => '<span class="sm-tag">' + esc(t) + "</span>").join(" ")}</div>` : "";
  if (kind === "threads") {
    return `<div class="sm-card sm-threads">
      <div class="sm-head"><span class="sm-avatar">4S</span><div class="sm-id"><span class="sm-name">4selet</span><span class="sm-handle">@4selet · agora</span></div></div>
      <div class="sm-body">${bodyHtml}</div>${tagsHtml}
      <div class="sm-actions"><span>♡</span><span>↺</span><span>↪</span></div>
    </div>`;
  }
  return `<div class="sm-card sm-linkedin">
    <div class="sm-head"><span class="sm-avatar">4S</span><div class="sm-id"><span class="sm-name">4Selet</span><span class="sm-handle">Plataforma de pagamentos · Patrocinado</span></div></div>
    <div class="sm-body">${bodyHtml}</div>${tagsHtml}
    <div class="sm-actions"><span>♡ Gostei</span><span>↺ Comentar</span><span>↪ Compartilhar</span></div>
  </div>`;
}

async function refineGenerated() {
  if (!LAST_GEN) return;
  const instruction = $("#g-refine").value.trim();
  if (instruction.length < 3) { toast("Escreva a orientação do ajuste.", "error"); return; }
  const current = $("#g-edit").value;
  const payload = {
    content_type: LAST_GEN.req.content_type,
    current,
    instruction,
    campaign_id: LAST_GEN.req.campaign_id || undefined,
    pillar: LAST_GEN.req.pillar || undefined,
  };
  const btn = $("#g-refine-btn"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ajustando…';
  try {
    const r = await API.refine(payload);
    LAST_GEN.res = Object.assign({}, LAST_GEN.res, {
      parsed: r.parsed, raw: r.raw, governance: r.governance,
      simulated: r.simulated, model: r.model, content_type: r.content_type,
    });
    renderGenResult(LAST_GEN.res);
    toast(r.simulated ? "Ajuste simulado (configure a chave para usar a IA real)" : "Ajuste aplicado", r.simulated ? "warn" : "success");
  } catch (e) {
    toastAiError(e);
    btn.disabled = false; btn.textContent = "Aplicar ajuste";
  }
}

function composeText(parsed, raw) {
  if (parsed && typeof parsed.body === "string") {
    let t = parsed.body;
    if (Array.isArray(parsed.hashtags) && parsed.hashtags.length) t += "\n\n" + parsed.hashtags.join(" ");
    return t;
  }
  return raw || "";
}
function structuredPreview(type, p) {
  if (!p) return "";
  if (type === "instagram_carousel" && Array.isArray(p.slides)) {
    return '<div class="gen-out">' + p.slides.map((s, i) => `<div class="slide-card"><div class="sc-title">Slide ${i + 1}: ${esc(s.title || "")}</div><div class="sc-body">${esc(s.body || "")}</div></div>`).join("") + "</div>";
  }
  if (type === "ad_creative") {
    return `<div class="gen-out"><div class="slide-card"><div class="sc-title">${esc(p.headline || "")}</div><div class="sc-body">${esc(p.subtext || "")}</div><div class="muted mt">CTA: ${esc(p.cta || "")} · ${esc(p.layout_type || "")}</div></div></div>`;
  }
  if (type === "video_idea" && Array.isArray(p.scenes)) {
    return '<div class="gen-out">' + `<div class="slide-card"><div class="sc-title">${esc(p.concept || "")}</div><div class="sc-body">Hook: ${esc(p.hook || "")}</div></div>` +
      p.scenes.map((s, i) => `<div class="slide-card"><div class="sc-title">Cena ${i + 1} · ${esc(s.type || "")}</div><div class="sc-body">${esc(s.text || "")} <span class="dim">— ${esc(s.visual || "")}</span></div></div>`).join("") + "</div>";
  }
  return "";
}
// ---- Editor estruturado (slides do carrossel / cenas do vídeo / anúncio) ----
// Substitui o JSON cru por campos editáveis. Mantém o textarea #g-edit (oculto
// em "JSON avançado") sempre sincronizado, então salvar/refinar seguem iguais.
// Preserva campos não expostos (caption, hashtags, visual_style...) via STRUCT_BASE.
let STRUCT_BASE = {};

function structuredEditor(type, p) {
  STRUCT_BASE = (p && typeof p === "object") ? p : {};
  if (type === "instagram_carousel") return carouselEditor(p || {});
  if (type === "video_idea") return videoEditor(p || {});
  if (type === "ad_creative") return adEditor(p || {});
  return null; // tipos sem editor estruturado caem no textarea cru
}

function seCtrls(i, total) {
  return `<button class="se-mini" data-se="up" title="Mover para cima" aria-label="Mover para cima"${i === 0 ? " disabled" : ""}>↑</button>` +
    `<button class="se-mini" data-se="down" title="Mover para baixo" aria-label="Mover para baixo"${i === total - 1 ? " disabled" : ""}>↓</button>` +
    `<button class="se-mini se-del" data-se="del" title="Remover" aria-label="Remover"${total <= 1 ? " disabled" : ""}>✕</button>`;
}

const SLIDE_LAYOUTS = [["", "Automático"], ["cover", "Capa"], ["stat_grid", "Grade de números"], ["list", "Lista"], ["text", "Texto"], ["cta", "CTA"]];
function slideItem(s, i, total) {
  // Preserva campos não editáveis aqui (items, stats) para não perdê-los no
  // sync do JSON. O layout é exposto no seletor abaixo.
  const extra = {};
  Object.keys(s || {}).forEach((k) => { if (k !== "title" && k !== "body" && k !== "layout") extra[k] = s[k]; });
  const extraAttr = Object.keys(extra).length ? ` data-extra="${esc(JSON.stringify(extra)).replace(/"/g, "&quot;")}"` : "";
  const cur = String(s.layout || "");
  const layoutOpts = SLIDE_LAYOUTS.map(([v, l]) => `<option value="${v}"${v === cur ? " selected" : ""}>${l}</option>`).join("");
  const richHint = (Array.isArray(s.stats) && s.stats.length) ? '<span class="se-rich">grade: ' + s.stats.length + ' números (edite no JSON)</span>'
    : ((Array.isArray(s.items) && s.items.length) ? '<span class="se-rich">lista: ' + s.items.length + ' itens (edite no JSON)</span>' : "");
  return `<div class="se-item" data-i="${i}"${extraAttr}>
    <div class="se-head"><span class="se-n">Slide ${i + 1}</span><div class="se-ctrls">${seCtrls(i, total)}</div></div>
    <input class="se-f" data-k="title" placeholder="Título do slide" value="${esc(s.title || "")}" />
    <textarea class="se-f" data-k="body" rows="2" placeholder="Texto do slide">${esc(s.body || "")}</textarea>
    <label class="se-layout">Layout do slide <select class="se-f" data-k="layout">${layoutOpts}</select>${richHint}</label>
  </div>`;
}
function carouselEditor(p) {
  const slides = (Array.isArray(p.slides) && p.slides.length) ? p.slides : [{ title: "", body: "" }];
  return `<div class="struct-ed" data-type="instagram_carousel">
    <div class="se-list">${slides.map((s, i) => slideItem(s, i, slides.length)).join("")}</div>
    <button class="btn btn-ghost btn-sm mt" data-se-add="slide" type="button">+ Adicionar slide</button>
    <div class="field mt"><label>CTA</label><input class="se-cta" placeholder="ex.: Solicitar convite" value="${esc(p.cta || "")}" /></div>
  </div>`;
}

function sceneItem(s, i, total) {
  return `<div class="se-item" data-i="${i}">
    <div class="se-head"><span class="se-n">Cena ${i + 1}</span><div class="se-ctrls">${seCtrls(i, total)}</div></div>
    <input class="se-f se-type" data-k="type" list="se-types" placeholder="tipo (hook, product, benefit, cta)" value="${esc(s.type || "")}" />
    <textarea class="se-f" data-k="text" rows="2" placeholder="Texto que aparece na tela (título da cena)">${esc(s.text || "")}</textarea>
    <input class="se-f" data-k="subtitle" placeholder="Subtexto (segunda linha, opcional)" value="${esc(s.subtitle || "")}" />
    <textarea class="se-f se-dim" data-k="visual" rows="2" placeholder="Direção de arte (não aparece na tela)">${esc(s.visual || "")}</textarea>
  </div>`;
}
function videoEditor(p) {
  const scenes = (Array.isArray(p.scenes) && p.scenes.length) ? p.scenes : [{ type: "hook", text: "", subtitle: "", visual: "" }];
  return `<div class="struct-ed" data-type="video_idea">
    <datalist id="se-types"><option value="hook"></option><option value="product"></option><option value="benefit"></option><option value="cta"></option></datalist>
    <div class="field"><label>Conceito</label><input class="se-concept" placeholder="Ideia central do vídeo" value="${esc(p.concept || "")}" /></div>
    <div class="se-list">${scenes.map((s, i) => sceneItem(s, i, scenes.length)).join("")}</div>
    <button class="btn btn-ghost btn-sm mt" data-se-add="scene" type="button">+ Adicionar cena</button>
    <div class="field mt"><label>CTA</label><input class="se-cta" placeholder="ex.: Conhecer a plataforma" value="${esc(p.cta || "")}" /></div>
  </div>`;
}

function adEditor(p) {
  const f = (k, label, ph) => `<div class="field mt"><label>${label}</label><input class="se-f" data-k="${k}" placeholder="${ph}" value="${esc(p[k] || "")}" /></div>`;
  return `<div class="struct-ed" data-type="ad_creative">
    ${f("headline", "Headline", "máx. 4 palavras")}
    ${f("subtext", "Subtexto", "linha de apoio")}
    ${f("cta", "CTA", "ex.: Ver as condições")}
    ${f("layout_type", "Layout", "Product Focus, Split, Lifestyle…")}
  </div>`;
}

// Lê o editor estruturado e devolve o objeto parsed (mesclado em STRUCT_BASE).
function structToParsed() {
  const ed = document.querySelector(".struct-ed");
  if (!ed) return null;
  const base = JSON.parse(JSON.stringify(STRUCT_BASE || {}));
  const type = ed.dataset.type;
  const items = [...ed.querySelectorAll(".se-item")];
  const val = (it, k) => { const el = it.querySelector('[data-k="' + k + '"]'); return el ? el.value : ""; };
  if (type === "instagram_carousel") {
    base.slides = items.map((it) => {
      let extra = {};
      if (it.dataset.extra) { try { extra = JSON.parse(it.dataset.extra); } catch (e) { extra = {}; } }
      const slide = Object.assign({}, extra, { title: val(it, "title"), body: val(it, "body") });
      const layout = val(it, "layout");
      if (layout) slide.layout = layout; else delete slide.layout;
      return slide;
    });
    base.cta = (ed.querySelector(".se-cta") || {}).value || "";
  } else if (type === "video_idea") {
    base.concept = (ed.querySelector(".se-concept") || {}).value || "";
    base.scenes = items.map((it) => ({ type: val(it, "type"), text: val(it, "text"), subtitle: val(it, "subtitle"), visual: val(it, "visual") }));
    base.cta = (ed.querySelector(".se-cta") || {}).value || "";
  } else if (type === "ad_creative") {
    ["headline", "subtext", "cta", "layout_type"].forEach((k) => {
      const el = ed.querySelector('[data-k="' + k + '"]'); if (el) base[k] = el.value;
    });
  }
  return base;
}
function syncJsonMirror() {
  const parsed = structToParsed();
  if (parsed && $("#g-edit")) $("#g-edit").value = JSON.stringify(parsed, null, 2);
}
function seRenumber(ed) {
  const scene = ed.dataset.type === "video_idea";
  const items = [...ed.querySelectorAll(".se-item")];
  items.forEach((it, i) => {
    const n = it.querySelector(".se-n"); if (n) n.textContent = (scene ? "Cena " : "Slide ") + (i + 1);
    const up = it.querySelector('[data-se="up"]'); if (up) up.disabled = i === 0;
    const dn = it.querySelector('[data-se="down"]'); if (dn) dn.disabled = i === items.length - 1;
    const del = it.querySelector('[data-se="del"]'); if (del) del.disabled = items.length <= 1;
    it.dataset.i = i;
  });
}
function bindStructuredEditor() {
  const ed = document.querySelector(".struct-ed");
  if (!ed) return;
  ed.addEventListener("input", syncJsonMirror);
  ed.addEventListener("click", (e) => {
    const add = e.target.closest("[data-se-add]");
    const ctl = e.target.closest("[data-se]");
    if (add) {
      e.preventDefault();
      const list = ed.querySelector(".se-list");
      const tmp = document.createElement("div");
      tmp.innerHTML = add.dataset.seAdd === "slide"
        ? slideItem({ title: "", body: "" }, list.children.length, list.children.length + 1)
        : sceneItem({ type: "benefit", text: "", subtitle: "", visual: "" }, list.children.length, list.children.length + 1);
      list.appendChild(tmp.firstElementChild);
      seRenumber(ed); syncJsonMirror();
    } else if (ctl) {
      e.preventDefault();
      const item = ctl.closest(".se-item"); const list = item.parentElement; const act = ctl.dataset.se;
      if (act === "del") { if (list.children.length > 1) item.remove(); }
      else if (act === "up") { const prev = item.previousElementSibling; if (prev) list.insertBefore(item, prev); }
      else if (act === "down") { const next = item.nextElementSibling; if (next) list.insertBefore(next, item); }
      seRenumber(ed); syncJsonMirror();
    }
  });
  syncJsonMirror();
}
function applyJsonToStructured(type) {
  try {
    const obj = JSON.parse($("#g-edit").value);
    const host = document.querySelector(".struct-ed");
    const html = structuredEditor(type, obj);
    if (host && html) { host.outerHTML = html; bindStructuredEditor(); toast("JSON aplicado aos campos", "success"); }
  } catch (e) { toast("JSON inválido: " + e.message, "error"); }
}

function govHtml(gov) {
  if (!gov.errors.length && !gov.warnings.length) return '<div class="gov-item ok">✓ Passou na checagem da marca (sem problemas).</div>';
  return gov.errors.map((e) => '<div class="gov-item err">✕ ' + esc(e) + "</div>").join("") +
    gov.warnings.map((w) => '<div class="gov-item warn">⚠ ' + esc(w) + "</div>").join("");
}

// #1 — Banner de sucesso destacado com CTA principal e auto-redirecionamento.
function showSaveBanner(folder) {
  const host = $("#g-result");
  if (!host) return;
  const url = "#/task/" + encodeURIComponent(folder);
  const old = host.querySelector(".save-banner"); if (old) old.remove();
  const el = document.createElement("div");
  el.className = "save-banner mb";
  el.innerHTML = `<div class="save-banner-main"><span class="save-banner-ico">✓</span>
      <div><strong>Peça salva com sucesso.</strong><div class="muted">Redirecionando para aprovação em <span class="save-count">3</span>s…</div></div></div>
    <div class="save-banner-actions"><button class="btn btn-ghost btn-sm" data-sb="new">Criar novo conteúdo</button>
      <button class="btn btn-ghost btn-sm" data-sb="stay">Ficar aqui</button>
      <a class="btn btn-primary" href="${url}">Abrir peça →</a></div>`;
  host.insertAdjacentElement("afterbegin", el);
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  let n = 3; let cancelled = false;
  const countEl = el.querySelector(".save-count");
  const stop = () => { cancelled = true; clearInterval(timer); const sub = el.querySelector(".muted"); if (sub) sub.textContent = "Use o botão para abrir quando quiser."; };
  el.querySelector('[data-sb="stay"]').onclick = stop;
  // #1 — "Criar novo conteúdo": cancela o redirect e recarrega o formulário limpo.
  el.querySelector('[data-sb="new"]').onclick = () => { stop(); LAST_GEN = null; viewCreate(null, {}); };
  const timer = setInterval(() => {
    if (cancelled) return;
    n -= 1;
    if (countEl) countEl.textContent = String(Math.max(n, 0));
    if (n <= 0) { clearInterval(timer); if (!cancelled) location.hash = url; }
  }, 1000);
}

async function saveGenerated() {
  if (!LAST_GEN) return;
  const title = ($("#g-title") && $("#g-title").value.trim()) || "";
  let task = $("#g-task").value.trim();
  const date = $("#g-date").value;
  if ($("#e-title")) $("#e-title").textContent = "";
  if ($("#g-title")) $("#g-title").removeAttribute("aria-invalid");
  $("#e-task").textContent = ""; $("#g-task").removeAttribute("aria-invalid");
  if (title.length < 3) { if ($("#g-title")) { $("#g-title").classList.add("invalid"); $("#g-title").setAttribute("aria-invalid", "true"); } if ($("#e-title")) $("#e-title").textContent = "Dê um título à peça (mín. 3 caracteres)."; return; }
  if (!task) task = slugify(title).slice(0, 40);
  if (!/^[a-z0-9][a-z0-9_\-]*$/.test(task)) { $("#g-task").classList.add("invalid"); $("#g-task").setAttribute("aria-invalid", "true"); $("#e-task").textContent = "Identificador inválido (use só a-z, 0-9, _ ou -)."; return; }
  if (!date) { toast("Informe a data.", "error"); return; }
  const ct = metaType(LAST_GEN.req.content_type);
  const editVal = $("#g-edit").value;
  let parsed = null, raw = editVal;
  if (ct.format === "json") { try { parsed = JSON.parse(editVal); } catch (e) { toast("JSON inválido no editor: " + e.message, "error"); return; } }
  const payload = Object.assign({}, LAST_GEN.req, { task_name: task, title, task_date: date, parsed, raw });
  const btn = $("#g-save"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> salvando…';
  let saved = false;
  try {
    const r = await API.save(payload);
    $("#g-gov").innerHTML = govHtml(r.governance);
    toast("Conteúdo salvo com sucesso", "success");
    saved = true;
    // #1 — trava o botão após sucesso (evita salvar/duplicar de novo) e mostra "✓ Salvo".
    btn.disabled = true; btn.textContent = "✓ Salvo";
    const regen = $("#g-regen"); if (regen) regen.style.display = "none";
    showSaveBanner(r.folder);
  } catch (e) {
    if (e.status === 422 && e.data && e.data.governance) { $("#g-gov").innerHTML = govHtml(e.data.governance); toast("Bloqueado por regra de marca — corrija o conteúdo.", "error"); }
    else if (e.data && e.data.errors) { e.data.errors.forEach((x) => toast(x, "error")); }
    else toast(e.message, "error");
  } finally { if (!saved) { btn.disabled = false; btn.textContent = "Salvar na campanha"; } }
}

/* =====================================================================
   CONFIGURAÇÕES
   ===================================================================== */
async function viewSettings() {
  setTitle("Configurações");
  const s = await API.settings();
  State.settings = s;
  let integ = [];
  try { const ri = await API.integrations(); integ = (ri && ri.integrations) || []; } catch (e) { integ = []; }
  const models = [
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 (equilíbrio — recomendado)" },
    { id: "claude-opus-4-7", label: "Opus 4.7 (máxima qualidade)" },
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (rápido/econômico)" },
  ];
  const tagCounts = {};
  try { (((await API.content().catch(() => ({}))).tasks) || []).forEach((t) => (t.tags || []).forEach((tg) => { tagCounts[tg] = (tagCounts[tg] || 0) + 1; })); } catch (e) {}
  const tagNames = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b));
  const tagRows = tagNames.length
    ? tagNames.map((tg) => `<div class="tagman-row"><span class="cc-tag">${esc(tg)}</span><span class="hint">${plural(tagCounts[tg], "peça", "peças")}</span><button class="btn btn-sm btn-danger" data-deltag="${esc(tg)}">Excluir</button></div>`).join("")
    : '<p class="muted">Nenhuma tag criada ainda.</p>';
  setView(`
    <div class="card" style="max-width:660px">
      <h3>Inteligência Artificial (Claude)</h3>
      <p class="muted mt">Cole sua chave da Anthropic. Ela fica guardada só neste servidor (no arquivo <span class="codeblock">interface/.env</span>, fora do controle de versão) e nunca é enviada para o navegador.</p>
      <div class="field mt"><label>Chave Anthropic (ANTHROPIC_API_KEY)</label>
        ${s.has_key ? `
        <div id="s-key-locked" class="key-locked">
          <svg class="key-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span class="key-mask">${esc(s.masked_key)}</span>
          <span class="badge ok">Ativa</span>
          <button class="btn btn-sm btn-ghost" id="s-change-key" type="button">Trocar chave</button>
        </div>
        <div id="s-key-edit" class="key-edit mt" style="display:none">
          <input id="s-key" type="password" placeholder="Cole a nova chave aqui..." />
          <div class="flex mt"><button class="btn btn-primary" id="s-save-key" disabled>Salvar nova chave</button><button class="btn btn-ghost" id="s-cancel-key" type="button">Cancelar</button></div>
        </div>` : `
        <div class="key-edit">
          <p class="muted" style="margin:0 0 8px">Nenhuma chave configurada — adicione sua chave Anthropic para ativar a IA.</p>
          <input id="s-key" type="password" placeholder="sk-ant-..." />
          <div class="flex mt"><button class="btn btn-primary" id="s-save-key" disabled>Salvar chave</button></div>
        </div>`}
      </div>
      <div class="flex"><button class="btn" id="s-test">Testar conexão</button><span id="s-test-out" class="muted"></span></div>
      <hr class="sep" />
      <div class="field"><label>Modelo</label><select id="s-model">${models.map((m) => `<option value="${m.id}" ${s.model === m.id ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select></div>
      <button class="btn" id="s-save-model">Salvar modelo</button>
      <hr class="sep" />
      <div class="kv">
        <div class="k">Status</div><div>${s.has_key ? '<span class="badge approved">conectada</span>' : '<span class="badge paused">não configurada</span>'}</div>
        <div class="k">Modelo atual</div><div>${esc(s.model)}</div>
      </div>
    </div>
    <div class="card mt" style="max-width:660px">
      <h3>Integrações</h3>
      <p class="muted mt">Situação de cada serviço externo conectado ao painel. As chaves ficam guardadas no servidor (no arquivo <span class="codeblock">interface/.env</span>, fora do controle de versão) — esta tela mostra apenas se estão configuradas, nunca os valores.</p>
      <ul class="integ-list mt">
        ${integ.map((it) => {
          const ok = !!it.configured;
          const badge = ok
            ? '<span class="badge ok">conectado</span>'
            : (it.required ? '<span class="badge warn">obrigatório</span>' : '<span class="badge paused">não configurado</span>');
          return `<li class="integ-row">
            <span class="integ-dot ${ok ? "on" : (it.required ? "req" : "off")}"></span>
            <div class="integ-main">
              <div class="integ-name">${esc(it.name)} ${badge}${it.required ? ' <span class="hint">essencial</span>' : ' <span class="hint">opcional</span>'}</div>
              <div class="integ-purpose">${esc(it.purpose || "")}</div>
              <div class="integ-detail">${esc(it.detail || "")}</div>
            </div>
          </li>`;
        }).join("")}
      </ul>
    </div>
    <div class="card mt" style="max-width:660px">
      <h3>Aparência</h3>
      <p class="muted mt">Cor de destaque da interface (preferência local, só do seu navegador). Não altera as cores das peças geradas — a marca permanece travada.</p>
      <div class="field mt"><label>Cor de destaque</label>
        <div class="accent-grid" id="accent-grid">${Object.keys(ACCENT_PRESETS).map((id) => {
          const p = ACCENT_PRESETS[id];
          const sw = p.swatch ? '<span class="accent-sw" style="background:' + p.swatch + '"></span>' : '<span class="accent-sw accent-sw-auto"></span>';
          return '<button type="button" class="accent-opt" data-accent-id="' + id + '">' + sw + '<span>' + esc(p.label) + "</span></button>";
        }).join("")}</div>
      </div>
      <div class="field mt"><label>Esquema de cores <span class="hint">(tons de fundo e superfície — vale para o modo claro e o escuro)</span></label>
        <div class="scheme-current">
          <span class="accent-sw" id="scheme-current-sw" style="background:${SCHEME_PRESETS[currentScheme()].swatch}"></span>
          <span class="scheme-current-name" id="scheme-current-name">${esc(SCHEME_PRESETS[currentScheme()].label)}</span>
          <button type="button" class="btn btn-sm btn-ghost" id="scheme-open">Alterar cores</button>
        </div>
      </div>
    </div>
    <div class="card mt" style="max-width:660px">
      <h3>Gerenciar tags</h3>
      <p class="muted mt">Tags são rótulos livres das peças. Excluir uma tag aqui remove ela de <strong>todas</strong> as peças que a usam — útil para limpar rótulos antigos ou digitados errado.</p>
      <div class="tagman mt" id="tagman">${tagRows}</div>
    </div>`);
  $$("#tagman [data-deltag]").forEach((b) => { b.onclick = () => deleteTagGlobally(b.dataset.deltag); });
  const markAccent = () => { const cur = currentAccent(); $$("#accent-grid .accent-opt").forEach((b) => b.classList.toggle("on", b.dataset.accentId === cur)); };
  $$("#accent-grid .accent-opt").forEach((b) => { b.onclick = () => { setAccent(b.dataset.accentId); markAccent(); toast("Aparência atualizada", "success"); }; });
  markAccent();
  if ($("#scheme-open")) $("#scheme-open").onclick = openSchemeCarousel;
  // #6 — habilita "Salvar" só com conteúdo válido; alterna leitura/edição da chave.
  const keyInput = $("#s-key");
  const saveKeyBtn = $("#s-save-key");
  if (keyInput && saveKeyBtn) keyInput.addEventListener("input", () => { saveKeyBtn.disabled = keyInput.value.trim().length < 10; });
  if ($("#s-change-key")) $("#s-change-key").onclick = () => {
    $("#s-key-locked").style.display = "none";
    $("#s-key-edit").style.display = "";
    if (keyInput) keyInput.focus();
  };
  if ($("#s-cancel-key")) $("#s-cancel-key").onclick = () => {
    if (keyInput) keyInput.value = "";
    if (saveKeyBtn) saveKeyBtn.disabled = true;
    $("#s-key-edit").style.display = "none";
    $("#s-key-locked").style.display = "";
  };
  if (saveKeyBtn) saveKeyBtn.onclick = async () => {
    const key = keyInput.value.trim();
    if (key.length < 10) { toast("Chave muito curta.", "error"); return; }
    saveKeyBtn.disabled = true; saveKeyBtn.innerHTML = '<span class="spinner"></span> salvando…';
    try { await API.saveKey(key); toast("Chave salva", "success"); await refreshKeyStatus(); viewSettings(); }
    catch (e) { toast(e.message, "error"); saveKeyBtn.disabled = false; saveKeyBtn.textContent = s.has_key ? "Salvar nova chave" : "Salvar chave"; }
  };
  $("#s-save-model").onclick = async () => { await API.saveModel($("#s-model").value); toast("Modelo salvo", "success"); await refreshKeyStatus(); };
  $("#s-test").onclick = async () => {
    const out = $("#s-test-out"); out.innerHTML = '<span class="spinner"></span> testando…';
    try { const r = await API.testKey(); out.innerHTML = r.ok ? '<span class="t-ok">✓</span> Conexão bem-sucedida com ' + esc(r.model) : '<span class="t-err">✕</span> ' + (esc(r.error) || "Chave inválida ou sem acesso"); }
    catch (e) { out.innerHTML = '<span class="t-err">✕</span> ' + esc(e.data && e.data.error || "Chave inválida ou sem acesso"); }
  };
}

/* =====================================================================
   componentes reutilizáveis (checkbox pills)
   ===================================================================== */
function checkPill(group, value, on, label) {
  return `<label class="check ${on ? "on" : ""}"><input type="checkbox" data-group="${group}" value="${esc(value)}" ${on ? "checked" : ""} /> ${esc(label == null ? value : label)}</label>`;
}
function bindCheckPills(root) {
  $$(".check input", root).forEach((inp) => {
    inp.onchange = () => inp.closest(".check").classList.toggle("on", inp.checked);
  });
}
function collectChecks(root, group) {
  return $$('.check input[data-group="' + group + '"]', root).filter((i) => i.checked).map((i) => i.value);
}

/* =====================================================================
   Assistente IA
   ===================================================================== */
// Renderer Markdown mínimo e seguro: escapa TODO o HTML primeiro e só então
// aplica formatação. Suporta títulos, negrito/itálico, código, listas, tabelas,
// linha horizontal e links http(s). Links com outros esquemas são ignorados.
function mdToHtml(src) {
  const inline = (s) => {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, (m, c) => "<code>" + c + "</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  };
  const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0, listType = null;
  const closeList = () => { if (listType) { out.push("</" + listType + ">"); listType = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      closeList(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(esc(lines[i])); i++; }
      i++; out.push('<pre class="md-pre"><code>' + buf.join("\n") + "</code></pre>"); continue;
    }
    if (/\|/.test(line) && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      closeList();
      const parseRow = (r) => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const headers = parseRow(line); i += 2; const rows = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== "") { rows.push(parseRow(lines[i])); i++; }
      out.push('<table class="md-table"><thead><tr>' + headers.map((h) => "<th>" + inline(h) + "</th>").join("") +
        "</tr></thead><tbody>" + rows.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") +
        "</tbody></table>");
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { closeList(); out.push("<hr/>"); i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { closeList(); const lvl = h[1].length; out.push("<h" + lvl + ">" + inline(h[2]) + "</h" + lvl + ">"); i++; continue; }
    if (/^\s*[-*+]\s+/.test(line)) {
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push("<li>" + inline(line.replace(/^\s*[-*+]\s+/, "")) + "</li>"); i++; continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push("<li>" + inline(line.replace(/^\s*\d+\.\s+/, "")) + "</li>"); i++; continue;
    }
    if (line.trim() === "") { closeList(); i++; continue; }
    closeList();
    const para = [line]; i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) && !/^```/.test(lines[i]) && !/\|/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    out.push("<p>" + para.map(inline).join("<br>") + "</p>");
  }
  closeList();
  return out.join("\n");
}

function setupAssistant() {
  const panel = $("#assistant");
  const btn = $("#btn-assistant");
  let asstOpener = null;
  const openAsst = () => {
    asstOpener = document.activeElement;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    if (btn) btn.setAttribute("aria-expanded", "true");
    const inp = $("#assistant-input"); if (inp) inp.focus();
  };
  const closeAsst = () => {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    if (btn) btn.setAttribute("aria-expanded", "false");
    restoreFocus(asstOpener); asstOpener = null;
  };
  if (btn) btn.onclick = openAsst;
  $("#assistant-close").onclick = closeAsst;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("open")) closeAsst(); });
  $("#assistant-form").onsubmit = async (e) => {
    e.preventDefault();
    const inp = $("#assistant-input"); const q = inp.value.trim(); if (!q) return;
    const log = $("#assistant-log");
    log.insertAdjacentHTML("beforeend", '<div class="msg msg-user">' + esc(q) + "</div>");
    inp.value = ""; log.scrollTop = log.scrollHeight;
    const loading = document.createElement("div"); loading.className = "msg msg-bot"; loading.innerHTML = '<span class="spinner"></span>';
    log.appendChild(loading); log.scrollTop = log.scrollHeight;
    try {
      const r = await API.assistant(q, "rota: " + parseHash().route);
      loading.innerHTML = mdToHtml(r.answer) + (r.simulated ? ' <span class="sim-flag">SIMULADO</span>' : "");
    } catch (err) {
      const m = (err && err.status === 429)
        ? "Limite de requisições da API atingido — aguarde alguns segundos e pergunte de novo."
        : ((err && err.message) || "erro ao responder");
      loading.innerHTML = esc(m);
    }
    log.scrollTop = log.scrollHeight;
  };
}

/* =====================================================================
   Menu mobile
   ===================================================================== */
let _sbOpener = null;
function openSidebar() {
  const sb = $("#sidebar"); if (!sb) return;
  _sbOpener = document.activeElement;
  sb.classList.add("open"); $("#scrim").classList.add("open");
  const b = $("#btn-menu"); if (b) b.setAttribute("aria-expanded", "true");
  const f0 = focusablesIn(sb)[0]; if (f0) f0.focus();
}
function closeSidebar() {
  const sb = $("#sidebar"); if (sb) sb.classList.remove("open");
  const sc = $("#scrim"); if (sc) sc.classList.remove("open");
  const b = $("#btn-menu"); if (b) b.setAttribute("aria-expanded", "false");
  if (_sbOpener) { restoreFocus(_sbOpener); _sbOpener = null; }
}
function setupBack() {
  const b = $("#btn-back");
  if (b) b.onclick = () => goBack(b.dataset.fallback || "#/content");
}
function setupMenu() {
  const btn = $("#btn-menu"); if (btn) btn.onclick = openSidebar;
  const scrim = $("#scrim"); if (scrim) scrim.onclick = closeSidebar;
  const sb = $("#sidebar");
  document.addEventListener("keydown", (e) => {
    if (!sb || !sb.classList.contains("open")) return;
    if (e.key === "Escape") { closeSidebar(); const b = $("#btn-menu"); if (b) b.focus(); }
    else if (e.key === "Tab") trapTabKey(sb, e);
  });
}

/* =====================================================================
   Tema claro/escuro
   ===================================================================== */
const THEME_KEY = "painel4selet_theme";
const ICON_MOON = '<svg class="ico-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
const ICON_SUN  = '<svg class="ico-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const logo = $("#brand-logo");
  if (logo) logo.src = theme === "light" ? "/brand-assets/logo-4selet.png" : "/brand-assets/logo-4selet-light.png";
  const btn = $("#btn-theme");
  if (btn) {
    const toDark = theme === "light";
    btn.innerHTML = (toDark ? ICON_MOON : ICON_SUN) + "<span>" + (toDark ? "Escuro" : "Claro") + "</span>";
    btn.setAttribute("aria-label", toDark ? "Mudar para tema escuro" : "Mudar para tema claro");
  }
}
function currentTheme() { return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"; }

/* ---- #2 Aparência: cor de destaque da UI (tokens seguros, não toca render de marca) ---- */
const ACCENT_KEY = "painel4selet_accent";
const ACCENT_PRESETS = {
  default: { label: "Padrão do tema" },
  sky:  { label: "Sky",  swatch: "#5499B5", accent: "#5499B5", strong: "#6fb4cf", ink: "#042029", soft: "rgba(84,153,181,.14)" },
  blue: { label: "Blue", swatch: "#006494", accent: "#006494", strong: "#1b7aa8", ink: "#ffffff", soft: "rgba(0,100,148,.14)" },
  navy: { label: "Navy", swatch: "#003554", accent: "#003554", strong: "#0a4d72", ink: "#ffffff", soft: "rgba(0,53,84,.18)" },
};
function currentAccent() { try { return localStorage.getItem(ACCENT_KEY) || "default"; } catch (e) { return "default"; } }
function applyAccent(id) {
  const root = document.documentElement;
  ["--accent", "--accent-strong", "--accent-ink", "--accent-soft"].forEach((v) => root.style.removeProperty(v));
  const p = ACCENT_PRESETS[id];
  if (p && id !== "default") {
    root.style.setProperty("--accent", p.accent);
    root.style.setProperty("--accent-strong", p.strong);
    root.style.setProperty("--accent-ink", p.ink);
    root.style.setProperty("--accent-soft", p.soft);
  }
}
function setAccent(id) {
  if (!ACCENT_PRESETS[id]) id = "default";
  try { localStorage.setItem(ACCENT_KEY, id); } catch (e) {}
  applyAccent(id);
}
function setupAccent() { applyAccent(currentAccent()); }

/* ---- Esquema de cores (Aparência): tons de fundo/superfície p/ claro e escuro ---- */
const SCHEME_KEY = "painel4selet_scheme";
const SCHEME_PRESETS = {
  grafite:   { label: "Grafite",   swatch: "#20262c", desc: "Cinza neutro (padrão)" },
  oceano:    { label: "Oceano",    swatch: "#0c2530", desc: "Teal-navy da marca" },
  esmeralda: { label: "Esmeralda", swatch: "#12241b", desc: "Verde profundo, joia" },
  ametista:  { label: "Ametista",  swatch: "#1f1a2d", desc: "Violeta elegante, joia" },
  ambar:     { label: "Âmbar",     swatch: "#281f15", desc: "Quente, terracota" },
  vibrante:  { label: "Vibrante",  swatch: "#1a2142", desc: "Índigo elétrico" },
  carbono:   { label: "Carbono",   swatch: "#0e0f10", desc: "Mono alto-contraste" },
};
// "oceano" usa os tokens-base (sem data-scheme); os demais sobrepoem.
function currentScheme() { try { const s = localStorage.getItem(SCHEME_KEY); return (s && SCHEME_PRESETS[s]) ? s : "grafite"; } catch (e) { return "grafite"; } }
function applyScheme(id) {
  if (!SCHEME_PRESETS[id] || id === "oceano") document.documentElement.removeAttribute("data-scheme");
  else document.documentElement.setAttribute("data-scheme", id);
}
function setScheme(id) {
  if (!SCHEME_PRESETS[id]) id = "grafite";
  try { localStorage.setItem(SCHEME_KEY, id); } catch (e) {}
  applyScheme(id);
}
function setupScheme() { setScheme(currentScheme()); }

// Cores por esquema (p/ pintar a mini-prévia de cada card; espelham os tokens do CSS).
const SCHEME_COLORS = {
  grafite:   { dark: { bg: "#12161a", surface: "#191e23", border: "#333b43", text: "#eaf2f5", accent: "#5499B5" }, light: { bg: "#ecedee", surface: "#ffffff", border: "#d2d5d8", text: "#0c2530", accent: "#006494" } },
  oceano:    { dark: { bg: "#061a22", surface: "#0c2530", border: "#1c3d4c", text: "#eaf2f5", accent: "#5499B5" }, light: { bg: "#eef1f0", surface: "#ffffff", border: "#d8e0e0", text: "#0c2530", accent: "#006494" } },
  esmeralda: { dark: { bg: "#08140f", surface: "#0e1d16", border: "#244736", text: "#e8f3ec", accent: "#2fb37a" }, light: { bg: "#eaf2ed", surface: "#ffffff", border: "#cfe0d6", text: "#0c2530", accent: "#1f9d6a" } },
  ametista:  { dark: { bg: "#120f1c", surface: "#1a1526", border: "#3b3257", text: "#efeaf7", accent: "#a585f0" }, light: { bg: "#f0edf6", surface: "#ffffff", border: "#ddd5ec", text: "#0c2530", accent: "#7c5cd6" } },
  ambar:     { dark: { bg: "#18120c", surface: "#221a12", border: "#4d3a25", text: "#f5ede2", accent: "#e0922f" }, light: { bg: "#f5efe7", surface: "#ffffff", border: "#e2d4c2", text: "#0c2530", accent: "#c2750a" } },
  vibrante:  { dark: { bg: "#0c1024", surface: "#141a35", border: "#34407a", text: "#eaf0ff", accent: "#7c6bff" }, light: { bg: "#eef0fa", surface: "#ffffff", border: "#d5dbf2", text: "#0c2530", accent: "#4f46e5" } },
  carbono:   { dark: { bg: "#050506", surface: "#0e0f10", border: "#2c2f33", text: "#f2f3f5", accent: "#d4d7dc" }, light: { bg: "#f4f4f5", surface: "#ffffff", border: "#d6d7d9", text: "#0a0a0b", accent: "#18181b" } },
};
function schemeColors(id, theme) { return (SCHEME_COLORS[id] && SCHEME_COLORS[id][theme]) || SCHEME_COLORS.oceano[theme]; }

// Carrossel curvo (carretel infinito) p/ escolher o esquema de cores, com prévia do painel por card.
function openSchemeCarousel() {
  const ids = Object.keys(SCHEME_PRESETS);
  const N = ids.length;
  let active = Math.max(0, ids.indexOf(currentScheme()));
  const theme = currentTheme();
  const opener = document.activeElement;
  const ov = document.createElement("div");
  ov.className = "scheme-cz"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Escolher esquema de cores");
  ov.innerHTML = `
    <button class="scheme-cz-close" aria-label="Fechar">✕</button>
    <div class="scheme-cz-title">Esquema de cores</div>
    <div class="scheme-cz-sub">Cada cartão é uma prévia do painel — tema ${theme === "light" ? "claro" : "escuro"}. Gire e escolha.</div>
    <div class="scheme-cz-stage">
      <button class="scheme-cz-nav prev" aria-label="Anterior">‹</button>
      <div class="scheme-cz-reel"></div>
      <button class="scheme-cz-nav next" aria-label="Próximo">›</button>
    </div>
    <div class="scheme-cz-foot">
      <div class="scheme-cz-name"></div><div class="scheme-cz-desc"></div>
      <button class="btn btn-primary scheme-cz-apply">Usar este esquema</button>
    </div>`;
  document.body.appendChild(ov);
  const reel = $(".scheme-cz-reel", ov);
  ids.forEach((id, i) => {
    const c = schemeColors(id, theme);
    const card = document.createElement("button");
    card.className = "scheme-cz-card"; card.dataset.i = i; card.type = "button"; card.setAttribute("aria-label", SCHEME_PRESETS[id].label);
    card.style.cssText += `--mbg:${c.bg};--msurface:${c.surface};--mborder:${c.border};--mtext:${c.text};--maccent:${c.accent}`;
    card.innerHTML = `<div class="scheme-mini">
        <div class="scheme-mini-side"><div class="scheme-mini-dot acc"></div><div class="scheme-mini-dot"></div><div class="scheme-mini-dot"></div><div class="scheme-mini-dot"></div></div>
        <div class="scheme-mini-main"><div class="scheme-mini-bar"></div>
          <div class="scheme-mini-cardm"><div class="scheme-mini-line t"></div><div class="scheme-mini-line"></div><div class="scheme-mini-line a"></div></div>
          <div class="scheme-mini-cardm"><div class="scheme-mini-line t"></div><div class="scheme-mini-line"></div></div>
        </div></div>`;
    card.onclick = () => { if (i === active) apply(); else { active = i; layout(); } };
    reel.appendChild(card);
  });
  const cards = Array.prototype.slice.call(reel.children);
  function layout() {
    // Dimensões proporcionais ao viewport: o carrossel cresce em telas grandes
    // (em vez de ficar pequeno no centro) e encolhe no mobile.
    const vw = window.innerWidth || 1200;
    const cw = Math.round(Math.max(220, Math.min(440, vw * 0.21)));
    const ch = Math.round(cw * 0.78);
    const STEP = Math.round(cw * 0.66), DROP = Math.round(cw * 0.17), ROT = 7;
    cards.forEach((card, i) => {
      let d = i - active; if (d > N / 2) d -= N; if (d < -N / 2) d += N;
      const ad = Math.abs(d), show = ad <= 2;
      card.style.width = cw + "px"; card.style.height = ch + "px"; card.style.margin = (-ch / 2) + "px 0 0 " + (-cw / 2) + "px";
      card.style.transform = `translateX(${d * STEP}px) translateY(${ad * DROP}px) scale(${(1 - ad * 0.16).toFixed(3)}) rotate(${d * ROT}deg)`;
      card.style.opacity = show ? (1 - ad * 0.28) : 0;
      card.style.zIndex = String(20 - ad);
      card.style.pointerEvents = show ? "auto" : "none";
      card.classList.toggle("is-active", d === 0);
    });
    const id = ids[active];
    $(".scheme-cz-name", ov).textContent = SCHEME_PRESETS[id].label;
    $(".scheme-cz-desc", ov).textContent = SCHEME_PRESETS[id].desc || "";
  }
  function go(dir) { active = (active + dir + N) % N; layout(); }
  function apply() {
    const id = ids[active];
    setScheme(id);
    const nm = $("#scheme-current-name"); if (nm) nm.textContent = SCHEME_PRESETS[id].label;
    const sw = $("#scheme-current-sw"); if (sw) sw.style.background = SCHEME_PRESETS[id].swatch;
    toast("Esquema aplicado: " + SCHEME_PRESETS[id].label, "success");
    close();
  }
  function close() { ov.classList.remove("open"); setTimeout(() => ov.remove(), 220); document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout); if (opener && opener.focus) opener.focus(); }
  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "Enter") apply();
  }
  $(".scheme-cz-close", ov).onclick = close;
  $(".scheme-cz-nav.prev", ov).onclick = () => go(-1);
  $(".scheme-cz-nav.next", ov).onclick = () => go(1);
  $(".scheme-cz-apply", ov).onclick = apply;
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  // arrastar p/ girar
  let dragX = null;
  reel.addEventListener("pointerdown", (e) => { dragX = e.clientX; });
  window.addEventListener("pointerup", (e) => { if (dragX == null) return; const dx = e.clientX - dragX; dragX = null; if (Math.abs(dx) > 44) go(dx < 0 ? 1 : -1); });
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  layout();
  requestAnimationFrame(() => { ov.classList.add("open"); $(".scheme-cz-apply", ov).focus(); });
}
window.openSchemeCarousel = openSchemeCarousel;

function setupTheme() {
  applyTheme(currentTheme());
  const btn = $("#btn-theme");
  if (btn) btn.onclick = () => {
    const next = currentTheme() === "light" ? "dark" : "light";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  };
}

/* ---- boot ---- */
async function boot() {
  setupTheme();
  setupAccent();
  setupScheme();
  setupMenu();
  setupBack();
  try { State.meta = await API.meta(); } catch (e) { setView('<div class="empty">Não foi possível conectar ao servidor.</div>'); return; }
  setupAssistant();
  setupLightbox();
  await refreshKeyStatus();
  window.addEventListener("hashchange", router);
  router();
}
boot();
