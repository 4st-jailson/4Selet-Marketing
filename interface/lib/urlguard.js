// lib/urlguard.js — porteiro do endereço que o painel vai abrir num navegador de verdade.
//
// Abrir uma URL que a pessoa digitou, dentro do servidor, é o pedido clássico de SSRF: o servidor
// enxerga coisas que a internet não enxerga. Numa máquina de nuvem, http://169.254.169.254/ devolve
// as credenciais da instância; http://127.0.0.1:4500/api/... é o próprio painel autenticado pela
// origem; http://10.0.0.x é a rede interna do cliente. Nada disso é acessível de fora, e tudo isso
// vira uma imagem PNG que a pessoa baixa.
//
// Por isso o endereço passa por três portas antes de o Chromium abrir:
//   1. FORMA      — só http/https, sem usuário:senha embutido, só nas portas 80/443.
//   2. DESTINO    — o nome é resolvido AQUI e cada IP devolvido é conferido contra as faixas
//                   privadas/reservadas. Um nome público que aponta para 127.0.0.1 morre aqui.
//   3. FIXAÇÃO    — o IP aprovado volta para quem chamou, e o navegador é obrigado a usar ESSE IP
//                   (--host-resolver-rules). Sem isso, o dono do domínio poderia devolver um IP
//                   público para a nossa checagem e um IP interno três segundos depois, quando o
//                   navegador resolvesse de novo (DNS rebinding) — a checagem viraria teatro.
"use strict";
const dns = require("dns").promises;
const net = require("net");

// Faixas IPv4 que NÃO podem ser alvo. Não é "lista de bloqueio de coisas suspeitas": é a lista
// fechada do que não é internet pública. Qualquer coisa fora daqui é um site como outro qualquer.
function ipv4Bloqueado(ip) {
  const p = ip.split(".").map((n) => parseInt(n, 10));
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return "endereço malformado";
  const [a, b] = p;
  if (a === 0) return "faixa reservada (0.0.0.0/8)";
  if (a === 10) return "rede privada (10.0.0.0/8)";
  if (a === 100 && b >= 64 && b <= 127) return "rede de operadora (100.64.0.0/10)";
  if (a === 127) return "a própria máquina (127.0.0.0/8)";
  if (a === 169 && b === 254) return "endereço de metadados da nuvem (169.254.0.0/16)";
  if (a === 172 && b >= 16 && b <= 31) return "rede privada (172.16.0.0/12)";
  if (a === 192 && b === 0) return "faixa reservada (192.0.0.0/16)";
  if (a === 192 && b === 168) return "rede privada (192.168.0.0/16)";
  if (a === 198 && (b === 18 || b === 19)) return "faixa de teste (198.18.0.0/15)";
  if (a === 198 && b === 51) return "faixa de documentação (198.51.100.0/24)";
  if (a === 203 && b === 0) return "faixa de documentação (203.0.113.0/24)";
  if (a >= 224) return "multicast ou reservado (224.0.0.0/4 e acima)";
  return null;
}

// IPv6: o caminho seguro é o inverso — em vez de listar o que bloquear, só o unicast global
// (2000::/3) é liberado. Tudo mais (loopback ::1, local único fc00::/7, link-local fe80::/10,
// e o resto do espaço não atribuído) fica de fora por não estar na lista.
function ipv6Bloqueado(ip) {
  const s = String(ip).toLowerCase();
  const mapeado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (mapeado) return ipv4Bloqueado(mapeado[1]); // IPv4 vestido de IPv6 — vale a regra do IPv4
  if (s === "::1") return "a própria máquina (::1)";
  if (s === "::") return "endereço indefinido (::)";
  const primeiro = parseInt(s.split(":")[0] || "0", 16);
  if (primeiro >= 0x2000 && primeiro <= 0x3fff) return null; // unicast global — liberado
  return "endereço IPv6 fora da internet pública";
}

function ipBloqueado(ip) {
  const v = net.isIP(ip);
  if (v === 4) return ipv4Bloqueado(ip);
  if (v === 6) return ipv6Bloqueado(ip);
  return "endereço irreconhecível";
}

// Nomes que nunca fazem sentido como alvo, checados antes de qualquer DNS.
function nomeBloqueado(host) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  if (!h) return "endereço vazio";
  if (h === "localhost" || h.endsWith(".localhost")) return "a própria máquina (localhost)";
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".home.arpa")) return "nome de rede interna";
  if (h === "metadata.google.internal") return "endereço de metadados da nuvem";
  return null;
}

// Aceita o que a pessoa realmente digita: "4selet.com.br", "www.site.com/pagina", com ou sem https.
function normaliza(bruto) {
  let s = String(bruto || "").trim();
  if (!s) return "";
  s = s.replace(/^[<(\[]+|[>)\]]+$/g, "");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  return s;
}

// A checagem completa. Devolve { ok, url, host, ip, motivo }.
// `motivo` é escrito para a pessoa ler na tela, não para o log.
async function verifica(bruto) {
  const texto = normaliza(bruto);
  if (!texto) return { ok: false, motivo: "Cole o endereço da página que você quer capturar." };

  let u;
  try { u = new URL(texto); } catch (e) {
    return { ok: false, motivo: "Esse endereço não parece válido. Exemplo do que funciona: valor.globo.com/empresas/noticia" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, motivo: "Só consigo abrir endereços que começam com http:// ou https://." };
  }
  if (u.username || u.password) {
    return { ok: false, motivo: "Não abro endereços com usuário e senha embutidos (o trecho antes do @)." };
  }
  const porta = u.port ? Number(u.port) : (u.protocol === "https:" ? 443 : 80);
  if (porta !== 80 && porta !== 443) {
    return { ok: false, motivo: "Só abro as portas padrão da web (80 e 443). A porta " + porta + " costuma ser de serviço interno." };
  }

  const host = u.hostname.replace(/^\[|\]$/g, "");
  const nomeRuim = nomeBloqueado(host);
  if (nomeRuim) return { ok: false, motivo: "Esse endereço aponta para " + nomeRuim + " — não é uma página pública." };

  // IP digitado direto: não há o que resolver, confere e pronto.
  if (net.isIP(host)) {
    const ruim = ipBloqueado(host);
    if (ruim) return { ok: false, motivo: "Esse endereço aponta para " + ruim + " — não é uma página pública." };
    return { ok: true, url: u.href, host, ip: host };
  }

  let enderecos = [];
  try {
    enderecos = await dns.lookup(host, { all: true, verbatim: true });
  } catch (e) {
    return { ok: false, motivo: "Não encontrei o site \"" + host + "\". Confira se o endereço está escrito certo." };
  }
  if (!enderecos.length) return { ok: false, motivo: "Não encontrei o site \"" + host + "\"." };

  // TODOS os IPs precisam ser públicos. Basta um interno na lista para o navegador poder cair nele.
  for (const e of enderecos) {
    const ruim = ipBloqueado(e.address);
    if (ruim) return { ok: false, motivo: "Esse endereço aponta para " + ruim + " — não é uma página pública." };
  }
  return { ok: true, url: u.href, host, ip: enderecos[0].address };
}

// Versão síncrona e sem DNS, para o filtro de requisições DENTRO do navegador: a página capturada
// pode pedir sub-recursos (imagens, scripts) de onde quiser, inclusive de um IP interno escrito na
// mão. Aqui só o que é IP literal é julgado — nome de CDN passa, senão a página sai quebrada.
function pedidoPermitido(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch (e) { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:" && u.protocol !== "data:" && u.protocol !== "blob:") return false;
  if (u.protocol === "data:" || u.protocol === "blob:") return true;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (nomeBloqueado(host)) return false;
  if (net.isIP(host) && ipBloqueado(host)) return false;
  return true;
}

module.exports = { verifica, normaliza, pedidoPermitido, ipBloqueado, nomeBloqueado };
