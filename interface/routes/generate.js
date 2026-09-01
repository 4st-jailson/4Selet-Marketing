// routes/generate.js — geracao de conteudo com IA (prompt PADRAO + Claude),
// parsing estruturado, brand governance e salvamento na task/campanha.
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const ai = require("../lib/ai"); // dispatcher multi-provedor (Claude / OpenAI / ...)
const prompts = require("../lib/prompts");
const campaigns = require("../lib/campaigns");
const content = require("../lib/content");
const capaFoto = require("../lib/capa_foto");
const numerosDoBrief = require("../lib/numeros_do_brief");
const paletaAviso = require("../lib/paleta_aviso");
const researchLib = require("../lib/research");
const render = require("../lib/render");
const { contentTypeById, pillarById, APPROVED_CTAS, BRIEF_MAX_CHARS, PALETTE } = require("../lib/config");
const { runBrandGovernance, validateContentRequest } = require("../lib/validation");

// Extrai o primeiro objeto JSON de um texto (tolera code fences / texto ao redor).
function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(s); } catch (e) { /* tenta achar bloco */ }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { /* nada */ }
  }
  return null;
}

// O modelo INVENTA foto. Pedindo "foto de fundo" no tema, em 3 de 3 gerações ele escreveu caminhos
// como "/uploads/escritorio-moderno-computador.jpg" — arquivos que não existem no acervo. Ele não tem
// como saber o que existe lá, então preenche com um nome plausível. O efeito era silencioso: o campo
// ia para o disco, a arte aplicava o véu de leitura por cima de nada (slide mais escuro que os
// vizinhos, sem foto) e ninguém era avisado de que a foto pedida não saiu.
// Aqui a foto fantasma é removida e VIRA AVISO — o pedido não é engolido em silêncio.
function limpaFotosInventadas(parsed) {
  const removidas = [];
  if (!parsed || typeof parsed !== "object") return removidas;
  const confere = (obj, slide) => {
    if (!obj || typeof obj !== "object" || !obj.image) return;
    if (render.imagemExiste(obj.image)) return;
    removidas.push({ slide, caminho: String(obj.image).slice(0, 120) });
    delete obj.image;
  };
  confere(parsed, 0);                                     // 0 = a peça toda (não é slide)
  if (Array.isArray(parsed.slides)) parsed.slides.forEach((s, i) => confere(s, i + 1));
  return removidas;
}
function avisaFotosInventadas(gov, removidas) {
  if (!gov || !removidas || !removidas.length) return;
  if (!Array.isArray(gov.warnings)) gov.warnings = [];
  const ns = removidas.filter((r) => r.slide > 0).map((r) => r.slide);
  const onde = !ns.length ? "nesta peça"
    : ns.length === 1 ? "no slide " + ns[0]
      : "nos slides " + ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1];
  // O caminho inventado DIZ o que era pra ser. Quando o nome cheira a captura de tela, mandar a
  // pessoa "buscar uma foto de banco" é o conselho errado — nenhum banco de imagem tem o dashboard
  // da 4Selet. Aí o caminho é o print, no layout de aparelho.
  const pareceCaptura = removidas.some((r) => ehPedidoDePrint(r.caminho));
  gov.warnings.push("Você pediu " + (pareceCaptura ? "uma captura de tela " : "foto ") + onde + ", e a peça vai sair sem ela. "
    + "A IA não enxerga o seu acervo nem navega em sites por conta própria, então ela escreve o nome de um arquivo que não existe. "
    + "Resolva na janela que abriu: dá para capturar de um site (é só colar o link), enviar um arquivo seu, buscar uma foto ou trocar o que vai nesse lugar.");
}

// Palavras que denunciam pedido de CAPTURA DE TELA (e não de foto ilustrativa). A diferença muda o
// caminho oferecido: nenhum banco de imagens tem o dashboard da 4Selet nem a matéria do Valor.
// Palavras que denunciam CAPTURA DE TELA sem margem para dúvida. Aqui não entra "notebook" nem
// "checkout": elas dizem o ASSUNTO, não o meio.
const RE_CAPTURA = /\b(print|prints|captura|capturar|screenshot|screen shot|mockup)\b|captura de tela|tela do (site|sistema|painel|checkout|dashboard)|dashboard da|matéria publicada|materia publicada/i;
// Palavras que dizem, explicitamente, que o pedido é uma FOTOGRAFIA. Elas VENCEM as de aparelho.
const RE_FOTO = /\b(fotografia|fotografias|foto|fotos|still|cena|ambiente|bastidor|imagem editorial|banco de imagens|iluminação|iluminacao|profundidade de campo|enquadramento)\b/i;
// Palavras que sugerem tela, mas sozinhas não decidem nada.
const RE_TELA = /dashboard|painel|plataforma|tela d|checkout|interface|site|página|pagina|reportagem|matéria|materia/i;

// O Hugo pediu "uma fotografia editorial realista de um ambiente de trabalho... notebook aberto
// exibindo uma interface de checkout" e o painel montou um MOCKUP: desenhou um notebook e enfiou a
// foto na tela dele. O classificador via "notebook" e "checkout" e decidia que era captura de tela.
// Mas o pedido dizia "fotografia" — o notebook era o ASSUNTO da foto, não a moldura dela.
// Agora a ordem é: captura explícita manda; senão, a palavra "fotografia" manda; só então a tela.
function ehPedidoDePrint(txt) {
  const s = String(txt || "");
  if (RE_CAPTURA.test(s)) return true;
  if (RE_FOTO.test(s)) return false;
  return RE_TELA.test(s);
}

// PENDÊNCIA DE IMAGEM — a peça saiu, mas faltou uma imagem que o pedido descrevia.
//
// Antes isto era só um aviso em texto no meio de outros avisos, e o Hugo continuava no escuro:
// "não é interessante deixar o usuário no escuro, sendo preciso informar que há... não foi possível
// localizar a imagem informada, como devemos prosseguir? Ou você deseja subir um arquivo?"
//
// Agora vira um objeto que a tela sabe transformar em pergunta com saídas. Duas fontes alimentam a
// lista, e as duas importam:
//   (a) caminho de arquivo inventado — o modelo escreveu "/uploads/print-dashboard.jpg";
//   (b) o próprio modelo declarando no campo `limitacoes` que não conseguiu (quando ele nem tenta
//       inventar o caminho, que é o caso do slide 3 que reclamaram).
function pendenciasDeImagem(contentTypeId, removidas, limitacoes) {
  const out = [];
  const visto = new Set();
  const inclui = (slide, pedido, origem) => {
    const n = Number(slide) || 0;
    const chave = n + "|" + String(pedido).toLowerCase().slice(0, 60);
    if (visto.has(chave)) return;
    visto.add(chave);
    out.push({
      slide: n,
      pedido: String(pedido || "").trim().slice(0, 200),
      tipo: ehPedidoDePrint(pedido) ? "print" : "foto",
      origem,
    });
  };
  (removidas || []).forEach((r) => {
    // O caminho inventado é a melhor descrição disponível do que era para estar ali:
    // "/uploads/print-dashboard-4selet.jpg" -> "print dashboard 4selet".
    const legivel = String(r.caminho || "").split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    inclui(r.slide, legivel || "a imagem que você pediu", "caminho_inventado");
  });
  (limitacoes || []).forEach((l) => {
    const pedido = String((l && l.pedido) || "").trim();
    if (!pedido) return;
    // Só as limitações que são SOBRE imagem viram pendência; as outras seguem como aviso de texto.
    if (!/imagem|foto|print|captur|screenshot|tela|dashboard|mockup|gráfico|grafico|ilustra/i.test(pedido)) return;
    inclui(l.slide, pedido, "limitacao");
  });
  // Peça de Mídia sem print é peça que não existe — o print É o conteúdo. Se nada foi detectado,
  // ainda assim vale perguntar, porque o caminho normal dela começa pelo link da matéria.
  if (contentTypeId === "media_mention" && !out.length) {
    inclui(0, "o print da matéria publicada", "tipo_exige");
  }
  return out.slice(0, 8);
}

// O modelo declarou, no campo `limitacoes`, o que NÃO conseguiu entregar. Antes isso não existia:
// pedido um print da plataforma no slide 3, o painel entregou uma grade de números e ficou calado —
// e quem pediu só descobriu olhando a arte pronta. O campo `notes` do schema, onde algo assim
// poderia aparecer, nunca foi exibido na tela. Aqui a declaração vira aviso de marca, que a tela
// já sabe pintar.
// Corta no ESPAÇO anterior e marca com reticência. Cortar no meio da palavra e emendar um ponto
// final produz "gradiente rad." — a frase não parece abreviada, parece quebrada. Também tira os
// marcadores de realce (==palavra==, ::palavra::), que são instrução de desenho e não texto.
function encurtaFrase(t, n) {
  let s = String(t || "").replace(/==(.+?)==/g, "$1").replace(/::(.+?)::/g, "$1").trim();
  s = s.replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  if (s.length <= n) return s;
  const corte = s.slice(0, n);
  const esp = corte.lastIndexOf(" ");
  return (esp > n * 0.6 ? corte.slice(0, esp) : corte).replace(/[,;:\-–—]$/, "") + "…";
}

// Colhe o campo `limitacoes` do conceito e TIRA do JSON (é instrução para o modelo, não conteúdo
// da peça — sem isto ele viraria arquivo). Separado do aviso de propósito: a lista precisa existir
// ANTES, porque alimenta as pendências de imagem, e o aviso só sabe o que dizer depois de saber o
// que o painel já vai dizer por conta própria.
function colheLimitacoes(parsed) {
  const lista = parsed && Array.isArray(parsed.limitacoes) ? parsed.limitacoes.slice() : [];
  try { if (parsed) delete parsed.limitacoes; } catch (e) {}
  return lista;
}

// A IA declara em `limitacoes` o que ela não conseguiu entregar — mas ela não enxerga a TELA, e
// duas coisas saem erradas por causa disso:
//
//  1) Ela explica com o vocabulário de dentro do código ("a posição do logo é definida pelo
//     renderizador"), e a frase ainda é cortada em 150 caracteres no meio. Quando a tabela
//     PEDIDOS_DO_BRIEFING cobre o mesmo pedido (`cobertos`), quem fala é a tabela: mesma coisa em
//     português e, principalmente, dizendo ONDE a pessoa resolve. Sem esta troca o aviso pior
//     calava o melhor.
//  2) Ela declara como "ficou de fora" coisa que a pessoa JÁ escolheu no campo certo. Medido: com
//     Montserrat selecionado em Tipografia, a peça sai em Montserrat e a IA avisava que não ia
//     sair — aviso mentindo sobre a arte que a pessoa tem na frente. Por isso `entregue`.
function avisaLimitacoes(gov, lista, cobertos, ctx) {
  lista = Array.isArray(lista) ? lista : [];
  if (!gov || !lista.length) return lista;
  if (!Array.isArray(gov.warnings)) gov.warnings = [];
  const ids = (cobertos || []).map((c) => c.id);
  const jaExplicado = (pedido) => PEDIDOS_DO_BRIEFING.some((linha) => {
    const achado = linha.acha(pedido);
    if (!achado) return false;
    if (ids.indexOf(linha.id) >= 0) return true;                       // a tabela diz melhor
    return !!(linha.entregue && linha.entregue(ctx || {}, achado));    // a peça entregou mesmo
  });
  for (const l of lista.slice(0, 6)) {
    if (jaExplicado(String((l && l.pedido) || "") + " " + String((l && l.motivo) || ""))) continue;
    const pedido = encurtaFrase(l && l.pedido, 110);
    const motivo = encurtaFrase(l && l.motivo, 150);
    if (!pedido) continue;
    const onde = Number(l && l.slide) > 0 ? "Slide " + Number(l.slide) + ": " : "";
    // Antes: 'No slide 1: não consegui entregar "<220 chars do briefing>" — <220 chars de
    // justificativa técnica>.' Os dois cortes caíam no meio da palavra e ganhavam um ponto final,
    // então a frase terminava em "gradiente rad." e parecia texto quebrado. E o "não consegui
    // entregar" repetido seis vezes vira ruído: o que a pessoa precisa saber é O QUE ficou de fora
    // e O QUE FAZER, não uma confissão por slide.
    gov.warnings.push(onde + "ficou de fora — " + pedido + (motivo ? ". " + motivo : "."));
  }
  return lista;
}

// Alerta de marca PRÉ-aplicação: se o pedido do usuário citou cor fora da paleta oficial
// (branco puro / preto puro / neon), anexa um aviso explicando o impacto + a fonte (brand_identity.md).
// Vira warning no objeto de governança que o front já exibe.
function paletteWarn(gov, instruction) {
  if (!gov) return;
  const s = String(instruction || "").toLowerCase();
  if (/\bbranco\b|#fff\b|#ffffff\b|\bneon\b|preto puro/.test(s)) {
    if (!Array.isArray(gov.warnings)) gov.warnings = [];
    gov.warnings.push("Cor fora da paleta 4Selet: a marca não usa branco puro nem neon (fonte: brand_identity.md). O mais próximo na identidade é o tema claro (fundo Cloud #D9DCD6) — foi o que apliquei/priorizei.");
  }
}

// Junta os campos textuais de um conteudo estruturado para rodar governance.
// Junta TUDO que vai ser impresso na peça, para a governança de marca inspecionar.
//
// Ponto cego que isto corrige: antes o carrossel entregava só `title` e `body` de cada slide.
// Só que o número da peça quase nunca mora ali — ele mora no `stats` (o layout stat_grid, que é
// justamente o dos números: "95%", "R$ 1,99", "0%"), nos `items` da lista e nos `flow` das
// etapas. O próprio schema do prompt pede `"stats": [{ "value": "95%" }]`. Resultado: um número
// errado passava pela checagem de geração, passava pelo bloqueio do salvamento (o que devolve
// 422) e chegava no PNG sem nunca ter sido olhado. A checagem tem que ver o que é RENDERIZADO.
// Era uma LISTA BRANCA de campos: cada campo novo que virasse pixel escapava calado da checagem de
// concorrente, emoji e CTA proibido — inclusive o texto que lê MAIOR no slide. Passa a ser um
// caminhador: tudo que é texto entra, e o que não é texto para o leitor sai por uma lista curta de
// exceções (caminho de arquivo, id de layout, nome de ícone). Isto também tapa um buraco que já
// existia: item de lista em forma de objeto ({text}), aceito pelo render desde sempre, sumia daqui.
const CHAVES_NAO_TEXTO = ["image", "url", "icon", "device", "layout", "type", "theme", "tone", "estilo", "orient", "side"];
function textForGovernance(contentTypeId, parsed) {
  if (!parsed) return "";
  const parts = [];
  const vistos = new Set();   // objeto que se referencia não pode virar laço infinito
  const push = (v) => {
    if (v == null) return;
    if (typeof v === "string" || typeof v === "number") {
      const s = String(v).trim();
      if (s) parts.push(s);
      return;
    }
    if (typeof v !== "object") return;
    if (vistos.has(v)) return;
    vistos.add(v);
    if (Array.isArray(v)) { v.forEach(push); return; }
    Object.keys(v).forEach((k) => { if (CHAVES_NAO_TEXTO.indexOf(k) < 0) push(v[k]); });
  };

  // O FEED E A MÍDIA CAÍAM AQUI E SAÍAM CEDO — levando só o corpo, as hashtags e o CTA.
  //
    // A manchete e o apoio são justamente o que vai DESENHADO na arte, e eram os únicos campos que
  // o gate de marca nunca via: dava para salvar uma peça com o número da campanha errado dentro da
  // headline enquanto a tela escrevia "Passou na checagem da marca (sem problemas)". O texto que
  // vira imagem precisa passar pela mesma régua do texto que vira legenda.
  if (typeof parsed.body === "string") {
    push(parsed.body);
    push(parsed.hashtags);
    push(parsed.cta);
    push(parsed.headline);
    push(parsed.subtext);
    push(parsed.eyebrow);
    push(parsed.badge);
    return parts.join("\n");
  }
  for (const k of ["headline", "subtext", "concept", "hook", "caption", "cta", "eyebrow", "badge", "notes"]) push(parsed[k]);
  push(parsed.slides);
  push(parsed.cards);     // story
  push(parsed.scenes);
  push(parsed.hashtags);
  // Campos próprios da peça única (o concept não tem `slides`): a palavra gigante, a citação, os
  // dois lados da comparação e o rótulo da série são texto de marca como qualquer outro.
  ["word", "versus", "citacao", "serie"].forEach((k) => push(parsed[k]));
  return parts.join("\n");
}

// Mesma ideia para UM slide (usado ao regerar um slide isolado): tudo que aparece nele.
function textForGovernanceSlide(slide) {
  return textForGovernance("instagram_carousel", { slides: [slide || {}] });
}

// Formata o conteudo final que sera gravado no arquivo da task.
function formatContentFile(ct, parsed, raw) {
  if (!parsed) return raw || "";
  if (ct.format === "json") return JSON.stringify(parsed, null, 2) + "\n";
  // texto: body + hashtags
  let out = parsed.body || raw || "";
  if (Array.isArray(parsed.hashtags) && parsed.hashtags.length) {
    out = out.trim() + "\n\n" + parsed.hashtags.join(" ");
  }
  return out.trim() + "\n";
}

// POST /api/generate — gera (NAO salva). Retorna parsed + governance.
router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    if (!body.brief || String(body.brief).trim().length < 8) {
      return res.status(400).json({ error: "brief/tema obrigatorio (min 8 caracteres)" });
    }
    let campaign = null;
    if (body.campaign_id) {
      campaign = campaigns.get(body.campaign_id);
    }

    // Fatos de mercado: só entram os que a PESSOA aceitou na tela, e são revalidados aqui pelo
    // mesmo funil de segurança da busca. Sem esta revalidação o campo seria uma porta para injetar
    // texto arbitrário dentro do prompt de geração.
    //
    // Antes disto a pesquisa rodava DENTRO desta rota, sozinha, e enfiava 12 achados no prompt sem
    // ninguém olhar — medido, 2 deles eram o FAQ público de 4selet.com.br dizendo que a taxa é
    // "7,9% + R$ 2,00", contra o 0% por 3 meses e R$ 1,99 da campanha. A peça podia sair publicando
    // o preço errado da própria empresa, e passava no gate, porque 7,9% é legítimo como taxa DE
    // MERCADO. Agora nada chega aqui sem clique.
    const fatos = researchLib.validaAceitos(body.research_accepted);
    const research = fatos.length ? { fatos } : null;

    const req2 = Object.assign({}, body, { campaign, research });
    const system = prompts.systemPrompt();
    const userPrompt = prompts.generationPrompt(req2);

    const result = await ai.complete({
      system,
      prompt: userPrompt,
      // 2500 dava conta do schema antigo. Com os campos dos arquétipos novos (serie, citacao,
      // versus, word) um carrossel de 7 slides passa do teto e volta cortado — e JSON cortado vira
      // `parsed: null`, que na tela aparece como "a IA não entendeu". Ver a guarda logo abaixo.
      maxTokens: 4000,
      provider: body.provider, // IA escolhida na hora de gerar (default = padrao das Config.)
      simulate: () => prompts.simulate(req2),
    });

    // A mesma guarda que a /interpret já tinha e esta rota não: resposta cortada é um problema
    // DIFERENTE de resposta sem sentido, e quem lê a tela precisa saber o que fazer a respeito.
    if (result.stop_reason === "max_tokens") {
      return res.status(422).json({
        error: "A resposta ficou grande demais e foi cortada no meio. Peça menos slides ou um texto mais curto e tente de novo.",
        code: "E_RESPOSTA_TRUNCADA",
      });
    }

    const parsed = extractJson(result.text);
    // Orientacao de CTA do brief avancado: respeita a escolha do usuario (vale p/ real e simulado).
    // Sem orientacao -> campo cta vazio (sem chamada forcada). Com orientacao -> forca o texto escolhido.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parsed.cta = body.cta ? String(body.cta) : "";
      // Imagem do acervo (estilo "Foto"): injeta no conceito p/ o template Foto compor.
      if (body.image) parsed.image = String(body.image);
    }
    // A SUPERFÍCIE escolhida na criação vale como padrão de todos os slides da peça. Fica no
    // conceito (e não no render.json) porque é o carrossel que a lê, slide a slide — e assim
    // cada slide ainda pode ter o seu depois, sobrescrevendo este.
    if (body.fundo && render.FUNDO_IDS.indexOf(String(body.fundo)) >= 0 && parsed && typeof parsed === "object") {
      parsed.fundo = String(body.fundo);
    }
    const fotosInventadas = limpaFotosInventadas(parsed);
    // O brief vai junto porque uma das regras duras depende dele: a frase-tag da marca não pode
    // assinar peça, MAS é permitida quando quem pediu a peça pediu a frase. Sem passar o brief, o
    // gate reprovaria exatamente o caso legítimo.
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || result.text, { type: body.content_type, brief: body.brief });
    const limitacoes = colheLimitacoes(parsed);
    // Ordem importa: a lista de pendências é montada ANTES do aviso de foto inventada, porque o
    // aviso agora aponta para a janela ("resolva na janela que abriu") — e só faz sentido dizer isso
    // se a janela vai mesmo abrir.
    const pendencias = pendenciasDeImagem(body.content_type, fotosInventadas, limitacoes);

    // O QUE O TEXTO PEDIU E A PEÇA NÃO LEVOU. Calculado ANTES de escrever qualquer aviso porque é
    // ele quem decide o que a IA ainda precisa explicar: quando os dois falam da mesma coisa, vale
    // esta frase (que diz onde resolver) e não a justificativa técnica dela. Sem isto, pedir
    // "Manrope", "#FF6600" ou "logo no canto inferior direito" dava no mesmo que não ter pedido.
    const ctxDaPeca = {
      font: body.font,
      content_type: body.content_type,
      temImagem: !!(body.image || (parsed && parsed.image) || (parsed && Array.isArray(parsed.slides) && parsed.slides.some((s) => s && s.image))),
      pendencias: pendencias.length,
    };
    const naoAproveitado = pedidosNaoAproveitados(body.brief, ctxDaPeca);

    avisaLimitacoes(gov, limitacoes, naoAproveitado, ctxDaPeca);
    if (pendencias.length) avisaFotosInventadas(gov, fotosInventadas);

    // NÚMERO QUE SOME. Se a pessoa citou um valor no pedido ("PIX em D+10", "95%", "R$ 1,99") e
    // ele não aparece em slide nenhum nem na legenda, a peça saiu falando do assunto sem dizer o
    // número — e some em silêncio, porque só quem lembra do que pediu percebe a falta.
    // Diferente da governança, que barra número ERRADO: aqui o número está certo e não chegou.
    const sumidos = numerosDoBrief.numerosQueSumiram(body.brief, parsed);
    const avisoNum = numerosDoBrief.avisoDeNumeros(sumidos);
    if (avisoNum) {
      if (!Array.isArray(gov.warnings)) gov.warnings = [];
      gov.warnings.push(avisoNum);
    }

    // Entra por último na faixa de propósito: os avisos acima são sobre o que a IA escreveu, este
    // é sobre o que o painel não sabe fazer — e é o que fica mais perto do botão de ação.
    if (naoAproveitado.length) {
      if (!Array.isArray(gov.warnings)) gov.warnings = [];
      // Teto de 3: a faixa já pode trazer limitação declarada pela IA, foto inventada e número
      // que sumiu. Empilhar seis parágrafos faz a pessoa parar de ler todos.
      naoAproveitado.slice(0, 3).forEach((p) => gov.warnings.push(p.aviso));
    }

    res.json({
      simulated: result.simulated,
      model: result.model,
      provider: result.provider,
      parsed,
      raw: result.text,
      governance: gov,
      content_type: body.content_type,
      // research_sources era uma lista de 12 títulos crus (com nome de concorrente dentro, porque a
      // máscara nunca foi aplicada a eles). Agora são os fatos que a pessoa aceitou, e só.
      research_facts: fatos,
      // O que faltou de imagem, em forma de pergunta com saídas. Lista vazia = nada a resolver.
      pendencias_imagem: pendencias,
      // O que o texto pediu e a peça não levou, item a item ({ id, trecho, aviso }). As frases já
      // vão na faixa de conferência da marca acima; a lista sai estruturada para a tela poder
      // ancorar cada uma no campo certo depois, sem ter que reconhecer o pedido de novo.
      nao_aproveitado: naoAproveitado,
      // A referência visual pediu uma cor que a identidade não tem? Não bloqueia nada: a tela abre
      // um aviso com saídas e quem decide é a pessoa. null = nada a avisar (o caso comum).
      aviso_paleta: paletaAviso.analisa(body.mood || ""),
    });
  } catch (e) { next(e); }
});

// POST /api/generate/research — procura FATOS DE MERCADO para a pessoa aceitar ou recusar.
// Passo próprio, disparado por botão: a pesquisa saiu de dentro da geração porque (a) o Hugo pediu
// que o achado chegasse como sugestão que ele aceita, e (b) ela custava 4 a 5 segundos no caminho
// crítico de TODA geração com o antigo checkbox ligado.
router.post("/research", async (req, res, next) => {
  try {
    const body = req.body || {};
    const r = await researchLib.buscaFatos({ pillar: body.pillar, angulo: body.angulo, termo: body.termo, alternativa: !!body.alternativa });
    if (!r.available) {
      const motivo = r.reason === "no_key"
        ? "Sem chave da Tavily configurada. Peça a um administrador para colar a chave em Configurações."
        : r.reason === "no_sdk"
          ? "A biblioteca de pesquisa não está instalada no servidor."
          : "Não consegui pesquisar agora. Tente de novo em alguns instantes.";
      return res.json({ disponivel: false, motivo });
    }
    // `_rejeitados` é diagnóstico interno de calibragem — nunca sai para a tela.
    res.json({
      disponivel: true,
      cartoes: r.cartoes,
      descartados: r.descartados,
      examinados: r.examinados,
      creditos: r.creditos,
      do_cache: !!r.doCache,
      // Posição na fila de ângulos + a consulta usada. A tela mostra os dois: sem eles o botão de
      // "outro ângulo" era um salto no escuro, e quem clicava não tinha como saber se algo mudou.
      angulo: r.angulo,
      total_angulos: r.totalAngulos,
      termo: r.termo || "",
      consulta: r.query,
    });
  } catch (e) { next(e); }
});

// POST /api/generate/refine — ajusta uma peca existente conforme orientacao do
// usuario (mantendo o resto). NAO salva — retorna parsed + governance.
router.post("/refine", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    if (!body.instruction || String(body.instruction).trim().length < 3) {
      return res.status(400).json({ error: "orientacao de ajuste obrigatoria (min 3 caracteres)" });
    }
    if (body.current == null || String(body.current).trim() === "") {
      return res.status(400).json({ error: "conteudo atual ausente para ajustar" });
    }
    const campaign = body.campaign_id ? campaigns.get(body.campaign_id) : null;
    const req2 = Object.assign({}, body, { campaign });
    const system = prompts.systemPrompt();
    const userPrompt = prompts.refinementPrompt(req2);

    const result = await ai.complete({
      system,
      prompt: userPrompt,
      maxTokens: 2500,
      provider: body.provider, // IA escolhida na hora de ajustar
      images: Array.isArray(body.images) ? body.images : undefined, // referencia visual (visao)
      simulate: () => String(body.current), // sem chave: ecoa o atual (sinalizado como SIMULADO)
    });

    const parsed = extractJson(result.text);
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || result.text, { type: body.content_type, brief: body.brief });

    res.json({
      simulated: result.simulated,
      model: result.model,
      provider: result.provider,
      parsed,
      raw: result.text,
      governance: gov,
      content_type: body.content_type,
    });
  } catch (e) { next(e); }
});

// POST /api/generate/preview — previa RENDERIZADA da arte a partir do conceito em
// memoria (parsed), sem salvar nem exigir task. So vale para tipos visuais (image).
router.post("/preview", async (req, res, next) => {
  try {
    const body = req.body || {};
    const ct = contentTypeById(body.content_type);
    if (!ct) return res.status(400).json({ error: "content_type invalido" });
    const out = await render.renderPreview({
      content_type: body.content_type,
      parsed: body.parsed || extractJson(body.raw),
      template: body.template,
      logo: body.logo,
      watermark: body.watermark,
      font: body.font, // tipografia da peça: a prévia sai na MESMA família da arte final
      fundo: body.fundo, // superfície da arte: a prévia sai no MESMO fundo do render final
      folder: body.folder, // nome da peça: a rotação do "Automático" é por nome, e tem que bater
      // A COR DA CAMPANHA tambem na previa: sem este campo, a tela mostrava a arte na paleta da
      // marca e o arquivo salvo saia na cor da campanha. Aprovar uma e receber a outra.
      campanha: body.campaign_id || body.campanha || null,
      only: body.only, // renderiza só o slide desse índice (progresso "slide N de M" no carrossel)
      media: body.media, // metadados da "4Selet na Mídia" (print/modelo/veículo) p/ a prévia do mockup
    });
    if (!out.ok) return res.status(422).json(out);
    res.json(out);
  } catch (e) { next(e); }
});

// POST /api/generate/interpret — LÊ o tema escrito em linguagem natural e diz o que já está
// dito ali: formato, assunto (pilar) e chamada. NÃO gera conteúdo e NÃO salva nada.
//
// Três decisões que valem registro:
// 1) Só estes três campos. Todo o resto do texto (tom, o que destacar, clima) já vai LITERAL
//    para o modelo na hora de gerar — extrair e reinjetar no mesmo prompt não muda a saída.
//    Estes três são os únicos que trocam caminho de código: o formato troca schema e renderer,
//    o pilar injeta o ângulo temático, e a chamada inverte uma diretiva dura.
// 2) `key_offer` está deliberadamente FORA. É o único campo que vira número carimbado na arte
//    e era o vetor de invenção da versão anterior deste recurso.
// 3) Sem chave de IA não há interpretação. A versão anterior tinha um adivinhador por padrões
//    de texto que lia o "x" de "1080 x 1350" como a rede X e virava "Calcular minha economia"
//    sempre que a palavra "economia" aparecia. Chutar é pior do que não responder.
// A pessoa nomeou uma família tipográfica no texto? Casa pelo NOME da família (lista fechada de
// render.FAMILIAS), sem acento e sem depender de espaço ("DM Serif", "dmserif", "Bebas Neue").
// Devolve também o trecho que sustenta, para a tela poder mostrar de onde tirou.
function familiaPedidaNoTexto(texto) {
  const t = String(texto || "");
  const chato = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const alvo = chato(t);
  for (const id of render.FAMILIA_IDS) {
    const nome = render.FAMILIAS[id].label;
    const agulha = chato(nome);
    const at = alvo.indexOf(agulha);
    if (at < 0) continue;
    // Trecho legível: procura o nome no texto original, tolerando espaço/acento entre as letras.
    const re = new RegExp(nome.split(/\s+/).map((w) => w.split("").join("\\s*")).join("\\s+"), "i");
    const m = re.exec(t);
    return { id, nome, trecho: (m ? m[0] : nome).slice(0, 120) };
  }
  return null;
}

/* =============================================================================================
   O QUE O BRIEFING PEDE E O PAINEL NÃO LEVA ATÉ A PEÇA

   A leitura do tema preenche QUATRO campos: formato, assunto, chamada e tipografia. Todo o resto
   do que a pessoa escreve — cor em hexadecimal, aparelho/mockup, onde cada elemento fica, foto —
   não tem campo nenhum que o carregue até o desenho, e sumia sem UMA palavra. Num briefing de
   8.140 caracteres isso era a maior parte do texto: a tela dizia "Preenchi 3 campos pelo seu
   texto" e quem escreveu supunha que o resto tinha entrado junto. Fingir que aproveitou é pior
   do que não aproveitar — a pessoa só descobre olhando a arte pronta, e nem sempre descobre.

   O caso mais gritante era a TIPOGRAFIA: pedir "Manrope" não fazia nada porque a família não
   existe no motor, e pedir "Montserrat" — que EXISTE — também terminava em Inter sempre que a
   leitura do tema não rodava. Os dois desfechos eram silenciosos, e o silêncio era idêntico.

   A tabela abaixo é o ÚNICO lugar onde se declara o que o briefing sabe pedir. Cada linha diz
   como RECONHECER o pedido no texto, como saber se ele CHEGOU na peça, e o que DIZER quando não
   chegou. Campo novo (ou capacidade nova) entra aqui e passa a ser avisado sozinho — é isso que
   impede o mesmo buraco de voltar no próximo pedido que alguém inventar.
   ============================================================================================= */

// Nomes de fonte que aparecem em briefing de verdade e que o motor NÃO desenha. Não precisa ser
// exaustiva: o reconhecimento por CONTEXTO (RE_FONTE_CONTEXTO) pega o resto. Ela existe para o
// nome escrito solto, sem a palavra "tipografia" por perto — que é como "Manrope" foi pedido.
// Nomes que também são palavra comum em português ficam DE FORA de propósito (Futura, Circular,
// Lora, Karla, Impact, Georgia): num aviso, alarme falso custa mais caro do que o aviso que
// faltou — a pessoa para de ler a faixa inteira.
const FONTES_FORA_DO_MOTOR = [
  "Manrope", "Roboto", "Open Sans", "Lato", "Nunito", "Raleway", "Rubik", "Work Sans",
  "Source Sans", "Merriweather", "Helvetica", "Arial", "Times New Roman", "Garamond",
  "Gotham", "Avenir", "Proxima Nova", "Satoshi", "Outfit", "Figtree", "Plus Jakarta",
  "Barlow", "Mulish", "Quicksand", "Josefin Sans", "Archivo", "Libre Baskerville",
  "Cormorant", "Fira Sans", "IBM Plex", "Noto Sans", "PT Sans", "DM Sans", "Space Mono",
  "Comic Sans", "Verdana", "Tahoma", "Courier", "Gilroy",
];
// A identidade da marca. Pedir Inter (ou JetBrains Mono) não é "sair da identidade" — é pedir o
// que já acontece, e avisar sobre isso seria ruído puro.
const FONTES_DA_MARCA = ["Inter", "JetBrains Mono"];
// "tipografia Bricolage Grotesque", "font-family: Chillax" — nome que não está em lista nenhuma.
// A palavra "fonte" SOZINHA fica fora: no painel ela quase sempre quer dizer PROCEDÊNCIA
// ("fonte: CNDL", nos fatos de mercado), e confundir as duas produziria aviso de tipografia em
// cima de uma citação de reportagem.
const RE_FONTE_CONTEXTO = /(?:tipografia|fam[íi]lia\s+tipogr[áa]fica|fonte\s+tipogr[áa]fica|font[\s-]?family|typeface)\s*(?:[:=]\s*)?(?:(?:em|na|no|da|do|de|seja|usar|use|usando|com)\s+)?["']?([A-Z][A-Za-zÀ-ÿ0-9]*(?:\s+[A-Z][A-Za-zÀ-ÿ0-9]*){0,2})/;
// Cor por código. Só 6 dígitos: "#abc" casa com hashtag muito mais do que com cor, e hashtag é
// coisa que todo briefing tem. Os hexadecimais da PRÓPRIA identidade não contam — pedir o azul
// da marca é pedir o que a peça já faz.
const RE_COR_HEX = /#[0-9a-fA-F]{6}\b|\brgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/g;
const HEX_DA_MARCA = Object.keys(PALETTE || {}).map((k) => String(PALETTE[k]).toLowerCase());
// Moldura de aparelho. O painel só monta aparelho em cima de um PRINT — e print não vem de texto.
const RE_APARELHO = /\b(mockups?|mock-ups?|celular|smartphone|iphone|android|notebook|laptop|macbook|tablet|ipad|moldura)\b/i;
// Onde cada coisa fica. "logo" entra só colado a uma posição: sozinha, em português, ela quase
// sempre é o advérbio ("logo depois", "logo no começo") e não a marca.
const RE_COMPOSICAO = /\b(canto\s+(?:superior|inferior|esquerd|direit)|no\s+rodap[ée]|centralizad[oa]|alinhad[oa]\s+[àa]|[àa]\s+(?:esquerda|direita)\s+d[aeo]|grid\s*\d\s*x\s*\d|logo\s+(?:no\s+canto|no\s+rodap[ée]|em\s+cima|embaixo|maior|menor))/i;
// Imagem pedida em prosa (sem arquivo anexado nem foto escolhida).
const RE_IMAGEM = /\b(fotos?|fotografias?|imagem de fundo|foto de fundo|banco de imagens)\b/i;

// Lista das famílias que o motor realmente desenha, escrita como gente fala.
const emPortugues = (arr) => (arr.length <= 1 ? String(arr[0] || "") : arr.slice(0, -1).join(", ") + " e " + arr[arr.length - 1]);
const LISTA_FAMILIAS = () => emPortugues(render.FAMILIA_IDS.map((id) => render.FAMILIAS[id].label));

// Casa um nome respeitando a BORDA da palavra: sem isso "Lato" casaria dentro de "Latossolo" e
// "Arial" dentro de "Arialdo". Tolerante à caixa e ao espaço a mais entre as palavras do nome.
function achaNomeSolto(texto, nome) {
  const re = new RegExp("(^|[^A-Za-zÀ-ÿ0-9])(" + nome.replace(/\s+/g, "\\s+") + ")($|[^A-Za-zÀ-ÿ0-9])", "i");
  const m = re.exec(String(texto || ""));
  return m ? m[2] : null;
}

// A tipografia que o texto pede — EXISTA ela no motor ou não. É o que `familiaPedidaNoTexto`
// sozinha não dava: ela só enxerga a lista fechada, então "Manrope" caía no vazio.
//   { id: "montserrat", nome, trecho }  -> dá para aplicar
//   { id: "",           nome, trecho }  -> só dá para avisar que não vai valer
//   null                                -> o texto não pediu fonte nenhuma
function tipografiaNoTexto(texto) {
  const t = String(texto || "");
  const suportada = familiaPedidaNoTexto(t);
  if (suportada) return { id: suportada.id, nome: suportada.nome, trecho: suportada.trecho };
  for (const nome of FONTES_FORA_DO_MOTOR) {
    const tr = achaNomeSolto(t, nome);
    if (tr) return { id: "", nome, trecho: tr };
  }
  const m = RE_FONTE_CONTEXTO.exec(t);
  if (m && m[1]) {
    const nome = m[1].trim();
    if (FONTES_DA_MARCA.some((f) => f.toLowerCase() === nome.toLowerCase())) return null;
    return { id: "", nome, trecho: nome };
  }
  return null;
}

// ctx = { font, content_type, temImagem, pendencias } — o que a peça REALMENTE recebeu.
const PEDIDOS_DO_BRIEFING = [
  {
    id: "tipografia",
    acha: (t) => { const f = tipografiaNoTexto(t); return f ? { trecho: f.trecho, familia: f } : null; },
    // "Chegou" tem um desfecho só: a peça está saindo NESSA família. Sair na Inter sem uma
    // palavra não é um deles — nem quando a família existe, nem quando não existe.
    // Na LEITURA do tema a peça ainda não existe: família que o motor tem já vira a pergunta
    // "quer sair da identidade?" (campos.font), então avisar aqui seria falar duas vezes.
    chegou: (ctx, a) => !!(a.familia && a.familia.id) && (!!ctx.leitura || String(ctx.font || "") === a.familia.id),
    // A peça está SAINDO nessa família de verdade (não é "alguém já avisa por mim"). É o único
    // pedido desta tabela que o painel realmente entrega, e é o que faz a IA parar de declarar
    // "ficou de fora — Montserrat" numa arte que está saindo em Montserrat.
    entregue: (ctx, a) => !!(a.familia && a.familia.id) && String(ctx.font || "") === a.familia.id,
    aviso: (a) => {
      const f = a.familia || tipografiaNoTexto(a.trecho) || { id: "", nome: a.trecho };
      return f.id
        ? "Você escreveu " + f.nome + " no texto e esta peça saiu na Inter, a fonte da marca. "
          + "Trocar de fonte tira a peça da identidade, então o painel não troca sozinho: escolha "
          + f.nome + " no campo Tipografia e gere de novo."
        // Tempo verbal neutro de propósito: a mesma frase é dita ANTES de gerar (faixa de leitura)
        // e DEPOIS (conferência da marca). "Esta peça saiu" seria mentira na primeira das duas.
        : "Você pediu a tipografia " + f.nome + ", e ela não existe no desenho das peças — a arte sai "
          + "na Inter, a fonte da marca. As famílias que dá para escolher são: " + LISTA_FAMILIAS() + ". "
          + "Elas ficam no campo Tipografia, antes de gerar.";
    },
  },
  {
    id: "cor",
    acha: (t) => {
      RE_COR_HEX.lastIndex = 0;
      let m;
      while ((m = RE_COR_HEX.exec(String(t || "")))) {
        if (HEX_DA_MARCA.indexOf(m[0].toLowerCase()) < 0) return { trecho: m[0] };
      }
      return null;
    },
    chegou: () => false,   // não existe campo que leve uma cor livre até o desenho
    // O trecho pode vir de duas origens: o código que a expressão regular achou (#FF6600) ou a
    // frase que a leitura apontou ("num azul petróleo bem escuro"). A frase precisa de aspas e
    // NÃO pode ser chamada de código — "Você pediu a cor num azul petróleo no texto" não é
    // português de gente.
    aviso: (a) => {
      const ehCodigo = /^(#|rgb)/i.test(a.trecho);
      return (ehCodigo ? "Você pediu a cor " + a.trecho : "Você pediu \"" + a.trecho + "\"")
        + " e a peça não sai nessa cor: as cores vêm da identidade da 4Selet"
        + (ehCodigo ? ", e não existe campo para pedir uma cor por código" : "")
        + ". O que dá para mudar é o tema de cada slide (claro ou escuro), a superfície da arte na "
        + "criação, e a paleta da campanha — que é o único lugar onde a marca permite sair do azul.";
    },
  },
  {
    id: "aparelho",
    acha: (t) => { const m = RE_APARELHO.exec(String(t || "")); return m ? { trecho: m[0] } : null; },
    // Quando o painel já abriu a janela de imagem (pendência) ou a peça é a de Mídia, o assunto
    // já está sendo tratado lá com saídas — repetir aqui seria falar duas vezes a mesma coisa.
    chegou: (ctx) => ctx.pendencias > 0 || ctx.content_type === "media_mention",
    aviso: (a) => "Você falou em " + a.trecho + " no texto, e a peça não monta o aparelho por conta "
      + "própria: a moldura de celular ou notebook só existe em cima de um print, e print não vem de "
      + "texto. Depois de gerar, o botão \"+ Imagem\" do editor de arte captura a tela de um site pelo "
      + "link, recebe um arquivo seu ou busca uma foto de banco.",
  },
  {
    id: "imagem",
    acha: (t) => { const m = RE_IMAGEM.exec(String(t || "")); return m ? { trecho: m[0] } : null; },
    // Na leitura do tema é cedo demais para dizer que a peça saiu sem imagem — ela nem existe.
    chegou: (ctx) => !!ctx.leitura || ctx.temImagem || ctx.pendencias > 0,
    aviso: () => "Você pediu imagem no texto e esta peça saiu sem nenhuma. A IA não enxerga o seu "
      + "acervo e não escolhe foto por você. Na peça pronta dá para resolver: no carrossel, pela linha "
      + "\"Foto de fundo\" de cada slide; nas outras, pelo botão \"+ Imagem\" do editor de arte.",
  },
  {
    id: "composicao",
    acha: (t) => { const m = RE_COMPOSICAO.exec(String(t || "")); return m ? { trecho: m[0] } : null; },
    chegou: () => false,   // a posição vem do arranjo escolhido, nunca do texto
    aviso: (a) => "Você descreveu onde uma coisa deveria ficar (\"" + a.trecho + "\"). A posição dos "
      + "elementos vem do arranjo da peça, não do texto: escolha outro arranjo na criação, ou mova os "
      + "elementos você mesmo no editor de arte, depois que a peça existir.",
  },
];

// Categorias que o modelo pode devolver na leitura do tema (prompts.interpretPrompt). O nome vem
// de fora, então é traduzido aqui para uma linha da tabela — e o que não casar é descartado.
const CATEGORIA_PARA_PEDIDO = { cor: "cor", tipografia: "tipografia", fonte: "tipografia", posicao: "composicao", composicao: "composicao", aparelho: "aparelho", mockup: "aparelho", imagem: "imagem", foto: "imagem" };

// O que o texto pediu e a peça não levou. `extras` são os trechos que o modelo apontou na leitura
// (já conferidos contra o texto original por quem chama) — eles pegam o que a expressão regular
// não alcança ("quero num azul petróleo bem escuro").
function pedidosNaoAproveitados(texto, ctx, extras) {
  const out = [];
  const visto = new Set();
  for (const linha of PEDIDOS_DO_BRIEFING) {
    if (visto.has(linha.id)) continue;
    const doModelo = (extras || []).find((e) => CATEGORIA_PARA_PEDIDO[e.categoria] === linha.id);
    const achado = linha.acha(texto) || (doModelo ? { trecho: doModelo.trecho } : null);
    if (!achado) continue;
    if (linha.chegou(ctx || {}, achado)) continue;
    // O trecho da leitura vem em frase inteira ("a arte toda num azul petroleo bem escuro, quase
    // preto"). Dentro do aviso ele vira citação, e citação de 12 palavras faz a pessoa perder a
    // frase. Corta no espaço, com reticência — o mesmo tratamento das limitações declaradas.
    achado.trecho = encurtaFrase(achado.trecho, 70) || String(achado.trecho || "");
    visto.add(linha.id);
    out.push({ id: linha.id, trecho: String(achado.trecho || "").slice(0, 120), aviso: linha.aviso(achado) });
  }
  return out;
}

// A leitura do tema pode citar trechos que NÃO estão no texto (é o vetor de invenção deste
// recurso desde sempre). Só passa o que aparece literalmente lá — comparado sem acento e sem
// caixa, porque o modelo normaliza pontuação e maiúscula ao copiar.
function direcaoDeArteConferida(cru, texto) {
  const chato = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const base = chato(texto);
  return (Array.isArray(cru && cru.direcao_de_arte) ? cru.direcao_de_arte : [])
    .map((x) => ({ categoria: String((x && x.categoria) || "").toLowerCase().trim(), trecho: String((x && x.trecho) || "").trim().slice(0, 120) }))
    .filter((x) => x.trecho.length >= 3 && CATEGORIA_PARA_PEDIDO[x.categoria] && base.indexOf(chato(x.trecho)) >= 0)
    .slice(0, 8);
}

router.post("/interpret", async (req, res, next) => {
  try {
    const texto = String((req.body && req.body.texto) || "").trim();
    if (texto.length < 12) return res.status(400).json({ error: "Escreva um pouco mais para eu conseguir entender a peça.", code: "E_TEXTO_CURTO" });
    if (texto.length > BRIEF_MAX_CHARS) {
      // Diz o tamanho REAL e o limite: "muito longo" sozinho não ajuda a decidir o que cortar.
      return res.status(413).json({
        error: "Seu texto tem " + texto.length.toLocaleString("pt-BR") + " caracteres e eu leio até "
          + BRIEF_MAX_CHARS.toLocaleString("pt-BR") + ". Encurte o texto ou preencha os campos à mão.",
        code: "E_TEXTO_LONGO", tamanho: texto.length, limite: BRIEF_MAX_CHARS,
      });
    }
    if (!ai.hasKey || !ai.hasKey()) {
      // Sem chave não há interpretação — mas a TIPOGRAFIA é casamento de string, não precisa de
      // IA nenhuma, e estava atrás desta porta sem motivo: quem escrevia "Montserrat" com o
      // painel sem chave não ouvia uma palavra. Aqui ela sai junto do motivo, que é o texto que
      // a faixa de leitura já mostra.
      const fam = tipografiaNoTexto(texto);
      const sobreFonte = !fam ? ""
        : fam.id
          ? " Uma coisa eu vi sem precisar de IA: você escreveu " + fam.nome + " — se quiser a peça nessa fonte, escolha em Tipografia antes de gerar."
          : " Uma coisa eu vi sem precisar de IA: você pediu a tipografia " + fam.nome + ", que não existe no desenho das peças. As que dá para escolher são: " + LISTA_FAMILIAS() + ".";
      return res.json({
        disponivel: false,
        motivo: "Sem chave de IA configurada — não dá para interpretar o texto. Preencha os campos manualmente." + sobreFonte,
        campos: {},
        nao_aproveitado: pedidosNaoAproveitados(texto, { leitura: true }, []),
      });
    }

    const result = await ai.complete({
      system: prompts.interpretSystem(),
      prompt: prompts.interpretPrompt({ texto }),
      maxTokens: 700,
      provider: (req.body && req.body.provider),
      simulate: () => "{}",
    });
    // Truncagem NÃO pode virar "não entendi nada": sem esta guarda o modelo para no meio,
    // extractJson devolve null e a rota respondia 200 com campos vazios — igualzinho a um texto
    // que realmente não dizia nada. Quem lê a tela não tem como distinguir os dois casos.
    if (result.stop_reason === "max_tokens") {
      return res.status(422).json({ error: "Não consegui terminar a leitura do seu texto desta vez. Tente de novo ou preencha os campos à mão.", code: "E_LEITURA_TRUNCADA" });
    }
    const cru = extractJson(result.text);
    if (!cru) {
      return res.status(422).json({ error: "Não consegui entender a resposta da leitura desta vez. Tente de novo ou preencha os campos à mão.", code: "E_LEITURA_INVALIDA" });
    }

    // Só entra o que existe nas taxonomias reais. O modelo não cria valor novo aqui.
    const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    // A comparação era por igualdade EXATA, e por isso perdia o caso mais comum: a pessoa escreve
    // "Conheça a plataforma" e a lista oficial diz "Conhecer a plataforma" — mesma chamada, verbo
    // em outra forma, resultado descartado em silêncio. Comparar pelo radical das palavras com 3+
    // letras resolve conjugação e acento sem aproximar chamadas diferentes entre si (conferido
    // contra a lista inteira: nenhuma colide com outra).
    const radical = (s) => norm(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3).map((w) => w.slice(0, 4)).sort().join("|");
    const ctaOk = (APPROVED_CTAS.find((c) => norm(c) === norm(cru.cta))
      || (norm(cru.cta) ? APPROVED_CTAS.find((c) => radical(c) && radical(c) === radical(cru.cta)) : null)
      || "");
    const tipoOk = contentTypeById(cru.content_type) ? String(cru.content_type) : "";
    const pilarOk = pillarById(cru.pillar) ? String(cru.pillar) : "";
    const conf = (k) => (["alta", "media", "baixa"].indexOf(String((cru.confianca || {})[k])) >= 0 ? String(cru.confianca[k]) : "media");

    const campos = {};
    if (tipoOk) campos.content_type = { valor: tipoOk, confianca: conf("content_type"), porque: String((cru.porque || {}).content_type || "").slice(0, 200) };
    if (pilarOk) campos.pillar = { valor: pilarOk, confianca: conf("pillar"), porque: String((cru.porque || {}).pillar || "").slice(0, 200) };
    if (ctaOk) campos.cta = { valor: ctaOk, confianca: conf("cta"), porque: String((cru.porque || {}).cta || "").slice(0, 200) };
    else if (cru.cta_ausente === true) campos.cta = { valor: "", sem_cta: true, confianca: conf("cta"), porque: String((cru.porque || {}).cta || "").slice(0, 200) };

    // `faltou` só pode citar os campos que a leitura realmente tenta preencher. Era texto livre do
    // modelo impresso cru na tela: numa execução real ele devolveu ["cta","numero_destaque",
    // "headline","dado_ou_percentual_de_aprovacao"], e quem lesse a tela veria nomes de variável.
    // O que ele nomear fora desses três não é campo — é observação, e não cabe nesse aviso.
    // Tipografia pedida no próprio texto. Detectada AQUI, por nome, sem passar pelo modelo: a lista
    // é fechada e os nomes são literais, então casar a string é exato e de graça — e continua
    // funcionando quando a leitura por IA falha. A tela usa isso para abrir o aviso de "família fora
    // da identidade" antes de aplicar; nada é trocado sozinho.
    const familia = familiaPedidaNoTexto(texto);
    if (familia) campos.font = { valor: familia.id, confianca: "alta", porque: familia.trecho, fora_da_identidade: true };

    const CAMPOS_LIDOS = ["content_type", "pillar", "cta"];
    const faltou = (Array.isArray(cru.faltou) ? cru.faltou : [])
      .map((x) => String(x).trim())
      .filter((x) => CAMPOS_LIDOS.indexOf(x) >= 0 && !campos[x])
      .filter((x, i, a) => a.indexOf(x) === i);
    // O QUE O TEXTO PEDE E A LEITURA NÃO SABE APROVEITAR. Os quatro campos acima são tudo o que
    // ela preenche; cor, aparelho, posição e tipografia fora do motor não têm campo nenhum e
    // sumiam sem uma palavra. Sai como lista para a faixa de leitura poder dizer o que ficou de
    // fora ANTES de gastar uma geração — e a mesma frase reaparece na conferência da marca
    // depois de gerar, porque é lá que a peça pronta é conferida.
    const naoAproveitado = pedidosNaoAproveitados(texto, { leitura: true }, direcaoDeArteConferida(cru, texto));
    res.json({ disponivel: true, simulated: !!result.simulated, model: result.model, provider: result.provider, campos, faltou, nao_aproveitado: naoAproveitado });
  } catch (e) { next(e); }
});

// POST /api/generate/assistant — assistente de ajuda/uso da ferramenta.
router.post("/assistant", async (req, res, next) => {
  try {
    const question = (req.body && req.body.question) || "";
    if (!question.trim()) return res.status(400).json({ error: "pergunta obrigatoria" });
    const ctx = req.body.context ? "\n\nContexto da tela atual: " + req.body.context : "";
    const result = await ai.complete({
      system: prompts.assistantSystem(),
      prompt: question + ctx,
      maxTokens: 1200,
      provider: (req.body && req.body.provider),
      simulate: () => "Assistente em modo SIMULADO — configure a chave Anthropic em Configuracoes para respostas reais.\n\nFluxo do painel: 1) crie/abra uma Campanha; 2) em 'Criar Conteudo', escolha o tipo, preencha o brief e gere com IA; 3) revise o preview e aprove.",
    });
    res.json({ simulated: result.simulated, model: result.model, provider: result.provider, answer: result.text });
  } catch (e) { next(e); }
});

// POST /api/generate/save — cria/garante a task, liga a campanha e grava o arquivo.
router.post("/save", async (req, res, next) => {
  try {
    const body = req.body || {};
    const v = validateContentRequest(body);
    if (!v.ok) return res.status(400).json({ error: "validacao falhou", errors: v.errors });
    const ct = v.contentType;
    const parsed = body.parsed || extractJson(body.raw);
    if (!parsed && !body.raw) return res.status(400).json({ error: "nenhum conteudo para salvar" });
    // Foto do acervo (estilo "Foto"/Pexels): PERSISTE no conteudo salvo p/ o RE-render respeitar
    // (o generate injeta em parsed.image so p/ o render inicial; sem isto, "Gerar arte final" perdia a foto).
    if (body.image && parsed) parsed.image = String(body.image);

    // Foto que não existe não vai para o disco. Vale também aqui, e não só na geração: o JSON
    // avançado é editável, e uma peça gerada antes deste conserto pode trazer o caminho fantasma.
    const fotosInventadasSave = limpaFotosInventadas(parsed);

    // Gate de governanca: bloqueia erros duros antes de gravar
    const gov = runBrandGovernance(textForGovernance(body.content_type, parsed) || body.raw, { type: body.content_type, brief: body.brief });
    avisaFotosInventadas(gov, fotosInventadasSave);
    if (gov.errors.length && !body.force) {
      return res.status(422).json({ error: "conteudo viola regras de marca", governance: gov });
    }

    // 0) já existe peça com esse identificador + data? Antes o save seguia em frente e
    // SOBRESCREVIA o conteúdo, o título, o template e o pilar da peça antiga sem avisar — dava
    // para perder trabalho em rascunho só porque o slug bateu (o /import já barrava isso).
    // Quem realmente quer regravar por cima manda `overwrite: true`.
    const folderAlvo = body.task_name + "_" + body.task_date;
    if (!body.overwrite && content.findTask(folderAlvo)) {
      return res.status(409).json({
        error: "Já existe uma peça com esse identificador nesta data. Mude o identificador ou a data para não substituir a peça que já está salva.",
        code: "E_EXISTS",
        folder: folderAlvo,
      });
    }

    // 1) garante a task (orchestrator.js — idempotente)
    const angle = body.campaign_id ? (campaigns.get(body.campaign_id) || {}).angle : (body.angle || null);
    const create = await content.createTask({
      task_name: body.task_name,
      task_date: body.task_date,
      platforms: body.platforms || (ct.platform ? [ct.platform] : ["instagram"]),
      angle,
    });
    if (!create.ok) return res.status(400).json({ error: "falha ao criar task", detail: create.stderr || create.stdout });

    const folder = body.task_name + "_" + body.task_date;

    // 2) liga a campanha (bidirecional)
    if (body.campaign_id) {
      campaigns.linkContent(body.campaign_id, folder);
      content.setCampaignId(folder, body.campaign_id);
    }

    // 2b) grava o titulo de exibicao humanizado (separado do slug tecnico)
    if (body.title) content.setTitle(folder, body.title);

    // 2c) #8 — semente da variante visual escolhida no brief (default da arte;
    // ignora "auto"/vazio para deixar a rotacao automatica por slug atuar).
    if (body.template_variant) content.setTemplate(folder, body.template_variant);
    // 2c.2) variante de LOGO + estilo de MARCA D'ÁGUA escolhidos no brief (render.json, merge).
    // A foto entra aqui junto: no FEED ela não cabe no arquivo de conteúdo (é .txt), então o
    // render.json é o único lugar onde ela sobrevive ao salvamento.
    if (body.logo || body.watermark || body.image || body.font || body.fundo) content.setRenderPref(folder, { logo: body.logo, watermark: body.watermark, image: body.image, font: body.font, fundo: body.fundo });
    // A manchete e o apoio que a IA escreveu PARA A ARTE do feed seguem o mesmo caminho da foto,
    // e pelo mesmo motivo: o arquivo do feed é um .txt e não tem onde guardá-los. Sem isto o
    // render volta a recortar a legenda no caractere 60 e a peça publicável sai com frase pela
    // metade — que é justamente o defeito que os campos novos vieram resolver.
    if (parsed && (parsed.headline || parsed.subtext)) {
      content.setRenderPref(folder, { dados: { headline: parsed.headline, subtext: parsed.subtext } });
    }

    // 2d) grava o pilar de conteudo (eixo tematico) escolhido no brief.
    // Validado na taxonomia fechada; pilar invalido/ausente e ignorado.
    if (body.pillar) content.setPillar(folder, body.pillar);

    // 2e) metadados da peça "4Selet na Mídia" (print + veículo + link + modelo do device).
    if (body.content_type === "media_mention") {
      content.setMediaMeta(folder, { print: body.media_print, url: body.media_url, vehicle: body.media_vehicle, headline: body.media_headline, model: body.media_model, sizes: body.media_sizes });
    }

    // 2f) A CAPA do carrossel ganha uma foto coerente com o assunto, buscada sozinha. A IA já
    // dizia o que procurar (o campo existia no prompt e ninguém lia); aqui o painel vai atrás.
    // Falhar aqui NÃO derruba a geração: a peça sai igual, só sem a foto — e com o motivo.
    let capa = null;
    if (body.content_type === "instagram_carousel" && parsed && Array.isArray(parsed.slides)) {
      try {
        capa = await capaFoto.buscarCapa(parsed, { nome: body.task_name });
        // Só anuncia o que de fato aconteceu. Quando a capa já tem uma imagem, a foto encontrada
        // é descartada — e a tela dizia "A capa ganhou uma foto." com a miniatura do mesmo jeito.
        if (capa && capa.ok && !capaFoto.aplicarNaCapa(parsed, capa)) {
          capa = { ok: false, motivo: "capa_ja_tinha",
            explica: "A capa já tinha uma imagem sua, então mantive a sua. A foto que encontrei ficou no acervo — dá para trocar na peça se quiser." };
        }
      } catch (e) {
        capa = { ok: false, motivo: "erro", explica: "Não consegui buscar a foto da capa: " + e.message };
        console.error("[capa] falhou:", e && e.message);
      }
    }

    // 2f.2) As CENAS DE VÍDEO que pediram foto de fundo (`foto_busca`) recebem a foto aqui, pelo
    // mesmo caminho da capa do carrossel. Antes o vídeo não aceitava imagem nenhuma: a composition
    // desenhava só tipografia, e qualquer foto que a IA descrevesse morria no conceito.
    // Falhar aqui NÃO derruba a geração — a cena volta ao fundo em gradiente, que é o padrão.
    let fotosCena = null;
    if (body.content_type === "video_idea" && parsed && Array.isArray(parsed.scenes)) {
      try {
        fotosCena = await capaFoto.fotosDasCenas(parsed, { nome: body.task_name });
      } catch (e) {
        fotosCena = { pedidas: 0, aplicadas: 0, avisos: ["Não consegui buscar as fotos das cenas: " + e.message] };
        console.error("[cena-foto] falhou:", e && e.message);
      }
    }

    // 3) grava o arquivo de conteudo
    const text = formatContentFile(ct, parsed, body.raw);
    let rel;
    try {
      rel = content.writeContentFile(folder, ct.file, text, body.brief); // note p/ o historico (desfazer)
    } catch (e) {
      return res.status(e.code === "E_NOT_EDITABLE" ? 409 : 500).json({ error: e.message, code: e.code });
    }

    // OS AVISOS DAS FOTOS DAS CENAS ENTRAM NA FAIXA QUE A TELA JA MOSTRA.
    // Eles eram calculados, devolvidos em `fotos_cena.avisos` e lidos por ninguem: a tela so
    // desenhava `governance` e `capa`. Uma cena que ficou sem foto virava silencio, e a peca
    // parecia completa. Empurrar para `gov.warnings` reaproveita a faixa em vez de criar mais
    // um campo com chance de ficar orfao.
    if (fotosCena && Array.isArray(fotosCena.avisos) && fotosCena.avisos.length) {
      gov.warnings = (gov.warnings || []).concat(fotosCena.avisos);
    }
    res.json({ ok: true, folder, file: rel, governance: gov, capa, fotos_cena: fotosCena, task: content.getTask(folder) });
  } catch (e) { next(e); }
});

// POST /api/generate/slide — regera UM slide do carrossel (mantendo os outros) e re-renderiza só ele.
router.post("/slide", async (req, res, next) => {
  try {
    const body = req.body || {};
    const folder = String(body.folder || "");
    const loc = content.findTask(folder);
    if (!loc) return res.status(404).json({ error: "peça não encontrada" });
    if (loc.zone !== "active") return res.status(409).json({ error: "Reabra a peça para edição antes de regerar um slide.", code: "E_NOT_EDITABLE" });
    let carousel;
    try { carousel = JSON.parse(fs.readFileSync(path.join(loc.path, "copy", "instagram_carousel.json"), "utf8").replace(/^﻿/, "")); }
    catch (e) { return res.status(400).json({ error: "esta peça não tem um carrossel para regerar" }); }
    const slides = Array.isArray(carousel.slides) ? carousel.slides : [];
    const index = parseInt(body.index, 10);
    if (!(index >= 0 && index < slides.length)) return res.status(400).json({ error: "índice de slide inválido" });

    const st = (content.getTask(folder) || {}).status || {};
    const campaign = st.campaign_id ? campaigns.get(st.campaign_id) : (body.campaign_id ? campaigns.get(body.campaign_id) : null);
    const req2 = { content_type: "instagram_carousel", carousel, index, instruction: body.instruction, campaign, pillar: st.pillar || body.pillar };

    const result = await ai.complete({
      system: prompts.systemPrompt(),
      prompt: prompts.singleSlidePrompt(req2),
      maxTokens: 900,
      provider: body.provider,
      simulate: () => JSON.stringify(slides[index]), // sem chave: mantém o slide atual (sinalizado)
    });
    // SEM CHAVE NÃO HOUVE REGERAÇÃO. O adaptador devolve o PRÓPRIO slide no modo simulado, e a
    // tela anunciava "Slide N refeito." em verde para um slide que voltou byte a byte igual.
    // Erro aqui é melhor que sucesso falso: manda configurar a chave, em vez de deixar a pessoa
    // procurando o que mudou numa arte que não mudou.
    if (result && result.simulated) {
      return res.status(422).json({ error: "A IA está em modo simulado (sem chave configurada), então o slide não foi refeito. Configure a chave em Configurações.", code: "E_SEM_CHAVE", simulated: true });
    }
    const newSlide = extractJson(result.text);
    if (!newSlide || typeof newSlide !== "object" || Array.isArray(newSlide)) return res.status(422).json({ error: "a IA não retornou um slide válido" });
    // preserva a foto de fundo do slide se a IA não devolver uma
    if (!newSlide.image && slides[index] && slides[index].image) newSlide.image = slides[index].image;

    // governança sobre o texto do slide novo. Aqui o PEDIDO é a orientação que a pessoa digitou
    // na janela "Regerar slide" — é ela que faz o papel do brief para a exceção da frase-tag.
    // Sem passá-la, pedir a frase neste slide virava beco sem saída: a IA obedecia, o gate
    // reprovava e a tela só sabia dizer "tente outra orientação" (medido: 3 de 3 tentativas).
    const gov = runBrandGovernance(textForGovernanceSlide(newSlide), { type: "instagram_carousel", brief: body.instruction });
    if (gov.errors.length && !body.force) return res.status(422).json({ error: "o slide viola regras de marca", governance: gov });

    paletteWarn(gov, body.instruction); // alerta de marca se pediram cor fora da paleta (branco puro/neon)
    // MERGE conservador só quando HÁ instrução pontual (campos omitidos sobrevivem do slide antigo = "não refaz a arte").
    // Sem instrução = versão nova livre → usa o slide novo direto (evita ressuscitar arrays órfãos de um layout antigo).
    const hasInstr = !!(body.instruction && String(body.instruction).trim());
    const merged = hasInstr ? Object.assign({}, slides[index], newSlide) : newSlide;
    carousel.slides[index] = merged;
    try { content.writeContentFile(folder, "copy/instagram_carousel.json", JSON.stringify(carousel, null, 2) + "\n", "regerar slide " + (index + 1)); }
    catch (e) { return res.status(e.code === "E_NOT_EDITABLE" ? 409 : 500).json({ error: e.message, code: e.code }); }

    let rr = { ok: false, stderr: "" };
    try { rr = await render.renderCarouselSlide(folder, index + 1); }
    catch (e) { rr = { ok: false, stderr: e.message }; }

    res.json({ ok: true, simulated: result.simulated, index, slide: merged, rendered: rr.ok, rel: rr.rel, render_error: rr.ok ? undefined : (rr.stderr || "").slice(0, 200), governance: gov });
  } catch (e) { next(e); }
});

// POST /api/generate/slide-mem — regera UM slide de um carrossel AINDA EM MEMÓRIA (na criação,
// antes de salvar). Irmão do /slide, mas SEM disco: recebe o carrossel inteiro no body e devolve só
// o slide novo (o front funde e re-renderiza). Reusa singleSlidePrompt/systemPrompt/governança —
// idêntico ao /slide, sem findTask/writeContentFile/renderCarouselSlide (que exigem pasta no disco).
router.post("/slide-mem", async (req, res, next) => {
  try {
    const body = req.body || {};
    const carousel = body.carousel;
    if (!carousel || typeof carousel !== "object" || !Array.isArray(carousel.slides)) return res.status(400).json({ error: "carrossel inválido" });
    const slides = carousel.slides;
    const index = parseInt(body.index, 10);
    if (!(index >= 0 && index < slides.length)) return res.status(400).json({ error: "índice de slide inválido" });

    // Em memória não há status.json — campanha/pilar vêm do body (senão o prompt perde a coerência de marca).
    const campaign = body.campaign_id ? campaigns.get(body.campaign_id) : null;
    const req2 = { content_type: "instagram_carousel", carousel, index, instruction: body.instruction, campaign, pillar: body.pillar };

    const result = await ai.complete({
      system: prompts.systemPrompt(),
      prompt: prompts.singleSlidePrompt(req2),
      maxTokens: 900,
      provider: body.provider,
      simulate: () => JSON.stringify(slides[index]), // sem chave: mantém o slide atual (sinalizado)
    });
    // SEM CHAVE NÃO HOUVE REGERAÇÃO. O adaptador devolve o PRÓPRIO slide no modo simulado, e a
    // tela anunciava "Slide N refeito." em verde para um slide que voltou byte a byte igual.
    // Erro aqui é melhor que sucesso falso: manda configurar a chave, em vez de deixar a pessoa
    // procurando o que mudou numa arte que não mudou.
    if (result && result.simulated) {
      return res.status(422).json({ error: "A IA está em modo simulado (sem chave configurada), então o slide não foi refeito. Configure a chave em Configurações.", code: "E_SEM_CHAVE", simulated: true });
    }
    const newSlide = extractJson(result.text);
    if (!newSlide || typeof newSlide !== "object" || Array.isArray(newSlide)) return res.status(422).json({ error: "a IA não retornou um slide válido" });
    // preserva a foto de fundo do slide se a IA não devolver uma
    if (!newSlide.image && slides[index] && slides[index].image) newSlide.image = slides[index].image;

    // Mesma regra do /slide: a orientação digitada é o pedido, e é ela que libera a frase-tag.
    const gov = runBrandGovernance(textForGovernanceSlide(newSlide), { type: "instagram_carousel", brief: body.instruction });
    if (gov.errors.length && !body.force) return res.status(422).json({ error: "o slide viola regras de marca", governance: gov });
    paletteWarn(gov, body.instruction);
    // MERGE só com instrução pontual (preserva omitidos); sem instrução = versão nova direta.
    const hasInstr = !!(body.instruction && String(body.instruction).trim());
    const merged = hasInstr ? Object.assign({}, slides[index], newSlide) : newSlide;
    res.json({ ok: true, simulated: result.simulated, index, slide: merged, governance: gov });
  } catch (e) { next(e); }
});

// A montagem da pendência é a regra de negócio mais delicada deste arquivo (decide se a pessoa é
// perguntada ou fica no escuro) e não tem como ser exercitada por HTTP sem gastar uma geração de IA
// por caso. Sai por aqui, num campo marcado como de teste, para a bateria de regressão cobrir.
router.__testes = { pendenciasDeImagem, ehPedidoDePrint };
module.exports = router;
