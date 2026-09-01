#!/usr/bin/env node
// Refaz a arte 9:16 das peças APROVADAS e AINDA NÃO PUBLICADAS cuja versão de Story chegou pronta
// de fora (squad ou importada).
//
// POR QUE ISTO EXISTE
// Quando o sistema do squad manda a versão vertical no campo `cards[].story`, o painel grava a
// deles INTOCADA (lib/squad.js) — é o comportamento certo: a arte é deles, redesenhar jogaria o
// design fora. Só que a vertical que vinha chegando era a arte de feed encolhida e centralizada
// num campo chapado, com margem nos quatro lados. Sobrava moldura e faltava arte.
//
// Aqui cada uma dessas peças é reenquadrada pelo caminho do próprio painel (`enquadraStory`): a
// arte entra na LARGURA CHEIA e as faixas de cima e de baixo recebem a própria imagem desfocada.
// Nada do original se perde e a arte aparece bem maior.
//
// O RECORTE É DELIBERADO, e foi pedido assim:
//   - só a zona `approved` (o menu Aprovados);
//   - só peça SEM `published_at` — mexer numa peça publicada obrigaria a reabrir, e reabrir apaga
//     a marca de publicada (o rastro vai para `previous_publication`, mas a peça passa a parecer
//     não publicada). Peça no ar não se toca por causa de moldura;
//   - só arte que veio de FORA. Story desenhado pelo painel já nasce 1080×1920 de verdade;
//     reenquadrar ele seria trocar arte nativa por remendo.
//
// COMO RODA
//   node scripts/ajusta_story_aprovadas.js             → só RELATA (padrão; não escreve nada)
//   node scripts/ajusta_story_aprovadas.js --aplicar   → executa
//   ... --peca <pasta>                                 → limita a uma peça
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "..");
const APROVADAS = path.join(RAIZ, "outputs", "approved");
const KINDS_COM_VERSAO_STORY = ["feed", "image", "carousel", "media"];

function args(argv) {
  const o = { aplicar: false, peca: "" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--aplicar") o.aplicar = true;
    else if (argv[i] === "--peca") o.peca = String(argv[++i] || "");
  }
  return o;
}
function leJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } }
function listaArquivos(dir) { try { return fs.readdirSync(dir); } catch (e) { return []; } }

// A peça é candidata? Devolve o motivo da recusa quando não for — relatar POR QUE ficou de fora
// vale tanto quanto a lista do que entra: é assim que se percebe um recorte errado.
function avalia(pasta) {
  const dir = path.join(APROVADAS, pasta);
  const st = leJson(path.join(dir, "status.json"));
  if (!st) return { pasta, entra: false, motivo: "sem status.json" };
  if (st.published_at) return { pasta, entra: false, motivo: "já foi publicada — não se toca" };

  const cards = listaArquivos(path.join(dir, "story"))
    .filter((f) => /^story_\d+\.(png|jpe?g)$/i.test(f))
    .sort((a, b) => (Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])));
  if (!cards.length) return { pasta, entra: false, motivo: "não tem arte de Story" };

  const deFora = !!(st.imported || (st.origem && st.origem.sistema));
  if (!deFora) return { pasta, entra: false, motivo: "o Story foi desenhado pelo painel (já é 1080×1920 nativo)" };

  // O tipo da peça: `story` puro não entra (a arte dele já nasce vertical). Sem `slides/` e sem
  // `ads/`, também não há de onde enquadrar.
  const temSlides = listaArquivos(path.join(dir, "slides")).some((f) => /\.(png|jpe?g)$/i.test(f));
  const temAds = listaArquivos(path.join(dir, "ads")).some((f) => /\.(png|jpe?g)$/i.test(f) && !/\.(orig|bg)\./i.test(f));
  if (!temSlides && !temAds) return { pasta, entra: false, motivo: "não achei arte de origem em ads/ ou slides/" };

  return {
    pasta, entra: true, cards, temSlides,
    aprovadaPor: st.approved_by || "",
    origem: (st.origem && st.origem.sistema) || (st.imported ? "importada" : ""),
    task: st.task_name, data: st.task_date,
  };
}

// A arte de origem de CADA cartão. Num carrossel, o story_N corresponde ao slide_N — enquadrar
// todos a partir da mesma imagem transformaria a sequência em cinco cópias do primeiro slide.
function origemDoCartao(pasta, n, temSlides) {
  if (!temSlides) return "";                       // deixa o render escolher a arte principal
  const dirSlides = path.join(APROVADAS, pasta, "slides");
  const alvo = listaArquivos(dirSlides).find((f) => new RegExp("^slide_" + n + "\\.(png|jpe?g)$", "i").test(f));
  return alvo ? "slides/" + alvo : "";
}

function promove(task, data, para, quem) {
  const a = ["scripts/promote_task.js", "--task", task, "--date", data, "--to", para];
  if (para === "approved") a.push("--by", quem || "Ajuste de moldura 9:16");
  const r = spawnSync(process.execPath, a, { cwd: RAIZ, encoding: "utf8", windowsHide: true });
  return { ok: r.status === 0, saida: String(r.stdout || "") + String(r.stderr || "") };
}

(async () => {
  const o = args(process.argv);
  if (!fs.existsSync(APROVADAS)) { console.log("Não existe outputs/approved/ aqui."); process.exit(1); }

  const pastas = listaArquivos(APROVADAS)
    .filter((f) => fs.existsSync(path.join(APROVADAS, f, "status.json")))
    .filter((f) => !o.peca || f === o.peca);

  const avaliadas = pastas.map(avalia);
  const alvos = avaliadas.filter((x) => x.entra);
  const fora = avaliadas.filter((x) => !x.entra);

  console.log("Peças aprovadas examinadas: " + avaliadas.length);
  console.log("Entram no ajuste: " + alvos.length);
  alvos.forEach((a) => console.log("   • " + a.pasta + "  (" + a.cards.length + " cartão(ões) · origem: " + (a.origem || "—") + ")"));
  if (fora.length) {
    console.log("\nFicaram de fora:");
    const porMotivo = {};
    fora.forEach((f) => { (porMotivo[f.motivo] = porMotivo[f.motivo] || []).push(f.pasta); });
    Object.keys(porMotivo).forEach((m) => {
      console.log("   " + m + ": " + porMotivo[m].length);
      if (porMotivo[m].length <= 6) porMotivo[m].forEach((p) => console.log("      – " + p));
    });
  }
  if (!o.aplicar) {
    console.log("\nModo RELATÓRIO — nada foi escrito. Para executar: --aplicar");
    return;
  }
  if (!alvos.length) { console.log("\nNada a fazer."); return; }

  // O render mora no painel; só é carregado quando vai mesmo escrever.
  const render = require(path.join(RAIZ, "interface", "lib", "render.js"));

  const feitas = [], falhas = [];
  for (const a of alvos) {
    console.log("\n── " + a.pasta);
    const antes = a.cards.map((c) => {
      const p = path.join(APROVADAS, a.pasta, "story", c);
      const s = fs.statSync(p);
      return { c, bytes: s.size };
    });

    const abre = promove(a.task, a.data, "in_review", "");
    if (!abre.ok) { console.log("   não consegui reabrir: " + abre.saida.trim().slice(0, 200)); falhas.push({ pasta: a.pasta, onde: "reabrir", estado: "continua aprovada" }); continue; }
    console.log("   reaberta para edição");

    let erro = "";
    for (const c of a.cards) {
      const n = Number(c.match(/\d+/)[0]);
      const arte = origemDoCartao(a.pasta, n, a.temSlides);
      try {
        const r = await render.enquadraStory(a.pasta, arte ? { arte, n } : { n });
        if (!r || !r.ok) { erro = "cartão " + n + ": " + String((r && r.stderr) || "o desenho não ficou pronto").slice(0, 160); break; }
        console.log("   cartão " + n + " reenquadrado" + (arte ? " (de " + arte + ")" : ""));
      } catch (e) { erro = "cartão " + n + ": " + (e.code || e.message); break; }
    }

    // A peça VOLTA para aprovada aconteça o que acontecer. Deixá-la fora da zona por causa de uma
    // falha de render a faria sumir do menu Aprovados — um estrago maior do que a moldura.
    const fecha = promove(a.task, a.data, "approved", a.aprovadaPor);
    if (!fecha.ok) {
      console.log("   NÃO CONSEGUI DEVOLVER PARA APROVADA: " + fecha.saida.trim().slice(0, 240));
      falhas.push({ pasta: a.pasta, onde: "reaprovar", estado: "FORA da zona aprovada — precisa de mão" });
      continue;
    }
    if (erro) { console.log("   render falhou (" + erro + ") — peça devolvida para aprovada, arte intacta"); falhas.push({ pasta: a.pasta, onde: "render", estado: "aprovada, arte antiga" }); continue; }

    const depois = a.cards.map((c) => {
      const p = path.join(APROVADAS, a.pasta, "story", c);
      return { c, bytes: fs.existsSync(p) ? fs.statSync(p).size : 0 };
    });
    const mudou = depois.some((d, i) => d.bytes !== antes[i].bytes);
    console.log("   de volta em aprovada · arte " + (mudou ? "TROCADA" : "igual (suspeito)"));
    (mudou ? feitas : falhas).push({ pasta: a.pasta, onde: mudou ? "" : "arte não mudou", estado: "aprovada" });
  }

  console.log("\n" + "=".repeat(60));
  console.log("Ajustadas: " + feitas.length + " de " + alvos.length);
  if (falhas.length) {
    console.log("Precisam de atenção:");
    falhas.forEach((f) => console.log("   • " + f.pasta + " — " + f.onde + " → " + f.estado));
  }
})().catch((e) => { console.error("ERRO:", e && e.stack); process.exit(1); });
