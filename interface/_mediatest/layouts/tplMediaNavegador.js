function tplMediaNavegador({ width, height, image, eyebrow, url, headline, logo: logoVariant }) {
  const land = width > height;
  const minDim = Math.min(width, height);
  const dom = (String(url || '').match(/^https?:\/\/([^/]+)/) || [, ''])[1].replace(/^www\./, '');
  const veic = String(eyebrow || '').split(/[·|]/)[0].trim();
  const img = resolveImage(image);
  const logo = logoSrc(logoVariant, LOGO_LIGHT);

  const px = Math.round(width * 0.06);
  const topPad = Math.round(height * 0.12);
  const botPad = Math.round(height * 0.135);
  const logoH = Math.round(minDim * 0.04);

  const P = PALETTE;

  const brandTag =
    '<div style="display:flex;align-items:center;gap:' + Math.round(minDim * 0.02) + 'px;">' +
      '<div style="font-family:\'Inter\',sans-serif;font-size:' + Math.round(minDim * 0.026) + 'px;line-height:1;letter-spacing:.2px;">' +
        '<span style="font-weight:800;color:#fff;">4Selet</span>' +
        '<span style="font-weight:700;color:' + P.sky + ';">&nbsp;na mídia</span>' +
      '</div>' +
      '<div style="width:' + Math.max(3, Math.round(minDim * 0.006)) + 'px;height:' + Math.round(minDim * 0.05) + 'px;background:' + P.sky + ';border-radius:99px;"></div>' +
    '</div>';

  const topBar =
    '<div style="position:absolute;top:' + Math.round(height * 0.05) + 'px;left:' + px + 'px;right:' + px + 'px;display:flex;align-items:center;justify-content:space-between;z-index:5;">' +
      '<img src="' + escAttr(logo) + '" style="height:' + logoH + 'px;width:auto;display:block;" />' +
      brandTag +
    '</div>';

  const veicCard = veic
    ? '<div style="background:#fff;border-radius:' + Math.round(minDim * 0.022) + 'px;padding:' + Math.round(minDim * 0.018) + 'px ' + Math.round(minDim * 0.032) + 'px;box-shadow:0 ' + Math.round(minDim * 0.012) + 'px ' + Math.round(minDim * 0.03) + 'px rgba(0,0,0,.28);max-width:' + Math.round(width * 0.5) + 'px;">' +
        '<div style="font-family:\'Inter\',sans-serif;font-weight:800;color:' + P.navy + ';font-size:' + Math.round(minDim * 0.03) + 'px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(veic) + '</div>' +
      '</div>'
    : '';

  const ctaBlock = dom
    ? '<div style="display:flex;align-items:center;gap:' + Math.round(minDim * 0.022) + 'px;">' +
        '<div style="text-align:right;font-family:\'Inter\',sans-serif;line-height:1.15;">' +
          '<div style="color:' + P.cloud + ';font-size:' + Math.round(minDim * 0.022) + 'px;font-weight:600;">Leia a matéria completa</div>' +
          '<div style="color:' + P.sky + ';font-size:' + Math.round(minDim * 0.026) + 'px;font-weight:700;">' + esc(dom) + '</div>' +
        '</div>' +
        '<div style="width:' + Math.round(minDim * 0.06) + 'px;height:' + Math.round(minDim * 0.06) + 'px;border-radius:99px;border:' + Math.max(2, Math.round(minDim * 0.004)) + 'px solid ' + P.sky + ';display:flex;align-items:center;justify-content:center;color:' + P.sky + ';font-size:' + Math.round(minDim * 0.036) + 'px;font-weight:700;line-height:1;font-family:\'Inter\',sans-serif;">&#8250;</div>' +
      '</div>'
    : '';

  const bottomBar =
    '<div style="position:absolute;bottom:' + Math.round(height * 0.05) + 'px;left:' + px + 'px;right:' + px + 'px;display:flex;align-items:center;justify-content:space-between;gap:' + Math.round(minDim * 0.03) + 'px;z-index:5;">' +
      veicCard +
      ctaBlock +
    '</div>';

  // Browser window
  const winRadius = Math.round(minDim * 0.028);
  const chromeH = Math.round(minDim * 0.055);
  const dotSz = Math.round(chromeH * 0.28);
  const dotGap = Math.round(dotSz * 0.7);

  const addressBar =
    '<div style="flex:1;height:' + Math.round(chromeH * 0.6) + 'px;margin:0 ' + Math.round(chromeH * 0.4) + 'px;background:rgba(255,255,255,.14);border-radius:99px;display:flex;align-items:center;padding:0 ' + Math.round(chromeH * 0.45) + 'px;overflow:hidden;">' +
      '<span style="color:' + P.mist + ';font-size:' + Math.round(chromeH * 0.32) + 'px;margin-right:' + Math.round(chromeH * 0.3) + 'px;line-height:1;">&#128274;</span>'.replace('&#128274;', '') +
      '<span style="font-family:\'JetBrains Mono\',monospace;color:' + P.cloud + ';font-size:' + Math.round(chromeH * 0.34) + 'px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(dom || 'matéria') + '</span>' +
    '</div>';

  const browserChrome =
    '<div style="height:' + chromeH + 'px;background:linear-gradient(180deg,#0d3244,#0a2a39);display:flex;align-items:center;padding:0 ' + Math.round(chromeH * 0.55) + 'px;border-bottom:1px solid rgba(255,255,255,.08);flex:0 0 auto;">' +
      '<div style="display:flex;gap:' + dotGap + 'px;flex:0 0 auto;">' +
        '<div style="width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:99px;background:#ff5f57;"></div>' +
        '<div style="width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:99px;background:#febc2e;"></div>' +
        '<div style="width:' + dotSz + 'px;height:' + dotSz + 'px;border-radius:99px;background:#28c840;"></div>' +
      '</div>' +
      addressBar +
    '</div>';

  const contentInner = img
    ? '<img src="' + escAttr(img) + '" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;" />'
    : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0a2130;padding:' + Math.round(minDim * 0.05) + 'px;box-sizing:border-box;">' +
        '<div style="font-family:\'Inter\',sans-serif;color:#fff;font-weight:800;font-size:' + Math.round(minDim * 0.042) + 'px;line-height:1.25;text-align:center;">' + esc(headline || '') + '</div>' +
      '</div>';

  const browserWindow =
    '<div style="width:100%;height:100%;border-radius:' + winRadius + 'px;overflow:hidden;background:#0a2a39;box-shadow:0 ' + Math.round(minDim * 0.03) + 'px ' + Math.round(minDim * 0.07) + 'px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06);display:flex;flex-direction:column;">' +
      browserChrome +
      '<div style="flex:1 1 auto;min-height:0;background:#fff;overflow:hidden;">' + contentInner + '</div>' +
    '</div>';

  let centerArea;
  if (land) {
    const winW = Math.round((width - px * 2) * 0.62);
    centerArea =
      '<div style="position:absolute;top:' + topPad + 'px;left:' + px + 'px;right:' + px + 'px;bottom:' + botPad + 'px;display:flex;align-items:center;gap:' + Math.round(width * 0.04) + 'px;z-index:2;">' +
        '<div style="width:' + winW + 'px;height:100%;flex:0 0 auto;">' + browserWindow + '</div>' +
        '<div style="flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;">' +
          (headline
            ? '<div style="font-family:\'JetBrains Mono\',monospace;color:' + P.sky + ';font-size:' + Math.round(minDim * 0.024) + 'px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:' + Math.round(minDim * 0.03) + 'px;">Na imprensa</div>' +
              '<div style="font-family:\'Inter\',sans-serif;color:#fff;font-weight:800;font-size:' + Math.round(minDim * 0.05) + 'px;line-height:1.18;">' + esc(headline) + '</div>'
            : '<div style="font-family:\'Inter\',sans-serif;color:#fff;font-weight:800;font-size:' + Math.round(minDim * 0.055) + 'px;line-height:1.15;">4Selet<br><span style="color:' + P.sky + ';">na mídia</span></div>') +
        '</div>' +
      '</div>';
  } else {
    centerArea =
      '<div style="position:absolute;top:' + topPad + 'px;left:' + px + 'px;right:' + px + 'px;bottom:' + botPad + 'px;display:flex;flex-direction:column;z-index:2;">' +
        (headline
          ? '<div style="font-family:\'Inter\',sans-serif;color:#fff;font-weight:800;font-size:' + Math.round(minDim * 0.044) + 'px;line-height:1.2;margin-bottom:' + Math.round(height * 0.028) + 'px;flex:0 0 auto;">' + esc(headline) + '</div>'
          : '') +
        '<div style="flex:1 1 auto;min-height:0;">' + browserWindow + '</div>' +
      '</div>';
  }

  const circuit =
    '<svg viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" style="position:absolute;inset:0;opacity:.12;z-index:1;" preserveAspectRatio="none">' +
      '<g stroke="' + P.sky + '" stroke-width="' + Math.max(1, Math.round(minDim * 0.0018)) + '" fill="none">' +
        '<path d="M0 ' + Math.round(height * 0.2) + ' H' + Math.round(width * 0.3) + ' V' + Math.round(height * 0.32) + ' H' + Math.round(width * 0.55) + '"/>' +
        '<path d="M' + width + ' ' + Math.round(height * 0.15) + ' H' + Math.round(width * 0.72) + ' V' + Math.round(height * 0.28) + '"/>' +
        '<path d="M' + Math.round(width * 0.12) + ' ' + height + ' V' + Math.round(height * 0.78) + ' H' + Math.round(width * 0.4) + '"/>' +
        '<path d="M' + width + ' ' + Math.round(height * 0.82) + ' H' + Math.round(width * 0.68) + ' V' + Math.round(height * 0.7) + '"/>' +
      '</g>' +
      '<g fill="' + P.sky + '">' +
        '<circle cx="' + Math.round(width * 0.3) + '" cy="' + Math.round(height * 0.2) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.55) + '" cy="' + Math.round(height * 0.32) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.72) + '" cy="' + Math.round(height * 0.28) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.4) + '" cy="' + Math.round(height * 0.78) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
        '<circle cx="' + Math.round(width * 0.68) + '" cy="' + Math.round(height * 0.7) + '" r="' + Math.round(minDim * 0.008) + '"/>' +
      '</g>' +
    '</svg>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8">' + FONT_LINK +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:' + width + 'px;height:' + height + 'px;}</style></head>' +
    '<body><div style="position:relative;width:' + width + 'px;height:' + height + 'px;overflow:hidden;background:radial-gradient(128% 118% at 78% 6%,' + P.blue + ' 0%,' + P.navy + ' 45%,' + P.darker + ' 100%);font-family:\'Inter\',sans-serif;">' +
      circuit +
      topBar +
      centerArea +
      bottomBar +
    '</div></body></html>';
}