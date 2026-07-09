// routes/users.js — administracao de usuarios (SOMENTE admin). O login ja e
// garantido pelo gate em server.js; aqui reforcamos o perfil admin.
"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../lib/auth");

router.use((req, res, next) => {
  const me = auth.userFromRequest(req);
  if (!me) return res.status(401).json({ error: "não autenticado" });
  if (me.role !== "admin") return res.status(403).json({ error: "Apenas administradores podem gerenciar usuários." });
  req.me = me;
  next();
});

router.get("/", (req, res) => res.json({ users: auth.listUsers() }));

router.post("/", (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    res.status(201).json({ user: auth.createUser({ username, password, role }, req.me.username) });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

router.delete("/:username", (req, res) => {
  try {
    if (String(req.params.username).toLowerCase() === req.me.username) {
      return res.status(400).json({ error: "Você não pode remover a si mesmo." });
    }
    res.json(auth.deleteUser(req.params.username));
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

router.post("/:username/password", (req, res) => {
  try { res.json(auth.setPassword(req.params.username, (req.body || {}).password)); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

router.post("/:username/role", (req, res) => {
  try {
    if (String(req.params.username).toLowerCase() === req.me.username && (req.body || {}).role !== "admin") {
      return res.status(400).json({ error: "Você não pode rebaixar a si mesmo." });
    }
    res.json({ user: auth.setRole(req.params.username, (req.body || {}).role) });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

module.exports = router;
