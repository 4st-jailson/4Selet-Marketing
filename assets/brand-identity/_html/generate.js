// Gera todos os HTMLs do kit de identidade visual 4Selet + manifest.json
// Cada HTML é renderizado depois via Chrome headless no tamanho do manifest.
const fs = require('fs');
const path = require('path');

const OUT = __dirname; // _html/
const C = {
  darker: '#07212B', navy: '#003554', blue: '#006494',
  sky: '#5499B5', mist: '#AFBCC9', cloud: '#D9DCD6',
  success: '#16A34A', warning: '#D97706', error: '#DC2626'
};

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;

function doc(w, h, css, body) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">${FONT_LINK}<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:"Inter",sans-serif;-webkit-font-smoothing:antialiased}
${css}
</style></head><body>${body}</body></html>`;
}

// Gradiente padrão escuro reutilizável
function darkGrad(angle = '135deg') {
  return `radial-gradient(ellipse 70% 60% at 80% 18%, rgba(84,153,181,0.22) 0%, transparent 60%),
    radial-gradient(ellipse 80% 70% at 12% 92%, rgba(0,53,84,0.55) 0%, transparent 60%),
    linear-gradient(${angle}, ${C.darker} 0%, ${C.navy} 60%, ${C.blue} 130%)`;
}

// SVG dots como background-image (data URI)
function dots(color, opacity, gap = 28, r = 2.2) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${gap}' height='${gap}'><circle cx='${gap/2}' cy='${gap/2}' r='${r}' fill='${color}' fill-opacity='${opacity}'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const manifest = [];
function add(file, w, h, out, html) {
  fs.writeFileSync(path.join(OUT, file), html);
  manifest.push({ file, w, h, out });
}

/* ============ 02 - CORES ============ */

// Palette board
const swatchData = [
  ['Selet Darker', C.darker, '7, 33, 43', 'cloud'],
  ['Selet Navy', C.navy, '0, 53, 84', 'cloud'],
  ['Selet Blue', C.blue, '0, 100, 148', 'cloud'],
  ['Selet Sky', C.sky, '84, 153, 181', 'darker'],
  ['Selet Mist', C.mist, '175, 188, 201', 'darker'],
  ['Selet Cloud', C.cloud, '217, 220, 214', 'darker'],
];
const funcData = [
  ['Sucesso', C.success, '#status pago/ativo'],
  ['Alerta', C.warning, '#status atrasada'],
  ['Erro', C.error, '#status cancelado'],
];
add('palette-board.html', 1800, 1100, '02-cores/palette-board.png', doc(1800, 1100,
`body{background:${C.cloud};padding:80px}
.title{font-size:42px;font-weight:800;color:${C.darker};letter-spacing:-1px}
.sub{font-size:17px;color:#5b6b76;margin:6px 0 44px;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.sw{border-radius:18px;overflow:hidden;border:1px solid rgba(7,33,43,.08);box-shadow:0 2px 10px rgba(7,33,43,.05)}
.chip{height:180px;display:flex;align-items:flex-end;padding:20px}
.chip .nm{font-size:20px;font-weight:700}
.meta{background:#fff;padding:16px 20px}
.hex{font-family:"JetBrains Mono",monospace;font-size:15px;font-weight:600;color:${C.navy}}
.rgb{font-family:"JetBrains Mono",monospace;font-size:12px;color:#8a96a0;margin-top:2px}
.fn-title{font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.blue};margin:48px 0 18px}
.fn-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.fn{display:flex;align-items:center;gap:14px;background:#fff;border-radius:14px;padding:16px 20px;border:1px solid rgba(7,33,43,.08)}
.fn .dot{width:40px;height:40px;border-radius:10px;flex-shrink:0}
.fn .fnm{font-size:15px;font-weight:600;color:${C.darker}}
.fn .fhex{font-family:"JetBrains Mono",monospace;font-size:12px;color:#8a96a0}`,
`<div class="title">Paleta Oficial 4Selet</div>
<div class="sub">Brandbook v2 · use exclusivamente estas cores nos criativos</div>
<div class="grid">${swatchData.map(([nm,hex,rgb,txt])=>`<div class="sw"><div class="chip" style="background:${hex}"><span class="nm" style="color:${C[txt]}">${nm}</span></div><div class="meta"><div class="hex">${hex.toUpperCase()}</div><div class="rgb">RGB ${rgb}</div></div></div>`).join('')}</div>
<div class="fn-title">Cores funcionais · uso restrito a status do sistema</div>
<div class="fn-grid">${funcData.map(([nm,hex,use])=>`<div class="fn"><div class="dot" style="background:${hex}"></div><div><div class="fnm">${nm}</div><div class="fhex">${hex.toUpperCase()} · ${use}</div></div></div>`).join('')}</div>`));

// Individual swatches
swatchData.forEach(([nm, hex, rgb, txt]) => {
  const slug = nm.toLowerCase().replace('selet ', '').replace(/\s/g, '-');
  add(`swatch-${slug}.html`, 800, 800, `02-cores/swatch-${slug}.png`, doc(800, 800,
`body{background:${hex};display:flex;flex-direction:column;justify-content:flex-end;padding:56px}
.nm{font-size:46px;font-weight:800;color:${C[txt]};letter-spacing:-1px}
.hex{font-family:"JetBrains Mono",monospace;font-size:24px;font-weight:600;color:${C[txt]};opacity:.9;margin-top:10px}
.rgb{font-family:"JetBrains Mono",monospace;font-size:16px;color:${C[txt]};opacity:.6;margin-top:4px}`,
`<div class="nm">${nm}</div><div class="hex">${hex.toUpperCase()}</div><div class="rgb">RGB ${rgb}</div>`));
});

/* ============ 03 - TIPOGRAFIA ============ */
add('inter-specimen.html', 1800, 1100, '03-tipografia/inter-specimen.png', doc(1800, 1100,
`body{background:${C.darker};padding:80px;color:${C.cloud}}
.kicker{font-size:14px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${C.sky}}
.big{font-size:150px;font-weight:800;letter-spacing:-5px;line-height:1;margin:14px 0 8px}
.alpha{font-size:34px;font-weight:500;letter-spacing:-.5px;color:${C.mist}}
.num{font-family:"JetBrains Mono",monospace;font-size:26px;color:${C.sky};margin-top:8px}
.weights{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:56px}
.w{border-top:2px solid rgba(175,188,201,.2);padding-top:16px}
.w .lbl{font-size:13px;font-weight:600;letter-spacing:1px;color:${C.sky};text-transform:uppercase}
.w .sample{font-size:38px;margin-top:8px;color:${C.cloud}}
.mono-row{margin-top:48px;border-top:2px solid rgba(175,188,201,.2);padding-top:20px}
.mono-row .lbl{font-size:13px;font-weight:600;letter-spacing:1px;color:${C.sky};text-transform:uppercase}
.mono-row .sample{font-family:"JetBrains Mono",monospace;font-size:24px;color:${C.mist};margin-top:8px}`,
`<div class="kicker">Tipografia Oficial</div>
<div class="big">Inter</div>
<div class="alpha">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz</div>
<div class="num">0123456789 · R$ · % · + · @ · #</div>
<div class="weights">
<div class="w"><div class="lbl">Light 300 · Body fino</div><div class="sample" style="font-weight:300">Para quem sabe que é Selet.</div></div>
<div class="w"><div class="lbl">Regular 400 / Medium 500 · Corpo</div><div class="sample" style="font-weight:500">Plataforma de pagamentos.</div></div>
<div class="w"><div class="lbl">Bold 700 / Black 800 · Headline</div><div class="sample" style="font-weight:800">A escolha de quem performa.</div></div>
</div>
<div class="mono-row"><div class="lbl">JetBrains Mono · apenas snippets técnicos</div><div class="sample">pur_qnN7•••••ZF5jb · app.4st.com.br · D+10</div></div>`));

/* ============ 04 - TEXTURAS / PADRÕES (1080x1080 tileable-look) ============ */
function dotsBg(name, bg, dotColor, op) {
  add(`${name}.html`, 1080, 1080, `04-texturas-padroes/${name}.png`, doc(1080, 1080,
`body{background:${bg}}
.layer{width:100%;height:100%;background-image:${dots(dotColor, op, 32, 2.6)};background-size:32px 32px}`,
`<div class="layer"></div>`));
}
dotsBg('dots-navy', C.navy, C.sky, 0.30);
dotsBg('dots-darker', C.darker, C.blue, 0.28);
dotsBg('dots-blue-on-cloud', C.cloud, C.blue, 0.22);

/* ============ 05 - FUNDOS (gradientes prontos) ============ */
function bgGrad(name, w, h, out, bg, withDots) {
  const dotsLayer = withDots ? `<div style="position:absolute;inset:0;background-image:${dots(C.sky,0.10,30,2.2)};background-size:30px 30px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 85%);-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 85%)"></div>` : '';
  add(`${name}.html`, w, h, `05-fundos/${out}`, doc(w, h,
`body{position:relative;background:${bg}}
.symbol{position:absolute;right:-${Math.round(w*0.12)}px;bottom:-${Math.round(h*0.14)}px;width:${Math.round(w*0.55)}px;opacity:.06;filter:brightness(0) invert(1)}`,
`${dotsLayer}<img class="symbol" src="simbolo.svg">`));
}
// Navy gradient — 4 ratios
bgGrad('bg-navy-1x1', 1080, 1080, 'bg-navy-1x1.png', darkGrad('135deg'), true);
bgGrad('bg-navy-4x5', 1080, 1350, 'bg-navy-4x5.png', darkGrad('150deg'), true);
bgGrad('bg-navy-9x16', 1080, 1920, 'bg-navy-9x16.png', darkGrad('160deg'), true);
bgGrad('bg-navy-16x9', 1920, 1080, 'bg-navy-16x9.png', darkGrad('120deg'), true);
// Darker (mais escuro, sóbrio)
bgGrad('bg-darker-1x1', 1080, 1080, 'bg-darker-1x1.png', `radial-gradient(ellipse 80% 70% at 50% 40%, rgba(0,53,84,.45) 0%, transparent 65%), linear-gradient(135deg, ${C.darker} 0%, #050c12 100%)`, true);
bgGrad('bg-darker-9x16', 1080, 1920, 'bg-darker-9x16.png', `radial-gradient(ellipse 90% 60% at 50% 30%, rgba(0,53,84,.45) 0%, transparent 65%), linear-gradient(160deg, ${C.darker} 0%, #050c12 100%)`, true);
bgGrad('bg-darker-16x9', 1920, 1080, 'bg-darker-16x9.png', `radial-gradient(ellipse 70% 80% at 70% 50%, rgba(0,100,148,.30) 0%, transparent 60%), linear-gradient(120deg, ${C.darker} 0%, #050c12 100%)`, true);
// Blue radial (mais vivo)
bgGrad('bg-blue-radial-1x1', 1080, 1080, 'bg-blue-radial-1x1.png', `radial-gradient(circle at 50% 45%, ${C.blue} 0%, ${C.navy} 55%, ${C.darker} 100%)`, false);
// Cloud (claro)
function bgCloud(name, w, h, out) {
  add(`${name}.html`, w, h, `05-fundos/${out}`, doc(w, h,
`body{position:relative;background:radial-gradient(ellipse 80% 70% at 50% 30%, #ffffff 0%, ${C.cloud} 70%, #c9cdc7 100%)}
.symbol{position:absolute;right:-${Math.round(w*0.10)}px;bottom:-${Math.round(h*0.12)}px;width:${Math.round(w*0.5)}px;opacity:.07}`,
`<img class="symbol" src="simbolo.svg"><div style="position:absolute;inset:0;background-image:${dots(C.navy,0.05,30,2)};background-size:30px 30px"></div>`));
}
bgCloud('bg-cloud-1x1', 1080, 1080, 'bg-cloud-1x1.png');
bgCloud('bg-cloud-4x5', 1080, 1350, 'bg-cloud-4x5.png');

/* ============ 06 - SOCIAL TEMPLATES (frame com logo + área segura) ============ */
function template(name, w, h, out, label) {
  const margin = Math.round(w * 0.06);
  add(`${name}.html`, w, h, `06-social-templates/${out}`, doc(w, h,
`body{position:relative;background:${darkGrad('150deg')}}
.dots{position:absolute;inset:0;background-image:${dots(C.sky,0.08,30,2.2)};background-size:30px 30px}
.logo{position:absolute;top:${margin}px;left:${margin}px;width:${Math.round(w*0.22)}px}
.safe{position:absolute;border:2px dashed rgba(175,188,201,.28);border-radius:18px;left:${margin}px;right:${margin}px;top:${Math.round(h*0.18)}px;bottom:${Math.round(h*0.16)}px;display:flex;align-items:center;justify-content:center}
.safe .hint{font-size:${Math.round(w*0.022)}px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:rgba(175,188,201,.5)}
.lbl{position:absolute;bottom:${margin}px;left:${margin}px;font-family:"JetBrains Mono",monospace;font-size:${Math.round(w*0.018)}px;color:${C.sky};letter-spacing:1px}
.sym{position:absolute;bottom:${margin}px;right:${margin}px;width:${Math.round(w*0.05)}px;filter:brightness(0) invert(1);opacity:.85}`,
`<div class="dots"></div>
<img class="logo" src="logo-4selet-light.png">
<div class="safe"><span class="hint">área segura · conteúdo aqui</span></div>
<div class="lbl">${label}</div>
<img class="sym" src="simbolo.svg">`));
}
template('tpl-ig-feed-4x5', 1080, 1350, 'template-instagram-feed-4x5.png', 'INSTAGRAM FEED · 1080×1350');
template('tpl-ig-story-9x16', 1080, 1920, 'template-instagram-story-9x16.png', 'INSTAGRAM STORY/REEL · 1080×1920');
template('tpl-ig-square-1x1', 1080, 1080, 'template-instagram-square-1x1.png', 'INSTAGRAM FEED · 1080×1080');
template('tpl-linkedin-1x1', 1200, 1200, 'template-linkedin-1x1.png', 'LINKEDIN · 1200×1200');
template('tpl-youtube-16x9', 1280, 720, 'template-youtube-thumb-16x9.png', 'YOUTUBE THUMB · 1280×720');

/* ============ 01 - LOGOS SHOWCASE ============ */
add('logo-on-navy.html', 1080, 1080, '01-logos/logo-showcase-navy-1x1.png', doc(1080,1080,
`body{background:${darkGrad('135deg')};display:flex;align-items:center;justify-content:center}
img{width:62%}`,
`<img src="logo-4selet-light.png">`));
add('logo-on-cloud.html', 1080, 1080, '01-logos/logo-showcase-cloud-1x1.png', doc(1080,1080,
`body{background:radial-gradient(ellipse at 50% 40%, #fff 0%, ${C.cloud} 75%);display:flex;align-items:center;justify-content:center}
img{width:62%}`,
`<img src="logo-4selet.png">`));
add('simbolo-showcase.html', 1080, 1080, '01-logos/simbolo-showcase-1x1.png', doc(1080,1080,
`body{background:${darkGrad('135deg')};display:flex;align-items:center;justify-content:center}
.box{width:46%;aspect-ratio:1;border-radius:14%;background:linear-gradient(135deg,#2464AE 0%,#1B264D 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 40px 90px rgba(0,0,0,.45)}
img{width:60%;filter:brightness(0) invert(1)}`,
`<div class="box"><img src="simbolo.svg"></div>`));

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Gerados ${manifest.length} HTMLs + manifest.json`);
