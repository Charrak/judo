# ATAI JUDO ACADEMY — Website

Mehrsprachige Website der ATAI JUDO ACADEMY (Abu Dhabi) in **Deutsch, Englisch, Arabisch, Französisch und Spanisch**.

Die deutsche Fassung ist die maßgebliche Originalversion. Alle Inhalte liegen zentral in Übersetzungsdateien; im Quellcode der Templates steht kein einziger Satz.

---

## Schnellstart

```bash
npm run build      # erzeugt dist/ (41 HTML-Seiten, Sitemap, robots.txt)
npm start          # baut und startet den Server auf http://localhost:3000
npm run check:i18n # prüft, ob alle fünf Sprachdateien vollständig und synchron sind
```

Es gibt **keine Laufzeit-Abhängigkeiten** – nur Node.js ≥ 20. Kein Framework, kein Build-Tool außer dem eigenen Generator.

| Befehl | Zweck |
| --- | --- |
| `npm run build` | Statische Ausgabe nach `dist/` |
| `npm start` / `npm run dev` | Build + Server (Port über `PORT` änderbar) |
| `npm run serve` | nur Server (setzt einen vorhandenen Build voraus) |
| `npm run check:i18n` | Übersetzungsprüfung (Keys, Typen, deutsche Resttexte) |

---

## Projektstruktur

```
src/
  config/
    languages.json        Sprachen, Verzeichnisse, Slugs, og:locale, siteUrl
    site.json             Stammdaten: Kontakt, Trainingsplan, Bildliste, Galerie
  i18n/
    de.json               deutsche Originaltexte (Referenz)
    en.json  ar.json  fr.json  es.json
  lib/
    i18n.mjs              Translator, Key-Abgleich, URL-Helfer, Leftover-Suche
    html.mjs              esc/attrs/icon-Helfer
  templates/
    layout.mjs            <head>, SEO, hreflang, Sprach-Persistenz, Root-Seite
    components.mjs        Header, Footer, Sprachmenü, Sections, Formular, Overlay
    pages/*.mjs           home, about, training, team, gallery, contact, legal, not-found
  assets/
    styles.css            Design-System (logische CSS-Eigenschaften, RTL-fähig)
    app.js                Sprachwahl, Menü, Galerie-Lightbox, Formular
    logo.svg favicon.svg  Marke
    img/ flags/ fonts/    Fotografien, Flaggen, selbst gehostete Schriften
scripts/
  build.mjs               Generator
  check-i18n.mjs          Übersetzungs-Check
server.mjs                Static-Server + POST /api/contact
dist/                     Build-Ausgabe (nicht versioniert)
data/                     Kontaktanfragen (nicht versioniert)
```

---

## Mehrsprachigkeit

### Übersetzungsdateien

Eine Datei pro Sprache unter `src/i18n/`. Alle Dateien haben **dieselbe Struktur**:

```
meta / nav / actions / ui / welcome / values / programs / schedule / footer / form / pages / notFound
```

- `pages.<route>.meta.title` und `.meta.description` → sprachabhängige SEO-Texte
- `pages.<route>.*` → alle Inhalte der jeweiligen Unterseite
- `values`, `programs`, `schedule` werden von mehreren Seiten geteilt (keine Duplikate)
- `form.errors.*` → sprachabhängige Validierungs- und Bestätigungsmeldungen

**Deutsch ändern:** Text in `de.json` anpassen, dann denselben Key in den vier anderen Dateien aktualisieren. Der Key bleibt stabil, damit Übersetzungen gezielt nachgezogen werden können.

**Prüfen:** `npm run check:i18n` schlägt fehl bei

- fehlenden oder überzähligen Keys in einer Sprache,
- abweichenden Listlängen oder Typen,
- deutschen Resttexten in einer übersetzten Datei.

Der Build führt dieselbe Prüfung aus und bricht bei Fehlern ab – eine unvollständige Übersetzung kann nicht versehentlich online gehen.

### Sprach-URLs

| Route | de | en | ar | fr | es |
| --- | --- | --- | --- | --- | --- |
| Home | `/de/` | `/en/` | `/ar/` | `/fr/` | `/es/` |
| Über uns | `/de/ueber-uns/` | `/en/about/` | `/ar/man-nahnu/` | `/fr/a-propos/` | `/es/sobre-nosotros/` |
| Training | `/de/training/` | `/en/training/` | `/ar/tadrib/` | `/fr/entrainement/` | `/es/entrenamiento/` |
| Team | `/de/team/` | `/en/team/` | `/ar/fariq/` | `/fr/equipe/` | `/es/equipo/` |
| Galerie | `/de/galerie/` | `/en/gallery/` | `/ar/suwar/` | `/fr/galerie/` | `/es/galeria/` |
| Kontakt | `/de/kontakt/` | `/en/contact/` | `/ar/ittisal/` | `/fr/contact/` | `/es/contacto/` |
| Impressum | `/de/impressum/` | `/en/legal/` | `/ar/qanuni/` | `/fr/mentions-legales/` | `/es/aviso-legal/` |

Jede Seite enthält:

- `<link rel="canonical">` auf die eigene Sprach-URL,
- fünf `hreflang`-Alternates plus `x-default` (Deutsch),
- `og:locale` / `og:locale:alternate`,
- sprachabhängige `<title>`, `<meta name="description">` und JSON-LD (LocalBusiness).

`sitemap.xml` enthält alle Seiten mit `xhtml:link`-Alternates.

### Sprachauswahl beim ersten Besuch

1. `/` ist eine neutrale Begrüßungsseite: Logo, „Willkommen bei der ATAI JUDO ACADEMY“, „Bitte wähle deine bevorzugte Sprache.“ und fünf Sprachkarten mit Flagge und Sprachnamen. Sie funktioniert auch ohne JavaScript, weil die Sprachkarten echte Links sind.
2. Ohne gespeicherte Sprache erscheint dieses Fenster **vor** der eigentlichen Website – auch wenn jemand direkt auf einer Unterseite landet. Nach der Auswahl geht es auf dieselbe Unterseite in der gewählten Sprache.
3. Die Auswahl wird in `localStorage` (`atai.lang`) gespeichert.
4. Bei späteren Besuchen leitet `/` automatisch auf die zuletzt gewählte Sprache um; wer eine anderssprachige URL öffnet, wird ebenfalls auf die gemerkte Sprache geführt. Ein Klick auf die Sprachumschaltung setzt ein Einmal-Flag (`atai.switch`), damit die Seite beim Wechsel nicht zurückspringt.
5. Die Sprachumschaltung im Header (und im Footer) zeigt fünf Sprachen mit Flaggen. Jeder Link zeigt auf **dieselbe Unterseite** in der Zielsprache – nie auf die Startseite. Ohne JavaScript bleiben es normale Links.

### Arabisch / RTL

- `<html lang="ar" dir="rtl">` – Navigation, Menüs, Texte, Formulare, Tabellen und Layouts spiegeln automatisch, weil das CSS konsequent logische Eigenschaften nutzt (`margin-inline`, `inset-inline`, `text-align: start`).
- Nur Richtungs-Icons (Pfeile, Lightbox-Navigation) werden gespiegelt.
- **Bilder und Logo werden nie gespiegelt oder beschnitten.**
- Arabische Typografie: Noto Sans Arabic (self-hosted), angepasste Schriftgrößen und Zeilenhöhen, `letter-spacing: 0` (Arabisch darf nicht gesperrt werden).
- Zeitangaben (`17:00`) sind bidi-isoliert und bleiben korrekt lesbar.

---

## Seiten & Funktionen

- **Start:** Hero mit Fotografie, Kennzahlen, Willkommenstext, Werte, Gruppen, Trainingszeiten, Trainer, Galerie-Teaser, Call-to-Action
- **Über uns:** Geschichte, Philosophie („Technik schlägt Kraft“), Werte, Ziele
- **Training:** Gruppen, Wochenplan, „So startest du“ (4 Schritte), FAQ mit sechs Fragen
- **Team:** Gründer und Cheftrainer Mohamed Charrak, Fakten, Trainerphilosophie, „Teil des Teams werden“
- **Galerie:** acht Bilder mit Lightbox (Tastatur: ←/→, Esc), Instagram-Verweis
- **Kontakt:** vier Info-Karten und vollständiges Formular (Name, E-Mail, Telefon optional, Interesse, Nachricht, Datenschutz-Einwilligung, Honeypot)
- **Impressum & Datenschutz:** zweisprachig strukturierte Kapitel mit Ankerpunkten
- **404:** sprachabhängig, `noindex`

Das Formular validiert im Browser **und** auf dem Server. Fehlermeldungen und Erfolgsmeldungen kommen aus der jeweiligen Sprachdatei. Anfragen werden als JSON Lines in `data/contact-messages.jsonl` gespeichert (Verzeichnis ist nicht versioniert, Rate-Limit: 8 Anfragen pro 10 Minuten und IP).

---

## Design

- Farben: Tiefes Marine (`#081320`), Creme (`#F7F3EA`), Judo-Rot (`#B3261E`), Gold (`#C9A15A`)
- Schriften: Outfit (Display) + Inter (Text) + Noto Sans Arabic – alle lokal gehostet, keine externen Requests
- Wechsel aus dunklen und hellen Sektionen, großzügiger Weißraum, feine Goldlinien, dezente Reveal-Animationen (`prefers-reduced-motion` wird respektiert)
- Responsive Breakpoints: 1240 / 1080 / 980 / 700 / 480 px; auf Mobilgeräten wird aus dem Header ein Vollbildmenü, Tabellen werden zu gestapelten Zeilen
- Skip-Link, Fokus-Ringe, `aria-current`, `aria-live` für Formularstatus, Fokusfalle im Sprachfenster

---

## Deployment

**Variante A – statisch:** `npm run build` und den Inhalt von `dist/` auf einen beliebigen Static-Host legen. Für die Sprach-Persistenz ist `index.html` im Wurzelverzeichnis nötig. Das Kontaktformular benötigt dann ein Serverless-Pendant zu `POST /api/contact`.

**Variante B – mit Server:** `npm start` (oder `node server.mjs` hinter einem Reverse Proxy). Der Server liefert `dist/` aus, wählt die sprachabhängige 404-Seite und verarbeitet das Formular.

Vor dem Livegang:

1. `siteUrl` in `src/config/languages.json` auf die echte Domain setzen (hreflang, canonical, Sitemap, og:image hängen daran).
2. `npm run build` erneut ausführen.

---

## Offene Punkte vor dem Livegang

Diese Inhalte sind bewusst als Platzhalter angelegt und sollten durch die echten Daten des Vereins ersetzt werden:

| Thema | Datei | Hinweis |
| --- | --- | --- |
| Logo | `src/assets/logo.svg`, `favicon.svg` | Neu gezeichnetes Emblem (A-Monogramm mit rotem Gürtel). Das offizielle Logo kann 1:1 ersetzt werden – gleiche Dateinamen, quadratisches Format. |
| E-Mail & Domain | `src/config/site.json`, `languages.json` | `info@atai-judo-academy.com` und `www.atai-judo-academy.com` sind Annahmen. |
| Trainingsort | `src/i18n/*.json` → `meta.venue` | „GISAD – German International School Abu Dhabi“ laut Instagram-Profil („📍 GISAD“). |
| Trainingszeiten | `src/config/site.json` → `schedule` | Samstag 10:00 Kinder / 11:00 Erwachsene sind belegt; die Donnerstagszeiten sind Platzhalter und müssen bestätigt werden. |
| Bilder | `src/assets/img/` | KI-generierte Motive als hochwertige Zwischenlösung. Für echte Trainingsfotos austauschen (gleiche Dateinamen und Seitenverhältnisse) und `site.json` nicht anpassen. |
| Rechtstexte | `src/i18n/*.json` → `pages.legal` | Impressum/Datenschutz sind sorgfältig formulierte Muster. Vor Veröffentlichung rechtlich prüfen lassen. |
| Social-Links | `src/config/site.json` | Instagram ist gesetzt, weitere Kanäle können ergänzt werden. |

---

## Technische Hinweise

- Keine externen Netzwerkaufrufe: Schriften, Flaggen und Bilder liegen im Projekt.
- `localStorage` speichert ausschließlich die Sprachwahl; kein Tracking, keine Analyse-Cookies.
- Der Build ist deterministisch; alle Ausgaben entstehen aus `src/`.
- Schriften: Outfit und Inter (SIL Open Font License), Noto Sans Arabic (SIL OFL).
- Flaggen: `flag-icons` (MIT-Lizenz).
- Fotografien: KI-generiert für dieses Projekt.
