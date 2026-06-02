// render_ad.js — empacotado com a skill ad-creative-designer (persiste com a skill).
// HTML -> PNG via Playwright. Rodar a partir da RAIZ do projeto.
// Uso: node skills/ad-creative-designer/scripts/render_ad.js <html_path> <out_png> [width] [height]
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  if (!process.argv[2] || !process.argv[3]) {
    console.error(
      "Uso: node skills/ad-creative-designer/scripts/render_ad.js <html_path> <out_png> [width] [height]"
    );
    process.exit(2);
  }
  const htmlPath = path.resolve(process.argv[2]);
  const outPath = path.resolve(process.argv[3]);
  const width = parseInt(process.argv[4] || "1080", 10);
  const height = parseInt(process.argv[5] || "1080", 10);
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.goto(fileUrl, { waitUntil: "networkidle" });

  // Step 8.4 - aguardar fontes E todas as imagens decodificarem antes do screenshot.
  try {
    await page.evaluate(() => document.fonts.ready);
  } catch (e) {}
  try {
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : img.decode().catch(() => {})
        )
      );
    });
  } catch (e) {}
  await page.waitForTimeout(200);

  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width, height } });
  await browser.close();
  console.log("OK -> " + outPath + " (" + width + "x" + height + ")");
})().catch((err) => {
  console.error("FALHA:", err.message);
  process.exit(1);
});
