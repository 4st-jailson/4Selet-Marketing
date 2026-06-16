#!/usr/bin/env node
"use strict";
/**
 * build_guide_html.js — Gera GUIA_DE_USO.html (documentacao profissional, paleta
 * 4Selet, sem emojis) a partir de GUIA_DE_USO.md. Conversor Markdown
 * self-contained (sem dependencias) que cobre os recursos usados no guia:
 *
 *   - headings com ancoras compativeis com GitHub (Sumario funciona) + link-anchor
 *   - tabelas (com iconizacao de palavras de status: Pronto / Pendente / Parcial...)
 *   - code fences
 *   - blockquotes aninhados
 *   - alertas estilo GitHub:  > [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION]
 *     renderizados como callouts com icone SVG inline (substitui emojis)
 *   - listas ordenadas / nao-ordenadas com aninhamento
 *   - regras horizontais e formatacao inline (negrito, italico, code, links)
 *
 * Uso: node scripts/build_guide_html.js
 *      "Regere o GUIA_DE_USO.html a partir do GUIA_DE_USO.md."
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "GUIA_DE_USO.md");
const OUT = path.join(ROOT, "GUIA_DE_USO.html");

// ---------- icones SVG (stroke currentColor, viewBox 24) ----------
const ICON = {
  info: '<path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="9"/>',
  tip: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
  important: '<path d="M3 11l18-5v12L3 14v-3zM7 12v6a2 2 0 0 0 2 2h1"/>',
  warning: '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  caution: '<polygon points="7.9 2 16.1 2 22 7.9 22 16.1 16.1 22 7.9 22 2 16.1 2 7.9"/><path d="M12 8v4M12 16h.01"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  pending: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  na: '<path d="M5 12h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
};
function svg(name, cls) {
  return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + "</svg>";
}

const ALERTS = {
  NOTE: { cls: "note", icon: "info", title: "Nota" },
  TIP: { cls: "tip", icon: "tip", title: "Dica" },
  IMPORTANT: { cls: "important", icon: "important", title: "Importante" },
  WARNING: { cls: "warning", icon: "warning", title: "Atenção" },
  CAUTION: { cls: "caution", icon: "caution", title: "Cuidado" },
};

// Palavra de status no inicio de uma celula -> icone (substitui emojis em tabelas).
const STATUS_WORDS = [
  { re: /^(Pronto|Dispon[ií]vel|Ativo|Sim|OK|Conclu[ií]do|Implementado)\b/i, cls: "ok", icon: "ok" },
  { re: /^(Pendente|Externo|Opcional|Futuro|Planejado)\b/i, cls: "pending", icon: "pending" },
  { re: /^(Parcial|Aten[cç][aã]o|Cuidado|Em\s+revis[aã]o)\b/i, cls: "warn", icon: "warning" },
  { re: /^(N[aã]o|N\/D|Indispon[ií]vel|Desativado)\b/i, cls: "na", icon: "na" },
];

// ---------- helpers ----------
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const slugCounts = Object.create(null);
function slugify(text) {
  let s = text
    .toLowerCase()
    .replace(/[ -⁯⸀-⹿\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, "")
    .replace(/\s/g, "-");
  if (slugCounts[s] === undefined) { slugCounts[s] = 0; return s; }
  slugCounts[s] += 1;
  return s + "-" + slugCounts[s];
}

function inline(text) {
  const codes = [];
  let t = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return " CODE" + (codes.length - 1) + " ";
  });
  t = escapeHtml(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
    const safe = String(url).replace(/"/g, "%22");
    const ext = /^https?:\/\//.test(safe);
    return '<a href="' + safe + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + txt + "</a>";
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  t = t.replace(/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, "$1<em>$2</em>");
  t = t.replace(/ CODE(\d+) /g, (_, i) => "<code>" + escapeHtml(codes[Number(i)]) + "</code>");
  return t;
}

// celula de tabela com possivel icone de status
function cell(raw) {
  for (const s of STATUS_WORDS) {
    if (s.re.test(raw.trim())) {
      return '<span class="st st-' + s.cls + '">' + svg(s.icon) + "</span>" + inline(raw);
    }
  }
  return inline(raw);
}

// ---------- block parser ----------
function parseBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }

    const fence = line.match(/^```+\s*(\S*)/);
    if (fence) {
      const lang = fence[1] || "";
      const buf = [];
      i++;
      while (i < lines.length && !/^```+\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre class="code"' + (lang ? ' data-lang="' + escapeHtml(lang) + '"' : "") +
        "><code>" + escapeHtml(buf.join("\n")) + "</code></pre>");
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const raw = h[2].replace(/\s+#+\s*$/, "");
      const id = slugify(raw);
      const anchor = level > 1 ? '<a class="anchor" href="#' + id + '" aria-label="link">' + svg("link") + "</a>" : "";
      out.push("<h" + level + ' id="' + id + '">' + inline(raw) + anchor + "</h" + level + ">");
      i++;
      continue;
    }

    if (/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // imagem em bloco (figura com legenda):  ![alt](src "legenda")
    const img = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (img) {
      const alt = escapeHtml(img[1] || "");
      const src = String(img[2]).replace(/"/g, "%22");
      const cap = img[3] ? '<figcaption>' + inline(img[3]) + "</figcaption>" : "";
      out.push('<figure class="fig"><img src="' + src + '" alt="' + alt + '" loading="lazy">' + cap + "</figure>");
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && (/^>\s?/.test(lines[i]) || (/^\s+\S/.test(lines[i]) && buf.length && !/^\s*$/.test(lines[i])))) {
        if (/^>\s?/.test(lines[i])) buf.push(lines[i].replace(/^>\s?/, ""));
        else buf.push(lines[i]);
        i++;
      }
      // alerta estilo GitHub?
      const first = buf.find((l) => l.trim() !== "") || "";
      const am = first.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
      if (am) {
        const def = ALERTS[am[1].toUpperCase()];
        const customTitle = am[2].trim();
        const idx = buf.indexOf(first);
        const rest = buf.slice(idx + 1);
        out.push('<div class="callout callout-' + def.cls + '">' +
          '<div class="callout-head">' + svg(def.icon) + "<span>" + escapeHtml(customTitle || def.title) + "</span></div>" +
          '<div class="callout-body">' + parseBlocks(rest).join("\n") + "</div></div>");
        continue;
      }
      out.push("<blockquote>" + parseBlocks(buf).join("\n") + "</blockquote>");
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const tbl = [];
      while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) { tbl.push(lines[i]); i++; }
      out.push(renderTable(tbl));
      continue;
    }

    if (/^(\s*)([-*+]|\d+\.)\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && (/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) ||
             (/^\s+\S/.test(lines[i]) && !/^\s*$/.test(lines[i])))) {
        buf.push(lines[i]); i++;
      }
      out.push(renderList(buf));
      continue;
    }

    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,6})\s+/.test(lines[i]) && !/^```+/.test(lines[i]) &&
           !/^>\s?/.test(lines[i]) && !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
           !/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
           !/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    if (para.length) out.push("<p>" + inline(para.join(" ").trim()) + "</p>");
  }
  return out;
}

function renderTable(rows) {
  const cells = (r) => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  const header = cells(rows[0]);
  const aligns = cells(rows[1]).map((c) => {
    const l = c.startsWith(":"), r = c.endsWith(":");
    if (l && r) return "center"; if (r) return "right"; if (l) return "left"; return "";
  });
  let html = '<div class="table-wrap"><table>\n<thead><tr>';
  header.forEach((c, idx) => {
    html += "<th" + (aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "") + ">" + inline(c) + "</th>";
  });
  html += "</tr></thead>\n<tbody>\n";
  for (let r = 2; r < rows.length; r++) {
    const cs = cells(rows[r]);
    html += "<tr>";
    cs.forEach((c, idx) => {
      html += "<td" + (aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "") + ">" + cell(c) + "</td>";
    });
    html += "</tr>\n";
  }
  html += "</tbody></table></div>";
  return html;
}

function renderList(lines) {
  function build(items) {
    let html = "";
    let type = null;
    let i = 0;
    const open = (t) => { type = t; html += "<" + t + ">"; };
    while (i < items.length) {
      const m = items[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (!m) { i++; continue; }
      const indent = m[1].length;
      const ordered = /\d+\./.test(m[2]);
      const wantType = ordered ? "ol" : "ul";
      if (type === null) open(wantType);
      const childLines = [];
      let content = m[3];
      i++;
      while (i < items.length) {
        const mm = items[i].match(/^(\s*)([-*+]|\d+\.)\s+/);
        const childIndent = items[i].match(/^(\s*)/)[1].length;
        if (mm && childIndent > indent) { childLines.push(items[i]); i++; continue; }
        if (!mm && childIndent > indent) { content += " " + items[i].trim(); i++; continue; }
        break;
      }
      html += "<li>" + inline(content.trim());
      if (childLines.length) html += build(childLines);
      html += "</li>";
    }
    if (type) html += "</" + type + ">";
    return html;
  }
  return build(lines);
}

// ---------- template ----------
function wrap(bodyHtml, title) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{
    --darker:#07212B; --navy:#003554; --blue:#006494; --sky:#5499B5;
    --mist:#AFBCC9; --cloud:#D9DCD6; --ink:#102a36; --muted:#5b7180;
    --paper:#f5f7f7; --surface:#ffffff; --code-bg:#07212B; --border:#dde4e6;
    --ok:#1f8a52; --pending:#7a6a1f; --warn:#9a6212; --na:#697a84;
    --max:880px;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    line-height:1.7; font-size:16px; -webkit-font-smoothing:antialiased;
  }
  .ic{width:1.05em;height:1.05em;flex:0 0 auto;vertical-align:-.16em}
  .topbar{
    position:sticky; top:0; z-index:20; background:var(--darker); color:var(--cloud);
    padding:13px 28px; box-shadow:0 1px 0 rgba(255,255,255,.04),0 4px 16px rgba(0,0,0,.22);
    display:flex; align-items:center; gap:12px;
  }
  .topbar .mark{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,var(--blue),var(--sky));
    display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;letter-spacing:-1px}
  .topbar b{font-weight:700;letter-spacing:.2px;font-size:15px}
  .topbar small{color:var(--mist);margin-left:auto;font-size:12.5px;font-weight:500}
  .layout{max-width:var(--max);margin:0 auto;padding:48px 28px 120px}
  h1,h2,h3,h4,h5,h6{color:var(--navy);line-height:1.3;font-weight:700;position:relative}
  h1,h2,h3,h4{scroll-margin-top:74px}
  h1{font-size:2.05rem;margin:.1em 0 .2em;letter-spacing:-.5px}
  h2{font-size:1.5rem;margin:2.2em 0 .6em;padding-bottom:.3em;border-bottom:2px solid var(--sky)}
  h3{font-size:1.2rem;margin:1.8em 0 .4em;color:var(--blue)}
  h4{font-size:1.02rem;margin:1.4em 0 .3em;color:var(--blue);text-transform:none}
  p{margin:.7em 0}
  a{color:var(--blue);text-decoration:none}
  a:hover{text-decoration:underline}
  .anchor{position:absolute;left:-1.4em;top:.18em;opacity:0;color:var(--mist);padding:0 .25em;transition:opacity .15s}
  .anchor .ic{width:.8em;height:.8em}
  h2:hover .anchor,h3:hover .anchor,h4:hover .anchor{opacity:1}
  code{
    font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    background:#e9eef0;color:var(--darker);padding:.12em .42em;border-radius:5px;font-size:.86em;
  }
  pre.code{
    background:var(--code-bg);color:#e9f0f3;padding:16px 18px;border-radius:10px;overflow:auto;
    border:1px solid #0e2d39;margin:1.1em 0;font-size:.85rem;line-height:1.6;position:relative;
  }
  pre.code[data-lang]::before{content:attr(data-lang);position:absolute;top:0;right:0;
    background:#0e2d39;color:var(--mist);font:600 10px/1 Inter,sans-serif;letter-spacing:.08em;
    text-transform:uppercase;padding:5px 9px;border-radius:0 10px 0 8px}
  pre.code code{background:none;color:inherit;padding:0;font-size:inherit}
  blockquote{margin:1.1em 0;padding:.5em 1.1em;border-left:3px solid var(--mist);color:#3a5360;background:#eef2f4;border-radius:0 8px 8px 0}
  blockquote>:first-child{margin-top:0}blockquote>:last-child{margin-bottom:0}
  /* callouts (alertas estilo GitHub, com icone) */
  .callout{margin:1.2em 0;border:1px solid var(--border);border-left-width:4px;border-radius:8px;
    background:var(--surface);padding:14px 18px}
  .callout-head{display:flex;align-items:center;gap:.5em;font-weight:700;font-size:.95rem;margin-bottom:.3em}
  .callout-head .ic{width:1.15em;height:1.15em}
  .callout-body>:first-child{margin-top:0}.callout-body>:last-child{margin-bottom:0}
  .callout-note{border-left-color:var(--blue)} .callout-note .callout-head{color:var(--blue)}
  .callout-tip{border-left-color:var(--ok)} .callout-tip .callout-head{color:var(--ok)}
  .callout-important{border-left-color:var(--navy)} .callout-important .callout-head{color:var(--navy)}
  .callout-warning{border-left-color:var(--warn)} .callout-warning .callout-head{color:var(--warn)}
  .callout-caution{border-left-color:#b3261e} .callout-caution .callout-head{color:#b3261e}
  .callout-note{background:#f0f6f9}.callout-tip{background:#eef7f1}.callout-warning{background:#fbf4ea}.callout-caution{background:#fcf0ef}
  /* tabelas */
  .table-wrap{overflow-x:auto;margin:1.2em 0;border:1px solid var(--border);border-radius:10px}
  table{border-collapse:collapse;width:100%;font-size:.92rem}
  th,td{border-bottom:1px solid var(--border);border-right:1px solid var(--border);padding:9px 13px;text-align:left;vertical-align:top}
  th:last-child,td:last-child{border-right:none}
  tbody tr:last-child td{border-bottom:none}
  thead th{background:var(--navy);color:var(--cloud);font-weight:600;font-size:.85rem;letter-spacing:.01em}
  tbody tr:nth-child(even){background:#f1f5f6}
  .st{display:inline-flex;vertical-align:-.16em;margin-right:.35em}
  .st .ic{width:1em;height:1em}
  .st-ok{color:var(--ok)}.st-pending{color:var(--pending)}.st-warn{color:var(--warn)}.st-na{color:var(--na)}
  /* figuras / diagramas */
  .fig{margin:1.6em 0;text-align:center}
  .fig img{max-width:100%;height:auto;border-radius:12px;border:1px solid var(--border);
    background:var(--surface);box-shadow:0 6px 22px rgba(7,33,43,.10)}
  .fig figcaption{margin-top:.6em;color:var(--muted);font-size:.86rem;font-style:italic}
  hr{border:none;border-top:1px solid var(--border);margin:2.4em 0}
  ul,ol{margin:.5em 0 1em;padding-left:1.5em}
  li{margin:.3em 0}
  li>ul,li>ol{margin:.3em 0}
  ::selection{background:var(--sky);color:#fff}
  .foot{margin-top:72px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
  @media(max-width:640px){.layout{padding:32px 18px 90px}h1{font-size:1.7rem}.anchor{display:none}}
</style>
</head>
<body>
  <header class="topbar"><span class="mark">4S</span><b>4Selet · Guia de Uso</b><small>Equipe de Marketing com IA</small></header>
  <main class="layout">
${bodyHtml}
    <p class="foot">Documento gerado a partir de <code>GUIA_DE_USO.md</code> · paleta oficial 4Selet · regenere com <code>node scripts/build_guide_html.js</code>.</p>
  </main>
</body>
</html>
`;
}

// ---------- main ----------
function main() {
  if (!fs.existsSync(SRC)) {
    console.error("ERRO: nao encontrei " + SRC);
    process.exit(1);
  }
  const md = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
  const lines = md.split("\n");
  const body = parseBlocks(lines).map((b) => "    " + b).join("\n");
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Guia de Uso — 4Selet";
  fs.writeFileSync(OUT, wrap(body, title), "utf8");
  console.log("OK: gerado " + path.relative(ROOT, OUT) + " (" + fs.statSync(OUT).size + " bytes)");
}

main();
