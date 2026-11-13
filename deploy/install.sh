#!/usr/bin/env bash
# Richtet die ATAI-Website auf einem frischen Ubuntu-Server ein.
#
#   sudo bash install.sh atai-judo-academy.com
#
# Das Skript holt den Code aus GitHub, baut die Seite, legt den Dienst an,
# konfiguriert nginx und startet beides. Es ist wiederholbar: bei erneutem
# Aufruf wird aktualisiert statt neu angelegt.
set -euo pipefail

DOMAIN="${1:-}"
REPO="${REPO:-https://github.com/Charrak/judo.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="/srv/atai-judo"
APP_USER="atai"

log() { printf '\n\033[1;33m› %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Bitte mit sudo starten: sudo bash install.sh <domain>"
[[ -n "$DOMAIN" ]] || die "Domain fehlt. Beispiel: sudo bash install.sh atai-judo-academy.com"
command -v apt-get >/dev/null || die "Dieses Skript ist für Ubuntu/Debian gedacht (apt fehlt)."

if ! grep -qi ubuntu /etc/os-release; then
  log "Hinweis: kein Ubuntu erkannt – die Paketnamen könnten abweichen."
fi

log "Pakete installieren (Node 22, nginx, git, certbot)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git nginx >/dev/null
if ! command -v node >/dev/null || [[ $(node -v | sed 's/v\([0-9]*\).*/\1/') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
log "Node $(node -v), nginx $(nginx -v 2>&1 | cut -d/ -f2)"

log "Benutzer und Verzeichnis"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"

# Git im Projektverzeichnis immer als Dienstbenutzer ausführen: als root würde
# git sonst mit "detected dubious ownership" abbrechen.
git_app() { sudo -u "$APP_USER" git -C "$APP_DIR" "$@"; }

if [[ -d "$APP_DIR/.git" ]]; then
  log "Vorhandene Installation aktualisieren"
  git_app fetch --quiet origin "$BRANCH"
  git_app reset --hard --quiet "origin/$BRANCH"
else
  log "Code holen nach $APP_DIR"
  mkdir -p "$APP_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi
mkdir -p "$APP_DIR/data" "$APP_DIR/content"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

log "Seite bauen"
sudo -u "$APP_USER" npm --prefix "$APP_DIR" run build --silent

log "Dienst einrichten"
sed "s#/srv/atai-judo#$APP_DIR#g" "$APP_DIR/deploy/atai-judo.service" > /etc/systemd/system/atai-judo.service
systemctl daemon-reload
systemctl enable --now atai-judo >/dev/null
systemctl restart atai-judo

log "nginx konfigurieren für $DOMAIN"
sed -e "s#atai-judo-academy\.com#$DOMAIN#g" \
    -e "s#/srv/atai-judo#$APP_DIR#g" \
    "$APP_DIR/deploy/nginx-atai-judo.conf" > /etc/nginx/sites-available/atai-judo
ln -sf /etc/nginx/sites-available/atai-judo /etc/nginx/sites-enabled/atai-judo
rm -f /etc/nginx/sites-enabled/default

# Erst testen, dann übernehmen – bei einem Fehler bleibt der Server erreichbar.
if ! nginx -t; then
  rm -f /etc/nginx/sites-enabled/atai-judo
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  die "nginx-Konfiguration fehlerhaft (siehe Ausgabe oben). Die alte Konfiguration bleibt aktiv."
fi
systemctl reload nginx

log "Warten, bis der Dienst antwortet"
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/de/ >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3000/de/ >/dev/null || die "Der Dienst antwortet nicht. Log: journalctl -u atai-judo -n 40"

cat <<INFO

$(printf '\033[1;32m✓ Fertig.\033[0m')

Nächste Schritte:

1. DNS: A-Records für $DOMAIN und www.$DOMAIN auf die öffentliche IP dieses Servers.
   Prüfen:   dig +short $DOMAIN
2. Zertifikat, sobald DNS auf diesen Server zeigt (die Seite läuft bis dahin über HTTP):
   certbot --nginx -d $DOMAIN -d www.$DOMAIN
   Certbot erweitert die nginx-Konfiguration um HTTPS und die Weiterleitung.
   Prüfen danach:  curl -I https://www.$DOMAIN/de/
3. Admin-Zugang einrichten (Code aus dem Log):
   journalctl -u atai-judo -n 30 | grep -i setup
   Danach https://www.$DOMAIN/admin/ öffnen.
4. siteUrl in $APP_DIR/src/config/languages.json prüfen und danach neu bauen:
   sudo -u $APP_USER npm --prefix $APP_DIR run build && systemctl restart atai-judo

Betrieb:
   systemctl status atai-judo
   journalctl -u atai-judo -f
   Sicherung: tar czf /root/atai-\$(date +%F).tar.gz -C $APP_DIR content data
INFO
