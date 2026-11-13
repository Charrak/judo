# Inhalte (vom Admin-Bereich verwaltet)

Dieser Ordner enthält alles, was über `/admin/` bearbeitet wird. Er gehört ins
Repository, damit Änderungen bei einem Deployment erhalten bleiben.

| Datei / Ordner | Inhalt |
| --- | --- |
| `texts/de.json`, `texts/en.json`, … | geänderte Texte je Sprache (nur Abweichungen von `src/i18n/`) |
| `news.json` | Beiträge für die Seite „Neuigkeiten/Aktuelles“ (alle Sprachen in einer Datei) |
| `gallery.json` | Reihenfolge und Beschriftungen der Galerie-Bilder |
| `uploads/` | hochgeladene Bilder (werden nach `/assets/uploads/` gebaut) |

Fehlt eine Datei, gelten die Standardwerte aus `src/i18n/` und `src/config/site.json`.
