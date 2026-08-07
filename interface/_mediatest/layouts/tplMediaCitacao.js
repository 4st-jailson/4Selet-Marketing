function tplMediaCitacao({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const W = Number(width) || 1080;
  const H = Number(height) || 1350;
  const land = W > H;
  const MIN = Math.min(W, H);
  const MAX = Math.max(W, H);

  const src = image ? resolveImage(image) : '';
  const hasImg = !!src;
  const quote = String(headline || '').trim();
  const hasQuote = !!quote;

  const logo = logoSrc(logoVariant, LOGO_LIGHT);
  const P = PALETTE;

  const veiculo = String(eyebrow || '').split(/[·|]/)[0].trim();
  const domain = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\.|\/$/, '');
  const hasDomain = !!domain;

  // scaling refs
  const padX = Math.round(W * 0.06);
  const topSafe = Math.round(H * 0.12);
  const botSafe = Math.round(H * 0.135);
  const logoH = Math.round(MIN * 0.04);

  // typography
  const eyeSize = Math.round(MIN * 0.018);
  const brandSize = Math.round(MIN * 0.028);
  const veiculoSize = Math.round(MIN * 0.026);
  const ctaTopSize = Math.round(MIN * 0.017);
  const ctaDomSize = Math.round(MIN * 0.022);

  // quote sizing: bigger in portrait, moderate in landscape
  const qLen = quote.length;
  let quoteBase = land ? MIN * 0.052 : MIN * 0.06;
  if (qLen > 90) quoteBase *= 0.82;
  else if (qLen > 60) quoteBase *= 0.9;
  const quoteSize = Math.round(quoteBase);
  const bigMarkSize = Math.round(MIN * (land ? 0.2 : 0.24));

  // circuit graphism nodes
  const circuit = `
    <g stroke="${P.sky}" stroke-width="${Math.max(1, Math.round(MIN * 0.0016))}" fill="none" opacity="0.12">
      <path d="M ${W * 0.05} ${H * 0.3} H ${W * 0.28} V ${H * 0.46} H ${W * 0.4}"/>
      <path d="M ${W * 0.62} ${H * 0.62} H ${W * 0.8} V ${H * 0.78} H ${W * 0.95}"/>
      <path d="M ${W * 0.72} ${H * 0.16} V ${H * 0.32} H ${W * 0.9}"/>
      <path d="M ${W * 0.1} ${H * 0.7} V ${H * 0.86} H ${W * 0.34}"/>
      <circle cx="${W * 0.28}" cy="${H * 0.3}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.4}" cy="${H * 0.46}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.8}" cy="${H * 0.62}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.9}" cy="${H * 0.32}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.34}" cy="${H * 0.86}" r="${MIN * 0.007}"/>
      <circle cx="${W * 0.72}" cy="${H * 0.16}" r="${MIN * 0.007}"/>
    </g>`;

  // topbar (brand frame)
  const topbar = `
    <div style="position:absolute;top:${Math.round(H * 0.045)}px;left:${padX}px;right:${padX}px;display:flex;align-items:center;justify-content:space-between;">
      <img src="${escAttr(logo)}" style="height:${logoH}px;width:auto;display:block;" />
      <div style="display:flex;align-items:center;gap:${Math.round(MIN * 0.014)}px;">
        <span style="font-family:'Inter',sans-serif;font-size:${brandSize}px;line-height:1;">
          <span style="font-weight:800;color:#fff;">4Selet</span>
          <span style="font-weight:700;color:${P.sky};"> na mídia</span>
        </span>
        <span style="display:block;width:${Math.max(2, Math.round(MIN * 0.004))}px;height:${Math.round(brandSize * 1.25)}px;background:${P.sky};border-radius:2px;"></span>
      </div>
    </div>`;

  // footer left card + right CTA
  const footerCard = `
    <div style="display:inline-flex;align-items:center;background:#fff;border-radius:${Math.round(MIN * 0.02)}px;padding:${Math.round(MIN * 0.016)}px ${Math.round(MIN * 0.026)}px;box-shadow:0 ${Math.round(MIN * 0.008)}px ${Math.round(MIN * 0.024)}px rgba(0,0,0,0.28);">
      <span style="font-family:'Inter',sans-serif;font-weight:800;color:${P.navy};font-size:${veiculoSize}px;line-height:1;letter-spacing:-0.01em;">${esc(veiculo)}</span>
    </div>`;

  const ctaRight = hasDomain ? `
    <div style="display:flex;align-items:center;gap:${Math.round(MIN * 0.018)}px;">
      <div style="text-align:right;">
        <div style="font-family:'JetBrains Mono',monospace;font-weight:500;color:${P.cloud};font-size:${ctaTopSize}px;line-height:1;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:${Math.round(MIN * 0.008)}px;">Leia a matéria completa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:700;color:${P.sky};font-size:${ctaDomSize}px;line-height:1;">${esc(domain)}</div>
      </div>
      <div style="flex:0 0 auto;width:${Math.round(MIN * 0.058)}px;height:${Math.round(MIN * 0.058)}px;border-radius:50%;border:${Math.max(2, Math.round(MIN * 0.003))}px solid ${P.sky};display:flex;align-items:center;justify-content:center;">
        <span style="font-family:'Inter',sans-serif;color:${P.sky};font-size:${Math.round(MIN * 0.036)}px;line-height:1;font-weight:700;margin-top:-${Math.round(MIN * 0.004)}px;">›</span>
      </div>
    </div>` : '';

  const footer = `
    <div style="position:absolute;bottom:${Math.round(H * 0.05)}px;left:${padX}px;right:${padX}px;display:flex;align-items:center;justify-content:space-between;gap:${padX}px;">
      ${footerCard}
      ${ctaRight}
    </div>`;

  // thumbnail (small straight print card)
  const thumbCard = (w, h) => hasImg ? `
    <div style="width:${w}px;height:${h}px;border-radius:${Math.round(MIN * 0.016)}px;overflow:hidden;box-shadow:0 ${Math.round(MIN * 0.01)}px ${Math.round(MIN * 0.03)}px rgba(0,0,0,0.4);border:${Math.max(1, Math.round(MIN * 0.002))}px solid rgba(255,255,255,0.12);flex:0 0 auto;">
      <img src="${escAttr(src)}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;" />
    </div>` : '';

  // ===== central content =====
  let center;

  if (hasQuote) {
    // big decorative quote mark + headline as editorial quote + attribution + thumbnail
    const bigMark = `<div style="font-family:'Inter',sans-serif;font-weight:800;color:${P.sky};font-size:${bigMarkSize}px;line-height:0.7;opacity:0.9;height:${Math.round(bigMarkSize * 0.55)}px;overflow:hidden;">“</div>`;
    const attribution = `<div style="font-family:'Inter',sans-serif;font-weight:700;color:${P.sky};font-size:${Math.round(MIN * 0.026)}px;line-height:1;margin-top:${Math.round(MIN * 0.03)}px;">— ${esc(veiculo)}</div>`;
    const quoteBlock = `<div style="font-family:'Inter',sans-serif;font-weight:800;color:#fff;font-size:${quoteSize}px;line-height:1.18;letter-spacing:-0.015em;max-width:100%;">${esc(quote)}”</div>`;

    if (land) {
      const thW = Math.round(W * 0.26);
      const thH = Math.round(thW * 1.15);
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;align-items:center;gap:${Math.round(W * 0.05)}px;">
          <div style="flex:1 1 auto;min-width:0;">
            ${bigMark}
            ${quoteBlock}
            ${attribution}
          </div>
          ${thumbCard(thW, thH)}
        </div>`;
    } else {
      const thW = Math.round(W * 0.4);
      const thH = Math.round(thW * 0.72);
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;flex-direction:column;justify-content:center;">
          ${bigMark}
          ${quoteBlock}
          ${attribution}
          <div style="margin-top:${Math.round(MIN * 0.05)}px;">${thumbCard(thW, thH)}</div>
        </div>`;
    }
  } else {
    // fallback: large straight print card centered, no invented text
    if (hasImg) {
      let cW, cH;
      if (land) {
        cH = Math.round((H - topSafe - botSafe) * 0.92);
        cW = Math.round(cH * 1.25);
        if (cW > W - padX * 2) { cW = Math.round(W * 0.6); cH = Math.round(cW * 0.8); }
      } else {
        cW = Math.round(W - padX * 2);
        cH = Math.round((H - topSafe - botSafe) * 0.9);
      }
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;align-items:center;justify-content:center;">
          <div style="width:${cW}px;height:${cH}px;border-radius:${Math.round(MIN * 0.02)}px;overflow:hidden;box-shadow:0 ${Math.round(MIN * 0.014)}px ${Math.round(MIN * 0.04)}px rgba(0,0,0,0.45);border:${Math.max(1, Math.round(MIN * 0.0025))}px solid rgba(255,255,255,0.14);">
            <img src="${escAttr(src)}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;" />
          </div>
        </div>`;
    } else {
      const bigMark = `<div style="font-family:'Inter',sans-serif;font-weight:800;color:${P.sky};font-size:${bigMarkSize}px;line-height:0.7;">“</div>`;
      center = `
        <div style="position:absolute;left:${padX}px;right:${padX}px;top:${topSafe}px;bottom:${botSafe}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;">
          ${bigMark}
          <div style="font-family:'Inter',sans-serif;font-weight:800;color:#fff;font-size:${Math.round(MIN * 0.04)}px;line-height:1.2;">${esc(veiculo)}</div>
        </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
${FONT_LINK}
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;}
  body{overflow:hidden;background:${P.navy};}
  .stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;
    background:radial-gradient(128% 118% at 78% 6%, ${P.blue} 0%, ${P.navy} 45%, ${P.darker} 100%);}
  .circuit{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
</style>
</head>
<body>
  <div class="stage">
    <svg class="circuit" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${circuit}</svg>
    ${topbar}
    ${center}
    ${footer}
  </div>
</body>
</html>`;
}