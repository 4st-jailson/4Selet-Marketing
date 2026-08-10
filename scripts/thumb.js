// Gera a MINIATURA de uma arte já renderizada. Uso:
//   node scripts/thumb.js <arte.png> <saida.jpg> [largura]
//
// Por que existe: a biblioteca de conteúdo mostrava a arte INTEIRA (2160×2700, até 3,3 MB) num
// cartão de 255×191 — o navegador baixava 72 vezes mais pixels do que ia desenhar. Medido em
// produção: 21 MB só para abrir a tela de Conteúdo.
//
// Por que Chromium e não uma biblioteca de imagem: o projeto não tem nenhuma instalada (nem sharp,
// nem jimp), e o Chromium do Playwright já é dependência daqui — é ele que renderiza toda arte.
// Trazer uma dependência nativa nova para redimensionar seria custo de build sem ganho.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const src = path.resolve(process.argv[2] || "");
  const out = path.resolve(process.argv[3] || "");
  const largura = Math.max(64, Math.min(1200, parseInt(process.argv[4] || "440", 10) || 440));
  let st = null;
  try { st = fs.statSync(src); } catch (e) {}
  if (!st || !st.isFile()) { console.error("FALHA: arte de origem não encontrada"); process.exit(2); }

  // A página precisa ser um ARQUIVO, não setContent: uma página about:blank não tem permissão
  // para carregar uma imagem file:// — o Chromium bloqueia e a espera estoura no tempo limite.
  // É o mesmo caminho que scripts/render_ad.js usa para renderizar a arte.
  const paginaTmp = out + ".html";
  fs.writeFileSync(paginaTmp, '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0c2530">'
    + '<img id="a" src="file:///' + src.replace(/\\/g, "/") + '" style="display:block;width:' + largura + 'px;height:auto">'
    + "</body>", "utf8");

  const browser = await chromium.launch();
  try {
    // Viewport provisório: a altura certa só se sabe depois de medir a imagem.
    const page = await browser.newPage({ viewport: { width: largura, height: largura }, deviceScaleFactor: 1 });
    await page.goto("file:///" + paginaTmp.replace(/\\/g, "/"), { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => { const i = document.getElementById("a"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 });
    const alt = await page.evaluate(() => Math.round(document.getElementById("a").getBoundingClientRect().height));
    await page.setViewportSize({ width: largura, height: Math.max(1, alt) });
    await page.waitForTimeout(60);
    // JPEG: a arte é uma composição fotográfica/gráfica, não um ícone com transparência. A 80 de
    // qualidade a miniatura fica indistinguível no tamanho em que é exibida, por uma fração dos bytes.
    await page.screenshot({ path: out, type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: largura, height: Math.max(1, alt) } });
    const bytes = fs.statSync(out).size;
    console.log("OK " + largura + "x" + alt + " " + bytes);
  } catch (err) {
    console.error("FALHA: " + (err && err.message ? err.message : String(err)));
    try { await browser.close(); } catch (e) {}
    try { fs.unlinkSync(paginaTmp); } catch (e) {}
    process.exit(1);
  }
  await browser.close();
  try { fs.unlinkSync(paginaTmp); } catch (e) {}
})().catch((err) => { console.error("FALHA: " + err.message); process.exit(1); });
