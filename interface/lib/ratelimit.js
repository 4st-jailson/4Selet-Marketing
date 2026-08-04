// lib/ratelimit.js — freio simples para as rotas CARAS do painel (geração com IA, render de
// arte, busca de imagens). Não é proteção contra ataque: é rede de segurança contra rajada —
// um laço com bug no navegador, um F5 repetido ou uma sessão vazada podem virar dezenas de
// chamadas pagas à Anthropic/OpenAI (dinheiro real) ou empilhar Chromium na fila de render.
//
// Contagem em memória, por USUÁRIO (a sessão já é obrigatória nessas rotas). Mesmo espírito do
// throttle de login em routes/auth.js: sem dependência nova, some no restart — e tudo bem,
// porque o objetivo é conter rajada de minutos, não manter estado histórico.
"use strict";

const buckets = new Map(); // chave -> { count, first }

// Limpeza periódica: sem isto o Map cresceria sem teto num painel de vida longa.
setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of buckets) if (agora - v.first > 10 * 60 * 1000) buckets.delete(k);
}, 5 * 60 * 1000).unref();

// Cria um middleware. `nome` separa os contadores (a cota de gerar não consome a de renderizar).
// `max` chamadas por `janelaMs`. `mensagem` é o texto mostrado ao usuário (humanizado).
function limitar({ nome, max, janelaMs, mensagem }) {
  return function (req, res, next) {
    const quem = (req.user && req.user.username) || (req.socket && req.socket.remoteAddress) || "?";
    const chave = nome + "|" + quem;
    const agora = Date.now();
    let b = buckets.get(chave);
    if (!b || agora - b.first > janelaMs) { b = { count: 0, first: agora }; buckets.set(chave, b); }
    b.count += 1;
    if (b.count > max) {
      const faltam = Math.ceil((b.first + janelaMs - agora) / 1000);
      res.setHeader("Retry-After", String(faltam));
      console.warn("[limite] " + quem + " estourou a cota de " + nome + " (" + max + "/" + Math.round(janelaMs / 1000) + "s)");
      return res.status(429).json({
        error: mensagem + " Tente de novo em " + (faltam > 60 ? Math.ceil(faltam / 60) + " minutos." : faltam + " segundos."),
        code: "E_RATE_LIMIT",
        retry_after_s: faltam,
      });
    }
    next();
  };
}

module.exports = { limitar };
