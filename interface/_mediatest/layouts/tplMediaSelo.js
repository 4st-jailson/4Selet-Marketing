function tplMediaSelo({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const r = Math.round;
  const land = width > height;
  const mn = Math.min(width, height);
  const img = resolveImage(image);
  const shot = img ? `<img src="${escAttr(img)}" alt=""/>` : `<div class="scr-empty">print da matéria</div>`;
  const veh = String(eyebrow || "").split(/[·|]/)[0].trim();
  const domain = (String(url || "").match(/^https?:\/\/([^/]+)/) || [, ""])[1].replace(/^www\./, "");

  // area segura: topo ~12% / rodape ~13.5% / lateral ~6%
  const px = r(width * 0.06);
  const topSafe = r(height * 0.12);
  const botSafe = r(height * 0.135);
  const availH = height - topSafe - botSafe;
  const availW = width - px * 2;

  // CARD do print: retangulo reto, moldura fina. Retrato ~4:5, paisagem ~4:3 e menor (deixa ar).
  let cardW, cardH;
  if (land) {
    cardH = r(Math.min(availH * 0.9, availW * 0.5 * (5 / 4)));
    cardW = r(cardH * (4 / 5));
    if (cardW > availW * 0.52) { cardW = r(availW * 0.52); cardH = r(cardW * (5 / 4)); }
  } else {
    cardW = r(Math.min(availW * 0.82, availH * (4 / 5)));
    cardH = r(cardW * (5 / 4));
    if (cardH > availH * 0.94) { cardH = r(availH * 0.94); cardW = r(cardH * (4 / 5)); }
  }
  const cardRad = r(cardW * 0.045);
  const frame = Math.max(6, r(cardW * 0.022));
  const innerRad = Math.max(6, cardRad - frame);

  // SELO circular: sobreposto no canto superior-direito do card.
  const sealD = r(mn * (land ? 0.2 : 0.24));
  const ring = Math.max(2, r(sealD * 0.02));
  const sealFont = r(sealD * 0.088);
  const sealBig = r(sealD * 0.34);
  // texto curvo em torno do "4" central: circulo SVG com path para textPath.
  const cx = sealD / 2, cy = sealD / 2;
  const rTop = r(sealD * 0.365), rBot = r(sealD * 0.365);
  const topArc = `M ${cx - rTop} ${cy} A ${rTop} ${rTop} 0 0 1 ${cx + rTop} ${cy}`;
  const botArc = `M ${cx - rBot} ${cy} A ${rBot} ${rBot} 0 0 0 ${cx + rBot} ${cy}`;
  const seal = `<div class="seal" style="width:${sealD}px;height:${sealD}px">
      <svg viewBox="0 0 ${sealD} ${sealD}" width="${sealD}" height="${sealD}">
        <defs>
          <path id="selarcT" d="${topArc}"/>
          <path id="selarcB" d="${botArc}"/>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${r(sealD / 2 - ring)}" fill="${PALETTE.darker}" stroke="${PALETTE.sky}" stroke-width="${ring}"/>
        <circle cx="${cx}" cy="${cy}" r="${r(sealD / 2 - ring * 3.2)}" fill="none" stroke="${PALETTE.sky}" stroke-width="1" opacity="0.5"/>
        <text class="selt" fill="${PALETTE.cloud}"><textPath href="#selarcT" startOffset="50%" text-anchor="middle">DESTAQUE NA IMPRENSA</textPath></text>
        <text class="selt" fill="${PALETTE.sky}"><textPath href="#selarcB" startOffset="50%" text-anchor="middle">4 S E L E T · N A · M Í D I A</textPath></text>
      </svg>
      <div class="seal-num">4</div>
    </div>`;

  // grafismo de circuito
  const tech = `<svg class="tech" viewBox="0 0 ${width} ${height}" fill="none" preserveAspectRatio="xMidYMid slice">
    <g stroke="${PALETTE.sky}" stroke-width="1" opacity="0.12">
      <path d="M-20 ${r(height * .26)} H${r(width * .13)} V${r(height * .32)} H${r(width * .22)}"/>
      <path d="M${width + 20} ${r(height * .28)} H${r(width * .87)} V${r(height * .22)}"/>
      <path d="M-20 ${r(height * .74)} H${r(width * .16)} V${r(height * .68)}"/>
      <path d="M${width + 20} ${r(height * .72)} H${r(width * .84)} V${r(height * .78)} H${r(width * .69)}"/>
    </g>
    <g fill="${PALETTE.sky}" opacity="0.42">
      <circle cx="${r(width * .22)}" cy="${r(height * .32)}" r="3"/><circle cx="${r(width * .87)}" cy="${r(height * .22)}" r="3"/>
      <circle cx="${r(width * .16)}" cy="${r(height * .68)}" r="3"/><circle cx="${r(width * .69)}" cy="${r(height * .78)}" r="3"/>
    </g></svg>`;

  const logoH = r(mn * 0.04);
  const kickFont = r(mn * 0.028);
  const cardFont = r(mn * 0.024);
  const ctaFont = r(mn * 0.022);

  const topbar = `<div class="topbar" style="top:${r(height * 0.055)}px;left:${px}px;right:${px}px">
      <img class="logo4" src="${logoSrc(logoVariant, LOGO_LIGHT)}" alt="4Selet"/>
      <div class="kicker"><b>4Selet</b><i>na mídia</i><span class="kbar"></span></div></div>`;
  const botbar = `<div class="botbar" style="bottom:${r(height * 0.05)}px;left:${px}px;right:${px}px">
      ${veh ? `<div class="veic-card">${esc(veh)}</div>` : "<span></span>"}
      ${domain ? `<div class="cta"><div class="cta-txt"><div class="cta-l">Leia a matéria completa</div><div class="cta-u">${esc(domain)}</div></div><div class="cta-arrow">&#8250;</div></div>` : "<span></span>"}</div>`;

  const stage = `<div class="stage">
      <div class="card-wrap" style="width:${cardW}px">
        <div class="mshot" style="width:${cardW}px;height:${cardH}px;border-radius:${cardRad}px;padding:${frame}px">
          <div class="screen" style="border-radius:${innerRad}px">${shot}<div class="glass"></div></div>
        </div>
        ${seal}
      </div>
    </div>`;

  const css = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${width}px;height:${height}px}
    .card{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(128% 118% at 78% 6%, ${PALETTE.blue} 0%, ${PALETTE.navy} 45%, ${PALETTE.darker} 100%);color:${PALETTE.cloud};font-family:'Inter',sans-serif}
    .tech{position:absolute;inset:0;z-index:1;pointer-events:none}
    .vig{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(140% 92% at 50% 116%, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 55%),radial-gradient(120% 80% at 50% -18%, rgba(84,153,181,.12) 0%, rgba(0,0,0,0) 60%)}
    .topbar{position:absolute;display:flex;align-items:center;justify-content:space-between;z-index:6}
    .logo4{height:${logoH}px;display:block;opacity:.98}
    .kicker{display:flex;align-items:center;font-size:${kickFont}px;color:#fff}
    .kicker b{font-weight:800;color:#fff}.kicker i{font-style:normal;font-weight:700;color:${PALETTE.sky};margin-left:${r(kickFont * 0.28)}px}
    .kicker .kbar{width:2px;height:${r(kickFont * 1.15)}px;background:${PALETTE.sky};margin-left:${r(kickFont * 0.5)}px;border-radius:2px}
    .stage{position:absolute;left:${px}px;right:${px}px;top:${topSafe}px;height:${availH}px;display:flex;align-items:center;justify-content:center;z-index:3}
    .card-wrap{position:relative}
    .mshot{position:relative;background:linear-gradient(150deg,#fdfefe,#e7edf0);box-shadow:0 40px 90px -22px rgba(0,0,0,.7),0 16px 40px -16px rgba(0,0,0,.55),0 0 0 1px rgba(84,153,181,.2)}
    .screen{position:relative;width:100%;height:100%;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(7,33,43,.12) inset}
    .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
    .scr-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9fb0b8;font-size:${r(cardW * 0.06)}px;background:repeating-linear-gradient(45deg,#eef2f4,#eef2f4 20px,#e6ebee 20px,#e6ebee 40px)}
    .glass{position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,.04) 16%, rgba(255,255,255,0) 34%)}
    .seal{position:absolute;top:${r(-sealD * 0.34)}px;right:${r(-sealD * 0.24)}px;z-index:5;filter:drop-shadow(0 14px 26px rgba(0,0,0,.5))}
    .seal svg{display:block}
    .selt{font-family:'JetBrains Mono',monospace;font-size:${sealFont}px;font-weight:500;letter-spacing:${r(sealFont * 0.12)}px}
    .seal-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${sealBig}px;color:#fff;line-height:1;text-shadow:0 2px 10px rgba(0,0,0,.4)}
    .botbar{position:absolute;display:flex;align-items:flex-end;justify-content:space-between;z-index:6;gap:16px}
    .veic-card{background:#fff;border-radius:${r(cardFont * 0.85)}px;padding:${r(cardFont * 0.72)}px ${r(cardFont * 1.25)}px;color:${PALETTE.navy};font-weight:800;font-size:${cardFont}px;letter-spacing:-.3px;box-shadow:0 12px 26px -8px rgba(0,0,0,.5);max-width:52%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cta{display:flex;align-items:center;gap:${r(ctaFont * 0.7)}px}
    .cta-txt{text-align:right;line-height:1.18}
    .cta-l{color:${PALETTE.cloud};font-size:${ctaFont}px;font-weight:500}
    .cta-u{color:${PALETTE.sky};font-size:${r(ctaFont * 1.02)}px;font-weight:700}
    .cta-arrow{width:${r(ctaFont * 1.95)}px;height:${r(ctaFont * 1.95)}px;border-radius:50%;border:2px solid ${PALETTE.sky};color:${PALETTE.sky};display:flex;align-items:center;justify-content:center;font-size:${r(ctaFont * 1.35)}px;font-weight:700;line-height:1}`;

  const body = `${tech}<div class="vig"></div>${topbar}${stage}${botbar}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>${FONT_LINK}<style>${css}</style></head><body><div class="card">${body}</div></body></html>`;
}