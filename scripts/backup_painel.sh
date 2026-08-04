#!/usr/bin/env bash
# backup_painel.sh — cópia diária do que o painel guarda em produção.
#
# O que entra (e por quê):
#   - volume panel_uploads .... acervo de fotos enviadas. É CÓPIA ÚNICA: se o volume some,
#                               some o acervo e as peças que usam essas fotos quebram.
#   - volume panel_outputs .... peças em rascunho/revisão (o trabalho em andamento). O que já
#                               foi aprovado vive em outputs/approved, que é versionado em git.
#   - interface/data .......... usuários, segredo de sessão e credenciais de integração.
#   - campaigns/ e collections/ organização das peças (não versionada).
#
# Onde salva: /home/sysadmin/backups/painel/AAAA-MM-DD_HHMM/ (mantém os últimos N dias).
# O conteúdo tem SEGREDOS (hashes de senha, token do Instagram, chaves) — por isso a pasta
# nasce 0700 e os arquivos 0600.
#
# Uso: ./backup_painel.sh            (roda o backup)
#      ./backup_painel.sh --listar   (mostra o que já existe)
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="${BACKUP_DIR:-/home/sysadmin/backups/painel}"
MANTER="${BACKUP_MANTER:-14}"          # quantas cópias guardar
PROJETO="${COMPOSE_PROJECT:-4selet-marketing}"
CARIMBO="$(date +%Y-%m-%d_%H%M)"
PASTA="$DESTINO/$CARIMBO"

if [ "${1:-}" = "--listar" ]; then
  echo "Backups em $DESTINO:"
  ls -1t "$DESTINO" 2>/dev/null | head -20 | while read -r d; do
    echo "  $d  ($(du -sh "$DESTINO/$d" 2>/dev/null | cut -f1))"
  done
  exit 0
fi

mkdir -p "$PASTA"
chmod 700 "$DESTINO" "$PASTA"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# Volumes do Docker: empacotados de dentro de um contêiner descartável — assim não precisa de
# sudo nem depender do caminho interno do Docker.
salvar_volume() {
  local vol="$1" saida="$2"
  if ! docker volume inspect "$vol" >/dev/null 2>&1; then
    log "volume $vol não existe — pulando"
    return 0
  fi
  docker run --rm \
    -v "$vol":/origem:ro \
    -v "$PASTA":/destino \
    alpine:3 \
    sh -c "tar -czf /destino/$saida -C /origem . 2>/dev/null || true"
  log "$saida  ($(du -h "$PASTA/$saida" 2>/dev/null | cut -f1))"
}

log "backup para $PASTA"
salvar_volume "${PROJETO}_panel_uploads" "uploads.tar.gz"
salvar_volume "${PROJETO}_panel_outputs" "outputs.tar.gz"

# Dados no disco do host (bind mounts / pastas do repo)
tar -czf "$PASTA/data.tar.gz" -C "$RAIZ/interface" data 2>/dev/null || log "interface/data não encontrado"
tar -czf "$PASTA/organizacao.tar.gz" -C "$RAIZ" campaigns collections 2>/dev/null || log "campaigns/collections não encontrados"
log "data.tar.gz + organizacao.tar.gz"

chmod 600 "$PASTA"/*.tar.gz 2>/dev/null || true

# Um resumo legível junto do backup, para saber o que tem ali sem descompactar.
{
  echo "Backup do painel 4Selet"
  echo "data: $(date '+%d/%m/%Y %H:%M')"
  echo "commit em produção: $(cd "$RAIZ" && git log --oneline -1 2>/dev/null || echo '?')"
  echo
  echo "conteúdo:"
  ls -lh "$PASTA"/*.tar.gz 2>/dev/null | awk '{print "  "$9"  "$5}'
} > "$PASTA/LEIA-ME.txt"

# Rotação: mantém as N cópias mais recentes.
cd "$DESTINO"
total=$(ls -1d */ 2>/dev/null | wc -l)
if [ "$total" -gt "$MANTER" ]; then
  ls -1dt */ | tail -n +"$((MANTER + 1))" | while read -r velho; do
    rm -rf "$velho"
    log "removido backup antigo: $velho"
  done
fi

log "pronto — $(du -sh "$PASTA" | cut -f1) em $PASTA"
