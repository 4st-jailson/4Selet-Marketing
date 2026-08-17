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

  let reg = squad.registrar({
    origem_ip: ip,
    origem_id: corpo.post_id != null ? String(corpo.post_id) : (corpo.id != null ? String(corpo.id) : null),
    bytes,
    resultado: "montando",
    logs,
  });
  squad.guardarPayload(reg.id, corpo);

  // Etapa 1 — ler a entrega. É rápido e é aqui que se pega pedido malformado, com uma
  // mensagem que explica o que faltou.
  let lido;
  try {
    lido = squad.normalizar(corpo);
  } catch (e) {
    reg.resultado = "erro"; reg.erro = e.message; reg.erro_code = e.code || null; reg.logs = logs;
    squad.atualizar(reg);
    console.error("[squad] entrega recusada na leitura: " + (e.code || "") + " " + e.message);
    return res.json({ ok: false, erro: e.message, requisicao: reg.id });
  }
  reg.titulo = lido.titulo; reg.formato = lido.formato; reg.cards = lido.cards.length;
  reg.evento = lido.evento;

  // Etapa 1.5 — os avisos que NÃO trazem arte se resolvem aqui mesmo, sem criar nada.
  if (lido.evento === "teste") {
    reg.resultado = "teste"; reg.logs = logs;
    log("Teste de conexão: o token está certo e a porta está aberta. Nada foi criado.");
    reg.logs = logs; squad.atualizar(reg);
    return res.json({ ok: true, teste: true, pronto_para_receber: true, requisicao: reg.id });
  }
  if (lido.evento === "post.cancelado") {
    const r = squad.cancelar(lido.origem_id, lido.motivo);
    reg.resultado = r.ok ? "cancelado" : "erro";
    reg.peca = r.peca;
    if (!r.ok) reg.erro = "O squad avisou que o post " + (lido.origem_id || "?") + " foi cancelado, mas " + r.motivo + ".";
    log(r.ok
      ? "O squad cancelou este post. Marquei a peça " + r.peca + " — nada foi apagado."
      : "O squad cancelou o post " + (lido.origem_id || "?") + ", mas não achei peça correspondente.");
    reg.logs = logs; squad.atualizar(reg);
    return res.json({ ok: true, cancelado: true, peca: r.peca, requisicao: reg.id });
  }

  // Etapa 2 — já recebemos este post? Reenviar não pode virar peça duplicada.
  // Mas "refez a arte" é outra história: aí a entrega NOVA tem que entrar (ver abaixo).
  const anterior = squad.entradaDeOrigem(lido.origem_id);
  if (anterior && lido.evento === "post.atualizado") {
    // Solta a reserva para a arte nova poder entrar, e guarda de qual peça ela é a versão nova.
    squad.liberarReserva(lido.origem_id);
    reg.substitui = anterior.folder || null;
    log(anterior.folder
      ? "O squad refez este post. Vou criar uma peça nova; a anterior (" + anterior.folder + ") continua intacta."
      : "O squad refez este post.");
  } else if (anterior) {
    const aindaExiste = anterior.folder && require("../lib/content").findTask(anterior.folder);
    if (aindaExiste || anterior.estado === "montando") {
      reg.resultado = "ja_recebida"; reg.peca = anterior.folder || null; reg.logs = logs;
      log(anterior.estado === "montando"
        ? "Esta entrega já estava sendo montada — não criei outra peça."
        : "Este post já tinha chegado antes: mantive a peça " + anterior.folder + ".");
      reg.logs = logs; squad.atualizar(reg);
      return res.json({ ok: true, ja_recebido: true, peca: anterior.folder || null, requisicao: reg.id });
    }
    squad.liberarReserva(lido.origem_id); // a peça foi descartada: pode receber de novo
  }
  squad.reservar(lido.origem_id, reg.id);
  squad.atualizar(reg);

  // Etapa 3 — responde AGORA. Montar a peça leva bem mais que os 30 segundos que o emissor do
  // squad espera (é um processo para criar, um navegador por arte e mais dois para aprovar).
  // Se a resposta esperasse tudo isso, eles veriam erro de tempo esgotado toda vez, e o
  // reenvio criaria uma segunda peça do mesmo post. A entrega está aceita e guardada; o que
  // acontece daqui pra frente aparece na tela de Requisições.
  res.json({ ok: true, recebido: true, requisicao: reg.id, cards: lido.cards.length, formato: lido.formato });

  // Etapa 4 — montar, sem ninguém esperando.
  squad.receber(corpo, { log, jaLido: lido, substitui: reg.substitui || null }).then((r) => {
    reg.resultado = "criada";
    reg.peca = r.peca; reg.formato = r.formato; reg.cards = r.cards;
    reg.avisos = r.avisos || []; reg.logs = logs;
    squad.atualizar(reg);
    console.log("[squad] criada: " + r.peca + " (" + r.cards + " arte(s), " + r.formato + ")");
  }).catch((e) => {
    squad.liberarReserva(lido.origem_id);
    reg.resultado = "erro"; reg.erro = e.message; reg.erro_code = e.code || null; reg.logs = logs;
    squad.atualizar(reg);
    console.error("[squad] falhou ao montar: " + (e.code || "") + " " + e.message);
  });
});

// Sinal de vida da integração, para o time do squad conferir a URL antes de ligar de vez.
router.get("/webhook", (req, res) => {
  if (!squad.confere(tokenDaRequisicao(req))) return res.status(401).json({ ok: false, erro: "token inválido" });
  res.json({ ok: true, servico: "painel-4selet", pronto_para_receber: true });
});

module.exports = router;
