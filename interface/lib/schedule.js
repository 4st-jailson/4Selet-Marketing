// lib/schedule.js — agendamento de publicações. Guarda os posts a disparar e um worker
// em segundo plano publica no horário marcado. A publicação em si (com o gate de aprovação)
// é o lib/publish; aqui é só a fila + o relógio. Estado em interface/data/schedule.json.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS, DESTINO_IDS, publicaSozinho, destinoById } = require("./config");
const publications = require("./publications");

const FILE = path.join(PATHS.DATA_DIR, "schedule.json");

// Folga entre o relógio de quem agenda e o do servidor (ver o uso em add()).
const FOLGA_RELOGIO_MS = 2 * 60 * 1000;
// Atraso máximo que ainda vale publicar sozinho. O painel desligado por dias voltava e disparava
// TUDO que tinha vencido, de uma vez, na conta real — uma peça de terça saindo no sábado de
// madrugada, junto com outras cinco. Passou disto, o agendamento é dado como perdido e quem
// cuida decide (o motivo aparece na aba Publicações › Agendados).
const ATRASO_MAX_MS = 2 * 60 * 60 * 1000;

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return []; } }
// Gravação ATÔMICA e DURÁVEL da fila. O tmp+rename já existia; faltavam duas coisas que este
// arquivo não pode perder (ele é a lista do que vai ser postado na conta real):
// (1) nome do tmp ÚNICO — com nome fixo, dois processos gravando ao mesmo tempo (o painel e um
//     script de manutenção) truncam o tmp um do outro e o rename publica um arquivo pela metade;
// (2) fsync ANTES do rename — sem ele o rename pode chegar ao disco antes do conteúdo, e um
//     desligamento logo depois deixa a fila com zero byte: todos os agendamentos somem calados.
// (Gêmeo do mesmo trecho em publications.js e content.js — mesma razão, mesmo formato.)
let _seqTmp = 0;
function save(list) {
  if (!fs.existsSync(PATHS.DATA_DIR)) fs.mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const tmp = FILE + "." + process.pid + "." + (++_seqTmp) + ".tmp";
  const fd = fs.openSync(tmp, "w", 0o600);
  try { fs.writeSync(fd, JSON.stringify(list, null, 2)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(tmp, FILE);
}

// Agendamentos ainda pendentes de uma peça (usado para evitar duplicidade).
// Pendentes de uma peça. Com `destino`, só os daquele destino — é o que permite ter o feed
// publicado e o story ainda agendado ao mesmo tempo. Sem `destino`, todos (usado ao descartar a peça).
// Agendamento antigo, gravado antes deste campo existir, conta como "feed".
function destinoDe(x) { return DESTINO_IDS.indexOf(x && x.destino) >= 0 ? x.destino : "feed"; }
function pendingFor(folder, destino) {
  return load().filter((x) => x.folder === folder && x.status === "pending"
    && (!destino || destinoDe(x) === destino));
}

// Cancela todos os pendentes de uma peça. Usado quando a peça é publicada por outro caminho
// (botão "Publicar agora" ou marcação manual): sem isso, o agendamento dispararia depois e
// postaria a MESMA peça uma segunda vez, horas mais tarde, sem ninguém olhando.
function cancelPendingFor(folder, reason, destino) {
  const l = load();
  const hit = l.filter((x) => x.folder === folder && x.status === "pending"
    && (!destino || destinoDe(x) === destino));
  if (!hit.length) return [];
  const now = new Date().toISOString();
  for (const it of hit) { it.status = "cancelled"; it.cancelled_at = now; it.cancelled_reason = reason || "a peça foi publicada por outro caminho"; }
  save(l);
  return hit;
}

// Cria um agendamento (pendente). scheduled_at = ISO string.
function add({ folder, kind, caption, scheduled_at, by, label, destino }) {
  const when = new Date(scheduled_at);
  if (isNaN(when.getTime())) { const e = new Error("Data/hora inválida."); e.code = "E_BAD_DATE"; throw e; }
  // Horário que JÁ PASSOU não é agendamento — é publicar agora, sem ninguém olhando. A trava
  // existia só no navegador: pela API dava para agendar para ontem, e o tique seguinte postava
  // na hora. A folga de 2 minutos é para o relógio do navegador não brigar com o do servidor
  // (o campo de data só tem minuto: escolher "agora" chega aqui até 59s atrasado).
  if (when.getTime() < Date.now() - FOLGA_RELOGIO_MS) {
    const e = new Error("Esse horário já passou. Escolha uma data e hora no futuro — se a ideia é publicar agora, use o botão de publicar.");
    e.code = "E_DATA_NO_PASSADO"; throw e;
  }
  // Um agendamento pendente por peça. Duplo clique no botão "Agendar" (ou um retry) criava dois
  // itens iguais, e cada um virava um post no horário marcado.
  const dest = DESTINO_IDS.indexOf(destino) >= 0 ? destino : "feed";
  // Agendar só vale para o que o painel publica SOZINHO. Reels e "Outro" são manuais: a tela já
  // recusa "Publicar agora" neles, mas o agendamento aceitava — e o disparador, sem ninguém
  // olhando, mandava para o feed assim mesmo. Recusar aqui é melhor que publicar no lugar errado.
  if (kind && !publicaSozinho(dest, kind)) {
    const d = destinoById(dest);
    const e = new Error("O painel não publica " + ((d && d.label) || dest) + " sozinho, então não dá para agendar."
      + " Deixe a peça aprovada e poste na hora — o painel prepara os arquivos para você.");
    e.code = "E_DESTINO_MANUAL"; throw e;
  }
  if (pendingFor(folder, dest).length) {
    const e = new Error("Esta peça já tem um agendamento pendente para " + dest + ". Cancele o atual antes de criar outro.");
    e.code = "E_ALREADY_SCHEDULED"; throw e;
  }
  const list = load();
  const item = {
    id: crypto.randomBytes(8).toString("hex"),
    folder, label: label || folder, kind: kind || null,
    // `caption || null` apagava a escolha de publicar SEM legenda: vazio virava null e, na hora
    // de publicar, o painel caia na legenda do arquivo. Vazio e resposta; ausente e outra coisa.
    caption: caption == null ? null : String(caption), destino: dest,
    scheduled_at: when.toISOString(), status: "pending",
    created_at: new Date().toISOString(), by: by || null,
  };
  list.push(item); save(list); return item;
}
function list() { return load().slice().sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))); }
function get(id) { return load().find((x) => x.id === id) || null; }
function update(id, patch) {
  const l = load(); const it = l.find((x) => x.id === id);
  if (!it) return null; Object.assign(it, patch); save(l); return it;
}
// Cancela/suspende um agendamento ainda pendente.
function cancel(id) {
  const l = load(); const it = l.find((x) => x.id === id);
  if (!it) return null;
  if (it.status !== "pending") { const e = new Error("Só dá para cancelar um agendamento que ainda está pendente."); e.code = "E_NOT_PENDING"; throw e; }
  it.status = "cancelled"; it.cancelled_at = new Date().toISOString(); save(l); return it;
}

// Worker: a cada minuto, dispara os pendentes cujo horário já chegou. publishFn recebe
// (folder, {kind, caption}) e devolve { ok, dry_run, post_id }. Marca "publishing" antes
// de chamar (evita disparo duplo) e grava o resultado.
let started = false;
// Trava de reentrada DO TIQUE. Um tique podia começar com o anterior ainda no ar (publicar um
// carrossel passa de um minuto): cada um decidia a fila no começo e continuava usando essa foto
// ANTIGA depois de esperar o Instagram. O segundo item da fila — já publicado pelo outro tique —
// era publicado DE NOVO. Dois posts iguais na conta real, sem ninguém olhando. Um tique por vez.
let tiqueRodando = false;

// Trava POR ITEM, em arquivo, para o caso de existir mais de um painel vivo apontando para a
// mesma pasta de dados (o instante do deploy, em que o contêiner novo sobe antes do antigo sair).
// A trava de memória acima não atravessa processos; esta atravessa, porque criar arquivo com "wx"
// falha se ele já existir — quem cria é quem publica. Some sozinha: quem termina apaga a sua, e
// as esquecidas por um desligamento são varridas junto com os itens presos em "publishing".
const LOCKS_DIR = path.join(PATHS.DATA_DIR, "schedule_locks");
function caminhoTrava(id) { return path.join(LOCKS_DIR, String(id).replace(/[^a-zA-Z0-9_-]/g, "") + ".lock"); }
function tentaTravar(id) {
  try { fs.mkdirSync(LOCKS_DIR, { recursive: true }); } catch (e) { /* já existe */ }
  let fd;
  try { fd = fs.openSync(caminhoTrava(id), "wx", 0o600); } catch (e) { return false; } // já travado
  try { fs.writeSync(fd, JSON.stringify({ pid: process.pid, desde: new Date().toISOString() })); }
  finally { fs.closeSync(fd); }
  return true;
}
function destrava(id) { try { fs.unlinkSync(caminhoTrava(id)); } catch (e) { /* já saiu */ } }

// PEGA o agendamento para publicar. Relê do disco de propósito: a lista que o tique montou lá
// atrás pode estar velha, e é exatamente por confiar nela que o mesmo post saía duas vezes.
// Só sai daqui com o item se ele AINDA estiver pendente no arquivo e a trava for nossa.
function reivindica(id) {
  const l = load();
  const it = l.find((x) => x.id === id);
  if (!it || it.status !== "pending") return null;   // outro tique já pegou (ou foi cancelado)
  if (!tentaTravar(id)) return null;                 // outro painel está publicando este agora
  it.status = "publishing";
  it.started_at = new Date().toISOString();
  it.pid = process.pid;
  save(l);
  return it;
}

// Destrava itens que ficaram presos em "publishing". O processo pode morrer (deploy, OOM)
// entre marcar "publishing" e gravar o resultado; como o tick só olha "pending", o item ficava
// nesse limbo PARA SEMPRE e ninguém sabia se o post tinha saído. Aqui marcamos como falho, com
// texto pedindo conferência manual no Instagram — nunca republicamos sozinhos (risco de post duplo).
const STUCK_MS = 10 * 60 * 1000;
function recoverStuck() {
  const l = load();
  const now = Date.now();
  let changed = false;
  for (const it of l) {
    if (it.status !== "publishing") continue;
    const since = it.started_at ? new Date(it.started_at).getTime() : 0;
    if (since && now - since < STUCK_MS) continue; // ainda pode estar rodando
    it.status = "failed";
    it.error = "A publicação foi interrompida (o painel reiniciou no meio). Confira no Instagram se o post saiu antes de publicar de novo.";
    it.failed_at = new Date().toISOString();
    changed = true;
    destrava(it.id); // a trava em arquivo também ficou para trás
    console.error("[schedule] agendamento preso em publishing destravado:", it.id, it.folder);
  }
  if (changed) save(l);
  varreTravasEsquecidas(l);
}

// Trava em arquivo que sobrou de um desligamento. Só apaga a de item que NÃO está publicando:
// a de quem está no limbo fica com ele até o recoverStuck acima resolver o caso. Sem esta
// varredura, um item que morreu entre travar e gravar "publishing" ficaria pendente para sempre,
// sem nunca poder ser pego de novo — o agendamento simplesmente não aconteceria.
function varreTravasEsquecidas(lista) {
  let nomes;
  try { nomes = fs.readdirSync(LOCKS_DIR); } catch (e) { return; } // pasta ainda não existe
  const agora = Date.now();
  for (const nome of nomes) {
    if (!/\.lock$/.test(nome)) continue;
    const p = path.join(LOCKS_DIR, nome);
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (agora - st.mtimeMs < STUCK_MS) continue;      // pode estar em uso agora
    const it = lista.find((x) => x.id === nome.replace(/\.lock$/, ""));
    if (it && it.status === "publishing") continue;   // ainda no limbo
    try { fs.unlinkSync(p); } catch (e) { /* já saiu */ }
  }
}

function startWorker(publishFn, isPublishedFn) {
  if (started) return; started = true;
  recoverStuck();
  const tick = async () => {
    if (tiqueRodando) return; // ver a trava de reentrada lá em cima
    tiqueRodando = true;
    try { await rodaTique(publishFn, isPublishedFn); } finally { tiqueRodando = false; }
  };
  setInterval(() => { tick().catch(() => {}); }, 60 * 1000).unref();
  setTimeout(() => { tick().catch(() => {}); }, 4000).unref(); // roda logo após o boot (pega atrasados)
}

// Um tique: pega os agendamentos vencidos e publica um por um. Separado do startWorker para
// deixar à vista que quem o chama é a trava de reentrada — e só ela.
async function rodaTique(publishFn, isPublishedFn) {
  recoverStuck();
  const now = Date.now();
  const due = load().filter((x) => x.status === "pending" && new Date(x.scheduled_at).getTime() <= now);
  for (const alvo of due) {
    // Relê do disco e trava ANTES de publicar. É este passo que impede o mesmo agendamento de
    // ser pego duas vezes; a lista `due` acima é só um ponto de partida, e confiar nela depois
    // da espera pelo Instagram era exatamente o motivo de o post sair repetido.
    const it = reivindica(alvo.id);
    if (!it) continue;
    try {
      // Venceu faz tempo demais. O painel podia ter passado dias fora do ar (queda do provedor,
      // deploy travado) e, ao voltar, mandava tudo de uma vez para a conta real, fora de hora.
      // Melhor não publicar e dizer o porquê do que postar de madrugada uma peça de terça.
      const atraso = now - new Date(it.scheduled_at).getTime();
      if (atraso > ATRASO_MAX_MS) {
        const horas = Math.round(atraso / 3600000);
        update(it.id, {
          status: "perdido", perdido_at: new Date().toISOString(),
          error: "O horário marcado passou há " + (horas >= 48 ? Math.round(horas / 24) + " dias" : horas + " horas")
            + " e o painel não estava no ar para publicar. Não publiquei fora de hora — confira a peça e agende de novo.",
        });
        continue;
      }
      // A peça pode ter sido publicada na mão depois de agendada. Publicar de novo aqui
      // duplicaria o post na conta real, então pulamos e registramos o porquê.
      if (typeof isPublishedFn === "function") {
        let already = false;
        try { already = !!isPublishedFn(it.folder); } catch (e) { already = false; }
        if (already) {
          update(it.id, { status: "skipped", skipped_at: new Date().toISOString(), error: "A peça já tinha sido publicada antes do horário agendado — não publiquei de novo." });
          continue;
        }
      }
      // O DESTINO tem que viajar junto. Sem ele, o publicador caía no destino padrão do tipo
      // da peça — ou seja, FEED — e um Story agendado saía como post de feed, com a arte do
      // feed, sozinho, no horário marcado. E o histórico logo abaixo registrava "Story"
      // (destinoDe(it)), então nem olhando a aba Publicados dava para descobrir o que saiu.
      const r = await publishFn(it.folder, { kind: it.kind, destino: destinoDe(it), caption: it.caption });
      update(it.id, { status: r && r.dry_run ? "simulado" : "published", post_id: (r && r.post_id) || null, published_at: new Date().toISOString() });
      if (r && r.ok && !r.dry_run) {
        // MARCA A PEÇA como publicada — sem isto, o post agendado não deixa rastro no
        // status.json e o guard de post duplicado (409 E_ALREADY_PUBLISHED na rota) NÃO
        // dispara: um "Publicar agora" depois do agendado sairia como SEGUNDO post na conta
        // real. A rota já fazia isto; o disparador do agendamento não fazia.
        try { require("./content").setPublished(it.folder, { by: it.by, post_id: r.post_id }); }
        catch (e) { console.error("[schedule] post publicado mas falhou ao marcar a peça:", it.folder, e && e.message); }
        // registra no histórico de publicações (aba "Publicados") quando saiu de verdade
        try { publications.add({ folder: it.folder, label: it.label, kind: it.kind, destino: destinoDe(it), caption: it.caption, post_id: r.post_id, permalink: r.permalink, scheduled_at: it.scheduled_at, by: it.by }); }
        catch (e) { console.error("[schedule] post publicado mas falhou ao registrar no histórico:", it.folder, e && e.message); }
      }
    } catch (e) {
      // STORY PARCIAL PELO AGENDAMENTO. Cartoes ja no ar e a peca marcada como nao-publicada era
      // o pior desfecho: some do painel e a proxima tentativa duplica o que saiu. O botao ja
      // registrava; o agendador nao. Agora os dois passam pelo mesmo lugar.
      let extra = "";
      if (e && e.code === "E_STORY_PARCIAL" && Array.isArray(e.publicados) && e.publicados.length) {
        try { extra = require("./publish").registraParcialDoStory(it.folder, e.publicados, it.by, { scheduled_at: it.scheduled_at }); }
        catch (e2) { console.error("[schedule] story parcial: falhou ao registrar:", it.folder, e2 && e2.message); }
      }
      update(it.id, {
        status: extra ? "parcial" : "failed",
        error: ((e && e.message ? e.message : String(e)) + extra).slice(0, 300),
        failed_at: new Date().toISOString(),
      });
    } finally {
      // Solta a trava do item aconteça o que acontecer — inclusive quando ele foi dado como
      // perdido ou pulado acima. Trava esquecida seguraria o próximo agendamento desta peça.
      destrava(it.id);
    }
  }
}

// `rodaTique` sai daqui SÓ para a bateria poder disparar dois tiques sobrepostos e CONTAR quantas
// vezes cada peça foi publicada. O post duplicado era invisível para quem lia o código — as três
// travas parecem certas na leitura — e só o contador prova. O painel continua chamando o tique
// por startWorker, que é quem segura a trava de reentrada; quem chamar rodaTique direto está
// fora dela de propósito, que é justamente o cenário do teste.
module.exports = { add, list, update, cancel, startWorker, pendingFor, cancelPendingFor, rodaTique };
