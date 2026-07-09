// lib/auth.js — autenticacao do painel: usuarios por pessoa (arquivo JSON), hash
// scrypt (nativo do Node, sem dependencia), sessao por cookie httpOnly assinado
// (HMAC). Substitui a "portaria" externa (basic_auth) por login + perfis.
//
// Perfis: "admin" (usa o painel E gerencia usuarios) e "membro" (so usa o painel).
// Primeiro admin: criado no 1o start a partir de ADMIN_USERNAME/ADMIN_PASSWORD do
// .env (ou senha aleatoria logada, se nao definidos).
"use strict";
const fs = require("fs");
const crypto = require("crypto");
const { PATHS } = require("./config");

const USERS_FILE = PATHS.USERS_FILE;
const DATA_DIR = PATHS.DATA_DIR;
const SECRET_FILE = PATHS.SESSION_SECRET_FILE;

const ROLES = ["admin", "membro"];
const COOKIE = "s4mkt_sid";
const SESSION_TTL_S = 12 * 60 * 60; // 12h
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---- segredo de sessao: env SESSION_SECRET, senao gera e persiste em data/ ----
let SECRET = null;
function sessionSecret() {
  if (SECRET) return SECRET;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    SECRET = process.env.SESSION_SECRET;
    return SECRET;
  }
  ensureDataDir();
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const s = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (s) { SECRET = s; return SECRET; }
    }
  } catch (_) { /* ignora */ }
  SECRET = crypto.randomBytes(48).toString("hex");
  try { fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 }); } catch (_) { /* best effort */ }
  return SECRET;
}

// ---- hashing scrypt ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return "scrypt$" + salt.toString("hex") + "$" + derived.toString("hex");
}
function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const derived = crypto.scryptSync(String(password), salt, expected.length, SCRYPT);
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch (_) { return false; }
}

// ---- store de usuarios (arquivo JSON, escrita atomica) ----
function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const arr = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function saveUsers(users) {
  ensureDataDir();
  const tmp = USERS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, USERS_FILE);
}
function normUsername(u) { return String(u || "").trim().toLowerCase(); }
function findUser(username) {
  const u = normUsername(username);
  return loadUsers().find((x) => x.username === u) || null;
}
function publicUser(u) {
  return u ? { username: u.username, name: u.name || null, role: u.role, created_at: u.created_at, created_by: u.created_by || null } : null;
}
function cleanName(name) { const n = String(name == null ? "" : name).trim().slice(0, 60); return n || null; }

// ---- validacoes ----
function validUsername(u) { return /^[a-z0-9._-]{3,32}$/.test(normUsername(u)); }
function validPassword(p) { return typeof p === "string" && p.length >= 8 && p.length <= 200; }
function validRole(r) { return ROLES.includes(r); }
function countAdmins(users) { return users.filter((x) => x.role === "admin").length; }

// ---- CRUD ----
function createUser({ username, password, role, name }, byUser) {
  const u = normUsername(username);
  if (!validUsername(u)) { const e = new Error("Usuário inválido (3 a 32 caracteres: minúsculas, números, . _ -)."); e.status = 400; throw e; }
  if (!validPassword(password)) { const e = new Error("A senha precisa ter ao menos 8 caracteres."); e.status = 400; throw e; }
  const r = validRole(role) ? role : "membro";
  const users = loadUsers();
  if (users.some((x) => x.username === u)) { const e = new Error("Já existe um usuário com esse nome."); e.status = 409; throw e; }
  const rec = { username: u, name: cleanName(name), role: r, hash: hashPassword(password), created_at: new Date().toISOString(), created_by: byUser || null };
  users.push(rec);
  saveUsers(users);
  return publicUser(rec);
}
function deleteUser(username) {
  const u = normUsername(username);
  const users = loadUsers();
  const target = users.find((x) => x.username === u);
  if (!target) { const e = new Error("Usuário não encontrado."); e.status = 404; throw e; }
  if (target.role === "admin" && countAdmins(users) <= 1) { const e = new Error("Não é possível remover o último admin."); e.status = 400; throw e; }
  saveUsers(users.filter((x) => x.username !== u));
  return { ok: true };
}
function setPassword(username, password) {
  if (!validPassword(password)) { const e = new Error("A senha precisa ter ao menos 8 caracteres."); e.status = 400; throw e; }
  const u = normUsername(username);
  const users = loadUsers();
  const target = users.find((x) => x.username === u);
  if (!target) { const e = new Error("Usuário não encontrado."); e.status = 404; throw e; }
  target.hash = hashPassword(password);
  saveUsers(users);
  return { ok: true };
}
function setRole(username, role) {
  if (!validRole(role)) { const e = new Error("Perfil inválido."); e.status = 400; throw e; }
  const u = normUsername(username);
  const users = loadUsers();
  const target = users.find((x) => x.username === u);
  if (!target) { const e = new Error("Usuário não encontrado."); e.status = 404; throw e; }
  if (target.role === "admin" && role !== "admin" && countAdmins(users) <= 1) { const e = new Error("Não é possível rebaixar o último admin."); e.status = 400; throw e; }
  target.role = role;
  saveUsers(users);
  return publicUser(target);
}
function setName(username, name) {
  const u = normUsername(username);
  const users = loadUsers();
  const target = users.find((x) => x.username === u);
  if (!target) { const e = new Error("Usuário não encontrado."); e.status = 404; throw e; }
  target.name = cleanName(name);
  saveUsers(users);
  return publicUser(target);
}
function listUsers() {
  return loadUsers().map(publicUser).sort((a, b) => a.username.localeCompare(b.username));
}
function authenticate(username, password) {
  const user = findUser(username);
  if (!user) return null;
  if (!verifyPassword(password, user.hash)) return null;
  return publicUser(user);
}

// ---- bootstrap do primeiro admin ----
function bootstrap() {
  if (loadUsers().length > 0) return;
  ensureDataDir();
  let username = normUsername(process.env.ADMIN_USERNAME || "admin");
  if (!validUsername(username)) username = "admin";
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!validPassword(password)) {
    password = crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) + "7x";
    generated = true;
  }
  try {
    saveUsers([{ username, role: "admin", hash: hashPassword(password), created_at: new Date().toISOString(), created_by: "bootstrap" }]);
    console.log('[auth] Primeiro admin criado: usuario="' + username + '"');
    if (generated) console.log("[auth] ATENCAO: ADMIN_PASSWORD nao definido. Senha gerada (troque apos o 1o login): " + password);
  } catch (e) { console.error("[auth] Falha ao criar admin inicial:", e.message); }
}

// ---- sessao (cookie assinado HMAC) ----
function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64urlDecode(str) { return Buffer.from(String(str).replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
function signSession(user) {
  const payload = { u: user.username, r: user.role, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S };
  const body = b64url(JSON.stringify(payload));
  const mac = b64url(crypto.createHmac("sha256", sessionSecret()).update(body).digest());
  return body + "." + mac;
}
function verifySession(token) {
  try {
    if (!token || token.indexOf(".") < 0) return null;
    const idx = token.indexOf(".");
    const body = token.slice(0, idx), mac = token.slice(idx + 1);
    const expected = b64url(crypto.createHmac("sha256", sessionSecret()).update(body).digest());
    const a = Buffer.from(mac), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body).toString("utf8"));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    const user = findUser(payload.u); // usuario removido => sessao invalida na hora
    if (!user) return null;
    return { username: user.username, name: user.name || null, role: user.role };
  } catch (_) { return null; }
}

// ---- cookies / request ----
function parseCookies(req) {
  const out = {};
  const raw = req.headers && req.headers.cookie;
  if (!raw) return out;
  raw.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (_) { /* ignora */ } }
  });
  return out;
}
function isHttps(req) {
  const xf = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return xf === "https" || req.secure === true;
}
function setSessionCookie(req, res, token) {
  const parts = [COOKIE + "=" + token, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=" + SESSION_TTL_S];
  if (isHttps(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(req, res) {
  const parts = [COOKIE + "=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
function userFromRequest(req) {
  const token = parseCookies(req)[COOKIE];
  return token ? verifySession(token) : null;
}

module.exports = {
  ROLES, COOKIE, SESSION_TTL_S,
  bootstrap, authenticate, listUsers, createUser, deleteUser, setPassword, setRole, setName, findUser,
  signSession, verifySession, setSessionCookie, clearSessionCookie, userFromRequest,
};
