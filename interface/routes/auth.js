// routes/auth.js — login/logout/sessao + troca da propria senha. Rotas PUBLICAS
// (montadas antes do gate de autenticacao no server.js), com throttle de tentativas.
"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../lib/auth");

// throttle simples em memoria por IP+usuario
const attempts = new Map();
const MAX = 6, WINDOW_MS = 60 * 1000, LOCK_MS = 5 * 60 * 1000;
function keyOf(req, username) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "?";
  return ip + "|" + String(username || "").toLowerCase();
}
function lockedFor(k) {
  const a = attempts.get(k);
  return a && a.until && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
function registerFail(k) {
  const now = Date.now();
  const a = attempts.get(k) || { count: 0, first: now };
  if (now - a.first > WINDOW_MS) { a.count = 0; a.first = now; }
  a.count += 1;
  if (a.count >= MAX) { a.until = now + LOCK_MS; a.count = 0; a.first = now; }
  attempts.set(k, a);
}

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const k = keyOf(req, username);
  const wait = lockedFor(k);
  if (wait) return res.status(429).json({ error: "Muitas tentativas. Aguarde " + wait + "s e tente de novo." });
  const user = auth.authenticate(username, password);
  if (!user) { registerFail(k); return res.status(401).json({ error: "Usuário ou senha inválidos." }); }
  attempts.delete(k);
  auth.setSessionCookie(req, res, auth.signSession(user));
  res.json({ ok: true, user });
});

router.post("/logout", (req, res) => {
  auth.clearSessionCookie(req, res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const user = auth.userFromRequest(req);
  if (!user) return res.status(401).json({ error: "não autenticado" });
  res.json({ user });
});

// trocar a propria senha (precisa da senha atual)
router.post("/password", (req, res) => {
  const me = auth.userFromRequest(req);
  if (!me) return res.status(401).json({ error: "não autenticado" });
  const { current, password } = req.body || {};
  if (!auth.authenticate(me.username, current)) return res.status(400).json({ error: "Senha atual incorreta." });
  try { auth.setPassword(me.username, password); res.json({ ok: true }); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

module.exports = router;
