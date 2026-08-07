// lib/capture.js — tira o print de uma página web e devolve como foto do acervo.
//
// O pedido do Hugo era direto: "o sistema acessa site e coisas do gênero para tirar prints... de
// forma que caso você não tivesse o link, solicitasse ele para o usuário". A segunda metade mora na
// tela (o painel pergunta o link quando falta). Esta é a primeira metade.
//
// O print entra no acervo como qualquer foto enviada à mão, então tudo que já existe passa a valer
// de graça: o layout "Print em aparelho" no carrossel, o mockup da peça de Mídia, o fundo de slide,
// o editor visual. Nada aqui sabe que a imagem veio de um site.
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const guard = require("./urlguard");
const { PATHS } = require("./config");

const UP_DIR = path.join(__dirname, "..", "public", "uploads");
const CAPTURE_TIMEOUT_MS = Number(process.env.CAPTURE_TIMEOUT_MS || 90 * 1000) || 90 * 1000;

// Tamanhos oferecidos na tela. O print não sai no formato da ARTE (1080x1350 deixaria o site
// espremido numa coluna de celular): sai no formato do APARELHO e a arte o encaixa depois — o
// layout "Print em aparelho" recorta pelo topo, que é onde mora a informação de uma página.
const PRESETS = {
  computador: { w: 1440, h: 900, rotulo: "Computador (1440 × 900)", device: "notebook" },
  notebook: { w: 1280, h: 800, rotulo: "Notebook (1280 × 800)", device: "notebook" },
  celular: { w: 390, h: 844, rotulo: "Celular (390 × 844)", device: "celular" },
  tablet: { w: 1024, h: 768, rotulo: "Tablet (1024 × 768)", device: "tablet" },
  pagina: { w: 1280, h: 900, rotulo: "Página inteira (rolagem toda)", device: "janela", fullPage: true },
};
const PRESET_PADRAO = "computador";

// Uma captura por vez. Cada captura é um Chromium inteiro; deixar N pessoas dispararem em paralelo
// derruba a memória do container antes de derrubar qualquer outra coisa.
let fila = Promise.resolve();
function emFila(fn) {
  const proximo = fila.then(fn, fn);
  fila = proximo.then(() => {}, () => {});
  return proximo;
}

function ensureDir() { try { fs.mkdirSync(UP_DIR, { recursive: true }); } catch (e) {} }

// Nome do arquivo derivado do site: "captura_valor-globo-com_kx82j.png" diz de onde veio quando a
// pessoa reencontra a foto no acervo três semanas depois.
function nomeArquivo(host) {
  const base = String(host || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "site";
  return "captura_" + base + "_" + Date.now().toString(36) + ".png";
}

function rodaScript(args, env) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, args, { cwd: PATHS.PROJECT_ROOT, env: Object.assign({}, process.env, env) });
    } catch (e) {
      return resolve({ ok: false, code: -1, stdout: "", stderr: (e && e.message) || String(e) });
    }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "", stderr = "", timedOut = false;
    const MAX = 1024 * 512;
    child.stdout.on("data", (d) => { if (stdout.length < MAX) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < MAX) stderr += d; });
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGTERM"); } catch (e) {}
      setTimeout(() => { try { child.kill("SIGKILL"); } catch (e) {} }, 5000).unref();
    }, CAPTURE_TIMEOUT_MS);
    child.on("error", (err) => { stderr += (err && err.message) || String(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, code: code === null ? -1 : code, stdout: stdout.trim(), stderr: stderr.trim(), timedOut });
    });
  });
}

// Captura de fato. Devolve { ok, name, url, host, titulo, preset } ou { ok:false, motivo }.
// `motivo` é sempre uma frase que a pessoa consegue ler e agir — nunca um stack trace.
async function capturaUrl(opcoes) {
  const o = opcoes || {};
  const presetId = Object.prototype.hasOwnProperty.call(PRESETS, o.preset) ? o.preset : PRESET_PADRAO;
  const preset = PRESETS[presetId];

  const v = await guard.verifica(o.url);
  if (!v.ok) return { ok: false, motivo: v.motivo, code: "E_URL" };

  return emFila(async () => {
    ensureDir();
    const name = nomeArquivo(v.host);
    const dest = path.join(UP_DIR, name);
    const script = path.join(PATHS.SCRIPTS_DIR, "capture_url.js");
    const args = [script, v.url, dest, String(preset.w), String(preset.h), "2", preset.fullPage ? "1" : "0"];
    const r = await rodaScript(args, { CAPTURE_PIN_IP: v.ip });

    if (!r.ok || !fs.existsSync(dest)) {
      try { fs.unlinkSync(dest); } catch (e) {}
      const bruto = String(r.stderr || "").replace(/^FALHA:\s*/i, "").split("\n")[0] || "";
      const motivo = r.timedOut
        ? "O site demorou demais para carregar (mais de " + Math.round(CAPTURE_TIMEOUT_MS / 1000) + "s) e a captura foi interrompida."
        : bruto
          ? "Não consegui capturar essa página: " + bruto
          : "Não consegui capturar essa página. Talvez o site bloqueie acesso automatizado — nesse caso, tire o print você mesmo e envie o arquivo.";
      return { ok: false, motivo, code: "E_CAPTURE" };
    }

    const titulo = (/^TITULO (.*)$/m.exec(r.stdout) || [])[1] || "";
    const urlFinal = (/^URLFINAL (.*)$/m.exec(r.stdout) || [])[1] || v.url;
    let bytes = 0;
    try { bytes = fs.statSync(dest).size; } catch (e) {}
    return {
      ok: true,
      name,
      url: "/uploads/" + name,
      host: v.host,
      titulo: titulo.trim(),
      url_final: urlFinal,
      preset: presetId,
      device: preset.device,
      largura: preset.w,
      altura: preset.h,
      bytes,
    };
  });
}

function listaPresets() {
  return Object.keys(PRESETS).map((id) => ({ id, rotulo: PRESETS[id].rotulo, device: PRESETS[id].device }));
}

module.exports = { capturaUrl, listaPresets, PRESETS, PRESET_PADRAO };
