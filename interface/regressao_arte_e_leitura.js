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
  await b.close();

  criadas.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });
  srv.close();
  console.log("\n" + "=".repeat(64));
  console.log(falhas ? falhas + " FALHA(S) em " + total + " verificações" : "TODAS AS " + total + " VERIFICAÇÕES PASSARAM");
})().catch((e) => { console.error("ERRO:", e && e.stack); criadas.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }); srv.close(); process.exit(1); });
