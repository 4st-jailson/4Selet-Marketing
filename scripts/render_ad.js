// Render de static ad via Playwright (HTML -> PNG). Usado pela skill ad-creative-designer.
// Uso: node scripts/render_ad.js <html_path> <out_png> [width] [height] [scale]
// Defaults: paths do dry-run test_job_payload_1, 1080x1080, scale 1. Local, sem chaves externas.
// [scale] = deviceScaleFactor: 1 = resolucao base (1080); 2 = alta resolucao (2160px) p/ download.
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const htmlPath = path.resolve(
    process.argv[2] || "outputs/test_job_payload_1/ads/ad.html"
  );
  const outPath = path.resolve(
    process.argv[3] || "outputs/test_job_payload_1/ads/instagram_ad.png"
  );
  const width = parseInt(process.argv[4] || "1080", 10);
  const height = parseInt(process.argv[5] || "1080", 10);
  // deviceScaleFactor: rasteriza a NxN do tamanho CSS. O layout (px CSS) nao muda;
  // so a nitidez/resolucao do PNG final. 2 => 2x os pixels (ex.: 2160x2160).
  const scale = parseFloat(process.argv[6] || "1") || 1;
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await page.goto(fileUrl, { waitUntil: "networkidle" });
  try {
    await page.evaluate(() => document.fonts.ready);
  } catch (e) {}
  // Aguardar todas as imagens (logo etc.) decodificarem antes do screenshot —
  // evita capturar a arte antes de o logo carregar.
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
  console.log("OK -> " + outPath + " (" + width + "x" + height + " @" + scale + "x)");
})().catch((err) => {
  console.error("FALHA:", err.message);
  process.exit(1);
});
