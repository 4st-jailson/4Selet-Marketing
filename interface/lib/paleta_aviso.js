// lib/paleta_aviso.js — a referência visual pede uma cor que a identidade não tem?
//
// O campo "Referência visual / clima" guia o texto e a escolha de layout, mas NÃO muda a paleta: as
// cores da arte vêm da identidade da 4Selet. Quando alguém escreve "cores de fim de tarde", o
// resultado sai azul do mesmo jeito — e a pessoa fica achando que o campo está quebrado.
//
// Este módulo detecta esse pedido e devolve um aviso com SAÍDA. Não bloqueia nada: o painel avisa,
// mostra qual paleta de campanha chega mais perto, e quem decide é a pessoa. É o fluxo consultivo
// que o Hugo desenhou desde o começo — modal com OK, nunca uma parede.
//
// Regra de precisão: só dispara quando a palavra é sobre COR. "Tranquilidade", "sóbrio" e
// "editorial" são clima, não cor, e passam direto — a identidade dá conta deles.
"use strict";
const { PALETAS_CAMPANHA } = require("./config");

// Cada família aponta para a paleta de campanha mais próxima (ou null = não há equivalente).
const FAMILIAS = [
  { paleta: "vermelho", termos: ["vermelho", "vermelha", "vermelhão", "carmim", "escarlate", "rubi", "bordô", "bordo", "vinho"] },
  { paleta: "dourado", termos: ["dourado", "dourada", "ouro", "champanhe", "bronze", "cobre", "caramelo", "mostarda"] },
  { paleta: "ambar", termos: ["âmbar", "ambar", "laranja", "alaranjado", "terracota", "ferrugem", "pêssego", "pessego", "coral"] },
  { paleta: "verde", termos: ["verde", "esmeralda", "menta", "oliva", "musgo", "jade"] },
  { paleta: null, termos: ["rosa", "pink", "roxo", "lilás", "lilas", "violeta", "púrpura", "purpura", "magenta", "amarelo", "amarela", "marrom", "bege", "creme", "neon", "fluorescente", "arco-íris", "arco iris", "colorido", "multicolorido"] },
];

// Cenas que implicam cor quente, mesmo sem nomear a cor. São as que aparecem de verdade em briefing.
const CENAS_QUENTES = [
  "fim de tarde", "pôr do sol", "por do sol", "entardecer", "amanhecer", "nascer do sol",
  "golden hour", "hora dourada", "crepúsculo", "crepusculo", "luz quente", "tons quentes",
  "cores quentes", "outono", "outonal", "deserto", "praia ao entardecer",
];

const semAcento = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Palavra inteira + plural. O plural é obrigatório ("tons dourados" é o jeito natural de escrever);
// a derivada NÃO ("verdejante", "rosado", "avermelhado" ficam de fora de propósito). A escolha é por
// PRECISÃO: num campo opcional, um alarme falso faz a pessoa parar de usar o campo, e o custo de não
// avisar é apenas a arte sair no azul — que é o que acontece hoje de qualquer jeito.
function contem(texto, termo) {
  const t = semAcento(termo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + t + "s?($|[^a-z0-9])", "i").test(texto);
}

/**
 * Analisa a referência visual.
 * Devolve null quando não há pedido de cor fora da identidade — o caso comum.
 * Devolve { termo, sugerida, label, mensagem, opcoes } quando há.
 */
function analisa(mood) {
  const texto = semAcento(mood);
  if (!texto.trim()) return null;

  let achado = null;
  for (const cena of CENAS_QUENTES) {
    if (contem(texto, cena)) { achado = { termo: cena, paleta: "ambar" }; break; }
  }
  if (!achado) {
    for (const f of FAMILIAS) {
      const t = f.termos.find((x) => contem(texto, x));
      if (t) { achado = { termo: t, paleta: f.paleta }; break; }
    }
  }
  if (!achado) return null;

  const p = achado.paleta && PALETAS_CAMPANHA[achado.paleta];
  const opcoes = [
    { id: "manter", label: "Manter a identidade 4Selet", detalhe: "A arte sai no azul da marca. A referência continua guiando o texto e o layout." },
  ];
  if (p) {
    opcoes.push({
      id: "campanha", paleta: achado.paleta,
      label: 'Usar a paleta "' + p.label + '"',
      detalhe: "Vale para todas as peças da campanha, não só para esta. É onde a marca permite sair do azul.",
    });
  }

  return {
    termo: achado.termo,
    sugerida: achado.paleta || null,
    label: p ? p.label : null,
    mensagem: p
      ? 'Você pediu "' + achado.termo + '", e isso está fora da paleta da 4Selet. A arte sai no azul da marca — a menos que a campanha desta peça use a paleta "' + p.label + '", que é o lugar onde a marca permite outra cor.'
      : 'Você pediu "' + achado.termo + '", e isso está fora da paleta da 4Selet. Não existe paleta de campanha equivalente, então a arte sai no azul da marca. A referência continua valendo para o texto e o layout.',
    opcoes: opcoes,
  };
}

module.exports = { analisa };
