// routes/auth.js — login/logout/sessao + troca da propria senha. Rotas PUBLICAS
// (montadas antes do gate de autenticacao no server.js), com throttle de tentativas.
"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../lib/auth");

// throttle simples em memoria por IP+usuario (+ teto global por IP)
const attempts = new Map();
const MAX = 6, GMAX = 30, WINDOW_MS = 60 * 1000, LOCK_MS = 5 * 60 * 1000;
// IP real do cliente atras do proxy: CF-Connecting-IP (Cloudflare, que o cliente NAO
// forja) > ULTIMO valor de X-Forwarded-For (o proxy confiavel anexa o real ao fim) >
// socket. Nunca XFF[0] — esse e justamente o que o atacante forja (A1).
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).split(",")[0].trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) { const p = String(xff).split(","); return p[p.length - 1].trim(); }
  return (req.socket && req.socket.remoteAddress) || "?";
}
function keyOf(req, username) { return clientIp(req) + "|" + String(username || "").toLowerCase(); }
function gkeyOf(req) { return "GLOBAL|" + clientIp(req); } // por IP, independente de usuario
function lockedFor(k) {
  const a = attempts.get(k);
  return a && a.until && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
function registerFail(k, max) {
  max = max || MAX;
  const now = Date.now();
  const a = attempts.get(k) || { count: 0, first: now };
  if (now - a.first > WINDOW_MS) { a.count = 0; a.first = now; }
  a.count += 1;
  if (a.count >= max) { a.until = now + LOCK_MS; a.count = 0; a.first = now; }
  attempts.set(k, a);
}
// Limpeza periodica (B4): remove entradas expiradas + teto de tamanho (anti-DoS de memoria).
setInterval(() => {
  const now = Date.now();
  for (const [k, a] of attempts) {
    if (!(a.until && a.until > now) && now - (a.first || 0) > WINDOW_MS) attempts.delete(k);
  }
  if (attempts.size > 5000) { let i = 0; for (const k of attempts.keys()) { if (i++ >= 2000) break; attempts.delete(k); } }
}, 5 * 60 * 1000).unref();

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const k = keyOf(req, username), gk = gkeyOf(req);
  const wait = lockedFor(k) || lockedFor(gk);
  if (wait) return res.status(429).json({ error: "Muitas tentativas. Aguarde " + wait + "s e tente de novo." });
  const user = auth.authenticate(username, password);
  if (!user) { registerFail(k); registerFail(gk, GMAX); return res.status(401).json({ error: "Usuário ou senha inválidos." }); }
  attempts.delete(k);
  auth.setSessionCookie(req, res, auth.signSession(user));
  res.json({ ok: true, user });
});

router.post("/logout", (req, res) => {
  auth.clearSessionCookie(req, res);
  res.json({ ok: true });
});

// aceitar um LINK DE CONVITE: cria sessao a partir de um token (nao ha senha na URL).
// Token de uso unico + expira; ao entrar, a pessoa e forcada a definir a propria senha.
router.post("/invite/accept", (req, res) => {
  const { token } = req.body || {};
  const k = keyOf(req, "invite"), gk = gkeyOf(req);
  const wait = lockedFor(k) || lockedFor(gk);
  if (wait) return res.status(429).json({ error: "Muitas tentativas. Aguarde " + wait + "s e tente de novo." });
  const user = auth.acceptInvite(token);
  if (!user) { registerFail(k); registerFail(gk, GMAX); return res.status(400).json({ error: "Convite inválido ou expirado." }); }
  attempts.delete(k);
  auth.setSessionCookie(req, res, auth.signSession(user));
  res.json({ ok: true, user });
});

router.get("/me", (req, res) => {
  const user = auth.userFromRequest(req);
  if (!user) return res.status(401).json({ error: "não autenticado" });
  res.json({ user });
});

// trocar a propria senha (precisa da senha atual). Limpa a marca de "trocar no 1o acesso".
router.post("/password", (req, res) => {
  const me = auth.userFromRequest(req);
  if (!me) return res.status(401).json({ error: "não autenticado" });
  const { current, password } = req.body || {};
  if (!auth.authenticate(me.username, current)) return res.status(400).json({ error: "Senha atual incorreta." });
  try {
    auth.setPassword(me.username, password, false);
    auth.setSessionCookie(req, res, auth.signSession(auth.findUser(me.username))); // reemite: minha sessao segue valida (M2)
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

// definir a propria senha no PRIMEIRO ACESSO (conta marcada p/ trocar). A pessoa acabou
// de logar com a senha temporaria — nao exige a senha atual de novo, mas so funciona se a
// conta estiver marcada (must_change), entao nao vira um bypass do fluxo normal.
router.post("/first-password", (req, res) => {
  const me = auth.userFromRequest(req);
  if (!me) return res.status(401).json({ error: "não autenticado" });
  if (!me.must_change) return res.status(400).json({ error: "Não é necessário trocar a senha agora." });
  const { password } = req.body || {};
  try {
    auth.setPassword(me.username, password, false);
    auth.setSessionCookie(req, res, auth.signSession(auth.findUser(me.username))); // reemite: entro ja com a nova senha (M2)
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

module.exports = router;
