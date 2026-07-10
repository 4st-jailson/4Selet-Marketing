// Render de static ad via Playwright (HTML -> PNG). Usado pela skill ad-creative-designer.
// Uso: node scripts/render_ad.js <html_path> <out_png> [width] [height] [scale]
// Defaults: paths do dry-run test_job_payload_1, 1080x1080, scale 1. Local, sem chaves externas.
// [scale] = deviceScaleFactor: 1 = resolucao base (1080); 2 = alta resolucao (2160px) p/ download.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { fileURLToPath } = require("url");

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
  // Seguranca (RENDER_STRICT_NET=1, usado no editor HTML com conteudo nao confiavel):
  // bloqueia TODA requisicao externa — so permite fontes do Google, data:/blob: e
  // arquivos file:// DENTRO da raiz do projeto. Impede SSRF (ex.: 169.254.169.254) e
  // leitura/exfiltracao de arquivos locais fora do projeto a partir do HTML renderizado.
  if (process.env.RENDER_STRICT_NET === "1") {
    const root = path.resolve(process.cwd());
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
      if (/^file:/i.test(url)) {
        try {
          const p = path.resolve(fileURLToPath(url));
          if (p === root || p.startsWith(root + path.sep)) return route.continue();
        } catch (e) { /* url invalida -> aborta */ }
        return route.abort();
      }
      return route.abort();
    });
  }
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

  // --- Item A: "mapa editavel" (manifesto dos elementos + fundo sem os textos) ---
  // Emitido so para as ARTES FINAIS (ad/feed/slide_N). O editor visual reconstroi
  // cada elemento como objeto movivel/redimensionavel a partir deste manifesto.
  const base = path.basename(outPath).toLowerCase();
  const isFinalArt = /^(ad|feed)\.png$/.test(base) || /^slide_0*\d+\.png$/.test(base);
  if (isFinalArt) {
    try {
      const manifest = await page.evaluate(({ W, H }) => {
        const INLINE = ["SPAN", "B", "I", "EM", "STRONG", "BR", "A", "SUP", "SUB", "SMALL", "MARK", "U"];
        const inlineOnly = (el) => Array.from(el.children).every((c) => INLINE.includes(c.tagName));
        const effOpacity = (el) => { let o = 1, e = el; while (e && e !== document.body) { o *= (parseFloat(getComputedStyle(e).opacity || "1") || 1); e = e.parentElement; } return Math.round(o * 1000) / 1000; };
        const out = [];
        Array.from(document.querySelectorAll("body *")).forEach((el) => {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity || "1") === 0) return;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4 || r.left >= W || r.top >= H || r.right <= 0 || r.bottom <= 0) return;
          if (el.tagName === "IMG") {
            el.setAttribute("data-cap", "1");
            out.push({ kind: "image", src: el.getAttribute("src"), x: r.left, y: r.top, w: r.width, h: r.height, opacity: effOpacity(el) });
            return;
          }
          const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (!txt) return;
          const parentIsTextBlock = el.parentElement && inlineOnly(el.parentElement) && (el.parentElement.textContent || "").trim();
          if (!inlineOnly(el) || parentIsTextBlock) return; // captura so o bloco de texto mais externo
          el.setAttribute("data-cap", "1");
          out.push({
            kind: "text", text: el.textContent.trim(), x: r.left, y: r.top, w: r.width, h: r.height,
            fontSize: parseFloat(cs.fontSize) || 40,
            fontFamily: (cs.fontFamily || "Inter").split(",")[0].replace(/['"]/g, "").trim(),
            fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, fill: cs.color, textAlign: cs.textAlign,
            lineHeight: parseFloat(cs.lineHeight) / (parseFloat(cs.fontSize) || 40) || 1.16,
            charSpacing: cs.letterSpacing === "normal" ? 0 : Math.round((parseFloat(cs.letterSpacing) || 0) / (parseFloat(cs.fontSize) || 40) * 1000),
            uppercase: cs.textTransform === "uppercase", opacity: effOpacity(el),
          });
        });
        return { w: W, h: H, elements: out };
      }, { W: width, H: height });
      const stem = outPath.replace(/\.png$/i, "");
      fs.writeFileSync(stem + ".editable.json", JSON.stringify(manifest));
      // fundo SEM os elementos capturados (mantem gradiente/dots) -> camada de fundo do editor
      await page.addStyleTag({ content: "[data-cap]{visibility:hidden !important;}" });
      await page.waitForTimeout(50);
      await page.screenshot({ path: stem + ".bg.png", clip: { x: 0, y: 0, width, height } });
      console.log("MAP -> " + stem + ".editable.json (" + manifest.elements.length + " elementos) + .bg.png");
    } catch (e) { console.error("manifest-warn:", e.message); }
  }
  await browser.close();
  console.log("OK -> " + outPath + " (" + width + "x" + height + " @" + scale + "x)");
})().catch((err) => {
  console.error("FALHA:", err.message);
  process.exit(1);
});
