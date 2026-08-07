function tplMediaSplit({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const land = width > height;
  const minDim = Math.min(width, height);
  const imgSrc = image ? resolveImage(image) : '';
  const hasHeadline = String(headline || '').trim().length > 0;
  const veiculo = String(eyebrow || '').split(/[·|]/)[0].trim();
  const domain = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\./, '');

  const logo = logoSrc(logoVariant, LOGO_LIGHT);
  const logoH = Math.round(minDim * 0.04);

  const padTop = Math.round(height * 0.12);
  const padBottom = Math.round(height * 0.135);
  const padSide = Math.round(width * 0.06);

  const barTopH = Math.round(minDim * 0.045);
  const barBotH = Math.round(minDim * 0.065);

  const p = PALETTE;

  const headlineSize = land ? Math.round(width * 0.036) : Math.round(width * 0.052);
  const eyebrowSize = Math.round(minDim * 0.02);
  const brandTagSize = Math.round(minDim * 0.026);
  const cardTextSize = Math.round(minDim * 0.028);
  const ctaTopSize = Math.round(minDim * 0.019);
  const ctaBotSize = Math.round(minDim * 0.024);

  const circuit = `
    <svg class="ckt" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${p.sky}" stroke-width="${Math.max(1, Math.round(minDim*0.0018))}" fill="none" opacity="0.12">
        <path d="M0 ${Math.round(height*0.22)} H ${Math.round(width*0.28)} V ${Math.round(height*0.34)} H ${Math.round(width*0.5)}"/>
        <path d="M ${width} ${Math.round(height*0.7)} H ${Math.round(width*0.7)} V ${Math.round(height*0.58)} H ${Math.round(width*0.5)}"/>
        <path d="M ${Math.round(width*0.14)} ${height} V ${Math.round(height*0.82)} H ${Math.round(width*0.34)}"/>
        <path d="M ${Math.round(width*0.86)} 0 V ${Math.round(height*0.16)} H ${Math.round(width*0.64)}"/>
      </g>
      <g fill="${p.sky}" opacity="0.12">
        <circle cx="${Math.round(width*0.28)}" cy="${Math.round(height*0.22)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.5)}" cy="${Math.round(height*0.34)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.7)}" cy="${Math.round(height*0.7)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.34)}" cy="${Math.round(height*0.82)}" r="${Math.round(minDim*0.008)}"/>
        <circle cx="${Math.round(width*0.64)}" cy="${Math.round(height*0.16)}" r="${Math.round(minDim*0.008)}"/>
      </g>
    </svg>`;

  const brandTop = `
    <div class="brand-top">
      <img class="logo" src="${escAttr(logo)}" alt="4Selet"/>
      <div class="brand-tag">
        <span class="bar-v"></span>
        <span><span class="b1">4Selet</span> <span class="b2">na mídia</span></span>
      </div>
    </div>`;

  const footer = `
    <div class="footer">
      ${veiculo ? `<div class="veic-card">${esc(veiculo)}</div>` : `<div></div>`}
      ${domain ? `<div class="cta">
        <div class="cta-txt">
          <div class="cta-top">Leia a matéria completa</div>
          <div class="cta-bot">${esc(domain)}</div>
        </div>
        <div class="cta-arrow">›</div>
      </div>` : `<div></div>`}
    </div>`;

  const deviceInner = imgSrc
    ? `<img class="shot" src="${escAttr(imgSrc)}" alt=""/>`
    : `<div class="shot shot-empty"></div>`;

  const device = `
    <div class="device">
      <div class="device-frame">${deviceInner}</div>
    </div>`;

  const textBlock = `
    <div class="text-block">
      <div class="eyebrow">${esc(String(eyebrow || veiculo || '').toUpperCase())}</div>
      ${hasHeadline ? `<h1 class="headline">${esc(headline)}</h1>` : ``}
    </div>`;

  const showText = hasHeadline;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${FONT_LINK}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${width}px;height:${height}px}
  .stage{position:relative;width:${width}px;height:${height}px;overflow:hidden;
    background:radial-gradient(128% 118% at 78% 6%, ${p.blue} 0%, ${p.navy} 45%, ${p.darker} 100%);
    font-family:'Inter',system-ui,sans-serif;color:#fff}
  .ckt{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .frame{position:absolute;inset:0;
    padding:${padTop}px ${padSide}px ${padBottom}px ${padSide}px;
    display:flex;flex-direction:column}
  .brand-top{position:absolute;top:${Math.round(height*0.045)}px;left:${padSide}px;right:${padSide}px;
    display:flex;align-items:center;justify-content:space-between}
  .logo{height:${logoH}px;width:auto;display:block}
  .brand-tag{display:flex;align-items:center;gap:${Math.round(minDim*0.014)}px;
    font-size:${brandTagSize}px;line-height:1}
  .bar-v{width:${Math.max(2,Math.round(minDim*0.004))}px;height:${Math.round(brandTagSize*1.1)}px;
    background:${p.sky};border-radius:2px;display:inline-block}
  .b1{font-weight:800;color:#fff}
  .b2{font-weight:700;color:${p.sky}}

  .content{flex:1;display:flex;min-height:0;
    ${land ? 'flex-direction:row;align-items:center;gap:'+Math.round(width*0.05)+'px'
           : 'flex-direction:column;align-items:stretch;gap:'+Math.round(height*0.045)+'px'}}

  .text-block{${land ? 'flex:1 1 44%;' : (showText ? 'flex:0 0 auto;' : 'display:none;')}
    display:flex;flex-direction:column;gap:${Math.round(minDim*0.022)}px;
    ${land ? '' : 'text-align:'+(land?'left':'left')+';'}}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-weight:500;color:${p.sky};
    font-size:${eyebrowSize}px;letter-spacing:${Math.round(eyebrowSize*0.14)}px;
    text-transform:uppercase;line-height:1.3;
    ${showText?'':'display:none'}}
  .headline{font-weight:800;color:#fff;font-size:${headlineSize}px;
    line-height:1.12;letter-spacing:-0.01em;
    text-wrap:balance}

  .device{${land ? 'flex:1 1 52%;' : 'flex:1 1 auto;min-height:0;'}
    display:flex;align-items:center;justify-content:center}
  .device-frame{position:relative;
    max-width:100%;max-height:100%;
    ${land ? 'height:'+Math.round(height*0.72)+'px;' : (showText? 'height:100%;' : 'height:100%;')}
    aspect-ratio:${land ? '4 / 3' : '4 / 3'};
    ${land ? '' : 'width:100%;'}
    border-radius:${Math.round(minDim*0.02)}px;
    background:${p.darker};
    padding:${Math.round(minDim*0.012)}px;
    box-shadow:0 ${Math.round(minDim*0.03)}px ${Math.round(minDim*0.06)}px rgba(0,0,0,.45),
      0 0 0 ${Math.max(1,Math.round(minDim*0.002))}px rgba(84,153,181,.35);
    transform:rotate(${land? -1.2 : -1}deg);
    overflow:hidden}
  .shot{width:100%;height:100%;display:block;object-fit:cover;object-position:top center;
    border-radius:${Math.round(minDim*0.012)}px}
  .shot-empty{background:linear-gradient(160deg,${p.navy},${p.darker})}

  .footer{position:absolute;bottom:${Math.round(height*0.05)}px;left:${padSide}px;right:${padSide}px;
    display:flex;align-items:center;justify-content:space-between;gap:${Math.round(width*0.03)}px}
  .veic-card{background:#fff;color:${p.navy};font-weight:800;
    font-size:${cardTextSize}px;line-height:1;
    padding:${Math.round(minDim*0.016)}px ${Math.round(minDim*0.028)}px;
    border-radius:${Math.round(minDim*0.02)}px;
    box-shadow:0 ${Math.round(minDim*0.006)}px ${Math.round(minDim*0.014)}px rgba(0,0,0,.25);
    max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cta{display:flex;align-items:center;gap:${Math.round(minDim*0.016)}px}
  .cta-txt{text-align:right;line-height:1.2}
  .cta-top{color:${p.cloud};font-size:${ctaTopSize}px;font-weight:500}
  .cta-bot{color:${p.sky};font-size:${ctaBotSize}px;font-weight:700}
  .cta-arrow{width:${Math.round(minDim*0.055)}px;height:${Math.round(minDim*0.055)}px;
    border:${Math.max(1,Math.round(minDim*0.003))}px solid ${p.sky};border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    color:${p.sky};font-size:${Math.round(minDim*0.036)}px;font-weight:700;
    line-height:0;padding-bottom:${Math.round(minDim*0.004)}px}
</style></head>
<body>
  <div class="stage">
    ${circuit}
    ${brandTop}
    <div class="frame">
      <div class="content">
        ${land ? textBlock + device : textBlock + device}
      </div>
    </div>
    ${footer}
  </div>
</body></html>`;
}