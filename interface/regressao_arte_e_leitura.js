// Bateria de regressão da arte e da leitura de briefing (rodada de 05-06/08/2026).
// Roda de dentro de interface/:  node regressao_arte_e_leitura.js
// Usa as rotas e o render REAIS, com chamadas de IA de verdade. Cria peças temporárias em
// outputs/ e apaga todas ao terminar.
// BATERIA COMPLETA de tudo que foi corrigido nesta rodada. Sem mock: rotas reais, render real.
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const render = require("./lib/render.js");
const { runBrandGovernance } = require("./lib/validation.js");
const prompts = require("./lib/prompts.js");
const { BRIEF_MAX_CHARS } = require("./lib/config.js");

const app = express();
app.use(express.json({ limit: "16mb" }));
app.use("/api/generate", require("./routes/generate"));
app.use("/api/content", require("./routes/content"));
const srv = http.createServer(app);
const post = (c, b) => new Promise((ok, err) => {
  const d = JSON.stringify(b || {});
  const r = http.request({ host: "127.0.0.1", port: srv.address().port, path: c, method: "POST",
    headers: { "content-type": "application/json", "content-length": Buffer.byteLength(d) } }, (res) => {
    let s = ""; res.on("data", (x) => (s += x)); res.on("end", () => { try { ok({ status: res.statusCode, body: JSON.parse(s || "{}") }); } catch (e) { ok({ status: res.statusCode, body: s }); } });
  });
  r.on("error", err); r.write(d); r.end();
});
const RAIZ = path.join(__dirname, "..", "outputs");
const DATA = "2026-08-06";
const criadas = [];
let falhas = 0, total = 0;
const checa = (ok, oq, extra) => { total++; if (!ok) falhas++; console.log("    " + (ok ? "ok     " : "FALHOU ") + oq + (extra ? "   " + extra : "")); };
const secao = (t) => console.log("\n" + t + "\n" + "-".repeat(t.length));
const peca = (nome, arquivos) => {
  const d = path.join(RAIZ, nome); criadas.push(d);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "status.json"), JSON.stringify({ task_name: nome, status: "draft" }));
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    fs.mkdirSync(path.join(d, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo, null, 1));
  }
  return d;
};
const un = () => Date.now().toString(36) + Math.floor(Math.random() * 9999);
// Briefing longo de referência: reproduz o caso real que motivou a rodada (8 mil caracteres,
// conteúdo slide a slide, paleta própria, termos de busca de foto e a chamada no fim do texto).
function briefingLongo() {
  const bloco = [
    "Crie um carrossel para Instagram com 5 slides, formato vertical 1080 x 1350 px, apresentando como",
    "produtores digitais podem centralizar vendas, pagamentos e gestao de clientes numa unica plataforma.",
    "Identidade visual: fundo principal #0D1317, grafite #182127 e #202B32, destaque #55B7D4, complementar",
    "#2E8EAE, textos #F5F7F8 e #A8B7C0, verde #34C98F apenas para indicadores positivos.",
    "Tipografia semelhante a Inter, Manrope ou Montserrat, com titulos fortes e faceis de ler.",
    "Slide 1: Sua operacao digital esta espalhada em varias ferramentas? Buscar foto de pessoa trabalhando.",
    "Slide 2: Quanto mais ferramentas, mais dificil fica controlar a operacao. Tres cards com icones.",
    "Slide 3: Centralize sua operacao com a 4Selet. Captura real da plataforma num mockup de notebook.",
    "Slide 4: Mais controle para voce. Mais organizacao para o seu negocio. Tres beneficios em cards.",
    "Slide 5: Sua operacao nao precisa ser complicada.",
  ].join(" ");
  let t = bloco;
  while (t.length < 7800) t += " " + bloco;
  // a chamada fica no FIM de proposito: era o trecho que o teto antigo de 4000 apagava
  return t.slice(0, 7900) + "\n\nCTA visual: criar um botao com o texto: Conheca a plataforma.";
}

(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const BRIEFING = briefingLongo();

  secao("1. Leitura do briefing longo");
  const r1 = await post("/api/generate/interpret", { texto: BRIEFING });
  checa(r1.status === 200, "briefing de " + BRIEFING.length + " caracteres é lido");
  checa(((r1.body.campos || {}).cta || {}).valor === "Conhecer a plataforma", "a chamada do fim do texto chega inteira");
  checa(prompts.interpretPrompt({ texto: BRIEFING }).indexOf(BRIEFING.trimEnd().slice(-60)) >= 0, "o texto INTEIRO chega ao modelo (sem corte escondido)");
  const r1b = await post("/api/generate/interpret", { texto: "asdkjh qweqwe zxczxc mnbmnb" });
  checa(Object.keys(r1b.body.campos || {}).length === 0, "texto sem nexo não inventa campo");
  checa((r1b.body.faltou || []).every((f) => ["content_type", "pillar", "cta"].includes(f)), "o aviso do que faltou só cita campo real");
  const r1c = await post("/api/generate/interpret", { texto: BRIEFING.repeat(5) });
  checa(r1c.status === 413 && r1c.body.code === "E_TEXTO_LONGO", "acima de " + BRIEF_MAX_CHARS + " recusa com código próprio");

  secao("2. O texto vence o pilar, e a contagem de slides");
  const g2 = await post("/api/generate", { content_type: "instagram_carousel", brief: BRIEFING, pillar: "prova_plataforma", cta: "Conhecer a plataforma", platforms: ["instagram"] });
  const p2 = g2.body.parsed || {};
  const semNotas = JSON.stringify(Object.assign({}, p2, { notes: undefined }));
  checa((p2.slides || []).length === 5, "5 slides, como o texto pediu", "(" + (p2.slides || []).length + ")");
  checa(!/sabe que [ée] selet/i.test(semNotas), "sem a frase-tag proibida");
  checa(!/#[0-9A-F]{6}/i.test(semNotas), "sem código de cor no conteúdo");
  checa(((g2.body.governance || {}).errors || []).length === 0, "governança sem erro duro");

  secao("3. Foto inventada pelo modelo");
  checa(render.imagemExiste("/uploads/acervo_livros_leitura.jpg"), "foto real: reconhecida");
  checa(!render.imagemExiste("/uploads/inventada-xyz.jpg"), "foto inventada: recusada");
  checa(!render.imagemExiste("/uploads/../../.env"), "caminho de escape: recusado");
  const T3 = "reg" + un();
  const s3 = await post("/api/generate/save", { task_name: T3, task_date: DATA, content_type: "instagram_carousel",
    brief: "Carrossel com foto de fundo nos slides.", platforms: ["instagram"], raw: "",
    parsed: { eyebrow: "G", cta: "", hashtags: ["#4Selet"], slides: [
      { title: "Capa", body: "b", layout: "cover" },
      { title: "Fantasma", body: "b", layout: "text", image: "/uploads/nao-existe-1.jpg" },
      { title: "Real", body: "b", layout: "text", image: "/uploads/acervo_livros_leitura.jpg" }] } });
  criadas.push(path.join(RAIZ, T3 + "_" + DATA));
  const disco3 = JSON.parse(fs.readFileSync(path.join(RAIZ, T3 + "_" + DATA, "copy", "instagram_carousel.json"), "utf8"));
  checa(disco3.slides.filter((s) => s.image).length === 1, "só a foto real foi para o disco");
  checa(((s3.body.governance || {}).warnings || []).some((w) => /foto/i.test(w)), "o pedido não atendido virou aviso");

  secao("4. Editor: o <input> que apagava quebra de linha");
  const app_ = fs.readFileSync(path.join(__dirname, "public", "js", "app.js"), "utf8");
  checa((app_.match(/\$\{esc1\(/g) || []).length === 8, "os 8 campos do editor normalizam a quebra");
  checa(!/<textarea[^>]*>\$\{esc1\(/.test(app_), "nenhum campo de texto longo foi tocado");
  const esc1 = (v) => String(v || "").replace(/[ \t]*[\r\n]+[ \t]*/g, " ");
  checa(esc1("Uma plataforma. ==Toda a sua\noperação.==") === "Uma plataforma. ==Toda a sua operação.==", "quebra vira espaço, sem colar");

  secao("5. Rotação do estilo da arte");
  const nomes = ["regA_margem_" + un(), "regB_prazo_" + un(), "regC_convite_" + un()].map((n) => n + "_" + DATA);
  for (const n of nomes) { peca(n, { "ads/concept.json": { headline: "Margem real", subtext: "Quatro números.", cta: "Ver como funciona" } }); await render.render(n, "image", {}); }
  const tpls = nomes.map((n) => JSON.parse(fs.readFileSync(path.join(RAIZ, n, "render.json"), "utf8")).template);
  checa(new Set(tpls).size >= 2, "peças diferentes recebem estilos diferentes", "(" + tpls.join(", ") + ")");
  await render.render(nomes[0], "image", {});
  checa(JSON.parse(fs.readFileSync(path.join(RAIZ, nomes[0], "render.json"), "utf8")).template === tpls[0], "re-renderizar não muda a cara");

  secao("6. Foto na capa do carrossel e na peça de feed");
  const T6 = "regcapa" + un() + "_" + DATA;
  peca(T6, { "render.json": { template: "split" }, "copy/instagram_carousel.json": { eyebrow: "G", cta: "", hashtags: ["#4Selet"], slides: [
    { title: "Capa com foto", body: "b", layout: "cover", image: "/uploads/acervo_livros_leitura.jpg" }, { title: "b", body: "b", layout: "text" }] } });
  await render.render(T6, "carousel", {});
  checa(/class="photo"/.test(fs.readFileSync(path.join(RAIZ, T6, "slides", "slide_1.html"), "utf8")), "foto na capa aparece mesmo com estilo Dividido");
  const T6b = "regfeed" + un();
  await post("/api/generate/save", { task_name: T6b, task_date: DATA, content_type: "instagram_caption", brief: "Post de feed sobre prazo de recebimento.",
    parsed: { body: "O que quebra um produtor raramente é a taxa. É o prazo.\n\nVender bem e receber tarde trava a operação.", hashtags: ["#4Selet"], cta: "" }, raw: "", platforms: ["instagram"], image: "/uploads/acervo_livros_leitura.jpg" });
  criadas.push(path.join(RAIZ, T6b + "_" + DATA));
  await post("/api/content/" + T6b + "_" + DATA + "/render", {});
  const hFeed = fs.readFileSync(path.join(RAIZ, T6b + "_" + DATA, "ads", "feed.html"), "utf8");
  checa(hFeed.indexOf("acervo_livros_leitura") >= 0, "foto do feed sobrevive ao salvamento");
  checa(/juro|prazo|receber tarde/i.test(hFeed.replace(/<[^>]+>/g, " ")), "e o texto de apoio aparece na arte");
  checa(!/par…|quebr…/.test(hFeed), "sem corte no meio da palavra");

  secao("7. Governança de números");
  const casos = [["Recebimento: cartão, PIX em D+10 e D+30.", false], ["A média do mercado libera o PIX em D+30. A 4Selet em D+10.", false],
    ["95% de aprovação no cartão e PIX em D+10.", false], ["Na 4Selet o cartão cai em D+45.", true], ["Taxa Zero por 6 meses.", true]];
  casos.forEach(([txt, esperaErro]) => {
    const e = runBrandGovernance(txt, { type: "instagram_caption" }).errors;
    checa((e.length > 0) === esperaErro, (esperaErro ? "barra: " : "deixa passar: ") + '"' + txt.slice(0, 44) + '"');
  });

  secao("8. Margem segura e layouts de slide");
  const { chromium } = require(path.join(__dirname, "..", "node_modules", "playwright"));
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  const LAY = [
    ["fluxo cheio", { title: "Onde a ==margem== escapa", layout: "flow", body: "Cada etapa é uma chance.", note: "Confira o custo real.", flow: [
      { label: "VENDA APROVADA NO CHECKOUT", sub: "o cliente conclui e o pedido entra na fila", icon: "cart" },
      { label: "ROTEAMENTO DE ADQUIRÊNCIA", sub: "se a primeira recusa, a segunda entra", icon: "shield" },
      { label: "PRAZO DE RECEBIMENTO", sub: "PIX em D+10 e cartão em D+30", icon: "clock" },
      { label: "VALOR LÍQUIDO NA CONTA", sub: "o que sobra depois de taxa", icon: "wallet", mark: true }] }],
    ["fluxo SEM etapas", { title: "T", body: "Corpo que precisa aparecer.", layout: "flow" }],
    ["números", { title: "Os ==quatro==", layout: "stat_grid", stats: [{ value: "95%", label: "aprovação" }, { value: "D+10", label: "PIX" }, { value: "D+30", label: "cartão" }, { value: "R$ 1,99", label: "transação" }] }],
    ["lista", { title: "O que ==muda==", layout: "list", items: ["Checkout otimizado com PIX e cartão", "Área de membros integrada à venda", "Gestão de alunos centralizada", "Coprodução com comissão automática"] }],
    ["fecho", { title: "Não precisa ser ==complicada==", layout: "cta", body: "Conheça a plataforma." }],
  ];
  for (const [nome, slide] of LAY) {
    const built = render.carouselSlidesHtml({ eyebrow: "GESTÃO", slides: [{ title: "c", body: "b", layout: "text" }, slide], cta: "Conhecer a plataforma" }, () => "<html></html>", {});
    await pg.setContent(built[1].html, { waitUntil: "domcontentloaded" });
    await pg.waitForTimeout(110);
    const m = await pg.evaluate(() => {
      const c = document.querySelector(".card").getBoundingClientRect();
      let est = 0, esq = 9999;
      document.querySelectorAll(".node,.stat,.li,.s-body,.s-title,.flow-note,.fnote,.pill,.eyebrow").forEach((el) => {
        const r = el.getBoundingClientRect();
        est = Math.max(est, Math.round(r.bottom - c.bottom), Math.round(r.right - c.right));
        esq = Math.min(esq, Math.round(r.left - c.left));
      });
      return { est, esq, temFlow: !!document.querySelector(".flow .node") };
    });
    checa(m.est <= 0, nome + ": cabe no cartão", m.est > 0 ? "estoura " + m.est + "px" : "margem " + m.esq + "px");
    if (nome === "fluxo SEM etapas") checa(!m.temFlow, "  e vira texto em vez de buraco");
  }
  secao("9. Peça de Imagem com dado estruturado (arquétipos)");
  // Até aqui, a peça de Imagem só usava os 4 templates de sempre — texto solto sobre o fundo, 7,3%
  // da arte com tinta. Quando o conteúdo É número, etapa ou enumeração, ela passa a usar os desenhos
  // que só o carrossel alcançava (grade 30% · fluxo 33% · lista). O gatilho é o DADO, não uma
  // preferência: sem números/itens/etapas nada muda, e peça já desenhada não troca de cara sozinha.
  const pg2 = await b.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const BASE_ARQ = { eyebrow: "GESTÃO FINANCEIRA", headline: "A margem real da sua ==operação==",
    subtext: "Quatro números definem quanto você ganha por venda.", cta: "Conhecer a plataforma" };
  const pecaArq = (extra, base) => {
    const n = "regarq" + Math.random().toString(36).slice(2, 8) + "_" + DATA;
    peca(n, { "ads/concept.json": Object.assign({}, BASE_ARQ, base || {}, extra) });
    return n;
  };
  const mede = async (n) => {
    await pg2.goto("file:///" + path.join(RAIZ, n, "ads", "ad.html").split(path.sep).join("/"), { waitUntil: "load" });
    await pg2.waitForTimeout(90);
    return pg2.evaluate(() => {
      const c = document.querySelector(".card").getBoundingClientRect();
      let est = 0, menor = 9999;
      document.querySelectorAll(".stat,.li,.node,.s-title,.s-body,.ac-cta,.flow-note,.eyebrow,.headline,.subtext,.cta").forEach((el) => {
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
        est = Math.max(est, Math.round(r.bottom - c.bottom), Math.round(r.right - c.right));
        menor = Math.min(menor, Math.round(c.bottom - r.bottom), Math.round(r.top - c.top));
      });
      return { est, menor, cta: (document.querySelector(".ac-cta, .cta") || {}).textContent || "" };
    });
  };
  const NUMS = [{ value: "95%", label: "aprovação no cartão" }, { value: "D+10", label: "PIX na conta" },
    { value: "D+30", label: "cartão na conta" }, { value: "R$ 1,99", label: "por transação" }];
  const ETAPAS = [{ label: "VENDA", sub: "checkout aprovado", icon: "cart" }, { label: "GATEWAY", sub: "multi-adquirência", icon: "shield" },
    { label: "PRAZO", sub: "PIX em D+10", icon: "clock" }, { label: "LÍQUIDO", sub: "margem real", icon: "wallet", mark: true }];
  const ITENS = ["Checkout otimizado com PIX e cartão", "Área de membros integrada", "Gestão de alunos centralizada", "Coprodução automática"];
  const ROTEIA = [
    ["sem dado continua nos templates de sempre", {}, null],
    ["números viram grade", { stats: NUMS }, "stat_grid"],
    ["etapas viram fluxo", { flow: ETAPAS }, "flow"],
    ["itens viram lista", { items: ITENS }, "list"],
  ];
  for (const [oq, extra, esperado] of ROTEIA) {
    const n = pecaArq(extra);
    const r = await render.render(n, "image", {});
    if (esperado) checa(r.template === esperado, oq, r.template);
    else checa(["editorial", "bold", "split", "photo"].indexOf(r.template) >= 0, oq, r.template);
    const m = await mede(n);
    // A régua é a margem segura da marca (88-104px): conteúdo dentro do cartão mas em cima do
    // padding é justamente o que o Instagram corta na borda.
    checa(m.est <= 0 && m.menor >= 88, "  respeita a margem segura (>=88px)", m.est > 0 ? "estoura " + m.est + "px" : "margem " + m.menor + "px");
    checa(/Conhecer a plataforma/.test(m.cta), "  a chamada continua na arte");
  }
  // Pior caso de conteúdo: estes desenhos nasceram para o slide 1080x1350 SEM rótulo e SEM chamada.
  // Como peça única perdem 270px de altura e ganham dois blocos — sem a compactação, 6 itens longos
  // estouravam 278px e 4 números de rótulo longo deixavam 28px de margem.
  const PIOR_ARQ = [
    ["4 números de rótulo longo", { stats: [{ value: "95%", label: "de aprovação no cartão de crédito" }, { value: "D+10", label: "para o PIX cair na sua conta" },
      { value: "D+30", label: "para o cartão cair na sua conta" }, { value: "R$ 1,99", label: "fixo por transação aprovada" }] }],
    ["6 itens longos", { items: ["Checkout otimizado com PIX, cartão e boleto", "Área de membros imersiva e integrada", "Gestão de alunos centralizada num só lugar",
      "Coprodução automática sem planilha", "Gestor de conta dedicado desde o primeiro dia", "Redundância inteligente entre adquirentes"] }],
    ["4 etapas longas com apoio", { flow: [{ label: "VENDA APROVADA", sub: "checkout com PIX, cartão e boleto", icon: "cart" },
      { label: "GATEWAY 4SELET", sub: "multi-adquirência com redundância", icon: "shield" },
      { label: "PRAZO DE REPASSE", sub: "PIX em D+10 e cartão em D+30", icon: "clock" },
      { label: "MARGEM LÍQUIDA", sub: "o que sobra de verdade por venda", icon: "wallet", mark: true }] }],
  ];
  for (const [oq, extra] of PIOR_ARQ) {
    const n = pecaArq(extra, { subtext: "Quatro números definem quanto você realmente ganha em cada venda da sua operação.", cta: "Conhecer a plataforma 4Selet" });
    const r = await render.render(n, "image", {});
    const m = await mede(n);
    checa(m.est <= 0 && m.menor >= 88, "pior caso: " + oq + " (" + r.template + ")", m.est > 0 ? "estoura " + m.est + "px" : "margem " + m.menor + "px");
  }
  // A cara da peça não pode mudar sozinha — mesma invariante do pickTemplate.
  {
    const n = pecaArq({ stats: NUMS.slice(0, 2) });
    const a = await render.render(n, "image", {});
    const bb = await render.render(n, "image", {});
    checa(a.template === "stat_grid" && bb.template === "stat_grid", "re-renderizar mantém a grade", a.template + " -> " + bb.template);
  }
  {
    const n = pecaArq({});
    const a = await render.render(n, "image", {});
    const cp = path.join(RAIZ, n, "ads", "concept.json");
    fs.writeFileSync(cp, JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(cp, "utf8")), { stats: NUMS }), null, 1));
    const bb = await render.render(n, "image", {});
    checa(a.template === bb.template, "acrescentar números depois NÃO troca a cara da peça", a.template + " -> " + bb.template);
  }
  {
    const n = pecaArq({ stats: NUMS });
    await render.render(n, "image", {});
    const a = await render.render(n, "image", { template: "bold" });
    const bb = await render.render(n, "image", {});
    checa(a.template === "bold" && bb.template === "bold", "escolher estilo à mão vence o dado e fica", a.template + " -> " + bb.template);
  }
  await b.close();

  secao("10. Tipografia fora da identidade (por peça)");
  // A identidade é Inter + JetBrains Mono e continua sendo o padrão: nada muda sem alguém pedir.
  // Quando pede, a arte sai na família escolhida, a escolha fica gravada na peça, e a peça seguinte
  // NÃO herda nada. A lista é fechada porque o id vira URL do Google Fonts e vira CSS.
  const pecaFonte = (nome, extra) => {
    const n = nome + Math.random().toString(36).slice(2, 7) + "_" + DATA;
    peca(n, { "ads/concept.json": Object.assign({ eyebrow: "TESTE", headline: "A margem ==real==", subtext: "Apoio.", cta: "Conhecer a plataforma" }, extra || {}) });
    return n;
  };
  const htmlDa = (n, rel) => fs.readFileSync(path.join(RAIZ, n, rel), "utf8");
  {
    const n = pecaFonte("regfonte_padrao");
    await render.render(n, "image", {});
    const h = htmlDa(n, "ads/ad.html");
    checa(/Inter/.test(h) && !/Playfair|Bebas|Montserrat/.test(h), "sem pedir nada, a peça continua na Inter");
  }
  {
    const n = pecaFonte("regfonte_pedida");
    await render.render(n, "image", { font: "playfair" });
    const h = htmlDa(n, "ads/ad.html");
    checa(/Playfair\+Display/.test(h), "carrega a família pedida do Google Fonts");
    checa(/font-family:'Playfair Display',serif !important/.test(h), "aplica a família no cartão");
    checa(/\.eyebrow[^}]*JetBrains Mono[^}]*!important/.test(h), "rótulos seguem em JetBrains Mono");
    checa(JSON.parse(fs.readFileSync(path.join(RAIZ, n, "render.json"), "utf8")).font === "playfair", "a escolha fica gravada na peça");
    await render.render(n, "image", {});
    checa(/Playfair/.test(htmlDa(n, "ads/ad.html")), "re-renderizar mantém a família escolhida");
    await render.render(n, "image", { font: "auto" });
    checa(!/Playfair/.test(htmlDa(n, "ads/ad.html")), "'auto' devolve a identidade da marca");
    checa(!("font" in JSON.parse(fs.readFileSync(path.join(RAIZ, n, "render.json"), "utf8"))), "e apaga a preferência da peça");
  }
  {
    const a = pecaFonte("regfonte_a"); await render.render(a, "image", { font: "bebas" });
    const b4 = pecaFonte("regfonte_b"); await render.render(b4, "image", {});
    checa(!/Bebas/.test(htmlDa(b4, "ads/ad.html")), "a peça seguinte NÃO herda a família da anterior");
  }
  {
    const n = pecaFonte("regfonte_injecao");
    await render.render(n, "image", { font: "Comic Sans; } body { display:none" });
    checa(!/Comic Sans|display:none/.test(htmlDa(n, "ads/ad.html")), "família fora da lista é ignorada (sem injeção de CSS)");
  }
  {
    // Carrossel inteiro na mesma família — inclusive quando um slide é regerado sozinho depois.
    const n = "regfonte_carrossel" + Math.random().toString(36).slice(2, 7) + "_" + DATA;
    peca(n, { "copy/instagram_carousel.json": { eyebrow: "TESTE", cta: "Conhecer a plataforma",
      slides: [{ title: "Capa", layout: "cover" }, { title: "Meio", body: "corpo", layout: "text" }, { title: "Fecho", layout: "cta" }] } });
    await render.render(n, "carousel", { font: "montserrat" });
    checa([1, 2, 3].every((i) => /Montserrat/.test(htmlDa(n, "slides/slide_" + i + ".html"))), "todos os slides saem na mesma família");
    await render.renderCarouselSlide(n, 2);
    checa(/Montserrat/.test(htmlDa(n, "slides/slide_2.html")), "regerar um slide sozinho não o deixa fora do conjunto");
  }
  {
    // A prévia da tela de criação tem que sair na MESMA família da arte final.
    const p1 = await render.renderPreview({ content_type: "ad_creative", template: "editorial",
      parsed: { eyebrow: "T", headline: "A margem ==real==", subtext: "Apoio.", cta: "Conhecer a plataforma" } });
    const p2 = await render.renderPreview({ content_type: "ad_creative", template: "editorial", font: "bebas",
      parsed: { eyebrow: "T", headline: "A margem ==real==", subtext: "Apoio.", cta: "Conhecer a plataforma" } });
    checa(p1.ok && p2.ok && p1.dataUrl !== p2.dataUrl, "a prévia respeita a família escolhida (não mostra uma e salva outra)");
  }

  secao("11. Cor por campanha (fora da identidade)");
  // A cor é da CAMPANHA, não da peça: campanha sazonal ("uma de fim de ano, vermelhona") sai da
  // paleta oficial sem que isso vire a cara da marca o ano todo, e todas as peças dela saem
  // coerentes entre si. O padrão é e continua sendo a identidade.
  {
    const campanhas = require("./lib/campaigns.js");
    const { PALETTE, PALETAS_CAMPANHA } = require("./lib/config.js");
    const cor = PALETAS_CAMPANHA.vermelho.cores;
    const cCor = campanhas.create({ name: "Regressão cor " + Math.random().toString(36).slice(2, 7), palette: "vermelho" });
    const cSem = campanhas.create({ name: "Regressão sem cor " + Math.random().toString(36).slice(2, 7), palette: "" });
    checa(cCor.palette === "vermelho", "a campanha guarda a cor escolhida");
    const pecaCamp = (nome, campId) => {
      const n = nome + Math.random().toString(36).slice(2, 7) + "_" + DATA;
      peca(n, { "ads/concept.json": { eyebrow: "FIM DE ANO", headline: "Feche o ano no ==azul==", subtext: "Apoio.", cta: "Conhecer a plataforma" } });
      if (campId) {
        const sp = path.join(RAIZ, n, "status.json");
        fs.writeFileSync(sp, JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(sp, "utf8")), { campaign_id: campId }), null, 2));
      }
      return n;
    };
    const a = pecaCamp("regcor_com", cCor.id); await render.render(a, "image", {});
    const ha = fs.readFileSync(path.join(RAIZ, a, "ads", "ad.html"), "utf8");
    checa(ha.indexOf(cor.blue) >= 0, "a arte usa o acento da campanha", cor.blue);
    checa(ha.indexOf(PALETTE.blue) < 0, "e não sobra nenhum azul da marca na arte");
    checa(ha.indexOf(PALETTE.mist) >= 0, "os neutros ficam (senão o texto perde contraste)");
    const b5 = pecaCamp("regcor_sem", cSem.id); await render.render(b5, "image", {});
    checa(fs.readFileSync(path.join(RAIZ, b5, "ads", "ad.html"), "utf8").indexOf(PALETTE.blue) >= 0, "campanha sem cor escolhida sai na identidade");
    const c5 = pecaCamp("regcor_solta", null); await render.render(c5, "image", {});
    checa(fs.readFileSync(path.join(RAIZ, c5, "ads", "ad.html"), "utf8").indexOf(PALETTE.blue) >= 0, "peça sem campanha nenhuma sai na identidade");
    campanhas.update(cSem.id, { palette: "#fff; } body { display:none" });
    checa(campanhas.get(cSem.id).palette === "", "cor fora da lista volta para a identidade (sem injeção)");
    campanhas.remove(cCor.id); campanhas.remove(cSem.id);
  }

  // 12. Captura de site: o porteiro do endereço --------------------------------
  // Esta é a peça de MAIOR superfície do painel: o servidor abre uma URL que a pessoa digitou.
  // Cada linha aqui é um ataque conhecido que precisa continuar barrado depois de qualquer mexida.
  {
    secao("12. Captura de site (porteiro do endereço)");
    const guard = require("./lib/urlguard");
    const bloqueia = [
      ["http://169.254.169.254/latest/meta-data/", "metadados da nuvem"],
      ["http://127.0.0.1:4500/api/content", "a própria máquina por porta interna"],
      ["http://localhost/", "localhost pelo nome"],
      ["https://10.0.0.5/", "rede privada 10/8"],
      ["http://192.168.1.1/", "rede privada 192.168/16"],
      ["http://172.16.0.1/", "rede privada 172.16/12"],
      ["https://[::1]/", "loopback IPv6"],
      ["http://0177.0.0.1/", "loopback disfarçado de octal"],
      ["http://2130706433/", "loopback disfarçado de decimal"],
      ["ftp://arquivo.com/x", "protocolo fora de http/https"],
      ["file:///etc/passwd", "arquivo local"],
      ["https://user:senha@site.com/", "credencial embutida na URL"],
      ["https://site.com:22/", "porta de serviço interno"],
      ["https://metadata.google.internal/", "metadados do Google pelo nome"],
      ["https://intranet.local/", "nome de rede interna"],
    ];
    for (const [url, oq] of bloqueia) {
      const r = await guard.verifica(url);
      checa(!r.ok, "barra " + oq, r.ok ? "PASSOU INDEVIDAMENTE" : "");
    }
    const publico = await guard.verifica("4selet.com.br");
    checa(publico.ok && !!publico.ip, "deixa passar site público e devolve o IP para fixar", publico.ip || "");
    // O filtro de sub-recursos roda DENTRO do navegador: a página pode pedir de CDN, mas não de IP interno.
    checa(guard.pedidoPermitido("https://cdn.algum-site.com/a.css"), "sub-recurso de CDN passa (senão a página sai quebrada)");
    checa(!guard.pedidoPermitido("http://169.254.169.254/x.png"), "sub-recurso apontando para metadados é barrado");
    checa(!guard.pedidoPermitido("http://127.0.0.1/x.png"), "sub-recurso apontando para a própria máquina é barrado");
  }

  // 13. Pendência de imagem: o pedido que não deu ------------------------------
  // O slide 3 delirava e ninguém era avisado. O contrato agora é: faltou imagem -> a rota DECLARA
  // o que faltou, em qual slide, e se é print ou foto. A tela transforma isso em pergunta.
  {
    secao("13. Pendência de imagem (o que faltou vira pergunta)");
    const gen = require("./routes/generate");
    const pend = gen.__testes && gen.__testes.pendenciasDeImagem;
    checa(typeof pend === "function", "a rota expõe a montagem de pendências para teste");
    if (typeof pend === "function") {
      const p1 = pend("instagram_carousel", [{ slide: 3, caminho: "/uploads/print-dashboard-4selet.jpg" }], []);
      checa(p1.length === 1 && p1[0].slide === 3, "caminho inventado vira pendência no slide certo");
      checa(p1[0].tipo === "print", "nome de arquivo com 'print/dashboard' é classificado como captura de tela");
      checa(/dashboard/i.test(p1[0].pedido), "o pedido guarda o que o caminho dizia", p1[0].pedido);

      const p2 = pend("instagram_carousel", [{ slide: 2, caminho: "/uploads/escritorio-moderno.jpg" }], []);
      checa(p2[0].tipo === "foto", "nome sem cara de tela é classificado como foto ilustrativa");

      const p3 = pend("instagram_carousel", [], [{ slide: 4, pedido: "print da tela de checkout", motivo: "não tenho acesso" }]);
      checa(p3.length === 1 && p3[0].origem === "limitacao", "limitação declarada pelo modelo também vira pendência");

      const p4 = pend("instagram_carousel", [], [{ slide: 1, pedido: "encurtar o título para 3 palavras" }]);
      checa(p4.length === 0, "limitação que NÃO é sobre imagem não vira pendência de imagem");

      const p5 = pend("instagram_carousel", [{ slide: 3, caminho: "/uploads/print-x.jpg" }], [{ slide: 3, pedido: "print x" }]);
      checa(p5.length === 1, "a mesma falta vinda pelas duas portas não vira duas perguntas");

      const p6 = pend("media_mention", [], []);
      checa(p6.length === 1 && p6[0].slide === 0, "peça de Mídia sem print pergunta pelo print (o print É a peça)");

      const p7 = pend("instagram_caption", [], []);
      checa(p7.length === 0, "peça de texto sem imagem nenhuma não inventa pergunta");
    }
  }

  // ------------------------------------------------------------------
  secao("14. Nomes que bloqueador de anúncio esconde");
  // O Hugo viu a seção "Ajustes" vazia no computador dele e cheia aqui no servidor. A causa não era
  // versão nem tela: a classe se chamava `.adv-block` e a EasyList (uBlock, AdBlock, AdGuard, Brave
  // e navegadores com bloqueio nativo) tem a regra GLOBAL `##.adv-block`, que aplica display:none
  // em qualquer site. Num painel de MARKETING esses nomes brotam sozinhos — então isto vira teste.
  {
    const front = ["public/js/app.js", "public/js/api.js", "public/css/styles.css", "public/index.html"]
      .map((f) => path.join(__dirname, f)).filter((f) => fs.existsSync(f))
      .map((f) => fs.readFileSync(f, "utf8")).join("\n");

    // Amostra das regras globais reais da EasyList que um painel tem chance de encostar.
    const NOMES_CACADOS = ["adv-block", "adv-block-container", "side-adv-block", "ad-block", "adBlock",
      "advert", "advertisement", "ad-banner", "adbanner", "ad-container", "ad-wrapper", "ad-box",
      "banner-ad", "sponsored", "promo-banner", "popupad"];
    const encontrados = NOMES_CACADOS.filter((n) => new RegExp('(class="[^"]*\\b' + n + '\\b|\\.' + n + '\\s*[{,:>])').test(front));
    checa(encontrados.length === 0, "nenhuma classe do painel bate com regra global de bloqueador",
      encontrados.length ? "ACHADO: " + encontrados.join(", ") : "0 colisões");

    // E o bloco de Ajustes, especificamente, continua com nome neutro e presente nos dois arquivos.
    checa(/class="mais-opcoes"/.test(front), "o bloco de Criação avançada usa o nome neutro (.mais-opcoes)");
    // Procura USO (atributo class ou seletor), não menção: o comentário que explica a armadilha
    // cita `.adv-block` de propósito, e apagar essa explicação é justamente o que faz o erro voltar.
    const usoDoNomeVelho = /class="[^"]*\badv-block\b|\.adv-block\s*[{,:>]/.test(front);
    checa(!usoDoNomeVelho, "o nome antigo adv-block não é mais usado (só citado no comentário que explica)");
  }

  // ------------------------------------------------------------------
  secao("16. Seletor de um x seletor de muitos");
  // Aplicando um patch pelo shell, o escapamento comeu um cifrão e `$$("...")` virou `$("...")` em
  // DUAS linhas — a minha nova e uma que já existia há meses, a que liga aprovar/publicar/reabrir.
  // `$` devolve UM elemento; chamar `.forEach` nele estoura e derruba a montagem da página inteira.
  // O Hugo viu "Erro ao carregar: $(...).forEach is not a function" na peça importada.
  {
    const front = ["public/js/app.js", "public/js/api.js"]
      .map((f) => path.join(__dirname, f)).filter((f) => fs.existsSync(f));
    const erradas = [];
    for (const arq of front) {
      fs.readFileSync(arq, "utf8").split("\n").forEach((linha, i) => {
        // $ (um elemento) seguido de método de LISTA
        if (/(^|[^$])\$\([^)]*\)\.(forEach|map|filter|some|every)\b/.test(linha)) {
          erradas.push(path.basename(arq) + ":" + (i + 1));
        }
        // $$ (lista) seguido de propriedade de UM elemento
        if (/\$\$\([^)]*\)\.(value|textContent|innerHTML|onclick|checked|disabled)\b/.test(linha)) {
          erradas.push(path.basename(arq) + ":" + (i + 1) + " (lista usada como elemento)");
        }
      });
    }
    checa(erradas.length === 0, "nenhum seletor de UM elemento sendo usado como lista (nem o contrário)",
      erradas.length ? erradas.slice(0, 4).join(", ") : "0 em " + front.length + " arquivos");
  }

  // ------------------------------------------------------------------
  secao("15. Comentário de CSS não pode engolir regra");
  // Escrevendo o comentário que explica o item 14, digitei "adv-*/ad-*" — e a dupla asterisco-barra
  // FECHOU o comentário no meio da frase. O resto virou lixo, e o interpretador engoliu a regra
  // `.mais-opcoes` inteira junto: o bloco ficou sem fundo e sem borda, e o defeito só aparecia ao
  // passar o mouse (a regra :hover sobreviveu). Nenhum teste pegou, porque o elemento continuava
  // na tela. Esta varredura pega a causa, não o sintoma.
  {
    const arquivosCss = ["public/css/styles.css"].map((f) => path.join(__dirname, f)).filter((f) => fs.existsSync(f));
    let sobrando = [];
    let abertoNoFim = false;
    for (const arq of arquivosCss) {
      const css = fs.readFileSync(arq, "utf8");
      let dentro = false, i = 0, linha = 1;
      while (i < css.length) {
        if (css[i] === "\n") linha++;
        if (!dentro && css[i] === "/" && css[i + 1] === "*") { dentro = true; i += 2; continue; }
        if (dentro && css[i] === "*" && css[i + 1] === "/") { dentro = false; i += 2; continue; }
        if (!dentro && css[i] === "*" && css[i + 1] === "/") { sobrando.push(path.basename(arq) + ":" + linha); i += 2; continue; }
        i++;
      }
      if (dentro) abertoNoFim = true;
    }
    checa(sobrando.length === 0, "nenhum fechamento de comentário sobrando (que fecharia o comentário cedo)",
      sobrando.length ? sobrando.join(", ") : "0");
    checa(!abertoNoFim, "nenhum comentário fica aberto no fim do arquivo");

    // E a prova direta: as regras de fundo dos blocos precisam existir FORA de comentário.
    const semComentarios = fs.readFileSync(path.join(__dirname, "public/css/styles.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    checa(/\.mais-opcoes\s*\{[^}]*background:/.test(semComentarios), "o bloco de Ajustes tem regra de fundo ativa");
    checa(/\.mais-opcoes\s*\{[^}]*border:/.test(semComentarios), "e tem regra de borda ativa");
  }

  criadas.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });
  srv.close();
  console.log("\n" + "=".repeat(64));
  console.log(falhas ? falhas + " FALHA(S) em " + total + " verificações" : "TODAS AS " + total + " VERIFICAÇÕES PASSARAM");
})().catch((e) => { console.error("ERRO:", e && e.stack); criadas.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }); srv.close(); process.exit(1); });
