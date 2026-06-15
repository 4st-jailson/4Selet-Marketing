// public/js/app.js — SPA do Painel 4Selet (reconstruído do zero).
// Vanilla JS, hash-router, sem build. Contrato de API inalterado (ver api.js).
"use strict";

const State = { meta: null, settings: null };

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

function setView(html) { $("#view").innerHTML = html; }
function setTitle(t) { $("#page-title").textContent = t; document.title = t + " · Painel 4Selet"; }
function metaType(id) { return (State.meta.content_types || []).find((c) => c.id === id); }
function kindLabel(k) { return (State.meta.kind_labels && State.meta.kind_labels[k]) || k || "Outros"; }
function mediaLabel(m) { return m === "video" ? "vídeo" : (m === "image" ? "imagem" : "texto"); }
function isMediaKind(k) { return k === "image" || k === "feed" || k === "carousel" || k === "video"; }
function tag(text) { return '<span class="badge plain">' + esc(text) + "</span>"; }

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
      return `<div class="field"><label>${esc(f.label || "")}</label>${ctrl}</div>`;
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
    const focusEl = ov.querySelector("[data-mf]") || ov.querySelector("[data-mx='ok']");
    if (focusEl) focusEl.focus();
    const collect = () => { const o = {}; fields.forEach((f, i) => { o[f.name || i] = ov.querySelector('[data-mf="' + i + '"]').value.trim(); }); return o; };
    const done = (val) => {
      ov.classList.remove("open"); document.body.classList.remove("no-scroll");
      document.removeEventListener("keydown", onKey); setTimeout(() => ov.remove(), 160); resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); done(null); }
      else if (e.key === "Enter" && !fields.some((f) => f.type === "textarea")) { e.preventDefault(); done(fields.length ? collect() : true); }
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

async function router() {
  const { route, arg, query } = parseHash();
  $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  closeSidebar();
  const fn = Routes[route] || viewDashboard;
  setView('<div class="empty"><span class="spinner"></span> carregando…</div>');
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
          <a class="list-row action-row" href="#/approved"><span class="lr-ico">✓</span><div class="lr-main"><div class="lr-title">Biblioteca de aprovados</div><div class="lr-meta">Peças versionadas e prontas para publicar</div></div><span class="lr-go" aria-hidden="true">→</span></a>
        </div>
      </div>
    </div>`);
}

function taskRow(t) {
  return `<a class="list-row" href="#/task/${encodeURIComponent(t.folder)}">
    <span class="lr-ico" aria-hidden="true">${kindIcon(t.kind)}</span>
    <div class="lr-main"><div class="lr-title">${esc(displayName(t))}</div>
    <div class="lr-meta">${esc(kindLabel(t.kind))} · ${esc(fmtDate(t.task_date))}${(t.platforms || []).length ? " · " + esc(t.platforms.join(", ")) : ""}</div></div>
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
  return `<div class="card card-link" onclick="location.hash='#/campaign/${encodeURIComponent(c.id)}'">
    <div class="flex-between"><h3>${esc(c.name)}</h3>${statusBadge(c.status)}</div>
    <p class="muted mt">${esc(c.objective || c.angle || "—")}</p>
    <div class="chips mt">${(c.platforms || []).map((p) => tag(p)).join("")}${c.pillar ? tag(c.pillar) : ""}</div>
    <div class="muted mt">${(c.content_ids || []).length} peça(s) vinculada(s)</div>
  </div>`;
}

function renderCampaignForm(existing) {
  const c = existing || {};
  const plats = State.meta.platforms.map((p) => checkPill("plat", p, (c.platforms || []).includes(p))).join("");
  const pillars = State.meta.pillars.map((p) => `<option ${c.pillar === p ? "selected" : ""}>${esc(p)}</option>`).join("");
  const wrap = $("#camp-form-wrap") || $("#view");
  wrap.innerHTML = `<div class="card mb">
    <h3>${existing ? "Editar campanha" : "Nova campanha"}</h3>
    <div class="field mt"><label>Nome <span class="hint">(mín. 3 caracteres)</span></label><input id="c-name" value="${esc(c.name || "")}" placeholder="ex.: Taxa Zero — 2º semestre" /><div class="field-error" id="e-name"></div></div>
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
    $("#e-name").textContent = "";
    if (name.length < 3) { $("#c-name").classList.add("invalid"); $("#e-name").textContent = "Nome obrigatório (mín. 3 caracteres)."; return; }
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
  setTitle(c.name);
  setView(`
    <div class="flex-between mb flex-wrap">
      <div class="flex flex-wrap">${statusBadge(c.status)}${c.pillar ? tag(c.pillar) : ""}${(c.platforms || []).map((p) => tag(p)).join("")}</div>
      <div class="flex"><button class="btn btn-sm" id="edit-camp">Editar</button><button class="btn btn-sm btn-primary" id="create-here">＋ Criar conteúdo</button><button class="btn btn-sm btn-danger" id="del-camp">Excluir</button></div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>Detalhes</h3>
        <div class="kv mt">
          <div class="k">Objetivo</div><div>${esc(c.objective || "—")}</div>
          <div class="k">Ângulo</div><div>${esc(c.angle || "—")}</div>
          <div class="k">Plataformas</div><div>${(c.platforms || []).join(", ") || "—"}</div>
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
function kindIcon(kind) {
  const ct = (State.meta.content_types || []).find((c) => c.kind === kind);
  return ct ? (ct.icon || "▣") : "▤";
}
function taskCard(t) {
  const hasThumb = t.thumb && t.thumb.rel;
  const previewable = hasThumb && (t.thumb.type === "video" || t.thumb.type === "image" || /\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i.test(t.thumb.rel));
  const zoomBtn = previewable
    ? `<button class="cc-zoom" title="Pré-visualizar" onclick="event.preventDefault();event.stopPropagation();openLightbox('${API.rawUrl(t.folder, t.thumb.rel)}','${t.thumb.type === "video" ? "video" : "image"}','${API.downloadUrl(t.folder, t.thumb.rel)}')">⤢</button>`
    : "";
  const newBadge = !t.first_viewed_at ? '<span class="cc-new">Novo</span>' : "";
  const tagsHtml = (t.tags && t.tags.length)
    ? '<div class="cc-tags">' + t.tags.slice(0, 4).map((tg) => '<span class="cc-tag">' + esc(tg) + "</span>").join("") + (t.tags.length > 4 ? '<span class="cc-tag more">+' + (t.tags.length - 4) + "</span>" : "") + "</div>"
    : "";
  return `<a class="content-card ${hasThumb ? "" : "thumb-fallback"}" href="#/task/${encodeURIComponent(t.folder)}">
    <div class="cc-thumb">${thumbHtml(t)}<span class="cc-ph">${kindIcon(t.kind)}</span>${newBadge}${zoomBtn}</div>
    <div class="cc-body">
      <div class="cc-title">${esc(displayName(t))}</div>
      <div class="cc-meta">${esc(kindLabel(t.kind))} · ${esc(fmtDate(t.task_date))}</div>
      ${tagsHtml}
      <div class="cc-foot">${statusBadge(t.status)}${t.campaign_id ? tag(t.campaign_id) : ""}</div>
    </div></a>`;
}

async function viewContent(arg, query) {
  setTitle("Conteúdo");
  const [{ tasks }, { campaigns }] = await Promise.all([API.content(), API.campaigns()]);
  const active = tasks.filter((t) => t.zone !== "approved");
  const campName = (id) => { const c = campaigns.find((x) => x.id === id); return c ? c.name : id; };
  const kinds = ["all"].concat(Object.keys(State.meta.kind_labels || {}).filter((k) => active.some((t) => t.kind === k)));
  const statuses = Array.from(new Set(active.map((t) => t.status)));
  const campIds = Array.from(new Set(active.map((t) => t.campaign_id).filter(Boolean)));
  const tagSet = Array.from(new Set([].concat.apply([], active.map((t) => t.tags || [])))).sort((a, b) => a.localeCompare(b));

  const kindChips = kinds.map((k) => `<button class="chip-filter" data-fkind="${esc(k)}">${k === "all" ? "Todos os tipos" : esc(kindLabel(k))}</button>`).join("");
  const statusOpts = '<option value="all">Todos os status</option>' + statuses.map((s) => `<option value="${esc(s)}">${esc(statusLabel(s))}</option>`).join("");
  const campOpts = '<option value="all">Todas as campanhas</option>' + campIds.map((id) => `<option value="${esc(id)}">${esc(campName(id))}</option>`).join("");
  const tagOpts = '<option value="all">Todas as tags</option>' + tagSet.map((tg) => `<option value="${esc(tg)}">${esc(tg)}</option>`).join("");

  setView(`
    <div class="section-head"><h2>Biblioteca de conteúdo</h2><button class="btn btn-primary" onclick="location.hash='#/create'">＋ Criar conteúdo</button></div>
    <div class="lib-toolbar">
      <input id="lib-search" class="lib-search" type="search" placeholder="Buscar por título…" />
      <select id="lib-status">${statusOpts}</select>
      ${campIds.length ? '<select id="lib-camp">' + campOpts + "</select>" : ""}
      ${tagSet.length ? '<select id="lib-tag">' + tagOpts + "</select>" : ""}
    </div>
    <div class="filter-bar" id="lib-kinds">${kindChips}</div>
    <div id="lib-grid"></div>`);

  const wantStatus = query && query.status && statuses.includes(query.status) ? query.status : "all";
  const wantTag = query && query.tag && tagSet.indexOf(query.tag) !== -1 ? query.tag : "all";
  const st = { kind: (query && query.kind) || "all", status: wantStatus, camp: "all", tag: wantTag, q: "" };
  function apply() {
    let shown = active.slice();
    if (st.kind !== "all") shown = shown.filter((t) => t.kind === st.kind);
    if (st.status !== "all") shown = shown.filter((t) => t.status === st.status);
    if (st.camp !== "all") shown = shown.filter((t) => (t.campaign_id || "") === st.camp);
    if (st.tag !== "all") shown = shown.filter((t) => (t.tags || []).indexOf(st.tag) !== -1);
    if (st.q) { const q = st.q.toLowerCase(); shown = shown.filter((t) => (displayName(t) + " " + (t.task_name || "") + " " + (t.tags || []).join(" ")).toLowerCase().includes(q)); }
    $$("#lib-kinds .chip-filter").forEach((b) => b.classList.toggle("on", b.dataset.fkind === st.kind));
    $("#lib-grid").innerHTML = shown.length
      ? '<div class="content-grid">' + shown.map(taskCard).join("") + "</div>"
      : '<div class="empty">Nenhuma peça com esses filtros. <a href="#/create">Criar conteúdo</a></div>';
  }
  if (st.status !== "all" && $("#lib-status")) $("#lib-status").value = st.status;
  if (st.tag !== "all" && $("#lib-tag")) $("#lib-tag").value = st.tag;
  $$("#lib-kinds .chip-filter").forEach((b) => { b.onclick = () => { st.kind = b.dataset.fkind; apply(); }; });
  $("#lib-status").onchange = () => { st.status = $("#lib-status").value; apply(); };
  if ($("#lib-camp")) $("#lib-camp").onchange = () => { st.camp = $("#lib-camp").value; apply(); };
  if ($("#lib-tag")) $("#lib-tag").onchange = () => { st.tag = $("#lib-tag").value; apply(); };
  $("#lib-search").oninput = () => { st.q = $("#lib-search").value.trim(); apply(); };
  apply();
}

async function viewApproved(arg, query) {
  setTitle("Aprovados");
  const [{ tasks }, { campaigns }] = await Promise.all([API.content(), API.campaigns()]);
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
    <div class="section-head"><h2>Conteúdo aprovado</h2><span class="dim">${approved.length} peça(s) versionada(s)</span></div>
    ${campSet.length ? '<div class="filter-bar">' + campFilters + "</div>" : ""}
    ${shown.length ? groups : '<div class="empty">Nenhuma peça aprovada ainda. Aprove peças em <a href="#/content">Conteúdo</a>.</div>'}`);
  $$(".filter-bar .chip-filter").forEach((b) => { b.onclick = () => { location.hash = "#/approved?campaign=" + encodeURIComponent(b.dataset.camp); }; });
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
      : `<button class="btn btn-sm" onclick="openFile('${esc(folder)}','${esc(f.rel)}')">ver</button>`;
  return `<div class="list-row"><div class="lr-main"><div class="lr-title">${esc(f.rel)}</div><div class="lr-meta">${f.size} bytes</div></div>
    <div class="flex">${viewBtn}<a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, f.rel)}" download>baixar</a></div></div>`;
}

function mediaGallery(folder, task) {
  const imgs = task.files.filter((f) => f.isImage);
  const vids = task.files.filter((f) => f.isVideo);
  if (!imgs.length && !vids.length) return "";
  const items = []
    .concat(vids.map((f) => `<div class="media-item"><div class="media-frame"><video src="${API.rawUrl(folder, f.rel)}" controls preload="metadata"></video><button class="media-zoom" title="Ampliar" onclick="openLightbox('${API.rawUrl(folder, f.rel)}','video','${API.downloadUrl(folder, f.rel)}')">⤢</button></div><a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, f.rel)}" download>baixar ${esc(f.rel.split("/").pop())}</a></div>`))
    .concat(imgs.map((f) => `<div class="media-item"><div class="media-frame"><img src="${API.rawUrl(folder, f.rel)}" alt="${esc(f.rel)}" loading="lazy" onclick="openLightbox('${API.rawUrl(folder, f.rel)}','image','${API.downloadUrl(folder, f.rel)}')" /><button class="media-zoom" title="Ampliar" onclick="openLightbox('${API.rawUrl(folder, f.rel)}','image','${API.downloadUrl(folder, f.rel)}')">⤢</button></div><a class="btn btn-sm btn-ghost" href="${API.downloadUrl(folder, f.rel)}" download>baixar</a></div>`));
  return `<div class="card"><h3>Mídia renderizada</h3><p class="muted mt">Clique na imagem para ampliar dentro do site.</p><div class="media-gallery mt">${items.join("")}</div></div>`;
}

// #2 — Strip ordenado de thumbnails dos slides de um carrossel (slide_1..n).
function carouselStrip(folder, task) {
  const slides = task.files
    .filter((f) => /slide_0*\d+\.png$/i.test(f.rel))
    .map((f) => ({ f, n: parseInt((f.rel.match(/slide_0*(\d+)\.png$/i) || [])[1] || "0", 10) }))
    .sort((a, b) => a.n - b.n);
  if (slides.length < 2) return "";
  const items = slides.map((s) =>
    `<button class="slide-thumb" title="Slide ${s.n} — ampliar" onclick="openLightbox('${API.rawUrl(folder, s.f.rel)}','image','${API.downloadUrl(folder, s.f.rel)}')">
      <img src="${API.rawUrl(folder, s.f.rel)}" alt="Slide ${s.n}" loading="lazy" /><span class="slide-num">${s.n}</span>
    </button>`).join("");
  return `<div class="card"><h3>Slides do carrossel <span class="dim">(${slides.length})</span></h3>
    <p class="muted mt">Ordem de publicação — clique para ampliar.</p>
    <div class="slide-strip mt">${items}</div></div>`;
}

function renderPanel(folder, task) {
  if (!isMediaKind(task.kind)) return "";
  const hasMedia = task.files.some((f) => f.isImage || f.isVideo);
  if (task.zone !== "active") {
    return `<div class="card"><h3>Renderização</h3><p class="muted mt">A peça está em <strong>${esc(zoneLabel(task.zone))}</strong>. Para re-renderizar, reabra para edição (rework).</p></div>`;
  }
  const label = task.kind === "video" ? "Renderizar vídeo (MP4)" : "Renderizar imagem (PNG)";
  const note = task.kind === "video"
    ? "Gera o MP4 9:16 via Remotion a partir do roteiro de cenas. Pode levar alguns minutos."
    : "Gera a arte final no padrão da marca via Playwright.";
  return `<div class="card">
    <h3>Renderização de mídia</h3>
    <p class="muted mt">${note}</p>
    <div class="flex mt"><button class="btn btn-primary" id="btn-render" data-kind="${esc(task.kind)}">${hasMedia ? "Re-renderizar" : label}</button><span id="render-out" class="muted"></span></div>
  </div>`;
}

function autoRenders(kind) { return kind === "image" || kind === "feed" || kind === "carousel"; }

function refineCard(task) {
  if (task.zone !== "active") return "";
  const ct = (State.meta.content_types || []).find((c) => c.kind === task.kind);
  if (!ct) return "";
  const note = autoRenders(task.kind)
    ? "A IA ajusta o conteúdo e <strong>re-renderiza a mídia automaticamente</strong>."
    : (task.kind === "video"
      ? "A IA ajusta o roteiro; depois clique em <strong>Re-renderizar</strong> (vídeo é mais lento)."
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
    const r = await API.refine({ content_type: ctId, current, instruction, campaign_id: s.campaign_id || undefined });
    if (r.simulated) toast("Ajuste simulado (configure a chave p/ IA real)", "warn");
    await API.save({
      content_type: ctId,
      brief: "Ajuste via painel: " + instruction,
      task_name: s.task_name, task_date: s.task_date,
      platforms: s.platforms || [], campaign_id: s.campaign_id || undefined,
      parsed: r.parsed, raw: r.raw,
    });
    if (autoRenders(task.kind)) {
      btn.innerHTML = '<span class="spinner"></span> re-renderizando…';
      const rr = await API.renderMedia(folder, task.kind);
      if (!rr.ok) toast("Ajustado, mas falhou a re-renderização: " + (rr.stderr || rr.error || "erro"), "warn");
      else toast("Ajustado e re-renderizado", "success");
    } else if (task.kind === "video") {
      toast("Roteiro ajustado — clique em Re-renderizar para atualizar o vídeo", "success");
    } else {
      toast("Conteúdo ajustado", "success");
    }
    router();
  } catch (e) {
    if (e.status === 422 && e.data && e.data.governance) toast("Ajuste bloqueado por regra de marca — reescreva a orientação.", "error");
    else toast(e.message, "error");
    btn.disabled = false; btn.textContent = orig;
  }
}

async function viewTaskDetail(folder) {
  const { task } = await API.task(folder);
  const s = task.status;
  setTitle(displayName(s));
  const actions = workflowActions(task);
  const canDiscard = task.zone !== "approved";
  const techSlug = s.title ? `<span class="dim" style="font-size:12.5px">slug: <span class="codeblock">${esc(s.task_name)}</span></span>` : "";
  setView(`
    <div class="flex-between mb flex-wrap">
      <div class="flex flex-wrap">${statusBadge(s.status)}${tag(kindLabel(task.kind))}${tag(zoneLabel(task.zone))}${(s.platforms || []).map((p) => tag(p)).join("")}${techSlug}</div>
      <a class="btn btn-sm btn-ghost" href="#/content">← voltar</a>
    </div>
    ${task.kind === "carousel" ? carouselStrip(folder, task) : ""}
    ${mediaGallery(folder, task)}
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
          <h3>Workflow de aprovação</h3>
          <div class="kv mt">
            <div class="k">Campanha</div><div>${s.campaign_id ? '<a href="#/campaign/' + esc(s.campaign_id) + '">' + esc(s.campaign_id) + "</a>" : "—"}</div>
            <div class="k">Ângulo</div><div>${esc(s.campaign_angle || "—")}</div>
            <div class="k">Criada</div><div>${esc(fmtDateTime(s.created_at))}</div>
            <div class="k">Atualizada</div><div>${esc(fmtDateTime(s.last_updated_at))}</div>
            ${s.approved_by ? '<div class="k">Aprovada por</div><div>' + esc(s.approved_by) + " · " + esc(fmtDateTime(s.approved_at)) + "</div>" : ""}
          </div>
          <hr class="sep" />
          <div class="flex flex-wrap" id="wf-actions">${actions}</div>
          <p class="muted mt">${workflowHint(s.status)}</p>
          ${canDiscard ? '<hr class="sep" /><button class="btn btn-sm btn-danger" id="btn-discard">Descartar peça</button><p class="muted mt">Move para <span class="codeblock">outputs/_archived/</span> (reversível, não apaga).</p>' : ""}
        </div>
      </div>
    </div>`);
  bindWorkflow(task);
  if ($("#btn-tags")) $("#btn-tags").onclick = () => editTags(folder, task.tags || []);
  if ($("#btn-refine")) $("#btn-refine").onclick = () => refineTask(folder, task);
  if ($("#btn-render")) {
    $("#btn-render").onclick = async () => {
      const btn = $("#btn-render"); const out = $("#render-out");
      btn.disabled = true; const orig = btn.textContent; btn.innerHTML = '<span class="spinner"></span> renderizando…';
      out.textContent = task.kind === "video" ? "isto pode levar alguns minutos…" : "";
      try {
        const r = await API.renderMedia(folder, btn.dataset.kind);
        if (!r.ok) throw new Error(r.stderr || r.error || "falha na renderização");
        toast("Mídia renderizada", "success"); router();
      } catch (e) { toast(e.message, "error"); btn.disabled = false; btn.textContent = orig; out.textContent = ""; }
    };
  }
  if ($("#btn-discard")) {
    $("#btn-discard").onclick = async () => {
      const ok = await uiConfirm("A peça vai para outputs/_archived/ (reversível — pode ser restaurada manualmente).", { title: "Descartar “" + displayName(s) + "”?", confirmText: "Descartar peça", confirmKind: "danger" });
      if (!ok) return;
      try { await API.discard(folder); toast("Peça descartada (arquivada)", "warn"); location.hash = "#/content"; }
      catch (e) { toast(e.message, "error"); }
    };
  }
}

// #5 — Edita as tags da peça (rótulos livres, separados por vírgula).
async function editTags(folder, current) {
  const res = await uiModal({
    title: "Editar tags",
    message: "Separe por vírgula. Até 12 tags, 32 caracteres cada.",
    fields: [{ name: "tags", label: "Tags", value: (current || []).join(", "), placeholder: "ex.: taxa-zero, instagram, q3" }],
    confirmText: "Salvar tags",
  });
  if (!res) return;
  try {
    await API.setTags(folder, res.tags);
    toast("Tags atualizadas", "success");
    router();
  } catch (e) { toast(e.message, "error"); }
}

function workflowActions(task) {
  const s = task.status.status;
  if (s === "draft") return `<button class="btn btn-primary" data-wf="preview">Gerar preview → em revisão</button>`;
  if (s === "in_review") return `<button class="btn btn-primary" data-wf="approve">Aprovar</button><button class="btn btn-danger" data-wf="reject">Rejeitar</button><button class="btn btn-sm" data-wf="preview">Regerar preview</button>`;
  if (s === "approved") return `<span class="badge approved">aprovada e versionada</span><button class="btn btn-sm" data-wf="rework">Reabrir p/ edição (rework)</button>`;
  if (s === "rejected") return `<button class="btn btn-sm" data-wf="rework">Reabrir (rework)</button>`;
  return "";
}
function workflowHint(s) {
  if (s === "draft") return "Gerar preview revisa a peça e move para 'em revisão'.";
  if (s === "in_review") return "Aprovar versiona a peça (SHA-256) em outputs/approved. Rejeitar arquiva.";
  if (s === "approved") return "Aprovada: não edite os arquivos diretamente. Use rework para alterar e reaprovar.";
  if (s === "rejected") return "Rejeitada e arquivada. Reabra para retrabalhar.";
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
          busy(); const r = await API.preview(task.folder); if (!r.ok) throw new Error(r.stderr || "falha no preview"); toast("Preview gerado · em revisão", "success");
        } else if (wf === "approve") {
          const res = await uiModal({ title: "Aprovar peça", message: "Versiona a peça (SHA-256) em outputs/approved.", fields: [{ name: "by", label: "Aprovado por (seu nome)", placeholder: "ex.: Hugo Belo" }], confirmText: "Aprovar e versionar" });
          if (!res || !res.by) return;
          busy(); const r = await API.promote(task.folder, { to: "approved", by: res.by }); if (!r.ok) throw new Error(r.stderr || "falha"); toast("Aprovada e versionada", "success");
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
function openLightbox(url, type, dlUrl) {
  const lb = $("#lightbox");
  const stage = $("#lightbox-stage");
  if (!lb || !stage) { window.open(url, "_blank"); return; }
  stage.innerHTML = type === "video"
    ? `<video src="${url}" controls autoplay playsinline></video>`
    : `<img src="${url}" alt="" />`;
  const dl = $("#lightbox-dl");
  if (dl) { dl.href = dlUrl || url; dl.style.display = dlUrl ? "" : "none"; }
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}
// #6 — Pré-visualiza HTML (ex.: preview.html) num modal amplo e responsivo.
async function openHtmlLightbox(folder, rel, dlUrl) {
  const lb = $("#lightbox");
  const stage = $("#lightbox-stage");
  if (!lb || !stage) { window.open(API.rawUrl(folder, rel), "_blank"); return; }
  stage.innerHTML = '<div class="lightbox-loading"><span class="spinner"></span> carregando…</div>';
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  try {
    const text = await API.taskFile(folder, rel);
    if (_lbBlobUrl) { URL.revokeObjectURL(_lbBlobUrl); _lbBlobUrl = null; }
    _lbBlobUrl = URL.createObjectURL(new Blob([text], { type: "text/html" }));
    stage.innerHTML = `<iframe class="lightbox-frame" src="${_lbBlobUrl}" title="${esc(rel)}"></iframe>`;
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
  if (_lbBlobUrl) { URL.revokeObjectURL(_lbBlobUrl); _lbBlobUrl = null; }
  document.body.classList.remove("no-scroll");
}
function setupLightbox() {
  const lb = $("#lightbox");
  if (!lb) return;
  const closeBtn = $("#lightbox-close");
  if (closeBtn) closeBtn.onclick = closeLightbox;
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.id === "lightbox-stage") closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lb.classList.contains("open")) closeLightbox(); });
}
window.openLightbox = openLightbox;
window.openHtmlLightbox = openHtmlLightbox;
window.closeLightbox = closeLightbox;

/* =====================================================================
   CRIAR CONTEÚDO (geração com IA)
   ===================================================================== */
let LAST_GEN = null;
async function viewCreate(arg, query) {
  setTitle("Criar conteúdo");
  const { campaigns } = await API.campaigns();
  const preCamp = (query && query.campaign) || "";
  const preType = (query && query.type) || State.meta.content_types[0].id;
  const campOpts = '<option value="">— sem campanha —</option>' + campaigns.map((c) => `<option value="${esc(c.id)}" ${c.id === preCamp ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  const typeCards = State.meta.content_types.map((c) => `
    <button type="button" class="type-card ${c.id === preType ? "on" : ""}" data-type="${esc(c.id)}" title="${esc(c.description)}">
      <span class="tc-icon">${esc(c.icon || "▣")}</span>
      <span class="tc-label">${esc(c.short || c.label)}</span>
      <span class="tc-media badge plain">${esc(mediaLabel(c.media))}</span>
    </button>`).join("");
  setView(`
    <div class="grid grid-2">
      <div class="card">
        <h3>Brief da peça</h3>
        <div class="field mt"><label>Campanha</label><select id="g-camp">${campOpts}</select></div>
        <div class="field"><label>Tipo de conteúdo</label>
          <div class="type-grid" id="g-type-grid">${typeCards}</div>
          <input type="hidden" id="g-type" value="${esc(preType)}" />
          <div class="hint" id="g-type-desc"></div>
        </div>
        <div class="field"><label>Título da peça <span class="hint">(nome legível, ex.: “Taxa Zero — produtores 50k+”)</span></label><input id="g-title" placeholder="Taxa Zero para produtores estabelecidos" /><div class="field-error" id="e-title"></div></div>
        <div class="field"><label>Tema / objetivo da peça</label><textarea id="g-brief" rows="3" placeholder="ex.: Anunciar a Taxa Zero para produtores que faturam 50k+ e estão insatisfeitos com prazos"></textarea><div class="field-error" id="e-brief"></div></div>
        <div class="field"><label>Plataformas <span class="hint" id="g-plats-hint"></span></label><div class="checks" id="g-plats"></div></div>
        <div class="row">
          <div class="field"><label>Tom (opcional)</label><input id="g-tone" placeholder="ex.: editorial, direto" /></div>
          <div class="field"><label>Oferta/número a destacar</label><input id="g-offer" placeholder="ex.: 0% por 3 meses" /></div>
        </div>
        <div class="field"><label>Referência visual / mood (opcional) <span class="hint">(clima, estilo ou referência a evocar — sempre dentro da marca)</span></label><textarea id="g-mood" rows="2" placeholder="ex.: editorial sóbrio, foco em prova de número, sensação de exclusividade convidativa"></textarea></div>
        <div class="field"><label>Observações extras (opcional)</label><textarea id="g-extra" rows="2"></textarea></div>
        <div class="field"><label>Data</label><input type="date" id="g-date" value="${todayISO()}" style="max-width:220px" /></div>
        <details class="adv-block">
          <summary>Identificador técnico (avançado)</summary>
          <div class="field"><label>Slug da pasta <span class="hint">(derivado do título; só edite se souber o que faz)</span></label><input id="g-task" placeholder="taxa_zero_caption" /><div class="field-error" id="e-task"></div></div>
        </details>
        <button class="btn btn-primary mt" id="g-run">Gerar com IA</button>
      </div>
      <div class="card create-result">
        <div class="flex-between"><h3>Resultado</h3><span id="g-flag"></span></div>
        <div id="g-result"><div class="empty">Preencha o brief e clique em <strong>Gerar com IA</strong>.</div></div>
      </div>
    </div>`);

  const campMap = {}; campaigns.forEach((c) => { campMap[c.id] = c; });
  function renderPlats(selected, inherited) {
    const set = (selected && selected.length) ? selected : ["instagram"];
    $("#g-plats").innerHTML = State.meta.platforms.map((p) => checkPill("gplat", p, set.includes(p))).join("");
    bindCheckPills($("#g-plats"));
    $("#g-plats-hint").textContent = inherited ? "(herdadas da campanha — ajuste se quiser)" : "";
  }
  const preCampObj = preCamp && campMap[preCamp];
  renderPlats(preCampObj ? preCampObj.platforms : ["instagram"], !!preCampObj);
  $("#g-camp").addEventListener("change", () => {
    const c = campMap[$("#g-camp").value];
    renderPlats(c && c.platforms && c.platforms.length ? c.platforms : ["instagram"], !!c);
  });
  const updDesc = () => { const ct = metaType($("#g-type").value); $("#g-type-desc").textContent = ct ? ct.description : ""; };
  $$("#g-type-grid .type-card").forEach((card) => {
    card.onclick = () => {
      $$("#g-type-grid .type-card").forEach((c) => c.classList.remove("on"));
      card.classList.add("on");
      $("#g-type").value = card.dataset.type;
      updDesc();
    };
  });
  updDesc();
  $("#g-title").addEventListener("input", () => { if ($("#g-task").value === "" || $("#g-task").dataset.auto) { $("#g-task").value = slugify($("#g-title").value).slice(0, 40); $("#g-task").dataset.auto = "1"; } });
  $("#g-task").addEventListener("input", () => { delete $("#g-task").dataset.auto; });

  $("#g-run").onclick = runGenerate;
}

async function runGenerate() {
  const brief = $("#g-brief").value.trim();
  $("#e-brief").textContent = ""; $("#g-brief").classList.remove("invalid");
  if (brief.length < 8) { $("#g-brief").classList.add("invalid"); $("#e-brief").textContent = "Descreva o tema (mín. 8 caracteres)."; return; }
  const payload = {
    content_type: $("#g-type").value,
    brief,
    campaign_id: $("#g-camp").value || undefined,
    platforms: collectChecks($("#view"), "gplat"),
    tone: $("#g-tone").value.trim() || undefined,
    key_offer: $("#g-offer").value.trim() || undefined,
    mood: ($("#g-mood") && $("#g-mood").value.trim()) || undefined,
    extra: $("#g-extra").value.trim() || undefined,
  };
  const btn = $("#g-run"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> gerando…';
  try {
    const r = await API.generate(payload);
    LAST_GEN = { req: payload, res: r };
    renderGenResult(r);
  } catch (e) { toast(e.message, "error"); }
  finally { btn.disabled = false; btn.textContent = "Gerar com IA"; }
}

function renderGenResult(r) {
  $("#g-flag").innerHTML = r.simulated ? '<span class="sim-flag">SIMULADO</span>' : '<span class="badge plain">' + esc(r.model) + "</span>";
  const ct = metaType(r.content_type);
  let editorVal;
  if (ct.format === "json") editorVal = JSON.stringify(r.parsed || {}, null, 2);
  else editorVal = composeText(r.parsed, r.raw);
  const gov = r.governance || { errors: [], warnings: [] };
  $("#g-result").innerHTML = `
    ${ct.format === "json" ? structuredPreview(r.content_type, r.parsed) : ""}
    <div class="field mt"><label>Conteúdo (editável)</label><textarea id="g-edit" rows="${ct.format === "json" ? 16 : 8}" style="font-family:${ct.format === "json" ? "var(--mono)" : "var(--font)"}">${esc(editorVal)}</textarea></div>
    <div class="gov" id="g-gov">${govHtml(gov)}</div>
    <div class="refine-box mt">
      <label>Ajustar com IA <span class="hint">(descreva o que mudar; o resto é mantido)</span></label>
      <textarea id="g-refine" rows="2" placeholder="ex.: encurte o headline e troque o CTA por Solicitar convite"></textarea>
      <button class="btn btn-sm mt" id="g-refine-btn">Aplicar ajuste</button>
    </div>
    <div class="flex mt"><button class="btn btn-primary" id="g-save">Salvar na campanha</button><button class="btn btn-ghost" id="g-regen">Regerar do zero</button></div>`;
  $("#g-regen").onclick = runGenerate;
  $("#g-save").onclick = saveGenerated;
  $("#g-refine-btn").onclick = refineGenerated;
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
  };
  const btn = $("#g-refine-btn"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ajustando…';
  try {
    const r = await API.refine(payload);
    LAST_GEN.res = Object.assign({}, LAST_GEN.res, {
      parsed: r.parsed, raw: r.raw, governance: r.governance,
      simulated: r.simulated, model: r.model, content_type: r.content_type,
    });
    renderGenResult(LAST_GEN.res);
    toast(r.simulated ? "Ajuste simulado (configure a chave p/ IA real)" : "Ajuste aplicado", r.simulated ? "warn" : "success");
  } catch (e) {
    toast(e.message, "error");
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
function govHtml(gov) {
  if (!gov.errors.length && !gov.warnings.length) return '<div class="gov-item ok">✓ Passou no checklist de marca (sem violações).</div>';
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
    <div class="save-banner-actions"><button class="btn btn-ghost btn-sm" data-sb="stay">Ficar aqui</button>
      <a class="btn btn-primary" href="${url}">Abrir peça →</a></div>`;
  host.insertAdjacentElement("afterbegin", el);
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  let n = 3; let cancelled = false;
  const countEl = el.querySelector(".save-count");
  const stop = () => { cancelled = true; clearInterval(timer); const sub = el.querySelector(".muted"); if (sub) sub.textContent = "Use o botão para abrir quando quiser."; };
  el.querySelector('[data-sb="stay"]').onclick = stop;
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
  $("#e-task").textContent = "";
  if (title.length < 3) { if ($("#g-title")) $("#g-title").classList.add("invalid"); if ($("#e-title")) $("#e-title").textContent = "Dê um título à peça (mín. 3 caracteres)."; return; }
  if (!task) task = slugify(title).slice(0, 40);
  if (!/^[a-z0-9][a-z0-9_\-]*$/.test(task)) { $("#g-task").classList.add("invalid"); $("#e-task").textContent = "Slug inválido (a-z, 0-9, _ ou -)."; return; }
  if (!date) { toast("Informe a data.", "error"); return; }
  const ct = metaType(LAST_GEN.req.content_type);
  const editVal = $("#g-edit").value;
  let parsed = null, raw = editVal;
  if (ct.format === "json") { try { parsed = JSON.parse(editVal); } catch (e) { toast("JSON inválido no editor: " + e.message, "error"); return; } }
  const payload = Object.assign({}, LAST_GEN.req, { task_name: task, title, task_date: date, parsed, raw });
  const btn = $("#g-save"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> salvando…';
  try {
    const r = await API.save(payload);
    $("#g-gov").innerHTML = govHtml(r.governance);
    toast("Salvo em " + r.folder + "/" + r.file, "success");
    showSaveBanner(r.folder);
  } catch (e) {
    if (e.status === 422 && e.data && e.data.governance) { $("#g-gov").innerHTML = govHtml(e.data.governance); toast("Bloqueado por regra de marca — corrija o conteúdo.", "error"); }
    else if (e.data && e.data.errors) { e.data.errors.forEach((x) => toast(x, "error")); }
    else toast(e.message, "error");
  } finally { btn.disabled = false; btn.textContent = "Salvar na campanha"; }
}

/* =====================================================================
   CONFIGURAÇÕES
   ===================================================================== */
async function viewSettings() {
  setTitle("Configurações");
  const s = await API.settings();
  State.settings = s;
  const models = [
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 (equilíbrio — recomendado)" },
    { id: "claude-opus-4-7", label: "Opus 4.7 (máxima qualidade)" },
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (rápido/econômico)" },
  ];
  setView(`
    <div class="card" style="max-width:660px">
      <h3>Inteligência Artificial (Claude)</h3>
      <p class="muted mt">Cole sua chave da Anthropic. Ela é salva apenas localmente em <span class="codeblock">interface/.env</span> (fora do git) e nunca é exposta no front.</p>
      <div class="field mt"><label>Chave Anthropic (ANTHROPIC_API_KEY)
        ${s.has_key ? '<span class="key-badge ok">✓ Chave configurada</span>' : '<span class="key-badge none">Nenhuma chave</span>'}</label>
        <input id="s-key" class="${s.has_key ? "has-key" : ""}" type="password" placeholder="${s.has_key ? "configurada: " + esc(s.masked_key) + " — cole para substituir" : "sk-ant-..."}" />
      </div>
      <div class="flex"><button class="btn btn-primary" id="s-save-key">Salvar chave</button><button class="btn" id="s-test">Testar conexão</button><span id="s-test-out" class="muted"></span></div>
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
      <h3>Aparência</h3>
      <p class="muted mt">Cor de destaque da interface (preferência local, só do seu navegador). Não altera as cores das peças renderizadas — a marca permanece travada.</p>
      <div class="field mt"><label>Cor de destaque</label>
        <div class="accent-grid" id="accent-grid">${Object.keys(ACCENT_PRESETS).map((id) => {
          const p = ACCENT_PRESETS[id];
          const sw = p.swatch ? '<span class="accent-sw" style="background:' + p.swatch + '"></span>' : '<span class="accent-sw accent-sw-auto"></span>';
          return '<button type="button" class="accent-opt" data-accent-id="' + id + '">' + sw + '<span>' + esc(p.label) + "</span></button>";
        }).join("")}</div>
      </div>
    </div>`);
  const markAccent = () => { const cur = currentAccent(); $$("#accent-grid .accent-opt").forEach((b) => b.classList.toggle("on", b.dataset.accentId === cur)); };
  $$("#accent-grid .accent-opt").forEach((b) => { b.onclick = () => { setAccent(b.dataset.accentId); markAccent(); toast("Aparência atualizada", "success"); }; });
  markAccent();
  $("#s-save-key").onclick = async () => {
    const key = $("#s-key").value.trim();
    if (key.length < 10) { toast("Chave muito curta.", "error"); return; }
    if (s.has_key) {
      const ok = await uiConfirm("Já existe uma chave configurada (" + s.masked_key + "). Deseja substituí-la pela nova chave?", { title: "Substituir chave", confirmText: "Substituir", confirmKind: "danger" });
      if (!ok) return;
    }
    try { await API.saveKey(key); toast("Chave salva", "success"); await refreshKeyStatus(); viewSettings(); } catch (e) { toast(e.message, "error"); }
  };
  $("#s-save-model").onclick = async () => { await API.saveModel($("#s-model").value); toast("Modelo salvo", "success"); await refreshKeyStatus(); };
  $("#s-test").onclick = async () => {
    const out = $("#s-test-out"); out.innerHTML = '<span class="spinner"></span> testando…';
    try { const r = await API.testKey(); out.innerHTML = r.ok ? '✓ conectado (' + esc(r.model) + ")" : "✕ " + esc(r.error); }
    catch (e) { out.textContent = "✕ " + (e.data && e.data.error || e.message); }
  };
}

/* =====================================================================
   componentes reutilizáveis (checkbox pills)
   ===================================================================== */
function checkPill(group, value, on) {
  return `<label class="check ${on ? "on" : ""}"><input type="checkbox" data-group="${group}" value="${esc(value)}" ${on ? "checked" : ""} /> ${esc(value)}</label>`;
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
function setupAssistant() {
  const panel = $("#assistant");
  $("#btn-assistant").onclick = () => panel.classList.add("open");
  $("#assistant-close").onclick = () => panel.classList.remove("open");
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
      loading.innerHTML = esc(r.answer) + (r.simulated ? ' <span class="sim-flag">SIMULADO</span>' : "");
    } catch (err) { loading.innerHTML = "Erro: " + esc(err.message); }
    log.scrollTop = log.scrollHeight;
  };
}

/* =====================================================================
   Menu mobile
   ===================================================================== */
function openSidebar() { $("#sidebar").classList.add("open"); $("#scrim").classList.add("open"); }
function closeSidebar() { const sb = $("#sidebar"); if (sb) sb.classList.remove("open"); const sc = $("#scrim"); if (sc) sc.classList.remove("open"); }
function setupMenu() {
  const btn = $("#btn-menu"); if (btn) btn.onclick = openSidebar;
  const scrim = $("#scrim"); if (scrim) scrim.onclick = closeSidebar;
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
  setupMenu();
  try { State.meta = await API.meta(); } catch (e) { setView('<div class="empty">Não foi possível conectar ao servidor.</div>'); return; }
  setupAssistant();
  setupLightbox();
  await refreshKeyStatus();
  window.addEventListener("hashchange", router);
  router();
}
boot();
