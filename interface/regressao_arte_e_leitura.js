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
  // Esta verificação depende do que a IA ESCREVEU nesta execução, não do código: se o modelo
  // escrever algo que a governança barra, ela fica vermelha sem nada estar quebrado. Por isso
  // imprime QUAL regra acionou — vermelho mudo aqui manda procurar bug onde não há.
  const errsGov = ((g2.body.governance || {}).errors || []);
  checa(errsGov.length === 0, "governança sem erro duro",
    errsGov.length ? "a IA escreveu algo que a governança barra: " + errsGov.map((e) => (e && (e.rule || e.message)) || String(e)).join(" · ") : "");

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
  // Estas três provam a LIGAÇÃO (o sorteio chega no disco); a distribuição é medida logo abaixo.
  checa(tpls.every((t) => render.TEMPLATE_IDS.indexOf(t) >= 0), "cada peça recebeu um estilo válido", "(" + tpls.join(", ") + ")");
  // A DISTRIBUIÇÃO, num universo grande. Antes esta seção sorteava 3 nomes e exigia 3 estilos
  // diferentes — com 3 estilos, dá tudo igual em 1 de 9 execuções, e a bateria acusava falha
  // sem nada estar quebrado. O que importa medir é que nomes PARECIDOS se espalham: era esse o
  // defeito real do hash antigo (h*31+c dava 5-1-2 em vez de perto de 3-3-2).
  {
    const ROT = render.TEMPLATES_ROTACAO;
    const conta = {};
    const amostra = [];
    for (let i = 1; i <= 90; i++) amostra.push("campanha_taxa_zero_" + i + "_2026-08-18");
    amostra.forEach((n) => {
      const id = ROT[render.hashDoNome(n) % ROT.length];
      conta[id] = (conta[id] || 0) + 1;
    });
    const usados = Object.keys(conta);
    const minimo = Math.min.apply(null, ROT.map((r) => conta[r] || 0));
    checa(usados.length === ROT.length, "em 90 nomes PARECIDOS, os três estilos aparecem",
      ROT.map((r) => r + ":" + (conta[r] || 0)).join("  "));
    // 90/3 = 30 por estilo no ideal. Piso em 15 (metade) pega o desequilíbrio grosseiro que o
    // hash antigo tinha, sem quebrar por variação natural.
    checa(minimo >= 15, "e nenhum fica de escanteio", "o menos sorteado ficou com " + minimo);
  }
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
  secao("17. Uma arte é UMA arte, não um arquivo por extensão");
  // A arte importada chega em JPEG. Ao ser preparada para edição, o painel escreve o PNG
  // redesenhado AO LADO do JPEG original — e quem listava por extensão passava a ver a mesma
  // arte duas vezes: os 5 slides do carrossel do Hugo viraram 10 na tela. Pelo outro lado,
  // quem só olhava .png não achava arte NENHUMA na peça importada ("Esta peça não tem imagem
  // publicável"). São o mesmo defeito. Aqui a conta é feita com a lógica real do painel.
  {
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const pub = fs.readFileSync(path.join(__dirname, "lib/publish.js"), "utf8");

    // executa a função de verdade que a tela usa, extraída do arquivo
    // A função depende da tabela de prioridade das extensões, que virou uma constante
    // compartilhada da tela (ORDEM_ARTE). Extrair só a função deixava a bateria com um
    // ReferenceError na cara — o teste tem que trazer o que a função precisa para viver.
    const tabela = (app.match(/const ORDEM_ARTE = \{[^}]*\};/) || [""])[0];
    const corpo = (app.match(/function umaPorArte\(files\) \{[\s\S]*?\n\}/) || [""])[0];
    checa(!!tabela, "a tela declara a ordem de preferência das versões da arte (ORDEM_ARTE)");
    checa(!!corpo, "a tela tem a regra de uma arte por nome (umaPorArte)");
    const umaPorArte = new Function(tabela + "\n" + corpo + "; return umaPorArte;")();

    // o estado real de um carrossel importado JÁ preparado para edição
    const arquivos = [];
    for (let n = 1; n <= 5; n++) {
      arquivos.push({ rel: "slides/slide_" + n + ".jpg", isImage: true });
      arquivos.push({ rel: "slides/slide_" + n + ".orig.jpg", isImage: true });
      arquivos.push({ rel: "slides/slide_" + n + ".png", isImage: true });
      arquivos.push({ rel: "slides/slide_" + n + ".bg.png", isImage: true });
    }
    const unicas = umaPorArte(arquivos.filter((f) => /slide_0*\d+\.(png|jpe?g|webp)$/i.test(f.rel)));
    checa(unicas.length === 5, "5 slides importados e preparados continuam sendo 5 na tela", unicas.length + " arte(s)");
    checa(unicas.every((f) => /\.png$/i.test(f.rel)), "e a versão que fica é o PNG redesenhado (o que o editor edita)");
    checa(!unicas.some((f) => /\.orig\./i.test(f.rel)), "a cópia guardada do original não aparece como peça");

    // e antes de preparar (só JPEG) tem que haver arte para editar E para publicar
    const soJpeg = umaPorArte([1, 2, 3, 4, 5].map((n) => ({ rel: "slides/slide_" + n + ".jpg", isImage: true })));
    checa(soJpeg.length === 5, "carrossel importado ainda em JPEG tem 5 artes (não zero)", soJpeg.length + " arte(s)");

    // os três lugares que liam por extensão precisam aceitar JPEG
    checa(app.indexOf("story_0*\\d+\\.(png|jpe?g|webp)$") > -1, "o editor enxerga cartão de story em JPEG");
    checa(app.indexOf("slide_0*\\d+\\.(png|jpe?g|webp)$") > -1, "o editor e a galeria enxergam slide em JPEG");
    checa(app.indexOf('curRel.replace(/\\.[^./]+$/i, ".html")') > -1,
      "o editor troca a extensão seja ela qual for para achar a receita .html");

    // publicação: nunca mandar o mesmo slide duas vezes para o Instagram
    const corpoPub = (pub.match(/function umaPorSlide\(nomes\) \{[\s\S]*?\n\}/) || [""])[0];
    checa(!!corpoPub, "a publicação tem a regra de um arquivo por slide (umaPorSlide)");
    const umaPorSlide = new Function(corpoPub + "; return umaPorSlide;")();
    const publicaveis = umaPorSlide(["slide_1.jpg", "slide_1.png", "slide_2.jpg", "slide_2.png", "slide_3.png"]);
    checa(publicaveis.length === 3, "o carrossel vai ao Instagram sem slide repetido", publicaveis.join(", "));
    checa(publicaveis[0] === "slide_1.png", "e na ordem certa, com o PNG redesenhado", publicaveis[0]);
  }

  // ------------------------------------------------------------------
  secao("19. O que o motor desenha, a tela deixa escolher");
  // O balanço dos 241 pedidos mostrou que quase todo item "entregue pela metade" tinha a MESMA
  // causa: o motor aprendeu desenhos novos e a tela não. Eles só saíam quando a IA resolvia
  // usá-los; pedir à mão era impossível. Aqui as duas listas são comparadas de verdade.
  {
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const src = fs.readFileSync(path.join(__dirname, "lib/render.js"), "utf8");

    const blocoMotor = (src.match(/const SLIDE_ARCHETYPES = \{[\s\S]*?\n\};/) || [""])[0];
    const doMotor = Array.from(blocoMotor.matchAll(/(\w+):\s*slide/g)).map((m) => m[1]);
    const blocoTela = (app.match(/const SLIDE_LAYOUTS = \[[\s\S]*?\n\];/) || [""])[0];
    const daTela = Array.from(blocoTela.matchAll(/\["([a-z_]*)"/g)).map((m) => m[1]).filter(Boolean);

    checa(doMotor.length > 0 && daTela.length > 0, "achei as duas listas (motor e tela)",
      doMotor.length + " no motor, " + daTela.length + " na tela");
    // "cover" é a capa, tratada fora do mapa de arquétipos — some do motor mas existe na tela.
    const presos = doMotor.filter((x) => daTela.indexOf(x) === -1);
    checa(presos.length === 0, "nenhum desenho fica preso no motor sem aparecer na tela",
      presos.length ? "inalcançáveis: " + presos.join(", ") : doMotor.length + " desenhos, todos escolhíveis");
    const inventados = daTela.filter((x) => x !== "cover" && doMotor.indexOf(x) === -1);
    checa(inventados.length === 0, "e a tela não oferece desenho que o motor não sabe fazer",
      inventados.join(", ") || "0");

    // O AVISO de dado precisa concordar com a guarda do motor. Se divergirem, a tela promete um
    // desenho que o motor recusa — e a pessoa recebe um parágrafo sem entender por quê.
    const render = require("./lib/render.js");
    const front = new Function(
      (app.match(/const SEP_VERSUS_UI[\s\S]*?\nconst LAYOUT_DADO = \{[\s\S]*?\n\};/) || [""])[0]
      + "; return LAYOUT_DADO;")();
    const AMOSTRAS = [
      { nome: "palavra com word", slide: { word: "Selet" }, chave: "word", arq: "palavra" },
      { nome: "palavra sem word", slide: { title: "x" }, chave: "word", arq: null },
      { nome: "comparação de 2 lados", slide: { versus: { a: "4Selet", b: "Mercado" } }, chave: "versus", arq: "comparacao" },
      { nome: "3 partes NÃO é comparação", slide: { title: "Cadastro > Aprovação > Repasse" }, chave: "versus", arq: null },
      { nome: "citação com texto", slide: { citacao: { text: "Uma frase" } }, chave: "citacao", arq: "citacao" },
      { nome: "medidor com escala", slide: { gauge: { value: "95%" } }, chave: "gauge", arq: "medidor" },
      { nome: "medidor SEM escala", slide: { gauge: { value: "D+10" } }, chave: "gauge", arq: null },
      { nome: "mapa com 2 ramos", slide: { tree: { root: "PIX", branches: ["a", "b"] } }, chave: "tree", arq: "mapa" },
      { nome: "mapa com 1 ramo só", slide: { tree: { root: "PIX", branches: ["a"] } }, chave: "tree", arq: null },
      { nome: "conversa com falas", slide: { dialog: [{ de: "a", txt: "oi" }] }, chave: "dialog", arq: "dialogo" },
      { nome: "série 2 de 5", slide: { serie: { n: 2, de: 5 } }, chave: "serie", arq: "serie" },
    ];
    const divergiram = [];
    AMOSTRAS.forEach((a) => {
      const telaAcha = !!(front[a.chave] && front[a.chave].tem(a.slide));
      const motorAcha = render.arquetipoDoDado(a.slide) === a.arq && a.arq !== null;
      // quando a amostra NÃO tem o dado, o motor devolve outro arquétipo (ou nada): os dois
      // precisam concordar sobre a EXISTÊNCIA do dado, que é o que o aviso comunica.
      const esperado = a.arq !== null;
      if (telaAcha !== esperado || motorAcha !== esperado) {
        divergiram.push(a.nome + " (tela=" + telaAcha + ", motor=" + motorAcha + ", esperado=" + esperado + ")");
      }
    });
    checa(divergiram.length === 0, "o aviso da tela concorda com a guarda do motor em todos os casos",
      divergiram.slice(0, 3).join(" · ") || AMOSTRAS.length + " amostras conferidas");

    // O FUNDO é a outra metade da variedade. O Hugo cobrou exatamente isto: "quando pedi para
    // analisar as postagens do Instagram foi justamente para ter variações de FUNDO, não só o
    // posicionamento de cada texto". Mesma regra do layout: o que o motor sabe, a tela oferece.
    const fundosMotor = render.FUNDO_IDS;
    const blocoFundoUI = (app.match(/const FUNDOS_UI = \[[\s\S]*?\n\];/) || [""])[0];
    const fundosTela = Array.from(blocoFundoUI.matchAll(/\["([a-z]*)"/g)).map((m) => m[1] || "padrao");
    checa(fundosMotor.length >= 4, "o motor tem superfícies além do degradê de sempre", fundosMotor.join(", "));
    const presosF = fundosMotor.filter((f) => fundosTela.indexOf(f) === -1);
    checa(presosF.length === 0, "e todas aparecem no seletor de fundo da tela",
      presosF.length ? "inalcançáveis: " + presosF.join(", ") : fundosTela.join(", "));

    // Cada superfície precisa MESMO mudar o desenho — senão é só um nome no seletor.
    const base = render.fundoCss("padrao", null);
    const distintos = fundosMotor.filter((f) => f !== "padrao").filter((f) => {
      const css = render.fundoCss(f, null);
      return css && css.length > 40 && css !== base;
    });
    checa(distintos.length === fundosMotor.length - 1, "e cada uma muda de verdade a superfície",
      distintos.length + " de " + (fundosMotor.length - 1));
    // Papel é superfície CLARA: se o texto continuasse com as cores do fundo escuro, a arte
    // sairia ilegível — e ilegível de um jeito que a miniatura esconde.
    const cs = fs.readFileSync(path.join(__dirname, "lib/render.js"), "utf8");
    checa(/fundoDoSlide === "papel"[\s\S]{0,120}theme: "light"/.test(cs),
      "o fundo de papel força o tema claro (senão o texto some na folha)");

    // A CAPA com foto coerente com o assunto. O pedido do Hugo: "está sendo citado tecnologia,
    // procure uma imagem de circuito; está falando da plataforma 4Selet, apresente a imagem da
    // própria plataforma". As três peças existiam separadas e nunca tinham sido ligadas.
    const capa = require("./lib/capa_foto.js");
    const prompts = fs.readFileSync(path.join(__dirname, "lib/prompts.js"), "utf8");
    checa(/"capa_foto"/.test(prompts), "o prompt PEDE à IA o termo de busca da capa");
    checa(/propria[\s\S]{0,400}4SELET|4Selet[\s\S]{0,200}propria/i.test(prompts),
      "e ensina a NÃO usar foto de banco quando a capa pede a tela da 4Selet");
    const ger = fs.readFileSync(path.join(__dirname, "routes/generate.js"), "utf8");
    checa(/capaFoto\.buscarCapa/.test(ger), "e a geração REALMENTE vai buscar (o campo não fica morto)");

    checa(capa.pedidoDeCapa({ capa_foto: { busca: "circuit board", fonte: "banco" } }).fonte === "banco",
      "lê o pedido de foto da capa");
    checa(capa.pedidoDeCapa({ foto_busca: "server room" }).fonte === "banco",
      "e aceita o campo antigo, que estava morto no prompt desde sempre");
    checa(capa.pedidoDeCapa({ capa_foto: { fonte: "propria" } }).fonte === "propria",
      "reconhece quando a capa pede a própria plataforma");
    checa(capa.pedidoDeCapa({}).fonte === "nenhuma", "e não inventa foto quando ninguém pediu");
    // Retrato: a capa é 1080x1350; foto deitada, recortada, perde o assunto.
    const escolhida = capa.melhorFoto([{ full: "deitada", width: 1600, height: 900 }, { full: "retrato", width: 900, height: 1600 }]);
    checa(escolhida && escolhida.full === "retrato", "prefere foto em retrato para a capa", escolhida && escolhida.full);

    // NÚMERO QUE SOME. Pedido do Hugo: "caso no prompt informado tenha essa citação, é necessário
    // que na respectiva criação seja apresentado esse mesmo valor". A peça que fala do assunto
    // sem dizer o número ("prazo curto" no lugar de "D+10") some em silêncio.
    const num = require("./lib/numeros_do_brief.js");
    const briefNum = "PIX em D+10, cartão em D+30, 95% de aprovação e R$ 1,99 por transação";
    checa(num.numerosDoBrief(briefNum).length === 4, "acha os quatro números do pedido",
      num.numerosDoBrief(briefNum).map((x) => x.valor).join(", "));
    checa(num.numerosDoBrief("faça 6 slides sobre migração").length === 0,
      "e não confunde instrução (“6 slides”) com número da peça");
    const faltando = num.numerosQueSumiram(briefNum, { slides: [{ title: "Prazos curtos", body: "alta aprovação" }] });
    checa(faltando.length === 4, "acusa os números que não chegaram na arte", faltando.map((x) => x.valor).join(", "));
    checa(num.numerosQueSumiram(briefNum, {
      slides: [{ stats: [{ value: "95%", label: "aprovação" }] }, { flow: [{ label: "PIX", sub: "D+10" }, { label: "Cartão", sub: "D+30" }] }],
      caption: "R$ 1,99 por transação",
    }).length === 0, "e fica quieto quando todos aparecem (em qualquer campo)");
    const ger2 = fs.readFileSync(path.join(__dirname, "routes/generate.js"), "utf8");
    checa(/numerosDoBrief\.numerosQueSumiram/.test(ger2), "a geração REALMENTE confere isso");
    const prm = fs.readFileSync(path.join(__dirname, "lib/prompts.js"), "utf8");
    checa(/NUMERO QUE A PESSOA CITOU NO PEDIDO TEM QUE APARECER/.test(prm),
      "e o prompt manda usar o número, em vez de só avisar depois");
  }

  // ------------------------------------------------------------------
  secao("18. A porta do sistema squad (a ORDEM é o mecanismo)");
  // Neste painel não existe lista de rotas públicas: o que torna uma rota pública é ela ser
  // registrada ANTES do gate de sessão. Isso quer dizer que uma reordenação inocente do
  // server.js fecha a porta do squad sem erro nenhum — as entregas passam a tomar 401 e
  // ninguém descobre até alguém reclamar que a arte não chegou. Aqui a ordem é medida.
  {
    const srv = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
    const pos = (s) => srv.indexOf(s);

    const iParserSquad = pos('app.use("/api/squad/webhook"');
    const iParserGlobal = pos('app.use(express.json({ limit: "16mb" }))');
    const iRotaSquad = pos('app.use("/api/squad", require("./routes/squad_webhook"))');
    const iGate = pos('if (!user) return res.status(401)');
    const iAdmin = pos('app.use("/api/squad", require("./routes/squad"))');

    checa(iParserSquad > -1, "existe um leitor de corpo próprio para a porta do squad");
    checa(iParserSquad > -1 && iParserGlobal > -1 && iParserSquad < iParserGlobal,
      "e ele vem ANTES do leitor global (senão o limite de 16 MB vale e a entrega de 32 MB é recusada)",
      "próprio em " + iParserSquad + ", global em " + iParserGlobal);
    checa(iRotaSquad > -1 && iGate > -1 && iRotaSquad < iGate,
      "a rota que RECEBE está antes do gate de login (é o único jeito de ser pública aqui)");
    checa(iAdmin > -1 && iAdmin > iGate,
      "e a rota da TELA está depois do gate (essa exige login)");
    checa(srv.indexOf("CAMINHO_SQUAD.test(req.path)") > -1,
      "o anti-CSRF tem a exceção da porta do squad (servidor não manda Origin)");
    // A exceção precisa ser exatamente do caminho do webhook, não do prefixo /api/squad
    // inteiro: as rotas da TELA são mutações de verdade e continuam protegidas.
    checa(srv.indexOf('req.path.startsWith("/api/squad")') === -1,
      "e a exceção NÃO vale para o prefixo inteiro (a tela continua protegida contra CSRF)");
    // O porteiro do token casa por PREFIXO (é como o app.use funciona). Se a exceção do
    // anti-CSRF casasse de forma mais estreita, uma barra a mais no fim do endereço — o erro
    // mais provável de quem digita a URL à mão — passaria pelo token e morreria depois em
    // "origem inválida", sem virar linha na tela e sem conteúdo guardado.
    const mCam = srv.match(/const CAMINHO_SQUAD = (\/[^\n;]+\/i?);/);
    checa(!!mCam, "as duas checagens do caminho vêm da MESMA definição");
    if (mCam) {
      const re = eval(mCam[1]); // a própria expressão do server.js, não uma cópia
      checa(re.test("/api/squad/webhook") && re.test("/api/squad/webhook/") && re.test("/API/SQUAD/WEBHOOK"),
        "e ela aceita a barra no fim e a caixa diferente (o que o porteiro do token já aceita)");
      checa(!re.test("/api/squad/webhook/x") && !re.test("/api/squad") && !re.test("/api/squad/token"),
        "sem alargar para nada além da porta (a tela segue protegida)");
    }
    // O registro é a fonte da tela: lê-lo inteiro para mostrar poucas linhas travava o painel
    // para TODOS os usuários (medido: 13 s com 10 mil entregas).
    const libTxt = fs.readFileSync(path.join(__dirname, "lib/squad.js"), "utf8");
    const corpoListar = (libTxt.match(/function listar\(limite\) \{[\s\S]*?\n\}/) || [""])[0];
    const iCorte = corpoListar.indexOf("nomes.slice(0, limite)");
    const iLeitura = corpoListar.indexOf("lerJson(");
    checa(iCorte > -1 && iLeitura > -1 && iCorte < iLeitura,
      "o registro é CORTADO antes de ser lido (não abre 10 mil arquivos para mostrar 60)");
    checa(/MAX_REGISTROS/.test(libTxt), "e o registro tem teto de linhas (não cresce para sempre)");
    // O token é conferido antes de ler o corpo: um anônimo não faz o painel bufferizar 80 MB.
    checa(iParserSquad > -1 && srv.indexOf("squadLib.confere") > iParserSquad
      && srv.indexOf("squadLib.confere") < iParserGlobal,
      "o token é conferido ANTES de o corpo ser lido");

    const lib = fs.readFileSync(path.join(__dirname, "lib/squad.js"), "utf8");
    checa(/timingSafeEqual/.test(lib), "a conferência do token é em tempo constante");
    checa(/createHash\("sha256"\)[\s\S]{0,400}timingSafeEqual/.test(lib),
      "sobre hashes de tamanho fixo (timingSafeEqual explode com tamanhos diferentes)");
    checa(/mode:\s*0o600|0o600/.test(lib), "o arquivo do token é gravado só para o dono (0600)");
    // O log NÃO pode morar dentro da pasta da peça: hashDirectory varre a pasta inteira, e
    // arquivo a mais lá dentro derruba a publicação com E_HASH_MISMATCH.
    checa(/DIR_REQ\s*=\s*path\.join\(DATA_DIR/.test(lib),
      "o registro das entregas mora em interface/data, fora das pastas das peças");

    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const html = fs.readFileSync(path.join(__dirname, "public/index.html"), "utf8");
    checa(/requisicoes:\s*viewRequisicoes/.test(app),
      "a página Requisições está registrada no roteador (senão abre o Painel em silêncio)");
    checa(/data-route="requisicoes"/.test(html), "e tem item de menu apontando para ela");

    // Regra dura da casa: ícone é desenho, não emoji.
    const novos = ["lib/squad.js", "routes/squad.js", "routes/squad_webhook.js"]
      .map((f) => path.join(__dirname, f));
    const comEmoji = [];
    for (const arq of novos) {
      const txt = fs.readFileSync(arq, "utf8");
      // faixas de pictogramas/emoji (fora do BMP e símbolos comuns)
      if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(txt)) comEmoji.push(path.basename(arq));
    }
    checa(comEmoji.length === 0, "nenhum emoji nos arquivos novos", comEmoji.join(", ") || "0");

    // Classes de CSS que a tela nova usa precisam existir de verdade (o painel já teve um
    // badge "err" sem regra nenhuma, que simplesmente não pintava).
    const css = fs.readFileSync(path.join(__dirname, "public/css/styles.css"), "utf8");
    const faltando = [".sq-erro", ".sq-aviso", ".sq-facts", ".sq-selo", ".sq-avisos", ".tag-origem", ".conn-item", ".key-locked", ".list-row"]
      .filter((c) => css.indexOf(c) === -1);
    checa(faltando.length === 0, "as classes de estilo da tela nova existem no CSS", faltando.join(", ") || "todas");
    // Variável de cor que não existe pinta com a cor herdada, em silêncio — foi o que
    // aconteceu com o `var(--muted)` que escrevi de cabeça (o projeto usa --text-dim).
    // As declarações vêm de DUAS fontes: o CSS e o próprio JS, que injeta algumas por
    // cssText — considerar só o CSS acusaria variáveis legítimas.
    const declaradas = new Set(
      ((css + app).match(/--[a-z0-9-]+\s*:/g) || []).map((v) => v.replace(/\s*:$/, "").trim())
    );
    const usadasNoSquad = ((css.match(/\.(sq-[a-z-]+|tag-origem)[^{]*\{[^}]*\}/g) || []).join(" ")
      .match(/var\(--[a-z0-9-]+\)/g) || []).map((v) => v.slice(4, -1));
    const inventadas = Array.from(new Set(usadasNoSquad.filter((v) => !declaradas.has(v))));
    checa(inventadas.length === 0, "as cores da tela nova usam variáveis que existem de verdade",
      inventadas.join(", ") || usadasNoSquad.length + " variável(is), todas declaradas");

    // A arte que chega de fora: as duas leituras que, erradas, produzem arte quebrada APROVADA.
    const sq = require("./lib/squad.js");
    const comSelo = '<style>.selo{width:120px;height:120px}html,body{width:1080px;height:1350px}</style>';
    const d1 = sq.dimensoesDoHtml(comSelo);
    checa(d1.w === 1080 && d1.h === 1350,
      "o tamanho da arte vem da regra da PÁGINA, não do primeiro width que aparecer", d1.w + "x" + d1.h);
    const d2 = sq.dimensoesDoHtml('<style>.card{width:1080px;height:1920px}</style>');
    checa(d2.w === 1080 && d2.h === 1920, "e reconhece outro formato quando o HTML declara", d2.w + "x" + d2.h);
    const formas = [
      ['<img src="file:///tmp/a.png">', "file:// com aspas"],
      ["<img src=file:/tmp/a.png>", "file:/ sem aspas"],
      ['<link rel=stylesheet href="https://x.com/a.css">', "folha de estilo externa"],
      ["<style>.a{background:url(https://x.com/b.png)}</style>", "url() externa"],
    ];
    const cegas = formas.filter((f) => sq.refsExternas(f[0]).length === 0).map((f) => f[1]);
    checa(cegas.length === 0, "toda referência a coisa de fora é percebida (senão a arte sai com buraco)", cegas.join(", ") || "nenhuma escapou");
    checa(sq.refsExternas('<img src="data:image/png;base64,AAA">').length === 0,
      "e imagem embutida NÃO é confundida com referência externa");

    // Os avisos que o outro sistema pode mandar. A lista é FECHADA: aviso desconhecido tem de
    // ser recusado, nunca tratado como "arte pronta" (criaria peça a partir de outra coisa).
    const eventos = Object.keys(sq.EVENTOS);
    checa(eventos.indexOf("post.pronto") > -1 && eventos.indexOf("post.atualizado") > -1
      && eventos.indexOf("post.cancelado") > -1 && eventos.indexOf("teste") > -1,
      "os quatro avisos combinados com o time do squad existem", eventos.join(", "));
    const semEvento = sq.normalizar({ post_id: 1, evento: "teste" });
    checa(semEvento.evento === "teste", "o painel entende o aviso declarado");
    let recusou = false;
    try { sq.normalizar({ post_id: 1, evento: "inventado", cards: ["x"] }); }
    catch (e) { recusou = e.code === "E_EVENTO"; }
    checa(recusou, "e RECUSA aviso desconhecido em vez de tratá-lo como arte pronta");
    // Regra dura: ordem de outro sistema não apaga trabalho de ninguém aqui.
    const corpoCancelar = (libTxt.match(/function cancelar\(origemId, motivo\) \{[\s\S]*?\n\}/) || [""])[0];
    checa(!!corpoCancelar && corpoCancelar.indexOf("discardTask") === -1
      && corpoCancelar.indexOf("rmSync") === -1 && corpoCancelar.indexOf("unlink") === -1,
      "cancelar NUNCA apaga peça — só marca (a peça pode já estar editada ou publicada)");
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



  // ==========================================================================
  // 20. A APARENCIA DA ARTE: o que a tela promete e o que o motor faz
  // Nasceu de uma revisao da tela de criacao (31 achados confirmados). Os tres defeitos
  // estruturais eram: (a) a superficie escolhida so chegava nos slides de CONTEUDO do carrossel
  // — capa, feed, story e imagem a descartavam em silencio; (b) o valor congelado na geracao
  // vencia o campo da tela, entao trocar depois de gerar nao fazia nada; (c) a tela prometia
  // coisas que o motor nao cumpria. Cada um tem verificacao aqui.
  // As checagens de TEXTO usam indexOf de proposito: expressao regular escrita a mao neste
  // arquivo ja quebrou por escape, e aqui o que interessa e a presenca da frase.
  // ==========================================================================
  {
    secao("20. A aparência da arte: a tela promete, o motor cumpre");
    const rr = require("./lib/render.js");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const temGrade = (h) => h.indexOf("background-size: 60px 60px") >= 0;
    const temPapel = (h) => h.indexOf("F5F4EF") >= 0;
    const temVinheta = (h) => h.indexOf("rgba(0,0,0,.52)") >= 0;

    // -- 20a. A superficie chega em TODOS os caminhos de arte ---------------
    ["editorial", "bold", "split"].forEach((tpl) => {
      const capa = rr.carouselSlidesHtml(
        { fundo: "grade", slides: [{ layout: "cover", title: "Capa" }, { layout: "text", title: "B" }] },
        rr.TEMPLATES[tpl], {})[0].html;
      checa(temGrade(capa), "a CAPA do carrossel recebe a superfície escolhida (" + tpl + ")");
    });
    checa(temGrade(rr.storyCardsHtml({ fundo: "grade", cards: [{ title: "Um" }] }, {})[0].html),
      "o cartão de Story recebe a superfície escolhida");
    checa(temVinheta(rr.TEMPLATES.editorial({ width: 1080, height: 1350, headline: "x", fundo: "vinheta" })),
      "a peça única (feed/imagem) recebe a superfície escolhida");

    // -- 20b. Papel e folha CLARA: o texto nao pode sumir -------------------
    const capaPapel = rr.carouselSlidesHtml(
      { fundo: "papel", slides: [{ layout: "cover", title: "T", body: "b" }] }, rr.TEMPLATES.editorial, {})[0].html;
    checa(capaPapel.indexOf("color:#003554 !important") >= 0, "sobre papel o título vira tinta escura");
    checa(capaPapel.indexOf("logo-4selet-light") < 0, "e o logo troca para a versão escura (o claro sumiria na folha)");

    // -- 20c. Na Foto a superficie NAO cobre a imagem da pessoa -------------
    checa(!temPapel(rr.TEMPLATES.photo({ width: 1080, height: 1350, headline: "x", fundo: "papel" })),
      "no arranjo Foto a superfície não entra (a foto é a superfície)");

    // -- 20d. Sem escolher nada, nada muda ---------------------------------
    const semNada = rr.TEMPLATES.editorial({ width: 1080, height: 1350, headline: "x" });
    checa(!temGrade(semNada) && !temPapel(semNada) && !temVinheta(semNada),
      "sem superfície escolhida, a arte sai como sempre saiu");

    // -- 20e. O campo da TELA vence o valor congelado na geracao ------------
    // Era "LAST_GEN.req.X || campo": quem gerava com um estilo e trocava depois via a MESMA
    // imagem, e a peca salva saia no estilo velho. A ordem invertida e a correcao.
    checa(app.indexOf('LAST_GEN.req.template_variant) || ($("#g-style")') < 0,
      "o valor congelado na geração NÃO vence mais o campo da tela");
    checa(app.indexOf("const doCampo = (sel, congelado)") >= 0,
      "e a regra é 'existe o controle na tela?', não 'o valor é vazio?'");
    checa(app.indexOf('payload.fundo = daTela("#g-fundo")') >= 0, "ao salvar, a superfície é relida da tela");
    checa(app.indexOf("API.renderMedia(r.folder, ct.kind, tpl, lg, wmk, fnt, fnd)") >= 0,
      "e o render pós-salvamento leva tipografia e superfície (antes ia com 5 dos 7 argumentos)");

    // -- 20f. A tela nao promete o que nao acontece -------------------------
    checa(app.indexOf("IA pesquisa o tema") < 0, "a tela não promete mais que a IA pesquisa sozinha");
    checa(app.indexOf("A superfície de todos os slides desta peça") < 0, "nem a promessa antiga sobre 'todos os slides'");
    checa(app.indexOf("Estilo: <strong>${esc(out.template)}") < 0, "a prévia não mostra mais o id cru do motor");
    checa(app.indexOf("function templateName(") >= 0, "e existe a tradução do id para o nome que a pessoa escolheu");
    checa(app.indexOf("falha no envio") < 0, "erro de envio deixou de ser 'falha no envio' sem saída");
    checa(app.indexOf("function motivoDoEnvio(") >= 0, "e passou a dizer o motivo e o que fazer");
    // Só o que a PESSOA lê. Comentário de código pode falar "renderizando" à vontade — é
    // vocabulário de quem mantém o arquivo, e trocá-lo ali não muda nada para quem usa.
    const semComent = app.split("\n").filter((l) => l.trim().indexOf("//") !== 0).join("\n");
    const jargao = (semComent.match(/[Rr]enderizando/g) || []).length;
    checa(jargao === 0, "nenhum 'renderizando' sobrou na tela (é palavra de quem construiu)", jargao + " ocorrência(s)");

    // -- 20g. O seletor por slide nao mente sobre a heranca ------------------
    checa(app.indexOf("Igual ao da peça") >= 0, "o seletor do slide diz de ONDE vem o fundo quando ele não tem o seu");
    checa(app.indexOf("Degradê azul da marca") >= 0, "e existe caminho de volta explícito para o azul da marca");
  }



  // ==========================================================================
  // 21. O SELETOR DE ARRANJO: um so, nas duas telas, com tres de cara
  // Tres coisas que ja custaram caro e nao podem voltar:
  //   (a) UM SELETOR SO. A criacao oferecia 4 opcoes num campo de texto e a peca oferecia 14 com
  //       miniatura — quem aprendia num lugar errava no outro.
  //   (b) UMA GRADE SO. Com <details>, o "Ver menos" e o texto de orientacao ficavam cravados
  //       entre as fileiras e partiam as artes em dois blocos.
  //   (c) ESCOLHA VIVA. Peca que ja usa um arranjo escondido nasce com a grade inteira, senao o
  //       cartao marcado some e a pessoa conclui que a escolha dela se perdeu.
  // E a invariante de motor: os 14 tem que VALER em todo formato. Enquanto so a peca de Imagem
  // conhecia os arquetipos, escolher "Grade de numeros" num feed era clique sem efeito.
  // ==========================================================================
  {
    secao("21. O seletor de arranjo: um so, nas duas telas");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const css = fs.readFileSync(path.join(__dirname, "public/css/styles.css"), "utf8");
    const semComentCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const appSemComent = app.split("\n").filter((l) => l.trim().indexOf("//") !== 0).join("\n");
    const rr = require("./lib/render.js");

    // -- 21a. Um seletor so, montado num lugar so --------------------------
    checa(app.indexOf("function arranjoPicker(") >= 0, "existe UMA funcao que monta o seletor");
    checa(app.indexOf('arranjoPicker({ name: "render-tpl"') >= 0, "a pagina da peca usa ela");
    checa(app.indexOf('arranjoPicker({ name: "g-style-opt"') >= 0, "e a tela de criacao tambem");
    checa(appSemComent.indexOf('<select id="g-style">') < 0, "a criacao nao tem mais o campo de texto com 4 opcoes");
    checa(app.indexOf('<input type="hidden" id="g-style"') >= 0,
      "e o #g-style virou campo oculto (o resto do arquivo segue lendo .value)");
    checa(app.indexOf("function defineArranjo(") >= 0, "com um caminho unico para escrever nele e avisar quem escuta");

    // -- 21b. Tres de cara, e o esconderijo comeca no 4o -------------------
    checa(app.indexOf("const ARRANJOS_VISIVEIS = 3;") >= 0, "sao tres cartoes na tela antes de expandir");
    checa(/\.tpl-grid\.tpl-recolhido\s*>\s*\.tpl-opt:nth-child\(n \+ 4\)\s*\{[^}]*display:\s*none/.test(semComentCss),
      "e a regra que esconde comeca no 4o cartao");

    // -- 21c. UMA grade so: nada partindo as artes -------------------------
    checa(appSemComent.indexOf('<details class="tpl-mais"') < 0, "o seletor nao usa <details> (o resumo dele nunca sai da tela)");
    checa(appSemComent.indexOf("tpl-mais-lead") < 0, "nao existe texto de orientacao entre as fileiras");
    checa(app.indexOf('<button type="button" class="tpl-mais"') >= 0, "o controle e um <button> (foco pelo teclado)");
    // O botao e o irmao IMEDIATO da grade: e o que garante que ele fica embaixo dela nos dois estados.
    checa(/<\/div>\s*<button type="button" class="tpl-mais"/.test(app),
      "e vem logo DEPOIS da grade, nunca no meio dela");
    checa(/\.tpl-grid:not\(\.tpl-recolhido\)\s*\+\s*\.tpl-mais/.test(semComentCss),
      "o rotulo/seta trocam pelo estado da GRADE (um estado so, sem espelho em JavaScript)");
    checa(/\.tpl-mais\[hidden\]\s*\{[^}]*display:\s*none/.test(semComentCss),
      "e o [hidden] funciona apesar do display na classe (senao btn.hidden nao esconde nada)");

    // -- 21d. Escolha viva -------------------------------------------------
    checa(app.indexOf('itens.findIndex((t) => String(t.id) === String(current || "")) >= ARRANJOS_VISIVEIS') >= 0,
      "escolha fora dos tres primeiros faz a grade nascer inteira");
    checa(app.indexOf("btn.hidden = !recolhido && indiceEscolhido() >= ARRANJOS_VISIVEIS") >= 0,
      "e recolher nao e oferecido quando isso esconderia a escolha");
    checa(app.indexOf("cartoes()[ARRANJOS_VISIVEIS]") >= 0, "ao revelar, o foco vai para o primeiro cartao que apareceu");
    checa(app.indexOf("filter((t) => t.dado && !faltaDoArranjo(t, conceito)).length") >= 0,
      "a etiqueta 'combinam com o conteudo' ignora quem nao depende de dado (Foto)");

    // -- 21e. O MOTOR aceita os 14 em todo formato -------------------------
    // Sem isto o seletor novo seria dez escolhas mortas: o id do arquetipo caia fora do
    // `TEMPLATES[requested]` do pickTemplate e a arte saia no editorial de sempre.
    const eng = fs.readFileSync(path.join(__dirname, "lib/render.js"), "utf8");
    checa(eng.indexOf("function ehArquetipoDePeca(") >= 0, "o motor reconhece arquetipo como arranjo de peca");
    checa(eng.indexOf("const pedido = arranjoConhecido(requested) ? requested : null;") >= 0,
      "e o pickTemplate deixou de descartar os arquetipos em silencio");
    checa(eng.indexOf("function montaArquetipoDePeca(") >= 0, "com um so ponto que os desenha (feed, capa e imagem)");
    // A prova, no HTML gerado: a capa em Grade de numeros tem que sair EM grade.
    const capaArq = rr.carouselSlidesHtml(
      { stats: [{ value: "95%", label: "a" }, { value: "D+10", label: "b" }],
        slides: [{ layout: "cover", title: "Capa" }] },
      rr.TEMPLATES.editorial, { templateId: "stat_grid" })[0].html;
    checa(capaArq.indexOf('class="stat-v"') >= 0, "e a CAPA do carrossel sai mesmo em Grade de numeros");
    const capaPadrao = rr.carouselSlidesHtml({ slides: [{ layout: "cover", title: "Capa" }] }, rr.TEMPLATES.editorial, {})[0].html;
    checa(capaPadrao.indexOf('class="stat-v"') < 0, "sem pedido, a capa continua sendo a de sempre");
    const inventado = rr.carouselSlidesHtml({ slides: [{ layout: "cover", title: "Capa" }] }, rr.TEMPLATES.editorial, { templateId: "nao_existe" })[0].html;
    checa(inventado.indexOf("radial-gradient(120% 120% at 80% 10%") >= 0, "arranjo inventado cai no Editorial, sem erro");

    // -- 21f. O celular continua com uma coluna ----------------------------
    checa(!/\.tpl-picker\s*>\s*\.tpl-grid\s*\{[^}]*grid-template-columns/.test(semComentCss),
      "nenhuma regra de coluna com especificidade maior que a do celular");
    checa(/@media \(max-width: 560px\) \{ \.tpl-grid \{ grid-template-columns: 1fr/.test(semComentCss),
      "e a regra do celular continua la");

    // -- 21g. A regra dura da casa -----------------------------------------
    const trecho = app.slice(app.indexOf("function arranjoPicker("), app.indexOf("function templatePicker("));
    checa(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(trecho), "nenhum emoji no seletor (o chevron e desenhado em CSS)");
  }


  // ==========================================================================
  // 22. A NOTA DA FOTO DE CAPA
  // Ela nunca teve estilo proprio: herdava o `display:flex` do .gov-item e, como o conteudo era
  // texto solto, CADA pedaco da frase virava uma COLUNA — "Capa | — | procurei | open book dark |
  // no banco..." em tres colunas espremidas, quebrando palavras no meio. E a nota DESCREVIA a
  // foto em vez de mostra-la, com o `url` no payload desde sempre.
  // ==========================================================================
  {
    secao("22. A nota da foto de capa");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const css = fs.readFileSync(path.join(__dirname, "public/css/styles.css"), "utf8");
    const semComentCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

    // -- 22a. O texto volta a ser texto -----------------------------------
    checa(/\.capa-box\s*\{[^}]*align-items/.test(semComentCss), "a caixa da capa tem estilo proprio (antes so herdava o flex)");
    checa(/\.capa-txt\s*\{[^}]*flex:\s*1[^}]*min-width:\s*0/.test(semComentCss),
      "o texto vive num bloco que ocupa a largura e pode quebrar dentro do flex");
    checa(app.indexOf('<div class="capa-txt">') >= 0, "e a nota o envolve de verdade");

    // -- 22b. Mostra a foto em vez de descreve-la -------------------------
    checa(app.indexOf('class="capa-thumb"') >= 0, "a foto escolhida aparece na nota");
    checa(app.indexOf('onerror="this.remove()"') >= 0,
      "e uma foto apagada do acervo some, em vez de derramar o texto alternativo");
    checa(/\.capa-thumb\s*\{[^}]*object-fit:\s*cover/.test(semComentCss), "a miniatura recorta em vez de deformar");

    // -- 22c. A frase sai limpa -------------------------------------------
    checa(app.indexOf('capa.autor ? `<span class="capa-credito">Foto: ') >= 0,
      "o autor vira CREDITO (o nome vem do banco em minuscula e no meio da frase parecia erro)");
    checa(app.indexOf("cru.charAt(0).toUpperCase()") >= 0, "o motivo, em linha propria, comeca em maiuscula");
    checa(/\.capa-motivo\s*\{[^}]*display:\s*block/.test(semComentCss),
      "e tem linha propria — emendado na frase virava dois travessoes numa linha so");
    checa(/\.capa-credito \+ \.hint::before\s*\{[^}]*content/.test(semComentCss),
      "credito e dica separados por um ponto (encostados liam como uma frase so)");

    // -- 22d. Nada de emoji, nem jargao -----------------------------------
    const trecho = app.slice(app.indexOf("function capaHtml("), app.indexOf("async function saveGenerated("));
    checa(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(trecho), "nenhum emoji na nota (regra dura da casa)");
    checa(trecho.indexOf("Não gostou? Abra a peça e troque a foto do primeiro slide.") >= 0,
      "e a saida continua dita: como trocar a foto");
  }


  // ==========================================================================
  // 23. CANTOS MORTOS: escondido tem que esconder, e escolha repetida nao existe
  // O Hugo apontou uma caixinha VAZIA flutuando sobre a arte no editor. Era o mostrador de
  // medidas: com `hidden=true` o updateDims() retorna SEM preencher (app.js), so que a caixa
  // continuava desenhada porque `.he-dims` declara `display:flex` numa CLASSE — e classe vence o
  // `[hidden] { display:none }` do navegador, que e estilo de agente do usuario.
  // Isso ja tinha sido remendado caso a caso SEIS vezes neste CSS. A regra global mata a familia.
  // ==========================================================================
  {
    secao("23. Cantos mortos: escondido esconde, escolha repetida some");
    const css = fs.readFileSync(path.join(__dirname, "public/css/styles.css"), "utf8");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const semComentCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

    // -- 23a. A regra global, e no lugar certo (antes de tudo que declara display) ----
    checa(/\[hidden\]\s*\{\s*display:\s*none\s*!important\s*;?\s*\}/.test(semComentCss),
      "existe a regra global que faz o `hidden` do HTML sempre esconder");
    const posGlobal = semComentCss.search(/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
    const posPrimeiroDisplay = semComentCss.search(/\.[a-z][\w-]*\s*\{[^}]*display:\s*(flex|grid|inline-flex|inline-grid)/);
    checa(posGlobal >= 0 && (posPrimeiroDisplay < 0 || posGlobal < posPrimeiroDisplay + 4000),
      "e ela vem no topo, junto do reset — nao perdida no meio do arquivo");

    // -- 23b. O caso que apareceu na tela ---------------------------------
    checa(/\.he-dims\s*\{[^}]*display:\s*flex/.test(semComentCss),
      "o mostrador de medidas segue declarando display (por isso precisava da regra)");
    checa(app.indexOf('const box = ov.querySelector("#he-dims"); if (!box || box.hidden) return;') >= 0,
      "e ele so se preenche quando esta ligado — desenhado escondido, ficaria VAZIO");

    // -- 23c. Escolha repetida: dois botoes para o mesmo caminho ----------
    checa(app.indexOf('id="he-add-img"') < 0,
      "o botao que so enviava arquivo saiu do editor (era a opcao 3 do modal, com outro nome)");
    checa(app.indexOf('id="he-search-img"') >= 0, "e sobrou um so, que pergunta a origem");
    checa(app.indexOf("$(\"#he-file\").onchange") >= 0,
      "o campo de arquivo continua vivo — quem o usa agora e o caminho 'Enviar um arquivo' do modal");
    // O antigo abria o seletor de arquivo direto; se voltar, volta a escolha falsa.
    checa(app.indexOf('$("#he-add-img").onclick') < 0, "e nada mais abre o seletor de arquivo por fora do modal");
  }


  // ==========================================================================
  // 24. OS QUATRO ACHADOS DA HORA DE SALVAR
  // (a) a previa mostrava uma arte e o arquivo salvava outra;
  // (b) "Salvar peca" sem titulo nao dava sinal nenhum;
  // (c) "Comecar do zero" apagava tudo num clique, sem perguntar;
  // (d) o erro de nome repetido citava campos que a pessoa nao ve.
  // ==========================================================================
  {
    secao("24. Os quatro achados da hora de salvar");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const eng = fs.readFileSync(path.join(__dirname, "lib/render.js"), "utf8");

    // -- 24a. A previa resolve o "Automatico" como o render final ----------
    // O renderImage troca o desenho quando o conteudo tem dado (arquetipoPorDado). A previa caia
    // sempre no editorial: a pessoa aprovava Editorial e recebia Grade de numeros no arquivo.
    checa(eng.indexOf("const semEscolha = !arranjoConhecido(template);") >= 0,
      "a previa reconhece quando ninguem escolheu arranjo");
    checa(eng.indexOf("const arqDoDado = arquetipoPorDado(p);") >= 0,
      "e resolve pelo DADO primeiro, como o render final");
    checa(eng.indexOf("TEMPLATES_ROTACAO[hashDoNome(String(folder || \"\")) % TEMPLATES_ROTACAO.length]") >= 0,
      "caindo na mesma rotacao por nome quando nao ha dado");
    checa(app.indexOf("const pastaDaPeca =") >= 0 && app.indexOf("folder: pastaDaPeca") >= 0,
      "a tela manda o nome da peca (a rotacao e por nome, e tem que bater)");
    checa(app.indexOf("template = autoVariant(task + \"_\" + date);") < 0,
      "e parou de resolver o Automatico por conta propria, escondendo a troca por arquetipo");
    // A prova viva: mesma peca, mesma entrada — previa e render final tem que dar o mesmo id.
    {
      const rr = require("./lib/render.js");
      const conceito = { headline: "Os numeros", subtext: "a", stats: [{ value: "95%", label: "x" }, { value: "D+10", label: "y" }] };
      // arquetipoPorDado nao e exportado; o proxy e o que a previa devolve com template vazio.
      const esperado = "stat_grid";
      const bate = typeof rr.renderPreview === "function";
      checa(bate, "renderPreview segue exportado para a bateria conferir", bate ? "" : "sumiu");
      checa(eng.indexOf('if (semEscolha && ct.kind === "image")') >= 0,
        "e a cascata vale so na peca de Imagem — feed e carrossel nao trocam por dado", esperado);
      void conceito;
    }

    // -- 24b. O aviso chega em quem esta rolado ate o fim ------------------
    checa(app.indexOf("function avisaCampo(") >= 0, "existe um caminho unico de aviso de campo");
    checa(/function avisaCampo\([\s\S]{0,700}toast\(frase, "error"\)/.test(app),
      "que avisa por cima (toast) — a frase no campo lá em cima, sozinha, nao era vista");
    checa(/function avisaCampo\([\s\S]{0,900}scrollIntoView/.test(app), "e leva a pessoa ate o campo");
    checa(/function avisaCampo\([\s\S]{0,900}det\.setAttribute\("open", ""\)/.test(app),
      "abrindo o bloco recolhido, se o campo estiver dentro de um");
    checa(app.indexOf('avisaCampo("#g-title", "#e-title", "Dê um título à peça') >= 0,
      "e o titulo vazio passa por ele");
    checa(app.indexOf("function limpaAviso(") >= 0 && /function limpaAviso\([\s\S]{0,300}classList\.remove\("invalid"\)/.test(app),
      "corrigir tira a borda vermelha (antes ela ficava presa)");

    // -- 24c. "Comecar do zero" pergunta antes -----------------------------
    checa(app.indexOf('$("#g-regen").onclick = runGenerate;') < 0, "o clique nao apaga mais direto");
    checa(/#g-regen"\)\.onclick = async \(\) => \{[\s\S]{0,400}uiConfirm\(/.test(app), "ele pergunta antes");
    checa(app.indexOf("Não dá para voltar atrás.") >= 0, "e diz que nao tem volta");

    // -- 24d. O erro de nome repetido aponta para um campo VISIVEL ---------
    checa(app.indexOf("const idEditadoAMao =") >= 0,
      "o 409 distingue identificador derivado do titulo e identificador editado a mao");
    checa(app.indexOf("Mude o título — pode ser só um detalhe") >= 0,
      "e no caso normal manda mexer no TITULO, que e o campo que a pessoa ve");
    checa(app.indexOf('const campo = $("#g-task") || $("#g-name") || $("#g-slug");') < 0,
      "nada mais foca um campo invisivel (que era um nao-evento)");
  }


  // ==========================================================================
  // 25. ENTREGA DO SQUAD SEM O DESENHO EDITAVEL
  // O contrato (PROMPT_SQUAD_WEBHOOK.md, secao 3.2) pede `cards[].html` junto do `png`, com
  // aceite escrito: "a peca criada no painel permite editar o texto por dentro". O time deles
  // esta mandando so o `png` — medido no payload do post 5. Isso passava CALADO: a peca nascia
  // chapada, e quem abrisse o editor ia procurar o texto e nao achar.
  // Detalhe que confunde: as DUAS entregas produzem um feed.html. O que muda e o que tem dentro
  // — com html vem o desenho de verdade; sem ele, o painel monta a PRANCHETA (a imagem como
  // camada de fundo). Foi por isso que a arte "parecia" ter chegado em HTML.
  // ==========================================================================
  {
    secao("25. Entrega do squad sem o desenho editável");
    const sq = fs.readFileSync(path.join(__dirname, "lib/squad.js"), "utf8");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const doc = fs.readFileSync(path.join(__dirname, "..", "PROMPT_SQUAD_WEBHOOK.md"), "utf8");

    // -- 25a. O contrato pede, e com aceite --------------------------------
    checa(doc.indexOf("cards[].html") >= 0, "o documento entregue ao squad pede o campo cards[].html");
    checa(/Aceite:[^\n]*cards\[\]\.html/.test(doc), "com um aceite escrito, para nao virar 'opinioes'");
    checa(doc.indexOf("3.2 Levar o HTML de cada card junto com a imagem") >= 0,
      "e uma secao so sobre isso, apontando o codigo deles");

    // -- 25b. Quando NAO vem, o painel diz -------------------------------
    checa(sq.indexOf("chegou só como imagem, sem o desenho editável junto") >= 0,
      "sem o html, a entrega gera um AVISO na peca (antes passava calado)");
    checa(/avisos\.push\("A arte " \+ n \+ " chegou só como imagem[\s\S]{0,400}cards\[\]\.html/.test(sq),
      "o aviso cita o campo exato que falta");
    checa(/chegou só como imagem[\s\S]{0,500}seção 3\.2/.test(sq),
      "e a secao do documento — da para cobrar do time deles sem procurar");
    checa(/if \(!c\.html\) \{/.test(sq), "o aviso so aparece quando o html realmente nao veio");

    // -- 25c. E a TELA diz antes do clique -------------------------------
    checa(app.indexOf("A arte chegou como imagem") >= 0,
      "a tela avisa o limite ANTES do clique, em vez de deixar procurar o texto");
    checa(app.indexOf("não para reescrever o texto que já está lá") >= 0,
      "dizendo o que da (escrever por cima) e o que nao da (reescrever)");

    // -- 25d. A prova viva, nos dois sentidos ----------------------------
    // Prancheta = imagem chapada como camada (class="base"). Desenho de verdade = tem o texto.
    checa(sq.indexOf("gravarDeHtml") >= 0, "existe o caminho que transforma o html recebido na arte da peca");
    checa(/sanitizeArtHtml/.test(sq), "e ele higieniza o html de fora antes de desenhar");
    checa(/strictNet: true/.test(sq), "desenhando com a rede bloqueada (html de fora nao busca nada)");
  }

  // ============================================================================
  // 26. FEED OU STORY: o painel pergunta para onde a peça vai
  // ----------------------------------------------------------------------------
  // Antes o painel mandava TUDO para o feed e nem perguntava. A peça de Story batia em
  // "não achei imagem publicável" DEPOIS de a pessoa confirmar a publicação de verdade.
  // ============================================================================
  {
    secao("26. Feed ou Story: para onde a peça vai");
    const cfg = require("./lib/config");
    const pub = require("./lib/publish");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const css = fs.readFileSync(path.join(__dirname, "public/css/styles.css"), "utf8");

    // -- 26a. O vocabulário existe e as duas pontas leem o MESMO ---------
    checa(Array.isArray(cfg.DESTINOS) && cfg.DESTINOS.length >= 2, "existe uma lista de destinos, uma só");
    const story = cfg.destinoById("story"), feed = cfg.destinoById("feed"), reels = cfg.destinoById("reels");
    checa(story && story.modo === "auto", "o painel publica no Story sozinho");
    checa(reels && reels.modo !== "auto", "e NAO promete publicar Reels sozinho (o painel nao faz isso)");
    checa(cfg.destinoPadrao("story") === "story", "peca de Story ja nasce apontando para o Story");
    checa(cfg.destinoPadrao("carousel") === "feed", "e carrossel para o feed");
    // A tela tem um espelho desta conta. Se as duas divergirem, a peça vai para
    // um lugar que ninguem escolheu — por isso o espelho é conferido aqui.
    const esp = app.match(/function destinoPadraoDaPeca\(kind\)\{?[\s\S]{0,300}?\n\}/);
    checa(!!esp && /"story"/.test(esp[0]) && /"reels"/.test(esp[0]),
      "a tela repete a mesma conta do servidor (senao a peca vai parar noutro lugar)");

    // -- 26b. Cada destino pega as artes CERTAS --------------------------
    const dTmp = path.join(require("os").tmpdir(), "reg_dest_" + Date.now());
    fs.mkdirSync(path.join(dTmp, "story"), { recursive: true });
    fs.mkdirSync(path.join(dTmp, "slides"), { recursive: true });
    fs.mkdirSync(path.join(dTmp, "ads"), { recursive: true });
    criadas.push(dTmp);
    [["story/story_1.png"], ["story/story_2.png"], ["story/story_3.png"],
      ["slides/slide_01.png"], ["slides/slide_02.png"], ["ads/feed.png"]].forEach(([r]) =>
      fs.writeFileSync(path.join(dTmp, r), "x"));
    const pStory = pub.pickImages(dTmp, "story", "story").map((f) => path.basename(f));
    const pFeed = pub.pickImages(dTmp, "carousel", "feed").map((f) => path.basename(f));
    checa(pStory.length === 3 && pStory[0] === "story_1.png" && pStory[2] === "story_3.png",
      "Story leva as artes de story, NA ORDEM", pStory.join(","));
    checa(pFeed.length === 2 && pFeed[0] === "slide_01.png",
      "e o feed leva os slides do carrossel", pFeed.join(","));

    // -- 26c. Recusa que explica o motivo certo --------------------------
    // Sao DOIS motivos diferentes e a frase tem que separar: "o painel nao faz"
    // e' diferente de "essa peca nao vai nesse lugar".
    checa(cfg.publicaSozinho("story", "story") === true, "Story de peca de Story: pode");
    checa(cfg.publicaSozinho("feed", "story") === false, "Story no feed: nao (e o painel barra antes)");
    checa(cfg.publicaSozinho("reels", "video") === false, "Reels: o painel nao publica sozinho");
    const pubSrc = fs.readFileSync(path.join(__dirname, "lib/publish.js"), "utf8");
    checa(/E_DESTINO_MANUAL/.test(pubSrc) && /E_DESTINO_INCOMPATIVEL/.test(pubSrc),
      "os dois motivos tem codigos diferentes");
    checa(/poste pelo celular/.test(pubSrc), "o manual diz o que fazer no lugar");
    checa(/Escolha outro destino nesta janela/.test(pubSrc), "e o incompativel manda escolher outro");
    checa(/media_type: "STORIES"/.test(pubSrc), "o Story usa o tipo STORIES do Instagram");
    checa(/E_STORY_PARCIAL/.test(pubSrc), "e se cair no meio, diz QUANTAS ja foram (nao repostar as mesmas)");

    // -- 26d. A tela mostra o Story como Story, nao como post de feed ----
    checa(/function instagramStoryPreview\(/.test(app), "existe a previa propria de Story");
    checa(/ig-st-bars/.test(app) && /ig-st-bar/.test(css), "com as barrinhas de progresso no topo");
    checa(!/ig-story[\s\S]{0,900}ig-post-likes/.test(app),
      "e SEM curtidas/legenda falsa — Story nao tem isso");
    checa(/aspect-ratio: 9 \/ 16/.test(css), "em tela cheia 9:16");
    checa(/pv\.dataset\.modo !== destino/.test(app), "trocar o destino troca a previa na hora");
    checa(/cx\.hidden = noStory/.test(app), "e a caixa de legenda some no Story (o texto mora na arte)");
    // O vazio na coluna da direita NAO se resolve empurrando o rodape — isso so muda o buraco de
    // lugar (de antes dos botoes para depois deles). Quem manda na altura passa a ser o
    // FORMULARIO: a tela mede o conteudo dele e diz a previa 9:16 que altura ter.
    checa(/function ajustaAlturaDaPrevia\(/.test(app), "a previa recebe a altura do formulario");
    checa(/--alt-previa/.test(app) && /height: var\(--alt-previa/.test(css), "por uma variavel de CSS");
    checa(/aspect-ratio: 9 \/ 16/.test(css), "e a proporcao 9:16 deriva a largura");
    checa(/classList\.contains\("pub-foot"\)\) return;/.test(app),
      "a margem automatica do rodape fica FORA da conta (era ela o buraco)");
    // E o piso da previa nao pode empurrar a janela para alem da TELA: barra de rolagem aqui
    // esconde os botoes de publicar abaixo da dobra, que e pior que uma previa menor.
    checa(app.indexOf("window.innerHeight * 0.92") >= 0, "o teto da previa sai da altura da TELA");
    checa(app.indexOf("const PISO = 620") >= 0, "com piso generoso quando cabe");
    checa(app.indexOf("Math.max(Math.min(PISO, teto), Math.min(teto, casaComOForm))") >= 0,
      "e o teto vence o piso (senao nasce a barra de rolagem)");
    checa(!/\.pub-form\.sem-legenda/.test(css), "e a regra antiga que empurrava o rodape saiu");
    checa(/bn\.disabled = soManual/.test(app),
      "e destino que o painel nao publica nem deixa clicar em publicar");

    // -- 26e. O TIPO vem da PECA, nao do que a tela mandou -----------------
    // A tela chama publicar sem `kind` (sempre chamou). Enquanto a trava lia opts.kind cru ela
    // recebia vazio, nao achava esse vazio em destino nenhum e recusava TUDO com "Uma peca de
    // conteudo nao vai para o Story" — inclusive a peca certa no destino certo.
    checa(/const kind = String\(opts\.kind \|\| ""\) \|\| kindDaPeca\(folder\)/.test(pubSrc),
      "sem kind na chamada, o servidor pergunta a PECA qual e o tipo");
    checa(/content\.getTask\(folder\)/.test(pubSrc), "usando a mesma conta que a tela usa");
    checa(!/publicaSozinho\(destino, opts\.kind\)/.test(pubSrc),
      "e a trava nao le mais opts.kind cru (era isso que recusava tudo)");

    // -- 26f. A arte que nao e 9:16 avisa ANTES do clique -------------------
    // Um Story 1080x1350 saiu com o texto cortado no aparelho em 19/08. O Instagram AMPLIA ate
    // preencher e corta — nao deixa borda. A previa corta igual, e o aviso diz quanto se perde.
    checa(/object-fit: cover/.test((css.match(/\.ig-st-media \.ig-post-img \{[^}]*\}/) || [""])[0]),
      "a previa do Story CORTA como o Instagram corta (nao finge que cabe)");
    checa(/function avisaFormatoDoStory\(/.test(app), "e existe o aviso de formato");
    checa(/Math\.max\(1080 \/ w, 1920 \/ h\)/.test(app), "que faz a MESMA conta do app (cover)");
    checa(/px de cada lado/.test(app), "dizendo quantos pixels somem");
    checa(/crie a peça como <strong>Story Instagram/i.test(app), "e o que fazer para sair inteira");
  }

  // ============================================================================
  // 27. A arte de Story não desenha a barra do Instagram
  // ----------------------------------------------------------------------------
  // A arte desenhava a própria barra de progresso. O Instagram desenha a DELE por cima de todo
  // Story — saíam duas. A contagem "2/5" fica: o app mostra segmentos, não números.
  // ============================================================================
  {
    secao("27. A arte de Story não repete a barra do Instagram");
    const rr = require("./lib/render");
    const cards = [{ title: "Um" }, { title: "Dois" }, { title: "Tres" }];
    const feitos = rr.storyCardsHtml({ cards: cards }, {});
    checa(feitos.length === 3, "gerou os tres cartoes", feitos.length + " cartoes");
    checa(feitos.every((c) => c.html.indexOf('class="barra"') < 0),
      "nenhum cartao desenha barra de progresso (quem desenha e o Instagram)");
    checa(feitos.every((c) => c.html.indexOf(".barra") < 0),
      "e o CSS da barra saiu junto (senao o proximo arquetipo a ressuscita)");
    checa(feitos.every((c) => /class="conta"/.test(c.html)),
      "a contagem 2/5 FICA — o app mostra segmentos, nao numeros");
    // Cartao unico nao tem sequencia: nem barra, nem contagem.
    const um = rr.storyCardsHtml({ cards: [{ title: "So um" }] }, {});
    checa(um.length === 1 && um[0].html.indexOf('class="conta"') < 0,
      "story de um cartao so nao mostra contagem de nada");
    // A altura util nao pode ter mudado: a zona segura e geometria, nao recomendacao.
    checa(feitos.every((c) => /padding:250px 96px 250px/.test(c.html) || /padding:250px/.test(c.html)),
      "e a zona segura do aplicativo segue intacta");
  }

  // ============================================================================
  // 27b. Versão 9:16 de uma peça que nasceu para o feed
  // ----------------------------------------------------------------------------
  // O Instagram não completa com borda: amplia até preencher a tela do Story e corta o resto.
  // Um feed 1080×1350 postado ali em 19/08/2026 perdeu ~228px de CADA lado.
  // ============================================================================
  {
    secao("27b. Versão 9:16 de uma peça de feed");
    const rr = require("./lib/render");
    const rota = fs.readFileSync(path.join(__dirname, "routes/content.js"), "utf8");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");

    checa(typeof rr.renderStoryDeFeed === "function", "existe o caminho que desenha a arte vertical");
    // A conta do corte, que é o motivo de tudo: 1080x1350 no 9:16.
    const escala = Math.max(1080 / 1080, 1920 / 1350);
    const corte = Math.round((1080 * escala - 1080) / 2);
    checa(corte === 228, "e a conta do corte confere com o que saiu no aparelho", corte + "px de cada lado");

    // Peça APROVADA não é tocada por baixo do pano: arquivo novo lá dentro derruba o gate.
    checa(/E_PRECISA_REABRIR/.test(rota), "peca aprovada e RECUSADA, com o caminho de volta");
    checa(/quebraria a conferência de integridade/.test(rota), "explicando por que (o gate, nao um capricho)");
    checa(/E_JA_E_STORY/.test(rota), "e peca que ja e Story tambem recusa");
    checa(/E_PECA_IMPORTADA/.test(rota), "arte importada tambem — o painel nao tem os dados dela");

    // O texto do Story NÃO usa o limite do feed: lá cabe mais, e cortar em 60 picotava a frase.
    const src = fs.readFileSync(path.join(__dirname, "lib/render.js"), "utf8");
    checa(/const STORY_MAX_MANCHETE = 110/.test(src), "o Story tem limite de texto proprio");
    checa(/manchete: STORY_MAX_MANCHETE/.test(src), "e a versao 9:16 o usa (o do feed cortava com reticencias)");
    checa(/function textoDaArteDoFeed\(fonte, limites\)/.test(src), "o limite virou parametro, um por formato");

    // A tela só oferece onde faz sentido.
    checa(/function podeGerarVersaoStory\(/.test(app), "a tela sabe quando oferecer");
    checa(/task\.kind === "story" \|\| task\.kind === "video"/.test(app), "nao oferece para Story nem para video");
    checa(/228 px de cada lado/.test(app), "e o aviso na tela diz o numero medido");
    checa(/versaoStory: \(folder\)/.test(fs.readFileSync(path.join(__dirname, "public/js/api.js"), "utf8")),
      "com a chamada ligada");

    // -- ENQUADRAR: a arte que CHEGOU PRONTA (squad/importada) ------------
    // Redesenhar aqui jogaria fora o design de quem fez — o painel só tem o PNG chapado.
    checa(typeof rr.enquadraStory === "function", "existe o caminho que ENQUADRA a arte pronta");
    checa(/const veioPronta = !!\(t\.status && \(t\.status\.imported \|\| \(t\.status\.origem && t\.status\.origem\.sistema\)\)\)/.test(rota),
      "e a rota escolhe sozinha: veio pronta -> enquadra; nasceu aqui -> redesenha");
    checa(/function arteVeioPronta\(/.test(app) && /encaixa a arte inteira/.test(app),
      "a tela DIZ qual dos dois vai acontecer (o resultado e diferente)");
    // A geometria: 4:5 na largura cheia cai entre 285 e 1635 — dentro da zona segura (250..1670).
    const altNoStory = Math.round(1350 * (1080 / 1080));
    const topo = Math.round((1920 - altNoStory) / 2), base = topo + altNoStory;
    checa(topo >= 250 && base <= 1670,
      "arte 4:5 enquadrada cai inteira dentro da area que o aplicativo nao cobre", "y=" + topo + ".." + base);
    checa(/filter:blur\(64px\)/.test(src), "as faixas levam a propria arte desfocada, nao tarja preta");
    checa(/\/\\\.\(orig\|bg\)\\\./.test(src) || src.indexOf("/\\.(orig|bg)\\./i.test(f)") >= 0,
      "e o .orig/.bg do editor NAO pode virar a origem (devolveria a versao pre-edicao)");
    checa(/E_SEM_ARTE/.test(src) && /E_SEM_ARTE/.test(rota), "peca sem arte recusa em vez de gerar vazio");

    // -- O squad pode mandar a 9:16 junto, e o painel ja recebe -------------
    const sq2 = fs.readFileSync(path.join(__dirname, "lib/squad.js"), "utf8");
    const srcRender = fs.readFileSync(path.join(__dirname, "lib/render.js"), "utf8");
    const doc = fs.readFileSync(path.join(__dirname, "..", "SQUAD_FORMATO_STORY.md"), "utf8");
    // indexOf, nao regex: estas frases tem barra, chave e barra-vertical — escapa-las num regex
    // so cria oportunidade de errar o escape (ja aconteceu duas vezes nesta bateria).
    checa(sq2.indexOf('obj.story && typeof obj.story === "object"') >= 0,
      "o painel LE o campo cards[].story da entrega do squad");
    checa(sq2.indexOf('const baseSt = "story/story_"') >= 0,
      "e grava no lugar de onde a publicacao tira a arte do Story");
    checa(sq2.indexOf('h.update("|story|")') >= 0,
      "a versao vertical entra na impressao digital (senao o reenvio vira duplicata)");
    checa(sq2.indexOf("if (enquadradas) {") >= 0,
      "e o aviso de que faltou sai UMA vez por entrega, nao por card");

    // -- Entrega no formato ERRADO: o painel conserta na CHEGADA ----------
    // Antes esta porta so avisava, e a peca nascia sem arte de Story. Enquadrar aqui e o
    // unico momento sem atrito: a peca ainda esta em rascunho, entao a arte nova entra no
    // calculo dos content_hashes. Feito depois, com a peca aprovada, qualquer arquivo novo
    // derruba o gate de publicacao com E_HASH_MISMATCH.
    checa(sq2.indexOf("render.enquadraStory(folder, { arte: relArte, n: n })") >= 0,
      "entrega sem a vertical e ENQUADRADA sozinha, na chegada");
    checa(sq2.indexOf("let relArte") >= 0, "a partir da arte que acabou de ser gravada");
    checa(srcRender.indexOf("const n = Number(opts.n) > 0 ? Number(opts.n) : 1;") >= 0,
      "e cada slide vira um Story proprio (antes gravavam por cima do mesmo story_1)");
    checa(sq2.indexOf("encaixei a arte") >= 0 || sq2.indexOf("encaixei as ") >= 0,
      "o aviso diz que JA resolveu, em vez de mandar a pessoa resolver");
    checa(sq2.indexOf("encaixar não é desenhar") >= 0,
      "sem esconder que enquadrar e remendo, nao desenho");
    // A porta so age quando falta: arte que veio pronta nao pode ser sobrescrita.
    checa(sq2.indexOf("if (c.story) {") >= 0, "e quando a vertical VEM, o painel nao mexe nela");
    checa(doc.indexOf("228 px de cada lado") >= 0, "o documento traz a conta do corte");
    checa(doc.indexOf("cards[].story") >= 0 && doc.indexOf("1080 × 1920") >= 0, "o contrato e a medida");
    checa(/## 6. Aceite/.test(doc), "com aceite escrito, para nao virar opiniao");
    checa(doc.indexOf("888 × 1420") >= 0, "e a area util depois da zona segura");

    // -- A peca NAO troca de tipo por ganhar a arte vertical ---------------
    // Enquanto a pasta story/ classificava a peca, um feed que ganhava a versao 9:16 virava
    // "story" — e PERDIA o Feed da lista de destinos, porque feed.kinds nao aceita story.
    const cSrc = fs.readFileSync(path.join(__dirname, "lib/content.js"), "utf8");
    const trecho = (cSrc.match(/function classifyKind[\s\S]*?\n\}/) || [""])[0];
    const posStoryPasta = trecho.indexOf("story\\/story_\\d+");
    const posFeed = trecho.indexOf("instagram_caption\\.txt$");
    checa(posStoryPasta > posFeed && posFeed > 0,
      "a pasta story/ so classifica DEPOIS de feed e carrossel");
    checa(/if \(has\(\/instagram_story\\\.json\$\/\)\) return "story";/.test(trecho),
      "e o arquivo de conteudo continua ancorando o Story de verdade");
    // A prova viva, com peça em disco: feed que ganha 9:16 segue feed, e cada destino pega a sua arte.
    {
      const cnt = require("./lib/content");
      const pb = require("./lib/publish");
      const cfg = require("./lib/config");
      const d = peca("regtipo_" + Date.now(), {
        "copy/instagram_caption.txt": "teste\n\n#4Selet",
        "ads/feed.png": "x",
      });
      const folder = path.basename(d);
      checa(cnt.getTask(folder).kind === "feed", "peca de feed nasce feed");
      fs.mkdirSync(path.join(d, "story"), { recursive: true });
      fs.writeFileSync(path.join(d, "story", "story_1.png"), "x");
      const t = cnt.getTask(folder);
      checa(t.kind === "feed", "e CONTINUA feed depois da arte 9:16", t.kind);
      const dests = (cfg.DESTINOS || []).filter((x) => x.modo === "auto" && (x.kinds || []).indexOf(t.kind) >= 0).map((x) => x.id);
      checa(dests.indexOf("feed") >= 0 && dests.indexOf("story") >= 0, "com os dois destinos na mao", dests.join(","));
      checa(path.basename(pb.pickImages(d, t.kind, "story")[0] || "") === "story_1.png", "Story usa a vertical");
      checa(path.basename(pb.pickImages(d, t.kind, "feed")[0] || "") === "feed.png", "e o feed usa a de feed");
    }
  }

  // ============================================================================
  // 28. Editor: o clique chega em quem dá para mover
  // ----------------------------------------------------------------------------
  // Medido na peça "infraestrutura_checkout": no meio da foto, a pilha sob o cursor era
  // .scrim > .wash > img.photo. Os dois véus capturavam o clique, o arrasto caía no .card e
  // virava LAÇO — a foto ficava selecionada e não andava.
  // ============================================================================
  {
    secao("28. Editor: o clique chega em quem da para mover");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    checa(/\.card \*:not\(\[data-he\]\)\{pointer-events:none;\}/.test(app),
      "camada decorativa nao captura mais o clique");
    checa(/\[data-he\]\{pointer-events:auto;\}/.test(app),
      "e o que da para mover volta a receber");
    // O .card em si NAO pode entrar na regra: e ele que recebe o clique no vazio (laco).
    checa(!/[^*]\.card\{pointer-events:none/.test(app),
      "o proprio cartao continua recebendo (senao o laco no vazio morre)");
    // indexOf, e nao regex: no fonte do app.js esta regra mora dentro de uma string com as
    // aspas escapadas (contenteditable=\"true\"), e escapar isso de novo num regex so confunde.
    checa(app.indexOf('[data-he][contenteditable=\\"true\\"] *{pointer-events:auto;}') >= 0,
      "e o <span> de destaque dentro do texto recebe clique enquanto se edita");
  }

  // ============================================================================
  // 29. Tirar do ar: apagar no Instagram OU só limpar a lista
  // ============================================================================
  {
    secao("29. Tirar do ar: apagar no Instagram ou so limpar a lista");
    const pub = require("./lib/publish");
    const pubs = require("./lib/publications");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const rota = fs.readFileSync(path.join(__dirname, "routes/publish.js"), "utf8");
    const cnt = require("./lib/content");

    // -- 29a. A leitura de cada resposta da Meta, sem tocar na rede --------
    const L = pub.leituraDoApagar;
    checa(L(200, { success: true, deleted_id: "9" }, "9").deleted_id === "9", "apagou: devolve o id");
    const sp = L(400, { error: { code: 200, message: "(#200) Requires instagram_manage_contents permission" } }, "1");
    checa(sp.code === "E_SEM_PERMISSAO_APAGAR", "sem permissao tem codigo proprio", sp.code);
    checa(/instagram_manage_contents/.test(sp.message), "e a frase NOMEIA a permissao que falta");
    checa(/Permissões e recursos/.test(sp.message), "dizendo onde adicionar");
    checa(/Acesso Padrão basta/.test(sp.message), "e que NAO precisa de Analise do App (a conta e dele)");
    checa(/Tornar permanente/.test(sp.message), "com o passo do token ate o fim");
    const jaFoi = L(400, { error: { code: 100, message: "Object with ID '1' does not exist" } }, "1");
    checa(jaFoi.ok && jaFoi.ja_nao_existia, "post ja apagado pelo celular nao e erro, e o resultado");
    // "Unsupported delete request" é o que a Meta responde quando RECUSA a operação. Aceitar isso
    // como "já não existia" fazia o painel anunciar "apagado" com o post no ar — o pior desfecho:
    // a linha some do histórico e ninguém mais olha para o post.
    const recusa = L(400, { error: { code: 100, message: "(#100) Unsupported delete request" } }, "1");
    checa(!recusa.ok, "mas recusa da Meta NAO passa por 'ja nao existia'", recusa.code || "passou como ok");
    const srcP = fs.readFileSync(path.join(__dirname, "lib/publish.js"), "utf8");
    checa(/async function mediaAindaExiste\(/.test(srcP),
      "e depois de apagar o painel CONFERE se o post saiu mesmo");
    checa(/E_APAGAR_NAO_PEGOU/.test(srcP), "com codigo proprio quando ele continua la");
    checa(srcP.indexOf("Não tirei da lista") >= 0, "e sem tirar a linha da lista nesse caso");
    checa(srcP.indexOf("null = não deu para saber") >= 0,
      "consulta que falha nao vira 'o post sobreviveu' (seria travar a limpeza a toa)");
    checa(L(400, { error: { code: 190, message: "expired" } }, "1").code === "E_TOKEN", "token vencido tem saida propria");

    // -- 29b. Os dois caminhos existem, e sao diferentes -------------------
    const api = fs.readFileSync(path.join(__dirname, "public/js/api.js"), "utf8");
    checa(/no_instagram=1/.test(rota) && /no_instagram=1/.test(api),
      "a tela e a rota falam o mesmo idioma sobre APAGAR LA vs so tirar da lista");
    checa(/return res\.status\(e\.code === "E_SEM_PERMISSAO_APAGAR" \? 403 : 502\)/.test(rota),
      "se o Instagram recusou, a linha NAO some da lista (o post segue no ar)");
    checa(/Apagar do Instagram/.test(app) && /Só tirar desta lista/.test(app),
      "e a janela obriga a escolher qual dos dois");
    checa(/Não tem como desfazer|não tem como desfazer/.test(app), "avisando que apagar nao volta");
    // O cache do APLICATIVO do Instagram no celular continua mostrando o post por alguns minutos,
    // e atualizar a pagina nao limpa. Ninguem apaga esse cache de fora — ele e do app da Meta, no
    // aparelho. O que o painel pode fazer e tirar a duvida ANTES de a pessoa ir olhar.
    checa(app.indexOf("function confirmaSaidaDoAr(") >= 0, "apagou de verdade -> confirmacao que FICA na tela");
    checa(app.indexOf("este post não existe mais") >= 0, "dizendo que a saida foi conferida com a Meta");
    checa(app.indexOf("fechar o aplicativo por completo") >= 0, "e explicando o cache do celular antes de virar duvida");
    checa(app.indexOf("instagram.com, ele já não aparece") >= 0, "com um jeito de conferir sem o app");
    checa(/conferido: conferido/.test(rota) && /r.conferido/.test(app),
      "e a tela so afirma conferi quando a conferencia respondeu mesmo");

    // -- 29c. A peca volta a poder ser publicada ---------------------------
    checa(typeof cnt.clearPublished === "function", "existe o caminho que tira a marca de publicada");
    checa(/content\.clearPublished\(item\.folder/.test(rota),
      "e a rota o usa (senao a peca fica travada em 'ja publicado' para sempre)");
    checa(typeof pubs.remove === "function" && typeof pubs.get === "function",
      "e o historico sabe achar e tirar uma linha");
  }

  // ============================================================================
  // 30. Dashboard: as correções pontuais, sem redesenhar
  // ----------------------------------------------------------------------------
  // Cheguei a redesenhar esta tela inteira e o Hugo não gostou: perdeu as miniaturas da arte,
  // os ícones dos contadores e os atalhos que ele usava — ficou parecendo painel de sistema.
  // A tela ANTERIOR voltou, e o que entrou foram só as correções que ele aprovou, uma a uma.
  // ============================================================================
  {
    secao("30. Dashboard: correções pontuais, sem redesenhar");
    const app = fs.readFileSync(path.join(__dirname, "public/js/app.js"), "utf8");
    const css = fs.readFileSync(path.join(__dirname, "public/css/styles.css"), "utf8");
    const dash = (app.match(/async function viewDashboard\(\)[\s\S]*?\n\}/) || [""])[0];

    // -- 30a. A tela ANTERIOR está de volta, inteira -----------------------
    checa(dash.indexOf("Conteúdo recente") >= 0, "a lista 'Conteudo recente' voltou");
    checa(dash.indexOf("taskRow") >= 0, "com a MINIATURA da arte (era o que ele mais sentiu falta)");
    checa(dash.indexOf("dash-grade dash-acoes") >= 0, "os atalhos continuam — viraram faixa horizontal");
    checa(dash.indexOf("Criar conteúdo") >= 0 && dash.indexOf("Revisar") >= 0
      && dash.indexOf("Publicar ou agendar") >= 0 && dash.indexOf("Nova campanha") >= 0,
      "com os quatro caminhos do dia a dia — um por contador");
    checa(dash.indexOf("Mix de conteúdo") >= 0, "e o mix de conteudo tambem");
    checa(dash.indexOf("stat-ico") >= 0, "os contadores voltaram a ter icone");
    checa(dash.indexOf("dash-fila") < 0 && dash.indexOf("dash-alertas") < 0,
      "e nada do redesenho sobrou no JS");
    checa(css.indexOf(".dash-fila") < 0 && css.indexOf(".dash-2col") < 0,
      "nem no CSS (regra morta e a que ninguem apaga)");

    // -- 30b. Aprovada que JÁ FOI AO AR não é fila --------------------------
    // O cartão somava as duas coisas e a ação rápida prometia "prontas para publicar".
    checa(/const publicadas = aprovadas\.filter\(\(t\) => t\.published_at\)\.length/.test(dash),
      "o cartao desconta o que ja foi publicado");
    checa(dash.indexOf("prontas para publicar") >= 0, "e o rotulo do pipeline diz o que o numero e");
    checa(/const publicadas = aprovadas\.filter\(\(t\) => t\.published_at\)\.length/.test(dash),
      "as que ja sairam sao contadas — viram o segundo numero da razao");

    // -- 30c. O aviso que faltava: Instagram --------------------------------
    // Era o buraco da tela: o único alerta era sobre a chave de IA, e uma conexão expirada com
    // a Meta passava calada enquanto publicar rodava simulado.
    checa(/API\.publishStatus\(\)\.catch\(\(\) => null\)/.test(dash),
      "a tela pergunta o estado do Instagram");
    checa(/\.catch\(\(\) => null\)/.test(dash),
      "e degrada sozinha — sem resposta, o dashboard segue inteiro");
    checa(dash.indexOf("Instagram não conectado") >= 0, "avisa quando nao esta conectado");
    checa(dash.indexOf("roda em modo simulado") >= 0, "dizendo que publicar nao publica");
    checa(/igConnLabel\(ig\)/.test(dash), "e usa o MESMO estado que a janela de publicar usa");
    checa(/\$\{keyWarn\}\$\{igWarn\}/.test(dash), "os dois avisos ficam no mesmo lugar");

    // -- 30d. Os dois erros de leitura que vinham junto ---------------------
    const linhaDaPeca = (app.match(/function taskRow\(t\)[\s\S]*?\n\}/) || [""])[0];
    checa(/statusBadge\(effStatus\(t\.status, t\.published_at\)\)/.test(linhaDaPeca),
      "peca publicada mostra 'Publicado', nao 'Aprovado' (ja era assim nas outras duas telas)");
    const ordem = (dash.match(/const kindOrder = \[[^\]]*\]/) || [""])[0];
    checa(/"story"/.test(ordem) && /"media"/.test(ordem),
      "Story e Midia entram na ordem do mix (caiam no rabo da lista, e Midia e quase metade do acervo)", ordem.slice(18, 90));

    // -- 30e. O que as features NOVAS produziram, e a tela ignorava ---------
    // Publicacao com destino, agendamento e as artes que o squad manda chegaram DEPOIS desta
    // tela. Ela seguia contando peca como se nada disso existisse: dava para o Instagram ficar
    // semanas sem post, ou o squad mandar arte, sem nenhum sinal no painel de controle.
    checa(/API\.publications\(\)\.catch/.test(dash) && /API\.listSchedule\(\)\.catch/.test(dash)
      && /API\.squadStatus\(\)\.catch/.test(dash),
      "a tela passa a olhar historico, agendamento e squad");
    checa(dash.indexOf("<h2>Publicações</h2>") >= 0, "bloco Publicacoes: ha quanto tempo a conta nao posta");
    checa(dash.indexOf("em 30 dias") >= 0, "com o ritmo do mes");
    checa(dash.indexOf("Nada agendado") >= 0, "e o proximo agendamento");
    checa(/falhados\.length \? /.test(dash), "agendamento que FALHOU vira selo (senao some da vista)");
    checa(dash.indexOf("<h2>Chegando de fora</h2>") >= 0, "bloco do squad: quantas artes chegaram");
    checa(/sq\.entregas_falhas \? /.test(dash), "e quantas nao viraram peca");
    checa(dash.indexOf("Publicar ou agendar") >= 0,
      "o atalho de Publicacoes entrou nas acoes rapidas (era a unica tela do menu sem atalho)");
    checa(/\[ultimaHist, ultimaPeca\]/.test(dash),
      "a ultima publicacao soma historico E carimbo da peca (o historico comecou depois)");

    // -- 30f. O numero que nao batia com o destino --------------------------
    checa(/const noAcervo = tasks\.filter\(\(t\) => t\.zone !== "approved" && t\.status !== "rejected"\)/.test(dash),
      "'Pecas de conteudo' conta o que a tela de destino MOSTRA (dizia 20 e a tela abria com 15)");
    checa(/ICO_GRADE, noAcervo, "Em produção"/.test(dash), "e o cartao usa esse numero");
    checa(app.indexOf("function haQuantoTempo(") >= 0, "existe a conta de distancia no tempo");

    // -- 30g. A RAZAO, e a ordem do fluxo ----------------------------------
    // Uma peca fica aprovada E publicada ao mesmo tempo. O cartao mostrava
    // "Prontas para publicar 2 ja publicadas", como se fossem coisas separadas, quando a
    // segunda e parte da primeira. Virou razao: quanto do que passou pela aprovacao foi ao ar.
    checa(dash.indexOf("Aprovadas / publicadas") >= 0, "o cartao virou uma RAZAO");
    checa(dash.indexOf("aprovadasTotal + ") >= 0 && dash.indexOf("num-de") >= 0
      && dash.indexOf("+ publicadas,") >= 0, "aprovadas / publicadas, nessa ordem");
    checa(css.indexOf(".num-de") >= 0, "com a barra mais leve que os dois numeros");
    // A ordem segue o caminho da peca: em producao -> esperando OK -> aprovadas/publicadas.
    // A ordem dos CARTOES, nao das palavras: o comentario do codigo tambem cita os rotulos, e
    // procurar por texto solto media o comentario em vez da tela.
    const so = dash.slice(dash.indexOf(String.fromCharCode(60) + "div class=\"dash-grade\"" + String.fromCharCode(62)), dash.indexOf("dash-grade dash-acoes"));
    const i1 = so.indexOf("#/content\""), i2 = so.indexOf("#/content?status=in_review");
    const i3 = so.indexOf("#/approved"), i4 = so.indexOf("#/campaigns");
    checa(i1 >= 0 && i2 > i1 && i3 > i2 && i4 > i3,
      "e os contadores seguem o caminho da peca", [i1, i2, i3, i4].join(" < "));
    checa(dash.indexOf("dash-grade dash-acoes") >= 0 && css.indexOf(".dash-acao {") >= 0,
      "os atalhos viraram faixa logo abaixo dos numeros (estavam competindo em altura com a lista)");
    // A MESMA grade para numeros e acoes: e isso que faz cada acao cair sob o numero a que
    // responde. Grades separadas, com calhas diferentes, era o que deixava tudo solto.
    // indexOf, e nao regex: estas regras tem chave, barra e parenteses, e escapar tudo isso num
    // regex so cria oportunidade de errar o escape — ja aconteceu tres vezes nesta bateria.
    checa(css.indexOf(".dash-grade { display: grid; grid-template-columns: repeat(4") >= 0,
      "numeros e acoes na MESMA grade de 4 colunas");
    checa(css.indexOf(".dash-topo { display: flex; flex-direction: column; gap: var(--s3); }") >= 0,
      "e coladas num bloco de cabecalho, com folga menor entre si que para o resto");
    // Blocos EMPARELHADOS POR TAMANHO: dois longos numa linha, tres curtos na outra. Esticar
    // aqui e o certo — o par tem conteudo parecido, entao o estirao e de poucos pixels.
    checa(css.indexOf(".dash-par { align-items: stretch; }") >= 0, "os pares fecham a linha na mesma altura");
    checa(css.indexOf(".dash-par > .card > .mix { justify-content: space-between") >= 0,
      "e o bloco esticado DISTRIBUI o conteudo (nao amontoa em cima com vazio embaixo)");
    checa(dash.indexOf("grid grid-3 dash-par") >= 0, "os tres blocos curtos ficam em tres colunas");
  }

  criadas.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });
  srv.close();
  console.log("\n" + "=".repeat(64));
  console.log(falhas ? falhas + " FALHA(S) em " + total + " verificações" : "TODAS AS " + total + " VERIFICAÇÕES PASSARAM");
})().catch((e) => { console.error("ERRO:", e && e.stack); criadas.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }); srv.close(); process.exit(1); });
