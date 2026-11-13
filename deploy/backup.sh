#!/usr/bin/env bash
# Sichert Inhalte und Laufzeitdaten der Website.
#
#   atai-backup            → /var/backups/atai/atai-JJJJ-MM-TT-HHMM.tar.gz
#
# Gesichert werden nur die veränderlichen Daten: content/ (Texte, News, Galerie,
# Uploads) und data/ (Passwort-Hash, Nachrichten). Der Code liegt in Git und
# braucht keine Sicherung.
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/atai-judo}"
DEST="${DEST:-/var/backups/atai}"
KEEP="${KEEP:-14}"

mkdir -p "$DEST"
STAMP="$(date +%F-%H%M%S)"
FILE="$DEST/atai-$STAMP.tar.gz"

tar czf "$FILE" -C "$APP_DIR" content data

# alte Sicherungen aufräumen: nur die letzten $KEEP behalten
if command -v ls >/dev/null; then
  mapfile -t old < <(ls -1t "$DEST"/atai-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)))
  for f in "${old[@]:-}"; do
    [[ -n "$f" ]] && rm -f "$f"
  done
fi

printf '%s  %s  (%s)\n' "$(date '+%F %T')" "$FILE" "$(du -h "$FILE" | cut -f1)"
