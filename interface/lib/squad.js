// squad.js — recebimento das artes que o sistema squad.4st.co (radar-api) manda para o painel.
//
// O sistema do squad JÁ TEM o emissor pronto: POST /api/pautas4selet/posts/{id}/enviar, que
// chama `httpx.post(cred, json={post_id, legenda, cards})` — onde `cred` é a URL inteira e
// NENHUM cabeçalho é enviado. Isso decide duas coisas aqui:
//   1) o token precisa ser aceito na QUERY STRING (?token=...), senão não há como autenticar
//      sem eles mexerem no código. O cabeçalho X-Painel-Token também vale, e é o preferido.
//   2) `cards` chega como lista de STRINGS (data URI do PNG). A forma rica — lista de objetos
//      com `html` junto — é o que pedimos a eles; as duas são aceitas aqui.
//
// O caminho da peça respeita o ciclo de vida oficial, sem atalho: criar em rascunho ->
// gravar as artes -> preparar para edição -> promover para revisão -> promover para APROVADOS.
// Plantar a pasta direto em outputs/approved/ NÃO funciona: sem content_hashes o gate de
// publicação recusa com E_GATE_NO_HASHES, e quem calcula esses hashes é só o promote_task.js.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS } = require("./config");

const DATA_DIR = path.join(PATHS.INTERFACE_DIR, "data");
const ARQ_TOKEN = path.join(DATA_DIR, "squad.json");
const ARQ_INDICE = path.join(DATA_DIR, "squad_recebidos.json");
const DIR_REQ = path.join(DATA_DIR, "squad_requisicoes");

// Teto de espaço dos payloads guardados. Um post de 6 cards com foto de IA passa de 30 MB —
// guardar tudo para sempre enche o disco da VPS. Os DADOS da requisição (quem, quando, o que
// deu) são pequenos e ficam para sempre; só o corpo cru é podado, do mais antigo para o mais
// novo, e a tela diz quando um payload já não está mais lá.
const TETO_PAYLOADS_BYTES = 300 * 1024 * 1024;
// Teto de LINHAS do registro. Duas entregas por dia levam 4 anos para chegar aqui, então na
// prática ninguém perde histórico útil — e o painel fica protegido de quem dispare chamadas
// em laço, que era o caminho fácil para deixar a tela lenta.
const MAX_REGISTROS = 3000;
const MAX_CARDS = 10;               // limite do carrossel do Instagram
const MAX_BYTES_IMAGEM = 15 * 1024 * 1024;

function garanteDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DIR_REQ, { recursive: true });
}
function lerJson(p, padrao) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return padrao; }
}
// Escrita atômica: um JSON pela metade (queda no meio da escrita) some da tela sem erro
// nenhum, porque quem lê faz `continue` no parse que falha.
function gravarJson(p, obj, modo) {
  garanteDirs();
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), modo ? { encoding: "utf8", mode: modo } : "utf8");
  fs.renameSync(tmp, p);
  if (modo) { try { fs.chmodSync(p, modo); } catch (e) {} }
}

// ---------------------------------------------------------------- token

function gerarToken() {
  return "sq_" + crypto.randomBytes(32).toString("hex");
}
function lerConfig() {
  return lerJson(ARQ_TOKEN, {}) || {};
}
// `comoVeio` distingue as DUAS direções possíveis, que a tela precisa contar sem ambiguidade:
// "colado" = o time do squad gerou e nos passou; "gerado" = nasceu aqui e nós passamos a eles.
function salvarToken(token, quem, comoVeio) {
  const t = String(token || "").trim();
  if (t.length < 16) { const e = new Error("o token precisa ter pelo menos 16 caracteres"); e.code = "E_TOKEN_CURTO"; throw e; }
  const cfg = lerConfig();
  gravarJson(ARQ_TOKEN, {
    token: t,
    criado_em: new Date().toISOString(),
    criado_por: quem || null,
    como_veio: comoVeio === "gerado" ? "gerado" : "colado",
    ultima_requisicao: cfg.ultima_requisicao || null,
  }, 0o600);
  // Fica registrado QUEM mexeu e QUANDO. Um token sumiu em produção sem deixar rastro e não
  // houve como reconstituir o que aconteceu: o painel guardava o token, mas não guardava a
  // história dele. Agora guarda — e a linha aparece na mesma tela de Requisições.
  registrar({
    resultado: "conexao",
    erro: null,
    titulo: cfg.token
      ? (comoVeio === "gerado" ? "Token substituído por um criado no painel" : "Token substituído por um vindo do squad")
      : (comoVeio === "gerado" ? "Token criado no painel" : "Token do squad guardado"),
    por: quem || null,
    logs: [],
  });
  return true;
}
function removerToken(quem) {
  const tinha = !!lerConfig().token;
  try { fs.unlinkSync(ARQ_TOKEN); } catch (e) {}
  if (tinha) {
    registrar({
      resultado: "conexao",
      titulo: "Conexão desligada — o token foi removido",
      erro: "A partir daqui as entregas do squad são recusadas até um token novo ser cadastrado.",
      por: quem || null,
      logs: [],
    });
  }
  return true;
}
// O valor NUNCA volta inteiro para o navegador — mesma regra do resto do painel.
function estado() {
  const cfg = lerConfig();
  const reqs = listar(1);
  const ent = contadoresDeEntrega();   // uma vez só: ele pode gravar a config na primeira leitura
  return {
    conectado: !!cfg.token,
    token_dica: cfg.token ? ("…" + String(cfg.token).slice(-4)) : null,
    criado_em: cfg.criado_em || null,
    criado_por: cfg.criado_por || null,
    como_veio: cfg.como_veio || null,
    ultima_requisicao: cfg.ultima_requisicao || null,
    ultimo_resultado: reqs.length ? reqs[0].resultado : null,
    total_requisicoes: contarRequisicoes(),   // TODAS as batidas na porta, inclusive as recusadas
    // O que interessa na tela: quantas artes chegaram de verdade, e quando foi a última.
    entregas: ent.entregas,
    ultima_entrega: ent.ultima_entrega,
  };
}
// Instalação que já rodava antes deste contador não tem o número na config. Nesse caso ele é
// deduzido do registro UMA vez (com teto, para não repetir o congelamento de 10 mil linhas) e
// guardado — das próximas vezes é só leitura.
function contadoresDeEntrega() {
  const cfg = lerConfig();
  if (cfg.entregas != null) return { entregas: Number(cfg.entregas) || 0, ultima_entrega: cfg.ultima_entrega || null };
  let entregas = 0, ultima = null;
  try {
    for (const r of listar(500)) {
      if (r && r.peca && RESULTADO_ENTREGA.indexOf(r.resultado) >= 0) {
        entregas++;
        if (!ultima || String(r.recebido_em) > String(ultima)) ultima = r.recebido_em;
      }
    }
  } catch (e) { /* sem registro legível: começa do zero */ }
  try { if (cfg.token) { cfg.entregas = entregas; cfg.ultima_entrega = ultima; gravarJson(ARQ_TOKEN, cfg, 0o600); } } catch (e) {}
  return { entregas, ultima_entrega: ultima };
}
// Comparação em tempo constante. timingSafeEqual EXPLODE se os buffers tiverem tamanhos
// diferentes — por isso comparamos o sha256 dos dois lados, que tem tamanho fixo.
function confere(recebido) {
  const esperado = lerConfig().token;
  if (!esperado) return false;
  const r = String(recebido == null ? "" : recebido).trim();
  if (!r) return false;
  const a = crypto.createHash("sha256").update(r).digest();
  const b = crypto.createHash("sha256").update(String(esperado)).digest();
  return crypto.timingSafeEqual(a, b);
}
// De onde tirar o token da chamada. Ficam aqui (e não na rota) porque o server.js precisa
// conferir o token ANTES de ler o corpo — um post de 40 MB não pode ser lido antes de
// sabermos quem está batendo na porta.
function tokenDaRequisicao(req) {
  const h = req.headers["x-painel-token"];
  if (h) return String(h).trim();
  const auth = req.headers.authorization;
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  // O emissor do squad chama httpx.post(url, json=...) SEM cabeçalhos: a credencial que eles
  // cadastram é a URL inteira. Aceitar o token na query é o que permite ligar a integração
  // sem que eles precisem mexer no código.
  return String((req.query && req.query.token) || "").trim();
}
// Mesmo critério do login: o PRIMEIRO X-Forwarded-For é justamente o que se forja.
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) { const p = String(xff).split(","); return p[p.length - 1].trim(); }
  return (req.socket && req.socket.remoteAddress) || "?";
}

function marcarRequisicao() {
  const cfg = lerConfig();
  if (!cfg.token) return;
  cfg.ultima_requisicao = new Date().toISOString();
  gravarJson(ARQ_TOKEN, cfg, 0o600);
}

// --------------------------------------------------- log de requisições

function novoId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "_" + crypto.randomBytes(3).toString("hex");
}
function caminhoReq(id) { return path.join(DIR_REQ, id + ".json"); }
function caminhoPayload(id) { return path.join(DIR_REQ, id + ".payload.json"); }

function registrar(dados) {
  garanteDirs();
  const id = dados.id || novoId();
  const reg = Object.assign({ id, recebido_em: new Date().toISOString(), logs: [] }, dados, { id });
  gravarJson(caminhoReq(id), reg);
  return reg;
}
// Recusa na porta também vira linha — mas com freio. Sem freio, quem varre a internet
// tentando senha encheria a tela (e o disco) de ruído; com o freio, o Hugo vê que houve
// tentativa e continua achando as entregas de verdade.
// O freio olha o PRÓPRIO registro, não uma variável na memória: assim ele sobrevive a um
// reinício do painel (senão bastava o processo reiniciar para a enxurrada recomeçar) e não
// depende de quanto tempo o servidor está de pé.
const RECUSA_INTERVALO_MS = 5 * 60 * 1000;
function registrarRecusa(ip, motivo) {
  const ultima = listar(12).find((r) => r.resultado === "recusada");
  if (ultima && Date.now() - new Date(ultima.recebido_em).getTime() < RECUSA_INTERVALO_MS) return null;
  return registrar({ origem_ip: ip, resultado: "recusada", erro: motivo, logs: [] });
}
// Uma ENTREGA é uma requisição que virou PEÇA. O cartão de Configurações contava todo arquivo
// do registro — inclusive as varreduras automáticas da internet que a porta recusou. Medido em
// produção: dizia "9 entregas recebidas" quando eram 1 entrega, 7 varreduras e 1 teste.
// O contador vive na config e sobe UMA vez por requisição (atualizar é chamada várias vezes
// para o mesmo registro). Contar varrendo a pasta a cada abertura da tela era o caminho que já
// congelou o painel uma vez — ver o comentário do "CORTA ANTES DE LER" mais acima.
const RESULTADO_ENTREGA = ["criada", "atualizada"];
function atualizar(reg) {
  gravarJson(caminhoReq(reg.id), reg);
  return reg;
}
// A contagem vive AQUI, e não em quem grava o registro: quem sabe que uma arte chegou é o
// caminho que cria a peça. Colocada no atualizar(), ela ficava em zero sempre que a entrega não
// passasse pela rota HTTP — inclusive no reprocessamento pela tela de Requisições.
function contabilizarEntrega(quando) {
  try {
    const cfg = lerConfig();
    if (!cfg.token) return;
    cfg.entregas = (Number(cfg.entregas) || 0) + 1;
    cfg.ultima_entrega = quando || new Date().toISOString();
    gravarJson(ARQ_TOKEN, cfg, 0o600);
  } catch (e) { /* contagem é informativa: nunca derruba a entrega */ }
}
function guardarPayload(id, payload) {
  garanteDirs();
  try {
    fs.writeFileSync(caminhoPayload(id), JSON.stringify(payload));
    podar();
    return true;
  } catch (e) { return false; }
}
function lerPayload(id) {
  if (!/^[0-9a-z_]+$/i.test(String(id))) return null;
  return lerJson(caminhoPayload(id), null);
}
function contarRequisicoes() {
  try { return fs.readdirSync(DIR_REQ).filter((f) => /\.json$/.test(f) && !/\.payload\.json$/.test(f)).length; }
  catch (e) { return 0; }
}
// CORTA ANTES DE LER. A versão anterior abria e interpretava TODOS os registros para depois
// jogar fora tudo menos os primeiros — e como isso é leitura de disco em fila, o painel inteiro
// congelava para todo mundo enquanto durasse. Medido: com 10 mil entregas, 13 segundos parado
// só para desenhar a tela de Configurações.
//
// Dá para cortar pelo nome porque o identificador começa com a data e a hora em largura fixa
// (AAAAMMDDHHMMSS_xxxxxx): ordem alfabética é ordem cronológica.
function listar(limite) {
  garanteDirs();
  let nomes;
  try { nomes = fs.readdirSync(DIR_REQ); } catch (e) { return []; }
  nomes = nomes
    .filter((f) => /\.json$/.test(f) && !/\.payload\.json$/.test(f) && !/\.tmp$/.test(f))
    .sort((a, b) => b.localeCompare(a));
  if (limite && limite > 0) nomes = nomes.slice(0, limite);
  return nomes
    .map((f) => lerJson(path.join(DIR_REQ, f), null))
    .filter(Boolean)
    .sort((a, b) => String(b.recebido_em || "").localeCompare(String(a.recebido_em || "")))
    .map((r) => Object.assign({}, r, { payload_disponivel: fs.existsSync(caminhoPayload(r.id)) }));
}
function obter(id) {
  if (!/^[0-9a-z_]+$/i.test(String(id))) return null;
  const r = lerJson(caminhoReq(id), null);
  if (!r) return null;
  return Object.assign({}, r, { payload_disponivel: fs.existsSync(caminhoPayload(id)) });
}
// Poda os corpos crus mais antigos quando o espaço estoura, e também as linhas mais antigas
// do registro quando elas passam do teto. Guardar registro "para sempre" parecia inofensivo
// (são poucos bytes) até alguém contar quanto custa lê-los: a pasta é a fonte da tela.
function podar() {
  try {
    const regs = fs.readdirSync(DIR_REQ)
      .filter((f) => /\.json$/.test(f) && !/\.payload\.json$/.test(f) && !/\.tmp$/.test(f))
      .sort((a, b) => b.localeCompare(a));
    for (const velho of regs.slice(MAX_REGISTROS)) {
      try { fs.unlinkSync(path.join(DIR_REQ, velho)); } catch (e) {}
      try { fs.unlinkSync(path.join(DIR_REQ, velho.replace(/\.json$/, ".payload.json"))); } catch (e) {}
    }
  } catch (e) {}

  let arquivos;
  try { arquivos = fs.readdirSync(DIR_REQ).filter((f) => /\.payload\.json$/.test(f)); } catch (e) { return; }
  const info = arquivos.map((f) => {
    const abs = path.join(DIR_REQ, f);
    let st = null; try { st = fs.statSync(abs); } catch (e) {}
    return { abs, nome: f, bytes: st ? st.size : 0, mtime: st ? st.mtimeMs : 0 };
  }).sort((a, b) => a.mtime - b.mtime); // mais antigo primeiro
  let total = info.reduce((s, i) => s + i.bytes, 0);
  for (const i of info) {
    if (total <= TETO_PAYLOADS_BYTES) break;
    try { fs.unlinkSync(i.abs); total -= i.bytes; } catch (e) {}
  }
}

// ------------------------------------------- índice de idempotência

// O emissor do squad espera a resposta por 30 segundos (`timeout=30` no httpx deles). Montar
// um carrossel leva MAIS que isso: é um processo de node para criar, um Chromium por arte, e
// mais dois processos para promover. Ou seja: eles SEMPRE veriam um erro de tempo esgotado, e
// o reenvio criaria uma segunda peça aprovada do mesmo post.
//
// Por isso o recebimento é em duas etapas: a entrega é aceita e RESERVADA na hora (resposta
// rápida), e a peça é montada em seguida. A reserva é o que faz o reenvio ser inofensivo.
function indice() { return lerJson(ARQ_INDICE, {}) || {}; }
function entradaDeOrigem(origemId) {
  if (origemId == null || origemId === "") return null;
  const e = indice()[String(origemId)];
  if (!e) return null;
  return typeof e === "string" ? { folder: e, estado: "pronta" } : e;
}
function gravaIndice(ix) {
  const chaves = Object.keys(ix);
  if (chaves.length > 500) chaves.slice(0, chaves.length - 500).forEach((k) => delete ix[k]);
  gravarJson(ARQ_INDICE, ix);
}
// Marca "esta entrega é minha, estou montando". Devolve false se já havia reserva.
function reservar(origemId, requisicaoId) {
  if (origemId == null || origemId === "") return true;
  const ix = indice();
  if (ix[String(origemId)]) return false;
  ix[String(origemId)] = { estado: "montando", requisicao: requisicaoId, em: new Date().toISOString() };
  gravaIndice(ix);
  return true;
}
function concluirReserva(origemId, folder) {
  if (origemId == null || origemId === "") return;
  const ix = indice();
  ix[String(origemId)] = { estado: "pronta", folder, em: new Date().toISOString() };
  gravaIndice(ix);
}
// Deu errado: solta a reserva, senão um reenvio legítimo seria recusado para sempre.
function liberarReserva(origemId) {
  if (origemId == null || origemId === "") return;
  const ix = indice();
  delete ix[String(origemId)];
  gravaIndice(ix);
}

// ------------------------------------------------- leitura do payload

function dataUriParaBuffer(s) {
  const m = /^data:image\/[a-z0-9.+-]+;base64,([\s\S]+)$/i.exec(String(s || "").trim());
  if (!m) return null;
  try { return Buffer.from(m[1], "base64"); } catch (e) { return null; }
}
function sniffImagem(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
}
// O HTML que chega de fora só serve como receita de edição se for AUTOSSUFICIENTE — quer dizer,
// se tudo que ele desenha estiver dentro dele mesmo (data: URI). Duas coisas o quebram aqui:
//
//   file:///tmp/4s_cover_xxx.png — a armadilha nº1: o card de capa do squad embute a foto
//   gerada num arquivo temporário que só existe no container DELES;
//
//   https://qualquer-coisa — o desenho aqui roda com a rede BLOQUEADA de propósito (e o
//   navegador, no editor, também barra imagem de fora pela política de segurança do painel).
//
// Nos dois casos o resultado seria o mesmo e é o pior possível: um PNG com buraco no lugar da
// foto, aprovado e pronto para publicar, sem ninguém perceber. Então: se o HTML depende de
// algo de fora, ele não vira receita — vale a imagem pronta que veio junto.
function refsExternas(html) {
  const achados = [];
  // Três formas, porque HTML de gerador aparece nas três: com aspas, SEM aspas (é HTML válido
  // e vários geradores emitem assim) e dentro de url(). E "file:/" com uma barra só conta —
  // o navegador normaliza para file:///, então deixar passar seria o mesmo furo.
  const padroes = [
    /(?:src|href)\s*=\s*"([^"]+)"/gi,
    /(?:src|href)\s*=\s*'([^']+)'/gi,
    /(?:src|href)\s*=\s*([^\s"'>]+)/gi,
    /url\(\s*["']?([^"')]+)/gi,
  ];
  const texto = String(html || "");
  for (const re of padroes) {
    let m;
    while ((m = re.exec(texto))) {
      const u = String(m[1] || "").trim();
      if (!u) continue;
      if (/^(data:|#|about:)/i.test(u)) continue;
      if (/^(file:|https?:|\/\/)/i.test(u) && achados.indexOf(u) === -1) achados.push(u);
    }
  }
  return achados;
}
// Tamanho da arte declarado pelo próprio HTML. O squad escreve html,body{width:1080px;height:1350px}.
//
// Pegar o PRIMEIRO "width:NNNpx" que aparecer no arquivo não serve: qualquer regra anterior —
// o selo, o logo, um botão — venceria, e a arte sairia desenhada no tamanho do selo. Como o
// número vai direto para o desenho, o estrago é silencioso: a peça sai cortada e é aprovada
// assim. Então lemos a medida SÓ das regras que definem a página: html, body e .card.
const TAM_MIN = 200, TAM_MAX = 4000;
function dimensoesDoHtml(html) {
  const s = String(html || "");
  // Lê só o que está dentro de <style>: sem isso o primeiro seletor vem grudado na etiqueta
  // ("<style>.card") e deixa de ser reconhecido.
  let css = "";
  const estilos = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let e;
  while ((e = estilos.exec(s))) css += "\n" + e[1];
  if (!css.trim()) css = s;

  const achado = { pagina: null, cartao: null };
  const blocos = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = blocos.exec(css))) {
    const seletor = m[1].toLowerCase().replace(/^[\s\S]*[};]/, "").trim();
    const corpo = m[2];
    const ehPagina = /(^|,)\s*(html|body)\s*(,|$)/.test(seletor);
    const ehCartao = /(^|,)\s*\.card\s*(,|$)/.test(seletor);
    if (!ehPagina && !ehCartao) continue;
    const w = /(?:^|[;{\s])width\s*:\s*(\d{3,4})px/i.exec(corpo);
    const h = /(?:^|[;{\s])height\s*:\s*(\d{3,4})px/i.exec(corpo);
    if (!w || !h) continue;
    const d = { w: parseInt(w[1], 10), h: parseInt(h[1], 10) };
    if (d.w < TAM_MIN || d.w > TAM_MAX || d.h < TAM_MIN || d.h > TAM_MAX) continue;
    if (ehPagina && !achado.pagina) achado.pagina = d;
    if (ehCartao && !achado.cartao) achado.cartao = d;
  }
  // 1080x1350 é o formato do feed do Instagram e é o que o squad usa hoje: é o palpite certo
  // quando o HTML não diz nada.
  return achado.pagina || achado.cartao || { w: 1080, h: 1350 };
}

const FORMATOS = {
  carrossel: "carrossel", carousel: "carrossel",
  post_unico: "post_unico", post: "post_unico", feed: "post_unico", unico: "post_unico",
  reel: "reel", reels: "reel", video: "reel",
  story: "story", stories: "story",
};

// Lê o que veio e devolve uma forma única, aceitando as DUAS versões do payload deles.
// Erros aqui são de leitura do pedido: viram mensagem clara na tela de Requisições.
// Os avisos que o sistema do squad pode mandar. Sem `evento` declarado vale "post.pronto",
// que é o que o emissor deles faz hoje — ninguém precisa mexer em nada para continuar
// funcionando. Esta lista é fechada de propósito: aviso desconhecido é recusado com uma
// mensagem que diz o que é aceito, em vez de ser tratado como "pronto" e criar peça errada.
const EVENTOS = {
  "post.pronto": { arte: true, rotulo: "Arte pronta" },
  "post.atualizado": { arte: true, rotulo: "Arte refeita" },
  "post.cancelado": { arte: false, rotulo: "Post cancelado" },
  "teste": { arte: false, rotulo: "Teste de conexão" },
};
const EVENTO_ALIAS = {
  "": "post.pronto", "post": "post.pronto", "pronto": "post.pronto", "post.criado": "post.pronto",
  "atualizado": "post.atualizado", "post.refeito": "post.atualizado", "refeito": "post.atualizado",
  "cancelado": "post.cancelado", "post.cancelamento": "post.cancelado",
  "ping": "teste", "teste.conexao": "teste", "test": "teste",
};

function normalizar(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const erro = (msg, code) => { const e = new Error(msg); e.code = code || "E_PAYLOAD"; throw e; };

  const bruto = String(p.evento || p.event || p.tipo || "").toLowerCase().trim();
  const evento = EVENTOS[bruto] ? bruto : (EVENTO_ALIAS[bruto] || null);
  if (!evento) {
    erro("não conheço o aviso \"" + bruto.slice(0, 40) + "\". Os aceitos são: "
      + Object.keys(EVENTOS).join(", ") + ".", "E_EVENTO");
  }

  // Aviso que não traz arte para sem depender da lista de cards.
  if (!EVENTOS[evento].arte) {
    return {
      evento,
      origem_id: p.post_id != null ? String(p.post_id) : (p.id != null ? String(p.id) : null),
      motivo: String(p.motivo || p.razao || "").trim() || null,
      titulo: String(p.titulo || p.title || "").trim() || null,
      cards: [], hashtags: [], legenda: "", formato: null, pauta: null,
    };
  }

  const brutos = Array.isArray(p.cards) ? p.cards : (Array.isArray(p.artes) ? p.artes : null);
  if (!brutos) erro("o corpo da requisição não trouxe a lista de cards (campo \"cards\")");
  if (!brutos.length) erro("a requisição chegou sem nenhuma arte");
  if (brutos.length > MAX_CARDS) {
    erro("vieram " + brutos.length + " artes; o Instagram aceita no máximo " + MAX_CARDS +
      " por publicação. Nada foi criado para você não receber a peça pela metade.", "E_MUITOS_CARDS");
  }

  const cards = [];
  brutos.forEach((c, i) => {
    const n = i + 1;
    const obj = (c && typeof c === "object") ? c : { png: c };
    const imagem = obj.png || obj.imagem || obj.image || (typeof c === "string" ? c : null);
    // Aceita o HTML completo E o pedaço solto. Exigir a etiqueta <html> descartava em silêncio
    // um HTML perfeitamente desenhável que começasse por <!doctype> ou fosse só o miolo — e
    // "descartar em silêncio" é justamente o que não pode acontecer com arte de terceiro.
    const htmlBruto = typeof obj.html === "string" ? obj.html.trim() : "";
    const html = htmlBruto && /<[a-z!]/i.test(htmlBruto)
      ? (/<html[\s>]/i.test(htmlBruto) ? htmlBruto
        : "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" + htmlBruto + "</body></html>")
      : null;
    let buf = imagem ? dataUriParaBuffer(imagem) : null;
    if (buf && buf.length > MAX_BYTES_IMAGEM) {
      erro("a arte " + n + " tem " + (buf.length / 1048576).toFixed(1) + " MB, acima do limite de "
        + (MAX_BYTES_IMAGEM / 1048576) + " MB por arte", "E_ARTE_GRANDE");
    }
    const ext = buf ? sniffImagem(buf) : null;
    if (buf && !ext) erro("a arte " + n + " não é PNG nem JPEG");
    if (!buf && !html) erro("a arte " + n + " chegou sem imagem e sem HTML — não há o que gravar");
    cards.push({
      n: Number(obj.n) > 0 ? Number(obj.n) : n,
      tipo: String(obj.tipo || obj.type || "").slice(0, 24) || null,
      buf, ext, html,
      largura: Number(obj.largura || obj.width) || null,
      altura: Number(obj.altura || obj.height) || null,
    });
  });
  cards.sort((a, b) => a.n - b.n);

  const formatoBruto = String(p.formato || p.format || "").toLowerCase().trim();
  // Sem formato declarado, vale a mesma regra que eles usam: mais de um card = carrossel.
  const formato = FORMATOS[formatoBruto] || (cards.length > 1 ? "carrossel" : "post_unico");

  const legenda = String(p.legenda || p.caption || "").trim();
  const hashtags = Array.isArray(p.hashtags)
    ? p.hashtags.map((h) => String(h).trim()).filter(Boolean).map((h) => (h[0] === "#" ? h : "#" + h))
    : [];
  const titulo = String(p.titulo || p.title || "").trim()
    || legenda.split(/\n/)[0].slice(0, 70)
    || "Arte recebida do squad";

  return {
    evento,
    origem_id: p.post_id != null ? String(p.post_id) : (p.id != null ? String(p.id) : null),
    titulo, formato, legenda, hashtags, cards,
    pauta: String(p.pauta || p.foco || p.justificativa || "").trim() || null,
    motivo: String(p.motivo || p.razao || "").trim() || null,
  };
}

// ------------------------------------------------- criação da peça

function hoje() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}
// Nome livre: se já existe peça com esse identificador e data, tenta _2, _3… Sem isso,
// reprocessar uma requisição bateria em "já existe" e não sairia do lugar.
function nomeLivre(content, base, data) {
  const raiz = slugify(base) || "arte_do_squad";
  for (let i = 1; i <= 50; i++) {
    const nome = i === 1 ? raiz : (raiz.slice(0, 36) + "_" + i);
    if (!content.findTask(nome + "_" + data)) return nome;
  }
  const e = new Error("não consegui um identificador livre para a peça");
  e.code = "E_SEM_NOME"; throw e;
}

// Uma entrega de cada vez. Sem isto, duas chamadas ao mesmo tempo escolhem o nome da peça
// ANTES de qualquer uma criar a pasta — as duas veem o nome livre, e a segunda escreve as
// artes dela por cima da primeira. Não é hipótese remota: basta o sistema do squad reenviar
// por não ter recebido a resposta a tempo. A fila também evita dois Chromium de render
// disputando a máquina.
let _fila = Promise.resolve();
function emFila(fn) {
  const proxima = _fila.then(fn, fn);
  _fila = proxima.then(() => undefined, () => undefined); // a fila nunca quebra
  return proxima;
}

// Transforma o post recebido numa peça do painel e a deixa em APROVADOS.
// `log` recebe cada passo — é o que aparece na tela de Requisições.
function receber(payload, opcoes) {
  return emFila(() => receberAgora(payload, opcoes));
}

async function receberAgora(payload, opcoes) {
  const op = opcoes || {};
  const log = typeof op.log === "function" ? op.log : function () {};
  const content = require("./content");
  const render = require("./render");

  const p = op.jaLido || normalizar(payload);
  log("Li a entrega: " + p.cards.length + " arte(s), formato " + p.formato + ".");

  const data = hoje();
  const task = nomeLivre(content, p.titulo, data);
  const folder = task + "_" + data;

  const criou = await content.createTask({ task_name: task, task_date: data, platforms: ["instagram"] });
  if (!criou.ok) {
    // A saída crua do script é registro técnico: vai para o console do servidor, não para a
    // tela de quem opera. Na tela fica o que dá para fazer a respeito.
    console.error("[squad] createTask falhou:", criou.stderr || criou.stdout);
    const e = new Error("Não consegui criar a peça no painel. O motivo técnico ficou no registro do servidor; tente reprocessar esta entrega pela tela.");
    e.code = "E_CRIAR"; throw e;
  }
  log("Peça criada como rascunho: " + folder + ".");

  try {
    const carrossel = p.cards.length > 1;
    const avisos = [];

    for (let i = 0; i < p.cards.length; i++) {
      const c = p.cards[i];
      const n = i + 1;
      const base = carrossel ? "slides/slide_" + n : "ads/feed";

      // Caminho A — veio HTML: é a arte EDITÁVEL de verdade (dá para mexer no texto, não só
      // por cima dele). Só vale se o HTML for autossuficiente.
      let usouHtml = false;
      if (c.html) {
        const externas = refsExternas(c.html);
        if (externas.length && c.buf) {
          avisos.push("A arte " + n + " veio junto com o desenho editável, mas ele depende de uma imagem que mora"
            + " no servidor do squad e não veio junto. Usei a arte pronta, que está correta — só a edição fica"
            + " limitada a mexer por cima, sem trocar o texto por dentro. Se quiser destravar isso, peça ao time"
            + " do squad para embutir as imagens no próprio desenho.");
          log("Arte " + n + ": o desenho editável dependia de algo de fora (" + externas[0].slice(0, 70) + ").");
        } else if (externas.length && !c.buf) {
          avisos.push("A arte " + n + " veio só como desenho editável, e ele depende de uma imagem que não veio junto —"
            + " então ela apareceria com um buraco. Peça ao time do squad para reenviar com a imagem embutida.");
          const e = new Error("A arte " + n + " depende de um arquivo que não veio junto com a entrega.");
          e.code = "E_HTML_INCOMPLETO"; throw e;
        } else if (!c.buf) {
          // sem imagem, o HTML é o único caminho: se ele falhar, não há arte nenhuma
          usouHtml = await gravarDeHtml(render, content, folder, base, c, log, avisos, n, true);
        } else {
          usouHtml = await gravarDeHtml(render, content, folder, base, c, log, avisos, n, false);
        }
      }

      if (!usouHtml) {
        if (!c.buf) { const e = new Error("a arte " + n + " não pôde ser gravada"); e.code = "E_SEM_ARTE"; throw e; }
        content.writeMediaFile(folder, base + "." + c.ext, c.buf);
        // O desenho editável NÃO veio, e isso passava calado: a peça nascia chapada e quem
        // abrisse o editor ia procurar o texto e não achar. O contrato pede o `html` junto do
        // `png` (seção 3.2 do PROMPT_SQUAD_WEBHOOK.md, com o aceite escrito) — quando ele falta,
        // o painel diz, em vez de deixar a pessoa descobrir clicando.
        if (!c.html) {
          avisos.push("A arte " + n + " chegou só como imagem, sem o desenho editável junto. Ela está correta e"
            + " pode ser publicada — mas o texto dela faz parte da figura: dá para escrever por cima, e não para"
            + " reescrever o que já está lá. Para destravar a edição do texto, o time do squad precisa mandar o"
            + " campo cards[].html junto com o png (está na seção 3.2 do documento da integração).");
          log("Arte " + n + ": veio sem cards[].html — a peça fica editável só por cima.");
        }
      }
    }
    log("Artes gravadas.");

    const legenda = (p.legenda + (p.hashtags.length ? "\n\n" + p.hashtags.join(" ") : "")).trim();
    content.writeContentFile(folder, "copy/instagram_caption.txt", legenda + "\n", "webhook do squad");

    content.setTitle(folder, p.titulo);
    content.setImported(folder);
    content.setOrigem(folder, {
      sistema: "squad",
      id: p.origem_id,
      evento: p.evento || "post.pronto",
      formato: p.formato,
      pauta: p.pauta,
      recebido_em: new Date().toISOString(),
      // Quando o squad refaz um post que já tinha mandado, a arte nova vira uma peça NOVA e
      // guarda o endereço da anterior. Sobrescrever a antiga seria pior: ela pode já ter sido
      // editada, agendada ou publicada — e a decisão de qual vale é de quem opera, não nossa.
      substitui: op.substitui || null,
      avisos,
    });

    // Prepara para edição as artes que vieram só como imagem (as que já têm receita .html
    // são puladas pela própria prepararImportada). Precisa acontecer AGORA, com a peça ainda
    // na zona ativa — depois de aprovada, toda escrita na pasta é recusada.
    try {
      const prep = await render.prepararImportada(folder);
      if (prep && prep.preparadas.length) log("Preparei " + prep.preparadas.length + " arte(s) para edição.");
    } catch (e) {
      if (e.code !== "E_SEM_ARTE") {
        avisos.push("Não consegui preparar a arte para edição: " + e.message + ". A peça está inteira; dá para editar depois pelo botão da própria peça.");
        log("Aviso: preparar para edição falhou (" + (e.code || e.message) + ").");
      }
    }

    // Ciclo oficial, sem atalho: rascunho -> em revisão -> aprovado (é aqui que nascem os
    // content_hashes que o gate de publicação confere).
    const rev = await content.promote(task, data, "in_review");
    if (!rev.ok) {
      console.error("[squad] promote in_review falhou:", rev.stderr || rev.stdout);
      const e = new Error("A arte foi gravada, mas não consegui encaminhar a peça para revisão. Ela está no painel como rascunho; tente reprocessar esta entrega.");
      e.code = "E_PROMOVER"; throw e;
    }
    const apr = await content.promote(task, data, "approved", "Sistema squad");
    if (!apr.ok) {
      console.error("[squad] promote approved falhou:", apr.stderr || apr.stdout);
      const e = new Error("A peça ficou pronta, mas não consegui deixá-la em Aprovados. Ela está no painel aguardando revisão; você pode aprová-la à mão ou reprocessar esta entrega.");
      e.code = "E_APROVAR"; throw e;
    }
    log("Peça aprovada e disponível em Aprovados.");

    if (p.formato === "reel" || p.formato === "story") {
      avisos.push("O painel ainda não publica " + (p.formato === "reel" ? "vídeo" : "story") + " sozinho."
        + " A peça está em Aprovados para você baixar e postar à mão.");
    }
    // Grava de novo os avisos: os últimos nasceram depois da primeira gravação. É seguro fazer
    // isto com a peça já aprovada porque status.json é o único arquivo que fica de FORA do
    // cálculo das assinaturas — qualquer outro arquivo aqui derrubaria a publicação.
    if (avisos.length) { try { content.setOrigem(folder, Object.assign(content.getOrigem(folder) || {}, { avisos })); } catch (e) {} }

    concluirReserva(p.origem_id, folder);
    contabilizarEntrega();
    return { ok: true, peca: folder, formato: p.formato, cards: p.cards.length, avisos, resumo: p };
  } catch (e) {
    // Peça pela metade é pior que peça nenhuma: some da frente e libera o identificador.
    try { content.discardTask(folder); log("Desfiz a peça incompleta."); } catch (e2) {}
    throw e;
  }
}

// O squad avisa que desistiu de um post. O painel NÃO apaga nada: a peça pode já ter sido
// editada, agendada ou até publicada, e apagar por ordem de outro sistema seria destruir
// trabalho sem ninguém decidir. Fica a marca na peça e a linha no registro; quem descarta,
// se quiser, é quem opera.
function cancelar(origemId, motivo) {
  const content = require("./content");
  const entrada = entradaDeOrigem(origemId);
  const folder = entrada && entrada.folder;
  if (!folder || !content.findTask(folder)) {
    return { ok: false, motivo: "não encontrei nenhuma peça vinda deste post por aqui", peca: null };
  }
  const origem = content.getOrigem(folder) || {};
  origem.cancelado_em = new Date().toISOString();
  origem.cancelado_motivo = motivo || null;
  content.setOrigem(folder, origem);
  return { ok: true, peca: folder };
}

// Grava a arte a partir do HTML: escreve a receita e desenha o PNG a partir DELA (não da
// imagem que veio pronta) — assim o que se vê é exatamente o que o editor edita.
async function gravarDeHtml(render, content, folder, base, c, log, avisos, n, obrigatorio) {
  const loc = content.findTask(folder);
  if (!loc) return false;
  const dim = { w: c.largura || dimensoesDoHtml(c.html).w, h: c.altura || dimensoesDoHtml(c.html).h };
  const limpo = render.sanitizeArtHtml(c.html);
  const htmlAbs = path.join(loc.path, base + ".html");
  const pngAbs = path.join(loc.path, base + ".png");
  fs.mkdirSync(path.dirname(htmlAbs), { recursive: true });
  fs.writeFileSync(htmlAbs, limpo, "utf8");
  // strictNet: o HTML é de fora. Nada de buscar rede durante o desenho.
  const r = await render.htmlToPng(htmlAbs, pngAbs, dim.w, dim.h, 2, { strictNet: true });
  if (!r.ok) {
    try { fs.unlinkSync(htmlAbs); } catch (e) {}
    if (obrigatorio) {
      const e = new Error("a arte " + n + " veio só em HTML e não consegui desenhá-la: " + String(r.stderr || "").slice(0, 160));
      e.code = "E_RENDER_HTML"; throw e;
    }
    avisos.push("A arte " + n + " veio com HTML, mas não consegui desenhá-lo; usei a imagem pronta que veio junto.");
    log("Aviso: não desenhei o HTML da arte " + n + ".");
    return false;
  }
  log("Arte " + n + ": desenhei a partir do HTML (dá para editar o texto por dentro).");
  return true;
}

module.exports = {
  gerarToken, salvarToken, removerToken, estado, confere, marcarRequisicao, tokenDaRequisicao, clientIp,
  registrar, registrarRecusa, atualizar, guardarPayload, lerPayload, listar, obter, podar,
  normalizar, receber, cancelar, refsExternas, dimensoesDoHtml,
  entradaDeOrigem, reservar, concluirReserva, liberarReserva,
  EVENTOS, MAX_CARDS,
};
