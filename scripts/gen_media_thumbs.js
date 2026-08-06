#!/usr/bin/env node
// scripts/gen_media_thumbs.js — gera as MINIATURAS dos modelos de "4Selet na Mídia".
//
// Por que existe: no seletor de modelo o usuário via só um ícone esquemático (um retângulo
// com cantos) e não tinha como saber o que cada modelo faz com a arte. Agora ele vê uma
// miniatura da peça de verdade — gerada pelo MESMO tplMedia que produz a arte final, então a
// miniatura nunca mente sobre o resultado.
//
// Rode de novo sempre que mexer nos templates de mídia:
//   node scripts/gen_media_thumbs.js
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { tplMedia } = require("../interface/lib/render");

const SAIDA = path.join(__dirname, "..", "interface", "public", "img", "media-models");
// Os tres foto-reais sairam da lista: foram reprovados e nao aparecem mais no seletor.
// O render deles continua existindo para as pecas antigas, mas nao ha mais o que pre-visualizar.
const MODELOS = [
  "hand_tablet", "celular", "notebook", "navegador",
  "citacao", "selo", "split", "camadas",
];

// Print de EXEMPLO: uma página de notícia genérica. Sem ele os templates desenham o
// placeholder de "tela vazia", que ocupa a peça inteira e esconde justamente o que a
// miniatura precisa mostrar — o aparelho, a cena e o enquadramento de cada modelo.
const PRINT_EXEMPLO = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:900px;height:1200px;background:#fff;font-family:'Inter',sans-serif;padding:52px 56px}
  .top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #111;padding-bottom:16px}
  .marca{font-size:34px;font-weight:800;letter-spacing:-1px;color:#111}
  .secao{font-size:17px;color:#8a8a8a;letter-spacing:2px;text-transform:uppercase}
  h1{font-size:62px;line-height:1.06;color:#111;margin:34px 0 20px;font-weight:800;letter-spacing:-1.5px}
  .sub{font-size:26px;line-height:1.45;color:#555;margin-bottom:30px}
  .foto{height:330px;background:linear-gradient(135deg,#d8dee3,#b9c3cb);border-radius:4px;margin-bottom:30px}
  .col{column-count:2;column-gap:38px}
  .l{height:15px;background:#e3e6e9;border-radius:3px;margin-bottom:15px}
  .l.c{width:72%}
</style></head><body>
  <div class="top"><span class="marca">Jornal</span><span class="secao">Economia</span></div>
  <h1>A manchete da matéria aparece aqui, em duas linhas</h1>
  <div class="sub">A linha de apoio da reportagem entra logo abaixo do título, com o resumo do assunto.</div>
  <div class="foto"></div>
  <div class="col">
    ${Array.from({ length: 16 }).map((_, i) => '<div class="l' + (i % 5 === 4 ? " c" : "") + '"></div>').join("")}
  </div>
</body></html>`;

// Conteúdo neutro: a miniatura mostra o LAYOUT, não uma matéria específica.
const DADOS = {
  eyebrow: "Veículo",
  url: "veiculo.com.br",
  headline: "A manchete da matéria aparece aqui",
  logo: "light",
};

// Arte 1080x1350 (o formato publicável). A miniatura sai em 2x de 132x165 para ficar nítida
// em tela retina sem pesar: cada arquivo dá poucos KB.
const LARG = 132, ALT = 165;

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });

  // 1) desenha o print de exemplo e guarda como data URI (o resolveImage aceita data:)
  await pagina.setViewportSize({ width: 900, height: 1200 });
  await pagina.setContent(PRINT_EXEMPLO, { waitUntil: "load" });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(300);
  const printBuf = await pagina.screenshot({ clip: { x: 0, y: 0, width: 900, height: 1200 } });
  DADOS.image = "data:image/png;base64," + printBuf.toString("base64");
  fs.writeFileSync(path.join(SAIDA, "_print-exemplo.png"), printBuf);
  console.log("  print de exemplo gerado (" + Math.round(printBuf.length / 1024) + " KB)\n");
  await pagina.setViewportSize({ width: 1080, height: 1350 });

  let feitas = 0;
  // O HTML vai para um ARQUIVO e é aberto por file:// — não por setContent. Página criada com
  // setContent não tem origem, e o Chromium bloqueia sub-recursos file:// nesse caso: as fotos
  // de cena dos modelos foto-reais não carregavam e a miniatura saía sem a cena, mostrando só o
  // print solto. É a mesma razão pela qual o render de produção abre um arquivo.
  const tmpHtml = path.join(SAIDA, "_tmp-thumb.html");
  for (const modelo of MODELOS) {
    const html = tplMedia(Object.assign({ width: 1080, height: 1350, model: modelo }, DADOS));
    fs.writeFileSync(tmpHtml, html);
    await pagina.goto("file:///" + tmpHtml.split(path.sep).join("/"), { waitUntil: "load" });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => {}))));
    await pagina.waitForTimeout(250);
    const destino = path.join(SAIDA, modelo + ".png");
    await pagina.screenshot({ path: destino, clip: { x: 0, y: 0, width: 1080, height: 1350 }, scale: "css" });
    // reduz para o tamanho de exibição (2x) usando o próprio navegador — evita dependência nova
    const png = fs.readFileSync(destino).toString("base64");
    await pagina.setContent(`<body style="margin:0"><img id="i" src="data:image/png;base64,${png}" style="width:${LARG * 2}px;height:${ALT * 2}px;display:block"/></body>`, { waitUntil: "load" });
    await pagina.waitForTimeout(80);
    await pagina.locator("#i").screenshot({ path: destino });
    feitas++;
    console.log("  " + modelo.padEnd(16) + " -> " + path.relative(process.cwd(), destino) + " (" + Math.round(fs.statSync(destino).size / 1024) + " KB)");
  }
  try { fs.unlinkSync(tmpHtml); } catch (e) {}
  await navegador.close();
  console.log("\n" + feitas + " miniaturas geradas em " + path.relative(process.cwd(), SAIDA));
})().catch((e) => { console.error("falhou:", e && e.message); process.exit(1); });
