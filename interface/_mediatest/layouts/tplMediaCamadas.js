function tplMediaCamadas({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const W = width, H = height;
  const land = W > H;
  const mn = Math.min(W, H);
  const dom = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\./, '');
  const veiculo = String(eyebrow || '').split(/[·|]/)[0].trim();
  const brandTop = String(eyebrow || '').trim();
  const src = image ? resolveImage(image) : '';
  const logo = logoSrc(logoVariant, LOGO_LIGHT);

  const P = PALETTE;
  const pad = Math.round(mn * 0.06);
  const topH = Math.round(H * 0.12);
  const botH = Math.round(H * 0.135);
  const safeTop = topH;
  const safeBot = botH;
  const safeH = H - safeTop - safeBot;
  const safeW = W - pad * 2;

  const logoH = Math.round(mn * 0.04);
  const eyebrowFont = Math.round(mn * 0.018);
  const brandFont = Math.round(mn * 0.026);
  const veicFont = Math.round(mn * 0.026);
  const ctaTopFont = Math.round(mn * 0.016);
  const ctaDomFont = Math.round(mn * 0.021);
  const arrowR = Math.round(mn * 0.032);

  // ---- área central: camadas ----
  // Em paisagem: texto à esquerda, camadas à direita.
  // Em retrato: camadas ocupam a área segura central.
  let stageW, stageH, stageLeft, stageTop, textBlock = '';

  if (land) {
    const colGap = Math.round(safeW * 0.05);
    const textW = Math.round(safeW * 0.42);
    stageW = safeW - textW - colGap;
    stageH = safeH;
    stageLeft = pad + textW + colGap;
    stageTop = safeTop;

    const kFont = Math.round(mn * 0.052);
    if (headline) {
      textBlock = `
      <div style="position:absolute;left:${pad}px;top:${safeTop}px;width:${textW}px;height:${safeH}px;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:${eyebrowFont}px;letter-spacing:.18em;text-transform:uppercase;color:${P.sky};margin-bottom:${Math.round(mn*0.024)}px;">Na imprensa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:800;font-size:${kFont}px;line-height:1.08;color:#fff;letter-spacing:-.01em;">${esc(headline)}</div>
        <div style="width:${Math.round(mn*0.09)}px;height:${Math.round(mn*0.006)}px;background:${P.sky};border-radius:99px;margin-top:${Math.round(mn*0.03)}px;"></div>
      </div>`;
    } else {
      textBlock = `
      <div style="position:absolute;left:${pad}px;top:${safeTop}px;width:${textW}px;height:${safeH}px;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:${eyebrowFont}px;letter-spacing:.18em;text-transform:uppercase;color:${P.sky};margin-bottom:${Math.round(mn*0.028)}px;">Na imprensa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:800;font-size:${Math.round(mn*0.06)}px;line-height:1.05;color:#fff;letter-spacing:-.01em;">Cobertura<br/>na imprensa</div>
        <div style="width:${Math.round(mn*0.09)}px;height:${Math.round(mn*0.006)}px;background:${P.sky};border-radius:99px;margin-top:${Math.round(mn*0.03)}px;"></div>
      </div>`;
    }
  } else {
    stageW = safeW;
    stageH = safeH;
    stageLeft = pad;
    stageTop = safeTop;
  }

  // Card frontal e traseiro dentro do stage.
  // Ratio dos cards: aproxima o print (retrato-ish). Front maior, back deslocado atrás.
  const cardAspect = land ? (stageW * 0.72) / stageH : stageW / (stageH * 0.82) > 0 ? null : null;

  // Dimensiona o card frontal para caber deixando espaço para o deslocamento do de trás.
  const offX = Math.round(mn * 0.045);
  const offY = Math.round(mn * 0.05);

  let frontW, frontH;
  if (land) {
    frontH = Math.round(stageH * 0.86);
    frontW = Math.round(stageW * 0.82);
  } else {
    frontW = Math.round(stageW * 0.86);
    frontH = Math.round(stageH * 0.82);
  }
  // garante que o card de trás (deslocado) caiba no stage
  if (frontW + offX > stageW) frontW = stageW - offX;
  if (frontH + offY > stageH) frontH = stageH - offY;

  // centraliza o conjunto (front + offsets) no stage
  const groupW = frontW + offX;
  const groupH = frontH + offY;
  const gLeft = stageLeft + Math.round((stageW - groupW) / 2);
  const gTop = stageTop + Math.round((stageH - groupH) / 2);

  // back card (atrás, deslocado para baixo-direita), menor e mais apagado
  const backScale = 0.94;
  const backW = Math.round(frontW * backScale);
  const backH = Math.round(frontH * backScale);
  const backLeft = gLeft + offX + Math.round((frontW - backW) / 2);
  const backTop = gTop + offY + Math.round((frontH - backH) / 2);

  const frontLeft = gLeft;
  const frontTop = gTop;

  const radius = Math.round(mn * 0.02);
  const frontBorder = Math.max(2, Math.round(mn * 0.004));

  const imgStyle = `width:100%;height:100%;object-fit:cover;object-position:top center;display:block;`;
  const fallbackChip = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${P.navy};color:${P.mist};font-family:'Inter',sans-serif;font-weight:700;`;

  const backInner = src
    ? `<img src="${escAttr(src)}" style="${imgStyle}"/>`
    : `<div style="${fallbackChip}"></div>`;
  const frontInner = src
    ? `<img src="${escAttr(src)}" style="${imgStyle}"/>`
    : (headline
        ? `<div style="${fallbackChip}font-size:${Math.round(mn*0.03)}px;padding:${pad}px;text-align:center;line-height:1.2;">${esc(headline)}</div>`
        : `<div style="${fallbackChip}"></div>`);

  const camadas = `
    <div style="position:absolute;left:${backLeft}px;top:${backTop}px;width:${backW}px;height:${backH}px;border-radius:${radius}px;overflow:hidden;box-shadow:0 ${Math.round(mn*0.02)}px ${Math.round(mn*0.05)}px rgba(0,0,0,.45);transform:rotate(-1.5deg);filter:saturate(.85) brightness(.82);">
      ${backInner}
      <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,53,84,.28), rgba(7,33,43,.5));"></div>
    </div>
    <div style="position:absolute;left:${frontLeft}px;top:${frontTop}px;width:${frontW}px;height:${frontH}px;border-radius:${radius}px;overflow:hidden;border:${frontBorder}px solid rgba(255,255,255,.9);box-shadow:0 ${Math.round(mn*0.03)}px ${Math.round(mn*0.07)}px rgba(0,0,0,.55);transform:rotate(1deg);background:#fff;">
      ${frontInner}
    </div>`;

  // ---- barra vertical + brand topo-direita ----
  const brandBar = `<span style="display:inline-block;width:${Math.max(2,Math.round(mn*0.004))}px;height:${brandFont}px;background:${P.sky};border-radius:99px;margin-right:${Math.round(mn*0.014)}px;"></span>`;

  // ---- rodapé direita (CTA) ----
  const ctaBlock = dom ? `
    <div style="position:absolute;right:${pad}px;bottom:${Math.round(botH*0.28)}px;display:flex;align-items:center;gap:${Math.round(mn*0.016)}px;">
      <div style="text-align:right;">
        <div style="font-family:'Inter',sans-serif;font-weight:500;font-size:${ctaTopFont}px;color:${P.cloud};letter-spacing:.01em;">Leia a matéria completa</div>
        <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:${ctaDomFont}px;color:${P.sky};letter-spacing:.01em;">${esc(dom)}</div>
      </div>
      <div style="width:${arrowR*2}px;height:${arrowR*2}px;border-radius:99px;border:${Math.max(2,Math.round(mn*0.0035))}px solid ${P.sky};display:flex;align-items:center;justify-content:center;color:${P.sky};font-family:'Inter',sans-serif;font-weight:700;font-size:${Math.round(arrowR*1.3)}px;line-height:1;">›</div>
    </div>` : '';

  // ---- grafismo de circuito ----
  const circuit = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;opacity:.12;" preserveAspectRatio="none">
      <g stroke="${P.sky}" stroke-width="${Math.max(1,Math.round(mn*0.0016))}" fill="none">
        <path d="M0 ${Math.round(H*0.2)} H ${Math.round(W*0.28)} V ${Math.round(H*0.34)} H ${Math.round(W*0.4)}"/>
        <path d="M${W} ${Math.round(H*0.62)} H ${Math.round(W*0.7)} V ${Math.round(H*0.5)} H ${Math.round(W*0.58)}"/>
        <path d="M${Math.round(W*0.12)} ${H} V ${Math.round(H*0.78)} H ${Math.round(W*0.26)}"/>
        <path d="M${Math.round(W*0.88)} 0 V ${Math.round(H*0.16)} H ${Math.round(W*0.74)}"/>
      </g>
      <g fill="${P.sky}">
        <circle cx="${Math.round(W*0.28)}" cy="${Math.round(H*0.2)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.4)}" cy="${Math.round(H*0.34)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.7)}" cy="${Math.round(H*0.62)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.58)}" cy="${Math.round(H*0.5)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.26)}" cy="${Math.round(H*0.78)}" r="${Math.round(mn*0.006)}"/>
        <circle cx="${Math.round(W*0.74)}" cy="${Math.round(H*0.16)}" r="${Math.round(mn*0.006)}"/>
      </g>
    </svg>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${FONT_LINK}
  <style>*{margin:0;padding:0;box-sizing:border-box;}</style></head>
  <body style="margin:0;">
    <div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(128% 118% at 78% 6%, ${P.blue} 0%, ${P.navy} 45%, ${P.darker} 100%);font-family:'Inter',sans-serif;">
      ${circuit}

      <div style="position:absolute;left:${pad}px;top:${Math.round(topH*0.34)}px;display:flex;align-items:center;">
        <img src="${escAttr(logo)}" style="height:${logoH}px;display:block;"/>
      </div>

      <div style="position:absolute;right:${pad}px;top:${Math.round(topH*0.34)}px;display:flex;align-items:center;height:${logoH}px;">
        ${brandBar}
        <span style="font-family:'Inter',sans-serif;font-size:${brandFont}px;line-height:1;">
          <span style="font-weight:800;color:#fff;">4Selet</span> <span style="font-weight:700;color:${P.sky};">na mídia</span>
        </span>
      </div>

      ${textBlock}
      ${camadas}

      <div style="position:absolute;left:${pad}px;bottom:${Math.round(botH*0.28)}px;background:#fff;border-radius:${Math.round(mn*0.014)}px;padding:${Math.round(mn*0.014)}px ${Math.round(mn*0.024)}px;box-shadow:0 ${Math.round(mn*0.008)}px ${Math.round(mn*0.02)}px rgba(0,0,0,.35);max-width:${Math.round(W*0.45)}px;">
        <span style="font-family:'Inter',sans-serif;font-weight:800;font-size:${veicFont}px;color:${P.navy};letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${esc(veiculo)}</span>
      </div>

      ${ctaBlock}
    </div>
  </body></html>`;
}