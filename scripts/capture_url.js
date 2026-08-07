// Captura de página web -> PNG, via Playwright. Irmão do render_ad.js: mesma forma (processo
// separado, spawn, argv), mesma engine (Chromium), mesma ideia de deviceScaleFactor.
//
// Uso: node scripts/capture_url.js <url> <out.png> <width> <height> [scale] [fullPage]
// Exige a variável CAPTURE_PIN_IP com o IP já aprovado pelo lib/urlguard.js — o navegador é
// obrigado a falar com ESSE IP e não com o que o DNS devolver de novo daqui a três segundos.
//
// Isto existe porque a IA não navega. Quando o pedido é "use um print da nossa plataforma", ela não
// tem como olhar o site: escreve o nome de um arquivo plausível que não existe, e a peça sai sem a
// imagem. Aqui o print é tirado de verdade, do endereço que a pessoa colou.
const { chromium } = require("playwright");
const path = require("path");
const guard = require(path.join(__dirname, "..", "interface", "lib", "urlguard"));

(async () => {
  const url = process.argv[2];
  const outPath = path.resolve(process.argv[3] || "capture.png");
  const width = parseInt(process.argv[4] || "1440", 10);
  const height = parseInt(process.argv[5] || "900", 10);
  const scale = parseFloat(process.argv[6] || "2") || 2;
  const fullPage = String(process.argv[7] || "") === "1";
  const pinIp = process.env.CAPTURE_PIN_IP || "";

  if (!url) { console.error("FALHA: falta a URL"); process.exit(2); }
  if (!pinIp) { console.error("FALHA: falta CAPTURE_PIN_IP (endereço não foi verificado)"); process.exit(2); }

  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");

  // MAP fixa o nome no IP aprovado; EXCLUDE localhost impede que uma regra de sistema reintroduza
  // a máquina local por outro caminho.
  const browser = await chromium.launch({
    args: ["--host-resolver-rules=MAP " + host + " " + pinIp + ", EXCLUDE localhost"],
  });
  let saiu = 0;
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale,
      // Um user agent honesto de navegador: várias páginas entregam uma versão degradada (ou um
      // muro) para cliente sem UA. Não estamos nos disfarçando de pessoa — só pedindo o HTML normal.
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      locale: "pt-BR",
    });

    // Sub-recursos da página: a página pode pedir o que quiser, menos endereço interno escrito na
    // mão. Sem este filtro, um <img src="http://169.254.169.254/..."> desenharia o segredo da nuvem
    // dentro do PNG que a pessoa baixa.
    await page.route("**/*", (route) => {
      const u = route.request().url();
      if (guard.pedidoPermitido(u)) return route.continue();
      return route.abort();
    });

    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Redirecionamento: o endereço final pode não ser o que foi aprovado. Rechecar o destino real.
    const finalUrl = page.url();
    const finalHost = new URL(finalUrl).hostname.replace(/^\[|\]$/g, "");
    if (finalHost !== host) {
      const v = await guard.verifica(finalUrl);
      if (!v.ok) { console.error("FALHA: o site redirecionou para um destino não permitido — " + v.motivo); process.exit(3); }
    }
    if (resp && resp.status() >= 400) {
      console.error("FALHA: a página respondeu " + resp.status() + " (" + (resp.status() === 404 ? "página não encontrada" : "erro do site") + ")");
      process.exit(4);
    }

    // Deixar carregar sem exigir silêncio total de rede: página de notícia tem anúncio e telemetria
    // que nunca param, e networkidle nunca chegaria.
    try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch (e) {}
    try { await page.evaluate(() => document.fonts.ready); } catch (e) {}

    // Aviso de cookies tapa a matéria e é o motivo nº1 de print inútil. Some com as camadas fixas
    // que se parecem com banner de consentimento, sem tocar no conteúdo.
    try {
      await page.addStyleTag({ content: [
        "[id*='cookie' i],[class*='cookie' i],[id*='consent' i],[class*='consent' i],",
        "[id*='lgpd' i],[class*='lgpd' i],[aria-label*='cookie' i],[class*='onetrust' i],[id*='onetrust' i],",
        "[class*='paywall' i] ~ [class*='overlay' i]",
        "{display:none !important;visibility:hidden !important;}",
        "html{scroll-behavior:auto !important;}",
      ].join("") });
    } catch (e) {}
    try { await page.keyboard.press("Escape"); } catch (e) {}

    // Imagens acima da dobra: rolar até o fim e voltar dispara o carregamento preguiçoso, senão o
    // print sai com buracos cinza no lugar das fotos.
    try {
      await page.evaluate(async () => {
        const passo = Math.max(200, window.innerHeight / 2);
        for (let y = 0; y < document.body.scrollHeight && y < 12000; y += passo) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
    } catch (e) {}
    await page.waitForTimeout(600);

    const titulo = (await page.title().catch(() => "")) || "";
    await page.screenshot(fullPage ? { path: outPath, fullPage: true } : { path: outPath, clip: { x: 0, y: 0, width, height } });
    console.log("TITULO " + titulo.replace(/[\r\n]+/g, " ").slice(0, 200));
    console.log("URLFINAL " + finalUrl.slice(0, 500));
    console.log("OK -> " + outPath + " (" + width + "x" + height + " @" + scale + "x)");
  } catch (err) {
    console.error("FALHA: " + (err && err.message ? err.message : String(err)));
    saiu = 1;
  } finally {
    try { await browser.close(); } catch (e) {}
  }
  process.exit(saiu);
})().catch((err) => {
  console.error("FALHA: " + err.message);
  process.exit(1);
});
