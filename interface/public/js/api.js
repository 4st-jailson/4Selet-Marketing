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
      throw err;
    }
    return data;
  }
  return {
    meta: () => req("GET", "/api/meta"),
    // settings
    settings: () => req("GET", "/api/settings"),
    saveKey: (key) => req("POST", "/api/settings/key", { key }),
    saveModel: (model) => req("POST", "/api/settings/model", { model }),
    testKey: () => req("POST", "/api/settings/test"),
    // campaigns
    campaigns: () => req("GET", "/api/campaigns"),
    campaign: (id) => req("GET", "/api/campaigns/" + encodeURIComponent(id)),
    createCampaign: (c) => req("POST", "/api/campaigns", c),
    updateCampaign: (id, c) => req("PUT", "/api/campaigns/" + encodeURIComponent(id), c),
    deleteCampaign: (id) => req("DELETE", "/api/campaigns/" + encodeURIComponent(id)),
    // content
    content: () => req("GET", "/api/content"),
    task: (folder) => req("GET", "/api/content/" + encodeURIComponent(folder)),
    taskFile: (folder, rel) => fetch("/api/content/" + encodeURIComponent(folder) + "/file?rel=" + encodeURIComponent(rel)).then(r => r.text()),
    rawUrl: (folder, rel) => "/api/content/" + encodeURIComponent(folder) + "/raw?rel=" + encodeURIComponent(rel),
    downloadUrl: (folder, rel) => "/api/content/" + encodeURIComponent(folder) + "/download?rel=" + encodeURIComponent(rel),
    preview: (folder) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/preview"),
    renderMedia: (folder, kind, template) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/render?kind=" + encodeURIComponent(kind) + (template ? "&template=" + encodeURIComponent(template) : "")),
    discard: (folder) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/discard"),
    setTags: (folder, tags) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/tags", { tags }),
    promote: (folder, payload) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/promote", payload),
    // generate
    generate: (payload) => req("POST", "/api/generate", payload),
    refine: (payload) => req("POST", "/api/generate/refine", payload),
    save: (payload) => req("POST", "/api/generate/save", payload),
    assistant: (question, context) => req("POST", "/api/generate/assistant", { question, context }),
  };
})();
