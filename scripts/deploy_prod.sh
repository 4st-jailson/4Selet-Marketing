#!/usr/bin/env bash
# deploy_prod.sh — publica o painel na VPS, com as duas coisas que faltavam no jeito manual:
# CONFERIR O DISCO ANTES e LIMPAR AS IMAGENS DEPOIS.
#
# Por que existe: em 20/08/2026 foram 11 deploys num dia, todos com `docker compose up --build`
# digitado a mao. Cada build refaz a camada do `npx remotion browser ensure` (~150 MB) e deixa a
# imagem anterior ORFA — o Docker nao limpa sozinho. Onze builds sem poda somam alguns GB de lixo
# num disco que ninguem estava olhando. No fim do dia a VPS ficou inalcancavel (o roteador do
# provedor respondendo "host unreachable"), e nao houve como saber se o disco tinha enchido,
# porque nada media isso. Este script mede.
#
# Uso, a partir da RAIZ do projeto local:
#   bash scripts/deploy_prod.sh            # pull + build + poda + conferencia
#   bash scripts/deploy_prod.sh --so-checar # so mostra o estado da maquina, nao mexe em nada
set -uo pipefail

ALVO="${PANEL_SSH:-panelprod}"
REPO="/home/sysadmin/4selet-marketing"
CHAVE_GIT="ssh -i ~/.ssh/id_github_deploy"
MIN_LIVRE_GB=3          # abaixo disso o build NAO comeca: sem espaco ele falha no meio e derruba o que esta no ar
SAUDE="https://mkt.4st.co/api/health"

remoto() { ssh -o BatchMode=yes -o ConnectTimeout=15 "$ALVO" "$@"; }
titulo() { printf '\n\033[1m%s\033[0m\n' "$1"; }

titulo "1. A maquina esta viva?"
if ! remoto 'echo ok' >/dev/null 2>&1; then
  echo "  O SSH nao respondeu em $ALVO."
  echo "  Se o ping devolver 'host unreachable' vindo do ROTEADOR do provedor, a VPS esta"
  echo "  desligada ou travada — nao ha o que fazer daqui: reinicie pelo painel do provedor."
  exit 1
fi
echo "  ok"

titulo "2. Espaco em disco (o build precisa de folga)"
DISCO=$(remoto "df -BG --output=avail,pcent / | tail -1")
LIVRE=$(echo "$DISCO" | awk '{gsub(/G/,"",$1); print $1}')
USADO=$(echo "$DISCO" | awk '{print $2}')
echo "  livre: ${LIVRE}G   ocupado: ${USADO}"
remoto "docker system df 2>/dev/null | sed 's/^/  /'"
if [ "${LIVRE:-0}" -lt "$MIN_LIVRE_GB" ]; then
  echo
  echo "  PAROU AQUI: menos de ${MIN_LIVRE_GB}G livres."
  echo "  Um build que enche o disco falha no meio e pode derrubar o que ja esta no ar."
  echo "  Libere espaco primeiro:  ssh $ALVO 'docker image prune -af && docker builder prune -af'"
  exit 2
fi

if [ "${1:-}" = "--so-checar" ]; then
  titulo "Modo so-checar: nada foi alterado."
  remoto "cd $REPO && git log --oneline -1"
  exit 0
fi

titulo "3. Trazendo o codigo"
remoto "cd $REPO && GIT_SSH_COMMAND='$CHAVE_GIT' git pull --ff-only" || { echo "  o pull falhou"; exit 3; }
ANTES=$(remoto "cd $REPO && git log --oneline -1")
echo "  agora em: $ANTES"

titulo "4. Construindo e subindo"
remoto "cd $REPO && docker compose -f docker-compose.prod.yml up -d --build panel" || { echo "  o build falhou"; exit 4; }

titulo "5. Limpando o que o build deixou para tras"
# Isto e o que faltava. `image prune -f` tira SO as imagens orfas (as que perderam a etiqueta
# quando a nova assumiu o nome) — nunca a que esta rodando. `builder prune` tira o cache de
# camadas intermediarias, que cresce a cada build e nao serve para mais nada depois.
remoto "docker image prune -f 2>&1 | tail -2 | sed 's/^/  /'"
remoto "docker builder prune -f 2>&1 | tail -2 | sed 's/^/  /'"
remoto "df -BG --output=avail /  | tail -1 | sed 's/^/  livre agora: /'"

titulo "6. Conferindo que voltou"
sleep 6
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SAUDE")
echo "  $SAUDE responde HTTP $CODIGO"
remoto "docker ps --format '  {{.Names}}  {{.Status}}'"
[ "$CODIGO" = "200" ] || { echo "  A saude nao respondeu 200 — veja: ssh $ALVO 'docker compose -f $REPO/docker-compose.prod.yml logs --tail 60 panel'"; exit 5; }

titulo "Publicado."
