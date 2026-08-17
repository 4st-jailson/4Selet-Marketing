// numeros_do_brief.js — o número que a pessoa escreveu no pedido tem que APARECER na peça.
//
// O pedido do Hugo: "para modelos que possuem o indicativo de um número, dê algum dado para ser
// mais específico. Caso no prompt informado tenha essa citação, é necessário que na respectiva
// criação seja apresentado esse mesmo valor."
//
// São dois problemas diferentes e este arquivo cuida do segundo, que é o mais grave:
//   1) desenho de número sem número — já resolvido: o seletor avisa que o layout precisa do dado;
//   2) NÚMERO QUE SOME — a pessoa escreve "PIX em D+10" no pedido e a peça sai falando de prazo
//      sem dizer qual. Some em silêncio, e só quem lembra do que pediu percebe.
//
// A governança já barrava número que CONTRADIZ a campanha. Isto é o contrário: o número está
// certo, e simplesmente não chegou na arte.
"use strict";

// O que conta como número que a pessoa quis ver na peça. Deliberadamente conservador: é melhor
// deixar passar um número duvidoso do que encher a tela de aviso que não interessa.
const PADROES = [
  { re: /\b\d{1,3}(?:[.,]\d+)?\s*%/g, tipo: "percentual" },                 // 95%  ·  96,4 %
  { re: /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi, tipo: "dinheiro" },        // R$ 1,99  ·  R$ 300 mil
  { re: /\bD\s?\+\s?\d{1,3}\b/gi, tipo: "prazo" },                           // D+10
  { re: /\b\d{1,3}\s?x\b/gi, tipo: "parcelas" },                             // 12x
  { re: /\b\d{1,3}(?:\.\d{3})+\b/g, tipo: "quantidade" },                    // 300.000
  { re: /\b\d{1,3}\s*mil\b/gi, tipo: "quantidade" },                         // 300 mil
];
// Números que são INSTRUÇÃO para o painel, não conteúdo da peça. Sem esta lista, pedir "faça 6
// slides" viraria um aviso dizendo que o 6 não apareceu na arte.
const INSTRUCAO = /\b\d{1,3}\s*(slides?|cards?|artes?|pe[çc]as?|imagens?|linhas?|caracteres?|palavras?)\b/gi;

function normaliza(s) {
  return String(s || "")
    .replace(/\s+/g, "")           // "D+ 10" e "D+10" são o mesmo número
    .replace(/\.(?=\d{3}\b)/g, "") // 300.000 -> 300000
    .toLowerCase();
}

// Os números que a pessoa escreveu no pedido, sem os que são instrução para o painel.
function numerosDoBrief(brief) {
  const texto = String(brief || "").replace(INSTRUCAO, " ");
  const achados = [];
  const vistos = new Set();
  for (const p of PADROES) {
    let m;
    const re = new RegExp(p.re.source, p.re.flags);
    while ((m = re.exec(texto))) {
      const bruto = m[0].trim();
      const chave = normaliza(bruto);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      achados.push({ valor: bruto, chave, tipo: p.tipo });
    }
  }
  return achados;
}

// Todo texto que vai virar arte ou legenda. Percorre o objeto inteiro porque cada layout guarda
// o número num lugar diferente: stats[].value, gauge.value, versus.a, flow[].sub, title, body...
function textoDoConteudo(parsed) {
  const partes = [];
  const anda = (v, prof) => {
    if (v == null || prof > 6) return;
    if (typeof v === "string" || typeof v === "number") { partes.push(String(v)); return; }
    if (Array.isArray(v)) { v.forEach((x) => anda(x, prof + 1)); return; }
    if (typeof v === "object") { Object.keys(v).forEach((k) => anda(v[k], prof + 1)); }
  };
  anda(parsed, 0);
  return partes.join(" \n ");
}

// Quais números do pedido NÃO chegaram na peça.
function numerosQueSumiram(brief, parsed) {
  const pedidos = numerosDoBrief(brief);
  if (!pedidos.length) return [];
  const alvo = normaliza(textoDoConteudo(parsed));
  return pedidos.filter((n) => alvo.indexOf(n.chave) === -1);
}

// O aviso, escrito para quem opera — dizendo o que sumiu e o que fazer.
function avisoDeNumeros(sumidos) {
  if (!sumidos || !sumidos.length) return null;
  const lista = sumidos.map((n) => "“" + n.valor + "”").join(", ");
  const um = sumidos.length === 1;
  return "Você citou " + lista + " no pedido, e " + (um ? "esse número não apareceu" : "esses números não apareceram")
    + " em nenhum slide nem na legenda. Se " + (um ? "ele é" : "eles são") + " o ponto da peça, vale reescrever o slide "
    + "que deveria carregá-" + (um ? "lo" : "los") + " — ou pedir de novo, citando o número na frase.";
}

module.exports = { numerosDoBrief, numerosQueSumiram, avisoDeNumeros, textoDoConteudo };
