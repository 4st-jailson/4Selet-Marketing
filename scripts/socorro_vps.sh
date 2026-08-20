#!/usr/bin/env bash
# socorro_vps.sh — o que rodar no INSTANTE em que a VPS voltar, antes de qualquer deploy.
#
# Existe porque em 20/08/2026 a maquina ficou inalcancavel e nao havia como responder a pergunta
# mais basica: por que? Nada media disco, memoria ou o que o kernel tinha matado. Este script
# pergunta tudo isso de uma vez, na ordem em que importa, e NAO ALTERA NADA.
set -uo pipefail
ALVO="${PANEL_SSH:-panelprod}"
REPO="/home/sysadmin/4selet-marketing"
remoto() { ssh -o BatchMode=yes -o ConnectTimeout=15 "$ALVO" "$@" 2>&1; }
t() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

remoto 'echo ok' >/dev/null 2>&1 || { echo "SSH ainda fora. Nada a fazer daqui."; exit 1; }

t "Ha quanto tempo esta de pe (se for pouco, ela REINICIOU)"
remoto 'uptime -p; echo "ligada desde: $(uptime -s)"'

t "O disco encheu?"
remoto 'df -h / /var/lib/docker 2>/dev/null | sed "s/^/  /"'
remoto 'docker system df 2>/dev/null | sed "s/^/  /"'

t "A memoria acabou? (o kernel matou alguem?)"
remoto 'free -h | sed "s/^/  /"'
remoto 'dmesg -T 2>/dev/null | grep -iE "out of memory|oom-kill|killed process" | tail -8 | sed "s/^/  /" || echo "  (sem dmesg legivel sem root)"'

t "A maquina caiu de forma suja?"
remoto 'last -x reboot shutdown 2>/dev/null | head -6 | sed "s/^/  /"'
remoto 'journalctl --list-boots 2>/dev/null | tail -4 | sed "s/^/  /" || true'

t "Os containers voltaram sozinhos?"
remoto 'docker ps -a --format "  {{.Names}}  {{.Status}}  ({{.Image}})"'

t "Em que commit o painel esta"
remoto "cd $REPO && git log --oneline -1 | sed 's/^/  /' && git status --short | head -5 | sed 's/^/  /'"

t "O painel responde?"
curl -s -o /dev/null -w "  https://mkt.4st.co/api/health -> HTTP %{http_code}\n" --max-time 20 https://mkt.4st.co/api/health

t "Ultimos erros do painel"
remoto "cd $REPO && docker compose -f docker-compose.prod.yml logs --tail 40 panel 2>&1 | tail -20 | sed 's/^/  /'"
