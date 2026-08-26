// Miniaturas das artes — para o cartão não baixar a peça inteira.
//
// O problema, medido em produção: abrir a tela de Conteúdo baixava 21 MB. Cada cartão pedia a arte
// original (2160×2700, até 3,3 MB) e o navegador encolhia por CSS para 255×191 — 72 vezes mais
// pixels do que ia desenhar, dez de dez miniaturas com mais de 4× o tamanho necessário.
//
// Duas decisões que valem explicar:
//
// 1) A miniatura NÃO pode ser gravada dentro da pasta da peça. O gate de aprovação (R5) confere
//    `content_hashes` varrendo a pasta inteira e só ignora uma lista fixa de arquivos — um
//    `.thumb.jpg` novo lá dentro derrubaria a publicação com E_HASH_MISMATCH. Por isso o cache mora
//    em interface/data/thumbs (fora das peças, ignorada pelo git, volume persistente em produção).
//
// 2) Faltando a miniatura, servimos a arte ORIGINAL na hora e geramos a miniatura em segundo plano.
//    Ninguém espera Chromium abrir para ver um cartão: na pior hipótese a tela se comporta como
//    antes, e a partir da segunda visita fica leve. Nunca fica pior do que já era.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const CACHE = path.join(__dirname, "..", "data", "thumbs");
const SCRIPT = path.join(RAIZ, "scripts", "thumb.js");
const LARGURA = 440;              // ~2× o maior cartão (255px), para não borrar em tela retina
const TETO_SIMULTANEO = 2;        // Chromium é caro; a fila protege o servidor de abrir 12 de uma vez
const PRAZO_MS = 45000;

const IMAGEM = /\.(png|jpe?g|webp)$/i;

let rodando = 0;
const fila = [];
const emAndamento = new Map();    // chave -> Promise (não gera a mesma miniatura duas vezes)
const falhou = new Map();         // chave -> quando falhou (não insiste em loop)
const ESPERA_APOS_FALHA = 10 * 60 * 1000;

function ehImagem(rel) { return IMAGEM.test(String(rel || "")); }

// A chave carrega mtime e tamanho: reeditou a arte, a miniatura antiga deixa de ser encontrada
// sozinha — sem precisar invalidar nada à mão.
function chaveDe(abs, st) {
  return crypto.createHash("sha1")
    .update(abs + "|" + st.mtimeMs + "|" + st.size + "|" + LARGURA)
    .digest("hex");
}

function caminhoDe(chave) { return path.join(CACHE, chave + ".jpg"); }

function proximo() {
  if (rodando >= TETO_SIMULTANEO || !fila.length) return;
  const tarefa = fila.shift();
  rodando++;
  tarefa().finally(() => { rodando--; proximo(); });
}

function gera(abs, destino) {
  return new Promise((resolve) => {
    const tmp = destino + ".parcial";
    const p = spawn(process.execPath, [SCRIPT, abs, tmp, String(LARGURA)], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let erro = "";
    let encerrado = false;
    const relogio = setTimeout(() => { encerrado = true; try { p.kill(); } catch (e) {} }, PRAZO_MS);
    p.stderr.on("data", (d) => { erro += d.toString(); });
    p.on("close", (code) => {
      clearTimeout(relogio);
      if (encerrado || code !== 0 || !fs.existsSync(tmp)) {
        try { fs.unlinkSync(tmp); } catch (e) {}
        return resolve({ ok: false, motivo: encerrado ? "demorou demais" : (erro.trim() || "falha ao gerar") });
      }
      // rename só no fim: nunca existe meia-miniatura sendo servida
      try { fs.renameSync(tmp, destino); } catch (e) { return resolve({ ok: false, motivo: e.message }); }
      resolve({ ok: true });
    });
    p.on("error", (e) => { clearTimeout(relogio); resolve({ ok: false, motivo: e.message }); });
  });
}

// Retorna o caminho da miniatura SE ela já existir. Se não existir, dispara a geração em segundo
// plano e devolve null — quem chamou serve a arte original desta vez.
function miniatura(abs, rel) {
  if (!ehImagem(rel)) return null;
  let st;
  try { st = fs.statSync(abs); } catch (e) { return null; }
  const chave = chaveDe(abs, st);
  const destino = caminhoDe(chave);
  try { if (fs.statSync(destino).size > 0) return destino; } catch (e) {}

  const quandoFalhou = falhou.get(chave);
  if (quandoFalhou && Date.now() - quandoFalhou < ESPERA_APOS_FALHA) return null;
  if (emAndamento.has(chave)) return null;

  const tarefa = () => gera(abs, destino).then((r) => {
    emAndamento.delete(chave);
    if (!r.ok) { falhou.set(chave, Date.now()); console.warn("[thumbs] " + path.basename(abs) + ": " + r.motivo); }
    return r;
  });
  emAndamento.set(chave, true);
  fila.push(tarefa);
  proximo();
  return null;
}

// Espera a miniatura ficar pronta. Usado só pelo pré-aquecimento (script de backfill), nunca
// no caminho de uma requisição do navegador.
function garante(abs, rel) {
  if (!ehImagem(rel)) return Promise.resolve({ ok: false, motivo: "não é imagem" });
  let st;
  try { st = fs.statSync(abs); } catch (e) { return Promise.resolve({ ok: false, motivo: "arquivo sumiu" }); }
  const destino = caminhoDe(chaveDe(abs, st));
  try { if (fs.statSync(destino).size > 0) return Promise.resolve({ ok: true, ja: true, abs: destino }); } catch (e) {}
  return new Promise((resolve) => {
    fila.push(() => gera(abs, destino).then((r) => resolve(r.ok ? { ok: true, abs: destino } : r)));
    proximo();
  });
}

try { fs.mkdirSync(CACHE, { recursive: true }); } catch (e) {}

module.exports = { miniatura, garante, LARGURA, CACHE };
