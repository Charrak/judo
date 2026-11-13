# In Betrieb nehmen (Oracle Cloud / eigener Server)

Diese Anleitung beschreibt den Weg von „leere Cloud" zur laufenden Website mit
Verwaltung unter `/admin/`. Alles ist ohne Container und ohne Fremdbibliotheken
umsetzbar: ein Node-Prozess, ein Reverse Proxy, ein Zertifikat.

**Zielbild**

```
Internet ──▶ nginx :80/:443 (Let's Encrypt) ──▶ node server.mjs :3000 (nur lokal)
```

---

## 1. Netzwerk in Oracle Cloud (VCN)

Beim Assistenten *Create a Virtual Cloud Network*:

| Feld | Wert | Hinweis |
| --- | --- | --- |
| **Name** | `atai-judo-vcn` | frei wählbar |
| **Create in Compartment** | dein Compartment | z. B. „(root)" |
| **IPv4 CIDR Blocks** | `10.0.0.0/16` | Standard; wenn rot markiert: `10.1.0.0/16` |
| **IPv6 Prefixes** | aus | wird nicht gebraucht |
| **Use DNS hostnames in this VCN** | ✔ an | Beschriftung max. **15 Zeichen**, Buchstaben/Ziffern/Bindestrich, muss mit einem Buchstaben beginnen |
| **DNS Label** | `ataijudo` | der automatisch eingesetzte Zeitstempel (z. B. `vcn20261113135000`) ist zu lang und wird rot markiert |

Im selben Assistenten weiter:

- **Public subnet** anlegen lassen (CIDR `10.0.1.0/24`), „Use DNS hostnames" an.
- **Internet Gateway** wird dabei mit erzeugt; falls nicht: Internet Gateway anlegen
  und in der Route Table `0.0.0.0/0 → Internet Gateway` eintragen.

**Security List (Ingress) – nur diese drei Regeln öffnen:**

| Quelle | Protokoll | Port | Zweck |
| --- | --- | --- | --- |
| deine IP /32 | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 80 | Zertifikatsprüfung + Weiterleitung auf HTTPS |
| `0.0.0.0/0` | TCP | 443 | Website |

Egress: `0.0.0.0/0`, alle Protokolle (Standard).

> Port 3000 **nicht** öffnen – der Node-Server läuft nur lokal hinter nginx.

Läuft die Konsole optisch kaputt (unformatierte Formulare), hilft ein Reload ohne
Werbeblocker; das ist ein Darstellungsproblem der Konsole, kein Fehler deiner Eingabe.

## 2. Instanz anlegen

- **Image:** Ubuntu 24.04 (oder 22.04)
- **Shape:** `VM.Standard.A1.Flex` (1 OCPU / 6 GB, Free Tier) oder `VM.Standard.E2.1.Micro`
- **Public IPv4:** zuweisen
- **SSH-Key:** eigenen öffentlichen Schlüssel hinterlegen

Danach im DNS deiner Domain zwei A-Records auf die öffentliche IP setzen:
`atai-judo-academy.com` und `www.atai-judo-academy.com`.

## 3. Server einrichten

```bash
ssh ubuntu@<öffentliche-ip>

# Node 22, nginx, git, certbot
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git certbot python3-certbot-nginx

# eigener Benutzer für die Anwendung
sudo useradd --system --create-home --shell /usr/sbin/nologin atai
sudo mkdir -p /srv/atai-judo
sudo chown atai:atai /srv/atai-judo

# Code holen
sudo -u atai git clone https://github.com/Charrak/judo.git /srv/atai-judo
cd /srv/atai-judo
sudo -u atai npm run build
```

Konfiguration für den Dienst und den Proxy liegen im Ordner `deploy/`:

```bash
sudo cp deploy/atai-judo.service /etc/systemd/system/
sudo cp deploy/nginx-atai-judo.conf /etc/nginx/sites-available/atai-judo
sudo ln -s /etc/nginx/sites-available/atai-judo /etc/nginx/sites-enabled/atai-judo
sudo rm -f /etc/nginx/sites-enabled/default

sudo systemctl daemon-reload
sudo systemctl enable --now atai-judo
sudo nginx -t && sudo systemctl reload nginx
```

### Zertifikat

```bash
sudo certbot --nginx -d atai-judo-academy.com -d www.atai-judo-academy.com
```

Certbot trägt die Zertifikate ein und erneuert sie automatisch (`systemctl list-timers | grep certbot`).

### Admin-Zugang

Beim ersten Start ohne `data/admin.json` gibt der Server einen **Einrichtungscode** aus:

```bash
sudo journalctl -u atai-judo -n 30
```

Damit `https://www.atai-judo-academy.com/admin/` öffnen, Code eingeben, Passwort setzen.

## 4. Betrieb

| Aufgabe | Befehl |
| --- | --- |
| Status | `sudo systemctl status atai-judo` |
| Log | `sudo journalctl -u atai-judo -f` |
| Neustart | `sudo systemctl restart atai-judo` |
| Update | `cd /srv/atai-judo && sudo -u atai git pull && sudo -u atai npm run build && sudo systemctl restart atai-judo` |
| Tests | `cd /srv/atai-judo && sudo -u atai npm test` |

**Sicherung:** `content/` (Texte, Beiträge, Galerie, Uploads) und `data/` (Passwort-Hash,
Sitzungen, Kontaktanfragen) sind die einzigen veränderlichen Daten.

```bash
sudo tar czf /root/atai-$(date +%F).tar.gz -C /srv/atai-judo content data
```

Diese Datei regelmäßig kopieren (z. B. per Cron auf ein zweites Volume).

## 5. Was nach dem Aufsetzen noch zu tun ist

1. `siteUrl` in `src/config/languages.json` auf die echte Domain setzen, danach neu bauen.
2. Inhalte aus dem Abschnitt „Offene Punkte vor dem Livegang" im README ersetzen
   (Logo, Trainingszeiten, Bilder, Rechtstexte).
3. Prüfen: `https://…/de/`, Sprachwechsel, Kontaktformular, `/admin/`, `/sitemap.xml`, `/robots.txt`.

## Variante ohne Server

Nur statische Auslieferung (kein Formular, keine Verwaltung): `npm run build` und den
Inhalt von `dist/` bei einem Static-Host ablegen. Das Kontaktformular braucht dann ein
eigenes Backend; die Verwaltung funktioniert dort nicht.
