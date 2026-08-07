// public/js/api.js — cliente de API do painel.
const API = (() => {
  async function req(method, url, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    let r;
    try {
      r = await fetch(url, opt);
    } catch (e) {
      // Falha de REDE: a requisição nem chegou a ter resposta. O fetch estoura aqui, ANTES de
      // qualquer tratamento abaixo, e a mensagem dele é "Failed to fetch" — inglês de biblioteca,
      // que ia direto para a tela do usuário (foi o que apareceu no Assistente). Acontece quando o
      // painel foi reiniciado no meio do pedido, quando a internet cai, ou quando a aba ficou aberta
      // desde antes de um deploy. Como TODA chamada do painel passa por aqui, traduzir neste ponto
      // resolve a tela inteira de uma vez.
      const err = new Error("Não consegui falar com o painel agora. Verifique a conexão e tente de novo — se você deixou esta aba aberta por muito tempo, recarregue a página.");
      err.status = 0; err.code = "E_REDE"; err.data = null; err.original = (e && e.message) || String(e);
      throw err;
    }
    const ct = r.headers.get("content-type") || "";
    let data;
    if (ct.includes("application/json")) data = await r.json();
    else data = await r.text();
    if (!r.ok) {
      // O 413 tem duas origens muito diferentes: o body-parser do Express (imagens grandes demais,
      // sem `code`) e as rotas que recusam texto por tamanho (com `code` próprio). Discriminar pelo
      // CÓDIGO, não pela presença de `data.error` — o 413 do body-parser também traz `error`
      // ("request entity too large"), então testar por `error` desligaria a mensagem em português
      // em todos os casos e devolveria inglês de biblioteca a quem só anexou fotos demais.
      const msg = (r.status === 413 && !(data && data.code))
        ? "Arquivos grandes demais para enviar de uma vez — reduza o número ou o tamanho das imagens."
        : ((data && data.error) || ("HTTP " + r.status));
      const err = new Error(msg);
      err.status = r.status; err.data = data;
      err.code = (data && data.code) || null; // código do erro à mão (E_ALREADY_PUBLISHED, etc.)
      // Sessao ausente/expirada: avisa o app para reabrir o login (menos nas rotas de auth).
      if (r.status === 401 && data && data.code === "E_AUTH" && !/\/api\/auth\//.test(url)) {
        try { window.dispatchEvent(new CustomEvent("auth:expired")); } catch (_) { /* fora do browser */ }
      }
      throw err;
    }
    return data;
  }
  // Cache curto das buscas Pexels: evita GASTAR a cota da API refazendo buscas IDÊNTICAS —
  // paginar ida-e-volta, alternar um filtro e voltar, reabrir a mesma busca, ou o modal→"Ver mais"
  // que repetem o mesmo termo. Chave = payload (query+filtros+página). TTL 5min, teto 50 entradas.
  const _pxCache = new Map();
  const PX_CACHE_MS = 5 * 60 * 1000;
  async function pexelsSearchCached(payload) {
    const key = JSON.stringify(payload || {});
    const hit = _pxCache.get(key);
    if (hit && (Date.now() - hit.t) < PX_CACHE_MS) return hit.data;
    const data = await req("POST", "/api/pexels/search", payload);
    if (data && data.ok) { _pxCache.set(key, { t: Date.now(), data }); if (_pxCache.size > 50) _pxCache.delete(_pxCache.keys().next().value); }
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
    // Tavily (pesquisa de mercado)
    saveTavilyKey: (key) => req("POST", "/api/settings/tavily-key", { key }),
    testTavily: () => req("POST", "/api/settings/tavily-test"),
    // Pexels (banco de imagens)
    savePexelsKey: (key) => req("POST", "/api/settings/pexels-key", { key }),
    testPexels: () => req("POST", "/api/settings/pexels-test"),
    pexelsSearch: (payload) => pexelsSearchCached(payload),
    pexelsPick: (payload) => req("POST", "/api/pexels/pick", payload),
    // Captura de site: o painel abre a página num navegador e guarda o print no acervo.
    // É o caminho para o que banco de imagem nenhum tem — o dashboard da 4Selet, a matéria publicada.
    capturePresets: () => req("GET", "/api/capture/presets"),
    captureUrl: (payload) => req("POST", "/api/capture", payload),
    // credenciais de integração inseridas pelo painel (admin) — grava em data/, nunca volta o valor
    saveCredential: (name, value) => req("POST", "/api/settings/credential", { name, value }),
    // provedores de IA (multi-IA: Claude / ChatGPT / ...)
    providers: () => req("GET", "/api/settings/providers"),
    saveProviderKey: (provider, key) => req("POST", "/api/settings/provider/key", { provider, key }),
    saveProviderModel: (provider, model) => req("POST", "/api/settings/provider/model", { provider, model }),
    testProvider: (provider) => req("POST", "/api/settings/provider/test", { provider }),
    setDefaultProvider: (provider) => req("POST", "/api/settings/provider/default", { provider }),
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
    pruneCollection: (id) => req("POST", "/api/collections/" + encodeURIComponent(id) + "/prune", {}),
    reorderCollection: (id, order) => req("PUT", "/api/collections/" + encodeURIComponent(id) + "/order", { order }),
    // content
    content: () => req("GET", "/api/content"),
    task: (folder) => req("GET", "/api/content/" + encodeURIComponent(folder)),
    taskFile: (folder, rel) => fetch("/api/content/" + encodeURIComponent(folder) + "/file?rel=" + encodeURIComponent(rel)).then(r => r.text()),
    rawUrl: (folder, rel) => "/api/content/" + encodeURIComponent(folder) + "/raw?rel=" + encodeURIComponent(rel),
    downloadUrl: (folder, rel, scale) => "/api/content/" + encodeURIComponent(folder) + "/download?rel=" + encodeURIComponent(rel) + (scale ? "&scale=" + encodeURIComponent(scale) : ""),
    zipUrl: (folder) => "/api/content/" + encodeURIComponent(folder) + "/zip",
    preview: (folder) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/preview"),
    renderMedia: (folder, kind, template, logo, watermark, font) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/render?kind=" + encodeURIComponent(kind) + (template ? "&template=" + encodeURIComponent(template) : "") + (logo ? "&logo=" + encodeURIComponent(logo) : "") + (watermark ? "&watermark=" + encodeURIComponent(watermark) : "") + (font ? "&font=" + encodeURIComponent(font) : "")),
    discard: (folder) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/discard"),
    setTags: (folder, tags) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/tags", { tags }),
    promote: (folder, payload) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/promote", payload),
    // importar conteúdo pronto (feito fora do painel) como peça de rascunho
    importContent: (payload) => req("POST", "/api/content/import", payload),
    // editar/gravar a legenda de uma peça (correção da importada)
    saveCaption: (folder, caption) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/caption", { caption }),
    // historico de versoes (desfazer/restaurar)
    contentVersions: (folder, rel) => req("GET", "/api/content/" + encodeURIComponent(folder) + "/versions" + (rel ? "?rel=" + encodeURIComponent(rel) : "")),
    restoreVersion: (folder, rel, id) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/restore", { rel, id }),
    saveEditedHtml: (folder, rel, html) => req("POST", "/api/content/" + encodeURIComponent(folder) + "/edit-html", { rel, html }),
    // acervo de imagens (fotos enviadas) — remover uma do acervo
    deleteUpload: (name) => req("DELETE", "/api/uploads/" + encodeURIComponent(name)),
    // publicação (Instagram)
    publishStatus: () => req("GET", "/api/publish/status"),
    savePublishConfig: (cfg) => req("POST", "/api/publish/config", cfg),
    testPublish: () => req("POST", "/api/publish/test"),
    publishPiece: (folder, payload) => req("POST", "/api/publish/" + encodeURIComponent(folder), payload || {}),
    schedulePost: (folder, payload) => req("POST", "/api/publish/" + encodeURIComponent(folder) + "/schedule", payload || {}),
    markPublished: (folder, payload) => req("POST", "/api/publish/" + encodeURIComponent(folder) + "/mark-published", payload || {}),
    listSchedule: () => req("GET", "/api/publish/schedule"),
    publications: () => req("GET", "/api/publish/publications"),
    cancelSchedule: (id) => req("DELETE", "/api/publish/schedule/" + encodeURIComponent(id)),
    // generate
    generate: (payload) => req("POST", "/api/generate", payload),
    renderPreview: (payload) => req("POST", "/api/generate/preview", payload),
    // fatos de mercado: passo próprio, disparado por botão (não roda dentro da geração)
    buscarFatos: (pillar, alternativa) => req("POST", "/api/generate/research", { pillar, alternativa: !!alternativa }),
    refine: (payload) => req("POST", "/api/generate/refine", payload),
    regenerateSlide: (folder, index, instruction) => req("POST", "/api/generate/slide", { folder, index, instruction }),
    regenerateSlideMem: (payload) => req("POST", "/api/generate/slide-mem", payload || {}),
    save: (payload) => req("POST", "/api/generate/save", payload),
    assistant: (question, context) => req("POST", "/api/generate/assistant", { question, context }),
    // le o tema escrito em linguagem natural e diz o que entendeu (NAO gera nada)
    interpretBrief: (texto, provider) => req("POST", "/api/generate/interpret", { texto, provider }),
    // auth
    me: () => req("GET", "/api/auth/me"),
    login: (username, password) => req("POST", "/api/auth/login", { username, password }),
    logout: () => req("POST", "/api/auth/logout"),
    changePassword: (current, password) => req("POST", "/api/auth/password", { current, password }),
    firstPassword: (password) => req("POST", "/api/auth/first-password", { password }),
    acceptInvite: (token) => req("POST", "/api/auth/invite/accept", { token }),
    // usuarios (admin)
    users: () => req("GET", "/api/users"),
    createUser: (u) => req("POST", "/api/users", u),
    deleteUser: (username) => req("DELETE", "/api/users/" + encodeURIComponent(username)),
    resetUserPassword: (username, password) => req("POST", "/api/users/" + encodeURIComponent(username) + "/password", { password }),
    setUserRole: (username, role) => req("POST", "/api/users/" + encodeURIComponent(username) + "/role", { role }),
    setUserName: (username, name) => req("POST", "/api/users/" + encodeURIComponent(username) + "/name", { name }),
    setUsername: (username, newUsername) => req("POST", "/api/users/" + encodeURIComponent(username) + "/username", { username: newUsername }),
    createInvite: (username) => req("POST", "/api/users/" + encodeURIComponent(username) + "/invite", {}),
  };
})();
