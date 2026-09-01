// squad_webhook.js — a porta PÚBLICA por onde o sistema squad.4st.co entrega as artes.
//
// Esta rota é montada ANTES do gate de sessão do server.js: quem chama é um servidor, não
// uma pessoa com cookie. Quem faz o papel de porteiro aqui é o token — e ele é conferido
// ANTES de qualquer trabalho pesado, para que uma chamada sem credencial não custe nada.
//
// Toda requisição fica registrada, dê certo ou dê errado. Erro NÃO some: vira uma linha na
// tela de Requisições com o motivo em português e o corpo guardado para reprocessar.
"use strict";
const express = require("express");
const squad = require("../lib/squad");

const router = express.Router();

const clientIp = squad.clientIp;
const tokenDaRequisicao = squad.tokenDaRequisicao;

router.post("/webhook", async (req, res) => {
  const ip = clientIp(req);

  // O server.js já barrou quem não tem token antes mesmo de ler o corpo. Esta segunda
  // conferência é de propósito: se um dia a montagem mudar de lugar, a porta continua fechada.
  if (!squad.confere(tokenDaRequisicao(req))) {
    // Fica registrado. A tela de Requisições promete responder "chegou alguma coisa?" — sem
    // isto, uma entrega recusada por token errado (o caso mais provável no dia da ligação)
    // apareceria como se nada tivesse chegado, e ninguém saberia onde procurar.
    squad.registrarRecusa(ip, "O token apresentado não confere com o que está salvo em Configurações.");
    console.warn("[squad] recusada por token inválido — de " + ip);
    return res.status(401).json({ ok: false, erro: "token inválido" });
  }
  squad.marcarRequisicao();

  const corpo = req.body && typeof req.body === "object" ? req.body : {};
  const bytes = Number(req.headers["content-length"]) || 0;
  const logs = [];
  const log = (m) => { logs.push({ em: new Date().toISOString(), texto: m }); };

  // A linha JÁ EXISTE: ela nasceu no porteiro, antes de o corpo ser lido, para que entrega
  // grande demais ou cortada no meio não sumisse da tela (ver abrirEntrega em lib/squad.js).
  // Aqui só assumimos essa mesma linha. O registrar() é rede de segurança para o caso de esta
  // rota ser chamada por um caminho que não passe pelo porteiro.
  let reg = squad.linhaDaRequisicao(req) || squad.registrar({ origem_ip: ip, tipo: "entrega", resultado: "montando", logs });
  reg.origem_id = corpo.post_id != null ? String(corpo.post_id) : (corpo.id != null ? String(corpo.id) : null);
  reg.bytes = bytes;
  reg.corpo_lido = true;   // daqui pra frente o desfecho é nosso, não do fim da resposta
  reg.logs = logs;
  squad.atualizar(reg);
  squad.guardarPayload(reg.id, corpo);

  // Etapa 1 — ler a entrega. É rápido e é aqui que se pega pedido malformado, com uma
  // mensagem que explica o que faltou.
  let lido;
  try {
    lido = squad.normalizar(corpo);
  } catch (e) {
    squad.encerrarEntrega(reg, "erro", { erro: e.message, erro_code: e.code || null, logs });
    console.error("[squad] entrega recusada na leitura: " + (e.code || "") + " " + e.message);
    return res.json({ ok: false, erro: e.message, requisicao: reg.id });
  }
  reg.titulo = lido.titulo; reg.formato = lido.formato; reg.cards = lido.cards.length;
  reg.evento = lido.evento;

  // Etapa 1.5 — os avisos que NÃO trazem arte se resolvem aqui mesmo, sem criar nada.
  // Eles deixam de ser "entrega": um teste de conexão ou um cancelamento não é arte que
  // deveria ter chegado, e contá-los junto era o que fazia o selo e os números mentirem.
  if (lido.evento === "teste") {
    log("Teste de conexão: o token está certo e a porta está aberta. Nada foi criado.");
    squad.encerrarEntrega(reg, "teste", { tipo: "aviso", logs });
    return res.json({ ok: true, teste: true, pronto_para_receber: true, requisicao: reg.id });
  }
  if (lido.evento === "post.cancelado") {
    const r = squad.cancelar(lido.origem_id, lido.motivo);
    const quantas = (r.pecas || []).length;
    if (r.ok) {
      log("O squad cancelou este post. Marquei " + (quantas > 1 ? quantas + " peças" : "a peça " + r.peca)
        + " — nada foi apagado.");
      squad.encerrarEntrega(reg, "cancelado", { tipo: "aviso", peca: r.peca, pecas: r.pecas, logs });
      return res.json({ ok: true, cancelado: true, peca: r.peca, pecas: r.pecas, requisicao: reg.id });
    }
    // Responder "cancelado: true" para um post que o painel nunca viu fazia o sistema do squad
    // registrar um cancelamento que não aconteceu em lugar nenhum. A resposta agora diz a
    // verdade — e continua em 200 de propósito, porque reenviar o aviso não mudaria o desfecho.
    const erro = "O squad avisou que o post " + (lido.origem_id || "?") + " foi cancelado, mas "
      + r.motivo + ". Nada foi marcado aqui.";
    log("O squad cancelou o post " + (lido.origem_id || "?") + ", mas não achei peça correspondente.");
    squad.encerrarEntrega(reg, "erro", { tipo: "aviso", erro, erro_code: "E_POST_DESCONHECIDO", logs });
    console.warn("[squad] cancelamento de post desconhecido: " + (lido.origem_id || "?"));
    return res.json({ ok: false, cancelado: false, erro, peca: null, requisicao: reg.id });
  }

  // Etapa 2 — já recebemos este post? Reenviar não pode virar peça duplicada.
  // Mas "refez a arte" é outra história: aí a entrega NOVA tem que entrar (ver abaixo).
  // A chave é o post_id; quando ele não vem, é a impressão digital do conteúdo — sem isso a
  // entrega sem identificador não tinha proteção nenhuma e duplicava a cada reenvio.
  const chave = squad.chaveDeOrigem(lido);
  const anterior = squad.entradaDeOrigem(chave);
  if (anterior && lido.evento === "post.atualizado") {
    // Solta a reserva para a arte nova poder entrar, e guarda de qual peça ela é a versão nova.
    squad.liberarReserva(chave);
    reg.substitui = anterior.folder || null;
    log(anterior.folder
      ? "O squad refez este post. Vou criar uma peça nova; a anterior (" + anterior.folder + ") continua intacta."
      : "O squad refez este post.");
  } else if (anterior) {
    const aindaExiste = anterior.folder && require("../lib/content").findTask(anterior.folder);
    // A RESERVA PRECISA DE PRAZO. Ela é gravada em disco ANTES da montagem, e quem a solta é o
    // ciclo vivo da requisição. Se o painel reiniciar no meio (deploy, queda), a linha fica em
    // "montando" para sempre: todo reenvio daquele post passa a receber ok:true dizendo que a
    // arte já chegou, e nada é criado. O squad não tem como saber, e a peça simplesmente não
    // existe. Trinta minutos é o mesmo limite que a tela já usa para chamar uma entrega de
    // "interrompida no meio" — passado isso, a reserva é considerada morta e a montagem segue.
    const RESERVA_VALE_MS = 30 * 60 * 1000;
    const idade = Date.now() - Date.parse(anterior.em || "");
    const montandoVivo = anterior.estado === "montando" && (!isFinite(idade) || idade < RESERVA_VALE_MS);
    if (aindaExiste || montandoVivo) {
      log(anterior.estado === "montando"
        ? "Esta entrega já estava sendo montada — não criei outra peça."
        : "Este post já tinha chegado antes: mantive a peça " + anterior.folder + ".");
      squad.encerrarEntrega(reg, "ja_recebida", { peca: anterior.folder || null, logs });
      return res.json({ ok: true, ja_recebido: true, peca: anterior.folder || null, requisicao: reg.id });
    }
    squad.liberarReserva(chave); // a peça foi descartada: pode receber de novo
  }
  squad.reservar(chave, reg.id);
  squad.atualizar(reg);

  // Etapa 3 — responde AGORA. Montar a peça leva bem mais que os 30 segundos que o emissor do
  // squad espera (é um processo para criar, um navegador por arte e mais dois para aprovar).
  // Se a resposta esperasse tudo isso, eles veriam erro de tempo esgotado toda vez, e o
  // reenvio criaria uma segunda peça do mesmo post. A entrega está aceita e guardada; o que
  // acontece daqui pra frente aparece na tela de Requisições.
  res.json({ ok: true, recebido: true, requisicao: reg.id, cards: lido.cards.length, formato: lido.formato });

  // Etapa 4 — montar, sem ninguém esperando.
  squad.receber(corpo, { log, jaLido: lido, chave, substitui: reg.substitui || null }).then((r) => {
    squad.encerrarEntrega(reg, "criada", {
      peca: r.peca, formato: r.formato, cards: r.cards, avisos: r.avisos || [], logs,
    });
    console.log("[squad] criada: " + r.peca + " (" + r.cards + " arte(s), " + r.formato + ")");
  }).catch((e) => {
    squad.liberarReserva(chave);
    squad.encerrarEntrega(reg, "erro", { erro: e.message, erro_code: e.code || null, logs });
    console.error("[squad] falhou ao montar: " + (e.code || "") + " " + e.message);
  });
});

// Sinal de vida da integração, para o time do squad conferir a URL antes de ligar de vez.
router.get("/webhook", (req, res) => {
  if (!squad.confere(tokenDaRequisicao(req))) return res.status(401).json({ ok: false, erro: "token inválido" });
  res.json({ ok: true, servico: "painel-4selet", pronto_para_receber: true });
});

module.exports = router;
