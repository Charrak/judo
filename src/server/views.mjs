/** Server-rendered admin interface. German copy – the site itself is multilingual. */
import { esc } from '../lib/html.mjs';

const TABS = [
  { key: 'dashboard', href: '/admin/', label: 'Übersicht' },
  { key: 'texts', href: '/admin/texte', label: 'Texte' },
  { key: 'news', href: '/admin/neuigkeiten', label: 'Neuigkeiten' },
  { key: 'gallery', href: '/admin/galerie', label: 'Galerie' },
  { key: 'messages', href: '/admin/nachrichten', label: 'Nachrichten' },
  { key: 'settings', href: '/admin/einstellungen', label: 'Einstellungen' },
];

function badge(count) {
  return count > 0 ? `<span class="tab__badge">${count}</span>` : '';
}

export function layout({ title, active = '', body, session, counts = {}, flash = '' }) {
  const tabs = TABS.map(
    (tab) =>
      `<a class="tab${tab.key === active ? ' is-active' : ''}" href="${tab.href}"${
        tab.key === active ? ' aria-current="page"' : ''
      }>${esc(tab.label)}${tab.key === 'messages' ? badge(counts.messages ?? 0) : ''}${
        tab.key === 'news' ? badge(counts.newsDrafts ?? 0) : ''
      }</a>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="csrf" content="${esc(session?.csrf ?? '')}">
  <title>${esc(title)} · ATAI Studio</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/admin/assets/admin.css">
  <script src="/admin/assets/admin.js" defer></script>
</head>
<body class="admin"${flash ? ` data-flash="${esc(flash)}"` : ''}>
  <header class="topbar">
    <div class="topbar__inner">
      <a class="topbar__brand" href="/admin/">
        <img src="/assets/logo.svg" alt="" width="34" height="34">
        <span>ATAI <em>Studio</em></span>
      </a>
      <nav class="tabs" aria-label="Bereiche">${tabs}</nav>
      <div class="topbar__actions">
        <a class="link" href="/de/" target="_blank" rel="noopener">Website ansehen ↗</a>
        <form method="post" action="/admin/logout">
          <input type="hidden" name="_csrf" value="${esc(session?.csrf ?? '')}">
          <button class="link link--button" type="submit">Abmelden</button>
        </form>
      </div>
    </div>
  </header>
  <main class="wrap">${body}</main>
  <div class="toast" data-toast role="status" aria-live="polite"></div>
</body>
</html>`;
}

export function authLayout({ title, body, flash = '' }) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(title)} · ATAI Studio</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/admin/assets/admin.css">
</head>
<body class="admin admin--auth"${flash ? ` data-flash="${esc(flash)}"` : ''}>
  <main class="auth">
    <div class="auth__card">
      <img class="auth__logo" src="/assets/logo.svg" alt="" width="64" height="64">
      <p class="auth__brand">ATAI <em>Studio</em></p>
      ${body}
    </div>
    <p class="auth__foot">Inhalte und Texte der ATAI JUDO ACADEMY</p>
  </main>
  <div class="toast" data-toast role="status" aria-live="polite"></div>
</body>
</html>`;
}

export function loginPage({ error = '', next = '/admin/' }) {
  return authLayout({
    title: 'Anmelden',
    body: `<h1 class="auth__title">Anmelden</h1>
      <p class="auth__text">Bitte gib dein Passwort ein, um Texte und Inhalte zu bearbeiten.</p>
      ${error ? `<p class="alert alert--error" role="alert">${esc(error)}</p>` : ''}
      <form method="post" action="/admin/login" class="stack">
        <input type="hidden" name="next" value="${esc(next)}">
        <label class="field">
          <span class="field__label">Passwort</span>
          <input class="input" type="password" name="password" autocomplete="current-password" required autofocus>
        </label>
        <button class="btn btn--primary btn--block" type="submit">Anmelden</button>
      </form>
      <p class="auth__hint">Passwort vergessen? Dann <code>data/admin.json</code> löschen und den Server neu starten.</p>`,
  });
}

export function setupPage({ error = '', minPassword = 10, usingEnvToken = false }) {
  return authLayout({
    title: 'Einrichten',
    body: `<h1 class="auth__title">Einrichten</h1>
      <p class="auth__text">Lege einmalig das Passwort für den geschützten Bereich fest. Danach kommst du nur noch mit diesem Passwort hinein.</p>
      ${error ? `<p class="alert alert--error" role="alert">${esc(error)}</p>` : ''}
      <form method="post" action="/admin/setup" class="stack">
        <label class="field">
          <span class="field__label">Einrichtungscode</span>
          <input class="input" type="text" name="code" autocomplete="off" required autofocus>
          <span class="field__hint">${
            usingEnvToken
              ? 'Der Code steht in der Umgebungsvariable <code>ADMIN_SETUP_TOKEN</code>.'
              : 'Der Code wird beim Start des Servers in der Konsole angezeigt.'
          }</span>
        </label>
        <label class="field">
          <span class="field__label">Neues Passwort</span>
          <input class="input" type="password" name="password" autocomplete="new-password" minlength="${minPassword}" required>
          <span class="field__hint">Mindestens ${minPassword} Zeichen.</span>
        </label>
        <label class="field">
          <span class="field__label">Passwort wiederholen</span>
          <input class="input" type="password" name="password2" autocomplete="new-password" minlength="${minPassword}" required>
        </label>
        <button class="btn btn--primary btn--block" type="submit">Passwort speichern</button>
      </form>`,
  });
}

export function dashboard({ stats, buildInfo }) {
  const cards = [
    { label: 'Geänderte Texte', value: stats.overrides, hint: 'über die Standardtexte hinaus', href: '/admin/texte' },
    { label: 'Neuigkeiten', value: stats.news, hint: `${stats.newsDrafts} Entwurf/Entwürfe`, href: '/admin/neuigkeiten' },
    { label: 'Galerie-Bilder', value: stats.gallery, hint: 'in der Reihenfolge der Website', href: '/admin/galerie' },
    { label: 'Nachrichten', value: stats.messages, hint: 'über das Kontaktformular', href: '/admin/nachrichten' },
  ]
    .map(
      (card) => `<a class="stat" href="${card.href}">
        <span class="stat__value">${card.value}</span>
        <span class="stat__label">${esc(card.label)}</span>
        <span class="stat__hint">${esc(card.hint)}</span>
      </a>`,
    )
    .join('');

  return `<div class="page-head">
      <div>
        <h1 class="page-title">Übersicht</h1>
        <p class="page-sub">Texte ändern und Inhalte hinzufügen – die Website wird nach dem Speichern automatisch neu gebaut.</p>
      </div>
    </div>
    <div class="stats">${cards}</div>
    <div class="cols">
      <section class="card">
        <h2 class="card__title">Schnellstart</h2>
        <ul class="quick">
          <li><a href="/admin/texte?lang=de"><strong>Texte</strong> bearbeiten – Deutsch ist die Originalfassung, die vier Übersetzungen liegen daneben.</a></li>
          <li><a href="/admin/neuigkeiten/neu"><strong>Neuigkeit</strong> anlegen – Titel, Text und optional ein Bild, in allen fünf Sprachen.</a></li>
          <li><a href="/admin/galerie"><strong>Galerie</strong> pflegen – Bilder hochladen, beschriften und sortieren.</a></li>
          <li><a href="/admin/nachrichten"><strong>Anfragen</strong> lesen, die über das Kontaktformular eingehen.</a></li>
        </ul>
      </section>
      <section class="card">
        <h2 class="card__title">So funktioniert es</h2>
        <p class="card__text">Alle Änderungen werden in <code>content/</code> gespeichert und sofort in die fertigen Seiten unter <code>dist/</code> gebaut. Damit sie bei einem neuen Deployment nicht verloren gehen, <code>content/</code> mit committen.</p>
        <p class="card__text">Die Sprachumschaltung der Website bleibt erhalten: Jede Änderung gilt nur für die gewählte Sprache. Achte darauf, dass Übersetzungen nicht versehentlich deutschen Text enthalten.</p>
        <p class="card__meta">Letzter Build: ${esc(buildInfo)}</p>
      </section>
    </div>`;
}

/* -------------------------------------------------------------------- texts */

const SECTION_LABELS = {
  nav: 'Navigation',
  meta: 'Ort & Metadaten',
  actions: 'Buttons & Aktionen',
  ui: 'Bedienelemente',
  welcome: 'Sprachauswahl beim ersten Besuch',
  values: 'Werte',
  programs: 'Trainingsgruppen',
  schedule: 'Trainingszeiten',
  footer: 'Fußbereich',
  form: 'Kontaktformular',
  news: 'Neuigkeiten',
  notFound: '404-Seite',
  'pages.home': 'Startseite',
  'pages.about': 'Über uns',
  'pages.training': 'Training',
  'pages.team': 'Team',
  'pages.gallery': 'Galerie',
  'pages.contact': 'Kontakt',
  'pages.legal': 'Impressum & Datenschutz',
};

const SECTION_ORDER = [
  'pages.home',
  'pages.about',
  'pages.training',
  'pages.team',
  'pages.gallery',
  'pages.contact',
  'pages.legal',
  'nav',
  'actions',
  'meta',
  'ui',
  'welcome',
  'values',
  'programs',
  'schedule',
  'form',
  'footer',
  'news',
  'notFound',
];

export function sectionLabel(key) {
  return SECTION_LABELS[key] ?? key;
}

export function sectionOrder(keys) {
  const known = SECTION_ORDER.filter((key) => keys.includes(key));
  const rest = keys.filter((key) => !SECTION_ORDER.includes(key)).sort();
  return [...known, ...rest];
}

function fieldLabel(path, group) {
  const suffix = path.startsWith(`${group}.`) ? path.slice(group.length + 1) : path;
  return suffix
    .split('.')
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part))
    .join(' › ');
}

function fieldId(path) {
  return `f-${path.replace(/[^a-zA-Z0-9]+/g, '-')}`;
}

function textField(field, lang) {
  const id = fieldId(field.path);
  const dir = lang === 'ar' ? ' dir="rtl"' : '';
  const control = field.multiline
    ? `<textarea class="input input--area" id="${id}" rows="${Math.min(12, Math.max(3, Math.ceil(field.value.length / 90)))}"${dir} data-input>${esc(
        field.value,
      )}</textarea>`
    : `<input class="input" id="${id}" type="text"${dir} value="${esc(field.value)}" data-input>`;

  return `<div class="field" data-field data-path="${esc(field.path)}" data-original="${esc(field.value)}" data-base="${esc(
    field.base,
  )}">
      <div class="field__head">
        <label class="field__label" for="${id}"><span data-label-text>${esc(field.label)}</span></label>
        ${field.overridden ? '<span class="pill pill--changed" data-badge>geändert</span>' : '<span class="pill pill--changed" data-badge hidden>geändert</span>'}
        <button class="mini" type="button" data-reset${field.overridden ? '' : ' hidden'}>Zurücksetzen</button>
      </div>
      ${control}
      <div class="field__meta">
        <code>${esc(field.path)}</code>
        <span data-counter>${field.value.length}</span>
      </div>
      ${field.ref ? `<p class="field__ref">DE: ${esc(field.ref)}</p>` : ''}
    </div>`;
}

export function textsPage({ lang, languages, groups, total, overrides, query, changedOnly, baseLanguage }) {
  const tabs = languages
    .map(
      (language) =>
        `<a class="langtab${language.code === lang ? ' is-active' : ''}" href="/admin/texte?lang=${language.code}"${
          language.code === lang ? ' aria-current="page"' : ''
        }>
          <img src="/assets/flags/${esc(language.flag)}.svg" alt="" width="21" height="16">
          <span>${esc(language.nativeName)}</span>
          <em>${esc(language.code.toUpperCase())}</em>
        </a>`,
    )
    .join('');

  const body = groups
    .map(
      (group) => `<section class="group" data-group="${esc(group.key)}">
        <h2 class="group__title">${esc(group.label)}<span class="group__count">${group.fields.length}</span></h2>
        <div class="group__fields">${group.fields.map((field) => textField(field, lang)).join('')}</div>
      </section>`,
    )
    .join('');

  return `<div class="page-head">
      <div>
        <h1 class="page-title">Texte</h1>
        <p class="page-sub">${esc(
          lang === baseLanguage
            ? 'Deutsch ist die Originalfassung. Änderungen hier gelten für alle Besucher der deutschen Website.'
            : `Übersetzung für ${languages.find((entry) => entry.code === lang)?.nativeName ?? lang}. Links steht jeweils der deutsche Originaltext als Referenz.`,
        )}</p>
      </div>
      <div class="page-head__meta" data-overrides-meta>${overrides} von ${total} Feldern geändert</div>
    </div>

    <div class="texttoolbar">
      <div class="langtabs">${tabs}</div>
      <div class="texttoolbar__tools">
        <label class="searchfield">
          <span class="sr-only">Suchen</span>
          <input class="input" type="search" placeholder="Suchen …" value="${esc(query)}" data-search>
        </label>
        <label class="toggle">
          <input type="checkbox" data-only-changed${changedOnly ? ' checked' : ''}>
          <span>nur geänderte</span>
        </label>
      </div>
    </div>

    <p class="emptyfilter" data-empty-filter hidden>Keine Felder gefunden.</p>
    <form class="texts" data-text-editor data-lang="${esc(lang)}" data-endpoint="/api/admin/texts">
      ${body}
    </form>

    <div class="savebar" data-savebar hidden>
      <p><strong data-dirty-count>0</strong> Änderungen</p>
      <div class="savebar__actions">
        <button class="btn btn--ghost" type="button" data-discard>Verwerfen</button>
        <button class="btn btn--primary" type="button" data-save>Speichern</button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------- news */

function newsStatus(entry) {
  if (!entry.published) return '<span class="pill pill--draft">Entwurf</span>';
  return '<span class="pill pill--live">Veröffentlicht</span>';
}

function languageDots(entry, languages) {
  return `<span class="dots" title="Übersetzungen">${languages
    .map((language) => {
      const translation = entry.translations?.[language.code];
      const done = translation && translation.title && translation.body;
      return `<span class="dot${done ? ' is-done' : ''}" title="${esc(language.nativeName)}">${esc(language.code.toUpperCase())}</span>`;
    })
    .join('')}</span>`;
}

export function newsListPage({ items, languages }) {
  const rows = items.length
    ? items
        .map(
          (entry) => `<li class="row">
            <div class="row__main">
              <a class="row__title" href="/admin/neuigkeiten/${esc(entry.id)}">${esc(
                entry.translations?.de?.title || entry.slug || 'Ohne Titel',
              )}</a>
              <span class="row__meta">${esc(entry.date)} · ${esc(entry.slug || 'kein Slug')}</span>
            </div>
            ${languageDots(entry, languages)}
            ${newsStatus(entry)}
            <a class="row__action" href="/admin/neuigkeiten/${esc(entry.id)}">Bearbeiten</a>
          </li>`,
        )
        .join('')
    : `<li class="row row--empty">Noch keine Beiträge. Der erste Beitrag erscheint direkt in der Navigation der Website.</li>`;

  return `<div class="page-head">
      <div>
        <h1 class="page-title">Neuigkeiten</h1>
        <p class="page-sub">Beiträge in allen fünf Sprachen. Veröffentlicht wird nur, wenn jede Sprache Titel und Text hat.</p>
      </div>
      <a class="btn btn--primary" href="/admin/neuigkeiten/neu">Neuer Beitrag</a>
    </div>
    <ul class="rows" role="list">${rows}</ul>`;
}

export function newsEditorPage({ entry, languages, isNew }) {
  const blocks = languages
    .map((language) => {
      const translation = entry.translations?.[language.code] ?? { title: '', body: '' };
      const dir = language.code === 'ar' ? ' dir="rtl"' : '';
      return `<details class="langblock" data-langblock="${language.code}"${language.code === 'de' ? ' open' : ''}>
        <summary class="langblock__head">
          <img src="/assets/flags/${esc(language.flag)}.svg" alt="" width="21" height="16">
          <span>${esc(language.nativeName)}</span>
          <em>${esc(language.code.toUpperCase())}</em>
        </summary>
        <div class="langblock__body">
          <label class="field field--plain">
            <span class="field__label">Titel</span>
            <input class="input" type="text" data-title="${esc(language.code)}"${dir} value="${esc(translation.title)}">
          </label>
          <label class="field field--plain">
            <span class="field__label">Text</span>
            <textarea class="input input--area" rows="6" data-body="${esc(language.code)}"${dir}>${esc(translation.body)}</textarea>
            <span class="field__hint">Leerzeile = neuer Absatz.</span>
          </label>
        </div>
      </details>`;
    })
    .join('');

  return `<div class="page-head">
      <div>
        <h1 class="page-title">${isNew ? 'Neuer Beitrag' : 'Beitrag bearbeiten'}</h1>
        <p class="page-sub">Titel und Text in allen fünf Sprachen – so erscheint der Beitrag einheitlich auf jeder Sprachversion.</p>
      </div>
      <a class="btn btn--ghost" href="/admin/neuigkeiten">Zurück zur Liste</a>
    </div>

    <form class="card editor" data-news-form data-id="${esc(entry.id)}" data-new="${isNew ? '1' : '0'}">
      <div class="editor__row">
        <label class="field field--plain">
          <span class="field__label">Datum</span>
          <input class="input" type="date" data-date value="${esc(entry.date)}">
        </label>
        <label class="field field--plain">
          <span class="field__label">Adresse (Slug)</span>
          <input class="input" type="text" data-slug value="${esc(entry.slug)}" placeholder="z-b-erstes-turnier">
          <span class="field__hint">Wird in der URL verwendet, z. B. <code>/de/aktuelles/${esc(
            entry.slug || 'erstes-turnier',
          )}/</code></span>
        </label>
        <label class="check">
          <input type="checkbox" data-published${entry.published ? ' checked' : ''}>
          <span>Veröffentlicht</span>
        </label>
      </div>

      <div class="upload" data-upload>
        <div class="upload__preview${entry.image ? ' has-image' : ''}" data-preview>
          ${entry.image ? `<img src="${esc(entry.image)}" alt="">` : '<span>Kein Bild</span>'}
        </div>
        <div class="upload__controls">
          <label class="btn btn--ghost btn--sm">
            Bild auswählen
            <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" data-file>
          </label>
          <button class="mini" type="button" data-remove-image${entry.image ? '' : ' hidden'}>Bild entfernen</button>
          <p class="field__hint">JPG, PNG oder WebP bis 8 MB. Das Bild erscheint auf der Übersicht und im Beitrag.</p>
        </div>
        <input type="hidden" data-image value="${esc(entry.image)}">
      </div>

      <div class="langblocks">${blocks}</div>
      <p class="alert alert--error" data-form-error hidden></p>
      <p class="alert alert--warn" data-publish-hint hidden></p>

      <div class="editor__actions">
        <button class="btn btn--danger" type="button" data-delete${isNew ? ' hidden' : ''}>Beitrag löschen</button>
        <div class="editor__actions-right">
          <a class="btn btn--ghost" href="/admin/neuigkeiten">Abbrechen</a>
          <button class="btn btn--primary" type="submit">Speichern</button>
        </div>
      </div>
    </form>`;
}

/* ------------------------------------------------------------------ gallery */

export function galleryPage({ items, languages }) {
  const rows = items
    .map(
      (item) => `<li class="gitem" data-item data-id="${esc(item.id)}" data-src="${esc(item.src)}" data-width="${item.width}" data-height="${item.height}" data-uploaded="${item.uploaded ? '1' : '0'}">
        <div class="gitem__thumb"><img src="${esc(item.src)}" alt="" loading="lazy"></div>
        <div class="gitem__fields">
          ${languages
            .map(
              (language) => `<label class="gitem__caption">
                <span>${esc(language.code.toUpperCase())}</span>
                <input class="input" type="text" data-caption="${esc(language.code)}"${
                  language.code === 'ar' ? ' dir="rtl"' : ''
                } value="${esc(item.captions?.[language.code] ?? '')}" placeholder="Bildbeschreibung">
              </label>`,
            )
            .join('')}
        </div>
        <div class="gitem__tools">
          <button class="mini" type="button" data-move="up" title="nach oben">↑</button>
          <button class="mini" type="button" data-move="down" title="nach unten">↓</button>
          <button class="mini mini--danger" type="button" data-remove>Entfernen</button>
        </div>
      </li>`,
    )
    .join('');

  return `<div class="page-head">
      <div>
        <h1 class="page-title">Galerie</h1>
        <p class="page-sub">Bilder der Galerie. Jedes Bild braucht eine Beschriftung in allen fünf Sprachen.</p>
      </div>
      <label class="btn btn--primary">
        Bilder hochladen
        <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple data-gallery-file>
      </label>
    </div>

    <p class="alert alert--info">Tipp: Fotos im Querformat wirken in der Galerie am besten. Neue Bilder werden ans Ende gehängt.</p>

    <ul class="galleryEditor" role="list" data-gallery-editor data-endpoint="/api/admin/gallery">${rows}</ul>

    <div class="savebar" data-savebar hidden>
      <p><strong data-dirty-count>0</strong> Änderungen</p>
      <div class="savebar__actions">
        <button class="btn btn--ghost" type="button" data-discard>Verwerfen</button>
        <button class="btn btn--primary" type="button" data-save>Speichern</button>
      </div>
    </div>`;
}

/* ----------------------------------------------------------------- messages */

const INTERESTS = {
  kids: 'Kinder',
  youth: 'Jugend',
  adults: 'Erwachsene',
  trial: 'Probetraining',
  other: 'Sonstiges',
};

export function messagesPage({ messages }) {
  const rows = messages.length
    ? messages
        .map(
          (message) => `<li class="message" data-id="${esc(message.id)}">
            <div class="message__head">
              <div>
                <p class="message__name">${esc(message.name)}</p>
                <p class="message__meta">${esc(message.email)}${
                  message.phone ? ` · ${esc(message.phone)}` : ''
                } · ${esc(INTERESTS[message.interest] ?? message.interest ?? '–')} · ${esc(
                  (message.lang || '–').toUpperCase(),
                )}</p>
              </div>
              <time class="message__date" datetime="${esc(message.receivedAt ?? '')}">${esc(
                (message.receivedAt ?? '').replace('T', ' ').slice(0, 16),
              )}</time>
            </div>
            <p class="message__text">${esc(message.message)}</p>
            <div class="message__actions">
              <a class="mini" href="mailto:${esc(message.email)}?subject=${encodeURIComponent('ATAJ Judo – deine Anfrage')}">Antworten</a>
              <button class="mini mini--danger" type="button" data-delete>Löschen</button>
            </div>
          </li>`,
        )
        .join('')
    : '<li class="row row--empty">Noch keine Anfragen.</li>';

  return `<div class="page-head">
      <div>
        <h1 class="page-title">Nachrichten</h1>
        <p class="page-sub">Anfragen aus dem Kontaktformular. Sie werden nur auf diesem Server gespeichert, nicht veröffentlicht.</p>
      </div>
      ${
        messages.length
          ? '<button class="btn btn--ghost" type="button" data-clear-messages>Alle löschen</button>'
          : ''
      }
    </div>
    <ul class="messages" role="list" data-messages data-endpoint="/api/admin/messages">${rows}</ul>`;
}

export function settingsPage({ site, languages, buildInfo, contentItems, message = '', error = '' }) {
  return `<div class="page-head">
      <div>
        <h1 class="page-title">Einstellungen</h1>
        <p class="page-sub">Passwort, Spracheinstellungen und der Stand der Website.</p>
      </div>
    </div>

    ${message ? `<p class="alert alert--info" role="status">${esc(message)}</p>` : ''}

    <div class="cols">
      <section class="card">
        <h2 class="card__title">Passwort ändern</h2>
        <p class="card__text">Nach der Änderung werden alle anderen Sitzungen abgemeldet.</p>
        ${error ? `<p class="alert alert--error" role="alert">${esc(error)}</p>` : ''}
        <form method="post" action="/admin/einstellungen" class="stack">
          <input type="hidden" name="_csrf" value="${esc(site.csrf ?? '')}">
          <input type="hidden" name="action" value="password">
          <label class="field field--plain">
            <span class="field__label">Aktuelles Passwort</span>
            <input class="input" type="password" name="current" autocomplete="current-password" required>
          </label>
          <label class="field field--plain">
            <span class="field__label">Neues Passwort</span>
            <input class="input" type="password" name="password" autocomplete="new-password" minlength="${site.minPassword ?? 10}" required>
            <span class="field__hint">Mindestens ${site.minPassword ?? 10} Zeichen.</span>
          </label>
          <label class="field field--plain">
            <span class="field__label">Neues Passwort wiederholen</span>
            <input class="input" type="password" name="password2" autocomplete="new-password" minlength="${site.minPassword ?? 10}" required>
          </label>
          <button class="btn btn--primary" type="submit">Passwort speichern</button>
        </form>
      </section>

      <section class="card">
        <h2 class="card__title">Website</h2>
        <ul class="quick">
          <li><strong>Sprachen:</strong> ${languages
            .map((language) => `${esc(language.nativeName)} (${esc(language.code.toUpperCase())})`)
            .join(', ')}</li>
          <li><strong>Adresse:</strong> <code>${esc(site.siteUrl ?? '')}</code></li>
          <li><strong>Letzter Build:</strong> ${esc(buildInfo)}</li>
          <li><strong>Inhalte:</strong> ${contentItems} Datei(en) in <code>content/</code></li>
        </ul>
        <form method="post" action="/admin/einstellungen" class="stack" style="margin-top:14px">
          <input type="hidden" name="_csrf" value="${esc(site.csrf ?? '')}">
          <input type="hidden" name="action" value="rebuild">
          <button class="btn btn--ghost" type="submit">Website jetzt neu bauen</button>
        </form>
        <p class="card__meta">Der Build dauert meist unter einer Sekunde. Besucher sehen währenddessen weiterhin die alte Version.</p>
      </section>

      <section class="card">
        <h2 class="card__title">Sicherheit</h2>
        <p class="card__text">Der Admin-Bereich läuft nur auf dem Node-Server (<code>npm start</code>), nicht auf einer rein statischen Auslieferung. Betreibe ihn ausschließlich über HTTPS.</p>
        <p class="card__text">Das Passwort liegt als scrypt-Hash in <code>data/admin.json</code>. Diese Datei gehört nicht ins Repository – sie ist in <code>.gitignore</code> eingetragen.</p>
        <p class="card__text">Passwort vergessen: Server stoppen, <code>data/admin.json</code> löschen, neu starten. Dann wird wieder ein Einrichtungscode angezeigt.</p>
      </section>

      <section class="card">
        <h2 class="card__title">Sicherung</h2>
        <p class="card__text">Alle Inhalte liegen in <code>content/</code>: Texte je Sprache, Beiträge, Galerie und hochgeladene Bilder. Diesen Ordner mit committen oder regelmäßig sichern – dann sind Änderungen auch nach einem Deployment wieder da.</p>
      </section>
    </div>`;
}

export function errorPage({ status, message }) {
  return authLayout({
    title: `Fehler ${status}`,
    body: `<h1 class="auth__title">Das hat nicht geklappt</h1>
      <p class="alert alert--error" role="alert">${esc(message)}</p>
      <p class="auth__hint">Zurück zur <a href="/admin/">Übersicht</a>.</p>`,
  });
}
