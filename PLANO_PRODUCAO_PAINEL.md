# Plano de Produção — Painel 4Selet (sob medida)

> Objetivo: colocar o **painel de marketing** (`interface/`) em produção, acessível
> numa **URL com HTTPS e login**, rodando no servidor **Linux `srv-homoclaudecode`
> (143.14.247.63, IP público)** em containers Docker.
>
> Específico do painel — **não** usa o `blueprint-dev.md` (DEV/homolog, stack
> NestJS + Vite + Postgres + Redis). O painel é Express + SPA em JS puro +
> Playwright/Remotion + persistência em arquivos, **sem banco**. Reaproveitamos a
> filosofia (Docker + Linux + proxy com TLS), não a receita.

## 0. Decisões já tomadas
- **Borda:** **Caddy** (proxy reverso) na própria máquina, exposto no **IP público**, com **HTTPS automático** (Let's Encrypt) e **login (`basic_auth`)**. *(Cloudflare Tunnel descartado a seu pedido — o IP é público.)*
- **Host de produção:** servidor Linux `143.14.247.63` (Ubuntu 24.04 + Docker 29.5.3).
- **Domínio:** você tem domínio próprio. Subdomínio proposto: `mkt.4st.co`.

## Regra de ouro (não muda)
O painel **não tem login próprio**. Como agora ele fica num **IP público**, o Caddy
**obrigatoriamente** aplica autenticação (`basic_auth`) na frente. Sem isso,
qualquer um na internet usaria o painel e **queimaria seus créditos da Anthropic**.

---

## 1. Arquitetura de produção

```
Internet ── HTTPS (443) ──> [ Caddy no servidor · IP público ]
                              ├─ TLS automático (Let's Encrypt)
                              ├─ login (basic_auth)
                              └─ reverse_proxy ──(rede interna do compose)──┐
                                                                            │
┌──────────────── SERVIDOR 143.14.247.63 (Docker) ──────────────────────────┼──┐
│  container: caddy  (publica 80/443)  ────────────>  container: panel           │
│                                                     Express :4500 (NAO publicado)│
│                                                     Playwright + Remotion         │
│                                                     volume: outputs/              │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Só o **Caddy** publica portas ao host (**80/443**). O container do **painel não
  publica porta** — é alcançável apenas pelo Caddy, pela rede interna do compose.
- Portas **80 e 443 precisam estar abertas no firewall**; a porta 80 é necessária
  para a emissão automática do certificado (desafio ACME), depois o Caddy redireciona
  80 → 443.

---

## 2. Artefatos (a criar no repositório)

### 2.1 `Dockerfile` (raiz do repo)
```dockerfile
# Base do Playwright: ja traz Chromium + libs de sistema + fontes
FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app

# deps da raiz (Playwright, Remotion, React) e do painel (Express)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY interface/package*.json ./interface/
RUN cd interface && npm install --omit=dev --no-audit --no-fund

# codigo do projeto
COPY . .

# Remotion: garantir o Chrome Headless Shell para render de video
RUN npx remotion browser ensure || echo "validar Remotion no runtime"

ENV NODE_ENV=production HOST=0.0.0.0 PORT=4500
WORKDIR /app/interface
EXPOSE 4500
CMD ["node", "server.js"]
```

### 2.2 `docker-compose.prod.yml` (raiz do repo)
```yaml
services:
  panel:
    build: { context: ., dockerfile: Dockerfile }
    environment:
      NODE_ENV: production
      HOST: "0.0.0.0"      # so na rede do compose; porta NAO publicada ao host
      PORT: "4500"
    volumes:
      - ./interface/.env:/app/interface/.env:ro   # chave Anthropic (fora do git)
      - panel_outputs:/app/outputs                # conteudo aprovado/persistente
    restart: unless-stopped
    # sem 'ports:' -> so o Caddy alcança

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data          # guarda os certificados (persistente!)
      - caddy_config:/config
    restart: unless-stopped
    depends_on: [ panel ]

volumes:
  panel_outputs:
  caddy_data:
  caddy_config:
```

### 2.3 `Caddyfile` (raiz do repo)
```
mkt.4st.co {
    encode gzip
    basic_auth {
        # usuario "equipe" + hash bcrypt gerado com: caddy hash-password
        equipe <COLE_AQUI_O_HASH_BCRYPT>
    }
    reverse_proxy panel:4500
}
```
> Em Caddy antigo (< 2.8) a diretiva chama `basicauth` (sem underscore). O
> `caddy:2-alpine` atual usa `basic_auth`.

### 2.4 `.dockerignore` (raiz do repo)
```
node_modules
interface/node_modules
outputs
.git
*.log
```

---

## 3. Segredos e dados persistentes
| Item | Onde fica | Regra |
|---|---|---|
| Chave Anthropic (`ANTHROPIC_API_KEY`) | `interface/.env` no servidor (bind-mount `:ro`) | **Fora do git.** Você fornece o valor; eu não manuseio a chave crua. |
| Senha de acesso (login do painel) | **hash bcrypt** no `Caddyfile` | Você gera o hash (`caddy hash-password`); só o **hash** entra no arquivo, nunca a senha em texto. |
| `outputs/` (conteúdo aprovado) | volume `panel_outputs` | Persistente entre redeploys. `outputs/approved/` também está no git. |
| Certificados TLS | volume `caddy_data` | Persistente — evita re-emitir cert a cada redeploy (limites do Let's Encrypt). |

---

## 4. Borda: Caddy no IP público
Pré-passos (**você**):
1. **DNS:** criar um registro **A** de `mkt.4st.co` → **IP público do `.63`**, no seu provedor de DNS. Aguardar propagar.
2. **Firewall:** abrir as portas **80** e **443**. *(Isto é mudança de configuração de segurança — te passo o comando exato, mas quem roda/aprova é você, no servidor ou no painel do provedor.)*
   - No servidor (se usar `ufw`): `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`
3. **Senha de login:** gerar o hash com `docker run --rm caddy:2-alpine caddy hash-password` (ele pergunta a senha e devolve um hash `$2a$...`). Me passe **o hash** (não a senha).

Com isso, o Caddy sobe, o Let's Encrypt emite o certificado (precisa DNS propagado + 80/443 abertos) e o painel fica em `https://mkt.4st.co` atrás de login.

---

## 5. Runbook de deploy

**Legenda:** [EU] = eu, via SSH no servidor · [VOCÊ] = você (GitHub / DNS / firewall).

**Fase A — código no servidor**
1. [EU] gerar um **deploy key** (chave SSH) no `.63`.
2. [VOCÊ] adicionar essa pública como **Deploy Key (read-only)** no repositório `4st-jailson/4Selet-Marketing`.
3. [EU] `git clone` em `/home/sysadmin/painel-4selet`.

**Fase B — segredos**
4. [VOCÊ] fornecer o valor da chave Anthropic → gravar em `interface/.env` (você cola o valor).
5. [VOCÊ] gerar o **hash de senha** (seção 4.3) e me passar o hash.

**Fase C — arquivos + build**
6. [EU] criar `Dockerfile`, `docker-compose.prod.yml`, `Caddyfile`, `.dockerignore`.
7. [EU] `docker compose -f docker-compose.prod.yml up -d --build`.
8. [EU] verificar painel e caddy saudáveis (`docker compose logs -f`).

**Fase D — DNS + firewall + TLS**
9. [VOCÊ] criar o registro DNS A e abrir 80/443 (seção 4.1 e 4.2).
10. [EU] confirmar emissão do certificado e o site respondendo em HTTPS.

**Fase E — validação**
11. Abrir `https://mkt.4st.co` → pedir **login** → após autenticar, o painel.
12. [EU] testar gerar 1 peça (IA real — créditos ativos), render de ad (Playwright) e de vídeo (Remotion — validar).

---

## 6. Confiabilidade
- `restart: unless-stopped` + `docker` habilitado no boot → **sobe sozinho após reboot** (resolve a lacuna de auto-start que havia na VPS Windows).
- Volume `caddy_data` preserva os certificados entre redeploys (evita bater no limite de emissão do Let's Encrypt).
- Backup: snapshot periódico do volume `panel_outputs`; `outputs/approved/` também no git.

---

## 7. Pré-requisitos / decisões que faltam de você
1. Subdomínio **`mkt.4st.co`** ok?
2. **Deploy key** no GitHub: ok eu gerar e você adicionar (read-only)?
3. **Registro DNS A** `painel` → IP público do `.63`: você cria?
4. **Firewall** 80/443: você abre (comando na seção 4.2)?
5. **Senha de login** (hash via `caddy hash-password`): você gera e me passa o hash?
6. Você **fornece o valor da chave Anthropic** para o `.env`?
7. Caminho **`/home/sysadmin/painel-4selet`** ok?

---

## 8. Segurança ao expor o IP direto (o que ganhamos/perdemos vs Tunnel)
Expor pelo IP público é válido, mas o IP fica visível e as portas abertas viram
superfície de ataque. Recomendações mínimas:
- **`basic_auth` sempre ligado** (feito no Caddyfile) — a trava principal do painel.
- Manter **só 80/443 + SSH** abertos; **bancos/serviços nunca expostos**.
- **`fail2ban`** + atualizações de SO/Docker automáticas; SSH só por chave (já é o caso).
- Senha de login **forte**; trocar se vazar (re-gerar o hash).
- (Opcional) restringir o SSH e o painel a IPs conhecidos, se a equipe tiver IP fixo.

> Comparado ao Cloudflare Tunnel + Access: aqui o login é **uma senha compartilhada**
> (não SSO por pessoa) e o IP/portas ficam expostos. É mais simples e sem dependência
> externa — aceitável com as recomendações acima. Se um dia quiser **login por
> pessoa** e **IP oculto**, dá para trocar a borda para Cloudflare (ou pôr um Authelia
> na frente) sem mexer no painel.
