// public/js/api.js — cliente de API do painel.
const API = (() => {
  async function req(method, url, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    const ct = r.headers.get("content-type") || "";
    let data;
    if (ct.includes("application/json")) data = await r.json();
    else data = await r.text();
    if (!r.ok) {
      const err = new Error((data && data.error) || ("HTTP " + r.status));
      err.status = r.status; err.data = data;
      // Sessao ausente/expirada: avisa o app para reabrir o login (menos nas rotas de auth).
      if (r.status === 401 && data && data.code === "E_AUTH" && !/\/api\/auth\//.test(url)) {
        try { window.dispatchEvent(new CustomEvent("auth:expired")); } catch (_) { /* fora do browser */ }
      }
      throw err;
    }
    return data;
  }
  return {
    meta: () => req("GET", "/api/meta"),
    // settings
    settings: () => req("GET", "/api/settings"),
    integrations: () => req("GET", "/api/settings/integrations"),
    saveKey: (key) => req("POST", "/api/settings/key", { key }),
    saveModel: (model) => req("POST", "/api/settings/model", { model }),
    testKey: () => req("POST", "/api/settings/test"),
    // campaigns
    campaigns: () => req("GET", "/api/campaigns"),
    campaign: (id) => req("GET", "/api/campaigns/" + encodeURIComponent(id)),
    createCampaign: (c) => req("POST", "/api/campaigns", c),
    updateCampaign: (id, c) => req("PUT", "/api/campaigns/" + encodeURIComponent(id), c),
    deleteCampaign: (id) => req("DELETE", "/api/campaigns/" + encodeURIComponent(id)),
    // collections (coleções curadas de peças, por referência, com ordem própria)
    collections: () => req("GET", "/api/collections"),
    collection: (id) => req("GET", "/api/collections/" + encodeURIComponent(id)),
    createCollection: (c) => req("POST", "/api/collections", c),
    updateCollection: (id, c) => req("PUT", "/api/collections/" + encodeURIComponent(id), c),
    deleteCollection: (id) => req("DELETE", "/api/collections/" + encodeURIComponent(id)),
    addToCollection: (id, folder) => req("POST", "/api/collections/" + encodeURIComponent(id) + "/items", { folder }),
    removeFromCollection: (id, folder) => req("DELETE", "/api/collections/" + encodeURIComponent(id) + "/items/" + encodeURIComponent(folder)),
    reorderCollection: (id, order) => req("PUT", "/api/collections/" + encodeURIComponent(id) + "/order", { order }),
    // content
    content: () => req("GET", "/api/content"),
    task: (folder) => req("GET", "/api/content/" + encodeURIComponent(folder)),
    taskFile: (folder, rel) => fetch("/api/content/" + encodeURIComponent(folder) + "/file?rel=" + encodeURIComponent(rel)).then(r => r.text()),
    rawUrl: (folder, rel) => "/api/content/" + encodeURIComponent(folder) + "/raw?rel=" + encodeURIComponent(rel),
    downloadUrl: (folder, rel, scale) => "/api/content/" + encodeURIComponent(folder) + "/download?rel=" + encodeURIComponent(rel) + (scale ? "&scale=" + encodeURIComponent(scale) : ""),
    preview: (folder) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/preview"),
    renderMedia: (folder, kind, template) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/render?kind=" + encodeURIComponent(kind) + (template ? "&template=" + encodeURIComponent(template) : "")),
    discard: (folder) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/discard"),
    setTags: (folder, tags) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/tags", { tags }),
    promote: (folder, payload) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/promote", payload),
    // generate
    generate: (payload) => req("POST", "/api/generate", payload),
    renderPreview: (payload) => req("POST", "/api/generate/preview", payload),
    refine: (payload) => req("POST", "/api/generate/refine", payload),
    save: (payload) => req("POST", "/api/generate/save", payload),
    assistant: (question, context) => req("POST", "/api/generate/assistant", { question, context }),
    // auth
    me: () => req("GET", "/api/auth/me"),
    login: (username, password) => req("POST", "/api/auth/login", { username, password }),
    logout: () => req("POST", "/api/auth/logout"),
    changePassword: (current, password) => req("POST", "/api/auth/password", { current, password }),
    // usuarios (admin)
    users: () => req("GET", "/api/users"),
    createUser: (u) => req("POST", "/api/users", u),
    deleteUser: (username) => req("DELETE", "/api/users/" + encodeURIComponent(username)),
    resetUserPassword: (username, password) => req("POST", "/api/users/" + encodeURIComponent(username) + "/password", { password }),
    setUserRole: (username, role) => req("POST", "/api/users/" + encodeURIComponent(username) + "/role", { role }),
  };
})();
