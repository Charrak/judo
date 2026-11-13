/**
 * Protected admin area: login, text editing, news, gallery and the message inbox.
 *
 * Every write is validated, stored in content/ and immediately followed by a
 * rebuild of dist/. If the build fails (e.g. a German leftover in a
 * translation), the change is rolled back so the live site stays intact.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { probeImage, IMAGE_TYPES } from '../lib/image.mjs';
import {
  flattenAll,
  loadDictionaries,
  loadGallery,
  loadNews,
  normalizeGalleryItem,
  normalizeNews,
  readJson,
  writeJson,
  slugify,
} from '../lib/store.mjs';
import { createAuth } from './auth.mjs';
import * as views from './views.mjs';

const ADMIN_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

const MAX_JSON = 4 * 1024 * 1024;
const MAX_UPLOAD = 8 * 1024 * 1024;
const MAX_TEXT = 6000;
const MESSAGES_FILE = 'data/contact-messages.jsonl';

/* ------------------------------------------------------------------ helpers */

function sendHtml(res, status, html) {
  const body = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    ...ADMIN_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    ...ADMIN_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

function sendAsset(res, type, buffer) {
  res.writeHead(200, {
    ...ADMIN_HEADERS,
    'Content-Type': type,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-cache',
  });
  res.end(buffer);
}

function redirect(res, location, headers = {}) {
  res.writeHead(303, { ...ADMIN_HEADERS, ...headers, Location: location });
  res.end();
}

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Die Datei ist zu groß.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const raw = await readRaw(req, MAX_JSON);
  try {
    return JSON.parse(raw.toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Ungültige Anfrage.'), { status: 400 });
  }
}

async function readFormBody(req) {
  const raw = await readRaw(req, 64 * 1024);
  return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function isSecure(req) {
  return String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function naturalCompare(a, b) {
  return a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function readMessages(rootDir) {
  const file = path.join(rootDir, MESSAGES_FILE);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        const parsed = JSON.parse(line);
        return { ...parsed, id: parsed.id || `legacy-${index}` };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.receivedAt ?? '').localeCompare(String(a.receivedAt ?? '')));
}

function writeMessages(rootDir, messages) {
  const file = path.join(rootDir, MESSAGES_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, messages.map((message) => `${JSON.stringify(message)}\n`).join(''), 'utf8');
}

function pruneUploads(rootDir, { news, gallery }) {
  const dir = path.join(rootDir, 'content/uploads');
  if (!fs.existsSync(dir)) return 0;
  const used = new Set([...gallery.map((item) => item.src), ...news.map((entry) => entry.image)].filter(Boolean));
  let removed = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!used.has(`/assets/uploads/${file}`)) {
      fs.rmSync(path.join(dir, file), { force: true });
      removed += 1;
    }
  }
  return removed;
}

function countOverrides(overrides) {
  return Object.values(overrides).reduce((total, map) => total + Object.keys(map ?? {}).length, 0);
}

/* ------------------------------------------------------------------- module */

export function createAdmin({ rootDir, config, site, rebuild }) {
  const auth = createAuth({ dataDir: path.join(rootDir, 'data') });

  function currentState() {
    const { dictionaries, overrides } = loadDictionaries(rootDir, config);
    const news = loadNews(rootDir);
    const gallery = loadGallery(rootDir, { config, dictionaries, site });
    const messages = readMessages(rootDir);
    const drafts = news.filter(
      (entry) =>
        !entry.published || config.languages.some((language) => !entry.translations?.[language.code]?.body),
    ).length;
    return {
      dictionaries,
      overrides,
      news,
      gallery,
      messages,
      counts: {
        messages: messages.length,
        newsDrafts: drafts,
        news: news.length,
        gallery: gallery.length,
        overrides: countOverrides(overrides),
      },
    };
  }

  function renderPage(res, state, session, { title, active, body, flash = '' }) {
    sendHtml(res, 200, views.layout({ title, active, body, session, counts: state.counts, flash }));
  }

  function countContentFiles() {
    const base = path.join(rootDir, 'content');
    if (!fs.existsSync(base)) return 0;
    let count = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'README.md') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else count += 1;
      }
    };
    walk(base);
    return count;
  }

  function buildInfo() {
    try {
      const stat = fs.statSync(path.join(rootDir, 'dist/index.html'));
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(stat.mtime);
    } catch {
      return 'noch nicht gebaut';
    }
  }

  /** Persist a content file, rebuild, roll back if the build rejects the change. */
  function commitFile(file, payload, buildFailed) {
    const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    writeJson(file, payload);
    const result = rebuild();
    if (!result.ok) {
      if (previous === null) fs.rmSync(file, { force: true });
      else fs.writeFileSync(file, previous, 'utf8');
      rebuild();
      const detail = result.output.split('\n').filter(Boolean).slice(-6).join('\n');
      throw Object.assign(new Error(`${buildFailed}\n${detail}`), { status: 422 });
    }
    return result;
  }

  /* ------------------------------------------------------------- text edits */

  function textGroups(state, lang) {
    const merged = state.dictionaries[lang];
    const overrides = state.overrides[lang] ?? {};
    // Defaults of the active language (for "Zurücksetzen") and the German
    // original (as reference next to every translation).
    const baseFlat = flattenAll(readJson(path.join(rootDir, 'src/i18n', `${lang}.json`), {}));
    const germanFlat = flattenAll(state.dictionaries[config.defaultLanguage]);
    const groups = new Map();

    for (const [key, value] of flattenAll(merged)) {
      if (typeof value !== 'string') continue;
      const groupKey = key.startsWith('pages.') ? `pages.${key.split('.')[1]}` : key.split('.')[0];
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      const reference = lang === config.defaultLanguage ? '' : String(germanFlat.get(key) ?? '');
      groups.get(groupKey).push({
        path: key,
        value,
        base: String(baseFlat.get(key) ?? value),
        overridden: Object.prototype.hasOwnProperty.call(overrides, key),
        multiline: value.includes('\n') || value.length > 90,
        ref: reference && reference !== value ? (reference.length > 220 ? `${reference.slice(0, 217)}…` : reference) : '',
      });
    }

    return views.sectionOrder([...groups.keys()]).map((key) => ({
      key,
      label: views.sectionLabel(key),
      fields: groups
        .get(key)
        .map((field) => ({ ...field, label: fieldLabelFor(field.path, key) }))
        .sort((a, b) => naturalCompare(a.path, b.path)),
    }));
  }

  function fieldLabelFor(dotted, group) {
    const suffix = dotted.startsWith(`${group}.`) ? dotted.slice(group.length + 1) : dotted;
    return suffix
      .split('.')
      .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part))
      .join(' › ');
  }

  function handleTextsPage(req, res, url, session) {
    const requested = url.searchParams.get('lang');
    const lang = config.languages.some((language) => language.code === requested)
      ? requested
      : config.defaultLanguage;
    const state = currentState();
    const groups = textGroups(state, lang);
    const body = views.textsPage({
      lang,
      languages: config.languages,
      groups,
      total: groups.reduce((sum, group) => sum + group.fields.length, 0),
      overrides: countOverrides({ [lang]: state.overrides[lang] }),
      query: url.searchParams.get('q') ?? '',
      changedOnly: url.searchParams.get('changed') === '1',
      baseLanguage: config.defaultLanguage,
    });
    renderPage(res, state, session, { title: 'Texte', active: 'texts', body });
  }

  async function handleTextSave(req, res) {
    const body = await readJsonBody(req);
    const lang = String(body.lang ?? '');
    if (!config.languages.some((language) => language.code === lang)) {
      sendJson(res, 400, { ok: false, error: 'Unbekannte Sprache.' });
      return;
    }
    if (!body.values || typeof body.values !== 'object') {
      sendJson(res, 400, { ok: false, error: 'Keine Änderungen übermittelt.' });
      return;
    }

    const base = readJson(path.join(rootDir, 'src/i18n', `${lang}.json`), {});
    const known = flattenAll(base);
    const file = path.join(rootDir, 'content/texts', `${lang}.json`);
    const current = readJson(file, {}) ?? {};
    const next = { ...current };
    const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[0]);

    for (const [key, rawValue] of Object.entries(body.values)) {
      if (!known.has(key)) {
        sendJson(res, 400, { ok: false, error: `Unbekanntes Feld: ${key}` });
        return;
      }
      const baseValue = String(known.get(key));
      if (rawValue === null) {
        delete next[key];
        continue;
      }
      const value = String(rawValue)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
        .trim();
      if (!value) {
        sendJson(res, 400, { ok: false, error: `Das Feld "${key}" darf nicht leer sein.` });
        return;
      }
      if (value.length > MAX_TEXT) {
        sendJson(res, 400, { ok: false, error: `Das Feld "${key}" ist zu lang (max. ${MAX_TEXT} Zeichen).` });
        return;
      }
      const missing = placeholders(baseValue).filter((placeholder) => !value.includes(placeholder));
      if (missing.length) {
        sendJson(res, 400, {
          ok: false,
          error: `Im Feld "${key}" fehlt der Platzhalter ${missing.join(', ')} – er wird von der Website benötigt.`,
        });
        return;
      }
      if (value === baseValue) delete next[key];
      else next[key] = value;
    }

    const changed = Object.keys({ ...current, ...next }).filter((key) => current[key] !== next[key]).length;
    if (!changed) {
      sendJson(res, 200, { ok: true, changed: 0, ms: 0, overrides: countOverrides({ [lang]: next }) });
      return;
    }

    try {
      const result = commitFile(
        file,
        next,
        'Die Texte wurden nicht gespeichert: Der Build hat die Änderung abgelehnt (z. B. deutscher Text in einer Übersetzung).',
      );
      sendJson(res, 200, { ok: true, changed, ms: result.ms, overrides: countOverrides({ [lang]: next }) });
    } catch (error) {
      sendJson(res, error.status ?? 500, { ok: false, error: error.message });
    }
  }

  /* ------------------------------------------------------------------- news */

  function newsEditor(res, session, id) {
    const state = currentState();
    const isNew = id === 'neu';
    const entry = isNew
      ? {
          id: '',
          date: new Date().toISOString().slice(0, 10),
          slug: '',
          published: false,
          image: '',
          translations: {},
        }
      : state.news.find((item) => item.id === id);
    if (!entry) {
      sendHtml(res, 404, views.errorPage({ status: 404, message: 'Diesen Beitrag gibt es nicht (mehr).' }));
      return;
    }
    renderPage(res, state, session, {
      title: 'Beitrag',
      active: 'news',
      body: views.newsEditorPage({ entry, languages: config.languages, isNew }),
    });
  }

  async function saveNews(res, payload) {
    const items = loadNews(rootDir);
    const existing = items.find((item) => item.id === payload.id);
    const translations = {};

    for (const language of config.languages) {
      const value = payload.translations?.[language.code] ?? {};
      const title = String(value.title ?? '').trim();
      const text = String(value.body ?? '').replace(/\r\n?/g, '\n').trim();
      if (title.length > 200) throw Object.assign(new Error('Der Titel ist zu lang (max. 200 Zeichen).'), { status: 400 });
      if (text.length > 20000) throw Object.assign(new Error('Der Text ist zu lang (max. 20.000 Zeichen).'), { status: 400 });
      translations[language.code] = { title, body: text };
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date ?? ''))
      ? payload.date
      : new Date().toISOString().slice(0, 10);
    const published = Boolean(payload.published);
    const image = typeof payload.image === 'string' && payload.image.startsWith('/assets/') ? payload.image : '';

    if (published) {
      const missing = config.languages.filter(
        (language) => translations[language.code].title.length < 2 || translations[language.code].body.length < 10,
      );
      if (missing.length) {
        sendJson(res, 400, {
          ok: false,
          error: `Zum Veröffentlichen fehlen Titel oder Text in: ${missing
            .map((language) => language.nativeName)
            .join(', ')}.`,
        });
        return;
      }
    }

    const id = existing?.id ?? crypto.randomBytes(6).toString('hex');
    let slug = slugify(payload.slug || translations[config.defaultLanguage].title) || `beitrag-${id.slice(0, 4)}`;
    if (items.some((item) => item.slug === slug && item.id !== id)) slug = `${slug}-${id.slice(0, 3)}`;

    const now = new Date().toISOString();
    const entry = normalizeNews({
      ...(existing ?? {}),
      id,
      slug,
      date,
      published,
      image,
      translations,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });

    const next = existing ? items.map((item) => (item.id === id ? entry : item)) : [...items, entry];
    const result = commitFile(
      path.join(rootDir, 'content/news.json'),
      { items: next },
      'Der Beitrag wurde nicht gespeichert, weil der Build fehlgeschlagen ist.',
    );
    sendJson(res, 200, { ok: true, id, slug, ms: result.ms });
  }

  function deleteNews(res, id) {
    const items = loadNews(rootDir);
    if (!items.some((entry) => entry.id === id)) {
      sendJson(res, 404, { ok: false, error: 'Beitrag nicht gefunden.' });
      return;
    }
    const next = items.filter((entry) => entry.id !== id);
    commitFile(
      path.join(rootDir, 'content/news.json'),
      { items: next },
      'Der Beitrag wurde nicht gelöscht, weil der Build fehlgeschlagen ist.',
    );
    const removed = pruneUploads(rootDir, {
      news: next,
      gallery: loadGallery(rootDir, { config, dictionaries: currentState().dictionaries, site }),
    });
    if (removed) rebuild();
    sendJson(res, 200, { ok: true });
  }

  /* ---------------------------------------------------------------- gallery */

  async function saveGallery(res, body) {
    if (!Array.isArray(body.items)) {
      sendJson(res, 400, { ok: false, error: 'Ungültige Galerie-Daten.' });
      return;
    }

    const items = [];
    for (const [index, raw] of body.items.entries()) {
      const item = normalizeGalleryItem(raw, config);
      if (!item) {
        sendJson(res, 400, { ok: false, error: `Bild ${index + 1}: ungültiger Pfad.` });
        return;
      }
      if (!item.uploaded) {
        const local = path.join(rootDir, 'src', item.src.replace(/^\//, ''));
        if (!fs.existsSync(local)) {
          sendJson(res, 400, { ok: false, error: `Bild ${index + 1}: Datei nicht gefunden (${item.src}).` });
          return;
        }
      }
      const missing = config.languages.filter((language) => !item.captions[language.code]);
      if (missing.length) {
        sendJson(res, 400, {
          ok: false,
          error: `Bild ${index + 1}: Beschriftung fehlt in ${missing.map((language) => language.nativeName).join(', ')}.`,
        });
        return;
      }
      items.push({ ...item, id: item.id || crypto.randomBytes(5).toString('hex') });
    }

    const result = commitFile(
      path.join(rootDir, 'content/gallery.json'),
      { items },
      'Die Galerie wurde nicht gespeichert, weil der Build fehlgeschlagen ist.',
    );
    const removed = pruneUploads(rootDir, { news: loadNews(rootDir), gallery: items });
    if (removed) rebuild();
    sendJson(res, 200, { ok: true, count: items.length, ms: result.ms });
  }

  async function handleUpload(req, res, url) {
    const kind = url.searchParams.get('kind') === 'news' ? 'news' : 'gallery';
    const type = String(req.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const ext = IMAGE_TYPES[type] ?? (type === 'image/jpg' ? 'jpg' : null);
    if (!ext) {
      sendJson(res, 415, { ok: false, error: 'Bitte ein Bild im Format JPG, PNG oder WebP wählen.' });
      return;
    }
    const buffer = await readRaw(req, MAX_UPLOAD);
    if (buffer.length < 512) {
      sendJson(res, 400, { ok: false, error: 'Die Datei ist leer oder beschädigt.' });
      return;
    }
    const probe = probeImage(buffer);
    if (!probe) {
      sendJson(res, 400, { ok: false, error: 'Die Datei konnte nicht als Bild gelesen werden.' });
      return;
    }
    if (probe.width > 8000 || probe.height > 8000) {
      sendJson(res, 400, { ok: false, error: 'Das Bild ist zu groß (max. 8000 × 8000 Pixel).' });
      return;
    }

    const dir = path.join(rootDir, 'content/uploads');
    fs.mkdirSync(dir, { recursive: true });
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(dir, name), buffer);
    const result = rebuild();
    if (!result.ok) {
      fs.rmSync(path.join(dir, name), { force: true });
      sendJson(res, 500, { ok: false, error: 'Der Build ist fehlgeschlagen.', output: result.output });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      kind,
      src: `/assets/uploads/${name}`,
      width: probe.width,
      height: probe.height,
      ms: result.ms,
    });
  }

  /* --------------------------------------------------------------- messages */

  function saveMessages(res, body) {
    const messages = readMessages(rootDir);
    if (body.action === 'clear') {
      writeMessages(rootDir, []);
      sendJson(res, 200, { ok: true, count: 0 });
      return;
    }
    const id = String(body.id ?? '');
    if (!messages.some((message) => message.id === id)) {
      sendJson(res, 404, { ok: false, error: 'Nachricht nicht gefunden.' });
      return;
    }
    writeMessages(
      rootDir,
      messages.filter((message) => message.id !== id),
    );
    sendJson(res, 200, { ok: true });
  }

  /* ----------------------------------------------------------------- routes */

  async function handle(req, res, urlPath) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const session = auth.sessionFrom(req);

    if (urlPath === '/admin/assets/admin.css' || urlPath === '/admin/assets/admin.js') {
      try {
        const buffer = fs.readFileSync(path.join(rootDir, 'src/admin', path.basename(urlPath)));
        sendAsset(
          res,
          urlPath.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
          buffer,
        );
      } catch {
        res.writeHead(404, ADMIN_HEADERS);
        res.end();
      }
      return true;
    }

    /* --------------------------------------------------------------- login */

    if (urlPath === '/admin' || urlPath === '/admin/') {
      if (!auth.hasPassword()) {
        sendHtml(
          res,
          200,
          views.setupPage({ minPassword: auth.minPassword, usingEnvToken: Boolean(process.env.ADMIN_SETUP_TOKEN) }),
        );
        return true;
      }
      if (!session) {
        sendHtml(res, 200, views.loginPage({ next: '/admin/' }));
        return true;
      }
      const state = currentState();
      renderPage(res, state, session, {
        title: 'Übersicht',
        active: 'dashboard',
        body: views.dashboard({
          stats: {
            overrides: state.counts.overrides,
            news: state.counts.news,
            newsDrafts: state.counts.newsDrafts,
            gallery: state.counts.gallery,
            messages: state.counts.messages,
          },
          buildInfo: buildInfo(),
        }),
        flash: url.searchParams.get('flash') ?? '',
      });
      return true;
    }

    if (urlPath === '/admin/setup' && req.method === 'POST') {
      if (!sameOrigin(req)) {
        sendHtml(res, 403, views.errorPage({ status: 403, message: 'Ungültige Herkunft der Anfrage.' }));
        return true;
      }
      if (auth.hasPassword()) {
        redirect(res, '/admin/');
        return true;
      }
      const form = await readFormBody(req);
      if (!safeEqual(form.code ?? '', auth.setupCode)) {
        sendHtml(
          res,
          400,
          views.setupPage({
            error: 'Der Einrichtungscode stimmt nicht. Er steht in der Server-Konsole.',
            minPassword: auth.minPassword,
            usingEnvToken: Boolean(process.env.ADMIN_SETUP_TOKEN),
          }),
        );
        return true;
      }
      const problem = auth.passwordProblem(form.password, form.password2);
      if (problem) {
        sendHtml(
          res,
          400,
          views.setupPage({
            error: problem,
            minPassword: auth.minPassword,
            usingEnvToken: Boolean(process.env.ADMIN_SETUP_TOKEN),
          }),
        );
        return true;
      }
      auth.setPassword(form.password);
      const created = auth.createSession();
      redirect(res, '/admin/?flash=Passwort gespeichert. Willkommen!', {
        'Set-Cookie': auth.cookie(created.token, isSecure(req)),
      });
      return true;
    }

    if (urlPath === '/admin/login' && req.method === 'POST') {
      if (!sameOrigin(req)) {
        sendHtml(res, 403, views.errorPage({ status: 403, message: 'Ungültige Herkunft der Anfrage.' }));
        return true;
      }
      if (!auth.hasPassword()) {
        redirect(res, '/admin/');
        return true;
      }
      const ip = clientIp(req);
      if (auth.tooManyAttempts(ip)) {
        sendHtml(
          res,
          429,
          views.loginPage({ error: 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es erneut.' }),
        );
        return true;
      }
      const form = await readFormBody(req);
      const ok = auth.verify(form.password ?? '');
      auth.recordAttempt(ip, ok);
      if (!ok) {
        sendHtml(res, 401, views.loginPage({ error: 'Das Passwort stimmt nicht.' }));
        return true;
      }
      const created = auth.createSession();
      const next = String(form.next ?? '/admin/');
      redirect(res, next.startsWith('/admin') ? next : '/admin/', {
        'Set-Cookie': auth.cookie(created.token, isSecure(req)),
      });
      return true;
    }

    if (urlPath === '/admin/logout') {
      if (req.method === 'POST') {
        const form = await readFormBody(req);
        if (session && sameOrigin(req) && safeEqual(form._csrf ?? '', session.csrf)) auth.destroy(session.token);
      }
      redirect(res, '/admin/', { 'Set-Cookie': auth.clearCookie(isSecure(req)) });
      return true;
    }

    /* ------------------------------------------------------------ protected */

    const isApi = urlPath.startsWith('/api/admin/');

    if (!auth.hasPassword()) {
      if (isApi) sendJson(res, 401, { ok: false, error: 'Bitte zuerst den Zugang einrichten.' });
      else redirect(res, '/admin/');
      return true;
    }

    if (!session) {
      if (isApi) sendJson(res, 401, { ok: false, error: 'Nicht angemeldet.' });
      else sendHtml(res, 200, views.loginPage({ next: urlPath }));
      return true;
    }

    if (isApi && req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return true;
    }

    if (req.method === 'POST') {
      if (!sameOrigin(req)) {
        sendJson(res, 403, { ok: false, error: 'Ungültige Herkunft der Anfrage.' });
        return true;
      }
      if (isApi && !safeEqual(req.headers['x-csrf'] ?? '', session.csrf)) {
        sendJson(res, 403, { ok: false, error: 'Die Sitzung ist abgelaufen. Bitte die Seite neu laden.' });
        return true;
      }
    }

    try {
      if (isApi) {
        if (urlPath === '/api/admin/texts') {
          await handleTextSave(req, res);
          return true;
        }
        if (urlPath === '/api/admin/news') {
          const body = await readJsonBody(req);
          if (body.action === 'delete') deleteNews(res, String(body.id ?? ''));
          else await saveNews(res, body.entry ?? {});
          return true;
        }
        if (urlPath === '/api/admin/gallery') {
          await saveGallery(res, await readJsonBody(req));
          return true;
        }
        if (urlPath === '/api/admin/upload') {
          await handleUpload(req, res, url);
          return true;
        }
        if (urlPath === '/api/admin/messages') {
          saveMessages(res, await readJsonBody(req));
          return true;
        }
        sendJson(res, 404, { ok: false, error: 'Unbekannter Endpunkt.' });
        return true;
      }

      if (urlPath === '/admin/texte') {
        handleTextsPage(req, res, url, session);
        return true;
      }
      if (urlPath === '/admin/neuigkeiten' || urlPath === '/admin/neuigkeiten/') {
        const state = currentState();
        renderPage(res, state, session, {
          title: 'Neuigkeiten',
          active: 'news',
          body: views.newsListPage({
            items: [...state.news].sort((a, b) => String(b.date).localeCompare(String(a.date))),
            languages: config.languages,
          }),
        });
        return true;
      }
      if (urlPath.startsWith('/admin/neuigkeiten/')) {
        newsEditor(res, session, decodeURIComponent(urlPath.slice('/admin/neuigkeiten/'.length)));
        return true;
      }
      if (urlPath === '/admin/galerie') {
        const state = currentState();
        renderPage(res, state, session, {
          title: 'Galerie',
          active: 'gallery',
          body: views.galleryPage({ items: state.gallery, languages: config.languages }),
        });
        return true;
      }
      if (urlPath === '/admin/einstellungen') {
        const state = currentState();
        if (req.method === 'POST') {
          const form = await readFormBody(req);
          if (!safeEqual(form._csrf ?? '', session.csrf)) {
            sendHtml(res, 403, views.errorPage({ status: 403, message: 'Die Sitzung ist abgelaufen. Bitte erneut anmelden.' }));
            return true;
          }
          const settings = {
            site: { csrf: session.csrf, minPassword: auth.minPassword, siteUrl: config.siteUrl },
            languages: config.languages,
            buildInfo: buildInfo(),
            contentItems: countContentFiles(),
          };
          if (form.action === 'rebuild') {
            const result = rebuild();
            if (!result.ok) {
              renderPage(res, state, session, {
                title: 'Einstellungen',
                active: 'settings',
                body: views.settingsPage({ ...settings, error: `Der Build ist fehlgeschlagen:\n${result.output.split('\n').slice(-5).join('\n')}` }),
              });
              return true;
            }
            redirect(res, `/admin/einstellungen?flash=${encodeURIComponent(`Website neu gebaut (${result.ms} ms).`)}`);
            return true;
          }
          if (!auth.verify(form.current ?? '')) {
            renderPage(res, state, session, {
              title: 'Einstellungen',
              active: 'settings',
              body: views.settingsPage({ ...settings, error: 'Das aktuelle Passwort stimmt nicht.' }),
            });
            return true;
          }
          const problem = auth.passwordProblem(form.password, form.password2);
          if (problem) {
            renderPage(res, state, session, {
              title: 'Einstellungen',
              active: 'settings',
              body: views.settingsPage({ ...settings, error: problem }),
            });
            return true;
          }
          auth.setPassword(form.password);
          auth.destroyAll(session.token);
          redirect(res, `/admin/?flash=${encodeURIComponent('Passwort geändert. Alle anderen Sitzungen wurden abgemeldet.')}`);
          return true;
        }

        renderPage(res, state, session, {
          title: 'Einstellungen',
          active: 'settings',
          body: views.settingsPage({
            site: { csrf: session.csrf, minPassword: auth.minPassword, siteUrl: config.siteUrl },
            languages: config.languages,
            buildInfo: buildInfo(),
            contentItems: countContentFiles(),
            message: url.searchParams.get('flash') ?? '',
          }),
        });
        return true;
      }
      if (urlPath === '/admin/nachrichten') {
        const state = currentState();
        renderPage(res, state, session, {
          title: 'Nachrichten',
          active: 'messages',
          body: views.messagesPage({ messages: state.messages }),
        });
        return true;
      }

      sendHtml(res, 404, views.errorPage({ status: 404, message: 'Diese Seite gibt es nicht.' }));
      return true;
    } catch (error) {
      const status = error.status ?? 500;
      if (isApi) sendJson(res, status, { ok: false, error: error.message || 'Unerwarteter Fehler.' });
      else sendHtml(res, status, views.errorPage({ status, message: error.message || 'Unerwarteter Fehler.' }));
      return true;
    }
  }

  return { handle, auth };
}
