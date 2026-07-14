// public/js/app.js — SPA do Painel 4Selet (reconstruído do zero).
// Vanilla JS, hash-router, sem build. Contrato de API inalterado (ver api.js).
"use strict";

const State = { meta: null, settings: null, campMap: null };

/* ============================ helpers ============================ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Olho de mostrar/ocultar senha (reutilizavel: login + modais de senha). Envolve o
// input num wrapper e injeta um botao que alterna type password<->text.
const EYE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function wirePasswordEye(input) {
  if (!input || input.dataset.eye) return;
  input.dataset.eye = "1";
  const wrap = document.createElement("div");
  wrap.className = "pass-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pass-eye";
  btn.tabIndex = -1;
  btn.setAttribute("aria-label", "Mostrar senha");
  btn.innerHTML = EYE_SVG;
  wrap.appendChild(btn);
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = show ? EYE_OFF_SVG : EYE_SVG;
    btn.classList.toggle("on", show);
    btn.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    input.focus();
  });
}
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

function setView(html) {
  // Remove menus flutuantes ancorados no body que não somem sozinhos ao navegar (ex.: o
  // dropdown de qualificadores da biblioteca), evitando nó órfão preso ao document.
  document.querySelectorAll(".qual-menu").forEach((n) => n.remove());
  $("#view").innerHTML = html;
}
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
        : f.type === "select"
          ? `<select data-mf="${i}">${(f.options || []).map((o) => { const val = (o && typeof o === "object") ? o.value : o; const lab = (o && typeof o === "object") ? o.label : o; return `<option value="${esc(val)}"${String(f.value) === String(val) ? " selected" : ""}>${esc(lab)}</option>`; }).join("")}</select>`
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
        ${opts.noCancel ? "" : '<button class="btn btn-ghost" data-mx="cancel">' + esc(opts.cancelText || "Cancelar") + "</button>"}
        <button class="btn ${opts.confirmKind === "danger" ? "btn-danger" : "btn-primary"}" data-mx="ok">${esc(opts.confirmText || "Confirmar")}</button>
      </div></div>`;
    document.body.appendChild(ov);
    fields.forEach((f, i) => { if (String(f.inputType) === "password") wirePasswordEye(ov.querySelector('[data-mf="' + i + '"]')); });
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
      if (e.key === "Escape") { if (!opts.noCancel) { e.preventDefault(); done(null); } }
      else if (e.key === "Enter" && !fields.some((f) => f.type === "textarea")) { e.preventDefault(); done(fields.length ? collect() : true); }
      else if (e.key === "Tab") trapTabKey(ov, e);
    };
    ov.querySelector("[data-mx='ok']").onclick = () => done(fields.length ? collect() : true);
    const cancelBtn = ov.querySelector("[data-mx='cancel']"); if (cancelBtn) cancelBtn.onclick = () => done(null);
    ov.addEventListener("click", (e) => { if (e.target === ov && !opts.noCancel) done(null); });
    document.addEventListener("keydown", onKey);
  });
}
function uiConfirm(message, opts) {
  return uiModal(Object.assign({ title: "Confirmar", message: message, confirmText: "Confirmar" }, opts || {})).then((v) => !!v);
}
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
  import: viewImport,
  settings: viewSettings,
  usuarios: viewUsers,
  agendados: viewSchedule,
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
  if (route === "create" || route === "import") return `<div class="grid grid-2">${card(6)}${card(2)}</div>`;
  return `<div class="grid grid-2">${card(4)}${card(4)}</div>`;
}

let NAV_COUNT = 0;
// "Voltar": volta para a página anterior de fato (de onde o usuário veio). Se a peça
// foi aberta por link direto (sem histórico no painel), usa o fallback por zona.
function goBack(fallback) {
  if (NAV_COUNT > 1) history.back();
  else location.hash = fallback || "#/content";
}
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
// Ícone de "campanha" — o MESMO megafone do menu lateral "Campanhas", para o
// dashboard não ter três ícones diferentes para a mesma ideia.
const CAMP_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';
async function viewDashboard() {
  setTitle("Dashboard");
  const [{ campaigns }, { tasks }] = await Promise.all([API.campaigns(), API.content()]);
  setCampMap(campaigns);
  const active = campaigns.filter((c) => c.status === "active").length;
  const inReview = tasks.filter((t) => t.status === "in_review").length;
  const approved = tasks.filter((t) => t.status === "approved" || t.zone === "approved").length;
  const draft = tasks.filter((t) => t.status === "draft").length;
  // Mix por tipo (formato) — visão do que está sendo produzido.
  const byKind = {};
  tasks.forEach((t) => { byKind[t.kind] = (byKind[t.kind] || 0) + 1; });
  const kindOrder = ["feed", "carousel", "image", "video", "linkedin", "threads"];
  const mixKinds = kindOrder.filter((k) => byKind[k]).concat(Object.keys(byKind).filter((k) => !kindOrder.includes(k)));
  const maxKind = Math.max(1, ...mixKinds.map((k) => byKind[k]));
  const activeCamps = campaigns.filter((c) => c.status === "active");
  const mixHtml = mixKinds.length
    ? '<div class="mix">' + mixKinds.map((k) => {
        const n = byKind[k], pct = Math.round((n / maxKind) * 100);
        return `<div class="mix-row"><span class="mix-lbl">${esc(kindLabel(k))}</span><span class="mix-bar"><span class="mix-fill" style="width:${pct}%"></span></span><span class="mix-n">${n}</span></div>`;
      }).join("") + "</div>"
    : '<div class="empty">Sem peças ainda.</div>';
  const campsHtml = activeCamps.length
    ? '<div class="list">' + activeCamps.slice(0, 5).map((c) =>
        `<a class="list-row" href="#/campaign/${encodeURIComponent(c.id)}"><span class="lr-ico" aria-hidden="true">${CAMP_SVG}</span><div class="lr-main"><div class="lr-title">${esc(c.name)}</div><div class="lr-meta">${c.angle ? esc(c.angle) + " · " : ""}${plural((c.content_ids || []).length, "peça vinculada", "peças vinculadas")}</div></div><span class="lr-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg></span></a>`
      ).join("") + "</div>"
    : '<div class="empty">Nenhuma campanha ativa. <a href="#/campaigns">Criar campanha</a></div>';
  const keyWarn = State.settings && !State.settings.has_key
    ? `<div class="card callout mb"><div class="flex-between"><div><h3>Configure a Inteligência Artificial</h3><p class="muted mt">Cole sua chave Anthropic para geração real. Sem chave, o painel funciona em modo simulado.</p></div><a class="btn btn-primary" href="#/settings">Configurar</a></div></div>` : "";
  setView(`
    <div class="dash-stack">
    ${keyWarn}
    <div class="stat-grid">
      <a class="card stat" data-accent="sky" href="#/campaigns" title="Ver campanhas"><span class="stat-ico">${CAMP_SVG}</span><div class="stat-body"><span class="num">${campaigns.length}</span><span class="lbl">Campanhas <em>${active} ativas</em></span></div></a>
      <a class="card stat" data-accent="blue" href="#/content" title="Ver todas as peças"><span class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg></span><div class="stat-body"><span class="num">${tasks.length}</span><span class="lbl">Peças de conteúdo</span></div></a>
      <a class="card stat" data-accent="warn" href="#/content?status=in_review" title="Ver peças em revisão"><span class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg></span><div class="stat-body"><span class="num">${inReview}</span><span class="lbl">Em revisão</span></div></a>
      <a class="card stat" data-accent="ok" href="#/approved" title="Ver peças aprovadas"><span class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5.5"/></svg></span><div class="stat-body"><span class="num">${approved}</span><span class="lbl">Aprovadas</span></div></a>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="section-head"><h2>Conteúdo recente</h2><a class="muted-link" href="#/content">ver tudo →</a></div>
        ${tasks.length ? '<div class="list">' + tasks.slice(0, 6).map(taskRow).join("") + "</div>" : '<div class="empty">Nenhuma peça ainda. <a href="#/create">Criar conteúdo</a></div>'}
      </div>
      <div class="card">
        <div class="section-head"><h2>Ações rápidas</h2></div>
        <div class="list">
          <a class="list-row action-row" href="#/create"><span class="lr-ico">＋</span><div class="lr-main"><div class="lr-title">Criar conteúdo com IA</div><div class="lr-meta">Caption, carrossel, anúncio ou vídeo no padrão da marca</div></div><span class="lr-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg></span></a>
          <a class="list-row action-row" href="#/campaigns"><span class="lr-ico">${CAMP_SVG}</span><div class="lr-main"><div class="lr-title">Nova campanha</div><div class="lr-meta">Defina ângulo, pilar e mensagens-chave</div></div><span class="lr-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg></span></a>
          <a class="list-row action-row" href="#/approved"><span class="lr-ico">✓</span><div class="lr-main"><div class="lr-title">Biblioteca de aprovados</div><div class="lr-meta">Peças aprovadas e prontas para publicar</div></div><span class="lr-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg></span></a>
        </div>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="section-head"><h2>Mix de conteúdo</h2></div>
        ${mixHtml}
        <div class="mix-pipe muted">Pipeline: <strong>${draft}</strong> rascunho · <strong>${inReview}</strong> em revisão · <strong>${approved}</strong> aprovadas</div>
      </div>
      <div class="card">
        <div class="section-head"><h2>Campanhas ativas</h2><a class="muted-link" href="#/campaigns">ver todas →</a></div>
        ${campsHtml}
      </div>
    </div>
    </div>`);
}

function taskRow(t) {
  const hasThumb = t.thumb && t.thumb.rel;
  const ico = hasThumb
    ? `<span class="lr-thumb">${t.thumb.type === "video"
        ? `<video src="${API.rawUrl(t.folder, t.thumb.rel)}" muted preload="metadata"></video>`
        : `<img src="${API.rawUrl(t.folder, t.thumb.rel)}" alt="" loading="lazy" onerror="this.closest('.lr-thumb').classList.add('lr-thumb-fb')" />`}<span class="lr-thumb-ico" aria-hidden="true">${kindIcon(t.kind)}</span></span>`
    : `<span class="lr-ico" aria-hidden="true">${kindIcon(t.kind)}</span>`;
  return `<a class="list-row" href="#/task/${encodeURIComponent(t.folder)}">
    ${ico}
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
// Menu de download com escolha de resolução (PNG). baseUrl = API.downloadUrl(folder, rel)
// sem scale; cada opção acrescenta &scale=N e o backend re-renderiza a peça naquela
// resolução (re-render a partir do HTML salvo; 2x sai do arquivo já salvo, instantâneo).
function dlMenu(baseUrl, label) {
  label = label || "baixar";
  const opt = (s, txt) => `<a role="menuitem" class="dl-res-opt" href="${baseUrl}&scale=${s}" download onclick="this.closest('details').open=false">${txt}</a>`;
  return `<details class="dl-res"><summary class="btn btn-sm btn-ghost" title="Baixar — escolha a resolução do PNG">${esc(label)}<span class="dl-caret" aria-hidden="true"></span></summary>`
    + `<div class="dl-res-menu" role="menu"><span class="dl-res-h">Resolução (PNG)</span>`
    + opt(1, "Padrão — 1080px") + opt(2, "Alta — 2160px") + opt(4, "Máxima — 4320px")
    + `</div></details>`;
}
// Fecha qualquer menu de resolução aberto ao clicar fora dele.
document.addEventListener("click", (e) => {
  document.querySelectorAll("details.dl-res[open], details.ed-menu[open]").forEach((d) => { if (!d.contains(e.target)) d.removeAttribute("open"); });
});

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
    <div class="section-head"><h2>Biblioteca de conteúdo</h2><div class="flex" style="gap:8px;flex-wrap:wrap"><a class="btn btn-ghost" href="#/approved?view=collections" title="Agrupamentos de peças aprovadas">Coleções</a><button class="btn btn-ghost" onclick="location.hash='#/import'" title="Subir uma peça pronta feita fora do painel">Importar conteúdo</button><button class="btn btn-primary" onclick="location.hash='#/create'">＋ Criar conteúdo</button></div></div>
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
    ${data.orphans ? '<p class="muted">Algumas peças desta coleção foram descartadas e não aparecem aqui. Se forem restauradas, voltam automaticamente. <button class="btn btn-xs" id="coll-prune">Limpar ' + plural(data.orphans, "referência órfã", "referências órfãs") + "</button></p>" : ""}
    <div id="coll-items-wrap">${itemsHtml}</div>`);
  $$("[data-lay]").forEach((b) => { b.onclick = () => { State.collLayout = b.dataset.lay; openCollection(id); }; });
  $("#coll-add").onclick = () => addPiecesFlow(c);
  $("#coll-edit").onclick = () => editCollectionFlow(c);
  $("#coll-del").onclick = () => deleteCollectionFlow(c);
  if ($("#coll-prune")) $("#coll-prune").onclick = async () => {
    const ok = await uiConfirm("Remover " + plural(data.orphans, "referência órfã", "referências órfãs") + " desta coleção? Apaga só os apontamentos para peças descartadas — se restaurar a peça depois, terá que re-adicionar.", { title: "Limpar órfãs", confirmText: "Limpar", confirmKind: "danger" });
    if (!ok) return;
    try { const r = await API.pruneCollection(c.id); toast("Removidas " + (r.removed || 0) + " referências órfãs.", "success"); openCollection(id); }
    catch (e) { toast(e.message, "error"); }
  };
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
// Esconde da lista "Arquivos" o ruído: mídia que já aparece na galeria/strip e os
// HTML intermediários do render (fonte dos slides/ads). Mantém dados + prévia.
function visibleFiles(task) {
  const files = task.files || [];
  if (["carousel", "image", "feed", "video"].indexOf(task.kind) === -1) return files;
  return files.filter((f) => {
    if (f.isImage || f.isVideo) return false;
    if (/(slides\/slide_\d+|ads\/(ad|feed))\.html?$/i.test(f.rel)) return false;
    if (/\.(canvas|editable)\.json$/i.test(f.rel)) return false; // sidecars do editor visual (não entregáveis)
    return true;
  });
}
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
  const imgs = task.files.filter((f) => f.isImage && !/\.bg\.png$/i.test(f.rel));
  const vids = task.files.filter((f) => f.isVideo);
  if (!imgs.length && !vids.length) return "";
  const editable = task.zone === "active" && (task.kind === "image" || task.kind === "feed") && !(task.status && task.status.imported);
  const items = []
    .concat(vids.map((f) => `<div class="media-item"><div class="media-frame"><video src="${API.rawUrl(folder, f.rel)}&v=${f.mtime || 0}" controls preload="metadata"></video><button class="media-zoom" title="Ampliar" aria-label="Ampliar" onclick="openLightboxFromEl(this)">⤢</button></div><a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, f.rel)}" download>baixar ${esc(f.rel.split("/").pop())}</a></div>`))
    .concat(imgs.map((f) => `<div class="media-item"><div class="media-frame"><img src="${API.rawUrl(folder, f.rel)}&v=${f.mtime || 0}" alt="${esc(f.rel)}" data-folder="${esc(folder)}" data-rel="${esc(f.rel)}" data-edit="${editable ? 1 : 0}" loading="lazy" onclick="openLightboxFromEl(this)" /><button class="media-zoom" title="Ampliar" aria-label="Ampliar" onclick="openLightboxFromEl(this)">⤢</button></div>${dlMenu(API.downloadUrl(folder, f.rel), "baixar")}</div>`));
  return `<div class="card"><h3>Arte gerada</h3><p class="muted mt">${editable ? "Clique para ampliar e editar — adicionar textos, formas, logo e ajustar." : "Clique na imagem para ampliar dentro do site."}</p><div class="media-gallery mt">${items.join("")}</div></div>`;
}

// #2 — Galeria única e ordenada dos slides de um carrossel (slide_1..n): cada slide
// numerado, com ampliar e baixar. Substitui a "Arte gerada" p/ carrossel (evita duplicar).
function carouselStrip(folder, task) {
  const slides = task.files
    .filter((f) => /slide_0*\d+\.(png|jpe?g)$/i.test(f.rel))
    .map((f) => ({ f, n: parseInt((f.rel.match(/slide_0*(\d+)\./i) || [])[1] || "0", 10) }))
    .sort((a, b) => a.n - b.n);
  if (slides.length < 2) return "";
  const editable = task.zone === "active" && !(task.status && task.status.imported);
  const items = slides.map((s) =>
    `<div class="media-item"><div class="media-frame">
      <span class="slide-num">${s.n}</span>
      <img src="${API.rawUrl(folder, s.f.rel)}&v=${s.f.mtime || 0}" alt="Slide ${s.n}" data-folder="${esc(folder)}" data-rel="${esc(s.f.rel)}" data-edit="${editable ? 1 : 0}" loading="lazy" onclick="openLightboxFromEl(this)" />
      <button class="media-zoom" title="Ampliar slide ${s.n}" aria-label="Ampliar slide ${s.n}" onclick="openLightboxFromEl(this)">⤢</button>
    </div>${dlMenu(API.downloadUrl(folder, s.f.rel), "baixar slide " + s.n)}</div>`).join("");
  return `<div class="card"><h3>Slides do carrossel <span class="dim">(${slides.length})</span></h3>
    <p class="muted mt">Na ordem de publicação — clique para ampliar ou baixe cada slide.</p>
    <div class="media-gallery mt">${items}</div>
    <div class="strip-foot"><a class="btn btn-sm btn-primary" href="${API.zipUrl(folder)}" download title="Baixa os ${slides.length} slides num único arquivo .zip">Baixar todos (ZIP)</a></div></div>`;
}

function renderPanel(folder, task) {
  if (!isMediaKind(task.kind)) return "";
  // Peça importada: a arte foi trazida pronta, não há fonte (HTML/JSON) para re-render.
  if (task.status && task.status.imported) {
    return `<div class="card"><h3>Arte final</h3><p class="muted mt">Arte <strong>importada por você</strong> — já é a versão final. Para trocar a imagem, importe uma peça nova. Você ainda pode ajustar a <strong>legenda</strong> abaixo.</p></div>`;
  }
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

// Imagens de referencia anexadas ao "Ajustar com IA" (a IA as "ve" via visao).
let REFINE_IMAGES = [];
// Le um arquivo de imagem e devolve um dataURL JPEG redimensionado (leve p/ trafegar).
function fileToDataUrl(file, maxDim) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, (maxDim || 1280) / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function renderRefineImgs() {
  const box = $("#refine-imgs"); if (!box) return;
  box.innerHTML = REFINE_IMAGES.map((src, i) =>
    '<div class="refimg"><img src="' + src + '" alt=""/><button type="button" class="refimg-x" data-i="' + i + '" title="Remover">&times;</button></div>').join("");
  $$("#refine-imgs .refimg-x").forEach((b) => { b.onclick = () => { REFINE_IMAGES.splice(Number(b.dataset.i), 1); renderRefineImgs(); }; });
}
async function addRefineFiles(files) {
  for (const f of Array.from(files || [])) {
    if (!/^image\//.test(f.type)) continue;
    if (REFINE_IMAGES.length >= 4) { toast("Máximo de 4 imagens de referência.", "warn"); break; }
    try { REFINE_IMAGES.push(await fileToDataUrl(f, 1280)); } catch (e) { toast("Não consegui ler a imagem.", "error"); }
  }
  renderRefineImgs();
}
// Liga o anexo de imagem do card de refino (arquivo + colar Ctrl+V). Zera a cada render.
function wireRefineAttach() {
  REFINE_IMAGES = [];
  const inp = $("#refine-file");
  if (inp) inp.onchange = (e) => { addRefineFiles(e.target.files); e.target.value = ""; };
  const ta = $("#refine-input");
  if (ta) ta.addEventListener("paste", (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const imgs = [];
    for (const it of items) { if (it.type && it.type.indexOf("image") === 0) { const f = it.getAsFile(); if (f) imgs.push(f); } }
    if (imgs.length) { e.preventDefault(); addRefineFiles(imgs); }
  });
}

function refineCard(task) {
  if (task.zone !== "active") return "";
  // Importada não tem conteúdo estruturado para a IA ajustar/re-renderizar.
  if (task.status && task.status.imported) return "";
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
      <textarea id="refine-input" rows="2" placeholder="ex.: use um fluxo com ícones na tela 2 (como a imagem de referência)"></textarea>
      <div class="refine-attach mt"><label class="btn btn-sm btn-ghost"><input type="file" id="refine-file" accept="image/*" multiple hidden> Anexar imagem de referência</label><span class="hint">a IA "vê" a imagem e usa como inspiração — ou cole com Ctrl+V</span></div>
      <div class="refine-imgs" id="refine-imgs"></div>
      <button class="btn btn-primary mt" id="btn-refine" data-ct="${esc(ct.id)}" data-file="${esc(ct.file)}">Aplicar ajuste</button>
      <span id="refine-out" class="muted"></span>
    </div>
    <div id="undo-area"></div>
  </div>`;
}

// Quais artes desta peca abrem no editor: carrossel -> 1 por slide; imagem/feed -> a arte principal.
function editorTargets(task) {
  const files = (task && task.files) || [];
  if (task.kind === "carousel") {
    return files
      .filter((f) => /slide_0*\d+\.png$/i.test(f.rel))
      .map((f) => ({ f, n: parseInt((f.rel.match(/slide_0*(\d+)\.png$/i) || [])[1] || "0", 10) }))
      .sort((a, b) => a.n - b.n)
      .map((s) => ({ rel: s.f.rel, label: "Slide " + s.n }));
  }
  const png = files.find((f) => f.isImage && /ads\/(ad|feed)\.png$/i.test(f.rel))
    || files.find((f) => f.isImage && /\.png$/i.test(f.rel));
  return png ? [{ rel: png.rel, label: kindLabel(task.kind) || "Arte" }] : [];
}
// ===== Editor HTML (item A / Opção 1): edita o HTML REAL da arte (pixel-perfect,
// preserva accent/gradiente/fontes) e re-renderiza pra PNG via Playwright. =====
function rgbToHex(c) {
  const m = String(c || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return /^#[0-9a-f]{6}$/i.test(String(c)) ? c : null;
  return "#" + [1, 2, 3].map((i) => (+m[i]).toString(16).padStart(2, "0")).join("");
}
async function openHtmlEditor(folder, task, rel) {
  const targets = editorTargets(task);
  let curRel = rel || (targets[0] || {}).rel;
  if (!curRel) { toast("Não há arte para editar aqui.", "error"); return; }
  toast("Abrindo editor…", "info");
  const multiSlide = targets.length > 1;
  let assetMaps = [], dirty = false, changed = false, current = null, curScale = 1; // [prefixo file://, token /url/]
  let hist = [], hi = -1; // desfazer/refazer: pilha de innerHTML do .card
  let artW = 1080, artH = 1080, fitScale = 1; // dimensões da arte + zoom "ajustar à tela"
  const SEL_CSS = "[data-he]:hover{outline:1px dashed rgba(84,153,181,.75);outline-offset:2px;cursor:move;} [data-he-sel]{outline:2px solid #5499B5 !important;outline-offset:2px;}";
  const FONTS = '<link id="he-fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Playfair+Display:wght@400;700;900&display=swap">';

  const ov = document.createElement("div");
  ov.className = "editor-ov";
  ov.innerHTML =
      '<div class="editor-top">'
    +   '<span class="ed-piece" id="he-piece"></span>'
    +   (multiSlide ? '<div class="ed-slidenav"><button class="ed-navbtn" id="he-prev" title="Slide anterior">‹</button><span class="ed-slide-count" id="he-count"></span><button class="ed-navbtn" id="he-next" title="Próximo slide">›</button></div>' : "")
    +   '<span style="flex:1"></span>'
    +   '<button class="btn btn-sm btn-ghost" id="he-close">Fechar</button>'
    +   '<button class="btn btn-sm btn-primary" id="he-save">Salvar arte</button>'
    + "</div>"
    + '<div class="he-bar" id="he-bar">'
    +   '<button class="btn btn-sm" id="he-add-text">+ Texto</button>'
    +   '<details class="ed-menu" id="he-logo-menu"><summary class="btn btn-sm">+ Logo</summary><div class="ed-pop">'
    +     '<button data-src="/brand-assets/logo-4selet-light.png" data-w="0.32">Logo claro (fundo escuro)</button>'
    +     '<button data-src="/brand-assets/logo-4selet.png" data-w="0.32">Logo escuro (fundo claro)</button>'
    +     '<button data-src="/brand-assets/simbolo.svg" data-w="0.12">Só o símbolo "4"</button>'
    +   "</div></details>"
    +   '<details class="ed-menu" id="he-mark-menu"><summary class="btn btn-sm">+ Marca d’água</summary><div class="ed-pop">'
    +     '<button data-mark="simbolo">Símbolo "4"</button>'
    +     '<button data-mark="selet">Palavra "SELET"</button>'
    +     '<button data-mark="4selet">"4SELET"</button>'
    +   "</div></details>"
    +   '<button class="btn btn-sm" id="he-add-img">+ Imagem</button>'
    +   '<details class="ed-menu" id="he-block-menu"><summary class="btn btn-sm">+ Bloco</summary><div class="ed-pop">'
    +     '<button data-block="cta">CTA WhatsApp</button>'
    +     '<button data-block="footer">Rodapé @4selet</button>'
    +     '<button data-block="selo">Selo Taxa Zero</button>'
    +   "</div></details>"
    +   '<input type="file" id="he-file" accept="image/*" hidden>'
    +   '<input type="file" id="he-replace-file" accept="image/*" hidden>'
    +   '<span class="ed-sep"></span>'
    +   '<select id="he-font" title="Fonte">'
    +     "<option value=\"'Inter',sans-serif\">Inter</option>"
    +     "<option value=\"'Archivo Black',sans-serif\">Archivo Black</option>"
    +     "<option value=\"'Playfair Display',serif\">Playfair</option>"
    +     "<option value=\"'Bebas Neue',sans-serif\">Bebas Neue</option>"
    +     "<option value=\"'JetBrains Mono',monospace\">JetBrains Mono</option>"
    +     '<option value="Georgia,serif">Georgia</option>'
    +   "</select>"
    +   '<input type="number" id="he-size" value="40" min="6" max="600" title="Tamanho do texto">'
    +   '<button class="btn btn-sm ed-ico" id="he-bold" title="Negrito"><b>N</b></button>'
    +   '<button class="btn btn-sm ed-ico" id="he-italic" title="Itálico"><i>I</i></button>'
    +   '<select id="he-align" title="Alinhamento do texto"><option value="left">Esq.</option><option value="center">Centro</option><option value="right">Dir.</option></select>'
    +   '<input type="number" id="he-lh" step="0.05" min="0.8" max="3" title="Entrelinha" placeholder="1.2">'
    +   '<input type="color" id="he-color" value="#ffffff" title="Cor do texto">'
    +   '<button class="btn btn-sm ed-ico" id="he-eyedrop" title="Conta-gotas: pegar cor da arte"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg></button>'
    +   '<details class="ed-menu" id="he-fx-menu"><summary class="btn btn-sm">Efeitos</summary><div class="ed-pop">'
    +     '<button data-fx="none">Nenhum</button>'
    +     '<button data-fx="shadow">Sombra suave</button>'
    +     '<button data-fx="outline">Contorno</button>'
    +     '<button data-fx="box">Caixa de fundo</button>'
    +   "</div></details>"
    +   '<button class="btn btn-sm" id="he-replace">Trocar imagem</button>'
    +   '<details class="ed-menu" id="he-filter-menu"><summary class="btn btn-sm">Filtros</summary><div class="ed-pop ed-pop-wide">'
    +     '<label class="ed-range">Brilho<input type="range" id="he-f-bri" min="0" max="200" value="100"></label>'
    +     '<label class="ed-range">Contraste<input type="range" id="he-f-con" min="0" max="200" value="100"></label>'
    +     '<label class="ed-range">Saturação<input type="range" id="he-f-sat" min="0" max="200" value="100"></label>'
    +     '<button data-filt="gray">Preto e branco</button>'
    +     '<button data-filt="none">Limpar filtros</button>'
    +   "</div></details>"
    +   '<span class="ed-sep"></span>'
    +   '<label class="he-op" title="Opacidade"><span>Opac.</span><input type="range" id="he-opacity" min="0" max="100" value="100"></label>'
    +   '<input type="number" id="he-rot" min="-180" max="180" step="1" value="0" title="Rotação (graus)">'
    +   '<button class="btn btn-sm ed-ico" id="he-flip" title="Espelhar na horizontal"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v2M12 14v2M12 8v2M12 2v2"/></svg></button>'
    +   '<details class="ed-menu" id="he-align2-menu"><summary class="btn btn-sm">Alinhar</summary><div class="ed-pop">'
    +     '<button data-al="cx">Centralizar na horizontal</button>'
    +     '<button data-al="cy">Centralizar na vertical</button>'
    +     '<button data-al="left">Encostar à esquerda</button>'
    +     '<button data-al="right">Encostar à direita</button>'
    +     '<button data-al="top">Encostar no topo</button>'
    +     '<button data-al="bottom">Encostar na base</button>'
    +   "</div></details>"
    +   '<details class="ed-menu" id="he-layer-menu"><summary class="btn btn-sm">Camada</summary><div class="ed-pop">'
    +     '<button data-lay="front">Trazer para frente</button>'
    +     '<button data-lay="back">Enviar para trás</button>'
    +   "</div></details>"
    +   '<button class="btn btn-sm" id="he-parent" title="Selecionar o grupo/bloco em volta do item (pra mover vários juntos)">Grupo ↑</button>'
    +   '<button class="btn btn-sm" id="he-dup" title="Duplicar (Ctrl+D)">Duplicar</button>'
    +   '<span class="ed-sep"></span>'
    +   '<button class="btn btn-sm ed-ico" id="he-undo" title="Desfazer (Ctrl+Z)">↶</button>'
    +   '<button class="btn btn-sm ed-ico" id="he-redo" title="Refazer (Ctrl+Y)">↷</button>'
    +   '<button class="btn btn-sm btn-danger" id="he-del" title="Remover (Del)">Remover</button>'
    + "</div>"
    + '<div class="editor-stage"><div class="he-wrap" id="he-wrap"><iframe id="he-frame" title="Editor visual" sandbox="allow-same-origin"></iframe><div class="he-overlay" id="he-overlay"></div><div class="he-safe" id="he-safe" hidden><span class="he-safe-tag">Área segura</span></div><div class="he-guideline he-guideline-v" id="he-gl-v" hidden></div><div class="he-guideline he-guideline-h" id="he-gl-h" hidden></div><div class="he-handle" id="he-handle" style="display:none"></div></div></div>'
    + '<div class="he-tools" id="he-tools">'
    +   '<button class="he-tool" id="he-zoom-out" title="Diminuir (Ctrl -)" aria-label="Diminuir zoom">&#8722;</button>'
    +   '<button class="he-tool he-zoom-val" id="he-zoom-val" title="Ajustar à tela (Ctrl 0)">100%</button>'
    +   '<button class="he-tool" id="he-zoom-in" title="Aumentar (Ctrl +)" aria-label="Aumentar zoom">+</button>'
    +   '<span class="he-tool-sep"></span>'
    +   '<button class="he-tool he-tool-txt" id="he-grid-btn" title="Grade de alinhamento" aria-pressed="false">Grade</button>'
    +   '<button class="he-tool he-tool-txt" id="he-guides-btn" title="Guias de centro" aria-pressed="false">Guias</button>'
    +   '<button class="he-tool he-tool-txt" id="he-safe-btn" title="Zonas seguras do Instagram" aria-pressed="false">Zonas IG</button>'
    + "</div>";
  document.body.appendChild(ov);
  document.body.classList.add("no-scroll");
  const frame = $("#he-frame"), wrap = $("#he-wrap"), handle = $("#he-handle");
  const gcs = (el) => frame.contentDocument.defaultView.getComputedStyle(el);
  // Transform completo: translate + rotate + scale(sx,sy). O sinal de sx/sy guarda o espelho
  // (flip). 's' é sempre a magnitude positiva; fx/fy ∈ {1,-1}. Ordem fixa translate→rotate→scale
  // (compõe estável e o Playwright re-renderiza idêntico).
  const getTf = (el) => {
    const t = el.style.transform || "";
    const tr = t.match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/);
    const ro = t.match(/rotate\(\s*(-?[\d.]+)deg/);
    const sc = t.match(/scale\(\s*(-?[\d.]+)\s*(?:,\s*(-?[\d.]+))?/);
    const sx = sc ? parseFloat(sc[1]) : 1, sy = sc && sc[2] != null ? parseFloat(sc[2]) : sx;
    return { x: tr ? parseFloat(tr[1]) : 0, y: tr ? parseFloat(tr[2]) : 0, s: Math.abs(sx) || 1, rot: ro ? parseFloat(ro[1]) : 0, fx: sx < 0 ? -1 : 1, fy: sy < 0 ? -1 : 1 };
  };
  const setTf = (el, t) => { el.style.transform = "translate(" + t.x + "px," + t.y + "px) rotate(" + (t.rot || 0) + "deg) scale(" + (t.s * (t.fx || 1)) + "," + (t.s * (t.fy || 1)) + ")"; };

  function loadInto(r2) {
    curRel = r2; dirty = false; current = null; hist = []; hi = -1;
    $("#he-piece").textContent = (targets.find((t) => t.rel === curRel) || {}).label || "Arte";
    updateNav();
    API.taskFile(folder, curRel.replace(/\.png$/i, ".html")).then((raw) => {
      if (!/<html/i.test(raw)) { toast("Esta peça não tem HTML editável (gere a arte de novo).", "error"); return; }
      // Reescreve assets file:// p/ URLs servidas (brand-assets = assets/ da marca;
      // uploads = fotos em interface/public/uploads/). Guarda p/ reverter ao salvar.
      assetMaps = [];
      const am = raw.match(/(file:\/\/\/[^"']*\/assets\/)/i); if (am) assetMaps.push([am[1], "/brand-assets/"]);
      const um = raw.match(/(file:\/\/\/[^"']*\/uploads\/)/i); if (um) assetMaps.push([um[1], "/uploads/"]);
      let disp = raw; assetMaps.forEach((mp) => { disp = disp.split(mp[0]).join(mp[1]); });
      disp = disp.replace(/<\/head>/i, FONTS + '<style id="he-editstyle">' + SEL_CSS + "</style></head>");
      frame.onload = () => { try { wireDoc(frame.contentDocument); } catch (e) { toast("Erro ao preparar a arte: " + e.message, "error"); } };
      frame.srcdoc = disp;
    }).catch(() => toast("Não achei o HTML da arte.", "error"));
  }
  function wireDoc(doc) {
    const card = doc.querySelector(".card") || doc.body;
    artW = card.offsetWidth || 1080; artH = card.offsetHeight || 1080;
    frame.style.width = artW + "px"; frame.style.height = artH + "px";
    const stage = ov.querySelector(".editor-stage");
    fitScale = Math.min((stage.clientWidth - 48) / artW, (stage.clientHeight - 48) / artH, 1);
    applyZoom(fitScale); // aplica escala "ajustar à tela" + atualiza wrap/handle/leitura de %
    setSafeZone(); // dimensiona a marcação de zona segura conforme o formato da arte
    const INLINE = ["SPAN", "B", "I", "EM", "STRONG", "BR", "A", "SUP", "SUB", "SMALL", "MARK", "U"];
    const inlineOnly = (el) => Array.from(el.children).every((c) => INLINE.indexOf(c.tagName) >= 0);
    const isSvg = (el) => /^svg$/i.test(el.tagName);
    const isImg = (el) => el.tagName === "IMG";
    // "Caixa de ícone/imagem": sem texto próprio e com filhos só <img>/<svg> (ex.: os .fr-ic
    // do fluxo). Tratada como folha VISUAL — arrastável inteira. É o que destrava os ícones.
    const isIconWrap = (el) => {
      if ((el.textContent || "").trim()) return false;
      const k = Array.from(el.children);
      return k.length > 0 && k.every((c) => isImg(c) || isSvg(c));
    };
    // NÃO converte pra absoluto (quebrava o layout flex). Mantém o layout EXATO da arte
    // e move/redimensiona via transform (translate + scale) — pixel-perfect no re-render.
    Array.from(doc.querySelectorAll("body *")).forEach((el) => {
      if (el === card) return;
      // Já dentro de algo editável (ex.: o <svg> de uma caixa de ícone já marcada)? ignora,
      // pra não empilhar seleção. (querySelectorAll dá ordem de documento: pai antes do filho.)
      if (el.parentElement && el.parentElement.closest("[data-he]")) return;
      const cs = doc.defaultView.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      let editable;
      if (isImg(el) || isSvg(el) || isIconWrap(el)) editable = true;          // imagem, ícone ou caixa de ícone
      else {
        const txt = (el.textContent || "").trim();
        const parentInline = el.parentElement && inlineOnly(el.parentElement) && (el.parentElement.textContent || "").trim();
        editable = !!txt && inlineOnly(el) && !parentInline;                   // folha de texto
      }
      if (!editable) return;
      el.setAttribute("data-he", "1");
      interactive(doc, el);
    });
    card.addEventListener("mousedown", (e) => { if (e.target === card) select(null); });
    doc.addEventListener("wheel", onWheelZoom, { passive: false }); // Ctrl+roda sobre a arte também dá zoom
    select(null); snapshot(); // baseline p/ desfazer
  }
  function interactive(doc, el) {
    el.addEventListener("mousedown", (e) => {
      if (el.isContentEditable) return;
      e.preventDefault(); e.stopPropagation(); select(el);
      const sx = e.clientX, sy = e.clientY, tf = getTf(el);
      const mv = (ev) => {
        // Se o botão já não está pressionado (ex.: soltou o mouse FORA do iframe e o mouseup
        // não chegou aqui), encerra em vez de "grudar" o elemento no cursor ao passar por perto.
        if (ev.buttons === 0) { up(); return; }
        let nx = tf.x + (ev.clientX - sx), ny = tf.y + (ev.clientY - sy);
        if (!(ev.ctrlKey || ev.metaKey)) { const sn = snapMove(el, nx, ny); nx = sn.x; ny = sn.y; } // Ctrl segura = sem encaixe
        else clearGuides();
        setTf(el, Object.assign({}, tf, { x: nx, y: ny })); positionHandle(); dirty = true;
      };
      const up = () => {
        doc.removeEventListener("mousemove", mv); doc.removeEventListener("mouseup", up);
        document.removeEventListener("mouseup", up); clearGuides(); snapshot();
      };
      doc.addEventListener("mousemove", mv); doc.addEventListener("mouseup", up);
      document.addEventListener("mouseup", up); // pega o soltar quando o cursor sai do iframe
    });
    el.addEventListener("dblclick", () => {
      // Só folhas de TEXTO viram editáveis. Imagens, ícones (svg) e grupos NÃO — senão o
      // duplo-clique num bloco criaria um contentEditable que bagunça o layout da arte.
      if (el.tagName === "IMG" || /^svg$/i.test(el.tagName)) return;
      const INL = ["SPAN", "B", "I", "EM", "STRONG", "BR", "A", "SUP", "SUB", "SMALL", "MARK", "U"];
      const txt = (el.textContent || "").trim();
      const inlineKids = Array.from(el.children).every((c) => INL.indexOf(c.tagName) >= 0);
      if (!txt || !inlineKids) return;
      el.contentEditable = "true"; el.focus();
      const done = () => { el.contentEditable = "false"; el.removeEventListener("blur", done); dirty = true; snapshot(); };
      el.addEventListener("blur", done);
    });
  }
  function positionHandle() {
    if (!current) { handle.style.display = "none"; return; }
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const cr = card.getBoundingClientRect(), r = current.getBoundingClientRect();
    // Centro VISUAL (a bbox axis-aligned tem o mesmo centro do elemento, mesmo girado, pois
    // o transform-origin é 50% 50%). O canto inferior-direito VISUAL = centro + (metade da
    // caixa escalada) girado pelo ângulo — assim a alça acompanha a inclinação do elemento.
    const cx = (r.left + r.right) / 2 - cr.left, cy = (r.top + r.bottom) / 2 - cr.top;
    const tf = getTf(current);
    const hw = current.offsetWidth * tf.s / 2, hh = current.offsetHeight * tf.s / 2;
    const rad = (tf.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = hw * cos - hh * sin, dy = hw * sin + hh * cos;
    handle.style.left = ((cx + dx) * curScale - 7) + "px";
    handle.style.top = ((cy + dy) * curScale - 7) + "px";
    handle.style.display = "block";
  }
  // Zoom do palco: reescala o iframe e ajusta o wrap; a matemática de arrastar/redimensionar
  // já usa curScale, então mover/redimensionar continua 1:1 em qualquer zoom.
  function applyZoom(s) {
    curScale = Math.max(0.1, Math.min(4, s));
    frame.style.transform = "scale(" + curScale + ")";
    wrap.style.width = Math.round(artW * curScale) + "px";
    wrap.style.height = Math.round(artH * curScale) + "px";
    const lbl = $("#he-zoom-val"); if (lbl) lbl.textContent = Math.round(curScale * 100) + "%";
    positionHandle();
  }
  const zoomBy = (f) => applyZoom(curScale * f);
  // Ctrl/Cmd + roda = zoom. Precisa estar tanto no palco quanto DENTRO do iframe (a roda
  // sobre a arte dispara no documento do iframe e não sobe pro pai).
  function onWheelZoom(e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault(); e.stopPropagation(); if (!current) return;
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const tf = getTf(current), cr = card.getBoundingClientRect(), r = current.getBoundingClientRect();
    const cx = (r.left + r.right) / 2 - cr.left, cy = (r.top + r.bottom) / 2 - cr.top;
    const wr = wrap.getBoundingClientRect();
    const toIf = (mx, my) => [(mx - wr.left) / curScale, (my - wr.top) / curScale];
    const p0 = toIf(e.clientX, e.clientY), d0 = Math.hypot(p0[0] - cx, p0[1] - cy) || 1;
    // Camada de captura: um véu transparente sobre TODO o editor durante o arraste. Sem ele,
    // ao passar o cursor sobre o iframe os eventos iam pro documento do iframe (não pro de topo)
    // e o redimensionamento travava / "pulava". Com o véu, todo mousemove/mouseup chega aqui.
    const cap = document.createElement("div");
    cap.style.cssText = "position:fixed;inset:0;z-index:9999;cursor:nwse-resize";
    ov.appendChild(cap);
    const mv = (ev) => {
      const p = toIf(ev.clientX, ev.clientY); const s = Math.max(0.1, Math.min(8, tf.s * Math.hypot(p[0] - cx, p[1] - cy) / d0)); setTf(current, Object.assign({}, tf, { s: s })); positionHandle(); dirty = true;
    };
    const up = () => {
      cap.remove();
      document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); snapshot();
    };
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
  });
  // Liga/desliga um controle (input/select/button via .disabled; menu <details> via classe).
  function setCtl(id, off) {
    const n = $("#" + id); if (!n) return;
    if (n.tagName === "DETAILS") { n.classList.toggle("ctl-off", off); if (off) n.removeAttribute("open"); }
    else n.disabled = off;
  }
  function select(el) {
    if (current) current.removeAttribute("data-he-sel");
    current = el;
    const isImg = !!el && el.tagName === "IMG";
    ["he-font", "he-size", "he-bold", "he-italic", "he-align", "he-lh", "he-color", "he-eyedrop", "he-fx-menu"].forEach((id) => setCtl(id, !el || isImg)); // só texto
    ["he-replace", "he-filter-menu"].forEach((id) => setCtl(id, !isImg)); // só imagem
    ["he-opacity", "he-rot", "he-flip", "he-align2-menu", "he-layer-menu", "he-dup"].forEach((id) => setCtl(id, !el)); // qualquer elemento
    if (!el) { handle.style.display = "none"; return; }
    el.setAttribute("data-he-sel", "1");
    const cs = gcs(el), tf = getTf(el);
    const op = parseFloat(cs.opacity); if ($("#he-opacity")) $("#he-opacity").value = Math.round((isFinite(op) ? op : 1) * 100);
    if ($("#he-rot")) $("#he-rot").value = Math.round(tf.rot || 0);
    if (isImg) {
      readFilter(el);
    } else {
      $("#he-size").value = Math.round(parseFloat(cs.fontSize)) || 40;
      const c = rgbToHex(cs.color); if (c) $("#he-color").value = c;
      const fam = (cs.fontFamily || "").split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
      const fs = $("#he-font"); if (fs) Array.from(fs.options).forEach((o) => { if (o.value.toLowerCase().indexOf(fam) >= 0) fs.value = o.value; });
      $("#he-align").value = cs.textAlign === "center" ? "center" : (cs.textAlign === "right" || cs.textAlign === "end" ? "right" : "left");
      const lh = parseFloat(cs.lineHeight) / (parseFloat(cs.fontSize) || 1); $("#he-lh").value = isFinite(lh) ? Math.round(lh * 100) / 100 : "";
      $("#he-bold").classList.toggle("on", (parseInt(cs.fontWeight, 10) || 400) >= 700);
      $("#he-italic").classList.toggle("on", cs.fontStyle === "italic");
    }
    positionHandle();
  }
  // --- Desfazer/refazer: snapshot do innerHTML do card (sem marcações de seleção) ---
  function snapshot() {
    const doc = frame.contentDocument; if (!doc) return; const card = doc.querySelector(".card") || doc.body;
    const sel = card.querySelector("[data-he-sel]"); if (sel) sel.removeAttribute("data-he-sel");
    const html = card.innerHTML;
    if (sel) sel.setAttribute("data-he-sel", "1");
    hist = hist.slice(0, hi + 1); hist.push(html); hi = hist.length - 1;
    if (hist.length > 60) { hist.shift(); hi--; }
    updateUndo();
  }
  function updateUndo() { const u = $("#he-undo"), r = $("#he-redo"); if (u) u.disabled = hi <= 0; if (r) r.disabled = hi >= hist.length - 1; }
  function applyHist() {
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    current = null; handle.style.display = "none";
    card.innerHTML = hist[hi];
    card.querySelectorAll("[data-he]").forEach((el) => { el.removeAttribute("data-he-sel"); interactive(doc, el); });
    dirty = true;
  }
  function undo() { if (hi > 0) { hi--; applyHist(); updateUndo(); } }
  function redo() { if (hi < hist.length - 1) { hi++; applyHist(); updateUndo(); } }
  // --- Adicionar elementos ---
  function addImgNode(src, opts) {
    opts = opts || {};
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const img = doc.createElement("img"); img.src = src; img.setAttribute("data-he", "1");
    const w = opts.width || Math.round(card.offsetWidth * 0.3);
    img.style.cssText = "position:absolute;left:" + (opts.left != null ? opts.left : Math.round((card.offsetWidth - w) / 2)) + "px;top:" + (opts.top != null ? opts.top : Math.round(card.offsetHeight * 0.4)) + "px;width:" + w + "px;height:auto;" + (opts.opacity != null ? "opacity:" + opts.opacity + ";" : "");
    card.appendChild(img); interactive(doc, img); select(img); dirty = true; snapshot();
  }
  function addMark(type) {
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    if (type === "simbolo") { const w = Math.round(card.offsetWidth * 0.7); addImgNode("/brand-assets/simbolo.svg", { width: w, left: Math.round(card.offsetWidth * 0.5), top: Math.round(card.offsetHeight * 0.55), opacity: 0.06 }); return; }
    const el = doc.createElement("div"); el.textContent = type === "4selet" ? "4SELET" : "SELET"; el.setAttribute("data-he", "1");
    el.style.cssText = "position:absolute;left:" + Math.round(card.offsetWidth * 0.06) + "px;top:" + Math.round(card.offsetHeight * 0.42) + "px;font-family:'Inter',sans-serif;font-weight:900;font-size:200px;color:#FFFFFF;opacity:0.05;letter-spacing:-4px;white-space:nowrap;";
    card.appendChild(el); interactive(doc, el); select(el); dirty = true; snapshot();
  }
  $("#he-add-text").onclick = () => {
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const el = doc.createElement("div"); el.textContent = "Novo texto";
    el.style.cssText = "position:absolute;left:" + Math.round(card.offsetWidth * 0.28) + "px;top:" + Math.round(card.offsetHeight * 0.45) + "px;font-family:'Inter',sans-serif;font-size:56px;font-weight:700;color:#FFFFFF;";
    el.setAttribute("data-he", "1"); card.appendChild(el); interactive(doc, el); select(el); dirty = true; snapshot();
  };
  $("#he-logo-menu").querySelectorAll("button").forEach((b) => { b.onclick = () => { addImgNode(b.dataset.src, { width: Math.round((frame.contentDocument.querySelector(".card") || {}).offsetWidth * (parseFloat(b.dataset.w) || 0.3)), top: 80 }); $("#he-logo-menu").removeAttribute("open"); }; });
  $("#he-mark-menu").querySelectorAll("button").forEach((b) => { b.onclick = () => { addMark(b.dataset.mark); $("#he-mark-menu").removeAttribute("open"); }; });
  $("#he-add-img").onclick = () => $("#he-file").click();
  $("#he-file").onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => addImgNode(rd.result, { top: 120 }); rd.readAsDataURL(f); e.target.value = ""; };
  // --- Controles de texto ---
  const applyStyle = (fn) => { if (current && current.tagName !== "IMG") { fn(current); dirty = true; } };
  $("#he-size").oninput = () => applyStyle((el) => { el.style.fontSize = (parseInt($("#he-size").value, 10) || 40) + "px"; positionHandle(); });
  $("#he-size").onchange = () => { if (current) snapshot(); };
  $("#he-font").onchange = () => { applyStyle((el) => { el.style.fontFamily = $("#he-font").value; }); positionHandle(); if (current) snapshot(); };
  $("#he-align").onchange = () => { applyStyle((el) => { el.style.textAlign = $("#he-align").value; }); positionHandle(); if (current) snapshot(); };
  $("#he-lh").oninput = () => applyStyle((el) => { el.style.lineHeight = $("#he-lh").value || ""; positionHandle(); });
  $("#he-lh").onchange = () => { if (current) snapshot(); };
  $("#he-bold").onclick = () => { applyStyle((el) => { const w = parseInt(gcs(el).fontWeight, 10) || 400; el.style.fontWeight = w >= 700 ? "400" : "700"; $("#he-bold").classList.toggle("on", w < 700); }); if (current) snapshot(); };
  $("#he-italic").onclick = () => { applyStyle((el) => { const it = gcs(el).fontStyle === "italic"; el.style.fontStyle = it ? "normal" : "italic"; $("#he-italic").classList.toggle("on", !it); }); if (current) snapshot(); };
  $("#he-color").oninput = () => applyStyle((el) => { el.style.color = $("#he-color").value; });
  $("#he-color").onchange = () => { if (current) snapshot(); };
  $("#he-del").onclick = () => { if (current) { current.remove(); select(null); dirty = true; snapshot(); } };
  $("#he-undo").onclick = undo; $("#he-redo").onclick = redo;

  // ===== Recursos "editor completo" (lote pedido pelo Hugo) =====
  const applyAny = (fn) => { if (current) { fn(current); dirty = true; } }; // vale p/ texto E imagem
  // Opacidade (texto e imagem)
  $("#he-opacity").oninput = () => applyAny((el) => { el.style.opacity = (+$("#he-opacity").value / 100); });
  $("#he-opacity").onchange = () => { if (current) snapshot(); };
  // Rotação (graus)
  $("#he-rot").oninput = () => applyAny((el) => { setTf(el, Object.assign({}, getTf(el), { rot: parseFloat($("#he-rot").value) || 0 })); positionHandle(); });
  $("#he-rot").onchange = () => { if (current) snapshot(); };
  // Espelhar na horizontal
  $("#he-flip").onclick = () => { applyAny((el) => { const t = getTf(el); setTf(el, Object.assign({}, t, { fx: -t.fx })); }); if (current) snapshot(); };
  // Duplicar (Ctrl+D)
  function duplicateCurrent() {
    if (!current) return;
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const clone = current.cloneNode(true); clone.removeAttribute("data-he-sel");
    if (gcs(current).position === "static") { clone.style.position = "absolute"; clone.style.left = current.offsetLeft + "px"; clone.style.top = current.offsetTop + "px"; }
    const t = getTf(current); setTf(clone, Object.assign({}, t, { x: t.x + 24, y: t.y + 24 }));
    card.appendChild(clone); interactive(doc, clone); select(clone); dirty = true; snapshot();
  }
  $("#he-dup").onclick = duplicateCurrent;
  // "Grupo ↑": sobe a seleção pro elemento-pai (o bloco em volta) e o torna arrastável na
  // hora. Assim dá pra mover uma coluna/caixa inteira de uma vez, não só a folha clicada.
  $("#he-parent").onclick = () => {
    if (!current) return;
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const p = current.parentElement;
    if (!p || p === card || p === doc.body) { toast("Já está no bloco mais externo.", "warn"); return; }
    if (!p.hasAttribute("data-he")) { p.setAttribute("data-he", "1"); interactive(doc, p); }
    select(p);
  };
  // Alinhar em relação ao quadro (a bbox reflete o transform, então a conta fecha com rotação/escala)
  $("#he-align2-menu").querySelectorAll("button").forEach((b) => { b.onclick = () => {
    if (!current) return;
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const cr = card.getBoundingClientRect(), r = current.getBoundingClientRect(), t = getTf(current);
    const elCx = (r.left + r.right) / 2 - cr.left, elCy = (r.top + r.bottom) / 2 - cr.top;
    let nx = t.x, ny = t.y, m = b.dataset.al;
    if (m === "cx") nx = t.x + (cr.width / 2 - elCx);
    else if (m === "cy") ny = t.y + (cr.height / 2 - elCy);
    else if (m === "left") nx = t.x - (r.left - cr.left);
    else if (m === "right") nx = t.x + (cr.width - (r.right - cr.left));
    else if (m === "top") ny = t.y - (r.top - cr.top);
    else if (m === "bottom") ny = t.y + (cr.height - (r.bottom - cr.top));
    setTf(current, Object.assign({}, t, { x: nx, y: ny })); positionHandle(); dirty = true; snapshot();
    $("#he-align2-menu").removeAttribute("open");
  }; });
  // Ordem das camadas (z-index; position:relative sem offsets não move o elemento)
  let zTop = 5, zBottom = 0;
  $("#he-layer-menu").querySelectorAll("button").forEach((b) => { b.onclick = () => {
    if (current) { if (gcs(current).position === "static") current.style.position = "relative"; current.style.zIndex = b.dataset.lay === "front" ? (++zTop) : (--zBottom); dirty = true; snapshot(); }
    $("#he-layer-menu").removeAttribute("open");
  }; });
  // Trocar a imagem selecionada (mantém posição/tamanho)
  $("#he-replace").onclick = () => { if (current && current.tagName === "IMG") $("#he-replace-file").click(); };
  $("#he-replace-file").onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f || !current || current.tagName !== "IMG") return; const rd = new FileReader(); rd.onload = () => { current.src = rd.result; dirty = true; snapshot(); positionHandle(); }; rd.readAsDataURL(f); e.target.value = ""; };
  // Filtros de imagem (brilho/contraste/saturação/p&b) — CSS filter, 100% fiel no re-render
  function writeFilter(el, o) {
    const p = [];
    if (o.bri !== 100) p.push("brightness(" + (o.bri / 100) + ")");
    if (o.con !== 100) p.push("contrast(" + (o.con / 100) + ")");
    if (o.sat !== 100) p.push("saturate(" + (o.sat / 100) + ")");
    if (o.gray) p.push("grayscale(1)");
    el.style.filter = p.join(" ");
  }
  function readFilter(el) {
    const f = el.style.filter || "", g = (re) => { const m = f.match(re); return m ? Math.round(parseFloat(m[1]) * 100) : 100; };
    if ($("#he-f-bri")) $("#he-f-bri").value = g(/brightness\(([\d.]+)/);
    if ($("#he-f-con")) $("#he-f-con").value = g(/contrast\(([\d.]+)/);
    if ($("#he-f-sat")) $("#he-f-sat").value = g(/saturate\(([\d.]+)/);
  }
  function filtSliders() {
    if (!current || current.tagName !== "IMG") return;
    writeFilter(current, { bri: +$("#he-f-bri").value, con: +$("#he-f-con").value, sat: +$("#he-f-sat").value, gray: /grayscale/.test(current.style.filter || "") });
    dirty = true;
  }
  ["he-f-bri", "he-f-con", "he-f-sat"].forEach((id) => { const n = $("#" + id); if (n) { n.oninput = filtSliders; n.onchange = () => { if (current) snapshot(); }; } });
  $("#he-filter-menu").querySelectorAll("button[data-filt]").forEach((b) => { b.onclick = () => {
    if (!current || current.tagName !== "IMG") return;
    if (b.dataset.filt === "gray") writeFilter(current, { bri: +$("#he-f-bri").value, con: +$("#he-f-con").value, sat: +$("#he-f-sat").value, gray: !/grayscale/.test(current.style.filter || "") });
    else { current.style.filter = ""; $("#he-f-bri").value = 100; $("#he-f-con").value = 100; $("#he-f-sat").value = 100; }
    dirty = true; snapshot();
  }; });
  // Efeitos de texto (sombra / contorno / caixa) — CSS inline, fiel no re-render
  $("#he-fx-menu").querySelectorAll("button").forEach((b) => { b.onclick = () => {
    if (current && current.tagName !== "IMG") {
      const el = current, k = b.dataset.fx;
      el.style.textShadow = ""; el.style.webkitTextStroke = "";
      if (k === "none") { el.style.background = ""; el.style.display = ""; el.style.padding = ""; el.style.borderRadius = ""; } // limpa TUDO da caixa (senão display:inline-block vazava no PNG)
      if (k === "shadow") el.style.textShadow = "0 2px 10px rgba(0,0,0,.55)";
      else if (k === "outline") el.style.webkitTextStroke = "1.5px rgba(0,0,0,.85)";
      else if (k === "box") { el.style.background = "rgba(7,33,43,.72)"; el.style.display = "inline-block"; el.style.padding = el.style.padding || "0.14em 0.5em"; el.style.borderRadius = el.style.borderRadius || "10px"; }
      dirty = true; snapshot();
    }
    $("#he-fx-menu").removeAttribute("open");
  }; });
  // Conta-gotas (EyeDropper nativa do Chromium) — pega cor de qualquer pixel p/ o texto
  if (!window.EyeDropper) { const ed = $("#he-eyedrop"); if (ed) ed.style.display = "none"; }
  $("#he-eyedrop").onclick = async () => {
    if (!current || current.tagName === "IMG" || !window.EyeDropper) return;
    try { const res = await new window.EyeDropper().open(); if (res && res.sRGBHex) { current.style.color = res.sRGBHex; $("#he-color").value = res.sRGBHex; dirty = true; snapshot(); } } catch (_) { /* cancelou */ }
  };
  // Blocos de marca (CTA / rodapé / selo) — inserção com 1 clique, paleta 4Selet
  function addBlock(kind) {
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body, W = card.offsetWidth, H = card.offsetHeight;
    let el = doc.createElement("div");
    if (kind === "cta") { el.textContent = "Fale no WhatsApp"; el.style.cssText = "position:absolute;left:" + Math.round(W * 0.27) + "px;top:" + Math.round(H * 0.8) + "px;font-family:'Inter',sans-serif;font-weight:700;font-size:" + Math.round(W * 0.034) + "px;color:#07212B;background:#5499B5;padding:" + Math.round(W * 0.016) + "px " + Math.round(W * 0.032) + "px;border-radius:999px;white-space:nowrap;"; }
    else if (kind === "footer") { el.textContent = "@4selet  ·  Para quem sabe que é Selet."; el.style.cssText = "position:absolute;left:" + Math.round(W * 0.08) + "px;top:" + Math.round(H * 0.92) + "px;font-family:'Inter',sans-serif;font-weight:600;font-size:" + Math.round(W * 0.022) + "px;color:#AFBCC9;letter-spacing:.4px;white-space:nowrap;"; }
    else { el.textContent = "TAXA ZERO"; el.style.cssText = "position:absolute;left:" + Math.round(W * 0.62) + "px;top:" + Math.round(H * 0.08) + "px;font-family:'Inter',sans-serif;font-weight:800;font-size:" + Math.round(W * 0.03) + "px;color:#07212B;background:#5499B5;padding:" + Math.round(W * 0.012) + "px " + Math.round(W * 0.024) + "px;border-radius:8px;letter-spacing:1px;white-space:nowrap;"; }
    el.setAttribute("data-he", "1"); card.appendChild(el); interactive(doc, el); select(el); dirty = true; snapshot();
  }
  $("#he-block-menu").querySelectorAll("button").forEach((b) => { b.onclick = () => { addBlock(b.dataset.block); $("#he-block-menu").removeAttribute("open"); }; });
  // --- Encaixe inteligente (snap) ao arrastar: bordas/centros de outros elementos e do quadro ---
  const SNAP = 6; // limiar em art px
  function snapMove(el, nx, ny) {
    const doc = frame.contentDocument, card = doc.querySelector(".card") || doc.body;
    const cr = card.getBoundingClientRect(), cur = getTf(el), r = el.getBoundingClientRect();
    const dx = nx - cur.x, dy = ny - cur.y;
    const L = r.left - cr.left + dx, R = r.right - cr.left + dx, Cx = (r.left + r.right) / 2 - cr.left + dx;
    const T = r.top - cr.top + dy, B = r.bottom - cr.top + dy, Cy = (r.top + r.bottom) / 2 - cr.top + dy;
    const vx = [0, cr.width / 2, cr.width], hy = [0, cr.height / 2, cr.height];
    card.querySelectorAll("[data-he]").forEach((o) => { if (o === el) return; const q = o.getBoundingClientRect(); vx.push(q.left - cr.left, (q.left + q.right) / 2 - cr.left, q.right - cr.left); hy.push(q.top - cr.top, (q.top + q.bottom) / 2 - cr.top, q.bottom - cr.top); });
    let bx = SNAP + 1, ox = nx, gx = null; [L, Cx, R].forEach((v) => vx.forEach((t) => { const d = Math.abs(v - t); if (d < bx) { bx = d; ox = nx + (t - v); gx = t; } }));
    let by = SNAP + 1, oy = ny, gy = null; [T, Cy, B].forEach((v) => hy.forEach((t) => { const d = Math.abs(v - t); if (d < by) { by = d; oy = ny + (t - v); gy = t; } }));
    drawGuides(bx <= SNAP ? gx : null, by <= SNAP ? gy : null);
    return { x: bx <= SNAP ? ox : nx, y: by <= SNAP ? oy : ny };
  }
  function drawGuides(gx, gy) {
    const glv = $("#he-gl-v"), glh = $("#he-gl-h");
    if (glv) { if (gx == null) glv.hidden = true; else { glv.hidden = false; glv.style.left = (gx * curScale) + "px"; } }
    if (glh) { if (gy == null) glh.hidden = true; else { glh.hidden = false; glh.style.top = (gy * curScale) + "px"; } }
  }
  function clearGuides() { const glv = $("#he-gl-v"), glh = $("#he-gl-h"); if (glv) glv.hidden = true; if (glh) glh.hidden = true; }
  // --- Zonas seguras do Instagram (feed / 4:5 / story-reels) ---
  function setSafeZone() {
    const safe = $("#he-safe"); if (!safe) return;
    const ratio = artW / artH; let ins;
    if (ratio > 1.15) ins = { t: 6, r: 5, b: 6, l: 5 };
    else if (ratio > 0.95) ins = { t: 4, r: 4, b: 4, l: 4 };   // 1:1 feed (~40px)
    else if (ratio > 0.7) ins = { t: 4, r: 4, b: 5, l: 4 };    // 4:5 feed
    else ins = { t: 14, r: 6, b: 20, l: 6 };                   // 9:16 story/reels (faixas da UI)
    safe.style.top = ins.t + "%"; safe.style.right = ins.r + "%"; safe.style.bottom = ins.b + "%"; safe.style.left = ins.l + "%";
  }
  $("#he-safe-btn").onclick = () => { const safe = $("#he-safe"), on = safe.hidden; safe.hidden = !on; const b = $("#he-safe-btn"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); };

  // --- Zoom + grade/guias (deixa o editor mais completo, estilo Canva/Figma) ---
  $("#he-zoom-in").onclick = () => zoomBy(1.2);
  $("#he-zoom-out").onclick = () => zoomBy(1 / 1.2);
  $("#he-zoom-val").onclick = () => applyZoom(fitScale); // clicar no % volta pro "ajustar à tela"
  const overlay = $("#he-overlay");
  const toggleOverlay = (cls, btnId) => { const on = overlay.classList.toggle(cls); const b = $("#" + btnId); if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } };
  $("#he-grid-btn").onclick = () => toggleOverlay("grid", "he-grid-btn");
  $("#he-guides-btn").onclick = () => toggleOverlay("guides", "he-guides-btn");
  // Ctrl/Cmd + roda do mouse = zoom (padrão dos editores). Sem Ctrl, rola o palco normalmente.
  ov.querySelector(".editor-stage").addEventListener("wheel", onWheelZoom, { passive: false });
  // fecha menus abertos ao clicar fora
  ov.addEventListener("click", (e) => { if (!e.target.closest("details.ed-menu")) ov.querySelectorAll("details.ed-menu[open]").forEach((d) => d.removeAttribute("open")); });
  // atalhos de teclado
  function onKey(e) {
    const fd = frame.contentDocument, ae = fd && fd.activeElement;
    if (ae && ae.isContentEditable) return;
    const t = (document.activeElement || {}).tagName;
    if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
    if ((e.key === "Delete" || e.key === "Backspace") && current) { e.preventDefault(); current.remove(); select(null); dirty = true; snapshot(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomBy(1.2); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) { e.preventDefault(); zoomBy(1 / 1.2); }
    else if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); applyZoom(fitScale); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) { e.preventDefault(); duplicateCurrent(); }
    // (As setas NÃO empurram mais o elemento — Hugo pediu pra remover esse "empurra pro lado".)
  }
  document.addEventListener("keydown", onKey);
  function updateNav() {
    if (!multiSlide) return;
    const i = targets.findIndex((t) => t.rel === curRel);
    const c = $("#he-count"); if (c) c.textContent = (i + 1) + " / " + targets.length;
    const p = $("#he-prev"), n = $("#he-next"); if (p) p.disabled = i <= 0; if (n) n.disabled = i >= targets.length - 1;
  }
  async function goSlide(d) {
    const i = targets.findIndex((t) => t.rel === curRel), ni = i + d;
    if (ni < 0 || ni >= targets.length) return;
    if (dirty && !(await uiConfirm("Trocar de slide descarta as edições não salvas. Continuar?", { confirmText: "Trocar" }))) return;
    loadInto(targets[ni].rel);
  }
  if (multiSlide) { $("#he-prev").onclick = () => goSlide(-1); $("#he-next").onclick = () => goSlide(1); }
  const close = () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("no-scroll"); ov.remove(); if (dirty || changed) router(); };
  $("#he-close").onclick = close;
  let savedT = null;
  $("#he-save").onclick = async () => {
    const btn = $("#he-save"); btn.disabled = true; const o = btn.dataset.label || btn.textContent; btn.dataset.label = o;
    btn.classList.remove("is-saved"); btn.textContent = "Salvando…";
    try {
      const doc = frame.contentDocument;
      // Trabalha num CLONE — nunca no DOM vivo do editor. Se mexêssemos no vivo, as imagens
      // voltariam para file:// (quebram na tela) e os elementos perderiam data-he (paravam de editar).
      const root = doc.documentElement.cloneNode(true);
      const st = root.querySelector("#he-editstyle"); if (st) st.remove(); // mantém #he-fonts (re-render precisa)
      root.querySelectorAll("[data-he]").forEach((el) => { el.removeAttribute("data-he"); el.removeAttribute("data-he-sel"); el.removeAttribute("contenteditable"); });
      // reverte assets (/brand-assets//uploads/ -> file://) SÓ nos atributos src/href,
      // não na string inteira (evita corromper texto que contenha o token).
      root.querySelectorAll("[src],[href]").forEach((el) => {
        ["src", "href"].forEach((attr) => {
          const v = el.getAttribute(attr); if (!v) return;
          for (const mp of assetMaps) { if (v.indexOf(mp[1]) === 0) { el.setAttribute(attr, mp[0] + v.slice(mp[1].length)); break; } }
        });
      });
      const html = "<!DOCTYPE html>" + root.outerHTML;
      const r = await API.saveEditedHtml(folder, curRel, html);
      if (!r || !r.ok) { toast("Aviso: verifique a arte.", "warn"); }
      dirty = false; changed = true; // 'changed' garante o refresh da peça ao fechar (sem F5)
      toast("Arte salva. A peça foi atualizada.", "success");
      // Confirmação visível no próprio botão: fica verde "Salvo ✓" por alguns segundos.
      btn.disabled = false; btn.classList.add("is-saved"); btn.textContent = "Salvo ✓";
      clearTimeout(savedT); savedT = setTimeout(() => { btn.classList.remove("is-saved"); btn.textContent = o; }, 2600);
      return;
    } catch (e) { toast((e && e.message) || "Erro ao salvar.", "error"); }
    btn.disabled = false; btn.textContent = o;
  };
  loadInto(curRel);
}

// Painel "Camadas" (A1): editar direto texto/tema de cada slide do carrossel, sem IA.
// Area de "Desfazer" + histórico de versões da peça (após qualquer ajuste/edição).
async function wireUndo(folder, task) {
  const box = $("#undo-area"); if (!box) return;
  const ct = (State.meta.content_types || []).find((c) => c.kind === task.kind);
  const file = ct && ct.file;
  if (!file || task.zone !== "active") { box.innerHTML = ""; return; }
  let versions = [];
  try { versions = (await API.contentVersions(folder, file)).versions || []; } catch (e) { box.innerHTML = ""; return; }
  if (!versions.length) {
    box.innerHTML = '<p class="hint" style="margin-top:12px">Sem histórico ainda — o primeiro ajuste já cria um ponto de retorno.</p>';
    return;
  }
  const rows = versions.map((v) => '<div class="ver-row"><div class="ver-main"><span class="ver-when">' + esc(fmtDateTime(v.ts)) + "</span>"
    + (v.note ? '<span class="ver-note">' + esc(v.note) + "</span>" : "") + '</div><button class="btn btn-sm btn-ghost" data-restore="' + esc(v.id) + '">Restaurar</button></div>').join("");
  box.innerHTML = '<div class="undo-head mt"><button class="btn btn-sm" id="btn-undo" title="Volta ao estado anterior ao último ajuste">&#8630; Desfazer último ajuste</button>'
    + '<button class="btn btn-sm btn-ghost" id="btn-history">Histórico (' + versions.length + ')</button></div>'
    + '<div class="ver-list" id="ver-list" hidden>' + rows + "</div>";
  $("#btn-undo").onclick = () => doRestore(folder, file, versions[0].id, task);
  $("#btn-history").onclick = () => { const l = $("#ver-list"); if (l) l.hidden = !l.hidden; };
  $$("#ver-list [data-restore]").forEach((b) => { b.onclick = () => doRestore(folder, file, b.dataset.restore, task); });
}
async function doRestore(folder, file, id, task) {
  if (!await uiConfirm("Restaurar esta versão? A versão atual fica guardada no histórico — dá para voltar depois.", { confirmText: "Restaurar" })) return;
  toast("Restaurando…", "info");
  try {
    await API.restoreVersion(folder, file, id);
    if (autoRenders(task.kind)) await API.renderMedia(folder, task.kind, selectedTemplate());
    toast("Versão restaurada.", "success");
    router();
  } catch (e) { toast((e && e.message) || "Erro ao restaurar.", "error"); }
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
    const r = await API.refine({ content_type: ctId, current, instruction, images: REFINE_IMAGES.slice(), campaign_id: s.campaign_id || undefined, pillar: task.pillar || undefined });
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

// ---- Legenda de peça importada (ler/gravar no detalhe) ----
async function loadImportedCaption(folder) {
  const ta = $("#task-caption"); if (!ta) return;
  try {
    // Checa r.ok (404 = sem legenda) em vez de farejar o conteúdo — assim uma legenda
    // que comece com '{"error' não é confundida com "arquivo não encontrado".
    const r = await fetch("/api/content/" + encodeURIComponent(folder) + "/file?rel=" + encodeURIComponent("copy/instagram_caption.txt"));
    ta.value = r.ok ? (await r.text()).replace(/\n+$/, "") : "";
  } catch (e) { ta.value = ""; }
}
async function saveImportedCaption(folder) {
  const ta = $("#task-caption"); if (!ta) return;
  const btn = $("#btn-save-caption"); const orig = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> salvando…'; }
  try { await API.saveCaption(folder, ta.value); toast("Legenda salva", "success"); }
  catch (e) { toast((e && e.message) || "Falha ao salvar a legenda", "error"); }
  finally { if (btn) { btn.disabled = false; btn.textContent = orig; } }
}

/* =====================================================================
   IMPORTAR CONTEÚDO PRONTO (feito fora do painel)
   ===================================================================== */
let IMPORT_IMGS = []; // dataURLs das imagens escolhidas, na ordem

// Lê um File de imagem e devolve um dataURL JPEG redimensionado (lado maior <= maxDim).
// Reduz o tamanho do request (limite global de 16mb) e padroniza em formato IG-safe.
// Fundo branco pra PNG com transparência não virar preto ao virar JPEG.
function fileToScaledDataUrl(file, maxDim, quality) {
  maxDim = maxDim || 1440; quality = quality || 0.92;
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g)$/i.test(file.type || "")) { reject(new Error("use PNG ou JPEG")); return; }
    if (file.size > 25 * 1024 * 1024) { reject(new Error("imagem muito grande (máx 25MB)")); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("falha ao ler o arquivo"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("arquivo não é uma imagem válida"));
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const scale = Math.min(1, maxDim / Math.max(w, h || 1));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = cv.getContext("2d");
        cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h);
        cx.drawImage(img, 0, 0, w, h);
        try { resolve(cv.toDataURL("image/jpeg", quality)); } catch (e) { reject(new Error("falha ao processar a imagem")); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function importKind() { return ((($("#imp-kind") && $("#imp-kind").querySelector(".seg.on")) || {}).dataset || {}).kind || "feed"; }
function renderImportPreview() {
  const box = $("#imp-preview"); if (!box) return;
  if (!IMPORT_IMGS.length) { box.innerHTML = '<div class="empty">Escolha as imagens para ver a prévia aqui.</div>'; return; }
  box.innerHTML = `<div class="imp-preview-grid">${IMPORT_IMGS.map((d, i) => `<div class="imp-prev-item"><img src="${d}" alt="prévia ${i + 1}" />${IMPORT_IMGS.length > 1 ? '<span class="imp-thumb-n">' + (i + 1) + "</span>" : ""}</div>`).join("")}</div>`;
}
function renderImportThumbs() {
  const wrap = $("#imp-thumbs"); if (!wrap) return;
  const kind = importKind();
  const hint = $("#imp-files-hint");
  if (hint) hint.textContent = kind === "feed" ? "1 imagem (PNG ou JPEG)." : (IMPORT_IMGS.length + "/10 imagens — arraste a ordem com as setas.");
  wrap.innerHTML = IMPORT_IMGS.map((d, i) => `<div class="imp-thumb"><img src="${d}" alt="imagem ${i + 1}" /><span class="imp-thumb-n">${i + 1}</span>
    <div class="imp-thumb-ctrls">${kind === "carousel" ? `<button type="button" data-mv="up" data-i="${i}"${i === 0 ? " disabled" : ""} title="Antes">↑</button><button type="button" data-mv="down" data-i="${i}"${i === IMPORT_IMGS.length - 1 ? " disabled" : ""} title="Depois">↓</button>` : ""}<button type="button" data-rm="${i}" title="Remover">✕</button></div>
  </div>`).join("");
  wrap.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { IMPORT_IMGS.splice(+b.dataset.rm, 1); renderImportThumbs(); });
  wrap.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => {
    const i = +b.dataset.i, j = b.dataset.mv === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= IMPORT_IMGS.length) return;
    const t = IMPORT_IMGS[i]; IMPORT_IMGS[i] = IMPORT_IMGS[j]; IMPORT_IMGS[j] = t; renderImportThumbs();
  });
  renderImportPreview();
}
async function runImport() {
  const kind = importKind();
  const title = ($("#imp-title") && $("#imp-title").value.trim()) || "";
  const err = $("#imp-e-title"); if (err) err.textContent = "";
  if (title.length < 3) { if (err) err.textContent = "Dê um título à peça (mín. 3 caracteres)."; if ($("#imp-title")) $("#imp-title").focus(); return; }
  if (!IMPORT_IMGS.length) { toast("Escolha ao menos uma imagem.", "error"); return; }
  if (kind === "feed" && IMPORT_IMGS.length !== 1) { toast("O feed usa exatamente 1 imagem.", "error"); return; }
  if (kind === "carousel" && (IMPORT_IMGS.length < 2 || IMPORT_IMGS.length > 10)) { toast("O carrossel precisa de 2 a 10 imagens.", "error"); return; }
  const payload = {
    kind, title,
    task_date: ($("#imp-date") && $("#imp-date").value) || todayISO(),
    caption: ($("#imp-caption") && $("#imp-caption").value) || "",
    campaign_id: ($("#imp-camp") && $("#imp-camp").value) || undefined,
    pillar: ($("#imp-pillar") && $("#imp-pillar").value) || undefined,
    images: IMPORT_IMGS,
  };
  // O corpo do request tem teto de 16MB no servidor. Avisa antes de enviar (com margem)
  // em vez de deixar o envio falhar com erro genérico.
  const totalMB = payload.images.reduce((a, d) => a + d.length, 0) / (1024 * 1024);
  if (totalMB > 14) { toast("As imagens somam demais para enviar de uma vez (~" + totalMB.toFixed(0) + "MB). Use menos slides ou imagens menores.", "error"); return; }
  const btn = $("#imp-run"); btn.disabled = true; const orig = btn.textContent; btn.innerHTML = '<span class="spinner"></span> importando…';
  try {
    const r = await API.importContent(payload);
    toast("Conteúdo importado como rascunho", "success");
    IMPORT_IMGS = [];
    location.hash = "#/task/" + encodeURIComponent(r.folder);
  } catch (e) {
    toast((e && e.message) || "Falha ao importar", "error");
    btn.disabled = false; btn.textContent = orig;
  }
}
async function viewImport(arg, query) {
  setTitle("Importar conteúdo");
  const { campaigns } = await API.campaigns();
  setCampMap(campaigns);
  const preCamp = (query && query.campaign) || "";
  const campOpts = '<option value="">— sem campanha —</option>' + campaigns.map((c) => `<option value="${esc(c.id)}"${c.id === preCamp ? " selected" : ""}>${esc(c.name)}</option>`).join("");
  const pillarOpts = '<option value="">— sem pilar —</option>' + (State.meta.content_pillars || []).map((p) => `<option value="${esc(p.id)}" title="${esc(p.description)}">${esc(p.label)}</option>`).join("");
  IMPORT_IMGS = [];
  setView(`
    <div class="grid grid-2">
      <div class="card">
        <h3>Importar conteúdo pronto</h3>
        <p class="muted create-lead">Fez a peça em outro serviço e quer usar o painel para revisar, agendar e publicar? Traga a imagem (ou os slides) e a legenda — vira um rascunho no fluxo normal.</p>

        <div class="form-section">
          <div class="form-section-head"><span class="fs-num">1</span><h4>Tipo</h4></div>
          <div class="field"><div class="seg-group" id="imp-kind">
            <button type="button" class="seg on" data-kind="feed">Feed — 1 imagem</button>
            <button type="button" class="seg" data-kind="carousel">Carrossel — várias imagens</button>
          </div><div class="hint mt" id="imp-kind-hint">Uma imagem única para o feed.</div></div>
        </div>

        <div class="form-section">
          <div class="form-section-head"><span class="fs-num">2</span><h4>Imagens</h4></div>
          <div class="field">
            <div class="photo-pick"><label class="btn btn-sm btn-ghost"><input type="file" id="imp-files" accept="image/png,image/jpeg" multiple hidden /> Escolher imagem</label><span class="hint" id="imp-files-hint">PNG ou JPEG.</span></div>
            <div class="imp-thumbs" id="imp-thumbs"></div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-head"><span class="fs-num">3</span><h4>Legenda e dados</h4></div>
          <div class="field"><label>Título da peça</label><input id="imp-title" placeholder="ex.: Taxa Zero — carrossel de prova" aria-describedby="imp-e-title" /><div class="field-error" id="imp-e-title" role="alert"></div></div>
          <div class="field"><label>Legenda <span class="hint">(hook, corpo, CTA e hashtags — o que vai na postagem)</span></label><textarea id="imp-caption" rows="5" placeholder="Escreva a legenda que acompanha a peça"></textarea></div>
          <div class="row">
            <div class="field"><label>Campanha <span class="hint">(opcional)</span></label><select id="imp-camp">${campOpts}</select></div>
            <div class="field"><label>Data</label><input type="date" id="imp-date" value="${todayISO()}" style="max-width:220px" /></div>
          </div>
          <div class="field"><label>Pilar de conteúdo <span class="hint">(opcional)</span></label><select id="imp-pillar">${pillarOpts}</select></div>
        </div>

        <div class="form-foot">
          <button class="btn btn-primary btn-block" id="imp-run">Importar como rascunho</button>
        </div>
      </div>
      <div class="card">
        <h3>Prévia</h3>
        <p class="muted mt">É assim que os arquivos entram na peça. Depois você revisa, ajusta a legenda, agenda e publica pelo fluxo normal.</p>
        <div id="imp-preview" class="mt"><div class="empty">Escolha as imagens para ver a prévia aqui.</div></div>
      </div>
    </div>`);

  const kindHints = { feed: "Uma imagem única para o feed.", carousel: "De 2 a 10 imagens, na ordem de publicação." };
  $$("#imp-kind .seg").forEach((b) => b.onclick = () => {
    $$("#imp-kind .seg").forEach((x) => x.classList.toggle("on", x === b));
    if ($("#imp-kind-hint")) $("#imp-kind-hint").textContent = kindHints[b.dataset.kind] || "";
    if (b.dataset.kind === "feed" && IMPORT_IMGS.length > 1) IMPORT_IMGS = IMPORT_IMGS.slice(0, 1);
    renderImportThumbs();
  });

  $("#imp-files").onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (importKind() === "feed" && files.length > 1) toast("O feed usa 1 imagem — usei a primeira que você escolheu.", "warn");
    for (const f of files) {
      if (importKind() === "feed") IMPORT_IMGS = [];
      try { IMPORT_IMGS.push(await fileToScaledDataUrl(f)); }
      catch (err) { toast((err && err.message) || "Não consegui ler a imagem", "error"); }
      if (importKind() === "feed") break;
    }
    e.target.value = "";
    if (importKind() === "carousel" && IMPORT_IMGS.length > 10) { IMPORT_IMGS = IMPORT_IMGS.slice(0, 10); toast("Máximo de 10 imagens no carrossel.", "warn"); }
    renderImportThumbs();
  };
  $("#imp-run").onclick = runImport;
  renderImportThumbs();
}

async function viewTaskDetail(folder) {
  const { task } = await API.task(folder);
  await ensureCampMap();
  const s = task.status;
  const isImported = !!(s && s.imported);
  setTitle(displayName(s));
  { const _bk = $("#btn-back"); if (_bk) _bk.dataset.fallback = task.zone === "approved" ? "#/approved" : "#/content"; }
  const actions = workflowActions(task);
  const canDiscard = task.zone !== "approved";
  const techSlug = s.title ? `<span class="dim" style="font-size:12.5px">identificador: <span class="codeblock">${esc(s.task_name)}</span></span>` : "";
  const pillarTag = (task.pillar && pillarLabel(task.pillar)) ? tag("Pilar: " + pillarLabel(task.pillar)) : "";
  State.task = task; // o "Editar" do lightbox usa a peça atual
  setView(`
    <div class="flex flex-wrap mb" style="align-items:center">${statusBadge(s.status)}${tag(kindLabel(task.kind))}${isImported ? tag("Importada") : ""}${pillarTag}${tag(zoneLabel(task.zone))}${(s.platforms || []).map((p) => tag(platformLabel(p))).join("")}${techSlug}<button class="btn btn-sm btn-ghost" id="btn-phone" title="Ver como fica no celular" style="margin-left:auto"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M12 18h.01"/></svg>Ver no celular</button></div>
    ${task.kind === "carousel" ? (carouselStrip(folder, task) || mediaGallery(folder, task)) : mediaGallery(folder, task)}
    <div class="grid grid-2 mt">
      <div class="card">
        <h3>Arquivos</h3>
        ${visibleFiles(task).length ? '<div class="list mt">' + visibleFiles(task).map((f) => fileRow(folder, f)).join("") + "</div>" : '<div class="empty">Sem arquivos de conteúdo.</div>'}
      </div>
      <div>
        ${renderPanel(folder, task)}
        ${refineCard(task)}
        ${(isImported && task.zone === "active") ? `<div class="card mt">
          <div class="flex-between"><h3>Legenda</h3><button class="btn btn-sm" id="btn-save-caption">Salvar legenda</button></div>
          <textarea id="task-caption" rows="6" class="mt" placeholder="Legenda da postagem — hook, corpo e CTA. Hashtags no fim.">Carregando…</textarea>
          <p class="muted mt">Legenda que vai junto da peça ao publicar. Corrija e salve — a arte importada não muda.</p>
        </div>` : ""}
        <div class="card mt">
          <div class="flex-between"><h3>Tags</h3><button class="btn btn-sm" id="btn-tags">Editar</button></div>
          <div class="chips mt" id="task-tags">${(task.tags && task.tags.length) ? task.tags.map((tg) => '<span class="cc-tag">' + esc(tg) + "</span>").join("") : '<span class="muted">Sem tags ainda.</span>'}</div>
          <p class="muted mt">Rótulos livres para organizar e filtrar na biblioteca.</p>
        </div>
        <div class="card mt">
          <div class="flex-between"><h3>Coleções</h3>${task.zone === "approved" ? '<button class="btn btn-sm" id="btn-add-coll">Adicionar a uma coleção</button>' : ""}</div>
          <div class="chips mt" id="task-colls"><span class="muted">Carregando…</span></div>
          <p class="muted mt">Coleções são agrupamentos curados (opcionais) com ordem própria. Não substituem tags nem campanhas.${task.zone !== "approved" ? " <strong>Só peças aprovadas</strong> podem entrar em coleções." : ""}</p>
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
  if ($("#btn-phone")) $("#btn-phone").onclick = () => openPhonePreview(task);
  if ($("#btn-add-coll")) $("#btn-add-coll").onclick = () => addToCollectionFlow(folder);
  if ($("#btn-refine")) { $("#btn-refine").onclick = () => refineTask(folder, task); wireRefineAttach(); }
  if (isImported) loadImportedCaption(folder);
  if ($("#btn-save-caption")) $("#btn-save-caption").onclick = () => saveImportedCaption(folder);
  wireUndo(folder, task);
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
    const r = await API.setTags(folder, res.tags);
    const norm = (r && r.tags) || [];
    toast("Tags atualizadas", "success");
    // Repinta SÓ o bloco de tags — em vez de router() re-renderizar a peça inteira (novo
    // fetch + rebuild + recarregar coleções). Mais fluido e sem "piscar" a tela.
    const box = $("#task-tags");
    if (box) box.innerHTML = norm.length ? norm.map((tg) => '<span class="cc-tag">' + esc(tg) + "</span>").join("") : '<span class="muted">Sem tags ainda.</span>';
    if (State.task && State.task.folder === folder) State.task.tags = norm;
    const btn = $("#btn-tags");
    if (btn) btn.onclick = () => editTags(folder, norm); // reabrir já com as tags novas
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
  if (s === "approved") return `<span class="badge approved">aprovada e salva</span><button class="btn btn-primary" data-wf="publish">Publicar ou agendar</button><button class="btn btn-sm" data-wf="rework">Reabrir para edição</button>`;
  if (s === "rejected") return `<button class="btn btn-sm" data-wf="rework">Reabrir para edição</button>`;
  return "";
}
function workflowHint(s) {
  if (s === "draft") return "Envia a peça para revisão antes da aprovação.";
  if (s === "in_review") return "Aprovar salva uma versão final protegida da peça. Rejeitar arquiva a peça.";
  if (s === "approved") return "Aprovada e travada. Para colocar no ar, use “Publicar ou agendar” — a peça já está aprovada, aqui você só escolhe QUANDO (não é uma nova aprovação). Para mudar a arte, use “Reabrir para edição”.";
  if (s === "rejected") return "Rejeitada e arquivada. Reabra para editar de novo.";
  return "";
}
function bindWorkflow(task) {
  $$("#wf-actions [data-wf]").forEach((btn) => {
    btn.onclick = async () => {
      const wf = btn.dataset.wf;
      if (wf === "publish") { openPublishModal(task); return; }
      const orig = btn.innerHTML;
      const busy = () => { $$("#wf-actions [data-wf]").forEach((b) => (b.disabled = true)); btn.innerHTML = '<span class="spinner"></span> processando…'; };
      try {
        if (wf === "preview") {
          busy(); const r = await API.preview(task.folder); if (!r.ok) throw new Error(r.stderr || "falha ao gerar a prévia"); toast("Peça enviada para revisão", "success");
        } else if (wf === "approve") {
          const res = await uiModal({ title: "Aprovar peça", message: "Salva uma versão final protegida da peça. Depois é só publicar ou agendar — sem aprovar de novo.", fields: [{ name: "by", label: "Aprovado por (seu nome)", value: (State.user && (State.user.name || State.user.username)) || "", placeholder: "ex.: Hugo Belo" }], confirmText: "Aprovar peça" });
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

// Prévia REALISTA de como a peça fica no Instagram (mockup do feed).
function instagramPreview(imgUrls, caption, username) {
  username = username || "4selet";
  const multi = imgUrls.length > 1;
  const cap = esc(caption || "").replace(/\n/g, "<br>");
  const ic = {
    heart: '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  };
  const chev = (d) => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="' + (d < 0 ? "15 18 9 12 15 6" : "9 18 15 12 9 6") + '"/></svg>';
  return `<div class="ig-post">
    <div class="ig-post-head"><span class="ig-post-av">4</span><span class="ig-post-name">${esc(username)}</span><span class="ig-post-more">•••</span></div>
    <div class="ig-post-media">
      <img class="ig-post-img" src="${esc(imgUrls[0] || "")}" alt="">
      ${multi ? '<button class="ig-nav ig-prev" data-d="-1" aria-label="Anterior">' + chev(-1) + '</button><button class="ig-nav ig-next" data-d="1" aria-label="Próximo">' + chev(1) + '</button><div class="ig-count"><span class="igp-idx">1</span>/' + imgUrls.length + "</div>" : ""}
    </div>
    ${multi ? '<div class="ig-dots">' + imgUrls.map((_, i) => '<span class="ig-dot' + (i === 0 ? " on" : "") + '"></span>').join("") + "</div>" : ""}
    <div class="ig-post-actions"><span class="ig-ic">${ic.heart}</span><span class="ig-ic">${ic.comment}</span><span class="ig-ic">${ic.share}</span><span class="ig-ic ig-save">${ic.save}</span></div>
    <div class="ig-post-likes">1.247 curtidas</div>
    <div class="ig-post-caption"><strong>${esc(username)}</strong> <span class="igp-cap">${cap}</span></div>
    <div class="ig-post-time">Há 2 horas</div>
  </div>`;
}
function wireIgPreview(root, imgUrls) {
  if (imgUrls.length < 2) return;
  let i = 0;
  const img = root.querySelector(".ig-post-img"), idx = root.querySelector(".igp-idx");
  const dots = root.querySelectorAll(".ig-dot");
  const show = () => { img.classList.add("swapping"); img.src = imgUrls[i]; if (idx) idx.textContent = i + 1; dots.forEach((d, k) => d.classList.toggle("on", k === i)); requestAnimationFrame(() => img.classList.remove("swapping")); };
  root.querySelectorAll(".ig-nav").forEach((b) => { b.onclick = () => { i = (i + parseInt(b.dataset.d, 10) + imgUrls.length) % imgUrls.length; show(); }; });
}

// Modal de publicar/agendar com a PRÉVIA do Instagram. Conectado = publica de verdade
// (confirma explícito); não conectado = simulado. Também dá pra AGENDAR (data/hora).
async function openPublishModal(task) {
  let st = {};
  try { st = (await API.publishStatus()).instagram || {}; } catch (e) { /* segue como não-conectado */ }
  const connected = !!st.configured;
  const uname = st.username || "4selet";
  const imgs = editorTargets(task).map((t) => API.rawUrl(task.folder, t.rel));
  if (!imgs.length) { toast("Esta peça não tem imagem publicável.", "error"); return; }
  const caption = await loadCaption(task.folder);

  const ov = document.createElement("div"); ov.className = "modal-ov pub-ov";
  ov.innerHTML = `<div class="modal pub-modal" role="dialog" aria-modal="true">
    <div class="pub-head"><h3>Publicar ou agendar</h3><button class="btn btn-ghost btn-sm" data-x="close">Fechar</button></div>
    <div class="pub-body">
      <div class="pub-preview">${instagramPreview(imgs, caption, uname)}</div>
      <div class="pub-form">
        <div class="pub-status">${connected ? '<span class="badge ok">Conectado</span> @' + esc(uname) + ' — <span class="hint">publica de verdade</span>' : '<span class="badge paused">Não conectado</span> <span class="hint">— modo simulado (não posta)</span>'}</div>
        <p class="hint">Esta peça já está <strong>aprovada</strong>. Aqui você só decide <strong>quando</strong> ela vai ao ar — publicar agora ou agendar.</p>
        <label class="layer-lab">Legenda</label>
        <textarea id="pub-caption" rows="6">${esc(caption)}</textarea>
        <p class="hint">Edite a legenda e veja a prévia atualizar ao lado.</p>
        <hr class="sep">
        <div class="pub-actions">
          <button class="btn btn-primary" id="pub-now">${connected ? "Publicar agora" : "Simular agora"}</button>
          <div class="pub-sched">
            <label class="layer-lab">Agendar para depois</label>
            <div class="flex"><input type="datetime-local" id="pub-when"><button class="btn" id="pub-schedule">Agendar</button></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov); document.body.classList.add("no-scroll");
  requestAnimationFrame(() => ov.classList.add("open"));
  const close = () => { ov.classList.remove("open"); document.body.classList.remove("no-scroll"); setTimeout(() => ov.remove(), 160); };
  ov.querySelector("[data-x='close']").onclick = close;
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  wireIgPreview(ov, imgs);
  const capEl = ov.querySelector("#pub-caption");
  capEl.addEventListener("input", () => { const c = ov.querySelector(".igp-cap"); if (c) c.innerHTML = esc(capEl.value).replace(/\n/g, "<br>"); });
  ov.querySelector("#pub-now").onclick = async () => {
    const cap = capEl.value.trim();
    if (connected && !(await uiConfirm("Isto PUBLICA de verdade em @" + esc(uname) + " agora. Confirmar?", { confirmText: "Publicar agora", confirmKind: "danger" }))) return;
    const btn = ov.querySelector("#pub-now"); btn.disabled = true; btn.textContent = "Publicando…";
    try {
      const r = await API.publishPiece(task.folder, { caption: cap || undefined, dryRun: !connected });
      toast(r.dry_run ? ("Simulado (" + r.type + "): " + r.reason) : "Publicado no Instagram!", r.dry_run ? "info" : "ok");
      close();
    } catch (e) { toast((e && e.message) || "Falha ao publicar.", "error"); btn.disabled = false; btn.textContent = connected ? "Publicar agora" : "Simular agora"; }
  };
  ov.querySelector("#pub-schedule").onclick = async () => {
    const when = ov.querySelector("#pub-when").value;
    if (!when) { toast("Escolha a data e a hora.", "error"); return; }
    const iso = new Date(when).toISOString();
    if (new Date(iso).getTime() < Date.now() + 30000) { toast("Escolha um horário no futuro.", "error"); return; }
    try {
      await API.schedulePost(task.folder, { caption: capEl.value.trim() || undefined, scheduled_at: iso, label: displayName(task) });
      toast("Agendado. Veja em Agendados.", "ok"); close();
    } catch (e) { toast((e && e.message) || "Falha ao agendar.", "error"); }
  };
}

// Carrega a legenda do Instagram da peça. instagram_caption.txt (feed/imagem) OU, se não
// existir (carrossel), tenta o JSON. Blinda contra o corpo de erro 404 (que vinha vazando
// como se fosse a legenda: {"error":"arquivo nao encontrado"}).
async function loadCaption(folder) {
  const bad = (s) => !s || /^\s*\{\s*"error"/.test(s);
  try { const c = await API.taskFile(folder, "copy/instagram_caption.txt"); if (!bad(c)) return c; } catch (e) { /* segue */ }
  try { const j = await API.taskFile(folder, "copy/instagram_carousel.json"); if (!bad(j)) { const o = JSON.parse(j); return o.caption || o.instagram_caption || o.legenda || (Array.isArray(o.hashtags) ? o.hashtags.join(" ") : "") || ""; } } catch (e) { /* segue */ }
  return "";
}

// Prévia no celular: mockup de smartphone moderno mostrando a peça como o público veria no
// Instagram — alterna entre Feed, Story e Reels, com interação (arrastar carrossel, tocar p/
// avançar o story, vídeo tocando). É só visualização; não altera a peça.
async function openPhonePreview(task) {
  const imgs = editorTargets(task).map((t) => API.rawUrl(task.folder, t.rel));
  const vidFile = (task.files || []).find((f) => f.isVideo);
  const videoUrl = vidFile ? API.rawUrl(task.folder, vidFile.rel) : "";
  if (!imgs.length && !videoUrl) { toast("Esta peça não tem mídia para prever no celular.", "error"); return; }
  const caption = await loadCaption(task.folder);
  const uname = "4selet";
  const fs = imgs.length ? imgs : [];
  const cover = imgs[0] || "";
  const capFirst = esc(((caption || "").split("\n").filter(Boolean)[0] || "")).slice(0, 110);
  const I = {
    heart: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
  };
  const tabBar = '<div class="ph-tabs">'
    + '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9.5 12 3l9 6.5V21h-6v-6H9v6H3z"/></svg>'
    + '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
    + '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>'
    + '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/></svg>'
    + '<span class="ph-tab-av">4</span></div>';
  function feedView() {
    return '<div class="ph-app ph-feed"><div class="ph-ig-top"><span class="ph-ig-logo">Instagram</span></div>'
      + '<div class="ph-feed-scroll">' + instagramPreview(fs.length ? fs : [cover], caption, uname) + '</div>' + tabBar + '</div>';
  }
  function storyView() {
    const src = fs.length ? fs : [cover];
    const bars = src.map((_, i) => '<span class="ph-sbar' + (i === 0 ? " on" : "") + '"><i></i></span>').join("");
    return '<div class="ph-app ph-story">'
      + '<img class="ph-9bg" src="' + esc(src[0]) + '" alt="">'
      + '<img class="ph-simg ph-9fg" src="' + esc(src[0]) + '" alt="">'
      + '<div class="ph-sbars">' + bars + '</div>'
      + '<div class="ph-shead"><span class="ph-av">4</span><span class="ph-sname">' + esc(uname) + '</span><span class="ph-sago">agora</span></div>'
      + '<div class="ph-tap ph-tap-l"></div><div class="ph-tap ph-tap-r"></div>'
      + '<div class="ph-sfoot"><div class="ph-sreply">Enviar mensagem…</div><span class="ph-sic">' + I.heart + '</span><span class="ph-sic">' + I.share + '</span></div></div>';
  }
  function reelView() {
    const media = videoUrl ? '<video class="ph-rmedia" src="' + esc(videoUrl) + '" autoplay loop muted playsinline></video>'
      : '<img class="ph-9bg" src="' + esc(cover) + '" alt=""><img class="ph-9fg" src="' + esc(cover) + '" alt="">';
    return '<div class="ph-app ph-reel">' + media
      + '<div class="ph-rrail"><span class="ph-ric">' + I.heart + '<b>1,2 mil</b></span><span class="ph-ric">' + I.comment + '<b>48</b></span><span class="ph-ric">' + I.share + '</span><span class="ph-ric">' + I.more + '</span></div>'
      + '<div class="ph-rfoot"><div class="ph-rname"><span class="ph-av">4</span> ' + esc(uname) + '</div>' + (capFirst ? '<div class="ph-rcap">' + capFirst + "</div>" : "") + "</div></div>";
  }
  // Só mostra abas COM conteúdo: sem imagens (peça só de vídeo) → apenas Reels (senão Feed/Story
  // renderizariam imagem vazia/quebrada). Reels sempre tem conteúdo (vídeo, ou a imagem de capa).
  const avail = (fs.length ? ["feed", "story"] : []).concat("reel");
  const initV = avail[0];
  const seg = avail.map((v) => '<button class="phone-tab' + (v === initV ? " on" : "") + '" data-v="' + v + '">' + (v === "feed" ? "Feed" : v === "story" ? "Story" : "Reels") + "</button>").join("");
  const status = '<div class="ph-status"><span>9:41</span><span class="ph-status-icons"><svg viewBox="0 0 18 12" width="17" height="11" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4" width="3" height="8" rx="1"/><rect x="10" y="1" width="3" height="11" rx="1"/></svg><svg viewBox="0 0 26 13" width="24" height="12" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="currentColor"/><rect x="3" y="3" width="15" height="7" rx="1.5" fill="currentColor"/><rect x="23" y="4" width="2" height="5" rx="1" fill="currentColor"/></svg></span></div>';
  const ov = document.createElement("div"); ov.className = "modal-ov phone-ov";
  ov.innerHTML = '<div class="phone-wrap" role="dialog" aria-modal="true">'
    + '<div class="phone-shell"><div class="phone-island"></div><div class="phone-screen' + (initV !== "feed" ? " dark" : "") + '">' + status + '<div class="phone-view" id="phone-view"></div></div></div>'
    + '<div class="phone-side">'
    +   '<div class="phone-side-head"><span class="phone-title">Prévia no celular</span><button class="btn btn-ghost btn-sm" data-x="close">Fechar</button></div>'
    +   '<div class="phone-seg">' + seg + "</div>"
    +   '<p class="phone-note">Como a sua peça aparece no Instagram. Arraste o carrossel ou toque para avançar o story. É só visualização — curtidas e tempo são ilustrativos.</p>'
    + "</div></div>";
  document.body.appendChild(ov); document.body.classList.add("no-scroll");
  requestAnimationFrame(() => ov.classList.add("open"));
  const close = () => { ov.classList.remove("open"); document.body.classList.remove("no-scroll"); setTimeout(() => ov.remove(), 160); };
  ov.querySelector("[data-x='close']").onclick = close;
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const host = ov.querySelector("#phone-view"), screen = ov.querySelector(".phone-screen");
  function wireStory(root) {
    const src = fs.length ? fs : [cover]; let i = 0;
    const img = root.querySelector(".ph-simg"), bg = root.querySelector(".ph-9bg"), bars = root.querySelectorAll(".ph-sbar");
    const show = () => {
      [img, bg].forEach((el) => { if (el) { el.classList.add("swapping"); el.src = src[i]; } });
      bars.forEach((b, k) => b.classList.toggle("on", k <= i));
      requestAnimationFrame(() => [img, bg].forEach((el) => el && el.classList.remove("swapping")));
    };
    const r = root.querySelector(".ph-tap-r"), l = root.querySelector(".ph-tap-l");
    if (r) r.onclick = () => { if (i < src.length - 1) { i++; show(); } };
    if (l) l.onclick = () => { if (i > 0) { i--; show(); } };
  }
  function render(v) {
    screen.classList.toggle("dark", v !== "feed");
    host.style.transition = "none"; host.style.opacity = "0"; // fade suave ao trocar Feed/Story/Reels
    host.innerHTML = v === "feed" ? feedView() : v === "story" ? storyView() : reelView();
    if (v === "feed") wireIgPreview(host, fs.length ? fs : [cover]);
    else if (v === "story") wireStory(host);
    void host.offsetWidth; // força reflow p/ a transição valer
    host.style.transition = "opacity .22s ease"; host.style.opacity = "1";
  }
  ov.querySelectorAll(".phone-tab").forEach((b) => { b.onclick = () => { if (b.classList.contains("on")) return; ov.querySelectorAll(".phone-tab").forEach((x) => x.classList.toggle("on", x === b)); render(b.dataset.v); }; });
  render(initV);
}

// View "Agendados": fila de publicações agendadas (revisar / cancelar).
async function viewSchedule() {
  setTitle("Agendados");
  let items = [];
  try { items = (await API.listSchedule()).items || []; } catch (e) { setView('<div class="empty">Erro ao carregar os agendamentos.</div>'); return; }
  const fmt = (iso) => { try { return new Date(iso).toLocaleString("pt-BR"); } catch (e) { return iso; } };
  const sb = (s) => { const m = { pending: ["warn", "Agendado"], publishing: ["warn", "Publicando…"], published: ["approved", "Publicado"], simulado: ["plain", "Simulado"], failed: ["rejected", "Falhou"], cancelled: ["plain", "Cancelado"] }; const b = m[s] || ["plain", s]; return '<span class="badge ' + b[0] + '">' + esc(b[1]) + "</span>"; };
  const rows = items.length ? items.map((it) => `<tr>
      <td><strong>${esc(it.label || it.folder)}</strong><div class="muted">${esc(it.folder)}</div></td>
      <td>${esc(fmt(it.scheduled_at))}</td>
      <td>${sb(it.status)}${it.error ? ' <span class="hint">' + esc(it.error) + "</span>" : ""}</td>
      <td class="u-actions"><a class="btn btn-sm btn-ghost" href="#/task/${encodeURIComponent(it.folder)}">Ver peça</a>${it.status === "pending" ? '<button class="btn btn-sm btn-danger" data-cancel="' + esc(it.id) + '">Cancelar</button>' : (it.post_id ? ' <span class="hint">post ' + esc(it.post_id) + "</span>" : "")}</td>
    </tr>`).join("") : '<tr><td colspan="4" class="muted">Nenhum agendamento. Agende uma peça aprovada em “Publicar no Instagram”.</td></tr>';
  setView(`<div class="section-head"><div><h2>Agendados</h2><p class="muted">Publicações agendadas para o Instagram. Enquanto estiver “Agendado”, você pode cancelar/suspender.</p></div></div>
    <div class="card"><table class="utable"><thead><tr><th>Peça</th><th>Quando</th><th>Status</th><th></th></tr></thead><tbody id="sched-rows">${rows}</tbody></table></div>`);
  $$("#sched-rows [data-cancel]").forEach((b) => { b.onclick = async () => {
    if (!await uiConfirm("Cancelar este agendamento? A peça não será publicada no horário.", { confirmText: "Cancelar", confirmKind: "danger" })) return;
    try { await API.cancelSchedule(b.dataset.cancel); toast("Agendamento cancelado.", "ok"); viewSchedule(); }
    catch (e) { toast((e && e.message) || "Erro ao cancelar.", "error"); }
  }; });
}

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
// Lightbox com navegação em GRUPO: ao abrir uma imagem de uma galeria (os slides de um
// carrossel, ou as mídias geradas juntas de uma peça), dá para ir às irmãs com as setas
// ou o teclado — escopado ÀQUELA galeria, sem pular para artes de outras peças.
let _lbItems = [];
let _lbIdx = 0;
function lbItemFromMedia(m) {
  const isVid = m.tagName === "VIDEO";
  const src = m.getAttribute("src") || "";
  return { url: src, type: isVid ? "video" : "image", dlUrl: src.replace("/raw?", "/download?"), folder: m.dataset.folder || "", rel: m.dataset.rel || "", editable: m.dataset.edit === "1" };
}
// Esconde a navegação (preview de texto/HTML e ao fechar) e zera o grupo.
function hideLbNav() {
  _lbItems = []; _lbIdx = 0;
  ["#lightbox-prev", "#lightbox-next", "#lightbox-count", "#lightbox-edit"].forEach((s) => { const e = $(s); if (e) e.style.display = "none"; });
}
// Renderiza o item atual no palco + ações (download) + navegação (setas/contador).
function renderLbItem() {
  const it = _lbItems[_lbIdx]; const stage = $("#lightbox-stage");
  if (!it || !stage) return;
  // Arte editável dá pra abrir o editor com um duplo-clique na própria imagem (atalho do botão "Editar").
  const canEdit = it.type === "image" && it.editable && it.folder && it.rel && State.task;
  stage.innerHTML = it.type === "video"
    ? `<video src="${it.url}" controls autoplay playsinline></video>`
    : `<img src="${it.url}" alt="" class="${canEdit ? "lb-editable" : ""}"${canEdit ? ' title="Duplo-clique para editar"' : ""} />`;
  setLightboxNewTab(null);
  const dl = $("#lightbox-dl"), res = $("#lightbox-res");
  if (it.type === "image" && it.dlUrl) {
    if (res) { res.innerHTML = dlMenu(it.dlUrl, "Baixar"); res.style.display = ""; }
    if (dl) dl.style.display = "none";
  } else {
    if (res) { res.innerHTML = ""; res.style.display = "none"; }
    if (dl) { dl.href = it.dlUrl || it.url; dl.style.display = (it.dlUrl || it.url) ? "" : "none"; }
  }
  const ed = $("#lightbox-edit");
  if (ed) {
    if (it.editable && it.folder && it.rel && State.task) { ed.style.display = ""; ed.onclick = () => { closeLightbox(); openHtmlEditor(it.folder, State.task, it.rel); }; }
    else ed.style.display = "none";
  }
  const multi = _lbItems.length > 1;
  const prev = $("#lightbox-prev"), next = $("#lightbox-next"), count = $("#lightbox-count");
  if (prev) prev.style.display = multi ? "" : "none";
  if (next) next.style.display = multi ? "" : "none";
  if (count) { count.style.display = multi ? "" : "none"; count.textContent = (_lbIdx + 1) + " / " + _lbItems.length; }
}
// Navega no grupo (circular).
function lbNav(delta) {
  if (_lbItems.length < 2) return;
  _lbIdx = (_lbIdx + delta + _lbItems.length) % _lbItems.length;
  renderLbItem();
}
// Abre um item único (compatível com as chamadas existentes — card, lista de arquivos).
function openLightbox(url, type, dlUrl) {
  const lb = $("#lightbox"), stage = $("#lightbox-stage");
  if (!lb || !stage) { window.open(url, "_blank"); return; }
  _lbItems = [{ url, type: type === "video" ? "video" : "image", dlUrl: dlUrl || "" }];
  _lbIdx = 0;
  renderLbItem();
  lbShow();
}
// Abre a partir de um elemento da galeria, agrupando as mídias IRMÃS da mesma
// .media-gallery (slides do carrossel / mídias da peça) para navegar entre elas.
function openLightboxFromEl(el) {
  if (!el) return;
  const item = el.closest(".media-item");
  const mediaEl = (item && item.querySelector("img, video"))
    || ((el.tagName === "IMG" || el.tagName === "VIDEO") ? el : null);
  if (!mediaEl) return;
  const lb = $("#lightbox"), stage = $("#lightbox-stage");
  const gallery = el.closest(".media-gallery");
  const medias = gallery ? Array.from(gallery.querySelectorAll(".media-item img, .media-item video")) : [mediaEl];
  _lbItems = medias.map(lbItemFromMedia);
  _lbIdx = Math.max(0, medias.indexOf(mediaEl));
  if (!lb || !stage) { window.open(_lbItems[_lbIdx].url, "_blank"); return; }
  renderLbItem();
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
  const lbRes = $("#lightbox-res");
  if (lbRes) { lbRes.innerHTML = ""; lbRes.style.display = "none"; }
  hideLbNav();
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
    stage.innerHTML = `<iframe class="lightbox-frame" src="${_lbBlobUrl}" title="${esc(rel)}" sandbox="allow-scripts"></iframe>`;
    setLightboxNewTab(_lbBlobUrl);
    const dl = $("#lightbox-dl");
    const lbRes = $("#lightbox-res");
    if (lbRes) { lbRes.innerHTML = ""; lbRes.style.display = "none"; }
    hideLbNav();
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
  hideLbNav();
  if (_lbBlobUrl) { URL.revokeObjectURL(_lbBlobUrl); _lbBlobUrl = null; }
  document.body.classList.remove("no-scroll");
  restoreFocus(_lbOpener); _lbOpener = null;
}
function setupLightbox() {
  const lb = $("#lightbox");
  if (!lb) return;
  const closeBtn = $("#lightbox-close");
  if (closeBtn) closeBtn.onclick = closeLightbox;
  const prevBtn = $("#lightbox-prev"); if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); lbNav(-1); };
  const nextBtn = $("#lightbox-next"); if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); lbNav(1); };
  // Fechar ao clicar FORA só vale para o fundo escuro puro (o próprio .lightbox) e apenas
  // quando o clique inteiro — pressionar E soltar — acontece nele. Assim, clicar na imagem,
  // na moldura em volta dela, ou arrastar de dentro pra fora NUNCA fecha por engano.
  // (Fechar de propósito: botão ✕ ou tecla Esc.)
  let downOnBackdrop = false;
  lb.addEventListener("mousedown", (e) => { downOnBackdrop = (e.target === lb); });
  lb.addEventListener("click", (e) => { if (e.target === lb && downOnBackdrop) closeLightbox(); });
  // Duplo-clique na arte editável abre o editor direto (atalho do botão "Editar").
  lb.addEventListener("dblclick", (e) => {
    if (!e.target || e.target.tagName !== "IMG") return;
    const it = _lbItems[_lbIdx];
    if (it && it.type === "image" && it.editable && it.folder && it.rel && State.task) {
      closeLightbox(); openHtmlEditor(it.folder, State.task, it.rel);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") lbNav(-1);
    else if (e.key === "ArrowRight") lbNav(1);
    else if (e.key === "Tab") trapTabKey(lb, e);
  });
}
window.openLightbox = openLightbox;
window.openLightboxFromEl = openLightboxFromEl;
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
  let providerList = [];
  try { providerList = (await API.providers()).providers || []; } catch (e) { /* usa padrao do servidor */ }
  const providerOpts = providerList.map((p) => '<option value="' + esc(p.id) + '"' + (p.is_default ? " selected" : "") + ">" + esc(p.label) + (p.configured ? "" : " — sem chave") + "</option>").join("");
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
          <div class="field"><label>IA que vai gerar <span class="hint">(escolha o provedor; o modelo de cada um fica em Configurações)</span></label><select id="g-provider">${providerOpts || '<option value="">Padrão</option>'}</select></div>
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
          <div class="field"><label>Orientação na postagem — chamada para ação (CTA) <span class="hint">(padrão: sem CTA; oriente a IA aqui — o CTA final você ajusta no resultado)</span></label>
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
          <div class="field mood-field"><label>Referência visual / clima (opcional) <span class="hint">(clima, estilo ou referência a evocar — vale para arte e vídeo, sempre dentro da marca)</span></label><textarea id="g-mood" rows="2" placeholder="ex.: editorial sóbrio, foco em prova de número, sensação de exclusividade convidativa"></textarea></div>
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
  // Gating dos ajustes de arte, por tipo de mídia:
  //  - Estilo visual (#g-style, .art-only) é template de PNG -> só peças renderizadas em imagem.
  //  - Referência/clima (#g-mood, .mood-field) também guia o roteiro de vídeo (hook/cenas/voiceover),
  //    então vale para imagem E vídeo; só some nos tipos só-texto (LinkedIn/Threads).
  const updArtFields = () => {
    const ct = metaType($("#g-type").value);
    const media = ct ? ct.media : "";
    $$(".art-only").forEach((el) => { el.style.display = media === "image" ? "" : "none"; });
    $$(".mood-field").forEach((el) => { el.style.display = (media === "image" || media === "video") ? "" : "none"; });
  };
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
    g.innerHTML = images.map((im) => `<div class="photo-item"><button type="button" class="photo-thumb${im.url === sel ? " on" : ""}" data-url="${esc(im.url)}" title="${esc(im.name)}"><img src="${esc(im.url)}" alt="" loading="lazy"/></button><button type="button" class="photo-del" data-name="${esc(im.name)}" title="Remover do acervo" aria-label="Remover do acervo">×</button></div>`).join("");
    $$("#g-photo-gallery .photo-thumb").forEach((b) => { b.onclick = () => { $("#g-image").value = b.dataset.url; $$("#g-photo-gallery .photo-thumb").forEach((x) => x.classList.toggle("on", x === b)); }; });
    $$("#g-photo-gallery .photo-del").forEach((b) => { b.onclick = async (e) => {
      e.stopPropagation();
      if (!(await uiConfirm("Remover esta imagem do acervo? Peças já geradas com ela não mudam.", { confirmText: "Remover" }))) return;
      try { await API.deleteUpload(b.dataset.name); toast("Imagem removida do acervo", "warn"); await loadPhotoGallery($("#g-image").value); }
      catch (err) { toast((err && err.message) || "Falha ao remover a imagem", "error"); }
    }; });
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
    provider: ($("#g-provider") && $("#g-provider").value) || undefined,
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
  // Feed (instagram_caption) é format:text mas ganha editor de campos (corpo + hashtags),
  // que só recompõe o texto no #g-edit. Só quando a IA devolveu parsed.body (fallback seguro).
  const feedHtml = (r.content_type === "instagram_caption" && r.parsed && typeof r.parsed.body === "string") ? feedEditor(r.parsed) : null;
  let editorBlock;
  if (structHtml) {
    editorBlock = `<div class="field mt"><label>Conteúdo (editável por ${r.content_type === "video_idea" ? "cena" : (r.content_type === "instagram_carousel" ? "slide" : "campo")})</label>${structHtml}</div>
       <details class="json-adv mt"><summary>JSON (avançado)</summary>
         <textarea id="g-edit" rows="12" style="font-family:var(--mono)">${esc(editorVal)}</textarea>
         <p class="muted" style="font-size:12px;margin-top:6px">Atualizado automaticamente pelos campos acima. Para editar à mão, altere o JSON e clique em “Aplicar JSON”.</p>
         <button class="btn btn-ghost btn-sm" id="g-json-apply" type="button">Aplicar JSON aos campos</button>
       </details>`;
  } else if (feedHtml) {
    editorBlock = `<div class="field mt"><label>Conteúdo (editável)</label>${feedHtml}</div>
       <details class="json-adv mt"><summary>Texto completo (avançado)</summary>
         <textarea id="g-edit" rows="8" style="font-family:var(--font)">${esc(editorVal)}</textarea>
         <p class="muted" style="font-size:12px;margin-top:6px">Montado automaticamente pelos campos acima (corpo + hashtags).</p>
       </details>`;
  } else {
    editorBlock = `<div class="field mt"><label>Conteúdo (editável)</label><textarea id="g-edit" rows="${ct.format === "json" ? 16 : 8}" style="font-family:${ct.format === "json" ? "var(--mono)" : "var(--font)"}">${esc(editorVal)}</textarea></div>`;
  }
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
         <p class="muted" style="font-size:12px;margin:8px 0">Renderiza a imagem final ${ct.kind === "carousel" ? "de TODOS os slides " : ""}com o estilo visual escolhido nos ajustes. Não salva nada — confira e baixe se quiser (rascunho rápido).</p>
         <button class="btn btn-ghost btn-sm" id="g-art-btn" type="button">Ver prévia da arte</button>
         <div id="g-art" class="art-preview mt"></div>
       </details>`
    : "";
  // #R5 — storyboard das cenas do vídeo (prévia honesta, sem render pesado).
  const storyHtml = r.content_type === "video_idea"
    ? `<details class="art-preview-box mt" open><summary>Prévia do roteiro (storyboard)</summary>
         <div id="g-story" class="video-storyboard">${videoStoryboard(r.parsed)}</div>
         <p class="muted" style="font-size:12px;margin-top:8px">Ilustrativo — atualiza conforme você edita as cenas. O vídeo final é renderizado ao aprovar a peça.</p>
       </details>`
    : "";
  $("#g-result").innerHTML = `
    ${researchHtml}
    ${editorBlock}
    ${mockHtml}
    ${artHtml}
    ${storyHtml}
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
  // #R4 — feed com editor de campos (corpo + hashtags) mantendo o #g-edit sincronizado.
  if (feedHtml) bindFeedEditor();
  // #R5 — o storyboard do vídeo é atualizado dentro de syncJsonMirror (cobre digitação e cliques).
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
    if (out.slides && out.slides.length) {
      // Carrossel: mostra TODOS os slides na ordem, cada um com número e baixar.
      box.innerHTML = `<div class="art-slides-strip">${out.slides.map((s) => `<div class="art-slide"><span class="slide-num">${s.n}</span><img class="art-img art-slide-img" src="${s.dataUrl}" alt="Slide ${s.n}" /><a class="art-slide-dl" href="${s.dataUrl}" download="slide-${s.n}.png" title="Baixar slide ${s.n}">baixar</a></div>`).join("")}</div>
        <div class="flex mt" style="align-items:center;gap:10px;flex-wrap:wrap"><span class="muted" style="font-size:12px">Estilo: <strong>${esc(out.template)}</strong> · ${out.slides.length} slides · ${out.width}×${out.height}</span></div>`;
    } else {
      box.innerHTML = `<img class="art-img" src="${out.dataUrl}" alt="Prévia da arte" />
        <div class="flex flex-between mt" style="align-items:center;gap:10px;flex-wrap:wrap">
          <span class="muted" style="font-size:12px">Estilo: <strong>${esc(out.template)}</strong> · ${out.width}×${out.height}</span>
          <a class="btn btn-sm btn-ghost" href="${out.dataUrl}" download="${esc(fname)}">Baixar imagem</a>
        </div>`;
    }
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

// #R5 — storyboard do vídeo: uma prévia honesta das cenas (o que aparece na tela), em
// cards na paleta da marca. Não renderiza o vídeo (BrandStory/Remotion é pesado) — mostra
// a sequência hook → cenas → CTA, atualizando conforme se edita as cenas.
const VSB_LABEL = { hook: "Hook", product: "Produto", benefit: "Benefício", cta: "CTA" };
function videoStoryboard(parsed) {
  const scenes = (parsed && Array.isArray(parsed.scenes)) ? parsed.scenes : [];
  if (!scenes.length && !(parsed && parsed.cta)) return '<p class="muted" style="font-size:12px;margin:0">Adicione cenas para ver o storyboard.</p>';
  const cards = scenes.map((s, i) => {
    const kind = String(s.type || "").toLowerCase();
    const tag = Object.prototype.hasOwnProperty.call(VSB_LABEL, kind) ? VSB_LABEL[kind] : (s.type ? esc(s.type) : "Cena");
    return `<div class="vsb-card"><div class="vsb-top"><span class="vsb-n">${i + 1}</span><span class="vsb-type">${tag}</span></div>
      <div class="vsb-text">${esc(s.text || "—")}</div>${s.subtitle ? `<div class="vsb-sub">${esc(s.subtitle)}</div>` : ""}</div>`;
  }).join("");
  const cta = parsed && parsed.cta;
  const ctaCard = cta ? `<div class="vsb-card vsb-cta"><div class="vsb-top"><span class="vsb-type">CTA final</span></div><div class="vsb-text">${esc(cta)}</div></div>` : "";
  return `<div class="vsb-strip">${cards}${ctaCard}</div>`;
}

async function refineGenerated() {
  if (!LAST_GEN) return;
  const instruction = $("#g-refine").value.trim();
  if (instruction.length < 3) { toast("Escreva a orientação do ajuste.", "error"); return; }
  const current = $("#g-edit").value;
  const payload = {
    content_type: LAST_GEN.req.content_type,
    provider: ($("#g-provider") && $("#g-provider").value) || LAST_GEN.req.provider || undefined,
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

// ---- Editor estruturado do FEED (instagram_caption) ----
// O tipo é format:text, então NÃO mexemos no contrato do arquivo: os campos abaixo só
// recompõem o texto final no #g-edit (corpo + hashtags), do mesmo jeito que o composeText
// montava. Assim o feed deixa de ser um textarão único — separa corpo e hashtags — sem
// alterar como a peça é salva/renderizada. Só ativa quando a IA devolveu parsed.body
// (senão cai no textarea cru, fallback seguro — ver renderGenResult).
function feedEditor(parsed) {
  const body = (parsed && typeof parsed.body === "string") ? parsed.body : "";
  const tags = (Array.isArray(parsed && parsed.hashtags) ? parsed.hashtags : []).join(" ");
  return `<div class="feed-ed" data-type="instagram_caption">
    <div class="field"><label>Corpo da legenda <span class="hint">(o CTA do feed vive aqui, no texto)</span></label><textarea class="fe-body" rows="7" placeholder="Legenda da postagem — hook na 1ª linha, CTA no fim">${esc(body)}</textarea></div>
    <div class="field mt"><label>Hashtags <span class="hint">(3–5, sempre com #4Selet — separe por espaço)</span></label><input class="fe-tags" placeholder="#4Selet #TaxaZero" value="${esc(tags)}" /></div>
  </div>`;
}
// Recompõe corpo + hashtags no #g-edit (fonte da verdade do salvamento). Mesma forma do composeText.
function feedToText() {
  const ed = document.querySelector(".feed-ed"); if (!ed) return;
  const body = (ed.querySelector(".fe-body") || {}).value || "";
  const tags = splitTags((ed.querySelector(".fe-tags") || {}).value);
  const t = tags.length ? (body + "\n\n" + tags.join(" ")) : body;
  if ($("#g-edit")) $("#g-edit").value = t;
}
function bindFeedEditor() {
  const ed = document.querySelector(".feed-ed"); if (!ed) return;
  ed.addEventListener("input", feedToText);
  feedToText();
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
// Campo de hashtags compartilhado pelos editores estruturados. Pré-preenche com as tags
// que a IA devolveu (parsed.hashtags). A marca pede 3-5 + #4Selet — o hint reforça, sem travar.
function hashtagsField(p) {
  const tags = (Array.isArray(p && p.hashtags) ? p.hashtags : []).join(" ");
  return `<div class="field mt"><label>Hashtags <span class="hint">(3–5, sempre com #4Selet — separe por espaço)</span></label><input class="se-tags" placeholder="#4Selet #TaxaZero" value="${esc(tags)}" /></div>`;
}
// Normaliza a entrada de hashtags: separa por espaço/vírgula e garante o # inicial.
function splitTags(v) {
  return String(v || "").split(/[\s,]+/).filter(Boolean).map((t) => "#" + t.replace(/^#+/, ""));
}
function carouselEditor(p) {
  const slides = (Array.isArray(p.slides) && p.slides.length) ? p.slides : [{ title: "", body: "" }];
  return `<div class="struct-ed" data-type="instagram_carousel">
    <div class="se-list">${slides.map((s, i) => slideItem(s, i, slides.length)).join("")}</div>
    <button class="btn btn-ghost btn-sm mt" data-se-add="slide" type="button">+ Adicionar slide</button>
    <div class="field mt"><label>CTA <span class="hint">(último slide)</span></label><input class="se-cta" placeholder="ex.: Solicitar convite" value="${esc(p.cta || "")}" /></div>
    ${hashtagsField(p)}
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
    <div class="field mt"><label>CTA <span class="hint">(fim do vídeo)</span></label><input class="se-cta" placeholder="ex.: Conhecer a plataforma" value="${esc(p.cta || "")}" /></div>
    ${hashtagsField(p)}
  </div>`;
}

function adEditor(p) {
  const f = (k, label, ph) => `<div class="field mt"><label>${label}</label><input class="se-f" data-k="${k}" placeholder="${ph}" value="${esc(p[k] || "")}" /></div>`;
  return `<div class="struct-ed" data-type="ad_creative">
    ${f("headline", "Headline", "máx. 4 palavras")}
    ${f("subtext", "Subtexto", "linha de apoio")}
    ${f("cta", "CTA <span class=\"hint\">(botão do anúncio)</span>", "ex.: Ver as condições")}
    ${f("layout_type", "Layout", "Product Focus, Split, Lifestyle…")}
    ${hashtagsField(p)}
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
  // Hashtags (campo compartilhado .se-tags). Só grava se o usuário digitou algo OU o tipo
  // já trazia hashtags — assim não injetamos [] vazio em tipo que nunca teve.
  const tagsEl = ed.querySelector(".se-tags");
  if (tagsEl) {
    const tv = splitTags(tagsEl.value);
    if (tv.length || Array.isArray(base.hashtags)) base.hashtags = tv;
  }
  return base;
}
function syncJsonMirror() {
  const parsed = structToParsed();
  if (parsed && $("#g-edit")) $("#g-edit").value = JSON.stringify(parsed, null, 2);
  // #R5 — mantém o storyboard do vídeo em sincronia. Aqui (e não num listener à parte) porque
  // syncJsonMirror roda tanto na digitação quanto nos cliques de add/remover/reordenar cena, e é
  // re-ligado por bindStructuredEditor após "Aplicar JSON" (o listener avulso morria nesses casos).
  const g = $("#g-story"); if (g && parsed) g.innerHTML = videoStoryboard(parsed);
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
    saved = true;
    const regen = $("#g-regen"); if (regen) regen.style.display = "none";
    // Renderiza a arte automaticamente ao salvar (feed/imagem/carrossel): a peça já nasce
    // com os slides/PNG, então a prévia (celular, publicar) funciona na hora — sem depender
    // de clicar "Gerar arte final" depois. Se o render falhar, salva mesmo assim (dá pra gerar
    // na peça). Tipos de texto (LinkedIn/Threads/vídeo) não entram aqui.
    if (autoRenders(ct.kind)) {
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> gerando a arte…';
      try {
        const tpl = (LAST_GEN.req && LAST_GEN.req.template_variant) || ($("#g-style") && $("#g-style").value) || "";
        await API.renderMedia(r.folder, ct.kind, tpl);
        toast("Peça salva e arte gerada", "success");
      } catch (e) {
        toast('Peça salva. A arte não renderizou agora — gere em "Gerar arte final" na peça.', "warn");
      }
    } else {
      toast("Conteúdo salvo com sucesso", "success");
    }
    // #1 — trava o botão após sucesso (evita salvar/duplicar de novo) e mostra "✓ Salvo".
    btn.disabled = true; btn.textContent = "✓ Salvo";
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
// Modal "Inserir credenciais": conecta um serviço server-side (Redis/Supabase/YouTube) ou
// uma variável avançada, colando a credencial. Grava no servidor (data/credentials.json),
// NUNCA volta o valor. Só admin (o backend também barra). Alguns serviços só valem após reiniciar.
function openCredentialsModal() {
  const SERVICES = {
    redis: { label: "Redis / BullMQ (fila)", note: "A fila BullMQ só passa a valer depois de reiniciar o painel.", fields: [{ name: "REDIS_URL", label: "REDIS_URL", ph: "redis://default:senha@host:6379 (ex.: Upstash)" }] },
    supabase: { label: "Supabase (hospedagem de mídia)", note: "Exige o SDK @supabase/supabase-js instalado no servidor.", fields: [{ name: "SUPABASE_URL", label: "SUPABASE_URL", ph: "https://xxxx.supabase.co" }, { name: "SUPABASE_KEY", label: "SUPABASE_KEY (service role)", ph: "eyJhbGci…" }] },
    youtube: { label: "YouTube (Data API)", note: "Publicar no YouTube exige o fluxo OAuth completo.", fields: [{ name: "YOUTUBE_REFRESH_TOKEN", label: "YOUTUBE_REFRESH_TOKEN", ph: "1//0g… (gerado no OAuth)" }] },
    custom: { label: "Outro (variável avançada)", note: "Só use se souber o nome exato da variável de ambiente.", fields: [{ name: "__NAME__", label: "Nome da variável (MAIÚSCULAS)", ph: "EX_API_KEY", isName: true }, { name: "__VALUE__", label: "Valor", ph: "cole o valor" }] },
  };
  const renderFields = (key) => SERVICES[key].fields.map((f, i) =>
    `<div class="field"><label>${esc(f.label)}</label><input id="cred-f-${i}" type="${f.isName ? "text" : "password"}" placeholder="${esc(f.ph)}" autocomplete="off" /></div>`).join("");
  const optList = Object.keys(SERVICES).map((k) => `<option value="${k}">${esc(SERVICES[k].label)}</option>`).join("");
  const ov = document.createElement("div"); ov.className = "modal-ov cred-ov";
  ov.innerHTML = `<div class="modal cred-modal" role="dialog" aria-modal="true" style="max-width:520px">
    <div class="pub-head"><h3>Inserir credenciais</h3><button class="btn btn-ghost btn-sm" data-x="close">Fechar</button></div>
    <div class="pub-body" style="display:block;padding:20px 22px">
      <p class="muted" style="margin-top:0">Conecte um serviço colando a credencial dele. Fica <strong>só no servidor</strong> (em <span class="codeblock">interface/data</span>, fora do git) e <strong>nunca volta</strong> para o navegador.</p>
      <div class="field"><label>Serviço</label><select id="cred-service">${optList}</select></div>
      <div id="cred-fields">${renderFields("redis")}</div>
      <p class="hint" id="cred-note">${esc(SERVICES.redis.note)}</p>
      <div class="flex mt"><button class="btn btn-primary" id="cred-save">Salvar credencial</button><span id="cred-out" class="muted"></span></div>
      <p class="hint mt">Só administradores. Vale já para novas operações; integrações que conectam no boot só após reiniciar o painel.</p>
    </div>
  </div>`;
  document.body.appendChild(ov); document.body.classList.add("no-scroll");
  requestAnimationFrame(() => ov.classList.add("open"));
  const close = () => { ov.classList.remove("open"); document.body.classList.remove("no-scroll"); setTimeout(() => ov.remove(), 160); };
  ov.querySelector("[data-x='close']").onclick = close;
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const sel = ov.querySelector("#cred-service");
  sel.onchange = () => { ov.querySelector("#cred-fields").innerHTML = renderFields(sel.value); ov.querySelector("#cred-note").textContent = SERVICES[sel.value].note; };
  ov.querySelector("#cred-save").onclick = async () => {
    const out = ov.querySelector("#cred-out"), svc = SERVICES[sel.value];
    let pairs;
    if (sel.value === "custom") {
      const name = (ov.querySelector("#cred-f-0").value || "").trim(), value = (ov.querySelector("#cred-f-1").value || "").trim();
      if (!name || !value) { out.textContent = "Preencha nome e valor."; return; }
      pairs = [{ name, value }];
    } else {
      pairs = svc.fields.map((f, i) => ({ name: f.name, value: (ov.querySelector("#cred-f-" + i).value || "").trim() }));
      if (pairs.some((p) => !p.value)) { out.textContent = "Preencha todos os campos."; return; }
    }
    out.textContent = "Salvando…";
    try {
      for (const p of pairs) await API.saveCredential(p.name, p.value);
      toast("Credencial salva.", "success"); close(); viewSettings();
    } catch (e) { out.textContent = "Falhou: " + ((e && e.data && e.data.error) || (e && e.message) || "erro"); }
  };
}

async function viewSettings() {
  setTitle("Configurações");
  // As 5 chamadas são independentes — dispara em PARALELO (a 1ª pintura espera 1 round-trip,
  // não a soma de 5). Cada uma degrada sozinha; só API.settings() propaga p/ o catch do router.
  const [s, provsRes, integRes, igRes, contentRes] = await Promise.all([
    API.settings(),
    API.providers().catch(() => ({ providers: [] })),
    API.integrations().catch(() => ({ integrations: [] })),
    API.publishStatus().catch(() => ({ instagram: {} })),
    API.content().catch(() => ({ tasks: [] })),
  ]);
  State.settings = s;
  const provs = (provsRes && provsRes.providers) || [];
  const oai = provs.find((p) => p.id === "openai") || {};
  const defProv = (provs.find((p) => p.is_default) || {}).id || "anthropic";
  const integ = (integRes && integRes.integrations) || [];
  const ig = (igRes && igRes.instagram) || {};
  const tav = integ.find((x) => x.id === "tavily") || {};
  const models = [
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 (equilíbrio — recomendado)" },
    { id: "claude-opus-4-7", label: "Opus 4.7 (máxima qualidade)" },
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (rápido/econômico)" },
  ];
  const tagCounts = {};
  ((contentRes && contentRes.tasks) || []).forEach((t) => (t.tags || []).forEach((tg) => { tagCounts[tg] = (tagCounts[tg] || 0) + 1; }));
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
      <h3>ChatGPT (OpenAI)</h3>
      <p class="muted mt">Adicione a chave da OpenAI para poder gerar com o ChatGPT. Ela fica só neste servidor (<span class="codeblock">interface/.env</span>) e nunca vai para o navegador.</p>
      <div class="field mt"><label>Chave OpenAI (OPENAI_API_KEY)</label>
        ${oai.configured ? `<div class="key-locked"><svg class="key-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span class="key-mask">${esc(oai.masked_key)}</span> <span class="badge ok">Ativa</span></div>` : ""}
        <div class="key-edit ${oai.configured ? "mt" : ""}"><input id="oai-key" type="password" placeholder="${oai.configured ? "Cole uma nova chave para trocar..." : "sk-..."}" /><div class="flex mt"><button class="btn btn-primary" id="oai-save-key" disabled>${oai.configured ? "Trocar chave" : "Salvar chave"}</button></div></div>
      </div>
      <div class="field"><label>Modelo OpenAI <span class="hint">(ex.: gpt-4o, gpt-4.1, gpt-4o-mini — o que sua conta tiver)</span></label><input id="oai-model" value="${esc(oai.model || "gpt-4o")}" style="max-width:320px" /></div>
      <div class="flex"><button class="btn" id="oai-save-model">Salvar modelo</button><button class="btn" id="oai-test">Testar conexão</button><span id="oai-test-out" class="muted"></span></div>
    </div>
    <div class="card mt" style="max-width:660px">
      <h3>IA padrão</h3>
      <p class="muted mt">Qual IA o painel usa quando você não escolhe outra na hora de gerar. Na tela de criação dá para trocar por peça.</p>
      <div class="field mt"><select id="def-provider" style="max-width:320px">${provs.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === defProv ? " selected" : "") + (p.configured ? "" : " disabled") + ">" + esc(p.label) + (p.configured ? "" : " — sem chave") + "</option>").join("")}</select></div>
    </div>
    <div class="card mt" style="max-width:660px">
      <h3>Publicação no Instagram</h3>
      <p class="muted mt">Conecte a conta (Graph API da Meta) para publicar peças <strong>aprovadas</strong> direto do painel. O token e o ID ficam só no servidor (em <span class="codeblock">interface/data</span>, fora do git) e nunca vão para o navegador. Enquanto não conectar, a publicação roda em <strong>modo simulado</strong>.</p>
      ${ig.configured
        ? `<div class="ig-connected mt"><span class="badge ok">Conectado</span> <strong>@${esc(ig.username || "conta")}</strong><div class="hint">As publicações vão para esta conta <strong>de verdade</strong> (não é mais simulado).</div></div>`
        : `<div class="kv mt"><div class="k">Status</div><div><span class="badge paused">Não conectado</span> <span class="hint">— publicação em modo simulado (não posta nada)</span></div></div>`}
      <div class="kv mt">
        ${ig.ig_user_id ? `<div class="k">Conta (ID)</div><div class="muted">${esc(ig.ig_user_id)}</div>` : ""}
        ${ig.token_hint ? `<div class="k">Token</div><div>termina em <span class="codeblock">${esc(ig.token_hint)}</span></div>` : ""}
      </div>
      <hr class="sep" />
      <div class="field"><label>Token de acesso <span class="hint">(longa duração, gerado na Meta)</span></label><input id="ig-token" type="password" placeholder="${ig.configured ? "Cole um novo token para trocar..." : "Cole o token aqui e clique em Testar conexão..."}" /></div>
      <div class="field"><label>ID da conta do Instagram <span class="hint">(opcional — deixe vazio que o painel descobre pelo token)</span></label><input id="ig-id" value="${esc(ig.ig_user_id || "")}" placeholder="descoberto automaticamente ao testar" /></div>
      <div class="field"><label>Endereço público do painel <span class="hint">(a Meta busca a imagem por aqui)</span></label><input id="ig-base" value="${esc(ig.public_base_url || "https://mkt.4st.co")}" style="max-width:340px" /></div>
      <div class="flex"><button class="btn btn-primary" id="ig-save">Salvar conexão</button><button class="btn" id="ig-test">Testar conexão</button><span id="ig-out" class="muted"></span></div>
      <p class="hint mt">Só administradores configuram. O token e o ID você gera na Meta (te passo o passo a passo).</p>
    </div>
    <div class="card mt" style="max-width:660px">
      <h3>Pesquisa de mercado (Tavily)</h3>
      <p class="muted mt">Adicione a chave da Tavily para que a IA possa fazer <strong>pesquisa de mercado ao vivo</strong> ao gerar conteúdo (opt-in pelo toggle na hora de gerar). A chave fica só no servidor (em <span class="codeblock">interface/.env</span>, fora do git) e nunca vai para o navegador.</p>
      <div class="kv mt"><div class="k">Status</div><div>${tav.configured ? '<span class="badge ok">Conectada</span> <span class="hint">— marque “Pesquisar mercado” ao gerar</span>' : '<span class="badge paused">Não configurada</span>'}</div></div>
      <hr class="sep" />
      <div class="field"><label>Chave Tavily <span class="hint">(tvly-…)</span></label><input id="tav-key" type="password" placeholder="${tav.configured ? "Cole uma nova chave para trocar…" : "Cole a chave aqui (tvly-…)"}" /></div>
      <div class="flex"><button class="btn btn-primary" id="tav-save">Salvar chave</button><button class="btn" id="tav-test">Testar</button><span id="tav-out" class="muted"></span></div>
      <p class="hint mt">A chave você pega em tavily.com (painel da conta). Só administradores configuram.</p>
    </div>
    <div class="card mt" style="max-width:660px">
      <div class="flex-between"><h3>Outras integrações</h3><button class="btn btn-sm" id="cred-add">Inserir credenciais</button></div>
      <p class="muted mt">Serviços que ainda se configuram no servidor. Se quiser <strong>conectar um deles pelo painel</strong>, clique em “Inserir credenciais”. Claude, ChatGPT, Instagram e Tavily têm cartões próprios acima, com o token/chave de cada um. Aqui aparece só o status, nunca os valores.</p>
      ${(() => {
        const rest = integ.filter((it) => !["anthropic", "openai", "tavily", "instagram"].includes(it.id));
        if (!rest.length) return '<p class="muted mt">Nenhuma outra integração no momento.</p>';
        return '<ul class="integ-list mt">' + rest.map((it) => {
          const ok = !!it.configured;
          const badge = ok
            ? '<span class="badge ok">conectado</span>'
            : (it.required ? '<span class="badge warn">obrigatório</span>' : '<span class="badge paused">não configurado</span>');
          return `<li class="integ-row">
            <span class="integ-dot ${ok ? "on" : (it.required ? "req" : "off")}"></span>
            <div class="integ-main">
              <div class="integ-name">${esc(it.name)} ${badge} <span class="hint">opcional</span></div>
              <div class="integ-purpose">${esc(it.purpose || "")}</div>
              <div class="integ-detail">${esc(it.detail || "")}</div>
            </div>
          </li>`;
        }).join("") + "</ul>";
      })()}
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
  // Publicação Instagram: salvar conexão + testar
  if ($("#ig-save")) $("#ig-save").onclick = async () => {
    const out = $("#ig-out"); out.textContent = "Salvando…";
    try {
      const payload = { ig_user_id: $("#ig-id").value.trim(), public_base_url: $("#ig-base").value.trim() };
      const tok = $("#ig-token").value.trim(); if (tok) payload.access_token = tok;
      await API.savePublishConfig(payload);
      toast("Conexão salva.", "ok"); viewSettings();
    } catch (e) { out.textContent = ""; toast((e && e.message) || "Erro ao salvar.", "error"); }
  };
  if ($("#ig-test")) $("#ig-test").onclick = async () => {
    const out = $("#ig-out"); out.textContent = "Testando…";
    try {
      const r = await API.testPublish();
      if (r.ok) { toast("Conectado como @" + (r.username || "conta") + ".", "ok"); viewSettings(); } // re-render: Status vira verde
      else out.textContent = "Falhou: " + (r.error || "erro");
    } catch (e) { out.textContent = "Falhou: " + ((e && e.message) || "erro"); }
  };
  // Tavily: salvar chave (grava no .env do servidor) + testar
  if ($("#tav-save")) $("#tav-save").onclick = async () => {
    const out = $("#tav-out"), key = ($("#tav-key").value || "").trim();
    if (key.length < 8) { out.textContent = "Cole uma chave válida."; return; }
    out.textContent = "Salvando…";
    try { await API.saveTavilyKey(key); toast("Chave Tavily salva.", "success"); viewSettings(); }
    catch (e) { out.textContent = "Falhou: " + ((e && e.message) || "erro"); }
  };
  if ($("#tav-test")) $("#tav-test").onclick = async () => {
    const out = $("#tav-out"); out.textContent = "Testando…";
    try { const r = await API.testTavily(); out.textContent = "Funcionando (" + (r.results || 0) + " resultado(s))."; toast("Tavily respondeu.", "ok"); }
    catch (e) { out.textContent = "Falhou: " + ((e && e.data && e.data.error) || (e && e.message) || "erro"); }
  };
  if ($("#cred-add")) $("#cred-add").onclick = openCredentialsModal;
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
  // OpenAI (ChatGPT): chave + modelo + teste + IA padrao
  const oaiKey = $("#oai-key"), oaiSaveKey = $("#oai-save-key");
  if (oaiKey && oaiSaveKey) oaiKey.addEventListener("input", () => { oaiSaveKey.disabled = oaiKey.value.trim().length < 10; });
  if (oaiSaveKey) oaiSaveKey.onclick = async () => {
    oaiSaveKey.disabled = true; oaiSaveKey.innerHTML = '<span class="spinner"></span> salvando…';
    try { await API.saveProviderKey("openai", oaiKey.value.trim()); toast("Chave OpenAI salva", "success"); viewSettings(); }
    catch (e) { toast((e && e.message) || "Erro ao salvar", "error"); oaiSaveKey.disabled = false; oaiSaveKey.textContent = "Salvar chave"; }
  };
  if ($("#oai-save-model")) $("#oai-save-model").onclick = async () => {
    try { await API.saveProviderModel("openai", $("#oai-model").value.trim()); toast("Modelo OpenAI salvo", "success"); }
    catch (e) { toast((e && e.message) || "Erro", "error"); }
  };
  if ($("#oai-test")) $("#oai-test").onclick = async () => {
    const out = $("#oai-test-out"); out.innerHTML = '<span class="spinner"></span> testando…';
    try { const r = await API.testProvider("openai"); out.innerHTML = r.ok ? '<span class="t-ok">✓</span> OpenAI OK (' + esc(r.model || "") + ")" : '<span class="t-err">✕</span> ' + esc(r.error || "falhou"); }
    catch (e) { out.innerHTML = '<span class="t-err">✕</span> ' + esc((e.data && e.data.error) || "falhou"); }
  };
  if ($("#def-provider")) $("#def-provider").onchange = async (e) => {
    try { await API.setDefaultProvider(e.target.value); toast("IA padrão atualizada", "success"); }
    catch (err) { toast((err && err.message) || "Erro", "error"); }
  };
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

/* ============================ acesso (login + usuários) ============================ */
let LOGIN_SHOWING = false;

// Tela de login em tela cheia. Resolve com o usuário quando autenticado.
function showLogin() {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "login-ov";
    ov.innerHTML =
      '<form class="login-card" autocomplete="on">'
      + '<img class="login-logo" src="/brand-assets/logo-4selet-light.png" alt="4Selet" />'
      + '<div class="login-sub">Painel de Marketing</div>'
      + '<h1>Entrar</h1>'
      + '<p class="muted">Acesse com o seu usuário e senha.</p>'
      + '<div class="field"><label for="lg-user">Usuário</label><input id="lg-user" type="text" autocomplete="username" /></div>'
      + '<div class="field"><label for="lg-pass">Senha</label><input id="lg-pass" type="password" autocomplete="current-password" /></div>'
      + '<div class="login-err" hidden></div>'
      + '<button class="btn btn-primary" type="submit">Entrar</button>'
      + "</form>";
    document.body.appendChild(ov);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => ov.classList.add("open"));
    const form = ov.querySelector("form");
    const err = ov.querySelector(".login-err");
    const userEl = ov.querySelector("#lg-user");
    const passEl = ov.querySelector("#lg-pass");
    wirePasswordEye(passEl);
    userEl.focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Entrando…";
      try {
        const { user } = await API.login(userEl.value.trim(), passEl.value);
        document.body.classList.remove("no-scroll");
        ov.classList.remove("open");
        setTimeout(() => ov.remove(), 160);
        resolve(user);
      } catch (ex) {
        err.textContent = (ex && ex.message) || "Não foi possível entrar.";
        err.hidden = false;
        btn.disabled = false; btn.textContent = "Entrar";
        passEl.value = ""; passEl.focus();
      }
    });
  });
}

async function requireAuth() {
  try { const { user } = await API.me(); return user; }
  catch (e) {
    if (e && e.status === 401) { LOGIN_SHOWING = true; const u = await showLogin(); LOGIN_SHOWING = false; return u; }
    throw e;
  }
}

// Sessão expirou durante o uso: reabre o login e recarrega a view atual.
async function onAuthExpired() {
  if (LOGIN_SHOWING) return;
  LOGIN_SHOWING = true;
  try { State.user = await showLogin(); applyUserToChrome(); router(); }
  finally { LOGIN_SHOWING = false; }
}

// Chip do usuário (rodapé da sidebar) + link "Usuários" no menu (só admin).
function applyUserToChrome() {
  const u = State.user; if (!u) return;
  const foot = $(".sidebar-foot");
  if (foot) {
    let chip = $("#user-chip");
    if (!chip) { chip = document.createElement("div"); chip.id = "user-chip"; chip.className = "user-chip"; foot.insertBefore(chip, foot.firstChild); }
    const keyIco = '<svg class="mi" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="m16.5 6.5 3 3"/></svg>';
    const outIco = '<svg class="mi" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
    chip.innerHTML =
      '<div class="uc-top"><div class="uc-avatar" aria-hidden="true">' + esc(userInitials(u.name || u.username)) + "</div>"
      + '<div class="uc-info"><span class="uc-name">' + esc(u.name || u.username) + "</span>"
      + '<span class="uc-role">' + (u.role === "admin" ? "Administrador" : "Membro") + "</span></div></div>"
      + '<div class="uc-actions">'
      + '<button class="btn btn-ghost btn-sm" id="btn-chpass" title="Trocar minha senha">' + keyIco + "Senha</button>"
      + '<button class="btn btn-ghost btn-sm" id="btn-logout" title="Sair da conta">' + outIco + "Sair</button></div>";
    $("#btn-chpass").onclick = onChangeOwnPassword;
    $("#btn-logout").onclick = async () => { try { await API.logout(); } catch (_) { /* ignora */ } location.reload(); };
  }
  if (u.role === "admin" && $("#nav") && !$('#nav a[data-route="usuarios"]')) {
    const a = document.createElement("a");
    a.href = "#/usuarios"; a.dataset.route = "usuarios";
    a.innerHTML = '<span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Usuários';
    const settingsLink = $('#nav a[data-route="settings"]');
    if (settingsLink) settingsLink.parentNode.insertBefore(a, settingsLink); else $("#nav").appendChild(a);
  }
}

async function onChangeOwnPassword() {
  const v = await uiModal({ title: "Trocar minha senha", fields: [
    { name: "current", label: "Senha atual", inputType: "password" },
    { name: "password", label: "Nova senha (mín. 8 caracteres)", inputType: "password" },
  ], confirmText: "Salvar" });
  if (!v) return;
  try { await API.changePassword(v.current, v.password); toast("Senha alterada.", "ok"); }
  catch (e) { toast((e && e.message) || "Erro ao trocar a senha.", "error"); }
}

// Iniciais p/ o avatar (ex.: "Flavio Del Lima" -> "FD").
function userInitials(name) {
  const p = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
// Aceite de LINK DE CONVITE: se a URL veio como #/convite?t=TOKEN, troca o token por uma
// sessão (sem senha na URL) e limpa o token da barra. Depois o boot força a definição de
// senha (must_change). Roda antes do requireAuth.
async function tryAcceptInvite() {
  const h = String(location.hash || "");
  const m = h.match(/convite\?t=([^&]+)/i);
  if (!m) return;
  const token = decodeURIComponent(m[1]);
  try { await API.acceptInvite(token); toast("Convite aceito. Defina a sua senha para entrar.", "ok"); }
  catch (e) { toast((e && e.message) || "Convite inválido ou expirado.", "error"); }
  try { history.replaceState(null, "", location.pathname + location.search + "#/"); } catch (_) { location.hash = "#/"; }
}
// Mostra o link de convite gerado, com botão de copiar (o token só aparece aqui, uma vez).
function showInviteLink(url, username) {
  const ov = document.createElement("div"); ov.className = "modal-ov";
  ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3>Link de convite</h3>'
    + '<p class="muted mt">Envie este link para <strong>' + esc(username) + "</strong>. Ao abrir, a pessoa entra direto e define a própria senha — sem digitar login nem senha. Vale por 7 dias e funciona uma única vez.</p>"
    + '<div class="field"><label>Link</label><input id="inv-url" type="text" readonly value="' + esc(url) + '"></div>'
    + '<div class="modal-actions"><button class="btn btn-ghost" data-mx="close">Fechar</button><button class="btn btn-primary" id="inv-copy">Copiar link</button></div></div>';
  document.body.appendChild(ov); document.body.classList.add("no-scroll");
  requestAnimationFrame(() => ov.classList.add("open"));
  const close = () => { ov.classList.remove("open"); document.body.classList.remove("no-scroll"); setTimeout(() => ov.remove(), 160); };
  ov.querySelector("[data-mx='close']").onclick = close;
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const inp = ov.querySelector("#inv-url"); setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) { /* */ } }, 60);
  ov.querySelector("#inv-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(url); toast("Link copiado.", "ok"); }
    catch (e) { try { inp.focus(); inp.select(); document.execCommand("copy"); toast("Link copiado.", "ok"); } catch (_) { toast("Selecione o link e copie (Ctrl+C).", "info"); } }
  };
}
// Troca de senha OBRIGATÓRIA no 1o acesso (conta marcada must_change): modal não
// cancelável — a pessoa define uma senha só dela antes de usar o painel.
async function forcePasswordChange() {
  for (;;) {
    const v = await uiModal({
      title: "Defina a sua senha",
      message: "Primeiro acesso: crie uma senha só sua (mín. 8 caracteres). Ela substitui a senha temporária que você recebeu.",
      fields: [
        { name: "password", label: "Nova senha", inputType: "password" },
        { name: "confirm", label: "Confirmar nova senha", inputType: "password" },
      ],
      confirmText: "Salvar e entrar",
      noCancel: true,
    });
    if (!v) continue;
    if ((v.password || "").length < 8) { toast("A senha precisa de ao menos 8 caracteres.", "error"); continue; }
    if (v.password !== v.confirm) { toast("As senhas não conferem.", "error"); continue; }
    try { await API.firstPassword(v.password); if (State.user) State.user.must_change = false; toast("Senha definida. Bem-vindo(a)!", "ok"); return; }
    catch (e) { toast((e && e.message) || "Não consegui definir a senha.", "error"); }
  }
}

/* ---- view: Usuários (admin) ---- */
function userRow(u) {
  const isMe = State.user && u.username === State.user.username;
  const display = u.name || u.username;
  const pend = u.must_change ? ' <span class="badge warn" title="Ainda usa a senha temporária — vai definir a própria no próximo acesso">senha temporária</span>' : "";
  return '<tr data-u="' + esc(u.username) + '" data-name="' + esc(u.name || "") + '">'
    + '<td><div class="u-cell"><div class="u-avatar" aria-hidden="true">' + esc(userInitials(display)) + "</div>"
      + '<div class="u-idcol"><div class="u-name-line"><strong>' + esc(display) + "</strong>" + (isMe ? ' <span class="badge plain">você</span>' : "") + pend
      + ' <button class="btn btn-ghost btn-xs u-editname" title="Editar nome e login">editar</button></div>'
      + '<div class="muted u-username">@' + esc(u.username) + "</div></div></div></td>"
    + "<td>" + (isMe
        ? '<span class="badge ' + (u.role === "admin" ? "approved" : "plain") + '">' + (u.role === "admin" ? "Administrador" : "Membro") + "</span>"
        : '<select class="u-role"><option value="admin"' + (u.role === "admin" ? " selected" : "") + '>Administrador</option><option value="membro"' + (u.role === "membro" ? " selected" : "") + ">Membro</option></select>")
    + "</td>"
    + '<td class="muted">' + esc(fmtDate(u.created_at)) + "</td>"
    + '<td class="u-actions">'
      + '<button class="btn btn-ghost btn-sm u-invite" title="Gerar um link de convite (a pessoa entra e define a própria senha)">Convidar</button>'
      + '<button class="btn btn-ghost btn-sm u-pass">Resetar senha</button>'
      + (isMe ? "" : '<button class="btn btn-ghost btn-sm u-del">Remover</button>')
    + "</td></tr>";
}
function wireUserRows() {
  $$("#u-rows tr").forEach((tr) => {
    const username = tr.dataset.u;
    const nameBtn = tr.querySelector(".u-editname");
    if (nameBtn) nameBtn.onclick = async () => {
      const v = await uiModal({
        title: "Editar usuário",
        message: "Nome de exibição e login de “" + username + "”. Trocar o login muda como a pessoa entra no painel.",
        fields: [
          { name: "name", label: "Nome de exibição", value: tr.dataset.name || "", placeholder: "ex.: Jailson Junior" },
          { name: "username", label: "Usuário (login)", value: username, placeholder: "minúsculas, números, . _ -" },
        ],
        confirmText: "Salvar",
      });
      if (!v) return;
      const newName = v.name;
      const newLogin = String(v.username || "").trim().toLowerCase();
      const loginChanged = newLogin && newLogin !== username;
      const nameChanged = newName !== (tr.dataset.name || "");
      if (!loginChanged && !nameChanged) return; // nada mudou
      try {
        let curUser = username;
        // 1) troca o login (renomeia a conta) — o backend reemite a sessão se for você mesmo
        if (loginChanged) {
          const r = await API.setUsername(username, newLogin);
          curUser = (r.user && r.user.username) || newLogin;
          if (State.user && username === State.user.username) State.user.username = curUser;
        }
        // 2) troca o nome de exibição (já usando o login atualizado)
        if (nameChanged) {
          await API.setUserName(curUser, newName);
          if (State.user && curUser === State.user.username) State.user.name = newName;
        }
        toast("Usuário atualizado.", "ok");
        applyUserToChrome();
        viewUsers();
      } catch (e) { toast((e && e.message) || "Erro.", "error"); viewUsers(); }
    };
    const roleSel = $(".u-role", tr);
    if (roleSel && !roleSel.disabled) roleSel.onchange = async () => {
      try { await API.setUserRole(username, roleSel.value); toast("Perfil atualizado.", "ok"); }
      catch (e) { toast((e && e.message) || "Erro.", "error"); viewUsers(); }
    };
    const invBtn = $(".u-invite", tr);
    if (invBtn) invBtn.onclick = async () => {
      try {
        const r = await API.createInvite(username);
        const url = location.origin + "/#/convite?t=" + encodeURIComponent(r.token);
        showInviteLink(url, tr.dataset.name || username);
        viewUsers();
      } catch (e) { toast((e && e.message) || "Erro ao gerar o convite.", "error"); }
    };
    const passBtn = $(".u-pass", tr);
    if (passBtn) passBtn.onclick = async () => {
      const v = await uiModal({ title: "Resetar senha", message: "Defina uma senha temporária para “" + username + "” (mín. 8 caracteres). A pessoa cria a própria no próximo acesso.", fields: [{ name: "password", label: "Senha temporária", inputType: "password" }], confirmText: "Salvar" });
      if (!v) return;
      try { await API.resetUserPassword(username, v.password); toast("Senha atualizada.", "ok"); }
      catch (e) { toast((e && e.message) || "Erro.", "error"); }
    };
    const delBtn = $(".u-del", tr);
    if (delBtn) delBtn.onclick = async () => {
      if (!await uiConfirm("Remover o usuário “" + username + "”? Ele perde o acesso imediatamente.", { confirmText: "Remover", confirmKind: "danger" })) return;
      try { await API.deleteUser(username); toast("Usuário removido.", "ok"); viewUsers(); }
      catch (e) { toast((e && e.message) || "Erro.", "error"); }
    };
  });
}
async function onAddUser() {
  const v = await uiModal({
    title: "Adicionar usuário",
    message: "A pessoa entra com esse login e uma senha temporária. No primeiro acesso ela define uma senha só dela. Escolha o nível de acesso.",
    fields: [
      { name: "name", label: "Nome de exibição (opcional)", placeholder: "ex.: Jailson Junior" },
      { name: "username", label: "Usuário (login)", placeholder: "ex.: joao (minúsculas, números, . _ -)" },
      { name: "password", label: "Senha temporária (mín. 8 caracteres)", inputType: "password" },
      { name: "role", label: "Nível de acesso", type: "select", value: "membro", options: [
        { value: "membro", label: "Membro — usa o painel" },
        { value: "admin", label: "Administrador — usa o painel e gerencia usuários" },
      ] },
    ],
    confirmText: "Criar",
  });
  if (!v) return;
  try { await API.createUser({ username: v.username, password: v.password, name: v.name, role: v.role || "membro" }); toast("Usuário criado.", "ok"); viewUsers(); }
  catch (e) { toast((e && e.message) || "Erro ao criar usuário.", "error"); }
}
async function viewUsers() {
  setTitle("Usuários");
  if (!State.user || State.user.role !== "admin") { setView('<div class="empty">Acesso restrito a administradores.</div>'); return; }
  let users = [];
  try { users = (await API.users()).users || []; }
  catch (e) { setView('<div class="empty">Erro ao carregar usuários: ' + esc(e.message) + "</div>"); return; }
  setView(
    '<div class="section-head"><div><h2>Usuários</h2><p class="muted">Quem tem acesso ao painel. Cada pessoa entra com o próprio login.</p></div>'
    + '<button class="btn btn-primary" id="u-add">Adicionar usuário</button></div>'
    + '<div class="card"><table class="utable"><thead><tr><th>Usuário</th><th>Perfil</th><th>Criado</th><th></th></tr></thead>'
    + '<tbody id="u-rows">' + users.map(userRow).join("") + "</tbody></table></div>"
  );
  $("#u-add").onclick = onAddUser;
  wireUserRows();
}

/* ---- boot ---- */
async function boot() {
  setupTheme();
  await tryAcceptInvite(); // se veio de um link de convite (#/convite?t=...), cria a sessão
  // Portão de acesso: exige login antes de tudo (o tema já foi aplicado à tela de login).
  try { State.user = await requireAuth(); }
  catch (e) { setView('<div class="empty">Não foi possível conectar ao servidor.</div>'); return; }
  if (State.user && State.user.must_change) await forcePasswordChange(); // troca obrigatória no 1o acesso
  applyUserToChrome();
  setupAccent();
  setupScheme();
  setupMenu();
  setupBack();
  setupAssistant();
  setupLightbox();
  // meta e settings (via refreshKeyStatus) são independentes — busca em PARALELO antes do
  // 1º render. settings continua resolvido pré-router (o dashboard usa State.settings p/ o aviso de chave).
  let metaFail = false;
  await Promise.all([
    API.meta().then((m) => { State.meta = m; }).catch(() => { metaFail = true; }),
    refreshKeyStatus(),
  ]);
  if (metaFail) { setView('<div class="empty">Não foi possível conectar ao servidor.</div>'); return; }
  window.addEventListener("hashchange", router);
  window.addEventListener("auth:expired", onAuthExpired);
  router();
}
boot();
