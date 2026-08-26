// lib/publications.js — HISTÓRICO de publicações reais no Instagram (agendadas OU diretas).
// Antes só as agendadas deixavam rastro (schedule.json); aqui registramos TODA publicação que
// foi ao ar, pra a aba "Publicados" ser completa. Append-only. Estado em data/publications.json.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS, DESTINO_IDS } = require("./config");

const FILE = path.join(PATHS.DATA_DIR, "publications.json");

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return []; } }
// Gravação ATÔMICA e DURÁVEL. O tmp+rename já existia; faltavam duas coisas, e este arquivo é o
// registro do que JÁ FOI AO AR — perder uma linha aqui é o painel esquecer um post publicado e
// deixar alguém postar de novo:
// (1) nome do tmp ÚNICO — com nome fixo, dois processos gravando ao mesmo tempo truncam o tmp um
//     do outro e o rename publica um arquivo pela metade (que é o que o tmp existe para evitar);
// (2) fsync ANTES do rename — sem ele, um desligamento logo depois pode deixar o arquivo com
//     zero byte, e o histórico inteiro de publicações some sem uma palavra.
// (Gêmeo do mesmo trecho em schedule.js e content.js — mesma razão, mesmo formato.)
let _seqTmp = 0;
function save(list) {
  if (!fs.existsSync(PATHS.DATA_DIR)) fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const tmp = FILE + "." + process.pid + "." + (++_seqTmp) + ".tmp";
  const fd = fs.openSync(tmp, "w", 0o600);
  try { fs.writeSync(fd, JSON.stringify(list, null, 2)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(tmp, FILE);
}

// TODOS os identificadores de post que este registro representa, na ordem em que foram ao ar.
// Um carrossel publicado no Story vira N stories na conta — N ids —, e por muito tempo só o
// primeiro era guardado: "Apagar do Instagram" apagava o cartão 1, dizia que tinha confirmado, e
// os outros N-1 ficavam no ar sem nenhum botão do painel que os alcançasse. Registro ANTIGO tem
// só `post_id`, e continua sendo lido aqui — por isso toda leitura de ids passa por esta função,
// em vez de cada lugar escolher entre um campo e outro.
function idsDe(rec) {
  const out = [];
  const guarda = (v) => {
    const s = String(v == null ? "" : v).trim();
    if (s && out.indexOf(s) < 0) out.push(s);
  };
  if (rec && Array.isArray(rec.cartoes)) rec.cartoes.forEach(guarda);
  if (rec) guarda(rec.post_id);
  return out;
}

// Registra uma publicação real. rec: { folder, label?, kind?, caption?, post_id?, cartoes?,
// permalink?, scheduled_at? (null se direta), by?, published_at? (data informada),
// manual? (marcação manual) }.
// Evita duplicar o MESMO post (idempotência por qualquer id em comum).
function add(rec) {
  rec = rec || {};
  const list = load();
  // Os ids que saíram juntos. Quem chama pode não passar `cartoes` — o disparador do
  // agendamento registra só o `post_id` —, e nesse caso perguntamos a quem acabou de publicar,
  // que guarda a lista completa por alguns posts. Sem esta pergunta, um Story agendado nasceria
  // no histórico com um id só e cairia no mesmo buraco, por outra porta.
  let cartoes = idsDe({ cartoes: rec.cartoes });
  if (!cartoes.length && rec.post_id) {
    try { cartoes = idsDe({ cartoes: require("./publish").cartoesDe(rec.post_id) }); }
    catch (e) { cartoes = []; }
  }
  // Idempotência por QUALQUER id em comum: o mesmo Story chegando por outro caminho traria o
  // mesmo conjunto de cartões, e comparar só o primeiro id deixaria entrar uma linha repetida.
  const novos = idsDe({ cartoes: cartoes, post_id: rec.post_id });
  if (novos.length && list.some((x) => idsDe(x).some((id) => novos.indexOf(id) >= 0))) return null;
  const item = {
    id: crypto.randomBytes(8).toString("hex"),
    folder: String(rec.folder || ""),
    label: String(rec.label || rec.folder || ""),
    kind: rec.kind || null,
    // Destino da publicação. Registro antigo (sem o campo) e lido como "feed", que era o unico
    // destino que existia quando ele foi gravado — assim o historico nao fica com buraco.
    destino: DESTINO_IDS.indexOf(rec.destino) >= 0 ? rec.destino : "feed",
    caption: rec.caption || null,
    // `post_id` continua sendo o PRIMEIRO cartão: é o que a tela lê para oferecer "Apagar do
    // Instagram" e o que os registros antigos têm. `cartoes` é a lista inteira — quem apaga usa
    // ela, e é ela que impede o painel de dizer que tirou tudo do ar tendo tirado um cartão só.
    post_id: rec.post_id || cartoes[0] || null,
    cartoes: cartoes.length ? cartoes : null,
    permalink: rec.permalink || null,
    scheduled_at: rec.scheduled_at || null, // preenchido = veio de agendamento
    by: rec.by || null,
    manual: !!rec.manual, // marcada manualmente (publicação feita por fora do painel)
    published_at: rec.published_at || new Date().toISOString(),
  };
  list.push(item); save(list); return item;
}
// Mais recentes primeiro.
function list() { return load().slice().sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))); }

// Um registro pelo id. Devolve null se não existir.
function get(id) { return load().find((x) => x.id === String(id || "")) || null; }

// Tira a linha do histórico. Usado nos DOIS caminhos: depois de apagar de verdade no Instagram,
// e quando a pessoa já apagou pelo celular e o painel ficou anunciando um post que não existe
// mais (foi o caso do Story cortado de 19/08 — apagado à mão, e a lista continuava mostrando).
// `motivo` fica gravado no registro de saída para o histórico não perder a razão.
function remove(id, motivo, quem) {
  const list = load();
  const i = list.findIndex((x) => x.id === String(id || ""));
  if (i < 0) return null;
  const [fora] = list.splice(i, 1);
  save(list);
  return Object.assign({}, fora, { removido_em: new Date().toISOString(), removido_motivo: motivo || null, removido_por: quem || null });
}

// Ajusta um registro que CONTINUA no histórico. Existe para o desfecho parcial de "Apagar do
// Instagram": quando só alguns cartões saem, a linha precisa ficar na lista apontando apenas
// para os que continuam no ar — senão a tentativa seguinte bate de novo nos que já sumiram e o
// painel perde a conta do que resta. Não cria registro: id desconhecido devolve null.
function update(id, patch) {
  const list = load();
  const i = list.findIndex((x) => x.id === String(id || ""));
  if (i < 0) return null;
  list[i] = Object.assign({}, list[i], patch || {});
  save(list);
  return list[i];
}

module.exports = { add, list, get, remove, update, idsDe };
