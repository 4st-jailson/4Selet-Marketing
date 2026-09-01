// capa_foto.js — a capa do carrossel ganha uma foto COERENTE COM O ASSUNTO, sozinha.
//
// O pedido do Hugo, nas palavras dele: que o primeiro slide venha "de maneira mais elaborada,
// onde apresentasse uma imagem coerente ao que está sendo abordado — ah, está sendo citado
// tecnologia, procure uma imagem de circuito; está falando sobre incorporações, coloque a
// imagem de uma pessoa, um CEO; está falando da plataforma 4Selet, apresente a imagem da
// própria plataforma".
//
// As três peças já existiam separadas e nunca tinham sido ligadas: a IA sabia sugerir um termo
// de busca (o campo `foto_busca` estava no prompt desde sempre e NINGUÉM lia), o painel sabia
// buscar no banco de imagens, e a capa sabia desenhar foto de fundo. Isto aqui é o fio.
//
// A terceira situação do pedido dele é a mais delicada e por isso tem tratamento próprio:
// quando a capa pede a TELA DA 4SELET, não existe foto de banco da nossa plataforma — usar a de
// outra empresa seria mentira na arte. Nesse caso o painel NÃO inventa: devolve uma pendência
// para quem opera anexar o print (ou capturar o site), que é o caminho que o painel já tem.
"use strict";
const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");
const pexels = require("./pexels");

const UP_DIR = path.join(PATHS.INTERFACE_DIR, "public", "uploads");

function magicExt(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ".png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  return null;
}
function safeStem(s) {
  return String(s || "capa").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "capa";
}

// Lê o pedido de capa em qualquer das formas que o modelo devolve. Aceitar apelido é barato e
// evita perder a foto por uma chave escrita de outro jeito.
function pedidoDeCapa(conceito) {
  if (!conceito || typeof conceito !== "object") return null;
  const c = conceito.capa_foto || conceito.capa || null;
  const busca = String(
    (c && (c.busca || c.query || c.termo)) || conceito.foto_busca || conceito.capa_busca || ""
  ).trim();
  const fonteBruta = String((c && (c.fonte || c.source)) || "").toLowerCase().trim();
  const fonte = /propri|plataforma|nossa/.test(fonteBruta) ? "propria"
    : (/nenhum|sem|none/.test(fonteBruta) ? "nenhuma" : (busca ? "banco" : "nenhuma"));
  const porque = String((c && (c.porque || c.motivo)) || "").trim();
  if (fonte === "nenhuma") return { fonte: "nenhuma" };
  return { fonte, busca, porque };
}

// A capa é 1080x1350 (retrato). Pedir retrato ao banco evita a foto deitada que, recortada,
// perde justamente o miolo — foi o defeito que já apareceu no mockup de notebook.
function melhorFoto(fotos) {
  const lista = Array.isArray(fotos) ? fotos.filter(Boolean) : [];
  if (!lista.length) return null;
  // Entre as devolvidas, prefere a mais alta que a larga (cabe na capa sem cortar o assunto).
  const retrato = lista.filter((f) => Number(f.height) > Number(f.width));
  return (retrato[0] || lista[0]);
}

// Busca, baixa e guarda UMA foto por termo. Tudo o que é genérico mora aqui — a checagem da
// chave, a busca, a escolha do retrato, as guardas de arquivo (é imagem mesmo? passa de 12 MB?) e
// a gravação no acervo. Quem chama decide o que fazer com o achado.
// Nasceu de dentro de `buscarCapa`: quando as CENAS DE VÍDEO também passaram a poder pedir foto,
// copiar essas oito guardas para o outro lado seria a receita de esquecer uma delas.
async function buscarPorTermo(busca, opts) {
  busca = String(busca || "").trim();
  opts = opts || {};
  if (!busca) return { ok: false, motivo: "sem_foto", explica: "Sem termo de busca." };
  if (!pexels.isConfigured()) {
    return { ok: false, motivo: "sem_chave", busca,
      explica: "Pediu a foto “" + busca + "”, mas o banco de imagens não está conectado. "
        + "Cole a chave em Configurações › Banco de imagens para o painel buscar sozinho." };
  }

  const r = await pexels.search(busca, { perPage: 24, orientation: opts.orientacao || "portrait" });
  if (!r || !r.ok) {
    return { ok: false, motivo: "busca_falhou", busca,
      explica: "Procurei “" + busca + "” no banco de imagens e a busca não respondeu." };
  }
  const foto = melhorFoto(r.photos || r.results || []);
  if (!foto) {
    return { ok: false, motivo: "sem_resultado", busca,
      explica: "Procurei “" + busca + "” e o banco não devolveu nenhuma foto. Vale trocar o termo." };
  }

  // lib/pexels já normaliza a resposta: `full` é a versão grande, `thumb` a miniatura.
  const url = foto.full || foto.thumb;
  if (!url) return { ok: false, motivo: "sem_arquivo", busca, explica: "A foto encontrada veio sem arquivo." };

  let img;
  try { img = await pexels.fetchImage(url); }
  catch (e) { return { ok: false, motivo: "download", busca, explica: "Não consegui baixar a foto: " + e.message }; }
  const ext = magicExt(img.buffer);
  if (!ext) return { ok: false, motivo: "nao_imagem", busca, explica: "O que veio do banco não é uma imagem válida." };
  if (img.buffer.length > 12 * 1024 * 1024) {
    return { ok: false, motivo: "grande", busca, explica: "A foto encontrada passa de 12 MB." };
  }

  fs.mkdirSync(UP_DIR, { recursive: true });
  const nome = (opts.prefixo || "capa") + "_" + safeStem(opts.nome || busca) + "_"
    + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36) + ext;
  fs.writeFileSync(path.join(UP_DIR, nome), img.buffer);

  return {
    ok: true,
    url: "/uploads/" + nome,
    busca,
    autor: (foto.photographer || "").trim() || null,
    autor_url: foto.photographer_url || null,
    largura: foto.width || null,
    altura: foto.height || null,
  };
}

// Busca, baixa e guarda a foto da capa. NÃO altera a peça: devolve o que achou para quem
// chamou decidir — assim o mesmo código serve para a geração e para um botão "trocar a capa".
async function buscarCapa(conceito, opts) {
  const pedido = pedidoDeCapa(conceito);
  if (!pedido || pedido.fonte === "nenhuma") {
    return { ok: false, motivo: "sem_foto", explica: "Esta capa não pede foto (o assunto é dado/número)." };
  }
  if (pedido.fonte === "propria") {
    return {
      ok: false, motivo: "propria", busca: pedido.busca, porque: pedido.porque,
      explica: "Esta capa pede uma imagem da PRÓPRIA plataforma 4Selet. Não existe foto de banco "
        + "da nossa tela, e usar a de outra empresa seria enganoso — anexe um print, ou capture o site.",
    };
  }
  const achado = await buscarPorTermo(pedido.busca, { nome: (opts && opts.nome) || pedido.busca, prefixo: "capa" });
  if (!achado.ok) return achado;
  return Object.assign({}, achado, { porque: pedido.porque });
}

// As CENAS DE VÍDEO podem pedir foto de fundo pelo campo `foto_busca`. Mesma máquina da capa, com
// duas diferenças que importam: o teto de 2 fotos por vídeo (fundo fotográfico em toda cena vira
// clipe de banco de imagem, não peça da marca) e a falha que NÃO derruba nada — a cena volta ao
// fundo em gradiente, que é o padrão.
const MAX_FOTOS_POR_VIDEO = 2;

async function fotosDasCenas(conceito, opts) {
  const cenas = (conceito && Array.isArray(conceito.scenes)) ? conceito.scenes : [];
  const pedidos = [];
  for (let i = 0; i < cenas.length; i++) {
    const c = cenas[i] || {};
    if (String(c.foto || "").trim()) continue;          // já tem foto anexada: respeita
    const termo = String(c.foto_busca || "").trim();
    if (termo) pedidos.push({ i, termo });
  }
  const resultado = { pedidas: pedidos.length, aplicadas: 0, avisos: [] };
  if (!pedidos.length) return resultado;
  if (pedidos.length > MAX_FOTOS_POR_VIDEO) {
    resultado.avisos.push("O roteiro pediu foto em " + pedidos.length + " cenas; usei nas "
      + MAX_FOTOS_POR_VIDEO + " primeiras para o vídeo não virar clipe de banco de imagem.");
  }
  for (const p of pedidos.slice(0, MAX_FOTOS_POR_VIDEO)) {
    let achado;
    try { achado = await buscarPorTermo(p.termo, { nome: (opts && opts.nome) || p.termo, prefixo: "cena" }); }
    catch (e) { achado = { ok: false, explica: "Não consegui buscar “" + p.termo + "”: " + e.message }; }
    if (achado && achado.ok) {
      cenas[p.i].foto = achado.url;
      cenas[p.i].fundo = "foto";
      cenas[p.i].foto_credito = achado.autor || null;
      resultado.aplicadas++;
    } else {
      resultado.avisos.push("Cena " + (p.i + 1) + ": " + ((achado && achado.explica) || "a foto não veio."));
    }
  }
  return resultado;
}

// Aplica no conceito: a foto vira o `image` da CAPA (primeiro slide), e o rastro do que foi
// escolhido fica junto — quem abrir a peça precisa saber que a foto veio de uma busca, com que
// termo, e de quem é o crédito.
// Devolve SE APLICOU. Antes devolvia o conceito e carimbava `capa_foto.aplicada` de qualquer
// jeito — inclusive quando a capa já tinha foto e a nova foi descartada. A tela lia esse carimbo
// e escrevia "A capa ganhou uma foto." com a miniatura ao lado, enquanto a capa continuava com a
// imagem antiga. O carimbo é a prova de que a foto entrou; não pode ser escrito quando não entrou.
function aplicarNaCapa(conceito, achado) {
  if (!conceito || !achado || !achado.ok) return false;
  const slides = Array.isArray(conceito.slides) ? conceito.slides : [];
  if (!slides.length) return false;
  // Não sobrescreve foto que já estava lá (a pessoa pode ter anexado a dela).
  if (String(slides[0].image || "").trim()) return false;
  slides[0].image = achado.url;
  conceito.capa_foto = Object.assign({}, conceito.capa_foto || {}, {
    busca: achado.busca, porque: achado.porque || null,
    aplicada: achado.url, autor: achado.autor, autor_url: achado.autor_url,
  });
  return true;
}

module.exports = { buscarCapa, aplicarNaCapa, pedidoDeCapa, melhorFoto, buscarPorTermo, fotosDasCenas, MAX_FOTOS_POR_VIDEO };
