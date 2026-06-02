// Render de static ad via Playwright (HTML -> PNG). Usado pela skill ad-creative-designer.
// Uso: node scripts/render_ad.js <html_path> <out_png> [width] [height]
// Defaults: paths do dry-run test_job_payload_1, 1080x1080. Local, sem chaves externas.
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
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.goto(fileUrl, { waitUntil: "networkidle" });
  try {
    await page.evaluate(() => document.fonts.ready);
  } catch (e) {}
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width, height } });
  await browser.close();
  console.log("OK -> " + outPath + " (" + width + "x" + height + ")");
})().catch((err) => {
  console.error("FALHA:", err.message);
  process.exit(1);
});
