// routes/generate.js — geracao de conteudo com IA (prompt PADRAO + Claude),
// parsing estruturado, brand governance e salvamento na task/campanha.
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const ai = require("../lib/ai"); // dispatcher multi-provedor (Claude / OpenAI / ...)
const prompts = require("../lib/prompts");
const campaigns = require("../lib/campaigns");
const content = require("../lib/content");
const researchLib = require("../lib/research");
const render = require("../lib/render");
const { contentTypeById, pillarById, APPROVED_CTAS, BRIEF_MAX_CHARS } = require("../lib/config");
const { runBrandGovernance, validateContentRequest } = require("../lib/validation");

// Extrai o primeiro objeto JSON de um texto (tolera code fences / texto ao redor).
function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(s); } catch (e) { /* tenta achar bloco */ }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { /* nada */ }
  }
  return null;
}

// O modelo INVENTA foto. Pedindo "foto de fundo" no tema, em 3 de 3 gerações ele escreveu caminhos
// como "/uploads/escritorio-moderno-computador.jpg" — arquivos que não existem no acervo. Ele não tem
// como saber o que existe lá, então preenche com um nome plausível. O efeito era silencioso: o campo
// ia para o disco, a arte aplicava o véu de leitura por cima de nada (slide mais escuro que os
// vizinhos, sem foto) e ninguém era avisado de que a foto pedida não saiu.
// Aqui a foto fantasma é removida e VIRA AVISO — o pedido não é engolido em silêncio.
function limpaFotosInventadas(parsed) {
  const removidas = [];
  if (!parsed || typeof parsed !== "object") return removidas;
  const confere = (obj, slide) => {
    if (!obj || typeof obj !== "object" || !obj.image) return;
    if (render.imagemExiste(obj.image)) return;
    removidas.push({ slide, caminho: String(obj.image).slice(0, 120) });
    delete obj.image;
  };
  confere(parsed, 0);                                     // 0 = a peça toda (não é slide)
  if (Array.isArray(parsed.slides)) parsed.slides.forEach((s, i) => confere(s, i + 1));
  return removidas;
}
function avisaFotosInventadas(gov, removidas) {
  if (!gov || !removidas || !removidas.length) return;
  if (!Array.isArray(gov.warnings)) gov.warnings = [];
  const ns = removidas.filter((r) => r.slide > 0).map((r) => r.slide);
  const onde = !ns.length ? "nesta peça"
    : ns.length === 1 ? "no slide " + ns[0]
      : "nos slides " + ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1];
  gov.warnings.push("Você pediu foto " + onde + ", e a peça vai sair sem ela. A IA não enxerga o seu acervo, "
    + "então ela escreve o nome de um arquivo que não existe. Para colocar a foto: use \"Buscar imagem\" no "
    + "slide, ou envie a sua em Criar Conteúdo.");
}

// Alerta de marca PRÉ-aplicação: se o pedido do usuário citou cor fora da paleta oficial
// (branco puro / preto puro / neon), anexa um aviso explicando o impacto + a fonte (brand_identity.md).
// Vira warning no objeto de governança que o front já exibe.
function paletteWarn(gov, instruction) {
  if (!gov) return;
  const s = String(instruction || "").toLowerCase();
  if (/\bbranco\b|#fff\b|#ffffff\b|\bneon\b|preto puro/.test(s)) {
    if (!Array.isArray(gov.warnings)) gov.warnings = [];
    gov.warnings.push("Cor fora da paleta 4Selet: a marca não usa branco puro nem neon (fonte: brand_identity.md). O mais próximo na identidade é o tema claro (fundo Cloud #D9DCD6) — foi o que apliquei/priorizei.");
  }
}

// Junta os campos textuais de um conteudo estruturado para rodar governance.
// Junta TUDO que vai ser impresso na peça, para a governança de marca inspecionar.
//
// Ponto cego que isto corrige: antes o carrossel entregava só `title` e `body` de cada slide.
// Só que o número da peça quase nunca mora ali — ele mora no `stats` (o layout stat_grid, que é
// justamente o dos números: "95%", "R$ 1,99", "0%"), nos `items` da lista e nos `flow` das
// etapas. O próprio schema do prompt pede `"stats": [{ "value": "95%" }]`. Resultado: um número
// errado passava pela checagem de geração, passava pelo bloqueio do salvamento (o que devolve
// 422) e chegava no PNG sem nunca ter sido olhado. A checagem tem que ver o que é RENDERIZADO.
function textForGovernance(contentTypeId, parsed) {
  if (!parsed) return "";
  const parts = [];
  const push = (v) => { if (typeof v === "string" && v.trim()) parts.push(v); };
  const lista = (v) => { if (Array.isArray(v)) v.forEach((x) => push(typeof x === "string" ? x : "")); };

  if (typeof parsed.body === "string") {
    push(parsed.body);
    if (Array.isArray(parsed.hashtags)) push(parsed.hashtags.join(" "));
    push(parsed.cta);
    return parts.join("\n");
  }
  for (const k of ["headline", "subtext", "concept", "hook", "caption", "cta", "eyebrow", "badge", "notes"]) push(parsed[k]);
  if (Array.isArray(parsed.slides)) {
    parsed.slides.forEach((s) => {
      if (!s) return;
      push(s.title); push(s.body); push(s.note); push(s.eyebrow); push(s.watermark);
      lista(s.items);
      if (Array.isArray(s.stats)) s.stats.forEach((e) => { if (e) { push(e.value); push(e.label); } });
      if (Array.isArray(s.flow)) s.flow.forEach((e) => { if (e) { push(e.label); push(e.sub); } });
    });
  }
  if (Array.isArray(parsed.scenes)) parsed.scenes.forEach((s) => { if (s) { push(s.text); push(s.subtitle); } });
  if (Array.isArray(parsed.hashtags)) push(parsed.hashtags.join(" "));
  return parts.join("\n");
}

// Mesma ideia para UM slide (usado ao regerar um slide isolado): tudo que aparece nele.
function textForGovernanceSlide(slide) {
  return textForGovernance("instagram_carousel", { slides: [slide || {}] });
}

// Formata o conteudo final que sera gravado no arquivo da task.
function formatContentFile(ct, parsed, raw) {
  if (!parsed) return raw || "";
  if (ct.format === "json") return JSON.stringify(parsed, null, 2) + "\n";
  // texto: body + hashtags
  let out = parsed.body || raw || "";
  if (Array.isArray(parsed.hashtags) && parsed.hashtags.length) {
    out = out.trim() + "\n\n" + parsed.hashtags.join(" ");
  }
  return out.trim() + "\n";
}

// POST /api/generate — gera (NAO salva). Retorna parsed + governance.
router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    if (!body.brief || String(body.brief).trim().length < 8) {
      return res.status(400).json({ error: "brief/tema obrigatorio (min 8 caracteres)" });
    }
    let campaign = null;
    if (body.campaign_id) {
      campaign = campaigns.get(body.campaign_id);
    }

    // Fatos de mercado: só entram os que a PESSOA aceitou na tela, e são revalidados aqui pelo
    // mesmo funil de segurança da busca. Sem esta revalidação o campo seria uma porta para injetar
    // texto arbitrário dentro do prompt de geração.
    //
    // Antes disto a pesquisa rodava DENTRO desta rota, sozinha, e enfiava 12 achados no prompt sem
    // ninguém olhar — medido, 2 deles eram o FAQ público de 4selet.com.br dizendo que a taxa é
    // "7,9% + R$ 2,00", contra o 0% por 3 meses e R$ 1,99 da campanha. A peça podia sair publicando
    // o preço errado da própria empresa, e passava no gate, porque 7,9% é legítimo como taxa DE
    // MERCADO. Agora nada chega aqui sem clique.
    const fatos = researchLib.validaAceitos(body.research_accepted);
    const research = fatos.length ? { fatos } : null;

    const req2 = Object.assign({}, body, { campaign, research });
    const system = prompts.systemPrompt();
    const userPrompt = prompts.generationPrompt(req2);

    const result = await ai.complete({
      system,
      prompt: userPrompt,
      maxTokens: 2500,
      provider: body.provider, // IA escolhida na hora de gerar (default = padrao das Config.)
      simulate: () => prompts.simulate(req2),
    });

    const parsed = extractJson(result.text);
    // Orientacao de CTA do brief avancado: respeita a escolha do usuario (vale p/ real e simulado).
    // Sem orientacao -> campo cta vazio (sem chamada forcada). Com orientacao -> forca o texto escolhido.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parsed.cta = body.cta ? String(body.cta) : "";
      // Imagem do acervo (estilo "Foto"): injeta no conceito p/ o template Foto compor.
      if (body.image) parsed.image = String(body.image);
    }
    const fotosInventadas = limpaFotosInventadas(parsed);
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || result.text, { type: body.content_type });
    avisaFotosInventadas(gov, fotosInventadas);

    res.json({
      simulated: result.simulated,
      model: result.model,
      provider: result.provider,
      parsed,
      raw: result.text,
      governance: gov,
      content_type: body.content_type,
      // research_sources era uma lista de 12 títulos crus (com nome de concorrente dentro, porque a
      // máscara nunca foi aplicada a eles). Agora são os fatos que a pessoa aceitou, e só.
      research_facts: fatos,
    });
  } catch (e) { next(e); }
});

// POST /api/generate/research — procura FATOS DE MERCADO para a pessoa aceitar ou recusar.
// Passo próprio, disparado por botão: a pesquisa saiu de dentro da geração porque (a) o Hugo pediu
// que o achado chegasse como sugestão que ele aceita, e (b) ela custava 4 a 5 segundos no caminho
// crítico de TODA geração com o antigo checkbox ligado.
router.post("/research", async (req, res, next) => {
  try {
    const body = req.body || {};
    const r = await researchLib.buscaFatos({ pillar: body.pillar, alternativa: !!body.alternativa });
    if (!r.available) {
      const motivo = r.reason === "no_key"
        ? "Sem chave da Tavily configurada. Peça a um administrador para colar a chave em Configurações."
        : r.reason === "no_sdk"
          ? "A biblioteca de pesquisa não está instalada no servidor."
          : "Não consegui pesquisar agora. Tente de novo em alguns instantes.";
      return res.json({ disponivel: false, motivo });
    }
    // `_rejeitados` é diagnóstico interno de calibragem — nunca sai para a tela.
    res.json({
      disponivel: true,
      cartoes: r.cartoes,
      descartados: r.descartados,
      examinados: r.examinados,
      creditos: r.creditos,
      do_cache: !!r.doCache,
      alternativa: !!r.alternativa,
    });
  } catch (e) { next(e); }
});

// POST /api/generate/refine — ajusta uma peca existente conforme orientacao do
// usuario (mantendo o resto). NAO salva — retorna parsed + governance.
router.post("/refine", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    if (!body.instruction || String(body.instruction).trim().length < 3) {
      return res.status(400).json({ error: "orientacao de ajuste obrigatoria (min 3 caracteres)" });
    }
    if (body.current == null || String(body.current).trim() === "") {
      return res.status(400).json({ error: "conteudo atual ausente para ajustar" });
    }
    const campaign = body.campaign_id ? campaigns.get(body.campaign_id) : null;
    const req2 = Object.assign({}, body, { campaign });
    const system = prompts.systemPrompt();
    const userPrompt = prompts.refinementPrompt(req2);

    const result = await ai.complete({
      system,
      prompt: userPrompt,
      maxTokens: 2500,
      provider: body.provider, // IA escolhida na hora de ajustar
      images: Array.isArray(body.images) ? body.images : undefined, // referencia visual (visao)
      simulate: () => String(body.current), // sem chave: ecoa o atual (sinalizado como SIMULADO)
    });

    const parsed = extractJson(result.text);
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || result.text, { type: body.content_type });

    res.json({
      simulated: result.simulated,
      model: result.model,
      provider: result.provider,
      parsed,
      raw: result.text,
      governance: gov,
      content_type: body.content_type,
    });
  } catch (e) { next(e); }
});

// POST /api/generate/preview — previa RENDERIZADA da arte a partir do conceito em
// memoria (parsed), sem salvar nem exigir task. So vale para tipos visuais (image).
router.post("/preview", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    const out = await render.renderPreview({
      content_type: body.content_type,
      parsed: body.parsed || extractJson(body.raw),
      template: body.template,
      logo: body.logo,
      watermark: body.watermark,
      font: body.font, // tipografia da peça: a prévia sai na MESMA família da arte final
      only: body.only, // renderiza só o slide desse índice (progresso "slide N de M" no carrossel)
      media: body.media, // metadados da "4Selet na Mídia" (print/modelo/veículo) p/ a prévia do mockup
    });
    if (!out.ok) return res.status(422).json(out);
    res.json(out);
  } catch (e) { next(e); }
});

// POST /api/generate/interpret — LÊ o tema escrito em linguagem natural e diz o que já está
// dito ali: formato, assunto (pilar) e chamada. NÃO gera conteúdo e NÃO salva nada.
//
// Três decisões que valem registro:
// 1) Só estes três campos. Todo o resto do texto (tom, o que destacar, clima) já vai LITERAL
//    para o modelo na hora de gerar — extrair e reinjetar no mesmo prompt não muda a saída.
//    Estes três são os únicos que trocam caminho de código: o formato troca schema e renderer,
//    o pilar injeta o ângulo temático, e a chamada inverte uma diretiva dura.
// 2) `key_offer` está deliberadamente FORA. É o único campo que vira número carimbado na arte
//    e era o vetor de invenção da versão anterior deste recurso.
// 3) Sem chave de IA não há interpretação. A versão anterior tinha um adivinhador por padrões
//    de texto que lia o "x" de "1080 x 1350" como a rede X e virava "Calcular minha economia"
//    sempre que a palavra "economia" aparecia. Chutar é pior do que não responder.
// A pessoa nomeou uma família tipográfica no texto? Casa pelo NOME da família (lista fechada de
// render.FAMILIAS), sem acento e sem depender de espaço ("DM Serif", "dmserif", "Bebas Neue").
// Devolve também o trecho que sustenta, para a tela poder mostrar de onde tirou.
function familiaPedidaNoTexto(texto) {
  const t = String(texto || "");
  const chato = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const alvo = chato(t);
  for (const id of render.FAMILIA_IDS) {
    const nome = render.FAMILIAS[id].label;
    const agulha = chato(nome);
    const at = alvo.indexOf(agulha);
    if (at < 0) continue;
    // Trecho legível: procura o nome no texto original, tolerando espaço/acento entre as letras.
    const re = new RegExp(nome.split(/\s+/).map((w) => w.split("").join("\\s*")).join("\\s+"), "i");
    const m = re.exec(t);
    return { id, nome, trecho: (m ? m[0] : nome).slice(0, 120) };
  }
  return null;
}
router.post("/interpret", async (req, res, next) => {
  try {
    const texto = String((req.body && req.body.texto) || "").trim();
    if (texto.length < 12) return res.status(400).json({ error: "Escreva um pouco mais para eu conseguir entender a peça.", code: "E_TEXTO_CURTO" });
    if (texto.length > BRIEF_MAX_CHARS) {
      // Diz o tamanho REAL e o limite: "muito longo" sozinho não ajuda a decidir o que cortar.
      return res.status(413).json({
        error: "Seu texto tem " + texto.length.toLocaleString("pt-BR") + " caracteres e eu leio até "
          + BRIEF_MAX_CHARS.toLocaleString("pt-BR") + ". Encurte o texto ou preencha os campos à mão.",
        code: "E_TEXTO_LONGO", tamanho: texto.length, limite: BRIEF_MAX_CHARS,
      });
    }
    if (!ai.hasKey || !ai.hasKey()) {
      return res.json({ disponivel: false, motivo: "Sem chave de IA configurada — não dá para interpretar o texto. Preencha os campos manualmente.", campos: {} });
    }

    const result = await ai.complete({
      system: prompts.interpretSystem(),
      prompt: prompts.interpretPrompt({ texto }),
      maxTokens: 700,
      provider: (req.body && req.body.provider),
      simulate: () => "{}",
    });
    // Truncagem NÃO pode virar "não entendi nada": sem esta guarda o modelo para no meio,
    // extractJson devolve null e a rota respondia 200 com campos vazios — igualzinho a um texto
    // que realmente não dizia nada. Quem lê a tela não tem como distinguir os dois casos.
    if (result.stop_reason === "max_tokens") {
      return res.status(422).json({ error: "Não consegui terminar a leitura do seu texto desta vez. Tente de novo ou preencha os campos à mão.", code: "E_LEITURA_TRUNCADA" });
    }
    const cru = extractJson(result.text);
    if (!cru) {
      return res.status(422).json({ error: "Não consegui entender a resposta da leitura desta vez. Tente de novo ou preencha os campos à mão.", code: "E_LEITURA_INVALIDA" });
    }

    // Só entra o que existe nas taxonomias reais. O modelo não cria valor novo aqui.
    const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    // A comparação era por igualdade EXATA, e por isso perdia o caso mais comum: a pessoa escreve
    // "Conheça a plataforma" e a lista oficial diz "Conhecer a plataforma" — mesma chamada, verbo
    // em outra forma, resultado descartado em silêncio. Comparar pelo radical das palavras com 3+
    // letras resolve conjugação e acento sem aproximar chamadas diferentes entre si (conferido
    // contra a lista inteira: nenhuma colide com outra).
    const radical = (s) => norm(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3).map((w) => w.slice(0, 4)).sort().join("|");
    const ctaOk = (APPROVED_CTAS.find((c) => norm(c) === norm(cru.cta))
      || (norm(cru.cta) ? APPROVED_CTAS.find((c) => radical(c) && radical(c) === radical(cru.cta)) : null)
      || "");
    const tipoOk = contentTypeById(cru.content_type) ? String(cru.content_type) : "";
    const pilarOk = pillarById(cru.pillar) ? String(cru.pillar) : "";
    const conf = (k) => (["alta", "media", "baixa"].indexOf(String((cru.confianca || {})[k])) >= 0 ? String(cru.confianca[k]) : "media");

    const campos = {};
    if (tipoOk) campos.content_type = { valor: tipoOk, confianca: conf("content_type"), porque: String((cru.porque || {}).content_type || "").slice(0, 200) };
    if (pilarOk) campos.pillar = { valor: pilarOk, confianca: conf("pillar"), porque: String((cru.porque || {}).pillar || "").slice(0, 200) };
    if (ctaOk) campos.cta = { valor: ctaOk, confianca: conf("cta"), porque: String((cru.porque || {}).cta || "").slice(0, 200) };
    else if (cru.cta_ausente === true) campos.cta = { valor: "", sem_cta: true, confianca: conf("cta"), porque: String((cru.porque || {}).cta || "").slice(0, 200) };

    // `faltou` só pode citar os campos que a leitura realmente tenta preencher. Era texto livre do
    // modelo impresso cru na tela: numa execução real ele devolveu ["cta","numero_destaque",
    // "headline","dado_ou_percentual_de_aprovacao"], e quem lesse a tela veria nomes de variável.
    // O que ele nomear fora desses três não é campo — é observação, e não cabe nesse aviso.
    // Tipografia pedida no próprio texto. Detectada AQUI, por nome, sem passar pelo modelo: a lista
    // é fechada e os nomes são literais, então casar a string é exato e de graça — e continua
    // funcionando quando a leitura por IA falha. A tela usa isso para abrir o aviso de "família fora
    // da identidade" antes de aplicar; nada é trocado sozinho.
    const familia = familiaPedidaNoTexto(texto);
    if (familia) campos.font = { valor: familia.id, confianca: "alta", porque: familia.trecho, fora_da_identidade: true };

    const CAMPOS_LIDOS = ["content_type", "pillar", "cta"];
    const faltou = (Array.isArray(cru.faltou) ? cru.faltou : [])
      .map((x) => String(x).trim())
      .filter((x) => CAMPOS_LIDOS.indexOf(x) >= 0 && !campos[x])
      .filter((x, i, a) => a.indexOf(x) === i);
    res.json({ disponivel: true, simulated: !!result.simulated, model: result.model, provider: result.provider, campos, faltou });
  } catch (e) { next(e); }
});

// POST /api/generate/assistant — assistente de ajuda/uso da ferramenta.
router.post("/assistant", async (req, res, next) => {
  try {
    const question = (req.body && req.body.question) || "";
    if (!question.trim()) return res.status(400).json({ error: "pergunta obrigatoria" });
    const ctx = req.body.context ? "\n\nContexto da tela atual: " + req.body.context : "";
    const result = await ai.complete({
      system: prompts.assistantSystem(),
      prompt: question + ctx,
      maxTokens: 1200,
      provider: (req.body && req.body.provider),
      simulate: () => "Assistente em modo SIMULADO — configure a chave Anthropic em Configuracoes para respostas reais.\n\nFluxo do painel: 1) crie/abra uma Campanha; 2) em 'Criar Conteudo', escolha o tipo, preencha o brief e gere com IA; 3) revise o preview e aprove.",
    });
    res.json({ simulated: result.simulated, model: result.model, provider: result.provider, answer: result.text });
  } catch (e) { next(e); }
});

// POST /api/generate/save — cria/garante a task, liga a campanha e grava o arquivo.
router.post("/save", async (req, res, next) => {
  try {
    const body = req.body || {};
    const v = validateContentRequest(body);
    if (!v.ok) return res.status(400).json({ error: "validacao falhou", errors: v.errors });
    const ct = v.contentType;
    const parsed = body.parsed || extractJson(body.raw);
    if (!parsed && !body.raw) return res.status(400).json({ error: "nenhum conteudo para salvar" });
    // Foto do acervo (estilo "Foto"/Pexels): PERSISTE no conteudo salvo p/ o RE-render respeitar
    // (o generate injeta em parsed.image so p/ o render inicial; sem isto, "Gerar arte final" perdia a foto).
    if (body.image && parsed) parsed.image = String(body.image);

    // Foto que não existe não vai para o disco. Vale também aqui, e não só na geração: o JSON
    // avançado é editável, e uma peça gerada antes deste conserto pode trazer o caminho fantasma.
    const fotosInventadasSave = limpaFotosInventadas(parsed);

    // Gate de governanca: bloqueia erros duros antes de gravar
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || body.raw, { type: body.content_type });
    avisaFotosInventadas(gov, fotosInventadasSave);
    if (gov.errors.length && !body.force) {
      return res.status(422).json({ error: "conteudo viola regras de marca", governance: gov });
    }

    // 0) já existe peça com esse identificador + data? Antes o save seguia em frente e
    // SOBRESCREVIA o conteúdo, o título, o template e o pilar da peça antiga sem avisar — dava
    // para perder trabalho em rascunho só porque o slug bateu (o /import já barrava isso).
    // Quem realmente quer regravar por cima manda `overwrite: true`.
    const folderAlvo = body.task_name + "_" + body.task_date;
    if (!body.overwrite && content.findTask(folderAlvo)) {
      return res.status(409).json({
        error: "Já existe uma peça com esse identificador nesta data. Mude o identificador ou a data para não substituir a peça que já está salva.",
        code: "E_EXISTS",
        folder: folderAlvo,
      });
    }

    // 1) garante a task (orchestrator.js — idempotente)
    const angle = body.campaign_id ? (campaigns.get(body.campaign_id) || {}).angle : (body.angle || null);
    const create = await content.createTask({
      task_name: body.task_name,
      task_date: body.task_date,
      platforms: body.platforms || (ct.platform ? [ct.platform] : ["instagram"]),
      angle,
    });
    if (!create.ok) return res.status(400).json({ error: "falha ao criar task", detail: create.stderr || create.stdout });

    const folder = body.task_name + "_" + body.task_date;

    // 2) liga a campanha (bidirecional)
    if (body.campaign_id) {
      campaigns.linkContent(body.campaign_id, folder);
      content.setCampaignId(folder, body.campaign_id);
    }

    // 2b) grava o titulo de exibicao humanizado (separado do slug tecnico)
    if (body.title) content.setTitle(folder, body.title);

    // 2c) #8 — semente da variante visual escolhida no brief (default da arte;
    // ignora "auto"/vazio para deixar a rotacao automatica por slug atuar).
    if (body.template_variant) content.setTemplate(folder, body.template_variant);
    // 2c.2) variante de LOGO + estilo de MARCA D'ÁGUA escolhidos no brief (render.json, merge).
    // A foto entra aqui junto: no FEED ela não cabe no arquivo de conteúdo (é .txt), então o
    // render.json é o único lugar onde ela sobrevive ao salvamento.
    if (body.logo || body.watermark || body.image || body.font) content.setRenderPref(folder, { logo: body.logo, watermark: body.watermark, image: body.image, font: body.font });

    // 2d) grava o pilar de conteudo (eixo tematico) escolhido no brief.
    // Validado na taxonomia fechada; pilar invalido/ausente e ignorado.
    if (body.pillar) content.setPillar(folder, body.pillar);

    // 2e) metadados da peça "4Selet na Mídia" (print + veículo + link + modelo do device).
    if (body.content_type === "media_mention") {
      content.setMediaMeta(folder, { print: body.media_print, url: body.media_url, vehicle: body.media_vehicle, headline: body.media_headline, model: body.media_model, sizes: body.media_sizes });
    }

    // 3) grava o arquivo de conteudo
    const text = formatContentFile(ct, parsed, body.raw);
    let rel;
    try {
      rel = content.writeContentFile(folder, ct.file, text, body.brief); // note p/ o historico (desfazer)
    } catch (e) {
      return res.status(e.code === "E_NOT_EDITABLE" ? 409 : 500).json({ error: e.message, code: e.code });
    }

    res.json({ ok: true, folder, file: rel, governance: gov, task: content.getTask(folder) });
  } catch (e) { next(e); }
});

// POST /api/generate/slide — regera UM slide do carrossel (mantendo os outros) e re-renderiza só ele.
router.post("/slide", async (req, res, next) => {
  try {
    const body = req.body || {};
    const folder = String(body.folder || "");
    const loc = content.findTask(folder);
    if (!loc) return res.status(404).json({ error: "peça não encontrada" });
    if (loc.zone !== "active") return res.status(409).json({ error: "Reabra a peça para edição antes de regerar um slide.", code: "E_NOT_EDITABLE" });
    let carousel;
    try { carousel = JSON.parse(fs.readFileSync(path.join(loc.path, "copy", "instagram_carousel.json"), "utf8").replace(/^﻿/, "")); }
    catch (e) { return res.status(400).json({ error: "esta peça não tem um carrossel para regerar" }); }
    const slides = Array.isArray(carousel.slides) ? carousel.slides : [];
    const index = parseInt(body.index, 10);
    if (!(index >= 0 && index < slides.length)) return res.status(400).json({ error: "índice de slide inválido" });

    const st = (content.getTask(folder) || {}).status || {};
    const campaign = st.campaign_id ? campaigns.get(st.campaign_id) : (body.campaign_id ? campaigns.get(body.campaign_id) : null);
    const req2 = { content_type: "instagram_carousel", carousel, index, instruction: body.instruction, campaign, pillar: st.pillar || body.pillar };

    const result = await ai.complete({
      system: prompts.systemPrompt(),
      prompt: prompts.singleSlidePrompt(req2),
      maxTokens: 900,
      provider: body.provider,
      simulate: () => JSON.stringify(slides[index]), // sem chave: mantém o slide atual (sinalizado)
    });
    const newSlide = extractJson(result.text);
    if (!newSlide || typeof newSlide !== "object" || Array.isArray(newSlide)) return res.status(422).json({ error: "a IA não retornou um slide válido" });
    // preserva a foto de fundo do slide se a IA não devolver uma
    if (!newSlide.image && slides[index] && slides[index].image) newSlide.image = slides[index].image;

    // governança sobre o texto do slide novo
    const gov = runBrandGovernance(textForGovernanceSlide(newSlide), { type: "instagram_carousel" });
    if (gov.errors.length && !body.force) return res.status(422).json({ error: "o slide viola regras de marca", governance: gov });

    paletteWarn(gov, body.instruction); // alerta de marca se pediram cor fora da paleta (branco puro/neon)
    // MERGE conservador só quando HÁ instrução pontual (campos omitidos sobrevivem do slide antigo = "não refaz a arte").
    // Sem instrução = versão nova livre → usa o slide novo direto (evita ressuscitar arrays órfãos de um layout antigo).
    const hasInstr = !!(body.instruction && String(body.instruction).trim());
    const merged = hasInstr ? Object.assign({}, slides[index], newSlide) : newSlide;
    carousel.slides[index] = merged;
    try { content.writeContentFile(folder, "copy/instagram_carousel.json", JSON.stringify(carousel, null, 2) + "\n", "regerar slide " + (index + 1)); }
    catch (e) { return res.status(e.code === "E_NOT_EDITABLE" ? 409 : 500).json({ error: e.message, code: e.code }); }

    let rr = { ok: false, stderr: "" };
    try { rr = await render.renderCarouselSlide(folder, index + 1); }
    catch (e) { rr = { ok: false, stderr: e.message }; }

    res.json({ ok: true, simulated: result.simulated, index, slide: merged, rendered: rr.ok, rel: rr.rel, render_error: rr.ok ? undefined : (rr.stderr || "").slice(0, 200), governance: gov });
  } catch (e) { next(e); }
});

// POST /api/generate/slide-mem — regera UM slide de um carrossel AINDA EM MEMÓRIA (na criação,
// antes de salvar). Irmão do /slide, mas SEM disco: recebe o carrossel inteiro no body e devolve só
// o slide novo (o front funde e re-renderiza). Reusa singleSlidePrompt/systemPrompt/governança —
// idêntico ao /slide, sem findTask/writeContentFile/renderCarouselSlide (que exigem pasta no disco).
router.post("/slide-mem", async (req, res, next) => {
  try {
    const body = req.body || {};
    const carousel = body.carousel;
    if (!carousel || typeof carousel !== "object" || !Array.isArray(carousel.slides)) return res.status(400).json({ error: "carrossel inválido" });
    const slides = carousel.slides;
    const index = parseInt(body.index, 10);
    if (!(index >= 0 && index < slides.length)) return res.status(400).json({ error: "índice de slide inválido" });

    // Em memória não há status.json — campanha/pilar vêm do body (senão o prompt perde a coerência de marca).
    const campaign = body.campaign_id ? campaigns.get(body.campaign_id) : null;
    const req2 = { content_type: "instagram_carousel", carousel, index, instruction: body.instruction, campaign, pillar: body.pillar };

    const result = await ai.complete({
      system: prompts.systemPrompt(),
      prompt: prompts.singleSlidePrompt(req2),
      maxTokens: 900,
      provider: body.provider,
      simulate: () => JSON.stringify(slides[index]), // sem chave: mantém o slide atual (sinalizado)
    });
    const newSlide = extractJson(result.text);
    if (!newSlide || typeof newSlide !== "object" || Array.isArray(newSlide)) return res.status(422).json({ error: "a IA não retornou um slide válido" });
    // preserva a foto de fundo do slide se a IA não devolver uma
    if (!newSlide.image && slides[index] && slides[index].image) newSlide.image = slides[index].image;

    const gov = runBrandGovernance(textForGovernanceSlide(newSlide), { type: "instagram_carousel" });
    if (gov.errors.length && !body.force) return res.status(422).json({ error: "o slide viola regras de marca", governance: gov });
    paletteWarn(gov, body.instruction);
    // MERGE só com instrução pontual (preserva omitidos); sem instrução = versão nova direta.
    const hasInstr = !!(body.instruction && String(body.instruction).trim());
    const merged = hasInstr ? Object.assign({}, slides[index], newSlide) : newSlide;
    res.json({ ok: true, simulated: result.simulated, index, slide: merged, governance: gov });
  } catch (e) { next(e); }
});

module.exports = router;
